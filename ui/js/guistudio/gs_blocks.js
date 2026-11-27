/* ========================================
   GUI Studio — Smart Blocks / 1-Click Card Generator
   Creates complete Shop Cards, Feature Cards, Qty Steppers, and Nav Bars
   with one click (supports both Built-in Vault Economy and External Commands).
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const M = GS.Model;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function makePanelDataUrl(w, h, bgHex, borderHex, accentHex) {
        const c = document.createElement('canvas');
        c.width = Math.max(8, w); c.height = Math.max(8, h);
        const g = c.getContext('2d');
        g.fillStyle = bgHex || '#161b26';
        g.fillRect(0, 0, c.width, c.height);
        g.strokeStyle = borderHex || '#3a4660';
        g.lineWidth = 1;
        g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
        if (accentHex) {
            g.fillStyle = accentHex;
            g.fillRect(Math.round(c.width * 0.25), 0, Math.round(c.width * 0.5), 2);
        }
        return { name: `block_${w}x${h}_${Date.now()}.png`, data: c.toDataURL('image/png'), w: c.width, h: c.height };
    }

    function ensureConfirmPage(editor) {
        const p = editor.project;
        if (p.menus.some(m => m.id === 'confirm')) return;
        const cur = editor.menu();
        const cm = M.newMenu('confirm', 'Confirm Trade');
        cm.width = cur.width; cm.height = cur.height; cm.fullscreen = !!cur.fullscreen;
        const mw = 280, mh = 180;
        const mx = Math.round((cm.width - mw) / 2), my = Math.round((cm.height - mh) / 2);
        const bgId = M.addImage(p, makePanelDataUrl(mw, mh, '#141923', '#e5a43a', '#e5a43a'));
        const btnOkId = M.addImage(p, makePanelDataUrl(104, 22, '#1f6f3d', '#3fb950'));
        const btnNoId = M.addImage(p, makePanelDataUrl(104, 22, '#6b2226', '#e5534b'));
        const btnStepId = M.addImage(p, makePanelDataUrl(28, 18, '#262d3d', '#4e5d7a'));

        cm.elements.push(
            Object.assign(M.newElement('image', cm), { name: 'Modal Bg', x: mx, y: my, w: mw, h: mh, image: bgId, detail: 2 }),
            Object.assign(M.newElement('text', cm), { name: 'Modal Title', x: mx + 12, y: my + 10, w: mw - 24, h: 14, text: 'CONFIRM {mode}', color: '#f5d57a', scale: 1.1 }),
            Object.assign(M.newElement('item', cm), { name: 'Preview Item', x: mx + mw / 2 - 14, y: my + 32, w: 28, h: 28, item: '{item_id}' }),
            Object.assign(M.newElement('text', cm), { name: 'Item Title', x: mx + 12, y: my + 66, w: mw - 24, h: 12, text: '{item_name}', color: '#ffffff', scale: 0.95 }),
            Object.assign(M.newElement('text', cm), { name: 'Total Text', x: mx + 12, y: my + 82, w: mw - 24, h: 12, text: 'Unit: ${price}  •  Total: ${qty*price}', color: '#84e8b0', scale: 0.85 }),
            Object.assign(M.newElement('button', cm), { name: 'Qty -16', label: '-16', x: mx + 34, y: my + 102, w: 28, h: 18, image: btnStepId, labelScale: 0.8, actions: ['add:qty=-16', 'sound:minecraft:ui.button.click'] }),
            Object.assign(M.newElement('button', cm), { name: 'Qty -1', label: '-1', x: mx + 66, y: my + 102, w: 28, h: 18, image: btnStepId, labelScale: 0.8, actions: ['add:qty=-1', 'sound:minecraft:ui.button.click'] }),
            Object.assign(M.newElement('input', cm), { name: 'Qty Box', varName: 'qty', defaultValue: '1', prefix: 'x', x: mx + 98, y: my + 102, w: 84, h: 18, scale: 0.85 }),
            Object.assign(M.newElement('button', cm), { name: 'Qty +1', label: '+1', x: mx + 186, y: my + 102, w: 28, h: 18, image: btnStepId, labelScale: 0.8, actions: ['add:qty=1', 'sound:minecraft:ui.button.click'] }),
            Object.assign(M.newElement('button', cm), { name: 'Qty +16', label: '+16', x: mx + 218, y: my + 102, w: 28, h: 18, image: btnStepId, labelScale: 0.8, actions: ['add:qty=16', 'sound:minecraft:ui.button.click'] }),
            Object.assign(M.newElement('button', cm), { name: 'Confirm Trade', label: 'CONFIRM {mode}', x: mx + 28, y: my + 140, w: 104, h: 22, image: btnOkId, labelScale: 0.9, actions: ['trade:{mode}:{item_id}:{qty}:{qty*price}', 'sound:minecraft:entity.player.levelup', 'back'] }),
            Object.assign(M.newElement('button', cm), { name: 'Cancel', label: 'CANCEL', x: mx + mw - 132, y: my + 140, w: 104, h: 22, image: btnNoId, labelScale: 0.9, actions: ['back', 'sound:minecraft:ui.button.click'] })
        );
        p.menus.push(cm);
    }

    async function open(editor) {
        const m = editor.menu();
        const menuOpts = editor.project.menus.map(x => `<option value="${esc(x.id)}">${esc(x.title || x.id)} (${esc(x.id)})</option>`).join('');
        const body = `
            <div class="gs-blocks-tabs">
              <button type="button" class="gs-blk-tab active" data-tab="shop">Shop Item Card</button>
              <button type="button" class="gs-blk-tab" data-tab="feature">Menu Feature Card</button>
              <button type="button" class="gs-blk-tab" data-tab="qty">Qty Stepper (-1/+1)</button>
              <button type="button" class="gs-blk-tab" data-tab="nav">Navigation Bar</button>
            </div>
            <div class="gs-blk-pane active" data-pane="shop">
              <div class="gs-ab-rowitem">
                <label class="gs-field"><span>Item ID</span><input type="text" id="blk-s-item" value="minecraft:diamond_sword" /></label>
                <button type="button" class="ghost-btn small" id="blk-s-pick">Choose Item…</button>
              </div>
              <label class="gs-field"><span>Display Name</span><input type="text" id="blk-s-name" value="Diamond Sword" /></label>
              <div class="gs-grid2">
                <label class="gs-field"><span>Buy Price ($)</span><input type="number" id="blk-s-buy" value="500" min="0" /></label>
                <label class="gs-field"><span>Sell Price ($ · 0 = hide)</span><input type="number" id="blk-s-sell" value="200" min="0" /></label>
              </div>
              <label class="gs-field"><span>Action Integration</span>
                <select id="blk-s-mode">
                  <option value="vault">Built-in Vault Economy + Shared Confirm (Ready to use)</option>
                  <option value="vault_direct">Built-in Vault Direct Buy/Sell (1-click, no confirm)</option>
                  <option value="external">External Plugin Command (Custom)</option>
                </select>
              </label>
              <div id="blk-s-ext" style="display:none">
                <div class="gs-grid2">
                  <label class="gs-field"><span>Buy Command (player:)</span><input type="text" id="blk-s-bcmd" value="shop buy diamond_sword" /></label>
                  <label class="gs-field"><span>Sell Command (player:)</span><input type="text" id="blk-s-scmd" value="shop sell diamond_sword" /></label>
                </div>
              </div>
            </div>
            <div class="gs-blk-pane" data-pane="feature">
              <div class="gs-ab-rowitem">
                <label class="gs-field"><span>Card Icon Item</span><input type="text" id="blk-f-item" value="minecraft:ender_pearl" /></label>
                <button type="button" class="ghost-btn small" id="blk-f-pick">Choose Item…</button>
              </div>
              <div class="gs-grid2">
                <label class="gs-field"><span>Title</span><input type="text" id="blk-f-title" value="WARPS" /></label>
                <label class="gs-field"><span>Subtitle</span><input type="text" id="blk-f-sub" value="Spawn &amp; Arena" /></label>
              </div>
              <label class="gs-field"><span>Button Opens Menu</span><select id="blk-f-target">${menuOpts}</select></label>
            </div>
            <div class="gs-blk-pane" data-pane="qty">
              <div class="gs-grid2">
                <label class="gs-field"><span>Variable Name</span><input type="text" id="blk-q-var" value="qty" /></label>
                <label class="gs-field"><span>Default Value</span><input type="number" id="blk-q-def" value="1" min="1" /></label>
              </div>
              <p class="gs-hint">Inserts a complete <code>-16 · -1 · Input Box · +1 · +16</code> row synced to <code>{qty}</code>.</p>
            </div>
            <div class="gs-blk-pane" data-pane="nav">
              <p class="gs-hint">Inserts a bottom navigation row with <code>← BACK</code>, <code>&lt; PREV</code>, <code>NEXT &gt;</code>, and <code>X</code> Close buttons.</p>
            </div>`;

        let activeTab = 'shop';
        const res = await GS.modal('Insert Smart Block (1-Click Component)', body, [['cancel', 'Cancel'], ['insert', 'Insert into Menu', 'primary']], {
            onOpen(root) {
                root.querySelectorAll('.gs-blk-tab').forEach(btn => btn.addEventListener('click', () => {
                    activeTab = btn.dataset.tab;
                    root.querySelectorAll('.gs-blk-tab').forEach(x => x.classList.toggle('active', x === btn));
                    root.querySelectorAll('.gs-blk-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === activeTab));
                }));
                root.querySelector('#blk-s-mode').addEventListener('change', (ev) => {
                    root.querySelector('#blk-s-ext').style.display = ev.target.value === 'external' ? 'block' : 'none';
                });
                const wirePick = (btnId, inpId) => {
                    root.querySelector(btnId).addEventListener('click', () => {
                        if (!GS.Items) return;
                        const inp = root.querySelector(inpId);
                        GS.Items.pick(inp.value).then(id => { if (id) inp.value = id; });
                    });
                };
                wirePick('#blk-s-pick', '#blk-s-item');
                wirePick('#blk-f-pick', '#blk-f-item');
            }
        });
        if (!res || res.button !== 'insert') return;

        const r = res.root;
        const p = editor.project;
        const createdIds = [];
        editor.checkpoint();

        if (activeTab === 'shop') {
            const item = r.querySelector('#blk-s-item').value.trim() || 'minecraft:diamond_sword';
            const name = r.querySelector('#blk-s-name').value.trim() || 'Item';
            const buyP = Math.max(0, Number(r.querySelector('#blk-s-buy').value) || 0);
            const sellP = Math.max(0, Number(r.querySelector('#blk-s-sell').value) || 0);
            const mode = r.querySelector('#blk-s-mode').value;
            const bcmd = r.querySelector('#blk-s-bcmd').value.trim();
            const scmd = r.querySelector('#blk-s-scmd').value.trim();

            if (mode === 'vault') ensureConfirmPage(editor);
            const cw = 122, ch = 104;
            const cx = Math.round((m.width - cw) / 2), cy = Math.round((m.height - ch) / 2);
            const cardBg = M.addImage(p, makePanelDataUrl(cw, ch, '#141925', '#3e4d69', '#52a0f0'));
            const buyBg = M.addImage(p, makePanelDataUrl(sellP > 0 ? 50 : 104, 18, '#1f6f3d', '#3fb950'));
            const sellBg = sellP > 0 ? M.addImage(p, makePanelDataUrl(50, 18, '#7a252a', '#e5534b')) : null;
            const subTxt = sellP > 0 ? `Buy $${buyP} | Sell $${sellP}` : `Price: $${buyP}`;

            const buyAct = mode === 'vault'
                ? [`open:confirm?mode=BUY&item_id=${encodeURIComponent(item)}&item_name=${encodeURIComponent(name)}&price=${buyP}&qty=1`, 'sound:minecraft:ui.button.click']
                : mode === 'vault_direct'
                ? [`buy:${item}:1:${buyP}`, 'sound:minecraft:entity.player.levelup']
                : [`player:${bcmd}`, 'sound:minecraft:ui.button.click'];

            const els = [
                Object.assign(M.newElement('image', m), { name: `${name} Card`, x: cx, y: cy, w: cw, h: ch, image: cardBg, detail: 2 }),
                Object.assign(M.newElement('item', m), { name: `${name} Icon`, x: cx + 45, y: cy + 12, w: 32, h: 32, item }),
                Object.assign(M.newElement('text', m), { name: `${name} Title`, x: cx + 6, y: cy + 48, w: cw - 12, h: 12, text: name, color: '#ffffff', scale: 0.85 }),
                Object.assign(M.newElement('text', m), { name: `${name} Price`, x: cx + 6, y: cy + 62, w: cw - 12, h: 10, text: subTxt, color: '#94a3b8', scale: 0.72 }),
                Object.assign(M.newElement('button', m), { name: `Buy ${name}`, label: 'BUY', x: cx + 9, y: cy + 78, w: sellP > 0 ? 50 : 104, h: 18, image: buyBg, labelScale: 0.8, actions: buyAct })
            ];
            if (sellP > 0) {
                const sellAct = mode === 'vault'
                    ? [`open:confirm?mode=SELL&item_id=${encodeURIComponent(item)}&item_name=${encodeURIComponent(name)}&price=${sellP}&qty=1`, 'sound:minecraft:ui.button.click']
                    : mode === 'vault_direct'
                    ? [`sell:${item}:1:${sellP}`, 'sound:minecraft:entity.experience_orb.pickup']
                    : [`player:${scmd}`, 'sound:minecraft:ui.button.click'];
                els.push(Object.assign(M.newElement('button', m), { name: `Sell ${name}`, label: 'SELL', x: cx + 63, y: cy + 78, w: 50, h: 18, image: sellBg, labelScale: 0.8, actions: sellAct }));
            }
            els.forEach(e => { m.elements.push(e); createdIds.push(e.id); });
        } else if (activeTab === 'feature') {
            const item = r.querySelector('#blk-f-item').value.trim() || 'minecraft:ender_pearl';
            const title = r.querySelector('#blk-f-title').value.trim() || 'FEATURE';
            const sub = r.querySelector('#blk-f-sub').value.trim() || 'Open menu';
            const target = r.querySelector('#blk-f-target').value || m.id;
            const cw = 122, ch = 104;
            const cx = Math.round((m.width - cw) / 2), cy = Math.round((m.height - ch) / 2);
            const cardBg = M.addImage(p, makePanelDataUrl(cw, ch, '#141925', '#3e4d69', '#52a0f0'));
            const btnBg = M.addImage(p, makePanelDataUrl(98, 19, '#195c7a', '#38bdf8'));
            [
                Object.assign(M.newElement('image', m), { name: `${title} Card`, x: cx, y: cy, w: cw, h: ch, image: cardBg, detail: 2 }),
                Object.assign(M.newElement('item', m), { name: `${title} Icon`, x: cx + 45, y: cy + 12, w: 32, h: 32, item }),
                Object.assign(M.newElement('text', m), { name: `${title} Title`, x: cx + 6, y: cy + 48, w: cw - 12, h: 12, text: title, color: '#fde68a', scale: 0.9 }),
                Object.assign(M.newElement('text', m), { name: `${title} Sub`, x: cx + 6, y: cy + 62, w: cw - 12, h: 10, text: sub, color: '#94a3b8', scale: 0.72 }),
                Object.assign(M.newElement('button', m), { name: `Open ${title}`, label: 'OPEN', x: cx + 12, y: cy + 77, w: 98, h: 19, image: btnBg, labelScale: 0.82, actions: [`open:${target}`, 'sound:minecraft:ui.button.click'] })
            ].forEach(e => { m.elements.push(e); createdIds.push(e.id); });
        } else if (activeTab === 'qty') {
            const v = (r.querySelector('#blk-q-var').value.trim() || 'qty').replace(/[^a-zA-Z0-9_]/g, '');
            const def = String(r.querySelector('#blk-q-def').value || '1');
            const totalW = 212;
            const sx = Math.round((m.width - totalW) / 2), sy = Math.round(m.height / 2 - 10);
            const btnImg = M.addImage(p, makePanelDataUrl(28, 18, '#262d3d', '#4e5d7a'));
            [
                Object.assign(M.newElement('button', m), { name: 'Qty -16', label: '-16', x: sx, y: sy, w: 28, h: 18, image: btnImg, labelScale: 0.8, actions: [`add:${v}=-16`, 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('button', m), { name: 'Qty -1', label: '-1', x: sx + 32, y: sy, w: 28, h: 18, image: btnImg, labelScale: 0.8, actions: [`add:${v}=-1`, 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('input', m), { name: 'Qty Input', varName: v, defaultValue: def, prefix: 'x', x: sx + 64, y: sy, w: 84, h: 18, scale: 0.85 }),
                Object.assign(M.newElement('button', m), { name: 'Qty +1', label: '+1', x: sx + 152, y: sy, w: 28, h: 18, image: btnImg, labelScale: 0.8, actions: [`add:${v}=1`, 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('button', m), { name: 'Qty +16', label: '+16', x: sx + 184, y: sy, w: 28, h: 18, image: btnImg, labelScale: 0.8, actions: [`add:${v}=16`, 'sound:minecraft:ui.button.click'] })
            ].forEach(e => { m.elements.push(e); createdIds.push(e.id); });
        } else if (activeTab === 'nav') {
            const by = Math.max(8, m.height - 34);
            const btnImg = M.addImage(p, makePanelDataUrl(64, 20, '#1e2536', '#4a5a78'));
            const clsImg = M.addImage(p, makePanelDataUrl(22, 20, '#6b2226', '#e5534b'));
            [
                Object.assign(M.newElement('button', m), { name: 'Back', label: '← BACK', x: 16, y: by, w: 64, h: 20, image: btnImg, labelScale: 0.8, actions: ['back', 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('button', m), { name: 'Prev Page', label: '< PREV', x: m.width - 178, y: by, w: 64, h: 20, image: btnImg, labelScale: 0.8, actions: ['prev', 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('button', m), { name: 'Next Page', label: 'NEXT >', x: m.width - 108, y: by, w: 64, h: 20, image: btnImg, labelScale: 0.8, actions: ['next', 'sound:minecraft:ui.button.click'] }),
                Object.assign(M.newElement('button', m), { name: 'Close', label: 'X', x: m.width - 38, y: by, w: 22, h: 20, image: clsImg, labelScale: 0.85, actions: ['close'] })
            ].forEach(e => { m.elements.push(e); createdIds.push(e.id); });
        }

        editor.setSel(createdIds);
        editor.changed();
        GS.toast(`Inserted ${createdIds.length} elements`, 'ok');
    }

    GS.Blocks = { open };
})();
