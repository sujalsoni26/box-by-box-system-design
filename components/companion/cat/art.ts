// Cache's art as data: poses per mood, paths, paw shapes, the palette and costume colours (used by ../pixel-cat.tsx).
import type { CSSProperties } from "react";
import type { AccessoryId, AccessorySlot, CompanionMood } from "@/types/companion";

export type Eyes = "open" | "wide" | "relaxed" | "down" | "up" | "happy" | "closed" | "confused";
export type MouthShape = "w" | "smile" | "o" | "wavy" | "flat" | "yawn";
export type Paws = "sit" | "walk" | "tuck" | "dangle" | "chin" | "book" | "cheer" | "bat" | "spread" | "splay" | "hold";
export type Tail = "up" | "high" | "curl" | "wrap" | "hang";
export type Extra = "book" | "glasses" | "thought" | "question" | "sparkles" | "zzz" | "blush" | "fish" | "hearts";
export type SideMode = "walk" | "crouch" | "leap";
export type Suit = "night-vigilante" | "web-hero";

export interface Pose {
  head: { x: number; y: number; rotate: number };
  earL: number;
  earR: number;
  earScale: number;
  body: { scaleX: number; scaleY: number };
  tail: Tail;
  eyes: Eyes;
  mouth: MouthShape;
  paws: Paws;
  extras: readonly Extra[];
  shadow: { rx: number; opacity: number };
}

