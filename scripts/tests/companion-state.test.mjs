// State, persistence and timing rules behind Cache: the gait, inactivity sleep, the lamp plan, break play,
// end-of-lesson detection, the runtime store's transitions, saved-data migration and the menu.
// Run with `npm test` (Node's test runner; app modules are transpiled in memory, see support/load-app.mjs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appModule } from "./support/load-app.mjs";

const gait = await appModule("lib/companion/gait.ts");
const idle = await appModule("lib/companion/idle.ts");
const lampGeo = await appModule("lib/companion/lamp-geometry.ts");
const playPlan = await appModule("lib/companion/play-plan.ts");
const behaviour = await appModule("lib/companion/behaviour.ts");
const lessonEnd = await appModule("lib/learning/lesson-end.ts");
const { TIMING } = await appModule("lib/companion/timing.ts");

/* ------------------------------------------------------------------ gait */

test("walk: each stance sweeps the foot exactly one step, so the feet do not slide", () => {
  assert.ok(Math.abs(gait.GAITS.walk.swingDeg - gait.idealSwingDeg("walk")) < 0.5);
  for (const g of ["trot", "run"]) assert.ok(gait.GAITS[g].swingDeg <= gait.idealSwingDeg(g) + 1e-9, `${g} never over-swings`);
  for (const g of ["walk", "trot", "run"]) {
    const size = 84;
    assert.equal(gait.gaitSpeed(size, g), gait.stepLength(size, g) / (gait.GAITS[g].cycleS / 2));
  }
  assert.ok(gait.gaitSpeed(84, "walk") < gait.gaitSpeed(84, "trot") && gait.gaitSpeed(84, "trot") < gait.gaitSpeed(84, "run"));
});

test("walk plans use whole steps (she always stops with both pairs planted)", () => {
  for (const d of [3, 40, 54, 133, 600, 1300]) {
    const plan = gait.walkPlan(d, 84);
    assert.ok(Number.isInteger(plan.steps) && plan.steps >= 1);
    assert.ok(Math.abs(plan.duration - plan.steps * (gait.GAITS[plan.gait].cycleS / 2)) < 1e-9);
  }
  assert.equal(gait.chooseGait(50, 84), "walk");
  assert.equal(gait.chooseGait(300, 84), "trot");
  assert.equal(gait.chooseGait(1200, 84), "run");
  assert.equal(gait.walkPlan(1200, 84, "walk").gait, "walk", "an explicit gait wins");
});

test("legs: diagonal pairs half a cycle apart, straight linear stance, knee bend in swing", () => {
  for (const g of ["walk", "trot", "run"]) {
    const a = gait.GAITS[g].swingDeg;
    const p0 = gait.legKeyframes(g, 0);
    const p1 = gait.legKeyframes(g, 1);
    assert.deepEqual(p0.upper.slice(0, 5), [-a, -a / 2, 0, a / 2, a], "stance: forward to back, linear");
    assert.ok(p0.knee.slice(0, 5).every((k) => k === 0), "straight leg in stance");
    assert.ok(Math.max(...p0.knee) >= 40, "the knee bends in swing (the paw lifts and folds back)");
    assert.equal(p0.knee[8], 0, "straight again before touching down");
    for (let i = 0; i < 8; i += 1) {
      assert.equal(p1.upper[i], p0.upper[(i + 4) % 8], "phase 1 is phase 0 half a cycle later");
      assert.equal(p1.knee[i], p0.knee[(i + 4) % 8]);
    }
    assert.equal(p1.upper[8], p1.upper[0], "loops seamlessly");
  }
});

