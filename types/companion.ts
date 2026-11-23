export type CompanionMood =
  | "idle"
  | "sitting"
  | "walking"
  | "sleeping"
  | "studying"
  | "thinking"
  | "happy"
  | "celebrating"
  | "confused"
  | "dragged"
  | "eating"
  | "purring"
  | "playing"
  /** Thrown or dropped: legs out, bracing for the floor. */
  | "falling"
  /** A short squash on touching down, then back to the resting pose. */
  | "landing"
  /** Gathering for a jump (lamp). */
  | "crouching"
  /** Rising after a throw: legs dangling, front view. */
  | "jumping"
  /** A deliberate leap (onto the lamp, a pounce): side view, front legs reaching, hind legs pushing. */
  | "leaping"
  /** Waking from a nap: a long stretch and a yawn. */
  | "stretching"
  /** Drowsy: a big yawn on the way to sleep. */
  | "yawning";

/**
 * Motion level from the operating system's prefers-reduced-motion. There is no site-wide speed
 * setting; animated Try it blocks have their own local speed control (components/diagrams/sim-speed.tsx).
 */
export type AnimationLevel = "normal" | "reduced";

export interface CompanionPosition {
  /** Normalised 0..1 of the usable horizontal range. */
  x: number;
  /** Normalised 0..1 of the usable vertical range. */
  y: number;
  /** True when the cat rests on the floor (bottom of the viewport); restored there after refresh. */
  floor?: boolean;
}

export type AccessorySlot = "head" | "eyes" | "neck" | "body";

export type AccessoryId =
  | "bell-collar"
  | "bow-tie"
  | "gold-chain"
  | "bandana"
  | "party-hat"
  | "wizard-hat"
  | "graduation-cap"
  | "round-glasses"
  | "sunglasses"
  | "striped-sweater"
  | "hero-cape"
  /** Original "dark vigilante" costume: cowl with eye holes, slate suit, gold belt and a crescent emblem. */
  | "night-vigilante"
  /** Original "web hero" costume: red mask with web lines and big lenses, red and blue suit. */
  | "web-hero";

/** Play and focus counters, used to unlock accessories. */
export interface CompanionStats {
  feeds: number;
  pets: number;
  plays: number;
  focusSessions: number;
}

export interface CompanionSettings {
  enabled: boolean;
  physics: boolean;
  studyTips: boolean;
  sound: boolean;
  position: CompanionPosition | null;
  stats: CompanionStats;
  /** One accessory per slot. */
  equipped: Partial<Record<AccessorySlot, AccessoryId>>;
  /** Accessories whose unlock has already been announced. */
  announced: AccessoryId[];
  /** Unlocked accessories the learner has looked at in the wardrobe (the rest show as "New"). */
  seenAccessories: AccessoryId[];
  /** Occasional facts about the open lesson ("topic meows"); the learner can pause them. */
  topicMeows: boolean;
  /** Lessons where Cache already asked "mark it as learned?": slug -> when. It never asks twice. */
  completionAsked: Record<string, number>;
}

/** Events any part of the app can emit; the companion decides whether and how to react. */
export type CompanionEvent =
  | { type: "lesson-complete"; slug: string; moduleCompleted: boolean; courseCompleted: boolean }
  | { type: "quiz-answer"; correct: boolean }
  | { type: "quiz-finished"; score: number; total: number }
  | { type: "diagram"; mood: "happy" | "thinking" | "confused"; message?: string }
  | { type: "lesson-opened"; slug: string }
  | { type: "review-marked"; slug: string; marked: boolean };
