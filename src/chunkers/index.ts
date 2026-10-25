import type { Chunk, ChunkMeta } from '../contract/index.js';
import type { Provision } from '../corpus/types.js';
import type { TokenCounter } from '../tokenizer.js';

// The five chunking strategies from DESIGN.md section 3. Each returns chunks
// whose `text` is exactly what BM25 indexes and the embedder sees.

export const EMBED_WINDOW = 512;

export type Chunker = (provisions: Provision[], tc: TokenCounter) => Chunk[];

function meta(p: Provision, spans?: string[]): ChunkMeta {
  const m: ChunkMeta = { number: p.number, heading: p.heading, region: p.region };
  if (p.part) m.part = p.part;
  if (p.chapter) m.chapter = p.chapter;
  if (p.crossHeading) m.crossHeading = p.crossHeading;
  if (p.schedule) m.schedule = p.schedule;
  if (spans) m.spans = spans;
  return m;
}

/** "172 Duty to promote the success of the company" or "Schedule 1A ..., paragraph 2 Heading". */
export function headingLine(p: Provision): string {
  if (p.region === 'schedule') {
    const sched = p.schedule ? `${p.schedule.number}: ${p.schedule.title}` : 'Schedule';
    return `${sched}, paragraph ${p.number}${p.heading ? ` ${p.heading}` : ''}`;
  }
  return `${p.number} ${p.heading}`.trim();
}

/** Part, Chapter and cross-heading, as one line. */
export function breadcrumb(p: Provision): string {
  const parts: string[] = [];
  if (p.part) parts.push(`${p.part.number} ${p.part.title}`.trim());
  if (p.chapter) parts.push(`${p.chapter.number} ${p.chapter.title}`.trim());
  if (p.crossHeading) parts.push(p.crossHeading);
  return parts.join(' > ');
}

function make(chunker: string, p: Provision, n: number, text: string, tc: TokenCounter, spans?: string[]): Chunk {
  return { id: `${chunker}:${p.id}:${n}`, chunker, provisionId: p.id, text, tokens: tc.count(text), meta: meta(p, spans) };
}

/** A: one chunk per provision, heading line plus full text. */
export const section: Chunker = (ps, tc) => ps.map((p) => make('section', p, 0, `${headingLine(p)}\n${p.text}`, tc));

/** B: one chunk per subsection unit, bare text. */
export const subsection: Chunker = (ps, tc) =>
  ps.flatMap((p) => p.units.map((u, i) => make('subsection', p, i, u.text, tc)));

/** C: one chunk per subsection unit, with breadcrumb and heading line in front. */
export const subsectionContext: Chunker = (ps, tc) =>
  ps.flatMap((p) => {
    const prefix = [breadcrumb(p), headingLine(p)].filter(Boolean).join('\n');
    return p.units.map((u, i) => make('subsection-context', p, i, `${prefix}\n${u.text}`, tc));
  });

/**
 * D: token windows over the whole corpus in reading order, ignoring boundaries.
 * Windows are built word by word using per-word token counts, so a window is
 * within one word of the budget. Credited to the provision contributing most
 * tokens; every provision touched is recorded in meta.spans.
 */
export function fixed(size: number, overlap: number): Chunker {
  const key = `fixed-${size}`;
  return (ps, tc) => {
    const words: { w: string; t: number; p: Provision }[] = [];
    for (const p of ps) {
      const text = `${headingLine(p)}\n${p.text}`;
      for (const w of text.split(/\s+/)) if (w) words.push({ w, t: tc.wordTokens(w), p });
    }
    const budget = size - 2; // room for the two special tokens
    const chunks: Chunk[] = [];
    const perProvision = new Map<string, number>();
    let start = 0;
    while (start < words.length) {
      let end = start, tokens = 0;
      while (end < words.length && tokens + words[end]!.t <= budget) tokens += words[end++]!.t;
      if (end === start) end = start + 1; // a single word over budget still goes in
      const slice = words.slice(start, end);
      const byProv = new Map<string, number>();
      const spans: string[] = [];
      for (const x of slice) {
        if (!byProv.has(x.p.id)) spans.push(x.p.id);
        byProv.set(x.p.id, (byProv.get(x.p.id) ?? 0) + x.t);
      }
      const dominant = [...byProv.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const p = slice.find((x) => x.p.id === dominant)!.p;
      const n = perProvision.get(p.id) ?? 0;
      perProvision.set(p.id, n + 1);
      chunks.push(make(key, p, n, slice.map((x) => x.w).join(' '), tc, spans));
      if (end >= words.length) break;
      // back up by `overlap` tokens
      let back = end, t = 0;
      while (back > start + 1 && t + words[back - 1]!.t <= overlap) t += words[--back]!.t;
      start = Math.max(back, start + 1);
    }
    return chunks;
  };
}

/**
 * E: like A with breadcrumb, but a provision over the embedding window is split
 * at subsection boundaries into pieces that fit, each carrying breadcrumb and
 * heading. A single unit over the window stays whole and is truncated by the
 * embedder; the count of such pieces is reported by the build script.
 */
export const sectionSplit: Chunker = (ps, tc) =>
  ps.flatMap((p) => {
    const prefix = [breadcrumb(p), headingLine(p)].filter(Boolean).join('\n');
    const whole = `${prefix}\n${p.text}`;
    if (tc.count(whole) <= EMBED_WINDOW || p.units.length <= 1) return [make('section-split', p, 0, whole, tc)];
    const out: Chunk[] = [];
    let group: string[] = [];
    const flush = () => {
      if (group.length) out.push(make('section-split', p, out.length, `${prefix}\n${group.join('\n')}`, tc));
      group = [];
    };
    for (const u of p.units) {
      const candidate = `${prefix}\n${[...group, u.text].join('\n')}`;
      if (group.length && tc.count(candidate) > EMBED_WINDOW) flush();
      group.push(u.text);
    }
    flush();
    return out;
  });

export const CHUNKERS: Record<string, Chunker> = {
  section,
  subsection,
  'subsection-context': subsectionContext,
  'fixed-256': fixed(256, 32),
  'fixed-512': fixed(512, 64),
  'section-split': sectionSplit,
};
