import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { capture } from '../src/executor.js';
const cli = fileURLToPath(new URL('../bin/yzzy.js', import.meta.url));
test('CLI demo JSONL termina em status estruturado e journal inspecionável', async () => {
  const r = await capture(process.execPath, [cli, 'demo', '--json']); assert.equal(r.exitCode, 0, r.output);
  const events = r.output.trim().split('\n').map(x => JSON.parse(x)); const result = events.at(-1);
  assert.equal(result.status, 'verified'); assert.ok(result.journal);
  const inspected = await capture(process.execPath, [cli, 'inspect', result.session, '--workspace', result.workspace, '--json']);
  assert.equal(inspected.exitCode, 0, inspected.output); assert.equal(JSON.parse(inspected.output).status, 'verified');
});
test('init preserva configuração e instruções existentes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'yzzy-init-'));
  const first = await capture(process.execPath, [cli, 'init', '--workspace', root, '--json']); assert.equal(first.exitCode, 0);
  await writeFile(path.join(root, 'YZZY.md'), 'human instructions');
  const second = await capture(process.execPath, [cli, 'init', '--workspace', root, '--json']); assert.equal(second.exitCode, 0);
  assert.equal(await readFile(path.join(root, 'YZZY.md'), 'utf8'), 'human instructions');
  assert.ok(JSON.parse(second.output).every(x => x.endsWith('preservado')));
});
test('CLI rejeita comando e opção desconhecidos com código 2', async () => {
  for (const args of [['unknown'], ['run', '--unsafe-mode']]) {
    const r = await capture(process.execPath, [cli, ...args]); assert.equal(r.exitCode, 2);
  }
});
test('workspace ausente produz diagnóstico acionável sem criar o diretório solicitado', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'yzzy-missing-root-')); const missing = path.join(parent, 'not-created');
  const r = await capture(process.execPath, [cli, 'sessions', '--workspace', missing]);
  assert.equal(r.exitCode, 2); assert.match(r.output, /--workspace e --config/);
  await assert.rejects(lstat(missing), { code: 'ENOENT' });
});

test('CLI cria perfil restrito e mantém preferência após tentativa inválida', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'yzzy-persona-cli-'));
  const invoke = args => capture(process.execPath, [cli, ...args, '--workspace', root, '--json']);
  const created = await invoke(['agent', 'create', 'mentor', '--from', 'reviewer', '--instructions', 'Ensine com exemplos.']);
  assert.equal(created.exitCode, 0, created.output); assert.equal(JSON.parse(created.output).readOnly, true);
  const selected = await invoke(['agent', 'show', 'mentor']); assert.equal(JSON.parse(selected.output).instructions, 'Ensine com exemplos.');
  assert.equal((await invoke(['settings', 'set', 'clarification', 'always'])).exitCode, 0);
  assert.equal((await invoke(['settings', 'set', 'clarification', 'invalid'])).exitCode, 2);
  const settings = await invoke(['settings', 'show']); assert.equal(JSON.parse(settings.output).clarification, 'always');
});

test('CLI exporta conversa persistida e recusa sobrescrever o destino', async () => {
  const demo = await capture(process.execPath, [cli, 'demo', '--json']);
  const result = JSON.parse(demo.output.trim().split('\n').at(-1));
  const output = path.join(result.workspace, 'conversation.md');
  const args = [cli, 'export', result.session, '--workspace', result.workspace, '--output', output, '--json'];
  assert.equal((await capture(process.execPath, args)).exitCode, 0);
  assert.match(await readFile(output, 'utf8'), /YZZY BLACK/);
  assert.equal((await capture(process.execPath, args)).exitCode, 2);
});

test('CLI expõe catálogo e plano da equipe sem inferência, rede ou comandos', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'yzzy-team-cli-'));
  const plan = await capture(process.execPath, [cli, 'team', 'plan', 'Investigue erro Java', '--specialists', 'java,debugger,tester', '--workspace', root, '--json']);
  assert.equal(plan.exitCode, 0, plan.output);
  assert.deepEqual(JSON.parse(plan.output).specialists, ['java', 'debugger', 'tester']);
  const profile = await capture(process.execPath, [cli, 'agent', 'show', 'java', '--workspace', root, '--json']);
  assert.equal(profile.exitCode, 0); assert.match(JSON.parse(profile.output).instructions, /NoSuchMethodError/);
  const invalid = await capture(process.execPath, [cli, 'team', 'plan', 'x', '--specialists', 'not_real', '--workspace', root]);
  assert.equal(invalid.exitCode, 2);
});
