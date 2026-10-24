import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { runProcess } from '../src/process-runner.js';
import { createEvolutionSnapshot, runEvolutionSandbox } from '../src/evolution-sandbox.js';
import { evolutionChecks } from '../src/self-improvement.js';

// Valida o checkout Git real, inclusive arquivos ausentes da réplica npm.
// Não usa modelo, não edita o checkout e não faz commit/push.
const root = fileURLToPath(new URL('../', import.meta.url));
const { config } = await loadConfig(root, undefined, {});
const listed = await runProcess('git', ['ls-files', '-z'], { cwd: root });
assert.equal(listed.exitCode, 0, listed.stderr);
assert.equal(listed.truncated, false); assert.equal(listed.cleanupKnown, true);
const files = listed.stdout.split('\0').filter(Boolean);
assert.ok(files.includes('.env.example'), 'O ensaio exige o template rastreado que provocou a regressão');
const snapshot = await createEvolutionSnapshot(root, files, config);
try {
  await assert.rejects(readFile(path.join(snapshot.directory, '.env.example')), { code: 'ENOENT' });
  const checks = [];
  for (const argv of evolutionChecks) {
    const result = await runEvolutionSandbox({ snapshot, config, argv });
    checks.push({ argv, passed: result.passed, cleanupKnown: result.cleanupKnown, isolation: result.isolation });
    console.log(JSON.stringify(checks.at(-1)));
    assert.equal(result.passed, true, JSON.stringify(result));
  }
  console.log(JSON.stringify({ kind: 'real_checkout_evolution_baseline', files: snapshot.files,
    image: config.evolution.image, snapshot: snapshot.revision, excludedTemplate: '.env.example', checks, passed: true }));
} finally { await snapshot.dispose(); }
