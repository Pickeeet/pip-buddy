import { describe, it, expect } from 'vitest';
import { Brain } from '../../src/brain/brain';
import { initialState } from '../../src/brain/initialState';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinePack, PipEvent, PipEventType } from '../../src/types';

const lines: LinePack = JSON.parse(readFileSync(join(__dirname, '..', '..', 'src', 'lines', 'lines.json'), 'utf8'));
const DAY = 86_400_000;
const T0 = new Date(2026, 5, 10, 12, 0, 0).getTime();
const ev = (type: PipEventType, at: number, data: PipEvent['data'] = {}): PipEvent => ({ type, at, data });
const mk = (t = T0) => new Brain(initialState(t), lines, { rng: () => 0, cooldownMs: 3500 });
const failsThenPass = (b: Brain, t: number) => {
  b.handle(ev('runFail', t, { streak: 1 }));
  b.handle(ev('runFail', t + 5 * 60_000, { streak: 2 }));
  b.handle(ev('runFail', t + 11 * 60_000, { streak: 3 }));
  return b.handle(ev('runPass', t + 12 * 60_000));
};

describe('Brain', () => {
  it('cooldown silences a second event 1s later', () => {
    const b = mk();
    expect(b.handle(ev('paste', T0, { count: 300 }))).not.toBeNull();
    expect(b.handle(ev('paste', T0 + 1000, { count: 300 }))).toBeNull();
    expect(b.handle(ev('paste', T0 + 4000, { count: 300 }))).not.toBeNull();
  });
  it('hush silences but still records; wake sulks and ignores cooldown', () => {
    const b = mk();
    b.handle(ev('hush', T0));
    expect(b.state.hushed).toBe(true);
    expect(b.handle(ev('frenzy', T0 + 10_000))).toBeNull();
    expect(b.state.days[Object.keys(b.state.days)[0]].counts.frenzy).toBe(1);
    expect(b.state.days[Object.keys(b.state.days)[0]].hushes).toBe(1);
    const r = b.handle(ev('wake', T0 + 10_001));
    expect(r?.text).toBe('Oh, NOW you need me.');
    expect(r?.mood).toBe('UNIMPRESSED');
    expect(b.state.hushed).toBe(false);
  });
  it('the crack: fires once per 7 days after a long fail streak', () => {
    const b = mk();
    const r = failsThenPass(b, T0);
    expect(r?.kind).toBe('crack');
    expect(r?.mood).toBe('CRACKED');
    expect(r?.text).toBe('...okay. That was actually good. Forget I said that.');
    expect(b.state.lastCrackAt).toBeGreaterThan(0);
    expect(failsThenPass(b, T0 + 2 * DAY)?.kind).not.toBe('crack');
    expect(failsThenPass(b, T0 + 8 * DAY)?.kind).toBe('crack');
  });
  it('two fails then a pass is not a crack', () => {
    const b = mk();
    b.handle(ev('runFail', T0));
    b.handle(ev('runFail', T0 + 11 * 60_000));
    expect(b.handle(ev('runPass', T0 + 12 * 60_000))?.kind).not.toBe('crack');
  });
  it('three fails in under 10 minutes is not a crack', () => {
    const b = mk();
    for (let i = 0; i < 3; i++) b.handle(ev('runFail', T0 + i * 60_000));
    expect(b.handle(ev('runPass', T0 + 5 * 60_000))?.kind).not.toBe('crack');
  });
  it('a streak crossing midnight still cracks', () => {
    const b = mk(new Date(2026, 5, 10, 23, 0).getTime());
    const t = new Date(2026, 5, 10, 23, 55).getTime();
    b.handle(ev('runFail', t));
    b.handle(ev('runFail', t + 60_000));
    b.handle(ev('runFail', new Date(2026, 5, 11, 0, 7).getTime()));
    expect(b.handle(ev('runPass', new Date(2026, 5, 11, 0, 8).getTime()))?.kind).toBe('crack');
  });
  it('first ancientFile is an achievement', () => {
    const r = mk().handle(ev('ancientFile', T0, { file: 'old.c' }));
    expect(r?.kind).toBe('achievement');
    expect(r?.text).toMatch(/^Achievement unlocked: Archaeologist\. /);
  });
  it('bribe line only when faith rose on testWritten/commitGood; runPass speaks its own line', () => {
    const b = mk();
    expect(b.handle(ev('testWritten', T0))?.kind).toBe('bribe');
    expect(b.state.faith).toBe(6);
    const p = b.handle(ev('runPass', T0 + 10_000));
    expect(p?.kind).toBe('line');
    expect(p?.event).toBe('runPass');
    b.state.faith = 10;
    expect(b.handle(ev('commitGood', T0 + 20_000, { msg: 'x' }))?.kind).toBe('line');
  });
  it('debugPrint lowers faith only every third print', () => {
    const b = mk();
    b.handle(ev('debugPrint', T0, { count: 1 }));
    b.handle(ev('debugPrint', T0 + 5000, { count: 2 }));
    expect(b.state.faith).toBe(5);
    b.handle(ev('debugPrint', T0 + 10_000, { count: 3 }));
    expect(b.state.faith).toBe(4);
  });
  it('callback beats a line after three in a week; recent is capped and mode switches', () => {
    const b = mk();
    b.handle(ev('paste', T0, { count: 300 }));
    b.handle(ev('paste', T0 + 5000, { count: 300 }));
    expect(b.handle(ev('paste', T0 + 10_000, { count: 300 }))?.kind).toBe('callback');
    for (let i = 0; i < 30; i++) b.handle(ev('frenzy', T0 + 20_000 + i * 5000));
    expect(b.state.recent.length).toBeLessThanOrEqual(20);
    b.setMode('savage');
    expect(b.state.mode).toBe('savage');
  });
});
