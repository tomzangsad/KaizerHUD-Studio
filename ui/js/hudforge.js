/* ========================================
   HUD Forge — design an original HUD from templates

   Nothing here comes from a Java HUD pack: every texture (panels, bars,
   bar ends, pip rows, icons, level crest, head frame, text plates and the
   hotbar) is pixel art drawn here, pixel by pixel, from the theme settings
   in hudforge_themes.js.

   theme × layout × bar ends × parts × colours  →  plan (parts on the
   480×270 screen)  →  textures  →  editor elements (one group, one undo)
   ======================================== */
(function () {
    'use strict';

    const D = window.HudForgeData;
    const SW = 480;
    const SH = 270;
    const HB = { x: 149, y: 246, w: 182, h: 22 }; // vanilla hotbar on the editor screen
    const S = 2;            // preview scale
    const IS = 9;           // icon size (GUI px)
    const PIP = 7;          // pip icon size
    const TEXT_H = 8;       // small font line height (approx.)
    const CHAR_W = 5;       // small font average glyph width (approx.)
    const PLATE_H = 12;     // text plate height
    const CREST = 19;       // level crest size
    const LAYER = { panel: 100, plate: 101, frame: 101, track: 101, bar: 102, icon: 103, badge: 103, head: 104, text: 105, xp: 106 };
    const STAT_ORDER = ['hp', 'armor', 'food', 'air', 'mana', 'xp'];
    const STAT_LABEL = { hp: 'Health', food: 'Food', armor: 'Armor', air: 'Air', xp: 'XP', mana: 'Mana' };
    const BAR_TYPE = { hp: 'hp', food: 'food', armor: 'armor', air: 'air' };
    const PIP_STATS = ['armor', 'air'];
    const VANILLA_BAR_PAPI = {
        hp: ['%player_health%', '%player_max_health%'],
        food: ['%player_food_level%', '20'],
        armor: ['', '20'],
        air: ['%player_remaining_air%', '%player_max_air%'],
    };
    const VALUE_PAPI = {
        hp: '%player_health_rounded%/%player_max_health_rounded%',
        food: '%player_food_level%/20',
        air: '%player_remaining_air%/%player_max_air%',
    };
    /* Each layout has its own look; picking a layout (or a combo) applies these */
    const LAYOUT_STYLE = {
        fantasy: { ornaments: true, values: false, slotNums: false, pips: true, barH: 9, parts: { head: false, level: true } },
        classic: { ornaments: false, values: false, slotNums: false, pips: true, barH: 9, parts: { head: false, level: true } },
        mmo: { ornaments: false, values: true, slotNums: false, pips: true, barH: 11, barW: 100, shape: 'slant', parts: { head: true, name: true, level: true } },
        banner: { ornaments: false, values: true, slotNums: false, pips: true, barH: 11, barW: 100, shape: 'slant', parts: { head: false, name: true, level: true } },
        compact: { ornaments: false, values: true, slotNums: false, pips: false, barH: 10, barW: 90, parts: { head: false, level: true } },
        rpg_corners: { ornaments: false, values: true, slotNums: false, pips: true, barH: 10, parts: { head: false, level: true } },
        modern: { ornaments: false, values: true, slotNums: true, pips: false, barH: 10, parts: { head: false, level: true } },
        center_row: { ornaments: false, values: false, slotNums: true, pips: false, barH: 9, shape: 'none', parts: { head: false, level: true } },
        split_sides: { ornaments: false, values: false, slotNums: false, pips: true, barH: 9, parts: { head: false, level: true } },
        survival: { ornaments: false, values: false, slotNums: false, pips: true, parts: { head: false, level: true } },
        card_tl: { parts: { head: false, level: true } }, card_tr: { parts: { head: false, level: true } }, card_bl: { parts: { head: false, level: true } }, card_br: { parts: { head: false, level: true } },
        top_strip: { panels: true, parts: { head: false, level: true } },
        // v2 layouts (hudforge_v2.js)
        crest: { values: true, slotNums: false, pips: true, parts: { head: false, level: true } },
        strip: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        slash_medal: { values: true, slotNums: true, pips: true, parts: { head: true, name: true, level: true } },
        slash_rows: { values: true, slotNums: true, pips: true, parts: { head: true, name: true, level: true } },
        slash_crest: { values: true, slotNums: true, pips: true, parts: { head: true, name: true, level: true } },
        cozy: { values: false, slotNums: false, pips: false, parts: { head: false, name: true, level: true } },
        neon: { values: true, slotNums: false, pips: false, parts: { head: false, name: true, level: true } },
        steam: { values: true, slotNums: false, pips: false, parts: { head: false, level: true } },
        gothic: { values: true, slotNums: false, pips: true, parts: { head: false, level: true } },
        bubble: { values: false, slotNums: false, pips: false, parts: { head: false, name: true, level: true } },
        pirate: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        samurai: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        winter: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        halloween: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        arcade: { values: false, slotNums: false, pips: true, parts: { head: false, name: true, level: true } },
        ocean: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        desert: { values: false, slotNums: false, pips: false, parts: { head: false, level: true } },
        // set 4 (hudforge_v2_set4.js)
        oathblade: { values: false, slotNums: false, pips: true, parts: { head: false, level: true } },
        wyrmwing: { values: false, slotNums: false, pips: true, parts: { head: false, level: true } },
        sovereign: { values: false, slotNums: false, pips: true, parts: { head: false, level: true } },
        starfall: { values: true, slotNums: false, pips: true, parts: { head: false, level: true } },
        grimoire: { values: false, slotNums: false, pips: false, parts: { head: false, name: true, level: true } },
        warbar: { values: true, slotNums: true, pips: false, parts: { head: false, name: true, level: true } },
        mech: { values: true, slotNums: false, pips: false, parts: { head: false, level: true } },
        fieldops: { values: true, slotNums: true, pips: false, parts: { head: false, level: true } },
    };
    const DIGITS = {
        1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xx.', '..x', '.x.', 'x..', 'xxx'], 3: ['xx.', '..x', '.x.', '..x', 'xx.'],
        4: ['x.x', 'x.x', 'xxx', '..x', '..x'], 5: ['xxx', 'x..', 'xx.', '..x', 'xx.'], 6: ['.xx', 'x..', 'xxx', 'x.x', 'xxx'],
        7: ['xxx', '..x', '.x.', '.x.', '.x.'], 8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'], 9: ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
    };
    const INFO = {
        money: { icon: 'coin', papi: '%vault_eco_balance_formatted%' },
        time: { icon: 'clock', papi: '%server_time_HH:mm%' },
        coords: { icon: 'pin', papi: '%player_x% %player_y% %player_z%' },
    };
    const SAMPLE = {
        '%player_name%': 'Steve', '%vault_eco_balance_formatted%': '12.4k', '%server_time_HH:mm%': '14:30',
        '%player_x%': '-128', '%player_y%': '64', '%player_z%': '256', '%player_health_rounded%': '16',
        '%player_food_level%': '13', '%player_remaining_air%': '300', '%player_max_health_rounded%': '20',
        '%player_max_air%': '300', '%player_level%': '27',
    };
    const SAMPLE_FILL = { hp: 0.8, food: 0.65, armor: 0.6, air: 1, xp: 0.4, mana: 0.7 };
    // Same defaults the Properties panel applies when the text alignment changes
    const TEXT_ALIGN = {
        left: { anchor: 'top_left', offsets: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] } },
        center: { anchor: 'center', offsets: { small: [0, 0.9], normal: [0, 1.4], large: [0, 2] } },
        right: { anchor: 'top_right', offsets: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] } },
    };
    const STORE_LAST = 'kzHudForge.last5';
    const STORE_TPL = 'kzHudForge.templates2';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const r2 = (v) => Math.round(v * 100) / 100;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    /* ───────────── colour: hue-shifted pixel-art ramps ───────────── */

    const hexCache = new Map();
    function hex(c) {
        let v = hexCache.get(c);
        if (v) return v;
        let h = String(c || '#000').replace('#', '');
        if (h.length === 3) h = h.replace(/./g, '$&$&');
        v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
        hexCache.set(c, v);
        return v;
    }
    const toHex = (a) => '#' + a.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
    const rgb01 = (c) => hex(c).map((v) => Math.round((v / 255) * 1000) / 1000);

    function rgb2hsl([r, g, b]) {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const l = (mx + mn) / 2;
        if (mx === mn) return [0, 0, l];
        const d = mx - mn;
        const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h / 6, s, l];
    }
    function hsl2rgb(h, s, l) {
        if (!s) return [l * 255, l * 255, l * 255];
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const f = (t) => {
            t = (t + 1) % 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
    }
    function lerpHue(a, b, t) {
        let d = b - a;
        if (d > 0.5) d -= 1;
        if (d < -0.5) d += 1;
        return (a + d * t + 1) % 1;
    }
    /** k < 0 darker (hue leans blue/purple), k > 0 lighter (hue leans yellow) */
    function shade(c, k) {
        const [h, s, l] = rgb2hsl(hex(c));
        const grey = s < 0.08;
        let H, Sa, L;
        if (k < 0) {
            const t = -k;
            H = grey ? 0.64 : lerpHue(h, 0.68, t * 0.2);
            Sa = grey ? Math.min(0.14, s + t * 0.12) : Math.min(1, s + t * 0.12);
            L = l * (1 - t * 0.8);
        } else {
            H = grey ? 0.13 : lerpHue(h, 0.14, k * 0.14);
            Sa = grey ? Math.min(0.1, s + k * 0.06) : s * (1 - k * 0.3);
            L = l + (1 - l) * k * 0.78;
        }
        return toHex(hsl2rgb(H, Sa, L));
    }
    const rampCache = new Map();
    function ramp(c) {
        let r = rampCache.get(c);
        if (r) return r;
        r = { o: shade(c, -0.78), d2: shade(c, -0.5), d: shade(c, -0.26), b: c, l: shade(c, 0.3), l2: shade(c, 0.6) };
        rampCache.set(c, r);
        return r;
    }
    // hand-picked ramps from the kits win over computed ones (looked up by their base colour)
    for (const a of D.RAMPS || []) rampCache.set(a[3], { o: a[0], d2: a[1], d: a[2], b: a[3], l: a[4], l2: a[5] });

    /* ───────────── 3D-lit pieces (one light, top-left-front) ───────────── */

    const LIGHT = (() => { const v = [-0.55, -0.68, 0.48]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
    function litRole(i) {
        if (i > 0.93) return 'l2';
        if (i > 0.74) return 'l';
        if (i > 0.48) return 'b';
        if (i > 0.22) return 'd';
        return 'd2';
    }
    /** a sphere (knob, rivet, round gem), outlined with its own darkest shade */
    function litSphere(buf, x0, y0, d, R) {
        const r = d / 2;
        for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
            const nx = (x + 0.5 - r) / r;
            const ny = (y + 0.5 - r) / r;
            const q = nx * nx + ny * ny;
            if (q > 1) continue;
            const edge = Math.hypot(x + 0.5 - r, y + 0.5 - r) > r - 1;
            const nz = Math.sqrt(1 - q);
            buf.set(x0 + x, y0 + y, edge ? R.o : R[litRole(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])]);
        }
    }
    /** a cut gem: four flat facets + a table, lit from the top-left */
    function litDiamond(buf, x0, y0, d, R) {
        const c = (d - 1) / 2;
        for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
            const dx = x - c;
            const dy = y - c;
            const m = Math.abs(dx) + Math.abs(dy);
            if (m > c + 0.5) continue;
            let role;
            if (m > c - 0.5) role = 'o';
            else if (m < c * 0.35) role = dx + dy < 0 ? 'l' : 'b';                     // table
            else if (dx <= 0 && dy <= 0) role = 'l';
            else if (dx > 0 && dy < 0) role = 'b';
            else if (dx < 0 && dy > 0) role = 'd';
            else role = 'd2';
            buf.set(x0 + x, y0 + y, R[role]);
        }
        // one sparkle on the lit facet
        const s = Math.max(1, Math.round(c * 0.45));
        buf.set(x0 + Math.round(c - s), y0 + Math.round(c - s * 0.6), R.l2);
        if (d >= 9) buf.set(x0 + Math.round(c - s + 1), y0 + Math.round(c - s * 0.6), R.l2);
    }

    /** copy of a canvas with a 1px drop shadow (down-right) under every opaque pixel */
    function withShadow(src, alpha) {
        const out = canvas(src.width + 1, src.height + 1);
        const ctx = out.getContext('2d');
        const sil = canvas(src.width, src.height);
        const sctx = sil.getContext('2d');
        sctx.drawImage(src, 0, 0);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = `rgba(0,0,0,${alpha == null ? 0.45 : alpha})`;
        sctx.fillRect(0, 0, sil.width, sil.height);
        ctx.drawImage(sil, 1, 1);
        ctx.drawImage(src, 0, 0);
        return out;
    }

    function rnd(x, y, s) {
        let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    /* ───────────── pixel buffer ───────────── */

    function canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(h));
        return c;
    }
    function upscale(c, q) {
        if (q === 1) return c;
        const o = canvas(c.width * q, c.height * q);
        const x = o.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(c, 0, 0, o.width, o.height);
        return o;
    }
    function pxBuf(w, h) {
        const c = canvas(w, h);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(c.width, c.height);
        const d = img.data;
        return {
            w: c.width,
            h: c.height,
            set(x, y, col, a) {
                x |= 0; y |= 0;
                if (!col || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
                const [r, g, b] = hex(col);
                const i = (y * this.w + x) * 4;
                d[i] = r; d[i + 1] = g; d[i + 2] = b;
                d[i + 3] = Math.round((a == null ? 1 : a) * 255);
            },
            done() { ctx.putImageData(img, 0, 0); return c; },
        };
    }
    /** Draws a sprite (rows of role letters) with a palette; flip for mirrored corners */
    function blit(buf, rows, x0, y0, pal, flipX, flipY) {
        const h = rows.length;
        rows.forEach((row, y) => {
            const w = row.length;
            [...row].forEach((ch, x) => {
                if (ch === '.' || !pal[ch]) return;
                buf.set(x0 + (flipX ? w - 1 - x : x), y0 + (flipY ? h - 1 - y : y), pal[ch]);
            });
        });
    }

    /* ───────────── masks + distance from the edge ───────────── */

    function shapeMask(w, h, shape, r) {
        const R = Math.max(0, Math.min(r | 0, Math.floor(Math.min(w, h) / 2)));
        if (shape === 'round' && R > 0) {
            const lim = R * R - R + 0.01;
            return (x, y) => {
                const dx = x < R ? R - x - 0.5 : x >= w - R ? x - (w - R) + 0.5 : 0;
                const dy = y < R ? R - y - 0.5 : y >= h - R ? y - (h - R) + 0.5 : 0;
                return !dx || !dy || dx * dx + dy * dy < lim;
            };
        }
        if (shape === 'chamfer' && R > 0) {
            return (x, y) => {
                const ix = x < R ? x : x >= w - R ? w - 1 - x : -1;
                const iy = y < R ? y : y >= h - R ? h - 1 - y : -1;
                return ix < 0 || iy < 0 || ix + iy >= R;
            };
        }
        if (shape === 'circle') {
            const c = (w - 1) / 2;
            const rr = (w / 2) * (w / 2) - 0.3;
            return (x, y) => (x - c) * (x - c) + (y - c) * (y - c) <= rr;
        }
        if (shape === 'diamond') {
            const c = (w - 1) / 2;
            return (x, y) => Math.abs(x - c) + Math.abs(y - c) <= c + 0.5;
        }
        if (shape === 'shield') {
            const c = (w - 1) / 2;
            const top = Math.round(h * 0.5);
            return (x, y) => {
                if ((x === 0 || x === w - 1) && y === 0) return false;
                if (y < top) return true;
                const t = (y - top + 1) / (h - top);
                return Math.abs(x - c) <= c * (1 - t * t) + 0.5;
            };
        }
        return () => true;
    }

    /** Ring index of every pixel: 0 = outline, 1 = first ring inside, … (-1 = outside) */
    function distMap(w, h, m) {
        const d = new Int16Array(w * h).fill(-1);
        const q = [];
        const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m(x, y);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!m(x, y)) continue;
            if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { d[y * w + x] = 0; q.push(x, y); }
        }
        for (let i = 0; i < q.length; i += 2) {
            const x = q[i];
            const y = q[i + 1];
            const k = d[y * w + x];
            for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (!inside(nx, ny) || d[ny * w + nx] !== -1) continue;
                d[ny * w + nx] = k + 1;
                q.push(nx, ny);
            }
        }
        return d;
    }

    function texel(texture, x, y, base, seed) {
        const R = ramp(base);
        switch (texture) {
            case 'noise': { const r = rnd(x, y, seed); return r < 0.14 ? shade(base, -0.1) : r > 0.88 ? shade(base, 0.08) : base; }
            case 'stone': {
                const v = rnd(x >> 1, y >> 1, seed) * 0.6 + rnd(x, y, seed + 1) * 0.4;
                return v < 0.28 ? shade(base, -0.16) : v > 0.74 ? shade(base, 0.1) : base;
            }
            case 'wood': {
                const row = Math.floor(y / 5);
                if (y % 5 === 4) return R.d;
                const off = (row * 7) % 17;
                if ((x + off) % 17 === 0) return shade(base, -0.2);
                const g = rnd(Math.floor((x + off) / 3), y, seed + row);
                return g < 0.14 ? shade(base, -0.12) : g > 0.9 ? shade(base, 0.07) : base;
            }
            case 'brick': {
                const row = Math.floor(y / 4);
                const off = (row % 2) * 4;
                if (y % 4 === 3 || (x + off) % 8 === 7) return R.d;
                return y % 4 === 0 ? shade(base, 0.08) : base;
            }
            case 'stars': { const r = rnd(x, y, seed); return r < 0.02 ? R.l2 : r < 0.05 ? shade(base, 0.25) : base; }
            case 'checker': return ((x >> 1) + (y >> 1)) % 2 ? shade(base, 0.05) : base;
            case 'scan': return y % 3 === 0 ? shade(base, 0.07) : base;
            default: return base;
        }
    }

    /**
     * Pixel-art frame: outline → bevelled rim → inner line → body (with inset shadow).
     * o: shape r outline rim rimW inner body texture seed flat inset | mask isBody(x,y) bodyFn(x,y,sides) rimRamp
     */
    function drawFrame(buf, ox, oy, w, h, o) {
        const m = o.mask || shapeMask(w, h, o.shape || 'rect', o.r || 0);
        const d = distMap(w, h, m);
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : d[y * w + x]);
        const R = o.rimRamp || ramp(o.rim);
        const rimW = o.rimW == null ? 1 : o.rimW;
        const firstBody = rimW + (o.inner ? 1 : 0) + 1;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const k = at(x, y);
                if (k < 0) continue;
                const s = { t: at(x, y - 1) < k, b: at(x, y + 1) < k, l: at(x - 1, y) < k, r: at(x + 1, y) < k };
                const body = o.isBody ? o.isBody(x, y, k) : k >= firstBody;
                let col;
                if (k === 0) {
                    col = o.outline;
                } else if (body) {
                    if (o.bodyFn) col = o.bodyFn(x, y, s, k);
                    else {
                        col = texel(o.texture, x, y, o.body, o.seed || 1);
                        if (k === firstBody && !o.flat) {
                            if (s.t) col = ramp(o.body).d;
                            else if (s.l) col = shade(col, -0.12);
                            else if (s.b) col = shade(col, 0.1);
                        }
                    }
                } else if (o.inner && k === rimW + 1 && !o.isBody) {
                    col = o.inner;
                } else if (o.flat) {
                    col = R.b;
                } else {
                    let lit = s.t || s.l;
                    let dk = s.b || s.r;
                    if (o.inset) [lit, dk] = [dk, lit];
                    const kk = Math.min(k, Math.max(1, rimW));
                    if (lit && !dk) col = kk === 1 ? (o.inset ? (s.b ? R.l2 : R.l) : (s.t ? R.l2 : R.l)) : R.l;
                    else if (dk && !lit) col = kk === 1 ? (o.inset ? (s.t ? R.d2 : R.d) : (s.b ? R.d2 : R.d)) : R.d;
                    else col = R.b;
                }
                buf.set(ox + x, oy + y, col);
            }
        }
        return { m, d };
    }

    /* ───────────── decorations ───────────── */

    function ornPalette(t) {
        const OR = ramp(t.ornColor || t.rim);
        const GR = ramp(t.gem || t.accent || '#e0304a');
        return { o: OR.o, b: OR.b, l: OR.l, d: OR.d, w: OR.l2, g: GR.b, h: GR.l2, y: '#ffe066' };
    }

    function leafPalette(t) {
        const R = ramp(t.leafColor || '#47963a');
        return { o: R.o, b: R.b, l: R.l, d: R.d, w: R.l2, g: R.b, h: R.l2, y: '#ffe066' };
    }

    function drawOrn(buf, w, h, t, seed, small) {
        const kinds = t.orn || [];
        if (!kinds.length || w < 16 || h < 12) return;
        const pal = ornPalette(t);
        const B = 1 + (t.rimW || 1);
        const inner = B + (t.inner ? 1 : 0);
        for (const kind of kinds) {
            if (kind === 'brackets' && h >= 14 && w >= 18) {
                blit(buf, D.ORN.bracket, 0, 0, pal);
                blit(buf, D.ORN.bracket, w - 7, 0, pal, true);
                blit(buf, D.ORN.bracket, 0, h - 7, pal, false, true);
                blit(buf, D.ORN.bracket, w - 7, h - 7, pal, true, true);
            } else if (kind === 'gems' && w >= 22) {
                blit(buf, D.ORN.gem, Math.floor(w / 2) - 2, 0, pal);
                if (h >= 24 && !small) blit(buf, D.ORN.gem, Math.floor(w / 2) - 2, h - 5, pal);
            } else if (kind === 'rivets' && w >= 14 && h >= 12) {
                [[inner, inner], [w - inner - 2, inner], [inner, h - inner - 2], [w - inner - 2, h - inner - 2]].forEach(([x, y]) => blit(buf, D.ORN.rivet, x, y, pal));
            } else if (kind === 'studs' && w >= 14 && h >= 12) {
                [[B - 1, B - 1], [w - B - 2, B - 1], [B - 1, h - B - 2], [w - B - 2, h - B - 2]].forEach(([x, y]) => blit(buf, D.ORN.stud, x, y, pal));
            } else if (kind === 'leaves') {
                const n = Math.max(1, Math.floor(w / 26));
                for (let i = 0; i < n; i++) {
                    const x = Math.floor(((i + 0.5) / n) * (w - 8) + (rnd(i, w, seed) - 0.5) * 6);
                    blit(buf, D.ORN.leaf, clamp(x, 0, w - 8), 0, leafPalette(t), rnd(i, 3, seed) < 0.5);
                }
                if (h >= 18) blit(buf, D.ORN.leaf, w - 8, h - 5, leafPalette(t), true, true);
            } else if (kind === 'flowers') {
                const n = Math.max(1, Math.floor(w / 18));
                for (let i = 0; i < n; i++) blit(buf, D.ORN.flower, clamp(Math.floor(((i + 0.3) / n) * w + rnd(i, 9, seed) * 6), 1, w - 4), 0, pal);
            } else if (kind === 'icicles') {
                for (let x = B + 1; x < w - B - 1; x++) {
                    if (rnd(x, 1, seed) > 0.42) continue;
                    const len = 1 + Math.floor(rnd(x, 2, seed) * (h >= 16 ? 4 : 2));
                    for (let i = 0; i < len; i++) buf.set(x, inner + i, i === len - 1 ? pal.l : pal.w);
                }
            } else if (kind === 'flames') {
                for (let x = B; x < w - B; x++) {
                    const hg = 1 + Math.floor(rnd(x, 5, seed) * (h >= 16 ? 4 : 2)) + (x % 6 === 0 ? 1 : 0);
                    for (let i = 0; i < hg; i++) buf.set(x, h - 1 - inner - i, i === 0 ? '#e8461a' : i === hg - 1 ? '#ffe066' : '#ffa020');
                }
            } else if (kind === 'spikes' && w >= 18) {
                blit(buf, D.ORN.horn, B, B, pal);
                blit(buf, D.ORN.horn, w - B - 5, B, pal, true);
            } else if (kind === 'cracks') {
                for (let c = 0; c < 2; c++) {
                    let x = Math.floor(inner + 2 + rnd(c, w, seed) * (w - 2 * inner - 4));
                    let y = inner + 1;
                    for (let i = 0; i < Math.min(10, h - 2 * inner - 2); i++) {
                        buf.set(x, y, ramp(t.body).o);
                        y++;
                        x += rnd(c, i, seed) < 0.5 ? -1 : 1;
                    }
                }
            } else if (kind === 'stars' || kind === 'bubbles') {
                const n = Math.max(1, Math.floor((w * h) / 260));
                for (let i = 0; i < n; i++) {
                    const x = Math.floor(inner + 1 + rnd(i, 7, seed) * (w - 2 * inner - 4));
                    const y = Math.floor(inner + 1 + rnd(7, i, seed) * (h - 2 * inner - 4));
                    blit(buf, kind === 'stars' ? D.ORN.star : D.ORN.bubble, x, y, pal);
                }
            } else if (kind === 'hearts' && w >= 20 && h >= 14) {
                blit(buf, D.ORN.heart, w - inner - 6, inner + 1, pal);
                if (!small) blit(buf, D.ORN.heart, inner + 1, h - inner - 5, pal);
            } else if (kind === 'gears' && w >= 20 && h >= 14) {
                blit(buf, D.ORN.gear, 0, 0, pal);
                if (!small) blit(buf, D.ORN.gear, w - 7, h - 7, pal);
            } else if (kind === 'ticks' && w >= 24) {
                for (let x = inner + 2; x < w - inner - 2; x += 4) {
                    buf.set(x, h - inner - 2, pal.d);
                    if ((x - inner - 2) % 16 === 0) buf.set(x, h - inner - 3, pal.d);
                }
            }
        }
    }

    /* ───────────── textures ───────────── */

    function panelTex(w, h, t, q, opts) {
        opts = opts || {};
        const buf = pxBuf(w, h);
        drawFrame(buf, 0, 0, w, h, {
            shape: t.shape, r: t.r || 2, outline: t.outline, rim: t.rim, rimW: t.rimW || 1,
            inner: t.inner, body: opts.body || t.body, texture: opts.texture != null ? opts.texture : t.texture,
            seed: w * 31 + h, flat: t.flat,
        });
        if (!opts.plain) drawOrn(buf, w, h, t, w * 7 + h, h < 20);
        return upscale(buf.done(), q);
    }

    function plateTex(w, h, t, q) {
        const buf = pxBuf(w, h);
        drawFrame(buf, 0, 0, w, h, {
            shape: t.shape === 'chamfer' ? 'chamfer' : 'rect', r: 1, outline: t.outline, rim: t.barRim || t.rim, rimW: 1,
            inner: null, body: t.channel, texture: 'none', flat: t.flat,
        });
        return upscale(buf.done(), q);
    }

    function badgeTex(s, t, q) {
        const buf = pxBuf(s, s);
        const shape = t.badge === 'square' ? 'round' : t.badge || 'diamond';
        const G = ramp(t.gem || t.accent || '#e0304a');
        // metal setting …
        drawFrame(buf, 0, 0, s, s, {
            shape, r: 2, outline: t.outline, rim: t.rim, rimW: 2, inner: t.inner, body: G.d2, flat: t.flat,
        });
        // … holding a lit gem (cut for diamond / square / shield, round for circle)
        const inset = shape === 'diamond' ? 5 : 4;
        const gd = s - inset * 2;
        if (shape === 'circle') litSphere(buf, inset, inset, gd, G);
        else litDiamond(buf, inset - (shape === 'diamond' ? 0 : 1), inset - (shape === 'diamond' ? 0 : 1) - (shape === 'shield' ? 1 : 0), gd + (shape === 'diamond' ? 0 : 2), G);
        return upscale(buf.done(), q);
    }

    function iconTex(name, color, q) {
        const rows = D.ICONS[name] || D.ICONS.xp;
        const R = ramp(color);
        const buf = pxBuf(IS, IS);
        blit(buf, rows, 0, 0, { o: R.o, b: R.b, l: R.l, d: R.d, w: R.l2 });
        return upscale(buf.done(), q);
    }

    /* bar geometry: caps on both ends, a bevelled frame, a recessed channel; the fill sits in the channel */
    function barGeom(t, style, w, h, opts) {
        if (opts.pips) {
            const n = clamp(Math.floor((w + 1) / (PIP + 1)), 4, 10);
            const bw = n * (PIP + 1) - 1;
            return { pips: true, n, bw, bh: PIP, fx: 0, fy: 0, fw: bw, fh: PIP, capW: 0 };
        }
        h = Math.max(4, Math.round(h));
        w = Math.max(16, Math.round(w));
        const cap = style.cap || 'none';
        const rimW = h >= 6 ? 1 : 0;
        const B = 1 + rimW;
        // knob / gem ends are whole spheres / gems over the frame end: the channel starts after them
        const capW = cap === 'none' ? 0 : cap === 'bolt' || cap === 'notch' ? 3 : cap === 'gem' || cap === 'knob' ? Math.max(3, h - 2)
            : cap === 'slant' ? Math.max(3, Math.ceil(h * 0.6)) : Math.max(2, Math.floor(h / 2));
        let fw = w - 2 * capW - 2 * B;
        const fh = h - 2 * B;
        let cells = null;
        if (style.segmented) {
            const n = clamp(opts.segs || 10, 2, Math.floor((fw + 1) / 3));
            const cw = Math.max(1, Math.floor((fw - (n - 1)) / n));
            fw = n * cw + (n - 1);
            cells = [];
            for (let i = 0; i < n; i++) cells.push({ x: i * (cw + 1), w: cw });
        }
        const bw = fw + 2 * B + 2 * capW;
        return { bw, bh: h, cap, capW, rimW, B, fx: capW + B, fy: B, fw, fh, cells };
    }

    function capInside(cap, cw, h, x, y, side) {
        const mid = (h - 1) / 2;
        const half = h / 2;
        const dy = Math.abs(y - mid);
        // parallelogram ("/"): the left end leans right at the top, the right end leans left at the bottom
        if (cap === 'slant') return side === 'r' ? x >= Math.round((cw - 1) * (y / (h - 1))) : x >= Math.round((cw - 1) * (1 - y / (h - 1)));
        if (cap === 'point' || cap === 'blade' || cap === 'gem') return cw - x <= ((half - dy) * cw) / half + 0.2;
        if (cap === 'knob') { const c = (h - 1) / 2; return (x - c) ** 2 + (y - c) ** 2 <= half * half - 0.2; }
        if (cap === 'round') { const cx = cw; const cy = h / 2; return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= half * half + 0.3; }
        if (cap === 'bolt') return y >= 1 && y <= h - 2;
        if (cap === 'notch') return x >= Math.round((1 - dy / half) * (cw - 1));
        return false;
    }

    function inCell(g, x) {
        if (!g.cells) return true;
        for (const c of g.cells) if (x >= c.x && x < c.x + c.w) return true;
        return false;
    }

    /* glass-tube fill: a lit lip, a highlight band near the top, darker towards the bottom */
    function fillRole(y, fh) {
        if (fh <= 1) return 'b';
        if (fh === 2) return y === 0 ? 'l' : 'd';
        if (fh === 3) return ['l2', 'b', 'd'][y];
        if (fh === 4) return ['l', 'l2', 'b', 'd2'][y];
        if (y === 0) return 'l';
        if (y === 1) return 'l2';
        if (y === fh - 1) return 'd2';
        if (y === fh - 2) return 'd';
        return 'b';
    }
    const LIGHTER = { d2: 'd', d: 'b', b: 'l', l: 'l2', l2: 'l2' };

    function pipTex(g, stat, color, q, empty, t) {
        const buf = pxBuf(g.bw, g.bh);
        const rows = D.PIPS[stat] || D.PIPS.hp;
        let pal;
        if (empty) {
            const IR = ramp(t.channel);
            pal = { o: IR.o, b: IR.l, l: IR.l2, d: IR.b, w: IR.l2 };
        } else {
            const R = ramp(color);
            pal = { o: R.o, b: R.b, l: R.l, d: R.d, w: R.l2 };
        }
        for (let i = 0; i < g.n; i++) blit(buf, rows, i * (PIP + 1), 0, pal);
        return upscale(buf.done(), q);
    }

    function trackTex(g, t, q, stat) {
        if (g.pips) return pipTex(g, stat, null, q, true, t);
        const { bw, bh, capW, cap } = g;
        const buf = pxBuf(bw, bh);
        const inFill = (x, y) => x >= g.fx && x < g.fx + g.fw && y >= g.fy && y < g.fy + g.fh;
        const mask = (x, y) => {
            if (x < capW) return capInside(cap, capW, bh, x, y, 'l');
            if (x >= bw - capW) return capInside(cap, capW, bh, bw - 1 - x, y, 'r');
            return true;
        };
        const IR = ramp(t.channel);
        const notch = t.fill === 'notch' ? t.notch || 6 : 0;
        drawFrame(buf, 0, 0, bw, bh, {
            mask, outline: t.outline, rim: t.barRim || t.rim, rimW: Math.max(1, g.rimW), flat: t.flat,
            isBody: (x, y) => inFill(x, y),
            // recessed channel: shadow under the top wall, a lit lip at the bottom
            bodyFn: (x, y) => {
                const fx = x - g.fx;
                const fy = y - g.fy;
                if (!inCell(g, fx)) return ramp(t.barRim || t.rim).d;
                if (fy === 0) return IR.o;
                if (fy === 1 && g.fh > 3) return IR.d2;
                if (fy === g.fh - 1 && g.fh > 2) return IR.b;
                if (notch && fx % notch === notch - 1) return IR.b;
                return IR.d;
            },
        });
        // 3D ends: a lit sphere (knob) or a cut gem sitting over each end of the frame
        if (cap === 'knob' || cap === 'gem') {
            const d = bh % 2 ? bh : bh - 1;
            const y0 = Math.floor((bh - d) / 2);
            const R = cap === 'gem' ? ramp(t.gem || t.accent) : ramp(t.barRim || t.rim);
            for (const x0 of [0, bw - d]) {
                if (cap === 'gem') litDiamond(buf, x0, y0, d, R);
                else litSphere(buf, x0, y0, d, R);
            }
        }
        return upscale(buf.done(), q);
    }

    function fillTex(g, t, color, q, stat) {
        if (g.pips) return pipTex(g, stat, color, q, false, t);
        const buf = pxBuf(g.fw, g.fh);
        const R = ramp(color);
        const style = t.fill || 'gloss';
        const notch = t.notch || 6;
        for (let y = 0; y < g.fh; y++) {
            for (let x = 0; x < g.fw; x++) {
                if (!inCell(g, x)) continue;
                let role = style === 'flat' ? (y === 0 ? 'l' : 'b') : fillRole(y, g.fh);
                if (style === 'gloss' && y === (g.fh >= 4 ? 1 : 0) && [3, 4, 5].includes(x % 18)) role = 'l2';
                if (style === 'notch' && x % notch === notch - 1 && y > 0) role = y === g.fh - 1 ? 'd2' : 'd';
                if (style === 'stripes' && (x + y) % 6 < 2) role = LIGHTER[role];
                if (style === 'liquid') {
                    if (y === 0) role = (x + Math.round(Math.sin(x / 2) * 1.5)) % 5 < 2 ? 'l2' : 'l';
                    else if (y > 1 && y < g.fh - 1 && rnd(x, y, 11) < 0.05) role = 'l2';
                }
                buf.set(x, y, R[role]);
            }
        }
        return upscale(buf.done(), q);
    }

    function headFrameTex(s, t, q) {
        const buf = pxBuf(s, s);
        drawFrame(buf, 0, 0, s, s, {
            shape: 'rect', outline: t.outline, rim: t.rim, rimW: t.rimW || 1, inner: t.inner, body: t.channel, texture: 'none', flat: t.flat,
        });
        const kinds = (t.orn || []).filter((k) => k === 'brackets' || k === 'rivets' || k === 'gears');
        if (kinds.length) drawOrn(buf, s, s, { ...t, orn: kinds }, 5, true);
        return upscale(buf.done(), q);
    }
    const headInset = (t) => 1 + (t.rimW || 1) + (t.inner ? 1 : 0);

    function selectionTex(t) {
        const buf = pxBuf(24, 24);
        const A = ramp(t.accent || '#ffffff');
        const m = shapeMask(24, 24, t.shape === 'round' ? 'round' : t.shape === 'chamfer' ? 'chamfer' : 'rect', 2);
        const d = distMap(24, 24, m);
        for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
            const k = d[y * 24 + x];
            if (k < 0 || k > 2) continue;
            const corner = Math.min(x, 23 - x) < 5 && Math.min(y, 23 - y) < 5;
            if (k === 0) buf.set(x, y, t.outline);
            else if (k === 1) buf.set(x, y, corner ? A.l2 : (x + y < 24 ? A.l : A.b));
            else buf.set(x, y, corner ? A.l : A.d);
        }
        return buf.done();
    }

    function hotbarSheet(t) {
        const bar = pxBuf(182, 22);
        drawFrame(bar, 0, 0, 182, 22, {
            shape: t.shape === 'chamfer' ? 'chamfer' : 'rect', r: 2, outline: t.outline, rim: t.rim, rimW: 1,
            inner: null, body: ramp(t.rim).d, texture: 'none', flat: t.flat,
        });
        const slotOutline = ramp(t.slot || t.channel).o;
        for (let i = 0; i < 9; i++) {
            drawFrame(bar, 2 + 20 * i, 2, 18, 18, {
                // recessed slot: shadowed top/left wall, lit bottom/right lip
                shape: 'rect', outline: slotOutline, rim: t.slot || t.channel, rimW: 1, inset: true, body: t.slot || t.channel,
                texture: 'none', seed: i + 3, flat: t.flat,
            });
            if (state.slotNums) {
                const col = shade(t.slot || t.channel, 0.5);
                DIGITS[i + 1].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') bar.set(2 + 20 * i + 2 + x, 4 + y, col); }));
            }
        }
        const sheet = canvas(256, 256);
        const ctx = sheet.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bar.done(), 0, 0);
        ctx.drawImage(selectionTex(t), 0, 22);
        return sheet;
    }

    /* ───────────── assemblies: one connected frame with engraved sockets/channels ───────────── */

    /** thickness of a theme's frame: outline + rim + inner line */
    function frameT() {
        const t = sk();
        return 1 + (t.rimW || 1) + (t.inner ? 1 : 0);
    }
    /** how each row of a card ends (staircase edge) */
    function bandCap() {
        const st = barStyle();
        if (['slant', 'point', 'round'].includes(st.cap)) return st.cap;
        return sk().shape === 'chamfer' ? 'slant' : 'none';
    }

    /** recessed square (head socket, hotbar-end socket) */
    function socketTex(w, h, t) {
        const buf = pxBuf(w, h);
        const c = t.slot || t.channel;
        // recessed: dark wall at the top/left, lit lip at the bottom/right
        drawFrame(buf, 0, 0, w, h, { shape: 'rect', outline: ramp(c).o, rim: c, rimW: 1, inset: true, body: c, flat: t.flat });
        return buf.done();
    }

    /** decorations for an assembly: on the lead block (head socket) and the first row */
    function compOrn(t, lead, band) {
        const out = [];
        const kinds = t.orn || [];
        const F = frameT();
        const spr = (sprite, x, y, flipX, flipY) => {
            const rows = D.ORN[sprite];
            out.push({ k: 'orn', sprite, x, y, w: rows[0].length, h: rows.length, flipX: !!flipX, flipY: !!flipY });
        };
        if (lead && lead.w >= 20) {
            if (kinds.includes('brackets')) {
                spr('bracket', lead.x, lead.y);
                spr('bracket', lead.x, lead.y + lead.h - 7, false, true);
            }
            if (kinds.includes('rivets') || kinds.includes('studs')) {
                const s = kinds.includes('rivets') ? 'rivet' : 'stud';
                const d = 3;
                const a = Math.max(1, F - 2);
                spr(s, lead.x + a, lead.y + a);
                spr(s, lead.x + a, lead.y + lead.h - a - d);
            }
            if (kinds.includes('gears')) spr('gear', lead.x, lead.y + lead.h - 7);
            if (kinds.includes('gems')) spr('gem', lead.x + Math.floor(lead.w / 2) - 2, lead.y);
            if (kinds.includes('spikes')) spr('horn', lead.x + 1, lead.y + 1);
            if (kinds.includes('hearts')) spr('heart', lead.x + 1, lead.y + lead.h - 5);
        }
        if (band && band.w >= 30) {
            const end = band.x + band.w - (band.capW || 0);
            if (kinds.includes('leaves')) { spr('leaf', end - 12, band.y); spr('leaf', band.x + 6, band.y, true); }
            if (kinds.includes('flowers')) { spr('flower', end - 8, band.y); spr('flower', band.x + 14, band.y); }
            if (kinds.includes('gems') && !lead) spr('gem', end - 8, band.y);
        }
        return out;
    }

    /**
     * Renders an assembly: the union of `rects` (rows / blocks, optionally with a shaped end)
     * and `domes` becomes ONE frame (one outline, one bevelled rim, one body), then sockets,
     * bar channels, plates, icons, decorations and the crest are drawn into it.
     */
    function buildComp(spec, t, q) {
        const { w, h } = spec;
        const inRect = (r, x, y) => {
            if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return false;
            if (!r.cap || r.cap === 'none' || !r.capW) return true;
            const lx = r.capSide === 'l' ? x - r.x : r.x + r.w - 1 - x;
            if (lx >= r.capW) return true;
            return capInside(r.cap, r.capW, r.h, lx, y - r.y, r.capSide === 'l' ? 'l' : 'r');
        };
        const inDome = (d, x, y) => {
            const lx = x - d.x;
            const ly = y - d.y;
            if (lx < 0 || ly < 0 || lx >= d.w || ly >= d.h) return false;
            if (ly >= d.h - d.rail) return true;
            const c = (d.w - 1) / 2;
            const yy = (d.h - d.rail - ly) / (d.h - d.rail);
            return Math.abs(lx - c) <= c * Math.sqrt(Math.max(0, 1 - yy * yy)) + 0.5;
        };
        const mask = (x, y) => spec.rects.some((r) => inRect(r, x, y)) || (spec.domes || []).some((d) => inDome(d, x, y));
        const buf = pxBuf(w, h);
        drawFrame(buf, 0, 0, w, h, {
            mask, outline: t.outline, rim: t.rim, rimW: t.rimW || 1, inner: t.inner, body: t.body, texture: t.texture,
            seed: w * 13 + h, flat: t.flat,
        });
        // a sunken arch inside every dome, behind the crest
        for (const d of spec.domes || []) {
            const m = frameT() + 1;
            const iw = d.w - 2 * m;
            const ih = d.h - d.rail - m + 1;
            if (iw < 8 || ih < 6) continue;
            const ic = (iw - 1) / 2;
            const imask = (x, y) => {
                const yy = (ih - y) / ih;
                return Math.abs(x - ic) <= ic * Math.sqrt(Math.max(0, 1 - yy * yy)) + 0.5;
            };
            drawFrame(buf, d.x + m, d.y + m, iw, ih, { mask: imask, outline: ramp(t.channel).o, rim: t.channel, rimW: 1, inset: true, body: t.channel, flat: t.flat });
        }
        const frame = buf.done();
        // the whole frame casts a drop shadow; raised pieces on it cast their own
        const c = withShadow(frame, 0.5);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const pal = ornPalette(t);
        const raised = (img, x, y) => ctx.drawImage(withShadow(img), x, y);
        for (const it of spec.items) {
            if (it.k === 'track') raised(trackTex(it.g, t, 1, it.stat), it.x, it.y);
            else if (it.k === 'icon') raised(iconTex(it.name, it.color, 1), it.x, it.y);
            else if (it.k === 'plate') ctx.drawImage(plateTex(it.w, it.h, t, 1), it.x, it.y);
            else if (it.k === 'socket') ctx.drawImage(socketTex(it.w, it.h, t), it.x, it.y);
            else if (it.k === 'crest') raised(badgeTex(it.w, t, 1), it.x, it.y);
            else if (it.k === 'isock') {
                // round socket set into the frame, the icon sitting in it
                const b = pxBuf(it.w, it.h);
                drawFrame(b, 0, 0, it.w, it.h, { shape: 'circle', outline: t.outline, rim: t.rim, rimW: 1, inset: false, body: t.channel, flat: t.flat });
                raised(b.done(), it.x, it.y);
                raised(iconTex(it.name, it.color, 1), it.x + Math.floor((it.w - IS) / 2), it.y + Math.floor((it.h - IS) / 2));
            } else if (it.k === 'knob') {
                const b = pxBuf(it.w, it.h);
                if (it.gem) litDiamond(b, 0, 0, it.w, ramp(t.gem)); else litSphere(b, 0, 0, it.w, ramp(t.rim));
                raised(b.done(), it.x, it.y);
            }
            else if (it.k === 'orn') {
                const b = pxBuf(it.w, it.h);
                blit(b, D.ORN[it.sprite], 0, 0, it.sprite === 'leaf' && t.leafColor ? leafPalette(t) : pal, it.flipX, it.flipY);
                raised(b.done(), it.x, it.y);
            }
        }
        return upscale(c, q);
    }

    /* ───────────── state ───────────── */

    const DEFAULT_STATE = {
        theme: 'royal', layout: 'fantasy', shape: 'theme', segs: 10, barW: 80, barH: 9,
        icons: true, panels: false, ornaments: true, slotNums: false, values: false, pips: true, quality: 1, bg: 'day',
        parts: { hp: true, food: true, armor: true, air: true, xp: true, mana: false, head: false, name: true, level: true, money: false, time: false, coords: false, hotbar: true },
        colors: {},
        manaPapi: '%auraskills_mana_int%', manaMax: '%auraskills_mana_max_int%',
    };
    let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    let back = null;
    let plan = null;
    let drawTimer = 0;

    const themeById = (id) => D.THEMES.find((t) => t.id === id) || D.THEMES[0];
    const sk = () => themeById(state.theme);
    const on = (k) => !!state.parts[k];
    function barStyle() {
        const t = sk();
        if (state.shape === 'theme') return { cap: t.cap || 'none', segmented: !!t.segmented };
        if (state.shape === 'segmented') return { cap: 'none', segmented: true };
        return { cap: state.shape, segmented: false };
    }
    const isPips = (stat) => (state.layout === 'survival' && ['hp', 'food', 'armor', 'air', 'mana'].includes(stat))
        || (state.pips && PIP_STATS.includes(stat));
    function valuePapi(stat) {
        if (stat === 'mana') return state.manaPapi && state.manaMax ? `${state.manaPapi}/${state.manaMax}` : state.manaPapi;
        return VALUE_PAPI[stat];
    }
    /** Picking a layout also picks the look that belongs to it */
    function applyLayout(id) {
        state.layout = id;
        const st = LAYOUT_STYLE[id] || {};
        const { shape, parts: p, ...rest } = st;
        Object.assign(state, rest);
        if (p) Object.assign(state.parts, p);
        state.shape = shape || 'theme';
    }

    function statColor(stat) {
        const t = sk();
        if (state.colors[stat]) return state.colors[stat];
        if (t.mono) return t.mono.fill;
        let c = (t.stat && t.stat[stat]) || D.STAT_COLORS[stat];
        if (t.pastel) c = mix(c, '#ffffff', 0.3);
        return c;
    }
    function iconColor(key) {
        const t = sk();
        if (t.mono) return t.mono.icon;
        if (D.INFO_ICON_COLOR[key]) return D.INFO_ICON_COLOR[key];
        return statColor(key);
    }
    const sampleText = (p) => String(p).replace(/%[^%\s]+%/g, (m) => (SAMPLE[m] != null ? SAMPLE[m] : /max/i.test(m) ? '100' : '80'));
    const textW = (p, min) => Math.max(min || 0, sampleText(p).length * CHAR_W + 2);

    /* ───────────── layouts → plan ───────────── */

    /* what the v2 layouts (hudforge_v2.js) may use from the engine */
    const isV2 = () => !!(window.HudForgeV2 && HudForgeV2.has(state.layout));
    function v2ctx() {
        const arr = (r) => [r.o, r.d2, r.d, r.b, r.l, r.l2];
        return {
            t: sk(), state, on, INFO, textW, withShadow, iconColor, valuePapi,
            rampOf: (c) => arr(ramp(c)),
            statRamp: (s) => {
                const c = statColor(s);
                return c === D.STAT_COLORS[s] && D.STAT_RAMPS[s] ? D.STAT_RAMPS[s] : arr(ramp(c));
            },
        };
    }
    const hotbarFor = (t) => (isV2() && HudForgeV2.hotbar(state.layout, v2ctx())) || hotbarSheet(t);

    function planner() {
        if (isV2()) return HudForgeV2.plan(state.layout, v2ctx());
        const parts = [];
        const rowH = Math.max(state.barH, state.icons ? IS : 0);
        const textColor = () => (state.panels ? sk().text : '#ffffff');
        const textShadow = () => (state.panels ? !!sk().shadow : true);

        /* one stat row: icon + bar (or a pip row). iconOut puts the icon outside the given width */
        function barRow(stat, x, y, w, anchor, mirror, iconOut) {
            const bh = state.barH;
            const rh = iconOut ? Math.max(bh, IS) : rowH;
            if (isPips(stat)) {
                const pw = Math.min(w, 10 * (PIP + 1) - 1);
                parts.push({ t: 'bar', stat, x: mirror ? x + w - pw : x, y: y + Math.floor((rh - PIP) / 2), w: pw, h: PIP, dir: mirror ? 'right' : 'left', anchor, pips: true });
                return;
            }
            let bx = x;
            let bw = w;
            if (state.icons) {
                const iy = y + Math.floor((rh - IS) / 2);
                const ix = iconOut ? (mirror ? x + w + 2 : x - IS - 2) : (mirror ? x + w - IS : x);
                parts.push({ t: 'icon', icon: D.STAT_ICON[stat], color: iconColor(stat), x: ix, y: iy, w: IS, h: IS, anchor });
                if (!iconOut) { bw = w - IS - 1; if (!mirror) bx = x + IS + 1; }
            }
            const by = y + Math.floor((rh - bh) / 2);
            parts.push({ t: 'bar', stat, x: bx, y: by, w: bw, h: bh, dir: mirror ? 'right' : 'left', anchor });
            const vp = valuePapi(stat);
            if (state.values && vp && bh >= 8) {
                parts.push({ t: 'text', papi: vp, x: bx + bw / 2, y: by + bh / 2, align: 'center', anchor, color: '#ffffff', shadow: true, w: textW(vp) });
            }
        }

        /*
         * One bar row inside an assembly: the icon sits in a round socket set into the frame,
         * then the bar channel. side 'r' mirrors it (socket on the right, fills from the right).
         * Pushes engraved pieces to `items` and the separate elements to `over`.
         */
        const SOCK = 11;
        const statRowH = () => Math.max(state.barH, state.icons ? SOCK : 0);
        function statRow(items, over, stat, x, y, w, side) {
            const t = sk();
            const style = barStyle();
            const rh = statRowH();
            const dir = side === 'r' ? 'right' : 'left';
            if (isPips(stat)) {
                const g = barGeom(t, style, w, PIP, { pips: true });
                const px = side === 'r' ? x + w - g.bw : x;
                const py = y + Math.floor((rh - PIP) / 2);
                items.push({ k: 'track', g, stat, x: px, y: py, w: g.bw, h: g.bh });
                over.push({ t: 'bar', stat, x: px, y: py, w: g.bw, h: g.bh, g, dir, pips: true, inComp: true });
                return g.bw;
            }
            let x0 = x;
            let x1 = x + w;
            if (state.icons) {
                const sx = side === 'r' ? x1 - SOCK : x0;
                items.push({ k: 'isock', name: D.STAT_ICON[stat], color: iconColor(stat), x: sx, y: y + Math.floor((rh - SOCK) / 2), w: SOCK, h: SOCK });
                if (side === 'r') x1 -= SOCK + 1; else x0 += SOCK + 1;
            }
            const g = barGeom(t, style, x1 - x0, state.barH, { segs: state.segs });
            const bx = side === 'r' ? x1 - g.bw : x0;
            const by = y + Math.floor((rh - g.bh) / 2);
            items.push({ k: 'track', g, stat, x: bx, y: by, w: g.bw, h: g.bh });
            over.push({ t: 'bar', stat, x: bx, y: by, w: g.bw, h: g.bh, g, dir, inComp: true });
            const vp = valuePapi(stat);
            if (state.values && vp && state.barH >= 8) over.push({ t: 'text', papi: vp, x: bx + g.bw / 2, y: by + g.bh / 2, align: 'center', color: '#ffffff', shadow: true, w: textW(vp) });
            return side === 'r' ? x + w - bx : bx + g.bw - x;
        }

        /* turns rects/domes/items given in screen coordinates into one assembly image */
        function finishComp(rects, domes, items, over, A) {
            const all = [...rects, ...domes, ...items];
            const minX = Math.floor(Math.min(...all.map((r) => r.x)));
            const minY = Math.floor(Math.min(...all.map((r) => r.y)));
            const maxX = Math.ceil(Math.max(...all.map((r) => r.x + r.w)));
            const maxY = Math.ceil(Math.max(...all.map((r) => r.y + r.h)));
            for (const r of all) { r.x = Math.round(r.x - minX); r.y = Math.round(r.y - minY); }
            parts.push({ t: 'comp', x: minX, y: minY, w: maxX - minX, h: maxY - minY, anchor: A, spec: { w: maxX - minX, h: maxY - minY, rects, domes, items } });
            for (const p of over) { p.anchor = A; parts.push(p); }
        }

        /*
         * A tray sitting ON the hotbar (nothing floats): bar rows with socketed icons,
         * the XP channel along its bottom, the level number in a recessed plate.
         * kind 'columns' = two columns (Modern), 'row' = one row of all bars (Center Row).
         */
        function tray(kind) {
            const t = sk();
            const F = frameT();
            const P = 2;
            const A = 'bottom_middle';
            const rects = [];
            const items = [];
            const over = [];
            const rh = statRowH();
            let crestItem = null;
            const x0 = HB.x - 2;
            const x1 = HB.x + HB.w + 2;
            const inX0 = x0 + F + P;
            const inX1 = x1 - F - P;
            let y = HB.y - F - P; // bottom of the content (exclusive)
            if (on('xp')) {
                const g = barGeom(t, { cap: 'none', segmented: false }, inX1 - inX0, 5, {});
                y -= g.bh;
                items.push({ k: 'track', g, stat: 'xp', x: inX0, y, w: g.bw, h: g.bh });
                over.push({ t: 'bar', stat: 'xp', x: inX0, y, w: g.bw, h: g.bh, g, dir: 'left', inComp: true });
                y -= 2;
            }
            if (kind === 'row') {
                const row = STAT_ORDER.filter((s) => s !== 'xp' && on(s));
                const gap = 3;
                const lvW = on('level') ? 22 : 0;
                const cellW = Math.floor((inX1 - inX0 - lvW - gap * (row.length - (lvW ? 0 : 1))) / Math.max(1, row.length));
                y -= rh;
                let x = inX0;
                row.forEach((s, i) => {
                    if (lvW && i === Math.ceil(row.length / 2)) x += lvW + gap;
                    statRow(items, over, s, x, y, cellW, 'l');
                    x += cellW + gap;
                });
                if (lvW) {
                    const lx = inX0 + Math.ceil(row.length / 2) * (cellW + gap);
                    items.push({ k: 'plate', x: lx, y, w: lvW, h: rh });
                    over.push({ t: 'xp', x: lx + lvW / 2, y: y + rh / 2, plain: true });
                }
                y -= 2;
            } else {
                const left = ['hp', 'mana', 'armor'].filter(on);
                const right = ['food', 'air'].filter(on);
                const deck = kind === 'deck';
                const lvW = on('level') ? (deck ? CREST + 2 : 22) : 0;
                const gapC = lvW ? lvW + 6 : 4;
                const colW = Math.floor((inX1 - inX0 - gapC) / 2);
                const rows = Math.max(left.length, right.length);
                const firstRowY = y - rh;
                for (let i = 0; i < rows; i++) {
                    y -= rh;
                    if (left[i]) statRow(items, over, left[i], inX0, y, colW, 'l');
                    if (right[i]) statRow(items, over, right[i], inX1 - colW, y, colW, 'r');
                    y -= 2;
                }
                if (lvW && rows && deck) {
                    // the crest stands in the middle of the deck, rising above it
                    const cx = Math.round(SW / 2 - CREST / 2);
                    const cy = firstRowY + rh - CREST + 1;
                    crestItem = { k: 'crest', x: cx, y: cy, w: CREST, h: CREST };
                    over.push({ t: 'xp', x: cx + CREST / 2, y: cy + CREST / 2 });
                } else if (lvW && rows) {
                    items.push({ k: 'plate', x: SW / 2 - lvW / 2, y: firstRowY, w: lvW, h: rh });
                    over.push({ t: 'xp', x: SW / 2, y: firstRowY + rh / 2, plain: true });
                }
            }
            const top = y + 2 - P - F;
            const cap = bandCap() === 'none' ? 'none' : 'slant';
            const h = HB.y - top;
            const capW = cap === 'none' ? 0 : Math.max(4, Math.ceil(h * 0.35));
            rects.push({ x: x0 - capW, y: top, w: SW / 2 - x0 + capW, h, cap, capW, capSide: 'l' });
            rects.push({ x: SW / 2, y: top, w: x1 + capW - SW / 2, h, cap, capW, capSide: 'r' });
            items.push(...compOrn(t, null, { x: x0, y: top, w: x1 - x0, capW: 0 }));
            if (crestItem) items.push(crestItem);
            finishComp(rects, [], items, over, A);
        }

        /*
         * Split Sides: a tray on each side of the hotbar, joined by the XP rail on top of it
         * and a small tab in the middle holding the level number — one connected piece.
         */
        function sideTrays() {
            const t = sk();
            const F = frameT();
            const P = 2;
            const A = 'bottom_middle';
            const rects = [];
            const items = [];
            const over = [];
            const rh = statRowH();
            const colW = Math.min(state.barW + (state.icons ? SOCK + 1 : 0), 120);
            const trayW = colW + 2 * (F + P);
            const bottom = HB.y + HB.h;
            const rg = barGeom(t, { cap: 'none', segmented: false }, HB.w, on('xp') ? 6 : 4, {});
            const railTop = HB.y - rg.bh;
            const lx = HB.x - trayW;
            const rx = HB.x + HB.w;
            const side = (list, tx, s) => {
                let y = bottom - F - P;
                for (const st of list) {
                    y -= isPips(st) ? Math.max(PIP, rh) : rh;
                    statRow(items, over, st, tx + F + P, y, colW, s);
                    y -= 2;
                }
                return Math.min(y + 2 - P - F, railTop);
            };
            const lt = side(['hp', 'mana', 'armor'].filter(on), lx, 'l');
            const rt = side(['food', 'air'].filter(on), rx, 'r');
            const bandCapK = bandCap() === 'none' ? 'none' : 'slant';
            const capOf = (h) => (bandCapK === 'none' ? 0 : Math.max(4, Math.ceil(h * 0.3)));
            rects.push({ x: lx - capOf(bottom - lt), y: lt, w: trayW + capOf(bottom - lt), h: bottom - lt, cap: bandCapK, capW: capOf(bottom - lt), capSide: 'l' });
            rects.push({ x: rx, y: rt, w: trayW + capOf(bottom - rt), h: bottom - rt, cap: bandCapK, capW: capOf(bottom - rt), capSide: 'r' });
            rects.push({ x: lx, y: railTop, w: rx + trayW - lx, h: rg.bh });
            if (on('xp')) {
                items.push({ k: 'track', g: rg, stat: 'xp', x: HB.x, y: railTop, w: rg.bw, h: rg.bh });
                over.push({ t: 'bar', stat: 'xp', x: HB.x, y: railTop, w: rg.bw, h: rg.bh, g: rg, dir: 'left', inComp: true });
            }
            if (on('level')) {
                const tabW = 26;
                const tabH = 12 + F + P;
                rects.push({ x: SW / 2 - tabW / 2, y: railTop - tabH + 1, w: tabW, h: tabH, cap: bandCapK === 'none' ? 'none' : 'slant', capW: 0 });
                items.push({ k: 'plate', x: SW / 2 - 9, y: railTop - tabH + 1 + F, w: 18, h: 11 });
                over.push({ t: 'xp', x: SW / 2, y: railTop - tabH + 1 + F + 5.5, plain: true });
            }
            finishComp(rects, [], items, over, A);
        }

        /* a value on its own plate, with the icon in front */
        function textLine(papi, icon, x, y, anchor, minW) {
            let tx = x;
            if (state.icons && icon) {
                parts.push({ t: 'icon', icon, color: iconColor(icon), x, y: y + Math.floor((PLATE_H - IS) / 2), w: IS, h: IS, anchor });
                tx = x + IS + 2;
            }
            const tw = textW(papi, minW);
            parts.push({ t: 'plate', x: tx, y, w: tw + 6, h: PLATE_H, anchor });
            parts.push({ t: 'text', papi, x: tx + 3, y: y + 2, align: 'left', anchor, color: '#ffffff', shadow: true, w: tw });
            return tx - x + tw + 6;
        }

        /*
         * A card in a screen corner, drawn as ONE connected frame (like hand-made packs):
         * a socket for the head (or the level crest) and a "wing" of rows beside it —
         * name plate, bars, pip rows, info plates. Each row is as long as its content and
         * ends in the theme's end shape, so the right edge becomes a staircase.
         * Icons, bar channels, plates and sockets are engraved into that one texture;
         * only bar fills, texts, the head and the level number sit on top of it.
         */
        function card(corner, inc) {
            const t = sk();
            const style = barStyle();
            const F = frameT();
            const P = 2;
            const HS = 28;
            const right = corner === 'tr' || corner === 'br';
            const bottom = corner === 'bl' || corner === 'br';
            const A = { tl: 'top_left', tr: 'top_right', bl: 'bottom_left', br: 'bottom_right' }[corner];
            const rects = [];
            const items = [];
            const over = [];
            let lead = 0;
            if (inc.head) {
                lead = HS + 2 + 2 * (F + P);
                rects.push({ x: 0, y: 0, w: lead, h: lead });
                items.push({ k: 'socket', x: F + P, y: F + P, w: HS + 2, h: HS + 2 });
                over.push({ t: 'headonly', x: F + P + 1, y: F + P + 1, w: HS, h: HS });
            } else if (inc.level) {
                lead = CREST + 2 * (F + P);
                rects.push({ x: 0, y: 0, w: lead, h: lead });
            }
            let crest = null;
            if (inc.level) {
                const cx = inc.head ? lead - CREST + 3 : F + P;
                const cy = inc.head ? lead - CREST + 3 : F + P;
                crest = { k: 'crest', x: cx, y: cy, w: CREST, h: CREST };
                over.push({ t: 'xp', x: cx + CREST / 2, y: cy + CREST / 2 });
            }
            const rows = [];
            if (inc.name) rows.push({ kind: 'name' });
            for (const s of inc.bars) rows.push({ kind: isPips(s) ? 'pips' : 'bar', stat: s });
            for (const k of inc.info) rows.push({ kind: 'info', key: k });
            if (!rows.length && !lead) return null;

            const colX = lead ? lead - F - 1 : 0;   // rows start inside the socket's frame, so they join it
            const cx0 = lead ? lead + P - 1 : F + P; // where row content starts
            const maxW = bottom ? 141 : 210;          // bottom corners must stay clear of the hotbar
            const capKind = bandCap();
            const bands = [];
            let y = F + P;
            for (const r of rows) {
                let ch;
                let cw;
                if (r.kind === 'name' || r.kind === 'info') {
                    const papi = r.kind === 'name' ? '%player_name%' : INFO[r.key].papi;
                    const icon = r.kind === 'info' && state.icons ? INFO[r.key].icon : null;
                    const tw = textW(papi, r.kind === 'name' ? 45 : 0);
                    let x = cx0;
                    if (icon) {
                        items.push({ k: 'icon', name: icon, color: iconColor(icon), x, y: y + Math.floor((PLATE_H - IS) / 2), w: IS, h: IS });
                        x += IS + 2;
                    }
                    items.push({ k: 'plate', x, y, w: tw + 6, h: PLATE_H });
                    over.push({ t: 'text', papi, x: x + 3, y: y + 2, align: 'left', color: '#ffffff', shadow: true, w: tw });
                    ch = PLATE_H;
                    cw = x + tw + 6 - cx0;
                } else {
                    // bar or pip row, icon in a socket
                    ch = statRowH();
                    const avail = Math.max(40, Math.min(state.barW + (state.icons ? SOCK + 1 : 0), maxW - cx0 - P - F - 6));
                    cw = statRow(items, over, r.stat, cx0, y, avail, 'l');
                }
                bands.push({ top: y, ch, cw });
                y += ch + 2;
            }
            bands.forEach((b, i) => {
                const top = i === 0 ? 0 : b.top - 1;
                const bot = i === bands.length - 1 ? b.top + b.ch + P + F : bands[i + 1].top - 1;
                const h = bot - top;
                const capW = capKind === 'none' ? 0 : Math.max(3, Math.ceil(h * 0.55));
                rects.push({ x: colX, y: top, w: cx0 + b.cw + P + F - colX + capW, h, cap: capKind, capW, capSide: 'r' });
            });
            items.push(...compOrn(t, lead ? { x: 0, y: 0, w: lead, h: lead } : rects[0], rects[lead ? 1 : 0]));
            if (crest) items.push(crest);

            const W = Math.max(...rects.map((r) => r.x + r.w), ...items.map((it) => it.x + it.w));
            const H = Math.max(...rects.map((r) => r.y + r.h), ...items.map((it) => it.y + it.h));
            if (right) {
                rects.forEach((r) => { r.x = W - r.x - r.w; r.capSide = 'l'; });
                items.forEach((it) => { it.x = W - it.x - it.w; if (it.k === 'orn') it.flipX = !it.flipX; });
                over.forEach((p) => mirror(p, W));
            }
            const ox = right ? SW - 4 - W : 4;
            const oy = bottom ? SH - 4 - H : 4;
            parts.push({ t: 'comp', x: ox, y: oy, w: W, h: H, anchor: A, spec: { w: W, h: H, rects, domes: [], items } });
            for (const p of over) { p.x += ox; p.y += oy; p.anchor = A; parts.push(p); }
            return { x: ox, y: oy, w: W, h: H };
        }

        function mirror(p, W) {
            if (p.t === 'text') {
                if (p.align === 'left') {
                    // keep the text inside its plate: right-align it to the plate's right edge
                    p.align = 'right';
                    p.x = W - p.x;
                } else p.x = W - p.x;
            } else if (p.t === 'xp') {
                p.x = W - p.x;
            } else {
                p.x = W - p.x - p.w;
                if (p.t === 'bar') p.dir = p.dir === 'left' ? 'right' : 'left';
            }
        }

        /* thin XP bar resting on the hotbar; returns the new base line */
        function xpOverHotbar(base, A, xh) {
            if (!on('xp')) return base;
            xh = xh || 6;
            parts.push({ t: 'bar', stat: 'xp', x: HB.x, y: base - xh, w: HB.w, h: xh, dir: 'left', anchor: A, noCap: true });
            return base - xh - 1;
        }
        function levelCrest(cx, base, A) {
            const s = CREST;
            parts.push({ t: 'badge', x: Math.round(cx - s / 2), y: base - s + 3, w: s, h: s, anchor: A });
            parts.push({ t: 'xp', x: Math.round(cx - s / 2) + s / 2, y: base - s + 3 + s / 2, anchor: A });
            return base - s + 1;
        }
        function panelBehind(start, A, x, y, w, h) {
            if (!state.panels) return;
            parts.splice(start, 0, { t: 'panel', x, y, w, h, anchor: A });
        }
        /*
         * Fantasy "crown": ONE connected frame around the hotbar — a pillar at each end,
         * a rail on top of the hotbar holding the XP channel, a wing on each side holding
         * the bars, and a dome in the middle holding the level crest. Pip rows sit on top
         * of the wings. Nothing covers the hotbar slots.
         */
        function crown() {
            const t = sk();
            const style = barStyle();
            const F = frameT();
            const P = 2;
            const A = 'bottom_middle';
            const rects = [];
            const domes = [];
            const items = [];
            const over = [];
            const orn = state.ornaments;
            const CAPW = 20;
            const xL = orn ? HB.x - CAPW - 1 : HB.x - 2;
            const xR = orn ? HB.x + HB.w + 1 + CAPW : HB.x + HB.w + 2;
            const hbBottom = HB.y + HB.h;

            // rail = the XP channel, running along the top of the hotbar
            const rg = barGeom(t, { cap: 'none', segmented: style.segmented }, HB.w, on('xp') ? 6 : 4, { segs: state.segs });
            const railTop = HB.y - rg.bh;
            rects.push({ x: xL, y: railTop, w: xR - xL, h: rg.bh });
            if (on('xp')) {
                items.push({ k: 'track', g: rg, stat: 'xp', x: HB.x, y: railTop, w: rg.bw, h: rg.bh });
                over.push({ t: 'bar', stat: 'xp', x: HB.x, y: railTop, w: rg.bw, h: rg.bh, g: rg, dir: 'left', inComp: true });
            }

            // wings: bar rows stacked upward from the rail, icons on the outer side
            const pipStats = state.pips ? PIP_STATS : [];
            const leftS = ['hp', 'mana', ...(pipStats.includes('armor') ? [] : ['armor'])].filter(on);
            const rightS = ['food', ...(pipStats.includes('air') ? [] : ['air'])].filter(on);
            const DW = orn || on('level') ? 44 : 0;
            const ch = statRowH();
            const wingTops = [];
            // bars rest directly on the rail (no box around them), icons in sockets
            const wing = (list, side) => {
                if (!list.length) return railTop;
                const inner = SW / 2 + (side === 'l' ? -DW / 2 - 1 : DW / 2 + 1);
                let y = railTop;
                for (const s of list) {
                    y -= ch;
                    const bx0 = side === 'l' ? HB.x - (orn ? 6 : 0) : inner;
                    const bx1 = side === 'l' ? inner : HB.x + HB.w + (orn ? 6 : 0);
                    statRow(items, over, s, bx0, y, bx1 - bx0, side);
                    y -= 1;
                }
                return y + 1;
            };
            wingTops.push(wing(leftS, 'l'), wing(rightS, 'r'));
            const wingTop = Math.min(...wingTops);

            // pip rows sit on top of the wings
            const pipRow = (s, side, y) => {
                // as many pips as fit beside the dome
                const g = barGeom(t, style, Math.min(80, Math.floor((HB.w - DW) / 2) - 4), PIP, { pips: true });
                const x = side === 'l' ? HB.x + 2 : HB.x + HB.w - 2 - g.bw;
                items.push({ k: 'track', g, stat: s, x, y, w: g.bw, h: g.bh });
                over.push({ t: 'bar', stat: s, x, y, w: g.bw, h: g.bh, g, dir: side === 'l' ? 'left' : 'right', pips: true, inComp: true });
            };
            if (pipStats.includes('armor') && on('armor')) pipRow('armor', 'l', wingTops[0] - PIP - 1);
            if (pipStats.includes('air') && on('air')) pipRow('air', 'r', wingTops[1] - PIP - 1);

            // pillars at both ends of the hotbar
            if (orn) {
                const pTop = railTop - 7;
                for (const px of [xL, xR - CAPW]) {
                    rects.push({ x: px, y: pTop, w: CAPW, h: hbBottom - pTop });
                    items.push({ k: 'socket', x: px + (CAPW - 12) / 2, y: HB.y + 5, w: 12, h: 12 });
                    // a lit knob (or gem) crowning each pillar
                    items.push({ k: 'knob', gem: t.cap === 'gem', x: px + Math.floor((CAPW - 7) / 2), y: pTop - 4, w: 7, h: 7 });
                }
            }
            // dome + crest in the middle
            if (DW) {
                const dTop = Math.min(wingTop - 3, railTop - CREST - 6);
                domes.push({ x: SW / 2 - DW / 2, y: dTop, w: DW, h: railTop - dTop + 1, rail: 3 });
                if (on('level')) {
                    const cx = Math.round(SW / 2 - CREST / 2);
                    const cy = dTop + 4;
                    items.push({ k: 'crest', x: cx, y: cy, w: CREST, h: CREST });
                    over.push({ t: 'xp', x: cx + CREST / 2, y: cy + CREST / 2 });
                }
            }
            // leaves / flowers on top of the wings
            const kinds = t.orn || [];
            if (orn && (kinds.includes('leaves') || kinds.includes('flowers'))) {
                const sp = kinds.includes('leaves') ? 'leaf' : 'flower';
                const sw = D.ORN[sp][0].length;
                const sh = D.ORN[sp].length;
                items.push({ k: 'orn', sprite: sp, x: xL + 1, y: railTop - 8, w: sw, h: sh, flipX: true });
                items.push({ k: 'orn', sprite: sp, x: xR - 1 - sw, y: railTop - 8, w: sw, h: sh });
            }

            finishComp(rects, domes, items, over, A);
        }

        /* just the framed XP rail on the hotbar (+ the level number on a plate) */
        function survivalRailXpOnly(level) {
            const t = sk();
            const rects = [];
            const items = [];
            const over = [];
            const rg = barGeom(t, { cap: 'none', segmented: false }, HB.w + 4, on('xp') ? 6 : 4, {});
            const railTop = HB.y - rg.bh;
            if (!on('xp') && !level) return;
            rects.push({ x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh });
            if (on('xp')) {
                items.push({ k: 'track', g: rg, stat: 'xp', x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh });
                over.push({ t: 'bar', stat: 'xp', x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh, g: rg, dir: 'left', inComp: true });
            }
            if (level) {
                rects.push({ x: SW / 2 - 13, y: railTop - 12, w: 26, h: 13 });
                items.push({ k: 'plate', x: SW / 2 - 9, y: railTop - 10, w: 18, h: 10 });
                over.push({ t: 'xp', x: SW / 2, y: railTop - 5, plain: true });
            }
            finishComp(rects, [], items, over, 'bottom_middle');
        }

        /* Survival: vanilla-style icon rows standing on a framed XP rail across the hotbar */
        function survivalRail() {
            const t = sk();
            const style = barStyle();
            const A = 'bottom_middle';
            const rects = [];
            const items = [];
            const over = [];
            const rg = barGeom(t, { cap: 'none', segmented: false }, HB.w + 4, on('xp') ? 6 : 4, {});
            const railTop = HB.y - rg.bh;
            rects.push({ x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh });
            if (on('xp')) {
                items.push({ k: 'track', g: rg, stat: 'xp', x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh });
                over.push({ t: 'bar', stat: 'xp', x: HB.x - 2, y: railTop, w: rg.bw, h: rg.bh, g: rg, dir: 'left', inComp: true });
            }
            if (on('level')) {
                items.push({ k: 'plate', x: SW / 2 - 10, y: railTop - 10, w: 20, h: 11 });
                over.push({ t: 'xp', x: SW / 2, y: railTop - 4.5, plain: true });
            }
            const stack = (list, side) => {
                let y = railTop - 1;
                for (const s of list) {
                    y -= PIP;
                    const g = barGeom(t, style, 79, PIP, { pips: true });
                    const x = side === 'l' ? HB.x : HB.x + HB.w - g.bw;
                    items.push({ k: 'track', g, stat: s, x, y, w: g.bw, h: g.bh });
                    over.push({ t: 'bar', stat: s, x, y, w: g.bw, h: g.bh, g, dir: side === 'l' ? 'left' : 'right', pips: true, inComp: true });
                    y -= 1;
                }
            };
            stack(['hp', 'armor', 'mana'].filter(on), 'l');
            stack(['food', 'air'].filter(on), 'r');
            finishComp(rects, [], items, over, A);
        }

        const infos = () => Object.keys(INFO).filter(on);
        const infoCard = (corner) => card(corner, { head: on('head'), name: on('name'), level: false, bars: [], info: infos() });

        const L = state.layout;
        const A = 'bottom_middle';
        const barsNoXp = STAT_ORDER.filter((s) => s !== 'xp' && on(s));

        /* rows that grow upward from `base`; returns the y of each row */
        const rowsUp = (list, base, gap) => {
            let y = base;
            return list.map((s) => { y -= (isPips(s) ? PIP + 1 : rowH) + (gap == null ? 1 : gap); return y; });
        };

        if (L === 'fantasy') {
            crown();
            infoCard('tl');
        } else if (L === 'mmo' || L === 'banner' || L === 'compact') {
            // top-left status frame — with the player's head (MMO Profile), led by the level
            // crest (Hero Banner) or just the bars (Compact Stack); XP rail on the hotbar
            const head = L === 'mmo' && on('head');
            card('tl', {
                head,
                name: L !== 'compact' && on('name'),
                level: on('level') && L !== 'compact',
                bars: ['hp', 'mana', 'food', 'armor', 'air'].filter(on),
                info: [],
            });
            survivalRailXpOnly(L === 'compact' && on('level'));
            card('br', { head: false, name: false, level: false, bars: [], info: infos() });
        } else if (L === 'modern') {
            tray('columns');
            infoCard('tl');
        } else if (L === 'center_row') {
            tray('row');
            infoCard('tl');
        } else if (L === 'split_sides') {
            sideTrays();
            infoCard('tl');
        } else if (L === 'survival') {
            survivalRail();
            infoCard('tl');
        } else if (L === 'classic') {
            tray('deck');
            infoCard('tl');
        } else if (L === 'rpg_corners') {
            card('bl', { head: on('head'), name: on('name'), level: on('level'), bars: ['hp', 'mana'].filter(on), info: [] });
            card('br', { head: false, name: false, level: false, bars: ['food', 'armor', 'air'].filter(on), info: [] });
            survivalRailXpOnly(false);
            card('tr', { head: false, name: false, level: false, bars: [], info: infos() });
        } else if (L === 'top_strip') {
            const side = card('tl', { head: on('head'), name: false, level: on('level'), bars: STAT_ORDER.filter(on), info: [] });
            const items = [];
            if (on('name')) items.push({ icon: 'person', papi: '%player_name%', min: 40 });
            for (const k of infos()) items.push({ icon: INFO[k].icon, papi: INFO[k].papi, min: 0 });
            if (items.length) {
                const T = 'top_middle';
                const pad = 2 + (sk().rimW || 1);
                const gap = 4;
                const widths = items.map((it) => (state.icons ? IS + 2 : 0) + textW(it.papi, it.min) + 6);
                const stripW = Math.round(pad * 2 + widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1));
                const stripH = PLATE_H + pad * 2;
                const x0 = Math.round(Math.max(SW / 2 - stripW / 2, side ? side.x + side.w + 6 : 0));
                const y0 = 21; // below Bedrock's pause/chat buttons
                const first = parts.length;
                let x = x0 + pad;
                items.forEach((it, i) => {
                    textLine(it.papi, it.icon, x, y0 + pad, T, it.min);
                    x += widths[i] + gap;
                });
                // the strip is always framed, so its plates never float
                parts.splice(first, 0, { t: 'panel', x: x0, y: y0, w: stripW, h: stripH, anchor: T, plain: true });
            }
        } else {
            const corner = L.slice(5); // card_tl → tl
            card(corner, { head: on('head'), name: on('name'), level: on('level'), bars: STAT_ORDER.filter(on), info: infos() });
        }
        return parts;
    }

    /* textures for every part of the plan */
    function renderPlan(parts, q) {
        const t = sk();
        const style = barStyle();
        for (const p of parts) {
            if (p.pre) {
                // v2 parts come with finished 1× textures
                if (p.tex1) p.tex = upscale(p.tex1, q);
                if (p.fill1) p.fill = upscale(p.fill1, q);
                continue;
            }
            // every raised piece gets a 1px drop shadow, so its image is 1px wider and taller
            const lift = (img) => { p.w += 1; p.h += 1; return upscale(withShadow(img), q); };
            if (p.t === 'panel') p.tex = lift(panelTex(p.w, p.h, t, 1, p.plain ? { plain: true } : null));
            else if (p.t === 'comp') { p.tex = buildComp(p.spec, t, q); p.w += 1; p.h += 1; }
            else if (p.t === 'plate') p.tex = plateTex(p.w, p.h, t, q);
            else if (p.t === 'icon') p.tex = lift(iconTex(p.icon, p.color, 1));
            else if (p.t === 'badge') p.tex = lift(badgeTex(p.w, t, 1));
            else if (p.t === 'head') p.tex = headFrameTex(p.w, t, q);
            else if (p.t === 'bar' && p.inComp) {
                // the channel is engraved in the assembly: only the fill is a separate element
                p.fill = fillTex(p.g, t, statColor(p.stat), q, p.stat);
            } else if (p.t === 'bar') {
                const st = p.noCap ? { cap: 'none', segmented: style.segmented } : style;
                const g = barGeom(t, st, p.w, p.h, { pips: p.pips, segs: state.segs });
                if (p.dir === 'right') p.x += p.w - g.bw;
                else if (p.noCap) p.x += Math.floor((p.w - g.bw) / 2);
                p.w = g.bw + 1;
                p.h = g.bh + 1;
                p.g = g;
                p.track = upscale(withShadow(trackTex(g, t, 1, p.stat)), q);
                p.fill = fillTex(g, t, statColor(p.stat), q, p.stat);
            }
        }
        return parts;
    }

    /* ───────────── preview ───────────── */

    const FACE = ['hhhhhhhh', 'hhhhhhhh', 'hssssssh', 'ssssssss', 'swbssbws', 'ssssssss', 'ssmmmmss', 'ssssssss'];

    function drawBackground(ctx) {
        const W = SW * S;
        const H = SH * S;
        const bg = state.bg;
        const sky = bg === 'night' ? ['#0b1030', '#2a3a6e'] : bg === 'cave' ? ['#1d1d22', '#2e2e35'] : ['#7fb0ff', '#cfe3ff'];
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
        g.addColorStop(0, sky[0]);
        g.addColorStop(1, sky[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const gy = Math.round(H * 0.62);
        const B = 16 * S;
        for (let y = gy; y < H; y += B) {
            for (let x = 0; x < W; x += B) {
                const r = rnd(x, y, 5);
                let c;
                if (bg === 'cave') c = r < 0.1 ? '#5b5b63' : r < 0.2 ? '#3d3d44' : '#4a4a52';
                else if (y === gy) c = bg === 'night' ? '#2c4f22' : '#5ea83a';
                else c = bg === 'night' ? (r < 0.3 ? '#3a2818' : '#33230f') : (r < 0.3 ? '#8a5c37' : '#7a5232');
                ctx.fillStyle = c;
                ctx.fillRect(x, y, B, B);
            }
        }
        if (bg === 'cave') {
            ctx.fillStyle = 'rgba(0,0,0,.25)';
            ctx.fillRect(0, 0, W, gy);
        }
    }

    function drawHotbar(ctx, sheet) {
        const x = HB.x * S;
        const y = HB.y * S;
        if (sheet) {
            ctx.drawImage(sheet, 0, 0, 182, 22, x, y, 182 * S, 22 * S);
            ctx.drawImage(sheet, 0, 22, 24, 24, x - S, y - S, 24 * S, 24 * S);
            return;
        }
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(x, y, 182 * S, 22 * S);
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = S;
        for (let i = 0; i < 9; i++) ctx.strokeRect(x + (2 + 20 * i) * S + 1, y + 2 * S + 1, 18 * S - 2, 18 * S - 2);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x - S + 1, y - S + 1, 24 * S - 2, 24 * S - 2);
    }

    function drawText(ctx, str, x, y, align, color, shadow, size) {
        ctx.font = `${(size || 7) * S}px Minecraftia, monospace`;
        ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
        // Minecraftia's ascent is tall: place by the baseline
        ctx.textBaseline = 'alphabetic';
        const yy = align === 'center' ? y + 3 * S : y + 8 * S;
        if (shadow) {
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.fillText(str, x + S, yy + S);
        }
        ctx.fillStyle = color;
        ctx.fillText(str, x, yy);
        ctx.textAlign = 'left';
    }

    function drawFace(ctx, x, y, s) {
        const pal = { h: '#3b2816', s: '#c9926b', w: '#ffffff', b: '#4a6fc0', m: '#8a5a3c' };
        const k = s / 8;
        FACE.forEach((row, yy) => [...row].forEach((ch, xx) => {
            ctx.fillStyle = pal[ch] || pal.s;
            ctx.fillRect(Math.round(x + xx * k), Math.round(y + yy * k), Math.ceil(k), Math.ceil(k));
        }));
    }

    function drawPlan(ctx, parts, t) {
        const order = { img: 0, panel: 0, comp: 0, plate: 1, head: 1, headonly: 2, bar: 2, icon: 3, badge: 3, text: 5, xp: 6 };
        // v2 'icon' images sit above the bars but under the text
        const rank = (p) => (p.t === 'img' && p.layer === 'icon' ? 4 : order[p.t]);
        const list = [...parts].sort((a, b) => rank(a) - rank(b));
        for (const p of list) {
            const x = p.x * S;
            const y = p.y * S;
            if (p.t === 'head') {
                ctx.drawImage(p.tex, x, y, p.w * S, p.h * S);
                const fi = headInset(t);
                drawFace(ctx, x + fi * S, y + fi * S, (p.w - fi * 2) * S);
            } else if (p.t === 'headonly') {
                drawFace(ctx, x, y, p.w * S);
            } else if (p.t === 'bar') {
                if (p.track) ctx.drawImage(p.track, x, y, p.w * S, p.h * S);
                const g = p.g;
                const f = SAMPLE_FILL[p.stat] == null ? 1 : SAMPLE_FILL[p.stat];
                const sw = Math.round(p.fill.width * f);
                const dw = (sw / p.fill.width) * g.fw * S;
                const fx = (p.x + g.fx) * S;
                const fy = (p.y + g.fy) * S;
                if (p.dir === 'top' || p.dir === 'bottom') {
                    const sh = Math.round(p.fill.height * f);
                    const dh = (sh / p.fill.height) * g.fh * S;
                    if (sh >= 1) {
                        if (p.dir === 'bottom') ctx.drawImage(p.fill, 0, p.fill.height - sh, p.fill.width, sh, fx, fy + g.fh * S - dh, g.fw * S, dh);
                        else ctx.drawImage(p.fill, 0, 0, p.fill.width, sh, fx, fy, g.fw * S, dh);
                    }
                } else if (sw >= 1) {
                    if (p.dir === 'right') ctx.drawImage(p.fill, p.fill.width - sw, 0, sw, p.fill.height, fx + g.fw * S - dw, fy, dw, g.fh * S);
                    else ctx.drawImage(p.fill, 0, 0, sw, p.fill.height, fx, fy, dw, g.fh * S);
                }
            } else if (p.t === 'text') {
                drawText(ctx, sampleText(p.papi), x, y, p.align, p.color, p.shadow, 6);
            } else if (p.t === 'xp') {
                drawText(ctx, '27', x, y + 1, 'center', p.plain ? '#80ff20' : '#ffffff', true, 7);
            } else if (p.tex) {
                ctx.drawImage(p.tex, x, y, p.w * S, p.h * S);
            }
        }
    }

    function drawPreview() {
        drawTimer = 0;
        if (!back) return;
        const cv = back.querySelector('#hf-preview');
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        drawBackground(ctx);
        const t = sk();
        drawHotbar(ctx, on('hotbar') ? hotbarFor(t) : null);
        plan = renderPlan(planner(), 1);
        drawPlan(ctx, plan, t);
        renderSummary();
    }

    function schedule() {
        if (drawTimer) return;
        drawTimer = requestAnimationFrame(drawPreview);
        saveLast();
    }

    function renderSummary() {
        const box = back && back.querySelector('#hf-summary');
        if (!box || !plan) return;
        const n = (k) => plan.filter((p) => p.t === k).length;
        const bars = n('bar');
        const imgs = n('img') + n('panel') + n('comp') + n('plate') + n('icon') + n('badge') + n('head') + plan.filter((p) => p.t === 'bar' && !p.inComp).length;
        box.textContent = `Creates ${bars} bars · ${imgs} images · ${n('text')} texts${n('head') + n('headonly') ? ' · player head' : ''}${n('xp') ? ' · level number' : ''}${on('hotbar') ? ' · hotbar texture' : ''}`;
    }

    /* ───────────── window ───────────── */

    function themeThumb(t) {
        const W = 112;
        const H = 40;
        const c = canvas(W * 2, H * 2);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#5b7fae';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(panelTex(W - 6, H - 6, t, 1), 6, 6, (W - 6) * 2, (H - 6) * 2);
        const style = { cap: t.cap || 'none', segmented: !!t.segmented };
        const col = (stat) => (t.mono ? t.mono.fill : mix((t.stat && t.stat[stat]) || D.STAT_COLORS[stat], '#ffffff', t.pastel ? 0.3 : 0));
        const B = 3 + (t.rimW || 1) + (t.inner ? 1 : 0);
        const g = barGeom(t, style, 70, 9, { segs: t.segs || 10 });
        const x0 = 3 + B + IS + 2;
        const y0 = 3 + B + 1;
        ctx.drawImage(iconTex('heart', t.mono ? t.mono.icon : col('hp'), 1), (3 + B) * 2, y0 * 2, IS * 2, IS * 2);
        ctx.drawImage(trackTex(g, t, 1, 'hp'), x0 * 2, y0 * 2, g.bw * 2, g.bh * 2);
        const f = fillTex(g, t, col('hp'), 1, 'hp');
        const fw = Math.round(f.width * 0.75);
        ctx.drawImage(f, 0, 0, fw, f.height, (x0 + g.fx) * 2, (y0 + g.fy) * 2, fw * 2, f.height * 2);
        const pg = barGeom(t, style, 60, PIP, { pips: true });
        ctx.drawImage(trackTex(pg, t, 1, 'armor'), x0 * 2, (y0 + 11) * 2, pg.bw * 2, pg.bh * 2);
        const pf = fillTex(pg, t, col('armor'), 1, 'armor');
        const pw = 4 * (PIP + 1);
        ctx.drawImage(pf, 0, 0, pw, pf.height, x0 * 2, (y0 + 11) * 2, pw * 2, pf.height * 2);
        return c.toDataURL();
    }

    /* the style gallery: one card per layout, colours are dots under the preview */
    const ui = { tab: 'pick', genre: 'all', q: '', allColours: false, dotsFor: null, thumbJob: 0 };
    const layoutById = (id) => D.LAYOUTS.find((l) => l.id === id) || D.LAYOUTS[0];
    const genreById = (id) => D.GENRES.find((g) => g.id === id) || { name: id, th: '' };
    const presetsOf = (id) => D.PRESETS.filter((p) => p.layout === id);
    const isNewLayout = (id) => ((D.LAYOUTS.find((l) => l.id === id) || {}).order || 0) >= 2;
    /* which part of the screen a card shows (GUI px): the layout's main piece */
    const THUMB_BOX = {
        bottom: [100, 194, 280, 76], tl: [0, 0, 280, 76], tr: [200, 0, 280, 76], bl: [0, 194, 280, 76], br: [200, 194, 280, 76], wide: [0, 194, 480, 76],
    };
    const THUMB_FOCUS = {
        slash_medal: 'tl', slash_rows: 'tl', slash_crest: 'tl', mmo: 'tl', banner: 'tl', compact: 'tl', card_tl: 'tl', top_strip: 'tl',
        card_tr: 'tr', card_bl: 'bl', card_br: 'br', rpg_corners: 'wide',
        grimoire: 'bl', fieldops: 'bl', warbar: 'wide',
    };
    const thumbCache = new Map();

    function swatch(t) {
        const a = (t.metal && t.metal[3]) || t.accent || '#999999';
        const b = (t.plate && t.plate[3]) || (t.mono && t.mono.fill) || '#333333';
        return `linear-gradient(135deg, ${a} 0 48%, ${b} 52% 100%)`;
    }
    /** a fresh state for one combo (used for the gallery thumbnails) */
    function comboState(p) {
        const saved = state;
        state = mergeState(null);
        try {
            if (p.theme) applyPreset(p); else applyLayout(p.layout);
            state.bg = 'day';
            return state;
        } finally { state = saved; }
    }
    /** draws a whole preview scene for any state, off screen */
    function sceneCanvas(st) {
        const saved = state;
        state = st;
        try {
            const c = canvas(SW * S, SH * S);
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            drawBackground(ctx);
            const t = sk();
            drawHotbar(ctx, on('hotbar') ? hotbarFor(t) : null);
            drawPlan(ctx, renderPlan(planner(), 1), t);
            return c;
        } finally { state = saved; }
    }
    function thumbFor(st, key) {
        if (key && thumbCache.has(key)) return thumbCache.get(key);
        const full = sceneCanvas(st);
        const [x, y, w, h] = THUMB_BOX[THUMB_FOCUS[st.layout] || 'bottom'];
        const c = canvas(w * S, h * S);
        c.getContext('2d').drawImage(full, x * S, y * S, w * S, h * S, 0, 0, w * S, h * S);
        const url = c.toDataURL();
        if (key) thumbCache.set(key, url);
        return url;
    }
    /* thumbnails are drawn a few at a time so the window opens at once */
    function fillThumbs() {
        const job = ++ui.thumbJob;
        const imgs = [...back.querySelectorAll('img[data-lthumb]')].filter((i) => !i.src);
        const step = () => {
            if (!back || job !== ui.thumbJob) return;
            const t0 = performance.now();
            while (imgs.length && performance.now() - t0 < 24) {
                const img = imgs.shift();
                const id = img.dataset.lthumb;
                const p = presetsOf(id)[0] || { layout: id };
                try { img.src = thumbFor(comboState(p), `${id}|${p.theme || ''}`); } catch (e) { img.classList.add('broken'); }
            }
            if (imgs.length) setTimeout(step, 0);
        };
        setTimeout(step, 30);
    }

    const UI_CSS = `
.kz-window.hf2{width:min(1260px,97vw);height:min(920px,95vh);max-width:none;display:flex;flex-direction:column}
.hf2 .kz-window-head{gap:18px}
.hf2 .kz-window-head>span:first-child{margin-right:auto}
.hf2-body{flex:1;display:flex;flex-direction:row!important;gap:0!important;min-height:0;padding:0!important;overflow:hidden}
.hf2-left{width:430px;flex:none;border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;min-height:0}
.hf2-pane{display:flex;flex-direction:column;gap:10px;padding:12px 14px;min-height:0;flex:1}
.hf2-search{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:0 10px}
.hf2-search svg{width:14px;height:14px;opacity:.6}
.hf2-search input{flex:1;background:none;border:0;outline:none;color:inherit;font:inherit;padding:8px 0}
.hf2-pills{display:flex;flex-wrap:wrap;gap:5px}
.hf2-pill{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#c8ccd4;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.hf2-pill:hover{border-color:rgba(255,255,255,.25)}
.hf2-pill.active{background:var(--accent,#2f7de1);border-color:transparent;color:#fff}
.hf2-scroll{flex:1;overflow:auto;min-height:0;margin:0 -6px;padding:2px 6px 8px}
.hf2-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hf2-card{position:relative;background:rgba(255,255,255,.04);border:2px solid transparent;border-radius:9px;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer;overflow:hidden}
.hf2-card:hover{border-color:rgba(255,255,255,.18)}
.hf2-card.active{border-color:#4a9bff;box-shadow:0 0 0 3px rgba(74,155,255,.2)}
.hf2-card .th{display:block;aspect-ratio:280/76;background:#6f9fdc linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.14),rgba(255,255,255,.06))}
.hf2-card .th img{display:block;width:100%;height:100%;object-fit:cover}
.hf2-card .th img:not([src]){visibility:hidden}
.hf2-card .meta{display:flex;align-items:center;gap:6px;padding:7px 9px 8px}
.hf2-card .meta b{font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hf2-card .n{margin-left:auto;font-size:11px;opacity:.6;white-space:nowrap}
.hf2-new{font-size:10px;font-weight:700;background:#f0b43a;color:#2a1c00;border-radius:4px;padding:0 5px;line-height:15px}
.hf2-card .del{position:absolute;top:5px;right:5px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;line-height:20px;padding:0}
.hf2-empty{opacity:.6;padding:30px 10px;text-align:center;display:none}
.hf2-stage{flex:1;display:flex;flex-direction:column;gap:8px;padding:12px 16px;min-width:0;min-height:0;overflow:hidden}
.hf2-title{display:flex;align-items:baseline;gap:10px;min-height:22px;flex:none}
.hf2-title b{font-size:16px;color:#fff;white-space:nowrap}
.hf2-title span{opacity:.65;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf2-stage canvas{flex:none;display:block;align-self:center;width:auto;height:auto;max-width:100%;max-height:44vh;border-radius:8px;image-rendering:pixelated;border:1px solid rgba(255,255,255,.1)}
.hf2-stage>.hf2-row{flex:none}
.hf2-tune{flex:1;min-height:120px;overflow:auto;margin:0 -6px;padding:4px 6px 6px;border-top:1px solid rgba(255,255,255,.08)}
.hf2-tune-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}
.hf2-tune-grid .hf2-acc.wide{grid-column:1/-1}
.hf2-tune>.kz-note{margin-top:8px}
.hf2-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hf2-lbl{width:78px;flex:none;font-size:12px;opacity:.75;line-height:1.15}
.hf2-lbl small{display:block;opacity:.75;font-size:11px}
.hf2-dots{display:flex;flex-wrap:wrap;gap:7px;flex:1}
.hf2-dot{width:24px;height:24px;border-radius:50%;border:2px solid #1f2023;box-shadow:0 0 0 1px rgba(255,255,255,.25);cursor:pointer;padding:0}
.hf2-dot:hover{transform:scale(1.12)}
.hf2-dot.active{box-shadow:0 0 0 2px #4a9bff}
.hf2-more{height:24px;border-radius:12px;border:1px dashed rgba(255,255,255,.3);background:none;color:#c8ccd4;font:inherit;font-size:11.5px;padding:0 9px;cursor:pointer}
.hf2-quick{display:flex;gap:6px;flex-wrap:wrap}
.hf2-q{border:1px solid rgba(255,255,255,.14);background:none;color:#c8ccd4;border-radius:6px;padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}
.hf2-q.active{background:rgba(47,125,225,.25);border-color:#2f7de1;color:#e8f1ff}
.hf2-seg{display:flex;background:rgba(0,0,0,.28);border-radius:7px;padding:3px}
.hf2-seg button{border:0;background:none;color:#9aa0aa;font:inherit;font-size:12px;padding:3px 11px;border-radius:5px;cursor:pointer}
.hf2-seg button.active{background:rgba(255,255,255,.1);color:#fff}
.hf2-stage .kz-note{font-size:11.5px}
#hf-summary{margin-left:auto}
.hf2-hint{font-size:12.5px;opacity:.8}
.hf2-hint b{color:#fff}
.hf2-acc{background:rgba(255,255,255,.04);border-radius:8px}
.hf2-acc>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 12px;font-weight:600;color:#fff}
.hf2-acc>summary::-webkit-details-marker{display:none}
.hf2-acc>summary:before{content:'▸';opacity:.6;width:10px}
.hf2-acc[open]>summary:before{content:'▾'}
.hf2-acc>summary small{font-weight:400;opacity:.6}
.hf2-acc>div{padding:2px 12px 12px;display:flex;flex-direction:column;gap:8px}
.hf2-acc .hf-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.hf2-acc .hf-tgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.hf2-acc .hf-theme img{width:100%}
.hf2 .kz-window-foot{display:flex;align-items:center;gap:8px}
`;
    function ensureCss() {
        if (document.getElementById('hf2-css')) return;
        const s = document.createElement('style');
        s.id = 'hf2-css';
        s.textContent = UI_CSS;
        document.head.appendChild(s);
    }

    function layoutCard(l) {
        const n = presetsOf(l.id).length;
        return `<button class="hf2-card" data-layout="${l.id}" title="${esc(l.th)}">
            <span class="th"><img alt="" data-lthumb="${l.id}" /></span>
            <span class="meta"><b>${esc(l.name)}</b>${isNewLayout(l.id) ? '<span class="hf2-new">NEW</span>' : ''}<span class="n">${n > 1 ? `${n} colours` : ''}</span></span></button>`;
    }
    /* newest designs first, then by genre */
    function galleryOrder() {
        const gi = (g) => D.GENRES.findIndex((x) => x.id === g);
        return [...D.LAYOUTS].sort((a, b) => (isNewLayout(b.id) - isNewLayout(a.id)) || ((b.order || 0) - (a.order || 0)) || (gi(a.genre) - gi(b.genre)));
    }
    function searchText(l) {
        const g = genreById(l.genre);
        const themes = presetsOf(l.id).map((p) => { const t = themeById(p.theme); return `${t.name} ${t.th || ''}`; }).join(' ');
        return `${l.id} ${l.name} ${l.th} ${l.tags || ''} ${g.name} ${g.th} ${themes}`.toLowerCase();
    }

    function openWindow() {
        close();
        loadLast();
        ensureCss();
        back = document.createElement('div');
        back.className = 'kz-modal';
        const chips = (list, key) => list.map((s) => `<button class="hf-chip" data-${key}="${s.id}" title="${esc(s.th)}">${esc(s.name)}</button>`).join('');
        const partBox = (k, label) => `<label class="hf-check"><input type="checkbox" data-part="${k}" />${esc(label)}</label>`;
        const genres = D.GENRES.filter((g) => D.LAYOUTS.some((l) => l.genre === g.id));
        back.innerHTML = `
            <div class="kz-window kz-forge hf2">
                <div class="kz-window-head"><span>HUD Forge</span>
                    <button class="icon-btn small" data-close title="Close"><svg><use href="#i-close"/></svg></button></div>
                <div class="kz-window-body hf2-body">
                    <div class="hf2-left">
                        <div class="hf2-pane" data-pane="pick">
                            <label class="hf2-search"><svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="2"/></svg>
                                <input id="hf2-q" type="text" spellcheck="false" placeholder="Search styles… e.g. dragon, snow, neon" /></label>
                            <div class="hf2-pills">
                                <button class="hf2-pill" data-genre="all">All</button>
                                <button class="hf2-pill" data-genre="new">✦ New</button>
                                <button class="hf2-pill" data-genre="mine">★ My templates</button>
                                ${genres.map((g) => `<button class="hf2-pill" data-genre="${g.id}" title="${esc(g.th)}">${esc(g.name)}</button>`).join('')}
                            </div>
                            <div class="hf2-scroll">
                                <div class="hf2-grid" id="hf2-grid">${galleryOrder().map(layoutCard).join('')}</div>
                                <div class="hf2-grid" id="hf2-mine"></div>
                                <div class="hf2-empty" id="hf2-empty"></div>
                            </div>
                        </div>
                    </div>
                    <div class="hf2-stage">
                        <div class="hf2-title"><b id="hf2-lname"></b><span id="hf2-ldesc"></span><b id="hf2-tune-name" hidden></b></div>
                        <canvas id="hf-preview" width="${SW * S}" height="${SH * S}"></canvas>
                        <div class="hf2-row"><span class="hf2-lbl">Colour</span><div class="hf2-dots" id="hf2-dots"></div></div>
                        <div class="hf2-row"><span class="hf2-lbl">Extras</span>
                            <div class="hf2-quick">
                                <button class="hf2-q" data-quick="money">Money</button><button class="hf2-q" data-quick="time">Time</button>
                                <button class="hf2-q" data-quick="coords">Coordinates</button><button class="hf2-q" data-quick="mana">Mana</button>
                                <button class="hf2-q" data-quick="name">Name</button>
                            </div>
                            <span style="margin-left:auto;display:flex;align-items:center;gap:8px"><span class="hf2-lbl" style="width:auto">Scene</span>
                            <span class="hf2-seg"><button data-bg="day">Day</button><button data-bg="night">Night</button><button data-bg="cave">Cave</button></span></span></div>
                        <div class="hf2-row"><span class="kz-note" id="hf-summary" style="margin-left:0"></span></div>
                        <div class="hf2-tune">
                          <div class="hf2-tune-grid">
                            <details class="hf2-acc wide" open><summary>Parts</summary><div>
                                <div class="hf-checks">
                                    ${partBox('hp', 'Health')}${partBox('food', 'Food')}${partBox('armor', 'Armor')}
                                    ${partBox('air', 'Air')}${partBox('xp', 'XP bar')}${partBox('mana', 'Mana')}
                                    ${partBox('head', 'Player head')}${partBox('name', 'Player name')}${partBox('level', 'Level')}
                                    ${partBox('money', 'Money')}${partBox('time', 'Time')}${partBox('coords', 'Coordinates')}
                                    ${partBox('hotbar', 'Hotbar texture')}
                                </div></div></details>
                            <details class="hf2-acc"><summary>Bars</summary><div>
                                <div class="hf-row"><span>Bar length</span><input type="range" min="40" max="130" id="hf-barw" /><output id="hf-barw-v"></output></div>
                                <div class="hf-row"><span>Bar thickness</span><input type="range" min="6" max="14" id="hf-barh" /><output id="hf-barh-v"></output></div>
                                <div class="hf-chips">${chips(D.SHAPES, 'shape')}</div>
                                <div class="hf-row" id="hf-segs-row"><span>Segments</span><input type="range" min="4" max="20" id="hf-segs" /><output id="hf-segs-v"></output></div>
                                <div class="kz-note">Bar length, thickness and ends change the classic styles; the NEW styles draw their own bars.</div>
                            </div></details>
                            <details class="hf2-acc"><summary>Details</summary><div>
                                <div class="hf-checks">
                                    <label class="hf-check"><input type="checkbox" id="hf-icons" />Icons</label>
                                    <label class="hf-check" title="e.g. 20/20"><input type="checkbox" id="hf-values" />Numbers on bars</label>
                                    <label class="hf-check"><input type="checkbox" id="hf-slotnums" />Slot numbers</label>
                                    <label class="hf-check"><input type="checkbox" id="hf-pips" />Armor/Air as icons</label>
                                    <label class="hf-check" title="A box behind the whole HUD / card"><input type="checkbox" id="hf-panels" />Background box</label>
                                    <label class="hf-check" title="Dome + hotbar end pieces (classic Fantasy)"><input type="checkbox" id="hf-ornaments" />Hotbar ornaments</label>
                                </div></div></details>
                            <details class="hf2-acc"><summary>Bar colours</summary><div>
                                <div class="hf-colors">${STAT_ORDER.map((s) => `<label class="hf-color"><input type="color" data-color="${s}" /><span>${STAT_LABEL[s]}</span></label>`).join('')}</div>
                                <button class="ghost-btn" id="hf-colors-reset">Use theme colours</button>
                            </div></details>
                            <details class="hf2-acc"><summary>All colour themes</summary><div>
                                <div class="hf-tgrid">${D.THEMES.map((t) => `<button class="hf-theme" data-theme="${t.id}" title="${esc(t.th)}"><img alt="" data-thumb="${t.id}" /><span>${esc(t.name)}</span></button>`).join('')}</div>
                            </div></details>
                            <details class="hf2-acc" id="hf-mana-sec"><summary>Mana placeholder</summary><div>
                                <div class="hf-row"><span>Value</span><input type="text" id="hf-mana" spellcheck="false" /></div>
                                <div class="hf-row"><span>Max</span><input type="text" id="hf-mana-max" spellcheck="false" /></div>
                            </div></details>
                            <details class="hf2-acc"><summary>Texture size</summary><div>
                                <div class="hf-row"><span>Texture size</span>
                                    <select id="hf-quality"><option value="1">1× (pixel, smallest)</option><option value="2">2×</option><option value="4">4×</option></select></div>
                            </div></details>
                          </div>
                        <div class="kz-note">All textures are pixel art drawn by KaizerHUD Studio — nothing is copied from a Java pack. Bars are shown partly filled as an example. Everything is created in a new group, so you can move or edit each piece afterwards (Ctrl+Z undoes the whole HUD).</div>
                        </div>
                    </div>
                </div>
                <div class="kz-window-foot">
                    <button class="ghost-btn" id="hf-random" title="Random style and colour">🎲 Random</button>
                    <button class="ghost-btn" id="hf-save-tpl" title="Save these settings as your own template">★ Save as my template</button>
                    <span style="flex:1"></span>
                    <button class="ghost-btn" data-close>Cancel</button>
                    <button class="primary-btn" id="hf-go">Create HUD</button>
                </div>
            </div>`;
        document.body.appendChild(back);
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
        back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
        ui.dotsFor = null;
        bind();
        syncControls();
        renderTemplates();
        applyFilter();
        drawPreview();
        fillThumbs();
        const card = back.querySelector('.hf2-card.active');
        if (card) card.scrollIntoView({ block: 'nearest' });
        // colour-theme thumbnails (Customize tab) after the window shows
        setTimeout(() => {
            if (!back) return;
            back.querySelectorAll('img[data-thumb]').forEach((img) => { img.src = themeThumb(themeById(img.dataset.thumb)); });
        }, 400);
    }

    function close() {
        if (back) back.remove();
        back = null;
        ui.thumbJob++;
        if (drawTimer) cancelAnimationFrame(drawTimer);
        drawTimer = 0;
    }

    function applyFilter() {
        if (!back) return;
        const mine = ui.genre === 'mine';
        const q = ui.q.trim().toLowerCase();
        let shown = 0;
        back.querySelector('#hf2-grid').style.display = mine ? 'none' : '';
        back.querySelector('#hf2-mine').style.display = mine ? '' : 'none';
        if (!mine) {
            back.querySelectorAll('#hf2-grid .hf2-card').forEach((c) => {
                const l = layoutById(c.dataset.layout);
                const g = ui.genre === 'all' || (ui.genre === 'new' ? isNewLayout(l.id) : l.genre === ui.genre);
                const ok = g && (!q || q.split(/\s+/).every((w) => searchText(l).includes(w)));
                c.style.display = ok ? '' : 'none';
                if (ok) shown++;
            });
        } else shown = readTemplates().length;
        const empty = back.querySelector('#hf2-empty');
        empty.style.display = shown ? 'none' : 'block';
        empty.textContent = mine ? 'No saved templates yet — pick a style and press "★ Save as my template".' : 'No style matches.';
        back.querySelectorAll('[data-genre]').forEach((b) => b.classList.toggle('active', b.dataset.genre === ui.genre));
    }

    function renderDots() {
        const box = back.querySelector('#hf2-dots');
        const ps = presetsOf(state.layout);
        const used = new Set(ps.map((p) => p.theme));
        let h = ps.map((p) => {
            const t = themeById(p.theme);
            return `<button class="hf2-dot" data-preset="${D.PRESETS.indexOf(p)}" data-dtheme="${t.id}" title="${esc(t.name)} — ${esc(t.th)}" style="background:${swatch(t)}"></button>`;
        }).join('');
        const rest = D.THEMES.filter((t) => !used.has(t.id));
        if (ui.allColours || !ps.length) {
            h += rest.map((t) => `<button class="hf2-dot" data-theme="${t.id}" data-dtheme="${t.id}" title="${esc(t.name)} — ${esc(t.th)}" style="background:${swatch(t)}"></button>`).join('');
        } else if (rest.length) h += `<button class="hf2-more" id="hf2-more" title="Show every colour theme">+${rest.length} more</button>`;
        box.innerHTML = h;
        box.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => update(() => applyPreset(D.PRESETS[+b.dataset.preset], true))));
        box.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => update(() => pickTheme(b.dataset.theme))));
        const more = box.querySelector('#hf2-more');
        if (more) more.addEventListener('click', () => { ui.allColours = true; ui.dotsFor = null; syncControls(); });
        ui.dotsFor = state.layout + (ui.allColours ? '+' : '');
    }

    let update = (fn) => fn();
    function bind() {
        const $ = (s) => back.querySelector(s);
        const $$ = (s) => back.querySelectorAll(s);
        const set = (fn) => { fn(); syncControls(); schedule(); };
        update = set;
        $$('[data-genre]').forEach((b) => b.addEventListener('click', () => { ui.genre = b.dataset.genre; applyFilter(); }));
        $('#hf2-q').value = ui.q;
        $('#hf2-q').addEventListener('input', (e) => {
            ui.q = e.target.value;
            if (ui.q && ui.genre === 'mine') ui.genre = 'all';
            applyFilter();
        });
        $$('#hf2-grid [data-layout]').forEach((b) => b.addEventListener('click', () => set(() => pickLayout(b.dataset.layout))));
        $$('.hf-tgrid [data-theme]').forEach((b) => b.addEventListener('click', () => set(() => pickTheme(b.dataset.theme))));
        $$('[data-shape]').forEach((b) => b.addEventListener('click', () => set(() => { state.shape = b.dataset.shape; })));
        $$('[data-bg]').forEach((b) => b.addEventListener('click', () => set(() => { state.bg = b.dataset.bg; })));
        $$('[data-quick]').forEach((b) => b.addEventListener('click', () => set(() => { const k = b.dataset.quick; state.parts[k] = !state.parts[k]; })));
        $$('[data-part]').forEach((cb) => cb.addEventListener('change', () => set(() => { state.parts[cb.dataset.part] = cb.checked; })));
        $$('[data-color]').forEach((inp) => inp.addEventListener('input', () => { state.colors[inp.dataset.color] = inp.value; schedule(); }));
        $('#hf-colors-reset').addEventListener('click', () => set(() => { state.colors = {}; }));
        const range = (id, key) => $(id).addEventListener('input', (e) => { state[key] = +e.target.value; syncControls(); schedule(); });
        range('#hf-barw', 'barW');
        range('#hf-barh', 'barH');
        range('#hf-segs', 'segs');
        const check = (id, key) => $(id).addEventListener('change', (e) => set(() => { state[key] = e.target.checked; }));
        check('#hf-icons', 'icons');
        check('#hf-panels', 'panels');
        check('#hf-pips', 'pips');
        check('#hf-values', 'values');
        check('#hf-ornaments', 'ornaments');
        check('#hf-slotnums', 'slotNums');
        $('#hf-quality').addEventListener('change', (e) => set(() => { state.quality = +e.target.value; }));
        $('#hf-mana').addEventListener('input', (e) => { state.manaPapi = e.target.value.trim(); schedule(); });
        $('#hf-mana-max').addEventListener('input', (e) => { state.manaMax = e.target.value.trim(); schedule(); });
        $('#hf-random').addEventListener('click', () => set(randomize));
        $('#hf-save-tpl').addEventListener('click', saveTemplate);
        $('#hf-go').addEventListener('click', create);
    }

    function pickTheme(id) {
        state.theme = id;
        const t = themeById(id);
        if (t.segs) state.segs = t.segs;
    }

    /** a combo = style + colour; `keepParts` keeps the user's Extras (used by the colour dots) */
    function applyPreset(p, keepParts) {
        const keep = keepParts && state.layout === p.layout ? { ...state.parts } : null;
        pickTheme(p.theme);
        applyLayout(p.layout);
        if (p.shape) state.shape = p.shape;
        Object.assign(state.parts, { mana: false, money: false, time: false, coords: false }, p.opts || {});
        if (keep) state.parts = keep;
    }
    /** picking a style card keeps the current colour when that style has it */
    function pickLayout(id) {
        const ps = presetsOf(id);
        const p = ps.find((x) => x.theme === state.theme) || ps[0];
        ui.allColours = false;
        if (p) applyPreset(p);
        else applyLayout(id);
    }

    function randomize() {
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        applyPreset(pick(D.PRESETS));
        if (Math.random() < 0.25) pickTheme(pick(D.THEMES).id);
    }

    function syncControls() {
        if (!back) return;
        const $ = (s) => back.querySelector(s);
        const mark = (attr, val) => back.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('active', b.dataset[attr] === val));
        if (ui.dotsFor !== state.layout + (ui.allColours ? '+' : '')) renderDots();
        mark('theme', state.theme);
        mark('dtheme', state.theme);
        mark('layout', state.layout);
        mark('shape', state.shape);
        mark('bg', state.bg);
        back.querySelectorAll('[data-quick]').forEach((b) => b.classList.toggle('active', !!state.parts[b.dataset.quick]));
        const l = layoutById(state.layout);
        $('#hf2-lname').textContent = l.name;
        $('#hf2-ldesc').textContent = l.th;
        $('#hf2-tune-name').textContent = `${l.name} · ${sk().name}`;
        back.querySelectorAll('[data-part]').forEach((cb) => { cb.checked = !!state.parts[cb.dataset.part]; });
        back.querySelectorAll('[data-color]').forEach((inp) => { inp.value = statColor(inp.dataset.color); });
        $('#hf-barw').value = state.barW; $('#hf-barw-v').textContent = state.barW;
        $('#hf-barh').value = state.barH; $('#hf-barh-v').textContent = state.barH;
        $('#hf-segs').value = state.segs; $('#hf-segs-v').textContent = state.segs;
        $('#hf-segs-row').style.display = barStyle().segmented ? '' : 'none';
        $('#hf-icons').checked = state.icons;
        $('#hf-panels').checked = state.panels;
        $('#hf-pips').checked = state.pips;
        $('#hf-values').checked = state.values;
        $('#hf-ornaments').checked = state.ornaments;
        $('#hf-slotnums').checked = state.slotNums;
        $('#hf-quality').value = String(state.quality);
        $('#hf-mana').value = state.manaPapi;
        $('#hf-mana-max').value = state.manaMax;
        $('#hf-mana-sec').style.display = state.parts.mana ? '' : 'none';
        // the bar length only matters for layouts that are not sized by the hotbar
        $('#hf-barw').disabled = isV2() || ['classic', 'center_row', 'fantasy', 'modern', 'survival'].includes(state.layout);
        $('#hf-barh').disabled = isV2() || state.layout === 'survival';
    }

    /* ───────────── saved templates (this PC only) ───────────── */

    function mergeState(s) {
        const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
        if (!s || typeof s !== 'object') return base;
        const out = { ...base, ...s, parts: { ...base.parts, ...(s.parts || {}) }, colors: { ...(s.colors || {}) } };
        if (!D.THEMES.some((t) => t.id === out.theme)) out.theme = base.theme;
        if (!D.SHAPES.some((x) => x.id === out.shape)) out.shape = 'theme';
        if (!D.LAYOUTS.some((x) => x.id === out.layout)) out.layout = base.layout;
        return out;
    }
    function saveLast() {
        try { localStorage.setItem(STORE_LAST, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    }
    function loadLast() {
        try { state = mergeState(JSON.parse(localStorage.getItem(STORE_LAST) || 'null')); } catch (e) { state = mergeState(null); }
    }
    function readTemplates() {
        try { const a = JSON.parse(localStorage.getItem(STORE_TPL) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    function writeTemplates(list) {
        try { localStorage.setItem(STORE_TPL, JSON.stringify(list)); return true; } catch (e) { return false; }
    }
    /* "★ My templates" in the gallery */
    function renderTemplates() {
        if (!back) return;
        const box = back.querySelector('#hf2-mine');
        const list = readTemplates();
        box.innerHTML = list.map((t, i) => `<button class="hf2-card" data-tpl="${i}" title="${esc(t.name)}">
            <span class="th"><img alt="" /></span><span class="meta"><b>${esc(t.name)}</b></span>
            <span class="del" data-tpl-del="${i}" title="Delete">×</span></button>`).join('');
        box.querySelectorAll('[data-tpl]').forEach((c) => {
            const i = +c.dataset.tpl;
            c.addEventListener('click', (e) => {
                if (e.target.closest('[data-tpl-del]')) { deleteTemplate(i); return; }
                const tpl = readTemplates()[i];
                if (tpl) update(() => { state = mergeState(tpl.state); ui.dotsFor = null; });
            });
            setTimeout(() => {
                try { c.querySelector('img').src = thumbFor(mergeState(list[i].state)); } catch (e) { /* bad template */ }
            }, 60 + i * 20);
        });
        applyFilter();
    }
    async function saveTemplate() {
        const def = `${layoutById(state.layout).name} · ${sk().name}`;
        const ask = window.kzPrompt ? window.kzPrompt('Template name', def) : Promise.resolve(window.prompt('Template name', def));
        const name = ((await ask) || '').trim();
        if (!name) return;
        const list = readTemplates().filter((t) => t.name !== name);
        list.push({ name: name.slice(0, 60), state: JSON.parse(JSON.stringify(state)) });
        if (!writeTemplates(list)) { toast('Could not save the template', 'error'); return; }
        ui.genre = 'mine';
        renderTemplates();
        toast(`Saved template "${name}"`, 'success');
    }
    async function deleteTemplate(i) {
        const list = readTemplates();
        if (!list[i]) return;
        const ok = window.kzConfirm ? await window.kzConfirm(`Delete template "${list[i].name}"?`) : true;
        if (!ok) return;
        list.splice(i, 1);
        writeTemplates(list);
        renderTemplates();
    }

    /* ───────────── create editor elements ───────────── */

    function toast(msg, type) {
        if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, type || 'info');
    }
    function anchorFrac(a) {
        if (a === 'center') return [0.5, 0.5];
        const [v, h] = a.split('_');
        const f = { left: 0, middle: 0.5, right: 1, top: 0, bottom: 1 };
        return [f[h], f[v]];
    }
    /** top-left box on the 480×270 screen → Bedrock offset for that anchor */
    function boxOffset(anchor, x, y, w, h) {
        const [fx, fy] = anchorFrac(anchor);
        return [r2(x + w * fx - SW * fx), r2(y + h * fy - SH * fy)];
    }
    const pointOffset = (anchor, x, y) => { const [fx, fy] = anchorFrac(anchor); return [r2(x - SW * fx), r2(y - SH * fy)]; };
    function uniqueGroup(name) {
        const base = String(name).replace(/[<>"']/g, '').slice(0, 40) || 'HUD';
        let n = base;
        let i = 2;
        while (App.groups.includes(n)) n = `${base} ${i++}`;
        return n;
    }

    async function create() {
        if (typeof App === 'undefined') return;
        const t = sk();
        const parts = renderPlan(planner(), state.quality);
        if (!parts.length && !on('hotbar')) { toast('Nothing to create — tick some parts first', 'error'); return; }
        const go = back.querySelector('#hf-go');
        go.disabled = true;
        go.textContent = 'Creating…';

        const ns = App.getNamespace();
        const used = new Set(App.elements.filter((e) => e.imageName).map((e) => e.imageName));
        const texName = (role) => {
            const base = `hf_${t.id}_${role}`.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
            let n = base;
            let i = 2;
            while (used.has(n)) n = `${base}_${i++}`;
            used.add(n);
            return n;
        };
        const usedBarTypes = new Set(App.elements.filter((e) => e.type === 'bar' && e.barType !== 'custom').map((e) => e.barType));
        const problems = [];
        const added = [];
        const group = uniqueGroup(/hud$/i.test(t.name) ? t.name : `${t.name} HUD`);
        const count = {};
        const nth = (k) => { count[k] = (count[k] || 0) + 1; return count[k] > 1 ? `${k}_${count[k]}` : k; };

        const myWindow = back;
        App.pushHistory();
        App.isRestoringHistory = true; // one undo step for the whole HUD
        // addElement re-renders the whole canvas every time: render once at the end instead
        const render = App.render;
        App.render = function () {};
        try {
            App.groups.push(group);
            App.currentGroup = group;
            for (const p of parts) {
                try {
                    const el = await makeElement(p, t, ns, texName, nth, usedBarTypes, problems);
                    for (const e of [].concat(el || [])) { e.group = group; added.push(e.id); }
                } catch (err) {
                    console.error('HUD Forge: could not create', p, err);
                    problems.push(`${p.t}${p.stat ? ' ' + p.stat : ''}: ${err.message}`);
                }
            }
            if (on('hotbar') && window.Widgets && Widgets.importLegacy) {
                try { await Widgets.importLegacy(hotbarFor(t).toDataURL('image/png')); } catch (err) { problems.push(`Hotbar texture: ${err.message}`); }
            }
        } finally {
            App.render = render;
            App.isRestoringHistory = false;
        }
        App.currentGroup = group;
        App.selectedIds = added;
        App.render();
        if (window.KZDoc) KZDoc.markDirty();
        saveLast();
        if (back === myWindow) close();
        const texts = App.elements.filter((e) => e.type === 'text').length;
        if (texts > 16) problems.push(`The project now has ${texts} scoreboard texts — only 16 (index 0–15) can be shown`);
        if (problems.length) alert(`Created ${added.length} items in group "${group}".\n\nPlease check:\n• ${problems.join('\n• ')}`);
        else toast(`Created ${added.length} items in group "${group}"`, 'success');
    }

    async function makeElement(p, t, ns, texName, nth, usedBarTypes, problems) {
        const A = p.anchor;
        const img = (role, tex, x, y, w, h, layer) => {
            const name = texName(role);
            return App.addElement('image', {
                name: nth(role),
                imageData: tex.toDataURL('image/png'),
                imageName: name,
                texturePath: `textures/${ns}/${name}`,
                anchor_from: A, anchor_to: A,
                offset: boxOffset(A, x, y, w, h),
                size: [w, h],
                layer,
            });
        };
        if (p.t === 'panel') return img('panel', p.tex, p.x, p.y, p.w, p.h, LAYER.panel);
        if (p.t === 'plate') return img('plate', p.tex, p.x, p.y, p.w, p.h, LAYER.plate);
        if (p.t === 'icon') return img(`icon_${p.icon}`, p.tex, p.x, p.y, p.w, p.h, LAYER.icon);
        if (p.t === 'badge') return img('crest', p.tex, p.x, p.y, p.w, p.h, LAYER.badge);
        if (p.t === 'comp') return img('frame', p.tex, p.x, p.y, p.w, p.h, LAYER.panel);
        if (p.t === 'img') return img(p.role, p.tex, p.x, p.y, p.w, p.h, LAYER[p.layer] || LAYER.panel);
        if (p.t === 'head' || p.t === 'headonly') {
            const frame = p.t === 'head' ? img('head_frame', p.tex, p.x, p.y, p.w, p.h, LAYER.frame) : null;
            // Bedrock shows the head through a clipped 35×31 window onto a 75×205 paper doll
            const fi = p.t === 'head' ? headInset(t) : 0;
            const hw = p.w - fi * 2;
            const k = hw / 35;
            const h2 = r2(31 * k);
            const hy = p.y + fi + (hw - h2) / 2;
            const head = App.addElement('player_head', {
                name: nth('player_head'),
                anchor_from: A, anchor_to: A,
                offset: boxOffset(A, p.x + fi, hy, hw, h2),
                size: [r2(hw), h2],
                layer: LAYER.head,
                doll_size: [r2(75 * k), r2(205 * k)],
                doll_offset: [r2(1 * k), r2(18 * k)],
            });
            return [frame, head].filter(Boolean);
        }
        if (p.t === 'text') {
            const size = 'small';
            const al = TEXT_ALIGN[p.align] || TEXT_ALIGN.left;
            const el = App.addElement('text', {
                name: nth('text'),
                anchor_from: A, anchor_to: A,
                offset: pointOffset(A, p.x, p.y),
                size: [Math.max(10, Math.round(p.w || 40)), TEXT_H],
                layer: LAYER.text,
                text_anchor_from: al.anchor,
                text_anchor_to: al.anchor,
                text_offset: [...al.offsets[size]],
                text_offsets: JSON.parse(JSON.stringify(al.offsets)),
                font_size: size,
                color: rgb01(p.color || '#ffffff'),
                shadow: !!p.shadow,
            });
            if (el) el.papi_placeholder = p.papi;
            return el;
        }
        if (p.t === 'xp') {
            // the number is centred in its box (preview, Bedrock and Java): a box of about
            // two digits (12×9) centred on the crest, placed like an image by its anchor corner
            return App.addElement('xp_label', {
                name: nth('xp_level'),
                text: '13',
                xp_font_size: 'normal',
                xp_color: p.plain ? [0.5, 1, 0.13] : [1, 1, 1],
                xp_shadow: true,
                anchor_from: A, anchor_to: A,
                offset: boxOffset(A, p.x - 6, p.y - 4.5, 12, 9),
                size: [12, 9],
                layer: LAYER.xp,
            });
        }
        if (p.t === 'bar') {
            const g = p.g;
            const track = p.inComp ? null : img(`${p.stat}_${g.pips ? 'pips_empty' : 'track'}`, p.track, p.x, p.y, p.w, p.h, LAYER.track);
            let type = BAR_TYPE[p.stat] || 'custom';
            let papi = '';
            let max = '';
            if (p.stat === 'xp') { papi = '%player_exp%'; max = '1'; }
            if (p.stat === 'mana') { papi = state.manaPapi; max = state.manaMax; }
            if (type !== 'custom' && usedBarTypes.has(type)) {
                [papi, max] = VANILLA_BAR_PAPI[type] || ['', ''];
                problems.push(`${STAT_LABEL[p.stat]}: a ${type.toUpperCase()} bar already exists, created as a Custom bar (${papi || 'set a placeholder'})`);
                type = 'custom';
            }
            if (type !== 'custom') usedBarTypes.add(type);
            if (type === 'custom' && (!String(papi).trim() || !String(max).trim())) {
                problems.push(`${STAT_LABEL[p.stat]} bar needs a placeholder and a Max value before export`);
            }
            const data = p.fill.toDataURL('image/png');
            const sliced = await sliceBarTexture(data, p.dir);
            const tag = type === 'custom' ? App.generateUniqueBarTag() : '';
            const bar = App.addElement('bar', {
                name: nth(`${p.stat}_bar`),
                anchor_from: A, anchor_to: A,
                offset: boxOffset(A, p.x + g.fx, p.y + g.fy, g.fw, g.fh),
                size: [g.fw, g.fh],
                layer: LAYER.bar,
                barType: type,
                barCustomTag: tag,
                barCustomPapi: type === 'custom' ? papi : '',
                barCustomMax: type === 'custom' ? max : '',
                barTexturePath: getDefaultBarTexturePath(type, tag),
                imageData: data,
                slicedImages: sliced.slices,
                barMaxSize: [g.fw, g.fh],
                barMinSize: p.dir === 'top' || p.dir === 'bottom' ? [g.fw, Math.max(1, Math.round(g.fh / 16))] : [Math.max(1, Math.round(g.fw / 16)), g.fh],
                previewStep: 16,
            });
            if (bar) bar.sliceDirection = p.dir;
            return [track, bar].filter(Boolean);
        }
        return null;
    }

    window.HudForge = { open: openWindow };
})();
