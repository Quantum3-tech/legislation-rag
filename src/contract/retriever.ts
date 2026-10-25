// SEALED. See CLAUDE.md rule 3 and DESIGN.md section 14.
// The interface every first-stage retriever, fusion and reranker exposes.

export interface Hit {
  chunkId: string;
  provisionId: string;
  /** Retriever-specific score; higher is better. Not comparable across retrievers. */
  score: number;
  /** 1-based rank in this retriever's output. */
  rank: number;
}

export interface Retriever {
  readonly name: string;
  /** Returns at most k hits, best first, ranks 1..k. */
  search(query: string, k: number): Promise<Hit[]>;
}
