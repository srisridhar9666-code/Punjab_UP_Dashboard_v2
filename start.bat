@echo off
title Call Center Intelligence
echo.
echo   API        http://localhost:8001   (docs at /docs)
echo   Dashboard  http://localhost:5173
echo.
start "API" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8001"
timeout /t 3 /nobreak >nul
start "Dashboard" cmd /k "cd /d "%~dp0frontend" && npm run dev"
