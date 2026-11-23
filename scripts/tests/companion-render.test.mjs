// Rendering tests for Cache's sprite: every accessory and costume draws, in the right layer, in the front and
// side views and the poses that move things around (sleeping, eating, walking, leaping). Components are
// rendered to static markup with react-dom/server (as Next.js does on the server).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { appModule } from "./support/load-app.mjs";

const { PixelCat } = await appModule("components/companion/pixel-cat.tsx");
const { ACCESSORIES, COSTUMES } = await appModule("lib/companion/accessories.ts");

const HEAD = 'd="M 30 47 C 30 31 43 23 60 23';
const BODY = 'd="M 41 104 C 35 104 33 96 34.5 87';
const cat = (props = {}) => renderToStaticMarkup(createElement(PixelCat, { motionLevel: "reduced", ...props }));

test("every wardrobe item changes the drawing, in its own slot", () => {
  const bare = cat();
  for (const a of ACCESSORIES) {
    const worn = cat({ accessories: { [a.slot]: a.id } });
    assert.notEqual(worn, bare, `${a.id} draws nothing`);
  }
});

test("neckwear sits in front of the head, so the chin never hides it (gold chain especially)", () => {
  for (const mood of ["idle", "sitting", "sleeping", "eating", "happy", "dragged", "falling"]) {
    const m = cat({ mood, accessories: { neck: "gold-chain" } });
    const head = m.indexOf(HEAD);
    const links = m.match(/fill-\(--cat-gold-hi\) stroke-\(--cat-gold-lo\)/g) ?? [];
    assert.ok(head > 0, mood);
    assert.equal(links.length, 11, `${mood}: chain links`);
    assert.ok(m.indexOf("fill-(--cat-gold-hi) stroke-(--cat-gold-lo)") > head, `${mood}: chain drawn after the head`);
  }
});

test("the gold chain is outlined for contrast and is not pixelated", () => {
  const m = cat({ accessories: { neck: "gold-chain" } });
  const chainStart = m.indexOf('d="M 43 65.5 Q 60 75 77 65.5"');
  assert.ok(chainStart > 0);
  // the dark under-stroke is the first chain layer
  assert.match(m.slice(chainStart - 120, chainStart + 120), /stroke-\(--cat-line\)/);
  // not inside a mosaic-filtered group: the nearest opening <g> before it has no filter
  const before = m.slice(0, chainStart);
  const lastG = before.lastIndexOf("<g");
  assert.ok(!/filter=/.test(before.slice(lastG, lastG + 80)), "chain should be crisp");
});

test("the hero cape hangs behind the body, with clasps in front of the head", () => {
  const m = cat({ accessories: { body: "hero-cape" } });
  const cape = m.indexOf('d="M 46 66 Q 60 70 74 66');
  const drawnBody = m.indexOf(BODY, m.indexOf(BODY) + 1); // the first match is the clip path in <defs>
  assert.ok(cape > 0 && cape < drawnBody, "cape before (behind) the body");
  const clasp = m.indexOf('cx="45" cy="66" r="2.5"');
  assert.ok(clasp > m.indexOf(HEAD), "clasps after (in front of) the head");
});

test("the cape billows while airborne and hangs at rest", () => {
  const air = renderToStaticMarkup(createElement(PixelCat, { mood: "falling", accessories: { body: "hero-cape" } }));
  const rest = renderToStaticMarkup(createElement(PixelCat, { mood: "idle", accessories: { body: "hero-cape" } }));
  assert.ok(air.includes("M 46 66 Q 60 70 74 66 L 109 95"), "billow shape in the air");
  assert.ok(rest.includes("M 46 66 Q 60 70 74 66 L 103 106"), "hanging shape at rest");
});

test("costumes are body-slot outfits with a head mask, in front and side views", () => {
  assert.deepEqual([...COSTUMES].sort(), ["night-vigilante", "web-hero"]);
  for (const id of COSTUMES) assert.equal(ACCESSORIES.find((a) => a.id === id)?.slot, "body");
  const vigilante = cat({ accessories: { body: "night-vigilante" } });
  assert.match(vigilante, /--cat-fur:var\(--suit-slate\)/, "suit recolours the fur");
  assert.match(vigilante, /M 30 47 C 30 31 43 23 60 23 C 77 23 90 31 90 47 L 90 50.5/, "cowl");
  assert.match(vigilante, /M 63.2 75.6 A 5.2 5.2/, "crescent emblem");
  const web = cat({ accessories: { body: "web-hero" } });
  assert.match(web, /--cat-fur:var\(--suit-red\)/, "red mask on the head");
  assert.match(web, /M 39 41.2 Q 46.4 34.8 55.6 40.8/, "lens");
  for (const body of COSTUMES) {
    const side = cat({ mood: "walking", accessories: { body } });
    assert.match(side, /data-view="side-walk"/);
    assert.match(side, /--cat-fur:var\(--suit-/, `${body}: suit colours in side view`);
    const sleeping = cat({ mood: "sleeping", accessories: { body } });
    assert.match(sleeping, /--cat-fur:var\(--suit-/, `${body}: suit colours asleep`);
  }
});

test("no protected logos: the costumes use only generic shapes", () => {
  // The emblems are a crescent (vigilante) and plain web lines (web hero); there is no bat or spider path.
  for (const body of COSTUMES) {
    const m = cat({ accessories: { body } });
    assert.doesNotMatch(m, /bat-logo|spider/i);
  }
});

test("walking, crouching and leaping use the side view; facing left mirrors it", () => {
  assert.match(cat({ mood: "walking" }), /data-view="side-walk"/);
  assert.match(cat({ mood: "crouching" }), /data-view="side-crouch"/);
  assert.match(cat({ mood: "leaping" }), /data-view="side-leap"/);
  assert.match(cat({ mood: "sitting" }), /data-view="front"/);
  assert.match(cat({ mood: "walking", facing: "left" }), /translate\(120 0\) scale\(-1 1\)/);
  assert.doesNotMatch(cat({ mood: "walking", facing: "right" }), /translate\(120 0\) scale\(-1 1\)/);
});

test("the fish is held in front of the body, between the head and the paws, and big enough to read", () => {
  const m = cat({ mood: "eating" });
  const fish = m.indexOf('data-part="fish"');
  assert.ok(fish > m.indexOf(HEAD), "fish after the head");
  const paws = m.lastIndexOf("<ellipse", m.length);
  assert.ok(fish < paws, "fish before the paws (paws hold it)");
  // 44 → 80.5 viewBox units long: about 30% of the cat's width.
  assert.match(m, /M 44 80 C 48 73.2/);
  assert.match(m, /M 71 80 L 80.5 73/);
  assert.doesNotMatch(cat({ mood: "idle" }), /data-part="fish"/);
});

test("the yawn has its own open mouth", () => {
  assert.match(cat({ mood: "yawning" }), /cx="60" cy="59.4" rx="3.6" ry="4.8"/);
});
