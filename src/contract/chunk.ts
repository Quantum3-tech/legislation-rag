// SEALED. See CLAUDE.md rule 3 and DESIGN.md section 14.
// The chunk schema every chunking strategy must emit.

export type Region = 'body' | 'schedule';

export interface ChunkMeta {
  /** Section number as printed, e.g. "172", "790ZG", or schedule paragraph number "2". */
  number: string;
  /** Section heading or schedule paragraph heading; may be empty for schedule paragraphs. */
  heading: string;
  part?: { number: string; title: string };
  chapter?: { number: string; title: string };
  crossHeading?: string;
  region: Region;
  schedule?: { number: string; title: string };
  /** Fixed-window chunkers only: every provision the window touches, in order. */
  spans?: string[];
}

export interface Chunk {
  /** "<chunker>:<provisionId>:<n>", unique within a chunker's output. */
  id: string;
  /** Chunker key, e.g. "section", "subsection", "subsection-context", "fixed-256", "section-split". */
  chunker: string;
  /** The provision this chunk is credited to: "section-172", "schedule-1A-paragraph-2". */
  provisionId: string;
  /** Exactly the string BM25 indexes and the embedder sees. */
  text: string;
  /** Token count of `text` under the embedding model's tokenizer, special tokens included. */
  tokens: number;
  meta: ChunkMeta;
}
