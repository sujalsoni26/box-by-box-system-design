"use client";
import { memo, useEffect, useId, useRef } from "react";
import { animate, AnimatePresence, motion, useMotionValue } from "motion/react";
import type { Transition } from "motion/react";
import { SIDE_MOODS } from "@/lib/companion/behaviour";
import { bobKeyframes, GAITS, HEAD_STEADY } from "@/lib/companion/gait";
import type { Gait } from "@/lib/companion/gait";
import { cn } from "@/lib/utils";
import type { AnimationLevel, CompanionMood } from "@/types/companion";
import { type Extra, type SideMode, POSES, TAILS, PAWS, BODY_D, HEAD_D, CAPE_HANG, CAPE_BILLOW, BLINKABLE, EYE_L, EYE_R, BLOCK, AIRBORNE, CAT_STYLE, SUIT_BODY, SUIT_EARS, SUIT_HEAD, suitOf, pivot, SPARKLE, SPARKLES, HEART, type EquippedAccessories } from "./cat/art";
import { SideBody } from "./cat/side-view";
import { Hat, RoundGlasses, Eyewear, Neckwear, CapeClasps, Sweater, SuitFront, Cowl, MaskDetails } from "./cat/accessories";
import { FishSnack, Eye, Mouth } from "./cat/details";

export type { EquippedAccessories } from "./cat/art";

/*
 * Cache, drawn as vector parts (body, head, ears, eyes, muzzle, tail, paws) and posed with Motion.
 * "A little pixelated": the fur layers pass through a mosaic filter (5-unit blocks, about 3.5 px at
 * the 84 px desktop size) while the eyes, nose, mouth and the fine parts of accessories stay crisp, so
 * expressions and small details read clearly. The filter only re-runs while something animates. Fur colours
 * come from theme tokens; a faint --ink drop-shadow rim keeps the silhouette readable on dark backgrounds.
 *
 * Two views: front (sitting, reacting) and side (walking, crouching, leaping), cross-faded. Accessories
 * follow every pose: hats and eyewear ride on the head; neckwear sits under the chin, in front of the head
 * (so the head never hides it); capes hang behind the body; costumes recolour the fur layers through CSS
 * variables and add a mask on the head.
 */

export interface PixelCatProps {
  mood?: CompanionMood;
  /** Which way the cat is heading (the side view is mirrored for "left"). */
  facing?: "left" | "right";
  /** Walking cadence; the position hook moves the cat at the matching speed. */
  gait?: Gait;
  /** During a leap: true on the way up (nose up), false on the way down. */
  rising?: boolean;
  /** "normal" poses with springs and plays idle beats; "reduced" (prefers-reduced-motion) snaps between poses. */
  motionLevel?: AnimationLevel;
  /** Allow occasional idle micro-motions (blink, tail flick, ear twitch, drifting z). */
  ambient?: boolean;
  /** Eyes follow a mouse pointer (only while `ambient`). */
  gaze?: boolean;
  /** Worn accessories, one per slot. */
  accessories?: EquippedAccessories;
  /** Mosaic look; on by default. */
  pixelated?: boolean;
  /** Accessible name; omit when a parent (the companion button) already names the cat. */
  label?: string;
  className?: string;
}

