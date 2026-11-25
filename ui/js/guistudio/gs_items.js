/* ========================================
   GUI Studio — Minecraft items
   Item pictures for the editor are read from the user's own files (the game's client .jar,
   a resource pack .zip or folder): nothing of Mojang's is shipped with the program.
   In game: Java shows the real item (KaizerUI ItemDisplay), Bedrock a texture of the
   game's own pack (textures/items/… — names differ from Java, see BEDROCK_NAMES).
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};
    const LS_KEY = 'kz_item_textures_v1';

    /** Slots of the player (Java shows what the player wears / holds; Bedrock cannot) */
    const SLOTS = [
        ['slot:head', 'Helmet (worn)'], ['slot:chest', 'Chestplate (worn)'], ['slot:legs', 'Leggings (worn)'], ['slot:feet', 'Boots (worn)'],
        ['slot:hand', 'Item in main hand'], ['slot:offhand', 'Item in off hand']
    ];

    /** Java item id → Bedrock texture name where they differ (textures/items/<name>) */
    const BEDROCK_NAMES = {
        golden_apple: 'apple_golden', enchanted_golden_apple: 'apple_golden', golden_carrot: 'carrot_golden', glistering_melon_slice: 'melon_speckled',
        beef: 'beef_raw', cooked_beef: 'beef_cooked', chicken: 'chicken_raw', cooked_chicken: 'chicken_cooked', porkchop: 'porkchop_raw', cooked_porkchop: 'porkchop_cooked',
        mutton: 'mutton_raw', cooked_mutton: 'mutton_cooked', rabbit: 'rabbit_raw', cooked_rabbit: 'rabbit_cooked', cod: 'fish_raw', cooked_cod: 'fish_cooked',
        salmon: 'fish_salmon_raw', cooked_salmon: 'fish_salmon_cooked', tropical_fish: 'fish_clownfish_raw', pufferfish: 'fish_pufferfish_raw',
        baked_potato: 'potato_baked', poisonous_potato: 'potato_poisonous', melon_slice: 'melon', wheat_seeds: 'seeds_wheat', pumpkin_seeds: 'seeds_pumpkin', melon_seeds: 'seeds_melon',
        golden_sword: 'gold_sword', golden_pickaxe: 'gold_pickaxe', golden_axe: 'gold_axe', golden_shovel: 'gold_shovel', golden_hoe: 'gold_hoe',
        golden_helmet: 'gold_helmet', golden_chestplate: 'gold_chestplate', golden_leggings: 'gold_leggings', golden_boots: 'gold_boots',
        wooden_sword: 'wood_sword', wooden_pickaxe: 'wood_pickaxe', wooden_axe: 'wood_axe', wooden_shovel: 'wood_shovel', wooden_hoe: 'wood_hoe',
        bow: 'bow_standby', crossbow: 'crossbow_standby', fishing_rod: 'fishing_rod_uncast', firework_rocket: 'fireworks', totem_of_undying: 'totem',
        compass: 'compass_item', clock: 'clock_item', potion: 'potion_bottle_drinkable', splash_potion: 'potion_bottle_splash', glass_bottle: 'potion_bottle_empty',
        enchanted_book: 'book_enchanted', written_book: 'book_written', writable_book: 'book_writable', map: 'map_empty', filled_map: 'map_filled',
        bucket: 'bucket_empty', water_bucket: 'bucket_water', lava_bucket: 'bucket_lava', milk_bucket: 'bucket_milk', powder_snow_bucket: 'bucket_powder_snow',
        redstone: 'redstone_dust', slime_ball: 'slimeball', lapis_lazuli: 'dye_powder_blue_new', bone_meal: 'dye_powder_white_new', cocoa_beans: 'dye_powder_brown_new',
        ink_sac: 'dye_powder_black', experience_bottle: 'experience_bottle', ender_eye: 'ender_eye', fire_charge: 'fireball', snowball: 'snowball',
        nether_wart: 'nether_wart', sugar_cane: 'reeds', minecart: 'minecart_normal', chest_minecart: 'minecart_chest', oak_boat: 'boat_oak', armor_stand: 'wooden_armorstand',
        glow_item_frame: 'glow_item_frame', item_frame: 'item_frame', oak_door: 'door_wood', iron_door: 'door_iron', cake: 'cake', flower_pot: 'flower_pot',
        leather_horse_armor: 'leather_horse_armor', iron_horse_armor: 'iron_horse_armor', golden_horse_armor: 'gold_horse_armor', diamond_horse_armor: 'diamond_horse_armor',
        music_disc_cat: 'record_cat', spyglass: 'spyglass', turtle_helmet: 'turtle_helmet', phantom_membrane: 'phantom_membrane', heart_of_the_sea: 'heartofthesea_closed'
    };

    // icons: every item drawn like the inventory (blocks in 3D), kinds: id → 'item' | 'block',
    // texNames: which item / block texture files exist (for Bedrock texture paths) once the raw textures are dropped
    const state = { items: {}, blocks: {}, skins: {}, icons: {}, kinds: {}, texNames: { items: {}, blocks: {} }, iconVer: 0, source: '', loaded: false };
    const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

    function restore() {
        if (state.loaded) return;
        state.loaded = true;
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            const o = JSON.parse(raw);
            state.items = o.items || {}; state.blocks = o.blocks || {}; state.skins = o.skins || {}; state.source = o.source || '';
            state.icons = o.icons || {}; state.kinds = o.kinds || {}; state.texNames = o.texNames || { items: {}, blocks: {} }; state.iconVer = o.iconVer || 0;
        } catch (e) { /* storage blocked: keep empty */ }
    }

    function persist() {
        try { localStorage.setItem(LS_KEY, JSON.stringify({ source: state.source, items: state.items, blocks: state.blocks, skins: state.skins, icons: state.icons, kinds: state.kinds, texNames: state.texNames, iconVer: state.iconVer })); }
        catch (e) { GS.toast && GS.toast('Item pictures loaded for this session only (could not keep them: ' + e.message + ')', 'warn'); }
    }

    /** 'minecraft:diamond_sword' / 'diamond_sword' → 'diamond_sword'; other namespaces / slots → null */
    function vanillaName(id) {
        const s = String(id || '').trim().toLowerCase();
        if (!s || s.includes('%') || s.startsWith('slot:')) return null;
        const m = /^(?:minecraft:)?([a-z0-9_./-]+)$/.exec(s);
        return m ? m[1] : null;
    }

    function isSlot(id) { return /^slot:/i.test(String(id || '').trim()); }

    /** Data URL of the item's picture for the editor, or null */
    function url(id) {
        restore();
        const n = vanillaName(id);
        if (!n) return null;
        // drawn like the inventory (from the game's models) first
        if (state.icons[n]) return state.icons[n];
        // animated items (compass, clock, recovery compass) are compass_00 … in the game's files
        return state.items[n] || state.items[n + '_00'] || state.blocks[n] || state.blocks[n + '_front'] || state.blocks[n + '_side'] || state.blocks[n + '_top']
            || state.blocks[n.replace(/_(slab|stairs|wall|fence)$/, '')] || state.blocks[n.replace(/s$/, '')] || null;
    }

    /** Texture path of the item in the Bedrock game's own pack, or null if it cannot be shown there */
    function bedrockTexture(el) {
        const over = String(el.bedrockTexture || '').trim();
        if (over) return over.replace(/\.png$/i, '');
        const n = vanillaName(el.item);
        if (!n) return null;
        restore();
        const isBlock = state.blocks[n] || state.texNames.blocks[n], isItem = state.items[n] || state.texNames.items[n];
        if (isBlock && !isItem) return 'textures/blocks/' + n;
        return 'textures/items/' + (BEDROCK_NAMES[n] || n);
    }

    function count() { restore(); const c = catalog(); return c.items.length + c.blocks.length; }

    /* ───────────── reading the user's files ───────────── */

    const ITEM_RE = /^assets\/minecraft\/textures\/item\/([a-z0-9_]+)\.png$/;
    const BLOCK_RE = /^assets\/minecraft\/textures\/block\/([a-z0-9_]+)\.png$/;

    /** Square, at most 32 px, first frame of animated textures */
    async function shrink(blob) {
        const bmp = await createImageBitmap(blob);
        const s = Math.min(bmp.width, bmp.height);
        const out = Math.min(32, s);
        const c = document.createElement('canvas');
        c.width = out; c.height = out;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(bmp, 0, 0, s, s, 0, 0, out, out);
        bmp.close && bmp.close();
        return c.toDataURL('image/png');
    }

    /** Entries of a zip (.jar / .zip, a File or an ArrayBuffer): [{ name, read() → Blob }] — stored / deflate only */
    async function zipEntries(file) {
        const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
        const fname = file.name || 'the download';
        const dv = new DataView(buf);
        let eocd = -1;
        for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error(fname + ' is not a .jar / .zip file');
        const n = dv.getUint16(eocd + 10, true);
        let p = dv.getUint32(eocd + 16, true);
        const dec = new TextDecoder();
        const out = [];
        for (let k = 0; k < n; k++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true);
            const csize = dv.getUint32(p + 20, true);
            const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
            const local = dv.getUint32(p + 42, true);
            const name = dec.decode(new Uint8Array(buf, p + 46, nl));
            p += 46 + nl + xl + cl;
            out.push({
                name,
                read: async () => {
                    const ln = dv.getUint16(local + 26, true), lx = dv.getUint16(local + 28, true);
                    const data = new Uint8Array(buf, local + 30 + ln + lx, csize);
                    if (method === 0) return new Blob([data]);
                    if (method !== 8) throw new Error('unsupported zip method');
                    const ds = new DecompressionStream('deflate-raw');
                    return new Response(new Blob([data]).stream().pipeThrough(ds)).blob();
                }
            });
        }
        return out;
    }

    /**
     * Reads item / block pictures from the user's files: a client .jar, a resource pack .zip,
     * or the files of a pack folder (input webkitdirectory). Later sources add to / replace earlier ones.
     */
    async function loadFiles(files, label, onText) {
        restore();
        let entries = [];
        const list = Array.from(files || []);
        if (list.length === 1 && /\.(jar|zip)$/i.test(list[0].name)) entries = await zipEntries(list[0]);
        else {
            entries = list.map(f => {
                const rel = String(f.webkitRelativePath || f.name).replace(/\\/g, '/');
                const i = rel.indexOf('assets/');
                return { name: i >= 0 ? rel.slice(i) : rel, read: async () => f };
            });
        }
        const n = await ingest(entries, null, onText);
        state.source = label || (list[0] && list[0].name) || '';
        persist();
        return n;
    }

    /**
     * Takes item / block pictures and the default skins out of zip / folder entries.
     * A client .jar (or a pack with models) also gets every item drawn like the inventory shows it
     * — blocks as little 3D cubes — from the game's own item definitions and models.
     */
    async function ingest(entries, onProgress, onText) {
        let n = 0, k = 0;
        const items = {}, blocks = {};
        const wanted = entries.filter(e => ITEM_RE.test(e.name) || BLOCK_RE.test(e.name) || SKIN_RE.test(e.name));
        for (const e of wanted) {
            if (onProgress && ++k % 200 === 0) onProgress(k / wanted.length);
            const mi = ITEM_RE.exec(e.name), mb = mi ? null : BLOCK_RE.exec(e.name), ms = SKIN_RE.exec(e.name);
            try {
                if (ms) { state.skins[ms[2]] = await toDataUrl(await e.read()); continue; }
                const data = await shrink(await e.read());
                (mi ? items : blocks)[(mi || mb)[1]] = data;
                n++;
            } catch (err) { /* skip broken pictures */ }
        }
        const hasModels = entries.some(e => /^assets\/minecraft\/(items\/[a-z0-9_]+\.json|models\/item\/[a-z0-9_]+\.json)$/.test(e.name));
        let drawn = null;
        if (hasModels && GS.McRender) {
            try { drawn = await GS.McRender.render(entries, onText); } catch (err) { drawn = null; }
        }
        if (drawn && drawn.count) {
            // full set from the game: keep the inventory pictures, only the names of the raw textures
            state.icons = drawn.icons; state.kinds = drawn.kinds; state.iconVer = GS.McRender.VERSION || 1;
            state.texNames = { items: Object.fromEntries(Object.keys(items).map(x => [x, 1])), blocks: Object.fromEntries(Object.keys(blocks).map(x => [x, 1])) };
            state.items = {}; state.blocks = {};
            n = drawn.count;
        } else {
            // a pack with textures only: its item pictures replace the flat ones; blocks drawn in 3D stay
            Object.entries(items).forEach(([x, u]) => { if (state.kinds[x] !== 'block') delete state.icons[x]; state.items[x] = u; state.texNames.items[x] = 1; });
            Object.entries(blocks).forEach(([x, u]) => { state.blocks[x] = u; state.texNames.blocks[x] = 1; });
        }
        if (!n) throw new Error('No item pictures found (looked for assets/minecraft/textures/item and /block)');
        skinCache.clear();
        return n;
    }

    const SKIN_RE = /^assets\/minecraft\/textures\/entity\/(player\/wide\/)?(steve|alex)\.png$/;

    async function toDataUrl(blob) {
        return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    }

    /** Downloads a URL into an ArrayBuffer, reporting 0..1 */
    async function fetchBuffer(url, size, onProgress) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Download failed (${r.status})`);
        if (!r.body || !r.body.getReader) return r.arrayBuffer();
        const total = size || Number(r.headers.get('content-length')) || 0;
        const reader = r.body.getReader();
        const parts = []; let got = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value); got += value.length;
            if (onProgress && total) onProgress(got / total);
        }
        const out = new Uint8Array(got); let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out.buffer;
    }

    /**
     * Downloads the game's client .jar from Mojang (the same files the launcher gets, ~30 MB, once)
     * and keeps the item / block pictures and the default skins on this computer.
     */
    async function downloadVanilla(onProgress, version) {
        const say = onProgress || (() => {});
        say('Asking Mojang for the newest version…');
        const man = await (await fetch(MANIFEST)).json();
        const id = version || man.latest.release;
        const v = man.versions.find(x => x.id === id);
        if (!v) throw new Error('Unknown Minecraft version ' + id);
        const vj = await (await fetch(v.url)).json();
        const cl = vj.downloads && vj.downloads.client;
        if (!cl) throw new Error('No client download for ' + id);
        const buf = await fetchBuffer(cl.url, cl.size, (f) => say(`Downloading Minecraft ${id}… ${Math.round(f * 100)}%`));
        say('Reading the pictures…');
        const entries = await zipEntries(buf);
        const n = await ingest(entries, (f) => say(`Reading the pictures… ${Math.round(f * 100)}%`), say);
        state.source = 'Minecraft ' + id;
        persist();
        return { n, version: id };
    }

    /** Download with a small progress window; resolves to the number of pictures or null */
    function downloadDialog() {
        return new Promise((resolve) => {
            GS.modal('Download Minecraft assets', `<div class="gs-hint">Gets the game's own pictures (items, blocks, the default skins) straight from Mojang — about 30 MB, once. They stay on this computer and are only used to show your menus here; nothing of them goes into your export.</div>
                <div class="gsi-progress"><div class="gsi-bar"><i></i></div><div class="gsi-msg">Starting…</div></div>`, [['close', 'Close']], {
                onOpen: async (root, done) => {
                    const msg = root.querySelector('.gsi-msg'), bar = root.querySelector('.gsi-bar i');
                    try {
                        const r = await downloadVanilla((t) => {
                            msg.textContent = t;
                            const m = /(\d+)%/.exec(t); if (m) bar.style.width = m[1] + '%';
                        });
                        GS.toast && GS.toast(`Minecraft ${r.version}: ${r.n} item pictures ready`, 'ok');
                        done({ button: 'ok', n: r.n });
                    } catch (err) {
                        msg.textContent = 'Could not download: ' + err.message + ' — check the internet connection, or load a .jar / pack instead.';
                        bar.style.width = '0';
                    }
                }
            }).then(r => resolve(r && r.n ? r.n : null));
        });
    }

    /* ───────────── the default skin, for Player Head / Model pictures in the editor ───────────── */

    const skinCache = new Map();
    let skinImg = null, skinSrc = '';

    /** The default (Steve) skin as a loaded image, or null (loading starts, the canvas redraws when ready) */
    function skinImage() {
        restore();
        const src = state.skins.steve;
        if (!src) return null;
        if (skinSrc === src) return skinImg && skinImg.complete && skinImg.naturalWidth ? skinImg : null;
        skinSrc = src;
        skinImg = new Image();
        skinImg.onload = () => { skinCache.clear(); if (GS.Editor && GS.Editor.renderCanvas) GS.Editor.renderCanvas(); };
        skinImg.src = src;
        return null;
    }

    /**
     * Draws the whole player in 3D on a canvas (like the game's model), turned by opt.yaw
     * (deg, same direction as the element's Angle). false = no skin loaded yet.
     */
    function drawPlayer(canvas, opt) {
        const img = skinImage();
        if (!img || !GS.McRender || !GS.McRender.player) return false;
        GS.McRender.player(canvas, img, opt || {});
        return true;
    }

    /**
     * Picture of the default skin as a data URL (null = no skin loaded):
     * head = its front 8×8 (what Java shows), model = the 3D player turned by yaw.
     */
    function skinArt(kind, yaw) {
        const img = skinImage();
        if (!img) return null;
        const head = kind === 'player_head';
        const key = head ? 'head' : 'model|' + Math.round(+yaw || 0);
        if (skinCache.has(key)) return skinCache.get(key);
        const c = document.createElement('canvas');
        if (head) {
            const k = 8;
            c.width = 8 * k; c.height = 8 * k;
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(img, 8, 8, 8, 8, 0, 0, 8 * k, 8 * k);
            g.drawImage(img, 40, 8, 8, 8, 0, 0, 8 * k, 8 * k);
        } else {
            c.width = 136; c.height = 272;
            drawPlayer(c, { yaw: +yaw || 0 });
        }
        const url = c.toDataURL('image/png');
        skinCache.set(key, url);
        return url;
    }

    function clear() { state.items = {}; state.blocks = {}; state.icons = {}; state.kinds = {}; state.texNames = { items: {}, blocks: {} }; state.source = ''; persist(); }

    /* ───────────── picker ───────────── */

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** Block textures that are not items of their own (sides, tops, growth stages, …) */
    const BLOCK_PART_RE = /_(top|bottom|side|sides|front|back|end|inner|outer|overlay|on|off|lit|unlit|particle|base|corner|flow|still|moist|pivot|cross|pole|mouth|eye|lock|open|closed|tip|tip_merge|frustum|middle|stalk|stem|bulb|occupied|empty|honey|powered|active|inactive|crafting|ejecting|ominous|dust_[a-z]+|line\d*|stage\d+|\d+)$/;

    /** Every item / block name the picker can show: { items: [...], blocks: [...] } (sorted) */
    function catalog() {
        restore();
        const items = new Set(), blocks = new Set();
        // every item id the game has, sorted into items / blocks like the creative tabs
        Object.keys(state.icons).forEach(n => (state.kinds[n] === 'block' ? blocks : items).add(n));
        Object.keys(state.items).forEach(n => {
            const m = /^(.*)_\d\d$/.exec(n);           // compass_00 … → compass
            const id = m && !state.items[m[1]] ? m[1] : n;
            if (!blocks.has(id)) items.add(id);
        });
        if (!Object.keys(state.icons).length) {
            // textures only (old way): block textures, without the parts of models (bed_feet, …_top)
            Object.keys(state.blocks).filter(b => !items.has(b) && !BLOCK_PART_RE.test(b)).forEach(b => blocks.add(b));
        }
        return { items: [...items].filter(n => !/_\d\d$/.test(n) || !items.has(n.replace(/_\d\d$/, ''))).sort(), blocks: [...blocks].sort() };
    }

    const cell = (n) => `<button class="gsi-cell" data-item="minecraft:${n}" title="minecraft:${n}"><img src="${url(n)}" alt="" loading="lazy"><span>${esc(n)}</span></button>`;

    /** Grid of every item (no limit), filtered by the search text and the tab */
    function gridHtml(q, tab) {
        const s = String(q || '').trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');
        const cat = catalog();
        const hit = (n) => !s || n.includes(s);
        const its = cat.items.filter(hit), bls = cat.blocks.filter(hit);
        const slots = SLOTS.filter(([id, l]) => !s || id.includes(s) || l.toLowerCase().includes(s));
        const t = tab || 'all';
        let h = '';
        if ((t === 'all' || t === 'worn') && slots.length) {
            h += `<div class="gsi-head">What the player wears / holds <em>Java only</em></div>`;
            h += slots.map(([id, l]) => `<button class="gsi-cell slot" data-item="${id}" title="${esc(l)} — Java only"><span>${esc(l)}</span></button>`).join('');
        }
        if ((t === 'all' || t === 'items') && its.length) h += `<div class="gsi-head">Items <em>${its.length}</em></div>` + its.map(cell).join('');
        if ((t === 'all' || t === 'blocks') && bls.length) h += `<div class="gsi-head">Blocks <em>${bls.length}</em></div>` + bls.map(cell).join('');
        if (!cat.items.length && !cat.blocks.length) {
            h += '<div class="gs-hint gsi-empty">No item pictures yet. Press <b>Download Minecraft assets</b> (from Mojang, ~40 MB once), or load them from your Minecraft client <code>.jar</code> (<code>%APPDATA%\\.minecraft\\versions\\&lt;version&gt;\\&lt;version&gt;.jar</code>) or a resource pack — they stay on this computer. You can still type an id below.</div>';
        } else if (!h) h = `<div class="gs-hint gsi-empty">Nothing matches "${esc(q)}".</div>`;
        return h;
    }

    function srcText() {
        if (!count()) return 'Pictures: none loaded';
        const flat = !Object.keys(state.icons).length && Object.keys(state.blocks).length;
        const stale = Object.keys(state.icons).length && GS.McRender && state.iconVer !== GS.McRender.VERSION;
        return `${count()} pictures · from ${state.source}` + (flat ? ' · blocks are flat: press Download Minecraft assets again to get them in 3D like the inventory'
            : stale ? ' · drawn by an older version: press Download Minecraft assets again to draw them right' : '');
    }

    /** Opens the item picker; resolves to an item id or null */
    function pick(current) {
        return GS.modal('Choose an item', `
            <div class="gsi">
              <div class="gsi-top">
                <input type="text" class="gsi-search" placeholder="Search (diamond, sword, apple…)" spellcheck="false">
                <div class="gsi-tabs"><button class="active" data-tab="all">All</button><button data-tab="items">Items</button><button data-tab="blocks">Blocks</button><button data-tab="worn">Worn</button></div>
                <button class="primary-btn" data-load="mojang">Download Minecraft assets</button>
                <button class="ghost-btn" data-load="file">Load from .jar / .zip…</button>
                <button class="ghost-btn" data-load="dir">From pack folder…</button>
              </div>
              <div class="gs-hint gsi-src">${esc(srcText())}</div>
              <div class="gsi-grid">${gridHtml('', 'all')}</div>
              <div class="gs-field wide"><label>Or type an id</label><input type="text" class="gsi-id" value="${esc(current || '')}" placeholder="minecraft:diamond_sword · itemsadder:namespace:id · nexo:id" spellcheck="false"></div>
              <input type="file" class="gsi-file" accept=".jar,.zip" hidden><input type="file" class="gsi-dir" webkitdirectory hidden>
            </div>`, [['cancel', 'Cancel'], ['ok', 'Use this id', 'primary']], {
            cls: 'xwide',
            onOpen: (root, done) => {
                const search = root.querySelector('.gsi-search'), grid = root.querySelector('.gsi-grid');
                let tab = 'all';
                root.querySelector('.gsi-tabs').addEventListener('click', (e) => {
                    const b = e.target.closest('[data-tab]');
                    if (!b) return;
                    tab = b.dataset.tab;
                    root.querySelectorAll('.gsi-tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
                    refresh();
                });
                const refresh = () => { grid.innerHTML = gridHtml(search.value, tab); grid.scrollTop = 0; root.querySelector('.gsi-src').textContent = srcText(); };
                search.addEventListener('input', refresh);
                grid.addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (b) done({ button: 'pick', id: b.dataset.item }); });
                const load = async (input, label) => {
                    try {
                        const src = root.querySelector('.gsi-src');
                        src.textContent = 'Reading the pictures…';
                        const n = await loadFiles(input.files, label, (t) => { src.textContent = t; });
                        GS.toast && GS.toast(`Loaded ${n} item pictures`, 'ok');
                        refresh();
                    } catch (err) { GS.toast && GS.toast(err.message, 'error'); }
                };
                const fi = root.querySelector('.gsi-file'), di = root.querySelector('.gsi-dir');
                fi.addEventListener('change', () => load(fi, fi.files[0] && fi.files[0].name));
                di.addEventListener('change', () => load(di, di.files[0] && String(di.files[0].webkitRelativePath).split('/')[0]));
                root.querySelector('[data-load="file"]').addEventListener('click', () => { fi.value = ''; fi.click(); });
                root.querySelector('[data-load="dir"]').addEventListener('click', () => { di.value = ''; di.click(); });
                root.querySelector('[data-load="mojang"]').addEventListener('click', async () => {
                    const src = root.querySelector('.gsi-src');
                    try {
                        const r = await downloadVanilla((t) => { src.textContent = t; });
                        GS.toast && GS.toast(`Minecraft ${r.version}: ${r.n} item pictures ready`, 'ok');
                        refresh();
                    } catch (err) { src.textContent = 'Could not download: ' + err.message; }
                });
                search.focus();
            }
        }).then(r => {
            if (!r) return null;
            if (r.button === 'pick') return r.id;
            if (r.button === 'ok') { const v = r.root.querySelector('.gsi-id').value.trim(); return v || null; }
            return null;
        });
    }

    GS.Items = { SLOTS, BEDROCK_NAMES, catalog, url, bedrockTexture, vanillaName, isSlot, count, loadFiles, clear, pick, zipEntries, downloadVanilla, downloadDialog, skinArt, skinImage, drawPlayer, source: () => (restore(), state.source) };
})();
