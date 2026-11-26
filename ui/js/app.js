/* ========================================

   App State Management

   ======================================== */

// Anchor point definitions (0-1 normalized coords)
const ANCHORS = {
  top_left: { x: 0, y: 0 },
  top_middle: { x: 0.5, y: 0 },
  top_right: { x: 1, y: 0 },
  middle_left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  middle_right: { x: 1, y: 0.5 },
  bottom_left: { x: 0, y: 1 },
  bottom_middle: { x: 0.5, y: 1 },
  bottom_right: { x: 1, y: 1 },
};

/**
 * Calculate new offset to preserve screen position when anchor changes.
 * Formula: newOffset = currentScreenPos - newAnchorPoint * screenSize
 */
function calculateOffsetForAnchorChange(oldAnchor, newAnchor, oldOffset, screenWidth, screenHeight) {
  if (screenWidth === undefined) screenWidth = (typeof App !== 'undefined' && App.BEDROCK_WIDTH) || 480;
  if (screenHeight === undefined) screenHeight = (typeof App !== 'undefined' && App.BEDROCK_HEIGHT) || 270;
  const oldAnchorPos = ANCHORS[oldAnchor] || ANCHORS.top_left;
  const newAnchorPos = ANCHORS[newAnchor] || ANCHORS.top_left;

  // Calculate current screen position from old anchor + offset
  const screenX = oldAnchorPos.x * screenWidth + oldOffset[0];
  const screenY = oldAnchorPos.y * screenHeight + oldOffset[1];

  // Calculate new offset to keep same screen position
  const newOffsetX = screenX - newAnchorPos.x * screenWidth;
  const newOffsetY = screenY - newAnchorPos.y * screenHeight;

  console.log('calculateOffsetForAnchorChange:', {
    oldAnchor, newAnchor, oldOffset,
    oldAnchorPos, newAnchorPos,
    screenX, screenY,
    newOffset: [newOffsetX, newOffsetY]
  });

  return [newOffsetX, newOffsetY];
}

const DEFAULT_TEXT_OFFSETS = { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] };

// Automatic pad length of a bossbar text / nameplate slot (bytes in the bossbar title).
// Mirrors codegen.rs placeholder_max_bytes / auto_pad_length: "§z" marker (3, ASCII texts only)
// + literal text in UTF-8 bytes ("&x" codes become "§x" = 3) + the longest value of each placeholder.
function placeholderMaxBytes(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n.startsWith('server_time_')) return Math.max(1, n.length - 'server_time_'.length);
  const T = {
    player_health_rounded: 4, player_max_health_rounded: 4,
    player_health: 6, player_max_health: 6,
    player_food_level: 2, player_armor: 2, player_armor_toughness: 2,
    player_saturation: 5, player_exhaustion: 5,
    player_remaining_air: 3, player_max_air: 3,
    player_level: 5, player_exp_to_level: 5,
    player_exp: 7, player_total_exp: 7,
    auraskills_mana_int: 5, auraskills_mana_max_int: 5,
    auraskills_mana: 8, auraskills_mana_max: 8,
    player_ping: 4, server_online: 4, server_max_players: 4, server_tps: 5,
    player_x: 9, player_y: 9, player_z: 9,
    player_name: 17,
    vault_eco_balance_formatted: 8, vault_eco_balance_fixed: 15, vault_eco_balance: 18, vault_eco_balance_commas: 18,
    player_world: 16, player_gamemode: 16, player_biome: 24,
  };
  return T[n] !== undefined ? T[n] : 16;
}
function autoPadLength(papi) {
  const s = String(papi || '');
  const chars = Array.from(s);
  const utf8 = (c) => new TextEncoder().encode(c).length;
  let total = chars.some((c) => c.codePointAt(0) > 0x7f) ? 0 : 3;
  for (let i = 0; i < chars.length; ) {
    const c = chars[i];
    if (c === '%') {
      const end = chars.indexOf('%', i + 1);
      if (end > i + 1) {
        const name = chars.slice(i + 1, end).join('');
        if (!name.includes(' ')) { total += placeholderMaxBytes(name); i = end + 1; continue; }
      }
    }
    if (c === '&' && i + 1 < chars.length && /^[0-9a-fk-orxzywv]$/i.test(chars[i + 1])) { total += 3; i += 2; continue; }
    total += utf8(c);
    i += 1;
  }
  return Math.max(1, total);
}
// pad used for an element: automatic unless pad_auto === false (then pad_length, default 30)
function effectivePadLength(el) {
  if (el && el.pad_auto === false) return parseInt(el.pad_length) || 30;
  return autoPadLength(el && el.papi_placeholder);
}

// XP level number: centred in its box (preview, Bedrock, Java). The old default size 20×10
// ("just for the preview") never matched the offset templates computed for a 12×9 box, so it is
// read as 12×9 (mirrors codegen.rs xp_box_size and javaexport.js).
function xpBoxSize(el) {
  const s = el && Array.isArray(el.size) ? el.size.map(Number) : null;
  if (!s || !(s[0] > 0) || !(s[1] > 0) || (s[0] === 20 && s[1] === 10)) return [12, 9];
  return s;
}

// Nameplates (Bedrock only) share one stack at a project-wide position; top_middle is pushed
// down on phones so it clears the three top-centre touch buttons (codegen.rs nameplate_stack_panel).
const NAMEPLATE_POSITIONS = ['top_left', 'top_right', 'top_middle'];
const DEFAULT_NAMEPLATE_MOBILE_OFFSET = 26;
function getNameplateSettings() {
  const app = typeof App !== 'undefined' ? App : {};
  const position = NAMEPLATE_POSITIONS.includes(app.nameplatePosition) ? app.nameplatePosition : 'top_right';
  const n = Number(app.nameplateMobileOffset);
  return { position, mobileOffset: Number.isFinite(n) && n >= 0 ? n : DEFAULT_NAMEPLATE_MOBILE_OFFSET };
}

// How KaizerMultiBar sends the HUD data to Bedrock (codegen.rs HudChannel)
// ('actionbar' removed 2026-11-24; 'bossbar' removed in v1.0.4 due to multi-plugin bossbar conflicts → all projects use hidden 'title')
const HUD_CHANNELS = ['title'];
function getHudChannel() {
  return 'title';
}

/** Extra show/hide conditions ("+ Add condition"), cleaned: [{ papi, op, value, invert }] */
function normalizeVisibilityExtra(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
            papi: String(c.papi || ''),
            op: String(c.op || '=='),
            value: c.value == null ? '' : String(c.value),
            invert: c.invert === true,
        }));
}

/** Every show/hide condition of an element — all must be true (the same rule as codegen.rs
    raw_visibility_conditions). Texts and nameplates can't be hidden: []. */
