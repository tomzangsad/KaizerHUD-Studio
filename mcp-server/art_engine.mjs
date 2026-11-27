import fs from 'node:fs';
import path from 'node:path';
import { encodeRgbaPng, readPngSize } from './png_gen.mjs';

function parseColor(input, fallback = null) {
  if (input == null || input === '' || input === 'transparent' || input === 'none') return fallback;
  if (Array.isArray(input) && input.length >= 3) {
    return [
      Math.max(0, Math.min(255, Math.round(Number(input[0]) || 0))),
      Math.max(0, Math.min(255, Math.round(Number(input[1]) || 0))),
      Math.max(0, Math.min(255, Math.round(Number(input[2]) || 0))),
      input.length >= 4 ? Math.max(0, Math.min(255, Math.round(Number(input[3]) || 255))) : 255,
    ];
  }
  const s = String(input).trim();
  const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (rgbMatch) {
    return [
      Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1])))),
      Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2])))),
      Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3])))),
      rgbMatch[4] != null ? Math.max(0, Math.min(255, Math.round(Number(rgbMatch[4]) * 255))) : 255,
    ];
  }
  const h = s.startsWith('#') ? s.slice(1) : s;
  if (/^[0-9a-f]{3}$/i.test(h)) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      255,
    ];
  }
  if (/^[0-9a-f]{4}$/i.test(h)) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      parseInt(h[3] + h[3], 16),
    ];
  }
  if (/^[0-9a-f]{6}$/i.test(h)) {
    const v = parseInt(h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
  }
  if (/^[0-9a-f]{8}$/i.test(h)) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      parseInt(h.slice(6, 8), 16),
    ];
  }
  return fallback;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgba(c1, c2, t) {
  const k = clamp(t, 0, 1);
  return [
    Math.round(lerp(c1[0], c2[0], k)),
    Math.round(lerp(c1[1], c2[1], k)),
    Math.round(lerp(c1[2], c2[2], k)),
    Math.round(lerp(c1[3], c2[3], k)),
  ];
}

function blendPixel(buf, w, h, x, y, r, g, b, a01) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= w || py >= h || a01 <= 0) return;
  const idx = (py * w + px) * 4;
  const sa = clamp(a01, 0, 1);
  const da = buf[idx + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[idx] = Math.round((r * sa + buf[idx] * da * (1 - sa)) / oa);
  buf[idx + 1] = Math.round((g * sa + buf[idx + 1] * da * (1 - sa)) / oa);
  buf[idx + 2] = Math.round((b * sa + buf[idx + 2] * da * (1 - sa)) / oa);
  buf[idx + 3] = Math.round(oa * 255);
}

function blendCol(buf, w, h, x, y, col, multA = 1) {
  if (!col) return;
  blendPixel(buf, w, h, x, y, col[0], col[1], col[2], (col[3] / 255) * multA);
}

function hash2d(x, y, seed = 1337) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function sdRoundRect(px, py, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const hx = w * 0.5;
  const hy = h * 0.5;
  const qx = Math.abs(px - cx) - (hx - rad);
  const qy = Math.abs(py - cy) - (hy - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

function sdChamferRect(px, py, x, y, w, h, cut) {
  const c = Math.max(0, Math.min(cut, w * 0.48, h * 0.48));
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const dx = Math.abs(px - cx) - w * 0.5;
  const dy = Math.abs(py - cy) - h * 0.5;
  const dChamfer = (Math.abs(px - cx) + Math.abs(py - cy) - (w * 0.5 + h * 0.5 - c)) * Math.SQRT1_2;
  return Math.max(dx, dy, dChamfer);
}

function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawSegment(buf, w, h, x1, y1, x2, y2, col, thickness = 1) {
  if (!col) return;
  const half = Math.max(0.5, thickness * 0.5);
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - half - 1));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - half - 1));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + half + 1));
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy || 1e-9;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = clamp(((x + 0.5 - x1) * vx + (y + 0.5 - y1) * vy) / lenSq, 0, 1);
      const d = Math.hypot(x + 0.5 - (x1 + vx * t), y + 0.5 - (y1 + vy * t));
      if (d < half + 0.5) {
        const cov = clamp(half + 0.5 - d, 0, 1);
        blendCol(buf, w, h, x, y, col, cov);
      }
    }
  }
}

