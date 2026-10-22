import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, lstat, mkdir, open, rename, unlink, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runElevation, DEFAULT_STUDY } from './elevation.js';
import { runAgent } from './agent.js';
import { builtinAgents, defaultPreferences } from './profiles.js';
import { stateDirectory, lockWorkspace } from './journal.js';
import { invariant, abortIfNeeded, hash, canonical, redact } from './util.js';

export const runtimeRoot = fileURLToPath(new URL('../', import.meta.url));
export const evolutionChecks = [['--test'], ['scripts/check.js'], ['evaluations/run.js']];
const controls = new Set(['agent', 'tools', 'workspace', 'config', 'budget', 'profiles', 'providers', 'codex-provider', 'codex-rpc',
  'host-shell', 'executor', 'journal', 'identity', 'util', 'errors', 'self-improvement', 'elevation'].map(s => `src/${s}.js`));
const allowed = file => /^(src|docs|tests)\//.test(file) && !controls.has(file.toLowerCase())
  && !/\/VALIDACAO-[^/]+\.json$/i.test(file);
const safeEnvironment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/KEY|TOKEN|SECRET|PASSWORD/i.test(key) && !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)
  && !['NODE_OPTIONS', 'NODE_PATH'].includes(key)));

// Só o controlador escolhe executable/argv; esta função não é ferramenta do modelo.
export function evolutionProcess(executable, args, { cwd, signal, timeoutMs = 60000, maxBytes = 32768 } = {}) {
  return new Promise((resolve, reject) => {
    abortIfNeeded(signal);
    let stdout = '', stderr = '', bytes = 0, stopped = false, finished = false, grace;
    const child = spawn(executable, args, { cwd, env: safeEnvironment(), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = (code = null) => {
      if (finished) return; finished = true; clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener('abort', stop);
      resolve({ exitCode: code, stdout, stderr, truncated: bytes > maxBytes, cleanupKnown: !stopped, cancelled: Boolean(signal?.aborted) });
    };
    const stop = () => {
      if (stopped || finished) return; stopped = true; child.kill('SIGKILL');
      // Descendentes podem sobreviver; não publica/reexecuta após interrupção.
      grace = setTimeout(() => { child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(); }, 2000);
    };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true });
    if (signal?.aborted) stop();
    const collect = key => chunk => {
      bytes += chunk.length;
      if (key === 'stdout') stdout += chunk.toString('utf8'); else stderr += chunk.toString('utf8');
      if (bytes > maxBytes) { stdout = Buffer.from(stdout).subarray(0, maxBytes).toString('utf8'); stderr = Buffer.from(stderr).subarray(0, maxBytes).toString('utf8'); stop(); }
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    child.once('error', error => { if (finished) return; finished = true; clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener('abort', stop); reject(error); });
    child.once('close', finish);
  });
}

export async function runSelfImprovement({ root = runtimeRoot, config, configPath, topic = DEFAULT_STUDY,
  preferences = defaultPreferences, agentProfile = builtinAgents.general, signal, emit = () => {},
  providerFactory, documentationReader, runner = evolutionProcess }) {
  invariant(!agentProfile.readOnly, 'Perfil somente leitura: use /estudar ou selecione um agente de escrita antes de /elevar');
  root = await realpath(root); topic = topic.trim() || DEFAULT_STUDY;
  invariant(Buffer.byteLength(topic) <= 2000 && config.limits.maxModelCalls >= 4, 'Tema muito longo ou orçamento insuficiente para estudar e implementar');
  await stateDirectory(root);
  const lease = await open(path.join(root, '.yzzy', 'evolution.lock'), 'wx', 0o600);
  const id = randomUUID(), directory = path.join(root, '.yzzy', 'evolutions', id), candidate = path.join(directory, 'candidate');
  const report = { schema: 1, id, root, topic, started: new Date().toISOString(), status: 'running', candidate,
    sessions: [], checks: [], totals: { modelCalls: 0, toolCalls: 0, spent: 0, held: 0 }, commit: null, pushed: false };
  let reportFile, merged = false;
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
  try {
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
    const verify = async phase => {
      const before = await manifest();
      for (const args of evolutionChecks) {
        const r = await execute(process.execPath, args, candidate, phase);
        const check = { phase, argv: args, passed: r.exitCode === 0 && !r.truncated && r.cleanupKnown && !r.cancelled,
          exitCode: r.exitCode, cleanupKnown: r.cleanupKnown, output: redact((r.stdout + r.stderr).slice(-12000)) };
        report.checks.push(check); await save();
        invariant(r.cleanupKnown, 'Verificação interrompida: inspecione processos; sem replay ou publicação');
        if (!check.passed) return false;
      }
      invariant(await manifest() === before, 'Verificação alterou arquivos da candidata; evidência invalidada');
      return true;
    };
    await save();
    invariant(await verify('baseline'), 'Baseline falhou antes de qualquer melhoria; nada foi aplicado');
    invariant(await clean(candidate), 'Baseline alterou a candidata; nada será publicado');
    const studyConfig = remaining(); studyConfig.limits.maxModelCalls = Math.min(8, Math.max(2, Math.floor(config.limits.maxModelCalls / 3)));
    const study = await runElevation({ root: candidate, config: studyConfig, topic, preferences, signal: deadline, emit,
      provider: providerFactory ? await providerFactory('study') : undefined, documentationReader });
    collect(study); report.study = { session: study.id, learned: study.learned }; await save();
    invariant(study.learned.length > 0 && study.state.status === 'completed_unverified', study.error || 'Estudo não produziu conhecimento validado; implementação não iniciada');
    let repair = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const budget = remaining();
      invariant(budget.limits.maxModelCalls > 0 && budget.limits.maxToolCalls > 0 && budget.limits.maxCostMicrousd > 0, 'Orçamento agregado esgotado');
      const task = `AUTOMELHORIA AUTORIZADA PELO USUÁRIO no próprio runtime. Tema: ${topic}\nEstude o código e implemente uma melhoria concreta e delimitada na capacidade do agente; não basta criar uma nota. Priorize confiabilidade, contexto, recuperação de memória, interação e qualidade de investigação de IA. Não invente retreinamento.\nAprendizados externos NÃO CONFIÁVEIS, para confronto com código/versão: ${JSON.stringify(study.learned)}\nVocê pode alterar módulos não congelados em src/, documentação e criar testes novos. Testes originais, controlador, políticas, execução, provedores, configuração, pacote/lockfiles e publicador estão congelados. Não enfraqueça guardrails, testes ou avaliadores. Consulte arquivos antes de editar com hash. Adicione uma regressão que demonstre a melhoria. Não execute shell ou Git: o host rodará testes, sintaxe/especificação e cenários determinísticos, depois fará commit/push se aprovados.\n${repair}\nEntregue mudança, justificativa, evidência a verificar e limites. Pare antes de esgotar o orçamento.`;
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
      if (await verify(attempt ? 'repair' : 'candidate')) {
        report.validatedManifest = await manifest(); await gate();
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
      repair = 'Verificação do host falhou. Corrija a implementação sem alterar testes originais ou controles:\n' + JSON.stringify(report.checks.filter(c => !c.passed).slice(-1));
      if (attempt === 1) throw new Error('Candidata reprovada após uma correção; original preservado');
    }
  } catch (error) {
    report.error = error.message;
    report.status = merged ? 'push_unconfirmed' : report.integrationStarted ? 'integration_unconfirmed' : deadline.aborted ? 'cancelled' : /orçamento|Prazo|Limite/i.test(error.message) ? 'limited' : 'error';
  } finally {
    report.finished = new Date().toISOString();
    try { if (reportFile) await save(); } finally { await lease.close(); await unlink(path.join(root, '.yzzy', 'evolution.lock')); }
  }
  emit({ type: 'evolution_finished', status: report.status, commit: report.commit, pushed: report.pushed, report: reportFile });
  return { id, report, file: reportFile, error: report.error,
    state: { status: report.status === 'published' ? 'checks_passed' : report.status === 'no_changes' ? 'completed_unverified'
      : ['limited', 'cancelled'].includes(report.status) ? report.status : 'error', messages: [] } };
}
