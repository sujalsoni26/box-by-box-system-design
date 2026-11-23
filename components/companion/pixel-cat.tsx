"use client";
import { memo, useEffect, useId, useRef } from "react";
import type { CSSProperties } from "react";
import { animate, AnimatePresence, motion, useMotionValue, type Transition } from "motion/react";
import { SIDE_MOODS } from "@/lib/companion/behaviour";
import { bobKeyframes, GAITS, HEAD_STEADY, legKeyframes, type Gait } from "@/lib/companion/gait";
import { cn } from "@/lib/utils";
import type { AccessoryId, AccessorySlot, AnimationLevel, CompanionMood } from "@/types/companion";

/*
 * Cache, drawn as vector parts (body, head, ears, eyes, muzzle, tail, paws) and posed with Motion.
 * "A little pixelated": the fur layers pass through a mosaic filter (5-unit blocks, about 3.5 px at
 * the 84 px desktop size) while the eyes, nose, mouth and the fine parts of accessories stay crisp, so
 * expressions and small details read clearly. The filter only re-runs while something animates. Fur colours
 * come from theme tokens; a faint --ink drop-shadow rim keeps the silhouette readable on dark backgrounds.
 *
 * Two views: front (sitting, reacting) and side (walking, crouching, leaping), cross-faded. Accessories
 * follow every pose: hats and eyewear ride on the head; neckwear sits under the chin, in front of the head
 * (so the head never hides it); capes hang behind the body; costumes recolour the fur layers through CSS
 * variables and add a mask on the head.
 */

type Eyes = "open" | "wide" | "relaxed" | "down" | "up" | "happy" | "closed" | "confused";
type Mouth = "w" | "smile" | "o" | "wavy" | "flat" | "yawn";
type Paws = "sit" | "walk" | "tuck" | "dangle" | "chin" | "book" | "cheer" | "bat" | "spread" | "splay" | "hold";
type Tail = "up" | "high" | "curl" | "wrap" | "hang";
type Extra = "book" | "glasses" | "thought" | "question" | "sparkles" | "zzz" | "blush" | "fish" | "hearts";
type SideMode = "walk" | "crouch" | "leap";
type Suit = "night-vigilante" | "web-hero";

interface Pose {
  head: { x: number; y: number; rotate: number };
  earL: number;
  earR: number;
  earScale: number;
  body: { scaleX: number; scaleY: number };
  tail: Tail;
  eyes: Eyes;
  mouth: Mouth;
  paws: Paws;
  extras: readonly Extra[];
  shadow: { rx: number; opacity: number };
}

const BASE: Pose = {
  head: { x: 0, y: 0, rotate: 0 },
  earL: 0,
  earR: 0,
  earScale: 1,
  body: { scaleX: 1, scaleY: 1 },
  tail: "up",
  eyes: "open",
  mouth: "w",
  paws: "sit",
  extras: [],
  shadow: { rx: 25, opacity: 0.13 },
};

const JUMP: Pose = {
  ...BASE,
  head: { x: 0, y: -3, rotate: 0 },
  earL: -18,
  earR: 18,
  earScale: 0.9,
  body: { scaleX: 0.92, scaleY: 1.1 },
  tail: "high",
  eyes: "wide",
  paws: "dangle",
  shadow: { rx: 14, opacity: 0.05 },
};

const POSES: Record<CompanionMood, Pose> = {
  idle: BASE,
  sitting: { ...BASE, head: { x: 0, y: 1, rotate: 0 }, earL: -5, earR: 5, earScale: 0.96, tail: "wrap", eyes: "relaxed" },
  walking: { ...BASE, head: { x: 0, y: -1, rotate: 0 }, tail: "high", paws: "walk" },
  sleeping: {
    ...BASE,
    head: { x: -7, y: 27, rotate: -14 },
    earL: -16,
    earR: 14,
    earScale: 0.86,
    body: { scaleX: 1.3, scaleY: 0.56 },
    tail: "wrap",
    eyes: "closed",
    paws: "tuck",
    extras: ["zzz"],
    shadow: { rx: 34, opacity: 0.13 },
  },
  studying: {
    ...BASE,
    head: { x: 0, y: 2, rotate: 0 },
    earL: -6,
    earR: 6,
    earScale: 0.96,
    tail: "curl",
    eyes: "down",
    paws: "book",
    extras: ["book", "glasses"],
  },
  thinking: { ...BASE, head: { x: -1, y: 0, rotate: -8 }, earL: -3, earR: 9, tail: "curl", eyes: "up", mouth: "flat", paws: "chin", extras: ["thought"] },
  happy: { ...BASE, head: { x: 0, y: -1, rotate: 5 }, earL: 7, earR: -7, earScale: 1.04, tail: "high", eyes: "happy", mouth: "smile", extras: ["blush"] },
  celebrating: {
    ...BASE,
    head: { x: 0, y: -2, rotate: 0 },
    earL: 8,
    earR: -8,
    earScale: 1.05,
    tail: "high",
    eyes: "happy",
    mouth: "smile",
    paws: "cheer",
    extras: ["blush", "sparkles"],
  },
  confused: { ...BASE, head: { x: 1, y: 0, rotate: 13 }, earL: -22, earR: 4, earScale: 0.95, tail: "curl", eyes: "confused", mouth: "wavy", extras: ["question"] },
  dragged: {
    ...BASE,
    head: { x: 0, y: -2, rotate: 0 },
    earL: -34,
    earR: 34,
    earScale: 0.78,
    body: { scaleX: 0.94, scaleY: 1.06 },
    tail: "hang",
    eyes: "wide",
    mouth: "o",
    paws: "dangle",
    shadow: { rx: 15, opacity: 0.05 },
  },
  // Holding the fish in both paws and nibbling it (the fish is drawn between the head and the paws).
  eating: { ...BASE, head: { x: 0, y: 3, rotate: 0 }, earL: 5, earR: -5, earScale: 1.02, tail: "curl", eyes: "happy", mouth: "o", paws: "hold", extras: ["fish"] },
  purring: { ...BASE, head: { x: 0, y: 0, rotate: 7 }, earL: 6, earR: -6, earScale: 1.02, tail: "high", eyes: "happy", mouth: "w", extras: ["blush", "hearts"] },
  playing: { ...BASE, head: { x: 2, y: 1, rotate: 10 }, earL: 8, earR: -4, earScale: 1.04, tail: "high", eyes: "wide", mouth: "o", paws: "bat" },
  // Transition poses: short in-between states, so the cat never snaps from "carried" to "sitting".
  falling: {
    ...BASE,
    head: { x: 0, y: -2, rotate: 0 },
    earL: -28,
    earR: 28,
    earScale: 0.84,
    body: { scaleX: 0.96, scaleY: 1.05 },
    tail: "up",
    eyes: "wide",
    mouth: "o",
    paws: "spread",
    shadow: { rx: 16, opacity: 0.05 },
  },
  landing: {
    ...BASE,
    head: { x: 0, y: 4, rotate: 0 },
    earL: -10,
    earR: 10,
    earScale: 0.94,
    body: { scaleX: 1.12, scaleY: 0.86 },
    tail: "curl",
    eyes: "relaxed",
    paws: "splay",
    shadow: { rx: 31, opacity: 0.17 },
  },
  // Side-view poses (crouching, leaping) draw the side body; these front values only matter for the head and face.
  crouching: {
    ...BASE,
    head: { x: 0, y: 6, rotate: 0 },
    earL: -14,
    earR: 14,
    earScale: 0.92,
    body: { scaleX: 1.08, scaleY: 0.88 },
    tail: "high",
    eyes: "wide",
    paws: "splay",
    shadow: { rx: 29, opacity: 0.15 },
  },
  jumping: JUMP,
  leaping: { ...JUMP, earL: -24, earR: 24, mouth: "w" },
  stretching: {
    ...BASE,
    head: { x: 0, y: 8, rotate: -6 },
    earL: -8,
    earR: 8,
    earScale: 0.95,
    body: { scaleX: 1.16, scaleY: 0.86 },
    tail: "high",
    eyes: "closed",
    mouth: "o",
    paws: "spread",
    shadow: { rx: 33, opacity: 0.14 },
  },
  yawning: {
    ...BASE,
    head: { x: 0, y: 1, rotate: -5 },
    earL: -12,
    earR: 12,
    earScale: 0.92,
    body: { scaleX: 1.03, scaleY: 0.97 },
    tail: "wrap",
    eyes: "closed",
    mouth: "yawn",
  },
};

/** Every tail shares one command structure (M C C) so Motion can morph between them. */
const TAILS: Record<Tail, string> = {
  up: "M 80 99 C 95 101 105 92 103 79 C 102 72 96 69 93 74",
  high: "M 80 98 C 91 96 98 85 97 71 C 96.5 64 92 59 88 62",
  curl: "M 80 100 C 94 104 104 98 104 88 C 104 82 99 80 97 84",
  wrap: "M 80 102 C 90 108 79 111 63 111 C 53 111 45 109.5 42 106",
  hang: "M 72 100 C 74 107 73 112 70 116 C 69 118 67 118.5 66 117",
};

