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

function readPomVersion(relPath, fallback) {
  try {
    const xml = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    const clean = xml.replace(/<parent>[\s\S]*?<\/parent>/gi, '').replace(/<dependencies>[\s\S]*?<\/dependencies>/gi, '');
    const m = /<version>\s*([^<\s]+)\s*<\/version>/i.exec(clean);
    return m ? m[1].trim() : fallback;
  } catch {
    return fallback;
  }
}

function buildBody() {
  const verMatch = /^v?(\d+\.\d+\.\d+)/.exec(TAG);
  const ver = verMatch ? verMatch[1] : '*';
  const mbVer = readPomVersion('plugins/KaizerMultiBar/pom.xml', '2.2.0');
  const uiVer = readPomVersion('plugins/KaizerUI/pom.xml', '1.2.0');
  const dlBase = `https://github.com/${REPO}/releases/download/${encodeURIComponent(TAG)}`;

  const setupFile = `KaizerHUD-Studio_${ver}_x64-setup.exe`;
  const mbFile = `KaizerMultiBar-${mbVer}.jar`;
  const uiFile = `KaizerUI-${uiVer}.jar`;
  const portableFile = 'kz-kaizerhud-portable.exe';

  const table = [
    '> [!IMPORTANT]',
    '> **Recommended Update (' + TAG + '):** Install this version using **`' + setupFile + '`** (Windows Installer) so future versions update automatically via the **In-App Auto-Updater**. Update server plugins (**`' + mbFile + '`** & **`' + uiFile + '`**) to stay in sync.',
    '> **แนะนำให้อัปเดตเป็นเวอร์ชันนี้ (' + TAG + '):** ติดตั้งผ่าน **`' + setupFile + '`** เพื่อให้เวอร์ชันถัดไปกดอัปเดตในตัวโปรแกรมได้ทันที และอัปเดตปลั๊กอินเซิร์ฟเวอร์ (**`' + mbFile + '`** และ **`' + uiFile + '`**) ให้ตรงกันครับ',
    '',
    '## Downloads / ลำดับไฟล์ดาวน์โหลด',
    '',
    '| # | File | English | ภาษาไทย |',
    '|---|---|---|---|',
    `| 1 | [\`${setupFile}\`](${dlBase}/${encodeURIComponent(setupFile)}) | **Windows Installer** *(Recommended — In-App Auto-Updater)* | **ตัวติดตั้ง Windows** *(แนะนำ — รองรับอัปเดตอัตโนมัติในแอป)* |`,
    `| 2 | [\`${mbFile}\`](${dlBase}/${encodeURIComponent(mbFile)}) | **HUD Studio server plugin** *(Paper/Purpur/Folia \`plugins/\`)* | **ปลั๊กอินสำหรับ HUD Studio** *(ใส่ใน \`plugins/\`)* |`,
    `| 3 | [\`${uiFile}\`](${dlBase}/${encodeURIComponent(uiFile)}) | **GUI Studio server plugin** *(updated for ${ver})* | **ปลั๊กอินสำหรับ GUI Studio** *(อัปเดตให้ตรงเวอร์ชัน ${ver})* |`,
    `| 4 | [\`${portableFile}\`](${dlBase}/${encodeURIComponent(portableFile)}) | **Portable Windows app** *(run directly without installing)* | **ตัวโปรแกรมแบบพกพา** *(เปิดใช้ได้ทันที ไม่ต้องติดตั้ง)* |`,
    '',
    '> **Other files (`latest.json`, `Source code`):** `latest.json` is used automatically by the In-App Auto-Updater, and `Source code (zip/tar.gz)` are for developers ([docs/DEVELOPMENT.md](https://github.com/' + REPO + '/blob/main/docs/DEVELOPMENT.md)).',
    '> **Docs / คู่มือ:** [User Guide (EN / TH)](https://github.com/' + REPO + '/blob/main/docs/USER_GUIDE.md) · [Plugin Setup (EN / TH)](https://github.com/' + REPO + '/blob/main/plugins/README.md) · [CHANGELOG](https://github.com/' + REPO + '/blob/main/CHANGELOG.md)',
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
