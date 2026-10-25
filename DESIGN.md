# Design proposal

Written 25 October 2026, after the corpus report (`docs/corpus-report.md`)
and the question set (`eval/`), before any retrieval code. Everything below
is a prediction until the results table exists. Where I predict a winner, I
expect to be held to it.

## 1. The unit of relevance

A provision: a live body section or a live schedule paragraph, identified
by the legislation.gov.uk `id` (`section-172`, `schedule-1A-paragraph-2`).
There are 1,551 live sections and 407 live schedule paragraphs. Repealed
shells, the 27 quoted sections of other Acts inside `BlockAmendment`,
commentaries, the preliminaries and the two table-only Schedules (8 and 16)
are out.

Every chunking strategy maps each chunk to one provision. Scoring happens
after collapsing a ranked list of chunks to the ranked list of distinct
provisions it contains, first occurrence wins. A strategy that cuts a
section into eight chunks gets one bite at each rank, not eight, and a
strategy that leaves it whole is not penalised for having fewer chunks.
Without this, the chunkers are not comparable and the labels would favour
whichever granularity I happened to label at.

## 2. Text extraction

One pass over the XML producing the provision list with, for each
provision: id, number, heading, the Part, Chapter and cross-heading it sits
under (number and title), region (body or schedule), extent, whether it
contains inline amendments, the subsection tree with ids, and the
cross-references its text makes by regular expression (`section 8`,
`sections 642 to 644`, `Part 1 of Schedule 1A`).

Rules the extractor follows, each one forced by something in the corpus
report:

- Drop the content of `Repeal` elements. Otherwise 350 headings and 281
  sections contain both the old and the new words.
- Unwrap `Addition` and `Substitution`, drop `CommentaryRef`.
- Render `Pnumber` as `(1)`, `(a)`, `(i)` with a line break before each,
  because the numbers are bare and the text otherwise runs together.
- Flatten tables row by row with a separator between cells, because the
  thresholds people ask about are in tables.
- Keep `BlockAmendment` text inline as part of the amending section, but
  never give it a provision id.
- A provision is repealed if its live text, after removing dots and
  whitespace, is empty. The `Status` attribute misses 80 of the 135 cases.

## 3. Chunking strategies to measure

| Key | Strategy | Chunk text | Expected chunk count |
|---|---|---|---|
| A | `section` | Heading plus the whole provision. Embedder truncates at 512 tokens; 109 sections are affected. BM25 sees all of it. | 1,958 |
| B | `subsection` | One chunk per subsection (`P2`, with its paragraphs and sub-paragraphs inside). Provisions with no subsections become one chunk. No heading, no context. | about 7,500 |
| C | `subsection-context` | B, with a breadcrumb prefixed: Part number and title, Chapter number and title, cross-heading, section number and heading. | about 7,500 |
| D | `fixed-256` | Token windows of 256 with 32 overlap over the whole Act in reading order, ignoring every boundary. A window maps to the provision contributing most of its tokens. | about 1,900 |
| E | `section-split` | A, but any provision over 512 tokens is split at subsection boundaries into pieces of at most 512 tokens, each piece carrying the breadcrumb and heading. | about 2,150 |

If the matrix runs quickly enough I will add D at 512 tokens as a sixth
row, because comparing D-256 with D-512 says whether window size or
boundary-blindness is what hurts.

Prediction, and the reasoning I will be held to:

1. **E wins on nDCG@10 under hybrid retrieval, with A within 0.02.** The
   labels are at section granularity, so chunks at section granularity are
   aligned with the target. E differs from A only for the 109 long
   sections, where A's embedding is truncated. Those sections are
   over-represented in the question set relative to the corpus (1266,
   1087, 790C, 159A and 9 are all long), so E should edge A.
2. **B finishes last for dense and hybrid, and a long way last for
   dense.** 539 occurrences of "this Part" and "this Chapter" and 1,193 of
   "subsection (N)" lose their referent when a subsection is cut out, and
   the heading, which carries most of the semantic signal in legislation,
   is gone. C recovers most of the gap, which is the point of running
   both.
3. **D sits mid-table**, above B because 256 tokens usually spans a whole
   short section with its heading, below A because 39% of windows will
   straddle two provisions and be credited to only one.
4. **BM25 alone beats dense alone on this question set.** The questions
   use the Act's own vocabulary ("special resolution", "solvency
   statement", "pre-emption"), which is exactly where lexical matching is
   strong and a 33M-parameter embedder is not. Hybrid beats BM25 alone by
   under 0.05 nDCG@10, with the gain concentrated in the multi-section
   questions.
