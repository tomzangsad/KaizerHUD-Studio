# HUD Forge — Procedural Pixel-Art HUD Generator

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

HUD Forge generates complete pixel-art HUD elements procedurally at runtime inside a new element group (single undo step). Open via **Insert → HUD from Templates (HUD Forge)…**, the anvil toolbar button, or press **F**.

- **Core Files:** `ui/js/hudforge_themes.js` (palettes, 6-shade ramps, kits, icons, genres, layouts, presets), `ui/js/hudforge.js` (v1 planner & pixel engine), plus v2 layout modules (`ui/js/hudforge_v2.js`, `hudforge_v2_more.js`, `hudforge_v2_set3.js`, `hudforge_v2_set4.js`, `hudforge_v2_redo.js`).
- **Pixel-Art Rules:** `1 GUI px = 1 texture px`, top-left directional lighting, 6-shade material ramps `[outline, dark2, dark, base, light, highlight]`, selective outlines, 1px drop shadow, and unified frame assemblies (`buildComp`) rather than floating pieces.
- **v2 Layouts (95+ presets):** Includes `crest`, `strip`, `slash_medal`, `slash_rows`, `slash_crest`, `cozy`, `bubble`, `neon`, `steam`, `gothic`, `pirate`, `samurai`, `ocean`, `desert`, `winter`, `halloween`, `arcade`, and more. Preview sheets live in `docs/hud-forge-templates/`.

---

## ภาษาไทย

# HUD Forge — คู่มือระบบ (สำหรับแก้ไขต่อ)

> อัปเดต 2026-11-21 · ส่วนหนึ่งของ KaizerHUD Studio (`desktop/`) · ไม่มีการแก้ไฟล์เว็บเดิมใน `JsonUIMaker/`

HUD Forge = หน้าต่างสร้าง HUD เองจากเทมเพลต (ไม่ดึงของจาก Java pack) วาด **pixel art** ทุกชิ้นด้วยโค้ดตอนรันไทม์
แล้วสร้างเป็น element ของ editor ใน group ใหม่ (Undo ได้ครั้งเดียว)

- เปิด: **Insert → HUD from Templates (HUD Forge)…**, ปุ่มรูปทั่งบน tool strip, หรือคีย์ **F**
- รูปตัวอย่างทุกแบบ: `docs/hud-forge-templates/` (ดูหัวข้อ 9)
- ภาพอ้างอิงงานคนวาด (ของคนอื่น ใช้ดูแนวเท่านั้น): `desktop/reference/hud-samples/` — **อย่าย้ายกลับเข้า `ui/`** เพราะทุกอย่างใน `ui/` ถูกฝังลง exe

---

## 1. ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `ui/js/hudforge_themes.js` | **ข้อมูล**: พาเลต (ramp), kit 15 แบบ, ไอคอน/สไปรต์, แนว (genre), layout, ปลายแถบ, preset → `window.HudForgeData` |
| `ui/js/hudforge.js` | **engine + หน้าต่าง + สร้าง element** → `window.HudForge.open()` |
| `ui/css/shell.css` (ท้ายไฟล์, class `.hf-*`, `.kz-forge`) | สไตล์หน้าต่าง |
| `ui/index.html` | `<script>` 2 ไฟล์, เมนู `data-cmd="hud-forge"`, ปุ่ม `#btn-tool-forge`, ไอคอน `#i-forge` |
| `ui/js/shell.js` | คำสั่ง `'hud-forge'`, คีย์ `f`, ปุ่ม tool strip, แถวใน Keyboard Shortcuts |

ใช้ฟังก์ชันของ editor เดิม: `App.addElement`, `App.pushHistory`, `App.generateUniqueBarTag`, `App.getNamespace`,
`sliceBarTexture` (app.js), `getDefaultBarTexturePath` (controls.js), `Widgets.importLegacy` (widgets.js), `kzPrompt/kzConfirm` (desktop.js)

---

## 2. หลักการออกแบบ (สำคัญ — มาจากฟีดแบ็กผู้ใช้)

