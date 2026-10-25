import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCorpus, extractXrefs } from '../src/corpus/parse.js';
import type { QuestionSet } from '../src/contract/index.js';

const corpus = parseCorpus(readFileSync('data/raw/ukpga-2006-46.xml', 'utf8'), 'test');
const byId = new Map(corpus.provisions.map((p) => [p.id, p]));
const qs: QuestionSet = JSON.parse(readFileSync('eval/questions.json', 'utf8'));

describe('corpus parser', () => {
  it('finds the live provision counts reported in docs/corpus-report.md', () => {
    expect(corpus.stats.body_live).toBe(1552);
    expect(corpus.stats.body_repealed).toBe(98);
    expect(corpus.stats.body_in_block_amendment).toBe(27);
    expect(corpus.stats.schedule_live).toBe(407);
    expect(corpus.stats.schedule_repealed).toBe(36);
  });

  it('drops repealed shells such as the former register of directors', () => {
    for (const id of ['section-162', 'section-163', 'section-790M', 'section-115']) expect(byId.has(id), id).toBe(false);
  });

  it('keeps the substituted text of section 444 and only the new heading', () => {
    const s444 = byId.get('section-444')!;
    expect(s444.heading).toBe('Filing obligations of small companies other than micro-entities');
    expect(s444.text).toContain('must deliver to the registrar a copy of');
    expect(s444.text).not.toContain('()');
  });

  it('brackets subsection numbers and keeps plain-text cross-references', () => {
    const s7 = byId.get('section-7')!;
    expect(s7.text.startsWith('(1) A company is formed under this Act')).toBe(true);
    expect(s7.text).toContain('(see section 8)');
    expect(s7.text).toContain('(see sections 9 to 13)');
    expect(s7.xrefs).toEqual(expect.arrayContaining(['8', '9', '10', '11', '12', '13']));
    expect(s7.units.map((u) => u.label)).toEqual(['(1)', '(2)']);
  });

  it('flattens the small-company threshold table into reading order', () => {
    expect(byId.get('section-382')!.text).toMatch(/Turnover \| Not more than £15 million/);
  });

  it('carries Part, Chapter, cross-heading and schedule context', () => {
    const s172 = byId.get('section-172')!;
    expect(s172.part?.number).toBe('Part 10');
    expect(s172.chapter?.title).toBe('General duties of directors');
    expect(s172.crossHeading).toBe('The general duties');
    const p2 = byId.get('schedule-1A-paragraph-2')!;
    expect(p2.region).toBe('schedule');
    expect(p2.schedule?.number).toBe('SCHEDULE 1A');
    expect(p2.text).toContain('more than 25% of the shares');
  });

  it('never emits a provision with empty text or an empty unit', () => {
    for (const p of corpus.provisions) {
      expect(/[a-z0-9]/i.test(p.text), p.id).toBe(true);
      for (const u of p.units) expect(/[a-z0-9]/i.test(u.text), `${p.id} ${u.id}`).toBe(true);
    }
  });

  it('extracts section ranges', () => {
    expect(extractXrefs('see sections 642 to 644 and section 9A')).toEqual(expect.arrayContaining(['642', '643', '644', '9A']));
  });
});

describe('question set', () => {
  it('has the counts stated in eval/README.md', () => {
    const count = (t: string) => qs.questions.filter((q) => q.type === t).length;
    expect(qs.questions.length).toBe(60);
    expect(count('single')).toBe(28);
    expect(count('multi')).toBe(22);
    expect(count('unanswerable')).toBe(10);
  });

  it('labels only live provisions, so no question depends on an ECCTA-repealed section', () => {
    for (const q of qs.questions) for (const r of q.relevant) expect(byId.has(r.id), `${q.id} -> ${r.id}`).toBe(true);
  });

  it('unanswerable questions carry no labels and answerable ones carry at least one grade 2', () => {
    for (const q of qs.questions) {
      if (q.type === 'unanswerable') expect(q.relevant).toEqual([]);
      else expect(q.relevant.some((r) => r.grade === 2), q.id).toBe(true);
    }
  });
});
