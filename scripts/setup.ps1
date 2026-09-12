[CmdletBinding()]
param(
  [switch]$SkipNpmInstall = $false,
  [switch]$ForceDownload = $false
)

$ErrorActionPreference = 'Stop'

# Resolve repository root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         SauraRoute Automated Local Setup              " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "[SauraRoute Setup] Repository Root: $repoRoot" -ForegroundColor Gray

# -------------------------------------------------------------------
# 1. Prerequisites Checks
# -------------------------------------------------------------------
Write-Host "`n[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js >= 20
try {
  $nodeVerRaw = (node -v 2>&1).ToString().Trim()
  if ($nodeVerRaw -match '^v?(\d+)\.') {
    $nodeMajor = [int]$Matches[1]
    if ($nodeMajor -lt 20) {
      throw "Node.js version $nodeVerRaw is below minimum required version >= 20.0.0."
    }
    Write-Host "  [OK] Node.js $nodeVerRaw detected" -ForegroundColor Green
  } else {
    throw "Unable to parse Node.js version output: $nodeVerRaw"
  }
} catch {
  Write-Host "  [ERROR] Node.js >= 20.0.0 is required." -ForegroundColor Red
  Write-Host "          Download and install from https://nodejs.org/" -ForegroundColor Red
  throw $_
}

# Check npm >= 9
try {
  $npmVerRaw = (npm -v 2>&1).ToString().Trim()
  Write-Host "  [OK] npm $npmVerRaw detected" -ForegroundColor Green
} catch {
  Write-Host "  [ERROR] npm is required but was not found on PATH." -ForegroundColor Red
  throw $_
}

