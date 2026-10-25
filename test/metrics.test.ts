import { describe, expect, it } from 'vitest';
import type { Hit } from '../src/contract/index.js';
import { collapse, recallAt, reciprocalRankAt, ndcgAt, auc, bestThreshold, bootstrapDelta, dist } from '../src/eval/metrics.js';

const hit = (chunkId: string, provisionId: string, rank: number): Hit => ({ chunkId, provisionId, score: 1 / rank, rank });

describe('collapse', () => {
  const hits = [hit('c1', 'A', 1), hit('c2', 'B', 2), hit('c3', 'A', 3), hit('c4', 'C', 4)];
  const tokens: Record<string, number> = { c1: 100, c2: 50, c3: 70, c4: 30 };
  const c = collapse(hits, (id) => tokens[id]!);

  it('keeps first occurrence of each provision in rank order', () => {
    expect(c.provisions).toEqual(['A', 'B', 'C']);
  });

  it('counts tokens read to reach k distinct provisions, duplicates included', () => {
    expect(c.tokensAt(1)).toBe(100);
    expect(c.tokensAt(2)).toBe(150);
    expect(c.tokensAt(3)).toBe(250); // c3 (duplicate of A) is read before C appears
    expect(c.tokensAt(10)).toBe(250); // list exhausted
  });
});

describe('quality metrics', () => {
  const labels = [{ id: 'A', grade: 2 as const }, { id: 'B', grade: 1 as const }];

  it('recall@k is the share of labelled provisions in the top k', () => {
    expect(recallAt(['X', 'A', 'Y', 'B'], labels, 2)).toBe(0.5);
    expect(recallAt(['X', 'A', 'Y', 'B'], labels, 4)).toBe(1);
    expect(recallAt([], labels, 5)).toBe(0);
  });

  it('reciprocal rank uses the first relevant hit within k', () => {
    expect(reciprocalRankAt(['X', 'B', 'A'], labels, 10)).toBe(0.5);
    expect(reciprocalRankAt(['X', 'Y'], labels, 10)).toBe(0);
    expect(reciprocalRankAt(['X', 'Y', 'A'], labels, 2)).toBe(0);
  });

  it('ndcg rewards the grade-2 provision above the grade-1 one', () => {
    const ideal = ndcgAt(['A', 'B'], labels, 10);
    const swapped = ndcgAt(['B', 'A'], labels, 10);
    expect(ideal).toBe(1);
    expect(swapped).toBeLessThan(1);
    expect(swapped).toBeCloseTo((1 / Math.log2(2) + 2 / Math.log2(3)) / (2 / Math.log2(2) + 1 / Math.log2(3)));
    expect(ndcgAt(['X'], labels, 10)).toBe(0);
  });

  it('metrics are NaN for unanswerable questions', () => {
    expect(recallAt(['A'], [], 5)).toBeNaN();
    expect(ndcgAt(['A'], [], 5)).toBeNaN();
  });
});

describe('abstention statistics', () => {
  it('auc is 1 when every answerable score beats every unanswerable score', () => {
    expect(auc([3, 4, 5], [1, 2])).toBe(1);
    expect(auc([1, 2], [3, 4])).toBe(0);
    expect(auc([1, 1], [1, 1])).toBe(0.5);
  });

  it('best threshold maximises balanced accuracy', () => {
    const bt = bestThreshold([3, 4, 5], [1, 2]);
    expect(bt.balancedAccuracy).toBe(1);
    expect(bt.threshold).toBeGreaterThan(2);
    expect(bt.threshold).toBeLessThanOrEqual(3);
  });
});

describe('bootstrap', () => {
  it('reports the paired delta with wins and losses', () => {
    const a = [0.5, 0.5, 0.5, 0.5];
    const b = [0.6, 0.7, 0.5, 0.4];
    const r = bootstrapDelta(a, b, 200);
    expect(r.delta).toBeCloseTo(0.05);
    expect(r.wins).toBe(2);
    expect(r.losses).toBe(1);
    expect(r.ties).toBe(1);
    expect(r.lo).toBeLessThanOrEqual(r.delta);
    expect(r.hi).toBeGreaterThanOrEqual(r.delta);
  });

  it('dist gives median and p90', () => {
    expect(dist([5, 1, 3, 2, 4])).toEqual({ median: 3, p90: 5 });
  });
});
