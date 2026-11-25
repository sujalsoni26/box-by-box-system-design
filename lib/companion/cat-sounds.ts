/*
 * Cache's voice: purrs, meows and little trills, synthesised (no audio files). Pure: returns samples, so it is
 * unit tested.
 *
 * Purr: what makes a purr soothing rather than mechanical is softness and irregularity. Warm, brownish noise
 * (mostly 70–600 Hz) is only gently ruffled, not chopped, about 25 times a second, with the rate drifting a little
 * the way a real cat's does. A faint breathy layer (1–3 kHz) makes it sound close and audible on phone speakers.
 * The breath goes in (quieter) and out (fuller), slowly.
 *
 * Meows: a small voice, synthesised from harmonics shaped by moving mouth resonances (formants), like speech.
 * "m" (closed, nasal) opens to "ee" or "ah" and closes to "ow", while the pitch rises and falls. A trill ("prrt") is
 * a short rising chirp, softly rolled.
 */

export type CatSound = "prt" | "trill" | "mew" | "meow" | "yawn" | "purr" | "purr-long" | "purr-loop";

/** Seeded PRNG (mulberry32), so a sound is the same every time and tests are stable. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One-pole filter coefficient for cutoff `fc`. */
const coef = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);

/** Smooth interpolation through keyframe values spread evenly over 0..1. */
function curve(points: readonly number[], u: number): number {
  const x = Math.min(0.999999, Math.max(0, u)) * (points.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const s = 0.5 - 0.5 * Math.cos(Math.PI * f);
  return points[i] + (points[i + 1] - points[i]) * s;
}

function normalize(out: Float32Array, peakTo = 0.9): Float32Array {
  let peak = 0;
  for (let k = 0; k < out.length; k++) peak = Math.max(peak, Math.abs(out[k]));
  if (peak > 0) for (let k = 0; k < out.length; k++) out[k] = (out[k] / peak) * peakTo;
  return out;
}

/* ------------------------------------------------------------------ purr */

/** How much breathy air rides on the warm body (enough to be heard on a phone, not enough to hiss). */
const AIR = 0.07;

interface Breath {
  seconds: number;
  /** Ruffles per second. */
  rate: number;
  level: number;
  /** A short, nearly silent pause after it, s. */
  gap: number;
}

function breathsFor(kind: "purr" | "purr-long" | "purr-loop", rnd: () => number): Breath[] {
  if (kind === "purr") return [{ seconds: 1.5, rate: 24, level: 1, gap: 0 }];
  if (kind === "purr-long") {
    return [
      { seconds: 1.3, rate: 26, level: 0.6, gap: 0.18 },
      { seconds: 1.7, rate: 23.5, level: 1, gap: 0.16 },
      { seconds: 1.5, rate: 23, level: 0.8, gap: 0 },
    ];
  }
  const out: Breath[] = [];
  for (let i = 0; i < 7; i++) {
    out.push({ seconds: 1.25 + rnd() * 0.3, rate: 25 + rnd() * 1.5, level: 0.58 + rnd() * 0.08, gap: 0.16 + rnd() * 0.1 });
    out.push({ seconds: 1.6 + rnd() * 0.35, rate: 22.5 + rnd() * 1.5, level: 0.9 + rnd() * 0.1, gap: 0.2 + rnd() * 0.12 });
  }
  return out;
}

function synthPurrSamples(kind: "purr" | "purr-long" | "purr-loop", sr: number, seed: number): Float32Array {
  const rnd = random(seed);
  const breaths = breathsFor(kind, rnd);
  const n = Math.max(1, Math.round(breaths.reduce((s, b) => s + b.seconds + b.gap, 0) * sr));
  const out = new Float32Array(n);
  // Warm body: white noise, high-passed at 70 Hz, two low-pass poles near 300 and 600 Hz.
  const a1 = coef(300, sr);
  const a2 = coef(600, sr);
  const hpA = coef(70, sr);
  // Breath air: noise between about 1 and 3 kHz.
  const airHp = coef(1000, sr);
  const airLp = coef(3000, sr);
  let lp1 = 0, lp2 = 0, hp = 0, airL = 0, airH = 0;
  let phase = 0;
  let drift = 0;
  let i = 0;
  for (const b of breaths) {
    const len = Math.round(b.seconds * sr);
    const gapLen = Math.round(b.gap * sr);
    for (let k = 0; k < len + gapLen && i < n; k++, i++) {
      const white = rnd() * 2 - 1;
      lp1 += a1 * (white - lp1);
      lp2 += a2 * (lp1 - lp2);
      hp += hpA * (lp2 - hp);
      const body = lp2 - hp;
      airL += airLp * (white - airL);
      airH += airHp * (airL - airH);
      const air = airL - airH;
      if (k >= len) {
        out[i] = 0;
        continue;
      }
      const u = k / len;
      // The rate wanders slowly (a random walk, kept within ±6%), so it never sounds like an engine.
      drift = Math.max(-0.06, Math.min(0.06, drift + (rnd() - 0.5) * 0.0004));
      phase += (b.rate * (1 + drift) * (1.03 - 0.06 * u)) / sr;
      // A gentle ruffle: the level dips by at most half, smoothly.
      const ruffle = 1 - 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
      const env = Math.pow(Math.sin(Math.PI * u), 0.9) * b.level;
      out[i] = (body * ruffle + air * AIR * (0.75 + 0.25 * ruffle)) * env;
    }
  }
  return normalize(out);
}

/* ------------------------------------------------------------------ meows and trills */

interface Voice {
  seconds: number;
  /** Pitch keyframes, Hz. */
  pitch: readonly number[];
  /** Mouth resonances over time (keyframes), Hz: F1 (openness) and F2 (front/back). */
  f1: readonly number[];
  f2: readonly number[];
  /** Rolled "r": amplitude flutter rate (0 for none) and depth. */
  rollRate: number;
  rollDepth: number;
  /** Breathiness, 0..1. */
  breath: number;
  /** Attack and release, as fractions of the length. */
  attack: number;
  release: number;
}

const VOICES: Record<"prt" | "trill" | "mew" | "meow" | "yawn", Voice> = {
  prt: { seconds: 0.11, pitch: [520, 640], f1: [450, 600], f2: [1300, 1500], rollRate: 34, rollDepth: 0.7, breath: 0.1, attack: 0.12, release: 0.5 },
  trill: { seconds: 0.24, pitch: [440, 560, 660], f1: [420, 620, 560], f2: [1200, 1500, 1600], rollRate: 30, rollDepth: 0.75, breath: 0.1, attack: 0.1, release: 0.4 },
  mew: { seconds: 0.36, pitch: [720, 1020, 980, 760], f1: [380, 650, 640, 450], f2: [1100, 2000, 1900, 1200], rollRate: 0, rollDepth: 0, breath: 0.12, attack: 0.14, release: 0.42 },
  meow: { seconds: 0.58, pitch: [540, 760, 740, 600, 520], f1: [360, 820, 860, 640, 420], f2: [1000, 1600, 1500, 1050, 850], rollRate: 0, rollDepth: 0, breath: 0.14, attack: 0.12, release: 0.38 },
  yawn: { seconds: 0.9, pitch: [800, 760, 640, 520, 440], f1: [400, 900, 950, 700, 420], f2: [1100, 1500, 1400, 1000, 800], rollRate: 0, rollDepth: 0, breath: 0.3, attack: 0.1, release: 0.45 },
};

function synthVoice(kind: keyof typeof VOICES, sr: number, seed: number): Float32Array {
  const v = VOICES[kind];
  const rnd = random(seed);
  const n = Math.max(1, Math.round(v.seconds * sr));
  const out = new Float32Array(n);
  const MAX_H = 14;
  const phases = new Float64Array(MAX_H + 1);
  const bA = coef(2500, sr);
  const bH = coef(5000, sr);
  let bl = 0, bh = 0;
  let roll = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const u = i / n;
    // A little vibrato, like a real voice.
    const f0 = curve(v.pitch, u) * (1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t));
    const F1 = curve(v.f1, u);
    const F2 = curve(v.f2, u);
    let s = 0;
    for (let h = 1; h <= MAX_H; h++) {
      const f = h * f0;
      if (f > 6000) break;
      phases[h] += (2 * Math.PI * f) / sr;
      // Source falls off with harmonic number; the mouth boosts harmonics near F1, F2 and a fixed F3 (3 kHz).
      const g =
        (1 / Math.pow(h, 0.8)) *
        (1 / (1 + ((f - F1) / 160) ** 2) + 0.7 / (1 + ((f - F2) / 260) ** 2) + 0.18 / (1 + ((f - 3000) / 500) ** 2) + 0.04);
      s += g * Math.sin(phases[h]);
    }
    // Breath: a little high noise.
    const white = rnd() * 2 - 1;
    bl += bA * (white - bl);
    bh += bH * (white - bh);
    s += v.breath * 0.6 * (bh - bl);
    if (v.rollRate) {
      roll += v.rollRate / sr;
      s *= 1 - v.rollDepth * (0.5 - 0.5 * Math.cos(2 * Math.PI * roll));
    }
    const attack = Math.min(1, u / v.attack);
    const release = u > 1 - v.release ? 0.5 + 0.5 * Math.cos((Math.PI * (u - (1 - v.release))) / v.release) : 1;
    out[i] = s * (0.5 - 0.5 * Math.cos(Math.PI * attack)) * release;
  }
  return normalize(out);
}

/** Samples (mono, -1..1, peak 0.9) for one of Cache's sounds. The purr loop starts and ends silent (seamless). */
export function synthCatSound(kind: CatSound, sampleRate: number, seed = 7): Float32Array {
  if (kind === "purr" || kind === "purr-long" || kind === "purr-loop") return synthPurrSamples(kind, sampleRate, seed);
  return synthVoice(kind, sampleRate, seed);
}

/** Roughly how long each sound lasts, s (for spacing sounds that follow one another). */
export function catSoundSeconds(kind: CatSound): number {
  if (kind === "purr") return 1.5;
  if (kind === "purr-long") return 4.84;
  if (kind === "purr-loop") return 30;
  return VOICES[kind].seconds;
}