ผู้ใช้ติมาตามลำดับ อย่าทำซ้ำ:
1. ❌ สไตล์ vector (gradient/glow/มุมมนเนียน) → "ไม่สวย" → ต้องเป็น **pixel art 1 GUI px = 1 texture px**
2. ❌ กล่องพื้นหลังใหญ่ครอบทั้ง HUD → "ไม่สวย"
3. ❌ ชิ้นส่วนลอยแยกกัน (หัว/ชื่อ/แถบ/ไอคอนแยกชิ้น) → "ลอย ๆ แปลก" → ใช้ **assembly** (กรอบเดียวเชื่อมกัน) ทุกที่ หรือให้ชิ้นยืน/ติดกับ hotbar
4. ❌ สีคำนวณอัตโนมัติ + ลาย noise → "มั่ว ไม่มีมิติ หลอดไม่เข้ากัน" → **พาเลตเลือกเอง** + แสงทิศเดียว + เงาตก
5. ❌ ทุก top HUD มีหัวผู้เล่น → หัวเป็น **ตัวเลือก** มีเฉพาะ MMO Profile; แบบอื่นใช้ตราเลเวลนำหรือไม่มีเลย

กฎ pixel art ที่ใช้ (ค้นคว้าจาก Wayline Game UI & HUD Pixel Art, Pixnote Shading, Lospec outlines):
- แสงทิศเดียว **ซ้ายบน** ทุกชิ้น ไม่ทำ pillow shading
- วัสดุละ 1 ramp 6 เฉด `[outline, dark2, dark, base, light, highlight]` เงาเอียงฟ้า/ม่วง ไฮไลต์เอียงเหลือง
- selective outline = ขอบใช้เฉดเข้มสุดของวัสดุนั้น ไม่ใช่ดำล้วน
- ชิ้นเล็กใส่ highlight จุดเดียวพอ, ไม่มี noise
- ทุกชิ้นที่นูนมีเงาตก 1px (ขวาล่าง), ลูกบิด/อัญมณี/ตรา เรนเดอร์แบบ 3D

---

## 3. ข้อมูล (`hudforge_themes.js`)

### 3.1 Ramp (พาเลต)
- `STAT_RAMPS` — ไส้หลอดของ hp / food / armor / air / xp / mana
- `M` (โลหะ/กรอบ), `PLATE` (พื้นกรอบ), `INSET` (ร่อง/ช่องที่ยุบ), `GEM`
- ทุก ramp ถูกลงทะเบียนเข้า `rampCache` ใน engine โดยใช้ **สีฐาน (index 3) เป็น key** → `ramp('#e5a43a')` คืน ramp ที่เลือกเอง
  (สีที่ไม่ได้ลงทะเบียนจะใช้ `shade()` คำนวณแบบ hue-shift แทน)

### 3.2 Kit (เดิมเรียก theme) — `THEMES`
```js
{ id, name, th, group,               // group: fantasy | nature | tech | block
  metal, plate, inset, gem,          // ramp (array 6 สี)
  leaf?,                             // ramp ของใบไม้ (orn 'leaves')
  rimW: 1|2, shape: 'rect'|'round'|'chamfer', r?,
  cap: 'none'|'knob'|'gem'|'blade'|'notch'|'slant',   // ปลายแถบเริ่มต้น
  orn: ['brackets'|'gems'|'rivets'|'studs'|'leaves'|'flowers'|'hearts'|'gears'],
  badge: 'diamond'|'circle'|'square'|'shield',         // ตราเลเวล
  texture?: 'none'|'wood'|'brick'|'scan',
  text, accentRamp? }
```
ลูปท้าย `THEMES` เติมฟิลด์ที่ engine ใช้: `outline=metal[0] rim=metal[3] body=plate[3] inner=inset[0] channel=slot=inset[3] gem=gem[3] accent=(accentRamp||metal)[3]`

### 3.3 แนว / layout / preset
- `GENRES`: fantasy, mmo, modern, survival, info
- `LAYOUTS` (id → genre): `fantasy`, `classic` (Hotbar Deck), `banner`, `compact`, `mmo`, `rpg_corners`, `modern`, `center_row`, `split_sides`, `survival`, `card_tl/tr/bl/br`, `top_strip`
- `SHAPES` = ปลายแถบ: theme, none, blade, knob, gem, notch, slant, segmented
- `PRESETS`: `{ genre, name, theme, layout, shape?, opts: {mana, money, time, coords …} }`
- ค่าหน้าตาประจำ layout อยู่ใน **`LAYOUT_STYLE` ใน hudforge.js** (barH, barW, values, slotNums, pips, ornaments, shape, `parts: {head, name}`) — ถูกใช้ทุกครั้งที่เลือก layout/preset

