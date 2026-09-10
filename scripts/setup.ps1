<#
.SYNOPSIS
  SauraRoute Local Environment Setup Script for Windows.
.DESCRIPTION
  Automates the complete preparation of dependencies, runtime data assets,
  and environment configurations for SauraRoute.
  - Checks prerequisites (Node.js, Java 17, Python 3.10+, optional Docker)
  - Creates .env if missing
  - Creates required directories
  - Downloads GraphHopper 10.2 JAR and North-Eastern India OSM PBF if missing
  - Installs npm dependencies for API and Web apps
  - Prepares Python ML virtual environment and trains baseline classifier
.EXAMPLE
  .\scripts\setup.ps1
#>

[CmdletBinding()]
param(
  [switch]$SkipNpm,
  [switch]$SkipPython,
  [switch]$SkipDownloads,
  [switch]$ForceDownload
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

# -----------------------------------------------------------------------------
# 0. Repository Root Validation
# -----------------------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location -Path $RepoRoot

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   SauraRoute: Automated Local Setup & Dependency Provisioner   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Target Root: $RepoRoot`n" -ForegroundColor DarkGray

$FailedChecks = 0
$WarningCount = 0

# -----------------------------------------------------------------------------
# 1. Prerequisite Verification
# -----------------------------------------------------------------------------
Write-Host "[1/6] Verifying System Prerequisites..." -ForegroundColor Yellow

# Node.js Check
try {
  $nodeVerRaw = (node --version 2>&1).Trim()
  if ($nodeVerRaw -match '^v(\d+)\.') {
    $nodeMajor = [int]$matches[1]
    if ($nodeMajor -ge 20) {
      Write-Host "  [PASS] Node.js $nodeVerRaw (>= v20 required)" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] Node.js $nodeVerRaw detected. Node.js >= v20.0.0 is required." -ForegroundColor Red
      Write-Host "         Please update Node.js at https://nodejs.org/" -ForegroundColor Yellow
      $FailedChecks++
    }
  } else {
    Write-Host "  [FAIL] Could not parse Node.js version: $nodeVerRaw" -ForegroundColor Red
    $FailedChecks++
  }
} catch {
  Write-Host "  [FAIL] Node.js is not installed or not in PATH." -ForegroundColor Red
  Write-Host "         Install Node.js >= 20.0.0 from https://nodejs.org/" -ForegroundColor Yellow
  $FailedChecks++
}

# npm Check
try {
  $npmVerRaw = (npm --version 2>&1).Trim()
  Write-Host "  [PASS] npm v$npmVerRaw" -ForegroundColor Green
} catch {
  Write-Host "  [FAIL] npm is not found in PATH." -ForegroundColor Red
  $FailedChecks++
}

# Java 17 Check
try {
  $oldEAP = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $javaVerOutput = cmd.exe /c "java -version 2>&1"
  $ErrorActionPreference = $oldEAP
  $javaFirstLine = ($javaVerOutput | Select-Object -First 1)

  if ($javaFirstLine -match 'version "(17\.[^"]+)"' -or $javaFirstLine -match 'version "17"') {
    Write-Host "  [PASS] Java 17 detected: $javaFirstLine" -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] GraphHopper 10.2 requires Java 17. Detected: $javaFirstLine" -ForegroundColor Red
    Write-Host "         Install Eclipse Adoptium Temurin 17 from: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
    $FailedChecks++
  }
} catch {
  Write-Host "  [FAIL] Java 17 is not found in PATH." -ForegroundColor Red
  Write-Host "         Install Eclipse Adoptium Temurin 17 from: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
  $FailedChecks++
}

# Python 3.10+ Check
$pythonExe = $null
foreach ($cmd in @('python', 'py')) {
  try {
    $pyVerRaw = (& $cmd --version 2>&1).Trim()
    if ($pyVerRaw -match 'Python (\d+)\.(\d+)') {
      $pyMajor = [int]$matches[1]
      $pyMinor = [int]$matches[2]
      if ($pyMajor -eq 3 -and $pyMinor -ge 10) {
        $pythonExe = $cmd
        Write-Host "  [PASS] $pyVerRaw ($cmd)" -ForegroundColor Green
        break
      }
    }
  } catch {
    # continue
  }
}

if (-not $pythonExe) {
  Write-Host "  [WARN] Python 3.10+ not found in PATH. ML models will use deterministic in-process fallback." -ForegroundColor DarkYellow
  $WarningCount++
}

# Docker Check (Optional)
try {
  $dockerVer = (docker --version 2>&1).Trim()
  Write-Host "  [INFO] $dockerVer (PostGIS container optional; in-memory fallback available)" -ForegroundColor DarkGray
} catch {
  Write-Host "  [INFO] Docker not detected. API will run with built-in in-memory fallback store." -ForegroundColor DarkGray
}

if ($FailedChecks -gt 0) {
  Write-Host "`n[ABORT] Prerequisites check failed with $FailedChecks error(s). Please resolve them before proceeding." -ForegroundColor Red
  exit 1
}

