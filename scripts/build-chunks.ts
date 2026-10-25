import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { Corpus } from '../src/corpus/types.js';
import type { Chunk } from '../src/contract/index.js';
import { CHUNKERS, EMBED_WINDOW } from '../src/chunkers/index.js';
import { loadTokenCounter } from '../src/tokenizer.js';
import { buildBm25 } from '../src/retrieval/bm25.js';
import { dist } from '../src/eval/metrics.js';

// Builds every chunker's output and BM25 index under data/index/<chunker>/.
// Usage: tsx scripts/build-chunks.ts [chunker ...]

const corpus: Corpus = JSON.parse(readFileSync('data/corpus.json', 'utf8'));
const tc = await loadTokenCounter();
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHUNKERS);
const summary: Record<string, unknown>[] = [];

for (const key of wanted) {
  const chunker = CHUNKERS[key];
  if (!chunker) throw new Error(`unknown chunker ${key}`);
  const t0 = performance.now();
  const chunks: Chunk[] = chunker(corpus.provisions, tc);
  const ms = Math.round(performance.now() - t0);
  const dir = `data/index/${key}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/chunks.json`, JSON.stringify(chunks));
  const t1 = performance.now();
  writeFileSync(`${dir}/bm25.json`, JSON.stringify(buildBm25(chunks)));
  const bm25Ms = Math.round(performance.now() - t1);
  const tokens = chunks.map((c) => c.tokens);
  const d = dist(tokens);
  const row = {
    chunker: key,
    chunks: chunks.length,
    provisions: new Set(chunks.map((c) => c.provisionId)).size,
    tokensMedian: d.median,
    tokensP90: d.p90,
    tokensMax: Math.max(...tokens),
    overWindow: tokens.filter((t) => t > EMBED_WINDOW).length,
    totalTokens: tokens.reduce((a, b) => a + b, 0),
    chunkMs: ms,
    bm25Ms,
  };
  summary.push(row);
  console.log(JSON.stringify(row));
}
mkdirSync('results', { recursive: true });
writeFileSync('results/chunkers.json', JSON.stringify({ builtAt: new Date().toISOString(), embedWindow: EMBED_WINDOW, rows: summary }, null, 2));
