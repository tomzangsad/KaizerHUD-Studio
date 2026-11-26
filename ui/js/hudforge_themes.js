/* ========================================
   HUD Forge — style kits (hand-picked palettes) + sprites + presets

   Pixel-art rules every kit follows (from pixel-art UI guides):
     • ONE light source, top-left, for every piece (no "pillow" shading)
     • each material = a hand-picked ramp of 6 shades  [outline, dark2, dark, base, light, highlight]
       — shadows lean blue/purple, highlights lean yellow; the outline is the material's own
       darkest shade (selective outline), not pure black
     • small pieces get one highlight, nothing more
     • frames are 9-slice style: one design that stretches to any size
     • every piece casts a 1px drop shadow, knobs / gems / crests are lit like 3D objects

   Kit fields
     metal   ramp of the frame / rim / caps / brackets
     plate   ramp of the frame body (the flat face inside the rim)
     inset   ramp of recessed things: bar channels, sockets, slots, text plates
     gem     ramp of gems (bar end gems, crest, finials)
     leaf    ramp used by leaf decorations (optional)
     rimW    rim thickness (2 = chunky bevel)
     shape   rect | round | chamfer           cap  none | knob | gem | blade | notch | slant
     orn     brackets | gems | rivets | studs | leaves | flowers | hearts | gears
     badge   level crest: diamond | circle | square | shield
     texture plate pattern: none | wood | brick | scan
   ======================================== */
