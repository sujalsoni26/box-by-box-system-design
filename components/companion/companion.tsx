"use client";
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useSpring, type MotionValue } from "motion/react";
import { equippedAttr } from "@/lib/companion/accessories";
import { petCache } from "@/lib/companion/actions";
import { deriveMood, isStill, type RoutineStep } from "@/lib/companion/behaviour";
import { lessonFromPath } from "@/lib/companion/lesson-context";
import { line } from "@/lib/companion/lines";
import { pageIsBusy } from "@/lib/companion/quiet";
import type { Size } from "@/lib/companion/resting";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useMotionLevel } from "@/lib/hooks/use-motion-level";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { clamp, cn } from "@/lib/utils";
import { useCompanionStore, useFocusHydrated, useFocusStore } from "@/stores/companion-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { CompanionMenu } from "./companion-menu";
import { FocusTimer } from "./focus-timer";
import { Lamp, lampFits, useLampRoutine } from "./lamp";
import { PixelCat } from "./pixel-cat";
import { usePlay, YarnBall } from "./play";
import { BubbleAnnouncer, SpeechBubble } from "./speech-bubble";
import { useCompanionBrain } from "./use-companion-brain";
import { useCompanionPosition } from "./use-companion-position";
import { useCompletionPrompt, useTopicMeows } from "./use-companion-routines";
import { useNewAccessoryCount } from "./wardrobe";

/** Phones get the smallest cat that is still a comfortable touch target (WCAG 2.5.5 suggests 44px). */
const CAT_SIZE = { desktop: 84, compact: 60, phone: 52 } as const;
const PANEL_MAX_WIDTH = 304;
const PET_DELAY_MS = 1200;
const PET_GAP_MS = 15_000;

/**
 * Cache, the study companion. Mount once in the root layout. Renders nothing on the server or
 * before persisted settings load, and nothing at all while the companion is switched off.
 */
export function Companion() {
  return (
    <Suspense fallback={null}>
      <CompanionGate />
    </Suspense>
  );
}

function CompanionGate() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const enabled = usePreferencesStore((s) => s.companion.enabled);
  if (!hydrated || !enabled) return null;
  return <CompanionShell pathname={pathname ?? "/"} />;
}

