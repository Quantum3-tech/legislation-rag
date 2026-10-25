import type { Chunk, Hit, Retriever } from '../contract/index.js';
import { porterStem } from './porter.js';

// Okapi BM25, implemented here rather than imported. k1 = 1.2, b = 0.75.
// Tokeniser: lowercase, split on non-alphanumerics, keep digit tokens and
// digit-letter mixes ("172", "790zg"), drop a short stopword list, Porter stem.

const STOP = new Set(('a an the of to in and or is are be by for on with as at that this it its from not any such ' +
  'which who whom their his her he she they them if so than then has have had does do did was were been being but ' +
  'into under upon where when what how also only other').split(' '));

export function tokenise(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    if (/\d/.test(raw)) { out.push(raw); continue; }
    if (raw.length < 2) continue;
    out.push(porterStem(raw));
  }
  return out;
}

export interface Bm25Index {
  k1: number;
  b: number;
  n: number;
  avgdl: number;
  docLen: number[];
  chunkIds: string[];
  provisionIds: string[];
  /** term -> flat [docIdx, tf, docIdx, tf, ...] */
  postings: Record<string, number[]>;
}

export function buildBm25(chunks: Chunk[], k1 = 1.2, b = 0.75): Bm25Index {
  const postings: Record<string, number[]> = {};
  const docLen: number[] = [];
  chunks.forEach((c, i) => {
    const terms = tokenise(c.text);
    docLen.push(terms.length);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, f] of tf) (postings[t] ??= []).push(i, f);
  });
  const avgdl = docLen.reduce((a, x) => a + x, 0) / Math.max(1, docLen.length);
  return { k1, b, n: chunks.length, avgdl, docLen, chunkIds: chunks.map((c) => c.id), provisionIds: chunks.map((c) => c.provisionId), postings };
}

export function searchBm25(index: Bm25Index, query: string, k: number): Hit[] {
  const scores = new Float64Array(index.n);
  const qterms = new Set(tokenise(query));
  for (const t of qterms) {
    const post = index.postings[t];
    if (!post) continue;
    const df = post.length / 2;
    const idf = Math.log((index.n - df + 0.5) / (df + 0.5) + 1);
    for (let j = 0; j < post.length; j += 2) {
      const d = post[j]!, tf = post[j + 1]!;
      const dl = index.docLen[d]!;
      scores[d] = (scores[d] ?? 0) + idf * (tf * (index.k1 + 1)) / (tf + index.k1 * (1 - index.b + index.b * dl / index.avgdl));
    }
  }
  return topK(scores, k).map((d, i) => ({ chunkId: index.chunkIds[d]!, provisionId: index.provisionIds[d]!, score: scores[d]!, rank: i + 1 }));
}

/** Indices of the k largest strictly positive scores, descending. */
export function topK(scores: ArrayLike<number>, k: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < scores.length; i++) if (scores[i]! > 0) idx.push(i);
  idx.sort((a, b) => scores[b]! - scores[a]! || a - b);
  return idx.slice(0, k);
}

export class Bm25Retriever implements Retriever {
  readonly name = 'bm25';
  constructor(private readonly index: Bm25Index) {}
  async search(query: string, k: number): Promise<Hit[]> {
    return searchBm25(this.index, query, k);
  }
}
