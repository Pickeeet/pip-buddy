import type { DiaryEntry, Fx, Mode, Mood } from '../types';
import type { RoastCardData } from '../brain/roastCard';

/** Extension -> webview. `showTab` lets `Pip: Show Diary` open the Diary tab. */
export type ToWebview =
  | {
      kind: 'state'; faith: number; mood: Mood; fx: Fx; line: string | null; mode: Mode; hushed: boolean;
      diary: DiaryEntry[]; achievements: { id: string; title: string; blurb: string; at: number }[];
    }
  | { kind: 'renderCard'; card: RoastCardData }
  | { kind: 'showTab'; tab: 'corner' | 'diary' | 'achievements' };

export type StateMessage = Extract<ToWebview, { kind: 'state' }>;

/** Webview -> extension. */
export type FromWebview = { kind: 'ready' } | { kind: 'cardPng'; dataUrl: string } | { kind: 'command'; id: string };
