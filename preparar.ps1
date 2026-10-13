$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$radarPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $radarPython)) {
    $radarCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    $radarBasePython = if ($radarCommand) { $radarCommand.Source } else {
        Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    }
    if (-not (Test-Path -LiteralPath $radarBasePython)) {
        throw "Instala Python 3.12 y agrega Python al PATH para preparar el entorno."
    }
    & $radarBasePython -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el entorno virtual." }
}
& $radarPython -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias." }
if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host "Configura OPENAI_API_KEY en .env antes de investigar."
}
Write-Host "Entorno preparado. Ejecuta .\iniciar.ps1."
