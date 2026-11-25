# Java HUD Import — BetterHud / HappyHUD / MythicHUD / CustomNameplates

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Imports existing Java Edition HUD packs (`.zip` or folder) into KaizerHUD Studio (`src-tauri/src/javahud.rs` + `ui/js/javaimport.js`) via **File → Import Java HUD Pack**.

- **Auto-Detection by Signature:** Detects `BetterHud` (`huds/*.yml` + `layouts/*.yml` + `images/*.yml`), `HappyHUD` (`layout/*.yml` + `assets/hud/*.yml`), `MythicHUD` (`layouts/*.yml` + `assets/hud/` or `hud_assets/hud/`), `CustomNameplates`, and resource pack hotbars (`widgets.png` / 1.20.2+ `sprites/hud/`). Supports multiple variants inside a single archive.
- **Supported Mapping:** Static & animated (`sequence`) images, built-in and custom PAPI bars (sliced to 16 steps), PAPI text labels with exact `text_offsets` alignment, player heads, multi-condition visibility (`visibilityPapi` + `visibilityExtra`), and duplicate YAML key handling (`drop_duplicate_keys`, last key wins like SnakeYAML).
- **Coordinate Normalization:** Converts BetterHud (top-left % + legacy `-54px` offset handling) and HappyHUD/MythicHUD (bottom-left % + `align`) to Bedrock's `480×270` anchor grid, avoiding the 3 top-center Bedrock buttons and aligning bottom hotbars.

---

## ภาษาไทย

# Java HUD Import — ผลสำรวจ + สเปกเตรียมทำ

> สร้าง 2026-11-20 · **ทำแล้ว (v1)** ดูข้อ 10 · อ้างอิง pack ใน `02-Convert/Template_HUD` (4 pack) + wiki BetterHud / MythicHUD / PlaceholderAPI

## 1. สรุปสั้น
- **ทำได้** — pack ที่ขายกันเป็น YAML + PNG อ่านด้วยเครื่องได้ทั้งหมด ตรวจรูปแบบอัตโนมัติจากโครงสร้างโฟลเดอร์ได้ชัดเจน
- 4 pack ที่มี = **3 ปลั๊กอินคนละตัว**: BetterHud (2 pack), HappyHUD (1), MythicHUD (1)
  - HappyHUD คือรุ่นก่อนของ MythicHUD → schema เกือบเหมือนกัน ใช้ parser ตัวเดียวกันได้
  - ดังนั้นจริง ๆ มี **2 ตระกูล**: `BetterHud` และ `HappyHUD/MythicHUD`
- ภายใน zip เดียวมัก **มีหลาย variant** (For Nexo / For Oraxen / For ItemsAdder / 1.21.10+ / vanilla / mmo) → ต้องให้ผู้ใช้เลือก
- นำเข้าได้ดี: รูปพื้นหลัง, bar (HP/Food/Armor/Air/XP/PAPI), ข้อความ + placeholder, หัวผู้เล่น, texture hotbar (widgets.png)
- นำเข้าได้บางส่วน / ต้องเตือน: เงื่อนไข (conditions), animation, ฟอนต์ custom, popup, party HUD (parseother)
- **จุดเสี่ยงใหญ่สุด = ตำแหน่งพิกัด** แต่ละปลั๊กอิน origin/แกน y ต่างกัน และ BetterHud ยังต่างกันตามเวอร์ชัน (ดูข้อ 5)

## 2. Pack ที่มี

