/* ========================================
   Desktop app glue (shared by index.html and wiki.html)
   ======================================== */
(function () {
    function tauri() {
        if (window.__TAURI__) return window.__TAURI__;
        try { return window.parent && window.parent !== window ? window.parent.__TAURI__ : null; } catch (e) { return null; }
    }
    function invoke(cmd, args) {
        const T = tauri();
        if (!T || !T.core) return Promise.reject(new Error('no backend'));
        return T.core.invoke(cmd, args || {});
    }

    // Wiki shown inside the editor: its "back" button closes the overlay
    if (window.parent && window.parent !== window) {
        document.addEventListener('click', function (e) {
            const back = e.target.closest && e.target.closest('.back-btn');
            if (back) {
                e.preventDefault();
                window.parent.postMessage('kz-close-help', '*');
            }
        }, true);
    }

    // Open http(s) links in the user's default browser instead of the app window
    document.addEventListener('click', function (e) {
        const link = e.target.closest && e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) {
            e.preventDefault();
            invoke('open_external', { url: href }).catch(function (err) {
                console.error('Could not open link', err);
            });
        }
    }, true);

    // ── In-page dialogs ─────────────────────────────────────────
    // window.alert/confirm/prompt do nothing inside the desktop webview,
    // so they are replaced by small modals that match the app style.
    function injectDialogStyles() {
        if (document.getElementById('kz-dialog-style')) return;
        const st = document.createElement('style');
        st.id = 'kz-dialog-style';
        st.textContent =
            '.kz-dlg-back{position:fixed;inset:0;z-index:100000;background:rgba(10,14,26,.7);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}' +
            '.kz-dlg{background:#1e293b;color:#f1f5f9;border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:20px;min-width:320px;max-width:560px;box-shadow:0 20px 50px rgba(0,0,0,.5);font-family:inherit}' +
            '.kz-dlg-msg{white-space:pre-wrap;font-size:.9rem;line-height:1.5;max-height:60vh;overflow:auto;margin-bottom:16px}' +
            '.kz-dlg input{width:100%;box-sizing:border-box;margin-bottom:16px;padding:8px 10px;border-radius:6px;border:1px solid rgba(148,163,184,.3);background:#0f172a;color:#f1f5f9}' +
            '.kz-dlg-btns{display:flex;gap:8px;justify-content:flex-end}' +
            '.kz-dlg-btns button{padding:8px 18px;border-radius:8px;border:none;font-weight:600;cursor:pointer}' +
            '.kz-dlg-ok{background:#7c3aed;color:#fff}.kz-dlg-cancel{background:#334155;color:#e2e8f0}';
        document.head.appendChild(st);
    }

    function showDialog(kind, message, defaultValue) {
        injectDialogStyles();
        return new Promise(function (resolve) {
            const back = document.createElement('div');
            back.className = 'kz-dlg-back';
            const box = document.createElement('div');
            box.className = 'kz-dlg';
            const msg = document.createElement('div');
            msg.className = 'kz-dlg-msg';
            msg.textContent = message == null ? '' : String(message);
            box.appendChild(msg);
            let input = null;
            if (kind === 'prompt') {
                input = document.createElement('input');
                input.type = 'text';
                input.value = defaultValue == null ? '' : String(defaultValue);
                box.appendChild(input);
            }
            const btns = document.createElement('div');
            btns.className = 'kz-dlg-btns';
            const ok = document.createElement('button');
            ok.className = 'kz-dlg-ok';
            ok.textContent = 'OK';
            let cancel = null;
            if (kind !== 'alert') {
                cancel = document.createElement('button');
                cancel.className = 'kz-dlg-cancel';
                cancel.textContent = 'Cancel';
                btns.appendChild(cancel);
            }
            btns.appendChild(ok);
            box.appendChild(btns);
            back.appendChild(box);
            document.body.appendChild(back);

            function close(result) {
                document.removeEventListener('keydown', onKey, true);
                back.remove();
                resolve(result);
            }
            function accept() {
                close(kind === 'prompt' ? input.value : true);
            }
            function reject() {
                close(kind === 'prompt' ? null : false);
            }
            function onKey(e) {
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); accept(); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); kind === 'alert' ? accept() : reject(); }
            }
            ok.addEventListener('click', accept);
            if (cancel) cancel.addEventListener('click', reject);
            document.addEventListener('keydown', onKey, true);
            (input || ok).focus();
        });
    }

    window.alert = function (message) { showDialog('alert', message); };
    window.kzConfirm = function (message) { return showDialog('confirm', message); };
    window.kzPrompt = function (message, defaultValue) { return showDialog('prompt', message, defaultValue); };

    // Tutorial GIFs are not shipped inside the program: hide any that fail to load
    document.addEventListener('error', function (e) {
        const img = e.target;
        if (!img || img.tagName !== 'IMG') return;
        const src = img.getAttribute('src') || '';
        if (src.indexOf('img/gift/') === -1) return;
        const box = img.parentElement;
        if (box) box.style.display = 'none';
    }, true);
})();
