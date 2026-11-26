/* ========================================
   GUI Studio — export
   Turns a GUI project into three sets of files:
     • Java resource pack   (font glyphs the KaizerUI plugin shows as TextDisplay holograms)
     • Bedrock resource pack (server_form.json that redraws our server forms)
     • plugins/KaizerUI/     (menus/<id>.yml + studio.yml read by the plugin)
   Rust (gui_export) only zips them; every rule about the content lives here.
   Format notes: docs/GUI_STUDIO.md
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const M = () => GS.Model;

    const FIRST_GLYPH = 0xE000;

    /**
     * Where the Java resource pack goes. Same folders as the HUD's Java export (docs/JAVA_HUD_EXPORT.md):
     * the files are merged by the pack plugin, so players get them with the server's normal pack.
     */
    const PACK_HOSTS = {
        itemsadder: { label: 'ItemsAdder', dir: (ns) => `plugins/ItemsAdder/contents/${ns}_gui/resourcepack/`, mcmeta: false,
            apply: 'Run /iazip — ItemsAdder rebuilds its pack with the menu pictures and sends it to players.' },
        nexo: { label: 'Nexo', dir: (ns) => `plugins/Nexo/pack/external_packs/${ns}_gui/`, mcmeta: true,
            apply: 'Reload Nexo (or restart) so it rebuilds its pack with the menu pictures.' },
        oraxen: { label: 'Oraxen', dir: () => 'plugins/Oraxen/pack/', mcmeta: false,
            apply: 'Reload Oraxen (or restart) so it rebuilds its pack with the menu pictures.' },
        zip: { label: 'Separate .zip', dir: null, mcmeta: true,
            apply: 'Send the zip as the server resource pack: upload it and set resource-pack.url in plugins/KaizerUI/config.yml (or server.properties).' }
    };
    const JAVA_PACK_FORMAT = 34;       // 1.21
    const JAVA_PACK_MAX = 1000;        // any newer client
    const LINE_ASCENT = 7;             // vanilla baseline: glyph top sits (7 - ascent) px below the line top

    /**
     * Player Head / Player Model on Java: KaizerUI builds the skin as text, one coloured 1 px
     * glyph per skin pixel (the way BetterHud / MythicHUD draw heads for the HUD). Font
     * <ns>:kz_skin — row r of the picture = U+E000 + r (ascent 1 - r, so every row sits in the
     * same line), plus spaces to step back. KaizerUI (Skins.java) uses the same code points.
     */
    const SKIN_ROWS = 32;
    const SKIN_FONT = 'kz_skin';
    const SKIN_SPACES = { '\uE100': -1, '\uE101': -8, '\uE102': -16, '\uE103': 1 };
    const STEVE_TEX = 'textures/entity/steve';   // the game's own Steve skin (Bedrock, 64 × 64)

    /* ───────────── small helpers ───────────── */

    const q = (s) => JSON.stringify(String(s == null ? '' : s));  // JSON string = valid YAML double-quoted scalar
    const glyphEsc = (cp) => '"\\u' + cp.toString(16).toUpperCase().padStart(4, '0') + '"';

    function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
        const v = m ? parseInt(m[1], 16) : 0xffffff;
        return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map(x => Math.round(x * 1000) / 1000);
    }

    function uuid4() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('A picture in the project could not be read'));
            img.src = src;
        });
    }

    /** PNG data URL of the picture drawn at w×h (pixel-sharp when enlarging) */
    async function renderPng(src, w, h, tile, glyph) {
        const img = await loadImage(src);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = w < img.naturalWidth || h < img.naturalHeight;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        let out = c;
        if (tile) {
            out = document.createElement('canvas');
            out.width = tile.w; out.height = tile.h;
            out.getContext('2d').drawImage(c, tile.x, tile.y, tile.w, tile.h, 0, 0, tile.w, tile.h);
        }
        if (glyph) pinWidth(out);
        return out.toDataURL('image/png');
    }

    /**
     * Java measures a bitmap glyph only up to its last column that is not fully transparent,
     * and a TextDisplay centres the text on that width — a picture with empty space on its
     * right would sit off-centre. A pixel at alpha 1/255 in the last column keeps the full
     * width (and is never drawn: the text shader drops anything under 10% alpha).
     */
    function pinWidth(cv) {
        const g = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        const col = g.getImageData(W - 1, 0, 1, H).data;
        for (let i = 3; i < col.length; i += 4) if (col[i]) return;
        const px = g.createImageData(1, 1);
        px.data[3] = 1;
        g.putImageData(px, W - 1, 0);
    }

    /** Frames stacked top to bottom, each w×h (Bedrock flip_book texture) */
    async function stripPng(srcs, w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h * srcs.length;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        for (let i = 0; i < srcs.length; i++) g.drawImage(await loadImage(srcs[i]), 0, i * h, w, h);
        return c.toDataURL('image/png');
    }

    /** Built-in arrow cursor (8×12) used when the project has no cursor picture */
    /** 1 × 1 white PNG (base64, no data: prefix) */
    function whitePixelPng() {
        return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4////fwAJ+wP99djxmgAAAABJRU5ErkJggg==';
    }

    function defaultCursorPng() {
        const rows = [
            'B.......',
            'BB......',
            'BWB.....',
            'BWWB....',
            'BWWWB...',
            'BWWWWB..',
            'BWWWWWB.',
            'BWWWWWWB',
            'BWWWBBBB',
            'BWBWB...',
            'BB.BWB..',
            '....BB..'
        ];
        const c = document.createElement('canvas');
        c.width = 8; c.height = 12;
        const g = c.getContext('2d');
        rows.forEach((r, y) => [...r].forEach((ch, x) => {
            if (ch === '.') return;
            g.fillStyle = ch === 'B' ? '#000000' : '#ffffff';
            g.fillRect(x, y, 1, 1);
        }));
        return c.toDataURL('image/png');
    }

    /* ───────────── Java: glyphs ───────────── */

    /**
     * One glyph per (picture, size). Pictures are redrawn at exactly the element size so the
     * glyph is w×h text pixels; the plugin scales the TextDisplay so 1 text pixel = 1 GUI pixel.
     */
    /** Largest glyph the Java client can show: its font atlas (FontTexture) is 256×256 */
    const MAX_TILE = 256;

    /** Splits w×h into a grid of tiles no bigger than max (equal sizes, last ones take the rest) */
    function tileGrid(w, h, max) {
        max = max || MAX_TILE;
        // tiles overlap their right / lower neighbour by 1 px: edges that only touch leave a
        // hairline gap in game (float rounding), so each tile is 1 px wider into the next one
        const cols = Math.ceil(w / (max - 1)), rows = Math.ceil(h / (max - 1));
        const tw = Math.ceil(w / cols), th = Math.ceil(h / rows);
        const out = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const x = c * tw, y = r * th;
            const ow = c < cols - 1 ? 1 : 0, oh = r < rows - 1 ? 1 : 0;
            out.push({ x, y, w: Math.min(tw + ow, w - x), h: Math.min(th + oh, h - y) });
        }
        return out;
    }

    class GlyphTable {
        constructor(ns) { this.ns = ns; this.byKey = new Map(); this.next = FIRST_GLYPH; }
        /** One glyph for a w×h picture (GUI px), or for one tile of it; `detail` = texture px per GUI px */
        get(imageId, w, h, tile, detail) {
            const d = detail || 1;
            const tk = tile ? `@${tile.x},${tile.y}` : '';
            const key = `${imageId}|${w}x${h}${tk}|${d}`;
            let g = this.byKey.get(key);
            if (!g) {
                if (this.next > 0xF8FF) throw new Error('Too many different picture sizes (more than 6400)');
                const gw = tile ? tile.w : w, gh = tile ? tile.h : h;
                g = {
                    key, imageId, w: gw, h: gh, fullW: w, fullH: h, tile: tile || null, detail: d, cp: this.next++, ascent: Math.min(LINE_ASCENT, gh),
                    file: M().slug(`${imageId}_${w}x${h}` + (tile ? `_${tile.x}_${tile.y}` : '') + (d > 1 ? `_x${d}` : ''), 'img')
                };
                this.byKey.set(key, g);
            }
            return g;
        }
        /** Glyphs that draw the picture at w×h: one, or several tiles when it is bigger than 256 */
        tiles(imageId, w, h, detail) {
            const d = detail || 1;
            // the 256 limit is in texture pixels: a 4× picture gets tiles of at most 64 GUI px
            const max = Math.max(2, Math.floor(MAX_TILE / d));
            if (w <= max && h <= max) return [Object.assign({ x: 0, y: 0 }, this.get(imageId, w, h, null, d))];
            return tileGrid(w, h, max).map(t => Object.assign({ x: t.x, y: t.y }, this.get(imageId, w, h, t, d)));
        }
        all() { return [...this.byKey.values()]; }
    }

    function packMcmeta(desc) {
        return JSON.stringify({
            pack: {
                pack_format: JAVA_PACK_FORMAT,
                supported_formats: { min_inclusive: JAVA_PACK_FORMAT, max_inclusive: JAVA_PACK_MAX },
                min_format: JAVA_PACK_FORMAT,
                max_format: JAVA_PACK_MAX,
                description: desc
            }
        }, null, 2) + '\n';
    }

    /* ───────────── Bedrock: server_form.json ───────────── */

    /** Text the plugin puts in front of the form title so our pack knows which menu it is */
    function bedrockMarker(ns, menuId) { return `kz:${ns}:${menuId}|`; }

    /**
     * Text the plugin puts in front of every form button: "kzs03|Shop". A control placed
     * by hand cannot pick one entry of the form's button list (collection_index is ignored
     * outside a factory — every control read button 0), so the pack builds the buttons with
     * the game's own factory and each generated item shows only the element whose marker
     * its text carries.
     */
    function slotMarker(slot) { return 'kzs' + String(slot).padStart(2, '0') + '|'; }

    const COLLECTION_TEXT = { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_text' };
    const showIfSlot = (slot) => ({ binding_type: 'view', source_property_name: `(not ((#form_button_text - '${slotMarker(slot)}') = #form_button_text))`, target_property_name: '#visible' });
    const textOfSlot = (slot) => ({ binding_type: 'view', source_property_name: `(#form_button_text - '${slotMarker(slot)}')`, target_property_name: '#kz_text' });

    function bedrockElement(el, slot, layer, texOf, stripOf) {
        const pos = { anchor_from: 'top_left', anchor_to: 'top_left', offset: [el.x, el.y], size: [el.w, el.h], layer };
        // animated picture: every frame stacked in one texture, played with a flip_book anim
        const strip = stripOf ? stripOf(el) : null;
        const pic = (tex) => strip ? { texture: strip.texture, uv_size: strip.uvSize, uv: strip.uv } : { texture: tex };
        if (el.type === 'image') {
            return { type: 'image', ...pic(texOf(el.image)), ...pos };
        }
        if (M().isPlayer(el)) return bedrockPlayer(el, pos);
        if (el.type === 'item') {
            // the game's own texture of the item (Java-only items: an empty panel)
            const tex = GS.Items ? GS.Items.bedrockTexture(el) : null;
            return tex ? { type: 'image', texture: tex, ...pos } : { type: 'panel', ...pos };
        }
        if (el.type === 'text') {
            return {
                type: 'label', ...pos,
                text: '#kz_text',
                bindings: [COLLECTION_TEXT, textOfSlot(slot), showIfSlot(slot)],
                color: hexToRgb(el.color),
                shadow: !!el.shadow,
                font_scale_factor: Math.max(0.25, M().num(el.scale, 1)),
                text_alignment: el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center'
            };
        }
        // button
        const img = el.image ? texOf(el.image) : null;
        const hov = el.hoverImage ? texOf(el.hoverImage) : img;
        const face = (tex, tint) => tex
            ? { type: 'image', ...(tex === img ? pic(tex) : { texture: tex }), size: ['100%', '100%'], ...(tint ? { color: tint } : {}) }
            : { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], alpha: tint ? 0.18 : 0.0 };
        return {
            type: 'button', ...pos,
            default_control: 'default',
            hover_control: 'hover',
            pressed_control: 'pressed',
            sound_name: 'random.click',
            sound_volume: 1.0,
            button_mappings: [
                { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
            ],
            bindings: [{ binding_type: 'collection_details', binding_collection_name: 'form_buttons' }, COLLECTION_TEXT, showIfSlot(slot)],
            controls: [
                { default: face(img, null) },
                { hover: face(hov, el.hoverImage ? null : [0.82, 0.82, 0.82]) },
                { pressed: face(hov, [0.7, 0.7, 0.7]) },
                {
                    label: {
                        type: 'label', layer: 2,
                        text: '#kz_text',
                        bindings: [COLLECTION_TEXT, textOfSlot(slot)],
                        color: hexToRgb(el.labelColor),
                        shadow: el.labelShadow !== false,
                        font_scale_factor: Math.max(0.25, M().num(el.labelScale, 1)),
                        text_alignment: 'center'
                    }
                }
            ]
        };
    }

    /**
     * Player Head / Player Model on Bedrock, done like the HUD's Player Head: the game's
     * paper_doll_renderer (the player looking at the form) in a panel — a head clips a bigger
     * doll so only the head shows. The doll can only be that player, so a head / model of
     * someone else shows the game's own Steve skin (cut out of textures/entity/steve).
     */
    function bedrockPlayer(el, pos) {
        const head = el.type === 'player_head';
        if (M().showsViewer(el)) {
            const box = M().dollBox(el);
            const doll = { type: 'custom', renderer: 'paper_doll_renderer', size: box.size, offset: box.offset, layer: 1 };
            if (!head) {
                // whole player like the pause screen: turned by Angle, and with Turn set the player
                // can hold and drag it round (input_panel gesture → rotation "gesture_x", as in pause_screen.json)
                doll.starting_rotation = Math.round(Number(el.angle) || 0);
                doll.camera_tilt_degrees = -10;
                if (['drag', 'mouse', 'cursor'].includes(el.turn)) {
                    const nm = 'kz_doll_' + String(el.id || 'model').replace(/[^A-Za-z0-9_]/g, '_');
                    doll.rotation = 'gesture_x';
                    doll.bindings = ['#gesture_delta_source', '#gesture_mouse_delta_x'].map(b => ({
                        binding_type: 'view', source_control_name: nm, source_property_name: b, target_property_name: b
                    }));
                    return {
                        type: 'panel', ...pos,
                        controls: [{
                            [nm]: {
                                type: 'input_panel', size: ['100%', '100%'], layer: 1,
                                gesture_tracking_button: 'button.turn_doll',
                                button_mappings: [{ from_button_id: 'button.menu_select', to_button_id: 'button.turn_doll', mapping_type: 'pressed', button_up_right_of_first_refusal: true }],
                                controls: [{ doll }]
                            }
                        }]
                    };
                }
            }
            return { type: 'panel', ...pos, clips_children: head, controls: [{ doll }] };
        }
        // Steve: [x, y, w, h] on a 16 × 32 grid (front view) ← [u, v] on the 64 × 64 skin
        const parts = head
            ? [['face', 0, 0, 8, 8, 8, 8], ['hat', 0, 0, 8, 8, 40, 8]]
            : [['face', 4, 0, 8, 8, 8, 8], ['hat', 4, 0, 8, 8, 40, 8], ['body', 4, 8, 8, 12, 20, 20],
               ['arm_r', 0, 8, 4, 12, 44, 20], ['arm_l', 12, 8, 4, 12, 36, 52], ['leg_r', 4, 20, 4, 12, 4, 20], ['leg_l', 8, 20, 4, 12, 20, 52]];
        const gw = head ? 8 : 16, gh = head ? 8 : 32;
        const k = Math.min(el.w / gw, el.h / gh);
        const ox = (el.w - gw * k) / 2, oy = (el.h - gh * k) / 2;
        const r2 = (v) => Math.round(v * 100) / 100;
        return {
            type: 'panel', ...pos,
            controls: parts.map(([n, x, y, w, h, u, v], i) => ({
                [n]: {
                    type: 'image', texture: STEVE_TEX, uv: [u, v], uv_size: [w, h],
                    anchor_from: 'top_left', anchor_to: 'top_left',
                    offset: [r2(ox + x * k), r2(oy + y * k)], size: [r2(w * k), r2(h * k)], layer: 1 + (n === 'hat' ? 1 : 0)
                }
            }))
        };
    }

    /** Which elements become form buttons (slots) on Bedrock, in order: buttons first, then texts */
    function bedrockSlots(menu) {
        const els = menu.elements.filter(e => !e.hidden);
        const slots = new Map();
        let n = 0;
        els.filter(e => e.type === 'button').forEach(e => slots.set(e.id, n++));
        els.filter(e => e.type === 'text').forEach(e => slots.set(e.id, n++));
        return slots;
    }

    /* ───────────── Bedrock: motion (JSON UI anims) ─────────────
       Bedrock UI can animate offset, size and alpha (no rotation). A clip becomes one chain of
       anims per property; a loop's last anim points back at its first. Turning-only effects are
       left out. Everything is in the server_form namespace, so names are global: prefix them. */

    const BEDROCK_EASE = { linear: 'linear', in: 'in_quad', out: 'out_quad', inout: 'in_out_quad', back: 'out_back', bounce: 'out_bounce', elastic: 'out_elastic', steps: 'linear', hold: 'linear' };
    const r3 = (v) => Math.round(v * 1000) / 1000;

    /** Key times of the given tracks of a clip (sorted, unique) */
    function keyTimes(c, names) {
        const ts = new Set([0, c.length]);
        names.forEach(n => (c.tracks[n] || []).forEach(k => ts.add(r3(k[0]))));
        return [...ts].filter(t => t >= 0 && t <= c.length + 1e-9).sort((a, b) => a - b);
    }
    function easeAt(c, names, t) {
        for (const n of names) {
            const k = (c.tracks[n] || []).find(k => Math.abs(k[0] - t) < 1e-6);
            if (k) return k[2] || 'linear';
        }
        return 'linear';
    }
    const touches = (c, names) => !!c && names.some(n => c.tracks[n] && c.tracks[n].length);

    /**
     * Anims for one control: { props: { offset, size, alpha }, defs: { name: anim } }.
     * box = {x, y, w, h} — the control's own offset / size at rest.
     * steps = [{ clip, start }] played one after another (intro, then loop).
     */
    function bedrockMotion(prefix, box, steps) {
        const Mo = GS.Motion;
        const defs = {}, props = {};
        const POS = ['x', 'y', 'scale', 'sx', 'sy'];
        const geo = (st) => {
            const kx = st.scale * st.sx / 10000, ky = st.scale * st.sy / 10000;
            const w = box.w * kx, h = box.h * ky;
            return { offset: [r3(box.x + st.x - (w - box.w) / 2), r3(box.y + st.y - (h - box.h) / 2)], size: [r3(w), r3(h)] };
        };
        const chains = {
            offset: { names: POS, value: (st) => geo(st).offset, scaled: false },
            size: { names: ['scale', 'sx', 'sy'], value: (st) => geo(st).size, scaled: true },
            alpha: { names: ['alpha'], value: (st) => r3(Math.max(0, Math.min(1, st.alpha / 100))) }
        };
        for (const [prop, ch] of Object.entries(chains)) {
            const used = steps.filter(s => touches(s.clip, ch.names));
            if (!used.length) continue;
            const segs = [];
            let now = 0, loopStart = -1;
            for (const s of steps) {
                if (!touches(s.clip, ch.names)) continue;
                const c = s.clip;
                const start = s.start + (c.loop ? 0 : (c.delay || 0));
                if (start - now > 0.01) {
                    // hold the value this clip starts with until it begins
                    const v = ch.value(Mo.sample(Object.assign({}, c, { delay: 0 }), 0));
                    segs.push({ from: v, to: v, duration: r3(start - now), easing: 'linear' });
                }
                if (c.loop) loopStart = segs.length;
                const times = keyTimes(c, ch.names);
                for (let i = 0; i < times.length - 1; i++) {
                    const a = times[i], b = times[i + 1];
                    if (b - a < 0.005) continue;
                    const cc = Object.assign({}, c, { delay: 0, loop: false });
                    const e = easeAt(c, ch.names, a);
                    const va = ch.value(Mo.sample(cc, a));
                    const vb = e === 'hold' ? va : ch.value(Mo.sample(cc, b));
                    segs.push({ from: va, to: vb, duration: r3(b - a), easing: BEDROCK_EASE[e] || 'linear' });
                }
                now = start + c.length;
                if (c.loop) break;          // nothing comes after a loop
            }
            if (!segs.length) continue;
            const name = (i) => `${prefix}_${prop}_${i}`;
            segs.forEach((g, i) => {
                const a = { anim_type: prop, easing: g.easing, from: g.from, to: g.to, duration: Math.max(0.01, g.duration) };
                if (i < segs.length - 1) a.next = `@server_form.${name(i + 1)}`;
                else if (loopStart >= 0) a.next = `@server_form.${name(loopStart)}`;
                defs[name(i)] = a;
            });
            props[prop] = `@server_form.${name(0)}`;
        }
        return { props, defs };
    }

    /* Bedrock gets its own size: a page bigger than this is shrunk for the form (Java is not
       touched). 480 × 270 UI units fit phones and PCs alike. */
    const BEDROCK_MAX_W = 480, BEDROCK_MAX_H = 270;
    function bedrockScale(menu) { return Math.min(1, BEDROCK_MAX_W / menu.width, BEDROCK_MAX_H / menu.height); }

    /** A copy of the page with every position, size and text size × k (for the Bedrock form) */
    function scaledMenu(menu, k) {
        const m = JSON.parse(JSON.stringify(menu));
        const r = (v) => Math.round(v * k);
        m.width = Math.max(16, r(menu.width)); m.height = Math.max(16, r(menu.height));
        m.elements.forEach(e => {
            const x2 = r(e.x + e.w), y2 = r(e.y + e.h);
            e.x = r(e.x); e.y = r(e.y);
            e.w = Math.max(1, x2 - e.x); e.h = Math.max(1, y2 - e.y);
            if (e.labelScale != null) e.labelScale = M().num(e.labelScale, 1) * k;
            if (e.scale != null) e.scale = M().num(e.scale, 1) * k;
            ['dollSize', 'dollOffset'].forEach(f => { if (Array.isArray(e[f])) e[f] = e[f].map(v => Math.round(v * k * 10) / 10); });
        });
        return m;
    }
    /** Motion clips with their moves (px) × k */
    function scaledClips(clips, k) {
        if (k === 1) return clips;
        const sc = (c) => {
            if (!c || !c.tracks) return c;
            const t = Object.assign({}, c.tracks);
            ['x', 'y'].forEach(n => { if (t[n]) t[n] = t[n].map(([a, v, e]) => [a, Math.round(v * k * 100) / 100, e]); });
            return Object.assign({}, c, { tracks: t });
        };
        const out = { open: sc(clips.open), elements: {} };
        Object.entries(clips.elements).forEach(([id, r]) => { out.elements[id] = { intro: sc(r.intro), loop: sc(r.loop), hover: r.hover, press: sc(r.press) }; });
        return out;
    }

    function serverFormJson(p, texOf, stripOf) {
        const ns = p.namespace;
        const root = { namespace: 'server_form' };
        const wrapperControls = [];

        // Every form that is not ours still uses the game's own layout
        const notOurs = `((#title_text - '${`kz:${ns}:`}') = #title_text)`;
        wrapperControls.push({
            [`${ns}_vanilla`]: {
                type: 'panel', size: ['100%', '100%'],
                bindings: [{ binding_name: '#title_text' }, { binding_type: 'view', source_property_name: notOurs, target_property_name: '#visible' }],
                controls: [{ 'long_form@server_form.long_form': {} }]
            }
        });

        p.menus.forEach(menu0 => {
            // pages bigger than the Bedrock size are drawn smaller on Bedrock only
            const kB = bedrockScale(menu0);
            const menu = kB < 1 ? scaledMenu(menu0, kB) : menu0;
            const slots = bedrockSlots(menu);
            const marker = bedrockMarker(ns, menu.id);
            const shown = menu.elements.filter(e => !e.hidden && !(e.type === 'image' && !p.images[e.image]) && !(e.type === 'item' && !String(e.item || '').trim()));
            // pictures: placed straight in the menu panel
            const controls = [];
            // buttons + texts: one factory item per form button; each item holds every slot
            // element and shows only the one its marker names
            const slotControls = [];
            const clips = scaledClips(GS.Motion.resolve(menu0), kB);
            shown.forEach((e, i) => {
                const key = `${e.type}_${M().slug(e.id, 'el')}`;
                const def = bedrockElement(e, slots.get(e.id), i + 1, texOf, stripOf);
                const cl = clips.elements[e.id] || {};
                const steps = [];
                if (cl.intro) steps.push({ clip: cl.intro, start: 0 });
                if (cl.loop) steps.push({ clip: cl.loop, start: cl.loop.delay || 0 });
                const mo = steps.length ? bedrockMotion(`${ns}_mo_${menu.id}_${M().slug(e.id, 'el')}`, { x: e.x, y: e.y, w: e.w, h: e.h }, steps) : null;
                let c;
                if (mo && Object.keys(mo.props).length) {
                    Object.assign(root, mo.defs);
                    // the anims move / fade a panel around the element; the element fills it
                    const inner = Object.assign({}, def, { offset: [0, 0], size: ['100%', '100%'], layer: 1 });
                    const wrap = {
                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                        offset: mo.props.offset || [e.x, e.y], size: mo.props.size || [e.w, e.h], layer: i + 1,
                        controls: [{ [key]: inner }]
                    };
                    if (mo.props.alpha) { wrap.propagate_alpha = true; wrap.alpha = mo.props.alpha; }
                    if (slots.has(e.id)) wrap.bindings = [COLLECTION_TEXT, showIfSlot(slots.get(e.id))];
                    c = { [`mo_${key}`]: wrap };
                } else c = { [key]: def };
                (slots.has(e.id) ? slotControls : controls).push(c);
            });
            root[`${ns}_slot_${menu.id}`] = {
                type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                controls: slotControls
            };
            controls.push({
                slots: {
                    type: 'stack_panel', orientation: 'vertical',
                    size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                    factory: { name: 'buttons', control_name: `server_form.${ns}_slot_${menu.id}` },
                    collection_name: 'form_buttons',
                    bindings: [{ binding_name: '#form_button_length', binding_name_override: '#collection_length' }]
                }
            });
            const menuPanel = {
                type: 'panel',
                size: [menu.width, menu.height],
                anchor_from: 'center', anchor_to: 'center',
                controls
            };
            // opening: slide / rise / drop / bounce move the panel, the rest fades it in
            let openAlpha = null;
            if (clips.open) {
                const oc = clips.open;
                const moving = touches(oc, ['x', 'y']);
                const fadeOnly = { length: oc.length, delay: 0, loop: false, pivot: oc.pivot, tracks: { alpha: oc.tracks.alpha || [[0, 0, 'inout'], [Math.min(0.3, oc.length || 0.3), 100, 'linear']] } };
                const c2 = { length: oc.length, delay: 0, loop: false, pivot: oc.pivot, tracks: Object.assign({}, moving ? { x: oc.tracks.x, y: oc.tracks.y } : {}, fadeOnly.tracks) };
                Object.keys(c2.tracks).forEach(k => { if (!c2.tracks[k]) delete c2.tracks[k]; });
                const mo = bedrockMotion(`${ns}_open_${menu.id}`, { x: 0, y: 0, w: menu.width, h: menu.height }, [{ clip: c2, start: 0 }]);
                Object.assign(root, mo.defs);
                if (mo.props.offset) menuPanel.offset = mo.props.offset;
                if (mo.props.alpha) { menuPanel.propagate_alpha = true; menuPanel.alpha = mo.props.alpha; }
                if (menu.fullscreen && menu.bedrockBackdrop) {
                    // the backdrop fades in with the menu
                    const ba = M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1);
                    const bm = bedrockMotion(`${ns}_open_${menu.id}_bd`, { x: 0, y: 0, w: 1, h: 1 }, [{ clip: { length: c2.length, delay: 0, loop: false, tracks: { alpha: c2.tracks.alpha.map(k => [k[0], k[1] * ba, k[2]]) } }, start: 0 }]);
                    Object.assign(root, bm.defs);
                    openAlpha = bm.props.alpha || null;
                }
            }
            root[`${ns}_menu_${menu.id}`] = menuPanel;
            wrapperControls.push({
                [`${ns}_show_${menu.id}`]: {
                    type: 'panel', size: ['100%', '100%'],
                    bindings: [{ binding_name: '#title_text' }, { binding_type: 'view', source_property_name: `(not ((#title_text - '${marker}') = #title_text))`, target_property_name: '#visible' }],
                    controls: [
                        ...(menu.fullscreen && menu.bedrockBackdrop ? [{
                            backdrop: {
                                // the form's content area is narrower than the screen: oversize it, centred, so it covers everything
                                type: 'image', texture: 'textures/ui/white_background', size: ['400%', '400%'], layer: 0,
                                anchor_from: 'center', anchor_to: 'center',
                                color: hexToRgb(menu.backdrop || '#000000'), alpha: openAlpha || M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1)
                            }
                        }] : []),
                        { [`menu@server_form.${ns}_menu_${menu.id}`]: { layer: 1 } }
                    ]
                }
            });
        });

        root[`${ns}_long_form`] = { type: 'panel', size: ['100%', '100%'], controls: wrapperControls };
        // Vanilla: main_screen_content → server_form_factory picks long_form / custom_form.
        root.main_screen_content = {
            type: 'panel', size: ['100%', '100%'],
            controls: [{
                server_form_factory: {
                    type: 'factory',
                    control_ids: { long_form: `@server_form.${ns}_long_form`, custom_form: '@server_form.custom_form' }
                }
            }]
        };
        return JSON.stringify(root, null, 2) + '\n';
    }

    /* ───────────── plugin YAML ───────────── */

    /** JSON (valid YAML flow) with private-use glyphs written as \uXXXX */
    function flow(v) {
        return JSON.stringify(v).replace(/[\ue000-\uf8ff]/g, ch => '\\u' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    }

    function menuYaml(p, menu, tilesOf) {
        const slots = bedrockSlots(menu);
        const clips = GS.Motion.resolve(menu);
        const L = [];
        L.push(`# Menu "${menu.id}" — generated by KaizerHUD Studio (GUI Studio). Export again to change it.`);
        L.push(`id: ${q(menu.id)}`);
        L.push(`title: ${q(menu.title)}`);
        L.push(`command: ${q(menu.command || '')}`);
        L.push(`width: ${menu.width}`);
        L.push(`height: ${menu.height}`);
        L.push(`refresh-ticks: ${Math.max(0, M().int(menu.refreshTicks, 20))}`);
        L.push(`open-sound: ${q(menu.openSound || '')}`);
        L.push(`bedrock-title: ${q(bedrockMarker(p.namespace, menu.id) + (menu.title || ''))}`);
        L.push(`bedrock-slots: ${slots.size}`);
        L.push(`fullscreen: ${!!menu.fullscreen}`);
        L.push(`backdrop: ${q(menu.backdrop || '#000000')}`);
        L.push(`backdrop-alpha: ${M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1)}`);
        if (menu.prevPage) L.push(`prev-page: ${q(menu.prevPage)}`);
        if (menu.nextPage) L.push(`next-page: ${q(menu.nextPage)}`);
        if (clips.open) L.push(`motion: ${flow({ open: clips.open })}`);
        L.push('elements:');
        const visible = menu.elements.filter(e => !e.hidden && !(e.type === 'image' && !p.images[e.image]) && !(e.type === 'item' && !String(e.item || '').trim()));
        if (!visible.length) L[L.length - 1] = 'elements: []';
        visible.forEach(e => {
            L.push(`  - id: ${q(e.id)}`);
            L.push(`    type: ${e.type}`);
            L.push(`    name: ${q(e.name || '')}`);
            L.push(`    x: ${M().int(e.x, 0)}`);
            L.push(`    y: ${M().int(e.y, 0)}`);
            L.push(`    w: ${M().int(e.w, 1)}`);
            L.push(`    h: ${M().int(e.h, 1)}`);
            const pictureYaml = (imageId, key) => {
                const ts = tilesOf(imageId, M().int(e.w, 1), M().int(e.h, 1), e.detail || 1);
                if (ts.length === 1) {
                    L.push(`    ${key}: ${glyphEsc(ts[0].cp)}`);
                    L.push(`    ${key}-ascent: ${ts[0].ascent}`);
                } else {
                    // bigger than 256 px: drawn as several glyphs side by side
                    L.push(`    ${key === 'glyph' ? 'tiles' : 'hover-tiles'}:`);
                    ts.forEach(t => L.push(`      - { x: ${t.x}, y: ${t.y}, w: ${t.w}, h: ${t.h}, glyph: ${glyphEsc(t.cp)}, ascent: ${t.ascent} }`));
                }
            };
            if (e.type === 'image' || e.type === 'button') {
                if (e.image && p.images[e.image]) pictureYaml(e.image, 'glyph');
                const frames = [e.image].concat(e.frames || []).filter(id => id && p.images[id]);
                if (e.image && p.images[e.image] && frames.length > 1) {
                    // animated picture: every frame as its own glyph(s), same layout as `tiles`
                    const fr = frames.map(id => tilesOf(id, M().int(e.w, 1), M().int(e.h, 1), e.detail || 1).map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, glyph: String.fromCodePoint(t.cp), ascent: t.ascent })));
                    L.push(`    fps: ${M().clamp(M().num(e.fps, 8), 1, 20)}`);
                    L.push(`    frames: ${flow(fr)}`);
                }
            }
            const cl = clips.elements[e.id];
            if (cl && (cl.intro || cl.loop || cl.hover || cl.press)) {
                const mo = {};
                ['intro', 'loop', 'hover', 'press'].forEach(k => { if (cl[k]) mo[k] = cl[k]; });
                L.push(`    motion: ${flow(mo)}`);
            }
            if (e.type === 'button') {
                if (e.hoverImage && p.images[e.hoverImage]) pictureYaml(e.hoverImage, 'hover-glyph');
                L.push(`    label: ${q(e.label || '')}`);
                L.push(`    label-color: ${q(e.labelColor || '#ffffff')}`);
                L.push(`    label-scale: ${M().num(e.labelScale, 1)}`);
                L.push(`    label-shadow: ${e.labelShadow !== false}`);
                L.push(`    close-on-click: ${!!e.closeOnClick}`);
                L.push(`    hover-sound: ${q(e.hoverSound || '')}`);
                L.push(`    bedrock-slot: ${slots.get(e.id)}`);
                const acts = (e.actions || []).map(a => String(a).trim()).filter(Boolean);
                if (acts.length) { L.push('    actions:'); acts.forEach(a => L.push(`      - ${q(a)}`)); }
                else L.push('    actions: []');
            }
            if (M().isPlayer(e)) {
                L.push(`    player: ${q(e.player == null ? '%player_name%' : e.player)}`);
                L.push(`    hat: ${e.hat !== false}`);
            }
            if (e.type === 'player_model') {
                L.push(`    java-3d: ${e.java3d !== false}`);
                L.push(`    outfit: ${q(e.outfit || 'own')}`);
                L.push(`    pose: ${q(e.pose || 'standing')}`);
                L.push(`    turn: ${q(e.turn || 'none')}`);
                L.push(`    angle: ${M().num(e.angle, 0)}`);
                L.push(`    spin-speed: ${M().num(e.spinSpeed, 45)}`);
            }
            if (e.type === 'item') {
                L.push(`    item: ${q(e.item || '')}`);
                L.push(`    glint: ${!!e.glint}`);
                L.push(`    look: ${q(e.look === '3d' ? '3d' : 'flat')}`);
                L.push(`    spin: ${!!e.spin}`);
            }
            if (e.type === 'text') {
                L.push(`    text: ${q(e.text || '')}`);
                L.push(`    color: ${q(e.color || '#ffffff')}`);
                L.push(`    scale: ${M().num(e.scale, 1)}`);
                L.push(`    shadow: ${!!e.shadow}`);
                L.push(`    align: ${q(e.align || 'center')}`);
                L.push(`    bedrock-slot: ${slots.get(e.id)}`);
            }
            if (e.tooltip && String(e.tooltip).trim()) {
                L.push(`    tooltip: ${q(e.tooltip)}`);
            }
        });
        return L.join('\n') + '\n';
    }

    function studioYaml(p, cursorGlyph) {
        const s = p.settings;
        return [
            '# Written by KaizerHUD Studio (GUI Studio) on every export. Do not edit: export again instead.',
            '# Your own settings go in config.yml.',
            `namespace: ${q(p.namespace)}`,
            `font: ${q(p.namespace + ':gui')}`,
            `skin-font: ${q(p.namespace + ':' + SKIN_FONT)}`,
            `pack-version: ${p.packVersion}`,
            'cursor:',
            `  glyph: ${glyphEsc(cursorGlyph.cp)}`,
            `  glyph-ascent: ${cursorGlyph.ascent}`,
            `  width: ${cursorGlyph.w}`,
            `  height: ${cursorGlyph.h}`,
            `  hot-x: ${M().int(p.cursor.hotX, 0)}`,
            `  hot-y: ${M().int(p.cursor.hotY, 0)}`,
            'java:',
            `  camera-lock: ${s.cameraLock !== false}`,
            `  distance: ${M().num(s.distance, 1.2)}`,
            `  fill: ${M().num(s.fill, 0.85)}`,
            `  sensitivity: ${M().num(s.sensitivity, 1)}`,
            `  exit-on-sneak: ${s.exitOnSneak !== false}`,
            'sounds:',
            `  click: ${q(s.clickSound || '')}`,
            `  hover: ${q(s.hoverSound || '')}`,
            ''
        ].join('\n');
    }

    function readme(p, javaPackName, bedrockPackPath) {
        const cmds = p.menus.map(m => `  /kui open ${m.id}${m.command ? `   (or /${m.command})` : ''}`).join('\n');
        const host = PACK_HOSTS[p.settings.packHost] || PACK_HOSTS.itemsadder;
        const pad = '\n                                   ';
        const javaLine = host.dir ? `${host.dir(p.namespace)}${pad}Java pictures, merged by ${host.label}` : `${javaPackName}${pad}Java resource pack (send it to players)`;
        const credits = GS.Assets ? GS.Assets.credits(p) : [];
        const creditText = credits.length ? `\nIcon credits (these icon sets ask to be credited — put this on your website / store page)\n--------------------------------------------------------------\n${credits.join('\n')}\n` : '';
        return `KaizerUI — cursor GUI export (${p.namespace})
==============================================

What is in this zip
-------------------
plugins/KaizerUI/menus/*.yml       your menus (one file per page)
plugins/KaizerUI/studio.yml        cursor + in-game settings from GUI Studio
${bedrockPackPath}
                                   Bedrock pack: Geyser sends it to Bedrock players
${javaLine}

Install
-------
1. Put KaizerUI-1.0.0.jar in plugins/ (from plugins/KaizerUI/target).
   Needed: Paper / Purpur / Folia 1.21+.
   Recommended: PacketEvents (locks the camera so the mouse moves a cursor),
                PlaceholderAPI (placeholders in texts and labels),
                Geyser + Floodgate (Bedrock players get the menus as forms).
2. Drag the plugins/ folder of this zip onto the server's plugins/ folder.
   (Geyser on a proxy: put the .mcpack in that Geyser's packs/ folder instead.)
3. Java pictures (${host.label}): ${host.apply}
   Java players need these pictures; without them they see odd characters instead.
4. Restart, or /kui reload after replacing menus.

Open a menu
-----------
${cmds}

Java players: move the mouse to move the cursor, left click to press, scroll wheel to switch linked pages, sneak to leave.
Hover tooltips: shown automatically on Java when hovering elements with a tooltip.
3D Player Model (Java): click any 3D model to grab it, move the mouse to rotate it, click again to release.
Button actions: supports open:<menu>, back (previous menu), next, prev, close, event:<key> (fires MenuClickEvent API), player:<cmd>, console:<cmd>, message:<text>, sound:<id>, server:<name>.
Player Head / Player Model: Java shows the real skin of anyone (the server loads skins from Mojang,
so it needs internet). Bedrock shows the player's own paper doll; a head / model of someone else is Steve.
Bedrock players: the menu opens as a form with the real mouse / touch.

Pack version ${p.packVersion}: Bedrock players download the pack again only when this number changes,
so always use the newest export.
${creditText}`;
    }

    /* ───────────── main ───────────── */

    /**
     * Builds every export file. Changes the project only to add pack UUIDs / bump packVersion
     * (the caller saves it afterwards).
     */
    async function build(project) {
        const p = project;
        const problems = M().validate(p);
        const errors = problems.filter(x => x.level === 'error');
        if (errors.length) {
            const err = new Error(errors.map(e => '• ' + e.msg).join('\n'));
            err.problems = problems;
            throw err;
        }
        if (!p.packUuids || !p.packUuids.header || !p.packUuids.module) p.packUuids = { header: uuid4(), module: uuid4() };
        p.packVersion = (M().int(p.packVersion, 0) || 0) + 1;

        const ns = p.namespace;
        const glyphs = new GlyphTable(ns);
        const tilesOf = (imageId, w, h, detail) => glyphs.tiles(imageId, M().int(w, 1), M().int(h, 1), detail);

        // cursor glyph first so it is always U+E000
        let cursorSrc = p.cursor.image && p.images[p.cursor.image] ? p.images[p.cursor.image] : null;
        const cursorH = M().clamp(M().int(p.cursor.height, 12), 4, 64);
        const cursorW = cursorSrc ? Math.max(1, Math.round(cursorSrc.w * cursorH / cursorSrc.h)) : Math.round(8 * cursorH / 12);
        const cursorGlyph = glyphs.get('__cursor', cursorW, cursorH);
        cursorGlyph.file = 'cursor';

        const root = [];
        p.menus.forEach(m => root.push({ path: `plugins/KaizerUI/menus/${m.id}.yml`, text: menuYaml(p, m, tilesOf) }));
        root.push({ path: 'plugins/KaizerUI/studio.yml', text: studioYaml(p, cursorGlyph) });

        /* Java pack */
        const host = PACK_HOSTS[p.settings.packHost] || PACK_HOSTS.itemsadder;
        const javaPack = [];
        if (host.mcmeta) javaPack.push({ path: 'pack.mcmeta', text: packMcmeta(`KaizerUI menus (${ns})`) });
        const providers = [];
        for (const g of glyphs.all()) {
            let png;
            if (g.imageId === '__cursor') png = await renderPng(cursorSrc ? cursorSrc.data : defaultCursorPng(), g.w, g.h, null, true);
            else {
                const d = g.detail || 1;
                const t = g.tile ? { x: g.tile.x * d, y: g.tile.y * d, w: g.tile.w * d, h: g.tile.h * d } : null;
                png = await renderPng(p.images[g.imageId].data, g.fullW * d, g.fullH * d, t, true);
            }
            javaPack.push({ path: `assets/${ns}/textures/gui/${g.file}.png`, base64: png });
            providers.push({ type: 'bitmap', file: `${ns}:gui/${g.file}.png`, ascent: g.ascent, height: g.h, chars: [String.fromCodePoint(g.cp)] });
        }
        javaPack.push({ path: `assets/${ns}/font/gui.json`, text: JSON.stringify({ providers }, null, 2) + '\n' });
        if (p.menus.some(m => m.elements.some(e => !e.hidden && M().isPlayer(e)))) {
            // Player Head / Model: one white pixel per row (see SKIN_ROWS) + spaces
            javaPack.push({ path: `assets/${ns}/textures/gui/kz_px.png`, base64: whitePixelPng() });
            const rows = [];
            for (let r = 0; r < SKIN_ROWS; r++) rows.push({ type: 'bitmap', file: `${ns}:gui/kz_px.png`, ascent: 1 - r, height: 1, chars: [String.fromCodePoint(0xE000 + r)] });
            const adv = {};
            Object.entries(SKIN_SPACES).forEach(([ch, a]) => { adv[JSON.parse('"' + ch + '"')] = a; });
            rows.push({ type: 'space', advances: adv });
            javaPack.push({ path: `assets/${ns}/font/${SKIN_FONT}.json`, text: JSON.stringify({ providers: rows }, null, 2) + '\n' });
        }

        /* Bedrock pack */
        const bedrockPack = [];
        const texDir = `${ns}_gui`;
        const usedTex = new Set();
        const texOf = (imageId) => { usedTex.add(imageId); return `textures/${texDir}/${imageId}`; };
        const strips = new Map();
        const stripOf = (el) => {
            const ids = [el.image].concat(el.frames || []).filter(id => id && p.images[id]);
            if (!el.image || !p.images[el.image] || ids.length < 2) return null;
            const first = p.images[el.image];
            const key = M().slug(`${el.id}_frames`, 'frames');
            if (!strips.has(key)) strips.set(key, { ids, w: first.w, h: first.h });
            const anim = `${ns}_fb_${key}`;
            flipBooks[anim] = { anim_type: 'flip_book', initial_uv: [0, 0], frame_count: ids.length, frame_step: first.h, fps: M().clamp(M().num(el.fps, 8), 1, 30), looping: true, easing: 'linear' };
            return { texture: `textures/${texDir}/${key}`, uvSize: [first.w, first.h], uv: `@server_form.${anim}` };
        };
        const flipBooks = {};
        let formJson = serverFormJson(p, texOf, stripOf);
        if (Object.keys(flipBooks).length) {
            const o = JSON.parse(formJson);
            Object.assign(o, flipBooks);
            formJson = JSON.stringify(o, null, 2) + '\n';
        }
        bedrockPack.push({
            path: 'manifest.json',
            text: JSON.stringify({
                format_version: 2,
                header: {
                    name: `KaizerUI menus (${ns})`,
                    description: 'Cursor GUI menus — made with KaizerHUD Studio',
                    uuid: p.packUuids.header,
                    version: [1, 0, p.packVersion],
                    min_engine_version: [1, 20, 0]
                },
                modules: [{ type: 'resources', uuid: p.packUuids.module, version: [1, 0, p.packVersion] }]
            }, null, 2) + '\n'
        });
        bedrockPack.push({ path: 'ui/server_form.json', text: formJson });
        for (const id of usedTex) {
            const im = p.images[id];
            if (!im) continue;
            bedrockPack.push({ path: `textures/${texDir}/${id}.png`, base64: await renderPng(im.data, im.w, im.h) });
        }
        for (const [key, st] of strips) bedrockPack.push({ path: `textures/${texDir}/${key}.png`, base64: await stripPng(st.ids.map(id => p.images[id].data), st.w, st.h) });

        let javaPackName = `KaizerUI_${ns}_java_pack.zip`;
        if (host.dir) {
            // merged into the pack plugin's folder: the files go to plugins/<plugin>/… in the main zip
            const dir = host.dir(ns);
            javaPack.forEach(f => root.push(Object.assign({}, f, { path: dir + f.path })));
            javaPack.length = 0;
            javaPackName = null;
        }
        const bedrockPackPath = `plugins/Geyser-Spigot/packs/KaizerUI_${ns}.mcpack`;
        root.push({ path: 'README_KaizerUI.txt', text: readme(p, javaPackName, bedrockPackPath) });

        return {
            root, javaPack, bedrockPack, javaPackName, bedrockPackPath,
            fileName: `KaizerUI_${ns}.zip`,
            packHost: p.settings.packHost || 'itemsadder',
            warnings: problems.filter(x => x.level !== 'error'),
            glyphCount: glyphs.all().length
        };
    }

    GS.Export = { PACK_HOSTS, bedrockScale, BEDROCK_MAX_W, BEDROCK_MAX_H, build, bedrockMarker, slotMarker, bedrockSlots, hexToRgb, defaultCursorPng, menuYaml, serverFormJson, bedrockMotion };
})();
