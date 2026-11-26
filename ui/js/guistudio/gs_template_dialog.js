/* ========================================
   GUI Studio — "Menu from Template" window
   Pick a layout and a colour kit, see it big (hover the buttons), then add it
   as a new page, replace the current page, or make the whole linked set.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const T = () => GS.Templates;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

    const state = { layout: 'hub', kit: 'royal', mode: 'new', linked: false, title: '', fullscreen: true, motion: true };
    let page = null, hover = -1, renderToken = 0;

    function kitSwatch(k) {
        return `<button class="gs-kit ${k.id === state.kit ? 'active' : ''}" data-kit="${k.id}" title="${esc(k.name)}">
            <span style="background:${k.plate[3]};border-color:${k.metal[3]}"><i style="background:${k.metal[4]}"></i><i style="background:${k.inset[3]}"></i></span>
            <em>${esc(k.name)}</em></button>`;
    }

    function body() {
        const groups = [...new Set(T().KITS.map(k => k.group))];
        return `<div class="gs-tpl">
          <div class="gs-tpl-left">
            <div class="gs-sec-head">Layout</div>
            <ul class="gs-tpl-list">${T().LAYOUTS.map(l => `
              <li class="${l.id === state.layout ? 'active' : ''}" data-layout="${l.id}">
                <canvas data-thumb="${l.id}" width="160" height="90"></canvas>
                <span><b>${esc(l.name)}</b><em>${esc(l.th)}</em></span>
              </li>`).join('')}</ul>
          </div>
          <div class="gs-tpl-main">
            <div class="gs-tpl-stage"><canvas id="gs-tpl-big"></canvas></div>
            <div class="gs-tpl-hint">Move the mouse over the preview to see the hover pictures.${GS.Items && !GS.Items.count() ? ' Items show as dashed boxes until you <button class="link-btn" data-tpl-assets>download Minecraft assets</button>.' : ''}</div>
            <div class="gs-sec-head">Colours</div>
            <div class="gs-kits">${groups.map(g => `<div class="gs-kit-group"><span>${esc(g)}</span>${T().KITS.filter(k => k.group === g).map(kitSwatch).join('')}</div>`).join('')}</div>
            <div class="gs-tpl-opts">
              <div class="gs-field"><label for="gs-tpl-title">Title</label><input type="text" id="gs-tpl-title" spellcheck="false" placeholder="(layout name)"></div>
              <div class="gs-tpl-radio">
                <label class="gs-check"><input type="radio" name="gs-tpl-mode" value="new" ${state.mode === 'new' ? 'checked' : ''}> <span>Add as a new page</span></label>
                <label class="gs-check"><input type="radio" name="gs-tpl-mode" value="replace" ${state.mode === 'replace' ? 'checked' : ''}> <span>Replace the current page</span></label>
              </div>
              <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-fullscreen" ${state.fullscreen ? 'checked' : ''}>
                <span><b>Full screen on Java</b> — the menu is shown as big as the screen allows, with the rest of the view dimmed (change it later in the menu's properties)</span></label>
              <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-motion" ${state.motion ? 'checked' : ''}>
                <span><b>Animated</b> — the menu pops open and its parts rise in one after another; buttons grow on hover (change it under Opening / Motion)</span></label>
              <label class="gs-check gs-tpl-linked"><input type="checkbox" id="gs-tpl-linked" ${state.linked ? 'checked' : ''}>
                <span><b>Make the full linked set</b> — Main Menu + Shop + Warps + Servers + Profile + Daily Rewards, already connected with <code>open:</code> and Back buttons</span></label>
            </div>
          </div>
        </div>`;
    }

    async function drawBig(root) {
        const my = ++renderToken;
        const k = T().KITS.find(x => x.id === state.kit);
        page = T().build(state.layout, state.kit, { title: state.title || undefined, links: state.linked ? linkPreview() : null });
        const c = await T().renderPreview(page, 2, hover);
        if (my !== renderToken) return;
        const big = root.querySelector('#gs-tpl-big');
        big.width = c.width; big.height = c.height;
        big.getContext('2d').drawImage(c, 0, 0);
        big.style.aspectRatio = `${page.width} / ${page.height}`;
        big.style.imageRendering = k && k.hiRes ? 'auto' : 'pixelated';
    }

    async function drawThumbs(root) {
        const my = renderToken;
        const k = T().KITS.find(x => x.id === state.kit);
        for (const l of T().LAYOUTS) {
            const cv = root.querySelector(`[data-thumb="${l.id}"]`);
            if (!cv) continue;
            const p = T().build(l.id, state.kit, {});
            const c = await T().renderPreview(p, 1, -1);
            if (my !== renderToken && my + 1 !== renderToken) { /* keep drawing: thumbs are cheap */ }
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
                if (e.type === 'player_model') Object.assign(base, { java3d: true, outfit: 'own', pose: 'standing', turn: e.turn || 'none', angle: e.angle != null ? e.angle : 20, spinSpeed: e.spinSpeed || 45 });
                return base;
            }
            if (e.type === 'item') return Object.assign(base, { item: e.item, glint: !!e.glint, look: e.look || 'flat', spin: !!e.spin, bedrockTexture: '', tooltip: e.tooltip || '' });
            return Object.assign(base, { text: e.text, color: e.color || '#ffffff', scale: e.scale || 1, shadow: e.shadow !== false, align: e.align || 'center' });
        });
    }

    function freeId(base, taken) {
        const M = GS.Model;
        let id = M.slug(base, 'menu'), n = 2;
        const used = (x) => taken.has(x) || GS.Editor.project.menus.some(m => m.id === x);
        while (used(id)) id = `${M.slug(base, 'menu')}_${n++}`;
        taken.add(id);
        return id;
    }

    function apply() {
        const E = GS.Editor, M = GS.Model, p = E.project;
        E.checkpoint();
        if (state.linked) {
            const taken = new Set();
            const links = {};
            T().SET.forEach(k => { links[k] = freeId(k === 'hub' ? 'main' : k, taken); });
            // an empty "main" page from a new project is replaced instead of kept next to the set
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
                const m = M.newMenu(freeId(state.layout, new Set()), state.title || L.title);
                place(m, pg, M.DEFAULT_W, M.DEFAULT_H);
                m.elements = toElements(pg, m.id);
                center(m, pg);
                m.fullscreen = !!state.fullscreen;
                if (state.motion) m.motion = { open: 'pop', openMs: 0, cascade: 'rise', cascadeMs: 0, cascadeGap: 25 };
                if (p.menus.length === 1 && !cur.elements.length && cur.id === 'main') {
                    // first template in a new project takes the empty main page's place
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

    async function open() {
        state.title = '';
        const r = await GS.modal('Menu from Template', body(), [['cancel', 'Cancel'], ['create', 'Create', 'primary']], {
            cls: 'xwide',
            onOpen: (root) => {
                const big = root.querySelector('#gs-tpl-big');
                drawBig(root); drawThumbs(root);
                root.addEventListener('click', (e) => {
                    if (e.target.closest('[data-tpl-assets]')) {
                        GS.Items.downloadDialog().then(n => { if (n) { e.target.closest('.gs-tpl-hint').textContent = `${n} item pictures loaded.`; drawBig(root); drawThumbs(root); } });
                        return;
                    }
                    const li = e.target.closest('[data-layout]');
                    if (li) {
                        state.layout = li.dataset.layout;
                        root.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('active', x === li));
                        root.querySelector('#gs-tpl-title').placeholder = T().LAYOUTS.find(l => l.id === state.layout).title;
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
                root.querySelector('#gs-tpl-title').placeholder = T().LAYOUTS.find(l => l.id === state.layout).title;
                root.querySelector('#gs-tpl-title').addEventListener('input', (e) => { state.title = e.target.value.trim(); drawBig(root); });
                root.querySelectorAll('[name="gs-tpl-mode"]').forEach(x => x.addEventListener('change', () => { state.mode = x.value; }));
                root.querySelector('#gs-tpl-fullscreen').addEventListener('change', (e) => { state.fullscreen = e.target.checked; });
                root.querySelector('#gs-tpl-motion').addEventListener('change', (e) => { state.motion = e.target.checked; });
                root.querySelector('#gs-tpl-linked').addEventListener('change', (e) => {
                    state.linked = e.target.checked;
                    root.querySelector('.gs-tpl').classList.toggle('linked', state.linked);
                    drawBig(root);
                });
                root.querySelector('.gs-tpl').classList.toggle('linked', state.linked);
                big.addEventListener('mousemove', (e) => {
                    if (!page) return;
                    const rc = big.getBoundingClientRect();
                    const x = (e.clientX - rc.left) / rc.width * page.width, y = (e.clientY - rc.top) / rc.height * page.height;
                    let idx = -1, bi = -1;
                    page.elements.forEach(el => {
                        if (el.type !== 'button') return;
                        bi++;
                        if (x >= el.x && y >= el.y && x < el.x + el.w && y < el.y + el.h) idx = bi;
                    });
                    if (idx !== hover) { hover = idx; drawBig(root); }
                });
                big.addEventListener('mouseleave', () => { if (hover !== -1) { hover = -1; drawBig(root); } });
            }
        });
        if (r && r.button === 'create') apply();
    }

    GS.TemplateDialog = { open, state };
})();
