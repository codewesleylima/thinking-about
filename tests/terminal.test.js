import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { Terminal, wrap, cells } from '../src/terminal.js';
function terminal(columns = 80, env = {}) {
  let output = '';
  const stream = Object.assign(new EventEmitter(), { columns, rows: 30, isTTY: false, write(text) { output += text; return true; }, hasColors: () => true });
  return { ui: new Terminal(stream, env), stream, output: () => output };
}

test('conversa humana não exibe eventos internos, JSON de resultado ou UUID', () => {
  const { ui, output } = terminal(); const session = 'a1a11111-1111-4111-8111-111111111111';
  ui.event({ type: 'created', session, status: 'running' });
  ui.event({ type: 'message', session, text: 'Olá! Como posso ajudar?' });
  ui.event({ type: 'finished', session, status: 'completed_unverified' });
  ui.outcome({ id: session, state: { status: 'completed_unverified', messages: [] } });
  assert.match(output(), /Olá! Como posso ajudar/);
  assert.doesNotMatch(output(), /running|completed_unverified|111111|"status"|\x1b/);
});

test('terminal filtra controles injetados em mensagem, ferramenta e diagnóstico mesmo com cor', () => {
  const { ui, output } = terminal(80, { FORCE_COLOR: '1' });
  const malicious = '\x1b[2J\x1b]0;MALICIOUS_TITLE\x07hello';
  ui.message(malicious); ui.event({ type: 'tool_completed', tool: 'read_file', ok: true, path: malicious }); ui.failure(malicious);
  assert.match(output(), /hello/); assert.doesNotMatch(output(), /\x1b\[2J|\x1b\]0;|MALICIOUS_TITLE/);
  assert.match(output(), /\x1b\[36/);
});

test('cores opcionais e quebra de linha acomodam paths, emoji, acentos e terminais estreitos', () => {
  const { ui, output } = terminal(28, { FORCE_COLOR: '1', NO_COLOR: '' });
  ui.banner({ root: 'C:/Usuários/João/um-projeto-com-nome-muito-longo', provider: 'codex', profile: { name: 'general' }, permissions: {} });
  ui.message('Olá 👩‍💻 ação 界界.\n```js\n  const resultado = true;\n```');
  assert.doesNotMatch(output(), /\x1b/);
  for (const line of output().split('\n')) assert.ok(cells(line) <= 28, line);
  const lines = wrap('longo/' + 'x'.repeat(100) + '\n  preserve recuo', 12);
  assert.ok(lines.every(line => cells(line) <= 12)); assert.match(lines.join('\n'), /  preserve/);
});

test('indicador de atividade encerra antes da resposta e não deixa timer ativo', () => {
  const { ui, stream, output } = terminal(); stream.isTTY = true; ui.animate = true;
  ui.progress('Pensando'); assert.ok(ui.timer);
  ui.message('Pronto'); assert.equal(ui.timer, undefined);
  assert.match(output(), /Pensando/); assert.match(output(), /\r\x1b\[2K/); assert.match(output(), /Pronto/);
});

test('cota esgotada recebe orientação em português sem sugerir que nova sessão resolve', () => {
  const { ui, output } = terminal();
  ui.outcome({ state: { status: 'error' }, error: 'You have hit your usage limit. Upgrade to Pro.' });
  assert.match(output(), /Limite de uso do Codex atingido/); assert.match(output(), /histórico/);
  assert.doesNotMatch(output(), /Upgrade|\/new/);
});

test('cancelar abertura animada restaura cursor e permite continuar usando o terminal', async () => {
  const { ui, stream, output } = terminal(); stream.isTTY = true; stream.rows = 30; ui.animate = true;
  const controller = new AbortController();
  const opening = ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} }, { signal: controller.signal });
  assert.match(output(), /\x1b\[\?25l/);
  controller.abort(); await opening;
  assert.match(output(), /\x1b\[\?25h/); assert.equal(ui.timer, undefined);
  ui.message('Pode continuar'); assert.match(output(), /Pode continuar/);
});

test('pipe e movimento desativado recebem globo estático sem controle de cursor', async () => {
  for (const env of [{}, { YZZY_ANIMATION: '0' }]) {
    const { stream, output } = terminal(80, env);
    stream.isTTY = Boolean(env.YZZY_ANIMATION); stream.hasColors = () => false;
    const ui = new Terminal(stream, env);
    await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} });
    assert.doesNotMatch(output(), /\x1b/); assert.match(output(), /YZZY BLACK/);
  }
});

