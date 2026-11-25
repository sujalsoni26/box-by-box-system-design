"use client";
import { useId, useState, type ReactNode } from "react";
import { Eye, Headphones, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RangeField } from "@/components/ui/range-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { asmrNap } from "@/lib/companion/actions";
import { lampFits } from "@/lib/companion/lamp-geometry";
import { playCatSound, previewMoment } from "@/lib/companion/sound";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useCompanionStore } from "@/stores/companion-store";
import { cleanPurr, DEFAULT_PURR_VOLUME, usePreferencesStore } from "@/stores/preferences-store";
import type { PurrSettings } from "@/types/companion";

/** Can the lamp be used on this screen right now? (Same rule as the companion: room for it, motion allowed.) */
function lampFitsHere(): boolean {
  const compact = window.matchMedia("(pointer: coarse), (max-width: 640px)").matches;
  const narrow = window.matchMedia("(max-width: 640px)").matches;
  const size = narrow ? 52 : compact ? 60 : 84;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return !reduced && lampFits(document.documentElement.clientWidth, size, compact);
}

const PURR_CHOICES: { key: keyof PurrSettings; label: string; hint: string }[] = [
  { key: "talk", label: "When she talks", hint: "a small mew with her speech bubbles, now and then" },
  { key: "wake", label: "Waking up", hint: "a sleepy mraow and a little trill" },
  { key: "meows", label: "Topic meows", hint: "a meow and a purr when she shares a fact" },
  { key: "play", label: "Playing", hint: "happy trills during yarn chases and games" },
  { key: "pets", label: "Petting and feeding", hint: "a long, contented purr" },
  { key: "naps", label: "Dozing off", hint: "a soft purr as she falls asleep" },
  { key: "celebrations", label: "Celebrations", hint: "a trill, a mew and a purr for lessons, modules and perfect quizzes" },
  { key: "focus", label: "Focus blocks", hint: "a quiet purr while you focus" },
  { key: "clicks", label: "Every click", hint: "a tiny prrt on buttons and links" },
];