function hopFor(mood: CompanionMood, animated: boolean, gait: Gait): { y: number | number[]; transition: Transition } {
  if (!animated) return { y: 0, transition: { duration: 0 } };
  switch (mood) {
    case "walking": {
      // The body rides the stance legs (two arcs per cycle), in step with them: same cycle, same start.
      const bob = bobKeyframes(gait);
      return { y: bob.y, transition: { y: { duration: GAITS[gait].cycleS, times: bob.times, repeat: Infinity, ease: "linear" } } };
    }
    case "celebrating":
      return { y: [0, -12, 0, -4, 0], transition: { y: { duration: 0.9, ease: "easeOut" } } };
    case "happy":
      return { y: [0, -5, 0], transition: { y: { duration: 0.45, ease: "easeOut" } } };
    case "eating":
      // Chewing: small nods while the fish is nibbled.
      return { y: [0, 1.4, 0], transition: { y: { duration: 0.34, repeat: 5, ease: "easeInOut", delay: 0.25 } } };
    case "playing":
      return { y: [0, -3, 0], transition: { y: { duration: 0.3, ease: "easeOut" } } };
    case "landing":
      return { y: [0, 2, 0], transition: { y: { duration: 0.28, ease: "easeOut" } } };
    case "stretching":
      return { y: [0, 1.5, 0], transition: { y: { duration: 0.7, ease: "easeInOut" } } };
    case "yawning":
      return { y: [0, -1.2, 0], transition: { y: { duration: 1.1, ease: "easeInOut" } } };
    default:
      return { y: 0, transition: { y: { duration: 0.25, ease: "easeOut" } } };
  }
}