function getVisibilityConditions(el) {
    const isBar = el.type === 'bar';
    if (!isBar && !['image', 'player_head', 'xp_label'].includes(el.type)) return [];
    const out = [];
    const papi = String(el.visibilityPapi || '').trim();
    const op = el.visibilityOperator || (isBar ? '==' : 'always');
    if (papi && op !== 'always') {
        out.push({ papi, op, value: String(el.visibilityValue == null ? '' : el.visibilityValue).trim(), invert: el.visibilityInvert === true });
    }
    normalizeVisibilityExtra(el.visibilityExtra).forEach((c) => {
        const p = c.papi.trim();
        if (p && c.op !== 'always') out.push({ papi: p, op: c.op, value: c.value.trim(), invert: c.invert });
    });
    return out;
}

function getTextOffsets(el) {
  return Object.assign({}, DEFAULT_TEXT_OFFSETS, el.text_offsets || {});
}

function normalizeBarEffect(effect, fallback = {}) {

    return {

        effect: effect.effect || fallback.effect || '',

        prefix: effect.prefix || fallback.prefix || '',

        texturePath: effect.texturePath || fallback.texturePath || '',

        imageData: effect.imageData || null,

        slicedImages: Array.isArray(effect.slicedImages) ? effect.slicedImages : [],

        showInPreview: effect.showInPreview === true,

        useSeparateOffset: effect.useSeparateOffset === true,

        offset: Array.isArray(effect.offset) ? effect.offset : [0, 0]

    };

}



function getDefaultBarEffects(barType) {

    if (barType === 'hp') {

        return [

            { effect: 'FREEZING', prefix: 'fz', texturePath: 'textures/hotbar/fill_fz/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'ABSORPTION', prefix: 'ab', texturePath: 'textures/hotbar/fill_ab/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'HEALTH_BOOST', prefix: 'hb', texturePath: 'textures/hotbar/fill_hb/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'REGENERATION', prefix: 'r', texturePath: 'textures/hotbar/fill_r/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'WITHER', prefix: 'w', texturePath: 'textures/hotbar/fill_w/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'POISON', prefix: 'p', texturePath: 'textures/hotbar/fill_p/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] }

        ];

    }



    if (barType === 'food') {

        return [

            { effect: 'HUNGER', prefix: 'g', texturePath: 'textures/hotbar/fill_g/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] },

            { effect: 'SATURATION', prefix: 's', texturePath: 'textures/hotbar/fill_s/horizontal/16', imageData: null, slicedImages: [], showInPreview: false, useSeparateOffset: false, offset: [0, 0] }

        ];

    }



    return [];

}



function getEffectKeywords(effectName) {

    const map = {

        FREEZING: ['freezing', 'freeze', 'frozen', 'ice'],

        ABSORPTION: ['absorption', 'absorb'],

        HEALTH_BOOST: ['health_boost', 'healthboost', 'boost'],

        REGENERATION: ['regeneration', 'regen'],

        WITHER: ['wither'],

        POISON: ['poison'],

        HUNGER: ['hunger', 'hungry'],

        SATURATION: ['saturation', 'saturate']

    };

    return map[effectName] || [String(effectName || '').toLowerCase()];

}



function isSameBarLayout(a, b) {

    return a && b &&

        a.type === 'bar' && b.type === 'bar' &&

        a.barType === b.barType &&

        JSON.stringify(a.anchor_from) === JSON.stringify(b.anchor_from) &&

        JSON.stringify(a.anchor_to) === JSON.stringify(b.anchor_to) &&

        JSON.stringify(a.offset || [0, 0]) === JSON.stringify(b.offset || [0, 0]) &&

        JSON.stringify(a.barMinSize || []) === JSON.stringify(b.barMinSize || []) &&

        JSON.stringify(a.barMaxSize || []) === JSON.stringify(b.barMaxSize || []) &&

        (a.layer || 0) === (b.layer || 0);

}



function inferLegacyEffectName(bar) {

    const defaults = getDefaultBarEffects(bar.barType || '');

    const haystack = `${bar.name || ''} ${bar.barTexturePath || ''} ${bar.texturePath || ''}`.toLowerCase();

    const matchedByName = defaults.find(effect => getEffectKeywords(effect.effect).some(keyword => haystack.includes(keyword)));

    if (matchedByName) {

        return matchedByName.effect;

    }



    const uploadedEntry = (bar.barEffects || []).find(effect => effect && ((effect.slicedImages && effect.slicedImages.length === 16) || effect.imageData));

    return uploadedEntry ? uploadedEntry.effect : '';

}



function collapseLegacyEffectBars(elements) {

    const normalized = elements.map(el => {

        if (el.type !== 'bar') {

            return el;

        }



        const fallbackEffects = getDefaultBarEffects(el.barType || 'hp');

        const nextEffects = (el.barEffects || fallbackEffects).map((effect, index) => normalizeBarEffect(effect, fallbackEffects[index] || {}));

        return { ...el, barEffects: nextEffects };

    });



    const removedIds = new Set();



    normalized.forEach((bar, index) => {

        if (bar.type !== 'bar' || removedIds.has(bar.id)) {

            return;

        }



        const legacyEffectName = inferLegacyEffectName(bar);

        if (!legacyEffectName) {

            return;

        }



        const defaults = getDefaultBarEffects(bar.barType || '');

        const defaultEffect = defaults.find(effect => effect.effect === legacyEffectName);

        const uploadedEffect = (bar.barEffects || []).find(effect => effect && effect.effect === legacyEffectName && ((effect.slicedImages && effect.slicedImages.length === 16) || effect.imageData));

        if (!defaultEffect && !uploadedEffect) {

            return;

        }



        const parentBar = normalized.find((candidate, candidateIndex) => {

            if (candidateIndex === index || candidate.type !== 'bar' || removedIds.has(candidate.id)) {

                return false;

            }

            if (!isSameBarLayout(candidate, bar)) {

                return false;

            }

            return candidate.barType === bar.barType;

        });



        if (!parentBar) {

            return;

        }



        const sourceEffect = normalizeBarEffect(uploadedEffect || defaultEffect || {}, defaultEffect || {});

        const targetIndex = (parentBar.barEffects || []).findIndex(effect => effect && effect.effect === legacyEffectName);

        if (targetIndex >= 0) {

            parentBar.barEffects[targetIndex] = {

                ...parentBar.barEffects[targetIndex],

                prefix: sourceEffect.prefix || parentBar.barEffects[targetIndex].prefix,

                texturePath: sourceEffect.texturePath || parentBar.barEffects[targetIndex].texturePath,

                imageData: sourceEffect.imageData || parentBar.barEffects[targetIndex].imageData,

                slicedImages: sourceEffect.slicedImages && sourceEffect.slicedImages.length > 0 ? sourceEffect.slicedImages : parentBar.barEffects[targetIndex].slicedImages,

                showInPreview: sourceEffect.showInPreview === true,

                useSeparateOffset: sourceEffect.useSeparateOffset === true,

                offset: [...(sourceEffect.offset || parentBar.barEffects[targetIndex].offset || [0, 0])]

            };

            removedIds.add(bar.id);

        }

    });



    return normalized.filter(el => !removedIds.has(el.id));

}



