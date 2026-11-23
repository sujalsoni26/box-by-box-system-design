"use client";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BodyPhase, RoutineStep } from "@/lib/companion/behaviour";
import { stepLength, type Gait } from "@/lib/companion/gait";
import { hopDownX, LAMP, perchPoint, planLamp } from "@/lib/companion/lamp-geometry";
import { line } from "@/lib/companion/lines";
import { canNudge } from "@/lib/companion/reactions";
import type { Point } from "@/lib/companion/resting";
import { companionBlip } from "@/lib/companion/sound";
import { useCompanionStore } from "@/stores/companion-store";

export { lampFits } from "@/lib/companion/lamp-geometry";

/*
 * The lamp nap. Started by a long quiet spell on desktop (sometimes), or on purpose from the menu
 * ("Lamp nap"). A little lamp pops up a few steps away; Cache looks at it, walks 3–5 natural steps, crouches
 * with a wiggle, leaps along an arc, lands with a squash (the lamp wobbles and lights up), settles, yawns and
 * falls asleep in the warm light.
 *
 * Waking: an idle nap wakes on any activity; a menu nap sleeps until woken on purpose (a tap, "Wake up", a pet).
 * Either way she stretches, hops down beside the lamp, the lamp fades, and she stays where she landed.
 * A drag, resize, press or another activity ends the routine cleanly at any step; every timer and
 * subscription is cleaned up.
 */

export interface LampState {
  /** Centre x of the lamp, viewport px. */
  cx: number;
  lit: boolean;
  /** Bumped when she lands on it: the lamp wobbles. */
  bump: number;
}

interface RoutineDeps {
  size: number;
  /** Viewport y of the line the cat stands on. */
  groundY: number;
  viewW: number;
  animated: boolean;
  catX: () => number;
  walkTo: (x: number, gait?: Gait) => Promise<boolean>;
  jumpTo: (p: Point) => Promise<boolean>;
  settle: () => void;
  faceTo: (dx: number) => void;
  getPhase: () => BodyPhase;
}

/** Step timings, ms (reduced motion skips the in-between beats). */
const BEAT = { notice: 520, crouch: 560, land: 320, settle: 950, yawn: 1150, stretch: 720, hopCrouch: 260 } as const;

/**
 * Runs the lamp routine while the companion store's activity is "lamp". Returns what to draw (the lamp)
 * and the current step (for the cat's pose).
 */
