import assert from 'node:assert/strict';
import { makeFixture } from '../src/demo.js';
import { runAgent } from '../src/agent.js';
import { Journal } from '../src/journal.js';
const fixture = await makeFixture(); fixture.config.provider = 'codex'; fixture.config.model = '';
fixture.config.limits.maxModelCalls = 4; fixture.config.limits.maxWallMs = 120000;
const result = await runAgent({ ...fixture, permissions: { allowHostShell: true },
  objective: 'Valide apenas o diagnóstico: use run_command com command="echo YZZY_SHELL_READY" e cwd=".". Não execute outros comandos nem edite arquivos. Depois informe o texto observado, sem alegar testes de software ou verificação independente.',
  emit: event => { if (['model_completed','tool_completed'].includes(event.type)) console.log(JSON.stringify(event)); } });
const journal = await Journal.load(fixture.root, result.id);
const observed = result.state.messages.find(message => message.role === 'tool' && message.name === 'run_command');
console.log(JSON.stringify({ kind: 'live_model_host_shell', workspace: fixture.root, session: result.id,
  status: result.state.status, modelCalls: result.state.modelCalls, toolCalls: result.state.toolCalls,
  resolvedModels: [...new Set(journal.events.filter(event => event.type === 'model_completed').map(event => event.data.resolvedModel))],
  output: observed?.result.output, error: result.error || null }));
assert.equal(result.state.status, 'completed_unverified', result.error);
assert.equal(result.state.hostShellUsed, true); assert.match(observed.result.output, /YZZY_SHELL_READY/);