function CompanionShell({ pathname }: { pathname: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const catRef = useRef<HTMLButtonElement>(null);
  const petTimer = useRef(0);
  const lastPet = useRef(0);
  /** The press that stopped break play: its click must not also open the menu. */
  const swallowClick = useRef(false);
  /** The lamp routine's current step and landing hook (the position hook needs them before the routine exists). */
  const lampStepRef = useRef<RoutineStep>(null);
  const lampLandedRef = useRef<() => void>(() => {});
  const asleepOnLamp = () => useCompanionStore.getState().activity?.kind === "lamp" && lampStepRef.current === "lamp-nap";
  const menuId = useId();
  const hintId = useId();

  const motionLevel = useMotionLevel();
  const pageVisible = usePageVisible();
  const coarse = useMediaQuery("(pointer: coarse)");
  const narrow = useMediaQuery("(max-width: 640px)");
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const compact = coarse || narrow;
  const size = narrow ? CAT_SIZE.phone : compact ? CAT_SIZE.compact : CAT_SIZE.desktop;
  const physics = usePreferencesStore((s) => s.companion.physics);
  const lesson = useMemo(() => lessonFromPath(pathname), [pathname]);

  const menuOpen = useCompanionStore((s) => s.menuOpen);
  const bubble = useCompanionStore((s) => s.bubble);
  const reactionMood = useCompanionStore((s) => s.reaction?.mood);
  const idleLevel = useCompanionStore((s) => s.idleLevel);
  const focusHydrated = useFocusHydrated();
  const focusPhase = useFocusStore((s) => s.session?.phase ?? null);
  const napping = useCompanionStore((s) => s.napping);
  const activity = useCompanionStore((s) => s.activity);
  const equipped = usePreferencesStore((s) => s.companion.equipped);

  // Picking the cat up closes the menu and ends any routine (the drag owns the cat from then on), except when she
  // is asleep on her lamp: then she is carried with it and sleeps on.
  const onPickUp = useCallback(() => {
    const s = useCompanionStore.getState();
    s.closeMenu();
    if (s.activity?.kind === "lamp" && lampStepRef.current === "lamp-nap") return;
    if (s.activity?.kind === "break-play") s.stopBreakPlay(useFocusStore.getState().session?.startedAt ?? 0);
    else if (s.activity) s.endActivity(s.activity.id);
  }, []);
  const lampCarry = useCallback(() => asleepOnLamp(), []);
  const onLampDrop = useCallback(() => lampLandedRef.current(), []);
  const pos = useCompanionPosition({ size, compact, physics, motionLevel, onPickUp, lampCarry, onLampDrop });
  const animated = motionLevel !== "reduced";
  const { getPhase } = pos;

  // The lamp: room beside the cat (phones too), motion allowed. The idle one also needs a quiet, still companion.
  const viewW = pos.view.w;
  const lampAvailable = animated && lampFits(viewW, size, compact);
  const lampAllowed = useCallback(() => {
    const s = useCompanionStore.getState();
    return (
      animated &&
      lampFits(viewW, size, compact) &&
      isStill(getPhase()) &&
      !s.napping &&
      !s.menuOpen &&
      !s.bubble &&
      !s.activity &&
      !useFocusStore.getState().session &&
      !pageIsBusy()
    );
  }, [compact, animated, viewW, size, getPhase]);
  useCompanionBrain({ pathname, lessonSlug: lesson?.slug, lampAllowed, animated });
  useTopicMeows({ lesson, compact, getPhase });
  useCompletionPrompt({ lesson, compact, getPhase });
  const lampRoutine = useLampRoutine({
    size,
    groundY: pos.groundY,
    viewW,
    animated,
    catX: () => pos.x.get(),
    walkTo: pos.walkTo,
    jumpTo: pos.jumpTo,
    settle: pos.settle,
    faceTo: pos.faceTo,
    getPhase,
  });
  useEffect(() => {
    lampStepRef.current = lampRoutine.step;
    lampLandedRef.current = lampRoutine.landed;
  });
  // Yarn chase (menu) and break-time play (focus breaks).
  const play = usePlay({
    size,
    compact,
    animated,
    x: pos.x,
    y: pos.y,
    walkTo: pos.walkTo,
    jumpTo: pos.jumpTo,
    settle: pos.settle,
    stopMotion: pos.stopMotion,
    faceTo: pos.faceTo,
    getPhase,
    world: pos.world,
  });
  const anchors = useAnchors(pos.x, pos.y, size, pos.view);
  const swing = useSpring(pos.tilt, { stiffness: 220, damping: 16 });
  const newAccessories = useNewAccessoryCount();

  useEffect(() => {
    const timer = petTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const still = isStill(pos.phase);
  const airborne = pos.phase === "dragging" || pos.phase === "flying" || pos.phase === "dropping" || pos.phase === "jumping";
  // One derived pose (lib/companion/behaviour.ts) instead of a chain of flags that could disagree.
  const mood = deriveMood({
    phase: pos.phase,
    rising: pos.rising,
    reaction: reactionMood ?? null,
    routine: lampRoutine.step ?? play.step,
    bubbleMood: bubble?.mood ?? null,
    napping,
    idleLevel,
    focusPhase: focusHydrated ? focusPhase : null,
    carriedAsleep: pos.carrying,
  });
  const ambient = animated && pageVisible && still;

  const toggleMenu = (focus: "first" | "last" = "first") => {
    const s = useCompanionStore.getState();
    if (s.menuOpen) {
      s.closeMenu();
      return;
    }
    s.dismiss();
    s.openMenu(focus);
  };

  /** Break play stops the moment she is pressed (or clicked from the keyboard), for the rest of this break. */
  const stopBreakPlay = () => {
    const s = useCompanionStore.getState();
    if (s.activity?.kind !== "break-play") return false;
    s.stopBreakPlay(useFocusStore.getState().session?.startedAt ?? 0);
    s.say({ text: line("breakPlayStop"), mood: "sitting", ms: 2600, solicited: true });
    return true;
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (stopBreakPlay()) swallowClick.current = true;
    // Asleep on the lamp: holding her keeps her asleep (so she can be carried); a tap without a drag still wakes her.
    const s = useCompanionStore.getState();
    if (asleepOnLamp() && !s.napping) s.setNapping(true);
    pos.onPointerDown(e);
  };

  const onClick = () => {
    const swallowed = swallowClick.current;
    swallowClick.current = false;
    if (pos.consumeDrag()) return;
    pos.settleIfInterrupted();
    if (swallowed) return;
    // Keyboard (Enter / Space): no press came first.
    if (stopBreakPlay()) {
      pos.stopMotion();
      pos.settle();
      return;
    }
    const s = useCompanionStore.getState();
    // On the lamp: a tap wakes her (she stretches and hops down); the next tap opens the menu.
    if (s.activity?.kind === "lamp") {
      s.wakeLamp();
      return;
    }
    if (s.napping) {
      // A tap wakes a napping cat (the next tap opens the menu).
      s.setNapping(false);
      s.react("happy", 900);
      return;
    }
    toggleMenu();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!useCompanionStore.getState().menuOpen) toggleMenu(e.key === "ArrowUp" ? "last" : "first");
    } else if (e.key === "Escape") {
      useCompanionStore.getState().closeMenu();
      useCompanionStore.getState().dismiss();
    }
  };

  // Hover to pet (mouse only, rarely): hearts and a purr, no speech; it also wakes a napping cat.
  const onPointerEnter = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => {
      const s = useCompanionStore.getState();
      const now = Date.now();
      if (s.menuOpen || s.activity || now - lastPet.current < PET_GAP_MS) return;
      lastPet.current = now;
      petCache(lesson, false);
    }, PET_DELAY_MS);
  };

  const yarnSize = compact ? 14 : 18;

  return (
    <section
      ref={rootRef}
      aria-label="Study companion"
      data-testid="companion"
      data-mood={mood}
      data-phase={pos.phase}
      data-activity={activity?.kind ?? ""}
      data-resting={still ? "true" : "false"}
      data-accessories={equippedAttr(equipped)}
      className="fixed bottom-0 left-0 z-40 h-0 w-0"
    >
      {/*
        Everything is placed from the top of the viewport, but this frame hangs from its bottom edge: phone toolbars
        that slide in and out while scrolling move the bottom, and Cache stays standing on it (never floating above
        it or sinking below it).
      */}
      <motion.div className="absolute left-0 top-0 h-0 w-0" style={{ y: pos.originY }}>
      <Lamp lamp={lampRoutine.lamp} size={size} groundY={pos.groundY} animated={animated} catX={pos.x} catY={pos.y} />

      <motion.div
        className="absolute left-0 top-0"
        style={{ x: pos.x, y: pos.y, width: size, height: size }}
        drag
        dragListener={false}
        dragControls={pos.dragControls}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={pos.dragConstraints}
        onDragStart={pos.onDragStart}
        onDrag={pos.onDrag}
        onDragEnd={pos.onDragEnd}
      >
        <motion.button
          ref={catRef}
          type="button"
          data-testid="companion-cat"
          aria-label="Cache, your study companion"
          aria-describedby={hintId}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onPointerDown={onPointerDown}
          onPointerEnter={onPointerEnter}
          onPointerLeave={() => window.clearTimeout(petTimer.current)}
          onClick={onClick}
          onKeyDown={onKeyDown}
          style={{ rotate: swing, originX: 0.5, originY: 0.12 }}
          className={cn(
            "block size-full touch-none select-none rounded-[38%] [-webkit-touch-callout:none]",
            airborne ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <PixelCat
            mood={mood}
            facing={pos.facing}
            gait={pos.gait}
            rising={pos.rising}
            motionLevel={motionLevel}
            ambient={ambient}
            gaze={finePointer}
            accessories={equipped}
          />
        </motion.button>
        {newAccessories > 0 ? (
          // A small "something new in the wardrobe" dot; the menu shows the count.
          <span
            aria-hidden="true"
            data-testid="companion-new-dot"
            className="pointer-events-none absolute right-[14%] top-[8%] size-2.5 rounded-full border-2 border-surface bg-review"
          />
        ) : null}
        <span id={hintId} className="sr-only">
          Opens a menu with explanations, quick revision, a focus timer, play and the wardrobe. Drag to move Cache; she stays where
          she lands.
          {newAccessories > 0 ? ` ${newAccessories} new ${newAccessories === 1 ? "accessory" : "accessories"} in the wardrobe.` : ""}
        </span>
      </motion.div>

      {play.showYarn ? <YarnBall yarn={play.yarn} groundY={pos.groundY} size={yarnSize} /> : null}

      {focusHydrated && focusPhase ? (
        <motion.div className="absolute left-0 top-0" data-testid="companion-timer-anchor" style={{ x: anchors.chipX, y: anchors.chipY }}>
          <div className={cn("-translate-y-1/2", anchors.side === "right" && "-translate-x-full")}>
            <FocusTimer />
          </div>
        </motion.div>
      ) : null}

      <motion.div
        className="pointer-events-none absolute left-0 top-0"
        style={{ x: anchors.panelX, y: anchors.panelY, width: anchors.panelWidth }}
      >
        <motion.div
          className={cn("pointer-events-auto flex flex-col", anchors.above && "-translate-y-full")}
          style={{ maxHeight: anchors.panelMaxHeight }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {menuOpen ? (
              <CompanionMenu
                key="menu"
                id={menuId}
                lesson={lesson}
                above={anchors.above}
                animated={animated}
                anchorRef={catRef}
                lampAvailable={lampAvailable}
              />
            ) : bubble ? (
              <SpeechBubble
                key={bubble.id}
                bubble={bubble}
                above={anchors.above}
                tailX={anchors.tailX}
                returnFocusRef={catRef}
                animated={animated}
              />
            ) : null}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      </motion.div>
      <BubbleAnnouncer />
    </section>
  );
}

/**
 * Positions for the bubble/menu (above or below the cat, clamped to the viewport) and the timer chip
 * (beside the cat, towards the middle of the screen). Driven by motion-value subscriptions, so the
 * panels follow a drag without re-rendering; React state only flips when a side changes.
 */
function useAnchors(x: MotionValue<number>, y: MotionValue<number>, size: number, view: Size) {
  const panelWidth = Math.max(200, Math.min(PANEL_MAX_WIDTH, view.w - 16));
  const panelX = useMotionValue(0);
  const panelY = useMotionValue(0);
  const panelMaxHeight = useMotionValue(480);
  const tailX = useMotionValue(0);
  const chipX = useMotionValue(0);
  const chipY = useMotionValue(0);
  const [above, setAbove] = useState(true);
  const [side, setSide] = useState<"left" | "right">("right");

  useEffect(() => {
    const update = () => {
      const cx = x.get();
      const cy = y.get();
      const isAbove = cy + size / 2 > view.h / 2;
      const isRight = cx + size / 2 > view.w / 2;
      const px = clamp(cx + size / 2 - panelWidth / 2, 8, Math.max(8, view.w - panelWidth - 8));
      panelX.set(px);
      tailX.set(clamp(cx + size / 2 - px, 18, panelWidth - 18));
      panelY.set(isAbove ? cy - 10 : cy + size + 10);
      panelMaxHeight.set(Math.max(140, isAbove ? cy - 18 : view.h - cy - size - 18));
      chipX.set(isRight ? cx - 4 : cx + size + 4);
      chipY.set(cy + size * 0.55);
      setAbove(isAbove);
      setSide(isRight ? "right" : "left");
    };
    const raf = requestAnimationFrame(update);
    const offX = x.on("change", update);
    const offY = y.on("change", update);
    return () => {
      cancelAnimationFrame(raf);
      offX();
      offY();
    };
  }, [x, y, size, view, panelWidth, panelX, panelY, panelMaxHeight, tailX, chipX, chipY]);

  return { panelWidth, panelX, panelY, panelMaxHeight, tailX, chipX, chipY, above, side };
}
