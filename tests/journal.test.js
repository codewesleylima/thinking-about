import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { makeFixture } from '../src/demo.js';
import { Journal, lockWorkspace, listSessions } from '../src/journal.js';
import { clean, redact } from '../src/util.js';
test('journal encadeado detecta adulteração e cauda incompleta', async () => {
  const { root } = await makeFixture(); const j = await Journal.create(root);
  await j.append('created', { status: 'running' }); await j.append('finished', { status: 'completed_unverified' });
  assert.equal((await Journal.load(root, j.id)).events.length, 2);
  const good = await readFile(j.file, 'utf8');
  await writeFile(j.file, good.replace('completed_unverified', 'verified'));
  await assert.rejects(Journal.load(root, j.id), /Integridade/);
  await writeFile(j.file, good); await appendFile(j.file, '{');
  await assert.rejects(Journal.load(root, j.id), /cauda incompleta/);
});
test('lock exclui controladores concorrentes e sessões são listadas', async () => {
  const { root } = await makeFixture(); const unlock = await lockWorkspace(root);
  await assert.rejects(lockWorkspace(root), /ocupado/); await unlock();
  const j = await Journal.create(root); await j.append('created', { status: 'running', objective: 'fixture' });
  assert.equal((await listSessions(root))[0].id, j.id);
  await assert.rejects(Journal.load(root, '../../x'), /ID/);
});
test('redige credenciais conhecidas e remove controles do terminal', () => {
  process.env.WZZY_TEST_SECRET = 'unique-canary-12345';
  try { assert.equal(redact('value=unique-canary-12345'), 'value=[REDACTED]'); }
  finally { delete process.env.WZZY_TEST_SECRET; }
  assert.equal(clean('\x1b[31mred\x1b[0m\x00'), 'red');
});
