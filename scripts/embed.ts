import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import type { Chunk } from '../src/contract/index.js';
import { CHUNKERS } from '../src/chunkers/index.js';
import { loadEmbedder, embedChunksCached } from '../src/retrieval/embed.js';
import { EMBED_MODEL } from '../src/tokenizer.js';

// Embeds every chunker's chunks with the embedding model, caching to disk.
// Usage: tsx scripts/embed.ts [chunker ...]

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHUNKERS);
const embedder = await loadEmbedder(EMBED_MODEL);
const rows: Record<string, unknown>[] = existsSync('results/embedding.json') ? JSON.parse(readFileSync('results/embedding.json', 'utf8')).rows : [];
for (const key of wanted) {
  const chunks: Chunk[] = JSON.parse(readFileSync(`data/index/${key}/chunks.json`, 'utf8'));
  const t0 = performance.now();
  await embedChunksCached(key, chunks, embedder, (m) => console.log(m));
  const ms = Math.round(performance.now() - t0);
  const tokens = chunks.reduce((a, c) => a + Math.min(c.tokens, 512), 0);
  const row = { chunker: key, model: EMBED_MODEL, chunks: chunks.length, tokensEmbedded: tokens, ms, chunksPerSec: +(chunks.length / (ms / 1000)).toFixed(1), tokensPerSec: Math.round(tokens / (ms / 1000)) };
  console.log(JSON.stringify(row));
  const i = rows.findIndex((r) => r.chunker === key);
  if (i >= 0) rows[i] = row; else rows.push(row);
  writeFileSync('results/embedding.json', JSON.stringify({ machine: `${cpus()[0]?.model ?? 'unknown'} x${cpus().length}`, node: process.version, rows }, null, 2));
}
