#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { loadConfig, defaults } from '../src/config.js';
import { runAgent } from '../src/agent.js';
import { demo } from '../src/demo.js';
import { Journal, listSessions } from '../src/journal.js';
import { capture } from '../src/executor.js';
import { redact, invariant, hash, canonical } from '../src/util.js';
import { describeError } from '../src/errors.js';
import { codexExecutable, codexEnvironment, CodexRpc } from '../src/codex-rpc.js';
import { inferenceArgs } from '../src/codex-provider.js';
import { getAgent, listAgents, saveAgent, loadPreferences, setPreference } from '../src/profiles.js';
import { summarize } from '../src/memory.js';
import { Terminal } from '../src/terminal.js';
import { VERSION } from '../src/version.js';
import { planTeam, runTeam, loadTeam } from '../src/team.js';

const HELP = `YZZY BLACK ${VERSION} — seu agente no terminal
Uso: yzzy [comando] [opções]             Sem comando: abre o chat.
  chat                                 Conversa com o agente selecionado
  run "objetivo"                       Executa uma tarefa; --json emite eventos
  login [status]                       Login oficial do Codex; --device-auth opcional
  doctor                               Diagnóstico de backend, Node e Docker
  models                               Catálogo de modelos retornado pelo Codex
  agent list|show <nome>                Perfis disponíveis
  agent create|edit <nome> --instructions "texto" [--from reviewer] [--read-only]
  team plan "objetivo"                  Mostra especialistas sugeridos sem chamar modelo
  team run "objetivo"                   Consulta especialistas e coordena a implementação
  team inspect <id>                     Relatório de equipe; --specialists java,tester seleciona
  settings show                        Preferências de interação
  settings set <chave> <valor>          language, verbosity, tone, clarification, autoSummary
  sessions | history                   Lista conversas persistidas
  inspect <id> | summary <id>           Eventos ou resumo extrativo da conversa
  resume <id> ["orientação"]            Retoma a conversa; sem texto abre chat
  export <id> --output conversa.md      Exporta histórico redigido sem sobrescrever
  init | demo                          Inicialização de projeto ou demo offline
Opções: --workspace <dir> --config <json> --backend codex|openai|ollama --model <id>
        --agent <nome> --allow-write --allow-exec --allow-network --no-animation --json --help --version
Padrão: Codex como inferência; ferramentas e autorização pertencem à YZZY BLACK.
Chat: /help /new /agent /agents /settings /set /history /resume /summary /compact
      /team /model /status /permissions /clear /exit
Saídas: 0 término operacional; 2 erro; 3 limite; 4 pergunta; 5 falha/incerteza; 130 cancelamento.`;
const SLASH_HELP = `CONVERSA
  /new              Começar outra conversa
  /history          Ver conversas anteriores
  /resume <id>      Retomar uma conversa
  /summary          Resumir a conversa atual
  /compact          Reduzir contexto, preservando o histórico

PERSONALIZAR
  /agents           Conhecer os agentes
  /agent <nome>     Trocar de agente
  /settings         Ver preferências
  /set chave valor  Alterar uma preferência
  /model [id]       Consultar ou trocar o modelo
  /team <objetivo>  Consultar equipe e coordenar a tarefa em novas sessões

TERMINAL
  /status           Ver detalhes desta conversa
  /permissions      Consultar permissões
  /clear            Limpar a tela
  /exit             Sair

Tab completa comandos. Ctrl+C cancela a operação; em espera, sai.`;
const slashCommands = ['/help', '/new', '/history', '/resume', '/summary', '/compact', '/agents', '/agent', '/settings', '/set', '/model', '/team', '/status', '/permissions', '/clear', '/exit'];
const codeFor = r => ({ error: 2, limited: 3, waiting_user: 4, failed: 5, blocked_uncertain: 5, cancelled: 130 })[r.state.status] || 0;

