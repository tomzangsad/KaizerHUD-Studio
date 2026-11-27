/* ========================================
   GUI Studio — Visual Action Builder + Variable Picker
   Makes configuring Open Menu, Vault Shop Trade, External Commands,
   Sounds, Spin, Scroll, and Messages point-and-click (with Raw Code toggle).
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const VARIABLES = [
        ['%player_name%', 'Player Name'],
        ['$%vault_eco_balance_formatted%', 'Player Balance (Vault)'],
        ['%server_online%/%server_max_players%', 'Online / Max Players'],
        ['%player_level%', 'XP Level'],
        ['{qty}', 'Quantity Variable ({qty})'],
        ['{price}', 'Unit Price ({price})'],
        ['{qty*price}', 'Total Price ({qty*price})'],
        ['{item_id}', 'Dynamic Item ID ({item_id})'],
        ['{item_name}', 'Dynamic Item Name ({item_name})'],
        ['{mode}', 'Trade Mode (BUY / SELL)'],
        ['{cmd}', 'Dynamic Command ({cmd})'],
    ];

    const SOUND_PRESETS = [
        ['minecraft:ui.button.click', 'UI Click'],
        ['minecraft:entity.player.levelup', 'Level Up / Fanfare'],
        ['minecraft:ui.toast.challenge_complete', 'Challenge Complete'],
        ['minecraft:block.anvil.use', 'Anvil Craft / Forge'],
        ['minecraft:entity.experience_orb.pickup', 'XP Orb Pickup'],
        ['minecraft:entity.enderman.teleport', 'Warp / Teleport'],
        ['minecraft:entity.villager.no', 'Error / Denied'],
        ['__custom__', 'Custom Sound ID...'],
    ];

    const CMD_PRESETS = [
        ['', '-- Insert Preset Command --'],
        ['console:give %player_name% {item_id} {qty}', 'Give Item (Vanilla Console)'],
        ['console:iagive %player_name% {item_id} {qty}', 'Give Custom Item (ItemsAdder)'],
        ['console:nexo give %player_name% {item_id} {qty}', 'Give Custom Item (Nexo)'],
        ['console:eco take %player_name% {qty*price}', 'Take Money (Essentials Eco)'],
        ['console:eco give %player_name% {qty*price}', 'Give Money (Essentials Eco)'],
        ['console:lp user %player_name% parent add vip', 'Add Rank (LuckPerms)'],
        ['player:shop', 'Open External Shop (/shop)'],
        ['player:warp spawn', 'Teleport Warp (/warp spawn)'],
    ];

    function dec(s) {
        try { return decodeURIComponent(String(s || '')); }
        catch (e) { return String(s || ''); }
    }

    function encVal(s) {
        return encodeURIComponent(String(s == null ? '' : s)).replace(/%20/g, '%20');
    }

    function rightSplit3(rest) {
        const i2 = rest.lastIndexOf(':');
        if (i2 <= 0) return [rest, '1', '100'];
        const i1 = rest.lastIndexOf(':', i2 - 1);
        if (i1 <= 0) return [rest.slice(0, i2), '1', rest.slice(i2 + 1)];
        return [rest.slice(0, i1), rest.slice(i1 + 1, i2), rest.slice(i2 + 1)];
    }

    function parseLine(raw) {
        const s = String(raw || '').trim();
        if (!s) return null;
        if (/^(back|close|next|prev)$/i.test(s)) {
            return { kind: 'nav', nav: s.toLowerCase() };
        }
        let m;
        if ((m = /^open:([^?]+)(?:\?(.*))?$/i.exec(s))) {
            const params = [];
            if (m[2]) {
                m[2].split('&').forEach(pair => {
                    const eq = pair.indexOf('=');
                    if (eq > 0) params.push({ k: dec(pair.slice(0, eq).trim()), v: dec(pair.slice(eq + 1).trim()) });
                });
            }
            return { kind: 'open', target: m[1].trim(), params };
        }
        if ((m = /^trade:([^:]+):(.+)$/i.exec(s))) {
            const [item, qty, price] = rightSplit3(m[2]);
            return { kind: 'economy', mode: 'trade', tradeMode: m[1].trim(), item, qty, price };
        }
        if ((m = /^(buy|sell):(.+)$/i.exec(s))) {
            const [item, qty, price] = rightSplit3(m[2]);
            return { kind: 'economy', mode: m[1].toLowerCase(), tradeMode: '{mode}', item, qty, price };
        }
        if ((m = /^sellhand:(.*)$/i.exec(s))) {
            return { kind: 'economy', mode: 'sellhand', tradeMode: 'SELL HAND', item: '', qty: '1', price: m[1].trim() || '25' };
        }
        if ((m = /^pay:(.*)$/i.exec(s))) {
            return { kind: 'economy', mode: 'pay', tradeMode: 'PAY', item: '', qty: '1', price: m[1].trim() || '{price}' };
        }
        if ((m = /^(player|cmd|command|console):(.*)$/i.exec(s))) {
            return { kind: 'command', runner: m[1].toLowerCase() === 'console' ? 'console' : 'player', cmd: m[2].trim() };
        }
        if ((m = /^sound:(.*)$/i.exec(s))) {
            return { kind: 'sound', sound: m[1].trim() };
        }
        if ((m = /^(?:message|msg):(.*)$/i.exec(s))) {
            return { kind: 'message', text: m[1].trim() };
        }
        if ((m = /^spin(?::(.*))?$/i.exec(s))) {
            return { kind: 'spin', target: (m[1] || '').trim() };
        }
        if ((m = /^scroll:([^:]+):(.*)$/i.exec(s))) {
            return { kind: 'scroll', target: m[1].trim(), arg: m[2].trim() };
        }
        if ((m = /^(set|add|mul):([^=]+)=(.*)$/i.exec(s))) {
            return { kind: 'var', op: m[1].toLowerCase(), varName: m[2].trim(), val: m[3].trim() };
        }
        return { kind: 'other', raw: s };
    }

    function serializeAction(a) {
        if (!a) return '';
        if (a.kind === 'nav') return a.nav || 'back';
        if (a.kind === 'open') {
            const base = 'open:' + (a.target || 'main').trim();
            const qs = (a.params || [])
                .filter(p => String(p.k || '').trim())
                .map(p => `${encodeURIComponent(String(p.k).trim())}=${encVal(p.v)}`)
                .join('&');
            return qs ? `${base}?${qs}` : base;
        }
        if (a.kind === 'economy') {
            if (a.mode === 'pay') return `pay:${String(a.price || '0').trim()}`;
            if (a.mode === 'sellhand') return `sellhand:${String(a.price || '25').trim()}`;
            if (a.mode === 'trade') return `trade:${a.tradeMode || '{mode}'}:${a.item || '{item_id}'}:${a.qty || '{qty}'}:${a.price || '{qty*price}'}`;
            return `${a.mode}:${a.item || 'minecraft:diamond'}:${a.qty || '1'}:${a.price || '100'}`;
        }
        if (a.kind === 'command') {
            return `${a.runner === 'console' ? 'console' : 'player'}:${String(a.cmd || '').trim()}`;
        }
        if (a.kind === 'sound') return `sound:${String(a.sound || 'minecraft:ui.button.click').trim()}`;
        if (a.kind === 'message') return `message:${String(a.text || '')}`;
        if (a.kind === 'spin') return `spin:${String(a.target || '').trim()}`;
        if (a.kind === 'scroll') return `scroll:${String(a.target || '').trim()}:${String(a.arg || '0:28').trim()}`;
        if (a.kind === 'var') return `${a.op || 'set'}:${String(a.varName || 'qty').trim()}=${String(a.val || '1').trim()}`;
        return String(a.raw || '').trim();
    }

    function serializeList(list) {
        return list.map(serializeAction).filter(Boolean);
    }

    let activeVarMenu = null;
    function closeVarMenu() {
        if (activeVarMenu) { activeVarMenu.remove(); activeVarMenu = null; }
    }

    function openVarMenu(anchor, onPick) {
        closeVarMenu();
        const r = anchor.getBoundingClientRect();
        const pop = document.createElement('div');
        pop.className = 'gs-var-pop';
        pop.innerHTML = `<div class="gs-var-head">Insert Variable / Placeholder</div>`
            + VARIABLES.map(([code, desc]) => `<button type="button" class="gs-var-item" data-val="${esc(code)}"><code>${esc(code)}</code><span>${esc(desc)}</span></button>`).join('');
        pop.style.left = Math.max(8, Math.min(window.innerWidth - 260, r.left - 180)) + 'px';
        pop.style.top = Math.min(window.innerHeight - 280, r.bottom + 4) + 'px';
        pop.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-val]');
            if (!btn) return;
            onPick(btn.dataset.val);
            closeVarMenu();
        });
        document.body.appendChild(pop);
        activeVarMenu = pop;
        const dismiss = (ev) => {
            if (pop.contains(ev.target) || anchor.contains(ev.target)) return;
            closeVarMenu();
            document.removeEventListener('mousedown', dismiss, true);
        };
        setTimeout(() => document.addEventListener('mousedown', dismiss, true), 0);
    }

    let rawMode = false;

    function renderHtml(el, editor) {
        const menus = editor.project.menus || [];
        const roulettes = editor.menu().elements.filter(x => x.type === 'roulette');
        const scrolls = editor.menu().elements.filter(x => x.type === 'scroll_area');
        const parsed = (el.actions || []).map(parseLine).filter(Boolean);

        let topBar = `<div class="gs-ab-bar">
            <select class="gs-ab-add" id="gs-ab-add">
              <option value="">+ Add Action...</option>
              <optgroup label="Navigation &amp; Windows">
                <option value="open">Open Menu Page</option>
                <option value="nav:back">Go Back (Previous Menu)</option>
                <option value="nav:close">Close Menu</option>
                <option value="nav:next">Next Page</option>
                <option value="nav:prev">Previous Page</option>
              </optgroup>
              <optgroup label="Vault Economy (Optional Built-in)">
                <option value="eco:buy">Buy Item (Vault)</option>
                <option value="eco:sell">Sell Item (Vault)</option>
                <option value="eco:sellhand">Sell Held Item (Vault)</option>
                <option value="eco:pay">Pay Money Before Command (Vault)</option>
                <option value="eco:trade">Dynamic Trade ({mode} Confirm)</option>
              </optgroup>
              <optgroup label="External Plugins (Any Plugin)">
                <option value="cmd:player">Run Player Command (/cmd)</option>
                <option value="cmd:console">Run Console Command</option>
              </optgroup>
              <optgroup label="Interactive &amp; Feedback">
                <option value="sound">Play Sound</option>
                <option value="message">Send Chat Message</option>
                <option value="var:add">Add to Variable (+ / -)</option>
                <option value="var:set">Set Variable (=)</option>
                <option value="spin">Spin Crate Roulette</option>
                <option value="scroll">Scroll Viewport</option>
              </optgroup>
            </select>
            <button type="button" class="ghost-btn small ${rawMode ? 'active' : ''}" id="gs-ab-raw" title="Toggle Raw Action Code">&lt;/&gt; Raw</button>
        </div>`;

        if (rawMode) {
            return topBar + editor.field('Actions (one per line)', 'actions', (el.actions || []).join('\n'), {
                type: 'textarea', rows: 6,
                hint: 'Supported: <code>open:</code> · <code>buy:</code> · <code>sell:</code> · <code>sellhand:</code> · <code>pay:</code> · <code>trade:</code> · <code>player:</code> · <code>console:</code> · <code>sound:</code> · <code>message:</code> · <code>spin:</code> · <code>scroll:</code>'
            });
        }

        if (!parsed.length) {
            return topBar + `<div class="gs-ab-empty">No actions yet. Pick an action from <b>+ Add Action...</b> above (or use <b>+ Ask Confirm</b>).</div>`;
        }

        const cards = parsed.map((a, idx) => {
            const headBtns = `<span class="gs-ab-tools">
                ${idx > 0 ? `<button type="button" class="icon-btn small" data-ab-move="${idx}:-1" title="Move Up">▲</button>` : ''}
                ${idx < parsed.length - 1 ? `<button type="button" class="icon-btn small" data-ab-move="${idx}:1" title="Move Down">▼</button>` : ''}
                <button type="button" class="icon-btn small danger" data-ab-del="${idx}" title="Remove">×</button>
            </span>`;

            if (a.kind === 'open') {
                const mOpts = menus.map(m => `<option value="${esc(m.id)}" ${m.id === a.target ? 'selected' : ''}>${esc(m.title || m.id)} (${esc(m.id)})</option>`).join('')
                    + (menus.some(m => m.id === a.target) ? '' : `<option value="${esc(a.target)}" selected>${esc(a.target)} (missing)</option>`);
                const pRows = (a.params || []).map((pr, pi) => {
                    const isItem = /item/i.test(pr.k);
                    return `<div class="gs-ab-prow">
                        <input type="text" class="gs-ab-pk" data-ab-pk="${idx}:${pi}" value="${esc(pr.k)}" placeholder="key" />
                        <span class="gs-ab-eq">=</span>
                        <input type="text" class="gs-ab-pv" data-ab-pv="${idx}:${pi}" value="${esc(pr.v)}" placeholder="value" />
                        ${isItem ? `<button type="button" class="icon-btn small" data-ab-pickitem="${idx}:${pi}" title="Pick Item">Item</button>` : ''}
                        <button type="button" class="icon-btn small danger" data-ab-delp="${idx}:${pi}" title="Remove param">×</button>
                    </div>`;
                }).join('');
                return `<div class="gs-ab-card kind-open">
                    <div class="gs-ab-head"><b>Open Menu</b>${headBtns}</div>
                    <select class="gs-ab-in" data-ab-set="${idx}:target">${mOpts}</select>
                    <div class="gs-ab-params">${pRows}</div>
                    <button type="button" class="ghost-btn small" data-ab-addp="${idx}">+ Parameter (pass variable)</button>
                </div>`;
            }

            if (a.kind === 'economy') {
                const modes = [
                    ['buy', 'Buy Item (Vault)'],
                    ['sell', 'Sell Item (Vault)'],
                    ['sellhand', 'Sell Held Item (Vault)'],
                    ['pay', 'Pay Money Only (Vault)'],
                    ['trade', 'Auto Trade ({mode} Confirm)'],
                ];
                const mSel = `<select class="gs-ab-in" data-ab-set="${idx}:mode">${modes.map(([v, l]) => `<option value="${v}" ${v === a.mode ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
                let body = '';
                if (a.mode === 'pay') {
                    body = `<div class="gs-grid2">
                        <label class="gs-field"><span>Amount ($)</span><input type="text" data-ab-set="${idx}:price" value="${esc(a.price)}" placeholder="{price}" /></label>
                        <div></div>
                    </div>`;
                } else if (a.mode === 'sellhand') {
                    body = `<label class="gs-field"><span>Unit Price ($ per item)</span><input type="text" data-ab-set="${idx}:price" value="${esc(a.price)}" placeholder="25" /></label>`;
                } else {
                    body = `${a.mode === 'trade' ? `<label class="gs-field"><span>Mode Var</span><input type="text" data-ab-set="${idx}:tradeMode" value="${esc(a.tradeMode)}" /></label>` : ''}
                    <div class="gs-ab-rowitem">
                        <label class="gs-field"><span>Item ID</span><input type="text" data-ab-set="${idx}:item" value="${esc(a.item)}" placeholder="minecraft:diamond or {item_id}" /></label>
                        <button type="button" class="ghost-btn small" data-ab-pickeco="${idx}">Pick</button>
                    </div>
                    <div class="gs-grid2">
                        <label class="gs-field"><span>Qty</span><input type="text" data-ab-set="${idx}:qty" value="${esc(a.qty)}" placeholder="1 or {qty}" /></label>
                        <label class="gs-field"><span>Total Price ($)</span><input type="text" data-ab-set="${idx}:price" value="${esc(a.price)}" placeholder="{qty*price}" /></label>
                    </div>`;
                }
                return `<div class="gs-ab-card kind-eco">
                    <div class="gs-ab-head"><b>Vault Economy (Built-in)</b>${headBtns}</div>
                    ${mSel}${body}
                </div>`;
            }

            if (a.kind === 'command') {
                return `<div class="gs-ab-card kind-cmd">
                    <div class="gs-ab-head"><b>Run Command (Any Plugin)</b>${headBtns}</div>
                    <div class="gs-grid2">
                        <select data-ab-set="${idx}:runner">
                            <option value="player" ${a.runner === 'player' ? 'selected' : ''}>Run as Player</option>
                            <option value="console" ${a.runner === 'console' ? 'selected' : ''}>Run as Console</option>
                        </select>
                        <select data-ab-preset="${idx}">
                            ${CMD_PRESETS.map(([cmdVal, lbl]) => `<option value="${esc(cmdVal)}">${esc(lbl)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="gs-ab-rowitem">
                        <input type="text" data-ab-set="${idx}:cmd" value="${esc(a.cmd)}" placeholder="Command without slash..." />
                        <button type="button" class="ghost-btn small" data-ab-var="${idx}:cmd" title="Insert Variable">{ }</button>
                    </div>
                </div>`;
            }

            if (a.kind === 'sound') {
                const baseKey = a.sound.split(';')[0].trim();
                const isKnown = SOUND_PRESETS.some(([k]) => k === a.sound || k === baseKey);
                const opts = SOUND_PRESETS.map(([k, l]) => `<option value="${esc(k)}" ${(a.sound === k || baseKey === k) ? 'selected' : ''}>${esc(l)}</option>`).join('');
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Play Sound</b>${headBtns}</div>
                    <select data-ab-soundpick="${idx}">${opts}</select>
                    ${!isKnown ? `<input type="text" data-ab-set="${idx}:sound" value="${esc(a.sound)}" placeholder="minecraft:ui.button.click" />` : ''}
                </div>`;
            }

            if (a.kind === 'nav') {
                const navOpts = [['back', '← Go Back (Previous Menu)'], ['close', '✕ Close Menu'], ['next', '▶ Next Page'], ['prev', '◀ Previous Page']];
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Menu Navigation</b>${headBtns}</div>
                    <select data-ab-set="${idx}:nav">${navOpts.map(([v, l]) => `<option value="${v}" ${v === a.nav ? 'selected' : ''}>${l}</option>`).join('')}</select>
                </div>`;
            }

            if (a.kind === 'message') {
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Send Chat Message</b>${headBtns}</div>
                    <div class="gs-ab-rowitem">
                        <input type="text" data-ab-set="${idx}:text" value="${esc(a.text)}" placeholder="&aHello %player_name%!" />
                        <button type="button" class="ghost-btn small" data-ab-var="${idx}:text" title="Insert Variable">{ }</button>
                    </div>
                </div>`;
            }

            if (a.kind === 'var') {
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Session Variable</b>${headBtns}</div>
                    <div class="gs-grid3">
                        <input type="text" data-ab-set="${idx}:varName" value="${esc(a.varName)}" placeholder="qty" />
                        <select data-ab-set="${idx}:op">
                            <option value="add" ${a.op === 'add' ? 'selected' : ''}>Add (+)</option>
                            <option value="set" ${a.op === 'set' ? 'selected' : ''}>Set (=)</option>
                            <option value="mul" ${a.op === 'mul' ? 'selected' : ''}>Multiply (×)</option>
                        </select>
                        <input type="text" data-ab-set="${idx}:val" value="${esc(a.val)}" placeholder="1" />
                    </div>
                </div>`;
            }

            if (a.kind === 'spin') {
                const rOpts = roulettes.length
                    ? roulettes.map(r => `<option value="${esc(r.id)}" ${r.id === a.target ? 'selected' : ''}>${esc(r.name || r.id)}</option>`).join('')
                    : `<option value="${esc(a.target || '')}">${esc(a.target || '(no roulette on page)')}</option>`;
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Spin Crate Roulette</b>${headBtns}</div>
                    <select data-ab-set="${idx}:target">${rOpts}</select>
                </div>`;
            }

            if (a.kind === 'scroll') {
                const sOpts = scrolls.length
                    ? scrolls.map(sc => `<option value="${esc(sc.id)}" ${sc.id === a.target ? 'selected' : ''}>${esc(sc.name || sc.id)}</option>`).join('')
                    : `<option value="${esc(a.target || '')}">${esc(a.target || '(no scroll area on page)')}</option>`;
                return `<div class="gs-ab-card">
                    <div class="gs-ab-head"><b>Scroll Viewport</b>${headBtns}</div>
                    <div class="gs-grid2">
                        <select data-ab-set="${idx}:target">${sOpts}</select>
                        <input type="text" data-ab-set="${idx}:arg" value="${esc(a.arg)}" placeholder="0:28 or reset" />
                    </div>
                </div>`;
            }

            return `<div class="gs-ab-card">
                <div class="gs-ab-head"><b>Custom Action</b>${headBtns}</div>
                <input type="text" data-ab-set="${idx}:raw" value="${esc(a.raw)}" />
            </div>`;
        }).join('');

        return topBar + `<div class="gs-ab-list">${cards}</div>`;
    }

    function bind(root, el, editor) {
        if (!el || !root) return;
        const parsed = (el.actions || []).map(parseLine).filter(Boolean);

        const commit = (rerender = true) => {
            editor.checkpoint();
            el.actions = serializeList(parsed);
            editor.changed();
            if (!rerender) {
                editor.renderPages();
                editor.renderStatus();
            }
        };

        const rawBtn = root.querySelector('#gs-ab-raw');
        if (rawBtn) rawBtn.addEventListener('click', () => {
            rawMode = !rawMode;
            editor.renderProps();
        });

        const addSel = root.querySelector('#gs-ab-add');
        if (addSel) addSel.addEventListener('change', () => {
            const v = addSel.value;
            if (!v) return;
            const menus = editor.project.menus || [];
            if (v === 'open') parsed.push({ kind: 'open', target: (menus.find(m => m !== editor.menu()) || menus[0] || { id: 'main' }).id, params: [] });
            else if (v.startsWith('nav:')) parsed.push({ kind: 'nav', nav: v.slice(4) });
            else if (v === 'eco:buy') parsed.push({ kind: 'economy', mode: 'buy', tradeMode: 'BUY', item: 'minecraft:diamond_sword', qty: '1', price: '500' });
            else if (v === 'eco:sell') parsed.push({ kind: 'economy', mode: 'sell', tradeMode: 'SELL', item: 'minecraft:diamond', qty: '1', price: '100' });
            else if (v === 'eco:sellhand') parsed.push({ kind: 'economy', mode: 'sellhand', tradeMode: 'SELL HAND', item: '', qty: '1', price: '25' });
            else if (v === 'eco:pay') parsed.push({ kind: 'economy', mode: 'pay', tradeMode: 'PAY', item: '', qty: '1', price: '{price}' });
            else if (v === 'eco:trade') parsed.push({ kind: 'economy', mode: 'trade', tradeMode: '{mode}', item: '{item_id}', qty: '{qty}', price: '{qty*price}' });
            else if (v === 'cmd:player') parsed.push({ kind: 'command', runner: 'player', cmd: 'warp spawn' });
            else if (v === 'cmd:console') parsed.push({ kind: 'command', runner: 'console', cmd: 'give %player_name% diamond 1' });
            else if (v === 'sound') parsed.push({ kind: 'sound', sound: 'minecraft:ui.button.click' });
            else if (v === 'message') parsed.push({ kind: 'message', text: '&aAction completed!' });
            else if (v === 'var:add') parsed.push({ kind: 'var', op: 'add', varName: 'qty', val: '1' });
            else if (v === 'var:set') parsed.push({ kind: 'var', op: 'set', varName: 'qty', val: '1' });
            else if (v === 'spin') {
                const r = editor.menu().elements.find(x => x.type === 'roulette');
                parsed.push({ kind: 'spin', target: r ? r.id : 'crate' });
            } else if (v === 'scroll') {
                const sc = editor.menu().elements.find(x => x.type === 'scroll_area');
                parsed.push({ kind: 'scroll', target: sc ? sc.id : 'scroll', arg: '0:28' });
            }
            commit(true);
        });

        root.querySelectorAll('[data-ab-del]').forEach(b => b.addEventListener('click', () => {
            parsed.splice(Number(b.dataset.abDel), 1);
            commit(true);
        }));

        root.querySelectorAll('[data-ab-move]').forEach(b => b.addEventListener('click', () => {
            const [i, dir] = b.dataset.abMove.split(':').map(Number);
            const j = i + dir;
            if (j < 0 || j >= parsed.length) return;
            [parsed[i], parsed[j]] = [parsed[j], parsed[i]];
            commit(true);
        }));

        root.querySelectorAll('[data-ab-set]').forEach(inp => {
            const evName = inp.tagName === 'SELECT' ? 'change' : 'input';
            inp.addEventListener(evName, () => {
                const [iS, field] = inp.dataset.abSet.split(':');
                const a = parsed[Number(iS)];
                if (!a) return;
                a[field] = inp.value;
                const needsRebuild = (inp.tagName === 'SELECT' && field === 'mode');
                commit(needsRebuild);
            });
        });

        root.querySelectorAll('[data-ab-pk]').forEach(inp => inp.addEventListener('input', () => {
            const [iS, piS] = inp.dataset.abPk.split(':').map(Number);
            if (parsed[iS] && parsed[iS].params[piS]) {
                parsed[iS].params[piS].k = inp.value;
                commit(false);
            }
        }));
        root.querySelectorAll('[data-ab-pv]').forEach(inp => inp.addEventListener('input', () => {
            const [iS, piS] = inp.dataset.abPv.split(':').map(Number);
            if (parsed[iS] && parsed[iS].params[piS]) {
                parsed[iS].params[piS].v = inp.value;
                commit(false);
            }
        }));
        root.querySelectorAll('[data-ab-addp]').forEach(b => b.addEventListener('click', () => {
            const a = parsed[Number(b.dataset.abAddp)];
            if (a) { a.params.push({ k: 'param', v: 'value' }); commit(true); }
        }));
        root.querySelectorAll('[data-ab-delp]').forEach(b => b.addEventListener('click', () => {
            const [iS, piS] = b.dataset.abDelp.split(':').map(Number);
            if (parsed[iS] && parsed[iS].params) { parsed[iS].params.splice(piS, 1); commit(true); }
        }));

        root.querySelectorAll('[data-ab-pickitem]').forEach(b => b.addEventListener('click', () => {
            if (!GS.Items) return;
            const [iS, piS] = b.dataset.abPickitem.split(':').map(Number);
            const cur = parsed[iS] && parsed[iS].params[piS] ? parsed[iS].params[piS].v : '';
            GS.Items.pick(cur).then(id => {
                if (!id || !parsed[iS] || !parsed[iS].params[piS]) return;
                parsed[iS].params[piS].v = id;
                commit(true);
            });
        }));

        root.querySelectorAll('[data-ab-pickeco]').forEach(b => b.addEventListener('click', () => {
            if (!GS.Items) return;
            const iS = Number(b.dataset.abPickeco);
            const cur = parsed[iS] ? parsed[iS].item : '';
            GS.Items.pick(cur).then(id => {
                if (!id || !parsed[iS]) return;
                parsed[iS].item = id;
                commit(true);
            });
        }));

        root.querySelectorAll('[data-ab-preset]').forEach(sel => sel.addEventListener('change', () => {
            const v = sel.value;
            if (!v) return;
            const a = parsed[Number(sel.dataset.abPreset)];
            if (!a) return;
            const c = v.indexOf(':');
            a.runner = v.slice(0, c);
            a.cmd = v.slice(c + 1);
            commit(true);
        }));

        root.querySelectorAll('[data-ab-soundpick]').forEach(sel => sel.addEventListener('change', () => {
            const a = parsed[Number(sel.dataset.abSoundpick)];
            if (!a) return;
            a.sound = sel.value === '__custom__' ? 'minecraft:block.note_block.pling' : sel.value;
            commit(true);
        }));

        root.querySelectorAll('[data-ab-var]').forEach(btn => btn.addEventListener('click', () => {
            const [iS, field] = btn.dataset.abVar.split(':');
            const inp = root.querySelector(`[data-ab-set="${iS}:${field}"]`);
            if (!inp) return;
            openVarMenu(btn, (token) => {
                const start = inp.selectionStart != null ? inp.selectionStart : inp.value.length;
                const end = inp.selectionEnd != null ? inp.selectionEnd : start;
                inp.value = inp.value.slice(0, start) + token + inp.value.slice(end);
                parsed[Number(iS)][field] = inp.value;
                commit(false);
            });
        }));
    }

    GS.ActionBuilder = { renderHtml, bind, openVarMenu };
})();
