import { describe, it, expect } from 'vitest';
import { classifyCommit, classifyMessage, firstLine, HeadTracker, isFreshCommit } from '../../src/detectors/classify/git';

describe('classifyCommit', () => {
  it('lazy messages', () => {
    for (const m of ['fix', 'WIP', 'asdfff', 'update', 'changes', 'stuff', '...', 'final', 'x', '  ok  ', '']) {
      expect(classifyCommit(m)).toBe('commitLazy');
    }
  });
  it('good messages', () => {
    expect(classifyCommit('Add cart totals rounding')).toBe('commitGood');
    expect(classifyCommit('fix cart rounding')).toBe('commitGood');
  });
});

describe('firstLine', () => {
  it('takes the first line and truncates to 60', () => {
    expect(firstLine('hello\n\nbody')).toBe('hello');
    expect(firstLine('x'.repeat(100))).toHaveLength(60);
    expect(firstLine('a\r\nb')).toBe('a');
    expect(firstLine('')).toBe('');
  });
});

describe('HeadTracker', () => {
  it('does not count the first sighting', () => {
    const h = new HeadTracker();
    expect(h.changed('r', 'aaa')).toBe(false);
  });
  it('counts a new sha after a known one, not repeats', () => {
    const h = new HeadTracker();
    h.changed('r', 'aaa');
    expect(h.changed('r', 'aaa')).toBe(false);
    expect(h.changed('r', 'bbb')).toBe(true);
    expect(h.changed('r', 'bbb')).toBe(false);
  });
  it('tracks repositories independently', () => {
    const h = new HeadTracker();
    h.changed('r1', 'a');
    expect(h.changed('r2', 'b')).toBe(false);
    expect(h.changed('r1', 'c')).toBe(true);
  });
  it('an unknown (undefined) previous HEAD never counts', () => {
    const h = new HeadTracker();
    h.changed('r', undefined);
    expect(h.changed('r', 'aaa')).toBe(false);
    expect(h.changed('r', 'bbb')).toBe(true);
  });
  it('HEAD going undefined does not count and is remembered', () => {
    const h = new HeadTracker();
    h.changed('r', 'a');
    expect(h.changed('r', undefined)).toBe(false);
  });
});

describe('isFreshCommit', () => {
  const now = 1_000_000_000_000;
  it('recent or undated commits are fresh, old ones (branch switch) are not', () => {
    expect(isFreshCommit(new Date(now - 5000), now)).toBe(true);
    expect(isFreshCommit(undefined, now)).toBe(true);
    expect(isFreshCommit(new Date(now - 3600_000), now)).toBe(false);
  });
});

describe('classifyMessage', () => {
  it('judges the first line only', () => {
    expect(classifyMessage('wip\n\nlong descriptive body about the change')).toBe('commitLazy');
    expect(classifyMessage('Add cart totals rounding\n\nbody')).toBe('commitGood');
  });
});
