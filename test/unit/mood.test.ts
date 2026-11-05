import { describe, it, expect } from 'vitest';
import { moodFor } from '../../src/brain/mood';

describe('moodFor', () => {
  it('maps event types to mood and fx', () => {
    expect(moodFor('frenzy', 12, false)).toEqual({ mood: 'RECKLESS', fx: 'fire' });
    expect(moodFor('massDelete', 12, false)).toEqual({ mood: 'APPALLED', fx: 'sweat' });
    expect(moodFor('runFail', 12, false)).toEqual({ mood: 'DEAD', fx: 'smoke' });
    expect(moodFor('runPass', 12, false)).toEqual({ mood: 'SMUG', fx: 'confetti' });
    expect(moodFor('idleReturn', 12, false)).toEqual({ mood: 'SLEEPY', fx: 'zzz' });
    expect(moodFor('badFileName', 12, false)).toEqual({ mood: 'UNIMPRESSED', fx: 'question' });
  });
  it('defaults to UNIMPRESSED with no fx', () => {
    expect(moodFor('paste', 12, false)).toEqual({ mood: 'UNIMPRESSED', fx: '' });
    expect(moodFor('commitLazy', 12, false)).toEqual({ mood: 'UNIMPRESSED', fx: '' });
  });
  it('hushed wins over everything', () => {
    expect(moodFor('runPass', 12, true)).toEqual({ mood: 'SULKING', fx: '' });
    expect(moodFor('paste', 2, true)).toEqual({ mood: 'SULKING', fx: '' });
  });
  it('turns UNIMPRESSED into NIGHTCAP/zzz at hours 0-4 only', () => {
    expect(moodFor('paste', 0, false)).toEqual({ mood: 'NIGHTCAP', fx: 'zzz' });
    expect(moodFor('paste', 4, false)).toEqual({ mood: 'NIGHTCAP', fx: 'zzz' });
    expect(moodFor('paste', 5, false)).toEqual({ mood: 'UNIMPRESSED', fx: '' });
    expect(moodFor('badFileName', 3, false)).toEqual({ mood: 'NIGHTCAP', fx: 'zzz' });
  });
  it('does not override non-UNIMPRESSED moods at night', () => {
    expect(moodFor('runFail', 2, false)).toEqual({ mood: 'DEAD', fx: 'smoke' });
  });
});
