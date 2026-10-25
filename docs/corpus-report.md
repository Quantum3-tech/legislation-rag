# The corpus: Companies Act 2006 as published by legislation.gov.uk

What the source XML actually looks like, measured before I wrote any
chunking code. Every number here comes from scripts run against the file
described in the first section on 25 October 2026.

## The file

I fetched `https://www.legislation.gov.uk/ukpga/2006/46/data.xml`, which is
the whole Act in the Crown Legislation Markup Language (CLML) schema. It is
the current point-in-time version, not the text as enacted.

| Property | Value |
|---|---|
| Size | 15,193,495 bytes |
| `NumberOfProvisions` (root attribute) | 2,120 |
| `dc:modified` | 2026-07-24 |
| `RestrictStartDate` (text valid from) | 2026-07-16 |
| Stored at | `data/raw/ukpga-2006-46.xml` |

The root has five children: `Metadata`, `Primary` (the Act itself),
`Versions`, `Resources` and `Commentaries`. `Primary` splits into
`PrimaryPrelims` (long title, enacting words), `Body` and `Schedules`.
`Commentaries` holds 4,517 editorial notes: 2,070 amendment notes (type F),
1,919 modification notes (C), 520 commencement notes (I) and 8 prospective
notes (P). They are not part of the text of the law and I exclude them from
the corpus.

## How the structure nests

```
Body
  Part (49)
    Chapter (optional; 22 of the 49 Parts have them, 115 in total)
      Pblock (cross-heading group, optional; 572)
        P1group (a section with its heading; 1,677)
          Title
          P1 (the section; Pnumber + P1para)
            P2 (subsection "(1)")
              P3 (paragraph "(a)")
                P4 (sub-paragraph "(i)")
                  P5 (only in Schedule 10)
Schedules
  Schedule (20)
    Part (32) / Pblock (61)
      P1 (a schedule paragraph; 443)
```

Every element down to P3 carries a stable `id` such as `section-172`,
`section-172-1`, `section-172-1-a` or `schedule-1A-paragraph-2`, plus a
`DocumentURI`. Those ids are what I will use as the unit of relevance.

Where body sections sit:

| Ancestor path | Sections |
|---|---|
| Part / Chapter / Pblock / P1group | 996 |
| Part / Pblock / P1group | 409 |
| Part / Chapter / P1group | 201 |
| Part / P1group | 44 |
| inside a `BlockAmendment` (see below) | 27 |

How deep body sections go:

| Deepest level present | Sections |
|---|---|
| No subsections (text directly under the section) | 209 |
| Subsections only | 188 |
| Subsections with lettered paragraphs | 911 |
| Down to roman sub-paragraphs | 369 |

So the typical section is three levels deep and the fourth level is common.
Nothing in the body goes to P5.

## Section count and numbering

The Act is described as having about 1,300 sections. The body contains
1,677 `P1` elements. Of those, 27 are not sections of this Act at all: they
are quoted text of other Acts inside `BlockAmendment` elements, and one of
them is numbered "13", colliding with the real section 13. That leaves
1,650 numbered sections running from 1 to 1300, of which 376 carry a letter
suffix from later insertion (`9A`, `113A` to `113I`, `790ZG` and so on).
One `Pnumber` is "159." with a trailing full stop.

Of the 1,650 sections, 99 are repealed shells: 96 contain only a row of
dots and 3 contain nothing but text inside `Repeal` elements. The 20
Schedules hold 443 paragraphs, 36 of which are repealed shells. Schedule 8
(index of defined expressions) and Schedule 16 (repeals) contain no
paragraphs at all, only tables.

The live corpus is therefore 1,551 body sections and 407 schedule
paragraphs.

## Section lengths in tokens

Measured with the tokenizer of `Xenova/bge-small-en-v1.5` (BERT uncased
WordPiece, the embedding model I propose), on heading plus live text, special
tokens included.

| Population | n | median | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| Live body sections | 1,551 | 221 | 329 | 459 | 571 | 945 | 2,091 |
| Live schedule paragraphs | 407 | 52 | 128 | 227 | 323 | 692 | 1,147 |

| Threshold | Live body sections |
|---|---|
| Under 64 tokens | 115 |
| Over 256 tokens | 625 |
| Over 512 tokens | 109 |

Total live text is 399,269 tokens in the body and 41,468 in the schedules.
The longest section is 1266 (Transparency rules) at 2,091 tokens; the next
four are 1221, 414CB, 1087 and 833A, all between 1,180 and 1,220 tokens.
The tokens-to-words ratio is 1.38.

Subsections (`P2`) in the body: 6,530 of them, median 36 words, 90th
percentile 79 words, longest 1,454 words.

## How cross-references are marked up

They are not, in the body. This is the finding that most changes the
design.

| Reference form in body text | Count |
|---|---|
| `CitationSubRef` elements (structured reference) | 0 |
| `InternalLink` elements | 12 |
| `Citation` elements (all to other Acts or instruments) | 45 |
| Plain text "section N" or "sections N to M" | 2,345 mentions in 954 sections |
| Plain text "subsection (N)" | 1,193 |
| Plain text "Part N" | 246 |
| Plain text "Schedule N" | 115 |
| Plain text "this Part" | 313 |
| Plain text "this Chapter" | 226 |

