// Unit tests for the lesson page's right-column panels ("On this page" and Notes). Run with `npm test`
// (Node's built-in test runner; the TypeScript module is transpiled in memory with the project's own TypeScript).
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

const panels = await load("lib/learning/side-panels.ts");
const { toggleSidePanel: toggle } = panels;
const ALL = ["toc", "notes", null];

test("opening one panel closes the other", () => {
  assert.equal(toggle("toc", "notes"), "notes");
  assert.equal(toggle("notes", "toc"), "toc");
});

test("clicking the open panel closes it, so both can be closed", () => {
  assert.equal(toggle("toc", "toc"), null);
  assert.equal(toggle("notes", "notes"), null);
});

test("with both closed, a click opens just that panel", () => {
  assert.equal(toggle(null, "toc"), "toc");
  assert.equal(toggle(null, "notes"), "notes");
});

test("never more than one open, whatever the sequence of clicks", () => {
  let state = panels.DEFAULT_SIDE_PANEL;
  const clicks = ["notes", "notes", "toc", "notes", "toc", "toc", "toc", "notes"];
  for (const clicked of clicks) {
    const next = toggle(state, clicked);
    assert.ok(ALL.includes(next), `valid state after ${clicked}`);
    // The clicked panel flips; the other one is closed either way.
    assert.equal(next === clicked, state !== clicked);
    state = next;
  }
});

test("On this page starts open, Notes closed", () => {
  assert.equal(panels.DEFAULT_SIDE_PANEL, "toc");
});

test("the stored choice round-trips, and anything unexpected gives the default", () => {
  for (const choice of ALL) assert.equal(panels.parseSidePanel(panels.serializeSidePanel(choice)), choice);
  for (const raw of [null, undefined, "", "TOC", "both", "null", '"notes"']) assert.equal(panels.parseSidePanel(raw), panels.DEFAULT_SIDE_PANEL, String(raw));
  assert.match(panels.SIDE_PANEL_STORAGE_KEY, /^sdn-/);
});
