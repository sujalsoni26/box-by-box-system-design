"use client";
import { useEffect, useRef } from "react";
import { canActOnItsOwn, type BodyPhase } from "@/lib/companion/behaviour";
import { fill, line, LINES } from "@/lib/companion/lines";
import { pageIsBusy, trackWidgetInteractions } from "@/lib/companion/quiet";
import { canNudge, canRespond } from "@/lib/companion/reactions";
import { purrFor } from "@/lib/companion/sound";
import { markFactShown, nextFact } from "@/lib/companion/topic-facts";
import { TIMING } from "@/lib/companion/timing";
import { completeLesson } from "@/lib/learning/complete-lesson";
import { endInView, minReadFor, msUntilPrompt, promptEligible } from "@/lib/learning/lesson-end";
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

/**
 * The companion is free and the page is quiet: safe to speak without being asked.
 * `forPrompt` (the completion prompt) tolerates a knowledge check merely being on screen (it sits right above
 * the end of the lesson) and break-time play (a focus break is a natural moment to finish a lesson).
 */
function quietMoment(getPhase: () => BodyPhase, forPrompt = false): boolean {
  const s = useCompanionStore.getState();
  const routine = Boolean(s.activity) && !(forPrompt && s.activity?.kind === "break-play");
  return (
    canActOnItsOwn({
      phase: forPrompt && s.activity?.kind === "break-play" ? "resting" : getPhase(),
      menuOpen: s.menuOpen,
      bubble: Boolean(s.bubble),
      routine,
      focusRunning: useFocusStore.getState().session?.phase === "focus",
      pageVisible: document.visibilityState === "visible",
    }) &&
    !s.napping &&
    s.idleLevel !== 2 &&
    !pageIsBusy(Date.now(), { allowVisibleChecks: forPrompt })
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
      purrFor("meows");
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
 * At the end of a lesson, ask once whether to mark it learned, with three explicit answers: "Mark as learned",
 * "Review later" (flags it for review, does not complete it) and "Not yet". Rules in lib/learning/lesson-end.ts.
 *
 * Detection is robust to client navigation, re-renders and responsive layouts:
 * - it watches only this lesson's marker (`[data-lesson-end="<slug>"]`), so a marker left over from the
 *   previous page can never be matched;
 * - a MutationObserver (throttled to one check per frame) re-finds the marker when it mounts late or is
 *   replaced, and the IntersectionObserver follows layout changes (tall pages, wrapping rows, content that grows);
 * - the end must stay in view for the dwell, after a plausible reading time; if Cache is busy at that moment
 *   (another bubble, a drag, the menu, a focus block) it tries again a few seconds later while the end is in view.
 * It never asks about a learned lesson, never twice (`completionAsked`, persisted), and withdraws the question if
 * the lesson gets marked by hand or the learner leaves the lesson.
 */
export function useCompletionPrompt({ lesson, getPhase }: RoutineOptions) {
  const slug = lesson?.slug;
  const minutes = lesson?.minutes ?? 5;
  const title = lesson?.title;
  const tipsOn = usePreferencesStore((s) => s.companion.studyTips);

  useEffect(() => {
    if (!slug) return;
    const eligible = () =>
      promptEligible({
        tipsOn: usePreferencesStore.getState().companion.studyTips,
        completed: Boolean(useProgressStore.getState().completed[slug]),
        asked: Boolean(usePreferencesStore.getState().companion.completionAsked[slug]),
      });
    if (!eligible()) return;

    const openedAt = Date.now();
    const minRead = minReadFor(minutes, { dwellMs: TIMING.completionDwellMs, minReadMs: TIMING.completionMinReadMs, maxReadMs: TIMING.completionMaxReadMs });
    let visibleSince = 0;
    let timer = 0;
    let raf = 0;
    let done = false;
    let promptId = 0;
    let target: Element | null = null;
    let io: IntersectionObserver | null = null;

    const stop = () => {
      done = true;
      window.clearTimeout(timer);
      io?.disconnect();
      mo.disconnect();
    };

    const ask = () => {
      stop();
      usePreferencesStore.getState().markCompletionAsked(slug);
      const later = (text: string) => useCompanionStore.getState().say({ text, ms: 3800, solicited: true });
      promptId = useCompanionStore.getState().say({
        title: "Finished?",
        text: fill(line("completionAsk"), { title: title ?? "this lesson" }),
        mood: "happy",
        actions: [
          { label: "Mark as learned", primary: true, onSelect: () => void completeLesson(slug) },
          {
            label: "Review later",
            onSelect: () => {
              useProgressStore.getState().setReview(slug, true);
              later(line("completionReview"));
            },
          },
          { label: "Not yet", onSelect: () => later(line("completionLater")) },
        ],
      });
    };

    const attempt = () => {
      window.clearTimeout(timer);
      if (done || !visibleSince) return;
      if (!eligible()) return stop();
      const wait = msUntilPrompt(Date.now(), openedAt, visibleSince, minRead, TIMING.completionDwellMs);
      if (wait > 0) {
        timer = window.setTimeout(attempt, wait);
        return;
      }
      // Busy right now (another bubble, the menu, a drag, focus mode): try again shortly while the end is in view.
      if (!quietMoment(getPhase, true) || !canRespond()) {
        timer = window.setTimeout(attempt, 3_000);
        return;
      }
      ask();
    };

    const observe = (el: Element) => {
      io?.disconnect();
      target = el;
      visibleSince = 0;
      io = new IntersectionObserver(
        (entries) => {
          const e = entries[entries.length - 1];
          const inView = endInView({
            isIntersecting: e.isIntersecting,
            ratio: e.intersectionRatio,
            visibleHeight: e.intersectionRect.height,
            targetHeight: e.boundingClientRect.height,
            viewportHeight: window.innerHeight,
          });
          if (inView && !visibleSince) visibleSince = Date.now();
          if (!inView) {
            visibleSince = 0;
            window.clearTimeout(timer);
          }
          attempt();
        },
        { threshold: [0, 0.1, 0.25, 0.4, 0.5, 0.75, 1] },
      );
      io.observe(el);
    };

    const selector = `[data-lesson-end="${slug.replace(/["\\]/g, "")}"]`;
    const sync = () => {
      raf = 0;
      if (done) return;
      const el = document.querySelector(selector);
      if (el && el !== target) observe(el);
      else if (!el && target) {
        io?.disconnect();
        target = null;
        visibleSince = 0;
        window.clearTimeout(timer);
      }
    };
    const mo = new MutationObserver(() => {
      if (!raf) raf = requestAnimationFrame(sync);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    sync();

    // Learned by hand in the meantime: stop watching, and withdraw the question if it is still showing.
    const off = useProgressStore.subscribe((p) => {
      if (!p.completed[slug]) return;
      stop();
      if (promptId) useCompanionStore.getState().dismiss(promptId);
    });

    return () => {
      stop();
      if (raf) cancelAnimationFrame(raf);
      off();
      // Leaving the lesson: an unanswered question about it would be out of place on the next page.
      if (promptId) useCompanionStore.getState().dismiss(promptId);
    };
  }, [slug, minutes, title, tipsOn, getPhase]);
}