### 3.4 สไปรต์
`ICONS` (9×9), `PIPS` (7×7, แถวไอคอน 10 อัน), `ORN` (bracket, gem, rivet, stud, leaf, flower, horn, star, bubble, heart, gear)
ตัวอักษร: `.`=ใส · `o`=ขอบ · `b`=ฐาน · `l`=สว่าง · `d`=มืด · `w`=ไฮไลต์ · (ORN) `g/h`=อัญมณี/เงาอัญมณี · `y`=เหลือง

---

## 4. Engine (`hudforge.js`) — ลำดับการทำงาน

```
state (ตัวเลือกในหน้าต่าง)
  → planner()        จัดวาง: คืน "parts" ในพิกัดจอ 480×270 (hotbar = x149 y246 182×22)
  → renderPlan(q)    วาด texture ของแต่ละ part (q = 1/2/4 ขยายแบบ nearest)
  → drawPreview()    พรีวิว (สเกล 2) | create() → makeElement() สร้าง element จริง
```

### 4.1 ชนิด part
| `t` | คืออะไร | element ที่ได้ |
|---|---|---|
| `comp` | **assembly** กรอบเดียวที่สลักร่อง/ช่อง/ไอคอน/ตราไว้แล้ว (`spec`) | image `hf_<kit>_frame` |
| `bar` + `inComp` | ไส้หลอดที่อยู่ในร่องของ comp | bar อย่างเดียว |
| `bar` (ไม่มี inComp) | แถบเดี่ยว (track + fill) | image track + bar |
| `headonly` | หัวผู้เล่นในช่องของ comp | player_head |
| `text` | ข้อความ PAPI (จุดยึด = มุมซ้ายบน / กลาง / ขวาบน ตาม align) | text |
| `xp` | เลขเลเวล (`plain` = สีเขียวแบบ vanilla) | xp_label |
| `panel`, `plate`, `icon`, `badge`, `head` | ชิ้นเดี่ยว (ใช้ใน top_strip / ของเก่า) | image |

### 4.2 Assembly (`buildComp(spec)`)
`spec = { w, h, rects[], domes[], items[] }`
- `rects`: `{x,y,w,h, cap, capW, capSide:'l'|'r'}` — union ทั้งหมด (+ `domes` = โค้ง) กลายเป็นรูปทรงเดียว → `drawFrame` วาด outline/rim (bevel)/inner/body ชุดเดียว
- โดมมีซุ้มยุบด้านในอัตโนมัติ
- `items` (วาดตามลำดับ, ชิ้นนูนมีเงา): `track` (ร่องแถบ/แถว pip), `icon`, `isock` (วงกลมฝังกรอบ + ไอคอน), `plate` (ป้ายข้อความยุบ), `socket` (ช่องสี่เหลี่ยมยุบ), `crest` (ตราเลเวล), `knob` (ลูกบิด/อัญมณีบนเสา), `orn` (สไปรต์)
- ทั้งรูปมีเงาตก 1px → part กว้าง/สูงขึ้น 1px (`renderPlan` บวกให้)

ตัวช่วยใน `planner()`:
- `statRow(items, over, stat, x, y, w, side)` — 1 แถว: วงกลมไอคอน + ร่องแถบ (หรือแถว pip) · side `'r'` = กลับด้าน
- `finishComp(rects, domes, items, over, anchor)` — แปลงพิกัดจอเป็นรูปเดียว แล้ว push comp + overlay
- `card(corner, inc)` — การ์ดมุมจอ (ช่องหัว หรือ ตรานำ) + "ปีก" แถวละแถบ ปลายเป็นขั้นบันได (`bandCap()`), มุมขวากลับด้านอัตโนมัติ
- `crown()` — Fantasy: เสา 2 ข้าง + ราง XP + โดมกลางใส่ตรา, แถบยืนบนราง, pip บนแถบ
- `tray(kind)` — ถาดบน hotbar: `'columns'` (Modern), `'row'` (Center Row), `'deck'` (Hotbar Deck มีตรากลาง)
- `sideTrays()` — Split Sides: ถาดซ้าย/ขวา + ราง XP + แท็บเลขเลเวล (ชิ้นเดียว)
- `survivalRail()` / `survivalRailXpOnly(level)` — ราง XP + แถว pip ยืนบนราง

