import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Chunk, Hit, Retriever } from '../contract/index.js';
import { EMBED_MODEL, MODEL_CACHE } from '../tokenizer.js';

env.cacheDir = MODEL_CACHE;

/** bge-small-en-v1.5 model card: prefix short queries with this when retrieving passages. */
export const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

export interface Embedder {
  readonly name: string;
  readonly dim: number;
  /** L2-normalised vectors, one per text. Passages are truncated to the model window. */
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

export async function loadEmbedder(model = EMBED_MODEL, batchSize = 16): Promise<Embedder> {
  // The pipeline() overloads are too wide for the checker; the task string fixes the type.
  const extractor = (await (pipeline as unknown as (t: string, m: string, o: object) => Promise<FeatureExtractionPipeline>)('feature-extraction', model, { dtype: 'fp32' }));
  let dim = 0;
  return {
    name: model,
    get dim() { return dim; },
    async embed(texts, kind) {
      const inputs = kind === 'query' ? texts.map((t) => QUERY_PREFIX + t) : texts;
      const out: Float32Array[] = new Array(inputs.length);
      // Sort by length so each batch pads to a similar size.
      const order = inputs.map((_, i) => i).sort((a, b) => inputs[a]!.length - inputs[b]!.length);
      for (let s = 0; s < order.length; s += batchSize) {
        const idx = order.slice(s, s + batchSize);
        const t = await extractor(idx.map((i) => inputs[i]!), { pooling: 'cls', normalize: true });
        const [n, d] = t.dims as [number, number];
        dim = d;
        const data = t.data as Float32Array;
        for (let r = 0; r < n; r++) out[idx[r]!] = data.slice(r * d, (r + 1) * d);
      }
      return out;
    },
  };
}

export function modelSlug(model: string): string {
  return model.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

export interface Matrix { n: number; dim: number; data: Float32Array }

/** Embeds a chunker's chunks once and caches the matrix on disk. */
export async function embedChunksCached(chunker: string, chunks: Chunk[], embedder: Embedder, log?: (msg: string) => void): Promise<Matrix> {
  const dir = `data/index/${chunker}`;
  const base = `${dir}/embeddings.${modelSlug(embedder.name)}`;
  if (existsSync(`${base}.json`) && existsSync(`${base}.f32`)) {
    const meta = JSON.parse(readFileSync(`${base}.json`, 'utf8')) as { n: number; dim: number; chunkIds: string[] };
    if (meta.n === chunks.length && meta.chunkIds.every((id, i) => id === chunks[i]!.id)) {
      const buf = readFileSync(`${base}.f32`);
      return { n: meta.n, dim: meta.dim, data: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4) };
    }
  }
  mkdirSync(dir, { recursive: true });
  const t0 = performance.now();
  const vecs: Float32Array[] = [];
  const step = 256;
  for (let s = 0; s < chunks.length; s += step) {
    vecs.push(...await embedder.embed(chunks.slice(s, s + step).map((c) => c.text), 'passage'));
    log?.(`${chunker}: ${Math.min(s + step, chunks.length)}/${chunks.length} chunks, ${Math.round((performance.now() - t0) / 1000)} s`);
  }
  const dim = embedder.dim;
  const data = new Float32Array(chunks.length * dim);
  vecs.forEach((v, i) => data.set(v, i * dim));
  writeFileSync(`${base}.f32`, Buffer.from(data.buffer));
  const ms = Math.round(performance.now() - t0);
  writeFileSync(`${base}.json`, JSON.stringify({ n: chunks.length, dim, model: embedder.name, chunkIds: chunks.map((c) => c.id), embedMs: ms, tokens: chunks.reduce((a, c) => a + c.tokens, 0) }));
  return { n: chunks.length, dim, data };
}

export class DenseRetriever implements Retriever {
  readonly name = 'dense';
  constructor(private readonly chunks: Chunk[], private readonly matrix: Matrix, private readonly embedder: Embedder) {}

  async search(query: string, k: number): Promise<Hit[]> {
    const [q] = await this.embedder.embed([query], 'query');
    return this.searchVector(q!, k);
  }

  searchVector(q: Float32Array, k: number): Hit[] {
    const { n, dim, data } = this.matrix;
    const scores = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const off = i * dim;
      for (let j = 0; j < dim; j++) s += data[off + j]! * q[j]!;
      scores[i] = s;
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => scores[b]! - scores[a]! || a - b).slice(0, k);
    return idx.map((i, r) => ({ chunkId: this.chunks[i]!.id, provisionId: this.chunks[i]!.provisionId, score: scores[i]!, rank: r + 1 }));
  }
}
