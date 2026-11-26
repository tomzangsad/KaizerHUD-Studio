#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { ProjectStorage, resolveProjectsDir } from './storage.mjs';
import { generateArtPng, readPngSize } from './png_gen.mjs';
import {
  TYPES,
  slug,
  newMenu,
  newProject,
  newElement,
  normalizeProject,
  addImage,
  pruneImages,
  validateProject,
  buildUiFlow,
  exportPluginYaml,
} from './studio_bridge.mjs';

const SERVER_INFO = { name: 'kaizer-gui-mcp', version: '1.0.0' };
const SUPPORTED_PROTOCOLS = ['2025-03-26', '2024-11-05'];

const storage = new ProjectStorage(resolveProjectsDir());

const TOOLS = [
  {
    name: 'list_projects',
    description: 'List all GUI Studio projects stored in the local gui_projects directory.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_project',
    description: 'Read a GUI Studio project by ID. Base64 image data is omitted by default unless include_images=true.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID from list_projects' },
        include_images: { type: 'boolean', description: 'Include full base64 data URLs in images map (default false)' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new GUI Studio project compatible with GUI Studio Desktop.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name of the project' },
        namespace: { type: 'string', description: 'Resource pack namespace (a-z, 0-9, _), default kaizerui' },
        pack_host: { type: 'string', enum: ['itemsadder', 'nexo', 'oraxen', 'zip'], description: 'Target pack host' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_project',
    description: 'Delete a GUI Studio project JSON file by ID.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'list_menus',
    description: 'List all menus inside a project with dimensions, commands, pagination links, and element counts.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'get_menu',
    description: 'Get a single menu object and all of its elements.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
      },
      required: ['project_id', 'menu_id'],
    },
  },
  {
    name: 'upsert_menu',
    description: 'Create or update a menu in a project (size, title, command, fullscreen, backdrop, prev_page, next_page).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string', description: 'Slug ID (a-z, 0-9, _)' },
        title: { type: 'string' },
        command: { type: 'string' },
        width: { type: 'number', description: 'Canvas width (16..960)' },
        height: { type: 'number', description: 'Canvas height (16..960)' },
        fullscreen: { type: 'boolean' },
        backdrop: { type: 'string', description: 'Hex color e.g. #000000' },
        backdrop_alpha: { type: 'number', description: '0..1' },
        refresh_ticks: { type: 'number' },
        open_sound: { type: 'string' },
        prev_page: { type: 'string', description: 'Menu ID for Previous Page button' },
        next_page: { type: 'string', description: 'Menu ID for Next Page button' },
      },
      required: ['project_id', 'menu_id'],
    },
  },
  {
    name: 'delete_menu',
    description: 'Delete a menu from a project (fails if it is the last remaining menu) and prune unused images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
      },
      required: ['project_id', 'menu_id'],
    },
  },
  {
    name: 'add_element',
    description: `Add an element (${TYPES.join(', ')}) to a menu.`,
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        type: { type: 'string', enum: TYPES },
        id: { type: 'string' },
        name: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
        props: {
          type: 'object',
          description: 'Type-specific fields (e.g. label, actions, image, hoverImage, tooltip, text, color, align, item, outfit, pose, java3d)',
        },
      },
      required: ['project_id', 'menu_id', 'type'],
    },
  },
  {
    name: 'update_element',
    description: 'Patch fields on an existing element inside a menu.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        element_id: { type: 'string' },
        patch: { type: 'object', description: 'Fields to merge onto the element' },
      },
      required: ['project_id', 'menu_id', 'element_id', 'patch'],
    },
  },
  {
    name: 'delete_element',
    description: 'Remove an element from a menu and prune unused images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        element_id: { type: 'string' },
      },
      required: ['project_id', 'menu_id', 'element_id'],
    },
  },
  {
    name: 'link_menus',
    description: 'Connect two menus via nextPage/prevPage or via a button action open:<target_menu>.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        from_menu: { type: 'string' },
        to_menu: { type: 'string' },
        mode: { type: 'string', enum: ['button', 'next_page', 'prev_page'] },
        button_id: { type: 'string', description: 'Existing button ID (for mode=button)' },
        create_button: { type: 'boolean', description: 'Create a new button if button_id is omitted' },
        button_label: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
      },
      required: ['project_id', 'from_menu', 'to_menu', 'mode'],
    },
  },
  {
    name: 'get_ui_flow',
    description: 'Inspect navigation graph (nodes, edges, brokenLinks, orphanPages) across all menus in a project.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'generate_panel_image',
    description: 'Generate a clean PNG (panel, button, slot, or stage in rpg/flat/pixel style) in pure Node and register it in project.images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        name: { type: 'string' },
        kind: { type: 'string', enum: ['panel', 'button', 'slot', 'stage'] },
        style: { type: 'string', enum: ['rpg', 'flat', 'pixel'] },
        w: { type: 'number' },
        h: { type: 'number' },
        detail: { type: 'number', enum: [1, 2, 4] },
        primary_color: { type: 'string' },
        accent_color: { type: 'string' },
        bg_top: { type: 'string' },
        bg_bot: { type: 'string' },
        hover: { type: 'boolean' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'add_image_from_file',
    description: 'Import an existing local PNG file into project.images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        file_path: { type: 'string' },
        name: { type: 'string' },
        detail: { type: 'number', enum: [1, 2, 4, 8] },
      },
      required: ['project_id', 'file_path'],
    },
  },
  {
    name: 'validate_project',
    description: 'Validate project schema, broken links, missing images, and navigation orphans.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'export_plugin_yaml',
    description: 'Generate KaizerUI plugin YAML files (studio.yml and menus/*.yml). Optionally write them to out_dir.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        out_dir: { type: 'string', description: 'Optional directory path to write studio.yml and menus/<id>.yml' },
      },
      required: ['project_id'],
    },
  },
];

