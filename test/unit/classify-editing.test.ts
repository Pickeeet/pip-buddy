import { describe, it, expect } from 'vitest';
import {
  classifyChanges, countDebugPrints, countDebugPrintsInChanges, nightKey, RateWindow, IdleTracker, lateNightOnce,
} from '../../src/detectors/classify/editing';
import { localDate } from '../../src/brain/time';

const big = 'x'.repeat(250);
const ctx = (clipboard: string, isUndo = false) => ({ clipboard, pasteThreshold: 200, isUndo });

describe('classifyChanges', () => {
  it('250-char change equal to clipboard is a paste', () => {
    expect(classifyChanges([{ text: big, rangeLength: 0 }], ctx(big))).toEqual(['paste']);
  });
  it('250-char change not equal to clipboard is nothing', () => {
    expect(classifyChanges([{ text: big, rangeLength: 0 }], ctx('other'))).toEqual([]);
  });
  it('large deletion is a massDelete', () => {
    expect(classifyChanges([{ text: '', rangeLength: 214 }], ctx(''))).toEqual(['massDelete']);
  });
  it('deletion below 15 chars is nothing', () => {
    expect(classifyChanges([{ text: '', rangeLength: 14 }], ctx(''))).toEqual([]);
  });
  it('more than 50 changes is ignored', () => {
    const many = Array.from({ length: 51 }, () => ({ text: big, rangeLength: 300 }));
    expect(classifyChanges(many, ctx(big))).toEqual([]);
  });
  it('multi-cursor paste yields one paste', () => {
    const three = Array.from({ length: 3 }, () => ({ text: big, rangeLength: 0 }));
    expect(classifyChanges(three, ctx(big))).toEqual(['paste']);
  });
  it('paste plus mass delete in one event gives each once', () => {
    const r = classifyChanges(
      [{ text: big, rangeLength: 0 }, { text: '', rangeLength: 20 }, { text: '', rangeLength: 40 }], ctx(big));
    expect(r.sort()).toEqual(['massDelete', 'paste']);
  });
  it('undo events never classify as paste or massDelete', () => {
    expect(classifyChanges([{ text: big, rangeLength: 0 }], ctx(big, true))).toEqual([]);
    expect(classifyChanges([{ text: '', rangeLength: 214 }], ctx('', true))).toEqual([]);
  });
});

describe('countDebugPrints', () => {
  it('counts each marker', () => {
    expect(countDebugPrints('console.log(a); console.log(b)')).toBe(2);
    expect(countDebugPrints('print(x)\ndebugger;\nprintln!("a")\nfmt.Println(1)')).toBe(4);
    expect(countDebugPrints('const a = 1;')).toBe(0);
  });
});

describe('RateWindow', () => {
  it('fires on the 14th hit within 2000 ms', () => {
    const w = new RateWindow(14, 2000);
    let fired = false;
    for (let i = 0; i < 13; i++) expect(w.hit(i * 100)).toBe(false);
    fired = w.hit(1999);
    expect(fired).toBe(true);
  });
  it('does not fire when the 14th hit is at 2001 ms', () => {
    const w = new RateWindow(14, 2000);
    for (let i = 0; i < 13; i++) w.hit(i * 100);
    expect(w.hit(2001)).toBe(false);
  });
  it('resets after firing', () => {
    const w = new RateWindow(3, 1000);
    w.hit(0); w.hit(1); expect(w.hit(2)).toBe(true);
    expect(w.hit(3)).toBe(false);
  });
});

describe('IdleTracker', () => {
  it('is false on the first touch, true after a 15 s gap', () => {
    const t = new IdleTracker(15000);
    expect(t.touch(0)).toBe(false);
    expect(t.touch(5000)).toBe(false);
    expect(t.touch(20000)).toBe(true);
    expect(t.touch(20100)).toBe(false);
  });
});

describe('lateNightOnce', () => {
  const at = new Date(2026, 10, 5, 23, 47).getTime();
  const today = localDate(at);
  const yesterday = localDate(new Date(2026, 10, 4, 12).getTime());
  it('fires at 23:47 when last fired yesterday or never', () => {
    expect(lateNightOnce(at, yesterday, 23)).toBe(true);
    expect(lateNightOnce(at, null, 23)).toBe(true);
  });
  it('does not fire when already fired today', () => {
    expect(lateNightOnce(at, today, 23)).toBe(false);
  });
  it('does not fire in daytime', () => {
    expect(lateNightOnce(new Date(2026, 10, 5, 14).getTime(), null, 23)).toBe(false);
  });
  it.each([0, 3])('a lateNightHour of %i does not fire at 14:00', (hour) => {
    expect(lateNightOnce(new Date(2026, 10, 5, 14).getTime(), null, hour)).toBe(false);
  });
  it('a lateNightHour of 3 fires at 03:30 but not at 02:30', () => {
    expect(lateNightOnce(new Date(2026, 10, 5, 3, 30).getTime(), null, 3)).toBe(true);
    expect(lateNightOnce(new Date(2026, 10, 5, 2, 30).getTime(), null, 3)).toBe(false);
  });
  it('a lateNightHour of 0 fires at 00:30', () => {
    expect(lateNightOnce(new Date(2026, 10, 5, 0, 30).getTime(), null, 0)).toBe(true);
  });
  it('the default 23 still fires at 02:00 and 23:00', () => {
    expect(lateNightOnce(new Date(2026, 10, 5, 2).getTime(), null, 23)).toBe(true);
    expect(lateNightOnce(new Date(2026, 10, 5, 23).getTime(), null, 23)).toBe(true);
  });
  it('does not fire again after midnight in the same night', () => {
    const after = new Date(2026, 10, 6, 0, 10).getTime();
    expect(nightKey(after)).toBe(nightKey(at));
    expect(lateNightOnce(after, nightKey(at), 23)).toBe(false);
  });
  it('fires after midnight when last fired on the previous night', () => {
    const after = new Date(2026, 10, 6, 1, 10).getTime();
    expect(lateNightOnce(after, nightKey(new Date(2026, 10, 4, 23, 30).getTime()), 23)).toBe(true);
  });
  it('23:47 then 00:10 same night fires only the first', () => {
    let last: string | null = null;
    const fired: boolean[] = [];
    for (const t of [at, new Date(2026, 10, 6, 0, 10).getTime()]) {
      const f = lateNightOnce(t, last, 23);
      fired.push(f);
      if (f) last = nightKey(t);
    }
    expect(fired).toEqual([true, false]);
  });
});

describe('countDebugPrintsInChanges', () => {
  it('counts small insertions', () => {
    expect(countDebugPrintsInChanges([{ text: 'console.log(x)', rangeLength: 0 }])).toBe(1);
  });
  it('ignores a 5000-char insertion containing console.log(', () => {
    const text = 'console.log(a); ' + 'y'.repeat(5000);
    expect(countDebugPrintsInChanges([{ text, rangeLength: 0 }])).toBe(0);
  });
});
