import Link from "next/link";
import type { ReactNode } from "react";
import { Clock, PencilRuler } from "lucide-react";
import { KnowledgeCheck } from "@/components/quiz/knowledge-check";
import { buttonClasses } from "@/components/ui/button";
import { LevelChip } from "@/components/ui/chip";
import { getCaseStudy } from "@/lib/case-studies";
import { getAdjacentLessons, getModule, knowledgeCheckAfter } from "@/lib/curriculum";
import type { LessonHeading } from "@/lib/lesson-headings";
import type { Lesson } from "@/types/curriculum";
import { BookmarkButton, CompletedChip, LessonVisitTracker, MarkCompleteButton, ReviewButton } from "./lesson-actions";
import { LessonNavigation } from "./lesson-navigation";
import { LessonNotesChip } from "./lesson-notes";
import { LessonSidePanels } from "./lesson-side-panels";
import { LessonSidebar } from "./lesson-sidebar";
import { ReadingProgress } from "./on-this-page";
import { RecallCard } from "./recall-card";
import { TeachingStrip } from "./teaching-strip";

export function LessonLayout({ lesson, headings, children }: { lesson: Lesson; headings: LessonHeading[]; children: ReactNode }) {
  const courseModule = getModule(lesson.moduleId);
  const { prev, next } = getAdjacentLessons(lesson.slug);
  const check = knowledgeCheckAfter(lesson.slug);
  const study = getCaseStudy(lesson.slug);

  return (
    <>
      <ReadingProgress />
      <LessonVisitTracker slug={lesson.slug} />
      <div className="mx-auto grid max-w-[90rem] gap-x-10 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        <aside data-companion-avoid="" className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-8 pr-2 lg:block">
          <LessonSidebar moduleId={lesson.moduleId} currentSlug={lesson.slug} />
        </aside>

        <article data-companion-avoid="" className="min-w-0 max-w-[46rem] py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">
            <Link href="/learn" className="hover:text-link">
              Learn
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={`/learn#${courseModule.id}`} className="hover:text-link">
              {courseModule.number}. {courseModule.title}
            </Link>
          </nav>

          <header className="mb-7">
            <p className="font-mono text-sm font-semibold text-link">Lesson {lesson.number}</p>
            <h1 className="mt-1 font-display text-[clamp(2rem,4.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">{lesson.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LevelChip level={lesson.level} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold text-ink-2">
                <Clock aria-hidden="true" className="size-3.5" /> {lesson.minutes} min
              </span>
              <BookmarkButton slug={lesson.slug} title={lesson.title} />
              <ReviewButton slug={lesson.slug} title={lesson.title} />
              {/* Below xl only; from xl the Notes panel sits in the right column. */}
              <LessonNotesChip slug={lesson.slug} title={lesson.title} />
              <CompletedChip slug={lesson.slug} />
            </div>
          </header>

          <details className="group mb-6 rounded-xl border border-line bg-surface px-4 py-2 lg:hidden" data-companion-avoid="">
            <summary className="cursor-pointer py-1 font-bold text-ink-2 group-open:mb-2">Course outline</summary>
            <LessonSidebar moduleId={lesson.moduleId} currentSlug={lesson.slug} />
          </details>

          {study ? (
            <aside aria-label="Interview practice" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3">
              <PencilRuler aria-hidden="true" className="size-5 shrink-0 text-link" />
              <p className="min-w-[14rem] flex-1 text-[0.95rem] text-ink">
                <span className="font-bold">Try it before you read it.</span> Work this case step by step as an interview exercise, then come back
                and compare.
              </p>
              <Link href={`/case-studies/${study.slug}`} className={buttonClasses("primary", "sm")}>
                Attempt the case
              </Link>
            </aside>
          ) : null}

          <TeachingStrip lesson={lesson} />

          <div className="text-[1.06rem] leading-[1.75] text-ink">{children}</div>

          <RecallCard recall={lesson.recall} hint={lesson.hint} />
          {check ? <KnowledgeCheck check={check} /> : null}
          <MarkCompleteButton lesson={lesson} />
          <LessonNavigation prev={prev} next={next} />
        </article>

        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-10 xl:block" data-companion-avoid="">
          {/* "On this page" and Notes: both collapsible, at most one open. */}
          <LessonSidePanels headings={headings} slug={lesson.slug} title={lesson.title} />
        </aside>
      </div>
    </>
  );
}
