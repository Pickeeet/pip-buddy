import { describe, it, expect } from 'vitest';
import { classifyCommandLine, RunTracker } from '../../src/detectors/classify/runs';

describe('classifyCommandLine', () => {
  it.each(['ls', 'ls -la', 'cd src', 'git status', 'grep -r foo .', 'cat x.txt', 'echo hi', '', '   '])(
    'ignores %j', (cmd) => { expect(classifyCommandLine(cmd)).toBe('ignore'); });

  it.each([
    'npm test', 'pytest -q', 'FOO=1 node x.js', './gradlew build', 'FOO=1 BAR=two npx vitest',
    'pnpm exec jest', 'yarn test', 'cargo test', 'go test ./...', 'python3 main.py', 'uv run pytest',
    '  make   all', 'dotnet test', 'g++ a.cpp', 'bundle exec rspec',
  ])('runs %j', (cmd) => { expect(classifyCommandLine(cmd)).toBe('run'); });

  it('only env assignments is not a run', () => {
    expect(classifyCommandLine('FOO=1')).toBe('ignore');
  });
  it('does not match on a prefix of a longer word', () => {
    expect(classifyCommandLine('npmx foo')).toBe('ignore');
    expect(classifyCommandLine('gomoku')).toBe('ignore');
  });
});

describe('RunTracker exit codes', () => {
  it('ignores 130 (Ctrl+C) and 143 (SIGTERM) without touching the streak', () => {
    const t = new RunTracker(1000);
    expect(t.record(130, 0)).toBeNull();
    expect(t.record(143, 5000)).toBeNull();
    expect(t.record(1, 10_000)).toEqual({ type: 'runFail', streak: 1 });
  });
});