| Pack | ปลั๊กอิน | Variants ใน zip | เนื้อหา |
|---|---|---|---|
| BetterHUD - Premium Config (TBStudio) | BetterHud | For ItemsAdder / For Nexo / For Oraxen / 1.21.10+ ItemsAdder | 4 bar แบบไอคอนเติมขึ้น (`split-type: up`), XP วงกลมเล็ก, panel เงิน 4 ช่อง, แถบบน (เวลา/online/ping animation) + widgets.png / sprites hotbar |
| tt_modern_hud | BetterHud | vanilla_ver / mmo_stat_bar_ver + ITEMSADDER / NEXO hotbar | 5 bar แนวนอน (`split-type: left`), กล่องหัวผู้เล่น + เงิน, MMO level/mana, พิกัด xyz, ฟอนต์ minecraft.ttf |
| Blossom hotbar (hyrex) | HappyHUD | HappyHUD + ItemsAdder / Oraxen resourcepack | พื้นหลัง hotbar 256×83, 4 bar, XP bar, กล่องซ้ายบน (เวลา/เงิน/พิกัด), bitmap font |
| MythicHUD party-hud-mmocore (Volya) | MythicHUD | — | party 4 คน: ไอคอนคลาส 33 แบบ (สลับตาม condition), HP/absorption/mana bar, ตัวเลข HP |

ของแถมฝั่ง resource pack (เจอใน 3/4 pack) — map เข้า **Widgets** ที่โปรแกรมมีอยู่แล้วได้ตรง ๆ:
- `assets/minecraft/textures/gui/widgets.png` (Legacy 256×256)
- `assets/minecraft/textures/gui/sprites/hud/*.png` + `sprites/hud/heart/*` (1.20.2+)
- อยู่ใต้ `ItemsAdder/contents/<ns>/(resourcepack/)assets/...`, `Nexo/pack/assets/...`, `Nexo/pack/external_packs/<ns>/assets/...`, `Oraxen/pack/assets/...`

## 3. การ detect อัตโนมัติ
สแกนทุก path ใน zip (รวม zip ซ้อน) แล้วหา "root" ของแต่ละปลั๊กอินด้วยลายเซ็น:

| รูปแบบ | ลายเซ็น (โฟลเดอร์เดียวกันมี) | โฟลเดอร์ PNG |
|---|---|---|
| **BetterHud** | `huds/*.yml` + `layouts/*.yml` + `images/*.yml` (มักมี `texts/`, `heads/`, `assets/`, `config.yml` ที่มี `default-hud:`) | `<root>/assets/` |
| **HappyHUD** | `layout/*.yml` (เอกพจน์) + `assets/hud/*.yml` + `textures/` · config มีคอมเมนต์ `HappyHud` | `<root>/textures/` |
| **MythicHUD** | `layouts/*.yml` + (`assets/hud/` หรือ `hud_assets/hud/`) · มัก `listeners/` | `<root>/textures/` **หรือ** `source-pack/assets/mythichud/textures/` |
| Resource pack | `assets/minecraft/textures/gui/...` | — |

- ถ้าไม่มี root ใดเลย → ลองแยกแยะจากเนื้อหา YAML (เช่น มี `type: listener` + `split-type` = BetterHud images; มี `layers:` + `function:` = HappyHUD/Mythic asset)
- เจอหลาย root → แต่ละอันคือ variant → แสดงให้ผู้ใช้เลือก (ตั้งชื่อจาก path เช่น "For Nexo")
- zip ของ pack อาจมีโฟลเดอร์ปลั๊กอินชื่อไม่ตรง (`BetterHud_vanilla_ver/`) → **ห้ามอิงชื่อโฟลเดอร์ ใช้ลายเซ็นเท่านั้น**

## 4. Schema ย่อ (ที่ต้องใช้จริง)

