import * as vscode from 'vscode';
import type { Mood } from '../types';
import type { StateMessage } from './messages';

const GLYPH: Record<Mood, string> = {
  UNIMPRESSED: '¬_¬', RECKLESS: '>:)', APPALLED: 'O_O', SLEEPY: '-_-', SMUG: '^_^',
  DEAD: 'x_x', SULKING: '...', NIGHTCAP: 'z_z', CRACKED: ':)',
};
const MAX = 40;

export function truncate(s: string, max = MAX): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export class PipStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  constructor() {
    this.item.name = 'Pip';
    this.item.command = 'pip.corner.focus';
    this.item.text = GLYPH.UNIMPRESSED;
    this.item.show();
  }

  update(s: StateMessage): void {
    const glyph = GLYPH[s.mood] ?? GLYPH.UNIMPRESSED;
    this.item.text = s.line ? `${glyph} ${truncate(s.line)}` : glyph;
    this.item.tooltip = `${s.line ?? 'Pip is watching.'}\nFaith: ${s.faith}/10. Click to visit Pip's Corner.`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
