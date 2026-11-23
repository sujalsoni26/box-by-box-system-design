"use client";
import { useEffect, useRef } from "react";
import { onCompanionEvent } from "@/lib/companion-events";
import { idleStep } from "@/lib/companion/idle";
import { lessonFromPath } from "@/lib/companion/lesson-context";
import { learnerEngaged } from "@/lib/companion/quiet";
import {
  announceUnlocks,
  maybeGreet,
  maybeLessonTip,
  maybeWelcomeBack,
  reactToEvent,
  reactToFocusEvent,
} from "@/lib/companion/reactions";
import { TIMING } from "@/lib/companion/timing";
import { STORAGE_KEYS } from "@/lib/storage/adapter";
import { ensureFocusHydrated, syncFocusFromStorage, useCompanionStore, useFocusStore } from "@/stores/companion-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";

/** Meaningful input: keyboard, pointer (press and move), touch and wheel; scroll and the tab coming back are handled below. */
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
/** How long the yawn shows on the way to sleep, and the stretch on waking, ms. */
const YAWN_MS = 1300;
const WAKE_STRETCH_MS = 850;

interface BrainOptions {
  pathname: string;
  lessonSlug?: string;
  /** May the idle lamp routine start now? (desktop, motion allowed, cat still and free). */
  lampAllowed: () => boolean;
  /** Motion allowed: the yawn and the wake-up stretch play (reduced motion goes straight between poses). */
  animated: boolean;
}

/**
 * Local behaviour, no AI: listens to the app's companion events, tracks inactivity (sit after 45 s,
 * sometimes a lamp nap after 70 s on desktop, a yawn and sleep after 2 min, a stretch on waking), greets
 * once per session, schedules lesson tips, announces focus-timer phase changes and expires short
 * reactions. All timers are one-shot.
 */
