import type { Hit } from '../contract/index.js';

/** Reciprocal rank fusion: score = sum over lists of 1 / (k + rank). */
export function rrf(lists: Hit[][], k = 60): Hit[] {
  const acc = new Map<string, { provisionId: string; score: number }>();
  for (const list of lists) {
    for (const h of list) {
      const cur = acc.get(h.chunkId) ?? { provisionId: h.provisionId, score: 0 };
      cur.score += 1 / (k + h.rank);
      acc.set(h.chunkId, cur);
    }
  }
  return finish(acc);
}

/** Convex combination of per-list min-max normalised scores. alpha weights the first list. */
export function minmax(lists: [Hit[], Hit[]], alpha = 0.5): Hit[] {
  const acc = new Map<string, { provisionId: string; score: number }>();
  lists.forEach((list, li) => {
    if (!list.length) return;
    const w = li === 0 ? alpha : 1 - alpha;
    const scores = list.map((h) => h.score);
    const lo = Math.min(...scores), hi = Math.max(...scores);
    const range = hi - lo || 1;
    for (const h of list) {
      const cur = acc.get(h.chunkId) ?? { provisionId: h.provisionId, score: 0 };
      cur.score += w * (h.score - lo) / range;
      acc.set(h.chunkId, cur);
    }
  });
  return finish(acc);
}

function finish(acc: Map<string, { provisionId: string; score: number }>): Hit[] {
  return [...acc.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .map(([chunkId, v], i) => ({ chunkId, provisionId: v.provisionId, score: v.score, rank: i + 1 }));
}
