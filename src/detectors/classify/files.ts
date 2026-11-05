const BAD_ANYWHERE = /^(final|v\d+|real|copy|temp\d*|new\d+)$/i;
// Bare new/old are ordinary prefixes (newFile, oldConfig): cursed only as the last word (cartNew, cart-old).
const BAD_LAST = /^(new|old)$/i;
const DAY_MS = 864e5;
export const ANCIENT_DAYS = 365;

function stem(basename: string): string {
  const i = basename.lastIndexOf('.');
  return i > 0 ? basename.slice(0, i) : basename;
}

/**
 * utils_final_v3_REAL.ts and friends. Looks at the stem only; a cursed word must start a word
 * (stem start, after _ - . or space, or a camelCase boundary), so threshold/gold/renew are fine.
 */
export function isBadFileName(basename: string): boolean {
  const words = stem(basename).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\-. ]+/);
  return words.some((w, i) => BAD_ANYWHERE.test(w) || (i === words.length - 1 && BAD_LAST.test(w)));
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

const DEPENDENCY_DIRS = ['/node_modules/', '/.venv/', '/venv/', '/site-packages/', '/vendor/', '/.git/'];

/** True for files inside dependency/tooling folders (either slash style, any case). */
export function isDependencyPath(path: string): boolean {
  const p = path.replace(/\\/g, '/').toLowerCase();
  return DEPENDENCY_DIRS.some((d) => p.includes(d));
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
