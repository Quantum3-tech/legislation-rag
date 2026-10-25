# Decisions

Each entry records what I decided, what I rejected, and why, in the order
the decisions were made. Entries are not rewritten after the fact; if a
decision is reversed, a later entry says so. Dates are when the decision
was taken.

## D1. Commit the raw XML (25 October 2026)

Decided: `data/raw/ukpga-2006-46.xml` (15 MB) is in git.
Rejected: a fetch script and a recorded date. legislation.gov.uk serves the
current consolidated text and the Act was modified on 2026-07-24; a
re-fetch would produce a different corpus and nothing in the results could
be checked.

## D2. The unit of relevance is the provision, not the chunk (25 October 2026)

Decided: labels name sections and schedule paragraphs by legislation.gov.uk
id. Every chunker maps chunks to provisions, and metrics are computed over
the collapsed provision list.
Rejected: labelling subsections. It would have fitted the subsection
chunkers and penalised the others, and a question's answer is cited by
section in practice.

## D3. Build the question set before the chunker (25 October 2026)

Decided: 60 questions written from my own knowledge of the Act, labels
checked against the live XML text only. Keyword searches of the Act were
used only to confirm the unanswerable questions have no hidden answer.
Rejected: generating questions with a model (not allowed by the rules of
this repo, and it would skew vocabulary towards whatever the model finds
easy) and writing questions after seeing chunks.

## D4. Extraction rules (25 October 2026)

Decided: drop `Repeal` content, unwrap `Addition` and `Substitution`, drop
`CommentaryRef`, bracket `Pnumber`s, flatten tables row by row with " | ",
keep `BlockAmendment` text inline without an id, detect repeal from
content. Exclude commentaries, preliminaries, Schedules 8 and 16.
Rejected: trusting the `Status="Repealed"` attribute (it marks 55 of 135
shells) and keeping repealed text as "historical context" (it is not law
and a question about current law should not retrieve it).

## D5. Read every `P1para` child of a section (25 October 2026)

Decided after a bug: ten sections carry two `P1para` elements, the old
text wholly repealed and the substituted text live. Section 444 is one.
Taking the first made 444 a repealed shell in both my exploratory Python
and the first TypeScript parser. The parser now renders all of them, so
the live body count is 1,552, not the 1,551 in the first draft of the
corpus report. The report was corrected and says so.

## D6. Fixed windows are credited to the dominant provision (25 October 2026)

Decided: a window that straddles provisions is credited to the one that
contributed most tokens; every provision it touches is recorded in
`meta.spans`. Consequence, measured at build time: `fixed-256` windows are
dominated by only 1,393 of 1,959 provisions and `fixed-512` by 927. The
other provisions can never be retrieved by those chunkers, which caps their
recall before any query runs. This is the honest cost of a boundary-blind
chunker and is reported, not patched.
Rejected: crediting every provision a window touches. That would let one
window score for several provisions and make the fixed chunkers look
better than a reader's experience of them.

## D7. Models (25 October 2026)

Decided: `Xenova/bge-small-en-v1.5` in fp32 with CLS pooling and L2
normalisation for embeddings; `Xenova/ms-marco-MiniLM-L-6-v2` in fp32 as
the cross-encoder. Both run through `@huggingface/transformers` 3.7.5 on
CPU with weights cached under `data/models/`.
Rejected: int8 weights (speed was not the constraint; fp32 removes one
source of doubt from the numbers), `all-MiniLM-L6-v2` (256-token window),
`bge-base` and `nomic-embed-text` (too slow to run the full matrix; left as
a possible single-configuration check).

## D8. Query prefix (25 October 2026)

Decided: every query is prefixed with the bge instruction "Represent this
sentence for searching relevant passages: ", as the model card recommends
for short queries against passages. Passages get no prefix. Not ablated.

## D9. Fusion is RRF with k = 60 (25 October 2026)

Decided: reciprocal rank fusion over the top 100 from each retriever.
Rejected: min-max weighted sum, because its weight would be tuned on the
50 questions it is evaluated on. It runs once at alpha = 0.5, untuned, as
a measured row so the rejection is a number rather than an assertion.

## D10. Reranking leaves the tail in place (25 October 2026)

