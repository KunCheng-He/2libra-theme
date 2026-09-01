/**
 * 生成扩展图标（16/48/128）—— 纯 Node 无依赖 PNG 编码。
 * 设计：圆角蓝色底 + 白色对话气泡 + 三点，仿 IM 风格。
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 覆盖式画像素，带 2x 超采样抗锯齿 */
function makeIcon(size) {
  const S = 4; // supersample
  const W = size * S;
  const buf = Buffer.alloc(W * W * 4);

  const put = (x, y, r, g, b, a) => {
    const i = (y * W + x) * 4;
    const sa = a / 255;
    const da = buf[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / oa);
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / oa);
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / oa);
    buf[i + 3] = Math.round(oa * 255);
  };

  const inRoundedRect = (x, y, x0, y0, x1, y1, rad) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + rad), x1 - rad);
    const cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2 || (x >= x0 + rad && x <= x1 - rad) || (y >= y0 + rad && y <= y1 - rad);
  };

  // 背景：圆角方块 渐变 #0A84FF → #0068E5
  const m = W * 0.04; // margin
  const rad = W * 0.22;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (inRoundedRect(x, y, m, m, W - m, W - m, rad)) {
        const t = (x + y) / (2 * W);
        const r = Math.round(10 + (0 - 10) * t);
        const g = Math.round(132 + (104 - 132) * t);
        const b = Math.round(255 + (229 - 255) * t);
        put(x, y, r, g, b, 255);
      }
    }
  }

  // 白色对话气泡（圆形矩形 + 左下尾巴）
  const bx0 = W * 0.22, by0 = W * 0.26, bx1 = W * 0.78, by1 = W * 0.62, brad = W * 0.1;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let hit = inRoundedRect(x, y, bx0, by0, bx1, by1, brad);
      if (!hit) {
        // 尾巴：三角 (bx0+0.04W, by1) → (bx0+0.04W, by1+0.14W) → (bx0+0.20W, by1)
        const x1 = bx0 + W * 0.05, y1 = by1 + W * 0.15, x2 = bx0 + W * 0.22, y2 = by1;
        const d1 = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
        if (y >= by1 - 1 && y <= y1 + 1 && x >= x1 - 1 && d1 <= 0) hit = true;
      }
      if (hit) put(x, y, 255, 255, 255, 255);
    }
  }

  // 三个点（蓝色）
  const cy = (by0 + by1) / 2;
  const dotR = W * 0.035;
  for (const dx of [0.34, 0.5, 0.66]) {
    const cx = W * dx;
    const x0 = Math.floor(cx - dotR), x1 = Math.ceil(cx + dotR);
    const y0 = Math.floor(cy - dotR), y1 = Math.ceil(cy + dotR);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= dotR ** 2) put(x, y, 10, 132, 255, 255);
  }

  // 超采样降采样
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const i = ((y * S + sy) * W + x * S + sx) * 4;
          r += buf[i] * buf[i + 3];
          g += buf[i + 1] * buf[i + 3];
          b += buf[i + 2] * buf[i + 3];
          a += buf[i + 3];
        }
      const n = S * S;
      const ao = a / n / 255;
      const i2 = (y * size + x) * 4;
      out[i2] = ao > 0 ? Math.round(r / a * 255) : 0;
      out[i2 + 1] = ao > 0 ? Math.round(g / a * 255) : 0;
      out[i2 + 2] = ao > 0 ? Math.round(b / a * 255) : 0;
      out[i2 + 3] = Math.round(a / n);
    }
  }
  return encodePNG(out, size, size);
}

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icons/icon-${size}.png`);
}