### BetterHud — 3 ชั้น: HUD → Layout → Element
```yaml
# huds/x.yml           ตำแหน่งบนจอเป็น % (0..100) จากมุมซ้ายบน
main_hud:
  layouts:
    1: { name: tt_hud_bottom, x: 50, y: 100 }
# layouts/x.yml        offset เป็น pixel (int) จากจุด anchor ของ HUD
tt_hud_bottom:
  images:  { 1: { name: tt_modern_bar_health, x: -58, y: -35, layer: 10, scale: 1 } }
  texts:   { 1: { name: default_font, pattern: "<#61ff6c>[level]", x: 32, y: -42, scale: 0.5, align: center, outline: true } }
  heads:   { 0: { name: tt_head, x: 87, y: 21 } }
# images/x.yml
tt_modern_bar_health:
  type: listener            # single | listener | sequence
  file: tt_modern_hud/tt_modern_bar_health.png
  split: 25                 # จำนวนขั้น
  split-type: left          # up | down | left | right | circle | reverse_circle
  setting: { listener: { class: health } }   # health food armor air exp absorption vehicle_health | placeholder(value/max)
```
- `sequence`: `files: [ping1.png:16, ping2.png:16]` (`:ticks`)
- `class: placeholder` → `value: "(number)papi:mmocore_experience"`, `max: "(number)papi:mmocore_next_level"`
- เจอ class ที่ไม่มีในเอกสาร เช่น `mmocore_mana` (built-in ของ integration) → ต้องมีตาราง map เพิ่ม
- ข้อความ: `[papi:xxx]` = `%xxx%`, `[level]`/`[health]`… = built-in, `<image:id>` = ไอคอนในฟอนต์ (`texts/*.yml → images:`), สี `&a` หรือ `<#hex>`
- `config.yml → default-hud:` = HUD ไหนเปิดอยู่จริง (ใช้เลือก default ในหน้า import)

### HappyHUD / MythicHUD — 2 ชั้น: Layout element → Asset (หลาย layer)
```yaml
# layout/*.yml (Happy) | layouts/*.yml (Mythic)   position % จากมุม "ซ้ายล่าง", offset px (y ขึ้น)
blossomhud-layouts:
  elements:
    health: { asset: blossomhud-health, align: left, position: {x: 50, y: 0}, offset: {x: -25, y: 51} }
# assets/hud/*.yml | hud_assets/hud/*.yml       layer แรก = อยู่บนสุด
blossomhud-health:
  conditions: [ "progress{l=fill;o=>;v=0} true hide" ]
  layers:
    fill:    { texture: {path: assets/blossomhud/hp_flipbook.png}, offset: {x: 11, y: 6},
               function: { listener: health, increment: 20, orientation: horizontal, reversed: false } }
    outline: { texture: {path: assets/blossomhud/hp_empty.png}, offset: {x: 0, y: 9} }
    label:   { text: "<white>%player_level%", font: default, align: center, scale: 0.6, outlined: true }
```
- listener custom (`listeners/*.yml`): `{ value: '%papi%', max: '%papi%' }`
- `position`/`offset` อาจเขียนเป็นสตริง `"50, 50"` ก็ได้
- ข้อความเป็น PAPI `%...%` ตรง ๆ อยู่แล้ว

## 5. ⚠️ เรื่องพิกัด (ต้อง calibrate)
ฝั่งเรา (Bedrock JSON UI): anchor 9 จุด + offset px, y ลง, หน่วย GUI px

| | BetterHud | HappyHUD / MythicHUD |
|---|---|---|
| จุดบนจอ | HUD `x,y` % จาก **ซ้ายบน** | `position` % จาก **ซ้ายล่าง** |
| offset | layout `x,y` px, **y ลง** (อนุมาน) | `offset` px, **y ขึ้น** |
| จุดอ้างอิงของรูป | ยังไม่แน่ใจ (มุมซ้ายบน?) | ขึ้นกับ `align` (left/center/right) |
| ซ้อนชั้น | `layer` int มาก = บน | ลำดับ layer แรก = บน (+ `offset.z`) |

