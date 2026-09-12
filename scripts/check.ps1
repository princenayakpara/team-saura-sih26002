[CmdletBinding()]
param(
  [int]$TimeoutSeconds = 3
)

$ErrorActionPreference = 'Continue'

# Resolve repository root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         SauraRoute Stack Health Check                 " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$allPassed = $true

function Test-HttpEndpoint {
  param(
    [string]$Name,
    [string]$Url,
    [int]$ExpectedCode = 200
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Timeout = $TimeoutSeconds * 1000
    $req.Method = 'GET'
    $resp = [System.Net.HttpWebResponse]$req.GetResponse()
    $sw.Stop()
    $code = [int]$resp.StatusCode
    $resp.Close()

    if ($code -eq $ExpectedCode) {
      Write-Host (Format-HealthLine -Name $Name -Status "PASS" -Url $Url -Detail "$($sw.ElapsedMilliseconds)ms (HTTP $code)") -ForegroundColor Green
      return $true
    } else {
      Write-Host (Format-HealthLine -Name $Name -Status "FAIL" -Url $Url -Detail "Expected HTTP $ExpectedCode, got HTTP $code") -ForegroundColor Red
      return $false
    }
  } catch [System.Net.WebException] {
    $sw.Stop()
    if ($_.Response) {
      $code = [int]($_.Response.StatusCode)
      if ($code -eq $ExpectedCode) {
        Write-Host (Format-HealthLine -Name $Name -Status "PASS" -Url $Url -Detail "$($sw.ElapsedMilliseconds)ms (HTTP $code)") -ForegroundColor Green
        return $true
      }
      Write-Host (Format-HealthLine -Name $Name -Status "FAIL" -Url $Url -Detail "HTTP $code") -ForegroundColor Red
    } else {
      Write-Host (Format-HealthLine -Name $Name -Status "OFFLINE" -Url $Url -Detail "Connection refused / timeout") -ForegroundColor Red
    }
    return $false
  } catch {
    $sw.Stop()
    Write-Host (Format-HealthLine -Name $Name -Status "ERROR" -Url $Url -Detail $_.Exception.Message) -ForegroundColor Red
    return $false
  }
}

function Format-HealthLine {
  param([string]$Name, [string]$Status, [string]$Url, [string]$Detail)
  return ("  [{0,-7}] {1,-28} | {2,-30} | {3}" -f $Status, $Name, $Url, $Detail)
}

# -------------------------------------------------------------------
# 1. Local Runtime Files Verification
# -------------------------------------------------------------------
Write-Host "`n[1/3] Verifying Local Runtime Data Assets..." -ForegroundColor Yellow

$jarPath = Join-Path $repoRoot 'data\raw\graphhopper-web-10.2.jar'
$pbfPath = Join-Path $repoRoot 'data\raw\north-eastern-zone-latest.osm.pbf'
$envPath = Join-Path $repoRoot '.env'

# Check GraphHopper JAR
if (Test-Path -LiteralPath $jarPath) {
  $item = Get-Item -LiteralPath $jarPath
  if ($item.Length -ge 35000000) {
    Write-Host (Format-HealthLine -Name "GraphHopper 10.2 JAR" -Status "PASS" -Url "data/raw/graphhopper-web-10.2.jar" -Detail "$([Math]::Round($item.Length/1MB,2)) MB") -ForegroundColor Green
  } else {
    Write-Host (Format-HealthLine -Name "GraphHopper 10.2 JAR" -Status "FAIL" -Url "data/raw/graphhopper-web-10.2.jar" -Detail "File size too small: $($item.Length) bytes") -ForegroundColor Red
    $allPassed = $false
  }
} else {
  Write-Host (Format-HealthLine -Name "GraphHopper 10.2 JAR" -Status "MISSING" -Url "data/raw/graphhopper-web-10.2.jar" -Detail "Run .\setup.ps1 to download") -ForegroundColor Red
  $allPassed = $false
}

# Check OpenStreetMap PBF
if (Test-Path -LiteralPath $pbfPath) {
  $item = Get-Item -LiteralPath $pbfPath
  if ($item.Length -ge 15000000) {
    Write-Host (Format-HealthLine -Name "OSM NER Data Extract" -Status "PASS" -Url "data/raw/north-eastern-zone-latest.osm.pbf" -Detail "$([Math]::Round($item.Length/1MB,2)) MB") -ForegroundColor Green
  } else {
    Write-Host (Format-HealthLine -Name "OSM NER Data Extract" -Status "FAIL" -Url "data/raw/north-eastern-zone-latest.osm.pbf" -Detail "File size too small: $($item.Length) bytes") -ForegroundColor Red
    $allPassed = $false
  }
} else {
  Write-Host (Format-HealthLine -Name "OSM NER Data Extract" -Status "MISSING" -Url "data/raw/north-eastern-zone-latest.osm.pbf" -Detail "Run .\setup.ps1 to download") -ForegroundColor Red
  $allPassed = $false
}

# Check .env configuration
if (Test-Path -LiteralPath $envPath) {
  Write-Host (Format-HealthLine -Name "Root .env Configuration" -Status "PASS" -Url ".env" -Detail "Present") -ForegroundColor Green
} else {
  Write-Host (Format-HealthLine -Name "Root .env Configuration" -Status "MISSING" -Url ".env" -Detail "Run .\setup.ps1 to copy from .env.example") -ForegroundColor Red
  $allPassed = $false
}

# -------------------------------------------------------------------
# 2. Service Endpoint Health Checks
# -------------------------------------------------------------------
Write-Host "`n[2/3] Checking Live Service Endpoints..." -ForegroundColor Yellow

$ghHealth = Test-HttpEndpoint -Name "GraphHopper Engine (:8989)" -Url "http://localhost:8989/health" -ExpectedCode 200
$apiHealth = Test-HttpEndpoint -Name "SauraRoute API (:3000)" -Url "http://localhost:3000/api/health" -ExpectedCode 200
$mlHealth = Test-HttpEndpoint -Name "ML Prediction Model" -Url "http://localhost:3000/api/ml/model" -ExpectedCode 200
$webHealth = Test-HttpEndpoint -Name "Web Map Dashboard (:5173)" -Url "http://localhost:5173" -ExpectedCode 200

if (-not ($ghHealth -and $apiHealth -and $mlHealth -and $webHealth)) {
  $allPassed = $false
}

# -------------------------------------------------------------------
# 3. Final Summary & Exit Code
# -------------------------------------------------------------------
Write-Host "`n========================================================" -ForegroundColor Cyan
if ($allPassed) {
  Write-Host "     [PASS] ALL SAURAROUTE SERVICES & ASSETS HEALTHY    " -ForegroundColor Green
  Write-Host "========================================================" -ForegroundColor Cyan
  exit 0
} else {
  Write-Host "     [ATTENTION] ONE OR MORE HEALTH CHECKS FAILED       " -ForegroundColor Yellow
  Write-Host "========================================================" -ForegroundColor Cyan
  Write-Host " Troubleshooting Tips:" -ForegroundColor White
  Write-Host "  * If services are offline, start them using: .\start.ps1" -ForegroundColor Yellow
  Write-Host "  * If data assets are missing, download using: .\setup.ps1" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}
