import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LinePack, PipEventType } from '../../src/types';

const pack: LinePack = JSON.parse(readFileSync(join(__dirname, '..', '..', 'src', 'lines', 'lines.json'), 'utf8'));

const main: PipEventType[] = ['paste', 'massDelete', 'undoSpam', 'frenzy', 'debugPrint', 'lateNight', 'idleReturn', 'runFail', 'runPass', 'badFileName', 'commitLazy'];
const minor: PipEventType[] = ['testWritten', 'commitGood', 'saveSpam', 'ancientFile'];
const extras = ['bribe', 'callback', 'wakeSulk', 'crack', 'crackRecover'];
const allKeys: string[] = [...main, ...minor, ...extras];
const BANNED = [/you got this/i, /❤/, /proud of you/i];
const ALLOWED_PLACEHOLDERS = new Set(['count', 'time', 'file', 'streak', 'msg', 'what']);
const MODES = ['dry', 'savage'] as const;

describe('lines.json', () => {
  it('has exactly the expected keys (no hush/wake)', () => {
    expect(Object.keys(pack).sort()).toEqual([...allKeys].sort());
  });

  it.each(allKeys)('%s has non-empty dry and savage arrays', (k) => {
    expect(pack[k].dry.length).toBeGreaterThan(0);
    expect(pack[k].savage.length).toBeGreaterThan(0);
  });

  it.each(main)('%s has 8-15 lines per mode', (k) => {
    for (const m of MODES) {
      expect(pack[k][m].length).toBeGreaterThanOrEqual(8);
      expect(pack[k][m].length).toBeLessThanOrEqual(15);
    }
  });

  it.each([...minor, 'bribe', 'callback'])('%s has at least 4 lines per mode', (k) => {
    for (const m of MODES) expect(pack[k][m].length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the mockup seed lines verbatim', () => {
    const seeds: [string, string][] = [
      ['runFail', 'Broken. Shocking. Nobody saw this coming. Except me. I saw it.'],
      ['runPass', 'It runs?! Quick, screenshot it before you touch it again.'],
      ['frenzy', 'Wow, look at you go. Typing faster than you think. Literally.'],
      ['massDelete', "{count} characters, gone. Bold of you to assume you'll remember why."],
      ['debugPrint', 'console.log #{count}. A debugger exists, but sure, do it your way.'],
      ['lateNight', "It's {time}. Normal people are asleep. You're here. Writing bugs."],
      ['idleReturn', '...zzz... wake me when you remember you have a job...'],
      ['badFileName', "{file}. Sure. That one's definitely the last one."],
      ['bribe', "...fine. One block. Don't make it weird."],
    ];
    for (const [k, t] of seeds) expect(pack[k].dry).toContain(t);
    for (const m of MODES) {
      expect(pack.wakeSulk[m]).toContain('Oh, NOW you need me.');
      expect(pack.crack[m]).toContain('...okay. That was actually good.');
      expect(pack.crackRecover[m]).toContain('Forget I said that.');
    }
  });

  it('callback templates use {count} and {what}', () => {
    for (const m of MODES)
      for (const l of pack.callback[m]) {
        expect(l).toContain('{count}');
        expect(l).toContain('{what}');
      }
  });

  it('is clean: no banned phrases, <=110 chars, known placeholders, no duplicates', () => {
    for (const k of allKeys)
      for (const m of MODES) {
        expect(new Set(pack[k][m]).size, `${k}.${m} duplicates`).toBe(pack[k][m].length);
        for (const l of pack[k][m]) {
          for (const b of BANNED) expect(b.test(l), `${k}.${m}: ${l}`).toBe(false);
          expect(l.length, `${k}.${m}: ${l}`).toBeLessThanOrEqual(110);
          for (const p of l.matchAll(/\{(\w+)\}/g)) expect(ALLOWED_PLACEHOLDERS.has(p[1]), `${k}.${m}: ${l}`).toBe(true);
        }
      }
  });

  it('savage differs from dry for the main events', () => {
    for (const k of main) expect(pack[k].savage).not.toEqual(pack[k].dry);
  });
});
