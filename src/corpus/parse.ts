import { DOMParser, type Element as XElement, type Node as XNode } from '@xmldom/xmldom';
import type { Corpus, Provision, Unit } from './types.js';

// Walks the legislation.gov.uk CLML document and emits one Provision per live
// body section and live schedule paragraph. The rules it follows are the ones
// forced by docs/corpus-report.md: drop Repeal content, unwrap Addition and
// Substitution, drop CommentaryRef, bracket Pnumbers, flatten tables, keep
// BlockAmendment text but never give it an id, detect repeal from content.

type El = XElement;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function local(e: XNode): string {
  return (e as El).localName ?? (e.nodeName.includes(':') ? e.nodeName.split(':')[1]! : e.nodeName);
}

function children(e: XNode): El[] {
  const out: El[] = [];
  for (let c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === ELEMENT_NODE) out.push(c as El);
  return out;
}

function childNamed(e: XNode, name: string): El | undefined {
  return children(e).find((c) => local(c) === name);
}

function ancestorNamed(e: XNode, name: string): El | undefined {
  for (let p = e.parentNode; p; p = p.parentNode) if (p.nodeType === ELEMENT_NODE && local(p) === name) return p as El;
  return undefined;
}

const LEVEL_LABEL: Record<string, (n: string) => string> = {
  P1: (n) => `${n}.`,
  P2: (n) => `(${n})`,
  P3: (n) => `(${n})`,
  P4: (n) => `(${n})`,
  P5: (n) => `(${n})`,
  P6: (n) => `(${n})`,
};

