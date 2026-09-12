[CmdletBinding()]
param(
  [string]$JavaCommand = 'java',
  [string]$JarPath = 'data/raw/graphhopper-web-10.2.jar',
  [string]$PbfPath = 'data/raw/north-eastern-zone-latest.osm.pbf',
  [string]$ConfigPath = 'services/routing/graphhopper.yml',
  [int]$HeapGiB = 4
)

if ($HeapGiB -lt 1) {
  throw 'HeapGiB must be at least 1.'
}

# Resolve repo root (this script is in services/routing/, repo root is two levels up)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path

# Helper to test if an executable is Java 17 or higher
function Test-IsJava17 {
  param([string]$Cmd)
  try {
    $out = cmd.exe /c "`"$Cmd`" -version 2>&1"
    $firstLine = ($out | Select-Object -First 1)
    if ($firstLine -match 'version "(\d+)\.') {
      $major = [int]$Matches[1]
      if ($major -ge 17) {
        return $firstLine
      }
    }
  } catch { }
  return $null
}

# Auto-detect Java 17+ if default 'java' is not on PATH or not version 17+
$resolvedJava = $JavaCommand
$detectedVersion = Test-IsJava17 $resolvedJava

if (-not $detectedVersion -and $JavaCommand -eq 'java') {
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
    $ver = Test-IsJava17 $cand
    if ($ver) {
      $resolvedJava = $cand
      $detectedVersion = $ver
      Write-Host "[SauraRoute Routing] Auto-detected Java 17+ at: $cand" -ForegroundColor Green
      break
    }
  }
}

if (-not $detectedVersion) {
  Write-Host "[SauraRoute Routing] ERROR: Java 17 was not found." -ForegroundColor Red
  Write-Host "  GraphHopper 10.2 requires Java 17 (Eclipse Adoptium Temurin 17 recommended)." -ForegroundColor Yellow
  Write-Host "  Download: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
  Write-Host "  Alternatively, provide -JavaCommand 'path\to\java.exe'" -ForegroundColor Yellow
  throw "Java 17 is required but not found. Please install OpenJDK 17 or provide -JavaCommand."
}

# Resolve paths relative to repo root if they are relative
function Resolve-RepoPath {
  param([string]$Path, [string]$Root)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return Join-Path $Root $Path
}

$resolvedJar = Resolve-RepoPath $JarPath $repoRoot
$resolvedPbf = Resolve-RepoPath $PbfPath $repoRoot
$resolvedConfig = Resolve-RepoPath $ConfigPath $repoRoot

$missingFiles = @()
if (-not (Test-Path -LiteralPath $resolvedJar -PathType Leaf)) {
  $missingFiles += "GraphHopper JAR missing: $resolvedJar`n    Download: https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/10.2/graphhopper-web-10.2.jar`n    Or run: .\scripts\setup.ps1"
}
if (-not (Test-Path -LiteralPath $resolvedPbf -PathType Leaf)) {
  $missingFiles += "NER OSM extract missing: $resolvedPbf`n    Download: https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf`n    Or run: .\scripts\setup.ps1"
}
if (-not (Test-Path -LiteralPath $resolvedConfig -PathType Leaf)) {
  $missingFiles += "Configuration file missing: $resolvedConfig"
}

if ($missingFiles.Count -gt 0) {
  Write-Host "[SauraRoute Routing] ERROR: Missing required data/config files:" -ForegroundColor Red
  foreach ($mf in $missingFiles) {
    Write-Host "  - $mf" -ForegroundColor Yellow
  }
  throw "Required files missing. Run .\scripts\setup.ps1 or download manually."
}

if (Get-NetTCPConnection -State Listen -LocalPort 8989 -ErrorAction SilentlyContinue) {
  throw 'Port 8989 is already in use. Stop the existing service before starting GraphHopper.'
}

Write-Host "[SauraRoute Routing] $detectedVersion"
Write-Host "[SauraRoute Routing] PBF: $resolvedPbf"
Write-Host "[SauraRoute Routing] Starting GraphHopper 10.2 on http://localhost:8989"

Push-Location $repoRoot
try {
  & $resolvedJava "-Xms$($HeapGiB)g" "-Xmx$($HeapGiB)g" -jar $resolvedJar server $resolvedConfig
} finally {
  Pop-Location
}
