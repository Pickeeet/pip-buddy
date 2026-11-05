import { describe, it, expect } from 'vitest';
import { load, save, merge, type KV } from '../../src/store';
import { initialState } from '../../src/brain/initialState';
import { emptyDay } from '../../src/brain/memory';
import type { PipState } from '../../src/types';

const NOW = 1_800_000_000_000;
const KEY = 'pip.state';

function fakeKv(initial?: unknown): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  if (initial !== undefined) data.set(KEY, initial);
  return {
    data,
    get<T>(k: string) { return data.get(k) as T | undefined; },
    update(k: string, v: unknown) { data.set(k, v); return Promise.resolve(); },
  };
}

function st(patch: Partial<PipState> = {}): PipState {
  return { ...initialState(NOW), ...patch };
}

describe('load', () => {
  it('returns initialState for undefined', () => {
    expect(load(fakeKv(), NOW)).toEqual(initialState(NOW));
  });
  it('keeps a valid faith across an unknown schema', () => {
    expect(load(fakeKv({ schema: 99, faith: 7 }), NOW)).toEqual({ ...initialState(NOW), faith: 7 });
  });
  it('rounds faith and drops out-of-range faith', () => {
    expect(load(fakeKv({ schema: 99, faith: 6.6 }), NOW).faith).toBe(7);
    expect(load(fakeKv({ schema: 99, faith: 11 }), NOW).faith).toBe(5);
    expect(load(fakeKv({ schema: 99, faith: Number.NaN }), NOW).faith).toBe(5);
  });
  it.each(['garbage', 42, null, [], true])('does not throw on %j', (v) => {
    expect(load(fakeKv(v), NOW)).toEqual(initialState(NOW));
  });
  it('round-trips a valid schema-1 state', () => {
    const s = st({ faith: 3, mode: 'savage', hushed: true, lastCrackAt: 5, recent: ['a', 'b'],
      achievements: { x: 10 }, diary: [{ date: '2026-11-04', dayNumber: 2, text: 'hi' }] });
    s.days['2026-11-04'] = { ...emptyDay(), counts: { paste: 2 }, badNames: ['a.ts'] };
    expect(load(fakeKv(JSON.parse(JSON.stringify(s))), NOW)).toEqual(s);
  });
  it('fills missing fields from defaults', () => {
    const s = load(fakeKv({ schema: 1, faith: 2 }), NOW);
    expect(s).toEqual({ ...initialState(NOW), faith: 2 });
  });
  it('drops malformed diary entries inside an otherwise valid state', () => {
    const good = { date: '2026-11-03', dayNumber: 1, text: 'ok' };
    const s = load(fakeKv({ schema: 1, faith: 4, diary: [good, { dayNumber: 2, text: 'no date' },
      null, 'x', { date: 5, dayNumber: 1, text: 't' }, { date: '2026-11-04', dayNumber: 'a', text: 't' }] }), NOW);
    expect(s.faith).toBe(4);
    expect(s.diary).toEqual([good]);
  });
  it('drops a non-array diary and malformed days/achievements', () => {
    const s = load(fakeKv({ schema: 1, diary: 'nope',
      days: { '2026-11-04': 'bad', '2026-11-05': { counts: { paste: 'x', frenzy: 2 } } },
      achievements: { a: 'x', b: 7 }, recent: [1, 'ok'], mode: 'weird' }), NOW);
    expect(s.diary).toEqual([]);
    expect(Object.keys(s.days)).toEqual(['2026-11-05']);
    expect(s.days['2026-11-05'].counts).toEqual({ frenzy: 2 });
    expect(s.days['2026-11-05'].badNames).toEqual([]);
    expect(s.achievements).toEqual({ b: 7 });
    expect(s.recent).toEqual(['ok']);
    expect(s.mode).toBe('dry');
  });
});

