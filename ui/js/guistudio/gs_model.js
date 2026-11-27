/* ========================================
   GUI Studio — data model, undo and backend
   A GUI project is separate from HUD projects: it has its own file format
   (kind "kaizer-gui"), its own folder (%APPDATA%\...\gui_projects) and its
   own Rust commands (gui_*). Nothing here touches the HUD editor's App.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};

    const ID_RE = /^[a-z0-9_]{1,32}$/;
    // new pages: 640 × 360 (the size the user works at)
    const DEFAULT_W = 640;
    const DEFAULT_H = 360;
    const MAX_SIDE = 960;

    function uid(prefix) {
        return (prefix || 'e') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    }

    const TYPES = ['image', 'button', 'text', 'player_head', 'player_model', 'item', 'custom_model', 'input', 'roulette', 'scroll_area'];
    const isPlayer = (e) => !!e && (e.type === 'player_head' || e.type === 'player_model');
    /** [a, b] numbers, or null (= worked out from the size) */
    function pair(v) {
        if (!Array.isArray(v) || v.length < 2) return null;
        const a = Number(v[0]), b = Number(v[1]);
        return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
    }
    /** true when the head / model shows the player who opened the menu (Bedrock can only draw that one) */
    function showsViewer(e) {
        const s = String(e.player == null ? '%player_name%' : e.player).trim().toLowerCase();
        return s === '' || s === '%player_name%' || s === '%player%';
    }
    /**
     * Bedrock paper doll box of a head (like the HUD: doll 75×205 at 1, 18 inside a 35×31 clip),
     * scaled to the element; a model shows the whole doll in its box.
     */
    /**
     * Bedrock paper doll box. The renderer draws the player at about 3/4 of its height, feet on the
     * bottom (measured in game, camera tilt −10°): the box is made taller by 1/0.75 and moved up (plus 5.5%) so the
     * player fills the element like the picture in GUI Studio, feet on its bottom edge.
     */
    const DOLL_FILL = 0.75;
    const DOLL_LIFT = 0.055;   // the feet still came out ~5% of the height below the box (camera tilt): lift that much
    function dollBox(e) {
        const r1 = (v) => Math.round(v * 10) / 10;
        if (e.type === 'player_model') {
            const h = e.h / DOLL_FILL;
            return { size: e.dollSize || [r1(e.w / DOLL_FILL), r1(h)], offset: e.dollOffset || [0, r1(-(h - e.h) / 2 - e.h * DOLL_LIFT)] };
        }
        const k = Math.min(e.w / 35, e.h / 31);
        return { size: e.dollSize || [r1(75 * k), r1(205 * k)], offset: e.dollOffset || [r1(1 * k), r1(18 * k)] };
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function int(v, def) { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : def; }
    function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

    /** a-z 0-9 _ only, from any text */
    function slug(s, fallback) {
        const out = String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
        return out || fallback || 'menu';
    }

    function newMenu(id, title) {
        return {
            id: id || 'main',
            title: title || 'Main Menu',
            command: '',
            width: DEFAULT_W,
            height: DEFAULT_H,
            refreshTicks: 20,
            openSound: '',
            // Java: size the menu to (almost) the whole screen and dim everything around it
            fullscreen: true,
            backdrop: '#000000',
            backdropAlpha: 0.6,
            bedrockBackdrop: false,
            prevPage: '',
            nextPage: '',
            // opening + cascade animation (GS.Motion presets)
            motion: GS.Motion.defaults(),
            elements: []
        };
    }

    function newProject() {
        return {
            kind: 'kaizer-gui',
            version: 1,
            namespace: 'kaizerui',
            menus: [newMenu('main', 'Main Menu')],
            images: {},
            cursor: { image: null, height: 12, hotX: 0, hotY: 0 },
            settings: {
                cameraLock: true,
                distance: 1.2,
                fill: 0.85,
                sensitivity: 1.0,
                clickSound: 'minecraft:ui.button.click',
                hoverSound: 'minecraft:block.note_block.hat',
                exitOnSneak: true,
                // where the Java resource pack goes: itemsadder | nexo | oraxen | zip
                packHost: 'itemsadder'
            },
            packUuids: null,
            packVersion: 0
        };
    }

    function newElement(type, menu) {
        const base = { id: uid(type[0]), type, name: '', x: 0, y: 0, w: 32, h: 16, hidden: false, locked: false, scrollGroup: '', motion: GS.Motion.elementDefaults(type) };
        if (type === 'image') {
            // frames: more pictures after `image` that play as an animation, fps frames a second
            Object.assign(base, { w: 64, h: 64, image: null, frames: [], fps: 8 });
        } else if (type === 'button') {
            Object.assign(base, {
                w: 80, h: 20, image: null, hoverImage: null, frames: [], fps: 8,
                label: 'Button', labelColor: '#ffffff', labelScale: 1, labelShadow: true,
                actions: ['message:&aYou clicked a button!'],
                closeOnClick: false, hoverSound: '', tooltip: ''
            });
        } else if (type === 'text') {
            Object.assign(base, { w: 120, h: 12, text: 'Hello %player_name%', color: '#ffffff', scale: 1, shadow: true, align: 'center' });
        } else if (type === 'player_head' || type === 'player_model') {
            // same idea as the HUD's Player Head: Bedrock = the game's paper doll (only the player
            // looking at the menu), Java = KaizerUI draws the skin. player = whose skin (PAPI ok).
            const head = type === 'player_head';
            Object.assign(base, { w: 32, h: head ? 32 : 64, player: '%player_name%', hat: true, dollSize: null, dollOffset: null, tooltip: '' });
            // model on Java: a real 3D player (Mannequin, 1.21.9+) wearing the player's armour,
            // turning as set; flat = the skin drawn as pixels like the head
            if (!head) Object.assign(base, { java3d: true, outfit: 'own', pose: 'standing', turn: 'none', angle: 20, spinSpeed: 45, bedrockRenderer: 'auto' });
        } else if (type === 'item') {
            // a Minecraft item: Java = the real item (ItemDisplay), Bedrock = the game's texture
            Object.assign(base, { w: 24, h: 24, item: 'minecraft:diamond_sword', glint: false, look: 'flat', spin: false, bedrockTexture: '', tooltip: '' });
        } else if (type === 'custom_model') {
            // a 3D animated model from ModelEngine 4 / BetterModel on Java, auto-rendered icon on Bedrock
            Object.assign(base, {
                w: 48, h: 64, modelId: 'meg:dragon', animation: 'idle',
                scale3d: 1, angle: 20, spin: false, spinSpeed: 45,
                hitboxW: 1, hitboxH: 2, bedrockTexture: '', tooltip: ''
            });
        } else if (type === 'input') {
            // interactive input box: Java = chat prompt + hologram refresh, Bedrock = Cumulus CustomForm
            Object.assign(base, {
                w: 96, h: 20, varName: 'qty', inputType: 'number', defaultValue: '1',
                min: 1, max: 64, step: 1, prefix: 'Qty: ', suffix: '',
                promptTitle: 'Enter amount', placeholder: 'Type value...',
                textColor: '#ffffff', bgColor: '#161b26', borderColor: '#52a0f0',
                scale: 1, shadow: true, align: 'center', actions: [], tooltip: ''
            });
        } else if (type === 'roulette') {
            // CS:GO crate roller with weighted rewards and selectable spin animations
            Object.assign(base, {
                w: 260, h: 56, slotSize: 44, slotGap: 6, durationSec: 4.2, spinStyle: 'csgo',
                reels: 3, cardCount: 5,
                bgColor: '#0d111a', borderColor: '#e5a43a', pointerColor: '#ff4d4f',
                tickSound: 'minecraft:block.note_block.hat;0.7;1.4',
                winSound: 'minecraft:entity.player.levelup;1.0;1.1',
                tooltip: '',
                rewards: [
                    { id: 'r1', name: 'Iron Ingot', item: 'minecraft:iron_ingot', color: '#9ca3af', weight: 45, actions: ['console:give %player_name% iron_ingot 16', 'message:&7You won &fIron Ingot x16&7!'] },
                    { id: 'r2', name: 'Golden Apple', item: 'minecraft:golden_apple', color: '#22c55e', weight: 28, actions: ['console:give %player_name% golden_apple 4', 'message:&aYou won &eGolden Apple x4&a!'] },
                    { id: 'r3', name: 'Diamond Sword', item: 'minecraft:diamond_sword', color: '#3b82f6', weight: 15, actions: ['console:give %player_name% diamond_sword 1', 'message:&bYou won &bDiamond Sword&b!'] },
                    { id: 'r4', name: 'Undying Totem', item: 'minecraft:totem_of_undying', color: '#a855f7', weight: 8, actions: ['console:give %player_name% totem_of_undying 1', 'message:&dYou won &dTotem of Undying&d!'] },
                    { id: 'r5', name: 'Netherite Blade', item: 'minecraft:netherite_sword', color: '#f59e0b', weight: 4, actions: ['console:give %player_name% netherite_sword 1', 'message:&6&lLEGENDARY! &eYou won Netherite Blade!'] }
                ]
            });
        } else if (type === 'scroll_area') {
            // Scrollable / 2D Pannable viewport container inside a menu
            Object.assign(base, {
                w: 360, h: 200, scrollMode: 'pan2d', contentW: 720, contentH: 480,
                stepPx: 28, bgColor: '#0e131f', borderColor: '#3a8ee6', showScrollbar: true, tooltip: ''
            });
        }
        if (menu) {
            base.x = Math.max(0, Math.round((menu.width - base.w) / 2));
            base.y = Math.max(0, Math.round((menu.height - base.h) / 2));
            base.name = defaultName(type, menu);
        }
        return base;
    }

    function defaultName(type, menu) {
        const label = { image: 'Image', button: 'Button', text: 'Text', player_head: 'Player Head', player_model: 'Player Model', item: 'Item', custom_model: '3D Model', input: 'Input', roulette: 'Crate Roulette', scroll_area: 'Scroll / Map Area' }[type] || 'Element';
        let n = 1;
        const names = new Set(menu.elements.map(e => e.name));
        while (names.has(`${label} ${n}`)) n++;
        return `${label} ${n}`;
    }

    /** Fills missing fields of a loaded project so older files keep working */
    function normalize(p) {
        const d = newProject();
        p = p && typeof p === 'object' ? p : {};
        const out = Object.assign(d, p);
        out.kind = 'kaizer-gui';
        out.namespace = slug(out.namespace, 'kaizerui');
        out.images = out.images && typeof out.images === 'object' ? out.images : {};
        out.cursor = Object.assign(newProject().cursor, out.cursor || {});
        out.settings = Object.assign(newProject().settings, out.settings || {});
        if (!Array.isArray(out.menus) || !out.menus.length) out.menus = [newMenu()];
        out.menus = out.menus.map(m => {
            const mm = Object.assign(newMenu(), m);
            mm.id = slug(mm.id, 'menu');
            mm.width = clamp(int(mm.width, DEFAULT_W), 16, MAX_SIDE);
            mm.height = clamp(int(mm.height, DEFAULT_H), 16, MAX_SIDE);
            mm.prevPage = String(mm.prevPage || '');
            mm.nextPage = String(mm.nextPage || '');
            mm.motion = Object.assign(GS.Motion.defaults(), mm.motion || {});
            mm.elements = (Array.isArray(mm.elements) ? mm.elements : []).filter(e => e && TYPES.includes(e.type))
                .map(e => {
                    const ee = Object.assign(newElement(e.type), e);
                    ee.id = ee.id || uid(e.type[0]);
                    if (ee.type === 'button' && !Array.isArray(ee.actions)) ee.actions = [];
                    if (['button', 'item', 'player_head', 'player_model', 'custom_model', 'input', 'roulette', 'scroll_area'].includes(ee.type)) {
                        ee.tooltip = String(ee.tooltip || '');
                    }
                    ee.scrollGroup = ee.type === 'scroll_area' ? '' : String(ee.scrollGroup || '');
                    ee.locked = !!ee.locked;
                    ee.motion = Object.assign(GS.Motion.elementDefaults(ee.type), e.motion || {});
                    if (isPlayer(ee)) {
                        ee.player = String(ee.player == null ? '%player_name%' : ee.player);
                        ee.hat = ee.hat !== false;
                        ee.dollSize = pair(ee.dollSize);
                        ee.dollOffset = pair(ee.dollOffset);
                        if (ee.type === 'player_model') {
                            ee.java3d = ee.java3d !== false;
                            ee.outfit = ['own', 'none'].includes(ee.outfit) ? ee.outfit : 'own';
                            ee.pose = ['standing', 'crouching'].includes(ee.pose) ? ee.pose : 'standing';
                            ee.turn = ['none', 'spin', 'cursor', 'mouse', 'drag'].includes(ee.turn) ? ee.turn : 'none';
                            ee.angle = num(ee.angle, 0);
                            ee.spinSpeed = clamp(num(ee.spinSpeed, 45), 1, 720);
                            ee.bedrockRenderer = ['auto', 'live', 'doll'].includes(ee.bedrockRenderer) ? ee.bedrockRenderer : 'auto';
                        }
                    } else if (ee.type === 'item') {
                        ee.item = String(ee.item || '');
                        ee.glint = !!ee.glint;
                        ee.look = ee.look === '3d' ? '3d' : 'flat';
                        ee.spin = !!ee.spin;
                        ee.bedrockTexture = String(ee.bedrockTexture || '');
                    } else if (ee.type === 'custom_model') {
                        ee.modelId = String(ee.modelId || '');
                        ee.animation = String(ee.animation || 'idle');
                        ee.scale3d = clamp(num(ee.scale3d, 1), 0.1, 10);
                        ee.angle = num(ee.angle, 20);
                        ee.spin = !!ee.spin;
                        ee.spinSpeed = clamp(num(ee.spinSpeed, 45), 1, 720);
                        ee.hitboxW = clamp(num(ee.hitboxW, 1), 0.2, 8);
                        ee.hitboxH = clamp(num(ee.hitboxH, 2), 0.2, 8);
                        ee.bedrockTexture = String(ee.bedrockTexture || '');
                    } else if (ee.type === 'input') {
                        ee.varName = String(ee.varName || 'qty').trim();
                        ee.inputType = ['number', 'text', 'slider'].includes(ee.inputType) ? ee.inputType : 'number';
                        ee.defaultValue = String(ee.defaultValue == null ? '1' : ee.defaultValue);
                        ee.min = num(ee.min, 1);
                        ee.max = num(ee.max, 64);
                        ee.step = Math.max(0.01, num(ee.step, 1));
                        ee.prefix = String(ee.prefix == null ? '' : ee.prefix);
                        ee.suffix = String(ee.suffix == null ? '' : ee.suffix);
                        ee.promptTitle = String(ee.promptTitle || 'Enter value');
                        ee.placeholder = String(ee.placeholder || 'Type value...');
                        ee.textColor = String(ee.textColor || '#ffffff');
                        ee.bgColor = String(ee.bgColor || '#161b26');
                        ee.borderColor = String(ee.borderColor || '#52a0f0');
                        ee.scale = Math.max(0.25, num(ee.scale, 1));
                        ee.shadow = ee.shadow !== false;
                        ee.align = ['left', 'center', 'right'].includes(ee.align) ? ee.align : 'center';
                        ee.actions = Array.isArray(ee.actions) ? ee.actions.filter(Boolean) : [];
                    } else if (ee.type === 'roulette') {
                        ee.slotSize = clamp(int(ee.slotSize, 44), 16, 128);
                        ee.slotGap = clamp(int(ee.slotGap, 6), 0, 32);
                        ee.durationSec = clamp(num(ee.durationSec, 4.2), 1, 15);
                        ee.spinStyle = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(ee.spinStyle) ? ee.spinStyle : 'csgo';
                        ee.reels = clamp(int(ee.reels, 3), 1, 5);
                        ee.cardCount = clamp(int(ee.cardCount, 5), 3, 9);
                        ee.bgColor = String(ee.bgColor || '#0d111a');
                        ee.borderColor = String(ee.borderColor || '#e5a43a');
                        ee.pointerColor = String(ee.pointerColor || '#ff4d4f');
                        ee.tickSound = String(ee.tickSound || 'minecraft:block.note_block.hat;0.7;1.4');
                        ee.winSound = String(ee.winSound || 'minecraft:entity.player.levelup;1.0;1.1');
                        const defRewards = newElement('roulette').rewards;
                        const srcR = Array.isArray(ee.rewards) && ee.rewards.length ? ee.rewards : defRewards;
                        ee.rewards = srcR.map((r, idx) => ({
                            id: String((r && r.id) || ('r' + (idx + 1))),
                            name: String((r && r.name) || 'Reward'),
                            item: String((r && r.item) || 'minecraft:diamond'),
                            color: String((r && r.color) || '#3b82f6'),
                            weight: Math.max(0.01, num(r && r.weight, 10)),
                            actions: Array.isArray(r && r.actions) ? r.actions.filter(Boolean).map(String) : []
                        }));
                    } else if (ee.type === 'scroll_area') {
                        ee.scrollMode = ['vertical', 'horizontal', 'pan2d'].includes(ee.scrollMode) ? ee.scrollMode : 'pan2d';
                        ee.w = Math.max(16, int(ee.w, 360));
                        ee.h = Math.max(16, int(ee.h, 200));
                        ee.contentW = Math.max(ee.w, int(ee.contentW, Math.max(ee.w, 720)));
                        ee.contentH = Math.max(ee.h, int(ee.contentH, Math.max(ee.h, 480)));
                        ee.stepPx = clamp(int(ee.stepPx, 28), 4, 200);
                        ee.bgColor = String(ee.bgColor || '#0e131f');
                        ee.borderColor = String(ee.borderColor || '#3a8ee6');
                        ee.showScrollbar = ee.showScrollbar !== false;
                    } else if (ee.type !== 'text') {
                        ee.detail = [1, 2, 4, 8].includes(Number(ee.detail)) ? Number(ee.detail) : 1;
                        ee.frames = Array.isArray(ee.frames) ? ee.frames.filter(Boolean) : [];
                        ee.fps = clamp(num(ee.fps, 8), 1, 20);
                    }
                    return ee;
                });
            return mm;
        });
        return out;
    }

    /** Problems that would break the export or the plugin: [{level, menu, element, msg}] */
    function validate(p) {
        const out = [];
        if (!ID_RE.test(p.namespace)) out.push({ level: 'error', msg: 'Namespace must use a-z, 0-9 and _ only' });
        const ids = new Set();
        // pages that open from each other should look the same: full screen on all, or on none
        const fsOn = p.menus.filter(m => m.fullscreen).length;
        if (fsOn && fsOn < p.menus.length) {
            p.menus.filter(m => !m.fullscreen).forEach(m => out.push({ level: 'warn', menu: m.id, msg: `Menu "${m.title || m.id}" is not full screen but ${fsOn} other page${fsOn > 1 ? 's are' : ' is'} — tick Full screen on it so they all match` }));
        }
        p.menus.forEach(m => {
            if (!ID_RE.test(m.id)) out.push({ level: 'error', menu: m.id, msg: `Menu id "${m.id}" must use a-z, 0-9 and _ only` });
            if (ids.has(m.id)) out.push({ level: 'error', menu: m.id, msg: `Two menus have the id "${m.id}"` });
            ids.add(m.id);
            if (m.command && !/^[a-z0-9_\-]{1,32}$/i.test(m.command)) out.push({ level: 'error', menu: m.id, msg: `Command "${m.command}" must be one word (a-z, 0-9, _ -)` });
            if (m.prevPage && !p.menus.some(mm => mm.id === m.prevPage)) out.push({ level: 'warn', menu: m.id, msg: `Menu "${m.id}": prevPage "${m.prevPage}" does not exist` });
            if (m.nextPage && !p.menus.some(mm => mm.id === m.nextPage)) out.push({ level: 'warn', menu: m.id, msg: `Menu "${m.id}": nextPage "${m.nextPage}" does not exist` });
            if (!m.elements.length) out.push({ level: 'warn', menu: m.id, msg: `Menu "${m.id}" is empty` });
            m.elements.forEach(e => {
                const where = `${m.id} › ${e.name || e.id}`;
                if (e.type === 'image' && !p.images[e.image]) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: no picture chosen (skipped)` });
                if ((e.frames || []).some(f => !p.images[f])) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: an animation frame picture is missing (skipped)` });
                if ((e.frames || []).length && e.w * e.h * ((e.frames || []).length + 1) > 2000000) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: many large frames make the Java pack big — fewer frames or a smaller picture loads faster` });
                if ((e.detail || 1) > 1 && (e.type === 'image' || e.type === 'button')) {
                    // a glyph is at most 256 picture px: finer pictures are cut into more pieces (one entity each in game)
                    const max = Math.max(2, Math.floor(256 / e.detail)) - 1;
                    const pieces = Math.ceil(e.w / max) * Math.ceil(e.h / max);
                    if (pieces > 6) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: Detail ${e.detail}× cuts this ${e.w}×${e.h} picture into ${pieces} pieces on Java — use 1× or 2× for big backgrounds` });
                }
                if (e.type === 'item' && !String(e.item || '').trim()) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: no item chosen (skipped)` });
                if (e.type === 'item' && String(e.item || '').trim() && GS.Items && !GS.Items.isDynamic(e.item) && !GS.Items.bedrockTexture(e)) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: Bedrock cannot show "${e.item}" (import Plugin Packs or set a Bedrock texture to show a picture there)` });
                if (e.type === 'custom_model' && !String(e.modelId || '').trim()) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: no 3D model id set (skipped)` });
                if (e.type === 'input' && !String(e.varName || '').trim()) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: input variable name is empty` });
                if (e.type === 'roulette' && !(Array.isArray(e.rewards) && e.rewards.length)) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: roulette has no rewards configured` });
                if (isPlayer(e) && !String(e.player || '').trim()) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: no player set — the player who opens the menu is shown` });
                if (e.w < 1 || e.h < 1) out.push({ level: 'error', menu: m.id, element: e.id, msg: `${where}: size must be at least 1×1` });
                if (e.type === 'button' || e.type === 'input') {
                    (e.actions || []).forEach(a => {
                        const m2 = /^open:([^?]+)/.exec(String(a).trim());
                        if (m2 && !/\{[^}]+\}/.test(m2[1]) && !p.menus.some(mm => mm.id === m2[1].trim())) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${where}: opens menu "${m2[1].trim()}" which does not exist` });
                    });
                }
            });
        });
        return out;
    }

    /* ───────────── images ───────────── */

    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = () => reject(new Error('Could not read ' + file.name));
            fr.onload = () => {
                const img = new Image();
                img.onload = () => resolve({ name: file.name, data: fr.result, w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => reject(new Error(file.name + ' is not a picture'));
                img.src = fr.result;
            };
            fr.readAsDataURL(file);
        });
    }

    /** Adds a picture to the project (same data = same id) and returns its id */
    function addImage(p, info) {
        for (const [id, im] of Object.entries(p.images)) {
            if (im.data === info.data) return id;
        }
        const base = slug(String(info.name || 'image').replace(/\.[a-z0-9]+$/i, ''), 'image');
        let id = base, n = 2;
        while (p.images[id]) id = `${base}_${n++}`;
        // res = picture pixels per GUI pixel (studio-made smooth pictures are drawn 2–8× finer)
        p.images[id] = { name: info.name, data: info.data, w: info.w, h: info.h, res: Math.max(1, info.res | 0 || 1) };
        return id;
    }

    /** Pictures no element or the cursor uses any more */
    /** Size in GUI px of a picture drawn with `detail` picture pixels per GUI pixel */
    function imageGuiSize(im, detail) {
        const d = Math.max(1, Number(detail) || (im && im.res) || 1);
        return { w: Math.max(1, Math.round(im.w / d)), h: Math.max(1, Math.round(im.h / d)) };
    }

    function pruneImages(p) {
        const used = new Set();
        if (p.cursor.image) used.add(p.cursor.image);
        p.menus.forEach(m => m.elements.forEach(e => {
            if (e.image) used.add(e.image);
            if (e.hoverImage) used.add(e.hoverImage);
            (e.frames || []).forEach(f => used.add(f));
        }));
        Object.keys(p.images).forEach(id => { if (!used.has(id)) delete p.images[id]; });
    }

    /* ───────────── undo (structure only; pictures are kept by id) ───────────── */

    class History {
        constructor(limit) { this.limit = limit || 100; this.undoStack = []; this.redoStack = []; }
        static snap(p) { return JSON.stringify({ namespace: p.namespace, menus: p.menus, cursor: p.cursor, settings: p.settings }); }
        push(p) {
            const s = History.snap(p);
            if (this.undoStack[this.undoStack.length - 1] === s) return;
            this.undoStack.push(s);
            if (this.undoStack.length > this.limit) this.undoStack.shift();
            this.redoStack = [];
        }
        apply(p, s) { Object.assign(p, JSON.parse(s)); }
        undo(p) {
            if (!this.undoStack.length) return false;
            this.redoStack.push(History.snap(p));
            this.apply(p, this.undoStack.pop());
            return true;
        }
        redo(p) {
            if (!this.redoStack.length) return false;
            this.undoStack.push(History.snap(p));
            this.apply(p, this.redoStack.pop());
            return true;
        }
        clear() { this.undoStack = []; this.redoStack = []; }
    }

    /* ───────────── backend: Rust (gui_* commands) or browser storage for testing ───────────── */

    function tauri() { return window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__ : null; }

    function invoke(cmd, args) {
        const T = tauri();
        if (!T) return Promise.reject(new Error('Desktop backend is not available'));
        return T.core.invoke(cmd, args || {}).catch(err => {
            throw new Error(typeof err === 'string' ? err : (err && err.message) || 'Unknown error');
        });
    }

    const LS_KEY = 'kz_gui_projects_dev';
    const localStore = {
        all() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; } },
        put(all) { localStorage.setItem(LS_KEY, JSON.stringify(all)); }
    };

    const Backend = {
        native: () => !!tauri(),
        list() {
            if (tauri()) return invoke('gui_list_projects');
            return Promise.resolve(Object.values(localStore.all()).map(p => ({ _id: p._id, name: p.name, updatedAt: p.updatedAt }))
                .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        },
        get(id) {
            if (tauri()) return invoke('gui_get_project', { id });
            const p = localStore.all()[id];
            return p ? Promise.resolve(p) : Promise.reject(new Error('Project not found'));
        },
        create(name, data) {
            if (tauri()) return invoke('gui_create_project', { name, data });
            const all = localStore.all();
            const id = 'dev' + Date.now().toString(36);
            all[id] = { _id: id, name, data, updatedAt: new Date().toISOString() };
            localStore.put(all);
            return Promise.resolve({ projectId: id });
        },
        update(id, name, data) {
            if (tauri()) return invoke('gui_update_project', { id, name, data });
            const all = localStore.all();
            if (!all[id]) return Promise.reject(new Error('Project not found'));
            all[id] = { _id: id, name, data, updatedAt: new Date().toISOString() };
            localStore.put(all);
            return Promise.resolve({});
        },
        remove(id) {
            if (tauri()) return invoke('gui_delete_project', { id });
            const all = localStore.all(); delete all[id]; localStore.put(all);
            return Promise.resolve({});
        },
        openFolder() { return invoke('gui_open_projects_folder'); },
        /** export = { root: [files], javaPack: [files], bedrockPack: [files], javaPackName, bedrockPackPath, fileName } */
        exportZip(payload) { return invoke('gui_export', { payload }); }
    };

    GS.Model = { TYPES, isPlayer, showsViewer, dollBox, ID_RE, DEFAULT_W, DEFAULT_H, MAX_SIDE, uid, clamp, int, num, slug, newMenu, newProject, newElement, normalize, validate, readImageFile, addImage, imageGuiSize, pruneImages, History };
    GS.Backend = Backend;
})();
