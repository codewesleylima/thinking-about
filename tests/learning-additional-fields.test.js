import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { retrieveLearnings } from '../src/learning.js';
import { canonical, hash } from '../src/util.js';

// Dados sintéticos: sem rede, inferência ou alteração dos testes originais.
const now = Date.parse('2026-10-23T12:00:00.000Z');
const config = { limits: { maxContextBytes: 80000 },
  documentation: { allowedHosts: ['docs.oracle.com'] } };
const lesson = (overrides = {}) => ({
  id: randomUUID(), session: randomUUID(), topic: 'Auditoria documental',
  title: 'Preservar evidências', summary: 'Conferir documentos disponíveis.',
  steps: ['Inspecionar documentos.'], verification: 'Comparar resultados.',
  limits: 'Procedimento simulado.', validation: 'provenance_only',
  createdAt: new Date(now - 1000).toISOString(),
  expiresAt: new Date(now + 86400000).toISOString(),
  sources: [{ url: 'https://docs.oracle.com/en/java/', quote: 'Fonte sintética para regressão.',
    sha256: hash('fonte sintética'), retrievedAt: new Date(now).toISOString() }],
  ...overrides
});

async function fixture(t, lessons) {
  const root = await mkdtemp(path.join(tmpdir(), 'yzzy-learning-fields-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yzzy-learning-fields-'));
    await rm(resolved, { recursive: true, force: true });
  });
  await mkdir(path.join(root, '.yzzy'));
  await writeFile(path.join(root, '.yzzy', 'learning.json'), JSON.stringify({
    version: 1, lessons, sha256: hash(canonical(lessons))
  }));
  return (query, options = config, time = now) => retrieveLearnings(root, query, options, time);
}
const ids = items => items.map(item => item.id);

for (const field of ['steps', 'verification', 'limits']) {
  test(`recupera consulta completa exclusivamente em ${field}`, async t => {
    const item = lesson({ [field]: field === 'steps' ? ['Validar ÍNDICE VETORIAL.'] : 'Validar ÍNDICE VETORIAL.' });
    const retrieve = await fixture(t, [item]);
    assert.deepEqual(ids(await retrieve('faça indice vetorial')), [item.id]);
    assert.deepEqual(ids(await retrieve('VETORIAL')), [item.id]);
    assert.deepEqual(await retrieve('indice ausente'), []);
    assert.deepEqual(await retrieve('faça como para com projeto'), []);
    assert.deepEqual(await retrieve('de e a'), []);
    assert.deepEqual(await retrieve(''), []);
  });
}

test('AND adicional reúne termos entre passos, verificação e limites', async t => {
  const item = lesson({ steps: ['Conferir índice.', 'Medir latência.'],
    verification: 'Validar consistência.', limits: 'Considerar replicação.' });
  const retrieve = await fixture(t, [item]);
  assert.deepEqual(ids(await retrieve('indice latencia consistencia replicacao')), [item.id]);
  assert.deepEqual(await retrieve('indice latencia consistencia inexistente'), []);
  assert.deepEqual(await retrieve('indices'), []);
});

test('campos tardios não são ocultados por passos extensos', async t => {
  const words = Array.from({ length: 80 }, (_, i) => `pal${i}`).join(' ');
  const item = lesson({ steps: [words, 'Diagnóstico'], verification: 'Consistência', limits: 'Replicação' });
  const retrieve = await fixture(t, [item]);
  assert.deepEqual(ids(await retrieve('diagnostico consistencia replicacao')), [item.id]);
});

test('receita em limits não corresponde a receita de bolo', async t => {
  const item = lesson({ limits: 'Receita não executada.' });
  const retrieve = await fixture(t, [item]);
  assert.deepEqual(await retrieve('receita de bolo'), []);
  assert.deepEqual(ids(await retrieve('receita')), [item.id]);
});

for (const field of ['topic', 'title', 'summary']) {
  test(`preserva OR principal em ${field}, mesmo com correspondência adicional parcial`, async t => {
    const item = lesson({ [field]: 'Bytecode', limits: 'Receita simulada.' });
    const retrieve = await fixture(t, [item]);
    assert.deepEqual(ids(await retrieve('bytecode receita bolo')), [item.id]);
  });
}

test('preserva pontuação principal, desempate por data e limite de três lições', async t => {
  const older = lesson({ topic: 'Java bytecode', createdAt: new Date(now - 3000).toISOString() });
  const newer = lesson({ topic: 'Java bytecode', createdAt: new Date(now - 2000).toISOString() });
  const single = lesson({ topic: 'Java', steps: ['Bytecode'], verification: 'Javap',
    createdAt: new Date(now - 1000).toISOString() });
  const fallback = lesson({ steps: ['Javap'] });
  const retrieve = await fixture(t, [single, older, fallback, newer]);
  // Os campos adicionais não aumentam a pontuação de uma correspondência principal.
  assert.deepEqual(ids(await retrieve('java bytecode javap')), [newer.id, older.id, single.id]);
  const additional = Array.from({ length: 4 }, (_, i) => lesson({ limits: 'Vetorial',
    createdAt: new Date(now - i * 1000).toISOString() }));
  const retrieveAdditional = await fixture(t, additional.toReversed());
  assert.deepEqual(ids(await retrieveAdditional('vetorial')), ids(additional.slice(0, 3)));
});

test('fallback preserva expiração, todas as fontes da allowlist e orçamento em bytes', async t => {
  const active = lesson({ limits: 'Vetorial: ação segura.' });
  const expired = lesson({ limits: 'Vetorial', expiresAt: new Date(now).toISOString() });
  const denied = lesson({ limits: 'Vetorial', sources: [...active.sources,
    { ...active.sources[0], url: 'https://example.com/docs' }] });
  const retrieve = await fixture(t, [expired, denied, active]);
  const result = await retrieve('vetorial');
  assert.deepEqual(ids(result), [active.id]);
  assert.equal(result[0].validation, 'provenance_only');
  assert.equal(result[0].status, 'active');
  assert.deepEqual(await retrieve('vetorial', config, now + 86400000), []);
  const noHosts = structuredClone(config); noHosts.documentation.allowedHosts = [];
  assert.deepEqual(await retrieve('vetorial', noHosts), []);
  const exact = structuredClone(config);
  const bytes = Buffer.byteLength(JSON.stringify(result));
  exact.limits.maxContextBytes = bytes * 8;
  assert.deepEqual(ids(await retrieve('vetorial', exact)), [active.id]);
  exact.limits.maxContextBytes = (bytes - 1) * 8;
  assert.deepEqual(await retrieve('vetorial', exact), []);
  const capped = lesson({ steps: Array(8).fill('vetorial ' + 'á'.repeat(380)),
    summary: 'á'.repeat(850), verification: 'á'.repeat(590), limits: 'á'.repeat(590) });
  const retrieveCapped = await fixture(t, [capped]);
  const largeContext = structuredClone(config); largeContext.limits.maxContextBytes = 800000;
  assert.ok(Buffer.byteLength(JSON.stringify([{ ...capped, status: 'active' }])) > 10000);
  assert.deepEqual(await retrieveCapped('vetorial', largeContext), []);
});
