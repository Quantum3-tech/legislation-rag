import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { RunResult } from '../src/contract/index.js';
import { bootstrapDelta } from '../src/eval/metrics.js';

// Generates the results section of README.md from results/runs/*.json.
// Nothing numeric in that section is typed by hand. Usage: tsx scripts/report.ts

const matrix = JSON.parse(readFileSync('results/matrix.json', 'utf8')) as { machine: string; questions: number; answerable: number; unanswerable: number; runs: { file: string }[] };
const runs: RunResult[] = matrix.runs.map((r) => JSON.parse(readFileSync(r.file, 'utf8')));
const chunkerStats = JSON.parse(readFileSync('results/chunkers.json', 'utf8')) as { rows: { chunker: string; chunks: number; provisions: number; tokensMedian: number; tokensP90: number; overWindow: number }[] };
const embedding = existsSync('results/embedding.json') ? JSON.parse(readFileSync('results/embedding.json', 'utf8')) as { rows: { chunker: string; chunks: number; ms: number; chunksPerSec: number }[] } : { rows: [] };

const CHUNKERS = ['section', 'section-split', 'subsection', 'subsection-context', 'fixed-256', 'fixed-512'];
const stageOf = (r: RunResult) => (r.config.retriever === 'hybrid' ? (r.config.fusion === 'rrf-60' ? 'hybrid-rrf' : 'hybrid-minmax') : r.config.retriever);
const get = (chunker: string, stage: string, depth: number): RunResult | undefined =>
  runs.find((r) => r.config.chunker === chunker && stageOf(r) === stage && (r.config.rerank?.depth ?? 0) === depth);
const must = (chunker: string, stage: string, depth: number): RunResult => {
  const r = get(chunker, stage, depth);
  if (!r) throw new Error(`missing run ${chunker}/${stage}/${depth}`);
  return r;
};
const baseline = must('section', 'bm25', 0);

const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const int = (x: number) => Math.round(x).toLocaleString('en-GB');
const sign = (x: number) => (x > 0 ? '+' : '') + f3(x);

function delta(a: RunResult, b: RunResult) {
  const ids = a.perQuestion.filter((p) => p.type !== 'unanswerable').map((p) => p.id);
  const pick = (r: RunResult) => ids.map((id) => r.perQuestion.find((p) => p.id === id)!.ndcg10);
  return bootstrapDelta(pick(a), pick(b));
}
function deltaCell(a: RunResult, b: RunResult): string {
  const d = delta(a, b);
  const verdict = d.lo > 0 ? 'better' : d.hi < 0 ? 'worse' : 'no measurable difference';
  return `${sign(d.delta)} [${sign(d.lo)}, ${sign(d.hi)}] ${d.wins}W/${d.losses}L/${d.ties}T, ${verdict}`;
}
const label = (r: RunResult) => {
  const s = stageOf(r);
  const base = s === 'bm25' ? 'BM25' : s === 'dense' ? 'dense' : s === 'hybrid-rrf' ? 'hybrid RRF' : 'hybrid min-max 0.5';
  return r.config.rerank ? `${base} + rerank@${r.config.rerank.depth}` : base;
};
const row = (r: RunResult, withDelta = true) =>
  `| ${r.config.chunker} | ${label(r)} | ${f3(r.ndcg10)} | ${f3(r.recall[10])} | ${f3(r.mrr10)} | ${f3(r.recall[5])} | ${f3(r.recall[20])} | ${int(r.tokens[10].median)} | ${int(r.tokens[10].p90)} |${withDelta ? ` ${r === baseline ? 'baseline' : deltaCell(baseline, r)} |` : ''}`;
const HEAD = '| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 | nDCG@10 vs baseline [95% CI] wins/losses/ties |\n|---|---|---|---|---|---|---|---|---|---|';
const HEAD_ND = '| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 |\n|---|---|---|---|---|---|---|---|---|';

const out: string[] = [];
const n = baseline.n;
out.push(`All quality metrics below are over the n=${n} answerable questions, at provision level after collapsing chunks. Token columns are the tokens a reader takes in to see 10 distinct provisions, median and 90th percentile over the same n=${n}. Confidence intervals are paired bootstraps over the ${n} questions, 1,000 resamples. Machine: ${matrix.machine}.`);

out.push(`\n### Table 1. The chunking decision (n=${n})\n\nHybrid RRF retrieval, no reranking, every chunker, with the baseline (BM25 over whole sections) first.\n`);
out.push(HEAD);
out.push(row(baseline));
for (const c of CHUNKERS) out.push(row(must(c, 'hybrid-rrf', 0)));

out.push(`\n### Table 2. The retriever decision on whole-section chunks (n=${n})\n`);
out.push(HEAD);
for (const s of ['bm25', 'dense', 'hybrid-rrf', 'hybrid-minmax']) for (const d of [0, 20, 50]) out.push(row(must('section', s, d)));

