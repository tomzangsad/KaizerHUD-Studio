# GUI Studio & KaizerUI Plugin

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Design mouse-driven menus once in **GUI Studio** (`ui/gui.html`) and export for both **Java** and **Bedrock**:
- **Java (`plugins/KaizerUI`):** Renders menus as `TextDisplay` holograms in front of the player (`CameraHook` via PacketEvents locks the camera so mouse movement drives the cursor; left-click presses, sneak exits). Supports `Mannequin` 3D player models (Paper 1.21.9+), `ItemDisplay` items, and per-tick `Transformation` motion animations.
- **Bedrock (`ui/server_form.json`):** Sends a Geyser/Floodgate `SimpleForm` whose custom pack redraws the form with full mouse & touch layout, flip-book animations, and `paper_doll_renderer` / `gesture_x` turning.

- **Key Files:** `ui/gui.html`, `ui/css/guistudio.css`, `ui/js/guistudio/gs_*.js` (`model`, `editor`, `export`, `motion`, `assets`, `iconsets`, `templates`, `template_dialog`, `items`, `mcrender`, `shell`), `ui/js/workspace_switch.js`, and `src-tauri/src/guistudio.rs` (projects stored separately in `gui_projects/`).
- **Export Bundle:** Outputs `plugins/KaizerUI/menus/<id>.yml`, `plugins/KaizerUI/studio.yml`, `plugins/Geyser-Spigot/packs/KaizerUI_<ns>.mcpack`, Java resource pack (ItemsAdder / Nexo / Oraxen / standalone zip), and `README_KaizerUI.txt`.

---

## ภาษาไทย

# GUI Studio + ปลั๊กอิน KaizerUI (2026-11-23)

เมนูแบบใช้เมาส์ (ไม่ใช่ chest GUI) ออกแบบครั้งเดียวแล้วใช้ได้ทั้ง 2 ฝั่ง
- **Java:** ปลั๊กอินสร้าง hologram (TextDisplay) ไว้หน้าผู้เล่น ถ้ามี PacketEvents จะล็อคกล้อง แล้วการหันหัวจะกลายเป็นการขยับเคอร์เซอร์
- **Bedrock:** ส่งเป็น server form ผ่าน Floodgate/Geyser แล้ว pack วาด form ใหม่ตาม layout ทำให้ใช้เมาส์และจอสัมผัสได้จริง

**แยกจาก HUD ทั้งหมด**
- หน้าแยก `ui/gui.html`
- ไฟล์ JS/CSS ของตัวเอง
- โปรเจกต์อยู่โฟลเดอร์ `gui_projects/`
- Rust module + command ชุด `gui_*`
- ปลั๊กอินแยก `KaizerUI`

ส่วนที่ใช้ร่วมกับ HUD มีแค่:
- ธีม `shell.css`
- `desktop.js` (dialog)
- `javaexport::build_zip/decode_files` (zip)
- `storage::Storage` (คลาสเก็บไฟล์ แต่เป็นคนละ instance คนละโฟลเดอร์)

## 1. ไฟล์

| Path | หน้าที่ |
|---|---|
| `ui/gui.html` | หน้า GUI Studio (title bar / options bar / tool strip / รายการเมนู / canvas / properties / layers) |
| `ui/css/guistudio.css` | สไตล์ทั้งหมดของ GUI Studio (prefix `gs-` / `ws-`) |
| `ui/js/guistudio/gs_motion.js` | Motion: preset (Opening / Appear / Loop / Hover / Click), easing, คำนวณ keyframe — ใช้ร่วมกันทั้ง preview และ export (ดูข้อ 7) |
| `ui/js/guistudio/gs_assets.js` / `gs_iconsets.js` | Shapes & Icons: วาดรูปทรง (Pixel / 2D), icon ออฟไลน์ 2 ชุด + ค้น Iconify ออนไลน์, เครดิต (ดูข้อ 8) |
| `ui/js/guistudio/gs_model.js` | โครงข้อมูล, ค่าเริ่มต้น, normalize, validate, undo (History), รูปภาพ, backend (Tauri หรือ localStorage ตอนเทสต์ในเบราว์เซอร์) |
| `ui/js/guistudio/gs_editor.js` | canvas (ลาก/ย่อขยาย 8 จุด, snap 4px, zoom), properties, layers, หน้าเมนู, โหมด Preview (กด P) |
| `ui/js/guistudio/gs_export.js` | สร้างไฟล์ export ทั้งหมด: Java pack, Bedrock pack, `menus/*.yml`, `studio.yml`, README |
| `ui/js/guistudio/gs_templates.js` / `gs_template_dialog.js` | เทมเพลตเมนู: engine pixel art + kit + layout / หน้าต่างเลือกเทมเพลต (ดูข้อ 1.1) |
| `ui/js/guistudio/gs_shell.js` | หน้าต่าง, เมนู, คีย์ลัด, Open/Save/Export dialog, Guide, สลับกลับ HUD |
| `ui/js/workspace_switch.js` | ปุ่ม **HUD / GUI** บน title bar ของ HUD editor + เมนู File → Switch to GUI Studio (ไม่ได้แก้ shell.js) |
| `src-tauri/src/guistudio.rs` | `GuiState` (Storage ที่ `gui_projects/`), `build_export` (zip ซ้อน zip), command `gui_list/get/create/update/delete_project`, `gui_open_projects_folder`, `gui_export` + เทสต์ 3 ตัว |
| `plugins/KaizerUI/` | ปลั๊กอินเซิร์ฟเวอร์ (ดูข้อ 5) |
| `build_kaizerui.bat` | build ปลั๊กอิน (JDK 21 + Maven) |