const BLOCK = new Set(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P', 'Para', 'ListItem', 'BlockText', 'BlockAmendment', 'Tabular', 'tr', 'UnorderedList', 'OrderedList', 'Title']);

/** Live text of an element: Repeal and CommentaryRef dropped, structure rendered as lines. */
export function render(e: XNode): string {
  const parts: string[] = [];
  walk(e, parts);
  return tidy(parts.join(''));
}

function walk(e: XNode, out: string[]): void {
  if (e.nodeType === TEXT_NODE) {
    out.push(e.nodeValue ?? '');
    return;
  }
  if (e.nodeType !== ELEMENT_NODE) return;
  const name = local(e);
  if (name === 'Repeal' || name === 'CommentaryRef') return;
  if (name === 'Pnumber') {
    const level = e.parentNode ? local(e.parentNode) : '';
    const n = inner(e).trim();
    if (!n) return; // number wholly repealed: emit nothing rather than "()"
    const fmt = LEVEL_LABEL[level];
    out.push('\n' + (fmt ? fmt(n) : n) + ' ');
    return;
  }
  if (name === 'td' || name === 'th') {
    out.push(' | ');
    for (const c of childNodes(e)) walk(c, out);
    return;
  }
  if (BLOCK.has(name)) out.push('\n');
  for (const c of childNodes(e)) walk(c, out);
  if (BLOCK.has(name)) out.push('\n');
}

function childNodes(e: XNode): XNode[] {
  const out: XNode[] = [];
  for (let c = e.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

/** Live text with no structure (for Pnumber, Title, Number). */
function inner(e: XNode): string {
  const out: string[] = [];
  (function w(n: XNode) {
    if (n.nodeType === TEXT_NODE) out.push(n.nodeValue ?? '');
    else if (n.nodeType === ELEMENT_NODE) {
      const nm = local(n);
      if (nm === 'Repeal' || nm === 'CommentaryRef') return;
      for (const c of childNodes(n)) w(c);
    }
  })(e);
  return out.join('').replace(/\s+/g, ' ').trim();
}

function tidy(s: string): string {
  return s
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n \| /g, '\n')
    .trim();
}

function isDead(text: string): boolean {
  // Repealed shells render as rows of dots, or as bare punctuation once the
  // Repeal content is dropped. Anything with a letter or digit is live.
  return !/[a-z0-9]/i.test(text);
}

function hasDescendant(e: XNode, name: string): boolean {
  for (const c of children(e)) if (local(c) === name || hasDescendant(c, name)) return true;
  return false;
}

const XREF = /\bsections?\s+(\d+[A-Z]*(?:\s*(?:to|and|,|or)\s*\d+[A-Z]*)*)/g;

export function extractXrefs(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(XREF)) {
    const list = m[1]!;
    const nums = list.match(/\d+[A-Z]*/g) ?? [];
    const ranges = list.match(/(\d+[A-Z]*)\s*to\s*(\d+[A-Z]*)/g) ?? [];
    for (const n of nums) out.add(n);
    for (const r of ranges) {
      const [, a, b] = r.match(/(\d+)[A-Z]*\s*to\s*(\d+)[A-Z]*/) ?? [];
      if (a && b) {
        const lo = Number(a), hi = Number(b);
        if (hi > lo && hi - lo <= 20) for (let i = lo; i <= hi; i++) out.add(String(i));
      }
    }
  }
  return [...out];
}

function paras(p1: El): El[] {
  // Ten sections carry two P1para children: the old text wholly repealed and
  // the substituted text live (section 444 is one). Use all of them.
  return children(p1).filter((c) => local(c) === 'P1para');
}

function units(p1: El, provisionId: string): Unit[] {
  const out: Unit[] = [];
  const lead: XNode[] = [];
  for (const c of paras(p1).flatMap((para) => childNodes(para))) {
    if (c.nodeType === ELEMENT_NODE && local(c) === 'P2') {
      flushLead();
      const text = render(c);
      const label = (text.match(/^\((\w+)\)/) ?? [])[0] ?? '';
      out.push({ id: (c as El).getAttribute('id') ?? `${provisionId}-${out.length}`, label, text });
    } else lead.push(c);
  }
  flushLead();
  return out.filter((u) => !isDead(u.text));

  function flushLead() {
    if (!lead.length) return;
    const parts: string[] = [];
    for (const n of lead) walk(n, parts);
    const text = tidy(parts.join(''));
    lead.length = 0;
    if (text && !isDead(text)) out.push({ id: `${provisionId}-lead`, label: '', text });
  }
}

function numberAndTitle(e: El): { number: string; title: string } {
  const num = childNamed(e, 'Number');
  const title = childNamed(e, 'Title') ?? childNamed(e, 'TitleBlock');
  return { number: num ? inner(num) : '', title: title ? inner(title) : '' };
}

export function parseCorpus(xml: string, source: string): Corpus {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement!;
  const primary = childNamed(root, 'Primary')!;
  const body = childNamed(primary, 'Body')!;
  const schedules = childNamed(primary, 'Schedules')!;
  const stats: Record<string, number> = {
    body_p1: 0, body_in_block_amendment: 0, body_repealed: 0, body_live: 0,
    schedule_p1: 0, schedule_repealed: 0, schedule_live: 0, amended: 0,
  };
  const provisions: Provision[] = [];

  const visit = (container: El, region: 'body' | 'schedule') => {
    const stack: El[] = [container];
    while (stack.length) {
      const e = stack.pop()!;
      for (const c of children(e).reverse()) stack.push(c);
      if (local(e) !== 'P1') continue;
      const prefix = region === 'body' ? 'body' : 'schedule';
      stats[`${prefix}_p1`]!++;
      if (ancestorNamed(e, 'BlockAmendment')) {
        if (region === 'body') stats.body_in_block_amendment!++;
        continue;
      }
      const id = e.getAttribute('id');
      if (!id) continue;
      const pn = childNamed(e, 'Pnumber');
      const number = (pn ? inner(pn) : '').replace(/\.$/, '');
      const ps = paras(e);
      const text = tidy(ps.map((para) => render(para)).join('\n'));
      if (!ps.length || isDead(text)) {
        stats[`${prefix}_repealed`]!++;
        continue;
      }
      stats[`${prefix}_live`]!++;
      const group = e.parentNode && local(e.parentNode) === 'P1group' ? (e.parentNode as El) : undefined;
      const headingEl = group ? childNamed(group, 'Title') : undefined;
      const heading = headingEl ? inner(headingEl) : '';
      const part = ancestorNamed(e, 'Part');
      const chapter = ancestorNamed(e, 'Chapter');
      const pblock = ancestorNamed(e, 'Pblock');
      const schedule = ancestorNamed(e, 'Schedule');
      const extentEl = [e, group, pblock, chapter, part, schedule].find((x) => x?.getAttribute('RestrictExtent'));
      const amended = hasDescendant(e, 'Addition') || hasDescendant(e, 'Substitution');
      if (amended) stats.amended!++;
      const prov: Provision = {
        id, region, number, heading, amended, text,
        units: units(e, id),
        xrefs: extractXrefs(text),
      };
      if (part) prov.part = numberAndTitle(part);
      if (chapter) prov.chapter = numberAndTitle(chapter);
      if (pblock) {
        const t = childNamed(pblock, 'Title');
        if (t) prov.crossHeading = inner(t);
      }
      if (schedule) prov.schedule = numberAndTitle(schedule);
      const ext = extentEl?.getAttribute('RestrictExtent');
      if (ext) prov.extent = ext;
      provisions.push(prov);
    }
  };
  visit(body, 'body');
  visit(schedules, 'schedule');

  const meta = childNamed(root, 'Metadata');
  const modified = meta ? inner(childNamed(meta, 'modified') ?? meta) : '';
  return {
    source,
    validFrom: root.getAttribute('RestrictStartDate') ?? '',
    modified,
    parsedAt: new Date().toISOString(),
    provisions,
    stats,
  };
}