(function () {
    'use strict';

    /* hand-picked fill ramps for the bars  [outline, dark2, dark, base, light, highlight] */
    const STAT_RAMPS = {
        hp: ['#3a0812', '#7a0f1d', '#b81d2c', '#e53a3f', '#ff7f73', '#ffd2c8'],
        food: ['#3a1a05', '#7a3a08', '#b8620f', '#e8902a', '#ffc061', '#ffe9b8'],
        armor: ['#1a222b', '#3c4a57', '#6b7c8c', '#a3b4c4', '#d2dee9', '#f6fbff'],
        air: ['#06203a', '#0b4a7a', '#1683c2', '#36b4ee', '#8ae0ff', '#e0f8ff'],
        xp: ['#123a05', '#2a6b0a', '#47a114', '#76d22a', '#b6f56c', '#ecffd0'],
        mana: ['#14063a', '#2a1478', '#4630c2', '#6e5cf0', '#a99cff', '#e6e2ff'],
    };
    const STAT_COLORS = {};
    for (const k in STAT_RAMPS) STAT_COLORS[k] = STAT_RAMPS[k][3];

    /* materials */
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

    const GROUPS = [
        { id: 'fantasy', name: 'Fantasy / Medieval', th: 'Fantasy & Medieval palettes' },
        { id: 'nature', name: 'Nature / Cute', th: 'Natural, cozy & pastel palettes' },
        { id: 'tech', name: 'MMO / Modern / Tech', th: 'Sleek MMO, modern & sci-fi palettes' },
        { id: 'block', name: 'Survival / Blocky', th: 'Classic Survival & blocky palettes' },
    ];

    const THEMES = [
        /* ───────── Fantasy / Medieval ───────── */
        { id: 'royal', name: 'Sapphire Gilt', th: 'Royal navy with gold trim', group: 'fantasy',
            metal: M.gold, plate: PLATE.navy, inset: INSET.navy, gem: GEM.red, rimW: 2, shape: 'rect',
            cap: 'gem', orn: ['brackets'], badge: 'diamond', text: '#fff4bf' },
        { id: 'ironkeep', name: 'Ironbark', th: 'Dark oak framed in iron', group: 'fantasy',
            metal: M.iron, plate: PLATE.darkwood, inset: INSET.wood, gem: GEM.red, rimW: 2, shape: 'rect', texture: 'wood',
            cap: 'knob', orn: ['rivets'], badge: 'circle', text: '#f1e2cc' },
        { id: 'ember', name: 'Cinderglass', th: 'Obsidian glass with bronze rim', group: 'fantasy',
            metal: M.bronze, plate: PLATE.obsidian, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'chamfer', r: 2,
            cap: 'blade', orn: ['studs'], badge: 'diamond', text: '#ffd9a8' },
        { id: 'frost', name: 'Glacier', th: 'Frosted ice and silver trim', group: 'fantasy',
            metal: M.frost, plate: PLATE.ice, inset: INSET.ice, gem: GEM.blue, rimW: 2, shape: 'round', r: 2,
            cap: 'gem', orn: ['brackets'], badge: 'diamond', text: '#eaf7ff' },
        { id: 'arcane', name: 'Nightshade', th: 'Arcane violet with gold trim', group: 'fantasy',
            metal: M.gold, plate: PLATE.violet, inset: INSET.violet, gem: GEM.purple, rimW: 2, shape: 'rect',
            cap: 'gem', orn: ['gems'], badge: 'diamond', text: '#f0dcff' },
        { id: 'crimson', name: 'Garnet', th: 'Deep crimson with iron rim', group: 'fantasy',
            metal: M.iron, plate: PLATE.crimson, inset: INSET.dark, gem: GEM.red, rimW: 2, shape: 'chamfer', r: 2,
            cap: 'blade', orn: ['studs'], badge: 'shield', text: '#f0d8c8' },

        /* ───────── Nature / Cute ───────── */
        { id: 'sylvan', name: 'Mossgrove', th: 'Forest moss and oak frame', group: 'nature',
            metal: M.oak, plate: PLATE.moss, inset: INSET.moss, gem: GEM.green, leaf: M.leaf, rimW: 2, shape: 'round', r: 2,
            cap: 'knob', orn: ['leaves'], badge: 'circle', text: '#f2ffe0' },
        { id: 'honey', name: 'Amberwood', th: 'Warm honey wood and oak', group: 'nature',
            metal: M.oak, plate: PLATE.honey, inset: INSET.wood, gem: GEM.amber, rimW: 2, shape: 'round', r: 2, texture: 'wood',
            cap: 'knob', orn: ['rivets'], badge: 'circle', text: '#fff0d0' },
        { id: 'candy', name: 'Bubblegum', th: 'Sweet rose pink and white rim', group: 'nature',
            metal: M.white, plate: PLATE.rose, inset: INSET.rose, gem: GEM.pink, rimW: 2, shape: 'round', r: 3,
            cap: 'knob', orn: ['hearts'], badge: 'circle', text: '#ffffff' },

        /* ───────── MMO / Modern / Tech ───────── */
        { id: 'tech', name: 'Cyan Circuit', th: 'Sleek steel with cyan glow', group: 'tech',
            metal: M.steel, plate: PLATE.slate, inset: INSET.slate, gem: GEM.cyan, rimW: 1, shape: 'chamfer', r: 2,
            cap: 'slant', orn: [], badge: 'square', text: '#cfefff', accentRamp: M.cyan },
        { id: 'slate', name: 'Graphite', th: 'Minimal dark charcoal and grey', group: 'tech',
            metal: M.grey, plate: PLATE.charcoal, inset: INSET.slate, gem: GEM.blue, rimW: 1, shape: 'rect',
            cap: 'none', orn: [], badge: 'square', text: '#ffffff', accentRamp: M.white },
        { id: 'amethyst', name: 'Orchid', th: 'Soft amethyst and violet slate', group: 'tech',
            metal: M.amethyst, plate: PLATE.violet, inset: INSET.violet, gem: GEM.purple, rimW: 1, shape: 'chamfer', r: 2,
            cap: 'slant', orn: [], badge: 'diamond', text: '#f0e8ff' },

        /* ───────── Survival / Blocky ───────── */
        { id: 'vanilla', name: 'Cobble', th: 'Classic stone grey', group: 'block',
            metal: M.stone, plate: PLATE.vanilla, inset: INSET.grey, gem: GEM.green, rimW: 1, shape: 'rect',
            cap: 'none', orn: [], badge: 'square', text: '#ffffff' },
        { id: 'nether', name: 'Magma Brick', th: 'Nether brick with molten amber', group: 'block',
            metal: M.netherbrick, plate: PLATE.crimson, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'rect', texture: 'brick',
            cap: 'blade', orn: ['studs'], badge: 'square', text: '#ffd9a8' },
        { id: 'cozyoak', name: 'Chestnut', th: 'Dark plank wood and oak frame', group: 'block',
            metal: M.oak, plate: PLATE.darkwood, inset: INSET.wood, gem: GEM.amber, rimW: 2, shape: 'rect', texture: 'wood',
            cap: 'none', orn: ['rivets'], badge: 'square', text: '#fff0d0' },

        /* ───────── added 2026-11-21 (set 4) ───────── */
        { id: 'abyss', name: 'Abyss Teal', th: 'Deep sea teal with iron rim', group: 'fantasy',
            metal: M.iron, plate: PLATE.teal, inset: INSET.dark, gem: GEM.cyan, rimW: 2, shape: 'chamfer', r: 2,
            cap: 'blade', orn: ['studs'], badge: 'diamond', text: '#d8fff6' },
        { id: 'sunforge', name: 'Sunforge', th: 'Forged bronze rust with gold rim', group: 'fantasy',
            metal: M.gold, plate: PLATE.rust, inset: INSET.dark, gem: GEM.amber, rimW: 2, shape: 'rect',
            cap: 'gem', orn: ['brackets'], badge: 'diamond', text: '#ffe8c0' },
        { id: 'verdigris', name: 'Verdigris', th: 'Patina copper on dark charcoal', group: 'tech',
            metal: M.verdigris, plate: PLATE.charcoal, inset: INSET.slate, gem: GEM.green, rimW: 1, shape: 'chamfer', r: 2,
            cap: 'slant', orn: [], badge: 'square', text: '#e0fff4', accentRamp: M.verdigris },
    ];

    /* fill in the engine fields from the ramps */
    for (const t of THEMES) {
        t.outline = t.metal[0];
        t.rim = t.metal[3];
        t.body = t.plate[3];
        t.inner = t.inset[0];
        t.channel = t.inset[3];
        t.slot = t.inset[3];
        t.gem = t.gem[3];
        t.gemRamp = GEM[Object.keys(GEM).find((k) => GEM[k][3] === t.gem)];
        t.ornColor = t.metal[3];
        t.accent = (t.accentRamp || t.metal)[3];
        t.texture = t.texture || 'none';
        t.fill = 'gloss';
        t.shadow = true;
        if (t.leaf) t.leafColor = t.leaf[3];
    }
    /* every ramp the engine may look up by its base colour */
    const RAMPS = [...Object.values(STAT_RAMPS), ...Object.values(M), ...Object.values(PLATE), ...Object.values(INSET), ...Object.values(GEM)];

    /*
     * Sprites — roles: .=clear o=outline b=base l=light d=dark w=highlight
     * (decorations use the ornament colour; g/h = gem colour/gem shine, y = yellow)
     */
    const ICONS = {
        heart: ['.oo...oo.', 'owlo.oblo', 'olbbobbbo', 'obbbbbbdo', 'obbbbbbdo', '.obbbbdo.', '..obbdo..', '...odo...', '....o....'],
        food: ['.....ooo.', '....obbbo', '...obllbo', '...obbbbo', '...obbbdo', '..owoddo.', '.owwoo...', 'owwo.....', '.oo......'],
        armor: ['ooo...ooo', 'oblo.olbo', 'obbooobbo', '.obbwbbo.', '.obbwbbo.', '.obbwbdo.', '.obbbbdo.', '.obbbddo.', '.ooooooo.'],
        air: ['..ooooo..', '.obbbbbo.', 'obwwbbbbo', 'obwbbbbbo', 'obbbbbbbo', 'obbbbbbdo', 'obbbbbddo', '.obbdddo.', '..ooooo..'],
        xp: ['....o....', '...obo...', 'oooobwooo', 'obbbbbbbo', '.obbbbbo.', '..obbbo..', '.obbobbo.', '.obo.obo.', '.oo...oo.'],
        mana: ['....o....', '...obo...', '..obbbo..', '.obwbbbo.', '.obwbbbo.', 'obwbbbbdo', 'obbbbbbdo', '.obbbddo.', '..ooooo..'],
        coin: ['..ooooo..', '.obllbbo.', 'oblbbbbdo', 'oblbobbdo', 'oblbobbdo', 'oblbobbdo', 'obbbbbbdo', '.obbbbdo.', '..ooooo..'],
        clock: ['..ooooo..', '.owwwwwo.', 'owwwowwwo', 'owwwowwwo', 'owwwoodwo', 'owwwwwwwo', 'owdwwwdwo', '.owwwwwo.', '..ooooo..'],
        pin: ['...ooo...', '..obbbo..', '.obbwbbo.', '.obwwwbo.', '.obbwbbo.', '..obbdo..', '..obbdo..', '...obo...', '....o....'],
        person: ['...ooo...', '..obbbo..', '..obwbo..', '..obbdo..', '...ooo...', '.obbbbbo.', 'obbbbbbdo', 'obbbbbbdo', 'ooooooooo'],
    };
    /* 7×7 icons for pip rows (10 little hearts / shields / bubbles …) */
    const PIPS = {
        hp: ['.oo.oo.', 'owbobbo', 'obbbbdo', 'obbbbdo', '.obbdo.', '..odo..', '...o...'],
        armor: ['ooooooo', 'owbbbdo', 'olbbbdo', '.obbbo.', '.obbdo.', '..obo..', '...o...'],
        air: ['..ooo..', '.owbbo.', 'owbbbdo', 'obbbbdo', 'obbbddo', '.obddo.', '..ooo..'],
        food: ['...ooo.', '..obbbo', '..owbdo', '.oobdo.', 'owo.o..', 'oo.....', '.......'],
        xp: ['...o...', '..obo..', 'oobwboo', 'obbbbdo', '.obbdo.', '.obodo.', '.oo.oo.'],
        mana: ['...o...', '..obo..', '.owbbo.', 'owbbbdo', 'obbbbdo', '.obbdo.', '..ooo..'],
    };
    const ORN = {
        bracket: ['ooooooo', 'owwwwlo', 'owbbbo.', 'owbo...', 'owbo...', 'olo....', 'oo.....'],
        gem: ['..o..', '.oho.', 'ohggo', '.ogo.', '..o..'],
        rivet: ['.l.', 'lwb', '.bd'],
        stud: ['.o.', 'owd', '.o.'],
        leaf: ['..ll.l..', '.lbbllb.', 'lbbdbbbl', '.bd.dbd.', '..d...d.'],
        flower: ['.l.', 'lyb', '.b.'],
        horn: ['o....', 'olo..', '.olo.', '..obo', '...oo'],
        star: ['.w.', 'wlw', '.w.'],
        bubble: ['.l.', 'l.w', '.l.'],
        heart: ['.l.l.', 'lbbbd', '.bbd.', '..d..'],
        gear: ['..lol..', '.lbbbl.', 'lbbobbd', 'obo.obo', 'lbbobbd', '.dbbbd.', '..dod..'],
    };
    const STAT_ICON = { hp: 'heart', food: 'food', armor: 'armor', air: 'air', xp: 'xp', mana: 'mana' };
    const INFO_ICON_COLOR = { coin: '#ffc107', clock: '#e8e8e8', pin: '#ef5350', person: '#7ec8ff' };

    /* Genres: each one is a different HUD structure, not just colours */
    const GENRES = [
        { id: 'fantasy', name: 'Fantasy', th: 'Fantasy — central hotbar crests, ornate caps, borderless bars' },
        { id: 'mmo', name: 'MMO / RPG', th: 'MMO — top-left unit portrait, angled bars with numbers, corner plaques' },
        { id: 'modern', name: 'Modern', th: 'Modern — floating frosted trays, bar numbers, hotbar slot numbers' },
        { id: 'survival', name: 'Survival', th: 'Survival — classic vanilla-style heart, food, armor & bubble rows' },
        { id: 'cute', name: 'Cute / Cozy', th: 'Cute — timber shelves, foliage, blossoms, cottages & pastel pods' },
        { id: 'scifi', name: 'Sci-fi / Steampunk', th: 'Sci-fi & Steampunk — neon grids, brass gauges & glass tubes' },
        { id: 'dark', name: 'Dark / Gothic', th: 'Dark — blood moon orbs, cathedral arches & iron spikes' },
        { id: 'adventure', name: 'Adventure / World', th: 'Adventure — pirate decks, torii gates, pearls & desert ruins' },
        { id: 'seasonal', name: 'Seasonal', th: 'Seasonal — snowy winter pines and Halloween cauldrons' },
        { id: 'retro', name: 'Retro Arcade', th: 'Retro — thick black outlines, crisp pixels & arcade cabinets' },
        { id: 'info', name: 'Info cards', th: 'Info cards — player name, balance, clock & coordinates' },
    ];

    const LAYOUTS = [
        { id: 'oathblade', genre: 'fantasy', order: 2, name: 'Oathblade', th: 'Greatsword across the hotbar (blade XP) with gem pommel (level)', tags: 'sword knight blade' },
        { id: 'wyrmwing', genre: 'fantasy', order: 2, name: 'Wyrmwing', th: 'Twin dragon wings flanking the hotbar + horned dragon crest (level)', tags: 'dragon wing' },
        { id: 'sovereign', genre: 'fantasy', order: 2, name: 'Sovereign', th: 'Central royal crown (level) + velvet bars trimmed in gold', tags: 'crown king queen royal' },
        { id: 'starfall', genre: 'fantasy', order: 2, name: 'Starfall', th: 'Crescent moon (HP) + four-point star (Food) filling bottom-up', tags: 'moon star night celestial' },
        { id: 'grimoire', genre: 'mmo', order: 2, name: 'Grimoire', th: 'Open spellbook bottom-left: stat bars on left page, level & XP on right', tags: 'book spell mage magic' },
        { id: 'warbar', genre: 'mmo', order: 2, name: 'Warbar', th: 'Wide MMO raid bar: thick numbered bars on both sides + level medallion', tags: 'action bar raid mmo' },
        { id: 'mech', genre: 'scifi', order: 2, name: 'Ironframe', th: 'Vertical gauges inside armored flanks + hex core (level)', tags: 'mech robot armor' },
        { id: 'fieldops', genre: 'modern', order: 2, name: 'Field Ops', th: 'Bottom-left tactical unit panel + top compass + rank insignia (level)', tags: 'military tactical compass' },
        { id: 'cozy', genre: 'cute', order: 1, name: 'Hearthwood', th: 'Thatched cottage crest (level + name) + timber shelf + flower pots', tags: 'cozy cottage house flower farm' },
        { id: 'bubble', genre: 'cute', order: 1, name: 'Puffcloud', th: 'Rainbow arc + smiling sun (level) + bubble meters over fluffy clouds', tags: 'cute rainbow cloud sun kawaii' },
        { id: 'neon', genre: 'scifi', order: 1, name: 'Gridpulse', th: 'Synthwave striped sunset + slanted neon bars + perspective grid', tags: 'neon synthwave retro 80s grid' },
        { id: 'steam', genre: 'scifi', order: 1, name: 'Brassvein', th: 'Twin pressure dials (HP/Food) + copper piping + boiler dial (level) + gears', tags: 'steampunk gauge pipe gear boiler' },
        { id: 'gothic', genre: 'dark', order: 1, name: 'Bloodmoon', th: 'Pointed cathedral windows (HP/Food) + blood moon + rose window (level) + wrought iron', tags: 'gothic church cathedral vampire moon' },
        { id: 'pirate', genre: 'adventure', order: 1, name: 'Saltdeck', th: 'Ship helm (level) + rope-bound planks + skull & iron anchor', tags: 'pirate ship wheel anchor' },
        { id: 'samurai', genre: 'adventure', order: 1, name: 'Vermilion Gate', th: 'Torii gate framing the hotbar + central plaque (level) + sakura petals', tags: 'torii japan shrine sakura' },
        { id: 'ocean', genre: 'adventure', order: 1, name: 'Tidepool', th: 'Clam-shell pearls (HP/Food) + ocean waves + brass porthole (level)', tags: 'ocean sea pearl clam wave' },
        { id: 'desert', genre: 'adventure', order: 1, name: 'Sunstone', th: 'Winged sun disc (level) + obelisks (Armor/Air) + carved cartouche bars', tags: 'egypt desert pharaoh sun obelisk' },
        { id: 'winter', genre: 'seasonal', order: 1, name: 'Snowdrift', th: 'Snow-capped frame + hanging icicles + snowflake (level) + pine trees', tags: 'winter snow ice christmas pine' },
        { id: 'halloween', genre: 'seasonal', order: 1, name: 'Hollow Night', th: 'Bubbling cauldron (HP) + potion vial (Food) + jack-o-lantern (level) + bats', tags: 'halloween pumpkin witch potion' },
        { id: 'arcade', genre: 'retro', order: 1, name: 'Coin-op', th: 'Lit arcade marquee + pixel heart containers + joystick & buttons', tags: 'arcade retro pixel game joystick' },
        { id: 'crest', genre: 'fantasy', order: 1, name: 'Gemguard', th: 'Faceted crystals held in golden claws (HP/Food) + center jewel (level)', tags: 'gem crystal jewel fantasy' },
        { id: 'slash_medal', genre: 'mmo', order: 1, name: 'Vanguard', th: 'Top-left laurel portrait medallion + level ribbon + slanted plates', tags: 'profile medal laurel portrait' },
        { id: 'slash_rows', genre: 'mmo', order: 1, name: 'Ledger', th: 'Top-left structured card: avatar + name + level above clean stat rows', tags: 'profile card table ledger' },
        { id: 'slash_crest', genre: 'mmo', order: 1, name: 'Bladeshield', th: 'Top-left kite-shield portrait + sword-blade stat bars', tags: 'profile shield blade sword' },
        { id: 'strip', genre: 'modern', order: 1, name: 'Slimline', th: 'Clean frosted-glass card with pill bars', tags: 'minimal clean glass modern' },
        { id: 'fantasy', genre: 'fantasy', order: 1, name: 'Domekeep', th: 'Castle battlements + flagged spires + heraldic shield (level)', tags: 'castle keep tower knight' },
        { id: 'classic', genre: 'fantasy', order: 1, name: 'Plinth', th: 'Greek temple pediment (level) + Ionic columns + meander trim', tags: 'greek temple marble column' },
        { id: 'banner', genre: 'mmo', order: 1, name: 'Herald', th: 'Top-left swallowtail cloth banner hanging from a crossbar + name & level', tags: 'banner flag herald' },
        { id: 'compact', genre: 'mmo', order: 1, name: 'Stackline', th: 'Top-left floating stat capsules with icons and numbers', tags: 'compact minimal capsule' },
        { id: 'mmo', genre: 'mmo', order: 1, name: 'Portrait', th: 'Top-left gilded square avatar frame + nameplate + diamond level', tags: 'mmo portrait unit frame' },
        { id: 'rpg_corners', genre: 'mmo', order: 1, name: 'Twin Corners', th: 'Gilded corner brackets bottom-left (HP) & right (Food) + center level', tags: 'rpg corner bracket' },
        { id: 'modern', genre: 'modern', order: 1, name: 'Dualtray', th: 'Frosted glass trays flanking the hotbar with numbers + slot labels', tags: 'modern tray glass' },
        { id: 'center_row', genre: 'modern', order: 1, name: 'Midline', th: 'Compact chip row centered above the hotbar + slot numbers', tags: 'minimal chip row' },
        { id: 'split_sides', genre: 'modern', order: 1, name: 'Wingtray', th: 'Angular wing trays extending from both hotbar ends', tags: 'wing side angular' },
        { id: 'survival', genre: 'survival', order: 1, name: 'Pip Rail', th: 'Vanilla-style heart/food/armor/air icons on riveted rails + diamond level', tags: 'vanilla survival pips hearts' },
        { id: 'card_tl', genre: 'info', order: 1, name: 'Nameplate ↖', th: 'Top-left engraved plaque — name, level, balance, time & coords', tags: 'info plaque name money' },
        { id: 'card_tr', genre: 'info', order: 1, name: 'Nameplate ↗', th: 'Top-right engraved plaque — name, level, balance, time & coords', tags: 'info plaque name money' },
        { id: 'card_bl', genre: 'info', order: 1, name: 'Sidecard ↙', th: 'Bottom-left vertical card — all stat bars + info lines', tags: 'info card stats' },
        { id: 'card_br', genre: 'info', order: 1, name: 'Sidecard ↘', th: 'Bottom-right vertical card — all stat bars + info lines', tags: 'info card stats' },
        { id: 'top_strip', genre: 'info', order: 1, name: 'Skyline', th: 'Top screen banner with city skyline silhouette + right-aligned info', tags: 'top strip city skyline' },
    ];

    /* Bar end styles (the bar's shape) */
    const SHAPES = [
        { id: 'theme', name: 'Theme default', th: 'Match selected theme' },
        { id: 'none', name: 'Square', th: 'Flat square ends' },
        { id: 'blade', name: 'Blade ends', th: 'Pointed blade tips' },
        { id: 'knob', name: 'Knob ends', th: 'Rounded knob caps' },
        { id: 'gem', name: 'Gem ends', th: 'Jewel end caps' },
        { id: 'notch', name: 'Ribbon ends', th: 'Notched ribbon tails' },
        { id: 'slant', name: 'Slanted', th: 'Angled parallelogram ends' },
        { id: 'segmented', name: 'Segments', th: 'Divided meter blocks' },
    ];

    /*
     * Quick combos: theme + layout. `opts` sets parts (money, mana …) and the
     * layout's own style defaults (see LAYOUT_STYLE in hudforge.js) still apply.
     */
    const PRESETS = [
        /* set 4 */
        { genre: 'fantasy', name: '', theme: 'royal', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'crimson', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'frost', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'ember', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'abyss', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'sunforge', layout: 'oathblade', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'crimson', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'ember', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'sylvan', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'arcane', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'frost', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'abyss', layout: 'wyrmwing', opts: { money: true } },
        { genre: 'fantasy', name: '', theme: 'royal', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'crimson', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'arcane', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'sylvan', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'abyss', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'sunforge', layout: 'sovereign', opts: { money: true, time: true } },
        { genre: 'fantasy', name: '', theme: 'royal', layout: 'starfall', opts: { time: true } },
        { genre: 'fantasy', name: '', theme: 'frost', layout: 'starfall', opts: { time: true } },
        { genre: 'fantasy', name: '', theme: 'arcane', layout: 'starfall', opts: { time: true } },
        { genre: 'fantasy', name: '', theme: 'amethyst', layout: 'starfall', opts: { time: true } },
        { genre: 'fantasy', name: '', theme: 'abyss', layout: 'starfall', opts: { time: true } },
        { genre: 'fantasy', name: '', theme: 'candy', layout: 'starfall', opts: { time: true } },
        { genre: 'mmo', name: '', theme: 'crimson', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'royal', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'arcane', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'sylvan', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'honey', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'abyss', layout: 'grimoire', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'tech', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'royal', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'crimson', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'amethyst', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'slate', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'mmo', name: '', theme: 'sunforge', layout: 'warbar', opts: { mana: true, name: true, money: true } },
        { genre: 'scifi', name: '', theme: 'tech', layout: 'mech', opts: { money: true } },
        { genre: 'scifi', name: '', theme: 'slate', layout: 'mech', opts: { money: true } },
        { genre: 'scifi', name: '', theme: 'crimson', layout: 'mech', opts: { money: true } },
        { genre: 'scifi', name: '', theme: 'verdigris', layout: 'mech', opts: { money: true } },
        { genre: 'scifi', name: '', theme: 'ember', layout: 'mech', opts: { money: true } },
        { genre: 'scifi', name: '', theme: 'amethyst', layout: 'mech', opts: { money: true } },
        { genre: 'modern', name: '', theme: 'sylvan', layout: 'fieldops', opts: { coords: true, time: true } },
        { genre: 'modern', name: '', theme: 'slate', layout: 'fieldops', opts: { coords: true, time: true } },
        { genre: 'modern', name: '', theme: 'honey', layout: 'fieldops', opts: { coords: true, time: true } },
        { genre: 'modern', name: '', theme: 'crimson', layout: 'fieldops', opts: { coords: true, time: true } },
        { genre: 'modern', name: '', theme: 'tech', layout: 'fieldops', opts: { coords: true, time: true } },
        { genre: 'modern', name: '', theme: 'verdigris', layout: 'fieldops', opts: { coords: true, time: true } },
        /* v2 (2026-11-21) */
        { genre: 'adventure', name: 'Pirate Oak', theme: 'cozyoak', layout: 'pirate', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Pirate Honey', theme: 'honey', layout: 'pirate', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Pirate Crimson', theme: 'crimson', layout: 'pirate', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Samurai Crimson', theme: 'crimson', layout: 'samurai', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Samurai Royal', theme: 'royal', layout: 'samurai', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Samurai Jade', theme: 'sylvan', layout: 'samurai', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Samurai Violet', theme: 'arcane', layout: 'samurai', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Samurai Indigo', theme: 'frost', layout: 'samurai', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Reef Sky', theme: 'frost', layout: 'ocean', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Reef Coral', theme: 'candy', layout: 'ocean', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Reef Deep', theme: 'tech', layout: 'ocean', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Reef Kelp', theme: 'sylvan', layout: 'ocean', opts: { money: true, time: true } },
        { genre: 'adventure', name: 'Temple Gold', theme: 'royal', layout: 'desert', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Temple Lapis', theme: 'frost', layout: 'desert', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Temple Amber', theme: 'ember', layout: 'desert', opts: { money: true, coords: true } },
        { genre: 'adventure', name: 'Temple Amethyst', theme: 'arcane', layout: 'desert', opts: { money: true, coords: true } },
        { genre: 'seasonal', name: 'Winter Ice', theme: 'frost', layout: 'winter', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Winter Slate', theme: 'slate', layout: 'winter', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Winter Aurora', theme: 'amethyst', layout: 'winter', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Winter Night', theme: 'tech', layout: 'winter', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Halloween Witch', theme: 'arcane', layout: 'halloween', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Halloween Blood', theme: 'crimson', layout: 'halloween', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Halloween Night', theme: 'ember', layout: 'halloween', opts: { money: true, time: true } },
        { genre: 'seasonal', name: 'Halloween Nether', theme: 'nether', layout: 'halloween', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Red', theme: 'royal', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Blue', theme: 'frost', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Green', theme: 'sylvan', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Purple', theme: 'arcane', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Pink', theme: 'candy', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'retro', name: 'Arcade Gold', theme: 'ember', layout: 'arcade', opts: { money: true, time: true } },
        { genre: 'fantasy', name: 'Crest Crimson', theme: 'crimson', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Amethyst', theme: 'amethyst', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Nether', theme: 'nether', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Candy', theme: 'candy', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Honey', theme: 'honey', layout: 'crest' },
        { genre: 'modern', name: 'Strip Violet', theme: 'amethyst', layout: 'strip', opts: { money: true, time: true } },
        { genre: 'modern', name: 'Strip Ember', theme: 'ember', layout: 'strip', opts: { money: true, time: true } },
        { genre: 'modern', name: 'Strip Frost', theme: 'frost', layout: 'strip', opts: { money: true, time: true } },
        { genre: 'modern', name: 'Strip Crimson', theme: 'crimson', layout: 'strip', opts: { money: true, time: true } },
        { genre: 'modern', name: 'Strip Forest', theme: 'sylvan', layout: 'strip', opts: { money: true, time: true } },
        { genre: 'mmo', name: 'Medallion Violet', theme: 'amethyst', layout: 'slash_medal', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Medallion Crimson', theme: 'crimson', layout: 'slash_medal', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Medallion Frost', theme: 'frost', layout: 'slash_medal', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Rows Slate', theme: 'slate', layout: 'slash_rows', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Rows Forest', theme: 'sylvan', layout: 'slash_rows', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Rows Ember', theme: 'ember', layout: 'slash_rows', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Shield Royal', theme: 'royal', layout: 'slash_crest', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Shield Frost', theme: 'frost', layout: 'slash_crest', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Shield Arcane', theme: 'arcane', layout: 'slash_crest', opts: { mana: true, money: true } },
        { genre: 'cute', name: 'Wood Iron', theme: 'ironkeep', layout: 'cozy', opts: { money: true, time: true } },
        { genre: 'cute', name: 'Kawaii Honey', theme: 'honey', layout: 'bubble', opts: { money: true } },
        { genre: 'cute', name: 'Kawaii Lilac', theme: 'amethyst', layout: 'bubble', opts: { money: true } },
        { genre: 'cute', name: 'Kawaii Cloud', theme: 'slate', layout: 'bubble', opts: { money: true } },
        { genre: 'scifi', name: 'Neon Orange', theme: 'ember', layout: 'neon', opts: { money: true, time: true } },
        { genre: 'scifi', name: 'Neon Ice', theme: 'frost', layout: 'neon', opts: { money: true, time: true } },
        { genre: 'scifi', name: 'Steam Amethyst', theme: 'amethyst', layout: 'steam', opts: { money: true } },
        { genre: 'scifi', name: 'Steam Silver', theme: 'frost', layout: 'steam', opts: { money: true } },
        { genre: 'scifi', name: 'Steam Nether', theme: 'nether', layout: 'steam', opts: { money: true } },
        { genre: 'dark', name: 'Gothic Void', theme: 'amethyst', layout: 'gothic', opts: { money: true } },
        { genre: 'dark', name: 'Gothic Frost', theme: 'frost', layout: 'gothic', opts: { money: true } },
        { genre: 'dark', name: 'Gothic Iron', theme: 'ironkeep', layout: 'gothic', opts: { money: true } },
        { genre: 'cute', name: 'Wood Oak', theme: 'cozyoak', layout: 'cozy', opts: { money: true, time: true } },
        { genre: 'cute', name: 'Wood Honey', theme: 'honey', layout: 'cozy', opts: { money: true, time: true, coords: true } },
        { genre: 'cute', name: 'Wood Grove', theme: 'sylvan', layout: 'cozy', opts: { mana: true, money: true } },
        { genre: 'cute', name: 'Kawaii Pink', theme: 'candy', layout: 'bubble', opts: { money: true, time: true } },
        { genre: 'cute', name: 'Kawaii Sky', theme: 'frost', layout: 'bubble', opts: { mana: true, money: true } },
        { genre: 'cute', name: 'Kawaii Mint', theme: 'sylvan', layout: 'bubble', opts: { money: true } },
        { genre: 'cute', name: 'Kawaii Grape', theme: 'arcane', layout: 'bubble', opts: { mana: true, time: true } },
        { genre: 'scifi', name: 'Neon Cyan', theme: 'tech', layout: 'neon', opts: { mana: true, money: true, time: true, coords: true } },
        { genre: 'scifi', name: 'Neon Violet', theme: 'amethyst', layout: 'neon', opts: { mana: true, money: true, time: true } },
        { genre: 'scifi', name: 'Neon Red', theme: 'nether', layout: 'neon', opts: { money: true, coords: true } },
        { genre: 'scifi', name: 'Neon White', theme: 'slate', layout: 'neon', opts: { money: true, time: true } },
        { genre: 'scifi', name: 'Steam Brass', theme: 'royal', layout: 'steam', opts: { money: true, time: true } },
        { genre: 'scifi', name: 'Steam Copper', theme: 'ember', layout: 'steam', opts: { money: true } },
        { genre: 'scifi', name: 'Steam Iron', theme: 'ironkeep', layout: 'steam', opts: { money: true, coords: true } },
        { genre: 'dark', name: 'Gothic Blood', theme: 'crimson', layout: 'gothic', opts: { mana: true, money: true } },
        { genre: 'dark', name: 'Gothic Nether', theme: 'nether', layout: 'gothic', opts: { money: true, time: true } },
        { genre: 'dark', name: 'Gothic Arcane', theme: 'arcane', layout: 'gothic', opts: { mana: true, money: true } },
        { genre: 'dark', name: 'Gothic Ember', theme: 'ember', layout: 'gothic', opts: { money: true } },
        { genre: 'fantasy', name: 'Crest Royal', theme: 'royal', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Iron Keep', theme: 'ironkeep', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Ember', theme: 'ember', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Frost', theme: 'frost', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Arcane', theme: 'arcane', layout: 'crest' },
        { genre: 'fantasy', name: 'Crest Sylvan', theme: 'sylvan', layout: 'crest' },
        { genre: 'mmo', name: 'Medallion Tech', theme: 'tech', layout: 'slash_medal', opts: { mana: true, money: true, time: true } },
        { genre: 'mmo', name: 'Medallion Royal', theme: 'royal', layout: 'slash_medal', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Rows Tech', theme: 'tech', layout: 'slash_rows', opts: { mana: true, money: true, time: true } },
        { genre: 'mmo', name: 'Rows Amethyst', theme: 'amethyst', layout: 'slash_rows', opts: { mana: true, money: true, coords: true } },
        { genre: 'mmo', name: 'Shield Knight', theme: 'tech', layout: 'slash_crest', opts: { mana: true, money: true, time: true } },
        { genre: 'mmo', name: 'Shield Crimson', theme: 'crimson', layout: 'slash_crest', opts: { mana: true, money: true } },
        { genre: 'modern', name: 'Clean Strip', theme: 'slate', layout: 'strip', opts: { money: true, time: true, coords: true } },
        { genre: 'modern', name: 'Strip Tech', theme: 'tech', layout: 'strip', opts: { mana: true, money: true, time: true } },
        { genre: 'modern', name: 'Strip Candy', theme: 'candy', layout: 'strip', opts: { money: true } },
        { genre: 'survival', name: 'Strip Survival', theme: 'vanilla', layout: 'strip', opts: { time: true, coords: true } },
        { genre: 'fantasy', name: 'Royal Court', theme: 'royal', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Iron Keep', theme: 'ironkeep', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Ember Throne', theme: 'ember', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Frost Peak', theme: 'frost', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Arcane Tower', theme: 'arcane', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Crimson Lord', theme: 'crimson', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Sylvan Grove', theme: 'sylvan', layout: 'fantasy' },
        { genre: 'fantasy', name: 'Royal Deck', theme: 'royal', layout: 'classic' },
        { genre: 'mmo', name: 'Hero Banner', theme: 'tech', layout: 'banner', opts: { mana: true, money: true, time: true } },
        { genre: 'mmo', name: 'Royal Banner', theme: 'royal', layout: 'banner', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Compact Steel', theme: 'slate', layout: 'compact', opts: { mana: true } },
        { genre: 'mmo', name: 'Compact Ember', theme: 'ember', layout: 'compact' },
        { genre: 'mmo', name: 'MMO Hero', theme: 'tech', layout: 'mmo', opts: { mana: true, money: true, time: true } },
        { genre: 'mmo', name: 'MMO Mage', theme: 'amethyst', layout: 'mmo', opts: { mana: true, money: true, coords: true } },
        { genre: 'mmo', name: 'MMO Knight', theme: 'ironkeep', layout: 'mmo', opts: { mana: true, money: true } },
        { genre: 'mmo', name: 'Royal Raid', theme: 'royal', layout: 'rpg_corners', opts: { mana: true } },
        { genre: 'modern', name: 'Simple Modern', theme: 'slate', layout: 'modern' },
        { genre: 'modern', name: 'Tech Float', theme: 'tech', layout: 'modern' },
        { genre: 'modern', name: 'Clean Split', theme: 'slate', layout: 'split_sides' },
        { genre: 'modern', name: 'Candy Row', theme: 'candy', layout: 'center_row' },
        { genre: 'survival', name: 'Survival Classic', theme: 'vanilla', layout: 'survival' },
        { genre: 'survival', name: 'Cozy Oak', theme: 'cozyoak', layout: 'survival' },
        { genre: 'survival', name: 'Nether', theme: 'nether', layout: 'survival' },
        { genre: 'survival', name: 'Honey', theme: 'honey', layout: 'survival' },
        { genre: 'info', name: 'Royal Card', theme: 'royal', layout: 'card_tl', opts: { money: true, coords: true } },
        { genre: 'info', name: 'Frost Card', theme: 'frost', layout: 'card_tl', opts: { money: true, time: true } },
        { genre: 'info', name: 'Space Ops', theme: 'tech', layout: 'top_strip', opts: { money: true, time: true, coords: true } },
        { genre: 'info', name: 'Cabin Card', theme: 'honey', layout: 'card_bl', opts: { money: true } },
    ];

    /* every combo is named "Style · Colour" */
    for (const p of PRESETS) {
        const l = LAYOUTS.find((x) => x.id === p.layout);
        const t = THEMES.find((x) => x.id === p.theme);
        p.name = `${l ? l.name : p.layout} · ${t ? t.name : p.theme}`;
    }
    window.HudForgeData = { STAT_COLORS, STAT_RAMPS, RAMPS, GROUPS, THEMES, ICONS, PIPS, ORN, STAT_ICON, INFO_ICON_COLOR, GENRES, LAYOUTS, SHAPES, PRESETS };
})();
