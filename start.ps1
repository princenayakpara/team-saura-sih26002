# SauraRoute Start Launcher
[CmdletBinding()]
param(
  [switch]$Background = $false,
  [switch]$NoWeb = $false,
  [int]$HeapGiB = 4
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$startScript = Join-Path $scriptDir "scripts\start.ps1"

& $startScript -Background:$Background -NoWeb:$NoWeb -HeapGiB:$HeapGiB