export function useLampRoutine(deps: RoutineDeps): { lamp: LampState | null; step: RoutineStep } {
  const activity = useCompanionStore((s) => s.activity);
  const lampId = activity?.kind === "lamp" ? activity.id : 0;
  const [lamp, setLamp] = useState<LampState | null>(null);
  const [step, setStep] = useState<RoutineStep>(null);
  const { size, groundY, viewW, animated, catX, walkTo, jumpTo, settle, faceTo, getPhase } = deps;

  useEffect(() => {
    if (!lampId) return;
    const store = useCompanionStore.getState;
    const trigger = store().activity?.trigger ?? "idle";
    let cancelled = false;
    let woke = false;
    let napSet = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, animated ? ms : Math.min(ms, 200))));
    const end = () => store().endActivity(lampId);

    // Wake signals: an explicit wakeLamp() (a tap, "Wake up"), the viewport changing under her, and
    // - idle nap: the idle level dropping to awake (any activity);
    // - menu nap: `napping` being cleared (a pet); opening the menu alone does not wake her, as with "Nap".
    let wakeResolve: (() => void) | null = null;
    const woken = new Promise<void>((resolve) => (wakeResolve = resolve));
    const wake = () => {
      if (woke) return;
      woke = true;
      wakeResolve?.();
    };
    const off = useCompanionStore.subscribe((s, prev) => {
      if (s.lampWake !== prev.lampWake) return wake();
      if (napSet) {
        if (prev.napping && !s.napping) wake();
        return;
      }
      if (s.idleLevel === 0 && prev.idleLevel !== 0) wake();
    });
    const onResize = () => wake();
    window.addEventListener("resize", onResize);

    const run = async () => {
      const plan = planLamp(catX(), size, viewW, stepLength(size, "walk"));
      if (!plan) {
        if (trigger === "menu") store().say({ text: line("lampNoRoom"), mood: "thinking", ms: 3600, solicited: true });
        return end();
      }
      const { cx, dir } = plan;

      // The lamp pops up; she turns to look at it.
      setLamp({ cx, lit: false, bump: 0 });
      faceTo(dir);
      await wait(BEAT.notice);
      if (cancelled) return;
      if (woke) return finishAwake();

      // A few natural steps over, at a walk.
      setStep("lamp-approach");
      const walked = await walkTo(plan.standX, "walk");
      if (cancelled) return;
      if (!walked || woke) return finishAwake();

      // Gather: low crouch, a wiggle of the hips.
      faceTo(dir);
      setStep("lamp-crouch");
      await wait(BEAT.crouch);
      if (cancelled) return;
      if (woke) return finishAwake();

      // Leap along an arc onto the shade.
      setStep(null);
      const perched = await jumpTo(perchPoint(cx, size, groundY));
      if (cancelled) return;
      if (!perched || getPhase() !== "perched") return finishAwake();

      // Land: a squash, the lamp wobbles and lights up.
      setStep("lamp-land");
      setLamp({ cx, lit: true, bump: 1 });
      companionBlip("soft");
      await wait(BEAT.land);
      if (cancelled) return;
      if (getPhase() !== "perched") return finishAwake();

      // Settle into the warmth, yawn, sleep.
      setStep("lamp-settle");
      await wait(BEAT.settle);
      if (cancelled) return;
      if (getPhase() !== "perched") return finishAwake();
      if (!woke) {
        setStep("lamp-yawn");
        await wait(BEAT.yawn);
        if (cancelled) return;
        if (getPhase() !== "perched") return finishAwake();
      }
      if (!woke) {
        setStep("lamp-nap");
        // A menu nap is a nap on request (ordinary activity does not wake her); an idle nap is ordinary sleep.
        if (trigger === "menu") {
          napSet = true;
          store().setNapping(true);
        } else {
          store().setIdleLevel(2);
        }
      }

      await woken;
      if (cancelled) return;
      napSet = false;
      if (getPhase() !== "perched") return finishAwake();

      // Wake: stretch, lamp off, a little crouch, hop down on the side towards the middle, and stay there.
      setStep("lamp-stretch");
      setLamp({ cx, lit: false, bump: 1 });
      await wait(BEAT.stretch);
      if (cancelled) return;
      // Picked up during the stretch: the drag owns the cat now.
      if (getPhase() !== "perched") return finishAwake();
      faceTo(cx > viewW / 2 ? -1 : 1);
      setStep("lamp-crouch");
      await wait(BEAT.hopCrouch);
      if (cancelled) return;
      if (getPhase() !== "perched") return finishAwake();
      setStep(null);
      const landed = await jumpTo({ x: hopDownX(cx, size, viewW), y: Number.POSITIVE_INFINITY });
      if (cancelled) return;
      if (landed && (trigger === "menu" || canNudge(Date.now()))) {
        store().say({ text: line("lampWake"), mood: "happy", ms: 3000, solicited: trigger === "menu" });
      }
      setLamp(null);
      end();
    };

    /** Interrupted (or displaced): fade the lamp, come down if needed, end quietly. */
    const finishAwake = () => {
      setStep(null);
      setLamp(null);
      if (getPhase() === "perched") settle();
      end();
    };

    void run();
    return () => {
      cancelled = true;
      off();
      window.removeEventListener("resize", onResize);
      timers.forEach((t) => window.clearTimeout(t));
      wakeResolve?.();
      setStep(null);
      setLamp(null);
      // A menu nap that was interrupted (a drag, another activity) does not leave her asleep on the floor.
      if (napSet && store().napping) store().setNapping(false);
      // Unmount or a drag mid-routine: never leave the cat hanging in the air.
      if (getPhase() === "perched") settle();
    };
    // The routine is keyed by its activity id; geometry is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lampId]);

  return { lamp, step };
}

