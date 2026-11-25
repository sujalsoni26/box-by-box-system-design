// "On this page": the outline rules and the titles of the interactive diagrams. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { appModule } from "./support/load-app.mjs";

const outline = await appModule("lib/learning/outline.ts");
const titles = await appModule("components/diagrams/interactive-titles.ts");

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
