/*
 * Inactivity, as one pure decision: given how long the learner has been inactive and what the companion is
 * doing, which idle level should Cache be at and when should the brain look again? The brain
 * (use-companion-brain) owns the timer and the listeners; this owns the rules, so they are unit tested.
 *
 *   awake ──settle──▶ sitting ──(sometimes, desktop) lamp──▶ … ──sleep──▶ yawn ▶ asleep
 *   any meaningful activity (key, pointer, touch, wheel, scroll, tab shown again) ▶ awake
 */

export type IdleLevel = 0 | 1 | 2;

export interface IdleTiming {
  settleMs: number;
  lampMs: number;
  sleepMs: number;
}

export interface IdleInput {
  /** Time since the last meaningful activity. */
  idleMs: number;
  idleLevel: IdleLevel;
  /** Asleep on request ("Nap"); only the menu, a tap or a pet wakes her. */
  napping: boolean;
  /** Keep her awake for now: the menu is open, a bubble waits for an answer, a focus block runs, a dialog is open, a quiz is in use. */
  hold: boolean;
  /** A routine owns the cat (lamp, play, break play): it decides her pose; the brain only wakes her on activity. */
  routine: boolean;
  /** The lamp already had its chance in this idle stretch. */
  lampTried: boolean;
}

export interface IdleDecision {
  /** New idle level, or null to leave it. */
  level: IdleLevel | null;
  /** Going from awake or sitting to asleep now: play the yawn first. */
  fallAsleep: boolean;
  /** The lamp may be offered now (the caller still checks the chance and whether it fits). */
  tryLamp: boolean;
  /** Look again after this many ms; null waits for activity. */
  nextMs: number | null;
}

export function idleStep(i: IdleInput, t: IdleTiming): IdleDecision {
  if (i.napping) return { level: null, fallAsleep: false, tryLamp: false, nextMs: null };
  if (i.routine) return { level: null, fallAsleep: false, tryLamp: false, nextMs: t.settleMs };
  if (i.hold) return { level: i.idleLevel === 0 ? null : 0, fallAsleep: false, tryLamp: false, nextMs: t.settleMs };
  if (i.idleMs >= t.sleepMs) {
    return { level: i.idleLevel === 2 ? null : 2, fallAsleep: i.idleLevel !== 2, tryLamp: false, nextMs: null };
  }
  if (i.idleMs >= t.settleMs) {
    const tryLamp = i.idleMs >= t.lampMs && !i.lampTried;
    const nextAt = i.idleMs >= t.lampMs ? t.sleepMs : t.lampMs;
    return { level: i.idleLevel === 1 ? null : 1, fallAsleep: false, tryLamp, nextMs: Math.max(250, nextAt - i.idleMs) };
  }
  return { level: null, fallAsleep: false, tryLamp: false, nextMs: Math.max(250, t.settleMs - i.idleMs) };
}
