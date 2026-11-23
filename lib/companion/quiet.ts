/*
 * "Is now a bad moment to interrupt?" Checks the page, not the companion (behaviour.ts covers the
 * companion's own state). Used before any unprompted bubble: topic meows, the completion prompt and the
 * idle lamp. Cheap DOM reads, called once per scheduled attempt, never per frame.
 */

const RECENT_INTERACTION_MS = 12_000;
let lastWidgetInteraction = 0;
let tracking = false;

/** Remember presses inside Try it blocks and knowledge checks (installed once by the companion). */
export function trackWidgetInteractions(): () => void {
  if (tracking || typeof window === "undefined") return () => {};
  tracking = true;
  const onDown = (e: Event) => {
    const t = e.target as Element | null;
    if (t?.closest?.('[data-interactive], section[aria-labelledby^="check-"]')) lastWidgetInteraction = Date.now();
  };
  window.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  window.addEventListener("keydown", onDown, { capture: true, passive: true });
  return () => {
    window.removeEventListener("pointerdown", onDown, { capture: true });
    window.removeEventListener("keydown", onDown, { capture: true });
    tracking = false;
  };
}

function visibleInViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

const TYPING = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const MODAL = '[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]';

/**
 * The learner is engaged with something even without input: a modal dialog (e.g. a diagram lightbox) is open,
 * focus is in a text field, or focus is inside a knowledge check. Cache does not fall asleep meanwhile.
 */
export function learnerEngaged(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (active?.matches?.(TYPING)) return true;
  if (document.querySelector(MODAL)) return true;
  return Boolean(active?.closest?.('section[aria-labelledby^="check-"]'));
}

interface BusyOptions {
  /**
   * Ignore a knowledge check merely being on screen (still busy if focus is inside it or it was just used).
   * The completion prompt needs this: the check sits right above the end of the lesson.
   */
  allowVisibleChecks?: boolean;
}

/** The learner is typing, selecting, in a dialog or popover, working a quiz, or just used a Try it block. */
export function pageIsBusy(now = Date.now(), options: BusyOptions = {}): boolean {
  if (typeof document === "undefined") return true;
  if (document.visibilityState !== "visible") return true;
  const active = document.activeElement;
  if (active?.matches?.(TYPING)) return true;
  if (document.querySelector(MODAL)) return true;
  try {
    if (document.querySelector(":popover-open")) return true;
  } catch {
    // Older browsers without :popover-open.
  }
  const selection = window.getSelection?.();
  if (selection && !selection.isCollapsed && selection.toString().trim()) return true;
  // An open knowledge check on screen, or focus inside one.
  if (active?.closest?.('section[aria-labelledby^="check-"]')) return true;
  if (!options.allowVisibleChecks) {
    for (const f of document.querySelectorAll('section[aria-labelledby^="check-"] fieldset')) if (visibleInViewport(f)) return true;
  }
  return now - lastWidgetInteraction < RECENT_INTERACTION_MS;
}
