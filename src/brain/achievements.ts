import type { PipEvent, PipState } from '../types';
import { weekCount } from './memory';
import { localDate, localHour } from './time';

export interface Achievement {
  id: string;
  title: string;
  blurb: string;
  test: (state: PipState, e: PipEvent) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'friday-deployer', title: 'Friday Deployer',
    blurb: 'Committed on a Friday evening. Bold. Foolish, but bold.',
    test: (_s, e) =>
      (e.type === 'commitGood' || e.type === 'commitLazy') &&
      new Date(e.at).getDay() === 5 && localHour(e.at) >= 17,
  },
  {
    id: 'archaeologist', title: 'Archaeologist',
    blurb: 'Opened a file older than some interns.',
    test: (_s, e) => e.type === 'ancientFile',
  },
  {
    id: 'commitment-issues', title: 'Commitment Issues',
    blurb: 'Five lazy commit messages in one week.',
    test: (s, e) => e.type === 'commitLazy' && weekCount(s, 'commitLazy', e.at) >= 5,
  },
  {
    id: 'night-owl', title: 'Nocturnal',
    blurb: 'Three late nights in a week. Sleep is a suggestion.',
    test: (s, e) => {
      if (e.type !== 'lateNight') return false;
      let nights = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(e.at);
        d.setDate(d.getDate() - i);
        if ((s.days[localDate(d.getTime())]?.counts.lateNight ?? 0) > 0) nights++;
      }
      return nights >= 3;
    },
  },
  {
    id: 'copy-pasta', title: 'Copy Pasta',
    blurb: 'Ten pastes in a day.',
    test: (s, e) => e.type === 'paste' && (s.days[localDate(e.at)]?.counts.paste ?? 0) >= 10,
  },
  {
    id: 'phoenix', title: 'Phoenix',
    blurb: 'Passed a run after five or more failures in a row.',
    test: (s, e) => e.type === 'runPass' && (s.days[localDate(e.at)]?.maxFailStreak ?? 0) >= 5,
  },
];

/** Achievements newly earned by this event; records their unlock time. Each unlocks once. */
export function unlockNew(state: PipState, e: PipEvent): Achievement[] {
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] === undefined && a.test(state, e)) {
      state.achievements[a.id] = e.at;
      fresh.push(a);
    }
  }
  return fresh;
}
