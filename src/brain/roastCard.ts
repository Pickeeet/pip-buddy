import type { PipEventType, PipState } from '../types';
import { ACHIEVEMENTS } from './achievements';
import { OFFENCE_LABELS } from './labels';
import { localDate } from './time';

export interface RoastCardData { weekOf: string; topOffences: { label: string; count: number }[]; faithStart: number; faithEnd: number; diaryLine: string | null; achievement: string | null; cracked: boolean; dayCount: number }

const WINDOW_DAYS = 7;
const TOP_N = 3;

/** Midnight-local start of each of the last 7 days ending today, oldest first (DST-safe: steps the calendar). */
function windowStarts(now: number): number[] {
  const out: number[] = [];
  for (let back = WINDOW_DAYS - 1; back >= 0; back--) {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    d.setHours(0, 0, 0, 0);
    out.push(d.getTime());
  }
  return out;
}

/** Summarises the last 7 local days (today included) for the weekly roast card. Pure. */
export function buildCard(state: PipState, now: number): RoastCardData {
  const starts = windowStarts(now);
  const dates = starts.map(localDate);
  const inWindow = new Set(dates);
  const withStats = dates.filter((k) => k in state.days);

  const totals = new Map<PipEventType, number>();
  let cracked = false;
  for (const k of withStats) {
    const day = state.days[k];
    if (day.crack) cracked = true;
    for (const [type, n] of Object.entries(day.counts) as [PipEventType, number][]) {
      if (OFFENCE_LABELS[type] && n > 0) totals.set(type, (totals.get(type) ?? 0) + n);
    }
  }
  const topOffences = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([type, count]) => ({ label: OFFENCE_LABELS[type] as string, count }));

  const diary = state.diary.filter((e) => inWindow.has(e.date));

  let achievement: string | null = null;
  let achievementAt = -Infinity;
  for (const a of ACHIEVEMENTS) {
    const at = state.achievements[a.id];
    if (at !== undefined && at >= starts[0] && at <= now && at > achievementAt) { achievement = a.title; achievementAt = at; }
  }

  return {
    weekOf: dates[0],
    topOffences,
    faithStart: withStats.length > 0 ? state.days[withStats[0]].faithMin : state.faith,
    faithEnd: state.faith,
    diaryLine: diary.length > 0 ? diary[diary.length - 1].text : null,
    achievement,
    cracked,
    dayCount: withStats.length,
  };
}
