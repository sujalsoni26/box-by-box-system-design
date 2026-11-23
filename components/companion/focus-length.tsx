"use client";
import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clampFocusMinutes,
  ensureFocusHydrated,
  FOCUS_MINUTES_MAX,
  FOCUS_MINUTES_MIN,
  useFocusHydrated,
  useFocusStore,
} from "@/stores/companion-store";

const PRESETS = [15, 25, 50] as const;
const STEP = 5;

/**
 * Focus block length, 5–120 minutes, saved with the focus timer. Steppers move by 5; the field accepts
 * any whole number and is clamped on commit. A running block keeps its length (the change applies next time).
 */
export function FocusLength({ compact = false }: { compact?: boolean }) {
  const hydrated = useFocusHydrated();
  const minutes = useFocusStore((s) => s.focusMinutes);
  const running = useFocusStore((s) => s.session?.phase === "focus");
  const setMinutes = useFocusStore((s) => s.setFocusMinutes);
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    ensureFocusHydrated();
  }, []);

  const value = hydrated ? minutes : 25;
  const commit = (raw: string | number) => {
    setMinutes(clampFocusMinutes(raw));
    setDraft(null);
  };
  const stepBy = (delta: number) => commit(Math.round((value + delta) / STEP) * STEP || value + delta);

  return (
    <div className="flex flex-col items-end gap-1" data-testid="focus-length">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="5 minutes shorter"
          disabled={!hydrated || value <= FOCUS_MINUTES_MIN}
          onClick={() => stepBy(-STEP)}
          className="grid size-7 place-items-center rounded-md border border-line-strong bg-surface text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Minus aria-hidden="true" className="size-3.5" />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Focus length in minutes
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={FOCUS_MINUTES_MIN}
          max={FOCUS_MINUTES_MAX}
          step={1}
          disabled={!hydrated}
          aria-describedby={hintId}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
            if (e.key === "Escape") setDraft(null);
          }}
          className="h-7 w-14 rounded-md border border-line-strong bg-surface px-1.5 text-center font-mono text-[0.84rem] tabular-nums text-ink"
        />
        <span className="text-[0.8rem] text-ink-3">min</span>
        <button
          type="button"
          aria-label="5 minutes longer"
          disabled={!hydrated || value >= FOCUS_MINUTES_MAX}
          onClick={() => stepBy(STEP)}
          className="grid size-7 place-items-center rounded-md border border-line-strong bg-surface text-ink-2 hover:text-ink disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {compact ? null : (
        <div className="flex gap-1" role="group" aria-label="Common focus lengths">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={value === m}
              onClick={() => commit(m)}
              className={cn(
                "rounded-md px-2 py-0.5 font-mono text-[0.7rem] font-semibold",
                value === m ? "bg-accent-soft text-link" : "text-ink-3 hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      <p id={hintId} className="text-right text-[0.72rem] text-ink-3">
        {FOCUS_MINUTES_MIN}–{FOCUS_MINUTES_MAX} min{running ? ". Applies from the next block." : "."}
      </p>
    </div>
  );
}
