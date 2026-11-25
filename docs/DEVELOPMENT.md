# Developer & Build Guide / คู่มือนักพัฒนา (Fork, Clone & Build)

[English](#english) · [ภาษาไทย](#ภาษาไทย)

---

## English

This guide is for **developers and contributors** who want to fork/clone the repository, run the editor in dev mode, run tests, or build the desktop app and plugins from source.

> Looking to **just use** the app and plugins? Go to **[USER_GUIDE.md](USER_GUIDE.md)** and download prebuilt binaries from **[Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**.

### 1. Fork & Clone

1. Click **Fork** on [tomzangsad/KaizerHUD-Studio](https://github.com/tomzangsad/KaizerHUD-Studio).
2. Clone your fork locally:
   ```powershell
   git clone https://github.com/<your-username>/KaizerHUD-Studio.git
   cd KaizerHUD-Studio
   ```

### 2. Repository Layout

| Path | Description |
|---|---|
| `src-tauri/` | Rust / Tauri desktop backend (JSON UI codegen, `.mcpack` export, GUI Studio, Java HUD import/export, local storage) |
| `ui/` | Desktop editor frontend (vanilla HTML, CSS, JavaScript) |
| `plugins/KaizerMultiBar/` | Paper/Purpur/Folia 1.21.x–26.x plugin that streams HUD stats & PAPI data to Bedrock players |
| `plugins/KaizerUI/` | Companion plugin for GUI Studio cursor menus (Java holograms + Bedrock forms) |
| `docs/` | Technical specs and contributor notes ([docs/README.md](README.md)) |

### 3. Desktop App (Rust / Tauri)

**Prerequisites:**
- [Rust toolchain](https://rustup.rs/) (`stable`)
- Windows: Visual Studio C++ Build Tools (WebView2 is included in Windows 10/11)

**Run unit tests & check:**
```powershell
cd src-tauri
cargo test --lib
cargo check
```

**Run in dev mode** (loads `ui/` from a local dev server for fast frontend edits):
```powershell
.\dev_kaizerhud.bat
```

**Build release executable (`src-tauri/target/release/kaizerhud.exe`) and Windows NSIS installer (`src-tauri/target/release/bundle/nsis/*-setup.exe`):**
```powershell
cd src-tauri
cargo build --release   # standalone .exe only
cargo tauri build       # builds both standalone .exe and NSIS installer (requires tauri-cli)
```
*(Or double-click `build_kaizerhud.bat`. On low-RAM machines, add `-j 1` or set `$env:CARGO_PROFILE_RELEASE_LTO = "false"` temporarily.)*

### 4. Server Plugins (Java 21 + Maven)

**Prerequisites:** JDK 21+ and Maven 3.9+ (Windows helpers `build_kaizermultibar.bat` and `build_kaizerui.bat` locate JDK 21+ and download portable Maven automatically if needed).

```powershell
# KaizerMultiBar -> plugins/KaizerMultiBar/target/KaizerMultiBar-2.1.0.jar
cd plugins/KaizerMultiBar
mvn -B clean package

# KaizerUI -> plugins/KaizerUI/target/KaizerUI-1.0.0.jar
cd ../KaizerUI
mvn -B clean package
```

### 5. Next Steps for Contributors

- Architecture & data flow: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Technical specs: [docs/README.md](README.md)
- Contribution workflow & rules: [CONTRIBUTING.md](../CONTRIBUTING.md)

---

## ภาษาไทย

คู่มือนี้สำหรับ **นักพัฒนาและผู้ที่ต้องการร่วมแก้ไขโค้ด** (Fork, Clone, รัน Dev Mode, รัน Test และ Build `.exe` / `.jar` เองจากซอร์สโค้ด)

> ถ้าต้องการ **ดาวน์โหลดไปใช้งานอย่างเดียว** ไม่ต้องทำตามหน้านี้ครับ ดูคู่มือผู้ใช้ได้ที่ **[USER_GUIDE.md](USER_GUIDE.md)** และโหลดไฟล์สำเร็จรูปจาก **[Releases](https://github.com/tomzangsad/KaizerHUD-Studio/releases/latest)**

### 1. Fork และ Clone โปรเจกต์

1. กดปุ่ม **Fork** ที่หน้า [tomzangsad/KaizerHUD-Studio](https://github.com/tomzangsad/KaizerHUD-Studio)
2. Clone ลงเครื่อง:
   ```powershell
   git clone https://github.com/<your-username>/KaizerHUD-Studio.git
   cd KaizerHUD-Studio
   ```

### 2. โครงสร้างโฟลเดอร์หลัก

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `src-tauri/` | หลังบ้านฝั่ง Desktop (Rust / Tauri — Gen JSON UI, Export `.mcpack`, GUI Studio, Java HUD Import/Export) |
| `ui/` | หน้าจอ Editor ทั้งหมด (HTML / CSS / Vanilla JS) |
| `plugins/KaizerMultiBar/` | ปลั๊กอินส่งข้อมูล HUD (Paper / Purpur / Folia 1.21.x–26.x) |
| `plugins/KaizerUI/` | ปลั๊กอินเมนูเคอร์เซอร์สำหรับ GUI Studio |
| `docs/` | เอกสารสเปกเทคนิคทั้งหมด ([docs/README.md](README.md)) |

### 3. ฝั่ง Desktop App (Rust / Tauri)

**เครื่องมือที่ต้องมี:**
- [Rust](https://rustup.rs/) (`stable`)
- บน Windows: Visual Studio C++ Build Tools (Windows 10/11 มี WebView2 มาให้อยู่แล้ว)

**รัน Unit Tests และตรวจคอมไพล์:**
```powershell
cd src-tauri
cargo test --lib
cargo check
```

**รันโหมดพัฒนา (Dev Mode — แก้ไฟล์ใน `ui/` แล้วรีเฟรชดูผลได้ทันที):**
```powershell
.\dev_kaizerhud.bat
```

**Build ไฟล์ `.exe` ตัวจริง (`src-tauri/target/release/kaizerhud.exe`) และตัวติดตั้ง Windows NSIS Installer (`target/release/bundle/nsis/*-setup.exe`):**
```powershell
cd src-tauri
cargo build --release   # สร้างเฉพาะ .exe แบบพกพา
cargo tauri build       # สร้างทั้ง .exe และตัวติดตั้ง *-setup.exe (ต้องมี tauri-cli)
```
*(หรือดับเบิลคลิก `build_kaizerhud.bat` — หากเครื่อง RAM น้อยให้ใส่ `-j 1` หรือตั้ง `$env:CARGO_PROFILE_RELEASE_LTO = "false"` ชั่วคราว)*

### 4. ฝั่ง Server Plugins (Java 21 + Maven)

**เครื่องมือที่ต้องมี:** JDK 21+ และ Maven 3.9+ (หรือดับเบิลคลิก `build_kaizermultibar.bat` / `build_kaizerui.bat` บน Windows ซึ่งจะหา JDK และโหลด Maven พกพาให้เอง)

```powershell
cd plugins/KaizerMultiBar
mvn -B clean package

cd ../KaizerUI
mvn -B clean package
```

### 5. อ่านต่อสำหรับผู้ร่วมพัฒนา

- ผังการทำงานและจุดเริ่มแก้โค้ด: [ARCHITECTURE.md](../ARCHITECTURE.md)
- สารบัญสเปกเทคนิค: [docs/README.md](README.md)
- กติกาการส่ง Pull Request: [CONTRIBUTING.md](../CONTRIBUTING.md)