function PixelCatImpl({
  mood = "idle",
  facing = "right",
  gait = "walk",
  rising = false,
  motionLevel = "normal",
  ambient = false,
  gaze = false,
  accessories,
  pixelated = true,
  label,
  className,
}: PixelCatProps) {
  const pose = POSES[mood];
  const animated = motionLevel !== "reduced";
  const side = SIDE_MOODS.has(mood);
  const sideMode: SideMode = mood === "crouching" ? "crouch" : mood === "leaping" ? "leap" : "walk";
  const dir = facing === "left" ? -1 : 1;
  const svgRef = useRef<SVGSVGElement>(null);
  const moodRef = useRef(mood);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pxId = `cat-px-${uid}`;
  const clipId = `cat-body-${uid}`;
  const headClipId = `cat-head-${uid}`;
  const fur = pixelated ? `url(#${pxId})` : undefined;
  const wear = accessories ?? {};
  const suit = suitOf(wear.body);
  const caped = wear.body === "hero-cape" || suit === "night-vigilante";

  // Imperative one-shot motions, driven by the beat timer below (no continuous loops at rest).
  const blink = useMotionValue(1);
  const tailFlick = useMotionValue(0);
  const earTwitch = useMotionValue(0);
  const zLift = useMotionValue(0);
  const gazeX = useMotionValue(0);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    if (!ambient || !animated) return;
    let timer = 0;
    let beat = 0;
    const running: Array<{ stop: () => void }> = [];
    const play = () => {
      beat += 1;
      const current = POSES[moodRef.current];
      if (current.extras.includes("zzz")) {
        running.push(animate(zLift, [0, -6, 0], { duration: 2.4, ease: "easeInOut" }));
      } else {
        if (BLINKABLE.has(current.eyes)) running.push(animate(blink, [1, 0.1, 1], { duration: 0.24, times: [0, 0.45, 1] }));
        if (beat % 3 === 0) running.push(animate(tailFlick, [0, 9, -4, 0], { duration: 0.9, ease: "easeInOut" }));
        if (beat % 4 === 2) running.push(animate(earTwitch, [0, -11, 0], { duration: 0.34, ease: "easeOut" }));
      }
      if (running.length > 8) running.splice(0, running.length - 8);
      timer = window.setTimeout(play, 3200 + Math.random() * 4800);
    };
    timer = window.setTimeout(play, 1800 + Math.random() * 2500);
    return () => {
      window.clearTimeout(timer);
      running.forEach((a) => a.stop());
      blink.set(1);
      tailFlick.set(0);
      earTwitch.set(0);
      zLift.set(0);
    };
  }, [ambient, animated, blink, tailFlick, earTwitch, zLift]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !ambient || !animated || !gaze) return;
    let raf = 0;
    let px = 0;
    let target = 0;
    let anim: { stop: () => void } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = svg.getBoundingClientRect();
        const centre = r.left + r.width / 2;
        const next = px < centre - 90 ? -1 : px > centre + 90 ? 1 : 0;
        if (next === target) return;
        target = next;
        anim?.stop();
        anim = animate(gazeX, next * 1.7, { duration: 0.25, ease: "easeOut" });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      anim?.stop();
      gazeX.set(0);
    };
  }, [ambient, animated, gaze, gazeX]);

  const spring: Transition = animated ? { type: "spring", stiffness: 300, damping: 24, mass: 0.8 } : { duration: 0 };
  const morph: Transition = animated ? { duration: 0.32, ease: "easeOut" } : { duration: 0 };
  const fade: Transition = animated ? { duration: 0.2 } : { duration: 0 };
  // Swapping between the front (sitting) and side (moving) bodies is a short cross-fade, never a cut.
  const swap: Transition = animated ? { duration: 0.16, ease: "easeOut" } : { duration: 0 };
  const has = (e: Extra) => pose.extras.includes(e);
  const hop = hopFor(mood, animated, gait);
  // In side view the head leads, ahead of the body, tipping into the direction of travel.
  const head = side
    ? sideMode === "crouch"
      ? { x: dir * 23, y: 9, rotate: dir * 3 }
      : sideMode === "leap"
        ? { x: dir * 22, y: rising ? -2 : 1, rotate: dir * (rising ? -7 : 6) }
        : { x: dir * 21, y: 3, rotate: dir * 5 }
    : pose.head;
  const shadow = side
    ? sideMode === "leap"
      ? { rx: 20, opacity: 0.06 }
      : sideMode === "crouch"
        ? { rx: 35, opacity: 0.15 }
        : { rx: 33, opacity: 0.13 }
    : pose.shadow;
  const walkBob = side && sideMode === "walk" && animated ? bobKeyframes(gait) : null;
  const headSteady = walkBob
    ? {
        animate: { y: walkBob.y.map((v) => -HEAD_STEADY * v) },
        transition: { y: { duration: GAITS[gait].cycleS, times: walkBob.times, repeat: Infinity, ease: "linear" as const } },
      }
    : { animate: { y: 0 }, transition: { y: { duration: animated ? 0.2 : 0 } } };
  const bodyVars = suit ? SUIT_BODY[suit] : undefined;
  const earVars = suit ? SUIT_EARS[suit] : undefined;
  const headVars = suit ? SUIT_HEAD[suit] : undefined;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      overflow="visible"
      className={cn("block select-none", className)}
      style={CAT_STYLE}
      focusable="false"
      data-view={side ? `side-${sideMode}` : "front"}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        {/* Mosaic: sample one point per BLOCK×BLOCK cell, then grow it back to fill the cell. */}
        <filter id={pxId} filterUnits="userSpaceOnUse" x={-20} y={-20} width={160} height={160} colorInterpolationFilters="sRGB">
          <feFlood x={-18} y={-18} width={1} height={1} result="dot" />
          <feComposite in="dot" in2="dot" operator="over" x={-20} y={-20} width={BLOCK} height={BLOCK} result="cell" />
          <feTile in="cell" result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" result="samples" />
          <feMorphology in="samples" operator="dilate" radius={(BLOCK - 1) / 2} />
        </filter>
        <clipPath id={clipId}>
          <path d={BODY_D} />
        </clipPath>
        <clipPath id={headClipId}>
          <path d={HEAD_D} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <motion.ellipse
        cx={60}
        cy={110}
        ry={3.6}
        className="fill-ink"
        initial={false}
        animate={{ rx: shadow.rx, opacity: shadow.opacity }}
        transition={spring}
      />

      <motion.g initial={false} animate={{ y: hop.y }} transition={hop.transition}>
        {/* side view (walking, crouching, leaping), cross-faded with the front view */}
        <AnimatePresence initial={false}>
          {side ? (
            <motion.g key="side" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={swap}>
              <SideBody
                fur={fur}
                flip={dir === -1}
                animated={animated}
                wear={wear}
                suit={suit}
                clipId={`${clipId}-side`}
                mode={sideMode}
                gait={gait}
                rising={rising}
              />
            </motion.g>
          ) : null}
        </AnimatePresence>

        {/* front view: tail and body fade out in side view */}
        <motion.g initial={false} animate={{ opacity: side ? 0 : 1 }} transition={swap}>
          {/* tail */}
          <g style={bodyVars}>
            <motion.g style={{ rotate: tailFlick, ...pivot(80, 100) }}>
              <g filter={fur}>
                <motion.path
                  className="fill-none stroke-(--cat-line)"
                  strokeWidth={10.5}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d: TAILS[pose.tail] }}
                  transition={morph}
                />
                <motion.path
                  className="fill-none stroke-(--cat-fur)"
                  strokeWidth={7}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ d: TAILS[pose.tail] }}
                  transition={morph}
                />
              </g>
            </motion.g>
          </g>

          {/* body: cape behind, then the body, then sweater or costume details */}
          <g style={bodyVars}>
            <motion.g style={pivot(60, 106)} initial={false} animate={pose.body} transition={spring}>
              <g filter={fur}>
                {caped ? (
                  <motion.path
                    className={cn(
                      "stroke-(--cat-line)",
                      suit === "night-vigilante" ? "fill-(--suit-slate-3)" : "fill-bad",
                    )}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ d: animated && AIRBORNE.has(mood) ? CAPE_BILLOW : CAPE_HANG }}
                    transition={animated ? { type: "spring", stiffness: 160, damping: 14 } : { duration: 0 }}
                  />
                ) : null}
                <path d={BODY_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
                {wear.body === "striped-sweater" ? (
                  <Sweater clipId={clipId} />
                ) : (
                  <>
                    <ellipse cx={60} cy={88} rx={10.5} ry={13.5} className="fill-(--cat-cream)" />
                    <path
                      d="M 37.5 88 Q 41.5 89 43.5 86 M 37 95 Q 41 96 43 93 M 82.5 88 Q 78.5 89 76.5 86 M 83 95 Q 79 96 77 93"
                      className="fill-none stroke-(--cat-fur-dark)"
                      strokeWidth={2.1}
                      strokeLinecap="round"
                    />
                  </>
                )}
              </g>
              {suit ? <SuitFront suit={suit} clipId={clipId} /> : null}
            </motion.g>
          </g>
        </motion.g>

        {/* book (studying) */}
        <AnimatePresence initial={false}>
          {has("book") ? (
            <motion.g
              key="book"
              initial={animated ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={animated ? { opacity: 0, y: 6 } : { opacity: 0 }}
              transition={fade}
            >
              <path
                d="M 41.5 76.5 L 41.5 93.5 C 49 92.5 55 93 60 95.5 C 65 93 71 92.5 78.5 93.5 L 78.5 76.5"
                className="fill-none stroke-accent"
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <path
                d="M 60 77 C 55 74.5 49 74 43 75 L 43 92 C 49 91 55 91.5 60 94 Z M 60 77 C 65 74.5 71 74 77 75 L 77 92 C 71 91 65 91.5 60 94 Z"
                className="fill-(--cat-cream) stroke-accent"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              <path
                d="M 47 79.5 L 56 80.6 M 47 83.2 L 56 84.2 M 47 86.9 L 53 87.6 M 64 80.6 L 73 79.5 M 64 84.2 L 73 83.2 M 67 87.6 L 73 86.9"
                className="fill-none stroke-line-strong"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            </motion.g>
          ) : null}
        </AnimatePresence>

        {/* head: steadier than the body while walking (it cancels part of the bob) */}
        <motion.g initial={false} {...headSteady}>
        <motion.g style={pivot(60, 66)} initial={false} animate={head} transition={spring}>
          <g filter={fur} style={headVars}>
            {/* ears sit behind the head shape */}
            <g style={earVars}>
              <motion.g style={pivot(45, 31)} initial={false} animate={{ rotate: pose.earL, scaleY: pose.earScale }} transition={spring}>
                <path
                  d="M 37 35 C 34 26 32 17 33 11 C 33.5 8.5 35.5 8 37.5 9.5 C 42 13 48 19 53 27 Z"
                  className="fill-(--cat-fur) stroke-(--cat-line)"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                />
                <path d="M 38.5 30 C 37 24 36 18 36.5 14 C 40 17 44 21 47.5 25.5 Z" className="fill-(--cat-pink)" />
              </motion.g>
              <motion.g style={pivot(75, 31)} initial={false} animate={{ rotate: pose.earR, scaleY: pose.earScale }} transition={spring}>
                <motion.g style={{ rotate: earTwitch, ...pivot(75, 31) }}>
                  <path
                    d="M 83 35 C 86 26 88 17 87 11 C 86.5 8.5 84.5 8 82.5 9.5 C 78 13 72 19 67 27 Z"
                    className="fill-(--cat-fur) stroke-(--cat-line)"
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                  />
                  <path d="M 81.5 30 C 83 24 84 18 83.5 14 C 80 17 76 21 72.5 25.5 Z" className="fill-(--cat-pink)" />
                </motion.g>
              </motion.g>
            </g>

            <path d={HEAD_D} className="fill-(--cat-fur) stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
            <path
              d="M 55 26 L 56 31.5 M 60 25 L 60 31 M 65 26 L 64 31.5"
              className="fill-none stroke-(--cat-fur-dark)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <ellipse cx={55.2} cy={56} rx={5.8} ry={4.4} className="fill-(--cat-cream)" />
            <ellipse cx={64.8} cy={56} rx={5.8} ry={4.4} className="fill-(--cat-cream)" />
            {suit === "night-vigilante" ? <Cowl /> : null}
            {wear.head ? <Hat id={wear.head} /> : null}
          </g>

          <AnimatePresence initial={false}>
            {has("blush") && suit !== "web-hero" ? (
              <motion.g key="blush" initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }} transition={fade}>
                <ellipse cx={41.5} cy={55} rx={4.2} ry={2.5} className="fill-(--cat-pink)" />
                <ellipse cx={78.5} cy={55} rx={4.2} ry={2.5} className="fill-(--cat-pink)" />
              </motion.g>
            ) : null}
          </AnimatePresence>

          {suit ? <MaskDetails suit={suit} headClipId={headClipId} /> : null}

          {/* eyes stay crisp: gaze shifts both, blink squashes each around its own centre; in side view they look ahead */}
          <motion.g initial={false} animate={{ x: side ? dir * 1.6 : 0 }} transition={spring}>
            <motion.g style={{ x: gazeX }}>
              <motion.g style={{ scaleY: blink, ...pivot(EYE_L.cx, EYE_L.cy) }}>
                <Eye {...EYE_L} shape={pose.eyes} side="left" />
              </motion.g>
              <motion.g style={{ scaleY: blink, ...pivot(EYE_R.cx, EYE_R.cy) }}>
                <Eye {...EYE_R} shape={pose.eyes} side="right" />
              </motion.g>
            </motion.g>
          </motion.g>

          <path
            d="M 57.4 51.2 Q 60 50 62.6 51.2 Q 61.6 53.8 60 54.2 Q 58.4 53.8 57.4 51.2 Z"
            className="fill-(--cat-pink) stroke-(--cat-line)"
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <Mouth shape={pose.mouth} />
          <path
            d="M 44 55 L 31 52.5 M 44 58 L 31 59.5 M 76 55 L 89 52.5 M 76 58 L 89 59.5"
            className="fill-none stroke-(--cat-line)"
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.5}
          />

          {/* Neckwear and cape clasps sit under the chin, in front of the head, and move with it in every pose. */}
          {caped ? <CapeClasps dark={suit === "night-vigilante"} /> : null}
          {wear.neck ? <Neckwear id={wear.neck} /> : null}

          {wear.eyes ? <Eyewear id={wear.eyes} /> : null}
          <AnimatePresence initial={false}>
            {has("glasses") && !wear.eyes ? (
              <motion.g key="glasses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
                <RoundGlasses />
              </motion.g>
            ) : null}
          </AnimatePresence>
        </motion.g>
        </motion.g>

        {/* the fish (Feed): held in both paws, drawn between the head and the paws */}
        <AnimatePresence initial={false}>{has("fish") ? <FishSnack key="fish" uid={uid} animated={animated} /> : null}</AnimatePresence>

        {/* paws (front layer, so a paw can rest on the chin, hold the book or the fish, or bat the yarn); hidden in side view */}
        <g style={bodyVars}>
          <motion.g filter={fur} initial={false} animate={{ opacity: side ? 0 : 1 }} transition={swap}>
            {PAWS[pose.paws].map((paw, i) => (
              <motion.ellipse key={i} className="fill-(--cat-cream) stroke-(--cat-line)" strokeWidth={1.8} initial={false} animate={paw} transition={spring} />
            ))}
          </motion.g>
        </g>
      </motion.g>

      {/* overlays */}
      <AnimatePresence initial={false}>
        {has("hearts") ? (
          <motion.g key="hearts" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            {[
              { x: 88, y: 40, delay: 0, s: 1.3 },
              { x: 99, y: 27, delay: 0.25, s: 1 },
            ].map((h) => (
              <g key={h.x} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
                <motion.path
                  d={HEART}
                  className="fill-bad"
                  initial={animated ? { opacity: 0, y: 4 } : false}
                  animate={animated ? { opacity: [0, 1, 1, 0], y: [4, 0, -4, -8] } : { opacity: 1 }}
                  transition={animated ? { duration: 1.5, delay: h.delay, ease: "easeOut" } : { duration: 0 }}
                />
              </g>
            ))}
          </motion.g>
        ) : null}
        {has("thought") ? (
          <motion.g key="thought" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <circle cx={87} cy={32} r={2.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={93.5} cy={23.5} r={3.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={103} cy={12} r={6.2} className="fill-surface stroke-line-strong" strokeWidth={1.3} />
            <circle cx={100.4} cy={12} r={0.95} className="fill-ink-3" />
            <circle cx={103} cy={12} r={0.95} className="fill-ink-3" />
            <circle cx={105.6} cy={12} r={0.95} className="fill-ink-3" />
          </motion.g>
        ) : null}
        {has("question") ? (
          <motion.text
            key="question"
            x={101}
            y={28}
            textAnchor="middle"
            className="fill-accent font-display"
            fontSize={24}
            fontWeight={800}
            initial={animated ? { opacity: 0, y: 6 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            ?
          </motion.text>
        ) : null}
        {has("zzz") ? (
          <motion.g key="zzz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <motion.g style={{ y: zLift }}>
              <text x={86} y={60} className="fill-ink-3 font-display" fontSize={10} fontWeight={700}>
                z
              </text>
              <text x={95} y={47} className="fill-ink-3 font-display" fontSize={14} fontWeight={700}>
                Z
              </text>
            </motion.g>
          </motion.g>
        ) : null}
        {has("sparkles") ? (
          <motion.g key="sparkles" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            {SPARKLES.map((s) => (
              <g key={`${s.x}-${s.y}`} transform={`translate(${s.x} ${s.y})`}>
                <motion.path
                  d={SPARKLE}
                  className={s.tone}
                  initial={animated ? { scale: 0, rotate: -30 } : false}
                  animate={animated ? { scale: [0, s.scale * 1.15, s.scale], rotate: 0 } : { scale: s.scale }}
                  transition={animated ? { duration: 0.55, delay: s.delay, ease: "easeOut" } : { duration: 0 }}
                />
              </g>
            ))}
          </motion.g>
        ) : null}
      </AnimatePresence>
    </svg>
  );
}

export const PixelCat = memo(PixelCatImpl);