จุดที่แก้ไฟล์เดิม (สำรองไว้ที่ `_backup_guistudio_2026-11-23/`)
- `lib.rs`: เพิ่ม `mod guistudio;`, `app.manage(GuiState)` และ command 7 ตัว
- `index.html`: เพิ่ม `<script src="js/workspace_switch.js">`

## 1.1 เทมเพลตเมนู (Menu from Template) — `gs_templates.js` + `gs_template_dialog.js`
- **เปิดได้จาก:** Insert → Menu from Template… / ปุ่มบน tool strip / คีย์ **M** / ลิงก์ในช่อง Layers ตอนหน้าว่าง
- **Layout 7 แบบ:**
  - Main Menu (ปุ่มใหญ่ 6 + Close)
  - Shop (การ์ด 4×2 + ราคา + ยอดเงิน)
  - Warps (3×2)
  - Server Selector (การ์ดสูง 3 ใบ + `%bungee_<server>%`)
  - Profile (แถว PAPI 5 แถว)
  - Daily Rewards (7 วัน)
  - Confirm (ใช่/ไม่)
  - **ชุดผู้เล่น (2026-11-24):** Leaderboard, Friends, Character, Party, Duel — ใช้ element Player Head / Player Model (ข้อ 8)
- **สี:** kit 18 ชุด ชื่อ/พาเลตเดียวกับ HUD Forge (คัดลอก ramp มา ไม่ได้โหลดไฟล์ HUD) → เมนูเข้าชุดกับ HUD ที่ทำจาก HUD Forge ได้
- **วาด pixel art ตามกฎเดียวกับ HUD Forge (ข้อ 2 ใน HUD_FORGE.md):**
  - 1 GUI px = 1 texture px
  - ramp 6 เฉด, แสงซ้ายบน, outline ใช้เฉดเข้มของวัสดุ, เงาตก 1px
  - ไม่มี gradient/noise
- **ชิ้นที่วาดได้:**
  - หน้าต่าง: rim + seam + plate, ลวดลายมุม brackets/rivets/gems, ลายไม้, เส้น accent ของ kit tech
  - ป้ายหัวเรื่อง, ช่องยุบ (well), ปุ่มนูน + รูป hover
- **ไอคอน 12×12 (19 แบบ):** coin gem heart star sword house chest compass gear check cross back flag user trophy bag portal pickaxe apple
  - ไอคอนสร้างจาก mask (วงกลม/polygon/เส้น) แล้วลงเงาอัตโนมัติ
- **ตัวเลือก:**
  - Title
  - เพิ่มเป็นหน้าใหม่ / แทนหน้าปัจจุบัน
  - **ชุดเชื่อมกัน:** Main Menu + Shop + Warps + Servers + Profile + Daily Rewards ปุ่มใน Main Menu มี `open:` และหน้าอื่นมีปุ่ม Back ใส่ให้แล้ว Main Menu ได้คำสั่ง `/menu` และ Shop ได้ `/shop`
- **ผลลัพธ์เป็น element ธรรมดา** (รูป/ปุ่ม/ข้อความ) แก้ต่อ ลาก หรือเปลี่ยนรูปได้ทุกชิ้น Undo ได้ในครั้งเดียว
- **action ตัวอย่าง:** ร้านค้าใช้ `console:eco take … / console:give …` (ไม่เช็คว่าเงินพอ), warp ใช้ `player:warp <ชื่อ>`, rewards ใช้ `player:rewards claim N` → ต้องแก้ให้ตรงกับปลั๊กอินของเซิร์ฟ
- **พรีวิวในหน้าต่าง:** วาดด้วย canvas (ข้อความวางตามความสูงตัวอักษรจริงของ Minecraftia) เลื่อนเมาส์ดูรูป hover ได้

## 2. โครงข้อมูลโปรเจกต์ (`kind: "kaizer-gui"`)

