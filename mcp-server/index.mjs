#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { ProjectStorage, resolveProjectsDir, resolveCustomAssetsDir } from './storage.mjs';
import { generateArtPng, readPngSize } from './png_gen.mjs';
import {
  drawPixelArt,
  composeLayers,
  generateBarSet,
  generateAnimation,
  generateWidgetsHotbar,
  importImageFile,
} from './art_engine.mjs';
import { getLiveStatus, callLive } from './live_client.mjs';
import {
  HUD_TYPES,
  HUD_ANCHORS,
  resolveHudProjectsDir,
  newHudProjectData,
  newHudElement,
  inspectHudBudget,
  validateHudProject,
  applyLayoutOp,
  slugNs,
} from './hud_bridge.mjs';
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

const SERVER_INFO = { name: 'kaizer-studio-mcp', version: '2.0.0' };
const SUPPORTED_PROTOCOLS = ['2025-03-26', '2024-11-05'];

const guiStorage = new ProjectStorage(resolveProjectsDir());
const hudStorage = new ProjectStorage(resolveHudProjectsDir());

const LAYOUT_OPS = [
  'align_left', 'align_center', 'align_right',
  'align_top', 'align_middle', 'align_bottom',
  'distribute_h', 'distribute_v',
  'stack_horizontal', 'stack_vertical',
  'mirror_h', 'mirror_v', 'snap_grid',
];

