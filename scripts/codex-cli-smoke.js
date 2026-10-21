// Explicit real-inference acceptance test; consumes the authenticated Codex quota.
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from '../src/executor.js';
const root = await mkdtemp(path.join(tmpdir(), 'yzzy-cli-real-'));
const cli = fileURLToPath(new URL('../bin/yzzy.js', import.meta.url));
async function invoke(args, expected = 0) {
  const result = await capture(process.execPath, [cli, ...args, '--workspace', root, '--json'], { timeoutMs: 180000, maxBytes: 256000, env: process.env });
  assert.equal(result.exitCode, expected, result.output);
  return result.output.trim().split('\n').map(line => JSON.parse(line));
}
await invoke(['agent', 'create', 'mentor', '--from', 'reviewer', '--instructions', 'Responda em português e seja breve. Se faltar uma prioridade necessária, pergunte usando ask_user. Se ela já foi informada, não repita a pergunta.']);
await invoke(['settings', 'set', 'verbosity', 'concise']);
const first = await invoke(['run', 'Preciso escolher a prioridade A ou B, mas ainda não informei qual. Use ask_user para perguntar a prioridade antes de prosseguir.', '--agent', 'mentor'], 4);
const session = first.at(-1).session;
assert.equal(first.at(-1).status, 'waiting_user');
assert.ok(first.some(e => e.type === 'question'));
await invoke(['resume', session, 'A prioridade é A. Guarde a palavra ARARA nesta conversa. Confirme em uma frase, sem ferramentas.']);
const resumed = await invoke(['resume', session, 'Qual palavra pedi para guardar? Responda apenas a palavra, sem ferramentas.']);
assert.ok(resumed.some(e => e.type === 'message' && /ARARA/i.test(e.text)));
const [summary] = await invoke(['summary', session]);
assert.equal(summary.agent, 'mentor'); assert.equal(summary.userInstructions.length, 3);
assert.equal(summary.permissions.allowWrite, false); assert.equal(summary.permissions.allowExec, false);
console.log(JSON.stringify({ kind: 'codex_cli_real_acceptance', root, session, customAgent: summary.agent,
  askUser: true, crossProcessResume: true, remembered: 'ARARA', humanInstructionsPreserved: summary.userInstructions.length,
  proposals: summary.resources.calls, status: resumed.at(-1).status }));
