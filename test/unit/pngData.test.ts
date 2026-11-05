import { describe, it, expect } from 'vitest';
import { decodePngDataUrl } from '../../src/ui/pngData';

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const good = 'data:image/png;base64,' + sig.toString('base64');

describe('decodePngDataUrl', () => {
  it('decodes a PNG data URL to its bytes', () => {
    expect(Array.from(decodePngDataUrl(good)!)).toEqual(Array.from(sig));
  });
  it('rejects wrong prefix, non-strings, bad base64 and non-PNG bytes', () => {
    expect(decodePngDataUrl('data:image/jpeg;base64,' + sig.toString('base64'))).toBeNull();
    expect(decodePngDataUrl('file:///etc/passwd')).toBeNull();
    expect(decodePngDataUrl(42)).toBeNull();
    expect(decodePngDataUrl('data:image/png;base64,')).toBeNull();
    expect(decodePngDataUrl('data:image/png;base64,@@@')).toBeNull();
    expect(decodePngDataUrl('data:image/png;base64,' + Buffer.from('not a png at all').toString('base64'))).toBeNull();
  });
});
