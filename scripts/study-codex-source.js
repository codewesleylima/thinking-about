// Auditoria de fontes públicas. Baixa texto para cache, nunca executa código upstream.
import https from 'node:https';
import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, invariant } from '../src/util.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const tag = 'rust-v0.163.0', tagObject = '129b8ec7ee6f4511557a4856279f529025c25af4';
const manifestFile = path.join(root, 'docs/codex/UPSTREAM.json');
const wanted = ['LICENSE', 'NOTICE', 'codex-rs/app-server/README.md', 'codex-rs/core/src/codex.rs',
  'codex-rs/core/src/tools/router.rs', 'codex-rs/core/src/tools/orchestrator.rs',
  'codex-rs/core/src/config/mod.rs', 'codex-rs/core/src/project_doc.rs', 'codex-rs/core/src/compact.rs',
  'codex-rs/core/src/skills/mod.rs', 'codex-rs/core/src/agent/mod.rs',
  'codex-rs/core/src/session/turn.rs', 'codex-rs/core/src/session/session.rs',
  'codex-rs/core/src/agent/control.rs', 'codex-rs/codex-home/src/instructions/mod.rs',
  'codex-rs/prompts/src/model_instructions.rs', 'codex-rs/prompts/src/permissions_instructions.rs',
  'codex-rs/prompts/src/multi_agent_instructions.rs'];
async function safeDirectory(relative) {
  let dir = root;
  for (const part of relative.split('/')) {
    invariant(part && part !== '..' && part !== '.', 'Caminho de cache inválido'); dir = path.join(dir, part);
    await mkdir(dir).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const stat = await lstat(dir); invariant(stat.isDirectory() && !stat.isSymbolicLink(), 'Cache deve conter diretórios reais');
  }
  return dir;
}
function get(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'YZZY-public-source-study', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`HTTP ${response.statusCode}: ${url}`)); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 4 * 1024 * 1024) response.destroy(new Error('Fonte excede 4 MiB')); else chunks.push(chunk); });
      response.on('error', reject); response.on('end', () => resolve(Buffer.concat(chunks)));
    }); request.on('error', reject);
  });
}
if (process.argv.includes('--verify')) {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  for (const file of manifest.files) {
    const cached = await readFile(path.join(root, '.yzzy/research/codex', manifest.commit, file.path));
    invariant(hash(cached) === file.sha256, `Hash divergente: ${file.path}`);
  }
  console.log(JSON.stringify({ verified: manifest.files.length, commit: manifest.commit }));
} else {
  invariant(process.argv.includes('--refresh'), 'Use --refresh (rede) ou --verify (somente cache local)');
  const meta = JSON.parse(await get(`https://api.github.com/repos/openai/codex/git/tags/${tagObject}`));
  invariant(meta.tag === tag && meta.object.type === 'commit', 'Objeto de tag inesperado');
  const commit = meta.object.sha; invariant(/^[0-9a-f]{40}$/.test(commit), 'Commit inválido');
  const tree = JSON.parse(await get(`https://api.github.com/repos/openai/codex/git/trees/${commit}?recursive=1`));
  invariant(!tree.truncated, 'Árvore upstream truncada');
  const available = new Set(tree.tree.filter(item => item.type === 'blob').map(item => item.path));
  const manifest = { repository: 'https://github.com/openai/codex', packageVersion: '0.163.0', tag, tagObject, commit,
    retrievedAt: new Date().toISOString(), method: 'Pinned public source; SHA-256 of unmodified bytes; no upstream execution.',
    files: [], missing: wanted.filter(file => !available.has(file)),
    relatedPaths: [...available].filter(file => /(?:project_doc|codex\/mod\.rs|skills\/mod\.rs|agent_loop|instructions)/.test(file) && file.endsWith('.rs')).slice(0, 80) };
  for (const file of wanted.filter(file => available.has(file))) {
    const url = `https://raw.githubusercontent.com/openai/codex/${commit}/${file}`;
    const bytes = await get(url);
    const parent = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    const directory = await safeDirectory(`.yzzy/research/codex/${commit}${parent ? '/' + parent : ''}`);
    const target = path.join(directory, path.basename(file));
    try { const stat = await lstat(target); invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Cache substituído por link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(target, bytes);
    manifest.files.push({ path: file, url, sha256: hash(bytes), bytes: bytes.length, lines: bytes.toString('utf8').split('\n').length });
  }
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ manifest: manifestFile, commit, files: manifest.files.length, missing: manifest.missing }));
}
