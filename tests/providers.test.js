import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider, openaiInput, ollamaInput } from '../src/providers.js';
import { defaults } from '../src/config.js';
import { tools } from '../src/tools.js';
const cfg = provider => ({ ...structuredClone(defaults), provider, model: 'test-model', baseUrl: provider === 'openai' ? 'https://api.openai.com/v1' : defaults.baseUrl });
test('OpenAI Responses preserva itens nativos e correlaciona tool outputs', async () => {
  const native = [{ type: 'reasoning', encrypted_content: 'opaque' }, { type: 'function_call', call_id: 'c1', name: 'read_file', arguments: '{"path":"src/a.js"}', status: 'completed' }];
  let body;
  const provider = createProvider(cfg('openai'), { apiKey: 'fixture-not-real', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); body = JSON.parse(options.body);
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ status: 'completed', model: 'resolved', output: native, usage: { input_tokens: 20, output_tokens: 30 } }), { headers: { 'x-request-id': 'req-1' } });
  } });
  const r = await provider.generate({ system: 'sys', messages: [{ role: 'user', text: 'hello' }], tools });
  assert.equal(body.store, false); assert.equal(body.tools[0].strict, true); assert.equal(body.parallel_tool_calls, false);
  assert.equal(r.calls[0].id, 'c1'); assert.equal(r.requestId, 'req-1');
  const input = openaiInput([{ role: 'assistant', native: r.native }, { role: 'tool', id: 'c1', result: { ok: true } }]);
  assert.equal(input[0].encrypted_content, 'opaque'); assert.equal(input[2].call_id, 'c1');
});
test('não executa JSON parcial ou resposta interrompida e não repete HTTP 429', async () => {
  let count = 0;
  const p = createProvider(cfg('openai'), { apiKey: 'fixture', fetchImpl: async () => { count++; return new Response('rate-limited', { status: 429 }); } });
  await assert.rejects(p.generate({ system: '', messages: [], tools }), /HTTP 429/); assert.equal(count, 1);
  const incomplete = createProvider(cfg('openai'), { apiKey: 'fixture', fetchImpl: async () => new Response(JSON.stringify({ status: 'incomplete', output: [{ type: 'function_call', arguments: '{' }] })) });
  await assert.rejects(incomplete.generate({ system: '', messages: [], tools }), /incompleta/);
});
test('Ollama traduz ferramentas, usa loopback e devolve contagem de tokens', async () => {
  let body;
  const provider = createProvider(cfg('ollama'), { fetchImpl: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat'); body = JSON.parse(options.body);
    return new Response(JSON.stringify({ done: true, done_reason: 'stop', model: 'local', message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'list_files', arguments: {} } }] }, prompt_eval_count: 50, eval_count: 12 }));
  } });
  const r = await provider.generate({ system: 'sys', messages: [], tools });
  assert.equal(body.think, false); assert.equal(body.stream, false); assert.equal(r.calls[0].name, 'list_files'); assert.equal(r.usage.input, 50);
  assert.equal(ollamaInput('sys', [{ role: 'tool', name: 'list_files', result: { files: [] } }])[1].tool_name, 'list_files');
});
test('exige modelo e chave; redirect é bloqueado pelo cliente', () => {
  assert.throws(() => createProvider({ ...cfg('ollama'), model: '' }), /YZZY_MODEL/);
  assert.throws(() => createProvider(cfg('openai'), { apiKey: '' }), /OPENAI_API_KEY/);
});
