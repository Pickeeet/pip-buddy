export type RunResult = { type: 'runPass' } | { type: 'runFail'; streak: number };

/**
 * Turns exit codes into run results. Dedupes the same exit code within `dedupeMs`
 * (a task end and a shell-execution end can both fire for one command) and keeps
 * the consecutive-fail streak for this window session.
 */
export class RunTracker {
  private lastCode: number | null = null;
  private lastAt = -Infinity;
  private streak = 0;
  constructor(private readonly dedupeMs: number) {}

  record(exitCode: number | undefined, at: number): RunResult | null {
    if (exitCode === undefined) return null;
    if (exitCode === this.lastCode && at - this.lastAt < this.dedupeMs) return null;
    this.lastCode = exitCode;
    this.lastAt = at;
    if (exitCode === 0) {
      this.streak = 0;
      return { type: 'runPass' };
    }
    this.streak += 1;
    return { type: 'runFail', streak: this.streak };
  }
}
