import { caseStudies } from "@/data/case-studies";
import { getLesson } from "@/lib/curriculum";
import type { CaseStudy, CaseStudyTrack } from "@/types/case-study";

export { caseStudies };

const bySlug = new Map(caseStudies.map((c) => [c.slug, c]));

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return bySlug.get(slug);
}

export function isCaseStudy(slug: string): boolean {
  return bySlug.has(slug);
}

/** Case studies of one track, in curriculum order. */
export function caseStudiesFor(track: CaseStudyTrack): CaseStudy[] {
  return caseStudies
    .filter((c) => c.track === track)
    .sort((a, b) => (getLesson(a.slug)?.index ?? 0) - (getLesson(b.slug)?.index ?? 0));
}

export const CASE_STUDY_TRACKS: { id: CaseStudyTrack; title: string; blurb: string; method: string }[] = [
  {
    id: "hld",
    title: "High-level design",
    blurb: "Whole systems: requirements, the number that drives the design, data model, API and the deep dives where the difficulty lies.",
    method: "case-study-method",
  },
  {
    id: "lld",
    title: "Low-level design",
    blurb: "Object models in code: entities and responsibilities, state, relationships, patterns where they earn a place, and concurrency.",
    method: "lld-intro",
  },
];
