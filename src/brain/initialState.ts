import type { PipState } from '../types';

export function initialState(now: number): PipState {
  return {
    schema: 1, faith: 5, mode: 'dry', hushed: false, firstSeen: now, days: {},
    achievements: {}, diary: [], lastCrackAt: 0, recent: [],
  };
}