- แปลง %: 0/50/100 → anchor ตรงตัว (`top_left`, `top_middle`, `bottom_middle`…) ค่าอื่น → anchor ใกล้สุด + เตือน (BetterHud เองก็แนะนำให้ใช้แค่ 0/50/100)
- **BetterHud ขัดกันเอง:** pack Premium ใช้ layout y เป็นบวก (`can` y:16 ที่ HUD y:100) แต่ tt_modern ใช้ y ติดลบที่ HUD y:100 และ variant 1.21.10 ของ Premium ย้าย y ทุกตัว −50 จาก variant เก่า → ขึ้นกับเวอร์ชันปลั๊กอิน / shader / `disable-legacy-offset` → **ต้องมีโหมด "ปรับตำแหน่งทั้งกลุ่ม" หลัง import** และทดสอบกับภาพในเกมจริง
- MythicHUD: wiki ไม่ได้บอกชัดว่า `align` เปลี่ยนจุดอ้างอิงยังไง → ต้องเทียบกับภาพในเกม

## 6. Mapping เข้า editor (element ใน `desktop/ui/js/app.js`)

| Java | → KaizerHUD | หมายเหตุ |
|---|---|---|
| image `single` / static layer | `image` (imageData = PNG) | ✓ |
| image `sequence` | `image` เฟรมแรก | เตือน: animation หาย |
| bar listener health/food/armor/air | `bar` + `barType` hp/food/armor/air | ✓ |
| bar `exp` | XP (ดูว่าจะใช้ XP bar เดิมหรือ bar custom) | ต้องตัดสินใจ |
| bar `placeholder` / listener custom | `bar` `barType: custom` + `barCustomPapi` / `barCustomMax` | ✓ มีฟิลด์อยู่แล้ว |
| split / increment | ตัดภาพใหม่เป็น 16 ขั้นของเรา | ทิศ `left/right` (horizontal) ✓ · `up/down`/vertical **ยังไม่รองรับ** · `circle` ไม่รองรับ |
| text pattern | `text` + PAPI | แปลง `[papi:x]`→`%x%`, `[level]`→`%player_level%`, สี `&a`/`<#hex>`/`<white>` → `color`, `scale` → `font_size`, `outline` → `shadow`; `<image:id>` แยกเป็น image element |
| head | `player_head` | ขนาดจาก `pixel` / `size` × 8 |
| condition แบบ hide ง่าย ๆ | `visibilityPapi` (มีอยู่แล้ว) | เฉพาะที่แปลงได้ ที่เหลือเก็บเป็น note |
| widgets.png / sprites hud | Widgets (Legacy / Modern) | ✓ |
| ฟอนต์ TTF/bitmap, popup, compass, animation equation, shader, party (parseother) | — | ข้าม + บอกในรายงาน import |

> หมายเหตุ: ไฟล์ HappyHUD ชื่อ `*_flipbook.png` จริง ๆ เป็นภาพ bar เต็มธรรมดา (42×4) ไม่ใช่ sprite sheet — ห้ามเดาจากชื่อไฟล์

## 7. ความต่าง/ความเละที่เจอจริง (importer ต้องทนได้)
- ไฟล์ YAML ท้ายไฟล์มีลายน้ำ/คอมเมนต์ (`#21ffc2…`, `#M0bM…`, `%%__USER__%%`) → เป็น comment ไม่กระทบ แต่บางไฟล์ไม่มี newline ท้าย
- MythicHUD party: condition เรียก texture `party_class_bloodmoonvampire` (ไม่มี `.png`) แต่ไฟล์จริงชื่อ `party_class_bloodmoon_vampire.png` และ `%mythiclib_stat_health}` มี `%` เกิน → **resolve ไฟล์แบบ fuzzy** (ไม่สนตัวพิมพ์, `_`, นามสกุล) และไม่ crash
- โฟลเดอร์ texture ของ MythicHUD อยู่คนละที่กับ wiki (`source-pack/...` และ `hud_assets/` แทน `assets/`)
- pack เดียวมี 3–4 variant ที่เกือบเหมือนกันทุกตัว → dedupe/ให้เลือก
- `name` ใน BetterHud layout อ้างได้หลายครั้ง (panel 4 ตำแหน่งใช้รูปเดียว) → สร้างหลาย element จาก PNG เดียว
- คีย์ตัวเลข (`1:`, `2:`) อาจเป็น int หรือ string

