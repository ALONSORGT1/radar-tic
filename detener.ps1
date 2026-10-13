$ErrorActionPreference = "Stop"
$radarPidPath = Join-Path $PSScriptRoot ".local\servidor.pid"
if (-not (Test-Path -LiteralPath $radarPidPath)) {
    Write-Host "No hay una instancia iniciada por Codex registrada. Usa Ctrl+C en la terminal donde ejecutaste el servidor."
    return
}
$radarPidFile = Get-Item -LiteralPath $radarPidPath
$radarServerPid = [int]((Get-Content -LiteralPath $radarPidPath -Raw).Trim())
$radarStopProcess = Get-Process -Id $radarServerPid -ErrorAction SilentlyContinue
if (-not $radarStopProcess) { Write-Host "La instancia registrada ya no está ejecutándose."; return }
$radarExpectedExe = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".venv\Scripts\python.exe"))
$radarActualExe = [System.IO.Path]::GetFullPath($radarStopProcess.Path)
$radarTimeDifference = [Math]::Abs(($radarStopProcess.StartTime.ToUniversalTime() - $radarPidFile.LastWriteTimeUtc).TotalSeconds)
if ($radarActualExe -ne $radarExpectedExe -or $radarTimeDifference -gt 30) {
    throw "El proceso registrado no coincide con el servidor de este proyecto. No se detuvo ningún proceso."
}
& taskkill.exe /PID $radarServerPid /T /F
if ($LASTEXITCODE -ne 0) { throw "No se pudo detener la instancia local desde esta terminal." }
Write-Host "Radar TIC detenido. Puedes ejecutar .\iniciar.ps1."
