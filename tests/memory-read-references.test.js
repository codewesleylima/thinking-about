import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, contextMessages } from '../src/memory.js';

function state(messages) {
  return { objective: 'Investigar sem alterar contratos', messages, evidence: [],
    permissions: { allowWrite: false, allowExec: false },
    pendingTool: null, uncertainEffect: false, modelCalls: 0, toolCalls: 0,
    spent: 0, held: 0, created: 1 };
}

function read(id, name, result) {
  return [
    { role: 'assistant', text: '', calls: [{ id, name, args: { path: result.path } }] },
    { role: 'tool', id, name, result }
  ];
}

test('compactação retém origem de leitura antiga sem conteúdo bruto ou mutação', () => {
  const messages = [{ role: 'user', text: 'Investigue a API.' },
    ...read('old', 'read_file', { ok: true, path: 'src/api.js',
      sha256: 'a'.repeat(64), content: 'CONTEUDO_BRUTO_NAO_COPIAR' })];
  for (let i = 0; i < 6; i++) messages.push(
    { role: 'assistant', text: `Observação ${i}`, calls: [] });
  const input = state(messages);
  const before = structuredClone(input);
  const projection = contextMessages(input, 1e9, true, true);
  assert.equal(projection.compacted, true);
  assert.equal(projection.messages.some(m => m.role === 'tool' && m.id === 'old'), false);
  const summary = JSON.parse(projection.messages[0].text.split('\n').slice(1).join('\n'));
  assert.deepEqual(summary.readReferences, { omitted: 0, items: [
    { invocation: 'old', tool: 'read_file', path: 'src/api.js',
      sha256: 'a'.repeat(64), scope: 'full' }
  ] });
  assert.equal(JSON.stringify(projection).includes('CONTEUDO_BRUTO_NAO_COPIAR'), false);
  assert.deepEqual(input, before);
});

test('referências distinguem trechos, revisões históricas e leitura vazia', () => {
  const input = state([
    ...read('first', 'read_file', { ok: true, path: 'src/a.js', sha256: 'a'.repeat(64), content: 'original' }),
    ...read('lines', 'read_lines', { ok: true, path: 'src/a.js', sha256: 'b'.repeat(64),
      start_line: 3, total_lines: 8, content: '3: alpha\n4: beta', more: true }),
    ...read('empty', 'read_lines', { ok: true, path: 'src/a.js', sha256: 'b'.repeat(64),
      start_line: 20, total_lines: 8, content: '', more: false })
  ]);
  assert.deepEqual(summarize(input).readReferences, { omitted: 0, items: [
    { invocation: 'first', tool: 'read_file', path: 'src/a.js', sha256: 'a'.repeat(64), scope: 'full' },
    { invocation: 'lines', tool: 'read_lines', path: 'src/a.js', sha256: 'b'.repeat(64),
      scope: 'lines', start_line: 3, end_line: 4, total_lines: 8, more: true },
    { invocation: 'empty', tool: 'read_lines', path: 'src/a.js', sha256: 'b'.repeat(64),
      scope: 'lines', start_line: 20, end_line: null, total_lines: 8, more: false }
  ] });
});

test('índice mantém só as últimas 24 leituras exitosas e explicita omissões', () => {
  const messages = [];
  for (let i = 0; i < 27; i++) messages.push(...read(String(i), 'read_file',
    { ok: true, path: `src/${i}.js`, sha256: 'a'.repeat(64), content: 'x' }));
  messages.push(...read('failed', 'read_file', { ok: false, path: 'src/missing.js', error: 'ausente' }));
  messages.push(...read('write', 'create_file', { ok: true, path: 'src/new.js', sha256: 'b'.repeat(64) }));
  const refs = summarize(state(messages)).readReferences;
  assert.equal(refs.omitted, 3);
  assert.deepEqual(refs.items.map(item => item.invocation),
    Array.from({ length: 24 }, (_, i) => String(i + 3)));
  assert.deepEqual(summarize(state([])).readReferences, { omitted: 0, items: [] });
});