```js
{
  kind: 'kaizer-gui', version: 1,
  namespace: 'kaizerui',            // a-z0-9_ ใช้เป็น namespace ของ pack ทั้งสองฝั่ง
  menus: [{
    id: 'main', title: 'Main Menu', command: 'shop',   // command = /shop เปิดเมนูนี้ (ไม่บังคับ)
    width: 320, height: 180,                            // GUI pixel
    refreshTicks: 20, openSound: '',
    elements: [                                         // ลำดับ = layer (ตัวแรกอยู่ล่างสุด)
      { id, type: 'image',  name, x, y, w, h, image, hidden },
      { id, type: 'button', name, x, y, w, h, image, hoverImage, label, labelColor, labelScale, labelShadow,
        actions: ['console:give %player_name% diamond', 'open:shop'], closeOnClick, hoverSound },
      { id, type: 'text',   name, x, y, w, h, text, color, scale, shadow, align }
    ]
  }],
  images: { <id>: { name, data: 'data:image/png;base64,…', w, h } },
  cursor: { image: null | <id>, height: 12, hotX: 0, hotY: 0 },     // null = ลูกศรในตัว 8×12
  settings: { cameraLock, distance: 1.2, fill: 0.85, sensitivity: 1, clickSound, hoverSound, exitOnSneak },
  packUuids: { header, module },   // สร้างตอน export ครั้งแรก แล้วคงที่
  packVersion: 3                   // +1 ทุกครั้งที่ export (Geyser จะดาวน์โหลด pack ใหม่เมื่อเลขเปลี่ยน)
}
```
- Undo เก็บเฉพาะโครงสร้าง (`namespace/menus/cursor/settings`) ส่วนรูปเก็บด้วย id
- รูปที่ไม่มีใครใช้แล้วจะถูกลบตอน Save (`pruneImages`)

## 3. Export (ไฟล์ zip เดียว)

```
plugins/KaizerUI/menus/<id>.yml
plugins/KaizerUI/studio.yml
plugins/Geyser-Spigot/packs/KaizerUI_<ns>.mcpack     ← Bedrock pack (zip ซ้อน)
plugins/ItemsAdder/contents/<ns>_gui/resourcepack/   ← Java pack (ค่าเริ่มต้น ItemsAdder)
README_KaizerUI.txt
```
- **ปลายทางของ Java pack** เลือกในหน้าต่าง Export และเก็บไว้ใน `settings.packHost` ใช้โฟลเดอร์เดียวกับ Java HUD export (`JAVA_HUD_EXPORT.md`)

| packHost | ที่วางไฟล์ | หลังวาง |
|---|---|---|
| `itemsadder` (ค่าเริ่มต้น) | `plugins/ItemsAdder/contents/<ns>_gui/resourcepack/assets/<ns>/…` | `/iazip` |
| `nexo` | `plugins/Nexo/pack/external_packs/<ns>_gui/` (มี pack.mcmeta) | reload Nexo / restart |
| `oraxen` | `plugins/Oraxen/pack/assets/<ns>/…` | reload Oraxen / restart |
| `zip` | `KaizerUI_<ns>_java_pack.zip` แยก (zip ซ้อน) | อัปโหลด แล้วตั้ง `resource-pack.url` |

- ถ้าเลือก plugin: ไฟล์อยู่ใน `root` ของ payload และ `java_pack` ว่าง (Rust จะข้าม zip ซ้อน)
- ถ้าเปิด obfuscation ของ pack ใน Nexo/Oraxen แล้วมันเปลี่ยนชื่อ font/texture → ต้องยกเว้น namespace `<ns>` (ยังไม่ได้ทดสอบ)

### 3.1 Java pack
- **รูป 1 รูปต่อ 1 ขนาด = 1 glyph** ใน `assets/<ns>/font/gui.json` (bitmap provider)
  - ตัวอักษรเริ่มที่ U+E000 (ตัวแรกเป็นเคอร์เซอร์เสมอ)
  - รูปถูกวาดใหม่ให้มีขนาดเท่า element พอดี (`<id>_<w>x<h>.png`) → `height = h` และกว้างเท่ากับ `w`
  - `ascent = min(7, h)` (vanilla ไม่ยอมให้ ascent > height)
  - **glyph ใหญ่สุด 256×256** (font atlas ของ client = `FontTexture.SIZE` 256) รูปที่ใหญ่กว่าถูกแบ่งเป็น tile เท่า ๆ กัน → yml `tiles: [{x, y, w, h, glyph, ascent}]` (และ `hover-tiles`)
- `pack.mcmeta`: `pack_format 34` + `supported_formats 34–1000` + `min_format/max_format` (รองรับ 1.21 ถึง 26.x)

### 3.2 Bedrock pack (`ui/server_form.json`)
- แทน `main_screen_content` → `server_form_factory.control_ids.long_form = @server_form.<ns>_long_form`
- `<ns>_long_form` มีลูกสองแบบ:
  - **form ปกติของเกม:** แสดงเมื่อ title **ไม่มี** `kz:<ns>:`
  - **`<ns>_menu_<id>`:** หนึ่งตัวต่อเมนู แสดงเมื่อ title มี `kz:<ns>:<id>|`
