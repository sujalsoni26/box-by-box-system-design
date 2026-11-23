"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { RoutineStep } from "@/lib/companion/behaviour";
import { line } from "@/lib/companion/lines";
import { canNudge } from "@/lib/companion/reactions";
import { companionBlip } from "@/lib/companion/sound";
import { useCompanionStore } from "@/stores/companion-store";
import type { Point } from "@/lib/companion/resting";

/*
 * The idle lamp: after a long quiet spell on desktop, Cache sometimes walks to a little lamp, hops on,
 * sits in its warm light and dozes off. Any activity wakes her: a stretch, a hop down beside the lamp,
 * and she stays there. Drag, resize or a press ends the routine cleanly at any step.
 */

/** Lamp size relative to the cat (viewBox 70 x 84). */
export const LAMP = { w: 0.95, h: 1.14 } as const;
/** Where the cat's box sits on the shade: its top edge is this far (in cat sizes) above the lamp top. */
const PERCH_LIFT = 0.88;

export interface LampState {
  /** Centre x of the lamp, viewport px. */
  cx: number;
  lit: boolean;
}

interface RoutineDeps {
  size: number;
  /** Viewport y of the line the cat stands on. */
  groundY: number;
  viewW: number;
  catX: () => number;
  walkTo: (x: number) => Promise<boolean>;
  jumpTo: (p: Point) => Promise<boolean>;
  settle: () => void;
  getPhase: () => string;
}

/**
 * Runs the lamp routine while the companion store's activity is "lamp". Returns what to draw (the lamp)
 * and the current step (for the cat's pose). Every timer and subscription is cleaned up on exit.
 */
export function useLampRoutine(deps: RoutineDeps): { lamp: LampState | null; step: RoutineStep } {
  const activity = useCompanionStore((s) => s.activity);
  const lampId = activity?.kind === "lamp" ? activity.id : 0;
  const [lamp, setLamp] = useState<LampState | null>(null);
  const [step, setStep] = useState<RoutineStep>(null);
  const { size, groundY, viewW, catX, walkTo, jumpTo, settle, getPhase } = deps;

  useEffect(() => {
    if (!lampId) return;
    let cancelled = false;
    let woke = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));
    const end = () => useCompanionStore.getState().endActivity(lampId);

    // Wake on activity: the brain drops the idle level to 0 when the learner does anything.
    let wakeResolve: (() => void) | null = null;
    const woken = new Promise<void>((resolve) => (wakeResolve = resolve));
    const off = useCompanionStore.subscribe((s, prev) => {
      if (s.idleLevel === 0 && prev.idleLevel !== 0 && !woke) {
        woke = true;
        wakeResolve?.();
      }
    });

    const lampW = size * LAMP.w;
    const lampH = size * LAMP.h;
    const run = async () => {
      // Pick the side with room for the lamp, close to the cat.
      const centre = catX() + size / 2;
      const gap = size * 1.25 + lampW / 2;
      const minC = lampW / 2 + 10;
      const maxC = viewW - lampW / 2 - 10;
      // Towards the middle of the screen first (more room), else the other side, else no lamp today.
      const towardsRight = centre < viewW / 2;
      let cx = towardsRight ? centre + gap : centre - gap;
      if (cx > maxC || cx < minC) cx = towardsRight ? centre - gap : centre + gap;
      if (cx > maxC || cx < minC) return end();
      const dir = cx > centre ? 1 : -1;

      setLamp({ cx, lit: false });
      await wait(450);
      if (cancelled || woke) return finishAwake();

      // Walk up beside the lamp, gather, jump onto the shade.
      setStep("lamp-approach");
      const standX = cx - dir * (lampW / 2 + size * 0.55) - size / 2;
      const walked = await walkTo(standX);
      if (cancelled) return;
      if (!walked || woke) return finishAwake();
      setStep("lamp-crouch");
      await wait(380);
      if (cancelled) return;
      if (woke) return finishAwake();
      setStep(null);
      const topY = groundY - lampH;
      const perched = await jumpTo({ x: cx - size / 2, y: topY - size * PERCH_LIFT });
      if (cancelled) return;
      if (!perched || getPhase() !== "perched") return finishAwake();
      setStep("lamp-sit");
      setLamp({ cx, lit: true });
      companionBlip("soft");

      await woken;
      if (cancelled) return;
      if (getPhase() !== "perched") return finishAwake();
      // Wake: stretch, lamp off, hop down on the side away from the edge, and stay there.
      setStep("lamp-stretch");
      setLamp({ cx, lit: false });
      await wait(650);
      if (cancelled) return;
      // Picked up during the stretch: the drag owns the cat now.
      if (getPhase() !== "perched") return finishAwake();
      setStep(null);
      const downX = cx + (cx > viewW / 2 ? -1 : 1) * (lampW / 2 + size * 0.2) - size / 2;
      const landed = await jumpTo({ x: downX, y: Number.POSITIVE_INFINITY });
      if (cancelled) return;
      if (landed && canNudge(Date.now())) {
        useCompanionStore.getState().say({ text: line("lampWake"), mood: "happy", ms: 3000 });
      }
      setLamp(null);
      end();
    };

    /** Interrupted before the nap: fade the lamp, come down if needed, end quietly. */
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
      timers.forEach((t) => window.clearTimeout(t));
      wakeResolve?.();
      setStep(null);
      setLamp(null);
      // Unmount or a drag mid-routine: never leave the cat hanging in the air.
      if (getPhase() === "perched") settle();
    };
    // The routine is keyed by its activity id; geometry is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lampId]);

  return { lamp, step };
}

