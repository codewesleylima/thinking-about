import { readdir, readFile, lstat, mkdir, writeFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hash, invariant } from './util.js';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const portable = value => value.split(path.sep).join('/');
export async function createReplica({ directory, name = 'my-agent', command = 'my-agent' }) {
  invariant(typeof directory === 'string' && directory.trim(), 'Informe --output com um diretório novo');
  invariant(/^[a-z][a-z0-9-]{1,63}$/.test(name), 'name exige 2–64 caracteres npm simples');
  invariant(/^[a-z][a-z0-9-]{1,39}$/.test(command), 'command exige 2–40 caracteres, letras/números/hífen');
  const requested = path.resolve(directory), parent = await realpath(path.dirname(requested));
  const destination = path.join(parent, path.basename(requested));
  const source = await realpath(sourceRoot), relative = path.relative(source, destination);
  invariant(relative && (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)), 'Gere a réplica fora do repositório de origem');
  const files = [];
  const collect = async relativeDirectory => {
    const absolute = path.join(source, relativeDirectory), stat = await lstat(absolute);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(), 'Diretório de origem inválido');
    for (const entry of (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(relativeDirectory, entry.name), info = await lstat(path.join(source, file));
      invariant(!info.isSymbolicLink(), 'A réplica não segue links da origem');
      if (info.isDirectory()) await collect(file);
      else { invariant(info.isFile() && info.nlink === 1 && info.size <= 8 * 1024 * 1024, 'Arquivo de origem inválido/grande'); files.push(file); }
    }
  };
  for (const directoryName of ['src', 'bin', 'docs', 'tests', 'scripts', 'templates']) await collect(directoryName);
  files.push('evaluations/run.js', 'evaluations/tasks.json', 'README.md', 'YZZY.md', 'AGENTS.md',
    'REPLICAR.md', 'GUIA_CIENTIFICO_DE_REPLICACAO.md', 'estudo_agentes_ia_cli_arquitetura_implementacao_validacao.md', 'yzzy.config.json', 'package.json', '.github/workflows/ci.yml');
  // Os diretórios de trabalho, dependências, .git e credenciais nunca integram a lista.
  await mkdir(destination, { mode: 0o700 }); // EEXIST é erro: sem mescla/sobrescrita silenciosa.
  const originalPackage = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  const manifest = { schema: 1, sourceProduct: 'YZZY BLACK', sourceVersion: originalPackage.version,
    generatedAt: new Date().toISOString(), name, command, identity: 'derived-runtime',
    note: 'Alias npm personalizado; identificadores YZZY/.yzzy preservados para rastreabilidade. Sem credenciais ou pesos.', files: [] };
  for (const file of files) {
    const info = await lstat(path.join(source, file));
    invariant(info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size <= 8 * 1024 * 1024, 'Arquivo de origem inválido');
    let bytes = await readFile(path.join(source, file));
    if (file === 'package.json') bytes = Buffer.from(JSON.stringify({ ...originalPackage,
      name, private: true, description: `Agente derivado de YZZY BLACK ${originalPackage.version}`,
      bin: { [command]: 'bin/yzzy.js' }, scripts: { ...originalPackage.scripts,
        'install:cmd': `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/install-path.ps1 -CommandName ${command}` } }, null, 2) + '\n');
    if (file === 'README.md') bytes = Buffer.from(`# ${name}\n\nRéplica independente de YZZY BLACK ${originalPackage.version}. Comando npm: \`${command}\`. A identidade visual/interna YZZY é preservada; personalize seguindo REPLICAR.md. Credenciais não foram copiadas.\n\n` + bytes.toString('utf8'));
    const target = path.join(destination, file); await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx', mode: file.endsWith('.js') && file.startsWith('bin' + path.sep) ? 0o755 : 0o600 });
    manifest.files.push({ path: portable(file), sha256: hash(bytes), bytes: bytes.length });
  }
  // npm não inclui package-lock.json em tarballs. O asset preserva a resolução
  // sem depender do checkout; só a identidade do pacote raiz é adaptada.
  const lock = JSON.parse(await readFile(path.join(source, 'templates/replication/dependency-lock.json'), 'utf8'));
  lock.name = name; lock.version = originalPackage.version;
  lock.packages[''] = { ...lock.packages[''], name, version: originalPackage.version, bin: { [command]: 'bin/yzzy.js' } };
  const lockBytes = Buffer.from(JSON.stringify(lock, null, 2) + '\n');
  await writeFile(path.join(destination, 'package-lock.json'), lockBytes, { flag: 'wx', mode: 0o600 });
  manifest.files.push({ path: 'package-lock.json', sha256: hash(lockBytes), bytes: lockBytes.length });
  await writeFile(path.join(destination, '.gitignore'), 'node_modules/\n.yzzy/\n.wzzy/\n.env\n.env.*\n*.tgz\nevaluations/results/*.json\n', { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(destination, 'replica.manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { directory: destination, files: manifest.files.length, sourceVersion: originalPackage.version,
    command, next: ['npm.cmd ci --ignore-scripts --no-audit --no-fund', 'npm.cmd test', 'npm.cmd run check', 'npm.cmd run evaluate', 'npm.cmd install --global . --ignore-scripts --no-audit --no-fund', 'npm.cmd run install:cmd', `${command} login`, command],
    notice: 'A réplica não instala dependências, não autentica, não executa shell e não publica. Lockfile preserva resoluções e adapta apenas a identidade raiz; licença permanece declarada.' };
}
