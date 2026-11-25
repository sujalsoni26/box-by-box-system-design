import { catMeows } from "@/data/cat-meows";
import { lessons, nextIncompleteLesson } from "@/lib/curriculum";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";
import { useCompanionStore, useFocusStore, type BubbleAction, type BubbleInput } from "@/stores/companion-store";
import type { Lesson } from "@/types/curriculum";
import { fill, line, LINES } from "./lines";
import { pickRevision, type RevisionSource } from "./lesson-context";

/*
 * What each menu item does. Plain functions over the stores, so they can run from click handlers
 * without re-rendering the companion. Everything here was asked for by the learner (solicited).
 */

const ask = (input: BubbleInput) => useCompanionStore.getState().say({ solicited: true, focus: true, ...input });
const lessonHref = (l: Lesson) => `/learn/${l.slug}`;
const label = (l: Lesson) => `${l.number} ${l.title}`;

function nextAfter(from?: string | null): Lesson | undefined {
  const { completed, lastVisited } = useProgressStore.getState();
  return nextIncompleteLesson(completed, from ?? lastVisited);
}

type LessonFeature = "explain";
const FEATURE_TEXT: Record<LessonFeature, string> = {
  explain: "explain it simply",
};

/** Off lesson pages: say what the item needs and offer the next lesson instead. */
export function needLesson(feature: LessonFeature): void {
  const next = nextAfter();
  const actions: BubbleAction[] = next
    ? [{ label: `Open ${next.title}`, href: lessonHref(next), primary: true }, { label: "Later" }]
    : [{ label: "Browse lessons", href: "/learn", primary: true }, { label: "Later" }];
  ask({
    title: "Open a lesson first",
    text: `I can ${FEATURE_TEXT[feature]} once you are on a lesson page.${next ? ` Next up for you: ${label(next)}.` : ""}`,
    actions,
    mood: "thinking",
  });
}

export function explainSimply(lesson?: Lesson): void {
  if (!lesson) return needLesson("explain");
  ask({
    title: `In plain words: ${lesson.title}`,
    text: lesson.explainSimply,
    actions: [{ label: "Got it", primary: true }],
    mood: "studying",
  });
}

const SOURCE_TEXT: Record<RevisionSource, string> = {
  completed: "a lesson you finished",
  visited: "a lesson you opened",
  start: "the start of the course",
};

let lastRevisionSlug: string | null = null;

export function quickRevision(): void {
  const { completed, visits } = useProgressStore.getState();
  const pick = pickRevision(completed, visits, lastRevisionSlug);
  if (!pick) {
    ask({ text: "No revision questions yet. Finish a lesson and ask me again.", ms: 4000, focus: false });
    return;
  }
  const { lesson, source } = pick;
  lastRevisionSlug = lesson.slug;
  ask({
    title: `Quick revision: ${lesson.title}`,
    text: lesson.recall.q,
    detailLabel: "From",
    detail: `${SOURCE_TEXT[source]} (${label(lesson)})`,
    actions: [
      { label: "Reveal answer", primary: true, onSelect: () => revealRevision(lesson) },
      { label: "Skip" },
    ],
    mood: "thinking",
  });
}

function revealRevision(lesson: Lesson): void {
  ask({
    title: `Quick revision: ${lesson.title}`,
    text: lesson.recall.q,
    detailLabel: "Answer",
    detail: lesson.recall.a,
    actions: [
      {
        label: "Knew it",
        primary: true,
        onSelect: () => {
          useCompanionStore.getState().react("happy", 1400);
        },
      },
      { label: "Review lesson", href: lessonHref(lesson) },
      { label: "Another", onSelect: quickRevision },
    ],
  });
}

export function suggestNext(current?: Lesson): void {
  const { completed } = useProgressStore.getState();
  const next = nextAfter(current?.slug);
  if (!next) {
    ask({
      title: "Every lesson learned",
      text: `You have finished all ${lessons.length} lessons. Lock it in with the Test yourself deck.`,
      actions: [{ label: "Test yourself", href: "/learn/test-yourself", primary: true }, { label: "Later" }],
      mood: "celebrating",
    });
    return;
  }
  if (current && next.slug === current.slug) {
    const after = nextIncompleteLesson({ ...completed, [current.slug]: 1 }, current.slug);
    ask({
      title: "Next up",
      text: `Finish this one first: ${current.title}.${after ? ` After that, ${label(after)} (${after.minutes} min).` : " It is the last one left."}`,
      actions: after
        ? [{ label: `Preview ${after.title}`, href: lessonHref(after) }, { label: "Keep reading", primary: true }]
        : [{ label: "Keep reading", primary: true }],
      mood: "happy",
    });
    return;
  }
  ask({
    title: "Next up",
    text: `${label(next)} (${next.minutes} min). ${next.problem}`,
    actions: [{ label: `Open ${next.title}`, href: lessonHref(next), primary: true }, { label: "Later" }],
    mood: "happy",
  });
}