function getBarLinkedSource(elements, bar) {

    if (!bar || bar.type !== 'bar' || !bar.linkedBarId) {

        return null;

    }

    return elements.find(candidate => candidate.id === bar.linkedBarId && candidate.type === 'bar') || null;

}



function getLinkedPositionSource(elements, el, visited = new Set()) {

    if (!el || !el.useLinkedPosition || !el.linkedPositionId || visited.has(el.id)) {

        return null;

    }



    const source = elements.find(candidate => candidate.id === el.linkedPositionId && candidate.id !== el.id) || null;

    if (!source) {

        return null;

    }



    visited.add(el.id);

    return getLinkedPositionSource(elements, source, visited) || source;

}



function getPositionTargetElement(elements, el) {

    return getLinkedPositionSource(elements, el) || el;

}



function resolveBarForRender(elements, bar, visited = new Set()) {

    if (!bar || bar.type !== 'bar') {

        return bar;

    }



    // Handle linked position first

    const positionSource = getLinkedPositionSource(elements, bar);

    

    if (!bar.useLinkedProperties || !bar.linkedBarId || visited.has(bar.id)) {

        // Even if not using linked properties, we may still use linked position

        if (positionSource) {

            return {

                ...bar,

                anchor_from: positionSource.anchor_from,

                anchor_to: positionSource.anchor_to,

                offset: [...(positionSource.offset || [0, 0])],

                layer: positionSource.layer,

            };

        }

        return bar;

    }



    const sourceBar = getBarLinkedSource(elements, bar);

    if (!sourceBar) {

        if (positionSource) {

            return {

                ...bar,

                anchor_from: positionSource.anchor_from,

                anchor_to: positionSource.anchor_to,

                offset: [...(positionSource.offset || [0, 0])],

                layer: positionSource.layer,

            };

        }

        return bar;

    }



    visited.add(bar.id);

    const resolvedSource = resolveBarForRender(elements, sourceBar, visited);



    // If using linked position, use position from positionSource instead

    const finalAnchorFrom = positionSource ? positionSource.anchor_from : resolvedSource.anchor_from;

    const finalAnchorTo = positionSource ? positionSource.anchor_to : resolvedSource.anchor_to;

    const finalOffset = positionSource ? [...(positionSource.offset || [0, 0])] : [...(resolvedSource.offset || [0, 0])];

    const finalLayer = positionSource ? positionSource.layer : resolvedSource.layer;



    return {

        ...bar,

        anchor_from: finalAnchorFrom,

        anchor_to: finalAnchorTo,

        offset: finalOffset,

        size: [...(resolvedSource.size || bar.size || [0, 0])],

        layer: finalLayer,

        alpha: resolvedSource.alpha,

        barMinSize: [...(bar.barMinSize || [0, 0])],

        barMaxSize: [...(bar.barMaxSize || bar.size || [0, 0])],

        barTexturePath: bar.barTexturePath,

        slicedImages: [...(bar.slicedImages || [])],

        previewStep: resolvedSource.previewStep || bar.previewStep,

        sliceDirection: resolvedSource.sliceDirection || bar.sliceDirection,

        imageData: bar.imageData

    };

}