### 4.3 วาดพื้นฐาน
- `shapeMask`, `distMap` (ระยะจากขอบ) → `drawFrame(buf, x, y, w, h, opts)` = outline → rim bevel (แสงซ้ายบน) → inner → body; `inset:true` = ยุบลง
- `litSphere` / `litDiamond` — 3D จาก normal·แสง แล้วปัดเป็น ramp (ลูกบิด, อัญมณี, ตรา)
- `withShadow(canvas)` — เงาตก 1px
- แถบ: `barGeom` (ขนาด/ปลาย/ช่อง), `trackTex` (ร่องยุบ + ปลาย 3D), `fillTex` (หลอดแก้ว: ขอบสว่าง → แถบสะท้อน → มืดล่าง), `pipTex`
- hotbar: `hotbarSheet()` → แผ่น widgets.png 256×256 แบบ legacy (bar 182×22 ที่ 0,0 · selection 24×24 ที่ 0,22) → `Widgets.importLegacy`

### 4.4 การสร้าง element (`makeElement`)
- offset: กล่อง `boxOffset(anchor, x, y, w, h)` = `x + w·fx − 480·fx` (เหมือนพรีวิวของ editor) · ข้อความ `pointOffset`
- bar: สไลซ์ 16 ขั้นด้วย `sliceBarTexture(data, dir)` (`dir 'right'` = เติมจากขวา), `barMaxSize = size = ขนาดไส้หลอด`
- ประเภท bar: hp/food/armor/air = vanilla; ถ้าในโปรเจกต์มีประเภทนั้นแล้ว → แปลงเป็น Custom + PAPI vanilla (แจ้งเตือน)
- XP = Custom `%player_exp%` / `1` · Mana = Custom ตามช่อง PAPI ในหน้าต่าง (ค่าเริ่ม AuraSkills)
- ระหว่างสร้างปิด `App.render` ชั่วคราว (เร็วขึ้นมาก) และ `App.isRestoringHistory = true` → Undo ครั้งเดียว (ยกเว้น texture hotbar)

### 4.5 อื่น ๆ
- state ล่าสุดเก็บใน `localStorage['kzHudForge.last5']` (เปลี่ยนเลขเมื่อ default เปลี่ยน), template ของผู้ใช้ `kzHudForge.templates2`
- ตัวเลขในพรีวิวเป็นค่าตัวอย่าง (`SAMPLE`), ตำแหน่งข้อความ/เลขเลเวลเป็นค่าประมาณ — **ยังไม่ได้ทดสอบในเกม**

---

## 5. เพิ่ม kit ใหม่
1. (ถ้าต้อง) เพิ่ม ramp ใน `M` / `PLATE` / `INSET` / `GEM` — 6 เฉด มืด→สว่าง, เงาเอียงฟ้าม่วง ไฮไลต์เอียงเหลือง
2. เพิ่ม object ใน `THEMES` (ดูโครงสร้างข้อ 3.2) ใส่ `group`
3. (ถ้าต้อง) เพิ่ม preset ใน `PRESETS`
4. ตรวจด้วยพรีวิว (ข้อ 8) → ส่งออกรูปใหม่ (ข้อ 9)

## 6. เพิ่ม layout ใหม่
1. เพิ่ม `{ id, genre, name, th }` ใน `LAYOUTS`
2. เพิ่มค่าใน `LAYOUT_STYLE` (hudforge.js)
3. เพิ่ม branch ใน `planner()` (`if (L === 'id') { … }`) — **ใช้ assembly** (`card` / `tray` / `finishComp` + `statRow`) อย่าให้ชิ้นลอย
4. ถ้าแถบกว้าง/สูงขึ้น ระวังไม่ให้ทับ hotbar (x 149–331, y 246–268) และปุ่มกลางบนของ Bedrock (x ±28 จากกลาง, y 1–19)

