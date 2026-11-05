import * as vscode from 'vscode';
import type { StateMessage } from './messages';
import { GLYPH, statusText } from './statusText';

export class PipStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

  constructor() {
    this.item.name = 'Pip';
    this.item.command = 'pip.corner.focus';
    this.item.text = GLYPH.UNIMPRESSED;
    this.item.show();
  }

  update(s: StateMessage): void {
    this.item.text = statusText(s.mood, s.line);
    this.item.tooltip = `${s.line ?? 'Pip is watching.'}\nFaith: ${s.faith}/10. Click to visit Pip's Corner.`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