export const BASE: Pose = {
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

export const JUMP: Pose = {
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

export const POSES: Record<CompanionMood, Pose> = {
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
export const TAILS: Record<Tail, string> = {
  up: "M 80 99 C 95 101 105 92 103 79 C 102 72 96 69 93 74",
  high: "M 80 98 C 91 96 98 85 97 71 C 96.5 64 92 59 88 62",
  curl: "M 80 100 C 94 104 104 98 104 88 C 104 82 99 80 97 84",
  wrap: "M 80 102 C 90 108 79 111 63 111 C 53 111 45 109.5 42 106",
  hang: "M 72 100 C 74 107 73 112 70 116 C 69 118 67 118.5 66 117",
};

export type PawShape = { cx: number; cy: number; rx: number; ry: number; opacity: number };
export const SIT_L: PawShape = { cx: 51, cy: 104, rx: 6.5, ry: 4.4, opacity: 1 };
export const SIT_R: PawShape = { cx: 69, cy: 104, rx: 6.5, ry: 4.4, opacity: 1 };
export const PAWS: Record<Paws, readonly [PawShape, PawShape]> = {
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
export const SIDE_BODY_D = "M 30 85 C 30 74 41 69.5 58 69.5 C 76 69.5 92 73 92 83.5 C 92 93.5 84 98 71 98 L 45 98 C 35 98 30 93.5 30 85 Z";
export const SIDE_TAIL_D = "M 32 82 C 21 80 16 70 18 60 C 19 55 23 53 25.5 56";
export const LEGS = [
  { x: 39, far: true, phase: 0, front: false },
  { x: 73, far: true, phase: 1, front: true },
  { x: 47, far: false, phase: 1, front: false },
  { x: 81, far: false, phase: 0, front: true },
] as const;
/** Hind thigh (a rounded haunch), fore upper leg and the shin with its paw; the knee pivot is at y 98. */
export const thighD = (x: number) =>
  `M ${x - 4.8} 86.5 C ${x - 5.4} 92 ${x - 4.2} 96.5 ${x - 3.3} 99.6 L ${x + 3.3} 99.6 C ${x + 4.6} 95 ${x + 4.8} 90 ${x + 3.9} 86.5 Z`;
export const foreD = (x: number) => `M ${x - 3.4} 87.5 L ${x - 3.3} 99.6 L ${x + 3.3} 99.6 L ${x + 3.4} 87.5 Z`;
export const shinD = (x: number) =>
  `M ${x - 3.3} 97 L ${x - 3.4} 104.6 Q ${x - 3.4} 108.2 ${x} 108.2 Q ${x + 3.4} 108.2 ${x + 3.4} 104.6 L ${x + 3.3} 97 Z`;

export const BODY_D = "M 41 104 C 35 104 33 96 34.5 87 C 36.5 75 45 63 60 63 C 75 63 83.5 75 85.5 87 C 87 96 85 104 79 104 Z";
export const HEAD_D =
  "M 30 47 C 30 31 43 23 60 23 C 77 23 90 31 90 47 C 90 55 87 61 82 64 C 76 68 68 69 60 69 C 52 69 44 68 38 64 C 33 61 30 55 30 47 Z";
/** The cape behind the body, wide enough to show down both sides from the front; and billowing (same commands, so Motion morphs between them). */
export const CAPE_HANG = "M 46 66 Q 60 70 74 66 L 103 106 Q 80 111 60 108 Q 40 111 17 106 Z";
export const CAPE_BILLOW = "M 46 66 Q 60 70 74 66 L 109 95 Q 84 104 60 100 Q 36 104 11 95 Z";
export const BLINKABLE: ReadonlySet<Eyes> = new Set(["open", "wide", "up", "relaxed", "down", "confused"]);
export const EYE_L = { cx: 48, cy: 45 };
export const EYE_R = { cx: 72, cy: 45 };
/** Mosaic block size in viewBox units (120 units = the cat's width). */
export const BLOCK = 5;
/** Moods in the air: the cape billows. */
export const AIRBORNE: ReadonlySet<CompanionMood> = new Set<CompanionMood>(["dragged", "falling", "jumping"]);

export type CatStyle = CSSProperties & Record<`--${string}`, string>;
/**
 * Palette. Fur derives from tokens (--amber), so it follows the theme. Costume colours are fixed art
 * colours (the same suit in both themes), chosen to contrast with the fur, the outline and both page grounds.
 */
export const CAT_STYLE: CatStyle = {
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
export const SUIT_BODY: Record<Suit, CatStyle> = {
  "night-vigilante": { "--cat-fur": "var(--suit-slate)", "--cat-fur-dark": "var(--suit-slate-3)", "--cat-cream": "var(--suit-slate-2)" },
  // Blue sides and legs, a red chest panel and red gloves.
  "web-hero": { "--cat-fur": "var(--suit-blue)", "--cat-fur-dark": "var(--suit-blue-2)", "--cat-cream": "var(--suit-red)" },
};
/** Costume colours for the head: the vigilante's cowl only covers the ears and brow (drawn on top); the web hero's mask is the whole head. */
export const SUIT_EARS: Record<Suit, CatStyle> = {
  "night-vigilante": { "--cat-fur": "var(--suit-slate)", "--cat-pink": "var(--suit-slate-3)" },
  "web-hero": { "--cat-fur": "var(--suit-red)", "--cat-pink": "var(--suit-red-2)" },
};
export const SUIT_HEAD: Partial<Record<Suit, CatStyle>> = {
  "web-hero": { "--cat-fur": "var(--suit-red)", "--cat-cream": "var(--suit-red)", "--cat-fur-dark": "var(--suit-red-2)" },
};

export function suitOf(id: AccessoryId | undefined): Suit | null {
  return id === "night-vigilante" || id === "web-hero" ? id : null;
}

/** Transform origin in viewBox units (Motion sets transform-box for SVG; we pin it to the view box). */
export const pivot = (x: number, y: number) => ({ originX: `${x}px`, originY: `${y}px`, transformBox: "view-box" as const });

export const SPARKLE = "M 0 -7 C 1 -2 2 -1 7 0 C 2 1 1 2 0 7 C -1 2 -2 1 -7 0 C -2 -1 -1 -2 0 -7 Z";
export const SPARKLES = [
  { x: 17, y: 40, tone: "fill-amber", delay: 0, scale: 1 },
  { x: 103, y: 30, tone: "fill-accent", delay: 0.12, scale: 0.85 },
  { x: 12, y: 82, tone: "fill-accent", delay: 0.22, scale: 0.75 },
  { x: 108, y: 76, tone: "fill-amber", delay: 0.32, scale: 0.95 },
] as const;
export const HEART = "M 0 3.2 C -5.5 -1 -4.6 -6.4 0 -3.8 C 4.6 -6.4 5.5 -1 0 3.2 Z";

export type EquippedAccessories = Partial<Record<AccessorySlot, AccessoryId>>;
