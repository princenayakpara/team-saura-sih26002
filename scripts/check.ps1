<#
.SYNOPSIS
  SauraRoute Stack Health Check & Diagnostics Script.
.DESCRIPTION
  Verifies local environment prerequisites, data assets, and live HTTP service endpoints:
  - GraphHopper 10.2 (:8989)
  - SauraRoute API (:3000)
  - ML Prediction Engine (:3000/api/ml)
  - SauraRoute Web Dashboard (:5173)
.EXAMPLE
  .\scripts\check.ps1
#>

[CmdletBinding()]
param(
  [int]$TimeoutSeconds = 4
)

$ErrorActionPreference = 'Continue'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -Path $RepoRoot

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "             SauraRoute: System Health & Diagnostics            " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$Results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Add-Result {
  param(
    [string]$Category,
    [string]$Name,
    [string]$Status, # PASS, WARN, FAIL
    [string]$Details
  )
  $Results.Add([PSCustomObject]@{
    Category = $Category
    Name     = $Name
    Status   = $Status
    Details  = $Details
  })
}

# -----------------------------------------------------------------------------
# 1. Check Local Environment & Prerequisites
# -----------------------------------------------------------------------------
# Node.js
try {
  $nodeVer = (node --version 2>&1).Trim()
  if ($nodeVer -match '^v(\d+)\.') {
    $major = [int]$matches[1]
    if ($major -ge 20) {
      Add-Result -Category "Prerequisites" -Name "Node.js" -Status "PASS" -Details "$nodeVer (>= v20 required)"
    } else {
      Add-Result -Category "Prerequisites" -Name "Node.js" -Status "FAIL" -Details "$nodeVer (< v20.0.0)"
    }
  } else {
    Add-Result -Category "Prerequisites" -Name "Node.js" -Status "FAIL" -Details "Unknown version: $nodeVer"
  }
} catch {
  Add-Result -Category "Prerequisites" -Name "Node.js" -Status "FAIL" -Details "Not found in PATH"
}

# Java 17
try {
  $javaVerOutput = cmd.exe /c "java -version 2>&1"
  $firstLine = ($javaVerOutput | Select-Object -First 1)
  if ($firstLine -match 'version "(17\.[^"]+)"' -or $firstLine -match 'version "17"') {
    Add-Result -Category "Prerequisites" -Name "Java 17 (Temurin/OpenJDK)" -Status "PASS" -Details "$firstLine"
  } else {
    Add-Result -Category "Prerequisites" -Name "Java 17 (Temurin/OpenJDK)" -Status "FAIL" -Details "Detected: $firstLine"
  }
} catch {
  Add-Result -Category "Prerequisites" -Name "Java 17 (Temurin/OpenJDK)" -Status "FAIL" -Details "Not found in PATH"
}

# Python
try {
  $pyVer = (python --version 2>&1).Trim()
  if ($pyVer -match 'Python (\d+)\.(\d+)') {
    Add-Result -Category "Prerequisites" -Name "Python" -Status "PASS" -Details "$pyVer"
  } else {
    Add-Result -Category "Prerequisites" -Name "Python" -Status "WARN" -Details "Could not verify version ($pyVer)"
  }
} catch {
  Add-Result -Category "Prerequisites" -Name "Python" -Status "WARN" -Details "Optional (deterministic ML fallback active)"
}

# -----------------------------------------------------------------------------
# 2. Check Data & Binary Assets
# -----------------------------------------------------------------------------
# GraphHopper JAR
$jarPath = Join-Path $RepoRoot "data\raw\graphhopper-web-10.2.jar"
if (Test-Path -LiteralPath $jarPath) {
  $jarSize = (Get-Item -LiteralPath $jarPath).Length
  $jarMb = [math]::Round($jarSize / 1MB, 2)
  if ($jarSize -ge 40000000) {
    Add-Result -Category "Data Assets" -Name "GraphHopper 10.2 JAR" -Status "PASS" -Details "$jarMb MB (data/raw/graphhopper-web-10.2.jar)"
  } else {
    Add-Result -Category "Data Assets" -Name "GraphHopper 10.2 JAR" -Status "FAIL" -Details "Truncated ($jarMb MB < 40MB). Run .\scripts\setup.ps1"
  }
} else {
  Add-Result -Category "Data Assets" -Name "GraphHopper 10.2 JAR" -Status "FAIL" -Details "Missing. Run .\scripts\setup.ps1"
}

# OSM PBF
$pbfPath = Join-Path $RepoRoot "data\raw\north-eastern-zone-latest.osm.pbf"
if (Test-Path -LiteralPath $pbfPath) {
  $pbfSize = (Get-Item -LiteralPath $pbfPath).Length
  $pbfMb = [math]::Round($pbfSize / 1MB, 2)
  if ($pbfSize -ge 80000000) {
    Add-Result -Category "Data Assets" -Name "North-East OSM PBF" -Status "PASS" -Details "$pbfMb MB (data/raw/north-eastern-zone-latest.osm.pbf)"
  } else {
    Add-Result -Category "Data Assets" -Name "North-East OSM PBF" -Status "FAIL" -Details "Truncated ($pbfMb MB < 80MB). Run .\scripts\setup.ps1"
  }
} else {
  Add-Result -Category "Data Assets" -Name "North-East OSM PBF" -Status "FAIL" -Details "Missing. Run .\scripts\setup.ps1"
}

