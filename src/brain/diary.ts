import type { DiaryEntry, PipEventType, PipState } from '../types';
import { localDate } from './time';

type Rng = () => number;
type DiaryType = 'massDelete' | 'paste' | 'runFail' | 'lateNight' | 'badFileName' | 'commitLazy' | 'debugPrint';

const KEEP_ENTRIES = 60;

// Order doubles as the tie-break when two counts are equal.
const TYPES: DiaryType[] = ['massDelete', 'paste', 'runFail', 'lateNight', 'badFileName', 'commitLazy', 'debugPrint'];

const TEMPLATES: Record<DiaryType, string[]> = {
  massDelete: [
    "Human deleted {n} chunks of code, then stared at the gap. Called it 'refactoring'.",
    'Human deleted {n} large blocks today. I watched each one go. Nobody mourned.',
    'Human deleted with great confidence, {n} times. The confidence was not earned.',
  ],
  paste: [
    'Human pasted {n} large blocks today. Understanding was not included.',
    'There were {n} pastes. I counted. Typing is apparently optional now.',
    '{n} pastes. Somewhere, a stranger on the internet is owed a thank-you note.',
  ],
  runFail: [
    'The run failed {n} times. Human reran it anyway, hoping for a different personality.',
    '{n} failed runs. The code was consistent. The human was optimistic.',
    'Watched {n} red runs today. Nobody learned anything, but everybody got a turn.',
  ],
  lateNight: [
    'Human was still here at night, {n} times over. Sleep is a rumour.',
    'It was late {n} times. The code did not improve with the hour.',
    '{n} late-night appearances. I was awake too, which is nobody\'s fault but my own.',
  ],
  badFileName: [
    'Human created {n} files with names that apologise for themselves.',
    '{n} cursed file names today. final_v2 is never final.',
    'I counted {n} file names that should have been rejected at the door.',
  ],
  commitLazy: [
    "{n} commit messages said nothing at all. Future human will have questions.",
    'Human committed {n} times with messages like a shrug.',
    '{n} lazy commits. History will be written. Not well, but written.',
  ],
  debugPrint: [
    'Human debugged with print statements {n} times. Bold of them to call it a method.',
    '{n} console.logs today. The debugger sits unused and I relate.',
    'There were {n} debug prints. Each one a small confession.',
  ],
};

const QUIET: string[] = [
  'Not much happened. I watched anyway.',
  'A quiet day. Suspiciously quiet.',
];

const CLOSERS = ["I said nothing. I'm growing.", "I'm fine.", 'Tomorrow will be worse. I can feel it.'];

function pick<T>(items: T[], rng: Rng): T {
  const i = Math.floor(rng() * items.length);
  return items[Math.min(Math.max(i, 0), items.length - 1)];
}

/** Calendar days from `fromMs`'s local date to the 'YYYY-MM-DD' key (DST-safe). */
function daysBetween(fromMs: number, date: string): number {
  const f = new Date(fromMs);
  const fromUtc = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - fromUtc) / 86_400_000);
}

/**
 * Write the diary entry for `date` and append it to `state.diary`.
 * Returns null when there are no stats for that date or an entry already exists.
 */
export function writeDiary(state: PipState, date: string, rng: Rng): DiaryEntry | null {
  const day = state.days[date];
  if (!day || state.diary.some(e => e.date === date)) return null;

  const dayNumber = Math.max(1, daysBetween(state.firstSeen, date) + 1);

  const top = TYPES
    .map((t, i) => ({ t, i, n: day.counts[t as PipEventType] ?? 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 2);

  const parts: string[] = top.length
    ? top.map(x => pick(TEMPLATES[x.t], rng).replace('{n}', String(x.n)))
    : [pick(QUIET, rng)];
  if (day.hushes >= 3) parts.push(`Was told to hush ${day.hushes} times. Noted. Permanently.`);
  if (day.crack) parts.push("Something happened today. We don't talk about it.");
  parts.push(pick(CLOSERS, rng));

  const entry: DiaryEntry = { date, dayNumber, text: `Day ${dayNumber}. ${parts.join(' ')}` };
  state.diary.push(entry);
  state.diary.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (state.diary.length > KEEP_ENTRIES) state.diary.splice(0, state.diary.length - KEEP_ENTRIES);
  return entry;
}

/**
 * Write entries for every date in `days` strictly before today's local date that has no entry yet.
 * Idempotent: a date that already has an entry is never written again.
 */
export function rollover(state: PipState, now: number, rng: Rng): DiaryEntry[] {
  const today = localDate(now);
  // Once the diary is full, anything older than its oldest entry would be written and trimmed straight away.
  const oldestKept = state.diary.length >= KEEP_ENTRIES ? state.diary[0].date : '';
  const out: DiaryEntry[] = [];
  for (const date of Object.keys(state.days).filter(d => d < today && d >= oldestKept).sort()) {
    const e = writeDiary(state, date, rng);
    if (e) out.push(e);
  }
  return out.filter(e => state.diary.includes(e));
}