type PawShape = { cx: number; cy: number; rx: number; ry: number; opacity: number };
const SIT_L: PawShape = { cx: 51, cy: 104, rx: 6.5, ry: 4.4, opacity: 1 };
const SIT_R: PawShape = { cx: 69, cy: 104, rx: 6.5, ry: 4.4, opacity: 1 };
const PAWS: Record<Paws, readonly [PawShape, PawShape]> = {
  sit: [SIT_L, SIT_R],
  walk: [SIT_L, SIT_R],
  tuck: [
    { cx: 50, cy: 105, rx: 6, ry: 3.6, opacity: 0 },
    { cx: 66, cy: 105, rx: 6, ry: 3.6, opacity: 0 },
  ],
  dangle: [
    { cx: 50, cy: 112, rx: 4.8, ry: 6.4, opacity: 1 },
    { cx: 70, cy: 112, rx: 4.8, ry: 6.4, opacity: 1 },
  ],
  chin: [SIT_L, { cx: 66, cy: 67, rx: 5.4, ry: 4.6, opacity: 1 }],
  book: [
    { cx: 45.5, cy: 86, rx: 5, ry: 4.4, opacity: 1 },
    { cx: 74.5, cy: 86, rx: 5, ry: 4.4, opacity: 1 },
  ],
  cheer: [
    { cx: 37, cy: 70, rx: 5, ry: 5.6, opacity: 1 },
    { cx: 83, cy: 70, rx: 5, ry: 5.6, opacity: 1 },
  ],
  bat: [SIT_L, { cx: 82, cy: 95, rx: 5.6, ry: 4.8, opacity: 1 }],
  spread: [
    { cx: 38, cy: 100, rx: 5.6, ry: 4.6, opacity: 1 },
    { cx: 82, cy: 100, rx: 5.6, ry: 4.6, opacity: 1 },
  ],
  splay: [
    { cx: 47, cy: 104.5, rx: 7, ry: 4.2, opacity: 1 },
    { cx: 73, cy: 104.5, rx: 7, ry: 4.2, opacity: 1 },
  ],
  // Both paws under the fish, holding it up to the mouth.
  hold: [
    { cx: 48, cy: 86.5, rx: 5.2, ry: 4.4, opacity: 1 },
    { cx: 68.5, cy: 87, rx: 5.2, ry: 4.4, opacity: 1 },
  ],
};

/*
 * Side view (walking, crouching, leaping): a long body on four two-segment legs (thigh and shin, a haunch on
 * the hind legs), drawn facing right and mirrored for left. The round head stays turned towards the viewer, as
 * cats in illustrations often do. Legs follow lib/companion/gait.ts: diagonal pairs, straight planted legs in
 * stance, a knee bend and a reach in swing.
 */
const SIDE_BODY_D = "M 30 85 C 30 74 41 69.5 58 69.5 C 76 69.5 92 73 92 83.5 C 92 93.5 84 98 71 98 L 45 98 C 35 98 30 93.5 30 85 Z";
const SIDE_TAIL_D = "M 32 82 C 21 80 16 70 18 60 C 19 55 23 53 25.5 56";
const LEGS = [
  { x: 39, far: true, phase: 0, front: false },
  { x: 73, far: true, phase: 1, front: true },
  { x: 47, far: false, phase: 1, front: false },
  { x: 81, far: false, phase: 0, front: true },
] as const;
/** Hind thigh (a rounded haunch), fore upper leg and the shin with its paw; the knee pivot is at y 98. */
const thighD = (x: number) =>
  `M ${x - 4.8} 86.5 C ${x - 5.4} 92 ${x - 4.2} 96.5 ${x - 3.3} 99.6 L ${x + 3.3} 99.6 C ${x + 4.6} 95 ${x + 4.8} 90 ${x + 3.9} 86.5 Z`;
const foreD = (x: number) => `M ${x - 3.4} 87.5 L ${x - 3.3} 99.6 L ${x + 3.3} 99.6 L ${x + 3.4} 87.5 Z`;
const shinD = (x: number) =>
  `M ${x - 3.3} 97 L ${x - 3.4} 104.6 Q ${x - 3.4} 108.2 ${x} 108.2 Q ${x + 3.4} 108.2 ${x + 3.4} 104.6 L ${x + 3.3} 97 Z`;

const BODY_D = "M 41 104 C 35 104 33 96 34.5 87 C 36.5 75 45 63 60 63 C 75 63 83.5 75 85.5 87 C 87 96 85 104 79 104 Z";
const HEAD_D =
  "M 30 47 C 30 31 43 23 60 23 C 77 23 90 31 90 47 C 90 55 87 61 82 64 C 76 68 68 69 60 69 C 52 69 44 68 38 64 C 33 61 30 55 30 47 Z";
/** The cape behind the body, wide enough to show down both sides from the front; and billowing (same commands, so Motion morphs between them). */
const CAPE_HANG = "M 46 66 Q 60 70 74 66 L 103 106 Q 80 111 60 108 Q 40 111 17 106 Z";
const CAPE_BILLOW = "M 46 66 Q 60 70 74 66 L 109 95 Q 84 104 60 100 Q 36 104 11 95 Z";
const BLINKABLE: ReadonlySet<Eyes> = new Set(["open", "wide", "up", "relaxed", "down", "confused"]);
const EYE_L = { cx: 48, cy: 45 };
const EYE_R = { cx: 72, cy: 45 };
/** Mosaic block size in viewBox units (120 units = the cat's width). */
const BLOCK = 5;
/** Moods in the air: the cape billows. */
const AIRBORNE: ReadonlySet<CompanionMood> = new Set<CompanionMood>(["dragged", "falling", "jumping"]);

type CatStyle = CSSProperties & Record<`--${string}`, string>;
/**
 * Palette. Fur derives from tokens (--amber), so it follows the theme. Costume colours are fixed art
 * colours (the same suit in both themes), chosen to contrast with the fur, the outline and both page grounds.
 */
const CAT_STYLE: CatStyle = {
  "--cat-fur": "var(--amber)",
  "--cat-fur-dark": "color-mix(in oklab, var(--amber) 70%, black)",
  "--cat-cream": "color-mix(in oklab, var(--amber) 20%, white)",
  "--cat-line": "color-mix(in oklab, var(--amber) 28%, black)",
  "--cat-eye": "color-mix(in oklab, var(--amber) 12%, black)",
  "--cat-pink": "color-mix(in oklab, var(--bad) 40%, white)",
  "--cat-mouth": "color-mix(in oklab, var(--bad) 45%, black)",
  "--cat-shine": "white",
  "--cat-gold": "color-mix(in oklab, var(--amber) 72%, white)",
  // Jewellery gold: brighter and cooler than the fur, always with a dark outline.
  "--cat-gold-hi": "oklch(0.9 0.14 95)",
  "--cat-gold-lo": "oklch(0.66 0.13 80)",
  "--suit-slate": "oklch(0.41 0.03 265)",
  "--suit-slate-2": "oklch(0.53 0.035 265)",
  "--suit-slate-3": "oklch(0.29 0.025 265)",
  "--suit-red": "oklch(0.57 0.2 27)",
  "--suit-red-2": "oklch(0.45 0.17 25)",
  "--suit-blue": "oklch(0.47 0.15 262)",
  "--suit-blue-2": "oklch(0.37 0.12 262)",
  "--suit-web": "oklch(0.24 0.06 25)",
  "--fish": "oklch(0.8 0.07 228)",
  "--fish-back": "oklch(0.58 0.11 240)",
  "--fish-belly": "oklch(0.94 0.025 220)",
  "--fish-bone": "oklch(0.97 0.01 90)",
  "--cat-lens": "oklch(0.98 0.008 90)",
  filter:
    "drop-shadow(0 0 0.8px color-mix(in srgb, var(--ink) 45%, transparent)) drop-shadow(0 3px 5px hsl(var(--shadow-color) / 0.22))",
};

/** Costume colours for the body, tail, legs and paws: the fur variables, redirected. */
const SUIT_BODY: Record<Suit, CatStyle> = {
  "night-vigilante": { "--cat-fur": "var(--suit-slate)", "--cat-fur-dark": "var(--suit-slate-3)", "--cat-cream": "var(--suit-slate-2)" },
  // Blue sides and legs, a red chest panel and red gloves.
  "web-hero": { "--cat-fur": "var(--suit-blue)", "--cat-fur-dark": "var(--suit-blue-2)", "--cat-cream": "var(--suit-red)" },
};
/** Costume colours for the head: the vigilante's cowl only covers the ears and brow (drawn on top); the web hero's mask is the whole head. */
const SUIT_EARS: Record<Suit, CatStyle> = {
  "night-vigilante": { "--cat-fur": "var(--suit-slate)", "--cat-pink": "var(--suit-slate-3)" },
  "web-hero": { "--cat-fur": "var(--suit-red)", "--cat-pink": "var(--suit-red-2)" },
};
const SUIT_HEAD: Partial<Record<Suit, CatStyle>> = {
  "web-hero": { "--cat-fur": "var(--suit-red)", "--cat-cream": "var(--suit-red)", "--cat-fur-dark": "var(--suit-red-2)" },
};

