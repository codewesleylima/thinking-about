import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { capture, dockerArgs, runDocker } from '../src/executor.js';
import { makeFixture } from '../src/demo.js';
import { Workspace } from '../src/workspace.js';
test('flags Docker removem rede, escrita no projeto, privilégios e herança de chave', () => {
  const args = dockerArgs({ docker: { image: 'node:24', memory: '512m', cpus: '1', pids: 64 } }, 'C:/tmp/snapshot', 'yzzy-name', ['node', '--test']);
  for (const flag of ['--pull=never', '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges']) assert.ok(args.includes(flag));
  assert.ok(args.includes('65534:65534')); assert.ok(args.some(x => x.endsWith('target=/workspace,readonly')));
  assert.equal(args.some(x => /OPENAI_API_KEY|docker.sock/.test(x)), false);
  assert.deepEqual(args.slice(-3), ['node', 'node:24', '--test']);
});
test('capture contém saída, timeout e cancelamento sem shell', async () => {
  const noisy = await capture(process.execPath, ['-e', "process.stdout.write('x'.repeat(10000))"], { maxBytes: 100 });
  assert.equal(noisy.truncated, true); assert.ok(Buffer.byteLength(noisy.output) <= 100);
  const timeout = await capture(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 100 });
  assert.equal(timeout.timedOut, true);
  const abort = new AbortController(); setTimeout(() => abort.abort(), 100);
  const cancelled = await capture(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: abort.signal });
  assert.equal(cancelled.cancelled, true);
  const already = new AbortController(); already.abort();
  await assert.rejects(capture(process.execPath, ['-e', "throw new Error('must not start')"], { signal: already.signal }));
});
test('executor cria snapshot sem segredo e valida revisão; remove container mesmo no timeout', async () => {
  const { root, config } = await makeFixture(); await writeFile(path.join(root, '.env'), 'SECRET=canary');
  const ws = new Workspace(root, config); const invocations = [];
  const runner = async (bin, args) => {
    assert.equal(bin, 'docker'); invocations.push(args);
    if (args[0] === 'run') {
      const mount = args[args.indexOf('--mount') + 1];
      const staging = mount.slice('type=bind,source='.length).split(',target=')[0];
      await assert.rejects(readFile(path.join(staging, '.env')), { code: 'ENOENT' });
      assert.match(await readFile(path.join(staging, 'src/eligibility.js'), 'utf8'), /age > 18/);
      return { exitCode: null, timedOut: true, cancelled: false, truncated: false, output: '' };
    }
    return { exitCode: 0, output: '' };
  };
  const result = await runDocker(ws, 'tests', { runner });
  assert.equal(result.passed, false); assert.equal(result.cleanupKnown, true); assert.equal(invocations[1][0], 'rm');
});
test('alteração humana durante teste invalida evidência e cleanup desconhecido falha fechado', async () => {
  const { root, config } = await makeFixture(); const ws = new Workspace(root, config);
  const result = await runDocker(ws, 'tests', { runner: async (_, args) => {
    if (args[0] === 'run') { await writeFile(path.join(root, 'src/eligibility.js'), 'changed'); return { exitCode: 0, output: '', truncated: false }; }
    return { exitCode: 1, output: 'daemon unavailable' };
  } });
  assert.notEqual(result.revision, result.currentRevision); assert.equal(result.cleanupKnown, false); assert.equal(result.passed, false);
});
