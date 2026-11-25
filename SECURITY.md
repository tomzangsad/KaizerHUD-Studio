# Security Policy / นโยบายความปลอดภัย

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

### Reporting a Vulnerability

If you discover a security vulnerability in **KaizerHUD Studio** or any companion plugin (`KaizerMultiBar`, `KaizerMultiBarGeyser`, `KaizerUI`) — for example:

- Path traversal during `.mcpack` / `.zip` import, export, or live folder sync
- Arbitrary command or URL execution in the Tauri backend
- Server crashes or permission bypasses in the Minecraft plugins

Please **do not** open a public issue with exploit details. Instead:

1. Use **GitHub Private Vulnerability Reporting** (Security tab → *Report a vulnerability*) if enabled on the repository, **or**
2. Contact the maintainers privately via the official [Discord server](https://discord.gg/rNGH2SpNs5).

Please include steps to reproduce, affected versions, and any suggested fix.

---

## ภาษาไทย

### การแจ้งช่องโหว่ด้านความปลอดภัย

หากคุณพบช่องโหว่ด้านความปลอดภัยใน **KaizerHUD Studio** หรือปลั๊กอินร่วม (`KaizerMultiBar`, `KaizerMultiBarGeyser`, `KaizerUI`) เช่น:

- ปัญหา Path Traversal ระหว่างการ Import / Export ไฟล์ `.mcpack` / `.zip` หรือระบบ Live Folder Sync
- การสั่งรันคำสั่งหรือเปิดลิงก์ที่ไม่ปลอดภัยในฝั่ง Tauri Backend
- บั๊กที่ทำให้เซิร์ฟเวอร์แครชหรือข้าม Permission ในปลั๊กอิน Minecraft

กรุณา **อย่าเปิด Issue แบบสาธารณะ** พร้อมรายละเอียดวิธีโจมตี แต่ให้แจ้งผ่านช่องทางส่วนตัวแทน:

1. ใช้ระบบ **GitHub Private Vulnerability Reporting** (แท็บ Security → *Report a vulnerability*) หากเปิดใช้งานบน Repo หรือ
2. ติดต่อผู้ดูแลโปรเจกต์แบบส่วนตัวผ่าน [Discord](https://discord.gg/rNGH2SpNs5)

กรุณาระบุขั้นตอนการทำซ้ำ เวอร์ชันที่ได้รับผลกระทบ และแนวทางแก้ไข (ถ้ามี) เพื่อช่วยให้ทีมแก้ไขได้เร็วที่สุด
