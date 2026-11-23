import type { Point } from "./resting";

/*
 * Hand-rolled gravity for the companion. No engine: one integration step per frame, and only while
 * the cat is in the air or sliding. Units are px and seconds; y grows downward.
 *
 * - Constant gravity: on release she always falls to the floor, even with no throw.
 * - Side walls bounce fast throws (restitution). The top is a ceiling only at the top of the page
 *   (scrollY <= 0); otherwise she may fly up to `capY` above the viewport and fall back.
 * - Floor: one or two small bounces (bounces slower than `minBounce` stop), then floor friction.
 * - Wherever she stops is where she stays (the caller never moves her back to a preset spot).
 */

export interface GravityProfile {
  /** Release speed cap, px/s. */
  maxThrow: number;
  /** px/s². */
  gravity: number;
  /** Exponential air drag on horizontal speed, 1/s. */
  airDrag: number;
  wallRestitution: number;
  ceilingRestitution: number;
  floorRestitution: number;
  /** Bounces slower than this (px/s) end on the floor. */
  minBounce: number;
  /** Constant deceleration while sliding on the floor, px/s². */
  floorFriction: number;
  /** Horizontal speed (px/s) below which a landed cat stops. */
  stopSpeed: number;
  /** Safety cap on one flight, ms. */
  maxFlightMs: number;
}

/*
 * Tuned to feel a little floatier than a real throw: lower release cap and gravity, more air drag, so
 * a flick reads as a lob and the fall is easy to follow (about 20-25% slower than before).
 */
export const GRAVITY: Record<"desktop" | "compact", GravityProfile> = {
  desktop: {
    maxThrow: 1700,
    gravity: 1850,
    airDrag: 0.55,
    wallRestitution: 0.4,
    ceilingRestitution: 0.35,
    floorRestitution: 0.28,
    minBounce: 150,
    floorFriction: 1400,
    stopSpeed: 10,
    maxFlightMs: 6000,
  },
  /** Phones: softer bounces, more friction. */
  compact: {
    maxThrow: 1050,
    gravity: 1700,
    airDrag: 0.8,
    wallRestitution: 0.22,
    ceilingRestitution: 0.22,
    floorRestitution: 0.2,
    minBounce: 160,
    floorFriction: 2000,
    stopSpeed: 12,
    maxFlightMs: 5000,
  },
};

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** On the floor with no vertical speed. */
  grounded: boolean;
}

export interface Arena {
  minX: number;
  maxX: number;
  floorY: number;
  /** Ceiling y when the page is scrolled to the top; null means open sky up to `capY`. */
  ceilingY: number | null;
  capY: number;
}

export function clampVelocity(v: Point, max: number): Point {
  const speed = Math.hypot(v.x, v.y);
  if (!Number.isFinite(speed) || speed === 0) return { x: 0, y: 0 };
  if (speed <= max) return v;
  const k = max / speed;
  return { x: v.x * k, y: v.y * k };
}

/** Advance one frame (`dt` in seconds; callers cap it). */
export function stepFall(body: Body, dt: number, a: Arena, p: GravityProfile): Body {
  let { x, y, vx, vy, grounded } = body;

  if (grounded) {
    const s = Math.max(0, Math.abs(vx) - p.floorFriction * dt);
    vx = Math.sign(vx) * s;
    vy = 0;
  } else {
    vy += p.gravity * dt;
    vx *= Math.exp(-p.airDrag * dt);
  }

  x += vx * dt;
  y += vy * dt;

  if (x < a.minX) {
    x = a.minX;
    vx = Math.abs(vx) * p.wallRestitution;
  } else if (x > a.maxX) {
    x = a.maxX;
    vx = -Math.abs(vx) * p.wallRestitution;
  }

  if (a.ceilingY !== null && y < a.ceilingY) {
    y = a.ceilingY;
    vy = Math.abs(vy) * p.ceilingRestitution;
  } else if (y < a.capY) {
    y = a.capY;
    vy = Math.max(0, vy);
  }

  if (y >= a.floorY) {
    y = a.floorY;
    if (!grounded) {
      const bounce = vy * p.floorRestitution;
      if (bounce >= p.minBounce) {
        vy = -bounce;
      } else {
        vy = 0;
        grounded = true;
      }
    }
  }

  return { x, y, vx, vy, grounded };
}

export function isSettled(body: Body, p: GravityProfile): boolean {
  return body.grounded && Math.abs(body.vx) < p.stopSpeed;
}
