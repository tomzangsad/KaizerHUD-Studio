# CHANGELOG — KaizerHUD Studio

> เริ่มไฟล์นี้ 2026-11-23 (ก่อนหน้านี้บันทึกอยู่ใน `HANDOFF.md` และ `docs/*.md`)

## v1.0.1 (2026-11-25)

### English
- **Windows Installer + Portable builds:** GitHub Releases now include both the Windows NSIS Installer (`KaizerHUD-Studio_1.0.1_x64-setup.exe`) and the standalone Portable executable (`kaizerhud-portable.exe`).
- **Automatic bilingual Release Notes:** Every tagged release now includes an English/Thai download table explaining what each `.exe` and `.jar` file is for alongside generated commit notes.
- **Streamlined server plugins:** Removed the optional `KaizerMultiBarGeyser` extension; only `KaizerMultiBar` (`2.1.0`) and `KaizerUI` (`1.0.0`) are shipped and maintained.
- **Clearer audience-separated documentation:** `README.md` is now English-only as a clean entry point, while [docs/USER_GUIDE.md](docs/USER_GUIDE.md), [plugins/README.md](plugins/README.md), and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) separate non-developer setup from developer build instructions (bilingual EN + TH).

### ภาษาไทย
- **เพิ่มตัวติดตั้ง Windows คู่กับตัวพกพา:** หน้า GitHub Releases จะสร้างให้ทั้งไฟล์ติดตั้ง (`KaizerHUD-Studio_1.0.1_x64-setup.exe`) และไฟล์แบบพกพา (`kaizerhud-portable.exe`)
- **คำอธิบายไฟล์ดาวน์โหลดอัตโนมัติ (ไทย + อังกฤษ):** หน้า Release จะแนบตารางอธิบายหน้าที่ของแต่ละไฟล์ (`.exe` / `.jar`) ให้อัตโนมัติทุกครั้งที่อัปเดตเวอร์ชัน
- **ตัด `KaizerMultiBarGeyser` ออก:** เหลือปลั๊กอินที่ต้องใช้งานและดูแลเพียง 2 ตัว คือ `KaizerMultiBar` (`2.1.0`) และ `KaizerUI` (`1.0.0`)
- **แยกเอกสารตามกลุ่มผู้ใช้งาน:** หน้าแรก `README.md` ปรับเป็นภาษาอังกฤษล้วนสำหรับนำทาง และแยกคู่มือผู้ใช้ทั่วไป ([docs/USER_GUIDE.md](docs/USER_GUIDE.md)), ปลั๊กอิน ([plugins/README.md](plugins/README.md)), และนักพัฒนา ([docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)) ออกจากกันอย่างชัดเจน (ไทย + อังกฤษ)

## 2026-11-24 (41) — Import Java HUD: รองรับแพ็กชุดใหม่ 3 ตัว (PrimeHUD v2, SeasonsBossbar, HappyHUD-erocavontic-anime)
- **SeasonsBossbar (`CustomNameplates` boss bar ใหม่ใน `javahud.rs`):**
  - เพิ่ม `Plugin::Nameplates` ตรวจจับ `CustomNameplates/configs/bossbar.yml` (และ `bossbars/*.yml`) ได้ทั้งฝั่ง ItemsAdder และ Oraxen
  - อ่านรูปฟอนต์จาก `font_images` (ItemsAdder) และ `glyphs/*.yml` (Oraxen/Nexo), อ่าน `ascent` ของฟอนต์ `.json` ใต้ `assets/<ns>/font/*.json` (เปิดรับไฟล์ `.json` ของฟอนต์ใน `Vfs`), คำนวณความกว้างเลื่อนเคอร์เซอร์จากคอลัมน์ทึบขวาสุดของ PNG + ระยะเลื่อน `%img_offset_*%` / `%oraxen_[neg_]shift_*%` / `%nexo_[neg_]shift_*%`
  - แตก `%conditionaltext_*%` จาก `ConditionalTextPlaceholders` เป็นรูปที่มี Visibility Condition ตามกฎ (`Spring` / `Summer` / `Autumn` / `Winter`) ซ้อนตรงกรอบเดิมพอดี 0 px และวางข้อความ 2 ช่องตาม `ascent` (`-7`, `-35`)
  - bossbar ที่ดันไปมุมจอสำหรับ GUI scale กว้าง (`%img_offset_440%` ซึ่งจะล้นขอบจอ 480) ถูกยึดเข้ากับ `top_right` / `top_left` อัตโนมัติให้ไม่หลุดขอบจอ และแจ้งเตือน `%nameplates_*%`
- **HappyHUD-erocavontic-anime (`HappyHUD`):**
  - รองรับ action `show` (`effect{e=poison} true show` ฯลฯ) และเงื่อนไข `gamemode{gm=creative,spectator} false hide` (เพิ่มคีย์ `gm`/`g`/`gamemode`/`mode` ใน `parse_cond` + `CondResult::Many` แยกเป็น `!= CREATIVE` และ `!= SPECTATOR`)
  - เรียงลำดับ layer ตอนสร้าง element จากล่างขึ้นบน เพื่อให้หลอดหลัก (`hp-fill`, `food-fill`) ได้ชนิด `hp` / `food` ก่อนหลอดสถานะ (`fill-poison`, `fill-hunger`) ที่ทับอยู่ด้านบน
  - `find_widgets` รองรับ path `pack/minecraft/textures/gui/...` ของ HappyHUD (เจอทั้ง `hotbar.png` และ `widgets.png`) และเตือน `popup/` (เอกพจน์)
- **PrimeHUD v2 (`BetterHud`):**
  - ตัดตัวแปลงชนิด `(number)` / `(string)` / `(boolean)` ออกจากค่าฝั่ง `second` ใน `conditions:` (เช่น `second: "'(number)120'"` → `"120"`) เดิมติดข้อความ `(number)` ไปในค่าเงื่อนไข
  - ข้อความที่วางซ้ำตำแหน่งเดียวกันหลายสีตามเงื่อนไข (`ping`, `tps`, `ram` เขียว/เหลือง/แดง) รวมเหลือข้อความเดียว (Bedrock ซ่อนข้อความด้วยเงื่อนไขไม่ได้ และลดจำนวนข้อความจาก 18 เหลือ 12 ไม่เกินเพดาน 16 ช่อง) ส่วนไอคอน `<image:...>` ข้างหน้าข้อความยังเก็บ Visibility Condition ครบทุกสี
  - ข้ามโฟลเดอร์แคช `BetterHud/build/` และข้าม `hotbar.png` ใสว่างขนาดผิดรูป (`256×56`) ใน `find_widgets` (เลือก `widgets.png` จริงแทน ไม่ error ตอนกด Import) · ปิดติ๊กเริ่มต้นของ HUD `hotbar` เดี่ยวที่ทึบซ้ำกับ `Widgets` เพื่อไม่ให้ทับไอคอนไอเท็มในช่อง hotbar บน Bedrock · แจ้งเตือน `background:` ของข้อความ
- **ไฟล์:** `src-tauri/src/javahud.rs`, `docs/JAVA_HUD_IMPORT.md`, `HANDOFF.md` · **สำรอง:** `_backup_hud_packs3_2026-11-24/`
- **ทดสอบ:** `cargo test --lib` 48 ตัวผ่าน (รวม `real_packs` ครบทั้ง 10 แพ็ก + zip ใน `z_zipbackup` ไม่มี regression)

## 2026-11-24 (40) — Bedrock: ตัว Player Model ใหญ่เท่าในโปรแกรม
- ในเกม paper doll วาดตัวผู้เล่นแค่ ~75% ของความสูงกล่อง (เท้าชิดขอบล่าง, วัดจากภาพในเกม: กล่อง 96 → ตัวสูง ~72) เลยเล็กกว่าในโปรแกรม
- `dollBox()` (Player Model) ค่าเริ่ม: กล่อง doll = ขนาด element ÷ 0.75 และเลื่อนขึ้นครึ่งส่วนที่เพิ่ม (เท้ายังอยู่ขอบล่าง) → 48×96 ได้ doll 64×128 offset (0, −16) · ถ้าตั้ง Doll W/H/X/Y เองยังใช้ค่าที่ตั้ง · Player Head ไม่เปลี่ยน
- ลองในเกมแล้วขนาดพอดี แต่เท้าต่ำกว่าเส้นพื้น ~5 px (มุมกล้องก้ม) → ยกขึ้นอีก 5.5% ของความสูง (`DOLL_LIFT`): 48×96 → offset (0, −21.3)
- **ไฟล์:** `gs_model.js` · **สำรอง:** `_backup_gui_doll_size_2026-11-24/`

## 2026-11-24 (39) — Player Model: Drag to turn (Java + Bedrock แบบหน้า pause)
- **Turn ใหม่ `drag` (Drag to turn)** — แบบ `turnable: true` ของ HexaCore
  - **Java (ปลั๊กอิน):** คลิกที่ตัวผู้เล่น = จับไว้ → ขยับเมาส์ซ้าย/ขวาหมุนรอบตัว (3° ต่อ 1° ของเมาส์, เคอร์เซอร์ค้างอยู่ที่เดิม) → คลิกอีกครั้ง = ปล่อย · Java ไม่ส่งสถานะ "กดค้าง" เลยใช้คลิกจับ/คลิกปล่อย (กดแล้วลากก็ใช้ได้ ปล่อยด้วยอีกคลิก) · ปุ่มที่อยู่ใต้เคอร์เซอร์ยังได้ก่อน · `JavaSession`: `grabbed`, `dragYaw`, `turn()` ใช้ yaw ที่ลาก
  - **Bedrock:** ใช้วิธีเดียวกับตัวผู้เล่นในหน้า pause (`pause_screen.json` ของ Mojang): `input_panel` + `gesture_tracking_button: button.turn_doll` + paper doll `rotation: gesture_x` ผูก `#gesture_delta_source` / `#gesture_mouse_delta_x` → กดค้างแล้วลากหมุนได้ · ใช้กับ Turn = drag / mouse / cursor (Bedrock ตามเมาส์ไม่ได้ จึงเป็นลากแทน) · ทุก Player Model บน Bedrock ได้ `starting_rotation` = Angle และ `camera_tilt_degrees: -10` แบบหน้า pause
  - **Preview (P):** กดค้างที่ตัวแล้วลาก = หมุน ปล่อย = วาง · คลิกเฉย ๆ = จับไว้ (แบบ Java) จนคลิกอีกครั้ง
