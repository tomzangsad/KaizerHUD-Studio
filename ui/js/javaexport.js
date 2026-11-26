/* ========================================
   Java HUD config export (File → Export Java HUD Config…)

   Turns the project into config folders for a Java-edition HUD plugin:
     • BetterHud  (huds / layouts / images / texts / heads + assets)
     • MythicHUD  (layouts / hud_assets / listeners + textures)
   plus the hotbar texture and see-through vanilla bar sprites for the
   server's resource-pack plugin (ItemsAdder / Nexo / Oraxen). The Rust command `export_java_hud`
   only zips the files and asks where to save them.

   Coordinates are the inverse of the importer (src-tauri/src/javahud.rs):
     editor box = anchor point (480×270 GUI screen) + offset − anchor·size
     Java hotbar sits on the bottom edge, ours 2px above → bottom items +2px
   ======================================== */
(function () {
    'use strict';

    const W = 480;
    const H = 270;
    const HOTBAR_LIFT = 2;
    // BetterHud draws every layout entry 1 GUI px left of where it is placed, at every anchor
    // (measured with the calibration project 2026-11-22; Bedrock with the same capture is exact).
    // Added to the x of every BetterHud image / tile / text / head entry; MythicHUD is unchanged.
    const JAVA_X_NUDGE = 1;
    const ANCH = {
        top_left: [0, 0], top_middle: [0.5, 0], top_right: [1, 0],
        middle_left: [0, 0.5], center: [0.5, 0.5], middle_right: [1, 0.5],
        bottom_left: [0, 1], bottom_middle: [0.5, 1], bottom_right: [1, 1],
    };
    // Bedrock font sizes → Java text scale (16px font); same thresholds as the importer
    // small measured in game 2026-11-22: Bedrock small text is half of normal (was 0.67, 1.4x too big)
    const FONT_SCALE = { small: 0.5, normal: 1, large: 1.5 };
    // Properties-panel defaults for text_offset, per text alignment (see javaimport.js)
    const TEXT_DEFAULT_OFFSET = {
        top: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] },
        middle: { small: [0, 0.9], normal: [0, 1.4], large: [0, 2] },
    };
    // the editor's XP bar type ('exp', e.g. from an imported pack) uses the same listener as %player_exp%
    const VANILLA_LISTENER = { hp: 'health', food: 'food', armor: 'armor', air: 'air', exp: 'exp' };
    // custom bars that read a vanilla value → the plugin's built-in listener
    const PAPI_LISTENER = [
        { papi: '%player_health%', max: ['%player_max_health%', '20'], listener: 'health' },
        { papi: '%player_food_level%', max: ['20'], listener: 'food' },
        { papi: '%player_remaining_air%', max: ['%player_max_air%', '300'], listener: 'air' },
        { papi: '%player_exp%', max: ['1', '100', ''], listener: 'exp' },
        { papi: '%player_absorption%', max: ['%player_max_health%'], listener: 'absorption', betterOnly: true },
    ];
    const VANILLA_SPRITES = {
        health: (() => {
            const out = ['container', 'container_blinking', 'container_hardcore', 'container_hardcore_blinking'];
            const kinds = ['', 'absorbing_', 'frozen_', 'poisoned_', 'withered_'];
            const parts = ['full', 'full_blinking', 'half', 'half_blinking', 'hardcore_full', 'hardcore_full_blinking', 'hardcore_half', 'hardcore_half_blinking'];
            kinds.forEach((k) => parts.forEach((p) => out.push(k + p)));
            return out.map((n) => ['heart/' + n, 9, 9]);
        })(),
        food: ['food_empty', 'food_empty_hunger', 'food_full', 'food_full_hunger', 'food_half', 'food_half_hunger'].map((n) => [n, 9, 9]),
        armor: ['armor_empty', 'armor_full', 'armor_half'].map((n) => [n, 9, 9]),
        air: ['air', 'air_bursting', 'air_empty'].map((n) => [n, 9, 9]),
        exp: [['experience_bar_background', 182, 5], ['experience_bar_progress', 182, 5]],
    };
    const MYTHIC_ELEMENT = { health: 'HEALTH', food: 'HUNGER', armor: 'ARMOR', air: 'AIR', exp: 'EXPERIENCE' };

    /* ───────────── small helpers ───────────── */

    const r1 = (v) => Math.round(v * 10) / 10;
    const ri = (v) => Math.round(v);
    function slug(s, fallback) {
        const v = String(s == null ? '' : s).toLowerCase().replace(/\.png$/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
        return v || fallback || 'x';
    }
    function uniq(set, base) {
        let n = base;
        let i = 2;
        while (set.has(n)) n = `${base}_${i++}`;
        set.add(n);
        return n;
    }
    function frac(anchor) {
        return ANCH[anchor] || ANCH.top_left;
    }
    function hex(rgb) {
        if (!Array.isArray(rgb)) return null;
        const h = rgb.slice(0, 3).map((c) => Math.max(0, Math.min(255, Math.round((+c || 0) * 255))).toString(16).padStart(2, '0')).join('');
        return h === 'ffffff' ? null : '#' + h;
    }
    function isWhite(rgb) {
        return !Array.isArray(rgb) || rgb.slice(0, 3).every((c) => +c >= 0.999);
    }
    /** YAML scalar: numbers as-is, everything else double-quoted (JSON strings are valid YAML) */
    function q(v) {
        if (typeof v === 'number') return String(Number.isInteger(v) ? v : Math.round(v * 100) / 100);
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return JSON.stringify(String(v));
    }
    /** Minimal YAML writer for nested plain objects / arrays of scalars */
    function yaml(obj, indent) {
        const pad = '  '.repeat(indent || 0);
        let out = '';
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null) continue;
            const key = /^[A-Za-z0-9_.-]+$/.test(k) ? k : JSON.stringify(k);
            if (Array.isArray(v)) {
                if (!v.length) out += `${pad}${key}: []\n`;
                else out += `${pad}${key}:\n` + v.map((x) => `${pad}  - ${q(x)}\n`).join('');
            } else if (typeof v === 'object') {
                const inner = yaml(v, (indent || 0) + 1);
                out += inner ? `${pad}${key}:\n${inner}` : `${pad}${key}: {}\n`;
            } else {
                out += `${pad}${key}: ${q(v)}\n`;
            }
        }
        return out;
    }
    function papiName(p) {
        const s = String(p || '').trim();
        const m = /^%([^%]+)%$/.exec(s);
        return m ? m[1] : null;
    }
    function isNumber(v) {
        return /^-?\d+(\.\d+)?$/.test(String(v).trim());
    }
    function invertOp(op) {
        return { '==': '!=', '!=': '==', '>': '<=', '<': '>=', '>=': '<', '<=': '>' }[op] || op;
    }

    /* ───────────── project → plugin-neutral items ───────────── */

    function linkedPosition(elements, el) {
        if (typeof getPositionTargetElement === 'function') return getPositionTargetElement(elements, el);
        let cur = el;
        const seen = new Set();
        while (cur && cur.useLinkedPosition && cur.linkedPositionId && !seen.has(cur.id)) {
            seen.add(cur.id);
            const next = elements.find((e) => e.id === cur.linkedPositionId && e.id !== cur.id);
            if (!next) break;
            cur = next;
        }
        return cur || el;
    }
    function linkedBar(elements, el) {
        if (typeof resolveBarForRender === 'function') return resolveBarForRender(elements, el) || el;
        return el;
    }

    /** Screen box (y down, GUI px) + the anchor it is measured from */
    function screenBox(pos, w, h) {
        const [fx, fy] = frac(pos.anchor_from);
        const off = pos.offset || [0, 0];
        const x = fx * W + (+off[0] || 0) - fx * w;
        let y = fy * H + (+off[1] || 0) - fy * h;
        if (fy === 1) y += HOTBAR_LIFT;
        return { anchor: pos.anchor_from in ANCH ? pos.anchor_from : 'top_left', fx, fy, x, y, w, h };
    }

    /** Every show/hide condition of the element (all must be true): the main one and the
        "+ Add condition" ones. Returns { list, errors }; list is null when there is none. */
    function visibilityOf(el) {
        const raw = [];
        const main = String(el.visibilityPapi || '').trim();
        const mainOp = el.visibilityOperator || '==';
        if ((main || el.visibilityEnabled) && mainOp !== 'always') {
            raw.push({ papi: main, op: mainOp, value: el.visibilityValue, invert: el.visibilityInvert === true });
        }
        (Array.isArray(el.visibilityExtra) ? el.visibilityExtra : []).forEach((c) => {
            if (c && String(c.papi || '').trim() && c.op !== 'always') raw.push(c);
        });
        const list = [];
        const errors = [];
        for (const c of raw) {
            const papi = String(c.papi || '').trim();
            if (!papiName(papi)) {
                errors.push(`"${el.name}": a show/hide condition needs one %placeholder% — skipped`);
                continue;
            }
            let op = c.op || '==';
            if (c.invert) op = invertOp(op);
            list.push({ papi, op, value: String(c.value == null ? '' : c.value).trim() });
        }
        return { list: list.length ? list : null, errors };
    }

    /**
     * Reads the editor elements of the chosen groups.
     * Returns { items, notes } where every item has an absolute screen box.
     */
    function collect(project, opts) {
        const elements = project.elements || [];
        const groups = opts.groups ? new Set(opts.groups) : null;
        const items = [];
        const notes = [];
        for (const el of elements) {
            const group = el.group || 'Main';
            if (groups && !groups.has(group)) continue;
            const pos = linkedPosition(elements, el);
            const layer = ri(+pos.layer || +el.layer || 0);
            const alpha = el.alpha === undefined ? 1 : +el.alpha;
            const vis = visibilityOf(el);
            notes.push(...vis.errors);
            const base = { id: el.id, name: el.name || `${el.type}_${el.id}`, group, layer, alpha, vis: vis.list };

            if (el.type === 'image') {
                if (!el.imageData) { notes.push(`"${base.name}": image has no picture — skipped`); continue; }
                const [w, h] = (pos.size || el.size || [16, 16]).map((v) => Math.max(1, ri(+v)));
                const animated = Array.isArray(el.animFrames) && el.animFrames.length > 1;
                items.push({
                    ...base, kind: 'image', box: screenBox(pos, w, h), data: animated ? el.animFrames[0] : el.imageData,
                    tint: isWhite(el.color) ? null : el.color, file: el.imageName || el.name,
                    // animation.js: frame list + frames per second
                    frames: animated ? el.animFrames : null,
                    fps: animated ? Math.min(60, Math.max(1, Math.round(+el.animFps || 10))) : 0,
                });
            } else if (el.type === 'bar') {
                const bar = linkedBar(elements, el);
                const data = bar.imageData || el.imageData;
                if (!data) { notes.push(`"${base.name}": bar has no picture — skipped`); continue; }
                const full = bar.barMaxSize || el.barMaxSize || pos.size || el.size;
                const [w, h] = full.map((v) => Math.max(1, ri(+v)));
                const [pw, ph] = (pos.size || el.size || full).map((v) => +v);
                const dir = bar.sliceDirection || el.sliceDirection || 'left';
                const type = bar.barType || 'hp';
                let source;
                if (VANILLA_LISTENER[type]) {
                    source = { listener: VANILLA_LISTENER[type] };
                } else {
                    const papi = String(bar.barCustomPapi || '').trim();
                    const max = String(bar.barCustomMax || '').trim();
                    if (!papiName(papi)) { notes.push(`"${base.name}": custom bar needs a %placeholder% value — skipped`); continue; }
                    const known = PAPI_LISTENER.find((k) => k.papi === papi && k.max.includes(max));
                    source = known ? { listener: known.listener, betterOnly: !!known.betterOnly, papi, max } : { papi, max: max || '100', tag: slug(bar.barCustomTag || base.name, 'bar') };
                    if (!max && !known) notes.push(`"${base.name}": custom bar has no Max — 100 used`);
                }
                // the box is placed by the size shown in the editor, the texture is the full bar
                const box = screenBox(pos, pw, ph);
                box.w = w; box.h = h;
                if (Math.abs(pw - w) > 0.5 || Math.abs(ph - h) > 0.5) {
                    if (box.fx > 0) box.x -= (w - pw) * box.fx;
                    if (box.fy > 0) box.y -= (h - ph) * box.fy;
                }
                items.push({ ...base, kind: 'bar', box, data, dir, source, file: el.name });
            } else if (el.type === 'text' || el.type === 'xp_label') {
                const isXp = el.type === 'xp_label';
                const papi = isXp ? '%player_level%' : String(el.papi_placeholder || '').trim();
                if (!papi) { notes.push(`"${base.name}": text has no placeholder — skipped`); continue; }
                const size = (isXp ? el.xp_font_size : el.font_size) || 'small';
                const eff = FONT_SCALE[size] || 1;
                const th = 9 * eff;
                // top-aligned small text: Bedrock draws the glyphs ~2 px below the box top,
                // Java draws them at y (measured in game 2026-11-22); centred text already matches
                const small = size === 'small' && !isXp;
                const [fx, fy] = frac(pos.anchor_from);
                const off = pos.offset || [0, 0];
                let ax;
                let top;
                let align;
                if (isXp) {
                    // centred in its box; the old 20×10 default is read as 12×9 (app.js xpBoxSize)
                    let [w, h] = (pos.size || el.size || [12, 9]).map((v) => +v);
                    if (!(w > 0) || !(h > 0) || (w === 20 && h === 10)) [w, h] = [12, 9];
                    const b = screenBox(pos, w, h);
                    ax = b.x + w / 2;
                    top = b.y + h / 2 - th / 2;
                    align = 'center';
                } else {
                    const px = fx * W + (+off[0] || 0);
                    const py = fy * H + (+off[1] || 0) + (fy === 1 ? HOTBAR_LIFT : 0);
                    const [tx, ty] = frac(el.text_anchor_from || 'top_left');
                    align = tx === 0 ? 'left' : tx === 1 ? 'right' : 'center';
                    const to = el.text_offset || [0, 0];
                    const row = ty === 0.5 ? 'middle' : 'top';
                    const def = TEXT_DEFAULT_OFFSET[row][size] || [0, 0];
                    const dx = (+to[0] || 0) - def[0];
                    const dy = (+to[1] || 0) - def[1];
                    ax = px + dx;
                    top = (ty === 0.5 ? py - th / 2 : ty === 1 ? py - th : py) + dy + (small && ty === 0 ? 2 : 0);
                    if (base.vis) notes.push(`"${base.name}": show/hide on a text — the condition is kept in the Java config`);
                }
                items.push({
                    ...base, kind: 'text', anchor: pos.anchor_from in ANCH ? pos.anchor_from : 'top_left', fx, fy,
                    ax, top, align, eff, th, papi,
                    color: hex(isXp ? el.xp_color : el.color),
                    shadow: isXp ? el.xp_shadow !== false : !!el.shadow,
                    xp: isXp,
                });
            } else if (el.type === 'player_head') {
                const [w, h] = (pos.size || el.size || [35, 31]).map((v) => +v);
                const b = screenBox(pos, w, h);
                const pixel = Math.max(1, Math.round(Math.min(w, h) / 8));
                const s = pixel * 8;
                b.x += (w - s) / 2; b.y += (h - s) / 2; b.w = s; b.h = s;
                items.push({ ...base, kind: 'head', box: b, pixel });
            } else if (el.type === 'nameplate') {
                notes.push(`"${base.name}": nameplates are Bedrock-only — skipped`);
            }
        }
        return { items, notes };
    }

    /* ───────────── pictures ───────────── */

    /**
     * Gives every picture one file. `helper.prepare(data, w, h, tint)` resizes /
     * tints in the browser and returns base64; identical results share a file.
     */
    async function pictures(items, helper, dir, withFrames = true) {
        const byKey = new Map();
        const names = new Set();
        const files = [];
        for (const it of items) {
            if (it.kind !== 'image' && it.kind !== 'bar') continue;
            const key = [it.data.length, it.data.slice(-64), it.box.w, it.box.h, (it.tint || []).join(',')].join('|') + '|' + it.data
                + (it.frames ? `|anim|${it.frames.length}|${it.frames.join('|')}` : '');
            if (byKey.has(key)) { it.png = byKey.get(key); continue; }
            const b64 = await helper.prepare(it.data, it.box.w, it.box.h, it.tint);
            const name = uniq(names, slug(it.file, 'img'));
            const png = { name, file: `${name}.png`, base64: b64 };
            files.push({ path: `${dir}/${png.file}`, base64: b64 });
            if (it.frames && withFrames) {
                // frame 1 is the file above; the others follow as name_2.png, name_3.png …
                png.frames = [png.file];
                for (let i = 1; i < it.frames.length; i++) {
                    const fb = await helper.prepare(it.frames[i], it.box.w, it.box.h, it.tint);
                    const ff = `${name}_${i + 1}.png`;
                    names.add(`${name}_${i + 1}`);
                    files.push({ path: `${dir}/${ff}`, base64: fb });
                    png.frames.push(ff);
                }
            }
            byKey.set(key, png);
            it.png = png;
        }
        return files;
    }

    /**
     * BetterHud draws every picture as a font glyph, and Minecraft packs glyphs
     * into 256×256 pages: a picture wider or taller than that is silently
     * dropped in game. Pictures over TILE px are cut into tiles that are placed
     * side by side (bars keep one file: their split frames are small).
     * BetterHud also trims fully transparent rows/columns off each picture but
     * keeps its y, so art with an empty top edge is drawn too high. Each tile
     * is trimmed here instead and the trimmed amount is added to x/y.
     */
    const TILE = 200;
    async function splitWide(items, pics, helper) {
        const out = [];
        const done = new Map(); // png name → tiles
        for (const f of pics) {
            const it = items.find((i) => i.png && i.png.base64 === f.base64 && i.kind === 'image');
            const png = it && it.png;
            // animation frames are kept whole: every frame must line up with the others
            if (png && png.frames) { out.push(f); continue; }
            const size = png && helper.size ? await helper.size('data:image/png;base64,' + png.base64) : null;
            if (!png || !size || done.has(png.name)) { out.push(f); continue; }
            const wide = size.w > TILE || size.h > TILE;
            if (!wide && !helper.bbox) { out.push(f); continue; }
            const nx = Math.ceil(size.w / TILE), ny = Math.ceil(size.h / TILE);
            const tw = Math.ceil(size.w / nx), th = Math.ceil(size.h / ny);
            const data = 'data:image/png;base64,' + png.base64;
            const tiles = [];
            let trimmed = false;
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    let x0 = i * tw, y0 = j * th;
                    let w = Math.min(tw, size.w - x0), h = Math.min(th, size.h - y0);
                    const bb = helper.bbox ? await helper.bbox(data, x0, y0, w, h) : { x: 0, y: 0, w, h };
                    if (!bb) { trimmed = true; continue; } // fully transparent tile
                    if (bb.x || bb.y || bb.w !== w || bb.h !== h) trimmed = true;
                    x0 += bb.x; y0 += bb.y; w = bb.w; h = bb.h;
                    tiles.push({ x: x0, y: y0, w, h });
                }
            }
            if (!wide && !trimmed) { out.push(f); continue; }
            if (!tiles.length) { out.push(f); continue; } // empty picture: leave as is
            const single = tiles.length === 1;
            for (let n = 0; n < tiles.length; n++) {
                const t = tiles[n];
                t.name = single ? `${png.name}_t` : `${png.name}_${n + 1}`;
                t.file = `${t.name}.png`;
                out.push({ path: f.path.replace(/[^/]+$/, t.file), base64: await helper.crop(data, t.x, t.y, t.w, t.h) });
            }
            // a bar that uses the same picture still needs the untrimmed file
            if (items.some((i) => i.png === png && i.kind === 'bar')) out.push(f);
            png.tiles = tiles;
            done.set(png.name, tiles);
        }
        return out;
    }

    /** Hotbar texture + see-through vanilla bars for the resource-pack plugin */
    async function packFiles(items, project, opts, helper, notes) {
        const files = [];
        if (!opts.host) return { files, dir: null };
        const ns = opts.ns;
        const root = {
            itemsadder: `ItemsAdder/contents/${ns}_hotbar/resourcepack/assets/minecraft/textures/gui/sprites/hud`,
            nexo: `Nexo/pack/external_packs/${ns}_hotbar/assets/minecraft/textures/gui/sprites/hud`,
            oraxen: `Oraxen/pack/assets/minecraft/textures/gui/sprites/hud`,
            none: `resourcepack/assets/minecraft/textures/gui/sprites/hud`,
        }[opts.host];
        if (opts.hotbar && project.widgetsImageData) {
            const sheet = project.widgetsImageData;
            files.push({ path: `${root}/hotbar.png`, base64: await helper.crop(sheet, 0, 0, 182, 22) });
            files.push({ path: `${root}/hotbar_selection.png`, base64: await helper.crop(sheet, 0, 22, 24, 23) });
        } else if (opts.hotbar) {
            notes.push('The project has no hotbar texture (Widgets) — the vanilla hotbar stays');
        }
        if (opts.hideVanilla && opts.plugin === 'betterhud') {
            const used = vanillaUsed(items);
            const blanks = new Map();
            for (const kind of used) {
                for (const [name, w, h] of VANILLA_SPRITES[kind]) {
                    const k = `${w}x${h}`;
                    if (!blanks.has(k)) blanks.set(k, await helper.blank(w, h));
                    files.push({ path: `${root}/${name}.png`, base64: blanks.get(k) });
                }
            }
        }
        return { files, dir: root };
    }

    function vanillaUsed(items) {
        const used = new Set();
        for (const it of items) {
            // the XP level number is text, not a sprite: handled by shader.yml / EXPERIENCE_LEVEL
            if (it.kind === 'bar' && it.source.listener && VANILLA_SPRITES[it.source.listener]) used.add(it.source.listener);
        }
        return [...used];
    }

    /* ───────────── BetterHud ───────────── */

    /** BetterHud `conditions:` — numbered entries, all must be true */
    function betterCondition(list) {
        const out = {};
        list.forEach((vis, i) => {
            const name = papiName(vis.papi);
            const numeric = isNumber(vis.value);
            let op = vis.op;
            if (!numeric && op !== '==' && op !== '!=') op = '==';
            out[i + 1] = {
                first: numeric ? `(number)papi:${name}` : `papi:${name}`,
                second: numeric ? vis.value : `'${vis.value.replace(/'/g, '')}'`,
                operation: op,
            };
        });
        return out;
    }
    // BetterHud reads '/' as an escape ('/x' prints x), and [ ] as placeholder brackets,
    // so plain text gets '//', '/[' and '/]' (e.g. "%a%/%b%" → "[papi:a]//[papi:b]")
    function betterPattern(papi, color) {
        const esc = (t) => t.replace(/[\/\[\]]/g, (c) => '/' + c);
        const parts = String(papi).split(/(%[^%\s]+%)/g);
        const p = parts.map((t, i) => (i % 2 ? `[papi:${t.slice(1, -1)}]` : esc(t))).join('');
        return (color ? `<${color}>` : '') + p;
    }
    function betterValue(v) {
        const name = papiName(v);
        if (name) return `(number)papi:${name}`;
        return isNumber(v) ? Number(v) : v;
    }

    async function buildBetterHud(project, opts, helper) {
        const ns = opts.ns;
        const { items, notes } = collect(project, opts);
        const files = [];
        const pics = await pictures(items, helper, `BetterHud/assets/${ns}`);
        files.push(...await splitWide(items, pics, helper));
        const images = {};
        const imageIds = new Map(); // png name + bar → image id
        const layouts = {};
        const huds = {};
        const heads = {};
        const font = `${ns}_font`;
        const hudIds = [];
        const groupIds = new Set();
        const layoutNames = new Set();

        const groupsInOrder = [...new Set(items.map((i) => i.group))];
        for (const group of groupsInOrder) {
            const hudId = uniq(groupIds, `${ns}_${slug(group, 'main')}`);
            hudIds.push(hudId);
            const byAnchor = new Map();
            for (const it of items.filter((i) => i.group === group)) {
                const a = it.box ? it.box.anchor : it.anchor;
                if (!byAnchor.has(a)) byAnchor.set(a, []);
                byAnchor.get(a).push(it);
            }
            const hud = { layouts: {} };
            let li = 1;
            for (const [anchor, list] of byAnchor) {
                const [fx, fy] = frac(anchor);
                const lname = uniq(layoutNames, `${hudId}_${anchor}`);
                // left/left: no automatic line shift (default offset CENTER moves by −widest/2)
                const layout = { align: 'left', offset: 'left' };
                const imgs = {};
                const texts = {};
                const hds = {};
                let ni = 1;
                let nt = 1;
                let nh = 1;
                list.sort((a, b) => a.layer - b.layer);
                for (const it of list) {
                    const ox = fx * W;
                    const oy = fy * H;
                    if (it.kind === 'image' || it.kind === 'bar') {
                        const idKey = it.png.name + (it.kind === 'bar' ? `|bar|${JSON.stringify(it.source)}|${it.dir}` : '') + (it.png.frames ? `|anim|${it.fps}` : '');
                        let iid = imageIds.get(idKey);
                        if (!iid) {
                            iid = uniq(new Set(Object.keys(images)), `${ns}_${it.png.name}${it.kind === 'bar' ? '_bar' : ''}`);
                            imageIds.set(idKey, iid);
                            if (it.kind === 'image' && it.png.frames) {
                                // BetterHud sequence: `file:ticks` per frame (20 ticks = 1 second)
                                const ticks = Math.max(1, Math.round(20 / it.fps));
                                if (Math.abs(20 / ticks - it.fps) > 0.05) notes.push(`"${it.name}": ${it.fps} fps becomes ${r1(20 / ticks)} fps in BetterHud (whole ticks)`);
                                if (it.box.w > 256 || it.box.h > 256) notes.push(`"${it.name}": animation frames over 256 px are not shown by BetterHud — make the image smaller`);
                                images[iid] = { type: 'sequence', files: it.png.frames.map((f) => `${ns}/${f}:${ticks}`) };
                            } else if (it.kind === 'image') {
                                images[iid] = { type: 'single', file: `${ns}/${it.png.file}` };
                            } else {
                                const vertical = it.dir === 'top' || it.dir === 'bottom';
                                const len = vertical ? it.box.h : it.box.w;
                                const setting = it.source.listener
                                    ? { listener: { class: it.source.listener } }
                                    : { listener: { class: 'placeholder', value: betterValue(it.source.papi), max: betterValue(it.source.max) } };
                                images[iid] = {
                                    type: 'listener',
                                    file: `${ns}/${it.png.file}`,
                                    split: Math.max(2, Math.min(100, ri(len))),
                                    'split-type': { left: 'left', right: 'right', bottom: 'up', top: 'down' }[it.dir] || 'left',
                                    setting,
                                };
                            }
                        }
                        const parts = it.kind === 'image' && it.png.tiles
                            ? it.png.tiles.map((t) => {
                                const tid = imageIds.get(`tile|${t.name}`) || uniq(new Set(Object.keys(images)), `${ns}_${t.name}`);
                                if (!imageIds.has(`tile|${t.name}`)) {
                                    imageIds.set(`tile|${t.name}`, tid);
                                    images[tid] = { type: 'single', file: `${ns}/${t.file}` };
                                }
                                return { id: tid, dx: t.x, dy: t.y };
                            })
                            : [{ id: iid, dx: 0, dy: 0 }];
                        if (it.png.tiles && images[iid] && images[iid].type === 'single' && images[iid].file === `${ns}/${it.png.file}`) delete images[iid];
                        for (const part of parts) {
                            const entry = { name: part.id, x: ri(it.box.x - ox) + part.dx + JAVA_X_NUDGE, y: ri(it.box.y - oy) + part.dy, layer: it.layer };
                            if (it.alpha < 1) entry.opacity = r1(it.alpha);
                            if (it.vis) entry.conditions = betterCondition(it.vis);
                            imgs[ni++] = entry;
                        }
                    } else if (it.kind === 'text') {
                        const entry = {
                            name: font,
                            pattern: betterPattern(it.papi, it.color),
                            x: ri(it.ax - ox) + JAVA_X_NUDGE,
                            y: ri(it.top - oy),
                            // the 16 px BetterHud font is twice vanilla text: scale 0.5 = normal
                            scale: Math.round(it.eff * 0.5 * 1000) / 1000,
                            align: it.align,
                            outline: it.shadow,
                            layer: it.layer,
                        };
                        if (it.xp) entry.pattern = (it.color ? `<${it.color}>` : '') + '[level]';
                        if (it.vis) entry.conditions = betterCondition(it.vis);
                        texts[nt++] = entry;
                    } else if (it.kind === 'head') {
                        const hid = `${ns}_head_${it.pixel}`;
                        heads[hid] = { pixel: it.pixel };
                        const entry = { name: hid, x: ri(it.box.x - ox) + JAVA_X_NUDGE, y: ri(it.box.y - oy), layer: it.layer };
                        if (it.vis) entry.conditions = betterCondition(it.vis);
                        hds[nh++] = entry;
                    }
                }
                if (ni > 1) layout.images = imgs;
                if (nt > 1) layout.texts = texts;
                if (nh > 1) layout.heads = hds;
                layouts[lname] = layout;
                hud.layouts[li++] = { name: lname, x: ri(fx * 100), y: ri(fy * 100) };
            }
            huds[hudId] = hud;
        }
        if (!hudIds.length) throw new Error('Nothing to export: the chosen groups have no images, bars, texts or heads');

        const head = `# Made with KaizerHUD Studio — ${opts.projectName || ns}\n`;
        files.push({ path: `BetterHud/huds/${ns}.yml`, text: head + yaml(huds) });
        files.push({ path: `BetterHud/layouts/${ns}.yml`, text: head + yaml(layouts) });
        files.push({ path: `BetterHud/images/${ns}.yml`, text: head + yaml(images) });
        files.push({ path: `BetterHud/texts/${ns}.yml`, text: head + yaml({ [font]: { 'merge-default-bitmap': true, scale: 16 } }) });
        if (Object.keys(heads).length) files.push({ path: `BetterHud/heads/${ns}.yml`, text: head + yaml(heads) });

        const host = opts.host || 'none';
        const build = {
            itemsadder: { 'build-folder-location': 'ItemsAdder/contents/betterhud/resourcepack', 'pack-type': 'folder' },
            nexo: { 'build-folder-location': 'Nexo/pack/external_packs/BetterHud', 'pack-type': 'zip' },
            oraxen: { 'build-folder-location': 'Oraxen/pack/uploads/BetterHud', 'pack-type': 'folder' },
            none: { 'build-folder-location': 'BetterHud/build', 'pack-type': 'folder' },
        }[host];
        const config = {
            debug: false, 'auto-save-time': 300, 'location-provide-time': 1, 'debug-level': 'assets', metrics: true,
            'version-check': true, 'number-format': '#,###.#', 'tick-speed': 1, namespace: 'betterhud',
            'default-font-name': 'font.ttf', 'bossbar-line': 1, 'bossbar-resource-pack-line': 0, 'merge-boss-bar': true,
            'disable-to-bedrock-player': true, ...build, 'enable-protection': false, 'enable-self-host': false,
            'force-update': false, 'self-host-ip': '*', 'self-host-port': 8163, 'merge-other-folders': [], 'loading-head': 'random',
            'default-hud': opts.defaultOn === false ? [] : hudIds, 'default-popup': [], 'default-compass': [],
            'load-minecraft-default-textures': false, 'included-minecraft-list': ['block', 'item'], 'resourcepack-obfuscation': false,
            'clear-build-folder': true, 'use-legacy-format': false, 'legacy-serializer': 'ampersand', 'minecraft-jar-version': 'bukkit',
            'remove-default-hotbar': false,
            // our coordinates already sit on the hotbar line; no extra −54px
            'disable-legacy-offset': true,
            'merge-with-external-resources': true,
        };
        files.push({ path: 'BetterHud/config.yml', text: head + yaml(config) });
        const pack = await packFiles(items, project, opts, helper, notes);
        files.push(...pack.files);
        if (opts.hideVanilla && items.some((i) => i.kind === 'text' && i.xp)) {
            files.push({ path: 'BetterHud/shader.yml', text: head + yaml({ 'disable-level-text': true }) });
        }
        files.push({ path: 'README_KaizerHUD.txt', text: readme('betterhud', host, ns, hudIds, opts) });
        return { files, notes, huds: hudIds, items: items.length };
    }

    /* ───────────── MythicHUD ───────────── */

    function mythicCondition(vis) {
        const v = vis.value.replace(/[;{}]/g, '');
        // `<test> true hide` = shown only while the test is true; `false hide` = while it is false.
        // Text values only compare equal, so "!=" becomes "== … false".
        const neg = vis.op === '!=';
        const op = neg ? '==' : vis.op;
        const o = isNumber(v) ? `;o=${op}` : '';
        if (!isNumber(v) && op !== '==') return null;
        return `placeholder{ph=${vis.papi};v=${v}${o}} ${neg ? 'false' : 'true'} hide`;
    }

    async function buildMythicHud(project, opts, helper) {
        const ns = opts.ns;
        const { items, notes } = collect(project, opts);
        const files = [];
        files.push(...await pictures(items, helper, `MythicHUD/textures/${ns}`, false));
        const layouts = {};
        const assets = {};
        const listeners = {};
        const layoutIds = [];
        const groupIds = new Set();
        const assetIds = new Set();
        const listenerIds = new Set();
        const listenerFor = new Map();

        const groupsInOrder = [...new Set(items.map((i) => i.group))];
        for (const group of groupsInOrder) {
            const lid = uniq(groupIds, `${ns}_${slug(group, 'main')}`);
            layoutIds.push(lid);
            const elements = {};
            const list = items.filter((i) => i.group === group).sort((a, b) => a.layer - b.layer);
            for (const it of list) {
                const aid = uniq(assetIds, `${ns}_${slug(it.name, it.kind)}`);
                const asset = {};
                if (it.vis) {
                    // every `... hide` line must pass, so the list is an AND like the editor's
                    const conds = [];
                    for (const v of it.vis) {
                        const c = mythicCondition(v);
                        if (c) conds.push(c);
                        else notes.push(`"${it.name}": MythicHUD can only compare text with == / != — condition skipped`);
                    }
                    if (conds.length) asset.conditions = conds;
                }
                const fx = it.box ? it.box.fx : it.fx;
                const fy = it.box ? it.box.fy : it.fy;
                const position = { x: ri(fx * 100), y: ri((1 - fy) * 100) };
                let layer;
                let align = 'right'; // asset starts at the point and runs right
                let ox;
                let topRel;
                if (it.kind === 'image' || it.kind === 'bar') {
                    layer = { texture: { path: `${ns}/${it.png.file}` } };
                    if (it.alpha < 1) notes.push(`"${it.name}": transparency is not exported to MythicHUD`);
                    if (it.frames) notes.push(`"${it.name}": animation — MythicHUD gets frame 1 only (use BetterHud for animated pictures)`);
                    if (it.kind === 'bar') {
                        let lname = it.source.listener;
                        if (!lname || it.source.betterOnly) {
                            const key = `${it.source.papi}|${it.source.max}`;
                            lname = listenerFor.get(key);
                            if (!lname) {
                                lname = uniq(listenerIds, `${ns}_${slug(it.source.tag || it.name, 'bar')}`);
                                listenerFor.set(key, lname);
                                listeners[lname] = { value: it.source.papi, max: it.source.max || '100' };
                            }
                        }
                        const vertical = it.dir === 'top' || it.dir === 'bottom';
                        const len = vertical ? it.box.h : it.box.w;
                        layer.function = {
                            listener: lname,
                            increment: Math.max(2, Math.min(100, ri(len))),
                            orientation: vertical ? 'vertical' : 'horizontal',
                            reversed: it.dir === 'right' || it.dir === 'top',
                        };
                    }
                    ox = it.box.x - fx * W;
                    topRel = it.box.y - fy * H;
                } else if (it.kind === 'text') {
                    layer = { text: (it.color ? `<${it.color}>` : '') + it.papi, scale: it.eff };
                    if (it.shadow) layer.outlined = true;
                    // MythicHUD moves things *towards* their align: 'left' = ends at the point.
                    // Both the layer and the element get it, so any text width stays aligned.
                    align = { left: 'right', center: 'center', right: 'left' }[it.align];
                    if (it.align !== 'left') layer.align = { center: 'center', right: 'left' }[it.align];
                    ox = it.ax - fx * W;
                    topRel = it.top - fy * H;
                } else {
                    layer = { head: { size: it.pixel } };
                    ox = it.box.x - fx * W;
                    topRel = it.box.y - fy * H;
                }
                layer.offset = { x: 0, y: 0 };
                asset.layers = { [it.kind]: layer };
                assets[aid] = asset;
                elements[aid] = { asset: aid, align, position, offset: { x: ri(ox), y: ri(-topRel) } };
            }
            layouts[lid] = { elements };
        }
        if (!layoutIds.length) throw new Error('Nothing to export: the chosen groups have no images, bars, texts or heads');

        const head = `# Made with KaizerHUD Studio — ${opts.projectName || ns}\n`;
        files.push({ path: `MythicHUD/layouts/${ns}.yml`, text: head + yaml(layouts) });
        files.push({ path: `MythicHUD/hud_assets/hud/${ns}.yml`, text: head + yaml(assets) });
        if (Object.keys(listeners).length) files.push({ path: `MythicHUD/listeners/${ns}.yml`, text: head + yaml(listeners) });

        const host = opts.host || 'none';
        const snippet = { layout: { default: opts.defaultOn === false ? [] : layoutIds } };
        const copy = {
            itemsadder: { enabled: true, path: 'ItemsAdder/contents/mythichud/resourcepack' },
            oraxen: { enabled: true, path: 'Oraxen/pack/uploads/MythicHUD' },
        }[host];
        if (copy) snippet['copy-pack'] = copy;
        if (host === 'nexo') snippet['nexo-hook'] = true;
        if (opts.hideVanilla) {
            const els = {};
            vanillaUsed(items).forEach((k) => { if (MYTHIC_ELEMENT[k]) els[MYTHIC_ELEMENT[k]] = 'hidden'; });
            if (items.some((i) => i.kind === 'text' && i.xp)) els.EXPERIENCE_LEVEL = 'hidden';
            if (Object.keys(els).length) snippet.elements = els;
        }
        files.push({
            path: 'MythicHUD/config_kaizerhud_snippet.yml',
            text: '# Copy these keys into plugins/MythicHUD/config.yml (do not replace the whole file)\n' + head + yaml(snippet),
        });
        const pack = await packFiles(items, project, opts, helper, notes);
        files.push(...pack.files);
        files.push({ path: 'README_KaizerHUD.txt', text: readme('mythichud', host, ns, layoutIds, opts) });
        return { files, notes, huds: layoutIds, items: items.length };
    }

    /* ───────────── README ───────────── */

    function readme(plugin, host, ns, ids, opts) {
        const L = [];
        const hostName = { itemsadder: 'ItemsAdder', nexo: 'Nexo', oraxen: 'Oraxen', none: '(none)' }[host];
        L.push(`KaizerHUD Studio — Java HUD export`);
        L.push(`Plugin: ${plugin === 'betterhud' ? 'BetterHud' : 'MythicHUD'} · Resource pack: ${hostName} · Namespace: ${ns}`);
        L.push('');
        L.push(opts.inOutputZip
            ? '1. Stop the server and drop every folder inside output.zip\'s plugins/ folder into the server\'s plugins/ folder (GeyserMC/ is for the Geyser server).'
            : '1. Stop the server and drop every folder of this zip into the server\'s plugins/ folder.');
        if (plugin === 'betterhud') {
            L.push('   (BetterHud/config.yml is replaced — back up yours first.)');
            if (host !== 'none') L.push(`   If you installed an older export, delete ${oldBuild(host, ns)} (builds now go to BetterHud's usual folder).`);
        }
        else L.push('   Then copy the keys from MythicHUD/config_kaizerhud_snippet.yml into MythicHUD/config.yml (do not replace the file).');
        hostSteps(L, plugin, host);
        L.push(`3. Start the server and run ${plugin === 'betterhud' ? '/hud reload' : '/hud reload all'}${reloadCmd(host) ? ' then ' + reloadCmd(host) : ''}.`);
        L.push(`HUDs: ${ids.join(', ')}${opts.defaultOn === false ? ' (default-on disabled)' : ''}`);
        L.push('Positions come from the 480×270 editor screen; fine-tune x / y in the layouts file if needed.');
        return L.join('\r\n') + '\r\n';
    }
    function oldBuild(host, ns) {
        return { itemsadder: `ItemsAdder/contents/${ns}_betterhud`, nexo: `Nexo/pack/external_packs/${ns}_betterhud`, oraxen: `Oraxen/pack/uploads/${ns}_betterhud` }[host];
    }
    function reloadCmd(host) {
        return { itemsadder: '/iazip', oraxen: '/oraxen reload pack', nexo: '/nexo reload all' }[host] || '';
    }
    function hostSteps(L, plugin, host) {
        if (host === 'itemsadder') {
            L.push('2. ItemsAdder/config.yml: turn off text effects and hide-scoreboard-numbers');
            L.push('     effects:');
            L.push('       hide-scoreboard-numbers: false');
            L.push('       hide-scoreboard-numbers-old-clients: false');
            L.push('       text-effects:');
            L.push('         enabled: false');
            if (plugin === 'mythichud') L.push('     huds:', '       enabled: false');
        } else if (host === 'nexo') {
            L.push('2. Nexo/settings.yml: set Glyphs.generate_gif_shaders: false');
        } else if (host === 'oraxen') {
            L.push('2. Oraxen/settings.yml: set Misc.hide_scoreboard_numbers: false');
        } else {
            L.push(`2. No pack plugin: merge ${plugin === 'betterhud' ? 'BetterHud/build' : 'MythicHUD/built-pack'} and resourcepack/ into your server resource pack yourself.`);
        }
    }

    /* ───────────── entry ───────────── */

    async function build(project, opts, helper) {
        const o = { plugin: 'betterhud', host: 'itemsadder', hotbar: true, hideVanilla: true, defaultOn: true, ...opts };
        o.ns = slug(o.ns || project.namespace, 'custom_hud');
        if (o.plugin === 'mythichud') return buildMythicHud(project, o, helper);
        return buildBetterHud(project, o, helper);
    }

    /* ───────────── browser side: pictures through a canvas ───────────── */

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Could not read a picture'));
            img.src = src;
        });
    }
    function canvasOf(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w));
        c.height = Math.max(1, Math.round(h));
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        return { c, ctx };
    }
    const b64Of = (c) => c.toDataURL('image/png').split(',')[1];
    const canvasHelper = {
        async prepare(data, w, h, tint) {
            const img = await loadImage(data);
            if (img.width === w && img.height === h && !tint) return String(data).split(',')[1];
            const { c, ctx } = canvasOf(w, h);
            ctx.drawImage(img, 0, 0, w, h);
            if (tint) {
                const d = ctx.getImageData(0, 0, c.width, c.height);
                for (let i = 0; i < d.data.length; i += 4) {
                    d.data[i] = Math.round(d.data[i] * tint[0]);
                    d.data[i + 1] = Math.round(d.data[i + 1] * tint[1]);
                    d.data[i + 2] = Math.round(d.data[i + 2] * tint[2]);
                }
                ctx.putImageData(d, 0, 0);
            }
            return b64Of(c);
        },
        async crop(data, x, y, w, h) {
            const img = await loadImage(data);
            const { c, ctx } = canvasOf(w, h);
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            return b64Of(c);
        },
        async blank(w, h) {
            return b64Of(canvasOf(w, h).c);
        },
        async size(data) {
            const img = await loadImage(data);
            return { w: img.width, h: img.height };
        },
        /** Box of the non-transparent pixels inside (x, y, w, h), relative to it; null when all clear */
        async bbox(data, x, y, w, h) {
            const img = await loadImage(data);
            const { ctx } = canvasOf(w, h);
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            const d = ctx.getImageData(0, 0, w, h).data;
            let x1 = w, y1 = h, x2 = -1, y2 = -1;
            for (let j = 0; j < h; j++) {
                for (let i = 0; i < w; i++) {
                    if (d[(j * w + i) * 4 + 3] === 0) continue;
                    if (i < x1) x1 = i;
                    if (i > x2) x2 = i;
                    if (j < y1) y1 = j;
                    if (j > y2) y2 = j;
                }
            }
            return x2 < 0 ? null : { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
        },
    };
    /* ───────────── options panel (inside the Export dialog) ─────────────
       The Java options live in the same Export dialog as the .mcpack export:
       export.js calls mount(container) when the dialog opens, readOptions() on
       Export, then exportZip(opts) after the .mcpack is saved.
       alert()/confirm() do not work in the Tauri WebView, so results use toasts
       and a small notes window instead. */

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PREF = 'kzJavaExport.v1';
    let panel = null;

    function savedPrefs() {
        try { return JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) { return {}; }
    }
    function currentProject() {
        return {
            elements: App.elements,
            namespace: App.getNamespace(),
            widgetsImageData: window.Widgets && Widgets.getWidgetsImageData ? Widgets.getWidgetsImageData() : null,
        };
    }
    function projectName() {
        const t = document.getElementById('project-name') || document.querySelector('[data-project-name]');
        return (t && (t.value || t.textContent) || '').trim();
    }
    function toast(msg, type) {
        if (window.App && App.showToast) App.showToast(msg, type || 'info');
    }

    function optionsHtml() {
        const p = savedPrefs();
        const groups = [...new Set((App.elements || []).map((e) => e.group || 'Main'))];
        const hasWidgets = !!(window.Widgets && Widgets.getWidgetsImageData && Widgets.getWidgetsImageData());
        const sel = (v, cur) => (v === cur ? 'selected' : '');
        return `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center">
                <label class="kz-label" for="je-plugin">HUD plugin</label>
                <select id="je-plugin">
                    <option value="betterhud" ${sel('betterhud', p.plugin || 'betterhud')}>BetterHud</option>
                    <option value="mythichud" ${sel('mythichud', p.plugin)}>MythicHUD</option>
                </select>
                <label class="kz-label" for="je-host">Pack plugin</label>
                <select id="je-host">
                    <option value="itemsadder" ${sel('itemsadder', p.host || 'itemsadder')}>ItemsAdder</option>
                    <option value="nexo" ${sel('nexo', p.host)}>Nexo</option>
                    <option value="oraxen" ${sel('oraxen', p.host)}>Oraxen</option>
                    <option value="none" ${sel('none', p.host)}>None (merge the pack myself)</option>
                </select>
            </div>
            <div style="margin:10px 0 8px;display:flex;flex-direction:column;gap:6px;font-size:12px">
                <label><input type="checkbox" id="je-hotbar" ${hasWidgets && p.hotbar !== false ? 'checked' : ''} ${hasWidgets ? '' : 'disabled'} /> Include the hotbar texture${hasWidgets ? '' : ' (no custom widgets.png)'}</label>
                <label><input type="checkbox" id="je-hide" ${p.hideVanilla !== false ? 'checked' : ''} /> Hide the vanilla hearts / food / armor / air / XP this HUD replaces</label>
                <label><input type="checkbox" id="je-default" ${p.defaultOn !== false ? 'checked' : ''} /> Show the HUD to every player by default</label>
            </div>
            <div class="kz-label" style="font-size:12px">Groups (one group = one HUD)</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin:4px 0 8px;font-size:12px">
                ${groups.map((g) => `<label><input type="checkbox" data-group="${esc(g)}" checked /> ${esc(g)}</label>`).join('') || '<span class="kz-note">The project is empty</span>'}
            </div>
            <div id="je-notes"></div>
            <div class="kz-note" style="margin-top:6px">Java 1.20.2+ · saved inside output.zip (plugins/ + README_KaizerHUD_Java.txt) · check positions in game once.</div>`;
    }

    function readOpts() {
        const v = (id) => panel.querySelector(id);
        return {
            plugin: v('#je-plugin').value,
            host: v('#je-host').value,
            hotbar: v('#je-hotbar').checked,
            hideVanilla: v('#je-hide').checked,
            defaultOn: v('#je-default').checked,
            groups: [...panel.querySelectorAll('[data-group]')].filter((c) => c.checked).map((c) => c.dataset.group),
            ns: App.getNamespace(),
            projectName: projectName(),
        };
    }

    function refreshNotes() {
        if (!panel) return;
        const box = panel.querySelector('#je-notes');
        try {
            const { items, notes } = collect(currentProject(), readOpts());
            const counts = items.reduce((m, i) => ((m[i.kind] = (m[i.kind] || 0) + 1), m), {});
            const sum = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(' · ') || 'nothing selected';
            box.innerHTML = `<div class="kz-note"><b>${esc(sum)}</b></div>` + notes.map((n) => `<div class="kz-note">• ${esc(n)}</div>`).join('');
        } catch (e) {
            box.innerHTML = `<div class="kz-note">${esc(e.message)}</div>`;
        }
    }

    /** Draws the Java options into `container` (the Export dialog's Java box). */
    function mount(container) {
        panel = container;
        container.innerHTML = optionsHtml();
        container.querySelectorAll('select, input').forEach((i) => i.addEventListener('change', refreshNotes));
        refreshNotes();
    }

    /** Reads the options and remembers them for next time. */
    function readOptions() {
        if (!panel) return null;
        const opts = readOpts();
        try { localStorage.setItem(PREF, JSON.stringify({ plugin: opts.plugin, host: opts.host, hotbar: opts.hotbar, hideVanilla: opts.hideVanilla, defaultOn: opts.defaultOn })); } catch (e) { /* private mode */ }
        return opts;
    }

    /** Builds the files and asks where to save the zip. Returns null if the save dialog was cancelled. */
    async function exportZip(opts) {
        if (!opts || !opts.groups.length) throw new Error('Choose at least one group for the Java export');
        const res = await build(currentProject(), opts, canvasHelper);
        if (!window.__TAURI__ || !window.__TAURI__.core) throw new Error('Exporting needs the desktop app');
        const fileName = `${slug(opts.ns, 'hud')}_${opts.plugin === 'mythichud' ? 'MythicHUD' : 'BetterHud'}_${opts.host}.zip`;
        const saved = await window.__TAURI__.core.invoke('export_java_hud', { files: res.files, fileName })
            .catch((err) => { throw new Error(typeof err === 'string' ? err : (err && err.message) || 'Unknown error'); });
        return saved ? { saved, res } : null;
    }

    /**
     * Builds the Java files for output.zip (no save dialog): export.js passes res.files to the
     * main export, which writes them under plugins/ next to KaizerMultiBar.
     */
    async function buildForOutput(opts) {
        if (!opts || !opts.groups.length) throw new Error('Choose at least one group for the Java export');
        return build(currentProject(), { ...opts, inOutputZip: true }, canvasHelper);
    }

    /** Toast, plus a small window listing anything the user should check. */
    function showResult(r) {
        const { saved, res } = r;
        const readmeName = r.readme || 'README_KaizerHUD.txt';
        if (!res.notes.length) {
            toast(`Java HUD config saved (${res.huds.length} HUD, ${res.items} items)`, 'success');
            return;
        }
        const back = document.createElement('div');
        back.className = 'kz-modal';
        back.style.display = 'flex';
        back.innerHTML = `
            <div class="kz-window" style="width:480px">
                <div class="kz-window-head"><span>Java HUD config saved</span>
                    <button class="icon-btn small" data-close title="Close"><svg><use href="#i-close"/></svg></button></div>
                <div class="kz-window-body">
                    <div class="kz-note" style="color:var(--ink)">${esc(saved)}<br>${res.huds.length} HUD, ${res.items} items · install steps are in ${esc(readmeName)} inside the zip.</div>
                    <div class="kz-label">Please check</div>
                    ${res.notes.map((n) => `<div class="kz-note">• ${esc(n)}</div>`).join('')}
                </div>
                <div class="kz-window-foot"><button class="primary-btn" data-close>OK</button></div>
            </div>`;
        const close = () => back.remove();
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
        back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
        document.body.appendChild(back);
    }

    /** Old menu entry: opens the normal Export dialog with the Java box ticked. */
    function open() {
        try { localStorage.setItem('kz_export_java', 'on'); } catch (e) { /* private mode */ }
        const btn = document.getElementById('btn-export');
        if (btn) btn.click();
    }

    const api = { open, mount, readOptions, exportZip, buildForOutput, showResult, build, collect, _yaml: yaml };
    if (typeof window !== 'undefined') window.JavaHudExport = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
