const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar date 'YYYY-MM-DD'. The only day-key function in the codebase. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local hour of day, 0-23. */
export function localHour(ms: number): number {
  return new Date(ms).getHours();
}
