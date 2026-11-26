// The side view (walking, crouching, leaping): the long body and its four two-segment legs (used by ../pixel-cat.tsx).
import { motion } from "motion/react";
import type { Transition } from "motion/react";
import { GAITS, legKeyframes } from "@/lib/companion/gait";
import type { Gait } from "@/lib/companion/gait";
import { cn } from "@/lib/utils";
import { type SideMode, type Suit, SIDE_BODY_D, SIDE_TAIL_D, LEGS, thighD, foreD, shinD, SUIT_BODY, pivot, type EquippedAccessories } from "./art";

/* ------------------------------------------------------------------ side view (walking, crouching, leaping) */

export interface SideBodyProps {
  fur: string | undefined;
  flip: boolean;
  animated: boolean;
  wear: EquippedAccessories;
  suit: Suit | null;
  clipId: string;
  mode: SideMode;
  gait: Gait;
  rising: boolean;
}

export const SIDE_BODY_POSE: Record<SideMode, { y: number; scaleX: number; scaleY: number }> = {
  walk: { y: 0, scaleX: 1, scaleY: 1 },
  // Gathered low over folded legs before a jump (paws stay on the floor line).
  crouch: { y: 2.6, scaleX: 1.05, scaleY: 0.9 },
  // Stretched out in the air.
  leap: { y: -1, scaleX: 1.07, scaleY: 0.97 },
};

/**
 * The `initial` for a part of the side view: the first frame of its `animate` target. The side view mounts when a
 * walk (or crouch, or leap) begins, and `initial={false}` would jump straight to the target and never start a
 * looping keyframe animation (the stride, the tail, the cape, the crouch wiggle): in a production build the legs
 * froze in their first pose. (Development hid it: React's Strict Mode mounts twice, and the second mount started
 * the loop.) Starting from the first frame looks the same and starts the loop.
 */