- **slot ของ form:** ปุ่ม (ตามลำดับ) แล้วต่อด้วยข้อความ (ตามลำดับ)
  - ตรงกับ `bedrock-slot` ใน yml
  - ปลั๊กอินใส่ marker `kzs<NN>|` นำหน้าข้อความของทุกปุ่มใน form
  - pack สร้าง item ต่อปุ่มด้วย factory ของเกม (`stack_panel` + `factory` + `#form_button_length → #collection_length`)
  - แต่ละ item (`<ns>_slot_<menu>`, ขนาด 0×0) มี element ของทุก slot แต่แสดงเฉพาะตัวที่ marker ตรง (`#visible`) และตัดทิ้ง marker ก่อนแสดง (`#kz_text`)
  - ปุ่มใช้ binding `collection_details` + mapping `button.form_button_click` (index ของ item = ปุ่มที่กด)
  - ⚠️ `collection_index` บน control ที่วางเองใช้ไม่ได้ (ทุกตัวอ่านปุ่มแรก) — เจอในเกม 2026-11-23
- ข้อความ (รวม PAPI) ปลั๊กอินส่งมาเป็นข้อความปุ่ม pack แสดงเป็น label (กดไม่ได้)
- รูปอยู่ที่ `textures/<ns>_gui/<imageId>.png`

### 3.3 `menus/<id>.yml` (อ่านโดยปลั๊กอิน)
- ระดับเมนู: `id, title, command, width, height, refresh-ticks, open-sound, bedrock-title, bedrock-slots`
- `elements:` แต่ละตัวมี `type, x, y, w, h`
  - รูป: `glyph` (`""`), `glyph-ascent`, `hover-glyph`
  - ปุ่ม: `label…`, `actions`, `close-on-click`, `bedrock-slot`
  - ข้อความ: `text, color, scale, shadow, align, bedrock-slot`
  - Motion (ดูข้อ 7): เมนู `motion: {"open": clip}` · element `motion: {"intro", "loop", "hover", "press"}` · รูปเคลื่อนไหว `fps`, `frames: [[tile,…], …]` (เขียนเป็น JSON ซึ่งเป็น YAML flow ที่ถูกต้อง)

## 4. Action ของปุ่ม
`player:cmd` · `console:cmd` · `open:<menu>` · `close` · `message:text` · `sound:id[;vol;pitch]` · `server:<name>` (BungeeCord channel)
- บรรทัดที่ไม่มี prefix = คำสั่งของผู้เล่น
- PAPI ใช้ได้ทุกตัว

## 5. ปลั๊กอิน KaizerUI (`plugins/KaizerUI`)
- Paper / Purpur / Folia 1.21+ (Java 21) · softdepend: PacketEvents, PlaceholderAPI, floodgate, Geyser-Spigot
- **source อยู่ที่ `src/kz/kaizerui/`** (ไม่ใช่ `src/main/java/...`) เพราะเครื่องมือ sync ไฟล์ของแชทเข้าโฟลเดอร์ลึกเกิน 7 ชั้นไม่ได้ → pom ตั้ง `sourceDirectory=src`, resources = `resources/`

| Class | หน้าที่ |
|---|---|
| `KaizerUIPlugin` | โหลด config/studio/menus, เปิดเมนู (Java หรือ Bedrock), คำสั่ง alias ของเมนู, ส่ง resource pack ตอน join, ค่า FOV/speed ต่อผู้เล่น (PDC) |
| `JavaSession` | เมนู 1 ผู้เล่น: กล้อง, hologram, เคอร์เซอร์, hover, click, refresh PAPI |
| `JavaMenus` | รายการ session + listener (หันหัว → เคอร์เซอร์, ตี/คลิกขวา → กด, ย่อ → ออก, ล็อคตำแหน่ง, กันพัง/วาง/ทิ้งของ, ปิดเมื่อโดนตี/วาร์ป/ตาย/ออก) |
| `CameraHook` | packet camera ของ PacketEvents (class เดียวที่แตะ PacketEvents) |
| `BedrockMenus` | ส่ง SimpleForm ผ่าน Floodgate หรือ Geyser, จับคู่ปุ่มที่กดกับ slot, เปิดหน้าเดิมซ้ำถ้าปุ่มไม่ได้ปิด/ไปหน้าอื่น |
| `Actions`, `Texts`, `Fonts`, `Sched`, `MenuDef`, `KuiCommand` | action, PAPI + สี, ความกว้างตัวอักษรโดยประมาณ, scheduler แบบ Folia, อ่าน yml, `/kui` |

### เรขาคณิตฝั่ง Java (ตรวจกับโค้ด client 1.21 `TextDisplayRenderer` แล้ว)
- **ตำแหน่ง panel:** อยู่หน้ากล้อง `distance` บล็อก โดย 1 GUI px = `s` บล็อก
  - `s = 2·d·tan(fov/2)·fill / height` (ถ้ากว้างเกินจอ 16:9 จะลดลง)