---

## 7. ปัญหาที่รู้ / งานค้าง
- ยังไม่ได้ทดสอบในเกม: ตำแหน่งข้อความ PAPI, เลขเลเวล (xp_label วางเป็นกล่องประมาณ 12×9), ความคมของ texture 1×
- Fantasy: แถบ HP/อาหารสั้น (~33px) เพราะโดมกลาง
- `javaimport.js` ใช้ XP max `100` แต่ PAPI `%player_exp%` เป็น 0–1 (HUD Forge ใช้ `1`) — ของเดิม ยังไม่ได้แก้
- ข้อความ scoreboard ได้สูงสุด 16 อันต่อโปรเจกต์ (แจ้งเตือนอัตโนมัติ)
- ฟังก์ชันเก่าที่ยังเหลือแต่แทบไม่ใช้: `barRow`, `xpOverHotbar`, `levelCrest`, `panelBehind`, `rowsUp`, `panelTex` (top_strip ยังใช้)

---

## 8. วิธีทดสอบโดยไม่ต้อง build
1. เสิร์ฟ `desktop/ui` ด้วย http server (เช่น `python -m http.server 8765 --directory desktop/ui`) แล้วเปิด `http://localhost:8765`
   - ถ้าใช้ Claude Code desktop: browser pane ต้องมี `.claude/launch.json` ที่ **`JsonUIMaker/.claude/`** (ไม่ใช่ใน `desktop/`) — สร้างชั่วคราวแล้วลบทิ้งหลังทดสอบ
2. ใน console: `HudForge.open()` แล้วกด preset
3. ส่วน Code view / Save / Export ต้องใช้ตัว Tauri จริง (`cargo build`)
4. ข้อควรระวัง: ถ้าแท็บพรีวิวไม่อยู่ข้างหน้า `requestAnimationFrame` จะหยุด → พรีวิวไม่อัปเดต

## 9. รูปเทมเพลต (`docs/hud-forge-templates/`)
- `<genre>__<preset>.png` — พรีวิวเต็มจอ 960×540 ของทุก preset
- `sheet__<genre>.png` — รวมทุก preset ของแนวนั้นพร้อมชื่อ
- `kit__<id>.png` — ภาพย่อของแต่ละ kit
- สร้างใหม่: เปิดพรีวิว (ข้อ 8) + รัน `_png_saver.py <โฟลเดอร์ปลายทาง>` (รับ POST ที่ `127.0.0.1:8766`) แล้วในหน้าพรีวิววนกดทุก preset → `fetch('http://localhost:8766/save', {method:'POST', body: JSON.stringify({name, data: canvas.toDataURL()})})`
  (รอให้ canvas เปลี่ยนก่อนเก็บ ไม่งั้นรูปจะเลื่อนไปหนึ่งช่อง)

## 10. Build
```powershell
cd desktop\src-tauri
cargo build --release      # → target\release\kaizerhud.exe (ฝังทุกไฟล์ใน ui/)
```

---

## 11. HUD Forge v2 — layout ชุดใหม่ (2026-11-21)

ผู้ใช้บอกว่าแบบเดิม "ยังไม่สวย" → ออกแบบใหม่ (ไม่ใช่ต่อยอดแบบเดิม) ผู้ใช้เลือกแนว A, B และ C (ส่วนล่าง + Top HUD 3 แบบ)
mockup/ภาพเปรียบเทียบ: `docs/hud-forge-redesign/` · รูปพรีวิวจริงจากโปรแกรม: `docs/hud-forge-templates/v2_*.png`
ไฟล์เดิมก่อนแก้สำรองไว้ที่ `docs/hud-forge-redesign/backup/`

