<#
.SYNOPSIS
  SauraRoute Local Stack Launcher for Windows.
.DESCRIPTION
  Starts the SauraRoute stack:
  1. GraphHopper 10.2 Routing Engine (:8989 / Admin :8990)
  2. SauraRoute API Service (:3000)
  3. SauraRoute Web Dashboard (:5173)

.PARAMETER NoWeb
  Skips starting the React / Vite frontend dashboard.
.PARAMETER NoRouting
  Skips starting the local GraphHopper routing engine.
.PARAMETER NoApi
  Skips starting the Node.js API service.
.PARAMETER Background
  Runs services as background processes instead of separate console windows.

.EXAMPLE
  .\scripts\start.ps1
.EXAMPLE
  .\scripts\start.ps1 -NoWeb
#>

[CmdletBinding()]
param(
  [switch]$NoWeb,
  [switch]$NoRouting,
  [switch]$NoApi,
  [switch]$Background
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -Path $RepoRoot

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "             SauraRoute: Starting Local Services                " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. Pre-flight Verification
# -----------------------------------------------------------------------------
$JarPath = Join-Path $RepoRoot "data\raw\graphhopper-web-10.2.jar"
$PbfPath = Join-Path $RepoRoot "data\raw\north-eastern-zone-latest.osm.pbf"
$ConfigPath = Join-Path $RepoRoot "services\routing\graphhopper.yml"
$EnvPath = Join-Path $RepoRoot ".env"

if (-not $NoRouting) {
  if (-not (Test-Path -LiteralPath $JarPath) -or -not (Test-Path -LiteralPath $PbfPath)) {
    Write-Host "[ERROR] GraphHopper JAR or OSM PBF dataset is missing." -ForegroundColor Red
    Write-Host "        Please run the automated setup script first:" -ForegroundColor Yellow
    Write-Host "        .\scripts\setup.ps1`n" -ForegroundColor White
    exit 1
  }
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  $envExample = Join-Path $RepoRoot ".env.example"
  if (Test-Path -LiteralPath $envExample) {
    Copy-Item -Path $envExample -Destination $EnvPath
    Write-Host "[INFO] Created .env from .env.example" -ForegroundColor DarkGray
  }
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn)
  } catch {
    return $false
  }
}

# -----------------------------------------------------------------------------
# 2. Launch GraphHopper (:8989 / :8990)
# -----------------------------------------------------------------------------
if (-not $NoRouting) {
  if (Test-PortInUse 8989) {
    Write-Host "[EXISTS] Port 8989 already in use. Assuming GraphHopper is already active." -ForegroundColor Green
  } else {
    Write-Host "-> Launching GraphHopper 10.2 (port 8989)..." -ForegroundColor Yellow
    $ghScript = "Set-Location -Path '$RepoRoot'; `$host.UI.RawUI.WindowTitle = 'SauraRoute - GraphHopper :8989'; Write-Host 'Starting GraphHopper 10.2 on :8989...' -ForegroundColor Cyan; java -Xms2g -Xmx4g -jar `"$JarPath`" server `"$ConfigPath`""

    if ($Background) {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy", "Bypass", "-Command", $ghScript -WorkingDirectory $RepoRoot -WindowStyle Hidden
    } else {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $ghScript -WorkingDirectory $RepoRoot
    }
  }
}

# -----------------------------------------------------------------------------
# 3. Launch SauraRoute API (:3000)
# -----------------------------------------------------------------------------
if (-not $NoApi) {
  $apiDir = Join-Path $RepoRoot "services\api"
  if (Test-PortInUse 3000) {
    Write-Host "[EXISTS] Port 3000 already in use. Assuming SauraRoute API is already active." -ForegroundColor Green
  } else {
    Write-Host "-> Launching SauraRoute API Service (port 3000)..." -ForegroundColor Yellow
    $apiScript = "Set-Location -Path '$apiDir'; `$host.UI.RawUI.WindowTitle = 'SauraRoute - API Service :3000'; Write-Host 'Starting SauraRoute API on :3000...' -ForegroundColor Cyan; npm run dev"

    if ($Background) {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy", "Bypass", "-Command", $apiScript -WorkingDirectory $apiDir -WindowStyle Hidden
    } else {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $apiScript -WorkingDirectory $apiDir
    }
  }
}

# -----------------------------------------------------------------------------
# 4. Launch SauraRoute Web Dashboard (:5173)
# -----------------------------------------------------------------------------
if (-not $NoWeb) {
  $webDir = Join-Path $RepoRoot "apps\web"
  if (Test-PortInUse 5173) {
    Write-Host "[EXISTS] Port 5173 already in use. Assuming Web Dashboard is already active." -ForegroundColor Green
  } else {
    Write-Host "-> Launching SauraRoute Web Dashboard (port 5173)..." -ForegroundColor Yellow
    $webScript = "Set-Location -Path '$webDir'; `$host.UI.RawUI.WindowTitle = 'SauraRoute - Web Dashboard :5173'; Write-Host 'Starting SauraRoute Web Dashboard on :5173...' -ForegroundColor Cyan; npm run dev"

    if ($Background) {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy", "Bypass", "-Command", $webScript -WorkingDirectory $webDir -WindowStyle Hidden
    } else {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $webScript -WorkingDirectory $webDir
    }
  }
}

# -----------------------------------------------------------------------------
# 5. Summary Banner
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "              SauraRoute Local Services Started!                 " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Service Endpoints:" -ForegroundColor Cyan
Write-Host "  * Web Dashboard:       http://localhost:5173" -ForegroundColor White
Write-Host "  * API REST Service:    http://localhost:3000" -ForegroundColor White
Write-Host "  * API Health Endpoint: http://localhost:3000/api/health" -ForegroundColor White
Write-Host "  * GraphHopper Engine:  http://localhost:8989" -ForegroundColor White
Write-Host "  * GraphHopper Admin:   http://localhost:8990/healthcheck" -ForegroundColor White
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  * Run Health Check:    .\scripts\check.ps1" -ForegroundColor White
Write-Host "  * Stop All Services:   .\scripts\stop.ps1" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
