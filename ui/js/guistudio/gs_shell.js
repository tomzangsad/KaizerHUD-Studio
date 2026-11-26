/* ========================================
   GUI Studio — window, menus, shortcuts, open / save / export dialogs
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const M = GS.Model, E = GS.Editor, B = GS.Backend;
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TAURI = window.__TAURI__;
    const appWindow = TAURI && TAURI.window ? TAURI.window.getCurrentWindow() : null;
    const CUR_KEY = 'kz_gui_current_project';

    /* ───────────── toast ───────────── */
    let toastTimer = null;
    GS.toast = function (msg, kind) {
        const t = $('#gs-toast');
        t.textContent = msg;
        t.className = 'gs-toast show' + (kind === 'error' ? ' error' : kind === 'ok' ? ' ok' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), kind === 'error' ? 5000 : 2600);
    };

    /* ───────────── document state ───────────── */
    const Doc = {
        id: null, name: 'Untitled GUI', dirty: false,
        markDirty() { if (!this.dirty) { this.dirty = true; refreshDoc(); } },
        markSaved(id, name) { this.id = id; if (name) this.name = name; this.dirty = false; refreshDoc(); }
    };
    function refreshDoc() {
        $('#doc-title').textContent = Doc.name;
        const tab = $('#doc-tab-name'); if (tab) tab.textContent = Doc.name;
        document.title = `${Doc.name}${Doc.dirty ? ' •' : ''} — GUI Studio`;
        document.body.classList.toggle('is-dirty', Doc.dirty);
        $('#gs-save-state').textContent = Doc.dirty ? 'Unsaved changes' : (Doc.id ? 'Saved' : 'Ready');
        try { if (Doc.id) localStorage.setItem(CUR_KEY, Doc.id); else localStorage.removeItem(CUR_KEY); } catch (e) { /* ignore */ }
    }
    E.onChange = () => Doc.markDirty();

    /* ───────────── modal helper ───────────── */
    function modal(title, bodyHtml, buttons, opts) {
        opts = opts || {};
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'gs-modal';
            back.innerHTML = `<div class="gs-window ${opts.wide ? 'wide' : ''} ${opts.cls || ''}">
                <div class="gs-window-head"><span>${esc(title)}</span><button class="icon-btn small" data-close title="Close"><svg><use href="#g-close"/></svg></button></div>
                <div class="gs-window-body">${bodyHtml}</div>
                <div class="gs-window-foot">${(buttons || [['ok', 'Close', 'primary']]).map(b => `<button class="${b[2] === 'primary' ? 'primary-btn' : 'ghost-btn'}" data-btn="${b[0]}">${esc(b[1])}</button>`).join('')}</div>
              </div>`;
            const done = (v) => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
            const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
            back.addEventListener('click', (e) => {
                if (e.target.closest('[data-close]')) return done(null);
                const b = e.target.closest('[data-btn]');
                if (b) done({ button: b.dataset.btn, root: back });
            });
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(back);
            if (opts.onOpen) opts.onOpen(back, done);
        });
    }
    GS.modal = modal;

    /* ───────────── open / save ───────────── */
    function projectData() {
        M.pruneImages(E.project);
        return E.project;
    }

    async function save(asNew) {
        let name = Doc.name;
        if (asNew || !Doc.id) {
            const n = await window.kzPrompt('GUI project name', Doc.id ? Doc.name + ' copy' : (Doc.name === 'Untitled GUI' ? 'My GUI' : Doc.name));
            if (n == null || !n.trim()) return false;
            name = n.trim();
        }
        try {
            if (Doc.id && !asNew) {
                await B.update(Doc.id, name, projectData());
                Doc.markSaved(Doc.id, name);
            } else {
                const r = await B.create(name, projectData());
                Doc.markSaved(r.projectId, name);
            }
            GS.toast('Saved', 'ok');
            return true;
        } catch (err) {
            GS.toast('Save failed: ' + err.message, 'error');
            return false;
        }
    }

    async function confirmDiscard(what) {
        if (!Doc.dirty) return true;
        return window.kzConfirm(`You have unsaved changes in "${Doc.name}".\n\n${what} anyway?`);
    }

    async function newProject() {
        if (!(await confirmDiscard('Start a new GUI project'))) return;
        E.load(M.newProject());
        Doc.markSaved(null, 'Untitled GUI');
    }

    async function loadById(id, quiet) {
        try {
            const p = await B.get(id);
            E.load(p.data);
            Doc.markSaved(p._id, p.name);
            if (!quiet) GS.toast(`Opened "${p.name}"`, 'ok');
            return true;
        } catch (err) {
            if (!quiet) GS.toast('Could not open: ' + err.message, 'error');
            return false;
        }
    }

    async function openDialog() {
        if (!(await confirmDiscard('Open another project'))) return;
        let list = [];
        try { list = await B.list(); } catch (err) { GS.toast(err.message, 'error'); return; }
        const fmt = (d) => { try { return new Date(d).toLocaleString(); } catch (e) { return d || ''; } };
        const body = list.length
            ? `<ul class="gs-open-list">${list.map(p => `<li data-id="${esc(p._id)}"><span><b>${esc(p.name)}</b><em>${esc(fmt(p.updatedAt))}</em></span>
                 <button class="icon-btn small danger" data-del="${esc(p._id)}" title="Delete"><svg><use href="#g-trash"/></svg></button></li>`).join('')}</ul>`
            : '<p class="gs-muted">No GUI projects yet. Use File → Save to keep your work.</p>';
        await modal('Open GUI Project', body, [['cancel', 'Cancel']], {
            wide: true,
            onOpen: (root, done) => {
                root.addEventListener('click', async (e) => {
                    const del = e.target.closest('[data-del]');
                    if (del) {
                        e.stopPropagation();
                        if (!(await window.kzConfirm('Delete this GUI project? This cannot be undone.'))) return;
                        try { await B.remove(del.dataset.del); del.closest('li').remove(); if (Doc.id === del.dataset.del) Doc.markSaved(null); } catch (err) { GS.toast(err.message, 'error'); }
                        return;
                    }
                    const li = e.target.closest('li[data-id]');
                    if (li) { done(null); loadById(li.dataset.id); }
                });
            }
        });
    }

    /* ───────────── export ───────────── */
    async function exportDialog() {
        const p = E.project;
        const problems = M.validate(p);
        const errors = problems.filter(x => x.level === 'error');
        const warns = problems.filter(x => x.level !== 'error');
        const elCount = p.menus.reduce((n, m) => n + m.elements.length, 0);
        const body = `
            <div class="gs-summary">
              <div><span>Menus</span><b>${p.menus.length}</b></div>
              <div><span>Elements</span><b>${elCount}</b></div>
              <div><span>Namespace</span><b>${esc(p.namespace)}</b></div>
              <div><span>Next pack version</span><b>${(M.int(p.packVersion, 0) || 0) + 1}</b></div>
            </div>
            <p class="gs-muted">One zip with everything — drag its <b>plugins</b> folder onto the server's plugins folder.</p>
            <ul class="gs-export-list">
              <li><b>plugins/KaizerUI/</b> menus/*.yml + studio.yml</li>
              <li><b>plugins/Geyser-Spigot/packs/KaizerUI_${esc(p.namespace)}.mcpack</b> Bedrock players (server form)</li>
              <li><b id="gs-java-dest"></b> Java players (menu pictures)</li>
            </ul>
            <fieldset class="gs-fieldset">
              <legend>Java resource pack goes into</legend>
              ${Object.entries(GS.Export.PACK_HOSTS).map(([k, h]) => `<label class="gs-check"><input type="radio" name="gs-pack-host" value="${k}" ${(p.settings.packHost || 'itemsadder') === k ? 'checked' : ''}> <span><b>${esc(h.label)}</b> <em>— ${esc(h.apply)}</em></span></label>`).join('')}
            </fieldset>
            ${errors.length ? `<div class="gs-problems error"><b>Fix these first:</b><br>${errors.map(x => '• ' + esc(x.msg)).join('<br>')}</div>` : ''}
            ${warns.length ? `<div class="gs-problems"><b>Check:</b><br>${warns.map(x => '• ' + esc(x.msg)).join('<br>')}</div>` : ''}
            <p class="gs-muted small">The server also needs the KaizerUI plugin: <code>plugins/KaizerUI</code> (build with <code>build_kaizerui.bat</code>).</p>`;
        const destOf = (host) => {
            const h = GS.Export.PACK_HOSTS[host] || GS.Export.PACK_HOSTS.itemsadder;
            return h.dir ? h.dir(p.namespace) : `KaizerUI_${p.namespace}_java_pack.zip`;
        };
        let host = p.settings.packHost || 'itemsadder';
        const r = await modal('Export GUI', body, errors.length ? [['cancel', 'Close']] : [['cancel', 'Cancel'], ['export', 'Export…', 'primary']], {
            onOpen: (root) => {
                root.querySelector('#gs-java-dest').textContent = destOf(host);
                root.querySelectorAll('[name="gs-pack-host"]').forEach(x => x.addEventListener('change', () => {
                    host = x.value;
                    root.querySelector('#gs-java-dest').textContent = destOf(host);
                }));
            }
        });
        if (!r || r.button !== 'export') return;
        if (p.settings.packHost !== host) { p.settings.packHost = host; Doc.markDirty(); }
        let out;
        const before = { packUuids: p.packUuids, packVersion: p.packVersion };
        try {
            GS.toast('Building export…');
            out = await GS.Export.build(p);
        } catch (err) {
            Object.assign(p, before);
            GS.toast(err.message, 'error');
            return;
        }
        if (!B.native()) {
            // Browser test mode: show what would be written
            const list = [...out.root.map(f => f.path), ...out.javaPack.map(f => out.javaPackName + ' › ' + f.path), ...out.bedrockPack.map(f => out.bedrockPackPath + ' › ' + f.path)];
            window.__gsLastExport = out;
            await modal('Export (browser test mode)', `<p>${list.length} files</p><pre class="gs-pre">${esc(list.join('\n'))}</pre>`);
            return;
        }
        try {
            const path = await B.exportZip({
                fileName: out.fileName,
                root: out.root,
                javaPack: out.javaPack,
                javaPackName: out.javaPackName,
                bedrockPack: out.bedrockPack,
                bedrockPackPath: out.bedrockPackPath
            });
            if (!path) { Object.assign(p, before); return; }
            GS.toast('Exported: ' + path, 'ok');
            // pack version / UUIDs changed: keep them with the project
            if (Doc.id) { try { await B.update(Doc.id, Doc.name, projectData()); Doc.markSaved(Doc.id); } catch (e) { Doc.markDirty(); } }
            else Doc.markDirty();
        } catch (err) {
            Object.assign(p, before);
            GS.toast('Export failed: ' + err.message, 'error');
        }
    }

    /* ───────────── help ───────────── */
    function showHelp() {
        modal('GUI Studio Guide', `
          <div class="gs-help">
            <h4>What it makes</h4>
            <p>Mouse-driven menus for your server — no chest GUIs. One design works for both editions:</p>
            <ul>
              <li><b>Java</b> — the KaizerUI plugin shows the menu as holograms (TextDisplay) in front of the player. With PacketEvents the camera locks and the mouse moves a cursor; left click presses, sneak leaves.</li>
              <li><b>Bedrock</b> — the menu opens as a server form (Geyser / Floodgate). The pack redraws the form with your layout, so the real mouse and touch work.</li>
            </ul>
            <h4>Build a menu</h4>
            <ul>
              <li>Add pictures, buttons and texts from the left toolbar (I / B / T). Drag to move, drag the handles to resize (Shift keeps the picture's shape).</li>
              <li>Buttons have a normal and a hover picture, a label and actions.</li>
              <li><b>Shapes (S)</b> make pictures in 2D or pixel style (rectangle, circle, star, heart…); a button's picture can be made the same way with <b>Shape…</b>. <b>Icons (O)</b>: two pixel icon sets work offline, or search every free icon set online (the licence is shown; icons that need credit are listed in the export README).</li>
              <li>Each menu page has an id. <code>open:&lt;id&gt;</code> on a button goes to another page.</li>
              <li>Press <b>P</b> to try the menu: hover and click like in game — animations play too.</li>
              <li><b>Motion</b>: a page has an <b>Opening</b> (the whole menu) and a <b>Cascade</b> (its parts appear one after another). Each element can have its own entrance, a loop (pulse, bob, spin…), and buttons a hover and click motion. Add several pictures or a GIF under <b>Animated picture</b> to make it play.</li>
            </ul>
            <h4>Button actions</h4>
            <table class="gs-table">
              <tr><td><code>player:spawn</code></td><td>run a command as the player</td></tr>
              <tr><td><code>console:give %player_name% diamond</code></td><td>run a command as the console</td></tr>
              <tr><td><code>open:shop</code></td><td>open another menu page</td></tr>
              <tr><td><code>close</code></td><td>close the menu</td></tr>
              <tr><td><code>message:&amp;aHello</code></td><td>chat message to the player</td></tr>
              <tr><td><code>sound:entity.player.levelup</code></td><td>play a sound</td></tr>
              <tr><td><code>server:lobby</code></td><td>send to a proxy server</td></tr>
            </table>
            <h4>Export and install</h4>
            <p>File → Export makes one zip. Its README says where each file goes. The server needs <b>KaizerUI</b> (in <code>plugins/KaizerUI</code>), Paper 1.21+, and for the best result PacketEvents, PlaceholderAPI, Geyser + Floodgate.</p>
          </div>`, null, { wide: true });
    }

    function showShortcuts() {
        const rows = [
            ['Ctrl+N / O / S', 'New / Open / Save'], ['Ctrl+Shift+S', 'Save As'], ['Ctrl+E', 'Export'],
            ['I / B / T', 'Add image / button / text'], ['H / L / K', 'Add player head / player model / item'], ['M', 'Menu from template'], ['Ctrl+M', 'New menu page'],
            ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+C / V / D', 'Copy / Paste / Duplicate'], ['Del', 'Delete'], ['Ctrl+A · Ctrl/Shift+click · drag on empty space', 'Select many (move, align, delete together)'],
            ['Arrows (Shift = 10px)', 'Move the selection'], ['Alt+Click', 'Select the element underneath'], ['Mouse wheel, Ctrl++ / −', 'Zoom (at the mouse)'], ['Space + drag / middle button', 'Move around'], ['Shift+Wheel', 'Scroll sideways'], ['Ctrl+0', 'Fit to window'],
            ['G', 'Snap to 4px'], ['P', 'Play preview'], ['Esc', 'Deselect / leave preview'], ['F1', 'Guide']
        ];
        modal('Keyboard Shortcuts', `<table class="gs-table">${rows.map(r => `<tr><td><kbd>${esc(r[0])}</kbd></td><td>${esc(r[1])}</td></tr>`).join('')}</table>`);
    }

    /* ───────────── workspace switch ───────────── */
    async function toHud() {
        if (!(await confirmDiscard('Switch to the HUD editor'))) return;
        Doc.dirty = false; // already confirmed
        window.location.href = 'index.html';
    }

    /* ───────────── commands ───────────── */
    const commands = {
        'new': newProject,
        'open': openDialog,
        'save': () => save(false),
        'save-as': () => save(true),
        'projects-folder': () => B.openFolder().catch(err => GS.toast(err.message, 'error')),
        'export': exportDialog,
        'to-hud': toHud,
        'exit': () => appWindow ? appWindow.close() : null,
        'undo': () => E.undo(),
        'redo': () => E.redo(),
        'copy': () => E.copy(),
        'paste': () => E.paste(),
        'duplicate': () => E.duplicate(),
        'delete': () => E.remove(),
        'select-all': () => E.selectAll(),
        'center-h': () => E.center('h'),
        'center-v': () => E.center('v'),
        'fit-image': () => E.fitImage(),
        'deselect': () => { E.selected = null; E.propsMode = null; E.renderAll(); },
        'add-image': () => E.add('image'),
        'add-button': () => E.add('button'),
        'add-text': () => E.add('text'),
        'add-head': () => E.add('player_head'),
        'add-model': () => E.add('player_model'),
        'add-item': () => E.add('item'),
        'mc-assets': () => GS.Items && GS.Items.downloadDialog().then(n => { if (n) E.renderAll(); }),
        'add-shape': () => E.openAssets('shapes'),
        'add-icon': () => E.openAssets('icons'),
        'add-menu': () => E.addMenu(),
        'templates': () => GS.TemplateDialog ? GS.TemplateDialog.open() : null,
        'dup-menu': () => E.duplicateMenu(),
        'del-menu': () => E.deleteMenu(),
        'layer-up': () => E.layer(1),
        'layer-down': () => E.layer(-1),
        'zoom-in': () => E.zoomStep(1),
        'zoom-out': () => E.zoomStep(-1),
        'zoom-fit': () => E.zoomFit(),
        'grid': () => { E.snap = !E.snap; E.renderStatus(); },
        'preview': () => E.togglePreview(),
        'ui-flow': () => E.openFlowDialog(),
        'cursor-settings': () => { E.selected = null; E.propsMode = 'cursor'; E.renderAll(); },
        'fullscreen': () => appWindow ? appWindow.toggleMaximize() : null,
        'help': showHelp,
        'shortcuts': showShortcuts
    };
    function run(cmd) {
        const f = commands[cmd];
        if (f) { try { const r = f(); if (r && r.catch) r.catch(err => GS.toast(err.message, 'error')); } catch (err) { GS.toast(err.message, 'error'); } }
    }
    GS.run = run;

    /* ───────────── menus ───────────── */
    let menuOpen = false;
    function closeMenus() { $$('.menu.open').forEach(m => m.classList.remove('open')); menuOpen = false; }
    function setupMenus() {
        $$('.menu').forEach(menu => {
            const trigger = $('.menu-trigger', menu);
            trigger.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const was = menu.classList.contains('open');
                closeMenus();
                if (!was) { menu.classList.add('open'); menuOpen = true; }
            });
            trigger.addEventListener('mouseenter', () => {
                if (menuOpen && !menu.classList.contains('open')) { closeMenus(); menu.classList.add('open'); menuOpen = true; }
            });
        });
        document.addEventListener('click', (e) => {
            const item = e.target.closest('[data-cmd]');
            if (!item) return;
            if (item.closest('.menu-pop')) closeMenus();
            run(item.dataset.cmd);
        });
        document.addEventListener('mousedown', (e) => { if (menuOpen && !e.target.closest('.menu')) closeMenus(); });
        window.addEventListener('blur', closeMenus);
        $('#gs-zoom').addEventListener('click', () => E.zoomFit());
        $('#ws-switch').addEventListener('click', (e) => {
            const b = e.target.closest('[data-ws]');
            if (b && b.dataset.ws === 'hud') toHud();
        });
    }

    /* ───────────── window ───────────── */
    function setupWindow() {
        if (!appWindow) { document.body.classList.add('no-native'); return; }
        $$('[data-wc]').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.wc;
            if (a === 'min') appWindow.minimize();
            else if (a === 'max') appWindow.toggleMaximize();
            else if (a === 'close') appWindow.close();
        }));
        const bar = $('#titlebar');
        bar.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target.closest('.menubar, .tb-controls, .ws-switch, button, a, input')) return;
            if (e.detail === 2) { appWindow.toggleMaximize(); return; }
            appWindow.startDragging().catch(() => { });
        });
        appWindow.onCloseRequested(async (event) => {
            if (!Doc.dirty) return;
            const ok = await window.kzConfirm('You have unsaved changes in GUI Studio.\n\nClose anyway?');
            if (!ok) event.preventDefault();
        });
    }

    /* ───────────── keys ───────────── */
    function isTyping(e) {
        const t = e.target;
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }
    function setupKeys() {
        document.addEventListener('keydown', (e) => {
            if (document.querySelector('.gs-modal, .kz-dlg-back')) return;
            const ctrl = e.ctrlKey || e.metaKey;
            const k = e.key;
            if (ctrl) {
                const map = { n: 'new', o: 'open', e: 'export', m: 'add-menu', '0': 'zoom-fit', '=': 'zoom-in', '+': 'zoom-in', '-': 'zoom-out' };
                if (k.toLowerCase() === 's') { e.preventDefault(); run(e.shiftKey ? 'save-as' : 'save'); return; }
                if (map[k.toLowerCase()]) { e.preventDefault(); run(map[k.toLowerCase()]); return; }
                if (isTyping(e)) return;
                const map2 = { z: e.shiftKey ? 'redo' : 'undo', y: 'redo', c: 'copy', v: 'paste', d: 'duplicate', a: 'select-all' };
                if (map2[k.toLowerCase()]) { e.preventDefault(); run(map2[k.toLowerCase()]); }
                return;
            }
            if (k === 'F1') { e.preventDefault(); run('help'); return; }
            if (k === 'F11') { e.preventDefault(); run('fullscreen'); return; }
            if (isTyping(e)) return;
            if (k === 'Escape') { if (E.previewMode) E.togglePreview(); else run('deselect'); return; }
            if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); run('delete'); return; }
            const step = e.shiftKey ? 10 : 1;
            const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (arrows[k] && E.selected) { e.preventDefault(); E.nudge(...arrows[k]); return; }
            const single = { i: 'add-image', b: 'add-button', t: 'add-text', h: 'add-head', l: 'add-model', k: 'add-item', s: 'add-shape', o: 'add-icon', g: 'grid', p: 'preview', m: 'templates' };
            if (single[k.toLowerCase()] && !e.altKey) { e.preventDefault(); run(single[k.toLowerCase()]); }
        });
    }

    function setupTooltips() {
        $$('[data-tip]').forEach(b => { b.title = b.dataset.tip; });
    }

    /* ───────────── start ───────────── */
    async function start() {
        setupWindow();
        setupMenus();
        setupKeys();
        setupTooltips();
        // read the last project id before refreshDoc() clears it for the empty document
        let last = null;
        try { last = localStorage.getItem(CUR_KEY); } catch (e) { /* ignore */ }
        E.init(M.newProject());
        if (!(last && await loadById(last, true))) refreshDoc();
        window.addEventListener('resize', () => E.applyZoom());
    }

    GS.Doc = Doc;
    GS.save = save;
    GS.exportDialog = exportDialog;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
