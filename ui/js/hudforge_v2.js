/*
 * HUD Forge v2 — hand-laid layouts (2026-11-21 redesign)
 *
 *   crest  A · Twin Crest   — diamond orbs (HP / Food) beside the hotbar, ledge with XP groove, level plaque
 *   strip  B · Clean Strip  — flat dark strips, segmented bars, text on its own strip
 *   slash  C · Slash        — numbered hotbar, split XP, tabs bottom-right + a top-left profile (c1/c2/c3)
 *
 * Each layout draws its own textures in screen coordinates (480×270) and returns finished parts:
 *   { t:'img',  pre:true, role, tex1, x, y, w, h, anchor, layer }
 *   { t:'bar',  pre:true, inComp:true, stat, fill1, x, y, w, h, g:{fx,fy,fw,fh}, dir, anchor }
 *   { t:'text' … } / { t:'xp' … }   (same as the classic engine)
 * hudforge.js calls HudForgeV2.plan(id, X) / HudForgeV2.hotbar(id, X) when the layout is one of these.
 * Ramps are arrays [outline, dark2, dark, base, light, highlight] like hudforge_themes.js.
 */
(function () {
    'use strict';
    const D = window.HudForgeData;

    /* ───────────── pixel buffer in screen coordinates ───────────── */

    const hexCache = new Map();
    function rgba(c, a) {
        if (Array.isArray(c)) return [c[0], c[1], c[2], c[3] == null ? (a == null ? 1 : a) : c[3]];
        let v = hexCache.get(c);
        if (!v) {
            const s = c.replace('#', '');
            v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
            hexCache.set(c, v);
        }
        return [v[0], v[1], v[2], a == null ? 1 : a];
    }
    function Buf(ox, oy, w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, w);
        c.height = Math.max(1, h);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(c.width, c.height);
        const d = img.data;
        const b = {
            ox, oy, w: c.width, h: c.height,
            set(x, y, col, a) {
                if (!col) return;
                x = (x | 0) - ox; y = (y | 0) - oy;
                if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
                const [r, g, bl, al] = rgba(col, a);
                const i = (y * b.w + x) * 4;
                const da = d[i + 3] / 255;
                if (al >= 1 || da === 0) {
                    d[i] = r; d[i + 1] = g; d[i + 2] = bl; d[i + 3] = Math.round(al * 255);
                    return;
                }
                const oa = al + da * (1 - al);
                d[i] = Math.round((r * al + d[i] * da * (1 - al)) / oa);
                d[i + 1] = Math.round((g * al + d[i + 1] * da * (1 - al)) / oa);
                d[i + 2] = Math.round((bl * al + d[i + 2] * da * (1 - al)) / oa);
                d[i + 3] = Math.round(oa * 255);
            },
            clear(x, y) {
                x = (x | 0) - ox; y = (y | 0) - oy;
                if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
                d[(y * b.w + x) * 4 + 3] = 0;
            },
            rect(x, y, w2, h2, col) { for (let j = y; j < y + h2; j++) for (let i = x; i < x + w2; i++) b.set(i, j, col); },
            hl(x, y, w2, col) { b.rect(x, y, w2, 1, col); },
            vl(x, y, h2, col) { b.rect(x, y, 1, h2, col); },
            /* raised box: outline, lit top/left, shaded bottom/right */
            bevel(x, y, w2, h2, R) {
                b.rect(x, y, w2, h2, R[0]);
                b.rect(x + 1, y + 1, w2 - 2, h2 - 2, R[3]);
                b.hl(x + 1, y + 1, w2 - 2, R[4]); b.vl(x + 1, y + 1, h2 - 2, R[4]);
                b.hl(x + 1, y + h2 - 2, w2 - 2, R[2]); b.vl(x + w2 - 2, y + 1, h2 - 2, R[2]);
                b.set(x + 1, y + 1, R[5]);
            },
            /* sprite rows: o outline · d dark · b base · l light · w highlight */
            sprite(rows, x, y, R, flip) {
                const m = { o: R[0], d: R[2], b: R[3], l: R[4], w: R[5] };
                rows.forEach((row, j) => [...row].forEach((ch, i) => {
                    if (m[ch]) b.set(x + (flip ? row.length - 1 - i : i), y + j, m[ch]);
                }));
            },
            done() { ctx.putImageData(img, 0, 0); return c; },
        };
        return b;
    }
    /* parallelogram leaning right (top row shifted by `sl`) */
    function para(b, x, y, w, h, sl, col) {
        for (let j = 0; j < h; j++) {
            const off = h > 1 ? Math.round(((h - 1 - j) * sl) / (h - 1)) : 0;
            b.hl(x + off, y + j, w, col);
        }
    }

    const ICONS = D.ICONS;
    const PIPS = D.PIPS;
    const EMPTY = ['#0c0d11', '#1c1e25', '#24262f', '#2e313b', '#3b3f4b', '#4a4e5a'];
    const TINY = {
        1: ['.x.', 'xx.', '.x.', '.x.', 'xxx'], 2: ['xx.', '..x', '.x.', 'x..', 'xxx'], 3: ['xx.', '..x', '.x.', '..x', 'xx.'],
        4: ['x.x', 'x.x', 'xxx', '..x', '..x'], 5: ['xxx', 'x..', 'xx.', '..x', 'xx.'], 6: ['.xx', 'x..', 'xxx', 'x.x', 'xxx'],
        7: ['xxx', '..x', '.x.', '.x.', '.x.'], 8: ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'], 9: ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
    };
    const VALUE_ONLY = { hp: '%player_health_rounded%', food: '%player_food_level%', air: '%player_remaining_air%' };

    /* ───────────── parts ───────────── */

    function mk(X) {
        const parts = [];
        return {
            parts,
            img(role, b, anchor, layer, noShadow) {
                const c = noShadow ? b.done() : X.withShadow(b.done(), 0.42);
                parts.push({ t: 'img', pre: true, role, tex1: c, x: b.ox, y: b.oy, w: c.width, h: c.height, anchor, layer: layer || 'panel' });
            },
            bar(stat, b, dir, anchor) {
                parts.push({
                    t: 'bar', pre: true, inComp: true, stat, fill1: b.done(), x: b.ox, y: b.oy, w: b.w, h: b.h,
                    g: { fx: 0, fy: 0, fw: b.w, fh: b.h, pips: false }, dir, anchor,
                });
            },
            text(papi, x, y, align, anchor, color, w) {
                parts.push({ t: 'text', papi, x, y, align, anchor, color: color || '#ffffff', shadow: true, w: w || X.textW(papi) });
            },
            xp(x, y, anchor) { parts.push({ t: 'xp', x, y, anchor, plain: true }); },
        };
    }

    /* glossy horizontal fill (rows lit from the top) */
    function fillRows(b, x, y, w, h, R) {
        for (let j = 0; j < h; j++) {
            const c = j === 0 ? R[4] : j >= h - 1 && h > 2 ? R[2] : R[3];
            b.hl(x, y + j, w, c);
        }
        if (h >= 4) b.hl(x, y, w, R[5]), b.hl(x, y + 1, w, R[4]);
    }
    /* 9-slot hotbar on a 256×256 legacy widgets sheet */
    function sheet(drawBar, drawSel) {
        const bar = Buf(0, 0, 182, 22);
        drawBar(bar);
        const sel = Buf(0, 0, 24, 24);
        drawSel(sel);
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.drawImage(bar.done(), 0, 0);
        ctx.drawImage(sel.done(), 0, 22);
        return c;
    }
    function ringSel(b, R, k2) {
        // 24×24 selection ring, 2px, lit top-left
        for (let k = 0; k < 3; k++) {
            const c = k === 0 ? R[0] : k === 1 ? R[4] : (k2 || R[3]);
            const c2 = k === 0 ? R[0] : k === 1 ? R[2] : (k2 || R[2]);
            b.hl(k, k, 24 - 2 * k, c); b.vl(k, k, 24 - 2 * k, c);
            b.hl(k, 23 - k, 24 - 2 * k, c2); b.vl(23 - k, k, 24 - 2 * k, c2);
        }
        b.set(1, 1, R[5]);
    }
    function framedSlots(b, FR, SL, nums) {
        b.rect(0, 0, 182, 22, FR[0]);
        b.rect(1, 1, 180, 20, FR[2]);
        b.hl(1, 1, 180, FR[4]); b.hl(1, 20, 180, FR[1]);
        for (let i = 0; i < 9; i++) {
            const sx = 1 + i * 20;
            b.rect(sx + 1, 2, 18, 18, SL[0]);
            b.rect(sx + 2, 3, 16, 16, SL[3]);
            b.hl(sx + 2, 3, 16, SL[1]); b.vl(sx + 2, 3, 16, SL[1]);
            b.hl(sx + 2, 18, 16, SL[4]); b.vl(sx + 17, 3, 16, SL[4]);
            if (nums) TINY[i + 1].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') b.set(sx + 3 + x, 4 + y, FR[4]); }));
        }
    }

    /* ═════════════ A · Twin Crest ═════════════ */

    const GLASS = '#120e16';
    function orbFrame(b, cx, cy, r, FR, TR) {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
            const d = Math.abs(x - cx) + Math.abs(y - cy);
            if (d > r) continue;
            const up = (x - cx) + (y - cy) < 0; // faces the top-left light
            let c;
            if (d === r) c = TR[0];
            else if (d >= r - 2) c = up ? (d === r - 1 ? TR[4] : TR[3]) : TR[2];
            else if (d >= r - 5) c = up ? (d === r - 3 ? FR[4] : FR[3]) : (d === r - 5 ? FR[1] : FR[2]);
            else if (d === r - 6) c = FR[0];
            else c = GLASS;
            b.set(x, y, c);
        }
        for (const [dx, dy] of [[0, 1 - r], [0, r - 1], [1 - r, 0], [r - 1, 0]]) b.set(cx + dx, cy + dy, TR[5]);
    }
    function orbFill(cx, cy, ri, L) {
        const b = Buf(cx - ri, cy - ri, ri * 2 + 1, ri * 2 + 1);
        for (let y = cy - ri; y <= cy + ri; y++) for (let x = cx - ri; x <= cx + ri; x++) {
            const d = Math.abs(x - cx) + Math.abs(y - cy);
            if (d > ri) continue;
            const k = x - cx;
            let c = k < -Math.round(ri / 3) ? L[4] : k < Math.round(ri / 3) ? L[3] : L[2];
            if (d === ri) c = x < cx ? L[4] : L[1];
            if (d === ri && x < cx && y < cy) c = L[5];
            b.set(x, y, c);
        }
        // glint on the glass
        b.set(cx - ri + 4, cy, '#ffffff'); b.set(cx - ri + 5, cy - 1, '#ffffff'); b.set(cx - ri + 6, cy - 2, L[5]);
        return b;
    }

    function crest(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const FR = t.plate;
        const TR = t.metal;
        const R = 23;
        const CY = 245;
        const orbs = [['hp', 126, 'heart'], ['food', 354, 'food']].filter(([s]) => on(s));

        const fb = Buf(100, 221, 281, 49);
        // ledge across the top of the hotbar, with a metal lip and stone joints
        const lx = 143, ly = 236, lw = 194, lh = 11;
        fb.bevel(lx, ly, lw, lh, FR);
        fb.hl(lx + 1, ly + 1, lw - 2, TR[4]);
        fb.hl(lx + 1, ly + 2, lw - 2, TR[2]);
        for (let jx = lx + 12; jx < lx + lw - 4; jx += 16) { fb.vl(jx, ly + 3, lh - 4, FR[2]); fb.vl(jx + 1, ly + 3, lh - 4, FR[4]); }
        const gx = lx + 8, gy = ly + 5, gw = lw - 16, gh = 4;
        if (on('xp')) { fb.rect(gx - 1, gy - 1, gw + 2, gh + 2, FR[0]); fb.rect(gx, gy, gw, gh, GLASS); }
        // armor pips (left) / air pips (right) stand on the ledge: empty ones are engraved
        const pipRow = (x0) => { for (let i = 0; i < 10; i++) fb.sprite(PIPS.armor, x0 + i * 8, 229, EMPTY); };
        if (on('armor')) pipRow(145);
        if (on('air')) for (let i = 0; i < 10; i++) fb.sprite(PIPS.air, 256 + i * 8, 229, EMPTY);
        // level plaque
        if (on('level')) {
            fb.bevel(225, 222, 30, 15, TR);
            fb.rect(228, 225, 24, 9, TR[0]);
            fb.rect(229, 226, 22, 7, '#140c04');
        }
        for (const [, cx] of orbs) {
            orbFrame(fb, cx, CY, R, FR, TR);
            // short metal arm from the orb into the ledge
            const ax = cx < 240 ? cx + R - 4 : cx - R + 1;
            fb.rect(ax, 240, 4, 3, TR[0]); fb.hl(ax, 241, 4, TR[3]);
        }
        P.img('frame', fb, A, 'panel');

        if (on('xp')) {
            const xb = Buf(gx, gy, gw, gh);
            fillRows(xb, gx, gy, gw, gh, X.statRamp('xp'));
            P.bar('xp', xb, 'left', A);
        }
        if (on('armor')) {
            const pb = Buf(145, 229, 79, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 145 + i * 8, 229, X.statRamp('armor'));
            P.bar('armor', pb, 'left', A);
        }
        if (on('air')) {
            const pb = Buf(256, 229, 79, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.air, 256 + i * 8, 229, X.statRamp('air'));
            P.bar('air', pb, 'right', A);
        }
        for (const [stat, cx, icon] of orbs) {
            const ri = R - 7;
            P.bar(stat, orbFill(cx, CY, ri, X.statRamp(stat)), 'bottom', A);
            const ib = Buf(cx - 4, CY - 13, 9, 9);
            ib.sprite(ICONS[icon], cx - 4, CY - 13, X.statRamp(stat));
            P.img(`icon_${icon}`, ib, A, 'icon');
            if (X.state.values !== false) P.text(VALUE_ONLY[stat], cx, CY + 6, 'center', A, '#ffffff', 20);
        }
        if (on('level')) P.xp(240, 232, A);
        X.infoStrips(P);
        return P.parts;
    }
    function crestHotbar(X) {
        const t = X.t;
        return sheet((b) => framedSlots(b, t.plate, t.inset, X.state.slotNums), (b) => ringSel(b, t.metal));
    }

    /* ═════════════ B · Clean Strip ═════════════ */

    const INK = [18, 16, 20, 0.88];
    const INK2 = [10, 9, 12, 0.94];
    const SEG_BG = [40, 36, 44, 1];
    const SEG_OFF = [58, 54, 64, 1];

    /* a segmented track (frame + empty cells) and its fill; seg = cell pitch */
    function segTrack(b, x, y, w, h, seg, rev) {
        b.rect(x - 1, y - 1, w + 2, h + 2, INK2);
        b.rect(x, y, w, h, SEG_BG);
        const n = Math.floor(w / seg);
        for (let i = 0; i < n; i++) {
            const sx = rev ? x + w - (i + 1) * seg : x + i * seg;
            b.rect(sx, y, seg - 1, h, SEG_OFF);
        }
    }
    function segFill(x, y, w, h, seg, R, rev) {
        const b = Buf(x, y, w, h);
        const n = Math.floor(w / seg);
        for (let i = 0; i < n; i++) {
            const sx = rev ? x + w - (i + 1) * seg : x + i * seg;
            b.rect(sx, y, seg - 1, h, R[3]);
            b.hl(sx, y, seg - 1, R[4]);
            if (h > 2) b.hl(sx, y + h - 1, seg - 1, R[2]);
            b.set(sx, y, R[5]);
        }
        return b;
    }
    function strip(X) {
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const T = X.accent;

        // XP line on top of the hotbar + level chip
        if (on('xp')) {
            const xb = Buf(149, 242, 182, 4);
            xb.rect(149, 242, 182, 4, INK2);
            P.img('xp_track', xb, A, 'panel', true);
            const f = Buf(150, 243, 180, 2);
            f.hl(150, 243, 180, X.statRamp('xp')[4]); f.hl(150, 244, 180, X.statRamp('xp')[3]);
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) {
            const lb = Buf(231, 231, 19, 11);
            lb.rect(231, 231, 19, 11, INK2);
            lb.hl(231, 231, 19, T[3]);
            P.img('level_chip', lb, A, 'panel', true);
            P.xp(240.5, 239, A);
        }
        // two bar stacks: big bar (hp | food) under a thin one (armor | air), icon tile outside
        const side = (big, thin, icon, xTile, xBar, rev) => {
            if (!on(big) && !on(thin)) return;
            const b = Buf(Math.min(xTile, xBar - 1), 226, 96, 16);
            b.rect(xTile, 227, 13, 13, INK2);
            const ic = on(big) ? big : thin;
            b.sprite(ICONS[D.STAT_ICON[ic]], xTile + 2, 229, X.statRamp(ic));
            if (on(thin)) segTrack(b, xBar, 228, 78, 3, 5, rev);
            if (on(big)) segTrack(b, xBar, 235, 78, 5, 5, rev);
            P.img(`${big}_${thin}_tracks`, b, A, 'panel');
            if (on(thin)) P.bar(thin, segFill(xBar, 228, 78, 3, 5, X.statRamp(thin), rev), rev ? 'right' : 'left', A);
            if (on(big)) P.bar(big, segFill(xBar, 235, 78, 5, 5, X.statRamp(big), rev), rev ? 'right' : 'left', A);
        };
        side('hp', 'armor', 'heart', 136, 151, false);
        side('food', 'air', 'food', 332, 252, true);

        // top-left: name strip (+ mana)
        if (on('name') || on('mana')) {
            const TL = 'top_left';
            const nameW = on('name') ? Math.max(48, X.textW('%player_name%') + 10) : 0;
            const manaW = on('mana') ? 80 : 0;
            const w = Math.max(nameW, manaW);
            const b = Buf(6, 6, w, on('mana') ? 21 : 11);
            if (on('name')) { b.rect(6, 6, w, 11, INK); b.vl(6, 6, 11, T[3]); }
            if (on('mana')) {
                const my = on('name') ? 18 : 6;
                b.rect(6, my, w, 9, INK);
                b.sprite(['..o..', '.obo.', 'obwbo', '.obo.', '..o..'], 8, my + 2, X.statRamp('mana'));
                segTrack(b, 16, my + 3, 60, 3, 4, false);
                P.img('name_strip', b, TL, 'panel');
                P.bar('mana', segFill(16, my + 3, 60, 3, 4, X.statRamp('mana'), false), 'left', TL);
            } else P.img('name_strip', b, TL, 'panel');
            if (on('name')) P.text('%player_name%', 10, 9, 'left', TL, '#ffffff', nameW - 8);
        }
        X.infoStrips(P);
        return P.parts;
    }
    function stripHotbar(X) {
        const T = X.accent;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, INK);
            for (let i = 0; i < 9; i++) {
                const sx = 1 + i * 20;
                b.rect(sx + 1, 1, 18, 20, [255, 255, 255, 0.10]);
                b.rect(sx + 2, 2, 16, 18, [0, 0, 0, 0.24]);
                b.hl(sx + 2, 19, 16, [255, 255, 255, 0.12]);
            }
        }, (b) => {
            for (let k = 0; k < 2; k++) {
                b.hl(k, k, 24 - 2 * k, T[4]); b.vl(k, k, 24 - 2 * k, T[4]);
                b.hl(k, 23 - k, 24 - 2 * k, T[2]); b.vl(23 - k, k, 24 - 2 * k, T[2]);
            }
        });
    }

    /* flat info strips top-right (money / time / coords) — used by A and B */
    function infoStripsFlat(X, P) {
        const TR = 'top_right';
        let y = 6;
        for (const k of Object.keys(X.INFO).filter(X.on)) {
            const info = X.INFO[k];
            const tw = X.textW(info.papi);
            const w = tw + 18;
            const x = 474 - w;
            const R = X.rampOf(X.iconColor(info.icon));
            const b = Buf(x, y, w, 11);
            b.rect(x, y, w, 11, INK);
            b.vl(x, y, 11, R[3]);
            b.sprite(ICONS[info.icon], x + 3, y + 1, R);
            P.img(`info_${k}`, b, TR, 'panel');
            P.text(info.papi, x + 14, y + 3, 'left', TR, '#f0eef5', tw);
            y += 13;
        }
    }


    /* ═════════════ C · Slash (bottom) + three top-left profiles ═════════════ */

    function slashBottom(X, P) {
        const t = X.t;
        const on = X.on;
        const A = 'bottom_middle';
        const FR = t.plate;
        const CYR = X.accent;
        if (on('xp')) {
            const b = Buf(149, 238, 182, 5);
            b.rect(149, 238, 182, 5, FR[0]); b.rect(150, 239, 180, 3, GLASS);
            P.img('xp_track', b, A, 'panel');
            const f = Buf(150, 239, 180, 3);
            const R = X.statRamp('xp');
            f.hl(150, 239, 180, R[4]); f.hl(150, 240, 180, R[3]); f.hl(150, 241, 180, R[2]);
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) {
            // chip sits over the XP line (icon layer → above the bar)
            const b = Buf(229, 233, 23, 12);
            b.rect(229, 233, 23, 12, FR[0]); b.rect(230, 234, 21, 10, FR[2]); b.hl(230, 234, 21, CYR[3]); b.hl(230, 235, 21, FR[4]);
            P.img('level_chip', b, A, 'icon');
            P.xp(240.5, 242, A);
        }
        // info tabs, bottom-right, stacked upward
        const BR = 'bottom_right';
        let y = 257;
        for (const k of Object.keys(X.INFO).filter(on)) {
            const info = X.INFO[k];
            const tw = X.textW(info.papi);
            const w = tw + 20;
            const x = 472 - w;
            const R = X.rampOf(X.iconColor(info.icon));
            const b = Buf(x, y, w + 2, 11);
            b.rect(x, y, w, 11, FR[0]); b.rect(x + 1, y + 1, w - 2, 9, FR[3]); b.hl(x + 1, y + 1, w - 2, FR[4]);
            b.rect(x + w - 13, y + 1, 12, 9, FR[1]);
            b.sprite(ICONS[info.icon], x + w - 12, y + 1, R);
            b.rect(x + w, y, 2, 11, CYR[3]);
            P.img(`info_${k}`, b, BR, 'panel');
            P.text(info.papi, x + 4, y + 3, 'left', BR, '#ffffff', tw);
            y -= 13;
        }
    }
    function slashHotbar(X) {
        const t = X.t;
        return sheet((b) => framedSlots(b, t.plate, t.inset, true), (b) => ringSel(b, X.accent));
    }
    const bigFill = (x, y, w, h, R) => {
        const b = Buf(x, y, w, h);
        for (let j = 0; j < h; j++) b.hl(x, y + j, w, j === 0 ? R[5] : j === 1 ? R[4] : j >= h - 2 ? R[2] : R[3]);
        return b;
    };
    const topBars = (on) => ['hp', 'mana', 'food'].filter(on);

    /* C-1 · Medallion: octagon portrait, thick bars tucked under it, number in a pocket at the bar's end */
    function slashMedal(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const TL = 'top_left';
        const FR = t.plate;
        const CYR = X.accent;
        const bars = topBars(on);
        const b = Buf(0, 0, 200, 64);
        const POCKET = 36;
        let y = 20;
        const rows = [];
        if (on('name')) {
            const nw = Math.max(40, X.textW('%player_name%') + 8);
            b.rect(36, 10, nw, 10, FR[0]); b.rect(37, 11, nw - 2, 9, FR[3]); b.hl(37, 11, nw - 2, FR[4]);
            P.text('%player_name%', 40, 13, 'left', TL, '#ffffff', nw - 6);
        }
        bars.forEach((stat, i) => {
            const h = i === 0 ? 11 : 9;
            const w = i === 0 ? 130 : 112;
            b.rect(30, y, w, h, FR[0]);
            b.rect(31, y + 1, w - POCKET - 2, h - 2, GLASS); // fill starts right of the medallion (x 41)
            b.rect(30 + w - POCKET, y + 1, POCKET - 1, h - 2, FR[2]);
            b.hl(30 + w - POCKET, y + 1, POCKET - 1, FR[4]);
            b.rect(30 + w, y + 2, 3, h - 4, CYR[3]); b.set(30 + w, y + 2, CYR[5]);
            rows.push({ stat, y, h, w });
            y += h + 1;
        });
        // octagon medallion (drawn over the bars' left ends)
        const S = 36;
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
            const d = Math.min(i, j, S - 1 - i, S - 1 - j);
            const e = Math.min(i + j, S - 1 - i + j, i + S - 1 - j, 2 * S - 2 - i - j);
            if (e < 6) continue;
            let c;
            if (e === 6 || d === 0) c = FR[0];
            else if (d <= 2 || e <= 8) c = i + j < S - 2 ? CYR[4] : CYR[2];
            else if (d === 3 || e === 9) c = FR[0];
            else c = FR[1];
            b.set(4 + i, 4 + j, c);
        }
        if (on('armor')) for (let i = 0; i < 10; i++) b.sprite(PIPS.armor, 46 + i * 8, y + 2, EMPTY);
        if (on('level')) {
            const bx = 14, by = 36;
            b.rect(bx + 2, by, 12, 11, FR[0]); b.rect(bx, by + 2, 16, 7, FR[0]);
            b.rect(bx + 3, by + 1, 10, 9, CYR[2]); b.rect(bx + 1, by + 3, 14, 5, CYR[2]); b.hl(bx + 3, by + 1, 10, CYR[4]);
        }
        P.img('profile', b, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 10, y: 10, w: 24, h: 24, anchor: TL });
        for (const r of rows) {
            P.bar(r.stat, bigFill(41, r.y + 1, r.w - POCKET - 12, r.h - 2, X.statRamp(r.stat)), 'left', TL);
            const vp = X.valuePapi(r.stat);
            if (vp) P.text(vp, 30 + r.w - POCKET + 2, r.y + (r.h - 7) / 2 + 2, 'left', TL, '#ffffff', POCKET - 4);
        }
        if (on('armor')) {
            const pb = Buf(46, y + 2, 79, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 46 + i * 8, y + 2, X.statRamp('armor'));
            P.bar('armor', pb, 'left', TL);
        }
        if (on('level')) P.xp(22, 45, TL);
        slashBottom(X, P);
        return P.parts;
    }

    /* C-2 · Row strips: head tile + one strip per stat (icon · segmented bar · number) */
    function slashRows(X) {
        const on = X.on;
        const P = mk(X);
        const TL = 'top_left';
        const CYR = X.accent;
        const b = Buf(0, 0, 200, 70);
        b.rect(4, 4, 30, 30, CYR[3]); b.rect(5, 5, 28, 28, INK2);
        if (on('level')) { b.rect(4, 34, 30, 10, INK2); b.hl(4, 34, 30, CYR[3]); }
        let y = 4;
        if (on('name')) {
            const nw = Math.max(60, X.textW('%player_name%') + 10);
            b.rect(34, 4, nw, 11, INK);
            P.text('%player_name%', 38, 7, 'left', TL, '#ffffff', nw - 8);
            y = 16;
        }
        const rows = [];
        for (const stat of topBars(on)) {
            const w = 128;
            b.rect(34, y, w, 11, INK);
            const R = X.statRamp(stat);
            b.sprite(ICONS[D.STAT_ICON[stat]], 36, y + 1, R);
            segTrack(b, 48, y + 3, 72, 5, 4, false);
            b.vl(34 + w, y, 11, R[3]);
            rows.push({ stat, y });
            y += 12;
        }
        if (on('armor')) {
            for (let i = 0; i < 10; i++) b.sprite(PIPS.armor, 36 + i * 8, y + 2, EMPTY);
        }
        P.img('profile', b, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 7, y: 7, w: 24, h: 24, anchor: TL });
        for (const r of rows) {
            P.bar(r.stat, segFill(48, r.y + 3, 72, 5, 4, X.statRamp(r.stat), false), 'left', TL);
            const vp = X.valuePapi(r.stat);
            if (vp) P.text(vp, 123, r.y + 3, 'left', TL, '#ffffff', 38);
        }
        if (on('armor')) {
            const pb = Buf(36, y + 2, 79, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 36 + i * 8, y + 2, X.statRamp('armor'));
            P.bar('armor', pb, 'left', TL);
        }
        if (on('level')) P.xp(19, 42, TL);
        slashBottom(X, P);
        return P.parts;
    }

    /* C-3 · Crest + blades: shield portrait with a level ribbon, tapered blade bars */
    function slashCrest(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const TL = 'top_left';
        const FR = t.plate;
        const CYR = X.accent;
        const b = Buf(0, 0, 200, 60);
        // blade = full height, then a straight 1px-per-step taper over its last part
        const blade = (x, y, L, h0) => {
            const taper = Math.round(L * 0.45);
            const step = taper / (h0 - 1);
            const hAt = (i) => (i < L - taper ? h0 : Math.max(1, h0 - Math.ceil((i - (L - taper)) / step)));
            return { hAt, x, y, L };
        };
        const specs = { hp: [13, 150, 12], mana: [28, 112, 6], food: [36, 84, 5] };
        const list = topBars(on).map((s, i) => {
            const [y0, L, h0] = specs[['hp', 'mana', 'food'][i]];
            return { stat: s, bl: blade(34, y0, L, h0), h0 };
        });
        for (const { bl } of list) {
            for (let i = -1; i <= bl.L; i++) {
                const h = bl.hAt(Math.max(0, Math.min(bl.L - 1, i)));
                b.vl(bl.x + i, bl.y - 1, h + 2, FR[0]);
                if (i >= 0 && i < bl.L) b.vl(bl.x + i, bl.y, h, GLASS);
            }
        }
        if (on('armor')) {
            const py = list.length ? list[list.length - 1].bl.y + list[list.length - 1].h0 + 3 : 14;
            for (let i = 0; i < 10; i++) b.sprite(PIPS.armor, 40 + i * 8, py, EMPTY);
            list.armorY = py;
        }
        // shield
        const sx = 4, sy = 4, sw = 32, sh = 42, cx = sx + sw / 2;
        for (let j = 0; j < sh; j++) {
            const hw = j < sh - 12 ? sw / 2 : Math.round((sw / 2) * Math.pow((sh - j) / 12, 0.8));
            for (let i = -hw; i < hw; i++) {
                const edge = i === -hw || i === hw - 1 || j === 0 || (j >= sh - 12 && Math.abs(i + 0.5) >= hw - 1.5);
                let c;
                if (edge) c = FR[0];
                else if (i <= -hw + 2 || j <= 2) c = i < 0 ? CYR[4] : CYR[3];
                else if (i >= hw - 3) c = CYR[2];
                else c = FR[2];
                b.set(cx + i, sy + j, c);
            }
        }
        b.rect(11, 9, 18, 18, FR[0]);
        if (on('level')) {
            const rx = 0, ry = 29;
            const RB = X.rampOf(X.t.gem || '#3a8cf0');
            b.rect(rx + 2, ry, 36, 10, FR[0]); b.rect(rx + 3, ry + 1, 34, 8, RB[3]); b.hl(rx + 3, ry + 1, 34, RB[4]); b.hl(rx + 3, ry + 8, 34, RB[2]);
            for (let k = 0; k < 3; k++) { b.clear(rx + 2 + k, ry + 3 + k); b.clear(rx + 37 - k, ry + 3 + k); }
        }
        P.img('profile', b, TL, 'panel');
        if (on('head')) P.parts.push({ t: 'headonly', x: 12, y: 10, w: 16, h: 16, anchor: TL });
        for (const { stat, bl } of list) {
            const f = Buf(bl.x, bl.y, bl.L, bl.hAt(0));
            const R = X.statRamp(stat);
            for (let i = 0; i < bl.L; i++) {
                const h = bl.hAt(i);
                for (let j = 0; j < h; j++) f.set(bl.x + i, bl.y + j, j === 0 ? R[5] : j < h * 0.35 ? R[4] : j < h * 0.75 ? R[3] : R[2]);
            }
            P.bar(stat, f, 'left', TL);
        }
        if (on('hp')) P.text(X.valuePapi('hp'), 40, 16, 'left', TL, '#ffffff', 40);
        if (on('name')) P.text('%player_name%', 40, 4, 'left', TL, '#ffffff', 60);
        if (on('armor')) {
            const pb = Buf(40, list.armorY, 79, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 40 + i * 8, list.armorY, X.statRamp('armor'));
            P.bar('armor', pb, 'left', TL);
        }
        if (on('level')) P.xp(20, 37, TL);
        slashBottom(X, P);
        return P.parts;
    }

    const LAYOUTS = {
        crest: { plan: crest, hotbar: crestHotbar },
        strip: { plan: strip, hotbar: stripHotbar },
        slash_medal: { plan: slashMedal, hotbar: slashHotbar },
        slash_rows: { plan: slashRows, hotbar: slashHotbar },
        slash_crest: { plan: slashCrest, hotbar: slashHotbar },
    };
    function ctx(X) {
        X.infoStrips = (P) => infoStripsFlat(X, P);
        X.accent = X.rampOf(X.t.accent);
        return X;
    }
    window.HudForgeV2 = {
        /* more layouts live in hudforge_v2_more.js and register themselves here */
        register: (id, def) => { LAYOUTS[id] = def; },
        lib: { Buf, mk, sheet, ringSel, framedSlots, segTrack, segFill, fillRows, para, rgba, ICONS, PIPS, EMPTY, GLASS, INK, INK2, TINY, VALUE_ONLY, infoStripsFlat },
        has: (id) => !!LAYOUTS[id],
        plan: (id, X) => LAYOUTS[id].plan(ctx(X)),
        hotbar: (id, X) => LAYOUTS[id].hotbar(ctx(X)),
    };
})();