function renderPixelGrid(palette = {}, grid = [], opts = {}) {
  if (!Array.isArray(grid) || !grid.length) {
    throw new Error('grid must be a non-empty array of strings');
  }
  let rows = grid.map((r) => String(r));
  let gw = Math.max(...rows.map((r) => r.length));
  if (gw < 1) throw new Error('grid rows cannot be empty');
  rows = rows.map((r) => r.padEnd(gw, '.'));

  if (opts.mirror_x) {
    rows = rows.map((r) => r + [...r].reverse().join(''));
    gw *= 2;
  }
  if (opts.mirror_y) {
    rows = rows.concat([...rows].reverse());
  }
  const gh = rows.length;

  const parsedPalette = {};
  for (const [k, v] of Object.entries(palette || {})) {
    parsedPalette[k] = parseColor(v, null);
  }

  // Raw base pixel buffer
  const base = Array.from({ length: gh }, (_, y) =>
    Array.from({ length: gw }, (_, x) => parsedPalette[rows[y][x]] || null)
  );

  // Optional 1px 4-neighbor auto outline
  const outlineCol = parseColor(opts.outline_color, null);
  if (outlineCol) {
    const out = base.map((row) => row.slice());
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (base[y][x]) continue;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && base[ny][nx]) {
            out[y][x] = outlineCol;
            break;
          }
        }
      }
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) base[y][x] = out[y][x];
    }
  }

  const scale = Math.max(1, Math.min(16, Math.round(Number(opts.scale) || 1)));
  const W = gw * scale;
  const H = gh * scale;
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const col = base[y][x];
      if (!col) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = x * scale + sx;
          const py = y * scale + sy;
          const idx = (py * W + px) * 4;
          rgba[idx] = col[0];
          rgba[idx + 1] = col[1];
          rgba[idx + 2] = col[2];
          rgba[idx + 3] = col[3];
        }
      }
    }
  }
  return { rgba, width: W, height: H };
}

export function drawPixelArt({
  palette = {},
  grid = [],
  scale = 1,
  mirror_x = false,
  mirror_y = false,
  outline_color = null,
} = {}) {
  const { rgba, width, height } = renderPixelGrid(palette, grid, { scale, mirror_x, mirror_y, outline_color });
  const png = encodeRgbaPng(rgba, width, height);
  return {
    width,
    height,
    bytes: png.length,
    dataUrl: 'data:image/png;base64,' + png.toString('base64'),
  };
}