test("the body bob keeps the planted paw on the floor (inverted pendulum), the head stays steadier", () => {
  for (const g of ["walk", "trot", "run"]) {
    const a = (gait.GAITS[g].swingDeg * Math.PI) / 180;
    const bob = gait.bobKeyframes(g);
    assert.equal(bob.times[0], 0);
    assert.equal(bob.times[bob.times.length - 1], 1);
    for (let i = 0; i < bob.times.length; i += 1) {
      const t = bob.times[i];
      const theta = -a + 2 * a * ((t % 0.5) / 0.5);
      // hip drop + straight leg height = full leg length: the stance paw sits exactly on the floor line
      assert.ok(Math.abs(bob.y[i] + gait.LEG_UNITS * Math.cos(theta) - gait.LEG_UNITS) < 0.01, `${g} t=${t}`);
    }
    const max = Math.max(...bob.y);
    assert.ok(bob.y[0] === max && Math.min(...bob.y) === 0, "lowest at touch-down, highest at mid-stance");
  }
  assert.ok(gait.HEAD_STEADY > 0 && gait.HEAD_STEADY < 1);
});

test("the walk ease starts and stops gently and is steady in the middle", () => {
  const ease = gait.rampEase(2, "walk");
  assert.equal(ease(0), 0);
  assert.ok(Math.abs(ease(1) - 1) < 1e-9);
  let prev = 0;
  for (let i = 1; i <= 100; i += 1) {
    const v = ease(i / 100);
    assert.ok(v >= prev - 1e-12, "monotonic");
    prev = v;
  }
  const slope = (t) => (ease(t + 0.001) - ease(t)) / 0.001;
  assert.ok(Math.abs(slope(0.4) - slope(0.6)) < 1e-6, "constant speed mid-walk");
  assert.ok(slope(0.01) < slope(0.5) && slope(0.99) < slope(0.5), "ramps at both ends");
});

/* ------------------------------------------------------------------ inactivity */

const T = { settleMs: TIMING.settleMs, lampMs: TIMING.lampMs, sleepMs: TIMING.sleepMs };
const at = (over) => idle.idleStep({ idleMs: 0, idleLevel: 0, napping: false, hold: false, routine: false, lampTried: false, ...over }, T);

test("inactivity: awake, then sitting, then a lamp chance, then a yawn and sleep", () => {
  assert.deepEqual(at({ idleMs: 1000 }), { level: null, fallAsleep: false, tryLamp: false, nextMs: T.settleMs - 1000 });
  const sitting = at({ idleMs: T.settleMs });
  assert.equal(sitting.level, 1);
  assert.equal(sitting.nextMs, T.lampMs - T.settleMs);
  const lamp = at({ idleMs: T.lampMs, idleLevel: 1 });
  assert.equal(lamp.tryLamp, true);
  assert.equal(lamp.nextMs, T.sleepMs - T.lampMs);
  assert.equal(at({ idleMs: T.lampMs, idleLevel: 1, lampTried: true }).tryLamp, false, "one lamp chance per idle stretch");
  const sleep = at({ idleMs: T.sleepMs, idleLevel: 1 });
  assert.deepEqual(sleep, { level: 2, fallAsleep: true, tryLamp: false, nextMs: null });
  assert.deepEqual(at({ idleMs: T.sleepMs + 5000, idleLevel: 2 }), { level: null, fallAsleep: false, tryLamp: false, nextMs: null });
});

test("inactivity never fights a nap, a routine, focus, dialogs or quizzes", () => {
  assert.equal(at({ idleMs: T.sleepMs * 2, napping: true }).nextMs, null, "napping: wait for a deliberate wake");
  const routine = at({ idleMs: T.sleepMs * 2, routine: true, idleLevel: 1 });
  assert.equal(routine.level, null, "lamp / play / break play own her pose");
  assert.equal(routine.fallAsleep, false);
  const held = at({ idleMs: T.sleepMs * 2, hold: true, idleLevel: 1 });
  assert.equal(held.level, 0, "held awake (menu, question, focus block, dialog, quiz)");
  assert.equal(held.fallAsleep, false);
});

/* ------------------------------------------------------------------ lamp */

