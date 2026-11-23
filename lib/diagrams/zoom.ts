/*
 * Zoom maths for the diagram lightbox (components/diagrams/diagram-lightbox.tsx). Pure functions with
 * only type imports, unit tested in scripts/tests/diagrams.test.mjs. A zoom of 1 is the diagram's natural
 * size (1 SVG user unit = 1 CSS pixel); the SVG is resized, never rasterised, so every level stays sharp.
 */
import type { Size } from "./constrained";

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
/** "Fit to screen" may enlarge a small diagram, but not beyond this. */
export const FIT_MAX = 2;
/** Fit-to-screen is only the opening view when it keeps text at least this big; otherwise open at 1:1. */
export const READABLE_SCALE = 0.8;
/** Levels the + / − buttons step through (plus the current fit level). */
export const ZOOM_STOPS: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4];

export interface ZoomBounds {
  min: number;
  max: number;
}

/** Relative tolerance so 0.6667 and 0.67 count as the same stop. */
const SAME = 0.005;

/** Scale that shows the whole diagram inside `available`, capped at `maxUpscale`. Degenerate input → 1. */
export function fitScale(natural: Size, available: Size, maxUpscale: number = FIT_MAX): number {
  if (!(natural.width > 0 && natural.height > 0)) return 1;
  const w = Math.max(1, available.width);
  const h = Math.max(1, available.height);
  const fit = Math.min(w / natural.width, h / natural.height);
  return Number.isFinite(fit) ? Math.min(fit, maxUpscale) : 1;
}

/** Never lock the learner out of "fit": the floor drops to the fit level for very large diagrams. */
export function zoomBounds(fit: number): ZoomBounds {
  const f = Number.isFinite(fit) && fit > 0 ? fit : 1;
  return { min: Math.min(ZOOM_MIN, f), max: Math.max(ZOOM_MAX, f) };
}

export function clampZoom(zoom: number, bounds: ZoomBounds): number {
  if (!Number.isFinite(zoom)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, zoom));
}

/**
 * Next level up (direction 1) or down (-1) from `current`: the nearest of ZOOM_STOPS, the bounds and any
 * `extraStops` (the fit level) that is strictly beyond it. At a bound it stays put.
 */
export function stepZoom(current: number, direction: 1 | -1, bounds: ZoomBounds, extraStops: readonly number[] = []): number {
  const here = clampZoom(current, bounds);
  const stops = [...ZOOM_STOPS, ...extraStops, bounds.min, bounds.max]
    .filter((z) => Number.isFinite(z) && z >= bounds.min && z <= bounds.max)
    .sort((a, b) => a - b);
  if (direction > 0) return stops.find((z) => z > here * (1 + SAME)) ?? here;
  for (let i = stops.length - 1; i >= 0; i -= 1) if (stops[i] < here * (1 - SAME)) return stops[i];
  return here;
}

/**
 * Opening zoom, whichever is more readable: fit-to-screen when that keeps text at READABLE_SCALE or more
 * (never enlarged past natural size), otherwise natural size with panning.
 */
export function initialZoom(fit: number, readable: number = READABLE_SCALE): number {
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  return fit >= readable ? Math.min(fit, 1) : 1;
}

/** Ctrl/⌘ + wheel (and trackpad pinch, which browsers report the same way) → multiplicative zoom factor. */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  if (!Number.isFinite(deltaY)) return 1;
  // deltaMode 1 = lines, 2 = pages; 0 = pixels.
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const limited = Math.max(-200, Math.min(200, px));
  return Math.exp(-limited * 0.0025);
}

/**
 * Scroll offset that keeps a content point (in natural units) under the same spot of the viewport after
 * zooming: `offset` is where the zoomed content starts inside the scroll area, `viewPoint` the spot.
 */
export function anchoredScroll(contentPoint: number, viewPoint: number, offset: number, zoom: number): number {
  return Math.max(0, offset + contentPoint * zoom - viewPoint);
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/** The zoom level is (as good as) one of the bounds, so that button is disabled. */
export function atBound(zoom: number, bound: number): boolean {
  return Math.abs(zoom - bound) <= bound * SAME;
}
