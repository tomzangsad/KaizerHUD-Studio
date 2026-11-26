#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || process.env.DRY_RUN === '1';
const mockIdx = args.indexOf('--mock-file');
const MOCK_FILE = mockIdx !== -1 ? args[mockIdx + 1] : '';

const REPO = process.env.GITHUB_REPOSITORY || 'tomzangsad/KaizerHUD-Studio';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TAG = (process.env.RELEASE_TAG || '').trim();
const RAW_MENTION = (process.env.DISCORD_MENTION || '').trim();
const MENTION = /^@&\d+$/.test(RAW_MENTION) ? `<${RAW_MENTION}>` : RAW_MENTION;
const EXTRA_NOTE = (process.env.EXTRA_NOTE || '').trim();
const RAW_WEBHOOK = (process.env.DISCORD_WEBHOOK_URL || '').trim();
const WEBHOOK_URL = RAW_WEBHOOK.replace(/\/github\/?$/i, '');

function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function clip(text, max) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 3)).trimEnd() + '...';
}

function ghHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kaizerhud-release-notifier',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API returned HTTP ${res.status} for ${url}`);
  }
  return await res.json();
}

async function loadRelease() {
  if (MOCK_FILE) {
    return JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8'));
  }
  const endpoint = (!TAG || TAG.toLowerCase() === 'latest')
    ? `https://api.github.com/repos/${REPO}/releases/latest`
    : `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(TAG)}`;
  return await fetchJson(endpoint);
}

function extractBodyBullets(body) {
  const raw = String(body || '').replace(/\r\n/g, '\n');
  const bullets = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!/^[-*]\s+/.test(t)) continue;
    let text = t.replace(/^[-*]\s+/, '').trim();
    // Trim GitHub PR attribution suffix cleanly
    text = text.replace(/\s+by\s+@\S+\s+in\s+https:\/\/\S+$/i, '').trim();
    if (!text) continue;
    bullets.push(`- ${clip(text, 140)}`);
    if (bullets.length >= 12) break;
  }
  return bullets;
}

async function resolvePrevTag(body, currentTag) {
  const cmp = /\/compare\/([^\s.]+)\.\.\./.exec(String(body || ''));
  if (cmp) return cmp[1];
  try {
    const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=10`);
    const prev = releases.find(r => !r.draft && r.tag_name && r.tag_name !== currentTag);
    return prev ? prev.tag_name : '';
  } catch {
    return '';
  }
}

async function extractChanges(release) {
  const fromBody = extractBodyBullets(release.body);
  if (fromBody.length) return fromBody;
  if (MOCK_FILE) return [];

  const tag = release.tag_name || TAG;
  const prevTag = await resolvePrevTag(release.body, tag);
  if (!prevTag || !tag) return [];

  try {
    const cmp = await fetchJson(
      `https://api.github.com/repos/${REPO}/compare/${encodeURIComponent(prevTag)}...${encodeURIComponent(tag)}`
    );
    const commits = Array.isArray(cmp.commits) ? cmp.commits : [];
    const subjects = [];
    for (const c of commits) {
      const msg = String(c?.commit?.message || '').split('\n')[0].trim();
      if (!msg || /^Merge\b/i.test(msg)) continue;
      subjects.push(msg);
    }
    const maxItems = 12;
    const shown = subjects.slice(0, maxItems).map(s => `- ${clip(s, 140)}`);
    if (subjects.length > maxItems) {
      shown.push(`- ... and ${subjects.length - maxItems} more changes`);
    }
    return shown;
  } catch {
    return [];
  }
}

function formatAssets(assets, releaseUrl) {
  const list = Array.isArray(assets) ? [...assets] : [];
  if (!list.length) {
    return [`- [View Release Files](${releaseUrl})`];
  }

  const labelFor = (name) => {
    if (/-setup\.exe$/i.test(name)) return { rank: 1, label: 'Windows Installer' };
    if (/portable.*\.exe$/i.test(name)) return { rank: 2, label: 'Windows Portable' };
    if (/^KaizerMultiBar-.*\.jar$/i.test(name)) return { rank: 3, label: 'HUD Plugin' };
    if (/^KaizerUI-.*\.jar$/i.test(name)) return { rank: 4, label: 'GUI Plugin' };
    return { rank: 5, label: '' };
  };

  list.sort((a, b) => labelFor(a.name).rank - labelFor(b.name).rank);

  return list.map(a => {
    const { label } = labelFor(a.name);
    const suffix = label ? ` - ${label}` : '';
    return `- [${a.name}](${a.browser_download_url}) (${fmtBytes(a.size)})${suffix}`;
  });
}

function buildPayload(release, changes) {
  const tag = release.tag_name || TAG || 'latest';
  const releaseUrl = release.html_url || `https://github.com/${REPO}/releases/tag/${encodeURIComponent(tag)}`;
  const avatarUrl = `https://raw.githubusercontent.com/${REPO}/main/src-tauri/icons/icon.png`;

  const descSections = [];
  if (EXTRA_NOTE) descSections.push(EXTRA_NOTE);
  if (changes.length) descSections.push(`**Changes**\n${changes.join('\n')}`);
  if (!descSections.length) descSections.push(`Release ${tag} is now available.`);

  const embed = {
    title: clip(`KaizerHUD Studio ${tag}`, 256),
    url: releaseUrl,
    color: 0xf2c86c,
    thumbnail: { url: avatarUrl },
    description: clip(descSections.join('\n\n'), 4096),
    fields: [
      {
        name: 'Downloads',
        value: clip(formatAssets(release.assets, releaseUrl).join('\n'), 1024),
        inline: false,
      },
    ],
    footer: {
      text: 'KaizerHUD Studio',
    },
    timestamp: release.published_at || new Date().toISOString(),
  };

  return {
    username: 'KaizerHUD Studio',
    avatar_url: avatarUrl,
    ...(MENTION ? { content: MENTION } : {}),
    embeds: [embed],
  };
}

function validateDiscordEmbed(payload) {
  const e = payload.embeds[0];
  if (!e.title || e.title.length > 256) throw new Error('Embed title exceeds 256 chars');
  if (e.description && e.description.length > 4096) throw new Error('Embed description exceeds 4096 chars');
  if (e.fields.length > 25) throw new Error('Embed exceeds 25 fields');
  let total = (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text?.length || 0);
  for (const f of e.fields) {
    if (!f.name || f.name.length > 256) throw new Error(`Field name invalid length: ${f.name}`);
    if (!f.value || f.value.length > 1024) throw new Error(`Field value exceeds 1024 chars: ${f.name}`);
    total += f.name.length + f.value.length;
  }
  if (total > 6000) throw new Error(`Total embed characters (${total}) exceed Discord limit 6000`);
  return total;
}

async function main() {
  if (!DRY_RUN && !WEBHOOK_URL) {
    console.log('DISCORD_WEBHOOK_URL secret is not set — skipping Discord notification.');
    return;
  }

  const release = await loadRelease();
  const changes = await extractChanges(release);
  const payload = buildPayload(release, changes);
  const totalChars = validateDiscordEmbed(payload);

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    console.error(`[dry-run] Valid Discord embed (${totalChars} chars, ${changes.length} changes, ${release.assets?.length || 0} assets).`);
    return;
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed with HTTP ${res.status}: ${clip(bodyText, 300)}`);
  }
  console.log(`Discord notification sent for ${release.tag_name || TAG} (HTTP ${res.status}).`);
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
