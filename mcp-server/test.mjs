import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPngSize } from './png_gen.mjs';
import { drawPixelArt } from './art_engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizer-studio-mcp-test-'));
const guiDir = path.join(tmpRoot, 'gui_projects');
const hudDir = path.join(tmpRoot, 'projects');
const assetsDir = path.join(tmpRoot, 'custom_assets');
const bridgeFile = path.join(tmpRoot, 'mcp_bridge.json');
const exportDir = path.join(tmpRoot, 'exported');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'catalog.json'), JSON.stringify({
  sources: [{ id: 's1', label: 'MyIA', provider: 'itemsadder', path: 'C:/pack', itemCount: 1, importedAt: '2026-11-26T00:00:00Z' }],
  items: [{ id: 'itemsadder:myshop:fire_sword', sourceId: 's1', provider: 'itemsadder', kind: 'item', name: 'Fire Sword', namespace: 'myshop', animations: [], hasModel: true }],
}));

function startClient(extraEnv = {}) {
  const proc = spawn(process.execPath, [path.join(HERE, 'index.mjs')], {
    env: {
      ...process.env,
      KAIZER_GUI_PROJECTS_DIR: guiDir,
      KAIZER_HUD_PROJECTS_DIR: hudDir,
      KAIZER_CUSTOM_ASSETS_DIR: assetsDir,
      KAIZER_MCP_BRIDGE_FILE: bridgeFile,
      ...extraEnv,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let nextId = 1;
  let buf = '';
  const pending = new Map();

  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg);
      }
    }
  });

  proc.stderr.on('data', (d) => process.stderr.write(d));

  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timeout waiting for ${method}`));
      }, 6000);
      pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  function notify(method, params) {
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  async function callTool(name, args = {}) {
    const res = await rpc('tools/call', { name, arguments: args });
    assert.ok(res.result, `Expected result for ${name}, got ${JSON.stringify(res)}`);
    assert.equal(res.result.isError, false, `Tool ${name} errored: ${res.result.content?.[0]?.text}`);
    return JSON.parse(res.result.content[0].text);
  }

  async function callToolRaw(name, args = {}) {
    const res = await rpc('tools/call', { name, arguments: args });
    assert.ok(res.result, `Expected result for ${name}`);
    assert.equal(res.result.isError, false, `Tool ${name} errored: ${res.result.content?.[0]?.text}`);
    return res.result;
  }

  return { proc, rpc, notify, callTool, callToolRaw };
}

function pngDimensions(dataUrl) {
  const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  return readPngSize(Buffer.from(b64, 'base64'));
}

async function runOfflineTests(client) {
  // 1. Handshake, tools, and resources
  const init = await client.rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-runner', version: '2.0.0' },
  });
  assert.equal(init.result.serverInfo.name, 'kaizer-studio-mcp');
  client.notify('notifications/initialized', {});
  assert.deepEqual((await client.rpc('ping', {})).result, {});

  const toolsRes = await client.rpc('tools/list', {});
  assert.ok(toolsRes.result.tools.length >= 38, `Expected >= 38 unified tools, got ${toolsRes.result.tools.length}`);

  const resList = await client.rpc('resources/list', {});
  assert.equal(resList.result.resources.length, 3, 'Expected 3 MCP resources');
  const designDoc = await client.rpc('resources/read', { uri: 'kaizer://docs/design_system' });
  assert.match(designDoc.result.contents[0].text, /480/);

  const offlineStatus = await client.callTool('studio_status');
  assert.equal(offlineStatus.live, false);

  // 2. Creative Art Engine (Pixel art, Layered composition, Bar set, Animation, Widgets)
  const pixelHeart = await client.callTool('art_draw_pixel_art', {
    palette: { '.': null, r: '#ff3355', h: '#ff99aa' },
    grid: ['.rr.', 'rhrr', 'rrrr', '.rr.'],
    scale: 2,
    mirror_x: true,
    outline_color: '#181425',
  });
  assert.equal(pixelHeart.width, 16);
  assert.equal(pixelHeart.height, 8);
  assert.deepEqual(pngDimensions(pixelHeart.dataUrl), { w: 16, h: 8 });

  const cyberPanel = await client.callTool('art_compose_layers', {
    width: 140,
    height: 44,
    layers: [
      { type: 'drop_shadow', x: 2, y: 2, w: 134, h: 38, color: '#00000099' },
      { type: 'linear_gradient', x: 2, y: 2, w: 134, h: 38, from: '#0f172ae8', to: '#020617ee', cut: 8 },
      { type: 'scanlines', x: 2, y: 2, w: 134, h: 38, step: 2, alpha: 0.08 },
      { type: 'border', x: 2, y: 2, w: 134, h: 38, style: 'cyber_brackets', color: '#1e293b', accent: '#22d3ee', thickness: 2 },
    ],
  });
  assert.deepEqual(pngDimensions(cyberPanel.dataUrl), { w: 140, h: 44 });

  // 3. HUD Studio Offline Workflow
  const hudProj = await client.callTool('hud_create_project', {
    name: 'Cyber HUD',
    namespace: 'cyberhud',
    nameplate_position: 'top_middle',
    open_live: false,
  });
  assert.ok(hudProj._id);

  await client.callTool('hud_manage_group', { action: 'add', group: 'Combat', project_id: hudProj._id });

  const animRes = await client.callTool('art_generate_animation', {
    width: 24,
    height: 24,
    frame_count: 4,
    fps: 8,
    effect: 'spin_gem',
    accent_color: '#22d3ee',
    attach_to: { target: 'hud_new_anim', project_id: hudProj._id, name: 'Core Gem', offset: [10, 10], group: 'Combat' },
  });
  assert.equal(animRes.frameCount, 4);
  assert.ok(animRes.attached.id);

  const barRes = await client.callTool('art_generate_bar_set', {
    width: 80,
    height: 10,
    steps: 16,
    fill_color: '#22d3ee',
    fill_color_end: '#38bdf8',
    corner_style: 'chamfer',
    segments: 10,
    slant: 0.25,
    status_variants: ['poison', 'freeze'],
    attach_to: { target: 'hud_new_bar', project_id: hudProj._id, barType: 'hp', name: 'Cyber HP', offset: [40, 14], group: 'Combat' },
  });
  assert.equal(barRes.sliceCount, 16);
  assert.deepEqual(barRes.variantKeys, ['poison', 'freeze']);

  const widRes = await client.callTool('art_generate_widgets', {
    style: 'cyberpunk',
    accent_color: '#22d3ee',
    apply_to_hud: true,
    project_id: hudProj._id,
  });
  assert.equal(widRes.width, 256);
  assert.equal(widRes.height, 256);

  const batchHud = await client.callTool('hud_batch_elements', {
    project_id: hudProj._id,
    operations: [
      { op: 'add', type: 'text', name: 'Player', group: 'Combat', offset: [40, 4], props: { papi_placeholder: '%player_name%', color: [0.13, 0.83, 0.93] } },
      { op: 'add', type: 'text', name: 'Balance', group: 'Combat', offset: [40, 28], props: { papi_placeholder: '%vault_eco_balance_formatted%' } },
      { op: 'add', type: 'xp_label', name: 'XP', group: 'Combat', anchor_from: 'bottom_middle', offset: [0, -28] },
    ],
  });
  assert.equal(batchHud.count, 3);

  await client.callTool('studio_layout_helper', {
    workspace: 'hud',
    project_id: hudProj._id,
    op: 'align_left',
    element_ids: [batchHud.results[0].id, batchHud.results[1].id],
  });

  const hudVal = await client.callTool('hud_validate', { project_id: hudProj._id });
  assert.equal(hudVal.ok, true);
  assert.equal(hudVal.budget.bankCount, 1);

  await client.callTool('hud_delete_project', { project_id: hudProj._id });

  // 4. GUI Studio Offline Workflow (Backward-compatible 17+ tools)
  const created = await client.callTool('create_project', {
    name: 'RPG Hub',
    namespace: 'rpghub',
    pack_host: 'itemsadder',
  });
  assert.ok(created._id);

  const panelArt = await client.callTool('generate_panel_image', {
    project_id: created._id,
    name: 'main_bg',
    kind: 'panel',
    style: 'rpg',
    w: 240,
    h: 160,
    detail: 2,
  });
  assert.equal(panelArt.texW, 480);

  await client.callTool('upsert_menu', {
    project_id: created._id,
    menu_id: 'shop',
    title: 'Item Shop',
    width: 480,
    height: 300,
  });

  await client.callTool('upsert_menu', {
    project_id: created._id,
    menu_id: 'confirm',
    title: 'Confirm Purchase',
    width: 480,
    height: 300,
  });

  await client.callTool('gui_batch_elements', {
    project_id: created._id,
    menu_id: 'confirm',
    operations: [
      { op: 'add', type: 'item', x: 228, y: 80, w: 24, h: 24, props: { item: '{item_id}' } },
      { op: 'add', type: 'text', x: 140, y: 120, w: 200, h: 16, props: { text: 'Total: {qty*unit_price}' } },
      { op: 'add', type: 'button', x: 180, y: 160, w: 120, h: 24, props: { label: 'Confirm Buy', actions: ['console:iagive %player_name% {item_id} {qty}', 'close'] } },
    ],
  });

  await client.callTool('gui_batch_elements', {
    project_id: created._id,
    menu_id: 'shop',
    operations: [
      { op: 'add', type: 'button', x: 40, y: 60, w: 96, h: 24, props: { label: 'Buy Fire Sword', actions: ['open:confirm?item_id=itemsadder:myshop:fire_sword&unit_price=500'] } },
      { op: 'add', type: 'player_model', x: 300, y: 50, w: 48, h: 96 },
      { op: 'add', type: 'custom_model', x: 200, y: 50, w: 48, h: 64, props: { modelId: 'meg:shopkeeper', animation: 'idle' } },
      { op: 'add', type: 'input', x: 40, y: 100, w: 96, h: 20, props: { varName: 'qty', inputType: 'number', defaultValue: '1', min: 1, max: 64 } },
      { op: 'add', type: 'scroll_area', x: 10, y: 140, w: 200, h: 120, props: { id: 'map_view', scrollMode: 'pan2d', contentW: 480, contentH: 360 } },
      { op: 'add', type: 'button', x: 30, y: 160, w: 72, h: 20, props: { scrollGroup: 'map_view', label: 'Node 1', actions: ['scroll:map_view:40:0'] } },
      { op: 'add', type: 'roulette', x: 220, y: 140, w: 220, h: 52, props: { id: 'crate_roll', rewards: [{ id: 'r1', name: 'Sword', color: '#ffd24a', item: 'minecraft:diamond_sword', weight: 1, actions: ['message:Won'] }] } },
    ],
  });

  const caRes = await client.callTool('assets_list_custom', { provider: 'itemsadder' });
  assert.equal(caRes.totalMatched, 1);
  assert.equal(caRes.items[0].id, 'itemsadder:myshop:fire_sword');

  const flow = await client.callTool('link_menus', {
    project_id: created._id,
    from_menu: 'main',
    to_menu: 'shop',
    mode: 'button',
    button_label: 'Open Shop',
  });
  assert.equal(flow.brokenLinks.length, 0);

  const flowFull = await client.callTool('get_ui_flow', { project_id: created._id });
  assert.equal(flowFull.brokenLinks.length, 0);
  assert.ok(flowFull.edges.some((e) => e.from === 'shop' && e.to === 'confirm'));

  const val = await client.callTool('validate_project', { project_id: created._id });
  assert.equal(val.valid, true);
  assert.equal(val.warnings.length, 0);

  const exp = await client.callTool('export_plugin_yaml', { project_id: created._id, out_dir: exportDir });
  assert.ok(fs.existsSync(path.join(exportDir, 'studio.yml')));
  assert.match(exp.menus.shop, /open:confirm\?item_id=itemsadder:myshop:fire_sword&unit_price=500/);
  assert.match(exp.menus.shop, /model-id: "meg:shopkeeper"/);
  assert.match(exp.menus.shop, /var-name: "qty"/);
  assert.match(exp.menus.shop, /type: scroll_area/);
  assert.match(exp.menus.shop, /scroll-group: "map_view"/);
  assert.match(exp.menus.shop, /type: roulette/);
  assert.match(exp.menus.confirm, /bedrock-slot:\s*\d+/);

  await client.callTool('delete_project', { project_id: created._id });
}

async function runLiveBridgeMockTests() {
  const token = 'testtoken1234567890abcdef';
  const rpcCalls = [];
  const samplePng = drawPixelArt({ palette: { x: '#3a8ee6' }, grid: ['xx', 'xx'], scale: 4 }).dataUrl;

  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, pid: 9999, workspace: 'hud', version: '1.0.4' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/rpc') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        rpcCalls.push(parsed.method);
        let result = { ok: true };
        if (parsed.method === 'studio.status') {
          result = { workspace: 'hud', projectId: null, projectName: 'Untitled', currentGroup: 'Main', groups: ['Main'], elementCount: 1, selectedIds: [1] };
        } else if (parsed.method === 'studio.capture_preview') {
          result = { workspace: 'hud', width: 960, height: 540, group: 'Main', elementCount: 1, dataUrl: samplePng };
        } else if (parsed.method === 'art.render_svg') {
          result = { width: parsed.params.width, height: parsed.params.height, dataUrl: samplePng };
        } else if (parsed.method === 'hud.add_element') {
          result = { id: 42, type: parsed.params.type, name: parsed.params.name || 'Live Card' };
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  fs.writeFileSync(bridgeFile, JSON.stringify({ port, token, pid: 9999 }));

  const client = startClient();
  try {
    const st = await client.callTool('studio_status');
    assert.equal(st.live, true);
    assert.equal(st.workspace, 'hud');

    const svgRes = await client.callTool('art_render_svg', {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24"><rect width="64" height="24" rx="6" fill="#22d3ee"/></svg>',
      width: 64,
      height: 24,
      attach_to: { target: 'hud_new', name: 'SVG Badge', offset: [12, 12] },
    });
    assert.equal(svgRes.attached.id, 42);

    const shotRaw = await client.callToolRaw('studio_capture_preview', { scale: 2 });
    assert.equal(shotRaw.content[0].type, 'image');
    assert.equal(shotRaw.content[0].mimeType, 'image/png');
    assert.ok(rpcCalls.includes('art.render_svg'));
    assert.ok(rpcCalls.includes('hud.add_element'));
    assert.ok(rpcCalls.includes('studio.capture_preview'));
  } finally {
    client.proc.kill();
    server.close();
  }
}

async function main() {
  const client = startClient();
  try {
    await runOfflineTests(client);
  } finally {
    client.proc.kill();
  }
  await runLiveBridgeMockTests();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('MCP Server test passed: Unified HUD + GUI + Creative Art Engine + Live Bridge E2E verified.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
