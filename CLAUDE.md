# legislation-rag

Retrieval over UK legislation, measured. Local embeddings, no API calls.

## Standing rules

1. **House style for every Markdown file.** Plain British English, first person
   singular, no emoji, no em dashes. Say what the thing does not do and what I
   would change with more time. Every number comes from a run that actually
   happened. No Features, Contributing or Roadmap sections. Cut any sentence
   that would survive a find-and-replace of the project name.

2. **Nothing in this repo calls a paid API.** Embeddings, reranking and
   evaluation all run locally. There is no budget. If a design needs a hosted
   model, it is the wrong design for this repo.

3. **`src/contract/` is sealed.** The chunk schema, the retriever interface,
   the query schema and the metrics output shape live there. Changing anything
   there requires an explicit instruction.

4. **The question set is hand-written and is built before the chunker.** Do
   not generate questions with a model, and do not write questions after
   seeing what the chunker produces. Both bias the result towards whatever was
   built.

5. **A worse number is still a result.** If reranking does not help, if hybrid
   loses to BM25 alone, if bigger chunks beat smaller ones, publish it. The
   value of this repo is the measurements, and a surprising negative is worth
   more than a tidy positive.

6. **Never report a configuration's score without the baseline next to it.**

7. **Commit after each working increment.**

## What this is

A retrieval system over the Companies Act 2006, built to find out which
decisions actually move retrieval quality. Chunking strategy, hybrid search
combining BM25 with dense vectors, and cross-encoder reranking, each measured
against a hand-built question set using classical IR metrics.

The corpus is deliberate. The Companies Act 2006 is around 1,300 sections
arranged in Parts, Chapters and cross-references, which makes chunking a real
decision rather than a default. It also sits next to the other repos in this
account, which all work with UK company data.

## Why it is measured rather than demonstrated

Most retrieval projects show a pipeline working. Very few show which parts of
the pipeline earned their place. Recall, MRR and nDCG against a labelled set
need no model at inference time, so every claim in this repo can be checked
for free by anyone who clones it.

Answer quality would need a hosted model and is therefore out of scope. The
README says so rather than pretending retrieval quality and answer quality are
the same thing.

## Stack

- TypeScript, strict mode
- Local embedding model through `transformers.js`, running ONNX on CPU
- Local cross-encoder reranker, same route
- BM25 implemented in this repo rather than imported, because understanding it
  is part of the point
- Index persisted to disk, no database
- `vitest`

## Definition of done

- A hand-written question set with relevance labels, built before the chunker.
- At least four chunking strategies measured against each other.
- BM25 alone, dense alone, and hybrid, measured against each other.
- Reranking measured as an ablation, not assumed.
- A results table with a baseline in it, and a written account of which
  decisions mattered and which did nothing.
- `DECISIONS.md` with the real decisions and the rejected alternatives.
- A README that leads with the measurements, including any that went the wrong
  way.
