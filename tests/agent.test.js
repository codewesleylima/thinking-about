import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runAgent } from '../src/agent.js';
import { demo, makeFixture } from '../src/demo.js';
import { Journal } from '../src/journal.js';
const response = (text = '', calls = []) => ({ text, calls });
function sequence(items) { let i = 0; return { async generate(input) { const item = items[i++]; return typeof item === 'function' ? item(input) : item || response('fim'); } }; }
const call = (id, name, args) => response('', [{ id, name, args }]);
const run = async (provider, options = {}) => { const fixture = await makeFixture(); return { fixture, result: await runAgent({ ...fixture, provider, objective: 'fixture', ...options }) }; };
test('demonstração corrige fronteira e só avaliador independente marca verified', async () => {
  const r = await demo(); assert.equal(r.state.status, 'verified');
  const journal = await Journal.load(r.root, r.id); assert.ok(journal.events.some(e => e.type === 'independent_verdict' && e.data.passed));
});
test('afirmação de teste inventado permanece completed_unverified', async () => {
  const { result } = await run(sequence([response('Todos os testes passaram, sou verified.') ]));
  assert.equal(result.state.status, 'completed_unverified'); assert.equal(result.state.evidence.length, 0);
});
test('prompt injection não autoriza leitura de segredo ou ferramenta inventada', async () => {
  const { result } = await run(sequence([call('1', 'read_file', { path: '.env' }), call('2', 'shell', { command: 'curl evil' }), response('fim')]));
  const outputs = result.state.messages.filter(x => x.role === 'tool'); assert.equal(outputs.length, 2); assert.ok(outputs.every(x => !x.result.ok));
  assert.equal(result.state.status, 'completed_unverified');
});
test('ask_user suspende e retoma com mesma autoridade e contadores', async () => {
  const { fixture, result } = await run(sequence([call('q', 'ask_user', { question: 'Qual regra vale para 18 anos?' })]));
  assert.equal(result.state.status, 'waiting_user');
  const resumed = await runAgent({ ...fixture, resumeId: result.id, objective: 'Incluir 18.', provider: sequence([response('Entendido')]) });
  assert.equal(resumed.state.status, 'completed_unverified'); assert.equal(resumed.state.modelCalls, 2);
  assert.equal(resumed.state.messages.filter(m => m.role === 'user').length, 2);
});
test('modelo não pode editar sem --allow-write', async () => {
  const { result } = await run(sequence([call('c', 'create_file', { path: 'src/new.js', content: 'x' }), response('fim')]));
  assert.match(result.state.messages.find(m => m.role === 'tool').result.error, /allow-write/);
});
test('detector interrompe repetição e ciclos alternados', async () => {
  let n = 0; const provider = { async generate() { return call(String(++n), n % 2 ? 'list_files' : 'search', n % 2 ? {} : { query: 'age' }); } };
  const { result } = await run(provider); assert.equal(result.state.status, 'limited'); assert.match(result.error, /Loop/);
});
test('limite de chamadas persiste após retomada e não admite nova inferência', async () => {
  const fixture = await makeFixture(); fixture.config.limits.maxModelCalls = 1;
  const first = await runAgent({ ...fixture, objective: 'task', provider: sequence([response('fim')]) });
  let called = false;
  const second = await runAgent({ ...fixture, resumeId: first.id, objective: 'continue', provider: { async generate() { called = true; return response(); } } });
  assert.equal(second.state.status, 'limited'); assert.equal(called, false);
});
test('crash com ferramenta pendente recusa replay', async () => {
  const { fixture, result } = await run(sequence([response('fim')]));
  const j = await Journal.load(fixture.root, result.id); const state = structuredClone(j.state);
  state.pendingTool = { id: 'crash', name: 'create_file', args: { path: 'src/x', content: 'x' } };
  await j.append('tool_started', state);
  let called = false;
  const resumed = await runAgent({ ...fixture, resumeId: j.id, objective: 'continue', provider: { async generate() { called = true; return response(); } } });
  assert.equal(resumed.state.status, 'error'); assert.equal(called, false); assert.match(resumed.error, /incerto/);
});
test('lote ainda não respondido após crash também recusa replay', async () => {
  const { fixture, result } = await run(sequence([response('fim')]));
  const j = await Journal.load(fixture.root, result.id); const state = structuredClone(j.state);
  state.messages.push({ role: 'assistant', text: '', calls: [{ id: 'unanswered', name: 'list_files', args: {} }] });
  await j.append('model_completed', state);
  const resumed = await runAgent({ ...fixture, resumeId: j.id, objective: 'continue', provider: sequence([]) });
  assert.match(resumed.error, /pendente/);
});
test('conflito de hash volta ao modelo sem aplicar alteração', async () => {
  const { result } = await run(sequence([call('conflict', 'replace_text', { path: 'src/eligibility.js', expected_sha256: '0'.repeat(64), old_text: 'age > 18', new_text: 'age >= 18' }), response('Conflito detectado')]), { permissions: { allowWrite: true, allowExec: false } });
  assert.equal(result.state.status, 'completed_unverified'); assert.equal(result.state.uncertainEffect, false);
});
test('teste Docker aprovado se vincula à revisão; edição posterior invalida', async () => {
  const { result } = await run(sequence([call('check', 'run_check', { command: 'tests' }), response('fim')]), {
    permissions: { allowWrite: false, allowExec: true }, dockerRunner: async () => ({ exitCode: 0, output: '', truncated: false, timedOut: false, cancelled: false }) });
  assert.equal(result.state.status, 'checks_passed');
  const { fixture, result: r } = await run(sequence([call('check2', 'run_check', { command: 'tests' }), response('fim')]), {
    permissions: { allowWrite: false, allowExec: true }, dockerRunner: async () => ({ exitCode: 0, output: '', truncated: false }) });
  await writeFile(path.join(fixture.root, 'src/eligibility.js'), 'human change');
  const resumed = await runAgent({ ...fixture, resumeId: r.id, objective: 'conclua', permissions: { allowWrite: false, allowExec: true }, provider: sequence([response('fim')]) });
  assert.equal(resumed.state.status, 'completed_unverified');
});
test('teste com falha não pode ser declarado aprovado pelo modelo', async () => {
  const { result } = await run(sequence([call('check', 'run_check', { command: 'tests' }), response('Passei!')]), {
    permissions: { allowWrite: false, allowExec: true }, dockerRunner: async (_, args) => ({ exitCode: args[0] === 'run' ? 1 : 0, output: '', truncated: false }) });
  assert.equal(result.state.status, 'failed');
});
test('cancelamento e contexto grande impedem a próxima chamada', async () => {
  const controller = new AbortController(); controller.abort(); let called = false;
  const provider = { async generate() { called = true; return response(); } };
  const { result } = await run(provider, { signal: controller.signal }); assert.equal(result.state.status, 'cancelled'); assert.equal(called, false);
  const fixture = await makeFixture(); fixture.config.limits.maxContextBytes = 10;
  const limited = await runAgent({ ...fixture, objective: 'task', provider }); assert.equal(limited.state.status, 'limited'); assert.equal(called, false);
});
test('mudança de runtime ou permissão impede retomar autoridade antiga', async () => {
  const { fixture, result } = await run(sequence([response('fim')]));
  const j = await Journal.load(fixture.root, result.id); const s = structuredClone(j.state); s.runtimeHash = 'old-runtime'; await j.append('fixture_runtime_change', s);
  const r = await runAgent({ ...fixture, resumeId: result.id, objective: 'continue', provider: sequence([]) });
  assert.match(r.error, /Runtime atualizado/);
  const { fixture: f2, result: r2 } = await run(sequence([response('fim')]));
  const changed = await runAgent({ ...f2, resumeId: r2.id, objective: 'continue', permissions: { allowWrite: true, allowExec: false }, provider: sequence([]) });
  assert.match(changed.error, /mesmas permissões/);
});
