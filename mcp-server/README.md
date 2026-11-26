# KaizerUI GUI Studio MCP Server (`kaizer-gui-mcp`)

Zero-dependency Node.js (`>= 18`) Model Context Protocol (MCP) stdio server for **GUI Studio Desktop**.  
Allows AI assistants (Antigravity, Claude Desktop, Cursor, etc.) to create, inspect, design, generate RGBA PNG graphics for, link, validate, and export GUI Studio projects directly inside the desktop app's `gui_projects/` directory.

## Requirements

- **Node.js 18+** (uses built-in `node:zlib`, `node:crypto`, `node:fs`, `node:readline` only — no `npm install` needed).

## Quick Setup

Add the server to your MCP client configuration (replace the path with your local checkout path):

### Antigravity / Claude Desktop / Cursor (`mcp_config.json` or `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "kaizer-gui": {
      "command": "node",
      "args": [
        "<path-to-KaizerHUD-Studio>/mcp-server/index.mjs"
      ]
    }
  }
}
```

Optional environment variable:
- `KAIZER_GUI_PROJECTS_DIR`: Override the default `gui_projects/` directory (default matches Tauri's `app_data_dir` for `xyz.kaizermc.hudmaker`, e.g. `%APPDATA%/xyz.kaizermc.hudmaker/gui_projects` on Windows).

## Available MCP Tools (17)

| Category | Tool | Description |
| --- | --- | --- |
| **Projects** | `list_projects` | List all saved projects with namespace, menu count, and image count |
| | `get_project` | Read a project record (`include_images=false` by default to save tokens) |
| | `create_project` | Create a new project with default `main` menu |
| | `delete_project` | Delete a project file |
| **Menus** | `list_menus` | List menus (`id`, `title`, `command`, size, pagination links) |
| | `get_menu` | Inspect a single menu and its elements |
| | `upsert_menu` | Create or update a menu and its properties |
| | `delete_menu` | Delete a menu and prune unused images |
| **Elements** | `add_element` | Add `image`, `button`, `text`, `player_head`, `player_model`, or `item` |
| | `update_element` | Patch fields (`label`, `actions`, `tooltip`, `x`, `y`, etc.) |
| | `delete_element` | Remove an element and prune unused images |
| **Flow & Export** | `link_menus` | Wire `next_page`, `prev_page`, or `open:<target>` buttons |
| | `get_ui_flow` | Inspect nodes, edges, broken links, and orphan pages |
| | `validate_project` | Check IDs, missing images, broken links, and empty menus |
| | `export_plugin_yaml` | Generate `studio.yml` + `menus/*.yml` (and optionally write to disk) |
| **Graphics** | `generate_panel_image` | Pure-Node PNG renderer (`panel`, `button`, `slot`, `stage` in `rpg`/`flat`/`pixel`) |
| | `add_image_from_file` | Import an external `.png` file into `project.images` |

## Available MCP Resources (2)

- `kaizer://docs/schema` — Element schema, button action syntax (including `event:<key>`), and storage directory info.
- `kaizer://projects` — Live JSON listing of projects in `gui_projects/`.

## Verification

Run the bundled end-to-end test:

```bash
node mcp-server/test.mjs
```

> **Note:** Resource pack textures/font JSONs (`assets/<ns>/font/gui.json`) are still built when clicking **Export** inside GUI Studio Desktop. `export_plugin_yaml` exports the plugin configuration YAML (`studio.yml` and `menus/*.yml`).