test("the lamp appears 3 to 5 walk steps (plus a jump) away, on screen, towards the middle", () => {
  const size = 84;
  const step = gait.stepLength(size, "walk");
  for (const catLeft of [20, 300, 640, 1100, 1340]) {
    const plan = lampGeo.planLamp(catLeft, size, 1440, step);
    assert.ok(plan, `room at ${catLeft}`);
    assert.ok(plan.steps >= 3 && plan.steps <= 5);
    const walked = Math.abs(plan.standX - catLeft);
    assert.ok(Math.abs(walked - plan.steps * step) < 1e-6, "walk distance is whole steps");
    const lampW = size * lampGeo.LAMP.w;
    assert.ok(plan.cx - lampW / 2 >= 10 && plan.cx + lampW / 2 <= 1430, "lamp fully on screen");
    assert.equal(plan.dir, catLeft + size / 2 < 720 ? 1 : -1, "towards the middle");
  }
  assert.equal(lampGeo.planLamp(10, 84, 150, step), null, "no room: no lamp");
  assert.equal(lampGeo.lampFits(1024, 84), true);
  assert.equal(lampGeo.lampFits(640, 60), false, "not on small screens");
  const perch = lampGeo.perchPoint(500, 84, 900);
  assert.equal(perch.x, 500 - 42);
  assert.ok(perch.y < 900 - 84 * lampGeo.LAMP.h, "perched above the shade top");
});

/* ------------------------------------------------------------------ break play */

test("break play alternates games, yarn included, never the same game twice in a row", () => {
  const games = Array.from({ length: 9 }, (_, i) => playPlan.breakGame(i));
  assert.ok(games.includes("yarn") && games.includes("pounce") && games.includes("zoomies"));
  for (let i = 1; i < games.length; i += 1) assert.notEqual(games[i], games[i - 1]);
  for (let i = 0; i < 20; i += 1) assert.ok(playPlan.restMs(i) >= 1300 && playPlan.restMs(i) < 2300);
  assert.equal(playPlan.playDirection(100, 1440, 200), 1);
  assert.equal(playPlan.playDirection(1400, 1440, 200), -1);
});

/* ------------------------------------------------------------------ poses */

test("deliberate jumps are side-view leaps; routine steps map to poses", () => {
  const mind = (over) => ({ phase: "resting", napping: false, idleLevel: 0, focusPhase: null, ...over });
  assert.equal(behaviour.deriveMood(mind({ phase: "jumping" })), "leaping");
  assert.equal(behaviour.deriveMood(mind({ phase: "flying", rising: true })), "jumping");
  assert.equal(behaviour.deriveMood(mind({ routine: "lamp-yawn" })), "yawning");
  assert.equal(behaviour.deriveMood(mind({ routine: "lamp-land", phase: "perched" })), "landing");
  assert.equal(behaviour.deriveMood(mind({ routine: "lamp-nap", phase: "perched" })), "sleeping");
  assert.equal(behaviour.deriveMood(mind({ routine: "play-crouch" })), "crouching");
  assert.equal(behaviour.deriveMood(mind({ routine: "play-bat" })), "playing");
  assert.equal(behaviour.deriveMood(mind({ reaction: "yawning", idleLevel: 2 })), "yawning", "the yawn plays before sleep");
  // Carried (and dropped) asleep on her lamp: she sleeps through it; an ordinary drag still shows the carried pose.
  assert.equal(behaviour.deriveMood(mind({ phase: "dragging", carriedAsleep: true })), "sleeping");
  assert.equal(behaviour.deriveMood(mind({ phase: "dropping", carriedAsleep: true })), "sleeping");
  assert.equal(behaviour.deriveMood(mind({ phase: "dragging" })), "dragged");
  for (const m of ["walking", "crouching", "leaping"]) assert.ok(behaviour.SIDE_MOODS.has(m));
  assert.ok(!behaviour.SIDE_MOODS.has("sitting"));
});

/* ------------------------------------------------------------------ end of lesson */

