// SEALED. See CLAUDE.md rule 3 and DESIGN.md sections 9 and 14.
// The output shape of one evaluation run.

export interface RunConfig {
  chunker: string;
  /** "bm25" | "dense" | "hybrid" */
  retriever: string;
  /** Present for hybrid: "rrf-60" | "minmax-0.5" */
  fusion?: string;
  rerank?: { model: string; depth: number };
  embedder?: string;
}

export interface Dist {
  median: number;
  p90: number;
}

export interface AbstentionStat {
  /** Probability a random answerable question scores above a random unanswerable one. */
  auc: number;
  /** Mean of true positive rate and true negative rate at the best single threshold. */
  balancedAccuracy: number;
  threshold: number;
  medianAnswerable: number;
  medianUnanswerable: number;
}

export interface PerQuestion {
  id: string;
  type: string;
  recall5: number;
  recall10: number;
  recall20: number;
  rr10: number;
  ndcg10: number;
  tokens5: number;
  tokens10: number;
  top1Score: number;
  top5MeanScore: number;
  /** Provision ids in ranked order, first 20, for inspection. */
  top20: string[];
}

export interface TypeBreakdown {
  n: number;
  recall10: number;
  mrr10: number;
  ndcg10: number;
}

export interface RunResult {
  config: RunConfig;
  /** Answerable questions scored. Every table derived from this result states it. */
  n: number;
  recall: { 5: number; 10: number; 20: number };
  mrr10: number;
  ndcg10: number;
  /** Retrieved token volume to reach k distinct provisions, over the n answerable questions. */
  tokens: { 5: Dist; 10: Dist };
  byType: Record<'single' | 'multi', TypeBreakdown>;
  perQuestion: PerQuestion[];
  abstention: {
    nAnswerable: number;
    nUnanswerable: number;
    top1: AbstentionStat;
    top5Mean: AbstentionStat;
  };
  latencyMs: { retrieveP50: number; rerankP50?: number };
  startedAt: string;
  machine: string;
}