const TOOLS = [
  // ── 1. Studio Live & Vision (HUD + GUI) ──
  {
    name: 'studio_status',
    description: 'Check whether KaizerHUD Studio desktop app is open (Live Bridge), which workspace (hud or gui) is active, active project ID, active group/menu, and selected elements.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_switch_workspace',
    description: 'Switch the open KaizerHUD Studio window live between "hud" (Bedrock/Java HUD editor) and "gui" (GUI Studio cursor menus).',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string', enum: ['hud', 'gui'] },
        force: { type: 'boolean', description: 'Switch even if current document has unsaved changes (default true)' },
      },
      required: ['workspace'],
    },
  },
  {
    name: 'studio_capture_preview',
    description: 'Capture a real-time PNG screenshot of the currently open HUD or GUI canvas so AI can visually inspect alignment, contrast, and spacing.',
    inputSchema: {
      type: 'object',
      properties: {
        scale: { type: 'number', description: 'Render scale multiplier (1..3, default 2)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'studio_layout_helper',
    description: `Align, distribute, stack, mirror, or snap multiple elements on either HUD or GUI (${LAYOUT_OPS.join(', ')}). Works live when the app is open, or on saved project_id.`,
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string', enum: ['hud', 'gui'] },
        op: { type: 'string', enum: LAYOUT_OPS },
        element_ids: { type: 'array', items: { type: ['string', 'number'] }, description: 'Element IDs to arrange (omitted = current live selection or all in active page/group)' },
        project_id: { type: 'string' },
        menu_id: { type: 'string', description: 'Required for offline GUI layout' },
        gap: { type: 'number', description: 'Pixel gap for distribute / stack ops' },
        grid: { type: 'number', description: 'Snap grid step in pixels (default 4)' },
      },
      required: ['op'],
    },
  },
  {
    name: 'studio_undo',
    description: 'Trigger Undo (Ctrl+Z) in the active live workspace (HUD or GUI).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_redo',
    description: 'Trigger Redo (Ctrl+Y) in the active live workspace (HUD or GUI).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'studio_save',
    description: 'Save the currently active HUD or GUI project in the running desktop window.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name (needed only if project has never been saved yet)' },
      },
    },
  },

  // ── 2. Creative Art Engine (design from scratch in any style) ──
  {
    name: 'art_render_svg',
    description: 'Render arbitrary AI-authored SVG markup (paths, gradients, glows, filters, HUD ornaments, icons) into a crisp RGBA PNG via Live WebView Canvas. Optionally attach directly to a HUD element, HUD widgets, or GUI image.',
    inputSchema: {
      type: 'object',
      properties: {
        svg: { type: 'string', description: 'Complete <svg xmlns="http://www.w3.org/2000/svg" ...>...</svg> markup' },
        width: { type: 'number', description: 'Logical width in pixels' },
        height: { type: 'number', description: 'Logical height in pixels' },
        scale: { type: 'number', description: 'Detail scale 1, 2, or 4 (default 2 for GUI, 1 for HUD)' },
        crisp: { type: 'boolean', description: 'Disable smoothing for pixel-crisp SVG' },
        attach_to: {
          type: 'object',
          description: 'Optional target: { target: "hud_new"|"hud_element"|"hud_widgets"|"gui_image"|"gui_new_image"|"gui_button", element_id?, menu_id?, project_id?, name?, offset?, anchor_from?, group?, hover? }',
        },
      },
      required: ['svg', 'width', 'height'],
    },
  },
  {
    name: 'art_draw_pixel_art',
    description: 'Draw crisp pixel-art RGBA PNG from a color palette and ASCII character grid (with mirror_x/y, auto_outline, and integer scale). Works both live and offline; can attach directly to HUD or GUI.',
    inputSchema: {
      type: 'object',
      properties: {
        palette: { type: 'object', description: 'Char -> hex color (#RRGGBB or #RRGGBBAA) or null for transparent' },
        grid: { type: 'array', items: { type: 'string' }, description: 'Array of equal-width strings representing pixel rows' },
        scale: { type: 'number', description: 'Integer pixel scale 1..16 (default 1)' },
        mirror_x: { type: 'boolean' },
        mirror_y: { type: 'boolean' },
        outline_color: { type: 'string', description: 'Optional 1px auto-outline hex color' },
        attach_to: { type: 'object', description: 'Optional target to insert/attach onto HUD or GUI immediately' },
      },
      required: ['palette', 'grid'],
    },
  },
  {
    name: 'art_compose_layers',
    description: 'Compose custom procedural RGBA artwork from layered primitives (rect, rounded_rect, chamfer_rect, linear_gradient, radial_glow, circle, ring, line, polygon, border[solid|double|bevel|ornate_corners|cyber_brackets], scanlines, texture_noise[stone|wood|parchment|metal], gems, rivets, drop_shadow, pixel_art). Works live and offline.',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        background: { type: 'string' },
        layers: { type: 'array', items: { type: 'object' } },
        attach_to: { type: 'object', description: 'Optional target to insert/attach onto HUD or GUI immediately' },
      },
      required: ['width', 'height', 'layers'],
    },
  },
  {
    name: 'art_generate_bar_set',
    description: 'Generate a custom 17-frame (0..16) HUD status bar set (horizontal/vertical, chamfer/rounded/square, slanted, segmented, glow highlight + optional poison/wither/absorption/freeze/hunger variants). Can create or update a HUD bar element directly.',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Bar width in px (default 96)' },
        height: { type: 'number', description: 'Bar height in px (default 12)' },
        steps: { type: 'number', description: 'Steps (default 16 for Bedrock HUD)' },
        direction: { type: 'string', enum: ['horizontal', 'vertical'] },
        fill_color: { type: 'string' },
        fill_color_end: { type: 'string' },
        empty_color: { type: 'string' },
        border_color: { type: 'string' },
        highlight_color: { type: 'string' },
        corner_style: { type: 'string', enum: ['chamfer', 'rounded', 'square'] },
        segments: { type: 'number', description: 'Optional segment count (e.g. 10 for segmented RPG bar)' },
        slant: { type: 'number', description: 'Horizontal skew -0.6..0.6 for sci-fi/cyberpunk slanted bars' },
        padding: { type: 'number' },
        status_variants: { type: 'array', items: { type: 'string', enum: ['poison', 'wither', 'absorption', 'freeze', 'hunger'] } },
        attach_to: { type: 'object', description: 'Optional { target: "hud_new_bar"|"hud_element", barType?, name?, offset?, anchor_from?, group?, element_id?, project_id? }' },
      },
    },
  },
  {
    name: 'art_generate_animation',
    description: 'Generate multi-frame animated flipbook PNG frames (pulse_glow, shimmer_sweep, spin_gem, flicker_flame, scan_radar, or custom per-frame specs) for animated HUD images or GUI buttons/images.',
    inputSchema: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        frame_count: { type: 'number' },
        fps: { type: 'number' },
        effect: { type: 'string', enum: ['pulse_glow', 'shimmer_sweep', 'spin_gem', 'flicker_flame', 'scan_radar'] },
        base_layers: { type: 'array', items: { type: 'object' } },
        frames: { type: 'array', description: 'Optional explicit per-frame layer arrays or pixel_art objects' },
        accent_color: { type: 'string' },
        attach_to: { type: 'object', description: 'Optional { target: "hud_new_anim"|"hud_element"|"gui_new_image", element_id?, menu_id?, project_id?, name?, offset?, anchor_from?, group? }' },
      },
    },
  },
  {
    name: 'art_generate_widgets',
    description: 'Generate a custom 256x256 Bedrock widgets.png (9-slot hotbar + selected slot highlight) in any custom color/style. Can apply directly to the active or specified HUD project.',
    inputSchema: {
      type: 'object',
      properties: {
        style: { type: 'string', enum: ['rpg', 'cyberpunk', 'pixel', 'minimal'] },
        bg_color: { type: 'string' },
        slot_color: { type: 'string' },
        border_color: { type: 'string' },
        accent_color: { type: 'string' },
        select_color: { type: 'string' },
        corner_style: { type: 'string', enum: ['chamfer', 'square'] },
        apply_to_hud: { type: 'boolean', description: 'If true, set widgetsImageData on the active HUD (or project_id)' },
        project_id: { type: 'string' },
      },
    },
  },
  {
    name: 'art_import_file',
    description: 'Import a local PNG/WebP/JPG image file from disk and attach it to a HUD element, HUD widgets.png, or GUI project image.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        attach_to: { type: 'object' },
      },
      required: ['file_path'],
    },
  },

  // ── 3. HUD Studio Tools (Live when open + Offline fallback) ──
  {
    name: 'hud_list_projects',
    description: 'List all saved HUD Studio projects in the local projects/ folder (plus active project ID if live).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'hud_get_project',
    description: 'Read a HUD Studio project (from live window if matching/active, or from disk by project_id). Binary imageData omitted unless include_images=true.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Optional when live HUD window is open' },
        include_images: { type: 'boolean' },
      },
    },
  },
  {
    name: 'hud_create_project',
    description: 'Create a new empty HUD Studio project (and open it live if KaizerHUD Studio is open).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        namespace: { type: 'string' },
        nameplate_position: { type: 'string', enum: ['top_left', 'top_right', 'top_middle'] },
        nameplate_mobile_offset: { type: 'number' },
        open_live: { type: 'boolean', description: 'Default true when live' },
      },
      required: ['name'],
    },
  },
  {
    name: 'hud_open_project',
    description: 'Load a saved HUD Studio project into the running desktop app window for live editing.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'hud_delete_project',
    description: 'Delete a HUD Studio project JSON file by project_id.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'hud_manage_group',
    description: 'List, add, select, rename, or delete HUD layer groups in the active (or specified) HUD project.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'select', 'rename', 'delete'] },
        group: { type: 'string' },
        new_name: { type: 'string' },
        project_id: { type: 'string' },
      },
      required: ['action'],
    },
  },
  {
    name: 'hud_add_element',
    description: `Add a HUD element (${HUD_TYPES.join(', ')}) with full anchor/offset/size/PAPI/bar/visibility properties. Updates canvas immediately when live.`,
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: HUD_TYPES },
        project_id: { type: 'string', description: 'Optional when HUD Studio is open live' },
        name: { type: 'string' },
        group: { type: 'string' },
        anchor_from: { type: 'string', enum: HUD_ANCHORS },
        anchor_to: { type: 'string', enum: HUD_ANCHORS },
        offset: { type: 'array', items: { type: 'number' }, description: '[x, y] relative to anchor' },
        size: { type: 'array', items: { type: 'number' }, description: '[width, height] in GUI px' },
        layer: { type: 'number' },
        alpha: { type: 'number' },
        props: { type: 'object', description: 'Extra fields (papi_placeholder, pad_auto, pad_length, font_size, color, shadow, text_anchor_from, barType, barCustomPapi, barCustomMax, visibilityEnabled, visibilityPapi, visibilityOperator, visibilityValue, etc.)' },
      },
      required: ['type'],
    },
  },
  {
    name: 'hud_update_element',
    description: 'Update any fields on an existing HUD element by element_id (updates live on screen if open).',
    inputSchema: {
      type: 'object',
      properties: {
        element_id: { type: 'number' },
        patch: { type: 'object' },
        project_id: { type: 'string' },
      },
      required: ['element_id', 'patch'],
    },
  },
  {
    name: 'hud_delete_element',
    description: 'Remove a HUD element by element_id.',
    inputSchema: {
      type: 'object',
      properties: {
        element_id: { type: 'number' },
        project_id: { type: 'string' },
      },
      required: ['element_id'],
    },
  },
  {
    name: 'hud_batch_elements',
    description: 'Add/update multiple HUD elements in one atomic step (great for building complete panels, bars, and text rows cleanly in 1 Undo checkpoint).',
    inputSchema: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of { op: "add"|"update"|"delete", ...fields }',
        },
        project_id: { type: 'string' },
      },
      required: ['operations'],
    },
  },
  {
    name: 'hud_inspect_budget',
    description: 'Inspect HUD Studio Multi-Bank byte usage (25B prefix + bars + text slots across up to 8 Title banks).',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'hud_validate',
    description: 'Validate HUD project namespace, elements, anchors, PAPI slots, and Multi-Bank limits.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'hud_preview_code',
    description: 'Generate actual Bedrock ui/hud_screen.json and KaizerMultiBar config.yml via Rust codegen engine (requires running app bridge).',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'hud_export_pack',
    description: 'Export the HUD project to an output.zip path or sync directly into a Bedrock development_resource_packs folder (requires running app bridge).',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['zip', 'sync_folder'] },
        path: { type: 'string', description: 'Output .zip path or sync folder path' },
        force: { type: 'boolean' },
        project_id: { type: 'string' },
      },
      required: ['mode', 'path'],
    },
  },

  // ── 4. GUI Studio Tools (Original 17 upgraded to Live + 4 new live tools) ──
  {
    name: 'list_projects',
    description: 'List all GUI Studio projects stored in the local gui_projects directory.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_project',
    description: 'Read a GUI Studio project by ID (or active live project if omitted). Base64 image data omitted unless include_images=true.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        include_images: { type: 'boolean' },
      },
    },
  },
  {
    name: 'create_project',
    description: 'Create a new GUI Studio project (and open it live if GUI Studio is active).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        namespace: { type: 'string' },
        pack_host: { type: 'string', enum: ['itemsadder', 'nexo', 'oraxen', 'zip'] },
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
    name: 'gui_open_project',
    description: 'Open an existing GUI Studio project in the running desktop window (switches to GUI workspace if needed).',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
    },
  },
  {
    name: 'gui_open_menu',
    description: 'Switch the live GUI Studio canvas to view a specific menu page.',
    inputSchema: {
      type: 'object',
      properties: { menu_id: { type: 'string' } },
      required: ['menu_id'],
    },
  },
  {
    name: 'list_menus',
    description: 'List all menus inside a GUI project with dimensions, commands, pagination links, and element counts.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
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
      required: ['menu_id'],
    },
  },
  {
    name: 'upsert_menu',
    description: 'Create or update a menu in a GUI project (live in GUI Studio if active, or offline).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        title: { type: 'string' },
        command: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        fullscreen: { type: 'boolean' },
        backdrop: { type: 'string' },
        backdrop_alpha: { type: 'number' },
        refresh_ticks: { type: 'number' },
        open_sound: { type: 'string' },
        prev_page: { type: 'string' },
        next_page: { type: 'string' },
      },
      required: ['menu_id'],
    },
  },
  {
    name: 'delete_menu',
    description: 'Delete a menu from a GUI project and prune unused images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
      },
      required: ['menu_id'],
    },
  },
  {
    name: 'add_element',
    description: `Add an element (${TYPES.join(', ')}) to a GUI menu (updates live canvas immediately when open).`,
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
        props: { type: 'object' },
      },
      required: ['menu_id', 'type'],
    },
  },
  {
    name: 'gui_batch_elements',
    description: 'Add/update/delete multiple elements in one GUI menu atomically (live in 1 Undo checkpoint when GUI Studio is open).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        operations: { type: 'array', items: { type: 'object' } },
      },
      required: ['menu_id', 'operations'],
    },
  },
  {
    name: 'update_element',
    description: 'Patch fields on an existing GUI element.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        element_id: { type: 'string' },
        patch: { type: 'object' },
      },
      required: ['menu_id', 'element_id', 'patch'],
    },
  },
  {
    name: 'delete_element',
    description: 'Remove an element from a GUI menu and prune unused images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        element_id: { type: 'string' },
      },
      required: ['menu_id', 'element_id'],
    },
  },
  {
    name: 'gui_set_animation',
    description: 'Set Opening / Cascade motion on a GUI menu OR entrance / loop / hover / press motion on a GUI element.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        menu_id: { type: 'string' },
        target: { type: 'string', enum: ['menu', 'element'] },
        element_id: { type: 'string' },
        motion: { type: 'object', description: 'For menu: { open, openMs, cascade, cascadeMs, cascadeGap }. For element: { intro, introDelay, introMs, loop, loopAmount, loopMs, hover, press }' },
      },
      required: ['menu_id', 'target', 'motion'],
    },
  },
  {
    name: 'link_menus',
    description: 'Connect two GUI menus via nextPage/prevPage or via a button action open:<target_menu>.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        from_menu: { type: 'string' },
        to_menu: { type: 'string' },
        mode: { type: 'string', enum: ['button', 'next_page', 'prev_page'] },
        button_id: { type: 'string' },
        create_button: { type: 'boolean' },
        button_label: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
      },
      required: ['from_menu', 'to_menu', 'mode'],
    },
  },
  {
    name: 'get_ui_flow',
    description: 'Inspect navigation graph (nodes, edges, brokenLinks, orphanPages) across all menus in a GUI project.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'generate_panel_image',
    description: 'Generate a quick panel/button/slot/stage PNG (rpg/flat/pixel) and register it in GUI project.images. For full bespoke graphics use art_render_svg, art_compose_layers, or art_draw_pixel_art.',
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
    },
  },
  {
    name: 'add_image_from_file',
    description: 'Import an existing local PNG file into GUI project.images.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        file_path: { type: 'string' },
        name: { type: 'string' },
        detail: { type: 'number', enum: [1, 2, 4, 8] },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'validate_project',
    description: 'Validate GUI project schema, broken links, missing images, and navigation orphans.',
    inputSchema: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
    },
  },
  {
    name: 'export_plugin_yaml',
    description: 'Generate KaizerUI plugin YAML files (studio.yml and menus/*.yml). Optionally write them to out_dir.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        out_dir: { type: 'string' },
      },
    },
  },
  {
    name: 'assets_list_custom',
    description: 'List imported plugin custom items and 3D models (ItemsAdder, Nexo, Oraxen, ModelEngine 4, BetterModel) cached in Studio.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['itemsadder', 'nexo', 'oraxen', 'modelengine', 'bettermodel', 'resourcepack'] },
        kind: { type: 'string', enum: ['item', 'custom_model'] },
        query: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
];

