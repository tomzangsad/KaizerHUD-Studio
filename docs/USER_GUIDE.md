# User & Server Owner Guide / คู่มือการใช้งานโปรแกรมสำหรับผู้ใช้และเจ้าของเซิร์ฟเวอร์

[English](#english) · [ภาษาไทย](#ภาษาไทย)

> **No coding or compiling required!** If you are a developer looking to fork, clone, or build from source, see [DEVELOPMENT.md](DEVELOPMENT.md).
> **ไม่ต้องเขียนโค้ดและไม่ต้องคอมไพล์เอง!** ถ้าคุณเป็นนักพัฒนาที่ต้องการ Fork / Clone / Build โค้ดเอง ดูที่ [DEVELOPMENT.md](DEVELOPMENT.md)

---

## English

### 1. What to Download

Download ready-to-use files directly from **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**:

| File | Needed for | Where it goes |
|---|---|---|
| `KaizerHUD Studio_*_x64-setup.exe` | Windows Installer *(recommended)* | Run to install with Start Menu / Desktop shortcut |
| `kaizerhud-portable.exe` | Portable edition *(no install needed)* | Double-click and run directly anywhere (`kaizerhud.exe` in `v1.0.0`) |
| `KaizerMultiBar-2.1.0.jar` | **HUD Studio** (required on server) | Server `plugins/` folder (Paper / Purpur / Folia 1.21+) |
| `KaizerUI-1.0.0.jar` | **GUI Studio** (only if you design cursor menus) | Server `plugins/` folder (Paper / Purpur / Folia 1.21+) |

> **Why does the portable `.exe` work without installing?** KaizerHUD Studio is built with Tauri and bundles the entire app UI into one standalone ~5 MB binary using Windows' built-in WebView2 runtime. Choose `*-setup.exe` if you prefer a classic installer, or `kaizerhud-portable.exe` if you want zero setup.
>
> **Server dependencies:** [GeyserMC](https://geysermc.org/) (+ Floodgate recommended), [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/), and optionally [PacketEvents](https://modrinth.com/plugin/packetevents). See [plugins/README.md](../plugins/README.md) for full plugin configuration.

---

### 2. Using HUD Studio (Bedrock HUD + Optional Java HUD)

1. **Open KaizerHUD Studio** on your computer (from the Start Menu if installed, or double-click `kaizerhud-portable.exe`).
2. **Design your HUD:**
   - Add elements from the left toolbar: **Image (`I`)**, **Scoreboard Text (`T`)**, **Player Head (`H`)**, **Status Bar (`B`)**, **XP Level (`X`)**, **Nameplate (`N`)**, or **Hotbar Widgets**.
   - Or click **HUD Forge (`F`)** to generate a full pixel-art HUD from 95+ built-in templates and color themes.
   - *(Optional)* **File → Import Java HUD Pack…** lets you convert an existing BetterHud / MythicHUD / HappyHUD / CustomNameplates pack into a Bedrock HUD.
   - *(Optional)* Switch to **Code (`Ctrl+2`)** or **Split (`Ctrl+3`)** to inspect/edit generated JSON live, or set up **Live Folder Sync** into your local Minecraft `development_resource_packs` folder.
3. **Export (`Ctrl+E`):**
   - Pick **Bedrock data channel**:
     - **Boss bar** *(default)* — Persistent data; recommended with `PacketEvents`.
     - **Title** — Uses hidden titles so other plugins' boss bars stay untouched.
   - *(Optional)* Tick **Also export Java HUD config** if you also run BetterHud or MythicHUD for Java players.
   - Save `output.zip`.
4. **Install on your server:**
   - Copy `GeyserMC/packs/<namespace>.mcpack` into your Geyser `packs/` folder.
   - Copy `plugins/KaizerMultiBar/config.yml` into your server's `plugins/KaizerMultiBar/` folder.
   - Restart the server (or run `/kzbos reload` and reload Geyser packs).

---

### 3. Using GUI Studio (Interactive Java & Bedrock Menus)

1. Click the **GUI** workspace switch on the top title bar (or **File → Switch to GUI Studio**).
2. Build menu pages using **Images**, **Buttons**, **Texts**, **Shapes (`S`)**, **Icons (`O`)**, **Player Heads / 3D Models**, **Motion animations**, or press **`M`** for **Menu from Template**.
3. Click **File → Export (`Ctrl+E`)** and choose your Java resource pack plugin (`ItemsAdder`, `Nexo`, `Oraxen`, or standalone zip).
4. Follow the generated `README_KaizerUI.txt` inside the exported zip:
   - Put `KaizerUI-1.0.0.jar` in `plugins/`.
   - Copy `plugins/KaizerUI/` (`menus/*.yml` and `studio.yml`), the `.mcpack` for Geyser, and the Java resource pack to their folders.
   - Restart the server or run `/kui reload`.

---

### 4. Built-in Wiki & Community Help

- Press **`F1`** inside the app anytime to open the bilingual **User Guide & Wiki** (`ui/wiki.html`).
- Ask questions or share HUDs on **[GitHub Discussions](https://github.com/tomzangsad/KaizerHUD-Studio/discussions)** or **[Discord](https://discord.gg/rNGH2SpNs5)**.
- Found a bug? Open an issue via **[GitHub Issues](https://github.com/tomzangsad/KaizerHUD-Studio/issues/new/choose)**.

---

## ภาษาไทย

### 1. ไฟล์ที่ต้องดาวน์โหลด (ไม่ต้องคอมไพล์เอง)

ดาวน์โหลดไฟล์พร้อมใช้งานได้ทันทีจากหน้า **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**:

| ไฟล์ | ใช้ทำอะไร | เอาไปวางที่ไหน |
|---|---|---|
| `KaizerHUD Studio_*_x64-setup.exe` | ตัวติดตั้งโปรแกรมบน Windows *(แนะนำ)* | ดับเบิลคลิกเพื่อติดตั้งลงเครื่อง พร้อมสร้างไอคอนหน้า Desktop / Start Menu |
| `kaizerhud-portable.exe` | ตัวโปรแกรมแบบพกพา *(ไม่ต้องติดตั้ง)* | ดับเบิลคลิกเปิดใช้งานได้ทันที (ใน `v1.0.0` จะชื่อ `kaizerhud.exe`) |
| `KaizerMultiBar-2.1.0.jar` | **สำหรับ HUD Studio** *(จำเป็น)* | โฟลเดอร์ `plugins/` ของเซิร์ฟเวอร์ (Paper / Purpur / Folia 1.21+) |
| `KaizerUI-1.0.0.jar` | **สำหรับ GUI Studio** *(ลงเฉพาะเมื่อใช้เมนู GUI)* | โฟลเดอร์ `plugins/` ของเซิร์ฟเวอร์ (Paper / Purpur / Folia 1.21+) |

> **ทำไมโหลดแค่ไฟล์ `.exe` เดียวก็เปิดใช้ได้เลย?** เพราะตัวโปรแกรมพัฒนาด้วย Tauri ซึ่งรวมหน้าจอ UI และโค้ดทั้งหมดเข้าไปในไฟล์เดียว (ประมาณ 5 MB) และเรียกใช้ WebView2 ที่มีมาให้แล้วใน Windows 10/11 จึงใช้งานได้ทันทีแบบ Portable ครับ ส่วนใครชอบแบบติดตั้งผ่าน Wizard ก็เลือกโหลดไฟล์ `*-setup.exe` ได้เลยครับ
>
> **ปลั๊กอินพื้นฐานที่เซิร์ฟเวอร์ควรมี:** [GeyserMC](https://geysermc.org/) (+ Floodgate), [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/), และ [PacketEvents](https://modrinth.com/plugin/packetevents) (แนะนำ) — ดูวิธีตั้งค่าและคำสั่งปลั๊กอินทั้งหมดได้ที่ [plugins/README.md](../plugins/README.md)

---

### 2. วิธีใช้งาน HUD Studio (ทำ HUD Bedrock + เสริมฝั่ง Java)

1. **เปิดโปรแกรม KaizerHUD Studio** บนเครื่องของคุณ (จาก Start Menu หรือเปิด `kaizerhud-portable.exe`)
2. **ออกแบบ HUD:**
   - เพิ่มองค์ประกอบจากแถบซ้าย: **Image (`I`)**, **Scoreboard Text (`T`)**, **Player Head (`H`)**, **Status Bar (`B`)**, **XP Level (`X`)**, **Nameplate (`N`)**, หรือ **Hotbar Widgets**
   - หรือกดปุ่ม **HUD Forge (`F`)** เพื่อสร้าง HUD สไตล์ pixel art สำเร็จรูปกว่า 95 แบบพร้อมธีมสี
   - *(ตัวเลือก)* **File → Import Java HUD Pack…** สำหรับนำเข้า pack จาก BetterHud / MythicHUD / HappyHUD / CustomNameplates มาแปลงเป็น HUD Bedrock
   - *(ตัวเลือก)* สลับไปหน้า **Code (`Ctrl+2`)** หรือ **Split (`Ctrl+3`)** เพื่อดู/แก้โค้ด JSON สดๆ หรือเปิด **Live Folder Sync** ซิงก์ลงโฟลเดอร์ `development_resource_packs` ของ Minecraft เพื่อเทสต์ทันที
3. **กด Export (`Ctrl+E`):**
   - เลือก **Bedrock data channel**:
     - **Boss bar** *(ค่าเริ่มต้น)* — ข้อมูลค้างตลอด แนะนำให้ใช้คู่กับ `PacketEvents`
     - **Title** — ส่งผ่าน title แบบซ่อน ไม่รบกวน boss bar ของปลั๊กอินอื่น
   - *(ตัวเลือก)* ติ๊ก **Also export Java HUD config** ถ้าต้องการส่งออกคอนฟิกสำหรับ BetterHud / MythicHUD ฝั่ง Java ไปพร้อมกัน
   - บันทึกไฟล์ `output.zip`
4. **นำไปติดตั้งบนเซิร์ฟเวอร์:**
   - นำไฟล์ `GeyserMC/packs/<namespace>.mcpack` ไปใส่ในโฟลเดอร์ `packs/` ของ Geyser
   - นำไฟล์ `plugins/KaizerMultiBar/config.yml` ไปวางใน `plugins/KaizerMultiBar/` ของเซิร์ฟเวอร์
   - รีสตาร์ตเซิร์ฟเวอร์ (หรือรัน `/kzbos reload`)

---

### 3. วิธีใช้งาน GUI Studio (สร้างเมนูเคอร์เซอร์ Java + Form Bedrock)

1. กดปุ่มสลับโหมด **GUI** บนแถบด้านบนของโปรแกรม (หรือเมนู **File → Switch to GUI Studio**)
2. ออกแบบหน้าเมนูด้วย **Image**, **Button**, **Text**, **Shapes (`S`)**, **Icons (`O`)**, **Player Head / 3D Model**, **Motion animation** หรือกด **`M`** เพื่อใช้ **Menu from Template**
3. กด **File → Export (`Ctrl+E`)** แล้วเลือกปลั๊กอิน Resource Pack ฝั่ง Java ที่เซิร์ฟเวอร์ใช้อยู่ (`ItemsAdder`, `Nexo`, `Oraxen`, หรือ zip แยก)
4. ทำตามขั้นตอนในไฟล์ `README_KaizerUI.txt` ที่อยู่ใน zip:
   - ใส่ `KaizerUI-1.0.0.jar` ลงใน `plugins/`
   - นำโฟลเดอร์ `plugins/KaizerUI/` (`menus/*.yml` และ `studio.yml`), ไฟล์ `.mcpack` สำหรับ Geyser, และ Resource Pack ฝั่ง Java ไปวางให้ตรงตำแหน่ง แล้วรีสตาร์ตหรือพิมพ์ `/kui reload`

---

### 4. คู่มือในโปรแกรมและช่องทางช่วยเหลือ

- กด **`F1`** ในโปรแกรมได้ทุกเมื่อเพื่อเปิด **User Guide & Wiki** (รองรับทั้งไทยและอังกฤษ)
- พูดคุย สอบถาม หรือแชร์ผลงาน HUD/GUI ได้ที่ **[GitHub Discussions](https://github.com/tomzangsad/KaizerHUD-Studio/discussions)** หรือ **[Discord](https://discord.gg/rNGH2SpNs5)**
- พบปัญหาหรือบั๊ก แจ้งได้ที่ **[GitHub Issues](https://github.com/tomzangsad/KaizerHUD-Studio/issues/new/choose)**