/** Fixed art colours (the same cosy lamp in both themes), with a brown outline like Cache's. */
const LAMP_STYLE = {
  "--lamp-line": "oklch(0.36 0.06 50)",
  "--lamp-shade": "oklch(0.93 0.045 75)",
  "--lamp-shade-lit": "oklch(0.92 0.12 88)",
  "--lamp-trim": "oklch(0.74 0.11 45)",
  "--lamp-dot": "oklch(0.83 0.08 15)",
  "--lamp-pole": "oklch(0.58 0.05 60)",
  "--lamp-base": "oklch(0.64 0.1 40)",
  "--lamp-glow": "oklch(0.88 0.15 88)",
} as CSSProperties;

/**
 * The lamp: a round-cornered shade with a scalloped trim, polka dots and a sleepy face that wakes when the
 * light comes on, a thin pole with a pull chain, and a dome base. The flat shade top is the perch. A soft
 * glow and a pool of light on the floor when lit; a small wobble when she lands.
 */
export function Lamp({ lamp, size, groundY, animated }: { lamp: LampState | null; size: number; groundY: number; animated: boolean }) {
  const w = size * LAMP.w;
  const h = size * LAMP.h;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const glowId = `lamp-glow-${uid}`;
  return (
    <AnimatePresence>
      {lamp ? (
        <motion.div
          key="lamp"
          aria-hidden="true"
          data-testid="companion-lamp"
          data-lit={lamp.lit ? "true" : "false"}
          className="pointer-events-none absolute left-0 top-0"
          style={{ x: lamp.cx - w / 2, y: groundY - h, width: w, height: h, originY: 1 }}
          initial={animated ? { opacity: 0, scaleY: 0.6, scaleX: 0.85 } : { opacity: 0 }}
          animate={{ opacity: 1, scaleY: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleY: animated ? 0.7 : 1, scaleX: animated ? 0.9 : 1 }}
          transition={animated ? { type: "spring", stiffness: 380, damping: 18 } : { duration: 0 }}
        >
          <svg viewBox="0 0 70 84" width="100%" height="100%" overflow="visible" className="block" style={LAMP_STYLE}>
            <defs>
              <radialGradient id={glowId} cx="50%" cy="45%" r="50%">
                <stop offset="0%" stopColor="var(--lamp-glow)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--lamp-glow)" stopOpacity={0} />
              </radialGradient>
            </defs>
            {/* warm glow and the pool of light on the floor */}
            <motion.ellipse
              cx={35}
              cy={34}
              rx={40}
              ry={36}
              fill={`url(#${glowId})`}
              initial={false}
              animate={{ opacity: lamp.lit ? 1 : 0 }}
              transition={{ duration: animated ? 0.6 : 0 }}
            />
            <motion.ellipse
              cx={35}
              cy={81.5}
              rx={33}
              ry={4.4}
              fill="var(--lamp-glow)"
              initial={false}
              animate={{ opacity: lamp.lit ? 0.35 : 0 }}
              transition={{ duration: animated ? 0.6 : 0 }}
            />
            <ellipse cx={35} cy={82} rx={15} ry={2.6} className="fill-ink-3" opacity={0.4} />

            {/* everything above the floor wobbles from the base when she lands */}
            <motion.g
              style={{ originX: "35px", originY: "81px", transformBox: "view-box" }}
              initial={false}
              animate={animated && lamp.bump ? { rotate: [0, -4, 3, -1.5, 0] } : { rotate: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              {/* base and pole */}
              <path d="M 21.5 81.5 Q 21.5 72.5 35 71.6 Q 48.5 72.5 48.5 81.5 Z" fill="var(--lamp-base)" stroke="var(--lamp-line)" strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M 27 76.5 Q 35 74 43 76.5" fill="none" stroke="var(--lamp-shade)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
              <rect x={33.3} y={26} width={3.4} height={46.5} rx={1.7} fill="var(--lamp-pole)" stroke="var(--lamp-line)" strokeWidth={1.1} />
              <rect x={31.6} y={49} width={6.8} height={3.2} rx={1.6} fill="var(--lamp-trim)" stroke="var(--lamp-line)" strokeWidth={1} />
              {/* pull chain */}
              <path d="M 51.5 27 L 51.5 39" fill="none" stroke="var(--lamp-line)" strokeWidth={0.9} strokeDasharray="1.2 1.1" />
              <circle cx={51.5} cy={40.8} r={1.9} fill="var(--lamp-trim)" stroke="var(--lamp-line)" strokeWidth={0.9} />

              {/* shade: flat top (the perch), rounded corners, scalloped trim */}
              <motion.path
                d="M 18 4 L 52 4 Q 55 4 56 6.6 L 63.4 23.8 Q 64.6 27 61.2 27 L 8.8 27 Q 5.4 27 6.6 23.8 L 14 6.6 Q 15 4 18 4 Z"
                stroke="var(--lamp-line)"
                strokeWidth={1.6}
                strokeLinejoin="round"
                initial={false}
                animate={{ fill: lamp.lit ? "var(--lamp-shade-lit)" : "var(--lamp-shade)" }}
                transition={{ duration: animated ? 0.45 : 0 }}
              />
              <path
                d="M 7 27 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0 q 3.1 4.2 6.2 0"
                fill="var(--lamp-trim)"
                stroke="var(--lamp-line)"
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
              <path d="M 17.5 7.4 L 52.5 7.4" fill="none" stroke="var(--lamp-trim)" strokeWidth={1.6} strokeLinecap="round" />
              <circle cx={16.5} cy={19} r={1.6} fill="var(--lamp-dot)" />
              <circle cx={53.5} cy={19} r={1.6} fill="var(--lamp-dot)" />
              <circle cx={21} cy={12} r={1.3} fill="var(--lamp-dot)" />
              <circle cx={49} cy={12} r={1.3} fill="var(--lamp-dot)" />
              {/* a face: asleep while off, awake and smiling when lit */}
              <ellipse cx={27.5} cy={20.5} rx={2.4} ry={1.3} fill="var(--lamp-dot)" opacity={0.85} />
              <ellipse cx={42.5} cy={20.5} rx={2.4} ry={1.3} fill="var(--lamp-dot)" opacity={0.85} />
              {lamp.lit ? (
                <g>
                  <circle cx={30} cy={16.6} r={1.5} fill="var(--lamp-line)" />
                  <circle cx={40} cy={16.6} r={1.5} fill="var(--lamp-line)" />
                  <path d="M 32.6 19.4 Q 35 21.6 37.4 19.4" fill="none" stroke="var(--lamp-line)" strokeWidth={1.1} strokeLinecap="round" />
                </g>
              ) : (
                <g>
                  <path d="M 28.2 16.4 Q 30 18 31.8 16.4 M 38.2 16.4 Q 40 18 41.8 16.4" fill="none" stroke="var(--lamp-line)" strokeWidth={1.1} strokeLinecap="round" />
                  <path d="M 33.8 20 Q 35 20.8 36.2 20" fill="none" stroke="var(--lamp-line)" strokeWidth={1} strokeLinecap="round" />
                </g>
              )}
              {/* light spilling under the shade */}
              <motion.ellipse
                cx={35}
                cy={28.4}
                rx={24}
                ry={2.4}
                fill="var(--lamp-glow)"
                initial={false}
                animate={{ opacity: lamp.lit ? 0.9 : 0 }}
                transition={{ duration: animated ? 0.45 : 0 }}
              />
            </motion.g>
          </svg>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