## 8. แผนลงมือ (เสนอ)
1. **Rust `import_java_hud(zip_path)`** (crate `zip` + `serde_yaml`) → คืน JSON กลาง (IR) + PNG เป็น base64
   - ขั้น: แตก zip ใน memory → detect roots → parse ตามตระกูล → resolve PNG → แปลงพิกัดเป็น IR → รายงาน warnings
2. **IR กลาง** (ไม่ผูกกับปลั๊กอิน): `{ variants: [{ name, plugin, huds: [{ id, enabledByDefault, elements: [{ kind, texture, anchorPct, offsetPx, align, scale, layer, bar?, text?, head?, conditionsRaw, warnings }] }] }], widgets?, warnings }`
3. **หน้าต่าง Import (JS)**: เลือก variant → ติ๊กเลือก HUD/องค์ประกอบที่จะเอา (ตามที่อยากให้ผู้ใช้เลือกเอง) พร้อม thumbnail → กด Import → สร้าง element ลง group ใหม่ต่อ HUD
4. หลัง import: ย้ายทั้งกลุ่ม (calibrate) + ตั้ง barType ให้อัตโนมัติ (แก้ปัญหา "bar ใหม่เป็น HP หมด" ใน HANDOFF ไปด้วย)
5. Test: fixture = 4 pack นี้ → Rust test ตรวจจำนวน element / bar type / ไม่มี error

## 9. สิ่งที่อยากได้จากผู้ใช้
- pack เพิ่ม (ยิ่งต่างยิ่งดี — โดยเฉพาะ MythicHUD เวอร์ชันใหม่, BetterHud ที่มี popup/compass, pack ที่มี `circle`/vertical bar)
- **ภาพหน้าจอในเกมของแต่ละ pack** (GUI scale ที่รู้ค่า) → ใช้ calibrate สูตรพิกัดข้อ 5 ซึ่งเป็นส่วนที่เดาผิดง่ายที่สุด
- ตัดสินใจ: XP ใช้อะไร, จะทำ vertical bar (`up`) เพิ่มใน editor ไหม (Premium pack ใช้ทั้ง 4 bar)

## 10. สถานะ v1 (ทำแล้ว 2026-11-20)
- Rust: `src-tauri/src/javahud.rs` + command `import_java_hud { folder }` · UI: `ui/js/javaimport.js` · เมนู File → Import Java HUD Pack
- ทดสอบกับ 4 pack: ตรวจเจอครบ 8 version, ไม่มี error · `cargo test --lib` (ตั้ง `KZ_HUD_PACKS` = โฟลเดอร์ Template_HUD) + ทดสอบ zip จริงแล้ว
- กฎพิกัดที่ใช้จริง:
  - **BetterHud:** HUD % จากซ้ายบน + layout px (y ลง, มุมซ้ายบนของรูป) · ถ้า `config.yml` มี `disable-legacy-offset: false` → y −50 (ยืนยันจาก Premium รุ่นเก่า vs 1.21.10)
  - **Happy/Mythic:** % จากซ้ายล่าง, offset y ขึ้น, layer `offset.y` = ขอบบนของรูป · `align: left` = ชิ้นงานอยู่ทาง**ซ้าย**ของจุด (ขอบขวาชนจุด), `right` = อยู่ทางขวา, ไม่ใส่ = ขอบซ้ายชนจุด (อนุมานจาก Blossom + party HUD "hp / max")
- แปลงเงื่อนไข `placeholder{...} true|false hide` → Visibility Condition ของ editor · condition อื่นเก็บเป็นคำเตือน
- ชื่อไฟล์/listener ที่สะกดไม่ตรง (เช่น `bloodmoonvampire`, `member_3_mana_mmo`) หาแบบ fuzzy ได้
- bar ประเภทซ้ำกับที่มีในโปรเจกต์ → แปลงเป็น Custom + PAPI ของ vanilla อัตโนมัติ
- **ยังต้องตรวจในเกม:** BetterHud Premium วางแกน x ดูเลยขอบขวา (bar ที่ HUD x=100 ใช้ x −160..+5) — ต้องมีภาพในเกมมาเทียบ, ความกว้างข้อความเป็นค่าประมาณ, หัวผู้เล่นใช้ขนาด doll ของ editor
- ไม่ import: animation (ใช้เฟรมแรก), popup/compass, ฟอนต์ custom, ไอคอนที่สลับตามเงื่อนไข (ใช้รูป default), bar วงกลม (เป็นแนวนอน)

