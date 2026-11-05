import * as vscode from 'vscode';
import type { EventBus } from '../bus';
import type { PipConfig } from '../config';
import type { PipEventType } from '../types';
import { localDate } from '../brain/time';
import {
  classifyChanges, countDebugPrintsInChanges, IdleTracker, lateNightOnce, MAX_CHANGES, nightKey, RateWindow,
} from './classify/editing';

const pad = (n: number): string => String(n).padStart(2, '0');

export function registerEditingDetectors(
  ctx: vscode.ExtensionContext, bus: EventBus, cfg: () => PipConfig,
): void {
  const frenzy = new RateWindow(14, 2000);
  const undos = new RateWindow(5, 3000);
  const idle = new IdleTracker(15000);
  let lateFired: string | null = null;
  let printDay = '';
  let printCount = 0;

  const on = (c: PipConfig, k: string): boolean => c.detectors[k] !== false;
  const emit = (type: PipEventType, at: number, data: Record<string, string | number> = {}): void =>
    bus.emit({ type, at, data });

  const sub = vscode.workspace.onDidChangeTextDocument((e) => {
    const changes = e.contentChanges;
    // Programmatic edits (format-on-save, git, other extensions, other documents) are not habits.
    if (changes.length === 0 || changes.length > MAX_CHANGES) return;
    const doc = e.document;
    if (doc !== vscode.window.activeTextEditor?.document) return;
    if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') return;

    const c = cfg();
    const at = Date.now();
    const isUndo = e.reason === vscode.TextDocumentChangeReason.Undo;
    const plain = changes.map((ch) => ({ text: ch.text, rangeLength: ch.rangeLength }));

    if (idle.touch(at) && on(c, 'idleReturn')) emit('idleReturn', at);

    if (on(c, 'lateNight') && lateNightOnce(at, lateFired, c.lateNightHour)) {
      lateFired = nightKey(at);
      const d = new Date(at);
      emit('lateNight', at, { time: `${pad(d.getHours())}:${pad(d.getMinutes())}` });
    }

    if (on(c, 'frenzy') && frenzy.hit(at)) emit('frenzy', at);
    if (isUndo && on(c, 'undoSpam') && undos.hit(at)) emit('undoSpam', at, { count: 5 });

    if (on(c, 'debugPrint') && !isUndo && e.reason !== vscode.TextDocumentChangeReason.Redo) {
      const added = countDebugPrintsInChanges(plain);
      if (added > 0) {
        const day = localDate(at);
        if (day !== printDay) { printDay = day; printCount = 0; }
        printCount += added;
        emit('debugPrint', at, { count: printCount });
      }
    }

    // Non-paste types classify synchronously (threshold Infinity rules paste out).
    if (on(c, 'massDelete')
      && classifyChanges(plain, { clipboard: '', pasteThreshold: Infinity, isUndo }).includes('massDelete')) {
      emit('massDelete', at, { count: Math.max(...plain.map((p) => p.rangeLength)) });
    }

    // Paste: clipboard is read only when some change is large enough, and never blocks the above.
    if (!isUndo && on(c, 'paste') && plain.some((p) => p.text.length >= c.pasteThreshold)) {
      void Promise.resolve(vscode.env.clipboard.readText()).then((clipboard) => {
        const types = classifyChanges(plain, { clipboard, pasteThreshold: c.pasteThreshold, isUndo });
        if (!types.includes('paste')) return;
        const count = plain.reduce(
          (n, p) => (p.text.length >= c.pasteThreshold && p.text === clipboard ? n + p.text.length : n), 0);
        emit('paste', at, { count });
      }, () => { /* clipboard unavailable: no paste event */ });
    }
  });
  ctx.subscriptions.push(sub);
}
