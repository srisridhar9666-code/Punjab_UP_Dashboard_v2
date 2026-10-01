@echo off
title Call Center Intelligence - Setup
setlocal
echo.
echo ============================================================
echo   Call Center Intelligence v2 - first-time setup
echo ============================================================
echo.
where python >nul 2>&1 || (echo [ERROR] Python 3.10+ not found. & pause & exit /b 1)
where node >nul 2>&1 || (echo [ERROR] Node.js 20+ not found. & pause & exit /b 1)

cd /d "%~dp0backend"
if not exist .venv (
  echo [1/5] Creating Python virtual environment...
  python -m venv .venv || (echo [ERROR] venv failed & pause & exit /b 1)
)
echo [2/5] Installing Python packages...
.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.venv\Scripts\python.exe -m pip install --quiet -r requirements.txt || (echo [ERROR] pip install failed & pause & exit /b 1)

if not exist .env (
  echo [3/5] Creating backend\.env with a fresh SECRET_KEY...
  copy /y .env.example .env >nul
  for /f %%k in ('.venv\Scripts\python.exe -c "import secrets;print(secrets.token_urlsafe(48))"') do (
    powershell -NoProfile -Command "(Get-Content .env) -replace '^SECRET_KEY=.*','SECRET_KEY=%%k' | Set-Content .env"
  )
  echo        Open backend\.env and set DB_PASSWORD for your MySQL user, then run setup.bat again.
  pause
  exit /b 0
)

echo [4/5] Upgrading the database (safe to run on your existing v1 database)...
.venv\Scripts\alembic.exe upgrade head || (echo [ERROR] Migration failed. Is MySQL running and is backend\.env correct? & pause & exit /b 1)

echo.
set /p MAKEADMIN="Create or reset an admin account now? (y/n) "
if /i "%MAKEADMIN%"=="y" (
  set /p ADMINNAME="Admin username: "
  call .venv\Scripts\python.exe -m app.cli create-admin %%ADMINNAME%%
)

echo [5/5] Installing frontend packages...
cd /d "%~dp0frontend"
call npm install --no-audit --no-fund --silent || (echo [ERROR] npm install failed & pause & exit /b 1)

echo.
echo   Setup complete. Run start.bat to launch.
echo   Existing v1 accounts keep their passwords but must choose a new one at next sign-in.
pause