- เทมเพลต Wardrobe ใช้ `drag` + ข้อความ "Drag to turn" · เทมเพลตได้ Angle จากเทมเพลตจริง (เดิมถูกตั้ง 0 ทับ)
- **ไฟล์:** `JavaSession.java`, `gs_export.js`, `gs_editor.js`, `gs_model.js`, `gs_templates.js`, `gs_template_dialog.js` · **สำรอง:** `_backup_gui_doll_drag_2026-11-24/`
- **ทดสอบ:** คอมไพล์ JavaSession กับ stub ผ่าน · Playwright: Wardrobe → Preview ลาก 120px = yaw 20→−124, คลิกจับ/คลิกปล่อยทำงาน, export Bedrock มี input_panel + gesture_x ไม่มี error · **ยังไม่ได้ลองในเกม** (Bedrock: input_panel ในหน้าฟอร์มเซิร์ฟเวอร์ยังไม่เคยทดสอบ)

## 2026-11-24 (38) — ไอคอน: ทิศตามเกมจริง + สีจาก item definition + banner/shield
- **ทิศ:** รอบ (37) ผมกลับแกน Y เอง (−ry) ทำให้ของที่มีด้านหน้า (furnace, หีบ, หัว, บันได, เตียง) กลับด้าน → ใช้สูตรเดียวกับเกม (`rotationXYZ` มือขวา) ตรวจด้วยกล่องทดสอบสีต่างกันทุกด้าน: ที่ 225° ด้าน north อยู่ขวา east อยู่ซ้าย, texture ไม่กลับข้าง
- **สี:** อ่าน `tints` ของ item definition (1.21.4+): constant (ใบไม้แต่ละชนิด), dye default (หนัง), potion, grass → สุ่มจาก `colormap/grass.png` ตาม temperature/downfall · ไม่มี tints ค่อยเดาตามชื่อ texture แบบเดิม
- **Banner** วาด 3D (เสา/คาน + ผ้าย้อมสีตาม `color` 16 สี) · **Shield** ใช้ `shield_base_nopattern` (ถ้าไม่พบ = รูปแบน)
- `VERSION` = 3 → หน้า Choose an item จะบอกให้กด Download Minecraft assets อีกครั้ง
- **ไฟล์:** `gs_mcrender.js` · **สำรอง:** `_backup_gui_3d_doll_2026-11-24/` (รุ่นก่อนหน้าเก็บใน container) · **ทดสอบ:** กล่องทดสอบ + ของจริง 26.3 ในเบราว์เซอร์ (ใบไม้สีถูก, banner แดง/ขาว), Playwright .jar ทดสอบ ไม่มี error

## 2026-11-24 (37) — ไอคอนบล็อก 3D แบบในกระเป๋า + Player Model 3D หมุนได้ 360° ในโปรแกรม
- **ไอคอนไอเท็ม/บล็อกเหมือนในเกม:** ไฟล์ใหม่ `gs_mcrender.js` อ่าน `assets/minecraft/items/*.json` + models ของเกม แล้ววาดทุกไอเท็มแบบช่องกระเป๋า: บล็อกเป็นลูกบาศก์ 3D (มุม GUI 30/225 ตาม model, แสงบน/ซ้าย/ขวา, สีหญ้า/ใบไม้/น้ำ), ไอเท็มแบนวาดตาม layer
  - ของพิเศษที่เกมวาดด้วยโค้ด: หีบทุกแบบ (รวม ender/copper/christmas), shulker box, หัว (player/zombie/creeper/skeleton/wither/piglin), เตียง (composite หัว+ท้าย) · banner/shield/conduit/pot/trident ยังเป็นรูปแบน
  - รายการใน Choose an item = **id ไอเท็มจริงของเกม** (ไม่มี bed_feet / campfire_log / _top ฯลฯ อีก) แยก Items / Blocks ตามชนิด model · 26.3: 1,657 ชิ้น (บล็อก 869) วาด ~5–12 วิ ครั้งเดียวตอน Download / โหลด .jar
  - เก็บเฉพาะไอคอนที่วาดแล้ว (~2.4 ล้านตัวอักษรใน localStorage) + ชื่อ texture สำหรับ Bedrock · pack ที่มีแต่ texture ยังโหลดได้ (รูปไอเท็มของ pack ทับของเดิม) · ใครโหลดไว้แบบเก่าจะมีข้อความให้กด Download อีกครั้ง
  - ในเกม: Java ItemDisplay (GUI) วาดบล็อก 3D เองอยู่แล้ว · Bedrock ฟอร์มยังเป็น texture แบน
- **Player Model 3D ในโปรแกรม:** วาดสกินเป็นกล่อง (หัว ตัว แขน ขา + ชั้นหมวก/เสื้อ/แขนเสื้อ/กางเกง) แทนภาพหน้าตรงแบน · หมุนตาม **Angle** · เลือก Player Model แล้วมี **ปุ่มกลมใต้ตัว ลากซ้าย/ขวาเพื่อหมุนรอบตัว 360°** (บันทึกเป็น Angle)
  - Preview (P): Turn = spin หมุนเอง, cursor หัวมองตามเมาส์, mouse หมุนตามตำแหน่งเมาส์ ขอบซ้ายถึงขวา = รอบตัว
  - ค่าเริ่ม Angle = 20° (เห็นด้านข้างเล็กน้อย) ทั้งตอนเพิ่มใหม่และในเทมเพลต · รูปตัวอย่างเทมเพลตเป็น 3D ด้วย · Java 3D ปิดอยู่ = แสดงหน้าตรง
- **ปลั๊กอิน:** Turn = mouse หมุนได้ ±180° (เดิม ±150°) และหน้าหันตามฝั่งที่เคอร์เซอร์อยู่ (`JavaSession.turn()`)
- **ไฟล์:** ใหม่ `ui/js/guistudio/gs_mcrender.js` · แก้ `gui.html`, `gs_items.js`, `gs_editor.js`, `gs_templates.js`, `gs_model.js`, `guistudio.css`, `JavaSession.java` · **สำรอง:** `_backup_gui_3d_doll_2026-11-24/`
- **แก้ตามมา:** รอบแรกไฟล์ `gs_mcrender.js` ที่ส่งไปเครื่องเป็นรุ่นเก่า (เห็นด้านในกล่อง ไม่มีด้านบน, กระจก 17 ชิ้นหาย) → ส่งรุ่นถูกใหม่ + `GS.McRender.VERSION` (= 2) เก็บใน `iconVer` ถ้ารูปที่เก็บไว้วาดด้วยรุ่นเก่า หน้า Choose an item จะบอกให้กด Download Minecraft assets อีกครั้ง
- **ทดสอบ:** วาดไอคอนจาก client 26.3 จริงในเบราว์เซอร์ (เทียบด้านหน้า furnace/pumpkin/chest อยู่ซ้ายแบบในเกม) · Playwright: เพิ่ม Player Model, ลากหมุน (Angle 20→92), Preview หมุนตามเมาส์, เทมเพลต Wardrobe, โหลด .jar ทดสอบ → Items 1 / Blocks 3 ไม่มี error · ปลั๊กอินยังไม่ได้ build ใหม่

## 2026-11-24 (36) — Choose an item: แสดงทุกไอเท็ม
- ไม่จำกัด 240 ชิ้นแล้ว: แสดง **ทุกไอเท็ม + ทุกบล็อก** แบ่งหัวข้อ (หัวข้อติดด้านบนตอนเลื่อน) + จำนวน · แท็บ **All / Items / Blocks / Worn** · ค้นหาพิมพ์เว้นวรรคหรือ `minecraft:` ได้
- `catalog()`: รวมเฟรม `compass_00…` เป็น `compass`, ตัด texture ที่ไม่ใช่ไอเท็ม (`_top`, `_side`, `_stage0` ฯลฯ) ออกจากบล็อก · รูปโหลดแบบ lazy
- หน้าต่างกว้างขึ้น (xwide), ช่องเล็กลงให้เห็นต่อแถวมากขึ้น
- **ไฟล์:** `gs_items.js`, `guistudio.css` · **สำรอง:** `_backup_gui_item_picker_2026-11-24/` · **ทดสอบ:** Playwright กับ .jar ทดสอบ 2,163 รูป (แสดง 1,704 ช่อง, แท็บ/ค้นหา/เลือก ใช้ได้)

## 2026-11-24 (35) — เทมเพลตใช้ไอเท็มจริงแทนไอคอนวาด
- ปุ่ม/การ์ดในเทมเพลตที่ใส่ไอคอน `minecraft:…` จะไม่วาดไอคอนลงรูปปุ่ม แต่ได้ **element Item ซ้อนอยู่บนปุ่ม** (`_item` → `build()` แตกเป็น Item) — Java = ไอเท็มจริง, Bedrock = texture ของเกม
  - Main Menu: ender_pearl / emerald / name_tag / gold_ingot / compass / redstone · Shop: diamond, gold_ingot, iron_sword, golden_apple, diamond_pickaxe, ender_pearl, nether_star, totem_of_undying (ราคา/คำสั่ง give ตามไอเท็ม) · Warps: compass, iron_sword, emerald, wheat, iron_pickaxe, ender_eye · Servers: diamond_pickaxe, heart_of_the_sea, fire_charge · Profile: แถวละไอเท็ม (name_tag, experience_bottle, gold_nugget, iron_sword, bone) · Daily Rewards: bread → nether_star
  - ไอคอนวาดยังใช้ที่ปุ่ม Close/Back/Yes/No, สเตตัสของ Character/Duel
- หน้าต่างเทมเพลต: ถ้ายังไม่มีรูปไอเท็ม มีลิงก์ **download Minecraft assets** ในหน้าต่างเลย
- รูปไอเท็มที่มีหลายเฟรม (compass, clock) ใช้ `_00` · พรีวิวแทน `%statistic_deaths%`
- **ไฟล์:** `gs_templates.js`, `gs_template_dialog.js`, `gs_items.js`, `gs_editor.js` · **สำรอง:** `_backup_gui_real_items_2026-11-24/`
- **ทดสอบ:** 14 layout × 23 kit (322 หน้า, Item 1,495 ชิ้น) ไม่ล้น/ไม่ซ้ำชื่อ, Playwright Shop / Main Menu / Profile (ชุดสี Midnight)

