param([string]$OutputPath = "artifacts/frame-audit-20261028/live-chrome-diagnostic.json")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LifeLevelWindowProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle, out Rect rect);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr handle);
}
'@

$window = Get-Process chrome -ErrorAction Stop | Where-Object { $_.MainWindowTitle -like "*LIFE//LEVEL*" -or $_.MainWindowTitle -like "LLDIAG:*" } | Select-Object -First 1
if (-not $window) { throw "No LIFE//LEVEL Chrome window is open." }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($window.MainWindowHandle)
$descendants = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$address = $null
for ($index = 0; $index -lt $descendants.Count; $index++) {
  $element = $descendants.Item($index)
  if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit) { continue }
  $pattern = $null
  if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { continue }
  if ($pattern.Current.Value -match "^(https?://)?(127\.0\.0\.1|localhost)(:\d+)?") { $address = $element; break }
}
if (-not $address) { throw "Could not find the LIFE//LEVEL address bar." }
$addressPattern = $null
$address.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$addressPattern) | Out-Null
$urlBefore = $addressPattern.Current.Value
$previousTitle = $window.MainWindowTitle

$javascript = @'
(async()=>{
  const oldTitle=document.title;
  const round=n=>Math.round(n*100)/100;
  const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [round(r.x),round(r.y),round(r.width),round(r.height)];};
  const style=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return {display:c.display,bg:c.backgroundColor,padding:c.padding,font:c.fontSize,overflow:c.overflow};};
  const text=s=>{const e=document.querySelector(s);return e?e.textContent.trim().replace(/\s+/g,' ').slice(0,90):null;};
  const skill=[...document.querySelectorAll('.vref-skill-node')].slice(0,6).map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return [round(r.width),round(r.height),c.backgroundColor,c.backgroundImage.slice(0,80)];});
  const achievements=[...document.querySelectorAll('.vref-achievements .vref-achievement-row')].slice(0,3).map(e=>e.textContent.trim().replace(/\s+/g,' ').slice(0,85));
  const vv=window.visualViewport;
  const shell=document.querySelector('.game-shell');
  const overlay=document.querySelector('.reference-hud-overlay');
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const cssText=[...document.styleSheets].map(sheet=>{try{return [...sheet.cssRules].map(rule=>rule.cssText).join('')}catch{return sheet.href??''}}).join('');
  const assetUrls=['/assets/cyberpunk-bg.png','/lifelevel-frames/header.png','/lifelevel-frames/fluid/header-chassis.png','/lifelevel-frames/today.png','/lifelevel-frames/reactors/today_1.png','/lifelevel-frames/today-parts/top-middle.png','/lifelevel-frames/today-parts/middle-left.png','/assets/lobby-reference/reward-ref-headphones.png'];
  const assetHashes=Object.fromEntries(await Promise.all(assetUrls.map(async url=>[url,await digest(await (await fetch(url)).arrayBuffer())])));
  const data={
    at:new Date().toISOString(),href:location.href,path:location.pathname,
    inner:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],dpr:devicePixelRatio,
    visual:vv?{width:round(vv.width),height:round(vv.height),scale:round(vv.scale),offsetLeft:round(vv.offsetLeft),offsetTop:round(vv.offsetTop)}:null,
    screen:[screen.width,screen.height,screen.availWidth,screen.availHeight],
    media:{reference:matchMedia('(min-width:1760px) and (max-width:1840px) and (min-height:850px) and (max-height:920px)').matches,width1300:matchMedia('(max-width:1300px)').matches,height800:matchMedia('(max-height:800px)').matches,width1024:matchMedia('(max-width:1024px)').matches,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches},
    shell:shell?.className,sidebarMode:localStorage.getItem('lifelevel-sidebar-mode'),entered:localStorage.getItem('lifelevel-entered'),
    geometry:Object.fromEntries(Object.entries({sidebar:'.cyber-chrome-sidebar',main:'.main-shell',header:'.vref-header',today:'.vref-today',boss:'.vref-boss',ai:'.vref-butler',skills:'.vref-skill-preview',character:'.vref-character',achievements:'.vref-achievements',rewards:'.vref-rewards'}).map(([name,selector])=>[name,rect(selector)])),
    overlay:{display:overlay?getComputedStyle(overlay).display:null,images:overlay?.querySelectorAll('svg image').length??0,fluid:[...document.querySelectorAll('.fluid-mechanical-frame')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'}).length},
    frameGeometry:Object.fromEntries(['header','sidebar','today','skills','achievements'].map(name=>{const e=name==='header'?document.querySelector('.vref-header-led'):document.querySelector('.fluid-mechanical-frame[data-frame="'+name+'"]');if(!e)return[name,null];const r=e.getBoundingClientRect();const reactor=e.querySelector('.fluid-mechanical-frame__reactor')?.getBoundingClientRect();return[name,{box:[round(r.x),round(r.y),round(r.width),round(r.height)],reactor:reactor?[round(reactor.x+reactor.width/2),round(reactor.y+reactor.height/2),round(reactor.width),round(reactor.height)]:null}]})),
    skill,skillMap:style('.vref-skill-map'),achievementRows:achievements,achievementShowcase:[...document.querySelectorAll('.vref-achievement-showcase-row')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'}).length,achievementSummary:text('.vref-achievement-summary'),
    rewardImages:[...document.querySelectorAll('.vref-rewards img')].map(e=>[e.currentSrc.split('/').slice(-1)[0].slice(0,100),e.complete,e.naturalWidth,e.naturalHeight]),
    background:getComputedStyle(shell).backgroundImage.slice(0,170),serviceWorker:!!navigator.serviceWorker?.controller,
    cssCount:document.styleSheets.length,cacheResources:performance.getEntriesByType('resource').filter(e=>/\.(css|js)(\?|$)/.test(e.name)).length
  };
  data.sourceFingerprint={css:await digest(new TextEncoder().encode(cssText)),assets:assetHashes};
  try {
    const [auth,game]=await Promise.all([
      fetch('/api/auth',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/game',{cache:'no-store'}).then(r=>r.json())
    ]);
    const state=game.state;
    data.session={auth:{authenticated:auth.authenticated,accountId:auth.account?.userId??null,localMode:auth.localMode},game:{mode:game.mode,userId:state?.userId??null,revision:state?.revision??null,gold:state?.gold??null,tasks:state?.tasks?.length??null,achievements:state?.achievements?.length??null,completed:state?.achievements?.filter(a=>a.completedAt).length??null}};
    data.cacheKeys=await caches.keys();
    data.swScript=navigator.serviceWorker?.controller?.scriptURL??null;
  } catch(error) { data.sessionError=String(error).slice(0,120); }
  document.title='LLDIAG:'+JSON.stringify(data);
  setTimeout(()=>{document.title=oldTitle},30000);
})()
'@
$javascript = $javascript -replace "\r?\n\s*", ""

[LifeLevelWindowProbe]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
$address.SetFocus()
$addressPattern.SetValue("javascript:$javascript")
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
$title = $null
for ($attempt = 0; $attempt -lt 35; $attempt++) {
  Start-Sleep -Milliseconds 200
  $candidate = (Get-Process -Id $window.Id).MainWindowTitle
  if ($candidate.StartsWith("LLDIAG:") -and $candidate -ne $previousTitle) { $title = $candidate; break }
}
if (-not $title) { throw "The live Chrome tab did not execute the diagnostic bookmarklet." }
$json = $title.Substring(7) -replace " - Google Chrome$", ""
$browser = $json | ConvertFrom-Json
$windowRect = New-Object LifeLevelWindowProbe+Rect
[LifeLevelWindowProbe]::GetWindowRect($window.MainWindowHandle, [ref]$windowRect) | Out-Null
$dpi = [LifeLevelWindowProbe]::GetDpiForWindow($window.MainWindowHandle)
$displays = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{name=$_.DeviceName;primary=$_.Primary;bounds=@($_.Bounds.X,$_.Bounds.Y,$_.Bounds.Width,$_.Bounds.Height);working=@($_.WorkingArea.X,$_.WorkingArea.Y,$_.WorkingArea.Width,$_.WorkingArea.Height)} })
$result = [ordered]@{
  browser = $browser
  windows = [ordered]@{addressBar=$urlBefore;rect=@($windowRect.Left,$windowRect.Top,($windowRect.Right-$windowRect.Left),($windowRect.Bottom-$windowRect.Top));dpi=$dpi;displayScale=([math]::Round($dpi/96,3));displays=$displays}
}
$resolved = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolved)) | Out-Null
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resolved -Encoding utf8
$summary = [ordered]@{file=$resolved;url=$browser.href;inner=$browser.inner;dpr=$browser.dpr;visual=$browser.visual;displayScale=$result.windows.displayScale;media=$browser.media;sidebar=$browser.geometry.sidebar;header=$browser.geometry.header;overlay=$browser.overlay;serviceWorker=$browser.serviceWorker;session=$browser.session;cacheKeys=$browser.cacheKeys}
$summary | ConvertTo-Json -Depth 8 -Compress