The 975 `CitationSubRef` elements that point into this Act all sit inside
`Commentaries`, where the editors record which provision an amendment
touched. In the operative text, "see section 8" is just words. Any
cross-reference expansion will have to come from a regular expression, and
"this Part" and "this Chapter" have no referent at all once a subsection is
cut out of its section.

## What will cause trouble

**Repealed text is still in the file.** `Repeal` elements carry
`RetainText="true"`, and when the repeal is one half of a substitution the
old words sit next to the new words. Taking the element's text naively gives
both. Section 444's heading comes out as "Filing obligations of companies
subject to small companies regime Filing obligations of small companies
other than micro-entities". 350 section headings and 281 sections contain a
`Substitution`; 564 contain an `Addition`; 691 of 1,650 sections carry at
least one inline amendment marker. The extractor has to drop `Repeal`
content and unwrap `Addition` and `Substitution`.

**The `Status` attribute does not find repeals.** Only 55 elements in the
whole document carry `Status="Repealed"`, against 135 repealed shells.
Repeal has to be detected from content.

**Prospective text.** Nine elements carry `Status="Prospective"`, all in
Schedule 9 (paragraphs 9 to 16 and their Part), and all are already shells.
Nothing live in this version is prospective.

**Tables inside sections.** 16 `Tabular` elements: 12 in body sections
(129, 159A, 382, 383, 384A, 465, 466, 494ZA, 859E, 1067A, 1098D, 1262) and
4 in schedules, the largest being Schedule 2 at 367 rows. The thresholds
that define small, medium and micro companies (382, 383, 384A, 465, 466)
are table cells. Flattened in reading order they come out as "1. Turnover
Not more than £15 million 2. Balance sheet total Not more than £7.5
million", which is readable but loses the column headers.

**Formulae.** One MathML `math` element in the whole file, and it is in a
commentary, not in the operative text. Formulae are not a problem for this
Act.

**Lists.** 160 sections contain `UnorderedList` or `OrderedList`, and two
`Text` elements are marked `Hanging`. These need their items joined with
separators or the words run together.

**Quoted other Acts.** 50 `BlockAmendment` elements, 21 of them inside body
sections, quote text that this Act inserts into other legislation. The
quoted text has its own `P1`, `P2` and `Pnumber` elements with no `id`. It
has to be kept as part of the amending section's text but never treated as
a provision of this Act.

**Empty marker elements.** 3,906 `CommentaryRef` elements, mostly inside
`Pnumber` and `Text`, with no text content. Harmless if dropped, a stray
footnote letter if not.

**Punctuation inside structure.** Subsection numbers live in `Pnumber`
elements with no brackets; the dashes that introduce lists are U+2014
characters inside `Text`; the extractor has to reinsert "(1)", "(a)" and
line breaks or subsections run into each other.

**Geographic extent.** 777 elements carry `RestrictExtent="E+W+S+N.I."`,
6 are `E+W+S`, 5 are `E+W+N.I.`, 3 are `S` and 1 is `E+W`. I will carry
extent as metadata and do nothing else with it.

**Definitions.** 588 `Term` elements in the body mark defined expressions.
They are the one piece of semantic markup the body does have, and I may
use them later to tag definition chunks.

## What differs from what I assumed

1. I assumed internal cross-references would be marked up, because the
   site renders them as links. They are plain text in the data. The site's
   links are generated at render time.
2. I assumed "about 1,300 sections" meant about 1,300 units. It means
   1,650 numbered sections, 99 of them empty, plus 443 schedule
   paragraphs. Inserted lettered sections are 23% of the body.
3. I assumed repealed provisions would be absent or flagged. They are
   present with their old text retained and mostly unflagged.
4. I assumed sections would be long. The median is 221 tokens, under half
   of the embedding model's 512-token window. Only 7% of live sections
   exceed the window, but the tail runs to over 2,000 tokens, so a
   section-level chunk is truncated for 109 sections and a fixed window is
   wasted on the other 1,442.
5. I assumed thresholds and figures would be in prose. The ones people
   actually ask about are in tables.
6. The 2023 Economic Crime and Corporate Transparency Act changes are in
   force in this version. Sections 162 to 167 (company's own register of
   directors) and 790M (company's own PSC register) are repealed shells,
   and sections 159A (disqualified persons), 167G (notify registrar of
   director changes) and 1110A (identity verification) exist. Questions
   written from memory of the Act as it stood a few years ago would label
   sections that no longer have text.

## What this report does not do

It does not measure the Explanatory Notes, which legislation.gov.uk serves
separately, and it does not compare this version with the enacted text. I
have not checked the Welsh-language name forms or the Northern Ireland
variants beyond counting extent attributes. With more time I would diff this
file against the version from a year earlier to see how much of the Act
changes between fetches, because that bounds how reproducible any number in
this repo can be if someone re-fetches the corpus.

## How to reproduce

The scripts that produced these numbers were throwaway Python run against
the raw file. The TypeScript loader that replaces them will print the same
counts, and the README will cite the loader's output rather than this
report once it exists.
