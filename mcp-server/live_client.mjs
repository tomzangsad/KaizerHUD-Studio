import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const APP_ID = 'xyz.kaizermc.hudmaker';

export function resolveAppDataDir() {
  if (process.env.KAIZER_APP_DATA_DIR) {
    return path.resolve(process.env.KAIZER_APP_DATA_DIR);
  }
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, APP_ID);
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_ID);
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(xdg, APP_ID);
}

export function resolveBridgeFilePath() {
  if (process.env.KAIZER_MCP_BRIDGE_FILE) {
    return path.resolve(process.env.KAIZER_MCP_BRIDGE_FILE);
  }
  return path.join(resolveAppDataDir(), 'mcp_bridge.json');
}

export function readBridgeInfo() {
  const file = resolveBridgeFilePath();
  if (!fs.existsSync(file)) return null;
  try {
    const info = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!info || !info.port || !info.token) return null;
    return { ...info, bridgeFile: file };
  } catch {
    return null;
  }
}

export async function getLiveStatus(timeoutMs = 1000) {
  const info = readBridgeInfo();
  if (!info) return { live: false };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${info.token}` },
      signal: ac.signal,
    });
    if (!res.ok) return { live: false };
    const data = await res.json();
    if (!data || !data.ok) return { live: false };
    return {
      live: true,
      port: info.port,
      pid: data.pid ?? info.pid,
      workspace: data.workspace || 'hud',
      version: data.version || info.version || '1.0.4',
    };
  } catch {
    return { live: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function callLive(method, params = {}, timeoutMs = 20000) {
  const info = readBridgeInfo();
  if (!info) {
    throw new Error('KaizerHUD Studio desktop app is not running (mcp_bridge.json not found)');
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${info.port}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${info.token}`,
      },
      body: JSON.stringify({ method, params }),
      signal: ac.signal,
    });
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from Live Bridge (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok || !payload.ok) {
      throw new Error(payload?.error || `Live Bridge error (HTTP ${res.status})`);
    }
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}
