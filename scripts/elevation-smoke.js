import assert from 'node:assert/strict';
import { runElevation } from '../src/elevation.js';
import { runAgent } from '../src/agent.js';
import { makeFixture } from '../src/demo.js';
import { Journal } from '../src/journal.js';
import { listLearnings } from '../src/learning.js';
import { capture } from '../src/executor.js';
import { fileURLToPath } from 'node:url';

const f = await makeFixture(); f.config.provider = 'codex'; f.config.model = '';
const started = new Date().toISOString();
if (process.argv.includes('--default-cli')) {
  const cli = fileURLToPath(new URL('../bin/yzzy.js', import.meta.url));
  const observed = await capture(process.execPath, [cli, 'elevar', '--workspace', f.root, '--json'], { timeoutMs: 200000, maxBytes: 131072 });
  // Mostra metadados de execução; os textos completos das fontes ficam no journal.
  for (const line of observed.output.trim().split('\n')) {
    try { const e = JSON.parse(line); if (['model_completed', 'tool_completed'].includes(e.type)) console.log(line); } catch { /* assertion below includes diagnostics */ }
  }
  assert.equal(observed.exitCode, 0, observed.output);
  const events = observed.output.trim().split('\n').map(line => JSON.parse(line)), result = events.at(-1);
  assert.equal(result.type, 'elevation_result'); assert.equal(result.status, 'completed_unverified');
  assert.ok(result.learned.length >= 1); assert.equal((await listLearnings(f.root)).length, result.learned.length);
  console.log(JSON.stringify({ kind: 'live_default_elevation_cli', started, finished: new Date().toISOString(),
    session: result.session, topic: result.topic, learned: result.learned.length,
    models: [...new Set(events.filter(e => e.type === 'model_completed').map(e => e.resolvedModel))] }));
} else {
const result = await runElevation({ ...f,
  topic: 'Estude Java javap: leia somente https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html com read_documentation. Gere exatamente um aprendizado pequeno sobre inspecionar assinaturas de classes Java, com um trecho literal curto da documentação lida. Não leia arquivos locais e não alegue execução.',
  emit: e => { if (['model_completed', 'tool_completed'].includes(e.type)) console.log(JSON.stringify(e)); } });
assert.equal(result.state.status, 'completed_unverified', result.error);
assert.equal(result.learned.length, 1);
assert.equal((await listLearnings(f.root)).length, 1);
const followup = await runAgent({ ...f, objective: 'O que devo conferir antes de investigar assinaturas Java com javap? Não use ferramentas nem afirme que executou algo; responda com orientação curta e cite a fonte da memória quando disponível.' });
assert.equal(followup.state.status, 'completed_unverified', followup.error);
assert.deepEqual(followup.state.learningIds, [result.learned[0].id]);
const journal = await Journal.load(f.root, result.id);
console.log(JSON.stringify({ kind: 'live_elevation', started, finished: new Date().toISOString(), workspace: f.root,
  session: result.id, followup: followup.id, status: result.state.status, models: [...new Set(journal.events.filter(e => e.type === 'model_completed').map(e => e.data.resolvedModel))],
  modelCalls: result.state.modelCalls + followup.state.modelCalls, toolCalls: result.state.toolCalls + followup.state.toolCalls,
  learned: result.learned.map(({ id, title, sources, validation }) => ({ id, title, sources, validation })),
  response: followup.state.messages.filter(m => m.role === 'assistant').at(-1).text }));
}
