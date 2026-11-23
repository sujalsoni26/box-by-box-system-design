"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Lightbulb, MessagesSquare, RotateCcw, Scale } from "lucide-react";
import { ReviewButton } from "@/components/learning/lesson-actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { CaseStudy } from "@/types/case-study";

/**
 * Interview-style practice: one step at a time. The learner answers the prompt on their own,
 * can take a hint, and only then reveals the insight. The next step appears after a reveal, so
 * later prompts cannot give away earlier answers. Nothing here is saved; the review flag is.
 */
export function CaseStudyWorkspace({ study }: { study: CaseStudy }) {
  const total = study.steps.length;
  const [revealed, setRevealed] = useState(0);
  const [hints, setHints] = useState<Set<number>>(() => new Set());
  const insightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wrapUpRef = useRef<HTMLHeadingElement | null>(null);
  const lastAction = useRef<"reveal" | "all" | null>(null);
  const finished = revealed >= total;

  // After a reveal, move focus to the new insight so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (lastAction.current === "reveal") insightRefs.current[revealed - 1]?.focus();
    if (lastAction.current === "all") wrapUpRef.current?.focus();
    lastAction.current = null;
  }, [revealed]);

  const toggleHint = (i: number) =>
    setHints((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-companion-avoid="">
        <div className="min-w-[10rem] flex-1">
          <ProgressBar value={revealed / total} label="Steps answered" valueText={`${Math.min(revealed, total)} of ${total} steps revealed`} size="sm" />
        </div>
        <span className="font-mono text-xs tabular-nums text-ink-3">
          {Math.min(revealed, total)}/{total} revealed
        </span>
        {finished ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRevealed(0);
              setHints(new Set());
            }}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" /> Start over
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              lastAction.current = "all";
              setRevealed(total);
            }}
          >
            <Eye aria-hidden="true" className="size-3.5" /> Show all (revision)
          </Button>
        )}
      </div>

      <ol className="flex flex-col gap-4">
        {study.steps.slice(0, Math.min(revealed + 1, total)).map((step, i) => {
          const open = i < revealed;
          const hintOn = hints.has(i);
          return (
            <li
              key={i}
              className={cn(
                "animate-rise rounded-2xl border bg-surface p-5 sm:p-6",
                open ? "border-line" : "border-accent shadow-[var(--shadow-lift)]",
              )}
            >
              <div className="flex gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full font-mono text-sm font-bold",
                    open ? "bg-good-soft text-good" : "bg-accent text-accent-ink",
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[1.08rem] font-bold leading-snug text-ink">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.prompt}
                  </h3>
                  {!open ? (
                    <p className="mt-1.5 text-sm text-ink-3">Answer it yourself first: sketch it, or say it out loud as you would to an interviewer.</p>
                  ) : null}

                  {hintOn ? (
                    <div id={`hint-${i}`} className="mt-3 flex gap-2 rounded-xl bg-amber-soft px-4 py-3 text-[0.95rem] text-ink">
                      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-ink" />
                      <p>
                        <span className="sr-only">Hint: </span>
                        {step.hint}
                      </p>
                    </div>
                  ) : null}

                  {open ? (
                    <div
                      ref={(el) => {
                        insightRefs.current[i] = el;
                      }}
                      tabIndex={-1}
                      className="mt-3 rounded-xl bg-good-soft px-4 py-3 text-[0.98rem] leading-relaxed text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-good">Insight</p>
                      <p className="mt-1">{step.insight}</p>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" aria-expanded={hintOn} aria-controls={hintOn ? `hint-${i}` : undefined} onClick={() => toggleHint(i)}>
                        <Lightbulb aria-hidden="true" className="size-3.5" /> {hintOn ? "Hide hint" : "Show a hint"}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          lastAction.current = "reveal";
                          setRevealed(i + 1);
                        }}
                      >
                        I have my answer: reveal
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {finished ? (
        <div className="flex animate-rise flex-col gap-6">
          <section aria-labelledby="wrap-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="wrap-h" ref={wrapUpRef} tabIndex={-1} className="flex items-center gap-2 font-display text-xl font-bold text-ink outline-none">
              <Scale aria-hidden="true" className="size-5 text-amber-ink" /> Trade-offs to defend
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[0.98rem] text-ink marker:text-ink-3">
              {study.tradeoffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="follow-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="follow-h" className="flex items-center gap-2 font-display text-xl font-bold text-ink">
              <MessagesSquare aria-hidden="true" className="size-5 text-link" /> Follow-ups an interviewer might ask
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[0.98rem] text-ink marker:text-ink-3">
              {study.followUps.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-3">Answer these out loud before you check the walkthrough.</p>
          </section>
          <div className="flex flex-wrap items-center gap-3" data-companion-avoid="">
            <Link href={`/learn/${study.slug}`} className={buttonClasses("primary", "md")}>
              Read the full walkthrough <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <ReviewButton slug={study.slug} title={study.title} size="button" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
