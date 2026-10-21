import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, symlink, link, readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { Workspace } from '../src/workspace.js';
import { hash } from '../src/util.js';
const setup = async (write = true) => { const f = await makeFixture(); return { ...f, ws: new Workspace(f.root, f.config, { allowWrite: write }) }; };

test('leitura retorna hash dos bytes e linhas numeradas', async () => {
  const { ws } = await setup(); const read = await ws.read('src/eligibility.js');
  assert.equal(read.sha256, hash(read.content));
  assert.match((await ws.lines('src/eligibility.js', 1, 1)).content, /^1: export/);
});
test('nega traversal, caminhos absolutos, ADS, nomes Windows e segredos', async () => {
  const { ws } = await setup();
  for (const file of ['../escape', '/tmp/x', 'C:/x', 'src/../x', 'src\\x', 'src/x:stream', '.env', '.env.local', '.aws/credentials', 'src/API_SECRET.txt', 'src/key.pem', 'src/NUL.txt', 'src/x.']) {
    await assert.rejects(ws.resolve(file), undefined, file);
  }
});
test('rejeita symlink/junction e hardlink', async t => {
  const { ws, root } = await setup();
  await link(path.join(root, 'src/eligibility.js'), path.join(root, 'src/hard.js'));
  await assert.rejects(ws.read('src/hard.js'), /hardlink/);
  try { await symlink(path.join(root, 'src'), path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if (e.code === 'EPERM') { t.diagnostic('Symlink não autorizado pelo SO; hardlink foi testado'); return; } throw e; }
  await assert.rejects(ws.read('alias/eligibility.js'), /Links/);
});
test('edição exige autorização e writeRoots; arquivos de controle protegidos', async () => {
  const { ws, root, config } = await setup(false);
  const read = await ws.read('src/eligibility.js');
  await assert.rejects(ws.replace({ path: read.path, expected_sha256: read.sha256, old_text: 'age > 18', new_text: 'true' }), /allow-write/);
  const writable = new Workspace(root, config, { allowWrite: true });
  for (const file of ['README.md', 'src/YZZY.md', 'src/AGENTS.md', 'evaluations/grader.js']) await assert.rejects(writable.create({ path: file, content: 'x' }));
});
test('hash obsoleto preserva alteração humana; substituição ambígua é rejeitada', async () => {
  const { ws, root } = await setup(); const before = await ws.read('src/eligibility.js');
  await writeFile(path.join(root, before.path), 'human change\n');
  await assert.rejects(ws.replace({ path: before.path, expected_sha256: before.sha256, old_text: 'age > 18', new_text: 'age >= 18' }), /Conflito/);
  assert.equal((await ws.read(before.path)).content, 'human change\n');
  await writeFile(path.join(root, before.path), 'x x');
  const now = await ws.read(before.path);
  await assert.rejects(ws.replace({ path: now.path, expected_sha256: now.sha256, old_text: 'x', new_text: 'y' }), /exatamente uma/);
});
test('preserva CRLF e trata $ de replacement como texto literal', async () => {
  const { ws, root } = await setup(); await writeFile(path.join(root, 'src/a.txt'), 'alpha\r\nbeta\r\n');
  const before = await ws.read('src/a.txt');
  await ws.replace({ path: before.path, expected_sha256: before.sha256, old_text: 'beta', new_text: '$&' });
  assert.equal(await readFile(path.join(root, 'src/a.txt'), 'utf8'), 'alpha\r\n$&\r\n');
});
test('create_file não sobrescreve e snapshot exclui credenciais e estado', async () => {
  const { ws, root } = await setup();
  await assert.rejects(ws.create({ path: 'src/eligibility.js', content: 'overwrite' }), { code: 'EEXIST' });
  await writeFile(path.join(root, '.env'), 'CANARY_SECRET=abc');
  await mkdir(path.join(root, '.yzzy')); await writeFile(path.join(root, '.yzzy/state'), 'private');
  const snapshot = await ws.snapshot(); assert.equal(snapshot.files, 1);
  const old = snapshot.revision; await ws.create({ path: 'src/new.js', content: 'new' });
  assert.notEqual((await ws.snapshot()).revision, old);
});
test('busca literal não interpreta regex e sinaliza truncamento de scan', async () => {
  const { ws, config } = await setup();
  assert.equal((await ws.search('age >')).matches[0].line, 1);
  assert.equal((await ws.search('.*')).matches.length, 0);
  config.limits.maxScanFiles = 1;
  assert.equal((await ws.list()).truncated, true);
  await assert.rejects(ws.snapshot(), /maxScanFiles/);
});
test('edição preserva BOM UTF-8 e criação não aceita bytes NUL', async () => {
  const { ws, root } = await setup();
  await writeFile(path.join(root, 'src/bom.txt'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('before\r\n')]));
  const read = await ws.read('src/bom.txt');
  await ws.replace({ path: read.path, expected_sha256: read.sha256, old_text: 'before', new_text: 'after' });
  const bytes = await readFile(path.join(root, 'src/bom.txt'));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  await assert.rejects(ws.create({ path: 'src/binary-content.txt', content: '\0' }), /Conteúdo/);
});
