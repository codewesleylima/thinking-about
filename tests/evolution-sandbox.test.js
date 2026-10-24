import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, lstat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { createEvolutionSnapshot, evolutionDockerArgs, runEvolutionSandbox } from '../src/evolution-sandbox.js';

test('snapshot seleciona arquivos sem metadata Git, estado privado ou segredos; preserva bytes e detecta paths proibidos', async () => {
  const f = await makeFixture();
  await writeFile(path.join(f.root, '.env'), 'canary'); await mkdir(path.join(f.root, '.github/workflows'), { recursive: true });
  await writeFile(path.join(f.root, '.github/workflows/ci.yml'), 'name: CI\n');
  const s = await createEvolutionSnapshot(f.root, ['src/eligibility.js', '.github/workflows/ci.yml'], f.config);
  try {
    assert.equal(s.files, 2); await assert.rejects(readFile(path.join(s.directory, '.env')), { code: 'ENOENT' });
    assert.match(await readFile(path.join(s.directory, 'src/eligibility.js'), 'utf8'), /isAdult/);
  } finally { await s.dispose(); }
  await assert.rejects(lstat(s.directory), { code: 'ENOENT' });
  await assert.rejects(createEvolutionSnapshot(f.root, ['.env'], f.config), /bloqueado/);
});

test('flags isolam arquivos, rede, recursos e usuário, sem socket Docker ou credenciais', () => {
  const f = { evolution: { image: 'node@sha256:' + 'a'.repeat(64), memory: '1g', cpus: '2', pids: 256 } };
  const args = evolutionDockerArgs(f, 'C:/snapshot', 'yzzy-test', ['--test'], 'C:/evaluation');
  for (const flag of ['--network=none', '--read-only', '--cap-drop=ALL', '--pull=never', '65534:65534']) assert.ok(args.includes(flag));
  assert.ok(args.some(v => v.endsWith('target=/workspace,readonly')));
  assert.ok(args.some(v => v.endsWith('target=/evaluation,readonly')));
  assert.equal(args.some(v => /docker\.sock|OPENAI_API_KEY|CODEX_HOME/.test(v)), false);
});

test('container é removido após cancelamento; limpeza incerta impede aprovação', async () => {
  const f = await makeFixture(), calls = [];
  const r = await runEvolutionSandbox({ snapshot: { directory: 'C:/snapshot', revision: 'r' }, config: f.config, argv: ['--test'],
    runner: async (_, args) => { calls.push(args); return args[0] === 'run' ? { exitCode: null, stdout: '', stderr: '', cancelled: true }
      : { exitCode: 1, stderr: 'daemon unavailable' }; } });
  assert.equal(r.cleanupKnown, false); assert.equal(r.passed, false); assert.equal(calls[1][0], 'rm');
});
