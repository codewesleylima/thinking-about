import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const directories = ['bin', 'src', 'scripts', 'tests', 'evaluations'];
let checked = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'results') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw new Error(result.stderr || result.error?.message || file);
      checked++;
    }
  }
}
for (const dir of directories) await walk(dir);
for (const file of ['package.json', 'package-lock.json', 'wzzy.config.json', 'evaluations/tasks.json']) JSON.parse(await readFile(file, 'utf8'));
console.log(`Sintaxe: ${checked} módulos JavaScript; configurações JSON válidas.`);
