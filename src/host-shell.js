import { spawn } from 'node:child_process';
import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { abortIfNeeded, invariant } from './util.js';

export function shellEnvironment(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/KEY|TOKEN|SECRET|PASSWORD|NODE_OPTIONS|NODE_PATH/i.test(key)));
}
// Shell do usuário confiável, não sandbox: cwd e limpeza são conveniência operacional.
export async function runHostShell(workspace, { command, cwd }, { signal } = {}) {
  invariant(typeof command === 'string' && command.trim() && !command.includes('\0') && Buffer.byteLength(command) <= 16000, 'Comando exige 1–16000 bytes sem NUL');
  const directory = cwd === '.' ? workspace.root : await workspace.resolve(cwd);
  invariant((await lstat(directory)).isDirectory(), 'cwd deve ser diretório permitido');
  abortIfNeeded(signal);
  const windows = process.platform === 'win32';
  const shell = windows ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'cmd.exe') : '/bin/sh';
  const started = Date.now(), maxBytes = workspace.config.limits.maxOutputBytes;
  return new Promise((resolve, reject) => {
    let bytes = 0, output = '', truncated = false, timedOut = false, cancelled = false;
    let stopping = false, finished = false, forced = false, timer, grace;
    const child = spawn(command, [], { cwd: directory, env: shellEnvironment(), shell,
      detached: !windows, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const cleanup = () => { clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener('abort', abort); };
    const finish = (code = null, killedSignal = null) => {
      if (finished) return; finished = true; cleanup();
      const result = { ok: code === 0 && !timedOut && !cancelled && !truncated && !forced,
        execution: windows ? 'trusted-host-cmd' : 'trusted-host-sh', cwd, exitCode: code, signal: killedSignal,
        processId: child.pid ?? null,
        output, truncated, timedOut, cancelled, cleanupKnown: !stopping && !forced,
        durationMs: Date.now() - started, verification: 'diagnostic_only' };
      if (!result.ok) result.error = stopping ? 'Comando interrompido; inspecione efeitos e processos antes de repetir.' : `Comando terminou com código ${code}; saída truncada=${truncated}.`;
      const fits = () => Buffer.byteLength(JSON.stringify(result)) <= maxBytes;
      if (!fits()) {
        let low = 0, high = output.length; result.truncated = true; result.ok = false;
        while (low < high) { const middle = Math.ceil((low + high) / 2); result.output = output.slice(0, middle); if (fits()) low = middle; else high = middle - 1; }
        result.output = output.slice(0, low);
      }
      resolve(result);
    };
    const stop = () => {
      if (stopping || finished) return; stopping = true;
      if (child.exitCode !== null || child.signalCode !== null) {
        // exit pode ocorrer antes de close: descendentes ainda podem segurar os pipes.
        // Não use o PID de um shell que já saiu: ele pode ter sido reutilizado.
      } else if (windows && child.pid) {
        // PID exato deste filho. Sem /IM, wildcard ou encerramento de outros processos.
        const killer = spawn(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'taskkill.exe'),
          ['/pid', String(child.pid), '/t', '/f'], { shell: false, windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill()); killer.unref();
      } else if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
      else child.kill();
      // Não garantimos limpeza de processos destacados/serviços; não haverá replay automático.
      grace = setTimeout(() => { forced = true; child.stdout.destroy(); child.stderr.destroy(); child.kill(); child.unref(); finish(); }, 3000);
    };
    const abort = () => { cancelled = true; stop(); };
    timer = setTimeout(() => { timedOut = true; stop(); }, workspace.config.limits.commandTimeoutMs);
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
    const collect = chunk => {
      bytes += chunk.length;
      if (Buffer.byteLength(output) < maxBytes) output = Buffer.from(output + chunk.toString('utf8')).subarray(0, maxBytes).toString('utf8');
      if (bytes > maxBytes) truncated = true;
    };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { if (!finished) { finished = true; cleanup(); error.effectUnknown = Boolean(child.pid); reject(error); } });
    child.on('close', finish);
  });
}
