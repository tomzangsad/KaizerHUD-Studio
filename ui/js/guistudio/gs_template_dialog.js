/* ========================================
   GUI Studio — "Menu from Template" window
   Supports two modes:
   1. Complete Sets: Ready-made multi-page linked server suites (with shared dynamic Confirm & Input)
   2. Single Page & Kits: Procedural layouts paired with color kits
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const T = () => GS.Templates;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const SETS = [
        {
            id: 'release_qa_suite',
            name: 'Kaizer Release QA Suite',
            pages: 8,
            badge: 'QA Test · 8 Pages',
            desc: 'All-in-one pre-release test suite: Items/3D, Persistent & PAPI Toggles, Visibility, Require, Inputs, Economy, Scroll/Pan2D & 4 Roulettes'
        },
        {
            id: 'modern_realm_suite',
            name: 'Modern Realm Suite',
            pages: 11,
            badge: 'Modern Glass · 11 Pages',
            desc: 'Dark glass Hub, Shop, 2D Skill Tree, Quests, 4 Crate Gachas, 3D Profile, Warps & Confirm'
        },
        {
            id: 'network_rpg_suite',
            name: 'Network RPG Suite (OreUI)',
            pages: 7,
            badge: 'OreUI RPG · 7 Pages',
            desc: 'Sidebar dashboard, 3D Character + RPG Stat Tables, OreUI Settings Toggles, Node-Graph Skill Tree, Shop & Warps'
        },
        {
            id: 'modern_vanilla',
            name: 'Modern Vanilla Suite',
            pages: 6,
            badge: 'Vanilla UI · 6 Pages',
            desc: 'Hub, Shop + Qty Input, Warps, Daily Rewards, Profile (3D Armor) & Shared Confirm'
        },
        {
            id: 'royal_guild_shop',
            name: 'Royal Guild Shop',
            pages: 5,
            badge: 'Multi-Shop · 5 Pages',
            desc: 'General, Armory, Ores & Supplies tabs + Shared Confirm with Qty Input'
        },
        {
            id: 'kaizer_server_core',
            name: 'Kaizer Server Core',
            pages: 8,
            badge: 'RPG Core · 8 Pages',
            desc: 'Hub, Profile, Warps, Daily, Quests, Ranks, Settings & Shared Confirm'
        }
    ];

    const setCache = new Map();

    async function loadSet(id) {
        if (setCache.has(id)) return setCache.get(id);
        const resp = await fetch(`templates/sets/${id}.json`);
        if (!resp.ok) throw new Error(`Could not load template set "${id}" (${resp.status})`);
        const data = await resp.json();
        setCache.set(id, data);
        return data;
    }

    /** Page size for a template: the wanted size (default 640×360), never smaller than the template */
    function place(m, pg, w, h) {
        m.width = Math.max(pg.width, w || pg.width);
        m.height = Math.max(pg.height, h || pg.height);
    }
    /** The template keeps its pixel size and sits in the middle of the page */
    function center(m, pg) {
        const dx = Math.round((m.width - pg.width) / 2), dy = Math.round((m.height - pg.height) / 2);
        if (dx || dy) m.elements.forEach(e => { e.x += dx; e.y += dy; });
    }

    const state = {
        tab: 'sets',
        setId: 'modern_realm_suite',
        setPageIndex: 0,
        setMode: 'replace',
        layout: 'hub',
        kit: 'royal',
        mode: 'new',
        linked: false,
        title: '',
        fullscreen: true,
        motion: true
    };
    let page = null, hover = -1, renderToken = 0;

    function kitSwatch(k) {
        return `<button class="gs-kit ${k.id === state.kit ? 'active' : ''}" data-kit="${k.id}" title="${esc(k.name)}">
            <span style="background:${k.plate[3]};border-color:${k.metal[3]}"><i style="background:${k.metal[4]}"></i><i style="background:${k.inset[3]}"></i></span>
            <em>${esc(k.name)}</em></button>`;
    }

    function body() {
        const groups = [...new Set(T().KITS.map(k => k.group))];
        const isSets = state.tab === 'sets';
        return `<div class="gs-tpl-wrap">
          <div class="gs-tpl-tabs">
            <button type="button" class="${isSets ? 'active' : ''}" data-tpl-tab="sets">Complete Sets (Multi-page Linked)</button>
            <button type="button" class="${!isSets ? 'active' : ''}" data-tpl-tab="kits">Single Page &amp; Colour Kits</button>
          </div>
          <div class="gs-tpl ${isSets ? 'mode-sets' : 'mode-kits'}">
            <div class="gs-tpl-left">
              <div class="gs-sec-head">${isSets ? 'Server Template Sets' : 'Layout'}</div>
              <ul class="gs-tpl-list">${isSets
                ? SETS.map(s => `
                  <li class="${s.id === state.setId ? 'active' : ''}" data-set="${s.id}">
                    <canvas data-set-thumb="${s.id}" width="160" height="90"></canvas>
                    <span><b>${esc(s.name)}</b><em class="gs-set-meta">${esc(s.badge)}</em><em>${esc(s.desc)}</em></span>
                  </li>`).join('')
                : T().LAYOUTS.map(l => `
                  <li class="${l.id === state.layout ? 'active' : ''}" data-layout="${l.id}">
                    <canvas data-thumb="${l.id}" width="160" height="90"></canvas>
                    <span><b>${esc(l.name)}</b><em>${esc(l.th)}</em></span>
                  </li>`).join('')
              }</ul>
            </div>
            <div class="gs-tpl-main">
              <div class="gs-tpl-stage"><canvas id="gs-tpl-big"></canvas></div>
              <div class="gs-tpl-pages" id="gs-tpl-pages" style="${isSets ? '' : 'display:none'}"></div>
              <div class="gs-tpl-hint">Move the mouse over the preview to see hover effects.${GS.Items && !GS.Items.count() ? ' Items show as dashed boxes until you <button class="link-btn" data-tpl-assets>download Minecraft assets</button>.' : ''}</div>
              ${!isSets ? `
                <div class="gs-sec-head">Colours</div>
                <div class="gs-kits">${groups.map(g => `<div class="gs-kit-group"><span>${esc(g)}</span>${T().KITS.filter(k => k.group === g).map(kitSwatch).join('')}</div>`).join('')}</div>
                <div class="gs-tpl-opts">
                  <div class="gs-field"><label for="gs-tpl-title">Title</label><input type="text" id="gs-tpl-title" spellcheck="false" placeholder="(layout name)"></div>
                  <div class="gs-tpl-radio">
                    <label class="gs-check"><input type="radio" name="gs-tpl-mode" value="new" ${state.mode === 'new' ? 'checked' : ''}> <span>Add as a new page</span></label>
                    <label class="gs-check"><input type="radio" name="gs-tpl-mode" value="replace" ${state.mode === 'replace' ? 'checked' : ''}> <span>Replace the current page</span></label>
                  </div>
                  <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-fullscreen" ${state.fullscreen ? 'checked' : ''}>
                    <span><b>Full screen on Java</b> — menu scales up with dimmed view background</span></label>
                  <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-motion" ${state.motion ? 'checked' : ''}>
                    <span><b>Animated</b> — opening pop animation, staggered cascade, and button hover motion</span></label>
                  <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-linked" ${state.linked ? 'checked' : ''}>
                    <span><b>Make the full linked set</b> — Main Menu + Shop + Warps + Servers + Profile + Daily Rewards</span></label>
                </div>` : `
                <div class="gs-tpl-opts">
                  <div class="gs-tpl-radio" style="padding-top:0">
                    <label class="gs-check"><input type="radio" name="gs-tpl-set-mode" value="replace" ${state.setMode === 'replace' ? 'checked' : ''}> <span><b>Replace project menus</b> (recommended for new project)</span></label>
                    <label class="gs-check"><input type="radio" name="gs-tpl-set-mode" value="append" ${state.setMode === 'append' ? 'checked' : ''}> <span>Append pages &amp; auto-relink menu IDs</span></label>
                  </div>
                  <div>
                    <label class="gs-check"><input type="checkbox" id="gs-tpl-fullscreen" ${state.fullscreen ? 'checked' : ''}> <span><b>Full screen on Java</b></span></label>
                    <label class="gs-check"><input type="checkbox" id="gs-tpl-motion" ${state.motion ? 'checked' : ''}> <span><b>Animated</b> (entrance &amp; cascade)</span></label>
                  </div>
                </div>`}
            </div>
          </div>
        </div>`;
    }

    async function drawBig(root) {
        const my = ++renderToken;
        const big = root.querySelector('#gs-tpl-big');
        const pagesBar = root.querySelector('#gs-tpl-pages');
        if (state.tab === 'sets') {
            const setData = await loadSet(state.setId);
            if (my !== renderToken) return;
            const menus = setData.menus || [];
            const idx = Math.max(0, Math.min(state.setPageIndex, menus.length - 1));
            state.setPageIndex = idx;
            const m = menus[idx];
            page = { width: m.width, height: m.height, elements: m.elements, images: setData.images || {} };
            if (pagesBar) {
                pagesBar.innerHTML = menus.map((mm, i) =>
                    `<button type="button" class="gs-page-pill ${i === idx ? 'active' : ''}" data-set-page="${i}">${esc(mm.id)}${mm.command ? ` <em>/${esc(mm.command)}</em>` : ''}</button>`
                ).join('');
            }
            const c = await T().renderPreview(page, 2, hover);
            if (my !== renderToken) return;
            big.width = c.width; big.height = c.height;
            big.getContext('2d').drawImage(c, 0, 0);
            big.style.aspectRatio = `${page.width} / ${page.height}`;
            big.style.imageRendering = 'auto';
            return;
        }
        const k = T().KITS.find(x => x.id === state.kit);
        page = T().build(state.layout, state.kit, { title: state.title || undefined, links: state.linked ? linkPreview() : null });
        const c = await T().renderPreview(page, 2, hover);
        if (my !== renderToken) return;
        big.width = c.width; big.height = c.height;
        big.getContext('2d').drawImage(c, 0, 0);
        big.style.aspectRatio = `${page.width} / ${page.height}`;
        big.style.imageRendering = k && k.hiRes ? 'auto' : 'pixelated';
    }

    async function drawThumbs(root) {
        if (state.tab === 'sets') {
            for (const s of SETS) {
                const cv = root.querySelector(`[data-set-thumb="${s.id}"]`);
                if (!cv) continue;
                try {
                    const setData = await loadSet(s.id);
                    const m = (setData.menus && setData.menus[0]) || null;
                    if (!m || !document.body.contains(cv)) continue;
                    const pg = { width: m.width, height: m.height, elements: m.elements, images: setData.images || {} };
                    const c = await T().renderPreview(pg, 1, -1);
                    const g = cv.getContext('2d');
                    g.imageSmoothingEnabled = true;
                    cv.style.imageRendering = 'auto';
                    g.clearRect(0, 0, cv.width, cv.height);
                    const sc = Math.min(cv.width / pg.width, cv.height / pg.height);
                    const w = pg.width * sc, h = pg.height * sc;
                    g.drawImage(c, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
                } catch (err) { /* skip broken preview */ }
            }
            return;
        }
        const my = renderToken;
        const k = T().KITS.find(x => x.id === state.kit);
        for (const l of T().LAYOUTS) {
            const cv = root.querySelector(`[data-thumb="${l.id}"]`);
            if (!cv) continue;
            const p = T().build(l.id, state.kit, {});
            const c = await T().renderPreview(p, 1, -1);
            if (my !== renderToken && my + 1 !== renderToken) { /* keep drawing */ }
            const g = cv.getContext('2d');
            g.imageSmoothingEnabled = !!(k && k.hiRes);
            cv.style.imageRendering = k && k.hiRes ? 'auto' : 'pixelated';
            g.clearRect(0, 0, cv.width, cv.height);
            const s = Math.min(cv.width / p.width, cv.height / p.height);
            const w = p.width * s, h = p.height * s;
            g.drawImage(c, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
        }
    }

    function linkPreview() {
        const o = {};
        T().SET.forEach(k => { o[k] = k === 'hub' ? 'main' : k; });
        return o;
    }

    /* ───────────── putting pages into the project ───────────── */

    function toElements(page, menuId) {
        const M = GS.Model, p = GS.Editor.project;
        const img = (name, data, w, h, res) => M.addImage(p, { name: `${menuId}_${M.slug(name, 'img')}.png`, data, w: w * (res || 1), h: h * (res || 1), res: res || 1 });
        return page.elements.map(e => {
            const base = { id: M.uid(e.type[0]), type: e.type, name: e.name, x: e.x, y: e.y, w: e.w, h: e.h, hidden: false };
            const d = e.detail || 1;
            if (e.type === 'image') return Object.assign(base, { detail: d, image: img(e.name, e.png, e.w, e.h, d) });
            if (e.type === 'button') {
                return Object.assign(base, {
                    detail: d,
                    image: img(e.name, e.png, e.w, e.h, d),
                    hoverImage: e.hoverPng ? img(e.name + '_hover', e.hoverPng, e.w, e.h, d) : null,
                    label: e.label || '', labelColor: e.labelColor || '#ffffff', labelScale: e.labelScale || 1, labelShadow: true,
                    actions: (e.actions || []).slice(), closeOnClick: !!e.closeOnClick, hoverSound: '',
                    tooltip: e.tooltip || ''
                });
            }
            if (M.isPlayer(e)) {
                Object.assign(base, { player: e.player || '%player_name%', hat: true, dollSize: null, dollOffset: null, tooltip: e.tooltip || '' });
                if (e.type === 'player_model') Object.assign(base, { java3d: true, outfit: 'own', pose: 'standing', turn: e.turn || 'none', angle: e.angle != null ? e.angle : 20, spinSpeed: e.spinSpeed || 45, bedrockRenderer: 'auto' });
                return base;
            }
            if (e.type === 'item') return Object.assign(base, { item: e.item, glint: !!e.glint, look: e.look || 'flat', spin: !!e.spin, bedrockTexture: '', tooltip: e.tooltip || '' });
            return Object.assign(base, { text: e.text, color: e.color || '#ffffff', scale: e.scale || 1, shadow: e.shadow !== false, align: e.align || 'center' });
        });
    }

    function freeId(base, taken, replaceAll) {
        const M = GS.Model;
        let id = M.slug(base, 'menu'), n = 2;
        const used = (x) => taken.has(x) || (!replaceAll && GS.Editor.project.menus.some(m => m.id === x));
        while (used(id)) id = `${M.slug(base, 'menu')}_${n++}`;
        taken.add(id);
        return id;
    }

    async function applySet() {
        const E = GS.Editor, M = GS.Model, p = E.project;
        const meta = SETS.find(s => s.id === state.setId) || SETS[0];
        const rawSet = await loadSet(meta.id);
        const set = M.normalize(JSON.parse(JSON.stringify(rawSet)));
        E.checkpoint();

        const replaceAll = state.setMode === 'replace' || (p.menus.length === 1 && !p.menus[0].elements.length);
        const imgMap = {};
        for (const [oldId, im] of Object.entries(set.images || {})) {
            if (!im || !im.data) continue;
            imgMap[oldId] = M.addImage(p, im);
        }
        if (replaceAll) {
            p.menus = [];
            if (p.namespace === 'kaizerui' && set.namespace) p.namespace = set.namespace;
            if (set.cursor && set.cursor.image && imgMap[set.cursor.image]) {
                p.cursor = Object.assign({}, set.cursor, { image: imgMap[set.cursor.image] });
            }
        }

        const taken = new Set();
        const idMap = {};
        set.menus.forEach(m => { idMap[m.id] = freeId(m.id, taken, replaceAll); });

        const rewriteAction = (act) => {
            const s = String(act || '');
            const m2 = /^open:([^?]+)(\?.*)?$/i.exec(s.trim());
            if (!m2) return act;
            const orig = m2[1].trim();
            const mapped = idMap[orig] || orig;
            return 'open:' + mapped + (m2[2] || '');
        };

        const firstIdx = p.menus.length;
        set.menus.forEach(m => {
            m.id = idMap[m.id] || m.id;
            if (m.prevPage && idMap[m.prevPage]) m.prevPage = idMap[m.prevPage];
            if (m.nextPage && idMap[m.nextPage]) m.nextPage = idMap[m.nextPage];
            m.fullscreen = !!state.fullscreen;
            if (state.motion) {
                if (!m.motion || (m.motion.open === 'none' && m.motion.cascade === 'none')) {
                    m.motion = { open: 'pop', openMs: 0, cascade: 'rise', cascadeMs: 0, cascadeGap: 25 };
                }
            } else {
                m.motion = { open: 'none', openMs: 0, cascade: 'none', cascadeMs: 0, cascadeGap: 35 };
            }
            m.elements.forEach(el => {
                if (el.image && imgMap[el.image]) el.image = imgMap[el.image];
                if (el.hoverImage && imgMap[el.hoverImage]) el.hoverImage = imgMap[el.hoverImage];
                if (Array.isArray(el.frames)) el.frames = el.frames.map(f => imgMap[f] || f);
                if (Array.isArray(el.actions)) el.actions = el.actions.map(rewriteAction);
            });
            p.menus.push(m);
        });

        M.pruneImages(p);
        E.menuIndex = firstIdx;
        E.selected = null;
        E.propsMode = null;
        E.changed();
        E.zoomFit();
        GS.toast(`Loaded "${meta.name}" (${set.menus.length} linked pages)`, 'ok');
    }

    async function apply() {
        if (state.tab === 'sets') {
            await applySet();
            return;
        }
        const E = GS.Editor, M = GS.Model, p = E.project;
        E.checkpoint();
        if (state.linked) {
            const taken = new Set();
            const links = {};
            T().SET.forEach(k => { links[k] = freeId(k === 'hub' ? 'main' : k, taken, false); });
            const cur = E.menu();
            if (p.menus.length === 1 && !cur.elements.length) { p.menus = []; links.hub = 'main'; }
            let first = -1;
            T().SET.forEach(k => {
                const L = T().LAYOUTS.find(l => l.id === k);
                const pg = T().build(k, state.kit, { links });
                const m = M.newMenu(links[k], L.title);
                place(m, pg, M.DEFAULT_W, M.DEFAULT_H);
                if (k === 'shop') m.command = p.menus.some(x => x.command === 'shop') ? '' : 'shop';
                if (k === 'hub') m.command = p.menus.some(x => x.command === 'menu') ? '' : 'menu';
                m.elements = toElements(pg, m.id);
                center(m, pg);
                m.fullscreen = !!state.fullscreen;
                if (state.motion) m.motion = { open: 'pop', openMs: 0, cascade: 'rise', cascadeMs: 0, cascadeGap: 25 };
                p.menus.push(m);
                if (first < 0) first = p.menus.length - 1;
            });
            E.menuIndex = first;
        } else {
            const L = T().LAYOUTS.find(l => l.id === state.layout);
            const pg = T().build(state.layout, state.kit, { title: state.title || undefined });
            if (state.mode === 'replace') {
                const m = E.menu();
                place(m, pg, m.width, m.height);
                if (!m.title || m.title === 'Main Menu' || m.title === 'New Menu') m.title = state.title || L.title;
                m.elements = toElements(pg, m.id);
                center(m, pg);
                m.fullscreen = !!state.fullscreen;
                if (state.motion) m.motion = { open: 'pop', openMs: 0, cascade: 'rise', cascadeMs: 0, cascadeGap: 25 };
            } else {
                const cur = E.menu();
                const m = M.newMenu(freeId(state.layout, new Set(), false), state.title || L.title);
                place(m, pg, M.DEFAULT_W, M.DEFAULT_H);
                m.elements = toElements(pg, m.id);
                center(m, pg);
                m.fullscreen = !!state.fullscreen;
                if (state.motion) m.motion = { open: 'pop', openMs: 0, cascade: 'rise', cascadeMs: 0, cascadeGap: 25 };
                if (p.menus.length === 1 && !cur.elements.length && cur.id === 'main') {
                    m.id = 'main';
                    p.menus = [m];
                    E.menuIndex = 0;
                } else {
                    p.menus.push(m);
                    E.menuIndex = p.menus.length - 1;
                }
            }
        }
        E.selected = null;
        E.propsMode = null;
        E.changed();
        E.zoomFit();
        GS.toast(state.linked ? `Added ${T().SET.length} linked menu pages` : 'Template added', 'ok');
    }

    function wireControls(root) {
        const big = root.querySelector('#gs-tpl-big');
        const tplBox = root.querySelector('.gs-tpl');
        if (tplBox) tplBox.classList.toggle('linked', state.tab === 'kits' && state.linked);

        const titleIn = root.querySelector('#gs-tpl-title');
        if (titleIn) {
            const L = T().LAYOUTS.find(l => l.id === state.layout);
            titleIn.placeholder = L ? L.title : '';
            titleIn.value = state.title;
            titleIn.addEventListener('input', (e) => { state.title = e.target.value.trim(); drawBig(root); });
        }
        root.querySelectorAll('[name="gs-tpl-mode"]').forEach(x => x.addEventListener('change', () => { state.mode = x.value; }));
        root.querySelectorAll('[name="gs-tpl-set-mode"]').forEach(x => x.addEventListener('change', () => { state.setMode = x.value; }));
        const fsIn = root.querySelector('#gs-tpl-fullscreen');
        if (fsIn) fsIn.addEventListener('change', (e) => { state.fullscreen = e.target.checked; });
        const moIn = root.querySelector('#gs-tpl-motion');
        if (moIn) moIn.addEventListener('change', (e) => { state.motion = e.target.checked; });
        const lnkIn = root.querySelector('#gs-tpl-linked');
        if (lnkIn) lnkIn.addEventListener('change', (e) => {
            state.linked = e.target.checked;
            if (tplBox) tplBox.classList.toggle('linked', state.linked);
            drawBig(root);
        });
        if (big) {
            big.addEventListener('mousemove', (e) => {
                if (!page) return;
                const rc = big.getBoundingClientRect();
                const x = (e.clientX - rc.left) / rc.width * page.width, y = (e.clientY - rc.top) / rc.height * page.height;
                let idx = -1, bi = -1;
                (page.elements || []).forEach(el => {
                    if (el.hidden || el.type !== 'button') return;
                    bi++;
                    if (x >= el.x && y >= el.y && x < el.x + el.w && y < el.y + el.h) idx = bi;
                });
                if (idx !== hover) { hover = idx; drawBig(root); }
            });
            big.addEventListener('mouseleave', () => { if (hover !== -1) { hover = -1; drawBig(root); } });
        }
    }

    async function open() {
        state.title = '';
        hover = -1;
        const r = await GS.modal('Menu from Template', body(), [['cancel', 'Cancel'], ['create', 'Create', 'primary']], {
            cls: 'xwide',
            onOpen: (root) => {
                const redrawModal = () => {
                    const wrap = root.querySelector('.gs-tpl-wrap');
                    if (wrap) wrap.outerHTML = body();
                    wireControls(root);
                    drawBig(root);
                    drawThumbs(root);
                };
                root.addEventListener('click', (e) => {
                    const tabBtn = e.target.closest('[data-tpl-tab]');
                    if (tabBtn) {
                        const nt = tabBtn.dataset.tplTab;
                        if (nt !== state.tab) {
                            state.tab = nt;
                            hover = -1;
                            redrawModal();
                        }
                        return;
                    }
                    if (e.target.closest('[data-tpl-assets]')) {
                        GS.Items.downloadDialog().then(n => {
                            if (n) {
                                e.target.closest('.gs-tpl-hint').textContent = `${n} item pictures loaded.`;
                                drawBig(root); drawThumbs(root);
                            }
                        });
                        return;
                    }
                    const sBtn = e.target.closest('[data-set]');
                    if (sBtn) {
                        state.setId = sBtn.dataset.set;
                        state.setPageIndex = 0;
                        root.querySelectorAll('[data-set]').forEach(x => x.classList.toggle('active', x === sBtn));
                        hover = -1;
                        drawBig(root);
                        return;
                    }
                    const pBtn = e.target.closest('[data-set-page]');
                    if (pBtn) {
                        state.setPageIndex = Number(pBtn.dataset.setPage) || 0;
                        hover = -1;
                        drawBig(root);
                        return;
                    }
                    const li = e.target.closest('[data-layout]');
                    if (li) {
                        state.layout = li.dataset.layout;
                        root.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('active', x === li));
                        const titleIn = root.querySelector('#gs-tpl-title');
                        if (titleIn) titleIn.placeholder = T().LAYOUTS.find(l => l.id === state.layout).title;
                        hover = -1; drawBig(root);
                        return;
                    }
                    const k = e.target.closest('[data-kit]');
                    if (k) {
                        state.kit = k.dataset.kit;
                        root.querySelectorAll('[data-kit]').forEach(x => x.classList.toggle('active', x === k));
                        drawBig(root); drawThumbs(root);
                    }
                });
                wireControls(root);
                drawBig(root);
                drawThumbs(root);
            }
        });
        if (r && r.button === 'create') await apply();
    }

    GS.TemplateDialog = { open, state, SETS };
})();
