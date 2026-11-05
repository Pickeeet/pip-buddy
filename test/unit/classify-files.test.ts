import { describe, it, expect } from 'vitest';
import { isBadFileName, isTestFile, isAncient, OncePerDay } from '../../src/detectors/classify/files';
import { RunTracker } from '../../src/detectors/classify/runs';

describe('isBadFileName', () => {
  it('flags cursed names', () => {
    expect(isBadFileName('utils_final_v3_REAL.ts')).toBe(true);
    expect(isBadFileName('app_copy.js')).toBe(true);
    expect(isBadFileName('temp2.py')).toBe(true);
    expect(isBadFileName('main_old.ts')).toBe(true);
  });
  it('leaves normal names alone', () => {
    expect(isBadFileName('cart.ts')).toBe(false);
    expect(isBadFileName('newsletter.ts')).toBe(false);
    expect(isBadFileName('')).toBe(false);
  });
  it('only looks at the stem, not the extension', () => {
    expect(isBadFileName('cart.copy')).toBe(false);
    expect(isBadFileName('.gitignore')).toBe(false);
  });
});

describe('isTestFile', () => {
  it('recognises test naming conventions', () => {
    expect(isTestFile('cart.test.ts')).toBe(true);
    expect(isTestFile('cart.spec.js')).toBe(true);
    expect(isTestFile('cart_test.go')).toBe(true);
    expect(isTestFile('test_cart.py')).toBe(true);
  });
  it('rejects non-tests', () => {
    expect(isTestFile('cart.ts')).toBe(false);
    expect(isTestFile('testimony.ts')).toBe(false);
    expect(isTestFile('test_cart.ts')).toBe(false);
  });
});

describe('isAncient', () => {
  const now = Date.UTC(2026, 10, 5);
  it('366 days old is ancient, 364 is not, exactly 365 is', () => {
    expect(isAncient(now - 366 * 864e5, now)).toBe(true);
    expect(isAncient(now - 365 * 864e5, now)).toBe(true);
    expect(isAncient(now - 364 * 864e5, now)).toBe(false);
  });
  it('a future mtime is not ancient', () => {
    expect(isAncient(now + 1000, now)).toBe(false);
  });
});

describe('OncePerDay', () => {
  it('allows a key once per day and again the next day', () => {
    const o = new OncePerDay();
    expect(o.first('a.ts', '2026-11-05')).toBe(true);
    expect(o.first('a.ts', '2026-11-05')).toBe(false);
    expect(o.first('b.ts', '2026-11-05')).toBe(true);
    expect(o.first('a.ts', '2026-11-06')).toBe(true);
    expect(o.first('b.ts', '2026-11-06')).toBe(true);
  });
});

describe('RunTracker', () => {
  it('counts a fail streak from 1 and resets on pass', () => {
    const r = new RunTracker(1000);
    expect(r.record(1, 0)).toEqual({ type: 'runFail', streak: 1 });
    expect(r.record(2, 5000)).toEqual({ type: 'runFail', streak: 2 });
    expect(r.record(0, 10000)).toEqual({ type: 'runPass' });
    expect(r.record(1, 20000)).toEqual({ type: 'runFail', streak: 1 });
  });
  it('ignores undefined exit codes', () => {
    expect(new RunTracker(1000).record(undefined, 0)).toBeNull();
  });
  it('dedupes the same exit code within the window (task end + shell end of one run)', () => {
    const r = new RunTracker(1000);
    expect(r.record(1, 0)).not.toBeNull();
    expect(r.record(1, 900)).toBeNull();
    expect(r.record(1, 1500)).toEqual({ type: 'runFail', streak: 2 });
  });
  it('different exit code within window is not a duplicate', () => {
    const r = new RunTracker(1000);
    expect(r.record(1, 0)).not.toBeNull();
    expect(r.record(0, 100)).toEqual({ type: 'runPass' });
  });
});
