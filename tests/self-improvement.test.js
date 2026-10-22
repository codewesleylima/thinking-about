import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeFixture, fixtureSource } from '../src/demo.js';
import { runSelfImprovement, evolutionProcess } from '../src/self-improvement.js';
import { hash } from '../src/util.js';

const ok = { exitCode: 0, stdout: '', stderr: '', cleanupKnown: true, truncated: false, cancelled: false };
const url = 'https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html';
const quote = 'Inspect the implementation and test numeric boundaries before release.';
const lesson = { title: 'Verificar fronteiras', summary: 'Conferir contratos e limites antes de publicar.', steps: ['Investigar e testar limites.'],
  verification: 'Executar regressão independente.', limits: 'Receita de teste; não é prova de qualidade geral.', sources: [{ url, quote }] };
const call = (id, name, args) => ({ text: '', calls: [{ id, name, args }] });
const sequence = items => { let i = 0; return { async generate(input) { const value = items[i++]; return typeof value === 'function' ? value(input) : value; } }; };
const documentationReader = async () => ({ url, content: quote, sha256: hash(quote), retrievedAt: new Date().toISOString(), untrusted: true });
async function git(root, ...args) {
  const r = await evolutionProcess('git', args, { cwd: root }); assert.equal(r.exitCode, 0, r.stderr); return r.stdout.trim();
}
async function fixture() {
  const f = await makeFixture(), parent = await mkdtemp(path.join(tmpdir(), 'yzzy-evolution-origin-')), remote = path.join(parent, 'origin.git');
  await mkdir(path.join(f.root, 'tests')); await writeFile(path.join(f.root, '.gitignore'), '.yzzy/\n');
  await writeFile(path.join(f.root, 'tests/original.test.js'), 'original evaluator\n');
  await git(f.root, 'init', '--initial-branch=main');
  await git(f.root, 'config', 'user.name', 'YZZY fixture'); await git(f.root, 'config', 'user.email', 'fixture@example.invalid');
  await git(f.root, 'add', '.'); await git(f.root, 'commit', '-m', 'baseline');
  await git(parent, 'init', '--bare', remote); await git(f.root, 'remote', 'add', 'origin', remote);
  await git(f.root, 'push', '-u', 'origin', 'main'); return { ...f, remote, base: await git(f.root, 'rev-parse', 'HEAD') };
}
function factory(implementation) {
  return phase => phase === 'study' ? sequence([call('source', 'read_documentation', { url }), { text: JSON.stringify({ lessons: [lesson] }), calls: [] }])
    : implementation ? implementation(phase) : sequence([
      input => {
        assert.ok(!input.tools.some(t => ['run_check', 'run_command'].includes(t.name)));
        assert.match(input.system, /allowHostShell=false/);
        return call('read', 'read_file', { path: 'src/eligibility.js' });
      },
      input => call('edit', 'replace_text', { path: 'src/eligibility.js', expected_sha256: input.messages.at(-1).result.sha256, old_text: 'age > 18', new_text: 'age >= 18' }),
      call('test', 'create_file', { path: 'tests/evolved.test.js', content: 'regression for 18\n' }),
      { text: 'Limite corrigido; host precisa verificar.', calls: [] }
    ]);
}
const run = (f, extra = {}) => runSelfImprovement({ ...f, topic: 'Melhorar precisão de fronteiras', documentationReader, providerFactory: factory(),
  runner: (exe, args, options) => exe === process.execPath ? Promise.resolve(ok) : evolutionProcess(exe, args, options), ...extra });

test('pipeline roteirizado pesquisa, edita worktree, preserva testes originais e faz commit/push para remoto bare real', async () => {
  const f = await fixture(), r = await run(f);
  assert.equal(r.report.status, 'published', r.error); assert.equal(r.report.pushed, true);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), r.report.commit);
  assert.equal((await git(f.root, 'ls-remote', 'origin', 'refs/heads/main')).split(/\s+/)[0], r.report.commit);
  assert.match(await readFile(path.join(f.root, 'src/eligibility.js'), 'utf8'), />= 18/);
  assert.equal(await readFile(path.join(f.root, 'tests/original.test.js'), 'utf8'), 'original evaluator\n');
  assert.equal(r.report.checks.length, 6); assert.equal(r.report.totals.modelCalls, 6);
  assert.equal(r.report.totals.toolCalls, 4); assert.equal(r.state.status, 'checks_passed');
});