function renderLayerInto(buf, W, H, layer) {
  if (!layer || typeof layer !== 'object') return;
  const type = String(layer.type || 'rect').toLowerCase();
  const x0 = Number(layer.x) || 0;
  const y0 = Number(layer.y) || 0;
  const lw = layer.w != null ? Number(layer.w) : W - x0;
  const lh = layer.h != null ? Number(layer.h) : H - y0;
  const alphaMult = layer.alpha != null ? clamp(Number(layer.alpha), 0, 1) : 1;

  if (type === 'rect') {
    const fill = parseColor(layer.color, null);
    const border = parseColor(layer.border_color, null);
    const bw = Math.max(0, Number(layer.border_width) || (border ? 1 : 0));
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(W - 1, Math.ceil(x0 + lw) - 1);
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(H - 1, Math.ceil(y0 + lh) - 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const isBorder = border && bw > 0 && (x - minX < bw || maxX - x < bw || y - minY < bw || maxY - y < bw);
        if (isBorder) blendCol(buf, W, H, x, y, border, alphaMult);
        else if (fill) blendCol(buf, W, H, x, y, fill, alphaMult);
      }
    }
    return;
  }

  if (type === 'rounded_rect' || type === 'chamfer_rect') {
    const fill = parseColor(layer.color, null);
    const border = parseColor(layer.border_color, null);
    const bw = Math.max(0, Number(layer.border_width) || (border ? 1.5 : 0));
    const r = Number(layer.radius != null ? layer.radius : layer.cut) || 6;
    const minX = Math.max(0, Math.floor(x0 - 1));
    const maxX = Math.min(W - 1, Math.ceil(x0 + lw + 1));
    const minY = Math.max(0, Math.floor(y0 - 1));
    const maxY = Math.min(H - 1, Math.ceil(y0 + lh + 1));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sd = type === 'chamfer_rect'
          ? sdChamferRect(x + 0.5, y + 0.5, x0, y0, lw, lh, r)
          : sdRoundRect(x + 0.5, y + 0.5, x0, y0, lw, lh, r);
        if (sd > 0.75) continue;
        const cov = clamp(0.75 - sd, 0, 1) * alphaMult;
        if (border && bw > 0 && sd > -bw) {
          blendCol(buf, W, H, x, y, border, cov);
        } else if (fill) {
          blendCol(buf, W, H, x, y, fill, cov);
        }
      }
    }
    return;
  }

  if (type === 'linear_gradient') {
    const c1 = parseColor(layer.from, [30, 40, 70, 255]);
    const c2 = parseColor(layer.to, [10, 14, 24, 255]);
    const dir = String(layer.direction || 'vertical').toLowerCase();
    const cut = Number(layer.cut) || 0;
    const rad = Number(layer.radius) || 0;
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(W - 1, Math.ceil(x0 + lw) - 1);
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(H - 1, Math.ceil(y0 + lh) - 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let cov = alphaMult;
        if (cut > 0 || rad > 0) {
          const sd = cut > 0
            ? sdChamferRect(x + 0.5, y + 0.5, x0, y0, lw, lh, cut)
            : sdRoundRect(x + 0.5, y + 0.5, x0, y0, lw, lh, rad);
          if (sd > 0.75) continue;
          cov *= clamp(0.75 - sd, 0, 1);
        }
        const tx = (x - x0) / Math.max(1, lw - 1);
        const ty = (y - y0) / Math.max(1, lh - 1);
        const t = dir === 'horizontal' ? tx : dir === 'diagonal' ? (tx + ty) * 0.5 : ty;
        blendCol(buf, W, H, x, y, mixRgba(c1, c2, t), cov);
      }
    }
    return;
  }

  if (type === 'radial_glow') {
    const col = parseColor(layer.color, [58, 142, 230, 255]);
    const cx = layer.cx != null ? Number(layer.cx) : W * 0.5;
    const cy = layer.cy != null ? Number(layer.cy) : H * 0.5;
    const r = Math.max(1, Number(layer.r) || Math.min(W, H) * 0.5);
    const intensity = clamp(Number(layer.intensity != null ? layer.intensity : 0.45), 0, 1) * alphaMult;
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(W - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d >= 1) continue;
        const amt = Math.pow(1 - d, 2) * intensity;
        blendCol(buf, W, H, x, y, col, amt);
      }
    }
    return;
  }

  if (type === 'circle' || type === 'ring') {
    const col = parseColor(layer.color, [255, 255, 255, 255]);
    const border = parseColor(layer.border_color, null);
    const cx = layer.cx != null ? Number(layer.cx) : W * 0.5;
    const cy = layer.cy != null ? Number(layer.cy) : H * 0.5;
    const r = Math.max(1, Number(layer.r) || 12);
    const thick = Math.max(1, Number(layer.thickness) || 2);
    const minX = Math.max(0, Math.floor(cx - r - 2));
    const maxX = Math.min(W - 1, Math.ceil(cx + r + 2));
    const minY = Math.max(0, Math.floor(cy - r - 2));
    const maxY = Math.min(H - 1, Math.ceil(cy + r + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (type === 'ring') {
          const dist = Math.abs(d - r);
          if (dist < thick * 0.5 + 0.75) {
            blendCol(buf, W, H, x, y, col, clamp(thick * 0.5 + 0.75 - dist, 0, 1) * alphaMult);
          }
        } else if (d < r + 0.75) {
          const cov = clamp(r + 0.75 - d, 0, 1) * alphaMult;
          if (border && d > r - (Number(layer.border_width) || 1.5)) blendCol(buf, W, H, x, y, border, cov);
          else blendCol(buf, W, H, x, y, col, cov);
        }
      }
    }
    return;
  }

  if (type === 'line') {
    const col = parseColor(layer.color, [255, 255, 255, 255]);
    drawSegment(buf, W, H, Number(layer.x1) || 0, Number(layer.y1) || 0, Number(layer.x2) || W, Number(layer.y2) || 0, col, Number(layer.thickness) || 1.5);
    return;
  }

  if (type === 'polygon' && Array.isArray(layer.points) && layer.points.length >= 3) {
    const pts = layer.points.map((p) => [Number(p[0]) || 0, Number(p[1]) || 0]);
    const fill = parseColor(layer.color, null);
    const border = parseColor(layer.border_color, null);
    const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - 1));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0])) + 1));
    const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - 1));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1])) + 1));
    if (fill) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (pointInPolygon(x + 0.5, y + 0.5, pts)) blendCol(buf, W, H, x, y, fill, alphaMult);
        }
      }
    }
    if (border) {
      const bw = Number(layer.border_width) || 1.5;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        drawSegment(buf, W, H, a[0], a[1], b[0], b[1], border, bw);
      }
    }
    return;
  }

  if (type === 'border') {
    const style = String(layer.style || 'solid').toLowerCase();
    const col = parseColor(layer.color, [120, 130, 160, 255]);
    const hi = parseColor(layer.highlight, [255, 255, 255, 160]);
    const sh = parseColor(layer.shadow, [0, 0, 0, 180]);
    const acc = parseColor(layer.accent, [242, 200, 108, 255]);
    const t = Math.max(1, Math.round(Number(layer.thickness) || 1));
    const x1 = Math.max(0, Math.floor(x0));
    const y1 = Math.max(0, Math.floor(y0));
    const x2 = Math.min(W - 1, Math.floor(x0 + lw - 1));
    const y2 = Math.min(H - 1, Math.floor(y0 + lh - 1));

    const drawBox = (bx1, by1, bx2, by2, cTop, cBot) => {
      for (let x = bx1; x <= bx2; x++) {
        blendCol(buf, W, H, x, by1, cTop, alphaMult);
        blendCol(buf, W, H, x, by2, cBot, alphaMult);
      }
      for (let y = by1; y <= by2; y++) {
        blendCol(buf, W, H, bx1, y, cTop, alphaMult);
        blendCol(buf, W, H, bx2, y, cBot, alphaMult);
      }
    };

    if (style === 'bevel') {
      drawBox(x1, y1, x2, y2, sh, sh);
      drawBox(x1 + 1, y1 + 1, x2 - 1, y2 - 1, hi, mixRgba(col, [0, 0, 0, 255], 0.4));
    } else if (style === 'double') {
      for (let k = 0; k < t; k++) drawBox(x1 + k, y1 + k, x2 - k, y2 - k, col, col);
      drawBox(x1 + t + 2, y1 + t + 2, x2 - t - 2, y2 - t - 2, acc, acc);
    } else if (style === 'cyber_brackets') {
      const arm = Math.max(4, Math.min(18, Math.round(Math.min(lw, lh) * 0.25)));
      drawBox(x1, y1, x2, y2, [col[0], col[1], col[2], Math.round(col[3] * 0.4)], [col[0], col[1], col[2], Math.round(col[3] * 0.4)]);
      const corners = [
        [x1, y1, 1, 1], [x2, y1, -1, 1],
        [x1, y2, 1, -1], [x2, y2, -1, -1],
      ];
      for (const [cx, cy, dx, dy] of corners) {
        for (let k = 0; k < arm; k++) {
          for (let w = 0; w < t; w++) {
            blendCol(buf, W, H, cx + dx * k, cy + dy * w, acc, alphaMult);
            blendCol(buf, W, H, cx + dx * w, cy + dy * k, acc, alphaMult);
          }
        }
      }
    } else if (style === 'ornate_corners') {
      drawBox(x1, y1, x2, y2, col, col);
      drawBox(x1 + 2, y1 + 2, x2 - 2, y2 - 2, sh, sh);
      const pts = [[x1 + 2, y1 + 2], [x2 - 2, y1 + 2], [x1 + 2, y2 - 2], [x2 - 2, y2 - 2]];
      for (const [cx, cy] of pts) {
        renderLayerInto(buf, W, H, { type: 'circle', cx, cy, r: 2.5, color: layer.accent || '#f2c86c' });
      }
    } else {
      for (let k = 0; k < t; k++) drawBox(x1 + k, y1 + k, x2 - k, y2 - k, col, col);
    }
    return;
  }

  if (type === 'scanlines') {
    const col = parseColor(layer.color, [255, 255, 255, 255]);
    const step = Math.max(2, Math.round(Number(layer.step) || 2));
    const a = clamp(Number(layer.alpha != null ? layer.alpha : 0.08), 0, 1);
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(W - 1, Math.ceil(x0 + lw) - 1);
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(H - 1, Math.ceil(y0 + lh) - 1);
    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x++) {
        blendCol(buf, W, H, x, y, col, a);
      }
    }
    return;
  }

  if (type === 'texture_noise') {
    const base = parseColor(layer.base_color, [45, 45, 52, 255]);
    const strength = clamp(Number(layer.strength != null ? layer.strength : 0.14), 0, 0.5);
    const style = String(layer.style || 'stone').toLowerCase();
    const seed = Number(layer.seed) || 42;
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(W - 1, Math.ceil(x0 + lw) - 1);
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(H - 1, Math.ceil(y0 + lh) - 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const nx = style === 'wood' ? Math.floor(x / 6) : style === 'parchment' ? Math.floor(x / 2) : x;
        const ny = style === 'metal' ? Math.floor(y / 3) : y;
        const n = (hash2d(nx, ny, seed) - 0.5) * 2 * strength;
        const c = [
          clamp(Math.round(base[0] * (1 + n)), 0, 255),
          clamp(Math.round(base[1] * (1 + n)), 0, 255),
          clamp(Math.round(base[2] * (1 + n)), 0, 255),
          base[3],
        ];
        blendCol(buf, W, H, x, y, c, alphaMult);
      }
    }
    return;
  }

  if ((type === 'gems' || type === 'rivets') && Array.isArray(layer.positions)) {
    const col = parseColor(layer.color, type === 'gems' ? [65, 215, 255, 255] : [170, 175, 190, 255]);
    const shine = parseColor(layer.shine_color, [255, 255, 255, 220]);
    const r = Math.max(1, Number(layer.radius) || 2.5);
    for (const pos of layer.positions) {
      const cx = Number(pos[0]) || 0;
      const cy = Number(pos[1]) || 0;
      renderLayerInto(buf, W, H, { type: 'circle', cx, cy, r, color: col, border_color: [0, 0, 0, 160], border_width: 1 });
      blendCol(buf, W, H, cx - r * 0.35, cy - r * 0.35, shine, 0.85);
    }
    return;
  }

  if (type === 'drop_shadow') {
    const col = parseColor(layer.color, [0, 0, 0, 120]);
    const dx = Number(layer.dx) || 2;
    const dy = Number(layer.dy) || 3;
    const rad = Number(layer.radius) || 4;
    const blur = Math.max(1, Number(layer.blur) || 3);
    const sx = x0 + dx;
    const sy = y0 + dy;
    const minX = Math.max(0, Math.floor(sx - blur));
    const maxX = Math.min(W - 1, Math.ceil(sx + lw + blur));
    const minY = Math.max(0, Math.floor(sy - blur));
    const maxY = Math.min(H - 1, Math.ceil(sy + lh + blur));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const sd = sdRoundRect(x + 0.5, y + 0.5, sx, sy, lw, lh, rad);
        if (sd > blur) continue;
        const cov = clamp(1 - Math.max(0, sd) / blur, 0, 1);
        blendCol(buf, W, H, x, y, col, cov * cov * alphaMult);
      }
    }
    return;
  }

  if (type === 'pixel_art') {
    const { rgba, width: pw, height: ph } = renderPixelGrid(layer.palette, layer.grid, {
      scale: layer.scale || 1,
      mirror_x: !!layer.mirror_x,
      mirror_y: !!layer.mirror_y,
      outline_color: layer.outline_color || null,
    });
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        if (rgba[i + 3] === 0) continue;
        blendPixel(buf, W, H, x0 + x, y0 + y, rgba[i], rgba[i + 1], rgba[i + 2], (rgba[i + 3] / 255) * alphaMult);
      }
    }
  }
}

