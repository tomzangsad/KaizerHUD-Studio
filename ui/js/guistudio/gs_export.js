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
        craftengine: {
            label: 'CraftEngine',
            dir: (ns) => `plugins/CraftEngine/resources/${ns}_gui/resourcepack/`,
            mcmeta: false,
            extraFiles: (ns, ver) => [{
                path: `plugins/CraftEngine/resources/${ns}_gui/pack.yml`,
                text: `author: KaizerHUD Studio\nversion: 1.0.${ver || 1}\ndescription: KaizerUI cursor GUI menus (${ns})\nnamespace: ${ns}_gui\nenable: true\n`
            }],
            apply: 'Run /ce reload all — CraftEngine rebuilds its pack with the menu pictures and sends it to players.'
        },
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

    function nearestBedrockColor(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
        if (!m) return 'f';
        const v = parseInt(m[1], 16);
        const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
        const codes = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];
        const pal = [
            [0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],[255,170,0],[170,170,170],
            [85,85,85],[85,85,255],[85,255,85],[85,255,255],[255,85,85],[255,85,255],[255,255,85],[255,255,255]
        ];
        let best = 'f', bestD = Infinity;
        for (let i = 0; i < pal.length; i++) {
            const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; best = codes[i]; }
        }
        return best;
    }

    /** Formats Bedrock JSON compactly: keeps small primitive arrays and flat objects on one line. */
    function formatBedrockJson(val, indent) {
        const sp = ' '.repeat(indent || 0);
        const childSp = ' '.repeat((indent || 0) + 2);
        const isPrim = (v) => v === null || v === undefined || typeof v !== 'object';
        if (isPrim(val)) return JSON.stringify(val === undefined ? null : val);
        if (Array.isArray(val)) {
            if (!val.length) return '[]';
            if (val.every(isPrim)) {
                const one = '[' + val.map(v => JSON.stringify(v === undefined ? null : v)).join(', ') + ']';
                if (one.length <= 110) return one;
            }
            return '[\n' + val.map(v => childSp + formatBedrockJson(v, (indent || 0) + 2)).join(',\n') + '\n' + sp + ']';
        }
        const entries = Object.entries(val).filter(([, v]) => v !== undefined);
        if (!entries.length) return '{}';
        if (entries.length <= 4 && entries.every(([, v]) => isPrim(v))) {
            const one = '{ ' + entries.map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + ' }';
            if (one.length <= 110) return one;
        }
        return '{\n' + entries.map(([k, v]) => childSp + JSON.stringify(k) + ': ' + formatBedrockJson(v, (indent || 0) + 2)).join(',\n') + '\n' + sp + '}';
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

    const COLLECTION_TEXT = { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_text', binding_condition: 'once' };
    const COLLECTION_LEN_VIS = { binding_name: '#form_button_length', binding_name_override: '#collection_length', binding_condition: 'always_when_visible' };
    const showIfSlot = (slot) => ({ binding_type: 'view', source_property_name: `(not ((#form_button_text - '${slotMarker(slot)}') = #form_button_text))`, target_property_name: '#visible', binding_condition: 'once' });
    const textOfSlot = (slot) => ({ binding_type: 'view', source_property_name: `(#form_button_text - '${slotMarker(slot)}')`, target_property_name: '#kz_text', binding_condition: 'once' });

    function sameAnimVal(a, b) {
        if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
        if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
            return a.every((v, i) => Math.abs(Number(v) - Number(b[i])) < 1e-6);
        }
        return false;
    }

    function ctrlEntry(key, def) {
        if (def && def._inherit) {
            const clean = Object.assign({}, def);
            const inh = clean._inherit;
            delete clean._inherit;
            return { [`${key}@${inh}`]: clean };
        }
        return { [key]: def };
    }

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

    function makeAnimChain(targetObj, targetNs, prefix, prop, segs) {
        if (!segs || !segs.length) return null;
        const clean = [];
        for (const s of segs) {
            if (!s || s.dur <= 0.005) continue;
            const prev = clean[clean.length - 1];
            if (prev && sameAnimVal(prev.from, prev.to) && sameAnimVal(s.from, s.to) && sameAnimVal(prev.from, s.from)) {
                prev.dur += s.dur;
            } else {
                clean.push({ from: s.from, to: s.to, dur: s.dur, ease: s.ease });
            }
        }
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
            if (i < clean.length - 1) def.next = `@${targetNs}.${name(i + 1)}`;
            targetObj[name(i)] = def;
        });
        return `@${targetNs}.${name(0)}`;
    }

    function rouletteStaticCard(rw, opts, commonNs) {
        const o = opts || {};
        const bgKey = commonNs ? `bg@${commonNs}.solid` : 'bg';
        const barKey = commonNs ? `bar@${commonNs}.solid` : 'bar';
        const solidBase = commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false };
        const controls = [
            {
                [bgKey]: Object.assign({}, solidBase, {
                    color: o.mystery ? [0.12, 0.16, 0.25] : [0.1, 0.12, 0.18],
                    alpha: o.alpha != null ? o.alpha : 0.92, layer: 1
                })
            },
            {
                [barKey]: {
                    ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', keep_ratio: false }),
                    anchor_from: 'top_left', anchor_to: 'top_left',
                    size: ['100%', 2],
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

    function bedrockElement(el, slot, layer, texOf, stripOf, commonNs) {
        const pos = { anchor_from: 'top_left', anchor_to: 'top_left', offset: [el.x, el.y], size: [el.w, el.h], layer };
        // animated picture: every frame stacked in one texture, played with a flip_book anim
        const strip = stripOf ? stripOf(el) : null;
        const pic = (tex) => strip ? { texture: strip.texture, uv_size: strip.uvSize, uv: strip.uv } : { texture: tex };
        const solidTag = (k) => commonNs ? `${k}@${commonNs}.solid` : k;
        const solidBase = commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false };
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
                            controls: rouletteStaticCard(rw, { mystery: style === 'flip', accent: style === 'flip' ? (el.borderColor || '#e5a43a') : rw.color }, commonNs)
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
                            [solidTag('sep_' + r)]: {
                                ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', keep_ratio: false }),
                                anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [Math.round(lx - gap * 0.5), 4], size: [1, Math.max(4, el.h - 8)],
                                color: [1, 1, 1], alpha: 0.14, layer: 2
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
                                controls: rouletteStaticCard(rw, null, commonNs)
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
                            controls: rouletteStaticCard(rw, null, commonNs)
                        }
                    });
                }
            }
            const rc = [
                { [solidTag('bg')]: Object.assign({}, solidBase, { color: hexToRgb(el.bgColor || '#0d111a'), alpha: 0.92, layer: 0 }) },
                ...cards
            ];
            if (showVertNeedle) {
                rc.push({ [solidTag('needle')]: { ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', keep_ratio: false }), anchor_from: 'top_middle', anchor_to: 'top_middle', size: [2, '100%'], color: needleCol, layer: 6 } });
            }
            if (showHorizNeedle) {
                rc.push({ [solidTag('needle')]: { ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background', keep_ratio: false }), anchor_from: 'left_middle', anchor_to: 'left_middle', size: ['100%', 2], color: needleCol, layer: 6 } });
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
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_name_override: '#texture', binding_condition: 'once' },
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture_file_system', binding_name_override: '#texture_file_system', binding_condition: 'once' },
                                { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_condition: 'once' },
                                { binding_type: 'view', source_property_name: "(not (#form_button_texture = ''))", target_property_name: '#visible', binding_condition: 'once' }
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
                    { [solidTag('bg')]: Object.assign({}, solidBase, { color: bgTint, alpha: 0.88 }) },
                    { [solidTag('border_t')]: { ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background' }), anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 1], color: brHex, alpha: brAlpha } },
                    { [solidTag('border_b')]: { ...(commonNs ? {} : { type: 'image', texture: 'textures/ui/white_background' }), anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 1], color: brHex, alpha: brAlpha } }
                ]
            });
            const btnBase = commonNs
                ? { _inherit: `${commonNs}.form_btn_base` }
                : {
                    type: 'button', default_control: 'default', hover_control: 'hover', pressed_control: 'pressed',
                    sound_name: 'random.click', sound_volume: 1.0,
                    button_mappings: [
                        { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                        { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
                    ]
                };
            return {
                ...btnBase, ...pos,
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
            if (slot != null) {
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
            return {
                type: 'label', ...pos,
                text: toBedrockStaticText(el.text || '', el.color),
                localize: false,
                color: hexToRgb(el.color),
                shadow: !!el.shadow,
                font_scale_factor: Math.max(0.25, M().num(el.scale, 1)),
                text_alignment: el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center'
            };
        }
        // button
        const img = el.image ? texOf(el.image) : null;
        const hov = el.hoverImage ? texOf(el.hoverImage) : img;
        const btnBase = commonNs
            ? { _inherit: `${commonNs}.form_btn_base` }
            : {
                type: 'button', default_control: 'default', hover_control: 'hover', pressed_control: 'pressed',
                sound_name: 'random.click', sound_volume: 1.0,
                button_mappings: [
                    { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                    { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
                ]
            };
        if (isToggleBtn(el)) {
            const offImg = el.offImage ? texOf(el.offImage) : img;
            const offHov = el.offHoverImage ? texOf(el.offHoverImage) : (el.offImage ? offImg : hov);
            const sp = 'kzs' + String(slot).padStart(2, '0');
            const onMark = sp + ':1|';
            const offMark = sp + ':0|';
            const visOn = { binding_type: 'view', source_property_name: `(not ((#form_button_text - '${onMark}') = #form_button_text))`, target_property_name: '#visible', binding_condition: 'once' };
            const visOff = { binding_type: 'view', source_property_name: `(not ((#form_button_text - '${offMark}') = #form_button_text))`, target_property_name: '#visible', binding_condition: 'once' };
            const toggleFace = (name, onTex, offTex, tintOn, tintOff) => ({
                [name]: {
                    type: 'panel', size: ['100%', '100%'],
                    controls: [
                        onTex
                            ? { on_pic: { type: 'image', texture: onTex, size: ['100%', '100%'], keep_ratio: false, ...(tintOn ? { color: tintOn } : {}), bindings: [COLLECTION_TEXT, visOn] } }
                            : { [solidTag(name + '_on')]: Object.assign({}, solidBase, { alpha: tintOn ? 0.18 : 0.0, bindings: [COLLECTION_TEXT, visOn] }) },
                        offTex
                            ? { off_pic: { type: 'image', texture: offTex, size: ['100%', '100%'], keep_ratio: false, ...(tintOff ? { color: tintOff } : {}), bindings: [COLLECTION_TEXT, visOff] } }
                            : { [solidTag(name + '_off')]: Object.assign({}, solidBase, { alpha: tintOff ? 0.18 : 0.0, bindings: [COLLECTION_TEXT, visOff] }) }
                    ]
                }
            });
            return {
                ...btnBase, ...pos,
                bindings: [
                    { binding_type: 'collection_details', binding_collection_name: 'form_buttons' },
                    COLLECTION_TEXT,
                    { binding_type: 'view', source_property_name: `(not ((#form_button_text - '${sp}:') = #form_button_text))`, target_property_name: '#visible', binding_condition: 'once' }
                ],
                controls: [
                    toggleFace('default', img, offImg, null, null),
                    toggleFace('hover', hov, offHov, el.hoverImage ? null : [0.82, 0.82, 0.82], el.offHoverImage ? null : [0.82, 0.82, 0.82]),
                    toggleFace('pressed', hov, offHov, [0.7, 0.7, 0.7], [0.7, 0.7, 0.7]),
                    {
                        label: {
                            type: 'label', layer: 2,
                            text: '#kz_text',
                            localize: false,
                            bindings: [
                                COLLECTION_TEXT,
                                { binding_type: 'view', source_property_name: `((#form_button_text - '${onMark}') - '${offMark}')`, target_property_name: '#kz_text', binding_condition: 'once' }
                            ],
                            color: hexToRgb(el.labelColor),
                            shadow: el.labelShadow !== false,
                            font_scale_factor: Math.max(0.25, M().num(el.labelScale, 1)),
                            text_alignment: 'center'
                        }
                    }
                ]
            };
        }
        const faceCtrl = (name, tex, tint) => tex
            ? { [name]: { type: 'image', ...(tex === img ? pic(tex) : { texture: tex }), size: ['100%', '100%'], keep_ratio: false, ...(tint ? { color: tint } : {}) } }
            : { [solidTag(name)]: Object.assign({}, solidBase, { alpha: tint ? 0.18 : 0.0 }) };
        return {
            ...btnBase, ...pos,
            bindings: [{ binding_type: 'collection_details', binding_collection_name: 'form_buttons' }, COLLECTION_TEXT, showIfSlot(slot)],
            controls: [
                faceCtrl('default', img, null),
                faceCtrl('hover', hov, el.hoverImage ? null : [0.82, 0.82, 0.82]),
                faceCtrl('pressed', hov, [0.7, 0.7, 0.7]),
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

    function isToggleBtn(e) {
        return !!e && e.type === 'button' && !!(String(e.toggleVar || '').trim() || String(e.togglePapi || '').trim());
    }

    function hasVisibility(e) {
        return !!e && Array.isArray(e.visibility) && e.visibility.some(c => c && String(c.papi || '').trim() && c.op !== 'always');
    }

    function showIfToggleSlot(slot) {
        const sp = 'kzs' + String(slot).padStart(2, '0') + ':';
        return { binding_type: 'view', source_property_name: `(not ((#form_button_text - '${sp}') = #form_button_text))`, target_property_name: '#visible', binding_condition: 'once' };
    }

    function isDynamicBedrockItem(e) {
        return !!e && e.type === 'item' && !String(e.bedrockTexture || '').trim() && GS.Items && GS.Items.isDynamic(e.item);
    }

    function isDynamicBedrockText(e) {
        return !!e && e.type === 'text' && /%|{[^}]+}/.test(String(e.text || ''));
    }

    function toBedrockStaticText(s, hexColor) {
        const out = String(s == null ? '' : s).replace(/&([0-9a-fk-orA-FK-OR])/g, '§$1');
        if (!out || out[0] === '§') return out;
        const first = out.trimStart()[0];
        if (first === '#' || first === '$') return '§' + nearestBedrockColor(hexColor) + out;
        return out;
    }

    /** Which elements become form buttons (slots) on Bedrock: buttons, dynamic texts, inputs, dynamic items, visibility-gated */
    function bedrockSlots(menu) {
        const els = menu.elements.filter(e => !e.hidden);
        const slots = new Map();
        let n = 0;
        els.filter(e => e.type === 'button').forEach(e => slots.set(e.id, n++));
        els.filter(e => isDynamicBedrockText(e)).forEach(e => slots.set(e.id, n++));
        els.filter(e => e.type === 'input').forEach(e => slots.set(e.id, n++));
        els.filter(e => isDynamicBedrockItem(e)).forEach(e => slots.set(e.id, n++));
        els.filter(e => !slots.has(e.id) && hasVisibility(e)).forEach(e => slots.set(e.id, n++));
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
    function bedrockMotion(prefix, box, steps, targetNs) {
        const Mo = GS.Motion;
        const tNs = targetNs || 'server_form';
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
                if (i < segs.length - 1) a.next = `@${tNs}.${name(i + 1)}`;
                else if (loopStart >= 0) a.next = `@${tNs}.${name(loopStart)}`;
                defs[name(i)] = a;
            });
            props[prop] = `@${tNs}.${name(0)}`;
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

    function buildCommonDoc(commonNs, flipBooks) {
        const gCol = [1.0, 0.82, 0.29];
        const doc = {
            namespace: commonNs,
            solid: { type: 'image', texture: 'textures/ui/white_background', size: ['100%', '100%'], keep_ratio: false },
            form_btn_base: {
                type: 'button',
                default_control: 'default', hover_control: 'hover', pressed_control: 'pressed',
                sound_name: 'random.click', sound_volume: 1.0,
                button_mappings: [
                    { from_button_id: 'button.menu_select', to_button_id: 'button.form_button_click', mapping_type: 'pressed' },
                    { from_button_id: 'button.menu_ok', to_button_id: 'button.form_button_click', mapping_type: 'focused' }
                ]
            },
            pan_tab_base: {
                type: 'toggle',
                radio_toggle_group: true,
                checked_control: 'checked', unchecked_control: 'unchecked',
                checked_hover_control: 'checked_hover', unchecked_hover_control: 'unchecked_hover',
                checked_locked_control: 'checked', checked_locked_hover_control: 'checked',
                unchecked_locked_control: 'unchecked', unchecked_locked_hover_control: 'unchecked',
                sound_name: 'random.click', sound_volume: 1.0,
                button_mappings: [
                    { from_button_id: 'button.menu_select', to_button_id: 'button.menu_select', mapping_type: 'pressed' },
                    { from_button_id: 'button.menu_ok', to_button_id: 'button.menu_select', mapping_type: 'focused' }
                ]
            },
            card_glow: {
                type: 'panel', size: ['100%', '100%'], propagate_alpha: true,
                controls: [
                    { [`gt@${commonNs}.solid`]: { anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 2], color: gCol } },
                    { [`gb@${commonNs}.solid`]: { anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 2], color: gCol } },
                    { [`gl@${commonNs}.solid`]: { anchor_from: 'top_left', anchor_to: 'top_left', size: [2, '100%'], color: gCol } },
                    { [`gr@${commonNs}.solid`]: { anchor_from: 'top_right', anchor_to: 'top_right', size: [2, '100%'], color: gCol } }
                ]
            },
            box_border: {
                type: 'panel', size: ['100%', '100%'], '$b_col|default': [0.9, 0.64, 0.23],
                controls: [
                    { [`b_t@${commonNs}.solid`]: { anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 1], color: '$b_col', alpha: 0.85 } },
                    { [`b_b@${commonNs}.solid`]: { anchor_from: 'bottom_left', anchor_to: 'bottom_left', size: ['100%', 1], color: '$b_col', alpha: 0.85 } },
                    { [`b_l@${commonNs}.solid`]: { anchor_from: 'top_left', anchor_to: 'top_left', size: [1, '100%'], color: '$b_col', alpha: 0.85 } },
                    { [`b_r@${commonNs}.solid`]: { anchor_from: 'top_right', anchor_to: 'top_right', size: [1, '100%'], color: '$b_col', alpha: 0.85 } }
                ]
            }
        };
        if (flipBooks && Object.keys(flipBooks).length) Object.assign(doc, flipBooks);
        return doc;
    }

    function bedrockUiFiles(p, texOf, stripOf, flipBooks) {
        const ns = p.namespace;
        const commonNs = `kz_${ns}_common`;
        const root = { namespace: 'server_form' };
        const uiDefs = [`ui/${ns}/common.json`];
        const files = [];
        const wrapperControls = [];

        // Every form that is not ours still uses the game's own layout
        const notOurs = `((#title_text - '${`kz:${ns}:`}') = #title_text)`;
        wrapperControls.push({
            [`${ns}_vanilla`]: {
                type: 'panel', size: ['100%', '100%'], visible: false,
                bindings: [
                    { binding_name: '#title_text', binding_condition: 'once' },
                    { binding_type: 'view', source_property_name: notOurs, target_property_name: '#visible', binding_condition: 'once' }
                ],
                controls: [{ 'long_form@server_form.long_form': {} }]
            }
        });

        p.menus.forEach(menu0 => {
            // pages bigger than the Bedrock size are drawn smaller on Bedrock only
            const kB = bedrockScale(menu0);
            const menu = kB < 1 ? scaledMenu(menu0, kB) : menu0;
            const slots = bedrockSlots(menu);
            const marker = bedrockMarker(ns, menu.id);
            const mNs = `kz_${ns}_m_${menu.id}`;
            const mDoc = { namespace: mNs };
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
                let def = bedrockElement(relEl, slots.get(e.id), i + 1, texOf, stripOf, commonNs);
                const needsVisBind = slots.has(e.id) && e.type !== 'button' && e.type !== 'input' && !(e.type === 'text' && isDynamicBedrockText(e)) && !(e.type === 'item' && isDynamicBedrockItem(e));
                const visBind = isToggleBtn(e) ? showIfToggleSlot(slots.get(e.id)) : showIfSlot(slots.get(e.id));
                const cl = clips.elements[e.id] || {};
                const steps = [];
                if (cl.intro) steps.push({ clip: cl.intro, start: 0 });
                if (cl.loop) steps.push({ clip: cl.loop, start: cl.loop.delay || 0 });
                const mo = steps.length ? bedrockMotion(`mo_${M().slug(e.id, 'el')}`, { x: relEl.x, y: relEl.y, w: relEl.w, h: relEl.h }, steps, mNs) : null;
                let c;
                if (mo && Object.keys(mo.props).length) {
                    Object.assign(mDoc, mo.defs);
                    // the anims move / fade a panel around the element; the element fills it
                    const inner = Object.assign({}, def, { offset: [0, 0], size: ['100%', '100%'], layer: 1 });
                    const wrap = {
                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                        offset: mo.props.offset || [relEl.x, relEl.y], size: mo.props.size || [relEl.w, relEl.h], layer: i + 1,
                        controls: [ctrlEntry(key, inner)]
                    };
                    if (mo.props.alpha) { wrap.propagate_alpha = true; wrap.alpha = mo.props.alpha; }
                    if (slots.has(e.id)) wrap.bindings = [COLLECTION_TEXT, visBind];
                    c = { [`mo_${key}`]: wrap };
                } else {
                    if (needsVisBind) {
                        if (!def.bindings) def = Object.assign({}, def, { bindings: [COLLECTION_TEXT, visBind] });
                        else {
                            def = {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: def.offset || [relEl.x, relEl.y], size: def.size || [relEl.w, relEl.h], layer: def.layer || (i + 1),
                                bindings: [COLLECTION_TEXT, visBind],
                                controls: [ctrlEntry('inner', Object.assign({}, def, { offset: [0, 0], size: ['100%', '100%'], layer: 1 }))]
                            };
                        }
                    }
                    c = ctrlEntry(key, def);
                }
                if (e.type === 'roulette') rouletteControlMap.set(e.id, { c, layer: i + 1, scEntry, relEl });
                if (scEntry) {
                    const meta = { c, relX: relEl.x, w: relEl.w };
                    (slots.has(e.id) ? scEntry.slotControls : scEntry.controls).push(meta);
                } else {
                    (slots.has(e.id) ? slotControls : controls).push(c);
                }
            });
            const shiftScrollCtrl = (entryObj, dx) => {
                const clone = JSON.parse(JSON.stringify(entryObj));
                if (!dx) return clone;
                const k = Object.keys(clone)[0];
                const node = clone[k];
                if (node && Array.isArray(node.offset)) {
                    node.offset = [Math.round(node.offset[0] - dx), node.offset[1]];
                    return clone;
                }
                const cleanK = k.split('@')[0];
                return {
                    [`sh_${cleanK}`]: {
                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                        offset: [-dx, 0], size: ['100%', '100%'], controls: [clone]
                    }
                };
            };
            // Emit scrollable / 2D map viewports; when contentW > w, add 0ms client-side horizontal sector toggles
            for (const [aid, entry] of scrollAreas.entries()) {
                const a = entry.area;
                const aslug = M().slug(aid, 's');
                const contentW = Math.max(a.w, M().int(a.contentW, a.w));
                const contentH = Math.max(a.h, M().int(a.contentH, a.h));
                const aLayer = shown.indexOf(a) + 1;
                const isWide = contentW > a.w + 4 && (a.scrollMode === 'pan2d' || a.scrollMode === 'horizontal' || a.scrollMode === 'both');

                if (!isWide) {
                    const slotDefName = `scslot_${aslug}`;
                    const contentDefName = `sc_${aslug}`;
                    mDoc[slotDefName] = {
                        type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                        controls: entry.slotControls.map(it => it.c)
                    };
                    const scKids = entry.controls.map(it => it.c);
                    scKids.push({
                        slots: {
                            type: 'stack_panel', orientation: 'vertical',
                            size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                            factory: { name: 'buttons', control_name: `${mNs}.${slotDefName}` },
                            collection_name: 'form_buttons',
                            bindings: [COLLECTION_LEN_VIS]
                        }
                    });
                    mDoc[contentDefName] = {
                        type: 'panel',
                        size: [contentW, contentH],
                        anchor_from: 'top_left', anchor_to: 'top_left',
                        controls: scKids
                    };
                    controls.push({
                        [`scroll_${aslug}`]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [a.x, a.y], size: [a.w, a.h], layer: aLayer, clips_children: true,
                            controls: [
                                { [`bg@${commonNs}.solid`]: { color: hexToRgb(a.bgColor || '#0e131f'), alpha: 0.85, layer: 0 } },
                                {
                                    [`sv@common.scrolling_panel`]: {
                                        size: ['100%', '100%'], layer: 1,
                                        '$scrolling_pane_size': ['100%', '100%'],
                                        '$scroll_size': a.showScrollbar !== false ? [4, '100%'] : [0, 0],
                                        '$show_background': false,
                                        '$scrolling_content': `${mNs}.${contentDefName}`
                                    }
                                }
                            ]
                        }
                    });
                } else {
                    const sectorCount = Math.min(4, Math.max(2, Math.ceil(contentW / Math.max(1, a.w))));
                    const maxShiftX = Math.max(0, contentW - a.w);
                    const barH = 16;
                    const viewH = Math.max(20, a.h - barH);
                    const scrollControls = [
                        { [`bg@${commonNs}.solid`]: { color: hexToRgb(a.bgColor || '#0e131f'), alpha: 0.85, layer: 0 } }
                    ];
                    const tabGap = 2;
                    const totalTabsW = Math.max(20, a.w - 4);
                    const tabW = Math.max(16, Math.floor((totalTabsW - (sectorCount - 1) * tabGap) / sectorCount));
                    const tabFace = (bgCol, alpha, txtCol, txt) => ({
                        type: 'panel', size: ['100%', '100%'],
                        controls: [
                            { [`tbg@${commonNs}.solid`]: { color: bgCol, alpha, layer: 0 } },
                            { tlbl: { type: 'label', text: txt, localize: false, color: txtCol, shadow: true, font_scale_factor: 0.85, text_alignment: 'center', layer: 1 } }
                        ]
                    });

                    for (let k = 0; k < sectorCount; k++) {
                        const dx = Math.round(maxShiftX * k / (sectorCount - 1));
                        const minX = dx - 8, maxX = dx + a.w + 8;
                        const sSlotDef = `scslot_${aslug}_s${k}`;
                        const sContentDef = `sc_${aslug}_s${k}`;
                        const visSlots = entry.slotControls.filter(it => (it.relX + it.w) >= minX && it.relX <= maxX).map(it => shiftScrollCtrl(it.c, dx));
                        const visCtrls = entry.controls.filter(it => (it.relX + it.w) >= minX && it.relX <= maxX).map(it => shiftScrollCtrl(it.c, dx));

                        mDoc[sSlotDef] = {
                            type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                            controls: visSlots
                        };
                        visCtrls.push({
                            slots: {
                                type: 'stack_panel', orientation: 'vertical',
                                size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                                factory: { name: 'buttons', control_name: `${mNs}.${sSlotDef}` },
                                collection_name: 'form_buttons',
                                bindings: [COLLECTION_LEN_VIS]
                            }
                        });
                        mDoc[sContentDef] = {
                            type: 'panel',
                            size: [a.w, Math.max(viewH, contentH)],
                            anchor_from: 'top_left', anchor_to: 'top_left',
                            controls: visCtrls
                        };

                        const tabName = `pan_tab_${k}`;
                        const tabText = k === 0 ? `< 1/${sectorCount}` : (k === sectorCount - 1 ? `${k + 1}/${sectorCount} >` : `${k + 1}/${sectorCount}`);
                        const tabX = Math.round(2 + k * (tabW + tabGap));
                        const viewCtrl = {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [0, 0], size: ['100%', viewH], layer: 1, clips_children: true,
                            bindings: [{ binding_type: 'view', source_control_name: tabName, source_property_name: '#toggle_state', target_property_name: '#visible' }],
                            controls: [{
                                [`sv_${k}@common.scrolling_panel`]: {
                                    size: ['100%', '100%'], layer: 1,
                                    '$scrolling_pane_size': ['100%', '100%'],
                                    '$scroll_size': a.showScrollbar !== false ? [4, '100%'] : [0, 0],
                                    '$show_background': false,
                                    '$scrolling_content': `${mNs}.${sContentDef}`
                                }
                            }]
                        };
                        if (k > 0) viewCtrl.visible = false;
                        scrollControls.push({ [`pan_view_${k}`]: viewCtrl });
                        scrollControls.push({
                            [`${tabName}@${commonNs}.pan_tab_base`]: {
                                anchor_from: 'bottom_left', anchor_to: 'bottom_left',
                                offset: [tabX, -1], size: [tabW, barH - 2], layer: 6,
                                toggle_name: `${ns}_pt_${menu.id}_${aslug}`,
                                toggle_group_forced_index: k,
                                toggle_group_default_selected: 0,
                                toggle_default_state: k === 0,
                                controls: [
                                    { checked: tabFace([0.22, 0.48, 0.78], 0.96, [1, 1, 1], tabText) },
                                    { unchecked: tabFace([0.12, 0.16, 0.24], 0.90, [0.72, 0.80, 0.90], tabText) },
                                    { checked_hover: tabFace([0.28, 0.56, 0.88], 1.0, [1, 1, 1], tabText) },
                                    { unchecked_hover: tabFace([0.18, 0.25, 0.36], 0.95, [0.95, 0.98, 1], tabText) }
                                ]
                            }
                        });
                    }

                    controls.push({
                        [`scroll_${aslug}`]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [a.x, a.y], size: [a.w, a.h], layer: aLayer, clips_children: true,
                            controls: scrollControls
                        }
                    });
                }
            }
            mDoc.slot = {
                type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                controls: slotControls
            };
            controls.push({
                slots: {
                    type: 'stack_panel', orientation: 'vertical',
                    size: ['100%', '100%'], anchor_from: 'top_left', anchor_to: 'top_left',
                    factory: { name: 'buttons', control_name: `${mNs}.slot` },
                    collection_name: 'form_buttons',
                    bindings: [COLLECTION_LEN_VIS]
                }
            });

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
                const animPrefix = `sp_${rslug}`;

                const makeWinSlotFactory = (iconW, iconH) => {
                    const winSlotDef = `winicon_${rslug}`;
                    mDoc[winSlotDef] = {
                        type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                        controls: [{
                            icon: {
                                type: 'image', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [-Math.round(iconW * 0.5), -Math.round(iconH * 0.5)],
                                size: [iconW, iconH], layer: 1, bilinear: false,
                                bindings: [
                                    COLLECTION_TEXT,
                                    showIfSlot(winSlotIdx),
                                    { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture', binding_name_override: '#texture', binding_condition: 'once' },
                                    { binding_type: 'collection', binding_collection_name: 'form_buttons', binding_name: '#form_button_texture_file_system', binding_name_override: '#texture_file_system', binding_condition: 'once' }
                                ]
                            }
                        }]
                    };
                    return {
                        type: 'stack_panel', orientation: 'vertical', size: [0, 0],
                        anchor_from: 'center', anchor_to: 'center', layer: 4,
                        factory: { name: 'buttons', control_name: `${mNs}.${winSlotDef}` },
                        collection_name: 'form_buttons',
                        bindings: [COLLECTION_LEN_VIS]
                    };
                };

                const brCol = hexToRgb(el.borderColor || '#e5a43a');
                const spinMarker = `kz:${ns}:spin:${menu.id}:${el.id}|`;
                const spinMissMarker = `kz:${ns}:spin:${menu.id}:${el.id}|MISS`;
                const showIfWinSpin = [
                    { binding_name: '#title_text', binding_condition: 'once' },
                    { binding_type: 'view', source_property_name: `((#title_text - '${spinMissMarker}') = #title_text)`, target_property_name: '#visible', binding_condition: 'once' }
                ];
                const showIfMissSpin = [
                    { binding_name: '#title_text', binding_condition: 'once' },
                    { binding_type: 'view', source_property_name: `(not ((#title_text - '${spinMissMarker}') = #title_text))`, target_property_name: '#visible', binding_condition: 'once' }
                ];
                const rareBait = rewards.reduce((a, b) => ((Number(b.weight) || 10) < (Number(a.weight) || 10) ? b : a), rewards[0]);
                const mismatchRw = rewards.find(x => String(x.item || '') !== String(rareBait.item || '')) || { name: 'MISS', item: 'minecraft:barrier', color: '#ef4444' };
                const vpControls = [
                    { [`bg@${commonNs}.solid`]: { color: hexToRgb(el.bgColor || '#0d111a'), alpha: 0.96, layer: 0 } },
                    { [`border@${commonNs}.box_border`]: { layer: 8, '$b_col': brCol } }
                ];

                if (style === 'slot_v') {
                    const availW = Math.max(20, el.w - 12 - (reels - 1) * gap);
                    const cardW = Math.max(12, Math.min(slotW, Math.floor(availW / reels)));
                    const cardH = Math.max(12, Math.min(slotW, Math.floor((el.h - 8) * 0.52)));
                    const stepV = cardH + gap;
                    const totalW = reels * cardW + (reels - 1) * gap;
                    const startColX = Math.round((el.w - totalW) * 0.5);
                    const CARD_COUNT = 16, WIN_IDX = 12;
                    const startY = Math.round((el.h - cardH) * 0.5 - 2 * stepV);
                    const endY = Math.round((el.h - cardH) * 0.5 - WIN_IDX * stepV);
                    const iconSz = Math.max(8, Math.round(Math.min(cardW, cardH) * 0.68));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);

                    for (let r = 0; r < reels; r++) {
                        const lx = Math.round(startColX + r * (cardW + gap));
                        if (r > 0) {
                            vpControls.push({
                                [`sep_${r}@${commonNs}.solid`]: {
                                    anchor_from: 'top_left', anchor_to: 'top_left',
                                    offset: [Math.round(lx - gap * 0.5), 4], size: [1, Math.max(4, el.h - 8)],
                                    color: [1, 1, 1], alpha: 0.14, layer: 3
                                }
                            });
                        }
                        const reelDur = r3(dur * (reels === 1 ? 1 : (0.38 + 0.62 * Math.pow(r / (reels - 1), 1.35))));
                        const animName = `${animPrefix}_reel_${r}`;
                        mDoc[animName] = {
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
                            if (idx === WIN_IDX) {
                                const missRw = (reels >= 2 && r < reels - 1) ? rareBait : mismatchRw;
                                const missAccent = (reels >= 2 && r < reels - 1) ? (rareBait.color || '#f59e0b') : '#ef4444';
                                rCards.push({
                                    ['sc_' + idx]: {
                                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                        offset: [0, cy], size: [cardW, cardH], layer: 2,
                                        controls: [
                                            {
                                                win_cell: {
                                                    type: 'panel', size: ['100%', '100%'], bindings: showIfWinSpin,
                                                    controls: rouletteStaticCard(rw, { accent: '#ffd24c', winnerSlotControl: winnerSlotFactory }, commonNs)
                                                }
                                            },
                                            {
                                                miss_cell: {
                                                    type: 'panel', size: ['100%', '100%'], visible: false, bindings: showIfMissSpin,
                                                    controls: rouletteStaticCard(missRw, { accent: missAccent }, commonNs)
                                                }
                                            }
                                        ]
                                    }
                                });
                            } else {
                                rCards.push({
                                    ['sc_' + idx]: {
                                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                        offset: [0, cy], size: [cardW, cardH], layer: 1,
                                        controls: rouletteStaticCard(idx === WIN_IDX - 1 ? rareBait : rw, null, commonNs)
                                    }
                                });
                            }
                        }
                        vpControls.push({
                            ['reel_col_' + r]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [lx, 0], size: [cardW, el.h], clips_children: true, layer: 1,
                                controls: [{
                                    track: {
                                        type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                        offset: `@${mNs}.${animName}`, size: [cardW, CARD_COUNT * stepV], layer: 1,
                                        controls: rCards
                                    }
                                }]
                            }
                        });
                    }
                    vpControls.push({ [`needle@${commonNs}.solid`]: { anchor_from: 'left_middle', anchor_to: 'left_middle', size: ['100%', 2], color: hexToRgb(el.pointerColor || '#ff4d4f'), layer: 7 } });
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
                            const iconAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_fi_${idx}_${st}`, 'alpha', aSegs);
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
                        const glowAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_fg_${idx}`, 'alpha', glowSegs);
                        const rwBase = rewards[idx % rewards.length];
                        vpControls.push({
                            ['fl_' + idx]: {
                                type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                                offset: [b.x, b.y], size: [b.size, b.size], layer: 2,
                                controls: [
                                    { [`bg@${commonNs}.solid`]: { color: [0.1, 0.12, 0.18], alpha: 0.9, layer: 1 } },
                                    { [`bar@${commonNs}.solid`]: { anchor_from: 'top_left', anchor_to: 'top_left', size: ['100%', 2], color: hexToRgb(idx === winSlot ? '#ffd24c' : (rwBase.color || '#3b82f6')), layer: 2 } },
                                    ...iconControls,
                                    { [`glow@${commonNs}.card_glow`]: { alpha: glowAlpha, layer: 6 } }
                                ]
                            }
                        });
                    });
                } else if (style === 'flip') {
                    const boxes = rouletteGridBoxes(el, cardCount, slotW, gap);
                    const winSlot = Math.floor(cardCount / 2);
                    const iconSz = Math.max(8, Math.round((boxes[winSlot] ? boxes[winSlot].size : slotW) * 0.72));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);
                    const tPhase1 = r3(dur * 0.52);
                    const tPhase2 = r3(dur * 0.78);
                    const tOtherMid = r3((tPhase1 + tPhase2) * 0.5);
                    const tWinMid = r3((tPhase2 + dur) * 0.5);
                    const HOPS = 10;
                    const hopTimes = [];
                    for (let k = 0; k <= HOPS; k++) hopTimes.push(r3(tPhase1 * (1 - Math.pow(1 - k / HOPS, 1 / 2.2))));
                    const hopStart = ((winSlot - HOPS) % cardCount + cardCount) % cardCount;
                    const activeAt = hopTimes.map((_, k) => k === HOPS ? winSlot : (hopStart + k) % cardCount);

                    boxes.forEach((b, idx) => {
                        const isWin = idx === winSlot;
                        const rw = rewards[idx % rewards.length];
                        const sz = b.size;
                        const winSz = Math.round(sz * 1.12);
                        const flipStart = isWin ? tPhase2 : tPhase1;
                        const flipMid = isWin ? tWinMid : tOtherMid;
                        const flipEnd = isWin ? dur : tPhase2;
                        const halfFlip = Math.max(0.05, r3(flipMid - flipStart));

                        const backSize = makeAnimChain(mDoc, mNs, `${animPrefix}_fbs_${idx}`, 'size', [
                            { from: [sz, sz], to: [sz, sz], dur: flipStart },
                            { from: [sz, sz], to: [2, sz], dur: halfFlip, ease: 'in_quad' }
                        ]);
                        const backAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_fba_${idx}`, 'alpha', [
                            { from: 1, to: 1, dur: flipMid },
                            { from: 1, to: 0, dur: 0.02 }
                        ]);
                        const frontSize = makeAnimChain(mDoc, mNs, `${animPrefix}_ffs_${idx}`, 'size', [
                            { from: [2, sz], to: [2, sz], dur: flipMid },
                            { from: [2, sz], to: isWin ? [winSz, winSz] : [sz, sz], dur: Math.max(0.05, r3(flipEnd - flipMid)), ease: 'out_back' }
                        ]);
                        const targetAlpha = isWin ? 1.0 : 0.45;
                        const frontAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_ffa_${idx}`, 'alpha', [
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
                        const glowAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_fbg_${idx}`, 'alpha', glowSegs);

                        const cellControls = [
                            {
                                back: {
                                    type: 'panel', anchor_from: 'center', anchor_to: 'center',
                                    size: backSize, propagate_alpha: true, alpha: backAlpha, clips_children: true, layer: 2,
                                    controls: [
                                        ...rouletteStaticCard(rw, { mystery: true, accent: el.borderColor || '#e5a43a' }, commonNs),
                                        { [`glow@${commonNs}.card_glow`]: { alpha: glowAlpha, layer: 5 } }
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
                                    }, commonNs)
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
                    const WIN_IDX = 15, CARD_COUNT = 20;
                    const startX = Math.round((el.w - slotW) * 0.5 - 2 * step);
                    const endX = Math.round((el.w - slotW) * 0.5 - WIN_IDX * step);
                    const iconSz = Math.max(8, Math.round(Math.min(slotW, cardH) * 0.68));
                    const winnerSlotFactory = makeWinSlotFactory(iconSz, iconSz);
                    const animName = `${animPrefix}_strip`;
                    mDoc[animName] = {
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
                                }, commonNs)
                            }
                        });
                    }
                    vpControls.push(
                        { track: { type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left', offset: `@${mNs}.${animName}`, size: [CARD_COUNT * step, el.h], layer: 1, controls: cards } },
                        { [`needle@${commonNs}.solid`]: { anchor_from: 'top_middle', anchor_to: 'top_middle', size: [2, '100%'], color: hexToRgb(el.pointerColor || '#ff4d4f'), layer: 6 } }
                    );
                }

                // Delayed winner badge: stays hidden during spin, fades in smoothly once the spin lands
                const claimAlpha = makeAnimChain(mDoc, mNs, `${animPrefix}_claim_a`, 'alpha', [
                    { from: 0, to: 0, dur: Math.max(0.2, dur) },
                    { from: 0, to: 1, dur: 0.25, ease: 'out_quad' }
                ]);
                const claimW = Math.min(Math.max(100, el.w), 140);
                const claimX = Math.max(2, Math.min(menu.width - claimW - 2, Math.round(el.x + (el.w - claimW) * 0.5)));
                const claimY = el.y + el.h + 24 <= menu.height
                    ? Math.round(el.y + el.h + 4)
                    : Math.max(2, el.y - 22);
                const claimBtnName = `spinclaim_${rslug}`;
                const claimFace = (name, winCol, missCol, alpha) => ({
                    [name]: {
                        type: 'panel', size: ['100%', '100%'],
                        controls: [
                            { [`w@${commonNs}.solid`]: { color: winCol, alpha, bindings: showIfWinSpin } },
                            { [`m@${commonNs}.solid`]: { color: missCol, alpha, visible: false, bindings: showIfMissSpin } }
                        ]
                    }
                });
                mDoc[claimBtnName] = {
                    type: 'panel', size: [0, 0], anchor_from: 'top_left', anchor_to: 'top_left',
                    controls: [{
                        [`claim_btn@${commonNs}.form_btn_base`]: {
                            anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [claimX, claimY], size: [claimW, 20], layer: 18,
                            propagate_alpha: true, alpha: claimAlpha,
                            bindings: [{ binding_type: 'collection_details', binding_collection_name: 'form_buttons' }, COLLECTION_TEXT, showIfSlot(winSlotIdx)],
                            controls: [
                                claimFace('default', [0.16, 0.44, 0.28], [0.52, 0.14, 0.16], 0.94),
                                claimFace('hover', [0.22, 0.56, 0.36], [0.66, 0.20, 0.22], 0.98),
                                claimFace('pressed', [0.12, 0.34, 0.22], [0.40, 0.10, 0.12], 0.98),
                                { label: { type: 'label', layer: 2, text: '#kz_text', localize: false, bindings: [COLLECTION_TEXT, textOfSlot(winSlotIdx)], color: [1, 1, 1], shadow: true, text_alignment: 'center' } }
                            ]
                        }
                    }]
                };

                const idleEntry = rouletteControlMap.get(el.id);
                if (idleEntry && idleEntry.c) {
                    const ik = Object.keys(idleEntry.c)[0];
                    if (ik && idleEntry.c[ik]) {
                        idleEntry.c[ik].bindings = [
                            { binding_name: '#title_text', binding_condition: 'once' },
                            { binding_type: 'view', source_property_name: `((#title_text - '${spinMarker}') = #title_text)`, target_property_name: '#visible', binding_condition: 'once' }
                        ];
                    }
                }
                const spinVisBindings = [
                    { binding_name: '#title_text', binding_condition: 'once' },
                    { binding_type: 'view', source_property_name: `(not ((#title_text - '${spinMarker}') = #title_text))`, target_property_name: '#visible', binding_condition: 'once' }
                ];
                controls.push(
                    {
                        [`spin_vp_${rslug}`]: {
                            type: 'panel', anchor_from: 'top_left', anchor_to: 'top_left',
                            offset: [el.x, el.y], size: [el.w, el.h], clips_children: true,
                            visible: false,
                            layer: (idleEntry ? idleEntry.layer : 4) + 1,
                            bindings: spinVisBindings,
                            controls: vpControls
                        }
                    },
                    {
                        [`claim_slots_${rslug}`]: {
                            type: 'stack_panel', orientation: 'vertical', size: ['100%', '100%'],
                            anchor_from: 'top_left', anchor_to: 'top_left', visible: false, layer: 20,
                            bindings: spinVisBindings.concat([COLLECTION_LEN_VIS]),
                            factory: { name: 'buttons', control_name: `${mNs}.${claimBtnName}` },
                            collection_name: 'form_buttons'
                        }
                    }
                );
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
                const mo = bedrockMotion('open', { x: 0, y: 0, w: menu.width, h: menu.height }, [{ clip: c2, start: 0 }], mNs);
                Object.assign(mDoc, mo.defs);
                if (mo.props.offset) menuPanel.offset = mo.props.offset;
                if (mo.props.alpha) { menuPanel.propagate_alpha = true; menuPanel.alpha = mo.props.alpha; }
                if (menu.fullscreen && menu.bedrockBackdrop) {
                    // the backdrop fades in with the menu
                    const ba = M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1);
                    const bm = bedrockMotion('open_bd', { x: 0, y: 0, w: 1, h: 1 }, [{ clip: { length: c2.length, delay: 0, loop: false, tracks: { alpha: c2.tracks.alpha.map(k => [k[0], k[1] * ba, k[2]]) } }, start: 0 }], mNs);
                    Object.assign(mDoc, bm.defs);
                    openAlpha = bm.props.alpha || null;
                }
            }
            mDoc.menu = menuPanel;
            const hasRoulettes = shown.some(x => x.type === 'roulette');
            const spinPrefix = `kz:${ns}:spin:${menu.id}:`;
            const showMenuExpr = hasRoulettes
                ? `((not ((#title_text - '${marker}') = #title_text)) or (not ((#title_text - '${spinPrefix}') = #title_text)))`
                : `(not ((#title_text - '${marker}') = #title_text))`;
            mDoc.screen = {
                type: 'panel', size: ['100%', '100%'], visible: false,
                bindings: [
                    { binding_name: '#title_text', binding_condition: 'once' },
                    { binding_type: 'view', source_property_name: showMenuExpr, target_property_name: '#visible', binding_condition: 'once' }
                ],
                controls: [
                    ...(menu.fullscreen && menu.bedrockBackdrop ? [{
                        [`backdrop@${commonNs}.solid`]: {
                            size: ['400%', '400%'], layer: 0,
                            anchor_from: 'center', anchor_to: 'center',
                            color: hexToRgb(menu.backdrop || '#000000'), alpha: openAlpha || M().clamp(M().num(menu.backdropAlpha, 0.6), 0, 1)
                        }
                    }] : []),
                    { [`menu@${mNs}.menu`]: { layer: 1 } }
                ]
            };

            const menuPath = `ui/${ns}/menus/${menu.id}.json`;
            uiDefs.push(menuPath);
            files.push({ path: menuPath, text: formatBedrockJson(mDoc) + '\n' });
            wrapperControls.push({ [`${ns}_show_${menu.id}@${mNs}.screen`]: {} });
        });

        const commonDoc = buildCommonDoc(commonNs, flipBooks || {});
        files.unshift({ path: `ui/${ns}/common.json`, text: formatBedrockJson(commonDoc) + '\n' });

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
        return {
            defsJson: JSON.stringify({ ui_defs: uiDefs }, null, 2) + '\n',
            serverFormJson: JSON.stringify(root, null, 2) + '\n',
            files
        };
    }

    function serverFormJson(p, texOf, stripOf) {
        return bedrockUiFiles(p, texOf, stripOf, {}).serverFormJson;
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
            const pictureYaml = (imageId, key, tilesKey) => {
                const ts = tilesOf(imageId, M().int(e.w, 1), M().int(e.h, 1), e.detail || 1);
                if (ts.length === 1) {
                    L.push(`    ${key}: ${glyphEsc(ts[0].cp)}`);
                    L.push(`    ${key}-ascent: ${ts[0].ascent}`);
                } else {
                    // bigger than 256 px: drawn as several glyphs side by side
                    const tk = tilesKey || (key === 'glyph' ? 'tiles' : 'hover-tiles');
                    L.push(`    ${tk}:`);
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
                if (e.hoverImage && p.images[e.hoverImage]) pictureYaml(e.hoverImage, 'hover-glyph', 'hover-tiles');
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
                if (isToggleBtn(e)) {
                    if (e.toggleVar) L.push(`    toggle-var: ${q(e.toggleVar)}`);
                    if (e.togglePapi) L.push(`    toggle-papi: ${q(e.togglePapi)}`);
                    if (e.toggleOnValue) L.push(`    toggle-on-value: ${q(e.toggleOnValue)}`);
                    L.push(`    toggle-default: ${e.toggleDefault !== false}`);
                    if (e.offImage && p.images[e.offImage]) pictureYaml(e.offImage, 'off-glyph', 'off-tiles');
                    if (e.offHoverImage && p.images[e.offHoverImage]) pictureYaml(e.offHoverImage, 'off-hover-glyph', 'off-hover-tiles');
                    const onActs = (e.onActions || []).map(a => String(a).trim()).filter(Boolean);
                    if (onActs.length) { L.push('    on-actions:'); onActs.forEach(a => L.push(`      - ${q(a)}`)); }
                    else L.push('    on-actions: []');
                    const offActs = (e.offActions || []).map(a => String(a).trim()).filter(Boolean);
                    if (offActs.length) { L.push('    off-actions:'); offActs.forEach(a => L.push(`      - ${q(a)}`)); }
                    else L.push('    off-actions: []');
                }
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
                const defWc = (e.spinStyle === 'slot_v' && M().int(e.reels, 3) >= 2) ? 65 : 100;
                L.push(`    win-chance: ${M().clamp(M().num(e.winChance != null ? e.winChance : defWc, defWc), 1, 100)}`);
                L.push(`    bg-color: ${q(e.bgColor || '#0d111a')}`);
                L.push(`    border-color: ${q(e.borderColor || '#e5a43a')}`);
                L.push(`    pointer-color: ${q(e.pointerColor || '#ff4d4f')}`);
                L.push(`    tick-sound: ${q(e.tickSound || '')}`);
                L.push(`    win-sound: ${q(e.winSound || '')}`);
                L.push(`    lose-sound: ${q(e.loseSound || 'minecraft:entity.villager.no;1.0;0.82')}`);
                L.push(`    lose-message: ${q(e.loseMessage != null ? e.loseMessage : '&c&lMISS! &7No match this time — try again!')}`);
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
                if (slots.has(e.id)) L.push(`    bedrock-slot: ${slots.get(e.id)}`);
            }
            if (slots.has(e.id) && !['button', 'input', 'item', 'text'].includes(e.type)) {
                L.push(`    bedrock-slot: ${slots.get(e.id)}`);
            }
            if (hasVisibility(e)) {
                L.push(`    visibility: ${flow(e.visibility.filter(c => c && String(c.papi || '').trim() && c.op !== 'always'))}`);
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
        const commonNs = `kz_${ns}_common`;
        const texDir = `${ns}_gui`;
        const usedTex = new Set();
        const texOf = (imageId) => { usedTex.add(imageId); return `textures/${texDir}/${imageId}`; };
        const strips = new Map();
        const flipBooks = {};
        const stripOf = (el) => {
            const ids = [el.image].concat(el.frames || []).filter(id => id && p.images[id]);
            if (!el.image || !p.images[el.image] || ids.length < 2) return null;
            const first = p.images[el.image];
            const key = M().slug(`${el.id}_frames`, 'frames');
            if (!strips.has(key)) strips.set(key, { ids, w: first.w, h: first.h });
            const anim = `fb_${key}`;
            flipBooks[anim] = { anim_type: 'flip_book', initial_uv: [0, 0], frame_count: ids.length, frame_step: first.h, fps: M().clamp(M().num(el.fps, 8), 1, 30), looping: true, easing: 'linear' };
            return { texture: `textures/${texDir}/${key}`, uvSize: [first.w, first.h], uv: `@${commonNs}.${anim}` };
        };
        const uiOut = bedrockUiFiles(p, texOf, stripOf, flipBooks);
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
        bedrockPack.push({ path: 'ui/_ui_defs.json', text: uiOut.defsJson });
        bedrockPack.push({ path: 'ui/server_form.json', text: uiOut.serverFormJson });
        for (const uf of uiOut.files) bedrockPack.push({ path: uf.path, text: uf.text });
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
            if (host.extraFiles) {
                host.extraFiles(ns, p.packVersion).forEach(f => root.push(f));
            }
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

    GS.Export = { PACK_HOSTS, bedrockScale, BEDROCK_MAX_W, BEDROCK_MAX_H, build, bedrockMarker, slotMarker, bedrockSlots, hexToRgb, defaultCursorPng, menuYaml, bedrockUiFiles, serverFormJson, bedrockMotion };
})();