export function useCompanionBrain({ pathname, lessonSlug, lampAllowed, animated }: BrainOptions) {
  const lessonRef = useRef(lessonSlug);
  const lampAllowedRef = useRef(lampAllowed);
  const animatedRef = useRef(animated);
  useEffect(() => {
    lessonRef.current = lessonSlug;
    lampAllowedRef.current = lampAllowed;
    animatedRef.current = animated;
  });

  // App events → reactions; lesson tips wait a moment and only fire if the learner is still there.
  useEffect(() => {
    let tipTimer = 0;
    const scheduleTip = (slug: string, delay: number) => {
      window.clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => {
        if (lessonFromPath(window.location.pathname)?.slug === slug) maybeLessonTip(slug, Date.now());
      }, delay);
    };
    const off = onCompanionEvent((event) => {
      if (event.type === "lesson-opened") scheduleTip(event.slug, TIMING.tipDelayMs);
      else reactToEvent(event, Date.now());
    });
    // The page may have announced its lesson before the companion mounted (first load).
    const initial = lessonFromPath(window.location.pathname);
    if (initial) scheduleTip(initial.slug, TIMING.tipDelayMs + TIMING.greetingDelayMs);
    return () => {
      off();
      window.clearTimeout(tipTimer);
    };
  }, []);

  // Once per browser session: hello, or "continue where you left off".
  useEffect(() => {
    const id = window.setTimeout(() => maybeGreet(lessonRef.current, Date.now()), TIMING.greetingDelayMs);
    return () => window.clearTimeout(id);
  }, []);

  // Navigation closes the menu and plain bubbles (bubbles with buttons stay until answered).
  useEffect(() => {
    const s = useCompanionStore.getState();
    s.closeMenu();
    s.dismissPlain();
  }, [pathname]);

  // Inactivity: awake → sitting → (lamp, sometimes) → yawn → asleep; any meaningful activity wakes her.
  // The rules live in lib/companion/idle.ts; here, activity only stamps a time and one timeout re-arms itself.
  useEffect(() => {
    let last = Date.now();
    let asleepSince = 0;
    let timer = 0;
    /** The lamp gets one chance per idle stretch, so it stays occasional. */
    let lampTried = false;
    const arm = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, Math.max(250, ms));
    };
    const check = () => {
      timer = 0;
      const s = useCompanionStore.getState();
      const decision = idleStep(
        {
          idleMs: Date.now() - last,
          idleLevel: s.idleLevel,
          napping: s.napping,
          // Kept awake: the menu, a bubble waiting for an answer, a focus block, a modal dialog, a quiz or a text field in use.
          hold:
            s.menuOpen ||
            Boolean(s.bubble?.actions?.length) ||
            useFocusStore.getState().session?.phase === "focus" ||
            learnerEngaged(),
          // A routine (lamp, play, break play) owns her pose; the brain only wakes her on activity.
          routine: Boolean(s.activity),
          lampTried,
        },
        TIMING,
      );
      if (decision.tryLamp) {
        lampTried = true;
        if (!s.bubble && Math.random() < TIMING.lampChance && lampAllowedRef.current()) {
          s.setIdleLevel(1);
          s.startActivity("lamp", "idle");
          arm(TIMING.settleMs);
          return;
        }
      }
      if (decision.level !== null) {
        if (decision.fallAsleep) {
          // Drifting off: a big yawn first (the reaction outranks the sleeping pose until it expires).
          s.dismissPlain();
          if (animatedRef.current) s.react("yawning", YAWN_MS);
          asleepSince = Date.now();
        }
        s.setIdleLevel(decision.level);
      }
      if (decision.nextMs !== null) arm(decision.nextMs);
    };
    const onActivity = (e?: Event) => {
      const now = Date.now();
      last = now;
      lampTried = false;
      const s = useCompanionStore.getState();
      if (s.napping) return;
      // Asleep on her lamp, the mouse merely moving does not wake her (so the learner can reach her and carry her
      // away asleep); keys, scrolling, touch, a press anywhere and coming back to the tab still do.
      if (e?.type === "pointermove" && s.idleLevel === 2 && s.activity?.kind === "lamp") return;
      if (s.idleLevel === 2) {
        s.setIdleLevel(0);
        // On the lamp the routine plays its own wake-up (stretch, hop down); elsewhere a short stretch.
        if (s.activity?.kind !== "lamp" && animatedRef.current) s.react("stretching", WAKE_STRETCH_MS);
        maybeWelcomeBack(now - asleepSince, now);
      } else if (s.idleLevel === 1) {
        s.setIdleLevel(0);
      }
      if (!timer) arm(TIMING.settleMs);
    };
    // Coming back to the tab counts as activity: a returning learner finds her awake (or waking up).
    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility);
    arm(TIMING.settleMs);
    return () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity);
      window.removeEventListener("scroll", onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer);
    };
  }, []);

  // Short reactions expire on their own.
  const reaction = useCompanionStore((s) => s.reaction);
  useEffect(() => {
    if (!reaction) return;
    const id = window.setTimeout(
      () => useCompanionStore.getState().clearReaction(reaction.id),
      Math.max(0, reaction.until - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [reaction]);

  // Wardrobe: announce newly unlocked accessories once, shortly after the progress that earned them.
  useEffect(() => {
    let timer = 0;
    const run = () => {
      if (!announceUnlocks()) timer = window.setTimeout(run, 20_000);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 1500);
    };
    const offProgress = useProgressStore.subscribe(schedule);
    const offPrefs = usePreferencesStore.subscribe((state, prev) => {
      if (state.companion.stats !== prev.companion.stats) schedule();
    });
    timer = window.setTimeout(run, TIMING.greetingDelayMs + 2500);
    return () => {
      offProgress();
      offPrefs();
      window.clearTimeout(timer);
    };
  }, []);

  // Focus timer: load it, follow other tabs, and announce phase changes.
  useEffect(() => {
    ensureFocusHydrated();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.focus) syncFocusFromStorage();
    };
    window.addEventListener("storage", onStorage);
    const off = useFocusStore.subscribe((state, prev) => {
      if (state.lastEvent && state.lastEvent !== prev.lastEvent) reactToFocusEvent(state.lastEvent, Date.now());
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      off();
    };
  }, []);
}