const App = {

    elements: [],

    groups: ['Main'],

    currentGroup: 'Main',

    selectedIds: [],

    nextId: 1,

    history: [],

    future: [],

    isRestoringHistory: false,



    // Bedrock HUD preview dimensions (in Bedrock pixel units)

    BEDROCK_WIDTH: 480,

    BEDROCK_HEIGHT: 270,



    snapshotState() {

        return {

            elements: JSON.parse(JSON.stringify(this.elements)),

            groups: [...this.groups],

            currentGroup: this.currentGroup,

            selectedIds: [...this.selectedIds],

            nextId: this.nextId,

        };

    },



    pushHistory() {

        if (this.isRestoringHistory) return;

        this.history.push(this.snapshotState());

        if (this.history.length > 100) {

            this.history.shift();

        }

        this.future = [];

    },



    restoreState(state) {

        this.isRestoringHistory = true;

        this.elements = JSON.parse(JSON.stringify(state.elements || []));

        this.groups = [...(state.groups || ['Main'])];

        this.currentGroup = state.currentGroup || 'Main';

        this.selectedIds = [...(state.selectedIds || [])];

        this.nextId = state.nextId || 1;

        this.isRestoringHistory = false;

        this.render();

    },



    undo() {

        if (this.history.length === 0) return;

        this.future.push(this.snapshotState());

        const previousState = this.history.pop();

        this.restoreState(previousState);

    },



    redo() {

        if (this.future.length === 0) return;

        this.history.push(this.snapshotState());

        const nextState = this.future.pop();

        this.restoreState(nextState);

    },



    getNamespace() {

        return document.getElementById('namespace-input').value.trim() || 'custom_hud';

    },

    generateUniqueBarTag() {
        const existingTags = new Set(
            this.elements
                .filter(e => e.type === 'bar' && e.barType === 'custom' && e.barCustomTag)
                .map(e => e.barCustomTag.toLowerCase())
        );
        
        // Generate ca, cb, cc, cd, ce, cf...
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        for (let i = 0; i < letters.length; i++) {
            const tag = `c${letters[i]}`;
            if (!existingTags.has(tag)) {
                return tag;
            }
        }
        
        // Fallback if all letters used (unlikely)
        return `c${Date.now() % 100}`;
    },



    addElement(type, data = {}) {

        this.pushHistory();

        let defaultName = `Element ${this.elements.length + 1}`;

        let defaultSize = [100, 73];

        let defaultLayer = 100;

        let defaultOffset = [0, 0];



        if (type === 'image') {

            defaultName = `Image ${this.elements.filter(e => e.type === 'image').length + 1}`;

            defaultSize = [100, 73];

            defaultLayer = 100;

        } else if (type === 'text') {

            defaultName = `Text ${this.elements.filter(e => e.type === 'text').length + 1}`;

            defaultSize = [100, 10];

            defaultLayer = 102;

        } else if (type === 'player_head') {

            defaultName = `Player Head ${this.elements.filter(e => e.type === 'player_head').length + 1}`;

            defaultSize = [35, 31];

            defaultLayer = 101;

            defaultOffset = [1, 18];

        } else if (type === 'bar') {

            const barCount = this.elements.filter(e => e.type === 'bar').length + 1;

            defaultName = `Bar ${barCount}`;

            defaultSize = [49, 6]; // full bar size (step 16)

            defaultLayer = 100;

        } else if (type === 'xp_label') {

            defaultName = `XP Level Number`;

            defaultSize = [12, 9]; // the number is centred in this box

            defaultLayer = 105;

        } else if (type === 'nameplate') {

            const npCount = this.elements.filter(e => e.type === 'nameplate').length + 1;

            defaultName = `Nameplate ${npCount}`;

            defaultSize = [60, 15];

            defaultLayer = 102;

            defaultOffset = [-4, 5];

        }



        const el = {

            id: this.nextId++,

            group: this.currentGroup || 'Main',

            type: type, // 'image', 'text', 'player_head', or 'bar'

            name: data.name || defaultName,

            anchor_from: data.anchor_from || 'top_left',

            anchor_to: data.anchor_to || 'top_left',

            offset: data.offset || [...defaultOffset],

            size: data.size || [...defaultSize],

            layer: data.layer || defaultLayer,

            alpha: data.alpha !== undefined ? data.alpha : 1.0,

            // Image specific

            imageData: data.imageData || null,

            imageName: data.imageName || '',

            texturePath: data.texturePath || '',

            color: data.color || [1, 1, 1],

            // Image animation (animation.js): 2+ frames = flip-book animation in the export
            animFrames: Array.isArray(data.animFrames) ? [...data.animFrames] : [],

            animFps: data.animFps || 10,

            animFrameSize: Array.isArray(data.animFrameSize) ? [...data.animFrameSize] : null,

            // Text specific

            collection_index: data.collection_index !== undefined ? data.collection_index : (type === 'nameplate' ? this.elements.filter(e => e.type === 'nameplate').length : this.elements.filter(e => e.type === 'text').length),

            font_size: data.font_size || 'small',

            color: data.color || [1, 1, 1],

            shadow: data.shadow !== undefined ? data.shadow : false,

            text_anchor_from: data.text_anchor_from || 'top_left',

            text_anchor_to: data.text_anchor_to || 'top_left',

            text_offset: data.text_offset || [0, -2.8],

            text_offsets: data.text_offsets || { ...DEFAULT_TEXT_OFFSETS },

            // Player Head specific

            doll_size: data.doll_size || [75, 205],

            doll_offset: data.doll_offset || [1, 18],

            head_zoom: data.head_zoom !== undefined ? data.head_zoom : 2.05,

            // Bar specific

            barType: data.barType || 'hp',       // 'hp' | 'food' | 'armor' | 'air'

            barCustomTag: data.barCustomTag || (type === 'bar' && (data.barType || 'hp') === 'custom' ? this.generateUniqueBarTag() : ''),

            barCustomPapi: data.barCustomPapi || '',

            barCustomMax: data.barCustomMax || '',

            barMinSize: data.barMinSize || [3, data.size ? data.size[1] : 3], // keep height proportional, min width 3

            barMaxSize: data.barMaxSize || [...defaultSize], // size at step 16

            barTexturePath: data.barTexturePath || 'textures/hotbar/fill_hp/horizontal/16',

            slicedImages: data.slicedImages || [],     // DataURL array [0..15]

            previewStep: data.previewStep || 16,        // default to full size preview

            barEffects: (data.barEffects || getDefaultBarEffects(data.barType || 'hp')).map((effect, index) => normalizeBarEffect(effect, getDefaultBarEffects(data.barType || 'hp')[index] || {})),

            useLinkedPosition: data.useLinkedPosition === true,

            linkedPositionId: data.linkedPositionId || null,

                useLinkedProperties: data.useLinkedProperties === true,

                linkedBarId: data.linkedBarId || null,

                visibilityMode: data.visibilityMode || 'always', // Visibility mode for armor/air bars: 'always', 'when_armored', 'when_submerged'

                isPapiBar: data.isPapiBar === true,

                papiPlaceholder: data.papiPlaceholder || '',

                // XP Label specific

                text: data.text || '13',
            xp_shadow: data.xp_shadow !== undefined ? data.xp_shadow : true,
            // XP label colour / font (were dropped before, which crashed the preview)
            ...(type === 'xp_label' ? {
                xp_color: Array.isArray(data.xp_color) ? [...data.xp_color] : [0.5, 1.0, 0.1],
                xp_font_size: data.xp_font_size || 'normal',
            } : {}),

            // nameplates are always locked: their place is the project's nameplate position
            lockPosition: type === 'nameplate' ? true : data.lockPosition === true,

            // Visibility Conditions (for Party HUD, etc.)

            visibilityEnabled: data.visibilityEnabled === true,

            visibilityPapi: data.visibilityPapi || '',

            visibilityOperator: data.visibilityOperator || '==',

            visibilityValue: data.visibilityValue || '',

            visibilityInvert: data.visibilityInvert === true,

            visibilityExtra: normalizeVisibilityExtra(data.visibilityExtra), // more conditions, all must be true

        };



        this.elements.push(el);

        this.selectElement(el.id);

        this.render();

        return el;

    },



    removeElement(id) {

        this.pushHistory();

        this.elements = this.elements.filter(e => e.id !== id);

        this.selectedIds = this.selectedIds.filter(selId => selId !== id);

        if (this.selectedIds.length === 0 && this.elements.length > 0) {

            this.selectedIds = [this.elements[0].id];

        }

        this.render();

    },



    removeSelected() {

        if (this.selectedIds.length === 0) return;

        this.pushHistory();

        this.elements = this.elements.filter(e => !this.selectedIds.includes(e.id));

        this.selectedIds = [];

        this.render();

    },



    selectElement(id, multi = false) {

        if (!id) {

            this.selectedIds = [];

        } else if (multi) {

            if (this.selectedIds.includes(id)) {

                this.selectedIds = this.selectedIds.filter(selId => selId !== id);

            } else {

                this.selectedIds.push(id);

            }

        } else {

            this.selectedIds = [id];

        }

        this.render();

    },



    getSelected() {

        if (this.selectedIds.length === 0) return null;

        // Return the last selected element as the "primary" selection.

        return this.elements.find(e => e.id === this.selectedIds[this.selectedIds.length - 1]) || null;

    },



    getAllSelected() {

        return this.elements.filter(e => this.selectedIds.includes(e.id));

    },



    updateElement(id, props, skipProperties = false) {

        const el = this.elements.find(e => e.id === id);

        if (!el) return;

        this.pushHistory();

        const nextProps = { ...props };

        if (Array.isArray(nextProps.offset)) {

            nextProps.offset = [Number(nextProps.offset[0]) || 0, Number(nextProps.offset[1]) || 0];

        }

        if (Array.isArray(nextProps.size)) {

            nextProps.size = [Number(nextProps.size[0]) || 0, Number(nextProps.size[1]) || 0];

        }

        if (Array.isArray(nextProps.doll_offset)) {

            nextProps.doll_offset = [Number(nextProps.doll_offset[0]) || 0, Number(nextProps.doll_offset[1]) || 0];

        }

        if (Array.isArray(nextProps.doll_size)) {

            nextProps.doll_size = [Number(nextProps.doll_size[0]) || 0, Number(nextProps.doll_size[1]) || 0];

        }

        Object.assign(el, nextProps);

        this.render(skipProperties);

    },



    duplicateSelected() {

        if (this.selectedIds.length === 0) return;

        this.pushHistory();

        const newIds = [];

        this.getAllSelected().forEach(el => {

            const clone = { ...el, id: this.nextId++, name: el.name + ' (copy)', offset: [...el.offset], size: [...el.size], color: [...el.color] };

            if (Array.isArray(el.animFrames)) clone.animFrames = [...el.animFrames];

            clone.useLinkedPosition = el.useLinkedPosition === true;

            clone.linkedPositionId = el.linkedPositionId || null;

            if (clone.type === 'text') {

                clone.collection_index = this.elements.filter(e => e.type === 'text').length;

            }

            if (clone.type === 'nameplate') {

                clone.collection_index = this.elements.filter(e => e.type === 'nameplate').length;

                clone.lockPosition = true;

                clone.anchor_from = 'top_right';

                clone.anchor_to = 'top_right';

                clone.offset = [-4, 5];

            }

            if (clone.type === 'bar') {

                // Deep-clone bar-specific arrays

                clone.barMinSize = [...el.barMinSize];

                clone.barMaxSize = [...el.barMaxSize];

                clone.slicedImages = [...el.slicedImages];

                clone.barCustomTag = el.barCustomTag || '';

                clone.barCustomPapi = el.barCustomPapi || '';

                clone.barCustomMax = el.barCustomMax || '';

                clone.barEffects = (el.barEffects || []).map(effect => ({

                    effect: effect.effect,

                    prefix: effect.prefix,

                    texturePath: effect.texturePath,

                    imageData: effect.imageData,

                    slicedImages: [...(effect.slicedImages || [])],

                    showInPreview: effect.showInPreview === true,

                    useSeparateOffset: effect.useSeparateOffset === true,

                    offset: [...(effect.offset || [0, 0])]

                }));

                clone.useLinkedProperties = el.useLinkedProperties === true;

                clone.linkedBarId = el.linkedBarId || null;

            }

            // Clone visibility conditions for all elements

            clone.visibilityEnabled = el.visibilityEnabled === true;

            clone.visibilityPapi = el.visibilityPapi || '';

            clone.visibilityOperator = el.visibilityOperator || '==';

            clone.visibilityValue = el.visibilityValue || '';

            clone.visibilityInvert = el.visibilityInvert === true;

            clone.visibilityExtra = normalizeVisibilityExtra(el.visibilityExtra);

            this.elements.push(clone);

            newIds.push(clone.id);

        });

        this.selectedIds = newIds;

        this.render();

    },



    moveSelectedLayer(direction) {

        if (this.selectedIds.length === 0) return;

        if (this.getAllSelected().some(el => getPositionTargetElement(this.elements, el).lockPosition)) return;

        const indices = this.selectedIds

            .map(id => this.elements.findIndex(el => el.id === id))

            .filter(index => index >= 0);

        if (indices.length === 0) return;



        this.pushHistory();



        if (direction > 0) {

            indices.sort((a, b) => b - a).forEach(index => {

                if (index < this.elements.length - 1) {

                    [this.elements[index], this.elements[index + 1]] = [this.elements[index + 1], this.elements[index]];

                }

            });

        } else {

            indices.sort((a, b) => a - b).forEach(index => {

                if (index > 0) {

                    [this.elements[index], this.elements[index - 1]] = [this.elements[index - 1], this.elements[index]];

                }

            });

        }



        this.elements.forEach((el, index) => {

            el.layer = 100 + index;

        });



        this.render();

    },



    render(skipProperties = false) {

        this.selectedIds = this.selectedIds.filter(id => this.elements.some(el => el.id === id));

        renderElementList();

        renderPreview();

        if (!skipProperties) {

            renderProperties();

        }

        updatePreviewInfo();

    },



    // Toast notification

    showToast(message, type = 'success') {

        let toast = document.querySelector('.toast');

        if (!toast) {

            toast = document.createElement('div');

            toast.className = 'toast';

            document.body.appendChild(toast);

        }

        toast.textContent = message;

        toast.className = 'toast ' + type;

        requestAnimationFrame(() => toast.classList.add('show'));

        clearTimeout(toast._hideTimeout);

        toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 2500);

    }

};



