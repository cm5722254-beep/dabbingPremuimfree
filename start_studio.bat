@echo off
setlocal
cd /d "%~dp0"
title Cheatz Dubbing Studio Pro v5.3

echo ========================================================================
echo    CHEATZ DUBBING STUDIO PRO -- AI Video Dubber & VoxCPM2 Studio
echo ========================================================================
echo.

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
) else (
    set "NODE_CMD=node"
)

echo [1/2] Checking Node.js environment...
"%NODE_CMD%" -v >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [2/2] Starting Cheatz Dubbing Studio on http://localhost:3001 ...
echo.

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3001" --window-size=1440,920
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:3001" --window-size=1440,920
) else (
    start "" "http://localhost:3001"
)

"%NODE_CMD%" server.js
pause
