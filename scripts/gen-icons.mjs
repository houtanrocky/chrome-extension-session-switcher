/**
 * Generates the extension's toolbar icons with zero image dependencies.
 *
 * The mark is three overlapping "account" circles — the same colored-dot motif
 * the popup uses for each session — with a transparent moat carved between them
 * so they stay legible on both light and dark toolbars. Shapes are drawn 4×
 * supersampled and downsampled in premultiplied space for clean anti-aliasing,
 * then encoded as RGBA PNGs by hand (IHDR/IDAT/IEND + CRC32, zlib for IDAT).
 *
 *   node scripts/gen-icons.mjs   →   public/icon/{16,32,48,96,128}.png
 */
import zlib from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZES = [16, 32, 48, 96, 128];
const SS = 4; // supersampling factor

// Three circles in a 0..100 design space. Front-most is drawn last; the accent
// blue matches the UI's primary session color.
const R = 27;
const MOAT = 4.5; // transparent gap carved around each newer circle
const CIRCLES = [
  { cx: 50, cy: 34, rgb: [0x5c, 0xd0, 0xff] }, // cyan  (back / top)
  { cx: 34, cy: 64, rgb: [0xc9, 0x8c, 0xff] }, // purple (bottom-left)
  { cx: 66, cy: 64, rgb: [0x6c, 0x8c, 0xff] }, // accent blue (front)
];

/** Render one size to a straight-alpha RGBA Uint8Array. */
function render(size) {
  const W = size * SS;
  const scale = W / 100;
  // Premultiplied accumulation buffer (opaque draws => premul == straight).
  const buf = new Float32Array(W * W * 4); // r,g,b,a all premultiplied, a in 0..1

  const set = (i, r, g, b, a) => {
    buf[i] = r * a;
    buf[i + 1] = g * a;
    buf[i + 2] = b * a;
    buf[i + 3] = a;
  };

  for (let cIdx = 0; cIdx < CIRCLES.length; cIdx++) {
    const c = CIRCLES[cIdx];
    const cx = c.cx * scale;
    const cy = c.cy * scale;
    const rFill = R * scale;
    const rMoat = (R + MOAT) * scale;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        const i = (y * W + x) * 4;
        // Carve a transparent moat first (only for circles drawn over others).
        if (cIdx > 0 && d2 <= rMoat * rMoat) set(i, 0, 0, 0, 0);
        if (d2 <= rFill * rFill) set(i, c.rgb[0], c.rgb[1], c.rgb[2], 1);
      }
    }
  }

  // Downsample SS×SS blocks, un-premultiplying so edges keep full color.
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      const av = a / n;
      out[o] = av > 0 ? Math.round(r / a) : 0;     // r / (a) un-premultiplies
      out[o + 1] = av > 0 ? Math.round(g / a) : 0;
      out[o + 2] = av > 0 ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(av * 255);
    }
  }
  return out;
}

// ---- minimal PNG encoder --------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // deflate / adaptive filter / no interlace

  // Each scanline is prefixed with filter byte 0 (none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- main -----------------------------------------------------------------

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public', 'icon');
mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const rgba = render(size);
  const png = encodePng(size, size, rgba);
  const file = resolve(outDir, `${size}.png`);
  writeFileSync(file, png);
  console.log(`  public/icon/${size}.png  (${png.length} bytes)`);
}
console.log('Icons generated.');
