import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReplica } from '../src/replication.js';
import { runSelfImprovement, evolutionProcess, runtimeRoot } from '../src/self-improvement.js';
import { loadConfig } from '../src/config.js';

const parent = await mkdtemp(path.join(tmpdir(), 'yzzy-live-evolution-')), root = path.join(parent, 'runtime'), remote = path.join(parent, 'origin.git');
const currentBaseline = process.argv.includes('--current');
await createReplica({ directory: root, name: 'evolution-fixture', command: 'fixtureai' });
// Fixture reprodutível: reintroduz o comportamento anterior ANTES de congelar a baseline.
// Não modifica runtime/testes do checkout de origem. O ensaio original da 0.7 precedeu esta preparação.
const learningFile = path.join(root, 'src/learning.js');
const learningSource = await readFile(learningFile, 'utf8');
const expandedScoring = /    \.map\(item => \{\n      const (?:score|primary) = [\s\S]*?\n    \}\)\n    \.filter\(r => r.score >= 1\)/;
if (!currentBaseline && expandedScoring.test(learningSource)) {
  await writeFile(learningFile, learningSource.replace(expandedScoring,
    "    .map(item => ({ item, score: [...tokens([item.topic, item.title, item.summary].join(' '))].filter(t => query.has(t)).length }))\n    .filter(r => r.score >= 1)"));
  // Regressões das correções removidas da fixture, antes de congelar a baseline.
  for (const test of ['learning-additional-fields.test.js', 'learning-late-tokens.test.js']) {
    await unlink(path.join(root, 'tests', test)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
async function git(cwd, args) {
  const r = await evolutionProcess('git', args, { cwd }); assert.equal(r.exitCode, 0, r.stderr); return r.stdout.trim();
}
await git(root, ['init', '--initial-branch=main']);
await git(root, ['config', 'user.name', 'YZZY live fixture']); await git(root, ['config', 'user.email', 'fixture@example.invalid']);
await git(root, ['add', '.']); await git(root, ['commit', '-m', 'baseline for live evolution']);
await git(parent, ['init', '--bare', remote]); await git(root, ['remote', 'add', 'origin', remote]); await git(root, ['push', '-u', 'origin', 'main']);
const loaded = await loadConfig(root, undefined, { YZZY_PROVIDER: 'codex' });
const result = await runSelfImprovement({ ...loaded,
  topic: currentBaseline
    ? 'Estude https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction.md e o módulo src/learning.js. Corrija a perda de termos tardios em lições válidas: o corte de 80 tokens da consulta não deve esconder palavras após a posição 80 nos campos armazenados nem deixar um tema extenso ocultar título/resumo. Leia os testes existentes antes de editar. Preserve o limite atual de 80 tokens relevantes da consulta antes de deduplicar, OR principal, AND adicional, score distinto, filtros de palavras comuns/expiração/allowlist e limites de bytes. Crie novo teste e documentação mínima; não altere testes originais, política ou avaliador. Implemente de forma direta e finalize dentro do orçamento.'
    : 'Estude https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction.md para melhorar a recuperação de conhecimento. Em src/learning.js, uma lição deve ser encontrada também quando o termo relevante aparece somente nos passos, no campo verification ou no campo limits. Implemente cobertura desses campos preservando filtro de palavras comuns, expiração, allowlist e orçamento. Crie teste novo de regressão sem alterar testes originais ou políticas. Evite a regressão conhecida: a consulta receita de bolo não deve recuperar uma lição apenas porque limits contém receita. Preserve a correspondência OR existente em topic/title/summary; para correspondência apenas nos campos adicionais, exija todos os termos relevantes da consulta. A melhoria será medida em casos reservados, com repetições idênticas na base e candidata. Seja direto: leia módulo/testes pertinentes, implemente e finalize.',
  emit: event => { if (['evolution_phase', 'model_completed', 'tool_completed'].includes(event.type)) console.log(JSON.stringify(event)); } });
console.log(JSON.stringify({ kind: 'live_self_improvement', root, remote, report: result.file, status: result.report.status,
  started: result.report.started, finished: result.report.finished, commit: result.report.commit, pushed: result.report.pushed,
  totals: result.report.totals, changed: result.report.changed, comparisons: result.report.comparisons,
  checks: result.report.checks.map(c => ({ phase: c.phase, argv: c.argv, passed: c.passed, isolation: c.isolation })), error: result.error || null }));
await mkdir(path.join(runtimeRoot, '.yzzy'), { recursive: true });
await writeFile(path.join(runtimeRoot, '.yzzy', 'self-improvement-smoke.json'), JSON.stringify(result.report, null, 2));
const patchFile = path.join(runtimeRoot, '.yzzy', 'self-improvement-smoke.patch');
if (result.report.status === 'published') {
  const patch = await git(root, ['diff', '--binary', result.report.base, result.report.commit, '--', 'src', 'tests', 'docs']);
  await writeFile(patchFile, patch + '\n');
} else {
  await unlink(patchFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
  assert.ok(currentBaseline && result.report.status === 'evaluation_saturated', result.error || result.report.status);
}
