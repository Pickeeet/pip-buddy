import type { PipEventType } from '../../types';
import { localDate, localHour } from '../../brain/time';

export interface Change { text: string; rangeLength: number }
export interface ClassifyCtx { clipboard: string; pasteThreshold: number; isUndo: boolean }

export const MAX_CHANGES = 50;
export const MASS_DELETE_MIN = 15;
const NIGHT_END_HOUR = 5;

/** Classify one change event. At most one of each type; [] when the event is too large to be a habit. */
export function classifyChanges(changes: Change[], ctx: ClassifyCtx): PipEventType[] {
  if (changes.length > MAX_CHANGES || ctx.isUndo) return [];
  let paste = false;
  let massDelete = false;
  for (const c of changes) {
    if (c.text.length >= ctx.pasteThreshold && c.text === ctx.clipboard) paste = true;
    if (c.text === '' && c.rangeLength >= MASS_DELETE_MIN) massDelete = true;
  }
  const out: PipEventType[] = [];
  if (paste) out.push('paste');
  if (massDelete) out.push('massDelete');
  return out;
}

const DEBUG_PRINT = /console\.log\(|\bprint\(|\bdebugger\b|println!\(|fmt\.Println\(/g;

export function countDebugPrints(text: string): number {
  return text.match(DEBUG_PRINT)?.length ?? 0;
}

/** Inserted text longer than this is a formatter or bulk replace, never a typed debug print. */
export const DEBUG_SCAN_MAX_CHARS = 500;

/** Debug prints added by an event; skips large insertions to keep work bounded. */
export function countDebugPrintsInChanges(changes: Change[]): number {
  let n = 0;
  for (const c of changes) {
    if (c.text.length <= DEBUG_SCAN_MAX_CHARS) n += countDebugPrints(c.text);
  }
  return n;
}

/** True once when the nth hit lands within `ms` of the first hit in the window, then resets. */
export class RateWindow {
  private hits: number[] = [];
  constructor(private readonly n: number, private readonly ms: number) {}

  hit(at: number): boolean {
    this.hits.push(at);
    while (this.hits.length > 0 && at - this.hits[0] > this.ms) this.hits.shift();
    if (this.hits.length >= this.n) {
      this.hits = [];
      return true;
    }
    return false;
  }
}

/** touch() is true when the previous touch was at least idleMs ago. */
export class IdleTracker {
  private last: number | null = null;
  constructor(private readonly idleMs: number) {}

  touch(at: number): boolean {
    const idle = this.last !== null && at - this.last >= this.idleMs;
    this.last = at;
    return idle;
  }
}

/** One key per night: 23:47 and 00:10 of the same night share it (the night ends at 05:00). */
export function nightKey(at: number): string {
  return localDate(at - NIGHT_END_HOUR * 3600_000);
}

/** True in the late-night window (from `hour` until 05:00) if it has not already fired this night. */
export function lateNightOnce(at: number, lastFired: string | null, hour: number): boolean {
  const h = localHour(at);
  const night = h >= hour || h < NIGHT_END_HOUR;
  return night && lastFired !== nightKey(at);
}