export function composeLayers({
  width = 120,
  height = 60,
  background = null,
  layers = [],
} = {}) {
  const W = clamp(Math.round(Number(width) || 120), 4, 1024);
  const H = clamp(Math.round(Number(height) || 60), 4, 1024);
  const buf = Buffer.alloc(W * H * 4);

  const bg = parseColor(background, null);
  if (bg) {
    for (let i = 0; i < W * H; i++) {
      buf[i * 4] = bg[0];
      buf[i * 4 + 1] = bg[1];
      buf[i * 4 + 2] = bg[2];
      buf[i * 4 + 3] = bg[3];
    }
  }
  for (const layer of (Array.isArray(layers) ? layers : [])) {
    renderLayerInto(buf, W, H, layer);
  }
  const png = encodeRgbaPng(buf, W, H);
  return {
    width: W,
    height: H,
    bytes: png.length,
    dataUrl: 'data:image/png;base64,' + png.toString('base64'),
  };
}

function renderSingleBarFrame(opts, ratio, fillStart, fillEnd) {
  const W = opts.width;
  const H = opts.height;
  const buf = Buffer.alloc(W * H * 4);
  const pad = Math.max(1, Math.round(Number(opts.padding) || 2));
  const rad = opts.corner_style === 'square' ? 0 : opts.corner_style === 'chamfer' ? Math.min(4, H * 0.35) : Math.min(4, H * 0.4);
  const emptyCol = parseColor(opts.empty_color, [20, 22, 30, 235]);
  const borderCol = parseColor(opts.border_color, [78, 86, 110, 255]);
  const hiCol = parseColor(opts.highlight_color, [255, 255, 255, 70]);
  const dir = String(opts.direction || 'horizontal').toLowerCase();
  const segments = Math.max(0, Math.round(Number(opts.segments) || 0));
  const slant = clamp(Number(opts.slant) || 0, -0.6, 0.6);

  // Outer shell + inner background
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sd = opts.corner_style === 'chamfer'
        ? sdChamferRect(x + 0.5, y + 0.5, 0, 0, W, H, rad)
        : sdRoundRect(x + 0.5, y + 0.5, 0, 0, W, H, rad);
      if (sd > 0.75) continue;
      const cov = clamp(0.75 - sd, 0, 1);
      if (sd > -Math.max(1, pad * 0.75)) {
        blendCol(buf, W, H, x, y, borderCol, cov);
      } else {
        blendCol(buf, W, H, x, y, emptyCol, cov);
      }
    }
  }

  // Fill region
  if (ratio > 0) {
    const ix = pad;
    const iy = pad;
    const iw = Math.max(1, W - pad * 2);
    const ih = Math.max(1, H - pad * 2);
    for (let y = iy; y < iy + ih; y++) {
      const ry = (y - iy) / Math.max(1, ih - 1);
      const skewPx = slant * (0.5 - ry) * ih;
      for (let x = ix; x < ix + iw; x++) {
        const sdIn = opts.corner_style === 'chamfer'
          ? sdChamferRect(x + 0.5, y + 0.5, ix, iy, iw, ih, Math.max(0, rad - 1))
          : sdRoundRect(x + 0.5, y + 0.5, ix, iy, iw, ih, Math.max(0, rad - 1));
        if (sdIn > 0.75) continue;

        let progress = 0;
        let gradT = 0;
        if (dir === 'vertical') {
          progress = (iy + ih - 0.5 - y) / Math.max(1, ih);
          gradT = clamp(progress, 0, 1);
        } else {
          progress = (x + 0.5 - ix + skewPx) / Math.max(1, iw);
          gradT = clamp((x - ix) / Math.max(1, iw - 1), 0, 1);
        }
        if (progress > ratio) continue;

        if (segments > 1) {
          const segCoord = dir === 'vertical' ? progress * segments : ((x - ix) / iw) * segments;
          const frac = segCoord - Math.floor(segCoord);
          if (frac < 0.08 || frac > 0.92) continue;
        }

        const cov = clamp(0.75 - sdIn, 0, 1);
        const col = mixRgba(fillStart, fillEnd, gradT);
        blendCol(buf, W, H, x, y, col, cov);
        if (y - iy < Math.max(1, Math.floor(ih * 0.28)) && hiCol) {
          blendCol(buf, W, H, x, y, hiCol, cov * 0.65);
        }
      }
    }
  }

  const png = encodeRgbaPng(buf, W, H);
  return 'data:image/png;base64,' + png.toString('base64');
}