function suitOf(id: AccessoryId | undefined): Suit | null {
  return id === "night-vigilante" || id === "web-hero" ? id : null;
}

/** Transform origin in viewBox units (Motion sets transform-box for SVG; we pin it to the view box). */
const pivot = (x: number, y: number) => ({ originX: `${x}px`, originY: `${y}px`, transformBox: "view-box" as const });

const SPARKLE = "M 0 -7 C 1 -2 2 -1 7 0 C 2 1 1 2 0 7 C -1 2 -2 1 -7 0 C -2 -1 -1 -2 0 -7 Z";
const SPARKLES = [
  { x: 17, y: 40, tone: "fill-amber", delay: 0, scale: 1 },
  { x: 103, y: 30, tone: "fill-accent", delay: 0.12, scale: 0.85 },
  { x: 12, y: 82, tone: "fill-accent", delay: 0.22, scale: 0.75 },
  { x: 108, y: 76, tone: "fill-amber", delay: 0.32, scale: 0.95 },
] as const;
const HEART = "M 0 3.2 C -5.5 -1 -4.6 -6.4 0 -3.8 C 4.6 -6.4 5.5 -1 0 3.2 Z";

export type EquippedAccessories = Partial<Record<AccessorySlot, AccessoryId>>;

export interface PixelCatProps {
  mood?: CompanionMood;
  /** Which way the cat is heading (the side view is mirrored for "left"). */
  facing?: "left" | "right";
  /** Walking cadence; the position hook moves the cat at the matching speed. */
  gait?: Gait;
  /** During a leap: true on the way up (nose up), false on the way down. */
  rising?: boolean;
  /** "normal" poses with springs and plays idle beats; "reduced" (prefers-reduced-motion) snaps between poses. */
  motionLevel?: AnimationLevel;
  /** Allow occasional idle micro-motions (blink, tail flick, ear twitch, drifting z). */
  ambient?: boolean;
  /** Eyes follow a mouse pointer (only while `ambient`). */
  gaze?: boolean;
  /** Worn accessories, one per slot. */
  accessories?: EquippedAccessories;
  /** Mosaic look; on by default. */
  pixelated?: boolean;
  /** Accessible name; omit when a parent (the companion button) already names the cat. */
  label?: string;
  className?: string;
}

function hopFor(mood: CompanionMood, animated: boolean, gait: Gait): { y: number | number[]; transition: Transition } {
  if (!animated) return { y: 0, transition: { duration: 0 } };
  switch (mood) {
    case "walking": {
      // The body rides the stance legs (two arcs per cycle), in step with them: same cycle, same start.
      const bob = bobKeyframes(gait);
      return { y: bob.y, transition: { y: { duration: GAITS[gait].cycleS, times: bob.times, repeat: Infinity, ease: "linear" } } };
    }
    case "celebrating":
      return { y: [0, -12, 0, -4, 0], transition: { y: { duration: 0.9, ease: "easeOut" } } };
    case "happy":
      return { y: [0, -5, 0], transition: { y: { duration: 0.45, ease: "easeOut" } } };
    case "eating":
      // Chewing: small nods while the fish is nibbled.
      return { y: [0, 1.4, 0], transition: { y: { duration: 0.34, repeat: 5, ease: "easeInOut", delay: 0.25 } } };
    case "playing":
      return { y: [0, -3, 0], transition: { y: { duration: 0.3, ease: "easeOut" } } };
    case "landing":
      return { y: [0, 2, 0], transition: { y: { duration: 0.28, ease: "easeOut" } } };
    case "stretching":
      return { y: [0, 1.5, 0], transition: { y: { duration: 0.7, ease: "easeInOut" } } };
    case "yawning":
      return { y: [0, -1.2, 0], transition: { y: { duration: 1.1, ease: "easeInOut" } } };
    default:
      return { y: 0, transition: { y: { duration: 0.25, ease: "easeOut" } } };
  }
}

