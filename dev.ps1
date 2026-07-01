# My Brain — launch Dashboard API + UI from repo root (Windows / PowerShell)
#
# Usage:
#   .\dev.ps1              Start API (:3000) + UI (:5173)
#   .\dev.ps1 -Open        Start and open http://localhost:5173
#   .\dev.ps1 install      npm install in api/ and ui/
#   .\dev.ps1 api          API only
#   .\dev.ps1 ui           UI only
#   .\dev.ps1 -Help

param(
    [Parameter(Position = 0)]
    [ValidateSet("", "both", "install", "api", "ui", "help")]
    [string]$Command = "both",

    [switch]$Open,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Dashboard = Join-Path $Root "Dashboard"
$ApiDir = Join-Path $Dashboard "api"
$UiDir = Join-Path $Dashboard "ui"

function Get-EnvOrDefault([string]$Name, [string]$Default) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($value) { return $value }
    return $Default
}

function Write-Info([string]$Message) {
    Write-Host "[my-brain]  $Message" -ForegroundColor Magenta
}

function Write-Warn([string]$Message) {
    Write-Host "[my-brain]  $Message" -ForegroundColor Yellow
}

function Show-Usage {
    $apiPort = Get-EnvOrDefault "CBM_API_PORT" "3000"
    $apiHost = Get-EnvOrDefault "CBM_API_HOST" "127.0.0.1"
    $ollamaUrl = Get-EnvOrDefault "CBM_OLLAMA_URL" "http://localhost:11434"

    @"

My Brain dev launcher (PowerShell)

  .\dev.ps1              Start dashboard API + UI
  .\dev.ps1 -Open        Start and open http://localhost:5173
  .\dev.ps1 install      Install npm dependencies
  .\dev.ps1 api          API only  (port $apiPort)
  .\dev.ps1 ui           UI only   (port 5173)
  .\dev.ps1 -Help        Show this help

Services:
  API   http://${apiHost}:${apiPort}
  UI    http://localhost:5173
  Chat  uses Ollama at $ollamaUrl

Press Ctrl+C to stop API + UI together.

Git Bash / WSL: use ./dev.sh instead.

"@
}

function Test-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js not found. Install Node 22+ first."
    }
}

function Ensure-Deps([string]$Dir, [string]$Name) {
    $nodeModules = Join-Path $Dir "node_modules"
    if (-not (Test-Path $nodeModules)) {
        Write-Warn "${Name}: node_modules missing — running npm install…"
        Push-Location $Dir
        try { npm install } finally { Pop-Location }
        Write-Host "[my-brain]  ${Name}: dependencies installed." -ForegroundColor Green
    }
}

function Test-Ollama {
    $url = (Get-EnvOrDefault "CBM_OLLAMA_URL" "http://localhost:11434").TrimEnd("/")
    try {
        Invoke-WebRequest -Uri "$url/api/tags" -UseBasicParsing -TimeoutSec 3 | Out-Null
        Write-Info "Ollama reachable at $url (Chat tab ready)"
    } catch {
        Write-Warn "Ollama not reachable at $url — start it for Chat (e.g. ollama serve)"
    }
}

function Open-Browser {
    Start-Job {
        Start-Sleep -Seconds 2
        Start-Process "http://localhost:5173"
    } | Out-Null
}

function Start-Both {
    Test-Node
    Ensure-Deps $ApiDir "api"
    Ensure-Deps $UiDir "ui"
    Test-Ollama

    if ($Open) { Open-Browser }

    $apiHost = Get-EnvOrDefault "CBM_API_HOST" "127.0.0.1"
    $apiPort = Get-EnvOrDefault "CBM_API_PORT" "3000"

    Write-Host ""
    Write-Info "Starting Dashboard (API + UI)…"
    Write-Host ""
    Write-Host "  API  -> http://${apiHost}:${apiPort}"
    Write-Host "  UI   -> http://localhost:5173"
    Write-Host ""
    Write-Host "  Press Ctrl+C to stop both."
    Write-Host ""

    $api = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -WorkingDirectory $ApiDir -NoNewWindow -PassThru
    Start-Sleep -Seconds 1
    $ui = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -WorkingDirectory $UiDir -NoNewWindow -PassThru

    try {
        Wait-Process -Id $api.Id, $ui.Id
    } finally {
        foreach ($proc in @($api, $ui)) {
            if ($proc -and -not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Info "Done."
    }
}

if ($Help -or $Command -eq "help") {
    Show-Usage
    exit 0
}

switch ($Command) {
    "install" {
        Test-Node
        Write-Info "Installing API dependencies…"
        Push-Location $ApiDir; try { npm install } finally { Pop-Location }
        Write-Info "Installing UI dependencies…"
        Push-Location $UiDir; try { npm install } finally { Pop-Location }
        Write-Info "Done."
    }
    "api" {
        Test-Node
        Ensure-Deps $ApiDir "api"
        Push-Location $ApiDir
        try { npm run dev } finally { Pop-Location }
    }
    "ui" {
        Test-Node
        Ensure-Deps $UiDir "ui"
        Push-Location $UiDir
        try { npm run dev } finally { Pop-Location }
    }
    default {
        Start-Both
    }
}