export function toggleFocus(): void {
  const focus = useFocusStore.getState();
  const say = useCompanionStore.getState().say;
  if (focus.session) {
    focus.stop();
    say({ text: line("focusStop"), mood: "happy", ms: 3000, solicited: true });
    return;
  }
  focus.start(Date.now());
  say({ title: "Focus timer", text: fill(line("focusStart"), { min: focus.focusMinutes }), mood: "studying", ms: 4500, solicited: true });
}

export function pauseFocus(): void {
  useFocusStore.getState().pause(Date.now());
  useCompanionStore.getState().say({ text: line("focusPaused"), mood: "sitting", ms: 2400, solicited: true });
}

export function resumeFocus(): void {
  useFocusStore.getState().resume(Date.now());
  useCompanionStore.getState().say({ text: line("focusResumed"), mood: "studying", ms: 2400, solicited: true });
}

/** Pause or resume the occasional facts about the open lesson (persisted). */
export function toggleTopicMeows(): void {
  const prefs = usePreferencesStore.getState();
  const on = !prefs.companion.topicMeows;
  prefs.setCompanion({ topicMeows: on });
  ask({ text: on ? LINES.topicResumed : LINES.topicPaused, ms: 3600, focus: false });
}

export function hideCompanion(): void {
  useCompanionStore.getState().closeMenu();
  useCompanionStore.getState().dismiss();
  usePreferencesStore.getState().setCompanion({ enabled: false });
}

/* ------------------------------------------------------------------ play with Cache */

/** The topic line in meow-speak on a lesson page; a generic cute line elsewhere. */
export function meowLine(lesson?: Lesson): string {
  return (lesson && catMeows[lesson.slug]) || line("meowGeneric");
}

export function meowAboutTopic(lesson?: Lesson): void {
  ask({
    title: lesson ? `Meow: ${lesson.title}` : "Meow",
    text: meowLine(lesson),
    actions: [{ label: "Purr", primary: true }],
    mood: "happy",
  });
}

function wakeIfNapping(): void {
  const s = useCompanionStore.getState();
  if (s.napping) s.setNapping(false);
}

let feedTimer = 0;
/** How long the fish lasts: it drops into her paws, two bites, then the bones (see FishSnack in pixel-cat). */
export const EATING_MS = 2400;

/**
 * A fish drops into her paws, she nibbles it down to the bones, then a happy "nom". Play stops first (she sits
 * to eat); on the lamp she wakes and eats there.
 */
export function feedCache(): void {
  wakeIfNapping();
  const s = useCompanionStore.getState();
  if (s.activity && s.activity.kind !== "lamp") s.endActivity(s.activity.id);
  usePreferencesStore.getState().bumpCompanionStat("feeds");
  s.dismiss();
  s.react("eating", EATING_MS);
  window.clearTimeout(feedTimer);
  feedTimer = window.setTimeout(() => {
    const c = useCompanionStore.getState();
    c.react("happy", 1600);
    c.say({ text: line("nom"), mood: "happy", ms: 3000, solicited: true });
  }, EATING_MS);
}

let petCount = 0;

/** Hearts and a purr. `speak` adds a line (menu pet); hover-petting stays silent. */
export function petCache(lesson?: Lesson, speak = true): void {
  wakeIfNapping();
  const s = useCompanionStore.getState();
  usePreferencesStore.getState().bumpCompanionStat("pets");
  s.react("purring", 1900);
  if (!speak) return;
  // Mostly purrs; every third pet on a lesson page, the topic meow instead.
  petCount += 1;
  const text = lesson && catMeows[lesson.slug] && petCount % 3 === 0 ? catMeows[lesson.slug] : line("pet");
  s.say({ text, mood: "purring", ms: 4200, solicited: true });
}

/** Nap until woken from the menu, by a tap or by a pet; ordinary scrolling does not wake her. */
export function toggleNap(): void {
  const s = useCompanionStore.getState();
  if (s.activity?.kind === "lamp") {
    // On the lamp, "Wake up" lets the lamp routine play its own wake-up: stretch and hop down.
    s.wakeLamp();
    return;
  }
  if (s.napping) {
    s.setNapping(false);
    s.react("happy", 900);
    s.say({ text: line("wake"), mood: "happy", ms: 2600, solicited: true });
    return;
  }
  s.dismiss();
  s.setNapping(true);
  s.say({ text: line("napStart"), mood: "sleeping", ms: 3000, solicited: true });
}

/**
 * "Lamp nap" (where it fits, phones included; motion allowed): a lamp pops up a few steps away; she walks over, leaps on, settles and
 * sleeps until woken on purpose. The companion component plays it out (lamp.tsx).
 */
export function lampNap(): void {
  const s = useCompanionStore.getState();
  if (s.activity?.kind === "lamp") return;
  if (s.napping) s.setNapping(false);
  s.dismiss();
  s.startActivity("lamp", "menu");
  s.say({ text: line("lampNap"), mood: "happy", ms: 2600, solicited: true });
}

/** A yarn ball rolls along the floor; the companion component plays the chase (needs her position). */
export function playWithCache(): void {
  wakeIfNapping();
  usePreferencesStore.getState().bumpCompanionStat("plays");
  const s = useCompanionStore.getState();
  s.dismiss();
  s.startActivity("play");
}

export function openWardrobe(): void {
  useCompanionStore.getState().setMenuView("wardrobe");
}
