/* ==========================================================
   KaizerHUD Studio — application shell
   Title bar, menus, tool strip, dock panels, status bar,
   keyboard shortcuts and document (dirty / saved) state.
   ========================================================== */
(function () {
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const TAURI = window.__TAURI__;
    const appWindow = TAURI && TAURI.window ? TAURI.window.getCurrentWindow() : null;
    const APP_NAME = 'KaizerHUD Studio';

    // A fresh window never has a project open (app.js clears the id on start)
    try { localStorage.removeItem('current_project_name'); } catch (e) { /* ignore */ }

    /* ───────────── document state ───────────── */
    const Doc = {
        dirty: false,
        everSaved: false,
        name() {
            try { return localStorage.getItem('current_project_name') || ''; } catch (e) { return ''; }
        },
        id() {
            try { return localStorage.getItem('current_project_id') || ''; } catch (e) { return ''; }
        },
        markDirty() {
            if (this.dirty) return;
            this.dirty = true;
            refreshDocUi();
        },
        markClean() {
            this.dirty = false;
            refreshDocUi();
        }
    };
    window.KZDoc = Doc;

    function refreshDocUi() {
        const name = Doc.name() || 'Untitled';
        $('#doc-title').textContent = name;
        $('#doc-tab-name').textContent = name;
        $('#project-pane-name').textContent = name;
        document.title = `${name}${Doc.dirty ? ' •' : ''} — ${APP_NAME}`;
        document.body.classList.toggle('is-dirty', Doc.dirty);
        let status;
        if (!Doc.id()) status = Doc.dirty ? 'Unsaved changes' : 'Not saved yet';
        else status = Doc.dirty ? 'Unsaved changes' : 'All changes saved';
        $('#project-pane-status').textContent = status;
        $('#sb-save-state').textContent = Doc.dirty ? 'Unsaved changes' : (Doc.id() ? 'Saved' : 'Ready');
    }

    function refreshSelectionUi() {
        const sel = App.getAllSelected ? App.getAllSelected() : [];
        let text = 'No selection';
        if (sel.length === 1) {
            const el = sel[0];
            const off = Array.isArray(el.offset) ? ` · x ${el.offset[0]}, y ${el.offset[1]}` : '';
            text = `${el.name}${off}`;
        } else if (sel.length > 1) {
            text = `${sel.length} elements selected`;
        }
        $('#sb-selection').textContent = text;
        $('#sb-namespace').textContent = (App.getNamespace && App.getNamespace()) || 'custom_hud';
    }

    function hookApp() {
        const wrap = (obj, key, after) => {
            const orig = obj[key];
            if (typeof orig !== 'function') return;
            obj[key] = function () {
                try {
                    return orig.apply(this, arguments);
                } finally {
                    after.apply(this, arguments);
                }
            };
        };
        wrap(App, 'pushHistory', () => Doc.markDirty());
        wrap(App, 'undo', () => Doc.markDirty());
        wrap(App, 'redo', () => Doc.markDirty());
        wrap(App, 'render', () => {
            refreshSelectionUi();
            if (window.KZCode) KZCode.schedule();
        });

        if (window.Widgets) {
            wrap(Widgets, 'setWidgetsImageData', () => Doc.markDirty());
            wrap(Widgets, 'clearWidgetsImageData', () => Doc.markDirty());
        }

        // Saving through the API marks the document clean
        const origSave = API.saveProject.bind(API);
        API.saveProject = async function (name, data, options) {
            const result = await origSave(name, data, options);
            try { localStorage.setItem('current_project_name', name); } catch (e) { /* ignore */ }
            Doc.everSaved = true;
            Doc.markClean();
            return result;
        };

        // Loading a project marks it clean (auth.js defines loadProject globally)
        if (typeof window.loadProject === 'function') {
            const origLoad = window.loadProject;
            window.loadProject = async function (id) {
                await origLoad(id);
                Doc.markClean();
                refreshSelectionUi();
            };
        }

        $('#namespace-input').addEventListener('input', () => {
            Doc.markDirty();
            refreshSelectionUi();
            if (window.KZCode) KZCode.schedule();
        });
    }

    /* ───────────── window controls ───────────── */
    function setupWindow() {
        if (!appWindow) {
            document.body.classList.add('no-native');
            return;
        }
        $$('[data-wc]').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.wc;
            if (a === 'min') appWindow.minimize();
            else if (a === 'max') appWindow.toggleMaximize();
            else if (a === 'close') appWindow.close();
        }));
        const syncMax = async () => {
            try {
                const max = await appWindow.isMaximized();
                $('[data-wc="max"]').innerHTML = max
                    ? '<svg viewBox="0 0 10 10"><path d="M3 1.5h5.5V7M1.5 3h5.5v5.5H1.5z"/></svg>'
                    : '<svg viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7"/></svg>';
                $('[data-wc="max"]').title = max ? 'Restore Down' : 'Maximize';
            } catch (e) { /* ignore */ }
        };
        appWindow.onResized(syncMax);
        syncMax();

        // Title bar: drag to move, double-click to maximize / restore
        const isDragArea = (t) => t && t.closest && t.closest('#titlebar') &&
            !t.closest('.menubar, .tb-controls, button, a, input');
        $$('[data-tauri-drag-region]').forEach(el => el.removeAttribute('data-tauri-drag-region'));
        const bar = $('#titlebar');
        bar.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !isDragArea(e.target)) return;
            if (e.detail === 2) {
                appWindow.toggleMaximize();
                return;
            }
            appWindow.startDragging().catch(err => App.showToast('Window drag failed: ' + err, 'error'));
        });

        // Ask before closing with unsaved changes
        appWindow.onCloseRequested(async (event) => {
            if (!Doc.dirty) return;
            const ok = await kzConfirm('You have unsaved changes.\n\nClose KaizerHUD Studio anyway?');
            if (!ok) event.preventDefault();
        });
    }

    /* ───────────── menus ───────────── */
    let menuOpen = false;
    function closeMenus() {
        $$('.menu.open').forEach(m => m.classList.remove('open'));
        menuOpen = false;
    }
    function setupMenus() {
        $$('.menu').forEach(menu => {
            const trigger = $('.menu-trigger', menu);
            trigger.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const wasOpen = menu.classList.contains('open');
                closeMenus();
                if (!wasOpen) {
                    menu.classList.add('open');
                    menuOpen = true;
                    syncMenuChecks();
                }
            });
            trigger.addEventListener('mouseenter', () => {
                if (menuOpen && !menu.classList.contains('open')) {
                    closeMenus();
                    menu.classList.add('open');
                    menuOpen = true;
                    syncMenuChecks();
                }
            });
        });
        $$('.menu-pop [data-cmd]').forEach(item => item.addEventListener('click', () => {
            closeMenus();
            run(item.dataset.cmd);
        }));
        $$('.menu-pop .menu-link').forEach(a => a.addEventListener('click', closeMenus));
        document.addEventListener('mousedown', (e) => {
            if (menuOpen && !e.target.closest('.menu')) closeMenus();
        });
        window.addEventListener('blur', closeMenus);
    }
    function syncMenuChecks() {
        const grid = $('[data-cmd="grid"]');
        if (grid) grid.classList.toggle('checked', $('#btn-grid-toggle').classList.contains('active'));
        const panels = $('[data-cmd="toggle-panels"]');
        if (panels) panels.classList.toggle('checked', !document.body.classList.contains('panels-hidden'));
    }

    /* ───────────── commands ───────────── */
    const click = (id) => { const el = document.getElementById(id); if (el) el.click(); };

    function currentProjectData() {
        return {
            elements: App.elements,
            namespace: App.getNamespace(),
            selectedIds: App.selectedIds,
            groups: App.groups,
            currentGroup: App.currentGroup,
            widgetsImageData: window.Widgets ? Widgets.getWidgetsImageData() : null,
            codeOverrides: App.codeOverrides || {},
            packUuids: App.packUuids || null,
            syncFolder: App.syncFolder || null,
            nameplatePosition: getNameplateSettings().position,
            nameplateMobileOffset: getNameplateSettings().mobileOffset
        };
    }

    async function quickSave() {
        const name = Doc.name();
        if (!Doc.id() || !name) {
            click('btn-save');
            return;
        }
        try {
            await API.saveProject(name, currentProjectData(), { updateExisting: true });
            try { localStorage.setItem('project_saved_signature', getProjectSignature()); } catch (e) { /* ignore */ }
            App.showToast(`Saved “${name}”`, 'success');
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    }

    async function newProject() {
        if (Doc.dirty && !(await kzConfirm('Discard unsaved changes and start a new project?'))) return;
        App.elements = [];
        App.selectedIds = [];
        App.groups = ['Main'];
        App.currentGroup = 'Main';
        App.nextId = 1;
        App.history = [];
        App.future = [];
        App.namespace = 'custom_hud';
        App.codeOverrides = {};
        App.packUuids = null;
        App.syncFolder = null;
        App.nameplatePosition = 'top_right';
        App.nameplateMobileOffset = DEFAULT_NAMEPLATE_MOBILE_OFFSET;
        if (window.KZCode) { KZCode.ensureProjectFields(); KZCode.renderSyncPane(); }
        $('#namespace-input').value = 'custom_hud';
        if (window.Widgets && Widgets.clearWidgetsImageData) Widgets.clearWidgetsImageData();
        try {
            localStorage.removeItem('current_project_id');
            localStorage.removeItem('current_project_name');
            localStorage.removeItem('project_saved_signature');
        } catch (e) { /* ignore */ }
        App.render();
        Doc.markClean();
        App.showToast('New project', 'success');
    }

    function zoomPercent() {
        return parseInt($('#zoom-level').textContent, 10) || 100;
    }
    function zoomTo(target) {
        let guard = 64;
        while (zoomPercent() < target && guard--) click('btn-zoom-in');
        while (zoomPercent() > target && guard--) click('btn-zoom-out');
    }

    function selectAllInGroup() {
        App.selectedIds = App.elements.filter(el => (el.group || 'Main') === App.currentGroup).map(el => el.id);
        App.render();
    }

    function deselect() {
        App.selectedIds = [];
        App.render();
    }

    function openDockPane(name) {
        document.body.classList.remove('panels-hidden');
        $$('#dock-lower .dock-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === name));
        $$('#dock-lower .dock-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === name));
    }

    function openHelp() {
        const frame = $('#help-frame');
        if (!frame.getAttribute('src')) frame.setAttribute('src', 'wiki.html');
        $('#help-overlay').style.display = 'flex';
    }
    function closeHelp() {
        $('#help-overlay').style.display = 'none';
    }

    function showWindow(title, bodyHtml) {
        const back = document.createElement('div');
        back.className = 'kz-modal';
        back.innerHTML = `
            <div class="kz-window">
                <div class="kz-window-head"><span>${title}</span>
                    <button class="icon-btn small" data-close title="Close"><svg><use href="#i-close"/></svg></button></div>
                <div class="kz-window-body">${bodyHtml}</div>
                <div class="kz-window-foot"><button class="primary-btn" data-close>OK</button></div>
            </div>`;
        const close = () => back.remove();
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
        $$('[data-close]', back).forEach(b => b.addEventListener('click', close));
        document.body.appendChild(back);
        $('.primary-btn', back).focus();
        return back;
    }

    function showAbout() {
        const ver = (window.KZUpdater && window.KZUpdater.getVersion && window.KZUpdater.getVersion()) || '1.0.3';
        showWindow('About', `
            <div class="kz-about">
                <img src="img/favicon.png" alt="" />
                <div>
                    <h3>KaizerHUD Studio</h3>
                    <p>Version ${ver}<br/>Open-source visual HUD &amp; GUI designer for Minecraft Bedrock JSON UI &amp; Java.<br/>Licensed under GPL-3.0 · KaizerMC Community</p>
                </div>
            </div>`);
    }

    function showShortcuts() {
        const rows = [
            ['New project', 'Ctrl+N'], ['Open project', 'Ctrl+O'], ['Save', 'Ctrl+S'], ['Save as', 'Ctrl+Shift+S'],
            ['Export .mcpack', 'Ctrl+E'], ['Undo / Redo', 'Ctrl+Z / Ctrl+Y'], ['Copy / Paste', 'Ctrl+C / Ctrl+V'],
            ['Duplicate', 'Ctrl+D'], ['Delete', 'Del'], ['Select all in group', 'Ctrl+A'], ['Deselect', 'Esc'],
            ['Nudge 0.1 / 1.0', 'Arrows / Ctrl+Arrows'], ['Zoom in / out', 'Mouse wheel  ·  Ctrl++ / Ctrl+−'],
            ['Pan canvas', 'Space+Drag  ·  Middle drag'], ['Select the element underneath', 'Alt+Click'],
            ['Actual size', 'Ctrl+0'], ['Canvas / Code / Split', 'Ctrl+1 / 2 / 3'], ['Anchor grid', 'G'], ['Show / hide panels', 'Tab'],
            ['Image · Text · Head', 'I · T · H'], ['Bar · XP · Nameplate', 'B · X · N'], ['HUD Forge (templates)', 'F'], ['User guide', 'F1']
        ];
        showWindow('Keyboard Shortcuts', `<div class="kz-keys">${rows.map(([a, k]) => `<span>${a}</span><kbd>${k}</kbd>`).join('')}</div>`);
    }

    const commands = {
        'new': newProject,
        'open': () => click('btn-load'),
        'save': quickSave,
        'save-as': () => click('btn-save'),
        'projects-folder': () => click('btn-open-projects-folder'),
        'widgets': () => { openDockPane('widgets'); click('btn-upload-widgets'); },
        'export': () => click('btn-export'),
        'import-java-hud': () => window.JavaHudImport && JavaHudImport.start(false),
        'import-java-hud-folder': () => window.JavaHudImport && JavaHudImport.start(true),
        'export-java-hud': () => window.JavaHudExport && JavaHudExport.open(),
        'hud-forge': () => window.HudForge && HudForge.open(),
        'exit': () => { if (appWindow) appWindow.close(); },
        'undo': () => App.undo(),
        'redo': () => App.redo(),
        'copy': () => App.copySelected && App.copySelected(),
        'paste': () => App.pasteClipboard && App.pasteClipboard(),
        'duplicate': () => App.duplicateSelected && App.duplicateSelected(),
        'delete': () => App.removeSelected && App.removeSelected(),
        'select-all': selectAllInGroup,
        'deselect': deselect,
        'add-image': () => click('btn-add-image'),
        'add-text': () => click('btn-add-text'),
        'add-head': () => click('btn-add-player-head'),
        'add-bar': () => click('btn-add-bar'),
        'add-xp': () => click('btn-add-xp'),
        'add-nameplate': () => click('btn-add-nameplate'),
        'zoom-in': () => click('btn-zoom-in'),
        'zoom-out': () => click('btn-zoom-out'),
        'zoom-reset': () => zoomTo(100),
        'grid': () => click('btn-grid-toggle'),
        'toggle-panels': () => {
            document.body.classList.toggle('panels-hidden');
            setTimeout(() => App.render(), 0);
            setTimeout(() => App.render(), 250);
        },
        'fullscreen': () => { if (appWindow) appWindow.toggleMaximize(); },
        'wiki': openHelp,
        'shortcuts': showShortcuts,
        'check-updates': () => window.KZUpdater && window.KZUpdater.checkManual(),
        'about': showAbout,
        'live-sync': () => { openDockPane('project'); click('btn-sync-choose'); },
        'view-canvas': () => window.KZCode && KZCode.setView('canvas'),
        'view-code': () => window.KZCode && KZCode.setView('code'),
        'view-split': () => window.KZCode && KZCode.setView('split')
    };
    function run(cmd) {
        const fn = commands[cmd];
        if (fn) fn();
    }

    /* ───────────── keyboard ───────────── */
    function isTyping(e) {
        const t = e.target;
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }
    function anyModalOpen() {
        return $$('.kz-modal, .kz-dlg-back, .kz-upd-back').some(m => m.style.display !== 'none' && m.offsetParent !== null);
    }

    // Dev mode = the UI comes from the local test server, not from inside the exe
    // (release builds load http://tauri.localhost — no port — so this is never true there)
    const DEV_MODE = location.port === '8765' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

    function setupKeys() {
        document.addEventListener('keydown', (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            const k = e.key.toLowerCase();

            // Never let the webview reload / print / open find — except F5 / Ctrl+R in dev mode
            // (dev_kaizerhud.bat: debug build that loads ui/ from http://localhost:8765)
            const devReload = DEV_MODE && (e.key === 'F5' || (ctrl && k === 'r'));
            if (!devReload && (e.key === 'F5' || (ctrl && (k === 'r' || k === 'p' || k === 'f' || k === 'g' || k === 'u')))) {
                e.preventDefault();
            }

            if (e.key === 'Escape') {
                if (menuOpen) { closeMenus(); return; }
                if ($('#help-overlay').style.display !== 'none') { closeHelp(); return; }
                // About / License / Shortcuts windows
                const dynamicWins = $$('.kz-modal:not([id])');
                if (dynamicWins.length) { dynamicWins[dynamicWins.length - 1].remove(); return; }
                const openModal = ['export-confirm-modal', 'load-modal', 'save-modal']
                    .map(id => document.getElementById(id))
                    .find(m => m && m.style.display !== 'none');
                if (openModal) {
                    const cancel = { 'export-confirm-modal': 'export-cancel-btn', 'load-modal': 'load-cancel', 'save-modal': 'save-cancel' }[openModal.id];
                    click(cancel);
                    return;
                }
                if (!isTyping(e)) deselect();
                return;
            }

            if (anyModalOpen()) return;

            if (ctrl) {
                const map = {
                    'n': 'new', 'o': 'open', 'e': 'export', 'd': 'duplicate', '0': 'zoom-reset',
                    '1': 'view-canvas', '2': 'view-code', '3': 'view-split',
                    '=': 'zoom-in', '+': 'zoom-in', '-': 'zoom-out', '_': 'zoom-out'
                };
                if (k === 's') { e.preventDefault(); run(e.shiftKey ? 'save-as' : 'save'); return; }
                if (k === 'a' && !isTyping(e)) { e.preventDefault(); run('select-all'); return; }
                if (map[k] && !(isTyping(e) && (k === 'd' || k === '0'))) {
                    e.preventDefault();
                    run(map[k]);
                }
                return;
            }

            if (e.key === 'F1') { e.preventDefault(); openHelp(); return; }
            if (e.key === 'F11') { e.preventDefault(); run('fullscreen'); return; }
            if (isTyping(e) || e.altKey) return;

            if (e.key === 'Tab') { e.preventDefault(); run('toggle-panels'); return; }
            const tools = { i: 'add-image', t: 'add-text', h: 'add-head', b: 'add-bar', x: 'add-xp', n: 'add-nameplate', g: 'grid', f: 'hud-forge' };
            if (tools[k]) { e.preventDefault(); run(tools[k]); }
        });

        // Mouse wheel zooms the canvas toward the cursor (Shift+wheel scrolls sideways)
        const board = $('#pasteboard');
        let wheelAcc = 0;
        board.addEventListener('wheel', (e) => {
            if (e.shiftKey) return; // let Shift+wheel scroll horizontally
            e.preventDefault();
            wheelAcc += e.deltaY;
            if (Math.abs(wheelAcc) < 40) return; // smooth out touchpads
            const zoomIn = wheelAcc < 0;
            wheelAcc = 0;

            const screen = $('#preview-screen');
            const before = screen.getBoundingClientRect();
            const fx = (e.clientX - before.left) / before.width;
            const fy = (e.clientY - before.top) / before.height;
            const oldZoom = zoomPercent();
            run(zoomIn ? 'zoom-in' : 'zoom-out');
            if (zoomPercent() === oldZoom) return;
            // keep the point under the cursor in place
            const after = screen.getBoundingClientRect();
            board.scrollLeft += after.left + fx * after.width - e.clientX;
            board.scrollTop += after.top + fy * after.height - e.clientY;
        }, { passive: false });

        // Pan: middle mouse drag, or hold Space and drag
        let spaceDown = false;
        let pan = null;
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !isTyping(e) && !spaceDown) {
                spaceDown = true;
                board.classList.add('can-pan');
                e.preventDefault();
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spaceDown = false;
                board.classList.remove('can-pan');
            }
        });
        board.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && spaceDown)) {
                e.preventDefault();
                e.stopPropagation();
                pan = { x: e.clientX, y: e.clientY, sl: board.scrollLeft, st: board.scrollTop };
                board.classList.add('panning');
            }
        }, true);
        document.addEventListener('mousemove', (e) => {
            if (!pan) return;
            board.scrollLeft = pan.sl - (e.clientX - pan.x);
            board.scrollTop = pan.st - (e.clientY - pan.y);
        });
        document.addEventListener('mouseup', () => {
            if (!pan) return;
            pan = null;
            board.classList.remove('panning');
        });

        // Clicking empty pasteboard clears the selection
        $('#pasteboard').addEventListener('mousedown', (e) => {
            if (e.target.id === 'pasteboard') deselect();
        });

        // No browser context menu outside text fields
        document.addEventListener('contextmenu', (e) => {
            if (!isTyping(e)) e.preventDefault();
        });
    }

    /* ───────────── tool strip tooltips ───────────── */
    function setupTooltips() {
        const tip = document.createElement('div');
        tip.className = 'kz-tip';
        document.body.appendChild(tip);
        let timer = null;
        $$('#toolstrip .tool').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    const key = btn.dataset.key ? `<kbd>${btn.dataset.key}</kbd>` : '';
                    tip.innerHTML = `${btn.dataset.tip}${key}`;
                    const r = btn.getBoundingClientRect();
                    tip.style.left = `${r.right + 8}px`;
                    tip.style.top = `${r.top + r.height / 2 - 13}px`;
                    tip.classList.add('show');
                }, 350);
            });
            btn.addEventListener('mouseleave', () => {
                clearTimeout(timer);
                tip.classList.remove('show');
            });
            btn.addEventListener('mousedown', () => {
                clearTimeout(timer);
                tip.classList.remove('show');
            });
        });
        $('#btn-tool-widgets').addEventListener('click', () => openDockPane('widgets'));
        $('#btn-tool-forge').addEventListener('click', () => run('hud-forge'));
        $('#btn-tool-help').addEventListener('click', openHelp);
    }

    /* ───────────── dock & resizable panels ───────────── */
    function setupWidthResizer(opts) {
        const resizer = $(opts.resizer);
        const panel = $(opts.panel);
        if (!resizer || !panel) return;

        const applyWidth = (w) => {
            panel.style.width = `${w}px`;
            if (opts.cssVar) document.documentElement.style.setProperty(opts.cssVar, `${w}px`);
        };

        try {
            const saved = parseInt(localStorage.getItem(opts.storageKey), 10);
            if (saved >= opts.min && saved <= opts.max) applyWidth(saved);
        } catch (e) { /* ignore */ }

        let startX = 0, startW = 0;
        const clamp = (raw) => {
            const container = resizer.parentElement ? resizer.parentElement.getBoundingClientRect().width : window.innerWidth;
            const maxAllowed = Math.max(opts.min, Math.min(opts.max, container - (opts.minCenter || 240)));
            return Math.max(opts.min, Math.min(maxAllowed, Math.round(raw)));
        };

        const onMove = (e) => {
            const dx = e.clientX - startX;
            const next = clamp(opts.side === 'right' ? startW - dx : startW + dx);
            applyWidth(next);
            if (opts.onResize) opts.onResize();
        };

        const onUp = () => {
            resizer.classList.remove('dragging');
            document.body.classList.remove('kz-resizing-col');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const cur = parseInt(panel.style.width, 10);
            if (cur) {
                try { localStorage.setItem(opts.storageKey, String(cur)); } catch (e) { /* ignore */ }
            }
            if (opts.onEnd) opts.onEnd();
        };

        resizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startX = e.clientX;
            startW = panel.getBoundingClientRect().width;
            resizer.classList.add('dragging');
            document.body.classList.add('kz-resizing-col');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        resizer.addEventListener('dblclick', () => {
            panel.style.width = '';
            if (opts.cssVar) document.documentElement.style.removeProperty(opts.cssVar);
            try { localStorage.removeItem(opts.storageKey); } catch (e) { /* ignore */ }
            if (opts.onResize) opts.onResize();
            if (opts.onEnd) opts.onEnd();
        });
    }

    function setupSplitViewResizer() {
        const resizer = $('#split-view-resizer');
        const views = $('#doc-views');
        if (!resizer || !views) return;
        const STORE = 'kz_split_code_pct';

        const applyPct = (pct) => {
            document.documentElement.style.setProperty('--split-code-w', `${pct}%`);
        };
        try {
            const saved = parseFloat(localStorage.getItem(STORE));
            if (saved >= 25 && saved <= 75) applyPct(saved);
        } catch (e) { /* ignore */ }

        const onMove = (e) => {
            const rect = views.getBoundingClientRect();
            if (rect.width <= 0) return;
            const rawPct = ((rect.right - e.clientX) / rect.width) * 100;
            const pct = Math.max(25, Math.min(75, Math.round(rawPct * 10) / 10));
            applyPct(pct);
            App.render();
        };
        const onUp = () => {
            resizer.classList.remove('dragging');
            document.body.classList.remove('kz-resizing-col');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const cur = parseFloat(document.documentElement.style.getPropertyValue('--split-code-w'));
            if (cur) {
                try { localStorage.setItem(STORE, String(cur)); } catch (e) { /* ignore */ }
            }
            App.render();
        };

        resizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            resizer.classList.add('dragging');
            document.body.classList.add('kz-resizing-col');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        resizer.addEventListener('dblclick', () => {
            document.documentElement.style.removeProperty('--split-code-w');
            try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
            App.render();
        });
    }

    function setupDock() {
        $$('#dock-lower .dock-tab').forEach(tab => tab.addEventListener('click', () => openDockPane(tab.dataset.pane)));

        setupWidthResizer({
            resizer: '#dock-resizer',
            panel: '#dock',
            side: 'right',
            min: 240,
            max: 620,
            defaultWidth: 340,
            minCenter: 280,
            storageKey: 'kz_hud_dock_width',
            cssVar: '--dock-w',
            onResize: () => App.render()
        });
        setupWidthResizer({
            resizer: '#code-tree-resizer',
            panel: '#code-tree',
            side: 'left',
            min: 140,
            max: 420,
            defaultWidth: 220,
            minCenter: 220,
            storageKey: 'kz_code_tree_width'
        });
        setupSplitViewResizer();

        const splitter = $('#dock-splitter');
        const lower = $('#dock-lower');
        let startY = 0, startH = 0;
        const STORE = 'kz_dock_lower_height';
        try {
            const saved = parseInt(localStorage.getItem(STORE), 10);
            if (saved) lower.style.flexBasis = `${saved}px`;
        } catch (e) { /* ignore */ }
        const onMove = (e) => {
            const dock = $('#dock').getBoundingClientRect();
            const h = Math.max(140, Math.min(dock.height - 180, startH - (e.clientY - startY)));
            lower.style.flexBasis = `${h}px`;
        };
        const onUp = () => {
            splitter.classList.remove('dragging');
            document.body.classList.remove('kz-resizing-row');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            try { localStorage.setItem(STORE, parseInt(lower.style.flexBasis, 10)); } catch (e) { /* ignore */ }
        };
        splitter.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            startY = e.clientY;
            startH = lower.getBoundingClientRect().height;
            splitter.classList.add('dragging');
            document.body.classList.add('kz-resizing-row');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        splitter.addEventListener('dblclick', () => {
            lower.style.flexBasis = '';
            try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
        });
    }

    /* ───────────── misc wiring ───────────── */
    function setupMisc() {
        $('#btn-quick-save').addEventListener('click', quickSave);
        $('#load-close-x').addEventListener('click', () => click('load-cancel'));
        $('#help-close').addEventListener('click', closeHelp);
        $('#help-overlay').addEventListener('mousedown', (e) => { if (e.target.id === 'help-overlay') closeHelp(); });
        window.addEventListener('message', (e) => { if (e.data === 'kz-close-help') closeHelp(); });

        // Re-layout elements whenever the canvas changes size (panels toggled, window resized…)
        let rafId = 0;
        new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => App.render());
        }).observe($('#preview-screen'));

        // zoom label: click = 100%, mirror into status bar
        const zl = $('#zoom-level');
        zl.addEventListener('click', () => zoomTo(100));
        new MutationObserver(() => { $('#sb-zoom').textContent = zl.textContent; }).observe(zl, { childList: true, characterData: true, subtree: true });

        // Save dialog: Enter submits, focus the name field when it opens
        const saveName = $('#save-project-name');
        saveName.addEventListener('keydown', (e) => { if (e.key === 'Enter') click('save-submit'); });
        new MutationObserver(() => {
            if ($('#save-modal').style.display !== 'none') setTimeout(() => { saveName.focus(); saveName.select(); }, 0);
        }).observe($('#save-modal'), { attributes: true, attributeFilter: ['style'] });

        // Closing the Open dialog by clicking the backdrop
        ['load-modal', 'save-modal', 'export-confirm-modal'].forEach(id => {
            const m = document.getElementById(id);
            const cancel = { 'load-modal': 'load-cancel', 'save-modal': 'save-cancel', 'export-confirm-modal': 'export-cancel-btn' }[id];
            m.addEventListener('mousedown', (e) => { if (e.target === m) click(cancel); });
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        hookApp();
        setupWindow();
        setupMenus();
        setupKeys();
        setupTooltips();
        setupDock();
        setupMisc();
        if (window.KZCode) KZCode.setup();
        refreshDocUi();
        refreshSelectionUi();
    });
})();
