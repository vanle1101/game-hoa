param([string]$OutputPath = "artifacts/frame-audit-20261028/live-chrome-before-1920x919.png")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LifeLevelCaptureWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@
$window = Get-Process chrome -ErrorAction Stop | Where-Object { $_.MainWindowTitle -like "*LIFE//LEVEL*" -or $_.MainWindowTitle -like "LLDIAG:*" } | Select-Object -First 1
if (-not $window) { throw "No LIFE//LEVEL Chrome window is open." }
[LifeLevelCaptureWindow]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 300
if ([LifeLevelCaptureWindow]::GetForegroundWindow() -ne $window.MainWindowHandle) { throw "Chrome is not the foreground window; capture would be unreliable." }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($window.MainWindowHandle)
$documents = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Document))
$rect = $null
for ($index = 0; $index -lt $documents.Count; $index++) {
  $candidate = $documents.Item($index).Current.BoundingRectangle
  if ($candidate.Width -ge 1000 -and $candidate.Height -ge 500) { $rect = $candidate; break }
}
if (-not $rect) { throw "No visible Chrome document rectangle found." }
$x = [int][math]::Round($rect.X)
$y = [int][math]::Round($rect.Y)
$width = [int][math]::Round($rect.Width)
$height = [int][math]::Round($rect.Height)
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.CopyFromScreen($x, $y, 0, 0, [System.Drawing.Size]::new($width, $height))
  $resolved = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolved)) | Out-Null
  $bitmap.Save($resolved, [System.Drawing.Imaging.ImageFormat]::Png)
  [ordered]@{file=$resolved;documentScreenRect=@($x,$y,$width,$height);chromePid=$window.Id;sha256=(Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.Substring(0,16)} | ConvertTo-Json -Compress
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
