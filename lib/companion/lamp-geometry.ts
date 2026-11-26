/*
 * Where the lamp goes and where Cache stands to jump onto it. Pure (no imports), so it is unit tested.
 * The lamp appears a few natural steps away (3–5 walk steps, then a jump), on the side with room,
 * preferring the middle of the screen.
 */

/** Lamp size relative to the cat (the drawing's viewBox is 70 x 84, flat shade top at y 4). */
export const LAMP = { w: 0.95, h: 1.14 } as const;
/** Where the cat's box sits on the shade: its top edge is this far (in cat sizes) above the lamp top. */
export const PERCH_LIFT = 0.88;
/** Horizontal gap from the cat's centre at take-off to the lamp's centre, in cat sizes (plus half the lamp). */
export const JUMP_GAP = 0.55;
/** Step counts to try, best first. */
export const LAMP_STEPS = [4, 5, 3] as const;

export interface LampPlan {
  /** Lamp centre, viewport px. */
  cx: number;
  /** Direction of the walk: towards the lamp. */
  dir: 1 | -1;
  /** The cat's left edge where she stops to jump, px. */
  standX: number;
  /** Whole walk steps to get there. */
  steps: number;
}

/**
 * True when there is room for the lamp beside the cat: a desktop-sized viewport and cat, or on phones and tablets
 * (compact) any screen at least 300 px wide. planLamp still checks the room on each side when she sets off.
 */
export function lampFits(viewW: number, size: number, compact = false): boolean {
  return compact ? viewW >= 300 && size >= 40 : viewW >= 700 && size >= 60;
}

/**
 * Plan the lamp for a cat whose left edge is at `catLeft`. `stepPx` is one walk step (gait.ts). Returns null
 * when neither side has room.
 */
export function planLamp(catLeft: number, size: number, viewW: number, stepPx: number): LampPlan | null {
  const centre = catLeft + size / 2;
  const lampW = size * LAMP.w;
  const minC = lampW / 2 + 10;
  const maxC = viewW - lampW / 2 - 10;
  const gap = lampW / 2 + size * JUMP_GAP;
  const dirs: Array<1 | -1> = centre < viewW / 2 ? [1, -1] : [-1, 1];
  for (const steps of LAMP_STEPS) {
    for (const dir of dirs) {
      const stand = centre + dir * steps * stepPx;
      const cx = stand + dir * gap;
      if (cx < minC || cx > maxC) continue;
      if (stand - size / 2 < 4 || stand + size / 2 > viewW - 4) continue;
      return { cx, dir, standX: stand - size / 2, steps };
    }
  }
  return null;
}

/** Top-left of the cat's box when sitting on the shade. */
export function perchPoint(cx: number, size: number, groundY: number): { x: number; y: number } {
  return { x: cx - size / 2, y: groundY - size * LAMP.h - size * PERCH_LIFT };
}

/** Where she lands when hopping down: beside the lamp, on the side towards the middle of the screen. */
export function hopDownX(cx: number, size: number, viewW: number): number {
  const lampW = size * LAMP.w;
  return cx + (cx > viewW / 2 ? -1 : 1) * (lampW / 2 + size * 0.25) - size / 2;
}
