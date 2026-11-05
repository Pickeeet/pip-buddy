import { describe, it, expect } from 'vitest';
import { FAITH_DELTA, applyFaith } from '../../src/brain/faith';
import type { PipEventType } from '../../src/types';

describe('FAITH_DELTA', () => {
  it('has -1 for the bad habits', () => {
    for (const t of ['runFail', 'massDelete', 'paste', 'debugPrint', 'commitLazy', 'badFileName'] as PipEventType[]) {
      expect(FAITH_DELTA[t]).toBe(-1);
    }
  });
  it('has +1 for the good habits', () => {
    for (const t of ['runPass', 'testWritten', 'commitGood'] as PipEventType[]) {
      expect(FAITH_DELTA[t]).toBe(1);
    }
  });
  it('has no delta for everything else', () => {
    for (const t of ['frenzy', 'undoSpam', 'lateNight', 'idleReturn', 'saveSpam', 'ancientFile', 'hush', 'wake'] as PipEventType[]) {
      expect(FAITH_DELTA[t] ?? 0).toBe(0);
    }
  });
});

describe('applyFaith', () => {
  it('applies deltas', () => {
    expect(applyFaith(5, 'runFail')).toBe(4);
    expect(applyFaith(5, 'runPass')).toBe(6);
    expect(applyFaith(5, 'frenzy')).toBe(5);
  });
  it('clamps to 0..10', () => {
    expect(applyFaith(0, 'runFail')).toBe(0);
    expect(applyFaith(10, 'runPass')).toBe(10);
  });
});
