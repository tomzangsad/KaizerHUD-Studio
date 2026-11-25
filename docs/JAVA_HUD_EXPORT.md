# Java HUD Export — BetterHud & MythicHUD Exporter

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Exports the current studio project directly into **BetterHud** or **MythicHUD** configurations plus hotbar / transparent vanilla-bar sprites for **ItemsAdder**, **Nexo**, **Oraxen**, or standalone resource packs (`ui/js/javaexport.js` + `src-tauri/src/javaexport.rs`).

- **Options (inside the Export dialog):** Target HUD plugin (`BetterHud` / `MythicHUD`), resource pack plugin (`ItemsAdder` / `Nexo` / `Oraxen` / `None`), optional `widgets.png` hotbar export, vanilla HUD hiding, `default-hud` toggle, and per-group export (`1 group = 1 HUD/layout`).
- **Coordinate Inverse (`480×270`):** Matches `preview.js` / `javahud.rs` (`x = fx*480 + offset.x - fx*w`, `y = fy*270 + offset.y - fy*h`, with `+2px` bottom anchor adjustment for Java hotbar alignment).
- **Elements Mapped:** Images (including BetterHud `sequence` animations), built-in & custom PAPI bars, PAPI text labels, XP level numbers, player heads, visibility conditions, and opacity.
- **Tests:** Covered by `javaexport::tests` in `cargo test --lib` (`build_zip`, path traversal checks, zip layout).

---

## ภาษาไทย

# Java HUD Export — ส่งออก config ปลั๊กอิน Java (BetterHud / MythicHUD)

> สร้าง 2026-11-21 · ส่วนหนึ่งของ KaizerHUD Studio (`desktop/`) · กลับด้านของ Import Java HUD (`docs/JAVA_HUD_IMPORT.md`)

อยู่ในหน้าต่าง **Export** เดียวกับ .mcpack (ปุ่ม Export / Ctrl+E) → ติ๊ก **Java Edition (optional) → Also export Java HUD config** (ปิดไว้เป็นค่าเริ่ม, จำค่าล่าสุดใน `localStorage['kz_export_java']`) → กด Export จะบันทึก output.zip ก่อนแล้วถามที่บันทึก zip ของ Java ต่อ ได้ไฟล์ zip ที่ลากโฟลเดอร์ข้างในไปวางใน `plugins/` ของเซิร์ฟเวอร์ Java ได้เลย (หน้าตาเหมือน pack ใน `Template_HUD`) ในนั้นมี `README_KaizerHUD.txt` บอกวิธีติดตั้ง (ไทย + อังกฤษ)

## 1. ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `ui/js/javaexport.js` | กล่องตัวเลือก + แปลงโปรเจกต์เป็นไฟล์ของปลั๊กอิน (YAML เป็นข้อความ, PNG เป็น base64) · `window.JavaHudExport = { mount, readOptions, exportZip, showResult, open, build, collect }` (ไม่ใช้ alert เพราะใช้ไม่ได้ใน WebView) |
| `ui/js/export.js` | หน้าต่าง Export: เติมกล่อง Java ตอนเปิด, หลังบันทึก output.zip เรียก `exportJavaAfter()` |
| `src-tauri/src/javaexport.rs` | ตรวจ path แล้ว zip (`build_zip`) + ชื่อไฟล์ปลอดภัย (`safe_zip_name`) + unit test 3 ตัว |
| `src-tauri/src/lib.rs` | command `export_java_hud { files, fileName }` → หน้าต่าง Save → คืน path |
| `ui/index.html`, `ui/js/shell.js` | กล่อง `#export-java-box` ในหน้าต่าง Export + `<script src="js/javaexport.js">` (เมนูแยกถูกเอาออกแล้ว; command `export-java-hud` ยังอยู่ = เปิดหน้าต่าง Export พร้อมติ๊ก Java) |
| `docs/java-hud-export/patch_java_export.py` | สคริปต์เติม hook 3 ไฟล์ข้างบน (รันซ้ำได้ ไม่เติมซ้ำ, รักษา CRLF) |
| `docs/java-hud-export/patch_export_merge.py` | รวม Java เข้าหน้าต่าง Export เดียวกัน (แก้ index.html + export.js, รันหลัง patch_java_export.py) · สำรองไฟล์เดิมที่ `backup2/` |
| `docs/java-hud-export/roundtrip_test.js` | ทดสอบ import → export → import (ดูข้อ 6) |

ไม่ได้แตะ `hudforge*.js` และเปิดให้ใช้งานได้ทุกคน (Open Source GPL-3.0)