function PixelCatImpl({
  mood = "idle",
  facing = "right",
  gait = "walk",
  rising = false,
  motionLevel = "normal",
  ambient = false,
  gaze = false,
  accessories,
  pixelated = true,
  label,
  className,
}: PixelCatProps) {
  const pose = POSES[mood];
  const animated = motionLevel !== "reduced";
  const side = SIDE_MOODS.has(mood);
  const sideMode: SideMode = mood === "crouching" ? "crouch" : mood === "leaping" ? "leap" : "walk";
  const dir = facing === "left" ? -1 : 1;
  const svgRef = useRef<SVGSVGElement>(null);
  const moodRef = useRef(mood);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pxId = `cat-px-${uid}`;
  const clipId = `cat-body-${uid}`;
  const headClipId = `cat-head-${uid}`;
  const fur = pixelated ? `url(#${pxId})` : undefined;
  const wear = accessories ?? {};
  const suit = suitOf(wear.body);
  const caped = wear.body === "hero-cape" || suit === "night-vigilante";

  // Imperative one-shot motions, driven by the beat timer below (no continuous loops at rest).
  const blink = useMotionValue(1);
  const tailFlick = useMotionValue(0);
  const earTwitch = useMotionValue(0);
  const zLift = useMotionValue(0);
  const gazeX = useMotionValue(0);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    if (!ambient || !animated) return;
    let timer = 0;
    let beat = 0;
    const running: Array<{ stop: () => void }> = [];
    const play = () => {
      beat += 1;
      const current = POSES[moodRef.current];
      if (current.extras.includes("zzz")) {
        running.push(animate(zLift, [0, -6, 0], { duration: 2.4, ease: "easeInOut" }));
      } else {
        if (BLINKABLE.has(current.eyes)) running.push(animate(blink, [1, 0.1, 1], { duration: 0.24, times: [0, 0.45, 1] }));
        if (beat % 3 === 0) running.push(animate(tailFlick, [0, 9, -4, 0], { duration: 0.9, ease: "easeInOut" }));
        if (beat % 4 === 2) running.push(animate(earTwitch, [0, -11, 0], { duration: 0.34, ease: "easeOut" }));
      }
      if (running.length > 8) running.splice(0, running.length - 8);
      timer = window.setTimeout(play, 3200 + Math.random() * 4800);
    };
    timer = window.setTimeout(play, 1800 + Math.random() * 2500);
    return () => {
      window.clearTimeout(timer);
      running.forEach((a) => a.stop());
      blink.set(1);
      tailFlick.set(0);
      earTwitch.set(0);
      zLift.set(0);
    };
  }, [ambient, animated, blink, tailFlick, earTwitch, zLift]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !ambient || !animated || !gaze) return;
    let raf = 0;
    let px = 0;
    let target = 0;
    let anim: { stop: () => void } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = svg.getBoundingClientRect();
        const centre = r.left + r.width / 2;
        const next = px < centre - 90 ? -1 : px > centre + 90 ? 1 : 0;
        if (next === target) return;
        target = next;
        anim?.stop();
        anim = animate(gazeX, next * 1.7, { duration: 0.25, ease: "easeOut" });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      anim?.stop();
      gazeX.set(0);
    };
  }, [ambient, animated, gaze, gazeX]);

  const spring: Transition = animated ? { type: "spring", stiffness: 300, damping: 24, mass: 0.8 } : { duration: 0 };
  const morph: Transition = animated ? { duration: 0.32, ease: "easeOut" } : { duration: 0 };
  const fade: Transition = animated ? { duration: 0.2 } : { duration: 0 };
  // Swapping between the front (sitting) and side (moving) bodies is a short cross-fade, never a cut.
  const swap: Transition = animated ? { duration: 0.16, ease: "easeOut" } : { duration: 0 };
  const has = (e: Extra) => pose.extras.includes(e);
  const hop = hopFor(mood, animated, gait);
  // In side view the head leads, ahead of the body, tipping into the direction of travel.
  const head = side
    ? sideMode === "crouch"
      ? { x: dir * 23, y: 9, rotate: dir * 3 }
      : sideMode === "leap"
        ? { x: dir * 22, y: rising ? -2 : 1, rotate: dir * (rising ? -7 : 6) }
        : { x: dir * 21, y: 3, rotate: dir * 5 }
    : pose.head;
  const shadow = side
    ? sideMode === "leap"
      ? { rx: 20, opacity: 0.06 }
      : sideMode === "crouch"
        ? { rx: 35, opacity: 0.15 }
        : { rx: 33, opacity: 0.13 }
    : pose.shadow;
  const walkBob = side && sideMode === "walk" && animated ? bobKeyframes(gait) : null;
  const headSteady = walkBob
    ? {
        animate: { y: walkBob.y.map((v) => -HEAD_STEADY * v) },
        transition: { y: { duration: GAITS[gait].cycleS, times: walkBob.times, repeat: Infinity, ease: "linear" as const } },
      }
    : { animate: { y: 0 }, transition: { y: { duration: animated ? 0.2 : 0 } } };
  const bodyVars = suit ? SUIT_BODY[suit] : undefined;
  const earVars = suit ? SUIT_EARS[suit] : undefined;
  const headVars = suit ? SUIT_HEAD[suit] : undefined;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      overflow="visible"
      className={cn("block select-none", className)}
      style={CAT_STYLE}
      focusable="false"
      data-view={side ? `side-${sideMode}` : "front"}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        {/* Mosaic: sample one point per BLOCK×BLOCK cell, then grow it back to fill the cell. */}
        <filter id={pxId} filterUnits="userSpaceOnUse" x={-20} y={-20} width={160} height={160} colorInterpolationFilters="sRGB">
          <feFlood x={-18} y={-18} width={1} height={1} result="dot" />
          <feComposite in="dot" in2="dot" operator="over" x={-20} y={-20} width={BLOCK} height={BLOCK} result="cell" />
          <feTile in="cell" result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" result="samples" />
          <feMorphology in="samples" operator="dilate" radius={(BLOCK - 1) / 2} />
        </filter>
        <clipPath id={clipId}>
          <path d={BODY_D} />
        </clipPath>
        <clipPath id={headClipId}>
          <path d={HEAD_D} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx={60}
        cy={110}
        ry={3.6}
        className="fill-ink"
        initial={false}
        animate={{ rx: shadow.rx, opacity: shadow.opacity }}
        transition={spring}
      />

      <motion.g initial={false} animate={{ y: hop.y }} transition={hop.transition}>
        {/* side view (walking, crouching, leaping), cross-faded with the front view */}
        <AnimatePresence initial={false}>
          {side ? (
            <motion.g key="side" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={swap}>
              <SideBody
                fur={fur}
                flip={dir === -1}
                animated={animated}
                wear={wear}
                suit={suit}
                clipId={`${clipId}-side`}
                mode={sideMode}
                gait={gait}
                rising={rising}
              />
            </motion.g>
          ) : null}
        </AnimatePresence>

        {/* front view: tail and body fade out in side view */}
        <motion.g initial={false} animate={{ opacity: side ? 0 : 1 }} transition={swap}>
          {/* tail */}
          <g style={bodyVars}>
            <motion.g style={{ rotate: tailFlick, ...pivot(80, 100) }}>
              <g filter={fur}>
                <motion.path
                  className="fill-none stroke-(--cat-line)"
                  strokeWidth={10.5}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d: TAILS[pose.tail] }}
                  transition={morph}
                />
                <motion.path
                  className="fill-none stroke-(--cat-fur)"
                  strokeWidth={7}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d: TAILS[pose.tail] }}
                  transition={morph}
                />
              </g>
            </motion.g>
          </g>

          {/* body: cape behind, then the body, then sweater or costume details */}
          <g style={bodyVars}>
            <motion.g style={pivot(60, 106)} initial={false} animate={pose.body} transition={spring}>
              <g filter={fur}>
                {caped ? (
                  <motion.path
                    className={cn(
                      "stroke-(--cat-line)",
                      suit === "night-vigilante" ? "fill-(--suit-slate-3)" : "fill-bad",
                    )}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ d: animated && AIRBORNE.has(mood) ? CAPE_BILLOW : CAPE_HANG }}
                    transition={animated ? { type: "spring", stiffness: 160, damping: 14 } : { duration: 0 }}
                  />
                ) : null}
                <path d={BODY_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
                {wear.body === "striped-sweater" ? (
                  <Sweater clipId={clipId} />
                ) : (
                  <>
                    <ellipse cx={60} cy={88} rx={10.5} ry={13.5} className="fill-(--cat-cream)" />
                    <path
                      d="M 37.5 88 Q 41.5 89 43.5 86 M 37 95 Q 41 96 43 93 M 82.5 88 Q 78.5 89 76.5 86 M 83 95 Q 79 96 77 93"
                      className="fill-none stroke-(--cat-fur-dark)"
                      strokeWidth={2.1}
                      strokeLinecap="round"
                    />
                  </>
                )}
              </g>
              {suit ? <SuitFront suit={suit} clipId={clipId} /> : null}
            </motion.g>
          </g>
        </motion.g>

        {/* book (studying) */}
        <AnimatePresence initial={false}>
          {has("book") ? (
            <motion.g
              key="book"
              initial={animated ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={animated ? { opacity: 0, y: 6 } : { opacity: 0 }}
              transition={fade}
            >
              <path
                d="M 41.5 76.5 L 41.5 93.5 C 49 92.5 55 93 60 95.5 C 65 93 71 92.5 78.5 93.5 L 78.5 76.5"
                className="fill-none stroke-accent"
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <path
                d="M 60 77 C 55 74.5 49 74 43 75 L 43 92 C 49 91 55 91.5 60 94 Z M 60 77 C 65 74.5 71 74 77 75 L 77 92 C 71 91 65 91.5 60 94 Z"
                className="fill-(--cat-cream) stroke-accent"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              <path
                d="M 47 79.5 L 56 80.6 M 47 83.2 L 56 84.2 M 47 86.9 L 53 87.6 M 64 80.6 L 73 79.5 M 64 84.2 L 73 83.2 M 67 87.6 L 73 86.9"
                className="fill-none stroke-line-strong"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            </motion.g>
          ) : null}
        </AnimatePresence>

        {/* head: steadier than the body while walking (it cancels part of the bob) */}
        <motion.g initial={false} {...headSteady}>
        <motion.g style={pivot(60, 66)} initial={false} animate={head} transition={spring}>
          <g filter={fur} style={headVars}>
            {/* ears sit behind the head shape */}
            <g style={earVars}>
              <motion.g style={pivot(45, 31)} initial={false} animate={{ rotate: pose.earL, scaleY: pose.earScale }} transition={spring}>
                <path
                  d="M 37 35 C 34 26 32 17 33 11 C 33.5 8.5 35.5 8 37.5 9.5 C 42 13 48 19 53 27 Z"
                  className="fill-(--cat-fur) stroke-(--cat-line)"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                />
                <path d="M 38.5 30 C 37 24 36 18 36.5 14 C 40 17 44 21 47.5 25.5 Z" className="fill-(--cat-pink)" />
              </motion.g>
              <motion.g style={pivot(75, 31)} initial={false} animate={{ rotate: pose.earR, scaleY: pose.earScale }} transition={spring}>
                <motion.g style={{ rotate: earTwitch, ...pivot(75, 31) }}>
                  <path
                    d="M 83 35 C 86 26 88 17 87 11 C 86.5 8.5 84.5 8 82.5 9.5 C 78 13 72 19 67 27 Z"
                    className="fill-(--cat-fur) stroke-(--cat-line)"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                  />
                  <path d="M 81.5 30 C 83 24 84 18 83.5 14 C 80 17 76 21 72.5 25.5 Z" className="fill-(--cat-pink)" />
                </motion.g>
              </motion.g>
            </g>

            <path d={HEAD_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
            <path
              d="M 55 26 L 56 31.5 M 60 25 L 60 31 M 65 26 L 64 31.5"
              className="fill-none stroke-(--cat-fur-dark)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <ellipse cx={55.2} cy={56} rx={5.8} ry={4.4} className="fill-(--cat-cream)" />
            <ellipse cx={64.8} cy={56} rx={5.8} ry={4.4} className="fill-(--cat-cream)" />
            {suit === "night-vigilante" ? <Cowl /> : null}
            {wear.head ? <Hat id={wear.head} /> : null}
          </g>

          <AnimatePresence initial={false}>
            {has("blush") && suit !== "web-hero" ? (
              <motion.g key="blush" initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }} transition={fade}>
                <ellipse cx={41.5} cy={55} rx={4.2} ry={2.5} className="fill-(--cat-pink)" />
                <ellipse cx={78.5} cy={55} rx={4.2} ry={2.5} className="fill-(--cat-pink)" />
              </motion.g>
            ) : null}
          </AnimatePresence>

          {suit ? <MaskDetails suit={suit} headClipId={headClipId} /> : null}

          {/* eyes stay crisp: gaze shifts both, blink squashes each around its own centre; in side view they look ahead */}
          <motion.g initial={false} animate={{ x: side ? dir * 1.6 : 0 }} transition={spring}>
            <motion.g style={{ x: gazeX }}>
              <motion.g style={{ scaleY: blink, ...pivot(EYE_L.cx, EYE_L.cy) }}>
                <Eye {...EYE_L} shape={pose.eyes} side="left" />
              </motion.g>
              <motion.g style={{ scaleY: blink, ...pivot(EYE_R.cx, EYE_R.cy) }}>
                <Eye {...EYE_R} shape={pose.eyes} side="right" />
              </motion.g>
            </motion.g>
          </motion.g>

          <path
            d="M 57.4 51.2 Q 60 50 62.6 51.2 Q 61.6 53.8 60 54.2 Q 58.4 53.8 57.4 51.2 Z"
            className="fill-(--cat-pink) stroke-(--cat-line)"
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <Mouth shape={pose.mouth} />
          <path
            d="M 44 55 L 31 52.5 M 44 58 L 31 59.5 M 76 55 L 89 52.5 M 76 58 L 89 59.5"
            className="fill-none stroke-(--cat-line)"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.5}
          />

          {/* Neckwear and cape clasps sit under the chin, in front of the head, and move with it in every pose. */}
          {caped ? <CapeClasps dark={suit === "night-vigilante"} /> : null}
          {wear.neck ? <Neckwear id={wear.neck} /> : null}

          {wear.eyes ? <Eyewear id={wear.eyes} /> : null}
          <AnimatePresence initial={false}>
            {has("glasses") && !wear.eyes ? (
              <motion.g key="glasses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                <RoundGlasses />
              </motion.g>
            ) : null}
          </AnimatePresence>
        </motion.g>
        </motion.g>

        {/* the fish (Feed): held in both paws, drawn between the head and the paws */}
        <AnimatePresence initial={false}>{has("fish") ? <FishSnack key="fish" uid={uid} animated={animated} /> : null}</AnimatePresence>

        {/* paws (front layer, so a paw can rest on the chin, hold the book or the fish, or bat the yarn); hidden in side view */}
        <g style={bodyVars}>
          <motion.g filter={fur} initial={false} animate={{ opacity: side ? 0 : 1 }} transition={swap}>
            {PAWS[pose.paws].map((paw, i) => (
              <motion.ellipse key={i} className="fill-(--cat-cream) stroke-(--cat-line)" strokeWidth={1.8} initial={false} animate={paw} transition={spring} />
            ))}
          </motion.g>
        </g>
      </motion.g>

      {/* overlays */}
      <AnimatePresence initial={false}>
        {has("hearts") ? (
          <motion.g key="hearts" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            {[
              { x: 88, y: 40, delay: 0, s: 1.3 },
              { x: 99, y: 27, delay: 0.25, s: 1 },
            ].map((h) => (
              <g key={h.x} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
                <motion.path
                  d={HEART}
                  className="fill-bad"
                  initial={animated ? { opacity: 0, y: 4 } : false}
                  animate={animated ? { opacity: [0, 1, 1, 0], y: [4, 0, -4, -8] } : { opacity: 1 }}
                  transition={animated ? { duration: 1.5, delay: h.delay, ease: "easeOut" } : { duration: 0 }}
                />
              </g>
            ))}
          </motion.g>
        ) : null}
        {has("thought") ? (
          <motion.g key="thought" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <circle cx={87} cy={32} r={2.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={93.5} cy={23.5} r={3.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={103} cy={12} r={6.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={100.4} cy={12} r={0.95} className="fill-ink-3" />
            <circle cx={103} cy={12} r={0.95} className="fill-ink-3" />
            <circle cx={105.6} cy={12} r={0.95} className="fill-ink-3" />
          </motion.g>
        ) : null}
        {has("question") ? (
          <motion.text
            key="question"
            x={101}
            y={28}
            textAnchor="middle"
            className="fill-accent font-display"
            fontSize={24}
            fontWeight={800}
            initial={animated ? { opacity: 0, y: 6 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            ?
          </motion.text>
        ) : null}
        {has("zzz") ? (
          <motion.g key="zzz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <motion.g style={{ y: zLift }}>
              <text x={86} y={60} className="fill-ink-3 font-display" fontSize={10} fontWeight={700}>
                z
              </text>
              <text x={95} y={47} className="fill-ink-3 font-display" fontSize={14} fontWeight={700}>
                Z
              </text>
            </motion.g>
          </motion.g>
        ) : null}
        {has("sparkles") ? (
          <motion.g key="sparkles" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            {SPARKLES.map((s) => (
              <g key={`${s.x}-${s.y}`} transform={`translate(${s.x} ${s.y})`}>
                <motion.path
                  d={SPARKLE}
                  className={s.tone}
                  initial={animated ? { scale: 0, rotate: -30 } : false}
                  animate={animated ? { scale: [0, s.scale * 1.15, s.scale], rotate: 0 } : { scale: s.scale }}
                  transition={animated ? { duration: 0.55, delay: s.delay, ease: "easeOut" } : { duration: 0 }}
                />
              </g>
            ))}
          </motion.g>
        ) : null}
      </AnimatePresence>
    </svg>
  );
}

/* ------------------------------------------------------------------ side view (walking, crouching, leaping) */

interface SideBodyProps {
  fur: string | undefined;
  flip: boolean;
  animated: boolean;
  wear: EquippedAccessories;
  suit: Suit | null;
  clipId: string;
  mode: SideMode;
  gait: Gait;
  rising: boolean;
}

const SIDE_BODY_POSE: Record<SideMode, { y: number; scaleX: number; scaleY: number }> = {
  walk: { y: 0, scaleX: 1, scaleY: 1 },
  // Gathered low over folded legs before a jump (paws stay on the floor line).
  crouch: { y: 2.6, scaleX: 1.05, scaleY: 0.9 },
  // Stretched out in the air.
  leap: { y: -1, scaleX: 1.07, scaleY: 0.97 },
};

function SideBody({ fur, flip, animated, wear, suit, clipId, mode, gait, rising }: SideBodyProps) {
  const spec = GAITS[gait];
  const bodyMotion = !animated
    ? { animate: { ...SIDE_BODY_POSE[mode], rotate: 0 }, transition: { duration: 0 } }
    : mode === "crouch"
      ? {
          // A little wiggle of the hips before the pounce.
          animate: { ...SIDE_BODY_POSE.crouch, rotate: [0, 1.8, -0.8, 1.8, 0] },
          transition: { rotate: { duration: 0.42, repeat: Infinity, ease: "easeInOut" as const }, default: { duration: 0.2 } },
        }
      : mode === "leap"
        ? { animate: { ...SIDE_BODY_POSE.leap, rotate: rising ? -11 : 9 }, transition: { duration: 0.22, ease: "easeOut" as const } }
        : { animate: { ...SIDE_BODY_POSE.walk, rotate: 0 }, transition: { duration: 0.2 } };

  const tailMotion = !animated
    ? { animate: { rotate: 0 }, transition: { duration: 0 } }
    : mode === "walk"
      ? { animate: { rotate: [-5, 6, -5] }, transition: { duration: spec.cycleS * 2, repeat: Infinity, ease: "easeInOut" as const } }
      : mode === "crouch"
        ? { animate: { rotate: [-34, -24, -34] }, transition: { duration: 0.3, repeat: Infinity, ease: "easeInOut" as const } }
        : { animate: { rotate: -46 }, transition: { duration: 0.2 } };

  const capeMotion = !animated
    ? { animate: { rotate: 0 }, transition: { duration: 0 } }
    : mode === "walk"
      ? { animate: { rotate: [0, -3, 0] }, transition: { duration: spec.cycleS, repeat: Infinity, ease: "easeInOut" as const } }
      : { animate: { rotate: mode === "leap" ? -9 : 2 }, transition: { duration: 0.2 } };

  const vars = suit ? SUIT_BODY[suit] : undefined;
  return (
    <g transform={flip ? "translate(120 0) scale(-1 1)" : undefined} style={vars}>
      <defs>
        <clipPath id={clipId}>
          <path d={SIDE_BODY_D} />
        </clipPath>
      </defs>
      <motion.g style={pivot(66, 106)} initial={false} {...bodyMotion}>
        {/* Legs are drawn crisp (outside the mosaic): thin parts that rotate every frame would otherwise be
            re-pixelated each frame and flicker between blocks, which makes the walk look jerky. */}
        {/* far legs, behind the body */}
        <g>
          {LEGS.filter((l) => l.far).map((l) => (
            <SideLeg key={l.x} {...l} mode={mode} gait={gait} rising={rising} animated={animated} />
          ))}
        </g>
        <g filter={fur}>
          {/* tail, behind the body */}
          <motion.g style={pivot(32, 82)} initial={false} {...tailMotion}>
            <path d={SIDE_TAIL_D} className="fill-none stroke-(--cat-line)" strokeWidth={10.5} strokeLinecap="round" />
            <path d={SIDE_TAIL_D} className="fill-none stroke-(--cat-fur)" strokeWidth={7} strokeLinecap="round" />
          </motion.g>
          <path d={SIDE_BODY_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
          {wear.body === "striped-sweater" ? (
            <g clipPath={`url(#${clipId})`}>
              <rect x={28} y={68} width={66} height={32} className="fill-accent" />
              <rect x={28} y={78} width={66} height={3} className="fill-(--cat-cream)" />
              <rect x={28} y={87} width={66} height={3} className="fill-(--cat-cream)" />
            </g>
          ) : (
            <>
              <ellipse cx={62} cy={93} rx={19} ry={4.6} className="fill-(--cat-cream)" />
              <path d="M 50 72.5 Q 52 77 49 80 M 60 71.5 Q 62 76 59 79.5" className="fill-none stroke-(--cat-fur-dark)" strokeWidth={2.1} strokeLinecap="round" />
            </>
          )}
        </g>
        {/* costume details stay crisp */}
        {suit === "night-vigilante" ? (
          <g clipPath={`url(#${clipId})`}>
            <rect x={28} y={86} width={66} height={4} className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
            <rect x={70} y={85.2} width={5} height={5.6} rx={1} className="fill-(--cat-gold-lo) stroke-(--suit-slate-3)" strokeWidth={0.8} />
          </g>
        ) : suit === "web-hero" ? (
          <g clipPath={`url(#${clipId})`} className="fill-none stroke-(--suit-web)" strokeWidth={0.7} opacity={0.75}>
            <path d="M 44 89 Q 62 94 82 89 M 46 95 Q 62 99 80 95 M 54 88 L 52 98 M 66 88 L 66 98 M 77 88 L 79 97" />
          </g>
        ) : null}
        {/* cape over the back, fluttering with the stride */}
        {wear.body === "hero-cape" || suit === "night-vigilante" ? (
          <motion.path
            d={
              suit === "night-vigilante"
                ? "M 80 71 C 66 65.5 46 67 34 76 L 29 93 Q 33 90.5 36 93.5 Q 39.5 90 43 93 Q 47 89.5 51 91.5 C 56 89.5 61 87.5 64 85.5 Z"
                : "M 80 71 C 66 65.5 46 67 34 76 L 29 95 C 41 90.5 54 90 64 85.5 Z"
            }
            className={cn("stroke-(--cat-line)", suit === "night-vigilante" ? "fill-(--suit-slate-3)" : "fill-bad")}
            strokeWidth={1.4}
            strokeLinejoin="round"
            style={pivot(80, 71)}
            initial={false}
            {...capeMotion}
          />
        ) : null}
        {/* near legs, in front of the body */}
        <g>
          {LEGS.filter((l) => !l.far).map((l) => (
            <SideLeg key={l.x} {...l} mode={mode} gait={gait} rising={rising} animated={animated} />
          ))}
        </g>
      </motion.g>
    </g>
  );
}

interface SideLegProps {
  x: number;
  far: boolean;
  front: boolean;
  phase: 0 | 1;
  mode: SideMode;
  gait: Gait;
  rising: boolean;
  animated: boolean;
}

/**
 * One leg: the thigh turns about the hip (y 89), the shin about the knee (y 98). Walk: gait keyframes (looping
 * only while this side view exists, i.e. while walking). Crouch: folded under, paws on the floor. Leap: front
 * legs reach ahead, hind legs push back, then swap emphasis for the landing.
 */
function SideLeg({ x, far, front, phase, mode, gait, rising, animated }: SideLegProps) {
  let upper: number | number[] = 0;
  let knee: number | number[] = 0;
  let transition: Transition = { duration: 0 };
  if (animated) {
    if (mode === "walk") {
      const k = legKeyframes(gait, phase);
      upper = k.upper;
      knee = k.knee;
      transition = { duration: GAITS[gait].cycleS, times: k.times, ease: "linear", repeat: Infinity };
    } else if (mode === "crouch") {
      upper = front ? -8 : -28;
      knee = front ? 36 : 58;
      transition = { duration: 0.2, ease: "easeOut" };
    } else {
      upper = front ? (rising ? -58 : -30) : rising ? 50 : 24;
      knee = front ? (rising ? -6 : 12) : rising ? 16 : 30;
      transition = { duration: 0.18, ease: "easeOut" };
    }
  }
  const tone = far ? "fill-(--cat-fur-dark)" : "fill-(--cat-fur)";
  return (
    <motion.g
      data-leg={`${far ? "far" : "near"}-${front ? "front" : "hind"}`}
      style={pivot(x, 89)}
      initial={false}
      animate={{ rotate: upper }}
      transition={transition}
    >
      <path d={front ? foreD(x) : thighD(x)} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1.8} strokeLinejoin="round" />
      <motion.g style={pivot(x, 98)} initial={false} animate={{ rotate: knee }} transition={transition}>
        <path d={shinD(x)} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={x} cy={98.4} r={3.1} className={tone} />
        {far ? null : <ellipse cx={x} cy={106.4} rx={3.6} ry={1.8} className="fill-(--cat-cream)" />}
      </motion.g>
    </motion.g>
  );
}

/* ------------------------------------------------------------------ accessories (vector layers) */

function Hat({ id }: { id: AccessoryId }) {
  switch (id) {
    case "party-hat":
      return (
        <g>
          <path d="M 48 27 L 63 0 L 73 26 Q 60 30.5 48 27 Z" className="fill-accent stroke-(--cat-line)" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M 52.5 19.5 Q 61 20.5 69.6 17.6 M 57 11.6 Q 61.5 12 66.4 10.4" className="fill-none stroke-(--cat-gold)" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={63} cy={1} r={3.4} className="fill-(--cat-gold) stroke-(--cat-line)" strokeWidth={1} />
        </g>
      );
    case "wizard-hat":
      return (
        <g>
          <path d="M 46 25 Q 52 11 57 3 Q 62 -4 70 0 Q 65 3 65.5 9 L 74 25 Z" className="fill-violet stroke-(--cat-line)" strokeWidth={1.6} strokeLinejoin="round" />
          <ellipse cx={60} cy={25.5} rx={21} ry={4.4} className="fill-violet stroke-(--cat-line)" strokeWidth={1.6} />
          <path d="M 47 22.4 Q 60 26.4 73 22.4" className="fill-none stroke-(--cat-gold)" strokeWidth={2} strokeLinecap="round" />
          <path d="M 61 10.5 L 62.1 13.4 L 65 14.5 L 62.1 15.6 L 61 18.5 L 59.9 15.6 L 57 14.5 L 59.9 13.4 Z" className="fill-(--cat-gold)" />
        </g>
      );
    case "graduation-cap":
      return (
        <g>
          <path d="M 48 26 L 48 19 Q 60 16 72 19 L 72 26 Q 60 29 48 26 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
          <path d="M 60 8.5 L 85 15 L 60 21.5 L 35 15 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M 60 15 Q 74 16 80.5 18.5 L 80.5 28" className="fill-none stroke-(--cat-gold)" strokeWidth={1.6} strokeLinecap="round" />
          <rect x={78.8} y={27} width={3.4} height={5.5} rx={1} className="fill-(--cat-gold)" />
          <circle cx={60} cy={15} r={1.5} className="fill-(--cat-gold)" />
        </g>
      );
    default:
      return null;
  }
}

function RoundGlasses() {
  return (
    <g>
      <circle cx={48} cy={45} r={7.4} className="fill-accent/15 stroke-(--cat-line)" strokeWidth={1.8} />
      <circle cx={72} cy={45} r={7.4} className="fill-accent/15 stroke-(--cat-line)" strokeWidth={1.8} />
      <path d="M 55.4 44 Q 60 41.6 64.6 44 M 40.6 44 L 33 42 M 79.4 44 L 87 42" className="fill-none stroke-(--cat-line)" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Eyewear({ id }: { id: AccessoryId }) {
  if (id === "round-glasses") return <RoundGlasses />;
  if (id !== "sunglasses") return null;
  return (
    <g>
      <path d="M 40.5 40.5 Q 40.5 38.6 42.5 38.6 L 54 38.6 Q 56 38.6 55.6 41 L 54.6 46.8 Q 54 50.2 50.4 50.2 L 45.2 50.2 Q 41.6 50.2 41 46.8 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
      <path d="M 79.5 40.5 Q 79.5 38.6 77.5 38.6 L 66 38.6 Q 64 38.6 64.4 41 L 65.4 46.8 Q 66 50.2 69.6 50.2 L 74.8 50.2 Q 78.4 50.2 79 46.8 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
      <path d="M 55.6 41 Q 60 39 64.4 41 M 40.6 41 L 33 39.5 M 79.4 41 L 87 39.5" className="fill-none stroke-(--cat-line)" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M 43.4 41.6 L 47.4 41 M 66.6 41.6 L 70.6 41" className="fill-none stroke-(--cat-shine)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** Points along the collar line under the chin (a quadratic from (43, 65.5) via (60, 75) to (77, 65.5)). */
const CHAIN_LINKS = Array.from({ length: 11 }, (_, i) => {
  const t = i / 10;
  const u = 1 - t;
  const x = u * u * 43 + 2 * u * t * 60 + t * t * 77;
  const y = u * u * 65.5 + 2 * u * t * 75 + t * t * 65.5;
  // Tangent angle, for alternating link orientation.
  const dx = 2 * u * (60 - 43) + 2 * t * (77 - 60);
  const dy = 2 * u * (75 - 65.5) + 2 * t * (65.5 - 75);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, flat: i % 2 === 0 };
});

/**
 * Neckwear, drawn under the chin in front of the head (crisp, outlined), so it stays visible in every pose
 * and on both page themes. Coordinates are in the head's frame.
 */
function Neckwear({ id }: { id: AccessoryId }) {
  switch (id) {
    case "bell-collar":
      return (
        <g>
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-(--cat-line)" strokeWidth={5} strokeLinecap="round" />
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-bad" strokeWidth={3.2} strokeLinecap="round" />
          <circle cx={60} cy={73.6} r={3.6} className="fill-(--cat-gold-hi) stroke-(--cat-line)" strokeWidth={1.1} />
          <path d="M 58 74.9 L 62 74.9" className="fill-none stroke-(--cat-line)" strokeWidth={0.9} strokeLinecap="round" />
          <circle cx={58.8} cy={72.4} r={0.8} className="fill-(--cat-shine)" opacity={0.8} />
        </g>
      );
    case "bow-tie":
      return (
        <g>
          <path d="M 60 71.5 L 50.5 66.5 Q 48.8 71.5 50.5 76.5 Z M 60 71.5 L 69.5 66.5 Q 71.2 71.5 69.5 76.5 Z" className="fill-accent stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <rect x={57.5} y={69.2} width={5} height={4.6} rx={1.3} className="fill-accent stroke-(--cat-line)" strokeWidth={1.2} />
        </g>
      );
    case "gold-chain":
      // Chunky alternating links with a dark rim (readable on amber fur and on both themes) and a medallion.
      return (
        <g>
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-(--cat-line)" strokeWidth={4.4} strokeLinecap="round" />
          {CHAIN_LINKS.map((l, i) => (
            <ellipse
              key={i}
              cx={l.x}
              cy={l.y}
              rx={l.flat ? 2.2 : 1.7}
              ry={l.flat ? 1.35 : 1.05}
              transform={`rotate(${l.angle} ${l.x} ${l.y})`}
              className="fill-(--cat-gold-hi) stroke-(--cat-gold-lo)"
              strokeWidth={0.7}
            />
          ))}
          <path d="M 60 70.4 L 60 72.6" className="fill-none stroke-(--cat-line)" strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={60} cy={76.2} r={3.9} className="fill-(--cat-gold-hi) stroke-(--cat-line)" strokeWidth={1.2} />
          <circle cx={60} cy={76.2} r={2.2} className="fill-none stroke-(--cat-gold-lo)" strokeWidth={0.9} />
          <path d="M 58.4 74.6 L 59.4 74.2" className="fill-none stroke-(--cat-shine)" strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M 44.5 65 Q 60 71 75.5 65 L 61.6 84 Q 60 85.6 58.4 84 Z" className="fill-bad stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <circle cx={55} cy={71} r={1.1} className="fill-(--cat-cream)" />
          <circle cx={63.5} cy={73.5} r={1.1} className="fill-(--cat-cream)" />
          <circle cx={59.5} cy={78.5} r={1.1} className="fill-(--cat-cream)" />
        </g>
      );
    default:
      return null;
  }
}

/** The cape's clasps, at the corners of the jaw (in front of the head, so they always show). */
function CapeClasps({ dark }: { dark: boolean }) {
  const tone = dark ? "fill-(--suit-slate-2)" : "fill-(--cat-gold-hi)";
  return (
    <g>
      <path d="M 45.5 66.2 Q 52 69 57 69.6 M 63 69.6 Q 68 69 74.5 66.2" className={cn("fill-none", dark ? "stroke-(--suit-slate-3)" : "stroke-bad")} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={45} cy={66} r={2.5} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1} />
      <circle cx={75} cy={66} r={2.5} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1} />
    </g>
  );
}

function Sweater({ clipId }: { clipId: string }) {
  return (
    <g>
      <g clipPath={`url(#${clipId})`}>
        <rect x={30} y={66} width={60} height={40} className="fill-accent" />
        <rect x={30} y={78} width={60} height={3.2} className="fill-(--cat-cream)" />
        <rect x={30} y={87} width={60} height={3.2} className="fill-(--cat-cream)" />
        <rect x={30} y={96} width={60} height={3.2} className="fill-(--cat-cream)" />
      </g>
      <path d={BODY_D} className="fill-none stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M 47 66.6 Q 60 72.5 73 66.6" className="fill-none stroke-(--cat-cream)" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ costumes (original designs) */

/** Crisp costume details on the front body (in the body's frame, so they follow every pose). */
function SuitFront({ suit, clipId }: { suit: Suit; clipId: string }) {
  if (suit === "night-vigilante") {
    return (
      <g>
        {/* utility belt with a buckle */}
        <g clipPath={`url(#${clipId})`}>
          <rect x={32} y={94.5} width={56} height={4.2} className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
          <path d="M 42 95 L 42 98.2 M 50 95 L 50 98.2 M 70 95 L 70 98.2 M 78 95 L 78 98.2" className="fill-none stroke-(--cat-gold-lo)" strokeWidth={1.2} />
        </g>
        <rect x={56.6} y={93.8} width={6.8} height={5.6} rx={1.2} className="fill-(--cat-gold-lo) stroke-(--suit-slate-3)" strokeWidth={0.9} />
        {/* an original crescent-moon emblem (no logo) */}
        <path d="M 63.2 75.6 A 5.2 5.2 0 1 0 63.2 85.6 A 4.1 4.1 0 1 1 63.2 75.6 Z" className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
      </g>
    );
  }
  // Web hero: a web pattern over the red chest panel (no emblem).
  return (
    <g className="fill-none stroke-(--suit-web)" strokeWidth={0.7} opacity={0.8}>
      <path d="M 60 74.6 L 60 101.4 M 60 76 L 51.5 80 M 60 76 L 68.5 80 M 60 76 L 50 90 M 60 76 L 70 90 M 60 76 L 54 101 M 60 76 L 66 101" />
      <path d="M 53.4 82 Q 60 84.2 66.6 82 M 51 89 Q 60 92 69 89 M 52.4 96 Q 60 99 67.6 96" />
    </g>
  );
}

/** The vigilante's cowl: covers the brow down to the eyes, with a point over the nose; the eye holes come next. */
function Cowl() {
  return (
    <path
      d="M 30 47 C 30 31 43 23 60 23 C 77 23 90 31 90 47 L 90 50.5 C 84 50.2 78 52.6 71 52.6 Q 64 52.6 60 49.2 Q 56 52.6 49 52.6 C 42 52.6 36 50.2 30 50.5 Z"
      className="fill-(--suit-slate) stroke-(--suit-slate-3)"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

/** Crisp mask parts drawn under the eyes: the vigilante's eye holes, the web hero's web lines and lenses. */
function MaskDetails({ suit, headClipId }: { suit: Suit; headClipId: string }) {
  if (suit === "night-vigilante") {
    return (
      <g>
        <path d="M 40.4 44.8 Q 47.5 38.6 55.2 43.6 Q 54 50.4 47.6 50.6 Q 41.6 50 40.4 44.8 Z" className="fill-(--cat-lens) stroke-(--suit-slate-3)" strokeWidth={1.2} />
        <path d="M 79.6 44.8 Q 72.5 38.6 64.8 43.6 Q 66 50.4 72.4 50.6 Q 78.4 50 79.6 44.8 Z" className="fill-(--cat-lens) stroke-(--suit-slate-3)" strokeWidth={1.2} />
      </g>
    );
  }
  return (
    <g>
      <g clipPath={`url(#${headClipId})`} className="fill-none stroke-(--suit-web)" strokeWidth={0.65} opacity={0.75}>
        <path d="M 60 52 L 60 20 M 60 52 L 38 26 M 60 52 L 82 26 M 60 52 L 28 44 M 60 52 L 92 44 M 60 52 L 32 66 M 60 52 L 88 66 M 60 52 L 48 72 M 60 52 L 72 72" />
        <ellipse cx={60} cy={50} rx={12} ry={9.5} />
        <ellipse cx={60} cy={48} rx={22} ry={17.5} />
        <ellipse cx={60} cy={46} rx={31} ry={25} />
      </g>
      {/* big lenses; the eyes are drawn on top, so every expression still reads */}
      <path d="M 39 41.2 Q 46.4 34.8 55.6 40.8 Q 55.6 50.6 48 51.6 Q 40.2 50.6 39 41.2 Z" className="fill-(--cat-lens) stroke-(--suit-web)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 81 41.2 Q 73.6 34.8 64.4 40.8 Q 64.4 50.6 72 51.6 Q 79.8 50.6 81 41.2 Z" className="fill-(--cat-lens) stroke-(--suit-web)" strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ the fish (Feed) */

/**
 * A fish held up in both paws: it drops in, two bites disappear from it, and it ends as a tidy fishbone.
 * Big (about a third of the cat's width), cool blue-silver against the warm fur, with a dark outline and an
 * eye, so it reads as a fish at every size. Declarative keyframes only: no timers to clean up.
 */
function FishSnack({ uid, animated }: { uid: string; animated: boolean }) {
  const maskId = `cat-bite-${uid}`;
  const t = (delay: number): Transition => (animated ? { duration: 0.16, delay, ease: "easeOut" } : { duration: 0 });
  return (
    <motion.g
      data-part="fish"
      style={pivot(60, 80)}
      initial={animated ? { opacity: 0, y: -16, scale: 0.6 } : { opacity: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={animated ? { opacity: 0, scale: 0.85, transition: { duration: 0.2 } } : { opacity: 0, transition: { duration: 0 } }}
      transition={animated ? { type: "spring", stiffness: 420, damping: 20 } : { duration: 0 }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={36} y={64} width={50} height={30}>
          <rect x={36} y={64} width={50} height={30} fill="white" />
          <motion.circle cx={57} cy={73.2} fill="black" initial={{ r: 0 }} animate={{ r: animated ? 4.8 : 0 }} transition={t(0.75)} />
          <motion.circle cx={64.6} cy={74} fill="black" initial={{ r: 0 }} animate={{ r: animated ? 4.4 : 0 }} transition={t(1.3)} />
        </mask>
      </defs>
      {/* whole fish (bitten), fades to the bones near the end */}
      <motion.g mask={`url(#${maskId})`} initial={{ opacity: 1 }} animate={{ opacity: animated ? 0 : 1 }} transition={animated ? { duration: 0.22, delay: 1.85 } : { duration: 0 }}>
        <path d="M 71 80 L 80.5 73 Q 78.2 80 80.5 87 Z" className="fill-(--fish-back) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M 44 80 C 48 73.2 58 72.2 66 75.4 C 69 76.7 71 78.3 72 80 C 71 81.7 69 83.3 66 84.6 C 58 87.8 48 86.8 44 80 Z" className="fill-(--fish) stroke-(--cat-line)" strokeWidth={1.3} />
        <path d="M 46.5 81.6 C 52 85.6 61 86 69 82.4" className="fill-none stroke-(--fish-belly)" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M 49 76.6 C 55 73.8 62 73.8 68 76.4" className="fill-none stroke-(--fish-back)" strokeWidth={1.8} strokeLinecap="round" />
        <path d="M 56 73.8 Q 60.5 69.8 64.4 74.6" className="fill-(--fish-back) stroke-(--cat-line)" strokeWidth={0.9} strokeLinejoin="round" />
        <path d="M 52.6 76.4 Q 54.8 80 52.6 83.6" className="fill-none stroke-(--cat-line)" strokeWidth={0.9} strokeLinecap="round" />
        <path d="M 58 79 q 1.4 1 0 2 M 61.6 79 q 1.4 1 0 2 M 65.2 79 q 1.4 1 0 2" className="fill-none stroke-(--fish-back)" strokeWidth={0.8} strokeLinecap="round" />
        <circle cx={48.6} cy={78.8} r={1.6} className="fill-(--cat-eye)" />
        <circle cx={49.1} cy={78.3} r={0.55} className="fill-(--cat-shine)" />
      </motion.g>
      {/* the bones that are left */}
      {animated ? (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, delay: 1.9 }}>
          <path d="M 71 80 L 80.5 73 Q 78.2 80 80.5 87 Z" className="fill-(--fish-bone) stroke-(--cat-line)" strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M 44 80 C 46.5 75.8 50 74.8 53.4 75.6 L 53.4 84.4 C 50 85.2 46.5 84.2 44 80 Z" className="fill-(--fish-bone) stroke-(--cat-line)" strokeWidth={1.1} />
          <path d="M 53.4 80 L 71.5 80 M 56.5 76.6 L 56.5 83.4 M 60 76.2 L 60 83.8 M 63.5 76.6 L 63.5 83.4 M 67 77.4 L 67 82.6" className="fill-none stroke-(--cat-line)" strokeWidth={1.1} strokeLinecap="round" />
          <circle cx={48.4} cy={79} r={1.3} className="fill-none stroke-(--cat-line)" strokeWidth={0.9} />
        </motion.g>
      ) : null}
    </motion.g>
  );
}

/* ------------------------------------------------------------------ face parts (crisp) */

function Eye({ cx, cy, shape, side }: { cx: number; cy: number; shape: Eyes; side: "left" | "right" }) {
  const ink = "fill-(--cat-eye)";
  const shine = "fill-(--cat-shine)";
  const lid = "fill-none stroke-(--cat-line)";
  switch (shape) {
    case "wide":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={5.6} ry={6.6} className={ink} />
          <circle cx={cx + 1.9} cy={cy - 2.4} r={2.1} className={shine} />
          <circle cx={cx - 1.8} cy={cy + 2.4} r={0.9} className={shine} />
        </g>
      );
    case "relaxed":
      return (
        <g>
          <path d={`M ${cx - 4.6} ${cy - 0.4} A 4.6 4.8 0 0 0 ${cx + 4.6} ${cy - 0.4} Z`} className={ink} />
          <path d={`M ${cx - 5.2} ${cy - 0.7} Q ${cx} ${cy - 2.2} ${cx + 5.2} ${cy - 0.7}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={cx + 1.6} cy={cy + 1.2} r={0.9} className={shine} />
        </g>
      );
    case "down":
      return (
        <g>
          <path d={`M ${cx - 4.4} ${cy + 1.2} A 4.4 4.4 0 0 0 ${cx + 4.4} ${cy + 1.2} Z`} className={ink} />
          <path d={`M ${cx - 5} ${cy + 0.9} Q ${cx} ${cy - 0.6} ${cx + 5} ${cy + 0.9}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      );
    case "up":
      return (
        <g>
          <ellipse cx={cx + 1.2} cy={cy - 1.3} rx={4.2} ry={5.2} className={ink} />
          <circle cx={cx + 2.6} cy={cy - 3.4} r={1.5} className={shine} />
        </g>
      );
    case "happy":
      return (
        <path
          d={`M ${cx - 4.8} ${cy + 1.6} Q ${cx} ${cy - 4.6} ${cx + 4.8} ${cy + 1.6}`}
          className="fill-none stroke-(--cat-eye)"
          strokeWidth={2.8}
          strokeLinecap="round"
        />
      );
    case "closed":
      return (
        <path
          d={`M ${cx - 4.8} ${cy - 0.4} Q ${cx} ${cy + 3.8} ${cx + 4.8} ${cy - 0.4}`}
          className="fill-none stroke-(--cat-eye)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      );
    case "confused":
      return side === "left" ? (
        <g>
          <ellipse cx={cx} cy={cy} rx={4.6} ry={5.6} className={ink} />
          <circle cx={cx + 1.6} cy={cy - 2} r={1.5} className={shine} />
          <path d={`M ${cx - 5.5} ${cy - 9} Q ${cx} ${cy - 13} ${cx + 5.5} ${cy - 10}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx={cx} cy={cy + 0.6} rx={3.6} ry={3.4} className={ink} />
          <circle cx={cx + 1.2} cy={cy - 0.6} r={1} className={shine} />
        </g>
      );
    case "open":
    default:
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={4.6} ry={5.6} className={ink} />
          <circle cx={cx + 1.6} cy={cy - 2} r={1.6} className={shine} />
          <circle cx={cx - 1.4} cy={cy + 2} r={0.7} className={shine} />
        </g>
      );
  }
}

function Mouth({ shape }: { shape: Mouth }) {
  const stroke = "fill-none stroke-(--cat-line)";
  switch (shape) {
    case "smile":
      return (
        <g>
          <path d="M 54.5 55 Q 60 63.5 65.5 55 Q 60 57.5 54.5 55 Z" className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <ellipse cx={60} cy={59.2} rx={2.3} ry={1.3} className="fill-(--cat-pink)" />
        </g>
      );
    case "o":
      return <ellipse cx={60} cy={58} rx={2.4} ry={3} className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1} />;
    case "yawn":
      return (
        <g>
          <ellipse cx={60} cy={59.4} rx={3.6} ry={4.8} className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1.1} />
          <ellipse cx={60} cy={62} rx={2.2} ry={1.5} className="fill-(--cat-pink)" />
        </g>
      );
    case "wavy":
      return <path d="M 55 57.5 Q 57.5 55.8 60 57.5 Q 62.5 59.2 65 57.5" className={stroke} strokeWidth={1.7} strokeLinecap="round" />;
    case "flat":
      return <path d="M 57 57.2 L 63.6 56.6" className={stroke} strokeWidth={1.7} strokeLinecap="round" />;
    case "w":
    default:
      return (
        <path d="M 55 55.5 Q 57.5 58.5 60 55.8 Q 62.5 58.5 65 55.5" className={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      );
  }
}

/** Cache the study cat, as vector parts with a light mosaic. Memoised: re-renders only when its props change. */
export const PixelCat = memo(PixelCatImpl);
