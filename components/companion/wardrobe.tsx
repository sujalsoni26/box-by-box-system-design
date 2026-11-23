"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { Check, Lock, Shirt } from "lucide-react";
import {
  ACCESSORIES,
  getAccessory,
  isUnlocked,
  progressLabel,
  rewardContext,
  SLOT_LABEL,
  SLOTS,
  unlockedIds,
  type AccessoryDef,
} from "@/lib/companion/accessories";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMotionLevel } from "@/lib/hooks/use-motion-level";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";
import type { AccessoryId } from "@/types/companion";
import { PixelCat } from "./pixel-cat";

function useRewardContext() {
  const completed = useProgressStore((s) => s.completed);
  const quizAttempts = useProgressStore((s) => s.quizAttempts);
  const knownCards = useProgressStore((s) => s.knownCards);
  const stats = usePreferencesStore((s) => s.companion.stats);
  return useMemo(() => rewardContext({ completed, quizAttempts, knownCards }, stats), [completed, quizAttempts, knownCards, stats]);
}

/** Unlocked accessories the learner has not looked at in the wardrobe yet (drives the "new" dot and badge). */
export function useNewAccessoryCount(): number {
  const hydrated = useHydrated();
  const ctx = useRewardContext();
  const seen = usePreferencesStore((s) => s.companion.seenAccessories);
  if (!hydrated) return 0;
  const seenSet = new Set(seen);
  return unlockedIds(ctx).filter((id) => !seenSet.has(id)).length;
}

type ItemState = "locked" | "available" | "wearing";

/**
 * Accessories Cache can wear, one per slot. Four distinct states:
 * - locked: dashed tile, lock icon, what unlocks it and a progress bar (you can still preview it);
 * - available: unlocked, not worn;
 * - selected: the tile you are previewing (outlined; aria-pressed), shown on the cat above;
 * - wearing: filled tile with a check ("Wearing").
 * Selecting previews; the button under the preview wears or takes off. Unlocks you have not seen yet
 * carry a "New" badge until you leave the wardrobe.
 */
