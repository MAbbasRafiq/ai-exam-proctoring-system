# Run FastAPI for LAN class quiz (multi-worker).
# Usage (from backend folder):
#   .\run_lan.ps1
#   .\run_lan.ps1 -Workers 1   # use 1 worker if AI monitoring demo is ON

param(
    [int]$Workers = 4,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Starting exam API on 0.0.0.0:$Port with $Workers workers..."
Write-Host "Tip: For AI webcam demo, use -Workers 1 (in-memory monitoring state)."
Write-Host "For 100-student quiz (monitoring off/light), use 2-4 workers."

if (Test-Path ".\venv\Scripts\uvicorn.exe") {
    $uvicorn = ".\venv\Scripts\uvicorn.exe"
} else {
    $uvicorn = "uvicorn"
}

& $uvicorn main:app --host 0.0.0.0 --port $Port --workers $Workers
