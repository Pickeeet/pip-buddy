import { describe, it, expect } from 'vitest';
import { emptyDay, record, weekCount, callbackFor } from '../../src/brain/memory';
import { localDate } from '../../src/brain/time';
import type { LinePack, PipEvent, PipEventType, PipState } from '../../src/types';

const DAY = 86_400_000;
const NOON = new Date(2026, 5, 10, 12, 0, 0).getTime();
const mkState = (): PipState => ({
  schema: 1, faith: 5, mode: 'dry', hushed: false, firstSeen: NOON, days: {},
  achievements: {}, diary: [], lastCrackAt: 0, recent: [],
});
const ev = (type: PipEventType, at: number, data: PipEvent['data'] = {}): PipEvent => ({ type, at, data });
const lines: LinePack = { callback: { dry: ['{what}: {count} this week.'], savage: ['{what}: {count}, savage.'] } };

describe('record', () => {
  it('counts, bad names and commit messages', () => {
    const s = mkState();
    record(s, ev('badFileName', NOON, { file: 'final_v2.ts' }));
    const d = record(s, ev('commitLazy', NOON, { msg: 'wip' }));
    expect(d.counts.badFileName).toBe(1);
    expect(d.badNames).toEqual(['final_v2.ts']);
    expect(d.commitMsgs).toEqual(['wip']);
    expect(s.days[localDate(NOON)]).toBe(d);
  });
  it('counts hushes', () => {
    const s = mkState();
    record(s, ev('hush', NOON));
    expect(record(s, ev('hush', NOON)).hushes).toBe(2);
  });
  it('tracks fail streaks and resets on pass', () => {
    const s = mkState();
    record(s, ev('runFail', NOON));
    record(s, ev('runFail', NOON + 1000));
    let d = record(s, ev('runFail', NOON + 2000));
    expect(d.failStreak).toBe(3);
    expect(d.failStreakStart).toBe(NOON);
    d = record(s, ev('runPass', NOON + 3000));
    expect(d.maxFailStreak).toBe(3);
    expect(d.failStreak).toBe(0);
    d = record(s, ev('runFail', NOON + 4000));
    expect(d.failStreakStart).toBe(NOON + 4000);
  });
  it('prunes days older than 28', () => {
    const s = mkState();
    s.days[localDate(NOON - 40 * DAY)] = emptyDay();
    s.days[localDate(NOON - 27 * DAY)] = emptyDay();
    record(s, ev('paste', NOON));
    expect(Object.keys(s.days).sort()).toEqual([localDate(NOON - 27 * DAY), localDate(NOON)].sort());
  });
});

describe('weekCount', () => {
  it('sums the last 7 local days only', () => {
    const s = mkState();
    record(s, ev('paste', NOON - 6 * DAY));
    record(s, ev('paste', NOON - 7 * DAY));
    record(s, ev('paste', NOON));
    expect(weekCount(s, 'paste', NOON)).toBe(2);
  });
});

describe('callbackFor', () => {
  const rng = () => 0;
  it('fires on the 4th event with {count}, once per day', () => {
    const s = mkState();
    for (let i = 3; i >= 1; i--) record(s, ev('badFileName', NOON - i * DAY, { file: 'x' }));
    const e = ev('badFileName', NOON, { file: 'x' });
    record(s, e);
    expect(callbackFor(s, e, NOON, lines, 'dry', rng)).toBe('Cursed file names: 4 this week.');
    expect(callbackFor(s, e, NOON, lines, 'dry', rng)).toBeNull();
  });
  it('does not fire below 3 in the week', () => {
    const s = mkState();
    for (let i = 1; i >= 0; i--) {
      const e = ev('badFileName', NOON - i * DAY, { file: 'x' });
      record(s, e);
      expect(callbackFor(s, e, e.at, lines, 'dry', rng)).toBeNull();
    }
  });
  it('uses the mode pool and capitalises', () => {
    const s = mkState();
    let text: string | null = null;
    for (let i = 0; i < 3; i++) {
      const e = ev('debugPrint', NOON);
      record(s, e);
      text = callbackFor(s, e, NOON, lines, 'savage', rng) ?? text;
    }
    expect(text).toBe('Console.logs: 3, savage.');
  });
  it('returns null for unlabelled types', () => {
    const s = mkState();
    for (let i = 0; i < 5; i++) record(s, ev('wake', NOON));
    expect(callbackFor(s, ev('wake', NOON), NOON, lines, 'dry', rng)).toBeNull();
  });
});
