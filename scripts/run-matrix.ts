import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import type { Chunk, Hit, Query, QuestionSet, RunResult, RunConfig, PerQuestion } from '../src/contract/index.js';
import { CHUNKERS } from '../src/chunkers/index.js';
import { searchBm25, type Bm25Index } from '../src/retrieval/bm25.js';
import { loadEmbedder, embedChunksCached, DenseRetriever } from '../src/retrieval/embed.js';
import { rrf, minmax } from '../src/retrieval/fusion.js';
import { loadReranker, applyRerank, RERANK_MODEL } from '../src/retrieval/rerank.js';
import { collapse, recallAt, reciprocalRankAt, ndcgAt, dist, mean, abstentionStat } from '../src/eval/metrics.js';
import { EMBED_MODEL } from '../src/tokenizer.js';

// Runs the full matrix: every chunker x {bm25, dense, hybrid rrf, hybrid minmax}
// x rerank {none, 20, 50}. Writes one RunResult per configuration to
// results/runs/ and an index to results/matrix.json.
// Usage: tsx scripts/run-matrix.ts [chunker ...]

const CANDIDATES = 100;
const RERANK_DEPTHS = [20, 50];
const MAX_DEPTH = Math.max(...RERANK_DEPTHS);

const qs: QuestionSet = JSON.parse(readFileSync('eval/questions.json', 'utf8'));
const queries: Query[] = qs.questions;
const answerable = queries.filter((q) => q.type !== 'unanswerable');
const unanswerable = queries.filter((q) => q.type === 'unanswerable');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHUNKERS);
const machine = `${cpus()[0]?.model.trim() ?? 'unknown'} x${cpus().length}, node ${process.version}`;

const embedder = await loadEmbedder(EMBED_MODEL);
const reranker = await loadReranker(RERANK_MODEL);
const queryVecs = await embedder.embed(queries.map((q) => q.question), 'query');

mkdirSync('results/runs', { recursive: true });
const index: { file: string; config: RunConfig; n: number; ndcg10: number; recall10: number; mrr10: number; tokens10Median: number }[] =
  existsSync('results/matrix.json') ? JSON.parse(readFileSync('results/matrix.json', 'utf8')).runs : [];

const p50 = (xs: number[]) => dist(xs).median;

