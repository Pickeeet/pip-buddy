import type { PipEventType } from '../types';

/** Human labels for repeatable offences; shared by callbacks and the roast card. */
export const OFFENCE_LABELS: Partial<Record<PipEventType, string>> = {
  paste: 'Pastes',
  massDelete: 'Mass deletions',
  runFail: 'Failed runs',
  lateNight: 'Late nights',
  badFileName: 'Cursed file names',
  commitLazy: 'Lazy commits',
  debugPrint: 'console.logs',
  undoSpam: 'Undo sprees',
  frenzy: 'Typing frenzies',
  saveSpam: 'Save sprees',
};
