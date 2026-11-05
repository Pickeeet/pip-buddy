import { describe, it, expect } from 'vitest';
import { writeDiary, rollover } from '../../src/brain/diary';
import { initialState } from '../../src/brain/initialState';
import { emptyDay } from '../../src/brain/memory';
import { localDate } from '../../src/brain/time';
import type { PipState, DayStats } from '../../src/types';

const rng = () => 0;
const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

function withDay(state: PipState, date: string, patch: Partial<DayStats>): PipState {
  state.days[date] = { ...emptyDay(), ...patch };
  return state;
}

describe('writeDiary', () => {
  it('mentions deletion for a massDelete day and uses the real number', () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { massDelete: 5 } });
    const e = writeDiary(s, '2026-03-01', rng)!;
    expect(e.text).toContain('deleted');
    expect(e.text).toContain('5');
    expect(e.text.startsWith('Day 1. ')).toBe(true);
    expect(s.diary).toHaveLength(1);
  });

  it('returns null a second time for the same date', () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { paste: 2 } });
    expect(writeDiary(s, '2026-03-01', rng)).not.toBeNull();
    expect(writeDiary(s, '2026-03-01', rng)).toBeNull();
    expect(s.diary).toHaveLength(1);
  });

  it('returns null when there are no stats for the date', () => {
    expect(writeDiary(initialState(0), '2026-03-01', rng)).toBeNull();
  });

  it('mentions hush when hushes >= 3, not when fewer', () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { runFail: 2 }, hushes: 3 });
    expect(writeDiary(s, '2026-03-01', rng)!.text).toContain('Was told to hush 3 times. Noted. Permanently.');
    const t = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { runFail: 2 }, hushes: 2 });
    expect(writeDiary(t, '2026-03-01', rng)!.text).not.toContain('hush');
  });

  it('adds the crack line', () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { paste: 1 }, crack: true });
    expect(writeDiary(s, '2026-03-01', rng)!.text).toContain("Something happened today. We don't talk about it.");
  });

  it('dayNumber is 41 when firstSeen is 40 days earlier', () => {
    const first = at(2026, 1, 1);
    const date = localDate(first + 40 * DAY);
    const s = withDay(initialState(first), date, { counts: { lateNight: 1 } });
    const e = writeDiary(s, date, rng)!;
    expect(e.dayNumber).toBe(41);
    expect(e.text.startsWith('Day 41. ')).toBe(true);
  });

  it('is deterministic for a given rng and varies with it', () => {
    const mk = () => withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { paste: 3, runFail: 2 } });
    expect(writeDiary(mk(), '2026-03-01', () => 0.3)!.text).toBe(writeDiary(mk(), '2026-03-01', () => 0.3)!.text);
    expect(writeDiary(mk(), '2026-03-01', () => 0)!.text).not.toBe(writeDiary(mk(), '2026-03-01', () => 0.99)!.text);
  });

  it('writes something for every listed count type, never code', () => {
    for (const t of ['massDelete', 'paste', 'runFail', 'lateNight', 'badFileName', 'commitLazy', 'debugPrint'] as const) {
      for (const r of [0, 0.99]) {
        const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { [t]: 4 } });
        const text = writeDiary(s, '2026-03-01', () => r)!.text;
        expect(text).toContain('4');
        expect(text).not.toMatch(/[{}]/);
      }
    }
  });

  it('keeps diary capped at 60, newest last', () => {
    const s = initialState(at(2026, 1, 1));
    for (let i = 0; i < 65; i++) {
      const d = localDate(at(2026, 1, 1) + i * DAY);
      withDay(s, d, { counts: { paste: 1 } });
      writeDiary(s, d, rng);
    }
    expect(s.diary).toHaveLength(60);
    expect(s.diary[59].date).toBe(localDate(at(2026, 1, 1) + 64 * DAY));
  });
});

describe('rollover', () => {
  it('writes exactly one entry for yesterday at 00:05, then none on repeat', () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-01', { counts: { massDelete: 5 } });
    const now = at(2026, 3, 2, 0, 5);
    expect(rollover(s, now, rng)).toHaveLength(1);
    expect(rollover(s, now, rng)).toHaveLength(0);
    expect(s.diary).toHaveLength(1);
  });

  it("does not write today's entry", () => {
    const s = withDay(initialState(at(2026, 3, 1)), '2026-03-02', { counts: { paste: 1 } });
    expect(rollover(s, at(2026, 3, 2, 0, 5), rng)).toHaveLength(0);
  });

  it('backfills several missed dates in order, skipping ones already written', () => {
    const s = initialState(at(2026, 3, 1));
    withDay(s, '2026-03-01', { counts: { paste: 1 } });
    withDay(s, '2026-03-02', { counts: { runFail: 1 } });
    withDay(s, '2026-03-03', { counts: { lateNight: 1 } });
    writeDiary(s, '2026-03-02', rng);
    const out = rollover(s, at(2026, 3, 4, 9), rng);
    expect(out.map(e => e.date)).toEqual(['2026-03-01', '2026-03-03']);
    expect(s.diary.map(e => e.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('skips dates older than the oldest diary entry it can keep, and returns only entries that remain', () => {
    const s = initialState(at(2026, 1, 1));
    for (let i = 0; i < 60; i++) {
      const d = localDate(at(2026, 2, 1) + i * DAY);
      withDay(s, d, { counts: { paste: 1 } });
      writeDiary(s, d, rng);
    }
    withDay(s, '2026-01-15', { counts: { paste: 3 } }); // older than anything the full diary keeps
    const before = JSON.stringify(s.diary);
    const now = at(2026, 5, 1);
    expect(rollover(s, now, rng)).toEqual([]);
    expect(rollover(s, now, rng)).toEqual([]);
    expect(JSON.stringify(s.diary)).toBe(before);
  });
});
