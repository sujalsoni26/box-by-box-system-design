import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";
import { CaseStudyWorkspace } from "@/components/case-studies/case-study-workspace";
import { CompletedChip, ReviewButton } from "@/components/learning/lesson-actions";
import { Chip, LevelChip } from "@/components/ui/chip";
import { caseStudies, caseStudiesFor, getCaseStudy } from "@/lib/case-studies";
import { getLesson } from "@/lib/curriculum";

interface CaseStudyPageProps {
  params: Promise<{ slug: string }>;
}

/** Every case study is prerendered; any other slug renders the 404 page. */
export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  return study ? { title: `${study.title} (case study)`, description: study.scenario } : {};
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();
  const lesson = getLesson(slug);
  const siblings = caseStudiesFor(study.track);
  const at = siblings.findIndex((c) => c.slug === slug);
  const prev = siblings[at - 1];
  const next = siblings[at + 1];
  const concepts = study.concepts.map((s) => getLesson(s)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const trackLabel = study.track === "hld" ? "High-level design" : "Low-level design";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <article data-companion-avoid="" className="flex flex-col gap-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 font-mono text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">
          <Link href="/case-studies" className="hover:text-link">
            Case studies
          </Link>
          <span aria-hidden="true">/</span>
          <span>{trackLabel}</span>
        </nav>

        <header>
          <p className="font-mono text-sm font-semibold text-link">{lesson ? `Case study ${lesson.number}` : "Case study"}</p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,4.4vw,2.7rem)] font-extrabold leading-[1.06] tracking-[-0.025em] text-ink">{study.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="accent">{study.track === "hld" ? "HLD" : "LLD"}</Chip>
            <LevelChip level={study.level} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.72rem] font-semibold text-ink-2">
              <Clock aria-hidden="true" className="size-3.5" /> {study.minutes} min
            </span>
            <ReviewButton slug={study.slug} title={study.title} />
            <CompletedChip slug={study.slug} />
          </div>
        </header>

        <section aria-labelledby="scenario-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="scenario-h" className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
            The interviewer says
          </h2>
          <p className="mt-2 text-[1.06rem] leading-relaxed text-ink">{study.scenario}</p>
          <p className="mt-4 border-l-2 border-amber pl-3 text-[0.98rem] text-ink-2">
            <span className="font-semibold text-ink">{study.track === "hld" ? "What drives the design: " : "The modelling crux: "}</span>
            {study.focus}
          </p>
        </section>

        {concepts.length > 0 ? (
          <section aria-labelledby="concepts-h">
            <h2 id="concepts-h" className="font-display text-lg font-bold text-ink">
              Warm up with
            </h2>
            <p className="mt-0.5 text-sm text-ink-3">The lessons this case leans on. Skim any that feel rusty before you start.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {concepts.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/learn/${c.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 transition-colors hover:border-accent hover:text-link"
                  >
                    <span className="font-mono text-[0.7rem] text-ink-3">{c.number}</span>
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="steps-h">
          <h2 id="steps-h" className="mb-4 font-display text-2xl font-bold text-ink">
            Work it through
          </h2>
          <CaseStudyWorkspace study={study} />
        </section>

        <p className="flex items-center gap-2 text-sm text-ink-3">
          <BookOpen aria-hidden="true" className="size-4" />
          Prefer to read first? The{" "}
          <Link href={`/learn/${study.slug}`} className="font-semibold text-link underline underline-offset-2">
            full walkthrough
          </Link>{" "}
          has the diagrams and numbers.
        </p>

        <nav aria-label="Other case studies" className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/case-studies/${prev.slug}`} className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
              <span className="flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">
                <ArrowLeft aria-hidden="true" className="size-3.5" /> Previous case
              </span>
              <span className="mt-1 block font-display font-bold text-ink group-hover:text-link">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link href={`/case-studies/${next.slug}`} className="group rounded-xl border border-line bg-surface p-4 text-right transition-colors hover:border-accent">
              <span className="flex items-center justify-end gap-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">
                Next case <ArrowRight aria-hidden="true" className="size-3.5" />
              </span>
              <span className="mt-1 block font-display font-bold text-ink group-hover:text-link">{next.title}</span>
            </Link>
          ) : (
            <Link href="/case-studies" className="group rounded-xl border border-line bg-surface p-4 text-right transition-colors hover:border-accent">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">End of track</span>
              <span className="mt-1 block font-display font-bold text-ink group-hover:text-link">All case studies</span>
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