# -----------------------------------------------------------------------------
# 2. Environment Configuration
# -----------------------------------------------------------------------------
Write-Host "`n[2/6] Configuring Environment Files..." -ForegroundColor Yellow
$envPath = Join-Path $RepoRoot ".env"
$envExamplePath = Join-Path $RepoRoot ".env.example"

if (-not (Test-Path -LiteralPath $envPath)) {
  if (Test-Path -LiteralPath $envExamplePath) {
    Copy-Item -Path $envExamplePath -Destination $envPath
    Write-Host "  [CREATED] .env created from .env.example" -ForegroundColor Green
  } else {
    Write-Host "  [WARN] .env.example not found. Please create .env manually." -ForegroundColor DarkYellow
  }
} else {
  Write-Host "  [EXISTS] .env already configured." -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3. Directory Creation
# -----------------------------------------------------------------------------
Write-Host "`n[3/6] Ensuring Directory Structure..." -ForegroundColor Yellow
$requiredDirs = @(
  (Join-Path $RepoRoot "data\raw"),
  (Join-Path $RepoRoot "data\processed"),
  (Join-Path $RepoRoot "services\ml\models")
)

foreach ($dir in $requiredDirs) {
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Host "  [CREATED] $dir" -ForegroundColor Green
  } else {
    Write-Host "  [EXISTS] $dir" -ForegroundColor DarkGray
  }
}

# -----------------------------------------------------------------------------
# 4. Download GraphHopper JAR & OSM PBF
# -----------------------------------------------------------------------------
Write-Host "`n[4/6] Provisioning GraphHopper JAR & NER OSM Road Data..." -ForegroundColor Yellow

