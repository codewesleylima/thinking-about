import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { invariant, bounded, abortIfNeeded } from './util.js';

// argv direto, sem shell. Esta função só é usada pelo controlador e scripts de validação.
export function capture(executable, args, { signal, timeoutMs = 10000, maxBytes = 32768, env, cwd } = {}) {
  return new Promise((resolve, reject) => {
    abortIfNeeded(signal);
    let output = ''; let bytes = 0; let timedOut = false; let truncated = false;
    const started = Date.now();
    const child = spawn(executable, args, { env, cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const abort = () => stop(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) stop();
    const collect = chunk => { bytes += chunk.length; if (Buffer.byteLength(output) < maxBytes) output = bounded(output + chunk.toString('utf8'), maxBytes); if (bytes > maxBytes) truncated = true; };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, killedSignal) => { cleanup(); resolve({ exitCode: code, signal: killedSignal, output, truncated, timedOut, cancelled: signal?.aborted || false, durationMs: Date.now() - started }); });
  });
}
export function dockerArgs(config, snapshot, name, argv) {
  invariant(!snapshot.includes(','), 'Caminho temporário contém vírgula incompatível com Docker mount');
  return ['run', '--name', name, '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--pids-limit', String(config.docker.pids),
    '--memory', config.docker.memory, '--cpus', config.docker.cpus, '--user', '65534:65534',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m,mode=1777',
    '--mount', `type=bind,source=${snapshot},target=/workspace,readonly`,
    '--workdir', '/workspace', '--env', 'HOME=/tmp', '--entrypoint', argv[0], config.docker.image, ...argv.slice(1)];
}
export async function runDocker(workspace, commandName, { signal, runner = capture, onEvent = () => {} } = {}) {
  const config = workspace.config;
  invariant(Object.hasOwn(config.commands, commandName), 'Comando desconhecido');
  const staging = await mkdtemp(path.join(tmpdir(), 'yzzy-snapshot-'));
  const name = `yzzy-${randomUUID()}`; let cleanupKnown = false;
  try {
    abortIfNeeded(signal);
    const snapshot = await workspace.snapshot(staging);
    // mkdtemp usa 0700 em POSIX; o usuário do container precisa atravessar o diretório.
    const { chmod } = await import('node:fs/promises'); await chmod(staging, 0o755);
    onEvent({ type: 'container', name, revision: snapshot.revision });
    abortIfNeeded(signal);
    const result = await runner('docker', dockerArgs(config, staging, name, config.commands[commandName].argv),
      { signal, timeoutMs: config.limits.commandTimeoutMs, maxBytes: config.limits.maxOutputBytes });
    const cleanup = await runner('docker', ['rm', '-f', name], { timeoutMs: 10000, maxBytes: 1024 });
    cleanupKnown = cleanup.exitCode === 0 || /No such container/i.test(cleanup.output);
    const current = await workspace.snapshot();
    return { ...result, command: commandName, revision: snapshot.revision, currentRevision: current.revision,
      cleanupKnown, passed: result.exitCode === 0 && !result.timedOut && !result.cancelled && !result.truncated && cleanupKnown && current.revision === snapshot.revision };
  } finally {
    if (!cleanupKnown) {
      try { const result = await runner('docker', ['rm', '-f', name], { timeoutMs: 10000, maxBytes: 1024 }); cleanupKnown = result.exitCode === 0 || /No such container/i.test(result.output); } catch { /* journal registra efeito incerto */ }
    }
    // Somente o diretório exato criado por mkdtemp, nunca um caminho do modelo.
    const resolved = path.resolve(staging);
    invariant(path.dirname(resolved).toLowerCase() === path.resolve(tmpdir()).toLowerCase() && path.basename(resolved).startsWith('yzzy-snapshot-'), 'Diretório temporário fora do escopo');
    await rm(resolved, { recursive: true, force: true });
  }
}