| layout id | แนว | หน้าตา |
|---|---|---|
| `crest` | fantasy | A Twin Crest — เพชร HP/อาหารขนาบ hotbar (bar แนวตั้ง `bottom` เติมจากล่างขึ้นบน), หิ้งบน hotbar มีร่อง XP, ป้ายเลเวล, pip เกราะ/อากาศวางบนหิ้ง |
| `strip` | modern (+ preset survival) | B Clean Strip — แถบเข้มเรียบ (มี alpha), หลอดแบ่งช่อง, ไอคอนอยู่ในช่องท้ายแถบ, แถบข้อมูลขวาบน |
| `slash_medal` | mmo | C-1 Medallion — กรอบหน้าแปดเหลี่ยม, แถบหนา, ตัวเลขอยู่ในช่องท้ายแถบ (ไม่ทับไส้หลอด) |
| `slash_rows` | mmo | C-2 Row Strips — ช่องหน้า + แถวละสถานะ (ไอคอน · หลอดแบ่งช่อง · ตัวเลข) |
| `slash_crest` | mmo | C-3 Shield — หน้าในโล่ + ริบบิ้นเลเวล + แถบเรียวใบมีด (เรียวเฉพาะ 45% ท้าย ทีละ 1px) |

ส่วนล่างของ C ทุกแบบ: hotbar มีเลขช่อง, ราง XP ยาวเส้นเดียว + ชิปเลเวลตรงกลาง (ทับราง), ป้ายข้อมูลมุมขวาล่าง

### โครงสร้าง
- **`ui/js/hudforge_v2.js`** (โหลดก่อน `hudforge.js` ใน `index.html`) → `window.HudForgeV2 = { has(id), plan(id, X), hotbar(id, X) }`
  - วาดทุกอย่างด้วย `Buf(ox, oy, w, h)` ที่ใช้**พิกัดจอ 480×270 ตรง ๆ** (ง่ายต่อการจัดตำแหน่ง)
  - คืน part สำเร็จรูป `pre: true`: `img` (`tex1`, `layer: 'panel'|'icon'`), `bar` (`fill1`, `g`, `dir` รวม `'bottom'`), `text`, `xp`, `headonly`
- ใน **`hudforge.js`** เพิ่ม: `isV2()`, `v2ctx()` (ส่ง `t, state, on, INFO, textW, withShadow, iconColor, valuePapi, rampOf, statRamp`), `hotbarFor(t)`;
  `planner()` ส่งต่อให้ v2 · `renderPlan` แค่ upscale texture ของ part `pre` · `drawPlan` วาด bar แนวตั้งได้ และ `img` ชั้น `icon` อยู่เหนือ bar ใต้ข้อความ ·
  `makeElement` รองรับ `img` และ `barMinSize` แนวตั้ง · `LAYOUT_STYLE` มี crest / strip / slash_*
- **`hudforge_themes.js`**: เพิ่ม 5 layout ใน `LAYOUTS` และ preset v2 ไว้หน้าสุดของแต่ละแนว (Crest *, Clean Strip / Strip *, Medallion *, Rows *, Shield *)
- สีมาจาก kit: crest = `plate` (กรอบ) + `metal` (ขอบทอง/ป้าย) + `inset` (ช่อง hotbar); strip = หมึกเข้มตายตัว + `accent`; slash = `plate` + `accent`

### ยังไม่ได้ทดสอบ
- ทั้งหมดทดสอบแค่พรีวิวในเบราว์เซอร์ ยังไม่ได้ build / เข้าเกม
- เพชรของ Crest ใช้ bar แนวตั้ง (`sliceDirection: 'bottom'`) ยังไม่เคยเห็นในเกมจริง
- ตำแหน่งตัวเลข/เลเวลจูนจากพรีวิว (ข้อความในพรีวิวลอยสูงกว่า y ที่ส่งไปราว 2–3px จึงชดเชยไว้)
- Crest ยังไม่มีที่วาง Mana (ปิดไว้), Strip: เกราะ/อากาศเป็นหลอดบาง ไม่ใช่ pip
- layout เดิมทั้ง 15 แบบยังอยู่ครบ (ยังไม่ได้ลบ)

### 11.1 ชุดที่ 2 (2026-11-21) — `ui/js/hudforge_v2_more.js`
โหลดต่อจาก `hudforge_v2.js` แล้วลงทะเบียนผ่าน `HudForgeV2.register(id, { plan, hotbar })` ใช้ตัวช่วยจาก `HudForgeV2.lib`
มีตัวช่วยเพิ่ม: `blob(b, x, y, w, h, insideFn, ramp, opt)` (รูปทรงอะไรก็ได้ + ขอบ + แสงซ้ายบน), `rr` / `circle` / `pill` / `cutBox`, `maskBlob`, `shapeFill`, `infoRows`