- **ขนาด TextDisplay:** scale = `s / 0.025` → 1 text px = 1 GUI px
- **ตำแหน่ง glyph:** glyph w×h (ascent a) มีจุดกลางอยู่ `+0.5 px` ทางขวา และ `3 + a − h/2 px` ด้านบน origin ของ entity
  - (ความกว้างของ text ทั้งก้อนคือ `w + 1`, เริ่มที่ `1 − W/2`, บรรทัดแรกอยู่ 10 px เหนือ origin, ขอบบน glyph = `7 − a`)
  - ตรวจด้วยสคริปต์แล้ว: มุมทั้ง 4 ตรงเป๊ะ
- **ทิศของ entity:** yaw = yaw ผู้เล่น + 180 → แกน x ของ text = ขวาของผู้เล่น (ไม่กลับด้าน)
- **กล้อง:** ItemDisplay ว่าง ๆ วางไว้หน้าหัว 0.4 บล็อก แล้วส่ง packet camera
  - ปิดเมนูเมื่อไร ส่ง id ของผู้เล่นกลับไป
  - **ผู้เล่นต้องขี่ entity:** client ที่กล้องไม่ใช่ตัวเองจะไม่ส่ง rotation ยกเว้นตอนขี่ (`LocalPlayer.tick` ส่ง `Rot` ทุก tick ถ้า `isPassenger`)
    - จึงให้ขี่ ItemDisplay ที่มองไม่เห็นตรงที่ยืน แล้วอ่าน `getLocation()` yaw/pitch ทุก tick
    - ลงจากพาหนะ (ย่อ) = ออก
    - ซ่อนของในมือด้วย SetSlot ว่าง (slot 36+held และ 45)
- **เคอร์เซอร์:** ใช้การเปลี่ยน yaw/pitch แบบ relative × `pxPerDeg` × sensitivity × `/kui speed`
  - ไม่มี PacketEvents → ใช้เส้นจาก crosshair ตัดกับ panel แทน

## 6. ยังไม่ได้ทดสอบ / ข้อควรรู้
- **ทุกอย่างยังไม่ได้ทดสอบในเกมจริง**
- **สิ่งที่ทดสอบแล้ว:**
  - UI ด้วย Playwright (เพิ่มรูป / ปุ่ม / ข้อความ / ลาก / หลายหน้า / preview / export / save-reload)
  - `cargo check` ของทั้งโปรแกรม + `cargo test --lib` 41 ตัว
  - zip ที่ export จริงผ่าน `build_export`: รูป glyph สูงตรงกับ `height`, JSON parse ได้
  - ปลั๊กอิน compile ผ่าน (`javac -Xlint:all`) กับ stub ที่เขียนตามลายเซ็นจริงจากซอร์ส Paper / PacketEvents / Floodgate / Geyser / Cumulus
  - **ยังไม่ได้ build ด้วย Maven จริง**
- **ถ้ารูปในเกมกลับด้าน:** `java.flip-facing: true`
- **ถ้ารูปสูง/ต่ำไป:** `java.offset-y`
- **Bedrock:** `collection_index` + `collection_details` บนปุ่มที่วางเอง เป็นวิธีที่ใช้กันใน pack ทั่วไป แต่ต้องลองกับ client จริง
  - ถ้ากดแล้วไม่มีผล ให้ดูที่ `button_mappings`
- **ขนาดเมนูฝั่ง Bedrock:** มากกว่า ~400×230 อาจล้นจอเล็ก (validate จะเตือน)
- **ยังไม่ได้ทำ:**
  - CustomForm (ช่องพิมพ์ / slider) ฝั่ง Bedrock
  - item icon จริง
  - scroll list
  - ปุ่มที่ไม่มีรูปฝั่ง Java (ตอนนี้แสดงแค่ label และเปลี่ยนสีตอน hover)

## 7. Motion (animation) — ต้นแบบจาก NxGui แต่ทำแบบของเรา
**ใน GUI Studio**
- เมนู → **Opening**: ทั้งหน้า (Fade, Pop, Zoom, Rise, Drop, Slide, Screen on (CRT), Unfold, Bounce, Swing, Spin) + **Cascade** = ชิ้นที่ตั้ง "Follow the menu" ทยอยโผล่ตามลำดับ layer ห่างกัน `cascadeGap` ms (รวมทั้งหมดไม่เกิน 1.5 วิ)
- element → **Motion**: Appear (เอง หรือ Follow the menu) + delay/length · Loop (Pulse, Breathe, Bob, Float, Sway, Swing, Spin, Blink, Wiggle, Heartbeat) + strength/รอบ · ปุ่ม: Hover (Grow/Lift/Tilt/Pop/Nudge) + Click (Squish/Sink/Bump/Shake)
- **Animated picture**: เพิ่มหลายรูป หรือ GIF ไฟล์เดียว (แตกเฟรมด้วย `ImageDecoder` ของ WebView2) + fps (สูงสุด 63 เฟรม)
- Preview (P) เล่นทุกอย่างด้วยสูตรเดียวกับในเกม · ปุ่ม ▶ Play เล่นใหม่ตั้งแต่ต้น
- เทมเพลต: ตัวเลือก **Animated** (Pop + cascade Rise)

