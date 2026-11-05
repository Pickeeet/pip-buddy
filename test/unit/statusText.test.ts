import { describe, expect, it } from 'vitest';
import { GLYPH, statusText, STATUS_MAX } from '../../src/ui/statusText';
import type { Mood } from '../../src/types';

const MOODS = Object.keys(GLYPH) as Mood[];

describe('statusText', () => {
  it('caps the whole text, glyph included, at 40 characters for a long line', () => {
    const long = 'x'.repeat(200);
    for (const m of MOODS) {
      const t = statusText(m, long);
      expect(t.length).toBeLessThanOrEqual(40);
      expect(t.length).toBe(STATUS_MAX);
      expect(t.startsWith(`${GLYPH[m]} `)).toBe(true);
      expect(t.endsWith('…')).toBe(true);
    }
  });

  it('keeps a short line whole', () => {
    expect(statusText('UNIMPRESSED', 'Ctrl+V again.')).toBe(`${GLYPH.UNIMPRESSED} Ctrl+V again.`);
  });

  it('keeps a line that exactly fills 40 characters whole', () => {
    const line = 'y'.repeat(40 - GLYPH.DEAD.length - 1);
    expect(statusText('DEAD', line)).toBe(`${GLYPH.DEAD} ${line}`);
  });

  it('shows only the glyph for an empty or missing line', () => {
    expect(statusText('SMUG', '')).toBe(GLYPH.SMUG);
    expect(statusText('SMUG', null)).toBe(GLYPH.SMUG);
  });
});
