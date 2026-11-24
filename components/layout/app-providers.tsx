"use client";
import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { initAccounts, prepareLocalData } from "@/lib/cloud/controller";
import { STORAGE_KEYS } from "@/lib/storage/adapter";
import { useNotesStore } from "@/stores/notes-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";

/** Loads persisted stores on the client only (avoids hydration mismatches) and keeps tabs in sync. */
function useStoreHydration() {
  useEffect(() => {
    // A signed-out account's copy is cleared after 5 days, before anything loads (accounts only).
    prepareLocalData();
    void useProgressStore.persist.rehydrate();
    void usePreferencesStore.persist.rehydrate();
    void useNotesStore.persist.rehydrate();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.progress) void useProgressStore.persist.rehydrate();
      if (e.key === STORAGE_KEYS.preferences) void usePreferencesStore.persist.rehydrate();
      if (e.key === STORAGE_KEYS.notes) void useNotesStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    // Restore a signed-in session and keep the account in step (no-op when accounts aren't configured).
    initAccounts();
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
  // Motion follows the operating system's reduced-motion preference (CSS does the same in globals.css).
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