**รูปแบบ clip** `{length, delay, loop, pivot:[px,py], tracks:{x|y|scale|sx|sy|rot|alpha: [[t, value, ease],…]}}` — x/y = GUI px (y ลง), scale/sx/sy/alpha = %, rot = องศาตามเข็ม · ease ของ key คุมช่วงไปหา key ถัดไป (`linear in out inout back bounce elastic steps hold`) · export ขยาย preset เป็น keyframe แล้ว ปลั๊กอินจึงไม่ต้องรู้จักชื่อ preset

**Java (KaizerUI `Motion.java` + `JavaSession`)**
- ทุก tick คำนวณ state ของ element (intro → loop → hover → press) แล้วซ้อนด้วย state ของ Opening รอบจุดกลางเมนู
- ส่งเป็น `Transformation` ของ TextDisplay ทุกชิ้นของ element (tile + label) พร้อม interpolation 1 tick (loop อย่างเดียว = ทุก 2 tick, interpolation 2) → client เลื่อนลื่นระหว่าง sample
- คณิต: map ใน plane ของ display (บล็อก, x = ขวาผู้เล่น, y = ขึ้น, origin = entity) `v → C + Am(Pe + Ae(v−Pe) + de − C) + dm` แล้วแตก 2×2 ด้วย SVD เป็น leftRotation · scale · rightRotation (ตรวจด้วยสคริปต์แล้วว่าตรงกับ CSS preview)
- opacity = `text_opacity` (signed byte บน client): 0% → 8 (0–3 จะทึบเต็ม, <26 shader ทิ้ง) · ก้าวที่ข้าม 127↔128 ส่งแบบไม่ interpolate (ไม่งั้นจะวิ่งผ่านทุกค่าระหว่างนั้น)
- ฉากหลัง Full screen จางเข้าตาม alpha ของ Opening · เริ่มเล่นหลัง spawn 2 tick และ spawn ด้วย state แรกเลย (ไม่กะพริบ)
- รูปเคลื่อนไหว: เปลี่ยน glyph ของแต่ละ tile ตาม `fps` (ตาม tick → สูงสุด 20) · ตอน hover ที่มี hover picture จะหยุดเฟรมไว้
- element ที่ไม่มี motion และเมนูไม่มี Opening = ไม่มี task / packet เพิ่ม

**Bedrock (`server_form.json`)**
- clip → chain ของ anim ต่อ property (`offset`, `size`, `alpha`) ช่วงละ 1 anim, `next` ต่อกัน, loop ชี้กลับตัวแรก · รอ delay ด้วย anim ที่ from = to
- element ที่มี motion ถูกห่อด้วย panel (`propagate_alpha`) ที่ถือ anim, ตัว element เต็ม panel · scale ทำด้วย size + offset (คงจุดกลาง) — ตัวหนังสือไม่ขยายตาม
- Opening: ขยับ panel เมนู (slide/rise/drop/bounce) + จางเข้า; preset ที่เป็นการขยาย/หมุนจะเหลือแค่จาง · ฉากหลังจางตาม
- หมุน (rot) ทำไม่ได้บน Bedrock · Hover/Click motion = Java เท่านั้น (Bedrock มี hover picture อยู่แล้ว)
- รูปเคลื่อนไหว: ต่อทุกเฟรมเป็นแถบแนวตั้ง `textures/<ns>_gui/<id>_frames.png` + anim `flip_book` (`uv_size`, `frame_step`, `fps`)
- ข้อควรรู้: Bedrock เปิด form ใหม่หลังกดปุ่มที่ไม่ปิดเมนู → Opening/Appear เล่นซ้ำ
- **ยังไม่ได้ทดสอบในเกม:** ทิศหมุน (ถ้ากลับด้านให้แก้เครื่องหมายใน `JavaSession.linear`), anim บน panel ของ Bedrock

## 8. Shapes & Icons — `gs_assets.js`
- เปิดด้วย **S** (Shapes) / **O** (Icons) หรือปุ่มบน toolbar ซ้าย · ผลลัพธ์เป็นรูป PNG ธรรมดา + `element.gen = {kind:'shape'|'icon', …}` สำหรับ Edit… ภายหลัง
- **Pixel shape:** mask จากจุดกลาง pixel → ขอบ (outline) = pixel ที่ติดช่องว่าง 4 ทิศ, ด้านบน/ซ้ายสว่าง, ล่าง/ขวามืด (กว้าง `bevel`), จุดแสงมุมซ้ายบน, เงา 1 px ทึบ 55% · ramp: palette ของเทมเพลต (`GS.Templates.PALETTES`) หรือ `rampFrom(สี)` (มืดเอียงฟ้า สว่างเอียงเหลือง)
- **2D shape:** canvas path, fill/gradient/stroke/shadow — ในเกมยังเป็น 1 texture px ต่อ 1 GUI px
- **Icons:** ชุดออฟไลน์อยู่ใน `gs_iconsets.js` (Iconify JSON ที่ตัดแล้ว) · ออนไลน์ใช้ `api.iconify.design` (`/search`, `/<prefix>.json?icons=`, รูปตัวอย่าง `/<prefix>/<name>.svg`) — `csp: null` ใน tauri.conf จึงเรียกได้
  - license ที่ไม่ต้องให้เครดิต: MIT, Apache-2.0, ISC, CC0, OFL, BSD, Unlicense, MPL · เลือก "credit ok" เพิ่ม CC BY · ไม่แสดง GPL / SA / NC
  - Pixel: ชุด pixel วาดบน grid ของตัวเองแล้วขยายแบบ nearest, ชุดอื่นตัด alpha ที่ 110 ให้ขอบคม
