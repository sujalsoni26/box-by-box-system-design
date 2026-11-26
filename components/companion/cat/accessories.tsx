// Accessories and costumes as vector layers: hats, eyewear, neckwear, cape clasps, the sweater and the costumes.
import { cn } from "@/lib/utils";
import type { AccessoryId } from "@/types/companion";
import { type Suit, BODY_D } from "./art";

/* ------------------------------------------------------------------ accessories (vector layers) */

export function Hat({ id }: { id: AccessoryId }) {
  switch (id) {
    case "party-hat":
      return (
        <g>
          <path d="M 48 27 L 63 0 L 73 26 Q 60 30.5 48 27 Z" className="fill-accent stroke-(--cat-line)" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M 52.5 19.5 Q 61 20.5 69.6 17.6 M 57 11.6 Q 61.5 12 66.4 10.4" className="fill-none stroke-(--cat-gold)" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={63} cy={1} r={3.4} className="fill-(--cat-gold) stroke-(--cat-line)" strokeWidth={1} />
        </g>
      );
    case "wizard-hat":
      return (
        <g>
          <path d="M 46 25 Q 52 11 57 3 Q 62 -4 70 0 Q 65 3 65.5 9 L 74 25 Z" className="fill-violet stroke-(--cat-line)" strokeWidth={1.6} strokeLinejoin="round" />
          <ellipse cx={60} cy={25.5} rx={21} ry={4.4} className="fill-violet stroke-(--cat-line)" strokeWidth={1.6} />
          <path d="M 47 22.4 Q 60 26.4 73 22.4" className="fill-none stroke-(--cat-gold)" strokeWidth={2} strokeLinecap="round" />
          <path d="M 61 10.5 L 62.1 13.4 L 65 14.5 L 62.1 15.6 L 61 18.5 L 59.9 15.6 L 57 14.5 L 59.9 13.4 Z" className="fill-(--cat-gold)" />
        </g>
      );
    case "graduation-cap":
      return (
        <g>
          <path d="M 48 26 L 48 19 Q 60 16 72 19 L 72 26 Q 60 29 48 26 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
          <path d="M 60 8.5 L 85 15 L 60 21.5 L 35 15 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M 60 15 Q 74 16 80.5 18.5 L 80.5 28" className="fill-none stroke-(--cat-gold)" strokeWidth={1.6} strokeLinecap="round" />
          <rect x={78.8} y={27} width={3.4} height={5.5} rx={1} className="fill-(--cat-gold)" />
          <circle cx={60} cy={15} r={1.5} className="fill-(--cat-gold)" />
        </g>
      );
    default:
      return null;
  }
}

