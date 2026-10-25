// Porter stemmer (M. F. Porter, 1980), written out in full so the tokeniser
// used by BM25 has no dependency and its behaviour is readable here.

const isCons = (w: string, i: number): boolean => {
  const c = w[i]!;
  if ('aeiou'.includes(c)) return false;
  if (c === 'y') return i === 0 ? true : !isCons(w, i - 1);
  return true;
};

/** Measure m of the stem: number of VC sequences. */
function measure(w: string): number {
  let m = 0;
  let i = 0;
  const n = w.length;
  while (i < n && isCons(w, i)) i++;
  while (i < n) {
    while (i < n && !isCons(w, i)) i++;
    if (i >= n) break;
    m++;
    while (i < n && isCons(w, i)) i++;
  }
  return m;
}

const hasVowel = (w: string): boolean => [...w].some((_, i) => !isCons(w, i));
const doubleCons = (w: string): boolean => w.length >= 2 && w[w.length - 1] === w[w.length - 2] && isCons(w, w.length - 1);
const cvc = (w: string): boolean => {
  const n = w.length;
  if (n < 3) return false;
  if (!isCons(w, n - 1) || isCons(w, n - 2) || !isCons(w, n - 3)) return false;
  return !'wxy'.includes(w[n - 1]!);
};

function replaceSuffix(w: string, suffix: string, repl: string, cond: (stem: string) => boolean): string | null {
  if (!w.endsWith(suffix)) return null;
  const stem = w.slice(0, w.length - suffix.length);
  return cond(stem) ? stem + repl : w;
}

export function porterStem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 2) return w;

  // Step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b
  let step1bExtra = false;
  if (w.endsWith('eed')) {
    const stem = w.slice(0, -3);
    if (measure(stem) > 0) w = w.slice(0, -1);
  } else if (w.endsWith('ed') && hasVowel(w.slice(0, -2))) { w = w.slice(0, -2); step1bExtra = true; }
  else if (w.endsWith('ing') && hasVowel(w.slice(0, -3))) { w = w.slice(0, -3); step1bExtra = true; }
  if (step1bExtra) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e';
    else if (doubleCons(w) && !'lsz'.includes(w[w.length - 1]!)) w = w.slice(0, -1);
    else if (measure(w) === 1 && cvc(w)) w += 'e';
  }

  // Step 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

  // Step 2
  const step2: [string, string][] = [
    ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'], ['izer', 'ize'], ['abli', 'able'],
    ['alli', 'al'], ['entli', 'ent'], ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
    ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['aliti', 'al'],
    ['iviti', 'ive'], ['biliti', 'ble'],
  ];
  for (const [s, r] of step2) {
    const out = replaceSuffix(w, s, r, (stem) => measure(stem) > 0);
    if (out !== null) { w = out; break; }
  }

  // Step 3
  const step3: [string, string][] = [
    ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'], ['ical', 'ic'], ['ful', ''], ['ness', ''],
  ];
  for (const [s, r] of step3) {
    const out = replaceSuffix(w, s, r, (stem) => measure(stem) > 0);
    if (out !== null) { w = out; break; }
  }

  // Step 4
  const step4 = ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'];
  for (const s of step4) {
    if (!w.endsWith(s)) continue;
    const stem = w.slice(0, w.length - s.length);
    if (measure(stem) > 1 && (s !== 'ion' || stem.endsWith('s') || stem.endsWith('t'))) w = stem;
    break;
  }

  // Step 5a
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1);
    const m = measure(stem);
    if (m > 1 || (m === 1 && !cvc(stem))) w = stem;
  }
  // Step 5b
  if (measure(w) > 1 && doubleCons(w) && w.endsWith('l')) w = w.slice(0, -1);

  return w;
}