const SCHEMA_DOC = `# KaizerHUD Studio Unified MCP v2.0 Schema

## Live vs Offline Mode
- When KaizerHUD Studio is open, Live Bridge runs automatically on 127.0.0.1 (check via \`studio_status\`).
- Every HUD or GUI edit pushes straight to the open canvas in real time with highlight feedback and Undo history (\`studio_undo\`).
- Call \`studio_capture_preview\` after laying out a screen to visually inspect the rendered PNG and fix overlaps or alignment.

## HUD Studio (${HUD_TYPES.join(', ')})
- Bedrock virtual canvas: \`480 x 270\` units.
- Anchors: \`${HUD_ANCHORS.join(', ')}\`.
- \`barType\`: \`hp\`, \`food\`, \`armor\`, \`air\`, \`exp\`, \`custom\` (\`barCustomPapi\`, \`barCustomMax\`, \`barCustomTag\`).
- Custom bar slices: \`slicedImages\` takes 16 frames (\`[1..16]\` from \`art_generate_bar_set\`).
- Text slots use \`papi_placeholder\` + \`pad_auto\` (auto-calculated Multi-Bank Title budget up to 8 banks / ~2,000B via KaizerMultiBar 2.2.0).

## GUI Studio (${TYPES.join(', ')})
- \`button.actions\` / \`input.actions\`:
  - Navigation & Vars: \`open:<menu_id>?k1=v1&k2=v2\`, \`back\`, \`next\`, \`prev\`, \`close\`, \`set:<var>=<val>\`, \`add:<var>=<delta>\`, \`mul:<var>=<factor>\`, \`input:<var>\`, \`spin:<roulette_id>\`, \`scroll:<area_id>:<dx>:<dy>\`.
  - Built-in Vault Economy (Optional): \`buy:<item_id>:<qty>:<total_price>\`, \`sell:<item_id>:<qty>:<total_price>\`, \`sellhand:<unit_price>\`, \`pay:<amount>\`, \`trade:<mode>:<item_id>:<qty>:<total_price>\`.
  - External Plugins / Commands: \`player:<cmd>\`, \`console:<cmd>\`, \`message:<text>\`, \`sound:<key>\`, \`server:<proxy>\`, \`event:<key>\`.
- Dynamic Session Variables & Inline Math: set params via \`open:confirm?item_id=ia:ns:sword&item_name=Fire Sword&unit_price=500\` or let players edit values with an \`input\` element (\`varName: "qty"\`). Use \`{qty}\`, \`{item_id}\`, and arithmetic like \`{qty*unit_price}\` in Text, Button labels, Item IDs, and Console/Player commands!
- \`item.item\`: \`minecraft:diamond_sword\`, \`itemsadder:ns:id\` / \`ia:ns:id\`, \`nexo:id\`, \`oraxen:id\`, \`custom:<mat>:<cmd>\`, \`model:<mat>:<ns>:<key>\`, \`slot:head|chest|legs|feet|hand|offhand\`, or \`{item_id}\`.
- \`custom_model\`: \`{ modelId: "meg:dragon" | "bm:boss", animation: "idle", scale3d: 1, angle: 20, spin: false, spinSpeed: 45, hitboxW: 1, hitboxH: 2 }\`.
- \`input\`: \`{ varName: "qty", inputType: "number"|"slider"|"text", defaultValue: "1", min: 1, max: 64, step: 1, prefix: "Qty: ", suffix: "", promptTitle, placeholder, textColor, bgColor, borderColor, scale, shadow, align, actions }\`.
- \`roulette\`: Crate roulette (\`{ slotSize, slotGap, durationSec, spinStyle: "csgo"|"tease"|"slot_v"|"flash"|"flip", reels, cardCount, tickSound, winSound, pointerColor, bgColor, rewards: [{ id, name, color, item, weight, actions }] }\`; \`reels\`: 1..5 columns for \`slot_v\`; \`cardCount\`: 3..9 cards for \`flash\`/\`flip\`). Trigger via \`spin:<roulette_id>\` on a button.
- \`scroll_area\`: In-page scrollable/pannable viewport (\`{ scrollMode: "vertical"|"horizontal"|"pan2d"|"both", contentW, contentH, stepPx, showScrollbar, bgColor, borderColor }\`). Attach children by setting child element \`scrollGroup\` to the \`scroll_area\` element's \`id\`, or trigger \`scroll:<area_id>:<dx>:<dy>\`.
- \`player_model\`: \`{ java3d, outfit, pose, turn, angle, spinSpeed }\`.

## Storage Locations
- HUD projects: \`${resolveHudProjectsDir()}\` (env \`KAIZER_HUD_PROJECTS_DIR\`)
- GUI projects: \`${resolveProjectsDir()}\` (env \`KAIZER_GUI_PROJECTS_DIR\`)
- Custom plugin assets cache: \`${resolveCustomAssetsDir()}\` (env \`KAIZER_CUSTOM_ASSETS_DIR\`)
`;

