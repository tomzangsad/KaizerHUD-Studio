import crypto from 'node:crypto';

export const ID_RE = /^[a-z0-9_]{1,32}$/;
export const DEFAULT_W = 640;
export const DEFAULT_H = 360;
export const MAX_SIDE = 960;
export const TYPES = ['image', 'button', 'text', 'player_head', 'player_model', 'item', 'custom_model', 'input', 'roulette', 'scroll_area'];

export function slug(s, fallback = 'menu') {
  const out = String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return out || fallback;
}

export function uid(prefix = 'e') {
  return prefix + crypto.randomBytes(4).toString('hex');
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function int(v, def) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : def;
}

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function newMenu(id = 'main', title = 'Main Menu') {
  return {
    id,
    title,
    command: '',
    width: DEFAULT_W,
    height: DEFAULT_H,
    refreshTicks: 20,
    openSound: '',
    fullscreen: true,
    backdrop: '#000000',
    backdropAlpha: 0.6,
    bedrockBackdrop: false,
    prevPage: '',
    nextPage: '',
    motion: { open: 'none', openMs: 0, cascade: 'none', cascadeMs: 0, cascadeGap: 35 },
    elements: [],
  };
}

export function newProject(namespace = 'kaizerui', packHost = 'itemsadder') {
  return {
    kind: 'kaizer-gui',
    version: 1,
    namespace: slug(namespace, 'kaizerui'),
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
      packHost: ['itemsadder', 'nexo', 'oraxen', 'zip'].includes(packHost) ? packHost : 'itemsadder',
    },
    packUuids: null,
    packVersion: 0,
  };
}

export function newElement(type, menu) {
  const t = TYPES.includes(type) ? type : 'image';
  const base = {
    id: uid(t[0]),
    type: t,
    name: '',
    x: 0,
    y: 0,
    w: 32,
    h: 16,
    hidden: false,
    scrollGroup: '',
    motion: { intro: 'auto', introDelay: 0, introMs: 0, loop: 'none', loopAmount: 1, loopMs: 0, ...(t === 'button' ? { hover: 'none', press: 'none' } : {}) },
  };
  if (t === 'image') {
    Object.assign(base, { w: 64, h: 64, detail: 1, image: null, frames: [], fps: 8 });
  } else if (t === 'button') {
    Object.assign(base, {
      w: 88, h: 22, detail: 1, image: null, hoverImage: null, frames: [], fps: 8,
      label: 'Button', labelColor: '#ffffff', labelScale: 1, labelShadow: true,
      actions: [], closeOnClick: false, hoverSound: '', tooltip: '',
    });
  } else if (t === 'text') {
    Object.assign(base, { w: 120, h: 12, text: 'Hello %player_name%', color: '#ffffff', scale: 1, shadow: true, align: 'center' });
  } else if (t === 'player_head' || t === 'player_model') {
    const head = t === 'player_head';
    Object.assign(base, { w: head ? 32 : 48, h: head ? 32 : 96, player: '%player_name%', hat: true, dollSize: null, dollOffset: null, tooltip: '' });
    if (!head) Object.assign(base, { java3d: true, outfit: 'own', pose: 'standing', turn: 'none', angle: 20, spinSpeed: 45, bedrockRenderer: 'auto' });
  } else if (t === 'item') {
    Object.assign(base, { w: 24, h: 24, item: 'minecraft:diamond_sword', glint: false, look: 'flat', spin: false, bedrockTexture: '', tooltip: '' });
  } else if (t === 'custom_model') {
    Object.assign(base, {
      w: 48, h: 64, modelId: 'meg:dragon', animation: 'idle',
      scale3d: 1, angle: 20, spin: false, spinSpeed: 45,
      hitboxW: 1, hitboxH: 2, bedrockTexture: '', tooltip: '',
    });
  } else if (t === 'input') {
    Object.assign(base, {
      w: 96, h: 20, varName: 'qty', inputType: 'number', defaultValue: '1',
      min: 1, max: 64, step: 1, prefix: 'Qty: ', suffix: '',
      promptTitle: 'Enter amount', placeholder: 'Type value...',
      textColor: '#ffffff', bgColor: '#161b26', borderColor: '#52a0f0',
      scale: 1, shadow: true, align: 'center', actions: [], tooltip: '',
    });
  } else if (t === 'roulette') {
    Object.assign(base, {
      w: 260, h: 56, slotSize: 44, slotGap: 6, durationSec: 4.2, spinStyle: 'csgo',
      reels: 3, cardCount: 5,
      bgColor: '#0d111a', borderColor: '#e5a43a', pointerColor: '#ff4d4f',
      tickSound: 'minecraft:block.note_block.hat;0.7;1.4',
      winSound: 'minecraft:entity.player.levelup;1.0;1.1',
      tooltip: '',
      rewards: [
        { id: 'r1', name: 'Iron Ingot', item: 'minecraft:iron_ingot', color: '#9ca3af', weight: 45, actions: ['console:give %player_name% iron_ingot 16'] },
        { id: 'r2', name: 'Diamond Sword', item: 'minecraft:diamond_sword', color: '#3b82f6', weight: 15, actions: ['console:give %player_name% diamond_sword 1'] },
      ],
    });
  } else if (t === 'scroll_area') {
    Object.assign(base, {
      w: 360, h: 200, scrollMode: 'pan2d', contentW: 720, contentH: 480,
      stepPx: 28, bgColor: '#0e131f', borderColor: '#3a8ee6', showScrollbar: true, tooltip: '',
    });
  }
  if (menu) {
    base.x = Math.max(0, Math.round((menu.width - base.w) / 2));
    base.y = Math.max(0, Math.round((menu.height - base.h) / 2));
    base.name = `${t} ${menu.elements.length + 1}`;
  }
  return base;
}

