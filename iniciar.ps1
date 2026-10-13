$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$radarPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $radarPython)) {
    throw "Falta el entorno virtual. Ejecuta primero .\preparar.ps1."
}
Write-Host "Radar TIC: http://127.0.0.1:8000"
& $radarPython app.py
