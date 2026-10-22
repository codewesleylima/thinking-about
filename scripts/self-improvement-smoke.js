import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createReplica } from '../src/replication.js';
import { runSelfImprovement, evolutionProcess, runtimeRoot } from '../src/self-improvement.js';
import { loadConfig } from '../src/config.js';

const parent = await mkdtemp(path.join(tmpdir(), 'yzzy-live-evolution-')), root = path.join(parent, 'runtime'), remote = path.join(parent, 'origin.git');
await createReplica({ directory: root, name: 'evolution-fixture', command: 'fixtureai' });
async function git(cwd, args) {
  const r = await evolutionProcess('git', args, { cwd }); assert.equal(r.exitCode, 0, r.stderr); return r.stdout.trim();
}
await git(root, ['init', '--initial-branch=main']);
await git(root, ['config', 'user.name', 'YZZY live fixture']); await git(root, ['config', 'user.email', 'fixture@example.invalid']);
await git(root, ['add', '.']); await git(root, ['commit', '-m', 'baseline for live evolution']);
await git(parent, ['init', '--bare', remote]); await git(root, ['remote', 'add', 'origin', remote]); await git(root, ['push', '-u', 'origin', 'main']);
const loaded = await loadConfig(root, undefined, { YZZY_PROVIDER: 'codex' });
const result = await runSelfImprovement({ ...loaded,
  topic: 'Estude https://developers.openai.com/cookbook/examples/agents_sdk/building_reliable_agents_memory_compaction.md para melhorar confiabilidade da recuperação de memória. No módulo src/learning.js as palavras de parada são comparadas a tokens sem acentos, mas a lista contém faça com acento: corrija a inconsistência para evitar recuperação de lições por esse termo genérico. Escolha uma correção mínima nesse módulo e crie teste novo que demonstre o problema. Não mude demais políticas, limites ou arquivos originais de testes.',
  emit: event => { if (['evolution_phase', 'model_completed', 'tool_completed'].includes(event.type)) console.log(JSON.stringify(event)); } });
console.log(JSON.stringify({ kind: 'live_self_improvement', root, remote, report: result.file, status: result.report.status,
  started: result.report.started, finished: result.report.finished, commit: result.report.commit, pushed: result.report.pushed,
  totals: result.report.totals, changed: result.report.changed, checks: result.report.checks.map(c => ({ phase: c.phase, argv: c.argv, passed: c.passed })), error: result.error || null }));
assert.equal(result.report.status, 'published', result.error);
const patch = await git(root, ['diff', '--binary', result.report.base, result.report.commit, '--', 'src', 'tests', 'docs']);
await mkdir(path.join(runtimeRoot, '.yzzy'), { recursive: true });
await writeFile(path.join(runtimeRoot, '.yzzy', 'self-improvement-smoke.patch'), patch + '\n');
await writeFile(path.join(runtimeRoot, '.yzzy', 'self-improvement-smoke.json'), JSON.stringify(result.report, null, 2));
