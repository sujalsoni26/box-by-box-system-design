import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistenceAdapter, STORAGE_KEYS } from "@/lib/storage/adapter";
import type {
  AccessoryId,
  AccessorySlot,
  AnimationLevel,
  CompanionPosition,
  CompanionSettings,
  CompanionStats,
} from "@/types/companion";

export type ThemePreference = "light" | "dark" | "system";

export interface PreferencesState {
  theme: ThemePreference;
  /** Glossary terms the learner knows; their inline hints are no longer shown. */
  knownTerms: string[];
  /**
   * Site-wide animation speed for pages and the companion. `null` follows the system:
   * reduced when the OS asks for reduced motion, otherwise normal.
   */
  animationSpeed: AnimationLevel | null;
  companion: CompanionSettings;
}

interface PreferencesActions {
  setTheme: (theme: ThemePreference) => void;
  setTermKnown: (term: string, known: boolean) => void;
  /** Pass null to follow the system's reduced-motion setting again. */
  setAnimationSpeed: (speed: AnimationLevel | null) => void;
  setCompanion: (patch: Partial<CompanionSettings>) => void;
  setCompanionPosition: (position: CompanionPosition | null) => void;
  resetCompanion: () => void;
  bumpCompanionStat: (stat: keyof CompanionStats) => void;
  /** Wear an accessory in its slot, or pass null to take the slot's accessory off. */
  equipAccessory: (slot: AccessorySlot, id: AccessoryId | null) => void;
  markAccessoriesAnnounced: (ids: AccessoryId[]) => void;
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
};

const ANIMATION_LEVELS: readonly AnimationLevel[] = ["normal", "slow", "reduced"];

/**
 * Reads the saved speed. Before this setting existed, the companion had its own
 * "Animations: normal | reduced | off"; reduced and off map to "reduced", normal to "follow the system".
 */
function migrateAnimationSpeed(p: Record<string, unknown>): AnimationLevel | null {
  const saved = p.animationSpeed;
  if (typeof saved === "string" && (ANIMATION_LEVELS as readonly string[]).includes(saved)) return saved as AnimationLevel;
  const legacy = (p.companion as { animations?: unknown } | undefined)?.animations;
  return legacy === "reduced" || legacy === "off" ? "reduced" : null;
}

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  persist(
    (set) => ({
      theme: "system",
      knownTerms: [],
      animationSpeed: null,
      companion: defaultCompanionSettings,
      setTheme: (theme) => set({ theme }),
      setTermKnown: (term, known) =>
        set((s) => ({
          knownTerms: known ? Array.from(new Set([...s.knownTerms, term])) : s.knownTerms.filter((t) => t !== term),
        })),
      setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
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
    }),
    {
      name: STORAGE_KEYS.preferences,
      version: 1,
      storage: createJSONStorage(() => persistenceAdapter),
      skipHydration: true,
      partialize: (s) => ({ theme: s.theme, knownTerms: s.knownTerms, animationSpeed: s.animationSpeed, companion: s.companion }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PreferencesState> & Record<string, unknown>;
        const c = { ...(p.companion ?? {}) } as Partial<CompanionSettings> & { animations?: unknown };
        delete c.animations;
        return {
          ...current,
          ...p,
          animationSpeed: migrateAnimationSpeed(p),
          companion: {
            ...defaultCompanionSettings,
            ...c,
            stats: { ...defaultCompanionStats, ...(c.stats ?? {}) },
            equipped: c.equipped ?? {},
            announced: c.announced ?? [],
          },
        };
      },
    },
  ),
);
