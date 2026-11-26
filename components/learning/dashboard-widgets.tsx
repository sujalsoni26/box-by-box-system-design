"use client";
import Link from "next/link";
import { ArrowRight, Bookmark, Check, Flag, History, Sparkles } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { LevelChip } from "@/components/ui/chip";
import { ProgressBar, ProgressRing } from "@/components/ui/progress-bar";
import { getLesson, getModule, lessons, modules, moduleProgress, nextIncompleteLesson, overallProgress, lessonHref } from "@/lib/curriculum";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/stores/progress-store";

function useCompleted() {
  const hydrated = useHydrated();
  const completed = useProgressStore((s) => s.completed);
  return { hydrated, completed: hydrated ? completed : {} };
}

export function ContinueLearning() {
  const { hydrated, completed } = useCompleted();
  const lastVisited = useProgressStore((s) => s.lastVisited);
  const started = hydrated && (Object.keys(completed).length > 0 || Boolean(lastVisited));
  const next = nextIncompleteLesson(completed, hydrated ? lastVisited : null);
  const lesson = next ?? lessons[lessons.length - 1];
  const courseModule = getModule(lesson.moduleId);

  return (
    <section aria-labelledby="continue-h" className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow-lift)] sm:p-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-link">
        {!hydrated ? "Your next lesson" : !started ? "Start here" : next ? "Continue learning" : "Course complete"}
      </p>
      <h2 id="continue-h" className="mt-2 font-display text-[clamp(1.6rem,3.6vw,2.3rem)] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        <span className="mr-2 font-mono text-lg text-ink-3">{lesson.number}</span>
        {next || !hydrated ? lesson.title : "Every lesson learned"}
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {courseModule.number}. {courseModule.title} · {lesson.minutes} min
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-bad-soft px-4 py-3">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-bad">The problem</p>
          <p className="mt-0.5 text-[0.95rem] text-ink">{lesson.problem}</p>
        </div>
        <div className="rounded-xl bg-good-soft px-4 py-3">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-good">You will add</p>
          <p className="mt-0.5 text-[0.95rem] text-ink">{lesson.summary}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={next || !hydrated ? lessonHref(lesson.slug) : "/practice"} className={buttonClasses("primary", "lg")}>
          {!started ? "Start learning" : next ? "Continue" : "Practise"} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link href="/learn" className={buttonClasses("ghost", "lg")}>
          See the roadmap
        </Link>
      </div>
    </section>
  );
}

