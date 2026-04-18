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

rem Integrated from D:\Dev\nodejs\nodevars.bat and D:\Dev\Rust\rust_env.ps1.
rem Keep these changes inside this script; do not override CARGO_HOME/RUSTUP_HOME.
set "PATH=%PROJECT_DIR%node_modules\.bin;%APPDATA%\npm;%NODE_ROOT%;%NODE_ROOT%\npm_global;%CARGO_BIN_DIR%;%PATH%"
set "RUST_BACKTRACE=1"

echo [1/3] Environment
echo       Node:  %NODE_ROOT%
echo       Rust:  %RUST_ROOT%
echo       Cargo PATH entry: %CARGO_BIN_DIR%

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
  echo [2/3] Installing npm dependencies ^(forced^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\.bin\vite.cmd" (
  echo [2/3] Installing npm dependencies ^(missing Windows vite.cmd^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else if not exist "%PROJECT_DIR%node_modules\.bin\tauri.cmd" (
  echo [2/3] Installing npm dependencies ^(missing Windows tauri.cmd^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
) else (
  echo [2/3] npm dependencies already installed, skipping initialization.
)

if not exist "%PROJECT_DIR%node_modules\.bin\vite.cmd" (
  echo [ERROR] vite.cmd is still missing after npm install:
  echo         %PROJECT_DIR%node_modules\.bin\vite.cmd
  echo         Run: debug_win11.bat --force-init
  exit /b 1
)

if not exist "%PROJECT_DIR%node_modules\.bin\tauri.cmd" (
  echo [ERROR] tauri.cmd is still missing after npm install:
  echo         %PROJECT_DIR%node_modules\.bin\tauri.cmd
  echo         Run: debug_win11.bat --force-init
  exit /b 1
)

echo [3/3] Starting Tauri dev mode...
echo       Vue changes reload through Vite HMR. Press Ctrl+C to stop.
call npm run tauri:dev
if errorlevel 1 (
  echo [ERROR] Tauri dev failed.
  exit /b 1
)

endlocal
exit /b 0
