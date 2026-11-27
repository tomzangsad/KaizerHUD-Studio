/* ==========================================================
   KaizerHUD Studio — Live MCP Bridge Agent (HUD + GUI)
   Receives real-time commands from Rust mcp_bridge over Tauri
   events, renders SVG/Canvas captures, flashes edited controls,
   and exposes the Help -> Connect AI (MCP) dialog.
   ========================================================== */
(function () {
  'use strict';

  const TAURI = window.__TAURI__;
  const isGui = !!(window.GS && window.GS.Editor);
  const WORKSPACE = isGui ? 'gui' : 'hud';

  const ANCHORS = {
    top_left: { x: 0, y: 0 },
    top_middle: { x: 0.5, y: 0 },
    top_right: { x: 1, y: 0 },
    middle_left: { x: 0, y: 0.5 },
    left_middle: { x: 0, y: 0.5 },
    center: { x: 0.5, y: 0.5 },
    middle_right: { x: 1, y: 0.5 },
    right_middle: { x: 1, y: 0.5 },
    bottom_left: { x: 0, y: 1 },
    bottom_middle: { x: 0.5, y: 1 },
    bottom_right: { x: 1, y: 1 },
  };

  let bridgeInfo = null;
  let flashTimer = null;

  function tauriInvoke(cmd, args) {
    if (!TAURI || !TAURI.core || typeof TAURI.core.invoke !== 'function') {
      return Promise.reject(new Error('Tauri invoke unavailable'));
    }
    return TAURI.core.invoke(cmd, args || {});
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function notify(msg, kind) {
    if (isGui && window.GS && typeof GS.toast === 'function') {
      GS.toast('MCP: ' + msg, kind === 'error' ? 'error' : 'ok');
    } else if (window.App && typeof App.showToast === 'function') {
      App.showToast('MCP: ' + msg, kind === 'error' ? 'error' : 'success');
    }
  }

  function flashElements(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    clearTimeout(flashTimer);
    document.querySelectorAll('.kz-mcp-flash').forEach((el) => el.classList.remove('kz-mcp-flash'));
    requestAnimationFrame(() => {
      ids.forEach((id) => {
        const node = isGui
          ? document.querySelector(`#gs-elements [data-id="${id}"]`)
          : document.querySelector(`#preview-screen [data-id="${id}"], #preview-screen [data-el-id="${id}"]`);
        if (node) node.classList.add('kz-mcp-flash');
      });
      flashTimer = setTimeout(() => {
        document.querySelectorAll('.kz-mcp-flash').forEach((el) => el.classList.remove('kz-mcp-flash'));
      }, 1500);
    });
  }

  /* ───────────── Titlebar MCP Pill & Connect Modal ───────────── */

  function ensurePill() {
    const controls = document.getElementById('window-controls');
    if (!controls || document.getElementById('kz-mcp-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'kz-mcp-pill';
    pill.className = 'tb-mcp-pill';
    pill.type = 'button';
    pill.title = 'AI MCP Live Bridge — click to view config or recent AI actions';
    pill.innerHTML = '<span class="kz-mcp-dot"></span><span>MCP</span>';
    pill.addEventListener('mousedown', (e) => e.stopPropagation());
    pill.addEventListener('click', () => openConnectDialog());
    controls.parentNode.insertBefore(pill, controls);
  }

  function pulsePill() {
    const pill = document.getElementById('kz-mcp-pill');
    if (!pill) return;
    pill.classList.add('busy');
    setTimeout(() => pill.classList.remove('busy'), 700);
  }

  async function openConnectDialog() {
    let info = bridgeInfo || {};
    try {
      info = await tauriInvoke('mcp_bridge_info');
      bridgeInfo = info;
    } catch (e) { /* offline browser preview */ }

    const serverPath = info.mcpServerPath || '<path-to-kaizer-studio-mcp>/index.mjs';
    const serverDir = info.mcpServerDir || '';
    const snippet = JSON.stringify({
      mcpServers: {
        'kaizer-studio': {
          command: 'node',
          args: [serverPath],
        },
      },
    }, null, 2);

    const recent = Array.isArray(info.recentActions) ? info.recentActions.slice(0, 10) : [];
    const recentHtml = recent.length
      ? recent.map((a) => `<div class="kz-mcp-log-row ${a.ok ? 'ok' : 'err'}"><code>${escHtml(a.method)}</code><span>${escHtml(a.summary || '')}</span></div>`).join('')
      : '<p class="kz-upd-msg muted">No MCP calls in this session yet.</p>';

    document.querySelectorAll('.kz-mcp-back').forEach((n) => n.remove());
    const back = document.createElement('div');
    back.className = 'kz-upd-back kz-mcp-back';
    back.innerHTML = `
      <div class="kz-upd-dialog kz-mcp-dialog" role="dialog" aria-modal="true" aria-label="Connect AI (MCP)">
        <div class="kz-upd-head">
          <div class="kz-upd-head-title">
            <span class="kz-mcp-dot"></span>
            <span>Connect AI (MCP Live Bridge)</span>
          </div>
          <button class="icon-btn small" data-mcp-close title="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <div class="kz-upd-body">
          <div class="kz-upd-card ok">
            <div>
              <b>Live Bridge Active (${escHtml(WORKSPACE.toUpperCase())} Workspace)</b>
              <p class="kz-upd-msg">Listening on <code>127.0.0.1:${escHtml(info.port || '...')}</code>. AI edits appear live on the canvas with full Undo (<code>Ctrl+Z</code>) support.</p>
            </div>
          </div>
          <div>
            <div class="kz-upd-label" style="margin-bottom:6px">Client Configuration (<code>mcp_config.json</code> / Claude Desktop / Cursor):</div>
            <pre class="kz-mcp-pre" id="kz-mcp-snippet">${escHtml(snippet)}</pre>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
              <span class="kz-upd-msg muted" style="margin:0">Bundled automatically on this PC. Requires Node.js 18+ in PATH.</span>
              <div style="display:flex;gap:6px">
                ${serverDir ? '<button class="ghost-btn" id="kz-mcp-folder-btn">Open MCP Folder</button>' : ''}
                <button class="ghost-btn" id="kz-mcp-copy-btn">Copy Config JSON</button>
              </div>
            </div>
          </div>
          <div>
            <div class="kz-upd-label" style="margin-bottom:6px">Recent AI Activity:</div>
            <div class="kz-mcp-logs">${recentHtml}</div>
          </div>
        </div>
        <div class="kz-upd-foot">
          <button class="primary-btn" data-mcp-close>Close</button>
        </div>
      </div>`;

    const close = () => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    back.addEventListener('click', (e) => {
      if (e.target === back || e.target.closest('[data-mcp-close]')) close();
    });
    const folderBtn = back.querySelector('#kz-mcp-folder-btn');
    if (folderBtn && serverDir) {
      folderBtn.addEventListener('click', () => {
        tauriInvoke('open_folder', { path: serverDir }).catch((err) => notify(String(err), 'error'));
      });
    }
    back.querySelector('#kz-mcp-copy-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(snippet);
        notify('Copied MCP config JSON');
      } catch {
        notify('Copy failed — select from box manually', 'error');
      }
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
  }

  /* ───────────── Image / SVG / Preview Helpers ───────────── */

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('Empty image source'));
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = src;
    });
  }

  async function renderSvgToPng({ svg, width, height, scale = 2, crisp = false }) {
    const w = Math.max(4, Math.min(1024, Math.round(Number(width) || 64)));
    const h = Math.max(4, Math.min(1024, Math.round(Number(height) || 64)));
    const sc = Math.max(1, Math.min(4, Math.round(Number(scale) || 1)));
    const rawSvg = String(svg || '').trim();
    if (!rawSvg.toLowerCase().includes('<svg')) {
      throw new Error('svg parameter must contain an <svg> element');
    }
    const blob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImg(url);
      const canvas = document.createElement('canvas');
      canvas.width = w * sc;
      canvas.height = h * sc;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = !crisp;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return {
        width: w,
        height: h,
        texWidth: canvas.width,
        texHeight: canvas.height,
        scale: sc,
        dataUrl: canvas.toDataURL('image/png'),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function samplePapiText(s) {
    return String(s || '')
      .replace(/&([0-9a-fk-or])|§([0-9a-fk-or])/gi, '')
      .replace(/%player_name%/gi, 'Steve')
      .replace(/%player_health(_rounded)?%/gi, '20')
      .replace(/%player_max_health(_rounded)?%/gi, '20')
      .replace(/%player_food_level%/gi, '18')
      .replace(/%player_level%/gi, '12')
      .replace(/%vault_eco_balance(_formatted|_commas|_fixed)?%/gi, '1,250')
      .replace(/%server_online%/gi, '42')
      .replace(/%server_max_players%/gi, '100')
      .replace(/%server_tps(_1)?%/gi, '20.0')
      .replace(/%player_x%/gi, '124')
      .replace(/%player_y%/gi, '68')
      .replace(/%player_z%/gi, '-42')
      .replace(/%player_ping%/gi, '24');
  }

  function rgbArrToCss(col, alpha = 1) {
    if (!Array.isArray(col) || col.length < 3) return `rgba(255,255,255,${alpha})`;
    const mult = col.some((v) => v > 1) ? 1 : 255;
    return `rgba(${Math.round(col[0] * mult)},${Math.round(col[1] * mult)},${Math.round(col[2] * mult)},${alpha})`;
  }

  async function captureHudPreview(scale = 2) {
    const sc = Math.max(1, Math.min(3, Math.round(Number(scale) || 2)));
    const W = (window.App && App.BEDROCK_WIDTH) || 480;
    const H = (window.App && App.BEDROCK_HEIGHT) || 270;
    const canvas = document.createElement('canvas');
    canvas.width = W * sc;
    canvas.height = H * sc;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(sc, sc);

    // Sky/backdrop gradient matching preview-screen feel
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1e2c44');
    grad.addColorStop(0.65, '#3b4a62');
    grad.addColorStop(1, '#1c2430');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // subtle 3x3 grid hints
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (const gx of [W / 3, (W * 2) / 3]) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (const gy of [H / 3, (H * 2) / 3]) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    const curGroup = (App && App.currentGroup) || 'Main';
    const visible = (App && Array.isArray(App.elements) ? App.elements : [])
      .filter((e) => !e.hidden && (e.group || 'Main') === curGroup)
      .slice()
      .sort((a, b) => (Number(a.layer) || 100) - (Number(b.layer) || 100));

    for (const el of visible) {
      const sz = Array.isArray(el.size) ? el.size : [32, 16];
      const off = Array.isArray(el.offset) ? el.offset : [0, 0];
      const af = ANCHORS[el.anchor_from] || ANCHORS.top_left;
      const at = ANCHORS[el.anchor_to || el.anchor_from] || ANCHORS.top_left;
      const x = af.x * W - at.x * sz[0] + (Number(off[0]) || 0);
      const y = af.y * H - at.y * sz[1] + (Number(off[1]) || 0);
      ctx.save();
      ctx.globalAlpha = el.alpha != null ? Math.max(0, Math.min(1, Number(el.alpha))) : 1;

      if (el.type === 'image') {
        const src = (el.animFrames && el.animFrames.length ? el.animFrames[0] : el.imageData);
        if (src) {
          try {
            const img = await loadImg(src);
            ctx.drawImage(img, x, y, sz[0], sz[1]);
          } catch { /* ignore */ }
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.strokeRect(x, y, sz[0], sz[1]);
        }
      } else if (el.type === 'bar') {
        const slices = Array.isArray(el.slicedImages) ? el.slicedImages : [];
        const stepIdx = Math.max(0, Math.min(slices.length - 1, (el.previewStep || 16) - 1));
        if (slices[stepIdx]) {
          try {
            const img = await loadImg(slices[stepIdx]);
            ctx.drawImage(img, x, y, sz[0], sz[1]);
          } catch { /* ignore */ }
        } else {
          ctx.fillStyle = '#181a24';
          ctx.fillRect(x, y, sz[0], sz[1]);
          const barCols = { hp: '#d93848', food: '#d98a2b', armor: '#9bb0c8', air: '#38bdf8', exp: '#6be649' };
          ctx.fillStyle = barCols[el.barType] || '#4aa8ff';
          ctx.fillRect(x + 1, y + 1, Math.max(2, sz[0] - 2), Math.max(1, sz[1] - 2));
        }
      } else if (el.type === 'player_head') {
        ctx.fillStyle = '#c6906d';
        ctx.fillRect(x, y, sz[0], sz[1]);
        ctx.fillStyle = '#4f3524';
        ctx.fillRect(x, y, sz[0], sz[1] * 0.28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + sz[0] * 0.18, y + sz[1] * 0.45, sz[0] * 0.2, sz[1] * 0.14);
        ctx.fillRect(x + sz[0] * 0.62, y + sz[1] * 0.45, sz[0] * 0.2, sz[1] * 0.14);
        ctx.fillStyle = '#2d4a9e';
        ctx.fillRect(x + sz[0] * 0.28, y + sz[1] * 0.45, sz[0] * 0.1, sz[1] * 0.14);
        ctx.fillRect(x + sz[0] * 0.62, y + sz[1] * 0.45, sz[0] * 0.1, sz[1] * 0.14);
      } else if (el.type === 'xp_label') {
        const px = el.xp_font_size === 'large' ? 10 : el.xp_font_size === 'small' ? 5 : 8;
        ctx.font = `bold ${px}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';
        ctx.fillText(String(el.text || '13'), x + sz[0] * 0.5 + 0.8, y + sz[1] * 0.5 + 0.8);
        ctx.fillStyle = rgbArrToCss(el.xp_color || [0.5, 1, 0.1]);
        ctx.fillText(String(el.text || '13'), x + sz[0] * 0.5, y + sz[1] * 0.5);
      } else if (el.type === 'text' || el.type === 'nameplate') {
        const px = el.font_size === 'large' ? 10 : el.font_size === 'small' ? 5.5 : 8;
        const txt = samplePapiText(el.papi_placeholder || el.name || 'Text');
        ctx.font = `${px}px monospace`;
        ctx.textBaseline = 'top';
        const align = el.text_anchor_from === 'top_middle' || el.text_anchor_from === 'center' ? 'center' : (el.text_anchor_from && el.text_anchor_from.includes('right') ? 'right' : 'left');
        ctx.textAlign = align;
        const tx = align === 'center' ? x + sz[0] * 0.5 : align === 'right' ? x + sz[0] : x;
        if (el.shadow) {
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillText(txt, tx + 0.7, y + 0.7);
        }
        ctx.fillStyle = rgbArrToCss(el.color || [1, 1, 1]);
        ctx.fillText(txt, tx, y);
      }
      ctx.restore();
    }

    // Widgets hotbar preview if present
    const widgetsUrl = window.Widgets && typeof Widgets.getWidgetsImageData === 'function' ? Widgets.getWidgetsImageData() : null;
    if (widgetsUrl) {
      try {
        const wImg = await loadImg(widgetsUrl);
        ctx.drawImage(wImg, 0, 0, 182, 22, (W - 182) * 0.5, H - 22, 182, 22);
      } catch { /* ignore */ }
    }

    return {
      workspace: 'hud',
      width: canvas.width,
      height: canvas.height,
      group: curGroup,
      elementCount: visible.length,
      dataUrl: canvas.toDataURL('image/png'),
    };
  }

  async function captureGuiPreview(scale = 2) {
    const E = GS.Editor;
    const m = E.menu();
    const sc = Math.max(1, Math.min(3, Math.round(Number(scale) || 2)));
    const canvas = document.createElement('canvas');
    canvas.width = m.width * sc;
    canvas.height = m.height * sc;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(sc, sc);

    ctx.fillStyle = '#141720';
    ctx.fillRect(0, 0, m.width, m.height);
    if (m.fullscreen) {
      ctx.fillStyle = m.backdrop || '#000000';
      ctx.globalAlpha = m.backdropAlpha != null ? Number(m.backdropAlpha) : 0.6;
      ctx.fillRect(0, 0, m.width, m.height);
      ctx.globalAlpha = 1;
    }

    for (const el of m.elements) {
      if (el.hidden) continue;
      ctx.save();
      if (el.type === 'image' || el.type === 'button') {
        const src = E.imageUrl(el.image);
        if (src) {
          try {
            const img = await loadImg(src);
            ctx.drawImage(img, el.x, el.y, el.w, el.h);
          } catch { /* ignore */ }
        } else {
          ctx.fillStyle = el.type === 'button' ? '#2c3d59' : '#252a36';
          ctx.fillRect(el.x, el.y, el.w, el.h);
          ctx.strokeStyle = '#5c7296';
          ctx.lineWidth = 1;
          ctx.strokeRect(el.x, el.y, el.w, el.h);
        }
        if (el.type === 'button' && el.label) {
          const fs = Math.max(8, Math.round(9 * (Number(el.labelScale) || 1)));
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lbl = samplePapiText(el.label);
          if (el.labelShadow !== false) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillText(lbl, el.x + el.w * 0.5 + 1, el.y + el.h * 0.5 + 1);
          }
          ctx.fillStyle = el.labelColor || '#ffffff';
          ctx.fillText(lbl, el.x + el.w * 0.5, el.y + el.h * 0.5);
        }
      } else if (el.type === 'text') {
        const fs = Math.max(8, Math.round(10 * (Number(el.scale) || 1)));
        ctx.font = `600 ${fs}px sans-serif`;
        ctx.textBaseline = 'top';
        const align = el.align || 'left';
        ctx.textAlign = align;
        const tx = align === 'center' ? el.x + el.w * 0.5 : align === 'right' ? el.x + el.w : el.x;
        const txt = samplePapiText(el.text || '');
        if (el.shadow !== false) {
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillText(txt, tx + 1, el.y + 1);
        }
        ctx.fillStyle = el.color || '#ffffff';
        ctx.fillText(txt, tx, el.y);
      } else if (el.type === 'player_head' || el.type === 'player_model') {
        ctx.fillStyle = '#252b3b';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeStyle = '#5a78a8';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = '#c8d6e5';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.type === 'player_model' ? '3D Player' : 'Head', el.x + el.w * 0.5, el.y + el.h * 0.5);
      } else if (el.type === 'item') {
        ctx.fillStyle = '#1b202c';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeStyle = '#6f7c99';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = '#9be3ff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(el.item || 'item').replace(/^minecraft:/, '').slice(0, 10), el.x + el.w * 0.5, el.y + el.h * 0.5);
      } else if (el.type === 'custom_model') {
        ctx.fillStyle = '#241b35';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeStyle = '#9173ff';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = '#d8c8ff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(el.modelId || '3D Model').slice(0, 14), el.x + el.w * 0.5, el.y + el.h * 0.5);
      } else if (el.type === 'input') {
        ctx.fillStyle = el.bgColor || '#161b26';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeStyle = el.borderColor || '#52a0f0';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.fillStyle = el.textColor || '#ffffff';
        ctx.font = `${Math.max(6, Math.round(8 * (Number(el.scale) || 1)))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const disp = `${el.prefix || ''}${el.defaultValue == null ? '1' : el.defaultValue}${el.suffix || ''} ✎`;
        ctx.fillText(disp.slice(0, 22), el.x + el.w * 0.5, el.y + el.h * 0.5);
      } else if (el.type === 'roulette') {
        ctx.fillStyle = el.bgColor || '#121622';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeStyle = el.pointerColor || '#ffd24a';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.beginPath();
        ctx.moveTo(el.x + el.w * 0.5, el.y);
        ctx.lineTo(el.x + el.w * 0.5, el.y + el.h);
        ctx.stroke();
        ctx.fillStyle = '#ffd24a';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ROULETTE (${Array.isArray(el.rewards) ? el.rewards.length : 0})`, el.x + el.w * 0.5, el.y + el.h * 0.5);
      } else if (el.type === 'scroll_area') {
        ctx.fillStyle = el.bgColor || 'rgba(18, 22, 34, 0.45)';
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = el.borderColor || '#52a0f0';
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#89b4fa';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`SCROLL ${el.scrollMode || 'pan2d'}`, el.x + 4, el.y + 4);
      }
      ctx.restore();
    }

    return {
      workspace: 'gui',
      width: canvas.width,
      height: canvas.height,
      menuId: m.id,
      elementCount: m.elements.length,
      dataUrl: canvas.toDataURL('image/png'),
    };
  }

  /* ───────────── Shared Layout Algorithm ───────────── */

  function runLayoutOn(items, op, opts, mode) {
    if (!items.length) return;
    const getBox = (it) => mode === 'gui'
      ? { x: Number(it.x) || 0, y: Number(it.y) || 0, w: Math.max(1, Number(it.w) || 1), h: Math.max(1, Number(it.h) || 1) }
      : { x: Number(it.offset?.[0]) || 0, y: Number(it.offset?.[1]) || 0, w: Math.max(1, Number(it.size?.[0]) || 1), h: Math.max(1, Number(it.size?.[1]) || 1) };
    const setBox = (it, box) => {
      if (mode === 'gui') {
        it.x = Math.round(box.x);
        it.y = Math.round(box.y);
      } else {
        it.offset = [Math.round(box.x * 10) / 10, Math.round(box.y * 10) / 10];
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
    else if (op === 'snap_grid') items.forEach((it, i) => setBox(it, { ...boxes[i], x: Math.round(boxes[i].x / grid) * grid, y: Math.round(boxes[i].y / grid) * grid }));
    else if (op === 'mirror_h') {
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
      sorted.forEach((entry) => { setBox(entry.it, { ...entry.box, x: cur }); cur += entry.box.w + gap; });
    } else if (op === 'distribute_v' && items.length >= 3) {
      const sorted = items.map((it, i) => ({ it, box: boxes[i] })).sort((a, b) => a.box.y - b.box.y);
      const totalH = sorted.reduce((s, x) => s + x.box.h, 0);
      const gap = opts.gap != null ? Number(opts.gap) : ((maxY - minY - totalH) / (sorted.length - 1));
      let cur = sorted[0].box.y;
      sorted.forEach((entry) => { setBox(entry.it, { ...entry.box, y: cur }); cur += entry.box.h + gap; });
    } else if (op === 'stack_vertical') {
      const gap = opts.gap != null ? Number(opts.gap) : 4;
      let cur = boxes[0].y;
      items.forEach((it, i) => { setBox(it, { ...boxes[i], x: boxes[0].x, y: cur }); cur += boxes[i].h + gap; });
    } else if (op === 'stack_horizontal') {
      const gap = opts.gap != null ? Number(opts.gap) : 4;
      let cur = boxes[0].x;
      items.forEach((it, i) => { setBox(it, { ...boxes[i], x: cur, y: boxes[0].y }); cur += boxes[i].w + gap; });
    } else {
      throw new Error(`Unknown layout op: ${op}`);
    }
  }

  /* ───────────── Persistence Sync Helpers ───────────── */

  function getHudDataSnapshot() {
    return {
      elements: App.elements,
      namespace: App.getNamespace ? App.getNamespace() : (App.namespace || 'custom_hud'),
      selectedIds: App.selectedIds || [],
      groups: App.groups || ['Main'],
      currentGroup: App.currentGroup || 'Main',
      widgetsImageData: window.Widgets && Widgets.getWidgetsImageData ? Widgets.getWidgetsImageData() : null,
      codeOverrides: App.codeOverrides || {},
      packUuids: App.packUuids || null,
      syncFolder: App.syncFolder || null,
      nameplatePosition: typeof getNameplateSettings === 'function' ? getNameplateSettings().position : 'top_right',
      nameplateMobileOffset: typeof getNameplateSettings === 'function' ? getNameplateSettings().mobileOffset : 26,
      hudChannel: 'title',
    };
  }

  async function persistHudIfSaved() {
    const id = localStorage.getItem('current_project_id');
    const name = localStorage.getItem('current_project_name');
    if (id && name && window.API && typeof API.saveProject === 'function') {
      await API.saveProject(name, getHudDataSnapshot(), { updateExisting: true });
    }
    if (window.KZCode && typeof KZCode.schedule === 'function') KZCode.schedule();
  }

  async function persistGuiIfSaved(prune = true) {
    const E = GS.Editor;
    if (GS.Doc && GS.Doc.id && GS.Backend) {
      if (prune) GS.Model.pruneImages(E.project);
      await GS.Backend.update(GS.Doc.id, GS.Doc.name, E.project);
      GS.Doc.markSaved(GS.Doc.id, GS.Doc.name);
    }
  }

  /* ───────────── Live RPC Dispatch ───────────── */

  function createHudElementSilent(type, spec) {
    const props = spec && spec.props && typeof spec.props === 'object' ? { ...spec, ...spec.props } : { ...spec };
    if (spec.group && !App.groups.includes(spec.group)) App.groups.push(spec.group);
    const prevGroup = App.currentGroup;
    if (spec.group) App.currentGroup = spec.group;
    const origPush = App.pushHistory;
    const origRender = App.render;
    App.pushHistory = () => {};
    App.render = () => {};
    let el;
    try {
      el = App.addElement(type, props);
    } finally {
      App.pushHistory = origPush;
      App.render = origRender;
      App.currentGroup = prevGroup;
    }
    return el;
  }

  async function dispatchRpc(method, params) {
    // ── Studio Shared ──
    if (method === 'studio.status') {
      if (isGui) {
        const m = GS.Editor.menu();
        return {
          workspace: 'gui',
          projectId: GS.Doc ? GS.Doc.id : null,
          projectName: GS.Doc ? GS.Doc.name : 'Untitled GUI',
          dirty: !!(GS.Doc && GS.Doc.dirty),
          namespace: GS.Editor.project?.namespace || 'kaizerui',
          activeMenu: m ? m.id : null,
          menus: (GS.Editor.project?.menus || []).map((x) => x.id),
          selectedIds: GS.Editor.selIds(),
        };
      }
      return {
        workspace: 'hud',
        projectId: localStorage.getItem('current_project_id') || null,
        projectName: localStorage.getItem('current_project_name') || 'Untitled',
        dirty: !!(window.KZDoc && KZDoc.dirty),
        namespace: App.getNamespace ? App.getNamespace() : (App.namespace || 'custom_hud'),
        currentGroup: App.currentGroup || 'Main',
        groups: App.groups || ['Main'],
        elementCount: (App.elements || []).length,
        selectedIds: App.selectedIds || [],
      };
    }

    if (method === 'studio.switch_workspace') {
      const target = params.workspace === 'gui' ? 'gui' : 'hud';
      if (target === WORKSPACE) return { workspace: WORKSPACE, switched: false };
      if (isGui) {
        if (GS.Doc) GS.Doc.dirty = false;
        window.location.href = 'index.html';
      } else {
        if (window.KZDoc) KZDoc.dirty = false;
        window.location.href = 'gui.html';
      }
      return { workspace: target, switched: true };
    }

    if (method === 'studio.capture_preview') {
      return isGui ? await captureGuiPreview(params.scale) : await captureHudPreview(params.scale);
    }

    if (method === 'studio.undo') {
      if (isGui) GS.Editor.undo();
      else App.undo();
      notify('Undo');
      return { ok: true, workspace: WORKSPACE };
    }

    if (method === 'studio.redo') {
      if (isGui) GS.Editor.redo();
      else App.redo();
      notify('Redo');
      return { ok: true, workspace: WORKSPACE };
    }

    if (method === 'studio.save') {
      if (isGui) {
        const E = GS.Editor;
        const name = params.name || (GS.Doc && GS.Doc.name) || 'My GUI';
        GS.Model.pruneImages(E.project);
        if (GS.Doc && GS.Doc.id) {
          await GS.Backend.update(GS.Doc.id, name, E.project);
          GS.Doc.markSaved(GS.Doc.id, name);
          return { projectId: GS.Doc.id, name };
        }
        const r = await GS.Backend.create(name, E.project);
        if (GS.Doc) GS.Doc.markSaved(r.projectId, name);
        return { projectId: r.projectId, name };
      }
      const id = localStorage.getItem('current_project_id');
      const name = params.name || localStorage.getItem('current_project_name') || 'My HUD';
      const res = await API.saveProject(name, getHudDataSnapshot(), { updateExisting: !!id });
      if (res.projectId) localStorage.setItem('current_project_id', res.projectId);
      localStorage.setItem('current_project_name', name);
      if (window.KZDoc) KZDoc.markClean();
      return { projectId: res.projectId || id, name };
    }

    if (method === 'studio.layout') {
      if (isGui) {
        const E = GS.Editor;
        const m = params.menu_id ? E.project.menus.find((x) => x.id === params.menu_id) : E.menu();
        if (!m) throw new Error('Menu not found');
        const ids = Array.isArray(params.element_ids) && params.element_ids.length ? new Set(params.element_ids) : new Set(E.selIds());
        const subset = ids.size ? m.elements.filter((e) => ids.has(e.id)) : m.elements;
        E.checkpoint();
        runLayoutOn(subset, params.op, { ...params, canvas_width: m.width, canvas_height: m.height }, 'gui');
        E.changed();
        await persistGuiIfSaved();
        flashElements(subset.map((e) => e.id));
        notify(`Layout ${params.op} (${subset.length} elements)`);
        return { updated: subset.length, op: params.op };
      }
      const ids = Array.isArray(params.element_ids) && params.element_ids.length
        ? new Set(params.element_ids.map(Number))
        : (App.selectedIds && App.selectedIds.length ? new Set(App.selectedIds) : null);
      const subset = ids
        ? App.elements.filter((e) => ids.has(e.id))
        : App.elements.filter((e) => (e.group || 'Main') === (App.currentGroup || 'Main'));
      App.pushHistory();
      runLayoutOn(subset, params.op, { ...params, canvas_width: 480, canvas_height: 270 }, 'hud');
      App.render();
      await persistHudIfSaved();
      flashElements(subset.map((e) => e.id));
      notify(`Layout ${params.op} (${subset.length} elements)`);
      return { updated: subset.length, op: params.op };
    }

    // ── Creative Art: WebView SVG Rasterizer ──
    if (method === 'art.render_svg') {
      return await renderSvgToPng(params);
    }

    // ── Live HUD Studio ──
    if (!isGui && method.startsWith('hud.')) {
      if (method === 'hud.get_project') {
        return {
          _id: localStorage.getItem('current_project_id') || null,
          name: localStorage.getItem('current_project_name') || 'Untitled',
          data: getHudDataSnapshot(),
        };
      }
      if (method === 'hud.open_project') {
        if (typeof window.loadProject !== 'function') throw new Error('loadProject unavailable');
        await window.loadProject(params.project_id);
        notify('Opened HUD project');
        return { opened: params.project_id, name: localStorage.getItem('current_project_name') };
      }
      if (method === 'hud.manage_group') {
        const act = params.action;
        if (act === 'list') return { groups: App.groups, currentGroup: App.currentGroup };
        App.pushHistory();
        if (act === 'add' && params.group && !App.groups.includes(params.group)) {
          App.groups.push(params.group);
          App.currentGroup = params.group;
        } else if (act === 'select' && params.group && App.groups.includes(params.group)) {
          App.currentGroup = params.group;
        } else if (act === 'rename' && params.group && params.new_name) {
          const idx = App.groups.indexOf(params.group);
          if (idx !== -1) App.groups[idx] = params.new_name;
          App.elements.forEach((e) => { if (e.group === params.group) e.group = params.new_name; });
          if (App.currentGroup === params.group) App.currentGroup = params.new_name;
        } else if (act === 'delete' && params.group && App.groups.length > 1) {
          App.elements = App.elements.filter((e) => e.group !== params.group);
          App.groups = App.groups.filter((g) => g !== params.group);
          if (App.currentGroup === params.group) App.currentGroup = App.groups[0];
        }
        App.render();
        await persistHudIfSaved();
        return { groups: App.groups, currentGroup: App.currentGroup };
      }
      if (method === 'hud.add_element') {
        App.pushHistory();
        const el = createHudElementSilent(params.type, params);
        App.selectElement(el.id);
        App.render();
        await persistHudIfSaved();
        flashElements([el.id]);
        notify(`Added ${el.type} "${el.name}"`);
        return el;
      }
      if (method === 'hud.update_element') {
        const el = App.elements.find((e) => e.id === Number(params.element_id));
        if (!el) throw new Error(`HUD element not found: ${params.element_id}`);
        App.pushHistory();
        const { id: _id, type: _t, ...patch } = params.patch || {};
        App.updateElement(el.id, patch);
        App.render();
        await persistHudIfSaved();
        flashElements([el.id]);
        notify(`Updated "${el.name}"`);
        return App.elements.find((e) => e.id === el.id);
      }
      if (method === 'hud.delete_element') {
        const id = Number(params.element_id);
        if (!App.elements.some((e) => e.id === id)) throw new Error(`HUD element not found: ${id}`);
        App.removeElement(id);
        await persistHudIfSaved();
        notify(`Deleted element #${id}`);
        return { deleted: id };
      }
      if (method === 'hud.batch_elements') {
        App.pushHistory();
        const results = [];
        const touched = [];
        for (const item of params.operations || []) {
          const op = item.op || 'add';
          if (op === 'add') {
            const el = createHudElementSilent(item.type, item);
            results.push({ op: 'add', id: el.id, name: el.name });
            touched.push(el.id);
          } else if (op === 'update') {
            const el = App.elements.find((e) => e.id === Number(item.element_id ?? item.id));
            if (el) {
              Object.assign(el, item.patch || {});
              results.push({ op: 'update', id: el.id });
              touched.push(el.id);
            }
          } else if (op === 'delete') {
            const id = Number(item.element_id ?? item.id);
            App.elements = App.elements.filter((e) => e.id !== id);
            results.push({ op: 'delete', id });
          }
        }
        App.selectedIds = touched.length ? [touched[touched.length - 1]] : [];
        App.render();
        await persistHudIfSaved();
        flashElements(touched);
        notify(`Batch updated ${results.length} HUD items`);
        return { count: results.length, results };
      }
      if (method === 'hud.set_widgets') {
        if (!window.Widgets || typeof Widgets.setWidgetsImageData !== 'function') throw new Error('Widgets module unavailable');
        Widgets.setWidgetsImageData(params.imageData);
        App.render();
        await persistHudIfSaved();
        notify('Updated custom widgets.png hotbar');
        return { ok: true };
      }
    }

    // ── Live GUI Studio ──
    if (isGui && method.startsWith('gui.')) {
      const E = GS.Editor;
      const M = GS.Model;
      if (method === 'gui.get_project') {
        return {
          _id: GS.Doc ? GS.Doc.id : null,
          name: GS.Doc ? GS.Doc.name : 'Untitled GUI',
          data: E.project,
        };
      }
      if (method === 'gui.open_project') {
        if (typeof GS.loadById !== 'function') throw new Error('GS.loadById unavailable');
        const ok = await GS.loadById(params.project_id, false);
        if (!ok) throw new Error(`Could not open GUI project ${params.project_id}`);
        return { opened: params.project_id, name: GS.Doc?.name };
      }
      if (method === 'gui.open_menu') {
        const idx = E.project.menus.findIndex((m) => m.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        E.selectMenu(idx);
        return { menuId: params.menu_id };
      }
      if (method === 'gui.upsert_menu') {
        const id = M.slug(params.menu_id, '');
        if (!id) throw new Error('Invalid menu_id');
        E.checkpoint();
        let idx = E.project.menus.findIndex((x) => x.id === id);
        const created = idx === -1;
        let m = created ? M.newMenu(id, params.title || id) : E.project.menus[idx];
        if (created) {
          E.project.menus.push(m);
          idx = E.project.menus.length - 1;
        }
        if (params.title !== undefined) m.title = String(params.title);
        if (params.command !== undefined) m.command = String(params.command);
        if (params.width !== undefined) m.width = M.clamp(M.int(params.width, m.width), 16, M.MAX_SIDE);
        if (params.height !== undefined) m.height = M.clamp(M.int(params.height, m.height), 16, M.MAX_SIDE);
        if (params.fullscreen !== undefined) m.fullscreen = !!params.fullscreen;
        if (params.backdrop !== undefined) m.backdrop = String(params.backdrop);
        if (params.backdrop_alpha !== undefined) m.backdropAlpha = Number(params.backdrop_alpha);
        if (params.refresh_ticks !== undefined) m.refreshTicks = Number(params.refresh_ticks);
        if (params.open_sound !== undefined) m.openSound = String(params.open_sound);
        if (params.prev_page !== undefined) m.prevPage = String(params.prev_page);
        if (params.next_page !== undefined) m.nextPage = String(params.next_page);
        E.menuIndex = idx;
        E.changed();
        await persistGuiIfSaved();
        notify(`${created ? 'Created' : 'Updated'} menu "${m.id}"`);
        return { created, menu: m };
      }
      if (method === 'gui.delete_menu') {
        if (E.project.menus.length <= 1) throw new Error('Cannot delete the last menu');
        const idx = E.project.menus.findIndex((x) => x.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        E.checkpoint();
        E.project.menus.splice(idx, 1);
        E.fixSelection();
        M.pruneImages(E.project);
        E.changed();
        await persistGuiIfSaved();
        notify(`Deleted menu "${params.menu_id}"`);
        return { deleted: params.menu_id };
      }
      if (method === 'gui.add_image') {
        E.checkpoint();
        const imageId = M.addImage(E.project, params);
        E.changed();
        await persistGuiIfSaved(false);
        return { image_id: imageId, w: params.w, h: params.h, res: params.res || 1 };
      }
      if (method === 'gui.add_element') {
        const idx = E.project.menus.findIndex((x) => x.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        const m = E.project.menus[idx];
        E.checkpoint();
        const el = M.newElement(params.type, m);
        if (params.props && typeof params.props === 'object') Object.assign(el, params.props);
        if (params.id !== undefined) el.id = String(params.id);
        if (params.name !== undefined) el.name = String(params.name);
        if (params.x !== undefined) el.x = Number(params.x);
        if (params.y !== undefined) el.y = Number(params.y);
        if (params.w !== undefined) el.w = Number(params.w);
        if (params.h !== undefined) el.h = Number(params.h);
        m.elements.push(el);
        E.menuIndex = idx;
        E.setSel([el.id], el.id);
        E.changed();
        await persistGuiIfSaved();
        flashElements([el.id]);
        notify(`Added ${el.type} "${el.name}" to ${m.id}`);
        return el;
      }
      if (method === 'gui.batch_elements') {
        const idx = E.project.menus.findIndex((x) => x.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        const m = E.project.menus[idx];
        E.checkpoint();
        const results = [];
        const touched = [];
        for (const item of params.operations || []) {
          const op = item.op || 'add';
          if (op === 'add') {
            const el = M.newElement(item.type, m);
            if (item.props && typeof item.props === 'object') Object.assign(el, item.props);
            if (item.id !== undefined) el.id = String(item.id);
            if (item.name !== undefined) el.name = String(item.name);
            if (item.x !== undefined) el.x = Number(item.x);
            if (item.y !== undefined) el.y = Number(item.y);
            if (item.w !== undefined) el.w = Number(item.w);
            if (item.h !== undefined) el.h = Number(item.h);
            m.elements.push(el);
            results.push({ op: 'add', id: el.id });
            touched.push(el.id);
          } else if (op === 'update') {
            const el = m.elements.find((e) => e.id === item.element_id);
            if (el) {
              Object.assign(el, item.patch || {});
              results.push({ op: 'update', id: el.id });
              touched.push(el.id);
            }
          } else if (op === 'delete') {
            m.elements = m.elements.filter((e) => e.id !== item.element_id);
            results.push({ op: 'delete', id: item.element_id });
          }
        }
        E.menuIndex = idx;
        if (touched.length) E.setSel([touched[touched.length - 1]], touched[touched.length - 1]);
        E.changed();
        await persistGuiIfSaved();
        flashElements(touched);
        notify(`Batch updated ${results.length} GUI items in ${m.id}`);
        return { count: results.length, results };
      }
      if (method === 'gui.update_element') {
        const idx = E.project.menus.findIndex((x) => x.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        const m = E.project.menus[idx];
        const el = m.elements.find((x) => x.id === params.element_id);
        if (!el) throw new Error(`Element not found: ${params.element_id}`);
        E.checkpoint();
        const { id: _id, type: _t, ...patch } = params.patch || {};
        Object.assign(el, patch);
        E.menuIndex = idx;
        E.setSel([el.id], el.id);
        E.changed();
        await persistGuiIfSaved();
        flashElements([el.id]);
        notify(`Updated "${el.name || el.id}"`);
        return el;
      }
      if (method === 'gui.delete_element') {
        const idx = E.project.menus.findIndex((x) => x.id === params.menu_id);
        if (idx === -1) throw new Error(`Menu not found: ${params.menu_id}`);
        const m = E.project.menus[idx];
        const ei = m.elements.findIndex((x) => x.id === params.element_id);
        if (ei === -1) throw new Error(`Element not found: ${params.element_id}`);
        E.checkpoint();
        m.elements.splice(ei, 1);
        E.fixSelection();
        M.pruneImages(E.project);
        E.changed();
        await persistGuiIfSaved();
        notify(`Deleted element "${params.element_id}"`);
        return { deleted: params.element_id };
      }
      if (method === 'gui.set_animation') {
        const m = E.project.menus.find((x) => x.id === params.menu_id);
        if (!m) throw new Error(`Menu not found: ${params.menu_id}`);
        E.checkpoint();
        if (params.target === 'menu') {
          m.motion = { ...(m.motion || {}), ...(params.motion || {}) };
        } else {
          const el = m.elements.find((x) => x.id === params.element_id);
          if (!el) throw new Error(`Element not found: ${params.element_id}`);
          el.motion = { ...(el.motion || {}), ...(params.motion || {}) };
        }
        E.changed();
        await persistGuiIfSaved();
        notify(`Updated ${params.target} animation`);
        return { ok: true, menu_id: m.id, target: params.target };
      }
      if (method === 'gui.link_menus') {
        const from = E.project.menus.find((x) => x.id === params.from_menu);
        const to = E.project.menus.find((x) => x.id === params.to_menu);
        if (!from || !to) throw new Error('Source or target menu not found');
        E.checkpoint();
        if (params.mode === 'next_page') from.nextPage = to.id;
        else if (params.mode === 'prev_page') from.prevPage = to.id;
        else if (params.mode === 'button') {
          let btn = params.button_id ? from.elements.find((e) => e.id === params.button_id && e.type === 'button') : null;
          if (!btn && params.create_button === false) throw new Error(`Button not found: ${params.button_id}`);
          if (!btn) {
            btn = M.newElement('button', from);
            btn.label = params.button_label || to.id;
            if (params.x !== undefined) btn.x = Number(params.x);
            if (params.y !== undefined) btn.y = Number(params.y);
            if (params.w !== undefined) btn.w = Number(params.w);
            if (params.h !== undefined) btn.h = Number(params.h);
            from.elements.push(btn);
          }
          const act = `open:${to.id}`;
          if (!Array.isArray(btn.actions)) btn.actions = [];
          if (!btn.actions.includes(act)) btn.actions.push(act);
        }
        E.changed();
        await persistGuiIfSaved();
        notify(`Linked ${from.id} -> ${to.id}`);
        return { from: from.id, to: to.id, mode: params.mode };
      }
    }

    throw new Error(`Method ${method} is not available in ${WORKSPACE} workspace`);
  }

  async function init() {
    ensurePill();
    if (!TAURI || !TAURI.event || typeof TAURI.event.listen !== 'function') return;

    try {
      bridgeInfo = await tauriInvoke('mcp_bridge_hello', { workspace: WORKSPACE });
    } catch (e) { /* ignore if non-Tauri preview */ }

    await TAURI.event.listen('mcp:request', async (event) => {
      const payload = event && event.payload ? event.payload : {};
      const { reqId, method, params } = payload;
      if (!reqId) return;
      pulsePill();
      try {
        const result = await dispatchRpc(method, params || {});
        await tauriInvoke('mcp_bridge_reply', { reqId, ok: true, result, error: null });
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        notify(msg, 'error');
        await tauriInvoke('mcp_bridge_reply', { reqId, ok: false, result: null, error: msg }).catch(() => {});
      }
    });
  }

  window.KZMcp = {
    openConnectDialog,
    workspace: WORKSPACE,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
