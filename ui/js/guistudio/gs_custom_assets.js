/* ========================================
   GUI Studio — Plugin Custom Assets Manager & Cache Client
   Talks to Rust custom_assets_* commands for ItemsAdder, Nexo, Oraxen,
   ModelEngine 4, BetterModel, and multi-namespace resource packs.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const CUSTOM_PREFIX_RE = /^(itemsadder:|ia:|nexo:|oraxen:|craftengine:|ce:|meg:|bm:|modelengine:|bettermodel:|model:|custom:)/i;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function tauri() {
        return window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__.core : null;
    }

    const state = {
        loaded: false,
        loading: null,
        sources: [],
        items: [],
        byKey: new Map(),
        modelCache: new Map(),
        pendingIcons: new Set(),
        listeners: new Set(),
    };

    function indexItems() {
        state.byKey.clear();
        for (const it of state.items) {
            const id = String(it.id || '').toLowerCase();
            if (!id) continue;
            state.byKey.set(id, it);
            if (id.startsWith('itemsadder:')) state.byKey.set('ia:' + id.slice('itemsadder:'.length), it);
            else if (id.startsWith('ia:')) state.byKey.set('itemsadder:' + id.slice('ia:'.length), it);
            else if (id.startsWith('craftengine:')) state.byKey.set('ce:' + id.slice('craftengine:'.length), it);
            else if (id.startsWith('ce:')) state.byKey.set('craftengine:' + id.slice('ce:'.length), it);
            else if (id.startsWith('meg:')) state.byKey.set('modelengine:' + id.slice('meg:'.length), it);
            else if (id.startsWith('bm:')) state.byKey.set('bettermodel:' + id.slice('bm:'.length), it);
        }
    }

    function notify() {
        state.listeners.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
    }

    function onUpdate(fn) {
        if (typeof fn === 'function') state.listeners.add(fn);
        return () => state.listeners.delete(fn);
    }

    async function ensureLoaded(force) {
        if (state.loaded && !force) return state;
        if (state.loading && !force) return state.loading;
        const T = tauri();
        if (!T) { state.loaded = true; return state; }
        state.loading = T.invoke('custom_assets_list').then(res => {
            state.sources = Array.isArray(res && res.sources) ? res.sources : [];
            state.items = Array.isArray(res && res.items) ? res.items : [];
            state.loaded = true;
            state.loading = null;
            indexItems();
            return state;
        }).catch(() => {
            state.loaded = true;
            state.loading = null;
            return state;
        });
        return state.loading;
    }

    function refresh() {
        state.modelCache.clear();
        return ensureLoaded(true).then(s => { notify(); return s; });
    }

    function normalizeId(raw) {
        let k = String(raw || '').trim().toLowerCase();
        if (!k) return '';
        const at = k.lastIndexOf('@');
        if (at > 0 && /^\d+$/.test(k.slice(at + 1))) k = k.slice(0, at);
        return k;
    }

    function findItem(id) {
        const k = normalizeId(id);
        return k ? (state.byKey.get(k) || null) : null;
    }

    function isCustomId(id) {
        return CUSTOM_PREFIX_RE.test(String(id || '').trim());
    }

    async function getModel(id) {
        const it = findItem(id);
        const canonical = it ? it.id : String(id || '').trim();
        if (!canonical) return null;
        if (state.modelCache.has(canonical)) return state.modelCache.get(canonical);
        const T = tauri();
        if (!T) return null;
        try {
            const m = await T.invoke('custom_assets_get_model', { itemId: canonical });
            state.modelCache.set(canonical, m);
            return m;
        } catch (e) {
            state.modelCache.set(canonical, null);
            return null;
        }
    }

    function scheduleThumbnail(it) {
        if (!it || !it.hasModel || !GS.BbModel || !tauri()) return;
        if (state.pendingIcons.has(it.id)) return;
        state.pendingIcons.add(it.id);
        getModel(it.id).then(async (model) => {
            if (!model) return;
            const png = await GS.BbModel.renderThumbnail(model, 64);
            if (!png) return;
            it.iconDataUrl = png;
            try { await tauri().invoke('custom_assets_save_icon', { itemId: it.id, dataUrl: png }); } catch (e) { /* ignore */ }
            notify();
        }).catch(() => { /* ignore */ });
    }

    function iconUrl(id) {
        if (!state.loaded) ensureLoaded(false).then(s => { if (s.items.length) notify(); });
        const it = findItem(id);
        if (!it) return null;
        if (it.iconDataUrl) return it.iconDataUrl;
        if (it.hasModel) scheduleThumbnail(it);
        return null;
    }

    function list(filter) {
        const f = filter || {};
        const q = String(f.q || '').trim().toLowerCase();
        const prov = String(f.provider || '').toLowerCase();
        const kind = String(f.kind || '').toLowerCase();
        return state.items.filter(it => {
            if (kind && it.kind !== kind) return false;
            if (prov) {
                if (prov === 'meg' || prov === 'modelengine') {
                    if (it.provider !== 'modelengine' && it.provider !== 'bettermodel' && !/^(meg:|bm:)/i.test(it.id)) return false;
                } else if (prov === 'nexo') {
                    if (it.provider !== 'nexo' && it.provider !== 'oraxen') return false;
                } else if (it.provider !== prov) return false;
            }
            if (q && !it.id.toLowerCase().includes(q) && !String(it.name || '').toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function providerBadge(p) {
        if (p === 'itemsadder') return 'ItemsAdder';
        if (p === 'nexo') return 'Nexo';
        if (p === 'oraxen') return 'Oraxen';
        if (p === 'craftengine') return 'CraftEngine';
        if (p === 'bettermodel') return 'BetterModel';
        if (p === 'modelengine') return 'ModelEngine';
        return 'Resource Pack';
    }

    async function openManagerDialog(onChanged) {
        await ensureLoaded(false);
        const bodyHtml = () => {
            const rows = state.sources.length
                ? state.sources.map(s => `
                    <div class="ca-source" data-src="${esc(s.id)}">
                      <div class="ca-src-main">
                        <strong>${esc(s.label)}</strong>
                        <span class="ca-badge">${esc(providerBadge(s.provider))}</span>
                        <span class="ca-count">${s.itemCount} items</span>
                      </div>
                      <div class="ca-src-path">${esc(s.path)}</div>
                      <div class="ca-src-actions">
                        <button class="ghost-btn small" data-rescan="${esc(s.path)}" data-hint="${esc(s.provider)}">Rescan</button>
                        <button class="ghost-btn small danger" data-remove="${esc(s.id)}">Remove</button>
                      </div>
                    </div>`).join('')
                : '<div class="gs-hint">No plugin packs imported yet. Import your <code>plugins/ItemsAdder/contents</code>, <code>plugins/Nexo</code>, <code>plugins/CraftEngine/resources</code>, <code>plugins/ModelEngine/blueprints</code>, <code>plugins/BetterModel/models</code> folder, or a <code>.zip</code> / <code>.bbmodel</code> file. Everything stays cached on this computer across projects.</div>';
            return `<div class="ca-mgr">
                <div class="ca-actions">
                  <button class="primary-btn" data-import="folder">Import Plugin Folder…</button>
                  <button class="ghost-btn" data-import="file">Import .zip / .bbmodel…</button>
                  <button class="ghost-btn" data-import="meg">Import ModelEngine / BetterModel…</button>
                </div>
                <div class="ca-path-row">
                  <input type="text" class="ca-path-in" placeholder="Or paste a folder / .zip / .bbmodel path on disk…" spellcheck="false">
                  <button class="ghost-btn" data-scan-path>Scan Path</button>
                </div>
                <div class="gs-sec-head">Imported Sources (${state.sources.length} · ${state.items.length} custom items &amp; models)</div>
                <div class="ca-sources">${rows}</div>
              </div>`;
        };

        return GS.modal('Plugin Packs & 3D Models (ItemsAdder · Nexo · CraftEngine · ModelEngine · BetterModel)', bodyHtml(), [['ok', 'Done', 'primary']], {
            cls: 'xwide',
            onOpen: (root) => {
                const redrawList = () => {
                    const wrap = root.querySelector('.ca-mgr');
                    if (wrap) wrap.outerHTML = bodyHtml();
                    wire();
                };
                const runImport = async (folder, hint) => {
                    const T = tauri();
                    if (!T) { GS.toast && GS.toast('Desktop backend required for scanning disk packs', 'error'); return; }
                    try {
                        const res = await T.invoke('custom_assets_pick_and_import', { folder, sourceHint: hint || null });
                        if (!res) return;
                        await refresh();
                        GS.toast && GS.toast(`Imported ${res.count} items from ${res.label}`, 'ok');
                        if (typeof onChanged === 'function') onChanged();
                        redrawList();
                    } catch (err) {
                        GS.toast && GS.toast(err.message || String(err), 'error');
                    }
                };
                const runPath = async (p, hint) => {
                    const T = tauri();
                    if (!T || !p) return;
                    try {
                        const res = await T.invoke('custom_assets_scan_path', { path: p, sourceHint: hint || null });
                        await refresh();
                        GS.toast && GS.toast(`Imported ${res.count} items from ${res.label}`, 'ok');
                        if (typeof onChanged === 'function') onChanged();
                        redrawList();
                    } catch (err) {
                        GS.toast && GS.toast(err.message || String(err), 'error');
                    }
                };
                const wire = () => {
                    const fBtn = root.querySelector('[data-import="folder"]');
                    const zBtn = root.querySelector('[data-import="file"]');
                    const mBtn = root.querySelector('[data-import="meg"]');
                    const sBtn = root.querySelector('[data-scan-path]');
                    const pIn = root.querySelector('.ca-path-in');
                    if (fBtn) fBtn.onclick = () => runImport(true, null);
                    if (zBtn) zBtn.onclick = () => runImport(false, null);
                    if (mBtn) mBtn.onclick = () => runImport(true, 'modelengine');
                    if (sBtn) sBtn.onclick = () => runPath(pIn && pIn.value.trim(), null);
                    root.querySelectorAll('[data-rescan]').forEach(b => {
                        b.onclick = () => runPath(b.dataset.rescan, b.dataset.hint);
                    });
                    root.querySelectorAll('[data-remove]').forEach(b => {
                        b.onclick = async () => {
                            const T = tauri();
                            if (!T) return;
                            await T.invoke('custom_assets_remove_source', { sourceId: b.dataset.remove });
                            await refresh();
                            if (typeof onChanged === 'function') onChanged();
                            redrawList();
                        };
                    });
                };
                wire();
            }
        });
    }

    GS.CustomAssets = {
        ensureLoaded,
        refresh,
        findItem,
        getModel,
        iconUrl,
        list,
        isCustomId,
        openManagerDialog,
        onUpdate,
        sources: () => state.sources.slice(),
        count: () => state.items.length,
    };
})();
