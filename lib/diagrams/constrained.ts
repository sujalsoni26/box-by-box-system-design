/*
 * "Is this diagram too cramped to read in the lesson column?" Pure decisions only (no DOM), so they can
 * be unit tested in scripts/tests/diagrams.test.mjs. components/diagrams/diagram-frame.tsx measures the
 * page and feeds the numbers in.
 */

export interface Size {
  width: number;
  height: number;
}

/** Below this rendered/natural width ratio the diagram counts as scaled down (text noticeably smaller). */
export const SCALE_THRESHOLD = 0.88;

/** Sub-pixel rounding allowance before a scroller counts as overflowing. */
export const OVERFLOW_TOLERANCE_PX = 1;

const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

/** "0 0 760 300" (spaces and/or commas) → { width: 760, height: 300 }; anything unusable → null. */
export function parseViewBox(viewBox: string | null | undefined): Size | null {
  if (!viewBox) return null;
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4) return null;
  const [, , width, height] = parts;
  return finitePositive(width) && finitePositive(height) ? { width, height } : null;
}

/** A plain SVG length ("720" or "720px") in CSS pixels; relative units ("100%", "2em") → null. */
export function parseLength(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  return finitePositive(n) ? n : null;
}

/**
 * The size a diagram was drawn at (1 user unit = 1 CSS pixel): the viewBox, else numeric width and
 * height attributes. Mermaid sets width="100%" plus a viewBox, so the viewBox wins.
 */
export function naturalSize(attrs: { viewBox?: string | null; width?: string | null; height?: string | null }): Size | null {
  const box = parseViewBox(attrs.viewBox);
  if (box) return box;
  const width = parseLength(attrs.width);
  const height = parseLength(attrs.height);
  return width && height ? { width, height } : null;
}

/**
 * A diagram is constrained when it overflows its scroller horizontally, or when it is drawn noticeably
 * smaller than its natural width (rendered < SCALE_THRESHOLD × natural). Unknown or zero sizes (not laid
 * out yet, hidden) never count, so nothing is offered until there is something real to measure.
 */
export function isConstrained(
  naturalWidth: number,
  renderedWidth: number,
  containerScrollWidth: number,
  containerClientWidth: number,
  threshold: number = SCALE_THRESHOLD,
): boolean {
  if (finitePositive(containerClientWidth) && containerScrollWidth - containerClientWidth > OVERFLOW_TOLERANCE_PX) return true;
  if (!finitePositive(naturalWidth) || !finitePositive(renderedWidth)) return false;
  return renderedWidth / naturalWidth < threshold;
}
