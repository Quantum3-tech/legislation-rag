# legislation-rag

Retrieval over the Companies Act 2006, measured. Six chunking strategies,
three retrievers, two fusion methods and two reranking depths, run against
sixty hand-written questions with graded relevance labels. Everything runs
on a CPU with no API calls, so every number below can be reproduced by
cloning the repo.

## What the numbers say

<!-- summary:start -->
The numbers in this section are copied from the tables below, which are
generated from `results/` by `npm run report`. The baseline is BM25 over
whole sections, no dense retrieval, no reranking. n is 50 answerable
questions throughout unless a table says otherwise.

**Only 22 of the 50 questions discriminate between configurations.** On
the 28 single-section questions, every retriever on section chunks
reaches recall@10 of 1.000 (Table 5), so those questions cannot separate
anything above the baseline. Every comparison below is in effect decided
by the 22 multi-section questions, and that is why the bootstrap
intervals on the deltas run to about plus or minus 0.07. Where I say a
difference was not shown, read it as "this question set cannot separate
them", which is a weaker claim than "there is no difference". The two are
not the same and I can only make the first.

**Subsections with their heading carried down give nearly the same
quality for 61% of the tokens.** `subsection-context` under hybrid RRF
scored 0.841 nDCG@10 while a reader takes in 1,843 tokens to see 10
provisions; `section-split` scored 0.854 at 2,997 tokens. With rerank@20
the figures are 0.855 at 1,632 tokens against 0.850 at 3,081. The
quality gap is inside the interval; the token gap is not a matter of
sampling. If the retrieved text is going into a prompt, this is the
result that matters, and it is only visible because every configuration
reports token volume alongside recall.

**Four of my six predictions were wrong.** They are listed with the
numbers in Table 8. The two that held were the smaller ones: a bare
subsection without its heading loses more than 0.10 nDCG@10 under dense
retrieval, and reranking moves the top of the list rather than the set of
provisions retrieved.

