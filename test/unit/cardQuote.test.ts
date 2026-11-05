import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// media/card.js is a browser IIFE that attaches PipCard to globalThis.
new Function(readFileSync(join(__dirname, '..', '..', 'media', 'card.js'), 'utf8'))();
const { quoteLines } = (globalThis as unknown as {
  PipCard: { quoteLines(g: unknown, body: string, w: number, max: number): string[] };
}).PipCard;

// 1 char = 10px
const g = { measureText: (t: string) => ({ width: t.length * 10 }) };
const OPEN = '\u201c';
const CLOSE = '\u201d';
const ELL = '\u2026';

describe('diary quote lines', () => {
  it('keeps a short quote whole, with both quote marks', () => {
    expect(quoteLines(g, 'Not much happened.', 400, 3)).toEqual([OPEN + 'Not much happened.' + CLOSE]);
  });
  it('allows up to 3 lines without an ellipsis', () => {
    const out = quoteLines(g, 'aaaa bbbb cccc dddd eeee ffff', 100, 3);
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out.join(' ')).not.toContain(ELL);
    expect(out[out.length - 1].endsWith(CLOSE)).toBe(true);
  });
  it('truncates to 3 lines, ends the last with an ellipsis and always closes the quote', () => {
    const body = Array.from({ length: 40 }, (_, i) => 'word' + i).join(' ');
    const out = quoteLines(g, body, 150, 3);
    expect(out).toHaveLength(3);
    expect(out[2].endsWith(ELL + CLOSE)).toBe(true);
    expect(out[0].startsWith(OPEN)).toBe(true);
    for (const l of out) expect(l.length * 10).toBeLessThanOrEqual(150);
  });
});
