"use client";
import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, type MotionValue } from "motion/react";
import { isStill, type BodyPhase, type RoutineStep } from "@/lib/companion/behaviour";
import type { Gait } from "@/lib/companion/gait";
import { line } from "@/lib/companion/lines";
import { breakGame, clampX, playDirection, restMs } from "@/lib/companion/play-plan";
import { purrFor } from "@/lib/companion/sound";
import type { Point, World } from "@/lib/companion/resting";
import { clamp } from "@/lib/utils";
import { useCompanionStore, useFocusStore } from "@/stores/companion-store";

/*
 * Play. Two routines share the yarn ball:
 * - "play" (menu): one chase. The yarn rolls, Cache trots after it, bats it, and sits back pleased.
 * - "break-play" (focus breaks): games in turn (yarn chase, pounce, zoomies) with short rests between,
 *   for as long as the break lasts. Pressing or clicking Cache stops it at once (companion.tsx calls
 *   stopBreakPlay): every animation, timer and listener below is cleaned up, she comes down to the floor where
 *   she is, and break play stays off for the rest of that break.
 * Break play needs motion allowed, a still and free cat, and a break that is running (not paused).
 */

interface PlayDeps {
  size: number;
  compact: boolean;
  animated: boolean;
  x: MotionValue<number>;
  y: MotionValue<number>;
  walkTo: (x: number, gait?: Gait) => Promise<boolean>;
  jumpTo: (p: Point) => Promise<boolean>;
  settle: () => void;
  stopMotion: () => void;
  faceTo: (dx: number) => void;
  getPhase: () => BodyPhase;
  world: () => World;
}

export interface Yarn {
  x: MotionValue<number>;
  rotate: MotionValue<number>;
  opacity: MotionValue<number>;
}

const viewWidth = () => document.documentElement.clientWidth || window.innerWidth;

