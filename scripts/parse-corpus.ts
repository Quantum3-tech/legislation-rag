import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseCorpus } from '../src/corpus/parse.js';

const src = 'data/raw/ukpga-2006-46.xml';
const t0 = performance.now();
const xml = readFileSync(src, 'utf8');
const corpus = parseCorpus(xml, src);
mkdirSync('data', { recursive: true });
writeFileSync('data/corpus.json', JSON.stringify(corpus));
const ms = Math.round(performance.now() - t0);

const body = corpus.provisions.filter((p) => p.region === 'body');
const sched = corpus.provisions.filter((p) => p.region === 'schedule');
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const sorted = body.map((p) => words(p.text)).sort((a, b) => a - b);
const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

console.log(`parsed ${src} in ${ms} ms; text valid from ${corpus.validFrom}, modified ${corpus.modified}`);
console.log('stats', corpus.stats);
console.log(`live body sections ${body.length}, live schedule paragraphs ${sched.length}, total ${corpus.provisions.length}`);
console.log(`body words: median ${pct(0.5)} p90 ${pct(0.9)} max ${sorted.at(-1)}`);
console.log(`units: ${corpus.provisions.reduce((a, p) => a + p.units.length, 0)}; provisions with xrefs ${corpus.provisions.filter((p) => p.xrefs.length).length}`);
for (const id of ['section-7', 'section-444', 'section-382', 'schedule-1A-paragraph-2']) {
  const p = corpus.provisions.find((x) => x.id === id);
  if (!p) { console.log(`MISSING ${id}`); continue; }
  console.log(`\n== ${p.id} | ${p.heading} | ${p.part?.number} ${p.part?.title} > ${p.chapter?.number ?? ''} ${p.chapter?.title ?? ''} > ${p.crossHeading ?? ''} | units ${p.units.length} | xrefs ${p.xrefs.join(',')}`);
  console.log(p.text.slice(0, 600));
}
