/** "2026-12-24" → "Thu, 24 Dec 2026" (dates are stored as UTC days). */
export function formatDay(day: string | null | undefined): string | null {
  if (!day) return null;
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days from today (UTC) until `day`; negative once it has passed. */
export function daysUntil(day: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((new Date(`${day}T00:00:00Z`).getTime() - today) / 86_400_000);
}

export function countdown(day: string | null | undefined): string | null {
  if (!day) return null;
  const n = daysUntil(day);
  if (n > 1) return `in ${n} days`;
  if (n === 1) return "tomorrow";
  if (n === 0) return "today";
  return null;
}
