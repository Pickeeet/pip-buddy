import { describe, it, expect } from 'vitest';
import { buildCard } from '../../src/brain/roastCard';
import { isoWeek, shouldOfferCard } from '../../src/brain/isoWeek';
import { initialState } from '../../src/brain/initialState';
import { emptyDay } from '../../src/brain/memory';
import type { DayStats, PipState } from '../../src/types';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 11, 6, 17); // Friday 2026-11-06

function withDay(s: PipState, date: string, patch: Partial<DayStats>): PipState {
  s.days[date] = { ...emptyDay(), ...patch };
  return s;
}

describe('buildCard', () => {
  it('ranks offences by count with the shared labels', () => {
    const s = withDay(initialState(NOW), '2026-11-05', { counts: { paste: 12, runFail: 3 } });
    const c = buildCard(s, NOW);
    expect(c.topOffences[0]).toEqual({ label: 'Pastes', count: 12 });
    expect(c.topOffences[1]).toEqual({ label: 'Failed runs', count: 3 });
  });

  it('keeps only the top 3 and sums across days in the window, ignoring older days', () => {
    const s = initialState(NOW);
    withDay(s, '2026-11-06', { counts: { paste: 2, massDelete: 1, lateNight: 1, debugPrint: 1 } });
    withDay(s, '2026-11-04', { counts: { paste: 3, massDelete: 4, lateNight: 2 } });
    withDay(s, '2026-10-29', { counts: { debugPrint: 99 } }); // 8 days back: outside
    const c = buildCard(s, NOW);
    expect(c.topOffences).toEqual([
      { label: 'Pastes', count: 5 }, { label: 'Mass deletions', count: 5 }, { label: 'Late nights', count: 3 },
    ]);
    expect(c.dayCount).toBe(2);
    expect(c.weekOf).toBe('2026-10-31');
  });

  it('ignores event types with no label (e.g. runPass)', () => {
    const s = withDay(initialState(NOW), '2026-11-06', { counts: { runPass: 40, paste: 1 } });
    expect(buildCard(s, NOW).topOffences).toEqual([{ label: 'Pastes', count: 1 }]);
  });

  it('cracked is true when any day in the window has crack', () => {
    const s = initialState(NOW);
    withDay(s, '2026-11-03', { crack: true });
    withDay(s, '2026-11-06', {});
    expect(buildCard(s, NOW).cracked).toBe(true);
    const old = withDay(initialState(NOW), '2026-10-01', { crack: true });
    expect(buildCard(old, NOW).cracked).toBe(false);
  });

  it('diaryLine is the newest entry in the window, or null', () => {
    const s = initialState(NOW);
    s.diary = [
      { date: '2026-10-20', dayNumber: 1, text: 'too old' },
      { date: '2026-11-02', dayNumber: 2, text: 'first in window' },
      { date: '2026-11-05', dayNumber: 3, text: 'newest in window' },
    ];
    expect(buildCard(s, NOW).diaryLine).toBe('newest in window');
    s.diary = [{ date: '2026-10-20', dayNumber: 1, text: 'too old' }];
    expect(buildCard(s, NOW).diaryLine).toBeNull();
  });

  it('faith runs from the earliest day min to current faith', () => {
    const s = initialState(NOW);
    s.faith = 3;
    withDay(s, '2026-11-01', { faithMin: 6, faithMax: 8 });
    withDay(s, '2026-11-05', { faithMin: 2, faithMax: 4 });
    const c = buildCard(s, NOW);
    expect(c.faithStart).toBe(6);
    expect(c.faithEnd).toBe(3);
  });

  it('with no days, faith start equals faith end', () => {
    const s = initialState(NOW);
    s.faith = 7;
    const c = buildCard(s, NOW);
    expect([c.faithStart, c.faithEnd, c.dayCount]).toEqual([7, 7, 0]);
  });

  it('achievement is the title of the latest unlock in the window, else null', () => {
    const s = initialState(NOW);
    s.achievements = { archaeologist: at(2026, 11, 2), 'friday-deployer': at(2026, 11, 5), 'no-such-id': at(2026, 11, 6) };
    expect(buildCard(s, NOW).achievement).toBe('Friday Deployer');
    s.achievements = { archaeologist: at(2026, 10, 1) };
    expect(buildCard(s, NOW).achievement).toBeNull();
  });
});

describe('isoWeek', () => {
  it('formats ISO week strings', () => {
    expect(isoWeek(at(2026, 11, 6))).toBe('2026-W45');
    expect(isoWeek(at(2026, 1, 1))).toBe('2026-W01');
    expect(isoWeek(at(2021, 1, 3))).toBe('2020-W53'); // Sunday belongs to the previous ISO year
    expect(isoWeek(at(2024, 12, 30))).toBe('2025-W01'); // Monday of the week with Thursday in 2025
  });
});

describe('shouldOfferCard', () => {
  it('only on Friday from 16:00, once per ISO week', () => {
    expect(shouldOfferCard(at(2026, 11, 6, 15, 59), undefined)).toBe(false);
    expect(shouldOfferCard(at(2026, 11, 6, 16, 0), undefined)).toBe(true);
    expect(shouldOfferCard(at(2026, 11, 6, 16, 0), '2026-W45')).toBe(false);
    expect(shouldOfferCard(at(2026, 11, 6, 16, 0), '2026-W44')).toBe(true);
    expect(shouldOfferCard(at(2026, 11, 5, 18, 0), undefined)).toBe(false); // Thursday
    expect(shouldOfferCard(at(2026, 11, 7, 18, 0), undefined)).toBe(false); // Saturday
  });
});