export function normalizeProject(raw) {
  const base = newProject();
  const p = raw && typeof raw === 'object' ? raw : {};
  const out = Object.assign(base, p);
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
    mm.motion = Object.assign(newMenu().motion, mm.motion || {});
    mm.elements = (Array.isArray(mm.elements) ? mm.elements : []).filter(e => e && TYPES.includes(e.type)).map(e => {
      const ee = Object.assign(newElement(e.type), e);
      ee.id = ee.id || uid(e.type[0]);
      ee.x = int(ee.x, 0);
      ee.y = int(ee.y, 0);
      ee.w = Math.max(1, int(ee.w, 16));
      ee.h = Math.max(1, int(ee.h, 16));
      if (ee.type === 'button' && !Array.isArray(ee.actions)) ee.actions = [];
      ee.scrollGroup = ee.type === 'scroll_area' ? '' : String(ee.scrollGroup || '');
      if (['button', 'item', 'player_head', 'player_model', 'custom_model', 'input', 'roulette', 'scroll_area'].includes(ee.type)) ee.tooltip = String(ee.tooltip || '');
      if (ee.type === 'player_model') {
        ee.bedrockRenderer = ['auto', 'live', 'doll'].includes(ee.bedrockRenderer) ? ee.bedrockRenderer : 'auto';
      }
      if (ee.type === 'custom_model') {
        ee.modelId = String(ee.modelId || '');
        ee.animation = String(ee.animation || 'idle');
        ee.scale3d = clamp(num(ee.scale3d, 1), 0.1, 10);
        ee.angle = num(ee.angle, 20);
        ee.spin = !!ee.spin;
        ee.spinSpeed = clamp(num(ee.spinSpeed, 45), 1, 720);
        ee.hitboxW = clamp(num(ee.hitboxW, 1), 0.2, 8);
        ee.hitboxH = clamp(num(ee.hitboxH, 2), 0.2, 8);
        ee.bedrockTexture = String(ee.bedrockTexture || '');
      }
      if (ee.type === 'input') {
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
      }
      if (ee.type === 'roulette') {
        ee.slotSize = clamp(int(ee.slotSize, 44), 16, 128);
        ee.slotGap = clamp(int(ee.slotGap, 6), 0, 32);
        ee.durationSec = clamp(num(ee.durationSec, 4.2), 1.0, 15.0);
        ee.spinStyle = ['csgo', 'tease', 'slot_v', 'flash', 'flip'].includes(ee.spinStyle) ? ee.spinStyle : 'csgo';
        ee.reels = clamp(int(ee.reels, 3), 1, 5);
        ee.cardCount = clamp(int(ee.cardCount, 5), 3, 9);
        ee.bgColor = String(ee.bgColor || '#0d111a');
        ee.borderColor = String(ee.borderColor || '#e5a43a');
        ee.pointerColor = String(ee.pointerColor || '#ff4d4f');
        ee.tickSound = String(ee.tickSound == null ? '' : ee.tickSound);
        ee.winSound = String(ee.winSound == null ? '' : ee.winSound);
        ee.rewards = (Array.isArray(ee.rewards) ? ee.rewards : []).map((r, ri) => ({
          id: String((r && r.id) || ('r' + (ri + 1))),
          name: String((r && r.name) || 'Prize'),
          item: String((r && r.item) || 'minecraft:diamond'),
          color: String((r && r.color) || '#3b82f6'),
          weight: Math.max(0.01, num(r && r.weight, 10)),
          actions: Array.isArray(r && r.actions) ? r.actions.filter(Boolean) : [],
        }));
      }
      if (ee.type === 'scroll_area') {
        ee.scrollMode = ['vertical', 'horizontal', 'pan2d', 'both'].includes(ee.scrollMode) ? ee.scrollMode : 'pan2d';
        ee.contentW = Math.max(ee.w, int(ee.contentW, ee.w));
        ee.contentH = Math.max(ee.h, int(ee.contentH, ee.h));
        ee.stepPx = clamp(int(ee.stepPx, 28), 4, 200);
        ee.bgColor = String(ee.bgColor || '#0e131f');
        ee.borderColor = String(ee.borderColor || '#3a8ee6');
        ee.showScrollbar = ee.showScrollbar !== false;
      }
      if (ee.type === 'image' || ee.type === 'button') {
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

export function addImage(project, info) {
  for (const [id, im] of Object.entries(project.images)) {
    if (im.data === info.data) return id;
  }
  const base = slug(String(info.name || 'image').replace(/\.[a-z0-9]+$/i, ''), 'image');
  let id = base;
  let n = 2;
  while (project.images[id]) id = `${base}_${n++}`;
  project.images[id] = {
    name: info.name || `${id}.png`,
    data: info.data,
    w: info.w,
    h: info.h,
    res: Math.max(1, info.res || 1),
  };
  return id;
}

export function pruneImages(project) {
  const used = new Set();
  if (project.cursor && project.cursor.image) used.add(project.cursor.image);
  project.menus.forEach(m => m.elements.forEach(e => {
    if (e.image) used.add(e.image);
    if (e.hoverImage) used.add(e.hoverImage);
    (e.frames || []).forEach(f => used.add(f));
  }));
  Object.keys(project.images).forEach(id => {
    if (!used.has(id)) delete project.images[id];
  });
}

export function validateProject(p) {
  const out = [];
  if (!ID_RE.test(p.namespace)) out.push({ level: 'error', msg: 'Namespace must use a-z, 0-9 and _ only' });
  const ids = new Set();
  p.menus.forEach(m => {
    if (!ID_RE.test(m.id)) out.push({ level: 'error', menu: m.id, msg: `Invalid menu id "${m.id}"` });
    if (ids.has(m.id)) out.push({ level: 'error', menu: m.id, msg: `Duplicate menu id "${m.id}"` });
    ids.add(m.id);
    if (m.command && !/^[a-z0-9_\-]{1,32}$/i.test(m.command)) out.push({ level: 'error', menu: m.id, msg: `Invalid command "${m.command}"` });
    if (m.prevPage && !p.menus.some(mm => mm.id === m.prevPage)) out.push({ level: 'warn', menu: m.id, msg: `prevPage "${m.prevPage}" does not exist` });
    if (m.nextPage && !p.menus.some(mm => mm.id === m.nextPage)) out.push({ level: 'warn', menu: m.id, msg: `nextPage "${m.nextPage}" does not exist` });
    if (!m.elements.length) out.push({ level: 'warn', menu: m.id, msg: `Menu "${m.id}" is empty` });
    m.elements.forEach(e => {
      if (e.type === 'image' && !p.images[e.image]) out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${m.id} > ${e.name || e.id}: missing image` });
      if (e.type === 'button' || e.type === 'input') {
        (e.actions || []).forEach(a => {
          const m2 = /^open:([^?]+)/i.exec(String(a).trim());
          if (m2 && !/\{[^}]+\}/.test(m2[1]) && !p.menus.some(mm => mm.id === m2[1].trim())) {
            out.push({ level: 'warn', menu: m.id, element: e.id, msg: `${m.id} > ${e.name || e.id}: opens missing menu "${m2[1].trim()}"` });
          }
        });
      }
    });
  });
  return out;
}

export function buildUiFlow(p) {
  const ids = new Set(p.menus.map(m => m.id));
  const incoming = new Map(p.menus.map(m => [m.id, 0]));
  const edges = [];
  for (const m of p.menus) {
    if (m.nextPage) {
      edges.push({ from: m.id, to: m.nextPage, kind: 'nextPage', broken: !ids.has(m.nextPage) });
      if (ids.has(m.nextPage)) incoming.set(m.nextPage, (incoming.get(m.nextPage) || 0) + 1);
    }
    if (m.prevPage) {
      edges.push({ from: m.id, to: m.prevPage, kind: 'prevPage', broken: !ids.has(m.prevPage) });
      if (ids.has(m.prevPage)) incoming.set(m.prevPage, (incoming.get(m.prevPage) || 0) + 1);
    }
    for (const e of m.elements) {
      if ((e.type !== 'button' && e.type !== 'input') || e.hidden) continue;
      for (const a of (e.actions || [])) {
        const match = /^open:([^?]+)/i.exec(String(a).trim());
        if (match) {
          const target = match[1].trim();
          edges.push({ from: m.id, to: target, kind: 'open', buttonId: e.id, buttonLabel: e.label || e.name, broken: !ids.has(target) });
          if (ids.has(target)) incoming.set(target, (incoming.get(target) || 0) + 1);
        }
      }
    }
  }
  const nodes = p.menus.map((m, idx) => ({
    id: m.id,
    title: m.title,
    command: m.command || null,
    size: `${m.width}x${m.height}`,
    elementCount: m.elements.length,
    incomingCount: incoming.get(m.id) || 0,
    orphan: idx > 0 && !m.command && (incoming.get(m.id) || 0) === 0,
  }));
  return {
    nodes,
    edges,
    brokenLinks: edges.filter(x => x.broken),
    orphanPages: nodes.filter(x => x.orphan).map(x => x.id),
  };
}

const q = (s) => JSON.stringify(String(s == null ? '' : s));

export function exportPluginYaml(p) {
  const s = p.settings || {};
  const studioYaml = [
    '# Generated by kaizer-gui-mcp (note: export inside GUI Studio Desktop to build the Java/Bedrock resource packs)',
    `namespace: ${q(p.namespace)}`,
    `font: ${q(p.namespace + ':gui')}`,
    `skin-font: ${q(p.namespace + ':kz_skin')}`,
    `pack-version: ${int(p.packVersion, 0)}`,
    'cursor:',
    '  glyph: "\\uE000"',
    '  glyph-ascent: 7',
    '  width: 8',
    '  height: 12',
    '  hot-x: 0',
    '  hot-y: 0',
    'java:',
    `  camera-lock: ${s.cameraLock !== false}`,
    `  distance: ${num(s.distance, 1.2)}`,
    `  fill: ${num(s.fill, 0.85)}`,
    `  sensitivity: ${num(s.sensitivity, 1.0)}`,
    `  exit-on-sneak: ${s.exitOnSneak !== false}`,
    'sounds:',
    `  click: ${q(s.clickSound || '')}`,
    `  hover: ${q(s.hoverSound || '')}`,
    '',
  ].join('\n');

  let cp = 0xE001;
  const menus = {};
  for (const m of p.menus) {
    const L = [];
    L.push(`# Menu "${m.id}"`);
    L.push(`id: ${q(m.id)}`);
    L.push(`title: ${q(m.title)}`);
    L.push(`command: ${q(m.command || '')}`);
    L.push(`width: ${m.width}`);
    L.push(`height: ${m.height}`);
    L.push(`refresh-ticks: ${Math.max(0, int(m.refreshTicks, 20))}`);
    L.push(`open-sound: ${q(m.openSound || '')}`);
    L.push(`bedrock-title: ${q(`kz:${p.namespace}:${m.id}|${m.title || ''}`)}`);
    L.push(`fullscreen: ${!!m.fullscreen}`);
    L.push(`backdrop: ${q(m.backdrop || '#000000')}`);
    L.push(`backdrop-alpha: ${clamp(num(m.backdropAlpha, 0.6), 0, 1)}`);
    if (m.prevPage) L.push(`prev-page: ${q(m.prevPage)}`);
    if (m.nextPage) L.push(`next-page: ${q(m.nextPage)}`);
    L.push('elements:');
    const visible = m.elements.filter(e => !e.hidden);
    if (!visible.length) L[L.length - 1] = 'elements: []';
    let slot = 0;
    visible.forEach(e => {
      L.push(`  - id: ${q(e.id)}`);
      L.push(`    type: ${e.type}`);
      L.push(`    name: ${q(e.name || '')}`);
      L.push(`    x: ${int(e.x, 0)}`);
      L.push(`    y: ${int(e.y, 0)}`);
      L.push(`    w: ${int(e.w, 1)}`);
      L.push(`    h: ${int(e.h, 1)}`);
      if (e.scrollGroup) L.push(`    scroll-group: ${q(e.scrollGroup)}`);
      if ((e.type === 'image' || e.type === 'button') && e.image && p.images[e.image]) {
        L.push(`    glyph: "\\u${(cp++).toString(16).toUpperCase().padStart(4, '0')}"`);
        L.push(`    glyph-ascent: ${Math.min(7, int(e.h, 1))}`);
      }
      if (e.type === 'button') {
        if (e.hoverImage && p.images[e.hoverImage]) {
          L.push(`    hover-glyph: "\\u${(cp++).toString(16).toUpperCase().padStart(4, '0')}"`);
          L.push(`    hover-glyph-ascent: ${Math.min(7, int(e.h, 1))}`);
        }
        L.push(`    label: ${q(e.label || '')}`);
        L.push(`    label-color: ${q(e.labelColor || '#ffffff')}`);
        L.push(`    label-scale: ${num(e.labelScale, 1)}`);
        L.push(`    label-shadow: ${e.labelShadow !== false}`);
        L.push(`    close-on-click: ${!!e.closeOnClick}`);
        L.push(`    hover-sound: ${q(e.hoverSound || '')}`);
        L.push(`    bedrock-slot: ${slot++}`);
        const acts = (e.actions || []).map(a => String(a).trim()).filter(Boolean);
        if (acts.length) { L.push('    actions:'); acts.forEach(a => L.push(`      - ${q(a)}`)); }
        else L.push('    actions: []');
      }
      if (e.type === 'player_head' || e.type === 'player_model') {
        L.push(`    player: ${q(e.player ?? '%player_name%')}`);
        L.push(`    hat: ${e.hat !== false}`);
      }
      if (e.type === 'player_model') {
        L.push(`    java-3d: ${e.java3d !== false}`);
        L.push(`    outfit: ${q(e.outfit || 'own')}`);
        L.push(`    pose: ${q(e.pose || 'standing')}`);
        L.push(`    turn: ${q(e.turn || 'none')}`);
        L.push(`    angle: ${num(e.angle, 0)}`);
        L.push(`    spin-speed: ${num(e.spinSpeed, 45)}`);
      }
      if (e.type === 'item') {
        L.push(`    item: ${q(e.item || '')}`);
        L.push(`    glint: ${!!e.glint}`);
        L.push(`    look: ${q(e.look === '3d' ? '3d' : 'flat')}`);
        L.push(`    spin: ${!!e.spin}`);
        if (/^(slot:)|[{%]/i.test(String(e.item || '').trim())) {
          L.push(`    bedrock-slot: ${slot++}`);
        }
      }
      if (e.type === 'custom_model') {
        L.push(`    model-id: ${q(e.modelId || '')}`);
        L.push(`    animation: ${q(e.animation || 'idle')}`);
        L.push(`    scale-3d: ${num(e.scale3d, 1)}`);
        L.push(`    angle: ${num(e.angle, 20)}`);
        L.push(`    spin: ${!!e.spin}`);
        L.push(`    spin-speed: ${num(e.spinSpeed, 45)}`);
        L.push(`    hitbox-w: ${num(e.hitboxW, 1)}`);
        L.push(`    hitbox-h: ${num(e.hitboxH, 2)}`);
      }
      if (e.type === 'input') {
        L.push(`    var-name: ${q(e.varName || 'qty')}`);
        L.push(`    input-type: ${q(e.inputType || 'number')}`);
        L.push(`    default-value: ${q(e.defaultValue == null ? '1' : e.defaultValue)}`);
        L.push(`    min: ${num(e.min, 1)}`);
        L.push(`    max: ${num(e.max, 64)}`);
        L.push(`    step: ${num(e.step, 1)}`);
        L.push(`    prefix: ${q(e.prefix == null ? '' : e.prefix)}`);
        L.push(`    suffix: ${q(e.suffix == null ? '' : e.suffix)}`);
        L.push(`    prompt-title: ${q(e.promptTitle || 'Enter value')}`);
        L.push(`    placeholder: ${q(e.placeholder || 'Type value...')}`);
        L.push(`    text-color: ${q(e.textColor || '#ffffff')}`);
        L.push(`    bg-color: ${q(e.bgColor || '#161b26')}`);
        L.push(`    border-color: ${q(e.borderColor || '#52a0f0')}`);
        L.push(`    scale: ${num(e.scale, 1)}`);
        L.push(`    shadow: ${e.shadow !== false}`);
        L.push(`    align: ${q(e.align || 'center')}`);
        L.push(`    bedrock-slot: ${slot++}`);
        const acts = (e.actions || []).map(a => String(a).trim()).filter(Boolean);
        if (acts.length) { L.push('    actions:'); acts.forEach(a => L.push(`      - ${q(a)}`)); }
        else L.push('    actions: []');
      }
      if (e.type === 'text') {
        L.push(`    text: ${q(e.text || '')}`);
        L.push(`    color: ${q(e.color || '#ffffff')}`);
        L.push(`    scale: ${num(e.scale, 1)}`);
        L.push(`    shadow: ${!!e.shadow}`);
        L.push(`    align: ${q(e.align || 'center')}`);
        L.push(`    bedrock-slot: ${slot++}`);
      }
      if (e.type === 'roulette') {
        L.push(`    slot-size: ${int(e.slotSize, 44)}`);
        L.push(`    slot-gap: ${int(e.slotGap, 6)}`);
        L.push(`    duration: ${num(e.durationSec, 4.2)}`);
        L.push(`    spin-style: ${q(e.spinStyle || 'csgo')}`);
        L.push(`    reels: ${clamp(int(e.reels, 3), 1, 5)}`);
        L.push(`    card-count: ${clamp(int(e.cardCount, 5), 3, 9)}`);
        L.push(`    bg-color: ${q(e.bgColor || '#0d111a')}`);
        L.push(`    border-color: ${q(e.borderColor || '#e5a43a')}`);
        L.push(`    pointer-color: ${q(e.pointerColor || '#ff4d4f')}`);
        L.push(`    tick-sound: ${q(e.tickSound || '')}`);
        L.push(`    win-sound: ${q(e.winSound || '')}`);
        L.push(`    rewards: ${JSON.stringify(Array.isArray(e.rewards) ? e.rewards : [])}`);
      }
      if (e.type === 'scroll_area') {
        L.push(`    scroll-mode: ${q(e.scrollMode || 'pan2d')}`);
        L.push(`    content-w: ${Math.max(int(e.w, 1), int(e.contentW, e.w))}`);
        L.push(`    content-h: ${Math.max(int(e.h, 1), int(e.contentH, e.h))}`);
        L.push(`    step-px: ${clamp(int(e.stepPx, 28), 4, 200)}`);
        L.push(`    bg-color: ${q(e.bgColor || '#0e131f')}`);
        L.push(`    border-color: ${q(e.borderColor || '#3a8ee6')}`);
        L.push(`    show-scrollbar: ${e.showScrollbar !== false}`);
      }
      if (e.tooltip && String(e.tooltip).trim()) L.push(`    tooltip: ${q(e.tooltip)}`);
    });
    menus[m.id] = L.join('\n') + '\n';
  }
  return { studioYaml, menus };
}
