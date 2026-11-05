import { describe, it, expect } from 'vitest';
import { coerceSurface } from '../../src/surface';

describe('coerceSurface', () => {
  it('keeps panel and toasts', () => {
    expect(coerceSurface('panel')).toBe('panel');
    expect(coerceSurface('toasts')).toBe('toasts');
  });
  it.each(['statusbar', 'nope', '', undefined, null, 3])('maps %j to panel', (v) => {
    expect(coerceSurface(v)).toBe('panel');
  });
});
