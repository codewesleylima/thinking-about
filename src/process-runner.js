import { spawn } from 'node:child_process';
import { abortIfNeeded } from './util.js';

const safeEnvironment = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/KEY|TOKEN|SECRET|PASSWORD/i.test(key) && !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)
  && !['NODE_OPTIONS', 'NODE_PATH'].includes(key)));

// Somente controladores escolhem executable/argv. Não é ferramenta do modelo.
export function runProcess(executable, args, { cwd, signal, timeoutMs = 60000, maxBytes = 32768 } = {}) {
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
      grace = setTimeout(() => { child.stdout.destroy(); child.stderr.destroy(); child.unref(); finish(); }, 2000);
    };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, { once: true }); if (signal?.aborted) stop();
    const collect = key => chunk => {
      const remaining = Math.max(0, maxBytes - bytes); bytes += chunk.length;
      const text = chunk.subarray(0, remaining).toString('utf8');
      if (key === 'stdout') stdout += text; else stderr += text;
      if (bytes > maxBytes) stop();
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    child.once('error', error => { if (finished) return; finished = true; clearTimeout(timer); clearTimeout(grace); signal?.removeEventListener('abort', stop); reject(error); });
    child.once('close', finish);
  });
}
