/** Behaviour timings. Reactions are meant to stay subtle and infrequent. */
export const TIMING = {
  /** No input for this long: the cat settles into a quiet sit. */
  settleMs: 45_000,
  /** No input for this long: the cat curls up and sleeps. */
  sleepMs: 120_000,
  /** A nap at least this long earns a "welcome back" tip on wake-up (when tips are on). */
  longNapMs: 5 * 60_000,
  /** Minimum gap between unsolicited bubbles (tips, nudges, diagram comments). */
  nudgeGapMs: 90_000,
  /** Minimum gap between quiz-answer bubbles (the pose still reacts every time). */
  quizBubbleGapMs: 20_000,
  /** Minimum gap between bubbles about marking topics for review (the pose still reacts). */
  reviewBubbleGapMs: 60_000,
  /** No input for this long: the cat may (sometimes) go and nap on a lamp (desktop only). */
  lampMs: 70_000,
  /** Chance the lamp routine runs in a given idle stretch ("occasionally"). */
  lampChance: 0.6,
  /** Topic meows: first one after this long on a lesson, then every interval (+ jitter), at most `max` per visit. */
  topicFirstMs: 80_000,
  topicIntervalMs: 180_000,
  topicJitterMs: 60_000,
  topicMax: 3,
  /** Completion prompt: the end of the lesson must stay in view this long... */
  completionDwellMs: 2_200,
  /** ...and the learner must have been on the page at least this long (a quarter of the lesson, within limits). */
  completionMinReadMs: 45_000,
  completionMaxReadMs: 240_000,
  /** Minimum gap between reactions to diagram events. */
  diagramGapMs: 45_000,
  /** Delay before a lesson tip, so it does not compete with the page loading in. */
  tipDelayMs: 2_500,
  /** Delay before the once-per-session greeting. */
  greetingDelayMs: 1_600,
  /** Focus-timer notifications older than this (after a long absence) are skipped. */
  focusEventFreshMs: 10 * 60_000,
} as const;