const DESIGN_SYSTEM_DOC = `# KaizerHUD Studio Original Design System Guide (For AI)

Do NOT limit designs to old templates — create bespoke artwork with \`art_render_svg\`, \`art_compose_layers\`, \`art_draw_pixel_art\`, \`art_generate_bar_set\`, \`art_generate_animation\`, and \`art_generate_widgets\`.

## HUD Canvas Coordinates & Safe Zones
- Screen resolution: **480 × 270** Bedrock GUI units.
- Keep center **x=140..340, y=220..270** clear for the vanilla hotbar + EXP bar (unless replacing \`widgets.png\` or hiding \`exp\`).
- **top_middle** on Bedrock mobile devices has touch buttons at y=0..24; keep HUD cards away or configure \`nameplate_mobile_offset\`.
- Always layer cleanly: Background panel (\`layer: 100\`) -> Head / Icons (\`layer: 101\`) -> Bars (\`layer: 101\`) -> Text (\`layer: 102+\`).

## Aesthetic Style Recipes (Design From Scratch)
1. **Cyberpunk / Sci-Fi Holo:** \`chamfer_rect\` cuts \`8..12\`, \`cyber_brackets\`, \`scanlines\` (alpha \`0.07\`), neon cyan \`#22d3ee\` + magenta \`#f43f5e\`, slanted segmented bars (\`slant: 0.35\`).
2. **Dark Gothic / Eldritch RPG:** Obsidian gradient \`#0d0b14\` -> \`#1a1426\`, \`ornate_corners\`, crimson/blood ruby gems \`#dc2626\`, gold trim \`#d4af37\`, SVG filigree via \`art_render_svg\`.
3. **Anime Glassmorphism:** Translucent frost \`#0f172ab8\`, soft pastel inner highlight \`#ffffff30\`, rounded corners (\`radius: 10\`), soft radial glow, clean white labels with thin dark shadow.
4. **Cozy Minecraft Pixel Art:** \`art_draw_pixel_art\` 16x16/24x24 icons with 1px dark \`#181425\` \`outline_color\`, bevel borders, warm wood/parchment tones.
5. **Esports / Competitive Minimal:** Ultra-compact dark translucent pills \`#111318cc\`, crisp \`1px\` accent stripe on left edge, zero clutter.

## Multi-Step Creative Workflow
1. \`studio_status\` -> inspect live workspace & canvas.
2. Design matching graphics (\`art_render_svg\` / \`art_compose_layers\` / \`art_generate_bar_set\` / \`art_generate_widgets\`).
3. Assemble elements cleanly with \`hud_batch_elements\` / \`gui_batch_elements\`, align with \`studio_layout_helper\`.
4. Call \`studio_capture_preview\` and inspect the returned PNG image — adjust spacing/contrast if anything overlaps!
`;

function loadGuiNormalized(projectId) {
  if (!projectId) throw new Error('project_id is required when GUI Studio is not open');
  const rec = guiStorage.getProject(projectId);
  const data = normalizeProject(rec.data);
  return { rec, data };
}

function findMenu(data, menuId) {
  const m = data.menus.find((x) => x.id === menuId);
  if (!m) throw new Error(`Menu not found: ${menuId}`);
  return m;
}

function stripGuiImages(data) {
  const images = {};
  for (const [id, im] of Object.entries(data.images || {})) {
    images[id] = { name: im.name, w: im.w, h: im.h, res: im.res, hasData: !!im.data };
  }
  return { ...data, images };
}

function stripHudImages(data) {
  return {
    ...data,
    widgetsImageData: data.widgetsImageData ? '[omitted base64 PNG]' : null,
    elements: (data.elements || []).map((el) => ({
      ...el,
      imageData: el.imageData ? `[omitted PNG (${el.size?.[0] || '?'}x${el.size?.[1] || '?'})]` : null,
      animFrames: Array.isArray(el.animFrames) && el.animFrames.length ? `[${el.animFrames.length} frames]` : [],
      slicedImages: Array.isArray(el.slicedImages) && el.slicedImages.length ? `[${el.slicedImages.length} slices]` : [],
    })),
  };
}

async function resolveGuiLiveContext(args) {
  const st = await getLiveStatus();
  if (!st.live || st.workspace !== 'gui') return null;
  const cur = await callLive('studio.status', {});
  if (args?.project_id && cur.projectId && args.project_id !== cur.projectId) {
    return null;
  }
  if (args?.project_id && !cur.projectId) {
    return null;
  }
  return cur;
}

async function resolveHudLiveContext(args) {
  const st = await getLiveStatus();
  if (!st.live || st.workspace !== 'hud') return null;
  const cur = await callLive('studio.status', {});
  if (args?.project_id && cur.projectId && args.project_id !== cur.projectId) {
    return null;
  }
  if (args?.project_id && !cur.projectId) {
    return null;
  }
  return cur;
}