5. **Reranking raises MRR@10 and nDCG@10 by a few points at depth 20, and
   depth 50 adds little over depth 20.** Reranking cannot raise recall@k
   above what the candidate set already contains, so recall@10 moves less
   than MRR. I half expect the small MS MARCO cross-encoder to hurt on
   bare subsection chunks (B), because it has never seen legal text and
   the chunks lack the context it would need.

If 4 goes the other way, that is the most useful result in the repo and
the README will lead with it.

## 4. What the embedding sees

For A and E: the breadcrumb and heading on the first line, then the text.
For C: the same. For B and D: the raw text only, by design. BM25 indexes
exactly the same string the embedder sees for each strategy, so the two
retrievers are never comparing different text.

The breadcrumb costs about 25 to 40 tokens of the 512-token window, so
the 109 long sections lose a further 5 to 8% of their text to truncation.
It also makes every chunk in a Chapter look more like every other chunk in
that Chapter, which is the right prior for "which Part is this question
about" and the wrong one for "which of these twelve sections on allotment
is the one". For very short provisions such as section 271 (seven words)
the breadcrumb is most of the embedding. I accept these costs because the
alternative, bare text, is strategy B, and B is being measured.

Not embedded, carried as metadata: ids, numbers, extent, the amended flag,
cross-reference targets, token counts.

Query side: the bge model card recommends the prefix "Represent this
sentence for searching relevant passages: " for short queries against
passages. I will use it. Not ablated.

## 5. Models

Everything runs on CPU through `@huggingface/transformers` 3.7.5 with ONNX
weights cached under `data/models/`.

| Role | Model | Why | Rejected alternative |
|---|---|---|---|
| Embedder | `Xenova/bge-small-en-v1.5` (33M parameters, 384 dimensions, 512-token window, int8) | Fast enough to embed 20,000 chunks on a laptop CPU in minutes; strong on retrieval benchmarks for its size | `all-MiniLM-L6-v2`: 256-token window would truncate 625 of 1,551 sections. `bge-base-en-v1.5`: roughly three times slower; I will run it on the winning chunker only, if time allows, to see whether a bigger embedder changes which decisions matter. `nomic-embed-text-v1`: 8,192-token window solves truncation but 137M parameters is slow on CPU and the truncation problem affects 7% of sections |
| Reranker | `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder (22M parameters) | Cheap enough to rerank 50 candidates per query across the whole matrix | `Xenova/bge-reranker-base` (278M parameters): about ten times slower; on the winning configuration only, if time allows |

## 6. BM25

Implemented in this repo. Okapi BM25 with k1 = 1.2 and b = 0.75.
Tokeniser: lowercase, split on non-alphanumerics, keep tokens that are
digits or digit-letter mixes so that "172" and "790c" survive, drop a
short stopword list, Porter stem the rest. Stemming is there because
"allot", "allotted" and "allotment" are the same question. I am not
ablating the tokeniser or the BM25 parameters; that is a stated limit.

## 7. Fusion

Reciprocal rank fusion, k = 60, over the union of the top 100 from BM25
and the top 100 from dense. One parameter, no tuning, robust to the fact
that BM25 scores are unbounded and cosine scores sit in a narrow band.

Rejected: min-max normalised weighted sum with a weight alpha. It needs
alpha tuned on the question set, and with 50 answerable questions any
alpha I picked would be fitted to them. I will run it once at alpha = 0.5
untuned on every chunker so the rejection is a measured row in the table,
not an assertion. Also rejected: a cascade that uses BM25 as a filter and
dense to rank within it, because it discards BM25's ranking, which I
predict is the stronger of the two.

## 8. Reranking

The cross-encoder scores (query, chunk text) pairs for the top N chunks
from the first stage, re-sorts them, and the list is then collapsed to
provisions. N is an ablation axis: none, 20, 50. Latency is measured per
query on this machine and reported in milliseconds with the CPU named.
My guess before measuring: 10 to 30 ms per pair for the MiniLM
cross-encoder, so 0.2 to 0.6 s at depth 20 and 0.5 to 1.5 s at depth 50.

## 9. Metrics

All computed over provisions after collapsing chunks, over the 50
answerable questions, with relevant meaning grade 1 or 2.

| Metric | k | What it measures here |
|---|---|---|
| Recall@k | 5, 10, 20 | The share of needed provisions that reached the top k. For a RAG system that puts the top k into a prompt, this is whether the answer is in the prompt at all. Recall@10 is the one I care about most |
| MRR@10 | 10 | How far down the first useful provision is. Matters for single-section questions and for a human reading a list |
| nDCG@10 | 10 | The only metric that uses the grades. Rewards putting the provision that states the answer above the one that supports it, and handles the multi-section questions properly. Gain is the grade, discount is log2 |

Primary metric for ranking configurations: nDCG@10. Recall@10 is
reported beside it in every table. Breakdowns by question type (single,
multi) are reported, because I expect hybrid and reranking to help the
multi questions and do little for the single ones.

For the 10 unanswerable questions the three metrics are undefined. Instead
I report, per configuration, the top-1 score for answerable versus
unanswerable questions and the accuracy of the best single threshold at
telling them apart. With 10 examples this is indicative, and the README
will say so.

Sixty questions cannot separate configurations that differ by a little.
Every comparison against the baseline reports paired per-question wins and
losses and a bootstrap 95% interval (1,000 resamples over questions) for
the difference in nDCG@10. If the interval includes zero, the table says
"no measurable difference", not "worse" or "better".

## 10. The baseline

BM25 over whole-section chunks (strategy A), no dense retrieval, no
reranking. This is what a weekend project would build first. Every row in
every results table carries its delta against this row.

## 11. The matrix

5 chunkers (6 with D-512) by 3 retrievers (BM25, dense, RRF hybrid) by 3
reranking depths (none, 20, 50) = 45 to 54 runs, plus the alpha = 0.5
fusion row per chunker, plus the optional bigger-model rows on the winner.
Embeddings are computed once per (model, chunker) and cached to disk, so
the embedding cost is about 0.5 million tokens per chunker, which I
expect to take 5 to 15 minutes each on CPU.

## 12. Persistence

`data/index/<chunker>/`: `chunks.json` (chunk text and metadata),
`embeddings.<model>.f32` (a flat `Float32Array`), `bm25.json` (postings,
document lengths, vocabulary). Plain files, no database. Results go to
`results/<run>.json` and the tables in the README are generated from them
by a script, so no number in the README is typed by hand.

## 13. The raw corpus is committed

`data/raw/ukpga-2006-46.xml` (15 MB) goes into git. Rejected: a fetch
script alone. legislation.gov.uk serves the current consolidated text, and
the Act was modified on 2026-07-24; a re-fetch in a year would give a
different corpus and every number in the repo would become unreproducible.
Fifteen megabytes is the price of being able to check the numbers.

## 14. The contract I propose to seal

To be placed in `src/contract/` once this design is approved and not
changed afterwards without an explicit instruction.

```ts
// chunk.ts
interface Chunk {
  id: string;             // "<chunker>:<provisionId>:<n>"
  chunker: string;        // "section" | "subsection" | ...
  provisionId: string;    // "section-172", "schedule-1A-paragraph-2"
  text: string;           // exactly what BM25 indexes and the embedder sees
  tokens: number;         // bge tokenizer count of text
  meta: {
    number: string;       // "172"
    heading: string;
    part?: { number: string; title: string };
    chapter?: { number: string; title: string };
    crossHeading?: string;
    region: "body" | "schedule";
    schedule?: { number: string; title: string };
    spans?: string[];     // fixed-window only: every provision the window touches
  };
}