## 2. ตัวเลือกในหน้าต่าง
- **HUD plugin**: BetterHud / MythicHUD
- **Resource pack plugin**: ItemsAdder / Nexo / Oraxen / None
- ใส่ texture hotbar (จาก Widgets → `hotbar.png` 182×22 + `hotbar_selection.png` 24×23, Java 1.20.2+)
- ซ่อนของ vanilla ที่ HUD นี้แทน (หัวใจ / อาหาร / เกราะ / อากาศ / XP)
- เปิด HUD ให้ทุกคนอัตโนมัติ (`default-hud` / `layout.default`)
- เลือก group ที่จะส่งออก — **1 group = 1 HUD (BetterHud) / 1 layout (MythicHUD)**
- จำค่าล่าสุดใน `localStorage['kzJavaExport.v1']`

## 3. ที่วางไฟล์ตามปลั๊กอิน pack
| | BetterHud `build-folder-location` / `pack-type` | MythicHUD (ใน snippet) | hotbar + sprite ใส |
|---|---|---|---|
| ItemsAdder | `ItemsAdder/contents/<ns>_betterhud/resourcepack` / folder | `copy-pack.path: ItemsAdder/contents/mythichud/resourcepack` | `ItemsAdder/contents/<ns>_hotbar/resourcepack/assets/minecraft/...` |
| Nexo | `Nexo/pack/external_packs/<ns>_betterhud` / zip | `nexo-hook: true` | `Nexo/pack/external_packs/<ns>_hotbar/assets/minecraft/...` |
| Oraxen | `Oraxen/pack/uploads/<ns>_betterhud` / folder | `copy-pack.path: Oraxen/pack/uploads/MythicHUD` | `Oraxen/pack/assets/minecraft/...` |
| None | `BetterHud/build` / folder | — | `resourcepack/assets/minecraft/...` |

ที่มา: BetterHud wiki "Merge with external resource" + source (`ConfigManagerImpl`, `NexoCompatibility`), MythicHUD wiki Compatibility, Oraxen docs (`pack/uploads` รับ zip/โฟลเดอร์)
- hotbar อยู่คนละโฟลเดอร์กับ build ของ BetterHud เพราะ `clear-build-folder: true` จะลบโฟลเดอร์ build ทุกครั้ง
- ซ่อน vanilla: BetterHud = PNG ใสทับ sprite (`heart/*`, `food_*`, `armor_*`, `air*`, `experience_bar_*`) + `shader.yml: disable-level-text` ถ้ามีเลข XP · MythicHUD = `elements: HEALTH/HUNGER/ARMOR/AIR/EXPERIENCE/EXPERIENCE_LEVEL: hidden`
- BetterHud `config.yml` ถูกสร้างใหม่ทั้งไฟล์ (README เตือนให้สำรอง) · MythicHUD ให้เป็น `config_kaizerhud_snippet.yml` เพราะ config จริงมีคีย์เยอะ/เปลี่ยนตามเวอร์ชัน

## 4. การแปลง element
| editor | BetterHud | MythicHUD |
|---|---|---|
| Image | image `single` (ย่อ/ขยายเป็นขนาดใน editor + ผสมสี tint ลง PNG) | asset 1 layer `texture.path` |
| Bar HP/Food/Armor/Air | listener `health/food/armor/air` | `function.listener` เดียวกัน |
| Bar Custom | listener `placeholder` value/max `(number)papi:x` · ถ้า PAPI เป็นค่า vanilla (`%player_exp%` ฯลฯ) ใช้ listener ในตัว | `listeners/<ns>.yml` `{value, max}` |
| ทิศ bar (left/right/bottom/top) | `split-type` left/right/up/down · `split` = ความยาว px (2–100) | `orientation` + `reversed` · `increment` เท่ากัน |
| Text (PAPI) | pattern `[papi:x]` + `<#hex>` + `scale` + `align` + `outline` | layer `text` + `scale` + `outlined` + `align` |
| XP Level Number | `[level]` กึ่งกลางกล่อง | `%player_level%` |
| Player Head | heads `pixel = round(min(w,h)/8)` กึ่งกลางกล่อง | layer `head.size` |
| Visibility | `conditions: 1: {first, second, operation}` (ตัวเลข `(number)papi:x`, ข้อความ `'abc'` ได้แค่ == / !=) | `placeholder{ph=..;v=..;o=..} true hide` (`!=` → `== … false hide`) |
| alpha < 1 | `opacity` | ไม่ส่งออก (เตือน) |
| Nameplate | ข้าม (Bedrock เท่านั้น) | ข้าม |

