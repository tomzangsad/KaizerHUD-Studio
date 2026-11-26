@echo off
setlocal EnableExtensions
rem -------------------------------------------------------------
rem  Build the KaizerUI plugin (plugins\KaizerUI\target\KaizerUI-1.1.0.jar)
rem  - finds a JDK 21+ by itself (JAVA_HOME, C:\Program Files\Java\jdk-2x, Adoptium, Microsoft)
rem  - uses Maven from PATH / MAVEN_HOME, otherwise downloads a portable Maven once
rem    into plugins\.tools (no install, nothing changed outside this folder)
rem  Log: build_kaizerui_log.txt
rem -------------------------------------------------------------
set "ROOT=%~dp0"
set "PROJ=%ROOT%plugins\KaizerUI"
set "TOOLS=%ROOT%plugins\.tools"
set "LOG=%ROOT%build_kaizerui_log.txt"
set "MVN_VER=3.9.9"
set "MVN_URL=https://archive.apache.org/dist/maven/maven-3/%MVN_VER%/binaries/apache-maven-%MVN_VER%-bin.zip"

echo START %DATE% %TIME% > "%LOG%"

rem -- JDK --
set "JDK="
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\javac.exe" set "JDK=%JAVA_HOME%"
if not defined JDK for /d %%D in ("C:\Program Files\Java\jdk-2*") do if exist "%%~D\bin\javac.exe" set "JDK=%%~D"
if not defined JDK for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-2*") do if exist "%%~D\bin\javac.exe" set "JDK=%%~D"
if not defined JDK for /d %%D in ("C:\Program Files\Microsoft\jdk-2*") do if exist "%%~D\bin\javac.exe" set "JDK=%%~D"
if not defined JDK if exist "C:\Program Files\Java\latest\bin\javac.exe" set "JDK=C:\Program Files\Java\latest"
if not defined JDK (
  echo [X] No JDK 21 or newer found. Install one from https://adoptium.net and run this again.
  echo NO JDK >> "%LOG%"
  goto :end
)
set "JAVA_HOME=%JDK%"
set "PATH=%JDK%\bin;%PATH%"
echo JDK: %JDK%
echo JDK: %JDK% >> "%LOG%"

rem -- Maven --
set "MVN="
for /f "delims=" %%M in ('where mvn.cmd 2^>nul') do if not defined MVN set "MVN=%%M"
if not defined MVN if defined MAVEN_HOME if exist "%MAVEN_HOME%\bin\mvn.cmd" set "MVN=%MAVEN_HOME%\bin\mvn.cmd"
if not defined MVN if exist "%TOOLS%\apache-maven-%MVN_VER%\bin\mvn.cmd" set "MVN=%TOOLS%\apache-maven-%MVN_VER%\bin\mvn.cmd"
if not defined MVN (
  echo Maven not found - downloading portable Maven %MVN_VER% ^(about 9 MB, only the first time^)...
  echo DOWNLOAD %MVN_URL% >> "%LOG%"
  if not exist "%TOOLS%" mkdir "%TOOLS%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%MVN_URL%' -OutFile '%TOOLS%\maven.zip'; Expand-Archive -Force -Path '%TOOLS%\maven.zip' -DestinationPath '%TOOLS%'; Remove-Item '%TOOLS%\maven.zip'" >> "%LOG%" 2>&1
  if exist "%TOOLS%\apache-maven-%MVN_VER%\bin\mvn.cmd" set "MVN=%TOOLS%\apache-maven-%MVN_VER%\bin\mvn.cmd"
)
if not defined MVN (
  echo [X] Could not get Maven. Check the internet connection, or install Maven and add it to PATH.
  goto :end
)
echo Maven: %MVN%
echo Maven: %MVN% >> "%LOG%"

rem -- build --
echo Building KaizerUI... ^(first build downloads the Paper / PacketEvents / Geyser APIs, takes a minute^)
cd /d "%PROJ%"
call "%MVN%" -B clean package >> "%LOG%" 2>&1
echo EXIT %ERRORLEVEL% %DATE% %TIME% >> "%LOG%"

:end
if exist "%PROJ%\target\KaizerUI-1.1.0.jar" (
  echo.
  echo [OK] plugins\KaizerUI\target\KaizerUI-1.1.0.jar
) else (
  echo.
  echo [X] Build failed - send build_kaizerui_log.txt
)
echo.
pause
