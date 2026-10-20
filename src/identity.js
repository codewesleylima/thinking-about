import { readdir, readFile } from 'node:fs/promises';
import { hash, canonical } from './util.js';
const directory = new URL('./', import.meta.url);
// Calculada no carregamento dos módulos; uma atualização exige nova sessão.
export const runtimeHash = hash(canonical(await Promise.all((await readdir(directory)).filter(f => f.endsWith('.js')).sort().map(async file => [file, hash(await readFile(new URL(file, directory)))]))));
