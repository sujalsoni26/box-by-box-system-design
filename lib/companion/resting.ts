import { clamp } from "@/lib/utils";
import type { CompanionPosition } from "@/types/companion";

/*
 * Floor geometry for the companion. Coordinates are viewport pixels for the cat's top-left corner.
 * The cat lives on a floor line (the viewport bottom, or the top of a fixed bottom tab bar) between two
 * side walls, and stays wherever she lands on it: there is no "safe spot" search and no preset corner.
 * Her spot is stored normalised (0..1 between the walls), so it maps onto any viewport size.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export function readViewport(): Size {
  const doc = document.documentElement;
  const w = doc.clientWidth || window.innerWidth;
  const h = Math.min(window.innerHeight, doc.clientHeight || window.innerHeight);
  return { w, h };
}

/** Gap between the cat's box and the floor line, px. */
export const FLOOR_GAP = 2;

/**
 * The floor line: the bottom of the viewport, or the top of a fixed bottom tab bar (`nav[aria-label=Main]`).
 * The bar is measured by its height, not its top: on phones it rides the real bottom edge (which toolbars move),
 * as does the companion's frame, so "view height minus bar height" is right whatever the toolbars are doing.
 */
export function readFloorLine(view: Size): number {
  let line = view.h;
  const bottom = Math.max(view.h, window.innerHeight || 0);
  document.querySelectorAll('nav[aria-label="Main"]').forEach((nav) => {
    const r = nav.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (r.bottom >= Math.min(view.h, window.innerHeight || view.h) - 4 && r.bottom <= bottom + 4 && r.height < view.h * 0.5) {
      line = Math.min(line, view.h - r.height);
    }
  });
  return line;
}

export interface World {
  /** Side walls for the cat's left edge (the whole cat stays on screen). */
  minX: number;
  maxX: number;
  /** Resting y (top of the cat's box) on the floor. */
  floorY: number;
}

export function getWorld(view: Size, size: number, compact: boolean, floorLine: number): World {
  const m = compact ? 2 : 8;
  return {
    minX: m,
    maxX: Math.max(m, view.w - size - m),
    floorY: Math.max(m, floorLine - size - FLOOR_GAP),
  };
}

export function normalizeFloorX(x: number, world: World): CompanionPosition {
  const span = world.maxX - world.minX;
  return { x: span > 0 ? clamp((x - world.minX) / span, 0, 1) : 1, y: 1, floor: true };
}

export function floorXFrom(position: CompanionPosition | null, world: World): number {
  const n = position && Number.isFinite(position.x) ? clamp(position.x, 0, 1) : 1;
  return world.minX + n * (world.maxX - world.minX);
}