- icon ที่ต้องให้เครดิต → `README_KaizerUI.txt` หัวข้อ Icon credits (`GS.Assets.credits`)
- **Bedrock backdrop:** `menu.bedrockBackdrop` (ค่าเริ่มต้น false) · ถ้าเปิด ใช้ขนาด 400% anchor center เพราะพื้นที่ content ของ server form แคบกว่าจอ

## 9. Detail (รูปละเอียดกว่า GUI px)
- `element.detail` ∈ {1,2,4,8} (image/button) · `image.res` = pixel ของรูปต่อ 1 GUI px (รูปจาก Shapes 2D / Icon smooth = 4)
- Java: `GlyphTable.tiles(id, w, h, detail)` — glyph texture = (w·d)×(h·d), provider `height` = h (GUI px) → client ย่อ texture ลงเอง · ขีดจำกัด 256 เป็น pixel ของ texture จึงตัด tile ที่ `floor(256/d)` GUI px · ตำแหน่งในปลั๊กอินไม่เปลี่ยน (คิดเป็น GUI px เหมือนเดิม)
- `pinWidth()`: BitmapProvider วัดความกว้าง glyph ถึงคอลัมน์สุดท้ายที่ alpha ≠ 0 แล้ว TextDisplay จัดกึ่งกลางตาม `font.width` → รูปที่ขอบขวาใสจะเบี้ยว จึงใส่ pixel alpha 1 ที่มุมขวาบนของทุก glyph (shader ทิ้ง alpha < 0.1 จึงไม่เห็น)
- Bedrock: ใช้รูปขนาดจริง วาดลง size ของ control อยู่แล้ว

## 8. Player Head / Player Model (2026-11-24) — วิธีเดียวกับ Player Head ของ HUD
- element `player_head` / `player_model`: `player` (`%player_name%` = คนที่เปิดเมนู, หรือชื่อ / placeholder), `hat`, `dollSize` / `dollOffset` (null = auto จาก `M.dollBox`)
- **Bedrock:** `paper_doll_renderer` (ตัวคนที่เปิด form เท่านั้น) — หัว: panel `clips_children` + doll ขยาย (HUD: 75×205 @ 1,18 ต่อ 35×31) · คนอื่น: Steve จาก `textures/entity/steve` (uv หน้า 8,8 / hat 40,8 / body 20,20 / แขน 44,20 & 36,52 / ขา 4,20 & 20,52)
- **Java:** font `<ns>:kz_skin` (`kz_px.png` 1×1, glyph U+E000+r ascent 1−r height 1, space U+E100 −1, U+E101 −8, U+E102 −16, U+E103 +1) · `Skins.java` สร้างข้อความ: pixel = glyph แถว r + (−1), ช่องว่าง = +1, จบแถว = ถอยกลับ W · กล่องข้อความ: x = 1−W/2 … 1+W/2, แถวแรกบน 4 text px เหนือ origin → `JavaSession.playerPart` scale = s·p/0.025 (p = GUI px ต่อ skin px)
- skin: คนออนไลน์ใช้ profile ของเขา, คนอื่น `Bukkit.createProfile(name).complete()` (async) → ดาวน์โหลด PNG จาก textures.minecraft.net · cache 10 นาที (ไม่มี skin: ลองใหม่ทุก 60 วิ) · ไม่มี/ยังโหลดไม่เสร็จ = Steve

## 9. Player Model 3D + Item (2026-11-24)
- **Player Model (Java)**: `java3d` (ค่าเริ่ม true) → `ModelPart` = Mannequin เห็นคนเดียว, `outfit` own/none, `pose`, `turn` none/spin/cursor, `angle`, `spinSpeed` · ขนาด k = min(w·s/0.9375, h·s/1.875) (attribute SCALE ≥ 0.0625), เท้าที่ขอบล่างของกล่องที่พอดี, ลึกกว่าชั้นอื่น LAYER + 0.16k · ไม่มี Mannequin (เซิร์ฟ < 1.21.9) หรือ `java.models-3d: false` → แบบแบน (ข้อ 8)
- **Item**: yml `item`, `glint`, `look` flat|3d, `spin` · Java `Items.resolve` → `ItemDisplay` (GUI transform บีบ z 5% / NONE ยื่นออกมา k/2) · Bedrock `GS.Items.bedrockTexture` (`BEDROCK_NAMES`) หรือ `bedrockTexture` · `slot:*` อ่านใหม่ทุก refresh
- **รูปในโปรแกรม**: `GS.Items.loadFiles` อ่าน `assets/minecraft/textures/item|block/*.png` จาก .jar/.zip/โฟลเดอร์ ของผู้ใช้ → localStorage `kz_item_textures_v1`

