export type PipEventType =
  | 'paste' | 'massDelete' | 'undoSpam' | 'frenzy' | 'debugPrint' | 'lateNight'
  | 'idleReturn' | 'runFail' | 'runPass' | 'testWritten' | 'badFileName'
  | 'commitLazy' | 'commitGood' | 'saveSpam' | 'ancientFile' | 'hush' | 'wake';
export interface PipEvent { type: PipEventType; at: number; data: Record<string, string | number> }
export type Mode = 'dry' | 'savage';
export type Mood = 'UNIMPRESSED' | 'RECKLESS' | 'APPALLED' | 'SLEEPY' | 'SMUG' | 'DEAD' | 'SULKING' | 'NIGHTCAP' | 'CRACKED';
export type Fx = '' | 'fire' | 'sweat' | 'zzz' | 'smoke' | 'confetti' | 'question';
export type RemarkKind = 'line' | 'callback' | 'achievement' | 'crack' | 'bribe' | 'diary';
export interface Remark { text: string; mood: Mood; fx: Fx; kind: RemarkKind; event: PipEventType; at: number }
export interface DayStats {
  counts: Partial<Record<PipEventType, number>>; hushes: number;
  badNames: string[]; commitMsgs: string[]; failStreak: number; failStreakStart: number;
  maxFailStreak: number; crack: boolean; faithMin: number; faithMax: number;
}
export interface DiaryEntry { date: string; dayNumber: number; text: string }
export interface PipState {
  schema: 1; faith: number; mode: Mode; hushed: boolean; firstSeen: number;
  days: Record<string, DayStats>;           // key = local date 'YYYY-MM-DD'; keep last 28
  achievements: Record<string, number>;     // id -> unlocked-at ms
  diary: DiaryEntry[];                      // unique by date, newest last, keep last 60
  lastCrackAt: number; recent: string[];    // last 20 line ids spoken
}
export interface LinePack { [event: string]: { dry: string[]; savage: string[] } }
