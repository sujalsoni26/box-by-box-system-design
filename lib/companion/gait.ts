/*
 * How Cache walks. One table drives both sides of a step: the leg keyframes in the sprite and the speed
 * the position hook moves the cat at.
 *
 * - Diagonal pairs swing together (near hind with far front, then the other pair); each pair is on the
 *   ground for half a cycle.
 * - Legs have two segments (thigh and shin). During stance the leg is straight and sweeps back by exactly one
 *   step, which is how far the body moves, so the paw stays planted. During swing the knee bends (the paw folds
 *   back and lifts), then straightens to reach forward for the next contact.
 * - The body rides on the stance leg like an inverted pendulum: highest at mid-stance, lowest as a pair
 *   touches down, by exactly the amount that keeps the planted paw on the ground (leg × (1 − cos angle)).
 *   The head counters part of that bob, so it stays steadier than the body, as a cat's does.
 *
 * Pure (no imports), so it is unit tested.
 */

export type Gait = "walk" | "trot" | "run";

export interface GaitSpec {
  /** One full cycle (both diagonal pairs step once), seconds. */
  cycleS: number;
  /** Step length as a fraction of the cat's drawn size (one pair's stance). */
  stepFrac: number;
  /** Leg swing either side of vertical, degrees. */
  swingDeg: number;
  /** Knee bend at mid-swing, degrees (the paw folds back and lifts). */
  kneeDeg: number;
}

/** Hip-to-paw length of a straight leg in viewBox units (pixel-cat draws legs from y 88 to y 108). */
export const LEG_UNITS = 20;
/** Hip to knee, viewBox units. */
export const THIGH_UNITS = 10;
/** The sprite's viewBox width, units. */
const VIEW_UNITS = 120;
/** How much of the body's bob the head cancels (0 = none, 1 = perfectly level). */
export const HEAD_STEADY = 0.6;

/**
 * Swing angles follow from the step: a stance sweeps the paw by one step, so
 * swing = asin(step / 2 / leg). Walk is exact; trot and run cap the swing (a little slip reads as speed).
 */
export const GAITS: Record<Gait, GaitSpec> = {
  walk: { cycleS: 0.54, stepFrac: 0.16, swingDeg: 28.5, kneeDeg: 46 },
  trot: { cycleS: 0.38, stepFrac: 0.2, swingDeg: 34, kneeDeg: 56 },
  run: { cycleS: 0.28, stepFrac: 0.25, swingDeg: 38, kneeDeg: 64 },
};

/** The swing a stance of exactly one step needs (degrees), before any cap. */
export function idealSwingDeg(gait: Gait): number {
  const half = (GAITS[gait].stepFrac * VIEW_UNITS) / 2;
  return (Math.asin(Math.min(1, half / LEG_UNITS)) * 180) / Math.PI;
}

/** One step (half a cycle), px, for a cat drawn `size` px wide. */
export function stepLength(size: number, gait: Gait): number {
  return GAITS[gait].stepFrac * size;
}

/** Ground speed that keeps the paws planted, px/s. */
export function gaitSpeed(size: number, gait: Gait): number {
  return stepLength(size, gait) / (GAITS[gait].cycleS / 2);
}

/** Short hops walk, a few body lengths trot, long crossings run. */
export function chooseGait(distance: number, size: number): Gait {
  if (distance <= stepLength(size, "walk") * 8) return "walk";
  if (distance <= size * 6) return "trot";
  return "run";
}

export interface WalkPlan {
  gait: Gait;
  /** Whole steps, so the walk always ends with both pairs planted. */
  steps: number;
  /** Seconds. */
  duration: number;
}

/** How to cover `distance` px: a whole number of steps at the gait's cadence. */
export function walkPlan(distance: number, size: number, gait: Gait = chooseGait(distance, size)): WalkPlan {
  const step = stepLength(size, gait);
  const steps = Math.max(1, Math.round(Math.abs(distance) / step));
  return { gait, steps, duration: steps * (GAITS[gait].cycleS / 2) };
}

/** Sample times for the leg and bob keyframes: 8 equal slices of a cycle (linear between them). */
export const LEG_TIMES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

export interface LegKeyframes {
  /** Thigh rotation about the hip, degrees (drawn facing right: positive swings the paw backwards). */
  upper: number[];
  /** Knee bend, degrees (positive folds the paw back). */
  knee: number[];
  times: number[];
}

/**
 * One leg over one cycle. Phase 0: stance first (straight leg, linear from forward to back, matching the body's
 * constant speed), then the swing: knee bends, thigh swings forward (ease in-out), knee straightens before the
 * paw touches down. Phase 1 is the other diagonal pair: the same, half a cycle later.
 */
export function legKeyframes(gait: Gait, phase: 0 | 1): LegKeyframes {
  const a = GAITS[gait].swingDeg;
  const k = GAITS[gait].kneeDeg;
  // Swing: thigh follows smoothstep from back (+a) to forward (−a); the knee peaks mid-swing.
  const s = (t: number) => t * t * (3 - 2 * t);
  const upper = [-a, -a / 2, 0, a / 2, a, a - 2 * a * s(0.25), a - 2 * a * s(0.5), a - 2 * a * s(0.75), -a];
  const knee = [0, 0, 0, 0, 0, 0.75 * k, k, 0.5 * k, 0];
  if (phase === 0) return { upper, knee, times: LEG_TIMES };
  // Half a cycle later: the second half of the cycle first.
  const shift = <T,>(arr: T[]) => [...arr.slice(4, 8), ...arr.slice(0, 5)];
  return { upper: shift(upper), knee: shift(knee), times: LEG_TIMES };
}

/** Bob samples per cycle (two arcs, one per stance). */
const BOB_SAMPLES = 16;

/**
 * Body bob over one cycle, viewBox units (positive is down): the inverted-pendulum arc that keeps a straight
 * stance leg's paw on the ground, leg × (1 − cos θ), with θ the stance angle. Lowest when a pair touches down,
 * highest at each mid-stance.
 */
export function bobKeyframes(gait: Gait): { y: number[]; times: number[] } {
  const a = (GAITS[gait].swingDeg * Math.PI) / 180;
  const y: number[] = [];
  const times: number[] = [];
  for (let i = 0; i <= BOB_SAMPLES; i += 1) {
    const t = i / BOB_SAMPLES;
    // Where the current stance pair is in its stance (0 at touch-down, 1 at lift-off); both pairs swap at 0.5.
    const frac = (t % 0.5) / 0.5;
    const theta = -a + 2 * a * frac;
    y.push(+(LEG_UNITS * (1 - Math.cos(theta))).toFixed(3));
    times.push(+t.toFixed(4));
  }
  return { y, times };
}

/**
 * Easing for a walk of `duration` seconds: a gentle start over the first step, constant speed in the middle
 * (where the paws are planted), and a gentle stop over the last step. Continuous, monotonic, 0 → 1.
 */
export function rampEase(duration: number, gait: Gait): (t: number) => number {
  const r = Math.min(0.3, GAITS[gait].cycleS / 2 / Math.max(duration, 0.001));
  // Velocity: ramps 0 → v over r, holds v, ramps v → 0 over the last r. Area = v (1 - r) = 1.
  const v = 1 / (1 - r);
  return (t: number) => {
    const x = Math.min(1, Math.max(0, t));
    if (r <= 0) return x;
    if (x < r) return (v * x * x) / (2 * r);
    if (x > 1 - r) {
      const u = 1 - x;
      return 1 - (v * u * u) / (2 * r);
    }
    return v * (x - r / 2);
  };
}
