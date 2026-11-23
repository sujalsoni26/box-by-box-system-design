"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Local playback speed for animated Try it blocks. Each block owns its speed (React state inside its
 * InteractiveDiagram wrapper), so changing one never touches another block, the rest of the page or
 * the companion. There is no site-wide speed setting. Reduced motion still applies on top: blocks keep
 * skipping decorative motion when the operating system asks for it.
 *
 * How a block uses it:
 * - frame-loop simulations get it for free: useFrameLoop multiplies `dt` by the speed;
 * - timers and tweens divide their durations by `useSimSpeed()` (see `simDuration`);
 * - blocks that schedule against timestamps read `useSimNow()` instead of `performance.now()`;
 * - CSS keyframes read `--sim-speed`, set on the block's wrapper (e.g. `.dg-flow` in globals.css).
 */

export const SIM_SPEEDS = [0.5, 1, 1.5] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

interface SimSpeedValue {
  speed: SimSpeed;
  setSpeed: (speed: SimSpeed) => void;
  /** Only animated blocks show the control. */
  animated: boolean;
}

const SimSpeedContext = createContext<SimSpeedValue>({ speed: 1, setSpeed: () => {}, animated: false });

/** Wraps one interactive block. `animated` blocks get the speed control in their header. */
export function SimSpeedProvider({ animated, children }: { animated: boolean; children: ReactNode }) {
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const value = useMemo(() => ({ speed, setSpeed, animated }), [speed, animated]);
  const style = { "--sim-speed": String(speed) } as CSSProperties;
  return (
    <SimSpeedContext.Provider value={value}>
      <div style={style} className="contents">
        {children}
      </div>
    </SimSpeedContext.Provider>
  );
}

/** Playback speed of the enclosing Try it block (1 outside one). */
export function useSimSpeed(): number {
  return useContext(SimSpeedContext).speed;
}

/** A duration (s or ms) at the block's speed: 0.5x makes it twice as long. */
export function simDuration(base: number, speed: number): number {
  return speed > 0 ? base / speed : base;
}

/**
 * A millisecond clock that runs at the block's speed, for blocks that schedule against timestamps
 * (`until = now() + 2000` falls due after 2 s at 1x, 4 s at 0.5x). At 1x it reads exactly like
 * `performance.now()`; a speed change rebases it, so it never jumps. Returns a stable function:
 * call it from event handlers and effects, never during render.
 */
export function useSimNow(): () => number {
  const speed = useSimSpeed();
  const clock = useRef({ wall: 0, sim: 0, speed: 1 });
  useEffect(() => {
    const c = clock.current;
    const wall = performance.now();
    c.sim += (wall - c.wall) * c.speed;
    c.wall = wall;
    c.speed = speed;
  }, [speed]);
  return useCallback(() => {
    const c = clock.current;
    return c.sim + (performance.now() - c.wall) * c.speed;
  }, []);
}

const LABEL: Record<SimSpeed, string> = { 0.5: "0.5x", 1: "1x", 1.5: "1.5x" };

/** "0.5x | 1x | 1.5x" in the block header. Renders nothing for blocks that do not animate. */
export function SimSpeedControl({ className }: { className?: string }) {
  const { speed, setSpeed, animated } = useContext(SimSpeedContext);
  if (!animated) return null;
  return (
    <div
      role="group"
      aria-label="Animation speed for this block"
      data-testid="sim-speed"
      className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5", className)}
    >
      {SIM_SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={speed === s}
          onClick={() => setSpeed(s)}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold tabular-nums transition-colors",
            speed === s ? "bg-surface text-link shadow-[var(--shadow-soft)]" : "text-ink-3 hover:text-ink",
          )}
        >
          {LABEL[s]}
        </button>
      ))}
    </div>
  );
}
