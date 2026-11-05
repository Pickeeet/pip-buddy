import type { PipEventType } from '../types';

export const FAITH_DELTA: Partial<Record<PipEventType, number>> = {
  runFail: -1,
  massDelete: -1,
  paste: -1,
  debugPrint: -1,
  commitLazy: -1,
  badFileName: -1,
  runPass: 1,
  testWritten: 1,
  commitGood: 1,
};

/** Pure: new faith (integer, clamped 0-10) after an event of this type. */
export function applyFaith(faith: number, e: PipEventType): number {
  const next = Math.round(faith) + (FAITH_DELTA[e] ?? 0);
  return Math.max(0, Math.min(10, next));
}