Decided: the cross-encoder reorders only the top `depth` chunks; chunks
below the depth keep their first-stage order with scores set below the
reranked block. Candidate depth is an ablation axis (20, 50).
Rejected: reranking everything in the top 100, because the latency on CPU
would be out of proportion and because recall@20 should stay comparable
with the unreranked run.

## D11. Token volume counts duplicates (25 October 2026)

Decided: tokens at k is the sum of chunk tokens read from the top of the
list until the k-th distinct provision appears, including chunks that
repeat a provision already seen. A reader reads them too.
Rejected: summing the tokens of the k distinct provisions' first chunks
only, which would hide the cost of subsection chunkers returning five
pieces of the same section.

## D12. The predictions stand as written (25 October 2026, after the run)

Decided: DESIGN.md is not edited after the results. Table 8 in the README
marks each prediction held or broken with the numbers. Four of six were
broken, including the central one that BM25 would beat dense retrieval.
Rejected: rewriting the predictions to match, or softening them. The
value of the predictions is that they were fixed before the run.

## D13. Recommended configurations come from the table, not the design (25 October 2026)

Decided: two recommendations, both read off Tables 1 to 3. For quality
per token, `subsection-context` with hybrid RRF and rerank@20 (0.855
nDCG@10, 1,632 tokens at k=10). For latency, `section-split` with dense
retrieval alone (0.843, about 1 ms per query). The hybrid stage is not
recommended on its own: on no chunker could I show it beating dense alone
within the bootstrap intervals.
Rejected: recommending the design's predicted winner (`section-split`
with hybrid RRF) just because it was predicted. It is within noise of
the two above and costs more tokens than the first.

## D14. Fusion verdict is "not shown", not "RRF wins" (25 October 2026)

Decided: the README says RRF lost to untuned min-max on every chunker
where both were run and that the gap is inside the intervals. D9 chose
RRF to avoid tuning a weight on the evaluation set; that reasoning still
holds, and the measurement says the choice did not matter at n=50.
Rejected: tuning alpha now that the numbers are in. That would be fitting
to the 50 questions, which is what D9 was written to prevent.

## D15. Fixed-window coverage is reported as a result, not fixed (25 October 2026)

Decided: `fixed-512` scored 0.465 nDCG@10 because 1,032 provisions never
dominate a window. The README states the mechanism and the number. The
alternative credit rule (every provision a window touches) is listed as
future work rather than run, because it would change the metric for one
chunker only and the comparison would stop being like for like.

## D16. The raw corpus is fetched and hash-checked, not committed (25 October 2026, reverses D1)

Decided: `data/raw/` is ignored. `data/corpus.lock.json` records the
source URL, the SHA256 (`d28adc39...efb04`), the size (15,193,495 bytes),
the fetch date (25 October 2026) and the text-valid-from date (16 July
2026). `npm run fetch` downloads the file and exits non-zero with an
explanation if the hash does not match. The file was removed from every
commit before anything was pushed.

Why D1 was reversed: GitHub push protection blocked the first push with
223 secret detections, all false positives. legislation.gov.uk marks
every amendment effect with an identifier of the form `key-<32 hex
digits>`, and that is also the shape of a Mailgun API key. Unblocking 223
detections one by one is not viable and disabling push protection on the
repository is not acceptable, so the file cannot go through the remote.

What the trade is: D1 bought offline reproducibility, in that a clone had
everything the numbers were measured against. D16 trades that for a
network dependency on legislation.gov.uk, which serves the current
consolidation and will at some point serve a different file. The hash is
what keeps the numbers checkable: a reader who fetches and gets a match
has the exact bytes; a reader who gets a mismatch knows before running
anything that the tables do not describe their file. When I re-fetched
the file an hour after the original download to restore my local copy,
the hash matched, which is the first use of the check.

Rejected: committing a transformed copy of the XML with the identifiers
stripped. The raw file is the source of truth and a transformed copy is
not the thing the parser was written against.

Kept: `data/corpus.json`, the parser's output (5 MB), has been committed
since the build and stays. It is derived, so it is not the source of
truth, but it lets a reader inspect the exact live text the matrix ran
over without a network fetch, and it carries no effect identifiers so it
passes push protection. `npm run parse` regenerates it from the raw file
and the tests check the parser against the raw file, not against this
copy.
