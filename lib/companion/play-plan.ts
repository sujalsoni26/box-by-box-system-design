/*
 * Break-time play, as pure planning (no imports, unit tested): which game comes next and where it goes.
 * The companion component plays each one out with the cat's real position.
 */

export type BreakGame = "yarn" | "pounce" | "zoomies";

/** Games in turn, so consecutive ones always differ (and yarn comes round every third game). */
export const BREAK_GAMES: readonly BreakGame[] = ["yarn", "pounce", "zoomies"];

export function breakGame(index: number): BreakGame {
  const n = BREAK_GAMES.length;
  return BREAK_GAMES[((index % n) + n) % n];
}

/** A rest between games, ms: long enough to read as a breather, short enough to feel continuous. */
export function restMs(index: number): number {
  return 1300 + ((index * 577) % 900);
}

/** Head towards the side with more room; `reach` is how far the game wants to go, px. */
export function playDirection(centre: number, viewW: number, reach: number): 1 | -1 {
  const right = viewW - centre;
  const left = centre;
  if (right >= reach && left >= reach) return centre < viewW / 2 ? 1 : -1;
  return right >= left ? 1 : -1;
}

/** Clamp a target x (left edge of the cat) inside the floor's range. */
export function clampX(x: number, minX: number, maxX: number): number {
  return Math.min(maxX, Math.max(minX, x));
}
