param(
  [string]$Url = "http://127.0.0.1:3333/"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"
$node = (Get-Command node.exe -ErrorAction Stop).Source
$logRoot = Join-Path $env:LOCALAPPDATA "LIFELEVEL\logs"
$stdoutLog = Join-Path $logRoot "next-dev.out.log"
$stderrLog = Join-Path $logRoot "next-dev.err.log"
$mutex = [Threading.Mutex]::new($false, "Local\LIFELEVEL-NextDev-3333")

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
if (-not $mutex.WaitOne(0)) {
  exit 0
}

function Test-LifeLevelReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3333/api/health/live" -TimeoutSec 3 -UseBasicParsing
    return $response.StatusCode -eq 200 -and $response.Content.Contains('"status":"live"')
  } catch {
    return $false
  }
}

function Get-LifeLevelListener {
  return Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Start-LifeLevelServer {
  $arguments = '"{0}" dev --webpack --hostname 127.0.0.1 --port 3333' -f $nextCli
  return Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
}

$serverProcess = $null
$browserOpened = $false
$readyWait = 0

try {
  while ($true) {
    if (Test-LifeLevelReady) {
      if (-not $browserOpened) {
        Start-Process $Url | Out-Null
        $browserOpened = $true
      }
      if ($null -ne $serverProcess -and $serverProcess.HasExited) {
        $serverProcess = $null
        $readyWait = 0
      }
      Start-Sleep -Seconds 10
      continue
    }

    if ($null -ne $serverProcess -and $serverProcess.HasExited) {
      $serverProcess = $null
      $readyWait = 0
    }

    if ($null -eq $serverProcess) {
      if ($null -ne (Get-LifeLevelListener)) {
        # Leave another process alone if it already owns the requested port.
        Start-Sleep -Seconds 10
        continue
      }
      $serverProcess = Start-LifeLevelServer
      $readyWait = 0
    }

    Start-Sleep -Seconds 2
    $readyWait += 2
    if ($readyWait -ge 240 -and -not (Test-LifeLevelReady)) {
      if (-not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
      }
      $serverProcess = $null
      $readyWait = 0
      Start-Sleep -Seconds 5
    }
  }
} finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
