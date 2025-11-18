# PowerShell script to start the backend server
Write-Host "Starting Cofau Backend Server..." -ForegroundColor Green
Write-Host ""
Write-Host "Note: Make sure MongoDB is running on mongodb://localhost:27017" -ForegroundColor Yellow
Write-Host ""

$pythonPath = "C:\Users\shifa\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\python.exe"

if (Test-Path $pythonPath) {
    Set-Location $PSScriptRoot
    & $pythonPath -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
} else {
    Write-Host "Python not found at: $pythonPath" -ForegroundColor Red
    Write-Host "Trying default python..." -ForegroundColor Yellow
    python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
}

