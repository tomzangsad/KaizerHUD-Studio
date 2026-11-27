import path from 'node:path';
import { resolveAppDataDir } from './live_client.mjs';

export const HUD_TYPES = ['image', 'text', 'bar', 'player_head', 'xp_label', 'nameplate'];
export const HUD_ANCHORS = [
  'top_left', 'top_middle', 'top_right',
  'middle_left', 'center', 'middle_right',
  'bottom_left', 'bottom_middle', 'bottom_right',
];
export const DEFAULT_TEXT_OFFSETS = { small: [0, -2.8], normal: [0, -4.1], large: [0, -5.3] };

export function resolveHudProjectsDir() {
  if (process.env.KAIZER_HUD_PROJECTS_DIR) {
    return path.resolve(process.env.KAIZER_HUD_PROJECTS_DIR);
  }
  return path.join(resolveAppDataDir(), 'projects');
}

export function slugNs(s, fallback = 'custom_hud') {
  const out = String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return out || fallback;
}

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

export function autoPadLength(papi) {
  const s = String(papi || '');
  const chars = Array.from(s);
  const enc = new TextEncoder();
  let total = chars.some((c) => c.codePointAt(0) > 0x7f) ? 0 : 3;
  for (let i = 0; i < chars.length;) {
    const c = chars[i];
    if (c === '%') {
      const end = chars.indexOf('%', i + 1);
      if (end > i + 1) {
        const name = chars.slice(i + 1, end).join('');
        if (!name.includes(' ')) {
          total += placeholderMaxBytes(name);
          i = end + 1;
          continue;
        }
      }
    }
    if (c === '&' && i + 1 < chars.length && /^[0-9a-fk-orxzywv]$/i.test(chars[i + 1])) {
      total += 3;
      i += 2;
      continue;
    }
    total += enc.encode(c).length;
    i += 1;
  }
  return Math.max(1, total);
}

export function effectivePadLength(el) {
  if (el && el.pad_auto === false) return parseInt(el.pad_length, 10) || 30;
  return autoPadLength(el && el.papi_placeholder);
}

export function newHudProjectData({
  namespace = 'custom_hud',
  nameplatePosition = 'top_right',
  nameplateMobileOffset = 26,
} = {}) {
  return {
    elements: [],
    namespace: slugNs(namespace, 'custom_hud'),
    selectedIds: [],
    groups: ['Main'],
    currentGroup: 'Main',
    widgetsImageData: null,
    codeOverrides: {},
    packUuids: null,
    nameplatePosition: ['top_left', 'top_right', 'top_middle'].includes(nameplatePosition) ? nameplatePosition : 'top_right',
    nameplateMobileOffset: Number.isFinite(Number(nameplateMobileOffset)) ? Math.max(0, Number(nameplateMobileOffset)) : 26,
    hudChannel: 'title',
    syncFolder: null,
  };
}

function nextUniqueBarTag(existing) {
  const used = new Set(existing.map((e) => e.barCustomTag).filter(Boolean));
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      const tag = letters[i] + letters[j];
      if (!['hp', 'fd', 'ar', 'ox', 'ex'].includes(tag) && !used.has(tag)) return tag;
    }
  }
  return 'ca';
}

