@echo off
echo Starting Cofau Backend Server...
echo.
echo Note: Make sure MongoDB is running on mongodb://localhost:27017
echo.
cd /d %~dp0
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
pause

