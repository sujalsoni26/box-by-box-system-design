import { catMeows } from "@/data/cat-meows";
import { getLesson, getModule, lessons, nextIncompleteLesson, overallProgress } from "@/lib/curriculum";
import { formatPercent } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";
import { useCompanionStore, useFocusStore, type BubbleAction, type FocusEvent } from "@/stores/companion-store";
import type { AccessoryId, CompanionEvent } from "@/types/companion";
import { ACCESSORIES, getAccessory, rewardContext, unlockedIds } from "./accessories";
import { fill, line, LINES } from "./lines";
import { markFactShown } from "./topic-facts";
import { companionBlip } from "./sound";
import { TIMING } from "./timing";

/*
 * How Cache reacts to app events. Rules of thumb:
 * - The pose always reacts (briefly); speech is rarer.
 * - During a focus block Cache stays quiet: poses only, no bubbles.
 * - Unsolicited tips respect the Study tips setting and a shared rate limit.
 */

const companion = () => useCompanionStore.getState();
const focusActive = () => useFocusStore.getState().session?.phase === "focus";

/** May Cache speak in response to something the learner just did? */
export function canRespond(): boolean {
  const s = companion();
  if (focusActive() || s.menuOpen) return false;
  // Never replace a bubble the learner is still using (one with buttons).
  return !s.bubble?.actions?.length;
}

/** Phones and tablets: a bubble there would sit on top of the lesson text. */
function isCompactViewport(): boolean {
  return window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;
}

/**
 * May Cache volunteer a tip or nudge right now? On compact screens only the once-per-session
 * greeting (ignoreGap) may appear unprompted; everything else waits until the learner taps Cache.
 */
export function canNudge(now: number, ignoreGap = false): boolean {
  if (!usePreferencesStore.getState().companion.studyTips) return false;
  if (!ignoreGap && isCompactViewport()) return false;
  if (!canRespond() || document.visibilityState !== "visible") return false;
  const s = companion();
  if (s.bubble || s.idleLevel === 2) return false;
  return ignoreGap || now - s.lastNudgeAt >= TIMING.nudgeGapMs;
}

let lastQuizBubbleAt = 0;
let lastDiagramAt = 0;
let lastReviewBubbleAt = 0;

export function reactToEvent(event: CompanionEvent, now: number): void {
  const s = companion();
  switch (event.type) {
    case "lesson-complete": {
      const { completed } = useProgressStore.getState();
      const lesson = getLesson(event.slug);
      const next = nextIncompleteLesson(completed, event.slug);
      if (event.courseCompleted) {
        s.react("celebrating", 3200);
        companionBlip("chime");
        if (canRespond())
          s.say({
            title: "Course complete",
            text: `All ${lessons.length} lessons learned. You grew the whole system, box by box. Lock it in with the Test yourself deck.`,
            actions: [{ label: "Test yourself", href: "/learn/test-yourself", primary: true }, { label: "Yay" }],
            mood: "celebrating",
            solicited: true,
          });
        return;
      }
      if (event.moduleCompleted && lesson) {
        const m = getModule(lesson.moduleId);
        s.react("celebrating", 2800);
        companionBlip("chime");
        const actions: BubbleAction[] = next
          ? [{ label: `Next: ${next.title}`, href: `/learn/${next.slug}`, primary: true }, { label: "Later" }]
          : [{ label: "Nice" }];
        if (canRespond())
          s.say({
            title: `Module ${m.number} complete`,
            text: `${m.title} is in your toolkit. Good moment for a stretch before the next module.`,
            actions,
            mood: "celebrating",
            solicited: true,
          });
        return;
      }
      s.react("happy", 1800);
      companionBlip("happy");
      if (!canRespond()) return;
      const { done, total, fraction } = overallProgress(completed);
      const praise = fill(line("lessonDone"), { done, total, left: total - done, pct: formatPercent(fraction) });
      s.say({ text: next ? `${praise} Next up: ${next.number} ${next.title}.` : praise, mood: "happy", solicited: true });
      return;
    }

    case "quiz-answer": {
      s.react(event.correct ? "happy" : "thinking", event.correct ? 1300 : 1700);
      companionBlip(event.correct ? "happy" : "soft");
      if (!canRespond() || now - lastQuizBubbleAt < TIMING.quizBubbleGapMs) return;
      // Encourage after every miss (rate-limited); praise only some of the time.
      if (!event.correct || Math.random() < 0.4) {
        lastQuizBubbleAt = now;
        s.say({ text: line(event.correct ? "correct" : "incorrect"), ms: event.correct ? 2200 : 4200, solicited: true });
      }
      return;
    }

    case "quiz-finished": {
      const ratio = event.total ? event.score / event.total : 0;
      const perfect = event.total > 0 && event.score === event.total;
      s.react(perfect ? "celebrating" : ratio >= 0.6 ? "happy" : "thinking", perfect ? 2600 : 2000);
      if (perfect) companionBlip("happy");
      if (!canRespond()) return;
      lastQuizBubbleAt = now;
      const template = perfect ? LINES.quizPerfect : ratio >= 0.6 ? LINES.quizGood : LINES.quizLow;
      s.say({ text: fill(template, { score: event.score, total: event.total }), ms: 5000, solicited: true });
      return;
    }

    case "diagram": {
      if (now - lastDiagramAt < TIMING.diagramGapMs) return;
      lastDiagramAt = now;
      s.react(event.mood, 1600);
      if (event.message && canNudge(now)) s.say({ text: event.message, mood: event.mood, ms: 4500 });
      return;
    }

    case "review-marked": {
      s.react(event.marked ? "thinking" : "happy", 1200);
      // A direct response to the learner, but not every time: flags often come in bursts.
      if (!canRespond() || now - lastReviewBubbleAt < TIMING.reviewBubbleGapMs) return;
      lastReviewBubbleAt = now;
      s.say({ text: line(event.marked ? "reviewMarked" : "reviewCleared"), mood: event.marked ? "thinking" : "happy", ms: 2800, solicited: true });
      return;
    }

    case "lesson-opened":
      // Tips are scheduled by the companion (they need a delay that is cancelled on navigation).
      return;
  }
}

