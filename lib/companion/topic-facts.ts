import { catMeows } from "@/data/cat-meows";
import { glossary } from "@/data/glossary";
import type { Lesson } from "@/types/curriculum";

/*
 * Short facts for "topic meows", taken only from what the open lesson already says. Nothing is
 * generated or paraphrased beyond trimming, so Cache can never state something the course does not:
 * 1. sentences the author highlighted with <mark> in the lesson body (read from the page);
 * 2. glossary terms this lesson defines (data/glossary.json, lessonSlug === lesson);
 * 3. the lesson's own one-line building block and trade-off (data/curriculum.ts, data/lesson-guides.ts);
 * 4. its meow-speak line (data/cat-meows.ts), as the occasional playful one.
 */

export interface TopicFact {
  /** Stable per lesson, for "already shown" bookkeeping. */
  key: string;
  title: string;
  text: string;
}

const MIN_MARK = 24;
const MAX_MARK = 200;

function tidy(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?:)]$/.test(first) ? first : `${first}.`;
}

/** Highlighted sentences in the lesson article (client only). */
function markedSentences(root: ParentNode | null | undefined): string[] {
  if (!root) return [];
  const out: string[] = [];
  root.querySelectorAll("article mark").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < MIN_MARK || text.length > MAX_MARK || text.split(" ").length < 4) return;
    out.push(tidy(text));
  });
  return out;
}

export function lessonFacts(lesson: Lesson, root?: ParentNode | null): TopicFact[] {
  const facts: TopicFact[] = [];
  for (const text of markedSentences(root)) facts.push({ key: `mark:${text.slice(0, 48)}`, title: "Key point", text });
  for (const e of glossary) {
    if (e.lessonSlug !== lesson.slug) continue;
    facts.push({ key: `term:${e.term}`, title: `Short form: ${e.term}`, text: tidy(`${e.term} stands for ${e.full}. ${e.note}`) });
  }
  if (lesson.summary) facts.push({ key: "fix", title: "The building block", text: tidy(lesson.summary) });
  if (lesson.tradeoffs) facts.push({ key: "tradeoff", title: "Trade-off", text: tidy(lesson.tradeoffs) });
  const meow = catMeows[lesson.slug];
  if (meow) facts.push({ key: "meow", title: "Meow", text: meow });
  const seen = new Set<string>();
  return facts.filter((f) => {
    const k = f.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ shown-facts memory (session) */

const SEEN_KEY = "sdn-topic-facts-seen";

function readSeen(): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** The next fact not shown in this browser session (marks first, then terms, then summary lines). */
export function nextFact(lesson: Lesson, root?: ParentNode | null): TopicFact | null {
  const seen = new Set(readSeen()[lesson.slug] ?? []);
  return lessonFacts(lesson, root).find((f) => !seen.has(f.key)) ?? null;
}

export function markFactShown(slug: string, key: string): void {
  try {
    const all = readSeen();
    all[slug] = Array.from(new Set([...(all[slug] ?? []), key])).slice(-40);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the in-visit limit still prevents repeats.
  }
}
