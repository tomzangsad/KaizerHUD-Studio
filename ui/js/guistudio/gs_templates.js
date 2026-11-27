/* ========================================
   GUI Studio — menu templates
   Pixel art drawn in code at 1 GUI px = 1 texture px (same rules as HUD Forge:
   hand-picked 6-shade ramps, light from the top-left, selective outlines,
   1 px drop shadow, no gradients / noise). Colour kits are copied from
   hudforge_themes.js so menus match the HUDs, but nothing here loads HUD code.
   ======================================== */
(function () {
    'use strict';

    const GS = window.GS = window.GS || {};

    /* ───────────── palettes (6 shades: outline, dark2, dark, base, light, highlight) ───────────── */
    const M = {
        gold: ['#3d1f0a', '#7a4310', '#b86d1c', '#e5a43a', '#f8d26a', '#fff4bf'],
        iron: ['#14161c', '#2e333d', '#4d5563', '#7a8494', '#aab3c1', '#e0e6ee'],
        bronze: ['#1a0a06', '#3d1a0e', '#6b2c14', '#a3461c', '#d9702c', '#ffb060'],
        oak: ['#2a1608', '#5a3414', '#875221', '#b07737', '#d39e56', '#f0c98a'],
        frost: ['#10202e', '#2a4258', '#4f708c', '#7fa3bf', '#b5d3e8', '#eaf7ff'],
        amethyst: ['#1a1024', '#3a2a50', '#5e4a7e', '#8a76ae', '#b8a8d8', '#e8e0ff'],
        steel: ['#0a0f18', '#1c2636', '#2e3d52', '#45597a', '#6b84a6', '#9fb8d6'],
        grey: ['#121417', '#25292f', '#3a4048', '#565e69', '#7b8592', '#aab3bf'],
        white: ['#3a3f47', '#7a828e', '#a9b1bc', '#d0d6de', '#eef1f5', '#ffffff'],
        stone: ['#141414', '#373737', '#555555', '#8b8b8b', '#c6c6c6', '#ffffff'],
        netherbrick: ['#1a0606', '#3a0e0e', '#5c1818', '#7f2626', '#a33a3a', '#c95656'],
        cyan: ['#03222e', '#06495e', '#0a7a96', '#16a9cc', '#4fd6f0', '#b2f3ff'],
        leaf: ['#0e2410', '#1f4a1c', '#2f6e28', '#47963a', '#6fbf55', '#a6e283'],
        pink: ['#5a1636', '#9c2f5f', '#d6568c', '#f28bb3', '#ffbdd6', '#ffe6f0'],
        verdigris: ['#0a1e1a', '#1a3c34', '#2a5e50', '#3f8470', '#62ac94', '#a4dcc8'],
        skin: ['#3a1e10', '#7a4226', '#b06a40', '#d99a6c', '#f0c49a', '#ffe6cc'],
        leather: ['#1e0e06', '#43220e', '#6a3a18', '#8e5426', '#b47238', '#d89a5a'],
    };
    const PLATE = {
        navy: ['#0b0d1f', '#151a3a', '#1e2752', '#2a3670', '#3a4a8e', '#5466b0'],
        darkwood: ['#160c07', '#2e1a10', '#45281a', '#5c3824', '#764a30', '#8f5e3f'],
        obsidian: ['#07060a', '#151219', '#221d28', '#312a3a', '#463c52', '#5f526e'],
        moss: ['#10200c', '#1d3a16', '#29501f', '#356628', '#457f33', '#5a9a43'],
        ice: ['#0a1c2c', '#123049', '#1b4566', '#255c85', '#3576a6', '#4d93c6'],
        violet: ['#12061e', '#2a0f45', '#43186b', '#5e2794', '#7f3fbd', '#a466e0'],
        slate: ['#05080e', '#0c121d', '#131c2b', '#1b273b', '#25354f', '#334766'],
        charcoal: ['#0c0d10', '#16181c', '#1f2227', '#2a2e35', '#383d46', '#4a5059'],
        rose: ['#4a1028', '#7a2347', '#a8396a', '#d65c8c', '#f08ab0', '#ffc2d8'],
        vanilla: ['#1a1a1a', '#3a3a3a', '#555555', '#6f6f6f', '#8b8b8b', '#a8a8a8'],
        honey: ['#2a1606', '#4a2a0e', '#6b3f16', '#8a5420', '#a96d2e', '#c98a42'],
        crimson: ['#120305', '#24070b', '#360b12', '#4a111a', '#601a24', '#7a2632'],
        teal: ['#03100f', '#062220', '#0a3430', '#104842', '#1a6058', '#2a7c72'],
        rust: ['#140604', '#2c0e06', '#47180a', '#62240e', '#7e3414', '#9c481c'],
    };
    const INSET = {
        navy: ['#05060f', '#0b0d1f', '#10142e', '#161b3d', '#1e254f', '#283163'],
        dark: ['#050405', '#0c0a0c', '#141114', '#1c181c', '#262026', '#322a32'],
        ice: ['#040d16', '#081a2a', '#0c263c', '#12324e', '#1a4162', '#245478'],
        violet: ['#070210', '#10061f', '#180a2e', '#200f3d', '#2b154f', '#381c63'],
        slate: ['#020306', '#05080e', '#080d16', '#0c121f', '#111a2b', '#18243a'],
        moss: ['#050a04', '#0b1508', '#10200c', '#162a10', '#1d3615', '#26441c'],
        rose: ['#2a0718', '#3f0c25', '#551333', '#6b1b42', '#842554', '#9e3268'],
        grey: ['#0a0a0a', '#151515', '#1f1f1f', '#2a2a2a', '#363636', '#444444'],
        wood: ['#0e0703', '#1a0e06', '#26150a', '#321c0e', '#402513', '#4f2f19'],
    };
    const GEM = {
        red: ['#3a0610', '#7a0f1d', '#c21e2c', '#ef3b4a', '#ff8a8a', '#ffe0dc'],
        green: ['#06301a', '#0e5a2e', '#17904a', '#2fc46a', '#7aeaa0', '#d8ffe6'],
        blue: ['#071a3a', '#0f3478', '#1b5cc2', '#3a8cf0', '#86c2ff', '#e0f0ff'],
        purple: ['#1e0636', '#3f0f6e', '#6a1fb0', '#9a46e6', '#c88cff', '#f0dcff'],
        amber: ['#3a1e02', '#7a4206', '#c2700d', '#f0a020', '#ffd060', '#fff2c0'],
        cyan: ['#03222e', '#06495e', '#0a7a96', '#16a9cc', '#4fd6f0', '#b2f3ff'],
        pink: ['#5a1636', '#9c2f5f', '#d6568c', '#ff6fa8', '#ffb0d0', '#ffe6f0'],
    };

    /** Colour kits (same names as HUD Forge so a server can match its HUD) */
    const KITS = [
        { id: 'royal', name: 'Sapphire Gilt', group: 'Fantasy', metal: M.gold, plate: PLATE.navy, inset: INSET.navy, gem: GEM.red, rimW: 2, shape: 'rect', r: 0, orn: 'brackets', text: '#fff4bf' },
        { id: 'ironkeep', name: 'Ironbark', group: 'Fantasy', metal: M.iron, plate: PLATE.darkwood, inset: INSET.wood, gem: GEM.red, rimW: 2, shape: 'rect', r: 0, orn: 'rivets', texture: 'wood', text: '#f1e2cc' },
        { id: 'ember', name: 'Cinderglass', group: 'Fantasy', metal: M.bronze, plate: PLATE.obsidian, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'chamfer', r: 2, orn: 'rivets', text: '#ffd9a8' },
        { id: 'frost', name: 'Glacier', group: 'Fantasy', metal: M.frost, plate: PLATE.ice, inset: INSET.ice, gem: GEM.blue, rimW: 2, shape: 'round', r: 2, orn: 'brackets', text: '#eaf7ff' },
        { id: 'arcane', name: 'Nightshade', group: 'Fantasy', metal: M.gold, plate: PLATE.violet, inset: INSET.violet, gem: GEM.purple, rimW: 2, shape: 'rect', r: 0, orn: 'gems', text: '#f0dcff' },
        { id: 'crimson', name: 'Garnet', group: 'Fantasy', metal: M.iron, plate: PLATE.crimson, inset: INSET.dark, gem: GEM.red, rimW: 2, shape: 'chamfer', r: 2, orn: 'rivets', text: '#f0d8c8' },
        { id: 'abyss', name: 'Abyss Teal', group: 'Fantasy', metal: M.iron, plate: PLATE.teal, inset: INSET.dark, gem: GEM.cyan, rimW: 2, shape: 'chamfer', r: 2, orn: 'rivets', text: '#d8fff6' },
        { id: 'sunforge', name: 'Sunforge', group: 'Fantasy', metal: M.gold, plate: PLATE.rust, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'rect', r: 0, orn: 'brackets', text: '#ffe8c0' },
        { id: 'sylvan', name: 'Mossgrove', group: 'Nature', metal: M.oak, plate: PLATE.moss, inset: INSET.moss, gem: GEM.green, rimW: 2, shape: 'round', r: 2, orn: 'rivets', text: '#f2ffe0' },
        { id: 'honey', name: 'Amberwood', group: 'Nature', metal: M.oak, plate: PLATE.honey, inset: INSET.wood, gem: GEM.amber, rimW: 2, shape: 'round', r: 2, orn: 'rivets', texture: 'wood', text: '#fff0d0' },
        { id: 'candy', name: 'Bubblegum', group: 'Nature', metal: M.white, plate: PLATE.rose, inset: INSET.rose, gem: GEM.pink, rimW: 2, shape: 'round', r: 3, orn: 'none', text: '#ffffff' },
        { id: 'tech', name: 'Cyan Circuit', group: 'Tech', metal: M.steel, plate: PLATE.slate, inset: INSET.slate, gem: GEM.cyan, rimW: 1, shape: 'chamfer', r: 2, orn: 'none', accent: M.cyan, text: '#cfefff' },
        { id: 'slate', name: 'Graphite', group: 'Tech', metal: M.grey, plate: PLATE.charcoal, inset: INSET.slate, gem: GEM.blue, rimW: 1, shape: 'rect', r: 0, orn: 'none', accent: M.white, text: '#ffffff' },
        { id: 'amethyst', name: 'Orchid', group: 'Tech', metal: M.amethyst, plate: PLATE.violet, inset: INSET.violet, gem: GEM.purple, rimW: 1, shape: 'chamfer', r: 2, orn: 'none', text: '#f0e8ff' },
        { id: 'verdigris', name: 'Verdigris', group: 'Tech', metal: M.verdigris, plate: PLATE.charcoal, inset: INSET.slate, gem: GEM.green, rimW: 1, shape: 'chamfer', r: 2, orn: 'none', accent: M.verdigris, text: '#e0fff4' },
        { id: 'vanilla', name: 'Cobble', group: 'Blocky', metal: M.stone, plate: PLATE.vanilla, inset: INSET.grey, gem: GEM.green, rimW: 1, shape: 'rect', r: 0, orn: 'none', text: '#ffffff' },
        { id: 'nether', name: 'Magma Brick', group: 'Blocky', metal: M.netherbrick, plate: PLATE.crimson, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'rect', r: 0, orn: 'rivets', text: '#ffd9a8' },
        { id: 'cozyoak', name: 'Chestnut', group: 'Blocky', metal: M.oak, plate: PLATE.darkwood, inset: INSET.wood, gem: GEM.amber, rimW: 2, shape: 'rect', r: 0, orn: 'rivets', texture: 'wood', text: '#fff0d0' },
        // modern flat: one fill + a 1 px line per shape, no bevels (like web-made menus)
        flatKit('midnight', 'Midnight', { bg: '#0b0e14', edge: '#8a94aa', divider: '#2a3141', stage: '#465062', stageEdge: '#6c778e', well: '#141a25', wellEdge: '#2c3546', btn: '#2f6fdc', btnEdge: '#8fb8ff', btnHover: '#4384f2', btn2: '#161b26', btn2Edge: '#5a6478', btn2Hover: '#222a3a', gem: GEM.blue }),
        flatKit('carbon', 'Carbon Red', { bg: '#0e0d0f', edge: '#8c8790', divider: '#2d2a30', stage: '#3d3a40', stageEdge: '#6b6570', well: '#18161a', wellEdge: '#332f36', btn: '#d23b4c', btnEdge: '#ff9aa5', btnHover: '#e85060', btn2: '#1b191d', btn2Edge: '#5d5862', btn2Hover: '#29262c', gem: GEM.red }),
        flatKit('jade', 'Jade', { bg: '#0a1210', edge: '#86a89c', divider: '#21332d', stage: '#3a5249', stageEdge: '#628a7b', well: '#101c18', wellEdge: '#28403a', btn: '#1f9e6a', btnEdge: '#8be0bd', btnHover: '#28b67b', btn2: '#13201b', btn2Edge: '#4f6f64', btn2Hover: '#1d2e27', gem: GEM.green }),
        flatKit('dusk', 'Dusk Violet', { bg: '#100c18', edge: '#998cb3', divider: '#2c2540', stage: '#4a4063', stageEdge: '#77699a', well: '#181226', wellEdge: '#332a4a', btn: '#7a4ee0', btnEdge: '#c4adff', btnHover: '#8c62f0', btn2: '#1b1528', btn2Edge: '#615680', btn2Hover: '#272038', gem: GEM.purple }),
        flatKit('amberline', 'Amber Line', { bg: '#0f0d09', edge: '#a89a7c', divider: '#302a1d', stage: '#4a4232', stageEdge: '#7a6c4f', well: '#191510', wellEdge: '#3a3222', btn: '#d98a1c', btnEdge: '#ffd08a', btnHover: '#eb9c2c', btn2: '#1d1912', btn2Edge: '#6a5d44', btn2Hover: '#2a241a', gem: GEM.amber }),
        // Modern RPG: 2x high-res anti-aliased Canvas 2D kits (soft shadows, gradients, stage spotlight)
        rpgKit('rpg_astral', 'Astral Gold', { bgTop: '#16203a', bgBot: '#090d18', glow: 'rgba(255,204,102,0.16)', rim1: '#ffe28a', rim2: '#8c5a18', bannerBg: '#1c294a', bannerEdge: '#e6b85c', stageBg: '#0c1224', stageGlow: 'rgba(255,196,88,0.28)', slotBg: '#273454', slotEdge: '#6a82b5', btn1: '#3d9970', btn2: '#1e6346', btnEdge: '#7cf2ba', btnHover1: '#4db888', btnHover2: '#287d59', btn2Bg: '#1d2742', btn2Edge: '#586d99', btn2Hover: '#29375c', accent: '#ffd26a', mutedText: '#8ea4cc', gem: GEM.amber }),
        rpgKit('rpg_crimson', 'Crimson Sanctum', { bgTop: '#241018', bgBot: '#0d0609', glow: 'rgba(255,96,112,0.16)', rim1: '#ffb399', rim2: '#7a222d', bannerBg: '#2e131e', bannerEdge: '#e06c75', stageBg: '#14080d', stageGlow: 'rgba(255,90,90,0.28)', slotBg: '#3a1c26', slotEdge: '#9e5264', btn1: '#d14353', btn2: '#8a1e2c', btnEdge: '#ffa3ad', btnHover1: '#e65768', btnHover2: '#a62838', btn2Bg: '#26141b', btn2Edge: '#7a4452', btn2Hover: '#381d27', accent: '#ff8a7a', mutedText: '#c2929c', gem: GEM.red }),
        rpgKit('rpg_verdant', 'Verdant Relic', { bgTop: '#10241d', bgBot: '#07110d', glow: 'rgba(85,235,160,0.15)', rim1: '#c8f59a', rim2: '#356e48', bannerBg: '#153026', bannerEdge: '#7ad99c', stageBg: '#091712', stageGlow: 'rgba(80,230,150,0.26)', slotBg: '#1c3b2f', slotEdge: '#528f75', btn1: '#26a670', btn2: '#126643', btnEdge: '#80f5c4', btnHover1: '#34bf84', btnHover2: '#1a8055', btn2Bg: '#142921', btn2Edge: '#43735e', btn2Hover: '#1d3b30', accent: '#9af5b8', mutedText: '#88b8a2', gem: GEM.green }),
        rpgKit('rpg_glacier', 'Glacier Glass', { bgTop: '#13273d', bgBot: '#08121e', glow: 'rgba(110,210,255,0.18)', rim1: '#d6f4ff', rim2: '#3e78a6', bannerBg: '#183350', bannerEdge: '#7ec8ff', stageBg: '#0a1829', stageGlow: 'rgba(100,205,255,0.30)', slotBg: '#213f5e', slotEdge: '#6aa4d6', btn1: '#3085db', btn2: '#1a5091', btnEdge: '#99d1ff', btnHover1: '#4298f0', btnHover2: '#2363b0', btn2Bg: '#172b42', btn2Edge: '#4d769e', btn2Hover: '#223e5e', accent: '#8ad8ff', mutedText: '#91b4d6', gem: GEM.cyan }),
        rpgKit('rpg_arcane', 'Arcane Velvet', { bgTop: '#211438', bgBot: '#0c0717', glow: 'rgba(195,120,255,0.18)', rim1: '#f0ccff', rim2: '#6b3b99', bannerBg: '#2a1a47', bannerEdge: '#c88cff', stageBg: '#120a21', stageGlow: 'rgba(186,110,255,0.30)', slotBg: '#322052', slotEdge: '#8560bd', btn1: '#8b54e3', btn2: '#5528a3', btnEdge: '#d4b3ff', btnHover1: '#9f6cf2', btnHover2: '#6835bf', btn2Bg: '#23173b', btn2Edge: '#6d509e', btn2Hover: '#312052', accent: '#e0b3ff', mutedText: '#ab94cf', gem: GEM.purple }),
    ];

    /** A Modern RPG 2x Hi-Res kit */
    function rpgKit(id, name, r) {
        return {
            id, name, group: 'Modern RPG', hiRes: true, rpg: r, text: '#f6f8ff',
            metal: [r.bgBot, r.rim2, r.rim2, r.rim1, r.accent, '#ffffff'],
            plate: [r.bgBot, r.bgBot, r.bgTop, r.bgTop, r.bannerBg, r.bannerEdge],
            inset: [r.bgBot, r.stageBg, r.stageBg, r.slotBg, r.slotEdge, r.accent],
            gem: r.gem,
            rimW: 2, shape: 'round', r: 2, orn: 'none'
        };
    }

    /** A flat kit: the pixel fields (used by the swatches and a few layouts) are filled from the flat colours */
    function flatKit(id, name, f) {
        const r6 = (a, b) => [a, a, b, b, b, b];
        return {
            id, name, group: 'Flat', flat: f, text: '#ffffff',
            metal: [f.bg, f.divider, f.divider, f.edge, f.btn, f.btnEdge],
            plate: r6(f.bg, f.bg), inset: r6(f.well, f.stage), gem: f.gem,
            rimW: 1, shape: 'rect', r: 0, orn: 'none'
        };
    }

    /** 1 px line around a box, corners left out (looks softly rounded) */
    function flatBox(b, x, y, w, h, fill, line, round) {
        const cut = round === false ? 0 : 1;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
            const edgeX = i === 0 || i === w - 1, edgeY = j === 0 || j === h - 1;
            if (cut && edgeX && edgeY) continue;
            b.px(x + i, y + j, (edgeX || edgeY) && line ? line : fill);
        }
    }

    /* ───────────── pixel buffer ───────────── */

    function hexRgb(h) { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }

    class Buf {
        constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
        px(x, y, col, a) {
            x |= 0; y |= 0;
            if (x < 0 || y < 0 || x >= this.w || y >= this.h || !col) return;
            const i = (y * this.w + x) * 4;
            const [r, g, b] = typeof col === 'string' ? hexRgb(col) : col;
            const al = a == null ? 1 : a;
            if (al >= 1) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = 255; return; }
            // blend over what is there
            const da = this.d[i + 3] / 255, oa = al + da * (1 - al);
            if (oa <= 0) return;
            this.d[i] = (r * al + this.d[i] * da * (1 - al)) / oa;
            this.d[i + 1] = (g * al + this.d[i + 1] * da * (1 - al)) / oa;
            this.d[i + 2] = (b * al + this.d[i + 2] * da * (1 - al)) / oa;
            this.d[i + 3] = oa * 255;
        }
        alpha(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
        rect(x, y, w, h, col, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col, a); }
        /** draws another buffer on top */
        blit(src, ox, oy) {
            for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
                const i = (y * src.w + x) * 4;
                const a = src.d[i + 3];
                if (a) this.px(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2]], a / 255);
            }
        }
        canvas() {
            const c = document.createElement('canvas');
            c.width = this.w; c.height = this.h;
            c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
            return c;
        }
        png() { return this.canvas().toDataURL('image/png'); }
    }

    /* ───────────── shapes ───────────── */

    /** how many pixels a row is cut in from each side at a corner */
    function cornerCut(shape, r, row) {
        if (!r || shape === 'rect') return 0;
        if (shape === 'round') {
            const t = r === 1 ? [1] : r === 2 ? [2, 1] : r === 3 ? [3, 1, 1] : [4, 2, 1, 1];
            return row < t.length ? t[row] : 0;
        }
        return row < r ? r - row : 0; // chamfer
    }

    function fillShape(b, x, y, w, h, shape, r, colAt) {
        for (let j = 0; j < h; j++) {
            const cut = Math.max(cornerCut(shape, r, j), cornerCut(shape, r, h - 1 - j));
            for (let i = cut; i < w - cut; i++) {
                const c = colAt(i, j);
                if (c) b.px(x + i, y + j, c);
            }
        }
    }

    function inShape(w, h, shape, r, i, j) {
        if (i < 0 || j < 0 || i >= w || j >= h) return false;
        const cut = Math.max(cornerCut(shape, r, j), cornerCut(shape, r, h - 1 - j));
        return i >= cut && i < w - cut;
    }

    /**
     * Bevelled frame: rings from the outside in, then a body.
     * rings: [{ ramp, lt, mid, dk }] shades per ring (indices into ramp) — top/left light, bottom/right dark.
     * body: { ramp, base, light, dark, texture }
     */
    function frame(b, x, y, w, h, o) {
        const shape = o.shape || 'rect', r0 = o.r || 0;
        if (o.shadow !== false) {
            // 1 px drop shadow to the bottom-right
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
                if (inShape(w, h, shape, r0, i - 1, j - 1) && !inShape(w, h, shape, r0, i, j)) b.px(x + i, y + j, '#000000', 0.38);
            }
            w -= 1; h -= 1;
        }
        const rings = o.rings || [];
        rings.forEach((ring, k) => {
            const rw = w - 2 * k, rh = h - 2 * k, rr = Math.max(0, r0 - k);
            if (rw <= 0 || rh <= 0) return;
            fillShape(b, x + k, y + k, rw, rh, shape, rr, (i, j) => {
                const dT = j, dB = rh - 1 - j, dL = i, dR = rw - 1 - i;
                const tl = Math.min(dT, dL), br = Math.min(dB, dR);
                const side = tl < br ? ring.lt : br < tl ? ring.dk : ring.mid;
                return ring.ramp[side];
            });
        });
        const k = rings.length;
        const bw = w - 2 * k, bh = h - 2 * k, br = Math.max(0, r0 - k);
        if (bw > 0 && bh > 0 && o.body) {
            const B = o.body;
            fillShape(b, x + k, y + k, bw, bh, o.shape, br, (i, j) => {
                if (j === 0 || i === 0) return B.ramp[B.light];
                if (j === bh - 1 || i === bw - 1) return B.ramp[B.dark];
                if (B.texture === 'wood' && j % 6 === 3 && ((i * 7 + j * 3) % 23) > 4) return B.ramp[B.base - 1];
                return B.ramp[B.base];
            });
        }
        return { x: x + k, y: y + k, w: bw, h: bh };
    }

    /* ───────────── kit pieces ───────────── */

    function rimRings(kit, hover) {
        const rings = [{ ramp: kit.metal, lt: 0, mid: 0, dk: 0 }];
        if (kit.rimW >= 2) rings.push({ ramp: kit.metal, lt: hover ? 5 : 4, mid: 3, dk: 2 });
        rings.push({ ramp: kit.metal, lt: hover ? 5 : 3, mid: hover ? 4 : 3, dk: 1 });
        return rings;
    }

    /* ───────────── Hi-Res 2x Canvas 2D renderer (Modern RPG) ───────────── */

    const HIRES_SCALE = 2;

    function roundRectPath(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    function hiResSurface(gw, gh) {
        const S = HIRES_SCALE;
        const c = document.createElement('canvas');
        c.width = gw * S; c.height = gh * S;
        const ctx = c.getContext('2d');
        return {
            w: gw, h: gh, S, canvas: c, ctx, isHiRes: true,
            px(x, y, col, a) {
                if (!col) return;
                ctx.save();
                if (a != null) ctx.globalAlpha = a;
                ctx.fillStyle = Array.isArray(col) ? `rgb(${col[0]},${col[1]},${col[2]})` : col;
                ctx.fillRect(Math.floor(x) * S, Math.floor(y) * S, S, S);
                ctx.restore();
            },
            blit(src, ox, oy) {
                const sc = src.canvas();
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(sc, ox * S, oy * S, src.w * S, src.h * S);
                ctx.restore();
            },
            png() { return c.toDataURL('image/png'); }
        };
    }

    function hiResWell(surf, kit, x, y, w, h, accentColor) {
        const S = surf.S, ctx = surf.ctx, r = kit.rpg;
        const sx = x * S, sy = y * S, sw = w * S, sh = h * S;
        const isSlot = w <= 26 && h <= 26;
        const isStage = h >= 65 && w >= 56;
        ctx.save();
        if (isStage) {
            roundRectPath(ctx, sx, sy, sw, sh, 10);
            const bg = ctx.createLinearGradient(sx, sy, sx, sy + sh);
            bg.addColorStop(0, r.stageBg);
            bg.addColorStop(1, r.bgBot);
            ctx.fillStyle = bg;
            ctx.fill();
            const rad = ctx.createRadialGradient(sx + sw * 0.5, sy + sh * 0.44, 4, sx + sw * 0.5, sy + sh * 0.44, Math.max(sw, sh) * 0.55);
            rad.addColorStop(0, r.stageGlow);
            rad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rad;
            ctx.fill();
            // pedestal shadow + soft rim under feet
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(sx + sw * 0.5, sy + sh - 18, sw * 0.34, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = r.accent;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx + sw * 0.5, sy + sh - 19, sw * 0.32, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = accentColor || r.slotEdge;
            ctx.lineWidth = 2;
            roundRectPath(ctx, sx + 1, sy + 1, sw - 2, sh - 2, 9);
            ctx.stroke();
        } else {
            const rad = isSlot ? 6 : 8;
            roundRectPath(ctx, sx, sy, sw, sh, rad);
            const g = ctx.createLinearGradient(sx, sy, sx, sy + sh);
            g.addColorStop(0, isSlot ? r.slotBg : 'rgba(255,255,255,0.06)');
            g.addColorStop(1, isSlot ? r.stageBg : 'rgba(0,0,0,0.34)');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = accentColor || (isSlot ? r.slotEdge : 'rgba(255,255,255,0.14)');
            ctx.lineWidth = isSlot ? 1.8 : 1.5;
            roundRectPath(ctx, sx + 0.75, sy + 0.75, sw - 1.5, sh - 1.5, rad);
            ctx.stroke();
            if (isSlot) {
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx + 4, sy + 2.5);
                ctx.lineTo(sx + sw - 4, sy + 2.5);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function hiResPanel(kit, w, h, opts) {
        const surf = hiResSurface(w, h), S = surf.S, ctx = surf.ctx, r = kit.rpg;
        const sw = w * S, sh = h * S, pad = 2;
        ctx.save();
        // outer shadow
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        roundRectPath(ctx, pad + 3, pad + 4, sw - pad * 2 - 2, sh - pad * 2 - 2, 12);
        ctx.fill();
        // base body gradient
        roundRectPath(ctx, pad, pad, sw - pad * 2 - 2, sh - pad * 2 - 2, 12);
        const bg = ctx.createLinearGradient(0, 0, 0, sh);
        bg.addColorStop(0, r.bgTop);
        bg.addColorStop(1, r.bgBot);
        ctx.fillStyle = bg;
        ctx.fill();
        // ambient top glow
        const glow = ctx.createRadialGradient(sw * 0.5, sh * 0.14, 10, sw * 0.5, sh * 0.14, sw * 0.65);
        glow.addColorStop(0, r.glow);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fill();
        // outer metallic rim gradient
        const rim = ctx.createLinearGradient(0, 0, 0, sh);
        rim.addColorStop(0, r.rim1);
        rim.addColorStop(0.5, r.rim2);
        rim.addColorStop(1, r.bgBot);
        ctx.strokeStyle = rim;
        ctx.lineWidth = 2.5;
        roundRectPath(ctx, pad + 1.25, pad + 1.25, sw - pad * 2 - 4.5, sh - pad * 2 - 4.5, 11);
        ctx.stroke();
        // subtle inner specular highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        roundRectPath(ctx, pad + 4, pad + 4, sw - pad * 2 - 10, sh - pad * 2 - 10, 9);
        ctx.stroke();
        // corner diamond accents
        ctx.fillStyle = r.accent;
        [[14, 14], [sw - 16, 14], [14, sh - 16], [sw - 16, sh - 16]].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.moveTo(cx, cy - 3); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx, cy + 3); ctx.lineTo(cx - 3, cy);
            ctx.closePath(); ctx.fill();
        });
        if (opts.banner) {
            const bn = opts.banner;
            const bx = bn.x * S, by = Math.max(0, (bn.y - 2) * S), bw = bn.w * S, bh = (bn.h + 2) * S;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            roundRectPath(ctx, bx + 2, by + 3, bw, bh, 8);
            ctx.fill();
            roundRectPath(ctx, bx, by, bw, bh, 8);
            const bgrad = ctx.createLinearGradient(bx, by, bx, by + bh);
            bgrad.addColorStop(0, r.bannerBg);
            bgrad.addColorStop(1, r.bgBot);
            ctx.fillStyle = bgrad;
            ctx.fill();
            ctx.strokeStyle = r.bannerEdge;
            ctx.lineWidth = 2;
            roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, 7);
            ctx.stroke();
        }
        if (opts.divider) {
            const dv = opts.divider;
            const dg = ctx.createLinearGradient(dv.x * S, 0, (dv.x + dv.w) * S, 0);
            dg.addColorStop(0, 'rgba(255,255,255,0)');
            dg.addColorStop(0.5, r.accent);
            dg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = dg;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(dv.x * S, dv.y * S, dv.w * S, 2);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        (opts.wells || []).forEach(wl => hiResWell(surf, kit, wl.x, wl.y, wl.w, wl.h));
        return surf;
    }

    function hiResButton(kit, w, h, hover, opts) {
        const surf = hiResSurface(w, h), S = surf.S, ctx = surf.ctx, r = kit.rpg;
        const sw = w * S, sh = h * S, rad = 8;
        ctx.save();
        // drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        roundRectPath(ctx, 2, 3, sw - 4, sh - 3, rad);
        ctx.fill();
        let c1 = opts.secondary ? r.btn2Bg : r.btn1;
        let c2 = opts.secondary ? r.bgBot : r.btn2;
        let edge = opts.secondary ? r.btn2Edge : r.btnEdge;
        if (hover) {
            c1 = opts.secondary ? r.btn2Hover : r.btnHover1;
            c2 = opts.secondary ? r.btn2Bg : r.btnHover2;
            edge = r.accent;
        }
        if (opts.ramp) {
            c1 = opts.ramp[hover ? 4 : 3];
            c2 = opts.ramp[hover ? 2 : 1];
            edge = opts.ramp[5];
        }
        roundRectPath(ctx, 1, 1, sw - 3, sh - 4, rad);
        const g = ctx.createLinearGradient(0, 1, 0, sh - 3);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        ctx.fillStyle = g;
        ctx.fill();
        // top highlight bar
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rad, 2.5);
        ctx.lineTo(sw - rad - 1, 2.5);
        ctx.stroke();
        // border
        ctx.strokeStyle = edge;
        ctx.lineWidth = hover ? 2.2 : 1.6;
        roundRectPath(ctx, 1.25, 1.25, sw - 3.5, sh - 4.5, rad - 1);
        ctx.stroke();
        ctx.restore();
        if (opts.well) hiResWell(surf, kit, opts.well.x, opts.well.y, opts.well.w, opts.well.h);
        if (opts.icon) surf.blit(opts.icon, opts.iconX, opts.iconY);
        return surf;
    }

    /** Window background with the kit's rim, a seam and the plate */
    function panel(kit, w, h, opts) {
        opts = opts || {};
        if (kit.hiRes) return hiResPanel(kit, w, h, opts);
        const b = new Buf(w, h);
        if (kit.flat) {
            const f = kit.flat;
            flatBox(b, 0, 0, w, h, f.bg, f.edge);
            if (opts.banner) for (let i = 6; i < w - 6; i++) b.px(i, 19, f.divider);
            if (opts.divider) for (let i = 0; i < opts.divider.w; i++) b.px(opts.divider.x + i, opts.divider.y, f.divider);
            (opts.wells || []).forEach(wl => well(b, kit, wl.x, wl.y, wl.w, wl.h));
            return b;
        }
        const rings = rimRings(kit);
        rings.push({ ramp: kit.plate, lt: 0, mid: 0, dk: 0 }); // seam
        const inner = frame(b, 0, 0, w, h, { shape: kit.shape, r: kit.r + 1, rings, body: { ramp: kit.plate, base: 3, light: 4, dark: 2, texture: kit.texture } });
        if (kit.accent) {
            // tech kits: thin accent line under the top rim
            for (let i = 6; i < w - 7; i++) if (i % 9 !== 0) b.px(i, inner.y + 2, kit.accent[3], 0.55);
        }
        ornaments(b, kit, 0, 0, w - 1, h - 1);
        if (opts.banner) banner(b, kit, opts.banner.x, opts.banner.y, opts.banner.w, opts.banner.h);
        if (opts.divider) divider(b, kit, opts.divider.x, opts.divider.y, opts.divider.w);
        (opts.wells || []).forEach(wl => well(b, kit, wl.x, wl.y, wl.w, wl.h));
        return b;
    }

    function ornaments(b, kit, x, y, w, h) {
        const m = kit.metal, inset = kit.rimW + 3;
        if (kit.orn === 'brackets') {
            const L = 7;
            [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([cx, cy, sx, sy]) => {
                const ox = cx ? x + w - 1 - inset : x + inset, oy = cy ? y + h - 1 - inset : y + inset;
                for (let i = 0; i < L; i++) {
                    b.px(ox + sx * i, oy, m[i === 0 ? 5 : 4]); b.px(ox + sx * i, oy + sy, m[1]);
                    b.px(ox, oy + sy * i, m[4]); b.px(ox + sx, oy + sy * i, m[1]);
                }
                b.px(ox + sx, oy + sy, m[2]);
            });
        } else if (kit.orn === 'rivets' || kit.orn === 'gems') {
            const R = kit.orn === 'gems' ? kit.gem : m;
            [[x + inset, y + inset], [x + w - inset - 2, y + inset], [x + inset, y + h - inset - 2], [x + w - inset - 2, y + h - inset - 2]].forEach(([px, py]) => {
                b.px(px, py, R[4]); b.px(px + 1, py, R[3]); b.px(px, py + 1, R[3]); b.px(px + 1, py + 1, R[1]);
                b.px(px + 2, py + 2, '#000000', 0.35);
            });
        }
    }

    /** Title plate across the top */
    function banner(b, kit, x, y, w, h) {
        frame(b, x, y, w, h, {
            shape: kit.shape === 'rect' ? 'chamfer' : kit.shape, r: 2,
            rings: [{ ramp: kit.metal, lt: 0, mid: 0, dk: 0 }, { ramp: kit.metal, lt: 4, mid: 3, dk: 2 }],
            body: { ramp: kit.inset, base: 3, light: 4, dark: 1 }
        });
        // small studs at both ends
        [x + 4, x + w - 7].forEach(px => { b.px(px, y + (h >> 1) - 1, kit.metal[5]); b.px(px + 1, y + (h >> 1) - 1, kit.metal[3]); b.px(px, y + (h >> 1), kit.metal[3]); b.px(px + 1, y + (h >> 1), kit.metal[1]); });
    }

    function divider(b, kit, x, y, w) {
        for (let i = 0; i < w; i++) { b.px(x + i, y, kit.plate[1]); b.px(x + i, y + 1, kit.plate[4]); }
    }

    /** Sunken area (slot / row) */
    function well(b, kit, x, y, w, h) {
        if (kit.hiRes) return hiResWell(b, kit, x, y, w, h);
        if (kit.flat) return flatBox(b, x, y, w, h, kit.flat.well, kit.flat.wellEdge);
        frame(b, x, y, w, h, {
            shadow: false, shape: 'rect',
            rings: [{ ramp: kit.inset, lt: 0, mid: 1, dk: 5 }],
            body: { ramp: kit.inset, base: 3, light: 2, dark: 3 }
        });
    }

    /** Raised button; hover = brighter rim and body */
    function button(kit, w, h, hover, opts) {
        opts = opts || {};
        if (kit.hiRes) return hiResButton(kit, w, h, hover, opts);
        const b = new Buf(w, h);
        if (kit.flat) {
            const f = kit.flat;
            let fill = opts.secondary ? f.btn2 : f.btn, line = opts.secondary ? f.btn2Edge : f.btnEdge;
            if (hover) fill = opts.secondary ? f.btn2Hover : f.btnHover;
            if (opts.ramp) { fill = opts.ramp[hover ? 4 : 3]; line = opts.ramp[5]; }
            flatBox(b, 0, 0, w, h, fill, line);
            if (opts.well) well(b, kit, opts.well.x, opts.well.y, opts.well.w, opts.well.h);
            if (opts.icon) b.blit(opts.icon, opts.iconX, opts.iconY);
            return b;
        }
        const plate = opts.ramp || kit.plate;
        const rings = [{ ramp: kit.metal, lt: 0, mid: 0, dk: 0 }];
        rings.push({ ramp: hover ? kit.metal : plate, lt: hover ? 5 : 5, mid: hover ? 4 : 4, dk: hover ? 2 : 1 });
        const inner = frame(b, 0, 0, w, h, { shape: kit.shape === 'rect' ? 'rect' : 'chamfer', r: kit.shape === 'rect' ? 0 : 1, rings, body: { ramp: plate, base: hover ? 5 : 4, light: 5, dark: hover ? 3 : 2 } });
        // lip: two darker rows at the bottom give the button thickness
        for (let i = 1; i < inner.w - 1; i++) b.px(inner.x + i, inner.y + inner.h - 2, plate[hover ? 3 : 2]);
        if (opts.well) well(b, kit, opts.well.x, opts.well.y, opts.well.w, opts.well.h);
        if (opts.icon) b.blit(opts.icon, opts.iconX, opts.iconY);
        return b;
    }

    /* ───────────── icons (12×12, auto-shaded from masks) ───────────── */

    const ICON = 12;

    function maskFrom(fn) {
        const g = [];
        for (let y = 0; y < ICON - 1; y++) { g.push([]); for (let x = 0; x < ICON - 1; x++) g[y].push(fn(x + 0.5, y + 0.5, x, y) || 0); }
        return g;
    }
    function inPoly(px, py, pts) {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i], [xj, yj] = pts[j];
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c;
        }
        return c;
    }
    function nearSeg(px, py, ax, ay, bx, by, r) {
        const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
        const dx = px - (ax + vx * t), dy = py - (ay + vy * t);
        return dx * dx + dy * dy <= r * r;
    }
    const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

    /**
     * Masks return a material number (1..3) or 'd' + number for a detail pixel.
     * Each icon names the ramp of each material.
     */
    const ICONS = {
        coin: { mats: [M.gold], fn: (x, y) => { const d = dist(x, y, 5.5, 5.5); return d <= 5.3 ? (d >= 2.4 && d <= 3.4 ? 'd1' : 1) : 0; } },
        gem: { mats: [GEM.cyan], fn: (x, y) => inPoly(x, y, [[1, 4], [3.5, 1], [7.5, 1], [10, 4], [5.5, 10.5]]) ? ((Math.abs(x - 5.5) < 0.6 && y > 4) || (y > 3.5 && y < 4.5) ? 'd1' : 1) : 0 },
        heart: { mats: [GEM.red], fn: (x, y) => (dist(x, y, 3.5, 3.8) <= 2.8 || dist(x, y, 7.5, 3.8) <= 2.8 || inPoly(x, y, [[0.8, 4.5], [10.2, 4.5], [5.5, 10.2]])) ? 1 : 0 },
        star: { mats: [M.gold], fn: (x, y) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.3 : 5.4; p.push([5.5 + r * Math.cos(a), 5.8 + r * Math.sin(a)]); } return inPoly(x, y, p) ? 1 : 0; } },
        sword: {
            mats: [M.iron, M.gold, M.oak], fn: (x, y) => {
                if (nearSeg(x, y, 9.4, 1.6, 4.4, 6.6, 1.35)) return 1;
                if (nearSeg(x, y, 2.6, 5.4, 5.6, 8.4, 0.8)) return 2;
                if (nearSeg(x, y, 3.4, 7.6, 1.2, 9.8, 0.8)) return 3;
                return 0;
            }
        },
        house: {
            mats: [M.oak, GEM.red, INSET.wood], fn: (x, y) => {
                if (inPoly(x, y, [[0.2, 5.4], [5.5, 0.4], [10.8, 5.4]])) return 2;
                if (x > 1.5 && x < 9.5 && y > 5 && y < 10.6) return (x > 4.3 && x < 6.7 && y > 7) ? 3 : 1;
                return 0;
            }
        },
        chest: {
            mats: [M.oak, M.iron, M.gold], fn: (x, y) => {
                if (x < 0.6 || x > 10.4 || y < 1.6 || y > 10.4) return 0;
                if (x > 4.4 && x < 6.6 && y > 4 && y < 7) return 3;
                if (y > 4.6 && y < 5.6) return 2;
                if (x < 1.6 || x > 9.4) return 2;
                return 1;
            }
        },
        compass: { mats: [M.iron, GEM.red, M.white], fn: (x, y) => { const d = dist(x, y, 5.5, 5.5); if (d > 5.3) return 0; if (d <= 3.6 && nearSeg(x, y, 5.5, 5.5, 7.6, 3.2, 0.75)) return 2; if (d <= 3.6 && nearSeg(x, y, 5.5, 5.5, 3.4, 7.8, 0.75)) return 3; return d >= 3.9 ? 1 : 3; } },
        gear: { mats: [M.iron], fn: (x, y) => { const d = dist(x, y, 5.5, 5.5), a = Math.atan2(y - 5.5, x - 5.5); const tooth = Math.cos(a * 8) > 0.2; if (d <= 1.6) return 0; return d <= 3.7 || (tooth && d <= 5.3) ? 1 : 0; } },
        check: { mats: [GEM.green], fn: (x, y) => (nearSeg(x, y, 1.2, 5.8, 4.2, 8.8, 1.2) || nearSeg(x, y, 4.2, 8.8, 9.8, 2.2, 1.2)) ? 1 : 0 },
        cross: { mats: [GEM.red], fn: (x, y) => (nearSeg(x, y, 1.8, 1.8, 9.2, 9.2, 1.15) || nearSeg(x, y, 9.2, 1.8, 1.8, 9.2, 1.15)) ? 1 : 0 },
        back: { mats: [M.white], fn: (x, y) => (inPoly(x, y, [[0.6, 5.5], [5.2, 1.2], [5.2, 9.8]]) || (x > 4.5 && x < 10.4 && y > 3.9 && y < 7.1)) ? 1 : 0 },
        flag: { mats: [M.iron, GEM.red], fn: (x, y) => (x > 1.2 && x < 2.8 && y > 0.4) ? 1 : (inPoly(x, y, [[2.8, 1], [10.4, 1], [8.2, 3.6], [10.4, 6.2], [2.8, 6.2]]) ? 2 : 0) },
        user: { mats: [M.skin, GEM.blue], fn: (x, y) => dist(x, y, 5.5, 3.4) <= 2.9 ? 1 : (inPoly(x, y, [[1, 10.6], [2.2, 7], [8.8, 7], [10, 10.6]]) ? 2 : 0) },
        trophy: {
            mats: [M.gold], fn: (x, y) => {
                if (inPoly(x, y, [[2, 0.8], [9, 0.8], [8.2, 4.6], [5.5, 6.6], [2.8, 4.6]])) return 1;
                if (dist(x, y, 1.6, 2.8) <= 1.6 && dist(x, y, 1.6, 2.8) >= 0.7) return 1;
                if (dist(x, y, 9.4, 2.8) <= 1.6 && dist(x, y, 9.4, 2.8) >= 0.7) return 1;
                if (x > 4.6 && x < 6.4 && y > 6 && y < 8.5) return 1;
                if (x > 2.6 && x < 8.4 && y > 8.4 && y < 10.6) return 1;
                return 0;
            }
        },
        bag: { mats: [M.leather, M.gold], fn: (x, y) => { if (dist(x, y, 5.5, 7) <= 4.1 && y > 3) return y > 5.8 && y < 6.8 && Math.abs(x - 5.5) < 2.5 ? 2 : 1; if (x > 3.6 && x < 7.4 && y > 0.8 && y <= 3.2) return 1; return 0; } },
        portal: { mats: [PLATE.obsidian, GEM.purple], fn: (x, y) => { if (x < 1 || x > 10 || y < 0.4 || y > 10.6) return 0; return (x > 2.6 && x < 8.4 && y > 2 && y < 9) ? 2 : 1; } },
        pickaxe: { mats: [GEM.cyan, M.oak], fn: (x, y) => { if (nearSeg(x, y, 1.8, 9.8, 7.4, 4.2, 0.9)) return 2; const d = dist(x, y, 8, 8.4); return (d <= 7.6 && d >= 5.4 && y < 6.2 && x > 1.2 && y > 0.4) ? 1 : 0; } },
        apple: {
            mats: [GEM.red, M.leaf, M.oak], fn: (x, y) => {
                if (x > 5 && x < 6.2 && y > 0.4 && y < 3.2) return 3;
                if (inPoly(x, y, [[6.2, 2.4], [8.2, 0.4], [9.8, 1], [8.4, 2.8]])) return 2;
                return dist(x, y, 5.5, 6.6) <= 4.4 && !(dist(x, y, 5.5, 1.8) < 1.6) ? 1 : 0;
            }
        },
    };

    function drawIcon(name) {
        const def = ICONS[name] || ICONS.star;
        const grid = maskFrom(def.fn);
        const H = grid.length, W = grid[0].length;
        const mat = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : (typeof grid[y][x] === 'string' ? Number(grid[y][x].slice(1)) : grid[y][x]);
        const b = new Buf(ICON, ICON);
        const lit = {};
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const v = grid[y][x];
            if (!v) continue;
            const m = mat(x, y), R = def.mats[m - 1] || def.mats[0];
            let col;
            const out = (dx, dy) => mat(x + dx, y + dy) === 0;
            const other = (dx, dy) => { const n = mat(x + dx, y + dy); return n !== 0 && n !== m; };
            if (out(-1, 0) || out(1, 0) || out(0, -1) || out(0, 1)) col = R[0];
            else if (typeof v === 'string') col = R[1];
            else if (out(0, -2) || out(-2, 0) || other(0, -1) || other(-1, 0)) {
                col = R[4];
                if (!lit[m]) { lit[m] = true; col = R[5]; }
            } else if (out(0, 2) || out(2, 0) || other(0, 1) || other(1, 0)) col = R[2];
            else col = R[3];
            b.px(x, y, col);
        }
        // drop shadow
        for (let y = H; y >= 1; y--) for (let x = W; x >= 1; x--) if (mat(x - 1, y - 1) && !mat(x, y)) b.px(x, y, '#000000', 0.35);
        return b;
    }

    /* ───────────── player head / model ─────────────
       Real Player Head / Player Model elements (like the HUD's Player Head): Java draws the
       skin of `player`, Bedrock the paper doll of the player who opens the menu (anyone else
       = Steve). Sizes: a head is 8 skin px square, a model 16 × 32, s GUI px per skin px. */

    function headEl(name, x, y, s, player) { return { type: 'player_head', name: 'Player Head · ' + name, x, y, w: 8 * s, h: 8 * s, player: player || '%player_name%' }; }
    function bodyEl(name, x, y, s, player, extra) { return Object.assign({ type: 'player_model', name: 'Player Model · ' + name, x, y, w: 16 * s, h: 32 * s, player: player || '%player_name%', angle: 20 }, extra || {}); }

    /** A real Minecraft item (Java: the item itself, Bedrock: the game's texture) */
    function itemEl(name, x, y, size, item, extra) { return Object.assign({ type: 'item', name: 'Item · ' + name, x, y, w: size, h: size, item }, extra || {}); }

    /** well with a coloured rim (used for "you" rows and podium tops) */
    function rimWell(b, kit, ramp, x, y, w, h) {
        if (kit.hiRes) return hiResWell(b, kit, x, y, w, h, ramp === kit.metal ? kit.rpg.rim1 : ramp[4]);
        if (kit.flat) return flatBox(b, x, y, w, h, kit.flat.stage, ramp === kit.metal ? kit.flat.stageEdge : ramp[4]);
        frame(b, x, y, w, h, { shadow: false, shape: 'rect', rings: [{ ramp, lt: 4, mid: 3, dk: 2 }, { ramp: kit.inset, lt: 0, mid: 1, dk: 5 }], body: { ramp: kit.inset, base: 3, light: 2, dark: 3 } });
        // a hint of the rim colour along the top of the floor
        for (let i = 2; i < w - 2; i++) b.px(x + i, y + 2, ramp[2], 0.45);
    }

    /* ───────────── layouts ───────────── */

    /**
     * A layout returns { width, height, title, elements: [...] }.
     * Elements: { type, name, x, y, w, h, png, hoverPng, label, actions, closeOnClick, text, align, color }.
     * ctx: { kit, title, link(key) → menu id or null, id }
     */
    /** Title: on the plate in pixel kits; flat kits put it top-left over a thin line */
    function titleText(ctx, w, opts, bh, title) {
        if (ctx.kit.flat) return { type: 'text', name: 'Title', x: 8, y: 5, w: Math.round(w / 2), h: 12, text: title, color: ctx.kit.text, shadow: true, align: 'left' };
        if (ctx.kit.hiRes) return { type: 'text', name: 'Title', x: opts.banner.x, y: opts.banner.y, w: opts.banner.w, h: bh, text: '&l' + title, color: ctx.kit.text, shadow: true, align: 'center', scale: 1.05 };
        return { type: 'text', name: 'Title', x: opts.banner.x, y: opts.banner.y + 1, w: opts.banner.w - 1, h: bh - 2, text: title, color: ctx.kit.text, shadow: true, align: 'center' };
    }

    function windowBase(ctx, w, h, title, extra) {
        const bw = Math.min(160, w - 60), bh = 16;
        const opts = Object.assign({ banner: title ? { x: Math.round((w - bw) / 2), y: 5, w: bw, h: bh } : null }, extra || {});
        const els = [{ type: 'image', name: 'Window', x: 0, y: 0, w, h, detail: ctx.kit.hiRes ? HIRES_SCALE : 1, png: panel(ctx.kit, w, h, opts).png() }];
        if (title) els.push(titleText(ctx, w, opts, bh, title));
        return els;
    }

    /** wide button with an icon on the left */
    /** "minecraft:…" = a real item element on top (Java: the item itself, Bedrock: the game's texture) instead of a drawn icon */
    const isItem = (s) => typeof s === 'string' && s.startsWith('minecraft:');

    function iconButton(ctx, name, x, y, w, h, icon, label, actions, extra) {
        const ic = icon && !isItem(icon) ? drawIcon(icon) : null;
        const opts = ic ? { icon: ic, iconX: extra && extra.iconX != null ? extra.iconX : 5, iconY: Math.round((h - 1 - ICON) / 2) } : {};
        if (extra && extra.ramp) opts.ramp = extra.ramp;
        if (extra && extra.secondary) opts.secondary = true;
        return Object.assign({
            type: 'button', name, x, y, w, h, detail: ctx.kit.hiRes ? HIRES_SCALE : 1,
            png: button(ctx.kit, w, h, false, opts).png(),
            hoverPng: button(ctx.kit, w, h, true, opts).png(),
            label, labelColor: ctx.kit.text, actions, closeOnClick: false,
            tooltip: (extra && extra.tooltip) || ''
        }, extra && extra.closeOnClick ? { closeOnClick: true } : {},
        isItem(icon) ? { _item: { id: icon, x: x + (extra && extra.iconX != null ? extra.iconX : 4), y: y + Math.round((h - 1 - Math.min(16, h - 6)) / 2), s: Math.min(16, h - 6) } } : {});
    }

    /** card button: sunken slot with an icon at the top, texts placed by the caller */
    function cardButton(ctx, name, x, y, w, h, icon, actions, wellSize, tooltip) {
        const ws = wellSize || 20;
        // flat kits: dark cards (the coloured fill is kept for real buttons)
        const opts = { well: { x: Math.round((w - 1 - ws) / 2), y: 5, w: ws, h: ws }, icon: isItem(icon) ? null : drawIcon(icon), secondary: !!(ctx.kit.flat || ctx.kit.hiRes) };
        opts.iconX = opts.well.x + Math.round((ws - ICON) / 2) + 1;
        opts.iconY = opts.well.y + Math.round((ws - ICON) / 2) + 1;
        return {
            type: 'button', name, x, y, w, h, detail: ctx.kit.hiRes ? HIRES_SCALE : 1,
            png: button(ctx.kit, w, h, false, opts).png(),
            hoverPng: button(ctx.kit, w, h, true, opts).png(),
            label: '', labelColor: ctx.kit.text, actions, closeOnClick: false,
            tooltip: tooltip || '',
            ...(isItem(icon) ? { _item: { id: icon, x: x + opts.well.x + 2, y: y + opts.well.y + 2, s: ws - 4 } } : {})
        };
    }

    /** window whose picture can be drawn on before it is turned into a PNG */
    function windowWith(ctx, w, h, title, extra, draw) {
        const bw = Math.min(160, w - 60), bh = 16;
        const opts = Object.assign({ banner: title ? { x: Math.round((w - bw) / 2), y: 5, w: bw, h: bh } : null }, extra || {});
        const b = panel(ctx.kit, w, h, opts);
        if (draw) draw(b);
        const els = [{ type: 'image', name: 'Window', x: 0, y: 0, w, h, detail: ctx.kit.hiRes ? HIRES_SCALE : 1, png: b.png() }];
        if (title) els.push(titleText(ctx, w, opts, bh, title));
        return els;
    }

    const txt = (name, x, y, w, h, text, color, align, scale) => ({ type: 'text', name, x, y, w, h, text, color: color || '#ffffff', shadow: true, align: align || 'center', scale: scale || 1 });

    function backOrClose(ctx, w, h) {
        const hub = ctx.link('hub');
        const bw = 70, bh = 18;
        return iconButton(ctx, hub ? 'Back' : 'Close', w - bw - 12, h - bh - 9, bw, bh, hub ? 'back' : 'cross', hub ? 'Back' : 'Close', hub ? ['open:' + hub] : ['close'], { secondary: true });
    }

    const LAYOUTS = [
        {
            id: 'hub', name: 'Main Menu', th: 'Main hub — 6 large icon buttons', title: 'Main Menu',
            build(ctx) {
                const W = 320, H = 180;
                const els = windowBase(ctx, W, H, ctx.title);
                const items = [
                    ['warps', 'minecraft:ender_pearl', 'Warps'], ['shop', 'minecraft:emerald', 'Shop'],
                    ['profile', 'minecraft:name_tag', 'Profile'], ['rewards', 'minecraft:gold_ingot', 'Daily Rewards'],
                    ['servers', 'minecraft:compass', 'Servers'], [null, 'minecraft:redstone', 'Settings']
                ];
                items.forEach(([key, icon, label], i) => {
                    const col = i % 2, row = Math.floor(i / 2);
                    const target = key && ctx.link(key);
                    const acts = target ? ['open:' + target] : ['message:&7Set the action of "' + label + '" in GUI Studio'];
                    els.push(iconButton(ctx, label, col ? 166 : 26, 32 + row * 34, 128, 26, icon, label, acts));
                });
                els.push(iconButton(ctx, 'Close', 125, 140, 70, 20, 'cross', 'Close', ['close']));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'shop', name: 'Shop', th: 'Store — 4×2 item cards + price + balance', title: 'Shop',
            build(ctx) {
                const W = 320, H = 180;
                const els = windowBase(ctx, W, H, ctx.title);
                const items = [
                    ['minecraft:diamond', 'Diamond', 100, 'diamond'], ['minecraft:gold_ingot', 'Gold', 40, 'gold_ingot'], ['minecraft:iron_sword', 'Sword', 60, 'iron_sword'], ['minecraft:golden_apple', 'Apple', 150, 'golden_apple'],
                    ['minecraft:diamond_pickaxe', 'Pickaxe', 80, 'diamond_pickaxe'], ['minecraft:ender_pearl', 'Pearl', 20, 'ender_pearl'], ['minecraft:nether_star', 'Star', 900, 'nether_star'], ['minecraft:totem_of_undying', 'Totem', 300, 'totem_of_undying']
                ];
                items.forEach(([icon, name, price, item], i) => {
                    const col = i % 4, row = Math.floor(i / 4);
                    const x = 22 + col * 72, y = 28 + row * 58;
                    els.push(cardButton(ctx, name, x, y, 60, 52, icon, [
                        `console:eco take %player_name% ${price}`,
                        `console:give %player_name% ${item} 1`,
                        `message:&aYou bought &f${name}&a!`
                    ], null, `&b&l${name}\n&7Click to buy 1x\n&ePrice: $${price}`));
                    els.push(txt(name + ' name', x + 2, y + 27, 56, 10, name, ctx.kit.text));
                    els.push(txt(name + ' price', x + 2, y + 38, 56, 10, `&e$${price}`, '#ffd75e', 'center', ctx.kit.hiRes ? 0.9 : 1));
                });
                els.push(txt('Balance', 16, H - 25, 160, 12, '&7Balance: &e%vault_eco_balance_formatted%', '#ffffff', 'left'));
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'warps', name: 'Warps', th: 'Warp selector — 3×2 cards', title: 'Warps',
            build(ctx) {
                const W = 320, H = 180;
                const els = windowBase(ctx, W, H, ctx.title);
                const warps = [['minecraft:compass', 'Spawn', 'spawn'], ['minecraft:iron_sword', 'Arena', 'arena'], ['minecraft:emerald', 'Market', 'market'], ['minecraft:wheat', 'Farms', 'farms'], ['minecraft:iron_pickaxe', 'Mines', 'mines'], ['minecraft:ender_eye', 'The End', 'end']];
                warps.forEach(([icon, name, warp], i) => {
                    const col = i % 3, row = Math.floor(i / 3);
                    const x = 20 + col * 96, y = 28 + row * 58;
                    const b = cardButton(ctx, name, x, y, 88, 52, icon, [`player:warp ${warp}`], null, `&a&l${name}\n&7Click to teleport\n&8/warp ${warp}`);
                    b.closeOnClick = true;
                    els.push(b);
                    els.push(txt(name + ' name', x + 2, y + 30, 84, 10, name, ctx.kit.text));
                    els.push(txt(name + ' info', x + 2, y + 40, 84, 8, `&7/warp ${warp}`, '#aaaaaa', 'center', ctx.kit.hiRes ? 0.8 : 1));
                });
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'servers', name: 'Server Selector', th: 'Server selector — 3 tall cards + player count', title: 'Servers',
            build(ctx) {
                const W = 320, H = 180;
                const els = windowBase(ctx, W, H, ctx.title);
                const servers = [['minecraft:diamond_pickaxe', 'Survival', 'survival'], ['minecraft:heart_of_the_sea', 'Skyblock', 'skyblock'], ['minecraft:fire_charge', 'BedWars', 'bedwars']];
                servers.forEach(([icon, name, server], i) => {
                    const x = 16 + i * 98, y = 28;
                    els.push(cardButton(ctx, name, x, y, 92, 112, icon, [`server:${server}`], 26, `&b&l${name}\n&7%bungee_${server}% players online\n&aClick to connect`));
                    els.push(txt(name + ' name', x + 2, y + 38, 88, 12, '&l' + name, ctx.kit.text));
                    els.push(txt(name + ' players', x + 2, y + 54, 88, 10, `&7%bungee_${server}% online`, '#aaaaaa', 'center', ctx.kit.hiRes ? 0.85 : 1));
                    els.push(txt(name + ' join', x + 2, y + 90, 88, 10, '&aClick to join', '#55ff55'));
                });
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'profile', name: 'Profile', th: 'Profile — player info rows (PAPI)', title: 'Profile',
            build(ctx) {
                const W = 240, H = 176;
                const rows = [
                    ['minecraft:name_tag', '&7Name  &f%player_name%'], ['minecraft:experience_bottle', '&7Level  &f%player_level%'], ['minecraft:gold_nugget', '&7Money  &e%vault_eco_balance_formatted%'],
                    ['minecraft:iron_sword', '&7Kills  &f%statistic_player_kills%'], ['minecraft:bone', '&7Deaths  &f%statistic_deaths%']
                ];
                const wells = rows.map((r, i) => ({ x: 14, y: 28 + i * 22, w: 211, h: 19 }));
                const els = windowBase(ctx, W, H, ctx.title, { wells });
                // a real item at the start of each row
                rows.forEach(([icon], i) => els.push(itemEl('Row ' + (i + 1), 17, 28 + i * 22 + 2, 15, icon)));
                rows.forEach(([, text], i) => els.push(txt('Row ' + (i + 1), 36, 28 + i * 22 + 4, 184, 11, text, '#ffffff', 'left')));
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'rewards', name: 'Daily Rewards', th: 'Daily rewards — 7-day track', title: 'Daily Rewards',
            build(ctx) {
                const W = 320, H = 124;
                const els = windowBase(ctx, W, H, ctx.title);
                for (let d = 1; d <= 7; d++) {
                    const x = 15 + (d - 1) * 42, y = 30;
                    const reward = ['bread', 'iron_ingot', 'gold_ingot', 'emerald', 'diamond', 'experience_bottle', 'nether_star'][d - 1];
                    els.push(cardButton(ctx, 'Day ' + d, x, y, 38, 50, 'minecraft:' + reward, [`player:rewards claim ${d}`], 20, `&6&lDay ${d} Reward\n&7Click to claim`));
                    els.push(txt('Day ' + d + ' text', x + 1, y + 30, 36, 10, 'Day ' + d, ctx.kit.text));
                }
                const close = iconButton(ctx, 'Close', 125, H - 30, 70, 18, 'cross', 'Close', ['close']);
                const hub = ctx.link('hub');
                if (hub) { close.name = 'Back'; close.label = 'Back'; close.actions = ['open:' + hub]; }
                els.push(close);
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'confirm', name: 'Confirm', th: 'Confirmation dialog — Yes / No', title: 'Are you sure?',
            build(ctx) {
                const W = 200, H = 100;
                const els = windowBase(ctx, W, H, null);
                els.push(txt('Question', 10, 12, 180, 12, '&l' + ctx.title, ctx.kit.text));
                els.push(txt('Message', 10, 30, 180, 10, '&7This cannot be undone.', '#aaaaaa'));
                els.push(iconButton(ctx, 'Yes', 22, 58, 72, 22, 'check', 'Yes', ['message:&aConfirmed!', 'close'], { ramp: PLATE.moss }));
                els.push(iconButton(ctx, 'No', 106, 58, 72, 22, 'cross', 'No', ['close'], { ramp: PLATE.crimson }));
                return { width: W, height: H, elements: els };
            }
        },
        /* ── player layouts (2026-11-24): placeholder Steve where the player's head / body goes ── */
        {
            id: 'leaderboard', name: 'Leaderboard', th: 'Rankings — top 3 podium (player heads) + ranks 4–7 + your row', title: 'Top Kills',
            build(ctx) {
                const W = 320, H = 180, k = ctx.kit;
                const lb = (n, f) => `%ajlb_lb_statistic_player_kills_${n}_alltime_${f}%`;
                const pods = [
                    { n: 2, x: 18, y: 104, w: 38, h: 48, ramp: M.iron, s: 2 },
                    { n: 1, x: 60, y: 86, w: 40, h: 66, ramp: M.gold, s: 3 },
                    { n: 3, x: 104, y: 116, w: 38, h: 36, ramp: M.bronze, s: 2 },
                ];
                const rows = [4, 5, 6, 7].map((n, i) => ({ n, x: 152, y: 30 + i * 21, w: 154, h: 18 }));
                const you = { x: 152, y: 118, w: 154, h: 18 };
                const els = windowWith(ctx, W, H, ctx.title, { wells: rows }, (b) => {
                    pods.forEach(p => rimWell(b, k, p.ramp, p.x, p.y, p.w, p.h));
                    rimWell(b, k, k.gem, you.x, you.y, you.w, you.h);
                });
                pods.forEach(p => {
                    const hs = 8 * p.s;
                    els.push(headEl('#' + p.n, p.x + Math.floor((p.w - hs) / 2), p.y - hs - 3, p.s, lb(p.n, 'name')));
                    els.push(txt('#' + p.n + ' rank', p.x + 1, p.y + 3, p.w - 2, 10, '&l' + p.n, p.ramp[5]));
                    els.push(txt('#' + p.n + ' name', p.x + 1, p.y + 13, p.w - 2, 10, lb(p.n, 'name'), '#ffffff'));
                    els.push(txt('#' + p.n + ' kills', p.x + 1, p.y + 23, p.w - 2, 10, '&7' + lb(p.n, 'value'), '#aaaaaa'));
                });
                rows.forEach(r => {
                    els.push(txt('#' + r.n + ' rank', r.x + 2, r.y + 4, 14, 10, '&7' + r.n, '#aaaaaa'));
                    els.push(headEl('#' + r.n, r.x + 19, r.y + 4, 1, lb(r.n, 'name')));
                    els.push(txt('#' + r.n + ' name', r.x + 33, r.y + 4, 80, 10, lb(r.n, 'name'), '#ffffff', 'left'));
                    els.push(txt('#' + r.n + ' kills', r.x + 110, r.y + 4, 40, 10, lb(r.n, 'value'), k.text, 'right'));
                });
                els.push(txt('You rank', you.x + 2, you.y + 4, 14, 10, '&e%ajlb_position_statistic_player_kills_alltime%', '#ffff55'));
                els.push(headEl('You', you.x + 19, you.y + 4, 1));
                els.push(txt('You name', you.x + 33, you.y + 4, 80, 10, '%player_name%', '#ffffff', 'left'));
                els.push(txt('You kills', you.x + 110, you.y + 4, 40, 10, '%statistic_player_kills%', '#ffff55', 'right'));
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'friends', name: 'Friends', th: 'Friends — 2×4 player head cards + name + status', title: 'Friends',
            build(ctx) {
                const W = 320, H = 180;
                const els = windowWith(ctx, W, H, ctx.title);
                for (let i = 0; i < 8; i++) {
                    const col = i % 2, row = Math.floor(i / 2);
                    const x = 18 + col * 146, y = 28 + row * 31, name = 'Friend ' + (i + 1);
                    const on = i < 3;
                    const btn = {
                        type: 'button', name, x, y, w: 138, h: 28,
                        png: button(ctx.kit, 138, 28, false, { well: { x: 4, y: 2, w: 22, h: 22 } }).png(),
                        hoverPng: button(ctx.kit, 138, 28, true, { well: { x: 4, y: 2, w: 22, h: 22 } }).png(),
                        label: '', labelColor: ctx.kit.text, actions: ['message:&7Set the action of "' + name + '" in GUI Studio'], closeOnClick: false
                    };
                    els.push(btn);
                    els.push(headEl(name, x + 7, y + 4, 2, 'Friend' + (i + 1)));
                    els.push(txt(name + ' name', x + 30, y + 4, 104, 10, name, ctx.kit.text, 'left'));
                    els.push(txt(name + ' status', x + 30, y + 14, 104, 9, on ? '&a● Online' : '&7● Offline', on ? '#55ff55' : '#aaaaaa', 'left'));
                }
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'character', name: 'Character', th: 'Character sheet — full player model + armor slots + stats', title: '%player_name%',
            build(ctx) {
                const W = 320, H = 180, k = ctx.kit;
                const stage = { x: 112, y: 26, w: 96, h: 124 };
                const slots = [30, 56, 82, 108].flatMap(y => [{ x: 86, y, w: 22, h: 22 }, { x: 212, y, w: 22, h: 22 }]);
                const stats = [['heart', '&f%player_health_rounded%'], ['apple', '&f%player_food_level%'], ['star', '&fLv %player_level%'], ['sword', '&f%statistic_player_kills%'], ['coin', '&e%vault_eco_balance_formatted%']];
                const srows = stats.map((s, i) => ({ x: 14, y: 30 + i * 22, w: 66, h: 19 }));
                const info = [['Rank', '%vault_rank%'], ['Ping', '%player_ping%ms'], ['Played', '%statistic_hours_played%h']];
                const irows = info.map((s, i) => ({ x: 242, y: 30 + i * 30, w: 66, h: 26 }));
                const els = windowWith(ctx, W, H, ctx.title, { wells: [...slots, ...srows, ...irows] }, (b) => {
                    rimWell(b, k, k.metal, stage.x, stage.y, stage.w, stage.h);
                    // floor line the model stands on (hiRes stage draws its own pedestal)
                    if (!k.hiRes) for (let i = 8; i < stage.w - 8; i++) b.px(stage.x + i, stage.y + stage.h - 12, k.metal[2]);
                    stats.forEach(([icon], i) => b.blit(drawIcon(icon), srows[i].x + 3, srows[i].y + 4));
                });
                els.push(bodyEl('You', stage.x + Math.floor((stage.w - 48) / 2), stage.y + stage.h - 12 - 96, 3, null, { turn: 'cursor', tooltip: '&eDrag to rotate\n&7Click model, move mouse, click to drop' }));
                // what the player wears / holds, in the slots beside the model (Java)
                const worn = [['Helmet', 'slot:head'], ['Main hand', 'slot:hand'], ['Chestplate', 'slot:chest'], ['Off hand', 'slot:offhand'], ['Leggings', 'slot:legs'], null, ['Boots', 'slot:feet'], null];
                worn.forEach((w, i) => { if (w) els.push(itemEl(w[0], slots[i].x + 3, slots[i].y + 3, 16, w[1], { tooltip: `&f${w[0]}\n&7Equipped gear` })); });
                stats.forEach(([, text], i) => els.push(txt('Stat ' + (i + 1), srows[i].x + 18, srows[i].y + 5, 46, 10, text, '#ffffff', 'left')));
                info.forEach(([label, text], i) => {
                    const lbl = k.hiRes ? '&7' + label.toUpperCase() : '&7' + label;
                    const lCol = k.hiRes && k.rpg ? k.rpg.mutedText : '#aaaaaa';
                    els.push(txt(label + ' label', irows[i].x + 2, irows[i].y + 3, 62, 9, lbl, lCol, 'center', k.hiRes ? 0.75 : 1));
                    els.push(txt(label, irows[i].x + 2, irows[i].y + 13, 62, 10, text, k.text));
                });
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'wardrobe', name: 'Wardrobe', th: 'Wardrobe — click armor pieces to preview live on 3D player', title: 'Wardrobe',
            build(ctx) {
                const W = 320, H = 180, k = ctx.kit;
                const left = { x: 10, y: 26, w: 138, h: 146 }, stage = { x: 152, y: 26, w: 74, h: 146 }, right = { x: 230, y: 26, w: 80, h: 112 };
                const parts = [['Helmet', 'head', 'helmet'], ['Chestplate', 'chest', 'chestplate'], ['Leggings', 'legs', 'leggings'], ['Boots', 'feet', 'boots']];
                const mats = [['leather', 'leather'], ['chainmail', 'chainmail'], ['iron', 'iron'], ['golden', 'golden'], ['diamond', 'diamond'], ['netherite', 'netherite']];
                const els = windowWith(ctx, W, H, ctx.title, { wells: [left, right] }, (b) => {
                    rimWell(b, k, k.metal, stage.x, stage.y, stage.w, stage.h);
                    for (let i = 8; i < stage.w - 8; i++) b.px(stage.x + i, stage.y + stage.h - 14, k.metal[2]);
                });
                parts.forEach(([label, slot, piece], r) => {
                    const y = left.y + 4 + r * 35;
                    els.push(txt(label, left.x + 4, y, 90, 9, '&7' + label, '#aaaaaa', 'left'));
                    const take = `console:item replace entity %player_name% armor.${slot} with `;
                    // first button: take it off
                    els.push(iconButton(ctx, label + ' off', left.x + 4, y + 11, 18, 19, 'cross', '', [take + 'minecraft:air'], { iconX: 3 }));
                    els[els.length - 1].label = '';
                    mats.forEach(([m], j) => {
                        const bx = left.x + 23 + j * 19, id = `minecraft:${m}_${piece}`;
                        els.push(iconButton(ctx, `${label} ${m}`, bx, y + 11, 18, 19, null, '', [take + id]));
                        els.push(itemEl(`${label} ${m}`, bx + 1, y + 12, 15, id));
                    });
                });
                els.push(bodyEl('You', stage.x + Math.floor((stage.w - 48) / 2), stage.y + stage.h - 14 - 96, 3, null, { turn: 'spin', spinSpeed: 40 }));
                const rows = [['Name', '%player_name%'], ['Health', '&c%player_health_rounded%'], ['Level', '&a%player_level%']];
                rows.forEach(([l, v], i) => {
                    els.push(txt(l + ' label', right.x + 4, right.y + 6 + i * 26, 72, 9, '&7' + l, '#aaaaaa', 'left'));
                    els.push(txt(l, right.x + 4, right.y + 15 + i * 26, 72, 10, v, k.text, 'left'));
                });
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'outfits', name: 'Wardrobe (outfits)', th: 'Wardrobe — cursor-tracking 3D player + 4 category buttons (best with Flat kits)', title: 'Wardrobe',
            build(ctx) {
                const W = 300, H = 210, k = ctx.kit;
                const stage = { x: 8, y: 25, w: 118, h: 177 };
                const els = windowWith(ctx, W, H, ctx.title, null, (b) => {
                    rimWell(b, k, k.metal, stage.x, stage.y, stage.w, stage.h);
                    if (!k.flat) for (let i = 8; i < stage.w - 8; i++) b.px(stage.x + i, stage.y + stage.h - 16, k.metal[2]);
                });
                if (k.flat) els.push(txt('Player name', W - 112, 5, 104, 12, '%player_name%', '#c9d2e3', 'right'));
                els.push(bodyEl('You', stage.x + Math.floor((stage.w - 64) / 2), stage.y + 12, 4, null, { turn: 'drag' }));
                els.push(txt('Hint', stage.x + 2, stage.y + stage.h - 13, stage.w - 4, 9, '&7Drag to turn', '#aaaaaa'));
                els.push(txt('Pick', 134, 25, 158, 10, 'Pick what to wear', k.text, 'left'));
                const link = (key) => ctx.link(key);
                [['Hats', 'hats'], ['Capes', 'capes'], ['Pets', 'pets'], ['Emotes', 'emotes']].forEach(([label, key], i) => {
                    const acts = link(key) ? ['open:' + link(key)] : [`message:&7Set the action of "${label}" in GUI Studio`];
                    els.push(iconButton(ctx, label, 134, 38 + i * 24, 158, 20, null, label, acts));
                });
                const close = iconButton(ctx, 'Close', 134, H - 28, 158, 18, null, 'Close', ['close'], { secondary: true });
                const hub = ctx.link('hub');
                if (hub) { close.name = 'Back'; close.label = 'Back'; close.actions = ['open:' + hub]; }
                els.push(close);
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'party', name: 'Party', th: 'Party — 4 player slots + Invite + Ready / Leave', title: 'Party',
            build(ctx) {
                const W = 320, H = 180, k = ctx.kit;
                const st = [0, 1, 2, 3].map(i => ({ x: 16 + i * 74, y: 26, w: 68, h: 112 }));
                const els = windowWith(ctx, W, H, ctx.title, null, (b) => {
                    st.forEach((s, i) => (i === 0 ? rimWell(b, k, k.gem, s.x, s.y, s.w, s.h) : well(b, k, s.x, s.y, s.w, s.h)));
                });
                const names = ['&e★ &f%player_name%', 'Member2', 'Member3'];
                names.forEach((nm, i) => {
                    const s = st[i];
                    els.push(bodyEl(i ? 'Member ' + (i + 1) : 'You', s.x + Math.floor((s.w - 32) / 2), s.y + 9, 2, i ? nm : null));
                    els.push(txt('Slot ' + (i + 1) + ' name', s.x + 2, s.y + 82, s.w - 4, 10, names[i], '#ffffff'));
                    els.push(txt('Slot ' + (i + 1) + ' status', s.x + 2, s.y + 95, s.w - 4, 9, i < 2 ? '&aReady' : '&7Not ready', i < 2 ? '#55ff55' : '#aaaaaa'));
                });
                const inv = iconButton(ctx, 'Invite', st[3].x + 6, st[3].y + 46, 56, 20, 'user', 'Invite', ['message:&7Type &f/party invite <name>']);
                els.push(inv);
                els.push(iconButton(ctx, 'Ready', 16, H - 27, 80, 18, 'check', 'Ready', ['player:party ready'], { ramp: PLATE.moss }));
                els.push(iconButton(ctx, 'Leave', 102, H - 27, 80, 18, 'cross', 'Leave', ['player:party leave', 'close'], { ramp: PLATE.crimson }));
                els.push(backOrClose(ctx, W, H));
                return { width: W, height: H, elements: els };
            }
        },
        {
            id: 'duel', name: 'Duel', th: 'Duel — 2-sided player comparison + stats + Accept / Decline', title: 'Duel',
            build(ctx) {
                const W = 320, H = 156, k = ctx.kit;
                const L = { x: 14, y: 26, w: 72, h: 88 }, R = { x: 234, y: 26, w: 72, h: 88 };
                const stats = [['heart', '%player_health_rounded%', '?'], ['sword', '%statistic_player_kills%', '?'], ['star', '%player_level%', '?'], ['trophy', '0', '?']];
                const rows = stats.map((s, i) => ({ x: 94, y: 28 + i * 21, w: 132, h: 18 }));
                const els = windowWith(ctx, W, H, ctx.title, { wells: rows }, (b) => {
                    rimWell(b, k, k.gem, L.x, L.y, L.w, L.h);
                    rimWell(b, k, GEM.red, R.x, R.y, R.w, R.h);
                    stats.forEach(([icon], i) => b.blit(drawIcon(icon), rows[i].x + 60, rows[i].y + 3));
                });
                [[L, 'You', null], [R, 'Opponent', 'Opponent']].forEach(([s, who, pl]) => {
                    els.push(bodyEl(who, s.x + Math.floor((s.w - 32) / 2), s.y + Math.floor((s.h - 64) / 2), 2, pl));
                });
                els.push(txt('You name', L.x, L.y + L.h + 3, L.w, 10, '%player_name%', '#ffffff'));
                els.push(txt('Opponent name', R.x, R.y + R.h + 3, R.w, 10, 'Opponent', '#ffffff'));
                stats.forEach(([, a, bb], i) => {
                    els.push(txt('Stat ' + (i + 1) + ' you', rows[i].x + 4, rows[i].y + 4, 52, 10, a, '#ffffff', 'right'));
                    els.push(txt('Stat ' + (i + 1) + ' opponent', rows[i].x + 76, rows[i].y + 4, 52, 10, bb, '#ffffff', 'left'));
                });
                els.push(iconButton(ctx, 'Accept', 94, H - 30, 62, 20, 'check', 'Accept', ['player:duel accept', 'close'], { ramp: PLATE.moss }));
                els.push(iconButton(ctx, 'Decline', 164, H - 30, 62, 20, 'cross', 'Decline', ['player:duel deny', 'close'], { ramp: PLATE.crimson }));
                return { width: W, height: H, elements: els };
            }
        },
    ];

    /** Which pages a "linked set" makes, in order */
    const SET = ['hub', 'shop', 'warps', 'servers', 'profile', 'rewards'];

    function kit(id) { return KITS.find(k => k.id === id) || KITS[0]; }
    function layout(id) { return LAYOUTS.find(l => l.id === id) || LAYOUTS[0]; }

    /** Builds one page: { width, height, elements } */
    function build(layoutId, kitId, opts) {
        opts = opts || {};
        const L = layout(layoutId);
        const page = L.build({
            kit: kit(kitId),
            title: opts.title || L.title,
            link: (key) => (opts.links && opts.links[key]) || null
        });
        // buttons that asked for a real item get an Item element right above them
        const out = [];
        page.elements.forEach(e => {
            const it = e._item;
            delete e._item;
            out.push(e);
            if (it) out.push(itemEl(e.name, it.x, it.y, it.s, it.id));
        });
        page.elements = out;
        return page;
    }

    /* ───────────── preview (canvas) ───────────── */

    const MC = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
    const SAMPLE = (s) => String(s || '').replace(/%player_name%/g, 'Steve').replace(/%vault_eco_balance(_formatted)?%/g, '1,250').replace(/%player_level%/g, '12')
        .replace(/%statistic_player_kills%/g, '37').replace(/%statistic_deaths%/g, '5').replace(/%bungee_[a-z]+%/g, '24')
        .replace(/%ajlb_lb_[a-z_]+?_(\d+)_[a-z]+_name%/g, (m, n) => ['Notch', 'Alex', 'Kaizer', 'Mochi', 'Boba', 'Taro', 'Kiwi'][(n - 1) % 7])
        .replace(/%ajlb_lb_[a-z_]+?_(\d+)_[a-z]+_value%/g, (m, n) => String(Math.max(40, 980 - n * 115))).replace(/%ajlb_position_[a-z_]+%/g, '24')
        .replace(/%player_health_rounded%/g, '20').replace(/%player_food_level%/g, '18').replace(/%vault_rank%/g, 'VIP').replace(/%player_ping%/g, '32')
        .replace(/%statistic_hours_played%/g, '48');

    function runs(text, base) {
        const out = [];
        let col = base, bold = false, cur = '';
        const s = SAMPLE(text);
        for (let i = 0; i < s.length; i++) {
            if ((s[i] === '&' || s[i] === '§') && i + 1 < s.length) {
                const c = s[i + 1].toLowerCase();
                if (MC[c] || c === 'l' || c === 'r') {
                    if (cur) out.push({ t: cur, col, bold });
                    cur = '';
                    if (MC[c]) { col = MC[c]; bold = false; } else if (c === 'l') bold = true; else { col = base; bold = false; }
                    i++; continue;
                }
            }
            cur += s[i];
        }
        if (cur) out.push({ t: cur, col, bold });
        return out;
    }

    /** Draws a built page (or project menu w/ images map) on a canvas at `scale` */
    async function renderPreview(page, scale, hoverIndex) {
        const c = document.createElement('canvas');
        c.width = page.width * scale; c.height = page.height * scale;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const imgs = page.images || {};
        const imgOf = (id) => (id && imgs[id] && imgs[id].data) || null;
        let bi = -1;
        for (const e of (page.elements || [])) {
            if (e.hidden) continue;
            if (e.type === 'image' || e.type === 'button') {
                if (e.type === 'button') bi++;
                const isHov = e.type === 'button' && bi === hoverIndex;
                const hovSrc = isHov ? (e.hoverPng || imgOf(e.hoverImage)) : null;
                const normSrc = e.png || imgOf(e.image);
                const src = hovSrc || normSrc;
                if (src) {
                    const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
                    if (img) {
                        g.imageSmoothingEnabled = (e.detail || 1) > 1;
                        g.drawImage(img, e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                        g.imageSmoothingEnabled = false;
                    }
                } else if (e.type === 'button') {
                    g.fillStyle = isHov ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)';
                    g.fillRect(e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                    g.strokeStyle = 'rgba(255,255,255,.25)';
                    g.strokeRect(e.x * scale + 0.5, e.y * scale + 0.5, e.w * scale - 1, e.h * scale - 1);
                }
                if (e.type === 'button' && e.label) drawText(g, e.label, e.labelColor, e.x, e.y, e.w, e.h, 'center', scale, e.labelScale || 1);
            } else if (e.type === 'item') {
                const src = GS.Items && GS.Items.url(e.item);
                if (src) {
                    const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
                    if (img) g.drawImage(img, e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                } else {
                    g.strokeStyle = 'rgba(120,200,255,.6)'; g.setLineDash([2, 2]);
                    g.strokeRect(e.x * scale + 0.5, e.y * scale + 0.5, e.w * scale - 1, e.h * scale - 1); g.setLineDash([]);
                }
            } else if (e.type === 'custom_model') {
                const src = GS.CustomAssets && GS.CustomAssets.iconUrl(e.modelId);
                if (src) {
                    const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
                    if (img) g.drawImage(img, e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                } else {
                    g.fillStyle = 'rgba(145,115,255,.12)';
                    g.fillRect(e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                    g.strokeStyle = 'rgba(170,130,255,.65)'; g.setLineDash([2, 2]);
                    g.strokeRect(e.x * scale + 0.5, e.y * scale + 0.5, e.w * scale - 1, e.h * scale - 1); g.setLineDash([]);
                }
            } else if (e.type === 'input') {
                g.fillStyle = e.bgColor || '#161b26';
                g.fillRect(e.x * scale, e.y * scale, e.w * scale, e.h * scale);
                g.strokeStyle = e.borderColor || '#52a0f0';
                g.strokeRect(e.x * scale + 0.5, e.y * scale + 0.5, e.w * scale - 1, e.h * scale - 1);
                const disp = `${e.prefix || ''}${e.defaultValue == null ? '1' : e.defaultValue}${e.suffix || ''}`;
                drawText(g, disp, e.textColor || '#ffffff', e.x, e.y, e.w, e.h, e.align || 'center', scale, e.scale || 1);
            } else if (e.type === 'player_head' || e.type === 'player_model') {
                // the same stand-in pictures GUI Studio shows on the canvas
                const src = (GS.Items && GS.Items.skinArt(e.type, e.angle)) || (e.type === 'player_head' ? 'img/player_head.png' : 'img/player_model.png');
                const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
                if (img) g.drawImage(img, e.x * scale, e.y * scale, e.w * scale, e.h * scale);
            } else if (e.type === 'text') {
                drawText(g, e.text, e.color, e.x, e.y, e.w, e.h, e.align, scale, e.scale || 1);
            }
        }
        return c;
    }

    function drawText(g, text, color, x, y, w, h, align, scale, textScale) {
        const ts = (textScale || 1) * scale;
        const parts = runs(text, color || '#ffffff');
        g.font = `${8 * ts}px Minecraftia, monospace`;
        g.textBaseline = 'alphabetic';
        const widthOf = (p) => { g.font = `${p.bold ? 'bold ' : ''}${8 * ts}px Minecraftia, monospace`; return g.measureText(p.t).width; };
        const total = parts.reduce((n, p) => n + widthOf(p), 0);
        let cx = align === 'left' ? x * scale : align === 'right' ? (x + w) * scale - total : (x + w / 2) * scale - total / 2;
        // like the game: an 8 px glyph box centred in the element, capitals 7 px tall from its top
        g.font = `${8 * ts}px Minecraftia, monospace`;
        const capTop = g.measureText('M').actualBoundingBoxAscent || 7 * ts;
        const cy = (y + h / 2) * scale - 4 * ts + capTop;
        for (const p of parts) {
            g.font = `${p.bold ? 'bold ' : ''}${8 * ts}px Minecraftia, monospace`;
            g.fillStyle = 'rgba(0,0,0,.6)';
            g.fillText(p.t, cx + scale, cy + scale);
            g.fillStyle = p.col;
            g.fillText(p.t, cx, cy);
            cx += g.measureText(p.t).width;
        }
    }

    GS.Templates = { KITS, LAYOUTS, SET, build, renderPreview, drawIcon, panel, button, Buf, ICONS: Object.keys(ICONS), PALETTES: { metal: M, plate: PLATE, gem: GEM, inset: INSET } };
})();
