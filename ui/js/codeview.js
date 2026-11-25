/* ==========================================================
   Live code view + folder sync

   • The Code panel shows the resource pack exactly as it is generated,
     updating while you design.
   • Hand edits are stored as overrides (a patch over the generated code)
     in App.codeOverrides and re-applied on every generation, so the
     generated code stays the source of truth.
   • Live sync writes the readable pack into a folder (e.g. Minecraft's
     development_resource_packs) after every change.
   ========================================================== */
(function () {
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    const TAURI = window.__TAURI__;
    const invoke = (cmd, args) => TAURI && TAURI.core
        ? TAURI.core.invoke(cmd, args || {}).catch(err => { throw new Error(typeof err === 'string' ? err : (err && err.message) || 'Unknown error'); })
        : Promise.reject(new Error('Desktop backend is not available'));

    const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const state = {
        view: 'canvas',          // canvas | code | split
        preview: null,           // last generate_preview result
        path: 'ui/hud_screen.json',
        editing: false,
        timer: null,
        syncTimer: null,
        syncBusy: false,
        syncPending: false,
        lastError: null
    };

    /* ───────────── project data ───────────── */

    function ensureProjectFields() {
        if (!App.codeOverrides || typeof App.codeOverrides !== 'object') App.codeOverrides = {};
        if (!Array.isArray(App.packUuids) || App.packUuids.length !== 2) {
            App.packUuids = [crypto.randomUUID(), crypto.randomUUID()];
        }
        if (App.syncFolder === undefined) App.syncFolder = null;
    }

    function fullData() {
        ensureProjectFields();
        return {
            elements: App.elements,
            namespace: App.getNamespace(),
            widgetsImageData: window.Widgets ? Widgets.getWidgetsImageData() : null,
            codeOverrides: App.codeOverrides,
            packUuids: App.packUuids,
            nameplatePosition: getNameplateSettings().position,
            nameplateMobileOffset: getNameplateSettings().mobileOffset,
            hudChannel: getHudChannel()
        };
    }

    // Images are not needed to generate code: send tiny stand-ins to keep this fast
    function lightData() {
        const d = fullData();
        d.elements = App.elements.map(el => {
            const copy = Object.assign({}, el);
            if (typeof copy.imageData === 'string' && copy.imageData.startsWith('data:image')) copy.imageData = TINY_PNG;
            if (Array.isArray(copy.slicedImages)) copy.slicedImages = copy.slicedImages.map(s => (s ? TINY_PNG : s));
            // frame count + animFrameSize are enough for the flip_book code
            if (Array.isArray(copy.animFrames)) copy.animFrames = copy.animFrames.map(() => TINY_PNG);
            if (Array.isArray(copy.barEffects)) copy.barEffects = [];
            return copy;
        });
        d.widgetsImageData = null;
        return d;
    }

    /* ───────────── override patches ───────────── */

    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const singleKey = (v) => (isObj(v) && Object.keys(v).length === 1 ? Object.keys(v)[0] : null);
    const isKeyed = (arr) => {
        if (!Array.isArray(arr)) return false;
        const keys = arr.map(singleKey);
        return keys.every(k => k !== null) && new Set(keys).size === keys.length;
    };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    /** Difference between generated and edited JSON (see src-tauri/src/overrides.rs) */
    function makeOverridePatch(base, edited) {
        if (isObj(base) && isObj(edited)) {
            const patch = {};
            let changed = false;
            for (const k of Object.keys(base)) {
                if (!(k in edited)) { patch[k] = null; changed = true; }
            }
            for (const k of Object.keys(edited)) {
                if (!(k in base)) { patch[k] = edited[k]; changed = true; continue; }
                const sub = makeOverridePatch(base[k], edited[k]);
                if (sub !== undefined) { patch[k] = sub; changed = true; }
            }
            return changed ? patch : undefined;
        }
        if (Array.isArray(base) && Array.isArray(edited)) {
            if (same(base, edited)) return undefined;
            if (isKeyed(base) && isKeyed(edited) && (base.length > 0 || edited.length > 0)) {
                const items = {};
                const baseMap = new Map(base.map(it => [singleKey(it), it[singleKey(it)]]));
                const editMap = new Map(edited.map(it => [singleKey(it), it[singleKey(it)]]));
                for (const k of baseMap.keys()) if (!editMap.has(k)) items[k] = null;
                for (const [k, v] of editMap) {
                    if (!baseMap.has(k)) { items[k] = v; continue; }
                    const sub = makeOverridePatch(baseMap.get(k), v);
                    if (sub !== undefined) items[k] = sub;
                }
                return { $kz: 'keyed', items };
            }
            if (base.length === edited.length) {
                const items = {};
                edited.forEach((v, i) => {
                    const sub = makeOverridePatch(base[i], v);
                    if (sub !== undefined) items[String(i)] = sub;
                });
                return { $kz: 'index', items };
            }
            return { $kz: 'replace', value: edited };
        }
        if (same(base, edited)) return undefined;
        if (Array.isArray(edited)) return { $kz: 'replace', value: edited };
        return edited;
    }

    /* ───────────── generation ───────────── */

    function codeVisible() {
        return state.view !== 'canvas';
    }

    function schedule() {
        if (!TAURI) return;
        if (codeVisible()) {
            clearTimeout(state.timer);
            state.timer = setTimeout(refresh, 250);
        }
        if (App.syncFolder) scheduleSync();
    }

    async function refresh() {
        if (!codeVisible() || state.editing) return;
        try {
            state.preview = await invoke('generate_preview', { data: lightData() });
            state.lastError = null;
        } catch (err) {
            state.lastError = err.message;
        }
        renderTree();
        renderFile();
    }

    /* ───────────── rendering ───────────── */

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function highlightJson(src) {
        return esc(src).replace(
            /(&quot;|")((?:\\.|[^"\\])*)"(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\/\/.*)/g,
            (m, q, str, colon, kw, num, comment) => {
                if (str !== undefined) {
                    return colon ? `<span class="t-key">"${str}"</span>${colon}` : `<span class="t-str">"${str}"</span>`;
                }
                if (kw) return `<span class="t-kw">${kw}</span>`;
                if (num) return `<span class="t-num">${num}</span>`;
                if (comment) return `<span class="t-com">${comment}</span>`;
                return m;
            });
    }

    function highlightYaml(src) {
        return esc(src).split('\n').map(line => {
            if (/^\s*#/.test(line)) return `<span class="t-com">${line}</span>`;
            return line
                .replace(/^(\s*)([\w.-]+)(:)/, '$1<span class="t-key">$2</span>$3')
                .replace(/(&quot;|")(.*?)"/g, '<span class="t-str">"$2"</span>')
                .replace(/:\s(true|false)\b/, ': <span class="t-kw">$1</span>')
                .replace(/:\s(-?\d+)$/, ': <span class="t-num">$1</span>');
        }).join('\n');
    }

    function currentFile() {
        if (!state.preview) return null;
        return state.preview.files.find(f => f.path === state.path) || state.preview.files[0] || null;
    }

    function fileIcon(path) {
        if (path.endsWith('.json')) return '<span class="ft ft-json">{}</span>';
        if (path.endsWith('.yml')) return '<span class="ft ft-yml">≡</span>';
        if (path.endsWith('.png')) return '<span class="ft ft-png">▣</span>';
        return '<span class="ft">•</span>';
    }

    function renderTree() {
        const tree = $('#code-tree');
        if (!tree) return;
        if (!state.preview) {
            tree.innerHTML = `<div class="tree-empty">${state.lastError ? esc(state.lastError) : 'Generating…'}</div>`;
            return;
        }
        const ns = state.preview.namespace;
        const files = state.preview.files.filter(f => f.path !== 'config.yml');
        const assets = state.preview.assets.map(a => a.path);
        if (window.Widgets && Widgets.getWidgetsImageData()) {
            for (let i = 0; i < 9; i++) assets.push(`textures/ui/hotbar_${i}.png`);
            assets.push('textures/ui/selected_hotbar_slot.png');
        }
        const item = (f, label) => `
            <button class="tree-item${f.path === state.path ? ' active' : ''}" data-path="${esc(f.path)}" title="${esc(f.path)}">
                ${fileIcon(f.path)}<span>${esc(label || f.path)}</span>${f.overridden ? '<b class="tree-mod" title="Edited">M</b>' : ''}
            </button>`;
        const yml = state.preview.files.find(f => f.path === 'config.yml');
        tree.innerHTML = `
            <div class="tree-section">${esc(ns)}.mcpack</div>
            ${files.map(f => item(f)).join('')}
            <details class="tree-assets"><summary>textures <em>${assets.length}</em></summary>
                ${[...new Set(assets)].sort().map(p => `<div class="tree-asset">${fileIcon(p)}<span>${esc(p)}</span></div>`).join('')}
            </details>
            <div class="tree-section">plugins/KaizerMultiBar</div>
            ${yml ? item(yml) : ''}`;
        $$('.tree-item', tree).forEach(b => b.addEventListener('click', () => {
            if (state.editing && !confirmLeaveEdit()) return;
            state.path = b.dataset.path;
            renderTree();
            renderFile();
        }));
    }

    function renderFile() {
        const body = $('#code-body');
        if (!body) return;
        const f = currentFile();
        const pathEl = $('#code-path');
        const badge = $('#code-badge');
        const note = $('#code-note');
        if (!f) {
            body.innerHTML = '';
            pathEl.textContent = '';
            return;
        }
        state.path = f.path;
        pathEl.textContent = f.path;
        badge.textContent = f.overridden ? 'Edited' : (f.editable ? 'Generated' : 'Read-only');
        badge.className = 'code-badge' + (f.overridden ? ' edited' : '');
        $('#code-btn-edit').style.display = f.editable && !state.editing ? '' : 'none';
        $('#code-btn-reset').style.display = f.overridden && !state.editing ? '' : 'none';
        $('#code-btn-apply').style.display = state.editing ? '' : 'none';
        $('#code-btn-cancel').style.display = state.editing ? '' : 'none';
        note.innerHTML = f.overridden
            ? 'Your edits are kept on top of the generated code. Changed lines are marked. <b>Reset</b> returns to the generated version.'
            : 'Live preview of the generated resource pack. Click Edit to customize any file.';

        if (state.editing) return;

        // mark lines that differ from the generated version
        const genCount = new Map();
        f.generated.split('\n').forEach(l => genCount.set(l, (genCount.get(l) || 0) + 1));
        const lines = f.content.split('\n');
        const changed = lines.map(l => {
            const n = genCount.get(l) || 0;
            if (n > 0) { genCount.set(l, n - 1); return false; }
            return true;
        });
        const html = (f.lang === 'yaml' ? highlightYaml(f.content) : highlightJson(f.content)).split('\n');
        const scroll = body.scrollTop;
        body.innerHTML = `<div class="code-lines">${html.map((h, i) =>
            `<div class="cl${changed[i] ? ' chg' : ''}"><span class="ln">${i + 1}</span><span class="lc">${h || ' '}</span></div>`).join('')}</div>`;
        body.scrollTop = scroll;
    }

    /* ───────────── editing ───────────── */

    function startEdit() {
        const f = currentFile();
        if (!f || !f.editable) return;
        state.editing = true;
        const ta = $('#code-edit');
        ta.value = f.content;
        $('#code-body').style.display = 'none';
        ta.style.display = 'block';
        $('#code-error').textContent = '';
        renderFile();
        ta.focus();
    }

    function stopEdit() {
        state.editing = false;
        $('#code-edit').style.display = 'none';
        $('#code-body').style.display = '';
        $('#code-error').textContent = '';
    }

    function confirmLeaveEdit() {
        stopEdit();
        return true;
    }

    function applyEdit() {
        const f = currentFile();
        if (!f) return;
        const text = $('#code-edit').value;
        ensureProjectFields();
        if (f.lang === 'yaml') {
            if (text === f.generated) delete App.codeOverrides[f.path];
            else App.codeOverrides[f.path] = text;
        } else {
            let edited;
            try {
                edited = JSON.parse(text.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'));
            } catch (err) {
                const m = /position (\d+)/.exec(err.message);
                const line = m ? text.slice(0, Number(m[1])).split('\n').length : null;
                $('#code-error').textContent = `JSON error${line ? ` on line ${line}` : ''}: ${err.message}`;
                return;
            }
            const patch = makeOverridePatch(JSON.parse(f.generated), edited);
            if (patch === undefined) delete App.codeOverrides[f.path];
            else App.codeOverrides[f.path] = patch;
        }
        stopEdit();
        if (window.KZDoc) KZDoc.markDirty();
        App.showToast(App.codeOverrides[f.path] ? `Edits applied to ${f.path}` : 'No changes — using generated code', 'success');
        refresh();
        if (App.syncFolder) scheduleSync();
    }

    async function resetFile() {
        const f = currentFile();
        if (!f || !App.codeOverrides[f.path]) return;
        if (!(await kzConfirm(`Remove your edits to ${f.path} and use the generated code again?`))) return;
        delete App.codeOverrides[f.path];
        if (window.KZDoc) KZDoc.markDirty();
        refresh();
        if (App.syncFolder) scheduleSync();
    }

    /* ───────────── view switching ───────────── */

    function setView(view) {
        if (!TAURI && view !== 'canvas') {
            App.showToast('The code view needs the desktop app', 'error');
            return;
        }
        state.view = view;
        document.body.dataset.docView = view;
        $$('.view-switch [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        try { localStorage.setItem('kz_doc_view', view); } catch (e) { /* ignore */ }
        setTimeout(() => App.render(), 0);
        if (view !== 'canvas') refresh();
    }

    /* ───────────── live folder sync ───────────── */

    function syncStatus(text, kind) {
        const el = $('#sb-sync');
        if (el) {
            el.textContent = text;
            el.className = 'sb-item sb-sync' + (kind ? ' ' + kind : '');
            el.style.display = text ? '' : 'none';
        }
        const p = $('#sync-status');
        if (p) p.textContent = text || 'Off';
    }

    function renderSyncPane() {
        const card = $('.sync-card');
        if (card) card.classList.remove('locked');
        const on = !!App.syncFolder;
        $('#sync-path').textContent = on ? App.syncFolder : 'Not set';
        $('#sync-path').title = on ? App.syncFolder : '';
        $('#btn-sync-off').style.display = on ? '' : 'none';
        $('#btn-sync-open').style.display = on ? '' : 'none';
        $('#btn-sync-choose').querySelector('span').textContent = on ? 'Change…' : 'Choose folder…';
        if (!on) syncStatus('', '');
    }

    function scheduleSync() {
        clearTimeout(state.syncTimer);
        state.syncTimer = setTimeout(runSync, 800);
    }

    async function runSync(force) {
        if (!App.syncFolder) return;
        if (state.syncBusy) { state.syncPending = true; return; }
        state.syncBusy = true;
        syncStatus('⟳ Syncing…', 'busy');
        try {
            const r = await invoke('sync_pack', { data: fullData(), folder: App.syncFolder, force: !!force });
            const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            syncStatus(`✓ Synced ${t} · ${r.files} files`, 'ok');
        } catch (err) {
            syncStatus(err.message === 'FOLDER_NOT_EMPTY' ? '⚠ Sync folder has other files' : `⚠ Sync failed: ${err.message}`, 'bad');
        } finally {
            state.syncBusy = false;
            if (state.syncPending) { state.syncPending = false; scheduleSync(); }
        }
    }

    async function chooseSyncFolder() {
        let picked;
        try { picked = await invoke('choose_sync_folder'); } catch (err) { alert(err.message); return; }
        if (!picked) return;
        if (!picked.safe) {
            const ok = await kzConfirm(`This folder already contains other files:\n${picked.path}\n\nFiles with the same names will be overwritten. Use it anyway?`);
            if (!ok) return;
        }
        App.syncFolder = picked.path;
        if (window.KZDoc) KZDoc.markDirty();
        renderSyncPane();
        runSync(true);
    }

    function setup() {
        ensureProjectFields();
        $$('.view-switch [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        $('#code-btn-edit').addEventListener('click', startEdit);
        $('#code-btn-cancel').addEventListener('click', () => { stopEdit(); renderFile(); });
        $('#code-btn-apply').addEventListener('click', applyEdit);
        $('#code-btn-reset').addEventListener('click', resetFile);
        $('#code-btn-copy').addEventListener('click', () => {
            const f = currentFile();
            if (f && navigator.clipboard) navigator.clipboard.writeText(f.content).then(() => App.showToast('Copied to clipboard', 'success'));
        });
        const ta = $('#code-edit');
        ta.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
                e.preventDefault();
                e.stopPropagation();
                applyEdit();
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                stopEdit();
                renderFile();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                const s = ta.selectionStart;
                ta.setRangeText('    ', s, ta.selectionEnd, 'end');
            }
        }, true);

        $('#btn-sync-choose').addEventListener('click', chooseSyncFolder);
        $('#btn-sync-off').addEventListener('click', () => {
            App.syncFolder = null;
            if (window.KZDoc) KZDoc.markDirty();
            renderSyncPane();
        });
        $('#btn-sync-open').addEventListener('click', () => {
            invoke('open_folder', { path: App.syncFolder }).catch(err => alert(err.message));
        });
        renderSyncPane();

        let saved = 'canvas';
        try { saved = localStorage.getItem('kz_doc_view') || 'canvas'; } catch (e) { /* ignore */ }
        setView(TAURI ? saved : 'canvas');
    }

    window.KZCode = {
        setup,
        schedule,
        setView,
        refresh,
        renderSyncPane,
        syncNow: () => runSync(),
        ensureProjectFields,
        fullData,
        makeOverridePatch,
        isEditing: () => state.editing
    };
})();
