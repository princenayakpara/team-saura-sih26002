<#
.SYNOPSIS
  SauraRoute Local Services Shutdown Script.
.DESCRIPTION
  Safely identifies and terminates local development processes running on:
  - Port 8989 (GraphHopper)
  - Port 8990 (GraphHopper Admin)
  - Port 3000 (SauraRoute API)
  - Port 5173 (SauraRoute Web Dashboard)
.EXAMPLE
  .\scripts\stop.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Continue'

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "             SauraRoute: Stopping Local Services                " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$Ports = @(8989, 8990, 3000, 5173)
$StoppedCount = 0

foreach ($port in $Ports) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($procId in $pids) {
        if ($procId -gt 4) { # Avoid system processes
          $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
          $procName = if ($proc) { $proc.ProcessName } else { "PID $procId" }
          Write-Host "  -> Terminating $procName (PID $procId) on port $port..." -ForegroundColor Yellow
          Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
          $StoppedCount++
        }
      }
    } else {
      Write-Host "  [CLEAN] Port $port is not in use." -ForegroundColor DarkGray
    }
  } catch {
    Write-Host "  [WARN] Could not inspect port $port`: $_" -ForegroundColor DarkYellow
  }
}

Write-Host ""
if ($StoppedCount -gt 0) {
  Write-Host "Successfully stopped $StoppedCount active process(es)." -ForegroundColor Green
} else {
  Write-Host "No active SauraRoute processes were listening on configured ports." -ForegroundColor Green
}
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
