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
    if (exitCode === 130 || exitCode === 143) return null; // Ctrl+C / SIGTERM: interrupted, not failed
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

const RUN_COMMANDS = new Set([
  'npm', 'pnpm', 'yarn', 'bun', 'npx', 'node', 'deno', 'tsx', 'ts-node', 'python', 'python3', 'py', 'pytest',
  'cargo', 'go', 'make', 'dotnet', 'mvn', 'gradle', 'gradlew', './gradlew', 'jest', 'vitest', 'mocha', 'rspec',
  'rake', 'bundle', 'php', 'composer', 'swift', 'flutter', 'dart', 'mix', 'elixir', 'ruby', 'java', 'javac',
  'gcc', 'g++', 'clang', 'cmake', 'ctest', 'tox', 'nox', 'uv', 'poetry', 'pipenv',
]);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Is this terminal command line a build/test/run of the user's project ('run'), or housekeeping
 * like cd/ls/git ('ignore')? Looks only at the first token after leading FOO=1 assignments.
 */
export function classifyCommandLine(cmd: string): 'run' | 'ignore' {
  const tokens = cmd.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length && ENV_ASSIGNMENT.test(tokens[i])) i += 1;
  const first = (tokens[i] ?? '').toLowerCase();
  return RUN_COMMANDS.has(first) ? 'run' : 'ignore';
}
