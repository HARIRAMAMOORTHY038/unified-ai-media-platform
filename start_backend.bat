@echo off
title Unified AI Media Platform - Backend Server
echo ========================================================
echo Starting Unified AI Media Platform (FastAPI Backend)
echo Local API Docs: http://127.0.0.1:8000/docs
echo ========================================================
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
