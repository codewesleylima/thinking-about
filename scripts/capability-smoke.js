import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReplica } from '../src/replication.js';
import { loadConfig } from '../src/config.js';
import { createEvolutionSnapshot } from '../src/evolution-sandbox.js';
import { compareEvolutionCapabilities } from '../src/capability-evaluation.js';

// Controle de infraestrutura: defeito deliberado na fixture, sem chamada de modelo.
const parent = await mkdtemp(path.join(tmpdir(), 'yzzy-capability-control-'));
const root = path.join(parent, 'runtime');
await createReplica({ directory: root, name: 'capability-fixture', command: 'fixtureai' });
const { config } = await loadConfig(root, undefined, {});
const manifest = JSON.parse(await readFile(path.join(root, 'replica.manifest.json'), 'utf8'));
const files = manifest.files.map(f => f.path);
const current = await createEvolutionSnapshot(root, files, config);
let weakened;
try {
  const file = path.join(root, 'src/learning.js'), original = await readFile(file, 'utf8');
  const query = /const query = (?:tokens\(objective\)|new Set\(tokens\(objective\)\.slice\(0, 80\)\)), limit/;
  assert.match(original, query);
  await writeFile(file, original.replace(query, 'const query = new Set(), limit'));
  weakened = await createEvolutionSnapshot(root, files, config);
  const gain = await compareEvolutionCapabilities({ baseline: weakened, candidate: current, config });
  const regression = await compareEvolutionCapabilities({ baseline: current, candidate: weakened, config });
  const tie = await compareEvolutionCapabilities({ baseline: current, candidate: current, config });
  assert.equal(gain.passed, true); assert.ok(gain.improvedCases > 0);
  assert.equal(regression.passed, false); assert.ok(regression.regressedCases > 0);
  assert.equal(tie.passed, false); assert.equal(tie.improvedCases, 0);
  console.log(JSON.stringify({ kind: 'live_docker_comparison_controls', realModelCalls: 0,
    image: config.evolution.image, gain, regression, tie }));
} finally { await current.dispose(); await weakened?.dispose(); }
