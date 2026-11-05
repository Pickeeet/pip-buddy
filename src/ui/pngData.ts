const PREFIX = 'data:image/png;base64,';
const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decodes a PNG data URL; null unless it has the exact prefix, valid base64 and the PNG signature. */
export function decodePngDataUrl(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PREFIX)) return null;
  const b64 = dataUrl.slice(PREFIX.length);
  if (b64.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length < MAGIC.length || !MAGIC.every((b, i) => bytes[i] === b)) return null;
  return new Uint8Array(bytes);
}