## 2026-11-24 (34) — Download Minecraft assets + ชุดสี Flat + เทมเพลต Wardrobe (outfits)
- **Download Minecraft assets** (Insert → Download Minecraft assets… / ปุ่มในหน้าต่าง Choose item…): ทำแบบเดียวกับ GameUI Editor ของ HexaCoreDev — `piston-meta.mojang.com/.../version_manifest_v2.json` → version json → `downloads.client.url` (.jar ของเวอร์ชันล่าสุด ~40 MB ครั้งเดียว) → แตกใน JS → เก็บรูป item/block (≤32px) + skin Steve/Alex ใน localStorage · ทดสอบจริงใน browser: Minecraft 26.3, item 831 + block 1300 รูป, skin `entity/player/wide/steve.png` ~2 วิ · ไม่ใส่ texture ลง export
- **หัว/ตัวผู้เล่นในโปรแกรมใช้ skin Steve จริงของเกม** (`GS.Items.skinArt`) เมื่อโหลด assets แล้ว (ยังไม่โหลด = รูปแทนเดิม) — ทั้ง canvas และพรีวิวเทมเพลต
- **ชุดสี Flat 5 ชุด** (Midnight, Carbon Red, Jade, Dusk Violet, Amber Line): พื้นสีเดียว + เส้นขอบ 1px มุมตัด, หัวเรื่องชิดซ้าย + เส้นคั่น, ปุ่มหลักสี / ปุ่มรอง (Close/Back, การ์ด) สีเข้ม — ใช้ได้กับทุก layout (`flatKit`, `flatBox`, `kit.flat` ใน panel/well/button/rimWell)
- **เทมเพลตใหม่ Wardrobe (outfits)** แบบตัวอย่างของ HexaCoreDev: ชื่อเมนูซ้าย + `%player_name%` ขวา, เวทีตัวผู้เล่น 3D, Hats / Capes / Pets / Emotes, Close · ตัวผู้เล่นใช้ **turn: mouse** = หมุนตัวตามเคอร์เซอร์ซ้าย-ขวา (±150°) — ใหม่ใน Properties + `JavaSession.turn`
- รวม **14 layout × 23 kit** (322 หน้า ไม่มีชิ้นล้น)
- **ไฟล์:** `gs_items.js`, `gs_templates.js`, `gs_editor.js`, `gs_model.js`, `gs_shell.js`, `gui.html`, `guistudio.css`, KaizerUI `JavaSession.java` · **สำรอง:** `_backup_gui_assets_flat_2026-11-24/`
- **ทดสอบ:** ดาวน์โหลดจริงจาก Mojang ใน browser pane, Playwright (เทมเพลต outfits ทุก kit, flat shop/leaderboard/wardrobe), ปลั๊กอิน compile กับ stub · ยังไม่ได้ลองใน exe/ในเกม

## 2026-11-24 (33) — Player Model 3D (Mannequin) + element Item (ไอเท็มจริงจากเกม) + เทมเพลต Wardrobe
- **Player Model บน Java = ตัวผู้เล่น 3D จริง** (แบบ NPC mirror ของปลั๊กอินอื่น): entity **Mannequin** (1.21.9+) ใน `ModelPart.java` — skin ของใครก็ได้ (`ResolvableProfile`, client โหลด skin เอง), **ใส่ชุดเกราะ/ของในมือของผู้เล่นคนนั้น** (`outfit: own`, อัปเดตทุก refresh และหลังกดปุ่ม 3 tick), ท่า standing/crouching, หมุน `turn: spin` / มองตามเคอร์เซอร์ `cursor`, มุม `angle` · ขนาดพอดีกล่อง (โมเดล 0.9375 × 1.875 บล็อก × attribute SCALE) วางหน้าเมนูเล็กน้อย · เห็นคนเดียว · เซิร์ฟเก่า/`java.models-3d: false`/ติ๊ก Real 3D ออก = แบบแบน (pixel) เหมือนเดิม · ⚠ แสงตามจุดที่ยืน (ถ้ำ/กลางคืนมืด)
- **element Item (K)**: `item` = `minecraft:…` / `itemsadder:ns:id` / `nexo:id` / `oraxen:id` / `slot:head|chest|legs|feet|hand|offhand` (ของที่ผู้เล่นใส่/ถือ) + placeholder · Enchant glint · Look: inventory (GUI) / 3D · Spin
  - Java: `ItemDisplay` ของจริง (`Items.java`, ปลั๊กอิน item ผ่าน reflection ไม่ต้อง depend) แบบ flat ถูกบีบแบนให้อยู่หน้าเมนู · config `java.item-flip` ถ้าเห็นด้านหลัง
  - Bedrock: texture ของเกมเอง `textures/items/<ชื่อ>` (ตารางชื่อที่ต่างจาก Java เช่น golden_* → gold_*, cooked_beef → beef_cooked) หรือใส่ Bedrock texture เอง · slot:/ไอเท็มปลั๊กอิน = ไม่แสดงบน Bedrock
- **รูปไอเท็มในโปรแกรม** (`gs_items.js` ใหม่): หน้าต่าง **Choose item…** ค้นหา + โหลดรูปจากไฟล์ของผู้ใช้เอง — `.jar` ของเกม (`%APPDATA%\.minecraft\versions\<ver>\<ver>.jar`) / resource pack `.zip` / โฟลเดอร์ (อ่าน zip ใน JS ด้วย DecompressionStream, ย่อ ≤32px, เก็บใน localStorage) — **ไม่ฝัง texture ของ Mojang ในโปรแกรม**
- **เทมเพลต:** ใหม่ **Wardrobe** (ปุ่มชุดเกราะ 4 ส่วน × leather…netherite + ถอด → `console:item replace entity %player_name% armor.<slot> with …`, ตัว 3D หมุน, ข้อมูลผู้เล่น) · Character: ตัว 3D มองตามเคอร์เซอร์ + ช่องเกราะ/มือแสดงของที่ใส่จริง (`slot:`) · รวม 13 layout × 18 kit
- **ไฟล์:** UI `gs_items.js` (ใหม่), `gs_model.js`, `gs_editor.js`, `gs_export.js`, `gs_shell.js`, `gs_templates.js`, `gs_template_dialog.js`, `gui.html`, `guistudio.css` · KaizerUI `ModelPart.java`, `Items.java` (ใหม่), `JavaSession.java`, `MenuDef.java`, `KaizerUIPlugin.java`, `resources/config.yml` (`item-flip`, `models-3d`), `plugin.yml` (softdepend ItemsAdder/Nexo/Oraxen), `pom.xml` (**paper-api 1.21.11** สำหรับ Mannequin)
- **สำรอง:** `_backup_gui_items_mannequin_2026-11-24/`
- **ทดสอบ:** Playwright (เพิ่ม Item + โหลด .jar ปลอม 26 รูป + เลือก, เก็บข้ามการเปิดใหม่, เทมเพลต Wardrobe/Character, export yml/Bedrock texture), ทุก layout × kit ไม่ล้น, ปลั๊กอิน compile `-Xlint:all` กับ stub ตามลายเซ็นจริง (Paper 1.21.11 javadoc) · **ยังไม่ได้ build ด้วย Maven และยังไม่ได้ลองในเกม** — จุดที่ต้องดู: ทิศ Mannequin/ItemDisplay, ขนาดตัว 3D, แสง, `paper_doll_renderer` ใน form

## 2026-11-24 (32) — GUI Studio: element Player Head / Player Model (วิธีเดียวกับ HUD)
- **element ใหม่** `player_head` (H) / `player_model` (L) — Insert, tool strip, Properties: **Whose skin** (`%player_name%` = คนที่เปิดเมนู หรือชื่อ / placeholder เช่น ajLeaderboards), Hat layer, Bedrock Doll W/H/X/Y (เว้นว่าง = คำนวณจากขนาด) · ในโปรแกรมแสดงรูปแทน `img/player_head.png` (ของ HUD) / `img/player_model.png` (ใหม่) · หัว/ตัวของคนอื่นมีกรอบประเหลือง
- **Bedrock** (เหมือน `codegen.rs` ของ HUD): `custom` `paper_doll_renderer` ใน panel — หัว = clip + doll 75×205 @ (1,18) ต่อกล่อง 35×31 (ปรับตามขนาด), ตัว = doll เต็มกล่อง · **คนอื่น = Steve** ตัดจาก `textures/entity/steve` ของเกมเอง (หน้า + hat / ทั้งตัว 7 ชิ้น) · ย่อ 640→480 ย่อ doll ด้วย · ⚠ ต้องลองในเกมว่า paper doll ใช้ใน server form ได้
- **Java** (แบบ BetterHud `heads`): font `<ns>:kz_skin` = pixel ขาว 1×1 แถวละ glyph (U+E000+r, ascent 1−r) + space −1/−8/−16/+1 · KaizerUI `Skins.java` โหลด skin (profile ของคนออนไลน์ / Mojang ตามชื่อ, cache 10 นาที) แล้วสร้างข้อความสีตาม skin: หัว 8×8 (+hat), ตัว 16×32 ด้านหน้า (แขน slim 3px, skin เก่า 64×32 ใช้ด้านขวากลับด้าน, jacket/sleeve/pants) · Steve ระหว่างรอ/ไม่มี skin · ชื่อจาก placeholder เปลี่ยน → โหลด skin ใหม่ตอน refresh · Motion ใช้ได้
- `MenuDef`: `PLAYER_HEAD` / `PLAYER_MODEL`, `player`, `hat`, studio `skin-font` · `JavaSession.playerPart/showSkin` · `/kui reload` ล้าง cache
- **เทมเพลตชุดผู้เล่น 5 layout** (Leaderboard, Friends, Character, Party, Duel — ใช้ได้ทั้ง 18 kit) ใช้ element จริงแทนรูป Steve ที่วาด (ลบ `skinArt/drawHead/drawBody` ออกแล้ว) · พรีวิวเทมเพลต/canvas แทนค่า placeholder ตัวอย่าง (ajLeaderboards ฯลฯ)
- **ไฟล์:** `gs_model.js`, `gs_editor.js`, `gs_export.js`, `gs_shell.js`, `gs_templates.js`, `gs_template_dialog.js`, `gui.html`, `guistudio.css`, `img/player_model.png` (ใหม่), KaizerUI `Skins.java` (ใหม่), `MenuDef.java`, `JavaSession.java`, `KaizerUIPlugin.java`
- **สำรอง:** `_backup_gui_templates_players_2026-11-24/`, `_backup_gui_player_elements_2026-11-24/`
- **ทดสอบ:** Playwright (เพิ่ม H/L, Properties, เทมเพลต Leaderboard/Character, export: `kz_skin.json`, paper doll 3, Steve), template 12 layout × 18 kit ไม่ล้น, `Skins` + `MenuDef` compile กับ stub และเทสต์วาง pixel (Steve/skin 64×64/slim/64×32 ตรงทุกจุด, ความกว้างบรรทัด = W) · JavaSession ยังไม่ได้ compile เต็ม (ไม่มี stub ครบ) · **ต้อง build ปลั๊กอินใหม่ + export ใหม่ + ลองในเกม**

