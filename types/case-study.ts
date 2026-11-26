import type { Level } from "./curriculum";

export type CaseStudyTrack = "hld" | "lld";

/** One reasoning step: the learner answers `prompt` first, can ask for `hint`, then reveals `insight`. */
export interface CaseStudyStep {
  prompt: string;
  hint: string;
  insight: string;
}

/**
 * A guided interview exercise built on a case-study lesson (data/case-studies/<slug>.ts).
 * `slug` is the lesson slug of the full walkthrough, so progress and "marked for review"
 * are shared between the exercise and its lesson.
 */
export interface CaseStudy {
  slug: string;
  title: string;
  track: CaseStudyTrack;
  level: Level;
  /** Realistic time to attempt the exercise before reading the walkthrough. */
  minutes: number;
  /** How an interviewer would pose the problem. */
  scenario: string;
  /** HLD: the number or constraint that drives the design. LLD: the core modelling challenge. */
  focus: string;
  /** Earlier lessons the exercise draws on (lesson slugs). */
  concepts: string[];
  steps: CaseStudyStep[];
  tradeoffs: string[];
  followUps: string[];
}
