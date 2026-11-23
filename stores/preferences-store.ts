import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistenceAdapter, STORAGE_KEYS } from "@/lib/storage/adapter";
import type { AccessoryId, AccessorySlot, CompanionPosition, CompanionSettings, CompanionStats } from "@/types/companion";

export type ThemePreference = "light" | "dark" | "system";

export interface PreferencesState {
  theme: ThemePreference;
  /** Glossary terms the learner knows; their inline hints are no longer shown. */
  knownTerms: string[];
  companion: CompanionSettings;
}

interface PreferencesActions {
  setTheme: (theme: ThemePreference) => void;
  setTermKnown: (term: string, known: boolean) => void;
  setCompanion: (patch: Partial<CompanionSettings>) => void;
  setCompanionPosition: (position: CompanionPosition | null) => void;
  resetCompanion: () => void;
  bumpCompanionStat: (stat: keyof CompanionStats) => void;
  /** Wear an accessory in its slot, or pass null to take the slot's accessory off. */
  equipAccessory: (slot: AccessorySlot, id: AccessoryId | null) => void;
  markAccessoriesAnnounced: (ids: AccessoryId[]) => void;
  markAccessoriesSeen: (ids: AccessoryId[]) => void;
  /** Cache asked "mark it as learned?" for this lesson; it will not ask again (no nagging). */
  markCompletionAsked: (slug: string) => void;
}

export const defaultCompanionStats: CompanionStats = { feeds: 0, pets: 0, plays: 0, focusSessions: 0 };

export const defaultCompanionSettings: CompanionSettings = {
  enabled: true,
  physics: true,
  studyTips: true,
  sound: false,
  position: null,
  stats: defaultCompanionStats,
  equipped: {},
  announced: [],
  seenAccessories: [],
  topicMeows: true,
  completionAsked: {},
};

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  persist(
    (set) => ({
      theme: "system",
      knownTerms: [],
      companion: defaultCompanionSettings,
      setTheme: (theme) => set({ theme }),
      setTermKnown: (term, known) =>
        set((s) => ({
          knownTerms: known ? Array.from(new Set([...s.knownTerms, term])) : s.knownTerms.filter((t) => t !== term),
        })),
      setCompanion: (patch) => set((s) => ({ companion: { ...s.companion, ...patch } })),
      setCompanionPosition: (position) => set((s) => ({ companion: { ...s.companion, position } })),
      resetCompanion: () => set({ companion: defaultCompanionSettings }),
      bumpCompanionStat: (stat) =>
        set((s) => ({
          companion: { ...s.companion, stats: { ...s.companion.stats, [stat]: (s.companion.stats[stat] ?? 0) + 1 } },
        })),
      equipAccessory: (slot, id) =>
        set((s) => {
          const equipped = { ...s.companion.equipped };
          if (id) equipped[slot] = id;
          else delete equipped[slot];
          return { companion: { ...s.companion, equipped } };
        }),
      markAccessoriesAnnounced: (ids) =>
        set((s) => ({
          companion: { ...s.companion, announced: Array.from(new Set([...s.companion.announced, ...ids])) },
        })),
      markAccessoriesSeen: (ids) =>
        set((s) => {
          const seen = new Set(s.companion.seenAccessories);
          if (ids.every((id) => seen.has(id))) return s;
          return { companion: { ...s.companion, seenAccessories: Array.from(new Set([...seen, ...ids])) } };
        }),
      markCompletionAsked: (slug) =>
        set((s) => ({ companion: { ...s.companion, completionAsked: { ...s.companion.completionAsked, [slug]: Date.now() } } })),
    }),
    {
      name: STORAGE_KEYS.preferences,
      version: 1,
      storage: createJSONStorage(() => persistenceAdapter),
      skipHydration: true,
      partialize: (s) => ({ theme: s.theme, knownTerms: s.knownTerms, companion: s.companion }),
      // Older saves may carry fields that no longer exist (the site-wide `animationSpeed`, the companion's
      // own `animations`); they are dropped. New fields get safe defaults, so existing saves keep working.
      merge: (persisted, current) => {
        const p = { ...((persisted ?? {}) as Partial<PreferencesState> & Record<string, unknown>) };
        delete p.animationSpeed;
        const c = { ...(p.companion ?? {}) } as Partial<CompanionSettings> & { animations?: unknown };
        delete c.animations;
        const announced = Array.isArray(c.announced) ? c.announced : [];
        return {
          ...current,
          ...p,
          companion: {
            ...defaultCompanionSettings,
            ...c,
            stats: { ...defaultCompanionStats, ...(c.stats ?? {}) },
            equipped: c.equipped ?? {},
            announced,
            // Accessories announced before the wardrobe tracked "seen" are not shown as new again.
            seenAccessories: Array.isArray(c.seenAccessories) ? c.seenAccessories : announced,
            topicMeows: typeof c.topicMeows === "boolean" ? c.topicMeows : true,
            completionAsked: c.completionAsked && typeof c.completionAsked === "object" ? c.completionAsked : {},
          },
        };
      },
    },
  ),
);