window.getBarLinkedSource = getBarLinkedSource;

window.resolveBarForRender = resolveBarForRender;



/* ========================================

   Element List Rendering

   ======================================== */



function renderElementList() {

    const list = document.getElementById('element-list');

    

    // Create Group Header Container

    let groupHeader = document.getElementById('element-groups-header');

    if (!groupHeader) {

        // remove old tabs if they exist

        const oldTabs = document.getElementById('element-groups-tabs');

        if (oldTabs) oldTabs.remove();



        groupHeader = document.createElement('div');

        groupHeader.id = 'element-groups-header';

        groupHeader.className = 'element-groups-header';

        list.parentElement.insertBefore(groupHeader, list);

    }

    

    // Make sure current group is valid

    if (!App.groups.includes(App.currentGroup)) {

        App.currentGroup = 'Main';

    }



    const optionsHtml = App.groups.map(g => {

        const safeGroup = g.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `<option value="${safeGroup}" ${g === App.currentGroup ? 'selected' : ''}>${safeGroup}</option>`;

    }).join('');



    groupHeader.innerHTML = `

        <select id="active-group-select" class="active-group-select">

            ${optionsHtml}

        </select>

        <button class="btn-group-action" id="btn-add-group" title="Add New Group">+</button>

        ${App.currentGroup !== 'Main' ? `<button class="btn-group-action btn-del-group" id="btn-del-group" title="Delete Group (elements move to Main)">✕</button>` : ''}

    `;



    groupHeader.querySelector('#active-group-select').addEventListener('change', (e) => {

        App.currentGroup = e.target.value;

        App.selectedIds = [];

        App.render();

    });



    groupHeader.querySelector('#btn-add-group').addEventListener('click', async () => {

        const name = await kzPrompt('Enter new group name:');

        if (name && name.trim()) {

            const cleanName = name.trim();

            if (!App.groups.includes(cleanName)) {

                App.pushHistory();

                App.groups.push(cleanName);

                App.currentGroup = cleanName;

                App.render();

            } else {

                App.currentGroup = cleanName;

                App.render();

            }

        }

    });



    const btnDel = groupHeader.querySelector('#btn-del-group');

    if (btnDel) {

        btnDel.addEventListener('click', async () => {

            const gName = App.currentGroup;

            if (await kzConfirm(`Delete group "${gName}"? Elements will be moved to Main.`)) {

                App.pushHistory();

                App.groups = App.groups.filter(g => g !== gName);

                App.elements.forEach(el => { if (el.group === gName) el.group = 'Main'; });

                App.currentGroup = 'Main';

                App.render();

            }

        });

    }



    list.innerHTML = '';



    // Filter elements to only those in the current group

    const visibleElements = App.elements.filter(el => (el.group || 'Main') === App.currentGroup);



    visibleElements.forEach(el => {

        const li = document.createElement('li');

        li.className = 'element-item' + (App.selectedIds.includes(el.id) ? ' selected' : '');

        const isImage = el.type === 'image';

        const isText = el.type === 'text';

        const isHead = el.type === 'player_head';

        const isBar = el.type === 'bar';

        const isXp = el.type === 'xp_label';

        const isNameplate = el.type === 'nameplate';



        const iconClass = isImage ? 'icon-image' : isText ? 'icon-text' : isBar ? 'icon-bar' : isXp ? 'icon-xp' : isNameplate ? 'icon-nameplate' : 'icon-head';

        const iconEmoji = isImage ? '🖼' : isText ? 'T' : isBar ? '▬' : isXp ? '❇' : isNameplate ? '⬜' : '';



        li.innerHTML = `

      <span class="el-icon ${iconClass}">

        ${iconEmoji}

      </span>

      <span class="el-name">${el.name}</span>

      <div class="el-actions">

        <button class="el-layer-btn el-layer-up" title="Move up">↓</button>

        <button class="el-layer-btn el-layer-down" title="Move down">↑</button>

        <button class="el-delete" title="Delete">✕</button>

      </div>

    `;



        li.addEventListener('click', (e) => {

            if (!e.target.closest('.el-delete')) {

                const multi = e.ctrlKey || e.shiftKey || e.metaKey;

                App.selectElement(el.id, multi);

            }

        });



        li.querySelector('.el-delete').addEventListener('click', (e) => {

            e.stopPropagation();

            App.removeElement(el.id);

        });



        li.querySelector('.el-layer-up').addEventListener('click', (e) => {

            e.stopPropagation();

            App.selectElement(el.id);

            App.moveSelectedLayer(1);

        });



        li.querySelector('.el-layer-down').addEventListener('click', (e) => {

            e.stopPropagation();

            App.selectElement(el.id);

            App.moveSelectedLayer(-1);

        });



        list.appendChild(li);

    });

}