## 10. Minecraft assets + ชุดสี Flat (2026-11-24)
- `GS.Items.downloadVanilla()` — version manifest ของ Mojang → client .jar → `ingest()` (item/block/skin) → localStorage `kz_item_textures_v1` (`items`, `blocks`, `skins`) · `downloadDialog()` มีแถบความคืบหน้า · `skinArt(type)` วาดหน้า/ตัวด้านหน้าจาก skin Steve (cache, render ใหม่เมื่อพร้อม)
- kit `group: 'Flat'` มี `flat: {bg, edge, divider, stage, stageEdge, well, wellEdge, btn, btnEdge, btnHover, btn2, btn2Edge, btn2Hover}` · ปุ่ม `secondary` (Close/Back/การ์ด) ใช้ btn2 · หัวเรื่องชิดซ้ายที่ y=5 + เส้นคั่น y=19
- Player Model `turn: mouse` — yaw = base − clamp((cx − กลางกล่อง) / (กว้างเมนู/2)) × 180° (ขอบซ้าย→ขวา = รอบตัว, หน้าหันไปฝั่งเคอร์เซอร์)

## 11. ไอคอนแบบช่องกระเป๋า + Player Model 3D ในโปรแกรม (2026-11-24) — `gs_mcrender.js`
- `GS.McRender.render(entries, onText)` → `{icons, kinds, count}`: id จาก `items/*.json` (เวอร์ชันเก่า: `models/item/*.json`) · `pick()` เลือก model (model / condition / select / range_dispatch / composite พร้อม translation / special) · `model()` รวม parent (textures, elements, display.gui) · texture แบบ 26.x `{sprite}` ก็อ่านได้
  - `draw3d`: มุม `display.gui` ของ model (ค่าเริ่ม 30/225/0 ×0.625) หมุนแบบเกม `rotationXYZ` มือขวา (ที่ 225° north อยู่ขวา) · สีจาก `tints` ของ item definition (constant / dye / potion / grass→colormap) · banner, shield ใน `drawSpecial` · ตัด face ด้านหลังด้วย cross ≤ 0 · แสง บน 1 / ซ้าย 0.8 / ขวา 0.6 / ล่าง 0.5 · tint หญ้า/ใบไม้/น้ำ · OUT = 32 px
  - `drawSpecial`: chest (`entity/chest/<texture>`), shulker_box, head/player_head ด้วย `drawBoxes` (box UV แบบ entity: แถวบน [บน][ล่าง], แถวสอง [ขวา][หน้า][ซ้าย][หลัง], หน้า = +Z)
- `GS.Items.ingest`: ถ้ามี model → เก็บ `icons` + `kinds` + `texNames` แล้วทิ้ง texture ดิบ (`items`/`blocks`) · ไม่มี model (pack texture อย่างเดียว) → แบบเดิม · `url()` ใช้ `icons` ก่อน · `catalog()` แยก Items/Blocks ตาม `kinds`
- `GS.McRender.player(canvas, skin, {yaw, headYaw, headPitch, slim, hat})` — ตัวผู้เล่นทั้งตัว (64×64, สกินเก่า 64×32 แปลงด้วย `skin64`) · `GS.Items.drawPlayer(canvas, opt)` / `skinArt('player_model', yaw)` · editor: `<canvas class="gs-doll">` ในกล่อง Player Model, `dollView(e)`, ปุ่ม `.gs-turn` → `dragTurn()` (1.2°/px, เก็บใน `angle`) · Preview: `dollsFollow()` (cursor / mouse) และ `dollsSpin()` (spin)
- yaw บวก = หน้าหันไปทางซ้ายของคนดู เหมือน yaw ของ Minecraft (`facingYaw() + angle` ในปลั๊กอิน)
- **Turn = drag** — Java: `click()` บนกล่อง PLAYER_MODEL (ไม่มีปุ่มใต้เคอร์เซอร์) → `grabbed`; `onRotate` เอา yaw ของหัวที่เปลี่ยน × 3 ลบออกจาก `dragYaw` (เมาส์ขวา = หน้าหันขวา) และไม่ขยับเคอร์เซอร์; คลิกถัดไปปล่อย · Bedrock: `bedrockPlayer()` ห่อ doll ด้วย `input_panel` ชื่อ `kz_doll_<id>` (gesture_tracking_button `button.turn_doll`, mapping จาก `button.menu_select`) และ doll `rotation: "gesture_x"` + view bindings จาก panel นั้น — แบบ `skin_viewer_panel` ใน pause_screen.json · editor Preview: `dollGrab()`

