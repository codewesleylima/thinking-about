import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { runTeam } from '../src/team.js';
import { Journal } from '../src/journal.js';
const fixture = await makeFixture(); fixture.config.provider = 'codex';
fixture.config.model = '';
fixture.config.limits.maxModelCalls = 12; fixture.config.limits.maxToolCalls = 8;
fixture.config.limits.maxWallMs = 180000;
const sample = 'final class Sample { static int twice(int x) { return x + 1; } }\n';
await writeFile(path.join(fixture.root, 'src/Sample.java'), sample);
const result = await runTeam({ ...fixture, specialists: 'java,tester',
  objective: 'Analise src/Sample.java: twice deveria retornar o dobro de x. Leia esse arquivo uma vez. Em no máximo 120 palavras por parecer, explique o defeito e um teste discriminante. Não edite nem execute comandos. O coordenador deve sintetizar em português com evidência, sem alegar teste executado.',
  emit: event => { if (['team_phase', 'model_completed', 'tool_completed', 'team_finished'].includes(event.type)) console.log(JSON.stringify(event)); }
});
const resolvedModels = [];
for (const session of result.report.sessions) {
  const journal = await Journal.load(fixture.root, session.id);
  for (const event of journal.events) if (event.type === 'model_completed') resolvedModels.push(event.data.resolvedModel);
}
console.log(JSON.stringify({ kind: 'live_team_smoke', workspace: fixture.root, team: result.id,
  status: result.state.status, sessions: result.report.sessions, totals: result.report.totals,
  error: result.error || null, report: result.file, resolvedModels: [...new Set(resolvedModels)], billing: result.result?.state.billing }));
assert.equal(await readFile(path.join(fixture.root, 'src/Sample.java'), 'utf8'), sample);
assert.equal(result.state.status, 'completed_unverified', result.error);
assert.equal(result.report.sessions.length, 3);
assert.ok(result.report.totals.modelCalls >= 3);
