import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { invariant, canonical, hash } from './util.js';
export const templatePath = fileURLToPath(new URL('../wzzy.config.json', import.meta.url));
export const defaults = JSON.parse(await readFile(templatePath, 'utf8'));
const only = (value, allowed, where) => {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${where}: objeto esperado`);
  for (const key of Object.keys(value)) invariant(allowed.includes(key), `${where}: campo desconhecido ${key}`);
};
export function validateConfig(c) {
  only(c, Object.keys(defaults), 'config');
  invariant(['ollama', 'openai', 'scripted'].includes(c.provider), 'Provedor inválido');
  invariant(typeof c.model === 'string' && typeof c.baseUrl === 'string', 'model/baseUrl inválidos');
  const url = new URL(c.baseUrl);
  invariant(!url.username && !url.password && !url.search && !url.hash, 'URL não pode conter credenciais/query/fragmento');
  if (c.provider === 'openai') invariant(url.origin === 'https://api.openai.com' && /^\/v1\/?$/.test(url.pathname), 'OpenAI exige https://api.openai.com/v1');
  if (c.provider === 'ollama') invariant(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol) && /^\/?$/.test(url.pathname), 'Ollama exige endpoint loopback sem path');
  invariant(Array.isArray(c.writeRoots) && c.writeRoots.every(x => typeof x === 'string' && x.length && !path.isAbsolute(x) && !x.split(/[\\/]/).some(p => p === '..' || p === '.' || !p)), 'writeRoots exige caminhos relativos explícitos');
  only(c.limits, Object.keys(defaults.limits), 'limits');
  for (const key of Object.keys(defaults.limits)) invariant(Number.isSafeInteger(c.limits[key]) && c.limits[key] > 0, `Limite inválido: ${key}`);
  only(c.docker, Object.keys(defaults.docker), 'docker');
  invariant(typeof c.docker.image === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9/:@._-]+$/.test(c.docker.image), 'Imagem Docker inválida');
  invariant(/^\d+[mg]$/.test(c.docker.memory) && /^\d+(\.\d+)?$/.test(c.docker.cpus) && Number.isSafeInteger(c.docker.pids) && c.docker.pids > 0, 'Recursos Docker inválidos');
  only(c.commands, Object.keys(c.commands), 'commands');
  for (const [name, command] of Object.entries(c.commands)) {
    invariant(/^[a-z][a-z0-9_-]*$/.test(name), 'Nome de comando inválido');
    only(command, ['argv', 'verification'], `commands.${name}`);
    invariant(Array.isArray(command.argv) && command.argv.length > 0 && command.argv.every(x => typeof x === 'string' && x.length && !x.includes('\0')), 'argv inválido');
    invariant(typeof command.verification === 'boolean', 'verification deve ser booleano');
  }
  if (c.pricing !== null) {
    only(c.pricing, ['input', 'output', 'source', 'asOf'], 'pricing');
    for (const key of ['input', 'output']) invariant(Number.isSafeInteger(c.pricing[key]) && c.pricing[key] > 0, 'Preço deve ser inteiro positivo em microUSD/milhão');
    invariant(typeof c.pricing.source === 'string' && c.pricing.source.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(c.pricing.asOf), 'Registre fonte e data dos preços');
  }
  return c;
}
export async function loadConfig(workspace, filename, env = process.env) {
  const root = await realpath(path.resolve(workspace));
  let supplied = {};
  const configPath = path.resolve(filename || path.join(root, 'wzzy.config.json'));
  try { supplied = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT' || filename) throw error; }
  const c = { ...structuredClone(defaults), ...supplied,
    limits: { ...defaults.limits, ...supplied.limits }, docker: { ...defaults.docker, ...supplied.docker } };
  if (env.WZZY_PROVIDER) c.provider = env.WZZY_PROVIDER;
  if (env.WZZY_MODEL) c.model = env.WZZY_MODEL;
  if (env.WZZY_BASE_URL) c.baseUrl = env.WZZY_BASE_URL;
  else if (c.provider === 'openai' && c.baseUrl === defaults.baseUrl) c.baseUrl = 'https://api.openai.com/v1';
  validateConfig(c);
  return { config: c, root, configPath, fingerprint: hash(canonical(c)) };
}
