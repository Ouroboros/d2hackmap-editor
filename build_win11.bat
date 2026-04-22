@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "NODE_ROOT=D:\Dev\nodejs"
set "RUST_ROOT=D:\Dev\Rust"
set "CARGO_BIN_DIR=%RUST_ROOT%\cargo\bin"
set "FORCE_INIT=0"

if /I "%~1"=="--init" set "FORCE_INIT=1"
if /I "%~1"=="/init" set "FORCE_INIT=1"
if /I "%~1"=="--force-init" set "FORCE_INIT=1"

cd /d "%PROJECT_DIR%" || exit /b 1

if not exist "%NODE_ROOT%\node.exe" (
  echo [ERROR] node.exe not found:
  echo         %NODE_ROOT%\node.exe
  exit /b 1
)

if not exist "%NODE_ROOT%\npm.cmd" (
  echo [ERROR] npm.cmd not found:
  echo         %NODE_ROOT%\npm.cmd
  exit /b 1
)

if not exist "%CARGO_BIN_DIR%\cargo.exe" (
  echo [ERROR] cargo.exe not found:
  echo         %CARGO_BIN_DIR%\cargo.exe
  exit /b 1
)

if not exist "%CARGO_BIN_DIR%\rustc.exe" (
  echo [ERROR] rustc.exe not found:
  echo         %CARGO_BIN_DIR%\rustc.exe
  exit /b 1
)

rem Integrated from D:\Dev\nodejs\nodevars.bat:
rem   set "PATH=%APPDATA%\npm;%~dp0;%~dp0npm_global;%PATH%"
rem Integrated from D:\Dev\Rust\rust_env.ps1:
rem   $CargoHome = join-path $RustRoot cargo
rem   $RustUpHome = join-path $RustRoot rustup
rem   $env:path += ';' + (join-path $CargoHome bin)
rem   $env:RUST_BACKTRACE = 1
rem Do not set CARGO_HOME or RUSTUP_HOME here. rustup show reports the active
rem toolchain under the user's default rustup home, so overriding it would make
rem cargo look in the wrong place.
rem setlocal keeps this PATH change inside this build script, so repeated runs
rem do not pollute the parent command prompt.
set "PATH=%PROJECT_DIR%node_modules\.bin;%APPDATA%\npm;%NODE_ROOT%;%NODE_ROOT%\npm_global;%CARGO_BIN_DIR%;%PATH%"
set "RUST_BACKTRACE=1"

echo [1/4] Environment
echo       Node:  %NODE_ROOT%
echo       Rust:  %RUST_ROOT%
echo       Cargo PATH entry: %CARGO_BIN_DIR%
echo       Rustup home is not overridden by this script.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node was not found after configuring PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found after configuring PATH.
  exit /b 1
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cargo was not found after configuring PATH.
  exit /b 1
)

where rustc >nul 2>nul
if errorlevel 1 (
  echo [ERROR] rustc was not found after configuring PATH.
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do echo       node %%v
for /f "delims=" %%v in ('npm --version') do echo       npm  %%v
for /f "delims=" %%p in ('where cargo') do echo       cargo %%p
for /f "delims=" %%p in ('where rustc') do echo       rustc %%p

if "%FORCE_INIT%"=="1" (
  echo [2/4] Installing npm dependencies ^(forced^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\.bin\vite.cmd" (
  echo [2/4] Installing npm dependencies ^(missing Windows vite.cmd^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\.bin\tauri.cmd" (
  echo [2/4] Installing npm dependencies ^(missing Windows tauri.cmd^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\@tauri-apps\api\package.json" (
  echo [2/4] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\@tauri-apps\cli\package.json" (
  echo [2/4] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else (
  echo [2/4] npm dependencies already installed, skipping initialization.
)

if not exist "%PROJECT_DIR%node_modules\.bin\vite.cmd" (
  echo [ERROR] vite.cmd is still missing after npm install:
  echo         %PROJECT_DIR%node_modules\.bin\vite.cmd
  echo         Run: build_win11.bat --force-init
  exit /b 1
)

if not exist "%PROJECT_DIR%node_modules\.bin\tauri.cmd" (
  echo [ERROR] tauri.cmd is still missing after npm install:
  echo         %PROJECT_DIR%node_modules\.bin\tauri.cmd
  echo         Run: build_win11.bat --force-init
  exit /b 1
)

echo [3/4] Building frontend...
call npm run build
if errorlevel 1 (
  echo [ERROR] frontend build failed.
  exit /b 1
)

echo [4/4] Building Tauri app for Windows...
call npm run tauri:build
if errorlevel 1 (
  echo [ERROR] Tauri build failed.
  exit /b 1
)

set "RELEASE_EXE=%PROJECT_DIR%src-tauri\target\release\d2hackmap-cfg-editor.exe"
set "ROOT_EXE=%PROJECT_DIR%d2hackmap-cfg-editor.exe"

if not exist "%RELEASE_EXE%" (
  echo [ERROR] Built EXE not found:
  echo         %RELEASE_EXE%
  exit /b 1
)

copy /y "%RELEASE_EXE%" "%ROOT_EXE%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to copy EXE to project root.
  echo         From: %RELEASE_EXE%
  echo         To:   %ROOT_EXE%
  exit /b 1
)

echo.
echo [OK] Build complete.
echo      Release EXE: %RELEASE_EXE%
echo      Root EXE:    %ROOT_EXE%

endlocal
exit /b 0
