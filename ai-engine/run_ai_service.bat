@echo off
title Cheatz AI Inference Daemon (Port 8000)
cd /d "%~dp0"
echo [AI Daemon] Starting Python FastAPI Microservice...
python -m pip install -r requirements.txt --quiet
python app.py
pause

