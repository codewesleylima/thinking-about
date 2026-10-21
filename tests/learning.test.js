import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, symlink, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { makeFixture } from '../src/demo.js';
import { runElevation, DEFAULT_STUDY } from '../src/elevation.js';
import { runAgent } from '../src/agent.js';
import { listLearnings, forgetLearning, retrieveLearnings } from '../src/learning.js';
import { summarize, contextMessages } from '../src/memory.js';
import { Journal } from '../src/journal.js';
import { hash } from '../src/util.js';
import { capture } from '../src/executor.js';

const url = 'https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html';
const quote = 'The javap command disassembles one or more class files.';
const source = { url, content: quote, sha256: hash(quote), retrievedAt: '2026-10-21T00:00:00.000Z', untrusted: true, truncated: false };
const lesson = () => ({ title: 'Java javap para inspecionar bytecode', summary: 'Conferir assinaturas Java na versão usada.',
  steps: ['Conferir JDK e classpath antes de usar javap.'], verification: 'Comparar assinatura observada ao contrato esperado.',
  limits: 'Receita não executada; não equivale a recuperar código fonte.', sources: [{ url, quote }] });
const done = lessons => ({ text: JSON.stringify({ lessons }), calls: [] });
function sequence(items) { let i = 0; return { async generate(input) { const value = items[i++]; return typeof value === 'function' ? value(input) : value; } }; }
const read = { text: '', calls: [{ id: 'source', name: 'read_documentation', args: { url } }] };
const study = (f, options = {}) => runElevation({ ...f, topic: 'Java bytecode javap', documentationReader: async () => source,
  provider: sequence([read, done([lesson()])]), ...options });

test('/elevar pesquisa, valida origem, persiste e reutiliza em outra sessão sem ampliar autoridade', async () => {
  const f = await makeFixture(); const r = await study(f);
  assert.equal(r.state.status, 'completed_unverified'); assert.equal(r.learned.length, 1);
  assert.equal(r.learned[0].sources[0].sha256, source.sha256);
  assert.equal(r.learned[0].validation, 'provenance_only');
  const items = await listLearnings(f.root); assert.equal(items[0].status, 'active');
  const next = await runAgent({ ...f, objective: 'Investigue Java bytecode', provider: sequence([input => {
    assert.match(input.messages.find(m => m.learning).text, /NÃO CONFIÁVEL/);
    assert.ok(!input.system.includes(quote));
    return { text: 'Vou conferir o JDK.', calls: [] };
  }]) });
  assert.equal(next.state.permissions.allowWrite, false);
  assert.deepEqual(next.state.learningIds, [items[0].id]);
  assert.deepEqual(summarize(next.state).userInstructions, ['Investigue Java bytecode']);
  const forced = contextMessages({ ...next.state, messages: [...next.state.messages, ...Array.from({ length: 8 }, () => ({ role: 'assistant', text: 'passo' }))] }, 180000, true, true);
  assert.equal(forced.messages.filter(m => m.learning).length, 1);
  const journal = await Journal.load(f.root, r.id);
  assert.equal(journal.state.researchMode, true);
});

test('pesquisa nega ferramentas de efeitos mesmo que modelo tente chamá-las; não recebe memória anterior', async () => {
  const f = await makeFixture(); await study(f);
  const r = await study(f, { provider: sequence([input => {
    assert.ok(!input.tools.some(t => ['run_command', 'replace_text', 'create_file', 'run_check'].includes(t.name)));
    assert.ok(!input.messages.some(m => m.learning));
    assert.match(input.system, /allowHostShell=false/);
    return { text: '', calls: [{ id: 'evil', name: 'create_file', args: { path: 'src/evil.js', content: 'bad' } }] };
  }, input => { assert.equal(input.messages.at(-1).result.ok, false); return read; }, done([lesson()])]) });
  assert.equal(r.learned.length, 1); assert.equal((await listLearnings(f.root)).length, 1);
  await assert.rejects(lstat(path.join(f.root, 'src/evil.js')), { code: 'ENOENT' });
});

test('fonte inventada, trecho inventado, ausência de rede, JSON malformado e estudo limitado não promovem memória', async () => {
  for (const type of ['url', 'quote', 'offline', 'json', 'limit']) {
    const f = await makeFixture(), item = lesson();
    if (type === 'url') item.sources[0].url = 'https://docs.oracle.com/never-read';
    if (type === 'quote') item.sources[0].quote = 'An invented statement that does not exist in the document.';
    if (type === 'limit') f.config.limits.maxModelCalls = 1;
    const r = await study(f, { provider: sequence([read, type === 'json' ? { text: 'Aprendi tudo.', calls: [] } : done([item])]),
      ...(type === 'offline' ? { documentationReader: async () => { throw new Error('offline'); } } : {}) });
    assert.equal(r.learned.length, 0, type);
    assert.ok(['error', 'limited'].includes(r.state.status), type);
    assert.deepEqual(await listLearnings(f.root), [], type);
    assert.equal((await Journal.load(f.root, r.id)).state.status, r.state.status);
  }
});

