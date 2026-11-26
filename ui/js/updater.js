/* ==========================================================
   KaizerHUD Studio — In-app software updater
   Background check -> Manual "Download Update" -> Manual "Restart to Update"
   ========================================================== */
(function () {
    'use strict';

    const RELEASES_URL = 'https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const state = {
        currentVersion: '',
        status: 'idle', // idle | checking | up-to-date | available | downloading | ready | error
        available: null,
        percent: 0,
        error: ''
    };

    let pillEl = null;
    let modalBack = null;

    function tauriCore() {
        if (window.__TAURI__ && window.__TAURI__.core) return window.__TAURI__.core;
        try {
            if (window.parent && window.parent !== window && window.parent.__TAURI__ && window.parent.__TAURI__.core) {
                return window.parent.__TAURI__.core;
            }
        } catch { /* ignore */ }
        return null;
    }

    function tauriEvent() {
        if (window.__TAURI__ && window.__TAURI__.event) return window.__TAURI__.event;
        try {
            if (window.parent && window.parent !== window && window.parent.__TAURI__ && window.parent.__TAURI__.event) {
                return window.parent.__TAURI__.event;
            }
        } catch { /* ignore */ }
        return null;
    }

    function invoke(cmd, args) {
        const core = tauriCore();
        if (!core) return Promise.reject(new Error('Desktop backend not available'));
        return core.invoke(cmd, args || {});
    }

    let escHandler = null;

    function pillIcon(kind) {
        if (kind === 'ready') {
            return '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
        }
        if (kind === 'downloading') {
            return '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
        }
        return '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>';
    }

    function ensurePill() {
        if (pillEl) return pillEl;
        const tb = document.getElementById('titlebar');
        if (!tb) return null;
        pillEl = document.createElement('button');
        pillEl.type = 'button';
        pillEl.id = 'kz-update-pill';
        pillEl.className = 'tb-update-pill';
        pillEl.hidden = true;
        pillEl.style.display = 'none';
        pillEl.addEventListener('mousedown', (e) => e.stopPropagation());
        pillEl.addEventListener('click', () => openModal());
        const wc = document.getElementById('window-controls');
        if (wc && wc.parentNode === tb) tb.insertBefore(pillEl, wc);
        else tb.appendChild(pillEl);
        return pillEl;
    }

    function renderPill() {
        const show = (state.status === 'available' && state.available)
            || state.status === 'downloading'
            || (state.status === 'ready' && state.available);

        if (!show) {
            if (pillEl) {
                pillEl.classList.remove('available', 'downloading', 'ready');
                pillEl.hidden = true;
                pillEl.style.display = 'none';
                pillEl.innerHTML = '';
            }
            return;
        }

        const el = ensurePill();
        if (!el) return;
        el.classList.remove('available', 'downloading', 'ready');
        el.hidden = false;
        el.style.display = '';

        if (state.status === 'available' && state.available) {
            el.classList.add('available');
            el.innerHTML = `${pillIcon('available')}<span>Update v${esc(state.available.version)}</span>`;
            el.title = `KaizerHUD Studio v${state.available.version} is available`;
        } else if (state.status === 'downloading') {
            const pct = Math.max(0, Math.min(100, Math.round(state.percent || 0)));
            el.classList.add('downloading');
            el.innerHTML = `${pillIcon('downloading')}<span>${pct > 0 ? `Downloading ${pct}%` : 'Downloading...'}</span>`;
            el.title = 'Downloading update in background';
        } else if (state.status === 'ready' && state.available) {
            el.classList.add('ready');
            el.innerHTML = `${pillIcon('ready')}<span>Restart to Update</span>`;
            el.title = `v${state.available.version} downloaded — click to restart and apply`;
        }
    }

    function closeModal() {
        if (escHandler) {
            document.removeEventListener('keydown', escHandler, true);
            escHandler = null;
        }
        if (modalBack) {
            modalBack.remove();
            modalBack = null;
        }
    }

    function renderModalContent() {
        if (!modalBack) return;
        const body = modalBack.querySelector('.kz-upd-body');
        const foot = modalBack.querySelector('.kz-upd-foot');
        if (!body || !foot) return;

        const verNow = state.currentVersion ? `v${state.currentVersion}` : 'Dev / Unknown';

        if (state.status === 'checking') {
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-label">Current version</span>
                    <span class="kz-upd-badge">${esc(verNow)}</span>
                </div>
                <div class="kz-upd-card info">
                    <span class="kz-upd-spinner" aria-hidden="true"></span>
                    <div>
                        <b>Checking for updates…</b>
                        <p class="kz-upd-msg">Contacting GitHub Releases for the latest version.</p>
                    </div>
                </div>`;
            foot.innerHTML = `<button type="button" class="ghost-btn" data-upd-close>Close</button>`;
        } else if (state.status === 'up-to-date') {
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-label">Current version</span>
                    <span class="kz-upd-badge">${esc(verNow)}</span>
                </div>
                <div class="kz-upd-card ok">
                    <div>
                        <b>You're up to date</b>
                        <p class="kz-upd-msg">You are running the latest version of KaizerHUD Studio.</p>
                    </div>
                </div>`;
            foot.innerHTML = `<button type="button" class="primary-btn" data-upd-close>OK</button>`;
        } else if (state.status === 'available' && state.available) {
            const notes = (state.available.body || '').trim();
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-badge">${esc(verNow)}</span>
                    <span class="kz-upd-arrow">→</span>
                    <span class="kz-upd-badge new">v${esc(state.available.version)}</span>
                </div>
                ${notes
                    ? `<div class="kz-upd-notes">${esc(notes)}</div>`
                    : `<div class="kz-upd-card info"><div><b>Update v${esc(state.available.version)} ready</b><p class="kz-upd-msg">A new release is available to download from GitHub.</p></div></div>`}`;
            foot.innerHTML = `
                <button type="button" class="ghost-btn" data-upd-close>Later</button>
                <button type="button" class="primary-btn" data-upd-download>Download Update</button>`;
        } else if (state.status === 'downloading') {
            const pct = Math.max(0, Math.min(100, Math.round(state.percent || 0)));
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-label">Downloading update</span>
                    <span class="kz-upd-badge new">v${esc(state.available ? state.available.version : '')} · ${pct}%</span>
                </div>
                <div class="kz-upd-bar"><div class="kz-upd-bar-fill" style="width:${pct}%"></div></div>
                <p class="kz-upd-msg muted">You can hide this window and keep editing while the download finishes.</p>`;
            foot.innerHTML = `<button type="button" class="ghost-btn" data-upd-close>Hide</button>`;
        } else if (state.status === 'ready' && state.available) {
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-badge">${esc(verNow)}</span>
                    <span class="kz-upd-arrow">→</span>
                    <span class="kz-upd-badge new">v${esc(state.available.version)}</span>
                </div>
                <div class="kz-upd-card ok">
                    <div>
                        <b>Ready to install</b>
                        <p class="kz-upd-msg">Save any open changes before restarting. Clicking below applies the update and reopens KaizerHUD Studio.</p>
                    </div>
                </div>`;
            foot.innerHTML = `
                <button type="button" class="ghost-btn" data-upd-close>Later</button>
                <button type="button" class="primary-btn kz-upd-restart-btn" data-upd-restart>Restart &amp; Apply Update</button>`;
        } else {
            body.innerHTML = `
                <div class="kz-upd-ver-row">
                    <span class="kz-upd-label">Current version</span>
                    <span class="kz-upd-badge">${esc(verNow)}</span>
                </div>
                <div class="kz-upd-card error">
                    <div>
                        <b>Update check failed</b>
                        <p class="kz-upd-msg error">${esc(state.error || 'Could not check for updates.')}</p>
                    </div>
                </div>
                <p class="kz-upd-msg muted">If you are running the portable executable or offline, you can download the latest release directly from GitHub.</p>`;
            foot.innerHTML = `
                <button type="button" class="ghost-btn" data-upd-open-gh>Open Releases</button>
                <button type="button" class="primary-btn" data-upd-close>Close</button>`;
        }

        const cBtn = foot.querySelector('[data-upd-close]');
        if (cBtn) cBtn.addEventListener('click', closeModal);

        const dBtn = foot.querySelector('[data-upd-download]');
        if (dBtn) dBtn.addEventListener('click', startDownload);

        const rBtn = foot.querySelector('[data-upd-restart]');
        if (rBtn) rBtn.addEventListener('click', startInstall);

        const ghBtn = foot.querySelector('[data-upd-open-gh]');
        if (ghBtn) ghBtn.addEventListener('click', () => {
            const url = (state.available && state.available.releaseUrl) || RELEASES_URL;
            invoke('open_external', { url }).catch(() => { });
        });
    }

    function openModal() {
        if (!modalBack) {
            modalBack = document.createElement('div');
            modalBack.className = 'kz-upd-back';
            modalBack.innerHTML = `
                <div class="kz-upd-dialog" role="dialog" aria-modal="true" aria-label="Software Update">
                    <div class="kz-upd-head">
                        <span class="kz-upd-head-title">${pillIcon('available')}<span>Software Update</span></span>
                        <button type="button" class="icon-btn small" data-upd-x title="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
                    </div>
                    <div class="kz-upd-body"></div>
                    <div class="kz-upd-foot"></div>
                </div>`;
            modalBack.querySelector('[data-upd-x]').addEventListener('click', closeModal);
            modalBack.addEventListener('mousedown', (e) => {
                if (e.target === modalBack) closeModal();
            });
            escHandler = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeModal();
                }
            };
            document.addEventListener('keydown', escHandler, true);
            document.body.appendChild(modalBack);
        }
        renderModalContent();
    }

    async function checkUpdates(silent) {
        if (!tauriCore()) {
            if (!silent) {
                state.status = 'error';
                state.error = 'In-app updates only run inside the packaged desktop application.';
                openModal();
            }
            return;
        }
        if (state.status === 'downloading' || state.status === 'ready') {
            if (!silent) openModal();
            return;
        }
        if (!silent) {
            state.status = 'checking';
            state.error = '';
            openModal();
        }
        try {
            const res = await invoke('check_app_update');
            if (res && res.currentVersion) state.currentVersion = res.currentVersion;
            if (res && res.available) {
                state.available = res;
                state.status = res.downloaded ? 'ready' : 'available';
            } else {
                state.available = null;
                state.status = 'up-to-date';
            }
            renderPill();
            if (modalBack) renderModalContent();
        } catch (err) {
            if (silent) {
                state.status = 'idle';
                return;
            }
            state.status = 'error';
            state.error = (err && err.message) ? err.message : String(err);
            renderPill();
            if (modalBack) renderModalContent();
        }
    }

    async function startDownload() {
        if (state.status === 'downloading') return;
        state.status = 'downloading';
        state.percent = 0;
        renderPill();
        renderModalContent();
        try {
            await invoke('download_app_update');
            state.percent = 100;
            state.status = 'ready';
            renderPill();
            if (modalBack) renderModalContent();
        } catch (err) {
            state.status = 'error';
            state.error = (err && err.message) ? err.message : String(err);
            renderPill();
            if (modalBack) renderModalContent();
        }
    }

    async function startInstall() {
        const btn = modalBack && modalBack.querySelector('[data-upd-restart]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Applying Update...';
        }
        try {
            await invoke('install_app_update');
        } catch (err) {
            state.status = 'error';
            state.error = (err && err.message) ? err.message : String(err);
            renderPill();
            if (modalBack) renderModalContent();
            else openModal();
        }
    }

    function wireEvents() {
        const ev = tauriEvent();
        if (!ev || typeof ev.listen !== 'function') return;
        ev.listen('kz-update-progress', (e) => {
            const p = e && e.payload ? e.payload : {};
            if (state.status !== 'downloading') state.status = 'downloading';
            if (typeof p.percent === 'number') state.percent = p.percent;
            renderPill();
            if (modalBack) renderModalContent();
        }).catch(() => { });

        ev.listen('kz-update-ready', () => {
            state.percent = 100;
            state.status = 'ready';
            renderPill();
            if (modalBack) renderModalContent();
        }).catch(() => { });
    }

    function init() {
        if (!tauriCore()) return;
        wireEvents();
        invoke('get_app_version').then((v) => {
            if (v) state.currentVersion = String(v);
        }).catch(() => { });
        // Silent background check 3.5s after launch so startup stays instant
        setTimeout(() => { checkUpdates(true); }, 3500);
    }

    window.KZUpdater = {
        checkManual: () => checkUpdates(false),
        openModal,
        getVersion: () => state.currentVersion
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
