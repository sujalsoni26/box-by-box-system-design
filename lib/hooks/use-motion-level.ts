"use client";
import { useMediaQuery } from "./use-media-query";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { AnimationLevel } from "@/types/companion";

/** How much longer animations run at each level (CSS uses the same factor via --motion-scale). */
export const MOTION_SCALE: Record<AnimationLevel, number> = { normal: 1, slow: 2, reduced: 0 };

/**
 * Effective animation speed for pages and the companion. An explicit choice in Settings wins;
 * with no choice saved, it follows the OS: reduced when prefers-reduced-motion is set, otherwise normal.
 */
export function useMotionLevel(): AnimationLevel {
  const osReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const chosen = usePreferencesStore((s) => s.animationSpeed);
  return chosen ?? (osReduced ? "reduced" : "normal");
}

/** True when decorative or continuous motion should be skipped. */
export function useReducedMotion(): boolean {
  return useMotionLevel() === "reduced";
}

/** Scales a JS animation duration (seconds or ms) by the current speed; reduced returns 0. */
export function useMotionDuration(): (base: number) => number {
  const level = useMotionLevel();
  return (base: number) => base * MOTION_SCALE[level];
}
