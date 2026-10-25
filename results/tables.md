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