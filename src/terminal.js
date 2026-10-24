import { clean, redact } from './util.js';
import { VERSION } from './version.js';
import { globeFrame, miniGlobeFrame } from './globe.js';
import { LiveDisplay } from './live-display.js';

const safe = value => clean(redact(String(value ?? ''))).replaceAll('\t', '    ');
const segments = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
// Arte em células monoespaçadas: sem imagem, fonte externa ou consulta de rede.
const glyphs = {
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  C: [' ████', '█    ', '█    ', '█    ', ' ████'],
  K: ['█   █', '█  █ ', '███  ', '█  █ ', '█   █']
};
const wordmark = word => Array.from({ length: 5 }, (_, row) => [...word].map(letter => glyphs[letter][row]).join(' '));
const yzzyArt = wordmark('YZZY'), blackArt = wordmark('BLACK');
export function cells(text) {
  return [...segments.segment(clean(text))].reduce((n, { segment }) => n + (/^\p{Mark}+$/u.test(segment) ? 0
    : /\p{Extended_Pictographic}|[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe6f\uff01-\uff60\u{20000}-\u{3ffff}]/u.test(segment) ? 2 : 1), 0);
}
export function wrap(text, width) {
  width = Math.max(1, width); const lines = [];
  for (const paragraph of safe(text).split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    let first = true;
    for (const token of paragraph.match(/\s*\S+/gu)) {
      let space = token.match(/^\s*/u)[0]; const word = token.slice(space.length);
      if (line && cells(line + space + word) > width) { lines.push(line.trimEnd()); line = ''; space = ''; }
      if (line || first) line += space.slice(0, Math.max(0, width - 1));
      for (const { segment } of segments.segment(word)) {
        if (line && cells(line + segment) > width) { lines.push(line); line = ''; }
        line += segment;
      }
      first = false;
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}
const toolLabels = {
  list_files: ['Explorando arquivos', 'Arquivos listados'], search: ['Pesquisando no projeto', 'Pesquisa concluída'],
  read_file: ['Lendo arquivo', 'Arquivo lido'], read_lines: ['Lendo trecho', 'Trecho lido'],
  replace_text: ['Aplicando alteração', 'Alteração aplicada'], create_file: ['Criando arquivo', 'Arquivo criado'],
  run_check: ['Executando verificação', 'Verificação encerrada'], ask_user: ['Preparando pergunta', 'Pergunta preparada'],
  read_documentation: ['Consultando documentação', 'Documentação consultada'], run_command: ['Executando no host', 'Comando do host encerrado']
};
const labels = { language: 'Idioma', verbosity: 'Detalhamento', tone: 'Tom', clarification: 'Esclarecimentos', autoSummary: 'Resumo automático',
  session: 'Conversa', agent: 'Agente', backend: 'Motor', model: 'Modelo', workspace: 'Pasta', allowWrite: 'Escrita', allowExec: 'Execução', allowNetwork: 'Documentação externa',
  profileReadOnly: 'Perfil somente leitura', allowHostShell: 'Shell do host confiável', writeRoots: 'Pastas editáveis', status: 'Estado', error: 'Detalhe', exported: 'Exportado para' };
const states = { completed_unverified: 'Conversa concluída', checks_passed: 'Verificações aprovadas', waiting_user: 'Aguardando sua resposta',
  verified: 'Avaliação independente aprovada', failed: 'Verificação reprovada', limited: 'Limite atingido', cancelled: 'Cancelado',
  blocked_uncertain: 'Efeito incerto: precisa de revisão', running: 'Em andamento', error: 'Não foi possível concluir', corrupt: 'Histórico inconsistente' };

export class Terminal {
  constructor(stream = process.stdout, env = process.env) {
    this.stream = stream;
    this.color = env.NO_COLOR === undefined && env.TERM !== 'dumb' && (env.FORCE_COLOR !== undefined
      ? env.FORCE_COLOR !== '0' : Boolean(stream.isTTY && stream.hasColors?.()));
    this.animate = Boolean(stream.isTTY && env.TERM !== 'dumb' && !env.CI && env.YZZY_ANIMATION !== '0');
  }
  get width() { return Math.max(16, Math.min(100, (this.stream.columns || 80) - 4)); }
  paint(code, text) { return this.color ? `\x1b[${code}m${text}\x1b[0m` : String(text); }
  line(text = '') { if (this.live) this.live.writeLine(text); else this.stream.write(text + '\n'); }
  text(text, code) { for (const line of wrap(text, this.width)) this.line('  ' + (code ? this.paint(code, line) : line)); }
  stop() {
    this.staticActivity = undefined;
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    this.activity = null;
    if (this.live) this.live.drawFooter();
    else if (this.inlineBusy) {
      this.stream.write('\x1b[3A\r');
      for (let row = 0; row < 3; row++) this.stream.write('\r\x1b[2K' + (row < 2 ? '\x1b[1B' : ''));
      this.stream.write('\x1b[2A\r'); this.inlineBusy = false;
    }
  }
  close() {
    this.stop();
    this.live?.close(); this.live = undefined;
    if (this.openSignal && this.abortView) this.openSignal.removeEventListener('abort', this.abortView);
  }
  recordUser(text) { this.live?.remember('você › ' + safe(text)); }
  footer(layout = { footerHeight: 3 }) {
    if (!layout.footerHeight) return [];
    if (!this.activity) return ['', '  ' + this.paint('2', wrap('PgUp/PgDn histórico · /help comandos', this.width)[0]), ''];
    const seconds = Math.floor((Date.now() - this.busyStarted) / 1000);
    const globe = miniGlobeFrame(this.busyAngle || 0);
    return globe.map((row, i) => {
      const planet = row.map(cell => this.paint(cell.tone === 'land' ? '35;1' : '36', cell.char)).join('');
      const label = i === 1 ? `  ${this.activity}${seconds > 1 ? `  ${seconds}s` : ''}` : '';
      const available = Math.max(1, this.width - 7);
      return '  ' + planet + this.paint('2', wrap(label, available)[0] || '');
    });
  }
  progress(label) {
    if (!this.animate) {
      if (this.stream.isTTY && this.staticActivity !== label) { this.staticActivity = label; this.text(label + '…', '2'); }
      return;
    }
    this.activity = safe(label);
    if (this.timer) return;
    this.busyStarted = Date.now(); this.busyAngle = 0;
    const draw = () => {
      if (this.live) this.live.drawFooter();
      else {
        if (this.inlineBusy) this.stream.write('\x1b[3A\r');
        for (const line of this.footer()) this.stream.write('\r\x1b[2K' + line + '\n');
        this.inlineBusy = true;
      }
      this.busyAngle += Math.PI / 15;
    };
    draw(); this.timer = setInterval(draw, 100); this.timer.unref();
  }
  artRows(angle = 0, sphereWidth = Math.min(29, this.width)) {
    const width = this.width, sphere = globeFrame(sphereWidth, angle), output = [];
    const tones = { rim: '96', node: '96;1', land: '35;1', shadow: '35', grid: '36;2', void: '90' };
    const brandTop = Math.max(0, Math.floor((sphere.length - 7) / 2));
    for (let row = 0; row < sphere.length; row++) {
      let text = sphere[row].map(cell => this.paint(tones[cell.tone], cell.char)).join('');
      if (width >= sphereWidth + 27) {
        let caption = '';
        if (row >= brandTop && row < brandTop + 5) caption = this.paint('36;1', yzzyArt[row - brandTop])
          + (width >= sphereWidth + 59 ? '   ' + this.paint('97;1', blackArt[row - brandTop]) : '');
        else if (row === brandTop + 5) caption = this.paint('97;1', '       B L A C K');
        else if (row === brandTop + 6) caption = this.paint('90', `YZZY BLACK · v${VERSION}`);
        text += '    ' + caption;
      }
      const padding = ' '.repeat(Math.max(0, width - cells(text)));
      // Fundo preto apenas no painel, sem mudar a configuração do terminal.
      const panel = this.color ? '\x1b[40m' + text.replaceAll('\x1b[0m', '\x1b[0;40m') + padding + '\x1b[0m' : text.trimEnd();
      output.push('  ' + panel);
    }
    return output;
  }
  art(angle = 0) {
    const lines = this.artRows(angle);
    for (const line of lines) this.line(line);
    this.line();
    return lines.length + 1;
  }
  async opening(options, { signal, input } = {}) {
    this.stop();
    if (signal?.aborted) return;
    if (!this.animate || this.width < 24 || (this.stream.rows || 24) < 18) { this.banner(options); return; }
    this.live = new LiveDisplay({ stream: this.stream, input, wrap,
      inputActive: () => Boolean(this.inputActive),
      header: (angle, layout) => layout.headerHeight ? [...this.artRows(angle, layout.globeWidth), '  ' + this.paint('35;2', '─'.repeat(this.width))] : [],
      footer: layout => this.footer(layout) });
    this.live.start();
    this.openSignal = signal; this.abortView = () => this.close();
    signal?.addEventListener('abort', this.abortView, { once: true });
    this.details(options);
  }
  banner({ root, provider, model, profile, permissions }) {
    this.stop(); this.line();
    this.art();
    this.details({ root, provider, model, profile, permissions });
  }
  details({ root, provider, model, profile, permissions }) {
    if (this.width < 56 || this.live?.layout.headerHeight <= 6) this.text(`YZZY BLACK  v${VERSION}`, '1');
    if (!this.live) this.line('  ' + this.paint('35;2', '─'.repeat(Math.min(this.width, 72))));
    const readOnly = profile.readOnly || (!permissions.allowWrite && !permissions.allowHostShell);
    for (const [label, value] of [['Pasta', root], ['Modelo', model || (provider === 'codex' ? 'Codex · automático' : provider)],
      ['Agente', ({ general: 'Geral', coder: 'Programação', reviewer: 'Revisão', researcher: 'Pesquisa' })[profile.name] || profile.name], ['Acesso', permissions.allowHostShell && !profile.readOnly ? 'Shell do host autorizado · arquivos/rede sem isolamento' : `${readOnly ? 'Somente leitura' : 'Escrita autorizada'}${permissions.allowExec && !profile.readOnly ? ' · verificações autorizadas' : ''}`]]) {
      this.text(`${label.padEnd(8)} ${value}`, label === 'Pasta' ? '2' : undefined);
    }
    this.line();
    if (!this.live) { this.text('Digite para conversar. /help comandos · Tab completar', '2'); this.line(); }
  }
  prompt() { return '  ' + this.paint('35;1', 'você') + this.paint('36', ' › '); }
  message(text) {
    this.stop(); this.line(); this.text('YZZY BLACK', '36;1');
    let code = false;
    for (const raw of safe(text).split('\n')) {
      if (/^\s*```/.test(raw)) { code = !code; continue; }
      if (code) { for (const line of wrap(raw, this.width - 2)) this.line('  ' + this.paint('2', '│ ') + line); continue; }
      const heading = /^#{1,6}\s+/.test(raw), body = raw.replace(/^#{1,6}\s+/, '');
      for (const line of wrap(body, this.width)) {
        const styled = line.replace(/\*\*([^*]+)\*\*/g, (_, s) => this.paint('1', s)).replace(/`([^`]+)`/g, (_, s) => this.paint('36', s));
        this.line('  ' + (heading ? this.paint('1', styled) : styled));
      }
    }
    this.line();
  }
  note(text) { this.stop(); this.text(text, '2'); }
  failure(error) {
    const text = safe(error?.message || error);
    this.stop(); this.line();
    if (/usage limit|insufficient_quota|exceeded.{0,20}quota/i.test(text)) {
      this.text('Limite de uso do Codex atingido', '33;1');
      this.text('Aguarde a renovação da cota ou consulte o uso da sua conta:');
      this.text('https://chatgpt.com/settings/usage', '2');
      this.text('Sua conversa permanece no histórico.', '2'); this.line(); return 'quota';
    }
    this.text('Não foi possível concluir', '33;1');
    if (/maxScanFiles|revisão completa indisponível/.test(text)) {
      this.text('Esta pasta é grande demais para uma revisão completa.');
      this.text('Abra o YZZY na pasta do projeto ou use yzzy --workspace "C:/caminho/do/projeto".', '2');
    } else if (/Runtime atualizado/.test(text)) this.text('Esta conversa pertence à versão anterior. Use /new para começar outra; o histórico foi preservado.');
    else this.text(text);
    this.line();
  }
  event(event) {
    if (event.type === 'evolution_phase') this.progress(({ git: 'Preparando Git', baseline: 'Verificando base isolada', candidate: 'Verificando melhoria isolada', repair: 'Verificando correção', comparison: 'Comparando capacidades' })[event.phase] || 'Evoluindo');
    else if (event.type === 'evolution_finished') this.stop();
    else if (event.type === 'team_phase') { this.stop(); this.text(`${event.phase === 'consultation' ? 'Consulta' : 'Coordenação'} · ${event.agent}`, '36;1'); }
    else if (event.type === 'team_finished') this.stop();
    else if (event.type === 'model_started') this.progress(event.agent ? `${event.agent} · Pensando` : 'Pensando');
    else if (event.type === 'tool_started') this.progress(toolLabels[event.tool]?.[0] || 'Trabalhando');
    else if (event.type === 'message') this.message(event.text);
    else if (event.type === 'question') { this.stop(); this.text('Sua resposta', '33;1'); this.text(event.question); this.line(); }
    else if (event.type === 'context_compacted') this.note('Contexto resumido. O histórico completo foi preservado.');
    else if (event.type === 'tool_completed' && event.tool !== 'ask_user') {
      this.stop();
      const label = toolLabels[event.tool]?.[1] || event.tool;
      this.text(`${event.ok ? '✓' : '!'} ${event.ok ? label : event.error || 'Ação não concluída'}${event.path ? ` · ${event.path}` : ''}`, event.ok ? '2' : '33');
      if (!event.ok && event.recovery?.message) this.note(event.recovery.message);
    }
  }
  outcome(result) {
    this.stop(); const { state, error } = result;
    if (['error', 'limited', 'blocked_uncertain', 'failed'].includes(state.status)) {
      const category = this.failure(error || states[state.status]);
      if (category !== 'quota') this.note('Use /status para consultar a conversa; /new começa outra.');
    } else if (state.status === 'cancelled') this.note('Operação cancelada.');
    else if (['checks_passed', 'verified'].includes(state.status)) this.text(states[state.status], '32');
    else if (state.status === 'completed_unverified' && state.messages.some(m => m.role === 'tool' && m.result?.ok && ['replace_text', 'create_file'].includes(m.name))) this.note('Alterações registradas; sem verificações aprovadas para a revisão atual.');
  }
  summary(summary) {
    this.stop(); this.line(); this.text('Resumo da conversa', '1'); this.text(summary.objective);
    if (summary.userInstructions?.length > 1) { this.line(); this.text('Orientações preservadas', '2'); for (const instruction of summary.userInstructions) this.text('• ' + instruction); }
    if (summary.lastResponses?.length) { this.line(); this.text('Resposta mais recente', '2'); this.text(summary.lastResponses.at(-1)); }
    if (summary.changedFiles?.length) { this.line(); this.text('Arquivos alterados', '2'); for (const file of summary.changedFiles) this.text('• ' + file.path); }
    if (summary.uncertainEffect || summary.pendingTool) this.text('Há uma ação pendente ou de efeito incerto. Revise antes de continuar.', '33');
    this.line();
  }
  present(value) {
    this.stop();
    if (typeof value === 'string') { this.text(value); return; }
    if (Array.isArray(value)) {
      if (!value.length) { this.note('Nenhum item por aqui ainda.'); return; }
      for (const item of value) {
        if (item?.title && item.id && item.expiresAt) { this.text(item.title, '1'); this.text(`${item.status === 'active' ? 'Ativo' : item.status === 'expired' ? 'Expirado' : item.status} · ${item.id}`, '2'); this.text(`Revalidar até ${item.expiresAt.slice(0, 10)}`, '2'); }
        else if (item?.instructions && item.name) { this.text(`${item.name}  ${item.readOnly ? '· somente leitura' : ''}`, '1'); this.text(item.description, '2'); }
        else if (item?.id && item.status) { this.text(item.objective || 'Conversa', '1'); this.text(`${states[item.status] || item.status} · ${item.id}`, '2'); }
        else if (item?.model) { this.text(`${item.model}${item.default ? ' · padrão' : ''}`, '1'); if (item.description) this.text(item.description, '2'); }
        else this.present(item);
        this.line();
      }
      return;
    }
    if (value?.kind === 'extractive') { this.summary(value); return; }
    if (value && typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        if (val === undefined || val === null) continue;
        if (typeof val === 'object') { this.text(labels[key] || key, '1'); this.present(val); }
        else this.text(`${labels[key] || key}: ${typeof val === 'boolean' ? val ? 'sim' : 'não' : key === 'status' ? states[val] || val : val}`);
      }
    }
  }
}
