import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Fetches the corpus named in data/corpus.lock.json and verifies its SHA256.
// Exits non-zero if the bytes do not match the hash the measurements used.
// Usage: tsx scripts/fetch-corpus.ts [--force]

interface Lock { url: string; path: string; sha256: string; bytes: number; textValidFrom: string; fetchedAt: string }
const lock: Lock = JSON.parse(readFileSync('data/corpus.lock.json', 'utf8'));
const force = process.argv.includes('--force');

const sha256 = (buf: Uint8Array) => createHash('sha256').update(buf).digest('hex');

function verify(buf: Uint8Array, source: string): void {
  const got = sha256(buf);
  if (got === lock.sha256 && buf.byteLength === lock.bytes) {
    console.log(`ok: ${lock.path} (${buf.byteLength.toLocaleString('en-GB')} bytes, sha256 ${got.slice(0, 12)}..., text valid from ${lock.textValidFrom}, ${source})`);
    return;
  }
  console.error(`CORPUS MISMATCH (${source})`);
  console.error(`  expected sha256 ${lock.sha256} (${lock.bytes} bytes, fetched ${lock.fetchedAt})`);
  console.error(`  got      sha256 ${got} (${buf.byteLength} bytes)`);
  console.error('  legislation.gov.uk has published a newer consolidation, or the download is incomplete.');
  console.error('  The numbers in README.md were measured against the expected bytes and do not describe this file.');
  console.error('  To measure the new text instead, update data/corpus.lock.json deliberately and re-run the whole pipeline.');
  process.exit(1);
}

if (existsSync(lock.path) && !force) {
  verify(readFileSync(lock.path), 'existing file');
} else {
  console.log(`fetching ${lock.url}`);
  const res = await fetch(lock.url, { headers: { Accept: 'application/xml' } });
  if (!res.ok) {
    console.error(`download failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  verify(buf, 'downloaded');
  mkdirSync(dirname(lock.path), { recursive: true });
  writeFileSync(lock.path, buf);
  console.log(`wrote ${lock.path}`);
}