/** The lamp itself: base, pole and a shade with a flat top for a cat. Warm glow when lit. */
export function Lamp({ lamp, size, groundY, animated }: { lamp: LampState | null; size: number; groundY: number; animated: boolean }) {
  const w = size * LAMP.w;
  const h = size * LAMP.h;
  return (
    <AnimatePresence>
      {lamp ? (
        <motion.div
          key="lamp"
          aria-hidden="true"
          data-testid="companion-lamp"
          data-lit={lamp.lit ? "true" : "false"}
          className="pointer-events-none absolute left-0 top-0"
          style={{ x: lamp.cx - w / 2, y: groundY - h, width: w, height: h }}
          initial={animated ? { opacity: 0, scale: 0.9 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: animated ? 0.92 : 1 }}
          transition={{ duration: animated ? 0.35 : 0 }}
        >
          <svg viewBox="0 0 70 84" width="100%" height="100%" overflow="visible" className="block">
            <motion.ellipse
              cx={35}
              cy={48}
              rx={30}
              ry={26}
              className="fill-amber"
              initial={false}
              animate={{ opacity: lamp.lit ? 0.22 : 0 }}
              transition={{ duration: animated ? 0.6 : 0 }}
            />
            <ellipse cx={35} cy={81} rx={17} ry={3.4} className="fill-ink-3" opacity={0.55} />
            <rect x={33.4} y={26} width={3.2} height={53} rx={1.4} className="fill-ink-3" />
            <path d="M 22 80.5 Q 35 74 48 80.5 Z" className="fill-ink-2" />
            <motion.path
              d="M 15 4 L 55 4 L 64 26 L 6 26 Z"
              className="stroke-amber-ink"
              strokeWidth={1.6}
              strokeLinejoin="round"
              initial={false}
              animate={{ fill: lamp.lit ? "var(--amber)" : "var(--amber-soft)" }}
              transition={{ duration: animated ? 0.45 : 0 }}
            />
            <path d="M 18 9 L 52 9" className="stroke-amber-ink" strokeWidth={1} opacity={0.5} />
          </svg>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** True when there is room for the lamp beside the cat (wide enough viewport). */
export function lampFits(viewW: number, size: number): boolean {
  return viewW >= 700 && size >= 60;
}

