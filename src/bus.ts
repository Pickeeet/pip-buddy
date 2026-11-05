import type { PipEvent } from './types';

type Listener = (e: PipEvent) => void;

export class EventBus {
  private listeners = new Set<Listener>();

  on(fn: Listener): () => void {
    // Wrap so the same function subscribed twice gets two independent subscriptions.
    const entry: Listener = (e) => fn(e);
    this.listeners.add(entry);
    return () => { this.listeners.delete(entry); };
  }

  emit(e: PipEvent): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(e);
      } catch (err) {
        console.error('[pip] subscriber threw', err);
      }
    }
  }
}