const SCHEMA_DOC = `# KaizerUI GUI Studio Schema & Actions

## Elements (${TYPES.join(', ')})
- \`image\`: \`{ id, type:'image', x, y, w, h, detail, image, frames, fps }\`
- \`button\`: \`{ id, type:'button', x, y, w, h, detail, image, hoverImage, label, labelColor, labelScale, labelShadow, actions, closeOnClick, hoverSound, tooltip }\`
- \`text\`: \`{ id, type:'text', x, y, w, h, text, color, scale, shadow, align }\`
- \`player_head\`: \`{ id, type:'player_head', x, y, w, h, player, hat, tooltip }\`
- \`player_model\`: \`{ id, type:'player_model', x, y, w, h, player, hat, java3d, outfit, pose, turn, angle, spinSpeed, tooltip }\`
- \`item\`: \`{ id, type:'item', x, y, w, h, item, glint, look, spin, tooltip }\`

## Button Actions
- \`cmd:<command>\` / \`console:<command>\` / \`msg:<text>\` / \`sound:<key>\`
- \`open:<menu_id>\` / \`back\` / \`prev_page\` / \`next_page\` / \`close\`
- \`server:<bungee_server>\` / \`event:<custom_key>\` (triggers KaizerUI Java \`MenuClickEvent\`)

## Storage Location
Default projects directory: \`${resolveProjectsDir()}\` (override with \`KAIZER_GUI_PROJECTS_DIR\`).
`;

function loadNormalized(projectId) {
  const rec = storage.getProject(projectId);
  const data = normalizeProject(rec.data);
  return { rec, data };
}

function findMenu(data, menuId) {
  const m = data.menus.find(x => x.id === menuId);
  if (!m) throw new Error(`Menu not found: ${menuId}`);
  return m;
}

function stripImagePayloads(data) {
  const images = {};
  for (const [id, im] of Object.entries(data.images || {})) {
    images[id] = { name: im.name, w: im.w, h: im.h, res: im.res, hasData: !!im.data };
  }
  return { ...data, images };
}

