// Probe do controlador, montado separadamente e readonly. Nenhuma resposta esperada é enviada ao container.
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = '/workspace';
const { retrieveLearnings } = await import(pathToFileURL(path.join(root, 'src/learning.js')));
const { summarize } = await import(pathToFileURL(path.join(root, 'src/memory.js')));
const { defaults } = await import(pathToFileURL(path.join(root, 'src/config.js')));
const input = JSON.parse(await readFile('/evaluation/input.json', 'utf8'));
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const results = [];
for (const item of input.cases) {
  const started = performance.now(); let value;
  if (item.kind === 'retrieval') {
    const directory = await mkdtemp(path.join(tmpdir(), 'yzzy-evaluation-case-'));
    try {
      await mkdir(path.join(directory, '.yzzy'));
      const lessons = [item.record], sha256 = createHash('sha256').update(canonical(lessons)).digest('hex');
      await writeFile(path.join(directory, '.yzzy', 'learning.json'), JSON.stringify({ version: 1, lessons, sha256 }));
      const config = structuredClone(defaults); config.documentation.allowedHosts = item.hosts; config.limits.maxContextBytes = item.contextBytes;
      value = (await retrieveLearnings(directory, item.query, config, item.now)).map(l => l.id);
    } finally {
      if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('yzzy-evaluation-case-')) throw new Error('Invalid temporary path');
      await rm(directory, { recursive: true, force: true });
    }
  } else {
    const summary = summarize(item.state);
    if (item.projection === 'userInstructions') value = summary.userInstructions;
    else if (item.projection === 'pending') value = { pendingTool: summary.pendingTool, uncertainEffect: summary.uncertainEffect, permissions: summary.permissions };
    else {
      const ref = summary.readReferences?.items?.[0];
      value = ref ? { path: ref.path, sha256: ref.sha256, start_line: ref.start_line, end_line: ref.end_line, more: ref.more } : null;
    }
  }
  results.push({ id: item.id, value, durationMs: performance.now() - started });
}
console.log(JSON.stringify({ schema: 1, results }));
