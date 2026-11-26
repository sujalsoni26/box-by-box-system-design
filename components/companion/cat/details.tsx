// Crisp details: the fish she eats (Feed) and the face parts (eyes and mouth), drawn outside the mosaic.
import { motion } from "motion/react";
import type { Transition } from "motion/react";
import { type Eyes, type MouthShape, pivot } from "./art";

/* ------------------------------------------------------------------ the fish (Feed) */

/**
 * A fish held up in both paws: it drops in, two bites disappear from it, and it ends as a tidy fishbone.
 * Big (about a third of the cat's width), cool blue-silver against the warm fur, with a dark outline and an
 * eye, so it reads as a fish at every size. Declarative keyframes only: no timers to clean up.
 */
export function FishSnack({ uid, animated }: { uid: string; animated: boolean }) {
  const maskId = `cat-bite-${uid}`;
  const t = (delay: number): Transition => (animated ? { duration: 0.16, delay, ease: "easeOut" } : { duration: 0 });
  return (
    <motion.g
      data-part="fish"
      style={pivot(60, 80)}
      initial={animated ? { opacity: 0, y: -16, scale: 0.6 } : { opacity: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={animated ? { opacity: 0, scale: 0.85, transition: { duration: 0.2 } } : { opacity: 0, transition: { duration: 0 } }}
      transition={animated ? { type: "spring", stiffness: 420, damping: 20 } : { duration: 0 }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={36} y={64} width={50} height={30}>
          <rect x={36} y={64} width={50} height={30} fill="white" />
          <motion.circle cx={57} cy={73.2} fill="black" initial={{ r: 0 }} animate={{ r: animated ? 4.8 : 0 }} transition={t(0.75)} />
          <motion.circle cx={64.6} cy={74} fill="black" initial={{ r: 0 }} animate={{ r: animated ? 4.4 : 0 }} transition={t(1.3)} />
        </mask>
      </defs>
      {/* whole fish (bitten), fades to the bones near the end */}
      <motion.g mask={`url(#${maskId})`} initial={{ opacity: 1 }} animate={{ opacity: animated ? 0 : 1 }} transition={animated ? { duration: 0.22, delay: 1.85 } : { duration: 0 }}>
        <path d="M 71 80 L 80.5 73 Q 78.2 80 80.5 87 Z" className="fill-(--fish-back) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M 44 80 C 48 73.2 58 72.2 66 75.4 C 69 76.7 71 78.3 72 80 C 71 81.7 69 83.3 66 84.6 C 58 87.8 48 86.8 44 80 Z" className="fill-(--fish) stroke-(--cat-line)" strokeWidth={1.3} />
        <path d="M 46.5 81.6 C 52 85.6 61 86 69 82.4" className="fill-none stroke-(--fish-belly)" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M 49 76.6 C 55 73.8 62 73.8 68 76.4" className="fill-none stroke-(--fish-back)" strokeWidth={1.8} strokeLinecap="round" />
        <path d="M 56 73.8 Q 60.5 69.8 64.4 74.6" className="fill-(--fish-back) stroke-(--cat-line)" strokeWidth={0.9} strokeLinejoin="round" />
        <path d="M 52.6 76.4 Q 54.8 80 52.6 83.6" className="fill-none stroke-(--cat-line)" strokeWidth={0.9} strokeLinecap="round" />
        <path d="M 58 79 q 1.4 1 0 2 M 61.6 79 q 1.4 1 0 2 M 65.2 79 q 1.4 1 0 2" className="fill-none stroke-(--fish-back)" strokeWidth={0.8} strokeLinecap="round" />
        <circle cx={48.6} cy={78.8} r={1.6} className="fill-(--cat-eye)" />
        <circle cx={49.1} cy={78.3} r={0.55} className="fill-(--cat-shine)" />
      </motion.g>
      {/* the bones that are left */}
      {animated ? (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, delay: 1.9 }}>
          <path d="M 71 80 L 80.5 73 Q 78.2 80 80.5 87 Z" className="fill-(--fish-bone) stroke-(--cat-line)" strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M 44 80 C 46.5 75.8 50 74.8 53.4 75.6 L 53.4 84.4 C 50 85.2 46.5 84.2 44 80 Z" className="fill-(--fish-bone) stroke-(--cat-line)" strokeWidth={1.1} />
          <path d="M 53.4 80 L 71.5 80 M 56.5 76.6 L 56.5 83.4 M 60 76.2 L 60 83.8 M 63.5 76.6 L 63.5 83.4 M 67 77.4 L 67 82.6" className="fill-none stroke-(--cat-line)" strokeWidth={1.1} strokeLinecap="round" />
          <circle cx={48.4} cy={79} r={1.3} className="fill-none stroke-(--cat-line)" strokeWidth={0.9} />
        </motion.g>
      ) : null}
    </motion.g>
  );
}

/* ------------------------------------------------------------------ face parts (crisp) */

export function Eye({ cx, cy, shape, side }: { cx: number; cy: number; shape: Eyes; side: "left" | "right" }) {
  const ink = "fill-(--cat-eye)";
  const shine = "fill-(--cat-shine)";
  const lid = "fill-none stroke-(--cat-line)";
  switch (shape) {
    case "wide":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={5.6} ry={6.6} className={ink} />
          <circle cx={cx + 1.9} cy={cy - 2.4} r={2.1} className={shine} />
          <circle cx={cx - 1.8} cy={cy + 2.4} r={0.9} className={shine} />
        </g>
      );
    case "relaxed":
      return (
        <g>
          <path d={`M ${cx - 4.6} ${cy - 0.4} A 4.6 4.8 0 0 0 ${cx + 4.6} ${cy - 0.4} Z`} className={ink} />
          <path d={`M ${cx - 5.2} ${cy - 0.7} Q ${cx} ${cy - 2.2} ${cx + 5.2} ${cy - 0.7}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={cx + 1.6} cy={cy + 1.2} r={0.9} className={shine} />
        </g>
      );
    case "down":
      return (
        <g>
          <path d={`M ${cx - 4.4} ${cy + 1.2} A 4.4 4.4 0 0 0 ${cx + 4.4} ${cy + 1.2} Z`} className={ink} />
          <path d={`M ${cx - 5} ${cy + 0.9} Q ${cx} ${cy - 0.6} ${cx + 5} ${cy + 0.9}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      );
    case "up":
      return (
        <g>
          <ellipse cx={cx + 1.2} cy={cy - 1.3} rx={4.2} ry={5.2} className={ink} />
          <circle cx={cx + 2.6} cy={cy - 3.4} r={1.5} className={shine} />
        </g>
      );
    case "happy":
      return (
        <path
          d={`M ${cx - 4.8} ${cy + 1.6} Q ${cx} ${cy - 4.6} ${cx + 4.8} ${cy + 1.6}`}
          className="fill-none stroke-(--cat-eye)"
          strokeWidth={2.8}
          strokeLinecap="round"
        />
      );
    case "closed":
      return (
        <path
          d={`M ${cx - 4.8} ${cy - 0.4} Q ${cx} ${cy + 3.8} ${cx + 4.8} ${cy - 0.4}`}
          className="fill-none stroke-(--cat-eye)"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      );
    case "confused":
      return side === "left" ? (
        <g>
          <ellipse cx={cx} cy={cy} rx={4.6} ry={5.6} className={ink} />
          <circle cx={cx + 1.6} cy={cy - 2} r={1.5} className={shine} />
          <path d={`M ${cx - 5.5} ${cy - 9} Q ${cx} ${cy - 13} ${cx + 5.5} ${cy - 10}`} className={lid} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx={cx} cy={cy + 0.6} rx={3.6} ry={3.4} className={ink} />
          <circle cx={cx + 1.2} cy={cy - 0.6} r={1} className={shine} />
        </g>
      );
    case "open":
    default:
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={4.6} ry={5.6} className={ink} />
          <circle cx={cx + 1.6} cy={cy - 2} r={1.6} className={shine} />
          <circle cx={cx - 1.4} cy={cy + 2} r={0.7} className={shine} />
        </g>
      );
  }
}