const STATUS_PALETTES = {
  poison: ['#38b000', '#9ef01a'],
  wither: ['#3c3c44', '#6b5b7b'],
  absorption: ['#f2b705', '#ffe875'],
  freeze: ['#38bdf8', '#bae6fd'],
  hunger: ['#6a994e', '#a7c957'],
};

export function generateBarSet({
  width = 96,
  height = 12,
  steps = 16,
  direction = 'horizontal',
  fill_color = '#e03c4a',
  fill_color_end = '#ff7b54',
  empty_color = '#161822eb',
  border_color = '#4e566e',
  highlight_color = '#ffffff55',
  corner_style = 'chamfer',
  segments = 0,
  slant = 0,
  padding = 2,
  status_variants = [],
} = {}) {
  const W = clamp(Math.round(Number(width) || 96), 8, 512);
  const H = clamp(Math.round(Number(height) || 12), 4, 256);
  const totalSteps = clamp(Math.round(Number(steps) || 16), 2, 32);
  const opts = {
    width: W,
    height: H,
    direction,
    empty_color,
    border_color,
    highlight_color,
    corner_style,
    segments,
    slant,
    padding,
  };
  const cStart = parseColor(fill_color, [224, 60, 74, 255]);
  const cEnd = parseColor(fill_color_end || fill_color, cStart);

  const frames = [];
  for (let i = 0; i <= totalSteps; i++) {
    frames.push(renderSingleBarFrame(opts, i / totalSteps, cStart, cEnd));
  }

  const variants = {};
  if (Array.isArray(status_variants)) {
    for (const v of status_variants) {
      const key = String(v).toLowerCase();
      const pair = STATUS_PALETTES[key];
      if (!pair) continue;
      const vs = parseColor(pair[0]);
      const ve = parseColor(pair[1]);
      variants[key] = [];
      for (let i = 0; i <= totalSteps; i++) {
        variants[key].push(renderSingleBarFrame(opts, i / totalSteps, vs, ve));
      }
    }
  }

  return {
    width: W,
    height: H,
    steps: totalSteps,
    frames,
    emptyFrame: frames[0],
    fullFrame: frames[frames.length - 1],
    statusVariants: variants,
  };
}

