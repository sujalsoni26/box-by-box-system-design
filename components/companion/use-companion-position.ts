"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import type { BodyPhase } from "@/lib/companion/behaviour";
import { rampEase, walkPlan, type Gait } from "@/lib/companion/gait";
import { LAMP, PERCH_LIFT } from "@/lib/companion/lamp-geometry";
import { clampVelocity, GRAVITY, isSettled, stepFall, type Arena, type Body } from "@/lib/companion/physics";
import { floorXFrom, getWorld, normalizeFloorX, readFloorLine, readViewport, type Point, type Size, type World } from "@/lib/companion/resting";
import { clamp } from "@/lib/utils";
import { useCompanionStore } from "@/stores/companion-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { AnimationLevel, CompanionPosition } from "@/types/companion";

export type { BodyPhase };
export type Facing = "left" | "right";

interface PositionOptions {
  size: number;
  compact: boolean;
  physics: boolean;
  motionLevel: AnimationLevel;
  /** Called when the learner picks the cat up. */
  onPickUp?: () => void;
  /** Is she asleep on her lamp right now? Then a drag carries her with the lamp (she sleeps on). */
  lampCarry?: () => boolean;
  /** The lamp, with her on it, touched down after being carried. */
  onLampDrop?: () => void;
}

export interface Layout {
  view: Size;
  /** y of the floor line (viewport bottom, or the top of a fixed bottom tab bar). */
  floorLine: number;
}

/** Height changes smaller than this with the same width are browser toolbars, not a new layout. */
const TOOLBAR_DELTA = 160;
/** How long the landing squash shows before the cat settles into its resting pose. */
const LAND_MS = 280;
/** Gravity used for the plain drop (physics off), px/s², matching the desktop profile. */
const DROP_GRAVITY = 1850;

function readLayout(): Layout {
  const view = readViewport();
  return { view, floorLine: readFloorLine(view) };
}

/**
 * Position, drag, gravity and moves for the companion. The body is a small state machine
 * (see lib/companion/behaviour.ts): resting, dragging, flying, dropping, landing, walking, jumping, perched.
 *
 * - Motion drag (started only from the cat button) moves two motion values; frames never re-render React.
 * - On release she falls under gravity (side walls bounce; the top is a ceiling only at the top of the page),
 *   bounces once or twice, slides to a stop, shows a short landing squash, and then STAYS where she landed.
 *   Nothing moves her back to a corner. rAF runs only while she is in the air.
 * - Reduced motion or physics off: a quick straight drop to the floor below, then she stays there.
 * - The floor x is stored normalised (`floor: true`), so after a refresh or resize she is restored at the
 *   same relative spot, clamped fully on screen.
 */
