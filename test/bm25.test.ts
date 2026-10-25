import { describe, expect, it } from 'vitest';
import type { Chunk } from '../src/contract/index.js';
import { buildBm25, searchBm25, tokenise } from '../src/retrieval/bm25.js';
import { rrf, minmax } from '../src/retrieval/fusion.js';

const chunk = (id: string, text: string): Chunk => ({
  id, chunker: 't', provisionId: `section-${id}`, text, tokens: text.split(' ').length,
  meta: { number: id, heading: '', region: 'body' },
});

describe('tokenise', () => {
  it('lowercases, drops stopwords, keeps numbers and stems', () => {
    expect(tokenise('The directors of a company must deliver to the registrar under section 441')).toEqual(
      ['director', 'compani', 'must', 'deliv', 'registrar', 'section', '441'],
    );
    expect(tokenise('Section 790ZG applies')).toEqual(['section', '790zg', 'appli']);
  });
});

describe('bm25', () => {
  const docs = [
    chunk('1', 'A private company must have at least one director. A public company must have at least two directors.'),
    chunk('2', 'A company may amend its articles by special resolution.'),
    chunk('3', 'A special resolution means a resolution passed by a majority of not less than 75%.'),
    chunk('4', 'The registrar must register the charge within the period allowed.'),
  ];
  const index = buildBm25(docs);

  it('ranks the document with the rarer matching terms first', () => {
    const hits = searchBm25(index, 'how many directors must a private company have', 10);
    expect(hits[0]!.provisionId).toBe('section-1');
    expect(hits.map((h) => h.rank)).toEqual(hits.map((_, i) => i + 1));
  });

  it('prefers the document where the query terms are concentrated', () => {
    const hits = searchBm25(index, 'special resolution majority', 10);
    expect(hits[0]!.provisionId).toBe('section-3');
    expect(hits.find((h) => h.provisionId === 'section-4')).toBeUndefined();
  });

  it('returns nothing for a query with no shared terms', () => {
    expect(searchBm25(index, 'xylophone', 10)).toEqual([]);
  });

  it('length-normalises: a shorter document with the same tf scores higher', () => {
    const idx = buildBm25([chunk('a', 'charge charge'), chunk('b', 'charge charge and many other unrelated words appear here too')]);
    const hits = searchBm25(idx, 'charge', 2);
    expect(hits[0]!.provisionId).toBe('section-a');
  });
});

describe('fusion', () => {
  const a = [{ chunkId: 'x', provisionId: 'p1', score: 10, rank: 1 }, { chunkId: 'y', provisionId: 'p2', score: 5, rank: 2 }];
  const b = [{ chunkId: 'y', provisionId: 'p2', score: 0.9, rank: 1 }, { chunkId: 'z', provisionId: 'p3', score: 0.8, rank: 2 }];

  it('rrf puts the item present in both lists first', () => {
    const fused = rrf([a, b], 60);
    expect(fused[0]!.chunkId).toBe('y');
    expect(fused[0]!.score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(fused.map((h) => h.rank)).toEqual([1, 2, 3]);
  });

  it('minmax normalises each list to [0,1] before weighting', () => {
    const fused = minmax([a, b], 0.5);
    const y = fused.find((h) => h.chunkId === 'y')!;
    expect(y.score).toBeCloseTo(0.5 * 0 + 0.5 * 1);
    expect(fused[0]!.chunkId).toBe('x'); // x: 0.5*1 = 0.5 ties with y at 0.5; tie broken by id
  });
});
