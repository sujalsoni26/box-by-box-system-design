import type { Metadata } from "next";
import Link from "next/link";
import { CaseStudyList, type CaseStudyGroup } from "@/components/case-studies/case-study-list";
import { CASE_STUDY_TRACKS, caseStudies, caseStudiesFor } from "@/lib/case-studies";
import { getLesson } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Case studies",
  description: "Interview problems from the course, high-level and low-level. Reason through each step before you reveal the answer.",
};

const HOW = [
  { title: "Think", body: "Read the scenario and answer the first question yourself. Sketch boxes or classes, or say it out loud." },
  { title: "Hint, if stuck", body: "A hint narrows the problem without giving the answer away. Use it after a real attempt." },
  { title: "Reveal and compare", body: "Check the insight against your answer. The next step opens only after you reveal this one." },
];

export default function CaseStudiesPage() {
  const groups: CaseStudyGroup[] = CASE_STUDY_TRACKS.map((t) => ({
    id: t.id,
    title: t.title,
    blurb: t.blurb,
    method: { slug: t.method, title: getLesson(t.method)?.title ?? "How to approach a case" },
    cases: caseStudiesFor(t.id).map((c) => ({
      slug: c.slug,
      title: c.title,
      track: c.track,
      level: c.level,
      minutes: c.minutes,
      scenario: c.scenario,
      focus: c.focus,
      steps: c.steps.length,
      number: getLesson(c.slug)?.number ?? "",
    })),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6" data-companion-avoid="">
      <header className="animate-rise">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Case studies · interview prep</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          Design it before you read it
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          {caseStudies.length} problems from the course, posed the way an interviewer would. Work each one step by step, then compare with the full
          walkthrough. Not sure how to start? Read the{" "}
          <Link href="/learn/playbook" className="font-semibold text-link underline underline-offset-2">
            interview framework
          </Link>{" "}
          first.
        </p>
      </header>

      <section aria-labelledby="how-h">
        <h2 id="how-h" className="sr-only">
          How a case study works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <li key={h.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-sm font-bold text-link" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display font-bold text-ink">{h.title}</h3>
                <p className="mt-0.5 text-sm text-ink-2">{h.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <CaseStudyList groups={groups} />
    </div>
  );
}
