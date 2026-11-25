# Image Animation — HUD Flip-Book & Sequence Spec

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Any `image` element can be animated (multi-frame loop at 1–60 FPS) across the editor preview, Bedrock `.mcpack` export (`flip_book`), and Java BetterHud export (`sequence`).

- **Element Fields (`type: 'image'`):** `animFrames` (array of PNG data URLs; 2+ frames = animated), `animFps` (1–60), `animFrameSize` (`[w, h]`), `imageData` (always frame 1 for thumbnails & static fallbacks).
- **Bedrock Export (`codegen.rs` + `export.rs`):** Generates a horizontal sprite strip (`export::anim_strip()`), attaches `uv_size: [w, h]`, `uv: "@hud.kz_anim_<n>_<name>"`, and defines a top-level `flip_book` control in `hud_screen.json`. Editor warns if strip width exceeds `4096px`.
- **Editor (`ui/js/animation.js`):** Supports multi-PNG import, animated GIF/WebP/APNG decoding via `ImageDecoder`, and sprite-sheet slicing (`8`, `8v`, `16x4`).
- **Java Import/Export (`javahud.rs` / `javaexport.js`):** Maps BetterHud `type: sequence` (`file:ticks`, 1 tick = 50 ms) bidirectionally (with GCD frame resampling); MythicHUD exports frame 1.
- **Tests:** Covered by `animated_image_uses_flip_book`, `animated_image_strip`, and `sequence_becomes_animation` in `cargo test --lib`.

---

## ภาษาไทย

# Image Animation — รูปเคลื่อนไหวใน HUD (Bedrock flip_book)

> สร้าง 2026-11-23 · ส่วนหนึ่งของ KaizerHUD Studio (`desktop/`) · ทดสอบกับ pack `Template_HUD/HudGraveyard` (BetterHud `sequence`)

Image element ทุกตัวทำเป็นรูปเคลื่อนไหวได้ (หลายเฟรมเล่นวนตาม FPS) ทั้งใน editor, export .mcpack (Bedrock) และ export Java (BetterHud)

## 1. ข้อมูลใน element (`type: 'image'`)
| ฟิลด์ | ความหมาย |
|---|---|
| `animFrames` | `[dataURL, …]` PNG ทุกเฟรม (2 เฟรมขึ้นไป = มี animation, ว่าง = รูปนิ่ง) |
| `animFps` | เฟรมต่อวินาที 1–60 (Bedrock ใช้จำนวนเต็ม) |
| `animFrameSize` | `[w, h]` ขนาด texture ของ 1 เฟรม (ทุกเฟรมถูกย่อ/ขยายให้เท่าเฟรม 1 แบบ nearest) |
| `imageData` | = เฟรม 1 เสมอ (thumbnail, MythicHUD, โค้ดเก่าที่ไม่รู้จัก animation) |

`size` ของ element คือขนาดบนจอ (GUI px) แยกจาก `animFrameSize` — ย่อ/ขยายได้เหมือนรูปปกติ

## 2. Export Bedrock (`codegen.rs` + `export.rs`)
- texture = **แถบแนวนอน** ของทุกเฟรม (เฟรม 1 ซ้ายสุด) กว้าง `w × จำนวนเฟรม` → `export::anim_strip()`
- image control ได้ `uv_size: [w, h]`, `uv: "@hud.kz_anim_<n>_<ชื่อ>"`, `disable_anim_fast_forward: true`
- นิยาม animation อยู่ระดับบนของ `hud_screen.json` (namespace `hud`) จึงอ้างได้จากไฟล์ที่ถูก split/obfuscate:
  ```json
  "kz_anim_1_under_left1": { "anim_type": "flip_book", "initial_uv": [0, 0], "frame_count": 8,
                             "frame_step": 144, "fps": 5, "reversible": false, "easing": "linear" }
  ```
