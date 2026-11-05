/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only capture of the current production preview. No game actions or API mutations.
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'evidence/v21.1');
const base = process.env.V21_QA_BASE_URL || 'http://127.0.0.1:3336';
const label = (process.env.V21_QA_LABEL || 'baseline').replace(/[^a-z0-9-]/gi, '').toLowerCase();
const includeCloseups = process.env.V21_QA_CLOSEUPS === '1';
const includeHomeCloseups = process.env.V21_QA_HOME_CLOSEUPS === '1';
const homeFocus = process.env.V21_QA_HOME_FOCUS;
const fixture = process.env.V21_QA_HOME_FIXTURE;
const savePath = path.join(root, '.local-data/local-player.json');
const saveHash = () => fs.existsSync(savePath)
  ? createHash('sha256').update(fs.readFileSync(savePath)).digest('hex')
  : null;

fs.mkdirSync(out, { recursive: true });

async function capture(page, route, name) {
  const diagnostics = { route, pageErrors: [], consoleErrors: [], failedRequests: [], badResponses: [], assetResponses: [] };
  page.on('pageerror', e => diagnostics.pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') diagnostics.consoleErrors.push(m.text()); });
  page.on('requestfailed', r => diagnostics.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
  page.on('response', r => {
    if (r.status() >= 400) diagnostics.badResponses.push({ status: r.status(), url: r.url() });
    if (/\.(?:glb|gltf|png|jpe?g|webp)(?:[?#]|$)/i.test(r.url()))
      diagnostics.assetResponses.push({ status: r.status(), url: r.url() });
  });
  const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  diagnostics.httpStatus = response?.status() ?? null;
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(12000);
  diagnostics.webgl = await page.locator('canvas').first().evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return {
      canvasWidth: canvas.width, canvasHeight: canvas.height,
      clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight,
      contextAvailable: Boolean(gl), contextLost: gl?.isContextLost() ?? null,
      cameraMode: canvas.dataset.cameraMode ?? null,
    };
  });
  diagnostics.loadingText = await page.getByText(/Đang khởi tạo WebGL|Đang tải|Không thể khởi tạo 3D/).allTextContents();
  diagnostics.slowLoadOverlayVisible = await page.locator('.v18-slow-load').isVisible().catch(() => false);
  diagnostics.visibleFallback = await page.locator('.world-fallback:visible').count();
  diagnostics.title = await page.title();
  await page.screenshot({ path: path.join(out, name), fullPage: false, animations: 'disabled' });
  return diagnostics;
}

(async () => {
  const beforeHash = saveHash();
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    // This browser-only flag closes the first-run guide without invoking its
    // action or mutating the player's residence, inventory, or save.
    await context.addInitScript(() => localStorage.setItem('lifelevel-entered', 'true'));
    const home = await context.newPage();
    const showcase = await context.newPage();
    const result = {
      captureTime: new Date().toISOString(),
      base,
      home: await capture(home, fixture ? `/?visualFixture=${encodeURIComponent(fixture)}` : '/', `home-${label}.png`),
    };
    if (homeFocus && ['bed', 'sofa', 'desk', 'kitchen', 'window'].includes(homeFocus)) {
      if (!fixture) await home.getByRole('button', { name: 'Tự do', exact: true }).click();
      await home.evaluate(name => window.dispatchEvent(new CustomEvent('life-level:showcase-focus', { detail: { focus: name } })), homeFocus);
      await home.waitForTimeout(2500);
      try {
        await home.screenshot({ path: path.join(out, `home-${homeFocus}-${label}.png`), fullPage: false, animations: 'disabled', timeout: 15000 });
        result.homeFocus = homeFocus;
      } catch (error) { result.homeFocusError = String(error); }
    }
    if (fixture && includeHomeCloseups) {
      result.homeFixtureCloseups = {};
      for (const focus of ['bed', 'sofa', 'desk', 'kitchen', 'window']) {
        await home.evaluate(name => window.dispatchEvent(new CustomEvent('life-level:showcase-focus', { detail: { focus: name } })), focus);
        await home.waitForTimeout(2500);
        await home.screenshot({ path: path.join(out, `home-${focus}-${label}.png`), fullPage: false, animations: 'disabled' });
        result.homeFixtureCloseups[focus] = true;
      }
    }
    result.showcase = await capture(showcase, '/showcase/apartment-v18', `showcase-${label}.png`);
    if (includeCloseups) {
      result.closeups = {};
      for (const [name, button] of [['bed', 'Giường'], ['sofa', 'Sofa'], ['desk', 'Bàn làm việc'], ['kitchen', 'Bếp'], ['window', 'Panorama']]) {
        await showcase.getByRole('button', { name: button, exact: true }).click();
        await showcase.waitForTimeout(2500);
        try {
          await showcase.screenshot({ path: path.join(out, `${name}-${label}.png`), fullPage: false, animations: 'disabled', timeout: 15000 });
          result.closeups[name] = { canvasMode: await showcase.locator('canvas').first().getAttribute('data-camera-mode') };
        } catch (error) { result.closeups[name] = { error: String(error) }; }
      }
    }
    result.saveUnchanged = beforeHash === saveHash();
    fs.writeFileSync(path.join(out, `browser-${label}.json`), JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify({
      homeStatus: result.home.httpStatus,
      homeWebGL: result.home.webgl,
      showcaseStatus: result.showcase.httpStatus,
      showcaseWebGL: result.showcase.webgl,
      saveUnchanged: result.saveUnchanged,
      diagnostics: path.join(out, `browser-${label}.json`),
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
