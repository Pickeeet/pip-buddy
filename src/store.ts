import type { DayStats, DiaryEntry, Mode, PipState } from './types';
import { initialState } from './brain/initialState';
import { emptyDay } from './brain/memory';

/** Subset of `vscode.Memento` we use; defined locally so this file never imports `vscode`. */
export interface KV {
  get<T>(k: string): T | undefined;
  update(k: string, v: unknown): PromiseLike<void>;
}

const KEY = 'pip.state';
const MAX_DIARY = 60;
const MAX_RECENT = 20;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, fallback: number): number => (isNum(v) ? v : fallback);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const validFaith = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 10;

function readDay(v: unknown): DayStats | undefined {
  if (!isObj(v)) return undefined;
  const d = emptyDay();
  if (isObj(v.counts)) {
    for (const [k, n] of Object.entries(v.counts)) if (isNum(n)) (d.counts as Record<string, number>)[k] = n;
  }
  d.hushes = num(v.hushes, d.hushes);
  d.badNames = strings(v.badNames);
  d.commitMsgs = strings(v.commitMsgs);
  d.failStreak = num(v.failStreak, d.failStreak);
  d.failStreakStart = num(v.failStreakStart, d.failStreakStart);
  d.maxFailStreak = num(v.maxFailStreak, d.maxFailStreak);
  d.crack = v.crack === true;
  d.faithMin = num(v.faithMin, d.faithMin);
  d.faithMax = num(v.faithMax, d.faithMax);
  return d;
}

function readDiary(v: unknown): DiaryEntry[] {
  if (!Array.isArray(v)) return [];
  const out: DiaryEntry[] = [];
  for (const e of v) {
    if (isObj(e) && typeof e.date === 'string' && typeof e.text === 'string' && isNum(e.dayNumber)) {
      out.push({ date: e.date, dayNumber: e.dayNumber, text: e.text });
    }
  }
  return out;
}

/** Validates field by field; never throws. Unknown/invalid shape -> fresh state, keeping a valid faith. */
function parse(raw: unknown, now: number): PipState {
  const fresh = initialState(now);
  if (!isObj(raw)) return fresh;
  if (validFaith(raw.faith)) fresh.faith = Math.round(raw.faith);
  if (raw.schema !== 1) return fresh;

  fresh.mode = (raw.mode === 'dry' || raw.mode === 'savage' ? raw.mode : fresh.mode) as Mode;
  fresh.hushed = raw.hushed === true;
  fresh.firstSeen = num(raw.firstSeen, fresh.firstSeen);
  fresh.lastCrackAt = num(raw.lastCrackAt, fresh.lastCrackAt);
  fresh.recent = strings(raw.recent).slice(-MAX_RECENT);
  if (isObj(raw.days)) {
    for (const [k, v] of Object.entries(raw.days)) {
      const d = readDay(v);
      if (d) fresh.days[k] = d;
    }
  }
  if (isObj(raw.achievements)) {
    for (const [k, t] of Object.entries(raw.achievements)) if (isNum(t)) fresh.achievements[k] = t;
  }
  fresh.diary = readDiary(raw.diary).slice(-MAX_DIARY);
  return fresh;
}

export function load(kv: KV, now: number): PipState {
  try {
    return parse(kv.get<unknown>(KEY), now);
  } catch {
    return initialState(now);
  }
}

const cloneDay = (d: DayStats): DayStats => ({
  ...d, counts: { ...d.counts }, badNames: [...d.badNames], commitMsgs: [...d.commitMsgs],
});

function mergeDay(a: DayStats, b: DayStats): DayStats {
  const counts: DayStats['counts'] = { ...a.counts };
  for (const [k, n] of Object.entries(b.counts) as [keyof DayStats['counts'], number][]) {
    counts[k] = Math.max(counts[k] ?? 0, n);
  }
  return {
    counts,
    hushes: Math.max(a.hushes, b.hushes),
    badNames: [...(b.badNames.length >= a.badNames.length ? b.badNames : a.badNames)],
    commitMsgs: [...(b.commitMsgs.length >= a.commitMsgs.length ? b.commitMsgs : a.commitMsgs)],
    failStreak: b.failStreak,
    failStreakStart: b.failStreakStart,
    maxFailStreak: Math.max(a.maxFailStreak, b.maxFailStreak),
    crack: a.crack || b.crack,
    faithMin: Math.min(a.faithMin, b.faithMin),
    faithMax: Math.max(a.faithMax, b.faithMax),
  };
}

/** Pure; `b` is the live in-memory state and wins scalars. Returns a new object sharing nothing with inputs. */
export function merge(a: PipState, b: PipState): PipState {
  const days: Record<string, DayStats> = {};
  for (const k of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    const da = a.days[k];
    const db = b.days[k];
    days[k] = da && db ? mergeDay(da, db) : cloneDay((da ?? db) as DayStats);
  }
  const achievements: Record<string, number> = { ...a.achievements };
  for (const [id, t] of Object.entries(b.achievements)) {
    achievements[id] = id in achievements ? Math.min(achievements[id], t) : t;
  }
  const byDate = new Map<string, DiaryEntry>();
  for (const e of a.diary) byDate.set(e.date, { ...e });
  for (const e of b.diary) byDate.set(e.date, { ...e });
  const diary = [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0)).slice(-MAX_DIARY);
  return {
    schema: 1,
    faith: b.faith,
    mode: b.mode,
    hushed: b.hushed,
    firstSeen: Math.min(a.firstSeen, b.firstSeen),
    days,
    achievements,
    diary,
    lastCrackAt: b.lastCrackAt,
    recent: [...b.recent],
  };
}

/** Re-reads the stored value (another window may have written), merges `s` into it, writes the result. Leaves `s` untouched. */
export async function save(kv: KV, s: PipState): Promise<void> {
  const stored = load(kv, s.firstSeen);
  await kv.update(KEY, merge(stored, s));
}
