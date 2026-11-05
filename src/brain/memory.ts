import type { DayStats, LinePack, Mode, PipEvent, PipEventType, PipState } from '../types';
import { OFFENCE_LABELS } from './labels';
import { fill } from './speaker';
import { localDate } from './time';

const KEEP_DAYS = 28;
const WEEK_DAYS = 7;
const CALLBACK_MIN = 3;

export function emptyDay(): DayStats {
  return {
    counts: {}, hushes: 0, badNames: [], commitMsgs: [], failStreak: 0, failStreakStart: 0,
    maxFailStreak: 0, crack: false, faithMin: 5, faithMax: 5,
  };
}

/** Local date key `back` days before `at` (DST-safe: steps the calendar, not 24h blocks). */
function dateBack(at: number, back: number): string {
  const d = new Date(at);
  d.setDate(d.getDate() - back);
  return localDate(d.getTime());
}

/** The fail streak in progress as of `at`: today's, or the most recent earlier day's if still open. */
export function openStreak(state: PipState, at: number): { len: number; start: number } {
  const key = localDate(at);
  const today = state.days[key];
  if (today) return { len: today.failStreak, start: today.failStreakStart };
  const prev = Object.keys(state.days).filter((k) => k < key).sort().pop();
  const d = prev === undefined ? undefined : state.days[prev];
  return d && d.failStreak > 0 ? { len: d.failStreak, start: d.failStreakStart } : { len: 0, start: 0 };
}

/** Mutates and returns today's stats for the event; prunes days older than 28. */
export function record(state: PipState, e: PipEvent): DayStats {
  const key = localDate(e.at);
  let day = state.days[key];
  if (!day) {
    const streak = openStreak(state, e.at);
    day = emptyDay();
    day.failStreak = streak.len;
    day.failStreakStart = streak.start;
    day.faithMin = state.faith;
    day.faithMax = state.faith;
    state.days[key] = day;
  }
  day.counts[e.type] = (day.counts[e.type] ?? 0) + 1;

  if (e.type === 'badFileName' && e.data.file !== undefined) day.badNames.push(String(e.data.file));
  if ((e.type === 'commitLazy' || e.type === 'commitGood') && e.data.msg !== undefined) {
    day.commitMsgs.push(String(e.data.msg));
  }
  if (e.type === 'hush') day.hushes += 1;
  if (e.type === 'runFail') {
    if (day.failStreak === 0) day.failStreakStart = e.at;
    day.failStreak += 1;
  } else if (e.type === 'runPass') {
    day.maxFailStreak = Math.max(day.maxFailStreak, day.failStreak);
    day.failStreak = 0;
  }

  const cutoff = dateBack(e.at, KEEP_DAYS - 1);
  for (const k of Object.keys(state.days)) if (k < cutoff) delete state.days[k];
  return day;
}

/** Count of `type` events over the last 7 local days, including `at`'s day. */
export function weekCount(state: PipState, type: PipEventType, at: number): number {
  let total = 0;
  for (let i = 0; i < WEEK_DAYS; i++) total += state.days[dateBack(at, i)]?.counts[type] ?? 0;
  return total;
}

// "One callback per type per day" without a schema field: remembered per DayStats object.
const called = new WeakMap<DayStats, Set<PipEventType>>();

/** Call after `record`. Returns a filled callback line, or null. */
export function callbackFor(
  state: PipState, e: PipEvent, at: number, lines: LinePack, mode: Mode, rng: () => number,
): string | null {
  const label = OFFENCE_LABELS[e.type];
  if (!label) return null;
  const count = weekCount(state, e.type, at);
  if (count < CALLBACK_MIN) return null;
  const day = state.days[localDate(at)];
  if (!day) return null;
  if (called.get(day)?.has(e.type)) return null;
  const pool = lines.callback?.[mode];
  if (!pool || pool.length === 0) return null;
  const template = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const text = fill(template, { count, what: label.toLowerCase() });
  if (!called.has(day)) called.set(day, new Set());
  called.get(day)!.add(e.type);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