export function Wardrobe({ compact = false, className }: { compact?: boolean; className?: string }) {
  const hydrated = useHydrated();
  const motionLevel = useMotionLevel();
  const ctx = useRewardContext();
  const equipped = usePreferencesStore((s) => s.companion.equipped);
  const seen = usePreferencesStore((s) => s.companion.seenAccessories);
  const equip = usePreferencesStore((s) => s.equipAccessory);
  const [selected, setSelected] = useState<AccessoryId | null>(null);
  const [note, setNote] = useState("");
  const statusId = useId();

  // "New" badges stay visible while the wardrobe is open; leaving it marks everything unlocked as seen.
  useEffect(() => {
    if (!hydrated) return;
    return () => {
      const prefs = usePreferencesStore.getState();
      const p = useProgressStore.getState();
      prefs.markAccessoriesSeen(unlockedIds(rewardContext(p, prefs.companion.stats)));
    };
  }, [hydrated]);

  if (!hydrated) return <p className="py-2 text-[0.84rem] text-ink-3">Loading wardrobe…</p>;

  const seenSet = new Set(seen);
  const isNew = (id: AccessoryId) => !seenSet.has(id);
  const stateOf = (a: AccessoryDef): ItemState => (equipped[a.slot] === a.id ? "wearing" : isUnlocked(a, ctx) ? "available" : "locked");
  const def = selected ? getAccessory(selected) : undefined;
  const preview = def ? { ...equipped, [def.slot]: def.id } : equipped;
  const selectedState = def ? stateOf(def) : null;

  const act = () => {
    if (!def || selectedState === "locked") return;
    if (selectedState === "wearing") {
      equip(def.slot, null);
      setNote(`${def.name} taken off.`);
    } else {
      equip(def.slot, def.id);
      setNote(`Cache is wearing the ${def.name.toLowerCase()}.`);
    }
  };

  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-4", className)} data-testid="wardrobe">
      {/* Preview: the cat wearing what you have on, plus the item you are looking at. */}
      <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface-2", compact ? "p-2" : "p-3")}>
        <div
          className={cn("shrink-0 rounded-lg bg-surface", compact ? "size-[72px] p-1" : "size-[96px] p-1.5")}
          data-testid="wardrobe-preview"
          data-preview={Object.values(preview).join(",")}
        >
          <PixelCat mood={def ? "happy" : "idle"} motionLevel={motionLevel} accessories={preview} label="Preview of Cache" />
        </div>
        <div className="min-w-0 flex-1">
          {def ? (
            <>
              <p className="text-[0.86rem] font-bold leading-tight text-ink">{def.name}</p>
              <p className="mt-0.5 text-[0.74rem] leading-snug text-ink-3">
                {selectedState === "locked"
                  ? `Locked: ${def.requirement.toLowerCase()} (${progressLabel(def, ctx)}). Preview only.`
                  : selectedState === "wearing"
                    ? `Wearing · ${SLOT_LABEL[def.slot]}`
                    : `Unlocked · ${SLOT_LABEL[def.slot]}${equipped[def.slot] ? `, replaces the ${getAccessory(equipped[def.slot]!)?.name.toLowerCase()}` : ""}`}
              </p>
              <button
                type="button"
                data-testid="wardrobe-action"
                disabled={selectedState === "locked"}
                onClick={act}
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.8rem] font-bold transition-colors disabled:cursor-not-allowed",
                  selectedState === "wearing"
                    ? "border-line-strong bg-surface text-ink hover:border-ink-3"
                    : selectedState === "locked"
                      ? "border-dashed border-line bg-surface text-ink-3"
                      : "border-accent bg-accent text-accent-ink hover:bg-accent-hover hover:text-accent-hover-ink",
                )}
              >
                {selectedState === "locked" ? <Lock aria-hidden="true" className="size-3.5" /> : <Shirt aria-hidden="true" className="size-3.5" />}
                {selectedState === "wearing" ? "Take off" : selectedState === "locked" ? "Locked" : "Wear it"}
              </button>
            </>
          ) : (
            <p className="text-[0.8rem] leading-snug text-ink-3">
              Pick an item to preview it on Cache, then wear it. Items unlock as you learn, focus and play.
            </p>
          )}
          <p id={statusId} aria-live="polite" className={cn("text-[0.74rem] text-good", note ? "mt-1" : "sr-only")}>
            {note}
          </p>
        </div>
      </div>

      {SLOTS.map((slot) => (
        <div key={slot} role="group" aria-label={`${SLOT_LABEL[slot]} accessories`}>
          <p className="mb-1 font-mono text-[0.64rem] font-bold uppercase tracking-[0.14em] text-ink-3">{SLOT_LABEL[slot]}</p>
          <div className={cn("grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
            {ACCESSORIES.filter((a) => a.slot === slot).map((a) => {
              const state = stateOf(a);
              const active = selected === a.id;
              const fresh = state !== "locked" && isNew(a.id);
              const pct = Math.min(1, a.value(ctx) / a.target);
              return (
                <button
                  key={a.id}
                  type="button"
                  data-testid={`accessory-${a.id}`}
                  data-state={state}
                  aria-pressed={active}
                  aria-label={`${a.name}: ${state === "wearing" ? "wearing" : state === "locked" ? `locked, ${a.requirement}, ${progressLabel(a, ctx)}` : "unlocked"}${fresh ? ", new" : ""}. Preview`}
                  onClick={() => {
                    setSelected(active ? null : a.id);
                    setNote("");
                  }}
                  onDoubleClick={() => {
                    if (state === "locked") return;
                    equip(a.slot, state === "wearing" ? null : a.id);
                  }}
                  className={cn(
                    "relative flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
                    state === "wearing"
                      ? "border-accent bg-accent-soft text-ink"
                      : state === "available"
                        ? "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                        : "border-dashed border-line-strong bg-surface-2 text-ink-3",
                    active && "outline-2 outline-offset-1 outline-link",
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    {state === "wearing" ? (
                      <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center rounded bg-accent text-accent-ink">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : state === "locked" ? (
                      <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[0.8rem] font-bold leading-tight">{a.name}</span>
                    {fresh ? (
                      <span aria-hidden="true" className="shrink-0 rounded-full bg-review-soft px-1.5 font-mono text-[0.6rem] font-bold text-review">
                        New
                      </span>
                    ) : null}
                  </span>
                  {state === "locked" ? (
                    <span aria-hidden="true" className="mt-0.5 block h-1 w-full overflow-hidden rounded-full bg-line">
                      <span className="block h-full rounded-full bg-ink-3" style={{ width: `${Math.round(pct * 100)}%` }} />
                    </span>
                  ) : (
                    <span className="text-[0.68rem] leading-tight">{state === "wearing" ? "Wearing" : "Unlocked"}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
