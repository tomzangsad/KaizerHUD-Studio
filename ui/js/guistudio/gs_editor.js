/* ========================================
   GUI Studio — editor (canvas, selection, properties, layers, menu pages)
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const M = GS.Model;
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* Minecraft & colour codes → HTML for the canvas preview */
    const MC_COLORS = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
    function mcToHtml(text, baseColor) {
        let out = '', color = baseColor, bold = false, italic = false, under = false, strike = false;
        const s = String(text || '');
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if ((ch === '&' || ch === '§') && i + 1 < s.length) {
                const c = s[i + 1].toLowerCase();
                if (c === '#' && /^[0-9a-f]{6}$/i.test(s.substr(i + 2, 6))) { color = '#' + s.substr(i + 2, 6); i += 7; continue; }
                if (MC_COLORS[c]) { color = MC_COLORS[c]; bold = italic = under = strike = false; i++; continue; }
                if (c === 'l') { bold = true; i++; continue; }
                if (c === 'o') { italic = true; i++; continue; }
                if (c === 'n') { under = true; i++; continue; }
                if (c === 'm') { strike = true; i++; continue; }
                if (c === 'r') { color = baseColor; bold = italic = under = strike = false; i++; continue; }
                if (c === 'k') { i++; continue; }
            }
            const deco = [under && 'underline', strike && 'line-through'].filter(Boolean).join(' ');
            out += `<span style="color:${color};${bold ? 'font-weight:bold;' : ''}${italic ? 'font-style:italic;' : ''}${deco ? 'text-decoration:' + deco + ';' : ''}">${esc(ch)}</span>`;
        }
        return out;
    }
    /* Placeholders shown with example values on the canvas */
    /** "minecraft:diamond_sword" → "Diamond Sword" */
    function itemName(id) {
        const s = String(id || '');
        const slot = GS.Items && GS.Items.SLOTS.find(x => x[0] === s.toLowerCase());
        if (slot) return slot[1];
        return s.replace(/^.*:/, '').split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Item';
    }

    function samplePapi(t) {
        return String(t || '').replace(/%player_name%/g, 'Steve').replace(/%vault_eco_balance(_formatted)?%/g, '1,250')
            .replace(/%player_level%/g, '12').replace(/%player_health%/g, '20').replace(/%server_online%/g, '42')
            .replace(/%player_health_rounded%/g, '20').replace(/%player_food_level%/g, '18').replace(/%statistic_player_kills%/g, '37').replace(/%statistic_deaths%/g, '5')
            .replace(/%vault_rank%/g, 'VIP').replace(/%player_ping%/g, '32').replace(/%statistic_hours_played%/g, '48').replace(/%bungee_[a-z]+%/g, '24')
            // leaderboards (ajLeaderboards): sample names / values so the layout reads like in game
            .replace(/%ajlb_lb_[a-z_]+?_(\d+)_[a-z]+_name%/g, (m, n) => ['Notch', 'Alex', 'Kaizer', 'Mochi', 'Boba', 'Taro', 'Kiwi'][(n - 1) % 7])
            .replace(/%ajlb_lb_[a-z_]+?_(\d+)_[a-z]+_value%/g, (m, n) => String(Math.max(40, 980 - n * 115))).replace(/%ajlb_position_[a-z_]+%/g, '24');
    }

    /**
     * GIF → frames with the browser's ImageDecoder (WebView2 / Chromium): every frame comes out
     * whole (disposal applied). Returns null when the decoder is not available.
     */
    async function decodeGif(file) {
        if (typeof window.ImageDecoder !== 'function') {
            GS.toast('This WebView cannot split GIFs — export the frames as PNG files and add those instead', 'error');
            return null;
        }
        const dec = new window.ImageDecoder({ data: await file.arrayBuffer(), type: 'image/gif' });
        await dec.tracks.ready;
        const n = Math.min(64, dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1);
        const frames = [];
        let total = 0;
        const base = file.name.replace(/\.gif$/i, '');
        for (let i = 0; i < n; i++) {
            const { image } = await dec.decode({ frameIndex: i });
            const c = document.createElement('canvas');
            c.width = image.displayWidth; c.height = image.displayHeight;
            c.getContext('2d').drawImage(image, 0, 0);
            total += image.duration || 100000;
            frames.push({ name: `${base}_${i + 1}.png`, data: c.toDataURL('image/png'), w: c.width, h: c.height });
            image.close();
        }
        dec.close();
        const avgMs = total / Math.max(1, n) / 1000;
        return { frames, fps: Math.max(1, Math.min(20, Math.round(1000 / Math.max(50, avgMs)))) };
    }

    const Editor = {
        project: null,
        history: new M.History(120),
        menuIndex: 0,
        selected: null,          // element id
        zoom: 2,
        snap: false,
        previewMode: false,
        platform: 'java',
        clipboard: null,
        onChange: null,          // set by shell: marks the document dirty

        init(project) {
            this.project = M.normalize(project || M.newProject());
            this.history.clear();
            this.menuIndex = 0;
            this.selected = null;
            this.bindCanvas();
            this.renderAll();
            requestAnimationFrame(() => this.zoomFit());
        },

        load(project) {
            this.project = M.normalize(project);
            this.history.clear();
            this.menuIndex = 0;
            this.selected = null;
            this.renderAll();
            this.zoomFit();
        },

        menu() { return this.project.menus[Math.min(this.menuIndex, this.project.menus.length - 1)]; },
        element(id) { return this.menu().elements.find(e => e.id === (id || this.selected)) || null; },

        /* ───────────── selection (one or many, like the HUD editor) ─────────────
           `selected` = the main element (its properties are shown); `multi` = every selected id.
           Code that sets `selected` alone (to an id outside `multi`) makes it a single selection again. */
        selIds() {
            if (!this.selected) return [];
            const ids = this.menu().elements.map(e => e.id);
            if (this.multi && this.multi.length > 1 && this.multi.includes(this.selected)) return this.multi.filter(id => ids.includes(id));
            return ids.includes(this.selected) ? [this.selected] : [];
        },
        /** selected elements, bottom layer first */
        selElements() { const ids = this.selIds(); return this.menu().elements.filter(e => ids.includes(e.id)); },
        isSel(id) { return this.selIds().includes(id); },
        isMulti() { return this.selIds().length > 1; },
        setSel(ids, primary) {
            ids = [...new Set(ids)];
            this.multi = ids;
            this.selected = ids.length ? (primary && ids.includes(primary) ? primary : ids[ids.length - 1]) : null;
            this.propsMode = null;
        },
        toggleSel(id) {
            const ids = this.selIds();
            if (ids.includes(id)) this.setSel(ids.filter(x => x !== id), this.selected === id ? null : this.selected);
            else this.setSel(ids.concat(id), id);
        },
        selectAll() {
            this.setSel(this.menu().elements.filter(e => !e.hidden).map(e => e.id));
            this.renderAll();
        },
        /** bounding box of the selection */
        selBounds() {
            const els = this.selElements();
            if (!els.length) return null;
            const x = Math.min(...els.map(e => e.x)), y = Math.min(...els.map(e => e.y));
            const r = Math.max(...els.map(e => e.x + e.w)), b = Math.max(...els.map(e => e.y + e.h));
            return { x, y, w: r - x, h: b - y };
        },

        /** call BEFORE changing the project */
        checkpoint() { this.history.push(this.project); },
        changed() {
            if (this.onChange) this.onChange();
            this.renderAll();
        },

        undo() { if (this.history.undo(this.project)) { this.fixSelection(); this.changed(); } },
        redo() { if (this.history.redo(this.project)) { this.fixSelection(); this.changed(); } },
        fixSelection() {
            if (this.menuIndex >= this.project.menus.length) this.menuIndex = this.project.menus.length - 1;
            if (this.selected && !this.element()) this.selected = null;
            if (this.multi) this.multi = this.multi.filter(id => this.element(id));
        },

        /* ───────────── rendering ───────────── */

        renderAll() {
            this.renderPages();
            this.renderCanvas();
            this.renderLayers();
            this.renderProps();
            this.renderStatus();
            const ns = $('#gs-namespace');
            if (ns && document.activeElement !== ns) ns.value = this.project.namespace;
        },

        imageUrl(id) {
            const im = id && this.project.images[id];
            return im ? im.data : null;
        },

        renderCanvas() {
            const m = this.menu();
            const screen = $('#gs-screen');
            screen.style.width = m.width + 'px';
            screen.style.height = m.height + 'px';
            screen.classList.toggle('preview', this.previewMode);
            screen.classList.toggle('bedrock', this.platform === 'bedrock');
            screen.classList.toggle('fullscreen', !!m.fullscreen);
            if (m.fullscreen) {
                const a = M.clamp(M.num(m.backdropAlpha, 0.6), 0, 1);
                const [r, g, b] = (m.backdrop || '#000000').replace('#', '').match(/../g).map(x => parseInt(x, 16));
                screen.style.setProperty('--backdrop', `rgba(${r},${g},${b},${a})`);
            }
            const wrap = $('#gs-elements');
            wrap.innerHTML = '';
            const selIds = this.selIds();
            m.elements.forEach((e, i) => {
                if (e.hidden) return;
                const d = document.createElement('div');
                d.className = `gs-el gs-${e.type}` + (selIds.includes(e.id) && !this.previewMode ? ' selected' : '');
                // layer order stays as in the Layers list even when selected (the frame is drawn on top separately)
                d.dataset.id = e.id;
                Object.assign(d.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px', zIndex: i + 1 });
                if (e.type === 'image' || e.type === 'button') {
                    if ((e.detail || 1) > 1) d.classList.add('smooth');
                    const url = this.liveArt(e) || this.imageUrl(e.image);
                    if (url) d.style.backgroundImage = `url("${url}")`;
                    else d.classList.add('no-image');
                    const hov = this.imageUrl(e.hoverImage);
                    if (hov) d.style.setProperty('--hover', `url("${hov}")`);
                    else d.classList.add('no-hover');
                }
                if (e.type === 'button') {
                    const lab = document.createElement('span');
                    lab.className = 'gs-label' + (e.labelShadow !== false ? ' shadow' : '');
                    lab.style.fontSize = (8 * M.num(e.labelScale, 1)) + 'px';
                    lab.innerHTML = mcToHtml(samplePapi(e.label), e.labelColor || '#ffffff');
                    d.appendChild(lab);
                }
                if (e.type === 'item') {
                    const url = GS.Items && GS.Items.url(e.item);
                    if (url) d.style.backgroundImage = `url("${url}")`;
                    else {
                        d.classList.add('no-item');
                        const t = document.createElement('span');
                        t.className = 'gs-item-id';
                        t.textContent = GS.Items && GS.Items.isSlot(e.item) ? (GS.Items.SLOTS.find(x => x[0] === String(e.item).trim().toLowerCase()) || [0, e.item])[1] : String(e.item || 'no item').replace(/^minecraft:/, '');
                        d.appendChild(t);
                    }
                    if (e.glint) d.classList.add('glint');
                    d.title = `${e.item}${e.look === '3d' ? ' · 3D' : ''}${e.spin ? ' · spinning' : ''}`;
                }
                if (M.isPlayer(e)) {
                    // stand-in picture like the HUD's Player Head; Java draws the real skin,
                    // Bedrock the paper doll of the player looking at the menu (anyone else = Steve)
                    d.title = M.showsViewer(e) ? 'The player who opens the menu' : `${e.player} — Java: their skin · Bedrock: Steve`;
                    // the game's own default skin, once Minecraft assets are downloaded
                    if (e.type === 'player_model' && GS.Items && GS.Items.drawPlayer) {
                        // the whole player in 3D, turned by its Angle (and live in Preview: spin / cursor)
                        const cv = document.createElement('canvas');
                        cv.className = 'gs-doll';
                        const k = Math.max(4, Math.min(12, Math.round(480 / Math.max(e.w, e.h))));
                        cv.width = Math.max(32, Math.round(e.w * k)); cv.height = Math.max(64, Math.round(e.h * k));
                        if (GS.Items.drawPlayer(cv, this.dollView(e))) { d.appendChild(cv); d.classList.add('has-doll'); }
                    } else {
                        const art = GS.Items && GS.Items.skinArt(e.type);
                        if (art) d.style.backgroundImage = `url("${art}")`;
                    }
                    if (!M.showsViewer(e)) d.classList.add('other');
                }
                if (e.type === 'text') {
                    const t = document.createElement('span');
                    t.className = 'gs-text-inner' + (e.shadow ? ' shadow' : '');
                    t.style.fontSize = (8 * M.num(e.scale, 1)) + 'px';
                    t.style.justifyContent = e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center';
                    t.innerHTML = mcToHtml(samplePapi(e.text), e.color || '#ffffff');
                    d.appendChild(t);
                }
                wrap.appendChild(d);
            });
            // selection frame + handles: a separate layer above everything, so selecting a
            // picture does not bring it in front of the other elements
            const sel = this.element();
            if (selIds.length > 1 && !this.previewMode) {
                // many selected: a thin frame on each, a dashed box around all (move them together)
                this.selElements().forEach(e => {
                    if (e.hidden) return;
                    const f = document.createElement('div');
                    f.className = 'gs-selframe multi' + (e.id === this.selected ? ' main' : '');
                    Object.assign(f.style, { left: e.x + 'px', top: e.y + 'px', width: e.w + 'px', height: e.h + 'px' });
                    wrap.appendChild(f);
                });
                const b = this.selBounds();
                const g = document.createElement('div');
                g.className = 'gs-groupframe';
                Object.assign(g.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
                wrap.appendChild(g);
            } else if (sel && !sel.hidden && !this.previewMode) {
                const f = document.createElement('div');
                f.className = 'gs-selframe';
                Object.assign(f.style, { left: sel.x + 'px', top: sel.y + 'px', width: sel.w + 'px', height: sel.h + 'px' });
                ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(h => {
                    const k = document.createElement('i');
                    k.className = 'gs-handle h-' + h;
                    k.dataset.handle = h;
                    f.appendChild(k);
                });
                if (sel.type === 'player_model') {
                    // drag left / right to turn the player all the way round (sets Angle)
                    const t = document.createElement('i');
                    t.className = 'gs-turn';
                    t.title = 'Drag to turn (Angle)';
                    t.innerHTML = '<svg viewBox="0 0 16 16"><path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.6 2.2v3.2H9.4M3.4 13.8v-3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
                    f.appendChild(t);
                }
                wrap.appendChild(f);
            }
            this.renderCursorPreview();
            this.applyZoom();
            if (this.previewMode) this.motionAttach(); else this.motionStop();
            this.dollsSpin();
            $('#gs-canvas-info').textContent = `${m.id} · ${m.width} × ${m.height} px` + (this.platform === 'bedrock' ? ' · Bedrock form view' : ' · Java hologram view');
            const meta = $('#gs-doc-meta');
            const kB = GS.Export.bedrockScale(m);
            if (meta) meta.textContent = this.platform === 'bedrock'
                ? `Bedrock form · ${kB < 1 ? `shown at ${Math.round(kB * 100)}% (${Math.round(m.width * kB)} × ${Math.round(m.height * kB)})` : `${m.width} × ${m.height}`}`
                : `Java hologram · ${m.width} × ${m.height}`;
            const sz = $('#gs-sb-size');
            if (sz) sz.textContent = `${m.width} × ${m.height} GUI px`;
        },

        /**
         * 2D shapes and smooth icons made in the studio are redrawn for the canvas at the zoom
         * being looked at, so they stay sharp however far you zoom in (like vector art). Only for
         * showing: the exported picture is the one stored in the project (its Detail).
         */
        liveArt(e) {
            const g = e.gen;
            if (!g || !GS.Assets || !g.opts || g.opts.look === 'pixel') return null;
            const k = Math.min(16, Math.max(1, Math.ceil(this.zoom * (window.devicePixelRatio || 1))));
            const key = `${e.id}|${k}|${JSON.stringify(g)}`;
            const cache = this._art || (this._art = new Map());
            if (cache.has(key)) return cache.get(key);
            if (cache.size > 300) cache.clear();
            try {
                if (g.kind === 'shape') {
                    const pic = GS.Assets.renderShape(g.shape, Object.assign({}, g.opts, { res: k }));
                    cache.set(key, pic.data);
                    return pic.data;
                }
                if (g.kind === 'icon' && g.icon && g.icon.body) {
                    cache.set(key, null);
                    GS.Assets.renderIcon(g.icon, Object.assign({ native: g.icon.native }, g.opts, { res: k })).then(pic => {
                        cache.set(key, pic.data);
                        const d = document.querySelector(`#gs-elements .gs-el[data-id="${CSS.escape(e.id)}"]`);
                        if (d && !d.style.getPropertyValue('--frame')) d.style.backgroundImage = `url("${pic.data}")`;
                    }).catch(() => {});
                }
            } catch (err) { /* fall back to the stored picture */ }
            return null;
        },

        renderCursorPreview() {
            const c = $('#gs-cursor');
            const show = this.previewMode && this.platform === 'java';
            c.style.display = show ? 'block' : 'none';
            if (!show) return;
            const p = this.project;
            const url = this.imageUrl(p.cursor.image) || GS.Export.defaultCursorPng();
            const h = M.clamp(M.int(p.cursor.height, 12), 4, 64);
            const im = p.images[p.cursor.image];
            const w = im ? Math.max(1, Math.round(im.w * h / im.h)) : Math.round(8 * h / 12);
            Object.assign(c.style, { width: w + 'px', height: h + 'px', backgroundImage: `url("${url}")`, marginLeft: -M.int(p.cursor.hotX, 0) + 'px', marginTop: -M.int(p.cursor.hotY, 0) + 'px' });
        },

        /** Pages whose Full screen differs from most of the others */
        fullscreenOdd(m) {
            const ms = this.project.menus;
            const on = ms.filter(x => x.fullscreen).length;
            return on > 0 && on < ms.length && !m.fullscreen;
        },
        fullscreenNotice(m) {
            if (!this.fullscreenOdd(m)) return '';
            const on = this.project.menus.filter(x => x.fullscreen).length;
            return `<div class="gs-warnbox">⚠ The other ${on > 1 ? `${on} pages are` : 'page is'} full screen, this one is not — players would see the size jump when they switch pages.
                <div class="gs-row-actions"><button class="ghost-btn small" data-action="fs-this">Make this page full screen</button><button class="ghost-btn small" data-action="fs-all">All pages full screen</button></div></div>`;
        },

        renderPages() {
            const ul = $('#gs-page-list');
            ul.innerHTML = this.project.menus.map((m, i) => `
                <li class="${i === this.menuIndex ? 'active' : ''}" data-i="${i}">
                  <span class="gs-page-title">${esc(m.title || m.id)}${this.fullscreenOdd(m) ? ' <span class="gs-page-warn" title="Not full screen like the other pages">⚠</span>' : ''}</span>
                  <span class="gs-page-id">${esc(m.id)}${m.command ? ' · /' + esc(m.command) : ''}</span>
                </li>`).join('');
        },

        renderLayers() {
            const m = this.menu();
            const ul = $('#gs-layer-list');
            const icon = { image: '#g-image', button: '#g-button', text: '#g-text', player_head: '#g-head', player_model: '#g-model', item: '#g-item' };
            ul.innerHTML = m.elements.slice().reverse().map(e => `
                <li class="${this.isSel(e.id) ? 'active' : ''} ${e.id === this.selected && this.isMulti() ? 'main' : ''} ${e.hidden ? 'is-hidden' : ''}" data-id="${esc(e.id)}">
                  <svg class="gs-layer-ico"><use href="${icon[e.type]}"/></svg>
                  <span class="gs-layer-name">${esc(e.name || e.id)}</span>
                  <button class="icon-btn small gs-eye" data-eye="${esc(e.id)}" title="Show / hide"><svg><use href="#g-eye"/></svg></button>
                </li>`).join('') || '<li class="gs-empty">No elements yet — add an image, button or text from the left toolbar, or <button class="link-btn" data-cmd="templates">start from a template</button> (M).</li>';
        },

        renderStatus() {
            const e = this.element();
            const b = this.isMulti() ? this.selBounds() : null;
            $('#gs-sb-selection').textContent = b ? `${this.selIds().length} selected · ${b.x}, ${b.y} · ${b.w} × ${b.h}`
                : e ? `${e.name || e.id} · ${e.x}, ${e.y} · ${e.w} × ${e.h}` : 'No selection';
            const m = this.menu();
            $('#gs-sb-menu').textContent = `Menu ${this.menuIndex + 1}/${this.project.menus.length}: ${m.id}`;
            $('#gs-sb-zoom').textContent = Math.round(this.zoom * 100) + '%';
            $('#gs-zoom').textContent = Math.round(this.zoom * 100) + '%';
            $('#gs-btn-grid').classList.toggle('active', this.snap);
            $('#gs-btn-preview').classList.toggle('active', this.previewMode);
            $$('#gs-platform [data-platform]').forEach(b => b.classList.toggle('active', b.dataset.platform === this.platform));
        },

        /* ───────────── properties panel ───────────── */

        field(label, key, value, opts) {
            opts = opts || {};
            const type = opts.type || 'text';
            const id = 'gsf-' + key.replace(/[^a-z0-9]/gi, '_');
            if (type === 'checkbox') {
                return `<label class="gs-check"><input type="checkbox" data-k="${key}" ${value ? 'checked' : ''}/> <span>${label}</span></label>`;
            }
            if (type === 'select') {
                return `<div class="gs-field"><label for="${id}">${label}</label><select id="${id}" data-k="${key}">${opts.options.map(o => `<option value="${esc(o[0])}" ${String(value) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
            }
            if (type === 'textarea') {
                return `<div class="gs-field wide"><label for="${id}">${label}</label><textarea id="${id}" data-k="${key}" rows="${opts.rows || 4}" spellcheck="false">${esc(value)}</textarea>${opts.hint ? `<div class="gs-hint">${opts.hint}</div>` : ''}</div>`;
            }
            const attrs = type === 'number' ? `step="${opts.step || 1}" ${opts.min != null ? `min="${opts.min}"` : ''} ${opts.max != null ? `max="${opts.max}"` : ''}` : 'spellcheck="false"';
            const ph = opts.placeholder != null ? ` placeholder="${esc(opts.placeholder)}"` : '';
            return `<div class="gs-field ${opts.wide ? 'wide' : ''}"><label for="${id}">${label}</label><input id="${id}" type="${type === 'color' ? 'color' : type}" data-k="${key}" value="${esc(value)}" ${attrs}${ph}/>${opts.hint ? `<div class="gs-hint">${opts.hint}</div>` : ''}</div>`;
        },

        imagePicker(label, key, imageId) {
            const url = this.imageUrl(imageId);
            const im = imageId && this.project.images[imageId];
            return `<div class="gs-field wide"><label>${label}</label>
                <div class="gs-imgpick">
                  <div class="gs-imgthumb" style="${url ? `background-image:url('${url}')` : ''}">${url ? '' : 'none'}</div>
                  <div class="gs-imgmeta">${im ? `${esc(im.name)}<br><em>${im.w} × ${im.h}</em>` : '<em>No picture</em>'}</div>
                  <button class="ghost-btn" data-pick="${key}">Choose…</button>
                  ${(key === 'image' || key === 'hoverImage') && this.element() && this.element().type === 'button' ? `<button class="ghost-btn" data-gen-pick="${key}" title="Draw this picture as a shape (2D or pixel)">Shape…</button>` : ''}
                  ${url ? `<button class="icon-btn small danger" data-clear="${key}" title="Remove"><svg><use href="#g-close"/></svg></button>` : ''}
                </div></div>`;
        },

        renderProps() {
            const box = $('#gs-props');
            const e = this.element();
            if (this.propsMode === 'cursor') { box.innerHTML = this.cursorPropsHtml(); return; }
            if (!e) { box.innerHTML = this.menuPropsHtml(); return; }
            if (this.isMulti()) { box.innerHTML = this.multiPropsHtml(); return; }
            let h = `<div class="gs-prop-title"><svg><use href="${{ image: '#g-image', button: '#g-button', text: '#g-text', player_head: '#g-head', player_model: '#g-model', item: '#g-item' }[e.type]}"/></svg>${{ image: 'Image', button: 'Button', text: 'Text', player_head: 'Player Head', player_model: 'Player Model', item: 'Item' }[e.type]}</div>`;
            h += `<div class="gs-section">`;
            h += this.field('Name', 'name', e.name, { wide: true });
            h += `<div class="gs-grid4">${this.field('X', 'x', e.x, { type: 'number' })}${this.field('Y', 'y', e.y, { type: 'number' })}${this.field('W', 'w', e.w, { type: 'number', min: 1 })}${this.field('H', 'h', e.h, { type: 'number', min: 1 })}</div>`;
            h += `</div>`;
            if (e.type === 'image') {
                h += `<div class="gs-section">${this.imagePicker('Picture', 'image', e.image)}
                      ${this.detailField(e)}
                      <button class="ghost-btn block" data-action="fit-image">Size to picture</button></div>`;
            }
            if (e.type === 'button') {
                h += `<div class="gs-section"><div class="gs-sec-head">Look</div>
                      ${this.imagePicker('Picture', 'image', e.image)}
                      ${this.imagePicker('Hover picture', 'hoverImage', e.hoverImage)}
                      ${this.detailField(e)}
                      <button class="ghost-btn block" data-action="fit-image">Size to picture</button></div>`;
                h += `<div class="gs-section"><div class="gs-sec-head">Label</div>
                      ${this.field('Text', 'label', e.label, { wide: true, hint: '&amp; colour codes and %placeholders% work' })}
                      <div class="gs-grid2">${this.field('Colour', 'labelColor', e.labelColor || '#ffffff', { type: 'color' })}${this.field('Size', 'labelScale', e.labelScale, { type: 'number', step: 0.25, min: 0.25 })}</div>
                      ${this.field('Shadow', 'labelShadow', e.labelShadow !== false, { type: 'checkbox' })}</div>`;
                h += `<div class="gs-section"><div class="gs-sec-head">On click</div>
                      ${this.field('Actions (one per line)', 'actions', (e.actions || []).join('\n'), {
                          type: 'textarea', rows: 5,
                          hint: '<code>player:</code>cmd · <code>console:</code>cmd · <code>open:</code>menu · <code>close</code> · <code>message:</code>text · <code>sound:</code>id · <code>server:</code>name<br>Placeholders like %player_name% work.'
                      })}
                      ${this.field('Close the menu after clicking', 'closeOnClick', !!e.closeOnClick, { type: 'checkbox' })}
                      ${this.field('Hover sound (optional)', 'hoverSound', e.hoverSound || '', { wide: true, hint: 'Empty = the project hover sound' })}</div>`;
            }
            if (e.type === 'text') {
                h += `<div class="gs-section"><div class="gs-sec-head">Text</div>
                      ${this.field('Text', 'text', e.text, { type: 'textarea', rows: 2, hint: '&amp; colour codes and %placeholders% work. Updated every few ticks in game.' })}
                      <div class="gs-grid2">${this.field('Colour', 'color', e.color || '#ffffff', { type: 'color' })}${this.field('Size', 'scale', e.scale, { type: 'number', step: 0.25, min: 0.25 })}</div>
                      ${this.field('Align', 'align', e.align, { type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] })}
                      ${this.field('Shadow', 'shadow', !!e.shadow, { type: 'checkbox' })}</div>`;
            }
            if (M.isPlayer(e)) {
                const db = M.dollBox(e);
                const ds = e.dollSize || ['', ''], dof = e.dollOffset || ['', ''];
                h += `<div class="gs-section"><div class="gs-sec-head">Player</div>
                      ${this.field('Whose skin', 'player', e.player, { wide: true, hint: '<code>%player_name%</code> = the player who opens the menu. A name or a placeholder (e.g. <code>%ajlb_lb_statistic_player_kills_1_alltime_name%</code>) shows that player.<br><b>Java:</b> KaizerUI draws the real skin of anyone. <b>Bedrock:</b> the game\'s paper doll can only show the player who opens the menu — anyone else shows as Steve.' })}
                      ${this.field('Hat layer (Java)', 'hat', e.hat !== false, { type: 'checkbox' })}</div>`;
                if (e.type === 'player_model') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Java 3D model</div>
                      ${this.field('Real 3D player (Mannequin)', 'java3d', e.java3d !== false, { type: 'checkbox' })}
                      ${e.java3d !== false ? `
                      ${this.field('Outfit', 'outfit', e.outfit || 'own', { type: 'select', options: [['own', 'What that player wears (armour + held items)'], ['none', 'No armour']] })}
                      <div class="gs-grid2">${this.field('Pose', 'pose', e.pose || 'standing', { type: 'select', options: [['standing', 'Standing'], ['crouching', 'Crouching']] })}${this.field('Turn', 'turn', e.turn || 'none', { type: 'select', options: [['none', 'Still'], ['spin', 'Spin'], ['cursor', 'Look at the cursor'], ['mouse', 'Turn with the cursor'], ['drag', 'Drag to turn']] })}</div>
                      <div class="gs-grid2">${this.field('Angle (°)', 'angle', e.angle || 0, { type: 'number', step: 5 })}${e.turn === 'spin' ? this.field('Spin (° / s)', 'spinSpeed', e.spinSpeed || 45, { type: 'number', step: 5, min: 1 }) : ''}</div>
                      <div class="gs-hint">Drag the round handle under the model to set its Angle. ${e.turn === 'mouse' ? 'In game it turns all the way round as the cursor goes from one side of the menu to the other. ' : e.turn === 'drag' ? '<b>Drag to turn:</b> Java — click the player, move the mouse, click again to let go · Bedrock — hold and drag, like the pause screen. ' : ''}Try it in Preview (P).</div>
                      <div class="gs-hint">A real player model in the menu scene (needs 1.21.9+ clients). It is lit by the light where the player stands — dark in caves / at night. Off = the skin drawn flat, like the head.</div>` : '<div class="gs-hint">Flat: the front of the skin drawn as pixels (works on every 1.21 client).</div>'}</div>`;
                }
                h += `<div class="gs-section"><div class="gs-sec-head">Bedrock paper doll</div>
                      <div class="gs-grid2">${this.field('Doll W', 'dollSize.0', ds[0], { placeholder: String(db.size[0]) })}${this.field('Doll H', 'dollSize.1', ds[1], { placeholder: String(db.size[1]) })}</div>
                      <div class="gs-grid2">${this.field('Doll X', 'dollOffset.0', dof[0], { placeholder: String(db.offset[0]) })}${this.field('Doll Y', 'dollOffset.1', dof[1], { placeholder: String(db.offset[1]) })}</div>
                      <div class="gs-hint">Same as Doll Size / Doll Offset of the HUD's Player Head${e.type === 'player_head' ? ' — the doll is drawn bigger than the box and only the head shows' : ''}. Empty = worked out from the size.</div></div>`;
            }
            if (e.type === 'item') {
                const bt = GS.Items ? GS.Items.bedrockTexture(Object.assign({}, e, { bedrockTexture: '' })) : null;
                h += `<div class="gs-section"><div class="gs-sec-head">Item</div>
                      ${this.field('Item id', 'item', e.item, { wide: true, hint: '<code>minecraft:diamond_sword</code> · <code>itemsadder:namespace:id</code> · <code>nexo:id</code> · <code>slot:head</code> / <code>chest</code> / <code>legs</code> / <code>feet</code> / <code>hand</code> / <code>offhand</code> (what the player wears / holds)' })}
                      <div class="gs-row-actions"><button class="ghost-btn" data-action="pick-item"><svg><use href="#g-item"/></svg><span>Choose item…</span></button></div>
                      <div class="gs-grid2">${this.field('Look (Java)', 'look', e.look || 'flat', { type: 'select', options: [['flat', 'Like in the inventory'], ['3d', '3D (held item)']] })}${this.field('Enchant glint', 'glint', !!e.glint, { type: 'checkbox' })}</div>
                      ${this.field('Spin (Java)', 'spin', !!e.spin, { type: 'checkbox' })}
                      ${this.field('Bedrock texture', 'bedrockTexture', e.bedrockTexture || '', { wide: true, placeholder: bt || '(not shown on Bedrock)', hint: 'Path in the Bedrock game\'s own pack. Empty = worked out from the id (names differ from Java for some items).' })}
                      <div class="gs-hint">Java shows the real item (ItemsAdder / Nexo items too). The picture here comes from your own Minecraft files — Choose item… → Load.</div></div>`;
            }
            if (e.type === 'image' && e.gen) {
                const g = e.gen, what = g.kind === 'icon' ? 'icon' : 'shape';
                const sub = g.kind === 'icon' ? `${esc(g.icon.name)} · ${esc(g.icon.setName || g.icon.prefix)} · ${esc((g.icon.license || {}).title || '')}` : `${esc((GS.Assets.SHAPES[g.shape] || {}).label || g.shape)} · ${g.opts.look === 'pixel' ? 'pixel' : '2D'}`;
                h += `<div class="gs-section"><div class="gs-sec-head">Made in the studio</div>
                    <div class="gs-hint">${sub}</div>
                    <div class="gs-row-actions"><button class="ghost-btn" data-action="edit-gen"><svg><use href="#g-${what}"/></svg><span>Edit ${what}…</span></button></div></div>`;
            }
            if (e.type === 'image' || e.type === 'button') h += this.framesHtml(e);
            h += this.motionHtml(e);
            h += `<div class="gs-section gs-row-actions">
                    <button class="ghost-btn" data-action="duplicate"><svg><use href="#g-copy"/></svg><span>Duplicate</span></button>
                    <button class="ghost-btn danger" data-action="delete"><svg><use href="#g-trash"/></svg><span>Delete</span></button></div>`;
            box.innerHTML = h;
        },

        /** How finely the picture is drawn in game: 1× = pixel art, 2–8× = smooth */
        detailField(e) {
            return this.field('Detail in game', 'detail', e.detail || 1, {
                type: 'select', options: [['1', '1× — pixel art (sharp pixels)'], ['2', '2× — smoother'], ['4', '4× — smooth (photos, 2D shapes)'], ['8', '8× — very fine (big pack)']],
                hint: 'Java draws the picture this many times finer than 1 GUI pixel. Pixel art: keep 1×. Small smooth pictures (2D shapes, icons, photos): 4×. Big backgrounds: 1–2× (finer = more pieces in game). Bedrock always uses the picture as it is.'
            });
        },

        /** Animation frames of a picture (image / button face) */
        framesHtml(e) {
            const list = [e.image].concat(e.frames || []).filter(Boolean);
            const thumbs = list.map((id, i) => {
                const url = this.imageUrl(id);
                return `<div class="gs-frame" title="Frame ${i + 1}" style="${url ? `background-image:url('${url}')` : ''}">
                    <span>${i + 1}</span>${i > 0 ? `<button class="gs-frame-del" data-frame-del="${i - 1}" title="Remove this frame">×</button>` : ''}</div>`;
            }).join('');
            return `<div class="gs-section"><div class="gs-sec-head">Animated picture</div>
                ${list.length > 1 ? `<div class="gs-frames">${thumbs}</div>` : '<div class="gs-hint">Add more pictures (or one GIF) and they play as an animation — a spinning coin, a glowing banner…</div>'}
                <div class="gs-row-actions">
                  <button class="ghost-btn" data-action="add-frames"><svg><use href="#g-image"/></svg><span>Add frames / GIF…</span></button>
                  ${list.length > 1 ? '<button class="ghost-btn danger" data-action="clear-frames"><span>Clear</span></button>' : ''}
                </div>
                ${list.length > 1 ? this.field('Frames a second', 'fps', e.fps || 8, { type: 'number', min: 1, max: 20, hint: 'Java changes frames on server ticks (at most 20 a second). Bedrock plays them itself.' }) : ''}
            </div>`;
        },

        /** Motion of one element */
        motionHtml(e) {
            const Mo = GS.Motion;
            const em = Object.assign(Mo.elementDefaults(e.type), e.motion || {});
            const menuCascade = (this.menu().motion || {}).cascade;
            const autoLabel = menuCascade && menuCascade !== 'none' ? `Follow the menu (${(Mo.INTRO[menuCascade] || ['?'])[0]})` : 'Follow the menu (no cascade)';
            let h = `<div class="gs-section"><div class="gs-sec-head gs-head-row"><span>Motion</span><button class="ghost-btn small" data-action="play-motion" title="Play in preview (P)"><svg><use href="#g-play"/></svg><span>Play</span></button></div>`;
            h += this.field('Appear', 'motion.intro', em.intro, { type: 'select', options: Mo.options(Mo.INTRO, [['auto', autoLabel], ['none', 'None — no entrance']]) });
            const cascadeOn = menuCascade && menuCascade !== 'none';
            if (em.intro !== 'none' && (em.intro !== 'auto' || cascadeOn)) {
                h += `<div class="gs-grid2">${this.field('Delay (ms)', 'motion.introDelay', em.introDelay, { type: 'number', step: 10, min: 0 })}${em.intro !== 'auto' ? this.field('Length (ms)', 'motion.introMs', em.introMs || '', { type: 'number', step: 10, min: 0 }) : ''}</div>`;
            }
            h += this.field('Loop', 'motion.loop', em.loop, { type: 'select', options: Mo.options(Mo.LOOP, [['none', 'None']]) });
            if (em.loop !== 'none') {
                h += `<div class="gs-grid2">${this.field('Strength', 'motion.loopAmount', em.loopAmount, { type: 'number', step: 0.25, min: 0 })}${this.field('One cycle (ms)', 'motion.loopMs', em.loopMs || '', { type: 'number', step: 50, min: 0 })}</div>`;
            }
            if (e.type === 'button') {
                h += `<div class="gs-grid2">${this.field('Hover', 'motion.hover', em.hover, { type: 'select', options: Mo.options(Mo.HOVER) })}${this.field('Click', 'motion.press', em.press, { type: 'select', options: Mo.options(Mo.PRESS) })}</div>`;
                h += '<div class="gs-hint">Hover and click motion are Java only (Bedrock shows the hover picture).</div>';
            }
            h += '<div class="gs-hint">Length empty = the effect\'s own speed. Bedrock plays fade, slide, rise / drop, bounce, bob, float, sway, blink and pulse; turning effects are Java only.</div>';
            return h + '</div>';
        },

        menuPropsHtml() {
            const m = this.menu();
            const mo = Object.assign(GS.Motion.defaults(), m.motion || {});
            return `<div class="gs-prop-title">Menu page</div>
                <div class="gs-section">
                  ${this.field('Id', 'menu.id', m.id, { wide: true, hint: 'a-z 0-9 _ · used by <code>/kui open ' + esc(m.id) + '</code> and <code>open:' + esc(m.id) + '</code>' })}
                  ${this.field('Title', 'menu.title', m.title, { wide: true })}
                  ${this.field('Command (optional)', 'menu.command', m.command, { wide: true, hint: 'e.g. <code>shop</code> → players type /shop' })}
                  <div class="gs-grid2">${this.field('Width', 'menu.width', m.width, { type: 'number', min: 16, max: M.MAX_SIDE })}${this.field('Height', 'menu.height', m.height, { type: 'number', min: 16, max: M.MAX_SIDE })}</div>
                  ${this.field('Size preset', 'menu.sizePreset', `${m.width}x${m.height}`, { type: 'select', options: [
                      [`${m.width}x${m.height}`, `${m.width} × ${m.height} (now)`], ['320x180', '320 × 180 — big pixels'], ['400x225', '400 × 225'],
                      ['480x270', '480 × 270'], ['640x360', '640 × 360 — default']] })}
                  <div class="gs-grid2">${this.field('Text refresh (ticks)', 'menu.refreshTicks', m.refreshTicks, { type: 'number', min: 0 })}${this.field('Open sound', 'menu.openSound', m.openSound)}</div>
                </div>
                <div class="gs-section"><div class="gs-sec-head">Full screen</div>
                  ${this.fullscreenNotice(m)}
                  ${this.field('Full screen on Java (as big as the screen allows)', 'menu.fullscreen', !!m.fullscreen, { type: 'checkbox' })}
                  <div class="gs-hint">Java: the menu fills about 94% of the screen height (16:9 menus fill the width too) and everything around it is dimmed. Bedrock is sized on its own: pages bigger than 480 × 270 are shrunk to fit Bedrock screens.</div>
                  <div class="gs-grid2">${this.field('Backdrop colour', 'menu.backdrop', m.backdrop || '#000000', { type: 'color' })}${this.field('Backdrop opacity', 'menu.backdropAlpha', m.backdropAlpha, { type: 'number', step: 0.05, min: 0, max: 1 })}</div>
                  ${this.field('Dim the screen on Bedrock too', 'menu.bedrockBackdrop', !!m.bedrockBackdrop, { type: 'checkbox' })}
                </div>
                <div class="gs-section"><div class="gs-sec-head gs-head-row"><span>Opening</span><button class="ghost-btn small" data-action="play-motion" title="Play in preview (P)"><svg><use href="#g-play"/></svg><span>Play</span></button></div>
                  ${this.field('Whole menu', 'menu.motion.open', mo.open, { type: 'select', options: GS.Motion.options(GS.Motion.OPEN) })}
                  ${mo.open !== 'none' ? this.field('Length (ms, empty = its own)', 'menu.motion.openMs', mo.openMs || '', { type: 'number', step: 10, min: 0 }) : ''}
                  ${this.field('Cascade (elements appear one after another)', 'menu.motion.cascade', mo.cascade, { type: 'select', options: GS.Motion.options(GS.Motion.INTRO, [['none', 'None']]) })}
                  ${mo.cascade !== 'none' ? `<div class="gs-grid2">${this.field('Gap between (ms)', 'menu.motion.cascadeGap', mo.cascadeGap, { type: 'number', step: 5, min: 0 })}${this.field('Each length (ms)', 'menu.motion.cascadeMs', mo.cascadeMs || '', { type: 'number', step: 10, min: 0 })}</div>` : ''}
                  <div class="gs-hint">Plays every time the page opens. Elements set to "Follow the menu" take part in the cascade, in layer order (bottom first). Pick an element to give it its own entrance or a loop.</div>
                </div>
                <div class="gs-section gs-note">
                  <b>Tips</b><br>
                  • 1 px here = 1 GUI pixel in game. 480 × 270 + Full screen = the whole screen on Java (like GUI scale 4 at 1080p).<br>
                  • Java: the menu floats in front of the player; the mouse moves the cursor.<br>
                  • Bedrock: the same layout is shown as a form, with the real mouse / touch — automatically shrunk to fit Bedrock (at most 480 × 270).<br>
                  • Switch <b>Show as</b> in the top bar to check both looks.
                </div>`;
        },

        cursorPropsHtml() {
            const p = this.project, s = p.settings;
            return `<div class="gs-prop-title"><svg><use href="#g-cursor"/></svg>Cursor &amp; in-game settings</div>
                <div class="gs-section"><div class="gs-sec-head">Java cursor</div>
                  ${this.imagePicker('Cursor picture (empty = built-in arrow)', 'cursor.image', p.cursor.image)}
                  <div class="gs-grid3">${this.field('Height', 'cursor.height', p.cursor.height, { type: 'number', min: 4, max: 64 })}${this.field('Hot X', 'cursor.hotX', p.cursor.hotX, { type: 'number' })}${this.field('Hot Y', 'cursor.hotY', p.cursor.hotY, { type: 'number' })}</div>
                  <div class="gs-hint">Hot X / Y: the pixel of the picture that clicks (0, 0 = top-left tip).</div>
                </div>
                <div class="gs-section"><div class="gs-sec-head">Java hologram</div>
                  ${this.field('Lock the camera (mouse moves a cursor — needs PacketEvents)', 'settings.cameraLock', s.cameraLock !== false, { type: 'checkbox' })}
                  <div class="gs-hint">Off: the camera turns and the crosshair is the cursor.</div>
                  <div class="gs-grid3">${this.field('Distance', 'settings.distance', s.distance, { type: 'number', step: 0.1, min: 0.3 })}${this.field('Screen fill', 'settings.fill', s.fill, { type: 'number', step: 0.05, min: 0.2, max: 1 })}${this.field('Mouse speed', 'settings.sensitivity', s.sensitivity, { type: 'number', step: 0.1, min: 0.1 })}</div>
                  <div class="gs-hint">Screen fill: how much of the screen height the menu covers (at FOV 70).</div>
                  ${this.field('Sneak to leave the menu', 'settings.exitOnSneak', s.exitOnSneak !== false, { type: 'checkbox' })}
                </div>
                <div class="gs-section"><div class="gs-sec-head">Sounds</div>
                  ${this.field('Click', 'settings.clickSound', s.clickSound, { wide: true })}
                  ${this.field('Hover', 'settings.hoverSound', s.hoverSound, { wide: true })}
                </div>
                <div class="gs-section"><button class="ghost-btn block" data-action="close-cursor">Back to menu properties</button></div>`;
        },

        /** apply one property input (data-k) */
        applyField(key, raw, isCheckbox) {
            const p = this.project;
            const val = isCheckbox ? !!raw : raw;
            if (key.startsWith('menu.motion.')) {
                const m = this.menu(), k = key.slice(12);
                this.checkpoint();
                m.motion = Object.assign(GS.Motion.defaults(), m.motion || {});
                m.motion[k] = ['openMs', 'cascadeMs', 'cascadeGap'].includes(k) ? Math.max(0, M.int(val, 0)) : val;
                this.changed();
                if (this.previewMode) this.motionReplay();
                return;
            }
            if (key.startsWith('menu.')) {
                const m = this.menu(), k = key.slice(5);
                this.checkpoint();
                if (k === 'id') {
                    const nid = M.slug(val, m.id);
                    if (p.menus.some(x => x !== m && x.id === nid)) { GS.toast(`A menu with id "${nid}" already exists`, 'error'); this.renderProps(); return; }
                    // keep open:<id> actions pointing at the renamed menu
                    p.menus.forEach(mm => mm.elements.forEach(e => {
                        if (Array.isArray(e.actions)) e.actions = e.actions.map(a => String(a).trim() === 'open:' + m.id ? 'open:' + nid : a);
                    }));
                    m.id = nid;
                } else if (k === 'width' || k === 'height') m[k] = M.clamp(M.int(val, m[k]), 16, M.MAX_SIDE);
                else if (k === 'sizePreset') {
                    const [w, h] = String(val).split('x').map(Number);
                    if (w && h) {
                        // keep what is on the page in the middle of the new size
                        const dx = Math.round((w - m.width) / 2), dy = Math.round((h - m.height) / 2);
                        if (dx || dy) m.elements.forEach(el => { el.x += dx; el.y += dy; });
                        m.width = w; m.height = h;
                        // content keeps its size (no scaling): it only moves to the middle
                        if (dx || dy) GS.toast('Content moved to stay in the middle');
                    }
                } else if (k === 'fullscreen') m.fullscreen = !!val;
                else if (k === 'bedrockBackdrop') m.bedrockBackdrop = !!val;
                else if (k === 'backdropAlpha') m.backdropAlpha = M.clamp(M.num(val, 0.6), 0, 1);
                else if (k === 'refreshTicks') m[k] = Math.max(0, M.int(val, 20));
                else if (k === 'command') m[k] = String(val).trim().replace(/^\//, '');
                else m[k] = val;
                this.changed();
                if (['width', 'height', 'sizePreset'].includes(k)) this.zoomFit();
                return;
            }
            if (key.startsWith('cursor.') || key.startsWith('settings.')) {
                const [grp, k] = key.split('.');
                this.checkpoint();
                const target = grp === 'cursor' ? p.cursor : p.settings;
                if (isCheckbox) target[k] = val;
                else if (['height', 'hotX', 'hotY'].includes(k)) target[k] = M.int(val, target[k]);
                else if (['distance', 'fill', 'sensitivity'].includes(k)) target[k] = M.num(val, target[k]);
                else target[k] = val;
                return this.changed();
            }
            const e = this.element();
            if (!e) return;
            this.checkpoint();
            if (key.startsWith('motion.')) {
                const k = key.slice(7);
                e.motion = Object.assign(GS.Motion.elementDefaults(e.type), e.motion || {});
                if (['introMs', 'introDelay', 'loopMs', 'hoverMs'].includes(k)) e.motion[k] = Math.max(0, M.int(val, 0));
                else if (k === 'loopAmount') e.motion[k] = Math.max(0, M.num(val, 1));
                else e.motion[k] = val;
                this.changed();
                if (this.previewMode) this.motionReplay();
                return;
            }
            if (key === 'fps') { e.fps = M.clamp(M.num(val, 8), 1, 20); return this.changed(); }
            if (key === 'detail') { e.detail = [1, 2, 4, 8].includes(Number(val)) ? Number(val) : 1; return this.changed(); }
            if (/^doll(Size|Offset)\.[01]$/.test(key)) {
                const [k, i] = key.split('.');
                const v = String(val).trim();
                if (v === '') e[k] = null;
                else {
                    const box = M.dollBox(e)[k === 'dollSize' ? 'size' : 'offset'];
                    const cur = (e[k] || box).slice();
                    cur[+i] = M.num(v, cur[+i]);
                    e[k] = cur;
                }
                return this.changed();
            }
            if (key === 'angle') { e.angle = M.num(val, 0); return this.changed(); }
            if (key === 'spinSpeed') { e.spinSpeed = M.clamp(M.num(val, 45), 1, 720); return this.changed(); }
            if (key === 'item') { e.item = String(val).trim(); return this.changed(); }
            if (['x', 'y'].includes(key)) e[key] = M.int(val, e[key]);
            else if (['w', 'h'].includes(key)) e[key] = Math.max(1, M.int(val, e[key]));
            else if (['labelScale', 'scale'].includes(key)) e[key] = Math.max(0.25, M.num(val, 1));
            else if (key === 'actions') e.actions = String(val).split('\n').map(s => s.trim()).filter(Boolean);
            else e[key] = val;
            this.changed();
        },

        /* ───────────── element operations ───────────── */

        add(type) {
            if (type === 'image') { this.pickImage(id => this.addElement('image', id)); return; }
            if (type === 'item' && GS.Items) {
                GS.Items.pick('').then(id => { if (id) { this.addElement('item'); const e = this.element(); e.item = id; e.name = itemName(id); this.changed(); } });
                return;
            }
            this.addElement(type);
        },

        addElement(type, imageId) {
            const m = this.menu();
            const e = M.newElement(type, m);
            if (imageId) {
                const im = this.project.images[imageId];
                e.image = imageId;
                e.detail = Math.max(1, im.res || 1);
                const gs = M.imageGuiSize(im, e.detail);
                e.w = Math.min(gs.w, m.width); e.h = Math.min(gs.h, m.height);
                e.x = Math.max(0, Math.round((m.width - e.w) / 2)); e.y = Math.max(0, Math.round((m.height - e.h) / 2));
                e.name = String(im.name || e.name).replace(/\.[a-z0-9]+$/i, '');
            }
            this.checkpoint();
            m.elements.push(e);
            this.selected = e.id;
            this.propsMode = null;
            this.changed();
        },

        pickItem() {
            const e = this.element();
            if (!e || e.type !== 'item' || !GS.Items) return;
            GS.Items.pick(e.item).then(id => {
                if (!id) return;
                this.checkpoint();
                const auto = !e.name || /^Item \d+$/.test(e.name) || e.name === itemName(e.item);
                e.item = id;
                if (auto) e.name = itemName(id);
                this.changed();
            });
        },

        pickImage(cb) {
            const input = $('#gs-image-input');
            input.value = '';
            input.onchange = async () => {
                const f = input.files && input.files[0];
                if (!f) return;
                try {
                    const info = await M.readImageFile(f);
                    const id = M.addImage(this.project, info);
                    cb(id, info);
                } catch (err) { GS.toast(err.message, 'error'); }
            };
            input.click();
        },

        setImage(key) {
            this.pickImage((id) => {
                this.checkpoint();
                if (key === 'cursor.image') this.project.cursor.image = id;
                else {
                    const e = this.element();
                    if (!e) return;
                    const first = !e.image && key === 'image';
                    e[key] = id;
                    if (first) { const gs = M.imageGuiSize(this.project.images[id], e.detail); e.w = gs.w; e.h = gs.h; }
                }
                this.changed();
            });
        },

        clearImage(key) {
            this.checkpoint();
            if (key === 'cursor.image') this.project.cursor.image = null;
            else { const e = this.element(); if (e) e[key] = null; }
            this.changed();
        },

        fitImage() {
            const e = this.element();
            const im = e && this.project.images[e.image];
            if (!im) return;
            this.checkpoint();
            const gs = M.imageGuiSize(im, e.detail);
            e.w = gs.w; e.h = gs.h;
            this.changed();
        },

        /* ───────────── shapes & icons ───────────── */

        /** S / O: new picture element from the Shapes & Icons window */
        openAssets(tab) {
            GS.Assets.open({
                tab,
                onApply: (pic, gen) => {
                    const id = M.addImage(this.project, pic);
                    this.addElement('image', id);
                    const e = this.element();
                    if (e) { e.gen = gen; e.detail = pic.res || 1; e.w = pic.gw; e.h = pic.gh; this.changed(); }
                }
            });
        },
        /** Edit… on a picture made in the studio: redraw it with new settings */
        editGenerated() {
            const e = this.element();
            if (!e || !e.gen) return;
            const gen = JSON.parse(JSON.stringify(e.gen));
            if (gen.kind === 'shape') { gen.opts.w = e.w; gen.opts.h = e.h; if (gen.opts.look === 'pixel' && gen.opts.shadow) { gen.opts.w--; gen.opts.h--; } }
            GS.Assets.open({
                gen,
                onApply: (pic, g) => {
                    this.checkpoint();
                    e.image = M.addImage(this.project, pic);
                    e.gen = g; e.detail = pic.res || 1; e.w = pic.gw; e.h = pic.gh;
                    this.changed();
                }
            });
        },
        /** Shape… on a button picture: draws it at the button's size (+ the hover picture one shade lighter) */
        shapeForButton(key) {
            const e = this.element();
            if (!e || e.type !== 'button') return;
            GS.Assets.open({
                tab: 'shapes', size: { w: e.w, h: e.h }, forButton: key,
                onApply: (pic, gen, hover) => {
                    this.checkpoint();
                    e[key] = M.addImage(this.project, pic);
                    if (hover && key === 'image') e.hoverImage = M.addImage(this.project, hover);
                    if (key === 'image') { e.w = pic.gw; e.h = pic.gh; e.detail = pic.res || 1; }
                    this.changed();
                }
            });
        },

        /** Pick pictures (several, or a GIF that is split into its frames) and add them as frames */
        addFrames() {
            const e = this.element();
            if (!e) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/png,image/jpeg,image/webp,image/gif';
            input.onchange = async () => {
                const files = Array.from(input.files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                if (!files.length) return;
                const ids = [];
                let fps = null;
                try {
                    for (const f of files) {
                        if (/gif$/i.test(f.type) || /\.gif$/i.test(f.name)) {
                            const g = await decodeGif(f);
                            if (g) {
                                g.frames.forEach(info => ids.push(M.addImage(this.project, info)));
                                fps = g.fps;
                                continue;
                            }
                        }
                        ids.push(M.addImage(this.project, await M.readImageFile(f)));
                    }
                } catch (err) { GS.toast(err.message, 'error'); return; }
                if (!ids.length) return;
                this.checkpoint();
                if (!e.image) {
                    e.image = ids.shift();
                    const gs = M.imageGuiSize(this.project.images[e.image], e.detail);
                    e.w = gs.w; e.h = gs.h;
                }
                e.frames = (e.frames || []).concat(ids).slice(0, 63);
                if (fps) e.fps = fps;
                this.changed();
                GS.toast(`${(e.frames.length + 1)} frames — press P to see it play`);
            };
            input.click();
        },
        removeFrame(i) {
            const e = this.element();
            if (!e || !e.frames) return;
            this.checkpoint();
            e.frames.splice(i, 1);
            this.changed();
        },
        clearFrames() {
            const e = this.element();
            if (!e) return;
            this.checkpoint();
            e.frames = [];
            this.changed();
        },

        /** Drag on an empty spot: box-select (Ctrl / Shift adds to what is selected) */
        marquee(ev, toLocal, additive) {
            const screen = $('#gs-screen');
            const start = toLocal(ev);
            const before = additive ? this.selIds() : [];
            let box = null;
            const onMove = (mv) => {
                const p = toLocal(mv);
                if (!box) {
                    if (Math.abs(p.x - start.x) * this.zoom < 4 && Math.abs(p.y - start.y) * this.zoom < 4) return;
                    box = document.createElement('div');
                    box.className = 'gs-marquee';
                    screen.appendChild(box);
                }
                const x = Math.min(p.x, start.x), y = Math.min(p.y, start.y), w = Math.abs(p.x - start.x), h = Math.abs(p.y - start.y);
                Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
                // live: everything the box touches
                const hit = this.menu().elements.filter(e => !e.hidden && e.x < x + w && e.x + e.w > x && e.y < y + h && e.y + e.h > y).map(e => e.id);
                this.setSel(before.concat(hit));
                this.renderCanvas();
                this.renderStatus();
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                if (box) box.remove();
                else if (!additive) this.setSel([]);
                this.renderAll();
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        },

        /** Properties when several elements are selected */
        multiPropsHtml() {
            const els = this.selElements();
            const b = this.selBounds();
            const n = els.length;
            const types = [...new Set(els.map(e => e.type))];
            const Mo = GS.Motion;
            const first = Object.assign(Mo.elementDefaults(els[0].type), els[0].motion || {});
            const same = (k) => els.every(e => (Object.assign(Mo.elementDefaults(e.type), e.motion || {}))[k] === first[k]);
            const btn = (a, label, tip) => `<button class="ghost-btn small" data-action="${a}" title="${tip}">${label}</button>`;
            let h = `<div class="gs-prop-title"><svg><use href="#g-copy"/></svg>${n} elements selected</div>`;
            h += `<div class="gs-section"><div class="gs-sec-head">Move together</div>
                <div class="gs-grid4">${this.field('X', 'multi.x', b.x, { type: 'number' })}${this.field('Y', 'multi.y', b.y, { type: 'number' })}
                <div class="gs-field"><label>W</label><input type="text" value="${b.w}" disabled></div><div class="gs-field"><label>H</label><input type="text" value="${b.h}" disabled></div></div>
                <div class="gs-hint">Drag any of them on the canvas, use the arrow keys (Shift = 10 px) or type X / Y here.</div></div>`;
            h += `<div class="gs-section"><div class="gs-sec-head">Align (to the selection box)</div>
                <div class="gs-align-row">${btn('align-left', '⇤ Left', 'Line up left edges')}${btn('align-hcenter', '↔ Center', 'Line up centres (horizontal)')}${btn('align-right', 'Right ⇥', 'Line up right edges')}</div>
                <div class="gs-align-row">${btn('align-top', '⤒ Top', 'Line up top edges')}${btn('align-vcenter', '↕ Middle', 'Line up centres (vertical)')}${btn('align-bottom', 'Bottom ⤓', 'Line up bottom edges')}</div>
                <div class="gs-align-row">${btn('dist-h', '⋯ Space evenly ↔', 'Same gap between them, left to right (3 or more)')}${btn('dist-v', '⋮ Space evenly ↕', 'Same gap between them, top to bottom (3 or more)')}</div>
                <div class="gs-align-row">${btn('center-page-h', 'Center on page ↔', 'Move the group to the middle of the page')}${btn('center-page-v', 'Center on page ↕', 'Move the group to the middle of the page')}</div>
                ${n > 1 ? `<div class="gs-align-row">${btn('match-w', 'Same width', 'Give all the width of the main one (blue)')}${btn('match-h', 'Same height', 'Give all the height of the main one (blue)')}</div>` : ''}
            </div>`;
            h += `<div class="gs-section"><div class="gs-sec-head">Motion for all ${n}</div>
                ${this.field('Appear', 'multi.motion.intro', same('intro') ? first.intro : '', { type: 'select', options: (same('intro') ? [] : [['', '— mixed —']]).concat(Mo.options(Mo.INTRO, [['auto', 'Follow the menu'], ['none', 'None — no entrance']])) })}
                ${this.field('Loop', 'multi.motion.loop', same('loop') ? first.loop : '', { type: 'select', options: (same('loop') ? [] : [['', '— mixed —']]).concat(Mo.options(Mo.LOOP, [['none', 'None']])) })}
                ${types.includes('button') ? `<div class="gs-grid2">${this.field('Hover (buttons)', 'multi.motion.hover', same('hover') ? first.hover : '', { type: 'select', options: (same('hover') ? [] : [['', '— mixed —']]).concat(Mo.options(Mo.HOVER)) })}${this.field('Click (buttons)', 'multi.motion.press', same('press') ? first.press : '', { type: 'select', options: (same('press') ? [] : [['', '— mixed —']]).concat(Mo.options(Mo.PRESS)) })}</div>` : ''}
                ${this.field('Delay between each (ms) — 0 = all at once', 'multi.stagger', 0, { type: 'number', step: 10, min: 0, hint: 'Sets each one\'s Appear delay so they come in one after another (bottom layer first).' })}
            </div>`;
            h += `<div class="gs-section gs-row-actions">
                    <button class="ghost-btn" data-action="multi-hide"><svg><use href="#g-eye"/></svg><span>Hide all</span></button>
                    <button class="ghost-btn" data-action="duplicate"><svg><use href="#g-copy"/></svg><span>Duplicate</span></button>
                    <button class="ghost-btn danger" data-action="delete"><svg><use href="#g-trash"/></svg><span>Delete ${n}</span></button></div>
                <div class="gs-section gs-note">Ctrl / Shift + click adds or removes one · drag on an empty spot to box-select · Ctrl+A selects all · Esc clears. The blue frame is the main one (used by "Same width / height").</div>`;
            return h;
        },

        /** X / Y of the group, motion for all */
        applyMulti(k, val) {
            const els = this.selElements();
            if (!els.length) return;
            this.checkpoint();
            if (k === 'x' || k === 'y') {
                const b = this.selBounds();
                const d = M.int(val, b[k]) - b[k];
                els.forEach(e => { e[k] += d; });
            } else if (k.startsWith('motion.')) {
                if (val === '') return;
                const mk = k.slice(7);
                els.forEach(e => {
                    if ((mk === 'hover' || mk === 'press') && e.type !== 'button') return;
                    e.motion = Object.assign(GS.Motion.elementDefaults(e.type), e.motion || {});
                    e.motion[mk] = val;
                });
            } else if (k === 'stagger') {
                const gap = Math.max(0, M.int(val, 0));
                els.forEach((e, i) => {
                    e.motion = Object.assign(GS.Motion.elementDefaults(e.type), e.motion || {});
                    e.motion.introDelay = i * gap;
                });
                if (gap) GS.toast(`Delays set: 0, ${gap}, ${gap * 2} … ms`);
            }
            this.changed();
            if (this.previewMode) this.motionReplay();
        },

        /** Align / spread / match the selection */
        arrange(how) {
            const els = this.selElements();
            if (els.length < 1) return;
            const b = this.selBounds(), m = this.menu(), main = this.element();
            this.checkpoint();
            const byX = els.slice().sort((a, c) => a.x - c.x), byY = els.slice().sort((a, c) => a.y - c.y);
            switch (how) {
                case 'align-left': els.forEach(e => { e.x = b.x; }); break;
                case 'align-right': els.forEach(e => { e.x = b.x + b.w - e.w; }); break;
                case 'align-hcenter': els.forEach(e => { e.x = Math.round(b.x + (b.w - e.w) / 2); }); break;
                case 'align-top': els.forEach(e => { e.y = b.y; }); break;
                case 'align-bottom': els.forEach(e => { e.y = b.y + b.h - e.h; }); break;
                case 'align-vcenter': els.forEach(e => { e.y = Math.round(b.y + (b.h - e.h) / 2); }); break;
                case 'dist-h': {
                    if (els.length < 3) { GS.toast('Pick 3 or more to space them evenly'); return; }
                    const gap = (b.w - els.reduce((t, e) => t + e.w, 0)) / (els.length - 1);
                    let x = b.x;
                    byX.forEach(e => { e.x = Math.round(x); x += e.w + gap; });
                    break;
                }
                case 'dist-v': {
                    if (els.length < 3) { GS.toast('Pick 3 or more to space them evenly'); return; }
                    const gap = (b.h - els.reduce((t, e) => t + e.h, 0)) / (els.length - 1);
                    let y = b.y;
                    byY.forEach(e => { e.y = Math.round(y); y += e.h + gap; });
                    break;
                }
                case 'center-page-h': { const d = Math.round((m.width - b.w) / 2) - b.x; els.forEach(e => { e.x += d; }); break; }
                case 'center-page-v': { const d = Math.round((m.height - b.h) / 2) - b.y; els.forEach(e => { e.y += d; }); break; }
                case 'match-w': if (main) els.forEach(e => { e.w = main.w; }); break;
                case 'match-h': if (main) els.forEach(e => { e.h = main.h; }); break;
            }
            this.changed();
        },

        center(axis) {
            if (this.isMulti()) return this.arrange(axis === 'h' ? 'center-page-h' : 'center-page-v');
            const e = this.element(); if (!e) return;
            const m = this.menu();
            this.checkpoint();
            if (axis === 'h') e.x = Math.round((m.width - e.w) / 2);
            else e.y = Math.round((m.height - e.h) / 2);
            this.changed();
        },

        remove() {
            const m = this.menu();
            const ids = this.selIds();
            if (!ids.length) return;
            this.checkpoint();
            m.elements = m.elements.filter(e => !ids.includes(e.id));
            this.setSel([]);
            this.changed();
        },

        duplicate() {
            const els = this.selElements();
            if (!els.length) return;
            const m = this.menu();
            this.checkpoint();
            const made = [];
            // copies go right above the topmost original, in the same order
            const top = Math.max(...els.map(e => m.elements.indexOf(e)));
            const copies = els.map(e => {
                const c = JSON.parse(JSON.stringify(e));
                c.id = M.uid(e.type[0]);
                c.x += 6; c.y += 6;
                c.name = (e.name || e.type) + ' copy';
                made.push(c.id);
                return c;
            });
            m.elements.splice(top + 1, 0, ...copies);
            this.setSel(made);
            this.changed();
        },

        copy() {
            const els = this.selElements();
            if (!els.length) return;
            this.clipboard = JSON.stringify(els);
            GS.toast(els.length > 1 ? `Copied ${els.length}` : 'Copied');
        },
        paste() {
            if (!this.clipboard) return;
            let list = JSON.parse(this.clipboard);
            if (!Array.isArray(list)) list = [list];
            const m = this.menu();
            const x0 = Math.min(...list.map(c => c.x)), y0 = Math.min(...list.map(c => c.y));
            const w = Math.max(...list.map(c => c.x + c.w)) - x0, h = Math.max(...list.map(c => c.y + c.h)) - y0;
            const dx = Math.min(x0 + 6, Math.max(0, m.width - w)) - x0, dy = Math.min(y0 + 6, Math.max(0, m.height - h)) - y0;
            this.checkpoint();
            const made = list.map(c => {
                c.id = M.uid(c.type[0]);
                c.x += dx; c.y += dy;
                m.elements.push(c);
                return c.id;
            });
            this.setSel(made);
            this.changed();
        },

        layer(dir) {
            const m = this.menu();
            const ids = this.selIds();
            if (!ids.length) return;
            const idx = m.elements.map((e, i) => ids.includes(e.id) ? i : -1).filter(i => i >= 0);
            if (dir > 0 ? idx[idx.length - 1] >= m.elements.length - 1 : idx[0] <= 0) return;
            this.checkpoint();
            // move each selected one step, starting from the end it moves toward
            (dir > 0 ? idx.slice().reverse() : idx).forEach(i => {
                const j = i + dir;
                [m.elements[i], m.elements[j]] = [m.elements[j], m.elements[i]];
            });
            this.changed();
        },

        nudge(dx, dy) {
            const els = this.selElements();
            if (!els.length) return;
            this.checkpoint();
            els.forEach(e => { e.x += dx; e.y += dy; });
            this.changed();
        },

        /* ───────────── menu pages ───────────── */

        selectMenu(i) {
            this.menuIndex = M.clamp(i, 0, this.project.menus.length - 1);
            this.selected = null;
            this.propsMode = null;
            this.renderAll();
            this.zoomFit();
        },

        uniqueMenuId(base) {
            let id = M.slug(base, 'menu'), n = 2;
            while (this.project.menus.some(m => m.id === id)) id = `${M.slug(base, 'menu')}_${n++}`;
            return id;
        },

        addMenu() {
            this.checkpoint();
            const id = this.uniqueMenuId('menu');
            const cur = this.menu();
            const m = M.newMenu(id, 'New Menu');
            m.width = cur.width; m.height = cur.height;
            m.fullscreen = !!cur.fullscreen;
            this.project.menus.push(m);
            this.menuIndex = this.project.menus.length - 1;
            this.selected = null;
            this.changed();
        },

        duplicateMenu() {
            const cur = this.menu();
            const c = JSON.parse(JSON.stringify(cur));
            c.id = this.uniqueMenuId(cur.id + '_copy');
            c.title = cur.title + ' (copy)';
            c.command = '';
            c.elements.forEach(e => { e.id = M.uid(e.type[0]); });
            this.checkpoint();
            this.project.menus.splice(this.menuIndex + 1, 0, c);
            this.menuIndex++;
            this.selected = null;
            this.changed();
        },

        async deleteMenu() {
            if (this.project.menus.length <= 1) { GS.toast('A project needs at least one menu', 'error'); return; }
            const m = this.menu();
            if (!(await window.kzConfirm(`Delete menu "${m.title || m.id}" and its ${m.elements.length} elements?`))) return;
            this.checkpoint();
            this.project.menus.splice(this.menuIndex, 1);
            this.fixSelection();
            this.selected = null;
            this.changed();
        },

        /* ───────────── zoom ───────────── */

        applyZoom() {
            const m = this.menu();
            const world = $('#gs-world');
            world.style.width = Math.ceil(m.width * this.zoom) + 'px';
            world.style.height = Math.ceil(m.height * this.zoom) + 'px';
            // room around the page (half the view on each side) so zooming at the mouse can
            // always keep that point under it, also near the edges
            const pb = $('#gs-pasteboard');
            if (pb && pb.clientWidth) world.style.margin = `${Math.round(pb.clientHeight / 2)}px ${Math.round(pb.clientWidth / 2)}px`;
            $('#gs-screen').style.transform = `scale(${this.zoom})`;
            $('#gs-screen').style.setProperty('--z', this.zoom);
        },
        setZoom(z) {
            const before = this.zoom;
            this.zoom = M.clamp(Math.round(z * 100) / 100, 0.5, 8);
            // studio-made 2D art is redrawn sharp for the new zoom
            if (before !== this.zoom && this.menu().elements.some(e => e.gen && e.gen.opts && e.gen.opts.look !== 'pixel')) this.renderCanvas();
            else this.applyZoom();
            this.renderStatus();
        },
        /** Zoom keeping the point under the mouse where it is */
        zoomAt(z, cx, cy) {
            const screen = $('#gs-screen'), pb = $('#gs-pasteboard');
            const r0 = screen.getBoundingClientRect();
            const gx = (cx - r0.left) / this.zoom, gy = (cy - r0.top) / this.zoom;
            this.setZoom(z);
            const r1 = screen.getBoundingClientRect();
            pb.scrollLeft += (r1.left + gx * this.zoom) - cx;
            pb.scrollTop += (r1.top + gy * this.zoom) - cy;
        },
        zoomStep(dir) {
            const pb = $('#gs-pasteboard');
            const r = pb.getBoundingClientRect();
            const before = this.zoom;
            this._zoomStep(dir);
            const after = this.zoom;
            if (after !== before) { this.zoom = before; this.zoomAt(after, r.left + r.width / 2, r.top + r.height / 2); }
        },
        _zoomStep(dir) {
            const steps = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
            let i = steps.findIndex(s => s >= this.zoom - 0.001);
            if (i < 0) i = steps.length - 1;
            if (dir > 0) i = Math.min(steps.length - 1, steps[i] > this.zoom + 0.001 ? i : i + 1);
            else i = Math.max(0, steps[i] < this.zoom - 0.001 ? i : i - 1);
            this.setZoom(steps[i]);
        },
        zoomFit() {
            const pb = $('#gs-pasteboard');
            const m = this.menu();
            if (!pb || !pb.clientWidth) return;
            const z = Math.min((pb.clientWidth - 80) / m.width, (pb.clientHeight - 80) / m.height);
            this.setZoom(Math.max(0.5, Math.floor(z * 4) / 4));
            this.applyZoom();
            // the page in the middle of the view
            pb.scrollLeft = (pb.scrollWidth - pb.clientWidth) / 2;
            pb.scrollTop = (pb.scrollHeight - pb.clientHeight) / 2;
        },

        /* ───────────── canvas input ───────────── */

        bindCanvas() {
            if (this._bound) return;
            this._bound = true;
            const screen = $('#gs-screen');
            const pb = $('#gs-pasteboard');

            const toLocal = (ev) => {
                const r = screen.getBoundingClientRect();
                return { x: (ev.clientX - r.left) / this.zoom, y: (ev.clientY - r.top) / this.zoom };
            };

            pb.addEventListener('mousedown', (ev) => {
                if (ev.button !== 0) return;
                if (this.previewMode) { if (!this.dollGrab(ev, toLocal(ev))) this.previewClick(toLocal(ev)); return; }
                if (ev.target.closest('.gs-turn')) { this.dragTurn(ev); return; }
                const handle = ev.target.closest('.gs-handle');
                const elDiv = ev.target.closest('.gs-el');
                const additive = ev.ctrlKey || ev.shiftKey || ev.metaKey;
                let id = handle ? this.selected : elDiv && elDiv.dataset.id;
                if (!handle && elDiv && ev.altKey) {
                    // Alt+click: the next element underneath the one selected (cycles through the stack)
                    const pt = toLocal(ev);
                    const under = this.menu().elements.filter(e => !e.hidden && pt.x >= e.x && pt.y >= e.y && pt.x < e.x + e.w && pt.y < e.y + e.h).reverse();
                    const i = under.findIndex(e => e.id === this.selected);
                    if (under.length) id = under[(i + 1) % under.length].id;
                }
                if (!id) { this.marquee(ev, toLocal, additive); return; }
                // Ctrl / Shift + click: add to or take out of the selection
                if (!handle && additive) {
                    this.toggleSel(id);
                    this.renderAll();
                    if (!this.isSel(id)) return;
                } else if (!this.isSel(id)) {
                    this.setSel([id]);
                    this.renderAll();
                }
                const e = this.element(id);
                const group = handle ? [e] : this.selElements();
                const start = toLocal(ev);
                const origs = new Map(group.map(g => [g.id, { x: g.x, y: g.y, w: g.w, h: g.h }]));
                const orig = origs.get(e.id);
                const mode = handle ? handle.dataset.handle : 'move';
                let moved = false;
                const snap = (v) => this.snap ? Math.round(v / 4) * 4 : Math.round(v);
                const onMove = (mv) => {
                    const p = toLocal(mv);
                    const dx = p.x - start.x, dy = p.y - start.y;
                    if (!moved && Math.abs(dx) * this.zoom < 3 && Math.abs(dy) * this.zoom < 3) return;
                    if (!moved) { this.checkpoint(); moved = true; }
                    if (mode === 'move') {
                        // the element under the mouse snaps; the others move by the same amount
                        const ddx = snap(orig.x + dx) - orig.x, ddy = snap(orig.y + dy) - orig.y;
                        group.forEach(g => { const o = origs.get(g.id); g.x = o.x + ddx; g.y = o.y + ddy; });
                    } else {
                        let { x, y, w, h } = orig;
                        if (mode.includes('e')) w = Math.max(1, snap(orig.w + dx));
                        if (mode.includes('s')) h = Math.max(1, snap(orig.h + dy));
                        if (mode.includes('w')) { const nx = snap(orig.x + dx); w = Math.max(1, orig.x + orig.w - nx); x = orig.x + orig.w - w; }
                        if (mode.includes('n')) { const ny = snap(orig.y + dy); h = Math.max(1, orig.y + orig.h - ny); y = orig.y + orig.h - h; }
                        if (mv.shiftKey && (e.image && this.project.images[e.image])) {
                            const im = this.project.images[e.image];
                            h = Math.max(1, Math.round(w * im.h / im.w));
                        }
                        Object.assign(e, { x, y, w, h });
                    }
                    this.renderCanvas();
                    this.renderStatus();
                };
                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    if (moved) this.changed();
                    else if (!handle && !additive && this.isMulti()) {
                        // a plain click (no drag) on one of many: select just that one
                        this.setSel([id]);
                        this.renderAll();
                    }
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            pb.addEventListener('mousemove', (ev) => {
                const p = toLocal(ev);
                const m = this.menu();
                const inside = p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
                $('#gs-sb-cursor').textContent = inside ? `${Math.floor(p.x)}, ${Math.floor(p.y)}` : '';
                if (this.previewMode) {
                    const c = $('#gs-cursor');
                    c.style.left = M.clamp(p.x, 0, m.width) + 'px';
                    c.style.top = M.clamp(p.y, 0, m.height) + 'px';
                    this.previewHover(p);
                    this.dollsFollow(p);
                }
            });

            // mouse wheel = zoom at the mouse (Shift + wheel = scroll sideways)
            pb.addEventListener('wheel', (ev) => {
                if (ev.shiftKey && !ev.ctrlKey) return;
                ev.preventDefault();
                const dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;   // lines → pixels
                if (!dy) return;
                const f = Math.pow(1.0018, -Math.max(-240, Math.min(240, dy)));  // one notch ≈ ×1.2
                this.zoomAt(this.zoom * f, ev.clientX, ev.clientY);
            }, { passive: false });

            // pan: middle mouse button, or Space + drag
            let space = false;
            document.addEventListener('keydown', (ev) => {
                if (ev.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || '') && !document.querySelector('.gs-modal')) {
                    if (!space) { space = true; pb.classList.add('panning'); }
                    ev.preventDefault();
                }
            });
            document.addEventListener('keyup', (ev) => { if (ev.code === 'Space') { space = false; pb.classList.remove('panning'); } });
            pb.addEventListener('mousedown', (ev) => {
                if (!(ev.button === 1 || (ev.button === 0 && space))) return;
                ev.preventDefault();
                ev.stopImmediatePropagation();
                const sx = ev.clientX, sy = ev.clientY, sl = pb.scrollLeft, st = pb.scrollTop;
                pb.classList.add('grabbing');
                const mv = (m) => { pb.scrollLeft = sl - (m.clientX - sx); pb.scrollTop = st - (m.clientY - sy); };
                const up = () => { pb.classList.remove('grabbing'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
                window.addEventListener('mousemove', mv);
                window.addEventListener('mouseup', up);
            }, true);

            // pages
            $('#gs-page-list').addEventListener('click', (ev) => {
                const li = ev.target.closest('li[data-i]');
                if (li) this.selectMenu(Number(li.dataset.i));
            });
            $('#gs-page-list').addEventListener('dblclick', async (ev) => {
                const li = ev.target.closest('li[data-i]');
                if (!li) return;
                const m = this.project.menus[Number(li.dataset.i)];
                const t = await window.kzPrompt('Menu title', m.title);
                if (t == null) return;
                this.checkpoint(); m.title = t; this.changed();
            });

            // layers
            $('#gs-layer-list').addEventListener('click', (ev) => {
                const eye = ev.target.closest('[data-eye]');
                if (eye) {
                    const e = this.element(eye.dataset.eye);
                    if (e) { this.checkpoint(); e.hidden = !e.hidden; this.changed(); }
                    return;
                }
                const li = ev.target.closest('li[data-id]');
                if (!li) return;
                const id = li.dataset.id;
                if (ev.ctrlKey || ev.metaKey) this.toggleSel(id);
                else if (ev.shiftKey && this.selected) {
                    // Shift: everything between the main selection and this one
                    const ids = this.menu().elements.map(e => e.id);
                    const a = ids.indexOf(this.selected), b = ids.indexOf(id);
                    const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
                    this.setSel([...new Set(this.selIds().concat(range))], id);
                } else this.setSel([id]);
                this.renderAll();
            });

            // properties
            const props = $('#gs-props');
            props.addEventListener('change', (ev) => {
                const k = ev.target.dataset && ev.target.dataset.k;
                if (!k) return;
                if (k.startsWith('multi.')) return this.applyMulti(k.slice(6), ev.target.value);
                this.applyField(k, ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value, ev.target.type === 'checkbox');
            });
            props.addEventListener('click', (ev) => {
                const pick = ev.target.closest('[data-pick]');
                if (pick) return this.setImage(pick.dataset.pick);
                const gpick = ev.target.closest('[data-gen-pick]');
                if (gpick) return this.shapeForButton(gpick.dataset.genPick);
                const clear = ev.target.closest('[data-clear]');
                if (clear) return this.clearImage(clear.dataset.clear);
                const fdel = ev.target.closest('[data-frame-del]');
                if (fdel) return this.removeFrame(Number(fdel.dataset.frameDel));
                const act = ev.target.closest('[data-action]');
                if (!act) return;
                const a = act.dataset.action;
                if (a === 'fit-image') this.fitImage();
                else if (a === 'add-frames') this.addFrames();
                else if (a === 'clear-frames') this.clearFrames();
                else if (a === 'play-motion') this.playMotion();
                else if (a === 'edit-gen') this.editGenerated();
                else if (a === 'pick-item') this.pickItem();
                else if (a === 'fs-this' || a === 'fs-all') {
                    this.checkpoint();
                    (a === 'fs-all' ? this.project.menus : [this.menu()]).forEach(mm => { mm.fullscreen = true; });
                    this.changed();
                }
                else if (/^(align-|dist-|center-page-|match-)/.test(a)) this.arrange(a);
                else if (a === 'multi-hide') { this.checkpoint(); this.selElements().forEach(e => { e.hidden = true; }); this.setSel([]); this.changed(); }
                else if (a === 'duplicate') this.duplicate();
                else if (a === 'delete') this.remove();
                else if (a === 'close-cursor') { this.propsMode = null; this.renderProps(); }
            });

            $('#gs-namespace').addEventListener('change', (ev) => {
                const v = M.slug(ev.target.value, 'kaizerui');
                ev.target.value = v;
                if (v === this.project.namespace) return;
                this.checkpoint(); this.project.namespace = v; this.changed();
            });
            $('#gs-platform').addEventListener('click', (ev) => {
                const b = ev.target.closest('[data-platform]');
                if (!b) return;
                this.platform = b.dataset.platform;
                this.renderCanvas(); this.renderStatus();
            });
        },

        /* ───────────── Player Model in 3D: angle, drag to turn, live turning in Preview ───────────── */

        /** How a Player Model is drawn now: its Angle, or in Preview what the game would show */
        dollView(e) {
            if (e.java3d === false) return { yaw: 0 };       // flat skin in game: just the front
            const live = this.previewMode && this._dolls && this._dolls[e.id];
            return Object.assign({ yaw: M.num(e.angle, 0), headYaw: 0, headPitch: 0 }, live || {});
        },
        redrawDoll(e) {
            const cv = document.querySelector(`#gs-elements .gs-el[data-id="${e.id}"] canvas.gs-doll`);
            if (cv && GS.Items) GS.Items.drawPlayer(cv, this.dollView(e));
        },
        /** Drag the round handle under a selected Player Model: left / right turns it (360°) */
        dragTurn(ev) {
            const e = this.element();
            if (!e || e.type !== 'player_model') return;
            ev.preventDefault();
            const x0 = ev.clientX, a0 = M.num(e.angle, 0);
            let moved = false;
            const wrapDeg = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return Math.round(a); };
            const onMove = (mv) => {
                const dx = mv.clientX - x0;
                if (!moved && Math.abs(dx) < 2) return;
                if (!moved) { this.checkpoint(); moved = true; }
                e.angle = wrapDeg(a0 - dx * 1.2);      // drag right = the front turns right
                this.redrawDoll(e);
                const inp = document.getElementById('gsf-angle');
                if (inp) inp.value = e.angle;
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                if (moved) { this.changed(); this.renderProps && this.renderProps(); }
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        },
        /**
         * Preview, Turn = drag: press on the player and move to turn it; let go = drop it.
         * A click without moving keeps holding it (like in game on Java) until the next click.
         */
        dollGrab(ev, p) {
            if (this._grab) { if (this._grab.stopMove) this._grab.stopMove(); this._grab = null; return true; }   // second click drops it
            const e = this.menu().elements.slice().reverse().find(x => x.type === 'player_model' && !x.hidden && x.turn === 'drag'
                && p.x >= x.x && p.y >= x.y && p.x < x.x + x.w && p.y < x.y + x.h);
            if (!e) return false;
            this._dolls = this._dolls || {};
            const yaw0 = (this._dolls[e.id] && this._dolls[e.id].yaw != null) ? this._dolls[e.id].yaw : M.num(e.angle, 0);
            const grab = this._grab = { id: e.id, x: ev.clientX, yaw0, moved: false };
            const onMove = (mv) => {
                if (this._grab !== grab) return;
                const dx = mv.clientX - grab.x;
                if (Math.abs(dx) > 2) grab.moved = true;
                this._dolls[e.id] = { yaw: grab.yaw0 - dx * 1.2 };      // drag right = the front turns right
                this.redrawDoll(e);
            };
            const onUp = () => {
                window.removeEventListener('mouseup', onUp);
                if (grab.moved) { window.removeEventListener('mousemove', onMove); if (this._grab === grab) this._grab = null; }
                else grab.stopMove = () => window.removeEventListener('mousemove', onMove);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            return true;
        },
        /** Preview: models with Turn = cursor / mouse follow the cursor like in game */
        dollsFollow(p) {
            const m = this.menu();
            this._dolls = this._dolls || {};
            m.elements.forEach(e => {
                if (e.type !== 'player_model' || e.hidden) return;
                const base = M.num(e.angle, 0);
                if (e.turn === 'mouse') {
                    // the whole player turns as the cursor moves over the menu: one side to the other = a full turn
                    const rel = M.clamp((p.x - (e.x + e.w / 2)) / Math.max(1, m.width / 2), -1, 1);
                    this._dolls[e.id] = { yaw: base - rel * 180 };   // the front follows the cursor's side
                } else if (e.turn === 'cursor') {
                    // the head looks at the cursor (up to 60° aside, 50° up / down)
                    const hx = e.x + e.w / 2, hy = e.y + e.h * 0.12;
                    const dist = Math.max(e.h, 40);
                    const yawTo = Math.atan2(p.x - hx, dist) * 180 / Math.PI;
                    const pitchTo = Math.atan2(p.y - hy, dist) * 180 / Math.PI;
                    this._dolls[e.id] = { yaw: base, headYaw: M.clamp(-yawTo, -60, 60), headPitch: M.clamp(-pitchTo, -50, 50) };
                } else return;
                this.redrawDoll(e);
            });
        },
        /** Preview: spinning models keep turning */
        dollsSpin() {
            if (this._dollRaf) cancelAnimationFrame(this._dollRaf);
            this._dollRaf = 0;
            this._dolls = {};
            if (!this.previewMode && this._grab) { if (this._grab.stopMove) this._grab.stopMove(); this._grab = null; }
            if (!this.previewMode) return;
            const spin = this.menu().elements.filter(e => e.type === 'player_model' && !e.hidden && e.turn === 'spin');
            if (!spin.length) return;
            const t0 = performance.now();
            const tick = (now) => {
                if (!this.previewMode) { this._dollRaf = 0; return; }
                spin.forEach(e => {
                    this._dolls[e.id] = { yaw: M.num(e.angle, 0) + M.num(e.spinSpeed, 45) * (now - t0) / 1000 };
                    this.redrawDoll(e);
                });
                this._dollRaf = requestAnimationFrame(tick);
            };
            this._dollRaf = requestAnimationFrame(tick);
        },

        /* ───────────── play preview ───────────── */

        hitTest(p) {
            const els = this.menu().elements;
            for (let i = els.length - 1; i >= 0; i--) {
                const e = els[i];
                if (e.hidden || e.type !== 'button') continue;
                if (p.x >= e.x && p.y >= e.y && p.x < e.x + e.w && p.y < e.y + e.h) return e;
            }
            return null;
        },
        previewHover(p) {
            const hit = this.hitTest(p);
            $$('#gs-elements .gs-el').forEach(d => d.classList.toggle('hover', !!hit && d.dataset.id === hit.id));
            if (this._mo) this._mo.hovered = hit ? hit.id : null;
        },
        previewClick(p) {
            const hit = this.hitTest(p);
            if (!hit) return;
            if (this._mo) this._mo.press[hit.id] = this._mo.now();
            const acts = (hit.actions || []).map(a => String(a).trim());
            const open = acts.map(a => /^open:(.+)$/.exec(a)).find(Boolean);
            const others = acts.filter(a => !/^open:/.test(a));
            if (others.length) GS.toast(others.join('  ·  '));
            if (open) {
                const i = this.project.menus.findIndex(m => m.id === open[1].trim());
                if (i >= 0) { this.menuIndex = i; this.renderAll(); this.zoomFit(); }
                else GS.toast(`Menu "${open[1]}" does not exist`, 'error');
            } else if (hit.closeOnClick || acts.includes('close')) GS.toast('(menu closes)');
        },
        /* ───────────── motion preview (same presets as the game) ───────────── */

        /** Starts (or keeps) the animation loop for the page on the canvas */
        motionAttach() {
            const m = this.menu();
            const replay = !this._mo || this._mo.menu !== m.id || this._mo.replay;
            const els = new Map($$('#gs-elements .gs-el').map(d => [d.dataset.id, d]));
            if (!replay) { Object.assign(this._mo, { els, clips: GS.Motion.resolve(m), frame: {} }); return; }
            const old = this._mo;
            const mo = this._mo = {
                menu: m.id, els, clips: GS.Motion.resolve(m), t0: performance.now(), hovered: old ? old.hovered : null,
                hw: {}, press: {}, frame: {}, last: performance.now(), replay: false,
                now() { return (performance.now() - this.t0) / 1000; }
            };
            if (old && old.raf) cancelAnimationFrame(old.raf);
            const tick = () => {
                if (this._mo !== mo) return;
                this.motionFrame(mo);
                mo.raf = requestAnimationFrame(tick);
            };
            tick();
        },
        motionReplay() { if (this._mo) this._mo.replay = true; this.renderCanvas(); },
        motionStop() {
            if (!this._mo) return;
            if (this._mo.raf) cancelAnimationFrame(this._mo.raf);
            this._mo = null;
            const w = $('#gs-elements');
            if (w) { w.style.transform = ''; w.style.opacity = ''; }
        },
        motionFrame(mo) {
            const Mo = GS.Motion, m = this.menu();
            const t = mo.now();
            const dt = Math.min(0.1, (performance.now() - mo.last) / 1000);
            mo.last = performance.now();
            const wrap = $('#gs-elements');
            const open = Mo.sample(mo.clips.open, t);
            const piv = (mo.clips.open && mo.clips.open.pivot) || [0.5, 0.5];
            wrap.style.transformOrigin = `${piv[0] * 100}% ${piv[1] * 100}%`;
            wrap.style.transform = Mo.css(open);
            wrap.style.opacity = String(open.alpha / 100);
            if (m.fullscreen) {
                const a = M.clamp(M.num(m.backdropAlpha, 0.6), 0, 1) * open.alpha / 100;
                const [r, g, b] = (m.backdrop || '#000000').replace('#', '').match(/../g).map(x => parseInt(x, 16));
                $('#gs-screen').style.setProperty('--backdrop', `rgba(${r},${g},${b},${a})`);
            }
            m.elements.forEach(e => {
                const d = mo.els.get(e.id);
                if (!d) return;
                const c = mo.clips.elements[e.id] || {};
                let st = Mo.rest();
                if (c.intro) st = Mo.combine(st, Mo.sample(c.intro, t));
                if (c.loop && t >= c.loop.delay) st = Mo.combine(st, Mo.sample(c.loop, t));
                if (c.hover) {
                    const target = mo.hovered === e.id ? 1 : 0;
                    let w = mo.hw[e.id] || 0;
                    const step = c.hover.length > 0 ? dt / c.hover.length : 1;
                    w = target > w ? Math.min(1, w + step) : Math.max(0, w - step);
                    mo.hw[e.id] = w;
                    st = Mo.combine(st, Mo.hoverState(c.hover, w));
                }
                if (c.press && mo.press[e.id] != null) {
                    const pt = t - mo.press[e.id];
                    if (pt > c.press.length) delete mo.press[e.id];
                    else st = Mo.combine(st, Mo.sample(c.press, pt));
                }
                const p = (c.intro && c.intro.pivot) || [0.5, 0.5];
                d.style.transformOrigin = `${p[0] * 100}% ${p[1] * 100}%`;
                d.style.transform = Mo.css(st);
                d.style.opacity = String(Math.max(0, Math.min(1, st.alpha / 100)));
                // animated picture
                if (e.frames && e.frames.length && e.image) {
                    const all = [e.image].concat(e.frames);
                    const fi = Math.floor(t * (e.fps || 8)) % all.length;
                    if (mo.frame[e.id] !== fi) {
                        mo.frame[e.id] = fi;
                        const url = this.imageUrl(all[fi]);
                        if (url) d.style.backgroundImage = `url("${url}")`;
                    }
                }
            });
        },
        /** ▶ Play: preview mode, from the start */
        playMotion() {
            if (!this.previewMode) {
                this.previewMode = true;
                this.renderStatus();
            }
            if (this._mo) this._mo.replay = true;
            this.renderCanvas();
        },

        togglePreview() {
            this.previewMode = !this.previewMode;
            this.renderCanvas();
            this.renderStatus();
            if (this.previewMode) GS.toast('Preview: hover and click the buttons. Press P or Esc to edit again.');
        }
    };

    GS.Editor = Editor;
    GS.mcToHtml = mcToHtml;
})();
