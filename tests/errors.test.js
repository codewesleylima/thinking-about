import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptional, describeError } from '../src/errors.js';

test('leitura opcional aplica fallback somente a ENOENT e não repete a operação', async () => {
  let calls = 0;
  const value = await readOptional(async () => { calls++; throw Object.assign(new Error('missing'), { code: 'ENOENT', errno: -4058, syscall: 'open' }); }, 'default');
  assert.equal(value, 'default'); assert.equal(calls, 1);
  assert.equal(await readOptional(async () => 'present', 'default'), 'present');
  for (const code of ['EACCES', 'EPERM', 'EIO']) {
    const error = Object.assign(new Error('not missing'), { code });
    await assert.rejects(readOptional(async () => { throw error; }, 'default'), e => e === error);
  }
  await assert.rejects(readOptional(async () => JSON.parse('{'), 'default'), SyntaxError);
});
test('ENOENT de open oferece recuperação explícita sem declarar sucesso', () => {
  const error = Object.assign(new Error('missing'), { code: 'ENOENT', errno: -4058, syscall: 'open', path: 'host/path' });
  const r = describeError(error, { operation: 'read_file', path: 'src/missing.js' });
  assert.equal(r.ok, false); assert.equal(r.code, 'ENOENT'); assert.equal(r.errno, -4058);
  assert.equal(r.path, 'src/missing.js'); assert.equal(r.category, 'path_not_found');
  assert.equal(r.recoverable, true); assert.equal(r.retryable, false); assert.equal(r.recovery.strategy, 'locate_path');
});
test('executável, acesso negado e efeito incerto não recebem fallback de arquivo', () => {
  const missing = Object.assign(new Error('spawn'), { code: 'ENOENT', syscall: 'spawn docker' });
  assert.equal(describeError(missing).category, 'executable_not_found');
  const denied = describeError(Object.assign(new Error('denied'), { code: 'EACCES' }));
  assert.equal(denied.recoverable, false); assert.equal(denied.category, 'access_denied');
  const uncertain = describeError(missing, { uncertain: true });
  assert.equal(uncertain.recoverable, false); assert.equal(uncertain.recovery.strategy, 'inspect_manually');
});
