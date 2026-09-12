[CmdletBinding()]
param(
  [switch]$Background = $false,
  [switch]$NoWeb = $false,
  [int]$HeapGiB = 4
)

$ErrorActionPreference = 'Stop'

# Resolve repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "            SauraRoute Stack Launcher                  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Pre-flight asset check
$jarPath = Join-Path $repoRoot 'data\raw\graphhopper-web-10.2.jar'
$pbfPath = Join-Path $repoRoot 'data\raw\north-eastern-zone-latest.osm.pbf'

if (-not (Test-Path -LiteralPath $jarPath) -or -not (Test-Path -LiteralPath $pbfPath)) {
  Write-Host "[WARNING] Required GraphHopper JAR or OSM data asset missing." -ForegroundColor Yellow
  Write-Host "Running automated setup script first..." -ForegroundColor Cyan
  & (Join-Path $scriptDir 'setup.ps1')
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$Command,
    [string]$WorkingDir
  )

  Write-Host "  [+] Launching $Title..." -ForegroundColor Cyan
  $psCmd = "cd `"$WorkingDir`"; Write-Host '=== $Title ===' -ForegroundColor Cyan; $Command"
  Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $psCmd -WindowStyle Normal
}

Write-Host "`nLaunching local SauraRoute microservices..." -ForegroundColor Yellow

# 1. GraphHopper 10.2 Routing Engine (:8989)
$ghCmd = ".\services\routing\start-graphhopper.ps1 -HeapGiB $HeapGiB"
Start-ServiceWindow -Title "GraphHopper Routing Engine (:8989)" -Command $ghCmd -WorkingDir $repoRoot

# 2. SauraRoute API Service (:3000)
$apiDir = Join-Path $repoRoot 'services\api'
Start-ServiceWindow -Title "SauraRoute Express API Service (:3000)" -Command "npm run dev" -WorkingDir $apiDir

# 3. Web Map Dashboard (:5173)
if (-not $NoWeb) {
  $webDir = Join-Path $repoRoot 'apps\web'
  Start-ServiceWindow -Title "SauraRoute Web Dashboard (:5173)" -Command "npm run dev" -WorkingDir $webDir
}

Write-Host "`nWaiting for service endpoints to initialize..." -ForegroundColor Yellow

function Wait-EndpointReady {
  param([string]$Url, [int]$TimeoutSec = 35)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $req = [System.Net.HttpWebRequest]::Create($Url)
      $req.Timeout = 1500
      $resp = [System.Net.HttpWebResponse]$req.GetResponse()
      if ([int]$resp.StatusCode -eq 200) {
        $resp.Close()
        return $true
      }
      $resp.Close()
    } catch { }
    Start-Sleep -Milliseconds 800
  }
  return $false
}

$ghReady = Wait-EndpointReady -Url "http://localhost:8989/health" -TimeoutSec 35
$apiReady = Wait-EndpointReady -Url "http://localhost:3000/api/health" -TimeoutSec 15
$webReady = $true
if (-not $NoWeb) {
  $webReady = Wait-EndpointReady -Url "http://localhost:5173" -TimeoutSec 15
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "         SauraRoute Stack Live Services                " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

function Output-ServiceStatus {
  param([string]$Name, [string]$Url, [bool]$IsReady)
  $statusStr = if ($IsReady) { "ONLINE" } else { "STARTING" }
  $color = if ($IsReady) { "Green" } else { "Yellow" }
  Write-Host ("  [{0,-8}] {1,-32} | {2}" -f $statusStr, $Name, $Url) -ForegroundColor $color
}

Output-ServiceStatus -Name "GraphHopper Routing Engine" -Url "http://localhost:8989" -IsReady $ghReady
Output-ServiceStatus -Name "SauraRoute Express API" -Url "http://localhost:3000" -IsReady $apiReady
if (-not $NoWeb) {
  Output-ServiceStatus -Name "React + MapLibre Web Dashboard" -Url "http://localhost:5173" -IsReady $webReady
}

Write-Host "`nUseful Endpoints & Diagnostics:" -ForegroundColor White
Write-Host "  * Web Map Dashboard:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "  * API Health Endpoint: http://localhost:3000/api/health" -ForegroundColor Gray
Write-Host "  * ML Classifier Model: http://localhost:3000/api/ml/model" -ForegroundColor Gray
Write-Host "  * Health Check Script: .\check.ps1" -ForegroundColor Yellow
Write-Host ""
