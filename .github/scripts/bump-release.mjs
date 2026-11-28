#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const rawTarget = args.find(a => !a.startsWith('-')) || '';

function git(cmdArgs) {
  return execFileSync('git', cmdArgs, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function bumpPatch(semver) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(semver || '').trim());
  if (!m) throw new Error(`Invalid semver: ${semver}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function cmpSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function latestTag() {
  try {
    const out = git(['tag', '-l', 'v*', '--sort=-v:refname']);
    return out.split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
  } catch {
    return '';
  }
}

function hasChanges(prevTag, watchPaths) {
  try {
    if (prevTag) {
      const committed = git(['diff', '--name-only', `${prevTag}..HEAD`, '--', ...watchPaths]);
      if (committed.length > 0) return true;
    }
    const dirty = git(['status', '--porcelain', '--', ...watchPaths]);
    if (dirty.length > 0) return true;
  } catch {
    return true;
  }
  return !prevTag;
}

function readPomVersionFromText(xml) {
  const m = /<artifactId>[^<]+<\/artifactId>\s*<version>\s*([^<\s]+)\s*<\/version>/i.exec(xml);
  if (!m) throw new Error('Could not locate project <version> in pom.xml');
  return m[1].trim();
}

function writePomVersion(pomPath, newVer) {
  const abs = path.join(REPO_ROOT, pomPath);
  const raw = fs.readFileSync(abs, 'utf8');
  const next = raw.replace(
    /(<artifactId>[^<]+<\/artifactId>\s*<version>\s*)([^<\s]+)(\s*<\/version>)/i,
    `$1${newVer}$3`
  );
  fs.writeFileSync(abs, next, 'utf8');
}

function readTagPomVersion(prevTag, pomPath) {
  if (!prevTag) return '';
  try {
    const xml = git(['show', `${prevTag}:${pomPath}`]);
    return readPomVersionFromText(xml);
  } catch {
    return '';
  }
}

function readStudioVersion() {
  const conf = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src-tauri/tauri.conf.json'), 'utf8'));
  return String(conf.version || '1.0.0').trim();
}

function writeStudioVersion(newVer) {
  const confPath = path.join(REPO_ROOT, 'src-tauri/tauri.conf.json');
  const confRaw = fs.readFileSync(confPath, 'utf8');
  fs.writeFileSync(confPath, confRaw.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${newVer}"`), 'utf8');

  const cargoPath = path.join(REPO_ROOT, 'src-tauri/Cargo.toml');
  const cargoRaw = fs.readFileSync(cargoPath, 'utf8');
  fs.writeFileSync(cargoPath, cargoRaw.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVer}"`), 'utf8');
}

function syncExportJarName(newUiVer) {
  const exportPath = path.join(REPO_ROOT, 'ui/js/guistudio/gs_export.js');
  const raw = fs.readFileSync(exportPath, 'utf8');
  const next = raw.replace(/KaizerUI-\d+\.\d+\.\d+\.jar/g, `KaizerUI-${newUiVer}.jar`);
  if (next !== raw) fs.writeFileSync(exportPath, next, 'utf8');
}

function main() {
  const prevTag = latestTag();
  const curStudio = readStudioVersion();
  const targetStudio = rawTarget ? rawTarget.replace(/^v/, '') : bumpPatch(curStudio);
  if (!/^\d+\.\d+\.\d+$/.test(targetStudio)) {
    throw new Error(`Invalid target Studio version: ${targetStudio}`);
  }

  const plugins = [
    {
      name: 'KaizerUI',
      pom: 'plugins/KaizerUI/pom.xml',
      watch: ['plugins/KaizerUI/src', 'plugins/KaizerUI/resources'],
      onUpdated: (v) => syncExportJarName(v),
    },
    {
      name: 'KaizerMultiBar',
      pom: 'plugins/KaizerMultiBar/pom.xml',
      watch: ['plugins/KaizerMultiBar/src'],
      onUpdated: null,
    },
  ];

  const rows = [];
  if (!DRY_RUN && targetStudio !== curStudio) {
    writeStudioVersion(targetStudio);
  }
  rows.push({
    name: 'KaizerHUD Studio',
    from: curStudio,
    to: targetStudio,
    status: targetStudio === curStudio ? 'UNCHANGED' : 'UPDATED',
  });

  for (const pl of plugins) {
    const curXml = fs.readFileSync(path.join(REPO_ROOT, pl.pom), 'utf8');
    const curVer = readPomVersionFromText(curXml);
    const prevVer = readTagPomVersion(prevTag, pl.pom);
    const changed = hasChanges(prevTag, pl.watch);

    if (changed && prevVer && cmpSemver(curVer, prevVer) > 0) {
      if (!DRY_RUN && pl.onUpdated) pl.onUpdated(curVer);
      rows.push({ name: pl.name, from: prevVer, to: curVer, status: `ALREADY BUMPED (since ${prevTag})` });
    } else if (changed) {
      const nextVer = bumpPatch(curVer);
      if (!DRY_RUN) {
        writePomVersion(pl.pom, nextVer);
        if (pl.onUpdated) pl.onUpdated(nextVer);
      }
      rows.push({ name: pl.name, from: curVer, to: nextVer, status: 'UPDATED' });
    } else {
      rows.push({ name: pl.name, from: curVer, to: curVer, status: 'UNCHANGED' });
    }
  }

  console.log(`Base tag: ${prevTag || '(none)'}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  for (const r of rows) {
    const verStr = r.from === r.to ? r.to : `${r.from} -> ${r.to}`;
    console.log(`- ${r.name.padEnd(18)} ${verStr.padEnd(18)} [${r.status}]`);
  }
}

main();
