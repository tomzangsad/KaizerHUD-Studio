import crypto from 'node:crypto';

export const ID_RE = /^[a-z0-9_]{1,32}$/;
export const DEFAULT_W = 640;
export const DEFAULT_H = 360;
export const MAX_SIDE = 960;
export const TYPES = ['image', 'button', 'text', 'player_head', 'player_model', 'item'];

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
    if (!head) Object.assign(base, { java3d: true, outfit: 'own', pose: 'standing', turn: 'none', angle: 20, spinSpeed: 45 });
  } else if (t === 'item') {
    Object.assign(base, { w: 24, h: 24, item: 'minecraft:diamond_sword', glint: false, look: 'flat', spin: false, bedrockTexture: '', tooltip: '' });
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
      if (['button', 'item', 'player_head', 'player_model'].includes(ee.type)) ee.tooltip = String(ee.tooltip || '');
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
      if (e.type === 'button') {
        (e.actions || []).forEach(a => {
          const m2 = /^open:(.+)$/i.exec(String(a).trim());
          if (m2 && !p.menus.some(mm => mm.id === m2[1].trim())) {
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
      if (e.type !== 'button' || e.hidden) continue;
      for (const a of (e.actions || [])) {
        const match = /^open:(.+)$/i.exec(String(a).trim());
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
      }
      if (e.type === 'text') {
        L.push(`    text: ${q(e.text || '')}`);
        L.push(`    color: ${q(e.color || '#ffffff')}`);
        L.push(`    scale: ${num(e.scale, 1)}`);
        L.push(`    shadow: ${!!e.shadow}`);
        L.push(`    align: ${q(e.align || 'center')}`);
        L.push(`    bedrock-slot: ${slot++}`);
      }
      if (e.tooltip && String(e.tooltip).trim()) L.push(`    tooltip: ${q(e.tooltip)}`);
    });
    menus[m.id] = L.join('\n') + '\n';
  }
  return { studioYaml, menus };
}
