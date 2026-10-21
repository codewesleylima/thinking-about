import assert from 'node:assert/strict';
import { readDocumentation } from '../src/documentation.js';
import { defaults } from '../src/config.js';
const document = await readDocumentation('https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html', defaults);
assert.equal(document.untrusted, true);
assert.match(document.content, /javap/i);
assert.ok(Buffer.byteLength(JSON.stringify({ ok: true, ...document })) <= defaults.limits.maxOutputBytes);
console.log(JSON.stringify({ kind: 'live_https_documentation', url: document.url, sha256: document.sha256,
  retrievedAt: document.retrievedAt, truncated: document.truncated, outputBytes: Buffer.byteLength(JSON.stringify(document)) }));
