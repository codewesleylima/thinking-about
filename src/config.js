import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { invariant, canonical, hash } from './util.js';
import { readOptional } from './errors.js';
export const templatePath = fileURLToPath(new URL('../yzzy.config.json', import.meta.url));
export const defaults = JSON.parse(await readFile(templatePath, 'utf8'));
const only = (value, allowed, where) => {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${where}: objeto esperado`);
  for (const key of Object.keys(value)) invariant(allowed.includes(key), `${where}: campo desconhecido ${key}`);
};
export function validateConfig(c) {
  only(c, Object.keys(defaults), 'config');
  invariant(['codex', 'ollama', 'openai', 'scripted'].includes(c.provider), 'Provedor inválido');
  invariant(typeof c.model === 'string' && typeof c.baseUrl === 'string', 'model/baseUrl inválidos');
  only(c.documentation, ['allowedHosts'], 'documentation');
  invariant(Array.isArray(c.documentation.allowedHosts) && c.documentation.allowedHosts.length <= 64
    && c.documentation.allowedHosts.every(host => typeof host === 'string' && host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)), 'Domínios de documentação devem ser hostnames exatos, sem wildcard');
  const url = new URL(c.baseUrl);
  invariant(!url.username && !url.password && !url.search && !url.hash, 'URL não pode conter credenciais/query/fragmento');
  if (c.provider === 'openai') invariant(url.origin === 'https://api.openai.com' && /^\/v1\/?$/.test(url.pathname), 'OpenAI exige https://api.openai.com/v1');
  if (['ollama', 'codex'].includes(c.provider)) invariant(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol) && /^\/?$/.test(url.pathname), 'Endpoint local exige loopback sem path');
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
  let configPath = path.resolve(filename || path.join(root, 'yzzy.config.json'));
  const read = () => readFile(configPath, 'utf8');
  let raw = filename ? await read() : await readOptional(read, null);
  if (raw === null) { configPath = path.join(root, 'wzzy.config.json'); raw = await readOptional(read, '{}'); }
  const supplied = JSON.parse(raw);
  const c = { ...structuredClone(defaults), ...supplied,
    limits: { ...defaults.limits, ...supplied.limits }, docker: { ...defaults.docker, ...supplied.docker },
    documentation: { ...structuredClone(defaults.documentation), ...supplied.documentation } };
  if (env.YZZY_PROVIDER || env.WZZY_PROVIDER) c.provider = env.YZZY_PROVIDER || env.WZZY_PROVIDER;
  if (env.YZZY_MODEL || env.WZZY_MODEL) c.model = env.YZZY_MODEL || env.WZZY_MODEL;
  if (env.YZZY_BASE_URL || env.WZZY_BASE_URL) c.baseUrl = env.YZZY_BASE_URL || env.WZZY_BASE_URL;
  else if (c.provider === 'openai' && c.baseUrl === defaults.baseUrl) c.baseUrl = 'https://api.openai.com/v1';
  validateConfig(c);
  return { config: c, root, configPath, fingerprint: hash(canonical(c)) };
}
