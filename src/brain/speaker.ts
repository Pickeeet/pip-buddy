import type { LinePack, Mode, PipEventType } from '../types';

/** Replace `{key}` with data[key]; unknown keys are left as-is. */
export function fill(template: string, data: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(data, key) ? String(data[key]) : whole,
  );
}

export class Speaker {
  private lastSpokeAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly lines: LinePack,
    private readonly rng: () => number,
    private readonly cooldownMs: number,
  ) {}

  canSpeak(at: number): boolean {
    return at - this.lastSpokeAt >= this.cooldownMs;
  }

  markSpoken(at: number): void {
    this.lastSpokeAt = at;
  }

  /** Uniform pick among lines not in `recent`; repeats only if every line is recent. */
  pick(
    event: PipEventType,
    mode: Mode,
    data: Record<string, string | number>,
    _at: number,
    recent: string[],
  ): { id: string; text: string } | null {
    const pool = this.lines[event]?.[mode];
    if (!pool || pool.length === 0) return null;
    const ids = pool.map((_, i) => `${event}.${mode}.${i}`);
    const fresh = ids.map((id, i) => i).filter((i) => !recent.includes(ids[i]));
    const candidates = fresh.length > 0 ? fresh : ids.map((_, i) => i);
    const index = candidates[Math.min(candidates.length - 1, Math.floor(this.rng() * candidates.length))];
    return { id: ids[index], text: fill(pool[index], data) };
  }
}
