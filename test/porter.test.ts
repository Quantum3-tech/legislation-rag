import { describe, expect, it } from 'vitest';
import { porterStem } from '../src/retrieval/porter.js';

describe('porter stemmer', () => {
  it('matches reference outputs from the published algorithm', () => {
    const cases: [string, string][] = [
      ['caresses', 'caress'], ['ponies', 'poni'], ['cats', 'cat'], ['feed', 'feed'], ['agreed', 'agre'],
      ['plastered', 'plaster'], ['motoring', 'motor'], ['sing', 'sing'], ['conflated', 'conflat'],
      ['troubled', 'troubl'], ['sized', 'size'], ['hopping', 'hop'], ['tanned', 'tan'], ['falling', 'fall'],
      ['hissing', 'hiss'], ['fizzed', 'fizz'], ['failing', 'fail'], ['filing', 'file'], ['happy', 'happi'],
      ['relational', 'relat'], ['conditional', 'condit'], ['rational', 'ration'], ['valenci', 'valenc'],
      ['digitizer', 'digit'], ['operator', 'oper'], ['feudalism', 'feudal'], ['hopefulness', 'hope'],
      ['callousness', 'callous'], ['formaliti', 'formal'], ['sensitiviti', 'sensit'], ['sensibiliti', 'sensibl'],
      ['triplicate', 'triplic'], ['formative', 'form'], ['formalize', 'formal'], ['electriciti', 'electr'],
      ['electrical', 'electr'], ['hopeful', 'hope'], ['goodness', 'good'], ['revival', 'reviv'],
      ['allowance', 'allow'], ['inference', 'infer'], ['airliner', 'airlin'], ['gyroscopic', 'gyroscop'],
      ['adjustable', 'adjust'], ['defensible', 'defens'], ['irritant', 'irrit'], ['replacement', 'replac'],
      ['adjustment', 'adjust'], ['dependent', 'depend'], ['adoption', 'adopt'], ['homologou', 'homolog'],
      ['communism', 'commun'], ['activate', 'activ'], ['angulariti', 'angular'], ['homologous', 'homolog'],
      ['effective', 'effect'], ['bowdlerize', 'bowdler'], ['probate', 'probat'], ['rate', 'rate'],
      ['cease', 'ceas'], ['controll', 'control'], ['roll', 'roll'],
    ];
    for (const [w, s] of cases) expect(porterStem(w), w).toBe(s);
  });

  it('maps the inflections that matter for this corpus to one stem', () => {
    expect(new Set(['allot', 'allotted', 'allotment', 'allotting'].map(porterStem)).size).toBe(1);
    expect(new Set(['director', 'directors'].map(porterStem)).size).toBe(1);
    expect(new Set(['resolution', 'resolutions'].map(porterStem)).size).toBe(1);
  });
});