const tipsShown = new Set<string>();
let meowNext = false;

const isDesktop = () =>
  typeof window !== "undefined" && !window.matchMedia("(pointer: coarse), (max-width: 640px)").matches;

/**
 * When a lesson opens (desktop only): its tip or its meow line, alternating, once per lesson per
 * page load, within the shared nudge budget.
 */
export function maybeLessonTip(slug: string, now: number): void {
  if (tipsShown.has(slug) || !isDesktop() || !canNudge(now)) return;
  const lesson = getLesson(slug);
  if (!lesson) return;
  const meow = catMeows[slug];
  const useMeow = Boolean(meow) && (meowNext || !lesson.catTip);
  const text = useMeow ? meow : lesson.catTip;
  if (!text) return;
  tipsShown.add(slug);
  meowNext = !useMeow;
  // The meow line is also a topic meow; do not repeat it later in this visit.
  if (useMeow) markFactShown(slug, "meow");
  companion().say({ title: useMeow ? "Meow" : "Tip", text, mood: "happy" });
}

/* ------------------------------------------------------------------ wardrobe unlocks */

/** Accessories unlocked by stored progress that have not been announced yet. */
export function pendingUnlocks(): AccessoryId[] {
  const p = useProgressStore.getState();
  const prefs = usePreferencesStore.getState().companion;
  const ctx = rewardContext(p, prefs.stats);
  const announced = new Set(prefs.announced);
  return unlockedIds(ctx).filter((id) => !announced.has(id));
}

/**
 * Announce new accessories once (ids are persisted as announced), with a small celebration and a
 * "Wear it" action. Returns false when now is not a good moment (try again later).
 */
