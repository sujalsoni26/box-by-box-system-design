/*
 * A suggested study pace towards a date the learner picked (an interview, an exam). Pure, unit tested.
 */

/** Whole calendar days from `now` (local date) to a YYYY-MM-DD date: 0 today, negative once it has passed, null without a valid date. */
export function daysUntil(date: string | null, now: Date): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  if (Number.isNaN(target) || new Date(target).getUTCDate() !== d) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export interface Pace {
  days: number;
  lessonsPerDay: number;
  /** Rounded up to 5 minutes. */
  minutesPerDay: number;
}

/** What a day needs to finish what is left by the date; null without a future date or with nothing left. */
export function suggestedPace(date: string | null, now: Date, left: { lessons: number; minutes: number }): Pace | null {
  const days = daysUntil(date, now);
  if (days === null || days <= 0 || left.lessons <= 0) return null;
  return {
    days,
    lessonsPerDay: Math.ceil(left.lessons / days),
    minutesPerDay: Math.max(5, Math.ceil(left.minutes / days / 5) * 5),
  };
}

/** Today's date as YYYY-MM-DD in local time (for a date input's minimum). */
export function todayIso(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