- `codegen::image_anim(el)` → `(จำนวนเฟรม, w, h, fps)`; ใช้ `animFrameSize` ก่อน ถ้าไม่มีอ่านจาก header PNG ของเฟรม 1
- Code view ส่งเฟรมเป็น PNG 1×1 (เร็ว) — โค้ดยังถูกเพราะใช้ `animFrameSize`
- ⚠ แถบกว้างเกิน **4096px** บางเครื่อง (มือถือ) โหลดไม่ได้ → editor เตือน (ลดจำนวน/ขนาดเฟรม)
- รูปแบบ flip_book (แถบแนวนอน, `frame_step` = ความกว้างเฟรม) ตรงกับที่ vanilla ใช้ (auto_save ฯลฯ) — **ยังไม่ได้ทดสอบในเกมจริง**

## 3. Editor (`ui/js/animation.js` → `window.KzAnim`)
- Properties → Image → **Animation**
  - `+ Frames…` เลือก PNG หลายไฟล์ (เรียงตามชื่อแบบตัวเลข: frame2 < frame10) หรือ GIF / WebP / APNG เคลื่อนไหว 1 ไฟล์ (ถอดเฟรมด้วย `ImageDecoder` ของ WebView2) · เลือกรูปนิ่ง 1 ไฟล์ = เพิ่มเป็นเฟรม 2
  - `From sprite sheet…` ตัดรูปปัจจุบันเป็นเฟรม: `8` (แนวนอน), `8v` (แนวตั้ง), `16x4` (ตาราง 4 ต่อแถว)
  - เมื่อมี animation: แถบ thumbnail, ช่อง FPS, ปุ่ม Pause/Play preview (จำค่าใน `localStorage['kzAnimPreview']`), Replace…, Remove (เหลือเฟรม 1)
- Add Image / Change Image ด้วย GIF เคลื่อนไหว → ได้ animation ทันที · JPEG/WebP/GIF นิ่งถูกแปลงเป็น PNG (เดิมเขียนไฟล์ JPEG ลงชื่อ .png)
- พรีวิวบน canvas: `preview.js` ใส่ `data-kz-anim` ที่ `<img>` แล้ว `animation.js` สลับเฟรมทุก 33ms
- ทุกการเปลี่ยนเป็น Undo 1 ครั้ง (`App.updateElement`)

## 4. Import Java (`javahud.rs` + `javaimport.js`)
- BetterHud `type: sequence` → `anim: { frames: [image ids], fps }` ใน IR
  - `files: [a.png:16, …]` = แสดง 16 tick, ไม่มีเลข = 1 tick · คูณ `tick-speed` ใน config.yml (1 tick = 50ms)
  - เฟรมซ้ำติดกันถูกรวม (HudGraveyard ซ้ำเฟรมละ 4 → 32 ไฟล์ = 8 เฟรม 5 fps)
  - เวลาไม่เท่ากัน → หา ห.ร.ม. แล้วทำเฟรมซ้ำให้เวลาตรง (เกิน 96 เฟรม = ใช้เวลาเฉลี่ย + เตือน)
- หน้าต่าง Import: ป้าย `▶ 8` ข้างชื่อ และพรีวิวเล่น animation
- fps ที่ไม่เป็นจำนวนเต็มถูกปัด (แจ้งในรายการ Please check)

## 5. Export Java (`javaexport.js`)
- BetterHud: `images: { type: sequence, files: ["ns/name.png:4", "ns/name_2.png:4", …] }` (ticks = round(20/fps))
- MythicHUD: เฟรม 1 อย่างเดียว + note
- เฟรม animation ไม่ถูกตัด tile/trim (ทุกเฟรมต้องตรงกัน) — เกิน 256px BetterHud ไม่แสดง (เตือน)
- ทดสอบ round trip: HudGraveyard → editor → BetterHud zip → import กลับ: 11 animation (8 เฟรม 5 fps) ครบ

## 6. ทดสอบแล้ว / ยังไม่ได้ทดสอบ
- `cargo test --lib` (34 ตัว รวมใหม่: `animated_image_uses_flip_book`, `animated_image_strip`, `sequence_becomes_animation`)
- Playwright กับ `desktop/ui`: สร้าง animation, พรีวิวสลับเฟรม, pause, FPS + undo, remove, import HudGraveyard, export BetterHud
- **ยังไม่ได้ทดสอบในเกม Bedrock / Java จริง** และยังไม่ได้ build exe (ต้องรัน `cargo build --release` บนเครื่อง)