## 11. แก้ตำแหน่ง v2 (2026-11-20) — ยึดหน้าจอโปรแกรมเรา ไม่ใช่แค่ค่า Java
- **BetterHud (จาก source จริง):** ทุก layout ถูกเลื่อน `-max/2` (max = ความกว้างรูปที่กว้างที่สุดใน layout, `offset: CENTER` เป็นค่า default) + `align` ของ layout, `pixel:`/`gui:` ใน hud · legacy offset = **−54** (`PixelLocation.hotBarHeight`)
- **HappyHUD:** layer `align` แบบข้อความปกติ (right = ขอบขวาชน x) และจัดตามความกว้างจริงก่อน scale · MythicHUD กลับด้าน (ตาม wiki + party HUD)
- **ข้อความ:** export เป็น panel 1×1 → offset = จุดยึดของข้อความเอง + ตั้ง Text Align (ซ้าย/กลาง/ขวา) ให้ ค่า PAPI ยาวเท่าไหร่ก็ยังชิดถูกที่
- **ปรับตามหน้าจอโปรแกรม (Bedrock):**
  - hotbar ของเราอยู่สูงจากขอบล่าง 2px → ของที่ยึดด้านล่างขยับขึ้น 2px
  - ถ้า pack มีกรอบ hotbar (ช่องโปร่ง ≥180×18 ในรูปกลางล่าง เช่น Blossom) → วางช่องนั้นให้ตรง hotbar ของเรา แล้วเลื่อนของด้านล่างทั้ง pack ตาม
  - ปุ่ม 3 ปุ่มกลางบนของ Bedrock (x ±28, y 1–19) → HUD ที่บังจะถูกดันลงใต้ปุ่ม
  - ของที่ยึดมุมล่างแล้วทับ hotbar บนจอกว้าง 480 → มีคำเตือนในรายการ (เช่น bar ของ Premium — พื้นที่ขวาของ hotbar มีแค่ 149px แต่ bar กว้าง 166px ต้องจัดเอง)
  - หัวผู้เล่น: ย่อ/ขยาย paper doll ตามขนาดหัวใน pack
- ตรวจในหน้า editor จริงแล้ว: tt_modern (bar กว้างพอดี hotbar), Blossom (hotbar อยู่ในกรอบกระถาง), party HUD, Premium (อยู่ในจอ แต่ bar มุมขวาล่างชน hotbar)
- ยังไม่แน่ใจ: Blossom กล่องซ้ายบน ข้อความอาจต้องลงอีก 1 แผ่นไม้ (ไอคอนนาฬิกา/เหรียญ/เข็มทิศ) — รอภาพในเกม

## 12. เงื่อนไข (conditions) → Visibility (2026-11-20)
- ความหมายของ `<เงื่อนไข> true|false hide` = **แสดงเฉพาะตอนผลเงื่อนไขตรงกับ true/false ที่เขียน** (ยืนยันจาก Blossom เกราะ/อากาศ และ party HUD)
- แปลงอัตโนมัติ: `placeholder{ph;v;o} … hide` และ `progress{l;o;v} … hide` (ใช้ PAPI ของ listener ของ layer นั้น, `%` ใช้ได้เมื่อ max เป็นตัวเลข เช่น air = 300) · BetterHud `conditions:` (first/second/operation) ตัวแรก
- ข้อจำกัดของ editor/export: Visibility ใช้ได้กับ image / bar / player head / XP number **ไม่รองรับข้อความ**, 1 เงื่อนไขต่อชิ้น, ค่าที่เทียบต้องคงที่ (เทียบ PAPI กับ PAPI ไม่ได้)
- ยังไม่รองรับ (เตือนไว้): `color` (เปลี่ยนสีตามเงื่อนไข), `texture` (เปลี่ยนรูปตามเงื่อนไข), เกราะ (ไม่มี PAPI ค่าเกราะ), range `a..b`, effect/gamemode
- `visibilityMode` ของ bar (when_armored / when_submerged) ใน app.js ไม่ถูกใช้ตอน export (โค้ดค้าง)

