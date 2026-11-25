"use client";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { lessons } from "@/lib/curriculum";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { suggestedPace, todayIso } from "@/lib/learning/pace";
import { cn, formatHours } from "@/lib/utils";
import {
  cleanProfile,
  DEFAULT_CALL_ME,
  PROFILE_LIMITS,
  usePreferencesStore,
  type LearningGoal,
  type Profile,
} from "@/stores/preferences-store";
import { useProgressStore } from "@/stores/progress-store";

const GOALS: { value: LearningGoal; label: string; route: string }[] = [
  { value: "interview", label: "Interview prep", route: "Modules 1 to 6, then the case studies and the interview playbook." },
  { value: "work", label: "Building systems at work", route: "The core modules, then the advanced tracks closest to what you build." },
  { value: "study", label: "A course or exam", route: "Everything in order, with the knowledge check after each module." },
  { value: "curious", label: "Just curious", route: "Wander. Start with The big idea and follow whatever looks fun." },
];

const inputClass =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-base font-normal text-ink outline-none placeholder:text-ink-3 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-2">
      {label}
      {children}
      {hint ? <span className="font-normal text-ink-3">{hint}</span> : null}
    </label>
  );
}

/**
 * The learner's profile: a name, what Cache calls them, why they are here and an optional target date (with a
 * suggested daily pace). Nothing sensitive. Saved with the settings, so a signed-in account syncs it.
 * `onDone` (in the account dialog) adds a Back button and runs after saving.
 */
export function ProfileForm({ onDone }: { onDone?: () => void }) {
  const hydrated = useHydrated();
  // The form starts from this browser's saved profile (and today's date), so it renders once that has loaded.
  if (!hydrated) return <div aria-busy="true" className="min-h-[26rem]" />;
  return <ProfileFields onDone={onDone} />;
}

function ProfileFields({ onDone }: { onDone?: () => void }) {
  const saved = usePreferencesStore((s) => s.profile);
  const setProfile = usePreferencesStore((s) => s.setProfile);
  const completed = useProgressStore((s) => s.completed);
  const [draft, setDraft] = useState<Profile>(saved);
  const [note, setNote] = useState<string | null>(null);
  const goalLabel = useId();
  const set = (patch: Partial<Profile>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };

  const left = lessons.filter((l) => !completed[l.slug]);
  const now = new Date();
  const pace = suggestedPace(draft.targetDate, now, { lessons: left.length, minutes: left.reduce((s, l) => s + l.minutes, 0) });
  const route = GOALS.find((g) => g.value === draft.goal)?.route;
  const dirty = JSON.stringify(cleanProfile(draft)) !== JSON.stringify(saved);

  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      data-testid="profile-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setProfile(draft);
        setDraft(cleanProfile(draft));
        setNote("Saved.");
        onDone?.();
      }}
    >
      <Field label="Your name" hint="Optional. Shown on your account.">
        <input
          type="text"
          autoComplete="name"
          maxLength={PROFILE_LIMITS.name}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          className={inputClass}
          data-testid="profile-name"
        />
      </Field>
      <Field label="What should Cache call you?" hint={<>Cache uses it now and then. Leave it empty and you stay &ldquo;{DEFAULT_CALL_ME}&rdquo;.</>}>
        <input
          type="text"
          autoComplete="nickname"
          maxLength={PROFILE_LIMITS.callMe}
          placeholder={DEFAULT_CALL_ME}
          value={draft.callMe}
          onChange={(e) => set({ callMe: e.target.value })}
          className={inputClass}
          data-testid="profile-call-me"
        />
      </Field>
      <fieldset className="flex flex-col gap-1.5" aria-labelledby={goalLabel}>
        <span id={goalLabel} className="text-sm font-bold text-ink-2">
          What brings you here?
        </span>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <label
              key={g.value}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
                draft.goal === g.value ? "border-accent bg-accent-soft text-ink" : "border-line-strong text-ink-2 hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="profile-goal"
                value={g.value}
                checked={draft.goal === g.value}
                onChange={() => set({ goal: g.value })}
                onClick={() => draft.goal === g.value && set({ goal: null })}
                className="sr-only"
              />
              {g.label}
            </label>
          ))}
        </div>
        {route ? <p className="text-sm text-ink-3">Suggested route: {route}</p> : null}
      </fieldset>
      <Field label="Interview or exam date" hint="Optional. Cache counts down to it and suggests a daily pace.">
        <span className="flex gap-2">
          <input
            type="date"
            min={todayIso(now)}
            value={draft.targetDate ?? ""}
            onChange={(e) => set({ targetDate: e.target.value || null })}
            className={inputClass}
            data-testid="profile-date"
          />
          {draft.targetDate ? (
            <Button variant="ghost" onClick={() => set({ targetDate: null })}>
              Clear
            </Button>
          ) : null}
        </span>
      </Field>
      {pace ? (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2" data-testid="profile-pace">
          {pace.days} day{pace.days === 1 ? "" : "s"} to go, {left.length} lesson{left.length === 1 ? "" : "s"} left: about{" "}
          <strong className="text-ink">
            {pace.lessonsPerDay} lesson{pace.lessonsPerDay === 1 ? "" : "s"} ({formatHours(pace.minutesPerDay)}) a day
          </strong>
          .{draft.goal === "interview" ? " Short on time? Modules 1 to 6 and the case studies matter most." : ""}
        </p>
      ) : null}
      <p role="status" className={cn("text-sm text-good", !note && "sr-only")}>
        {note}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!dirty} data-testid="profile-save">
          Save profile
        </Button>
        {onDone ? (
          <Button variant="secondary" onClick={onDone}>
            Back
          </Button>
        ) : null}
      </div>
    </form>
  );
}
