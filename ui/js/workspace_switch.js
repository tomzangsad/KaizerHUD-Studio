/* ========================================
   HUD ⇄ GUI workspace switch for the HUD editor (index.html).
   GUI Studio lives in gui.html with its own code and projects; this file only
   adds the switch to the title bar and the "Switch to GUI Studio" menu item.
   ======================================== */
(function () {
    'use strict';

    function css() {
        if (document.getElementById('ws-switch-style')) return;
        const st = document.createElement('style');
        st.id = 'ws-switch-style';
        st.textContent =
            '.ws-switch{display:flex;margin-left:12px;padding:2px;gap:2px;background:var(--s-0,#141414);border:1px solid var(--line-soft,#3a3a3a);border-radius:5px;height:22px;align-self:center}' +
            '.ws-switch button{border:none;background:transparent;color:var(--ink-dim,#a3a3a3);font-size:11px;font-weight:600;padding:0 10px;border-radius:3px;cursor:pointer;letter-spacing:.3px}' +
            '.ws-switch button:hover{color:#fff;background:var(--s-5,#3b3b3b)}' +
            '.ws-switch button.active{background:var(--blue,#3a8ee6);color:#fff}';
        document.head.appendChild(st);
    }

    async function goGui() {
        const dirty = document.body.classList.contains('is-dirty');
        if (dirty) {
            const ask = window.kzConfirm || (m => Promise.resolve(window.confirm(m)));
            if (!(await ask('You have unsaved HUD changes.\n\nSwitch to GUI Studio anyway? (Save first with Ctrl+S to keep them.)'))) return;
        }
        window.location.href = 'gui.html';
    }

    function init() {
        const left = document.querySelector('#titlebar .tb-left');
        if (!left || document.getElementById('ws-switch')) return;
        css();
        const sw = document.createElement('div');
        sw.className = 'ws-switch';
        sw.id = 'ws-switch';
        sw.title = 'Workspace';
        sw.innerHTML = '<button data-ws="hud" class="active" title="HUD editor">HUD</button><button data-ws="gui" title="GUI Studio — cursor menus for Java + Bedrock">GUI</button>';
        sw.addEventListener('mousedown', e => e.stopPropagation());
        sw.addEventListener('click', e => {
            const b = e.target.closest('[data-ws]');
            if (b && b.dataset.ws === 'gui') goGui();
        });
        left.appendChild(sw);

        // File menu: "Switch to GUI Studio"
        const exitBtn = document.querySelector('.menu[data-menu="file"] [data-cmd="exit"]');
        if (exitBtn && !document.querySelector('[data-ws-item]')) {
            const item = document.createElement('button');
            item.setAttribute('data-ws-item', '');
            item.innerHTML = '<span>Switch to GUI Studio</span><kbd></kbd>';
            item.addEventListener('click', () => {
                document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
                goGui();
            });
            exitBtn.parentNode.insertBefore(item, exitBtn);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