## 2026-11-24 (31) — เอา Action bar ออก เหลือ Boss bar / Title
- ผลทดสอบ (30) ยืนยันว่า pack อ่านอะไรใน control ของ action bar ไม่ได้ จึงแยกข้อมูลจาก action bar ของปลั๊กอินอื่นไม่ได้ → **เอาตัวเลือก Action bar ออก** (ผู้ใช้ตัดสินใจ)
- `codegen.rs`: `HudChannel` เหลือ `Bossbar` / `Title` (`hudChannel: "actionbar"` ของโปรเจกต์เก่า → Bossbar), ลบ store/probe/data panel ของ action bar, Debug text ใช้กับ Title (บรรทัดเหลือง `in` / `saved`)
- UI: ลบ radio Action bar, `HUD_CHANNELS = ['bossbar','title']`
- KaizerMultiBar: `ChannelBarStrategy` เหลือ `TITLE` (`channel: actionbar` → bossbar + warning), ลบโค้ด action bar — **ไม่จำเป็นต้อง build ใหม่** (jar 2.1.0 เดิมใช้กับ title ได้เหมือนกัน)
- ทำงานบนเครื่อง desktop-o8a0sed ที่ `02-Convert\JsonUIMaker\desktop` (สำเนาเดียวกับ `01-Convert\desktop`)
- **สำรอง:** `_backup_remove_actionbar_2026-11-24/` · `cargo test` 26 ตัวผ่าน

## 2026-11-23 (30) — ทดสอบช่องทางในเกม + หลอด (bar) ที่มีเงื่อนไขไม่เคยขึ้น
- **ผลทดสอบในเกม:** **Title ใช้ได้** (HUD ขึ้น, `/title @s title hello` ขึ้นปกติและ HUD ไม่หาย) · **Action bar ใช้ไม่ได้:** pack อ่านอะไรที่อยู่ใน control ของ action bar ไม่ได้เลย (probe ค่าคงที่ `LIT` ก็ว่าง, `R=ROOT` นอก action bar อ่านได้) — `$actionbar_text` ใช้ได้แค่ข้างในตัวมันเอง (`T=` ขึ้น) จึงเก็บข้อมูลแยกจาก action bar ของปลั๊กอินอื่นไม่ได้
- **Export → Debug text** (เฉพาะ Action bar / Title, ไม่จำค่า): บรรทัดเหลืองบนจอ `in:` / `saved:` (+ probe R/L/V/B/D/T ของ action bar) และไม่ซ่อน title / action bar ของเกม — project field `hudChannelDebug`
- **Action bar:** data panel ย้ายไปอยู่ใน `hud_actionbar_text` ของเกม (modifications) แทน factory ของเราเอง (ก็ยังอ่านไม่ได้ตามข้างบน)
- **บั๊กเดิม (ทุกช่องทาง รวม Boss bar):** หลอดที่มี Visibility Condition ไม่เคยขึ้น — `codegen.rs` เอา expression ของเงื่อนไขทั้งก้อนไปใส่ในเครื่องหมาย `'…'` เหมือนเป็นข้อความ (ตั้งแต่ (8)) → แก้เป็น `(ระดับหลอด) and (เงื่อนไข)` · และ element ที่ไม่มีฟิลด์ `visibilityPapi` ได้เงื่อนไขปลอม `undefined == ''` (หลอดเลยต้องมี marker ที่ปลั๊กอินไม่เคยส่ง) → ถือว่าไม่มีเงื่อนไข
- ต้อง export .mcpack **และ** config.yml ใหม่ · เทสต์ใหม่ `bar_visibility_expressions`, `debug_overlay_keeps_vanilla_visible` (`cargo test` 26 ตัวผ่าน)
- **สำรอง:** `_backup_hudchannel2_2026-11-23/`, `_backup_hudchannel3_…`, `_backup_hudchannel4_…`

## 2026-11-23 (29) — HUD: เลือกช่องทางส่งข้อมูล Bedrock (Boss bar / Action bar / Title)
- **Export → Bedrock data channel:** Boss bar (เดิม, ค่าเริ่ม) / **Action bar** / **Title** — เก็บกับโปรเจกต์ (`hudChannel`) และ config.yml ได้ `bossbar.channel` ตรงกันอัตโนมัติ
- **Pack (`codegen.rs` `apply_hud_channel`):** Action bar / Title อ่านข้อความเดิมจาก panel `kz_hud_store` ที่จำข้อความล่าสุดที่มี prefix ของเรา (เทคนิค Preserve Title Texts) แทน `boss_bars` → HUD ไม่หายเมื่อปลั๊กอินอื่นส่ง title/action bar · ซ่อน title/action bar ของเราใน vanilla · ไม่ยุ่ง bossbar ของปลั๊กอินอื่นแล้ว (ไม่ใส่ override bossbar และ texture bar ใส) · Boss bar = output เหมือนเดิมทุก byte
- **KaizerMultiBar 2.1:** `ChannelBarStrategy` ส่งข้อความเดียวกับ bossbar (`CombinedBarStrategy.buildTitle`) ทาง action bar / title เฉพาะตอนข้อมูลเปลี่ยน + ทุก `channel-resend-ticks` (100) + join/respawn/เปลี่ยนโลก · `/kzbos` ใช้ได้ · ไม่เปิด PacketEvents priority ตอนไม่ใช้ bossbar
- **ต้อง build ปลั๊กอินใหม่ (2.1.0) และ export pack + config.yml ใหม่** · รายละเอียด + จุดที่ต้องดูในเกม: `docs/HUD_CHANNEL.md`
- **ไฟล์:** `codegen.rs`, `export.rs`, `ui/index.html`, `ui/js/{export,app,api,auth,codeview}.js`, KaizerMultiBar: `KaizerMultiBarCore.java`, `bar/BossBarManager.java`, `bar/strategy/{BarRenderStrategy,CombinedBarStrategy,ChannelBarStrategy(ใหม่)}.java`, `resources/{config,plugin}.yml`, `pom.xml` (2.1.0), `plugins-tool/README.md`
- **สำรอง:** `_backup_hudchannel_2026-11-23/`
- **ทดสอบ:** `cargo test --lib` (harness codegen+export) 24 ตัวผ่าน, `javac -Xlint:all` กับ stub ผ่าน, Playwright หน้าต่าง Export (เลือก/จำค่า/ส่ง `hudChannel`) · **ยังไม่ได้ทดสอบในเกม**

## 2026-11-23 (28) — Bedrock มีขนาดของตัวเอง (ย่อให้พอดีอัตโนมัติ)
- หน้าเมนูที่ใหญ่กว่า 480 × 270 ถูกย่อ **เฉพาะฝั่ง Bedrock** ตอน export (`bedrockScale`, `scaledMenu`, `scaledClips` ใน `gs_export.js`): ตำแหน่ง/ขนาด/ขนาดตัวหนังสือ/ระยะ animation × k (640×360 → 75% = 480×270) · Java ใช้ขนาดเดิม
- เอาคำเตือน "ใหญ่เกิน Bedrock" ออก · มุมมอง Bedrock ในโปรแกรมบอก "shown at 75% (480 × 270)" · ชื่อ preset: 640 × 360 — default
- **ไฟล์:** `gs_export.js`, `gs_model.js`, `gs_editor.js`

## 2026-11-23 (27) — ขนาดหน้าเริ่มต้น 640 × 360
- โปรเจกต์ใหม่ / หน้าใหม่ = 640×360 + Full screen (`DEFAULT_W/H` ใน `gs_model.js`) · New Menu Page ใช้ขนาดของหน้าปัจจุบัน
- เทมเพลต (ออกแบบที่ 320×180) วางกลางหน้า 640×360 ขนาดเท่าเดิม ไม่ขยาย · Replace ใช้ขนาดหน้าปัจจุบัน
- **ไฟล์:** `gs_model.js`, `gs_template_dialog.js`

## 2026-11-23 (26) — เอาคำถาม "ขยาย 2×" ตอนเปลี่ยน Size preset ออก
- ผู้ใช้ต้องการให้ของในหน้าขนาดเท่าเดิมเสมอ → เปลี่ยน Size preset แล้วของแค่เลื่อนไปอยู่กลางหน้า ไม่ถาม ไม่ขยาย
- **ไฟล์:** `gs_editor.js`

## 2026-11-23 (25) — Full screen เป็นค่าเริ่มต้น + เตือนเมื่อหน้าเมนูตั้งไม่เหมือนกัน
- เมนูใหม่ (และ New Menu Page) เปิด Full screen เป็นค่าเริ่มต้น (หน้าใหม่ใช้ค่าเดียวกับหน้าปัจจุบัน) · เลือก Size preset ไม่แอบเปิด Full screen เองแล้ว
- ถ้ามีบางหน้าเป็น Full screen แต่บางหน้าไม่ใช่:
  - หน้าที่ต่างมี ⚠ ในรายการ Menus
  - Properties ของหน้านั้นมีกล่องเตือน + ปุ่ม "Make this page full screen" / "All pages full screen"
  - ตอน Export มีคำเตือน (validate)
- ชื่อ Size preset ใหม่: 320×180 big pixels · 400×225 · 480×270 recommended (Java + Bedrock) · 640×360 fine detail (too big for Bedrock)
- **ไฟล์:** `gs_model.js`, `gs_editor.js`, `guistudio.css`

## 2026-11-23 (24) — `/kui fov reset` + ข้อความ FOV ที่ไม่ชวนเข้าใจผิด
- ผู้ใช้ตั้ง `/kui fov 110` (ค่าใน Options) แล้วเมนูใหญ่เกินจอมาก — ขนาดที่ได้จริงตรงกับ FOV ประมาณ 90 ไม่ใช่ 110 จึงไม่ควรบอกให้ "ใส่ค่า FOV ของตัวเอง" ตรง ๆ
- ข้อความ hint ใหม่: "เมนูใหญ่/เล็กไป → `/kui fov <ตัวเลข>` ตัวเลขมาก = เมนูใหญ่" · `/kui fov` เฉย ๆ บอกค่าปัจจุบัน · **`/kui fov reset`** กลับไปค่า default ของเซิร์ฟ (70)
- **ไฟล์:** `KuiCommand.java`, `KaizerUIPlugin.java`, `resources/config.yml`

