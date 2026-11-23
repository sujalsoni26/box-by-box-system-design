/*
 * The lesson page's right column (xl and up) has two collapsible panels: "On this page" and "Notes".
 * At most one is open at a time; both may be closed. Pure logic only (no runtime imports), so it can be
 * unit-tested without a bundler (scripts/tests/lesson-panels.test.mjs).
 */

export type SidePanel = "toc" | "notes";

/** On this page is the main navigation, so it starts open; Notes starts closed. */
export const DEFAULT_SIDE_PANEL: SidePanel | null = "toc";

/** sessionStorage key: the last choice is kept for this tab's session only, so lessons don't keep flipping. */
export const SIDE_PANEL_STORAGE_KEY = "sdn-side-panel";

/** Stored value for "both closed" (sessionStorage only holds strings). */
const NONE = "none";

/** Clicking a panel's header opens it and closes the other one; clicking the open panel's header closes it. */
export function toggleSidePanel(current: SidePanel | null, clicked: SidePanel): SidePanel | null {
  return current === clicked ? null : clicked;
}

/** Reads the stored choice back. A missing or unknown value gives the default. */
export function parseSidePanel(raw: string | null | undefined): SidePanel | null {
  if (raw === "toc" || raw === "notes") return raw;
  if (raw === NONE) return null;
  return DEFAULT_SIDE_PANEL;
}

/** The string stored for a choice; `parseSidePanel(serializeSidePanel(p)) === p` for every choice. */
export function serializeSidePanel(panel: SidePanel | null): string {
  return panel ?? NONE;
}
