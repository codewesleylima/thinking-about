#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { loadConfig, defaults } from '../src/config.js';
import { runAgent } from '../src/agent.js';
import { demo } from '../src/demo.js';
import { Journal, listSessions } from '../src/journal.js';
import { capture } from '../src/executor.js';
import { clean, redact, invariant } from '../src/util.js';

const HELP = `WZZY AI 0.1.0 — agente de programação
Uso: node bin/wzzy.js <comando> [objetivo] [opções]
  init                 Cria configuração e WZZY.md sem sobrescrever
  doctor               Verifica Node, Docker e configuração (sem inferência)
  demo                 Demonstração offline roteirizada em diretório temporário
  run "objetivo"       Executa uma tarefa
  chat                 Conversa interativa; /new cria sessão, /exit sai
  resume <id> "texto"  Retoma com resposta/orientação; preserva limites
  sessions             Lista sessões do workspace
  inspect <id>         Mostra estado e resumo dos eventos
Opções: --workspace <dir> --config <json> --allow-write --allow-exec --json
Padrão: somente leitura. Comandos executam exclusivamente em Docker.
Saídas: 0 concluído; 2 erro; 3 limite; 4 aguardando usuário; 5 teste falhou/efeito incerto; 130 cancelado.`;
function exitCode(result) {
  return ({ error: 2, limited: 3, waiting_user: 4, failed: 5, blocked_uncertain: 5, cancelled: 130 })[result.state.status] || 0;
}
async function main() {
  invariant(Number(process.versions.node.split('.')[0]) >= 24, 'Node.js 24+ obrigatório');
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    workspace: { type: 'string', default: process.cwd() }, config: { type: 'string' },
    'allow-write': { type: 'boolean', default: false }, 'allow-exec': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' }
  } });
  const print = item => stdout.write((values.json ? redact(JSON.stringify(item)) : clean(redact(typeof item === 'string' ? item : JSON.stringify(item, null, 2)))) + '\n');
  const emit = event => {
    if (values.json) return print(event);
    if (event.type === 'message') print(event.text);
    else if (event.type === 'question') print(`Informação necessária: ${event.question}`);
    else if (event.type === 'tool_completed') print(`  ${event.tool}: ${event.ok ? 'executada' : event.error || 'erro'}`);
    else if (['created', 'resumed', 'finished', 'stopped'].includes(event.type)) print(`[${event.status}] sessão ${event.session}${event.error ? ': ' + event.error : ''}`);
  };
  const command = positionals[0];
  if (!command || values.help) { print(HELP); return; }
  const abort = new AbortController();
  const cancel = () => abort.abort(new Error('Cancelado pelo usuário'));
  process.on('SIGINT', cancel);
  try {
    if (command === 'demo') {
      const result = await demo({ emit }); print({ type: 'result', workspace: result.root, session: result.id, status: result.state.status, journal: result.file });
      process.exitCode = exitCode(result); return;
    }
    const loaded = await loadConfig(values.workspace, values.config);
    const { root, config } = loaded;
    const permissions = { allowWrite: values['allow-write'], allowExec: values['allow-exec'] };
    if (command === 'init') {
      const outcomes = [];
      for (const [filename, content] of [['wzzy.config.json', JSON.stringify(defaults, null, 2) + '\n'], ['WZZY.md', '# Orientações para WZZY AI\n\nDescreva padrões, verificações e restrições deste projeto.\n']]) {
        try { await writeFile(path.join(root, filename), content, { flag: 'wx', mode: 0o600 }); outcomes.push(`${filename}: criado`); }
        catch (error) { if (error.code !== 'EEXIST') throw error; outcomes.push(`${filename}: preservado`); }
      }
      print(outcomes); return;
    }
    if (command === 'doctor') {
      let docker; try { docker = await capture('docker', ['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 5000, maxBytes: 2000 }); }
      catch (error) { docker = { exitCode: null, output: error.code || error.message }; }
      let ollama = false;
      if (config.provider === 'ollama') {
        try { const response = await fetch(config.baseUrl + '/api/tags', { signal: AbortSignal.timeout(3000), redirect: 'error' }); ollama = response.ok; } catch { /* indisponível */ }
      }
      print({ node: process.version, workspace: root, provider: config.provider, model: config.model || 'NÃO CONFIGURADO',
        apiKeyPresent: Boolean(process.env.OPENAI_API_KEY), pricingConfigured: Boolean(config.pricing), ollamaReachable: ollama,
        dockerReady: docker.exitCode === 0, dockerDiagnostic: docker.exitCode === 0 ? 'ok' : docker.output,
        guidance: 'Demo e testes offline funcionam sem modelo. Configure um modelo para run/chat; prepare Docker para run_check.' }); return;
    }
    if (command === 'sessions') { print(await listSessions(root)); return; }
    if (command === 'inspect') {
      const j = await Journal.load(root, positionals[1]);
      print({ id: j.id, file: j.file, status: j.state?.status, objective: j.state?.objective,
        calls: j.state?.modelCalls, tools: j.state?.toolCalls, spent: j.state?.spent, held: j.state?.held,
        pending: j.state?.pendingTool, uncertainEffect: j.state?.uncertainEffect,
        events: j.events.map(e => ({ seq: e.seq, type: e.type, time: e.time, data: e.data })) }); return;
    }
    const execute = (objective, resumeId) => runAgent({ ...loaded, objective, resumeId, permissions, signal: abort.signal, emit });
    if (command === 'run' || command === 'resume') {
      const result = command === 'run' ? await execute(positionals.slice(1).join(' ')) : await execute(positionals.slice(2).join(' '), positionals[1]);
      print({ type: 'result', session: result.id, status: result.state.status, journal: result.file, error: result.error || null });
      process.exitCode = exitCode(result); return;
    }
    if (command === 'chat') {
      invariant(stdin.isTTY && !values.json, 'chat exige terminal interativo sem --json');
      const rl = createInterface({ input: stdin, output: stdout }); let id;
      print('WZZY AI — /new inicia outra sessão, /exit encerra. Permissões vêm das opções da CLI.');
      try {
        while (!abort.signal.aborted) {
          const line = await rl.question('Você> ', { signal: abort.signal });
          if (line.trim() === '/exit') break;
          if (line.trim() === '/new') { id = undefined; continue; }
          if (!line.trim()) continue;
          const result = await execute(line, id); id = result.id;
          print({ session: id, status: result.state.status, error: result.error || null });
          if (['limited', 'blocked_uncertain', 'error'].includes(result.state.status)) { print('Revise o diagnóstico; use /new após resolver a causa.'); id = undefined; }
        }
      } finally { rl.close(); }
      return;
    }
    throw new Error(`Comando desconhecido: ${command}. Use --help.`);
  } finally { process.removeListener('SIGINT', cancel); }
}
main().catch(error => { process.stderr.write(clean(redact(error.message)) + '\n'); process.exitCode = error.name === 'AbortError' ? 130 : 2; });
