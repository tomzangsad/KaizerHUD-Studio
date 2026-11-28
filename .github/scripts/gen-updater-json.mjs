#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

const DIST_DIR = path.resolve(process.env.DIST_DIR || 'dist-desktop');
const OUT_FILE = process.env.OUT_FILE
  ? path.resolve(process.env.OUT_FILE)
  : path.join(DIST_DIR, 'latest.json');
const TAG = (process.env.RELEASE_TAG || '').trim();
const REPO = (process.env.GITHUB_REPOSITORY || 'tomzangsad/KaizerHUD-Studio').trim();

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readEnglishNotes(tag) {
  if (!tag || !fs.existsSync(CHANGELOG_PATH)) return `Release ${tag}`;
  const raw = fs.readFileSync(CHANGELOG_PATH, 'utf8').replace(/\r\n/g, '\n');
  const m = new RegExp(`^##\\s+${escapeRegExp(tag)}(?:\\b|\\s|\\().*$`, 'im').exec(raw);
  if (!m) return `Release ${tag}`;
  const after = raw.slice(m.index + m[0].length);
  const next = /^##\s+/m.exec(after);
  const section = (next ? after.slice(0, next.index) : after).trim();
  const en = /^###\s+English\b/im.exec(section);
  const scope = en
    ? (() => {
        const rest = section.slice(en.index + en[0].length);
        const nextSub = /^###\s+/m.exec(rest);
        return (nextSub ? rest.slice(0, nextSub.index) : rest).trim();
      })()
    : section;
  return scope || `Release ${tag}`;
}

function walkFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full));
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function findSignedBundle(allFiles, patterns) {
  const fileSet = new Set(allFiles);
  for (const re of patterns) {
    const match = allFiles.find(f => re.test(path.basename(f)) && fileSet.has(`${f}.sig`));
    if (match) return match;
  }
  return null;
}

function main() {
  if (!TAG) {
    console.log('RELEASE_TAG not set — skipping latest.json generation.');
    return;
  }
  if (!fs.existsSync(DIST_DIR)) {
    console.log(`DIST_DIR not found (${DIST_DIR}) — skipping latest.json generation.`);
    return;
  }

  const allFiles = walkFiles(DIST_DIR);
  const dlPrefix = `https://github.com/${REPO}/releases/download/${encodeURIComponent(TAG)}`;

  const winArtifact = findSignedBundle(allFiles, [/-setup\.exe$/i, /\.nsis\.zip$/i]);
  const linuxArtifact = findSignedBundle(allFiles, [/\.AppImage\.tar\.gz$/i, /\.AppImage$/i]);

  const platforms = {};
  if (winArtifact) {
    const name = path.basename(winArtifact);
    platforms['windows-x86_64'] = {
      signature: fs.readFileSync(`${winArtifact}.sig`, 'utf8').trim(),
      url: `${dlPrefix}/${encodeURIComponent(name)}`,
    };
  }
  if (linuxArtifact) {
    const name = path.basename(linuxArtifact);
    platforms['linux-x86_64'] = {
      signature: fs.readFileSync(`${linuxArtifact}.sig`, 'utf8').trim(),
      url: `${dlPrefix}/${encodeURIComponent(name)}`,
    };
  }

  const keys = Object.keys(platforms);
  if (!keys.length) {
    console.log('No signed updater bundle (.sig) found — skipping latest.json generation (TAURI_SIGNING_PRIVATE_KEY may not be set).');
    return;
  }

  const version = TAG.replace(/^v/, '');
  const manifest = {
    version,
    notes: readEnglishNotes(TAG),
    pub_date: new Date().toISOString(),
    platforms,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Generated updater manifest: ${OUT_FILE} (version=${version}, platforms=${keys.join(',')})`);
}

main();
