import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { retrieveLearnings } from '../src/learning.js';
import { canonical, hash } from '../src/util.js';

// Regressão lexical sintética: não usa rede, inferência ou testes originais.
const now = Date.parse('2026-10-23T12:00:00.000Z');
const config = { limits: { maxContextBytes: 80000 },
  documentation: { allowedHosts: ['docs.oracle.com'] } };
const late = word => 'eco '.repeat(80) + word;
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
const ids = items => items.map(item => item.id);

async function fixture(t, lessons) {
  for (const item of lessons) {
    for (const [field, max] of Object.entries({ topic: 2000, title: 200, summary: 1800, verification: 1200, limits: 1200 })) {
      assert.ok(Buffer.byteLength(item[field]) <= max, `fixture excede ${field}`);
    }
    assert.ok(item.steps.length >= 1 && item.steps.length <= 8);
    assert.ok(item.steps.every(step => Buffer.byteLength(step) <= 800));
  }
  const root = await mkdtemp(path.join(tmpdir(), 'yzzy-learning-late-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('yzzy-learning-late-'));
    await rm(resolved, { recursive: true, force: true });
  });
  await mkdir(path.join(root, '.yzzy'));
  await writeFile(path.join(root, '.yzzy', 'learning.json'), JSON.stringify({
    version: 1, lessons, sha256: hash(canonical(lessons))
  }));
  return query => retrieveLearnings(root, query, config, now);
}

for (const field of ['topic', 'summary', 'verification', 'limits', ...Array.from({ length: 8 }, (_, i) => `step${i}`)]) {
  test(`examina termo após 80 ocorrências em ${field}`, async t => {
    const overrides = field.startsWith('step')
      ? { steps: Array.from({ length: 8 }, (_, i) => i === Number(field.slice(4)) ? late('ÍNDICE') : 'Documento') }
      : { [field]: late('ÍNDICE') };
    const item = lesson(overrides);
    const retrieve = await fixture(t, [item]);
    assert.deepEqual(ids(await retrieve('indice')), [item.id]);
    if (field === 'topic' || field === 'summary') {
      assert.deepEqual(ids(await retrieve('indice inexistente')), [item.id], 'OR principal');
    } else {
      assert.deepEqual(await retrieve('indice inexistente'), [], 'AND adicional');
    }
  });
}

for (const field of ['title', 'summary']) {
  test(`tema extenso não oculta ${field}`, async t => {
    const item = lesson({ topic: late('documento'), [field]: 'ÍNDICE' });
    const retrieve = await fixture(t, [item]);
    assert.deepEqual(ids(await retrieve('indice inexistente')), [item.id]);
  });
}

test('AND reúne termos tardios de todos os passos, verificação e limites', async t => {
  const item = lesson({ steps: Array.from({ length: 8 }, (_, i) => late(`alvo${i}`)),
    verification: late('consistência'), limits: late('replicação') });
  const retrieve = await fixture(t, [item]);
  const query = 'alvo0 alvo1 alvo2 alvo3 alvo4 alvo5 alvo6 alvo7 consistencia replicacao';
  assert.deepEqual(ids(await retrieve(query)), [item.id]);
  assert.deepEqual(await retrieve(query + ' inexistente'), []);
});

test('consulta corta 80 ocorrências relevantes antes de deduplicar', async t => {
  const item = lesson({ title: 'ÍNDICE' });
  const retrieve = await fixture(t, [item]);
  assert.deepEqual(ids(await retrieve('eco '.repeat(79) + 'indice')), [item.id]);
  assert.deepEqual(await retrieve('eco '.repeat(80) + 'indice'), []);
  assert.deepEqual(ids(await retrieve('faça para como com projeto '.repeat(100) + 'ÍNDICE')), [item.id]);
  assert.deepEqual(await retrieve('faça para como com projeto '.repeat(100)), []);
});

test('repetições não aumentam score nem somam campos adicionais ao principal', async t => {
  const older = lesson({ topic: late('alfa alfa alfa'), title: 'alfa', summary: 'alfa',
    steps: ['beta'], verification: 'beta', limits: 'beta',
    createdAt: new Date(now - 3000).toISOString() });
  const newer = lesson({ topic: 'alfa', createdAt: new Date(now - 2000).toISOString() });
  const double = lesson({ summary: late('alfa beta'), createdAt: new Date(now - 4000).toISOString() });
  const retrieve = await fixture(t, [older, newer, double]);
  assert.deepEqual(ids(await retrieve('alfa beta alfa')), [double.id, newer.id, older.id]);
});
