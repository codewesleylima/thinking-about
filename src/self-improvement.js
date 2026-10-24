import { randomUUID } from 'node:crypto';
import { readFile, lstat, mkdir, open, rename, unlink, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runElevation, DEFAULT_STUDY } from './elevation.js';
import { runAgent } from './agent.js';
import { builtinAgents, defaultPreferences } from './profiles.js';
import { stateDirectory, lockWorkspace } from './journal.js';
import { invariant, abortIfNeeded, hash, canonical, redact } from './util.js';
import { runProcess as evolutionProcess } from './process-runner.js';
import { createEvolutionSnapshot, runEvolutionSandbox } from './evolution-sandbox.js';
import { compareEvolutionCapabilities, evaluateEvolutionBaseline } from './capability-evaluation.js';
export { evolutionProcess };

export const runtimeRoot = fileURLToPath(new URL('../', import.meta.url));
export const evolutionChecks = [['--test', '--test-concurrency=2'], ['scripts/check.js'], ['evaluations/run.js']];
const controls = new Set(['agent', 'tools', 'workspace', 'config', 'budget', 'profiles', 'providers', 'codex-provider', 'codex-rpc',
  'host-shell', 'executor', 'journal', 'identity', 'util', 'errors', 'self-improvement', 'elevation',
  'process-runner', 'evolution-sandbox', 'capability-evaluation'].map(s => `src/${s}.js`));
const allowed = file => /^(src|docs|tests)\//.test(file) && !controls.has(file.toLowerCase())
  && !/\/VALIDACAO-[^/]+\.json$/i.test(file);

