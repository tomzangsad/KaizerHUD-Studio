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
        constructor(ns) { this.ns = ns; this.byKey = new Map(); this.usedFiles = new Set(['cursor', 'kz_px']); this.next = FIRST_GLYPH; }
        /** One glyph for a w×h picture (GUI px), or for one tile of it; `detail` = texture px per GUI px */
        get(imageId, w, h, tile, detail) {
            const d = detail || 1;
            const tk = tile ? `@${tile.x},${tile.y}` : '';
            const key = `${imageId}|${w}x${h}${tk}|${d}`;
            let g = this.byKey.get(key);
            if (!g) {
                if (this.next > 0xF8FF) throw new Error('Too many different picture sizes (more than 6400)');
                const gw = tile ? tile.w : w, gh = tile ? tile.h : h;
                const suffix = (tile ? `_${tile.x}_${tile.y}` : '') + (d > 1 ? `_x${d}` : '');
                const base = String(imageId || 'img').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'img';
                let file = imageId === '__cursor' ? 'cursor' : `${base}_${w}x${h}${suffix}`;
                if (imageId !== '__cursor') {
                    if (this.usedFiles.has(file)) {
                        let n = 2;
                        while (this.usedFiles.has(`${file}_${n}`)) n++;
                        file = `${file}_${n}`;
                    }
                    this.usedFiles.add(file);
                }
                g = {
                    key, imageId, w: gw, h: gh, fullW: w, fullH: h, tile: tile || null, detail: d, cp: this.next++, ascent: Math.min(LINE_ASCENT, gh),
                    file
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

    function rouletteGridBoxes(el, count, slotW, gap) {
        const rows = count >= 6 ? 2 : 1;
        const colsTop = Math.ceil(count / rows);
        const availW = Math.max(24, el.w - 16);
        const availH = Math.max(24, el.h - 14);
        const maxCardW = Math.floor((availW - (colsTop - 1) * gap) / colsTop);
        const maxCardH = Math.floor((availH - (rows - 1) * gap) / rows);
        const size = Math.max(12, Math.min(slotW, maxCardW, maxCardH));
        const totalH = rows * size + (rows - 1) * gap;
        const startY = (el.h - totalH) * 0.5;
        const boxes = [];
        for (let idx = 0; idx < count; idx++) {
            const row = idx < colsTop ? 0 : 1;
            const rowCols = row === 0 ? colsTop : (count - colsTop);
            const col = row === 0 ? idx : (idx - colsTop);
            const rowW = rowCols * size + (rowCols - 1) * gap;
            const startX = (el.w - rowW) * 0.5;
            boxes.push({
                x: Math.round(startX + col * (size + gap)),
                y: Math.round(startY + row * (size + gap)),
                size
            });
        }
        return boxes;
    }

    function makeAnimChain(root, prefix, prop, segs) {
        if (!segs || !segs.length) return null;
        const clean = segs.filter(s => s && s.dur > 0.005);
        if (!clean.length) return null;
        const name = (i) => `${prefix}_${prop}_${i}`;
        clean.forEach((s, i) => {
            const def = {
                anim_type: prop,
                easing: s.ease || 'linear',
                from: s.from,
                to: s.to,
                duration: Math.max(0.01, r3(s.dur))
            };
            if (i < clean.length - 1) def.next = `@server_form.${name(i + 1)}`;
            root[name(i)] = def;
        });
        return `@server_form.${name(0)}`;
    }

    function rouletteStaticCard(rw, opts) {
        const o = opts || {};
        const controls = [
            {
                bg: {
                    type: 'image', texture: 'textures/ui/white_background',
                    size: ['100%', '100%'], keep_ratio: false,
                    color: o.mystery ? [0.12, 0.16, 0.25] : [0.1, 0.12, 0.18],
                    alpha: o.alpha != null ? o.alpha : 0.92, layer: 1
                }
            },
            {
                bar: {
                    type: 'image', texture: 'textures/ui/white_background',
                    anchor_from: 'top_left', anchor_to: 'top_left',
                    size: ['100%', 2], keep_ratio: false,
                    color: hexToRgb(o.accent || (rw && rw.color) || '#3b82f6'),
                    alpha: o.alpha != null ? Math.min(1, o.alpha + 0.08) : 1.0, layer: 2
                }
            }
        ];
        if (o.mystery) {
            controls.push({
                q: {
                    type: 'label', text: '?', localize: false,
                    color: [0.96, 0.77, 0.33], shadow: true, font_scale_factor: 1.25,
                    layer: 3
                }
            });
        } else if (o.winnerSlotControl) {
            controls.push({ winner_icon: o.winnerSlotControl });
        } else if (rw) {
            const tex = GS.Items ? GS.Items.bedrockTexture({ item: rw.item }) : null;
            if (tex) controls.push({ icon: { type: 'image', texture: tex, size: ['68%', '68%'], layer: 3, bilinear: false } });
        }
        return controls;
    }

    function bedrockElement(el, slot, layer, texOf, stripOf) {
        const pos = { anchor_from: 'top_left', anchor_to: 'top_left', offset: [el.x, el.y], size: [el.w, el.h], layer };
        // animated picture: every frame stacked in one texture, played with a flip_book anim
        const strip = stripOf ? stripOf(el) : null;
        const pic = (tex) => strip ? { texture: strip.texture, uv_size: strip.uvSize, uv: strip.uv } : { texture: tex };
        if (el.type === 'image') {
            return { type: 'image', ...pic(texOf(el.image)), keep_ratio: false, ...pos };
        }
        if (M().isPlayer(el)) return bedrockPlayer(el, pos);
        if (el.type === 'roulette') {
            const rewards = Array.isArray(el.rewards) && el.rewards.length ? el.rewards : [{ name: 'Prize', item: 'minecraft:diamond', color: '#3b82f6' }];
            const style = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(el.spinStyle) ? el.spinStyle : 'csgo';
            const slotW = Math.max(12, M().int(el.slotSize, 44));
            const gap = Math.max(0, M().int(el.slotGap, 6));
            const step = slotW + gap;
            const reels = M().clamp(M().int(el.reels, 3), 1, 5);
            const cardCount = M().clamp(M().int(el.cardCount, 5), 3, 9);
            const needleCol = hexToRgb(el.pointerColor || '#ff4d4f');
            const cards = [];
            let showVertNeedle = false;
            let showHorizNeedle = false;

            if (style === 'flash' || style === 'flip') {
                const boxes = rouletteGridBoxes(el, cardCount, slotW, gap);
                boxes.forEach((b, idx) => {
                    const rw = rewards[idx % rewards.length];
                    cards.push({
                        ['rc_' + idx]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [b.x, b.y], size: [b.size, b.size], layer: 1,
                            controls: rouletteStaticCard(rw, { mystery: style === 'flip', accent: style === 'flip' ? (el.borderColor || '#e5a43a') : rw.color })
                        }
                    });
                });
            } else if (style === 'slot_v') {
                showHorizNeedle = true;
                const availW = Math.max(20, el.w - 12 - (reels - 1) * gap);
                const cardW = Math.max(12, Math.min(slotW, Math.floor(availW / reels)));
                const cardH = Math.max(12, Math.min(slotW, Math.floor((el.h - 8) * 0.52)));
                const stepV = cardH + gap;
                const totalW = reels * cardW + (reels - 1) * gap;
                const startX = Math.round((el.w - totalW) * 0.5);
                for (let r = 0; r < reels; r++) {
                    const lx = Math.round(startX + r * (cardW + gap));
                    if (r > 0) {
                        cards.push({
                            ['sep_' + r]: {
                                type: 'image', texture: 'textures/ui/white_background',
                                anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [Math.round(lx - gap * 0.5), 4], size: [1, Math.max(4, el.h - 8)],
                                color: [1, 1, 1], alpha: 0.14, keep_ratio: false, layer: 2
                            }
                        });
                    }
                    for (let row = 0; row < 4; row++) {
                        const rw = rewards[(row + r) % rewards.length];
                        const cy = Math.round((el.h - cardH) * 0.5 + (row - 1) * stepV);
                        cards.push({
                            [`rc_${r}_${row}`]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [lx, cy], size: [cardW, cardH], layer: 1,
                                controls: rouletteStaticCard(rw)
                            }
                        });
                    }
                }
            } else {
                showVertNeedle = true;
                const cardH = Math.max(10, Math.min(el.h - 6, slotW));
                const cy = Math.round((el.h - cardH) * 0.5);
                for (let idx = 0; idx < 8; idx++) {
                    const rw = rewards[idx % rewards.length];
                    const cx = Math.round((el.w - slotW) * 0.5 + (idx - 2) * step);
                    cards.push({
                        ['rc_' + idx]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [cx, cy], size: [slotW, cardH], layer: 1,
                            controls: rouletteStaticCard(rw)
                        }
                    });
                }
            }
            const rc = [
                { bg: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: hexToRgb(el.bgColor || '#0d111a'), alpha: 0.92, layer: 0 } },
                ...cards
            ];
            if (showVertNeedle) {
                rc.push({ needle: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_middle', anchor_to: 'top_middle', size: [2, '100%'], keep_ratio: false, color: needleCol, layer: 6 } });
            }
            if (showHorizNeedle) {
                rc.push({ needle: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'left_middle', anchor_to: 'left_middle', size: ['100%', 2], keep_ratio: false, color: needleCol, layer: 6 } });
            }
            return { type: 'panel', ...pos, clips_children: true, controls: rc };
        }
        if (el.type === 'item') {
            if (slot != null) {
                return {
                    type: 'panel', ...pos,
                    bindings: [COLLECTION_TEXT, showIfSlot(slot)],
                    controls: [{
                        icon: {
                            type: 'image',
                            size: ['100%', '100%'],
                            layer: 1,
                            bilinear: false,
                            bindings: [
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_name_override: '#texture' },
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture_file_system', binding_name_override: '#texture_file_system' },
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture' },
                                { binding_type: 'view', source_property_name: "(not (#form_button_texture = ''))", target_property_name: '#visible' }
                            ]
                        }
                    }]
                };
            }
            // static item texture from pack or vanilla mapping
            const tex = GS.Items ? GS.Items.bedrockTexture(el) : null;
            return tex ? { type: 'image', texture: tex, ...pos } : { type: 'panel', ...pos };
        }
        if (el.type === 'custom_model') {
            const tex = String(el.bedrockTexture || '').trim() || (GS.Items && GS.Items.customBedrockPath ? GS.Items.customBedrockPath(el.modelId) : null);
            return tex ? { type: 'image', texture: tex, ...pos } : { type: 'panel', ...pos };
        }
        if (el.type === 'input') {
            const bgHex = hexToRgb(el.bgColor || '#161b26');
            const brHex = hexToRgb(el.borderColor || '#52a0f0');
            const face = (bgTint, brAlpha) => ({
                type: 'panel', size: ['100%', '100%'],
                controls: [
                    { bg: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], color: bgTint, alpha: 0.88 } },
                    { border_t: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 1], color: brHex, alpha: brAlpha } },
                    { border_b: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 1], color: brHex, alpha: brAlpha } }
                ]
            });
            return {
                type: 'button', ...pos,
                default_control: 'default', hover_control: 'hover', pressed_control: 'pressed',
                sound_name: 'random.click', sound_volume: 1.0,
                button_mappings: [
                    { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                    { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
                ],
                bindings: [{ binding_type: 'collection_details', binding_collection_name: 'form_buttons' }, COLLECTION_TEXT, showIfSlot(slot)],
                controls: [
                    { default: face(bgHex, 0.9) },
                    { hover: face(bgHex.map(c => Math.min(1, c + 0.12)), 1.0) },
                    { pressed: face(bgHex.map(c => Math.max(0, c - 0.08)), 1.0) },
                    {
                        label: {
                            type: 'label', layer: 2,
                            text: '#kz_text',
                            localize: false,
                            bindings: [COLLECTION_TEXT, textOfSlot(slot)],
                            color: hexToRgb(el.textColor || '#ffffff'),
                            shadow: el.shadow !== false,
                            font_scale_factor: Math.max(0.25, M().num(el.scale, 1)),
                            text_alignment: el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center'
                        }
                    }
                ]
            };
        }
        if (el.type === 'text') {
            return {
                type: 'label', ...pos,
                text: '#kz_text',
                localize: false,
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
            ? { type: 'image', ...(tex === img ? pic(tex) : { texture: tex }), size: ['100%', '100%'], keep_ratio: false, ...(tint ? { color: tint } : {}) }
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
                        localize: false,
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
            if (!head) {
                const useLive = el.bedrockRenderer === 'live'
                    || (el.bedrockRenderer !== 'doll' && el.outfit !== 'none' && !['drag', 'mouse'].includes(el.turn));
                if (useLive) {
                    const k = Math.min(el.w / 52, el.h / 70);
                    const r1 = (v) => Math.round(v * 10) / 10;
                    const sz = el.dollSize || [r1(30 * k), r1(30 * k)];
                    const off = el.dollOffset || [0, r1(-14 * k)];
                    return {
                        type: 'panel', ...pos, clips_children: false,
                        controls: [{
                            live_player: {
                                type: 'custom',
                                renderer: 'live_player_renderer',
                                size: sz,
                                offset: off,
                                anchor_from: 'center',
                                anchor_to: 'center',
                                layer: 2,
                                property_bag: { '#look_at_cursor': el.turn !== 'spin' }
                            }
                        }]
                    };
                }
            }
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

    function isDynamicBedrockItem(e) {
        return !!e && e.type === 'item' && !String(e.bedrockTexture || '').trim() && GS.Items && GS.Items.isDynamic(e.item);
    }

    /** Which elements become form buttons (slots) on Bedrock: buttons, texts, inputs, dynamic items */
    function bedrockSlots(menu) {
        const els = menu.elements.filter(e => !e.hidden);
        const slots = new Map();
        let n = 0;
        els.filter(e => e.type === 'button').forEach(e => slots.set(e.id, n++));
        els.filter(e => e.type === 'text').forEach(e => slots.set(e.id, n++));
        els.filter(e => e.type === 'input').forEach(e => slots.set(e.id, n++));
        els.filter(e => isDynamicBedrockItem(e)).forEach(e => slots.set(e.id, n++));
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
            if (e.slotSize != null) e.slotSize = Math.max(12, r(e.slotSize));
            if (e.slotGap != null) e.slotGap = r(e.slotGap);
            if (e.contentW != null) e.contentW = Math.max(e.w, r(e.contentW));
            if (e.contentH != null) e.contentH = Math.max(e.h, r(e.contentH));
            if (e.stepPx != null) e.stepPx = Math.max(4, r(e.stepPx));
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
            const shown = menu.elements.filter(e => !e.hidden && !(e.type === 'image' && !p.images[e.image]) && !(e.type === 'item' && !String(e.item || '').trim()) && !(e.type === 'custom_model' && !String(e.modelId || '').trim()));
            // pictures: placed straight in the menu panel
            const controls = [];
            const slotControls = [];
            const rouletteControlMap = new Map();
            const scrollAreas = new Map();
            shown.filter(e => e.type === 'scroll_area').forEach(a => scrollAreas.set(a.id, { area: a, controls: [], slotControls: [] }));
            const clips = scaledClips(GS.Motion.resolve(menu0), kB);
            shown.forEach((e, i) => {
                if (e.type === 'scroll_area') return; // emitted below with its children inside
                const scEntry = e.scrollGroup ? scrollAreas.get(e.scrollGroup) : null;
                const relEl = scEntry ? Object.assign({}, e, { x: e.x - scEntry.area.x, y: e.y - scEntry.area.y }) : e;
                const key = `${e.type}_${M().slug(e.id, 'el')}`;
                const def = bedrockElement(relEl, slots.get(e.id), i + 1, texOf, stripOf);
                const cl = clips.elements[e.id] || {};
                const steps = [];
                if (cl.intro) steps.push({ clip: cl.intro, start: 0 });
                if (cl.loop) steps.push({ clip: cl.loop, start: cl.loop.delay || 0 });
                const mo = steps.length ? bedrockMotion(`${ns}_mo_${menu.id}_${M().slug(e.id, 'el')}`, { x: relEl.x, y: relEl.y, w: relEl.w, h: relEl.h }, steps) : null;
                let c;
                if (mo && Object.keys(mo.props).length) {
                    Object.assign(root, mo.defs);
                    // the anims move / fade a panel around the element; the element fills it
                    const inner = Object.assign({}, def, { offset: [0, 0], size: ['100%', '100%'], layer: 1 });
                    const wrap = {
                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                        offset: mo.props.offset || [relEl.x, relEl.y], size: mo.props.size || [relEl.w, relEl.h], layer: i + 1,
                        controls: [{ [key]: inner }]
                    };
                    if (mo.props.alpha) { wrap.propagate_alpha = true; wrap.alpha = mo.props.alpha; }
                    if (slots.has(e.id)) wrap.bindings = [COLLECTION_TEXT, showIfSlot(slots.get(e.id))];
                    c = { [`mo_${key}`]: wrap };
                } else c = { [key]: def };
                if (e.type === 'roulette') rouletteControlMap.set(e.id, { c, layer: i + 1, scEntry, relEl });
                if (scEntry) (slots.has(e.id) ? scEntry.slotControls : scEntry.controls).push(c);
                else (slots.has(e.id) ? slotControls : controls).push(c);
            });
            // Emit scrollable / 2D map viewports using Bedrock common.scrolling_panel + scoped form_buttons factory
            for (const [aid, entry] of scrollAreas.entries()) {
                const a = entry.area;
                const aslug = M().slug(aid, 's');
                const slotDefName = `${ns}_scslot_${menu.id}_${aslug}`;
                const contentDefName = `${ns}_sc_${menu.id}_${aslug}`;
                root[slotDefName] = {
                    type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                    controls: entry.slotControls
                };
                const scKids = entry.controls.slice();
                scKids.push({
                    slots: {
                        type: 'stack_panel', orientation: 'vertical',
                        size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                        factory: { name: 'buttons', control_name: `server_form.${slotDefName}` },
                        collection_name: 'form_buttons',
                        bindings: [{ binding_name: '#form_button_length', binding_name_override: '#collection_length' }]
                    }
                });
                root[contentDefName] = {
                    type: 'panel',
                    size: [Math.max(a.w, a.contentW || a.w), Math.max(a.h, a.contentH || a.h)],
                    anchor_from: 'top_left', anchor_to: 'top_left',
                    controls: scKids
                };
                const aLayer = shown.indexOf(a) + 1;
                controls.push({
                    [`scroll_${aslug}`]: {
                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                        offset: [a.x, a.y], size: [a.w, a.h], layer: aLayer, clips_children: true,
                        controls: [
                            { bg: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], color: hexToRgb(a.bgColor || '#0e131f'), alpha: 0.85, layer: 0 } },
                            {
                                [`sv@common.scrolling_panel`]: {
                                    size: ['100%', '100%'], layer: 1,
                                    '$scrolling_pane_size': ['100%', '100%'],
                                    '$scroll_size': a.showScrollbar !== false ? [4, '100%'] : [0, 0],
                                    '$show_background': false,
                                    '$scrolling_content': `server_form.${contentDefName}`
                                }
                            }
                        ]
                    }
                });
            }
            root[`${ns}_slot_${menu.id}`] = {
                type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                controls: slotControls
            };
            const slotsFactoryCtrl = {
                slots: {
                    type: 'stack_panel', orientation: 'vertical',
                    size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                    factory: { name: 'buttons', control_name: `server_form.${ns}_slot_${menu.id}` },
                    collection_name: 'form_buttons',
                    bindings: [{ binding_name: '#form_button_length', binding_name_override: '#collection_length' }]
                }
            };
            const baseControls = controls.slice();
            controls.push(slotsFactoryCtrl);

            // In-place Bedrock Animated Spin overlays on the same menu page (supports csgo, tease, slot_v, flash, flip)
            const winSlotIdx = slots.size;
            for (const el of shown.filter(x => x.type === 'roulette')) {
                const rslug = M().slug(el.id, 'r');
                const rewards = Array.isArray(el.rewards) && el.rewards.length ? el.rewards : [{ name: 'Prize', item: 'minecraft:diamond', color: '#3b82f6' }];
                const style = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(el.spinStyle) ? el.spinStyle : 'csgo';
                const slotW = Math.max(12, M().int(el.slotSize, 44));
                const gap = Math.max(0, M().int(el.slotGap, 6));
                const step = slotW + gap;
                const reels = M().clamp(M().int(el.reels, 3), 1, 5);
                const cardCount = M().clamp(M().int(el.cardCount, 5), 3, 9);
                const dur = M().clamp(M().num(el.durationSec, 4.2), 1, 15);
                const animPrefix = `${ns}_sp_${menu.id}_${rslug}`;

                const makeWinSlotFactory = (iconW, iconH) => {
                    const winSlotDef = `${ns}_winicon_${menu.id}_${rslug}`;
                    root[winSlotDef] = {
                        type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                        controls: [{
                            icon: {
                                type: 'image', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [-Math.round(iconW * 0.5), -Math.round(iconH * 0.5)],
                                size: [iconW, iconH], layer: 1, bilinear: false,
                                bindings: [
                                    COLLECTION_TEXT,
                                    showIfSlot(winSlotIdx),
                                    { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_name_override: '#texture' },
                                    { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture_file_system', binding_name_override: '#texture_file_system' }
                                ]
                            }
                        }]
                    };
                    return {
                        type: 'stack_panel', orientation: 'vertical', size: [0, 0],
                        anchor_from: 'center', anchor_to: 'center', layer: 4,
                        factory: { name: 'buttons', control_name: `server_form.${winSlotDef}` },
                        collection_name: 'form_buttons',
                        bindings: [{ binding_name: '#form_button_length', binding_name_override: '#collection_length' }]
                    };
                };

                const vpControls = [
                    { bg: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: hexToRgb(el.bgColor || '#0d111a'), alpha: 0.96, layer: 0 } }
                ];
                const brCol = hexToRgb(el.borderColor || '#e5a43a');
                vpControls.push(
                    { b_t: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 1], keep_ratio: false, color: brCol, alpha: 0.85, layer: 8 } },
                    { b_b: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 1], keep_ratio: false, color: brCol, alpha: 0.85, layer: 8 } },
                    { b_l: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: [1, '100%'], keep_ratio: false, color: brCol, alpha: 0.85, layer: 8 } },
                    { b_r: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_right', anchor_to: 'top_right', size: [1, '100%'], keep_ratio: false, color: brCol, alpha: 0.85, layer: 8 } }
                );

                if (style === 'slot_v') {
                    const availW = Math.max(20, el.w - 12 - (reels - 1) * gap);
                    const cardW = Math.max(12, Math.min(slotW, Math.floor(availW / reels)));
                    const cardH = Math.max(12, Math.min(slotW, Math.floor((el.h - 8) * 0.52)));
                    const stepV = cardH + gap;
                    const totalW = reels * cardW + (reels - 1) * gap;
                    const startColX = Math.round((el.w - totalW) * 0.5);
                    const CARD_COUNT = 24, WIN_IDX = 18;
                    const startY = Math.round((el.h - cardH) * 0.5 - 2 * stepV);
                    const endY = Math.round((el.h - cardH) * 0.5 - WIN_IDX * stepV);
                    const iconSz = Math.max(8, Math.round(Math.min(cardW, cardH) * 0.68));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);

                    for (let r = 0; r < reels; r++) {
                        const lx = Math.round(startColX + r * (cardW + gap));
                        if (r > 0) {
                            vpControls.push({
                                ['sep_' + r]: {
                                    type: 'image', texture: 'textures/ui/white_background',
                                    anchor_from: 'top_left', anchor_to: 'top_left',
                                    offset: [Math.round(lx - gap * 0.5), 4], size: [1, Math.max(4, el.h - 8)],
                                    keep_ratio: false, color: [1, 1, 1], alpha: 0.14, layer: 3
                                }
                            });
                        }
                        const reelDur = r3(dur * (reels === 1 ? 1 : (0.58 + 0.42 * r / (reels - 1))));
                        const animName = `${animPrefix}_reel_${r}`;
                        root[animName] = {
                            anim_type: 'offset',
                            easing: 'out_cubic',
                            from: [0, startY],
                            to: [0, endY],
                            duration: Math.max(0.2, reelDur)
                        };
                        const rCards = [];
                        for (let idx = 0; idx < CARD_COUNT; idx++) {
                            const rw = rewards[(idx + r * 2) % rewards.length];
                            const cy = idx * stepV;
                            rCards.push({
                                ['sc_' + idx]: {
                                    type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                    offset: [0, cy], size: [cardW, cardH], layer: 1,
                                    controls: rouletteStaticCard(rw, {
                                        accent: idx === WIN_IDX ? '#ffd24c' : rw.color,
                                        winnerSlotControl: idx === WIN_IDX ? winnerSlotFactory : null
                                    })
                                }
                            });
                        }
                        vpControls.push({
                            ['reel_col_' + r]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [lx, 0], size: [cardW, el.h], clips_children: true, layer: 1,
                                controls: [{
                                    track: {
                                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                        offset: `@server_form.${animName}`, size: [cardW, CARD_COUNT * stepV], layer: 1,
                                        controls: rCards
                                    }
                                }]
                            }
                        });
                    }
                    vpControls.push({ needle: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'left_middle', anchor_to: 'left_middle', size: ['100%', 2], keep_ratio: false, color: hexToRgb(el.pointerColor || '#ff4d4f'), layer: 7 } });
                } else if (style === 'flash') {
                    const boxes = rouletteGridBoxes(el, cardCount, slotW, gap);
                    const winSlot = Math.floor(cardCount / 2);
                    const iconSz = Math.max(8, Math.round((boxes[0] ? boxes[0].size : slotW) * 0.68));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);
                    const HOPS = 14;
                    const hopTimes = [];
                    for (let k = 0; k <= HOPS; k++) {
                        hopTimes.push(r3(dur * (1 - Math.pow(1 - k / HOPS, 1 / 2.2))));
                    }
                    const hopStart = ((winSlot - HOPS) % cardCount + cardCount) % cardCount;
                    const activeAt = hopTimes.map((_, k) => k === HOPS ? winSlot : (hopStart + k) % cardCount);

                    boxes.forEach((b, idx) => {
                        const stages = 4;
                        const iconControls = [];
                        for (let st = 0; st < stages; st++) {
                            const segT0 = r3(dur * st / stages);
                            const segT1 = r3(dur * (st + 1) / stages);
                            const activeLast = st === stages - 1;
                            const isWinnerFinal = idx === winSlot && activeLast;
                            const aSegs = [];
                            if (segT0 > 0.01) aSegs.push({ from: 0, to: 0, dur: segT0 });
                            aSegs.push({ from: 1, to: 1, dur: Math.max(0.05, (activeLast ? dur : segT1) - segT0) });
                            if (!activeLast) aSegs.push({ from: 1, to: 0, dur: 0.02 });
                            const iconAlpha = makeAnimChain(root, `${animPrefix}_fi_${idx}_${st}`, 'alpha', aSegs);
                            const rw = rewards[(idx * 3 + st * 2) % rewards.length];
                            if (isWinnerFinal) {
                                iconControls.push({
                                    ['ic_' + st]: {
                                        type: 'panel', size: ['100%', '100%'], propagate_alpha: true,
                                        alpha: iconAlpha, layer: 3 + st,
                                        controls: [{ winner_icon: winnerSlotFactory }]
                                    }
                                });
                            } else {
                                const tex = GS.Items ? GS.Items.bedrockTexture({ item: rw.item }) : null;
                                if (tex) {
                                    iconControls.push({
                                        ['ic_' + st]: {
                                            type: 'image', texture: tex, size: ['68%', '68%'], bilinear: false,
                                            alpha: iconAlpha, layer: 3 + st
                                        }
                                    });
                                }
                            }
                        }

                        const glowSegs = [];
                        let curT = 0;
                        for (let k = 0; k < hopTimes.length; k++) {
                            const tNext = k + 1 < hopTimes.length ? hopTimes[k + 1] : dur + 0.05;
                            const stepDur = Math.max(0.02, r3(tNext - curT));
                            const on = activeAt[k] === idx ? 0.95 : 0.0;
                            glowSegs.push({ from: on, to: on, dur: stepDur });
                            curT = tNext;
                        }
                        const glowAlpha = makeAnimChain(root, `${animPrefix}_fg_${idx}`, 'alpha', glowSegs);
                        const rwBase = rewards[idx % rewards.length];
                        const gCol = [1.0, 0.82, 0.29];
                        vpControls.push({
                            ['fl_' + idx]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [b.x, b.y], size: [b.size, b.size], layer: 2,
                                controls: [
                                    { bg: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: [0.1, 0.12, 0.18], alpha: 0.9, layer: 1 } },
                                    { bar: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 2], keep_ratio: false, color: hexToRgb(idx === winSlot ? '#ffd24c' : (rwBase.color || '#3b82f6')), layer: 2 } },
                                    ...iconControls,
                                    {
                                        glow: {
                                            type: 'panel', size: ['100%', '100%'], propagate_alpha: true, alpha: glowAlpha, layer: 6,
                                            controls: [
                                                { gt: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 2], keep_ratio: false, color: gCol } },
                                                { gb: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 2], keep_ratio: false, color: gCol } },
                                                { gl: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: [2, '100%'], keep_ratio: false, color: gCol } },
                                                { gr: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_right', anchor_to: 'top_right', size: [2, '100%'], keep_ratio: false, color: gCol } }
                                            ]
                                        }
                                    }
                                ]
                            }
                        });
                    });
                } else if (style === 'flip') {
                    const boxes = rouletteGridBoxes(el, cardCount, slotW, gap);
                    const winSlot = Math.floor(cardCount / 2);
                    const iconSz = Math.max(8, Math.round((boxes[winSlot] ? boxes[winSlot].size : slotW) * 0.72));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);
                    const tPhase1 = r3(dur * 0.64);
                    const tPhase2 = r3(dur * 0.84);
                    const tWinMid = r3((tPhase1 + tPhase2) * 0.5);
                    const tOtherMid = r3((tPhase2 + dur) * 0.5);
                    const HOPS = 10;
                    const hopTimes = [];
                    for (let k = 0; k <= HOPS; k++) hopTimes.push(r3(tPhase1 * (1 - Math.pow(1 - k / HOPS, 1 / 2.2))));
                    const hopStart = ((winSlot - HOPS) % cardCount + cardCount) % cardCount;
                    const activeAt = hopTimes.map((_, k) => k === HOPS ? winSlot : (hopStart + k) % cardCount);
                    const gCol = [1.0, 0.82, 0.29];

                    boxes.forEach((b, idx) => {
                        const isWin = idx === winSlot;
                        const rw = rewards[idx % rewards.length];
                        const sz = b.size;
                        const winSz = Math.round(sz * 1.12);
                        const flipStart = isWin ? tPhase1 : tPhase2;
                        const flipMid = isWin ? tWinMid : tOtherMid;
                        const flipEnd = isWin ? tPhase2 : dur;
                        const halfFlip = Math.max(0.05, r3(flipMid - flipStart));

                        const backSize = makeAnimChain(root, `${animPrefix}_fbs_${idx}`, 'size', [
                            { from: [sz, sz], to: [sz, sz], dur: flipStart },
                            { from: [sz, sz], to: [2, sz], dur: halfFlip, ease: 'in_quad' }
                        ]);
                        const backAlpha = makeAnimChain(root, `${animPrefix}_fba_${idx}`, 'alpha', [
                            { from: 1, to: 1, dur: flipMid },
                            { from: 1, to: 0, dur: 0.02 }
                        ]);
                        const frontSize = makeAnimChain(root, `${animPrefix}_ffs_${idx}`, 'size', [
                            { from: [2, sz], to: [2, sz], dur: flipMid },
                            { from: [2, sz], to: isWin ? [winSz, winSz] : [sz, sz], dur: Math.max(0.05, r3(flipEnd - flipMid)), ease: 'out_back' }
                        ]);
                        const targetAlpha = isWin ? 1.0 : 0.45;
                        const frontAlpha = makeAnimChain(root, `${animPrefix}_ffa_${idx}`, 'alpha', [
                            { from: 0, to: 0, dur: flipMid },
                            { from: targetAlpha, to: targetAlpha, dur: 0.04 }
                        ]);

                        const glowSegs = [];
                        let curT = 0;
                        for (let k = 0; k < hopTimes.length; k++) {
                            const tNext = k + 1 < hopTimes.length ? hopTimes[k + 1] : tPhase1;
                            const stepDur = Math.max(0.02, r3(tNext - curT));
                            const on = activeAt[k] === idx ? 0.95 : 0.0;
                            glowSegs.push({ from: on, to: on, dur: stepDur });
                            curT = tNext;
                        }
                        glowSegs.push({ from: 0, to: 0, dur: Math.max(0.05, r3(dur - tPhase1)) });
                        const glowAlpha = makeAnimChain(root, `${animPrefix}_fbg_${idx}`, 'alpha', glowSegs);

                        const cellControls = [
                            {
                                back: {
                                    type: 'panel', anchor_from: 'center', anchor_to: 'center',
                                    size: backSize, propagate_alpha: true, alpha: backAlpha, clips_children: true, layer: 2,
                                    controls: [
                                        ...rouletteStaticCard(rw, { mystery: true, accent: el.borderColor || '#e5a43a' }),
                                        {
                                            glow: {
                                                type: 'panel', size: ['100%', '100%'], propagate_alpha: true, alpha: glowAlpha, layer: 5,
                                                controls: [
                                                    { gt: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 2], keep_ratio: false, color: gCol } },
                                                    { gb: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 2], keep_ratio: false, color: gCol } },
                                                    { gl: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_left', anchor_to: 'top_left', size: [2, '100%'], keep_ratio: false, color: gCol } },
                                                    { gr: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_right', anchor_to: 'top_right', size: [2, '100%'], keep_ratio: false, color: gCol } }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                front: {
                                    type: 'panel', anchor_from: 'center', anchor_to: 'center',
                                    size: frontSize, propagate_alpha: true, alpha: frontAlpha, clips_children: true, layer: isWin ? 4 : 3,
                                    controls: rouletteStaticCard(rw, {
                                        accent: isWin ? '#ffd24c' : (rw.color || '#3b82f6'),
                                        winnerSlotControl: isWin ? winnerSlotFactory : null
                                    })
                                }
                            }
                        ];

                        vpControls.push({
                            ['fp_' + idx]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [b.x, b.y], size: [sz, sz], layer: isWin ? 5 : 2,
                                controls: cellControls
                            }
                        });
                    });
                } else {
                    const cardH = Math.max(10, Math.min(el.h - 6, slotW));
                    const cardY = Math.round((el.h - cardH) * 0.5);
                    const WIN_IDX = 20, CARD_COUNT = 26;
                    const startX = Math.round((el.w - slotW) * 0.5 - 2 * step);
                    const endX = Math.round((el.w - slotW) * 0.5 - WIN_IDX * step);
                    const iconSz = Math.max(8, Math.round(Math.min(slotW, cardH) * 0.68));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);
                    const animName = `${animPrefix}_strip`;
                    root[animName] = {
                        anim_type: 'offset',
                        easing: style === 'tease' ? 'out_back' : 'out_cubic',
                        from: [startX, 0],
                        to: [endX, 0],
                        duration: dur
                    };

                    const cards = [];
                    for (let idx = 0; idx < CARD_COUNT; idx++) {
                        const rw = rewards[idx % rewards.length];
                        const cx = idx * step;
                        cards.push({
                            ['sc_' + idx]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [cx, cardY], size: [slotW, cardH], layer: idx === WIN_IDX ? 3 : 1,
                                controls: rouletteStaticCard(rw, {
                                    accent: idx === WIN_IDX ? '#ffd24c' : rw.color,
                                    winnerSlotControl: idx === WIN_IDX ? winnerSlotFactory : null
                                })
                            }
                        });
                    }
                    vpControls.push(
                        { track: { type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left', offset: `@server_form.${animName}`, size: [CARD_COUNT * step, el.h], layer: 1, controls: cards } },
                        { needle: { type: 'image', texture: 'textures/ui/white_background', anchor_from: 'top_middle', anchor_to: 'top_middle', size: [2, '100%'], keep_ratio: false, color: hexToRgb(el.pointerColor || '#ff4d4f'), layer: 6 } }
                    );
                }

                // Delayed winner badge: stays hidden during spin, fades in smoothly once the spin lands
                const claimAlpha = makeAnimChain(root, `${animPrefix}_claim_a`, 'alpha', [
                    { from: 0, to: 0, dur: Math.max(0.2, dur) },
                    { from: 0, to: 1, dur: 0.25, ease: 'out_quad' }
                ]);
                const claimW = Math.min(Math.max(100, el.w), 140);
                const claimX = Math.max(2, Math.min(menu.width - claimW - 2, Math.round(el.x + (el.w - claimW) * 0.5)));
                const claimY = el.y + el.h + 24 <= menu.height
                    ? Math.round(el.y + el.h + 4)
                    : Math.max(2, el.y - 22);
                const claimBtnName = `${ns}_spinclaim_${menu.id}_${rslug}`;
                root[claimBtnName] = {
                    type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                    controls: [{
                        claim_btn: {
                            type: 'button', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [claimX, claimY], size: [claimW, 20], layer: 18,
                            propagate_alpha: true, alpha: claimAlpha,
                            default_control: 'default', hover_control: 'hover', pressed_control: 'pressed',
                            sound_name: 'random.click', sound_volume: 1.0,
                            button_mappings: [
                                { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                                { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
                            ],
                            bindings: [{ binding_type: 'collection_details', binding_collection_name: 'form_buttons' }, COLLECTION_TEXT, showIfSlot(winSlotIdx)],
                            controls: [
                                { default: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: [0.16, 0.44, 0.28], alpha: 0.94 } },
                                { hover: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: [0.22, 0.56, 0.36], alpha: 0.98 } },
                                { pressed: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false, color: [0.12, 0.34, 0.22], alpha: 0.98 } },
                                { label: { type: 'label', layer: 2, text: '#kz_text', localize: false, bindings: [COLLECTION_TEXT, textOfSlot(winSlotIdx)], color: [1, 1, 1], shadow: true, text_alignment: 'center' } }
                            ]
                        }
                    }]
                };

                const idleEntry = rouletteControlMap.get(el.id);
                const spinMenuControls = baseControls.filter(item => !idleEntry || item !== idleEntry.c);
                spinMenuControls.push(
                    {
                        [`spin_vp_${rslug}`]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [el.x, el.y], size: [el.w, el.h], clips_children: true,
                            layer: (idleEntry ? idleEntry.layer : 4) + 1,
                            controls: vpControls
                        }
                    },
                    slotsFactoryCtrl,
                    {
                        [`claim_slots_${rslug}`]: {
                            type: 'stack_panel', orientation: 'vertical', size: ['100%', '100%'],
                            anchor_from: 'top_left', anchor_to: 'top_left', layer: 20,
                            factory: { name: 'buttons', control_name: `server_form.${claimBtnName}` },
                            collection_name: 'form_buttons',
                            bindings: [{ binding_name: '#form_button_length', binding_name_override: '#collection_length' }]
                        }
                    }
                );

                const spinPanelName = `${ns}_spinpanel_${menu.id}_${rslug}`;
                root[spinPanelName] = {
                    type: 'panel', size: [menu.width, menu.height], anchor_from: 'center', anchor_to: 'center',
                    controls: spinMenuControls
                };
                const spinMarker = `kz:${ns}:spin:${menu.id}:${el.id}|`;
                wrapperControls.push({
                    [`${ns}_show_spin_${menu.id}_${rslug}`]: {
                        type: 'panel', size: ['100%', '100%'],
                        bindings: [{ binding_name: '#title_text' }, { binding_type: 'view', source_property_name: `(not ((#title_text - '${spinMarker}') = #title_text))`, target_property_name: '#visible' }],
                        controls: [
                            ...(menu.fullscreen && menu.bedrockBackdrop ? [{
                                backdrop: {
                                    type: 'image', texture: 'textures/ui/white_background', size: ['400%', '400%'], keep_ratio: false, layer: 0,
                                    anchor_from: 'center', anchor_to: 'center',
                                    color: hexToRgb(menu.backdrop || '#000000'), alpha: M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1)
                                }
                            }] : []),
                            { [`spin@server_form.${spinPanelName}`]: { layer: 1 } }
                        ]
                    }
                });
            }
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
        const visible = menu.elements.filter(e => !e.hidden && !(e.type === 'image' && !p.images[e.image]) && !(e.type === 'item' && !String(e.item || '').trim()) && !(e.type === 'custom_model' && !String(e.modelId || '').trim()) && !(e.type === 'input' && !String(e.varName || '').trim()));
        if (!visible.length) L[L.length - 1] = 'elements: []';
        visible.forEach(e => {
            L.push(`  - id: ${q(e.id)}`);
            L.push(`    type: ${e.type}`);
            L.push(`    name: ${q(e.name || '')}`);
            L.push(`    x: ${M().int(e.x, 0)}`);
            L.push(`    y: ${M().int(e.y, 0)}`);
            L.push(`    w: ${M().int(e.w, 1)}`);
            L.push(`    h: ${M().int(e.h, 1)}`);
            if (e.scrollGroup) L.push(`    scroll-group: ${q(e.scrollGroup)}`);
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
                if (slots.has(e.id)) L.push(`    bedrock-slot: ${slots.get(e.id)}`);
            }
            if (e.type === 'roulette') {
                L.push(`    slot-size: ${M().int(e.slotSize, 44)}`);
                L.push(`    slot-gap: ${M().int(e.slotGap, 6)}`);
                L.push(`    duration: ${M().num(e.durationSec, 4.2)}`);
                L.push(`    spin-style: ${q(e.spinStyle || 'csgo')}`);
                L.push(`    reels: ${M().clamp(M().int(e.reels, 3), 1, 5)}`);
                L.push(`    card-count: ${M().clamp(M().int(e.cardCount, 5), 3, 9)}`);
                L.push(`    bg-color: ${q(e.bgColor || '#0d111a')}`);
                L.push(`    border-color: ${q(e.borderColor || '#e5a43a')}`);
                L.push(`    pointer-color: ${q(e.pointerColor || '#ff4d4f')}`);
                L.push(`    tick-sound: ${q(e.tickSound || '')}`);
                L.push(`    win-sound: ${q(e.winSound || '')}`);
                L.push(`    rewards: ${flow(Array.isArray(e.rewards) ? e.rewards : [])}`);
            }
            if (e.type === 'scroll_area') {
                L.push(`    scroll-mode: ${q(e.scrollMode || 'pan2d')}`);
                L.push(`    content-w: ${Math.max(e.w, M().int(e.contentW, e.w))}`);
                L.push(`    content-h: ${Math.max(e.h, M().int(e.contentH, e.h))}`);
                L.push(`    step-px: ${M().clamp(M().int(e.stepPx, 28), 4, 200)}`);
                L.push(`    bg-color: ${q(e.bgColor || '#0e131f')}`);
                L.push(`    border-color: ${q(e.borderColor || '#3a8ee6')}`);
                L.push(`    show-scrollbar: ${e.showScrollbar !== false}`);
            }
            if (e.type === 'custom_model') {
                L.push(`    model-id: ${q(e.modelId || '')}`);
                L.push(`    animation: ${q(e.animation || 'idle')}`);
                L.push(`    scale-3d: ${M().num(e.scale3d, 1)}`);
                L.push(`    angle: ${M().num(e.angle, 20)}`);
                L.push(`    spin: ${!!e.spin}`);
                L.push(`    spin-speed: ${M().num(e.spinSpeed, 45)}`);
                L.push(`    hitbox-w: ${M().num(e.hitboxW, 1)}`);
                L.push(`    hitbox-h: ${M().num(e.hitboxH, 2)}`);
            }
            if (e.type === 'input') {
                L.push(`    var-name: ${q(e.varName || 'qty')}`);
                L.push(`    input-type: ${q(e.inputType || 'number')}`);
                L.push(`    default-value: ${q(e.defaultValue == null ? '1' : e.defaultValue)}`);
                L.push(`    min: ${M().num(e.min, 1)}`);
                L.push(`    max: ${M().num(e.max, 64)}`);
                L.push(`    step: ${M().num(e.step, 1)}`);
                L.push(`    prefix: ${q(e.prefix == null ? '' : e.prefix)}`);
                L.push(`    suffix: ${q(e.suffix == null ? '' : e.suffix)}`);
                L.push(`    prompt-title: ${q(e.promptTitle || 'Enter value')}`);
                L.push(`    placeholder: ${q(e.placeholder || 'Type value...')}`);
                L.push(`    text-color: ${q(e.textColor || '#ffffff')}`);
                L.push(`    bg-color: ${q(e.bgColor || '#161b26')}`);
                L.push(`    border-color: ${q(e.borderColor || '#52a0f0')}`);
                L.push(`    scale: ${M().num(e.scale, 1)}`);
                L.push(`    shadow: ${e.shadow !== false}`);
                L.push(`    align: ${q(e.align || 'center')}`);
                L.push(`    bedrock-slot: ${slots.get(e.id)}`);
                const acts = (e.actions || []).map(a => String(a).trim()).filter(Boolean);
                if (acts.length) { L.push('    actions:'); acts.forEach(a => L.push(`      - ${q(a)}`)); }
                else L.push('    actions: []');
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
1. Put KaizerUI-1.2.0.jar in plugins/ (from plugins/KaizerUI/target).
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
        // Pre-render and pack PNG icons for custom plugin items, 3D models, and cached vanilla textures
        const customIconEntries = new Map();
        const vanillaIconEntries = new Map();
        let hasDynamicItem = false;
        if (GS.Items) {
            if (GS.CustomAssets) await GS.CustomAssets.ensureLoaded();
            const collectCustom = async (cid) => {
                if (!cid || !GS.CustomAssets || !GS.CustomAssets.isCustomId(cid)) return;
                const canonical = GS.CustomAssets.findItem(cid);
                let iconUrl = GS.CustomAssets.iconUrl(cid);
                if (!iconUrl && canonical && canonical.hasModel && GS.BbModel) {
                    const mod = await GS.CustomAssets.getModel(canonical.id);
                    if (mod) {
                        iconUrl = await GS.BbModel.renderThumbnail(mod, 64);
                        if (iconUrl) canonical.iconDataUrl = iconUrl;
                    }
                }
                const bpath = GS.Items.customBedrockPath(cid);
                if (iconUrl && bpath && !customIconEntries.has(bpath)) {
                    customIconEntries.set(bpath, iconUrl);
                }
            };
            for (const m of p.menus) {
                for (const el of m.elements) {
                    if (el.hidden) continue;
                    if (isDynamicBedrockItem(el)) hasDynamicItem = true;
                    if (el.type === 'item' && !el.bedrockTexture) {
                        const vp = GS.Items.vanillaPackPath(el.item);
                        const vu = vp ? GS.Items.url(el.item) : null;
                        if (vp && vu && !vanillaIconEntries.has(vp)) vanillaIconEntries.set(vp, vu);
                    }
                    const cid = el.type === 'custom_model' ? el.modelId : (el.type === 'item' ? el.item : '');
                    if (!el.bedrockTexture) await collectCustom(cid);
                    if (el.type === 'roulette' && Array.isArray(el.rewards)) {
                        for (const rw of el.rewards) {
                            const rvp = GS.Items.vanillaPackPath(rw.item);
                            const rvu = rvp ? GS.Items.url(rw.item) : null;
                            if (rvp && rvu && !vanillaIconEntries.has(rvp)) vanillaIconEntries.set(rvp, rvu);
                            await collectCustom(rw.item);
                        }
                    }
                    // Also inspect parameterized open:... actions (e.g. open:confirm?item_id=ia:...)
                    for (const act of (el.actions || [])) {
                        const qm = /\?([^#\s]+)/.exec(String(act));
                        if (!qm) continue;
                        for (const pair of qm[1].split('&')) {
                            const eq = pair.indexOf('=');
                            if (eq > 0) await collectCustom(decodeURIComponent(pair.slice(eq + 1).trim()));
                        }
                    }
                }
            }
            if (hasDynamicItem && GS.CustomAssets) {
                for (const it of GS.CustomAssets.list({ kind: 'item' }).slice(0, 250)) {
                    await collectCustom(it.id);
                }
            }
        }
        for (const [bpath, dataUrl] of customIconEntries) {
            bedrockPack.push({ path: `${bpath}.png`, base64: await renderPng(dataUrl, 64, 64) });
        }
        for (const [vpath, dataUrl] of vanillaIconEntries) {
            bedrockPack.push({ path: `${vpath}.png`, base64: await renderPng(dataUrl, 32, 32) });
        }
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
