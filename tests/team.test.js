import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { planTeam, runTeam, loadTeam } from '../src/team.js';
import { getAgent, builtinAgents, validateAgent } from '../src/profiles.js';
import { Journal } from '../src/journal.js';
import { runAgent } from '../src/agent.js';

test('roteamento é explícito/revisável e perfis especialistas são utilizáveis', async () => {
  const f = await makeFixture();
  for (const name of ['orchestrator', 'engineer', 'architect', 'patterns', 'java', 'debugger', 'reverse_engineer', 'frontend', 'tester', 'integrations', 'security', 'performance', 'data', 'devops', 'technical_writer']) {
    validateAgent(await getAgent(f.root, name));
  }
  const plan = planTeam('Depure NoSuchMethodError na biblioteca interna Java');
  assert.ok(plan.specialists.includes('java')); assert.ok(plan.specialists.includes('reverse_engineer'));
  assert.ok(plan.specialists.includes('tester')); assert.ok(plan.specialists.length <= 6);
  assert.deepEqual(planTeam('x', 'java,tester').specialists, ['java', 'tester']);
  for (const requested of ['', 'java,java', 'orchestrator', '../java']) assert.throws(() => planTeam('x', requested));
  assert.throws(() => planTeam('  '));
});

test('equipe investiga em sessões isoladas, nega escrita nas consultas e entrega ao único coordenador', async () => {
  const f = await makeFixture(); const order = [];
  const result = await runTeam({ ...f, objective: 'Crie src/team.txt sem mudar contratos', specialists: 'java,tester',
    permissions: { allowWrite: true, allowExec: true, allowNetwork: false },
    providerFactory: (name, phase) => {
      order.push([name, phase]); let step = 0;
      return { async generate({ system, messages }) {
        if (phase === 'consultation') {
          assert.match(system, /allowWrite=false, allowExec=false/);
          return step++ === 0 ? { text: '', calls: [{ id: name, name: 'create_file', args: { path: 'src/not-allowed.txt', content: 'x' } }] }
            : { text: `Parecer ${name}: cite src/math.js; proposta não verificada.`, calls: [] };
        }
        assert.match(messages[0].text, /Parecer java/); assert.match(messages[0].text, /Parecer tester/);
        return step++ === 0 ? { text: '', calls: [{ id: 'edit', name: 'create_file', args: { path: 'src/team.txt', content: 'ok' } }] }
          : { text: 'Arquivo criado; testes não executados.', calls: [] };
      } };
    } });
  assert.deepEqual(order, [['java', 'consultation'], ['tester', 'consultation'], ['orchestrator', 'synthesis']]);
  assert.equal(result.state.status, 'completed_unverified');
  assert.equal(await readFile(path.join(f.root, 'src/team.txt'), 'utf8'), 'ok');
  await assert.rejects(lstat(path.join(f.root, 'src/not-allowed.txt')), { code: 'ENOENT' });
  const report = await loadTeam(f.root, result.id);
  assert.equal(report.totals.modelCalls, 6); assert.equal(report.totals.toolCalls, 3);
  assert.equal(report.consultations.length, 2); assert.equal(report.sessions.length, 3);
  const java = await Journal.load(f.root, report.sessions[0].id);
  assert.equal(java.state.profileSnapshot.readOnly, true);
  assert.equal(java.state.messages.find(m => m.role === 'tool').result.ok, false);
  const resumed = await runAgent({ ...f, objective: 'continue', resumeId: java.id, agentProfile: builtinAgents.java });
  assert.match(resumed.error, /orçamento agregado/);
});

test('limites não são multiplicados e pergunta suspende equipe antes da implementação', async () => {
  const f = await makeFixture(); f.config.limits.maxModelCalls = 3;
  const waiting = await runTeam({ ...f, objective: 'Defina requisitos', specialists: 'java,tester',
    providerFactory: () => ({ async generate() { return { text: '', calls: [{ id: 'question', name: 'ask_user', args: { question: 'Qual JDK?' } }] }; } }) });
  assert.equal(waiting.report.status, 'waiting_user'); assert.equal(waiting.report.sessions.length, 1);
  assert.equal(waiting.report.totals.modelCalls, 1);
  let calls = 0;
  const bounded = await runTeam({ ...f, objective: 'Analise', specialists: 'java,tester',
    providerFactory: () => ({ async generate() { calls++; return { text: 'Ainda lendo', calls: [{ id: String(calls), name: 'list_files', args: {} }] }; } }) });
  assert.equal(bounded.report.status, 'limited'); assert.equal(calls, 1);
  assert.equal(bounded.report.sessions.length, 1);
});

test('coordenador respeita orçamento restante de ferramentas', async () => {
  const f = await makeFixture(); f.config.limits.maxModelCalls = 6; f.config.limits.maxToolCalls = 1;
  let calls = 0;
  const result = await runTeam({ ...f, objective: 'Avalie', specialists: 'java',
    providerFactory: (_name, phase) => ({ async generate() {
      calls++;
      return phase === 'consultation' && calls === 1 ? { text: '', calls: [{ id: 'one', name: 'list_files', args: {} }] }
        : phase === 'synthesis' ? { text: '', calls: [{ id: 'two', name: 'list_files', args: {} }] } : { text: 'Parecer', calls: [] };
    } }) });
  assert.equal(result.report.status, 'limited'); assert.equal(result.report.totals.toolCalls, 1);
  assert.equal(result.report.totals.modelCalls, 3);
});

test('custo conhecido de uma consulta reduz reserva disponível para síntese', async () => {
  const f = await makeFixture(); f.config.provider = 'openai';
  f.config.pricing = { input: 1, output: 1, source: 'https://example.org/pricing', asOf: '2026-10-21' };
  f.config.limits.maxCostMicrousd = 3; let dispatched = 0;
  const result = await runTeam({ ...f, objective: 'Analise', specialists: 'java', providerFactory: () => ({ async generate() {
    dispatched++; return { text: 'Parecer', calls: [], usage: { input: 1, output: 1 } };
  } }) });
  assert.equal(dispatched, 1); assert.equal(result.report.totals.spent, 2);
  assert.equal(result.report.status, 'limited'); assert.equal(result.report.sessions.length, 2);
});

test('perfil humano somente leitura continua restrito ao abrir equipe', async () => {
  const f = await makeFixture();
  const result = await runTeam({ ...f, objective: 'Revise', specialists: 'java', agentProfile: builtinAgents.reviewer,
    permissions: { allowWrite: true, allowExec: true }, providerFactory: (_name, phase) => {
      let step = 0; return { async generate({ system }) {
        assert.match(system, /allowWrite=false, allowExec=false/);
        return phase === 'synthesis' && step++ === 0 ? { text: '', calls: [{ id: 'no', name: 'create_file', args: { path: 'src/no.txt', content: 'x' } }] } : { text: 'Revisado', calls: [] };
      } };
    } });
  assert.equal(result.report.permissions.allowWrite, false);
  await assert.rejects(lstat(path.join(f.root, 'src/no.txt')), { code: 'ENOENT' });
  assert.equal(result.result.state.messages.find(m => m.role === 'tool').result.ok, false);
});