| layout id | แนว (genre ใหม่) | หน้าตา |
|---|---|---|
| `cozy` | cute | ชั้นไม้ + ร่อง XP, แถบท่อนไม้มีไอคอนกลม, หญ้า/ดอกไม้, ลังไม้ + พุ่มไม้ข้าง hotbar, ป้ายแขวนมุมซ้ายบน (ชื่อ/มานา/ข้อมูล) |
| `bubble` | cute | แคปซูลพาสเทล (สีจาก `plate` ผสมขาว) + ฟองไอคอน, ฟองเลเวล + ดาว, ประกาย, ช่อง hotbar มน |
| `neon` | scifi | แผงโปร่งเส้นนีออน (สี `accent`) มุมตัด ซ้าย/ขวาของ hotbar, ช่อง hotbar แบบวงเล็บมุม, เลเวลหกเหลี่ยม |
| `steam` | scifi | หลอดแก้วแนวตั้ง HP/อาหาร (ใหญ่) + เกราะ/อากาศ (เล็ก) เติมจากล่าง, ท่อทองแดง, ท่อ XP ทองเหลือง (`metal`), เกจเลเวล |
| `gothic` | dark | ลูกแก้ว HP กลมเหนือ hotbar (แนวตั้ง), เขากระดูก 2 ข้าง, ปีกเหล็ก อาหาร (ซ้าย) / มานาหรืออากาศ (ขวา), เพชรเลเวล |

GENRES ใหม่: `cute`, `scifi`, `dark` · preset ใหม่ 18 อัน (Wood *, Kawaii *, Neon *, Steam *, Gothic *)
ยังไม่ได้ทดสอบในเกมเช่นกัน — หลอด/ลูกแก้วแนวตั้งใช้ `sliceDirection: 'bottom'`

### 11.2 ชุดที่ 3 (2026-11-21) — `ui/js/hudforge_v2_set3.js`
โหลดต่อจาก `hudforge_v2_more.js` (ใช้ตัวช่วยใน `HudForgeV2.lib` ที่ `_more` เพิ่มให้) · ตัวช่วยใหม่ `twinBars()` = แถบ HP ซ้าย + อาหารขวาเหนือ hotbar โดยส่งฟังก์ชันวาดกรอบเข้าไป

| layout id | genre (ใหม่) | หน้าตา / สีจาก kit |
|---|---|---|
| `pirate` | adventure | ดาดฟ้าไม้ (`plate`) + เชือก + ช่องกลมทองเหลือง + พวงมาลัยเรือ (เลเวล) + สมอ + ม้วนกระดาษซ้ายบน (ข้อความสีเข้ม) |
| `samurai` | adventure | ซุ้มประตูแลคเกอร์ (สีจาก `gemRamp`) + ขอบ `metal` + กลีบซากุระ |
| `ocean` | adventure | กรอบแคปซูล (`plate`) + ปะการัง (`gemRamp`) + สาหร่าย + เปลือกหอย + ฟองอากาศ |
| `desert` | adventure | หินทราย + เสาโอเบลิสก์ยอด `metal` + ลาพิส (`gemRamp`) + ดวงอาทิตย์ (เลเวล) |
| `winter` | seasonal | กรอบ `metal` + หิมะทับ + หยาดน้ำแข็ง + เกล็ดหิมะ + ตุ๊กตาหิมะ |
| `halloween` | seasonal | กรอบ `plate` + เมือกหยด + ฟักทอง (เลเวล) + ค้างคาว + หลุมศพ |
| `arcade` | retro | ขอบดำ สีสด (`gemRamp`) + หัวใจ/อาหาร 10 อันแบบ pip + pip เกราะ/อากาศ |

preset รวมของ v2 ตอนนี้ **95 อัน** (รอบนี้ +61: 31 จาก layout ใหม่ + 30 สีเพิ่มของ layout เดิม) · รูปทั้งหมด `docs/hud-forge-templates/v2_<genre>__<name>.png` + `v2_sheet__<genre>.png`