## 13. Pack ชุดใหม่ 3 ตัว (2026-11-23)
| Pack | ปลั๊กอิน | ก่อนแก้ | หลังแก้ |
|---|---|---|---|
| HudGraveyard (3BSTUDIO) | BetterHud beta-26 | 21 ชิ้น, animation เหลือเฟรมแรก, bar/กรอบล่างหลุดใต้จอ | 21 ชิ้น + **11 animation** (8 เฟรม 5 fps), ตำแหน่งตรง hotbar |
| Fantasy HUD Ver.3.5 (INFERNO XIX) | BetterHud 1.13 | **0 ชิ้น** (layout มี key `34:` ซ้ำ → serde_yaml ทิ้งทั้งไฟล์) | 123 ชิ้น × 3 version + 2 add-on (V.2/V.3) |
| Simple HUD (lemon_rpg) | MythicHUD | 34 ชิ้น, `effect{}` ไม่รองรับ | 34 ชิ้น, ไอคอนหัวใจตาม effect มี Visibility |

สิ่งที่เพิ่ม/แก้ใน `javahud.rs`:
- **YAML key ซ้ำ** → ลบตัวก่อนหน้า (ตัวหลังชนะ เหมือน SnakeYAML) แล้ว parse ใหม่ + คำเตือน (`drop_duplicate_keys`)
- **`sequence` → animation** (`build_anim`) ดู `docs/HUD_ANIMATION.md`
- **legacy offset:** config.yml มีแต่ไม่มีคีย์ `disable-legacy-offset` = ค่า default ของ BetterHud (legacy เปิด, y −54) · ไม่มี config.yml เลย (tt_modern) = ไม่ shift เหมือนเดิม
- **`placeholders/*.yml`**: `[string:time]` → `%localtime_time_H%:%localtime_time_mm%`
- **conditions ระดับ layout** (เช่น `gamemode == 'SURVIVAL'`) ใช้กับรูป/bar/หัวที่ไม่มีเงื่อนไขของตัวเอง · `dead == false` ข้ามเงียบ ๆ · หลายเงื่อนไข = ใช้ตัวแรกที่แปลงได้ ที่เหลือแจ้ง
- **MythicHUD `effect{e=poison}`** → `%player_has_potioneffect_POISON%` == `yes` (PAPI Player expansion)
- **add-on ที่มีแค่ `layouts/`** ("ลาก V.2 ทับ V.1") → version ใหม่ = layout ของ add-on ทับ root เต็มที่ชื่อ layout ตรงกันมากสุด (`detect_overlays`)
- ข้ามโฟลเดอร์ cache: ชื่อขึ้นต้น `.` (`.assetCache`, `.deobfCachedPacks`, `.libraries`), `ItemsAdder/output|storage` · hotbar ที่ไฟล์เหมือนกันแสดงครั้งเดียว (Fantasy 9 → 1)
- ไม่มี regression กับ 4 pack เดิม (ตำแหน่ง/ชนิด/visibility เหมือนเดิมทุกชิ้น ยกเว้น hotbar ซ้ำหายไป)

