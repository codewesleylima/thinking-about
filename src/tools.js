import { invariant } from './util.js';
const str = { type: 'string' };
function tool(name, description, properties) {
  return { name, description, parameters: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) } };
}
export const tools = [
  tool('list_files', 'Lista arquivos permitidos; pode retornar truncated.', {}),
  tool('search', 'Busca literal com linhas e caminhos nos arquivos permitidos.', { query: str }),
  tool('read_file', 'Lê UTF-8 e retorna sha256 necessário para editar.', { path: str }),
  tool('read_lines', 'Lê trecho numerado de arquivo grande. Para editar, use conteúdo sem números.', { path: str, start_line: { type: 'integer', minimum: 1 }, max_lines: { type: 'integer', minimum: 1, maximum: 200 } }),
  tool('replace_text', 'Substitui uma única ocorrência exata, com hash da leitura e escopo autorizado.', { path: str, expected_sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, old_text: str, new_text: str }),
  tool('create_file', 'Cria arquivo novo; nunca sobrescreve existente.', { path: str, content: str }),
  tool('run_check', 'Executa comando cadastrado por nome em snapshot Docker sem rede.', { command: str }),
  tool('ask_user', 'Solicita informação necessária; suspende para resposta humana.', { question: str })
];
export function validateCall(name, args) {
  const spec = tools.find(t => t.name === name);
  invariant(spec, `Ferramenta desconhecida: ${name}`);
  invariant(args && typeof args === 'object' && !Array.isArray(args), 'Argumentos devem ser objeto JSON');
  const keys = Object.keys(spec.parameters.properties);
  invariant(Object.keys(args).length === keys.length && Object.keys(args).every(k => keys.includes(k)), 'Argumentos ausentes ou adicionais');
  for (const key of keys) {
    const schema = spec.parameters.properties[key];
    if (schema.type === 'integer') invariant(Number.isSafeInteger(args[key]) && args[key] >= schema.minimum && args[key] <= (schema.maximum || 1000000), `Inteiro inválido: ${key}`);
    else {
      invariant(typeof args[key] === 'string', `Argumento ${key} deve ser texto`);
      invariant(Buffer.byteLength(args[key]) <= 262144, `Argumento ${key} grande demais`);
    }
  }
  if (name === 'replace_text') invariant(/^[a-f0-9]{64}$/.test(args.expected_sha256), 'Hash inválido');
  if (name === 'ask_user') invariant(args.question.trim().length > 0, 'Pergunta vazia');
}
export function decide(name, args, permissions, config) {
  validateCall(name, args);
  if (['replace_text', 'create_file'].includes(name) && !permissions.allowWrite) return { effect: 'deny', reason: 'Edição exige --allow-write' };
  if (name === 'run_check' && !permissions.allowExec) return { effect: 'deny', reason: 'Execução exige --allow-exec' };
  if (name === 'run_check' && !Object.hasOwn(config.commands, args.command)) return { effect: 'deny', reason: 'Comando não cadastrado' };
  return { effect: 'allow', reason: 'Capacidade concedida pela CLI; caminhos validados no executor' };
}