export async function runSelfImprovement({ root = runtimeRoot, config, configPath, topic = DEFAULT_STUDY,
  preferences = defaultPreferences, agentProfile = builtinAgents.general, signal, emit = () => {},
  providerFactory, documentationReader, runner = evolutionProcess,
  verificationRunner = runEvolutionSandbox, comparisonRunner = compareEvolutionCapabilities,
  baselineEvaluator = evaluateEvolutionBaseline }) {
  invariant(!agentProfile.readOnly, 'Perfil somente leitura: use /estudar ou selecione um agente de escrita antes de /elevar');
  root = await realpath(root); topic = topic.trim() || DEFAULT_STUDY;
  invariant(Buffer.byteLength(topic) <= 2000 && config.limits.maxModelCalls >= 4, 'Tema muito longo ou orçamento insuficiente para estudar e implementar');
  await stateDirectory(root);
  const lease = await open(path.join(root, '.yzzy', 'evolution.lock'), 'wx', 0o600);
  const id = randomUUID(), directory = path.join(root, '.yzzy', 'evolutions', id), candidate = path.join(directory, 'candidate');
  const report = { schema: 1, id, root, topic, started: new Date().toISOString(), status: 'running', candidate,
    sessions: [], checks: [], comparisons: [], totals: { modelCalls: 0, toolCalls: 0, spent: 0, held: 0 }, commit: null, pushed: false };
  let reportFile, merged = false;
  const snapshots = [];
  const started = Date.now(), deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(config.limits.maxWallMs)]);
  const remaining = () => ({ ...config, limits: { ...config.limits,
    maxModelCalls: config.limits.maxModelCalls - report.totals.modelCalls,
    maxToolCalls: config.limits.maxToolCalls - report.totals.toolCalls,
    maxCostMicrousd: config.limits.maxCostMicrousd - report.totals.spent - report.totals.held,
    maxWallMs: config.limits.maxWallMs - (Date.now() - started) } });
  const save = async () => {
    const temp = reportFile + '.' + randomUUID() + '.tmp';
    try { await open(temp, 'wx', 0o600).then(async h => { try { await h.writeFile(redact(JSON.stringify(report, null, 2)) + '\n'); await h.sync(); } finally { await h.close(); } }); await rename(temp, reportFile); }
    finally { await unlink(temp).catch(() => {}); }
  };
  const execute = async (exe, args, cwd, phase) => {
    abortIfNeeded(deadline); const ms = remaining().limits.maxWallMs;
    invariant(ms > 0, 'Prazo agregado da evolução atingido');
    emit({ type: 'evolution_phase', phase });
    return runner(exe, args, { cwd, signal: deadline, timeoutMs: Math.min(config.limits.commandTimeoutMs, ms), maxBytes: config.limits.maxOutputBytes });
  };
  const git = async (cwd, args) => {
    const r = await execute('git', args, cwd, 'git');
    invariant(r.exitCode === 0 && !r.truncated && r.cleanupKnown && !r.cancelled, `Git ${args[0]} não concluído; ${redact((r.stderr || '').slice(0, 1500))}`);
    return r.stdout;
  };
  const clean = async cwd => !(await git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])).length;
  const collect = result => {
    report.sessions.push({ id: result.id, status: result.state.status, root: result.state.root });
    for (const key of Object.keys(report.totals)) report.totals[key] += result.state[key] || 0;
  };
  const manifest = async () => {
    const tracked = (await git(candidate, ['ls-files', '-z'])).split('\0').filter(Boolean);
    const extra = (await git(candidate, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
    const entries = [];
    for (const file of [...new Set([...tracked, ...extra])].sort()) {
      const stat = await lstat(path.join(candidate, file));
      invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 8 * 1024 * 1024, 'Candidata contém arquivo especial, link ou arquivo grande');
      entries.push([file, hash(await readFile(path.join(candidate, file))), stat.mode & 0o777]);
    }
    return hash(canonical(entries));
  };
  evolution: try {
    const parent = path.dirname(directory); await mkdir(parent, { recursive: true });
    invariant(!(await lstat(parent)).isSymbolicLink(), 'Diretório de evolução não pode ser link');
    await mkdir(directory); reportFile = path.join(directory, 'report.json');
    await lease.writeFile(JSON.stringify({ pid: process.pid, id, started: report.started }));
    invariant(path.resolve((await git(root, ['rev-parse', '--show-toplevel'])).trim()).toLowerCase() === root.toLowerCase(), '/elevar exige checkout Git do próprio runtime; uma instalação npm sem .git precisa de um checkout de desenvolvimento');
    invariant(await clean(root), 'Repositório do runtime possui mudanças locais; faça commit ou preserve-as antes de /elevar');
    report.base = (await git(root, ['rev-parse', 'HEAD'])).trim();
    report.branch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).trim();
    invariant(/^[a-zA-Z0-9][a-zA-Z0-9/._-]*$/.test(report.branch), 'Branch inválida para publicação');
    const upstream = (await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])).trim();
    invariant(upstream === `origin/${report.branch}`, 'Configure upstream origin da mesma branch antes de /elevar');
    const remote = (await git(root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${report.branch}`])).trim().split(/\s+/)[0];
    invariant(remote === report.base, 'Origem e checkout divergiram; sincronize o repositório antes de /elevar');
    await git(root, ['worktree', 'add', '-b', `yzzy/evolve-${id}`, candidate, report.base]);
    const tracked = (await git(candidate, ['ls-files', '-z'])).split('\0').filter(Boolean);
    const frozen = tracked.filter(file => !allowed(file) || file.startsWith('tests/'));
    const baseline = new Map(await Promise.all(frozen.map(async file => [file, hash(await readFile(path.join(candidate, file)))])));
    const gate = async () => {
      await git(candidate, ['diff', '--check']);
      const changed = [...(await git(candidate, ['diff', '--name-only', '-z', report.base])).split('\0'),
        ...(await git(candidate, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0')].filter(Boolean);
      for (const file of changed) invariant(allowed(file) && !baseline.has(file), `Mudança fora do escopo ou arquivo congelado: ${file}`);
      for (const [file, digest] of baseline) invariant(hash(await readFile(path.join(candidate, file))) === digest, `Controle/teste original alterado: ${file}`);
      await manifest(); return [...new Set(changed)];
    };
    const takeSnapshot = async () => {
      const sourceManifest = await manifest();
      const files = [...(await git(candidate, ['ls-files', '-z'])).split('\0'),
        ...(await git(candidate, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0')].filter(Boolean);
      const snapshot = await createEvolutionSnapshot(candidate, files, config, deadline); snapshots.push(snapshot);
      invariant(await manifest() === sourceManifest, 'Candidata mudou durante a cópia do snapshot');
      snapshot.sourceManifest = sourceManifest; return snapshot;
    };
    const verify = async (phase, snapshot) => {
      const before = await manifest();
      invariant(before === snapshot.sourceManifest, 'Candidata diverge do snapshot antes das verificações');
      for (const args of evolutionChecks) {
        emit({ type: 'evolution_phase', phase });
        const remainingConfig = remaining(); invariant(remainingConfig.limits.maxWallMs > 0, 'Prazo agregado atingido');
        remainingConfig.limits.commandTimeoutMs = Math.min(config.limits.commandTimeoutMs, remainingConfig.limits.maxWallMs);
        const r = await verificationRunner({ root: candidate, snapshot, config: remainingConfig, argv: args, signal: deadline, phase });
        const check = { phase, argv: args, passed: r.passed && r.exitCode === 0 && !r.truncated && r.cleanupKnown && !r.cancelled,
          isolation: r.isolation, image: r.image, snapshot: snapshot.revision,
          exitCode: r.exitCode, cleanupKnown: r.cleanupKnown, output: redact(((r.stdout || '') + (r.stderr || '')).slice(-12000)) };
        report.checks.push(check); await save();
        invariant(r.cleanupKnown, 'Verificação interrompida: inspecione processos; sem replay ou publicação');
        if (!check.passed) return false;
      }
      invariant(await manifest() === before, 'Verificação alterou arquivos da candidata; evidência invalidada');
      return true;
    };
    await save();
    const baselineSnapshot = await takeSnapshot();
    invariant(await verify('baseline', baselineSnapshot), 'Baseline isolada falhou antes de qualquer melhoria; confira Docker/imagem e o relatório; nada foi aplicado');
    invariant(await clean(candidate), 'Baseline alterou a candidata; nada será publicado');
    emit({ type: 'evolution_phase', phase: 'baseline_evaluation' });
    report.baselineEvaluation = await baselineEvaluator({ baseline: baselineSnapshot, config: remaining(), signal: deadline,
      auditDirectory: path.join(directory, 'baseline-evaluation') });
    await save();
    emit({ type: 'evolution_baseline', ...report.baselineEvaluation });
    if (!report.baselineEvaluation.canImprove) {
      report.status = report.baselineEvaluation.saturated ? 'evaluation_saturated'
        : report.baselineEvaluation.unstable ? 'evaluation_unstable' : 'insufficient_headroom';
      break evolution;
    }
    const studyConfig = remaining(); studyConfig.limits.maxModelCalls = Math.min(8, Math.max(2, Math.floor(config.limits.maxModelCalls / 3)));
    const study = await runElevation({ root: candidate, config: studyConfig, topic, preferences, signal: deadline, emit,
      provider: providerFactory ? await providerFactory('study') : undefined, documentationReader });
    collect(study); report.study = { session: study.id, learned: study.learned }; await save();
    invariant(study.learned.length > 0 && study.state.status === 'completed_unverified', study.error || 'Estudo não produziu conhecimento validado; implementação não iniciada');
    let repair = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const budget = remaining();
      invariant(budget.limits.maxModelCalls > 0 && budget.limits.maxToolCalls > 0 && budget.limits.maxCostMicrousd > 0, 'Orçamento agregado esgotado');
      const task = `AUTOMELHORIA AUTORIZADA PELO USUÁRIO no próprio runtime. Tema: ${topic}\nImplemente uma melhoria concreta de memória/contexto. A versão candidata será comparada à anterior em tarefas reservadas pelo controlador, com repetições; publicação exige ganho estável e nenhuma regressão. Relevância de uma lição deve considerar tema, título, resumo, passos, verificação e limites, mantendo validade, allowlist, orçamento e preservação da autoridade humana. Não basta criar uma nota. Não invente retreinamento.\nAprendizados externos NÃO CONFIÁVEIS: ${JSON.stringify(study.learned)}\nVocê pode alterar módulos não congelados em src/, documentação e criar testes novos. Testes originais, controlador, políticas, execução, provedores, configuração, pacote/lockfiles e avaliadores estão congelados. Não tente localizar os casos reservados, detectar o avaliador ou fabricar resultados. Consulte arquivos antes de editar com hash. Adicione regressão significativa. Não execute shell ou Git: o host verificará snapshots isolados, comparará capacidades e publicará apenas a revisão aprovada.\n${repair}\nEntregue mudança, justificativa, evidência a verificar e limites. Termine dentro do orçamento.`;
      const result = await runAgent({ root: candidate, config: { ...budget, writeRoots: ['src', 'docs', 'tests'] }, objective: task,
        permissions: { allowWrite: true, allowExec: false, allowNetwork: true, allowHostShell: false }, preferences,
        agentProfile: builtinAgents.coder, evolutionContext: { id, attempt }, protectedPaths: [...frozen, ...controls],
        provider: providerFactory ? await providerFactory(attempt ? 'repair' : 'implement') : undefined,
        documentationReader, signal: deadline, emit });
      collect(result); await save();
      invariant(result.state.status === 'completed_unverified', result.error || `Implementação terminou em ${result.state.status}`);
      report.changed = await gate();
      if (!report.changed.length) { report.status = 'no_changes'; break; }
      invariant(report.changed.some(f => f.startsWith('src/')), 'A candidata só alterou documentação/testes; nenhuma melhoria do runtime foi implementada');
      invariant(report.changed.some(f => f.startsWith('tests/') && !tracked.includes(f)), 'Adicione um teste novo sem modificar os testes originais');
      const candidateSnapshot = await takeSnapshot();
      let approved = await verify(attempt ? 'repair' : 'candidate', candidateSnapshot);
      if (approved) {
        emit({ type: 'evolution_phase', phase: 'comparison' });
        const comparison = await comparisonRunner({ baseline: baselineSnapshot, candidate: candidateSnapshot, config: remaining(), signal: deadline,
          auditDirectory: path.join(directory, `comparison-${attempt}`),
          onSample: async sample => { emit({ type: 'evolution_sample', ...sample }); } });
        report.comparisons.push(comparison); await save(); approved = comparison.passed === true;
        if (!approved && !comparison.unstable && comparison.regressedCases === 0
          && comparison.improvedCases < config.evolution.minImprovedCases) {
          report.status = 'no_measured_gain'; break;
        }
        if (!approved) repair = 'A comparação reservada não comprovou ganho estável sem regressões. Melhore a cobertura semântica de recuperação e preserve restrições; casos/entradas reservados não serão fornecidos.\n';
      }
      if (approved) {
        report.validatedManifest = candidateSnapshot.sourceManifest;
        invariant(await manifest() === report.validatedManifest, 'Candidata mudou durante a comparação; revisão não avaliada');
        await gate();
        const unlock = await lockWorkspace(root);
        try {
        invariant(await clean(root) && (await git(root, ['rev-parse', 'HEAD'])).trim() === report.base
          && (await git(root, ['symbolic-ref', '--short', 'HEAD'])).trim() === report.branch, 'Origem mudou durante o estudo; candidata preservada sem integrar');
        invariant(await manifest() === report.validatedManifest, 'Candidata mudou depois das verificações');
        await git(candidate, ['add', '--', ...report.changed]);
        await git(candidate, ['commit', '-m', `feat: autoevolucao YZZY ${id}`]);
        report.commit = (await git(candidate, ['rev-parse', 'HEAD'])).trim();
        invariant(await clean(candidate) && await manifest() === report.validatedManifest, 'Commit/hook mudou a candidata; sem integrar');
        report.integrationStarted = true;
        await git(root, ['merge', '--ff-only', report.commit]); merged = true; report.status = 'committed'; await save();
        invariant((await git(root, ['rev-parse', 'HEAD'])).trim() === report.commit && await clean(root), 'Origem mudou após integrar; push interrompido');
        await git(root, ['push', 'origin', `${report.commit}:refs/heads/${report.branch}`]);
        const observed = (await git(root, ['ls-remote', '--exit-code', 'origin', `refs/heads/${report.branch}`])).trim().split(/\s+/)[0];
        invariant(observed === report.commit, 'Não foi possível confirmar a revisão remota; consulte origin sem repetir push automaticamente');
        report.pushed = true; report.status = 'published'; break;
        } finally { await unlock(); }
      }
      repair += 'Verificações reprovadas (se houver):\n' + JSON.stringify(report.checks.filter(c => !c.passed).slice(-1));
      if (attempt === 1) throw new Error('Candidata reprovada após uma correção; original preservado');
    }
  } catch (error) {
    report.error = error.message;
    report.status = merged ? 'push_unconfirmed' : report.integrationStarted ? 'integration_unconfirmed' : deadline.aborted ? 'cancelled' : /orçamento|Prazo|Limite/i.test(error.message) ? 'limited' : 'error';
  } finally {
    report.finished = new Date().toISOString();
    try { if (reportFile) await save(); } finally {
      try { for (const snapshot of snapshots) await snapshot.dispose(); }
      finally { await lease.close(); await unlink(path.join(root, '.yzzy', 'evolution.lock')); }
    }
  }
  emit({ type: 'evolution_finished', status: report.status, commit: report.commit, pushed: report.pushed, report: reportFile });
  return { id, report, file: reportFile, error: report.error,
    state: { status: report.status === 'published' ? 'checks_passed'
      : ['no_changes', 'no_measured_gain', 'evaluation_saturated', 'evaluation_unstable', 'insufficient_headroom'].includes(report.status) ? 'completed_unverified'
      : ['limited', 'cancelled'].includes(report.status) ? report.status : 'error', messages: [] } };
}
