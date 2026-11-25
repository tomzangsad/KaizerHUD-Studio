# Companion Server Plugins (KaizerMultiBar · KaizerMultiBarGeyser · KaizerUI)

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

### KaizerMultiBar 2.1 (Server Plugin)

Streams HUD data (HP / Food / Armor / Oxygen / EXP / PlaceholderAPI text / visibility flags) to Bedrock players via **bossbar** or hidden **title**, read by the `.mcpack` exported from KaizerHUD Studio.

#### Data Channels (`bossbar.channel`)
| `channel` | Transport | Pros | Notes |
|---|---|---|---|
| `bossbar` (default) | Boss bar | Persistent data; never clashes with other plugins' messages | Must stay first among boss bars (use PacketEvents + KaizerMultiBarGeyser) |
| `title` | Hidden title | No custom boss bar needed; other plugins' boss bars render normally; fewest clashes | Any active title from another plugin is cleared when HUD data updates |

- Must match the **Bedrock data channel** selected when exporting from KaizerHUD Studio (`config.yml` in `output.zip` sets this automatically).
- `title` channel sends on change and repeats every `channel-resend-ticks` (default `100` = 5s; `0` = change-only). It does not require PacketEvents or KaizerMultiBarGeyser.
- `actionbar` was removed (Bedrock cannot isolate our data from other plugins' action bars).
- `/kzbos` toggles HUD visibility per player.
- **No license required** — single JAR (`KaizerMultiBar-2.1.0.jar`), supports Paper / Purpur / Folia **1.21.x – 26.x** (built on Java 21).

#### Requirements
- **Required:** Paper / Purpur / Folia 1.21.x–26.x, Geyser (+ Floodgate recommended)
- **Recommended:** PlaceholderAPI, PacketEvents 2.14+, **KaizerMultiBarGeyser** (when using `bossbar` channel)

#### Build (JDK 21 + Maven 3.9+)
```powershell
cd plugins/KaizerMultiBar
mvn -B clean package
```
Output: `plugins/KaizerMultiBar/target/KaizerMultiBar-2.1.0.jar`

### KaizerUI 1.0 (Cursor GUI Menu Plugin)
Renders menus exported from **GUI Studio**: Java players see TextDisplay holograms + cursor; Bedrock players receive Geyser server forms.
- **Build:** `cd plugins/KaizerUI && mvn -B clean package` (or run `build_kaizerui.bat` on Windows). Output: `plugins/KaizerUI/target/KaizerUI-1.0.0.jar`.
- **Source path:** `plugins/KaizerUI/src/kz/kaizerui/` (configured via `sourceDirectory` in `pom.xml`).
- **Required:** Paper / Purpur / Folia 1.21+ (`PacketEvents`, `PlaceholderAPI`, `Geyser + Floodgate` recommended).
- **Commands:** `/kui open <menu> [player]`, `/kui close`, `/kui fov <deg>`, `/kui speed <x>`, `/kui list`, `/kui reload`.

### KaizerMultiBarGeyser (Geyser Extension)
- Place `plugins/KaizerMultiBarGeyser/target/KaizerMultiBarGeyser-1.0.0.jar` into Geyser's `extensions/` folder (`plugins/Geyser-Spigot/extensions/` or proxy `extensions/`).
- Keeps the `@zelisce/custom_bossbars:` boss bar on top for Bedrock clients even when other plugins or proxy plugins send boss bars.
- **Build:** `cd plugins/KaizerMultiBarGeyser && mvn -B clean package` (JDK 21).

---

## ภาษาไทย

# KaizerMultiBar 2.1 (ปลั๊กอินฝั่งเซิร์ฟเวอร์)

ส่งข้อมูล HUD (HP / อาหาร / เกราะ / อากาศ / EXP / ข้อความ PAPI / เงื่อนไข) ให้ผู้เล่น Bedrock ผ่าน bossbar
ที่ HUD pack จาก KaizerHUD Studio อ่าน (2.1: เลือกส่งทาง **title** แทน bossbar ได้)

## 2.1 — ช่องทางส่งข้อมูล (`bossbar.channel`)
| `channel` | ส่งทาง | ข้อดี | ข้อควรรู้ |
|---|---|---|---|
| `bossbar` (ค่าเริ่ม) | bossbar | ข้อมูลอยู่ตลอด ไม่ชนข้อความของปลั๊กอินอื่น | ต้องสู้ลำดับกับ bossbar ปลั๊กอินอื่น (PacketEvents + KaizerMultiBarGeyser) |
| `title` | title (ซ่อนในเกม) | ไม่มี bossbar ของเรา — bossbar ปลั๊กอินอื่นแสดงปกติ, ปลั๊กอินส่วนใหญ่ไม่ค่อยใช้ title → ชนน้อย | title ของปลั๊กอินอื่นที่ขึ้นค้างอยู่จะถูกตัดตอนข้อมูลเราเปลี่ยน |

- ต้อง **ตรงกับ "Data channel" ที่เลือกตอน Export** ใน KaizerHUD Studio (pack อ่านแค่ช่องทางเดียว) — config.yml ที่ export มาใส่ค่าให้แล้ว
- title: ส่งเฉพาะตอนข้อมูลเปลี่ยน + ส่งซ้ำทุก `channel-resend-ticks` (ค่าเริ่ม 100 = 5 วินาที, 0 = เฉพาะตอนเปลี่ยน) เพราะ pack จำค่าล่าสุดไว้เอง
- title ไม่ใช้ PacketEvents / KaizerMultiBarGeyser (ไม่มี bossbar ให้จัดลำดับ)
- `actionbar` ถูกเอาออกแล้ว (2026-11-24): pack ของ Bedrock เก็บข้อมูล action bar แยกจากของปลั๊กอินอื่นไม่ได้ — ใส่ค่า `actionbar` จะใช้ bossbar แทน
- `/kzbos` ยังซ่อน/แสดง HUD ได้เหมือนเดิม

## เปลี่ยนจาก 1.x
- **ไม่มี license และไม่มี Loader แล้ว** — ใช้ `KaizerMultiBar-2.0.0.jar` ไฟล์เดียว (โฟลเดอร์ `KaizerMultiBarLoader/` ไม่ใช้แล้ว)
- **รองรับ 1.21.x ถึง 26.x** ด้วย jar เดียว (build ด้วย Java 21 + Paper API 1.21; เซิร์ฟ 26.x ใช้ Java 25 ซึ่งรันได้)
- **ProtocolLib → PacketEvents** (ProtocolLib ยังไม่มี release ที่รองรับ 26.x) — เป็น *ตัวเลือก*: ไม่ลงก็ทำงานได้ แค่ไม่ดัน bossbar ของเราขึ้นแถวบน
- ตรวจผู้เล่น Bedrock ได้ทั้งผ่าน Floodgate และ Geyser (เซิร์ฟที่มี Geyser แต่ไม่มี Floodgate)
- แก้บั๊ก: ตอนจัดลำดับเคยลบ bossbar ของปลั๊กอินอื่นทิ้ง (ถ้าไม่มีข้อมูลสำรอง) และส่งข้อมูลเก่ากลับไป
- `config.yml` ไม่มีส่วน `license:` แล้ว (KaizerHUD Studio ไม่ใส่ให้แล้วเช่นกัน)

## สิ่งที่เซิร์ฟเวอร์ต้องมี
| ปลั๊กอิน | จำเป็น? |
|---|---|
| Paper / Purpur / Folia 1.21.x – 26.x | ✓ |
| Geyser (+ Floodgate แนะนำ) | ✓ (ไม่งั้นไม่มีผู้เล่น Bedrock) |
| PlaceholderAPI | แนะนำ (ใช้ PAPI ในข้อความ / bar) |
| PacketEvents 2.14+ | แนะนำ (ดัน bossbar ของเราไว้บนสุดฝั่ง Java) |
| **KaizerMultiBarGeyser** (extension ของ Geyser) | แนะนำ (ดัน bossbar ของเราไว้บนสุดฝั่ง Bedrock) |

> HUD pack ที่ export จาก KaizerHUD Studio **เวอร์ชันใหม่** อ่าน bossbar ของเราได้ไม่ว่าจะอยู่แถวไหน
> (pack เก่าอ่านแค่ bossbar แถวแรก) — ควร export pack ใหม่ให้ลูกค้า

## Build
ต้องมี JDK 21 + Maven 3.9
```powershell
cd plugins\KaizerMultiBar
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
mvn clean package
```
ผลลัพธ์: `KaizerMultiBar\target\KaizerMultiBar-2.1.0.jar`

## KaizerUI 1.0 (ปลั๊กอินเมนู cursor — แยกจาก KaizerMultiBar)
เมนูจาก **GUI Studio** (ปุ่ม GUI บน title bar ของโปรแกรม) → Java เห็นเป็น hologram + เคอร์เซอร์, Bedrock ได้เป็น server form
- **Build:**
  - ดับเบิลคลิก `build_kaizerui.bat` (ไม่ต้องลง Maven เอง)
    - หา JDK 21+ เอง (JAVA_HOME / `C:\Program Files\Java\jdk-2x` / Adoptium / Microsoft) — JDK 25 ใช้ได้
    - ถ้าไม่มี Maven ใน PATH จะดาวน์โหลด Maven 3.9.9 แบบพกพา (~9 MB) ครั้งแรกครั้งเดียว ไว้ที่ `plugins\.tools\`
    - ครั้งแรกโหลด API ของ Paper / PacketEvents / Geyser ลง `%USERPROFILE%\.m2` ใช้เวลาสักพัก
    - log อยู่ที่ `build_kaizerui_log.txt`
  - ผลลัพธ์อยู่ที่ `target\KaizerUI-1.0.0.jar`
- **source:** อยู่ที่ `KaizerUI/src/kz/kaizerui/` (ไม่ใช่ `src/main/java`) — pom ตั้ง `sourceDirectory` ไว้แล้ว
- **ต้องมี:** Paper / Purpur / Folia 1.21+
- **แนะนำ:**
  - PacketEvents (ล็อคกล้อง → เมาส์ขยับเคอร์เซอร์)
  - PlaceholderAPI
  - Geyser + Floodgate (Bedrock)
- **คำสั่ง:** `/kui open <menu> [player]`, `/kui close`, `/kui fov <องศา>`, `/kui speed <x>`, `/kui list`, `/kui reload`
- **ถ้า Maven หา Floodgate API ไม่เจอ:** เปลี่ยน `<version>` ของ `org.geysermc.floodgate:api` ใน pom เป็น `2.2.4-SNAPSHOT`
- **รายละเอียด:** `docs/GUI_STUDIO.md`

## KaizerMultiBarGeyser (Geyser extension)
📦 `KaizerMultiBarGeyser\target\KaizerMultiBarGeyser-1.0.0.jar` → ใส่ในโฟลเดอร์ `extensions/` ของ Geyser
(Geyser-Spigot: `plugins/Geyser-Spigot/extensions/`, Geyser บน Velocity/Bungee/Standalone: `extensions/` ของ Geyser ตัวนั้น)

- ครอบ translator bossbar ของ Geyser: เมื่อ bossbar ของเรา (ชื่อขึ้นต้น `@zelisce/custom_bossbars:`) ปรากฏ
  จะสร้าง bar อื่นที่อยู่ข้างบนใหม่ให้ลงไปอยู่ใต้ของเรา **บนเครื่อง Bedrock** (Geyser เก็บ bar แบบไม่มีลำดับ)
- ทำงานที่ชั้น Geyser จึงครอบคลุม bar จากปลั๊กอินบน proxy ด้วย และมีผลกับผู้เล่น Bedrock เท่านั้น
- ใช้คลาสภายในของ Geyser (ไม่มี API ทางการ) — build กับ Geyser 2.12.1 (รองรับ 26.3)
  ถ้า Geyser เวอร์ชันอื่นเปลี่ยนคลาส extension จะปิดตัวเองและเขียนเตือนใน log โดย Geyser ทำงานต่อปกติ
- Build: `cd plugins\KaizerMultiBarGeyser` แล้ว `mvn clean package` (JDK 21)
