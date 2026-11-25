# Architecture Overview / ภาพรวมสถาปัตยกรรมระบบ

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

This document maps out how **KaizerHUD Studio** and its companion plugins fit together so new contributors can quickly find where changes belong.

### High-Level Data Flow

```text
+-------------------------------------------------------------------+
|  Frontend (ui/) — Vanilla HTML/CSS/JS inside Tauri WebView        |
|  - HUD Editor (ui/index.html) & GUI Studio (ui/gui.html)          |
|  - State in App.elements / GS model + override patches            |
+-------------------------------+-----------------------------------+
                                | Tauri IPC (invoke)
                                v
+-------------------------------------------------------------------+
|  Desktop Backend (src-tauri/src/) — Rust                          |
|  - lib.rs        : Tauri commands & AppState (projects storage)   |
|  - storage.rs    : Local JSON project CRUD (%APPDATA%/.../projects)|
|  - codegen.rs    : Bedrock JSON UI + KaizerMultiBar config.yml    |
|  - overrides.rs  : Non-destructive user JSON patch application    |
|  - export.rs     : Builds output.zip (.mcpack + config.yml) & sync|
|  - javahud.rs    : BetterHud / MythicHUD pack importer            |
|  - javaexport.rs : BetterHud / MythicHUD config generator         |
|  - guistudio.rs  : GUI Studio project storage & export            |
+-------------------------------+-----------------------------------+
                                | Exports output.zip
                                v
+-------------------------------------------------------------------+
|  Minecraft Server (plugins/) — Java 21 / Paper / Geyser           |
|  - KaizerMultiBar      : Encodes HP/food/armor/air/EXP/PAPI/flags |
|                          into bossbar or hidden title channel     |
|  - KaizerMultiBarGeyser: Geyser extension keeping HUD bar on top  |
|  - KaizerUI            : Renders GUI Studio menus (hologram/form) |
+-------------------------------------------------------------------+
```

### Key Subsystems & Documentation

Detailed specs and notes live in `docs/` ([docs/README.md](docs/README.md)):
- [docs/HUD_CHANNEL.md](docs/HUD_CHANNEL.md) — Bossbar vs. hidden Title data channel protocol
- [docs/HUD_ANIMATION.md](docs/HUD_ANIMATION.md) — Flip-book sprite strips & animation encoding
- [docs/HUD_FORGE.md](docs/HUD_FORGE.md) — Template & theme generator system
- [docs/GUI_STUDIO.md](docs/GUI_STUDIO.md) — GUI Studio architecture & 3D doll / cursor menus
- [docs/GUI_TEMPLATES_PLAN.md](docs/GUI_TEMPLATES_PLAN.md) — GUI template roadmap
- [docs/JAVA_HUD_IMPORT.md](docs/JAVA_HUD_IMPORT.md) — BetterHud / MythicHUD import pipeline
- [docs/JAVA_HUD_EXPORT.md](docs/JAVA_HUD_EXPORT.md) — Java HUD export pipeline

### Contributor Roadmap / Good First Issues

1. **Cross-platform support:** Replace Windows-only `explorer` / `rundll32` calls in `src-tauri/src/lib.rs` with `tauri-plugin-opener` so macOS and Linux contributors can run the desktop app natively.
2. **Internationalization (i18n):** Extract UI strings in `ui/` to JSON locale files (EN, TH, ZH, ES, etc.).
3. **Frontend modularization:** Split large vanilla JS files (`ui/js/hudforge*.js`, `ui/js/controls.js`, `ui/js/guistudio/gs_editor.js`) into clean ES modules.
4. **Rust codegen modularization:** Break `src-tauri/src/codegen.rs` and `src-tauri/src/javahud.rs` into smaller focused submodules.
5. **Additional Java HUD / resource pack adapters:** Add import/export support for popular community HUD/UI plugins.

---

## ภาษาไทย

เอกสารนี้อธิบายโครงสร้างและการทำงานร่วมกันระหว่างโปรแกรม **KaizerHUD Studio** และปลั๊กอินฝั่งเซิร์ฟเวอร์ เพื่อให้นักพัฒนาใหม่หาจุดแก้โค้ดได้ทันที

### ภาพรวมการไหลของข้อมูล

- **Frontend (`ui/`):** เขียนด้วย HTML / CSS / Vanilla JS รันใน Tauri WebView แยกเป็น 2 โหมดคือ HUD Editor (`ui/index.html`) และ GUI Studio (`ui/gui.html`) ส่งข้อมูลไปหลังบ้านผ่าน Tauri IPC (`invoke`)
- **Desktop Backend (`src-tauri/src/`):** เขียนด้วย Rust
  - `lib.rs`: จุดรวม Tauri commands และจัดการโปรเจกต์
  - `storage.rs`: บันทึก/โหลดโปรเจกต์เป็นไฟล์ JSON ในเครื่องผู้ใช้
  - `codegen.rs` & `overrides.rs`: สร้าง Bedrock JSON UI + `config.yml` พร้อมระบบ patch ทับโค้ดโดยไม่ทับค่าที่สร้างใหม่
  - `export.rs`: แพ็คไฟล์เป็น `output.zip` (`.mcpack` + `config.yml`) และซิงก์ลงโฟลเดอร์ทดสอบแบบเรียลไทม์
  - `javahud.rs` & `javaexport.rs`: นำเข้า/ส่งออกคอนฟิก BetterHud และ MythicHUD
  - `guistudio.rs`: ระบบจัดการโปรเจกต์และ export ของ GUI Studio
- **Server Plugins (`plugins/`):** เขียนด้วย Java 21 (Paper / Purpur / Folia / Geyser)
  - `KaizerMultiBar`: ส่งค่าพลัง อาหาร เกราะ EXP และ PAPI ให้ผู้เล่น Bedrock ผ่าน bossbar หรือ hidden title
  - `KaizerMultiBarGeyser`: Extension ของ Geyser ช่วยดัน bossbar ของ HUD ให้อยู่แถวบนสุด
  - `KaizerUI`: แสดงเมนูจาก GUI Studio (Java เป็น hologram + เคอร์เซอร์, Bedrock เป็น server form)

### แนวทางงานที่เปิดรับอาสาสมัคร (Good First Issues)

1. **รองรับ macOS / Linux:** เปลี่ยนการเปิดโฟลเดอร์และลิงก์ใน `src-tauri/src/lib.rs` จากคำสั่งเฉพาะ Windows ไปใช้ `tauri-plugin-opener`
2. **ระบบแปลภาษา (i18n):** แยกข้อความใน `ui/` ออกมาเป็นไฟล์ภาษา (EN / TH / อื่นๆ)
3. **แยกโมดูลโค้ดขนาดใหญ่:** แบ่งไฟล์ใน `ui/js/` และ `src-tauri/src/` (`codegen.rs`, `javahud.rs`) ออกเป็นโมดูลย่อยที่อ่านง่ายขึ้น
4. **รองรับปลั๊กอิน HUD เพิ่มเติม:** เพิ่มตัวนำเข้า/ส่งออกสำหรับปลั๊กอินยอดนิยมในชุมชน Minecraft
