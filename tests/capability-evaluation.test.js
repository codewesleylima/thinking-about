import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilitySuite, gradeCapabilityOutput, compareCapabilitySamples, compareEvolutionCapabilities } from '../src/capability-evaluation.js';
import { makeFixture } from '../src/demo.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const result = (suite, corrupt = () => false) => JSON.stringify({ schema: 1,
  results: suite.expected.map(e => ({ id: e.id, value: corrupt(e) ? null : e.value, durationMs: 1 })) });
test('casos reservados variam por execução; host confere observações, não um passed fornecido pelo candidato', () => {
  const a = buildCapabilitySuite(), b = buildCapabilitySuite();
  assert.equal(a.expected.length, 12); assert.notEqual(a.seedHash, b.seedHash);
  assert.equal(JSON.stringify(a.input).includes('expected'), false);
  assert.ok(gradeCapabilityOutput(result(a), a).every(c => c.passed));
  assert.ok(gradeCapabilityOutput(result(a, e => e.family === 'human_authority'), a).some(c => !c.passed));
  assert.throws(() => gradeCapabilityOutput(JSON.stringify({ passed: true }), a));
  const bad = JSON.parse(result(a)); bad.results[1].id = bad.results[0].id;
  assert.throws(() => gradeCapabilityOutput(JSON.stringify(bad), a), /ID/);
});

test('comparador exige ganho consistente, bloqueia regressão, empate e instabilidade', () => {
  const suite = buildCapabilitySuite();
  const baseline = gradeCapabilityOutput(result(suite, e => e.family === 'relevance_steps'), suite);
  const candidate = gradeCapabilityOutput(result(suite), suite);
  assert.equal(compareCapabilitySamples([baseline, baseline], [candidate, candidate]).passed, true);
  assert.equal(compareCapabilitySamples([candidate, candidate], [candidate, candidate]).passed, false);
  assert.equal(compareCapabilitySamples([candidate, candidate], [baseline, baseline]).passed, false);
  assert.equal(compareCapabilitySamples([baseline, baseline], [baseline, candidate]).passed, false);
  assert.throws(() => compareCapabilitySamples([baseline], [candidate]));
});

test('entradas iguais em ambas as versões, ordem alternada e oráculo nunca montado no sandbox', async () => {
  const f = await makeFixture(), seen = [];
  f.config.evolution.repetitions = 2;
  const r = await compareEvolutionCapabilities({ baseline: { directory: '/base', revision: 'b' }, candidate: { directory: '/candidate', revision: 'c' }, config: f.config,
    auditDirectory: path.join(f.root, 'private-evaluation'),
    sandboxRunner: async ({ snapshot, evaluationDirectory }) => {
      seen.push(snapshot.revision);
      const input = JSON.parse(await readFile(path.join(evaluationDirectory, 'input.json'), 'utf8'));
      await assert.rejects(readFile(path.join(evaluationDirectory, 'private-oracle.json')), { code: 'ENOENT' });
      const expected = JSON.parse(await readFile(path.join(f.root, 'private-evaluation/private-oracle.json'), 'utf8'));
      assert.equal(input.cases.length, expected.length);
      return { passed: true, cleanupKnown: true, stdout: JSON.stringify({ schema: 1, results: expected.map(e => ({ id: e.id,
        value: snapshot.revision === 'b' && e.family === 'relevance_steps' ? [] : e.value, durationMs: 1 })) }) };
    } });
  assert.deepEqual(seen, ['b', 'c', 'c', 'b']); assert.equal(r.passed, true); assert.equal(r.repetitions, 2);
});
