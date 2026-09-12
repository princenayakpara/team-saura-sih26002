# SauraRoute Health Check Launcher
[CmdletBinding()]
param(
  [int]$TimeoutSeconds = 3
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$checkScript = Join-Path $scriptDir "scripts\check.ps1"

& $checkScript -TimeoutSeconds $TimeoutSeconds
