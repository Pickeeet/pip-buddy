const OFFER_HOUR = 16;
const FRIDAY = 5;

/** ISO-8601 week of a local date as `YYYY-Www` (week 1 holds the year's first Thursday). */
export function isoWeek(ms: number): string {
  const d = new Date(ms);
  const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = day.getUTCDay() || 7; // Mon=1 .. Sun=7
  day.setUTCDate(day.getUTCDate() + 4 - dow); // Thursday of this week decides the year
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Friday from 16:00 local, and not yet offered during this ISO week. */
export function shouldOfferCard(now: number, lastOfferWeek: string | undefined): boolean {
  const d = new Date(now);
  return d.getDay() === FRIDAY && d.getHours() >= OFFER_HOUR && lastOfferWeek !== isoWeek(now);
}
