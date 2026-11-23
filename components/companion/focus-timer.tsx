"use client";
import { useEffect, useState } from "react";
import { Pause, Play, SkipForward, Square } from "lucide-react";
import { pauseFocus, resumeFocus } from "@/lib/companion/actions";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { cn } from "@/lib/utils";
import { ensureFocusHydrated, focusRemaining, useFocusHydrated, useFocusStore } from "@/stores/companion-store";

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact focus-timer chip: a focus block (5–120 min, 25 by default; set in companion settings), then a
 * 5-minute break. Pause, resume, skip and stop. Persisted, so a refresh carries on (paused stays paused).
 * Ticks once a second only while a session runs unpaused and the tab is visible; each tick also advances
 * the phase when it runs out (the companion announces the change).
 */
export function FocusTimer({ className }: { className?: string }) {
  const hydrated = useFocusHydrated();
  const session = useFocusStore((s) => s.session);
  const skip = useFocusStore((s) => s.skip);
  const stop = useFocusStore((s) => s.stop);
  const visible = usePageVisible();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    ensureFocusHydrated();
  }, []);

  const paused = Boolean(session?.pausedAt);
  useEffect(() => {
    if (!session || !visible || paused) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      useFocusStore.getState().advance(t);
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [session, visible, paused]);

  if (!hydrated || !session) return null;
  const isFocus = session.phase === "focus";
  const remaining = focusRemaining(session, now);
  const left = formatLeft(remaining);
  const minutesLeft = Math.max(0, Math.ceil(remaining / 60_000));

  return (
    <div
      role="group"
      aria-label={isFocus ? "Focus timer" : "Break timer"}
      data-testid="focus-timer"
      data-phase={session.phase}
      data-paused={paused ? "true" : "false"}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line-strong bg-surface py-0.5 pl-2.5 pr-0.5 text-[0.74rem] text-ink shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", paused ? "bg-ink-3" : isFocus ? "bg-accent" : "bg-good")} />
      <span className="font-bold">{paused ? "Paused" : isFocus ? "Focus" : "Break"}</span>
      <span
        role="timer"
        aria-label={`${minutesLeft} ${minutesLeft === 1 ? "minute" : "minutes"} left${paused ? ", paused" : ""}`}
        className={cn("font-mono tabular-nums", paused ? "text-ink-3" : "text-ink-2")}
      >
        {left}
      </span>
      <button
        type="button"
        data-testid="focus-timer-pause"
        onClick={paused ? resumeFocus : pauseFocus}
        aria-label={paused ? "Resume timer" : "Pause timer"}
        title={paused ? "Resume timer" : "Pause timer"}
        className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {paused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
      </button>
      <button
        type="button"
        data-testid="focus-timer-skip"
        onClick={() => skip(Date.now())}
        aria-label={isFocus ? "Skip to break" : "End break"}
        title={isFocus ? "Skip to break" : "End break"}
        className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <SkipForward aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        data-testid="focus-timer-stop"
        onClick={stop}
        aria-label="Stop timer"
        title="Stop timer"
        className="grid size-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-bad"
      >
        <Square aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}
