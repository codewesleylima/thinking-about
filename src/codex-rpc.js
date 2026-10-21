import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { invariant, bounded } from './util.js';
import { VERSION } from './version.js';
const require = createRequire(import.meta.url);

export async function codexExecutable() {
  const targets = { 'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc', 'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl', 'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin' };
  const key = `${process.platform}-${process.arch}`; invariant(targets[key], 'Plataforma não suportada pelo Codex empacotado');
  const file = process.env.YZZY_CODEX_EXECUTABLE || path.join(path.dirname(require.resolve(`@openai/codex-${key}/package.json`)), 'vendor', targets[key], 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
  invariant((await lstat(file)).isFile(), 'Executável Codex ausente; execute npm ci com dependências opcionais'); return file;
}
export function codexEnvironment() {
  const home = os.homedir();
  return { ...process.env, HOME: process.env.HOME || home, USERPROFILE: process.env.USERPROFILE || home,
    CODEX_HOME: process.env.CODEX_HOME || path.join(home, '.codex') };
}
export class CodexRpc {
  constructor(child) {
    this.child = child; this.next = 1; this.pending = new Map(); this.listeners = new Set(); this.buffer = ''; this.stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdin.on('error', error => this.fail(error));
    child.stderr.on('data', chunk => this.stderr = bounded(this.stderr + chunk, 4000));
    child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > 4 * 1024 * 1024) { this.fail(new Error('Mensagem Codex excedeu 4 MiB')); this.close(); return; }
      let newline;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline); this.buffer = this.buffer.slice(newline + 1); if (!line.trim()) continue;
        try { this.receive(JSON.parse(line)); } catch (error) { this.fail(error); this.close(); return; }
      }
    });
    child.on('error', error => this.fail(error));
    child.on('exit', (code, signal) => this.fail(new Error(`Codex encerrou (${code ?? signal}). ${this.stderr}`)));
  }
  static async start(cwd, args = []) {
    const child = spawn(await codexExecutable(), ['app-server', '--listen', 'stdio://', ...args], { cwd, env: codexEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const rpc = new CodexRpc(child);
    try {
      await rpc.request('initialize', { clientInfo: { name: 'yzzy_black', title: 'YZZY BLACK', version: VERSION } });
      rpc.send({ method: 'initialized', params: {} }); return rpc;
    } catch (error) { rpc.close(); throw error; }
  }
  send(message) { invariant(!this.closed && !this.child.killed && this.child.stdin.writable, 'Codex indisponível'); this.child.stdin.write(JSON.stringify(message) + '\n'); }
  request(method, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = this.next++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timeout do protocolo Codex: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  receive(message) {
    if (message.method && message.id !== undefined) {
      // O backend só propõe JSON; nenhuma ferramenta nativa ou aprovação é concedida.
      if (/requestApproval$/.test(message.method)) this.send({ id: message.id, result: { decision: 'decline' } });
      else this.send({ id: message.id, error: { code: -32601, message: 'YZZY BLACK executa ferramentas exclusivamente no próprio controlador' } });
      for (const listener of this.listeners) listener(message); return;
    }
    if (message.id !== undefined) {
      const entry = this.pending.get(message.id); if (!entry) return;
      clearTimeout(entry.timer); this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
    } else for (const listener of this.listeners) listener(message);
  }
  fail(error) { for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); } this.pending.clear(); for (const listener of this.listeners) listener({ method: 'yzzy/error', params: { error } }); }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('Conexão Codex encerrada'));
    this.child.stdin.end(); this.child.kill();
  }
}