**Dense retrieval beat BM25, the opposite of what I predicted.** On whole
sections, dense alone scored 0.807 nDCG@10 against BM25's 0.701, with 24
wins and 9 losses across the 50 questions. BM25's whole deficit is on the
22 multi-section questions (0.523 against dense's 0.695); on the 28
single-section questions every retriever on section chunks reaches
recall@10 of 1.000, so those questions no longer separate anything.
I predicted the Act's own vocabulary would favour lexical matching. It did
not, because the multi-section questions are phrased as what a person
wants to do rather than in the words of the sections that answer them.

**Hybrid did not beat dense alone, and reciprocal rank fusion lost to the
method I rejected.** Hybrid RRF on sections scored 0.802 against dense's
0.807. The untuned min-max weighted sum scored 0.822. On subsection
chunks with context, min-max scored 0.856 against RRF's 0.841. None of
these gaps is outside the bootstrap intervals, which run about plus or
minus 0.07 around every delta in Table 1. This comparison is
under-powered: with 22 discriminating questions the smallest difference
it could detect is larger than the differences observed. So the honest
statement is that this question set cannot separate hybrid retrieval
from dense retrieval, or RRF from min-max, not that there is no
difference between them. A set with more multi-section questions might
show one; this one does not.

**Chunking mattered more than anything else.** Splitting long sections at
subsection boundaries and carrying the Part, Chapter and heading down
(`section-split`) scored 0.854 under hybrid RRF with no reranking, 0.153
above the baseline with an interval of [0.093, 0.213]. Whole sections
with the same retriever scored 0.802. Subsections with their breadcrumb
scored 0.841 while returning 1,843 tokens at k=10 against 2,997 for
`section-split`, so they deliver nearly the same quality for 61% of the
prompt. Bare subsections (0.746) and 256-token windows (0.672) were not
measurably different from the baseline, and 512-token windows were
measurably worse (0.465) because only 927 of 1,959 provisions ever
dominate a window, so 1,032 provisions cannot be retrieved at all.

**Reranking helped where the first stage was weak and did nothing where
it was strong.** On whole sections with hybrid RRF, reranking the top 20
raised nDCG@10 from 0.802 to 0.837 and MRR@10 from 0.845 to 0.915 while
recall@10 moved by 0.004. On the best chunker it changed nothing (0.854,
0.850, 0.853 at depths 0, 20 and 50). It also made the first-stage
choice matter less: BM25 plus rerank@50 reached 0.831 against dense plus
rerank@50 at 0.838.

**Reranking made bare subsections worse**, from 0.746 to 0.716 at depth
20 and 0.714 at depth 50 (Table 3). The cross-encoder was trained on web
passages and a subsection stripped of its heading reads as "(2) This
section does not apply where..." with nothing to say what "this section"
is. Given no context, the reranker promoted the wrong fragments with
confidence. Context carried down fixes it: the same reranker on
`subsection-context` went from 0.841 to 0.855.
The cost is 776 ms per query at depth 20 and 1,940 ms at depth 50 on the
machine in Table 7, against 1.5 ms for the hybrid first stage.

**The reranker is what makes abstention possible.** Fused RRF scores
barely vary between queries, and their top-1 AUC at separating the 50
answerable from the 10 unanswerable questions was 0.81; cosine scores
managed 0.95 on their own. Cross-encoder logits reached 0.97, with median
top-1 scores of 6.7 for answerable and minus 1.5 for unanswerable
questions. With 10 unanswerable questions this is indicative, and the
balanced accuracies in Table 6 use a threshold chosen on the same
questions, so they are optimistic.

**What I would build from this.** For quality per token:
`subsection-context` with hybrid RRF and rerank@20, at 0.855 nDCG@10 and
1,632 tokens at k=10. For latency: `section-split` with dense retrieval
alone, at 0.843 nDCG@10 and about 1 ms per query, with the cross-encoder
run only when an abstention decision is needed. Nothing here justifies
the hybrid stage on its own.
<!-- summary:end -->

## Results

<!-- results:start -->
All quality metrics below are over the n=50 answerable questions, at provision level after collapsing chunks. Token columns are the tokens a reader takes in to see 10 distinct provisions, median and 90th percentile over the same n=50. Confidence intervals are paired bootstraps over the 50 questions, 1,000 resamples. Machine: 12th Gen Intel(R) Core(TM) i5-12600K x16, node v24.15.0.

### Table 1. The chunking decision (n=50)

Hybrid RRF retrieval, no reranking, every chunker, with the baseline (BM25 over whole sections) first.

| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 | nDCG@10 vs baseline [95% CI] wins/losses/ties |
|---|---|---|---|---|---|---|---|---|---|
| section | BM25 | 0.701 | 0.800 | 0.735 | 0.726 | 0.861 | 3,147 | 4,137 | baseline |
| section | hybrid RRF | 0.802 | 0.863 | 0.845 | 0.794 | 0.892 | 3,001 | 3,852 | +0.101 [+0.055, +0.149] 26W/1L/23T, better |
| section-split | hybrid RRF | 0.854 | 0.868 | 0.928 | 0.815 | 0.901 | 2,997 | 3,790 | +0.153 [+0.093, +0.213] 22W/5L/23T, better |
| subsection | hybrid RRF | 0.746 | 0.793 | 0.842 | 0.728 | 0.850 | 873 | 1,122 | +0.045 [-0.025, +0.112] 16W/11L/23T, no measurable difference |
| subsection-context | hybrid RRF | 0.841 | 0.883 | 0.892 | 0.814 | 0.911 | 1,843 | 2,961 | +0.141 [+0.063, +0.216] 22W/7L/21T, better |
| fixed-256 | hybrid RRF | 0.672 | 0.751 | 0.716 | 0.662 | 0.789 | 2,812 | 3,326 | -0.029 [-0.131, +0.060] 17W/14L/19T, no measurable difference |
| fixed-512 | hybrid RRF | 0.465 | 0.547 | 0.537 | 0.478 | 0.555 | 5,119 | 5,632 | -0.235 [-0.351, -0.133] 10W/27L/13T, worse |

### Table 2. The retriever decision on whole-section chunks (n=50)

| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 | nDCG@10 vs baseline [95% CI] wins/losses/ties |
|---|---|---|---|---|---|---|---|---|---|
| section | BM25 | 0.701 | 0.800 | 0.735 | 0.726 | 0.861 | 3,147 | 4,137 | baseline |
| section | BM25 + rerank@20 | 0.807 | 0.836 | 0.877 | 0.784 | 0.861 | 3,253 | 4,212 | +0.107 [+0.040, +0.176] 20W/7L/23T, better |
| section | BM25 + rerank@50 | 0.831 | 0.850 | 0.915 | 0.799 | 0.903 | 3,172 | 4,135 | +0.130 [+0.060, +0.202] 22W/7L/21T, better |
| section | dense | 0.807 | 0.865 | 0.876 | 0.785 | 0.888 | 2,797 | 3,748 | +0.107 [+0.028, +0.180] 24W/9L/17T, better |
| section | dense + rerank@20 | 0.834 | 0.860 | 0.915 | 0.795 | 0.888 | 2,889 | 3,915 | +0.133 [+0.061, +0.209] 23W/7L/20T, better |
| section | dense + rerank@50 | 0.838 | 0.870 | 0.915 | 0.799 | 0.917 | 2,961 | 3,876 | +0.137 [+0.064, +0.209] 23W/7L/20T, better |
| section | hybrid RRF | 0.802 | 0.863 | 0.845 | 0.794 | 0.892 | 3,001 | 3,852 | +0.101 [+0.055, +0.149] 26W/1L/23T, better |
| section | hybrid RRF + rerank@20 | 0.837 | 0.867 | 0.915 | 0.799 | 0.892 | 3,042 | 4,001 | +0.137 [+0.066, +0.210] 23W/7L/20T, better |
| section | hybrid RRF + rerank@50 | 0.832 | 0.857 | 0.915 | 0.799 | 0.912 | 3,015 | 3,876 | +0.132 [+0.061, +0.204] 23W/7L/20T, better |
| section | hybrid min-max 0.5 | 0.822 | 0.851 | 0.889 | 0.801 | 0.892 | 2,930 | 3,852 | +0.122 [+0.071, +0.175] 22W/1L/27T, better |
| section | hybrid min-max 0.5 + rerank@20 | 0.832 | 0.854 | 0.915 | 0.799 | 0.892 | 3,054 | 4,029 | +0.132 [+0.063, +0.202] 22W/7L/21T, better |
| section | hybrid min-max 0.5 + rerank@50 | 0.832 | 0.857 | 0.915 | 0.799 | 0.916 | 3,049 | 4,135 | +0.132 [+0.061, +0.204] 23W/7L/20T, better |

### Table 3. The reranking decision across chunkers, hybrid RRF first stage (n=50)

| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 | nDCG@10 vs baseline [95% CI] wins/losses/ties |
|---|---|---|---|---|---|---|---|---|---|
| section | hybrid RRF | 0.802 | 0.863 | 0.845 | 0.794 | 0.892 | 3,001 | 3,852 | +0.101 [+0.055, +0.149] 26W/1L/23T, better |
| section | hybrid RRF + rerank@20 | 0.837 | 0.867 | 0.915 | 0.799 | 0.892 | 3,042 | 4,001 | +0.137 [+0.066, +0.210] 23W/7L/20T, better |
| section | hybrid RRF + rerank@50 | 0.832 | 0.857 | 0.915 | 0.799 | 0.912 | 3,015 | 3,876 | +0.132 [+0.061, +0.204] 23W/7L/20T, better |
| section-split | hybrid RRF | 0.854 | 0.868 | 0.928 | 0.815 | 0.901 | 2,997 | 3,790 | +0.153 [+0.093, +0.213] 22W/5L/23T, better |
| section-split | hybrid RRF + rerank@20 | 0.850 | 0.864 | 0.906 | 0.812 | 0.901 | 3,081 | 3,931 | +0.149 [+0.072, +0.228] 22W/6L/22T, better |
| section-split | hybrid RRF + rerank@50 | 0.853 | 0.869 | 0.906 | 0.815 | 0.920 | 3,014 | 3,925 | +0.153 [+0.073, +0.232] 22W/6L/22T, better |
| subsection | hybrid RRF | 0.746 | 0.793 | 0.842 | 0.728 | 0.850 | 873 | 1,122 | +0.045 [-0.025, +0.112] 16W/11L/23T, no measurable difference |
| subsection | hybrid RRF + rerank@20 | 0.716 | 0.808 | 0.793 | 0.704 | 0.850 | 898 | 1,275 | +0.016 [-0.072, +0.108] 18W/14L/18T, no measurable difference |
| subsection | hybrid RRF + rerank@50 | 0.714 | 0.801 | 0.787 | 0.671 | 0.865 | 903 | 1,384 | +0.014 [-0.088, +0.113] 18W/15L/17T, no measurable difference |
| subsection-context | hybrid RRF | 0.841 | 0.883 | 0.892 | 0.814 | 0.911 | 1,843 | 2,961 | +0.141 [+0.063, +0.216] 22W/7L/21T, better |
| subsection-context | hybrid RRF + rerank@20 | 0.855 | 0.883 | 0.921 | 0.814 | 0.911 | 1,632 | 2,961 | +0.155 [+0.073, +0.236] 25W/5L/20T, better |
| subsection-context | hybrid RRF + rerank@50 | 0.845 | 0.885 | 0.903 | 0.802 | 0.908 | 1,768 | 3,010 | +0.145 [+0.057, +0.232] 22W/7L/21T, better |
| fixed-256 | hybrid RRF | 0.672 | 0.751 | 0.716 | 0.662 | 0.789 | 2,812 | 3,326 | -0.029 [-0.131, +0.060] 17W/14L/19T, no measurable difference |
| fixed-256 | hybrid RRF + rerank@20 | 0.665 | 0.751 | 0.680 | 0.701 | 0.789 | 2,812 | 3,325 | -0.035 [-0.132, +0.052] 15W/16L/19T, no measurable difference |
| fixed-256 | hybrid RRF + rerank@50 | 0.675 | 0.765 | 0.689 | 0.706 | 0.800 | 2,809 | 3,070 | -0.026 [-0.124, +0.064] 16W/16L/18T, no measurable difference |
| fixed-512 | hybrid RRF | 0.465 | 0.547 | 0.537 | 0.478 | 0.555 | 5,119 | 5,632 | -0.235 [-0.351, -0.133] 10W/27L/13T, worse |
| fixed-512 | hybrid RRF + rerank@20 | 0.404 | 0.520 | 0.457 | 0.481 | 0.555 | 5,119 | 5,632 | -0.296 [-0.405, -0.186] 7W/35L/8T, worse |
| fixed-512 | hybrid RRF + rerank@50 | 0.409 | 0.540 | 0.459 | 0.461 | 0.570 | 5,120 | 5,631 | -0.291 [-0.397, -0.183] 6W/35L/9T, worse |

### Table 4. BM25 alone against dense alone, every chunker, no reranking (n=50)

| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 | nDCG@10 vs baseline [95% CI] wins/losses/ties |
|---|---|---|---|---|---|---|---|---|---|
| section | BM25 | 0.701 | 0.800 | 0.735 | 0.726 | 0.861 | 3,147 | 4,137 | baseline |
| section | dense | 0.807 | 0.865 | 0.876 | 0.785 | 0.888 | 2,797 | 3,748 | +0.107 [+0.028, +0.180] 24W/9L/17T, better |
| section-split | BM25 | 0.705 | 0.807 | 0.728 | 0.774 | 0.872 | 3,207 | 3,789 | +0.005 [-0.034, +0.042] 14W/8L/28T, no measurable difference |
| section-split | dense | 0.843 | 0.872 | 0.914 | 0.798 | 0.917 | 2,963 | 3,819 | +0.142 [+0.060, +0.222] 22W/8L/20T, better |
| subsection | BM25 | 0.635 | 0.751 | 0.664 | 0.652 | 0.821 | 802 | 1,147 | -0.065 [-0.147, +0.021] 10W/24L/16T, no measurable difference |
| subsection | dense | 0.713 | 0.782 | 0.804 | 0.741 | 0.864 | 880 | 1,240 | +0.013 [-0.072, +0.096] 20W/13L/17T, no measurable difference |
| subsection-context | BM25 | 0.753 | 0.850 | 0.774 | 0.783 | 0.897 | 1,595 | 2,824 | +0.053 [-0.007, +0.109] 19W/9L/22T, no measurable difference |
| subsection-context | dense | 0.838 | 0.875 | 0.901 | 0.817 | 0.906 | 1,833 | 3,127 | +0.138 [+0.057, +0.220] 25W/7L/18T, better |
| fixed-256 | BM25 | 0.626 | 0.753 | 0.637 | 0.683 | 0.778 | 2,814 | 3,327 | -0.074 [-0.168, +0.005] 12W/20L/18T, no measurable difference |
| fixed-256 | dense | 0.588 | 0.668 | 0.630 | 0.598 | 0.776 | 2,560 | 3,070 | -0.113 [-0.227, +0.005] 13W/23L/14T, no measurable difference |
| fixed-512 | BM25 | 0.398 | 0.507 | 0.415 | 0.444 | 0.548 | 5,118 | 6,136 | -0.302 [-0.407, -0.215] 3W/37L/10T, worse |
| fixed-512 | dense | 0.393 | 0.467 | 0.488 | 0.407 | 0.524 | 5,119 | 5,631 | -0.307 [-0.437, -0.191] 9W/34L/7T, worse |

### Table 5. Single-section against multi-section questions (n=28 single, n=22 multi)

| chunker | retriever | single nDCG@10 | single R@10 | single MRR@10 | multi nDCG@10 | multi R@10 | multi MRR@10 |
|---|---|---|---|---|---|---|---|
| section | BM25 | 0.840 | 1.000 | 0.788 | 0.523 | 0.545 | 0.668 |
| section | dense | 0.895 | 1.000 | 0.862 | 0.695 | 0.694 | 0.893 |
| section | hybrid RRF | 0.908 | 1.000 | 0.876 | 0.667 | 0.690 | 0.805 |
| section | hybrid RRF + rerank@20 | 0.938 | 1.000 | 0.917 | 0.709 | 0.699 | 0.913 |
| section-split | hybrid RRF | 0.982 | 1.000 | 0.976 | 0.690 | 0.701 | 0.867 |
| section-split | hybrid RRF + rerank@20 | 0.956 | 1.000 | 0.940 | 0.714 | 0.691 | 0.863 |
| subsection-context | hybrid RRF | 0.938 | 1.000 | 0.917 | 0.718 | 0.734 | 0.860 |

### Table 6. Can the retriever tell it has nothing? (n=50 answerable against n=10 unanswerable)

AUC is the probability that a random answerable question's score beats a random unanswerable one's; 0.5 is chance. Balanced accuracy is at the best single threshold, chosen on these same questions, so it is optimistic.

| chunker | retriever | score used | AUC top-1 | bal. acc. top-1 | median top-1 answerable | median top-1 unanswerable | AUC top-5 mean | bal. acc. top-5 mean |
|---|---|---|---|---|---|---|---|---|
| section | BM25 | BM25 score | 0.83 | 0.80 | 20.65 | 13.49 | 0.85 | 0.85 |
| section | dense | cosine | 0.95 | 0.90 | 0.81 | 0.71 | 0.89 | 0.84 |
| section | hybrid RRF | fused score | 0.81 | 0.77 | 0.03 | 0.03 | 0.83 | 0.83 |
| section | hybrid RRF + rerank@20 | cross-encoder logit | 0.97 | 0.93 | 6.73 | -1.45 | 0.95 | 0.91 |
| section | hybrid RRF + rerank@50 | cross-encoder logit | 0.97 | 0.93 | 6.73 | -1.45 | 0.94 | 0.91 |
| section-split | hybrid RRF + rerank@20 | cross-encoder logit | 0.97 | 0.93 | 6.75 | 0.18 | 0.96 | 0.91 |
| subsection-context | hybrid RRF + rerank@20 | cross-encoder logit | 0.96 | 0.92 | 7.37 | 1.46 | 0.97 | 0.93 |
| section | BM25 + rerank@20 | cross-encoder logit | 0.98 | 0.93 | 6.73 | -1.70 | 0.95 | 0.90 |
| section | dense + rerank@20 | cross-encoder logit | 0.98 | 0.93 | 6.73 | -1.54 | 0.95 | 0.91 |

### Table 7. Cost: chunk counts, embedding time, query latency

| chunker | chunks | provisions reachable | chunk tokens median | chunk tokens p90 | chunks over 512 | embed time (s) | chunks/s | BM25 p50 (ms) | dense p50 (ms) | hybrid p50 (ms) | rerank@20 p50 (ms) | rerank@50 p50 (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| section | 1,959 | 1,959 of 1,959 | 202 | 472 | 144 | 170 | 11.5 | 0.30 | 1.11 | 1.47 | 776 | 1,940 |
| section-split | 2,137 | 1,959 of 1,959 | 217 | 455 | 14 | 77 | 27.9 | 0.31 | 1.14 | 1.49 | 826 | 2,066 |
| subsection | 7,319 | 1,959 of 1,959 | 51 | 113 | 14 | 176 | 41.6 | 0.76 | 4.09 | 4.95 | 1,333 | 3,333 |
| subsection-context | 7,319 | 1,959 of 1,959 | 79 | 142 | 14 | 88 | 82.7 | 1.08 | 4.14 | 5.25 | 282 | 706 |
| fixed-256 | 2,139 | 1,393 of 1,959 | 256 | 256 | 0 | 67 | 31.8 | 0.34 | 1.16 | 1.58 | 348 | 871 |
| fixed-512 | 1,065 | 927 of 1,959 | 512 | 512 | 0 | 85 | 12.5 | 0.16 | 0.54 | 0.74 | 818 | 2,044 |

### Table 8. The predictions in DESIGN.md, held or broken (n=50)

| # | prediction | result | verdict |
|---|---|---|---|
| 1 | hybrid RRF, no rerank: nDCG@10 order E, A, D, C, B with E minus A at most 0.02 | actual order section-split > subsection-context > section > subsection > fixed-256 (section-split 0.854; section 0.802; fixed-256 0.672; subsection-context 0.841; subsection 0.746); E minus A = +0.052 | broken |
| 2 | dense only, no rerank: B at least 0.10 below C on nDCG@10 | B 0.713, C 0.838, gap +0.125 | held |
| 3 | section, no rerank: BM25 nDCG@10 above dense; hybrid minus BM25 in (0, 0.05); hybrid gain larger on multi than single | BM25 0.701, dense 0.807, hybrid 0.802 (+0.101); gain multi +0.144 vs single +0.067 | broken |
| 4 | section, hybrid RRF: rerank@20 raises MRR@10 by at least 0.03 and nDCG@10 by at least 0.02; recall@10 moves less than MRR@10; rerank@50 within 0.01 nDCG@10 of rerank@20 | MRR@10 +0.070, nDCG@10 +0.035, R@10 +0.004, rerank@50 minus rerank@20 nDCG@10 -0.005 | held |
| 5 | hybrid RRF, no rerank, k=10: median tokens of B under a quarter of A's | A 3,001, B 873, ratio 0.29 | broken |
| 6 | section, hybrid RRF: top-1 fused score AUC below 0.75; with rerank@20 the top-1 cross-encoder AUC at least 0.75 | fused AUC 0.81, reranked AUC 0.97 | broken |

<details>
<summary>Table 9. Every configuration (72 runs, n=50)</summary>

| chunker | retriever | nDCG@10 | R@10 | MRR@10 | R@5 | R@20 | tokens@10 median | tokens@10 p90 |
|---|---|---|---|---|---|---|---|---|
| section-split | dense + rerank@20 | 0.858 | 0.875 | 0.906 | 0.815 | 0.917 | 3,032 | 3,985 |
| subsection-context | hybrid min-max 0.5 | 0.856 | 0.885 | 0.902 | 0.813 | 0.914 | 1,800 | 2,891 |
| subsection-context | hybrid RRF + rerank@20 | 0.855 | 0.883 | 0.921 | 0.814 | 0.911 | 1,632 | 2,961 |
| section-split | dense + rerank@50 | 0.854 | 0.868 | 0.906 | 0.815 | 0.923 | 2,990 | 3,925 |
| section-split | hybrid RRF | 0.854 | 0.868 | 0.928 | 0.815 | 0.901 | 2,997 | 3,790 |
| section-split | hybrid min-max 0.5 + rerank@50 | 0.853 | 0.869 | 0.906 | 0.815 | 0.920 | 3,031 | 3,925 |
| subsection-context | hybrid min-max 0.5 + rerank@20 | 0.853 | 0.882 | 0.917 | 0.817 | 0.914 | 1,783 | 2,891 |
| section-split | hybrid RRF + rerank@50 | 0.853 | 0.869 | 0.906 | 0.815 | 0.920 | 3,014 | 3,925 |
| subsection-context | dense + rerank@50 | 0.850 | 0.889 | 0.907 | 0.806 | 0.913 | 1,919 | 3,100 |
| section-split | hybrid min-max 0.5 + rerank@20 | 0.850 | 0.863 | 0.906 | 0.815 | 0.899 | 3,104 | 3,931 |
| section-split | hybrid RRF + rerank@20 | 0.850 | 0.864 | 0.906 | 0.812 | 0.901 | 3,081 | 3,931 |
| section-split | hybrid min-max 0.5 | 0.847 | 0.866 | 0.907 | 0.812 | 0.899 | 3,011 | 3,790 |
| subsection-context | hybrid min-max 0.5 + rerank@50 | 0.846 | 0.888 | 0.903 | 0.806 | 0.918 | 1,871 | 3,047 |
| subsection-context | dense + rerank@20 | 0.846 | 0.872 | 0.912 | 0.833 | 0.906 | 1,852 | 3,127 |
| subsection-context | BM25 + rerank@50 | 0.846 | 0.875 | 0.910 | 0.794 | 0.913 | 1,688 | 2,864 |
| subsection-context | hybrid RRF + rerank@50 | 0.845 | 0.885 | 0.903 | 0.802 | 0.908 | 1,768 | 3,010 |
| section-split | BM25 + rerank@50 | 0.844 | 0.854 | 0.906 | 0.805 | 0.897 | 3,117 | 3,969 |
| section-split | dense | 0.843 | 0.872 | 0.914 | 0.798 | 0.917 | 2,963 | 3,819 |
| subsection-context | hybrid RRF | 0.841 | 0.883 | 0.892 | 0.814 | 0.911 | 1,843 | 2,961 |
| subsection-context | dense | 0.838 | 0.875 | 0.901 | 0.817 | 0.906 | 1,833 | 3,127 |
| section | dense + rerank@50 | 0.838 | 0.870 | 0.915 | 0.799 | 0.917 | 2,961 | 3,876 |
| section | hybrid RRF + rerank@20 | 0.837 | 0.867 | 0.915 | 0.799 | 0.892 | 3,042 | 4,001 |
| section | dense + rerank@20 | 0.834 | 0.860 | 0.915 | 0.795 | 0.888 | 2,889 | 3,915 |
| subsection-context | BM25 + rerank@20 | 0.834 | 0.862 | 0.914 | 0.798 | 0.897 | 1,621 | 2,823 |
| section | hybrid RRF + rerank@50 | 0.832 | 0.857 | 0.915 | 0.799 | 0.912 | 3,015 | 3,876 |
| section | hybrid min-max 0.5 + rerank@50 | 0.832 | 0.857 | 0.915 | 0.799 | 0.916 | 3,049 | 4,135 |
| section | hybrid min-max 0.5 + rerank@20 | 0.832 | 0.854 | 0.915 | 0.799 | 0.892 | 3,054 | 4,029 |
| section | BM25 + rerank@50 | 0.831 | 0.850 | 0.915 | 0.799 | 0.903 | 3,172 | 4,135 |
| section | hybrid min-max 0.5 | 0.822 | 0.851 | 0.889 | 0.801 | 0.892 | 2,930 | 3,852 |
| section-split | BM25 + rerank@20 | 0.819 | 0.833 | 0.886 | 0.788 | 0.872 | 3,163 | 3,848 |
| section | dense | 0.807 | 0.865 | 0.876 | 0.785 | 0.888 | 2,797 | 3,748 |
| section | BM25 + rerank@20 | 0.807 | 0.836 | 0.877 | 0.784 | 0.861 | 3,253 | 4,212 |
| section | hybrid RRF | 0.802 | 0.863 | 0.845 | 0.794 | 0.892 | 3,001 | 3,852 |
| subsection-context | BM25 | 0.753 | 0.850 | 0.774 | 0.783 | 0.897 | 1,595 | 2,824 |
| subsection | hybrid RRF | 0.746 | 0.793 | 0.842 | 0.728 | 0.850 | 873 | 1,122 |
| subsection | hybrid min-max 0.5 | 0.741 | 0.811 | 0.809 | 0.740 | 0.855 | 864 | 1,094 |
| subsection | dense + rerank@20 | 0.729 | 0.828 | 0.796 | 0.678 | 0.864 | 856 | 1,263 |
| subsection | hybrid min-max 0.5 + rerank@20 | 0.723 | 0.822 | 0.793 | 0.691 | 0.855 | 920 | 1,351 |
| subsection | hybrid RRF + rerank@20 | 0.716 | 0.808 | 0.793 | 0.704 | 0.850 | 898 | 1,275 |
| subsection | hybrid RRF + rerank@50 | 0.714 | 0.801 | 0.787 | 0.671 | 0.865 | 903 | 1,384 |
| subsection | hybrid min-max 0.5 + rerank@50 | 0.714 | 0.801 | 0.787 | 0.671 | 0.865 | 903 | 1,275 |
| subsection | dense + rerank@50 | 0.714 | 0.803 | 0.787 | 0.671 | 0.858 | 885 | 1,332 |
| subsection | dense | 0.713 | 0.782 | 0.804 | 0.741 | 0.864 | 880 | 1,240 |
| subsection | BM25 + rerank@20 | 0.711 | 0.783 | 0.783 | 0.697 | 0.821 | 850 | 1,280 |
| section-split | BM25 | 0.705 | 0.807 | 0.728 | 0.774 | 0.872 | 3,207 | 3,789 |
| subsection | BM25 + rerank@50 | 0.703 | 0.793 | 0.776 | 0.691 | 0.847 | 883 | 1,275 |
| section | BM25 | 0.701 | 0.800 | 0.735 | 0.726 | 0.861 | 3,147 | 4,137 |
| fixed-256 | BM25 + rerank@20 | 0.681 | 0.758 | 0.707 | 0.706 | 0.778 | 2,811 | 3,326 |
| fixed-256 | dense + rerank@20 | 0.676 | 0.744 | 0.709 | 0.713 | 0.776 | 2,560 | 3,326 |
| fixed-256 | hybrid RRF + rerank@50 | 0.675 | 0.765 | 0.689 | 0.706 | 0.800 | 2,809 | 3,070 |
| fixed-256 | hybrid min-max 0.5 + rerank@50 | 0.675 | 0.765 | 0.689 | 0.706 | 0.797 | 2,560 | 3,072 |
| fixed-256 | hybrid RRF | 0.672 | 0.751 | 0.716 | 0.662 | 0.789 | 2,812 | 3,326 |
| fixed-256 | dense + rerank@50 | 0.671 | 0.754 | 0.691 | 0.706 | 0.790 | 2,560 | 3,070 |
| fixed-256 | hybrid min-max 0.5 + rerank@20 | 0.670 | 0.756 | 0.688 | 0.706 | 0.793 | 2,813 | 3,325 |
| fixed-256 | hybrid RRF + rerank@20 | 0.665 | 0.751 | 0.680 | 0.701 | 0.789 | 2,812 | 3,325 |
| fixed-256 | BM25 + rerank@50 | 0.665 | 0.755 | 0.674 | 0.696 | 0.787 | 2,811 | 3,071 |
| fixed-256 | hybrid min-max 0.5 | 0.663 | 0.746 | 0.713 | 0.682 | 0.793 | 2,813 | 3,326 |
| subsection | BM25 | 0.635 | 0.751 | 0.664 | 0.652 | 0.821 | 802 | 1,147 |
| fixed-256 | BM25 | 0.626 | 0.753 | 0.637 | 0.683 | 0.778 | 2,814 | 3,327 |
| fixed-256 | dense | 0.588 | 0.668 | 0.630 | 0.598 | 0.776 | 2,560 | 3,070 |
| fixed-512 | hybrid RRF | 0.465 | 0.547 | 0.537 | 0.478 | 0.555 | 5,119 | 5,632 |
| fixed-512 | hybrid min-max 0.5 | 0.452 | 0.527 | 0.522 | 0.493 | 0.555 | 5,119 | 5,632 |
| fixed-512 | dense + rerank@20 | 0.411 | 0.512 | 0.469 | 0.477 | 0.524 | 5,119 | 5,631 |
| fixed-512 | BM25 + rerank@50 | 0.410 | 0.540 | 0.459 | 0.461 | 0.572 | 5,119 | 5,631 |
| fixed-512 | hybrid RRF + rerank@50 | 0.409 | 0.540 | 0.459 | 0.461 | 0.570 | 5,120 | 5,631 |
| fixed-512 | dense + rerank@50 | 0.406 | 0.505 | 0.463 | 0.461 | 0.523 | 5,120 | 5,632 |
| fixed-512 | hybrid RRF + rerank@20 | 0.404 | 0.520 | 0.457 | 0.481 | 0.555 | 5,119 | 5,632 |
| fixed-512 | hybrid min-max 0.5 + rerank@20 | 0.404 | 0.520 | 0.457 | 0.481 | 0.555 | 5,119 | 5,632 |
| fixed-512 | hybrid min-max 0.5 + rerank@50 | 0.402 | 0.520 | 0.456 | 0.461 | 0.552 | 5,120 | 5,631 |
| fixed-512 | BM25 | 0.398 | 0.507 | 0.415 | 0.444 | 0.548 | 5,118 | 6,136 |
| fixed-512 | BM25 + rerank@20 | 0.395 | 0.514 | 0.455 | 0.470 | 0.548 | 5,119 | 5,631 |
| fixed-512 | dense | 0.393 | 0.467 | 0.488 | 0.407 | 0.524 | 5,119 | 5,631 |

</details>
<!-- results:end -->

## What this measures and what it does not

The unit of relevance is a provision: a section of the Act or a paragraph
of a Schedule, identified by the legislation.gov.uk id. Each configuration
returns a ranked list of chunks, that list is collapsed to distinct
provisions, and recall, MRR and nDCG are computed over those provisions
against the labels in `eval/questions.json`. The labelling rule is in
`eval/README.md`. The question set was written before the chunker existed
and has not been changed since.

Answer quality is out of scope. Measuring whether a generated answer is
correct needs a model to generate it and either a model or a person to
judge it, and this repo has no hosted model and no budget for one. The
retrieval metrics here are the part of a RAG system that can be checked
for free; they say whether the right text reached the prompt, not whether
the answer written from it was right. Those are different questions and
this repo answers only the first.

Sixty questions is enough to separate configurations that differ by a lot
and not enough to separate ones that differ by a little. Every comparison
against the baseline reports a paired bootstrap interval and per-question
wins and losses, and where the interval includes zero the table says "no
measurable difference" rather than naming a winner.

## Corpus

The current consolidated text of the Act from legislation.gov.uk, valid
from 16 July 2026, fetched on 25 October 2026. The file itself is not
committed; `data/corpus.lock.json` holds its URL, SHA256 and size, and
`npm run fetch` refuses any download that does not match, so the
measurements stay tied to one exact set of bytes (see DECISIONS.md D16
for why it is not simply committed). 1,552 live sections and 407 live
schedule paragraphs; 134 repealed shells and 27 quoted sections of other
Acts are excluded. `docs/corpus-report.md` records the structure, the
length distribution, the fact that cross-references are plain text in the
XML, and the traps in the markup.

## Reproducing the numbers

The raw corpus is not in the repo. `npm run fetch` downloads it from
legislation.gov.uk and verifies it against the SHA256 in
`data/corpus.lock.json`; if the bytes differ, because a newer
consolidation has been published, the script exits non-zero and says so,
and the numbers in this file are not about the file you have. Every other
step, including the tests, needs the corpus on disk first.

```
npm install
npm run fetch     # download data/raw/ukpga-2006-46.xml and check its hash
npm run parse     # XML -> data/corpus.json, prints the counts
npm run chunk     # six chunkers -> data/index/<chunker>/chunks.json + bm25.json
npm run embed     # bge-small embeddings, cached under data/index/
npm run matrix    # 72 runs -> results/runs/*.json, results/matrix.json
npm run report    # regenerates the tables between the markers in this file
npm test
```

The first `embed` and `matrix` runs download two ONNX models (about 130 MB
and 90 MB) into `data/models/`. Embedding all six chunkers took about ten
minutes on the machine named in the tables; the matrix took longer, mostly
in the cross-encoder.

## Layout

| Path | What it holds |
|---|---|
| `src/contract/` | Sealed shapes: chunk, retriever, query, metrics |
| `src/corpus/` | XML parser and the provision type |
| `src/chunkers/` | The six chunking strategies |
| `src/retrieval/` | BM25 with its own Porter stemmer, dense embedding and search, RRF and min-max fusion, cross-encoder reranking |
| `src/eval/` | Recall, MRR, nDCG, token volume, abstention AUC, paired bootstrap |
| `scripts/` | The pipeline stages above and the report generator |
| `eval/` | The question set and the labelling rule |
| `docs/corpus-report.md` | What the source XML looks like |
| `DESIGN.md` | The design and the predictions made before the run |
| `DECISIONS.md` | Each decision with the alternative rejected |
| `results/` | Every run's output, the chunker and embedding statistics |

## What I would change with more time

<!-- limits:start -->
The question set is the weakest part. The 28 single-section questions
are saturated: every retriever on section chunks finds the answer in the
top 10, so all the discrimination comes from 22 multi-section questions,
and the bootstrap intervals are as wide as they are because of that. I
would write 30 more multi-section questions and 30 in lay language that
does not reuse the Act's vocabulary, and I would have someone else write
them, because that is the only real test of whether my labelling rule
can be applied by another person.

I ran one embedder and one reranker. Whether the ranking of decisions
survives a bigger embedder (`bge-base`) or a reranker trained on
something other than web search (`bge-reranker-base`) is the next thing
to measure, on the two chunkers that won.

The fixed-window chunkers were credited to the dominant provision, which
is the honest cost of ignoring boundaries, but a window that straddles
two sections could be scored for both and I would like to know how much
of the gap that closes. The cross-reference expansion chunker from
DESIGN.md was not built; the multi-section questions are exactly where it
should help.

I did not ablate the BM25 tokeniser, the query prefix, or RRF's k, and the
min-max fusion weight was never tuned. That min-max still beat RRF at an
untuned 0.5 is a result I did not expect and would check with a second
question set before believing it.
<!-- limits:end -->
