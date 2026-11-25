@echo off
rem KaizerHUD Studio - fast test (no release build)
rem  - UI (html/js/css) is read live from the ui folder: edit, then press F5 in the app
rem  - Rust changes: close the app and run this file again (debug build, only changed code recompiles)
rem  - the first run compiles everything once (a few minutes)
rem  - the UI is served by dev_ui_server.ps1 (PowerShell, built into Windows) on http://localhost:8765
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
start "KaizerHUD UI server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev_ui_server.ps1" -Root "%~dp0ui"
cd src-tauri
cargo run --no-default-features
taskkill /fi "WINDOWTITLE eq KaizerHUD UI server*" /t /f >nul 2>nul
