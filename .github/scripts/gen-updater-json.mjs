#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

const DIST_DIR = path.resolve(process.env.DIST_DIR || 'dist-desktop');
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

function main() {
  if (!TAG) {
    console.log('RELEASE_TAG not set — skipping latest.json generation.');
    return;
  }
  if (!fs.existsSync(DIST_DIR)) {
    console.log(`DIST_DIR not found (${DIST_DIR}) — skipping latest.json generation.`);
    return;
  }

  const files = fs.readdirSync(DIST_DIR);
  const candidates = [
    files.find(f => /-setup\.exe$/i.test(f) && files.includes(`${f}.sig`)),
    files.find(f => /\.nsis\.zip$/i.test(f) && files.includes(`${f}.sig`)),
  ].filter(Boolean);

  if (!candidates.length) {
    console.log('No signed updater bundle (.sig) found — skipping latest.json generation (TAURI_SIGNING_PRIVATE_KEY may not be set).');
    return;
  }

  const artifact = candidates[0];
  const signature = fs.readFileSync(path.join(DIST_DIR, `${artifact}.sig`), 'utf8').trim();
  const version = TAG.replace(/^v/, '');

  const manifest = {
    version,
    notes: readEnglishNotes(TAG),
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `https://github.com/${REPO}/releases/download/${encodeURIComponent(TAG)}/${encodeURIComponent(artifact)}`,
      },
    },
  };

  const outPath = path.join(DIST_DIR, 'latest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Generated updater manifest: ${outPath} (version=${version}, artifact=${artifact})`);
}

main();