export function usePlay(deps: PlayDeps): { step: RoutineStep; yarn: Yarn; showYarn: boolean } {
  const activity = useCompanionStore((s) => s.activity);
  const playKind = activity?.kind === "play" || activity?.kind === "break-play" ? activity.kind : null;
  const playId = playKind ? activity!.id : 0;
  const [step, setStep] = useState<RoutineStep>(null);
  const yarnX = useMotionValue(0);
  const yarnRot = useMotionValue(0);
  const yarnOpacity = useMotionValue(0);
  const { size, compact, animated, x, y, walkTo, jumpTo, settle, stopMotion, faceTo, getPhase, world } = deps;

  // Break play starts by itself during a running focus break.
  const breakStartedAt = useFocusStore((s) => (s.session?.phase === "break" && !s.session.pausedAt ? s.session.startedAt : 0));
  useEffect(() => {
    if (!breakStartedAt || !animated) return;
    let timer = 0;
    const tryStart = () => {
      const s = useCompanionStore.getState();
      const busy =
        Boolean(s.activity) ||
        s.menuOpen ||
        s.napping ||
        Boolean(s.bubble?.actions?.length) ||
        s.breakPlayOff === breakStartedAt ||
        !isStill(getPhase()) ||
        document.visibilityState !== "visible";
      if (s.breakPlayOff === breakStartedAt) return; // stopped by the learner for this break: stay off
      if (!busy) {
        s.startActivity("break-play", "focus");
        return;
      }
      timer = window.setTimeout(tryStart, 2500);
    };
    timer = window.setTimeout(tryStart, 900);
    // When a game ends (or another activity finishes), try again: the break is still running.
    const off = useCompanionStore.subscribe((s, prev) => {
      if (prev.activity && !s.activity) {
        window.clearTimeout(timer);
        timer = window.setTimeout(tryStart, 1200);
      }
    });
    return () => {
      window.clearTimeout(timer);
      off();
      // The break ended (or was paused, or motion was turned off): stop playing.
      const a = useCompanionStore.getState().activity;
      if (a?.kind === "break-play") useCompanionStore.getState().endActivity(a.id);
    };
  }, [breakStartedAt, animated, getPhase]);

  // Opening the menu stops break play for this break (she sits still while you use it).
  const menuOpen = useCompanionStore((s) => s.menuOpen);
  useEffect(() => {
    if (!menuOpen || playKind !== "break-play") return;
    const session = useFocusStore.getState().session;
    useCompanionStore.getState().stopBreakPlay(session?.startedAt ?? 0);
  }, [menuOpen, playKind]);

  useEffect(() => {
    if (!playId || !playKind) return;
    let cancelled = false;
    const anims: Array<{ stop: () => void }> = [];
    const timers: number[] = [];
    const disposers: Array<() => void> = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, animated ? ms : Math.min(ms, 150))));
    const end = () => useCompanionStore.getState().endActivity(playId);
    const roll = (to: number, turns: number, duration: number) => {
      if (!animated) {
        yarnX.set(to);
        return;
      }
      anims.push(animate(yarnX, to, { duration, ease: [0.2, 0.7, 0.3, 1] }));
      anims.push(animate(yarnRot, yarnRot.get() + turns, { duration, ease: "easeOut" }));
    };
    const hideYarn = () => {
      if (!animated) {
        yarnOpacity.set(0);
        return;
      }
      anims.push(animate(yarnOpacity, 0, { duration: 0.25 }));
    };
    /** Hidden tab: wait until it is visible again (no work while nobody watches). */
    const whenVisible = () =>
      document.visibilityState === "visible"
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const on = () => {
              if (document.visibilityState !== "visible") return;
              document.removeEventListener("visibilitychange", on);
              resolve();
            };
            document.addEventListener("visibilitychange", on);
            disposers.push(() => {
              document.removeEventListener("visibilitychange", on);
              resolve();
            });
          });
    /** A question is waiting for an answer (e.g. "mark it as learned?"): hold still until it is answered. */
    const whenFree = () =>
      !useCompanionStore.getState().bubble?.actions?.length
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const off = useCompanionStore.subscribe((s) => {
              if (s.bubble?.actions?.length) return;
              off();
              resolve();
            });
            disposers.push(() => {
              off();
              resolve();
            });
          });
    /** If something left her above the floor (a perch, an interrupted jump), hop down first. */
    const ensureOnFloor = async () => {
      const w = world();
      if (Math.abs(y.get() - w.floorY) <= 1) return true;
      return jumpTo({ x: x.get(), y: Number.POSITIVE_INFINITY });
    };

    /** Roll the yarn away, chase it at a trot, bat it once more. Resolves false if interrupted. */
    const yarnChase = async (): Promise<boolean> => {
      const viewW = viewWidth();
      const centre = x.get() + size / 2;
      const reach = compact ? 110 : 200;
      const dir = playDirection(centre, viewW, reach);
      const start = clamp(centre + dir * size * 0.45, 12, viewW - 12);
      const end = clamp(start + dir * reach, 16, viewW - 16);
      yarnX.set(start);
      if (animated) {
        yarnOpacity.set(0);
        anims.push(animate(yarnOpacity, 1, { duration: 0.2 }));
      } else yarnOpacity.set(1);
      faceTo(dir);
      setStep("play-bat");
      await wait(280);
      if (cancelled) return false;
      setStep(null);
      roll(end, dir * 540, 1.1);
      await wait(220);
      if (cancelled) return false;
      const arrived = await walkTo(end - size / 2 - dir * size * 0.42, "trot");
      if (cancelled || !arrived) return false;
      setStep("play-bat");
      await wait(320);
      if (cancelled) return false;
      roll(clamp(end + dir * 70, 16, viewW - 16), dir * 240, 0.6);
      await wait(650);
      if (cancelled) return false;
      setStep(null);
      return true;
    };

    /** Crouch with a wiggle, leap forward along an arc, land, bat at the floor. */
    const pounce = async (): Promise<boolean> => {
      const w = world();
      const centre = x.get() + size / 2;
      const dist = compact ? 80 : 130;
      const dir = playDirection(centre, viewWidth(), dist + size);
      const target = clampX(x.get() + dir * dist, w.minX, w.maxX);
      faceTo(dir);
      setStep("play-crouch");
      await wait(700);
      if (cancelled) return false;
      setStep(null);
      const ok = await jumpTo({ x: target, y: Number.POSITIVE_INFINITY });
      if (cancelled || !ok) return false;
      await wait(360); // the landing squash
      if (cancelled) return false;
      setStep("play-bat");
      await wait(520);
      if (cancelled) return false;
      setStep(null);
      return true;
    };

    /** A burst of zoomies: trot off, turn, trot halfway back, a happy hop. */
    const zoomies = async (): Promise<boolean> => {
      const w = world();
      const centre = x.get() + size / 2;
      const dist = compact ? 120 : 200;
      const dir = playDirection(centre, viewWidth(), dist);
      const out = clampX(x.get() + dir * dist, w.minX, w.maxX);
      if (!(await walkTo(out, "trot")) || cancelled) return false;
      await wait(180);
      if (cancelled) return false;
      const back = clampX(out - dir * dist * 0.5, w.minX, w.maxX);
      if (!(await walkTo(back, "trot")) || cancelled) return false;
      setStep("play-cheer");
      purrFor("play");
      await wait(650);
      if (cancelled) return false;
      setStep(null);
      return true;
    };

    const runMenuPlay = async () => {
      if (!(await ensureOnFloor()) || cancelled) return end();
      const ok = await yarnChase();
      if (cancelled) return;
      hideYarn();
      if (ok) {
        const s = useCompanionStore.getState();
        s.react("happy", 1400);
        purrFor("play");
        s.say({ text: line("playDone"), mood: "happy", ms: 2600, solicited: true });
      }
      end();
    };

    const runBreakPlay = async () => {
      if (!(await ensureOnFloor()) || cancelled) return end();
      for (let i = 0; !cancelled; i += 1) {
        await whenVisible();
        await whenFree();
        if (cancelled) return;
        const game = breakGame(i);
        const ok = game === "yarn" ? await yarnChase() : game === "pounce" ? await pounce() : await zoomies();
        if (cancelled) return;
        if (game === "yarn") hideYarn();
        if (!ok) return end(); // interrupted by something else (a resize, another move): stop quietly
        setStep("play-rest");
        await wait(restMs(i));
        if (cancelled) return;
        setStep(null);
      }
    };

    void (playKind === "play" ? runMenuPlay() : runBreakPlay());
    return () => {
      cancelled = true;
      anims.forEach((a) => a.stop());
      timers.forEach((t) => window.clearTimeout(t));
      disposers.forEach((d) => d());
      yarnOpacity.set(0);
      setStep(null);
      // Stopped mid-move (a press, the break ending, another activity): come to rest where she is, on the floor.
      const phase = getPhase();
      if (phase !== "dragging" && phase !== "resting" && phase !== "landing") {
        stopMotion();
        settle();
      } else if (phase === "resting" && Math.abs(y.get() - world().floorY) > 1) {
        settle();
      }
    };
    // Keyed by the activity; geometry and helpers are read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playId]);

  return { step, yarn: { x: yarnX, rotate: yarnRot, opacity: yarnOpacity }, showYarn: Boolean(playId) };
}

/** The yarn ball rolling on the floor line. */
export function YarnBall({ yarn, groundY, size }: { yarn: Yarn; groundY: number; size: number }) {
  return (
    <motion.div
      aria-hidden="true"
      data-testid="companion-yarn"
      className="pointer-events-none absolute left-0 top-0"
      style={{ x: yarn.x, y: groundY, opacity: yarn.opacity }}
    >
      <motion.svg
        viewBox="-12 -12 24 24"
        width={size}
        height={size}
        style={{ rotate: yarn.rotate }}
        className="block -translate-x-1/2 -translate-y-full overflow-visible"
      >
        <circle r={10.5} className="fill-violet stroke-ink/50" strokeWidth={1.4} />
        <path
          d="M -9 -4 Q 0 -1 9 -5 M -10 2 Q 0 5 10 1 M -5 -9 Q -1 0 -4 9 M 4 -9 Q 8 0 3 9"
          className="fill-none stroke-violet-soft"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <path d="M 9 6 Q 14 10 11 13" className="fill-none stroke-violet" strokeWidth={1.4} strokeLinecap="round" />
      </motion.svg>
    </motion.div>
  );
}
