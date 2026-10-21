import { loadConfig } from '../src/config.js';
import { makeFixture } from '../src/demo.js';
import { runAgent } from '../src/agent.js';
import { runDocker } from '../src/executor.js';
import { Workspace } from '../src/workspace.js';
import { invariant, redact } from '../src/util.js';

// Opt-in explícito: pode enviar código e consumir saldo da API configurada.
invariant(process.env.YZZY_LIVE === '1', 'Defina YZZY_LIVE=1 para autorizar o smoke com modelo real. Prepare modelo, preços e Docker antes.');
const { config } = await loadConfig(process.cwd());
const { root } = await makeFixture();
const grader = "import assert from 'node:assert/strict'; import { isAdult } from './src/eligibility.js'; for (const [age, expected] of [[0,false],[17,false],[18,true],[19,true],[99,true]]) assert.equal(isAdult(age),expected); console.log('independent boundary checks passed');";
config.commands = { tests: { argv: ['node', '--input-type=module', '-e', grader], verification: true } };
const result = await runAgent({ root, config, objective: 'Corrija src/eligibility.js: uma pessoa de 18 anos deve ser maior de idade, 17 não e 19 sim. Preserve a assinatura.', permissions: { allowWrite: true, allowExec: true }, emit: e => console.log(redact(JSON.stringify(e))) });
const independent = await runDocker(new Workspace(root, config), 'tests');
console.log(JSON.stringify({ kind: 'live_smoke_one_task', workspace: root, session: result.id, status: result.state.status, independentPassed: independent.passed, billing: result.state.billing, spent: result.state.spent, held: result.state.held }));
if (!independent.passed || result.error) process.exitCode = 1;
