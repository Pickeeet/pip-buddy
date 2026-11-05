import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, unlockNew } from '../../src/brain/achievements';
import { record } from '../../src/brain/memory';
import type { PipEvent, PipEventType, PipState } from '../../src/types';

const DAY = 86_400_000;
const FRI_EVE = new Date(2026, 5, 12, 18, 0, 0).getTime(); // Friday
const mkState = (): PipState => ({
  schema: 1, faith: 5, mode: 'dry', hushed: false, firstSeen: FRI_EVE, days: {},
  achievements: {}, diary: [], lastCrackAt: 0, recent: [],
});
const ev = (type: PipEventType, at: number): PipEvent => ({ type, at, data: {} });
const play = (s: PipState, e: PipEvent) => { record(s, e); return unlockNew(s, e).map((a) => a.id); };

describe('achievements', () => {
  it('has the exact ids and titles', () => {
    expect(ACHIEVEMENTS.map((a) => [a.id, a.title])).toEqual([
      ['friday-deployer', 'Friday Deployer'], ['archaeologist', 'Archaeologist'],
      ['commitment-issues', 'Commitment Issues'], ['night-owl', 'Nocturnal'],
      ['copy-pasta', 'Copy Pasta'], ['phoenix', 'Phoenix'],
    ]);
  });
  it('friday-deployer: Friday commit at 17+, not earlier or other days', () => {
    expect(play(mkState(), ev('commitGood', FRI_EVE))).toEqual(['friday-deployer']);
    expect(play(mkState(), ev('commitGood', FRI_EVE - 4 * 3_600_000))).toEqual([]);
    expect(play(mkState(), ev('commitGood', FRI_EVE + DAY))).toEqual([]);
  });
  it('archaeologist', () => {
    expect(play(mkState(), ev('ancientFile', FRI_EVE))).toEqual(['archaeologist']);
  });
  it('commitment-issues at 5 lazy commits in a week, once only', () => {
    const s = mkState();
    for (let i = 0; i < 4; i++) expect(play(s, ev('commitLazy', FRI_EVE - i * DAY - 6 * 3_600_000))).toEqual([]);
    expect(play(s, ev('commitLazy', FRI_EVE - 6 * 3_600_000))).toEqual(['commitment-issues']);
    expect(play(s, ev('commitLazy', FRI_EVE - 6 * 3_600_000))).toEqual([]);
  });
  it('night-owl needs 3 distinct late-night days', () => {
    const s = mkState();
    expect(play(s, ev('lateNight', FRI_EVE - 2 * DAY))).toEqual([]);
    expect(play(s, ev('lateNight', FRI_EVE - 2 * DAY))).toEqual([]);
    expect(play(s, ev('lateNight', FRI_EVE - DAY))).toEqual([]);
    expect(play(s, ev('lateNight', FRI_EVE))).toEqual(['night-owl']);
  });
  it('copy-pasta at 10 pastes in a day', () => {
    const s = mkState();
    for (let i = 0; i < 9; i++) expect(play(s, ev('paste', FRI_EVE))).toEqual([]);
    expect(play(s, ev('paste', FRI_EVE))).toEqual(['copy-pasta']);
  });
  it('phoenix: pass after a streak of 5', () => {
    const s = mkState();
    for (let i = 0; i < 5; i++) play(s, ev('runFail', FRI_EVE + i));
    expect(play(s, ev('runPass', FRI_EVE + 10))).toEqual(['phoenix']);
    expect(play(mkState(), ev('runPass', FRI_EVE))).toEqual([]);
  });
});