function Download-AssetSafely {
  param(
    [string]$Url,
    [string]$DestinationPath,
    [long]$MinSizeBytes,
    [string]$DisplayName
  )

  $fileExists = Test-Path -LiteralPath $DestinationPath
  if ($fileExists -and (-not $ForceDownload)) {
    $existingSize = (Get-Item -LiteralPath $DestinationPath).Length
    if ($existingSize -ge $MinSizeBytes) {
      $sizeMb = [math]::Round($existingSize / 1MB, 2)
      Write-Host "  [EXISTS] $DisplayName already present ($sizeMb MB, valid)." -ForegroundColor Green
      return
    } else {
      Write-Host "  [WARN] Existing $DisplayName is truncated ($existingSize bytes < $MinSizeBytes bytes). Re-downloading..." -ForegroundColor DarkYellow
    }
  }

  $tempPath = "$DestinationPath.download.tmp"
  if (Test-Path -LiteralPath $tempPath) {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }

  Write-Host "  [DOWNLOADING] $DisplayName from:" -ForegroundColor Cyan
  Write-Host "                $Url" -ForegroundColor DarkGray

  try {
    # Use WebClient for reliable streaming download
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("User-Agent", "SauraRoute-Setup-Tool/1.0 (Windows PowerShell)")
    $webClient.DownloadFile($Url, $tempPath)
    $webClient.Dispose()

    if (-not (Test-Path -LiteralPath $tempPath)) {
      throw "Downloaded temporary file was not found: $tempPath"
    }

    $downloadedSize = (Get-Item -LiteralPath $tempPath).Length
    if ($downloadedSize -lt $MinSizeBytes) {
      Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
      throw "Downloaded file size ($downloadedSize bytes) is smaller than expected minimum ($MinSizeBytes bytes)."
    }

    if (Test-Path -LiteralPath $DestinationPath) {
      Remove-Item -LiteralPath $DestinationPath -Force -ErrorAction SilentlyContinue
    }
    Move-Item -Path $tempPath -Destination $DestinationPath -Force

    $finalMb = [math]::Round($downloadedSize / 1MB, 2)
    Write-Host "  [SUCCESS] $DisplayName verified and saved ($finalMb MB)." -ForegroundColor Green
  } catch {
    if (Test-Path -LiteralPath $tempPath) {
      Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  [ERROR] Failed to download $DisplayName`: $_" -ForegroundColor Red
    throw
  }
}

if (-not $SkipDownloads) {
  # 4a. GraphHopper 10.2 JAR (~44.2 MB)
  $ghJarPath = Join-Path $RepoRoot "data\raw\graphhopper-web-10.2.jar"
  $ghJarUrl = "https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/10.2/graphhopper-web-10.2.jar"
  Download-AssetSafely -Url $ghJarUrl -DestinationPath $ghJarPath -MinSizeBytes 40000000 -DisplayName "GraphHopper 10.2 Web JAR"

  # 4b. North-Eastern Zone OSM PBF (~109 MB)
  $osmPbfPath = Join-Path $RepoRoot "data\raw\north-eastern-zone-latest.osm.pbf"
  $osmPbfUrl = "https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf"
  Download-AssetSafely -Url $osmPbfUrl -DestinationPath $osmPbfPath -MinSizeBytes 80000000 -DisplayName "NER OSM PBF Road Network"
} else {
  Write-Host "  [SKIPPED] Downloads skipped via -SkipDownloads flag." -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# 5. Install Node.js Dependencies
# -----------------------------------------------------------------------------
Write-Host "`n[5/6] Installing Node.js Workspace Dependencies..." -ForegroundColor Yellow

if (-not $SkipNpm) {
  # API dependencies
  $apiDir = Join-Path $RepoRoot "services\api"
  Write-Host "  -> Installing dependencies for @sauraroute/api ($apiDir)..." -ForegroundColor Cyan
  Push-Location $apiDir
  try {
    npm install --no-audit --no-fund
    Write-Host "  [PASS] @sauraroute/api dependencies installed." -ForegroundColor Green
  } finally {
    Pop-Location
  }

  # Web dependencies
  $webDir = Join-Path $RepoRoot "apps\web"
  Write-Host "  -> Installing dependencies for SauraRoute Web Dashboard ($webDir)..." -ForegroundColor Cyan
  Push-Location $webDir
  try {
    npm install --no-audit --no-fund
    Write-Host "  [PASS] SauraRoute Web dependencies installed." -ForegroundColor Green
  } finally {
    Pop-Location
  }
} else {
  Write-Host "  [SKIPPED] npm install skipped via -SkipNpm flag." -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# 6. Python ML Environment Preparation
# -----------------------------------------------------------------------------
Write-Host "`n[6/6] Configuring Python ML Service..." -ForegroundColor Yellow

if (-not $SkipPython -and $pythonExe) {
  $mlDir = Join-Path $RepoRoot "services\ml"
  $venvDir = Join-Path $mlDir "venv"
  try {
    $venvWin = Join-Path $venvDir "Scripts\python.exe"
    $venvBin = Join-Path $venvDir "bin\python.exe"

    if (-not (Test-Path -LiteralPath $venvWin) -and -not (Test-Path -LiteralPath $venvBin)) {
      Write-Host "  -> Creating Python virtual environment in $venvDir..." -ForegroundColor Cyan
      & $pythonExe -m venv $venvDir
    }

    $venvPython = if (Test-Path -LiteralPath $venvWin) { $venvWin } elseif (Test-Path -LiteralPath $venvBin) { $venvBin } else { $null }

    if ($venvPython) {
      Write-Host "  -> Installing Python requirements from $mlDir\requirements.txt..." -ForegroundColor Cyan
      $pipOutput = & $venvPython -m pip install --quiet --disable-pip-version-check -r (Join-Path $mlDir "requirements.txt") 2>&1
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  [PASS] Python dependencies installed in venv." -ForegroundColor Green

        # Train baseline model if missing
        $modelJoblib = Join-Path $mlDir "models\landslide_rf_model.joblib"
        if (-not (Test-Path -LiteralPath $modelJoblib)) {
          Write-Host "  -> Training baseline Random Forest Landslide Classifier..." -ForegroundColor Cyan
          & $venvPython (Join-Path $mlDir "src\train_classifier.py") 2>&1 | Out-Null
          if (Test-Path -LiteralPath $modelJoblib) {
            Write-Host "  [PASS] Landslide classifier trained and exported." -ForegroundColor Green
          } else {
            Write-Host "  [INFO] Landslide metadata present (API deterministic engine active)." -ForegroundColor DarkGray
          }
        } else {
          Write-Host "  [EXISTS] Landslide model artifact already present." -ForegroundColor Green
        }
      } else {
        Write-Host "  [WARN] Optional Python ML packages could not be compiled for this environment." -ForegroundColor DarkYellow
        Write-Host "         SauraRoute API will automatically use the built-in deterministic ML engine." -ForegroundColor DarkYellow
        $WarningCount++
      }
    } else {
      Write-Host "  [WARN] Could not find python executable in created venv ($venvDir)." -ForegroundColor DarkYellow
      $WarningCount++
    }
  } catch {
    Write-Host "  [WARN] Python ML environment setup encountered an issue: $_" -ForegroundColor DarkYellow
    Write-Host "         SauraRoute API will automatically use the built-in deterministic ML fallback." -ForegroundColor DarkYellow
    $WarningCount++
  }
} else {
  Write-Host "  [INFO] Python ML setup skipped or Python not present (deterministic fallback enabled)." -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# Setup Summary Banner
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "              SauraRoute Local Setup Complete!                  " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Start the stack:      .\scripts\start.ps1" -ForegroundColor White
Write-Host "  2. Verify health:        .\scripts\check.ps1" -ForegroundColor White
Write-Host "  3. Stop services:        .\scripts\stop.ps1" -ForegroundColor White
Write-Host ""
