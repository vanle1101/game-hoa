# PowerShell helper for the owner's LOCAL LIFE//LEVEL working tree.
# Copies reusable assets and components only; it DOES NOT patch app pages or deploy.
# Example: .\install_assets.ps1 -ProjectRoot 'E:\Game hoa cuoc song'
param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
if (!(Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) {
  throw "No package.json at project root: $ProjectRoot"
}
$destAssets = Join-Path $ProjectRoot 'public\lifelevel-frames'
$destComponents = Join-Path $ProjectRoot 'src\components\lifelevel-reference-frame'
if ((Test-Path -LiteralPath $destAssets) -or (Test-Path -LiteralPath $destComponents)) {
  throw 'Target folder already exists. Aborting to avoid overwriting existing code/assets.'
}
New-Item -ItemType Directory -Path $destAssets -Force | Out-Null
New-Item -ItemType Directory -Path $destComponents -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $source 'assets') -File -Filter '*.png' | Copy-Item -Destination $destAssets
New-Item -ItemType Directory -Path (Join-Path $destAssets 'reactors') -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $source 'assets\reactors') -File -Filter '*.png' | Copy-Item -Destination (Join-Path $destAssets 'reactors')
Get-ChildItem -LiteralPath (Join-Path $source 'react') -File | Copy-Item -Destination $destComponents
Write-Host 'Copied frame assets and React source. Existing application pages were not changed.'
Write-Host 'Next: hand CODEX_TASK.md and reference.png to Codex to integrate and compare screenshots.'