export function newHudElement(type, spec = {}, existing = [], group = 'Main') {
  const t = HUD_TYPES.includes(type) ? type : 'image';
  const maxId = existing.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0);
  const id = Number(spec.id) > 0 ? Number(spec.id) : maxId + 1;
  const ns = slugNs(spec.namespace, 'custom_hud');

  const countOf = (kind) => existing.filter((e) => e.type === kind).length;
  let defaultName = `Element ${id}`;
  let defaultSize = [100, 73];
  let defaultLayer = 100;
  let defaultOffset = [0, 0];
  if (t === 'image') {
    defaultName = `Image ${countOf('image') + 1}`;
  } else if (t === 'text') {
    defaultName = `Text ${countOf('text') + 1}`;
    defaultSize = [100, 10];
    defaultLayer = 102;
  } else if (t === 'player_head') {
    defaultName = `Player Head ${countOf('player_head') + 1}`;
    defaultSize = [35, 31];
    defaultLayer = 101;
    defaultOffset = [1, 18];
  } else if (t === 'bar') {
    defaultName = `Bar ${countOf('bar') + 1}`;
    defaultSize = [49, 6];
  } else if (t === 'xp_label') {
    defaultName = 'XP Level Number';
    defaultSize = [12, 9];
    defaultLayer = 105;
  } else if (t === 'nameplate') {
    defaultName = `Nameplate ${countOf('nameplate') + 1}`;
    defaultSize = [60, 15];
    defaultLayer = 102;
    defaultOffset = [-4, 5];
  }

  const size = Array.isArray(spec.size) && spec.size.length >= 2 ? [Number(spec.size[0]) || defaultSize[0], Number(spec.size[1]) || defaultSize[1]] : [...defaultSize];
  const offset = Array.isArray(spec.offset) && spec.offset.length >= 2 ? [Number(spec.offset[0]) || 0, Number(spec.offset[1]) || 0] : [...defaultOffset];
  const anchorFrom = HUD_ANCHORS.includes(spec.anchor_from) ? spec.anchor_from : 'top_left';
  const anchorTo = HUD_ANCHORS.includes(spec.anchor_to) ? spec.anchor_to : anchorFrom;
  const barType = spec.barType || 'hp';
  const fontSize = ['small', 'normal', 'large'].includes(spec.font_size) ? spec.font_size : 'small';

  const imgSlug = slugNs(spec.name || defaultName, `img_${id}`);
  const barTag = spec.barCustomTag || (t === 'bar' && barType === 'custom' ? nextUniqueBarTag(existing) : '');
  const texPath = spec.texturePath || (t === 'image' ? `textures/${ns}/${imgSlug}` : '');
  const barTexPath = spec.barTexturePath || `textures/${ns}/bar_${barTag || barType}_${id}/16`;

  const el = {
    id,
    group: spec.group || group || 'Main',
    type: t,
    name: spec.name || defaultName,
    anchor_from: anchorFrom,
    anchor_to: anchorTo,
    offset,
    size,
    layer: spec.layer != null ? Number(spec.layer) : defaultLayer,
    alpha: spec.alpha != null ? Number(spec.alpha) : 1.0,
    imageData: spec.imageData || null,
    imageName: spec.imageName || (t === 'image' ? `${imgSlug}.png` : ''),
    texturePath: texPath,
    color: Array.isArray(spec.color) ? spec.color : [1, 1, 1],
    animFrames: Array.isArray(spec.animFrames) ? [...spec.animFrames] : [],
    animFps: spec.animFps || 10,
    animFrameSize: Array.isArray(spec.animFrameSize) ? [...spec.animFrameSize] : null,
    collection_index: spec.collection_index !== undefined
      ? Number(spec.collection_index)
      : (t === 'nameplate' ? countOf('nameplate') : countOf('text')),
    papi_placeholder: spec.papi_placeholder || (t === 'text' || t === 'nameplate' ? '%player_name%' : ''),
    pad_auto: spec.pad_auto !== undefined ? spec.pad_auto !== false : true,
    pad_length: spec.pad_length != null ? Number(spec.pad_length) : undefined,
    font_size: fontSize,
    shadow: spec.shadow === true,
    text_anchor_from: spec.text_anchor_from || 'top_left',
    text_anchor_to: spec.text_anchor_to || spec.text_anchor_from || 'top_left',
    text_offset: Array.isArray(spec.text_offset) ? spec.text_offset : [...(DEFAULT_TEXT_OFFSETS[fontSize] || DEFAULT_TEXT_OFFSETS.small)],
    text_offsets: spec.text_offsets || { ...DEFAULT_TEXT_OFFSETS },
    doll_size: spec.doll_size || [75, 205],
    doll_offset: spec.doll_offset || [1, 18],
    head_zoom: spec.head_zoom != null ? Number(spec.head_zoom) : 2.05,
    barType,
    barCustomTag: barTag,
    barCustomPapi: spec.barCustomPapi || '',
    barCustomMax: spec.barCustomMax || '',
    barMinSize: spec.barMinSize || [3, size[1]],
    barMaxSize: spec.barMaxSize || [...size],
    barTexturePath: barTexPath,
    slicedImages: Array.isArray(spec.slicedImages) ? spec.slicedImages : [],
    previewStep: spec.previewStep || 16,
    barEffects: Array.isArray(spec.barEffects) ? spec.barEffects : [],
    useLinkedPosition: spec.useLinkedPosition === true,
    linkedPositionId: spec.linkedPositionId || null,
    useLinkedProperties: spec.useLinkedProperties === true,
    linkedBarId: spec.linkedBarId || null,
    visibilityMode: spec.visibilityMode || 'always',
    isPapiBar: spec.isPapiBar === true,
    papiPlaceholder: spec.papiPlaceholder || '',
    text: spec.text || '13',
    xp_shadow: spec.xp_shadow !== undefined ? spec.xp_shadow : true,
    ...(t === 'xp_label' ? {
      xp_color: Array.isArray(spec.xp_color) ? spec.xp_color : [0.5, 1.0, 0.1],
      xp_font_size: spec.xp_font_size || 'normal',
    } : {}),
    lockPosition: t === 'nameplate' ? true : spec.lockPosition === true,
    visibilityEnabled: spec.visibilityEnabled === true,
    visibilityPapi: spec.visibilityPapi || '',
    visibilityOperator: spec.visibilityOperator || '==',
    visibilityValue: spec.visibilityValue || '',
    visibilityInvert: spec.visibilityInvert === true,
    visibilityExtra: Array.isArray(spec.visibilityExtra) ? spec.visibilityExtra : [],
  };

  if (el.pad_length == null) {
    el.pad_length = autoPadLength(el.papi_placeholder);
  }
  return el;
}

