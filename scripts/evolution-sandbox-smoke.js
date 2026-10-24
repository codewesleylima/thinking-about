import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makeFixture } from '../src/demo.js';
import { createEvolutionSnapshot, runEvolutionSandbox } from '../src/evolution-sandbox.js';

const f = await makeFixture(); await writeFile(path.join(f.root, '.env'), 'DO_NOT_MOUNT=canary');
await mkdir(path.join(f.root, '.yzzy')); await writeFile(path.join(f.root, '.yzzy/private'), 'private');
const snapshot = await createEvolutionSnapshot(f.root, ['src/eligibility.js'], f.config);
try {
  const probe = `const assert=require('node:assert/strict'),fs=require('node:fs'),net=require('node:net');
assert.equal(process.getuid(),65534);assert.equal(process.env.OPENAI_API_KEY,undefined);assert.equal(process.env.CODEX_HOME,undefined);
for(const p of ['/workspace/.env','/workspace/.yzzy','/workspace/.git','/var/run/docker.sock'])assert.equal(fs.existsSync(p),false,p);
assert.throws(()=>fs.writeFileSync('/workspace/src/eligibility.js','bad'));assert.throws(()=>fs.writeFileSync('/etc/yzzy-canary','bad'));
assert.equal(/^CapEff:\\s+0+$/m.test(fs.readFileSync('/proc/self/status','utf8')),true);fs.writeFileSync('/tmp/yzzy-canary','allowed');
const socket=net.connect({host:'1.1.1.1',port:443});socket.setTimeout(1000);
socket.on('connect',()=>{console.error('external network available');process.exit(1)});
socket.on('error',()=>{console.log('uid, readonly filesystem, private-data exclusion, no capabilities and network isolation passed');process.exit(0)});
socket.on('timeout',()=>{socket.destroy();console.log('network unavailable; other isolation assertions passed');process.exit(0)});`;
  const result = await runEvolutionSandbox({ snapshot, config: f.config, argv: ['-e', probe] });
  assert.equal(result.passed, true, JSON.stringify(result));
  const timeoutConfig = structuredClone(f.config); timeoutConfig.limits.commandTimeoutMs = 200;
  const timeout = await runEvolutionSandbox({ snapshot, config: timeoutConfig, argv: ['-e', 'setTimeout(()=>{},1500)'] });
  assert.equal(timeout.passed, false); assert.equal(timeout.cleanupKnown, true);
  console.log(JSON.stringify({ kind: 'live_evolution_isolation', image: result.image, snapshot: snapshot.revision,
    probe: result.stdout.trim(), passed: result.passed, cleanupKnown: result.cleanupKnown,
    timeout: { passed: timeout.passed, cleanupKnown: timeout.cleanupKnown } }));
} finally { await snapshot.dispose(); }
