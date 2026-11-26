/*
 * "On this page" for every lesson, built from the rendered page rather than only its "##" headings, so lessons
 * written around steps, simulations and "Go deeper" sections get a useful outline too. Pure rules here (unit
 * tested); components/learning/on-this-page.tsx collects the candidates from the page.
 *
 * Candidates, in page order:
 * - level 1: the lesson's sections (## headings) and the page's own parts (Problem to building block, Quick recall,
 *   Knowledge check, Mark as learned);
 * - level 2: ### headings, "Try it" simulations and "Go deeper" sections;
 * - minor (level 2): titled callouts, used only to fill out lessons that would otherwise have a thin outline.
 */

export interface OutlineCandidate {
  id: string;
  label: string;
  level: 1 | 2;
  minor?: boolean;
}

export interface OutlineEntry {
  id: string;
  label: string;
  level: 1 | 2;
}

/** With fewer entries than this, titled callouts are added. */
export const THIN_OUTLINE = 7;
const MAX_LABEL = 64;

function tidy(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  return clean.length > MAX_LABEL ? `${clean.slice(0, MAX_LABEL - 1).trimEnd()}…` : clean;
}

/** The entries to show: no blanks or duplicate ids, callouts only when the outline is thin, short labels. */
export function buildOutline(candidates: OutlineCandidate[]): OutlineEntry[] {
  const seen = new Set<string>();
  const usable = candidates.filter((c) => {
    if (!c.id || !c.label.trim() || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const major = usable.filter((c) => !c.minor);
  const chosen = major.length < THIN_OUTLINE ? usable : major;
  return chosen.map((c) => ({ id: c.id, label: tidy(c.label), level: c.level }));
}