describe('merge', () => {
  it('unions diary by date, preferring b text', () => {
    const e = (text: string) => ({ date: '2026-11-05', dayNumber: 3, text });
    const m = merge(st({ diary: [e('a')] }), st({ diary: [e('b')] }));
    expect(m.diary).toEqual([e('b')]);
  });
  it('sorts diary by date and caps at 60', () => {
    const mk = (mo: number, i: number) => ({ date: `2026-0${mo}-${String(i).padStart(2, '0')}`, dayNumber: i, text: String(i) });
    const a = st({ diary: Array.from({ length: 30 }, (_, i) => mk(1, i + 1)) });
    const b = st({ diary: [...Array.from({ length: 30 }, (_, i) => mk(2, i + 1)), mk(3, 1), mk(3, 2)] });
    const m = merge(a, b);
    expect(m.diary).toHaveLength(60);
    expect(m.diary[59].date).toBe('2026-03-02');
    expect(m.diary.map((d) => d.date)).toEqual([...m.diary.map((d) => d.date)].sort());
    expect(m.diary[0].date).toBe('2026-01-03');
  });
  it('takes min unlock time per achievement', () => {
    const m = merge(st({ achievements: { x: 50, y: 5 } }), st({ achievements: { x: 20, z: 9 } }));
    expect(m.achievements).toEqual({ x: 20, y: 5, z: 9 });
  });
  it('keeps a day that only exists in a', () => {
    const a = st(); a.days['2026-11-01'] = { ...emptyDay(), counts: { paste: 4 } };
    const b = st(); b.days['2026-11-05'] = { ...emptyDay(), counts: { paste: 1 } };
    const m = merge(a, b);
    expect(Object.keys(m.days).sort()).toEqual(['2026-11-01', '2026-11-05']);
    expect(m.days['2026-11-01'].counts.paste).toBe(4);
  });
  it('merges shared days per field', () => {
    const a = st(); const b = st();
    a.days['d'] = { ...emptyDay(), counts: { paste: 5, frenzy: 1 }, hushes: 3, maxFailStreak: 4, crack: true,
      badNames: ['a', 'b'], commitMsgs: ['m'], failStreak: 9, failStreakStart: 1 };
    b.days['d'] = { ...emptyDay(), counts: { paste: 2, runFail: 2 }, hushes: 1, maxFailStreak: 6, crack: false,
      badNames: ['c'], commitMsgs: ['x', 'y'], failStreak: 2, failStreakStart: 7 };
    const d = merge(a, b).days['d'];
    expect(d.counts).toEqual({ paste: 5, frenzy: 1, runFail: 2 });
    expect(d.hushes).toBe(3);
    expect(d.maxFailStreak).toBe(6);
    expect(d.crack).toBe(true);
    expect(d.badNames).toEqual(['a', 'b']);
    expect(d.commitMsgs).toEqual(['x', 'y']);
    expect(d.failStreak).toBe(2);
    expect(d.failStreakStart).toBe(7);
  });
  it('lets b win scalars and takes min firstSeen', () => {
    const m = merge(st({ faith: 1, mode: 'savage', hushed: true, lastCrackAt: 9, recent: ['a'], firstSeen: 100 }),
      st({ faith: 8, mode: 'dry', hushed: false, lastCrackAt: 3, recent: ['b'], firstSeen: 200 }));
    expect(m).toMatchObject({ faith: 8, mode: 'dry', hushed: false, lastCrackAt: 3, recent: ['b'], firstSeen: 100 });
  });
});

describe('save', () => {
  it('merges with the stored value and does not mutate or replace s', async () => {
    const stored = st({ achievements: { old: 1 }, diary: [{ date: '2026-11-04', dayNumber: 1, text: 'other window' }] });
    stored.days['2026-11-03'] = { ...emptyDay(), counts: { paste: 2 } };
    const kv = fakeKv(JSON.parse(JSON.stringify(stored)));
    const live = st({ faith: 9 });
    const day = { ...emptyDay(), counts: { paste: 1 } };
    live.days['2026-11-05'] = day;
    const snapshot = JSON.stringify(live);
    await save(kv, live);
    expect(JSON.stringify(live)).toBe(snapshot);
    expect(live.days['2026-11-05']).toBe(day);
    const written = kv.data.get(KEY) as PipState;
    expect(written.faith).toBe(9);
    expect(written.achievements).toEqual({ old: 1 });
    expect(written.diary).toHaveLength(1);
    expect(Object.keys(written.days).sort()).toEqual(['2026-11-03', '2026-11-05']);
  });
  it('writes s when nothing is stored, and survives a garbage stored value', async () => {
    const kv = fakeKv('garbage');
    await save(kv, st({ faith: 2 }));
    expect((kv.data.get(KEY) as PipState).faith).toBe(2);
  });
  it('two windows writing the same day yield one diary entry', async () => {
    const kv = fakeKv();
    const e = (text: string) => ({ date: '2026-11-05', dayNumber: 3, text });
    await save(kv, st({ diary: [e('w1')] }));
    await save(kv, st({ diary: [e('w2')] }));
    expect((kv.data.get(KEY) as PipState).diary).toEqual([e('w2')]);
  });
});