function updatePreviewInfo() {

    const info = document.getElementById('preview-info');

    const total = App.elements.length;

    

    // Per-type pricing (coins)

    const ELEMENT_PRICES = {

        image: 5,

        player_head: 5,

        xp_label: 5,

        text: 10,

        bar: 10,

        nameplate: 20

    };

    const coins = App.elements.reduce((sum, el) => sum + (ELEMENT_PRICES[el.type] || 10), 0);

    

    // Count by type

    const imgs = App.elements.filter(e => e.type === 'image').length;

    const txts = App.elements.filter(e => e.type === 'text').length;

    const heads = App.elements.filter(e => e.type === 'player_head').length;

    const bars = App.elements.filter(e => e.type === 'bar').length;

    const xps = App.elements.filter(e => e.type === 'xp_label').length;

    const nps = App.elements.filter(e => e.type === 'nameplate').length;



    const parts = [];

    if (imgs > 0) parts.push(`${imgs} image${imgs > 1 ? 's' : ''}`);

    if (txts > 0) parts.push(`${txts} text${txts > 1 ? 's' : ''}`);

    if (heads > 0) parts.push(`${heads} head${heads > 1 ? 's' : ''}`);

    if (bars > 0) parts.push(`${bars} bar${bars > 1 ? 's' : ''}`);

    if (xps > 0) parts.push(`${xps} xp${xps > 1 ? 's' : ''}`);

    if (nps > 0) parts.push(`${nps} nameplate${nps > 1 ? 's' : ''}`);

    

    // Custom widget cost

    let finalCoins = coins;

    if (window.Widgets && typeof Widgets.getWidgetsImageData === 'function') {

        if (Widgets.getWidgetsImageData()) {

            parts.push('1 custom widget');

            finalCoins += 15;

        }

    }

    

    // Show element counts and coin calculation

    if (info) {

        const elementText = parts.length > 0 ? parts.join(', ') : '0 elements';

        // Desktop app: no coins, show element counts only
        info.textContent = elementText;

    }

}



/* ========================================

   Texture Slicing Utility

   ======================================== */



/**

 * Resizes image to target size then slices into 16 progressive crops.

 * For toolbar bars: resize actual image to target size first, then slice.

 */

function resizeAndSliceBarTexture(dataUrl, targetWidth, targetHeight, direction = 'left') {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = () => {

            try {

                const slices = [];

                const fullW = img.width;

                const fullH = img.height;



                if (!fullW || !fullH) {

                    reject(new Error('Invalid image size for bar texture'));

                    return;

                }



                // Resize image to target size first

                const resizeCanvas = document.createElement('canvas');

                resizeCanvas.width = targetWidth;

                resizeCanvas.height = targetHeight;

                const resizeCtx = resizeCanvas.getContext('2d');

                if (!resizeCtx) {

                    reject(new Error('Canvas context is not available'));

                    return;

                }

                

                // Use better quality scaling

                resizeCtx.imageSmoothingEnabled = true;

                resizeCtx.imageSmoothingQuality = 'high';

                resizeCtx.drawImage(img, 0, 0, targetWidth, targetHeight);



                const isVertical = direction === 'top' || direction === 'bottom';

                let align = 'left';

                if (direction === 'right') align = 'right';

                else if (direction === 'center') align = 'center';

                else if (direction === 'top') align = 'top';

                else if (direction === 'bottom') align = 'bottom';



                for (let i = 1; i <= 16; i++) {

                    const canvas = document.createElement('canvas');

                    canvas.width = targetWidth;

                    canvas.height = targetHeight;

                    const ctx = canvas.getContext('2d');

                    if (!ctx) {

                        reject(new Error('Canvas context is not available'));

                        return;

                    }



                    if (isVertical) {

                        const sliceH = Math.max(1, Math.round((i / 16) * targetHeight));

                        let sy = 0;

                        let dy = 0;

                        if (align === 'bottom') {

                            sy = targetHeight - sliceH;

                            dy = targetHeight - sliceH;

                        }



                        ctx.drawImage(resizeCanvas, 0, sy, targetWidth, sliceH, 0, dy, targetWidth, sliceH);

                    } else {

                        const sliceW = Math.max(1, Math.round((i / 16) * targetWidth));

                        let sx = 0;

                        let dx = 0;

                        if (align === 'right') {

                            sx = targetWidth - sliceW;

                            dx = targetWidth - sliceW;

                        } else if (align === 'center') {

                            sx = Math.floor((targetWidth - sliceW) / 2);

                            dx = Math.floor((targetWidth - sliceW) / 2);

                        }



                        ctx.drawImage(resizeCanvas, sx, 0, sliceW, targetHeight, dx, 0, sliceW, targetHeight);

                    }

                    slices.push(canvas.toDataURL('image/png'));

                }

                resolve({ slices, width: targetWidth, height: targetHeight });

            } catch (error) {

                reject(error);

            }

        };

        img.onerror = () => reject(new Error('Failed to load bar texture image'));

        img.src = dataUrl;

    });

}



