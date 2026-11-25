/*
 * Cache's purr, synthesised (no audio files). Pure: returns samples, so it is unit tested.
 *
 * A real purr is air rushing past the larynx while the vocal folds open and close about 25 times a second, on the
 * breath in and the breath out (the out-breath a little louder and slower). So: soft noise, band-limited to
 * the warm 100–800 Hz range (low enough to be cosy, high enough for phone speakers), chopped into rounded pulses
 * at 22–28 Hz, under a gentle breathing envelope. A "prrt" chirp adds a short rising trill on top.
 */

export type PurrKind = "chirp" | "short" | "long" | "loop";

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

/** One breath: `seconds` long, pulses at `rate` Hz, peak `level` (0..1). */
interface Breath {
  seconds: number;
  rate: number;
  level: number;
  /** A short pause after it (purr nearly stops between breaths), s. */
  gap: number;
}

/** Breaths for each sound. The loop is several in/out cycles with natural variation; it starts and ends silent. */
function breathsFor(kind: PurrKind, rnd: () => number): Breath[] {
  switch (kind) {
    case "chirp":
      return [{ seconds: 0.3, rate: 30, level: 1, gap: 0 }];
    case "short":
      return [{ seconds: 1.05, rate: 24, level: 1, gap: 0 }];
    case "long":
      return [
        { seconds: 0.95, rate: 27, level: 0.62, gap: 0.12 },
        { seconds: 1.25, rate: 23.5, level: 1, gap: 0.1 },
        { seconds: 1.1, rate: 23, level: 0.85, gap: 0 },
      ];
    case "loop": {
      const out: Breath[] = [];
      for (let i = 0; i < 8; i++) {
        out.push({ seconds: 0.95 + rnd() * 0.25, rate: 26.5 + rnd() * 1.5, level: 0.6 + rnd() * 0.08, gap: 0.08 + rnd() * 0.06 });
        out.push({ seconds: 1.2 + rnd() * 0.3, rate: 22.5 + rnd() * 1.5, level: 0.92 + rnd() * 0.08, gap: 0.12 + rnd() * 0.1 });
      }
      return out;
    }
  }
}

/** Rises quickly, holds, fades: a breath's loudness at u (0..1 through it). */
function breathShape(u: number, chirp: boolean): number {
  if (u <= 0 || u >= 1) return 0;
  if (chirp) return Math.min(1, u / 0.06) * Math.pow(1 - u, 1.4);
  return Math.pow(Math.sin(Math.PI * u), 0.55);
}

/** Samples (mono, -1..1, peak 0.9) for a purr sound. */
export function synthPurr(kind: PurrKind, sampleRate: number, seed = 7): Float32Array {
  const rnd = random(seed);
  const breaths = breathsFor(kind, rnd);
  const total = breaths.reduce((s, b) => s + b.seconds + b.gap, 0);
  const n = Math.max(1, Math.round(total * sampleRate));
  const out = new Float32Array(n);
  const chirp = kind === "chirp";

  // Filters (one-pole): a high-pass to keep out rumble, two low-passes for a soft, warm noise.
  const coef = (fc: number) => 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);
  const lpA = coef(chirp ? 1300 : 750);
  const hpA = coef(95);
  let lp1 = 0;
  let lp2 = 0;
  let hp = 0;
  let phase = 0;
  let tonePhase = 0;

  let i = 0;
  for (const b of breaths) {
    const len = Math.round(b.seconds * sampleRate);
    const gapLen = Math.round(b.gap * sampleRate);
    for (let k = 0; k < len + gapLen && i < n; k++, i++) {
      const white = rnd() * 2 - 1;
      lp1 += lpA * (white - lp1);
      lp2 += lpA * (lp1 - lp2);
      hp += hpA * (lp2 - hp);
      const noise = lp2 - hp;
      if (k >= len) {
        out[i] = 0;
        continue;
      }
      const u = k / len;
      // The flutter: rounded pulses, slightly faster at the start of a breath.
      phase += (b.rate * (1.04 - 0.08 * u)) / sampleRate;
      const pulse = Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * phase), 2.2);
      const flutter = 0.12 + 0.88 * pulse;
      let v = noise * flutter;
      if (chirp) {
        // "prrt": a soft rising trill riding on the pulses.
        tonePhase += (430 + 230 * u) / sampleRate;
        v += 0.05 * Math.sin(2 * Math.PI * tonePhase) * pulse;
      }
      out[i] = v * breathShape(u, chirp) * b.level;
    }
  }

  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(out[k]));
  if (peak > 0) for (let k = 0; k < n; k++) out[k] = (out[k] / peak) * 0.9;
  return out;
}
