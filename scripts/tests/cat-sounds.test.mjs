// Cache's voice (purrs, meows, trills), the sound settings and the lamp on phones. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { appModule } from "./support/load-app.mjs";

const voice = await appModule("lib/companion/cat-sounds.ts");
const prefs = await appModule("stores/preferences-store.ts");
const lampGeo = await appModule("lib/companion/lamp-geometry.ts");
const outline = await appModule("lib/learning/outline.ts");
const titles = await appModule("components/diagrams/interactive-titles.ts");

const SR = 44_100;
const ALL = ["prt", "trill", "mew", "meow", "yawn", "purr", "purr-long", "purr-loop"];

/** Share of energy below `hz` (a plain DFT over a few frames). */
function shareBelow(s, hz) {
  const frame = 2048;
  let low = 0;
  let all = 0;
  for (let o = 0; o + frame < s.length; o += frame * 6) {
    for (let k = 1; k < Math.round((5000 * frame) / SR); k++) {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * k) / frame;
      for (let j = 0; j < frame; j += 2) {
        const v = s[o + j] * (0.5 - 0.5 * Math.cos((2 * Math.PI * j) / frame));
        re += v * Math.cos(w * j);
        im -= v * Math.sin(w * j);
      }
      const p = re * re + im * im;
      all += p;
      if ((k * SR) / frame < hz) low += p;
    }
  }
  return low / all;
}

/** How deeply the loudness dips between ruffles in the fullest half second (0 smooth … 1 chopped). */
function ruffleDepth(s) {
  const win = Math.round(SR * 0.005);
  const env = [];
  for (let i = 0; i + win < s.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j++) e += s[i + j] ** 2;
    env.push(Math.sqrt(e / win));
  }
  let best = 0;
  let at = 0;
  for (let i = 0; i + 100 < env.length; i += 10) {
    const m = env.slice(i, i + 100).reduce((a, b) => a + b, 0);
    if (m > best) [best, at] = [m, i];
  }
  const seg = env.slice(at, at + 100).sort((a, b) => a - b);
  return 1 - seg[10] / seg[90];
}

/** Pitch in the middle of a voiced sound, by autocorrelation. */
function pitch(s) {
  const mid = Math.floor(s.length * 0.45);
  const frame = s.subarray(mid, mid + 2048);
  let best = 0;
  let lag = 0;
  for (let l = Math.round(SR / 1600); l < Math.round(SR / 250); l++) {
    let c = 0;
    for (let i = 0; i + l < frame.length; i++) c += frame[i] * frame[i + l];
    if (c > best) [best, lag] = [c, l];
  }
  return SR / lag;
}

test("every sound renders: right length, gentle peak, no broken samples", () => {
  for (const kind of ALL) {
    const s = voice.synthCatSound(kind, SR, kind === "purr-loop" ? 11 : 7);
    const seconds = s.length / SR;
    if (kind !== "purr-loop") assert.ok(Math.abs(seconds - voice.catSoundSeconds(kind)) < 0.02, `${kind}: ${seconds.toFixed(2)} s`);
    let peak = 0;
    for (const v of s) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(Math.abs(peak - 0.9) < 1e-6, `${kind} normalised to 0.9`);
  }
});

test("the purr is soft and warm, not an engine: mostly low, gently ruffled", () => {
  for (const kind of ["purr", "purr-long"]) {
    const s = voice.synthCatSound(kind, SR);
    assert.ok(shareBelow(s, 600) > 0.85, `${kind}: ${(shareBelow(s, 600) * 100).toFixed(0)}% below 600 Hz`);
    assert.ok(ruffleDepth(s) < 0.65, `${kind}: ruffle depth ${ruffleDepth(s).toFixed(2)}`);
  }
});

