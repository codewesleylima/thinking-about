import path from 'node:path';
import { mkdir, lstat, open, readFile, readdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { canonical, hash, invariant, redact } from './util.js';
export async function stateDirectory(root) {
  const dir = path.join(root, '.wzzy');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  invariant((await lstat(dir)).isDirectory() && !(await lstat(dir)).isSymbolicLink(), '.wzzy deve ser diretório real');
  const sessions = path.join(dir, 'sessions');
  await mkdir(sessions, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  invariant((await lstat(sessions)).isDirectory() && !(await lstat(sessions)).isSymbolicLink(), 'sessions deve ser diretório real');
  return sessions;
}
export async function lockWorkspace(root) {
  await stateDirectory(root);
  const file = path.join(root, '.wzzy', 'workspace.lock');
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Workspace ocupado: .wzzy/workspace.lock existe. Após crash, confira o PID no arquivo e remova o lock somente se o processo terminou.'); throw error; }
  await handle.writeFile(JSON.stringify({ pid: process.pid, created: new Date().toISOString() }));
  return async () => { await handle.close(); await unlink(file); };
}
export class Journal {
  constructor(file, events = []) { this.file = file; this.events = events; }
  static async create(root) {
    const dir = await stateDirectory(root); const id = randomUUID();
    const file = path.join(dir, id + '.jsonl');
    const h = await open(file, 'wx', 0o600); await h.close();
    const journal = new Journal(file); journal.id = id; return journal;
  }
  static async load(root, id) {
    invariant(/^[0-9a-f-]{36}$/.test(id), 'ID de sessão inválido');
    const file = path.join(await stateDirectory(root), id + '.jsonl');
    const stat = await lstat(file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 64 * 1024 * 1024, 'Journal inválido ou grande');
    const raw = await readFile(file, 'utf8');
    invariant(raw.endsWith('\n') || !raw, 'Journal com cauda incompleta; preserve para diagnóstico');
    const events = raw.trim() ? raw.trim().split('\n').map(line => JSON.parse(line)) : [];
    let previous = '0'.repeat(64);
    for (const [index, event] of events.entries()) {
      const { digest, ...body } = event;
      invariant(body.seq === index + 1 && body.previous === previous && hash(canonical(body)) === digest, 'Integridade do journal inválida');
      previous = digest;
    }
    const journal = new Journal(file, events); journal.id = id; return journal;
  }
  get state() { return this.events.at(-1)?.state; }
  async append(type, state, data = {}) {
    const body = JSON.parse(redact(JSON.stringify({ seq: this.events.length + 1,
      previous: this.events.at(-1)?.digest || '0'.repeat(64), time: new Date().toISOString(), type, data, state })));
    const event = { ...body, digest: hash(canonical(body)) };
    const stat = await lstat(this.file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Journal substituído por link');
    const handle = await open(this.file, 'a');
    try { await handle.writeFile(JSON.stringify(event) + '\n'); await handle.sync(); } finally { await handle.close(); }
    this.events.push(event);
    return event;
  }
}
export async function listSessions(root) {
  const dir = await stateDirectory(root); const results = [];
  for (const file of (await readdir(dir)).filter(x => /^[0-9a-f-]{36}\.jsonl$/.test(x))) {
    try {
      const journal = await Journal.load(root, file.slice(0, -6));
      results.push({ id: journal.id, status: journal.state?.status, objective: journal.state?.objective, created: journal.state?.created });
    } catch { results.push({ id: file.slice(0, -6), status: 'corrupt' }); }
  }
  return results;
}