Linked Position / Linked Properties ถูกอ่านผ่าน `getPositionTargetElement` / `resolveBarForRender` ของ app.js

## 5. พิกัด (กลับด้านจาก importer)
- กล่องบนจอ 480×270 (y ลง): `x = fx·480 + offset.x − fx·w`, `y = fy·270 + offset.y − fy·h` (เหมือน preview.js)
- ของที่ยึดล่าง (`bottom_*`) **+2px** เพราะ hotbar ของ editor/Bedrock สูงกว่าขอบ 2px แต่ Java ชิดขอบ
- **BetterHud**: hud `x/y` = 0/50/100 ตาม anchor · layout ตั้ง `align: left` + `offset: left` (ค่าเริ่ม `CENTER` จะเลื่อนทั้งแถว −กว้างสุด/2 — ยืนยันจาก `LayoutComponentContainer.kt`) · x/y = มุมซ้ายบนเทียบจุด anchor (ปัดเป็น int เพราะ BetterHud ไม่รับทศนิยม) · `disable-legacy-offset: true` (ไม่งั้นทุกอย่าง −54px)
- **MythicHUD**: `position` % จาก**ซ้ายล่าง** · `offset.y` ขึ้นเป็นบวก · รูป/bar/หัว: element `align: right` (เริ่มที่จุดแล้วไปทางขวา) · ข้อความ: ทั้ง element และ layer ใส่ align (ชิดซ้าย → `right`, กลาง → `center`, ชิดขวา → `left`) เพื่อให้ค่า PAPI ยาวเท่าไหร่ก็ยังชิดถูก
- ขนาดตัวอักษร: small = 0.67, normal = 1, large = 1.5 (ค่าแบ่งเดียวกับ importer) · ความสูงบรรทัด ≈ 9·scale

## 6. ทดสอบแล้ว
- `cargo test` ของ `javaexport.rs` (zip, path อันตราย, ชื่อไฟล์) — ผ่านใน container
- **Round trip** (`roundtrip_test.js`): import 5 ชุดใน `Template_HUD` (tt_modern ×2, Premium 1.21.10, Blossom, MythicHUD party) → สร้าง element แบบ javaimport.js → export ทั้ง BetterHud และ MythicHUD → import กลับด้วย `javahud.rs` → 179 ชิ้น × 2 ปลั๊กอิน ตำแหน่ง/ประเภท bar/ทิศ/visibility ตรงกันภายใน 1px ยกเว้น
  - ข้อความที่ขนาดฟอนต์เดิมไม่ตรง 3 ขนาดของเรา (ขยับแนวตั้ง ~1px)
  - รูปที่ใช้ `scale` ใน pack (สคริปต์ node ไม่ย่อรูป — ในโปรแกรมย่อด้วย canvas แล้ว)
  - bar ใน party HUD ที่ PAPI ใน pack เดิมพิมพ์ผิด (`%mythiclib_stat_health}`) ถูกข้ามพร้อมแจ้งเตือน
- ลองหน้าต่างจริงในเบราว์เซอร์ (Playwright): รูปถูกย่อเป็น 40×20, hotbar 182×22 / 24×23, import กลับตรงทุกชิ้น
- **ยังไม่ได้ทดสอบในเกม Java จริง** — โดยเฉพาะขนาดตัวอักษร small, ทิศ vertical ของ MythicHUD, การ merge กับ Nexo/Oraxen

วิธีรัน round trip: build importer เป็น binary ที่พิมพ์ JSON (`import_pack(path)`), ตั้ง `IMP` ใน script แล้ว `node roundtrip_test.js` (ต้องมีโฟลเดอร์ `packs/` = Template_HUD)

## 7. ข้อจำกัด / งานต่อ
- Java 1.20.2+ เท่านั้นสำหรับ hotbar (ไม่ทำ `widgets.png`/`icons.png` แบบเก่าเพราะไฟล์นั้นรวมปุ่ม/crosshair)
- bar วงกลม, animation, popup, compass ไม่มีใน editor จึงไม่มีให้ส่งออก
- Animation (2026-11-23): BetterHud = `type: sequence` (`file:ticks`, ticks = round(20/fps)), MythicHUD = เฟรม 1 — ดู `docs/HUD_ANIMATION.md`
- bar ชนิด XP (`exp`) ของ editor ส่งออกเป็น listener `exp` แล้ว (เดิมถูกข้ามว่า "custom bar needs a %placeholder%")
- CustomNameplates ยังไม่ทำ (ผู้ใช้เลือกทำ BetterHud + MythicHUD ก่อน) — ทำได้แค่ข้อความ + รูปนิ่งบน bossbar/actionbar
