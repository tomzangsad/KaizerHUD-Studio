import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

export function encodeRgbaPng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function readPngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('Not a valid PNG file');
  }
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
  };
}

function parseHex(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
    255,
  ];
}

function blendPx(buf, w, h, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  const al = Math.min(1, a);
  const da = buf[i + 3] / 255;
  const oa = al + da * (1 - al);
  if (oa <= 0) return;
  buf[i] = Math.round((r * al + buf[i] * da * (1 - al)) / oa);
  buf[i + 1] = Math.round((g * al + buf[i + 1] * da * (1 - al)) / oa);
  buf[i + 2] = Math.round((b * al + buf[i + 2] * da * (1 - al)) / oa);
  buf[i + 3] = Math.round(oa * 255);
}

/** Signed distance to a rounded rectangle centered at (cx, cy) with half-sizes (hx, hy) */
function sdRoundRect(px, py, cx, cy, hx, hy, rad) {
  const qx = Math.abs(px - cx) - (hx - rad);
  const qy = Math.abs(py - cy) - (hy - rad);
  const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inn = Math.min(Math.max(qx, qy), 0);
  return out + inn - rad;
}

/**
 * Generates clean RGBA artwork (panel, button, slot, stage) in pure Node without Chromium.
 */
export function generateArtPng(opts = {}) {
  const kind = ['panel', 'button', 'slot', 'stage'].includes(opts.kind) ? opts.kind : 'panel';
  const style = ['rpg', 'flat', 'pixel'].includes(opts.style) ? opts.style : 'rpg';
  const guiW = Math.max(8, Math.min(960, Math.round(Number(opts.w) || 120)));
  const guiH = Math.max(8, Math.min(960, Math.round(Number(opts.h) || 60)));
  const detail = [1, 2, 4].includes(Number(opts.detail))
    ? Number(opts.detail)
    : (style === 'rpg' ? 2 : 1);

  const W = guiW * detail;
  const H = guiH * detail;
  const buf = Buffer.alloc(W * H * 4);

  const primary = parseHex(opts.primary_color || opts.primaryColor, [48, 125, 220, 255]);
  const accent = parseHex(opts.accent_color || opts.accentColor, [242, 200, 108, 255]);
  const bgTop = parseHex(opts.bg_top || opts.bgTop, style === 'rpg' ? [22, 32, 58, 255] : [18, 22, 32, 255]);
  const bgBot = parseHex(opts.bg_bot || opts.bgBot, style === 'rpg' ? [9, 13, 24, 255] : [12, 15, 22, 255]);
  const hover = !!opts.hover;

  if (style === 'pixel') {
    const borderDark = [12, 14, 20, 255];
    const rimLight = hover ? accent : mixRgb(primary, [255, 255, 255, 255], 0.35);
    const rimDark = mixRgb(primary, [0, 0, 0, 255], 0.45);
    const body = kind === 'button'
      ? (hover ? mixRgb(primary, [255, 255, 255, 255], 0.18) : primary)
      : kind === 'slot'
        ? mixRgb(bgBot, [255, 255, 255, 255], 0.08)
        : bgTop;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
          blendPx(buf, W, H, x, y, borderDark[0], borderDark[1], borderDark[2], 1);
        } else if (x === 1 || y === 1) {
          blendPx(buf, W, H, x, y, rimLight[0], rimLight[1], rimLight[2], 1);
        } else if (x === W - 2 || y === H - 2) {
          blendPx(buf, W, H, x, y, rimDark[0], rimDark[1], rimDark[2], 1);
        } else {
          blendPx(buf, W, H, x, y, body[0], body[1], body[2], 1);
        }
      }
    }
    const png = encodeRgbaPng(buf, W, H);
    return {
      w: guiW, h: guiH, texW: W, texH: H, detail,
      dataUrl: 'data:image/png;base64,' + png.toString('base64'),
      buffer: png,
    };
  }

  // Smooth Anti-aliased (RPG or Flat)
  const pad = style === 'rpg' ? Math.max(1, detail) : 0;
  const cx = (W - pad) * 0.5;
  const cy = (H - pad) * 0.5;
  const hx = Math.max(2, (W - pad * 2) * 0.5);
  const hy = Math.max(2, (H - pad * 2) * 0.5);
  const rad = style === 'flat' ? 2 * detail : Math.min(8 * detail, Math.min(hx, hy) * 0.45);
  const borderW = style === 'flat' ? 1 * detail : 1.8 * detail;

  const topCol = kind === 'button'
    ? (hover ? mixRgb(primary, [255, 255, 255, 255], 0.25) : mixRgb(primary, [255, 255, 255, 255], 0.1))
    : kind === 'slot'
      ? mixRgb(bgTop, [255, 255, 255, 255], 0.14)
      : bgTop;
  const botCol = kind === 'button'
    ? (hover ? primary : mixRgb(primary, [0, 0, 0, 255], 0.35))
    : bgBot;
  const rimColTop = hover ? accent : (kind === 'slot' ? mixRgb(primary, [255, 255, 255, 255], 0.3) : accent);
  const rimColBot = mixRgb(rimColTop, bgBot, 0.55);

  for (let y = 0; y < H; y++) {
    const ty = y / Math.max(1, H - 1);
    for (let x = 0; x < W; x++) {
      if (style === 'rpg') {
        const sdSh = sdRoundRect(x + 0.5, y + 0.5, cx + detail, cy + detail * 1.2, hx, hy, rad);
        if (sdSh < 1.5) {
          const sa = Math.max(0, Math.min(1, 1 - sdSh / 1.5)) * 0.38;
          blendPx(buf, W, H, x, y, 0, 0, 0, sa);
        }
      }

      const sd = sdRoundRect(x + 0.5, y + 0.5, cx, cy, hx, hy, rad);
      if (sd > 0.75) continue;
      const cov = Math.max(0, Math.min(1, 0.75 - sd));

      let col = mixRgb(topCol, botCol, ty);

      // Ambient top/center glow for panel and stage
      if (kind === 'stage' || (kind === 'panel' && style === 'rpg')) {
        const gx = (x - cx) / Math.max(1, hx);
        const gy = kind === 'stage' ? (y - cy * 0.9) / Math.max(1, hy) : (y - H * 0.18) / Math.max(1, H * 0.55);
        const d = Math.hypot(gx, gy);
        if (d < 1) {
          const glowAmt = Math.pow(1 - d, 2) * (kind === 'stage' ? 0.32 : 0.16);
          col = mixRgb(col, accent, glowAmt);
        }
      }

      // Pedestal shadow at bottom of stage
      if (kind === 'stage') {
        const ex = (x - cx) / Math.max(1, hx * 0.68);
        const ey = (y - (H - 8 * detail)) / Math.max(1, 3.2 * detail);
        const ed = Math.hypot(ex, ey);
        if (ed < 1) col = mixRgb(col, [0, 0, 0, 255], (1 - ed) * 0.45);
      }

      // Metallic / crisp border
      if (sd > -borderW) {
        col = mixRgb(rimColTop, rimColBot, ty);
      } else if (sd > -borderW - detail && y < H * 0.35) {
        // subtle inner specular highlight
        col = mixRgb(col, [255, 255, 255, 255], 0.18);
      }

      blendPx(buf, W, H, x, y, col[0], col[1], col[2], cov);
    }
  }

  const png = encodeRgbaPng(buf, W, H);
  return {
    w: guiW, h: guiH, texW: W, texH: H, detail,
    dataUrl: 'data:image/png;base64,' + png.toString('base64'),
    buffer: png,
  };
}
