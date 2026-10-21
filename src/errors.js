import { bounded } from './util.js';

// Fallback é exclusivo da ausência de uma entrada declarada opcional pelo chamador.
// Não transforma EACCES, erro de formato ou erro da política em arquivo vazio.
export async function readOptional(read, fallback) {
  try { return await read(); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export function describeError(error, { operation, path, uncertain = false } = {}) {
  const result = { ok: false, error: bounded(error.message || String(error), 2000),
    code: error.code || 'TOOL_ERROR', category: 'operation_failed', recoverable: false, retryable: false };
  if (operation) result.operation = operation;
  if (error.syscall) result.syscall = error.syscall;
  if (Number.isSafeInteger(error.errno)) result.errno = error.errno;
  if (uncertain) {
    result.category = 'uncertain_effect';
    result.recovery = { strategy: 'inspect_manually', message: 'Inspecione os efeitos e a limpeza antes de abrir nova sessão; não repita a operação automaticamente.' };
    return result;
  }
  if (error.code === 'ENOENT') {
    const spawn = /^spawn\b/.test(error.syscall || '');
    result.category = spawn ? 'executable_not_found' : 'path_not_found';
    result.recoverable = true;
    if (path || error.path) result.path = path || error.path;
    result.recovery = spawn
      ? { strategy: 'check_environment', message: 'Confira o executável, o PATH e o diretório de execução. A instalação e o escopo não são alterados automaticamente.' }
      : { strategy: 'locate_path', message: operation === 'initialization'
        ? 'Confira o caminho informado, --workspace e --config. Arquivos obrigatórios devem existir; init gera apenas a configuração e as instruções padrão em um workspace existente.'
        : 'Confira o caminho e o workspace. Use list_files para localizar o arquivo permitido e só depois repita com o caminho correto. Crie um arquivo apenas se a tarefa exigir e houver autorização de escrita.' };
  } else if (['EACCES', 'EPERM'].includes(error.code)) {
    result.category = 'access_denied';
    result.recovery = { strategy: 'review_permissions', message: 'Revise a autorização e o acesso ao caminho. Não tente contornar a política ou ampliar permissões por conta própria.' };
  }
  return result;
}