test("meows are a small, high voice; the yawn is lower and the mew highest", () => {
  const mew = pitch(voice.synthCatSound("mew", SR));
  const meow = pitch(voice.synthCatSound("meow", SR));
  const yawn = pitch(voice.synthCatSound("yawn", SR));
  assert.ok(mew > 800 && mew < 1200, `mew ${mew.toFixed(0)} Hz`);
  assert.ok(meow > 550 && meow < 900, `meow ${meow.toFixed(0)} Hz`);
  assert.ok(yawn < meow + 60, `yawn ${yawn.toFixed(0)} Hz`);
});

test("purr loop: starts and ends silent, so it repeats without a click", () => {
  const s = voice.synthCatSound("purr-loop", SR, 11);
  const edge = (from, to) => Math.max(...Array.from(s.subarray(from, to), Math.abs));
  assert.ok(edge(0, 20) < 0.02, "silent start");
  assert.ok(edge(s.length - 20, s.length) < 0.02, "silent end");
});

test("the same seed gives the same sound", () => {
  assert.deepEqual(voice.synthCatSound("mew", 8000, 3), voice.synthCatSound("mew", 8000, 3));
});

test("sounds: off by default, sensible moments ticked, bad saves repaired", () => {
  assert.equal(prefs.defaultCompanionSettings.sound, false, "off until the learner turns it on");
  assert.equal(prefs.defaultPurrSettings.clicks, false, "every click is opt-in");
  assert.equal(prefs.defaultPurrSettings.focus, false);
  assert.equal(prefs.defaultPurrSettings.talk, true);
  assert.equal(prefs.defaultPurrSettings.wake, true);
  assert.deepEqual(prefs.cleanPurr(undefined), prefs.defaultPurrSettings);
  assert.deepEqual(prefs.cleanPurr({ clicks: true, meows: "yes", extra: true }), { ...prefs.defaultPurrSettings, clicks: true });
});

test("lamp: phones and tablets get it, desktop rule unchanged", () => {
  assert.equal(lampGeo.lampFits(390, 52, true), true, "phone");
  assert.equal(lampGeo.lampFits(820, 60, true), true, "tablet");
  assert.equal(lampGeo.lampFits(280, 52, true), false, "too narrow");
  assert.equal(lampGeo.lampFits(1024, 84), true, "desktop");
  assert.equal(lampGeo.lampFits(640, 60), false, "desktop rule as before");
  const step = 52 * 0.3;
  assert.ok(lampGeo.planLamp(390 - 52 - 2, 52, 390, step), "from the right corner");
  assert.ok(lampGeo.planLamp(2, 52, 390, step), "from the left corner");
});

test("On this page: thin outlines are filled out with titled callouts; duplicates and blanks dropped", () => {
  const base = [
    { id: "lesson-overview", label: "Problem to building block", level: 1 },
    { id: "try-lb-sim", label: "Try it: Load balancer", level: 2 },
    { id: "note-a", label: "Start with a monolith", level: 2, minor: true },
    { id: "try-lb-sim", label: "duplicate", level: 2 },
    { id: "blank", label: "  ", level: 1 },
    { id: "quick-recall", label: "Quick recall", level: 1 },
  ];
  const thin = outline.buildOutline(base);
  assert.deepEqual(thin.map((e) => e.id), ["lesson-overview", "try-lb-sim", "note-a", "quick-recall"]);
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `Section ${i}`, level: 1 }));
  assert.ok(!outline.buildOutline([...many, { id: "n", label: "Callout", level: 2, minor: true }]).some((e) => e.id === "n"), "callouts left out of a full outline");
  assert.ok(outline.buildOutline([{ id: "x", label: "y".repeat(100), level: 1 }])[0].label.length <= 64, "long labels shortened");
});

test("On this page: every interactive diagram has a title", () => {
  const registry = readFileSync("components/diagrams/interactive-registry.tsx", "utf8");
  const names = [...registry.matchAll(/^\s+"?([a-z0-9-]+)"?: load\(/gm)].map((m) => m[1]);
  assert.ok(names.length >= 20);
  for (const n of names) assert.ok(titles.INTERACTIVE_TITLES[n], `missing title for ${n}`);
});
