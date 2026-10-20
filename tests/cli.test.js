import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { capture } from '../src/executor.js';
const cli = fileURLToPath(new URL('../bin/wzzy.js', import.meta.url));
test('CLI demo JSONL termina em status estruturado e journal inspecionável', async () => {
  const r = await capture(process.execPath, [cli, 'demo', '--json']); assert.equal(r.exitCode, 0, r.output);
  const events = r.output.trim().split('\n').map(x => JSON.parse(x)); const result = events.at(-1);
  assert.equal(result.status, 'verified'); assert.ok(result.journal);
  const inspected = await capture(process.execPath, [cli, 'inspect', result.session, '--workspace', result.workspace, '--json']);
  assert.equal(inspected.exitCode, 0, inspected.output); assert.equal(JSON.parse(inspected.output).status, 'verified');
});
test('init preserva configuração e instruções existentes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wzzy-init-'));
  const first = await capture(process.execPath, [cli, 'init', '--workspace', root, '--json']); assert.equal(first.exitCode, 0);
  await writeFile(path.join(root, 'WZZY.md'), 'human instructions');
  const second = await capture(process.execPath, [cli, 'init', '--workspace', root, '--json']); assert.equal(second.exitCode, 0);
  assert.equal(await readFile(path.join(root, 'WZZY.md'), 'utf8'), 'human instructions');
  assert.ok(JSON.parse(second.output).every(x => x.endsWith('preservado')));
});
test('CLI rejeita comando e opção desconhecidos com código 2', async () => {
  for (const args of [['unknown'], ['run', '--unsafe-mode']]) {
    const r = await capture(process.execPath, [cli, ...args]); assert.equal(r.exitCode, 2);
  }
});
