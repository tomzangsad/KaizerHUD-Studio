#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');

const TAG = (process.env.RELEASE_TAG || '').trim() || 'v1.0.0';
const REPO = (process.env.GITHUB_REPOSITORY || 'tomzangsad/KaizerHUD-Studio').trim();
const OUT_FILE = process.env.OUT_FILE || 'release-body.md';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readChangelogSection(tag) {
  if (!tag || !fs.existsSync(CHANGELOG_PATH)) return '';
  const raw = fs.readFileSync(CHANGELOG_PATH, 'utf8').replace(/\r\n/g, '\n');
  const headingRe = new RegExp(`^##\\s+${escapeRegExp(tag)}(?:\\b|\\s|\\().*$`, 'im');
  const m = headingRe.exec(raw);
  if (!m) return '';
  const after = raw.slice(m.index + m[0].length);
  const next = /^##\s+/m.exec(after);
  return (next ? after.slice(0, next.index) : after).trim();
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function readPrevTag(currentTag) {
  try {
    const tags = git(['tag', '-l', 'v*', '--sort=-v:refname'])
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    return tags.find(t => t !== currentTag) || '';
  } catch {
    return '';
  }
}

function readCommitSection(tag) {
  const prev = readPrevTag(tag);
  if (!prev) return '';
  try {
    const lines = git(['log', `${prev}..HEAD`, '--no-merges', '--pretty=format:%s'])
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    const userFacing = lines.filter(l => !/^(ci|chore)(\([^)]*\))?:/i.test(l));
    const shown = (userFacing.length ? userFacing : lines).slice(0, 20);
    const parts = [];
    if (shown.length) {
      parts.push(shown.map(s => `- ${s}`).join('\n'));
    }
    parts.push(`**Full Changelog**: https://github.com/${REPO}/compare/${prev}...${tag}`);
    return parts.join('\n\n');
  } catch {
    return '';
  }
}

function buildBody() {
  const verMatch = /^v?(\d+\.\d+\.\d+)/.exec(TAG);
  const ver = verMatch ? verMatch[1] : '*';

  const table = [
    '## What to Download / ไฟล์ไหนใช้ทำอะไร',
    '',
    '| File | English | ภาษาไทย |',
    '|---|---|---|',
    `| \`KaizerHUD-Studio_${ver}_x64-setup.exe\` | **Windows Installer** *(recommended — adds Start Menu & Desktop shortcut)* | **ตัวติดตั้ง Windows** *(แนะนำ — สร้างไอคอนหน้า Desktop / Start Menu)* |`,
    '| `kaizerhud-portable.exe` | **Portable Windows app** *(run directly without installing)* | **ตัวโปรแกรมแบบพกพา** *(เปิดใช้งานได้ทันที ไม่ต้องติดตั้ง)* |',
    '| `KaizerMultiBar-2.2.0.jar` | **HUD Studio server plugin** *(put in Paper/Purpur/Folia `plugins/`)* | **ปลั๊กอินสำหรับ HUD Studio** *(ใส่ใน `plugins/` บน Paper/Purpur/Folia 1.21.x–26.x)* |',
    '| `KaizerUI-1.0.0.jar` | **GUI Studio server plugin** *(optional — only if using cursor menus)* | **ปลั๊กอินสำหรับ GUI Studio** *(ลงเฉพาะเมื่อใช้เมนู GUI)* |',
    '',
    `> **Note:** \`Source code (zip)\` and \`Source code (tar.gz)\` are for developers only — see [docs/DEVELOPMENT.md](https://github.com/${REPO}/blob/main/docs/DEVELOPMENT.md).`,
    `> **Docs / คู่มือ:** [User Guide (EN / TH)](https://github.com/${REPO}/blob/main/docs/USER_GUIDE.md) · [Plugin Setup (EN / TH)](https://github.com/${REPO}/blob/main/plugins/README.md) · [CHANGELOG](https://github.com/${REPO}/blob/main/CHANGELOG.md)`,
    '',
    '---',
  ].join('\n');

  const fromChangelog = readChangelogSection(TAG);
  const changesText = fromChangelog || readCommitSection(TAG);

  if (!changesText) return table + '\n';

  const prev = readPrevTag(TAG);
  const compareFooter =
    fromChangelog && prev && !/\/compare\//i.test(fromChangelog)
      ? `\n\n**Full Changelog**: https://github.com/${REPO}/compare/${prev}...${TAG}`
      : '';

  return `${table}\n\n## What's Changed\n\n${changesText}${compareFooter}\n`;
}

const body = buildBody();
fs.writeFileSync(OUT_FILE, body, 'utf8');
console.log(`Prepared release notes for ${TAG} -> ${OUT_FILE} (${body.length} bytes)`);
