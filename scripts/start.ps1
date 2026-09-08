# Start the Prelegal server in the background and record its PID.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.data\server.pid'
$logFile = Join-Path $root '.data\server.log'

New-Item -ItemType Directory -Force -Path (Join-Path $root '.data') | Out-Null

if (Test-Path $pidFile) {
    $existing = Get-Content $pidFile
    $proc = Get-Process -Id $existing -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Output "Prelegal is already running (PID $existing). Use scripts\stop.ps1 first."
        exit 0
    }
    Remove-Item $pidFile -Force
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Output 'Installing dependencies...'
    Push-Location $root
    npm install
    Pop-Location
}

$proc = Start-Process -FilePath 'node' `
    -ArgumentList 'server/index.js' `
    -WorkingDirectory $root `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError (Join-Path $root '.data\server.err.log') `
    -PassThru -WindowStyle Hidden

$proc.Id | Set-Content $pidFile
Start-Sleep -Seconds 2

Write-Output "Prelegal started (PID $($proc.Id))."
Write-Output "  URL:  http://localhost:$(if ($env:PORT) { $env:PORT } else { '3000' })"
Write-Output "  Logs: $logFile"
Write-Output "  Stop: scripts\stop.ps1"
