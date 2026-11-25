import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistenceAdapter, STORAGE_KEYS } from "@/lib/storage/adapter";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { CompanionMood } from "@/types/companion";

/* ------------------------------------------------------------------ runtime (not persisted) */

export interface BubbleAction {
  label: string;
  /** Internal route; rendered with next/link. */
  href?: string;
  primary?: boolean;
  /** Runs on click. The bubble closes afterwards unless the handler replaced it with a new one. */
  onSelect?: () => void;
}

export interface Bubble {
  id: number;
  /** Short heading under the "Cache" nameplate. */
  title?: string;
  text: string;
  /** Secondary block, e.g. a question to try or a revealed answer. */
  detail?: string;
  detailLabel?: string;
  actions?: BubbleAction[];
  /** Pose the cat holds while this bubble is visible. */
  mood?: CompanionMood;
  /** Auto-dismiss after this many ms; 0 keeps it until dismissed. */
  ms: number;
  /** Move keyboard focus to the first action (only for bubbles the learner asked for). */
  focus: boolean;
  /** True when the learner asked for it; unsolicited tips count towards the nudge budget. */
  solicited: boolean;
}

export type BubbleInput = Omit<Bubble, "id" | "ms" | "focus" | "solicited"> & {
  ms?: number;
  focus?: boolean;
  solicited?: boolean;
};

/** 0 = awake, 1 = settled (sits quietly), 2 = asleep. */
export type IdleLevel = 0 | 1 | 2;
export type MenuView = "main" | "settings" | "wardrobe";
/**
 * A scripted activity the companion component plays out (needs the cat's position):
 * - play: one yarn chase (menu);
 * - lamp: walk to a lamp, leap up, settle, nap, hop down (idle on desktop, or "Lamp nap" in the menu);
 * - break-play: during a focus break, alternate chases and pounces until the break ends or she is pressed.
 */
export type ActivityKind = "play" | "lamp" | "break-play";
export interface CompanionActivity {
  id: number;
  kind: ActivityKind;
  /** Who started it. A lamp nap from the menu sleeps until woken on purpose; an idle one wakes on any activity. */
  trigger: "idle" | "menu" | "focus";
}

interface CompanionRuntimeState {
  bubble: Bubble | null;
  reaction: { id: number; mood: CompanionMood; until: number } | null;
  menuOpen: boolean;
  menuView: MenuView;
  /** Which menu item receives focus when the menu opens. */
  menuFocus: "first" | "last";
  idleLevel: IdleLevel;
  /** Bumped by "Reset position" (an explicit choice); the live companion walks back to its home corner. */
  resetNonce: number;
  /** Last time an unsolicited bubble appeared (rate limit for tips and nudges). */
  lastNudgeAt: number;
  /** Asleep on request ("Nap"): ordinary activity does not wake her; the menu, a tap or a pet does. */
  napping: boolean;
  activity: CompanionActivity | null;
  /** Break play was stopped by the learner for the focus break that started at this time (it stays off for that break). */
  breakPlayOff: number;
  /** Bumped to wake Cache on the lamp on purpose (a tap, "Wake up"); the lamp routine listens. */
  lampWake: number;
  /** ASMR nap: she sleeps (on her lamp where it fits) and purrs continuously until woken. Runtime only. */
  asmr: boolean;
}

interface CompanionRuntimeActions {
  say: (input: BubbleInput) => number;
  dismiss: (id?: number) => void;
  /** Dismiss the bubble only if it has no buttons (route changes, sleep). */
  dismissPlain: () => void;
  react: (mood: CompanionMood, ms: number) => void;
  clearReaction: (id: number) => void;
  openMenu: (focus?: "first" | "last") => void;
  closeMenu: () => void;
  setMenuView: (view: MenuView) => void;
  setIdleLevel: (level: IdleLevel) => void;
  resetPosition: () => void;
  setNapping: (napping: boolean) => void;
  startActivity: (kind: ActivityKind, trigger?: CompanionActivity["trigger"]) => number;
  endActivity: (id: number) => void;
  /** Stop break play for the rest of this break (the learner pressed Cache). */
  stopBreakPlay: (breakStartedAt: number) => void;
  /** Wake her on the lamp: she stretches and hops down. */
  wakeLamp: () => void;
  setAsmr: (on: boolean) => void;
}

let nextId = 1;

function defaultMs(input: BubbleInput): number {
  if (input.ms !== undefined) return input.ms;
  if (input.actions?.length) return 0;
  const length = input.text.length + (input.detail?.length ?? 0);
  return Math.min(12_000, Math.max(3_500, 3_000 + length * 45));
}

