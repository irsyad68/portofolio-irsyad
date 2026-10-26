@echo off
rem ============================================================
rem  Menjalankan WEBSITE ASTRO (versi final) di komputer ini
rem  Alamat: http://localhost:4322   (tutup jendela ini untuk berhenti)
rem ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js tidak ditemukan. Install versi LTS dari https://nodejs.org lalu jalankan ulang.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Menginstal dependensi pertama kali, tunggu sebentar...
  call npm install
)

echo Website : http://localhost:4322
echo PDF     : http://localhost:4322/portfolio-pdf
echo Admin   : http://localhost:4322/admin
echo.
echo Tekan Ctrl+C atau tutup jendela ini untuk menghentikan server.
call npm run dev -- --open