/** Which moments make a sound, and how loud. A tick plays that moment's sound so the learner hears what they chose. */
function PurrChoices({ compact }: { compact: boolean }) {
  const companion = usePreferencesStore((s) => s.companion);
  const setCompanion = usePreferencesStore((s) => s.setCompanion);
  const purr = cleanPurr(companion.purr);
  const volume = companion.purrVolume ?? DEFAULT_PURR_VOLUME;
  return (
    <fieldset className={cn("flex flex-col gap-2", compact ? "py-1.5" : "py-3")} data-testid="companion-purr-choices">
      <legend className={cn("font-bold text-ink", compact ? "text-[0.84rem]" : "text-[0.92rem]")}>Sounds when…</legend>
      <div className={cn("grid gap-1", !compact && "sm:grid-cols-2")}>
        {PURR_CHOICES.map((c) => (
          <label key={c.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-[0.86rem] hover:bg-surface-2">
            <input
              type="checkbox"
              checked={purr[c.key]}
              data-testid={`companion-purr-${c.key}`}
              onChange={(e) => {
                setCompanion({ purr: { ...purr, [c.key]: e.target.checked } });
                if (e.target.checked) previewMoment(c.key);
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="font-semibold text-ink">{c.label}</span>
              {compact ? null : <span className="block text-[0.78rem] leading-snug text-ink-3">{c.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      <RangeField
        label="Volume"
        value={Math.round(volume * 100)}
        min={10}
        max={100}
        step={10}
        display={`${Math.round(volume * 100)}%`}
        onChange={(v) => setCompanion({ purrVolume: v / 100 })}
        className={compact ? "text-[0.84rem]" : undefined}
      />
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={() => playCatSound("purr-long")} data-testid="companion-purr-preview">
          Hear a purr
        </Button>
        <Button size="sm" variant="ghost" onClick={() => playCatSound("mew")} data-testid="companion-meow-preview">
          Hear a mew
        </Button>
      </div>
    </fieldset>
  );
}
import { FocusLength } from "./focus-length";
import { Wardrobe } from "./wardrobe";

type OnOff = "on" | "off";
const ON_OFF = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

const onOff = (v: boolean): OnOff => (v ? "on" : "off");

function Row({ title, description, compact, children }: { title: string; description: string; compact: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4", compact ? "gap-y-1 py-1.5" : "gap-y-2 py-3")}>
      <div className="min-w-0 flex-1 basis-40">
        <p className={cn("font-bold text-ink", compact ? "text-[0.84rem]" : "text-[0.92rem]")}>{title}</p>
        {compact ? null : <p className="text-[0.82rem] leading-snug text-ink-3">{description}</p>}
      </div>
      {children}
    </div>
  );
}

interface CompanionSettingsPanelProps {
  /** Tighter layout without descriptions (used inside the companion menu). */
  compact?: boolean;
  className?: string;
}

/**
 * Companion settings: on/off, physics, study tips, topic meows, focus length, sound and reset position.
 * Everything persists (preferences store; focus length with the focus timer). With the companion off,
 * only a small "Show companion" control remains. There is no animation-speed setting: Cache follows the
 * system's reduced-motion preference, and Try it blocks have their own local speed.
 */
export function CompanionSettingsPanel({ compact = false, className }: CompanionSettingsPanelProps) {
  const hydrated = useHydrated();
  const settings = usePreferencesStore((s) => s.companion);
  const setCompanion = usePreferencesStore((s) => s.setCompanion);
  const resetPosition = useCompanionStore((s) => s.resetPosition);
  const asmr = useCompanionStore((s) => s.asmr);
  const [note, setNote] = useState("");
  const headingId = useId();
  const size = "sm";

  const frame = cn(
    compact ? "text-ink" : "rounded-2xl border border-line bg-surface px-5 py-2 shadow-[var(--shadow-soft)]",
    className,
  );

  if (!hydrated) {
    return (
      <div className={frame} aria-busy="true">
        <p className="py-3 text-[0.88rem] text-ink-3">Loading companion settings…</p>
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <section aria-labelledby={headingId} className={frame} data-testid="companion-settings">
        <h3 id={headingId} className="sr-only">
          Companion settings
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-[0.88rem] text-ink-3">Cache is hidden. Nothing floats on the page.</p>
          <Button size="sm" variant="secondary" data-testid="companion-show" onClick={() => setCompanion({ enabled: true })}>
            <Eye aria-hidden="true" className="size-4" />
            Show companion
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className={frame} data-testid="companion-settings">
      <h3 id={headingId} className="sr-only">
        Companion settings
      </h3>
      <div className="divide-y divide-line">
        <Row title="Companion" description="Show Cache, the study cat, on every page." compact={compact}>
          <SegmentedControl<OnOff>
            label="Companion"
            options={ON_OFF}
            value="on"
            onChange={(v) => setCompanion({ enabled: v === "on" })}
            size={size}
          />
        </Row>
        <Row
          title="Physics"
          description="Throw Cache: she flies, falls, lands and stays where she lands. Off: she drops straight down where you let go."
          compact={compact}
        >
          <SegmentedControl<OnOff>
            label="Physics"
            options={ON_OFF}
            value={onOff(settings.physics)}
            onChange={(v) => setCompanion({ physics: v === "on" })}
            size={size}
          />
        </Row>
        <Row
          title="Study tips"
          description="Unprompted tips and nudges. Answers to what you ask still appear."
          compact={compact}
        >
          <SegmentedControl<OnOff>
            label="Study tips"
            options={ON_OFF}
            value={onOff(settings.studyTips)}
            onChange={(v) => setCompanion({ studyTips: v === "on" })}
            size={size}
          />
        </Row>
        <Row
          title="Topic meows"
          description="Now and then, a short fact from the lesson you are reading. Never during focus blocks or quizzes."
          compact={compact}
        >
          <SegmentedControl<OnOff>
            label="Topic meows"
            options={ON_OFF}
            value={onOff(settings.topicMeows)}
            onChange={(v) => setCompanion({ topicMeows: v === "on" })}
            size={size}
          />
        </Row>
        <Row title="Focus length" description="How long one focus block lasts. A 5-minute break follows." compact={compact}>
          <FocusLength compact={compact} />
        </Row>
        <Row title="Purrs and meows" description="Cache's soft purr and little meows at the moments you pick. Off by default." compact={compact}>
          <SegmentedControl<OnOff>
            label="Purrs and meows"
            options={ON_OFF}
            value={onOff(settings.sound)}
            onChange={(v) => {
              setCompanion({ sound: v === "on" });
              if (v === "on") playCatSound("trill");
            }}
            size={size}
          />
        </Row>
        {settings.sound ? <PurrChoices compact={compact} /> : null}
        <Row
          title="ASMR purr"
          description="Cache curls up on her lamp and purrs continuously until you tap her. Plays even with purring sounds off."
          compact={compact}
        >
          <Button
            size="sm"
            variant="secondary"
            data-testid="companion-asmr"
            disabled={asmr}
            onClick={() => {
              const s = useCompanionStore.getState();
              s.closeMenu();
              asmrNap(lampFitsHere());
              setNote(asmr ? "" : "Cache is off to her lamp for sleepy purrs. Tap her to wake her.");
            }}
          >
            <Headphones aria-hidden="true" className="size-4" />
            {asmr ? "Purring…" : "Start"}
          </Button>
        </Row>
        <Row title="Position" description="Cache stays wherever you put her. Lost her behind something? Send her back to the corner." compact={compact}>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              data-testid="companion-reset-position"
              onClick={() => {
                resetPosition();
                setNote("Cache is back in its corner.");
              }}
            >
              <LocateFixed aria-hidden="true" className="size-4" />
              Reset position
            </Button>
          </div>
        </Row>
      </div>
      <p aria-live="polite" className={cn("text-[0.8rem] text-ink-3", note ? "pb-2" : "sr-only")}>
        {note}
      </p>
      {compact ? null : (
        <div className="border-t border-line py-3">
          <h4 className="font-bold text-ink">Wardrobe</h4>
          <p className="mb-2.5 text-[0.82rem] leading-snug text-ink-3">
            Accessories unlock as you learn, focus and play with Cache. Pick one to preview it, then wear it; one per slot.
          </p>
          <Wardrobe />
        </div>
      )}
    </section>
  );
}
