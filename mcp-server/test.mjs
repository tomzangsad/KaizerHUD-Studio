import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPngSize } from './png_gen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizer-gui-mcp-test-'));
const projectsDir = path.join(tmpRoot, 'gui_projects');
const exportDir = path.join(tmpRoot, 'exported');

function startClient() {
  const proc = spawn(process.execPath, [path.join(HERE, 'index.mjs')], {
    env: { ...process.env, KAIZER_GUI_PROJECTS_DIR: projectsDir },
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
      }, 5000);
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

  return { proc, rpc, notify, callTool };
}

async function main() {
  const client = startClient();
  try {
    // 1. Handshake & ping
    const init = await client.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-runner', version: '1.0.0' },
    });
    assert.equal(init.result.serverInfo.name, 'kaizer-gui-mcp');
    client.notify('notifications/initialized', {});
    const ping = await client.rpc('ping', {});
    assert.deepEqual(ping.result, {});

    // 2. Tools & Resources list
    const toolsRes = await client.rpc('tools/list', {});
    assert.equal(toolsRes.result.tools.length, 17, 'Expected 17 MCP tools');

    const resList = await client.rpc('resources/list', {});
    assert.equal(resList.result.resources.length, 2, 'Expected 2 MCP resources');

    const schemaDoc = await client.rpc('resources/read', { uri: 'kaizer://docs/schema' });
    assert.match(schemaDoc.result.contents[0].text, /event:<custom_key>/);

    // 3. Create project & verify menus
    const created = await client.callTool('create_project', {
      name: 'RPG Hub',
      namespace: 'rpghub',
      pack_host: 'itemsadder',
    });
    assert.ok(created._id);
    assert.equal(created.namespace, 'rpghub');

    const listed = await client.callTool('list_projects');
    assert.equal(listed.projects.length, 1);

    // 4. Generate panel & button PNGs in pure Node
    const panelArt = await client.callTool('generate_panel_image', {
      project_id: created._id,
      name: 'main_bg',
      kind: 'panel',
      style: 'rpg',
      w: 240,
      h: 160,
      detail: 2,
    });
    assert.equal(panelArt.w, 240);
    assert.equal(panelArt.texW, 480);

    // Verify stored base64 PNG signature & dimensions
    const fullProj = await client.callTool('get_project', { project_id: created._id, include_images: true });
    const imgB64 = fullProj.data.images[panelArt.image_id].data.replace(/^data:image\/png;base64,/, '');
    const imgSize = readPngSize(Buffer.from(imgB64, 'base64'));
    assert.equal(imgSize.w, 480);
    assert.equal(imgSize.h, 320);

    // Import an external PNG file too
    const extPngPath = path.join(tmpRoot, 'ext.png');
    fs.writeFileSync(extPngPath, Buffer.from(imgB64, 'base64'));
    const importedImg = await client.callTool('add_image_from_file', {
      project_id: created._id,
      file_path: extPngPath,
      name: 'imported_bg',
      detail: 2,
    });
    assert.equal(importedImg.w, 240);

    // 5. Upsert second menu, add elements, link menus
    await client.callTool('upsert_menu', {
      project_id: created._id,
      menu_id: 'shop',
      title: 'Item Shop',
      width: 480,
      height: 300,
    });

    const bgEl = await client.callTool('add_element', {
      project_id: created._id,
      menu_id: 'main',
      type: 'image',
      x: 100,
      y: 50,
      w: 240,
      h: 160,
      props: { image: panelArt.image_id, detail: 2 },
    });
    assert.equal(bgEl.image, panelArt.image_id);

    const rewardBtn = await client.callTool('add_element', {
      project_id: created._id,
      menu_id: 'shop',
      type: 'button',
      props: { label: 'Claim', actions: ['event:claim_reward'] },
    });
    await client.callTool('update_element', {
      project_id: created._id,
      menu_id: 'shop',
      element_id: rewardBtn.id,
      patch: { tooltip: 'Click to claim!' },
    });

    const flow = await client.callTool('link_menus', {
      project_id: created._id,
      from_menu: 'main',
      to_menu: 'shop',
      mode: 'button',
      button_label: 'Open Shop',
    });
    assert.equal(flow.brokenLinks.length, 0);
    assert.deepEqual(flow.orphanPages, []);
    assert.ok(flow.edges.some(e => e.from === 'main' && e.to === 'shop' && e.kind === 'open'));

    const flowCheck = await client.callTool('get_ui_flow', { project_id: created._id });
    assert.equal(flowCheck.nodes.length, 2);

    // 6. Validate & export YAML
    const val = await client.callTool('validate_project', { project_id: created._id });
    assert.equal(val.valid, true);
    assert.equal(val.errors.length, 0);

    const exp = await client.callTool('export_plugin_yaml', {
      project_id: created._id,
      out_dir: exportDir,
    });
    assert.ok(fs.existsSync(path.join(exportDir, 'studio.yml')));
    assert.ok(fs.existsSync(path.join(exportDir, 'menus', 'shop.yml')));
    assert.match(exp.menus.shop, /event:claim_reward/);

    // 7. Cleanup delete element, menu, project
    await client.callTool('delete_element', { project_id: created._id, menu_id: 'shop', element_id: rewardBtn.id });
    await client.callTool('delete_menu', { project_id: created._id, menu_id: 'shop' });
    await client.callTool('delete_project', { project_id: created._id });
    const after = await client.callTool('list_projects');
    assert.equal(after.projects.length, 0);

    console.log('MCP Server test passed: 17 tools, 2 resources, PNG generator, UI flow, YAML export.');
  } finally {
    client.proc.kill();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