export function Mouth({ shape }: { shape: MouthShape }) {
  const stroke = "fill-none stroke-(--cat-line)";
  switch (shape) {
    case "smile":
      return (
        <g>
          <path d="M 54.5 55 Q 60 63.5 65.5 55 Q 60 57.5 54.5 55 Z" className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1.2} strokeLinejoin="round" />
          <ellipse cx={60} cy={59.2} rx={2.3} ry={1.3} className="fill-(--cat-pink)" />
        </g>
      );
    case "o":
      return <ellipse cx={60} cy={58} rx={2.4} ry={3} className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1} />;
    case "yawn":
      return (
        <g>
          <ellipse cx={60} cy={59.4} rx={3.6} ry={4.8} className="fill-(--cat-mouth) stroke-(--cat-line)" strokeWidth={1.1} />
          <ellipse cx={60} cy={62} rx={2.2} ry={1.5} className="fill-(--cat-pink)" />
        </g>
      );
    case "wavy":
      return <path d="M 55 57.5 Q 57.5 55.8 60 57.5 Q 62.5 59.2 65 57.5" className={stroke} strokeWidth={1.7} strokeLinecap="round" />;
    case "flat":
      return <path d="M 57 57.2 L 63.6 56.6" className={stroke} strokeWidth={1.7} strokeLinecap="round" />;
    case "w":
    default:
      return (
        <path d="M 55 55.5 Q 57.5 58.5 60 55.8 Q 62.5 58.5 65 55.5" className={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      );
  }
}

/** Cache the study cat, as vector parts with a light mosaic. Memoised: re-renders only when its props change. */
