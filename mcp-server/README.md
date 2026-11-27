# KaizerHUD Studio Unified MCP Server (`kaizer-studio-mcp` v2.0)

Zero-dependency Node.js (`>= 18`) Model Context Protocol (MCP) stdio server for **KaizerHUD Studio** — supporting **both HUD Studio and GUI Studio**, a **Creative Art Engine** (so AI designs from scratch in any aesthetic instead of copying templates), and a **Real-Time Live Bridge** to watch AI build inside your open window.

## Requirements

- **Node.js 18+** (uses built-in Node standard modules only — no `npm install` needed).

## Quick Setup

Add the server to your MCP client configuration (replace `<path-to-KaizerHUD-Studio>` with your local path, or open **Help > Connect AI (MCP)…** inside the desktop app for a 1-click copy):

```json
{
  "mcpServers": {
    "kaizer-studio": {
      "command": "node",
      "args": [
        "<path-to-KaizerHUD-Studio>/mcp-server/index.mjs"
      ]
    }
  }
}
```

### Real-Time Live Mode vs Offline Fallback

- **Live Mode (KaizerHUD Studio open):** The desktop app runs a localhost RPC bridge on `127.0.0.1` (`mcp_bridge.json` with a per-launch random Bearer token). Every `hud_*`, `gui_*`, `studio_*`, and `art_*` call updates the open Canvas immediately with element highlight pulses, toast feedback, and `Ctrl+Z` Undo support.
- **Offline Fallback (App closed):** Reads and writes directly to `projects/` (HUD) and `gui_projects/` (GUI).

## Tool Categories

### 1. Studio Live & Vision (`studio_*`)
- `studio_status` — Inspect live connection, active workspace (`hud`/`gui`), open project, active group/menu, and selection
- `studio_switch_workspace` — Switch live window between `hud` and `gui`
- `studio_capture_preview` — Capture a real-time PNG screenshot of the open HUD/GUI canvas for visual AI inspection
- `studio_layout_helper` — Align, distribute, stack, mirror, or snap elements to grid
- `studio_undo` / `studio_redo` / `studio_save`

### 2. Creative Art Engine (`art_*` — Design From Scratch in Any Style)
- `art_render_svg` — Render arbitrary AI-authored SVG markup (gradients, paths, glows, ornaments) to PNG via WebView Canvas
- `art_draw_pixel_art` — Palette + character-grid pixel art with mirror symmetry, auto-outline, and integer scale
- `art_compose_layers` — Procedural RGBA layer composer (`chamfer_rect`, `rounded_rect`, `linear_gradient`, `radial_glow`, `border[cyber_brackets|ornate_corners|bevel|double]`, `scanlines`, `texture_noise`, `gems`, `drop_shadow`, etc.)
- `art_generate_bar_set` — Custom 17-frame (`0..16`) HUD status bar generator (horizontal/vertical, chamfer/slanted/segmented + status variants)
- `art_generate_animation` — Multi-frame flipbook animation generator (`pulse_glow`, `shimmer_sweep`, `spin_gem`, `flicker_flame`, `scan_radar`, or custom frames)
- `art_generate_widgets` — Custom `256×256` Bedrock `widgets.png` hotbar generator
- `art_import_file` — Import local `.png`/`.webp`/`.jpg` into HUD or GUI

### 3. HUD Studio (`hud_*`)
- `hud_list_projects`, `hud_get_project`, `hud_create_project`, `hud_open_project`, `hud_delete_project`
- `hud_manage_group` (`list`, `add`, `select`, `rename`, `delete`)
- `hud_add_element`, `hud_update_element`, `hud_delete_element`, `hud_batch_elements`
- `hud_inspect_budget` (Multi-Bank Title byte check across 1–8 banks), `hud_validate`, `hud_preview_code` (`ui/hud_screen.json` + `config.yml`), `hud_export_pack` (`output.zip` or `development_resource_packs` sync)

### 4. GUI Studio (All 17 Original Tools + Live Upgrades)
- `list_projects`, `get_project`, `create_project`, `delete_project`, `gui_open_project`, `gui_open_menu`
- `list_menus`, `get_menu`, `upsert_menu`, `delete_menu`
- `add_element`, `gui_batch_elements`, `update_element`, `delete_element`, `gui_set_animation`
- `link_menus`, `get_ui_flow`, `generate_panel_image`, `add_image_from_file`, `validate_project`, `export_plugin_yaml`

## Verification

```bash
node mcp-server/test.mjs
```
