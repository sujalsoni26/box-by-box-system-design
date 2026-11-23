"use client";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { STORAGE_KEYS } from "@/lib/storage/adapter";
import { useMotionLevel } from "@/lib/hooks/use-motion-level";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";

/** Loads persisted stores on the client only (avoids hydration mismatches) and keeps tabs in sync. */
function useStoreHydration() {
  useEffect(() => {
    void useProgressStore.persist.rehydrate();
    void usePreferencesStore.persist.rehydrate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.progress) void useProgressStore.persist.rehydrate();
      if (e.key === STORAGE_KEYS.preferences) void usePreferencesStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

/** Applies the theme preference (and follows the OS when it is "system"). */
function useThemeSync() {
  const theme = usePreferencesStore((s) => s.theme);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [theme]);
}

export function AppProviders({ children }: { children: ReactNode }) {
  useStoreHydration();
  useThemeSync();
  const motionLevel = useMotionLevel();

  // data-motion drives the CSS side (globals.css): "slow" doubles durations, "reduced" removes motion.
  // Always set (also "normal") so an explicit choice overrides the OS media-query fallback.
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", motionLevel);
  }, [motionLevel]);

  return <MotionConfig reducedMotion={motionLevel === "reduced" ? "always" : "never"}>{children}</MotionConfig>;
}
