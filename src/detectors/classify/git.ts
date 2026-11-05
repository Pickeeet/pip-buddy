const LAZY = /^(fix|wip|asdf+|update|changes|stuff|\.+|final)$/i;
export const MSG_MAX = 60;
/** A HEAD change whose commit is older than this is a checkout/pull, not a commit just made. */
export const FRESH_COMMIT_MS = 120_000;

export function classifyCommit(msg: string): 'commitLazy' | 'commitGood' {
  const m = msg.trim();
  return m.length < 8 || LAZY.test(m) ? 'commitLazy' : 'commitGood';
}

/** First line of a commit message, at most 60 chars. */
export function firstLine(msg: string): string {
  return msg.split(/\r?\n/, 1)[0].slice(0, MSG_MAX);
}

/** Undated commits count as fresh; old ones (branch switches, pulls) do not. */
export function isFreshCommit(commitDate: Date | undefined, now: number): boolean {
  if (!commitDate) return true;
  return now - commitDate.getTime() <= FRESH_COMMIT_MS;
}

/**
 * Remembers the last HEAD sha per repository. changed() is true only when HEAD moves
 * to a new sha and the previous sha was known, so opening a repo never counts its existing HEAD.
 */
export class HeadTracker {
  private heads = new Map<string, string | undefined>();

  changed(repoKey: string, sha: string | undefined): boolean {
    const prev = this.heads.get(repoKey);
    this.heads.set(repoKey, sha);
    return prev !== undefined && sha !== undefined && sha !== prev;
  }
}
