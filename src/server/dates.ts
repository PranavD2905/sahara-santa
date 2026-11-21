/** Dates are "YYYY-MM-DD" strings compared in UTC. */

export const ARCHIVE_AFTER_DAYS = 30;

export function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

/** Archived = read-only, 30 days after the Exchange Date. */
export function isArchived(exchangeDate: string | null, now: Date): boolean {
  if (!exchangeDate) return false;
  return todayUtc(now) > addDays(exchangeDate, ARCHIVE_AFTER_DAYS);
}

/** Re-draw is allowed up to and including the Exchange Date. */
export function isBeforeOrOnExchange(exchangeDate: string, now: Date): boolean {
  return todayUtc(now) <= exchangeDate;
}
