@echo off
title Unified AI Media Platform - Launcher
echo ========================================================
echo Launching Unified AI Media Platform
echo ========================================================

echo [1/2] Starting Backend Server on port 8000...
start "Unified AI Backend" cmd /k "start_backend.bat"

echo [2/2] Starting Frontend Server on port 5173...
start "Unified AI Frontend" cmd /k "start_frontend.bat"

echo.
echo Application started!
echo Please open: http://localhost:5173 in your browser.
echo API Documentation: http://127.0.0.1:8000/docs
echo ========================================================
pause
