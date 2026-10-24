import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validateConfig, loadConfig } from '../src/config.js';
import { Budget } from '../src/budget.js';
import { validateCall, decide } from '../src/tools.js';
import { makeFixture } from '../src/demo.js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const paid = () => ({ ...structuredClone(defaults), provider: 'openai', baseUrl: 'https://api.openai.com/v1', pricing: { input: 2000000, output: 10000000, source: 'https://example.com/pricing', asOf: '2026-10-20' } });
const state = () => ({ modelCalls: 0, spent: 0, held: 0 });
test('config estrita rejeita campos errados, URLs remotas Ollama e escapes', () => {
  validateConfig(structuredClone(defaults));
  for (const edit of [c => c.typo = true, c => c.limits.maxModelCalls = 0, c => c.baseUrl = 'http://evil.example', c => c.writeRoots = ['../x'], c => c.commands.tests.argv = 'node --test']) {
    const c = structuredClone(defaults); edit(c); assert.throws(() => validateConfig(c));
  }
});
test('ambiente troca provedor sem incluir a chave no config', async () => {
  const { root } = await makeFixture();
  const { config } = await loadConfig(root, undefined, { YZZY_PROVIDER: 'openai', YZZY_MODEL: 'selected', OPENAI_API_KEY: 'not-stored' });
  assert.equal(config.baseUrl, 'https://api.openai.com/v1'); assert.equal(config.model, 'selected'); assert.equal(JSON.stringify(config).includes('not-stored'), false);
});

test('autoevolução exige digest e critérios comparativos válidos; configuração antiga recebe defaults', async () => {
  for (const mutate of [c => c.evolution.image = 'node:latest', c => c.evolution.repetitions = 1,
    c => c.evolution.repetitions = 6, c => c.evolution.minImprovedCases = 0,
    c => c.evolution.minImprovedCases = 13, c => c.evolution.fallback = 'host']) {
    const c = structuredClone(defaults); mutate(c); assert.throws(() => validateConfig(c));
  }
  const { root } = await makeFixture();
  await writeFile(path.join(root, 'yzzy.config.json'), JSON.stringify({ model: 'legacy-config' }));
  const { config } = await loadConfig(root, undefined, {});
  assert.deepEqual(config.evolution, defaults.evolution);
});
test('config padrão ausente usa defaults, mas config explícita ausente e JSON inválido falham', async () => {
  const { root } = await makeFixture();
  const { config } = await loadConfig(root, undefined, {}); assert.equal(config.provider, defaults.provider);
  await assert.rejects(loadConfig(root, path.join(root, 'missing.json'), {}), { code: 'ENOENT' });
  await writeFile(path.join(root, 'yzzy.config.json'), '{');
  await assert.rejects(loadConfig(root, undefined, {}), SyntaxError);
});

test('compatibilidade lê configuração legada sem prevalecer sobre nome e ambiente novos', async () => {
  const { root } = await makeFixture();
  await writeFile(path.join(root, 'wzzy.config.json'), JSON.stringify({ provider: 'ollama', model: 'legacy' }));
  assert.equal((await loadConfig(root, undefined, {})).config.model, 'legacy');
  await writeFile(path.join(root, 'yzzy.config.json'), JSON.stringify({ provider: 'codex', model: 'current' }));
  const result = await loadConfig(root, undefined, { WZZY_MODEL: 'old-env', YZZY_MODEL: 'new-env' });
  assert.equal(result.config.model, 'new-env'); assert.equal(result.config.provider, 'codex');
  assert.equal(path.basename(result.configPath), 'yzzy.config.json');
});
test('reserva é anterior à chamada; preço ausente e teto impedem despacho', () => {
  const c = paid(), s = state(), b = new Budget(c, s);
  const reserved = b.reserve(1000); assert.ok(reserved > 0); assert.equal(s.held, reserved);
  b.settle(reserved, { input: 1000, output: 100 }); assert.equal(s.held, 0); assert.equal(s.spent, 3000);
  c.limits.maxCostMicrousd = s.spent; assert.throws(() => b.reserve(1), /orçamento/);
  c.pricing = null; assert.throws(() => b.reserve(1), /pricing/);
});
test('uso desconhecido mantém reserva e cache não recebe desconto presumido', () => {
  const s = state(), b = new Budget(paid(), s); const reserved = b.reserve(2000);
  b.settle(reserved, null); assert.equal(s.held, reserved);
  const second = b.reserve(1000); b.settle(second, { input: 1000, output: 100, cached: 1000 });
  assert.equal(s.spent, 3000); assert.equal(s.held, reserved);
});
test('divergência da reserva e limite de chamadas interrompem', () => {
  const c = paid(), s = state(), b = new Budget(c, s); const r = b.reserve(1);
  assert.throws(() => b.settle(r, { input: 100000, output: 100000 }), /excedeu reserva/);
  s.modelCalls = c.limits.maxModelCalls; assert.throws(() => b.reserve(1), /Limite/);
});
test('esquemas e política rejeitam ferramentas, argumentos e permissões inventadas', () => {
  assert.throws(() => validateCall('shell', { command: 'echo' }), /desconhecida/);
  assert.throws(() => validateCall('read_file', { path: 'a', approved: true }), /adicionais/);
  assert.throws(() => validateCall('read_lines', { path: 'a', start_line: -1, max_lines: 10 }), /Inteiro/);
  assert.equal(decide('run_check', { command: 'tests' }, { allowExec: false }, defaults).effect, 'deny');
  assert.equal(decide('run_check', { command: 'shell' }, { allowExec: true }, defaults).effect, 'deny');
});