async function attachArtwork(art, attach, extra = {}) {
  if (!attach || typeof attach !== 'object' || !attach.target) return null;
  const target = String(attach.target);
  const st = await getLiveStatus();

  if (target === 'hud_new' || target === 'hud_new_anim') {
    const isAnim = target === 'hud_new_anim' || (Array.isArray(extra.animFrames) && extra.animFrames.length > 1);
    const elSpec = {
      type: 'image',
      name: attach.name || (isAnim ? 'Animated Sprite' : 'Custom Graphic'),
      group: attach.group,
      anchor_from: attach.anchor_from || 'top_left',
      anchor_to: attach.anchor_to || attach.anchor_from || 'top_left',
      offset: attach.offset || [8, 8],
      size: attach.size || [art.width, art.height],
      layer: attach.layer != null ? attach.layer : 100,
      props: {
        imageData: extra.previewFrame || art.dataUrl,
        imageName: `${slugNs(attach.name || 'art', 'art')}.png`,
        ...(isAnim ? {
          animFrames: extra.animFrames,
          animFps: extra.fps || 10,
          animFrameSize: [art.width, art.height],
        } : {}),
      },
    };
    if (st.live && st.workspace === 'hud' && (!attach.project_id)) {
      return await callLive('hud.add_element', elSpec);
    }
    if (!attach.project_id) throw new Error('project_id required in attach_to when HUD Studio is not open live');
    const rec = hudStorage.getProject(attach.project_id);
    const data = { ...newHudProjectData(), ...(rec.data || {}) };
    const el = newHudElement('image', { ...elSpec, ...elSpec.props, namespace: data.namespace }, data.elements, data.currentGroup);
    data.elements.push(el);
    hudStorage.updateProject(rec._id, rec.name, data);
    return { id: el.id, name: el.name, attachedTo: 'hud_offline' };
  }

  if (target === 'hud_element') {
    const patch = extra.animFrames
      ? { imageData: extra.previewFrame, animFrames: extra.animFrames, animFps: extra.fps || 10, animFrameSize: [art.width, art.height], size: attach.size || [art.width, art.height] }
      : extra.barSlices
        ? { slicedImages: extra.barSlices, barType: attach.barType || 'custom', barMaxSize: attach.size || [art.width, art.height], size: attach.size || [art.width, art.height] }
        : { imageData: art.dataUrl, size: attach.size || [art.width, art.height] };
    if (st.live && st.workspace === 'hud' && !attach.project_id) {
      return await callLive('hud.update_element', { element_id: attach.element_id, patch });
    }
    const rec = hudStorage.getProject(attach.project_id);
    const data = rec.data;
    const el = (data.elements || []).find((e) => e.id === Number(attach.element_id));
    if (!el) throw new Error(`HUD element not found: ${attach.element_id}`);
    Object.assign(el, patch);
    hudStorage.updateProject(rec._id, rec.name, data);
    return { id: el.id, name: el.name, attachedTo: 'hud_element_offline' };
  }

  if (target === 'hud_new_bar' && extra.barSlices) {
    const spec = {
      type: 'bar',
      name: attach.name || `Custom Bar`,
      group: attach.group,
      anchor_from: attach.anchor_from || 'top_left',
      anchor_to: attach.anchor_to || attach.anchor_from || 'top_left',
      offset: attach.offset || [8, 24],
      size: attach.size || [art.width, art.height],
      layer: attach.layer != null ? attach.layer : 101,
      props: {
        barType: attach.barType || 'custom',
        barCustomPapi: attach.barCustomPapi || '%player_health%',
        barCustomMax: attach.barCustomMax || '%player_max_health%',
        barMaxSize: attach.size || [art.width, art.height],
        barMinSize: [3, (attach.size && attach.size[1]) || art.height],
        slicedImages: extra.barSlices,
        previewStep: 16,
      },
    };
    if (st.live && st.workspace === 'hud' && !attach.project_id) {
      return await callLive('hud.add_element', spec);
    }
    const rec = hudStorage.getProject(attach.project_id);
    const data = { ...newHudProjectData(), ...(rec.data || {}) };
    const el = newHudElement('bar', { ...spec, ...spec.props, namespace: data.namespace }, data.elements, data.currentGroup);
    data.elements.push(el);
    hudStorage.updateProject(rec._id, rec.name, data);
    return { id: el.id, name: el.name, attachedTo: 'hud_bar_offline' };
  }

  if (target === 'hud_widgets') {
    if (st.live && st.workspace === 'hud' && !attach.project_id) {
      return await callLive('hud.set_widgets', { imageData: art.dataUrl });
    }
    const rec = hudStorage.getProject(attach.project_id);
    const data = rec.data || newHudProjectData();
    data.widgetsImageData = art.dataUrl;
    hudStorage.updateProject(rec._id, rec.name, data);
    return { attachedTo: 'hud_widgets_offline' };
  }

  if (target === 'gui_image' || target === 'gui_new_image' || target === 'gui_button') {
    const detail = attach.detail || 1;
    const imgMeta = {
      name: `${slug(attach.name || 'art', 'art')}.png`,
      data: art.dataUrl,
      w: Math.max(1, Math.round(art.width / detail)),
      h: Math.max(1, Math.round(art.height / detail)),
      res: detail,
    };
    const isLiveGui = st.live && st.workspace === 'gui' && !attach.project_id;
    let imageId;
    if (isLiveGui) {
      const added = await callLive('gui.add_image', imgMeta);
      imageId = added.image_id;
      if (target === 'gui_new_image' && attach.menu_id) {
        await callLive('gui.add_element', {
          menu_id: attach.menu_id,
          type: 'image',
          name: attach.name,
          x: attach.x,
          y: attach.y,
          w: attach.w || imgMeta.w,
          h: attach.h || imgMeta.h,
          props: { image: imageId, detail },
        });
      } else if (target === 'gui_button' && attach.menu_id && attach.element_id) {
        const patch = attach.hover ? { hoverImage: imageId } : { image: imageId, detail };
        await callLive('gui.update_element', { menu_id: attach.menu_id, element_id: attach.element_id, patch });
      }
      return { image_id: imageId, attachedTo: 'gui_live', ...imgMeta, data: undefined };
    }
    const { rec, data } = loadGuiNormalized(attach.project_id);
    imageId = addImage(data, imgMeta);
    if (target === 'gui_new_image' && attach.menu_id) {
      const m = findMenu(data, attach.menu_id);
      const el = newElement('image', m);
      Object.assign(el, {
        name: attach.name || el.name,
        x: attach.x != null ? attach.x : el.x,
        y: attach.y != null ? attach.y : el.y,
        w: attach.w || imgMeta.w,
        h: attach.h || imgMeta.h,
        image: imageId,
        detail,
      });
      m.elements.push(el);
    } else if (target === 'gui_button' && attach.menu_id && attach.element_id) {
      const m = findMenu(data, attach.menu_id);
      const el = m.elements.find((e) => e.id === attach.element_id);
      if (el) Object.assign(el, attach.hover ? { hoverImage: imageId } : { image: imageId, detail });
    }
    guiStorage.updateProject(rec._id, rec.name, normalizeProject(data));
    return { image_id: imageId, attachedTo: 'gui_offline', w: imgMeta.w, h: imgMeta.h };
  }

  return null;
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    // ───────── 1. Studio Live & Vision ─────────
    case 'studio_status': {
      const st = await getLiveStatus();
      if (!st.live) {
        return {
          live: false,
          message: 'KaizerHUD Studio desktop app is not open; offline project storage mode active.',
          hudProjectsDir: hudStorage.dir,
          guiProjectsDir: guiStorage.dir,
        };
      }
      const liveDetails = await callLive('studio.status', {});
      return { live: true, ...st, ...liveDetails };
    }

    case 'studio_switch_workspace': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to switch workspace');
      return await callLive('studio.switch_workspace', { workspace: args.workspace, force: args.force !== false });
    }

    case 'studio_capture_preview': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to capture a live canvas preview');
      const shot = await callLive('studio.capture_preview', { scale: args.scale || 2 });
      const b64 = String(shot.dataUrl || '').replace(/^data:image\/\w+;base64,/, '');
      if (!b64) throw new Error('Empty screenshot returned from studio');
      return {
        _mcpContent: [
          { type: 'image', data: b64, mimeType: 'image/png' },
          { type: 'text', text: JSON.stringify({ workspace: shot.workspace, width: shot.width, height: shot.height, menuId: shot.menuId, group: shot.group, elementCount: shot.elementCount }, null, 2) },
        ],
      };
    }

    case 'studio_layout_helper': {
      const st = await getLiveStatus();
      const targetWs = args.workspace || (st.live ? st.workspace : 'hud');
      if (st.live && st.workspace === targetWs && !args.project_id) {
        return await callLive('studio.layout', {
          op: args.op,
          element_ids: args.element_ids,
          menu_id: args.menu_id,
          gap: args.gap,
          grid: args.grid,
        });
      }
      if (targetWs === 'gui') {
        const { rec, data } = loadGuiNormalized(args.project_id);
        const m = args.menu_id ? findMenu(data, args.menu_id) : data.menus[0];
        const ids = Array.isArray(args.element_ids) && args.element_ids.length ? new Set(args.element_ids) : null;
        const subset = ids ? m.elements.filter((e) => ids.has(e.id)) : m.elements;
        applyLayoutOp(subset, args.op, { mode: 'gui', gap: args.gap, grid: args.grid, canvas_width: m.width, canvas_height: m.height });
        guiStorage.updateProject(rec._id, rec.name, normalizeProject(data));
        return { updated: subset.length, menu_id: m.id, op: args.op };
      }
      const rec = hudStorage.getProject(args.project_id);
      const data = { ...newHudProjectData(), ...(rec.data || {}) };
      const ids = Array.isArray(args.element_ids) && args.element_ids.length ? new Set(args.element_ids.map(Number)) : null;
      const subset = ids ? data.elements.filter((e) => ids.has(Number(e.id))) : data.elements.filter((e) => (e.group || 'Main') === (data.currentGroup || 'Main'));
      applyLayoutOp(subset, args.op, { mode: 'hud', gap: args.gap, grid: args.grid, canvas_width: 480, canvas_height: 270 });
      hudStorage.updateProject(rec._id, rec.name, data);
      return { updated: subset.length, op: args.op };
    }

    case 'studio_undo': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to run Undo');
      return await callLive('studio.undo', {});
    }

    case 'studio_redo': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to run Redo');
      return await callLive('studio.redo', {});
    }

    case 'studio_save': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to Save');
      return await callLive('studio.save', { name: args.name });
    }

    // ───────── 2. Creative Art Engine ─────────
    case 'art_render_svg': {
      const st = await getLiveStatus();
      if (!st.live) {
        throw new Error('art_render_svg requires KaizerHUD Studio to be open (WebView SVG rasterizer). Use art_compose_layers or art_draw_pixel_art in offline mode.');
      }
      const scale = Math.max(1, Math.min(4, Math.round(Number(args.scale) || (st.workspace === 'gui' ? 2 : 1))));
      const rendered = await callLive('art.render_svg', {
        svg: args.svg,
        width: Number(args.width),
        height: Number(args.height),
        scale,
        crisp: !!args.crisp,
      });
      const attached = await attachArtwork(rendered, args.attach_to);
      return { width: rendered.width, height: rendered.height, dataUrl: attached ? '[attached]' : rendered.dataUrl, attached };
    }

    case 'art_draw_pixel_art': {
      const art = drawPixelArt(args);
      const attached = await attachArtwork(art, args.attach_to);
      return { width: art.width, height: art.height, bytes: art.bytes, dataUrl: attached ? '[attached]' : art.dataUrl, attached };
    }

    case 'art_compose_layers': {
      const art = composeLayers(args);
      const attached = await attachArtwork(art, args.attach_to);
      return { width: art.width, height: art.height, bytes: art.bytes, dataUrl: attached ? '[attached]' : art.dataUrl, attached };
    }

    case 'art_generate_bar_set': {
      const res = generateBarSet(args);
      const barSlices = res.frames.slice(1, res.steps + 1); // HUD expects 16 slices (steps 1..16)
      const attached = await attachArtwork({ width: res.width, height: res.height, dataUrl: res.fullFrame }, args.attach_to, { barSlices });
      return {
        width: res.width,
        height: res.height,
        steps: res.steps,
        sliceCount: barSlices.length,
        variantKeys: Object.keys(res.statusVariants || {}),
        attached,
        ...(attached ? {} : { emptyFrame: res.emptyFrame, slices: barSlices }),
      };
    }

    case 'art_generate_animation': {
      const res = generateAnimation(args);
      const attached = await attachArtwork(
        { width: res.width, height: res.height, dataUrl: res.previewFrame },
        args.attach_to,
        { animFrames: res.animFrames, fps: res.fps, previewFrame: res.previewFrame },
      );
      return {
        width: res.width,
        height: res.height,
        fps: res.fps,
        frameCount: res.frameCount,
        attached,
        ...(attached ? {} : { animFrames: res.animFrames }),
      };
    }

    case 'art_generate_widgets': {
      const art = generateWidgetsHotbar(args);
      let attached = null;
      if (args.apply_to_hud) {
        attached = await attachArtwork(art, { target: 'hud_widgets', project_id: args.project_id });
      }
      return { width: art.width, height: art.height, bytes: art.bytes, attached, dataUrl: attached ? '[applied to HUD]' : art.dataUrl };
    }

    case 'art_import_file': {
      const art = importImageFile(args.file_path);
      const attached = await attachArtwork({ ...art, width: art.width || 64, height: art.height || 64 }, args.attach_to);
      return { fileName: art.fileName, width: art.width, height: art.height, bytes: art.bytes, attached, dataUrl: attached ? '[attached]' : art.dataUrl };
    }

    // ───────── 3. HUD Studio Tools ─────────
    case 'hud_list_projects': {
      const st = await getLiveStatus();
      let liveStatus = null;
      if (st.live && st.workspace === 'hud') {
        liveStatus = await callLive('studio.status', {});
      }
      return {
        projectsDir: hudStorage.dir,
        activeProjectId: liveStatus?.projectId || null,
        projects: hudStorage.listProjects(),
      };
    }

    case 'hud_get_project': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx && (!args.project_id || args.project_id === liveCtx.projectId)) {
        const res = await callLive('hud.get_project', { include_images: !!args.include_images });
        return args.include_images ? res : { ...res, data: stripHudImages(res.data || {}) };
      }
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      return {
        ...rec,
        data: args.include_images ? rec.data : stripHudImages(rec.data || {}),
      };
    }

    case 'hud_create_project': {
      const data = newHudProjectData({
        namespace: args.namespace || args.name,
        nameplatePosition: args.nameplate_position,
        nameplateMobileOffset: args.nameplate_mobile_offset,
      });
      const rec = hudStorage.createProject(args.name, data);
      const st = await getLiveStatus();
      if (st.live && args.open_live !== false) {
        if (st.workspace !== 'hud') await callLive('studio.switch_workspace', { workspace: 'hud', force: true });
        await callLive('hud.open_project', { project_id: rec._id });
      }
      return { _id: rec._id, name: rec.name, namespace: data.namespace, openedLive: !!(st.live && args.open_live !== false) };
    }

    case 'hud_open_project': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to load project into live canvas');
      if (st.workspace !== 'hud') await callLive('studio.switch_workspace', { workspace: 'hud', force: true });
      return await callLive('hud.open_project', { project_id: args.project_id });
    }

    case 'hud_delete_project':
      return hudStorage.deleteProject(args.project_id);

    case 'hud_manage_group': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) return await callLive('hud.manage_group', args);
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      const data = { ...newHudProjectData(), ...(rec.data || {}) };
      const groups = Array.isArray(data.groups) ? [...data.groups] : ['Main'];
      if (args.action === 'add' && args.group && !groups.includes(args.group)) {
        groups.push(args.group);
        data.currentGroup = args.group;
      } else if (args.action === 'select' && args.group && groups.includes(args.group)) {
        data.currentGroup = args.group;
      } else if (args.action === 'rename' && args.group && args.new_name) {
        const idx = groups.indexOf(args.group);
        if (idx !== -1) groups[idx] = args.new_name;
        (data.elements || []).forEach((e) => { if (e.group === args.group) e.group = args.new_name; });
        if (data.currentGroup === args.group) data.currentGroup = args.new_name;
      } else if (args.action === 'delete' && args.group && groups.length > 1) {
        data.elements = (data.elements || []).filter((e) => e.group !== args.group);
        const filtered = groups.filter((g) => g !== args.group);
        groups.length = 0;
        groups.push(...filtered);
        if (data.currentGroup === args.group) data.currentGroup = groups[0];
      }
      data.groups = groups;
      hudStorage.updateProject(rec._id, rec.name, data);
      return { groups: data.groups, currentGroup: data.currentGroup };
    }

    case 'hud_add_element': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) return await callLive('hud.add_element', args);
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      const data = { ...newHudProjectData(), ...(rec.data || {}) };
      const el = newHudElement(args.type, {
        ...args,
        ...(args.props || {}),
        namespace: data.namespace,
      }, data.elements, args.group || data.currentGroup || 'Main');
      if (el.group && !data.groups.includes(el.group)) data.groups.push(el.group);
      data.elements.push(el);
      hudStorage.updateProject(rec._id, rec.name, data);
      return el;
    }

    case 'hud_update_element': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) return await callLive('hud.update_element', args);
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      const data = rec.data;
      const el = (data.elements || []).find((e) => Number(e.id) === Number(args.element_id));
      if (!el) throw new Error(`HUD element not found: ${args.element_id}`);
      const { id: _id, type: _type, ...rest } = args.patch || {};
      Object.assign(el, rest);
      hudStorage.updateProject(rec._id, rec.name, data);
      return el;
    }

    case 'hud_delete_element': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) return await callLive('hud.delete_element', args);
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      const data = rec.data;
      const before = (data.elements || []).length;
      data.elements = (data.elements || []).filter((e) => Number(e.id) !== Number(args.element_id));
      if (data.elements.length === before) throw new Error(`HUD element not found: ${args.element_id}`);
      hudStorage.updateProject(rec._id, rec.name, data);
      return { deleted: args.element_id };
    }

    case 'hud_batch_elements': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) return await callLive('hud.batch_elements', args);
      if (!args.project_id) throw new Error('project_id required when HUD Studio is not active');
      const rec = hudStorage.getProject(args.project_id);
      const data = { ...newHudProjectData(), ...(rec.data || {}) };
      const results = [];
      for (const item of args.operations || []) {
        const op = item.op || 'add';
        if (op === 'add') {
          const el = newHudElement(item.type, { ...item, ...(item.props || {}), namespace: data.namespace }, data.elements, item.group || data.currentGroup);
          if (el.group && !data.groups.includes(el.group)) data.groups.push(el.group);
          data.elements.push(el);
          results.push({ op: 'add', id: el.id, name: el.name });
        } else if (op === 'update') {
          const el = data.elements.find((e) => Number(e.id) === Number(item.element_id ?? item.id));
          if (el) {
            Object.assign(el, item.patch || {});
            results.push({ op: 'update', id: el.id });
          }
        } else if (op === 'delete') {
          const id = Number(item.element_id ?? item.id);
          data.elements = data.elements.filter((e) => Number(e.id) !== id);
          results.push({ op: 'delete', id });
        }
      }
      hudStorage.updateProject(rec._id, rec.name, data);
      return { count: results.length, results };
    }

    case 'hud_inspect_budget': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) {
        const proj = await callLive('hud.get_project', { include_images: false });
        return inspectHudBudget(proj.data?.elements || []);
      }
      const rec = hudStorage.getProject(args.project_id);
      return inspectHudBudget(rec.data?.elements || []);
    }

    case 'hud_validate': {
      const liveCtx = await resolveHudLiveContext(args);
      if (liveCtx) {
        const proj = await callLive('hud.get_project', { include_images: true });
        return validateHudProject(proj.data || {});
      }
      const rec = hudStorage.getProject(args.project_id);
      return validateHudProject(rec.data || {});
    }

    case 'hud_preview_code': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('hud_preview_code uses the Rust codegen engine and requires KaizerHUD Studio to be running');
      let data;
      if (st.workspace === 'hud' && !args.project_id) {
        data = (await callLive('hud.get_project', { include_images: true })).data;
      } else {
        data = hudStorage.getProject(args.project_id).data;
      }
      return await callLive('rust.hud_preview_code', { data });
    }

    case 'hud_export_pack': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('hud_export_pack uses the Rust zip/pack builder and requires KaizerHUD Studio to be running');
      let data;
      if (st.workspace === 'hud' && !args.project_id) {
        data = (await callLive('hud.get_project', { include_images: true })).data;
      } else {
        data = hudStorage.getProject(args.project_id).data;
      }
      if (args.mode === 'sync_folder') {
        return await callLive('rust.hud_sync_folder', { data, folder: args.path, force: !!args.force });
      }
      return await callLive('rust.hud_export_zip', { data, outputPath: args.path });
    }

    // ───────── 4. GUI Studio Tools (Live + Offline) ─────────
    case 'list_projects': {
      const items = guiStorage.listProjects().map((item) => {
        try {
          const rec = guiStorage.getProject(item._id);
          const d = normalizeProject(rec.data);
          return { ...item, namespace: d.namespace, menuCount: d.menus.length, imageCount: Object.keys(d.images).length };
        } catch {
          return item;
        }
      });
      return { projectsDir: guiStorage.dir, projects: items };
    }

    case 'get_project': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx && (!args.project_id || args.project_id === liveCtx.projectId)) {
        const res = await callLive('gui.get_project', { include_images: !!args.include_images });
        return args.include_images ? res : { ...res, data: stripGuiImages(res.data) };
      }
      const { rec, data } = loadGuiNormalized(args.project_id);
      return {
        _id: rec._id,
        name: rec.name,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        data: args.include_images ? data : stripGuiImages(data),
      };
    }

    case 'create_project': {
      const data = newProject(args.namespace || args.name, args.pack_host || 'itemsadder');
      const rec = guiStorage.createProject(args.name, data);
      const st = await getLiveStatus();
      if (st.live && st.workspace === 'gui') {
        await callLive('gui.open_project', { project_id: rec._id });
      }
      return { _id: rec._id, name: rec.name, namespace: data.namespace, menus: data.menus.map((m) => m.id), openedLive: !!(st.live && st.workspace === 'gui') };
    }

    case 'delete_project':
      return guiStorage.deleteProject(args.project_id);

    case 'gui_open_project': {
      const st = await getLiveStatus();
      if (!st.live) throw new Error('KaizerHUD Studio must be open to load a GUI project live');
      if (st.workspace !== 'gui') await callLive('studio.switch_workspace', { workspace: 'gui', force: true });
      return await callLive('gui.open_project', { project_id: args.project_id });
    }

    case 'gui_open_menu': {
      const st = await getLiveStatus();
      if (!st.live || st.workspace !== 'gui') throw new Error('GUI Studio must be active to switch menu page live');
      return await callLive('gui.open_menu', { menu_id: args.menu_id });
    }

    case 'list_menus': {
      const liveCtx = await resolveGuiLiveContext(args);
      const data = liveCtx
        ? normalizeProject((await callLive('gui.get_project', { include_images: false })).data)
        : loadGuiNormalized(args.project_id).data;
      return {
        namespace: data.namespace,
        menus: data.menus.map((m) => ({
          id: m.id, title: m.title, command: m.command, width: m.width, height: m.height,
          prevPage: m.prevPage, nextPage: m.nextPage, elementCount: m.elements.length,
        })),
      };
    }

    case 'get_menu': {
      const liveCtx = await resolveGuiLiveContext(args);
      const data = liveCtx
        ? normalizeProject((await callLive('gui.get_project', { include_images: false })).data)
        : loadGuiNormalized(args.project_id).data;
      return findMenu(data, args.menu_id);
    }

    case 'upsert_menu': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.upsert_menu', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const id = slug(args.menu_id, '');
      if (!id) throw new Error('Invalid menu_id');
      let m = data.menus.find((x) => x.id === id);
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
      guiStorage.updateProject(rec._id, rec.name, norm);
      return { created, menu: findMenu(norm, id) };
    }

    case 'delete_menu': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.delete_menu', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      if (data.menus.length <= 1) throw new Error('Cannot delete the only remaining menu in a project');
      const idx = data.menus.findIndex((x) => x.id === args.menu_id);
      if (idx === -1) throw new Error(`Menu not found: ${args.menu_id}`);
      data.menus.splice(idx, 1);
      pruneImages(data);
      guiStorage.updateProject(rec._id, rec.name, data);
      return { deleted: args.menu_id, remainingMenus: data.menus.map((m) => m.id) };
    }

    case 'add_element': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.add_element', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
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
      guiStorage.updateProject(rec._id, rec.name, norm);
      const savedMenu = findMenu(norm, m.id);
      return savedMenu.elements[savedMenu.elements.length - 1];
    }

    case 'gui_batch_elements': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.batch_elements', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      const out = [];
      for (const item of args.operations || []) {
        const op = item.op || 'add';
        if (op === 'add') {
          const el = newElement(item.type, m);
          if (item.props && typeof item.props === 'object') Object.assign(el, item.props);
          if (item.id !== undefined) el.id = String(item.id);
          if (item.name !== undefined) el.name = String(item.name);
          if (item.x !== undefined) el.x = Number(item.x);
          if (item.y !== undefined) el.y = Number(item.y);
          if (item.w !== undefined) el.w = Number(item.w);
          if (item.h !== undefined) el.h = Number(item.h);
          m.elements.push(el);
          out.push({ op: 'add', id: el.id });
        } else if (op === 'update') {
          const el = m.elements.find((x) => x.id === item.element_id);
          if (el) {
            Object.assign(el, item.patch || {});
            out.push({ op: 'update', id: el.id });
          }
        } else if (op === 'delete') {
          m.elements = m.elements.filter((x) => x.id !== item.element_id);
          out.push({ op: 'delete', id: item.element_id });
        }
      }
      const norm = normalizeProject(data);
      guiStorage.updateProject(rec._id, rec.name, norm);
      return { count: out.length, results: out };
    }

    case 'update_element': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.update_element', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      const el = m.elements.find((x) => x.id === args.element_id);
      if (!el) throw new Error(`Element not found: ${args.element_id}`);
      if (args.patch && typeof args.patch === 'object') {
        const { id: _ignoreId, type: _ignoreType, ...rest } = args.patch;
        Object.assign(el, rest);
      }
      const norm = normalizeProject(data);
      guiStorage.updateProject(rec._id, rec.name, norm);
      return findMenu(norm, m.id).elements.find((x) => x.id === el.id);
    }

    case 'delete_element': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.delete_element', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      const idx = m.elements.findIndex((x) => x.id === args.element_id);
      if (idx === -1) throw new Error(`Element not found: ${args.element_id}`);
      m.elements.splice(idx, 1);
      pruneImages(data);
      guiStorage.updateProject(rec._id, rec.name, data);
      return { deleted: args.element_id, menu_id: m.id };
    }

    case 'gui_set_animation': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.set_animation', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const m = findMenu(data, args.menu_id);
      if (args.target === 'menu') {
        m.motion = { ...(m.motion || {}), ...(args.motion || {}) };
      } else {
        const el = m.elements.find((x) => x.id === args.element_id);
        if (!el) throw new Error(`Element not found: ${args.element_id}`);
        el.motion = { ...(el.motion || {}), ...(args.motion || {}) };
      }
      const norm = normalizeProject(data);
      guiStorage.updateProject(rec._id, rec.name, norm);
      return { ok: true, menu_id: m.id, target: args.target };
    }

    case 'link_menus': {
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) return await callLive('gui.link_menus', args);
      const { rec, data } = loadGuiNormalized(args.project_id);
      const from = findMenu(data, args.from_menu);
      findMenu(data, args.to_menu);
      if (args.mode === 'next_page') {
        from.nextPage = args.to_menu;
      } else if (args.mode === 'prev_page') {
        from.prevPage = args.to_menu;
      } else if (args.mode === 'button') {
        let btn = args.button_id ? from.elements.find((e) => e.id === args.button_id && e.type === 'button') : null;
        if (!btn && args.create_button === false) throw new Error(`Button not found: ${args.button_id}`);
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
      guiStorage.updateProject(rec._id, rec.name, norm);
      return buildUiFlow(norm);
    }

    case 'get_ui_flow': {
      const liveCtx = await resolveGuiLiveContext(args);
      const data = liveCtx
        ? normalizeProject((await callLive('gui.get_project', { include_images: false })).data)
        : loadGuiNormalized(args.project_id).data;
      return buildUiFlow(data);
    }

    case 'generate_panel_image': {
      const art = generateArtPng(args);
      const imgName = `${slug(args.name || `${args.kind || 'panel'}_${args.style || 'rpg'}`, 'art')}.png`;
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) {
        return await callLive('gui.add_image', { name: imgName, data: art.dataUrl, w: art.w, h: art.h, res: art.detail });
      }
      const { rec, data } = loadGuiNormalized(args.project_id);
      const imageId = addImage(data, { name: imgName, data: art.dataUrl, w: art.w, h: art.h, res: art.detail });
      guiStorage.updateProject(rec._id, rec.name, data);
      return { image_id: imageId, w: art.w, h: art.h, texW: art.texW, texH: art.texH, detail: art.detail };
    }

    case 'add_image_from_file': {
      const absPath = path.resolve(String(args.file_path));
      const buf = fs.readFileSync(absPath);
      const size = readPngSize(buf);
      const detail = [1, 2, 4, 8].includes(Number(args.detail)) ? Number(args.detail) : 1;
      const baseName = args.name || path.basename(absPath);
      const info = {
        name: baseName,
        data: 'data:image/png;base64,' + buf.toString('base64'),
        w: Math.max(1, Math.round(size.w / detail)),
        h: Math.max(1, Math.round(size.h / detail)),
        res: detail,
      };
      const liveCtx = await resolveGuiLiveContext(args);
      if (liveCtx) {
        return await callLive('gui.add_image', info);
      }
      const { rec, data } = loadGuiNormalized(args.project_id);
      const imageId = addImage(data, info);
      guiStorage.updateProject(rec._id, rec.name, data);
      return { image_id: imageId, w: info.w, h: info.h, texW: size.w, texH: size.h, detail };
    }

    case 'validate_project': {
      const liveCtx = await resolveGuiLiveContext(args);
      const data = liveCtx
        ? normalizeProject((await callLive('gui.get_project', { include_images: true })).data)
        : loadGuiNormalized(args.project_id).data;
      const issues = validateProject(data);
      const errors = issues.filter((i) => i.level === 'error');
      const warnings = issues.filter((i) => i.level !== 'error');
      const flow = buildUiFlow(data);
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        issues,
        flowSummary: { menuCount: flow.nodes.length, edgeCount: flow.edges.length, brokenLinks: flow.brokenLinks, orphanPages: flow.orphanPages },
      };
    }

    case 'export_plugin_yaml': {
      const liveCtx = await resolveGuiLiveContext(args);
      const data = liveCtx
        ? normalizeProject((await callLive('gui.get_project', { include_images: true })).data)
        : loadGuiNormalized(args.project_id).data;
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

    case 'assets_list_custom': {
      const dir = resolveCustomAssetsDir();
      const catPath = path.join(dir, 'catalog.json');
      if (!fs.existsSync(catPath)) {
        return { sources: [], totalMatched: 0, items: [], catalogDir: dir };
      }
      const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      const q = String(args.query || '').trim().toLowerCase();
      const prov = String(args.provider || '').trim().toLowerCase();
      const kind = String(args.kind || '').trim().toLowerCase();
      const limit = Math.max(1, Math.min(500, Number(args.limit) || 100));
      let items = Array.isArray(cat.items) ? cat.items : [];
      items = items.filter((it) => {
        if (prov && String(it.provider || '').toLowerCase() !== prov) return false;
        if (kind && String(it.kind || '').toLowerCase() !== kind) return false;
        if (q && !String(it.id || '').toLowerCase().includes(q) && !String(it.name || '').toLowerCase().includes(q)) return false;
        return true;
      });
      return {
        sources: Array.isArray(cat.sources) ? cat.sources : [],
        totalMatched: items.length,
        items: items.slice(0, limit).map((it) => ({
          id: it.id,
          provider: it.provider,
          kind: it.kind,
          name: it.name,
          namespace: it.namespace,
          animations: it.animations || [],
          hasModel: !!it.hasModel,
        })),
      };
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

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return;
  }
  if (!hasId) return;

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
        const result = await handleToolCall(toolName, toolArgs);
        if (result && Array.isArray(result._mcpContent)) {
          return sendResult(id, { content: result._mcpContent, isError: false });
        }
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
            name: 'KaizerHUD Studio Schema (HUD + GUI)',
            description: 'Live Bridge, HUD elements, GUI menus, actions, and storage locations',
            mimeType: 'text/markdown',
          },
          {
            uri: 'kaizer://docs/design_system',
            name: 'KaizerHUD Studio Creative Design Guide',
            description: 'Bedrock 480x270 canvas rules, safe zones, and bespoke aesthetic recipes',
            mimeType: 'text/markdown',
          },
          {
            uri: 'kaizer://projects',
            name: 'Local HUD & GUI Projects',
            description: 'Live JSON listing of both HUD (projects/) and GUI (gui_projects/) projects',
            mimeType: 'application/json',
          },
        ],
      });
    }

    if (method === 'resources/read') {
      const uri = params?.uri;
      if (uri === 'kaizer://docs/schema') {
        return sendResult(id, { contents: [{ uri, mimeType: 'text/markdown', text: SCHEMA_DOC }] });
      }
      if (uri === 'kaizer://docs/design_system') {
        return sendResult(id, { contents: [{ uri, mimeType: 'text/markdown', text: DESIGN_SYSTEM_DOC }] });
      }
      if (uri === 'kaizer://projects') {
        return sendResult(id, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              hudProjects: hudStorage.listProjects(),
              guiProjects: guiStorage.listProjects(),
            }, null, 2),
          }],
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
  Promise.resolve().then(() => handleMessage(JSON.parse(trimmed))).catch((err) => {
    console.error('[kaizer-studio-mcp] invalid JSON line:', err.message);
  });
});