export function useCompanionPosition(options: PositionOptions) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tilt = useMotionValue(0);
  const dragControls = useDragControls();
  const [initialLayout] = useState<Layout>(readLayout);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [phase, setPhase] = useState<BodyPhase>("resting");
  const [facing, setFacing] = useState<Facing>("left");
  const [rising, setRising] = useState(false);
  const [gait, setGait] = useState<Gait>("walk");
  /** Carrying her asleep on the lamp (from pick-up until the lamp lands). */
  const [carrying, setCarrying] = useState(false);
  const carryRef = useRef(false);

  const optsRef = useRef(options);
  const layoutRef = useRef<Layout>(initialLayout);
  const phaseRef = useRef<BodyPhase>("resting");
  const restRef = useRef<CompanionPosition | null>(null);
  const rafRef = useRef(0);
  const landTimer = useRef(0);
  const animsRef = useRef<Array<{ stop: () => void }>>([]);
  const tokenRef = useRef(0);
  const draggedRef = useRef(false);
  const interruptedRef = useRef(false);
  const restoreSelectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    optsRef.current = options;
  });

  const go = useCallback((next: BodyPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const world = useCallback((): World => {
    const o = optsRef.current;
    const { view, floorLine } = layoutRef.current;
    return getWorld(view, o.size, o.compact, floorLine);
  }, []);

  /** Re-read the viewport and floor (cheap; called before decisions, never per frame). */
  const refreshLayout = useCallback(() => {
    const next = readLayout();
    const prev = layoutRef.current;
    layoutRef.current = next;
    if (prev.view.w !== next.view.w || prev.view.h !== next.view.h || prev.floorLine !== next.floorLine) setLayout(next);
    return next;
  }, []);

  const stopMotion = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    window.clearTimeout(landTimer.current);
    landTimer.current = 0;
    animsRef.current.forEach((a) => a.stop());
    animsRef.current = [];
    tokenRef.current += 1;
  }, []);

  /** The cat is standing on the floor at `px`: remember it (normalised) and rest there. */
  const commitRest = useCallback(
    (px: number) => {
      const w = world();
      const cx = clamp(px, w.minX, w.maxX);
      x.set(cx);
      y.set(w.floorY);
      const n = normalizeFloorX(cx, w);
      restRef.current = n;
      usePreferencesStore.getState().setCompanionPosition(n);
      go("resting");
    },
    [go, world, x, y],
  );

  /** Touch down where she is: a short squash, then rest at exactly this x. */
  const land = useCallback(() => {
    const w = world();
    const px = clamp(x.get(), w.minX, w.maxX);
    x.set(px);
    y.set(w.floorY);
    if (optsRef.current.motionLevel === "reduced") {
      commitRest(px);
      return;
    }
    go("landing");
    window.clearTimeout(landTimer.current);
    landTimer.current = window.setTimeout(() => {
      landTimer.current = 0;
      if (phaseRef.current === "landing") commitRest(px);
    }, LAND_MS);
  }, [commitRest, go, world, x, y]);

  const face = useCallback((dx: number) => {
    if (Math.abs(dx) >= 1) setFacing(dx < 0 ? "left" : "right");
  }, []);

  /**
   * Tween to `target`. Resolves true when it arrived, false when something newer interrupted it.
   * Walks follow lib/companion/gait.ts: a whole number of steps at the gait's cadence, constant speed while
   * the feet are planted and a gentle first and last step, so the legs never skate.
   */
  const moveTo = useCallback(
    (target: Point, kind: "walk" | "drop", walkGait?: Gait): Promise<boolean> => {
      stopMotion();
      const o = optsRef.current;
      const dx = target.x - x.get();
      const dy = Math.abs(target.y - y.get());
      if (Math.abs(dx) < 1 && dy < 1) {
        x.set(target.x);
        y.set(target.y);
        return Promise.resolve(true);
      }
      const reduced = o.motionLevel === "reduced";
      const plan = walkPlan(Math.abs(dx), o.size, walkGait);
      const duration =
        kind === "drop"
          ? reduced
            ? 0.16
            : clamp(Math.sqrt((2 * dy) / DROP_GRAVITY), 0.14, 0.55)
          : reduced
            ? 0.2
            : plan.duration;
      const token = tokenRef.current;
      if (kind === "walk") {
        face(dx);
        setGait(plan.gait);
      }
      go(kind === "drop" ? "dropping" : "walking");
      const walkEase = reduced ? "easeOut" : rampEase(duration, plan.gait);
      const ax = animate(x, target.x, { duration, ease: kind === "drop" ? "easeOut" : walkEase });
      const ay = animate(y, target.y, { duration, ease: kind === "drop" ? "easeIn" : "linear" });
      animsRef.current = [ax, ay];
      return Promise.all([ax.finished, ay.finished])
        .then(() => tokenRef.current === token)
        .catch(() => false);
    },
    [face, go, stopMotion, x, y],
  );

  /** Straight down to the floor below (no physics), then land and stay. */
  const dropToFloor = useCallback(() => {
    const w = world();
    const target = { x: clamp(x.get(), w.minX, w.maxX), y: w.floorY };
    void moveTo(target, "drop").then((ok) => {
      if (ok) land();
    });
  }, [land, moveTo, world, x]);

  const fly = useCallback(
    (velocity: Point) => {
      stopMotion();
      const o = optsRef.current;
      const profile = o.compact ? GRAVITY.compact : GRAVITY.desktop;
      const w = world();
      const viewH = layoutRef.current.view.h;
      const v = clampVelocity(velocity, profile.maxThrow);
      let body: Body = { x: x.get(), y: y.get(), vx: v.x, vy: v.y, grounded: false };
      let up = body.vy < 0;
      setRising(up);
      face(v.x);
      go("flying");
      const start = performance.now();
      let last = start;
      const step = (t: number) => {
        const dt = Math.min(0.032, Math.max(0, (t - last) / 1000));
        last = t;
        const arena: Arena = {
          minX: w.minX,
          maxX: w.maxX,
          floorY: w.floorY,
          ceilingY: window.scrollY <= 0 ? 4 : null,
          capY: -1.2 * viewH,
        };
        body = stepFall(body, dt, arena, profile);
        x.set(body.x);
        y.set(body.y);
        // Re-render only when the arc turns over (rising -> falling), not every frame.
        const nowUp = !body.grounded && body.vy < 0;
        if (nowUp !== up) {
          up = nowUp;
          setRising(nowUp);
        }
        if (isSettled(body, profile) || t - start > profile.maxFlightMs) {
          rafRef.current = 0;
          land();
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [face, go, land, stopMotion, world, x, y],
  );

  /** Walk along the floor to `targetX` (play, lamp, reset). The gait follows the distance unless given. Resolves false if interrupted. */
  const walkTo = useCallback(
    (targetX: number, walkGait?: Gait) => {
      const w = world();
      const tx = clamp(targetX, w.minX, w.maxX);
      return moveTo({ x: tx, y: w.floorY }, "walk", walkGait).then((ok) => {
        if (ok) commitRest(tx);
        return ok;
      });
    },
    [commitRest, moveTo, world],
  );

  /**
   * A deliberate jump along an arc to `target` (top-left of the cat). Lands on the floor (landing squash,
   * then rest there) or on a perch above it ("perched"). Resolves false if interrupted.
   */
  const jumpTo = useCallback(
    (target: Point): Promise<boolean> => {
      stopMotion();
      const o = optsRef.current;
      const w = world();
      const tx = clamp(target.x, w.minX, w.maxX);
      const ty = Math.min(target.y, w.floorY);
      const toFloor = ty >= w.floorY - 0.5;
      const token = tokenRef.current;
      const finish = () => {
        if (toFloor) land();
        else {
          x.set(tx);
          y.set(ty);
          go("perched");
        }
      };
      if (o.motionLevel === "reduced") {
        x.set(tx);
        y.set(ty);
        finish();
        return Promise.resolve(true);
      }
      const x0 = x.get();
      const y0 = y.get();
      face(tx - x0);
      go("jumping");
      // A believable arc: up fast and slowing to the apex, then gravity; the body pitches nose-up while
      // rising and nose-down on the way down (the sprite reads `rising`).
      const peak = Math.min(y0, ty) - Math.max(18, o.size * 0.45);
      const duration = clamp(0.42 + Math.abs(tx - x0) / 900 + Math.abs(ty - y0) / 1400, 0.45, 0.8);
      const apex = 0.42;
      setRising(true);
      const apexTimer = window.setTimeout(() => setRising(false), duration * apex * 1000);
      const ax = animate(x, tx, { duration, ease: "linear" });
      const ay = animate(y, [y0, peak, ty], { duration, times: [0, apex, 1], ease: ["easeOut", "easeIn"] });
      animsRef.current = [ax, ay, { stop: () => window.clearTimeout(apexTimer) }];
      return Promise.all([ax.finished, ay.finished])
        .then(() => {
          if (tokenRef.current !== token) return false;
          finish();
          return true;
        })
        .catch(() => false);
    },
    [face, go, land, stopMotion, world, x, y],
  );

  /**
   * Carried asleep on the lamp and let go: lamp and cat drop straight down together until the lamp stands on the
   * floor (kept fully on screen), and she stays perched on it, asleep.
   */
  const dropWithLamp = useCallback(() => {
    stopMotion();
    const o = optsRef.current;
    const w = world();
    const viewW = layoutRef.current.view.w;
    const lampW = o.size * LAMP.w;
    const minX = Math.max(w.minX, lampW / 2 + 10 - o.size / 2);
    const maxX = Math.max(minX, Math.min(w.maxX, viewW - lampW / 2 - 10 - o.size / 2));
    const tx = clamp(x.get(), minX, maxX);
    const ty = w.floorY + o.size * 0.93 - o.size * LAMP.h - o.size * PERCH_LIFT;
    const dy = Math.abs(ty - y.get());
    const duration = o.motionLevel === "reduced" ? 0.12 : clamp(Math.sqrt((2 * Math.max(dy, 1)) / DROP_GRAVITY), 0.14, 0.6);
    const token = tokenRef.current;
    go("dropping");
    const ax = animate(x, tx, { duration, ease: "easeOut" });
    const ay = animate(y, ty, { duration, ease: "easeIn" });
    animsRef.current = [ax, ay];
    void Promise.all([ax.finished, ay.finished])
      .then(() => {
        if (tokenRef.current !== token) return;
        carryRef.current = false;
        setCarrying(false);
        go("perched");
        optsRef.current.onLampDrop?.();
      })
      .catch(() => {});
  }, [go, stopMotion, world, x, y]);

  /** From wherever she is (mid-air after an interrupted move, or perched), get down to the floor and stay. */
  const settle = useCallback(() => {
    const w = world();
    if (Math.abs(y.get() - w.floorY) > 1) dropToFloor();
    else commitRest(x.get());
  }, [commitRest, dropToFloor, world, x, y]);

  /** Re-place the cat on the floor for the current viewport (resize, rotation, mode change), same relative x. */
  const reproject = useCallback(() => {
    if (phaseRef.current === "dragging") return;
    stopMotion();
    const w = world();
    const px = floorXFrom(restRef.current, w);
    x.set(px);
    y.set(w.floorY);
    go("resting");
  }, [go, stopMotion, world, x, y]);

  // Initial placement: the stored floor x (normalised, so desktop maps onto phones), else bottom-right.
  useLayoutEffect(() => {
    const stored = usePreferencesStore.getState().companion.position;
    restRef.current = stored ? { x: stored.x, y: 1, floor: true } : { x: 1, y: 1, floor: true };
    reproject();
  }, [reproject]);

  // Viewport changes: keep the cat at the same relative spot on the (new) floor, fully on screen.
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const prev = layoutRef.current;
        const next = refreshLayout();
        if (prev.view.w === next.view.w && prev.view.h === next.view.h && prev.floorLine === next.floorLine) return;
        const p = phaseRef.current;
        if (prev.view.w === next.view.w && Math.abs(prev.view.h - next.view.h) < TOOLBAR_DELTA) {
          // Mobile toolbars showing or hiding: keep a resting cat standing on the (moved) floor.
          if (p === "resting" || p === "landing") y.set(world().floorY);
        } else if (p === "resting" || p === "landing" || p === "perched") {
          // A perched cat is put back on the floor (the routine that owns the perch ends on its own).
          reproject();
        } else if (p !== "dragging") {
          // Mid-move: stop and come down at the nearest valid spot instead of finishing a stale path.
          stopMotion();
          settle();
        }
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [refreshLayout, reproject, settle, stopMotion, world, y]);

  // Size or phone/desktop mode changed (media queries): re-place at the same relative spot.
  const { size, compact } = options;
  const modeRef = useRef({ size, compact });
  useEffect(() => {
    if (modeRef.current.size === size && modeRef.current.compact === compact) return;
    modeRef.current = { size, compact };
    refreshLayout();
    reproject();
  }, [size, compact, refreshLayout, reproject]);

  // "Reset position" (an explicit choice in Settings): walk back to the bottom-right of the floor.
  const resetNonce = useCompanionStore((s) => s.resetNonce);
  const seenNonce = useRef(resetNonce);
  useEffect(() => {
    if (resetNonce === seenNonce.current) return;
    seenNonce.current = resetNonce;
    refreshLayout();
    const w = world();
    if (Math.abs(y.get() - w.floorY) > 1) {
      x.set(clamp(x.get(), w.minX, w.maxX));
      y.set(w.floorY);
    }
    void walkTo(w.maxX);
  }, [resetNonce, refreshLayout, walkTo, world, x, y]);

  useEffect(
    () => () => {
      stopMotion();
      restoreSelectRef.current?.();
    },
    [stopMotion],
  );

  /** Viewport y of the line the cat stands on (for props like the yarn ball and the lamp). */
  const groundY = useMemo(
    () => getWorld(layout.view, options.size, options.compact, layout.floorLine).floorY + options.size * 0.93,
    [layout, options.size, options.compact],
  );

  const dragConstraints = useMemo(() => {
    const w = getWorld(layout.view, options.size, options.compact, layout.floorLine);
    if (carrying) {
      // Carrying the lamp under her: keep the lamp on screen and above the floor too.
      const lampW = options.size * LAMP.w;
      const left = Math.max(w.minX, lampW / 2 + 10 - options.size / 2);
      const right = Math.max(left, Math.min(w.maxX, layout.view.w - lampW / 2 - 10 - options.size / 2));
      const bottom = w.floorY + options.size * 0.93 - options.size * LAMP.h - options.size * PERCH_LIFT;
      return { left, right, top: 4, bottom: Math.max(4, bottom) };
    }
    // Fully on screen at every width: the cat is never cut off at an edge.
    return { left: w.minX, right: w.maxX, top: 4, bottom: w.floorY };
  }, [layout, options.size, options.compact, carrying]);

  /** Pointer down on the cat: stop any move where she is and let Motion take over if the pointer moves. */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      draggedRef.current = false;
      const p = phaseRef.current;
      // Resting and perched are still; a press on a moving cat stops her (she settles if it was not a drag).
      // The lamp's drop after a carry always finishes (she must not come down without it).
      interruptedRef.current = p !== "resting" && p !== "perched" && !carryRef.current;
      if (interruptedRef.current) {
        stopMotion();
        go("resting");
      }
      dragControls.start(e);
    },
    [dragControls, go, stopMotion],
  );

  const onDragStart = useCallback(() => {
    draggedRef.current = true;
    interruptedRef.current = false;
    // Asleep on her lamp: carry both (decided before anything else changes).
    carryRef.current = Boolean(optsRef.current.lampCarry?.());
    setCarrying(carryRef.current);
    stopMotion();
    go("dragging");
    // No text selection while the cat is carried across the page.
    const body = document.body.style;
    const previous = body.userSelect;
    body.userSelect = "none";
    window.getSelection()?.removeAllRanges();
    restoreSelectRef.current = () => {
      body.userSelect = previous;
      restoreSelectRef.current = null;
    };
    optsRef.current.onPickUp?.();
  }, [go, stopMotion]);

  const onDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (optsRef.current.motionLevel === "reduced" || carryRef.current) return;
      // Held by the scruff: the body swings against the direction of travel.
      tilt.set(clamp(info.velocity.x / 110, -12, 12));
    },
    [tilt],
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      restoreSelectRef.current?.();
      tilt.set(0);
      refreshLayout();
      const o = optsRef.current;
      if (carryRef.current) dropWithLamp();
      else if (o.physics && o.motionLevel !== "reduced") fly(info.velocity);
      else dropToFloor();
    },
    [dropToFloor, dropWithLamp, fly, refreshLayout, tilt],
  );

  /** True once after a drag, so the click that ends a drag does not open the menu. */
  const consumeDrag = useCallback(() => {
    const dragged = draggedRef.current;
    draggedRef.current = false;
    return dragged;
  }, []);

  /** A press without a drag stopped a fall or a walk: come down from here and stay. */
  const settleIfInterrupted = useCallback(() => {
    if (!interruptedRef.current) return;
    interruptedRef.current = false;
    settle();
  }, [settle]);

  const getPhase = useCallback(() => phaseRef.current, []);
  /** Turn towards a horizontal offset (a routine looking at its target before a crouch or a pounce). */
  const faceTo = useCallback((dx: number) => face(dx), [face]);

  return {
    x,
    y,
    tilt,
    layout,
    view: layout.view,
    groundY,
    phase,
    facing,
    rising,
    gait,
    carrying,
    getPhase,
    faceTo,
    dragControls,
    dragConstraints,
    onPointerDown,
    onDragStart,
    onDrag,
    onDragEnd,
    consumeDrag,
    settle,
    settleIfInterrupted,
    walkTo,
    jumpTo,
    stopMotion,
    world,
  };
}
