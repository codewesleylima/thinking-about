import { randomUUID } from 'node:crypto';
import { invariant } from './util.js';
import { createCodexProvider } from './codex-provider.js';

export function openaiInput(messages) {
  return messages.flatMap(message => {
    if (message.role === 'user') return [{ role: 'user', content: message.text }];
    if (message.role === 'tool') return [{ type: 'function_call_output', call_id: message.id, output: JSON.stringify(message.result) }];
    return message.native || [{ role: 'assistant', content: message.text }];
  });
}
export function ollamaInput(system, messages) {
  return [{ role: 'system', content: system }, ...messages.map(m => {
    if (m.role === 'tool') return { role: 'tool', tool_name: m.name, content: JSON.stringify(m.result) };
    if (m.role === 'user') return { role: 'user', content: m.text };
    return { role: 'assistant', content: m.text || '', ...(m.calls?.length ? { tool_calls: m.calls.map(c => ({ function: { name: c.name, arguments: c.args } })) } : {}) };
  })];
}
async function post(url, body, { signal, headers = {}, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal,
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  // Não inclui o corpo do erro: gateways podem ecoar dados e credenciais.
  invariant(response.ok, `Provedor respondeu HTTP ${response.status}; requisição não repetida automaticamente`);
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      invariant(size <= 4 * 1024 * 1024, 'Resposta do provedor excede 4 MiB'); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return { data: JSON.parse(Buffer.concat(chunks).toString('utf8')), requestId: response.headers.get('x-request-id') };
}
export function createProvider(config, { fetchImpl = fetch, apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (config.provider === 'codex') return createCodexProvider(config);
  invariant(config.model.trim(), 'Defina YZZY_MODEL ou model na configuração');
  if (config.provider === 'openai') {
    invariant(apiKey, 'OPENAI_API_KEY não definida');
    return {
      async generate({ system, messages, tools, signal }) {
        const { data, requestId } = await post(config.baseUrl.replace(/\/$/, '') + '/responses', {
          model: config.model, instructions: system, input: openaiInput(messages),
          tools: tools.map(t => ({ type: 'function', ...t, strict: true })),
          max_output_tokens: config.limits.maxOutputTokens, parallel_tool_calls: false,
          store: false, include: ['reasoning.encrypted_content']
        }, { signal, fetchImpl, headers: { authorization: `Bearer ${apiKey}` } });
        invariant(data.status === 'completed' && Array.isArray(data.output), 'Resposta incompleta do modelo; nenhuma ferramenta executada');
        const calls = data.output.filter(x => x.type === 'function_call').map(x => {
          invariant(x.status === undefined || x.status === 'completed', 'Chamada parcial rejeitada');
          return { id: x.call_id, name: x.name, args: JSON.parse(x.arguments) };
        });
        return { text: data.output.filter(x => x.type === 'message').flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n'),
          calls, native: data.output, resolvedModel: data.model, requestId,
          usage: data.usage ? { input: data.usage.input_tokens, output: data.usage.output_tokens, cached: data.usage.input_tokens_details?.cached_tokens || 0 } : null };
      }
    };
  }
  invariant(config.provider === 'ollama', 'Provedor scripted só pode ser injetado por testes/demo');
  return {
    async generate({ system, messages, tools, signal }) {
      const { data } = await post(config.baseUrl.replace(/\/$/, '') + '/api/chat', {
        model: config.model, messages: ollamaInput(system, messages), stream: false, think: false,
        tools: tools.map(t => ({ type: 'function', function: t })),
        options: { num_predict: config.limits.maxOutputTokens }
      }, { signal, fetchImpl });
      invariant(data.done === true && data.message?.role === 'assistant' && data.done_reason !== 'length', 'Resposta Ollama incompleta');
      return { text: data.message.content || '', resolvedModel: data.model,
        calls: (data.message.tool_calls || []).map(c => ({ id: randomUUID(), name: c.function.name, args: c.function.arguments })),
        usage: { input: data.prompt_eval_count, output: data.eval_count } };
    }
  };
}
