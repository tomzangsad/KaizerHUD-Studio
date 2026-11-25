# KaizerHUD Studio

Visual HUD & GUI Studio for **Minecraft Bedrock JSON UI** (via GeyserMC) and **Minecraft Java Edition** — built with **Rust / Tauri** and **Java (Paper / Geyser)**.

> All source code and companion plugins are 100% free and open source under **GPL-3.0**. Technical docs, issue templates, and the in-app wiki are available in both **English** and **Thai** ([docs/README.md](docs/README.md)).

---

## Features

- **Visual HUD Designer (`ui/index.html`)** — Drag-and-drop canvas for images, animated flip-book sprites, status bars (health, food, armor, air, XP, custom bars), PlaceholderAPI text slots, player heads, XP level labels, nameplates, and hotbar widgets.
- **HUD Forge & Themes** — Built-in HUD templates and theme presets to kickstart designs quickly.
- **GUI Studio (`ui/gui.html`)** — Design interactive menus with 3D player doll / mannequin previews, item pickers, and animation timelines that export for both Java (hologram + cursor) and Bedrock (server forms).
- **Live Code View & Folder Sync** — Inspect generated `ui/hud_screen.json`, `manifest.json`, and `config.yml` in real time, apply non-destructive override patches, and live-sync directly into a Bedrock `development_resource_packs` folder.
- **Java HUD Import & Export** — Import existing BetterHud / MythicHUD packs and export configs alongside your Bedrock `.mcpack`.
- **Companion Server Plugins (`plugins/`)** — Zero-license, open-source Paper/Folia/Geyser plugins (`KaizerMultiBar`, `KaizerMultiBarGeyser`, and `KaizerUI`) supporting bossbar or hidden-title data channels.

---

## Repository Layout

| Path | Description |
|---|---|
| `src-tauri/` | Rust / Tauri desktop backend (JSON UI codegen, `.mcpack` export, GUI Studio, Java HUD import/export, local storage) |
| `ui/` | Desktop editor frontend (vanilla HTML, CSS, JavaScript) |
| `plugins/KaizerMultiBar/` | Paper/Purpur/Folia 1.21.x–26.x plugin that streams HUD stats & PAPI data to Bedrock players |
| `plugins/KaizerMultiBarGeyser/` | Geyser extension that keeps KaizerMultiBar's boss bar on top for Bedrock clients |
| `plugins/KaizerUI/` | Companion plugin for GUI Studio cursor menus (Java holograms + Bedrock forms) |
| `docs/` | Technical design notes and subsystem documentation |

---

## Quick Start (Build from Source)

### 1. Desktop App (Rust / Tauri)

**Prerequisites:**
- [Rust toolchain](https://rustup.rs/) (`stable`)
- On Windows: Visual Studio C++ Build Tools (WebView2 is included in Windows 10/11)

**Run unit tests:**
```powershell
cd src-tauri
cargo test --lib
```

**Run in dev mode** (loads `ui/` from a local dev server for fast iteration):
```powershell
.\dev_kaizerhud.bat
```

**Build standalone release executable:**
```powershell
cd src-tauri
cargo build --release
```
Output: `src-tauri/target/release/kaizerhud.exe`

### 2. Server Plugins (Java 21 + Maven)

**Prerequisites:** JDK 21+ and Maven 3.9+ (or use the Windows batch helpers `build_kaizermultibar.bat` / `build_kaizerui.bat`, which locate JDK 21+ and download portable Maven if needed).

```powershell
# KaizerMultiBar
cd plugins/KaizerMultiBar
mvn -B clean package

# KaizerMultiBarGeyser
cd plugins/KaizerMultiBarGeyser
mvn -B clean package

# KaizerUI
cd plugins/KaizerUI
mvn -B clean package
```

See [plugins/README.md](plugins/README.md) for server installation details and dependencies (`Geyser`, `Floodgate`, `PlaceholderAPI`, `PacketEvents`).

---

## Contributing

Contributions of all kinds are welcome — you don't even have to write Rust or Java!

- **Developers:** Bug fixes, cross-platform support (macOS/Linux), refactoring, new Java HUD importers/exporters.
- **Designers & Creators:** Original HUD/GUI templates, icons, themes (must be original work or CC0/compatible open licenses).
- **Translators & Writers:** UI localization (i18n), wiki improvements, tutorials.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md) before opening a Pull Request.

---

## License & Trademarks

- **Source Code:** Licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE). If you modify and distribute this software or its plugins, you must release your modified source code under GPL-3.0 as well.
- **Trademarks:** The names **KaizerHUD Studio**, **KaizerMultiBar**, **KaizerUI**, and **KaizerMC** refer to this official project. Forks should use a distinct name for modified distributions so users are not confused.