/**

 * Slices a full bar image into 16 progressive horizontal crops.

 * Each slice i (0-based) shows 0..i+1 proportional width of the image.

 * Returns a Promise<string[]> of 16 DataURL PNGs.

 */

function sliceBarTexture(dataUrl, direction = 'left') {

    return new Promise((resolve, reject) => {

        const img = new Image();

        img.onload = () => {

            try {

                const slices = [];

                const fullW = img.width;

                const fullH = img.height;



                if (!fullW || !fullH) {

                    reject(new Error('Invalid image size for bar texture'));

                    return;

                }



                const isVertical = direction === 'top' || direction === 'bottom';

                let align = 'left';

                if (direction === 'right') align = 'right';

                else if (direction === 'center') align = 'center';

                else if (direction === 'top') align = 'top';

                else if (direction === 'bottom') align = 'bottom';



                for (let i = 1; i <= 16; i++) {

                    const canvas = document.createElement('canvas');

                    canvas.width = fullW;

                    canvas.height = fullH;

                    const ctx = canvas.getContext('2d');

                    if (!ctx) {

                        reject(new Error('Canvas context is not available'));

                        return;

                    }



                    if (isVertical) {

                        const sliceH = Math.max(1, Math.round((i / 16) * fullH));

                        let sy = 0;

                        let dy = 0;

                        if (align === 'bottom') {

                            sy = fullH - sliceH;

                            dy = fullH - sliceH;

                        }



                        ctx.drawImage(img, 0, sy, fullW, sliceH, 0, dy, fullW, sliceH);

                    } else {

                        const sliceW = Math.max(1, Math.round((i / 16) * fullW));

                        let sx = 0;

                        let dx = 0;

                        if (align === 'right') {

                            sx = fullW - sliceW;

                            dx = fullW - sliceW;

                        } else if (align === 'center') {

                            sx = Math.floor((fullW - sliceW) / 2);

                            dx = Math.floor((fullW - sliceW) / 2);

                        }



                        ctx.drawImage(img, sx, 0, sliceW, fullH, dx, 0, sliceW, fullH);

                    }

                    slices.push(canvas.toDataURL('image/png'));

                }

                resolve({ slices, width: fullW, height: fullH });

            } catch (error) {

                reject(error);

            }

        };

        img.onerror = () => reject(new Error('Failed to load bar texture image'));

        img.src = dataUrl;

    });

}



/* ========================================

   Initialize

   ======================================== */



