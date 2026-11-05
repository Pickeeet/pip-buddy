import type { LinePack, Mode, PipEvent, PipState, Remark, RemarkKind } from '../types';
import { unlockNew } from './achievements';
import { applyFaith } from './faith';
import { callbackFor, openStreak, record } from './memory';
import { moodFor } from './mood';
import { Speaker } from './speaker';
import { localHour } from './time';

const RECENT_CAP = 20;
const CRACK_MIN_SPAN_MS = 10 * 60_000;
const CRACK_MIN_STREAK = 3;
const CRACK_GAP_MS = 7 * 86_400_000;

export class Brain {
  private readonly speaker: Speaker;

  constructor(
    readonly state: PipState,
    private readonly lines: LinePack,
    private readonly opts: { rng: () => number; cooldownMs: number },
  ) {
    this.speaker = new Speaker(lines, opts.rng, opts.cooldownMs);
  }

  setMode(m: Mode): void {
    this.state.mode = m;
  }

  handle(e: PipEvent): Remark | null {
    const s = this.state;
    const streak = openStreak(s, e.at); // before record() resets it on a pass
    const day = record(s, e);

    if (e.type === 'hush') {
      s.hushed = true;
      return null;
    }
    if (e.type === 'wake') {
      const wasHushed = s.hushed;
      s.hushed = false;
      if (!wasHushed) return null;
      const line = this.pickLine('wakeSulk', e);
      return line ? this.say(line, 'UNIMPRESSED', '', 'line', e) : null;
    }

    // faith (debugPrint only every third print)
    const before = s.faith;
    if (e.type !== 'debugPrint' || Number(e.data.count) % 3 === 0) s.faith = applyFaith(s.faith, e.type);
    day.faithMin = Math.min(day.faithMin, s.faith);
    day.faithMax = Math.max(day.faithMax, s.faith);
    const faithRose = s.faith > before;

    const unlocked = unlockNew(s, e);
    if (s.hushed) return null;

    // The Crack ignores cooldown
    if (
      e.type === 'runPass' && streak.len >= CRACK_MIN_STREAK &&
      e.at - streak.start >= CRACK_MIN_SPAN_MS &&
      (s.lastCrackAt === 0 || e.at - s.lastCrackAt >= CRACK_GAP_MS)
    ) {
      const crack = this.pickLine('crack', e);
      const recover = this.pickLine('crackRecover', e);
      if (crack && recover) {
        s.lastCrackAt = e.at;
        day.crack = true;
        return this.say({ id: '', text: `${crack.text} ${recover.text}` }, 'CRACKED', '', 'crack', e, [crack.id, recover.id]);
      }
    }

    if (!this.speaker.canSpeak(e.at)) return null;
    const { mood, fx } = moodFor(e.type, localHour(e.at), s.hushed);

    if (unlocked.length > 0) {
      const a = unlocked[0];
      return this.say({ id: '', text: `Achievement unlocked: ${a.title}. ${a.blurb}` }, mood, fx, 'achievement', e);
    }
    const cb = callbackFor(s, e, e.at, this.lines, s.mode, this.opts.rng);
    if (cb) return this.say({ id: '', text: cb }, mood, fx, 'callback', e);

    if (faithRose && (e.type === 'testWritten' || e.type === 'commitGood')) {
      const bribe = this.pickLine('bribe', e);
      if (bribe) return this.say(bribe, mood, fx, 'bribe', e);
    }
    const line = this.pickLine(e.type, e);
    return line ? this.say(line, mood, fx, 'line', e) : null;
  }

  private pickLine(key: string, e: PipEvent): { id: string; text: string } | null {
    return this.speaker.pick(key as PipEvent['type'], this.state.mode, e.data, e.at, this.state.recent);
  }

  private say(
    line: { id: string; text: string }, mood: Remark['mood'], fx: Remark['fx'],
    kind: RemarkKind, e: PipEvent, ids: string[] = [line.id],
  ): Remark {
    for (const id of ids) if (id) this.state.recent.push(id);
    if (this.state.recent.length > RECENT_CAP) this.state.recent.splice(0, this.state.recent.length - RECENT_CAP);
    this.speaker.markSpoken(e.at);
    return { text: line.text, mood, fx, kind, event: e.type, at: e.at };
  }
}