export function startOf<T extends Record<string, number | number[]>>(target: T): { [K in keyof T]: number } {
  return Object.fromEntries(Object.entries(target).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as {
    [K in keyof T]: number;
  };
}

export function SideBody({ fur, flip, animated, wear, suit, clipId, mode, gait, rising }: SideBodyProps) {
  const spec = GAITS[gait];
  const bodyMotion = !animated
    ? { animate: { ...SIDE_BODY_POSE[mode], rotate: 0 }, transition: { duration: 0 } }
    : mode === "crouch"
      ? {
          // A little wiggle of the hips before the pounce.
          animate: { ...SIDE_BODY_POSE.crouch, rotate: [0, 1.8, -0.8, 1.8, 0] },
          transition: { rotate: { duration: 0.42, repeat: Infinity, ease: "easeInOut" as const }, default: { duration: 0.2 } },
        }
      : mode === "leap"
        ? { animate: { ...SIDE_BODY_POSE.leap, rotate: rising ? -11 : 9 }, transition: { duration: 0.22, ease: "easeOut" as const } }
        : { animate: { ...SIDE_BODY_POSE.walk, rotate: 0 }, transition: { duration: 0.2 } };

  const tailMotion = !animated
    ? { animate: { rotate: 0 }, transition: { duration: 0 } }
    : mode === "walk"
      ? { animate: { rotate: [-5, 6, -5] }, transition: { duration: spec.cycleS * 2, repeat: Infinity, ease: "easeInOut" as const } }
      : mode === "crouch"
        ? { animate: { rotate: [-34, -24, -34] }, transition: { duration: 0.3, repeat: Infinity, ease: "easeInOut" as const } }
        : { animate: { rotate: -46 }, transition: { duration: 0.2 } };

  const capeMotion = !animated
    ? { animate: { rotate: 0 }, transition: { duration: 0 } }
    : mode === "walk"
      ? { animate: { rotate: [0, -3, 0] }, transition: { duration: spec.cycleS, repeat: Infinity, ease: "easeInOut" as const } }
      : { animate: { rotate: mode === "leap" ? -9 : 2 }, transition: { duration: 0.2 } };

  const vars = suit ? SUIT_BODY[suit] : undefined;
  return (
    <g transform={flip ? "translate(120 0) scale(-1 1)" : undefined} style={vars}>
      <defs>
        <clipPath id={clipId}>
          <path d={SIDE_BODY_D} />
        </clipPath>
      </defs>
      <motion.g style={pivot(66, 106)} initial={startOf(bodyMotion.animate)} {...bodyMotion}>
        {/* Legs go through the same mosaic as the body, on the same grid (the filter sits on this unrotated group,
            so its blocks line up with the body's): they read as part of the same pixel cat, and a stride steps from
            block to block like pixel art. */}
        {/* far legs, behind the body */}
        <g filter={fur}>
          {LEGS.filter((l) => l.far).map((l) => (
            <SideLeg key={l.x} {...l} mode={mode} gait={gait} rising={rising} animated={animated} />
          ))}
        </g>
        <g filter={fur}>
          {/* tail, behind the body */}
          <motion.g style={pivot(32, 82)} initial={startOf(tailMotion.animate)} {...tailMotion}>
            <path d={SIDE_TAIL_D} className="fill-none stroke-(--cat-line)" strokeWidth={10.5} strokeLinecap="round" />
            <path d={SIDE_TAIL_D} className="fill-none stroke-(--cat-fur)" strokeWidth={7} strokeLinecap="round" />
          </motion.g>
          <path d={SIDE_BODY_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
          {wear.body === "striped-sweater" ? (
            <g clipPath={`url(#${clipId})`}>
              <rect x={28} y={68} width={66} height={32} className="fill-accent" />
              <rect x={28} y={78} width={66} height={3} className="fill-(--cat-cream)" />
              <rect x={28} y={87} width={66} height={3} className="fill-(--cat-cream)" />
            </g>
          ) : (
            <>
              <ellipse cx={62} cy={93} rx={19} ry={4.6} className="fill-(--cat-cream)" />
              <path d="M 50 72.5 Q 52 77 49 80 M 60 71.5 Q 62 76 59 79.5" className="fill-none stroke-(--cat-fur-dark)" strokeWidth={2.1} strokeLinecap="round" />
            </>
          )}
        </g>
        {/* costume details stay crisp */}
        {suit === "night-vigilante" ? (
          <g clipPath={`url(#${clipId})`}>
            <rect x={28} y={86} width={66} height={4} className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
            <rect x={70} y={85.2} width={5} height={5.6} rx={1} className="fill-(--cat-gold-lo) stroke-(--suit-slate-3)" strokeWidth={0.8} />
          </g>
        ) : suit === "web-hero" ? (
          <g clipPath={`url(#${clipId})`} className="fill-none stroke-(--suit-web)" strokeWidth={0.7} opacity={0.75}>
            <path d="M 44 89 Q 62 94 82 89 M 46 95 Q 62 99 80 95 M 54 88 L 52 98 M 66 88 L 66 98 M 77 88 L 79 97" />
          </g>
        ) : null}
        {/* cape over the back, fluttering with the stride */}
        {wear.body === "hero-cape" || suit === "night-vigilante" ? (
          <motion.path
            d={
              suit === "night-vigilante"
                ? "M 80 71 C 66 65.5 46 67 34 76 L 29 93 Q 33 90.5 36 93.5 Q 39.5 90 43 93 Q 47 89.5 51 91.5 C 56 89.5 61 87.5 64 85.5 Z"
                : "M 80 71 C 66 65.5 46 67 34 76 L 29 95 C 41 90.5 54 90 64 85.5 Z"
            }
            className={cn("stroke-(--cat-line)", suit === "night-vigilante" ? "fill-(--suit-slate-3)" : "fill-bad")}
            strokeWidth={1.4}
            strokeLinejoin="round"
            style={pivot(80, 71)}
            initial={startOf(capeMotion.animate)}
            {...capeMotion}
          />
        ) : null}
        {/* near legs, in front of the body */}
        <g filter={fur}>
          {LEGS.filter((l) => !l.far).map((l) => (
            <SideLeg key={l.x} {...l} mode={mode} gait={gait} rising={rising} animated={animated} />
          ))}
        </g>
      </motion.g>
    </g>
  );
}

export interface SideLegProps {
  x: number;
  far: boolean;
  front: boolean;
  phase: 0 | 1;
  mode: SideMode;
  gait: Gait;
  rising: boolean;
  animated: boolean;
}

/**
 * One leg: the thigh turns about the hip (y 89), the shin about the knee (y 98). Walk: gait keyframes (looping
 * only while this side view exists, i.e. while walking). Crouch: folded under, paws on the floor. Leap: front
 * legs reach ahead, hind legs push back, then swap emphasis for the landing.
 */
export function SideLeg({ x, far, front, phase, mode, gait, rising, animated }: SideLegProps) {
  let upper: number | number[] = 0;
  let knee: number | number[] = 0;
  let transition: Transition = { duration: 0 };
  if (animated) {
    if (mode === "walk") {
      const k = legKeyframes(gait, phase);
      upper = k.upper;
      knee = k.knee;
      transition = { duration: GAITS[gait].cycleS, times: k.times, ease: "linear", repeat: Infinity };
    } else if (mode === "crouch") {
      upper = front ? -8 : -28;
      knee = front ? 36 : 58;
      transition = { duration: 0.2, ease: "easeOut" };
    } else {
      upper = front ? (rising ? -58 : -30) : rising ? 50 : 24;
      knee = front ? (rising ? -6 : 12) : rising ? 16 : 30;
      transition = { duration: 0.18, ease: "easeOut" };
    }
  }
  const tone = far ? "fill-(--cat-fur-dark)" : "fill-(--cat-fur)";
  return (
    <motion.g
      data-leg={`${far ? "far" : "near"}-${front ? "front" : "hind"}`}
      style={pivot(x, 89)}
      initial={startOf({ rotate: upper })}
      animate={{ rotate: upper }}
      transition={transition}
    >
      <path d={front ? foreD(x) : thighD(x)} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1.8} strokeLinejoin="round" />
      <motion.g style={pivot(x, 98)} initial={startOf({ rotate: knee })} animate={{ rotate: knee }} transition={transition}>
        <path d={shinD(x)} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={x} cy={98.4} r={3.1} className={tone} />
        {far ? null : <ellipse cx={x} cy={106.4} rx={3.6} ry={1.8} className="fill-(--cat-cream)" />}
      </motion.g>
    </motion.g>
  );
}