export function generateAnimation({
  width = 48,
  height = 48,
  frame_count = 8,
  fps = 10,
  effect = 'pulse_glow',
  base_layers = [],
  frames = null,
  accent_color = '#3a8ee6',
} = {}) {
  const W = clamp(Math.round(Number(width) || 48), 4, 512);
  const H = clamp(Math.round(Number(height) || 48), 4, 512);
  const outFps = clamp(Math.round(Number(fps) || 10), 1, 60);

  if (Array.isArray(frames) && frames.length >= 2) {
    const rendered = frames.map((spec) => {
      if (Array.isArray(spec)) {
        return composeLayers({ width: W, height: H, layers: spec }).dataUrl;
      }
      if (spec && Array.isArray(spec.grid)) {
        return drawPixelArt(spec).dataUrl;
      }
      return composeLayers({ width: W, height: H, ...(spec || {}) }).dataUrl;
    });
    const firstBuf = Buffer.from(rendered[0].split(',')[1], 'base64');
    const sz = readPngSize(firstBuf);
    return {
      width: sz.w,
      height: sz.h,
      fps: outFps,
      frameCount: rendered.length,
      animFrames: rendered,
      previewFrame: rendered[0],
    };
  }

  const count = clamp(Math.round(Number(frame_count) || 8), 2, 32);
  const acc = parseColor(accent_color, [58, 142, 230, 255]);
  const animFrames = [];
  for (let i = 0; i < count; i++) {
    const phase = i / count;
    const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    const frameLayers = Array.isArray(base_layers) ? base_layers.slice() : [];
    if (effect === 'shimmer_sweep') {
      const sx = -W * 0.3 + phase * W * 1.6;
      frameLayers.push({
        type: 'polygon',
        points: [[sx, 0], [sx + W * 0.22, 0], [sx + W * 0.06, H], [sx - W * 0.16, H]],
        color: [255, 255, 255, 85],
      });
    } else if (effect === 'spin_gem') {
      const rx = Math.max(2, W * (0.12 + 0.22 * Math.abs(Math.cos(phase * Math.PI * 2))));
      const ry = H * 0.34;
      frameLayers.push({
        type: 'polygon',
        points: [[W * 0.5, H * 0.5 - ry], [W * 0.5 + rx, H * 0.5], [W * 0.5, H * 0.5 + ry], [W * 0.5 - rx, H * 0.5]],
        color: acc,
        border_color: '#ffffffcc',
        border_width: 1.5,
      });
    } else if (effect === 'scan_radar') {
      const ang = phase * Math.PI * 2;
      const r = Math.min(W, H) * 0.42;
      frameLayers.push({ type: 'ring', cx: W * 0.5, cy: H * 0.5, r, color: [acc[0], acc[1], acc[2], 140], thickness: 1.5 });
      frameLayers.push({ type: 'line', x1: W * 0.5, y1: H * 0.5, x2: W * 0.5 + Math.cos(ang) * r, y2: H * 0.5 + Math.sin(ang) * r, color: accent_color, thickness: 2 });
    } else if (effect === 'flicker_flame') {
      const fy = H * (0.38 + 0.08 * Math.sin(phase * Math.PI * 4));
      frameLayers.push({ type: 'radial_glow', cx: W * 0.5, cy: fy + 4, r: Math.min(W, H) * (0.35 + 0.1 * wave), color: accent_color, intensity: 0.55 + 0.25 * wave });
      frameLayers.push({ type: 'polygon', points: [[W * 0.5, H * 0.18 + wave * 3], [W * 0.68, H * 0.62], [W * 0.5, H * 0.82], [W * 0.32, H * 0.62]], color: acc });
    } else {
      frameLayers.push({
        type: 'radial_glow',
        cx: W * 0.5,
        cy: H * 0.5,
        r: Math.min(W, H) * (0.42 + 0.12 * wave),
        color: accent_color,
        intensity: 0.22 + 0.42 * wave,
      });
    }
    animFrames.push(composeLayers({ width: W, height: H, layers: frameLayers }).dataUrl);
  }

  return {
    width: W,
    height: H,
    fps: outFps,
    frameCount: animFrames.length,
    animFrames,
    previewFrame: animFrames[0],
  };
}

