# Contributing to KaizerHUD Studio

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

Thank you for wanting to make **KaizerHUD Studio** better! Whether you write Rust, JavaScript, Java, design HUD templates, or translate docs, your help is welcome.

### Ways to Contribute

1. **Report bugs** — Use the Bug Report issue template with steps to reproduce and logs/screenshots.
2. **Suggest features** — Open a Feature Request to discuss UX improvements, new elements, or plugin integrations.
3. **Submit original templates or themes** — Use the Template Submission template. All submitted assets must be your own original work or CC0 / compatible with GPL-3.0.
4. **Fix bugs or build features** — Fork the repository, create a branch, and open a Pull Request.

### Development Workflow

1. Fork the repo and clone your fork.
2. Create a descriptive branch (`fix/bar-offset` or `feat/linux-opener`).
3. Make focused, clean changes. Avoid bundling unrelated refactors with a bug fix.
4. Run checks before pushing:
   - **Rust:** `cd src-tauri && cargo test --lib && cargo check`
   - **Plugins:** `mvn -B clean package` inside the modified plugin folder (`plugins/KaizerMultiBar`, `plugins/KaizerMultiBarGeyser`, or `plugins/KaizerUI`)
5. Open a Pull Request describing **what** changed, **why**, and **how you tested it**.

### Asset & Licensing Rules

- All code contributions are licensed under **GPL-3.0** (see [LICENSE](LICENSE)).
- **Do not submit** paid/proprietary resource packs, textures, fonts, or plugin files belonging to third parties.

---

## ภาษาไทย

ขอบคุณที่สนใจมาร่วมพัฒนา **KaizerHUD Studio** ให้ดียิ่งขึ้นครับ! ไม่ว่าคุณจะเขียน Rust, JavaScript, Java, ออกแบบเทมเพลต HUD/GUI หรือช่วยแปลภาษา เรายินดีต้อนรับทุกการมีส่วนร่วม

### ช่องทางในการร่วมพัฒนา

1. **แจ้งบั๊ก** — ใช้แบบฟอร์ม Bug Report พร้อมขั้นตอนการทำซ้ำและภาพหน้าจอ/log
2. **เสนอฟีเจอร์ใหม่** — เปิด Feature Request เพื่อพูดคุยและวางแนวทางฟีเจอร์หรือการรองรับปลั๊กอินเพิ่มเติม
3. **ส่งเทมเพลตหรือธีมใหม่** — ใช้แบบฟอร์ม Template Submission โดยไฟล์ภาพและดีไซน์ทั้งหมดต้องเป็นงานที่สร้างเอง หรือใช้สัญญาอนุญาตแบบ CC0 / เข้ากันได้กับ GPL-3.0
4. **แก้โค้ดหรือเพิ่มความสามารถ** — Fork repository, สร้าง branch ใหม่ แล้วเปิด Pull Request

### ขั้นตอนการทำงานของนักพัฒนา

1. Fork repository แล้ว clone ลงเครื่อง
2. ตั้งชื่อ branch ให้สื่อความหมาย (เช่น `fix/bar-offset` หรือ `feat/linux-opener`)
3. แก้โค้ดให้ตรงประเด็น ไม่ปน refactor ที่ไม่เกี่ยวข้องกับงาน
4. รันตรวจสอบก่อน push ทุกครั้ง:
   - **ฝั่ง Rust:** `cd src-tauri && cargo test --lib && cargo check`
   - **ฝั่งปลั๊กอิน:** รัน `mvn -B clean package` ในโฟลเดอร์ปลั๊กอินที่แก้ไข (`plugins/KaizerMultiBar`, `plugins/KaizerMultiBarGeyser` หรือ `plugins/KaizerUI`)
5. เปิด Pull Request พร้อมอธิบาย **สิ่งที่แก้**, **เหตุผล**, และ **วิธีทดสอบ**

### กฎด้านลิขสิทธิ์ไฟล์และ Asset

- โค้ดทั้งหมดที่ส่งเข้ามาจะอยู่ภายใต้สัญญาอนุญาต **GPL-3.0** (ดู [LICENSE](LICENSE))
- **ห้ามส่ง** Resource Pack เสียเงิน, เทกซ์เจอร์, ฟอนต์ หรือไฟล์ปลั๊กอินที่มีลิขสิทธิ์ของบุคคลที่สามเข้ามาใน Repository เด็ดขาด
