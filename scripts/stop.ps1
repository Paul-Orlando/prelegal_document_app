# Stop the Prelegal server started by scripts\start.ps1.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root '.data\server.pid'

if (-not (Test-Path $pidFile)) {
    Write-Output 'Prelegal does not appear to be running (no PID file).'
    exit 0
}

$serverPid = Get-Content $pidFile
$proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue

if ($proc) {
    Stop-Process -Id $serverPid -Force
    Write-Output "Stopped Prelegal (PID $serverPid)."
} else {
    Write-Output "No process with PID $serverPid; clearing stale PID file."
}

Remove-Item $pidFile -Force
