// Unit tests for the companion's pure logic. Run with `npm test` (Node's built-in test runner; the
// TypeScript modules are transpiled in memory with the project's own TypeScript, no extra dependencies).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Import a TS module that has only type imports (they are erased by the transpile). */
async function load(file) {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: file });
  assert.ok(!/^\s*import\s/m.test(outputText), `${file} must only have type imports to be unit-tested here`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const behaviour = await load("lib/companion/behaviour.ts");
const physics = await load("lib/companion/physics.ts");
const lines = await load("lib/companion/lines.ts");

const mind = (over = {}) => ({ phase: "resting", napping: false, idleLevel: 0, focusPhase: null, ...over });

test("body motion always wins the pose", () => {
  assert.equal(behaviour.deriveMood(mind({ phase: "dragging", reaction: "happy", napping: true })), "dragged");
  assert.equal(behaviour.deriveMood(mind({ phase: "flying", rising: true })), "jumping");
  assert.equal(behaviour.deriveMood(mind({ phase: "flying", rising: false })), "falling");
  assert.equal(behaviour.deriveMood(mind({ phase: "landing", bubbleMood: "thinking" })), "landing");
  assert.equal(behaviour.deriveMood(mind({ phase: "walking", focusPhase: "focus" })), "walking");
});

test("resting pose follows reaction > routine > bubble > sleep > focus > idle", () => {
  assert.equal(behaviour.deriveMood(mind({ reaction: "purring", routine: "lamp-sit", bubbleMood: "thinking" })), "purring");
  assert.equal(behaviour.deriveMood(mind({ routine: "lamp-crouch", bubbleMood: "thinking" })), "crouching");
  assert.equal(behaviour.deriveMood(mind({ phase: "perched", routine: "lamp-sit", idleLevel: 2 })), "sleeping");
  assert.equal(behaviour.deriveMood(mind({ bubbleMood: "thinking", idleLevel: 2 })), "thinking");
  assert.equal(behaviour.deriveMood(mind({ napping: true, focusPhase: "focus" })), "sleeping");
  assert.equal(behaviour.deriveMood(mind({ focusPhase: "focus", idleLevel: 1 })), "studying");
  assert.equal(behaviour.deriveMood(mind({ idleLevel: 1 })), "sitting");
  assert.equal(behaviour.deriveMood(mind()), "idle");
});

test("nothing unprompted while moving, busy, in focus or hidden", () => {
  const quiet = { phase: "resting", menuOpen: false, bubble: false, routine: false, focusRunning: false, pageVisible: true };
  assert.equal(behaviour.canActOnItsOwn(quiet), true);
  assert.equal(behaviour.canActOnItsOwn({ ...quiet, phase: "perched" }), true);
  for (const phase of ["dragging", "flying", "dropping", "landing", "walking", "jumping"]) {
    assert.equal(behaviour.canActOnItsOwn({ ...quiet, phase }), false, phase);
  }
  for (const key of ["menuOpen", "bubble", "routine", "focusRunning"]) assert.equal(behaviour.canActOnItsOwn({ ...quiet, [key]: true }), false, key);
  assert.equal(behaviour.canActOnItsOwn({ ...quiet, pageVisible: false }), false);
});

/** Simulate a throw until the body settles. */
function simulate(profile, start, velocity, arena, maxSteps = 2000) {
  let body = { ...start, vx: velocity.x, vy: velocity.y, grounded: false };
  let steps = 0;
  while (!physics.isSettled(body, profile) && steps < maxSteps) {
    body = physics.stepFall(body, 1 / 60, arena, profile);
    steps += 1;
  }
  return { body, steps };
}

const arena = { minX: 8, maxX: 1348, floorY: 806, ceilingY: 4, capY: -1000 };

test("a throw lands on the floor inside the walls and stays where it stopped", () => {
  for (const v of [{ x: 1500, y: -900 }, { x: -2500, y: 200 }, { x: 0, y: 0 }, { x: 900, y: -2000 }]) {
    const vel = physics.clampVelocity(v, physics.GRAVITY.desktop.maxThrow);
    const { body, steps } = simulate(physics.GRAVITY.desktop, { x: 600, y: 300 }, vel, arena);
    assert.ok(steps < 2000, "settles");
    assert.equal(body.y, arena.floorY);
    assert.ok(body.x >= arena.minX && body.x <= arena.maxX);
    // Settled means settled: further steps do not move her (no drift back to a preset spot).
    const later = physics.stepFall(physics.stepFall(body, 1 / 60, arena, physics.GRAVITY.desktop), 1 / 60, arena, physics.GRAVITY.desktop);
    assert.ok(Math.abs(later.x - body.x) < 1, `stays at x=${body.x}`);
  }
});

test("throws are capped and slower than before (softer feel)", () => {
  const v = physics.clampVelocity({ x: 9000, y: 0 }, physics.GRAVITY.desktop.maxThrow);
  assert.ok(Math.hypot(v.x, v.y) <= physics.GRAVITY.desktop.maxThrow + 1e-9);
  assert.ok(physics.GRAVITY.desktop.maxThrow < 2200 && physics.GRAVITY.desktop.gravity < 2400, "tuned below the previous profile");
  assert.ok(physics.GRAVITY.compact.maxThrow < physics.GRAVITY.desktop.maxThrow);
  const zero = physics.clampVelocity({ x: Number.NaN, y: 0 }, 100);
  assert.deepEqual(zero, { x: 0, y: 0 });
});

test("a plain fall (no throw) takes longer than with the old gravity", () => {
  const fall = (g) => {
    const p = { ...physics.GRAVITY.desktop, gravity: g, minBounce: 1e9 };
    return simulate(p, { x: 600, y: 100 }, { x: 0, y: 0 }, arena).steps;
  };
  assert.ok(fall(physics.GRAVITY.desktop.gravity) > fall(2400));
});

test("pickFresh never repeats a line until the category is used up", () => {
  lines.resetLineHistory();
  const list = ["a", "b", "c", "d"];
  const first = new Set(Array.from({ length: list.length }, () => lines.pickFresh(list)));
  assert.equal(first.size, list.length, "each line once");
  const next = lines.pickFresh(list);
  assert.ok(list.includes(next));
});

test("every multi-line category has distinct, non-empty lines", () => {
  for (const [name, value] of Object.entries(lines.LINES)) {
    if (!Array.isArray(value)) continue;
    assert.ok(value.length >= 2, `${name} has variety`);
    assert.equal(new Set(value).size, value.length, `${name} has no duplicates`);
    for (const l of value) assert.ok(l.trim().length > 0 && l.length <= 160, `${name}: short line`);
  }
  assert.equal(lines.fill("{a} of {b}", { a: 1, b: 2 }), "1 of 2");
});
