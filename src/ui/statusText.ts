import type { Mood } from '../types';

/** Pure status-bar formatting (no `vscode` import, so it is unit-testable). */
export const GLYPH: Record<Mood, string> = {
  UNIMPRESSED: '¬_¬', RECKLESS: '>:)', APPALLED: 'O_O', SLEEPY: '-_-', SMUG: '^_^',
  DEAD: 'x_x', SULKING: '...', NIGHTCAP: 'z_z', CRACKED: ':)',
};
/** Total length of the status-bar text, glyph and space included. */
export const STATUS_MAX = 40;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function statusText(mood: Mood, line: string | null): string {
  const glyph = GLYPH[mood] ?? GLYPH.UNIMPRESSED;
  return line ? `${glyph} ${truncate(line, STATUS_MAX - glyph.length - 1)}` : glyph;
}