async function main() {
  invariant(Number(process.versions.node.split('.')[0]) >= 24, 'Node.js 24+ obrigatório');
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    workspace: { type: 'string', default: process.cwd() }, config: { type: 'string' },
    backend: { type: 'string' }, model: { type: 'string' }, agent: { type: 'string', default: 'general' },
    instructions: { type: 'string' }, 'instructions-file': { type: 'string' }, description: { type: 'string' }, from: { type: 'string' },
    'read-only': { type: 'boolean', default: false }, output: { type: 'string' },
    'allow-write': { type: 'boolean', default: false }, 'allow-exec': { type: 'boolean', default: false },
    'allow-network': { type: 'boolean', default: false }, specialists: { type: 'string' },
    'device-auth': { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
    'no-animation': { type: 'boolean', default: false },
    version: { type: 'boolean', short: 'v' }, help: { type: 'boolean', short: 'h' }
  } });
  const screen = new Terminal(stdout);
  if (values['no-animation']) screen.animate = false;
  const print = item => values.json ? stdout.write(redact(JSON.stringify(item)) + '\n') : screen.present(item);
  if (values.version) { print(`YZZY BLACK ${VERSION}`); return; }
  if (values.help) { print(HELP); return; }
  const command = positionals[0] || 'chat';
  const emit = event => {
    if (values.json) return print(event);
    screen.event(event);
  };
  if (command === 'demo') {
    try { const r = await demo({ emit });
      if (values.json) print({ type: 'result', workspace: r.root, session: r.id, status: r.state.status, journal: r.file });
      else { screen.outcome(r); screen.note(`Pasta da demonstração: ${r.root}`); }
      process.exitCode = codeFor(r);
    } finally { screen.stop(); }
    return;
  }
  if (command === 'login') {
    const args = ['login', ...(positionals[1] === 'status' ? ['status'] : []), ...(values['device-auth'] ? ['--device-auth'] : [])];
    await new Promise((resolve, reject) => {
      codexExecutable().then(file => {
        const child = spawn(file, args, { env: codexEnvironment(), shell: false, windowsHide: true, stdio: 'inherit' });
        child.on('error', reject); child.on('exit', code => { process.exitCode = code ?? 2; resolve(); });
      }, reject);
    }); return;
  }
  const loaded = await loadConfig(values.workspace, values.config, { ...process.env,
    ...(values.backend ? { YZZY_PROVIDER: values.backend } : {}), ...(values.model ? { YZZY_MODEL: values.model } : {}) });
  const { root, config } = loaded;
  const permissions = { allowWrite: values['allow-write'], allowExec: values['allow-exec'], allowNetwork: values['allow-network'] };
  if (command === 'init') {
    const outcomes = [];
    for (const [file, content] of [['yzzy.config.json', JSON.stringify(defaults, null, 2) + '\n'], ['YZZY.md', '# Orientações para YZZY BLACK\n\nDescreva padrões, verificações e restrições deste projeto.\n']]) {
      try { await writeFile(path.join(root, file), content, { flag: 'wx', mode: 0o600 }); outcomes.push(`${file}: criado`); }
      catch (error) { if (error.code !== 'EEXIST') throw error; outcomes.push(`${file}: preservado`); }
    }
    print(outcomes); return;
  }
  if (command === 'doctor') {
    let docker, codex = { available: false, loggedIn: false };
    try { docker = await capture('docker', ['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 5000, maxBytes: 1500 }); } catch (e) { docker = { exitCode: null, output: e.code || e.message }; }
    try {
      const file = await codexExecutable();
      const version = await capture(file, ['--version'], { env: codexEnvironment(), timeoutMs: 5000 });
      const auth = await capture(file, ['login', 'status'], { env: codexEnvironment(), timeoutMs: 5000 });
      codex = { available: version.exitCode === 0, version: version.output.trim(), loggedIn: auth.exitCode === 0, auth: auth.output.trim() };
    } catch (e) { codex.error = e.message; }
    print({ product: 'YZZY BLACK', version: VERSION, node: process.version, workspace: root, backend: config.provider, model: config.model || 'padrão do Codex',
      codex, dockerReady: docker.exitCode === 0, dockerDiagnostic: docker.exitCode === 0 ? 'ok' : docker.output,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY), pricingConfigured: Boolean(config.pricing),
      guidance: 'Use yzzy login para autenticar o Codex. Docker é necessário somente para run_check.' }); return;
  }
  if (command === 'models') {
    const { mkdtemp } = await import('node:fs/promises'); const { tmpdir } = await import('node:os');
    const rpc = await CodexRpc.start(await mkdtemp(path.join(tmpdir(), 'yzzy-catalog-')), inferenceArgs);
    try { const result = await rpc.request('model/list', { limit: 100 }); print(result.data.map(m => ({ model: m.model, default: m.isDefault, description: m.description }))); }
    finally { rpc.close(); } return;
  }
  if (command === 'agent') {
    const action = positionals[1] || 'list', name = positionals[2];
    if (action === 'list') print(Object.values(await listAgents(root)));
    else if (action === 'show') print(await getAgent(root, name));
    else if (['create', 'edit'].includes(action)) {
      const base = action === 'edit' ? await getAgent(root, name) : values.from ? await getAgent(root, values.from) : await getAgent(root, 'general');
      const instructions = values.instructions || (values['instructions-file'] ? await readFile(values['instructions-file'], 'utf8') : action === 'edit' ? base.instructions : '');
      invariant(instructions, 'Informe --instructions "texto" ou --instructions-file caminho');
      print(await saveAgent(root, { name, description: values.description || base.description, instructions,
        readOnly: values['read-only'] || base.readOnly }));
    } else throw new Error('Use agent list, show, create ou edit'); return;
  }
  const changePreference = async (key, value) => setPreference(root, key, key === 'autoSummary' ? JSON.parse(value) : value);
  if (command === 'settings') {
    if (positionals[1] === 'set') print(await changePreference(positionals[2], positionals.slice(3).join(' ')));
    else print(await loadPreferences(root)); return;
  }
  if (['sessions', 'history'].includes(command)) { print(await listSessions(root)); return; }
  if (['inspect', 'summary', 'export'].includes(command)) {
    const journal = await Journal.load(root, positionals[1]);
    if (command === 'summary') print(summarize(journal.state));
    else if (command === 'inspect') print({ id: journal.id, file: journal.file, status: journal.state?.status, agent: journal.state?.agent,
      objective: journal.state?.objective, calls: journal.state?.modelCalls, tools: journal.state?.toolCalls, billing: journal.state?.billing,
      pending: journal.state?.pendingTool, uncertainEffect: journal.state?.uncertainEffect,
      events: journal.events.map(e => ({ seq: e.seq, type: e.type, time: e.time, data: e.data })) });
    else {
      invariant(values.output, 'Informe --output conversa.md');
      const transcript = journal.state.messages.filter(m => ['user', 'assistant'].includes(m.role) && m.text).map(m => `## ${m.role === 'user' ? 'Você' : 'YZZY BLACK'}\n\n${m.text}`).join('\n\n');
      await writeFile(values.output, redact(`# YZZY BLACK — ${journal.id}\n\n${transcript}\n`), { flag: 'wx', mode: 0o600 }); print({ exported: path.resolve(values.output) });
    }
    return;
  }
  let activeAbort, closing = new AbortController();
  const cancel = () => { if (activeAbort) activeAbort.abort(new Error('Cancelado pelo usuário')); else closing.abort(); };
  process.on('SIGINT', cancel);
  let profile = await getAgent(root, values.agent), preferences = await loadPreferences(root), compact = false;
  const executeTeam = async objective => {
    activeAbort = new AbortController();
    try {
      const result = await runTeam({ ...loaded, objective, specialists: values.specialists, permissions, preferences, agentProfile: profile,
        signal: activeAbort.signal, emit });
      if (values.json) print({ type: 'team_result', team: result.id, status: result.state.status, report: result.file, error: result.error || null });
      else { screen.outcome(result); screen.note(`Relatório: yzzy team inspect ${result.id}`); }
      return result;
    } finally { activeAbort = undefined; screen.stop(); }
  };
  const execute = async (objective, id) => {
    activeAbort = new AbortController();
    try {
      let selected = profile, prefs = preferences;
      if (id) { const state = (await Journal.load(root, id)).state; selected = state.profileSnapshot || selected; prefs = state.preferencesSnapshot || prefs; }
      return await runAgent({ ...loaded, fingerprint: hash(canonical(config)), objective, resumeId: id, permissions,
        agentProfile: selected, preferences: prefs, forceCompact: compact, signal: activeAbort.signal, emit });
    } finally { activeAbort = undefined; compact = false; }
  };
  try {
    if (command === 'team') {
      const action = positionals[1];
      if (action === 'inspect') print(await loadTeam(root, positionals[2]));
      else if (action === 'plan') {
        const plan = planTeam(positionals.slice(2).join(' '), values.specialists);
        for (const name of plan.specialists) await getAgent(root, name);
        print(plan);
      } else { invariant(action === 'run', 'Use team plan, run ou inspect'); process.exitCode = codeFor(await executeTeam(positionals.slice(2).join(' '))); }
      return;
    }
    if (command === 'run' || command === 'resume' && positionals.length > 2) {
      const r = command === 'run' ? await execute(positionals.slice(1).join(' ')) : await execute(positionals.slice(2).join(' '), positionals[1]);
      if (values.json) print({ type: 'result', session: r.id, status: r.state.status, journal: r.file, error: r.error || null });
      else screen.outcome(r);
      process.exitCode = codeFor(r); return;
    }
    invariant(['chat', 'resume'].includes(command), `Comando desconhecido: ${command}. Use yzzy --help.`);
    invariant(stdin.isTTY && !values.json, 'Chat exige terminal interativo. Para automação use yzzy run "objetivo" --json.');
    const rl = createInterface({ input: stdin, output: stdout, historySize: 200, removeHistoryDuplicates: true,
      completer: line => { const hits = slashCommands.filter(command => command.startsWith(line)); return [hits, line]; } });
    let id = command === 'resume' ? positionals[1] : undefined;
    rl.on('SIGINT', cancel);
    rl.on('close', () => closing.abort());
    const banner = () => {
      const options = { root, provider: config.provider, model: config.model, profile, permissions };
      if (screen.live) { screen.live.clear(); screen.details(options); }
      else { console.clear(); screen.banner(options); }
    };
    const earlyLines = [];
    rl.on('line', line => earlyLines.push(line));
    try {
      await screen.opening({ root, provider: config.provider, model: config.model, profile, permissions }, { signal: closing.signal, input: rl });
      const selectSession = async sessionId => {
        const journal = await Journal.load(root, sessionId);
        profile = journal.state.profileSnapshot || profile; preferences = journal.state.preferencesSnapshot || preferences;
        id = journal.id; screen.summary(summarize(journal.state));
      };
      if (id) await selectSession(id);
      while (!closing.signal.aborted) {
        let line;
        screen.inputActive = true;
        try { line = (earlyLines.length ? earlyLines.shift() : await rl.question(screen.prompt(), { signal: closing.signal })).trim(); }
        finally { screen.inputActive = false; }
        if (!line) continue;
        screen.recordUser(line);
        if (line.startsWith('/')) {
          const [slash, ...args] = line.split(/\s+/); const rest = args.join(' ');
          try {
            if (slash === '/exit') break;
            else if (slash === '/help') print(SLASH_HELP);
            else if (slash === '/new') { id = undefined; print('Nova sessão.'); }
            else if (slash === '/agents') print(Object.values(await listAgents(root)));
            else if (slash === '/agent') { profile = await getAgent(root, args[0]); id = undefined; print(`Agente ${profile.name}; nova sessão.`); }
            else if (slash === '/settings') print(preferences);
            else if (slash === '/set') { preferences = await changePreference(args[0], args.slice(1).join(' ')); id = undefined; print(preferences); }
            else if (slash === '/history') print(await listSessions(root));
            else if (slash === '/resume') { invariant(rest, 'Informe o ID'); await selectSession(rest); }
            else if (slash === '/summary') { invariant(rest || id, 'Nenhuma sessão selecionada'); print(summarize((await Journal.load(root, rest || id)).state)); }
            else if (slash === '/compact') { compact = true; print('A próxima resposta usará contexto resumido a partir de oito mensagens. Histórico preservado.'); }
            else if (slash === '/model') { if (rest) { config.model = rest; id = undefined; } print({ model: config.model || 'padrão do Codex' }); }
            else if (slash === '/team') { await executeTeam(rest); id = undefined; }
            else if (slash === '/status') {
              const saved = id ? await Journal.load(root, id) : null;
              print({ session: id || null, status: saved?.state.status, agent: profile.name, backend: config.provider,
                model: config.model || 'automático', workspace: root });
            }
            else if (slash === '/permissions') print({ ...permissions, profileReadOnly: profile.readOnly, writeRoots: config.writeRoots });
            else if (slash === '/clear') banner();
            else print('Comando desconhecido. Use /help.');
          } catch (error) { screen.failure(error); }
          screen.line();
          continue;
        }
        try { const r = await execute(line, id); id = r.id; screen.outcome(r); }
        catch (error) { screen.failure(error); }
        finally { screen.stop(); }
      }
    } catch (error) {
      if (!closing.signal.aborted) { screen.close(); screen.failure(error); process.exitCode = 2; }
    } finally { screen.close(); rl.close(); if (process.exitCode !== 2) screen.note('Até a próxima.'); }
  } catch (error) { if (!closing.signal.aborted) throw error; }
  finally { screen.close(); process.removeListener('SIGINT', cancel); }
}
main().catch(error => {
  const details = describeError(error, { operation: 'initialization' });
  const screen = new Terminal(process.stderr); screen.failure(details.error);
  if (details.recovery) screen.note(details.recovery.message);
  process.exitCode = error.name === 'AbortError' ? 130 : 2;
});
