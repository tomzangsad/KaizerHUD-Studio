/*
 * HUD Forge v2 — redesign of the older styles (2026-11-21).
 * Re-registers the existing layout ids with new artwork, so saved templates keep working.
 *   batch 1: gothic (Bloodmoon), pirate (Saltdeck), samurai (Vermilion Gate), ocean (Tidepool),
 *            desert (Sunstone), winter (Snowdrift), halloween (Hollow Night), steam (Brassvein)
 * Loaded after hudforge_v2_set4.js; uses HudForgeV2.lib.
 */
(function () {
    'use strict';
    if (!window.HudForgeV2 || !HudForgeV2.lib.blob) return;
    const L = HudForgeV2.lib;
    const { Buf, mk, sheet, ringSel, framedSlots, blob, rr, circle, maskBlob, shapeFill, icon, statIcon, sparkle,
        PIPS, EMPTY, GLASS, VALUE_ONLY, COPPER, IRON, LEAF } = L;
    const A = 'bottom_middle';

    const WOOD = ['#1e1008', '#3c2212', '#5a3419', '#7a4a24', '#9c6634', '#c08a50'];
    const ROPE = ['#3a2a14', '#6a5028', '#8e7038', '#b4924c', '#d4b46c', '#f0d898'];
    const SAND = ['#3a2810', '#7a5a2c', '#a8844a', '#cfae6c', '#e8cc90', '#fbe8bc'];
    const SNOW = ['#5a6c84', '#8fa4bc', '#bccbdc', '#dde7f1', '#f0f5fa', '#ffffff'];
    const ICE = ['#123048', '#24587c', '#3c84ac', '#64acd0', '#9cd4ee', '#dcf4ff'];
    const PINE = ['#08160e', '#123020', '#1c4a30', '#286442', '#3a8256', '#5aa874'];
    const PUMPKIN = ['#3a1404', '#7a2e06', '#b04a0a', '#e06c14', '#f49438', '#ffc070'];
    const INKR = ['#08080a', '#141418', '#1e1e24', '#2a2a32', '#3a3a44', '#50505c'];
    const SHELL = ['#3a1a24', '#7a3a4a', '#b8667a', '#e098a8', '#f4c4cc', '#fff0f2'];
    const FLASK = ['#1a2028', '#34404c', '#56687a', '#7e94a8', '#b0c4d4', '#e8f2f8'];
    const GLOW = ['#3a2000', '#8a5000', '#d08a10', '#ffc030', '#ffe070', '#fff8c0'];

    /* ───────────── shared ───────────── */

    /** blob whose shape test takes screen coordinates */
    function sblob(b, x, y, w, h, f, R, opt) { blob(b, x, y, w, h, (i, j) => f(x + i + 0.5, y + j + 0.5), R, opt); }
    function poly(pts) {
        return (x, y) => {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const [xi, yi] = pts[i];
                const [xj, yj] = pts[j];
                if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
            }
            return inside;
        };
    }
    function line(b, x0, y0, x1, y1, c, w) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
        for (let k = 0; k <= n; k++) {
            const x = Math.round(x0 + ((x1 - x0) * k) / n);
            const y = Math.round(y0 + ((y1 - y0) * k) / n);
            b.set(x, y, c);
            if (w > 1) { b.set(x + 1, y, c); b.set(x, y + 1, c); }
        }
    }
    function channel(b, x, y, w, h, FR) {
        b.bevel(x, y, w, h, FR);
        b.rect(x + 2, y + 2, w - 4, h - 4, FR[0]);
        b.rect(x + 3, y + 3, w - 6, h - 6, GLASS);
        return { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
    }
    const plainFill = (X, stat, c) => shapeFill(c.x, c.y, c.w, c.h, () => true, X.statRamp(stat));
    function hbar(X, P, stat, c, dir, anchor) { P.bar(stat, plainFill(X, stat, c), dir, anchor || A); }
    /** pointed (gothic) arch: springline ys, width w, bottom bot */
    const arch = (cx, ys, w, bot) => (x, y) => y <= bot && (y >= ys ? Math.abs(x - cx) <= w / 2
        : Math.hypot(x - (cx + w / 2), y - ys) <= w && Math.hypot(x - (cx - w / 2), y - ys) <= w);
    /** a row of pips: empty track image + fill bar */
    function pips(X, P, stat, x, y, n, dir, anchor) {
        if (!X.on(stat)) return;
        const an = anchor || A;
        const tb = Buf(x, y, n * 8, 7);
        for (let i = 0; i < n; i++) tb.sprite(PIPS[stat], x + i * 8, y, EMPTY);
        P.img(`pips_${stat}`, tb, an, 'panel', true);
        const fb = Buf(x, y, n * 8 - 1, 7);
        for (let i = 0; i < n; i++) fb.sprite(PIPS[stat], x + i * 8, y, X.statRamp(stat));
        P.bar(stat, fb, dir || 'left', an);
    }
    /** a shape that fills from the bottom; inside takes screen coordinates */
    function vfill(X, P, stat, x, y, w, h, inside, anchor) {
        P.bar(stat, shapeFill(x, y, w, h, (i, j) => inside(x + i + 0.5, y + j + 0.5), X.statRamp(stat), true), 'bottom', anchor || A);
    }
    function iconImg(X, P, stat, x, y, anchor) {
        const ib = Buf(x, y, 9, 9);
        icon(ib, statIcon(stat), x, y, X.statRamp(stat));
        P.img(`icon_${stat}`, ib, anchor || A, 'icon');
    }
    function valueText(X, P, stat, x, y, anchor) {
        if (X.state.values === false || !X.on(stat)) return;
        const vp = VALUE_ONLY[stat] || X.valuePapi(stat);
        if (vp) P.text(vp, x, y, 'center', anchor || A, '#ffffff', 26);
    }
    /** thin XP rail across the hotbar top */
    function xpRail(X, P, y, h, track) {
        if (!X.on('xp')) return;
        const tb = Buf(149, y - 1, 182, h + 2);
        tb.rect(149, y - 1, 182, h + 2, track || '#0c0a10');
        P.img('xp_track', tb, A, 'panel', true);
        P.bar('xp', shapeFill(150, y, 180, h, () => true, X.statRamp('xp')), 'left', A);
    }
    function slotsHotbar(X, FR, SL, SELR, nums, deco) {
        return sheet((b) => { framedSlots(b, FR, SL, nums); if (deco) deco(b); }, (b) => ringSel(b, SELR));
    }
    const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

    /* ═════════════ Bloodmoon — cathedral windows that fill with colour ═════════════ */

    function bloodmoon(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const ST = t.metal;
        const fb = Buf(96, 188, 288, 82);
        // the blood moon low behind the centre arch
        sblob(fb, 216, 192, 49, 49, (x, y) => dist(x, y, 240.5, 216.5) <= 24, X.accent, { flat: true, outline: X.accent[1] });
        for (const [x, y, r] of [[232, 207, 3], [250, 223, 2], [236, 228, 2]]) sblob(fb, x - r, y - r, r * 2 + 1, r * 2 + 1, (a, c) => dist(a, c, x + 0.5, y + 0.5) <= r, X.accent, { flat: true, fill: X.accent[2], outline: X.accent[2] });
        // the band over the hotbar with an iron spike fence
        sblob(fb, 140, 234, 200, 12, () => true, t.plate);
        fb.hl(141, 235, 198, ST[4]);
        for (let x = 144; x < 336; x += 8) {
            if (x > 214 && x < 262) continue;
            fb.vl(x + 1, 229, 6, ST[0]); fb.vl(x + 2, 228, 7, ST[3]); fb.vl(x + 3, 229, 6, ST[0]);
            fb.set(x + 2, 227, ST[5]);
        }
        // centre arch with the rose window (level)
        sblob(fb, 222, 203, 37, 43, arch(240.5, 226, 34, 245), ST);
        for (let y = 208; y < 244; y++) for (let x = 226; x < 256; x++) if (arch(240.5, 226, 26, 243)(x + 0.5, y + 0.5)) fb.set(x, y, '#140810');
        if (on('level')) {
            sblob(fb, 230, 216, 21, 21, (x, y) => dist(x, y, 240.5, 226.5) <= 10, ST, { inset: true });
            sblob(fb, 233, 219, 15, 15, (x, y) => dist(x, y, 240.5, 226.5) <= 7, INKR, { flat: true, fill: '#1c0a12' });
        }
        for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            fb.set(Math.round(240 + Math.cos(a) * 12), Math.round(226 + Math.sin(a) * 12), X.accent[4]);
        }
        // two lancet windows: HP left, Food right
        const lancets = [];
        const lancet = (cx, stat) => {
            sblob(fb, cx - 12, 196, 25, 72, arch(cx + 0.5, 224, 24, 268), ST);
            const inner = arch(cx + 0.5, 224, 16, 264);
            for (let y = 200; y < 266; y++) for (let x = cx - 9; x < cx + 10; x++) if (inner(x + 0.5, y + 0.5)) fb.set(x, y, GLASS);
            lancets.push([stat, cx, inner]);
        };
        if (on('hp')) lancet(124, 'hp');
        if (on('food')) lancet(356, 'food');
        P.img('frame', fb, A, 'panel');
        for (const [stat, cx, inner] of lancets) {
            vfill(X, P, stat, cx - 8, 205, 17, 60, inner);
            // lead lines of the stained glass, drawn over the fill
            const lb = Buf(cx - 8, 205, 17, 60);
            for (const y of [222, 238, 252]) lb.hl(cx - 8, y, 17, '#0a0608');
            lb.vl(cx, 205, 60, '#0a0608');
            for (let y = 205; y < 265; y++) for (let x = cx - 8; x < cx + 9; x++) if (!inner(x + 0.5, y + 0.5)) lb.clear(x, y);
            P.img(`lead_${stat}`, lb, A, 'icon', true);
            iconImg(X, P, stat, cx - 4, 226);
            valueText(X, P, stat, cx + 0.5, 247);
        }
        pips(X, P, 'armor', 146, 237, 9, 'left');
        pips(X, P, 'air', 263, 237, 9, 'right');
        xpRail(X, P, 244, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 230.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function bloodmoonHotbar(X) {
        return slotsHotbar(X, X.t.metal, X.t.inset, X.accent, false, (b) => {
            for (let i = 0; i < 9; i++) { b.set(10 + i * 20, 1, X.t.metal[5]); b.set(10 + i * 20, 20, X.accent[3]); }
        });
    }

    /* ═════════════ Saltdeck — ship's wheel, rope plank, anchor ═════════════ */

    function saltdeck(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const BR = t.metal;
        const fb = Buf(88, 192, 304, 78);
        // plank with rope edges
        sblob(fb, 142, 228, 196, 18, () => true, WOOD);
        for (const y of [234, 240]) fb.hl(144, y, 192, WOOD[2]);
        for (let x = 143; x < 337; x++) for (const y0 of [228, 243]) for (let j = 0; j < 3; j++) fb.set(x, y0 + j, ((x + j) & 3) < 2 ? ROPE[4] : ROPE[2]);
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 150, 231, 78, 9, BR), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 252, 231, 78, 9, BR), 'right']);
        // skull & crossbones in the middle
        line(fb, 232, 230, 248, 242, '#d8d0bc', 2); line(fb, 248, 230, 232, 242, '#d8d0bc', 2);
        fb.sprite(['.ooooo.', 'owwwwwo', 'owdwdwo', 'owwwwwo', '.owdwo.', '..ooo..'], 237, 232, ['#1a1410', '#1a1410', '#1a1410', '#e8e0cc', '#e8e0cc', '#fffaf0']);
        // ship's wheel on the left
        const cx = 118, cy = 240;
        const wheel = new Set();
        for (let y = cy - 30; y <= cy + 30; y++) for (let x = cx - 30; x <= cx + 30; x++) {
            const d = dist(x + 0.5, y + 0.5, cx + 0.5, cy + 0.5);
            let ok = d >= 17 && d <= 21.5;
            for (let k = 0; k < 8 && !ok; k++) {
                const a = (k * Math.PI) / 4 + Math.PI / 8;
                const px = cx + 0.5 + Math.cos(a) * 26, py = cy + 0.5 + Math.sin(a) * 26;
                const along = ((x + 0.5 - cx - 0.5) * Math.cos(a) + (y + 0.5 - cy - 0.5) * Math.sin(a));
                const off = Math.abs(-(x + 0.5 - cx - 0.5) * Math.sin(a) + (y + 0.5 - cy - 0.5) * Math.cos(a));
                if (along > 0 && along < 24 && off < 1.6) ok = true;
                if (dist(x + 0.5, y + 0.5, px, py) <= 3.2) ok = true;
            }
            if (ok && y < 270) wheel.add(`${x},${y}`);
        }
        maskBlob(fb, wheel, WOOD);
        if (on('level')) {
            sblob(fb, cx - 9, cy - 9, 20, 20, (x, y) => dist(x, y, cx + 0.5, cy + 0.5) <= 9.5, BR);
            sblob(fb, cx - 6, cy - 6, 14, 14, (x, y) => dist(x, y, cx + 0.5, cy + 0.5) <= 6.5, INKR, { flat: true, fill: '#140c06' });
        } else sblob(fb, cx - 5, cy - 5, 12, 12, (x, y) => dist(x, y, cx + 0.5, cy + 0.5) <= 5.5, BR);
        // anchor on the right
        const ax = 364;
        const anc = new Set();
        const add = (x, y) => anc.add(`${x},${y}`);
        for (let y = 200; y <= 214; y++) for (let x = ax - 7; x <= ax + 7; x++) { const d = dist(x + 0.5, y + 0.5, ax + 0.5, 206.5); if (d <= 6 && d >= 3) add(x, y); }
        for (let y = 212; y <= 258; y++) for (let x = ax - 1; x <= ax + 2; x++) add(x, y);
        for (let x = ax - 9; x <= ax + 10; x++) for (let y = 216; y <= 218; y++) add(x, y);
        for (let y = 236; y <= 262; y++) for (let x = ax - 22; x <= ax + 23; x++) { const d = dist(x + 0.5, y + 0.5, ax + 0.5, 240.5); if (y >= 241 && d <= 21 && d >= 17.5) add(x, y); }
        for (const s of [-1, 1]) {
            const fx = ax + 0.5 + s * 19;
            for (let y = 232; y <= 246; y++) for (let x = Math.floor(fx) - 5; x <= Math.floor(fx) + 5; x++) if (poly([[fx - 4, 246], [fx + 4, 246], [fx, 233]])(x + 0.5, y + 0.5)) add(x, y);
        }
        maskBlob(fb, anc, BR);
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) hbar(X, P, stat, c, dir);
        pips(X, P, 'armor', 150, 219, 10, 'left');
        pips(X, P, 'air', 252, 219, 10, 'right');
        xpRail(X, P, 247, 1, WOOD[0]);
        if (on('level')) P.xp(cx + 0.5, cy + 4.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function saltdeckHotbar(X) {
        return slotsHotbar(X, WOOD, X.t.inset, X.t.metal, false, (b) => {
            for (let x = 0; x < 182; x++) { b.set(x, 0, (x & 3) < 2 ? ROPE[4] : ROPE[2]); b.set(x, 21, (x & 3) < 2 ? ROPE[3] : ROPE[1]); }
        });
    }

    /* ═════════════ Vermilion Gate — a torii over the hotbar ═════════════ */

    function vermilion(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const RED = t.plate;
        const fb = Buf(100, 186, 280, 84);
        // pillars, slightly tapered, with black feet
        for (const x0 of [129, 340]) {
            sblob(fb, x0, 208, 12, 62, poly([[x0 + 1, 208], [x0 + 11, 208], [x0 + 12, 270], [x0, 270]]), RED);
            sblob(fb, x0 - 1, 256, 14, 14, () => true, INKR);
        }
        // nuki (lower beam) through the pillars
        sblob(fb, 120, 214, 240, 8, () => true, RED);
        for (const x of [125, 352]) fb.rect(x, 216, 3, 4, RED[1]);
        // kasagi: upturned black top beam over a red one
        const kas = new Set();
        const shi = new Set();
        for (let x = 106; x <= 374; x++) {
            const u = Math.abs(x - 240) / 134;
            const lift = Math.round(u ** 3 * 9);
            for (let y = 194 - lift; y < 200 - lift + (u > 0.97 ? 0 : 1); y++) kas.add(`${x},${y}`);
            if (x >= 116 && x <= 364) for (let y = 200 - Math.round(u ** 3 * 5); y < 206 - Math.round(u ** 3 * 5); y++) shi.add(`${x},${y}`);
        }
        maskBlob(fb, shi, RED);
        maskBlob(fb, kas, INKR);
        // plaque (gakuzuka) between the beams = level
        sblob(fb, 228, 202, 25, 22, () => true, t.metal);
        fb.rect(230, 204, 21, 18, INKR[0]);
        fb.rect(231, 205, 19, 16, '#120a0a');
        // lacquered board behind the bars
        blob(fb, 145, 224, 190, 22, rr(190, 22, 2), INKR);
        fb.hl(147, 225, 186, INKR[5]);
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 150, 227, 80, 9, t.metal), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 250, 227, 80, 9, t.metal), 'right']);
        // a few falling petals
        for (const [x, y] of [[112, 222], [370, 230], [190, 212], [292, 210], [104, 246], [384, 252]]) { fb.set(x, y, '#ffb0c8'); fb.set(x + 1, y, '#ff8ab0'); fb.set(x, y + 1, '#ff8ab0'); }
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) hbar(X, P, stat, c, dir);
        pips(X, P, 'armor', 150, 237, 10, 'left');
        pips(X, P, 'air', 251, 237, 10, 'right');
        xpRail(X, P, 245, 1, INKR[0]);
        if (on('level')) P.xp(240.5, 216.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function vermilionHotbar(X) {
        return slotsHotbar(X, INKR, X.t.inset, X.t.plate, false, (b) => {
            b.hl(1, 1, 180, X.t.plate[3]);
        });
    }

    /* ═════════════ Tidepool — pearls in open clams, a breaking wave ═════════════ */

    function clam(fb, cx, cy) {
        // upper shell (open, behind) and lower shell (front), both with ribs
        const up = (x, y) => y <= cy && ((x - cx) / 24) ** 2 + ((y - cy) / 22) ** 2 <= 1;
        const low = (x, y) => y >= cy + 2 && ((x - cx) / 25) ** 2 + ((y - cy - 2) / 17) ** 2 <= 1;
        sblob(fb, cx - 25, cy - 23, 51, 25, up, SHELL);
        for (let k = -3; k <= 3; k++) line(fb, cx, cy, cx + k * 7, cy - 19 + Math.abs(k) * 3, SHELL[2], 1);
        sblob(fb, cx - 26, cy + 1, 53, 20, low, SHELL);
        for (let k = -3; k <= 3; k++) line(fb, cx, cy + 4, cx + k * 7, cy + 16 - Math.abs(k) * 2, SHELL[2], 1);
        fb.hl(cx - 22, cy + 3, 45, SHELL[5]);
    }
    function tidepool(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const W = t.plate;
        const fb = Buf(84, 192, 312, 78);
        // seaweed
        for (const [x0, s] of [[92, 1], [98, -1], [382, -1], [388, 1]]) for (let y = 268; y > 226; y--) {
            const x = Math.round(x0 + Math.sin((y + x0) / 5) * 2 * s);
            fb.set(x, y, LEAF[3]); fb.set(x + 1, y, LEAF[2]);
        }
        // the wave band over the hotbar
        const top = (x) => 232 + Math.round(2 * Math.sin((x - 144) / 7));
        sblob(fb, 142, 226, 196, 20, (x, y) => y >= top(Math.floor(x)), W);
        for (let x = 144; x < 336; x++) { fb.set(x, top(x) + 1, SNOW[5]); if (((x - 144) % 7) < 3) fb.set(x, top(x) + 2, SNOW[3]); }
        // curls at both ends
        for (const [cx, s] of [[146, -1], [334, 1]]) {
            const curl = new Set();
            for (let a = 0; a < 5.2; a += 0.05) {
                const r = 10 - a * 1.4;
                const x = Math.round(cx + s * Math.cos(a) * r);
                const y = Math.round(234 - Math.sin(a) * r);
                for (let k = 0; k < 2; k++) curl.add(`${x},${y + k}`);
            }
            maskBlob(fb, curl, SNOW);
        }
        // clams with pearls (HP left, Food right)
        const pearls = [];
        const clamAt = (cx, stat) => {
            clam(fb, cx, 244);
            sblob(fb, cx - 12, 228, 25, 25, (x, y) => dist(x, y, cx + 0.5, 240.5) <= 12, SNOW);
            for (let y = 229; y < 252; y++) for (let x = cx - 11; x < cx + 12; x++) if (dist(x + 0.5, y + 0.5, cx + 0.5, 240.5) <= 10) fb.set(x, y, GLASS);
            pearls.push([stat, cx]);
        };
        if (on('hp')) clamAt(116, 'hp');
        if (on('food')) clamAt(364, 'food');
        // porthole for the level
        if (on('level')) {
            sblob(fb, 228, 209, 25, 25, (x, y) => dist(x, y, 240.5, 221.5) <= 12, t.metal);
            sblob(fb, 232, 213, 17, 17, (x, y) => dist(x, y, 240.5, 221.5) <= 8, ICE, { inset: true, fill: '#0a2030' });
            for (const [x, y] of [[230, 221], [251, 221], [240, 211], [240, 231]]) fb.set(x, y, t.metal[5]);
        }
        // bubbles
        for (const [x, y, r] of [[136, 212, 2], [142, 202, 1], [344, 208, 2], [338, 198, 1], [262, 206, 1], [216, 214, 1]]) {
            for (let a = 0; a < 6.3; a += 0.3) fb.set(Math.round(x + Math.cos(a) * (r + 0.5)), Math.round(y + Math.sin(a) * (r + 0.5)), SNOW[4]);
        }
        P.img('frame', fb, A, 'panel');
        for (const [stat, cx] of pearls) {
            vfill(X, P, stat, cx - 10, 231, 21, 20, (x, y) => dist(x, y, cx + 0.5, 240.5) <= 10);
            const gl = Buf(cx - 6, 233, 4, 4); gl.set(cx - 5, 234, '#ffffff'); gl.set(cx - 4, 234, '#ffffff'); gl.set(cx - 5, 235, '#ffffff');
            P.img(`glint_${stat}`, gl, A, 'icon', true);
            iconImg(X, P, stat, cx - 4, 236);
        }
        pips(X, P, 'armor', 152, 236, 9, 'left');
        pips(X, P, 'air', 257, 236, 9, 'right');
        xpRail(X, P, 244, 1, W[0]);
        if (on('level')) P.xp(240.5, 225.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function tidepoolHotbar(X) {
        return slotsHotbar(X, X.t.plate, X.t.inset, SNOW, false, (b) => {
            for (let x = 1; x < 181; x++) if ((x % 7) < 3) b.set(x, 1, SNOW[4]);
        });
    }

    /* ═════════════ Sunstone — winged sun disc, obelisks ═════════════ */

    function sunstone(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const LZ = ['#0a1430', '#142a6a', '#1e3e9a', '#2c58c8', '#4a7ee8', '#8ab0ff'];
        const fb = Buf(100, 186, 280, 84);
        // sandstone ledge with the two cartouche bars
        sblob(fb, 142, 231, 196, 15, () => true, SAND);
        for (let x = 146; x < 336; x += 12) fb.vl(x, 233, 11, SAND[2]);
        const bars = [];
        const cart = (x, stat, dir) => {
            blob(fb, x, 233, 80, 11, rr(80, 11, 5), G);
            fb.vl(dir === 'left' ? x + 77 : x + 2, 235, 7, G[1]);
            blob(fb, x + 3, 235, 74, 7, rr(74, 7, 3), INKR, { flat: true, fill: GLASS });
            bars.push([stat, { x: x + 4, y: 236, w: 72, h: 5 }, dir]);
        };
        if (on('hp')) cart(149, 'hp', 'left');
        if (on('food')) cart(251, 'food', 'right');
        // wings: three feather rows, gold / lapis / gold
        const wing = (s) => {
            const pts = new Set();
            const col = new Map();
            for (let x = 150; x <= 229; x++) {
                const u = (229 - x) / 79;
                const top = Math.round(214 - 9 * u ** 1.3);
                const bot = Math.round(233 - 6 * u);
                const span = bot - top + 1;
                for (let y = top; y <= bot; y++) {
                    const f = (y - top) / span;
                    const k = f < 0.3 ? 0 : f < 0.52 ? 1 : 2;
                    const rowBot = k === 0 ? top + Math.floor(0.3 * span) - 1 : k === 1 ? top + Math.floor(0.52 * span) - 1 : bot;
                    const q = (x + k * 3) % 6;
                    // pointed feather tips: the last row of each band is notched between feathers
                    if (y === rowBot && (q === 0 || q === 5) && k < 2) continue;
                    if (y >= rowBot - 1 && k === 2 && (q === 0 || q === 5 || (y === rowBot && (q === 1 || q === 4)))) continue;
                    const sx = s < 0 ? x : 480 - x;
                    pts.add(`${sx},${y}`);
                    const R = k === 1 ? LZ : G;
                    let c = q === 0 ? R[1] : q === 1 ? R[4] : q === 5 ? R[2] : R[3];
                    if (y === top) c = R[5];
                    col.set(`${sx},${y}`, c);
                }
            }
            for (const k of pts) { const [x, y] = k.split(',').map(Number); fb.set(x, y, col.get(k)); }
            const has = (x, y) => pts.has(`${x},${y}`);
            for (const k of pts) { const [x, y] = k.split(',').map(Number); if (!has(x, y - 1) || !has(x - 1, y) || !has(x + 1, y)) fb.set(x, y, '#1a1008'); }
        };
        wing(-1); wing(1);
        // sun disc with rays
        for (let k = 0; k < 12; k++) {
            const a = (k * Math.PI) / 6;
            line(fb, Math.round(240 + Math.cos(a) * 13), Math.round(219 + Math.sin(a) * 13), Math.round(240 + Math.cos(a) * 17), Math.round(219 + Math.sin(a) * 17), G[4], 1);
        }
        sblob(fb, 227, 206, 27, 27, (x, y) => dist(x, y, 240.5, 219.5) <= 13, G);
        if (on('level')) sblob(fb, 231, 210, 19, 19, (x, y) => dist(x, y, 240.5, 219.5) <= 9, X.accent, { inset: true, fill: '#2a0e06' });
        // obelisks holding Armor (left) and Air (right)
        const obel = [];
        const obelisk = (cx, stat) => {
            sblob(fb, cx - 8, 204, 17, 66, poly([[cx - 4, 204], [cx + 5, 204], [cx + 8, 270], [cx - 7, 270]]), SAND);
            sblob(fb, cx - 5, 196, 11, 10, poly([[cx + 0.5, 196], [cx + 5.5, 205], [cx - 4.5, 205]]), G);
            if (on(stat)) {
                fb.rect(cx - 2, 211, 5, 52, SAND[0]);
                fb.rect(cx - 1, 212, 3, 50, GLASS);
                obel.push([stat, cx]);
            } else for (let y = 214; y < 260; y += 8) fb.sprite(['.o.', 'ooo', '.o.'], cx - 1, y, SAND);
        };
        obelisk(132, 'armor');
        obelisk(348, 'air');
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) P.bar(stat, shapeFill(c.x, c.y, c.w, c.h, rr(c.w, c.h, 2), X.statRamp(stat)), dir, A);
        for (const [stat, cx] of obel) {
            vfill(X, P, stat, cx - 1, 212, 3, 50, () => true);
            iconImg(X, P, stat, cx - 4, 186);
        }
        xpRail(X, P, 245, 1, SAND[0]);
        if (on('level')) P.xp(240.5, 223.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function sunstoneHotbar(X) {
        return slotsHotbar(X, SAND, X.t.inset, X.t.metal, false, (b) => {
            for (let i = 0; i < 9; i++) { b.set(1 + i * 20, 10, SAND[5]); b.set(1 + i * 20, 11, X.accent[3]); }
        });
    }

    /* ═════════════ Snowdrift — snow-capped board, snowflake, pines ═════════════ */

    function pine(fb, cx, base) {
        const pts = new Set();
        for (const [ty, h, w] of [[base - 50, 18, 9], [base - 38, 18, 12], [base - 26, 20, 15]]) {
            for (let j = 0; j < h; j++) { const hw = Math.round((w * j) / h); for (let i = -hw; i <= hw; i++) pts.add(`${cx + i},${ty + j}`); }
        }
        maskBlob(fb, pts, PINE);
        fb.rect(cx - 2, base - 6, 5, 6, WOOD[2]);
        for (const [ty, h, w] of [[base - 50, 18, 9], [base - 38, 18, 12], [base - 26, 20, 15]]) {
            for (let j = 2; j < 6; j++) { const hw = Math.round((w * j) / h); for (let i = -hw; i <= hw; i++) if ((i + j) % 3) fb.set(cx + i, ty + j, j === 2 ? SNOW[5] : SNOW[3]); }
            const hw = Math.round((w * (h - 1)) / h);
            for (let i = -hw; i <= hw; i += 2) fb.set(cx + i, ty + h - 1, SNOW[4]);
        }
    }
    function snowdrift(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const fb = Buf(90, 190, 300, 80);
        pine(fb, 112, 268); pine(fb, 368, 268);
        // the board
        sblob(fb, 142, 232, 196, 14, () => true, t.plate);
        // snow cap with drips
        const top = (x) => 227 + Math.round(1.4 * Math.sin(x / 5) + Math.sin(x / 2.3));
        const snow = new Set();
        for (let x = 140; x <= 340; x++) {
            const drip = (x * 37) % 23 === 0 ? 3 : (x * 37) % 11 === 0 ? 2 : 0;
            for (let y = top(x); y <= 234 + drip; y++) snow.add(`${x},${y}`);
        }
        maskBlob(fb, snow, SNOW);
        // icicles hanging from the board ends
        for (const x0 of [140, 333]) for (let i = 0; i < 7; i++) {
            const len = 4 + ((i * 5 + x0) % 9);
            for (let j = 0; j < len; j++) { const w = j < len / 2 ? 1 : 0; fb.set(x0 + i, 246 + j, j > len - 3 ? ICE[5] : ICE[3]); if (w && i < 6) fb.set(x0 + i, 246 + j, ICE[4]); }
            i++;
        }
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 150, 235, 78, 9, ICE), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 252, 235, 78, 9, ICE), 'right']);
        // snowflake medallion (level)
        for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 - Math.PI / 2;
            const ex = 240 + Math.cos(a) * 16, ey = 221 + Math.sin(a) * 16;
            line(fb, 240, 221, Math.round(ex), Math.round(ey), ICE[2], 2);
            line(fb, 240, 221, Math.round(ex), Math.round(ey), ICE[5], 1);
            for (const s of [-1, 1]) {
                const bx = 240 + Math.cos(a) * 10, by = 221 + Math.sin(a) * 10;
                line(fb, Math.round(bx), Math.round(by), Math.round(bx + Math.cos(a + s * 0.9) * 5), Math.round(by + Math.sin(a + s * 0.9) * 5), ICE[4], 1);
            }
        }
        if (on('level')) {
            const hex = poly([[233, 214], [247, 214], [251, 221], [247, 228], [233, 228], [229, 221]]);
            sblob(fb, 228, 213, 25, 17, hex, ICE, { inset: true, fill: '#0c2236' });
        }
        for (const [x, y] of [[164, 214], [196, 206], [286, 208], [318, 216], [130, 200], [352, 198]]) sparkle(fb, x, y, SNOW[3]);
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) hbar(X, P, stat, c, dir);
        pips(X, P, 'armor', 150, 218, 9, 'left');
        pips(X, P, 'air', 259, 218, 9, 'right');
        xpRail(X, P, 245, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 225.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function snowdriftHotbar(X) {
        return slotsHotbar(X, ICE, X.t.inset, SNOW, false, (b) => {
            for (let x = 0; x < 182; x++) if ((x * 7) % 5 < 3) b.set(x, 0, SNOW[5]);
        });
    }

    /* ═════════════ Hollow Night — cauldron, jack-o'-lantern, potion ═════════════ */

    function hollow(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const fb = Buf(86, 186, 308, 84);
        // band with slime drips
        sblob(fb, 142, 236, 196, 10, () => true, t.plate);
        for (let x = 143; x < 337; x++) {
            const d = (x * 13) % 17 === 0 ? 4 : (x * 7) % 9 === 0 ? 2 : 0;
            for (let y = 235; y <= 236 + d; y++) fb.set(x, y, y === 235 ? X.accent[4] : X.accent[3]);
        }
        // jack-o'-lantern in the middle; its mouth holds the level
        const pk = (x, y) => ((x - 240.5) / 20) ** 2 + ((y - 226) / 14) ** 2 <= 1;
        sblob(fb, 220, 211, 41, 30, pk, PUMPKIN);
        for (const dx of [-11, -4, 4, 11]) for (let y = 214; y < 238; y++) if (pk(240.5 + dx, y)) fb.set(240 + dx, y, PUMPKIN[2]);
        fb.rect(238, 207, 4, 6, LEAF[2]); fb.vl(238, 207, 6, LEAF[4]); fb.set(242, 207, LEAF[3]); fb.set(243, 206, LEAF[3]);
        for (const ex of [229, 245]) {
            const eye = poly([[ex, 225], [ex + 7, 225], [ex + 3.5, 218]]);
            for (let y = 217; y < 226; y++) for (let x = ex; x < ex + 8; x++) if (eye(x + 0.5, y + 0.5)) fb.set(x, y, GLOW[3]);
        }
        const mouth = poly([[226, 228], [255, 228], [252, 236], [229, 236]]);
        for (let y = 227; y < 237; y++) for (let x = 226; x < 256; x++) if (mouth(x + 0.5, y + 0.5)) fb.set(x, y, on('level') ? '#1a0800' : GLOW[3]);
        if (on('level')) { fb.hl(227, 227, 28, GLOW[3]); fb.hl(230, 236, 22, GLOW[2]); for (const x of [233, 247]) fb.rect(x, 228, 2, 2, GLOW[3]); }
        // cauldron (HP)
        const pots = [];
        if (on('hp')) {
            const cx = 118;
            sblob(fb, cx - 18, 248, 6, 16, () => true, IRON); sblob(fb, cx + 13, 248, 6, 16, () => true, IRON);
            const body = (x, y) => y >= 234 && ((x - cx - 0.5) / 21) ** 2 + ((y - 247) / 16) ** 2 <= 1;
            sblob(fb, cx - 21, 233, 44, 31, body, IRON);
            blob(fb, cx - 24, 230, 50, 7, rr(50, 7, 3), IRON);
            const inner = (x, y) => y >= 238 && ((x - cx - 0.5) / 17) ** 2 + ((y - 247) / 12) ** 2 <= 1;
            for (let y = 236; y < 260; y++) for (let x = cx - 18; x < cx + 19; x++) if (inner(x + 0.5, y + 0.5)) fb.set(x, y, GLASS);
            for (const [x, y, r] of [[cx - 6, 225, 2], [cx + 4, 221, 3], [cx + 10, 226, 1], [cx - 1, 214, 1]]) {
                for (let a = 0; a < 6.3; a += 0.3) fb.set(Math.round(x + Math.cos(a) * (r + 0.4)), Math.round(y + Math.sin(a) * (r + 0.4)), X.accent[4]);
            }
            pots.push(['hp', cx - 17, 237, 35, 22, inner, cx - 4, 242]);
        }
        // potion flask (Food)
        if (on('food')) {
            const cx = 362;
            const flask = (x, y) => dist(x, y, cx + 0.5, 250) <= 15 || (Math.abs(x - cx - 0.5) <= 5 && y >= 226 && y <= 240);
            sblob(fb, cx - 15, 225, 32, 41, flask, FLASK);
            blob(fb, cx - 5, 219, 12, 8, rr(12, 8, 2), WOOD);
            const inner = (x, y) => dist(x, y, cx + 0.5, 250) <= 12 || (Math.abs(x - cx - 0.5) <= 3 && y >= 229 && y <= 242);
            for (let y = 228; y < 264; y++) for (let x = cx - 13; x < cx + 14; x++) if (inner(x + 0.5, y + 0.5)) fb.set(x, y, GLASS);
            pots.push(['food', cx - 12, 229, 26, 34, inner, cx - 4, 246]);
        }
        // bats
        const bat = ['o.....o', 'oo.o.oo', 'ooooooo', '.o...o.'];
        for (const [x, y] of [[170, 206], [300, 200], [326, 214], [150, 196]]) fb.sprite(bat, x, y, ['#0a0610', '#0a0610', '#0a0610', '#1a1024', '#2a1a3a', '#2a1a3a']);
        P.img('frame', fb, A, 'panel');
        for (const [stat, x, y, w, h, inner, ix, iy] of pots) {
            vfill(X, P, stat, x, y, w, h, inner);
            iconImg(X, P, stat, ix, iy);
        }
        pips(X, P, 'armor', 148, 237, 9, 'left');
        pips(X, P, 'air', 261, 237, 9, 'right');
        xpRail(X, P, 245, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 235.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function hollowHotbar(X) {
        return slotsHotbar(X, X.t.plate, X.t.inset, PUMPKIN, false, (b) => {
            for (let x = 1; x < 181; x++) if ((x * 13) % 17 === 0) { b.set(x, 1, X.accent[3]); b.set(x, 2, X.accent[3]); }
        });
    }

    /* ═════════════ Brassvein — pressure gauges, pipes, boiler ═════════════ */

    function cog(cx, cy, r, teeth) {
        return (x, y) => {
            const d = dist(x, y, cx, cy);
            if (d <= r - 3) return true;
            if (d > r) return false;
            const a = Math.atan2(y - cy, x - cx);
            return Math.cos(a * teeth) > 0.2;
        };
    }
    function brassvein(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const BR = t.metal;
        const fb = Buf(84, 190, 312, 80);
        // gear behind the boiler
        sblob(fb, 218, 196, 45, 45, cog(240.5, 218.5, 22, 10), IRON);
        sblob(fb, 236, 214, 9, 9, (x, y) => dist(x, y, 240.5, 218.5) <= 4, IRON, { inset: true });
        // copper pipe across, with flanges
        sblob(fb, 136, 236, 208, 9, () => true, COPPER);
        fb.hl(137, 238, 206, COPPER[5]);
        for (const x of [140, 196, 280, 336]) sblob(fb, x - 2, 233, 6, 15, () => true, BR);
        // sight glasses on the pipe for Armor / Air
        const sight = [];
        if (on('armor')) { fb.rect(148, 236, 44, 9, BR[0]); fb.rect(149, 237, 42, 7, BR[3]); fb.rect(150, 238, 40, 5, GLASS); sight.push(['armor', { x: 150, y: 238, w: 40, h: 5 }, 'left']); }
        if (on('air')) { fb.rect(288, 236, 44, 9, BR[0]); fb.rect(289, 237, 42, 7, BR[3]); fb.rect(290, 238, 40, 5, GLASS); sight.push(['air', { x: 290, y: 238, w: 40, h: 5 }, 'right']); }
        // valve wheels
        for (const x of [208, 272]) {
            sblob(fb, x - 6, 222, 13, 13, (a, b) => { const d = dist(a, b, x + 0.5, 228.5); return (d <= 6 && d >= 4) || (Math.abs(a - x - 0.5) < 1 && d < 6) || (Math.abs(b - 228.5) < 1 && d < 6); }, IRON);
            fb.rect(x - 1, 234, 3, 3, IRON[3]);
        }
        // boiler with the level window
        blob(fb, 224, 210, 33, 36, rr(33, 36, 6), t.plate);
        for (const y of [213, 242]) for (let x = 228; x < 254; x += 4) fb.set(x, y, BR[4]);
        if (on('level')) {
            sblob(fb, 229, 214, 23, 23, (x, y) => dist(x, y, 240.5, 225.5) <= 11, BR);
            sblob(fb, 232, 217, 17, 17, (x, y) => dist(x, y, 240.5, 225.5) <= 8, INKR, { flat: true, fill: '#100a04' });
        }
        // steam puffs
        for (const [x, y] of [[204, 212], [276, 210], [210, 205]]) { fb.rect(x, y, 4, 2, '#e8ecf0'); fb.rect(x + 1, y - 1, 2, 4, '#d0d6dc'); }
        // pressure gauges (HP left, Food right)
        const gauges = [];
        const gauge = (cx, stat) => {
            sblob(fb, cx - 23, 217, 47, 47, (x, y) => dist(x, y, cx + 0.5, 240.5) <= 23, BR);
            sblob(fb, cx - 19, 221, 39, 39, (x, y) => dist(x, y, cx + 0.5, 240.5) <= 19, BR, { inset: true });
            for (let y = 222; y < 260; y++) for (let x = cx - 18; x < cx + 19; x++) if (dist(x + 0.5, y + 0.5, cx + 0.5, 240.5) <= 17) fb.set(x, y, GLASS);
            for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; fb.set(Math.round(cx + Math.cos(a) * 21), Math.round(240 + Math.sin(a) * 21), BR[5]); }
            gauges.push([stat, cx]);
        };
        if (on('hp')) gauge(114, 'hp');
        if (on('food')) gauge(366, 'food');
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of sight) hbar(X, P, stat, c, dir);
        for (const [stat, cx] of gauges) {
            vfill(X, P, stat, cx - 17, 223, 35, 35, (x, y) => dist(x, y, cx + 0.5, 240.5) <= 17);
            // dial ticks + glass glare over the fill
            const ov = Buf(cx - 17, 223, 35, 35);
            for (let k = 0; k <= 10; k++) {
                const a = Math.PI * 0.75 + (k * Math.PI * 1.5) / 10;
                for (let r = 14; r <= 16; r++) ov.set(Math.round(cx + 0.5 + Math.cos(a) * r), Math.round(240.5 + Math.sin(a) * r), k % 5 ? [0, 0, 0, 0.45] : [0, 0, 0, 0.8]);
            }
            for (let k = 0; k < 7; k++) ov.set(cx - 10 + k, 229 - Math.floor(k / 2), [255, 255, 255, 0.4]);
            P.img(`dial_${stat}`, ov, A, 'icon', true);
            iconImg(X, P, stat, cx - 4, 228);
            valueText(X, P, stat, cx + 0.5, 248);
        }
        xpRail(X, P, 247, 1, COPPER[0]);
        if (on('level')) P.xp(240.5, 229.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function brassveinHotbar(X) {
        return slotsHotbar(X, X.t.metal, X.t.inset, COPPER, false, (b) => {
            for (let i = 0; i <= 9; i++) { b.set(i * 20, 1, X.t.metal[5]); b.set(i * 20, 20, X.t.metal[1]); }
        });
    }

    /* ═════════════ batch 2 ═════════════ */

    const THATCH = ['#3a2a10', '#6a4c1c', '#987028', '#c09838', '#dcbc5c', '#f4e08c'];
    const TERRA = ['#3a1608', '#6e2c12', '#9c4420', '#c46030', '#de8450', '#f4b080'];
    const CLOUD = ['#8aa0c8', '#b8c8e4', '#d8e2f2', '#eef3fb', '#ffffff', '#ffffff'];
    const RAINBOW = ['#ff6a7a', '#ffaa5a', '#ffe36a', '#7ae08a', '#6ab8ff', '#b08aff'];
    const NAME = '%player_name%';
    const discs = (list) => (x, y) => list.some(([cx, cy, r]) => dist(x, y, cx, cy) <= r);

    /* ── Hearthwood: a little cottage on a shelf, flower pots ── */
    function flowerPot(fb, cx, base) {
        sblob(fb, cx - 10, base - 14, 21, 14, poly([[cx - 10, base - 14], [cx + 11, base - 14], [cx + 8, base], [cx - 7, base]]), TERRA);
        sblob(fb, cx - 12, base - 17, 25, 5, () => true, TERRA);
        const bush = discs([[cx - 5.5, base - 22, 7], [cx + 6.5, base - 23, 7], [cx + 0.5, base - 29, 8], [cx - 9.5, base - 28, 5], [cx + 10.5, base - 29, 5]]);
        sblob(fb, cx - 16, base - 38, 33, 23, bush, LEAF);
        const FL = L.FLOWERS || ['#e8364a', '#ffd23a', '#4aa8ff', '#ff8ad8'];
        [[-8, 32], [3, 34], [9, 26], [-3, 25], [-11, 23], [12, 20]].forEach(([dx, dy], k) => {
            const c = FL[k % 4];
            fb.set(cx + dx, base - dy, '#fff6c0'); fb.set(cx + dx - 1, base - dy, c); fb.set(cx + dx + 1, base - dy, c); fb.set(cx + dx, base - dy - 1, c); fb.set(cx + dx, base - dy + 1, c);
        });
    }
    function hearthwood(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const WD = t.plate;
        const fb = Buf(96, 186, 288, 84);
        // shelf
        sblob(fb, 120, 230, 240, 16, () => true, WD);
        fb.hl(121, 231, 238, WD[5]);
        for (const x of [124, 352]) { fb.rect(x, 246, 4, 8, WD[1]); fb.vl(x, 246, 8, WD[3]); }
        flowerPot(fb, 132, 230); flowerPot(fb, 348, 230);
        // cottage
        sblob(fb, 213, 212, 55, 20, () => true, WD);
        for (const x of [214, 266]) fb.vl(x, 213, 18, WD[1]);
        const roof = poly([[205, 215], [276, 215], [240.5, 193]]);
        sblob(fb, 204, 192, 74, 25, roof, THATCH);
        for (let y = 197; y < 215; y += 3) for (let x = 205; x < 276; x++) if (roof(x + 0.5, y + 0.5) && roof(x + 0.5, y - 0.5)) fb.set(x, y, THATCH[2]);
        sblob(fb, 256, 194, 8, 12, () => true, IRON);
        for (const [x, y] of [[262, 189], [266, 186], [264, 183]]) { fb.rect(x, y, 3, 2, '#e8ecf0'); fb.set(x + 1, y - 1, '#d0d6dc'); }
        if (on('level')) {
            sblob(fb, 232, 199, 17, 15, (x, y) => dist(x, y, 240.5, 206.5) <= 7.5, t.metal);
            sblob(fb, 235, 202, 11, 9, (x, y) => dist(x, y, 240.5, 206.5) <= 5, INKR, { flat: true, fill: '#1a0e06' });
        }
        if (on('name')) { blob(fb, 216, 216, 49, 10, rr(49, 10, 2), WOOD); fb.hl(218, 217, 45, WOOD[5]); }
        fb.rect(237, 226, 7, 6, WD[0]); fb.rect(238, 227, 5, 5, WOOD[2]); fb.set(242, 229, t.metal[4]);
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 148, 231, 62, 10, t.metal), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 270, 231, 62, 10, t.metal), 'right']);
        const thin = [];
        const track = (stat, x) => { if (!on(stat)) return; fb.rect(x, 241, 58, 3, WD[0]); thin.push([stat, { x: x + 1, y: 242, w: 56, h: 1 }, x < 240 ? 'left' : 'right']); };
        track('armor', 150); track('air', 272);
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) { hbar(X, P, stat, c, dir); iconImg(X, P, stat, dir === 'left' ? 138 : 333, 232); }
        for (const [stat, c, dir] of thin) P.bar(stat, shapeFill(c.x, c.y, c.w, 1, () => true, X.statRamp(stat)), dir, A);
        xpRail(X, P, 245, 1, WD[0]);
        if (on('level')) P.xp(240.5, 210.5, A);
        if (on('name')) { const n0 = P.parts.length; P.text(NAME, 240.5, 220.5, 'center', A, '#fff2d8', 46); void n0; }
        X.infoStrips(P);
        return P.parts;
    }
    function hearthwoodHotbar(X) {
        return slotsHotbar(X, X.t.plate, X.t.inset, LEAF, false, (b) => {
            for (let i = 0; i < 9; i++) { b.set(3 + i * 20, 3, LEAF[4]); b.set(4 + i * 20, 3, LEAF[3]); }
        });
    }

    /* ── Puffcloud: rainbow arch, bubble orbs on clouds, sun level ── */
    function puffcloud(X) {
        const on = X.on;
        const P = mk(X);
        const fb = Buf(96, 150, 288, 120);
        // rainbow (6 bands, 2px each)
        for (let y = 150; y <= 238; y++) for (let x = 132; x <= 348; x++) {
            const d = dist(x + 0.5, y + 0.5, 240.5, 262);
            if (d > 104 || d < 92) continue;
            fb.set(x, y, L.mixHex(RAINBOW[Math.min(5, Math.floor((104 - d) / 2))], '#ffffff', 0.25));
        }
        // sun
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(fb, Math.round(240 + Math.cos(a) * 12), Math.round(201 + Math.sin(a) * 12), Math.round(240 + Math.cos(a) * 15), Math.round(201 + Math.sin(a) * 15), '#ffc84a', 1); }
        sblob(fb, 229, 190, 23, 23, (x, y) => dist(x, y, 240.5, 201.5) <= 11, GLOW);
        if (!on('level')) { fb.rect(235, 199, 2, 2, '#5a3000'); fb.rect(244, 199, 2, 2, '#5a3000'); fb.hl(238, 205, 5, '#5a3000'); }
        fb.rect(231, 205, 3, 2, '#ff9aa8'); fb.rect(247, 205, 3, 2, '#ff9aa8');
        // name pill
        if (on('name')) blob(fb, 208, 216, 65, 12, rr(65, 12, 6), CLOUD);
        // cloud base across the hotbar top + small clouds under the orbs
        const base = discs([[150, 242, 7], [163, 239, 8], [178, 241, 7], [194, 238, 8], [210, 241, 7], [226, 239, 8], [242, 241, 7], [258, 238, 8], [274, 241, 7], [290, 239, 8], [306, 241, 7], [320, 238, 8], [332, 242, 7]]);
        sblob(fb, 140, 229, 202, 18, (x, y) => y <= 246 && (base(x, y) || (y >= 240 && x > 144 && x < 338)), CLOUD);
        const orbs = [];
        const orb = (cx, stat) => {
            sblob(fb, cx - 22, 250, 45, 18, discs([[cx - 12, 260, 7], [cx + 0.5, 257, 9], [cx + 13, 260, 7], [cx, 263, 7]]), CLOUD);
            sblob(fb, cx - 14, 230, 29, 29, (x, y) => dist(x, y, cx + 0.5, 244.5) <= 14, L.pastel ? L.pastel(X.accent, 0.35) : X.accent);
            for (let y = 232; y < 258; y++) for (let x = cx - 12; x < cx + 13; x++) if (dist(x + 0.5, y + 0.5, cx + 0.5, 244.5) <= 11.5) fb.set(x, y, [255, 255, 255, 0.28]);
            orbs.push([stat, cx]);
        };
        if (on('hp')) orb(124, 'hp');
        if (on('food')) orb(356, 'food');
        for (const [x, y] of [[150, 206], [330, 204], [176, 196], [304, 194]]) sparkle(fb, x, y, '#ffe36a');
        P.img('frame', fb, A, 'panel');
        for (const [stat, cx] of orbs) {
            vfill(X, P, stat, cx - 11, 233, 23, 23, (x, y) => dist(x, y, cx + 0.5, 244.5) <= 11.5);
            const gl = Buf(cx - 8, 235, 6, 6); gl.rect(cx - 7, 236, 2, 1, '#ffffff'); gl.set(cx - 8, 237, '#ffffff'); gl.set(cx - 8, 238, '#ffffff');
            P.img(`shine_${stat}`, gl, A, 'icon', true);
            iconImg(X, P, stat, cx - 4, 240);
        }
        pips(X, P, 'armor', 158, 231, 7, 'left');
        pips(X, P, 'air', 267, 231, 7, 'right');
        xpRail(X, P, 244, 1, CLOUD[1]);
        if (on('level')) P.xp(240.5, 205.5, A);
        if (on('name')) P.text(NAME, 240.5, 221.5, 'center', A, '#5a4a8a', 60);
        if (on('name')) P.parts[P.parts.length - 1].shadow = false;
        X.infoStrips(P);
        return P.parts;
    }
    function puffcloudHotbar(X) {
        return slotsHotbar(X, CLOUD, X.t.inset, ['#7a5ab8', '#b08aff', '#c8a8ff', '#ffb0d8', '#ffe36a', '#ffffff'], false, (b) => {
            for (let x = 1; x < 181; x++) b.set(x, 1, L.mixHex(RAINBOW[Math.floor(x / 31) % 6], '#ffffff', 0.3));
        });
    }

    /* ── Gridpulse: synthwave sun, neon parallelogram bars, grid floor ── */
    function neonShape(b, x0, y0, w, h, f, c, fill) {
        for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
            const at = (a, bb) => f(a + 0.5, bb + 0.5);
            if (at(x, y)) {
                const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
                b.set(x, y, edge ? c : fill);
            } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) b.set(x, y, L.rgba(c, 0.35));
        }
    }
    const para = (x, y, w, h, sl) => (px, py) => py >= y && py < y + h && px >= x + (sl * (y + h - py)) / h && px < x + w + (sl * (y + h - py)) / h;
    function gridpulse(X) {
        const on = X.on;
        const P = mk(X);
        const N1 = X.accent[4];
        const N2 = '#ff4ad0';
        const DK = [8, 4, 18, 0.82];
        const fb = Buf(90, 196, 300, 74);
        // floor grid on both sides
        const GC = L.mixHex(N2, '#1a0820', 0.4);
        for (const [x0, x1] of [[92, 146], [334, 388]]) {
            const inR = (x, y) => x >= x0 && x <= x1 && y >= 240 && y <= 268;
            for (const y of [240, 244, 250, 258, 268]) for (let x = x0; x <= x1; x++) fb.set(x, y, GC);
            for (let k = -9; k <= 9; k++) {
                const xa = 240 + k * 18 * (4 / 32), xb = 240 + k * 18;
                for (let q = 0; q <= 400; q++) {
                    const y = 236 + (32 * q) / 400;
                    const x = Math.round(xa + ((xb - xa) * (y - 236)) / 32 * (32 / 32));
                    const yy = Math.round(y);
                    if (inR(x, yy)) fb.set(x, yy, GC);
                }
            }
        }
        // synthwave sun behind the middle
        for (let y = 210; y <= 238; y++) for (let x = 214; x <= 267; x++) {
            if (dist(x + 0.5, y + 0.5, 240.5, 238) > 26) continue;
            const g = 238 - y;
            if (g < 14 && g % 4 === 1) continue;
            fb.set(x, y, L.mixHex('#ff3a8a', '#ffe14a', Math.min(1, g / 26)));
        }
        if (on('level')) neonShape(fb, 227, 228, 27, 11, (x, y) => rr(27, 11, 3)(Math.floor(x) - 227, Math.floor(y) - 228), N1, DK);
        // bars
        const bars = [];
        const big = (stat, x, sl, dir) => { if (!on(stat)) return; neonShape(fb, x, 220, 66, 10, para(x, 220, 66, 10, sl), dir === 'left' ? N1 : N2, DK); bars.push([stat, x, sl, dir, 220, 10]); };
        const thin = (stat, x, sl, dir) => { if (!on(stat)) return; neonShape(fb, x, 233, 60, 5, para(x, 233, 60, 5, sl), dir === 'left' ? N1 : N2, DK); bars.push([stat, x, sl, dir, 233, 5]); };
        big('hp', 146, 4, 'left'); big('food', 264, -4, 'right');
        thin('armor', 150, 3, 'left'); thin('air', 270, -3, 'right');
        P.img('frame', fb, A, 'panel', true);
        for (const [stat, x, sl, dir, y, h] of bars) {
            const f = para(x + 1, y + 1, 64 - (h < 8 ? 2 : 0) - (h < 8 ? 2 : 0), h - 2, sl);
            const w = h < 8 ? 56 : 64;
            P.bar(stat, shapeFill(x - 4, y + 1, w + 12, h - 2, (i, j) => para(x + 1, y + 1, w, h - 2, sl)(x - 4 + i + 0.5, y + 1 + j + 0.5), X.statRamp(stat)), dir, A);
            void f;
            if (h >= 8) valueText(X, P, stat, x + 35 + sl / 2, y + 6);
        }
        xpRail(X, P, 244, 1, [8, 4, 18, 0.8]);
        if (on('level')) P.xp(240.5, 237.5, A);
        if (on('name')) P.text(NAME, 150, 214, 'left', A, '#ffffff', 60);
        X.infoStrips(P);
        return P.parts;
    }
    function gridpulseHotbar(X) {
        const N1 = X.accent;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, [8, 4, 18, 0.8]);
            for (let x = 0; x < 182; x++) { b.set(x, 0, N1[4]); b.set(x, 21, '#ff4ad0'); }
            for (let i = 0; i < 9; i++) { const sx = 1 + i * 20; b.rect(sx + 2, 3, 16, 16, [255, 255, 255, 0.05]); b.vl(sx + 19, 2, 18, [255, 74, 208, 0.4]); }
        }, (b) => { for (let k = 0; k < 2; k++) { b.hl(k, k, 24 - 2 * k, N1[5]); b.vl(k, k, 24 - 2 * k, N1[5]); b.hl(k, 23 - k, 24 - 2 * k, '#ff4ad0'); b.vl(23 - k, k, 24 - 2 * k, '#ff4ad0'); } });
    }

    /* ── Coin-op: arcade marquee with bulbs, joystick and buttons ── */
    function coinop(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const fb = Buf(96, 196, 288, 74);
        // cabinet control panel under everything
        sblob(fb, 98, 250, 50, 20, poly([[104, 250], [147, 250], [147, 270], [98, 270]]), t.plate);
        sblob(fb, 333, 244, 50, 26, poly([[333, 244], [376, 244], [382, 270], [333, 270]]), t.plate);
        // joystick
        blob(fb, 104, 256, 22, 8, rr(22, 8, 4), INKR);
        fb.rect(113, 236, 4, 22, IRON[2]); fb.vl(113, 236, 22, IRON[4]);
        sblob(fb, 108, 226, 14, 14, (x, y) => dist(x, y, 115, 233) <= 6.8, ['#3a0408', '#6a0a14', '#a01428', '#d82a40', '#ff6070', '#ffc0c8']);
        // buttons
        for (const [x, y, c] of [[350, 255, ['#3a0408', '#6a0a14', '#a01428', '#d82a40', '#ff6070', '#ffc0c8']], [366, 251, ['#04103a', '#0a206a', '#1438a0', '#2a5ad8', '#6090ff', '#c0d4ff']], [362, 263, ['#2a2404', '#5a4c0a', '#a08a14', '#d8c02a', '#ffe060', '#fff6c0']]]) {
            sblob(fb, x - 6, y - 6, 13, 13, (a, b) => dist(a, b, x + 0.5, y + 0.5) <= 6, c);
        }
        // marquee
        blob(fb, 142, 204, 196, 43, rr(196, 43, 3), t.metal);
        fb.rect(146, 208, 188, 35, '#07060e');
        for (let x = 146; x < 334; x += 5) { const c = (x / 5) % 2 ? '#ffe14a' : X.accent[4]; fb.set(x, 206, c); fb.set(x + 1, 206, c); fb.set(x, 244, c); fb.set(x + 1, 244, c); }
        for (let y = 210; y < 242; y += 5) { const c = (y / 5) % 2 ? '#ffe14a' : X.accent[4]; fb.set(144, y, c); fb.set(144, y + 1, c); fb.set(335, y, c); fb.set(335, y + 1, c); }
        fb.hl(148, 220, 184, X.accent[2]);
        if (on('level')) { const cs = ['.ooo.', 'obwbo', 'obbbo', 'obdbo', '.ooo.']; fb.sprite(cs, 300, 211, GLOW); }
        // space invaders on top
        const inv = ['..o.....o..', '...o...o...', '..ooooooo..', '.oo.ooo.oo.', 'ooooooooooo', 'o.ooooooo.o', 'o.o.....o.o', '...oo.oo...'];
        const IC = [X.accent[1], X.accent[1], X.accent[1], X.accent[4], X.accent[4], X.accent[5]];
        fb.sprite(inv.map((r) => r.replace(/o/g, 'b')), 150, 194, IC); fb.sprite(inv.map((r) => r.replace(/o/g, 'b')), 319, 194, IC);
        P.img('frame', fb, A, 'panel');
        pips(X, P, 'hp', 150, 223, 10, 'left');
        pips(X, P, 'food', 251, 223, 10, 'right');
        pips(X, P, 'armor', 150, 232, 10, 'left');
        pips(X, P, 'air', 251, 232, 10, 'right');
        xpRail(X, P, 241, 1, '#1a1830');
        if (on('name')) P.text(NAME, 150, 214.5, 'left', A, '#ffe14a', 60);
        if (on('level')) P.xp(318.5, 217.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function coinopHotbar(X) {
        return slotsHotbar(X, X.t.metal, X.t.inset, ['#3a2a04', '#8a6a0a', '#d0a020', '#ffe14a', '#fff08a', '#ffffff'], false, (b) => {
            for (let x = 2; x < 180; x += 5) b.set(x, 1, (x / 5) % 2 ? '#ffe14a' : X.accent[4]);
        });
    }

    /* ── Gemguard: faceted crystals in gold claw settings ── */
    function gemguard(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const fb = Buf(90, 190, 300, 80);
        // band with gold trim and filigree
        sblob(fb, 140, 234, 200, 12, () => true, t.plate);
        fb.hl(141, 235, 198, G[4]); fb.hl(141, 244, 198, G[2]);
        for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
            const cx = 240 + s * (36 + k * 24);
            for (let a = 0; a < 5.6; a += 0.12) { const r = 5 - a * 0.7; fb.set(Math.round(cx + s * Math.cos(a) * r), Math.round(228 - Math.sin(a) * r), G[4]); }
            line(fb, cx, 233, cx + s * 12, 233, G[3], 1);
        }
        const gems = [];
        const crystal = (cx, stat) => {
            const outer = poly([[cx + 0.5, 206], [cx + 14.5, 219], [cx + 14.5, 254], [cx + 0.5, 268], [cx - 13.5, 254], [cx - 13.5, 219]]);
            const inner = poly([[cx + 0.5, 211], [cx + 10.5, 221], [cx + 10.5, 252], [cx + 0.5, 263], [cx - 9.5, 252], [cx - 9.5, 221]]);
            sblob(fb, cx - 14, 205, 30, 64, outer, G);
            for (let y = 206; y < 268; y++) for (let x = cx - 13; x < cx + 15; x++) if (inner(x + 0.5, y + 0.5)) fb.set(x, y, GLASS);
            // claw prongs
            for (const [px, py] of [[cx - 15, 217], [cx + 13, 217], [cx - 15, 253], [cx + 13, 253]]) blob(fb, px, py, 4, 6, rr(4, 6, 1), G);
            gems.push([stat, cx, inner]);
        };
        if (on('hp')) crystal(120, 'hp');
        if (on('food')) crystal(360, 'food');
        // centre gem (level)
        sblob(fb, 226, 211, 29, 29, (x, y) => dist(x, y, 240.5, 225.5) <= 14, G);
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; blob(fb, Math.round(240 + Math.cos(a) * 14) - 2, Math.round(225 + Math.sin(a) * 14) - 2, 5, 5, circle(5), G); }
        if (on('level')) sblob(fb, 230, 215, 21, 21, (x, y) => dist(x, y, 240.5, 225.5) <= 10, t.gemRamp || X.accent, { inset: true });
        P.img('frame', fb, A, 'panel');
        for (const [stat, cx, inner] of gems) {
            vfill(X, P, stat, cx - 9, 211, 20, 52, inner);
            const ov = Buf(cx - 9, 211, 20, 52);
            line(ov, cx, 212, cx, 262, [255, 255, 255, 0.22], 1);
            line(ov, cx - 9, 222, cx, 232, [255, 255, 255, 0.18], 1); line(ov, cx + 10, 222, cx + 1, 232, [0, 0, 0, 0.2], 1);
            line(ov, cx - 9, 251, cx, 241, [255, 255, 255, 0.12], 1); line(ov, cx + 10, 251, cx + 1, 241, [0, 0, 0, 0.25], 1);
            for (let y = 211; y < 263; y++) for (let x = cx - 9; x < cx + 11; x++) if (!inner(x + 0.5, y + 0.5)) ov.clear(x, y);
            P.img(`facets_${stat}`, ov, A, 'icon', true);
            iconImg(X, P, stat, cx - 4, 224);
            valueText(X, P, stat, cx + 0.5, 248);
        }
        pips(X, P, 'armor', 146, 237, 9, 'left');
        pips(X, P, 'air', 263, 237, 9, 'right');
        xpRail(X, P, 244, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 229.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function gemguardHotbar(X) {
        return slotsHotbar(X, X.t.metal, X.t.inset, X.t.gemRamp || X.accent, false, (b) => {
            for (let i = 1; i < 9; i++) { b.set(i * 20, 10, X.accent[4]); b.set(i * 20, 11, X.accent[2]); }
        });
    }

    /* ── Slimline: frosted glass card, pill bars ── */
    function slimline(X) {
        const on = X.on;
        const P = mk(X);
        const AC = X.accent;
        const fb = Buf(140, 206, 200, 42);
        blob(fb, 144, 221, 192, 25, rr(192, 25, 5), [[0, 0, 0, 0.5], 0, 0, [14, 16, 22, 0.72], [255, 255, 255, 0.18], 0], { flat: true, fill: [14, 16, 22, 0.72], outline: [255, 255, 255, 0.14] });
        fb.hl(150, 221, 180, AC[4]);
        for (const [x, s] of [[146, 1], [330, -1]]) for (let k = 0; k < 3; k++) line(fb, x + s * k * 3, 244, x + s * (k * 3 + 3), 239, AC[3], 1);
        const pill = (x) => { blob(fb, x, 225, 72, 8, rr(72, 8, 4), [[0, 0, 0, 0.6]], { flat: true, fill: [0, 0, 0, 0.55], outline: [0, 0, 0, 0.6] }); return { x: x + 1, y: 226, w: 70, h: 6 }; };
        const bars = [];
        if (on('hp')) bars.push(['hp', pill(160), 'left', 149]);
        if (on('food')) bars.push(['food', pill(248), 'right', 322]);
        const thin = [];
        if (on('armor')) { fb.rect(160, 236, 72, 2, [0, 0, 0, 0.55]); thin.push(['armor', 160, 'left']); }
        if (on('air')) { fb.rect(248, 236, 72, 2, [0, 0, 0, 0.55]); thin.push(['air', 248, 'right']); }
        if (on('level')) blob(fb, 228, 210, 25, 11, rr(25, 11, 5), AC, { flat: true, fill: AC[3], outline: AC[1] });
        P.img('card', fb, A, 'panel', true);
        for (const [stat, c, dir, ix] of bars) {
            P.bar(stat, shapeFill(c.x, c.y, c.w, c.h, rr(c.w, c.h, 3), X.statRamp(stat)), dir, A);
            iconImg(X, P, stat, ix, 224);
        }
        for (const [stat, x, dir] of thin) P.bar(stat, shapeFill(x, 236, 72, 2, () => true, X.statRamp(stat)), dir, A);
        if (on('xp')) { const tb = Buf(150, 241, 180, 2); tb.rect(150, 241, 180, 2, [0, 0, 0, 0.55]); P.img('xp_track', tb, A, 'panel', true); P.bar('xp', shapeFill(150, 241, 180, 2, () => true, X.statRamp('xp')), 'left', A); }
        if (on('level')) P.xp(240.5, 219.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function slimlineHotbar(X) {
        const AC = X.accent;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, [14, 16, 22, 0.72]);
            for (let i = 0; i < 9; i++) { const sx = 1 + i * 20; b.rect(sx + 1, 2, 18, 18, [255, 255, 255, 0.06]); }
            b.hl(0, 21, 182, AC[3]);
        }, (b) => { for (let k = 0; k < 2; k++) { b.hl(k, k, 24 - 2 * k, AC[4]); b.vl(k, k, 24 - 2 * k, AC[4]); b.hl(k, 23 - k, 24 - 2 * k, AC[4]); b.vl(23 - k, k, 24 - 2 * k, AC[4]); } });
    }

    /* ── shared bottom for the three top-left profiles: XP rail only ── */
    function profileBottom(X, P) { xpRail(X, P, 244, 1, X.t.plate[0]); }
    const TL = 'top_left';

    /* ── Vanguard: laurel medal portrait, slanted bar plate ── */
    function vanguard(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const fb = Buf(0, 0, 150, 66);
        // slanted plate with the bars
        const plate = para(36, 10, 100, 34, 8);
        for (let y = 10; y < 44; y++) for (let x = 36; x < 146; x++) if (plate(x + 0.5, y + 0.5)) fb.set(x, y, [10, 10, 16, 0.82]);
        for (let x = 44; x < 146; x++) if (plate(x + 0.5, 10.5)) fb.set(x, 10, X.accent[4]);
        const rows = [['hp', 13, 9], [on('mana') ? 'mana' : 'food', 25, 6], [on('mana') ? 'food' : null, 34, 5]].filter(([s]) => s && on(s));
        const bars = [];
        for (const [s, y, h] of rows) {
            const x = 48 - Math.round((8 * (y - 10)) / 34);
            fb.rect(x, y, 84, h, '#050508');
            icon(fb, statIcon(s), x - 11 < 30 ? x - 11 : x - 11, y + Math.floor((h - 9) / 2), X.statRamp(s));
            bars.push([s, { x: x + 1, y: y + 1, w: 82, h: h - 2 }]);
        }
        // laurel medal
        for (const s of [-1, 1]) for (let a = 0.5; a < 2.9; a += 0.32) {
            const lx = 22 + s * Math.cos(a + Math.PI / 2) * 19, ly = 24 + Math.sin(a + Math.PI / 2) * 19 * -1 * -1;
            blob(fb, Math.round(lx) - 2, Math.round(ly) - 2, 5, 4, rr(5, 4, 2), LEAF, { outline: LEAF[1] });
        }
        sblob(fb, 6, 8, 33, 33, (x, y) => dist(x, y, 22.5, 24.5) <= 16, G);
        sblob(fb, 10, 12, 25, 25, (x, y) => dist(x, y, 22.5, 24.5) <= 12, INKR, { inset: true });
        if (on('level')) {
            sblob(fb, 8, 40, 30, 11, poly([[8, 40], [38, 40], [35, 45.5], [38, 51], [8, 51], [11, 45.5]]), X.accent);
        }
        P.img('frame', fb, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 15, y: 17, w: 16, h: 16, anchor: TL });
        for (const [s, c] of bars) P.bar(s, shapeFill(c.x, c.y, c.w, c.h, () => true, X.statRamp(s)), 'left', TL);
        if (on('hp')) valueText(X, P, 'hp', 90, 18.5, TL);
        if (on('name')) P.text(NAME, 46, 2, 'left', TL, '#ffffff', 60);
        pips(X, P, 'armor', 38, 47, 10, 'left', TL);
        if (on('level')) P.xp(23.5, 50, TL);
        profileBottom(X, P);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Ledger: tidy card, header + one row per stat ── */
    function ledger(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const stats = ['hp', 'food', 'mana', 'armor', 'air'].filter(on);
        const H = 34 + stats.length * 11 + 4;
        const fb = Buf(2, 2, 134, H + 2);
        blob(fb, 4, 4, 128, H, rr(128, H, 3), t.plate, { flat: true, fill: L.rgba(t.plate[2], 0.9) });
        blob(fb, 4, 4, 128, 30, rr(128, 30, 3), t.plate, { flat: true, fill: t.plate[3] });
        fb.hl(6, 5, 124, X.accent[4]);
        sblob(fb, 7, 7, 24, 24, () => true, t.metal);
        fb.rect(9, 9, 20, 20, '#0a0a10');
        if (on('level')) { blob(fb, 104, 20, 24, 11, rr(24, 11, 2), X.accent, { flat: true, fill: '#0a0a10', outline: X.accent[3] }); }
        const rows = [];
        stats.forEach((s, i) => {
            const y = 37 + i * 11;
            icon(fb, statIcon(s), 8, y, X.statRamp(s));
            fb.rect(19, y + 1, 82, 7, '#06060a');
            for (let k = 1; k < 10; k++) fb.vl(19 + k * 8 + 1, y + 2, 5, '#1a1a22');
            rows.push([s, { x: 20, y: y + 2, w: 80, h: 5 }, y]);
        });
        P.img('card', fb, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 9, y: 9, w: 20, h: 20, anchor: TL });
        for (const [s, c, y] of rows) {
            const R = X.statRamp(s);
            const sb = Buf(c.x, c.y, c.w, c.h);
            for (let k = 0; k < 10; k++) { sb.rect(c.x + k * 8, c.y, 7, c.h, R[3]); sb.hl(c.x + k * 8, c.y, 7, R[5]); }
            P.bar(s, sb, 'left', TL);
            const vp = VALUE_ONLY[s] || X.valuePapi(s);
            if (vp && X.state.values !== false) P.text(vp, 117, y + 5, 'center', TL, '#ffffff', 26);
        }
        if (on('name')) P.text(NAME, 35, 9.5, 'left', TL, '#ffffff', 64);
        if (on('level')) P.xp(116.5, 29.5, TL);
        profileBottom(X, P);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Bladeshield: kite-shield portrait, blade-shaped bars ── */
    function bladeshield(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const STL = ['#14161c', '#2e333d', '#4d5563', '#7a8494', '#b4bcc8', '#eef2f6'];
        const fb = Buf(0, 0, 150, 70);
        const stats = ['hp', on('mana') ? 'mana' : null, 'food'].filter((s) => s && on(s));
        const blades = [];
        stats.forEach((s, i) => {
            const y = 14 + i * 12;
            const len = 96 - i * 12;
            const h = i === 0 ? 10 : 8;
            const shape = poly([[40, y], [40 + len, y], [40 + len + 8, y + h / 2], [40 + len, y + h], [40, y + h]]);
            sblob(fb, 40, y, len + 9, h + 1, shape, STL);
            const inner = poly([[42, y + 2], [40 + len - 1, y + 2], [40 + len + 4, y + h / 2], [40 + len - 1, y + h - 2], [42, y + h - 2]]);
            for (let yy = y + 1; yy < y + h; yy++) for (let x = 41; x < 40 + len + 6; x++) if (inner(x + 0.5, yy + 0.5)) fb.set(x, yy, GLASS);
            blades.push([s, y, len, h, inner]);
        });
        // kite shield portrait
        const shield = poly([[4, 8], [40, 8], [40, 32], [22, 58], [4, 32]]);
        sblob(fb, 3, 7, 39, 53, shield, G);
        const sIn = poly([[8, 12], [36, 12], [36, 31], [22, 52], [8, 31]]);
        for (let y = 12; y < 54; y++) for (let x = 8; x < 37; x++) if (sIn(x + 0.5, y + 0.5)) fb.set(x, y, t.plate[2]);
        fb.rect(10, 13, 24, 24, '#0a0a10');
        if (on('level')) blob(fb, 15, 38, 15, 13, rr(15, 13, 3), X.accent, { inset: true, fill: '#0a0a10' });
        P.img('frame', fb, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 11, y: 14, w: 22, h: 22, anchor: TL });
        for (const [s, y, len, h, inner] of blades) {
            P.bar(s, shapeFill(41, y + 1, len + 5, h - 1, (i, j) => inner(41 + i + 0.5, y + 1 + j + 0.5), X.statRamp(s)), 'left', TL);
            iconImg(X, P, s, 44, y + Math.floor((h - 9) / 2) + (h < 9 ? 0 : 1), TL);
        }
        if (on('hp')) valueText(X, P, 'hp', 96, 20, TL);
        if (on('name')) P.text(NAME, 44, 3, 'left', TL, '#ffffff', 64);
        pips(X, P, 'armor', 44, 52, 10, 'left', TL);
        if (on('level')) P.xp(22.5, 48.5, TL);
        profileBottom(X, P);
        X.infoStrips(P);
        return P.parts;
    }
    function profileHotbar(X) {
        return slotsHotbar(X, X.t.plate, X.t.inset, X.accent, true);
    }

    HudForgeV2.register('cozy', { plan: hearthwood, hotbar: hearthwoodHotbar });
    HudForgeV2.register('bubble', { plan: puffcloud, hotbar: puffcloudHotbar });
    HudForgeV2.register('neon', { plan: gridpulse, hotbar: gridpulseHotbar });
    HudForgeV2.register('arcade', { plan: coinop, hotbar: coinopHotbar });
    HudForgeV2.register('crest', { plan: gemguard, hotbar: gemguardHotbar });
    HudForgeV2.register('strip', { plan: slimline, hotbar: slimlineHotbar });
    HudForgeV2.register('slash_medal', { plan: vanguard, hotbar: profileHotbar });
    HudForgeV2.register('slash_rows', { plan: ledger, hotbar: profileHotbar });
    HudForgeV2.register('slash_crest', { plan: bladeshield, hotbar: profileHotbar });

    /* ═════════════ batch 3 — the classic layouts ═════════════ */

    const STONE = ['#1a1a20', '#34343e', '#4e4e5a', '#6a6a76', '#8e8e9a', '#b8b8c4'];
    const MARBLE = ['#4a4640', '#8a847a', '#b4ae a2'.replace(' ', ''), '#d6d0c4', '#ece8de', '#ffffff'];
    const DARKP = [10, 10, 16, 0.84];
    const mirror = (r) => ({
        x: (x) => (r ? 480 - x : x),
        rx: (x, w) => (r ? 480 - x - w : x),
        f: (f) => (r ? (x, y) => f(480 - x, y) : f),
        dir: (d) => (r ? (d === 'left' ? 'right' : 'left') : d),
        al: (a) => (r ? (a === 'left' ? 'right' : a === 'right' ? 'left' : a) : a),
    });
    function infoList(X, P, anchor, x, y, dy, right, color) {
        for (const k of Object.keys(X.INFO).filter(X.on)) {
            const info = X.INFO[k];
            const ib = Buf(right ? x - 9 : x, y - 1, 9, 9);
            icon(ib, info.icon, right ? x - 9 : x, y - 1, X.rampOf(X.iconColor(info.icon)));
            P.img(`info_${k}`, ib, anchor, 'icon', true);
            P.text(info.papi, right ? x - 12 : x + 12, y + 3, right ? 'right' : 'left', anchor, color || '#ffffff', X.textW(info.papi));
            y += dy;
        }
        return y;
    }

    /* ── Domekeep: castle wall with towers and a heraldic shield ── */
    function domekeep(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const fb = Buf(96, 180, 288, 90);
        // wall + merlons
        sblob(fb, 136, 221, 208, 25, () => true, STONE);
        for (let y = 226; y < 246; y += 5) for (let x = 137 + ((y / 5) % 2) * 6; x < 343; x += 12) fb.vl(x, y, 5, STONE[2]);
        for (let y = 225; y < 246; y += 5) fb.hl(137, y, 206, STONE[2]);
        for (let x = 138; x < 340; x += 11) sblob(fb, x, 215, 7, 7, () => true, STONE);
        // towers with cone roofs and flags
        for (const cx of [122, 358]) {
            sblob(fb, cx - 13, 212, 27, 58, () => true, STONE);
            for (let y = 217; y < 268; y += 6) fb.hl(cx - 12, y, 25, STONE[2]);
            fb.rect(cx - 1, 226, 3, 9, '#0a0a10'); fb.rect(cx - 1, 244, 3, 9, '#0a0a10');
            sblob(fb, cx - 16, 188, 33, 26, poly([[cx + 0.5, 188], [cx + 16.5, 213], [cx - 15.5, 213]]), t.plate);
            fb.vl(cx, 178, 11, IRON[3]);
            for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) if (j >= Math.abs(Math.sin(i / 3)) && j < 6 - i / 4) fb.set(cx + 1 + i, 179 + j + Math.round(Math.sin(i / 2)), j === 0 ? X.accent[4] : X.accent[3]);
        }
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 146, 224, 76, 10, t.metal), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 258, 224, 76, 10, t.metal), 'right']);
        // heraldic shield in the middle
        const sh = poly([[226, 210], [255, 210], [255, 226], [240.5, 242], [226, 226]]);
        sblob(fb, 225, 209, 31, 34, sh, t.metal);
        const shi = poly([[229, 213], [252, 213], [252, 225], [240.5, 238], [229, 225]]);
        for (let y = 213; y < 239; y++) for (let x = 229; x < 253; x++) if (shi(x + 0.5, y + 0.5)) fb.set(x, y, t.plate[3]);
        for (let y = 213; y < 239; y++) for (let x = 229; x < 253; x++) if (shi(x + 0.5, y + 0.5) && y > 228 && Math.abs(x + 0.5 - 240.5) < (y - 226) * 0.8) fb.set(x, y, X.accent[3]);
        if (on('level')) blob(fb, 232, 214, 17, 12, rr(17, 12, 3), INKR, { flat: true, fill: '#0c0a10', outline: t.metal[1] });
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) hbar(X, P, stat, c, dir);
        pips(X, P, 'armor', 146, 236, 10, 'left');
        pips(X, P, 'air', 255, 236, 10, 'right');
        xpRail(X, P, 244, 1, STONE[0]);
        if (on('level')) P.xp(240.5, 224, A);
        X.infoStrips(P);
        return P.parts;
    }
    function domekeepHotbar(X) { return slotsHotbar(X, STONE, X.t.inset, X.t.metal, false); }

    /* ── Plinth: a classical temple front ── */
    function plinth(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const MB = ['#4a4640', '#8a847a', '#b4aea2', '#d6d0c4', '#ece8de', '#ffffff'];
        const G = t.metal;
        const fb = Buf(100, 192, 280, 78);
        // columns
        for (const cx of [128, 352]) {
            sblob(fb, cx - 6, 228, 13, 34, () => true, MB);
            for (const dx of [-3, 0, 3]) fb.vl(cx + dx, 230, 30, MB[2]);
            sblob(fb, cx - 9, 222, 19, 7, () => true, MB);
            for (const s of [-1, 1]) { fb.set(cx + s * 7, 225, MB[1]); fb.set(cx + s * 7, 226, MB[2]); fb.set(cx + s * 6, 225, MB[2]); }
            sblob(fb, cx - 9, 261, 19, 9, () => true, MB);
        }
        // architrave with a meander frieze
        sblob(fb, 116, 225, 248, 11, () => true, MB);
        fb.rect(196, 227, 88, 7, G[1]);
        for (let x = 197; x < 283; x += 6) { fb.hl(x, 228, 5, G[4]); fb.vl(x + 4, 228, 4, G[4]); fb.hl(x + 2, 231, 3, G[4]); fb.vl(x, 228, 5, G[4]); fb.hl(x, 232, 4, G[4]); }
        // pediment
        sblob(fb, 190, 201, 101, 26, poly([[190, 226], [291, 226], [240.5, 201]]), MB);
        const tym = poly([[200, 223], [281, 223], [240.5, 205]]);
        for (let y = 204; y < 224; y++) for (let x = 200; x < 282; x++) if (tym(x + 0.5, y + 0.5)) fb.set(x, y, MB[2]);
        if (on('level')) { blob(fb, 231, 207, 19, 17, (i, j) => dist(i, j, 9, 8.5) <= 8.5, G); blob(fb, 234, 210, 13, 11, (i, j) => dist(i, j, 6, 5.5) <= 5.5, INKR, { flat: true, fill: '#14100a' }); }
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 146, 236, 80, 9, G), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 254, 236, 80, 9, G), 'right']);
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir] of bars) hbar(X, P, stat, c, dir);
        pips(X, P, 'armor', 118, 227, 10, 'left');
        pips(X, P, 'air', 283, 227, 10, 'right');
        xpRail(X, P, 246, 1, MB[1]);
        if (on('level')) P.xp(240.5, 219.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function plinthHotbar(X) { return slotsHotbar(X, ['#4a4640', '#8a847a', '#b4aea2', '#d6d0c4', '#ece8de', '#ffffff'], X.t.inset, X.t.metal, false); }

    /* ── Herald: a swallow-tail banner hanging top-left ── */
    function herald(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const stats = ['hp', 'mana', 'food'].filter(on);
        const H = 30 + stats.length * 12 + (on('armor') ? 10 : 0) + 14;
        const fb = Buf(0, 0, 128, H + 6);
        const cloth = poly([[10, 6], [112, 6], [112, H], [61, H - 10], [10, H]]);
        sblob(fb, 10, 6, 103, H, cloth, t.plate);
        const trim = poly([[13, 9], [109, 9], [109, H - 4], [61, H - 13], [13, H - 4]]);
        for (let y = 9; y < H; y++) for (let x = 13; x < 110; x++) if (trim(x + 0.5, y + 0.5) && !trim(x - 0.5, y + 0.5) || trim(x + 0.5, y + 0.5) && !trim(x + 1.5, y + 0.5)) fb.set(x, y, G[3]);
        sblob(fb, 3, 3, 117, 5, () => true, G);
        for (const x of [2, 119]) blob(fb, x - 2, 2, 7, 7, circle(7), G);
        if (on('level')) blob(fb, 88, 12, 20, 14, rr(20, 14, 3), G, { inset: true, fill: '#0c0a10' });
        const rows = [];
        stats.forEach((s, i) => {
            const y = 28 + i * 12;
            const h = i === 0 ? 9 : 7;
            icon(fb, statIcon(s), 16, y + (h === 9 ? 0 : -1), X.statRamp(s));
            fb.rect(27, y, 80, h, t.plate[0]);
            rows.push([s, { x: 28, y: y + 1, w: 78, h: h - 2 }, y]);
        });
        P.img('banner', fb, TL, 'panel');
        for (const [s, c] of rows) hbar(X, P, s, c, 'left', TL);
        if (on('hp')) valueText(X, P, 'hp', 67, 33.5, TL);
        if (on('name')) P.text(NAME, 17, 14, 'left', TL, '#ffffff', 64);
        pips(X, P, 'armor', 28, 28 + stats.length * 12, 10, 'left', TL);
        if (on('level')) P.xp(98.5, 23.5, TL);
        xpRail(X, P, 244, 1, t.plate[0]);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Stackline: free-floating capsules, one per stat ── */
    function stackline(X) {
        const on = X.on;
        const P = mk(X);
        const stats = ['hp', 'food', 'mana', 'armor', 'air'].filter(on);
        const top = on('name') || on('level') ? 18 : 4;
        const fb = Buf(2, 2, 118, top + stats.length * 13 + 6);
        if (on('name') || on('level')) blob(fb, 4, 4, 112, 12, rr(112, 12, 6), [DARKP], { flat: true, fill: DARKP, outline: [255, 255, 255, 0.12] });
        if (on('level')) blob(fb, 92, 5, 23, 10, rr(23, 10, 5), X.accent, { flat: true, fill: X.accent[2], outline: X.accent[1] });
        const rows = [];
        stats.forEach((s, i) => {
            const y = top + 2 + i * 13;
            blob(fb, 4, y, 112, 11, rr(112, 11, 5), [DARKP], { flat: true, fill: DARKP, outline: [255, 255, 255, 0.12] });
            icon(fb, statIcon(s), 7, y + 1, X.statRamp(s));
            fb.rect(18, y + 3, 70, 5, [0, 0, 0, 0.6]);
            rows.push([s, y]);
        });
        P.img('capsules', fb, TL, 'panel', true);
        for (const [s, y] of rows) {
            P.bar(s, shapeFill(18, y + 3, 70, 5, rr(70, 5, 2), X.statRamp(s)), 'left', TL);
            const vp = VALUE_ONLY[s] || X.valuePapi(s);
            if (vp && X.state.values !== false) P.text(vp, 102, y + 6, 'center', TL, '#ffffff', 24);
        }
        if (on('name')) P.text(NAME, 12, 7, 'left', TL, '#ffffff', 64);
        if (on('level')) P.xp(103.5, 14, TL);
        xpRail(X, P, 244, 1, [0, 0, 0, 0.6]);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Portrait: ornate square portrait unit frame ── */
    function portrait(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const fb = Buf(0, 0, 150, 62);
        // ribbon behind the bars
        sblob(fb, 34, 6, 112, 40, poly([[34, 6], [140, 6], [146, 12], [140, 18], [140, 46], [34, 46]]), t.plate);
        fb.hl(36, 7, 104, X.accent[4]);
        const rows = [['hp', 18, 11], [on('mana') ? 'mana' : 'food', 31, 6], [on('mana') ? 'food' : null, 39, 5]].filter(([s]) => s && on(s));
        const bars = [];
        for (const [s, y, h] of rows) { fb.rect(42, y, 94, h, '#050508'); bars.push([s, { x: 43, y: y + 1, w: 92, h: h - 2 }]); }
        // portrait with ornate corners
        sblob(fb, 4, 4, 36, 36, () => true, G);
        fb.rect(7, 7, 30, 30, '#08080c');
        for (const [x, y, sx, sy] of [[2, 2, 1, 1], [36, 2, -1, 1], [2, 36, 1, -1], [36, 36, -1, -1]]) {
            for (let k = 0; k < 8; k++) { fb.set(x + (sx > 0 ? k : 3 - k + 1), y + (sy > 0 ? 0 : 3), G[4]); fb.set(x + (sx > 0 ? 0 : 3), y + (sy > 0 ? k : 3 - k + 1), G[4]); }
            blob(fb, x, y, 4, 4, circle(4), t.gemRamp || X.accent);
        }
        if (on('level')) blob(fb, 26, 30, 20, 20, (i, j) => Math.abs(i - 9.5) + Math.abs(j - 9.5) <= 9.5, G, { inset: false });
        if (on('level')) blob(fb, 29, 33, 14, 14, (i, j) => Math.abs(i - 6.5) + Math.abs(j - 6.5) <= 6.5, INKR, { flat: true, fill: '#0c0a10' });
        P.img('frame', fb, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 8, y: 8, w: 28, h: 28, anchor: TL });
        for (const [s, c] of bars) hbar(X, P, s, c, 'left', TL);
        if (on('hp')) valueText(X, P, 'hp', 89, 24, TL);
        if (on('name')) P.text(NAME, 44, 10, 'left', TL, '#ffffff', 64);
        pips(X, P, 'armor', 48, 49, 10, 'left', TL);
        if (on('level')) P.xp(36.5, 44, TL);
        xpRail(X, P, 244, 1, t.plate[0]);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Twin Corners: ornate brackets in both bottom corners ── */
    function cornerUnit(X, P, fb, r, big, thin, anchor) {
        const M = mirror(r);
        const t = X.t;
        const G = t.metal;
        // L bracket
        sblob(fb, M.rx(4, 10), 206, 10, 62, M.f(poly([[4, 210], [8, 206], [14, 206], [14, 268], [4, 268]])), G);
        sblob(fb, M.rx(4, 124), 258, 124, 10, M.f(poly([[4, 258], [122, 258], [128, 263], [122, 268], [4, 268]])), G);
        sblob(fb, M.rx(14, 108), 232, 108, 26, () => true, t.plate);
        // medallion with the stat icon
        blob(fb, M.rx(6, 25), 238, 25, 25, circle(25), G);
        blob(fb, M.rx(10, 17), 242, 17, 17, circle(17), t.plate, { inset: true });
        const out = [];
        if (X.on(big)) { const c = channel(fb, M.rx(32, 88), 240, 88, 12, G); out.push([big, c, M.dir('left'), true]); }
        if (X.on(thin)) out.push([thin, null]);
        return { out, icon: [M.rx(14, 9), 246] };
    }
    function twincorners(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const units = [];
        for (const [r, big, thin, an] of [[false, 'hp', 'armor', 'bottom_left'], [true, 'food', 'air', 'bottom_right']]) {
            const fb = Buf(r ? 346 : 2, 200, 132, 70);
            const u = cornerUnit(X, P, fb, r, big, thin, an);
            P.img(`corner_${r ? 'r' : 'l'}`, fb, an, 'panel');
            units.push([r, big, thin, an, u]);
        }
        for (const [r, big, thin, an, u] of units) {
            const M = mirror(r);
            for (const [stat, c, dir] of u.out) if (c) { hbar(X, P, stat, c, dir, an); valueText(X, P, stat, c.x + c.w / 2, c.y + c.h / 2 + 1, an); }
            if (on(big)) iconImg(X, P, big, u.icon[0], u.icon[1], an);
            pips(X, P, thin, M.rx(34, 79), 233, 10, M.dir('left'), an);
        }
        if (on('level')) {
            const lb = Buf(226, 228, 29, 15);
            blob(lb, 226, 228, 29, 15, rr(29, 15, 4), t.metal);
            lb.rect(229, 231, 23, 9, '#0c0a10');
            P.img('level_plate', lb, A, 'panel');
            P.xp(240.5, 239.5, A);
        }
        xpRail(X, P, 244, 1, t.plate[0]);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Dualtray: two trays flanking the hotbar ── */
    function dualtray(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const AC = X.accent;
        const fb = Buf(56, 222, 368, 48);
        const trays = [];
        for (const r of [false, true]) {
            const M = mirror(r);
            const [big, thin] = r ? ['food', 'air'] : ['hp', 'armor'];
            blob(fb, M.rx(62, 84), 240, 84, 28, rr(84, 28, 5), [DARKP], { flat: true, fill: DARKP, outline: [255, 255, 255, 0.14] });
            for (let k = 0; k < 74; k++) fb.set(M.rx(66 + k, 1), 240, AC[4]);
            if (on(big)) { fb.rect(M.rx(78, 64), 245, 64, 9, [0, 0, 0, 0.6]); trays.push([big, { x: M.rx(79, 62), y: 246, w: 62, h: 7 }, M.dir('left'), M.rx(67, 9), 245]); }
            if (on(thin)) { fb.rect(M.rx(78, 64), 258, 64, 4, [0, 0, 0, 0.6]); trays.push([thin, { x: M.rx(79, 62), y: 259, w: 62, h: 2 }, M.dir('left'), M.rx(67, 9), 256]); }
        }
        if (on('level')) blob(fb, 227, 232, 27, 12, rr(27, 12, 6), AC, { flat: true, fill: AC[2], outline: AC[1] });
        P.img('trays', fb, A, 'panel', true);
        for (const [s, c, dir, ix, iy] of trays) {
            P.bar(s, shapeFill(c.x, c.y, c.w, c.h, c.h > 3 ? rr(c.w, c.h, 2) : () => true, X.statRamp(s)), dir, A);
            iconImg(X, P, s, ix, iy);
            if (c.h > 3) valueText(X, P, s, c.x + c.w / 2, c.y + 4.5);
        }
        xpRail(X, P, 244, 1, [0, 0, 0, 0.6]);
        if (on('level')) P.xp(240.5, 242, A);
        X.infoStrips(P);
        return P.parts;
    }
    function glassHotbar(X, nums) {
        const AC = X.accent;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, [10, 10, 16, 0.78]);
            for (let i = 0; i < 9; i++) {
                const sx = 1 + i * 20;
                b.rect(sx + 1, 2, 18, 18, [255, 255, 255, 0.06]);
                if (nums) L.TINY[i + 1].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') b.set(sx + 3 + x, 3 + y, [255, 255, 255, 0.45]); }));
            }
        }, (b) => { for (let k = 0; k < 2; k++) { b.hl(k, k, 24 - 2 * k, AC[4]); b.vl(k, k, 24 - 2 * k, AC[4]); b.hl(k, 23 - k, 24 - 2 * k, AC[4]); b.vl(23 - k, k, 24 - 2 * k, AC[4]); } });
    }

    /* ── Midline: one row of small gauge chips ── */
    function midline(X) {
        const on = X.on;
        const P = mk(X);
        const stats = ['hp', 'food', 'armor', 'air'].filter(on);
        const fb = Buf(146, 226, 188, 18);
        const n = stats.length + (on('level') ? 1 : 0);
        const W = n ? Math.floor((184 - (n - 1) * 3) / n) : 0;
        let x = 148;
        const chips = [];
        const order = on('level') ? [...stats.slice(0, Math.ceil(stats.length / 2)), 'level', ...stats.slice(Math.ceil(stats.length / 2))] : stats;
        for (const s of order) {
            blob(fb, x, 228, W, 13, rr(W, 13, 3), [DARKP], { flat: true, fill: DARKP, outline: [255, 255, 255, 0.12] });
            if (s === 'level') { fb.hl(x + 2, 228, W - 4, X.accent[4]); chips.push([s, x]); }
            else {
                const R = X.statRamp(s);
                fb.hl(x + 2, 228, W - 4, R[4]);
                icon(fb, statIcon(s), x + 2, 230, R);
                fb.rect(x + 13, 233, W - 16, 4, [0, 0, 0, 0.6]);
                chips.push([s, x]);
            }
            x += W + 3;
        }
        P.img('chips', fb, A, 'panel', true);
        for (const [s, cx] of chips) {
            if (s === 'level') P.xp(cx + W / 2 + 0.5, 238.5, A);
            else P.bar(s, shapeFill(cx + 13, 233, W - 16, 4, () => true, X.statRamp(s)), 'left', A);
        }
        xpRail(X, P, 244, 1, [0, 0, 0, 0.6]);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Wingtray: angular wings growing out of the hotbar ends ── */
    function wingtray(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const fb = Buf(60, 226, 360, 44);
        const parts = [];
        for (const r of [false, true]) {
            const M = mirror(r);
            const [big, thin] = r ? ['food', 'air'] : ['hp', 'armor'];
            sblob(fb, M.rx(66, 84), 236, 84, 32, M.f(poly([[150, 236], [150, 268], [96, 268], [66, 250], [84, 236]])), t.plate);
            for (let k = 0; k < 3; k++) line(fb, M.x(72 + k * 6), 248 + k * 0, M.x(80 + k * 6), 248 - 8 + k * 0, X.accent[3], 1);
            fb.hl(M.rx(86, 62), 237, 62, X.accent[4]);
            if (on(big)) { const c = channel(fb, M.rx(88, 60), 240, 60, 11, t.metal); parts.push([big, c, M.dir('left')]); }
            if (on(thin)) parts.push([thin, M.rx(91, 55), M.dir('left')]);
        }
        if (on('level')) sblob(fb, 228, 230, 25, 14, poly([[228, 230], [253, 230], [249, 244], [232, 244]]), t.metal);
        if (on('level')) fb.rect(232, 232, 17, 9, '#0c0a10');
        P.img('wings', fb, A, 'panel');
        for (const [s, c, dir] of parts) {
            if (c && typeof c === 'object') { hbar(X, P, s, c, dir); valueText(X, P, s, c.x + c.w / 2, c.y + c.h / 2 + 1); }
            else pips(X, P, s, c, 255, 7, dir);
        }
        xpRail(X, P, 244, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 240.5, A);
        X.infoStrips(P);
        return P.parts;
    }

    /* ── Pip Rail: survival pips on a riveted rail ── */
    function piprail(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const fb = Buf(130, 214, 220, 34);
        sblob(fb, 140, 222, 200, 24, M2(200, 24), t.plate);
        fb.hl(143, 223, 194, G[4]);
        for (const x of [143, 335]) for (const y of [226, 241]) { fb.set(x, y, G[5]); fb.set(x + 1, y + 1, G[2]); }
        for (const x of [134, 340]) sblob(fb, x, 220, 7, 28, () => true, G);
        if (on('level')) {
            blob(fb, 229, 215, 23, 23, (i, j) => Math.abs(i - 11) + Math.abs(j - 11) <= 11, G);
            blob(fb, 233, 219, 15, 15, (i, j) => Math.abs(i - 7) + Math.abs(j - 7) <= 7, INKR, { flat: true, fill: '#0c0a10' });
        }
        P.img('rail', fb, A, 'panel');
        pips(X, P, 'hp', 148, 226, 10, 'left');
        pips(X, P, 'food', 253, 226, 10, 'right');
        pips(X, P, 'armor', 148, 235, 10, 'left');
        pips(X, P, 'air', 253, 235, 10, 'right');
        xpRail(X, P, 244, 1, t.plate[0]);
        if (on('level')) P.xp(240.5, 230.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function M2(w, h) { return (x, y) => true; }

    /* ── Nameplate: an engraved plaque with name + info (top corners) ── */
    function nameplate(r) {
        return (X) => {
            const t = X.t;
            const on = X.on;
            const P = mk(X);
            const M = mirror(r);
            const an = r ? 'top_right' : 'top_left';
            const G = t.metal;
            const infos = Object.keys(X.INFO).filter(on);
            const H = 22 + infos.length * 11 + 4;
            const fb = Buf(M.rx(2, 126), 2, 126, H + 4);
            blob(fb, M.rx(4, 120), 4, 120, H, rr(120, H, 3), G);
            fb.rect(M.rx(7, 114), 7, 114, H - 6, t.plate[2]);
            fb.rect(M.rx(8, 112), 8, 112, 14, t.plate[3]);
            fb.hl(M.rx(8, 112), 8, 112, X.accent[4]);
            for (const [x, y] of [[6, 6], [120, 6], [6, H], [120, H]]) blob(fb, M.rx(x - 2, 5), y - 2, 5, 5, circle(5), t.gemRamp || X.accent);
            if (on('head')) fb.rect(M.rx(9, 12), 9, 12, 12, '#08080c');
            if (on('level')) blob(fb, M.rx(98, 20), 9, 20, 11, rr(20, 11, 3), G, { flat: true, fill: '#0c0a10' });
            P.img('plaque', fb, an, 'panel');
            if (on('head')) P.parts.push({ t: 'headonly', x: M.rx(10, 10), y: 10, w: 10, h: 10, anchor: an });
            if (on('name')) P.text(NAME, M.x(on('head') ? 24 : 12), 11.5, M.al('left'), an, '#ffffff', 64);
            if (on('level')) P.xp(M.x(108) + (r ? -0.5 : 0.5), 18.5, an);
            infoList(X, P, an, M.x(12), 26, 11, r);
            return P.parts;
        };
    }

    /* ── Sidecard: tall stat card in a bottom corner ── */
    function sidecard(r) {
        return (X) => {
            const t = X.t;
            const on = X.on;
            const P = mk(X);
            const M = mirror(r);
            const an = r ? 'bottom_right' : 'bottom_left';
            const G = t.metal;
            const stats = ['hp', 'food', 'mana', 'armor', 'air'].filter(on);
            const infos = Object.keys(X.INFO).filter(on);
            const H = 18 + stats.length * 11 + infos.length * 11 + 6;
            const y0 = 266 - H;
            const fb = Buf(M.rx(2, 120), y0 - 2, 120, H + 4);
            sblob(fb, M.rx(4, 114), y0, 114, H, M.f(poly([[4, y0 + 6], [10, y0], [118, y0], [118, y0 + H], [4, y0 + H]])), G);
            fb.rect(M.rx(7, 108), y0 + 3, 108, H - 6, t.plate[2]);
            fb.rect(M.rx(7, 108), y0 + 3, 108, 13, t.plate[3]);
            fb.hl(M.rx(10, 104), y0 + 3, 104, X.accent[4]);
            if (on('level')) blob(fb, M.rx(92, 22), y0 + 4, 22, 11, rr(22, 11, 3), G, { flat: true, fill: '#0c0a10' });
            const rows = [];
            stats.forEach((s, i) => {
                const y = y0 + 19 + i * 11;
                icon(fb, statIcon(s), M.rx(10, 9), y, X.statRamp(s));
                fb.rect(M.rx(21, 70), y + 1, 70, 7, '#06060a');
                rows.push([s, { x: M.rx(22, 68), y: y + 2, w: 68, h: 5 }, y]);
            });
            P.img('card', fb, an, 'panel');
            for (const [s, c, y] of rows) {
                hbar(X, P, s, c, M.dir('left'), an);
                const vp = VALUE_ONLY[s] || X.valuePapi(s);
                if (vp && X.state.values !== false) P.text(vp, M.x(104), y + 5, 'center', an, '#ffffff', 24);
            }
            if (on('name')) P.text(NAME, M.x(12), y0 + 7, M.al('left'), an, '#ffffff', 64);
            if (on('level')) P.xp(M.x(103) + (r ? -0.5 : 0.5), y0 + 13.5, an);
            infoList(X, P, an, M.x(10), y0 + 21 + stats.length * 11, 11, r);
            xpRail(X, P, 244, 1, t.plate[0]);
            return P.parts;
        };
    }

    /* ── Skyline: a strip along the top with a city silhouette ── */
    function skyline(X) {
        const on = X.on;
        const P = mk(X);
        const TM = 'top_middle';
        const AC = X.accent;
        const fb = Buf(80, 0, 320, 30);
        fb.rect(84, 0, 312, 15, [10, 10, 18, 0.82]);
        // skyline under the strip
        let x = 84;
        let s = 7;
        const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
        while (x < 396) {
            const w = 6 + Math.floor(rnd() * 10);
            const h = 3 + Math.floor(rnd() * 10);
            for (let i = 0; i < w && x + i < 396; i++) for (let j = 0; j < h; j++) fb.set(x + i, 15 + j, [10, 10, 18, 0.82]);
            for (let i = 1; i < w - 1; i += 3) for (let j = 2; j < h - 1; j += 3) if (rnd() > 0.45) fb.set(x + i, 15 + j, '#ffd36a');
            x += w;
        }
        fb.hl(84, 0, 312, AC[4]);
        const stats = ['hp', 'food', 'armor', 'air'].filter(on);
        const bars = [];
        stats.forEach((st, i) => {
            const bx = 88 + i * 52;
            icon(fb, statIcon(st), bx, 3, X.statRamp(st));
            fb.rect(bx + 11, 5, 38, 5, [0, 0, 0, 0.6]);
            bars.push([st, bx + 11]);
        });
        if (on('level')) blob(fb, 300, 2, 20, 11, rr(20, 11, 3), AC, { flat: true, fill: AC[2], outline: AC[1] });
        P.img('strip', fb, TM, 'panel', true);
        for (const [st, bx] of bars) P.bar(st, shapeFill(bx, 5, 38, 5, () => true, X.statRamp(st)), 'left', TM);
        if (on('level')) P.xp(310.5, 11, TM);
        // name + info at the right end
        let ix = 326;
        if (on('name')) { P.text(NAME, ix, 4.5, 'left', TM, '#ffffff', 50); }
        void ix;
        const infos = Object.keys(X.INFO).filter(on);
        infos.forEach((k, i) => {
            const info = X.INFO[k];
            const y = 18 + i * 10 + (bars.length ? 8 : 0);
            const ib = Buf(326, y - 1, 9, 9);
            icon(ib, info.icon, 326, y - 1, X.rampOf(X.iconColor(info.icon)));
            P.img(`info_${k}`, ib, TM, 'icon', true);
            P.text(info.papi, 338, y + 3, 'left', TM, '#ffffff', X.textW(info.papi));
        });
        xpRail(X, P, 244, 1, [0, 0, 0, 0.6]);
        return P.parts;
    }

    HudForgeV2.register('fantasy', { plan: domekeep, hotbar: domekeepHotbar });
    HudForgeV2.register('classic', { plan: plinth, hotbar: plinthHotbar });
    HudForgeV2.register('banner', { plan: herald, hotbar: profileHotbar });
    HudForgeV2.register('compact', { plan: stackline, hotbar: (X) => glassHotbar(X, false) });
    HudForgeV2.register('mmo', { plan: portrait, hotbar: profileHotbar });
    HudForgeV2.register('rpg_corners', { plan: twincorners, hotbar: (X) => slotsHotbar(X, X.t.metal, X.t.inset, X.accent, false) });
    HudForgeV2.register('modern', { plan: dualtray, hotbar: (X) => glassHotbar(X, true) });
    HudForgeV2.register('center_row', { plan: midline, hotbar: (X) => glassHotbar(X, true) });
    HudForgeV2.register('split_sides', { plan: wingtray, hotbar: (X) => slotsHotbar(X, X.t.plate, X.t.inset, X.accent, false) });
    HudForgeV2.register('survival', { plan: piprail, hotbar: (X) => slotsHotbar(X, X.t.plate, X.t.inset, X.t.metal, false) });
    HudForgeV2.register('card_tl', { plan: nameplate(false), hotbar: profileHotbar });
    HudForgeV2.register('card_tr', { plan: nameplate(true), hotbar: profileHotbar });
    HudForgeV2.register('card_bl', { plan: sidecard(false), hotbar: profileHotbar });
    HudForgeV2.register('card_br', { plan: sidecard(true), hotbar: profileHotbar });
    HudForgeV2.register('top_strip', { plan: skyline, hotbar: (X) => glassHotbar(X, false) });
    void MARBLE;

    HudForgeV2.register('gothic', { plan: bloodmoon, hotbar: bloodmoonHotbar });
    HudForgeV2.register('pirate', { plan: saltdeck, hotbar: saltdeckHotbar });
    HudForgeV2.register('samurai', { plan: vermilion, hotbar: vermilionHotbar });
    HudForgeV2.register('ocean', { plan: tidepool, hotbar: tidepoolHotbar });
    HudForgeV2.register('desert', { plan: sunstone, hotbar: sunstoneHotbar });
    HudForgeV2.register('winter', { plan: snowdrift, hotbar: snowdriftHotbar });
    HudForgeV2.register('halloween', { plan: hollow, hotbar: hollowHotbar });
    HudForgeV2.register('steam', { plan: brassvein, hotbar: brassveinHotbar });
})();