# Check Java >= 17
function Test-JavaVersion {
  param([string]$Cmd)
  try {
    $out = cmd.exe /c "`"$Cmd`" -version 2>&1"
    $firstLine = ($out | Select-Object -First 1)
    if ($firstLine -match 'version "(\d+)\.') {
      $major = [int]$Matches[1]
      if ($major -ge 17) {
        return @{ Valid = $true; Line = $firstLine; Cmd = $Cmd }
      }
    }
  } catch { }
  return $null
}

$javaInfo = Test-JavaVersion 'java'
if (-not $javaInfo) {
  $candidatePaths = @()
  if ($env:JAVA_HOME) {
    $candidatePaths += Join-Path $env:JAVA_HOME 'bin\java.exe'
  }
  $searchPatterns = @(
    'C:\Program Files\Eclipse Adoptium\*17*\bin\java.exe',
    'C:\Program Files\Eclipse Adoptium\*21*\bin\java.exe',
    'C:\Program Files\Eclipse Adoptium\*\bin\java.exe',
    'C:\Program Files\Java\*17*\bin\java.exe',
    'C:\Program Files\Java\*21*\bin\java.exe',
    'C:\Program Files\Java\*\bin\java.exe',
    'C:\Program Files\Microsoft\*17*\bin\java.exe',
    'C:\Program Files\Microsoft\*21*\bin\java.exe',
    'C:\Program Files\Amazon Corretto\*17*\bin\java.exe',
    'C:\Program Files\Amazon Corretto\*21*\bin\java.exe',
    'C:\Program Files\Semeru\*17*\bin\java.exe',
    'C:\Program Files\Android\Android Studio\jbr\bin\java.exe'
  )
  foreach ($pat in $searchPatterns) {
    $found = Get-Item $pat -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    if ($found) { $candidatePaths += $found }
  }
  foreach ($cand in $candidatePaths) {
    $res = Test-JavaVersion $cand
    if ($res) {
      $javaInfo = $res
      break
    }
  }
}

if ($javaInfo) {
  Write-Host "  [OK] Java 17+ detected: $($javaInfo.Line) ($($javaInfo.Cmd))" -ForegroundColor Green
} else {
  Write-Host "  [ERROR] Java 17 or higher is required by GraphHopper 10.2." -ForegroundColor Red
  Write-Host "          Download Eclipse Adoptium Temurin 17 JDK from: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Red
  throw "Java 17+ is required but not found."
}

# Check Python (Optional / Recommended for ML)
$pythonCmd = $null
$pythonCandidateList = @('python', 'py', 'python3')
foreach ($pCmd in $pythonCandidateList) {
  try {
    $pyVerRaw = (cmd.exe /c "$pCmd --version 2>&1" | Select-Object -First 1).ToString().Trim()
    if ($pyVerRaw -match 'Python (\d+)\.(\d+)') {
      $pMajor = [int]$Matches[1]
      $pMinor = [int]$Matches[2]
      if ($pMajor -ge 3 -and $pMinor -ge 10) {
        $pythonCmd = $pCmd
        Write-Host "  [OK] Python $pyVerRaw detected ($pCmd)" -ForegroundColor Green
        break
      }
    }
  } catch { }
}

if (-not $pythonCmd) {
  Write-Host "  [INFO] Python >= 3.10 not detected on PATH." -ForegroundColor Yellow
  Write-Host "         (Note: Node.js API operates with high-accuracy in-process fallback for ML scoring when Python is omitted)." -ForegroundColor Gray
}

# -------------------------------------------------------------------
# 2. Directory & Configuration Setup
# -------------------------------------------------------------------
Write-Host "`n[2/5] Initializing project directories and environment..." -ForegroundColor Yellow

$rawDir = Join-Path $repoRoot 'data\raw'
$processedDir = Join-Path $repoRoot 'data\processed'

if (-not (Test-Path -LiteralPath $rawDir)) {
  New-Item -ItemType Directory -Path $rawDir | Out-Null
  Write-Host "  Created directory: data/raw" -ForegroundColor Green
} else {
  Write-Host "  [OK] Directory exists: data/raw" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath $processedDir)) {
  New-Item -ItemType Directory -Path $processedDir | Out-Null
  Write-Host "  Created directory: data/processed" -ForegroundColor Green
} else {
  Write-Host "  [OK] Directory exists: data/processed" -ForegroundColor Green
}

$envFile = Join-Path $repoRoot '.env'
$envExample = Join-Path $repoRoot '.env.example'

if (-not (Test-Path -LiteralPath $envFile)) {
  if (Test-Path -LiteralPath $envExample) {
    Copy-Item -Path $envExample -Destination $envFile
    Write-Host "  Copied .env.example -> .env" -ForegroundColor Green
  } else {
    Write-Host "  [WARNING] .env.example not found." -ForegroundColor Yellow
  }
} else {
  Write-Host "  [OK] Environment configuration file exists: .env" -ForegroundColor Green
}

# -------------------------------------------------------------------
# 3. GraphHopper & OpenStreetMap Data Asset Downloader
# -------------------------------------------------------------------
Write-Host "`n[3/5] Verifying runtime data assets..." -ForegroundColor Yellow

$jarPath = Join-Path $rawDir 'graphhopper-web-10.2.jar'
$jarUrl = 'https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/10.2/graphhopper-web-10.2.jar'
$jarMinSizeBytes = 35000000

$pbfPath = Join-Path $rawDir 'north-eastern-zone-latest.osm.pbf'
$pbfUrl = 'https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf'
$pbfMinSizeBytes = 15000000

function Download-FileWithRetry {
  param(
    [string]$Url,
    [string]$OutPath,
    [long]$MinSizeBytes,
    [string]$Description
  )

  $fileExists = Test-Path -LiteralPath $OutPath -PathType Leaf
  if ($fileExists -and -not $ForceDownload) {
    $item = Get-Item -LiteralPath $OutPath
    if ($item.Length -ge $MinSizeBytes) {
      Write-Host "  [OK] $Description already present and verified ($([Math]::Round($item.Length/1MB, 2)) MB)" -ForegroundColor Green
      return
    } else {
      Write-Host "  [WARNING] Existing $Description file size ($($item.Length) bytes) is below expected threshold ($MinSizeBytes bytes). Redownloading..." -ForegroundColor Yellow
    }
  }

  Write-Host "  Downloading $Description from $Url..." -ForegroundColor Cyan
  $webClient = New-Object System.Net.WebClient
  try {
    $webClient.DownloadFile($Url, $OutPath)
    $newItem = Get-Item -LiteralPath $OutPath
    if ($newItem.Length -lt $MinSizeBytes) {
      throw "Downloaded file $OutPath is incomplete ($($newItem.Length) bytes, expected >= $MinSizeBytes bytes)."
    }
    Write-Host "  [OK] Successfully downloaded $Description ($([Math]::Round($newItem.Length/1MB, 2)) MB)" -ForegroundColor Green
  } catch {
    if (Test-Path -LiteralPath $OutPath) {
      Remove-Item -LiteralPath $OutPath -Force -ErrorAction SilentlyContinue
    }
    throw "Failed to download $Description from $Url : $_"
  } finally {
    $webClient.Dispose()
  }
}

Download-FileWithRetry -Url $jarUrl -OutPath $jarPath -MinSizeBytes $jarMinSizeBytes -Description "GraphHopper 10.2 Web JAR"
Download-FileWithRetry -Url $pbfUrl -OutPath $pbfPath -MinSizeBytes $pbfMinSizeBytes -Description "OpenStreetMap NER Extract (.osm.pbf)"

# -------------------------------------------------------------------
# 4. Node.js & Python Dependencies Installation
# -------------------------------------------------------------------
Write-Host "`n[4/5] Installing package dependencies..." -ForegroundColor Yellow

if (-not $SkipNpmInstall) {
  # API Service dependencies
  $apiDir = Join-Path $repoRoot 'services\api'
  if (Test-Path -LiteralPath (Join-Path $apiDir 'package.json')) {
    Write-Host "  Installing Node.js dependencies for services/api..." -ForegroundColor Cyan
    Push-Location $apiDir
    try {
      cmd.exe /c "npm install"
      if ($LASTEXITCODE -ne 0) { throw "npm install failed in services/api" }
      Write-Host "  [OK] services/api dependencies installed" -ForegroundColor Green
    } finally {
      Pop-Location
    }
  }

  # Web Dashboard dependencies
  $webDir = Join-Path $repoRoot 'apps\web'
  if (Test-Path -LiteralPath (Join-Path $webDir 'package.json')) {
    Write-Host "  Installing Node.js dependencies for apps/web..." -ForegroundColor Cyan
    Push-Location $webDir
    try {
      cmd.exe /c "npm install"
      if ($LASTEXITCODE -ne 0) { throw "npm install failed in apps/web" }
      Write-Host "  [OK] apps/web dependencies installed" -ForegroundColor Green
    } finally {
      Pop-Location
    }
  }
} else {
  Write-Host "  [SKIPPED] npm install skipped by -SkipNpmInstall flag" -ForegroundColor Yellow
}

# Python ML Virtual Environment Setup (if Python present)
if ($pythonCmd) {
  $mlDir = Join-Path $repoRoot 'services\ml'
  $venvDir = Join-Path $mlDir 'venv'
  $reqPath = Join-Path $mlDir 'requirements.txt'

  if (Test-Path -LiteralPath $reqPath) {
    Write-Host "  Setting up Python ML virtual environment in services/ml/venv..." -ForegroundColor Cyan
    if (-not (Test-Path -LiteralPath $venvDir)) {
      cmd.exe /c "$pythonCmd -m venv `"$venvDir`""
    }
    $venvPython = Join-Path $venvDir 'Scripts\python.exe'
    if (Test-Path -LiteralPath $venvPython) {
      cmd.exe /c "`"$venvPython`" -m pip install --upgrade pip"
      cmd.exe /c "`"$venvPython`" -m pip install -r `"$reqPath`""
      Write-Host "  [OK] Python ML dependencies installed in services/ml/venv" -ForegroundColor Green
    }
  }
}

# -------------------------------------------------------------------
# 5. Completion Summary
# -------------------------------------------------------------------
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "     [SUCCESS] SauraRoute Local Setup Complete!        " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Next steps:" -ForegroundColor White
Write-Host "   1. Start services:  .\start.ps1   (or .\scripts\start.ps1)" -ForegroundColor Yellow
Write-Host "   2. Run healthcheck: .\check.ps1   (or .\scripts\check.ps1)" -ForegroundColor Yellow
Write-Host ""
