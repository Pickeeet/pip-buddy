import { describe, it, expect } from 'vitest';
import { Speaker, fill } from '../../src/brain/speaker';
import { localDate, localHour } from '../../src/brain/time';
import type { LinePack } from '../../src/types';

const pack: LinePack = {
  runFail: { dry: ['d0', 'd1', 'd2'], savage: ['s0', 's1', 's2'] },
  runPass: { dry: ['only-d'], savage: ['only-s'] },
};

describe('fill', () => {
  it('replaces placeholders', () => {
    expect(fill('{count} gone', { count: 214 })).toBe('214 gone');
  });
  it('leaves unknown keys as-is and replaces repeats', () => {
    expect(fill('{a} {b} {a}', { a: 'x' })).toBe('x {b} x');
  });
});

describe('time helpers', () => {
  it('localDate formats local YYYY-MM-DD', () => {
    const ms = new Date(2026, 10, 5, 23, 59).getTime();
    expect(localDate(ms)).toBe('2026-11-05');
    expect(localDate(new Date(2026, 0, 2, 0, 0).getTime())).toBe('2026-01-02');
  });
  it('localHour returns the local hour', () => {
    expect(localHour(new Date(2026, 10, 5, 23, 59).getTime())).toBe(23);
    expect(localHour(new Date(2026, 10, 6, 0, 1).getTime())).toBe(0);
  });
});

describe('Speaker cooldown', () => {
  it('canSpeak is false 3499 ms after markSpoken and true at 3500', () => {
    const s = new Speaker(pack, () => 0, 3500);
    expect(s.canSpeak(0)).toBe(true);
    s.markSpoken(1000);
    expect(s.canSpeak(1000 + 3499)).toBe(false);
    expect(s.canSpeak(1000 + 3500)).toBe(true);
  });
});

describe('Speaker.pick', () => {
  it('returns a savage line in savage mode, with id event.mode.index', () => {
    const s = new Speaker(pack, () => 0, 3500);
    expect(s.pick('runFail', 'savage', {}, 0, [])).toEqual({ id: 'runFail.savage.0', text: 's0' });
    expect(s.pick('runFail', 'dry', {}, 0, [])).toEqual({ id: 'runFail.dry.0', text: 'd0' });
  });
  it('fills template data', () => {
    const s = new Speaker({ massDelete: { dry: ['{count} gone'], savage: ['{count} gone.'] } }, () => 0, 1);
    expect(s.pick('massDelete', 'dry', { count: 214 }, 0, [])?.text).toBe('214 gone');
  });
  it('never returns a recent id while another exists', () => {
    const recent = ['runFail.dry.0', 'runFail.dry.2'];
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const s = new Speaker(pack, () => r, 3500);
      expect(s.pick('runFail', 'dry', {}, 0, recent)?.id).toBe('runFail.dry.1');
    }
  });
  it('uses rng to choose uniformly among candidates', () => {
    const s = new Speaker(pack, () => 0.99, 3500);
    expect(s.pick('runFail', 'dry', {}, 0, ['runFail.dry.0'])?.id).toBe('runFail.dry.2');
  });
  it('repeats only when every line is recent', () => {
    const s = new Speaker(pack, () => 0, 3500);
    expect(s.pick('runPass', 'dry', {}, 0, ['runPass.dry.0'])?.id).toBe('runPass.dry.0');
  });
  it('returns null for an unknown event', () => {
    const s = new Speaker(pack, () => 0, 3500);
    expect(s.pick('paste', 'dry', {}, 0, [])).toBeNull();
  });
});
