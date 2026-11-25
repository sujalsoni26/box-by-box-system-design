import { usePreferencesStore } from "@/stores/preferences-store";
import type { PurrSettings } from "@/types/companion";
import { synthPurr, type PurrKind } from "./purr";

/*
 * Cache's purring sounds (WebAudio, synthesised in lib/companion/purr.ts; no audio files). Off by default.
 *
 * - `purrFor(moment)`: a short purr for one moment (a click, a pet, a topic meow…), only when purring sounds are
 *   on, that moment is ticked in the settings and the tab is visible.
 * - The purr loop: a continuous, relaxing purr for an ASMR nap (asked for from her menu) or, if ticked, while a
 *   focus block runs. It keeps playing in a background tab and fades in and out.
 *
 * The AudioContext is created on the first sound, which follows a click (browsers allow audio after one).
 */

export type PurrMoment = keyof PurrSettings;

let context: AudioContext | null = null;
const buffers = new Map<PurrKind, AudioBuffer>();

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

function buffer(ctx: AudioContext, kind: PurrKind): AudioBuffer {
  let b = buffers.get(kind);
  if (!b) {
    const data = synthPurr(kind, ctx.sampleRate, kind === "loop" ? 11 : 7);
    b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    buffers.set(kind, b);
  }
  return b;
}

const volume = () => usePreferencesStore.getState().companion.purrVolume ?? 0.6;
/** Loudness of each sound at full volume: all of them gentle. */
const LEVEL: Record<PurrKind, number> = { chirp: 0.22, short: 0.3, long: 0.3, loop: 0.26 };

/** Play one purr sound now, whatever the settings (used to preview a setting the learner just changed). */
export function playPurr(kind: PurrKind, at = 0, level = volume()): void {
  try {
    const ctx = audio();
    if (!ctx || level <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, kind);
    const gain = ctx.createGain();
    gain.gain.value = LEVEL[kind] * level;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + 0.01 + at);
  } catch {
    // Sound is a nicety; never let it break the page.
  }
}

/** What each moment sounds like. */
const SOUNDS: Record<PurrMoment, Array<[PurrKind, number]>> = {
  clicks: [["chirp", 0]],
  meows: [
    ["chirp", 0],
    ["short", 0.22],
  ],
  play: [["short", 0]],
  pets: [["long", 0]],
  naps: [["long", 0]],
  celebrations: [
    ["chirp", 0],
    ["long", 0.2],
  ],
  focus: [["chirp", 0]],
};

/** Shortest gap between two sounds of one moment, ms (a burst of clicks is not a burst of purrs). */
const GAP: Record<PurrMoment, number> = { clicks: 90, meows: 1500, play: 1500, pets: 2500, naps: 4000, celebrations: 2500, focus: 2000 };
const lastAt = new Map<PurrMoment, number>();

/** May this moment purr? Purring sounds on, the moment ticked, companion shown, tab visible. */
export function purrAllowed(moment: PurrMoment): boolean {
  const c = usePreferencesStore.getState().companion;
  return c.enabled && c.sound && Boolean(c.purr?.[moment]) && typeof document !== "undefined" && document.visibilityState === "visible";
}

/** A purr for one moment, if the learner wants it. */
export function purrFor(moment: PurrMoment): void {
  if (!purrAllowed(moment)) return;
  const now = Date.now();
  if (now - (lastAt.get(moment) ?? 0) < GAP[moment]) return;
  lastAt.set(moment, now);
  for (const [kind, at] of SOUNDS[moment]) playPurr(kind, at);
}

/* ------------------------------------------------------------------ the continuous purr */

let loop: { src: AudioBufferSourceNode; gain: GainNode; level: number } | null = null;
const FADE_IN = 1.6;
const FADE_OUT = 0.9;

/** Start (or keep) the continuous purr at `factor` of the learner's volume (an ASMR nap is louder than a focus purr). */
export function startPurrLoop(factor = 1): void {
  try {
    const ctx = audio();
    if (!ctx) return;
    const level = LEVEL.loop * volume() * factor;
    const now = ctx.currentTime;
    if (loop) {
      loop.level = level;
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setTargetAtTime(level, now, 0.3);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer(ctx, "loop");
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + FADE_IN);
    src.connect(gain).connect(ctx.destination);
    src.start(now + 0.01);
    loop = { src, gain, level };
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

export function purrLoopPlaying(): boolean {
  return loop !== null;
}
