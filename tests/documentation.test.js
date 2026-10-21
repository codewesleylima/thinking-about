import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../src/config.js';
import { readDocumentation, documentationUrl, publicAddress } from '../src/documentation.js';
import { decide, validateCall } from '../src/tools.js';
import { makeFixture } from '../src/demo.js';
import { runAgent } from '../src/agent.js';

test('documentação exige permissão e URLs HTTPS de domínio exato', () => {
  const args = { url: 'https://docs.oracle.com/en/java/' };
  validateCall('read_documentation', args);
  assert.equal(decide('read_documentation', args, {}, defaults).effect, 'deny');
  assert.equal(decide('read_documentation', args, { allowNetwork: true }, defaults).effect, 'allow');
  for (const url of ['http://docs.oracle.com/', 'https://docs.oracle.com.evil.org/', 'https://127.0.0.1/', 'https://docs.oracle.com:444/', 'https://user@docs.oracle.com/', 'https://docs.oracle.com/?token=x', 'https://docs.oracle.com/#x', 'https://docs.oracle.com/%0dtest']) {
    assert.throws(() => documentationUrl(url, defaults.documentation.allowedHosts), undefined, url);
  }
});
test('endereços locais/especiais e rebinding são recusados antes da conexão', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.64.0.1', '192.168.1.2', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('93.184.216.34'), true); assert.equal(publicAddress('2606:4700:4700::1111'), true);
  let connected = false;
  await assert.rejects(readDocumentation('https://docs.oracle.com/', defaults, {
    resolve: async () => [{ address: '93.184.216.34' }, { address: '127.0.0.1' }], request: async () => { connected = true; }
  }), /DNS recusado/);
  assert.equal(connected, false);
});
test('redirecionamento revalida domínio e fonte inclui proveniência/truncamento', async () => {
  const resolve = async () => [{ address: '93.184.216.34' }];
  await assert.rejects(readDocumentation('https://docs.oracle.com/', defaults, { resolve, request: async () => ({ redirect: 'https://localhost/admin' }) }), /não autorizado/);
  let requests = 0;
  const config = structuredClone(defaults); config.limits.maxOutputBytes = 2500;
  const result = await readDocumentation('https://docs.oracle.com/', config, { resolve, request: async (url, ip, family) => {
    assert.equal(ip, '93.184.216.34'); assert.equal(family, 4);
    return requests++ === 0 ? { redirect: '/en/java/' } : { bytes: Buffer.from('<script>bad()</script><h1>Java</h1>' + 'x'.repeat(4000)), type: 'text/html' };
  } });
  assert.equal(result.url, 'https://docs.oracle.com/en/java/'); assert.equal(result.untrusted, true);
  assert.equal(result.truncated, true); assert.match(result.content, /Java/); assert.doesNotMatch(result.content, /bad/);
  assert.match(result.sha256, /^[a-f0-9]{64}$/); assert.ok(result.retrievedAt);
});
test('controle real do agente nega rede sem chamar transporte e continua com erro estruturado', async () => {
  const f = await makeFixture(); let step = 0;
  const result = await runAgent({ ...f, objective: 'Leia docs', provider: { async generate() {
    return step++ === 0 ? { text: '', calls: [{ id: 'doc', name: 'read_documentation', args: { url: 'https://docs.oracle.com/' } }] } : { text: 'Sem permissão de rede', calls: [] };
  } } });
  assert.equal(result.state.messages.find(m => m.role === 'tool').result.ok, false);
  assert.match(result.state.messages.find(m => m.role === 'tool').result.error, /allow-network/);
});

test('limite considera JSON escapado e cancelamento não espera resolver DNS pendente', async () => {
  const config = structuredClone(defaults); config.limits.maxOutputBytes = 4096;
  const result = await readDocumentation('https://docs.oracle.com/', config, {
    resolve: async () => [{ address: '93.184.216.34' }],
    request: async () => ({ bytes: Buffer.from('"\\\n'.repeat(4000)), type: 'text/plain' })
  });
  assert.ok(Buffer.byteLength(JSON.stringify({ ok: true, ...result })) <= 4096);
  assert.equal(result.truncated, true);
  const controller = new AbortController(); let lookupStarted;
  const started = new Promise(resolve => { lookupStarted = resolve; });
  const pending = readDocumentation('https://docs.oracle.com/', config, {
    signal: controller.signal, resolve: () => { lookupStarted(); return new Promise(() => {}); },
    request: () => { throw new Error('Transporte não deveria ser chamado'); }
  });
  await started; controller.abort(new Error('Cancelamento durante DNS'));
  await assert.rejects(pending, /Cancelamento durante DNS/);
});
