import type { Region } from '../contract/index.js';

/** One subsection-level unit of a provision, as rendered text. */
export interface Unit {
  /** legislation.gov.uk id of the P2, or "<provisionId>-lead" for text before the first subsection. */
  id: string;
  /** "(1)", "(2A)", or "" for a lead unit. */
  label: string;
  text: string;
}

export interface Provision {
  id: string;
  region: Region;
  number: string;
  heading: string;
  part?: { number: string; title: string };
  chapter?: { number: string; title: string };
  crossHeading?: string;
  schedule?: { number: string; title: string };
  extent?: string;
  /** Contains at least one inline Addition or Substitution. */
  amended: boolean;
  /** Full rendered live text, heading excluded. */
  text: string;
  units: Unit[];
  /** Section numbers mentioned as "section N" / "sections N to M" in the text. */
  xrefs: string[];
}

export interface Corpus {
  source: string;
  validFrom: string;
  modified: string;
  parsedAt: string;
  provisions: Provision[];
  /** Counts printed by the parser, kept so the README can cite them. */
  stats: Record<string, number>;
}
