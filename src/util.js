import { createHash } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export function invariant(ok, message) { if (!ok) throw new Error(message); }
export function clean(text) { return stripVTControlCharacters(String(text)).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ''); }
export function redact(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (/KEY|TOKEN|SECRET|PASSWORD/i.test(name) && secret.length >= 8) text = text.split(secret).join('[REDACTED]');
  }
  return text.replace(/\bsk-[a-zA-Z0-9_-]{12,}/g, '[REDACTED]');
}
export function bounded(text, bytes) { return Buffer.from(text).subarray(0, bytes).toString('utf8'); }
export const clone = value => JSON.parse(JSON.stringify(value));
export function abortIfNeeded(signal) { signal?.throwIfAborted(); }
