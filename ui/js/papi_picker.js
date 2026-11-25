/* ========================================
   Placeholder picker

   Adds a { } button next to every PAPI field in the Properties panel and
   opens a searchable, offline list of placeholders (window.PAPI_CATALOG).
   Text fields insert at the cursor; bar / condition fields replace the value.
   Picking a bar value also fills an empty Max with a matching placeholder.
   ======================================== */
(function () {
    'use strict';

    // field id → how a picked placeholder is applied
    const FIELDS = {
        'prop-papi-placeholder': { mode: 'insert', label: 'Text' },
        'prop-bar-custom-papi': { mode: 'replace', label: 'Bar value', maxField: 'prop-bar-custom-max' },
        'prop-bar-custom-max': { mode: 'replace', label: 'Bar max' },
        'prop-visibility-papi': { mode: 'replace', label: 'Condition' },
    };
    const PARAM_RE = /<[^>]+>|\[[^\]]+\]|\([^)]+\)|\{[^}]+\}/;
    const LS_GROUP = 'kz_papi_group';

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

    /* ───────────── buttons next to the fields ───────────── */

    function decorate(root) {
        for (const id of Object.keys(FIELDS)) {
            const input = root.querySelector ? root.querySelector(`#${id}`) : null;
            if (!input || input.dataset.papiPicker) continue;
            input.dataset.papiPicker = '1';
            const wrap = document.createElement('div');
            wrap.className = 'papi-field';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'papi-btn';
            btn.title = 'Choose a placeholder (PAPI list)';
            btn.textContent = '{ }';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                open(id);
            });
            wrap.appendChild(btn);
        }
    }

    const observer = new MutationObserver((muts) => {
        for (const m of muts) {
            for (const n of m.addedNodes) if (n.nodeType === 1) decorate(n);
        }
    });
    document.addEventListener('DOMContentLoaded', () => {
        decorate(document);
        observer.observe(document.body, { childList: true, subtree: true });
    });

    /* ───────────── applying a choice ───────────── */

    function setField(id, value, selectParam) {
        const input = document.getElementById(id);
        if (!input) return;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // the panel may re-render: look the field up again before selecting
        setTimeout(() => {
            const el = document.getElementById(id) || input;
            el.focus();
            if (selectParam) {
                const m = PARAM_RE.exec(el.value.slice(selectParam.from));
                if (m) {
                    const s = selectParam.from + m.index;
                    el.setSelectionRange(s, s + m[0].length);
                    return;
                }
            }
            const end = selectParam ? selectParam.from + selectParam.len : el.value.length;
            el.setSelectionRange(end, end);
        }, 0);
    }

    function apply(fieldId, item) {
        const cfg = FIELDS[fieldId];
        const input = document.getElementById(fieldId);
        if (!cfg || !input) return;
        const p = item.p;
        if (cfg.mode === 'insert') {
            const a = input.selectionStart != null ? input.selectionStart : input.value.length;
            const b = input.selectionEnd != null ? input.selectionEnd : a;
            setField(fieldId, input.value.slice(0, a) + p + input.value.slice(b), { from: a, len: p.length });
        } else {
            setField(fieldId, p, { from: 0, len: p.length });
        }
        if (cfg.maxField && item.max) {
            const max = document.getElementById(cfg.maxField);
            if (max && !max.value.trim()) {
                max.value = item.max;
                max.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    /* ───────────── window ───────────── */

    let back = null;

    function close() {
        if (back) back.remove();
        back = null;
    }

    function open(fieldId) {
        close();
        const cat = window.PAPI_CATALOG || [];
        const cfg = FIELDS[fieldId] || {};
        let group = Math.min(+(lsGet(LS_GROUP) || 0), Math.max(0, cat.length - 1));

        back = document.createElement('div');
        back.className = 'kz-modal';
        back.innerHTML = `
            <div class="kz-window papi-win">
                <div class="kz-window-head"><span>Placeholders — ${esc(cfg.label || '')}</span>
                    <button class="icon-btn small" data-close title="Close"><svg><use href="#i-close"/></svg></button></div>
                <div class="kz-window-body">
                    <input type="text" class="papi-search" placeholder="Search: health, mana, money, level…" spellcheck="false" />
                    <div class="papi-main">
                        <div class="papi-groups">${cat.map((g, i) => `<button data-g="${i}">${esc(g.name)}<span>${g.items.length}</span></button>`).join('')}</div>
                        <div class="papi-side">
                            <div class="papi-info"></div>
                            <div class="papi-list"></div>
                        </div>
                    </div>
                    <div class="kz-note">Click a placeholder to use it. Parts in &lt; &gt; [ ] ( ) { } must be replaced (they get selected so you can type over them). The server needs PlaceholderAPI and the expansion / plugin shown above the list.</div>
                </div>
            </div>`;
        document.body.appendChild(back);
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
        back.querySelector('[data-close]').addEventListener('click', close);
        back.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
        });

        const search = back.querySelector('.papi-search');
        const list = back.querySelector('.papi-list');
        const info = back.querySelector('.papi-info');
        const groupsEl = back.querySelector('.papi-groups');
        let shown = [];

        function row(item, g) {
            return `<button class="papi-row" data-i="${shown.length - 1}">
                <code>${esc(item.p)}</code>
                <span>${esc(item.d)}${g ? ` <em>· ${esc(g.name)}</em>` : ''}${item.max ? ` <em>· max ${esc(item.max)}</em>` : ''}</span>
            </button>`;
        }

        function render() {
            const q = search.value.trim().toLowerCase();
            shown = [];
            let html = '';
            if (q) {
                const words = q.split(/\s+/);
                cat.forEach((g) => g.items.forEach((it) => {
                    const hay = `${it.p} ${it.d} ${g.name}`.toLowerCase();
                    if (words.every((w) => hay.includes(w)) && !shown.some((s) => s.p === it.p)) {
                        shown.push(it);
                        html += row(it, g);
                    }
                }));
                info.innerHTML = `<div class="papi-install">${shown.length} result${shown.length === 1 ? '' : 's'} for “${esc(q)}”</div>`;
                groupsEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
            } else {
                const g = cat[group];
                if (!g) return;
                g.items.forEach((it) => { shown.push(it); html += row(it, null); });
                const vals = Object.entries(g.values || {}).map(([k, v]) =>
                    `<div class="papi-values"><b>${esc(k)}</b> ${v.map((x) => `<code>${esc(x)}</code>`).join(' ')}</div>`).join('');
                info.innerHTML = `
                    <div class="papi-install"><span>${esc(g.install)}</span>
                        ${/\/papi /.test(g.install) ? '<button class="ghost-btn papi-copy" title="Copy the install command">Copy</button>' : ''}</div>${vals}`;
                const copy = info.querySelector('.papi-copy');
                if (copy) {
                    copy.addEventListener('click', () => {
                        const cmd = (g.install.match(/\/papi ecloud download \S+/) || [''])[0];
                        try { navigator.clipboard.writeText(cmd); copy.textContent = 'Copied'; } catch (e) { /* ignore */ }
                    });
                }
                groupsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.g === group));
            }
            list.innerHTML = html || '<div class="kz-note" style="padding:12px">Nothing found. You can still type any placeholder by hand.</div>';
            list.scrollTop = 0;
        }

        groupsEl.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-g]');
            if (!b) return;
            group = +b.dataset.g;
            lsSet(LS_GROUP, String(group));
            search.value = '';
            render();
        });
        list.addEventListener('click', (e) => {
            const b = e.target.closest('.papi-row');
            if (!b) return;
            const it = shown[+b.dataset.i];
            close();
            apply(fieldId, it);
        });
        search.addEventListener('input', render);
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && shown[0]) {
                e.preventDefault();
                const it = shown[0];
                close();
                apply(fieldId, it);
            }
        });
        render();
        search.focus();
    }

    window.PapiPicker = { open };
})();
