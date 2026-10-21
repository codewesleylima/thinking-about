// Viewport VT: cabeçalho e rodapé fixos, corpo rolável e cursor do readline
// preservado entre frames. Apenas a interface humana interativa usa esta tela.
export class LiveDisplay {
  constructor({ stream, input, wrap, header, footer, inputActive }) {
    Object.assign(this, { stream, input, wrap, header, footer, inputActive });
    this.history = []; this.offset = 0; this.angle = 0;
  }
  size() {
    const rows = Math.max(8, this.stream.rows || 24), columns = this.stream.columns || 80;
    const sphereHeight = rows >= 18 && columns >= 28 ? Math.max(5, Math.min(13, 2 * Math.floor(rows / 6) - 1)) : 0;
    return { rows, columns, width: Math.max(16, Math.min(100, columns - 4)),
      headerHeight: sphereHeight ? sphereHeight + 1 : 0, globeWidth: sphereHeight * 2 + 3,
      footerHeight: rows >= 12 ? 3 : 0, top: sphereHeight ? sphereHeight + 2 : 1, bottom: rows >= 12 ? rows - 3 : rows };
  }
  start() {
    this.layout = this.size();
    this.stream.write('\x1b[?1049h\x1b[2J\x1b[H');
    this.rebuild();
    this.resize = () => this.rebuild();
    this.keypress = (_, key) => {
      if (key?.name === 'pageup' || key?.name === 'pagedown') {
        const page = Math.max(1, this.layout.bottom - this.layout.top - 2);
        this.offset = Math.max(0, Math.min(this.history.length, this.offset + (key.name === 'pageup' ? page : -page)));
        this.rebuild();
      } else if (this.offset && key?.name !== 'shift') { this.offset = 0; this.rebuild(); }
    };
    this.stream.on?.('resize', this.resize);
    this.input?.input?.prependListener('keypress', this.keypress);
    this.timer = setInterval(() => { this.angle += Math.PI / 48; this.drawHeader(); this.drawFooter(); }, 90);
    this.timer.unref();
    return this;
  }
  saveDraw(rows, firstRow) {
    if (this.closed || !rows.length) return;
    let output = '\x1b7\x1b[?25l';
    for (let i = 0; i < rows.length; i++) output += `\x1b[${firstRow + i};1H\x1b[2K${rows[i]}`;
    this.stream.write(output + '\x1b8\x1b[?25h');
  }
  drawHeader() { this.saveDraw(this.header(this.angle, this.layout), 1); }
  drawFooter() { this.saveDraw(this.footer(this.layout), this.layout.bottom + 1); }
  remember(text) {
    this.history.push(...this.wrap(text, this.layout.width));
    if (this.history.length > 5000) this.history.splice(0, this.history.length - 5000);
  }
  writeLine(text) {
    this.remember(text);
    if (this.offset) { this.offset++; this.rebuild(); }
    else this.stream.write(text + '\r\n');
  }
  rebuild() {
    if (this.closed) return;
    const rl = this.input;
    const saved = rl ? { text: rl.line, cursor: rl.cursor } : null;
    // APIs públicas do readline: limpar e restaurar a edição, sem perder conteúdo.
    if (saved && (saved.text || this.inputActive())) {
      rl.write(null, { ctrl: true, name: 'a' }); rl.write(null, { ctrl: true, name: 'k' });
    }
    this.layout = this.size();
    const { top, bottom, width } = this.layout;
    this.stream.write(`\x1b[r\x1b[2J\x1b[H\x1b[${top};${bottom}r\x1b[${top};1H`);
    const lines = this.history.flatMap(line => this.wrap(line, width));
    const count = Math.max(1, bottom - top), end = Math.max(0, lines.length - this.offset);
    const visible = lines.slice(Math.max(0, end - count), end);
    for (const line of visible) this.stream.write('  ' + line + '\r\n');
    this.drawHeader(); this.drawFooter();
    if (saved && (saved.text || this.inputActive())) {
      rl.prompt();
      if (saved.text) {
        rl.write(saved.text);
        const steps = Math.min(4096, Array.from(saved.text.slice(saved.cursor)).length);
        for (let i = 0; i < steps; i++) rl.write(null, { name: 'left' });
      }
    }
  }
  clear() { this.history = []; this.offset = 0; this.rebuild(); }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer); this.timer = undefined;
    this.stream.removeListener?.('resize', this.resize);
    this.input?.input?.removeListener('keypress', this.keypress);
    this.stream.write('\x1b[r\x1b[0m\x1b[?25h\x1b[?1049l');
  }
}
