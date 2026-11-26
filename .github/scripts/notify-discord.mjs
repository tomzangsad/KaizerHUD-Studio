#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || process.env.DRY_RUN === '1';
const mockIdx = args.indexOf('--mock-file');
const MOCK_FILE = mockIdx !== -1 ? args[mockIdx + 1] : '';

const REPO = process.env.GITHUB_REPOSITORY || 'tomzangsad/KaizerHUD-Studio';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TAG = (process.env.RELEASE_TAG || '').trim();
const MENTION = (process.env.DISCORD_MENTION || '').trim();
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

function extractHighlights(body) {
  const raw = String(body || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  const marker = /^##\s+What's Changed\b/im.exec(raw);
  let slice = marker ? raw.slice(marker.index + marker[0].length) : raw;
  // Remove leading separator rules or boilerplate table if fallback
  const lines = slice
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => {
      const t = l.trim();
      if (!t || t === '---') return false;
      if (/^##\s+What to Download\b/i.test(t)) return false;
      if (t.startsWith('| File |') || t.startsWith('|---|') || t.startsWith('| `')) return false;
      if (t.startsWith('> **Note:**') || t.startsWith('> **Docs')) return false;
      return true;
    });
  return clip(lines.join('\n'), 1500);
}

async function loadRelease() {
  if (MOCK_FILE) {
    return JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8'));
  }
  const endpoint = (!TAG || TAG.toLowerCase() === 'latest')
    ? `https://api.github.com/repos/${REPO}/releases/latest`
    : `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(TAG)}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kaizerhud-release-notifier',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(endpoint, { headers });
  if (!res.ok) {
    throw new Error(`GitHub Releases API returned HTTP ${res.status} for ${endpoint}`);
  }
  return await res.json();
}

function buildPayload(release) {
  const tag = release.tag_name || TAG || 'latest';
  const releaseUrl = release.html_url || `https://github.com/${REPO}/releases/tag/${encodeURIComponent(tag)}`;
  const avatarUrl = `https://raw.githubusercontent.com/${REPO}/main/src-tauri/icons/icon.png`;
  const assets = Array.isArray(release.assets) ? release.assets : [];

  const setupAsset = assets.find(a => /-setup\.exe$/i.test(a.name));
  const portableAsset = assets.find(a => /portable.*\.exe$/i.test(a.name));
  const multiBarAsset = assets.find(a => /^KaizerMultiBar-.*\.jar$/i.test(a.name));
  const uiAsset = assets.find(a => /^KaizerUI-.*\.jar$/i.test(a.name));

  const winLines = [];
  if (setupAsset) {
    winLines.push(`• [**${setupAsset.name}**](${setupAsset.browser_download_url}) (${fmtBytes(setupAsset.size)}) — Installer *(แนะนำ)*`);
  }
  if (portableAsset) {
    winLines.push(`• [**${portableAsset.name}**](${portableAsset.browser_download_url}) (${fmtBytes(portableAsset.size)}) — Portable`);
  }
  if (!winLines.length) {
    winLines.push(`• [ดูไฟล์ทั้งหมดในหน้า Release](${releaseUrl})`);
  }

  const pluginLines = [];
  if (multiBarAsset) {
    pluginLines.push(`• [**${multiBarAsset.name}**](${multiBarAsset.browser_download_url}) (${fmtBytes(multiBarAsset.size)}) — HUD Studio`);
  }
  if (uiAsset) {
    pluginLines.push(`• [**${uiAsset.name}**](${uiAsset.browser_download_url}) (${fmtBytes(uiAsset.size)}) — GUI Studio`);
  }
  if (!pluginLines.length) {
    pluginLines.push(`• [ดูปลั๊กอินทั้งหมดในหน้า Release](${releaseUrl})`);
  }

  const descParts = [
    `อัปเดตเวอร์ชันใหม่ **${tag}** พร้อมให้ดาวน์โหลดแล้ว!`,
  ];
  if (EXTRA_NOTE) descParts.push(`\n> 📌 ${EXTRA_NOTE}`);
  const highlights = extractHighlights(release.body);
  if (highlights) {
    descParts.push(`\n**What's Changed / สรุปการเปลี่ยนแปลง**\n${highlights}`);
  }

  const embed = {
    author: {
      name: 'KaizerHUD Studio',
      url: `https://github.com/${REPO}`,
      icon_url: avatarUrl,
    },
    title: clip(`🚀 KaizerHUD Studio ${tag} Released!`, 256),
    url: releaseUrl,
    color: 0xf2c86c,
    thumbnail: { url: avatarUrl },
    description: clip(descParts.join('\n'), 4096),
    fields: [
      {
        name: '🖥️ Windows App',
        value: clip(winLines.join('\n'), 1024),
        inline: false,
      },
      {
        name: '🔌 Server Plugins (Paper / Purpur / Folia)',
        value: clip(pluginLines.join('\n'), 1024),
        inline: false,
      },
      {
        name: '📚 Guides & Developer Tools',
        value: clip([
          `[Release Page](${releaseUrl})`,
          `[Wiki (EN/TH)](https://github.com/${REPO}/wiki)`,
          `[User Guide](https://github.com/${REPO}/blob/main/docs/USER_GUIDE.md)`,
          `[Java API](https://github.com/${REPO}/blob/main/plugins/KaizerUI/API.md)`,
          `[MCP Server](https://github.com/${REPO}/blob/main/mcp-server/README.md)`,
        ].join(' · '), 1024),
        inline: false,
      },
    ],
    footer: {
      text: 'KaizerHUD Studio • Open Source (GPL-3.0)',
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
  let total = (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text?.length || 0) + (e.author?.name?.length || 0);
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
  const payload = buildPayload(release);
  const totalChars = validateDiscordEmbed(payload);

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    console.error(`[dry-run] Valid Discord embed (${totalChars} chars, ${release.assets?.length || 0} assets).`);
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
