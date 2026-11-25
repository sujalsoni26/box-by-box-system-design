import { usePreferencesStore } from "@/stores/preferences-store";
import type { PurrSettings } from "@/types/companion";
import { catSoundSeconds, synthCatSound, type CatSound } from "./cat-sounds";

/*
 * Cache's sounds: soft purrs, little meows and trills (WebAudio, synthesised in lib/companion/cat-sounds.ts; no
 * audio files). Off by default.
 *
 * - `purrFor(moment)`: the sound for one moment (a click, a pet, waking up, talking…), only when her sounds are on,
 *   that moment is ticked in the settings and the tab is visible.
 * - The purr loop: a continuous, relaxing purr for an ASMR nap (asked for from her menu) or, if ticked, while a
 *   focus block runs. It keeps playing in a background tab and fades in and out.
 *
 * The AudioContext is created on the first sound, which follows a click (browsers allow audio after one).
 */

export type PurrMoment = keyof PurrSettings;

let context: AudioContext | null = null;
const buffers = new Map<CatSound, AudioBuffer>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    // A context made before any click starts suspended (a focus purr after a reload): resume on the next press.
    const resume = () => void context?.resume();
    document.addEventListener("pointerdown", resume, { passive: true });
    document.addEventListener("keydown", resume);
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function buffer(ctx: AudioContext, kind: CatSound): AudioBuffer {
  let b = buffers.get(kind);
  if (!b) {
    const data = synthCatSound(kind, ctx.sampleRate, kind === "purr-loop" ? 11 : 7);
    b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    buffers.set(kind, b);
  }
  return b;
}

const volume = () => usePreferencesStore.getState().companion.purrVolume ?? 0.6;
/** Loudness of each sound at full volume: all gentle; meows a touch quieter than purrs, clicks quietest. */
const LEVEL: Record<CatSound, number> = {
  prt: 0.09,
  trill: 0.13,
  mew: 0.13,
  meow: 0.14,
  yawn: 0.12,
  purr: 0.3,
  "purr-long": 0.3,
  "purr-loop": 0.28,
};

/** Play one sound `at` seconds from now, whatever the settings (used to preview a choice). */
export function playCatSound(kind: CatSound, at = 0, level = volume()): void {
  try {
    const ctx = audio();
    if (!ctx || level <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, kind);
    // A little natural variation in pitch for the voice, so repeated meows don't sound copied.
    if (!kind.startsWith("purr")) src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const gain = ctx.createGain();
    gain.gain.value = LEVEL[kind] * level;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + 0.01 + at);
  } catch {
    // Sound is a nicety; never let it break the page.
  }
}

/** What each moment sounds like: sounds played one after another. */
const SOUNDS: Record<PurrMoment, CatSound[]> = {
  clicks: ["prt"],
  talk: ["mew"],
  wake: ["yawn", "trill"],
  meows: ["meow", "purr"],
  play: ["trill", "mew"],
  pets: ["purr-long"],
  naps: ["purr-long"],
  celebrations: ["trill", "mew", "purr"],
  focus: ["trill"],
};

function playSequence(kinds: CatSound[]): void {
  let at = 0;
  for (const k of kinds) {
    playCatSound(k, at);
    at += catSoundSeconds(k) + 0.06;
  }
}

/** Play a moment's sounds now, whatever the settings (the preview when a moment is ticked). */
export function previewMoment(moment: PurrMoment): void {
  playSequence(SOUNDS[moment]);
}

/** Shortest gap between two sounds of one moment, ms (a burst of clicks is not a burst of meows). */
const GAP: Record<PurrMoment, number> = {
  clicks: 90,
  talk: 8000,
  wake: 4000,
  meows: 1500,
  play: 1500,
  pets: 2500,
  naps: 4000,
  celebrations: 2500,
  focus: 2000,
};
const lastAt = new Map<PurrMoment, number>();
/** When any sound other than a click last started: talking stays quiet right after another sound. */
let lastVoiceAt = 0;

/** May this moment make a sound? Sounds on, the moment ticked, companion shown, tab visible. */
export function purrAllowed(moment: PurrMoment): boolean {
  const c = usePreferencesStore.getState().companion;
  return c.enabled && c.sound && Boolean(c.purr?.[moment]) && typeof document !== "undefined" && document.visibilityState === "visible";
}

/** The sound for one moment, if the learner wants it. */
export function purrFor(moment: PurrMoment): void {
  if (!purrAllowed(moment)) return;
  const now = Date.now();
  if (now - (lastAt.get(moment) ?? 0) < GAP[moment]) return;
  // A bubble that comes with its own sound (a pet, a celebration) does not also mew.
  if (moment === "talk" && now - lastVoiceAt < 2000) return;
  lastAt.set(moment, now);
  if (moment !== "clicks") lastVoiceAt = now;
  playSequence(SOUNDS[moment]);
}

/* ------------------------------------------------------------------ the continuous purr */

let loop: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
const FADE_IN = 2;
const FADE_OUT = 1.2;

/** Start (or keep) the continuous purr at `factor` of the learner's volume (an ASMR nap is louder than a focus purr). */
export function startPurrLoop(factor = 1): void {
  try {
    const ctx = audio();
    if (!ctx) return;
    const level = LEVEL["purr-loop"] * volume() * factor;
    const now = ctx.currentTime;
    if (loop) {
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setTargetAtTime(level, now, 0.3);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, "purr-loop");
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + FADE_IN);
    src.connect(gain).connect(ctx.destination);
    src.start(now + 0.01);
    loop = { src, gain };
  } catch {
    loop = null;
  }
}

/** Fade the continuous purr out. */
export function stopPurrLoop(): void {
  const current = loop;
  loop = null;
  if (!current || !context) return;
  try {
    const now = context.currentTime;
    current.gain.gain.cancelScheduledValues(now);
    current.gain.gain.setValueAtTime(current.gain.gain.value, now);
    current.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    current.src.stop(now + FADE_OUT + 0.05);
  } catch {
    // already stopped
  }
}
