# Companion Server Plugins (`KaizerMultiBar` · `KaizerUI`)

[English](#english) · [ภาษาไทย](#ภาษาไทย)

> **Looking to just install the plugins?** Start with **Part 1 (For Server Owners)** and download prebuilt `.jar` files from **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**.
> **ต้องการโหลดไปลงเซิร์ฟเวอร์อย่างเดียว?** ดู **ส่วนที่ 1 (สำหรับเจ้าของเซิร์ฟเวอร์)** และดาวน์โหลดไฟล์ `.jar` สำเร็จรูปจาก **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**

---

## English

### Part 1: For Server Owners (Download, Install & Configure)

#### Overview — Which Plugin Do You Need?

| Plugin | Version | Used with | Put in |
|---|---|---|---|
| `KaizerMultiBar-2.2.0.jar` | `2.2.0` | **HUD Studio** *(Bedrock HUDs)* | `plugins/` on Paper / Purpur / Folia `1.21.x–26.x` |
| `KaizerUI-1.1.0.jar` | `1.1.0` | **GUI Studio** *(Interactive menus)* | `plugins/` on Paper / Purpur / Folia `1.21.x–26.x` |

---

#### 1. `KaizerMultiBar` 2.2 (HUD Data Streamer)

Streams HUD data (HP / Food / Armor / Oxygen / EXP / PlaceholderAPI text / visibility flags, including Multi-Bank overflow up to 8 banks / ~2,000 bytes) to Bedrock players via hidden **title**, read by the `.mcpack` exported from KaizerHUD Studio. No license or loader plugin is required.

**Server Requirements:**
- **Required:** Paper / Purpur / Folia `1.21.x–26.x` (Java 21+), [GeyserMC](https://geysermc.org/) (+ Floodgate recommended)
- **Recommended:** [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) (for PAPI placeholders & custom bars)

**Installation:**
1. Download `KaizerMultiBar-2.2.0.jar` from **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)** and place it into your server's `plugins/` folder (remove any older `KaizerMultiBar-*.jar`).
2. Export your HUD from **KaizerHUD Studio** (`Ctrl+E` → `output.zip`):
   - Copy `GeyserMC/packs/<namespace>.mcpack` into your Geyser `packs/` folder.
   - Copy `plugins/KaizerMultiBar/config.yml` into your server's `plugins/KaizerMultiBar/` folder.
3. Restart the server (or run `/kzbos reload` and reload Geyser).

**Data Channel (`bossbar.channel` in `config.yml`):**

- `title` *(default & recommended)*: Uses a hidden title (`channel: title`) with automatic Multi-Bank overflow (up to 8 banks / ~2,000 bytes), avoids conflicts with other plugins' boss bars, and does not require PacketEvents. `config.yml` exported from KaizerHUD Studio configures this automatically.
- Repeats every `channel-resend-ticks` (default `100` = 5s; `0` = change-only).
- **Commands:** `/kzbos` (toggle HUD visibility per player), `/kzbos reload` (reload `config.yml`).

---

#### 2. `KaizerUI` 1.1 (GUI Studio Menu Plugin)

Renders menus exported from **GUI Studio**: Java players see TextDisplay holograms + mouse cursor; Bedrock players receive Geyser server forms.

**Server Requirements:**
- **Required:** Paper / Purpur / Folia `1.21+`
- **Recommended:** [PacketEvents](https://modrinth.com/plugin/packetevents) (locks camera so mouse moves cursor), [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/), [Geyser + Floodgate](https://geysermc.org/) (Bedrock server forms)

**Installation:**
1. Download `KaizerUI-1.1.0.jar` from **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)** into `plugins/`.
2. Export your menu from **GUI Studio** (`Ctrl+E`) and follow `README_KaizerUI.txt` inside the exported zip to copy `plugins/KaizerUI/` (`menus/*.yml`, `studio.yml`), Geyser `.mcpack`, and Java resource pack.
3. Restart the server or run `/kui reload`.

**Commands:** `/kui open <menu> [player]`, `/kui close`, `/kui fov <deg>`, `/kui speed <x>`, `/kui list`, `/kui reload`.  
**Technical spec:** [docs/GUI_STUDIO.md](../docs/GUI_STUDIO.md)

---

### Part 2: For Developers (Build Plugins from Source)

> Full fork, clone, Rust desktop app, and Java plugin build instructions live in **[docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**.

- **Prerequisites:** JDK 21+ and Maven 3.9+ (Windows helpers `build_kaizermultibar.bat` and `build_kaizerui.bat` detect JDK 21+ and download portable Maven into `plugins/.tools/` automatically).
- **Commands:**
  ```powershell
  # KaizerMultiBar -> plugins/KaizerMultiBar/target/KaizerMultiBar-2.2.0.jar
  cd plugins/KaizerMultiBar
  mvn -B clean package

  # KaizerUI -> plugins/KaizerUI/target/KaizerUI-1.1.0.jar
  cd ../KaizerUI
  mvn -B clean package
  ```
- **Note on `KaizerUI` source layout:** Java sources live under `plugins/KaizerUI/src/kz/kaizerui/` (configured via `sourceDirectory` in `pom.xml`, not `src/main/java`). If Maven fails resolving Floodgate API, update `org.geysermc.floodgate:api` in `plugins/KaizerUI/pom.xml` to `2.2.4-SNAPSHOT`.

---

## ภาษาไทย

### ส่วนที่ 1: สำหรับเจ้าของเซิร์ฟเวอร์ (ดาวน์โหลด ติดตั้ง และตั้งค่า)

#### ภาพรวม — ต้องใช้ปลั๊กอินไหนบ้าง?

| ปลั๊กอิน | เวอร์ชัน | ใช้คู่กับ | นำไปวางที่ |
|---|---|---|---|
| `KaizerMultiBar-2.2.0.jar` | `2.2.0` | **HUD Studio** *(HUD ฝั่ง Bedrock)* | โฟลเดอร์ `plugins/` บน Paper / Purpur / Folia `1.21.x–26.x` |
| `KaizerUI-1.1.0.jar` | `1.1.0` | **GUI Studio** *(เมนูเคอร์เซอร์)* | โฟลเดอร์ `plugins/` บน Paper / Purpur / Folia `1.21.x–26.x` |

---

#### 1. `KaizerMultiBar` 2.2 (ปลั๊กอินส่งข้อมูล HUD)

ส่งข้อมูล HUD (HP / อาหาร / เกราะ / อากาศ / EXP / ข้อความ PAPI / เงื่อนไขแสดงผล รวมถึง Multi-Bank สูงสุด 8 Banks / ~2,000 ไบต์) ให้ผู้เล่น Bedrock ผ่าน hidden **title** เพื่อให้ HUD pack จาก KaizerHUD Studio อ่านไปแสดงผล — ไม่ต้องใช้คีย์/ไลเซนส์ และใช้ `.jar` เดียวจบ (ไม่มี Loader แยกแล้ว)

**ปลั๊กอินที่เซิร์ฟเวอร์ต้องมี:**
- **จำเป็น:** Paper / Purpur / Folia `1.21.x–26.x` (Java 21+), [GeyserMC](https://geysermc.org/) (+ Floodgate แนะนำ)
- **แนะนำ:** [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/) (สำหรับแสดงค่า PAPI / Custom bar)

**วิธีติดตั้ง:**
1. ดาวน์โหลด `KaizerMultiBar-2.2.0.jar` จากหน้า **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)** ไปใส่ในโฟลเดอร์ `plugins/` ของเซิร์ฟเวอร์ (ลบ `.jar` เวอร์ชันเก่าออก)
2. กด Export จาก **KaizerHUD Studio** (`Ctrl+E` → `output.zip`):
   - นำ `GeyserMC/packs/<namespace>.mcpack` ไปใส่ในโฟลเดอร์ `packs/` ของ Geyser
   - นำ `plugins/KaizerMultiBar/config.yml` ไปใส่ในโฟลเดอร์ `plugins/KaizerMultiBar/` ของเซิร์ฟเวอร์
3. รีสตาร์ตเซิร์ฟเวอร์ (หรือรัน `/kzbos reload`)

**ช่องทางส่งข้อมูล (`bossbar.channel` ใน `config.yml`):**

- `title` *(ค่าเริ่มและแนะนำ)*: ส่งผ่าน hidden title พร้อมรองรับ Multi-Bank อัตโนมัติสูงสุด 8 Banks (~2,000 ไบต์) ไม่มีปัญหาชน bossbar ของปลั๊กอินอื่น และไม่ต้องใช้ `PacketEvents` (`config.yml` ที่ export ออกมาจาก KaizerHUD Studio ตั้งค่านี้ให้แล้วอัตโนมัติ)
- ส่งซ้ำทุก `channel-resend-ticks` (ค่าเริ่ม `100` = 5 วินาที, `0` = ส่งเฉพาะตอนเปลี่ยน)
- **คำสั่ง:** `/kzbos` (เปิด/ปิด HUD รายบุคคล), `/kzbos reload` (โหลด `config.yml` ใหม่)

---

#### 2. `KaizerUI` 1.1 (ปลั๊กอินเมนูจาก GUI Studio)

แสดงเมนูที่ออกแบบจาก **GUI Studio** (สลับด้วยปุ่ม **GUI** บนแถบด้านบนของโปรแกรม): ผู้เล่น Java เห็นเป็น TextDisplay hologram + เคอร์เซอร์เมาส์, ผู้เล่น Bedrock ได้รับเป็น Geyser server form

**ปลั๊กอินที่เซิร์ฟเวอร์ต้องมี:**
- **จำเป็น:** Paper / Purpur / Folia `1.21+`
- **แนะนำ:** [PacketEvents](https://modrinth.com/plugin/packetevents) (ล็อคกล้องให้ขยับเมาส์เป็นเคอร์เซอร์), [PlaceholderAPI](https://www.spigotmc.org/resources/placeholderapi.6245/), [Geyser + Floodgate](https://geysermc.org/) (สำหรับ Bedrock)

**วิธีติดตั้ง:**
1. ดาวน์โหลด `KaizerUI-1.1.0.jar` จาก **[GitHub Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)** ไปวางใน `plugins/`
2. Export จาก **GUI Studio** (`Ctrl+E`) แล้วทำตามไฟล์ `README_KaizerUI.txt` ด้านใน zip เพื่อคัดลอก `plugins/KaizerUI/` (`menus/*.yml` และ `studio.yml`), ไฟล์ `.mcpack` ของ Geyser, และ Resource Pack ฝั่ง Java
3. รีสตาร์ตเซิร์ฟเวอร์ หรือพิมพ์ `/kui reload`

**คำสั่ง:** `/kui open <menu> [player]`, `/kui close`, `/kui fov <องศา>`, `/kui speed <x>`, `/kui list`, `/kui reload`  
**รายละเอียดสเปก:** [docs/GUI_STUDIO.md](../docs/GUI_STUDIO.md)

---

### ส่วนที่ 2: สำหรับนักพัฒนา (Build ปลั๊กอินเองจากซอร์สโค้ด)

> ดูคู่มือนักพัฒนาฉบับเต็ม (Fork, Clone, Desktop App และ Plugins) ได้ที่ **[docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)**

- **เครื่องมือที่ต้องมี:** JDK 21+ และ Maven 3.9+ (บน Windows สามารถดับเบิลคลิก `build_kaizermultibar.bat` หรือ `build_kaizerui.bat` ได้เลย สคริปต์จะหา JDK 21+ และโหลด Maven พกพาไว้ใน `plugins/.tools/` ให้อัตโนมัติ)
- **คำสั่ง Build:**
  ```powershell
  # KaizerMultiBar -> plugins/KaizerMultiBar/target/KaizerMultiBar-2.2.0.jar
  cd plugins/KaizerMultiBar
  mvn -B clean package

  # KaizerUI -> plugins/KaizerUI/target/KaizerUI-1.1.0.jar
  cd ../KaizerUI
  mvn -B clean package
  ```
- **หมายเหตุโครงสร้าง `KaizerUI`:** ซอร์สโค้ด Java อยู่ที่ `plugins/KaizerUI/src/kz/kaizerui/` (กำหนดผ่าน `sourceDirectory` ใน `pom.xml` ไม่ใช่ `src/main/java`) และหาก Maven หา Floodgate API ไม่เจอ ให้ปรับ `<version>` ของ `org.geysermc.floodgate:api` ใน `pom.xml` เป็น `2.2.4-SNAPSHOT`
