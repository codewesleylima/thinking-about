import path from 'node:path';
import { lstat, readdir, readFile, realpath, mkdir, open, rename, unlink, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hash, invariant } from './util.js';

const deniedDirs = new Set(['.git', '.yzzy', '.wzzy', '.aws', '.ssh', '.azure', '.config', '.agents', '.codex', '.github', 'node_modules', 'coverage', '.venv', 'venv', '__pycache__']);
const sensitive = /(^\.env($|\.)|^\.npmrc$|^\.pypirc$|^credentials($|\.)|^id_rsa|^id_ed25519|\.(pem|key|p12|pfx)$|secret|private[-_]?key)/i;
const protectedNames = new Set(['yzzy.config.json', 'yzzy.md', 'wzzy.config.json', 'wzzy.md', 'agents.md']);

export class Workspace {
  constructor(root, config, { allowWrite = false, configPath } = {}) {
    this.root = root; this.config = config; this.allowWrite = allowWrite;
    this.configPath = configPath && path.resolve(configPath);
  }
  normalize(relative) {
    invariant(typeof relative === 'string' && relative.length && relative.length <= 1024, 'Caminho inválido');
    invariant(!path.isAbsolute(relative) && !relative.includes('\\') && !/[:\x00-\x1f]/.test(relative), 'Use caminho relativo com /');
    const parts = relative.split('/');
    invariant(parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p)), 'Caminho ambíguo ou fora do workspace');
    invariant(!parts.some(p => deniedDirs.has(p.toLowerCase()) || sensitive.test(p)), 'Caminho bloqueado pela política');
    return parts.join('/');
  }
  async resolve(relative, { write = false, missing = false } = {}) {
    const rel = this.normalize(relative);
    const target = path.resolve(this.root, rel);
    const inside = path.relative(this.root, target);
    invariant(inside && !inside.startsWith('..') && !path.isAbsolute(inside), 'Caminho fora do workspace');
    if (write) {
      invariant(this.allowWrite, 'Edição exige --allow-write');
      invariant(!rel.split('/').some(p => protectedNames.has(p.toLowerCase())) && target !== this.configPath && !rel.startsWith('evaluations/'), 'Arquivo de controle/avaliação protegido');
      invariant(this.config.writeRoots.some(base => rel === base.replaceAll('\\', '/') || rel.startsWith(base.replaceAll('\\', '/') + '/')), 'Edição fora de writeRoots');
    }
    let cursor = this.root;
    for (const part of rel.split('/')) {
      cursor = path.join(cursor, part);
      try {
        const stat = await lstat(cursor);
        invariant(!stat.isSymbolicLink(), 'Links simbólicos/junctions não são permitidos');
        invariant(stat.isDirectory() || (stat.isFile() && stat.nlink === 1), 'Arquivo especial ou hardlink bloqueado');
        invariant((await realpath(cursor)).toLowerCase() === cursor.toLowerCase(), 'Resolução de caminho inesperada');
      } catch (error) { if (!(missing && error.code === 'ENOENT')) throw error; }
    }
    return target;
  }
  async read(relative) {
    const target = await this.resolve(relative);
    const stat = await lstat(target);
    invariant(stat.isFile() && stat.size <= this.config.limits.maxFileBytes, 'Arquivo ausente, grande ou não regular');
    const buffer = await readFile(target);
    invariant(buffer.length <= this.config.limits.maxFileBytes && !buffer.includes(0), 'Arquivo binário ou grande');
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
    return { path: relative, content, sha256: hash(buffer), bytes: buffer.length };
  }
  async list({ strict = false } = {}) {
    const files = []; let visited = 0; let truncated = false;
    const walk = async (dir, prefix = '') => {
      const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (++visited > this.config.limits.maxScanFiles) { truncated = true; return; }
        const rel = prefix + entry.name;
        try { this.normalize(rel); } catch { continue; }
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel + '/');
        else if (entry.isFile()) {
          const stat = await lstat(path.join(dir, entry.name));
          if (stat.nlink === 1) files.push(rel);
        }
        if (truncated) return;
      }
    };
    await walk(this.root);
    invariant(!strict || !truncated, 'Workspace excede maxScanFiles; revisão completa indisponível');
    return { files, truncated };
  }
  async lines(relative, start, count) {
    const data = await this.read(relative);
    const lines = data.content.split('\n');
    return { path: relative, sha256: data.sha256, start_line: start, total_lines: lines.length,
      content: lines.slice(start - 1, start - 1 + count).map((line, i) => `${start + i}: ${line}`).join('\n'),
      more: start - 1 + count < lines.length };
  }
  async search(query) {
    invariant(typeof query === 'string' && query.length > 0 && query.length <= 300, 'Busca literal exige 1–300 caracteres');
    const { files, truncated } = await this.list(); const matches = []; let bytes = 0;
    for (const file of files) {
      let data; try { data = await this.read(file); } catch { continue; }
      for (const [index, line] of data.content.split('\n').entries()) {
        if (line.includes(query)) {
          const item = { path: file, line: index + 1, text: line.slice(0, 600) };
          bytes += Buffer.byteLength(JSON.stringify(item));
          if (bytes > this.config.limits.maxOutputBytes) return { matches, truncated: true };
          matches.push(item);
        }
      }
    }
    return { matches, truncated };
  }
  async replace({ path: relative, expected_sha256, old_text, new_text }) {
    const target = await this.resolve(relative, { write: true });
    const before = await this.read(relative);
    invariant(before.sha256 === expected_sha256, 'Conflito: hash desatualizado; releia o arquivo');
    invariant(old_text.length && before.content.split(old_text).length === 2, 'Substituição exige exatamente uma ocorrência');
    const next = before.content.replace(old_text, () => new_text);
    invariant(Buffer.byteLength(next) <= this.config.limits.maxFileBytes, 'Edição excede maxFileBytes');
    const mode = (await lstat(target)).mode;
    const temp = `${target}.yzzy-${randomUUID()}.tmp`;
    try {
      const handle = await open(temp, 'wx', mode);
      try { await handle.writeFile(next, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await this.resolve(relative, { write: true });
      invariant((await this.read(relative)).sha256 === expected_sha256, 'Conflito concorrente; edição abortada');
      await rename(temp, target);
      return { path: relative, before: before.sha256, sha256: hash(next), bytes: Buffer.byteLength(next) };
    } finally { await unlink(temp).catch(() => {}); }
  }
  async create({ path: relative, content }) {
    const target = await this.resolve(relative, { write: true, missing: true });
    invariant(Buffer.byteLength(content) <= this.config.limits.maxFileBytes && !content.includes('\0'), 'Conteúdo inválido/grande');
    await mkdir(path.dirname(target), { recursive: true });
    await this.resolve(relative, { write: true, missing: true });
    const handle = await open(target, 'wx', 0o600);
    try { await handle.writeFile(content, 'utf8'); await handle.sync(); }
    catch (error) { error.effectUnknown = true; throw error; }
    finally { await handle.close(); }
    return { path: relative, sha256: hash(content) };
  }
  async snapshot(destination) {
    const { files } = await this.list({ strict: true }); const manifest = [];
    let total = 0;
    for (const relative of files) {
      const source = await this.resolve(relative);
      const stat = await lstat(source);
      invariant(stat.size <= 8 * 1024 * 1024, `Snapshot: arquivo excede 8 MiB ${relative}`);
      const bytes = await readFile(source); total += bytes.length;
      invariant(total <= 32 * 1024 * 1024, 'Snapshot excede 32 MiB');
      manifest.push([relative, hash(bytes)]);
      if (destination) {
        const target = path.join(destination, relative);
        await mkdir(path.dirname(target), { recursive: true });
        const handle = await open(target, 'wx', 0o644);
        try { await handle.writeFile(bytes); } finally { await handle.close(); }
        await chmod(target, 0o644);
      }
    }
    return { revision: hash(JSON.stringify(manifest)), files: manifest.length, manifest };
  }
}
