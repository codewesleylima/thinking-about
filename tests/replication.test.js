import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createReplica } from '../src/replication.js';
import { capture } from '../src/executor.js';
import { checkReplication } from '../scripts/check-replication.js';

test('especificação rastreável preserva hash do estudo e referências executáveis', async () => {
  const checked = await checkReplication(); assert.equal(checked.requirements, 30);
  assert.equal(checked.studySha256, '89ca3740bec8b30e3e171becd99c61fa034a994821822911e2ff213f525c0252');
});

test('réplica é independente, mantém controles, personaliza alias e funciona sem estado da origem', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'yzzy-replica-')), directory = path.join(parent, 'agent');
  const result = await createReplica({ directory, name: 'sample-agent', command: 'sampleai' });
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'sample-agent'); assert.deepEqual(pkg.bin, { sampleai: 'bin/yzzy.js' });
  assert.match(pkg.scripts['install:cmd'], /-CommandName sampleai/);
  assert.equal(pkg.dependencies['@openai/codex'], '0.163.0');
  const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(lock.name, 'sample-agent'); assert.equal(lock.packages[''].bin.sampleai, 'bin/yzzy.js');
  assert.equal(lock.packages['node_modules/@openai/codex'].version, '0.163.0');
  for (const entry of ['.git', '.yzzy', 'node_modules', '.env']) await assert.rejects(lstat(path.join(directory, entry)), { code: 'ENOENT' });
  const manifest = JSON.parse(await readFile(path.join(directory, 'replica.manifest.json'), 'utf8'));
  assert.equal(manifest.files.length, result.files);
  assert.ok(manifest.files.some(file => file.path === 'src/tools.js'));
  const demo = await capture(process.execPath, [path.join(directory, 'bin/yzzy.js'), 'demo', '--json']);
  assert.equal(demo.exitCode, 0, demo.output);
  assert.equal(JSON.parse(demo.output.trim().split('\n').at(-1)).status, 'verified');
  const check = await capture(process.execPath, [path.join(directory, 'scripts/check-replication.js')]);
  assert.equal(check.exitCode, 0, check.output);
  await writeFile(path.join(directory, 'human.txt'), 'preserve');
  await assert.rejects(createReplica({ directory, name: 'sample-agent' }), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(directory, 'human.txt'), 'utf8'), 'preserve');
  await assert.rejects(createReplica({ directory: path.join(parent, 'bad'), command: '../evil' }));
});