ยังไม่รองรับ (เตือนไว้): compass / popup, bar วงกลม (Fantasy sublevel 12 อัน → แนวนอน), `[vehicle_health]`, listener `mana` ของ MythicHUD, เงื่อนไขมากกว่า 1 ข้อต่อชิ้น
- ⚠ Fantasy HUD ทำมาสำหรับ **GUI scale 2** (จอกว้าง 960 GUI px) — บนจอ 480 ของเราแถบ sublevel ยาวเต็มจอ ต้องจัด/ย่อเอง

## 14. ตำแหน่งข้อความในเกม (2026-11-23)
- จุดของข้อความจาก pack Java (`text_point`) = มุมซ้ายบน / กึ่งกลาง / มุมขวาบนของตัวอักษร · Bedrock วาด label ห่างจากจุดนั้นตาม pivot ของ panel 1×1 และ ascent ของฟอนต์
- importer ตั้ง `text_offset` (ทุกขนาดใน `text_offsets`) ด้วย `KzTextModel.exactTextOffset(align, size, fx, fy)` ใน `preview.js` ให้ยอดตัวเลข (หรือกึ่งกลาง) ลงที่จุดนั้นพอดีในเกม · ค่าคงที่ (`BEDROCK_TEXT`) วัดจากเกม GUI scale 3 — แก้ที่เดียว ใช้ทั้งพรีวิวและ import
- ตัวอย่าง normal ชิดซ้าย: ยึดบน `[0.5, -5.1]`·`top_middle`, ยึดล่าง `[0.5, -4.1]`·`bottom_middle`, center `[0, 1.4]`·`top_middle` (normal: label สูง 10, ตัวเลขเริ่ม 1px ใต้ขอบบน — วัดรอบ 2 วันที่ 2026-11-23)

## 15. เงื่อนไขหลายข้อ (2026-11-23)
- IR: `visibility` = ข้อแรก, `visibility_extra` = ข้อที่เหลือ (`javahud.rs vis_fields`, ตัดข้อซ้ำ) → editor `visibilityPapi…` + `visibilityExtra` · ทุกข้อต้องจริง (AND) เหมือน BetterHud / MythicHUD
- BetterHud: ของชิ้น + ของ layout · MythicHUD/HappyHUD: ของ layer + ของ asset · `dead == false` ยังข้ามเหมือนเดิม
- Export Bedrock: `!=`/invert ใช้ marker ของ `==` แบบต้องไม่มี (`codegen.rs canonical_condition`) — Fantasy HUD: 65 marker, จริงพร้อมกันไม่กี่ตัว

## 16. แพ็กชุดใหม่ 3 ตัว + CustomNameplates boss bar (2026-11-24)
| Pack | ปลั๊กอิน | ก่อนแก้ | หลังแก้ |
|---|---|---|---|
| SeasonsBossbar | CustomNameplates + ConditionalTextPlaceholders | ไม่รู้จักปลั๊กอิน (import ไม่เข้า) | 2 version (ItemsAdder / Oraxen), 7 ชิ้น (กรอบ + ไอคอน 4 ฤดูตามเงื่อนไข + ข้อความฤดู/เวลาตรงช่อง), ยึด `top_right` ไม่ล้นจอ |
| HappyHUD-erocavontic-anime | HappyHUD | ไม่รองรับ action `show` และ `gamemode{gm=…}`, ไม่เจอ hotbar ใน `pack/minecraft/…` | 13 ชิ้น + Visibility ครบ (`!= CREATIVE`, `!= SPECTATOR`, effect poison/wither/hunger/absorption) + hotbar 2 แบบ |
| PrimeHUD v2 | BetterHud | ค่าเงื่อนไขติด `(number)120`, ข้อความซ้ำ 3 สีทับกันรวม 18 ช่อง (>16), `hotbar.png` ใส 256×56 ทำ import error | 19 HUD (47 ชิ้น, ข้อความเหลือ 12 ช่อง, ไอคอนสถานะสลับสีตามเงื่อนไข, แอนิเมชันกระพริบ 4 หลอด), เลือก `widgets.png` จริงและไม่ติ๊ก HUD `hotbar` ซ้ำเป็นค่าเริ่ม |

