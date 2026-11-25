/* ========================================
   Java HUD pack importer (UI side)

   The Rust command `import_java_hud` reads a BetterHud / HappyHUD / MythicHUD
   pack (zip or folder) and returns plugin-neutral elements that are already
   in Bedrock anchor + offset form. This window lets the user pick the
   variant, the HUDs and the individual elements, previews them, and then
   creates editor elements (one group per HUD).
   ======================================== */
(function () {
    'use strict';

    const PREVIEW_SCALE = 1.5;
    const LAYER_BASE = 100;
    const VANILLA_BAR_PAPI = {
        hp: ['%player_health%', '%player_max_health%'],
        food: ['%player_food_level%', '20'],
        armor: ['', '20'], // PlaceholderAPI has no armor-points placeholder
        air: ['%player_remaining_air%', '%player_max_air%'],
        exp: ['%player_exp%', '100'],
        hp_absorption: ['%player_absorption%', '%player_max_health%'],
    };

    // Same defaults the Properties panel applies when the text alignment changes
    const TEXT_ALIGN = {
        left: { anchor: 'top_left', offsets: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] } },
        center: { anchor: 'center', offsets: { small: [0, 0.9], normal: [0, 1.4], large: [0, 2] } },
        right: { anchor: 'top_right', offsets: { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] } },
    };

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function invoke(cmd, args) {
        if (!window.__TAURI__ || !window.__TAURI__.core) {
            return Promise.reject(new Error('Importing needs the desktop app'));
        }
        return window.__TAURI__.core.invoke(cmd, args || {}).catch((err) => {
            throw new Error(typeof err === 'string' ? err : (err && err.message) || 'Unknown error');
        });
    }

    function toast(msg, type) {
        if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, type || 'info');
    }

    function anchorFrac(a) {
        if (a === 'center') return [0.5, 0.5];
        const [v, h] = a.split('_');
        const f = { left: 0, middle: 0.5, right: 1, top: 0, bottom: 1 };
        return [f[h], f[v]];
    }

    /* ───────────── state ───────────── */

    let pack = null;        // result from Rust
    let variant = null;     // selected variant
    const imageCache = new Map(); // image id → HTMLImageElement
    let selected = new Set();     // element keys "hudIndex|elementIndex"
    let back = null;

    function imgEl(id) {
        if (imageCache.has(id)) return imageCache.get(id);
        const meta = pack.images[id];
        const im = new Image();
        im.onload = () => drawPreview(lastHighlight);
        im.src = meta ? meta.data : '';
        imageCache.set(id, im);
        return im;
    }

    /* ───────────── window ───────────── */

    async function start(folder) {
        let result;
        try {
            result = await invoke('import_java_hud', { folder: !!folder });
        } catch (e) {
            alert(e.message);
            return;
        }
        if (!result) return;
        pack = result;
        imageCache.clear();
        openWindow();
    }

    function openWindow() {
        close();
        back = document.createElement('div');
        back.className = 'kz-modal';
        back.innerHTML = `
            <div class="kz-window kz-import">
                <div class="kz-window-head"><span>Import Java HUD — ${esc(pack.source)}</span>
                    <button class="icon-btn small" data-close title="Close"><svg><use href="#i-close"/></svg></button></div>
                <div class="kz-window-body">
                    <div class="kz-import-top">
                        <label class="kz-label">Version in this pack</label>
                        <select id="ji-variant">${pack.variants.map((v, i) => `<option value="${i}">${esc(v.name)}</option>`).join('')}</select>
                    </div>
                    <div class="kz-import-main">
                        <div class="kz-import-list" id="ji-list"></div>
                        <div class="kz-import-side">
                            <canvas id="ji-preview" width="${pack.screen[0] * PREVIEW_SCALE}" height="${pack.screen[1] * PREVIEW_SCALE}"></canvas>
                            <div class="kz-note">Preview on a ${pack.screen[0]}×${pack.screen[1]} GUI screen. White box = vanilla hotbar. Bars are shown full.</div>
                            <div class="kz-import-notes" id="ji-notes"></div>
                        </div>
                    </div>
                    <div class="kz-import-opts" id="ji-opts"></div>
                </div>
                <div class="kz-window-foot">
                    <span class="kz-note" id="ji-count" style="margin-right:auto"></span>
                    <button class="ghost-btn" data-close>Cancel</button>
                    <button class="primary-btn" id="ji-go">Import</button>
                </div>
            </div>`;
        document.body.appendChild(back);
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
        back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
        const sel = back.querySelector('#ji-variant');
        sel.addEventListener('change', () => selectVariant(+sel.value));
        back.querySelector('#ji-go').addEventListener('click', doImport);
        if (!pack.variants.length) {
            back.querySelector('.kz-import-top').style.display = 'none';
            back.querySelector('#ji-list').innerHTML = '<div class="kz-note">No HUD configuration found — only hotbar textures.</div>';
            variant = null;
            renderOpts();
            drawPreview();
            updateCount();
        } else {
            selectVariant(0);
        }
    }

    function close() {
        if (back) back.remove();
        back = null;
    }

    function selectVariant(i) {
        variant = pack.variants[i];
        selected = new Set();
        const anyDefault = variant.huds.some((h) => h.default);
        variant.huds.forEach((h, hi) => {
            if (h.default || !anyDefault) h.elements.forEach((_, ei) => selected.add(`${hi}|${ei}`));
        });
        renderList();
        renderOpts();
        drawPreview();
    }

    function kindIcon(k) {
        return { image: '🖼', bar: '▬', text: 'T', head: '☺' }[k] || '•';
    }

    function renderList() {
        const list = back.querySelector('#ji-list');
        list.innerHTML = variant.huds.map((h, hi) => {
            const all = h.elements.every((_, ei) => selected.has(`${hi}|${ei}`));
            const some = h.elements.some((_, ei) => selected.has(`${hi}|${ei}`));
            return `
            <details class="kz-import-hud" ${some ? 'open' : ''}>
                <summary>
                    <input type="checkbox" data-hud="${hi}" ${all ? 'checked' : ''} ${!all && some ? 'data-mixed="1"' : ''} />
                    <b>${esc(h.name)}</b>
                    <span class="kz-note">${h.elements.length} items${h.default ? ' · on by default' : ''}</span>
                </summary>
                ${h.elements.map((e, ei) => `
                    <label class="kz-import-el" title="${esc((e.notes || []).join('\n'))}">
                        <input type="checkbox" data-el="${hi}|${ei}" ${selected.has(`${hi}|${ei}`) ? 'checked' : ''} />
                        <span class="kz-import-kind">${kindIcon(e.kind)}</span>
                        <span class="kz-import-name">${esc(e.kind === 'text' ? e.text.papi : e.name)}</span>
                        ${e.bar ? `<span class="kz-import-tag">${esc(e.bar.type)}</span>` : ''}
                        ${e.anim ? `<span class="ji-anim" title="Animation: ${e.anim.frames.length} frames, ${e.anim.fps} fps">▶ ${e.anim.frames.length}</span>` : ''}
                        ${(e.notes || []).length ? '<span class="kz-import-warn">⚠</span>' : ''}
                    </label>`).join('')}
                ${(h.notes || []).length ? `<div class="kz-note kz-import-hudnote">${h.notes.map(esc).join('<br>')}</div>` : ''}
            </details>`;
        }).join('') || '<div class="kz-note">This version has no HUDs.</div>';

        list.querySelectorAll('input[data-mixed]').forEach((cb) => { cb.indeterminate = true; });
        list.querySelectorAll('input[data-hud]').forEach((cb) => {
            cb.addEventListener('click', (e) => e.stopPropagation());
            cb.addEventListener('change', () => {
                const hi = +cb.dataset.hud;
                variant.huds[hi].elements.forEach((_, ei) => {
                    if (cb.checked) selected.add(`${hi}|${ei}`);
                    else selected.delete(`${hi}|${ei}`);
                });
                renderList();
                drawPreview();
            });
        });
        list.querySelectorAll('input[data-el]').forEach((cb) => {
            cb.addEventListener('change', () => {
                if (cb.checked) selected.add(cb.dataset.el);
                else selected.delete(cb.dataset.el);
                const hi = cb.dataset.el.split('|')[0];
                const head = list.querySelector(`input[data-hud="${hi}"]`);
                const h = variant.huds[hi];
                const n = h.elements.filter((_, ei) => selected.has(`${hi}|${ei}`)).length;
                head.checked = n === h.elements.length;
                head.indeterminate = n > 0 && n < h.elements.length;
                drawPreview();
            });
            const row = cb.closest('label');
            row.addEventListener('mouseenter', () => drawPreview(cb.dataset.el));
            row.addEventListener('mouseleave', () => drawPreview());
        });
        renderNotes();
    }

    function renderNotes() {
        const box = back.querySelector('#ji-notes');
        const lines = [...(variant ? variant.warnings : [])];
        box.innerHTML = lines.length ? lines.map((l) => `<div>⚠ ${esc(l)}</div>`).join('') : '';
        updateCount();
    }

    function widgetsFor() {
        // prefer the resource pack that lives next to this variant
        const ws = pack.widgets || [];
        if (!variant || !ws.length) return ws;
        const top = (variant.root || '').split('/')[0];
        return [...ws].sort((a, b) => (b.path.startsWith(top + '/') ? 1 : 0) - (a.path.startsWith(top + '/') ? 1 : 0));
    }

    function renderOpts() {
        const box = back.querySelector('#ji-opts');
        const ws = widgetsFor();
        if (!ws.length) { box.innerHTML = ''; return; }
        box.innerHTML = `
            <label class="kz-import-opt"><input type="checkbox" id="ji-widgets" checked />
                Also import the hotbar texture
                <select id="ji-widgets-src">${ws.map((w, i) => `<option value="${i}">${esc(w.format === 'modern' ? 'hotbar.png (1.20.2+)' : 'widgets.png')} — ${esc(w.path)}</option>`).join('')}</select>
            </label>`;
        box._widgets = ws;
    }

    function updateCount() {
        const n = selected.size;
        const el = back && back.querySelector('#ji-count');
        if (el) el.textContent = `${n} item${n === 1 ? '' : 's'} selected`;
    }

    /* ───────────── preview ───────────── */

    // animated pictures keep playing in the preview
    let lastHighlight = null;
    setInterval(() => {
        if (back && variant && variant.huds.some((h) => h.elements.some((e) => e.anim))) drawPreview(lastHighlight);
    }, 100);

    function drawPreview(highlight) {
        if (!back) return;
        lastHighlight = highlight;
        const cv = back.querySelector('#ji-preview');
        const ctx = cv.getContext('2d');
        const S = PREVIEW_SCALE;
        const [W, H] = pack.screen;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#4a5a3f';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = 'rgba(255,255,255,.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect((W / 2 - 91) * S + 0.5, (H - 22) * S + 0.5, 182 * S, 22 * S);
        if (!variant) return;
        const items = [];
        variant.huds.forEach((h, hi) => h.elements.forEach((e, ei) => {
            const key = `${hi}|${ei}`;
            if (selected.has(key) || key === highlight) items.push({ e, key });
        }));
        items.sort((a, b) => (a.e.layer || 0) - (b.e.layer || 0));
        for (const { e, key } of items) {
            const [fx, fy] = anchorFrac(e.anchor);
            const [w, h] = e.size;
            const x = (W * fx + e.offset[0] - w * fx) * S;
            const y = (H * fy + e.offset[1] - h * fy) * S;
            ctx.globalAlpha = selected.has(key) ? 1 : 0.45;
            if (e.image != null) {
                const fr = e.anim && e.anim.frames.length
                    ? e.anim.frames[Math.floor((performance.now() / 1000) * (e.anim.fps || 10)) % e.anim.frames.length]
                    : e.image;
                const im = imgEl(fr);
                if (im.complete && im.naturalWidth) ctx.drawImage(im, x, y, w * S, h * S);
            } else if (e.kind === 'text') {
                // offset is the text's own anchor point (see text_point in javahud.rs)
                const px = (W * fx + e.offset[0]) * S;
                const py = (H * fy + e.offset[1]) * S;
                const al = e.text.align || 'left';
                ctx.fillStyle = e.text.color ? `rgb(${e.text.color.map((c) => Math.round(c * 255)).join(',')})` : '#fff';
                ctx.font = `${Math.max(8, Math.round(h * S * 0.9))}px monospace`;
                ctx.textAlign = al;
                ctx.textBaseline = al === 'center' ? 'middle' : 'top';
                ctx.fillText(e.text.papi, px, py);
                ctx.textAlign = 'left';
            } else if (e.kind === 'head') {
                ctx.fillStyle = '#c69c6d';
                ctx.fillRect(x, y, w * S, h * S);
                ctx.fillStyle = '#3b2a1a';
                ctx.fillRect(x, y, w * S, h * S * 0.3);
            }
            if (key === highlight) {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = '#3a8ee6';
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 1, y - 1, w * S + 2, h * S + 2);
            }
        }
        ctx.globalAlpha = 1;
        updateCount();
    }

    /* ───────────── create elements ───────────── */

    function safeName(s) {
        return String(s || 'img').toLowerCase().replace(/\.png$/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'img';
    }

    function uniqueGroup(name) {
        const base = String(name || 'Imported').replace(/[<>"']/g, '').slice(0, 40) || 'Imported';
        let n = base;
        let i = 2;
        while (App.groups.includes(n)) n = `${base} ${i++}`;
        return n;
    }

    async function doImport() {
        if (!selected.size && !(back.querySelector('#ji-widgets') || {}).checked) {
            toast('Nothing selected', 'error');
            return;
        }
        const goBtn = back.querySelector('#ji-go');
        goBtn.disabled = true;
        goBtn.textContent = 'Importing…';

        // image id → unique texture name, never clashing with existing images
        const usedNames = new Set(App.elements.filter((e) => e.imageName).map((e) => e.imageName));
        const texName = new Map();
        const nameFor = (id) => {
            if (texName.has(id)) return texName.get(id);
            const base = safeName(pack.images[id].name);
            let n = base;
            let i = 2;
            while (usedNames.has(n)) n = `${base}_${i++}`;
            usedNames.add(n);
            texName.set(id, n);
            return n;
        };
        const usedBarTypes = new Set(App.elements.filter((e) => e.type === 'bar' && e.barType !== 'custom').map((e) => e.barType));
        const ns = App.getNamespace();
        const added = [];
        const problems = [];
        let firstGroup = null;

        App.pushHistory();
        App.isRestoringHistory = true; // one undo step for the whole import
        try {
            for (let hi = 0; hi < (variant ? variant.huds.length : 0); hi++) {
                const hud = variant.huds[hi];
                const els = hud.elements.map((e, ei) => ({ e, ei })).filter(({ ei }) => selected.has(`${hi}|${ei}`));
                if (!els.length) continue;
                const group = uniqueGroup(hud.name);
                App.groups.push(group);
                App.currentGroup = group;
                if (!firstGroup) firstGroup = group;

                for (const { e } of els) {
                    try {
                        const el = await createElement(e, ns, nameFor, usedBarTypes, problems);
                        if (el) {
                            el.group = group;
                            added.push(el.id);
                        }
                    } catch (err) {
                        console.error('Import failed for', e, err);
                        problems.push(`${e.name}: ${err.message}`);
                    }
                }
            }

            const wcb = back.querySelector('#ji-widgets');
            if (wcb && wcb.checked) {
                const w = back.querySelector('#ji-opts')._widgets[+back.querySelector('#ji-widgets-src').value];
                try {
                    if (w.format === 'modern') await Widgets.importModern(pack.images[w.hotbar].data, pack.images[w.selection].data);
                    else await Widgets.importLegacy(pack.images[w.widgets].data);
                } catch (err) {
                    problems.push(`Hotbar texture: ${err.message}`);
                }
            }
        } finally {
            App.isRestoringHistory = false;
        }

        if (firstGroup) App.currentGroup = firstGroup;
        App.selectedIds = [];
        App.render();
        if (window.KZDoc) KZDoc.markDirty();
        close();
        const texts = App.elements.filter((e) => e.type === 'text').length;
        if (texts > 16) problems.push(`The project now has ${texts} scoreboard texts — only 16 (index 0–15) can be shown`);
        if (problems.length) {
            const msg = `Imported ${added.length} items.\n\nPlease check:\n• ${problems.join('\n• ')}`;
            alert(msg);
        } else {
            toast(`Imported ${added.length} items`, 'success');
        }
    }

    function common(e) {
        return {
            name: e.name,
            anchor_from: e.anchor,
            anchor_to: e.anchor,
            offset: [...e.offset],
            size: [...e.size],
            layer: LAYER_BASE + Math.round(e.layer || 0),
            ...(e.visibility ? {
                visibilityEnabled: true,
                visibilityPapi: e.visibility.papi,
                visibilityOperator: e.visibility.op,
                visibilityValue: e.visibility.value,
                // the pack's other conditions on this item (all must be true)
                visibilityExtra: (e.visibility_extra || []).map((c) => ({ papi: c.papi, op: c.op, value: c.value, invert: false })),
            } : {}),
        };
    }

    async function createElement(e, ns, nameFor, usedBarTypes, problems) {
        if (e.kind === 'image') {
            const name = nameFor(e.image);
            // BetterHud `sequence` → flip-book animation (animation.js); frames share frame 1's size
            let anim = {};
            if (e.anim && e.anim.frames.length > 1 && window.KzAnim) {
                const n = await KzAnim.normalizeFrames(e.anim.frames.map((id) => pack.images[id].data));
                anim = { imageData: n.frames[0], animFrames: n.frames, animFrameSize: [n.w, n.h], animFps: Math.max(1, Math.round(e.anim.fps || 10)) };
                if (n.w * n.frames.length > KzAnim.MAX_STRIP) {
                    problems.push(`"${e.name}": animation strip is ${n.w * n.frames.length}px wide — some phones only load ${KzAnim.MAX_STRIP}px`);
                }
                if (Math.abs(anim.animFps - (e.anim.fps || 10)) > 0.05) {
                    problems.push(`"${e.name}": animation speed ${e.anim.fps} fps rounded to ${anim.animFps} fps (Bedrock uses whole numbers)`);
                }
            }
            return App.addElement('image', {
                ...common(e),
                imageData: pack.images[e.image].data,
                imageName: name,
                texturePath: `textures/${ns}/${name}`,
                ...(e.tint ? { color: e.tint } : {}),
                ...anim,
            });
        }
        if (e.kind === 'bar') {
            const data = pack.images[e.image].data;
            const dir = e.bar.direction || 'left';
            const sliced = await sliceBarTexture(data, dir);
            let type = e.bar.type;
            let papi = e.bar.papi || '';
            let max = e.bar.max || '';
            if (type !== 'custom' && usedBarTypes.has(type)) {
                // the project already has this bar type: keep it as a custom bar
                [papi, max] = VANILLA_BAR_PAPI[type] || ['', ''];
                problems.push(`"${e.name}": a ${type.toUpperCase()} bar already exists, imported as a Custom bar (${papi})`);
                type = 'custom';
            }
            if (type !== 'custom') usedBarTypes.add(type);
            if (type === 'custom' && !String(max).trim()) {
                problems.push(`"${e.name}": custom bar needs a Max value before export`);
            }
            const tag = type === 'custom' ? App.generateUniqueBarTag() : '';
            const isVertical = dir === 'top' || dir === 'bottom';
            const [w, h] = e.size;
            const bar = App.addElement('bar', {
                ...common(e),
                barType: type,
                barCustomTag: tag,
                barCustomPapi: type === 'custom' ? papi : '',
                barCustomMax: type === 'custom' ? max : '',
                barTexturePath: getDefaultBarTexturePath(type, tag),
                sliceDirection: dir,
                imageData: data,
                slicedImages: sliced.slices,
                barMaxSize: [w, h],
                barMinSize: isVertical ? [w, Math.max(1, Math.round(h / 16))] : [Math.max(1, Math.round(w / 16)), h],
                previewStep: 16,
            });
            // addElement keeps only known fields; the direction drives the Properties select
            if (bar) bar.sliceDirection = dir;
            return bar;
        }
        if (e.kind === 'text') {
            const size = e.text.fontSize || 'small';
            const al = TEXT_ALIGN[e.text.align] || TEXT_ALIGN.left;
            // The pack's text point is the glyphs' top-left / centre / top-right. Bedrock draws a
            // label off that point (1×1 panel pivot, font ascent), so give it the text_offset that
            // lands the digits exactly there in game — the preview (KzTextModel) shows the same.
            const offsets = JSON.parse(JSON.stringify(al.offsets));
            if (window.KzTextModel) {
                const pivot = ANCHORS[e.anchor] || ANCHORS.top_left;
                for (const s of Object.keys(offsets)) {
                    offsets[s] = KzTextModel.exactTextOffset(e.text.align || 'left', s, pivot.x, pivot.y);
                }
            }
            const text = App.addElement('text', {
                ...common(e),
                text_anchor_from: al.anchor,
                text_anchor_to: al.anchor,
                text_offset: [...offsets[size]],
                text_offsets: offsets,
                font_size: size,
                color: e.text.color || [1, 1, 1],
                shadow: !!e.text.shadow,
            });
            if (text) text.papi_placeholder = e.text.papi;
            return text;
        }
        if (e.kind === 'head') {
            // Bedrock shows the head through a clipped 35×31 window onto a 75×205 paper doll
            // (the editor's default); scale all of it to the pack's head width.
            const c = common(e);
            const [w, h] = e.size;
            const k = w / 35;
            const h2 = Math.round(31 * k * 100) / 100;
            const fy = anchorFrac(e.anchor)[1];
            c.size = [w, h2];
            c.offset = [c.offset[0], Math.round((c.offset[1] + (h - h2) * (0.5 - fy)) * 100) / 100];
            return App.addElement('player_head', {
                ...c,
                doll_size: [Math.round(75 * k * 100) / 100, Math.round(205 * k * 100) / 100],
                doll_offset: [Math.round(1 * k * 100) / 100, Math.round(18 * k * 100) / 100],
            });
        }
        return null;
    }

    window.JavaHudImport = { start };
})();
