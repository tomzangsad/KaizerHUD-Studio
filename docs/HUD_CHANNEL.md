# HUD Data Channel — Bossbar vs. Title Spec

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Bedrock HUD state is encoded into a single string (`@zelisce/custom_bossbars:` + bar codes + text/nameplate slots + visibility markers `@v01...`).

- **Supported Channels (`HudChannel`):**
  - `bossbar` (default): Uses the `boss_bars` collection. Persistent and never overwrites other messages; requires keeping our boss bar first via PacketEvents.
  - `title`: Uses a hidden `kz_hud_store` panel (`#kz_saved` + `visibility_changed` binding on `#hud_title_text_string`) so vanilla `hud_title_text` is hidden only when our prefix is present, and HUD state persists across other plugins' titles. Does not need PacketEvents.
  - *(Historical note: `actionbar` was tested and removed because Bedrock cannot isolate `$actionbar_text` into a persistent store outside the vanilla actionbar control.)*
- **Plugin (`KaizerMultiBar 2.1`):** Configured via `bossbar.channel` (`bossbar | title`) and `bossbar.channel-resend-ticks` (`100` default). `/kzbos` sends `@zelisce/custom_bossbars:~off` to hide the HUD.
- **Debug Mode:** `hudChannelDebug` renders a yellow diagnostic line at the top without hiding the title.

---

## ภาษาไทย

# HUD Data Channel — ส่งข้อมูล HUD ทาง Boss bar / Title

> สร้าง 2026-11-23 · KaizerHUD Studio (`desktop/`) + KaizerMultiBar 2.1
>
> **2026-11-24 (31): Action bar ถูกเอาออก** (ทดสอบแล้วใช้ไม่ได้ ดู 3.1) — ส่วนที่พูดถึง Action bar ด้านล่างเป็นบันทึกการทดลอง

## 1. ภาพรวม
- ข้อมูล HUD ฝั่ง Bedrock เป็น **ข้อความเดียว**: `@zelisce/custom_bossbars:` + ส่วน bar + slot ข้อความ/nameplate + marker เงื่อนไข (`@v01` …)
- เดิมส่งเป็นชื่อ bossbar เท่านั้น ตอนนี้เลือกได้ในหน้าต่าง **Export → Bedrock data channel**:

| ช่องทาง | pack อ่านจาก | ข้อดี | ข้อควรรู้ |
|---|---|---|---|
| **Boss bar** (ค่าเริ่ม) | collection `boss_bars` | ข้อมูลอยู่ตลอด ไม่แทนข้อความของใคร | ต้องให้ bossbar ของเราอยู่แถวบน (PacketEvents), bar ของ bossbar ทุกอันถูกทำให้ใส |
| **Action bar** | control ที่ `hud_actionbar_text_factory` สร้าง (`$actionbar_text`) | ไม่มี bossbar ของเรา → bossbar ปลั๊กอินอื่นแสดงปกติ | ปลั๊กอิน RPG/สกิล (AuraSkills, mcMMO, Jobs …) ใช้ action bar บ่อย — ข้อความของเขาถูกแทนตอนข้อมูลเราเปลี่ยน |
| **Title** (แนะนำเป็นตัวเลือกที่ 2) | global binding `#hud_title_text_string` | ปลั๊กอินส่วนใหญ่ใช้ title แค่ตอนเข้าเซิร์ฟ/อีเวนต์ → ชนน้อยสุด | title ของคนอื่นที่ขึ้นค้างอยู่ถูกตัดตอนข้อมูลเราเปลี่ยน |

- ค่าที่เลือกเก็บกับโปรเจกต์ (`hudChannel`: `bossbar` / `actionbar` / `title`) และ config.yml ใน output.zip ใส่ `bossbar.channel` ให้ตรงกันอัตโนมัติ
- ที่ไม่ได้ทำ: scoreboard sidebar (เซิร์ฟใช้บ่อยมาก), tab header/footer (Bedrock ไม่มี), chat (เปลืองและเห็นใน log)

