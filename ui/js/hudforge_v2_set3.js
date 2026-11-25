/*
 * HUD Forge v2 — set 3 (2026-11-21): pirate, samurai, winter, halloween, arcade, ocean, desert
 * Loaded after hudforge_v2_more.js; uses HudForgeV2.lib.
 */
(function () {
    'use strict';
    if (!window.HudForgeV2 || !HudForgeV2.lib.blob) return;
    const D = window.HudForgeData;
    const L = HudForgeV2.lib;
    const { Buf, mk, sheet, ringSel, framedSlots, segTrack, segFill, blob, rr, circle, pill, maskBlob, shapeFill,
        infoRows, mixHex, icon, statIcon, sparkle, ICONS, PIPS, EMPTY, GLASS, VALUE_ONLY } = L;
    const A = 'bottom_middle';

    /* ───────────── shared pieces ───────────── */

    /** HP (left) + Food (right) bars above the hotbar. frame(b, x, y, w, h, side) paints one frame and returns its inner channel {x,y,w,h} */
    function twinBars(X, P, fb, o) {
        const out = [];
        const pairs = [['hp', o.lx, 'l'], [o.right || 'food', o.rx, 'r']];
        for (const [stat, x, side] of pairs) {
            if (!X.on(stat)) continue;
            const ch = o.frame(fb, x, o.y, o.w, o.h, side, stat);
            out.push({ stat, ch, side });
        }
        return () => {
            for (const { stat, ch, side } of out) {
                const fill = o.fill ? o.fill(stat, ch) : shapeFill(ch.x, ch.y, ch.w, ch.h, () => true, X.statRamp(stat));
                P.bar(stat, fill, side === 'l' ? 'left' : 'right', A);
            }
        };
    }
    function xpLine(X, P, x, y, w, h) {
        if (!X.on('xp')) return;
        const R = X.statRamp('xp');
        const f = Buf(x, y, w, h);
        for (let j = 0; j < h; j++) f.hl(x, y + j, w, j === 0 ? R[4] : j === h - 1 && h > 2 ? R[2] : R[3]);
        P.bar('xp', f, 'left', A);
    }
    const valueText = (X, P, stat, x, y, color, shadow) => {
        const vp = VALUE_ONLY[stat] || X.valuePapi(stat);
        if (!vp || X.state.values === false) return;
        P.text(vp, x, y, 'center', A, color || '#ffffff', 16);
        if (shadow === false) P.parts[P.parts.length - 1].shadow = false;
    };
    function darkText(P, from) { for (let i = from; i < P.parts.length; i++) if (P.parts[i].t === 'text') P.parts[i].shadow = false; }

    /* ═════════════ Pirate ═════════════ */

    const ROPE = ['#3a2810', '#6a4a20', '#9a7034', '#c49a52', '#e0c07a', '#f6e2b0'];
    const BRASS = ['#2a1606', '#5a3410', '#8a5a1c', '#c08a32', '#e6bd5c', '#fff0b0'];
    const PARCH = ['#4a3418', '#8a6a3a', '#bfa06a', '#e2cc98', '#f2e2b8', '#fff6dc'];
    function ropeH(b, x, y, w) {
        for (let i = 0; i < w; i++) {
            const k = (i + 0) % 4;
            b.set(x + i, y, ROPE[0]);
            b.set(x + i, y + 1, k < 2 ? ROPE[4] : ROPE[3]);
            b.set(x + i, y + 2, k < 2 ? ROPE[3] : ROPE[2]);
            b.set(x + i, y + 3, ROPE[0]);
        }
    }
    function ropeV(b, x, y, h) {
        for (let j = 0; j < h; j++) {
            const k = j % 4;
            b.set(x, y + j, ROPE[0]); b.set(x + 1, y + j, k < 2 ? ROPE[4] : ROPE[3]); b.set(x + 2, y + j, k < 2 ? ROPE[3] : ROPE[2]); b.set(x + 3, y + j, ROPE[0]);
        }
    }
    function wheel(b, cx, cy, WD) {
        // spokes with knobs, then rim + hub
        for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            for (let r = 4; r <= 14; r++) {
                const x = Math.round(cx + Math.cos(a) * r);
                const y = Math.round(cy + Math.sin(a) * r);
                b.set(x, y, r > 11 ? WD[3] : WD[2]);
            }
            blob(b, Math.round(cx + Math.cos(a) * 15) - 1, Math.round(cy + Math.sin(a) * 15) - 1, 3, 3, () => true, WD);
        }
        for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) {
            const d = Math.hypot(x - cx, y - cy);
            if (d >= 8.5 && d <= 11.5) b.set(x, y, d < 9.5 || d > 10.8 ? WD[0] : (x - cx) + (y - cy) < 0 ? WD[4] : WD[3]);
        }
        blob(b, cx - 6, cy - 6, 13, 13, circle(13), BRASS);
        blob(b, cx - 4, cy - 4, 9, 9, circle(9), WD, { inset: true });
    }
    function pirate(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const WD = t.plate;
        const fb = Buf(110, 205, 260, 65);
        // deck plank under the bars, with the XP groove
        blob(fb, 146, 238, 188, 8, () => true, WD);
        for (let x = 158; x < 330; x += 19) fb.vl(x, 239, 6, WD[1]);
        if (on('xp')) { fb.rect(152, 240, 176, 4, WD[0]); fb.rect(153, 241, 174, 2, GLASS); }
        ropeH(fb, 144, 235, 192);
        const fill = twinBars(X, P, fb, {
            y: 225, h: 10, w: 72, lx: 158, rx: 250,
            frame(b, x, y, w, h, side, stat) {
                blob(b, x, y, w, h, () => true, WD);
                b.rect(x + 5, y + 2, w - 10, h - 4, GLASS);
                ropeV(b, x, y - 1, h + 2); ropeV(b, x + w - 4, y - 1, h + 2);
                const px = side === 'l' ? x - 15 : x + w + 1;
                blob(b, px, y - 2, 14, 14, circle(14), BRASS);
                blob(b, px + 2, y, 10, 10, circle(10), ['#0a1a2a', '#123050', '#1a4870', '#2a6a98', '#4a90c0', '#9ad0f0'], { inset: true });
                icon(b, statIcon(stat), px + 2, y, X.statRamp(stat));
                return { x: x + 5, y: y + 2, w: w - 10, h: h - 4 };
            },
        });
        if (on('level')) wheel(fb, 240, 225, ['#1e1006', '#3e2410', '#6a4020', '#8a5a2c', '#b07a40', '#d8a868']);
        // anchors at the hotbar ends
        const anchorS = ['..ooo..', '..owo..', '..ooo..', '...o...', 'ooooooo', '...o...', '...o...', 'o..o..o', 'oo.o.oo', '.ooooo.'];
        fb.sprite(anchorS, 135, 250, ['#1a1c22', '#3a3e48', '#5a606c', '#8a909c', '#b0b6c2', '#e0e6ee']);
        fb.sprite(anchorS, 338, 250, ['#1a1c22', '#3a3e48', '#5a606c', '#8a909c', '#b0b6c2', '#e0e6ee']);
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 153, 241, 174, 2);
        if (on('level')) P.xp(240.5, 228, A);
        // parchment scrolls, top-left
        const n0 = P.parts.length;
        infoRows(X, P, 'top_left', 8, 6, 15, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 12, () => true, PARCH, { outline: PARCH[0] });
            blob(b, x - 2, y - 1, 4, 14, rr(4, 14, 1), PARCH, { outline: PARCH[0] });
            blob(b, x + w - 2, y - 1, 4, 14, rr(4, 14, 1), PARCH, { outline: PARCH[0] });
            icon(b, info.icon, x + 3, y + 1, R);
        });
        for (let i = n0; i < P.parts.length; i++) if (P.parts[i].t === 'text') { P.parts[i].color = '#3a2410'; P.parts[i].shadow = false; }
        return P.parts;
    }
    function pirateHotbar(X) {
        const WD = X.t.plate;
        return sheet((b) => {
            framedSlots(b, WD, X.t.inset, false);
            for (let i = 0; i < 182; i++) { const k = i % 4; b.set(i, 0, ROPE[0]); b.set(i, 1, k < 2 ? ROPE[4] : ROPE[3]); }
        }, (b) => ringSel(b, BRASS));
    }

    /* ═════════════ Samurai ═════════════ */

    function samurai(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const LQ = X.rampOf(t.gemRamp ? t.gemRamp[2] : '#c21e2c');  // lacquer
        const GD = t.metal;
        const INKR = ['#050505', '#0e0e10', '#18181c', '#222228', '#2e2e36', '#3c3c46'];
        const fb = Buf(120, 210, 240, 60);
        // posts
        blob(fb, 141, 222, 6, 46, () => true, LQ); blob(fb, 333, 222, 6, 46, () => true, LQ);
        // kasagi (top beam, ends turned up) with black cap
        blob(fb, 134, 218, 212, 7, (i, j) => j >= (i < 6 ? 6 - i : i > 205 ? i - 205 : 0) * 0.5, INKR);
        blob(fb, 136, 223, 208, 5, () => true, LQ);
        // nuki (lower beam) with XP groove
        blob(fb, 139, 238, 202, 7, () => true, LQ);
        fb.hl(140, 239, 200, GD[4]);
        if (on('xp')) { fb.rect(150, 240, 180, 4, LQ[0]); fb.rect(151, 241, 178, 2, GLASS); }
        // gold end caps on beams
        for (const x of [134, 342]) fb.rect(x, 223, 4, 5, GD[3]);
        const fill = twinBars(X, P, fb, {
            y: 229, h: 8, w: 74, lx: 152, rx: 254,
            frame(b, x, y, w, h, side, stat) {
                b.rect(x, y, w, h, INKR[0]); b.rect(x + 1, y + 1, w - 2, h - 2, GLASS);
                b.rect(x, y, 3, h, GD[3]); b.rect(x + w - 3, y, 3, h, GD[3]); b.vl(x, y, h, GD[4]);
                // hanging cords
                b.vl(x + 8, 228, 1, GD[2]); b.vl(x + w - 9, 228, 1, GD[2]);
                return { x: x + 3, y: y + 1, w: w - 6, h: h - 2 };
            },
        });
        // sakura petals
        for (const [x, y] of [[132, 232], [347, 230], [150, 214], [330, 215]]) {
            fb.set(x, y, '#ffb0c8'); fb.set(x + 1, y, '#ff8aa8'); fb.set(x, y + 1, '#ff8aa8'); fb.set(x + 1, y + 1, '#ffd8e4');
        }
        if (on('level')) {
            blob(fb, 230, 221, 21, 18, () => true, GD);
            fb.rect(233, 224, 15, 12, INKR[1]);
        }
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 151, 241, 178, 2);
        if (on('level')) P.xp(240.5, 232, A);
        infoRows(X, P, 'top_right', 474, 6, 14, (b, x, y, w, R, info) => {
            b.rect(x, y, w, 12, INKR[1]); b.hl(x, y, w, GD[3]); b.hl(x, y + 11, w, GD[2]);
            b.rect(x, y, 3, 12, LQ[3]);
            icon(b, info.icon, x + 4, y + 1, R);
        }, true);
        return P.parts;
    }
    function samuraiHotbar(X) {
        const LQ = X.rampOf(X.t.gemRamp ? X.t.gemRamp[2] : '#c21e2c');
        return sheet((b) => {
            framedSlots(b, ['#050505', '#0e0e10', '#18181c', '#222228', '#2e2e36', '#3c3c46'], ['#050505', '#0b0b0d', '#111114', '#17171b', '#1f1f24', '#5a5a66'], false);
            b.hl(1, 1, 180, LQ[3]); b.hl(1, 20, 180, LQ[2]);
        }, (b) => ringSel(b, X.t.metal));
    }

    /* ═════════════ Winter ═════════════ */

    const SNOW = ['#7a8aa0', '#b8c4d4', '#d8e2ee', '#eef4fb', '#ffffff', '#ffffff'];
    function snowCap(b, x, y, w, seed) {
        // bumpy snow lying on top of y
        for (let i = 0; i < w; i++) {
            const h = 2 + Math.round(1.2 * Math.sin((i + seed) * 0.7) + Math.sin((i + seed) * 0.23));
            for (let k = 0; k < h; k++) b.set(x + i, y - k, k === h - 1 ? SNOW[2] : SNOW[4]);
            b.set(x + i, y - h, SNOW[0]);
        }
    }
    function icicle(b, x, y, len) {
        for (let k = 0; k < len; k++) {
            const w = Math.max(1, Math.round(3 * (1 - k / len)));
            for (let i = 0; i < w; i++) b.set(x + i, y + k, i === 0 ? '#ffffff' : '#a8d8f0');
        }
    }
    function snowflake(b, cx, cy, R) {
        for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 - Math.PI / 2;
            for (let r = 0; r <= 10; r++) {
                const x = Math.round(cx + Math.cos(a) * r);
                const y = Math.round(cy + Math.sin(a) * r);
                b.set(x, y, R[4]);
                if (r === 6 || r === 8) for (const s of [-1, 1]) {
                    b.set(Math.round(x + Math.cos(a + s * 1.0) * 2), Math.round(y + Math.sin(a + s * 1.0) * 2), R[3]);
                }
            }
        }
    }
    function winter(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const IC = t.plate;
        const FR = t.metal;
        const fb = Buf(120, 208, 240, 62);
        blob(fb, 145, 237, 190, 9, () => true, FR);
        if (on('xp')) { fb.rect(151, 240, 178, 4, FR[0]); fb.rect(152, 241, 176, 2, GLASS); }
        snowCap(fb, 146, 237, 188, 3);
        const fill = twinBars(X, P, fb, {
            y: 225, h: 9, w: 76, lx: 152, rx: 252,
            frame(b, x, y, w, h, side, stat) {
                blob(b, x, y, w, h, rr(w, h, 2), FR);
                b.rect(x + 12, y + 2, w - 15, h - 4, GLASS);
                if (side === 'r') { b.rect(x + 3, y + 2, w - 15, h - 4, GLASS); b.rect(x + w - 12, y + 2, 9, h - 4, FR[3]); }
                icon(b, statIcon(stat), side === 'l' ? x + 2 : x + w - 11, y, X.statRamp(stat));
                snowCap(b, x + 1, y, w - 2, x);
                icicle(b, x + 6, y + h, 4); icicle(b, x + w - 10, y + h, 3);
                return side === 'l' ? { x: x + 12, y: y + 2, w: w - 15, h: h - 4 } : { x: x + 3, y: y + 2, w: w - 15, h: h - 4 };
            },
        });
        icicle(fb, 146, 246, 8); icicle(fb, 331, 246, 7); icicle(fb, 150, 246, 5); icicle(fb, 327, 246, 5);
        if (on('level')) {
            snowflake(fb, 240, 226, ['#2a4258', '#4f708c', '#7fa3bf', '#b5d3e8', '#eaf7ff', '#ffffff']);
            blob(fb, 233, 219, 15, 15, circle(15), IC);
        }
        // little snowman beside the hotbar
        blob(fb, 125, 256, 13, 12, circle(13), SNOW); blob(fb, 127, 247, 9, 10, circle(9), SNOW);
        fb.set(130, 250, '#1a1a1a'); fb.set(133, 250, '#1a1a1a'); fb.set(131, 252, '#ff8a20'); fb.set(132, 252, '#ff8a20');
        fb.rect(126, 245, 11, 2, '#2a2a30'); fb.rect(128, 241, 7, 4, '#2a2a30');
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 152, 241, 176, 2);
        if (on('level')) P.xp(240.5, 230, A);
        infoRows(X, P, 'top_right', 474, 8, 15, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 12, rr(w, 12, 2), FR, { fill: [16, 40, 70, 0.85], flat: true });
            snowCap(b, x + 1, y, w - 2, y);
            icon(b, info.icon, x + 3, y + 1, R);
        }, true);
        return P.parts;
    }
    function winterHotbar(X) {
        return sheet((b) => {
            framedSlots(b, X.t.metal, X.t.inset, false);
            for (let i = 0; i < 182; i++) b.set(i, 0, i % 7 < 5 ? '#ffffff' : SNOW[2]);
        }, (b) => ringSel(b, ['#3a6a8a', '#6aa8d0', '#8ccaf0', '#c8ecff', '#ffffff', '#ffffff']));
    }

    /* ═════════════ Halloween ═════════════ */

    const PUMP = ['#3a1404', '#7a2e06', '#c05a0a', '#f08a1a', '#ffb850', '#ffe0a0'];
    const SLIME = ['#0e2a06', '#2a5a0a', '#4a9a14', '#78d22a', '#aef060', '#e8ffc0'];
    function drips(b, x, y, w, seed) {
        for (let i = 0; i < w; i++) {
            const len = ((i * 7 + seed) % 11 === 0) ? 4 + ((i + seed) % 3) : ((i * 3 + seed) % 5 === 0 ? 1 : 0);
            for (let k = 0; k < len; k++) b.set(x + i, y + k, k === len - 1 ? SLIME[4] : SLIME[3]);
        }
    }
    function bat(b, x, y) {
        b.sprite(['o.......o', 'oo.o.o.oo', 'ooooooooo', '.oooboo o', '..o...o..'].map((r) => r.replace(' ', '.')), x, y, ['#0a0612', '#1a1024', '#2a1a3a', '#ff3a3a', '#5a4a6a', '#8a7a9a']);
    }
    function halloween(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const PU = t.plate;
        const fb = Buf(116, 200, 248, 70);
        blob(fb, 146, 238, 188, 8, () => true, PU);
        if (on('xp')) { fb.rect(151, 240, 178, 4, PU[0]); fb.rect(152, 241, 176, 2, GLASS); }
        drips(fb, 147, 246, 186, 5);
        const fill = twinBars(X, P, fb, {
            y: 226, h: 10, w: 74, lx: 154, rx: 252, right: 'food',
            frame(b, x, y, w, h, side, stat) {
                blob(b, x, y, w, h, rr(w, h, 2), PU);
                const ix = side === 'l' ? x + 2 : x + w - 11;
                icon(b, statIcon(stat), ix, y, X.statRamp(stat));
                const gx = side === 'l' ? x + 12 : x + 3;
                b.rect(gx, y + 2, w - 15, h - 4, GLASS);
                drips(b, x + 1, y + h, w - 2, x);
                return { x: gx, y: y + 2, w: w - 15, h: h - 4 };
            },
        });
        if (on('level')) {
            // pumpkin with ribs + stem
            blob(fb, 228, 217, 25, 20, (i, j) => ((i - 12) / 12.5) ** 2 + ((j - 10) / 10) ** 2 <= 1, PUMP);
            for (const x of [236, 244]) for (let y = 219; y < 235; y++) fb.set(x, y, PUMP[2]);
            fb.rect(239, 213, 3, 5, '#3a6a1a'); fb.set(242, 213, '#5a9a2a');
            fb.rect(233, 223, 15, 8, [40, 10, 2, 0.85]);
        }
        bat(fb, 128, 224); bat(fb, 343, 214); bat(fb, 160, 210);
        // tombstones at the hotbar ends
        for (const x of [131, 336]) {
            blob(fb, x, 252, 13, 16, rr(13, 16, 5), ['#1a1a20', '#3a3a44', '#5a5a66', '#7a7a88', '#9a9aaa', '#c0c0cc']);
            fb.rect(x + 6, 255, 1, 6, '#3a3a44'); fb.rect(x + 4, 257, 5, 1, '#3a3a44');
        }
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 152, 241, 176, 2);
        if (on('level')) P.xp(240.5, 230, A);
        infoRows(X, P, 'top_right', 474, 6, 14, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 11, rr(w, 11, 2), PU);
            b.rect(x + w - 3, y + 1, 2, 9, PUMP[3]);
            icon(b, info.icon, x + 3, y + 1, R);
        }, true);
        return P.parts;
    }
    function halloweenHotbar(X) {
        return sheet((b) => framedSlots(b, X.t.plate, X.t.inset, false), (b) => ringSel(b, PUMP));
    }

    /* ═════════════ Arcade ═════════════ */

    const K = '#0a0a0e';
    function arcade(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.gemRamp || X.rampOf('#3a8cf0');
        const YEL = ['#5a3a00', '#a06a00', '#e0a000', '#ffd000', '#ffe860', '#fffbd0'];
        const fb = Buf(120, 200, 240, 70);
        // heart / food icon rows on a black rail
        const rail = (x, w) => { fb.rect(x, 227, w, 13, K); fb.rect(x + 1, 228, w - 2, 11, [30, 30, 40, 1]); };
        if (on('hp')) { rail(147, 92); for (let i = 0; i < 10; i++) fb.sprite(ICONS.heart, 148 + i * 9, 229, EMPTY); }
        if (on('food')) { rail(241, 92); for (let i = 0; i < 10; i++) fb.sprite(ICONS.food, 242 + i * 9, 229, EMPTY); }
        if (on('armor')) for (let i = 0; i < 10; i++) fb.sprite(PIPS.armor, 149 + i * 8, 219, EMPTY);
        if (on('air')) for (let i = 0; i < 10; i++) fb.sprite(PIPS.air, 253 + i * 8, 219, EMPTY);
        if (on('xp')) { fb.rect(147, 240, 186, 6, K); fb.rect(149, 241, 182, 3, [40, 40, 52, 1]); for (let x = 167; x < 330; x += 20) fb.vl(x, 241, 3, K); }
        if (on('level')) { fb.rect(229, 219, 23, 10, K); fb.rect(230, 220, 21, 8, G[2]); fb.hl(230, 220, 21, G[4]); }
        // pixel coin + star props
        fb.sprite(ICONS.coin, 134, 256, YEL); fb.sprite(['...o...', '..obo..', 'oobwboo', '.obbbo.', '.obobo.', '.oo.oo.'], 340, 257, YEL);
        P.img('frame', fb, A, 'panel', true);
        const pipFill = (stat, name, x, dir) => {
            const b = Buf(x, 229, 89, 9);
            for (let i = 0; i < 10; i++) b.sprite(ICONS[name], x + i * 9, 229, X.statRamp(stat));
            P.bar(stat, b, dir, A);
        };
        if (on('hp')) pipFill('hp', 'heart', 148, 'left');
        if (on('food')) pipFill('food', 'food', 242, 'right');
        if (on('armor')) { const b = Buf(149, 219, 79, 7); for (let i = 0; i < 10; i++) b.sprite(PIPS.armor, 149 + i * 8, 219, X.statRamp('armor')); P.bar('armor', b, 'left', A); }
        if (on('air')) { const b = Buf(253, 219, 79, 7); for (let i = 0; i < 10; i++) b.sprite(PIPS.air, 253 + i * 8, 219, X.statRamp('air')); P.bar('air', b, 'right', A); }
        if (on('xp')) {
            const R = X.statRamp('xp');
            const f = Buf(149, 241, 182, 3);
            for (let x = 149; x < 331; x++) if ((x - 167) % 20 !== 0) { f.set(x, 241, R[4]); f.set(x, 242, R[3]); f.set(x, 243, R[2]); }
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) P.xp(240.5, 227, A);
        // top-left: name box (yellow border) + top-right info boxes
        const TL = 'top_left';
        if (on('name')) {
            const w = Math.max(50, X.textW('%player_name%') + 10);
            const b = Buf(4, 4, w + 4, 15);
            b.rect(4, 4, w + 2, 14, K); b.rect(5, 5, w, 12, YEL[3]); b.rect(6, 6, w - 2, 10, K);
            P.img('name_box', b, TL, 'panel', true);
            P.text('%player_name%', 9, 8, 'left', TL, '#ffffff', w - 6);
        }
        infoRows(X, P, 'top_right', 474, 6, 14, (b, x, y, w, R, info) => {
            b.rect(x, y, w, 12, K); b.rect(x + 1, y + 1, w - 2, 10, G[1]); b.rect(x + 2, y + 2, w - 4, 8, K);
            icon(b, info.icon, x + 3, y + 1, R);
        }, true);
        return P.parts;
    }
    function arcadeHotbar(X) {
        const G = X.t.gemRamp || X.rampOf('#3a8cf0');
        return sheet((b) => {
            b.rect(0, 0, 182, 22, K);
            for (let i = 0; i < 9; i++) {
                const x = 2 + i * 20;
                b.rect(x, 2, 18, 18, G[0]); b.rect(x + 1, 3, 16, 16, G[1]); b.rect(x + 1, 17, 16, 2, G[0]);
                b.rect(x + 1, 3, 3, 1, '#ffffff'); b.rect(x + 1, 3, 1, 3, '#ffffff');
            }
        }, (b) => {
            b.rect(0, 0, 24, 24, K);
            b.rect(1, 1, 22, 22, '#ffd000'); b.rect(3, 3, 18, 18, [0, 0, 0, 0]);
            for (let j = 3; j < 21; j++) for (let i = 3; i < 21; i++) b.clear(i, j);
            b.rect(2, 2, 20, 1, '#fff7a0');
        });
    }

    /* ═════════════ Ocean ═════════════ */

    const SEAW = ['#06221a', '#0c4030', '#146a48', '#22985e', '#4ac47e', '#9aeab8'];
    function coral(b, x0, y0, R) {
        // branching coral grown from (x0, y0) upward
        const pts = new Set();
        const grow = (x, y, len, dir, th) => {
            for (let k = 0; k < len; k++) {
                y -= 1; x += dir * (k % 3 === 0 ? 1 : 0);
                for (let i = 0; i < th; i++) pts.add(Math.round(x + i) + ',' + y);
                if (k === Math.floor(len / 2) && len > 5) grow(x, y, Math.floor(len * 0.6), -dir, Math.max(1, th - 1));
            }
        };
        grow(x0, y0, 20, -1, 3); grow(x0 + 4, y0, 15, 1, 2); grow(x0 + 2, y0, 11, 1, 2);
        maskBlob(b, pts, R);
    }
    function seaweed(b, x0, y0, h) {
        for (let j = 0; j < h; j++) {
            const x = x0 + Math.round(1.5 * Math.sin(j * 0.45));
            b.set(x, y0 - j, SEAW[0]); b.set(x + 1, y0 - j, SEAW[4]); b.set(x + 2, y0 - j, SEAW[3]); b.set(x + 3, y0 - j, SEAW[0]);
        }
    }
    function shell(b, cx, cy, R) {
        blob(b, cx - 10, cy - 9, 21, 17, (i, j) => {
            const x = i - 10;
            const y = j - 13;
            return (y <= 0 && x * x + y * y <= 13 * 13 - 10) || (j >= 13 && Math.abs(x) <= 4 - (j - 13));
        }, R);
        for (let k = -3; k <= 3; k++) for (let r = 4; r <= 11; r++) {
            const a = -Math.PI / 2 + k * 0.38;
            b.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + 4 + Math.sin(a) * r), R[2]);
        }
    }
    function ocean(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const FR = t.plate;
        const CO = t.gemRamp || X.rampOf('#ff6fa8');
        const fb = Buf(110, 200, 260, 70);
        coral(fb, 134, 268, CO); seaweed(fb, 141, 268, 26);
        coral(fb, 338, 268, X.rampOf('#f0a020')); seaweed(fb, 352, 268, 30);
        blob(fb, 146, 238, 188, 8, rr(188, 8, 3), FR);
        if (on('xp')) { fb.rect(152, 240, 176, 4, FR[0]); fb.rect(153, 241, 174, 2, GLASS); }
        const fill = twinBars(X, P, fb, {
            y: 226, h: 10, w: 76, lx: 152, rx: 252,
            frame(b, x, y, w, h, side, stat) {
                blob(b, x, y, w, h, pill(w, h), FR);
                const gx = side === 'l' ? x + 12 : x + 4;
                b.rect(gx, y + 2, w - 16, h - 4, GLASS);
                blob(b, side === 'l' ? x - 2 : x + w - 12, y - 2, 14, 14, circle(14), ['#2a6a8a', '#8acfe8', '#c0ecff', '#e8faff', '#ffffff', '#ffffff'], { outline: FR[0] });
                icon(b, statIcon(stat), side === 'l' ? x + 1 : x + w - 9, y, X.statRamp(stat));
                return { x: gx, y: y + 2, w: w - 16, h: h - 4 };
            },
        });
        if (on('level')) shell(fb, 240, 226, ['#5a2a3a', '#a85a6a', '#e08a8a', '#ffc0b0', '#ffe0d0', '#fff6f0']);
        for (const [x, y, d] of [[128, 230, 5], [356, 222, 4], [150, 214, 3], [322, 212, 4], [362, 236, 3]]) {
            blob(fb, x, y, d, d, circle(d), ['#4aa8d8', '#bfeaff', '#bfeaff', '#e0f6ff', '#ffffff', '#ffffff'], { flat: true, fill: [200, 240, 255, 0.25] });
            fb.set(x + 1, y + 1, '#ffffff');
        }
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 153, 241, 174, 2);
        if (on('level')) P.xp(240.5, 228, A);
        const n0 = P.parts.length;
        infoRows(X, P, 'top_right', 474, 6, 15, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 12, pill(w, 12), FR);
            icon(b, info.icon, x + 4, y + 1, R);
        }, true);
        darkText(P, P.parts.length);
        void n0;
        return P.parts;
    }
    function oceanHotbar(X) {
        return sheet((b) => framedSlots(b, X.t.plate, X.t.inset, false), (b) => ringSel(b, ['#04303a', '#0a6a7a', '#16a0b0', '#3ad8e0', '#9af6ff', '#e8ffff']));
    }

    /* ═════════════ Desert ═════════════ */

    const SAND = ['#4a3216', '#8a6430', '#b88c4a', '#dcb46a', '#f0d494', '#fff0c8'];
    function pillar(b, x, y, w, h, GD) {
        blob(b, x, y + 6, w, h - 6, () => true, SAND);
        for (let j = y + 10; j < y + h - 2; j += 6) b.hl(x + 1, j, w - 2, SAND[2]);
        blob(b, x - 1, y, w + 2, 7, (i, j) => Math.abs(i - (w + 1) / 2) <= j * ((w + 2) / 14) + 0.5, GD);
    }
    function desert(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const GD = t.metal;
        const LP = t.gemRamp || X.rampOf('#3a8cf0');
        const fb = Buf(118, 200, 244, 70);
        pillar(fb, 133, 222, 12, 46, GD); pillar(fb, 335, 222, 12, 46, GD);
        blob(fb, 145, 237, 190, 9, () => true, SAND);
        // carved step band + lapis inlays
        for (let x = 147; x < 333; x += 8) { fb.set(x, 239, SAND[1]); fb.set(x + 1, 239, SAND[1]); fb.set(x + 2, 240, SAND[1]); fb.set(x + 4, 239, LP[3]); }
        if (on('xp')) { fb.rect(151, 241, 178, 4, SAND[0]); fb.rect(152, 242, 176, 2, GLASS); }
        const fill = twinBars(X, P, fb, {
            y: 226, h: 9, w: 76, lx: 152, rx: 252,
            frame(b, x, y, w, h, side, stat) {
                blob(b, x, y, w, h, () => true, SAND);
                b.rect(x, y, 4, h, LP[2]); b.rect(x + w - 4, y, 4, h, LP[2]); b.vl(x, y, h, LP[4]);
                b.hl(x, y, w, GD[3]);
                b.rect(x + 5, y + 2, w - 10, h - 4, GLASS);
                return { x: x + 5, y: y + 2, w: w - 10, h: h - 4 };
            },
        });
        if (on('level')) {
            for (let k = 0; k < 12; k++) {
                const a = (k * Math.PI) / 6;
                for (let r = 9; r <= 12; r++) fb.set(Math.round(240 + Math.cos(a) * r), Math.round(226 + Math.sin(a) * r), r === 12 ? GD[2] : GD[4]);
            }
            blob(fb, 231, 217, 19, 19, circle(19), GD);
            blob(fb, 234, 220, 13, 13, circle(13), ['#1a0e04', '#2a1808', '#3a220c', '#4a2c10', '#5a3614', '#6a4018'], { inset: true });
        }
        // icons on small sand tiles next to the bars
        for (const [stat, x] of [['hp', 140], ['food', 330]]) if (on(stat)) {
            blob(fb, x, 225, 11, 11, () => true, SAND); icon(fb, statIcon(stat), x + 1, 226, X.statRamp(stat));
        }
        P.img('frame', fb, A, 'panel');
        fill();
        xpLine(X, P, 152, 242, 176, 2);
        if (on('level')) P.xp(240.5, 229, A);
        const n0 = P.parts.length;
        infoRows(X, P, 'top_right', 474, 6, 14, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 12, () => true, SAND);
            b.rect(x, y, 3, 12, LP[3]); b.hl(x, y, w, GD[3]);
            icon(b, info.icon, x + 4, y + 1, R);
        }, true);
        for (let i = n0; i < P.parts.length; i++) if (P.parts[i].t === 'text') { P.parts[i].color = '#3a2408'; P.parts[i].shadow = false; }
        return P.parts;
    }
    function desertHotbar(X) {
        return sheet((b) => {
            framedSlots(b, SAND, ['#2a1c0a', '#3a2810', '#4a3416', '#5a401c', '#6a4c22', '#b88c4a'], false);
            for (let x = 4; x < 180; x += 10) b.set(x, 1, X.t.gemRamp ? X.t.gemRamp[3] : '#3a8cf0');
        }, (b) => ringSel(b, X.t.metal));
    }

    const reg = HudForgeV2.register;
    reg('pirate', { plan: pirate, hotbar: pirateHotbar });
    reg('samurai', { plan: samurai, hotbar: samuraiHotbar });
    reg('winter', { plan: winter, hotbar: winterHotbar });
    reg('halloween', { plan: halloween, hotbar: halloweenHotbar });
    reg('arcade', { plan: arcade, hotbar: arcadeHotbar });
    reg('ocean', { plan: ocean, hotbar: oceanHotbar });
    reg('desert', { plan: desert, hotbar: desertHotbar });
    void segTrack; void segFill; void mixHex; void sparkle; void valueText; void D; void ROPE;
})();