test("end of lesson: only after the dwell and a plausible reading time, only once, never for learned lessons", () => {
  const t = { dwellMs: 2200, minReadMs: 45_000, maxReadMs: 240_000 };
  assert.equal(lessonEnd.minReadFor(3, t), 45_000);
  assert.equal(lessonEnd.minReadFor(12, t), 180_000);
  assert.equal(lessonEnd.minReadFor(60, t), 240_000);
  assert.equal(lessonEnd.minReadFor(Number.NaN, t), 75_000, "unknown length: 5 minutes");
  assert.equal(lessonEnd.promptEligible({ tipsOn: true, completed: false, asked: false }), true);
  assert.equal(lessonEnd.promptEligible({ tipsOn: true, completed: true, asked: false }), false, "learned");
  assert.equal(lessonEnd.promptEligible({ tipsOn: true, completed: false, asked: true }), false, "asked before");
  assert.equal(lessonEnd.promptEligible({ tipsOn: false, completed: false, asked: false }), false, "tips off");
  // Opened at 0, end in view from 50 s: wait for the dwell.
  assert.equal(lessonEnd.msUntilPrompt(50_000, 0, 50_000, 45_000, 2200), 2200);
  // Jumped to the end at 5 s: wait for the reading time.
  assert.equal(lessonEnd.msUntilPrompt(5_000, 0, 5_000, 45_000, 2200), 40_000);
  assert.equal(lessonEnd.msUntilPrompt(60_000, 0, 50_000, 45_000, 2200), 0);
  assert.equal(lessonEnd.msUntilPrompt(60_000, 0, 0, 45_000, 2200), Number.POSITIVE_INFINITY, "not in view: never");
});

test("end of lesson in view: half the row, or a big slice of a short viewport", () => {
  const v = (over) => lessonEnd.endInView({ isIntersecting: true, ratio: 1, visibleHeight: 120, targetHeight: 120, viewportHeight: 800, ...over });
  assert.equal(v({}), true);
  assert.equal(v({ ratio: 0.3, visibleHeight: 36 }), false);
  assert.equal(v({ isIntersecting: false, ratio: 0 }), false);
  assert.equal(v({ ratio: 0.45, targetHeight: 400, visibleHeight: 180, viewportHeight: 320 }), true, "tall row on a landscape phone");
});

/* ------------------------------------------------------------------ runtime store */

test("store: one activity at a time, with its trigger; break play stops for the rest of the break", async () => {
  const { useCompanionStore } = await appModule("stores/companion-store.ts");
  const s = () => useCompanionStore.getState();
  s().setIdleLevel(1);
  const idleLamp = s().startActivity("lamp", "idle");
  assert.equal(s().activity.trigger, "idle");
  assert.equal(s().idleLevel, 1, "an idle lamp keeps the idle level (it wakes on activity)");
  const menuLamp = s().startActivity("lamp", "menu");
  assert.notEqual(menuLamp, idleLamp);
  assert.equal(s().idleLevel, 0);
  s().endActivity(idleLamp);
  assert.equal(s().activity.id, menuLamp, "a stale id does not end the current activity");
  s().setNapping(true);
  const nonce = s().lampWake;
  s().wakeLamp();
  assert.equal(s().lampWake, nonce + 1);
  assert.equal(s().napping, false);
  assert.equal(s().idleLevel, 0);
  s().endActivity(menuLamp);

  s().startActivity("break-play", "focus");
  s().stopBreakPlay(1234);
  assert.equal(s().activity, null);
  assert.equal(s().breakPlayOff, 1234);
  const play = s().startActivity("play");
  s().stopBreakPlay(99);
  assert.equal(s().activity?.id, play, "stopping break play leaves other activities alone");
  s().endActivity(play);
});

test("focus timer: start, pause, resume, then the break", async () => {
  const { useFocusStore } = await appModule("stores/companion-store.ts");
  const f = () => useFocusStore.getState();
  f().setFocusMinutes(10);
  f().start(0);
  assert.equal(f().session.endsAt, 600_000);
  f().pause(100_000);
  f().advance(10 * 600_000);
  assert.equal(f().session.phase, "focus", "paused sessions do not advance");
  f().resume(160_000);
  assert.equal(f().session.endsAt, 660_000);
  f().advance(661_000);
  assert.equal(f().session.phase, "break");
  f().stop();
});

/* ------------------------------------------------------------------ saved data */