## 2026-11-23 (23) — Full screen: เคอร์เซอร์ไปได้ทั้งจอ + ขยายเนื้อหา 2× ตามหน้า
- **อาการ:** เปิด Full screen แล้วเคอร์เซอร์ไปได้แค่กรอบกลางจอ (~75% ของจอ)
- **สาเหตุ:** (1) เคอร์เซอร์ถูกจำกัดในกรอบหน้าเมนู (640×360) เสมอ (2) ปลั๊กอินคิดขนาดเมนูจาก FOV 70 (เกมไม่ส่ง FOV มาให้เซิร์ฟ) ถ้าผู้เล่นตั้ง FOV กว้างกว่า หน้าเมนูก็เล็กกว่าจอ
- **แก้ (ปลั๊กอิน):** เมนู Full screen ให้เคอร์เซอร์ไปได้ทั้งจอที่คำนวณจาก FOV (`minX..maxX`, `minY..maxY` ใน `JavaSession`) ไม่ใช่แค่กรอบเมนู · ยังต้องตั้ง `/kui fov <ค่า FOV ของตัวเอง>` ให้ตรง เมนูจึงเต็มจอจริง
- **แก้ (GUI Studio):** เปลี่ยน Size preset เป็น 2× / 3× ของเดิมพอดี (เช่น 320×180 → 640×360) จะถามว่าขยายทุกชิ้นตามด้วยไหม (ตำแหน่ง, ขนาด, ขนาดตัวหนังสือ ×k — pixel art ยังคม)
- **ไฟล์:** `JavaSession.java`, `gs_editor.js`

## 2026-11-23 (22) — หน้าตา GUI Studio ให้เป็นชุดเดียวกับ HUD editor
- **สาเหตุที่ดูต่างกัน:** HUD โหลด `style.css` ก่อน `shell.css` ซึ่งมี reset (`* { margin:0; padding:0; box-sizing:border-box }`) แต่ `gui.html` ไม่มี → ปุ่ม/แถบ/แผงสูงกว่า ฟอนต์และระยะไม่ตรง
- **แก้:** ใส่ reset ชุดเดียวกันใน `guistudio.css` → ขนาดตรงกับ HUD แล้ว (title bar 32, options bar 38, tool strip 44, dock 340, status bar 24)
- เพิ่มแถบแท็บเอกสารแบบ HUD (ชื่อโปรเจกต์ + จุดยังไม่บันทึก) และย้าย **Java / Bedrock** ไปอยู่ตรงนั้นแบบเดียวกับ Canvas / Code / Split ของ HUD + ข้อมูลขนาดด้านขวา
- พื้นหลัง canvas (pasteboard ลายตาราง) และกรอบหน้าจอ (ขอบดำ + เงา) เหมือน HUD แทนลายเฉียง + เส้นประฟ้า
- แท็บ Menus / Properties / Layers มีไอคอนแบบ HUD · ปุ่ม Guide (?) ล่างสุดของ tool strip · title "— KaizerHUD Studio" · status bar แสดงขนาด GUI
- **ไฟล์:** `gui.html`, `guistudio.css`, `gs_shell.js`, `gs_editor.js`

## 2026-11-23 (21) — ซูมด้วยลูกกลิ้งเมาส์ + เลื่อนจอ
- **ลูกกลิ้ง = ซูม** ตรงจุดที่เมาส์ชี้ (จุดใต้เมาส์อยู่ที่เดิม) · Shift+ลูกกลิ้ง = เลื่อนซ้าย-ขวา · Ctrl +/− และปุ่มซูม = ซูมรอบกลางจอ
- **เลื่อนจอ:** กด Space ค้างแล้วลาก หรือกดลูกกลิ้ง (ปุ่มกลาง) ค้างแล้วลาก
- รอบหน้าเมนูมีพื้นที่ว่างครึ่งจอทุกด้าน จึงซูมเข้าที่ขอบ/มุมได้ · Fit (Ctrl+0) จัดหน้าไว้กลางจอ
- **ไฟล์:** `gs_editor.js`, `gs_shell.js`, `guistudio.css`

## 2026-11-23 (20) — ขอบ Shape 2D เบลอ: ต้นเหตุคือเงา
- **สาเหตุ:** "Soft shadow" ของ 2D ใช้ `shadowBlur` / `shadowOffset` ของ canvas ซึ่ง **ไม่โดน scale** → พอวาดละเอียด 4–16× เงากลายเป็นวงฟุ้งบาง ๆ รอบขอบทุกด้าน ดูเหมือนขอบเบลอ (และเงาเปิดอยู่เป็นค่าเริ่มต้น เพราะใช้ค่าเดียวกับ Drop shadow ของ Pixel)
- **แก้:** 2D มีสวิตช์ของตัวเอง `soft` (ปิดเป็นค่าเริ่มต้น) · ขนาดเงาคูณ res · offset มากกว่า blur จึงไม่ล้นขอบบน/ซ้าย · รูปเก่าที่มี `shadow` ยังมีเงา (แบบใหม่) — กด Edit shape แล้วเอา Soft shadow ออก/Apply เพื่ออัปเดตรูปที่ export
- **ไฟล์:** `gs_assets.js`

## 2026-11-23 (19) — Shape 2D / Icon smooth คมทุกระดับซูมในโปรแกรม
- ในโปรแกรม รูปที่ทำจาก Shapes 2D / Icons Smooth ถูกวาดใหม่ตามระดับซูม (× ความละเอียดจอ, สูงสุด 16×) จึงคมเหมือน vector ไม่เบลอตอนซูมเข้า (`Editor.liveArt`, มี cache) — เฉพาะการแสดงผล รูปที่ export ยังเป็นตาม Detail ของ element
- **ไฟล์:** `gs_editor.js`, `gs_assets.js` (`o.res` บังคับความละเอียดตอนวาด)

## 2026-11-23 (18) — รูปเนียน (Detail 2–8×) + รูปที่ขอบขวาใสไม่เบี้ยวแล้ว
- **ทำไมของ NxGui เนียน:** เขาวาดรูปละเอียดกว่าขนาดที่แสดง ส่วนของเราเดิมวาดรูป 1 pixel ต่อ 1 GUI px เสมอ (วงกลม 32 px = 32 จุด พอขยายบนจอเลยเป็นขั้นบันได)
- **แก้:** element รูป/ปุ่มมี **Detail in game** 1× / 2× / 4× / 8×
  - Java: texture ของ glyph ใหญ่ขึ้น d เท่า แต่ `height` ใน font เท่าเดิม → เกมย่อลงมา ได้ขอบเนียน (pack ใหญ่ขึ้น, 1 glyph ≤ 256 px จริง → 4× = ชิ้นละ ≤ 64 GUI px, validate เตือนถ้ารูปใหญ่ถูกตัดเกิน 6 ชิ้น)
  - Bedrock ใช้รูปตามจริงอยู่แล้ว
  - Shape 2D / Icon แบบ Smooth วาด 4× เป็นค่าเริ่มต้น (เลือก 1/2/4/8 ได้), Pixel ยังเป็น 1× · ในโปรแกรมแสดงแบบเนียนเมื่อ Detail > 1
  - รูปเก่าที่ทำไว้: กด **Edit shape… → Apply** เพื่อวาดใหม่แบบละเอียด · รูปที่ import เอง (เช่นรูปถ่าย) ตั้ง Detail 4× ได้
- **Java: รูปที่ด้านขวาโปร่งใสจะเลื่อนไปทางขวา** (เกมวัดความกว้าง glyph ถึงคอลัมน์สุดท้ายที่มีสี แล้ว TextDisplay จัดกึ่งกลางตามนั้น) → ใส่จุด alpha 1/255 ที่คอลัมน์ขวาสุดของทุก glyph (มองไม่เห็น เพราะ shader ทิ้ง alpha < 10%)
- หน้าต่าง Shapes & Icons: พิมพ์ช่องกว้างแล้วคลิกช่องสูงต่อ ช่องไม่หลุดแล้ว
- **ไฟล์:** `gs_assets.js`, `gs_editor.js`, `gs_export.js`, `gs_model.js`, `guistudio.css`

## 2026-11-23 (17) — เลือกหลายชิ้นแล้วย้ายพร้อมกัน (แบบ HUD editor)
- **เลือกหลายชิ้น:** Ctrl/Shift + คลิก (canvas หรือ Layers), ลากกรอบบนที่ว่าง (box-select, Ctrl/Shift = เพิ่ม), Ctrl+A ทั้งหมด, Shift+คลิกใน Layers = เลือกช่วง, Esc = ยกเลิก
- ลากชิ้นไหนก็ได้ = ย้ายทั้งกลุ่ม (snap ตามชิ้นที่จับ) · ลูกศร = ขยับทั้งกลุ่ม · Del / Ctrl+D / Ctrl+C / Ctrl+V / ขึ้น-ลง layer ทำกับทุกชิ้น
- คลิกเฉย ๆ (ไม่ลาก) ที่ชิ้นหนึ่งในกลุ่ม = เหลือชิ้นนั้นชิ้นเดียว
- แผง Properties ตอนเลือกหลายชิ้น: X/Y ของกลุ่ม, จัดแนว ซ้าย/กลาง/ขวา/บน/กลาง/ล่าง, เว้นระยะเท่ากัน ↔ ↕, กลางหน้า, กว้าง/สูงเท่าชิ้นหลัก, Motion ทีเดียวทุกชิ้น + "Delay between each" ให้โผล่ทีละชิ้น, ซ่อนทั้งหมด
- canvas: กรอบบางรอบทุกชิ้น, ชิ้นหลักกรอบหนา, กรอบประรอบทั้งกลุ่ม
- **ไฟล์:** `gs_editor.js`, `gs_shell.js`, `gui.html`, `guistudio.css`

## 2026-11-23 (16) — Shapes & Icons, Bedrock ไม่มีแถบมืดแล้ว
- **Shapes (S):** 15 รูปทรง (สี่เหลี่ยม, มุมมน, วงกลม, วงแหวน, สามเหลี่ยม, ข้าวหลามตัด, 5/6/8 เหลี่ยม, ดาว, หัวใจ, บวก, ลูกศร, chevron, เส้น)
  - **Pixel:** 1 px = 1 px ในเกม, ramp 6 เฉด (ชุดสีเดียวกับเทมเพลต หรือสร้างจากสีเดียว), ขอบดำ, นูน/บุ๋ม/แบน, จุดแสง, เงา 1 px
  - **2D:** ขอบเนียน, สีเดียว/ไล่สี, ความทึบ, เส้นขอบ, เงานุ่ม
  - ปุ่ม → Picture → **Shape…** วาดรูปปุ่มตามขนาดปุ่ม + ทำ hover ให้สว่างขึ้น 1 เฉด
