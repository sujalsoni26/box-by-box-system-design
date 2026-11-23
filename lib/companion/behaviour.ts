import type { CompanionMood } from "@/types/companion";

/*
 * The companion's behaviour as one small state model instead of competing booleans.
 *
 * Two layers, both explicit:
 * 1. Body (owned by use-companion-position): where the cat is and how it moves. Exactly one phase at a
 *    time, and only the listed transitions happen:
 *
 *      resting ─drag→ dragging ─release→ flying ─settle→ landing ─→ resting      (throw, physics on)
 *                                    └→ dropping ─arrive→ landing ─→ resting     (physics off / reduced)
 *      resting ─walk→ walking ─arrive→ resting
 *      resting ─jump→ jumping ─arrive→ perched ─hop down→ jumping ─→ landing ─→ resting   (lamp)
 *      any ─press→ resting (stops motion where it is), any ─resize→ resting (clamped on screen)
 *
 *    The cat always stays where it lands; nothing moves it back to a preset spot.
 *
 * 2. Mind (owned by the stores): what the resting cat is doing. Derived here, never stored, so two
 *    flags can never disagree. Priority: body motion > short reaction > scripted routine > bubble pose >
 *    nap / sleep > focus timer > settled > awake.
 */

export type BodyPhase = "resting" | "dragging" | "flying" | "dropping" | "landing" | "walking" | "jumping" | "perched";

/** A scripted routine the companion plays out: chase the yarn, or the idle lamp nap. */
export type RoutineStep = "lamp-approach" | "lamp-crouch" | "lamp-sit" | "lamp-nap" | "lamp-stretch" | null;

export interface MindState {
  phase: BodyPhase;
  /** Rising (true) or falling (false) while flying; decides "falling" vs the carried pose. */
  rising?: boolean;
  reaction?: CompanionMood | null;
  routine?: RoutineStep;
  bubbleMood?: CompanionMood | null;
  napping: boolean;
  /** 0 awake, 1 settled, 2 asleep. */
  idleLevel: 0 | 1 | 2;
  focusPhase: "focus" | "break" | null;
}

const ROUTINE_MOOD: Record<Exclude<RoutineStep, null>, CompanionMood> = {
  "lamp-approach": "walking",
  "lamp-crouch": "crouching",
  "lamp-sit": "sitting",
  "lamp-nap": "sleeping",
  "lamp-stretch": "stretching",
};

/** The single pose to show for the current state. */
export function deriveMood(s: MindState): CompanionMood {
  switch (s.phase) {
    case "dragging":
      return "dragged";
    case "flying":
      return s.rising ? "jumping" : "falling";
    case "dropping":
      return "falling";
    case "landing":
      return "landing";
    case "walking":
      return "walking";
    case "jumping":
      return "jumping";
    default:
      break;
  }
  if (s.reaction) return s.reaction;
  if (s.routine) {
    // On the lamp the cat follows the idle clock: it sits, then falls asleep there.
    if (s.routine === "lamp-sit" && s.idleLevel === 2) return "sleeping";
    return ROUTINE_MOOD[s.routine];
  }
  if (s.bubbleMood) return s.bubbleMood;
  if (s.napping || s.idleLevel === 2) return "sleeping";
  if (s.focusPhase === "focus") return "studying";
  if (s.focusPhase === "break" || s.idleLevel === 1) return "sitting";
  return "idle";
}

/** Phases in which the body is still and the cat may start something on its own. */
export function isStill(phase: BodyPhase): boolean {
  return phase === "resting" || phase === "perched";
}

export interface QuietInput {
  phase: BodyPhase;
  menuOpen: boolean;
  /** Any bubble is showing (plain or with buttons). */
  bubble: boolean;
  /** A routine (play, lamp) is running. */
  routine: boolean;
  focusRunning: boolean;
  pageVisible: boolean;
}

/**
 * May the companion start something unprompted (a topic meow, the lamp, a completion prompt)?
 * One guard for all of them, so they never collide with each other, a drag, the menu or focus mode.
 */
export function canActOnItsOwn(q: QuietInput): boolean {
  return q.pageVisible && isStill(q.phase) && !q.menuOpen && !q.bubble && !q.routine && !q.focusRunning;
}
