import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { Workspace } from '../src/workspace.js';
import { runHostShell, shellEnvironment } from '../src/host-shell.js';
import { decide } from '../src/tools.js';
import { runAgent } from '../src/agent.js';
import { builtinAgents } from '../src/profiles.js';
import { runTeam } from '../src/team.js';
// Autolimita o processo mesmo quando a sandbox do runner bloqueia taskkill.
const waiting = `"${process.execPath}" -e "setTimeout(()=>{},1500)"`;

test('shell é capacidade separada, preserva readOnly e não herda credenciais de ambiente conhecidas', async () => {
  const f = await makeFixture(), args = { command: 'echo ok', cwd: '.' };
  assert.equal(decide('run_command', args, { allowWrite: true, allowExec: true, allowNetwork: true }, f.config).effect, 'deny');
  assert.equal(decide('run_command', args, { allowHostShell: true }, f.config).effect, 'allow');
  assert.deepEqual(shellEnvironment({ PATH: 'bin', JAVA_HOME: 'jdk', OPENAI_API_KEY: 'dummy-key', GITHUB_TOKEN: 'dummy-token', NODE_OPTIONS: '--inspect', PASSWORD: 'dummy' }), { PATH: 'bin', JAVA_HOME: 'jdk' });
  let step = 0;
  const result = await runAgent({ ...f, objective: 'Revise', permissions: { allowHostShell: true }, agentProfile: builtinAgents.reviewer,
    provider: { async generate() { return step++ === 0 ? { text: '', calls: [{ id: 'shell', name: 'run_command', args: { command: 'echo no>src/forbidden.txt', cwd: '.' } }] } : { text: 'fim', calls: [] }; } } });
  assert.equal(result.state.permissions.allowHostShell, false);
  await assert.rejects(lstat(path.join(f.root, 'src/forbidden.txt')), { code: 'ENOENT' });
});

test('CMD/sh real suporta redirecionamento no cwd concedido e captura exit code', async () => {
  const f = await makeFixture(), ws = new Workspace(f.root, f.config);
  const written = await runHostShell(ws, { command: 'echo ready>shell.txt', cwd: 'src' });
  assert.equal(written.exitCode, 0, written.output); assert.equal(written.ok, true);
  assert.match(await readFile(path.join(f.root, 'src/shell.txt'), 'utf8'), /ready/);
  assert.equal(written.verification, 'diagnostic_only');
  const failed = await runHostShell(ws, { command: process.platform === 'win32' ? 'exit /b 7' : 'exit 7', cwd: '.' });
  assert.equal(failed.exitCode, 7); assert.equal(failed.ok, false);
  await assert.rejects(runHostShell(ws, { command: 'echo no', cwd: '../' }));
});

test('saída é limitada por JSON final e timeout/cancelamento não afirmam limpeza garantida', async () => {
  const f = await makeFixture(); f.config.limits.maxOutputBytes = 2000;
  const ws = new Workspace(f.root, f.config);
  const noisy = await runHostShell(ws, { command: `"${process.execPath}" -e "process.stdout.write(String.fromCharCode(34).repeat(6000))"`, cwd: '.' });
  assert.equal(noisy.truncated, true); assert.equal(noisy.ok, false);
  assert.ok(Buffer.byteLength(JSON.stringify(noisy)) <= 2000);
  f.config.limits.commandTimeoutMs = 150;
  const timeout = await runHostShell(ws, { command: waiting, cwd: '.' });
  assert.equal(timeout.timedOut, true); assert.equal(timeout.cleanupKnown, false);
  f.config.limits.commandTimeoutMs = 5000;
  const abort = new AbortController(); setTimeout(() => abort.abort(), 150);
  const cancelled = await runHostShell(ws, { command: waiting, cwd: '.' }, { signal: abort.signal });
  assert.equal(cancelled.cancelled, true); assert.equal(cancelled.cleanupKnown, false);
});

test('shell nunca se converte em avaliação independente e interrupção impede replay', async () => {
  const f = await makeFixture(); let step = 0, verified = 0;
  const result = await runAgent({ ...f, objective: 'Diagnóstico', permissions: { allowHostShell: true },
    verifier: async () => { verified++; return { passed: true }; }, provider: { async generate() {
      return step++ === 0 ? { text: '', calls: [{ id: 'shell', name: 'run_command', args: { command: 'echo diagnostic', cwd: '.' } }] } : { text: 'fim', calls: [] };
    } } });
  assert.equal(result.state.status, 'completed_unverified'); assert.equal(verified, 0);
  assert.equal(result.state.summary.hostShellUsed, true);
  f.config.limits.commandTimeoutMs = 100;
  const stopped = await runAgent({ ...f, objective: 'Comando longo', permissions: { allowHostShell: true }, provider: { async generate() {
    return { text: '', calls: [{ id: 'long', name: 'run_command', args: { command: waiting, cwd: '.' } }] };
  } } });
  assert.equal(stopped.state.status, 'blocked_uncertain');
  const resumed = await runAgent({ ...f, resumeId: stopped.id, objective: 'Continue', permissions: { allowHostShell: true } });
  assert.match(resumed.error, /efeito incerto/);
});

test('consulta de equipe não recebe shell mesmo quando o coordenador está autorizado', async () => {
  const f = await makeFixture();
  const result = await runTeam({ ...f, objective: 'Investigue', specialists: 'java', permissions: { allowHostShell: true },
    providerFactory: (_name, phase) => { let step = 0; return { async generate() {
      return phase === 'consultation' && step++ === 0 ? { text: '', calls: [{ id: 'no', name: 'run_command', args: { command: 'echo no>src/not-allowed.txt', cwd: '.' } }] } : { text: 'Parecer', calls: [] };
    } }; } });
  assert.equal(result.report.status, 'completed_unverified');
  await assert.rejects(lstat(path.join(f.root, 'src/not-allowed.txt')), { code: 'ENOENT' });
});

test('diagnóstico host não esconde uma falha de check registrada', async () => {
  const f = await makeFixture(); let step = 0;
  const result = await runAgent({ ...f, objective: 'Diagnostique e confira', permissions: { allowHostShell: true, allowExec: true },
    dockerRunner: async (_bin, args) => ({ exitCode: args[0] === 'run' ? 1 : 0, output: 'falha de teste', truncated: false, timedOut: false, cancelled: false }),
    provider: { async generate() { return [
      { text: '', calls: [{ id: 'host', name: 'run_command', args: { command: 'echo diagnostic', cwd: '.' } }] },
      { text: '', calls: [{ id: 'test', name: 'run_check', args: { command: 'tests' } }] },
      { text: 'fim', calls: [] }
    ][step++]; } } });
  assert.equal(result.state.status, 'failed');
});
