// Unit tests for the diagram lightbox's pure logic (lib/diagrams). Run with `npm test` (Node's built-in test
// runner; the TypeScript modules are transpiled in memory with the project's own TypeScript, no extra dependencies).
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

const constrained = await load("lib/diagrams/constrained.ts");
const zoom = await load("lib/diagrams/zoom.ts");
const ids = await load("lib/diagrams/svg-ids.ts");

test("natural size comes from the viewBox, else numeric width/height", () => {
  assert.deepEqual(constrained.parseViewBox("0 0 760 300"), { width: 760, height: 300 });
  assert.deepEqual(constrained.parseViewBox("-8 -8 1234.5,456"), { width: 1234.5, height: 456 });
  assert.equal(constrained.parseViewBox("0 0 0 300"), null);
  assert.equal(constrained.parseViewBox("0 0 760"), null);
  assert.equal(constrained.parseViewBox(null), null);
  assert.equal(constrained.parseLength("720px"), 720);
  assert.equal(constrained.parseLength("100%"), null);
  // Mermaid: width="100%" plus a viewBox → the viewBox wins.
  assert.deepEqual(constrained.naturalSize({ viewBox: "-8 -8 900 400", width: "100%" }), { width: 900, height: 400 });
  assert.deepEqual(constrained.naturalSize({ width: "640", height: "200px" }), { width: 640, height: 200 });
  assert.equal(constrained.naturalSize({ width: "100%", height: "auto" }), null);
});

test("a diagram that fits comfortably is not constrained", () => {
  // Drawn at (or above) natural size, no overflow.
  assert.equal(constrained.isConstrained(720, 720, 686, 686), false);
  assert.equal(constrained.isConstrained(720, 900, 932, 932), false);
  // Slightly scaled (95%) is still comfortable.
  assert.equal(constrained.isConstrained(720, 686, 718, 718), false);
  // Sub-pixel rounding is not overflow.
  assert.equal(constrained.isConstrained(720, 720, 687, 686), false);
  // Not laid out yet / hidden: never offer anything.
  assert.equal(constrained.isConstrained(720, 0, 0, 0), false);
  assert.equal(constrained.isConstrained(0, 500, 500, 500), false);
});

test("a noticeably scaled-down diagram is constrained", () => {
  // Mermaid shrinks a 1200px chart into a 686px column.
  assert.equal(constrained.isConstrained(1200, 686, 718, 718), true);
  // Just under the threshold.
  assert.equal(constrained.isConstrained(1000, 870, 902, 902), true);
  assert.equal(constrained.isConstrained(1000, 880, 912, 912), false);
  // A custom threshold.
  assert.equal(constrained.isConstrained(1000, 880, 912, 912, 0.9), true);
});

test("a diagram overflowing its scroller is constrained", () => {
  // Static SVG with min-w-[540px] in a 320px phone column.
  assert.equal(constrained.isConstrained(720, 540, 572, 254), true);
  // Even at natural size, horizontal overflow counts.
  assert.equal(constrained.isConstrained(400, 400, 432, 300), true);
});

test("fit scale shows the whole diagram, capped for small ones", () => {
  assert.equal(zoom.fitScale({ width: 1200, height: 400 }, { width: 600, height: 800 }), 0.5);
  assert.equal(zoom.fitScale({ width: 400, height: 1000 }, { width: 800, height: 500 }), 0.5);
  // A small diagram may be enlarged, but not beyond FIT_MAX.
  assert.equal(zoom.fitScale({ width: 100, height: 50 }, { width: 1600, height: 900 }), zoom.FIT_MAX);
  assert.equal(zoom.fitScale({ width: 100, height: 50 }, { width: 1600, height: 900 }, 1), 1);
  // Degenerate input never yields 0, NaN or Infinity.
  assert.equal(zoom.fitScale({ width: 0, height: 0 }, { width: 800, height: 600 }), 1);
  const tiny = zoom.fitScale({ width: 800, height: 600 }, { width: 0, height: -5 });
  assert.ok(Number.isFinite(tiny) && tiny > 0);
});