test('candidata reprovada não altera checkout original nem origem e preserva diagnóstico', async () => {
  const f = await fixture(); let nodeCalls = 0;
  const r = await run(f, { runner: (exe, args, options) => {
    if (exe !== process.execPath) return evolutionProcess(exe, args, options);
    nodeCalls++; return Promise.resolve(nodeCalls <= 3 ? ok : { ...ok, exitCode: 1, stdout: 'regressão reprovada' });
  }, providerFactory: factory(phase => phase === 'repair' ? sequence([{ text: 'Não consegui corrigir.', calls: [] }]) : factory()('implement')) });
  assert.equal(r.report.status, 'error'); assert.equal(r.report.pushed, false);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
  assert.equal(await readFile(path.join(f.root, 'src/eligibility.js'), 'utf8'), fixtureSource);
  assert.match(await readFile(r.file, 'utf8'), /regressão reprovada/);
});

test('mudança humana durante a verificação interrompe integração, sem perder o arquivo', async () => {
  const f = await fixture(); let count = 0;
  const r = await run(f, { runner: async (exe, args, options) => {
    if (exe !== process.execPath) return evolutionProcess(exe, args, options);
    if (++count === 6) await writeFile(path.join(f.root, 'human.txt'), 'preserve'); return ok;
  } });
  assert.equal(r.report.pushed, false); assert.match(r.error, /Origem mudou/);
  assert.equal(await readFile(path.join(f.root, 'human.txt'), 'utf8'), 'preserve');
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
});

test('arquivo de teste original congelado e shell indisponível não são editados/executados', async () => {
  const f = await fixture();
  const r = await run(f, { providerFactory: factory(() => sequence([
    call('read', 'read_file', { path: 'tests/original.test.js' }),
    input => call('edit', 'replace_text', { path: 'tests/original.test.js', expected_sha256: input.messages.at(-1).result.sha256, old_text: 'original', new_text: 'forged' }),
    input => { assert.equal(input.messages.at(-1).result.ok, false); return call('shell', 'run_command', { command: 'echo forged', cwd: '.' }); },
    input => { assert.equal(input.messages.at(-1).result.ok, false); return { text: 'Sem mudanças.', calls: [] }; }
  ])) });
  assert.equal(r.report.status, 'no_changes', r.error); assert.equal(r.report.commit, null);
  assert.equal(await readFile(path.join(f.root, 'tests/original.test.js'), 'utf8'), 'original evaluator\n');
});

test('falha de push mantém commit local e não repete publicação', async () => {
  const f = await fixture(); let pushes = 0;
  const r = await run(f, { runner: (exe, args, options) => {
    if (exe === process.execPath) return Promise.resolve(ok);
    if (args[0] === 'push') { pushes++; return Promise.resolve({ ...ok, exitCode: 1, stderr: 'offline' }); }
    return evolutionProcess(exe, args, options);
  } });
  assert.equal(r.report.status, 'push_unconfirmed'); assert.equal(pushes, 1); assert.equal(r.report.pushed, false);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), r.report.commit);
  assert.equal((await git(f.root, 'ls-remote', 'origin', 'refs/heads/main')).split(/\s+/)[0], f.base);
});

test('árvore suja ou perfil somente leitura impede autoevolução antes da inferência', async () => {
  const f = await fixture(); await writeFile(path.join(f.root, 'human.txt'), 'keep');
  const r = await run(f, { providerFactory() { assert.fail('não deve inferir'); } });
  assert.match(r.error, /mudanças locais/);
  await assert.rejects(run(f, { agentProfile: { name: 'reviewer', readOnly: true } }), /somente leitura/);
});

test('pesquisa e implementação não multiplicam chamadas configuradas', async () => {
  const f = await fixture(); f.config.limits.maxModelCalls = 5;
  const r = await run(f);
  assert.equal(r.report.status, 'limited', r.error); assert.equal(r.report.totals.modelCalls, 5);
  assert.equal(r.report.pushed, false); assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
});

test('verificação que muda o conteúdo invalida a candidata e não publica', async () => {
  const f = await fixture(); let count = 0;
  const r = await run(f, { runner: async (exe, args, options) => {
    if (exe !== process.execPath) return evolutionProcess(exe, args, options);
    if (++count === 6) await writeFile(path.join(options.cwd, 'src/eligibility.js'), 'unverified change');
    return ok;
  } });
  assert.match(r.error, /alterou arquivos/); assert.equal(r.report.pushed, false);
  assert.equal(await git(f.root, 'rev-parse', 'HEAD'), f.base);
});

test('timeout do processo não afirma limpeza nem sucesso', async () => {
  const r = await evolutionProcess(process.execPath, ['-e', 'setTimeout(()=>{},1500)'], { timeoutMs: 50 });
  assert.equal(r.cleanupKnown, false); assert.notEqual(r.exitCode, 0);
});
