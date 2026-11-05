import type { Fx, Mood, PipEventType } from '../types';

const TABLE: Partial<Record<PipEventType, { mood: Mood; fx: Fx }>> = {
  frenzy: { mood: 'RECKLESS', fx: 'fire' },
  massDelete: { mood: 'APPALLED', fx: 'sweat' },
  runFail: { mood: 'DEAD', fx: 'smoke' },
  runPass: { mood: 'SMUG', fx: 'confetti' },
  idleReturn: { mood: 'SLEEPY', fx: 'zzz' },
  badFileName: { mood: 'UNIMPRESSED', fx: 'question' },
};

export function moodFor(e: PipEventType, hour: number, hushed: boolean): { mood: Mood; fx: Fx } {
  if (hushed) return { mood: 'SULKING', fx: '' };
  const base = TABLE[e] ?? { mood: 'UNIMPRESSED' as Mood, fx: '' as Fx };
  if (base.mood === 'UNIMPRESSED' && hour >= 0 && hour <= 4) return { mood: 'NIGHTCAP', fx: 'zzz' };
  return { ...base };
}