export function announceUnlocks(): boolean {
  const ids = pendingUnlocks();
  if (!ids.length) return true;
  if (!canRespond() || document.visibilityState !== "visible") return false;
  const prefs = usePreferencesStore.getState();
  prefs.markAccessoriesAnnounced(ids);
  const first = getAccessory(ids[0]);
  if (!first) return true;
  const s = companion();
  s.react("celebrating", 2400);
  companionBlip("chime");
  const wear = () => {
    usePreferencesStore.getState().equipAccessory(first.slot, first.id);
    useCompanionStore.getState().react("happy", 1400);
  };
  if (ids.length === 1) {
    s.say({
      title: `New accessory: ${first.name}`,
      text: `Unlocked: ${first.requirement.toLowerCase()}. Shall I wear it?`,
      actions: [{ label: "Wear it", primary: true, onSelect: wear }, { label: "Later" }],
      mood: "celebrating",
      solicited: true,
    });
    return true;
  }
  const names = ids.map((id) => ACCESSORIES.find((a) => a.id === id)?.name ?? id).join(", ");
  s.say({
    title: `${ids.length} new accessories`,
    text: `Unlocked: ${names}. Wear the ${first.name.toLowerCase()} now, or pick in the wardrobe.`,
    actions: [
      { label: "Wear it", primary: true, onSelect: wear },
      {
        label: "Wardrobe",
        onSelect: () => {
          const c = useCompanionStore.getState();
          c.openMenu();
          c.setMenuView("wardrobe");
        },
      },
      { label: "Later" },
    ],
    mood: "celebrating",
    solicited: true,
  });
  return true;
}

const GREETED_KEY = "sdn-companion-greeted";

function greetedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(GREETED_KEY)) return true;
    window.sessionStorage.setItem(GREETED_KEY, "1");
    return false;
  } catch {
    return false;
  }
}

/** Once per browser session: introduce Cache, or offer to continue where the learner left off. */
export function maybeGreet(currentSlug: string | undefined, now: number): void {
  if (!canNudge(now, true) || greetedThisSession()) return;
  const { completed, lastVisited, review } = useProgressStore.getState();
  const s = companion();
  if (!Object.keys(completed).length && !lastVisited) {
    s.say({ text: LINES.greetNew, actions: [{ label: "Nice to meet you", primary: true }], mood: "happy" });
    return;
  }
  // Topics marked for review get a gentle reminder in the greeting (with a shortcut to the list).
  const toReview = Object.keys(review ?? {}).length;
  const reviewText = toReview ? ` ${toReview === 1 ? line("reviewWaitingOne") : fill(line("reviewWaiting"), { n: toReview })}` : "";
  const reviewAction: BubbleAction[] = toReview ? [{ label: "Review list", href: "/progress#review" }] : [];
  const next = nextIncompleteLesson(completed, lastVisited);
  if (!next || next.slug === currentSlug) {
    s.say({
      text: `${line("greetStudying")}${reviewText}`,
      actions: toReview ? [...reviewAction, { label: "Later", primary: true }] : undefined,
      mood: "happy",
    });
    return;
  }
  s.say({
    text: `${line("greetBack")} Next up: ${next.number} ${next.title}.${reviewText}`,
    actions: [{ label: `Continue: ${next.title}`, href: `/learn/${next.slug}`, primary: true }, ...reviewAction, { label: "Later" }],
    mood: "happy",
  });
}

/** After a long nap: a quiet welcome back with a general tip. */
export function maybeWelcomeBack(napMs: number, now: number): void {
  if (napMs < TIMING.longNapMs || !canNudge(now)) return;
  companion().say({ title: "Welcome back", text: line("homeTips"), mood: "happy" });
}

/** Subtle notice when a focus block or break ends. */
export function reactToFocusEvent(event: FocusEvent, now: number): void {
  if (now - event.at > TIMING.focusEventFreshMs) return;
  const s = companion();
  const focus = useFocusStore.getState();
  companionBlip("chime");
  if (event.kind === "focus-done") {
    s.react("happy", 2200);
    s.say({
      title: "Focus block done",
      text: line("focusDone"),
      actions: [
        { label: "Skip break", onSelect: () => useFocusStore.getState().skip(Date.now()) },
        { label: "OK", primary: true },
      ],
      mood: "happy",
      solicited: true,
    });
    return;
  }
  s.react("happy", 1600);
  const { completed, lastVisited } = useProgressStore.getState();
  const next = nextIncompleteLesson(completed, lastVisited);
  const actions: BubbleAction[] = [{ label: `Start ${focus.focusMinutes} min`, primary: true, onSelect: () => useFocusStore.getState().start(Date.now()) }];
  if (next) actions.push({ label: `Open ${next.title}`, href: `/learn/${next.slug}` });
  actions.push({ label: "Later" });
  s.say({ title: "Break over", text: line("breakDone"), actions, mood: "happy", solicited: true });
}