export const useCompanionStore = create<CompanionRuntimeState & CompanionRuntimeActions>()((set, get) => ({
  bubble: null,
  reaction: null,
  menuOpen: false,
  menuView: "main",
  menuFocus: "first",
  idleLevel: 0,
  resetNonce: 0,
  lastNudgeAt: 0,
  napping: false,
  activity: null,
  breakPlayOff: 0,
  lampWake: 0,
  asmr: false,

  say: (input) => {
    const id = nextId++;
    const solicited = input.solicited ?? false;
    const bubble: Bubble = { ...input, id, ms: defaultMs(input), focus: input.focus ?? false, solicited };
    set((s) => ({
      bubble,
      menuOpen: false,
      idleLevel: s.napping ? 2 : 0,
      lastNudgeAt: solicited ? s.lastNudgeAt : Date.now(),
    }));
    return id;
  },
  dismiss: (id) => {
    const current = get().bubble;
    if (!current || (id !== undefined && current.id !== id)) return;
    set({ bubble: null });
  },
  dismissPlain: () => {
    const current = get().bubble;
    if (current && !current.actions?.length) set({ bubble: null });
  },
  react: (mood, ms) => set({ reaction: { id: nextId++, mood, until: Date.now() + ms } }),
  clearReaction: (id) => {
    if (get().reaction?.id === id) set({ reaction: null });
  },
  openMenu: (focus = "first") => set({ menuOpen: true, menuView: "main", menuFocus: focus, idleLevel: 0 }),
  closeMenu: () => {
    if (get().menuOpen) set({ menuOpen: false, menuView: "main" });
  },
  setMenuView: (menuView) => set({ menuView }),
  setIdleLevel: (idleLevel) => {
    if (get().idleLevel !== idleLevel) set({ idleLevel });
  },
  setNapping: (napping) => set({ napping, idleLevel: napping ? 2 : 0, menuOpen: false }),
  // Play wakes the cat; an idle lamp keeps the idle level (it wakes on activity). One activity at a time:
  // starting one replaces the last (its routine cleans up when its id changes).
  startActivity: (kind, trigger = "menu") => {
    const id = nextId++;
    set((s) => ({
      activity: { id, kind, trigger },
      napping: false,
      idleLevel: kind === "lamp" && trigger === "idle" ? s.idleLevel : 0,
    }));
    return id;
  },
  endActivity: (id) => {
    if (get().activity?.id === id) set({ activity: null });
  },
  wakeLamp: () => set((s) => ({ lampWake: s.lampWake + 1, napping: false, idleLevel: 0 })),
  setAsmr: (on) => set({ asmr: on }),
  stopBreakPlay: (breakStartedAt) => {
    const a = get().activity;
    set({ breakPlayOff: breakStartedAt, activity: a?.kind === "break-play" ? null : a });
  },
  resetPosition: () => {
    usePreferencesStore.getState().setCompanionPosition(null);
    set((s) => ({ resetNonce: s.resetNonce + 1 }));
  },
}));

/* ------------------------------------------------------------------ focus timer (persisted) */

/** Default focus block; the learner can choose 5–120 minutes (persisted). */
export const DEFAULT_FOCUS_MINUTES = 25;
export const FOCUS_MINUTES_MIN = 5;
export const FOCUS_MINUTES_MAX = 120;
export const BREAK_MS = 5 * 60_000;

/** Whole minutes within the allowed range (non-numbers fall back to the default). */
export function clampFocusMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_FOCUS_MINUTES;
  return Math.min(FOCUS_MINUTES_MAX, Math.max(FOCUS_MINUTES_MIN, Math.round(n)));
}

export type FocusPhase = "focus" | "break";

export interface FocusSession {
  phase: FocusPhase;
  startedAt: number;
  endsAt: number;
  /** Set while paused: when the pause began. Resuming pushes `endsAt` back by the paused time. */
  pausedAt?: number | null;
}

export interface FocusEvent {
  id: number;
  kind: "focus-done" | "break-done";
  /** When the phase actually ended (may be in the past after a refresh). */
  at: number;
}

interface FocusState {
  session: FocusSession | null;
  /** Length of a focus block, minutes (5–120). */
  focusMinutes: number;
  /** Completed focus blocks, all time. */
  sessionsDone: number;
  /** Last phase change, for the companion's notification. Not persisted. */
  lastEvent: FocusEvent | null;
}

