const BAD_NAME = /(final|_v\d+|REAL|copy|temp\d*|new\d*|old)\b/i;
const DAY_MS = 864e5;
export const ANCIENT_DAYS = 365;

function stem(basename: string): string {
  const i = basename.lastIndexOf('.');
  return i > 0 ? basename.slice(0, i) : basename;
}

/** utils_final_v3_REAL.ts and friends. Looks at the stem only. */
export function isBadFileName(basename: string): boolean {
  return BAD_NAME.test(stem(basename));
}

/** *.test.*, *.spec.*, *_test.*, test_*.py */
export function isTestFile(basename: string): boolean {
  return /\.(test|spec)\.[^.]+$/i.test(basename)
    || /_test\.[^.]+$/i.test(basename)
    || /^test_.+\.py$/i.test(basename);
}

/** mtime at least 365 days before now. */
export function isAncient(mtimeMs: number, now: number): boolean {
  return now - mtimeMs >= ANCIENT_DAYS * DAY_MS;
}

/** In-memory "once per key per day" gate. Forgets older days. */
export class OncePerDay {
  private day = '';
  private seen = new Set<string>();

  first(key: string, day: string): boolean {
    if (day !== this.day) { this.day = day; this.seen.clear(); }
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}
