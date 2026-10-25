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