out.push(`\n### Table 3. The reranking decision across chunkers, hybrid RRF first stage (n=${n})\n`);
out.push(HEAD);
for (const c of CHUNKERS) for (const d of [0, 20, 50]) out.push(row(must(c, 'hybrid-rrf', d)));

out.push(`\n### Table 4. BM25 alone against dense alone, every chunker, no reranking (n=${n})\n`);
out.push(HEAD);
for (const c of CHUNKERS) for (const s of ['bm25', 'dense']) out.push(row(must(c, s, 0)));

out.push(`\n### Table 5. Single-section against multi-section questions (n=${must('section','hybrid-rrf',0).byType.single.n} single, n=${must('section','hybrid-rrf',0).byType.multi.n} multi)\n`);
out.push('| chunker | retriever | single nDCG@10 | single R@10 | single MRR@10 | multi nDCG@10 | multi R@10 | multi MRR@10 |\n|---|---|---|---|---|---|---|---|');
for (const [c, s, d] of [['section', 'bm25', 0], ['section', 'dense', 0], ['section', 'hybrid-rrf', 0], ['section', 'hybrid-rrf', 20], ['section-split', 'hybrid-rrf', 0], ['section-split', 'hybrid-rrf', 20], ['subsection-context', 'hybrid-rrf', 0]] as const) {
  const r = must(c, s, d);
  out.push(`| ${c} | ${label(r)} | ${f3(r.byType.single.ndcg10)} | ${f3(r.byType.single.recall10)} | ${f3(r.byType.single.mrr10)} | ${f3(r.byType.multi.ndcg10)} | ${f3(r.byType.multi.recall10)} | ${f3(r.byType.multi.mrr10)} |`);
}

const ab = must('section', 'hybrid-rrf', 0).abstention;
out.push(`\n### Table 6. Can the retriever tell it has nothing? (n=${ab.nAnswerable} answerable against n=${ab.nUnanswerable} unanswerable)\n\nAUC is the probability that a random answerable question's score beats a random unanswerable one's; 0.5 is chance. Balanced accuracy is at the best single threshold, chosen on these same questions, so it is optimistic.\n`);
out.push('| chunker | retriever | score used | AUC top-1 | bal. acc. top-1 | median top-1 answerable | median top-1 unanswerable | AUC top-5 mean | bal. acc. top-5 mean |\n|---|---|---|---|---|---|---|---|---|');
for (const [c, s, d] of [['section', 'bm25', 0], ['section', 'dense', 0], ['section', 'hybrid-rrf', 0], ['section', 'hybrid-rrf', 20], ['section', 'hybrid-rrf', 50], ['section-split', 'hybrid-rrf', 20], ['subsection-context', 'hybrid-rrf', 20], ['section', 'bm25', 20], ['section', 'dense', 20]] as const) {
  const r = must(c, s, d);
  const a = r.abstention;
  const used = r.config.rerank ? 'cross-encoder logit' : s === 'bm25' ? 'BM25 score' : s === 'dense' ? 'cosine' : 'fused score';
  out.push(`| ${c} | ${label(r)} | ${used} | ${f2(a.top1.auc)} | ${f2(a.top1.balancedAccuracy)} | ${f2(a.top1.medianAnswerable)} | ${f2(a.top1.medianUnanswerable)} | ${f2(a.top5Mean.auc)} | ${f2(a.top5Mean.balancedAccuracy)} |`);
}

out.push(`\n### Table 7. Cost: chunk counts, embedding time, query latency\n`);
out.push('| chunker | chunks | provisions reachable | chunk tokens median | chunk tokens p90 | chunks over 512 | embed time (s) | chunks/s | BM25 p50 (ms) | dense p50 (ms) | hybrid p50 (ms) | rerank@20 p50 (ms) | rerank@50 p50 (ms) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const c of CHUNKERS) {
  const cs = chunkerStats.rows.find((x) => x.chunker === c)!;
  const em = embedding.rows.find((x) => x.chunker === c);
  const b = must(c, 'bm25', 0), d = must(c, 'dense', 0), h = must(c, 'hybrid-rrf', 0), r20 = must(c, 'hybrid-rrf', 20), r50 = must(c, 'hybrid-rrf', 50);
  out.push(`| ${c} | ${int(cs.chunks)} | ${int(cs.provisions)} of 1,959 | ${cs.tokensMedian} | ${cs.tokensP90} | ${cs.overWindow} | ${em ? int(em.ms / 1000) : 'n/a'} | ${em ? em.chunksPerSec : 'n/a'} | ${f2(b.latencyMs.retrieveP50)} | ${f2(d.latencyMs.retrieveP50)} | ${f2(h.latencyMs.retrieveP50)} | ${int(r20.latencyMs.rerankP50 ?? 0)} | ${int(r50.latencyMs.rerankP50 ?? 0)} |`);
}

