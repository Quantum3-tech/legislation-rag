// SEALED. See CLAUDE.md rule 3 and DESIGN.md section 14.
// The shape of a question in eval/questions.json.

export type QueryType = 'single' | 'multi' | 'unanswerable';

export interface RelevanceLabel {
  /** Provision id: "section-172", "schedule-1A-paragraph-2". */
  id: string;
  /** 2: the provision states the answer. 1: needed for a complete and correct answer. */
  grade: 1 | 2;
}

export interface Query {
  id: string;
  type: QueryType;
  question: string;
  /** Empty for unanswerable questions. */
  relevant: RelevanceLabel[];
  notes?: string;
}

export interface QuestionSet {
  corpus: string;
  written: string;
  method: string;
  questions: Query[];
}