test('globo do cabeçalho continua após a abertura e não para quando chega uma resposta', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { ui, stream, output } = terminal(); stream.isTTY = true; stream.rows = 30; ui.animate = true;
  t.after(() => ui.close());
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} });
  const viewport = ui.live, before = output().length;
  t.mock.timers.tick(270);
  assert.ok(viewport.angle > 0); assert.ok(output().length > before);
  ui.message('Olá'); assert.equal(ui.live, viewport); assert.ok(viewport.timer);
  const afterMessage = output().length; t.mock.timers.tick(180); assert.ok(output().length > afterMessage);
  assert.match(output(), /\x1b7/); assert.match(output(), /\x1b8/);
});

test('redimensionar recalcula viewport e mantém o cabeçalho animado', async t => {
  const { ui, stream, output } = terminal(); stream.isTTY = true; stream.rows = 30; ui.animate = true;
  t.after(() => ui.close());
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} });
  stream.columns = 40; stream.rows = 24; stream.emit('resize');
  assert.equal(ui.live.layout.width, 36); assert.equal(ui.live.layout.rows, 24); assert.ok(ui.live.timer);
  assert.match(output(), /\x1b\[\?25h/);
});

test('mini globo rotativo ocupa o rodapé e parar atividade não encerra o globo principal', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { ui, stream, output } = terminal(); stream.isTTY = true; ui.animate = true;
  t.after(() => ui.close());
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} });
  const before = output().length;
  ui.progress('Pensando'); t.mock.timers.tick(300);
  const activity = output().slice(before);
  assert.match(activity, /[\u2800-\u28ff]/); assert.match(activity, /Pensando/);
  assert.doesNotMatch(activity, /[·•] Pensando/); assert.ok(ui.busyAngle > 0);
  ui.stop(); assert.equal(ui.timer, undefined); assert.ok(ui.live.timer);
});

test('resize com readline conserva texto e posição de edição', async t => {
  const { ui, stream } = terminal(); stream.isTTY = true; ui.animate = true;
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => {};
  const rl = createInterface({ input, output: stream, terminal: true });
  t.after(() => { ui.close(); rl.close(); input.destroy(); });
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} }, { input: rl });
  ui.inputActive = true; const answer = rl.question(ui.prompt());
  rl.write('uma consulta parcial'); rl.write(null, { name: 'left' }); rl.write(null, { name: 'left' });
  const cursor = rl.cursor;
  stream.columns = 60; stream.rows = 24; stream.emit('resize');
  assert.equal(rl.line, 'uma consulta parcial'); assert.equal(rl.cursor, cursor);
  rl.write(null, { name: 'return' }); assert.equal(await answer, 'uma consulta parcial');
});

test('fechar tela restaura margens e buffer original e remove animações/listeners', async () => {
  const { ui, stream, output } = terminal(); stream.isTTY = true; ui.animate = true;
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} });
  const viewport = ui.live; ui.progress('Executando');
  ui.close(); ui.close();
  assert.equal(viewport.timer, undefined); assert.equal(ui.timer, undefined); assert.equal(ui.live, undefined);
  assert.equal(stream.listenerCount('resize'), 0);
  assert.match(output(), /\x1b\[r\x1b\[0m\x1b\[\?25h\x1b\[\?1049l/);
});

test('PgUp/PgDn navegam no histórico sem consumir a mensagem em edição', async t => {
  const { ui, stream } = terminal(); stream.isTTY = true; ui.animate = true;
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => {};
  const rl = createInterface({ input, output: stream, terminal: true });
  t.after(() => { ui.close(); rl.close(); input.destroy(); });
  await ui.opening({ root: '.', provider: 'codex', profile: { name: 'general' }, permissions: {} }, { input: rl });
  for (let i = 0; i < 40; i++) ui.note(`Mensagem ${i}`);
  ui.inputActive = true; const answer = rl.question(ui.prompt()); rl.write('texto preservado');
  input.emit('keypress', '', { name: 'pageup' });
  assert.ok(ui.live.offset > 0); assert.equal(rl.line, 'texto preservado');
  input.emit('keypress', '', { name: 'pagedown' });
  assert.equal(ui.live.offset, 0); assert.equal(rl.line, 'texto preservado');
  rl.write(null, { name: 'return' }); assert.equal(await answer, 'texto preservado');
});
