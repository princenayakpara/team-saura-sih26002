# SauraRoute Setup Launcher
[CmdletBinding()]
param(
  [switch]$SkipNpmInstall = $false,
  [switch]$ForceDownload = $false
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$setupScript = Join-Path $scriptDir "scripts\setup.ps1"

& $setupScript -SkipNpmInstall:$SkipNpmInstall -ForceDownload:$ForceDownload
