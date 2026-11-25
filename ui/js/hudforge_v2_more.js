/*
 * HUD Forge v2 — more layouts (set 2, 2026-11-21)
 *
 *   cozy    Cozy Wood   — wooden shelf + log bars, grass & flowers, crates with bushes, hanging signboards (top-left)
 *   neon    Neon        — translucent panels with neon outlines + cut corners, bracket slots, hex level
 *   steam   Steampunk   — vertical glass tubes (HP / Food / Armor / Air) with brass caps, copper pipes, level gauge
 *   gothic  Gothic      — blood orb (HP) over the hotbar, bone horns, iron wing bars, level diamond
 *   bubble  Kawaii      — pastel pills with icon bubbles, rounded slots, star level, sparkles
 *
 * Loaded after hudforge_v2.js; uses HudForgeV2.lib (screen-space pixel buffer etc.).
 */
(function () {
    'use strict';
    if (!window.HudForgeV2) return;
    const D = window.HudForgeData;
    const { Buf, mk, sheet, ringSel, framedSlots, segTrack, segFill, rgba, ICONS, PIPS, EMPTY, GLASS, VALUE_ONLY } = HudForgeV2.lib;

    /* ───────────── shape helpers ───────────── */

    const rr = (w, h, r) => (i, j) => {
        const cx = i < r ? r - 0.5 : i >= w - r ? w - r - 0.5 : i;
        const cy = j < r ? r - 0.5 : j >= h - r ? h - r - 0.5 : j;
        return (i - cx) ** 2 + (j - cy) ** 2 <= r * r + 0.25;
    };
    const circle = (d) => (i, j) => (i - (d - 1) / 2) ** 2 + (j - (d - 1) / 2) ** 2 <= (d / 2) ** 2 - 0.1;
    const pill = (w, h) => rr(w, h, Math.floor(h / 2));
    /**
     * Fills any shape with a 1px outline and a bevel lit from the top-left.
     * opt: { outline, inset, flat, fill, rim (bevel width) }
     */
    function blob(b, x0, y0, w, h, inside, R, opt) {
        const o = opt || {};
        const ins = (i, j) => i >= 0 && j >= 0 && i < w && j < h && inside(i, j);
        const edge = (i, j) => ins(i, j) && (!ins(i - 1, j) || !ins(i + 1, j) || !ins(i, j - 1) || !ins(i, j + 1));
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            if (!ins(i, j)) continue;
            if (edge(i, j)) { b.set(x0 + i, y0 + j, o.outline || R[0]); continue; }
            let c = o.fill || R[3];
            if (!o.flat) {
                const lit = edge(i - 1, j) || edge(i, j - 1);
                const dark = edge(i + 1, j) || edge(i, j + 1);
                if (lit && !dark) c = o.inset ? R[1] : R[4];
                else if (dark && !lit) c = o.inset ? R[4] : R[2];
            }
            b.set(x0 + i, y0 + j, c);
        }
    }
    function mixHex(a, c, t) {
        const A = rgba(a);
        const B = rgba(c);
        const h = (v) => Math.round(v).toString(16).padStart(2, '0');
        return '#' + [0, 1, 2].map((k) => h(A[k] + (B[k] - A[k]) * t)).join('');
    }
    const pastel = (R, t) => R.map((c, i) => mixHex(c, '#ffffff', i === 0 ? t * 0.35 : t));
    const icon = (b, name, x, y, R) => b.sprite(ICONS[name], x, y, R);
    const statIcon = (s) => D.STAT_ICON[s];
    /* glossy pill / rounded fill texture */
    function shapeFill(x, y, w, h, inside, R, vertical) {
        const b = Buf(x, y, w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            if (!inside(i, j)) continue;
            let c;
            if (vertical) c = i < w * 0.3 ? R[4] : i < w * 0.7 ? R[3] : R[2];
            else c = j === 0 ? R[4] : j < h * 0.4 ? R[4] : j < h * 0.8 ? R[3] : R[2];
            b.set(x + i, y + j, c);
        }
        if (!vertical && h >= 4) for (let i = 2; i < w - 2; i++) if (inside(i, 1)) b.set(x + i, y + 1, R[5]);
        if (vertical && w >= 4) for (let j = 2; j < h - 2; j++) if (inside(1, j)) b.set(x + 1, y + j, R[5]);
        return b;
    }
    /* stacked info rows (money / time / coords): draw(b, x, y, w, k, info) paints one row's plate */
    function infoRows(X, P, anchor, startX, startY, dy, draw, alignRight) {
        let y = startY;
        for (const k of Object.keys(X.INFO).filter(X.on)) {
            const info = X.INFO[k];
            const tw = X.textW(info.papi);
            const w = tw + 20;
            const x = alignRight ? startX - w : startX;
            const b = Buf(x - 2, y - 2, w + 4, 16);
            draw(b, x, y, w, X.rampOf(X.iconColor(info.icon)), info);
            P.img(`info_${k}`, b, anchor, 'panel');
            P.text(info.papi, x + 15, y + 3, 'left', anchor, '#ffffff', tw);
            y += dy;
        }
        return y;
    }

    /* ═════════════ Cozy Wood ═════════════ */

    const LEAF = ['#0e2410', '#1f4a1c', '#2f6e28', '#47963a', '#6fbf55', '#a6e283'];
    const FLOWERS = ['#e8364a', '#ffd23a', '#4aa8ff', '#ff8ad8', '#ffffff'];
    function grass(b, x, y, w, seed) {
        // a ragged strip of grass blades standing on y (pointing up), with a few flowers
        let s = seed || 7;
        const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
        for (let i = 0; i < w; i++) {
            const h = 1 + Math.floor(r() * 3);
            for (let k = 0; k < h; k++) b.set(x + i, y - k, k === h - 1 ? LEAF[4] : LEAF[3]);
            b.set(x + i, y + 1, LEAF[1]);
        }
        for (let i = 2; i < w - 2; i += 5 + Math.floor(r() * 5)) {
            const c = FLOWERS[Math.floor(r() * FLOWERS.length)];
            b.set(x + i, y - 4, c); b.set(x + i - 1, y - 3, c); b.set(x + i + 1, y - 3, c); b.set(x + i, y - 2, c);
            b.set(x + i, y - 3, '#ffe680');
        }
    }
    function bush(b, x, y, w, h, seed) {
        blob(b, x, y, w, h, (i, j) => {
            const cx = (w - 1) / 2;
            const nx = (i - cx) / (w / 2);
            const ny = (j - h) / h;
            const wob = 0.12 * Math.sin(i * 1.7 + seed) + 0.1 * Math.cos(j * 2.3);
            return nx * nx + ny * ny <= 1 + wob;
        }, LEAF);
        for (let k = 0; k < 4; k++) {
            const fx = x + 3 + ((k * 7 + seed * 3) % (w - 6));
            const fy = y + 3 + ((k * 5 + seed) % Math.max(1, h - 5));
            const c = FLOWERS[(k + seed) % 4];
            b.set(fx, fy, c); b.set(fx - 1, fy, c); b.set(fx + 1, fy, c); b.set(fx, fy - 1, c); b.set(fx, fy + 1, c); b.set(fx, fy, '#ffe680');
        }
    }
    function crate(b, x, y, w, h, WD) {
        blob(b, x, y, w, h, () => true, WD);
        for (let j = y + 5; j < y + h - 2; j += 5) b.hl(x + 2, j, w - 4, WD[1]);
        b.vl(x + 3, y + 2, h - 4, WD[2]); b.vl(x + w - 4, y + 2, h - 4, WD[2]);
    }
    function cozy(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const WD = t.metal;   // wood frame
        const BD = t.plate;   // boards / sockets
        const fb = Buf(118, 214, 244, 56);
        // crates + bushes beside the hotbar
        crate(fb, 124, 248, 22, 20, WD); bush(fb, 121, 236, 28, 14, 1);
        crate(fb, 334, 248, 22, 20, WD); bush(fb, 331, 236, 28, 14, 4);
        // shelf with XP groove
        blob(fb, 146, 237, 188, 9, () => true, WD);
        for (let x = 160; x < 330; x += 23) fb.vl(x, 239, 5, WD[2]);
        fb.set(148, 239, WD[5]); fb.set(331, 239, WD[5]);
        if (on('xp')) { fb.rect(152, 240, 176, 3, WD[0]); fb.rect(153, 240, 174, 3, GLASS); }
        const bars = [];
        const logBar = (stat, x, side) => {
            blob(fb, x, 225, 86, 12, rr(86, 12, 4), WD);
            fb.hl(x + 4, 227, 78, WD[4]);
            const gx = side === 'l' ? x + 14 : x + 3;
            fb.rect(gx, 228, 69, 6, WD[0]); fb.rect(gx + 1, 229, 67, 4, GLASS);
            const cx = side === 'l' ? x + 1 : x + 72;
            blob(fb, cx, 224, 14, 14, circle(14), BD);
            icon(fb, statIcon(stat), cx + 2, 226, X.statRamp(stat));
            bars.push({ stat, x: gx + 1, side });
        };
        if (on('hp')) logBar('hp', 149, 'l');
        if (on('food')) logBar('food', 245, 'r');
        grass(fb, 166, 224, 18, 3); grass(fb, 296, 224, 18, 9);
        if (on('level')) {
            // tree-ring log end
            blob(fb, 232, 223, 17, 17, circle(17), ['#3a2410', '#7a5428', '#a87a40', '#d8b078', '#f0d4a0', '#fff0d0']);
            fb.set(240, 231, '#a87a40');
        }
        P.img('frame', fb, A, 'panel');
        if (on('xp')) {
            const f = Buf(153, 240, 174, 3);
            const R = X.statRamp('xp');
            f.hl(153, 240, 174, R[4]); f.hl(153, 241, 174, R[3]); f.hl(153, 242, 174, R[2]);
            P.bar('xp', f, 'left', A);
        }
        for (const r of bars) P.bar(r.stat, shapeFill(r.x, 229, 67, 4, () => true, X.statRamp(r.stat)), r.side === 'l' ? 'left' : 'right', A);
        if (on('level')) P.xp(240.5, 235, A);

        // hanging signboards, top-left
        const TL = 'top_left';
        const infos = Object.keys(X.INFO).filter(on);
        const rows = infos.length + (on('mana') ? 1 : 0);
        const tb = Buf(0, 0, 104, 24 + rows * 15);
        blob(tb, 4, 6, 92, 12, rr(92, 12, 2), WD);
        tb.hl(6, 8, 88, WD[4]);
        grass(tb, 6, 5, 88, 11);
        for (let i = 0; i < rows; i++) {
            const y = 21 + i * 15;
            for (const cx of [14, 84]) for (let k = y - 3; k < y; k++) tb.set(cx, k, k % 2 ? '#5a5f68' : '#9aa0aa');
        }
        P.img('signs_beam', tb, TL, 'panel');
        if (on('name')) P.text('%player_name%', 10, 9, 'left', TL, '#fff3d6', 80);
        let y = 21;
        if (on('mana')) {
            const b = Buf(6, y - 1, 92, 15);
            blob(b, 8, y, 84, 12, rr(84, 12, 2), WD, { fill: BD[3] });
            icon(b, 'mana', 10, y + 1, X.statRamp('mana'));
            segTrack(b, 22, y + 4, 64, 4, 4, false);
            P.img('sign_mana', b, TL, 'panel');
            P.bar('mana', segFill(22, y + 4, 64, 4, 4, X.statRamp('mana'), false), 'left', TL);
            y += 15;
        }
        for (const k of infos) {
            const info = X.INFO[k];
            const tw = X.textW(info.papi);
            const w = Math.max(84, tw + 22);
            const b = Buf(6, y - 1, w + 4, 15);
            blob(b, 8, y, w, 12, rr(w, 12, 2), WD, { fill: BD[3] });
            icon(b, info.icon, 10, y + 1, X.rampOf(X.iconColor(info.icon)));
            P.img(`sign_${k}`, b, TL, 'panel');
            P.text(info.papi, 23, y + 3, 'left', TL, '#fff3d6', tw);
            y += 15;
        }
        return P.parts;
    }
    function cozyHotbar(X) {
        const t = X.t;
        return sheet((b) => {
            framedSlots(b, t.metal, t.inset, false);
            for (let x = 3; x < 180; x += 9) b.set(x, 1, t.metal[2]);
        }, (b) => ringSel(b, ['#2a1e04', '#7a5a10', '#c8961e', '#ffd23a', '#ffe98a', '#fffbe0']));
    }

    /* ═════════════ Neon ═════════════ */

    const BG = [8, 12, 24, 0.74];
    const TRACK = [24, 32, 52, 1];
    /* polygon with cut corners: cut = [tl, tr, br, bl] */
    const cutBox = (w, h, cut) => (i, j) => {
        const [a, bq, c, d] = cut;
        if (i + j < a) return false;
        if ((w - 1 - i) + j < bq) return false;
        if ((w - 1 - i) + (h - 1 - j) < c) return false;
        if (i + (h - 1 - j) < d) return false;
        return true;
    };
    function neonPanel(b, x, y, w, h, cut, N) {
        blob(b, x, y, w, h, cutBox(w, h, cut), N, { outline: N[3], flat: true, fill: BG });
        // brighter corner ticks
        b.set(x + cut[0], y, N[5]); b.set(x, y + cut[0], N[5]);
    }
    function neon(X) {
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const N = X.accent;
        const side = (big, thin, x, mirror) => {
            if (!on(big) && !on(thin)) return;
            const b = Buf(x - 1, 233, 64, 37);
            neonPanel(b, x, 236, 60, 32, mirror ? [0, 7, 0, 0] : [7, 0, 0, 0], N);
            const bx = mirror ? x + 4 : x + 15;
            const ix = mirror ? x + 47 : x + 4;
            if (on(big)) {
                icon(b, statIcon(big), ix, 239, X.statRamp(big));
                b.rect(bx, 241, 41, 5, TRACK);
            }
            if (on(thin)) {
                icon(b, statIcon(thin), ix, 255, X.statRamp(thin));
                b.rect(bx, 258, 41, 3, TRACK);
            }
            P.img(`${big}_panel`, b, A, 'panel', true);
            const dir = mirror ? 'right' : 'left';
            if (on(big)) {
                P.bar(big, segFill(bx, 241, 41, 5, 3, X.statRamp(big), mirror), dir, A);
                const vp = X.valuePapi(big);
                if (vp) P.text(vp, mirror ? x + 4 : x + 15, 248, 'left', A, '#ffffff', 40);
            }
            if (on(thin)) P.bar(thin, segFill(bx, 258, 41, 3, 3, X.statRamp(thin), mirror), dir, A);
        };
        side('hp', 'armor', 86, false);
        side('food', 'air', 334, true);
        if (on('xp')) {
            const b = Buf(149, 240, 182, 5);
            b.rect(149, 243, 182, 2, TRACK);
            for (let x = 149; x <= 330; x += 20) b.vl(x, 241, 2, N[2]);
            P.img('xp_track', b, A, 'panel', true);
            const f = Buf(149, 243, 182, 2);
            f.hl(149, 243, 182, N[4]); f.hl(149, 244, 182, N[3]);
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) {
            const b = Buf(230, 228, 21, 13);
            blob(b, 230, 228, 21, 13, cutBox(21, 13, [4, 4, 4, 4]), N, { outline: N[3], flat: true, fill: [8, 12, 24, 0.9] });
            P.img('level_hex', b, A, 'icon', true);
            P.xp(240.5, 238, A);
        }
        // top-left: name + underline (+ mana)
        const TL = 'top_left';
        if (on('name') || on('mana')) {
            const b = Buf(4, 4, 92, 26);
            if (on('name')) {
                b.rect(6, 17, 70, 1, N[3]); b.rect(76, 16, 3, 3, N[4]); b.set(6, 16, N[5]);
            }
            if (on('mana')) { icon(b, 'mana', 6, 20, X.statRamp('mana')); b.rect(17, 23, 61, 3, TRACK); }
            P.img('name_line', b, TL, 'panel', true);
            if (on('name')) P.text('%player_name%', 8, 9, 'left', TL, '#ffffff', 68);
            if (on('mana')) P.bar('mana', segFill(17, 23, 61, 3, 3, X.statRamp('mana'), false), 'left', TL);
        }
        // top-right: one panel listing the infos
        const TR = 'top_right';
        const infos = Object.keys(X.INFO).filter(on);
        if (infos.length) {
            const w = Math.max(...infos.map((k) => X.textW(X.INFO[k].papi))) + 22;
            const h = infos.length * 11 + 5;
            const x = 474 - w;
            const b = Buf(x, 6, w, h);
            neonPanel(b, x, 6, w, h, [0, 0, 5, 0], N);
            infos.forEach((k, i) => icon(b, X.INFO[k].icon, x + 4, 9 + i * 11, X.rampOf(X.iconColor(X.INFO[k].icon))));
            P.img('info_panel', b, TR, 'panel', true);
            infos.forEach((k, i) => P.text(X.INFO[k].papi, x + 16, 11 + i * 11, 'left', TR, '#ffffff', w - 18));
        }
        return P.parts;
    }
    function neonHotbar(X) {
        const N = X.accent;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, BG);
            for (let i = 0; i < 9; i++) {
                const x = 2 + i * 20;
                for (const [cx, cy, dx, dy] of [[x, 2, 1, 1], [x + 17, 2, -1, 1], [x, 19, 1, -1], [x + 17, 19, -1, -1]]) {
                    b.set(cx, cy, N[3]); b.set(cx + dx, cy, N[2]); b.set(cx + 2 * dx, cy, N[2]); b.set(cx, cy + dy, N[2]); b.set(cx, cy + 2 * dy, N[2]);
                }
            }
        }, (b) => {
            b.hl(1, 1, 22, N[4]); b.hl(1, 22, 22, N[4]); b.vl(1, 1, 22, N[4]); b.vl(22, 1, 22, N[4]);
            for (const [x, y] of [[0, 0], [20, 0], [0, 20], [20, 20]]) b.rect(x, y, 4, 4, N[5]);
        });
    }

    /* ═════════════ Steampunk ═════════════ */

    const COPPER = ['#2a0e06', '#5a2010', '#8a3a1c', '#b85a32', '#e08a5c', '#ffc8a0'];
    const IRON = ['#0e0f12', '#1e2026', '#30333b', '#454952', '#626772', '#8a909c'];
    const SLOTS_DARK = ['#07080a', '#101216', '#16181d', '#1d2026', '#262a31', '#7a808c'];
    const TUBE_GLASS = '#0f1418';
    function tube(b, cx, top, bot, w, BR) {
        const x = cx - Math.floor(w / 2);
        // glass
        b.rect(x, top, w, bot - top, IRON[0]);
        b.rect(x + 1, top, w - 2, bot - top, TUBE_GLASS);
        // caps
        blob(b, x - 2, top - 5, w + 4, 6, rr(w + 4, 6, 1), BR);
        blob(b, x - 2, bot - 1, w + 4, 6, rr(w + 4, 6, 1), BR);
        b.set(x, top - 3, BR[5]); b.set(x, bot + 1, BR[5]);
        // straps
        for (let y = top + 8; y < bot - 4; y += 10) { b.hl(x, y, w, BR[2]); b.set(x, y, BR[4]); }
        return { x: x + 1, y: top, w: w - 2, h: bot - top };
    }
    function pipeH(b, x, y, w) {
        b.hl(x, y, w, COPPER[0]); b.hl(x, y + 1, w, COPPER[4]); b.hl(x, y + 2, w, COPPER[3]); b.hl(x, y + 3, w, COPPER[0]);
    }
    function steam(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const BR = t.metal;
        const fb = Buf(104, 208, 272, 62);
        const tubes = [];
        const big = (stat, cx) => { if (on(stat)) tubes.push({ stat, g: tube(fb, cx, 231, 262, 11, BR), cx, big: true }); };
        const small = (stat, cx) => { if (on(stat)) tubes.push({ stat, g: tube(fb, cx, 240, 262, 7, BR), cx }); };
        if (on('armor')) pipeH(fb, 120, 250, 12);
        if (on('air')) pipeH(fb, 348, 250, 12);
        if (on('hp')) pipeH(fb, 140, 254, 10);
        if (on('food')) pipeH(fb, 330, 254, 10);
        small('armor', 119); big('hp', 135); big('food', 345); small('air', 361);
        // value plates above the big tubes
        for (const tb of tubes.filter((q) => q.big)) {
            blob(fb, tb.cx - 9, 213, 19, 11, rr(19, 11, 1), IRON);
            fb.hl(tb.cx - 8, 214, 17, BR[3]);
        }
        // XP pipe across the hotbar with a glass window
        blob(fb, 146, 237, 188, 9, rr(188, 9, 2), BR);
        for (const x of [149, 330, 196, 284]) { fb.set(x, 239, BR[5]); fb.set(x, 243, BR[1]); }
        if (on('xp')) { fb.rect(154, 239, 172, 5, BR[0]); fb.rect(155, 240, 170, 3, TUBE_GLASS); }
        if (on('level')) {
            blob(fb, 229, 220, 23, 23, circle(23), BR);
            blob(fb, 232, 223, 17, 17, circle(17), IRON, { inset: true });
            for (const [dx, dy] of [[0, -7], [7, 0], [-7, 0], [5, -5], [-5, -5]]) fb.set(240 + dx, 231 + dy, BR[4]);
        }
        P.img('frame', fb, A, 'panel');
        for (const tb of tubes) {
            P.bar(tb.stat, shapeFill(tb.g.x, tb.g.y, tb.g.w, tb.g.h, () => true, X.statRamp(tb.stat), true), 'bottom', A);
            const vp = VALUE_ONLY[tb.stat];
            if (tb.big && vp && X.state.values !== false) P.text(vp, tb.cx + 0.5, 220, 'center', A, '#ffe9b0', 16);
        }
        if (on('xp')) {
            const f = Buf(155, 240, 170, 3);
            const R = X.statRamp('xp');
            f.hl(155, 240, 170, R[4]); f.hl(155, 241, 170, R[3]); f.hl(155, 242, 170, R[2]);
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) P.xp(240.5, 235, A);
        // brass plaques top-right
        infoRows(X, P, 'top_right', 474, 6, 14, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 12, rr(w, 12, 1), BR);
            b.rect(x + 2, y + 2, w - 4, 8, IRON[2]);
            b.set(x + 1, y + 1, BR[5]); b.set(x + w - 2, y + 1, BR[5]);
            icon(b, info.icon, x + 3, y + 1, R);
        }, true);
        return P.parts;
    }
    function steamHotbar(X) {
        const BR = X.t.metal;
        return sheet((b) => {
            framedSlots(b, IRON, SLOTS_DARK, false);
            b.hl(1, 1, 180, BR[3]);
            for (let i = 0; i <= 9; i++) { b.set(1 + i * 20, 1, BR[5]); b.set(1 + i * 20, 20, BR[4]); }
        }, (b) => ringSel(b, BR));
    }

    /* ═════════════ Gothic ═════════════ */

    const BONE = ['#2a2418', '#5a5040', '#8a8070', '#bdb4a0', '#e0d8c4', '#fffaf0'];
    /* shade a free-form mask (Set of 'x,y'): outline, lit top-left, dark bottom-right */
    function maskBlob(b, pts, R) {
        const has = (x, y) => pts.has(x + ',' + y);
        const edge = (x, y) => has(x, y) && (!has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1));
        for (const k of pts) {
            const [x, y] = k.split(',').map(Number);
            let c = R[3];
            if (edge(x, y)) c = R[0];
            else if (edge(x, y - 1) || edge(x - 1, y)) c = R[4];
            else if (edge(x, y + 1) || edge(x + 1, y)) c = R[2];
            b.set(x, y, c);
        }
    }
    function horn(b, x0, y0, dir) {
        // curved bone horn: discs that shrink along a curve going outward and up
        const pts = new Set();
        for (let k = 0; k <= 22; k += 0.5) {
            const cx = x0 + dir * k;
            const cy = y0 - (k * k) / 17;
            const r = 3.6 * (1 - k / 25) + 0.4;
            for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
                for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) pts.add(x + ',' + y);
                }
            }
        }
        maskBlob(b, pts, BONE);
        // ridges
        for (let k = 3; k < 18; k += 4) b.set(Math.round(x0 + dir * k), Math.round(y0 - (k * k) / 17 + 1), BONE[2]);
    }
    function gothic(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const IR = t.metal;
        const DK = t.plate;
        const GM = t.gemRamp || X.rampOf('#ef3b4a');
        const right = on('mana') ? 'mana' : 'air';
        const fb = Buf(120, 200, 240, 70);
        horn(fb, 150, 254, -1); horn(fb, 330, 254, 1);
        const wing = (stat, x, mirror) => {
            if (!on(stat)) return null;
            blob(fb, x, 231, 76, 10, cutBox(76, 10, mirror ? [0, 3, 3, 0] : [3, 0, 0, 3]), IR);
            fb.rect(mirror ? x + 3 : x + 5, 233, 68, 6, GLASS);
            // spikes on the outer end
            const ex = mirror ? x + 75 : x;
            for (let k = 0; k < 4; k++) { fb.set(ex + (mirror ? k : -k), 235, IR[k < 3 ? 3 : 0]); fb.set(ex + (mirror ? k : -k), 236, IR[2]); }
            return { stat, x: mirror ? x + 3 : x + 5 };
        };
        const wl = wing('food', 152, false);
        const wr = wing(right, 252, true);
        if (on('armor')) for (let i = 0; i < 10; i++) fb.sprite(PIPS.armor, 156 + i * 7, 223, EMPTY);
        if (on('xp')) { fb.rect(149, 242, 182, 4, IR[0]); fb.rect(150, 243, 180, 2, GLASS); }
        if (on('hp')) {
            blob(fb, 225, 214, 31, 31, circle(31), IR);
            blob(fb, 228, 217, 25, 25, circle(25), DK, { inset: true });
            for (let j = 0; j < 23; j++) for (let i = 0; i < 23; i++) if (circle(23)(i, j)) fb.set(229 + i, 218 + j, GLASS);
            // side spikes
            for (let k = 0; k < 5; k++) { fb.set(224 - k, 229 - k, IR[3]); fb.set(224 - k, 230 - k, IR[1]); fb.set(256 + k, 229 - k, IR[3]); fb.set(256 + k, 230 - k, IR[1]); }
        }
        if (on('level')) {
            blob(fb, 231, 200, 19, 19, (i, j) => Math.abs(i - 9) + Math.abs(j - 9) <= 9, GM);
            blob(fb, 234, 203, 13, 13, (i, j) => Math.abs(i - 6) + Math.abs(j - 6) <= 6, ['#050405', '#0c0a0c', '#141114', '#1c181c', '#262026', '#322a32'], { inset: true });
        }
        P.img('frame', fb, A, 'panel');
        if (on('hp')) {
            P.bar('hp', shapeFill(229, 218, 23, 23, circle(23), X.statRamp('hp'), true), 'bottom', A);
            if (X.state.values !== false) P.text(VALUE_ONLY.hp, 240.5, 232, 'center', A, '#ffffff', 16);
        }
        for (const w of [wl, wr].filter(Boolean)) {
            P.bar(w.stat, shapeFill(w.x, 233, 68, 6, () => true, X.statRamp(w.stat)), w === wr ? 'right' : 'left', A);
        }
        if (on('armor')) {
            const pb = Buf(156, 223, 70, 7);
            for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 156 + i * 7, 223, X.statRamp('armor'));
            P.bar('armor', pb, 'left', A);
        }
        if (on('xp')) {
            const f = Buf(150, 243, 180, 2);
            const R = X.statRamp('xp');
            f.hl(150, 243, 180, R[4]); f.hl(150, 244, 180, R[2]);
            P.bar('xp', f, 'left', A);
        }
        if (on('level')) P.xp(240.5, 212, A);
        // dark plates with a gem-red edge, top-right
        infoRows(X, P, 'top_right', 474, 6, 13, (b, x, y, w, R, info) => {
            b.rect(x, y, w, 11, DK[1]); b.hl(x, y, w, DK[3]); b.hl(x, y + 10, w, DK[0]);
            b.rect(x + w - 2, y, 2, 11, GM[3]);
            icon(b, info.icon, x + 3, y + 1, R);
        }, true);
        return P.parts;
    }
    function gothicHotbar(X) {
        const t = X.t;
        return sheet((b) => framedSlots(b, t.metal, t.inset, false), (b) => ringSel(b, t.gemRamp || X.rampOf('#ef3b4a')));
    }

    /* ═════════════ Kawaii ═════════════ */

    function star(d) {
        const c = (d - 1) / 2;
        return (i, j) => {
            const x = i - c;
            const y = j - c - 0.6;
            const a = Math.atan2(y, x);
            const r = Math.hypot(x, y);
            const k = Math.cos(2.5 * (a + Math.PI / 2));
            const lim = (c + 0.6) * (0.55 + 0.45 * Math.max(0, k) ** 0.6);
            return r <= lim;
        };
    }
    const STAR = ['#6a4a00', '#b88a10', '#e8b820', '#ffd84a', '#ffec9a', '#fffbe0'];
    function sparkle(b, x, y, c) { b.set(x, y, '#ffffff'); b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y - 1, c); b.set(x, y + 1, c); }
    function bubble(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const A = 'bottom_middle';
        const PL = pastel(t.plate, 0.45);
        const OUT = t.plate[1];
        const fb = Buf(136, 218, 210, 30);
        const pills = [];
        const pillBar = (stat, x, iconX) => {
            if (!on(stat)) return;
            blob(fb, x, 231, 76, 10, pill(76, 10), PL, { outline: OUT });
            blob(fb, x + 2, 233, 72, 6, pill(72, 6), pastel(t.plate, 0.15), { flat: true, outline: pastel(t.plate, 0.1)[1] });
            blob(fb, iconX, 228, 15, 15, circle(15), ['#000000', '#e8e8f0', '#f0f0f6', '#ffffff', '#ffffff', '#ffffff'], { outline: OUT });
            icon(fb, statIcon(stat), iconX + 3, 231, X.statRamp(stat));
            pills.push({ stat, x: x + 2 });
        };
        pillBar('hp', 160, 148);
        pillBar('food', 244, 317);
        if (on('xp')) blob(fb, 149, 242, 182, 5, pill(182, 5), PL, { outline: OUT, flat: true, fill: pastel(t.plate, 0.15)[3] });
        if (on('level')) {
            blob(fb, 231, 221, 19, 19, circle(19), ['#000000', '#e8e8f0', '#f0f0f6', '#ffffff', '#ffffff', '#ffffff'], { outline: OUT });
            fb.sprite(['...o...', '..obo..', 'oobwboo', '.obbbo.', '.obobo.', '.oo.oo.'], 244, 217, STAR);
        }
        sparkle(fb, 143, 224, PL[4]); sparkle(fb, 338, 226, PL[4]); sparkle(fb, 222, 225, '#fff2a0'); sparkle(fb, 259, 223, '#fff2a0');
        P.img('frame', fb, A, 'panel');
        for (const p of pills) P.bar(p.stat, shapeFill(p.x + 1, 234, 70, 4, pill(70, 4), X.statRamp(p.stat)), p.stat === 'food' ? 'right' : 'left', A);
        if (on('xp')) P.bar('xp', shapeFill(150, 243, 180, 3, pill(180, 3), X.statRamp('xp')), 'left', A);
        if (on('level')) P.xp(240.5, 234, A);
        // top-left name bubble (+ mana pill)
        const TL = 'top_left';
        if (on('name') || on('mana')) {
            const b = Buf(2, 2, 96, 32);
            if (on('name')) {
                blob(b, 4, 4, 80, 13, pill(80, 13), PL, { outline: OUT });
                b.sprite(['.oo.oo.', 'obbobbo', 'obbbbbo', '.obbbo.', '..obo..', '...o...'], 8, 7, ['#7a1030', '#c02050', '#e03a6a', '#ff5a8a', '#ff9ab8', '#ffffff']);
            }
            if (on('mana')) {
                blob(b, 4, 19, 70, 9, pill(70, 9), PL, { outline: OUT });
                b.rect(10, 22, 58, 3, pastel(t.plate, 0.15)[2]);
            }
            sparkle(b, 88, 8, '#fff2a0');
            P.img('name_bubble', b, TL, 'panel');
            if (on('name')) P.text('%player_name%', 17, 7, 'left', TL, OUT, 64);
            if (on('mana')) P.bar('mana', shapeFill(10, 22, 58, 3, () => true, X.statRamp('mana')), 'left', TL);
        }
        infoRows(X, P, 'top_right', 474, 6, 15, (b, x, y, w, R, info) => {
            blob(b, x, y, w, 13, pill(w, 13), PL, { outline: OUT });
            icon(b, info.icon, x + 4, y + 2, R);
        }, true);
        // info text on pastel needs a dark colour
        for (const p of P.parts) if (p.t === 'text' && p.anchor === 'top_right') { p.color = OUT; p.shadow = false; p.y += 1; }
        return P.parts;
    }
    function bubbleHotbar(X) {
        const t = X.t;
        const PL = pastel(t.plate, 0.45);
        const OUT = t.plate[1];
        return sheet((b) => {
            blob(b, 0, 0, 182, 22, rr(182, 22, 4), PL, { outline: OUT });
            for (let i = 0; i < 9; i++) {
                blob(b, 2 + i * 20, 2, 18, 18, rr(18, 18, 3), pastel(t.plate, 0.75), { outline: '#ffffff', inset: true });
            }
        }, (b) => {
            const outer = rr(24, 24, 5);
            const inner = rr(20, 20, 4);
            for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
                if (!outer(i, j)) continue;
                if (i >= 2 && j >= 2 && i < 22 && j < 22 && inner(i - 2, j - 2)) continue;
                const edge = !outer(i - 1, j) || !outer(i + 1, j) || !outer(i, j - 1) || !outer(i, j + 1);
                b.set(i, j, edge ? OUT : '#ffffff');
            }
            b.set(19, 3, '#ffd84a'); b.set(20, 3, '#ffd84a'); b.set(19, 2, '#ffd84a'); b.set(18, 3, '#ffd84a'); b.set(19, 4, '#ffd84a');
        });
    }

    // helpers for later sets (hudforge_v2_set3.js …)
    Object.assign(HudForgeV2.lib, { blob, rr, circle, pill, cutBox, maskBlob, shapeFill, infoRows, mixHex, pastel, icon, statIcon, sparkle, grass, bush, LEAF, FLOWERS, STAR, BONE, COPPER, IRON, SLOTS_DARK, BG, TRACK, tube, pipeH, horn });
    HudForgeV2.register('cozy', { plan: cozy, hotbar: cozyHotbar });
    HudForgeV2.register('neon', { plan: neon, hotbar: neonHotbar });
    HudForgeV2.register('steam', { plan: steam, hotbar: steamHotbar });
    HudForgeV2.register('gothic', { plan: gothic, hotbar: gothicHotbar });
    HudForgeV2.register('bubble', { plan: bubble, hotbar: bubbleHotbar });
})();
