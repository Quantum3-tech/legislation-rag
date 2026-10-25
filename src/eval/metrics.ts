import type { Hit, RelevanceLabel, AbstentionStat, Dist } from '../contract/index.js';

// All quality metrics are computed over provisions after collapsing a ranked
// chunk list, first occurrence wins. Relevant means grade 1 or 2.

export interface Collapsed {
  /** Distinct provision ids in rank order. */
  provisions: string[];
  /** Tokens read, from the top of the chunk list, to first see k distinct provisions. */
  tokensAt(k: number): number;
}

export function collapse(hits: Hit[], tokensOf: (chunkId: string) => number): Collapsed {
  const provisions: string[] = [];
  const seen = new Set<string>();
  const cumulative: number[] = []; // cumulative tokens at the point each new provision first appears
  let running = 0;
  for (const h of hits) {
    running += tokensOf(h.chunkId);
    if (!seen.has(h.provisionId)) {
      seen.add(h.provisionId);
      provisions.push(h.provisionId);
      cumulative.push(running);
    }
  }
  return {
    provisions,
    tokensAt: (k) => (cumulative.length === 0 ? 0 : cumulative[Math.min(k, cumulative.length) - 1]!),
  };
}

export function recallAt(ranked: string[], labels: RelevanceLabel[], k: number): number {
  if (!labels.length) return NaN;
  const rel = new Set(labels.map((l) => l.id));
  const top = ranked.slice(0, k);
  let hit = 0;
  for (const id of rel) if (top.includes(id)) hit++;
  return hit / rel.size;
}

export function reciprocalRankAt(ranked: string[], labels: RelevanceLabel[], k: number): number {
  if (!labels.length) return NaN;
  const rel = new Set(labels.map((l) => l.id));
  for (let i = 0; i < Math.min(k, ranked.length); i++) if (rel.has(ranked[i]!)) return 1 / (i + 1);
  return 0;
}

export function ndcgAt(ranked: string[], labels: RelevanceLabel[], k: number): number {
  if (!labels.length) return NaN;
  const grade = new Map(labels.map((l) => [l.id, l.grade]));
  let dcg = 0;
  for (let i = 0; i < Math.min(k, ranked.length); i++) {
    const g = grade.get(ranked[i]!) ?? 0;
    if (g) dcg += g / Math.log2(i + 2);
  }
  const ideal = [...grade.values()].sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  ideal.forEach((g, i) => { idcg += g / Math.log2(i + 2); });
  return idcg ? dcg / idcg : 0;
}

export function dist(values: number[]): Dist {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0);
  return { median: q(0.5), p90: q(0.9) };
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

export function median(values: number[]): number {
  return dist(values).median;
}

/** AUC as the Mann-Whitney statistic: P(positive > negative), ties count half. */
export function auc(positives: number[], negatives: number[]): number {
  if (!positives.length || !negatives.length) return NaN;
  let s = 0;
  for (const p of positives) for (const n of negatives) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (positives.length * negatives.length);
}

/** Best single threshold by balanced accuracy, predicting "answerable" when score >= threshold. */
export function bestThreshold(positives: number[], negatives: number[]): { threshold: number; balancedAccuracy: number } {
  const all = [...new Set([...positives, ...negatives])].sort((a, b) => a - b);
  const candidates = [-Infinity, ...all.slice(1).map((v, i) => (v + all[i]!) / 2), Infinity];
  let best = { threshold: -Infinity, balancedAccuracy: 0 };
  for (const t of candidates) {
    const tpr = positives.filter((p) => p >= t).length / positives.length;
    const tnr = negatives.filter((n) => n < t).length / negatives.length;
    const ba = (tpr + tnr) / 2;
    if (ba > best.balancedAccuracy) best = { threshold: t, balancedAccuracy: ba };
  }
  return best;
}

export function abstentionStat(positives: number[], negatives: number[]): AbstentionStat {
  const bt = bestThreshold(positives, negatives);
  return {
    auc: auc(positives, negatives),
    balancedAccuracy: bt.balancedAccuracy,
    threshold: bt.threshold,
    medianAnswerable: median(positives),
    medianUnanswerable: median(negatives),
  };
}

/** Paired bootstrap over questions for the mean difference b - a. Deterministic seed. */
export function bootstrapDelta(a: number[], b: number[], resamples = 1000, seed = 42): { delta: number; lo: number; hi: number; wins: number; losses: number; ties: number } {
  if (a.length !== b.length) throw new Error('paired arrays must match');
  const n = a.length;
  const d = a.map((x, i) => b[i]! - x);
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += d[Math.floor(rnd() * n)]!;
    means.push(sum / n);
  }
  means.sort((x, y) => x - y);
  const eps = 1e-9;
  return {
    delta: mean(d),
    lo: means[Math.floor(0.025 * resamples)]!,
    hi: means[Math.min(resamples - 1, Math.floor(0.975 * resamples))]!,
    wins: d.filter((x) => x > eps).length,
    losses: d.filter((x) => x < -eps).length,
    ties: d.filter((x) => Math.abs(x) <= eps).length,
  };
}
