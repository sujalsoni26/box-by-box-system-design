/** Join class names, skipping falsy values. Tiny stand-in for clsx. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** A study time for people: "45 min", "about 1 h", "about 2.5 h" (rounded to the half hour above an hour). */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.round(minutes / 30) / 2;
  return `about ${h % 1 ? h.toFixed(1) : h} h`;
}