# ML Metadata
$metaPath = Join-Path $RepoRoot "services\ml\models\model_metadata.json"
if (Test-Path -LiteralPath $metaPath) {
  Add-Result -Category "Data Assets" -Name "ML Model Metadata" -Status "PASS" -Details "services/ml/models/model_metadata.json"
} else {
  Add-Result -Category "Data Assets" -Name "ML Model Metadata" -Status "FAIL" -Details "Missing model metadata file"
}

# -----------------------------------------------------------------------------
# 3. Live HTTP Endpoint Probes
# -----------------------------------------------------------------------------
function Test-HttpEndpoint {
  param(
    [string]$Url,
    [int]$ExpectedStatusCode = 200,
    [int]$TimeoutSec = 3
  )
  try {
    $request = [System.Net.WebRequest]::Create($Url)
    $request.Timeout = $TimeoutSec * 1000
    $request.Method = "GET"
    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $response.Close()
    return @{ Success = ($status -eq $ExpectedStatusCode); StatusCode = $status; Error = $null }
  } catch [System.Net.WebException] {
    if ($_.Response) {
      $status = [int]$_.Response.StatusCode
      return @{ Success = ($status -eq $ExpectedStatusCode); StatusCode = $status; Error = $_.Message }
    }
    return @{ Success = $false; StatusCode = 0; Error = "Connection refused or timed out" }
  } catch {
    return @{ Success = $false; StatusCode = 0; Error = $_.Message }
  }
}

# 3a. GraphHopper :8989
$ghRes = Test-HttpEndpoint -Url "http://localhost:8989/health" -TimeoutSec $TimeoutSeconds
if (-not $ghRes.Success) {
  # Try info endpoint
  $ghRes = Test-HttpEndpoint -Url "http://localhost:8989/info" -TimeoutSec $TimeoutSeconds
}
if ($ghRes.Success) {
  Add-Result -Category "Live Services" -Name "GraphHopper Engine (:8989)" -Status "PASS" -Details "Online (HTTP $($ghRes.StatusCode))"
} else {
  Add-Result -Category "Live Services" -Name "GraphHopper Engine (:8989)" -Status "FAIL" -Details "Offline ($($ghRes.Error)). Start with .\scripts\start.ps1"
}

# 3b. API Service :3000 /api/health
$apiRes = Test-HttpEndpoint -Url "http://localhost:3000/api/health" -TimeoutSec $TimeoutSeconds
if ($apiRes.Success) {
  Add-Result -Category "Live Services" -Name "SauraRoute API (:3000)" -Status "PASS" -Details "Online (HTTP $($apiRes.StatusCode))"
} else {
  Add-Result -Category "Live Services" -Name "SauraRoute API (:3000)" -Status "FAIL" -Details "Offline ($($apiRes.Error)). Start with .\scripts\start.ps1"
}

# 3c. ML Prediction Endpoint :3000/api/ml/model
$mlRes = Test-HttpEndpoint -Url "http://localhost:3000/api/ml/model" -TimeoutSec $TimeoutSeconds
if ($mlRes.Success) {
  Add-Result -Category "Live Services" -Name "ML Risk Engine (:3000/api/ml)" -Status "PASS" -Details "Online (Model & scaling metadata active)"
} else {
  Add-Result -Category "Live Services" -Name "ML Risk Engine (:3000/api/ml)" -Status "FAIL" -Details "Unavailable ($($mlRes.Error))"
}

# 3d. Web Dashboard :5173
$webRes = Test-HttpEndpoint -Url "http://localhost:5173" -TimeoutSec $TimeoutSeconds
if ($webRes.Success) {
  Add-Result -Category "Live Services" -Name "Web Dashboard (:5173)" -Status "PASS" -Details "Online (HTTP $($webRes.StatusCode))"
} else {
  Add-Result -Category "Live Services" -Name "Web Dashboard (:5173)" -Status "WARN" -Details "Offline or still starting ($($webRes.Error))"
}

# -----------------------------------------------------------------------------
# 4. Display Formatted Results
# -----------------------------------------------------------------------------
Write-Host ""
foreach ($item in $Results) {
  $color = switch ($item.Status) {
    "PASS" { [ConsoleColor]::Green }
    "WARN" { [ConsoleColor]::Yellow }
    "FAIL" { [ConsoleColor]::Red }
    default { [ConsoleColor]::White }
  }
  $tag = "[$($item.Status)]".PadRight(8)
  $name = "$($item.Name)".PadRight(32)
  Write-Host "  $tag $name : $($item.Details)" -ForegroundColor $color
}

$passCount = ($Results | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = ($Results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = ($Results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host ""
Write-Host "-----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Summary: $passCount Passed, $warnCount Warnings, $failCount Failed" -ForegroundColor $(if ($failCount -eq 0) { [ConsoleColor]::Green } else { [ConsoleColor]::Yellow })
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

if ($failCount -gt 0) {
  exit 1
} else {
  exit 0
}
