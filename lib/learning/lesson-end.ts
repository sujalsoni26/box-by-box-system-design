/*
 * End-of-lesson detection, as pure rules (no imports; unit tested). The companion asks "mark it as learned?"
 * only when all of these hold:
 * - the lesson is not learned yet and Cache has not asked about it before (never twice, never nagging);
 * - the end of the lesson (the "Mark as learned" row) has stayed in view for a short dwell;
 * - the learner has been on the lesson for a plausible reading time (a quarter of its minutes, within limits).
 * Nothing is ever marked without an explicit answer.
 */

export interface EndTiming {
  /** The end must stay in view this long, ms. */
  dwellMs: number;
  /** Minimum and maximum "plausible reading time", ms. */
  minReadMs: number;
  maxReadMs: number;
}

/** A quarter of the lesson's stated minutes, clamped to [minReadMs, maxReadMs]. */
export function minReadFor(minutes: number, t: EndTiming): number {
  const quarter = (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60_000 * 0.25;
  return Math.min(t.maxReadMs, Math.max(t.minReadMs, quarter));
}

export function promptEligible(state: { completed: boolean; asked: boolean; tipsOn: boolean }): boolean {
  return state.tipsOn && !state.completed && !state.asked;
}

/**
 * Is the end marker "in view"? Half of it on screen, or, for a marker taller than a short (landscape phone)
 * viewport, a visible slice covering at least 40% of the viewport.
 */
export function endInView(e: { isIntersecting: boolean; ratio: number; visibleHeight: number; targetHeight: number; viewportHeight: number }): boolean {
  if (!e.isIntersecting || e.visibleHeight <= 0) return false;
  if (e.ratio >= 0.5) return true;
  return e.targetHeight > e.viewportHeight * 0.8 && e.visibleHeight >= e.viewportHeight * 0.4;
}

/**
 * Milliseconds until the prompt may show; 0 means now. `visibleSince` is when the end came into view
 * (0 when it is not in view: never).
 */
export function msUntilPrompt(now: number, openedAt: number, visibleSince: number, minReadMs: number, dwellMs: number): number {
  if (!visibleSince) return Number.POSITIVE_INFINITY;
  return Math.max(0, visibleSince + dwellMs - now, openedAt + minReadMs - now);
}
