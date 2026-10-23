// สร้างไอคอน PWA (PNG) โดยไม่ต้องพึ่งไลบรารีภายนอก — รันด้วย `npm run icons`
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const d = Math.hypot(x - c, y - c) / size;
      let [r, g, b] = [10, 10, 15];
      if (d < 0.34) {
        const t = (x + y) / (2 * size);
        r = Math.round(167 + (99 - 167) * t);
        g = Math.round(139 + (102 - 139) * t);
        b = Math.round(250 + (241 - 250) * t);
        if (d > 0.22 && d < 0.25) [r, g, b] = [235, 230, 255];
        if (d < 0.07) [r, g, b] = [245, 243, 255];
      }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/pwa-192.png', icon(192));
writeFileSync('public/pwa-512.png', icon(512));
writeFileSync('public/apple-touch-icon.png', icon(180));
console.log('icons generated');