function handleToolCall(name, args = {}) {
  switch (name) {
    case 'list_projects': {
      const items = storage.listProjects().map(item => {
        try {
          const rec = storage.getProject(item._id);
          const d = normalizeProject(rec.data);
          return { ...item, namespace: d.namespace, menuCount: d.menus.length, imageCount: Object.keys(d.images).length };
        } catch {
          return item;
        }
      });
      return { projectsDir: storage.dir, projects: items };
    }

    case 'get_project': {
      const { rec, data } = loadNormalized(args.project_id);
      return {
        _id: rec._id,
        name: rec.name,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        data: args.include_images ? data : stripImagePayloads(data),
      };
    }

    case 'create_project': {
      const data = newProject(args.namespace || args.name, args.pack_host || 'itemsadder');
      const rec = storage.createProject(args.name, data);
      return { _id: rec._id, name: rec.name, namespace: data.namespace, menus: data.menus.map(m => m.id) };
    }

    case 'delete_project':
      return storage.deleteProject(args.project_id);

    case 'list_menus': {
      const { data } = loadNormalized(args.project_id);
      return {
        namespace: data.namespace,
        menus: data.menus.map(m => ({
          id: m.id,
          title: m.title,
          command: m.command,
          width: m.width,
          height: m.height,
          prevPage: m.prevPage,
          nextPage: m.nextPage,
          elementCount: m.elements.length,
        })),
      };
    }

    case 'get_menu': {
      const { data } = loadNormalized(args.project_id);
      return findMenu(data, args.menu_id);
    }

    case 'upsert_menu': {
      const { rec, data } = loadNormalized(args.project_id);
      const id = slug(args.menu_id, '');
      if (!id) throw new Error('Invalid menu_id');
      let m = data.menus.find(x => x.id === id);
      const created = !m;
      if (!m) {
        m = newMenu(id, args.title || id);
        data.menus.push(m);
      }
      if (args.title !== undefined) m.title = String(args.title);
      if (args.command !== undefined) m.command = String(args.command);
      if (args.width !== undefined) m.width = Number(args.width);
      if (args.height !== undefined) m.height = Number(args.height);
      if (args.fullscreen !== undefined) m.fullscreen = !!args.fullscreen;
      if (args.backdrop !== undefined) m.backdrop = String(args.backdrop);
      if (args.backdrop_alpha !== undefined) m.backdropAlpha = Number(args.backdrop_alpha);
      if (args.refresh_ticks !== undefined) m.refreshTicks = Number(args.refresh_ticks);
      if (args.open_sound !== undefined) m.openSound = String(args.open_sound);
      if (args.prev_page !== undefined) m.prevPage = String(args.prev_page);
      if (args.next_page !== undefined) m.nextPage = String(args.next_page);
      const norm = normalizeProject(data);
      storage.updateProject(rec._id, rec.name, norm);
      return { created, menu: findMenu(norm, id) };
    }

    case 'delete_menu': {
      const { rec, data } = loadNormalized(args.project_id);
      if (data.menus.length <= 1) throw new Error('Cannot delete the only remaining menu in a project');
      const idx = data.menus.findIndex(x => x.id === args.menu_id);
      if (idx === -1) throw new Error(`Menu not found: ${args.menu_id}`);
      data.menus.splice(idx, 1);
      pruneImages(data);
      storage.updateProject(rec._id, rec.name, data);
      return { deleted: args.menu_id, remainingMenus: data.menus.map(m => m.id) };
    }

    case 'add_element': {
      const { rec, data } = loadNormalized(args.project_id);
      if (!TYPES.includes(args.type)) throw new Error(`Invalid element type: ${args.type}`);
      const m = findMenu(data, args.menu_id);
      const el = newElement(args.type, m);
      if (args.props && typeof args.props === 'object') Object.assign(el, args.props);
      if (args.id !== undefined) el.id = String(args.id);
      if (args.name !== undefined) el.name = String(args.name);
      if (args.x !== undefined) el.x = Number(args.x);
      if (args.y !== undefined) el.y = Number(args.y);
      if (args.w !== undefined) el.w = Number(args.w);
      if (args.h !== undefined) el.h = Number(args.h);
      m.elements.push(el);
      const norm = normalizeProject(data);
      storage.updateProject(rec._id, rec.name, norm);
      const savedMenu = findMenu(norm, m.id);
      return savedMenu.elements[savedMenu.elements.length - 1];
    }

    case 'update_element': {
      const { rec, data } = loadNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      const el = m.elements.find(x => x.id === args.element_id);
      if (!el) throw new Error(`Element not found: ${args.element_id}`);
      if (args.patch && typeof args.patch === 'object') {
        const { id: _ignoreId, type: _ignoreType, ...rest } = args.patch;
        Object.assign(el, rest);
      }
      const norm = normalizeProject(data);
      storage.updateProject(rec._id, rec.name, norm);
      return findMenu(norm, m.id).elements.find(x => x.id === el.id);
    }

    case 'delete_element': {
      const { rec, data } = loadNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      const idx = m.elements.findIndex(x => x.id === args.element_id);
      if (idx === -1) throw new Error(`Element not found: ${args.element_id}`);
      m.elements.splice(idx, 1);
      pruneImages(data);
      storage.updateProject(rec._id, rec.name, data);
      return { deleted: args.element_id, menu_id: m.id };
    }

    case 'link_menus': {
      const { rec, data } = loadNormalized(args.project_id);
      const from = findMenu(data, args.from_menu);
      findMenu(data, args.to_menu);
      if (args.mode === 'next_page') {
        from.nextPage = args.to_menu;
      } else if (args.mode === 'prev_page') {
        from.prevPage = args.to_menu;
      } else if (args.mode === 'button') {
        let btn = args.button_id ? from.elements.find(e => e.id === args.button_id && e.type === 'button') : null;
        if (!btn && args.create_button === false) {
          throw new Error(`Button not found: ${args.button_id}`);
        }
        if (!btn) {
          btn = newElement('button', from);
          btn.label = args.button_label || args.to_menu;
          if (args.x !== undefined) btn.x = Number(args.x);
          if (args.y !== undefined) btn.y = Number(args.y);
          if (args.w !== undefined) btn.w = Number(args.w);
          if (args.h !== undefined) btn.h = Number(args.h);
          from.elements.push(btn);
        }
        const act = `open:${args.to_menu}`;
        if (!Array.isArray(btn.actions)) btn.actions = [];
        if (!btn.actions.includes(act)) btn.actions.push(act);
      } else {
        throw new Error(`Invalid link mode: ${args.mode}`);
      }
      const norm = normalizeProject(data);
      storage.updateProject(rec._id, rec.name, norm);
      return buildUiFlow(norm);
    }

    case 'get_ui_flow': {
      const { data } = loadNormalized(args.project_id);
      return buildUiFlow(data);
    }

    case 'generate_panel_image': {
      const { rec, data } = loadNormalized(args.project_id);
      const art = generateArtPng(args);
      const imgName = `${slug(args.name || `${args.kind || 'panel'}_${args.style || 'rpg'}`, 'art')}.png`;
      const imageId = addImage(data, {
        name: imgName,
        data: art.dataUrl,
        w: art.w,
        h: art.h,
        res: art.detail,
      });
      storage.updateProject(rec._id, rec.name, data);
      return { image_id: imageId, w: art.w, h: art.h, texW: art.texW, texH: art.texH, detail: art.detail };
    }

    case 'add_image_from_file': {
      const { rec, data } = loadNormalized(args.project_id);
      const absPath = path.resolve(String(args.file_path));
      const buf = fs.readFileSync(absPath);
      const size = readPngSize(buf);
      const detail = [1, 2, 4, 8].includes(Number(args.detail)) ? Number(args.detail) : 1;
      const baseName = args.name || path.basename(absPath);
      const imageId = addImage(data, {
        name: baseName,
        data: 'data:image/png;base64,' + buf.toString('base64'),
        w: Math.max(1, Math.round(size.w / detail)),
        h: Math.max(1, Math.round(size.h / detail)),
        res: detail,
      });
      storage.updateProject(rec._id, rec.name, data);
      return { image_id: imageId, w: Math.max(1, Math.round(size.w / detail)), h: Math.max(1, Math.round(size.h / detail)), texW: size.w, texH: size.h, detail };
    }

    case 'validate_project': {
      const { data } = loadNormalized(args.project_id);
      const issues = validateProject(data);
      const errors = issues.filter(i => i.level === 'error');
      const warnings = issues.filter(i => i.level !== 'error');
      const flow = buildUiFlow(data);
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        issues,
        flowSummary: {
          menuCount: flow.nodes.length,
          edgeCount: flow.edges.length,
          brokenLinks: flow.brokenLinks,
          orphanPages: flow.orphanPages,
        },
      };
    }

    case 'export_plugin_yaml': {
      const { data } = loadNormalized(args.project_id);
      const exported = exportPluginYaml(data);
      const writtenFiles = [];
      if (args.out_dir) {
        const outDir = path.resolve(String(args.out_dir));
        const menusDir = path.join(outDir, 'menus');
        fs.mkdirSync(menusDir, { recursive: true });
        const studioPath = path.join(outDir, 'studio.yml');
        fs.writeFileSync(studioPath, exported.studioYaml, 'utf8');
        writtenFiles.push(studioPath);
        for (const [id, yml] of Object.entries(exported.menus)) {
          const mp = path.join(menusDir, `${id}.yml`);
          fs.writeFileSync(mp, yml, 'utf8');
          writtenFiles.push(mp);
        }
      }
      return { ...exported, writtenFiles };
    }

    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

function writeMsg(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  writeMsg({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  writeMsg({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return;
  }

  if (!hasId) return; // ignore other notifications per JSON-RPC 2.0

  try {
    if (method === 'initialize') {
      const reqVer = params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOLS.includes(reqVer) ? reqVer : '2024-11-05';
      return sendResult(id, {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: SERVER_INFO,
      });
    }

    if (method === 'ping') {
      return sendResult(id, {});
    }

    if (method === 'tools/list') {
      return sendResult(id, { tools: TOOLS });
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = handleToolCall(toolName, toolArgs);
        return sendResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        });
      } catch (err) {
        if (err.code === -32601) return sendError(id, -32601, err.message);
        return sendResult(id, {
          content: [{ type: 'text', text: String(err?.message || err) }],
          isError: true,
        });
      }
    }

    if (method === 'resources/list') {
      return sendResult(id, {
        resources: [
          {
            uri: 'kaizer://docs/schema',
            name: 'KaizerUI GUI Studio Schema',
            description: 'Element schemas, button actions (including event:<key>), and storage layout',
            mimeType: 'text/markdown',
          },
          {
            uri: 'kaizer://projects',
            name: 'Local GUI Projects',
            description: 'JSON list of local GUI Studio projects in gui_projects/',
            mimeType: 'application/json',
          },
        ],
      });
    }

    if (method === 'resources/read') {
      const uri = params?.uri;
      if (uri === 'kaizer://docs/schema') {
        return sendResult(id, {
          contents: [{ uri, mimeType: 'text/markdown', text: SCHEMA_DOC }],
        });
      }
      if (uri === 'kaizer://projects') {
        return sendResult(id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(storage.listProjects(), null, 2) }],
        });
      }
      return sendError(id, -32602, `Unknown resource URI: ${uri}`);
    }

    return sendError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    return sendError(id, -32603, String(err?.message || err));
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handleMessage(JSON.parse(trimmed));
  } catch (err) {
    console.error('[kaizer-gui-mcp] invalid JSON line:', err.message);
  }
});
