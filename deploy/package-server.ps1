param(
  [string]$OutputDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) '..\life-level-release')
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
if ($outputRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
    $outputRoot.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'The package output must be outside the source tree.'
}

$payload = @(
  'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json',
  'next-env.d.ts', 'postcss.config.mjs', 'drizzle.config.ts',
  'src', 'worker', 'drizzle', 'public', 'deploy', 'docs/DEPLOYMENT_HANDOFF.md'
)
foreach ($item in $payload) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $item))) { throw "Missing package input: $item" }
}
$sensitiveName = '(?i)(^|[\\/])\.env([.]|$)|\.(pem|key|pfx|p12|sqlite|sqlite3|db|kdbx)$|(^|[\\/])(id_rsa|id_ed25519|credentials\.json)$'
foreach ($directory in @('src', 'worker', 'drizzle', 'public', 'deploy')) {
  Get-ChildItem -LiteralPath (Join-Path $repoRoot $directory) -Recurse -Force | ForEach-Object {
    if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing symlink in package input: $($_.FullName)" }
    if (-not $_.PSIsContainer -and $_.FullName -match $sensitiveName) {
      throw "Refusing sensitive-looking filename in package input: $($_.FullName)"
    }
  }
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$archive = Join-Path $outputRoot "life-level-server-$version-$timestamp.tar.gz"
if (Test-Path -LiteralPath $archive) { throw "Package already exists: $archive" }
& tar.exe -czf $archive -C $repoRoot @payload
if ($LASTEXITCODE -ne 0) { throw "tar.exe failed with exit code $LASTEXITCODE" }
$members = @(& tar.exe -tzf $archive)
if ($LASTEXITCODE -ne 0) { throw "tar.exe could not inspect package: $archive" }
foreach ($member in $members) {
  $normalized = $member -replace '\\', '/'
  $top = $normalized.Split('/')[0]
  if ($top -notin @('package.json','package-lock.json','next.config.ts','tsconfig.json',
      'next-env.d.ts','postcss.config.mjs','drizzle.config.ts','src','worker','drizzle','public','deploy','docs')) {
    throw "Unexpected package member: $member"
  }
  if ($normalized -match $sensitiveName -or $normalized -match '(^|/)(node_modules|desktop|\.local-data|\.next)(/|$)') {
    throw "Sensitive or non-server package member: $member"
  }
  if ($top -eq 'docs' -and $normalized -ne 'docs/DEPLOYMENT_HANDOFF.md') {
    throw "Unexpected documentation package member: $member"
  }
}
$digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$sidecar = "$archive.sha256"
"$digest  $(Split-Path $archive -Leaf)" | Set-Content -LiteralPath $sidecar -Encoding ascii
Write-Output "PACKAGE=$archive"
Write-Output "SHA256=$digest"
Write-Output "CHECKSUM_FILE=$sidecar"
