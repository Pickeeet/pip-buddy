import * as vscode from 'vscode';
import type { EventBus } from '../bus';
import type { PipConfig } from '../config';
import { RunTracker } from './classify/runs';

const DEDUPE_MS = 1000;

export function registerRunDetectors(
  ctx: vscode.ExtensionContext, bus: EventBus, cfg: () => PipConfig,
): void {
  const tracker = new RunTracker(DEDUPE_MS);

  const handle = (exitCode: number | undefined): void => {
    if (cfg().detectors.runs === false) return;
    const at = Date.now();
    const r = tracker.record(exitCode, at);
    if (!r) return;
    if (r.type === 'runPass') bus.emit({ type: 'runPass', at, data: {} });
    else bus.emit({ type: 'runFail', at, data: { streak: r.streak } });
  };

  ctx.subscriptions.push(vscode.tasks.onDidEndTaskProcess((e) => handle(e.exitCode)));
  ctx.subscriptions.push(vscode.window.onDidEndTerminalShellExecution((e) => handle(e.exitCode)));
}