export function inspectHudBudget(elements = []) {
  const prefixBytes = 25; // "@zelisce/custom_bossbars:"
  let barsBytes = 0;
  let customIdx = 0;
  for (const el of elements) {
    if (el.type !== 'bar') continue;
    if (el.useLinkedProperties && el.linkedBarId != null) continue;
    if (['hp', 'food', 'armor', 'air', 'exp'].includes(el.barType || 'hp')) {
      barsBytes += 6;
    } else if (el.barType === 'custom') {
      customIdx += 1;
      const tag = String(el.barCustomTag || 'ca');
      barsBytes += 1 + String(customIdx).length + tag.length + 2;
    }
  }
  const slotEls = elements.filter((e) => e.type === 'text' || e.type === 'nameplate');
  const slots = slotEls.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    papi: e.papi_placeholder || '',
    bytes: effectivePadLength(e),
  }));
  const padsBytes = slots.reduce((s, x) => s + x.bytes, 0);
  const totalBytes = prefixBytes + barsBytes + padsBytes;

  // Approximate Multi-Bank split (bank 0 max 255B total, overflow banks max 250B payload after "@kzN:")
  const banks = [];
  let curBytes = prefixBytes + barsBytes;
  let curSlots = [];
  for (const s of slots) {
    const limit = banks.length === 0 ? 255 : 250;
    if (curSlots.length > 0 && curBytes + s.bytes > limit) {
      banks.push({ bank: banks.length, bytes: curBytes, slots: curSlots });
      curBytes = s.bytes;
      curSlots = [s];
    } else {
      curBytes += s.bytes;
      curSlots.push(s);
    }
  }
  banks.push({ bank: banks.length, bytes: curBytes + (banks.length > 0 ? 5 : 0), slots: curSlots });

  const bankCount = banks.length;
  return {
    prefixBytes,
    barsBytes,
    padsBytes,
    totalBytes,
    bankCount,
    maxBanks: 8,
    overLimit: bankCount > 8,
    channel: 'title',
    requiresMultiBar: bankCount > 1 ? '2.2.0+' : '2.1.0+',
    banks,
  };
}

export function validateHudProject(data = {}) {
  const problems = [];
  const ns = String(data.namespace || '');
  if (!/^[a-z0-9_]{1,32}$/.test(ns)) {
    problems.push({ level: 'error', msg: `Invalid namespace "${ns}" (use a-z, 0-9, _)` });
  }
  const els = Array.isArray(data.elements) ? data.elements : [];
  if (!els.length) {
    problems.push({ level: 'warn', msg: 'HUD has no elements yet' });
  }
  const seenIds = new Set();
  for (const el of els) {
    if (seenIds.has(el.id)) problems.push({ level: 'error', elementId: el.id, msg: `Duplicate element id ${el.id}` });
    seenIds.add(el.id);
    if (!HUD_ANCHORS.includes(el.anchor_from || 'top_left')) {
      problems.push({ level: 'warn', elementId: el.id, msg: `${el.name}: non-standard anchor "${el.anchor_from}"` });
    }
    if (el.type === 'image' && !el.imageData && !(el.animFrames && el.animFrames.length)) {
      problems.push({ level: 'warn', elementId: el.id, msg: `Image "${el.name}" has no imageData yet` });
    }
    if ((el.type === 'text' || el.type === 'nameplate') && !String(el.papi_placeholder || '').trim()) {
      problems.push({ level: 'warn', elementId: el.id, msg: `Text "${el.name}" has empty papi_placeholder` });
    }
  }
  const budget = inspectHudBudget(els);
  if (budget.overLimit) {
    problems.push({ level: 'error', msg: `HUD requires ${budget.bankCount} banks (max 8 banks). Reduce text pad lengths.` });
  }
  return { ok: problems.every((p) => p.level !== 'error'), problems, budget };
}