test('host limita a oito leituras externas e preserva o orçamento compartilhado do estudo', async () => {
  const f = await makeFixture(); let reads = 0;
  const r = await study(f, { documentationReader: async () => { reads++; return source; }, provider: sequence([
    { text: '', calls: Array.from({ length: 8 }, (_, i) => ({ id: `read-${i}`, name: 'read_documentation', args: { url: url + '/' + i } })) },
    read,
    input => { assert.match(input.messages.at(-1).result.error, /oito leituras/); return done([lesson()]); }
  ]) });
  assert.equal(reads, 8); assert.equal(r.state.modelCalls, 3); assert.equal(r.state.toolCalls, 9);
  assert.equal(r.learned.length, 1);
});

test('conhecimento externo não autoriza shell ou escrita na aplicação futura', async () => {
  const f = await makeFixture(); await study(f);
  const r = await runAgent({ ...f, objective: 'Java', provider: sequence([
    { text: '', calls: [{ id: 'shell', name: 'run_command', args: { command: 'echo learned', cwd: '.' } }] },
    { text: 'Fim', calls: [] }
  ]) });
  assert.equal(r.state.messages.find(m => m.role === 'tool').result.ok, false);
  assert.equal(r.state.hostShellUsed, undefined);
});

test('cancelamento não inicia inferência nem grava aprendizado', async () => {
  const f = await makeFixture(), controller = new AbortController(); controller.abort();
  await assert.rejects(study(f, { signal: controller.signal, provider: { generate() { assert.fail('não deve inferir'); } } }));
  assert.deepEqual(await listLearnings(f.root), []);
});

test('citação aceita quebras de linha e espaços equivalentes, preservando palavras e pontuação', async () => {
  const f = await makeFixture();
  const multiline = { ...source, content: 'The javap command\n  disassembles one or more class files.' };
  const r = await study(f, { documentationReader: async () => multiline });
  assert.equal(r.learned.length, 1); assert.equal(r.learned[0].sources[0].match, 'whitespace_normalized');
  const wrong = lesson(); wrong.sources[0].quote = quote.replace('class files.', 'source files.');
  const rejected = await study(f, { documentationReader: async () => multiline, provider: sequence([read, done([wrong])]) });
  assert.equal(rejected.learned.length, 0); assert.match(rejected.error, /não encontrado/);
});

test('recuperação limita relevância/bytes, expira e aplica allowlist atual; esquecer remove em retomada', async () => {
  const f = await makeFixture(), r = await study(f), id = r.learned[0].id;
  assert.deepEqual(await retrieveLearnings(f.root, 'receita de bolo', f.config), []);
  assert.deepEqual(await retrieveLearnings(f.root, 'Java', f.config, Date.now() + 31 * 86400000), []);
  const small = structuredClone(f.config); small.limits.maxContextBytes = 100;
  assert.deepEqual(await retrieveLearnings(f.root, 'Java', small), []);
  const denied = structuredClone(f.config); denied.documentation.allowedHosts = [];
  assert.deepEqual(await retrieveLearnings(f.root, 'Java', denied), []);
  const first = await runAgent({ ...f, objective: 'Java', provider: sequence([{ text: 'OK', calls: [] }]) });
  await forgetLearning(f.root, id);
  const next = await runAgent({ ...f, resumeId: first.id, objective: 'Java novamente', provider: sequence([input => {
    assert.ok(!input.messages.some(m => m.learning)); return { text: 'OK', calls: [] };
  }]) });
  assert.deepEqual(next.state.learningIds, []);
  await assert.rejects(forgetLearning(f.root, id), /não encontrado/);
  const resume = await runAgent({ ...f, resumeId: r.id, objective: 'continue', provider: sequence([]) });
  assert.match(resume.error, /não admite retomada/);
});

test('memória corrompida ou redirecionada por symlink não é aceita', async () => {
  const f = await makeFixture(); await study(f);
  const file = path.join(f.root, '.yzzy', 'learning.json');
  const data = JSON.parse(await readFile(file, 'utf8')); data.lessons[0].summary = 'alteração sem hash';
  await writeFile(file, JSON.stringify(data));
  await assert.rejects(listLearnings(f.root), /Integridade/);
  const other = await mkdtemp(path.join(tmpdir(), 'yzzy-learning-link-'));
  await symlink(path.join(f.root, '.yzzy'), path.join(other, '.yzzy'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(listLearnings(other), /Diretório/);
});

test('CLI documenta /elevar, lista detalhes e esquece sem chamar modelo', async () => {
  const f = await makeFixture(), r = await study(f), id = r.learned[0].id;
  const cli = fileURLToPath(new URL('../bin/yzzy.js', import.meta.url));
  const invoke = args => capture(process.execPath, [cli, ...args, '--workspace', f.root, '--json']);
  assert.match((await invoke(['--help'])).output, /\/elevar/);
  const listing = await invoke(['aprendizados']); assert.equal(listing.exitCode, 0, listing.output);
  assert.equal(JSON.parse(listing.output)[0].id, id);
  const detail = await invoke(['aprendizados', id]); assert.equal(JSON.parse(detail.output).sources[0].url, url);
  const removed = await invoke(['esquecer', id]); assert.equal(JSON.parse(removed.output).forgotten, id);
  assert.deepEqual(JSON.parse((await invoke(['aprendizados'])).output), []);
  assert.ok(DEFAULT_STUDY.includes('CLI'));
});
