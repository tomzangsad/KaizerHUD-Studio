@echo off
rem KaizerHUD Studio: release build, log in build_log.txt
cd /d "%~dp0src-tauri"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
echo Building KaizerHUD Studio... (log: %~dp0build_log.txt)
echo START %DATE% %TIME% > "%~dp0build_log.txt"
cargo build --release >> "%~dp0build_log.txt" 2>&1
echo EXIT %ERRORLEVEL% %DATE% %TIME% >> "%~dp0build_log.txt"
echo Done. See build_log.txt
timeout /t 5 > nul
