// Generates the PWA icons with zero dependencies (Node's zlib only).
// Run: node tools/gen-icons.mjs   -> writes icon-192.png, icon-512.png, apple-touch-icon.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0xe7, 0x55, 0x2d, 0xff];   // paprika
const FG = [0xff, 0xff, 0xff, 0xff];   // white utensils

function canvas(n) {
  const px = Buffer.alloc(n * n * 4);
  for (let i = 0; i < n * n; i++) px.set(BG, i * 4);
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    px.set(c, (y * n + x) * 4);
  };
  const rrect = (x0, y0, w, h, r, c) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0;
      if (x < r) dx = r - x; else if (x > w - 1 - r) dx = x - (w - 1 - r);
      if (y < r) dy = r - y; else if (y > h - 1 - r) dy = y - (h - 1 - r);
      if (dx * dx + dy * dy <= r * r) set(x0 + x, y0 + y, c);
    }
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) set(cx + x, cy + y, c);
  };
  return { n, px, rrect, ellipse };
}

function drawUtensils(cv) {
  const n = cv.n, u = n / 100;
  // fork (left)
  const fx = 38 * u;
  for (let i = -1; i <= 1; i++) cv.rrect(fx + i * 6 * u - 1.6 * u, 20 * u, 3.2 * u, 20 * u, 1.5 * u, FG);
  cv.rrect(fx - 7.6 * u, 37 * u, 15.2 * u, 7 * u, 3 * u, FG);
  cv.rrect(fx - 2.6 * u, 40 * u, 5.2 * u, 40 * u, 2.6 * u, FG);
  // spoon (right)
  const sx = 63 * u;
  cv.ellipse(sx, 31 * u, 9 * u, 12 * u, FG);
  cv.rrect(sx - 2.6 * u, 40 * u, 5.2 * u, 40 * u, 2.6 * u, FG);
}

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(n, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    raw[y * (n * 4 + 1)] = 0;
    px.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const cv = canvas(size);
  drawUtensils(cv);
  writeFileSync(new URL('../' + name, import.meta.url), png(size, cv.px));
  console.log('wrote', name, size + 'x' + size);
}
