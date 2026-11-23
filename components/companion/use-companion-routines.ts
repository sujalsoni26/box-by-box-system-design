"use client";
import { useEffect, useRef } from "react";
import { canActOnItsOwn, type BodyPhase } from "@/lib/companion/behaviour";
import { fill, line, LINES } from "@/lib/companion/lines";
import { pageIsBusy, trackWidgetInteractions } from "@/lib/companion/quiet";
import { canNudge, canRespond } from "@/lib/companion/reactions";
import { markFactShown, nextFact } from "@/lib/companion/topic-facts";
import { TIMING } from "@/lib/companion/timing";
import { completeLesson } from "@/lib/learning/complete-lesson";
import { useCompanionStore, useFocusStore } from "@/stores/companion-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";
import type { Lesson } from "@/types/curriculum";

interface RoutineOptions {
  lesson?: Lesson;
  /** Phones and tablets: unprompted bubbles would cover the lesson text. */
  compact: boolean;
  getPhase: () => BodyPhase;
}

/** The companion is free and the page is quiet: safe to speak without being asked. */
function quietMoment(getPhase: () => BodyPhase): boolean {
  const s = useCompanionStore.getState();
  return (
    canActOnItsOwn({
      phase: getPhase(),
      menuOpen: s.menuOpen,
      bubble: Boolean(s.bubble),
      routine: Boolean(s.activity),
      focusRunning: useFocusStore.getState().session?.phase === "focus",
      pageVisible: document.visibilityState === "visible",
    }) &&
    !s.napping &&
    s.idleLevel !== 2 &&
    !pageIsBusy()
  );
}

/**
 * Topic meows: now and then, a short fact from the open lesson (see lib/companion/topic-facts.ts).
 * Desktop only, at most `topicMax` per visit, never repeating a fact in the session, inside the shared
 * nudge budget. Paused during focus blocks, quizzes, dialogs, typing, a hidden tab, drags and menus,
 * and whenever the learner pauses topic meows or turns study tips off. One timer, re-armed.
 */
export function useTopicMeows({ lesson, compact, getPhase }: RoutineOptions) {
  const enabled = usePreferencesStore((s) => s.companion.topicMeows && s.companion.studyTips);
  const slug = lesson?.slug;
  const lessonRef = useRef(lesson);
  useEffect(() => {
    lessonRef.current = lesson;
  });

  useEffect(() => trackWidgetInteractions(), []);

  useEffect(() => {
    if (!slug || !enabled || compact) return;
    let timer = 0;
    let shown = 0;
    const arm = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(attempt, ms);
    };
    const attempt = () => {
      const current = lessonRef.current;
      if (!current || current.slug !== slug || shown >= TIMING.topicMax) return;
      const now = Date.now();
      if (!quietMoment(getPhase) || !canNudge(now)) {
        arm(20_000); // try again shortly; nothing is queued
        return;
      }
      const fact = nextFact(current, document);
      if (!fact) return; // every fact for this lesson already shown this session
      shown += 1;
      markFactShown(slug, fact.key);
      useCompanionStore.getState().say({
        title: `Meow fact · ${fact.title}`,
        text: fact.text,
        mood: "happy",
        ms: Math.min(12_000, 4_500 + fact.text.length * 45),
        actions: [
          {
            label: "Pause topic meows",
            onSelect: () => {
              usePreferencesStore.getState().setCompanion({ topicMeows: false });
              useCompanionStore.getState().say({ text: LINES.topicPaused, ms: 3200, solicited: true });
            },
          },
          { label: "Nice", primary: true },
        ],
      });
      arm(TIMING.topicIntervalMs + Math.random() * TIMING.topicJitterMs);
    };
    arm(TIMING.topicFirstMs + Math.random() * 15_000);
    return () => window.clearTimeout(timer);
  }, [slug, enabled, compact, getPhase]);
}

/**
 * At the end of a lesson, ask once whether to mark it learned. Explicit confirmation only; never for a
 * learned lesson; never twice for the same lesson (persisted); only after the end has stayed in view for a
 * moment and the learner has spent a plausible time on the page.
 */
export function useCompletionPrompt({ lesson, getPhase }: RoutineOptions) {
  const slug = lesson?.slug;
  const minutes = lesson?.minutes ?? 5;
  const tipsOn = usePreferencesStore((s) => s.companion.studyTips);

  useEffect(() => {
    if (!slug || !tipsOn) return;
    const eligible = () =>
      !useProgressStore.getState().completed[slug] && !usePreferencesStore.getState().companion.completionAsked[slug];
    if (!eligible()) return;

    const openedAt = Date.now();
    const minRead = Math.min(TIMING.completionMaxReadMs, Math.max(TIMING.completionMinReadMs, minutes * 60_000 * 0.25));
    let visible = false;
    let timer = 0;
    let observer: IntersectionObserver | null = null;
    let findTimer = 0;
    let done = false;

    const ask = () => {
      done = true;
      const title = lesson?.title ?? "this lesson";
      usePreferencesStore.getState().markCompletionAsked(slug);
      useCompanionStore.getState().say({
        title: "Finished?",
        text: fill(line("completionAsk"), { title }),
        mood: "happy",
        actions: [
          {
            label: "Mark as learned",
            primary: true,
            onSelect: () => {
              completeLesson(slug);
            },
          },
          {
            label: "Not yet",
            onSelect: () => useCompanionStore.getState().say({ text: line("completionLater"), ms: 3800, solicited: true }),
          },
        ],
      });
      observer?.disconnect();
    };

    const check = () => {
      window.clearTimeout(timer);
      if (done || !visible) return;
      if (!eligible()) {
        done = true;
        observer?.disconnect();
        return;
      }
      const wait = Math.max(TIMING.completionDwellMs, openedAt + minRead - Date.now());
      timer = window.setTimeout(() => {
        if (done || !visible || !eligible()) return;
        // Answering something else, in focus mode, or mid-drag: try again in a little while.
        if (!quietMoment(getPhase) || !canRespond()) {
          timer = window.setTimeout(check, 4_000);
          return;
        }
        ask();
      }, wait);
    };

    // The end marker is part of the lesson layout; it can mount a moment after the companion.
    let tries = 0;
    const attach = () => {
      const end = document.querySelector("[data-lesson-end]");
      if (!end) {
        if (tries++ < 10) findTimer = window.setTimeout(attach, 500);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) check();
          else window.clearTimeout(timer);
        },
        { threshold: 0.6 },
      );
      observer.observe(end);
    };
    attach();

    // Learned by hand in the meantime: stop watching.
    const off = useProgressStore.subscribe((s) => {
      if (s.completed[slug]) {
        done = true;
        window.clearTimeout(timer);
        observer?.disconnect();
      }
    });

    return () => {
      done = true;
      window.clearTimeout(timer);
      window.clearTimeout(findTimer);
      observer?.disconnect();
      off();
    };
  }, [slug, minutes, tipsOn, getPhase, lesson?.title]);
}
