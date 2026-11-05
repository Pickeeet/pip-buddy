import * as vscode from 'vscode';
import type { Mode } from './types';

export interface PipConfig {
  mode: Mode;
  cooldownSeconds: number;
  pasteThreshold: number;
  lateNightHour: number;
  surface: 'panel' | 'statusbar' | 'toasts';
  detectors: Record<string, boolean>;
}

export const DETECTOR_KEYS = [
  'paste', 'massDelete', 'undoSpam', 'frenzy', 'debugPrint', 'lateNight', 'idleReturn',
  'runs', 'badFileName', 'testWritten', 'commits', 'saveSpam', 'ancientFile',
] as const;

export function readConfig(): PipConfig {
  const c = vscode.workspace.getConfiguration('pip');
  const user = c.get<Record<string, boolean>>('detectors', {});
  const detectors: Record<string, boolean> = {};
  for (const k of DETECTOR_KEYS) detectors[k] = user?.[k] !== false;
  const mode = c.get<string>('mode', 'dry');
  const surface = c.get<string>('surface', 'panel');
  return {
    mode: mode === 'savage' ? 'savage' : 'dry',
    cooldownSeconds: c.get<number>('cooldownSeconds', 3.5),
    pasteThreshold: c.get<number>('pasteThreshold', 200),
    lateNightHour: c.get<number>('lateNightHour', 23),
    surface: surface === 'statusbar' || surface === 'toasts' ? surface : 'panel',
    detectors,
  };
}
