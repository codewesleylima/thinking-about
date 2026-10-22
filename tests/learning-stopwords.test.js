import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { makeFixture } from '../src/demo.js';
import { runElevation } from '../src/elevation.js';
import { listLearnings, retrieveLearnings } from '../src/learning.js';
import { hash } from '../src/util.js';

test('recuperação ignora faça normalizado sem perder correspondência relevante', async t => {
  const f = await makeFixture();
  t.after(async () => {
    const resolved = path.resolve(f.root);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yzzy-demo-'));
    await rm(resolved, { recursive: true, force: true });
  });
  // Fonte e provedor simulados: este teste não acessa rede nem avalia um modelo real.
  const url = 'https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html';
  const quote = 'The javap command disassembles one or more class files.';
  const source = { url, content: quote, sha256: hash(quote),
    retrievedAt: '2026-10-21T00:00:00.000Z', untrusted: true, truncated: false };
  const lesson = { title: 'Conferência documental', summary: 'Preservar evidências verificáveis.',
    steps: ['Conferir documentos antes de concluir.'], verification: 'Comparar evidências disponíveis.',
    limits: 'Dados simulados para testar recuperação.', sources: [{ url, quote }] };
  const responses = [
    { text: '', calls: [{ id: 'source', name: 'read_documentation', args: { url } }] },
    { text: JSON.stringify({ lessons: [lesson] }), calls: [] }
  ];
  let step = 0;
  const result = await runElevation({ ...f, topic: 'Faça auditoria',
    documentationReader: async () => source,
    provider: { async generate() {
      assert.ok(step < responses.length, 'chamada inesperada ao provedor simulado');
      return responses[step++];
    } } });

  assert.equal(result.state.status, 'completed_unverified');
  assert.equal(result.learned.length, 1);
  const persisted = await listLearnings(f.root);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, result.learned[0].id);
  assert.equal(persisted[0].topic, 'Faça auditoria');
  assert.equal(persisted[0].status, 'active');

  for (const query of ['faça receita bolo', 'faca receita bolo', 'FAÇA receita bolo']) {
    assert.deepEqual(await retrieveLearnings(f.root, query, f.config), [], query);
  }
  const relevant = await retrieveLearnings(f.root, 'auditoria', f.config);
  assert.deepEqual(relevant.map(item => item.id), [persisted[0].id]);
});
