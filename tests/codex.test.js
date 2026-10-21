import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CodexRpc } from '../src/codex-rpc.js';
import { createCodexProvider } from '../src/codex-provider.js';
import { defaults } from '../src/config.js';
import { tools } from '../src/tools.js';

function fakeChild() {
  const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => { child.killed = true; }; return child;
}
test('RPC correlaciona fragmentos e recusa aprovações nativas', async () => {
  const child = fakeChild(), rpc = new CodexRpc(child); let sent = '';
  child.stdin.on('data', chunk => sent += chunk);
  const request = rpc.request('model/list', {});
  child.stdout.write('{"id":1,"res'); child.stdout.write('ult":{"data":[]}}\n');
  assert.deepEqual(await request, { data: [] });
  child.stdout.write('{"id":99,"method":"item/commandExecution/requestApproval","params":{}}\n');
  assert.equal(JSON.parse(sent.trim().split('\n').at(-1)).result.decision, 'decline');
  const pending = rpc.request('thread/start', {}); rpc.close(); rpc.close();
  await assert.rejects(pending, /encerrada/); assert.equal(child.killed, true); assert.equal(rpc.pending.size, 0);
});
test('RPC encerra em JSON malformado e em deadline de requisição', async () => {
  const child = fakeChild(), rpc = new CodexRpc(child);
  const pending = rpc.request('initialize', {}); child.stdout.write('INVALID\n');
  await assert.rejects(pending, SyntaxError); assert.equal(child.killed, true);
  const other = new CodexRpc(fakeChild()); await assert.rejects(other.request('hung', {}, 5), /Timeout/); other.close();
});
function backend({ account = true, native = false, mcp = { docs: {} }, text = '{"text":"feito","calls":[]}' } = {}) {
  const requests = [], rpc = { listeners: new Set(), closed: false,
    close() { this.closed = true; }, async request(method, params) {
      requests.push({ method, params });
      if (method === 'account/read') return { account: account ? { type: 'chatgpt' } : null };
      if (method === 'config/read') return { config: { mcp_servers: mcp } };
      if (method === 'thread/start') return { thread: { id: 't' }, model: 'test-model' };
      if (method === 'turn/start') {
        queueMicrotask(() => {
          const events = native ? [{ method: 'item/started', params: { threadId: 't', item: { type: 'commandExecution' } } }] : [
            { method: 'item/completed', params: { threadId: 't', item: { type: 'agentMessage', text } } },
            { method: 'thread/tokenUsage/updated', params: { threadId: 't', tokenUsage: { total: { inputTokens: 10, outputTokens: 2 } } } },
            { method: 'turn/completed', params: { threadId: 't', turn: { status: 'completed' } } } ];
          for (const event of events) for (const listener of rpc.listeners) listener(event);
        });
        return { turn: { id: 'turn' } };
      }
      return {};
    } };
  return { rpc, requests, startRpc: async (cwd, args) => { assert.match(cwd, /yzzy-inference-/); assert.ok(args.includes('features.shell_tool=false')); return rpc; } };
}
const input = { system: 'instruções', messages: [{ role: 'user', text: 'tarefa' }], tools };
test('adaptador Codex usa somente propostas, isola cwd e desabilita MCPs', async () => {
  const fake = backend(); const result = await createCodexProvider(defaults, fake).generate(input);
  assert.equal(result.text, 'feito'); assert.equal(result.billing, 'managed_by_codex'); assert.deepEqual(result.usage, { input: 10, output: 2 });
  const thread = fake.requests.find(r => r.method === 'thread/start').params;
  assert.equal(thread.sandbox, 'read-only'); assert.equal(thread.approvalPolicy, 'never'); assert.equal(thread.ephemeral, true);
  assert.equal(thread.config['mcp_servers.docs.enabled'], false); assert.equal(thread.config['features.hooks'], false);
  assert.equal(fake.requests.find(r => r.method === 'turn/start').params.outputSchema.properties.calls.maxItems, 1);
  assert.equal(fake.rpc.closed, true);
});
test('adaptador rejeita ferramentas nativas, login ausente, nomes MCP ambíguos e saída excessiva', async () => {
  for (const [options, message] of [[{ native: true }, /nativa/], [{ account: false }, /yzzy login/], [{ mcp: { 'a.b': {} } }, /MCP/], [{ text: 'x'.repeat(defaults.limits.maxFileBytes + 1) }, /limite/]]) {
    const fake = backend(options);
    await assert.rejects(createCodexProvider(defaults, fake).generate(input), message); assert.equal(fake.rpc.closed, true);
  }
});
