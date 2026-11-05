import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { spriteGrid, moodSprite } = require('../../media/sprite.js') as {
  spriteGrid: (eyes: string, mouth: string, body: string) => string[][];
  moodSprite: (mood: string) => string[][];
};

const PAL: Record<string, string> = {
  '.': 'transparent', o: '#1B1530', b: '#6EE7A8', h: '#EFFFF5', c: '#FF8FB1', e: '#1B1530', m: '#1B1530',
};
const EYES_SIDE_0 = 'obbbbbbbbbbbbbbo';
const EYES_SIDE_1 = 'obbbbbeebbbbbeeo';
const map = (row: string): string[] => row.split('').map((ch) => PAL[ch]);

describe('spriteGrid', () => {
  it('is 12 rows by 16 columns with a transparent corner', () => {
    const g = spriteGrid('side', 'flat', '#6EE7A8');
    expect(g).toHaveLength(12);
    for (const row of g) expect(row).toHaveLength(16);
    expect(g[0][0]).toBe('transparent');
  });

  it('puts the mockup eye rows at rows 4 and 5', () => {
    const g = spriteGrid('side', 'flat', '#6EE7A8');
    expect(g[4]).toEqual(map(EYES_SIDE_0));
    expect(g[5]).toEqual(map(EYES_SIDE_1));
  });

  it('puts the mockup mouth rows at rows 7 and 8', () => {
    const g = spriteGrid('normal', 'smile', '#6EE7A8');
    expect(g[7]).toEqual(map('obbbbbmbbmbbbbbo'));
    expect(g[8]).toEqual(map('obbbbbbmmbbbbbbo'));
  });

  it('paints the body colour it is given', () => {
    const g = spriteGrid('side', 'smirk', '#FFB547');
    expect(g[4][1]).toBe('#FFB547');
    expect(g[6][2]).toBe('#FF8FB1'); // cheek
    expect(g[2][3]).toBe('#EFFFF5'); // highlight
  });
});

describe('moodSprite', () => {
  it('RECKLESS is side/smirk on the orange body', () => {
    expect(moodSprite('RECKLESS')).toEqual(spriteGrid('side', 'smirk', '#FFB547'));
  });

  it('maps every mood to the agreed eyes and mouth', () => {
    expect(moodSprite('UNIMPRESSED')).toEqual(spriteGrid('side', 'flat', '#6EE7A8'));
    expect(moodSprite('APPALLED')).toEqual(spriteGrid('shock', 'open', '#6EE7A8'));
    expect(moodSprite('SLEEPY')).toEqual(spriteGrid('sleep', 'flat', '#6EE7A8'));
    expect(moodSprite('SMUG')).toEqual(spriteGrid('happy', 'smirk', '#6EE7A8'));
    expect(moodSprite('DEAD')).toEqual(spriteGrid('dead', 'frown', '#6EE7A8'));
    expect(moodSprite('CRACKED')).toEqual(spriteGrid('normal', 'smile', '#6EE7A8'));
  });

  it('SULKING shows its back: no eyes or mouth, body colour across those rows', () => {
    const g = moodSprite('SULKING');
    for (const r of [4, 5, 7, 8]) {
      expect(g[r][0]).toBe('#1B1530');
      expect(g[r][15]).toBe('#1B1530');
      expect(g[r].slice(1, 15).every((c) => c === '#6EE7A8')).toBe(true);
    }
  });

  it('NIGHTCAP is sleep/flat with a 3-row cap over the top', () => {
    const plain = spriteGrid('sleep', 'flat', '#6EE7A8');
    const g = moodSprite('NIGHTCAP');
    expect(g).toHaveLength(12);
    expect(g.slice(3)).toEqual(plain.slice(3));
    expect(g.slice(0, 3)).not.toEqual(plain.slice(0, 3));
  });

  it('falls back to UNIMPRESSED for an unknown mood', () => {
    expect(moodSprite('NOPE')).toEqual(moodSprite('UNIMPRESSED'));
  });
});
