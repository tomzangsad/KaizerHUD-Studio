/* ========================================
   GUI Studio — Minecraft item icons like the inventory shows them
   Reads the game's own item definitions (assets/minecraft/items/*.json) and models
   from the user's client .jar / resource pack, then draws each item:
   - flat items (item/generated): their texture layers
   - blocks and other 3D models: the model's boxes turned like the inventory does
     (display "gui": rotation 30 / 225 / 0, scale 0.625), lit top / left / right
   Only used for pictures in the editor: in game Java draws the real item.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};

    const OUT = 32;                          // icon size in px (16 model units → 32 px at scale 1)
    const GUI_DEFAULT = { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] };
    const GRASS = [0x91, 0xbd, 0x59], FOLIAGE = [0x77, 0xab, 0x2f], WATER = [0x3f, 0x76, 0xe4];
    const LEATHER = [0xa0, 0x65, 0x40];

    const strip = (id) => String(id || '').replace(/^minecraft:/, '');

    /**
     * entries: [{ name, read() → Blob }] of a .jar / pack.
     * onProgress(text) is called now and then. Returns { icons: { id: dataURL }, kinds: { id: 'block' | 'item' } }.
     */
    async function render(entries, onProgress) {
        const byName = new Map(entries.map(e => [e.name, e]));
        const say = onProgress || (() => {});
        const jsonCache = new Map(), texCache = new Map();

        async function json(path) {
            if (jsonCache.has(path)) return jsonCache.get(path);
            const e = byName.get(path);
            let v = null;
            if (e) { try { v = JSON.parse(await (await e.read()).text()); } catch (err) { v = null; } }
            jsonCache.set(path, v);
            return v;
        }

        /** texture ref "minecraft:block/stone" → ImageBitmap (first frame, square) or null */
        async function texture(ref) {
            const p = 'assets/minecraft/textures/' + strip(ref) + '.png';
            if (texCache.has(p)) return texCache.get(p);
            const e = byName.get(p);
            let bmp = null;
            if (e) {
                try {
                    const full = await createImageBitmap(await e.read());
                    const s = Math.min(full.width, full.height);
                    bmp = s === full.height && s === full.width ? full : await createImageBitmap(full, 0, 0, s, s);
                } catch (err) { bmp = null; }
            }
            texCache.set(p, bmp);
            return bmp;
        }

        /** Model id → { textures, elements, gui, generated } with the parents merged */
        async function model(id, depth) {
            depth = depth || 0;
            const name = strip(id);
            if (depth > 12 || !name) return null;
            if (name === 'builtin/generated') return { textures: {}, elements: null, gui: null, generated: true };
            if (name === 'builtin/entity') return { textures: {}, elements: null, gui: null, entity: true };
            const m = await json('assets/minecraft/models/' + name + '.json');
            if (!m) return null;
            const parent = m.parent ? await model(m.parent, depth + 1) : { textures: {}, elements: null, gui: null };
            if (!parent) return null;
            return {
                textures: Object.assign({}, parent.textures, m.textures || {}),
                elements: m.elements || parent.elements,
                gui: (m.display && m.display.gui) || parent.gui,
                generated: !m.elements && (parent.generated || name === 'item/generated'),
                entity: parent.entity
            };
        }

        function resolveTex(textures, ref) {
            let r = ref, n = 0;
            const sprite = (v) => (v && typeof v === 'object' ? v.sprite : v);   // 26.x: { sprite, force_translucent }
            r = sprite(r);
            while (typeof r === 'string' && r.startsWith('#') && n++ < 10) r = sprite(textures[r.slice(1)]);
            return typeof r === 'string' ? r : null;
        }

        /**
         * Item definition (1.21.4+) → what it shows in the inventory:
         * [{ ref: model id, off: [x, y, z] in blocks (composite parts, e.g. the bed's foot), special: the special model }]
         */
        function pick(def) {
            if (!def || typeof def !== 'object') return null;
            const t = strip(def.type);
            if (t === 'model') return [{ ref: def.model, off: (def.transformation && def.transformation.translation) || null, tints: def.tints || null }];
            if (t === 'condition') return pick(def.on_false) || pick(def.on_true);
            if (t === 'select') return pick(def.fallback) || (def.cases && def.cases[0] && pick(def.cases[0].model));
            if (t === 'range_dispatch') return pick(def.fallback) || (def.entries && def.entries[0] && pick(def.entries[0].model));
            if (t === 'composite') {
                const all = [];
                for (const m of def.models || []) { const p = pick(m); if (p) all.push(...p); }
                return all.length ? all : null;
            }
            if (t === 'special') return [{ ref: def.base, special: def.model || {} }];
            if (def.model) return pick(def.model);
            return null;
        }

        /** Whole texture (entity textures are not square) */
        const rawCache = new Map();
        async function rawTexture(path) {
            const p = 'assets/minecraft/textures/' + strip(path).replace(/\.png$/, '') + '.png';
            if (rawCache.has(p)) return rawCache.get(p);
            const e = byName.get(p);
            let bmp = null;
            if (e) { try { bmp = await createImageBitmap(await e.read()); } catch (err) { bmp = null; } }
            rawCache.set(p, bmp);
            return bmp;
        }

        /* ── drawing ── */

        const tinted = new Map();
        /** texture × colour × brightness, as a canvas (cached) */
        function shaded(bmp, tint, light) {
            const key = bmp && (bmp.__id || (bmp.__id = Math.random().toString(36).slice(2))) + '|' + (tint || '') + '|' + light;
            if (tinted.has(key)) return tinted.get(key);
            const c = document.createElement('canvas');
            c.width = bmp.width; c.height = bmp.height;
            const g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            if (tint || light < 1) {
                const d = g.getImageData(0, 0, c.width, c.height);
                const t = tint || [255, 255, 255];
                for (let i = 0; i < d.data.length; i += 4) {
                    d.data[i] = d.data[i] * t[0] / 255 * light;
                    d.data[i + 1] = d.data[i + 1] * t[1] / 255 * light;
                    d.data[i + 2] = d.data[i + 2] * t[2] / 255 * light;
                }
                g.putImageData(d, 0, 0);
            }
            tinted.set(key, c);
            return c;
        }

        /** colour of tint n from the item definition (1.21.4+: "tints"): constant / dye / potion … → default, grass → colormap */
        let grassMap = null;
        async function loadGrassMap() {
            if (grassMap !== null) return;
            grassMap = false;
            const bmp = await rawTexture('colormap/grass');
            if (!bmp) return;
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
            grassMap = { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
        }
        function argb(v) { v = Number(v) >>> 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
        function tintColor(tints, i) {
            const t = tints && tints[i];
            if (!t) return null;
            const type = strip(t.type);
            if (type === 'grass') {
                if (!grassMap) return GRASS;
                const temp = Math.min(1, Math.max(0, +t.temperature || 0.5)), down = Math.min(1, Math.max(0, +t.downfall || 1)) * temp;
                const x = Math.floor((1 - temp) * (grassMap.w - 1)), y = Math.floor((1 - down) * (grassMap.h - 1));
                const o = (y * grassMap.w + x) * 4;
                return [grassMap.d[o], grassMap.d[o + 1], grassMap.d[o + 2]];
            }
            const v = t.value != null ? t.value : t.default;
            return v != null ? argb(v) : null;
        }

        function tintFor(texRef, face, tints) {
            if (face.tintindex == null) return null;
            if (tints) return tintColor(tints, face.tintindex);
            const t = strip(texRef);
            if (/water/.test(t)) return WATER;
            if (/grass|fern|sugar_cane|vine/.test(t)) return GRASS;
            if (/leaves|lily_pad/.test(t)) return FOLIAGE;
            return null;
        }

        const rad = (d) => d * Math.PI / 180;
        function rotate(v, axis, deg) {
            const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
            const [x, y, z] = v;
            if (axis === 'x') return [x, y * c - z * s, y * s + z * c];
            if (axis === 'y') return [x * c + z * s, y, -x * s + z * c];
            return [x * c - y * s, x * s + y * c, z];
        }

        /** Faces of one box: corners [TL, TR, BR, BL] (model units) + default uv */
        function boxFaces(f, t) {
            const [x1, y1, z1] = f, [x2, y2, z2] = t;
            return {
                north: { c: [[x2, y2, z1], [x1, y2, z1], [x1, y1, z1], [x2, y1, z1]], uv: [16 - x2, 16 - y2, 16 - x1, 16 - y1] },
                south: { c: [[x1, y2, z2], [x2, y2, z2], [x2, y1, z2], [x1, y1, z2]], uv: [x1, 16 - y2, x2, 16 - y1] },
                west: { c: [[x1, y2, z1], [x1, y2, z2], [x1, y1, z2], [x1, y1, z1]], uv: [z1, 16 - y2, z2, 16 - y1] },
                east: { c: [[x2, y2, z2], [x2, y2, z1], [x2, y1, z1], [x2, y1, z2]], uv: [16 - z2, 16 - y2, 16 - z1, 16 - y1] },
                up: { c: [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]], uv: [x1, z1, x2, z2] },
                down: { c: [[x1, y1, z2], [x2, y1, z2], [x2, y1, z1], [x1, y1, z1]], uv: [x1, 16 - z2, x2, 16 - z1] }
            };
        }

        async function draw3d(m, off, extra, tints) {
            const gui = Object.assign({}, GUI_DEFAULT, m.gui || {});
            const [rx, ry, rz] = gui.rotation || [0, 0, 0];
            const sc = gui.scale || [1, 1, 1], tr = gui.translation || [0, 0, 0];
            const px = OUT / 16;
            const toScreen = (p) => {
                // model space (0..16) → centred, display rotation (Y, then X, then Z applied last-first as in JOML XYZ)
                let v = [(p[0] - 8) * sc[0], (p[1] - 8) * sc[1], (p[2] - 8) * sc[2]];
                v = rotate(v, 'z', rz); v = rotate(v, 'y', ry); v = rotate(v, 'x', rx);   // same as the game: rotationXYZ, right-handed (north on the right at 225°)
                return [OUT / 2 + (v[0] + tr[0]) * px, OUT / 2 - (v[1] + tr[1]) * px, v[2]];
            };
            const polys = [];
            const sources = [{ m, off }].concat(extra || []);
            for (const src of sources) {
              const o3 = (src.off || [0, 0, 0]).map(v => v * 16);
              for (const el of src.m.elements || []) {
                if (!el.from || !el.to) continue;
                const faces = boxFaces(el.from, el.to);
                const rot = el.rotation;
                for (const [dir, face] of Object.entries(el.faces || {})) {
                    const geo = faces[dir];
                    if (!geo) continue;
                    let pts = geo.c.map(p => [p[0] + o3[0], p[1] + o3[1], p[2] + o3[2]]);
                    if (rot && rot.angle) {
                        const o = rot.origin || [8, 8, 8];
                        const oo = [o[0] + o3[0], o[1] + o3[1], o[2] + o3[2]];
                        pts = pts.map(p => { const r = rotate([p[0] - oo[0], p[1] - oo[1], p[2] - oo[2]], rot.axis, rot.angle); return [r[0] + oo[0], r[1] + oo[1], r[2] + oo[2]]; });
                    }
                    const sp = pts.map(toScreen);
                    // facing the viewer? (screen y grows down, so the winding flips)
                    const ax = sp[1][0] - sp[0][0], ay = sp[1][1] - sp[0][1], bx = sp[3][0] - sp[0][0], by = sp[3][1] - sp[0][1];
                    const cross = ax * by - ay * bx;
                    if (cross <= 0) continue;              // back face (checked against the game's icons)
                    const texRef = resolveTex(src.m.textures, face.texture);
                    if (!texRef) continue;
                    const bmp = await texture(texRef);
                    if (!bmp) continue;
                    // light: top bright, faces turned left lighter than faces turned right
                    const nxScreen = (sp[1][0] + sp[2][0]) / 2 - (sp[0][0] + sp[3][0]) / 2;
                    const light = dir === 'up' ? 1 : dir === 'down' ? 0.5 : (sp[0][0] + sp[2][0]) / 2 < OUT / 2 ? 0.8 : 0.6;
                    polys.push({ sp, uv: face.uv || geo.uv, rot: face.rotation || 0, bmp, tint: tintFor(texRef, face, src.tints || tints), light, depth: sp.reduce((a, p) => a + p[2], 0) / 4, nxScreen });
                }
              }
            }
            if (!polys.length) return null;
            polys.sort((a, b) => a.depth - b.depth);
            const c = document.createElement('canvas');
            c.width = OUT; c.height = OUT;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            for (const p of polys) {
                const k = p.bmp.width / 16;
                const [u1, v1, u2, v2] = p.uv.map(v => v * k);
                let uvc = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
                const turns = ((p.rot / 90) % 4 + 4) % 4;
                for (let i = 0; i < turns; i++) uvc = [uvc[3], uvc[0], uvc[1], uvc[2]];
                // affine map texture → screen from three corners
                const [P0, P1, P3] = [p.sp[0], p.sp[1], p.sp[3]], [T0, T1, T3] = [uvc[0], uvc[1], uvc[3]];
                const du1 = T1[0] - T0[0], dv1 = T1[1] - T0[1], du3 = T3[0] - T0[0], dv3 = T3[1] - T0[1];
                const det = du1 * dv3 - du3 * dv1;
                if (Math.abs(det) < 1e-6) continue;
                const a = ((P1[0] - P0[0]) * dv3 - (P3[0] - P0[0]) * dv1) / det;
                const cc = ((P3[0] - P0[0]) * du1 - (P1[0] - P0[0]) * du3) / det;
                const b = ((P1[1] - P0[1]) * dv3 - (P3[1] - P0[1]) * dv1) / det;
                const d = ((P3[1] - P0[1]) * du1 - (P1[1] - P0[1]) * du3) / det;
                const e = P0[0] - a * T0[0] - cc * T0[1], f = P0[1] - b * T0[0] - d * T0[1];
                g.save();
                g.beginPath();
                p.sp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
                g.closePath();
                g.clip();
                g.setTransform(a, b, cc, d, e, f);
                g.drawImage(shaded(p.bmp, p.tint, p.light), 0, 0);
                g.restore();
            }
            return c.toDataURL('image/png');
        }

        async function drawFlat(m, id, tints) {
            const layers = [];
            for (let i = 0; i < 5; i++) {
                const ref = resolveTex(m.textures, '#layer' + i);
                if (!ref) break;
                const bmp = await texture(ref);
                if (bmp) layers.push({ bmp, tint: tints ? tintColor(tints, i) : (i === 0 && /^leather_/.test(id) ? LEATHER : null) });
            }
            if (!layers.length) {
                // models without layers (special / entity items): their particle texture, flat
                const ref = resolveTex(m.textures, '#particle');
                const bmp = ref && await texture(ref);
                if (bmp) layers.push({ bmp, tint: null });
            }
            if (!layers.length) return null;
            const c = document.createElement('canvas');
            c.width = OUT; c.height = OUT;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            layers.forEach(l => g.drawImage(l.tint ? shaded(l.bmp, l.tint, 1) : l.bmp, 0, 0, OUT, OUT));
            return c.toDataURL('image/png');
        }

        /* ── special items (drawn by the game's code, not by a model file) ── */

        /** turn function for box models in block pixels (0..16), placed like an inventory icon */
        function iconTurn(gui) {
            const g = Object.assign({ rotation: [30, 45, 0], translation: [0, 0, 0], scale: [0.625, 0.625, 0.625] }, gui || {});
            const [rx, ry, rz] = g.rotation || [0, 0, 0], sc = g.scale || [1, 1, 1], tr = g.translation || [0, 0, 0];
            return (p) => {
                let v = [(p[0] - 8) * sc[0], (p[1] - 8) * sc[1], (p[2] - 8) * sc[2]];
                v = rotate(v, 'z', rz); v = rotate(v, 'y', ry); v = rotate(v, 'x', rx);   // same as the game: rotationXYZ, right-handed (north on the right at 225°)
                return [v[0] + tr[0], v[1] + tr[1], v[2]];
            };
        }

        const DYES = {
            white: 0xF9FFFE, orange: 0xF9801D, magenta: 0xC74EBD, light_blue: 0x3AB3DA, yellow: 0xFED83D, lime: 0x80C71F,
            pink: 0xF38BAA, gray: 0x474F52, light_gray: 0x9D9D97, cyan: 0x169C9C, purple: 0x8932B8, blue: 0x3C44AA,
            brown: 0x835432, green: 0x5E7C16, red: 0xB02E26, black: 0x1D1D21
        };
        /** a copy of a texture multiplied by a colour (banner cloth) */
        function tintedCopy(bmp, rgb) {
            const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
            const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height);
            const r = (rgb >> 16) & 255, gg = (rgb >> 8) & 255, b = rgb & 255;
            for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i] * r / 255; d.data[i + 1] = d.data[i + 1] * gg / 255; d.data[i + 2] = d.data[i + 2] * b / 255; }
            g.putImageData(d, 0, 0);
            return c;
        }

        const HEADS = {
            skeleton: ['entity/skeleton/skeleton', 64], wither_skeleton: ['entity/skeleton/wither_skeleton', 64],
            zombie: ['entity/zombie/zombie', 64], creeper: ['entity/creeper/creeper', 64], piglin: ['entity/piglin/piglin', 64]
        };

        async function drawSpecial(spec, base) {
            const type = strip(spec.type);
            let tex = null, parts = null;
            if (type === 'chest') {
                tex = await rawTexture('entity/chest/' + strip(spec.texture || 'normal'));
                parts = [
                    { from: [1, 0, 1], to: [15, 10, 15], uv: [0, 19] },
                    { from: [1, 9, 1], to: [15, 14, 15], uv: [0, 0] },
                    { from: [7, 7, 15], to: [9, 11, 16], uv: [0, 0] }
                ];
            } else if (type === 'shulker_box') {
                tex = await rawTexture('entity/shulker/' + strip(spec.texture || 'shulker'));
                parts = [
                    { from: [0, 0, 0], to: [16, 8, 16], uv: [0, 28] },
                    { from: [0, 4, 0], to: [16, 16, 16], uv: [0, 0] }
                ];
            } else if (type === 'head' || type === 'player_head') {
                const kind = type === 'player_head' ? 'player' : strip(spec.kind);
                if (kind === 'player') tex = await rawTexture('entity/player/wide/steve');
                else if (HEADS[kind]) tex = await rawTexture(HEADS[kind][0]);
                if (kind === 'piglin') parts = [{ from: [3, 0, 4], to: [13, 8, 12], uv: [0, 0] }];
                else if (tex) {
                    parts = [{ from: [4, 0, 4], to: [12, 8, 12], uv: [0, 0] }];
                    if (kind === 'player' || kind === 'zombie') parts.push({ from: [4, 0, 4], to: [12, 8, 12], uv: [32, 0], inflate: 0.25, overlay: true });
                }
            }
            else if (type === 'banner') {
                // pole + bar from banner_base, the cloth tinted with the banner's colour
                tex = await rawTexture('entity/banner/banner_base');
                const mask = await rawTexture('entity/banner/base');
                const cloth = mask ? tintedCopy(mask, DYES[strip(spec.color)] || DYES.white) : null;
                const k = 2 / 3;   // the game draws banners at 2/3 size, standing on the bottom of the slot
                const P = (x, y, z) => [8 + x * k, y * k, 8 + z * k];
                parts = [
                    { from: P(-1, 0, -1), to: P(1, 42, 1), uv: [44, 0] },
                    { from: P(-10, 40, -1), to: P(10, 42, 1), uv: [0, 42] },
                    { from: P(-10, 0.5, 1), to: P(10, 40.5, 2), uv: [0, 0] }
                ];
                if (cloth) parts.push({ from: P(-10, 0.5, 1), to: P(10, 40.5, 2), uv: [0, 0], tex: cloth, overlay: true });
            } else if (type === 'shield') {
                // the plain shield (no pattern); entity/shield/base.png is only the white mask for patterns
                tex = await rawTexture('entity/shield/shield_base_nopattern') || await rawTexture('entity/shield_base_nopattern') || await rawTexture('entity/shield/base_nopattern');
                parts = [
                    { from: [2, -3, 9], to: [14, 19, 10], uv: [0, 0] },
                    { from: [7, 5, 10], to: [9, 11, 16], uv: [26, 0] }
                ];
            }
            if (!tex || !parts) return null;
            const turn = iconTurn(base && base.gui);
            parts.forEach(p => { p.turn = turn; });
            const c = document.createElement('canvas');
            c.width = OUT; c.height = OUT;
            drawBoxes(c.getContext('2d'), tex, 64, parts, { scale: OUT / 16, cx: OUT / 2, cy: OUT / 2 });
            return c.toDataURL('image/png');
        }

        /* ── every item ── */

        let ids = [...byName.keys()].map(n => /^assets\/minecraft\/items\/([a-z0-9_]+)\.json$/.exec(n)).filter(Boolean).map(m => m[1]);
        const modern = ids.length > 0;
        if (!modern) ids = [...byName.keys()].map(n => /^assets\/minecraft\/models\/item\/([a-z0-9_]+)\.json$/.exec(n)).filter(Boolean).map(m => m[1]);
        const icons = {}, kinds = {};
        await loadGrassMap();
        let done = 0;
        for (const id of ids) {
            if (++done % 100 === 0) { say(`Drawing item pictures… ${Math.round(done / ids.length * 100)}%`); await new Promise(r => setTimeout(r, 0)); }
            try {
                const parts = (modern && pick(await json(`assets/minecraft/items/${id}.json`))) || [{ ref: 'minecraft:item/' + id }];
                const first = parts[0];
                const m = await model(first.ref);
                let url = null;
                if (first.special) { url = await drawSpecial(first.special, m); if (url) kinds[id] = 'block'; }
                if (!url && m && m.elements && !m.generated) {
                    const extra = [];
                    for (const p of parts.slice(1)) {
                        const pm = await model(p.ref);
                        if (pm && pm.elements && !pm.generated) extra.push({ m: pm, off: p.off, tints: p.tints });
                    }
                    url = await draw3d(m, first.off, extra, first.tints);
                    if (url) kinds[id] = 'block';
                }
                if (!url && m) { url = await drawFlat(m, id, first.tints); if (url) kinds[id] = strip(first.ref).startsWith('block/') ? 'block' : 'item'; }
                if (url) icons[id] = url;
            } catch (err) { /* skip this item */ }
        }
        return { icons, kinds, count: Object.keys(icons).length };
    }

    /* ───────────── entity-style box models (player skin, chest, shulker, heads) ───────────── */

    /**
     * The 6 faces of one box with the usual entity "box UV" layout:
     *   row 1: [top][bottom]  ·  row 2: [right side][front][left side][back]
     * Coordinates in pixels, y up, the front looks at +Z (at the viewer).
     */
    function boxQuads(from, to, u, v, inflate) {
        const [x1, y1, z1] = from, [x2, y2, z2] = to;
        const w = x2 - x1, h = y2 - y1, d = z2 - z1;
        const i = inflate || 0;
        const X1 = x1 - i, Y1 = y1 - i, Z1 = z1 - i, X2 = x2 + i, Y2 = y2 + i, Z2 = z2 + i;
        return [
            { n: [0, 0, 1], c: [[X1, Y2, Z2], [X2, Y2, Z2], [X2, Y1, Z2], [X1, Y1, Z2]], r: [u + d, v + d, w, h] },
            { n: [-1, 0, 0], c: [[X1, Y2, Z1], [X1, Y2, Z2], [X1, Y1, Z2], [X1, Y1, Z1]], r: [u, v + d, d, h] },
            { n: [1, 0, 0], c: [[X2, Y2, Z2], [X2, Y2, Z1], [X2, Y1, Z1], [X2, Y1, Z2]], r: [u + d + w, v + d, d, h] },
            { n: [0, 0, -1], c: [[X2, Y2, Z1], [X1, Y2, Z1], [X1, Y1, Z1], [X2, Y1, Z1]], r: [u + 2 * d + w, v + d, w, h] },
            { n: [0, 1, 0], c: [[X1, Y2, Z1], [X2, Y2, Z1], [X2, Y2, Z2], [X1, Y2, Z2]], r: [u + d, v, w, d] },
            { n: [0, -1, 0], c: [[X1, Y1, Z2], [X2, Y1, Z2], [X2, Y1, Z1], [X1, Y1, Z1]], r: [u + d + w, v, w, d] }
        ];
    }

    const rad = (d) => d * Math.PI / 180;
    /** turn p around the Y axis (deg, positive = the front turns to the viewer's left, like a Minecraft yaw) */
    function yawP(p, deg, o) {
        const a = rad(-deg), c = Math.cos(a), s = Math.sin(a);
        const x = p[0] - o[0], z = p[2] - o[2];
        return [o[0] + x * c + z * s, p[1], o[2] - x * s + z * c];
    }
    /** tilt p around the X axis (deg, positive = the front tips up: a head looks up, a camera sees from below) */
    function pitchP(p, deg, o) {
        const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
        const y = p[1] - o[1], z = p[2] - o[2];
        return [p[0], o[1] + y * c + z * s, o[2] - y * s + z * c];
    }

    /**
     * Draws boxes on a canvas. parts: [{ from, to, uv: [u, v], inflate, overlay, turn(p) → p }].
     * tex: image / canvas, texW: its width in model texture pixels (64 for skins).
     * view: { scale, cx, cy, pitch } — screen = (cx + x·scale, cy − y·scale) after the camera pitch.
     */
    function drawBoxes(g, tex, texW, parts, view) {
        const k = tex.width / texW;
        const L = [-0.35, 0.55, 0.76];                          // light from the front, a bit left and above
        const quads = [];
        for (const part of parts) {
            const turn = part.turn || ((p) => p);
            for (const q of boxQuads(part.from, part.to, part.uv[0], part.uv[1], part.inflate)) {
                if (q.r[2] <= 0 || q.r[3] <= 0) continue;
                // world → camera
                let pts = q.c.map(turn);
                const n0 = turn([0, 0, 0]), n1 = turn(q.n);
                let n = [n1[0] - n0[0], n1[1] - n0[1], n1[2] - n0[2]];
                if (view.pitch) {
                    pts = pts.map(p => pitchP(p, view.pitch, [0, 0, 0]));
                    n = pitchP(n, view.pitch, [0, 0, 0]);
                }
                const nl = Math.hypot(n[0], n[1], n[2]) || 1;
                n = [n[0] / nl, n[1] / nl, n[2] / nl];
                if (n[2] <= 0.001) continue;                        // facing away
                const light = Math.min(1, 0.5 + 0.5 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) + (n[1] > 0.5 ? 0.12 : 0));
                const sp = pts.map(p => [view.cx + p[0] * view.scale, view.cy - p[1] * view.scale, p[2]]);
                quads.push({ sp, r: q.r, light, tex: part.tex || tex, overlay: !!part.overlay, depth: sp.reduce((a, p) => a + p[2], 0) / 4 + (part.overlay ? 0.01 : 0) });
            }
        }
        quads.sort((a, b) => a.depth - b.depth);
        g.imageSmoothingEnabled = false;
        for (const q of quads) {
            const [rx, ry, rw, rh] = q.r;
            let [P0, P1, , P3] = q.sp;
            if (!q.overlay) {
                // grow solid faces a hair so no background shows through the seams
                const cx = (q.sp[0][0] + q.sp[2][0]) / 2, cy = (q.sp[0][1] + q.sp[2][1]) / 2, f = 1.03;
                const grow = (p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f];
                P0 = grow(P0); P1 = grow(P1); P3 = grow(P3);
            }
            g.save();
            g.filter = q.light < 0.999 ? `brightness(${q.light.toFixed(3)})` : 'none';
            g.setTransform((P1[0] - P0[0]) / rw, (P1[1] - P0[1]) / rw, (P3[0] - P0[0]) / rh, (P3[1] - P0[1]) / rh, P0[0], P0[1]);
            const kq = q.tex.width / texW;
            g.drawImage(q.tex, rx * kq, ry * kq, rw * kq, rh * kq, 0, 0, rw, rh);
            g.restore();
        }
    }

    /** Old 64×32 skins → 64×64 (left arm / leg copied from the right ones, mirrored, like the game) */
    function skin64(img) {
        if (img.width !== img.height * 2) return img;
        const k = img.width / 64;
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.width;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0);
        const flip = (sx, sy, w, h, dx, dy) => {
            g.save(); g.translate((dx + w) * k, dy * k); g.scale(-1, 1);
            g.drawImage(img, sx * k, sy * k, w * k, h * k, 0, 0, w * k, h * k); g.restore();
        };
        // [from u, v] → [to u, v] for a 4×12×4 limb: top, bottom, sides swapped, front, back
        [[0, 16, 16, 48], [40, 16, 32, 48]].forEach(([u, v, U, V]) => {
            flip(u + 4, v, 4, 4, U + 4, V); flip(u + 8, v, 4, 4, U + 8, V);
            flip(u + 8, v + 4, 4, 12, U, V + 4); flip(u + 4, v + 4, 4, 12, U + 4, V + 4);
            flip(u, v + 4, 4, 12, U + 8, V + 4); flip(u + 12, v + 4, 4, 12, U + 12, V + 4);
        });
        return c;
    }

    /**
     * A whole player from a skin, like the 3D models in game.
     * opt: { yaw, headYaw (relative to the body), headPitch, pitch (camera), slim, hat (overlay layers) }
     * Fitted in the canvas: 16 × 32 skin pixels, feet near the bottom.
     */
    function player(canvas, skinImg, opt) {
        opt = opt || {};
        const tex = skin64(skinImg);
        const g = canvas.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / 17, canvas.height / 33.5);
        const view = { scale, cx: canvas.width / 2, cy: canvas.height / 2 + 16.25 * scale, pitch: opt.pitch || 0 };
        const yaw = +opt.yaw || 0, hy = +opt.headYaw || 0, hp = +opt.headPitch || 0;
        const body = (p) => yawP(p, yaw, [0, 0, 0]);
        const head = (p) => body(yawP(pitchP(p, hp, [0, 24, 0]), hy, [0, 24, 0]));
        const a = opt.slim ? 3 : 4;
        const layers = opt.hat !== false;
        const parts = [
            { from: [-4, 24, -4], to: [4, 32, 4], uv: [0, 0], turn: head },
            { from: [-4, 12, -2], to: [4, 24, 2], uv: [16, 16], turn: body },
            { from: [-4 - a, 12, -2], to: [-4, 24, 2], uv: [40, 16], turn: body },
            { from: [4, 12, -2], to: [4 + a, 24, 2], uv: [32, 48], turn: body },
            { from: [-4, 0, -2], to: [0, 12, 2], uv: [0, 16], turn: body },
            { from: [0, 0, -2], to: [4, 12, 2], uv: [16, 48], turn: body }
        ];
        if (layers && skinImg.width === skinImg.height) {
            parts.push(
                { from: [-4, 12, -2], to: [4, 24, 2], uv: [16, 32], inflate: 0.25, overlay: true, turn: body },
                { from: [-4 - a, 12, -2], to: [-4, 24, 2], uv: [40, 32], inflate: 0.25, overlay: true, turn: body },
                { from: [4, 12, -2], to: [4 + a, 24, 2], uv: [48, 48], inflate: 0.25, overlay: true, turn: body },
                { from: [-4, 0, -2], to: [0, 12, 2], uv: [0, 32], inflate: 0.25, overlay: true, turn: body },
                { from: [0, 0, -2], to: [4, 12, 2], uv: [0, 48], inflate: 0.25, overlay: true, turn: body });
        }
        if (layers) parts.push({ from: [-4, 24, -4], to: [4, 32, 4], uv: [32, 0], inflate: 0.5, overlay: true, turn: head });
        drawBoxes(g, tex, 64, parts, view);
        return canvas;
    }

    // VERSION: bump when the pictures change, so GUI Studio asks to draw them again
    GS.McRender = { render, OUT, drawBoxes, player, skin64, VERSION: 3 };
})();
