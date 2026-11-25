"use client";
import { useEffect } from "react";
import { motion } from "motion/react";
import { Bookmark, BookmarkCheck, Check, Flag } from "lucide-react";
import { emitCompanionEvent } from "@/lib/companion-events";
import { getModule, moduleProgress } from "@/lib/curriculum";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { completeLesson } from "@/lib/learning/complete-lesson";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/stores/progress-store";
import type { Lesson } from "@/types/curriculum";

/** Records the visit (for Continue Learning / Recently Studied) and tells the companion. */
export function LessonVisitTracker({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const visit = useProgressStore((s) => s.visit);
  const leave = useProgressStore((s) => s.leaveLesson);
  useEffect(() => {
    if (!hydrated) return;
    visit(slug);
    emitCompanionEvent({ type: "lesson-opened", slug });
    return () => leave();
  }, [hydrated, slug, visit, leave]);
  return null;
}

export function BookmarkButton({ slug, title }: { slug: string; title: string }) {
  const hydrated = useHydrated();
  const bookmarked = useProgressStore((s) => s.bookmarks.includes(slug));
  const toggle = useProgressStore((s) => s.toggleBookmark);
  const on = hydrated && bookmarked;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove bookmark from ${title}` : `Bookmark ${title}`}
      onClick={() => toggle(slug)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold transition-colors",
        on ? "border-transparent bg-amber-soft text-amber-ink" : "border-line text-ink-3 hover:text-ink",
      )}
    >
      {on ? <BookmarkCheck aria-hidden="true" className="size-3.5" /> : <Bookmark aria-hidden="true" className="size-3.5" />}
      {on ? "Bookmarked" : "Bookmark"}
    </button>
  );
}

/**
 * Marks a topic to come back to. Independent of "learned": a learner can finish a lesson
 * and still flag it, or flag one they have not finished.
 */
export function ReviewButton({ slug, title, size = "chip" }: { slug: string; title: string; size?: "chip" | "button" }) {
  const hydrated = useHydrated();
  const marked = useProgressStore((s) => Boolean(s.review[slug]));
  const on = hydrated && marked;
  const toggle = (id: string) => {
    useProgressStore.getState().toggleReview(id);
    emitCompanionEvent({ type: "review-marked", slug: id, marked: Boolean(useProgressStore.getState().review[id]) });
  };
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Mark ${title} for review`}
      onClick={() => toggle(slug)}
      disabled={!hydrated}
      className={cn(
        "inline-flex items-center transition-colors disabled:opacity-60",
        size === "chip"
          ? "gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold"
          : "gap-2 rounded-xl border-2 px-4 py-2.5 font-display text-[0.95rem] font-bold",
        on
          ? "border-transparent bg-review-soft text-review"
          : size === "chip"
            ? "border-line text-ink-3 hover:text-ink"
            : "border-line-strong bg-surface text-ink-2 hover:border-review hover:text-review",
      )}
    >
      <Flag aria-hidden="true" className={size === "chip" ? "size-3.5" : "size-4"} fill={on ? "currentColor" : "none"} />
      {on ? "Marked for review" : size === "chip" ? "Review later" : "Mark for review"}
    </button>
  );
}

export function CompletedChip({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const done = useProgressStore((s) => Boolean(s.completed[slug]));
  if (!hydrated || !done) return null;
  return (
    <span className="inline-flex animate-pop items-center gap-1 rounded-full bg-good-soft px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold text-good">
      <Check aria-hidden="true" className="size-3.5" /> Learned
    </span>
  );
}

export function MarkCompleteButton({ lesson }: { lesson: Lesson }) {
  const hydrated = useHydrated();
  const completed = useProgressStore((s) => s.completed);
  const done = Boolean(completed[lesson.slug]);
  const setCompleted = useProgressStore((s) => s.setCompleted);
  const courseModule = getModule(lesson.moduleId);
  const moduleDone = moduleProgress(lesson.moduleId, completed).done;

  const toggle = () => {
    if (done) setCompleted(lesson.slug, false);
    else completeLesson(lesson.slug);
  };

  const isDone = hydrated && done;
  return (
    // data-lesson-end: the companion watches this lesson's end (by slug) to ask, once, whether to mark it learned.
    <div id="mark-as-learned" data-toc="Mark as learned" data-toc-level="1" className="mt-10 flex scroll-mt-24 flex-wrap items-center gap-4" data-companion-avoid="" data-lesson-end={lesson.slug}>
      <motion.button
        type="button"
        onClick={toggle}
        aria-pressed={isDone}
        disabled={!hydrated}
        whileTap={{ scale: 0.97 }}
        className={cn(
          "inline-flex items-center gap-3 rounded-xl border-2 border-good px-5 py-3 font-display text-base font-bold transition-colors disabled:opacity-60",
          isDone ? "bg-good text-accent-ink" : "bg-surface text-good hover:bg-good-soft",
        )}
      >
        <span className="grid size-6 place-items-center rounded-md border-2 border-current">
          <motion.svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: isDone ? 1 : 0 }}
              transition={{ duration: 0.35 }}
            />
          </motion.svg>
        </span>
        {isDone ? "Learned" : "Mark as learned"}
      </motion.button>
      <ReviewButton slug={lesson.slug} title={lesson.title} size="button" />
      <p className="basis-full text-sm text-ink-3" aria-live="polite">
        {isDone
          ? `Saved. ${courseModule.title}: ${moduleDone} of ${courseModule.lessons.length} done.`
          : "Lights up this part of your architecture on the dashboard."}
      </p>
    </div>
  );
}