test("opening zoom: fit when readable, else natural size", () => {
  assert.equal(zoom.initialZoom(1.6), 1, "never enlarged past natural on open");
  assert.equal(zoom.initialZoom(1), 1);
  assert.equal(zoom.initialZoom(0.9), 0.9, "fit keeps text readable");
  assert.equal(zoom.initialZoom(zoom.READABLE_SCALE), zoom.READABLE_SCALE);
  assert.equal(zoom.initialZoom(0.3), 1, "fit would be unreadable: 1:1 and pan");
  assert.equal(zoom.initialZoom(Number.NaN), 1);
});

test("zoom is clamped to bounds that always include fit", () => {
  const b = zoom.zoomBounds(0.6);
  assert.deepEqual(b, { min: zoom.ZOOM_MIN, max: zoom.ZOOM_MAX });
  assert.equal(zoom.clampZoom(10, b), zoom.ZOOM_MAX);
  assert.equal(zoom.clampZoom(0.01, b), zoom.ZOOM_MIN);
  assert.equal(zoom.clampZoom(1.3, b), 1.3);
  assert.equal(zoom.clampZoom(Number.NaN, b), b.min);
  // A huge diagram on a phone: fit (0.12) is below ZOOM_MIN, so the floor drops to it.
  assert.equal(zoom.zoomBounds(0.12).min, 0.12);
  assert.equal(zoom.clampZoom(0.05, zoom.zoomBounds(0.12)), 0.12);
});

test("zoom steps through the stops and stops at the bounds", () => {
  const b = zoom.zoomBounds(0.6);
  assert.equal(zoom.stepZoom(1, 1, b), 1.25);
  assert.equal(zoom.stepZoom(1, -1, b), 0.8);
  // From an in-between level, go to the next stop in that direction.
  assert.equal(zoom.stepZoom(1.1, 1, b), 1.25);
  assert.equal(zoom.stepZoom(1.1, -1, b), 1);
  // The fit level is a stop too.
  assert.equal(zoom.stepZoom(0.8, -1, b, [0.6]), 0.67);
  assert.equal(zoom.stepZoom(0.67, -1, b, [0.6]), 0.6);
  assert.equal(zoom.stepZoom(0.6, 1, b, [0.6]), 0.67);
  // Bounds.
  assert.equal(zoom.stepZoom(zoom.ZOOM_MAX, 1, b), zoom.ZOOM_MAX);
  assert.equal(zoom.stepZoom(zoom.ZOOM_MIN, -1, b), zoom.ZOOM_MIN);
  const huge = zoom.zoomBounds(0.12);
  assert.equal(zoom.stepZoom(0.25, -1, huge), 0.12);
  // Repeated steps always terminate at a bound.
  let z = 1;
  for (let i = 0; i < 40; i += 1) z = zoom.stepZoom(z, 1, b);
  assert.equal(z, zoom.ZOOM_MAX);
  for (let i = 0; i < 40; i += 1) z = zoom.stepZoom(z, -1, b);
  assert.equal(z, zoom.ZOOM_MIN);
});

test("wheel zoom factor, anchoring and labels", () => {
  assert.ok(zoom.wheelZoomFactor(-100) > 1, "wheel up zooms in");
  assert.ok(zoom.wheelZoomFactor(100) < 1, "wheel down zooms out");
  assert.equal(zoom.wheelZoomFactor(0), 1);
  assert.equal(zoom.wheelZoomFactor(Number.NaN), 1);
  assert.equal(zoom.wheelZoomFactor(10_000), zoom.wheelZoomFactor(200), "one notch never jumps too far");
  assert.ok(zoom.wheelZoomFactor(3, 1) < 1, "line-mode deltas work");
  // The content point under the anchor stays put: point 100 (natural units) at view x 50, content offset 24.
  assert.equal(zoom.anchoredScroll(100, 50, 24, 2), 174);
  assert.equal(24 + 100 * 2 - zoom.anchoredScroll(100, 50, 24, 2), 50);
  assert.equal(zoom.anchoredScroll(0, 300, 24, 1), 0, "never negative");
  assert.equal(zoom.formatZoom(1), "100%");
  assert.equal(zoom.formatZoom(0.6667), "67%");
  assert.equal(zoom.atBound(3.999, 4), true);
  assert.equal(zoom.atBound(3.5, 4), false);
});

