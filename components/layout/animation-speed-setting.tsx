"use client";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useMotionLevel } from "@/lib/hooks/use-motion-level";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { AnimationLevel } from "@/types/companion";

const OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "slow", label: "Slow" },
  { value: "reduced", label: "Reduced motion" },
] as const;

/**
 * Site-wide animation speed (pages and the companion), saved with the other preferences.
 * With nothing chosen it follows the operating system's reduced-motion setting.
 */
export function AnimationSpeedSetting({ compact = false, className }: { compact?: boolean; className?: string }) {
  const hydrated = useHydrated();
  const chosen = usePreferencesStore((s) => s.animationSpeed);
  const setAnimationSpeed = usePreferencesStore((s) => s.setAnimationSpeed);
  const effective = useMotionLevel();
  const osReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const following = hydrated && chosen === null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <SegmentedControl<AnimationLevel>
        label="Animation speed"
        options={OPTIONS}
        value={hydrated ? effective : "normal"}
        onChange={setAnimationSpeed}
        size={compact ? "sm" : "md"}
      />
      <p className="text-[0.8rem] leading-snug text-ink-3" aria-live="polite">
        {following ? (
          `Following your system setting${osReduced ? " (reduced motion)" : ""}.`
        ) : (
          <>
            Applies to page and companion animations.{" "}
            <button
              type="button"
              onClick={() => setAnimationSpeed(null)}
              className="font-bold text-link underline underline-offset-2 hover:text-ink"
            >
              Use system setting
            </button>
          </>
        )}
      </p>
    </div>
  );
}