// Predictions from DESIGN.md section 3, checked mechanically.
out.push(`\n### Table 8. The predictions in DESIGN.md, held or broken (n=${n})\n`);
out.push('| # | prediction | result | verdict |\n|---|---|---|---|');
{
  const order = ['section-split', 'section', 'fixed-256', 'subsection-context', 'subsection'];
  const scores = order.map((c) => [c, must(c, 'hybrid-rrf', 0).ndcg10] as const);
  const actual = [...scores].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const gap = must('section-split', 'hybrid-rrf', 0).ndcg10 - must('section', 'hybrid-rrf', 0).ndcg10;
  const held = actual.join(',') === order.join(',') && gap <= 0.02;
  out.push(`| 1 | hybrid RRF, no rerank: nDCG@10 order E, A, D, C, B with E minus A at most 0.02 | actual order ${actual.join(' > ')} (${scores.map(([c, s]) => `${c} ${f3(s)}`).join('; ')}); E minus A = ${sign(gap)} | ${held ? 'held' : 'broken'} |`);
}
{
  const b = must('subsection', 'dense', 0).ndcg10, c = must('subsection-context', 'dense', 0).ndcg10;
  out.push(`| 2 | dense only, no rerank: B at least 0.10 below C on nDCG@10 | B ${f3(b)}, C ${f3(c)}, gap ${sign(c - b)} | ${c - b >= 0.10 ? 'held' : 'broken'} |`);
}
{
  const bm = must('section', 'bm25', 0), de = must('section', 'dense', 0), hy = must('section', 'hybrid-rrf', 0);
  const g = hy.ndcg10 - bm.ndcg10;
  const multiGain = hy.byType.multi.ndcg10 - bm.byType.multi.ndcg10, singleGain = hy.byType.single.ndcg10 - bm.byType.single.ndcg10;
  const held = bm.ndcg10 > de.ndcg10 && g > 0 && g < 0.05 && multiGain > singleGain;
  out.push(`| 3 | section, no rerank: BM25 nDCG@10 above dense; hybrid minus BM25 in (0, 0.05); hybrid gain larger on multi than single | BM25 ${f3(bm.ndcg10)}, dense ${f3(de.ndcg10)}, hybrid ${f3(hy.ndcg10)} (${sign(g)}); gain multi ${sign(multiGain)} vs single ${sign(singleGain)} | ${held ? 'held' : 'broken'} |`);
}
{
  const h0 = must('section', 'hybrid-rrf', 0), h20 = must('section', 'hybrid-rrf', 20), h50 = must('section', 'hybrid-rrf', 50);
  const dMrr = h20.mrr10 - h0.mrr10, dN = h20.ndcg10 - h0.ndcg10, dR = h20.recall[10] - h0.recall[10], d50 = h50.ndcg10 - h20.ndcg10;
  const held = dMrr >= 0.03 && dN >= 0.02 && Math.abs(dR) < Math.abs(dMrr) && Math.abs(d50) < 0.01;
  out.push(`| 4 | section, hybrid RRF: rerank@20 raises MRR@10 by at least 0.03 and nDCG@10 by at least 0.02; recall@10 moves less than MRR@10; rerank@50 within 0.01 nDCG@10 of rerank@20 | MRR@10 ${sign(dMrr)}, nDCG@10 ${sign(dN)}, R@10 ${sign(dR)}, rerank@50 minus rerank@20 nDCG@10 ${sign(d50)} | ${held ? 'held' : 'broken'} |`);
}
{
  const a = must('section', 'hybrid-rrf', 0).tokens[10].median, b = must('subsection', 'hybrid-rrf', 0).tokens[10].median;
  out.push(`| 5 | hybrid RRF, no rerank, k=10: median tokens of B under a quarter of A's | A ${int(a)}, B ${int(b)}, ratio ${f2(b / a)} | ${b < a / 4 ? 'held' : 'broken'} |`);
}
{
  const a0 = must('section', 'hybrid-rrf', 0).abstention.top1.auc, a20 = must('section', 'hybrid-rrf', 20).abstention.top1.auc;
  out.push(`| 6 | section, hybrid RRF: top-1 fused score AUC below 0.75; with rerank@20 the top-1 cross-encoder AUC at least 0.75 | fused AUC ${f2(a0)}, reranked AUC ${f2(a20)} | ${a0 < 0.75 && a20 >= 0.75 ? 'held' : 'broken'} |`);
}

out.push(`\n<details>\n<summary>Table 9. Every configuration (${runs.length} runs, n=${n})</summary>\n`);
out.push(HEAD_ND);
for (const r of [...runs].sort((a, b) => b.ndcg10 - a.ndcg10)) out.push(row(r, false));
out.push('\n</details>');

const block = out.join('\n');
const readme = existsSync('README.md') ? readFileSync('README.md', 'utf8') : '';
const START = '<!-- results:start -->', END = '<!-- results:end -->';
let next: string;
if (readme.includes(START) && readme.includes(END)) {
  next = readme.slice(0, readme.indexOf(START) + START.length) + '\n' + block + '\n' + readme.slice(readme.indexOf(END));
} else {
  next = readme + `\n${START}\n${block}\n${END}\n`;
}
writeFileSync('README.md', next);
writeFileSync('results/tables.md', block);
console.log(`wrote ${runs.length} runs into README.md between result markers`);
