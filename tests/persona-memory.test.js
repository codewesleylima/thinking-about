import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { builtinAgents, defaultPreferences, getAgent, saveAgent, loadPreferences, setPreference } from '../src/profiles.js';
import { summarize, contextMessages } from '../src/memory.js';
import { runAgent } from '../src/agent.js';

test('preferências e agentes persistem; dados inválidos não são sobrescritos', async () => {
  const { root } = await makeFixture();
  assert.deepEqual(await loadPreferences(root), defaultPreferences);
  await setPreference(root, 'clarification', 'always');
  assert.equal((await loadPreferences(root)).clarification, 'always');
  await assert.rejects(setPreference(root, 'allowWrite', true));
  await assert.rejects(setPreference(root, 'autoSummary', 'false'));
  const custom = { name: 'mentor', description: 'Ensino', instructions: 'Explique com exemplos.', readOnly: true };
  await saveAgent(root, custom); assert.deepEqual(await getAgent(root, 'mentor'), custom);
  await assert.rejects(saveAgent(root, { ...custom, name: 'general' }));
  const file = path.join(root, '.yzzy', 'agents.json');
  await writeFile(file, '[]');
  await assert.rejects(saveAgent(root, custom)); assert.equal(await readFile(file, 'utf8'), '[]');
  await writeFile(path.join(root, '.yzzy', 'preferences.json'), '{');
  await assert.rejects(loadPreferences(root), SyntaxError);
});

test('perfil somente leitura limita concessões mesmo com flags de escrita e execução', async () => {
  const f = await makeFixture();
  let step = 0;
  const result = await runAgent({ ...f, objective: 'Revise', agentProfile: builtinAgents.reviewer,
    permissions: { allowWrite: true, allowExec: true }, provider: { async generate({ system }) {
      assert.match(system, /allowWrite=false, allowExec=false/);
      return step++ === 0 ? { text: '', calls: [{ id: 'no', name: 'create_file', args: { path: 'src/no.js', content: 'x' } }] } : { text: 'fim', calls: [] };
    } } });
  assert.deepEqual(result.state.permissions, { allowWrite: false, allowExec: false });
  assert.equal(result.state.messages.find(m => m.role === 'tool').result.ok, false);
  await assert.rejects(lstat(path.join(f.root, 'src/no.js')), { code: 'ENOENT' });
});

test('retomada recusa mudança de personalidade e conserva perguntas humanas', async () => {
  const f = await makeFixture(); const provider = { async generate() { return { text: 'fim', calls: [] }; } };
  const first = await runAgent({ ...f, objective: 'Não altere a API.', provider });
  const rejected = await runAgent({ ...f, resumeId: first.id, objective: 'Continue', preferences: { ...defaultPreferences, tone: 'formal' }, provider });
  assert.match(rejected.error, /mesmo perfil/);
  const resumed = await runAgent({ ...f, resumeId: first.id, objective: 'Explique a regra.', provider });
  assert.equal(resumed.state.modelCalls, 2);
  assert.deepEqual(resumed.state.summary.userInstructions, ['Não altere a API.', 'Explique a regra.']);
});

test('perfil inválido falha antes de deixar lock no workspace', async () => {
  const f = await makeFixture();
  await assert.rejects(runAgent({ ...f, objective: 'x', agentProfile: null }));
  await assert.rejects(lstat(path.join(f.root, '.yzzy/workspace.lock')), { code: 'ENOENT' });
});

test('compactação conserva autoridade, requisitos e pares proposta/resultado sem apagar transcript', () => {
  const state = { objective: 'Corrigir sem mudar assinatura', permissions: { allowWrite: true, allowExec: false },
    agent: 'coder', messages: [{ role: 'user', text: 'Nunca remover a validação.' }], evidence: [{ id: 'check', command: 'tests', passed: true, revision: 'r1' }],
    pendingTool: null, uncertainEffect: true, modelCalls: 7, toolCalls: 6, spent: 12, held: 4, created: 1 };
  for (let i = 0; i < 6; i++) state.messages.push(
    { role: 'assistant', text: 'Observação ' + 'a'.repeat(3000), calls: [{ id: String(i), name: 'read_file', args: { path: 'src/a.js' } }] },
    { role: 'tool', id: String(i), name: 'read_file', result: { ok: true, content: 'b'.repeat(3000) } });
  const original = structuredClone(state);
  const projection = contextMessages(state, 15000);
  assert.equal(projection.compacted, true); assert.deepEqual(state, original);
  assert.match(projection.messages[0].text, /Nunca remover a validação/);
  assert.match(projection.messages[0].text, /"allowExec":false/);
  assert.match(projection.messages[0].text, /"uncertainEffect":true/);
  for (const m of projection.messages.filter(m => m.role === 'tool')) assert.ok(projection.messages.some(a => a.calls?.some(c => c.id === m.id)));
  assert.deepEqual(summarize(state).resources, { calls: 7, tools: 6, spent: 12, held: 4, created: 1 });
  assert.equal(contextMessages(state, 1, false).compacted, false);
  assert.equal(contextMessages(state, 1e9, true, true).compacted, true);
});
