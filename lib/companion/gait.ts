/*
 * How Cache walks. One table drives both sides of a step: the leg keyframes in the sprite and the speed
 * the position hook moves the cat at. Diagonal pairs swing together (near hind with far front, then the
 * other pair), each pair is on the ground for half a cycle, and during that stance the foot sweeps back by
 * one step length, which is exactly how far the body moves. So the feet stay planted instead of sliding.
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
  /** Body lift at mid-stance, viewBox units (the cat is drawn 120 units wide). */
  bob: number;
}

/** Hip-to-foot length of a leg in viewBox units (pixel-cat draws legs from y 88 to y 108). */
export const LEG_UNITS = 20;
/** The sprite's viewBox width, units. */
const VIEW_UNITS = 120;

/**
 * Swing angles follow from the step: a stance sweeps the foot by one step, so
 * swing = asin(step / 2 / leg). Walk is exact; trot and run cap the swing (a little slip reads as speed).
 */
export const GAITS: Record<Gait, GaitSpec> = {
  walk: { cycleS: 0.52, stepFrac: 0.16, swingDeg: 28.5, bob: 1.2 },
  trot: { cycleS: 0.34, stepFrac: 0.21, swingDeg: 36, bob: 1.7 },
  run: { cycleS: 0.26, stepFrac: 0.3, swingDeg: 40, bob: 2.2 },
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

/** Ground speed that keeps the feet planted, px/s. */
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

export interface LegKeyframes {
  rotate: number[];
  scaleY: number[];
  times: number[];
  ease: Array<"linear" | "easeInOut">;
}

/**
 * One leg over one cycle, drawn facing right (positive rotation swings the foot backwards).
 * Phase 0: stance first (foot forward → back, linear so it matches the body's constant speed), then a
 * lifted swing forward. Phase 1 is the other diagonal pair: the same, half a cycle later.
 */
export function legKeyframes(gait: Gait, phase: 0 | 1): LegKeyframes {
  const a = GAITS[gait].swingDeg;
  const lift = 0.8;
  if (phase === 0) {
    return {
      rotate: [-a, a, 0, -a],
      scaleY: [1, 1, lift, 1],
      times: [0, 0.5, 0.75, 1],
      ease: ["linear", "easeInOut", "easeInOut"],
    };
  }
  return {
    rotate: [a, 0, -a, a],
    scaleY: [1, lift, 1, 1],
    times: [0, 0.25, 0.5, 1],
    ease: ["easeInOut", "easeInOut", "linear"],
  };
}

/** Body bob over one cycle: lowest as a pair touches down, highest at each mid-stance (two lifts per cycle). */
export function bobKeyframes(gait: Gait): { y: number[]; times: number[] } {
  const b = GAITS[gait].bob;
  return { y: [0, -b, 0, -b, 0], times: [0, 0.25, 0.5, 0.75, 1] };
}

/**
 * Easing for a walk of `duration` seconds: a gentle start over the first step, constant speed in the middle
 * (where the feet are planted), and a gentle stop over the last step. Continuous, monotonic, 0 → 1.
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
