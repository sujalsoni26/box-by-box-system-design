import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistenceAdapter, STORAGE_KEYS } from "@/lib/storage/adapter";
import type { AccessoryId, AccessorySlot, CompanionPosition, CompanionSettings, CompanionStats } from "@/types/companion";

export type ThemePreference = "light" | "dark" | "system";

export type LearningGoal = "interview" | "work" | "study" | "curious";

/**
 * The learner's profile: nothing sensitive, all optional. Kept with the settings, so it stays in this browser
 * for guests and follows a signed-in account to every device.
 */
export interface Profile {
  /** Shown on the account and in the header. */
  name: string;
  /** What Cache calls the learner (empty: "hooman"). */
  callMe: string;
  goal: LearningGoal | null;
  /** An interview or exam date, YYYY-MM-DD, for a suggested pace. */
  targetDate: string | null;
}

export const PROFILE_LIMITS = { name: 40, callMe: 24 } as const;
export const DEFAULT_CALL_ME = "hooman";
export const emptyProfile: Profile = { name: "", callMe: "", goal: null, targetDate: null };

const GOALS: readonly LearningGoal[] = ["interview", "work", "study", "curious"];

/** A clean profile from anything (saved data, another device, a form): trims, caps lengths, drops unknown values. */
export function cleanProfile(input: unknown): Profile {
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
  return {
    name: text(p.name, PROFILE_LIMITS.name),
    callMe: text(p.callMe, PROFILE_LIMITS.callMe),
    goal: GOALS.includes(p.goal as LearningGoal) ? (p.goal as LearningGoal) : null,
    targetDate: isCalendarDate(p.targetDate) ? p.targetDate : null,
  };
}

/** A real YYYY-MM-DD date (not 2026-02-31). */
function isCalendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

export interface PreferencesState {
  theme: ThemePreference;
  /** Glossary terms the learner knows; their inline hints are no longer shown. */
  knownTerms: string[];
  companion: CompanionSettings;
  profile: Profile;
}

interface PreferencesActions {
  setTheme: (theme: ThemePreference) => void;
  setProfile: (profile: Partial<Profile>) => void;
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
      profile: emptyProfile,
      setTheme: (theme) => set({ theme }),
      setProfile: (patch) => set((s) => ({ profile: cleanProfile({ ...s.profile, ...patch }) })),
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
      partialize: (s) => ({ theme: s.theme, knownTerms: s.knownTerms, companion: s.companion, profile: s.profile }),
      // Older saves may carry fields that no longer exist (the site-wide `animationSpeed`, the companion's
      // own `animations`); they are dropped. New fields get safe defaults, so existing saves keep working.
      merge: (persisted, current) => {
        const p = { ...((persisted ?? {}) as Partial<PreferencesState> & Record<string, unknown>) };
        delete p.animationSpeed;
        const c = { ...(p.companion ?? {}) } as Partial<CompanionSettings> & { animations?: unknown; sound?: unknown; purr?: unknown; purrVolume?: unknown };
        delete c.animations;
        // Sound settings from a version that had sounds (removed).
        delete c.sound;
        delete c.purr;
        delete c.purrVolume;
        const announced = Array.isArray(c.announced) ? c.announced : [];
        return {
          ...current,
          ...p,
          profile: cleanProfile(p.profile),
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
