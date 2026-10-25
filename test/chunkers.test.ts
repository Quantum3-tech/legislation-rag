import { describe, expect, it } from 'vitest';
import type { Provision } from '../src/corpus/types.js';
import type { TokenCounter } from '../src/tokenizer.js';
import { CHUNKERS, breadcrumb, headingLine } from '../src/chunkers/index.js';

// A word-count token counter stands in for the real tokenizer so the tests run
// without downloading a model. One word = one token, plus two specials.
const tc: TokenCounter = {
  count: (t) => t.split(/\s+/).filter(Boolean).length + 2,
  wordTokens: () => 1,
};

const unit = (id: string, label: string, words: number) => ({ id, label, text: `${label} ${Array.from({ length: words - 1 }, (_, i) => `w${i}`).join(' ')}` });
const prov = (id: string, number: string, units: ReturnType<typeof unit>[]): Provision => ({
  id, region: 'body', number, heading: `Heading ${number}`, amended: false,
  part: { number: 'Part 10', title: 'Directors' }, chapter: { number: 'Chapter 2', title: 'Duties' }, crossHeading: 'The general duties',
  text: units.map((u) => u.text).join('\n'), units, xrefs: [],
});

const short = prov('section-1', '1', [unit('section-1-1', '(1)', 20), unit('section-1-2', '(2)', 20)]);
const long = prov('section-2', '2', [unit('section-2-1', '(1)', 300), unit('section-2-2', '(2)', 300), unit('section-2-3', '(3)', 300)]);

describe('chunk text prefixes', () => {
  it('builds breadcrumb and heading line from the provision context', () => {
    expect(breadcrumb(short)).toBe('Part 10 Directors > Chapter 2 Duties > The general duties');
    expect(headingLine(short)).toBe('1 Heading 1');
  });
});

describe('section and section-split', () => {
  it('section emits one chunk per provision with the heading line first', () => {
    const chunks = CHUNKERS.section!([short, long], tc);
    expect(chunks.map((c) => c.provisionId)).toEqual(['section-1', 'section-2']);
    expect(chunks[0]!.text.startsWith('1 Heading 1\n(1) ')).toBe(true);
    expect(chunks[0]!.tokens).toBe(tc.count(chunks[0]!.text));
  });

  it('section-split leaves short provisions whole and splits long ones at subsection boundaries', () => {
    const chunks = CHUNKERS['section-split']!([short, long], tc);
    const s1 = chunks.filter((c) => c.provisionId === 'section-1');
    const s2 = chunks.filter((c) => c.provisionId === 'section-2');
    expect(s1).toHaveLength(1);
    expect(s2).toHaveLength(3);
    for (const c of s2) {
      expect(c.text.startsWith('Part 10 Directors > Chapter 2 Duties > The general duties\n2 Heading 2\n')).toBe(true);
      expect(c.tokens).toBeLessThanOrEqual(512);
    }
    expect(s2.map((c) => c.id)).toEqual(['section-split:section-2:0', 'section-split:section-2:1', 'section-split:section-2:2']);
  });
});

describe('subsection chunkers', () => {
  it('subsection emits bare unit text; subsection-context prefixes it', () => {
    const bare = CHUNKERS.subsection!([short], tc);
    const ctx = CHUNKERS['subsection-context']!([short], tc);
    expect(bare).toHaveLength(2);
    expect(bare[1]!.text).toBe(short.units[1]!.text);
    expect(ctx[1]!.text).toBe(`${breadcrumb(short)}\n${headingLine(short)}\n${short.units[1]!.text}`);
  });
});

describe('fixed windows', () => {
  it('covers every word, respects the budget, overlaps, and records spans', () => {
    const chunks = CHUNKERS['fixed-256']!([short, long], tc);
    const budget = 254;
    for (const c of chunks) expect(c.tokens - 2).toBeLessThanOrEqual(budget);
    const totalWords = [short, long].reduce((a, p) => a + `${headingLine(p)}\n${p.text}`.split(/\s+/).length, 0);
    const covered = chunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
    expect(covered).toBeGreaterThanOrEqual(totalWords); // overlap means words are counted more than once
    expect(chunks[0]!.meta.spans).toEqual(['section-1', 'section-2']); // the first window straddles both
    expect(chunks[0]!.provisionId).toBe('section-2'); // credited to the dominant provision
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });
});