for (const chunker of wanted) {
  const chunks: Chunk[] = JSON.parse(readFileSync(`data/index/${chunker}/chunks.json`, 'utf8'));
  const bm25: Bm25Index = JSON.parse(readFileSync(`data/index/${chunker}/bm25.json`, 'utf8'));
  const matrix = await embedChunksCached(chunker, chunks, embedder);
  const dense = new DenseRetriever(chunks, matrix, embedder);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const tokensOf = (id: string) => byId.get(id)!.tokens;

  // First-stage lists per query, with timings.
  type Stage = { key: string; retriever: string; fusion?: string; lists: Hit[][]; ms: number[] };
  const stages: Stage[] = [
    { key: 'bm25', retriever: 'bm25', lists: [], ms: [] },
    { key: 'dense', retriever: 'dense', lists: [], ms: [] },
    { key: 'hybrid-rrf', retriever: 'hybrid', fusion: 'rrf-60', lists: [], ms: [] },
    { key: 'hybrid-minmax', retriever: 'hybrid', fusion: 'minmax-0.5', lists: [], ms: [] },
  ];
  queries.forEach((q, qi) => {
    let t = performance.now();
    const b = searchBm25(bm25, q.question, CANDIDATES);
    const bMs = performance.now() - t;
    t = performance.now();
    const d = dense.searchVector(queryVecs[qi]!, CANDIDATES);
    const dMs = performance.now() - t;
    t = performance.now();
    const r = rrf([b, d], 60);
    const rMs = performance.now() - t;
    t = performance.now();
    const m = minmax([b, d], 0.5);
    const mMs = performance.now() - t;
    stages[0]!.lists.push(b); stages[0]!.ms.push(bMs);
    stages[1]!.lists.push(d); stages[1]!.ms.push(dMs);
    stages[2]!.lists.push(r); stages[2]!.ms.push(bMs + dMs + rMs);
    stages[3]!.lists.push(m); stages[3]!.ms.push(bMs + dMs + mMs);
  });

  // Cross-encoder scores for every chunk that appears in any stage's top MAX_DEPTH, per query.
  const ceScores: Map<string, number>[] = [];
  const ceMs: number[] = [];
  for (let qi = 0; qi < queries.length; qi++) {
    const need = new Set<string>();
    for (const s of stages) for (const h of s.lists[qi]!.slice(0, MAX_DEPTH)) need.add(h.chunkId);
    const ids = [...need];
    const t = performance.now();
    const scores = await reranker.score(queries[qi]!.question, ids.map((id) => byId.get(id)!.text));
    const ms = performance.now() - t;
    ceMs.push(ms / Math.max(1, ids.length)); // per pair
    ceScores.push(new Map(ids.map((id, i) => [id, scores[i]!])));
    if (qi % 10 === 9) console.log(`${chunker}: reranked ${qi + 1}/${queries.length} queries`);
  }

  for (const stage of stages) {
    for (const depth of [0, ...RERANK_DEPTHS]) {
      const config: RunConfig = { chunker, retriever: stage.retriever, embedder: EMBED_MODEL };
      if (stage.fusion) config.fusion = stage.fusion;
      if (depth) config.rerank = { model: RERANK_MODEL, depth };
      const per: PerQuestion[] = [];
      const top1: Record<'a' | 'u', number[]> = { a: [], u: [] };
      const top5: Record<'a' | 'u', number[]> = { a: [], u: [] };
      queries.forEach((q, qi) => {
        const list = depth ? applyRerank(stage.lists[qi]!, depth, ceScores[qi]!) : stage.lists[qi]!;
        const c = collapse(list, tokensOf);
        const t1 = list[0]?.score ?? 0;
        const t5 = mean(list.slice(0, 5).map((h) => h.score));
        const bucket = q.type === 'unanswerable' ? 'u' : 'a';
        top1[bucket].push(t1); top5[bucket].push(Number.isNaN(t5) ? 0 : t5);
        per.push({
          id: q.id, type: q.type,
          recall5: recallAt(c.provisions, q.relevant, 5),
          recall10: recallAt(c.provisions, q.relevant, 10),
          recall20: recallAt(c.provisions, q.relevant, 20),
          rr10: reciprocalRankAt(c.provisions, q.relevant, 10),
          ndcg10: ndcgAt(c.provisions, q.relevant, 10),
          tokens5: c.tokensAt(5), tokens10: c.tokensAt(10),
          top1Score: t1, top5MeanScore: Number.isNaN(t5) ? 0 : t5,
          top20: c.provisions.slice(0, 20),
        });
      });
      const ans = per.filter((p) => p.type !== 'unanswerable');
      const byType = (t: 'single' | 'multi') => {
        const xs = ans.filter((p) => p.type === t);
        return { n: xs.length, recall10: mean(xs.map((x) => x.recall10)), mrr10: mean(xs.map((x) => x.rr10)), ndcg10: mean(xs.map((x) => x.ndcg10)) };
      };
      const result: RunResult = {
        config,
        n: ans.length,
        recall: { 5: mean(ans.map((x) => x.recall5)), 10: mean(ans.map((x) => x.recall10)), 20: mean(ans.map((x) => x.recall20)) },
        mrr10: mean(ans.map((x) => x.rr10)),
        ndcg10: mean(ans.map((x) => x.ndcg10)),
        tokens: { 5: dist(ans.map((x) => x.tokens5)), 10: dist(ans.map((x) => x.tokens10)) },
        byType: { single: byType('single'), multi: byType('multi') },
        perQuestion: per,
        abstention: { nAnswerable: answerable.length, nUnanswerable: unanswerable.length, top1: abstentionStat(top1.a, top1.u), top5Mean: abstentionStat(top5.a, top5.u) },
        latencyMs: depth ? { retrieveP50: p50(stage.ms), rerankP50: p50(ceMs) * depth } : { retrieveP50: p50(stage.ms) },
        startedAt: new Date().toISOString(),
        machine,
      };
      const file = `results/runs/${chunker}__${stage.key}__rerank-${depth}.json`;
      writeFileSync(file, JSON.stringify(result, null, 1));
      const row = { file, config, n: result.n, ndcg10: result.ndcg10, recall10: result.recall[10], mrr10: result.mrr10, tokens10Median: result.tokens[10].median };
      const i = index.findIndex((r) => r.file === file);
      if (i >= 0) index[i] = row; else index.push(row);
      console.log(`${chunker.padEnd(19)} ${stage.key.padEnd(14)} rerank@${String(depth).padEnd(3)} n=${result.n} nDCG@10=${result.ndcg10.toFixed(3)} R@10=${result.recall[10].toFixed(3)} MRR@10=${result.mrr10.toFixed(3)} tok@10=${result.tokens[10].median} auc1=${result.abstention.top1.auc.toFixed(2)}`);
    }
  }
  writeFileSync('results/matrix.json', JSON.stringify({ machine, questions: queries.length, answerable: answerable.length, unanswerable: unanswerable.length, runs: index }, null, 1));
}
