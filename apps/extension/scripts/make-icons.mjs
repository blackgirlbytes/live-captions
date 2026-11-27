// Generates public/icon/{16,32,48,128}.png: amber rounded square with two caption lines.
// Dependency-free (zlib PNG encoder + 4x4 supersampling). Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icon");
const AMBER = [0xf5, 0xb8, 0x3d];
const INK = [0x1d, 0x14, 0x04];

// Shapes in a 32×32 design space (matches components/Logo.tsx).
const roundRect = (x, y, w, h, r) => (px, py) => {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r && px >= x && px <= x + w && py >= y && py <= y + h;
};
const tile = roundRect(1, 1, 30, 30, 8);
const line1 = roundRect(7, 13, 18, 3.2, 1.6);
const line2 = roundRect(10, 19, 12, 3.2, 1.6);

function render(size) {
  const ss = 4;
  const designSize = size === 128 ? 40 : 32;
  const inset = (designSize - 32) / 2;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size) * designSize - inset;
          const v = ((y + (sy + 0.5) / ss) / size) * designSize - inset;
          if (!tile(u, v)) continue;
          const c = line1(u, v) ? INK : line2(u, v) ? INK.map((n, i) => Math.round(n * 0.75 + AMBER[i] * 0.25)) : AMBER;
          a += 1; r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * size + x) * 4;
      if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; px[i + 3] = Math.round((a / (ss * ss)) * 255); }
    }
  }
  return png(size, px);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = -1; for (const byte of body) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
  const crc = Buffer.alloc(4); crc.writeInt32BE(~c);
  return Buffer.concat([len, body, crc]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(join(OUT, `${size}.png`), render(size));
console.log(`Wrote icons to ${OUT}`);
