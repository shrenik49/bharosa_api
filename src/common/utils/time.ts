const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's calendar date in India (Asia/Kolkata) as YYYY-MM-DD, regardless of server timezone. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar-day difference `a - b` for two YYYY-MM-DD strings. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}
