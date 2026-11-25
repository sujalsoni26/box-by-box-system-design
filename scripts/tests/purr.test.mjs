// Cache's purr (synthesis), the purring-sound settings and the lamp on phones. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { appModule } from "./support/load-app.mjs";

const purr = await appModule("lib/companion/purr.ts");
const prefs = await appModule("stores/preferences-store.ts");
const lampGeo = await appModule("lib/companion/lamp-geometry.ts");

const SR = 44_100;

/** Pulses per second in a stretch of samples: peaks of the smoothed loudness. */
function pulseRate(samples, from, to) {
  const win = Math.round(SR / 400);
  const env = [];
  for (let i = from; i < to; i += win) {
    let s = 0;
    for (let k = i; k < i + win && k < to; k++) s += Math.abs(samples[k]);
    env.push(s / win);
  }
  const smooth = env.map((_, i) => (env[i - 1] ?? env[i]) * 0.25 + env[i] * 0.5 + (env[i + 1] ?? env[i]) * 0.25);
  const mean = smooth.reduce((a, b) => a + b, 0) / smooth.length;
  let peaks = 0;
  for (let i = 2; i < smooth.length - 2; i++) {
    if (smooth[i] > mean && smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] && smooth[i] > smooth[i - 2] && smooth[i] > smooth[i + 2]) peaks++;
  }
  return peaks / ((to - from) / SR);
}

test("purr sounds: the right length, gentle peak, no broken samples", () => {
  const lengths = { chirp: [0.25, 0.4], short: [0.9, 1.2], long: [2.8, 3.8], loop: [18, 30] };
  for (const [kind, [min, max]] of Object.entries(lengths)) {
    const s = purr.synthPurr(kind, SR);
    const seconds = s.length / SR;
    assert.ok(seconds >= min && seconds <= max, `${kind}: ${seconds.toFixed(2)} s`);
    let peak = 0;
    for (const v of s) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 0.9) < 1e-6, `${kind} normalised to 0.9`);
  }
});

test("purr: flutters at a cat's 20–32 pulses a second", () => {
  const s = purr.synthPurr("short", SR);
  const rate = pulseRate(s, Math.round(0.15 * SR), Math.round(0.9 * SR));
  assert.ok(rate >= 18 && rate <= 34, `${rate.toFixed(1)} pulses/s`);
});

test("purr loop: starts and ends silent, so it repeats without a click", () => {
  const s = purr.synthPurr("loop", SR, 11);
  const edge = (from, to) => Math.max(...Array.from(s.subarray(from, to), Math.abs));
  assert.ok(edge(0, 20) < 0.02, "silent start");
  assert.ok(edge(s.length - 20, s.length) < 0.02, "silent end");
});

test("purr: the same seed gives the same sound", () => {
  assert.deepEqual(purr.synthPurr("chirp", 8000, 3), purr.synthPurr("chirp", 8000, 3));
});

test("purring sounds: off by default, sensible moments ticked, bad saves repaired", () => {
  assert.equal(prefs.defaultCompanionSettings.sound, false, "off until the learner turns it on");
  assert.equal(prefs.defaultPurrSettings.clicks, false, "every click is opt-in");
  assert.equal(prefs.defaultPurrSettings.focus, false);
  assert.equal(prefs.defaultPurrSettings.pets, true);
  assert.deepEqual(prefs.cleanPurr(undefined), prefs.defaultPurrSettings);
  assert.deepEqual(prefs.cleanPurr({ clicks: true, meows: "yes", extra: true }), { ...prefs.defaultPurrSettings, clicks: true });
});

test("lamp: phones and tablets get it, desktop rule unchanged", () => {
  assert.equal(lampGeo.lampFits(390, 52, true), true, "phone");
  assert.equal(lampGeo.lampFits(820, 60, true), true, "tablet");
  assert.equal(lampGeo.lampFits(280, 52, true), false, "too narrow");
  assert.equal(lampGeo.lampFits(1024, 84), true, "desktop");
  assert.equal(lampGeo.lampFits(640, 60), false, "desktop rule as before");
  // On a phone there is room on at least one side from either corner.
  const step = 52 * 0.3;
  assert.ok(lampGeo.planLamp(390 - 52 - 2, 52, 390, step), "from the right corner");
  assert.ok(lampGeo.planLamp(2, 52, 390, step), "from the left corner");
});