document.addEventListener('DOMContentLoaded', () => {

    // Clear current project ID on page load to prevent exporting old data
    // User must explicitly save before export
    localStorage.removeItem('current_project_id');

    const btnUndo = document.getElementById('btn-undo');

    const btnRedo = document.getElementById('btn-redo');

    const btnLayerUp = document.getElementById('btn-layer-up');

    const btnLayerDown = document.getElementById('btn-layer-down');



    // Add Image button

    document.getElementById('btn-add-image').addEventListener('click', () => {

        document.getElementById('image-upload').click();

    });



    if (btnUndo) {

        btnUndo.addEventListener('click', () => App.undo());

    }



    if (btnRedo) {

        btnRedo.addEventListener('click', () => App.redo());

    }



    if (btnLayerUp) {

        btnLayerUp.addEventListener('click', () => App.moveSelectedLayer(1));

    }



    if (btnLayerDown) {

        btnLayerDown.addEventListener('click', () => App.moveSelectedLayer(-1));

    }



    // Add Player Head button

    const btnHead = document.getElementById('btn-add-player-head');

    if (btnHead) {

        btnHead.addEventListener('click', () => {

            App.addElement('player_head');

        });

    }



    // Add Bar button

    const btnBar = document.getElementById('btn-add-bar');

    if (btnBar) {

        btnBar.addEventListener('click', () => {

            document.getElementById('bar-upload').click();

        });

    }



    // ── Image / bar upload: several files can be picked at once ──
    const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
        reader.readAsDataURL(file);
    });
    const loadImageSize = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => reject(new Error('Not a valid image'));
        img.src = src;
    });
    const baseName = (file) => file.name.replace(/\.[^.]+$/, '');
    // Adds each file in the order picked, then selects everything that was added
    const addFilesAsElements = async (input, addOne, label) => {
        const files = Array.from(input.files || []);
        input.value = '';
        if (files.length === 0) return;
        const addedIds = [];
        const failed = [];
        if (files.length > 1) App.showToast(`Adding ${files.length} ${label}s…`, 'info');
        for (const file of files) {
            try {
                const el = await addOne(file);
                if (el) addedIds.push(el.id);
            } catch (err) {
                console.error(`Failed to add ${file.name}:`, err);
                failed.push(file.name);
            }
        }
        if (addedIds.length > 1) {
            App.selectedIds = addedIds;
            App.render();
        }
        if (failed.length) {
            App.showToast(`Could not add: ${failed.join(', ')}`, 'error');
        } else if (addedIds.length > 1) {
            App.showToast(`Added ${addedIds.length} ${label}s`, 'success');
        }
    };

    // Bar upload handler (slices into 16 images)
    document.getElementById('bar-upload').addEventListener('change', (e) => {
        addFilesAsElements(e.target, async (file) => {
            const dataUrl = await readFileAsDataURL(file);
            const barType = 'hp';
            const texPath = `textures/hotbar/fill_${barType}/horizontal/16`;
            const result = await sliceBarTexture(dataUrl, 'left');
            return App.addElement('bar', {
                name: baseName(file),
                barType: barType,
                barTexturePath: texPath,
                sliceDirection: 'left',
                imageData: dataUrl,
                slicedImages: result.slices,
                barMaxSize: [result.width, result.height],
                barMinSize: [Math.round(result.width / 16), result.height],
                size: [result.width, result.height],
                previewStep: 16
            });
        }, 'bar');
    });

    // Image upload handler
    document.getElementById('image-upload').addEventListener('change', (e) => {
        addFilesAsElements(e.target, async (file) => {
            // an animated GIF / WebP / APNG becomes an animated image (animation.js)
            const anim = window.KzAnim ? await KzAnim.framesFromFiles([file]).catch(() => null) : null;
            if (anim && anim.frames.length > 1) {
                const n = await KzAnim.normalizeFrames(anim.frames);
                return App.addElement('image', {
                    imageData: n.frames[0],
                    animFrames: n.frames,
                    animFrameSize: [n.w, n.h],
                    animFps: anim.fps || 10,
                    imageName: baseName(file),
                    texturePath: `textures/${App.getNamespace()}/${baseName(file)}`,
                    size: [n.w, n.h],
                    name: baseName(file),
                });
            }
            let dataUrl = await readFileAsDataURL(file);
            // the pack stores every picture as .png: convert JPEG / WebP / GIF
            if (window.KzAnim && !/^data:image\/png;/.test(dataUrl)) dataUrl = (await KzAnim.normalizeFrames([dataUrl])).frames[0];
            const { w, h } = await loadImageSize(dataUrl);
            return App.addElement('image', {
                imageData: dataUrl,
                imageName: baseName(file),
                texturePath: `textures/${App.getNamespace()}/${baseName(file)}`,
                size: [w, h],
                name: baseName(file),
            });
        }, 'image');
    });



    // Add Text button

    document.getElementById('btn-add-text').addEventListener('click', () => {

        App.addElement('text');

    });



    // Add Nameplate button

    const btnNameplate = document.getElementById('btn-add-nameplate');

    if (btnNameplate) {

        btnNameplate.addEventListener('click', () => {

            const npCount = App.elements.filter(e => e.type === 'nameplate').length;

            App.addElement('nameplate', {

                name: `Nameplate ${npCount + 1}`,

                anchor_from: 'top_right',

                anchor_to: 'top_right',

                offset: [-4, 5],

                size: [60, 15],

                lockPosition: true,

                font_size: 'normal',

                color: [1, 1, 1],

                shadow: false,

                papi_placeholder: '',

                pad_length: 30,

                layer: 102,

                collection_index: npCount

            });

        });

    }



    // Add XP Num button

    const btnXp = document.getElementById('btn-add-xp');

    if (btnXp) {

        btnXp.addEventListener('click', () => {

            App.addElement('xp_label', {

                name: 'xp_text',

                text: '13',

                xp_font_size: 'normal',

                xp_color: [0.5, 1.0, 0.1],

                xp_shadow: true,

                offset: [10, 10],

                anchor_from: 'top_left',

                anchor_to: 'top_left',

                size: [12, 9],   // the number is centred in this box (preview, Bedrock, Java)

                layer: 101

            });

        });

    }



    // Export button

    document.getElementById('btn-export').addEventListener('click', () => {

        exportMcpack();

    });



    // Click on preview background to deselect

    document.getElementById('preview-screen').addEventListener('click', (e) => {

        if (e.target === e.currentTarget || e.target.id === 'preview-elements') {

            App.selectedIds = [];

            App.render();

        }

    });



    // Keyboard arrow keys to move selected element

    document.addEventListener('keydown', (e) => {

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;



        // Ctrl+C: Copy selected elements

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {

            e.preventDefault();

            App.copySelected();

            return;

        }



        // Ctrl+V: Paste copied elements

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {

            e.preventDefault();

            App.pasteClipboard();

            return;

        }



        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {

            e.preventDefault();

            App.undo();

            return;

        }



        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {

            e.preventDefault();

            App.redo();

            return;

        }



        const selected = App.getAllSelected();

        if (selected.length === 0) return;



        if (e.key === 'Delete') {

            App.removeSelected();

            e.preventDefault();

            return;

        }



        if (selected.some(el => {

            const target = typeof getPositionTargetElement === 'function' ? getPositionTargetElement(App.elements, el) : el;

            return !!(target && target.lockPosition);

        })) {

            return;

        }



        // User requested: Arrow keys = 0.1, Ctrl + Arrow = 1.0

        const step = (e.ctrlKey || e.metaKey) ? 1.0 : 0.1;

        let dx = 0; let dy = 0;



        switch (e.key) {

            case 'ArrowLeft': dx = -step; break;

            case 'ArrowRight': dx = step; break;

            case 'ArrowUp': dy = -step; break;

            case 'ArrowDown': dy = step; break;

        }



        if (dx !== 0 || dy !== 0) {

            e.preventDefault();

            App.pushHistory();

            const updatedTargets = new Set();

            selected.forEach(el => {

                const target = typeof getPositionTargetElement === 'function' ? getPositionTargetElement(App.elements, el) : el;

                if (!target || target.lockPosition || updatedTargets.has(target.id)) return;

                target.offset = [

                    Math.round((target.offset[0] + dx) * 10) / 10,

                    Math.round((target.offset[1] + dy) * 10) / 10,

                ];

                updatedTargets.add(target.id);

            });

            App.render();

        }

    });



    // Zoom Controls

    const btnZoomIn = document.getElementById('btn-zoom-in');

    const btnZoomOut = document.getElementById('btn-zoom-out');

    const zoomLevelEl = document.getElementById('zoom-level');

    const previewScreen = document.getElementById('preview-screen');

    let currentZoom = 100;



    function updateZoom() {

        currentZoom = Math.max(25, Math.min(800, currentZoom)); // Clamp 25% to 800%

        zoomLevelEl.textContent = `${currentZoom}%`;

        // Base width was 800px or 90%. We adjust max-width so it can grow

        previewScreen.style.maxWidth = 'none';

        previewScreen.style.width = `${currentZoom * 8}px`; // 100% = 800px



        // Render immediately, and also after a short delay in case of any reflows

        App.render();

        setTimeout(() => App.render(), 50);

        setTimeout(() => App.render(), 250);

    }



    if (btnZoomIn) {

        btnZoomIn.addEventListener('click', () => {

            currentZoom += 25;

            updateZoom();

        });

    }

    if (btnZoomOut) {

        btnZoomOut.addEventListener('click', () => {

            currentZoom -= 25;

            updateZoom();

        });

    }



    // Initial render

    App.render();

});