test("old saves load: legacy fields dropped, new fields defaulted, unlocks and equipment kept", async () => {
  const { usePreferencesStore } = await appModule("stores/preferences-store.ts");
  const { merge } = usePreferencesStore.persist.getOptions();
  const legacy = {
    theme: "dark",
    animationSpeed: "slow",
    knownTerms: ["CDN"],
    companion: {
      enabled: true,
      physics: false,
      studyTips: true,
      sound: false,
      animations: "reduced",
      position: { x: 0.25, y: 1, floor: true },
      stats: { feeds: 3 },
      equipped: { neck: "gold-chain", body: "hero-cape" },
      announced: ["bell-collar", "gold-chain"],
    },
  };
  const merged = merge(legacy, usePreferencesStore.getState());
  assert.equal(merged.animationSpeed, undefined);
  assert.equal(merged.companion.animations, undefined);
  assert.equal(merged.theme, "dark");
  assert.deepEqual(merged.companion.equipped, { neck: "gold-chain", body: "hero-cape" });
  assert.deepEqual(merged.companion.position, { x: 0.25, y: 1, floor: true });
  assert.equal(merged.companion.physics, false);
  assert.deepEqual(merged.companion.stats, { feeds: 3, pets: 0, plays: 0, focusSessions: 0 });
  assert.deepEqual(merged.companion.seenAccessories, ["bell-collar", "gold-chain"], "announced items are not 'new' again");
  assert.equal(merged.companion.topicMeows, true);
  assert.deepEqual(merged.companion.completionAsked, {});
  // A save that already has the new outfits equipped keeps them.
  const withCostume = merge({ companion: { equipped: { body: "web-hero" } } }, usePreferencesStore.getState());
  assert.equal(withCostume.companion.equipped.body, "web-hero");
});

test("new costumes unlock from real progress and are announced like every other item", async () => {
  const acc = await appModule("lib/companion/accessories.ts");
  const ctx = { lessonsDone: 10, modulesDone: 0, perfectChecks: 0, knownCards: 0, feedsAndPlays: 0, focusSessions: 5 };
  const ids = acc.unlockedIds(ctx);
  assert.ok(ids.includes("web-hero") && ids.includes("night-vigilante"));
  const fewer = acc.unlockedIds({ ...ctx, lessonsDone: 9, focusSessions: 4 });
  assert.ok(!fewer.includes("web-hero") && !fewer.includes("night-vigilante"));
  assert.equal(new Set(acc.ACCESSORIES.map((a) => a.id)).size, acc.ACCESSORIES.length, "unique ids");
});

test("focus saves without newer fields get safe defaults", async () => {
  const { useFocusStore } = await appModule("stores/companion-store.ts");
  const { merge } = useFocusStore.persist.getOptions();
  const merged = merge({ session: null, sessionsDone: 4 }, useFocusStore.getState());
  assert.equal(merged.focusMinutes, 25);
  assert.equal(merged.sessionsDone, 4);
});

/* ------------------------------------------------------------------ menu */

test("menu: no hint or topic summary; Lamp nap only where the lamp can run", async () => {
  const actions = await appModule("lib/companion/actions.ts");
  assert.equal(actions.giveHint, undefined);
  assert.equal(actions.topicSummary, undefined);
  assert.equal(typeof actions.lampNap, "function");
  const { CompanionMenu } = await appModule("components/companion/companion-menu.tsx");
  const { getLesson } = await appModule("lib/curriculum.ts");
  const lesson = getLesson("caching");
  const menu = (lampAvailable) =>
    renderToStaticMarkup(
      createElement(CompanionMenu, { id: "m", lesson, above: true, animated: false, anchorRef: { current: null }, lampAvailable }),
    );
  const html = menu(true);
  assert.doesNotMatch(html, /Give me a hint|Current topic summary/);
  assert.doesNotMatch(html, /companion-menu-hint|companion-menu-summary/);
  for (const id of ["explain", "revise", "focus", "next", "meow", "topic-meows", "wardrobe", "feed", "pet", "nap", "lamp", "play", "hide", "settings"]) {
    assert.match(html, new RegExp(`data-testid="companion-menu-${id}"`), id);
  }
  assert.match(html, /Lamp nap/);
  assert.doesNotMatch(menu(false), /companion-menu-lamp/);
});
