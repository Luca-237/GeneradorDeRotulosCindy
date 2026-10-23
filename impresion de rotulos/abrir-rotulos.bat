@echo off
rem ============================================================
rem  Generador de rotulos - Cindy Mayorista
rem  Abre la herramienta en el navegador. No necesita servidor ni instalar
rem  nada, pero SI internet: los datos y el login estan en Supabase.
rem ============================================================
setlocal
set "APP=%~dp0index.html"

if not exist "%APP%" (
  echo.
  echo  No se encontro index.html en:
  echo    %~dp0
  echo  El .bat tiene que estar en la misma carpeta que index.html.
  echo.
  pause
  exit /b 1
)

rem Preferir Chrome o Edge (imprimen bien la medida exacta en cm).
rem Si no estan, se abre con el navegador predeterminado.
set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

echo Abriendo el generador de rotulos...
if defined NAV (
  start "" "%NAV%" "%APP%"
) else (
  start "" "%APP%"
)
endlocal
