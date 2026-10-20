import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { demo, makeFixture, eligibilityGrader } from '../src/demo.js';
import { runAgent, SYSTEM } from '../src/agent.js';
import { Workspace } from '../src/workspace.js';
import { tools } from '../src/tools.js';
import { canonical, hash } from '../src/util.js';
const response = (calls = [], text = '') => ({ text, calls });
const call = (id, name, args) => response([{ id, name, args }]);
const once = first => { let done = false; return { async generate() { if (!done) { done = true; return first; } return response([], 'fim'); } }; };
async function fixtureRun(provider, edit = () => {}) {
  const f = await makeFixture(); edit(f.config);
  return runAgent({ ...f, objective: 'Avaliação determinística', provider });
}
const scenarios = {
  D01: async () => { const r = await demo(); assert.equal(r.state.status, 'verified'); return r; },
  D02: async () => { const f = await makeFixture(); const verdict = await eligibilityGrader(new Workspace(f.root, f.config)); assert.equal(verdict.passed, false); return { verdict }; },
  D03: async () => { const r = await fixtureRun(once(call('deny', 'read_file', { path: '.env' }))); assert.equal(r.state.messages.find(m => m.role === 'tool').result.ok, false); return r; },
  D04: async () => { const r = await fixtureRun(once(response([], 'Testes passaram; tarefa verificada.'))); assert.equal(r.state.status, 'completed_unverified'); return r; },
  D05: async () => { const r = await fixtureRun(once(call('ask', 'ask_user', { question: 'Qual a regra para 18 anos?' }))); assert.equal(r.state.status, 'waiting_user'); return r; },
  D06: async () => { let n = 0; const r = await fixtureRun({ async generate() { return call(String(++n), 'list_files', {}); } }); assert.equal(r.state.status, 'limited'); assert.match(r.error, /Loop/); return r; },
  D07: async () => { const r = await fixtureRun(once(call('read', 'list_files', {})), c => c.limits.maxModelCalls = 1); assert.equal(r.state.modelCalls, 1); assert.equal(r.state.status, 'limited'); return r; },
  D08: async () => { const r = await fixtureRun(once(call('write', 'create_file', { path: 'src/x', content: 'x' }))); assert.equal(r.state.messages.find(m => m.role === 'tool').result.ok, false); return r; }
};
const manifest = JSON.parse(await readFile(new URL('./tasks.json', import.meta.url), 'utf8'));
const results = [];
for (const task of manifest.tasks.filter(t => t.automated === 'offline')) {
  const started = performance.now();
  try {
    const r = await scenarios[task.id]();
    results.push({ id: task.id, passed: true, durationMs: Math.round(performance.now() - started), session: r.id || null,
      modelCalls: r.state?.modelCalls || 0, tools: r.state?.toolCalls || 0, costMicrousd: r.state?.spent || 0, status: r.state?.status || 'negative_control_rejected' });
  } catch (error) { results.push({ id: task.id, passed: false, durationMs: Math.round(performance.now() - started), error: error.message }); }
}
const sources = [];
for (const file of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js')).sort()) sources.push([file, hash(await readFile(new URL('../src/' + file, import.meta.url)))]);
const report = { schema: 1, kind: 'deterministic_controller_scenarios', generatedAt: new Date().toISOString(), node: process.version, platform: process.platform,
  harnessHash: hash(canonical(sources)), instructionHash: hash(SYSTEM), toolSchemaHash: hash(canonical(tools)), manifestHash: hash(canonical(manifest)),
  passed: results.filter(r => r.passed).length, total: results.length, realModelCalls: 0,
  interpretation: 'Passagem de cenários roteirizados do controlador. Não mede qualidade de LLM; não há IC binomial para inferir generalização desta seleção determinística.', results };
const dir = new URL('./results/', import.meta.url); await mkdir(dir, { recursive: true });
await writeFile(new URL('latest.json', dir), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
