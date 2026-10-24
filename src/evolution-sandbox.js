import { mkdtemp, mkdir, lstat, readFile, open, chmod, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runProcess } from './process-runner.js';
import { Workspace } from './workspace.js';
import { hash, canonical, invariant, abortIfNeeded } from './util.js';

export async function createEvolutionSnapshot(root, files, config, signal) {
  const directory = await mkdtemp(path.join(tmpdir(), 'yzzy-evolution-snapshot-'));
  const workspace = new Workspace(root, config), entries = [];
  let total = 0;
  const dispose = async () => {
    const resolved = path.resolve(directory);
    invariant(path.dirname(resolved).toLowerCase() === path.resolve(tmpdir()).toLowerCase() && path.basename(resolved).startsWith('yzzy-evolution-snapshot-'), 'Snapshot fora do diretório temporário');
    await rm(resolved, { recursive: true, force: true });
  };
  try {
    await chmod(directory, 0o755);
    for (const relative of [...new Set(files)].sort()) {
      abortIfNeeded(signal);
      let source;
      if (relative === '.github/workflows/ci.yml') {
        let cursor = root;
        for (const part of relative.split('/')) {
          cursor = path.join(cursor, part); const stat = await lstat(cursor);
          invariant(!stat.isSymbolicLink() && (stat.isDirectory() || stat.isFile() && stat.nlink === 1)
            && (await realpath(cursor)).toLowerCase() === cursor.toLowerCase(), 'Workflow da réplica redirecionado');
        }
        source = cursor;
      } else source = await workspace.resolve(relative);
      const stat = await lstat(source);
      invariant(stat.isFile() && stat.nlink === 1 && stat.size <= 8 * 1024 * 1024, 'Arquivo inválido no snapshot de evolução');
      const bytes = await readFile(source); total += bytes.length;
      invariant(total <= 32 * 1024 * 1024, 'Snapshot de evolução excede 32 MiB');
      const target = path.join(directory, relative); await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
      const h = await open(target, 'wx', 0o644); try { await h.writeFile(bytes); } finally { await h.close(); }
      await chmod(target, 0o644); entries.push([relative, hash(bytes)]);
    }
    return { directory, revision: hash(canonical(entries)), files: entries.length, dispose };
  } catch (error) { await dispose(); throw error; }
}

export function evolutionDockerArgs(config, snapshot, name, argv, evaluationDirectory) {
  const c = config.evolution;
  invariant(!snapshot.includes(',') && (!evaluationDirectory || !evaluationDirectory.includes(',')), 'Caminho com vírgula incompatível com bind mount');
  return ['run', '--name', name, '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--pids-limit', String(c.pids), '--memory', c.memory, '--cpus', c.cpus,
    '--user', '65534:65534', '--tmpfs', '/tmp:rw,noexec,nosuid,size=512m,mode=1777',
    '--mount', `type=bind,source=${snapshot},target=/workspace,readonly`,
    ...(evaluationDirectory ? ['--mount', `type=bind,source=${evaluationDirectory},target=/evaluation,readonly`] : []),
    '--workdir', '/workspace', '--env', 'HOME=/tmp', '--env', 'YZZY_EVALUATION_OUTPUT=/tmp/evaluation-results',
    '--entrypoint', 'node', c.image, ...argv];
}

export async function runEvolutionSandbox({ snapshot, config, argv, evaluationDirectory, signal, runner = runProcess }) {
  abortIfNeeded(signal);
  const name = `yzzy-evolution-${randomUUID()}`;
  let result, cleanupKnown = false;
  try {
    result = await runner('docker', evolutionDockerArgs(config, snapshot.directory, name, argv, evaluationDirectory), {
      signal, timeoutMs: config.limits.commandTimeoutMs, maxBytes: config.limits.maxOutputBytes });
  } finally {
    // Sem o sinal abortado: a remoção deve ocorrer também após timeout/cancelamento.
    try {
      const removed = await runner('docker', ['rm', '-f', name], { timeoutMs: 10000, maxBytes: 1024 });
      cleanupKnown = removed.exitCode === 0 || /No such container/i.test(removed.stderr || '');
    } catch { /* Falha de limpeza impede publicação. */ }
  }
  return { ...result, cleanupKnown, isolation: 'docker-readonly-offline', image: config.evolution.image,
    snapshot: snapshot.revision, passed: result?.exitCode === 0 && !result.truncated && !result.cancelled && cleanupKnown };
}