export function generateWidgetsHotbar({
  style = 'rpg',
  bg_color = '#141722e8',
  slot_color = '#0b0d14cc',
  border_color = '#58627a',
  accent_color = '#f2c86c',
  select_color = '#ffe082',
  corner_style = 'chamfer',
} = {}) {
  const cut = style === 'pixel' ? 0 : corner_style === 'square' ? 0 : 2;
  const layers = [
    // Hotbar shell 182x22 at (0, 0)
    { type: 'linear_gradient', x: 0, y: 0, w: 182, h: 22, from: bg_color, to: slot_color, direction: 'vertical', cut },
    { type: 'border', x: 0, y: 0, w: 182, h: 22, style: style === 'cyberpunk' ? 'cyber_brackets' : 'bevel', color: border_color, accent: accent_color, thickness: 1 },
  ];
  for (let s = 0; s < 9; s++) {
    const sx = 2 + s * 20;
    layers.push({ type: 'rect', x: sx, y: 2, w: 18, h: 18, color: slot_color, border_color, border_width: 1 });
  }
  // Selected slot box 24x24 at (0, 22)
  layers.push({ type: 'border', x: 0, y: 22, w: 24, h: 24, style: 'solid', color: select_color, thickness: 2 });
  layers.push({ type: 'border', x: 2, y: 24, w: 20, h: 20, style: 'solid', color: accent_color, thickness: 1 });

  return composeLayers({ width: 256, height: 256, layers });
}

export function importImageFile(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const buf = fs.readFileSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  let mime = 'image/png';
  let w = null;
  let h = null;
  if (ext === '.png') {
    const sz = readPngSize(buf);
    w = sz.w;
    h = sz.h;
  } else if (ext === '.webp') {
    mime = 'image/webp';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    mime = 'image/jpeg';
  }
  return {
    fileName: path.basename(resolved),
    width: w,
    height: h,
    bytes: buf.length,
    dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
  };
}
