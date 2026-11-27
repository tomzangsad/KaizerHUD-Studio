import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const APP_ID = 'xyz.kaizermc.hudmaker';

/**
 * Resolves the GUI Studio projects folder (`gui_projects/`), matching Tauri's `app_data_dir`.
 */
export function resolveProjectsDir() {
  if (process.env.KAIZER_GUI_PROJECTS_DIR) {
    return path.resolve(process.env.KAIZER_GUI_PROJECTS_DIR);
  }
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, APP_ID, 'gui_projects');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', APP_ID, 'gui_projects');
  }
  const xdg = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return path.join(xdg, APP_ID, 'gui_projects');
}

export function resolveCustomAssetsDir() {
  if (process.env.KAIZER_CUSTOM_ASSETS_DIR) {
    return path.resolve(process.env.KAIZER_CUSTOM_ASSETS_DIR);
  }
  return path.join(path.dirname(resolveProjectsDir()), 'custom_assets');
}

export function sanitizeName(name) {
  let out = String(name || '').trim().replace(/[<>:"/\\|?*]/g, '_').replace(/\.+$/, '');
  out = out.replace(/\s+/g, ' ').slice(0, 100);
  return out || 'untitled';
}

export function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9]+$/.test(id);
}

function newId() {
  const ts = Math.floor(Date.now() / 1000) >>> 0;
  return ts.toString(16).padStart(8, '0') + crypto.randomBytes(8).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

export class ProjectStorage {
  constructor(dir = resolveProjectsDir()) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  filePath(id) {
    if (!validId(id)) throw new Error(`Invalid project id: ${id}`);
    return path.join(this.dir, `${id}.json`);
  }

  readRaw(id) {
    const p = this.filePath(id);
    if (!fs.existsSync(p)) throw new Error(`Project not found: ${id}`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  writeRaw(id, record) {
    const p = this.filePath(id);
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record), 'utf8');
    fs.renameSync(tmp, p);
  }

  listProjects() {
    fs.mkdirSync(this.dir, { recursive: true });
    const out = [];
    for (const file of fs.readdirSync(this.dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const v = JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf8'));
        out.push({
          _id: v._id ?? null,
          name: v.name ?? null,
          updatedAt: v.updatedAt ?? null,
          createdAt: v.createdAt ?? null,
        });
      } catch {
        // skip unreadable files
      }
    }
    out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return out;
  }

  getProject(id) {
    return this.readRaw(id);
  }

  createProject(name, data) {
    const id = newId();
    const now = nowIso();
    const rec = {
      _id: id,
      name: sanitizeName(name),
      data,
      createdAt: now,
      updatedAt: now,
    };
    this.writeRaw(id, rec);
    return rec;
  }

  updateProject(id, name, data) {
    const rec = this.readRaw(id);
    const nextName = name ? sanitizeName(name) : sanitizeName(rec.name || 'untitled');
    rec.name = nextName;
    rec.data = data;
    rec.updatedAt = nowIso();
    this.writeRaw(id, rec);
    return rec;
  }

  deleteProject(id) {
    const p = this.filePath(id);
    if (!fs.existsSync(p)) throw new Error(`Project not found: ${id}`);
    fs.unlinkSync(p);
    return { deleted: id };
  }
}