- **Icons (O):** Pixelarticons (MIT, 1306) + Pixel Icon Library ของ HackerNoon (CC BY 4.0, 578) ใช้ได้แบบออฟไลน์ + ค้นทุกชุดฟรีของ Iconify ออนไลน์ (~275k, กรอง license: ไม่ต้องให้เครดิต / CC BY ได้, เฉพาะชุด pixel)
  - ตั้งขนาด/สี, Pixel (ขอบคม) หรือ Smooth, ขอบ, เงา · icon ที่ต้องให้เครดิตถูกเขียนลง README ของ export ให้
- รูปที่ทำในโปรแกรมเก็บค่าไว้ (`e.gen`) → **Edit shape… / Edit icon…** แก้ได้ภายหลัง
- **Bedrock:** แถบมืดตรงกลางจอมาจาก backdrop ของ Full screen ซึ่งกว้างได้แค่พื้นที่ของ form → ปิดไว้เป็นค่าเริ่มต้น เปิดได้ที่ "Dim the screen on Bedrock too" (ถ้าเปิดจะขยายให้คลุมทั้งจอ)
- เลือก Size preset แล้วชิ้นงานเลื่อนไปอยู่กลางขนาดใหม่ (ไม่ค้างมุมซ้ายบน)
- **ไฟล์:** `gs_assets.js` (ใหม่), `gs_iconsets.js` (ใหม่), `gs_editor.js`, `gs_export.js`, `gs_model.js`, `gs_shell.js`, `gs_templates.js`, `gui.html`, `guistudio.css`

## 2026-11-23 (15) — Motion: animation แบบ NxGui แต่เป็นแบบของเรา
- ดู NxGui Demo แล้ว (open animation, keyframe 5 track + easing 9 แบบ, loop/attention preset, hover/click animation, GIF) — ทำชุดของเราเอง
- **GUI Studio**
  - เมนู → **Opening** ทั้งหน้า 12 แบบ (รวม **Screen on (CRT)** แบบจอเก่าเปิด) + **Cascade** ให้ชิ้นต่าง ๆ ทยอยโผล่ตามลำดับ layer
  - element → **Motion**: Appear, Loop 10 แบบ (ปรับแรง/ความเร็วได้), ปุ่ม: Hover 5 แบบ + Click 4 แบบ (ปุ่มใหม่ตั้ง Grow + Squish ไว้ให้)
  - **Animated picture**: หลายรูป หรือ GIF (แตกเฟรมอัตโนมัติ) + fps
  - Preview (P) เล่น animation ทั้งหมด · ปุ่ม ▶ Play · เทมเพลตมีตัวเลือก **Animated**
- **Export:** clip เป็น keyframe ใน `menus/<id>.yml` · Bedrock เป็น JSON UI anim (offset/size/alpha) + `flip_book` สำหรับรูปเคลื่อนไหว
- **KaizerUI:** `Motion.java` ใหม่ · `JavaSession` ส่ง transformation + opacity ของ TextDisplay ทุก tick พร้อม interpolation (ลื่นฝั่ง client), รูปเคลื่อนไหวสลับ glyph, ฉากหลังจางเข้า
- รายละเอียด: `docs/GUI_STUDIO.md` ข้อ 7
- **ไฟล์:** `gs_motion.js` (ใหม่), `gs_model.js`, `gs_editor.js`, `gs_export.js`, `gs_template_dialog.js`, `gs_shell.js`, `gui.html`, `guistudio.css`, `Motion.java` (ใหม่), `MenuDef.java`, `JavaSession.java`

## 2026-11-23 (14) — เมนูเต็มจอ (Java) + บอกผู้เล่นให้ตั้ง FOV
- **Menu → Full screen:** ปลั๊กอินขยายเมนูให้สูง `java.fullscreen-fill` (0.94) ของจอ และกว้างได้ถึง ~98% ของจอ 16:9
  - ข้างหลังมีแผ่นมืดคลุมทั้งจอ: TextDisplay `" "` ยืดพื้นหลัง กว้าง 8d × สูง 5d บล็อก จึงครอบได้ทุก FOV/สัดส่วนจอ
  - ตั้งสี/ความทึบได้ (`backdrop`, `backdrop-alpha`)
  - Bedrock: มีแผ่นมืดเต็มจอ ส่วนเมนูขนาดเท่าที่ออกแบบ
- **Size preset:** 320×180 / 400×225 / 480×270 / 640×360 (ขนาดสูงสุด 960) — 480×270 + Full screen ≈ GUI scale 4 ที่ 1080p
- **เทมเพลต:** มีตัวเลือก "Full screen on Java" (เปิดไว้เป็นค่าเริ่มต้น)
- **ปลั๊กอินบอกผู้เล่นครั้งเดียว** ว่าเมนูคิดขนาดตาม FOV เท่าไร และให้ใช้ `/kui fov <ค่า>` (เกมไม่ส่ง FOV มาให้เซิร์ฟ)
- Bedrock เตือนเมื่อเมนูใหญ่เกิน 480×270
- **ไฟล์:** `gs_model.js`, `gs_editor.js`, `gs_export.js`, `gs_template_dialog.js`, `guistudio.css`, `MenuDef.java`, `JavaSession.java`, `JavaMenus.java`, `KaizerUIPlugin.java`, `resources/config.yml`

## 2026-11-23 (13) — KaizerUI ทดสอบรอบ 2: รอยต่อ, มือบัง, กด E ได้, เปิดครั้งแรกเคอร์เซอร์ค้าง, layer ในโปรแกรม
- **Java: เห็นเส้นตรงรอยต่อของ tile (กลางหน้าต่าง)**
  - **แก้:** tile ซ้อนกับ tile ขวา/ล่าง 1px (ขนาดสูงสุดจึงเป็น 255+1) ขอบเลยไม่ชนกันพอดีจนเกิดช่อง
- **Java: แขน/มือเหวี่ยงมาบังเมนู**
  - **สาเหตุ:** client วาดมือเปล่าของตัวเองเสมอ ยกเว้นตอนตัวเองล่องหน (`ItemInHandRenderer`: `!player.isInvisible()`)
  - **แก้:** ส่ง metadata flag "invisible" ให้ client ของผู้เล่นคนเดียว (คนอื่นยังเห็นปกติ) ส่งซ้ำทุก 20 tick แล้วคืนตอนปิด
- **Java: กด E เปิดกระเป๋าได้ระหว่างเปิดเมนู**
  - **สาเหตุ:** client เปิดกระเป๋าเอง ยกเว้นตอนขี่ entity ที่มี inventory ของตัวเอง (`isServerControlledInventory` → ส่งคำขอไปเซิร์ฟแทน)
  - **แก้:**
    - พาหนะเปลี่ยนเป็นม้าที่ยังไม่เชื่อง ล่องหน เงียบ ไม่มี AI ตกไม่ได้ และอมตะ → กด E แล้วไม่มีอะไรเปิด
    - ถ้ามีปลั๊กอินกันม้า spawn จะใช้ display entity แทน
    - config `java.vehicle: horse|display`
    - `InventoryOpenEvent` ถูกยกเลิกระหว่างเปิดเมนู
- **Java: เปิดเมนูครั้งแรกหลังเข้าเกม เคอร์เซอร์ไม่ขยับ (ครั้งต่อไปปกติ)**
  - **แก้:**
    - ขึ้นพาหนะช้าลง 1 tick
    - ส่ง packet ขึ้นพาหนะ (SetPassengers) + camera + ซ่อนมือซ้ำที่ 3 / 10 / 30 tick
- **GUI Studio: คลิกรูปพื้นหลังแล้วมันขึ้นมาบังทุกอย่าง**
  - **สาเหตุ:** CSS ตั้ง `z-index: 9999` ให้ element ที่เลือก
  - **แก้:**
    - ลำดับบน canvas ตรงกับ Layers เสมอ ส่วนกรอบเลือก + จุดย่อขยายวาดเป็นชั้นแยกด้านบน
    - **Alt+คลิก** = เลือกชิ้นที่อยู่ข้างใต้ (กดซ้ำวนลงไปเรื่อย ๆ)
- **ไฟล์:** `gs_export.js`, `gs_editor.js`, `gs_shell.js`, `guistudio.css`, `JavaSession.java`, `JavaMenus.java`, `CameraHook.java`, `KaizerUIPlugin.java`, `resources/config.yml`

## 2026-11-23 (12) — KaizerUI ทดสอบในเกมครั้งแรก: แก้ 3 อาการ
- **Bedrock: ทุกปุ่ม/ข้อความขึ้นข้อความของปุ่มแรก ("Warps")**
  - **สาเหตุ:** `collection_index` บน control ที่วางเองไม่มีผล (อ่าน index 0 เสมอ)
  - **แก้:** สร้างปุ่มด้วย factory ของเกม (`stack_panel` + `factory` + `#collection_length`) แล้วแต่ละ item แสดงเฉพาะ element ที่ marker ตรง (`kzs03|ข้อความ` → `#visible` / `#kz_text`) ปลั๊กอินใส่ marker นำหน้าข้อความปุ่มให้แล้ว
  - **ต้อง export pack ใหม่และใช้ปลั๊กอินใหม่คู่กัน**
- **Java: พื้นหลังหน้าต่างหายเหลือแต่ปุ่ม (มีกล่องสี่เหลี่ยมโผล่เหนือหัวเรื่อง)**
  - **สาเหตุ:** font atlas ของ client มีขนาด 256×256 (`FontTexture.SIZE`) glyph ที่ใหญ่กว่านี้จึงกลายเป็น missing glyph
  - **แก้:** รูปที่เกิน 256px ถูกแบ่งเป็น tile (เช่น 320×180 → 2 × 160×180) โดย yml ใช้ `tiles:` / `hover-tiles:` และปลั๊กอินสร้าง TextDisplay ต่อ tile
- **Java: เคอร์เซอร์ไม่ขยับ แต่ของในมือส่าย**
  - **สาเหตุ:** client ที่กล้องอยู่ entity อื่นจะไม่ส่ง rotation (`LocalPlayer.sendPosition` → `isControlledCamera`) ยกเว้นตอนขี่ entity ซึ่งจะส่ง `Rot` ทุก tick
  - **แก้:**
    - ให้ผู้เล่นขี่ ItemDisplay ที่มองไม่เห็นตรงจุดที่ยืน แล้วอ่าน yaw/pitch ทุก tick
    - ย่อตัว (ลงจากพาหนะ) = ออกเมนู
    - ซ่อนของในมือฝั่ง client ด้วย SetSlot ว่าง แล้วคืนด้วย `updateInventory()` ตอนปิด
    - ปิดเมนูแล้ววาร์ปกลับจุดเดิม
