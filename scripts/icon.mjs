// Renders media/icon.png (128x128) from Pip's sprite grid. No dependencies: writes the PNG by hand.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';

const { spriteGrid } = createRequire(import.meta.url)('../media/sprite.js');
const SIZE = 128;
const SCALE = 8; // 16x12 sprite -> 128x96
const BG = [0x1b, 0x15, 0x30];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const grid = spriteGrid('side', 'flat', '#6EE7A8');
const top = (SIZE - grid.length * SCALE) / 2;

const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 3 + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const gy = Math.floor((y - top) / SCALE);
    const gx = Math.floor(x / SCALE);
    const cell = gy >= 0 && gy < grid.length ? grid[gy][gx] : 'transparent';
    const rgb = cell === 'transparent' ? BG : hex(cell);
    raw.set(rgb, row + 1 + x * 3);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

writeFileSync('media/icon.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote media/icon.png');