export function RoundGlasses() {
  return (
    <g>
      <circle cx={48} cy={45} r={7.4} className="fill-accent/15 stroke-(--cat-line)" strokeWidth={1.8} />
      <circle cx={72} cy={45} r={7.4} className="fill-accent/15 stroke-(--cat-line)" strokeWidth={1.8} />
      <path d="M 55.4 44 Q 60 41.6 64.6 44 M 40.6 44 L 33 42 M 79.4 44 L 87 42" className="fill-none stroke-(--cat-line)" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

export function Eyewear({ id }: { id: AccessoryId }) {
  if (id === "round-glasses") return <RoundGlasses />;
  if (id !== "sunglasses") return null;
  return (
    <g>
      <path d="M 40.5 40.5 Q 40.5 38.6 42.5 38.6 L 54 38.6 Q 56 38.6 55.6 41 L 54.6 46.8 Q 54 50.2 50.4 50.2 L 45.2 50.2 Q 41.6 50.2 41 46.8 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
      <path d="M 79.5 40.5 Q 79.5 38.6 77.5 38.6 L 66 38.6 Q 64 38.6 64.4 41 L 65.4 46.8 Q 66 50.2 69.6 50.2 L 74.8 50.2 Q 78.4 50.2 79 46.8 Z" className="fill-(--cat-eye) stroke-(--cat-line)" strokeWidth={1.2} />
      <path d="M 55.6 41 Q 60 39 64.4 41 M 40.6 41 L 33 39.5 M 79.4 41 L 87 39.5" className="fill-none stroke-(--cat-line)" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M 43.4 41.6 L 47.4 41 M 66.6 41.6 L 70.6 41" className="fill-none stroke-(--cat-shine)" strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

/** Points along the collar line under the chin (a quadratic from (43, 65.5) via (60, 75) to (77, 65.5)). */
export const CHAIN_LINKS = Array.from({ length: 11 }, (_, i) => {
  const t = i / 10;
  const u = 1 - t;
  const x = u * u * 43 + 2 * u * t * 60 + t * t * 77;
  const y = u * u * 65.5 + 2 * u * t * 75 + t * t * 65.5;
  // Tangent angle, for alternating link orientation.
  const dx = 2 * u * (60 - 43) + 2 * t * (77 - 60);
  const dy = 2 * u * (75 - 65.5) + 2 * t * (65.5 - 75);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, flat: i % 2 === 0 };
});

/**
 * Neckwear, drawn under the chin in front of the head (crisp, outlined), so it stays visible in every pose
 * and on both page themes. Coordinates are in the head's frame.
 */
export function Neckwear({ id }: { id: AccessoryId }) {
  switch (id) {
    case "bell-collar":
      return (
        <g>
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-(--cat-line)" strokeWidth={5} strokeLinecap="round" />
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-bad" strokeWidth={3.2} strokeLinecap="round" />
          <circle cx={60} cy={73.6} r={3.6} className="fill-(--cat-gold-hi) stroke-(--cat-line)" strokeWidth={1.1} />
          <path d="M 58 74.9 L 62 74.9" className="fill-none stroke-(--cat-line)" strokeWidth={0.9} strokeLinecap="round" />
          <circle cx={58.8} cy={72.4} r={0.8} className="fill-(--cat-shine)" opacity={0.8} />
        </g>
      );
    case "bow-tie":
      return (
        <g>
          <path d="M 60 71.5 L 50.5 66.5 Q 48.8 71.5 50.5 76.5 Z M 60 71.5 L 69.5 66.5 Q 71.2 71.5 69.5 76.5 Z" className="fill-accent stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <rect x={57.5} y={69.2} width={5} height={4.6} rx={1.3} className="fill-accent stroke-(--cat-line)" strokeWidth={1.2} />
        </g>
      );
    case "gold-chain":
      // Chunky alternating links with a dark rim (readable on amber fur and on both themes) and a medallion.
      return (
        <g>
          <path d="M 43 65.5 Q 60 75 77 65.5" className="fill-none stroke-(--cat-line)" strokeWidth={4.4} strokeLinecap="round" />
          {CHAIN_LINKS.map((l, i) => (
            <ellipse
              key={i}
              cx={l.x}
              cy={l.y}
              rx={l.flat ? 2.2 : 1.7}
              ry={l.flat ? 1.35 : 1.05}
              transform={`rotate(${l.angle} ${l.x} ${l.y})`}
              className="fill-(--cat-gold-hi) stroke-(--cat-gold-lo)"
              strokeWidth={0.7}
            />
          ))}
          <path d="M 60 70.4 L 60 72.6" className="fill-none stroke-(--cat-line)" strokeWidth={1.4} strokeLinecap="round" />
          <circle cx={60} cy={76.2} r={3.9} className="fill-(--cat-gold-hi) stroke-(--cat-line)" strokeWidth={1.2} />
          <circle cx={60} cy={76.2} r={2.2} className="fill-none stroke-(--cat-gold-lo)" strokeWidth={0.9} />
          <path d="M 58.4 74.6 L 59.4 74.2" className="fill-none stroke-(--cat-shine)" strokeWidth={0.9} strokeLinecap="round" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M 44.5 65 Q 60 71 75.5 65 L 61.6 84 Q 60 85.6 58.4 84 Z" className="fill-bad stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <circle cx={55} cy={71} r={1.1} className="fill-(--cat-cream)" />
          <circle cx={63.5} cy={73.5} r={1.1} className="fill-(--cat-cream)" />
          <circle cx={59.5} cy={78.5} r={1.1} className="fill-(--cat-cream)" />
        </g>
      );
    default:
      return null;
  }
}

/** The cape's clasps, at the corners of the jaw (in front of the head, so they always show). */
export function CapeClasps({ dark }: { dark: boolean }) {
  const tone = dark ? "fill-(--suit-slate-2)" : "fill-(--cat-gold-hi)";
  return (
    <g>
      <path d="M 45.5 66.2 Q 52 69 57 69.6 M 63 69.6 Q 68 69 74.5 66.2" className={cn("fill-none", dark ? "stroke-(--suit-slate-3)" : "stroke-bad")} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={45} cy={66} r={2.5} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1} />
      <circle cx={75} cy={66} r={2.5} className={cn(tone, "stroke-(--cat-line)")} strokeWidth={1} />
    </g>
  );
}

export function Sweater({ clipId }: { clipId: string }) {
  return (
    <g>
      <g clipPath={`url(#${clipId})`}>
        <rect x={30} y={66} width={60} height={40} className="fill-accent" />
        <rect x={30} y={78} width={60} height={3.2} className="fill-(--cat-cream)" />
        <rect x={30} y={87} width={60} height={3.2} className="fill-(--cat-cream)" />
        <rect x={30} y={96} width={60} height={3.2} className="fill-(--cat-cream)" />
      </g>
      <path d={BODY_D} className="fill-none stroke-(--cat-line)" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M 47 66.6 Q 60 72.5 73 66.6" className="fill-none stroke-(--cat-cream)" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------------ costumes (original designs) */

/** Crisp costume details on the front body (in the body's frame, so they follow every pose). */
export function SuitFront({ suit, clipId }: { suit: Suit; clipId: string }) {
  if (suit === "night-vigilante") {
    return (
      <g>
        {/* utility belt with a buckle */}
        <g clipPath={`url(#${clipId})`}>
          <rect x={32} y={94.5} width={56} height={4.2} className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
          <path d="M 42 95 L 42 98.2 M 50 95 L 50 98.2 M 70 95 L 70 98.2 M 78 95 L 78 98.2" className="fill-none stroke-(--cat-gold-lo)" strokeWidth={1.2} />
        </g>
        <rect x={56.6} y={93.8} width={6.8} height={5.6} rx={1.2} className="fill-(--cat-gold-lo) stroke-(--suit-slate-3)" strokeWidth={0.9} />
        {/* an original crescent-moon emblem (no logo) */}
        <path d="M 63.2 75.6 A 5.2 5.2 0 1 0 63.2 85.6 A 4.1 4.1 0 1 1 63.2 75.6 Z" className="fill-(--cat-gold-hi) stroke-(--suit-slate-3)" strokeWidth={0.8} />
      </g>
    );
  }
  // Web hero: a web pattern over the red chest panel (no emblem).
  return (
    <g className="fill-none stroke-(--suit-web)" strokeWidth={0.7} opacity={0.8}>
      <path d="M 60 74.6 L 60 101.4 M 60 76 L 51.5 80 M 60 76 L 68.5 80 M 60 76 L 50 90 M 60 76 L 70 90 M 60 76 L 54 101 M 60 76 L 66 101" />
      <path d="M 53.4 82 Q 60 84.2 66.6 82 M 51 89 Q 60 92 69 89 M 52.4 96 Q 60 99 67.6 96" />
    </g>
  );
}

/** The vigilante's cowl: covers the brow down to the eyes, with a point over the nose; the eye holes come next. */
export function Cowl() {
  return (
    <path
      d="M 30 47 C 30 31 43 23 60 23 C 77 23 90 31 90 47 L 90 50.5 C 84 50.2 78 52.6 71 52.6 Q 64 52.6 60 49.2 Q 56 52.6 49 52.6 C 42 52.6 36 50.2 30 50.5 Z"
      className="fill-(--suit-slate) stroke-(--suit-slate-3)"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

/** Crisp mask parts drawn under the eyes: the vigilante's eye holes, the web hero's web lines and lenses. */
export function MaskDetails({ suit, headClipId }: { suit: Suit; headClipId: string }) {
  if (suit === "night-vigilante") {
    return (
      <g>
        <path d="M 40.4 44.8 Q 47.5 38.6 55.2 43.6 Q 54 50.4 47.6 50.6 Q 41.6 50 40.4 44.8 Z" className="fill-(--cat-lens) stroke-(--suit-slate-3)" strokeWidth={1.2} />
        <path d="M 79.6 44.8 Q 72.5 38.6 64.8 43.6 Q 66 50.4 72.4 50.6 Q 78.4 50 79.6 44.8 Z" className="fill-(--cat-lens) stroke-(--suit-slate-3)" strokeWidth={1.2} />
      </g>
    );
  }
  return (
    <g>
      <g clipPath={`url(#${headClipId})`} className="fill-none stroke-(--suit-web)" strokeWidth={0.65} opacity={0.75}>
        <path d="M 60 52 L 60 20 M 60 52 L 38 26 M 60 52 L 82 26 M 60 52 L 28 44 M 60 52 L 92 44 M 60 52 L 32 66 M 60 52 L 88 66 M 60 52 L 48 72 M 60 52 L 72 72" />
        <ellipse cx={60} cy={50} rx={12} ry={9.5} />
        <ellipse cx={60} cy={48} rx={22} ry={17.5} />
        <ellipse cx={60} cy={46} rx={31} ry={25} />
      </g>
      {/* big lenses; the eyes are drawn on top, so every expression still reads */}
      <path d="M 39 41.2 Q 46.4 34.8 55.6 40.8 Q 55.6 50.6 48 51.6 Q 40.2 50.6 39 41.2 Z" className="fill-(--cat-lens) stroke-(--suit-web)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 81 41.2 Q 73.6 34.8 64.4 40.8 Q 64.4 50.6 72 51.6 Q 79.8 50.6 81 41.2 Z" className="fill-(--cat-lens) stroke-(--suit-web)" strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  );
}
