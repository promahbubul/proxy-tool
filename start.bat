@echo off
title SmartFill Pro Launcher
cd /d "%~dp0"
echo ===================================================
echo Starting SmartFill Pro (Proxy & AutoFill Overlay)...
echo ===================================================
node run.js
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Application stopped with code %errorlevel%
  pause
)
