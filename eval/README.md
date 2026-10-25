# The question set

Sixty questions about the Companies Act 2006, written by hand on 25 October
2026, before any chunker, index or retriever existed in this repo. Fifty
have answers in the Act and are labelled with the provisions that answer
them. Ten look like questions about the Act but are answered by other
legislation, and carry no labels.

| Type | Count | What it tests |
|---|---|---|
| single | 28 | The answer sits inside one section |
| multi | 22 | The answer is split across sections that cross-reference each other, or across a section and a Schedule |
| unanswerable | 10 | The retriever should have nothing good to return |

The file is `questions.json`. Each question has an `id`, a `type`, the
`question` text, a list of `relevant` provisions with a `grade`, and
`notes` recording the answer I expect and why I drew the labels where I
did.

## How I decided a provision is relevant

The unit of relevance is a provision: a body section such as `section-172`
or a schedule paragraph such as `schedule-1A-paragraph-2`, identified by
the `id` attribute legislation.gov.uk gives it. Not a subsection, not a
chunk. Every chunking strategy maps its chunks back to provisions before
scoring, so the labels do not favour any granularity.

Grades:

- **2**: the provision's text states the answer. A reader who quoted this
  provision alone would answer the question correctly, even if not
  completely.
- **1**: a reader needs this provision to give a complete and correct
  answer. That means one of three things: it defines a term the grade-2
  provision depends on; it states a condition or exception that changes
  the answer in an ordinary case the question covers; or the grade-2
  provision explicitly sends the reader there for the detail ("see
  sections 642 to 644").
- **0** (not listed): everything else.

What grade 0 deliberately includes, because these are the cases where a
loose labeller would be generous and make recall look better than it is:

- Provisions that mention the topic without answering the question.
  Section 1162 (parent undertakings) is not relevant to "when is a company
  a subsidiary", even though a retriever will rank it highly.
- Offence and penalty provisions, unless the question asks about
  penalties.
- Interpretation sections, unless the question asks for a definition.
- Provisions that cross-reference the answer without containing it.
  Section 441 says accounts must be filed; the period is in 442, and only
  442 is labelled for "how long do I have to file".
- Enabling powers for regulations that could create exceptions. Section
  158 lets the Secretary of State allow under-16 directors; the ordinary
  answer to "what is the minimum age" is still in 157 alone.
- Repealed provisions. They have no text and cannot answer anything.

I wrote each question from my own knowledge of the Act, then looked up the
cited sections in the raw XML to check that the text still says what I
thought and that the section is live. Two things I expected to label turned
out to be repealed shells in this version: the company's own register of
directors (162 to 167) and its own PSC register (790M). The first became
unanswerable question u08.

What I did not do: run any retriever, look at any chunk, or search the Act
by keyword to find extra sections to add to a label list. Keyword searches
were used only to confirm that the unanswerable questions have no hidden
answer.

## What the set does not cover

It has no questions that need the Explanatory Notes, no questions about
Northern Ireland or Scotland variants, no questions whose answer is a table
row other than the small-company thresholds, and no questions phrased in
lay language far from the statutory vocabulary ("can I pay myself a
dividend if the company made a loss last year" rather than "out of what may
a company make a distribution"). That last gap is the one I would fill
first with more time, because it is where dense retrieval should beat BM25
and the current set may not show it.

Sixty questions is enough to rank configurations that differ by a lot and
not enough to rank ones that differ by a little. The results will say so
and will report paired per-question wins and losses alongside the means.
