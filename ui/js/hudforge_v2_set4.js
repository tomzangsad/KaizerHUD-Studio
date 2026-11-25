/*
 * HUD Forge v2 — set 4 (2026-11-21): new shapes, not recolours
 *   oathblade  sword XP bar across the hotbar, pommel gem = level
 *   wyrmwing   dragon wings at the hotbar ends, horned head = level
 *   grimoire   open spellbook bottom-left: bars on the left page, name/level/XP on the right
 *   sovereign  crown over the hotbar, velvet bar cushion
 *   starfall   crescent moon (HP) + four-point star (Food) that fill from the bottom
 *   mech       tall armoured side gauges, hex level core
 *   fieldops   tactical cluster bottom-left + compass strip on top
 *   warbar     MMO action bar: wide plate, thick bars with numbers on both sides
 * Loaded after hudforge_v2_set3.js; uses HudForgeV2.lib.
 */
(function () {
    'use strict';
    if (!window.HudForgeV2 || !HudForgeV2.lib.blob) return;
    const D = window.HudForgeData;
    const L = HudForgeV2.lib;
    const { Buf, mk, sheet, ringSel, framedSlots, blob, rr, circle, maskBlob, shapeFill, infoRows, mixHex, icon, statIcon, sparkle,
        ICONS, PIPS, EMPTY, GLASS, INK, INK2, TINY, VALUE_ONLY } = L;
    const A = 'bottom_middle';

    const STEEL = ['#14161c', '#2e333d', '#4d5563', '#7a8494', '#b4bcc8', '#eef2f6'];
    const LEATHER = ['#1a0c06', '#3a1e10', '#5a3020', '#7a4630', '#9c6444', '#c08a64'];
    const PARCH = ['#4a3418', '#8a6a3a', '#bfa06a', '#e2cc98', '#f2e2b8', '#fff6dc'];
    const VELVET = ['#1a0610', '#3a0c22', '#5e1234', '#861c48', '#b0305e', '#d85a80'];
    const NIGHT = ['#04060f', '#0a1024', '#121a38', '#1c2650', '#2c3a70', '#4a5c9a'];
    const OLIVE = ['#0e100a', '#20241a', '#33392a', '#4a523c', '#667052', '#8e9a74'];
    const HAZARD = ['#1a1404', '#3a2c06', '#8a6a0a', '#e0b020', '#f4d050', '#fff0a0'];

    /* ───────────── shared ───────────── */

    function pipRow(X, P, fb, stat, x, y, dir) {
        if (!X.on(stat)) return;
        for (let i = 0; i < 10; i++) fb.sprite(PIPS[stat], x + i * 8, y, EMPTY);
        const pb = Buf(x, y, 79, 7);
        for (let i = 0; i < 10; i++) pb.sprite(PIPS[stat], x + i * 8, y, X.statRamp(stat));
        P.bar(stat, pb, dir || 'left', A);
    }
    function valueText(X, P, stat, x, y, anchor, color, shadow) {
        if (X.state.values === false) return;
        const vp = VALUE_ONLY[stat] || X.valuePapi(stat);
        if (!vp) return;
        P.text(vp, x, y, 'center', anchor || A, color || '#ffffff', 26);
        if (shadow === false) P.parts[P.parts.length - 1].shadow = false;
    }
    function inkText(P, from, color) {
        for (let i = from; i < P.parts.length; i++) if (P.parts[i].t === 'text') { P.parts[i].shadow = false; if (color) P.parts[i].color = color; }
    }
    /** inside test for a polygon given as [[x,y]…] (screen px) */
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
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) {
            const x = Math.round(x0 + ((x1 - x0) * k) / n);
            const y = Math.round(y0 + ((y1 - y0) * k) / n);
            b.set(x, y, c);
            if (w > 1) { b.set(x + 1, y, c); b.set(x, y + 1, c); }
        }
    }
    /** plain bevelled channel (frame ramp FR, glass inside); returns the inner box */
    function channel(b, x, y, w, h, FR, TR) {
        b.bevel(x, y, w, h, FR);
        if (TR) { b.hl(x + 1, y + 1, w - 2, TR[4]); b.hl(x + 1, y + h - 2, w - 2, TR[2]); }
        b.rect(x + 2, y + 2, w - 4, h - 4, FR[0]);
        b.rect(x + 3, y + 3, w - 6, h - 6, GLASS);
        return { x: x + 3, y: y + 3, w: w - 6, h: h - 6 };
    }
    const plainFill = (X, stat, c) => shapeFill(c.x, c.y, c.w, c.h, () => true, X.statRamp(stat));
    function slotsHotbar(X, FR, SL, SELR, nums, deco) {
        return sheet((b) => { framedSlots(b, FR, SL, nums); if (deco) deco(b); }, (b) => ringSel(b, SELR));
    }

    /* ═════════════ Oathblade — a sword across the hotbar ═════════════ */

    function oathblade(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const GOLD = t.metal;
        const fb = Buf(100, 206, 260, 64);
        // blade: x 150..330, tip to 344, y 235..244; the fuller (groove) holds the XP
        const bx = 150, by = 235, bw = 180, bh = 10;
        const blade = poly([[bx, by], [bx + bw, by], [bx + bw + 14, by + bh / 2], [bx + bw, by + bh], [bx, by + bh]]);
        const pts = new Set();
        for (let y = by - 1; y <= by + bh + 1; y++) for (let x = bx; x <= bx + bw + 15; x++) if (blade(x + 0.5, y + 0.5)) pts.add(`${x},${y}`);
        maskBlob(fb, pts, STEEL);
        fb.hl(bx + 2, by + 1, bw + 4, STEEL[5]);
        if (on('xp')) { fb.rect(bx + 6, by + 3, bw - 10, 4, STEEL[0]); fb.rect(bx + 7, by + 4, bw - 12, 2, GLASS); }
        else fb.hl(bx + 6, by + 5, bw - 10, STEEL[2]);
        // crossguard, grip, pommel
        blob(fb, 141, 227, 9, 26, rr(9, 26, 3), GOLD);
        blob(fb, 139, 225, 5, 5, circle(5), GOLD);
        blob(fb, 139, 249, 5, 5, circle(5), GOLD);
        blob(fb, 121, 236, 21, 8, () => true, LEATHER);
        for (let x = 123; x < 140; x += 3) fb.vl(x, 237, 6, LEATHER[1]);
        blob(fb, 104, 230, 19, 19, circle(19), GOLD);
        blob(fb, 107, 233, 13, 13, circle(13), t.gemRamp || X.accent, { inset: true });
        fb.set(110, 236, '#ffffff');
        // HP / Food bars above the blade, with shield tiles at the outer ends
        const bars = [];
        const tile = (x, stat) => {
            blob(fb, x, 222, 13, 14, poly([[x, 222], [x + 13, 222], [x + 13, 229], [x + 6.5, 236], [x, 229]]), GOLD);
            icon(fb, statIcon(stat), x + 2, 223, X.statRamp(stat));
        };
        if (on('hp')) { bars.push(['hp', channel(fb, 166, 224, 72, 9, t.plate, GOLD), 'left']); tile(152, 'hp'); }
        if (on('food')) { bars.push(['food', channel(fb, 242, 224, 72, 9, t.plate, GOLD), 'right']); tile(315, 'food'); }
        P.img('frame', fb, A, 'panel');
        // armor / air pips sit on top of the bars
        const pb = Buf(160, 213, 170, 8);
        if (on('armor')) for (let i = 0; i < 10; i++) pb.sprite(PIPS.armor, 166 + i * 7, 214, EMPTY);
        if (on('air')) for (let i = 0; i < 10; i++) pb.sprite(PIPS.air, 251 + i * 7, 214, EMPTY);
        if (on('armor') || on('air')) P.img('pip_tracks', pb, A, 'panel', true);
        if (on('armor')) { const f = Buf(166, 214, 70, 7); for (let i = 0; i < 10; i++) f.sprite(PIPS.armor, 166 + i * 7, 214, X.statRamp('armor')); P.bar('armor', f, 'left', A); }
        if (on('air')) { const f = Buf(251, 214, 70, 7); for (let i = 0; i < 10; i++) f.sprite(PIPS.air, 251 + i * 7, 214, X.statRamp('air')); P.bar('air', f, 'right', A); }
        for (const [stat, c, dir] of bars) P.bar(stat, plainFill(X, stat, c), dir, A);
        if (on('xp')) P.bar('xp', shapeFill(bx + 7, by + 4, bw - 12, 2, () => true, X.statRamp('xp')), 'left', A);
        if (on('level')) P.xp(113.5, 243, A);
        X.infoStrips(P);
        return P.parts;
    }
    function oathbladeHotbar(X) {
        return slotsHotbar(X, STEEL, X.t.inset, X.t.metal, false);
    }

    /* ═════════════ Wyrmwing — dragon wings + horned head ═════════════ */

    function wing(b, rootX, dir, MEM, BONE) {
        // fingertips (left wing; mirrored with dir = +1 for the right one)
        const tip = [[-52, -46], [-66, -22], [-60, 2], [-40, 12]];
        const P0 = [rootX, 250];
        const pts = [P0, ...tip.map(([dx, dy]) => [rootX + dx * -dir, 250 + dy])];
        const inside = poly([P0, [rootX + 4 * -dir * -1, 236], ...pts.slice(1), [rootX - 10 * -dir, 262]]);
        const set = new Set();
        const scallop = tip.slice(0, -1).map(([dx, dy], i) => {
            const [ex, ey] = tip[i + 1];
            return [rootX + ((dx + ex) / 2) * -dir * 1.1, 250 + ((dy + ey) / 2) * 1.1, Math.hypot(ex - dx, ey - dy) * 0.3];
        });
        for (let y = 196; y <= 266; y++) for (let x = rootX - 70; x <= rootX + 70; x++) {
            if (!inside(x + 0.5, y + 0.5)) continue;
            if (scallop.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r)) continue;
            set.add(`${x},${y}`);
        }
        maskBlob(b, set, MEM);
        // veins: darker lines across the membrane, then the bones
        for (const [dx, dy] of tip) line(b, P0[0], P0[1], rootX + dx * -dir, 250 + dy, BONE[2], 2);
        for (const [dx, dy] of tip) line(b, P0[0], P0[1] - 1, rootX + dx * -dir, 249 + dy, BONE[4], 1);
        // claw at the top finger
        const [cx, cy] = [rootX + tip[0][0] * -dir, 250 + tip[0][1]];
        blob(b, cx - 2, cy - 3, 5, 5, circle(5), BONE);
        b.set(cx - 2 * dir, cy - 4, BONE[5]); b.set(cx - 3 * dir, cy - 5, BONE[4]);
    }
    function wyrmwing(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const MEM = t.plate;
        const BONE = ['#2a2418', '#5a5040', '#8a8070', '#bdb4a0', '#e0d8c4', '#fffaf0'];
        const SC = t.metal;
        const fb = Buf(70, 190, 340, 80);
        wing(fb, 150, -1, MEM, BONE);
        wing(fb, 330, 1, MEM, BONE);
        // scaled ledge with the two bars
        blob(fb, 146, 232, 188, 13, () => true, SC);
        for (let x = 150; x < 330; x += 4) { fb.set(x, 234, SC[4]); fb.set(x + 2, 236, SC[2]); }
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 150, 230, 74, 11, SC, null), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 256, 230, 74, 11, SC, null), 'right']);
        if (on('xp')) { fb.rect(150, 241, 180, 4, SC[0]); fb.rect(151, 242, 178, 2, GLASS); }
        // horned head in the middle
        const head = poly([[228, 236], [226, 222], [232, 214], [240, 211], [248, 214], [254, 222], [252, 236], [240, 243]]);
        blob(fb, 224, 210, 33, 34, (i, j) => head(224 + i + 0.5, 210 + j + 0.5), MEM);
        const hornL = new Set();
        const hornR = new Set();
        for (let k = 0; k < 14; k++) {
            const x = 230 - Math.round(k * 0.75);
            const y = 217 - Math.round(k * 0.8 + (k * k) / 18);
            const w = Math.max(1, 4 - Math.floor(k / 4));
            for (let a = 0; a < w; a++) for (let c = 0; c < w; c++) { hornL.add(`${x - a},${y + c}`); hornR.add(`${480 - x + a},${y + c}`); }
        }
        maskBlob(fb, hornL, BONE); maskBlob(fb, hornR, BONE);
        // eyes + the level gem on the brow
        fb.rect(231, 226, 3, 2, '#ffd040'); fb.rect(246, 226, 3, 2, '#ffd040');
        fb.set(232, 226, '#ffffff'); fb.set(247, 226, '#ffffff');
        if (on('level')) { blob(fb, 233, 213, 15, 11, rr(15, 11, 3), SC); fb.rect(235, 215, 11, 7, '#120a06'); }
        // nostrils
        fb.set(237, 238, MEM[0]); fb.set(243, 238, MEM[0]);
        P.img('frame', fb, A, 'panel');
        const pb = Buf(150, 222, 180, 8);
        if (on('armor')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.armor, 150 + i * 8, 223, EMPTY);
        if (on('air')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.air, 258 + i * 8, 223, EMPTY);
        if (on('armor') || on('air')) P.img('pip_tracks', pb, A, 'panel', true);
        if (on('armor')) { const f = Buf(150, 223, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.armor, 150 + i * 8, 223, X.statRamp('armor')); P.bar('armor', f, 'left', A); }
        if (on('air')) { const f = Buf(258, 223, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.air, 258 + i * 8, 223, X.statRamp('air')); P.bar('air', f, 'right', A); }
        for (const [stat, c, dir] of bars) {
            P.bar(stat, plainFill(X, stat, c), dir, A);
            valueText(X, P, stat, c.x + c.w / 2, c.y + c.h / 2 + 1);
        }
        if (on('xp')) P.bar('xp', shapeFill(151, 242, 178, 2, () => true, X.statRamp('xp')), 'left', A);
        if (on('level')) P.xp(240.5, 222.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function wyrmHotbar(X) {
        return slotsHotbar(X, X.t.metal, X.t.inset, X.accent, false, (b) => {
            for (let x = 2; x < 180; x += 4) b.set(x, 1, X.t.metal[5]);
        });
    }

    /* ═════════════ Grimoire — an open spellbook bottom-left ═════════════ */

    function grimoire(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const BL = 'bottom_left';
        const CV = t.plate;
        const TR = t.metal;
        const fb = Buf(2, 192, 132, 78);
        // cover, then two page blocks with a curved spine
        blob(fb, 4, 200, 126, 66, rr(126, 66, 3), CV);
        for (const cx of [6, 124]) for (const cy of [202, 260]) blob(fb, cx - 1, cy - 1, 5, 5, rr(5, 5, 1), TR);
        const page = (x) => {
            blob(fb, x, 203, 56, 60, rr(56, 60, 1), PARCH, { outline: PARCH[1] });
            for (let y = 206; y < 262; y += 2) fb.set(x === 10 ? x + 1 : x + 54, y, PARCH[2]);
        };
        page(10); page(68);
        fb.rect(66, 202, 2, 62, PARCH[1]); fb.vl(65, 203, 60, PARCH[2]); fb.vl(68, 203, 60, PARCH[2]);
        // ribbon bookmark hanging below
        fb.rect(98, 258, 5, 10, X.accent[3]); fb.vl(98, 258, 10, X.accent[4]);
        fb.set(98, 268, X.accent[3]); fb.set(102, 268, X.accent[3]);
        // left page: up to 4 bars with icons
        const stats = ['hp', 'food', 'mana', 'armor', 'air'].filter(on).slice(0, 4);
        const rows = [];
        stats.forEach((s, i) => {
            const y = 208 + i * 13;
            icon(fb, statIcon(s), 13, y, X.statRamp(s));
            fb.rect(24, y + 1, 39, 7, PARCH[0]);
            fb.rect(25, y + 2, 37, 5, '#2a1e10');
            rows.push([s, { x: 25, y: y + 2, w: 37, h: 5 }]);
        });
        // right page: name, wax-seal level, XP line
        if (on('level')) {
            blob(fb, 85, 219, 23, 23, circle(23), t.gemRamp || X.accent);
            blob(fb, 89, 223, 15, 15, circle(15), t.gemRamp || X.accent, { inset: true });
        }
        if (on('xp')) { fb.rect(72, 250, 48, 5, PARCH[0]); fb.rect(73, 251, 46, 3, '#2a1e10'); }
        // little rune doodles on the right page
        for (const [x, y] of [[73, 222], [113, 230], [74, 238]]) { fb.set(x, y, PARCH[1]); fb.set(x + 1, y + 1, PARCH[1]); fb.set(x + 2, y, PARCH[1]); }
        P.img('book', fb, BL, 'panel');
        for (const [s, c] of rows) P.bar(s, shapeFill(c.x, c.y, c.w, c.h, () => true, X.statRamp(s)), 'left', BL);
        if (on('xp')) P.bar('xp', shapeFill(73, 251, 46, 3, () => true, X.statRamp('xp')), 'left', BL);
        if (on('level')) P.xp(96.5, 234.5, BL);
        if (on('name')) {
            const n0 = P.parts.length;
            P.text('%player_name%', 96, 209, 'center', BL, '#3a2410', 48);
            inkText(P, n0);
        }
        X.infoStrips(P);
        return P.parts;
    }
    function grimoireHotbar(X) {
        const t = X.t;
        return slotsHotbar(X, t.plate, t.inset, t.metal, false, (b) => {
            // runes on the frame between the slots
            for (let i = 1; i < 9; i++) { b.set(1 + i * 20, 10, t.metal[4]); b.set(1 + i * 20, 12, t.metal[3]); }
        });
    }

    /* ═════════════ Sovereign — crown + velvet cushion ═════════════ */

    function sovereign(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const G = t.metal;
        const V = t.velvet || t.plate;
        const fb = Buf(130, 200, 220, 70);
        // velvet band across the top of the hotbar, gold piping
        blob(fb, 144, 231, 192, 15, rr(192, 15, 2), V);
        fb.hl(146, 232, 188, G[4]); fb.hl(146, 244, 188, G[2]);
        for (let x = 150; x < 332; x += 6) fb.set(x, 238, V[2]);
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 150, 233, 72, 10, G, null), 'left']);
        if (on('food')) bars.push(['food', channel(fb, 258, 233, 72, 10, G, null), 'right']);
        // fleur ends
        const fleur = ['...o...', '..obo..', '.obwbo.', 'oobbboo', 'obobobo', 'o.obo.o', '..obo..', '.ooooo.', '..obo..', '...o...'];
        fb.sprite(fleur, 135, 230, G); fb.sprite(fleur, 338, 230, G);
        // crown
        const cx = 240;
        const crown = poly([[cx - 18, 236], [cx - 18, 214], [cx - 11, 222], [cx - 5, 208], [cx, 218], [cx + 5, 208], [cx + 11, 222], [cx + 18, 214], [cx + 18, 236]]);
        blob(fb, cx - 19, 206, 39, 32, (i, j) => crown(cx - 19 + i + 0.5, 206 + j + 0.5), G);
        for (const [x, y] of [[cx - 18, 212], [cx - 5, 206], [cx + 5, 206], [cx + 17, 212]]) blob(fb, x - 1, y - 1, 4, 4, circle(4), G);
        // band with the level window and jewels
        fb.rect(cx - 17, 226, 35, 2, G[2]);
        if (on('level')) { fb.rect(cx - 8, 225, 17, 10, G[0]); fb.rect(cx - 7, 226, 15, 8, '#1a0a04'); }
        for (const [x, c] of [[cx - 13, '#e03050'], [cx + 12, '#3070e0']]) { fb.rect(x, 229, 3, 3, c); fb.set(x, 229, '#ffffff'); }
        fb.rect(cx - 1, 215, 3, 4, '#40d080'); fb.set(cx - 1, 215, '#ffffff');
        P.img('frame', fb, A, 'panel');
        // armor / air as small gold pips above the bars
        const pb = Buf(150, 222, 182, 8);
        if (on('armor')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.armor, 150 + i * 8, 223, EMPTY);
        if (on('air')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.air, 259 + i * 8, 223, EMPTY);
        if (on('armor') || on('air')) P.img('pip_tracks', pb, A, 'panel', true);
        if (on('armor')) { const f = Buf(150, 223, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.armor, 150 + i * 8, 223, X.statRamp('armor')); P.bar('armor', f, 'left', A); }
        if (on('air')) { const f = Buf(259, 223, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.air, 259 + i * 8, 223, X.statRamp('air')); P.bar('air', f, 'right', A); }
        for (const [stat, c, dir] of bars) { P.bar(stat, plainFill(X, stat, c), dir, A); valueText(X, P, stat, c.x + c.w / 2, c.y + c.h / 2 + 1); }
        if (on('xp')) {
            const xb = Buf(149, 244, 182, 2);
            xb.rect(149, 244, 182, 2, '#160608');
            P.img('xp_track', xb, A, 'panel', true);
            P.bar('xp', shapeFill(150, 244, 180, 2, () => true, X.statRamp('xp')), 'left', A);
        }
        if (on('level')) P.xp(240.5, 233.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function sovereignHotbar(X) {
        const V = X.t.velvet || X.t.plate;
        return slotsHotbar(X, X.t.metal, V, X.t.metal, false);
    }

    /* ═════════════ Starfall — moon (HP) + star (Food) ═════════════ */

    function starfall(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const SV = t.metal;
        const fb = Buf(96, 196, 288, 74);
        // night strip over the hotbar with tiny stars
        blob(fb, 144, 236, 192, 10, rr(192, 10, 2), NIGHT);
        for (let x = 150; x < 332; x += 7) fb.set(x, 238 + ((x * 7) % 5), (x % 3) ? NIGHT[5] : '#ffffff');
        if (on('xp')) { fb.rect(150, 241, 180, 3, NIGHT[0]); }
        // the moon: a crescent cut from a disc
        const MR = 25;
        const mcx = 124, mcy = 240;
        const moon = (x, y) => Math.hypot(x - mcx, y - mcy) <= MR && Math.hypot(x - (mcx + 11), y - (mcy - 7)) > MR - 3;
        const moonIn = (x, y) => Math.hypot(x - mcx, y - mcy) <= MR - 3 && Math.hypot(x - (mcx + 11), y - (mcy - 7)) > MR;
        blob(fb, mcx - MR, mcy - MR, MR * 2 + 1, MR * 2 + 1, (i, j) => moon(mcx - MR + i, mcy - MR + j), SV);
        // the star: four points
        const scx = 356, scy = 238;
        const star = (x, y, r) => { const dx = Math.abs(x - scx), dy = Math.abs(y - scy); return (dx + dy) / r <= 0.5 || (dx / r) ** 0.6 + (dy / r) ** 0.6 <= 1; };
        blob(fb, scx - 28, scy - 28, 57, 57, (i, j) => star(scx - 28 + i, scy - 28 + j, 28), SV);
        // empty glass inside both
        for (let y = mcy - MR; y <= mcy + MR; y++) for (let x = mcx - MR; x <= mcx + MR; x++) if (moonIn(x, y)) fb.set(x, y, GLASS);
        for (let y = scy - 24; y <= scy + 24; y++) for (let x = scx - 24; x <= scx + 24; x++) if (star(x, y, 22)) fb.set(x, y, GLASS);
        // level: a small star badge over the strip
        if (on('level')) {
            blob(fb, 229, 219, 23, 19, rr(23, 19, 4), NIGHT);
            fb.hl(231, 220, 19, SV[4]);
        }
        for (const [x, y] of [[176, 220], [196, 212], [292, 214], [306, 224], [100, 206], [378, 202]]) sparkle(fb, x, y, SV[4]);
        P.img('frame', fb, A, 'panel');
        if (on('hp')) {
            P.bar('hp', shapeFill(mcx - MR, mcy - MR, MR * 2 + 1, MR * 2 + 1, (i, j) => moonIn(mcx - MR + i, mcy - MR + j), X.statRamp('hp'), true), 'bottom', A);
            const ib = Buf(108, 238, 9, 9); icon(ib, 'heart', 108, 238, X.statRamp('hp')); P.img('icon_heart', ib, A, 'icon');
            valueText(X, P, 'hp', 113, 255);
        }
        if (on('food')) {
            P.bar('food', shapeFill(scx - 24, scy - 24, 49, 49, (i, j) => star(scx - 24 + i, scy - 24 + j, 22), X.statRamp('food'), true), 'bottom', A);
            const ib = Buf(scx - 4, scy - 5, 9, 9); icon(ib, 'food', scx - 4, scy - 5, X.statRamp('food')); P.img('icon_food', ib, A, 'icon');
        }
        const pb = Buf(150, 225, 182, 8);
        if (on('armor')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.armor, 150 + i * 8, 227, EMPTY);
        if (on('air')) for (let i = 0; i < 9; i++) pb.sprite(PIPS.air, 259 + i * 8, 227, EMPTY);
        if (on('armor') || on('air')) P.img('pip_tracks', pb, A, 'panel', true);
        if (on('armor')) { const f = Buf(150, 227, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.armor, 150 + i * 8, 227, X.statRamp('armor')); P.bar('armor', f, 'left', A); }
        if (on('air')) { const f = Buf(259, 227, 71, 7); for (let i = 0; i < 9; i++) f.sprite(PIPS.air, 259 + i * 8, 227, X.statRamp('air')); P.bar('air', f, 'right', A); }
        if (on('xp')) P.bar('xp', shapeFill(151, 242, 178, 1, () => true, X.statRamp('xp')), 'left', A);
        if (on('level')) P.xp(240.5, 232.5, A);
        X.infoStrips(P);
        return P.parts;
    }
    function starfallHotbar(X) {
        return slotsHotbar(X, NIGHT, NIGHT, X.t.metal, false, (b) => {
            for (let i = 0; i < 9; i++) { b.set(4 + i * 20, 4, X.t.metal[4]); b.set(16 + i * 20, 17, NIGHT[5]); }
        });
    }

    /* ═════════════ Mech — armoured side gauges ═════════════ */

    function mech(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const AR = t.plate;
        const TR = t.metal;
        const GL = X.accent;
        const fb = Buf(110, 188, 260, 82);
        const housing = (x, flip) => {
            const s = flip ? -1 : 1;
            const x0 = flip ? x - 20 : x;
            const shape = poly(flip
                ? [[x, 196], [x - 14, 196], [x - 20, 204], [x - 20, 266], [x, 266]]
                : [[x, 196], [x + 14, 196], [x + 20, 204], [x + 20, 266], [x, 266]]);
            blob(fb, x0, 196, 21, 71, (i, j) => shape(x0 + i + 0.5, 196 + j + 0.5), AR);
            // hazard stripes at the foot
            for (let j = 0; j < 5; j++) for (let i = 2; i < 19; i++) fb.set(x0 + i, 259 + j, ((i + j * s) & 3) < 2 ? HAZARD[3] : HAZARD[0]);
            // bolts
            for (const by of [200, 252]) { fb.set(x0 + (flip ? 3 : 16), by, TR[4]); fb.set(x0 + (flip ? 3 : 16), by + 1, TR[2]); }
            // the gauge window: 10 segments
            fb.rect(x0 + 5, 203, 11, 54, TR[0]);
            for (let k = 0; k < 10; k++) fb.rect(x0 + 6, 204 + k * 5 + 1, 9, 4, '#0a0d12');
            void s;
            return { x: x0 + 6, y: 204, w: 9, h: 52 };
        };
        const gauges = [];
        if (on('hp')) gauges.push(['hp', housing(122, false)]);
        if (on('food')) gauges.push(['food', housing(358, true)]);
        // armour plate across the hotbar top with the XP rail
        const plate = poly([[143, 246], [150, 236], [330, 236], [337, 246]]);
        blob(fb, 142, 235, 196, 12, (i, j) => plate(142 + i + 0.5, 235 + j + 0.5), AR);
        if (on('xp')) { fb.rect(156, 240, 168, 4, TR[0]); for (let x = 157; x < 323; x += 3) fb.rect(x, 241, 2, 2, '#0a0d12'); }
        // hex core for the level
        if (on('level')) {
            const hex = poly([[231, 220], [249, 220], [255, 229], [249, 238], [231, 238], [225, 229]]);
            blob(fb, 224, 219, 32, 21, (i, j) => hex(224 + i + 0.5, 219 + j + 0.5), TR);
            const hin = poly([[233, 223], [247, 223], [251, 229], [247, 235], [233, 235], [229, 229]]);
            for (let y = 222; y < 237; y++) for (let x = 228; x < 253; x++) if (hin(x + 0.5, y + 0.5)) fb.set(x, y, '#081016');
            fb.hl(233, 223, 14, GL[4]);
        }
        // armor / air as short segmented bars on the plate shoulders
        const seg = (stat, x) => {
            fb.rect(x, 227, 52, 6, TR[0]);
            for (let k = 0; k < 10; k++) fb.rect(x + 1 + k * 5, 228, 4, 4, '#0a0d12');
        };
        if (on('armor')) seg('armor', 160);
        if (on('air')) seg('air', 268);
        P.img('frame', fb, A, 'panel');
        const segFillN = (x, y, w, h, n, R, vertical) => {
            const b = Buf(x, y, w, h);
            for (let k = 0; k < n; k++) {
                if (vertical) { const yy = y + k * 5 + 1; b.rect(x, yy, w, 4, R[3]); b.hl(x, yy, w, R[5]); b.vl(x, yy, 4, R[4]); }
                else { const xx = x + k * 5; b.rect(xx, y, 4, h, R[3]); b.hl(xx, y, 4, R[5]); }
            }
            return b;
        };
        for (const [stat, g] of gauges) {
            P.bar(stat, segFillN(g.x, g.y, g.w, g.h, 10, X.statRamp(stat), true), 'bottom', A);
            const ix = g.x;
            const ib = Buf(ix, 186, 9, 9); icon(ib, statIcon(stat), ix, 186, X.statRamp(stat)); P.img(`icon_${stat}`, ib, A, 'icon');
        }
        if (on('armor')) P.bar('armor', segFillN(161, 228, 49, 4, 10, X.statRamp('armor')), 'left', A);
        if (on('air')) P.bar('air', segFillN(269, 228, 49, 4, 10, X.statRamp('air')), 'right', A);
        if (on('xp')) {
            const R = X.statRamp('xp');
            const xb = Buf(157, 241, 166, 2);
            for (let x = 157; x < 323; x += 3) xb.rect(x, 241, 2, 2, R[4]);
            P.bar('xp', xb, 'left', A);
        }
        if (on('level')) P.xp(240.5, 233, A);
        // values above the icons
        for (const [stat, g] of gauges) valueText(X, P, stat, g.x + (stat === 'hp' ? 20 : -11), 191);
        X.infoStrips(P);
        return P.parts;
    }
    function mechHotbar(X) {
        const t = X.t;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, t.plate[0]);
            b.rect(1, 1, 180, 20, t.plate[2]);
            for (let i = 0; i < 9; i++) {
                const sx = 1 + i * 20;
                b.rect(sx + 1, 2, 18, 18, '#06080c');
                b.rect(sx + 2, 3, 16, 16, '#0e131a');
                b.hl(sx + 2, 3, 5, X.accent[3]); b.vl(sx + 2, 3, 5, X.accent[3]);
                b.hl(sx + 13, 18, 5, X.accent[2]); b.vl(sx + 17, 14, 5, X.accent[2]);
            }
        }, (b) => {
            for (let k = 0; k < 2; k++) {
                b.hl(k, k, 24 - 2 * k, X.accent[4]); b.vl(k, k, 24 - 2 * k, X.accent[4]);
                b.hl(k, 23 - k, 24 - 2 * k, X.accent[3]); b.vl(23 - k, k, 24 - 2 * k, X.accent[3]);
            }
        });
    }

    /* ═════════════ Field Ops — tactical cluster + compass ═════════════ */

    function fieldops(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const BL = 'bottom_left';
        const OD = t.field || t.plate;
        const HI = X.accent;
        const fb = Buf(4, 214, 140, 56);
        const panel = poly([[6, 266], [6, 226], [14, 218], [134, 218], [134, 258], [126, 266]]);
        for (let y = 216; y < 268; y++) for (let x = 4; x < 138; x++) if (panel(x + 0.5, y + 0.5)) fb.set(x, y, L.rgba(OD[1], 0.86));
        // edge highlight + corner tab
        for (let x = 14; x < 134; x++) fb.set(x, 218, OD[4]);
        for (let k = 0; k < 8; k++) fb.set(6 + k, 226 - k, OD[4]);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 22; i++) fb.set(110 + i, 220 + j, ((i + j) & 3) < 2 ? HAZARD[3] : HAZARD[0]);
        // HP (thick, with number), armor, food
        const rowsDef = [['hp', 230, 7], ['armor', 243, 4], ['food', 251, 4], ['air', 259, 3]].filter(([s]) => on(s));
        const rows = [];
        let ry = 228;
        for (const [s, , h] of rowsDef) {
            icon(fb, statIcon(s), 10, ry + Math.floor((h - 9) / 2) + (h < 7 ? 1 : 0), X.statRamp(s));
            fb.rect(22, ry, 88, h + 2, OD[0]);
            for (let x = 23; x < 109; x += 9) fb.vl(x + 8, ry + 1, h, OD[2]);
            rows.push([s, { x: 23, y: ry + 1, w: 86, h }]);
            ry += h + 5;
        }
        // rank chevrons = level
        if (on('level')) {
            for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) { fb.set(116 + i, 236 + k * 4 + Math.abs(4 - i) / 2 | 0, HI[4]); }
            fb.rect(113, 248, 17, 10, OD[0]);
        }
        P.img('cluster', fb, BL, 'panel', true);
        for (const [s, c] of rows) P.bar(s, shapeFill(c.x, c.y, c.w, c.h, () => true, X.statRamp(s)), 'left', BL);
        if (on('hp') && X.state.values !== false) P.text(VALUE_ONLY.hp, 66, 233.5, 'center', BL, '#ffffff', 30);
        if (on('level')) P.xp(121.5, 257, BL);
        // XP: thin rail on the hotbar top
        if (on('xp')) {
            const xb = Buf(149, 243, 182, 3);
            xb.rect(149, 243, 182, 3, [10, 12, 8, 0.85]);
            P.img('xp_track', xb, A, 'panel', true);
            P.bar('xp', shapeFill(150, 244, 180, 1, () => true, X.statRamp('xp')), 'left', A);
        }
        // compass strip, top centre (static ticks; coords / time under it)
        const TC = 'top_middle';
        const cb = Buf(170, 3, 140, 30);
        cb.rect(170, 4, 140, 12, [10, 12, 8, 0.8]);
        for (let x = 172; x < 308; x += 4) cb.vl(x, 12, (x - 172) % 16 === 0 ? 3 : 1, OD[4]);
        const letters = { N: ['o..o', 'oo.o', 'o.oo', 'o..o', 'o..o'], E: ['oooo', 'o...', 'ooo.', 'o...', 'oooo'], W: ['o...o', 'o...o', 'o.o.o', 'oo.oo', 'o...o'], S: ['.ooo', 'o...', '.oo.', '...o', 'ooo.'] };
        [['W', 186], ['N', 238], ['E', 286]].forEach(([ch, x]) => cb.sprite(letters[ch], x, 6, ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']));
        cb.sprite(['ooooo', '.ooo.', '..o..'], 238, 17, [HI[4], HI[4], HI[4], HI[4], HI[4], HI[4]]);
        P.img('compass', cb, TC, 'panel', true);
        const infos = Object.keys(X.INFO).filter(on);
        infos.forEach((k, i) => {
            const info = X.INFO[k];
            const tw = X.textW(info.papi);
            const y = 21 + i * 11;
            const ib = Buf(240 - tw / 2 - 12 | 0, y, 11, 10);
            icon(ib, info.icon, (240 - tw / 2 - 11) | 0, y, X.rampOf(X.iconColor(info.icon)));
            P.img(`info_${k}`, ib, TC, 'icon', true);
            P.text(info.papi, 240, y + 4, 'center', TC, '#ffffff', tw);
        });
        return P.parts;
    }
    function fieldopsHotbar(X) {
        const OD = X.t.field || X.t.plate;
        return sheet((b) => {
            b.rect(0, 0, 182, 22, [10, 12, 8, 0.82]);
            for (let i = 0; i < 9; i++) {
                const sx = 1 + i * 20;
                b.rect(sx + 1, 1, 18, 20, [255, 255, 255, 0.08]);
                b.rect(sx + 2, 2, 16, 18, [0, 0, 0, 0.25]);
                TINY[i + 1].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') b.set(sx + 3 + x, 3 + y, OD[4]); }));
            }
        }, (b) => {
            const H = X.accent;
            for (const [x, y] of [[0, 0], [17, 0], [0, 17], [17, 17]]) {
                b.rect(x, y + (y ? 5 : 0), 7, 2, H[4]); b.rect(x + (x ? 5 : 0), y, 2, 7, H[4]);
            }
        });
    }

    /* ═════════════ Warbar — MMO action bar ═════════════ */

    function warbar(X) {
        const t = X.t;
        const on = X.on;
        const P = mk(X);
        const FR = t.plate;
        const TR = t.metal;
        const fb = Buf(40, 226, 400, 44);
        // the long plate behind everything
        const plate = poly([[58, 270], [58, 246], [66, 238], [414, 238], [422, 246], [422, 270]]);
        blob(fb, 57, 237, 367, 34, (i, j) => plate(57 + i + 0.5, 237 + j + 0.5) && !(57 + i >= 148 && 57 + i <= 331 && 237 + j >= 246), FR);
        fb.hl(66, 239, 348, TR[4]);
        // studs
        for (const x of [70, 140, 340, 410]) { fb.rect(x, 262, 2, 2, TR[3]); fb.set(x, 262, TR[5]); }
        const right = on('mana') ? 'mana' : 'food';
        const thinL = on('armor') ? 'armor' : null;
        const thinR = right === 'mana' ? (on('food') ? 'food' : null) : (on('air') ? 'air' : null);
        const bars = [];
        if (on('hp')) bars.push(['hp', channel(fb, 68, 243, 78, 13, TR, null), 'left', true]);
        if (on(right)) bars.push([right, channel(fb, 334, 243, 78, 13, TR, null), 'right', true]);
        if (thinL) bars.push([thinL, channel(fb, 68, 257, 78, 8, TR, null), 'left', false]);
        if (thinR) bars.push([thinR, channel(fb, 334, 257, 78, 8, TR, null), 'right', false]);
        // XP over the hotbar
        if (on('xp')) { fb.rect(149, 240, 182, 5, FR[0]); fb.rect(150, 241, 180, 3, GLASS); }
        // level medallion at the left end, name tab at the right end
        if (on('level')) {
            blob(fb, 40, 238, 25, 25, circle(25), TR);
            blob(fb, 44, 242, 17, 17, circle(17), FR, { inset: true });
        }
        P.img('frame', fb, A, 'panel');
        for (const [stat, c, dir, big] of bars) {
            P.bar(stat, plainFill(X, stat, c), dir, A);
            if (big) valueText(X, P, stat, c.x + c.w / 2, c.y + c.h / 2 + 1);
        }
        if (on('xp')) P.bar('xp', shapeFill(150, 241, 180, 3, () => true, X.statRamp('xp')), 'left', A);
        if (on('level')) P.xp(52.5, 254.5, A);
        // player name above the right bar block
        if (on('name')) {
            const nb = Buf(334, 229, 78, 10);
            nb.rect(334, 229, 78, 10, INK);
            nb.hl(334, 229, 78, TR[3]);
            P.img('name_tab', nb, A, 'panel', true);
            P.text('%player_name%', 373, 233, 'center', A, '#ffffff', 70);
        }
        X.infoStrips(P);
        return P.parts;
    }
    function warbarHotbar(X) {
        return slotsHotbar(X, X.t.plate, X.t.inset, X.t.metal, true);
    }

    HudForgeV2.register('oathblade', { plan: oathblade, hotbar: oathbladeHotbar });
    HudForgeV2.register('wyrmwing', { plan: wyrmwing, hotbar: wyrmHotbar });
    HudForgeV2.register('grimoire', { plan: grimoire, hotbar: grimoireHotbar });
    HudForgeV2.register('sovereign', { plan: sovereign, hotbar: sovereignHotbar });
    HudForgeV2.register('starfall', { plan: starfall, hotbar: starfallHotbar });
    HudForgeV2.register('mech', { plan: mech, hotbar: mechHotbar });
    HudForgeV2.register('fieldops', { plan: fieldops, hotbar: fieldopsHotbar });
    HudForgeV2.register('warbar', { plan: warbar, hotbar: warbarHotbar });
    void mixHex; void VELVET; void OLIVE; void INK2; void infoRows;
})();