## 2. ฝั่ง pack (`codegen.rs`)
- `HudChannel` + `HudOptions.channel` (อ่านจาก `hudChannel` ของโปรเจกต์) · `apply_hud_channel(files, channel)` ทำงานหลังสร้างไฟล์เสร็จ (ทั้ง Readable และ Encrypted) — **Boss bar ไม่เปลี่ยนแม้แต่ byte เดียว**
- Action bar / Title:
  1. ทุก binding `#bossName` จาก collection `boss_bars` → view binding จาก `kz_hud_store` (`#kz_saved` ลบ `…:~off`) → expression ตัด slice / marker / ระดับ bar เดิมใช้ได้หมด
  2. grid `collection_name: boss_bars` → panel ที่มี instance เดียว (`kz_hud_instance@<template>`)
  3. ลบ override ของ vanilla `boss_health_panel`, `boss_name_panel`, `progress_bar` และไม่ใส่ texture bar ใสของ bossbar (`export.rs`) → bossbar ปลั๊กอินอื่นหน้าตาปกติ
  4. `kz_hud_store` (panel 0×0) จำ **ข้อความล่าสุดที่มี prefix ของเรา** ด้วยเทคนิค wiki.bedrock.dev "Preserve Title Texts": copy ด้วย `binding_condition: visibility_changed` และ panel โผล่เฉพาะตอนข้อความใหม่มี prefix และต่างจากที่จำไว้ → HUD ไม่หายเมื่อปลั๊กอินอื่นส่ง title/action bar ทับ หรือเมื่อ title/action bar ของเราหมดเวลา
  5. Title: ซ่อน vanilla `hud_title_text` (#visible) ตอนข้อความมี prefix
  6. Action bar: `kz_ab_area` = panel ที่มี factory `hud_actionbar_text_factory` ของเราเอง สร้าง `kz_ab_data` (`property_bag #kz_ab = $actionbar_text`) ทุกครั้งที่มี action bar · store อ่านด้วย `source_control_name: kz_ab_data` · vanilla `hud_actionbar_text` ซ่อนด้วย `$kz_atext` + `visible` เมื่อมี prefix
- เทสต์: `channel_tests` (3 ตัว) ใน codegen.rs — bossbar เหมือนเดิม, ไม่มี `boss_bars` เหลือ, template ทุกตัวมีอยู่จริง (ทั้ง Readable/Encrypted), config.yml มี `channel:`

## 3. ฝั่งปลั๊กอิน (KaizerMultiBar 2.1)
- `config.yml`: `bossbar.channel: bossbar | actionbar | title`, `bossbar.channel-resend-ticks: 100`
- `ChannelBarStrategy` (ใหม่): สร้างข้อความด้วย `CombinedBarStrategy.buildTitle()` (แยกออกมาให้ใช้ร่วมกัน → ข้อความเหมือน bossbar ทุกตัวอักษร)
  - ส่งเฉพาะตอนข้อความเปลี่ยน + ส่งซ้ำทุก `channel-resend-ticks` (0 = เฉพาะตอนเปลี่ยน) + ตอน join / respawn / เปลี่ยนโลก
  - Title: `Player#sendTitle(String, null, 0, 40, 0)` (แปลงข้อความด้วย CraftChatMessage แบบเดียวกับ `BossBar#setTitle`)
  - Action bar: Paper `Player#sendActionBar(String)` ผ่าน reflection (CraftChatMessage) ถ้าไม่มีใช้ Adventure legacy
  - `/kzbos` ซ่อน = ส่ง `@zelisce/custom_bossbars:~off` (pack ลบทั้งก้อน → ไม่มี prefix → HUD ซ่อน) · ปิดปลั๊กอิน/ผู้เล่นหมดสิทธิ์ก็ส่งตัวนี้
- `BossBarManager.buildStrategy()` เลือก strategy ตาม `channel` · Core ไม่เปิด `BarPriorityManager` (PacketEvents) ตอนไม่ได้ใช้ bossbar และ `/kzbos reload` สลับให้ถูก
- ส่งเฉพาะผู้เล่นที่ `canSeeBossBar` เหมือนเดิม (Bedrock หรือมี permission `kaizermultibar.show`)

## 3.1 ผลทดสอบในเกม (2026-11-23)
- **Title: ใช้ได้** — HUD ขึ้น, title ของคนอื่น (`/title @s title hello`) ขึ้นปกติและ HUD ไม่หาย
- **Action bar: ใช้ไม่ได้** — Export → Debug text แสดง probe:
  - `R=ROOT` (panel ใน root อ่านได้) แต่ `L=` (ค่าคงที่ใน panel ที่อยู่ใน control ของ action bar) **ว่าง** → `source_control_name` หา control ที่ factory ของ action bar สร้างไม่เจอ
  - `T=@zelisce/cust` → `$actionbar_text` ใช้ใน expression ของ `text` ได้ แต่แค่ภายใน control ของ action bar เอง
  - สรุป: เก็บข้อมูลแยกไว้ไม่ได้ ทางเดียวคือวาง HUD ไว้ใน control ของ action bar ซึ่งถูกสร้างใหม่ทุกข้อความ (ปลั๊กอินอื่นส่ง action bar = HUD หายจนกว่าเราจะส่งใหม่) — รอผู้ใช้ตัดสินใจว่าจะเอาออกหรือทำแบบนี้
- Debug text: `hudChannelDebug` → `apply_hud_channel_with(.., debug)` บรรทัดเหลือง `KZ <ch> | in | saved` และไม่ซ่อน title/action bar ของเกม (title ที่เห็นค้างกลางจอตอน Debug = ปกติ)

## 4. ยังไม่ได้ทดสอบในเกม — จุดที่ต้องดู
1. **Title:** HUD ขึ้นไหม, title ของเราไม่โผล่กลางจอ, ใช้ `/title @s title สวัสดี` แล้ว title นั้นขึ้นปกติและ HUD ไม่หาย
2. **Action bar:** `kz_ab_data` อ่าน `$actionbar_text` ผ่าน `property_bag` ได้จริงไหม (ส่วนที่มั่นใจน้อยสุด), action bar ของเราไม่โผล่, action bar ของคนอื่นยังขึ้น
3. ข้อความ (slot) ตำแหน่งตรงเหมือนโหมด bossbar (Geyser ใส่ `§r` นำหน้า title/action bar เหมือน bossbar หรือไม่ — expression ตัดได้ทั้งสองแบบ)
4. `/kzbos` ซ่อน/แสดง, ตาย/เกิดใหม่, เปลี่ยนมิติ แล้ว HUD กลับมา
5. ถ้า Action bar อ่านไม่ได้: ลองเปลี่ยน `kz_ab_data` เป็น view binding `('' + $actionbar_text)` หรือย้ายไปเป็นลูกของ `hud_actionbar_text` (modifications) — Title ไม่ได้ใช้ส่วนนี้
