import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodexRpc } from '../src/codex-rpc.js';
import { inferenceArgs, createCodexProvider } from '../src/codex-provider.js';
import { defaults } from '../src/config.js';
import { tools } from '../src/tools.js';
import { makeFixture } from '../src/demo.js';
import { runAgent } from '../src/agent.js';
import { runDocker } from '../src/executor.js';
import { Workspace } from '../src/workspace.js';

if (process.argv.includes('--status-only')) {
  const rpc = await CodexRpc.start(await mkdtemp(path.join(tmpdir(), 'yzzy-probe-')), inferenceArgs);
  try {
    const auth = await rpc.request('account/read', { refreshToken: false });
    const models = await rpc.request('model/list', { limit: 100 });
    console.log(JSON.stringify({ authenticated: Boolean(auth.account), accountType: auth.account?.type,
      models: models.data.map(m => ({ model: m.model, default: m.isDefault })) }, null, 2));
  } finally { rpc.close(); }
} else {
  const config = structuredClone(defaults); config.provider = 'codex'; config.model = process.env.YZZY_MODEL || '';
  if (process.argv.includes('--edit')) {
    const { root } = await makeFixture();
    const result = await runAgent({ root, config, objective: 'Corrija src/eligibility.js: isAdult deve retornar false para 17 e true para 18 e 19. Preserve a assinatura. Use read_file e replace_text. Não é necessário executar comandos.',
      permissions: { allowWrite: true, allowExec: false }, emit: e => { if (['created', 'model_started', 'tool_completed', 'finished', 'stopped'].includes(e.type)) console.log(JSON.stringify(e)); } });
    const grader = "import assert from 'node:assert/strict'; import {isAdult} from './src/eligibility.js'; for(const [a,e] of [[0,false],[17,false],[18,true],[19,true],[99,true]]) assert.equal(isAdult(a),e); console.log('independent checks passed');";
    config.commands = { tests: { argv: ['node', '--input-type=module', '-e', grader], verification: true } };
    const verification = await runDocker(new Workspace(root, config), 'tests');
    console.log(JSON.stringify({ kind: 'codex_real_edit', root, session: result.id, status: result.state.status,
      calls: result.state.modelCalls, tools: result.state.toolCalls, billing: result.state.billing, independentPassed: verification.passed }));
    assert.equal(verification.passed, true); assert.equal(result.error, undefined);
  } else {
    const result = await createCodexProvider(config).generate({ system: 'Você é YZZY BLACK. Responda exatamente YZZY_READY e não solicite ferramentas.',
      messages: [{ role: 'user', text: 'Confirme que a integração funciona.' }], tools, signal: AbortSignal.timeout(120000) });
    assert.match(result.text, /YZZY_READY/); assert.equal(result.calls.length, 0);
    console.log(JSON.stringify({ kind: 'codex_real_inference', text: result.text, model: result.resolvedModel, billing: result.billing, usage: result.usage }));
  }
}
