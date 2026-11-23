/* DOM helpers for the diagram lightbox: page scroll lock and the focusable elements of a dialog. */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

/** Tabbable elements inside `root`, in DOM order (skips hidden and inert ones). */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && !el.closest("[inert], [hidden]"),
  );
}

/**
 * Stop the page behind a modal from scrolling. The scrollbar's space stays reserved (scrollbar-gutter, or
 * matching body padding in browsers without it) so the page does not jump sideways. Returns the undo,
 * which puts back exactly the inline styles that were there before.
 */
export function lockPageScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
  const before = {
    overflow: html.style.getPropertyValue("overflow"),
    overflowPriority: html.style.getPropertyPriority("overflow"),
    gutter: html.style.getPropertyValue("scrollbar-gutter"),
    gutterPriority: html.style.getPropertyPriority("scrollbar-gutter"),
    paddingRight: body.style.getPropertyValue("padding-right"),
    paddingPriority: body.style.getPropertyPriority("padding-right"),
  };
  const gutterSupported = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("scrollbar-gutter", "stable");

  html.style.setProperty("overflow", "hidden");
  if (scrollbar > 0) {
    if (gutterSupported) html.style.setProperty("scrollbar-gutter", "stable");
    else body.style.setProperty("padding-right", `${parseFloat(getComputedStyle(body).paddingRight || "0") + scrollbar}px`);
  }

  return () => {
    restore(html.style, "overflow", before.overflow, before.overflowPriority);
    restore(html.style, "scrollbar-gutter", before.gutter, before.gutterPriority);
    restore(body.style, "padding-right", before.paddingRight, before.paddingPriority);
  };
}

function restore(style: CSSStyleDeclaration, property: string, value: string, priority: string) {
  if (value) style.setProperty(property, value, priority);
  else style.removeProperty(property);
}
