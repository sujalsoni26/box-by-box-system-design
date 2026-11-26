import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { LessonLayout } from "@/components/learning/lesson-layout";
import { getLesson, lessons } from "@/lib/curriculum";
import { getLessonHeadings } from "@/lib/lesson-headings";

interface LessonPageProps {
  params: Promise<{ module: string; slug: string }>;
}

/**
 * No instant-navigation validation for lessons (dev-only check; production and prerendering are unchanged).
 * Every lesson is fully static, so the check has nothing to find, and in `next dev` (Next 16.4, Turbopack) it fails
 * on the first visit after a fresh compile for some lessons, e.g. case-study-method, with "Could not validate
 * `instant`… module factory is not available" for the glossary popover's client module. Revisit on a Next upgrade.
 */
export const instant = false;

/**
 * Every lesson is prerendered at build time at /learn/<module>/<slug>; any other pair renders the 404 page.
 * The old /learn/<slug> addresses redirect here (next.config.ts).
 */
export function generateStaticParams() {
  return lessons.map((l) => ({ module: l.moduleId, slug: l.slug }));
}

/** The lesson at this address: the slug must exist and sit in this module. */
async function lessonAt(params: LessonPageProps["params"]) {
  const { module, slug } = await params;
  const lesson = getLesson(slug);
  return lesson && lesson.moduleId === module ? lesson : undefined;
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const lesson = await lessonAt(params);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: LessonPageProps) {
  const lesson = await lessonAt(params);
  if (!lesson) notFound();
  const { slug } = lesson;
  const { default: Content } = (await import(`@/content/lessons/${slug}.mdx`)) as { default: ComponentType };
  return (
    <LessonLayout lesson={lesson} headings={getLessonHeadings(slug)}>
      <Content />
    </LessonLayout>
  );
}
