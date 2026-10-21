import { mkdtemp, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { defaults } from './config.js';
import { runAgent } from './agent.js';

export const fixtureSource = 'export function isAdult(age) { return age > 18; }\n';
// Avaliador fixo para a fixture roteirizada; vm NÃO é uma fronteira de segurança.
export async function eligibilityGrader(workspace) {
  const { content, sha256 } = await workspace.read('src/eligibility.js');
  const cases = [[0, false], [17, false], [18, true], [19, true], [99, true]];
  try {
    const fn = vm.runInNewContext(content.replace('export ', '') + '; isAdult', {}, { timeout: 100 });
    const results = cases.map(([age, expected]) => ({ age, expected, observed: fn(age) }));
    return { passed: results.every(x => x.expected === x.observed), sha256, cases: results };
  } catch (error) { return { passed: false, error: error.message, sha256 }; }
}
export async function makeFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'yzzy-demo-')));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'eligibility.js'), fixtureSource);
  const config = structuredClone(defaults); config.provider = 'scripted'; config.model = 'offline-fixture-v1';
  return { root, config };
}
export function scriptedFix() {
  let step = 0;
  return { async generate({ messages }) {
    const last = messages.filter(m => m.role === 'tool').at(-1);
    if (step++ === 0) return { text: 'Vou ler a regra de maioridade e seu hash.', calls: [{ id: 'read-1', name: 'read_file', args: { path: 'src/eligibility.js' } }] };
    if (step === 2) return { text: 'O limite exclui 18 anos. Vou incluir o valor da fronteira.', calls: [{ id: 'edit-1', name: 'replace_text', args: { path: 'src/eligibility.js', expected_sha256: last.result.sha256, old_text: 'age > 18', new_text: 'age >= 18' } }] };
    return { text: 'Alterada a condição para incluir 18 anos. O avaliador independente verificará os casos de fronteira.', calls: [] };
  } };
}
export async function demo({ emit = () => {} } = {}) {
  const fixture = await makeFixture();
  const result = await runAgent({ ...fixture, objective: 'Corrigir maioridade: 17 não, 18 e 19 sim.',
    permissions: { allowWrite: true, allowExec: false }, provider: scriptedFix(), verifier: eligibilityGrader, emit });
  return { ...result, root: fixture.root };
}
