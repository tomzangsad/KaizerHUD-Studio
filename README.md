# KaizerHUD Studio

Visual HUD & GUI Studio for **Minecraft Bedrock JSON UI** (via GeyserMC) and **Minecraft Java Edition** — 100% free and open source under **GPL-3.0**.

> **[Download Latest Release](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)** (Windows Installer / Portable `.exe` + server plugins `.jar`) · **[User Guide (EN / TH)](docs/USER_GUIDE.md)** · **[Plugin Setup (EN / TH)](plugins/README.md)** · **[Developer & Build Guide](docs/DEVELOPMENT.md)**

---

## Start Here — Choose Your Guide

| Who you are | Read this | What you'll find |
|---|---|---|
| **Server Owner / Designer** *(No coding required)* | **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** | Download Installer or Portable `.exe`, design HUDs/GUIs, export `output.zip`, and install on your server |
| **Server Admin (Plugins)** | **[plugins/README.md](plugins/README.md)** | Installing & configuring `KaizerMultiBar` and `KaizerUI` |
| **Developer / Contributor** *(Fork, Clone & Build)* | **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Prerequisites, `git clone`, dev server, unit tests, and building `.exe` / installer / `.jar` from source |

---

## Features

- **Visual HUD Designer** — Drag-and-drop canvas for images, animated flip-book sprites, status bars (health, food, armor, air, XP, custom bars), PlaceholderAPI text slots, player heads, XP level labels, nameplates, and hotbar widgets.
- **HUD Forge & Themes** — 95+ procedural pixel-art HUD presets and themes to kickstart designs in seconds.
- **GUI Studio** — Design mouse-driven menus with 3D player doll / mannequin previews, item pickers, and animation timelines that export for both Java (hologram + cursor) and Bedrock (server forms).
- **Live Code View & Folder Sync** — Inspect generated `ui/hud_screen.json`, `manifest.json`, and `config.yml` in real time, apply non-destructive overrides, and sync straight to a Bedrock `development_resource_packs` folder.
- **Java HUD Import & Export** — Import existing BetterHud / MythicHUD / HappyHUD / CustomNameplates packs and export Java HUD configs alongside your Bedrock `.mcpack`.

---

## Quick Usage (For Users — No Compiling Needed)

1. **Download** the Windows Installer (`KaizerHUD Studio_*_x64-setup.exe`) or Portable (`kaizerhud-portable.exe`), plus the companion plugin `.jar` files from **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**.
2. **Design** your HUD (or switch to **GUI Studio**) and click **Export** to save `output.zip`.
3. **Install** the exported `.mcpack`, `config.yml` / menu files, and the server plugin `.jar` onto your Paper/Purpur/Folia + Geyser server.

👉 Full step-by-step instructions (English & Thai): **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**

---

## Companion Server Plugins

| Plugin | Purpose | Guide |
|---|---|---|
| **KaizerMultiBar** (`2.1.0`) | Streams HP, food, armor, air, EXP, PAPI text, and visibility flags to Bedrock HUD packs (Paper / Purpur / Folia 1.21.x–26.x) | [plugins/README.md](plugins/README.md) |
| **KaizerUI** (`1.0.0`) | Renders GUI Studio menus as interactive holograms on Java and server forms on Bedrock | [plugins/README.md](plugins/README.md) |

---

## For Developers & Contributors

Want to fork, clone, modify the code, or build from source?

- **Setup, Clone & Build Commands:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- **System Architecture & Roadmap:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **How to Contribute (Code, Templates, Translations):** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Technical Specs Index (EN + TH):** [docs/README.md](docs/README.md)
- **Community & Support:** [Discord](https://discord.gg/rNGH2SpNs5) · [GitHub Discussions](https://github.com/tomzangsad/KaizerHUD-Studio/discussions)

---

## License & Trademarks

- **Source Code:** Licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE). If you modify and distribute this software or its plugins, you must release your modified source code under GPL-3.0 as well.
- **Trademarks:** The names **KaizerHUD Studio**, **KaizerMultiBar**, **KaizerUI**, and **KaizerMC** refer to this official project. Forks should use a distinct name for modified distributions.