interface FocusActions {
  start: (now: number) => void;
  /** Cancel: ends the session without counting it. */
  stop: () => void;
  pause: (now: number) => void;
  resume: (now: number) => void;
  /** Focus → break now; break → finish now. */
  skip: (now: number) => void;
  /** Move to the next phase when the current one has run out. Idempotent; safe to call every second. */
  advance: (now: number) => void;
  /** Applies to the next focus block (a running one keeps its length). */
  setFocusMinutes: (minutes: number) => void;
}

/** Milliseconds left in the current phase (frozen while paused). */
export function focusRemaining(session: FocusSession, now: number): number {
  const at = session.pausedAt ?? now;
  return Math.max(0, session.endsAt - at);
}

export const useFocusStore = create<FocusState & FocusActions>()(
  persist(
    (set, get) => ({
      session: null,
      focusMinutes: DEFAULT_FOCUS_MINUTES,
      sessionsDone: 0,
      lastEvent: null,
      start: (now) => set((s) => ({ session: { phase: "focus", startedAt: now, endsAt: now + s.focusMinutes * 60_000, pausedAt: null } })),
      stop: () => set({ session: null }),
      pause: (now) =>
        set((s) => (s.session && !s.session.pausedAt ? { session: { ...s.session, pausedAt: now } } : s)),
      resume: (now) =>
        set((s) => {
          const session = s.session;
          if (!session?.pausedAt) return s;
          return { session: { ...session, endsAt: session.endsAt + Math.max(0, now - session.pausedAt), pausedAt: null } };
        }),
      skip: (now) =>
        set((s) => {
          if (!s.session) return s;
          if (s.session.phase === "focus") return { session: { phase: "break", startedAt: now, endsAt: now + BREAK_MS, pausedAt: null } };
          return { session: null };
        }),
      setFocusMinutes: (minutes) => set({ focusMinutes: clampFocusMinutes(minutes) }),
      advance: (now) => {
        const before = get().session;
        if (!before || before.pausedAt) return;
        if (before.phase === "focus" && now >= before.endsAt) usePreferencesStore.getState().bumpCompanionStat("focusSessions");
        set((s) => {
          const session = s.session;
          if (!session || session.pausedAt || now < session.endsAt) return s;
          if (session.phase === "focus") {
            const breakEnds = session.endsAt + BREAK_MS;
            const lastEvent: FocusEvent = { id: nextId++, kind: "focus-done", at: session.endsAt };
            // Away for longer than focus + break: end quietly (the companion ignores stale events).
            if (now >= breakEnds) return { session: null, sessionsDone: s.sessionsDone + 1, lastEvent };
            return {
              session: { phase: "break", startedAt: session.endsAt, endsAt: breakEnds, pausedAt: null },
              sessionsDone: s.sessionsDone + 1,
              lastEvent,
            };
          }
          return { session: null, lastEvent: { id: nextId++, kind: "break-done", at: session.endsAt } };
        });
      },
    }),
    {
      name: STORAGE_KEYS.focus,
      version: 1,
      storage: createJSONStorage(() => persistenceAdapter),
      skipHydration: true,
      partialize: (s) => ({ session: s.session, sessionsDone: s.sessionsDone, focusMinutes: s.focusMinutes }),
      // Older saves have no focusMinutes (25 then) and no pausedAt; both get safe defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FocusState>;
        return { ...current, ...p, focusMinutes: clampFocusMinutes(p.focusMinutes ?? DEFAULT_FOCUS_MINUTES) };
      },
    },
  ),
);

let focusRehydrateStarted = false;

/** Loads the persisted focus timer once (client only). Safe to call from several effects. */
export function ensureFocusHydrated(): void {
  if (focusRehydrateStarted || typeof window === "undefined") return;
  focusRehydrateStarted = true;
  void useFocusStore.persist.rehydrate();
}

/** Re-read the focus timer after another tab changed it. */
export function syncFocusFromStorage(): void {
  void useFocusStore.persist.rehydrate();
}

const subscribeFocusHydration = (callback: () => void) => useFocusStore.persist.onFinishHydration(callback);
const focusHydratedSnapshot = () => useFocusStore.persist.hasHydrated();
const focusHydratedServer = () => false;

/** True once the persisted focus timer has loaded on the client. */
export function useFocusHydrated(): boolean {
  return useSyncExternalStore(subscribeFocusHydration, focusHydratedSnapshot, focusHydratedServer);
}
