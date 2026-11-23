"use client";
import { useMediaQuery } from "./use-media-query";
import type { AnimationLevel } from "@/types/companion";

/**
 * Motion level for pages and the companion: "reduced" when the operating system asks for reduced
 * motion, otherwise "normal". There is deliberately no site-wide speed setting; animated Try it
 * blocks carry their own local speed control, which never affects the companion.
 */
export function useMotionLevel(): AnimationLevel {
  return useMediaQuery("(prefers-reduced-motion: reduce)") ? "reduced" : "normal";
}

/** True when decorative or continuous motion should be skipped. */
export function useReducedMotion(): boolean {
  return useMotionLevel() === "reduced";
}
