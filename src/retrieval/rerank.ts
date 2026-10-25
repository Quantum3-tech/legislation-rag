import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';
import type { Hit } from '../contract/index.js';
import { MODEL_CACHE } from '../tokenizer.js';

env.cacheDir = MODEL_CACHE;

export const RERANK_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';

export interface Reranker {
  readonly name: string;
  /** One relevance logit per text, higher is more relevant. */
  score(query: string, texts: string[]): Promise<number[]>;
}

export async function loadReranker(model = RERANK_MODEL, batchSize = 16): Promise<Reranker> {
  const tokenizer = await AutoTokenizer.from_pretrained(model);
  const clf = await AutoModelForSequenceClassification.from_pretrained(model, { dtype: 'fp32' });
  return {
    name: model,
    async score(query, texts) {
      const out: number[] = new Array(texts.length);
      for (let s = 0; s < texts.length; s += batchSize) {
        const batch = texts.slice(s, s + batchSize);
        const inputs = tokenizer(new Array(batch.length).fill(query), { text_pair: batch, padding: true, truncation: true });
        const { logits } = await clf(inputs);
        const data = logits.data as Float32Array;
        for (let i = 0; i < batch.length; i++) out[s + i] = data[i]!;
      }
      return out;
    },
  };
}

/**
 * Reorders the first `depth` hits by cross-encoder score; the rest keep their
 * order and are given scores below the reranked block so the list stays
 * monotone. Scores for the reranked block are the raw logits.
 */
export function applyRerank(hits: Hit[], depth: number, scores: Map<string, number>): Hit[] {
  const head = hits.slice(0, depth).map((h) => ({ ...h, score: scores.get(h.chunkId) ?? -Infinity }));
  head.sort((a, b) => b.score - a.score || a.rank - b.rank);
  const floor = head.length ? Math.min(...head.map((h) => h.score)) : 0;
  const tail = hits.slice(depth).map((h, i) => ({ ...h, score: floor - 1 - i * 1e-6 }));
  return [...head, ...tail].map((h, i) => ({ ...h, rank: i + 1 }));
}
