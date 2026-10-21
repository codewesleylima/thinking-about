import { lstat, readFile, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lockWorkspace } from './journal.js';
import { canonical, hash, invariant, redact, abortIfNeeded } from './util.js';
import { documentationUrl } from './documentation.js';

const MAX_BYTES = 1024 * 1024, MAX_LESSONS = 100;
const DAY = 86400000;
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && Buffer.byteLength(v) <= max;
const identifier = v => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
const whitespace = value => value.replace(/\s+/gu, ' ').trim();

async function readStore(root) {
  const dir = path.join(root, '.yzzy');
  try {
    const parent = await lstat(dir);
    invariant(parent.isDirectory() && !parent.isSymbolicLink(), 'Diretório de aprendizado inválido');
    const file = path.join(dir, 'learning.json'), stat = await lstat(file);
    invariant(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= MAX_BYTES, 'Memória de aprendizado inválida');
    const store = JSON.parse(await readFile(file, 'utf8'));
    invariant(store.version === 1 && Array.isArray(store.lessons) && store.lessons.length <= MAX_LESSONS
      && store.sha256 === hash(canonical(store.lessons)), 'Integridade da memória de aprendizado inválida');
    for (const item of store.lessons) {
      invariant(identifier(item.id) && identifier(item.session) && text(item.topic, 2000)
        && text(item.title, 200) && text(item.summary, 1800) && text(item.verification, 1200) && text(item.limits, 1200)
        && Array.isArray(item.steps) && item.steps.length >= 1 && item.steps.length <= 8 && item.steps.every(s => text(s, 800))
        && item.validation === 'provenance_only' && Number.isFinite(Date.parse(item.createdAt))
        && Number.isFinite(Date.parse(item.expiresAt)) && Array.isArray(item.sources) && item.sources.length >= 1 && item.sources.length <= 3,
      'Registro de aprendizado inválido');
      for (const s of item.sources) invariant(text(s.url, 2048) && text(s.quote, 500)
        && /^[a-f0-9]{64}$/.test(s.sha256) && Number.isFinite(Date.parse(s.retrievedAt)), 'Origem de aprendizado inválida');
    }
    invariant(new Set(store.lessons.map(l => l.id)).size === store.lessons.length, 'ID de aprendizado duplicado');
    return store.lessons;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function writeStore(root, lessons) {
  // Redige antes do hash para que a leitura confira exatamente os bytes persistidos.
  lessons = JSON.parse(redact(JSON.stringify(lessons)));
  const bytes = JSON.stringify({ version: 1, lessons, sha256: hash(canonical(lessons)) }, null, 2) + '\n';
  invariant(Buffer.byteLength(bytes) <= MAX_BYTES && lessons.length <= MAX_LESSONS, 'Memória cheia; esqueça aprendizados antes de elevar novamente');
  const file = path.join(root, '.yzzy', 'learning.json'), temp = file + '.' + randomUUID() + '.tmp';
  try {
    const handle = await open(temp, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await rename(temp, file);
  } finally { await unlink(temp).catch(() => {}); }
}

export async function listLearnings(root, now = Date.now()) {
  return (await readStore(root)).map(item => ({ ...item, status: Date.parse(item.expiresAt) > now ? 'active' : 'expired' }));
}

export async function forgetLearning(root, id) {
  invariant(identifier(id), 'Informe o ID completo de um aprendizado');
  const unlock = await lockWorkspace(root);
  try {
    const items = await readStore(root), next = items.filter(i => i.id !== id);
    invariant(next.length < items.length, 'Aprendizado não encontrado');
    await writeStore(root, next); return { forgotten: id };
  } finally { await unlock(); }
}

export function validateLessons(answer, state, config) {
  // O host exige uma origem observada, não uma URL que o modelo apenas afirma ter lido.
  const sources = state.messages.filter(m => m.role === 'tool' && m.name === 'read_documentation'
    && m.result?.ok && m.result.untrusted === true && m.result.content?.trim()).map(m => m.result);
  invariant(sources.length > 0, 'Nenhuma fonte da internet foi consultada com sucesso; nada foi aprendido');
  let parsed;
  try { parsed = JSON.parse(answer.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, '$1')); }
  catch { throw new Error('O estudo não retornou o JSON de aprendizado esperado; nada foi salvo. Tente /elevar com um tema mais específico ou uma URL oficial.'); }
  invariant(exact(parsed, ['lessons']) && Array.isArray(parsed.lessons) && parsed.lessons.length >= 1 && parsed.lessons.length <= 5,
    'Estudo deve produzir de um a cinco aprendizados estruturados');
  return parsed.lessons.map(item => {
    invariant(exact(item, ['title', 'summary', 'steps', 'verification', 'limits', 'sources'])
      && text(item.title, 200) && text(item.summary, 1800) && text(item.verification, 1200) && text(item.limits, 1200)
      && Array.isArray(item.steps) && item.steps.length >= 1 && item.steps.length <= 8 && item.steps.every(s => text(s, 800))
      && Array.isArray(item.sources) && item.sources.length >= 1 && item.sources.length <= 3, 'Aprendizado fora do contrato');
    return { ...item, sources: item.sources.map(ref => {
      invariant(exact(ref, ['url', 'quote']) && text(ref.url, 2048) && text(ref.quote, 500) && ref.quote.trim().length >= 20,
        'Referência precisa de URL e trecho literal entre 20 caracteres e 500 bytes');
      const url = documentationUrl(ref.url, config.documentation.allowedHosts).href;
      const source = sources.find(s => s.url === url && whitespace(s.content).includes(whitespace(ref.quote)));
      invariant(source && /^[a-f0-9]{64}$/.test(source.sha256) && Number.isFinite(Date.parse(source.retrievedAt)),
        'Referência ou trecho não encontrado nas fontes realmente lidas');
      return { url, quote: ref.quote, match: source.content.includes(ref.quote) ? 'exact' : 'whitespace_normalized',
        sha256: source.sha256, retrievedAt: source.retrievedAt, truncated: Boolean(source.truncated) };
    }) };
  });
}

export async function rememberStudy(root, { topic, state, config, signal }) {
  invariant(text(topic, 2000) && identifier(state.id), 'Identidade de estudo inválida');
  invariant(state.researchMode && state.status === 'completed_unverified' && !state.uncertainEffect && !state.pendingTool && !state.pendingModel,
    'Estudo incompleto: nada será promovido à memória');
  const answer = state.messages.filter(m => m.role === 'assistant').at(-1)?.text || '';
  const accepted = validateLessons(answer, state, config);
  abortIfNeeded(signal);
  const unlock = await lockWorkspace(root);
  try {
    abortIfNeeded(signal);
    const current = await readStore(root), now = Date.now();
    const added = accepted.map(item => ({ ...item, id: randomUUID(), topic, session: state.id,
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 30 * DAY).toISOString(), validation: 'provenance_only' }));
    // Não duplica a mesma conclusão com a mesma versão das fontes.
    const signature = i => hash(canonical([i.title, i.summary, i.steps, i.verification, i.limits, i.sources.map(s => [s.url, s.sha256])]));
    const next = [...current.filter(old => !added.some(a => signature(a) === signature(old))), ...added];
    await writeStore(root, next); return added;
  } finally { await unlock(); }
}

const stops = new Set('para como uma que com por dos das este esta isso sobre quero faça usar meus suas nosso nossa mesmo projeto'.split(' '));
const tokens = value => new Set((value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[a-z0-9]{3,}/g) || [])
  .filter(t => !stops.has(t)).slice(0, 80));

export async function retrieveLearnings(root, objective, config, now = Date.now()) {
  const query = tokens(objective), limit = Math.min(10000, Math.floor(config.limits.maxContextBytes / 8));
  const ranked = (await listLearnings(root, now)).filter(item => item.status === 'active'
    && item.sources.every(s => { try { documentationUrl(s.url, config.documentation.allowedHosts); return true; } catch { return false; } }))
    .map(item => ({ item, score: [...tokens([item.topic, item.title, item.summary].join(' '))].filter(t => query.has(t)).length }))
    .filter(r => r.score >= 1).sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt));
  const selected = [];
  for (const { item } of ranked) {
    if (selected.length >= 3) break;
    if (Buffer.byteLength(JSON.stringify([...selected, item])) <= limit) selected.push(item);
  }
  return selected;
}
