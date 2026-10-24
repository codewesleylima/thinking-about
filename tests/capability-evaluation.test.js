import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilitySuite, gradeCapabilityOutput, compareCapabilitySamples, compareEvolutionCapabilities, summarizeCapabilityBaseline, evaluateEvolutionBaseline } from '../src/capability-evaluation.js';
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

test('pré-avaliação distingue teto, margem insuficiente e instabilidade sem alterar aprovação de ganho', () => {
  const suite = buildCapabilitySuite(), full = gradeCapabilityOutput(result(suite), suite);
  const oneFailure = gradeCapabilityOutput(result(suite, e => e.family === 'relevance_steps'), suite);
  const saturated = summarizeCapabilityBaseline([full, full]);
  assert.equal(saturated.saturated, true); assert.equal(saturated.canImprove, false);
  assert.equal(summarizeCapabilityBaseline([oneFailure, oneFailure]).canImprove, true);
  assert.equal(summarizeCapabilityBaseline([oneFailure, oneFailure], 2).canImprove, false);
  const unstable = summarizeCapabilityBaseline([oneFailure, full]);
  assert.equal(unstable.unstable, true); assert.equal(unstable.canImprove, false);
});

test('pré-avaliação executa somente baseline com gabarito privado e não precisa de candidata', async () => {
  const f = await makeFixture(); let calls = 0;
  const r = await evaluateEvolutionBaseline({ baseline: { directory: '/base', revision: 'b' }, config: f.config,
    auditDirectory: path.join(f.root, 'baseline-private'),
    sandboxRunner: async ({ snapshot, evaluationDirectory }) => {
      calls++; assert.equal(snapshot.revision, 'b');
      await assert.rejects(readFile(path.join(evaluationDirectory, 'private-oracle.json')), { code: 'ENOENT' });
      const expected = JSON.parse(await readFile(path.join(f.root, 'baseline-private/private-oracle.json'), 'utf8'));
      return { passed: true, cleanupKnown: true, stdout: JSON.stringify({ schema: 1,
        results: expected.map(e => ({ id: e.id, value: e.value, durationMs: 1 })) }) };
    } });
  assert.equal(calls, f.config.evolution.repetitions); assert.equal(r.saturated, true);
  assert.equal(r.baselinePassed, 36); assert.equal(r.total, 36); assert.equal(r.realModelCalls, 0);
  assert.equal(r.candidateRevision, undefined);
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
