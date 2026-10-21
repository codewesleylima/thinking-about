import { readFile } from 'node:fs/promises';
export const VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