- **ไฟล์:** `gs_export.js`, `MenuDef.java`, `JavaSession.java`, `JavaMenus.java`, `CameraHook.java`, `BedrockMenus.java`
- **ทดสอบ:** `javac -Xlint:all` กับ stub ผ่าน, export/เทมเพลตผ่าน · ต้อง build ปลั๊กอินใหม่และลองในเกมอีกรอบ

## 2026-11-23 (11) — GUI Studio: Java pack ลง ItemsAdder / Nexo / Oraxen ได้เลย
- **หน้าต่าง Export เลือกปลายทาง Java pack ได้:**
  - **ItemsAdder** (ค่าเริ่มต้น) → `plugins/ItemsAdder/contents/<ns>_gui/resourcepack/` จากนั้นสั่ง `/iazip`
  - Nexo → `plugins/Nexo/pack/external_packs/<ns>_gui/`
  - Oraxen → `plugins/Oraxen/pack/assets/`
  - แบบ zip แยก (แบบเดิม)
  - ใช้โฟลเดอร์เดียวกับ Java HUD export · ค่าที่เลือกเก็บไว้กับโปรเจกต์
- **Rust `guistudio.rs`:** `java_pack` / `java_pack_name` ไม่บังคับแล้ว (ไม่มี = ไม่ทำ zip ซ้อน) + เทสต์ใหม่ → `cargo test --lib` 42 ตัวผ่าน
- **`build_kaizerui.bat`:** หา JDK 21+ เอง (JDK 25 ใช้ได้) และถ้าไม่มี Maven จะดาวน์โหลด Maven 3.9.9 แบบพกพาไว้ที่ `plugins-tool\.tools\` ครั้งเดียว

## 2026-11-23 (10) — GUI Studio: เทมเพลตเมนู
- **Insert → Menu from Template…** (คีย์ M / ปุ่มบน tool strip)
  - **Layout 7 แบบ:** Main Menu, Shop, Warps, Server Selector, Profile, Daily Rewards, Confirm
  - **สี:** kit 18 ชุดเดียวกับ HUD Forge
  - **พรีวิว:** ภาพใหญ่ที่ชี้เมาส์ดู hover ได้
- **ตัวเลือก:** เพิ่มเป็นหน้าใหม่ / แทนหน้าปัจจุบัน / **สร้างชุด 6 หน้าที่เชื่อมกันแล้ว** (`open:` + ปุ่ม Back, `/menu` และ `/shop`)
- **รูปเป็น pixel art 1:1:**
  - กรอบหน้าต่าง, ป้ายหัวเรื่อง, ปุ่มนูน + hover, ช่องยุบ
  - ไอคอน 19 แบบ วาดตามกฎเดียวกับ HUD Forge
- **ไฟล์ใหม่:** `ui/js/guistudio/gs_templates.js`, `gs_template_dialog.js`
- **แก้:** `gui.html`, `guistudio.css`, `gs_shell.js` (คำสั่ง templates, `modal` รับ `cls`), `gs_editor.js` (ลิงก์ในช่อง Layers ว่าง)
- **ทดสอบ:** Playwright ทุก layout × 6 kit, หน้าต่างเลือก, สร้างชุดเชื่อม 6 หน้า + Undo, export (60 glyph) ผ่าน · ยังไม่ได้ดูในเกม

## 2026-11-23 (9) — GUI Studio + ปลั๊กอิน KaizerUI (ใหม่ แยกจาก HUD)
- **GUI Studio** (`ui/gui.html`): workspace ใหม่สำหรับเมนูแบบใช้เมาส์ ไม่ใช่ chest
  - สลับได้ด้วยปุ่ม **HUD / GUI** บน title bar หรือ File → Switch to GUI Studio
  - มีหลายหน้าเมนู, ใส่รูป / ปุ่ม (รูปปกติ + hover, label, action) / ข้อความ (PAPI) ได้
  - ลาก/ย่อขยาย, snap, undo, copy/paste, Preview (P) เล่นได้เหมือนในเกม, สลับดูแบบ Java/Bedrock
  - ตั้งค่า cursor และค่าในเกมได้
- **Export zip เดียว:**
  - `plugins/KaizerUI/menus/*.yml` + `studio.yml`
  - Bedrock `.mcpack` อยู่ใน `plugins/Geyser-Spigot/packs/` (`server_form.json` วาด form ใหม่ตามเมนู)
  - Java resource pack (font glyph)
  - README
- **ปลั๊กอินใหม่ `plugins-tool/KaizerUI`:**
  - Java: hologram TextDisplay + ล็อคกล้องด้วย PacketEvents (หันหัว = ขยับเคอร์เซอร์, ตี = กด, ย่อ = ออก) ถ้าไม่มี PacketEvents ใช้ crosshair แทน
  - Bedrock: SimpleForm ผ่าน Floodgate/Geyser
  - action: player/console/open/close/message/sound/server
  - คำสั่ง `/kui open|close|list|reload|fov|speed` และคำสั่งของแต่ละเมนูเอง
- **แยกจาก HUD:**
  - โปรเจกต์เก็บที่ `%APPDATA%\xyz.kaizermc.hudmaker\gui_projects\`
  - Rust `guistudio.rs` ใช้ command `gui_*` ของตัวเอง
  - HUD editor แก้แค่ `index.html` (+1 script) และ `lib.rs` (ลงทะเบียน module)
- **ไฟล์ใหม่:**
  - `ui/gui.html`, `ui/css/guistudio.css`, `ui/js/guistudio/gs_{model,editor,export,shell}.js`, `ui/js/workspace_switch.js`
  - `src-tauri/src/guistudio.rs`
  - `plugins-tool/KaizerUI/**`, `build_kaizerui.bat`
  - `docs/GUI_STUDIO.md`
- **สำรอง:** `_backup_guistudio_2026-11-23/` (lib.rs, index.html, HANDOFF.md, CHANGELOG, plugins-tool/README.md)
- **ทดสอบแล้ว:**
  - `cargo check` + `cargo test --lib` 41 ตัวผ่าน (container Linux)
  - Playwright UI + export
  - zip จริงผ่าน `build_export`
  - ปลั๊กอิน compile ผ่านกับ stub API (ยังไม่ได้ build ด้วย Maven จริง)
  - **ยังไม่ได้ build exe และยังไม่ได้ทดสอบในเกม**

## 2026-11-23 (8) — Visibility Condition หลายข้อ (ต้องจริงทุกข้อ)
- **Properties → Visibility Condition:** ปุ่ม **+ Add condition** เพิ่มเงื่อนไข AND ได้ไม่จำกัด (แต่ละข้อมี PAPI / Operator / Value / Invert + ปุ่ม ✕ ลบ) · เก็บใน `visibilityExtra: [{ papi, op, value, invert }]` (เงื่อนไขแรกยังเป็นช่องเดิม — โปรเจกต์เก่าเปิดได้เหมือนเดิม) · Duplicate คัดลอกไปด้วย
- **Import:** เงื่อนไขทุกข้อของ pack มาครบอัตโนมัติ (เดิมเก็บข้อแรก ที่เหลือเป็นคำเตือน) — Fantasy HUD 150 ชิ้น (ไอคอนเกราะแยกวัสดุ 7–8 ข้อ/ชิ้น), เงื่อนไขของ layout BetterHud ต่อท้ายเงื่อนไขของชิ้น (HudGraveyard 8 ชิ้น = ของชิ้น + gamemode), MythicHUD/HappyHUD: ของ asset + ของ layer
- **Export Bedrock (`codegen.rs`):** ชิ้นแสดงเมื่อ marker ครบทุกข้อ (`(a and b) and c`) · `!=` และ Invert ใช้ marker เดียวกับ `==` ของมันแบบ "ต้องไม่มี" → config.yml มีแต่ `==` / `invert: false` และ marker อยู่ในชื่อ bossbar เฉพาะตอน `==` จริง (ชุดเกราะ Fantasy: แต่ละช่องมีจริงได้ทีละ 1 แทน 5) — ปลั๊กอินไม่ต้องแก้
- **Export Java (`javaexport.js`):** BetterHud `conditions` 1..n, MythicHUD `conditions` หลายบรรทัด · เงื่อนไขที่ตั้งเองในโปรแกรม (ไม่ได้มาจาก import) ส่งออกด้วยแล้ว (เดิมต้องมี `visibilityEnabled` ซึ่ง UI ไม่เคยตั้ง)
- คำเตือนความยาว bossbar (`export.js`): นับ marker เท่าที่จริงพร้อมกันได้มากสุด (`==` ของ placeholder เดียวกันจริงได้ทีละค่า)
- ต้อง export ใหม่ทั้ง .mcpack และ config.yml · ข้อความ (text) ยังซ่อนด้วยเงื่อนไขไม่ได้ใน Bedrock เหมือนเดิม

## 2026-11-23 (7) — แก้ค่าคงที่ข้อความรอบ (6): ในเกมต่ำกว่าพรีวิว 2px
- **อาการ:** หลัง (6) พรีวิวตรงกับไอคอนแล้ว แต่ในเกมข้อความแถวบนต่ำกว่า 2px ทุกตัว (ยึดบนและยึดล่างเท่ากัน) และข้อความกึ่งกลางสูงกว่า 1px
- **สาเหตุ:** ค่าคงที่ของ (6) คำนวณจากสมมติฐานว่า WebView2 วาง Minecraftia ต่างจาก Linux ~1.7px ซึ่งไม่จริง (ภาพรอบนี้วัดได้ว่า pivot ถูกแล้ว ผิดแค่ค่าคงที่)
- **แก้ (`preview.js` `BEDROCK_TEXT`):** normal = label สูง 10, ตัวเลขเริ่ม 1px ใต้ขอบบน label (`boxH 10`, `inkTop 1`) — ตรงทั้งแถวบน แถวล่าง และกึ่งกลางจากภาพเดียวกัน · small `5 / 1.25` · large `15 / 1.5` (ยังไม่ได้วัด)
- offset ที่ import ได้ตอนนี้ตรงกับค่า default เดิมของโปรแกรมพอดี (ชิดซ้าย/ขวา ยึดล่าง `-4.1`, ยึดบน `-5.1`, center `1.4`)
- โปรเจกต์ที่ import ด้วย (6) (text_offset `-2.1` ฯลฯ): เปิดแล้วพรีวิวจะแสดงต่ำลง 2px ตามที่เห็นในเกม — import ใหม่ หรือเลื่อนขึ้นให้ตรงในพรีวิว

## 2026-11-23 (6) — พรีวิวข้อความ = ในเกม (ทุกข้อความ) + กรอบเลือก hotbar ทับไอเท็ม
- **อาการ:** ข้อความในพรีวิวกับในเกมไม่ตรงกัน ทั้งที่สร้างเองและที่ import (Simple HUD: แถวบนในเกมสูงกว่า ~1px, ยึดล่างสูงกว่า ~2px, ข้อความกึ่งกลางต่ำกว่า ~2.7px)
- **สาเหตุ:** (1) พรีวิวไม่คิด pivot ของ panel 1×1 (ยึดล่าง/ขวา Bedrock เลื่อนขึ้น/ซ้าย 1px) (2) ค่าชดเชยเดิมคิดจากเมตริกฟอนต์ของ Linux แต่ WebView2 บน Windows วาง Minecraftia ต่างกัน ~1.7px — แก้ทีละ pack จึงไม่มีวันตรงทุกกรณี
- **แก้ (`preview.js` `BEDROCK_TEXT` / `KzTextModel`):** คำนวณตำแหน่งที่เกมวาดจริงจากสิ่งที่ export (panel pivot + label anchor + offset เดียวกับ `codegen.rs text_offset_delta`) แล้ววางยอดตัวเลขด้วยเมตริกฟอนต์ที่วัดตอนรัน → ผลเท่ากันทั้ง Windows/Linux, ทุก anchor, ทุก alignment · ลบ `PREVIEW_TEXT_Y_CAL` · ขนาดฟอนต์พรีวิว default = normal ตรงกับ export
- **Import (`javaimport.js`):** ตั้ง `text_offset` ให้ยอดตัวเลข (ซ้าย/ขวา) หรือกึ่งกลาง (center) ลงที่จุดของ pack Java พอดีในเกม (ทุกขนาดฟอนต์ใน `text_offsets`) — ไม่ต้องเลื่อนเองหลัง import
- export (ตำแหน่งในเกม) ไม่เปลี่ยน — ข้อความที่เคยเลื่อนตามพรีวิวเก่า ให้ดูตำแหน่งใหม่ในพรีวิวแล้วเลื่อนกลับ หรือ import ใหม่ · ค่า large ยังเป็นค่าประมาณ (ยังไม่ได้วัดในเกม)
- **Hotbar (`codegen.rs`):** `hotbar_slot_selected_image` layer 8 → 2 (ใต้ไอคอนไอเท็ม layer 3 เหมือน Java) — กรอบเลือกแบบทึบ (Simple HUD) ไม่บังไอเท็มแล้ว ต้อง export .mcpack ใหม่

## 2026-11-23 (5) — เงื่อนไข effect ทำให้เซิร์ฟ error ทุก tick
- **อาการ:** log เซิร์ฟเวอร์ (Paper 26.2) ขึ้น `IllegalArgumentException ... CraftPotionEffectType ... PlayerExpansion` จาก `VisibilityConditionManager.evaluate` ซ้ำทุกรอบ
- **สาเหตุ:** importer แปลง MythicHUD `effect{e=damage_resistance}` เป็น `%player_has_potioneffect_DAMAGE_RESISTANCE%` — ชื่อ Bukkit แบบเก่าที่ Paper 26 ไม่รู้จักแล้ว ปลั๊กอินไม่ได้ดัก error จึงข้ามการส่ง bossbar ทั้งรอบ
- **แก้ (`javahud.rs` `modern_effect_name`):** แปลงชื่อเก่าเป็น key ปัจจุบัน (DAMAGE_RESISTANCE→RESISTANCE, SLOW→SLOWNESS, FAST_DIGGING→HASTE, SLOW_DIGGING→MINING_FATIGUE, INCREASE_DAMAGE→STRENGTH, HEAL→INSTANT_HEALTH, HARM→INSTANT_DAMAGE, JUMP→JUMP_BOOST, CONFUSION→NAUSEA, UNLUCK→BAD_LUCK)
- โปรเจกต์ที่ import ไปแล้วต้องแก้ Visibility PAPI ของชิ้นนั้นเอง (หรือ import ใหม่)
- **ค้าง:** KaizerMultiBar ควรดัก exception ต่อเงื่อนไข (placeholder พังตัวเดียวไม่ควรหยุด HUD ทั้งแถบ) — ต้องแก้ `VisibilityConditionManager.java` แล้ว build ด้วย Maven

## 2026-11-23 (4) — ทดสอบเร็ว + ป้ายข้อความสั้นลง
- พรีวิวข้อความแสดง `text1`, `text2` … แทน `text_score #1` (เลข = Index ของ slot)
- **`dev_kaizerhud.bat`**: เปิดโปรแกรมแบบ debug (`cargo run --no-default-features`) ที่โหลด UI จาก `ui\` ผ่าน `http://localhost:8765` (`dev_ui_server.ps1` — PowerShell มีในทุก Windows ไม่ต้องลง Python; เดิมใช้ python แล้วเปิดไม่ขึ้นบนเครื่องผู้ใช้) — แก้ html/js/css แล้วกด **F5** ในโปรแกรมได้ทันที ไม่ต้อง build · แก้ Rust = ปิดแล้วรันไฟล์นี้ใหม่ (คอมไพล์เฉพาะส่วนที่แก้) · รอบแรกคอมไพล์ทั้งหมดครั้งเดียว
- `tauri.conf.json`: เพิ่ม `build.devUrl` (ใช้เฉพาะ build ที่ไม่มี feature `custom-protocol` — exe release ยังฝัง ui/ เหมือนเดิม)
- `shell.js`: F5 / Ctrl+R ใช้ได้เฉพาะ dev mode (port 8765 บน localhost) · ทดสอบบนเครื่องผู้ใช้แล้ว: เปิดได้ คอมไพล์ซ้ำ 25 วินาที · release ยังบล็อกเหมือนเดิม

## 2026-11-23 (3) — พรีวิวข้อความ normal ไม่ตรงกับในเกม
- **อาการ:** ข้อความที่ import มา (HudGraveyard ซ้ายบน) ในพรีวิวดูลอยสูงกว่าไอคอน ผู้ใช้เลื่อนลงให้ตรง → ในเกมต่ำเกินและตัวใหญ่กว่า
- **สาเหตุ:** พรีวิววาดฟอนต์ normal ที่ 6px (ตัวเลขสูง 5.3) แต่ Bedrock สูง 7 และไม่มีค่าชดเชยแนวตั้งของ normal แถวบน (วาดสูงกว่าเกม 4.4px) — วัดจากภาพในเกม GUI scale 3
- **แก้ (`preview.js`):** `PREVIEW_FONT_PX` small 4 / normal 8 / large 12 (Minecraftia 8px = ตัวเลข 7px, "10:08" กว้าง 25 เท่าในเกม) + `PREVIEW_TEXT_Y_CAL.top.normal = 3.9` · ใช้กับ XP Level Number ด้วย · large ยังไม่ได้วัด
- export ไม่เปลี่ยน: ตำแหน่งในเกมเหมือนเดิม แค่พรีวิวตรงกับเกมแล้ว — ข้อความที่เคยเลื่อนตามพรีวิวเก่าต้องเลื่อนกลับ (หรือ import ใหม่)

## 2026-11-23 (2) — แก้ HUD ที่มีเงื่อนไขเยอะแล้วชิ้นส่วนหายในเกม
- **อาการ:** HudGraveyard ในเกมเห็นแค่บางชิ้น (กรอบล่างซ้าย, ตัว S มุมขวาบน) ส่วนกรอบอื่น / หัว / ไส้หลอด bar หายหมด
- **สาเหตุ:** ทุกชิ้นที่มี Visibility ได้ marker ของตัวเอง (`vib_img_12` ฯลฯ 11–12 byte) และปลั๊กอินต่อ `@marker` ทุกตัวที่จริงไว้ท้ายชื่อ bossbar — 18 เงื่อนไขทำให้ชื่อยาวเกินที่ Bedrock อ่าน marker ท้าย ๆ ถูกตัด (ในภาพเกมตัดราว ๆ byte ที่ 150) ลำดับ marker มาจาก HashSet จึงหายแบบสุ่ม ๆ
- **แก้ (`codegen.rs` `visibility_keys`):** เงื่อนไขเดียวกันใช้ marker ร่วมกัน + ชื่อสั้นความยาวเท่ากัน `v01`, `v02` … (`@v01` ไม่ชนกับ `@v010`) → HudGraveyard เหลือ 9 marker ตัวละ 4 byte (เดิม 18 ตัว) จริงพร้อมกันสูงสุด 2 ตัว
- คำเตือนความยาว bossbar ตอน Export (`export.js`) นับ marker ของเงื่อนไขด้วยแล้ว
- ต้อง export ใหม่ทั้ง .mcpack **และ** config.yml (ชื่อ marker เปลี่ยน)

## 2026-11-23 — Image Animation + import pack ชุดใหม่
**เพิ่ม**
- รูปเคลื่อนไหว (Properties → Image → Animation): เลือกหลายเฟรม / GIF / WebP / APNG / sprite sheet, ตั้ง FPS, พรีวิวเล่นบน canvas, Pause/Play
- Export Bedrock: แถบเฟรมแนวนอน + `flip_book` (`uv` / `uv_size`) · Export Java: BetterHud `sequence`
- Import BetterHud `sequence` เป็น animation (HudGraveyard: 11 ชิ้น 8 เฟรม 5 fps)
- Import: `placeholders/*.yml`, เงื่อนไขระดับ layout, MythicHUD `effect{}`, add-on ที่มีแค่ `layouts/`

**แก้บั๊ก**
- Import ไฟล์ YAML ที่มี key ซ้ำ ทิ้งทั้งไฟล์ (Fantasy HUD ได้ 0 ชิ้น → 123)
- BetterHud config ที่ไม่มีคีย์ `disable-legacy-offset` วางต่ำไป 54px (HudGraveyard)
- hotbar ซ้ำจาก cache ของ Nexo/ItemsAdder ในรายการ import
- Change Image: เพิ่ม element ใหม่ซ้อน และ texture path มีช่องว่าง (`textures / ns /name `)
- รูป JPEG/WebP ถูกเขียนลง pack เป็นไฟล์ .png ทั้งที่ไม่ใช่ PNG
- Java export ข้าม bar XP

**ไฟล์ที่แก้:** `src-tauri/src/{codegen,export,javahud}.rs`, `ui/index.html`, `ui/css/shell.css`, `ui/js/{app,controls,preview,codeview,javaimport,javaexport}.js` · ใหม่: `ui/js/animation.js`, `docs/HUD_ANIMATION.md`
**สำรอง:** `_backup_animation_2026-11-23/`
**ทดสอบ:** `cargo test --lib` 34 ตัวผ่าน (ใน container แยก ไม่มี Tauri), Playwright UI · **ยังไม่ได้ build exe และยังไม่ได้ทดสอบในเกม**
