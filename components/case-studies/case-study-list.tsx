"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Clock, Flag } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Chip, LevelChip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/stores/progress-store";
import type { CaseStudyTrack } from "@/types/case-study";
import type { Level } from "@/types/curriculum";

/** The fields a card needs; the full exercise (steps) stays on the detail page. */
export interface CaseStudyCard {
  slug: string;
  title: string;
  track: CaseStudyTrack;
  level: Level;
  minutes: number;
  scenario: string;
  focus: string;
  steps: number;
  number: string;
}

export interface CaseStudyGroup {
  id: CaseStudyTrack;
  title: string;
  blurb: string;
  method: { slug: string; title: string };
  cases: CaseStudyCard[];
}

type TrackFilter = "all" | CaseStudyTrack;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "hld", label: "High-level" },
  { value: "lld", label: "Low-level" },
] as const;

export function CaseStudyList({ groups }: { groups: CaseStudyGroup[] }) {
  const hydrated = useHydrated();
  const review = useProgressStore((s) => s.review);
  const completed = useProgressStore((s) => s.completed);
  const [track, setTrack] = useState<TrackFilter>("all");
  const [onlyReview, setOnlyReview] = useState(false);
  const marked = (slug: string) => hydrated && Boolean(review[slug]);
  const markedCount = groups.reduce((n, g) => n + g.cases.filter((c) => marked(c.slug)).length, 0);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<TrackFilter> label="Show case studies by track" options={FILTERS} value={track} onChange={setTrack} size="sm" />
        <button
          type="button"
          aria-pressed={onlyReview}
          onClick={() => setOnlyReview((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[0.76rem] font-bold transition-colors",
            onlyReview ? "border-transparent bg-review-soft text-review" : "border-line text-ink-2 hover:text-ink",
          )}
        >
          <Flag aria-hidden="true" className="size-3.5" fill={onlyReview ? "currentColor" : "none"} />
          Marked for review
          <span className="font-mono tabular-nums">{hydrated ? markedCount : 0}</span>
        </button>
      </div>

      {groups
        .filter((g) => track === "all" || g.id === track)
        .map((g) => {
          const cases = onlyReview ? g.cases.filter((c) => marked(c.slug)) : g.cases;
          return (
            <section key={g.id} aria-labelledby={`track-${g.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                <div>
                  <h2 id={`track-${g.id}`} className="font-display text-2xl font-bold text-ink">
                    {g.title} <span className="font-mono text-base font-semibold text-ink-3">{g.cases.length}</span>
                  </h2>
                  <p className="mt-1 max-w-2xl text-ink-2">{g.blurb}</p>
                </div>
                <Link href={`/learn/${g.method.slug}`} className="text-sm font-bold text-link underline underline-offset-2">
                  Method: {g.method.title}
                </Link>
              </div>
              {cases.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-line-strong px-5 py-6 text-sm text-ink-3">
                  No {g.title.toLowerCase()} case is marked for review yet. Use <span className="font-semibold text-ink-2">Review later</span> on a case to
                  collect it here.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {cases.map((c) => {
                    const isMarked = marked(c.slug);
                    const done = hydrated && Boolean(completed[c.slug]);
                    return (
                      <li
                        key={c.slug}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition-colors",
                          isMarked ? "border-review/60" : "border-line",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <LevelChip level={c.level} />
                          <span className="inline-flex items-center gap-1 font-mono text-[0.72rem] text-ink-3">
                            <Clock aria-hidden="true" className="size-3.5" /> {c.minutes} min · {c.steps} steps
                          </span>
                          <span className="ml-auto flex items-center gap-1.5">
                            {isMarked ? (
                              <Chip tone="review">
                                <Flag aria-hidden="true" className="size-3 fill-current" /> Review
                              </Chip>
                            ) : null}
                            {done ? (
                              <Chip tone="good">
                                <Check aria-hidden="true" className="size-3" /> Learned
                              </Chip>
                            ) : null}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold leading-snug text-ink">
                          <span className="mr-1.5 font-mono text-xs font-semibold text-ink-3">{c.number}</span>
                          {c.title}
                        </h3>
                        <p className="line-clamp-3 text-sm text-ink-2">{c.scenario}</p>
                        <p className="line-clamp-2 border-l-2 border-amber pl-3 text-sm text-ink-2">
                          <span className="font-semibold text-ink">{c.track === "hld" ? "What drives it: " : "The crux: "}</span>
                          {c.focus}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                          <Link href={`/case-studies/${c.slug}`} className={buttonClasses("primary", "sm")}>
                            Attempt it<span className="sr-only">: {c.title}</span>
                          </Link>
                          <Link href={`/learn/${c.slug}`} className="text-sm font-bold text-ink-2 underline-offset-2 hover:text-link hover:underline">
                            Read the walkthrough<span className="sr-only">: {c.title}</span>
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