test("cloned Mermaid markup gets its own ids and every reference follows", () => {
  const markup = [
    '<svg id="mmd-r1-light" width="100%" style="max-width: 900px;" viewBox="0 0 900 400" aria-labelledby="chart-title-mmd-r1-light" role="graphics-document document">',
    "<style>#mmd-r1-light{font-family:sans-serif;fill:#333;}#mmd-r1-light .marker{fill:#fff;}#mmd-r1-light_flowchart-v2-pointEnd path{stroke:#ccc;}</style>",
    '<title id="chart-title-mmd-r1-light">Flow</title>',
    '<marker id="mmd-r1-light_flowchart-v2-pointEnd" class="marker flowchart-v2"><path d="M0,0"/></marker>',
    '<marker id="arrowhead"><path d="M0,0"/></marker>',
    '<g data-id="A" class="node"><rect/></g>',
    '<path marker-end="url(#mmd-r1-light_flowchart-v2-pointEnd)" d="M0,0"/>',
    '<line style="marker-end: url(&quot;#arrowhead&quot;)"/>',
    '<use href="#arrowhead"/><use xlink:href="#arrowhead"/>',
    '<path marker-end="url(#ah)"/>',
    "</svg>",
  ].join("");
  const out = ids.suffixSvgIds(markup, "-lb");

  // Every defined id is renamed…
  for (const id of ["mmd-r1-light", "chart-title-mmd-r1-light", "mmd-r1-light_flowchart-v2-pointEnd", "arrowhead"]) {
    assert.ok(out.includes(`id="${id}-lb"`), id);
    assert.ok(!out.includes(`id="${id}"`), `${id} not left behind`);
  }
  // …and the references follow.
  assert.ok(out.includes('marker-end="url(#mmd-r1-light_flowchart-v2-pointEnd-lb)"'));
  assert.ok(out.includes("url(&quot;#arrowhead-lb&quot;)"));
  assert.ok(out.includes('href="#arrowhead-lb"') && out.includes('xlink:href="#arrowhead-lb"'));
  assert.ok(out.includes('aria-labelledby="chart-title-mmd-r1-light-lb"'));
  // Scoped styles follow the renamed root; colours and unrelated selectors are untouched.
  assert.ok(out.includes("#mmd-r1-light-lb{font-family:sans-serif;fill:#333;}"));
  assert.ok(out.includes("#mmd-r1-light-lb .marker{fill:#fff;}"));
  assert.ok(out.includes("#mmd-r1-light_flowchart-v2-pointEnd-lb path"));
  // Page-level markers (not defined in this SVG) and data-id attributes are left alone.
  assert.ok(out.includes('marker-end="url(#ah)"'));
  assert.ok(out.includes('data-id="A"'));
  // Every url(#…) in the clone points at an id the clone defines, or at a page-level marker.
  const defined = ids.collectSvgIds(out);
  for (const [, , ref] of out.matchAll(/url\((&quot;|["']?)#([^"'&)\s]+)\1\)/g)) {
    assert.ok(defined.has(ref) || ref === "ah", `dangling url(#${ref})`);
  }
  // No ids → unchanged; empty suffix → unchanged.
  assert.equal(ids.suffixSvgIds('<svg viewBox="0 0 1 1"></svg>', "-lb"), '<svg viewBox="0 0 1 1"></svg>');
  assert.equal(ids.suffixSvgIds(markup, ""), markup);
});
