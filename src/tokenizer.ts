import { AutoTokenizer, env } from '@huggingface/transformers';

export const EMBED_MODEL = 'Xenova/bge-small-en-v1.5';
export const MODEL_CACHE = 'data/models';

env.cacheDir = MODEL_CACHE;

export interface TokenCounter {
  /** Tokens for `text` including the two special tokens the model adds. */
  count(text: string): number;
  /** Tokens for a single whitespace-delimited word, no special tokens. Cached. */
  wordTokens(word: string): number;
}

export async function loadTokenCounter(model = EMBED_MODEL): Promise<TokenCounter> {
  const tok = await AutoTokenizer.from_pretrained(model);
  const cache = new Map<string, number>();
  return {
    count(text) {
      return Number(tok(text, { add_special_tokens: true, truncation: false }).input_ids!.size);
    },
    wordTokens(word) {
      const cached = cache.get(word);
      if (cached !== undefined) return cached;
      const n = Number(tok(word, { add_special_tokens: false, truncation: false }).input_ids!.size);
      cache.set(word, n);
      return n;
    },
  };
}
