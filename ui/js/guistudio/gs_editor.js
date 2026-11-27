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
        propTab: 'general',
        previewMode: false,
        previewHistory: [],
        previewVars: {},
        previewScroll: {},
        previewSpins: {},
        platform: 'java',
        clipboard: null,
        onChange: null,          // set by shell: marks the document dirty

        init(project) {
            this.project = M.normalize(project || M.newProject());
            this.history.clear();
            this.menuIndex = 0;
            this.selected = null;
            this.previewVars = {};
            if (GS.CustomAssets && !this._caHooked) {
                this._caHooked = true;
                GS.CustomAssets.onUpdate(() => {
                    if (this._caTimer) return;
                    this._caTimer = setTimeout(() => { this._caTimer = 0; this.renderCanvas(); }, 80);
                });
                GS.CustomAssets.ensureLoaded();
            }
            this.bindCanvas();
            this.renderAll();
            requestAnimationFrame(() => this.zoomFit());
        },

        load(project) {
            this.project = M.normalize(project);
            this.history.clear();
            this.menuIndex = 0;
            this.selected = null;
            this.previewVars = {};
            this.renderAll();
            this.zoomFit();
        },

        resolvePreviewVars(text, varsOverride) {
            let s = samplePapi(text);
            if (!s.includes('{')) return s;
            const vars = Object.create(null);
            (this.project && this.project.menus || []).forEach(mm => {
                (mm.elements || []).forEach(el => {
                    if (el.type === 'input' && el.varName && !(el.varName in vars)) {
                        vars[el.varName] = el.defaultValue == null ? '1' : String(el.defaultValue);
                    }
                });
            });
            Object.entries(this.previewVars || {}).forEach(([k, v]) => { vars[k] = String(v); });
            if (varsOverride) Object.entries(varsOverride).forEach(([k, v]) => { vars[k] = String(v); });
            const fmtNum = (n) => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
            const lookup = (tok) => {
                if (tok in vars) return vars[tok];
                if (/^-?\d+(\.\d+)?$/.test(tok)) return tok;
                return null;
            };
            for (let pass = 0; pass < 2; pass++) {
                s = s.replace(/\{([^{}]+)\}/g, (full, expr) => {
                    const t = expr.trim();
                    const direct = lookup(t);
                    if (direct != null) return direct;
                    const m = /^([A-Za-z0-9_.\-]+)\s*([+\-*/])\s*([A-Za-z0-9_.\-]+)$/.exec(t);
                    if (m) {
                        const la = lookup(m[1]), lb = lookup(m[3]);
                        if (la != null && lb != null) {
                            const a = Number(la), b = Number(lb);
                            if (Number.isFinite(a) && Number.isFinite(b)) {
                                if (m[2] === '+') return fmtNum(a + b);
                                if (m[2] === '-') return fmtNum(a - b);
                                if (m[2] === '*') return fmtNum(a * b);
                                if (m[2] === '/') return b === 0 ? '0' : fmtNum(a / b);
                            }
                        }
                    }
                    return full;
                });
            }
            return s;
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

        scrollOffset(areaId) {
            const o = (this.previewScroll && this.previewScroll[areaId]) || null;
            return o ? { x: Number(o.x) || 0, y: Number(o.y) || 0 } : { x: 0, y: 0 };
        },
        scrollAreaOf(e) {
            if (!e || !e.scrollGroup) return null;
            return this.menu().elements.find(a => a.id === e.scrollGroup && a.type === 'scroll_area' && !a.hidden) || null;
        },
        effectivePos(e) {
            const area = this.scrollAreaOf(e);
            if (!area) return { x: e.x, y: e.y, area: null };
            const off = this.scrollOffset(area.id);
            return { x: e.x - off.x, y: e.y - off.y, area, off };
        },
        fitRouletteFrame(e) {
            if (!e || e.type !== 'roulette') return;
            const m = this.menu();
            const style = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(e.spinStyle) ? e.spinStyle : 'csgo';
            const slot = Math.max(16, M.int(e.slotSize, 44));
            const gap = Math.max(0, M.int(e.slotGap, 6));
            const reels = M.clamp(M.int(e.reels, 3), 1, 5);
            const cards = M.clamp(M.int(e.cardCount, 5), 3, 9);
            let targetW, targetH;
            if (style === 'slot_v') {
                targetW = reels * slot + (reels - 1) * gap + 20;
                targetH = slot * 3 + gap * 2 + 16;
            } else if (style === 'flash' || style === 'flip') {
                const rows = cards >= 6 ? 2 : 1;
                const cols = Math.ceil(cards / rows);
                targetW = cols * slot + (cols - 1) * gap + 24;
                targetH = rows * slot + (rows - 1) * gap + 24;
            } else {
                targetW = slot * 5 + gap * 4 + 16;
                targetH = slot + 14;
            }
            const maxW = Math.max(48, m.width - 12);
            const maxH = Math.max(36, m.height - 12);
            const w = M.clamp(Math.round(targetW), 48, maxW);
            const h = M.clamp(Math.round(targetH), 36, maxH);
            const cx = e.x + e.w / 2;
            const cy = e.y + e.h / 2;
            e.w = w;
            e.h = h;
            e.x = M.clamp(Math.round(cx - w / 2), 0, Math.max(0, m.width - w));
            e.y = M.clamp(Math.round(cy - h / 2), 0, Math.max(0, m.height - h));
        },
        rouletteGridLayout(e, count, slotW, gap) {
            const rows = count >= 6 ? 2 : 1;
            const colsTop = Math.ceil(count / rows);
            const availW = Math.max(24, e.w - 16);
            const availH = Math.max(24, e.h - 14);
            const maxCardW = Math.floor((availW - (colsTop - 1) * gap) / colsTop);
            const maxCardH = Math.floor((availH - (rows - 1) * gap) / rows);
            const size = Math.max(14, Math.min(slotW, maxCardW, maxCardH));
            const totalH = rows * size + (rows - 1) * gap;
            const startY = (e.h - totalH) * 0.5;
            const boxes = [];
            for (let idx = 0; idx < count; idx++) {
                const row = idx < colsTop ? 0 : 1;
                const rowCols = row === 0 ? colsTop : (count - colsTop);
                const col = row === 0 ? idx : (idx - colsTop);
                const rowW = rowCols * size + (rowCols - 1) * gap;
                const startX = (e.w - rowW) * 0.5;
                boxes.push({
                    x: Math.round(startX + col * (size + gap)),
                    y: Math.round(startY + row * (size + gap)),
                    size
                });
            }
            return boxes;
        },
        renderRoulette(d, e) {
            d.innerHTML = '';
            d.style.background = e.bgColor || '#0d111a';
            d.style.border = `1px solid ${e.borderColor || '#e5a43a'}`;
            const rewards = Array.isArray(e.rewards) && e.rewards.length ? e.rewards : [{ name: 'Prize', item: 'minecraft:diamond', color: '#3b82f6' }];
            const style = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(e.spinStyle) ? e.spinStyle : 'csgo';
            const slotW = Math.max(16, M.int(e.slotSize, 44));
            const gap = Math.max(0, M.int(e.slotGap, 6));
            const step = slotW + gap;
            const reels = M.clamp(M.int(e.reels, 3), 1, 5);
            const cardCount = M.clamp(M.int(e.cardCount, 5), 3, 9);
            const track = document.createElement('div');
            track.className = 'gs-roulette-track';
            const spinState = this.previewMode && this.previewSpins && this.previewSpins[e.id];
            const makeCardDom = (rw) => {
                const card = document.createElement('div');
                card.className = 'gs-roulette-card';
                card.innerHTML = `<i style="background:${esc(rw.color || '#3b82f6')}"></i>`;
                const u = GS.Items && GS.Items.url(rw.item);
                if (u) {
                    const im = document.createElement('img');
                    im.src = u;
                    card.appendChild(im);
                }
                const sp = document.createElement('span');
                sp.textContent = String(rw.name || rw.item || '').replace(/^minecraft:/, '');
                card.appendChild(sp);
                return card;
            };
            const makeMysteryCardDom = () => {
                const card = document.createElement('div');
                card.className = 'gs-roulette-card mystery';
                card.innerHTML = `<i style="background:${esc(e.borderColor || '#e5a43a')}"></i><div class="gs-roulette-q">?</div>`;
                return card;
            };

            if (style === 'flash') {
                const boxes = this.rouletteGridLayout(e, cardCount, slotW, gap);
                const board = (spinState && Array.isArray(spinState.board) && spinState.board.length === cardCount)
                    ? spinState.board
                    : Array.from({ length: cardCount }, (_, i) => rewards[i % rewards.length]);
                boxes.forEach((b, idx) => {
                    const card = makeCardDom(board[idx]);
                    const lit = spinState ? (spinState.litIdx === idx) : (idx === 0);
                    if (spinState) card.classList.add(lit ? 'lit' : 'dim');
                    Object.assign(card.style, {
                        left: b.x + 'px',
                        top: b.y + 'px',
                        width: b.size + 'px',
                        height: b.size + 'px',
                        transform: lit ? 'scale(1.08)' : (spinState ? 'scale(0.95)' : 'scale(1)')
                    });
                    track.appendChild(card);
                });
                d.appendChild(track);
            } else if (style === 'flip') {
                const boxes = this.rouletteGridLayout(e, cardCount, slotW, gap);
                boxes.forEach((b, idx) => {
                    const cState = spinState && spinState.cards && spinState.cards[idx];
                    const revealed = !!(cState && cState.revealed);
                    const rw = (cState && cState.rw) || rewards[idx % rewards.length];
                    const card = revealed ? makeCardDom(rw) : makeMysteryCardDom();
                    const sx = cState && cState.scaleX != null ? cState.scaleX : 1;
                    const lit = !!(cState && cState.lit);
                    const dim = !!(cState && cState.dim);
                    if (lit) card.classList.add('lit');
                    else if (dim) card.classList.add('dim');
                    const sy = (lit && revealed) ? 1.08 : 1;
                    const scaleXVal = (lit && revealed) ? sx * 1.08 : sx;
                    Object.assign(card.style, {
                        left: b.x + 'px',
                        top: b.y + 'px',
                        width: b.size + 'px',
                        height: b.size + 'px',
                        transform: `scale(${scaleXVal.toFixed(3)}, ${sy.toFixed(3)})`
                    });
                    track.appendChild(card);
                });
                d.appendChild(track);
            } else if (style === 'slot_v') {
                const availW = Math.max(20, e.w - 12 - (reels - 1) * gap);
                const colW = availW / reels;
                const cardW = Math.max(14, Math.min(slotW, Math.floor(colW)));
                const cardH = Math.max(14, Math.min(slotW, Math.floor((e.h - 8) * 0.52)));
                const stepV = cardH + gap;
                const totalW = reels * cardW + (reels - 1) * gap;
                const startX = (e.w - totalW) * 0.5;
                const baseOffY = (e.h - cardH) * 0.5 - 2 * stepV;
                for (let r = 0; r < reels; r++) {
                    const lx = Math.round(startX + r * (cardW + gap));
                    if (r > 0) {
                        const sep = document.createElement('div');
                        sep.className = 'gs-roulette-reel-sep';
                        sep.style.left = Math.round(lx - gap * 0.5) + 'px';
                        d.appendChild(sep);
                    }
                    const strip = (spinState && spinState.reelStrips && spinState.reelStrips[r])
                        || Array.from({ length: 24 }, (_, idx) => rewards[(idx + r) % rewards.length]);
                    const ty = (spinState && spinState.reelOffsets && spinState.reelOffsets[r] != null)
                        ? spinState.reelOffsets[r]
                        : baseOffY;
                    strip.forEach((rw, idx) => {
                        const cy = idx * stepV + ty;
                        if (cy + cardH < -24 || cy > e.h + 24) return;
                        const card = makeCardDom(rw);
                        Object.assign(card.style, { left: lx + 'px', top: cy.toFixed(2) + 'px', width: cardW + 'px', height: cardH + 'px' });
                        track.appendChild(card);
                    });
                }
                d.appendChild(track);
                const needle = document.createElement('div');
                needle.className = 'gs-roulette-needle horiz';
                needle.style.background = e.pointerColor || '#ff4d4f';
                needle.style.color = e.pointerColor || '#ff4d4f';
                d.appendChild(needle);
            } else {
                const strip = (spinState && spinState.strip) || Array.from({ length: 24 }, (_, idx) => rewards[idx % rewards.length]);
                const baseOffset = (e.w - slotW) * 0.5 - 3 * step;
                const tx = spinState ? spinState.offsetPx : baseOffset;
                track.style.transform = `translate3d(${tx.toFixed(2)}px, 0, 0)`;
                const cardH = Math.max(12, Math.min(e.h - 8, slotW));
                strip.forEach((rw, idx) => {
                    const cx = idx * step;
                    if (cx + tx + slotW < -24 || cx + tx > e.w + 24) return;
                    const card = makeCardDom(rw);
                    Object.assign(card.style, {
                        left: cx + 'px',
                        top: Math.round((e.h - cardH) * 0.5) + 'px',
                        width: slotW + 'px',
                        height: cardH + 'px'
                    });
                    track.appendChild(card);
                });
                d.appendChild(track);
                const needle = document.createElement('div');
                needle.className = 'gs-roulette-needle';
                needle.style.background = e.pointerColor || '#ff4d4f';
                needle.style.color = e.pointerColor || '#ff4d4f';
                d.appendChild(needle);
            }
            d.title = `${e.name || 'Crate Roulette'} (${style}) · ${rewards.length} rewards`;
        },
        startPreviewSpin(rouletteId) {
            const m = this.menu();
            const rEl = (rouletteId ? m.elements.find(x => x.id === rouletteId && x.type === 'roulette') : null)
                || m.elements.find(x => x.type === 'roulette' && !x.hidden);
            if (!rEl || !rEl.rewards || !rEl.rewards.length) {
                GS.toast('No crate roulette configured in this menu', 'warn');
                return;
            }
            const style = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(rEl.spinStyle) ? rEl.spinStyle : 'csgo';
            const totalW = rEl.rewards.reduce((s, r) => s + Math.max(0.01, Number(r.weight) || 1), 0);
            let roll = Math.random() * totalW, winIdx = 0;
            for (let i = 0; i < rEl.rewards.length; i++) {
                roll -= Math.max(0.01, Number(rEl.rewards[i].weight) || 1);
                if (roll <= 0) { winIdx = i; break; }
            }
            const winner = rEl.rewards[winIdx];
            const randRw = () => rEl.rewards[Math.floor(Math.random() * rEl.rewards.length)];
            const WIN_SLOT = 34;
            const strip = [];
            for (let i = 0; i < 42; i++) strip.push(i === WIN_SLOT ? winner : randRw());

            const slotW = Math.max(16, M.int(rEl.slotSize, 44));
            const gap = Math.max(0, M.int(rEl.slotGap, 6));
            const step = slotW + gap;
            const reels = M.clamp(M.int(rEl.reels, 3), 1, 5);
            const cardCount = M.clamp(M.int(rEl.cardCount, 5), 3, 9);
            const slotCardH = Math.max(14, Math.min(slotW, Math.floor((rEl.h - 8) * 0.52)));
            const stepV = slotCardH + gap;
            const startX = (rEl.w - slotW) * 0.5 - 2 * step;
            const targetX = (rEl.w - slotW) * 0.5 - WIN_SLOT * step + (Math.random() - 0.5) * slotW * 0.28;
            const startY = (rEl.h - slotCardH) * 0.5 - 2 * stepV;
            const targetY = (rEl.h - slotCardH) * 0.5 - WIN_SLOT * stepV;
            const durMs = Math.max(800, M.num(rEl.durationSec, 4.2) * 1000);
            const t0 = performance.now();

            const reelStrips = Array.from({ length: reels }, () =>
                Array.from({ length: 42 }, (_, i) => (i === WIN_SLOT ? winner : randRw()))
            );
            const reelEndPs = Array.from({ length: reels }, (_, r) =>
                reels === 1 ? 1 : (0.58 + 0.42 * (r / (reels - 1)))
            );

            const pickSlot = Math.floor(Math.random() * cardCount);
            const flashHops = Math.max(18, Math.round((durMs / 1000) * 7));
            const flashStart = ((pickSlot - flashHops) % cardCount + cardCount) % cardCount;
            let lastFlashHop = -1;

            const flipHops = Math.max(12, Math.round((durMs / 1000) * 5));
            const flipStart = ((pickSlot - flipHops) % cardCount + cardCount) % cardCount;
            const flipFinalBoard = Array.from({ length: cardCount }, (_, i) => (i === pickSlot ? winner : randRw()));

            const spinObj = this.previewSpins[rEl.id] = {
                strip,
                offsetPx: startX,
                reelStrips,
                reelOffsets: Array(reels).fill(startY),
                board: Array.from({ length: cardCount }, (_, i) => rEl.rewards[i % rEl.rewards.length]),
                litIdx: 0,
                cards: Array.from({ length: cardCount }, () => ({ rw: winner, revealed: false, scaleX: 1, lit: false, dim: false })),
                done: false,
                running: true
            };

            const stepFrame = (now) => {
                if (!this.previewMode || this.previewSpins[rEl.id] !== spinObj) return;
                const p = Math.min(1, (now - t0) / durMs);
                if (style === 'flash') {
                    const hop = Math.min(flashHops, Math.floor((1 - Math.pow(1 - p, 2.5)) * (flashHops + 0.99)));
                    if (hop !== lastFlashHop || p >= 1) {
                        lastFlashHop = hop;
                        spinObj.board = Array.from({ length: cardCount }, () => randRw());
                        const active = (hop >= flashHops || p >= 1) ? pickSlot : (flashStart + hop) % cardCount;
                        if (hop >= flashHops || p >= 1) spinObj.board[pickSlot] = winner;
                        spinObj.litIdx = active;
                    }
                } else if (style === 'flip') {
                    if (p < 0.68) {
                        const sp = p / 0.68;
                        const hop = Math.min(flipHops, Math.floor((1 - Math.pow(1 - sp, 2.4)) * (flipHops + 0.99)));
                        const active = hop >= flipHops ? pickSlot : (flipStart + hop) % cardCount;
                        spinObj.cards = spinObj.cards.map((_, i) => ({
                            rw: flipFinalBoard[i],
                            revealed: false,
                            scaleX: 1,
                            lit: i === active,
                            dim: i !== active
                        }));
                    } else if (p < 0.86) {
                        const fp = (p - 0.68) / 0.18;
                        const sx = Math.max(0.06, Math.abs(Math.cos(fp * Math.PI)));
                        spinObj.cards = spinObj.cards.map((_, i) => i === pickSlot
                            ? { rw: winner, revealed: fp >= 0.5, scaleX: sx, lit: true, dim: false }
                            : { rw: flipFinalBoard[i], revealed: false, scaleX: 1, lit: false, dim: true }
                        );
                    } else {
                        const fp2 = Math.min(1, (p - 0.86) / 0.14);
                        const sx2 = Math.max(0.06, Math.abs(Math.cos(fp2 * Math.PI)));
                        spinObj.cards = spinObj.cards.map((_, i) => i === pickSlot
                            ? { rw: winner, revealed: true, scaleX: 1, lit: true, dim: false }
                            : { rw: flipFinalBoard[i], revealed: fp2 >= 0.5, scaleX: p >= 1 ? 1 : sx2, lit: false, dim: true }
                        );
                    }
                } else if (style === 'slot_v') {
                    for (let r = 0; r < reels; r++) {
                        const rp = Math.min(1, p / reelEndPs[r]);
                        const ease = 1 - Math.pow(1 - rp, 4);
                        spinObj.reelOffsets[r] = startY + (targetY - startY) * ease;
                    }
                } else {
                    let ease;
                    if (style === 'tease') {
                        const pm1 = p - 1, c1 = 1.85, c3 = c1 + 1;
                        ease = 1 + c3 * pm1 * pm1 * pm1 + c1 * pm1 * pm1;
                    } else {
                        ease = 1 - Math.pow(1 - p, 4);
                    }
                    spinObj.offsetPx = startX + (targetX - startX) * ease;
                }
                const dom = document.querySelector(`#gs-elements .gs-el[data-id="${rEl.id}"]`);
                if (dom) this.renderRoulette(dom, rEl);
                if (p < 1) {
                    requestAnimationFrame(stepFrame);
                } else {
                    spinObj.running = false;
                    spinObj.done = true;
                    this.previewVars.reward_name = winner.name;
                    this.previewVars.reward_item = winner.item;
                    this.previewVars.reward_id = winner.id;
                    GS.toast(`Won: ${winner.name}!`, 'ok');
                    this.renderCanvas();
                }
            };
            requestAnimationFrame(stepFrame);
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
            const tipBox = $('#gs-tooltip');
            if (tipBox) tipBox.style.display = 'none';
            const selIds = this.selIds();
            m.elements.forEach((e, i) => {
                if (e.hidden) return;
                const d = document.createElement('div');
                d.className = `gs-el gs-${e.type}` + (selIds.includes(e.id) && !this.previewMode ? ' selected' : '') + (e.locked && !this.previewMode ? ' locked' : '');
                // layer order stays as in the Layers list even when selected (the frame is drawn on top separately)
                d.dataset.id = e.id;
                const eff = this.effectivePos(e);
                Object.assign(d.style, { left: eff.x + 'px', top: eff.y + 'px', width: e.w + 'px', height: e.h + 'px', zIndex: i + 1 });
                if (eff.area) {
                    const topC = Math.max(0, eff.area.y - eff.y);
                    const leftC = Math.max(0, eff.area.x - eff.x);
                    const botC = Math.max(0, (eff.y + e.h) - (eff.area.y + eff.area.h));
                    const rightC = Math.max(0, (eff.x + e.w) - (eff.area.x + eff.area.w));
                    if (topC + botC >= e.h || leftC + rightC >= e.w) {
                        if (this.previewMode) d.style.display = 'none';
                        else d.style.opacity = '0.28';
                    } else if (topC > 0 || leftC > 0 || botC > 0 || rightC > 0) {
                        d.style.clipPath = `inset(${topC}px ${rightC}px ${botC}px ${leftC}px)`;
                    }
                }
                if (e.type === 'roulette') this.renderRoulette(d, e);
                if (e.type === 'scroll_area') {
                    d.style.background = e.bgColor || '#0e131f';
                    d.style.borderColor = e.borderColor || '#3a8ee6';
                    const b = document.createElement('span');
                    b.className = 'gs-scroll-badge';
                    b.textContent = e.scrollMode === 'vertical' ? 'SCROLL V' : e.scrollMode === 'horizontal' ? 'SCROLL H' : 'PAN 2D';
                    d.appendChild(b);
                    if (e.showScrollbar !== false && e.scrollMode !== 'horizontal') {
                        const bar = document.createElement('span');
                        bar.className = 'gs-scroll-bar';
                        const thumb = document.createElement('b');
                        const maxY = Math.max(1, (e.contentH || e.h) - e.h);
                        const ratio = Math.min(1, e.h / Math.max(e.h, e.contentH || e.h));
                        const sy = this.scrollOffset(e.id).y / maxY;
                        thumb.style.height = Math.max(12, ratio * 100) + '%';
                        thumb.style.top = (sy * (100 - Math.max(12, ratio * 100))) + '%';
                        bar.appendChild(thumb);
                        d.appendChild(bar);
                    }
                }
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
                    lab.innerHTML = mcToHtml(this.resolvePreviewVars(e.label), e.labelColor || '#ffffff');
                    d.appendChild(lab);
                }
                if (e.type === 'item') {
                    const resolvedItem = this.resolvePreviewVars(e.item);
                    const url = GS.Items && GS.Items.url(resolvedItem);
                    if (url) d.style.backgroundImage = `url("${url}")`;
                    else {
                        d.classList.add('no-item');
                        const t = document.createElement('span');
                        t.className = 'gs-item-id';
                        t.textContent = GS.Items && GS.Items.isSlot(resolvedItem) ? (GS.Items.SLOTS.find(x => x[0] === String(resolvedItem).trim().toLowerCase()) || [0, resolvedItem])[1] : String(resolvedItem || 'no item').replace(/^minecraft:/, '');
                        d.appendChild(t);
                    }
                    if (e.glint) d.classList.add('glint');
                    d.title = `${resolvedItem}${e.look === '3d' ? ' · 3D' : ''}${e.spin ? ' · spinning' : ''}`;
                }
                if (e.type === 'custom_model') {
                    const mid = this.resolvePreviewVars(e.modelId);
                    const icon = GS.CustomAssets && GS.CustomAssets.iconUrl(mid);
                    const hasModelData = GS.CustomAssets && GS.CustomAssets.findItem(mid);
                    if (hasModelData && hasModelData.hasModel && GS.BbModel) {
                        const cv = document.createElement('canvas');
                        cv.className = 'gs-cmodel-cv';
                        const k = Math.max(4, Math.min(10, Math.round(320 / Math.max(e.w, e.h))));
                        cv.width = Math.max(32, Math.round(e.w * k));
                        cv.height = Math.max(32, Math.round(e.h * k));
                        d.appendChild(cv);
                        GS.CustomAssets.getModel(mid).then(mod => {
                            if (mod && d.isConnected) {
                                GS.BbModel.drawToCanvas(mod, cv, { angle: M.num(e.angle, 20) });
                            } else if (icon && d.isConnected) {
                                d.style.backgroundImage = `url("${icon}")`;
                            }
                        });
                    } else if (icon) {
                        d.style.backgroundImage = `url("${icon}")`;
                    } else {
                        d.classList.add('no-model');
                        const t = document.createElement('span');
                        t.className = 'gs-item-id';
                        t.textContent = mid || 'meg:model';
                        d.appendChild(t);
                    }
                    d.title = `${mid}${e.animation ? ' · ' + e.animation : ''}${e.spin ? ' · spinning' : ''}`;
                }
                if (e.type === 'input') {
                    const bg = e.bgColor || '#161b26';
                    const br = e.borderColor || '#52a0f0';
                    d.style.background = bg;
                    d.style.border = `1px solid ${br}`;
                    const curVal = (e.varName && e.varName in this.previewVars) ? this.previewVars[e.varName] : (e.defaultValue == null ? '1' : String(e.defaultValue));
                    const disp = `${e.prefix || ''}${curVal}${e.suffix || ''}`;
                    const inner = document.createElement('span');
                    inner.className = 'gs-input-inner' + (e.shadow !== false ? ' shadow' : '');
                    inner.style.fontSize = (8 * M.num(e.scale, 1)) + 'px';
                    inner.style.justifyContent = e.align === 'left' ? 'flex-start' : e.align === 'right' ? 'flex-end' : 'center';
                    inner.innerHTML = mcToHtml(this.resolvePreviewVars(disp), e.textColor || '#ffffff');
                    const ed = document.createElement('span');
                    ed.className = 'gs-input-edit';
                    ed.textContent = '✎';
                    d.appendChild(inner);
                    d.appendChild(ed);
                    d.title = `Input: {${e.varName || 'qty'}} (${e.inputType || 'number'})`;
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
                    t.innerHTML = mcToHtml(this.resolvePreviewVars(e.text), e.color || '#ffffff');
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
                    const eff = this.effectivePos(e);
                    const f = document.createElement('div');
                    f.className = 'gs-selframe multi' + (e.id === this.selected ? ' main' : '');
                    Object.assign(f.style, { left: eff.x + 'px', top: eff.y + 'px', width: e.w + 'px', height: e.h + 'px' });
                    wrap.appendChild(f);
                });
                const b = this.selBounds();
                const g = document.createElement('div');
                g.className = 'gs-groupframe';
                Object.assign(g.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
                wrap.appendChild(g);
            } else if (sel && !sel.hidden && !this.previewMode) {
                const eff = this.effectivePos(sel);
                const f = document.createElement('div');
                f.className = 'gs-selframe';
                Object.assign(f.style, { left: eff.x + 'px', top: eff.y + 'px', width: sel.w + 'px', height: sel.h + 'px' });
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
            const ids = new Set(this.project.menus.map(x => x.id));
            ul.innerHTML = this.project.menus.map((m, i) => {
                const counts = new Map();
                m.elements.forEach(e => {
                    if ((e.type !== 'button' && e.type !== 'input') || e.hidden) return;
                    (e.actions || []).forEach(a => {
                        const t = /^open:(.+)$/i.exec(String(a).trim());
                        if (t) {
                            const raw = t[1].trim();
                            const qi = raw.indexOf('?');
                            const tid = (qi >= 0 ? raw.slice(0, qi) : raw).trim();
                            if (tid) counts.set(tid, (counts.get(tid) || 0) + 1);
                        }
                    });
                });
                const outs = [];
                counts.forEach((cnt, tid) => {
                    const isWarn = !ids.has(tid) && !/\{[^}]+\}/.test(tid);
                    const tip = cnt > 1 ? `Opens ${tid} (${cnt} buttons)` : `Opens ${tid}`;
                    outs.push(`<span class="gs-page-badge ${isWarn ? 'warn' : ''}" title="${esc(tip)}">→ ${esc(tid)}${cnt > 1 ? ` ×${cnt}` : ''}</span>`);
                });
                if (m.nextPage) outs.push(`<span class="gs-page-badge page" title="Next page">⇄ ${esc(m.nextPage)}</span>`);
                return `<li class="${i === this.menuIndex ? 'active' : ''}" data-i="${i}">
                  <span class="gs-page-title">${esc(m.title || m.id)}${this.fullscreenOdd(m) ? ' <span class="gs-page-warn" title="Not full screen like the other pages">⚠</span>' : ''}</span>
                  <span class="gs-page-id">${esc(m.id)}${m.command ? ' · /' + esc(m.command) : ''}</span>
                  ${outs.length ? `<span class="gs-page-links">${outs.slice(0, 4).join('')}${outs.length > 4 ? `<span class="gs-page-badge">+${outs.length - 4}</span>` : ''}</span>` : ''}
                </li>`;
            }).join('');
        },

        renderLayers() {
            const m = this.menu();
            const ul = $('#gs-layer-list');
            const icon = { image: '#g-image', button: '#g-button', text: '#g-text', player_head: '#g-head', player_model: '#g-model', item: '#g-item', custom_model: '#g-cmodel', input: '#g-input', roulette: '#g-roulette', scroll_area: '#g-scroll' };
            ul.innerHTML = m.elements.slice().reverse().map(e => `
                <li class="${this.isSel(e.id) ? 'active' : ''} ${e.id === this.selected && this.isMulti() ? 'main' : ''} ${e.hidden ? 'is-hidden' : ''}" data-id="${esc(e.id)}">
                  <svg class="gs-layer-ico"><use href="${icon[e.type]}"/></svg>
                  <span class="gs-layer-name">${esc(e.name || e.id)}</span>
                  <button class="icon-btn small gs-lock ${e.locked ? 'active' : ''}" data-lock="${esc(e.id)}" title="${e.locked ? 'Unlock layer' : 'Lock layer'}"><svg><use href="#g-${e.locked ? 'lock' : 'unlock'}"/></svg></button>
                  <button class="icon-btn small gs-eye" data-eye="${esc(e.id)}" title="Show / hide"><svg><use href="#g-eye"/></svg></button>
                </li>`).join('') || '<li class="gs-empty">No elements yet — add a Smart Block or element from the left toolbar, or <button class="link-btn" data-cmd="templates">start from a template</button> (M).</li>';
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
                const body = `<textarea id="${id}" data-k="${key}" rows="${opts.rows || 4}" spellcheck="false">${esc(value)}</textarea>`;
                const ctrl = opts.varBtn ? `<div class="gs-varwrap">${body}<button type="button" class="ghost-btn small" data-var-field="${key}" title="Insert Variable">{ }</button></div>` : body;
                return `<div class="gs-field wide"><label for="${id}">${label}</label>${ctrl}${opts.hint ? `<div class="gs-hint">${opts.hint}</div>` : ''}</div>`;
            }
            const attrs = type === 'number' ? `step="${opts.step || 1}" ${opts.min != null ? `min="${opts.min}"` : ''} ${opts.max != null ? `max="${opts.max}"` : ''}` : 'spellcheck="false"';
            const ph = opts.placeholder != null ? ` placeholder="${esc(opts.placeholder)}"` : '';
            const inp = `<input id="${id}" type="${type === 'color' ? 'color' : type}" data-k="${key}" value="${esc(value)}" ${attrs}${ph}/>`;
            const ctrl = opts.varBtn ? `<div class="gs-varwrap">${inp}<button type="button" class="ghost-btn small" data-var-field="${key}" title="Insert Variable">{ }</button></div>` : inp;
            return `<div class="gs-field ${opts.wide ? 'wide' : ''}"><label for="${id}">${label}</label>${ctrl}${opts.hint ? `<div class="gs-hint">${opts.hint}</div>` : ''}</div>`;
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
            const hasAct = e.type === 'button' || e.type === 'input';
            const tab = (!['general', 'actions', 'effects'].includes(this.propTab) || (this.propTab === 'actions' && !hasAct)) ? 'general' : this.propTab;
            let h = `<div class="gs-prop-title"><svg><use href="${{ image: '#g-image', button: '#g-button', text: '#g-text', player_head: '#g-head', player_model: '#g-model', item: '#g-item', custom_model: '#g-cmodel', input: '#g-input', roulette: '#g-roulette', scroll_area: '#g-scroll' }[e.type]}"/></svg>${{ image: 'Image', button: 'Button', text: 'Text', player_head: 'Player Head', player_model: 'Player Model', item: 'Item', custom_model: '3D Model', input: 'Input Box', roulette: 'Crate Roulette', scroll_area: 'Scroll / Map Area' }[e.type]}</div>`;
            h += `<div class="gs-prop-tabs">
                <button type="button" class="gs-prop-tab ${tab === 'general' ? 'active' : ''}" data-prop-tab="general">General</button>
                ${hasAct ? `<button type="button" class="gs-prop-tab ${tab === 'actions' ? 'active' : ''}" data-prop-tab="actions">Actions</button>` : ''}
                <button type="button" class="gs-prop-tab ${tab === 'effects' ? 'active' : ''}" data-prop-tab="effects">Effects</button>
            </div>`;

            if (tab === 'general') {
                h += `<div class="gs-section">`;
                h += this.field('Name', 'name', e.name, { wide: true });
                h += `<div class="gs-grid4">${this.field('X', 'x', e.x, { type: 'number' })}${this.field('Y', 'y', e.y, { type: 'number' })}${this.field('W', 'w', e.w, { type: 'number', min: 1 })}${this.field('H', 'h', e.h, { type: 'number', min: 1 })}</div>`;
                h += this.field('Lock on canvas (prevent accidental drag)', 'locked', !!e.locked, { type: 'checkbox' });
                h += `</div>`;
                if (e.type === 'image') {
                    h += `<div class="gs-section">${this.imagePicker('Picture', 'image', e.image)}
                          <button class="ghost-btn block" data-action="fit-image">Size to picture</button></div>`;
                }
                if (e.type === 'button') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Look</div>
                          ${this.imagePicker('Picture', 'image', e.image)}
                          ${this.imagePicker('Hover picture', 'hoverImage', e.hoverImage)}
                          <button class="ghost-btn block" data-action="fit-image">Size to picture</button></div>`;
                    h += `<div class="gs-section"><div class="gs-sec-head">Label</div>
                          ${this.field('Text', 'label', e.label, { wide: true, varBtn: true, hint: '&amp; colour codes and {variables} work' })}
                          <div class="gs-grid2">${this.field('Colour', 'labelColor', e.labelColor || '#ffffff', { type: 'color' })}${this.field('Size', 'labelScale', e.labelScale, { type: 'number', step: 0.25, min: 0.25 })}</div>
                          ${this.field('Shadow', 'labelShadow', e.labelShadow !== false, { type: 'checkbox' })}</div>`;
                }
                if (e.type === 'text') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Text</div>
                          ${this.field('Text', 'text', e.text, { type: 'textarea', rows: 2, varBtn: true, hint: '&amp; colour codes, {variables}, and {qty*price} math work.' })}
                          <div class="gs-grid2">${this.field('Colour', 'color', e.color || '#ffffff', { type: 'color' })}${this.field('Size', 'scale', e.scale, { type: 'number', step: 0.25, min: 0.25 })}</div>
                          ${this.field('Align', 'align', e.align, { type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] })}
                          ${this.field('Shadow', 'shadow', !!e.shadow, { type: 'checkbox' })}</div>`;
                }
                if (M.isPlayer(e)) {
                    h += `<div class="gs-section"><div class="gs-sec-head">Player</div>
                          ${this.field('Whose skin', 'player', e.player, { wide: true, hint: '<code>%player_name%</code> = viewer.' })}
                          ${this.field('Hat layer (Java)', 'hat', e.hat !== false, { type: 'checkbox' })}</div>`;
                    if (e.type === 'player_model') {
                        h += `<div class="gs-section"><div class="gs-sec-head">Java 3D model</div>
                          ${this.field('Real 3D player (Mannequin)', 'java3d', e.java3d !== false, { type: 'checkbox' })}
                          ${e.java3d !== false ? `
                          ${this.field('Outfit', 'outfit', e.outfit || 'own', { type: 'select', options: [['own', 'What that player wears (armour + held items)'], ['none', 'No armour']] })}
                          <div class="gs-grid2">${this.field('Pose', 'pose', e.pose || 'standing', { type: 'select', options: [['standing', 'Standing'], ['crouching', 'Crouching']] })}${this.field('Turn', 'turn', e.turn || 'none', { type: 'select', options: [['none', 'Still'], ['spin', 'Spin'], ['cursor', 'Look at the cursor'], ['mouse', 'Turn with the cursor'], ['drag', 'Drag to turn']] })}</div>
                          <div class="gs-grid2">${this.field('Angle (°)', 'angle', e.angle || 0, { type: 'number', step: 5 })}${e.turn === 'spin' ? this.field('Spin (° / s)', 'spinSpeed', e.spinSpeed || 45, { type: 'number', step: 5, min: 1 }) : ''}</div>` : ''}</div>`;
                    }
                }
                if (e.type === 'item') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Item</div>
                          ${this.field('Item id (supports {var} & worn slot:)', 'item', e.item, { wide: true, hint: '<code>minecraft:diamond_sword</code> · <code>itemsadder:ns:id</code> · <code>nexo:id</code> · <code>slot:head..feet</code> · <code>{item_id}</code>' })}
                          <div class="gs-row-actions">
                            <button class="ghost-btn" data-action="pick-item"><svg><use href="#g-item"/></svg><span>Choose item…</span></button>
                            <button class="ghost-btn" data-action="open-custom-assets"><span>Plugin Packs…</span></button>
                          </div>
                          <div class="gs-grid2">${this.field('Look (Java)', 'look', e.look || 'flat', { type: 'select', options: [['flat', 'Like inventory'], ['3d', '3D held item']] })}${this.field('Enchant glint', 'glint', !!e.glint, { type: 'checkbox' })}</div>
                          ${this.field('Spin (Java)', 'spin', !!e.spin, { type: 'checkbox' })}</div>`;
                }
                if (e.type === 'custom_model') {
                    h += `<div class="gs-section"><div class="gs-sec-head">3D Model (ModelEngine / BetterModel)</div>
                          ${this.field('Model id (or {model_id})', 'modelId', e.modelId || '', { wide: true })}
                          <div class="gs-row-actions">
                            <button class="ghost-btn" data-action="pick-model"><svg><use href="#g-cmodel"/></svg><span>Choose 3D model…</span></button>
                            <button class="ghost-btn" data-action="open-custom-assets"><span>Plugin Packs…</span></button>
                          </div>
                          ${this.field('Animation name', 'animation', e.animation || 'idle', { wide: true, placeholder: 'idle' })}
                          <div class="gs-grid2">${this.field('Scale 3D', 'scale3d', e.scale3d || 1, { type: 'number', step: 0.1, min: 0.1, max: 10 })}${this.field('Angle (°)', 'angle', e.angle || 0, { type: 'number', step: 5 })}</div>
                          <div class="gs-grid2">${this.field('Spin (Java)', 'spin', !!e.spin, { type: 'checkbox' })}${e.spin ? this.field('Spin (° / s)', 'spinSpeed', e.spinSpeed || 45, { type: 'number', step: 5, min: 1 }) : '<div></div>'}</div></div>`;
                }
                if (e.type === 'input') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Interactive Input (Java + Bedrock)</div>
                          <div class="gs-grid2">${this.field('Variable name', 'varName', e.varName || 'qty', { placeholder: 'qty' })}${this.field('Input type', 'inputType', e.inputType || 'number', { type: 'select', options: [['number', 'Number'], ['slider', 'Slider'], ['text', 'Text']] })}</div>
                          ${this.field('Default value', 'defaultValue', e.defaultValue == null ? '1' : e.defaultValue, { wide: true })}
                          ${e.inputType !== 'text' ? `<div class="gs-grid3">${this.field('Min', 'min', e.min, { type: 'number', step: 1 })}${this.field('Max', 'max', e.max, { type: 'number', step: 1 })}${this.field('Step', 'step', e.step || 1, { type: 'number', step: 0.5, min: 0.01 })}</div>` : ''}
                          <div class="gs-grid2">${this.field('Prefix', 'prefix', e.prefix || '')}${this.field('Suffix', 'suffix', e.suffix || '')}</div>
                          ${this.field('Prompt title', 'promptTitle', e.promptTitle || '', { wide: true })}
                          <div class="gs-grid3">${this.field('Text', 'textColor', e.textColor || '#ffffff', { type: 'color' })}${this.field('Background', 'bgColor', e.bgColor || '#161b26', { type: 'color' })}${this.field('Border', 'borderColor', e.borderColor || '#52a0f0', { type: 'color' })}</div>
                          <div class="gs-grid2">${this.field('Text size', 'scale', e.scale || 1, { type: 'number', step: 0.25, min: 0.25 })}${this.field('Align', 'align', e.align || 'center', { type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] })}</div></div>`;
                }
                if (e.type === 'roulette') {
                    const rws = Array.isArray(e.rewards) ? e.rewards : [];
                    const st = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(e.spinStyle) ? e.spinStyle : 'csgo';
                    h += `<div class="gs-section"><div class="gs-sec-head">Crate Roulette Animation</div>
                          ${this.field('Spin Style', 'spinStyle', st, { type: 'select', options: [
                              ['csgo', 'CS:GO Tape — Classic Smooth Ease-Out'],
                              ['tease', 'Near-Miss Tease — Overshoot & Pull Back'],
                              ['slot_v', 'Slot Machine — Multi-Reel Vertical'],
                              ['flash', 'Mystery Spotlight — Random Shuffle'],
                              ['flip', 'Mystery Cards — Multi-Card Pick & Flip']
                          ] })}
                          ${st === 'slot_v' ? this.field('Slot Reels (Columns)', 'reels', M.clamp(M.int(e.reels, 3), 1, 5), { type: 'select', options: [
                              ['1', '1 Reel (Single)'], ['2', '2 Reels'], ['3', '3 Reels (Classic Casino)'], ['4', '4 Reels'], ['5', '5 Reels']
                          ] }) : ''}
                          ${(st === 'flash' || st === 'flip') ? this.field('Card Count', 'cardCount', M.clamp(M.int(e.cardCount, 5), 3, 9), { type: 'select', options: [
                              ['3', '3 Cards'], ['4', '4 Cards'], ['5', '5 Cards'], ['6', '6 Cards (2 rows)'], ['7', '7 Cards (2 rows)'], ['8', '8 Cards (2 rows)'], ['9', '9 Cards (2 rows)']
                          ] }) : ''}
                          <div class="gs-grid3">${this.field('Slot Size', 'slotSize', e.slotSize || 44, { type: 'number', min: 16, max: 128 })}${this.field('Gap (px)', 'slotGap', e.slotGap ?? 6, { type: 'number', min: 0, max: 32 })}${this.field('Duration (s)', 'durationSec', e.durationSec || 4.2, { type: 'number', step: 0.2, min: 1, max: 15 })}</div>
                          <div class="gs-grid3">${this.field('Background', 'bgColor', e.bgColor || '#0d111a', { type: 'color' })}${this.field('Border', 'borderColor', e.borderColor || '#e5a43a', { type: 'color' })}${this.field('Needle', 'pointerColor', e.pointerColor || '#ff4d4f', { type: 'color' })}</div>
                          <div class="gs-grid2">${this.field('Tick Sound', 'tickSound', e.tickSound || '')}${this.field('Win Sound', 'winSound', e.winSound || '')}</div>
                          <div class="gs-row-actions">
                            <button class="primary-btn small" data-action="test-spin"><svg><use href="#g-play"/></svg><span>Test Spin</span></button>
                            <button class="ghost-btn small" data-action="fit-roulette" title="Resize frame to match selected spin style"><span>Fit Frame</span></button>
                            <button class="ghost-btn small" data-action="add-spin-btn"><span>+ SPIN Button</span></button>
                          </div></div>`;
                    h += `<div class="gs-section"><div class="gs-sec-head gs-head-row"><span>Rewards Pool (${rws.length})</span><button class="ghost-btn small" data-action="add-reward"><span>+ Add Reward</span></button></div>`;
                    rws.forEach((rw, idx) => {
                        h += `<div class="gs-reward-row">
                            <div class="gs-reward-head">
                              <span style="width:10px;height:10px;border-radius:2px;background:${esc(rw.color || '#3b82f6')};display:inline-block"></span>
                              <strong>#${idx + 1} ${esc(rw.name || 'Reward')}</strong>
                              ${rws.length > 1 ? `<button class="icon-btn small danger" data-del-reward="${idx}" title="Remove reward"><svg><use href="#g-close"/></svg></button>` : ''}
                            </div>
                            <div class="gs-grid2">${this.field('Name', `reward.${idx}.name`, rw.name || '')}${this.field('Weight (%)', `reward.${idx}.weight`, rw.weight ?? 10, { type: 'number', step: 1, min: 0.01 })}</div>
                            <div class="gs-grid2">${this.field('Item ID', `reward.${idx}.item`, rw.item || 'minecraft:diamond')}${this.field('Rarity', `reward.${idx}.color`, rw.color || '#3b82f6', { type: 'color' })}</div>
                            <div class="gs-row-actions"><button class="ghost-btn small" data-pick-reward="${idx}"><span>Choose Item…</span></button></div>
                            ${this.field('Win Actions (one per line)', `reward.${idx}.actions`, (rw.actions || []).join('\n'), { type: 'textarea', rows: 2 })}
                        </div>`;
                    });
                    h += `</div>`;
                }
                if (e.type === 'scroll_area') {
                    const off = this.scrollOffset(e.id);
                    h += `<div class="gs-section"><div class="gs-sec-head">Scrollable / 2D Map Viewport</div>
                          ${this.field('Scroll Mode', 'scrollMode', e.scrollMode || 'pan2d', { type: 'select', options: [['pan2d', '2D Panning Map / Skill Tree (drag or arrows)'], ['vertical', 'Vertical Scroll List (mouse wheel / swipe)'], ['horizontal', 'Horizontal Scroll Strip']] })}
                          <div class="gs-grid3">${this.field('Content W', 'contentW', e.contentW || Math.max(e.w, 720), { type: 'number', min: e.w })}${this.field('Content H', 'contentH', e.contentH || Math.max(e.h, 480), { type: 'number', min: e.h })}${this.field('Wheel Step', 'stepPx', e.stepPx || 28, { type: 'number', min: 4, max: 200 })}</div>
                          <div class="gs-grid2">${this.field('Background', 'bgColor', e.bgColor || '#0e131f', { type: 'color' })}${this.field('Border', 'borderColor', e.borderColor || '#3a8ee6', { type: 'color' })}</div>
                          ${this.field('Show Scrollbar', 'showScrollbar', e.showScrollbar !== false, { type: 'checkbox' })}
                          <div class="gs-grid2">${this.field('Preview Scroll X', `scrollPreview.${e.id}.x`, off.x, { type: 'number', min: 0 })}${this.field('Preview Scroll Y', `scrollPreview.${e.id}.y`, off.y, { type: 'number', min: 0 })}</div>
                          <div class="gs-row-actions"><button class="ghost-btn small" data-action="assign-scroll-children"><span>Assign elements inside box</span></button></div></div>`;
                }
            } else if (tab === 'actions' && hasAct) {
                const navCurRaw = (e.actions || []).map(s => String(s).trim()).find(s => /^open:/.test(s) || s === 'back' || s === 'close' || s === 'next' || s === 'prev') || '';
                const navCur = /^open:([^?]+)/.exec(navCurRaw) ? 'open:' + /^open:([^?]+)/.exec(navCurRaw)[1].trim() : navCurRaw;
                const linkOpts = [['', '(No quick link)'], ['back', '← Back'], ['next', '▶ Next page'], ['prev', '◀ Prev page'], ['close', '✕ Close']]
                    .concat(this.project.menus.map(mm => ['open:' + mm.id, `Open: ${mm.title || mm.id} (${mm.id})`]));
                const openTarget = /^open:([^?]+)/.exec(navCurRaw);
                const canJump = openTarget && this.project.menus.some(mm => mm.id === openTarget[1].trim());
                h += `<div class="gs-section"><div class="gs-sec-head">Quick Navigation</div>
                      ${this.field('Quick link', 'quickLink', navCur, { type: 'select', options: linkOpts })}
                      <div class="gs-row-actions">
                        ${canJump ? `<button class="ghost-btn small" data-action="jump-link"><span>Go → ${esc(openTarget[1].trim())}</span></button>` : ''}
                        <button class="ghost-btn small" data-action="create-link"><span>+ New page</span></button>
                        <button class="ghost-btn small" data-action="link-confirm"><span>+ Ask Confirm</span></button>
                      </div></div>`;
                h += `<div class="gs-section"><div class="gs-sec-head">Click / Submit Actions</div>
                      ${GS.ActionBuilder ? GS.ActionBuilder.renderHtml(e, this) : this.field('Actions', 'actions', (e.actions || []).join('\n'), { type: 'textarea', rows: 4 })}
                      ${e.type === 'button' ? this.field('Close the menu after clicking', 'closeOnClick', !!e.closeOnClick, { type: 'checkbox' }) : ''}</div>`;
            } else if (tab === 'effects') {
                const scrollAreas = e.type !== 'scroll_area' ? this.menu().elements.filter(x => x.type === 'scroll_area') : [];
                if (scrollAreas.length) {
                    h += `<div class="gs-section">${this.field('Inside Scroll / Map Area', 'scrollGroup', e.scrollGroup || '', { type: 'select', options: [['', '(Fixed on screen)']].concat(scrollAreas.map(a => [a.id, `${a.name || a.id} (${a.scrollMode})`])) })}</div>`;
                }
                if (e.type === 'image' || e.type === 'button') {
                    h += `<div class="gs-section">${this.detailField(e)}</div>`;
                    if (e.type === 'image' && e.gen) {
                        const g = e.gen, what = g.kind === 'icon' ? 'icon' : 'shape';
                        h += `<div class="gs-section"><button class="ghost-btn" data-action="edit-gen"><svg><use href="#g-${what}"/></svg><span>Edit ${what}…</span></button></div>`;
                    }
                    h += this.framesHtml(e);
                }
                if (M.isPlayer(e)) {
                    const db = M.dollBox(e), ds = e.dollSize || ['', ''], dof = e.dollOffset || ['', ''];
                    h += `<div class="gs-section"><div class="gs-sec-head">Bedrock 3D model</div>
                          ${e.type === 'player_model' ? this.field('Renderer on Bedrock', 'bedrockRenderer', e.bedrockRenderer || 'auto', { type: 'select', options: [
                              ['auto', 'Auto (Live Player w/ armor, Paper Doll if Drag)'],
                              ['live', 'Live Player (Inventory — armor & held item)'],
                              ['doll', 'Paper Doll (Pause — skin only, 360° drag)']
                          ] }) : ''}
                          <div class="gs-grid2">${this.field('Doll W', 'dollSize.0', ds[0], { placeholder: String(db.size[0]) })}${this.field('Doll H', 'dollSize.1', ds[1], { placeholder: String(db.size[1]) })}</div>
                          <div class="gs-grid2">${this.field('Doll X', 'dollOffset.0', dof[0], { placeholder: String(db.offset[0]) })}${this.field('Doll Y', 'dollOffset.1', dof[1], { placeholder: String(db.offset[1]) })}</div></div>`;
                }
                if (e.type === 'item' || e.type === 'custom_model') {
                    h += `<div class="gs-section"><div class="gs-sec-head">Bedrock &amp; Hitbox</div>
                          ${this.field('Bedrock texture override', 'bedrockTexture', e.bedrockTexture || '', { wide: true, placeholder: '(auto-packed on export)' })}
                          ${e.type === 'custom_model' ? `<div class="gs-grid2">${this.field('Hitbox W', 'hitboxW', e.hitboxW || 1, { type: 'number', step: 0.25, min: 0.2, max: 8 })}${this.field('Hitbox H', 'hitboxH', e.hitboxH || 2, { type: 'number', step: 0.25, min: 0.2, max: 8 })}</div>` : ''}</div>`;
                }
                if (e.type === 'button') {
                    h += `<div class="gs-section">${this.field('Hover sound (optional)', 'hoverSound', e.hoverSound || '', { wide: true })}</div>`;
                }
                if (['button', 'item', 'player_head', 'player_model', 'custom_model', 'input', 'roulette', 'scroll_area'].includes(e.type)) {
                    h += `<div class="gs-section">${this.field('Tooltip (hover popup, Java)', 'tooltip', e.tooltip || '', { type: 'textarea', rows: 2 })}</div>`;
                }
                h += this.motionHtml(e);
            }

            h += `<div class="gs-section gs-row-actions">
                    <button class="ghost-btn" data-action="duplicate"><svg><use href="#g-copy"/></svg><span>Duplicate</span></button>
                    <button class="ghost-btn danger" data-action="delete"><svg><use href="#g-trash"/></svg><span>Delete</span></button></div>`;
            box.innerHTML = h;
            if (tab === 'actions' && GS.ActionBuilder) GS.ActionBuilder.bind(box, e, this);
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
            const pageOpts = [['', '(None)']].concat(this.project.menus.filter(x => x !== m).map(x => [x.id, `${x.title || x.id} (${x.id})`]));
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
                <div class="gs-section"><div class="gs-sec-head">Navigation &amp; Pagination</div>
                  <div class="gs-grid2">
                    ${this.field('Previous page (scroll ↑)', 'menu.prevPage', m.prevPage || '', { type: 'select', options: pageOpts })}
                    ${this.field('Next page (scroll ↓)', 'menu.nextPage', m.nextPage || '', { type: 'select', options: pageOpts })}
                  </div>
                  <div class="gs-row-actions">
                    <button class="ghost-btn small" data-action="add-next-page"><span>+ Add Next Page (Paginate)</span></button>
                    <button class="ghost-btn small" data-action="open-flow"><span>UI Flow…</span></button>
                  </div>
                  <div class="gs-hint">Java players can scroll the mouse wheel to turn pages, or use buttons with <code>next</code> / <code>prev</code> / <code>open:&lt;id&gt;</code>.</div>
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
                    // keep open:<id> actions and pagination pointing at the renamed menu
                    p.menus.forEach(mm => {
                        if (mm.prevPage === m.id) mm.prevPage = nid;
                        if (mm.nextPage === m.id) mm.nextPage = nid;
                        mm.elements.forEach(e => {
                            if (Array.isArray(e.actions)) e.actions = e.actions.map(a => String(a).trim() === 'open:' + m.id ? 'open:' + nid : a);
                        });
                    });
                    m.id = nid;
                } else if (k === 'prevPage' || k === 'nextPage') m[k] = String(val || '').trim();
                else if (k === 'width' || k === 'height') m[k] = M.clamp(M.int(val, m[k]), 16, M.MAX_SIDE);
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
            if (key.startsWith('scrollPreview.')) {
                const [, areaId, axis] = key.split('.');
                const area = this.menu().elements.find(a => a.id === areaId && a.type === 'scroll_area');
                if (area) {
                    const maxX = Math.max(0, (area.contentW || area.w) - area.w);
                    const maxY = Math.max(0, (area.contentH || area.h) - area.h);
                    const cur = Object.assign({}, this.scrollOffset(areaId));
                    cur[axis] = M.clamp(M.num(val, 0), 0, axis === 'x' ? maxX : maxY);
                    this.previewScroll[areaId] = cur;
                    this.renderCanvas();
                }
                return;
            }
            const e = this.element();
            if (!e) return;
            this.checkpoint();
            if (key.startsWith('reward.')) {
                const [, idxS, field] = key.split('.');
                const idx = Number(idxS);
                if (Array.isArray(e.rewards) && e.rewards[idx]) {
                    const rw = e.rewards[idx];
                    if (field === 'weight') rw.weight = Math.max(0.01, M.num(val, 10));
                    else if (field === 'actions') rw.actions = String(val).split('\n').map(s => s.trim()).filter(Boolean);
                    else rw[field] = String(val);
                    this.changed();
                }
                return;
            }
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
            if (key === 'quickLink') {
                const kept = (e.actions || []).filter(s => {
                    const t = String(s).trim().toLowerCase();
                    return !(t.startsWith('open:') || t === 'back' || t === 'close' || t === 'next' || t === 'prev');
                });
                if (val) kept.push(val);
                e.actions = kept;
                if (val && val !== 'close') e.closeOnClick = false;
                return this.changed();
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
            if (key === 'scale3d') { e.scale3d = M.clamp(M.num(val, 1), 0.1, 10); return this.changed(); }
            if (key === 'hitboxW') { e.hitboxW = M.clamp(M.num(val, 1), 0.2, 8); return this.changed(); }
            if (key === 'hitboxH') { e.hitboxH = M.clamp(M.num(val, 2), 0.2, 8); return this.changed(); }
            if (key === 'min' || key === 'max') { e[key] = M.num(val, e[key]); return this.changed(); }
            if (key === 'step') { e.step = Math.max(0.01, M.num(val, 1)); return this.changed(); }
            if (key === 'varName') { e.varName = String(val || 'qty').trim(); return this.changed(); }
            if (key === 'spinStyle') {
                e.spinStyle = val;
                if (this.previewSpins) delete this.previewSpins[e.id];
                this.fitRouletteFrame(e);
                return this.changed();
            }
            if (key === 'reels') {
                e.reels = M.clamp(M.int(val, 3), 1, 5);
                if (this.previewSpins) delete this.previewSpins[e.id];
                this.fitRouletteFrame(e);
                return this.changed();
            }
            if (key === 'cardCount') {
                e.cardCount = M.clamp(M.int(val, 5), 3, 9);
                if (this.previewSpins) delete this.previewSpins[e.id];
                this.fitRouletteFrame(e);
                return this.changed();
            }
            if (key === 'slotSize') { e.slotSize = M.clamp(M.int(val, 44), 16, 128); return this.changed(); }
            if (key === 'slotGap') { e.slotGap = M.clamp(M.int(val, 6), 0, 32); return this.changed(); }
            if (key === 'durationSec') { e.durationSec = M.clamp(M.num(val, 4.2), 1, 15); return this.changed(); }
            if (key === 'contentW') { e.contentW = Math.max(e.w, M.int(val, e.w)); return this.changed(); }
            if (key === 'contentH') { e.contentH = Math.max(e.h, M.int(val, e.h)); return this.changed(); }
            if (key === 'stepPx') { e.stepPx = M.clamp(M.int(val, 28), 4, 200); return this.changed(); }
            if (key === 'modelId' || key === 'item') { e[key] = String(val).trim(); return this.changed(); }
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
            if (type === 'custom_model' && GS.Items) {
                GS.Items.pick('', { tab: 'models', title: 'Choose a 3D Model (ModelEngine / BetterModel)' }).then(id => {
                    if (id) { this.addElement('custom_model'); const e = this.element(); e.modelId = id; e.name = itemName(id); this.changed(); }
                });
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

        pickModel() {
            const e = this.element();
            if (!e || e.type !== 'custom_model' || !GS.Items) return;
            GS.Items.pick(e.modelId, { tab: 'models', title: 'Choose a 3D Model (ModelEngine / BetterModel)' }).then(id => {
                if (!id) return;
                this.checkpoint();
                const auto = !e.name || /^3D Model \d+$/.test(e.name) || e.name === itemName(e.modelId);
                e.modelId = id;
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
                const hit = this.menu().elements.filter(e => !e.hidden && !e.locked && e.x < x + w && e.x + e.w > x && e.y < y + h && e.y + e.h > y).map(e => e.id);
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
                if (this.previewMode) {
                    const pt = toLocal(ev);
                    if (this.dollGrab(ev, pt)) return;
                    const hit = this.hitTest(pt);
                    const panArea = !hit ? this.menu().elements.slice().reverse().find(a => a.type === 'scroll_area' && !a.hidden && a.scrollMode === 'pan2d' && pt.x >= a.x && pt.y >= a.y && pt.x < a.x + a.w && pt.y < a.y + a.h) : null;
                    if (panArea) {
                        const sx0 = ev.clientX, sy0 = ev.clientY;
                        const o0 = this.scrollOffset(panArea.id);
                        const maxX = Math.max(0, (panArea.contentW || panArea.w) - panArea.w);
                        const maxY = Math.max(0, (panArea.contentH || panArea.h) - panArea.h);
                        let panned = false;
                        const mv = (mEv) => {
                            const dx = (mEv.clientX - sx0) / this.zoom, dy = (mEv.clientY - sy0) / this.zoom;
                            if (!panned && Math.abs(dx) + Math.abs(dy) < 3) return;
                            panned = true;
                            this.previewScroll[panArea.id] = { x: M.clamp(o0.x - dx, 0, maxX), y: M.clamp(o0.y - dy, 0, maxY) };
                            this.renderCanvas();
                        };
                        const up = () => {
                            window.removeEventListener('mousemove', mv);
                            window.removeEventListener('mouseup', up);
                            if (!panned) this.previewClick(pt);
                        };
                        window.addEventListener('mousemove', mv);
                        window.addEventListener('mouseup', up);
                        return;
                    }
                    this.previewClick(pt);
                    return;
                }
                if (ev.target.closest('.gs-turn')) { this.dragTurn(ev); return; }
                const handle = ev.target.closest('.gs-handle');
                const elDiv = ev.target.closest('.gs-el');
                const additive = ev.ctrlKey || ev.shiftKey || ev.metaKey;
                let id = handle ? this.selected : (elDiv && !(this.element(elDiv.dataset.id) || {}).locked ? elDiv.dataset.id : null);
                if (!handle && elDiv && ev.altKey) {
                    // Alt+click: the next element underneath the one selected (cycles through the stack)
                    const pt = toLocal(ev);
                    const under = this.menu().elements.filter(e => !e.hidden && !e.locked && pt.x >= e.x && pt.y >= e.y && pt.x < e.x + e.w && pt.y < e.y + e.h).reverse();
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
                const guidesEl = $('#gs-guides');
                const m = this.menu();
                const refXs = [Math.round(m.width / 2)];
                const refYs = [Math.round(m.height / 2)];
                m.elements.forEach(o => {
                    if (o.hidden || origs.has(o.id)) return;
                    refXs.push(o.x, Math.round(o.x + o.w / 2), o.x + o.w);
                    refYs.push(o.y, Math.round(o.y + o.h / 2), o.y + o.h);
                });
                const onMove = (mv) => {
                    const p = toLocal(mv);
                    const dx = p.x - start.x, dy = p.y - start.y;
                    if (!moved && Math.abs(dx) * this.zoom < 3 && Math.abs(dy) * this.zoom < 3) return;
                    if (!moved) { this.checkpoint(); moved = true; }
                    if (mode === 'move') {
                        // the element under the mouse snaps + magnetizes to smart alignment guides
                        let ddx = snap(orig.x + dx) - orig.x, ddy = snap(orig.y + dy) - orig.y;
                        let gx = null, gy = null;
                        if (!mv.altKey) {
                            const candX = orig.x + ddx;
                            const ptsX = [candX, Math.round(candX + orig.w / 2), candX + orig.w];
                            let bestDx = 5;
                            for (const px of ptsX) for (const rx of refXs) {
                                const diff = rx - px;
                                if (Math.abs(diff) < Math.abs(bestDx)) { bestDx = diff; gx = rx; }
                            }
                            if (gx != null) ddx += bestDx;
                            const candY = orig.y + ddy;
                            const ptsY = [candY, Math.round(candY + orig.h / 2), candY + orig.h];
                            let bestDy = 5;
                            for (const py of ptsY) for (const ry of refYs) {
                                const diff = ry - py;
                                if (Math.abs(diff) < Math.abs(bestDy)) { bestDy = diff; gy = ry; }
                            }
                            if (gy != null) ddy += bestDy;
                        }
                        if (guidesEl) {
                            guidesEl.innerHTML = (gx != null ? `<div class="gs-guide-v" style="left:${gx}px"></div>` : '')
                                + (gy != null ? `<div class="gs-guide-h" style="top:${gy}px"></div>` : '');
                        }
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
                    if (guidesEl) guidesEl.innerHTML = '';
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

            // mouse wheel = scroll pages in preview, or zoom at the mouse while editing (Shift + wheel = scroll sideways)
            pb.addEventListener('wheel', (ev) => {
                if (this.previewMode && !ev.ctrlKey) {
                    const pt = toLocal(ev);
                    const sArea = this.menu().elements.slice().reverse().find(a => a.type === 'scroll_area' && !a.hidden && pt.x >= a.x && pt.y >= a.y && pt.x < a.x + a.w && pt.y < a.y + a.h);
                    if (sArea) {
                        ev.preventDefault();
                        const dyRaw = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
                        const dir = dyRaw > 0 ? 1 : -1;
                        const step = M.int(sArea.stepPx, 28);
                        const cur = Object.assign({}, this.scrollOffset(sArea.id));
                        const maxX = Math.max(0, (sArea.contentW || sArea.w) - sArea.w);
                        const maxY = Math.max(0, (sArea.contentH || sArea.h) - sArea.h);
                        if (sArea.scrollMode === 'horizontal' || (ev.shiftKey && sArea.scrollMode === 'pan2d')) {
                            cur.x = M.clamp(cur.x + dir * step, 0, maxX);
                        } else {
                            cur.y = M.clamp(cur.y + dir * step, 0, maxY);
                        }
                        this.previewScroll[sArea.id] = cur;
                        this.renderCanvas();
                        return;
                    }
                    const m = this.menu();
                    const dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
                    const targetId = dy > 0 ? m.nextPage : dy < 0 ? m.prevPage : '';
                    if (targetId) {
                        const idx = this.project.menus.findIndex(x => x.id === targetId);
                        if (idx >= 0) {
                            ev.preventDefault();
                            this.menuIndex = idx;
                            this.renderAll();
                            this.zoomFit();
                            return;
                        }
                    }
                }
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
                const lock = ev.target.closest('[data-lock]');
                if (lock) {
                    const e = this.element(lock.dataset.lock);
                    if (e) { this.checkpoint(); e.locked = !e.locked; this.changed(); }
                    return;
                }
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
                const ptab = ev.target.closest('[data-prop-tab]');
                if (ptab) {
                    this.propTab = ptab.dataset.propTab;
                    this.renderProps();
                    return;
                }
                const vbtn = ev.target.closest('[data-var-field]');
                if (vbtn && GS.ActionBuilder) {
                    const fk = vbtn.dataset.varField;
                    const id = 'gsf-' + fk.replace(/[^a-z0-9]/gi, '_');
                    const inp = document.getElementById(id);
                    if (inp) {
                        GS.ActionBuilder.openVarMenu(vbtn, (token) => {
                            const st = inp.selectionStart != null ? inp.selectionStart : inp.value.length;
                            const en = inp.selectionEnd != null ? inp.selectionEnd : st;
                            inp.value = inp.value.slice(0, st) + token + inp.value.slice(en);
                            this.applyField(fk, inp.value, false);
                        });
                    }
                    return;
                }
                const pick = ev.target.closest('[data-pick]');
                if (pick) return this.setImage(pick.dataset.pick);
                const gpick = ev.target.closest('[data-gen-pick]');
                if (gpick) return this.shapeForButton(gpick.dataset.genPick);
                const clear = ev.target.closest('[data-clear]');
                if (clear) return this.clearImage(clear.dataset.clear);
                const fdel = ev.target.closest('[data-frame-del]');
                if (fdel) return this.removeFrame(Number(fdel.dataset.frameDel));
                const rdel = ev.target.closest('[data-del-reward]');
                if (rdel) {
                    const el = this.element();
                    if (el && el.type === 'roulette' && Array.isArray(el.rewards) && el.rewards.length > 1) {
                        this.checkpoint();
                        el.rewards.splice(Number(rdel.dataset.delReward), 1);
                        this.changed();
                    }
                    return;
                }
                const rpick = ev.target.closest('[data-pick-reward]');
                if (rpick && GS.Items) {
                    const el = this.element(), idx = Number(rpick.dataset.pickReward);
                    if (el && el.type === 'roulette' && el.rewards && el.rewards[idx]) {
                        GS.Items.pick(el.rewards[idx].item || '').then(id => {
                            if (!id) return;
                            this.checkpoint();
                            el.rewards[idx].item = id;
                            this.changed();
                        });
                    }
                    return;
                }
                const act = ev.target.closest('[data-action]');
                if (!act) return;
                const a = act.dataset.action;
                if (a === 'add-reward') {
                    const el = this.element();
                    if (el && el.type === 'roulette') {
                        this.checkpoint();
                        el.rewards = el.rewards || [];
                        el.rewards.push({ id: 'r' + (el.rewards.length + 1), name: 'New Prize', item: 'minecraft:emerald', color: '#22c55e', weight: 15, actions: ['console:give %player_name% emerald 8'] });
                        this.changed();
                    }
                }
                else if (a === 'test-spin') {
                    const el = this.element();
                    if (el && el.type === 'roulette') {
                        if (!this.previewMode) this.togglePreview();
                        this.startPreviewSpin(el.id);
                    }
                }
                else if (a === 'fit-roulette') {
                    const el = this.element();
                    if (el && el.type === 'roulette') {
                        this.checkpoint();
                        this.fitRouletteFrame(el);
                        this.changed();
                    }
                }
                else if (a === 'add-spin-btn') {
                    const el = this.element();
                    if (el && el.type === 'roulette') {
                        const m = this.menu();
                        const b = M.newElement('button', m);
                        b.name = 'Spin ' + (el.name || 'Crate');
                        b.label = '&e&lSPIN!';
                        b.w = 96; b.h = 22;
                        b.x = Math.round(el.x + (el.w - b.w) / 2);
                        b.y = Math.min(m.height - b.h - 4, el.y + el.h + 8);
                        b.actions = ['spin:' + el.id];
                        if (el.scrollGroup) b.scrollGroup = el.scrollGroup;
                        this.checkpoint();
                        m.elements.push(b);
                        this.selected = b.id;
                        this.changed();
                    }
                }
                else if (a === 'assign-scroll-children') {
                    const area = this.element();
                    if (area && area.type === 'scroll_area') {
                        let cnt = 0;
                        this.checkpoint();
                        this.menu().elements.forEach(x => {
                            if (x === area || x.type === 'scroll_area') return;
                            if (x.x >= area.x && x.y >= area.y && x.x < area.x + (area.contentW || area.w) && x.y < area.y + (area.contentH || area.h)) {
                                x.scrollGroup = area.id;
                                cnt++;
                            }
                        });
                        this.changed();
                        GS.toast(`Assigned ${cnt} elements into ${area.name || area.id}`, 'ok');
                    }
                }
                else if (a === 'fit-image') this.fitImage();
                else if (a === 'add-frames') this.addFrames();
                else if (a === 'clear-frames') this.clearFrames();
                else if (a === 'play-motion') this.playMotion();
                else if (a === 'edit-gen') this.editGenerated();
                else if (a === 'pick-item') this.pickItem();
                else if (a === 'pick-model') this.pickModel();
                else if (a === 'open-custom-assets') GS.CustomAssets && GS.CustomAssets.openManagerDialog(() => this.renderAll());
                else if (a === 'jump-link') this.jumpLink();
                else if (a === 'create-link') this.createLinkedPage();
                else if (a === 'link-confirm') this.linkConfirmDialog();
                else if (a === 'add-next-page') this.addNextPage();
                else if (a === 'open-flow') this.openFlowDialog();
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
            const e = this.menu().elements.slice().reverse().find(x => x.type === 'player_model' && !x.hidden && x.turn !== 'spin'
                && p.x >= x.x && p.y >= x.y && p.x < x.x + x.w && p.y < x.y + x.h);
            if (!e) return false;
            this._dolls = this._dolls || {};
            const yaw0 = (this._dolls[e.id] && this._dolls[e.id].yaw != null) ? this._dolls[e.id].yaw : M.num(e.angle, 0);
            const grab = this._grab = { id: e.id, x: ev.clientX, yaw0, moved: false };
            const onMove = (mv) => {
                if (this._grab !== grab) return;
                const dx = mv.clientX - grab.x;
                if (Math.abs(dx) > 2) grab.moved = true;
                const newYaw = grab.yaw0 - dx * 1.2;
                this._dolls[e.id] = { yaw: newYaw, baseYaw: newYaw };      // drag right = the front turns right
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
                if (e.type !== 'player_model' || e.hidden || (this._grab && this._grab.id === e.id)) return;
                const cur = this._dolls[e.id] || {};
                const base = cur.baseYaw != null ? cur.baseYaw : M.num(e.angle, 0);
                if (e.turn === 'mouse') {
                    // the whole player turns as the cursor moves over the menu: one side to the other = a full turn
                    const rel = M.clamp((p.x - (e.x + e.w / 2)) / Math.max(1, m.width / 2), -1, 1);
                    this._dolls[e.id] = { yaw: base - rel * 180, baseYaw: base };   // the front follows the cursor's side
                } else if (e.turn === 'cursor') {
                    // the head looks at the cursor (up to 60° aside, 50° up / down)
                    const hx = e.x + e.w / 2, hy = e.y + e.h * 0.12;
                    const dist = Math.max(e.h, 40);
                    const yawTo = Math.atan2(p.x - hx, dist) * 180 / Math.PI;
                    const pitchTo = Math.atan2(p.y - hy, dist) * 180 / Math.PI;
                    this._dolls[e.id] = { yaw: base, baseYaw: base, headYaw: M.clamp(-yawTo, -60, 60), headPitch: M.clamp(-pitchTo, -50, 50) };
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
                if (e.hidden || (e.type !== 'button' && e.type !== 'input')) continue;
                const eff = this.effectivePos(e);
                if (eff.area && (p.x < eff.area.x || p.y < eff.area.y || p.x >= eff.area.x + eff.area.w || p.y >= eff.area.y + eff.area.h)) continue;
                if (p.x >= eff.x && p.y >= eff.y && p.x < eff.x + e.w && p.y < eff.y + e.h) return e;
            }
            return null;
        },
        tooltipAt(p) {
            const els = this.menu().elements;
            for (let i = els.length - 1; i >= 0; i--) {
                const e = els[i];
                if (e.hidden || !e.tooltip || !String(e.tooltip).trim()) continue;
                if (p.x >= e.x && p.y >= e.y && p.x < e.x + e.w && p.y < e.y + e.h) return e;
            }
            return null;
        },
        previewHover(p) {
            const hit = this.hitTest(p);
            $$('#gs-elements .gs-el').forEach(d => d.classList.toggle('hover', !!hit && d.dataset.id === hit.id));
            if (this._mo) this._mo.hovered = hit ? hit.id : null;
            const box = $('#gs-tooltip');
            if (!box) return;
            const tipEl = this.tooltipAt(p);
            if (!tipEl) { box.style.display = 'none'; return; }
            const html = String(tipEl.tooltip).split('\n').map(line => mcToHtml(samplePapi(line), '#ffffff')).join('<br>');
            box.innerHTML = html;
            box.style.display = 'block';
            const m = this.menu();
            const bw = box.offsetWidth || 80, bh = box.offsetHeight || 20;
            let tx = p.x + 8, ty = p.y + 8;
            if (tx + bw > m.width - 2) tx = Math.max(2, p.x - bw - 6);
            if (ty + bh > m.height - 2) ty = Math.max(2, p.y - bh - 6);
            box.style.left = Math.round(tx) + 'px';
            box.style.top = Math.round(ty) + 'px';
        },
        previewClick(p) {
            const hit = this.hitTest(p);
            if (!hit) return;
            if (this._mo) this._mo.press[hit.id] = this._mo.now();
            const cur = this.menu();
            if (hit.type === 'input') {
                const vname = hit.varName || 'qty';
                const curV = (vname in this.previewVars) ? this.previewVars[vname] : (hit.defaultValue == null ? '1' : String(hit.defaultValue));
                const nextV = window.prompt(hit.promptTitle || `Enter ${vname}`, curV);
                if (nextV == null) return;
                let cleaned = String(nextV).trim();
                if (hit.inputType !== 'text') {
                    let n = Number(cleaned);
                    if (!Number.isFinite(n)) { GS.toast('Please enter a valid number', 'error'); return; }
                    if (hit.min != null) n = Math.max(Number(hit.min), n);
                    if (hit.max != null) n = Math.min(Number(hit.max), n);
                    cleaned = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
                }
                this.previewVars[vname] = cleaned;
                this.renderCanvas();
                if (!(hit.actions && hit.actions.length)) return;
            }
            const acts = (hit.actions || []).map(a => String(a).trim()).filter(Boolean);
            acts.forEach(a => {
                if (/^set:/i.test(a)) {
                    const kv = a.slice(4), eq = kv.indexOf('=');
                    if (eq > 0) this.previewVars[kv.slice(0, eq).trim()] = this.resolvePreviewVars(kv.slice(eq + 1).trim());
                } else if (/^add:/i.test(a)) {
                    const kv = a.slice(4), eq = kv.indexOf('=');
                    if (eq > 0) {
                        const k = kv.slice(0, eq).trim();
                        const d = Number(this.resolvePreviewVars(kv.slice(eq + 1).trim())) || 0;
                        const c = Number(this.resolvePreviewVars('{' + k + '}')) || 0;
                        this.previewVars[k] = String(c + d);
                    }
                } else if (/^mul:/i.test(a)) {
                    const kv = a.slice(4), eq = kv.indexOf('=');
                    if (eq > 0) {
                        const k = kv.slice(0, eq).trim();
                        const m = Number(this.resolvePreviewVars(kv.slice(eq + 1).trim())) || 1;
                        const c = Number(this.resolvePreviewVars('{' + k + '}')) || 0;
                        this.previewVars[k] = String(c * m);
                    }
                }
            });
            const open = acts.map(a => /^open:([^?]+)(?:\?(.*))?$/.exec(a)).find(Boolean);
            const spinAct = acts.map(a => /^spin(?::(.*))?$/i.exec(a)).find(Boolean);
            const scrollAct = acts.map(a => /^scroll:([^:]+):(.+)$/i.exec(a)).find(Boolean);
            const hasBack = acts.some(a => a.toLowerCase() === 'back');
            const hasNext = acts.some(a => a.toLowerCase() === 'next');
            const hasPrev = acts.some(a => a.toLowerCase() === 'prev');
            const others = acts.filter(a => !/^(open:|spin(?::|$)|scroll:|back$|next$|prev$|set:|add:|mul:)/i.test(a));
            if (others.length) {
                const msgList = others.map(o => {
                    const res = this.resolvePreviewVars(o);
                    if (/^(buy|sell|trade|pay|sellhand):/i.test(res)) return '[Vault Preview] ' + res;
                    return res;
                });
                GS.toast(msgList.join('  ·  '));
            }
            if (spinAct) this.startPreviewSpin((spinAct[1] || '').trim());
            if (scrollAct) {
                const areaId = scrollAct[1].trim();
                const area = cur.elements.find(a => a.id === areaId && a.type === 'scroll_area');
                if (area) {
                    if (/^reset$/i.test(scrollAct[2].trim())) this.previewScroll[area.id] = { x: 0, y: 0 };
                    else {
                        const [dxS, dyS] = scrollAct[2].split(':');
                        const o = Object.assign({}, this.scrollOffset(area.id));
                        const maxX = Math.max(0, (area.contentW || area.w) - area.w);
                        const maxY = Math.max(0, (area.contentH || area.h) - area.h);
                        o.x = M.clamp(o.x + (Number(dxS) || 0), 0, maxX);
                        o.y = M.clamp(o.y + (Number(dyS) || 0), 0, maxY);
                        this.previewScroll[area.id] = o;
                    }
                    this.renderCanvas();
                }
            }
            if (open) {
                if (open[2]) {
                    open[2].split('&').forEach(pair => {
                        const eq = pair.indexOf('=');
                        if (eq > 0) {
                            const k = decodeURIComponent(pair.slice(0, eq).trim());
                            const v = decodeURIComponent(pair.slice(eq + 1).trim());
                            this.previewVars[k] = this.resolvePreviewVars(v);
                        }
                    });
                }
                const targetId = this.resolvePreviewVars(open[1].trim());
                const i = this.project.menus.findIndex(m => m.id === targetId);
                if (i >= 0) {
                    this.previewHistory.push(cur.id);
                    this.menuIndex = i; this.renderAll(); this.zoomFit();
                } else GS.toast(`Menu "${targetId}" does not exist`, 'error');
            } else if (hasBack) {
                const prevId = this.previewHistory.pop();
                const i = prevId ? this.project.menus.findIndex(m => m.id === prevId) : -1;
                if (i >= 0) { this.menuIndex = i; this.renderAll(); this.zoomFit(); }
                else GS.toast('(menu closes — no previous page)');
            } else if (hasNext && cur.nextPage) {
                const i = this.project.menus.findIndex(m => m.id === cur.nextPage);
                if (i >= 0) { this.menuIndex = i; this.renderAll(); this.zoomFit(); }
            } else if (hasPrev && cur.prevPage) {
                const i = this.project.menus.findIndex(m => m.id === cur.prevPage);
                if (i >= 0) { this.menuIndex = i; this.renderAll(); this.zoomFit(); }
            } else if (hit.closeOnClick || acts.includes('close')) GS.toast('(menu closes)');
            else if (acts.some(a => /^(set|add|mul):/i.test(a))) this.renderCanvas();
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
            if (!this.previewMode) this.previewHistory = [];
            this.renderCanvas();
            this.renderStatus();
            if (this.previewMode) GS.toast('Preview: hover and click the buttons (wheel turns linked pages). Press P or Esc to edit again.');
        },

        /* ───────────── UI-to-UI linking, pagination & flow map ───────────── */

        jumpLink() {
            const e = this.element();
            if (!e || e.type !== 'button') return;
            const open = (e.actions || []).map(s => /^open:(.+)$/.exec(String(s).trim())).find(Boolean);
            if (!open) return;
            const idx = this.project.menus.findIndex(m => m.id === open[1].trim());
            if (idx >= 0) this.selectMenu(idx);
            else GS.toast(`Menu "${open[1].trim()}" does not exist`, 'error');
        },

        async createLinkedPage() {
            const e = this.element();
            if (!e || e.type !== 'button') return;
            const baseName = (e.label || e.name || 'sub_menu').replace(/[&§][0-9a-fk-or]/gi, '').trim() || 'sub_menu';
            const title = await window.kzPrompt('New linked menu title', baseName);
            if (title == null || !title.trim()) return;
            this.checkpoint();
            const cur = this.menu();
            const id = this.uniqueMenuId(title.trim());
            const m = M.newMenu(id, title.trim());
            m.width = cur.width; m.height = cur.height; m.fullscreen = !!cur.fullscreen;
            // copy window backdrop image if present so style matches
            const bg = cur.elements.find(x => x.type === 'image' && x.x === 0 && x.y === 0 && x.w === cur.width && x.h === cur.height);
            if (bg) m.elements.push(Object.assign(M.newElement('image', m), { name: bg.name, x: 0, y: 0, w: bg.w, h: bg.h, image: bg.image, detail: bg.detail || 1 }));
            m.elements.push(Object.assign(M.newElement('text', m), { name: 'Title', x: Math.round((m.width - 160) / 2), y: 6, w: 160, h: 14, text: '&l' + title.trim(), align: 'center' }));
            m.elements.push(Object.assign(M.newElement('button', m), { name: 'Back', label: '← Back', x: m.width - 82, y: m.height - 27, w: 70, h: 18, actions: ['back'] }));
            this.project.menus.push(m);
            const kept = (e.actions || []).filter(s => {
                const t = String(s).trim().toLowerCase();
                return !(t.startsWith('open:') || t === 'back' || t === 'close' || t === 'next' || t === 'prev');
            });
            kept.push('open:' + id);
            e.actions = kept;
            e.closeOnClick = false;
            this.menuIndex = this.project.menus.length - 1;
            this.selected = null;
            this.changed();
            this.zoomFit();
            GS.toast(`Created & linked "${id}"`, 'ok');
        },

        wireConfirmPair(triggerBtn, confirmMenu) {
            const navRe = /^(open:|back$|close$|next$|prev$)/i;
            const actions = (triggerBtn.actions || []).map(s => String(s).trim()).filter(Boolean);
            const payload = actions.filter(a => !navRe.test(a));
            triggerBtn.actions = ['open:' + confirmMenu.id];
            triggerBtn.closeOnClick = false;

            const stripFmt = (s) => String(s || '').replace(/[&§][0-9a-fk-or]/gi, '').trim();
            const yesBtn = confirmMenu.elements.find(el => el.type === 'button' && /^(✓|✔)?\s*(yes|ok|confirm|accept)\b/i.test(stripFmt(el.label || el.name)));
            const noBtn = confirmMenu.elements.find(el => el.type === 'button' && /^(✕|✖|×)?\s*(no|cancel|back|decline)\b/i.test(stripFmt(el.label || el.name)));
            if (yesBtn && payload.length) {
                const keptYes = (yesBtn.actions || []).filter(a => !navRe.test(String(a).trim()));
                yesBtn.actions = keptYes.concat(payload, ['close']);
                yesBtn.closeOnClick = false;
            }
            if (noBtn) {
                noBtn.actions = ['back'];
                noBtn.closeOnClick = false;
            }
        },

        async linkConfirmDialog() {
            const e = this.element();
            if (!e || e.type !== 'button') return;
            const cur = this.menu();
            const existing = this.project.menus.find(mm => mm !== cur && /confirm|sure/i.test(`${mm.id} ${mm.title || ''}`));
            this.checkpoint();
            if (existing) {
                this.wireConfirmPair(e, existing);
                this.changed();
                GS.toast(`Linked "${e.label || e.name}" → confirm "${existing.id}" (Yes executes action, No returns Back)`, 'ok');
                return;
            }
            const labelClean = (e.label || e.name || 'Action').replace(/[&§][0-9a-fk-or]/gi, '').trim() || 'Action';
            const cid = this.uniqueMenuId('confirm');
            const cm = M.newMenu(cid, `Confirm: ${labelClean}`);
            cm.width = cur.width; cm.height = cur.height; cm.fullscreen = !!cur.fullscreen;
            cm.backdrop = cur.backdrop; cm.backdropAlpha = cur.backdropAlpha;
            const bg = cur.elements.find(x => x.type === 'image' && x.x === 0 && x.y === 0 && x.w === cur.width && x.h === cur.height);
            if (bg) cm.elements.push(Object.assign(M.newElement('image', cm), { name: bg.name, x: 0, y: 0, w: bg.w, h: bg.h, image: bg.image, detail: bg.detail || 1 }));
            const refBtn = cur.elements.find(x => x.type === 'button' && x.image);
            const bw = refBtn ? refBtn.w : 88, bh = refBtn ? refBtn.h : 22, gap = 16;
            const cy = Math.round(cm.height * 0.56);
            const xYes = Math.round(cm.width / 2 - bw - gap / 2);
            const xNo = Math.round(cm.width / 2 + gap / 2);
            const style = refBtn ? { image: refBtn.image, hoverImage: refBtn.hoverImage || null, detail: refBtn.detail || 1, labelColor: refBtn.labelColor || '#ffffff', labelScale: refBtn.labelScale || 1 } : {};
            cm.elements.push(Object.assign(M.newElement('text', cm), {
                name: 'Title', x: Math.round((cm.width - 220) / 2), y: Math.max(12, cy - 42), w: 220, h: 16,
                text: '&lAre you sure?', align: 'center', scale: 1.25
            }));
            cm.elements.push(Object.assign(M.newElement('text', cm), {
                name: 'Prompt', x: Math.round((cm.width - 240) / 2), y: Math.max(28, cy - 22), w: 240, h: 12,
                text: `&7Confirm &f${labelClean}&7?`, color: '#cccccc', align: 'center'
            }));
            cm.elements.push(Object.assign(M.newElement('button', cm), style, {
                name: 'Yes', label: '&aYes', x: xYes, y: cy, w: bw, h: bh, actions: ['close']
            }));
            cm.elements.push(Object.assign(M.newElement('button', cm), style, {
                name: 'No', label: '&cNo', x: xNo, y: cy, w: bw, h: bh, actions: ['back']
            }));
            this.project.menus.push(cm);
            this.wireConfirmPair(e, cm);
            this.changed();
            GS.toast(`Created Confirm menu "${cid}" and linked button "${labelClean}"`, 'ok');
        },

        addNextPage() {
            const cur = this.menu();
            this.checkpoint();
            const stem = cur.id.replace(/_p\d+$/, '');
            let n = 2;
            while (this.project.menus.some(x => x.id === `${stem}_p${n}`)) n++;
            const id = `${stem}_p${n}`;
            const next = M.newMenu(id, `${cur.title || cur.id} (${n})`);
            next.width = cur.width; next.height = cur.height; next.fullscreen = !!cur.fullscreen;
            next.backdrop = cur.backdrop; next.backdropAlpha = cur.backdropAlpha;
            const bg = cur.elements.find(x => x.type === 'image' && x.x === 0 && x.y === 0 && x.w === cur.width && x.h === cur.height);
            if (bg) next.elements.push(Object.assign(M.newElement('image', next), { name: bg.name, x: 0, y: 0, w: bg.w, h: bg.h, image: bg.image, detail: bg.detail || 1 }));
            const titleEl = cur.elements.find(x => x.type === 'text' && /^title$/i.test(x.name));
            if (titleEl) next.elements.push(Object.assign(M.newElement('text', next), { name: 'Title', x: titleEl.x, y: titleEl.y, w: titleEl.w, h: titleEl.h, text: `${cur.title || cur.id} (${n})`, color: titleEl.color, scale: titleEl.scale || 1, align: titleEl.align }));
            // link pagination both ways
            cur.nextPage = id;
            next.prevPage = cur.id;
            if (!cur.elements.some(x => x.type === 'button' && (x.actions || []).some(a => a.trim() === 'next' || a.trim() === 'open:' + id))) {
                cur.elements.push(Object.assign(M.newElement('button', cur), { name: 'Next Page', label: 'Next ▶', x: cur.width - 78, y: cur.height - 26, w: 66, h: 17, actions: ['next'] }));
            }
            next.elements.push(Object.assign(M.newElement('button', next), { name: 'Prev Page', label: '◀ Prev', x: 12, y: next.height - 26, w: 66, h: 17, actions: ['prev'] }));
            this.project.menus.splice(this.menuIndex + 1, 0, next);
            this.menuIndex++;
            this.selected = null;
            this.changed();
            this.zoomFit();
            GS.toast(`Added page "${id}" linked to "${cur.id}"`, 'ok');
        },

        openFlowDialog() {
            const p = this.project;
            const menus = p.menus;
            const ids = new Set(menus.map(m => m.id));
            const incoming = new Map(menus.map(m => [m.id, 0]));
            const edges = [];
            menus.forEach(m => {
                if (m.nextPage) {
                    edges.push({ from: m.id, to: m.nextPage, kind: 'page', field: 'nextPage', label: 'nextPage', broken: !ids.has(m.nextPage) });
                    if (ids.has(m.nextPage)) incoming.set(m.nextPage, (incoming.get(m.nextPage) || 0) + 1);
                }
                if (m.prevPage) {
                    edges.push({ from: m.id, to: m.prevPage, kind: 'page', field: 'prevPage', label: 'prevPage', broken: !ids.has(m.prevPage) });
                    if (ids.has(m.prevPage)) incoming.set(m.prevPage, (incoming.get(m.prevPage) || 0) + 1);
                }
                m.elements.forEach(e => {
                    if ((e.type !== 'button' && e.type !== 'input') || e.hidden) return;
                    (e.actions || []).forEach(a => {
                        const rawAction = String(a).trim();
                        const t = /^open:(.+)$/i.exec(rawAction);
                        if (t) {
                            const raw = t[1].trim();
                            const qi = raw.indexOf('?');
                            const tid = (qi >= 0 ? raw.slice(0, qi) : raw).trim();
                            if (!tid) return;
                            const rawLbl = String(e.label || e.name || 'btn').replace(/[&§][0-9a-fk-or]/gi, '').trim() || 'btn';
                            edges.push({ from: m.id, to: tid, kind: 'open', btnId: e.id, rawAction, label: rawLbl, broken: !/\{[^}]+\}/.test(tid) && !ids.has(tid) });
                            if (ids.has(tid)) incoming.set(tid, (incoming.get(tid) || 0) + 1);
                        }
                    });
                });
            });

            const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(menus.length))));
            const cardW = 188, cardH = 88, gapX = 56, gapY = 42, pad = 24;
            const pos = new Map();
            menus.forEach((m, idx) => {
                const c = idx % cols, r = Math.floor(idx / cols);
                pos.set(m.id, { x: pad + c * (cardW + gapX), y: pad + r * (cardH + gapY) });
            });
            const rows = Math.ceil(menus.length / cols);
            const canvasW = Math.max(640, pad * 2 + cols * cardW + Math.max(0, cols - 1) * gapX);
            const canvasH = Math.max(260, pad * 2 + rows * cardH + Math.max(0, rows - 1) * gapY);

            const svgPaths = edges.map(ed => {
                const a = pos.get(ed.from), b = pos.get(ed.to);
                if (!a || !b) return '';
                const x1 = a.x + cardW / 2, y1 = a.y + cardH / 2;
                const x2 = b.x + cardW / 2, y2 = b.y + cardH / 2;
                const dx = x2 - x1, dy = y2 - y1;
                const cx1 = x1 + dx * 0.35 - dy * 0.14, cy1 = y1 + dy * 0.35 + dx * 0.14;
                const cx2 = x1 + dx * 0.65 - dy * 0.14, cy2 = y1 + dy * 0.65 + dx * 0.14;
                const mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
                const my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
                const col = ed.broken ? '#e5534b' : ed.kind === 'page' ? '#46c882' : '#52a0f0';
                const dash = ed.kind === 'page' ? 'stroke-dasharray="5 4"' : '';
                const tagTxt = ed.label.length > 16 ? ed.label.slice(0, 15) + '…' : ed.label;
                const pillW = Math.max(36, tagTxt.length * 6.4 + 10);
                return `<path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="2" ${dash} marker-end="url(#${ed.kind === 'page' ? 'arr-p' : 'arr-o'})" opacity="0.85"/>`
                    + `<rect x="${(mx - pillW / 2).toFixed(1)}" y="${(my - 8).toFixed(1)}" width="${pillW.toFixed(1)}" height="16" rx="4" fill="#181c24" stroke="${col}" stroke-width="1"/>`
                    + `<text x="${mx.toFixed(1)}" y="${(my + 3.5).toFixed(1)}" text-anchor="middle" fill="#e6edf7" font-size="10" font-family="Segoe UI, sans-serif">${esc(tagTxt)}</text>`;
            }).join('');

            const cardsHtml = menus.map((m, idx) => {
                const pt = pos.get(m.id);
                const hasBack = m.elements.some(e => e.type === 'button' && (e.actions || []).some(a => a.trim().toLowerCase() === 'back'));
                const brokenCount = edges.filter(ed => ed.from === m.id && ed.broken).length;
                const isOrphan = idx > 0 && !m.command && (incoming.get(m.id) || 0) === 0;
                const tags = [];
                if (m.command) tags.push(`<span class="gs-page-badge">/${esc(m.command)}</span>`);
                if (hasBack) tags.push(`<span class="gs-page-badge">↩ back</span>`);
                if (m.nextPage) tags.push(`<span class="gs-page-badge page">→ ${esc(m.nextPage)}</span>`);
                if (brokenCount) tags.push(`<span class="gs-page-badge warn">${brokenCount} broken</span>`);
                if (isOrphan) tags.push(`<span class="gs-page-badge warn">unlinked</span>`);
                return `<div class="gs-flow-card ${idx === this.menuIndex ? 'active' : ''} ${isOrphan ? 'orphan' : ''}" data-flow-idx="${idx}" style="left:${pt.x}px;top:${pt.y}px">
                    <div class="gs-flow-title">${esc(m.title || m.id)}</div>
                    <div class="gs-flow-meta">${esc(m.id)} · ${m.width}×${m.height}</div>
                    <div class="gs-flow-tags">${tags.join('') || '<span class="gs-page-badge">page</span>'}</div>
                </div>`;
            }).join('');

            const opts = menus.map(m => `<option value="${esc(m.id)}">${esc(m.title || m.id)} (${esc(m.id)})</option>`).join('');
            const linksListHtml = edges.length
                ? edges.map((ed, i) => `<div class="gs-flow-link-row">
                    <span><b>${esc(ed.from)}</b> <code class="gs-page-badge ${ed.kind === 'page' ? 'page' : ''}">${esc(ed.label)}</code> → <b>${esc(ed.to)}</b>${ed.broken ? ' <em class="gs-page-badge warn">missing</em>' : ''}</span>
                    <button type="button" class="ghost-btn small danger gs-flow-unlink" data-unlink-idx="${i}">Unlink</button>
                  </div>`).join('')
                : `<div class="gs-muted small">No menu connections yet. Choose a mode above to link an existing button, confirm dialog, or page.</div>`;

            const body = `
                <div class="gs-flow-bar">
                  <label>From <select id="gs-flow-from">${opts}</select></label>
                  <label>Link type <select id="gs-flow-mode">
                    <option value="bind-btn">Existing button → Open menu</option>
                    <option value="confirm">Confirm flow (Button → Confirm → Yes / No)</option>
                    <option value="page">Pagination (Next / Prev page)</option>
                    <option value="back-btn">Existing button → Back</option>
                    <option value="new-btn">Create new styled button → Open menu</option>
                  </select></label>
                  <label id="gs-flow-btn-wrap">Button <select id="gs-flow-btn"></select></label>
                  <label id="gs-flow-to-wrap">Target <select id="gs-flow-to">${opts}</select></label>
                  <label id="gs-flow-label-wrap" style="display:none">Label <input type="text" id="gs-flow-label" placeholder="Button label" value="Open" /></label>
                  <button type="button" class="primary-btn small" id="gs-flow-apply">Apply Link</button>
                </div>
                <div class="gs-flow-canvas">
                  <div class="gs-flow-inner" style="width:${canvasW}px;height:${canvasH}px">
                    <svg class="gs-flow-svg" width="${canvasW}" height="${canvasH}">
                      <defs>
                        <marker id="arr-o" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#52a0f0"/></marker>
                        <marker id="arr-p" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="#46c882"/></marker>
                      </defs>
                      ${svgPaths}
                    </svg>
                    ${cardsHtml}
                  </div>
                </div>
                <div class="gs-flow-legend">
                  <span><i style="background:#52a0f0"></i>Button link (<code>open:</code>)</span>
                  <span><i style="background:#46c882"></i>Pagination (<code>nextPage / prevPage</code>)</span>
                  <span class="gs-muted">Click any page card to open &amp; edit it.</span>
                </div>
                <div class="gs-flow-links">
                  <div class="gs-sec-head">Active Connections (${edges.length})</div>
                  ${linksListHtml}
                </div>`;

            GS.modal('UI Flow & Connections', body, [['ok', 'Close', 'primary']], {
                cls: 'xwide',
                onOpen: (root, done) => {
                    const fromSel = root.querySelector('#gs-flow-from');
                    const modeSel = root.querySelector('#gs-flow-mode');
                    const btnSel = root.querySelector('#gs-flow-btn');
                    const toSel = root.querySelector('#gs-flow-to');
                    const btnWrap = root.querySelector('#gs-flow-btn-wrap');
                    const toWrap = root.querySelector('#gs-flow-to-wrap');
                    const labelWrap = root.querySelector('#gs-flow-label-wrap');
                    const labelInput = root.querySelector('#gs-flow-label');

                    fromSel.value = this.menu().id;
                    if (menus.length > 1) toSel.value = menus[(this.menuIndex + 1) % menus.length].id;

                    const syncControls = () => {
                        const fromM = menus.find(m => m.id === fromSel.value);
                        const btns = fromM ? fromM.elements.filter(e => e.type === 'button' && !e.hidden) : [];
                        const strip = (s) => String(s || '').replace(/[&§][0-9a-fk-or]/gi, '').trim();
                        btnSel.innerHTML = btns.length
                            ? btns.map(b => {
                                const nav = (b.actions || []).map(a => String(a).trim()).find(a => /^(open:|back$|next$|prev$|close$)/i.test(a));
                                return `<option value="${esc(b.id)}">${esc(strip(b.label || b.name) || b.id)}${nav ? ` [${esc(nav)}]` : ''}</option>`;
                            }).join('')
                            : '<option value="">(No buttons on this page)</option>';
                        if (this.selected && btns.some(b => b.id === this.selected)) btnSel.value = this.selected;

                        const mode = modeSel.value;
                        if (mode === 'confirm') {
                            const cm = menus.find(m => m.id !== fromSel.value && /confirm|sure/i.test(`${m.id} ${m.title || ''}`));
                            if (cm) toSel.value = cm.id;
                        }
                        btnWrap.style.display = ['bind-btn', 'confirm', 'back-btn'].includes(mode) ? '' : 'none';
                        toWrap.style.display = mode === 'back-btn' ? 'none' : '';
                        labelWrap.style.display = mode === 'new-btn' ? '' : 'none';
                    };

                    fromSel.addEventListener('change', syncControls);
                    modeSel.addEventListener('change', syncControls);
                    syncControls();

                    root.querySelector('#gs-flow-apply').addEventListener('click', () => {
                        const fromM = menus.find(m => m.id === fromSel.value);
                        const toM = menus.find(m => m.id === toSel.value);
                        const mode = modeSel.value;
                        if (!fromM) return;

                        if (mode === 'back-btn') {
                            const btn = fromM.elements.find(e => e.id === btnSel.value);
                            if (!btn) { GS.toast('This menu has no button to bind — pick "Create new styled button" instead', 'error'); return; }
                            this.checkpoint();
                            const kept = (btn.actions || []).filter(s => !/^(open:|back$|close$|next$|prev$)/i.test(String(s).trim()));
                            kept.push('back');
                            btn.actions = kept;
                            btn.closeOnClick = false;
                            this.changed();
                            done(null);
                            this.openFlowDialog();
                            GS.toast(`Wired "${btn.label || btn.name}" → back`, 'ok');
                            return;
                        }

                        if (!toM || fromM === toM) { GS.toast('Pick two different menus', 'error'); return; }

                        if (mode === 'page') {
                            this.checkpoint();
                            fromM.nextPage = toM.id;
                            toM.prevPage = fromM.id;
                            this.changed();
                            done(null);
                            this.openFlowDialog();
                            GS.toast(`Linked pagination: ${fromM.id} ↔ ${toM.id}`, 'ok');
                            return;
                        }

                        if (mode === 'bind-btn' || mode === 'confirm') {
                            const btn = fromM.elements.find(e => e.id === btnSel.value);
                            if (!btn) { GS.toast('No button on this page — use "Create new styled button" or add a button first', 'error'); return; }
                            this.checkpoint();
                            if (mode === 'confirm') {
                                this.wireConfirmPair(btn, toM);
                            } else {
                                const kept = (btn.actions || []).filter(s => !/^(open:|back$|close$|next$|prev$)/i.test(String(s).trim()));
                                kept.push('open:' + toM.id);
                                btn.actions = kept;
                                btn.closeOnClick = false;
                            }
                            this.changed();
                            done(null);
                            this.openFlowDialog();
                            GS.toast(mode === 'confirm'
                                ? `Wired confirm flow: ${fromM.id} [${btn.label || btn.name}] → ${toM.id} (Yes/No)`
                                : `Linked "${btn.label || btn.name}" → ${toM.id}`, 'ok');
                            return;
                        }

                        // mode === 'new-btn' — inherit visual styling from existing button if available
                        const lbl = labelInput.value.trim() || toM.title || toM.id;
                        const refBtn = fromM.elements.find(e => e.type === 'button' && e.image);
                        const style = refBtn ? {
                            image: refBtn.image, hoverImage: refBtn.hoverImage || null, detail: refBtn.detail || 1,
                            labelColor: refBtn.labelColor || '#ffffff', labelScale: refBtn.labelScale || 1,
                            w: refBtn.w, h: refBtn.h
                        } : { w: 88, h: 22 };
                        const existingCount = fromM.elements.filter(e => e.type === 'button' && e.y >= fromM.height - 40).length;
                        const bx = Math.min(Math.max(12, 16 + existingCount * (style.w + 8)), Math.max(12, fromM.width - style.w - 12));
                        const by = Math.max(8, fromM.height - style.h - 10);
                        this.checkpoint();
                        fromM.elements.push(Object.assign(M.newElement('button', fromM), style, {
                            name: lbl, label: lbl, x: bx, y: by, actions: ['open:' + toM.id]
                        }));
                        this.changed();
                        done(null);
                        this.openFlowDialog();
                        GS.toast(`Added button "${lbl}" → ${toM.id}`, 'ok');
                    });

                    root.querySelectorAll('[data-unlink-idx]').forEach(ub => {
                        ub.addEventListener('click', () => {
                            const ed = edges[Number(ub.dataset.unlinkIdx)];
                            if (!ed) return;
                            const fromM = menus.find(m => m.id === ed.from);
                            if (!fromM) return;
                            this.checkpoint();
                            if (ed.kind === 'page') {
                                fromM[ed.field] = '';
                            } else if (ed.btnId) {
                                const btn = fromM.elements.find(e => e.id === ed.btnId);
                                if (btn) {
                                    const targetRaw = ed.rawAction || ('open:' + ed.to);
                                    btn.actions = (btn.actions || []).filter(a => String(a).trim() !== targetRaw);
                                }
                            }
                            this.changed();
                            done(null);
                            this.openFlowDialog();
                            GS.toast('Connection removed');
                        });
                    });

                    root.querySelectorAll('[data-flow-idx]').forEach(card => {
                        card.addEventListener('click', () => {
                            const idx = Number(card.dataset.flowIdx);
                            done(null);
                            this.selectMenu(idx);
                        });
                    });
                }
            });
        }
    };

    GS.Editor = Editor;
    GS.mcToHtml = mcToHtml;
})();
