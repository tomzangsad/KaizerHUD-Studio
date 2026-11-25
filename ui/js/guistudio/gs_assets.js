/* ========================================
   GUI Studio — Shapes & Icons
   Makes pictures inside the studio:
     • Shapes: 13 shapes in two looks — "2D" (smooth, fill / stroke / gradient / soft shadow)
       or "Pixel" (1 GUI px = 1 texture px, 6-shade ramp, light from the top-left,
       outline, bevel, 1 px drop shadow — the same rules as the menu templates).
     • Icons: two pixel sets built in (work offline) + search of every free icon set on
       Iconify (online, about 275 000 icons) with the licence shown and kept for credits.
   The result is a normal picture (PNG) plus `gen` on the element, so it can be edited again.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const M = () => GS.Model;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

    /* ───────────── colour ───────────── */

    const hexRgb = (h) => { const v = parseInt(String(h || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
    const rgbHex = (r, g, b) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
    function rgbHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        if (mx === mn) return [0, 0, l];
        const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h * 60, s, l];
    }
    function hslHex(h, s, l) {
        h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
        const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
        const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
    }
    /** 6 shades from one colour: darks shift toward blue, lights toward yellow (pixel-art hue shift) */
    function rampFrom(hex) {
        const [h, s, l] = rgbHsl(...hexRgb(hex));
        const toward = (target, k) => { let d = ((target - h + 540) % 360) - 180; return h + d * k; };
        return [
            hslHex(toward(240, 0.18), Math.min(1, s * 0.9 + 0.1), l * 0.22),
            hslHex(toward(240, 0.12), s, l * 0.48),
            hslHex(toward(240, 0.06), s, l * 0.74),
            hex,
            hslHex(toward(60, 0.08), s * 0.95, l + (1 - l) * 0.32),
            hslHex(toward(60, 0.14), s * 0.8, l + (1 - l) * 0.68)
        ];
    }

    /** Named 6-shade ramps (the template kits' palettes) */
    function ramps() {
        const P = (GS.Templates && GS.Templates.PALETTES) || {};
        const out = [];
        const add = (group, obj) => Object.entries(obj || {}).forEach(([id, r]) => out.push({ id: `${group}.${id}`, name: `${id[0].toUpperCase()}${id.slice(1)}`, group, ramp: r }));
        add('metal', P.metal); add('gem', P.gem); add('plate', P.plate);
        return out;
    }
    function rampOf(opts) {
        if (opts.ramp && opts.ramp !== 'custom') {
            const r = ramps().find(x => x.id === opts.ramp);
            if (r) return r.ramp;
        }
        return rampFrom(opts.color || '#3a8cf0');
    }

    /* ───────────── shapes ───────────── */

    const regular = (n, rot) => Array.from({ length: n }, (_, i) => {
        const a = rot + i * 2 * Math.PI / n;
        return [0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)];
    });
    /** stretch a polygon so it touches all four sides of the box */
    const fit = (pts) => {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        return pts.map(([x, y]) => [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)]);
    };
    const star = (n, inner) => fit(Array.from({ length: n * 2 }, (_, i) => {
        const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? 0.5 * inner : 0.5;
        return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
    }));

    /** label, polygon (0..1 box) or kind, default size */
    const SHAPES = {
        rect: { label: 'Rectangle', kind: 'rect', w: 64, h: 32 },
        round: { label: 'Rounded', kind: 'rect', round: true, w: 64, h: 32 },
        circle: { label: 'Circle', kind: 'ellipse', w: 32, h: 32 },
        ring: { label: 'Ring', kind: 'ring', w: 32, h: 32 },
        triangle: { label: 'Triangle', poly: [[0.5, 0], [1, 1], [0, 1]], w: 32, h: 28 },
        diamond: { label: 'Diamond', poly: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], w: 32, h: 32 },
        pentagon: { label: 'Pentagon', poly: fit(regular(5, -Math.PI / 2)), w: 32, h: 31 },
        hexagon: { label: 'Hexagon', poly: [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]], w: 36, h: 32 },
        octagon: { label: 'Octagon', poly: [[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]], w: 32, h: 32 },
        star: { label: 'Star', kind: 'star', w: 32, h: 31 },
        heart: { label: 'Heart', kind: 'heart', w: 32, h: 28 },
        plus: { label: 'Plus', kind: 'plus', w: 32, h: 32 },
        arrow: { label: 'Arrow', poly: [[0, 0.32], [0.58, 0.32], [0.58, 0], [1, 0.5], [0.58, 1], [0.58, 0.68], [0, 0.68]], w: 40, h: 24 },
        chevron: { label: 'Chevron', poly: [[0, 0], [0.45, 0], [1, 0.5], [0.45, 1], [0, 1], [0.55, 0.5]], w: 24, h: 32 },
        line: { label: 'Line', kind: 'rect', w: 64, h: 2 }
    };

    function inPoly(x, y, pts) {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
        }
        return c;
    }

    /** Is pixel (i, j) of a w×h shape inside? (pixel centres, so edges stay crisp) */
    function inside(shape, o, w, h, i, j) {
        const S = SHAPES[shape] || SHAPES.rect;
        const x = i + 0.5, y = j + 0.5;
        const u = x / w, v = y / h;
        switch (S.kind) {
            case 'rect': {
                const r = S.round ? Math.max(0, Math.min(o.radius != null ? o.radius : 4, Math.floor(Math.min(w, h) / 2))) : 0;
                if (!r) return true;
                const cx = x < r ? r : x > w - r ? w - r : x, cy = y < r ? r : y > h - r ? h - r : y;
                return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.25;
            }
            case 'ellipse': return ((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2 <= 1;
            case 'ring': {
                if (((u - 0.5) / 0.5) ** 2 + ((v - 0.5) / 0.5) ** 2 > 1) return false;
                const t = Math.max(1, o.thickness || 4);
                const iw = w / 2 - t, ih = h / 2 - t;
                if (iw <= 0 || ih <= 0) return true;
                return ((x - w / 2) / iw) ** 2 + ((y - h / 2) / ih) ** 2 > 1;
            }
            case 'star': return inPoly(u, v, star(o.points || 5, o.inner || 0.45));
            case 'heart': {
                const X = (u - 0.5) * 2.3, Y = 1.22 - v * 2.28;
                const a = X * X + Y * Y - 1;
                return a * a * a - X * X * Y * Y * Y <= 0;
            }
            case 'plus': {
                const t = (o.thickness || Math.round(Math.min(w, h) / 3)) / 2;
                return Math.abs(x - w / 2) <= t || Math.abs(y - h / 2) <= t;
            }
            default: return inPoly(u, v, S.poly);
        }
    }

    function maskOf(shape, o, w, h) {
        const m = new Uint8Array(w * h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) m[j * w + i] = inside(shape, o, w, h, i, j) ? 1 : 0;
        return m;
    }

    /** Pixel look: outline, bevel (or inset), a highlight pixel, 1 px drop shadow */
    function pixelShape(shape, o) {
        const w = Math.max(2, o.w | 0), h = Math.max(2, o.h | 0);
        const r = rampOf(o);
        const lift = o.lighter ? 1 : 0;          // hover picture: one shade lighter
        const sh = (k) => r[Math.min(5, k + lift)];
        const mask = maskOf(shape, o, w, h);
        const at = (i, j) => i >= 0 && j >= 0 && i < w && j < h && mask[j * w + i] === 1;
        const pad = o.shadow ? 1 : 0;
        const B = new GS.Templates.Buf(w + pad, h + pad);
        const edge = (i, j) => o.outline !== false && at(i, j) && (!at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1));
        const inner = (i, j) => at(i, j) && !edge(i, j);
        const depth = Math.max(0, Math.min(3, o.bevel == null ? 1 : o.bevel | 0));
        const dist = (i, j, di, dj) => { let k = 0; while (k <= depth && inner(i + di * (k + 1), j + dj * (k + 1))) k++; return k; };
        if (pad) {
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (at(i, j) && !at(i + 1, j + 1)) B.px(i + 1, j + 1, r[0], 0.55);
        }
        let shine = false;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            if (!at(i, j)) continue;
            if (edge(i, j)) { B.px(i, j, r[0]); continue; }
            let c = sh(3);
            if (depth > 0 && o.style !== 'flat') {
                const tl = Math.min(dist(i, j, 0, -1), dist(i, j, -1, 0));
                const br = Math.min(dist(i, j, 0, 1), dist(i, j, 1, 0));
                const inset = o.style === 'inset';
                if (tl < depth && tl <= br) c = sh(inset ? 2 : 4);
                else if (br < depth) c = sh(inset ? 4 : 2);
                if (!inset && o.shine !== false && !shine && tl === 0 && dist(i, j, -1, 0) === 0 && dist(i, j, 0, -1) === 0) { c = sh(5); shine = true; }
            }
            B.px(i, j, c);
        }
        return { data: B.png(), w: w + pad, h: h + pad, gw: w + pad, gh: h + pad, res: 1 };
    }

    /** Path of a shape on a 2D canvas (box x, y, w, h) */
    function shapePath(g, shape, o, x, y, w, h) {
        const S = SHAPES[shape] || SHAPES.rect;
        g.beginPath();
        const polyPath = (pts) => pts.forEach(([u, v], i) => (i ? g.lineTo : g.moveTo).call(g, x + u * w, y + v * h));
        switch (S.kind) {
            case 'rect': {
                const r = S.round ? Math.min(o.radius != null ? o.radius : 4, w / 2, h / 2) : 0;
                if (r && g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
                break;
            }
            case 'ellipse': g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
            case 'ring': {
                const t = Math.max(1, o.thickness || 4);
                g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                g.moveTo(x + w - t, y + h / 2);
                g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2 - t), Math.max(0.5, h / 2 - t), 0, 0, Math.PI * 2, true);
                break;
            }
            case 'star': polyPath(star(o.points || 5, o.inner || 0.45)); break;
            case 'heart': {
                const cx = x + w / 2;
                g.moveTo(cx, y + h);
                g.bezierCurveTo(x - w * 0.05, y + h * 0.55, x + w * 0.02, y - h * 0.08, cx, y + h * 0.28);
                g.bezierCurveTo(x + w * 0.98, y - h * 0.08, x + w * 1.05, y + h * 0.55, cx, y + h);
                break;
            }
            case 'plus': {
                const t = (o.thickness || Math.round(Math.min(w, h) / 3)) / 2;
                const a = (w / 2 - t) / w, b = (w / 2 + t) / w, c = (h / 2 - t) / h, d = (h / 2 + t) / h;
                polyPath([[a, 0], [b, 0], [b, c], [1, c], [1, d], [b, d], [b, 1], [a, 1], [a, d], [0, d], [0, c], [a, c]]);
                break;
            }
            default: polyPath(S.poly);
        }
        g.closePath();
    }

    /** 2D look: smooth edges, fill (or top→bottom gradient), stroke, soft shadow */
    function flatShape(shape, o) {
        const w = Math.max(2, o.w | 0), h = Math.max(2, o.h | 0);
        // drawn `res` times finer than the GUI size, so edges stay smooth in game (element "Detail")
        const res = o.res > 0 ? o.res : [1, 2, 4, 8].includes(Number(o.detail)) ? Number(o.detail) : 4;
        const c = document.createElement('canvas');
        c.width = w * res; c.height = h * res;
        const g = c.getContext('2d');
        g.scale(res, res);
        // 2D soft shadow has its own switch (`soft`); older pictures used `shadow`
        const soft = o.soft != null ? !!o.soft : !!o.shadow;
        const pad = soft ? Math.max(2, Math.round(Math.min(w, h) * 0.06)) : 0;
        const sw = Math.max(0, +o.strokeW || 0);
        const bw = w - pad, bh = h - pad;
        const x = sw / 2, y = sw / 2, iw = bw - sw, ih = bh - sw;
        if (soft) {
            g.save();
            // shadow sizes are in canvas pixels (the scale above does not apply to them): × res,
            // and the offset is larger than the blur so nothing shows past the top / left edge
            g.shadowColor = 'rgba(0,0,0,0.45)';
            g.shadowBlur = pad * 0.8 * res;
            g.shadowOffsetX = pad * 0.6 * res; g.shadowOffsetY = pad * 0.6 * res;
            shapePath(g, shape, o, x, y, iw, ih);
            g.fillStyle = '#000';
            g.fill('evenodd');
            g.restore();
            // the shadow pass left the shape itself black: clear it, the fill goes on top
            g.save();
            g.globalCompositeOperation = 'destination-out';
            shapePath(g, shape, o, x, y, iw, ih);
            g.fill('evenodd');
            g.restore();
        }
        g.globalAlpha = Math.max(0, Math.min(1, (o.opacity == null ? 100 : o.opacity) / 100));
        if (o.gradient) {
            const gr = g.createLinearGradient(0, y, 0, y + ih);
            gr.addColorStop(0, o.color2 || '#ffffff');
            gr.addColorStop(1, o.color || '#3a8cf0');
            g.fillStyle = gr;
        } else g.fillStyle = o.color || '#3a8cf0';
        shapePath(g, shape, o, x, y, iw, ih);
        g.fill('evenodd');
        if (sw > 0) {
            g.globalAlpha = 1;
            g.lineWidth = sw;
            g.lineJoin = 'round';
            g.strokeStyle = o.stroke || '#ffffff';
            g.stroke();
        }
        return { data: c.toDataURL('image/png'), w: w * res, h: h * res, gw: w, gh: h, res };
    }

    function renderShape(shape, o) {
        return o.look === 'pixel' ? pixelShape(shape, o) : flatShape(shape, o);
    }

    /* ───────────── icons ───────────── */

    const API = 'https://api.iconify.design';
    /** free licences that need no credit */
    const NO_CREDIT = new Set(['MIT', 'Apache-2.0', 'ISC', 'CC0-1.0', 'OFL-1.1', 'BSD-2-Clause', 'BSD-3-Clause', 'Unlicense', 'MPL-2.0']);
    const CREDIT_OK = new Set(['CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.5']);
    const PIXEL_SETS = ['pixelarticons', 'pixel', 'streamline-pixel'];

    function svgText(body, vw, vh, color) {
        const b = color ? body.replace(/currentColor/g, color) : body;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">${b}</svg>`;
    }
    const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    function loadImg(src) {
        return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not draw this icon')); i.src = src; });
    }

    /** Offline sets → [{ prefix, name, body, w, h }] */
    function offlineIcon(prefix, name) {
        const set = (GS.IconSets || []).find(s => s.prefix === prefix);
        if (!set || !set.icons[name]) return null;
        const v = set.icons[name];
        return Array.isArray(v) ? { body: v[0], w: v[1], h: v[2], set } : { body: v, w: set.width, h: set.height, set };
    }

    async function onlineIcon(prefix, name) {
        const r = await fetch(`${API}/${encodeURIComponent(prefix)}.json?icons=${encodeURIComponent(name)}`);
        if (!r.ok) throw new Error(`Iconify answered ${r.status}`);
        const j = await r.json();
        let ic = j.icons && j.icons[name];
        if (!ic && j.aliases && j.aliases[name]) ic = j.icons[j.aliases[name].parent];
        if (!ic) throw new Error('Icon not found');
        return { body: ic.body, w: ic.width || j.width || 16, h: ic.height || j.height || 16 };
    }

    /**
     * Icon → picture.
     * o: { size, color, look: 'smooth'|'pixel', outline, outlineColor, shadow, native (pixel grid of the set) }
     */
    async function renderIcon(icon, o) {
        const vw = icon.w, vh = icon.h;
        const size = Math.max(4, Math.min(256, o.size | 0 || 24));
        // smooth icons are drawn `res` times finer than their GUI size (element "Detail")
        const res = o.look === 'pixel' ? 1 : o.res > 0 ? o.res : ([1, 2, 4, 8].includes(Number(o.detail)) ? Number(o.detail) : 4);
        const W = Math.max(1, Math.round(size * res * vw / Math.max(vw, vh))), H = Math.max(1, Math.round(size * res * vh / Math.max(vw, vh)));
        const img = await loadImg(svgUrl(svgText(icon.body, vw, vh, o.keepColors ? null : (o.color || '#ffffff'))));
        let base;
        const pixel = o.look === 'pixel';
        if (pixel && o.native) {
            // pixel sets: draw on their own grid, then grow by whole steps → no blur
            const g0 = document.createElement('canvas');
            g0.width = vw; g0.height = vh;
            g0.getContext('2d').drawImage(img, 0, 0, vw, vh);
            base = document.createElement('canvas');
            base.width = W; base.height = H;
            const g = base.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(g0, 0, 0, W, H);
        } else {
            base = document.createElement('canvas');
            base.width = W; base.height = H;
            base.getContext('2d').drawImage(img, 0, 0, W, H);
        }
        const ctx = base.getContext('2d');
        const src = ctx.getImageData(0, 0, W, H);
        if (pixel) {
            // hard edges: every pixel is either solid or empty
            for (let i = 0; i < src.data.length; i += 4) src.data[i + 3] = src.data[i + 3] >= 110 ? 255 : 0;
        }
        const pad = (o.outline ? res : 0), sh = o.shadow ? res : 0;
        const OW = W + pad * 2 + sh, OH = H + pad * 2 + sh;
        const B = new GS.Templates.Buf(OW, OH);
        const A = (i, j) => i >= 0 && j >= 0 && i < W && j < H ? src.data[(j * W + i) * 4 + 3] : 0;
        const oc = o.outlineColor || '#14161c';
        // outline / shadow are 1 GUI px = `res` picture px thick
        const near = (i, j, r) => { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (A(i + di, j + dj) >= 128) return true; return false; };
        if (sh) {
            for (let j = -pad; j < H + pad; j++) for (let i = -pad; i < W + pad; i++) {
                const solid = A(i, j) > 0 || (pad && near(i, j, pad));
                if (solid) B.px(i + pad + sh, j + pad + sh, oc, 0.5 * (A(i, j) > 0 && !pad ? A(i, j) / 255 : 1));
            }
        }
        if (pad) {
            for (let j = -pad; j < H + pad; j++) for (let i = -pad; i < W + pad; i++) {
                if (A(i, j) >= 250) continue;
                if (near(i, j, pad)) B.px(i + pad, j + pad, oc);
            }
        }
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
            const k = (j * W + i) * 4, a = src.data[k + 3];
            if (a) B.px(i + pad, j + pad, [src.data[k], src.data[k + 1], src.data[k + 2]], a / 255);
        }
        return { data: B.png(), w: OW, h: OH, gw: Math.round(OW / res), gh: Math.round(OH / res), res };
    }

    /* ───────────── dialog ───────────── */

    const state = {
        tab: 'shapes',
        shape: 'round',
        so: { look: 'pixel', detail: 4, soft: false, w: 64, h: 24, color: '#3a8cf0', ramp: 'gem.blue', color2: '#ffffff', stroke: '#ffffff', strokeW: 0, opacity: 100, radius: 4, thickness: 4, points: 5, inner: 0.45, outline: true, bevel: 1, style: 'bevel', shadow: true, shine: true, gradient: false },
        source: 'offline',
        query: '',
        licence: 'nocredit',
        pixelOnly: false,
        icon: null,           // { prefix, name, set, license, author, attribution, body, w, h }
        io: { size: 24, detail: 4, color: '#ffffff', look: 'pixel', outline: false, outlineColor: '#14161c', shadow: true, keepColors: false },
        hover: true
    };

    const DETAILS = [['1', '1× — as many pixels as GUI px'], ['2', '2×'], ['4', '4× — smooth (recommended)'], ['8', '8× — very fine']];

    function field(label, key, value, type, opts) {
        opts = opts || {};
        const id = 'gsa-' + key.replace(/\W/g, '_');
        if (type === 'checkbox') return `<label class="gs-check gsa-check"><input type="checkbox" id="${id}" data-o="${key}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
        if (type === 'select') return `<div class="gs-field"><label for="${id}">${label}</label><select id="${id}" data-o="${key}">${opts.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
        const attrs = type === 'number' ? `step="${opts.step || 1}" min="${opts.min != null ? opts.min : ''}" max="${opts.max != null ? opts.max : ''}"` : '';
        return `<div class="gs-field"><label for="${id}">${label}</label><input id="${id}" type="${type}" data-o="${key}" value="${esc(value)}" ${attrs}></div>`;
    }
    const seg = (key, value, items) => `<div class="gs-seg gsa-seg" data-seg="${key}">${items.map(([v, l]) => `<button data-v="${v}" class="${v === value ? 'active' : ''}">${l}</button>`).join('')}</div>`;

    function shapeOptionsHtml(ctx) {
        const o = state.so, S = SHAPES[state.shape];
        let h = `<div class="gsa-row">${seg('so.look', o.look, [['pixel', 'Pixel'], ['flat', '2D']])}</div>`;
        h += `<div class="gs-grid2">${field('Width', 'so.w', o.w, 'number', { min: 2, max: 960 })}${field('Height', 'so.h', o.h, 'number', { min: 2, max: 960 })}</div>`;
        if (S.round) h += field('Corner radius', 'so.radius', o.radius, 'number', { min: 0, max: 64 });
        if (S.kind === 'ring' || S.kind === 'plus') h += field('Thickness', 'so.thickness', o.thickness, 'number', { min: 1, max: 64 });
        if (S.kind === 'star') h += `<div class="gs-grid2">${field('Points', 'so.points', o.points, 'number', { min: 3, max: 12 })}${field('Inner size', 'so.inner', o.inner, 'number', { step: 0.05, min: 0.1, max: 0.9 })}</div>`;
        if (o.look === 'pixel') {
            const rs = ramps();
            h += field('Colours', 'so.ramp', o.ramp, 'select', { options: [['custom', 'From one colour…']].concat(rs.map(r => [r.id, `${r.group} · ${r.name}`])) });
            if (o.ramp === 'custom') h += field('Colour', 'so.color', o.color, 'color');
            h += `<div class="gsa-ramp">${rampOf(o).map(c => `<span style="background:${c}"></span>`).join('')}</div>`;
            h += field('Shading', 'so.style', o.style, 'select', { options: [['bevel', 'Raised (light top-left)'], ['inset', 'Pressed in'], ['flat', 'Flat fill']] });
            if (o.style !== 'flat') h += field('Bevel width', 'so.bevel', o.bevel, 'number', { min: 1, max: 3 });
            h += `<div class="gsa-checks">${field('Outline', 'so.outline', o.outline, 'checkbox')}${field('Shine pixel', 'so.shine', o.shine, 'checkbox')}${field('Drop shadow', 'so.shadow', o.shadow, 'checkbox')}</div>`;
        } else {
            h += `<div class="gs-grid2">${field('Fill', 'so.color', o.color, 'color')}${field('Opacity %', 'so.opacity', o.opacity, 'number', { min: 0, max: 100 })}</div>`;
            h += `<div class="gsa-checks">${field('Gradient', 'so.gradient', o.gradient, 'checkbox')}${field('Soft shadow', 'so.soft', !!o.soft, 'checkbox')}</div>`;
            if (o.gradient) h += field('Top colour', 'so.color2', o.color2, 'color');
            h += `<div class="gs-grid2">${field('Stroke', 'so.stroke', o.stroke, 'color')}${field('Stroke width', 'so.strokeW', o.strokeW, 'number', { step: 0.5, min: 0, max: 16 })}</div>`;
            h += field('Detail (smooth edges)', 'so.detail', o.detail || 4, 'select', { options: DETAILS });
        }
        if (ctx.forButton === 'image') h += field('Also make the hover picture (one shade lighter)', 'hover', state.hover && o.look === 'pixel', 'checkbox');
        return h;
    }

    function iconOptionsHtml() {
        const o = state.io, ic = state.icon;
        let h = '';
        if (ic) {
            const lic = ic.license || {};
            h += `<div class="gsa-iconinfo"><b>${esc(ic.name)}</b><br><span>${esc(ic.setName || ic.prefix)} · ${esc(lic.title || lic.spdx || '?')}${ic.attribution ? ' · <em>credit needed</em>' : ''}</span></div>`;
        } else h += '<div class="gs-hint">Pick an icon on the left.</div>';
        h += `<div class="gsa-row">${seg('io.look', o.look, [['pixel', 'Pixel'], ['smooth', 'Smooth']])}</div>`;
        h += `<div class="gs-grid2">${field('Size (px)', 'io.size', o.size, 'number', { min: 4, max: 256 })}${field('Colour', 'io.color', o.color, 'color')}</div>`;
        if (ic && !/currentColor/.test(ic.body || '')) h += '<div class="gs-hint">This icon has its own colours.</div>';
        h += `<div class="gsa-checks">${field('Outline', 'io.outline', o.outline, 'checkbox')}${field('Drop shadow', 'io.shadow', o.shadow, 'checkbox')}</div>`;
        if (o.outline || o.shadow) h += field('Outline / shadow colour', 'io.outlineColor', o.outlineColor, 'color');
        if (o.look !== 'pixel') h += field('Detail (smooth edges)', 'io.detail', o.detail || 4, 'select', { options: DETAILS });
        h += '<div class="gs-hint">Pixel icons look sharpest at their own size or 2×, 3× (24, 48, 72 px for the built-in sets).</div>';
        return h;
    }

    function shapesTabHtml() {
        const tiles = Object.entries(SHAPES).map(([id, S]) => `<button class="gsa-tile ${id === state.shape ? 'active' : ''}" data-shape="${id}" title="${esc(S.label)}"><canvas width="28" height="28"></canvas><span>${esc(S.label)}</span></button>`).join('');
        return `<div class="gsa-grid gsa-shapes">${tiles}</div>`;
    }

    function iconsTabHtml() {
        return `<div class="gsa-searchbar">
              ${seg('source', state.source, [['offline', 'Pixel sets (built in)'], ['online', 'All free icons (online)']])}
              <input type="search" id="gsa-q" placeholder="${state.source === 'online' ? 'Search about 275 000 icons… (english: sword, coin, home)' : 'Filter by name… (heart, coin, home)'}" value="${esc(state.query)}">
              ${state.source === 'online' ? `<select id="gsa-lic"><option value="nocredit" ${state.licence === 'nocredit' ? 'selected' : ''}>Free · no credit needed</option><option value="credit" ${state.licence === 'credit' ? 'selected' : ''}>Free · credit ok (CC BY too)</option></select>
              <label class="gs-check"><input type="checkbox" id="gsa-pix" ${state.pixelOnly ? 'checked' : ''}><span>Pixel sets only</span></label>` : ''}
            </div>
            <div class="gsa-grid gsa-icons" id="gsa-icons"></div>
            <div class="gsa-foot" id="gsa-foot"></div>`;
    }

    let searchTimer = null, searchSeq = 0;

    function fillIcons(root) {
        const box = $('#gsa-icons', root), foot = $('#gsa-foot', root);
        if (!box) return;
        const q = state.query.trim().toLowerCase();
        if (state.source === 'offline') {
            const list = [];
            (GS.IconSets || []).forEach(set => Object.keys(set.icons).forEach(n => { if (!q || n.includes(q)) list.push([set, n]); }));
            const shown = list.slice(0, 360);
            box.innerHTML = shown.map(([set, n]) => {
                const ic = offlineIcon(set.prefix, n);
                return `<button class="gsa-ic ${state.icon && state.icon.prefix === set.prefix && state.icon.name === n ? 'active' : ''}" data-ic="${set.prefix}:${n}" title="${esc(n)} · ${esc(set.name)}"><img src="${svgUrl(svgText(ic.body, ic.w, ic.h, '#e6e9ee'))}" alt=""></button>`;
            }).join('');
            foot.innerHTML = `${list.length} icons${list.length > shown.length ? ` · showing ${shown.length}, type to narrow down` : ''} · Pixelarticons (MIT) · Pixel Icon Library by HackerNoon (CC BY 4.0, credit added to the export README)`;
            return;
        }
        if (q.length < 2) { box.innerHTML = '<div class="gs-hint gsa-empty">Type at least 2 letters. Icons come from Iconify (free, open-source sets).</div>'; foot.textContent = ''; return; }
        clearTimeout(searchTimer);
        const seq = ++searchSeq;
        box.innerHTML = '<div class="gs-hint gsa-empty">Searching…</div>';
        searchTimer = setTimeout(async () => {
            try {
                const pre = state.pixelOnly ? `&prefixes=${PIXEL_SETS.join(',')}` : '';
                const r = await fetch(`${API}/search?query=${encodeURIComponent(q)}&limit=240${pre}`);
                if (!r.ok) throw new Error(`Iconify answered ${r.status}`);
                const j = await r.json();
                if (seq !== searchSeq) return;
                const ok = (spdx) => NO_CREDIT.has(spdx) || (state.licence === 'credit' && CREDIT_OK.has(spdx));
                const cols = j.collections || {};
                const list = (j.icons || []).filter(full => { const c = cols[full.split(':')[0]]; return c && c.license && ok(c.license.spdx); });
                state.collections = Object.assign(state.collections || {}, cols);
                box.innerHTML = list.length ? list.map(full => {
                    const [p, n] = full.split(':');
                    const c = cols[p];
                    return `<button class="gsa-ic ${state.icon && `${state.icon.prefix}:${state.icon.name}` === full ? 'active' : ''}" data-ic="${esc(full)}" title="${esc(n)} · ${esc(c.name)} · ${esc(c.license.title)}"><img loading="lazy" src="${API}/${encodeURIComponent(p)}/${encodeURIComponent(n)}.svg?color=%23e6e9ee" alt=""></button>`;
                }).join('') : '<div class="gs-hint gsa-empty">Nothing found with this licence filter — try other words (english) or allow CC BY.</div>';
                foot.textContent = `${list.length} of ${j.total || 0} results · licence filter: ${state.licence === 'nocredit' ? 'no credit needed' : 'credit ok'}`;
            } catch (err) {
                if (seq !== searchSeq) return;
                box.innerHTML = `<div class="gs-hint gsa-empty">Could not reach Iconify (${esc(err.message)}). Check the internet connection — the built-in pixel sets work offline.</div>`;
            }
        }, 280);
    }

    async function pickIcon(full, root, redraw) {
        const [prefix, name] = [full.slice(0, full.indexOf(':')), full.slice(full.indexOf(':') + 1)];
        try {
            let ic;
            if (state.source === 'offline') {
                const o = offlineIcon(prefix, name);
                ic = { prefix, name, body: o.body, w: o.w, h: o.h, setName: o.set.name, license: o.set.license, author: o.set.author, attribution: o.set.attribution, native: true };
            } else {
                const c = (state.collections || {})[prefix] || {};
                const o = await onlineIcon(prefix, name);
                const spdx = c.license && c.license.spdx;
                ic = { prefix, name, body: o.body, w: o.w, h: o.h, setName: c.name, license: c.license, author: c.author, attribution: !NO_CREDIT.has(spdx), native: PIXEL_SETS.includes(prefix) };
            }
            state.icon = ic;
            if (ic.native && state.icon.w && state.io.size % ic.w !== 0) state.io.size = ic.w * Math.max(1, Math.round(state.io.size / ic.w));
            $$('.gsa-ic', root).forEach(b => b.classList.toggle('active', b.dataset.ic === full));
            redraw();
        } catch (err) { GS.toast(err.message, 'error'); }
    }

    /**
     * Opens the window.
     * ctx: { tab, gen (to edit again), size {w,h}, forButton: 'image'|'hoverImage', onApply(result, gen, hoverResult) }
     */
    async function open(ctx) {
        ctx = ctx || {};
        if (ctx.tab) state.tab = ctx.tab;
        if (ctx.gen) {
            if (ctx.gen.kind === 'shape') { state.tab = 'shapes'; state.shape = ctx.gen.shape; Object.assign(state.so, ctx.gen.opts); }
            if (ctx.gen.kind === 'icon') { state.tab = 'icons'; state.icon = Object.assign({}, ctx.gen.icon); Object.assign(state.io, ctx.gen.opts); }
        }
        if (ctx.size && state.tab === 'shapes') { state.so.w = ctx.size.w; state.so.h = ctx.size.h; }
        let current = null, hoverPic = null;

        const body = `<div class="gsa">
            <div class="gsa-tabs">${seg('tab', state.tab, [['shapes', 'Shapes'], ['icons', 'Icons']])}</div>
            <div class="gsa-main">
              <div class="gsa-left" id="gsa-left"></div>
              <div class="gsa-right">
                <div class="gsa-preview"><canvas id="gsa-canvas"></canvas><div class="gsa-size" id="gsa-size"></div></div>
                <div class="gsa-opts" id="gsa-opts"></div>
              </div>
            </div></div>`;
        const res = await GS.modal(ctx.gen ? 'Edit picture' : 'Shapes & Icons', body, [['cancel', 'Cancel'], ['ok', ctx.gen || ctx.forButton ? 'Apply' : 'Insert', 'primary']], {
            wide: true, cls: 'xwide gsa-window',
            onOpen: (root) => {
                const left = $('#gsa-left', root), opts = $('#gsa-opts', root);
                const redraw = async () => {
                    const cv = $('#gsa-canvas', root);
                    try {
                        if (state.tab === 'shapes') {
                            current = renderShape(state.shape, state.so);
                            hoverPic = (ctx.forButton === 'image' && state.hover && state.so.look === 'pixel') ? renderShape(state.shape, Object.assign({}, state.so, { lighter: true })) : null;
                        } else {
                            current = state.icon ? await renderIcon(state.icon, Object.assign({ native: state.icon.native }, state.io)) : null;
                            hoverPic = null;
                        }
                    } catch (err) { current = null; GS.toast(err.message, 'error'); }
                    const g = cv.getContext('2d');
                    if (!current) { cv.width = 1; cv.height = 1; $('#gsa-size', root).textContent = ''; return; }
                    const im = await loadImg(current.data);
                    const box = cv.parentElement;
                    const gw = current.gw || current.w, gh = current.gh || current.h, res = current.res || 1;
                    const k = Math.max(1, Math.floor(Math.min((box.clientWidth - 24) / gw, (box.clientHeight - 24) / gh, 12)));
                    cv.width = gw * k; cv.height = gh * k;
                    cv.style.imageRendering = res > 1 ? 'auto' : 'pixelated';
                    g.imageSmoothingEnabled = res > 1;
                    g.imageSmoothingQuality = 'high';
                    g.clearRect(0, 0, cv.width, cv.height);
                    g.drawImage(im, 0, 0, cv.width, cv.height);
                    $('#gsa-size', root).textContent = `${gw} × ${gh} GUI px${res > 1 ? ` · drawn ${res}× finer` : ''} · shown ${k}×${hoverPic ? ' · + hover picture' : ''}`;
                };
                const drawShapeTiles = () => {
                    $$('.gsa-shapes .gsa-tile', root).forEach(b => {
                        const c = $('canvas', b), g = c.getContext('2d');
                        const S = SHAPES[b.dataset.shape];
                        const k = Math.min(24 / S.w, 24 / S.h);
                        g.clearRect(0, 0, 28, 28);
                        g.fillStyle = '#c9d3df';
                        shapePath(g, b.dataset.shape, Object.assign({}, state.so, { radius: 4 * k * 1.5, thickness: Math.max(2, 4 * k * 1.5) }), 14 - S.w * k / 2, 14 - S.h * k / 2, S.w * k, Math.max(2, S.h * k));
                        g.fill('evenodd');
                    });
                };
                const renderLeft = () => {
                    left.innerHTML = state.tab === 'shapes' ? shapesTabHtml() : iconsTabHtml();
                    if (state.tab === 'shapes') drawShapeTiles(); else fillIcons(root);
                };
                const renderOpts = () => { opts.innerHTML = state.tab === 'shapes' ? shapeOptionsHtml(ctx) : iconOptionsHtml(); };
                const all = () => { $$('.gsa-tabs [data-v]', root).forEach(b => b.classList.toggle('active', b.dataset.v === state.tab)); renderLeft(); renderOpts(); redraw(); };

                root.addEventListener('click', (ev) => {
                    const sb = ev.target.closest('[data-seg] [data-v]');
                    if (sb) {
                        const key = sb.parentElement.dataset.seg, v = sb.dataset.v;
                        if (key === 'tab') { state.tab = v; return all(); }
                        if (key === 'source') { state.source = v; state.icon = null; renderLeft(); renderOpts(); return redraw(); }
                        const [grp, k] = key.split('.');
                        state[grp][k] = v;
                        renderOpts(); return redraw();
                    }
                    const sh = ev.target.closest('[data-shape]');
                    if (sh) {
                        state.shape = sh.dataset.shape;
                        if (!ctx.size) { state.so.w = SHAPES[state.shape].w; state.so.h = SHAPES[state.shape].h; }
                        $$('.gsa-shapes .gsa-tile', root).forEach(b => b.classList.toggle('active', b === sh));
                        renderOpts(); return redraw();
                    }
                    const ic = ev.target.closest('[data-ic]');
                    if (ic) { pickIcon(ic.dataset.ic, root, () => { renderOpts(); redraw(); }); }
                });
                root.addEventListener('input', (ev) => {
                    const t = ev.target;
                    if (t.id === 'gsa-q') { state.query = t.value; fillIcons(root); return; }
                    if (t.dataset.o && (t.type === 'number' || t.type === 'color')) {
                        const [grp, k] = t.dataset.o.split('.');
                        state[grp][k] = t.type === 'number' ? Number(t.value) : t.value;
                        redraw();
                    }
                });
                root.addEventListener('change', (ev) => {
                    const t = ev.target;
                    if (t.id === 'gsa-lic') { state.licence = t.value; return fillIcons(root); }
                    if (t.id === 'gsa-pix') { state.pixelOnly = t.checked; return fillIcons(root); }
                    if (!t.dataset.o) return;
                    if (t.dataset.o === 'hover') { state.hover = t.checked; return redraw(); }
                    // numbers / colours were already taken on 'input'; re-building the panel here would
                    // swallow the click on the next field
                    if (t.type === 'number' || t.type === 'color') return;
                    const [grp, k] = t.dataset.o.split('.');
                    state[grp][k] = t.type === 'checkbox' ? t.checked : t.value;
                    renderOpts(); redraw();
                });
                all();
            }
        });
        if (!res || res.button !== 'ok' || !current) return;
        const gen = state.tab === 'shapes'
            ? { kind: 'shape', shape: state.shape, opts: Object.assign({}, state.so) }
            : { kind: 'icon', icon: Object.assign({}, state.icon), opts: Object.assign({}, state.io) };
        const label = state.tab === 'shapes' ? `${SHAPES[state.shape].label}` : `${state.icon.name}`;
        current.name = `${M().slug(label, 'pic')}.png`;
        if (hoverPic) hoverPic.name = `${M().slug(label, 'pic')}_hover.png`;
        if (ctx.onApply) ctx.onApply(current, gen, hoverPic);
    }

    /** Credits for icons whose licence asks for one (README of the export) */
    function credits(project) {
        const seen = new Map();
        (project.menus || []).forEach(m => (m.elements || []).forEach(e => {
            const g = e.gen;
            if (!g || g.kind !== 'icon' || !g.icon || !g.icon.attribution) return;
            const key = g.icon.prefix;
            if (!seen.has(key)) seen.set(key, { set: g.icon.setName || key, author: (g.icon.author || {}).name || '', license: (g.icon.license || {}).title || '', url: (g.icon.license || {}).url || '', icons: new Set() });
            seen.get(key).icons.add(g.icon.name);
        }));
        return [...seen.values()].map(c => `- ${c.set}${c.author ? ` by ${c.author}` : ''} — ${c.license}${c.url ? ` (${c.url})` : ''}: ${[...c.icons].join(', ')}`);
    }

    GS.Assets = { SHAPES, renderShape, renderIcon, rampFrom, ramps, open, credits, offlineIcon };
})();