// retriever.ts
interface Hit { chunkId: string; provisionId: string; score: number; rank: number }
interface Retriever {
  readonly name: string;
  search(query: string, k: number): Promise<Hit[]>;
}

// query.ts
interface Query {
  id: string;
  type: "single" | "multi" | "unanswerable";
  question: string;
  relevant: { id: string; grade: 1 | 2 }[];
}

// metrics.ts
interface RunResult {
  config: { chunker: string; retriever: string; fusion?: string; rerank?: { model: string; depth: number } };
  n: number;                                   // answerable questions scored
  recall: { 5: number; 10: number; 20: number };
  mrr10: number;
  ndcg10: number;
  byType: Record<"single" | "multi", { recall10: number; mrr10: number; ndcg10: number }>;
  perQuestion: { id: string; recall10: number; rr10: number; ndcg10: number; top1Score: number }[];
  abstention: { answerableTop1: number[]; unanswerableTop1: number[]; bestThresholdAccuracy: number };
  latencyMs: { retrieveP50: number; rerankP50?: number };
  startedAt: string;
  machine: string;
}
```

## 15. What this design does not do, and what I would change with more time

It does not measure answer quality; that needs a hosted model and is out
of scope by the rules of this repo. It does not expand cross-references
(appending the text of "see section 8" to the chunk for section 7), which
the corpus report shows would have to be regex-driven; I would add that as
a sixth chunker if the matrix runs fast enough, because the multi-section
questions are exactly where it should help. It does not ablate the BM25
tokeniser, the query prefix, or RRF's k. It does not test a second
question set written by someone else, which is the real check on whether
my labelling rule is reproducible.