export function applyLayoutOp(items, op, opts = {}) {
  if (!Array.isArray(items) || !items.length) return [];
  const mode = opts.mode === 'gui' ? 'gui' : 'hud';
  const getBox = (it) => mode === 'gui'
    ? { x: Number(it.x) || 0, y: Number(it.y) || 0, w: Math.max(1, Number(it.w) || 1), h: Math.max(1, Number(it.h) || 1) }
    : {
        x: Number(it.offset?.[0]) || 0,
        y: Number(it.offset?.[1]) || 0,
        w: Math.max(1, Number(it.size?.[0]) || 1),
        h: Math.max(1, Number(it.size?.[1]) || 1),
      };
  const setBox = (it, box) => {
    if (mode === 'gui') {
      it.x = Math.round(box.x);
      it.y = Math.round(box.y);
    } else {
      it.offset = [Math.round(box.x), Math.round(box.y)];
    }
  };

  const boxes = items.map(getBox);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const midX = (minX + maxX) * 0.5;
  const midY = (minY + maxY) * 0.5;
  const grid = Math.max(1, Number(opts.grid) || 4);

  if (op === 'align_left') items.forEach((it, i) => setBox(it, { ...boxes[i], x: minX }));
  else if (op === 'align_center') items.forEach((it, i) => setBox(it, { ...boxes[i], x: midX - boxes[i].w * 0.5 }));
  else if (op === 'align_right') items.forEach((it, i) => setBox(it, { ...boxes[i], x: maxX - boxes[i].w }));
  else if (op === 'align_top') items.forEach((it, i) => setBox(it, { ...boxes[i], y: minY }));
  else if (op === 'align_middle') items.forEach((it, i) => setBox(it, { ...boxes[i], y: midY - boxes[i].h * 0.5 }));
  else if (op === 'align_bottom') items.forEach((it, i) => setBox(it, { ...boxes[i], y: maxY - boxes[i].h }));
  else if (op === 'snap_grid') {
    items.forEach((it, i) => setBox(it, {
      ...boxes[i],
      x: Math.round(boxes[i].x / grid) * grid,
      y: Math.round(boxes[i].y / grid) * grid,
    }));
  } else if (op === 'mirror_h') {
    const cx = opts.canvas_width != null ? Number(opts.canvas_width) * 0.5 : midX;
    items.forEach((it, i) => setBox(it, { ...boxes[i], x: 2 * cx - (boxes[i].x + boxes[i].w) }));
  } else if (op === 'mirror_v') {
    const cy = opts.canvas_height != null ? Number(opts.canvas_height) * 0.5 : midY;
    items.forEach((it, i) => setBox(it, { ...boxes[i], y: 2 * cy - (boxes[i].y + boxes[i].h) }));
  } else if (op === 'distribute_h' && items.length >= 3) {
    const sorted = items.map((it, i) => ({ it, box: boxes[i] })).sort((a, b) => a.box.x - b.box.x);
    const totalW = sorted.reduce((s, x) => s + x.box.w, 0);
    const gap = opts.gap != null ? Number(opts.gap) : ((maxX - minX - totalW) / (sorted.length - 1));
    let cur = sorted[0].box.x;
    for (const entry of sorted) {
      setBox(entry.it, { ...entry.box, x: cur });
      cur += entry.box.w + gap;
    }
  } else if (op === 'distribute_v' && items.length >= 3) {
    const sorted = items.map((it, i) => ({ it, box: boxes[i] })).sort((a, b) => a.box.y - b.box.y);
    const totalH = sorted.reduce((s, x) => s + x.box.h, 0);
    const gap = opts.gap != null ? Number(opts.gap) : ((maxY - minY - totalH) / (sorted.length - 1));
    let cur = sorted[0].box.y;
    for (const entry of sorted) {
      setBox(entry.it, { ...entry.box, y: cur });
      cur += entry.box.h + gap;
    }
  } else if (op === 'stack_vertical') {
    const gap = opts.gap != null ? Number(opts.gap) : 4;
    let cur = boxes[0].y;
    items.forEach((it, i) => {
      setBox(it, { ...boxes[i], x: boxes[0].x, y: cur });
      cur += boxes[i].h + gap;
    });
  } else if (op === 'stack_horizontal') {
    const gap = opts.gap != null ? Number(opts.gap) : 4;
    let cur = boxes[0].x;
    items.forEach((it, i) => {
      setBox(it, { ...boxes[i], x: cur, y: boxes[0].y });
      cur += boxes[i].w + gap;
    });
  } else {
    throw new Error(`Unknown layout op: ${op}`);
  }
  return items;
}