export function OverallProgressCard() {
  const { hydrated, completed } = useCompleted();
  const p = overallProgress(completed);
  const minutesLeft = lessons.filter((l) => !completed[l.slug]).reduce((s, l) => s + l.minutes, 0);
  const modulesDone = modules.filter((m) => moduleProgress(m.id, completed).fraction === 1).length;
  return (
    <section aria-labelledby="overall-h" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <h2 id="overall-h" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
        Overall progress
      </h2>
      <p className="font-display text-6xl font-extrabold tabular-nums tracking-[-0.03em] text-ink">
        {hydrated ? Math.round(p.fraction * 100) : 0}
        <span className="text-3xl text-ink-3">%</span>
      </p>
      <ProgressBar value={p.fraction} label="Overall progress" valueText={`${p.done} of ${p.total} lessons`} />
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Lessons", `${p.done}/${p.total}`],
          ["Modules", `${modulesDone}/${modules.length}`],
          ["Left", `${Math.round(minutesLeft / 6) / 10} h`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 px-2 py-2.5">
            <dt className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-ink-3">{k}</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-3">Module progress</h3>
      <ul className="flex flex-col gap-2.5">
        {modules.map((m) => {
          const mp = moduleProgress(m.id, completed);
          return (
            <li key={m.id}>
              <Link href={`/learn#${m.id}`} className="group block">
                <span className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold text-ink group-hover:text-link">
                    <span className="mr-1.5 font-mono text-xs text-ink-3">{m.number}</span>
                    {m.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-3">
                    {mp.done}/{mp.total}
                  </span>
                </span>
                <ProgressBar value={mp.fraction} label={`${m.title} progress`} size="sm" tone="good" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/progress" className="mt-auto pt-2 text-sm font-bold text-link underline underline-offset-2">
        Details and settings
      </Link>
    </section>
  );
}

/** Every module as a journey; the system grows from one server to a full architecture. */
export function RoadmapModules() {
  const { completed } = useCompleted();
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const p = moduleProgress(m.id, completed);
        const first = m.lessons.find((s) => !completed[s]) ?? m.lessons[0];
        return (
          <li key={m.id}>
            <Link
              href={lessonHref(first)}
              className={cn(
                "group flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
                p.fraction === 1 ? "border-good" : "border-line hover:border-accent",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">Module {m.number}</span>
                <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-ink-2">
                  {p.done}/{p.total}
                  <ProgressRing value={p.fraction} size={34} label={`${m.title} progress`} />
                </span>
              </div>
              <h3 className="font-display text-xl font-bold leading-tight text-ink group-hover:text-link">{m.title}</h3>
              <p className="text-sm text-ink-2">{m.description}</p>
              <p className="mt-auto font-mono text-xs text-amber-ink">Stage: {m.stage}</p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function RecentlyStudied() {
  const hydrated = useHydrated();
  const visits = useProgressStore((s) => s.visits);
  const completed = useProgressStore((s) => s.completed);
  const recent = hydrated
    ? Object.entries(visits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([slug]) => getLesson(slug))
        .filter((l): l is NonNullable<typeof l> => Boolean(l))
    : [];
  return (
    <section aria-labelledby="recent-h" className="rounded-3xl border border-line bg-surface p-6">
      <h2 id="recent-h" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <History aria-hidden="true" className="size-5 text-ink-3" /> Recently studied
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">Lessons you open will appear here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {recent.map((l) => (
            <li key={l.slug}>
              <Link href={lessonHref(l.slug)} className="flex items-center justify-between gap-3 py-2.5 text-[0.95rem] hover:text-link">
                <span className="min-w-0">
                  <span className="mr-1.5 font-mono text-xs text-ink-3">{l.number}</span>
                  {l.title}
                </span>
                {completed[l.slug] ? <span className="font-mono text-xs text-good">learned</span> : <LevelChip level={l.level} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BookmarkList({ empty = "Bookmark a lesson to keep it here." }: { empty?: string }) {
  const hydrated = useHydrated();
  const bookmarks = useProgressStore((s) => s.bookmarks);
  const items = hydrated ? bookmarks.map((s) => getLesson(s)).filter((l): l is NonNullable<typeof l> => Boolean(l)) : [];
  return (
    <section aria-labelledby="bookmarks-h" className="rounded-3xl border border-line bg-surface p-6">
      <h2 id="bookmarks-h" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Bookmark aria-hidden="true" className="size-5 text-amber-ink" /> Bookmarks
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((l) => (
            <li key={l.slug}>
              <Link href={lessonHref(l.slug)} className="block py-2.5 text-[0.95rem] hover:text-link">
                <span className="mr-1.5 font-mono text-xs text-ink-3">{l.number}</span>
                {l.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Topics the learner flagged with "Review later", newest first. Independent of completion.
 * `practiceSlugs` (case-study exercises) is passed from the server so the exercise data
 * stays out of this client bundle.
 */
export function ReviewList({ limit, practiceSlugs = [] }: { limit?: number; practiceSlugs?: string[] }) {
  const hydrated = useHydrated();
  const review = useProgressStore((s) => s.review);
  const completed = useProgressStore((s) => s.completed);
  const setReview = useProgressStore((s) => s.setReview);
  const all = hydrated
    ? Object.entries(review)
        .sort((a, b) => b[1] - a[1])
        .map(([slug]) => getLesson(slug))
        .filter((l): l is NonNullable<typeof l> => Boolean(l))
    : [];
  const items = limit ? all.slice(0, limit) : all;
  const practice = new Set(practiceSlugs);
  return (
    <section id="review" aria-labelledby="review-h" className="scroll-mt-24 rounded-3xl border border-line bg-surface p-6">
      <h2 id="review-h" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Flag aria-hidden="true" className="size-5 fill-current text-review" /> Marked for review
        {all.length > 0 ? <span className="font-mono text-sm font-semibold tabular-nums text-ink-3">{all.length}</span> : null}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">
          Use <span className="font-semibold text-ink-2">Review later</span> on a lesson or case study to collect the topics you want to revisit.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((l) => (
            <li key={l.slug} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link href={lessonHref(l.slug)} className="block text-[0.95rem] hover:text-link">
                  <span className="mr-1.5 font-mono text-xs text-ink-3">{l.number}</span>
                  {l.title}
                </Link>
                <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[0.7rem] text-ink-3">
                  {completed[l.slug] ? <span className="text-good">learned</span> : <span>not learned yet</span>}
                  {practice.has(l.slug) ? (
                    <Link href={`/case-studies/${l.slug}`} className="font-semibold text-link hover:underline">
                      practise the case
                    </Link>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReview(l.slug, false)}
                aria-label={`Done reviewing ${l.title}`}
                title="Done reviewing"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-ink-3 transition-colors hover:border-good hover:text-good"
              >
                <Check aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {limit && all.length > limit ? (
        <Link href="/progress#review" className="mt-3 inline-block text-sm font-bold text-link underline underline-offset-2">
          See all {all.length}
        </Link>
      ) : null}
    </section>
  );
}

export function PracticeTeaser() {
  return (
    <section aria-labelledby="practice-h" className="rounded-3xl border border-line bg-surface p-6">
      <h2 id="practice-h" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Sparkles aria-hidden="true" className="size-5 text-violet" /> Practice
      </h2>
      <p className="mt-2 text-sm text-ink-2">Knowledge checks, flashcards, an estimation calculator and the architecture exercise.</p>
      <Link href="/practice" className={cn(buttonClasses("secondary", "sm"), "mt-4")}>
        Open practice
      </Link>
    </section>
  );
}
