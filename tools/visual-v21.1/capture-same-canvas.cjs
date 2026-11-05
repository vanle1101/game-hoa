/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only QA: the same developed plan through Home and Showcase at an
// identical 1280 x 720 WebGL canvas size and the shared benchmark camera.
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'evidence/v21.1');
const base = process.env.V21_QA_BASE_URL || 'http://127.0.0.1:3336';
const save = path.join(root, '.local-data/local-player.json');
const hash = () => fs.existsSync(save) ? createHash('sha256').update(fs.readFileSync(save)).digest('hex') : null;

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const before = hash();
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const report = { base, captureTime: new Date().toISOString(), captures: {}, saveUnchanged: false };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('lifelevel-entered', 'true'));
    for (const [name, route] of [['home', '/?visualFixture=developed'], ['showcase', '/showcase/apartment-v18']]) {
      const page = await context.newPage();
      const diagnostics = { route, pageErrors: [], consoleErrors: [], badResponses: [], assets: [] };
      page.on('pageerror', error => diagnostics.pageErrors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
      page.on('response', response => {
        const url = response.url();
        if (response.status() >= 400) diagnostics.badResponses.push({ status: response.status(), url });
        if (/\.(?:glb|gltf|png|jpe?g|webp)(?:[?#]|$)/i.test(url)) diagnostics.assets.push(new URL(url).pathname);
      });
      const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
      diagnostics.httpStatus = response?.status() ?? null;
      const canvas = page.locator(name === 'home' ? '.world-canvas canvas' : '.v18-canvas canvas').first();
      await canvas.waitFor({ state: 'visible', timeout: 45000 });
      if (name === 'home') {
        await page.waitForTimeout(7000);
        // CSS shell width and the canvas may settle after client hydration.
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
          if (current.width === 1280 && current.height === 720) break;
          const viewport = page.viewportSize();
          await page.setViewportSize({ width: viewport.width + 1280 - current.width, height: viewport.height + 720 - current.height });
          await page.waitForTimeout(1200);
        }
      }
      await page.waitForTimeout(16000);
      // Home's fixture chooses the benchmark through the shared controller.
      // Reapply here to remove any timing difference from a cold mount.
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('life-level:showcase-focus', { detail: { focus: 'benchmark' } })));
      await page.waitForTimeout(3000);
      diagnostics.webgl = await canvas.evaluate(element => {
        const gl = element.getContext('webgl2') || element.getContext('webgl');
        return { width: element.clientWidth, height: element.clientHeight, contextAvailable: Boolean(gl), contextLost: gl?.isContextLost() ?? null, cameraMode: element.dataset.cameraMode ?? null };
      });
      diagnostics.assets = [...new Set(diagnostics.assets)].sort();
      diagnostics.slowOverlayVisible = await page.locator('.v18-slow-load').isVisible().catch(() => false);
      if (diagnostics.webgl.width !== 1280 || diagnostics.webgl.height !== 720) throw new Error(`${name} canvas is ${diagnostics.webgl.width} x ${diagnostics.webgl.height}`);
      // Element screenshots still include composited HTML above the canvas.
      // Hide only QA overlays, leaving the renderer, state and camera intact.
      await page.addStyleTag({ content: name === 'home'
        ? '.world-main > :not(.world-canvas), .world-canvas .construction-live-actions { visibility: hidden !important; } .world-canvas:after { display: none !important; }'
        : '.v18-page > :not(.v18-canvas), .v18-canvas .construction-live-actions { visibility: hidden !important; }' });
      // WebGL redraws continuously, so an element screenshot can wait forever
      // for the canvas to become "stable". A page clip captures the exact same
      // pixels without requiring an idle render loop.
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error(`${name} canvas has no bounding box`);
      await page.screenshot({
        path: path.join(output, `${name}-canvas-same-fixture.png`),
        clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        animations: 'allow',
        timeout: 90000,
      });
      report.captures[name] = diagnostics;
      await page.close();
    }
    report.assetPathsEqual = JSON.stringify(report.captures.home.assets) === JSON.stringify(report.captures.showcase.assets);
    // Home also loads one navigation thumbnail that Showcase does not. The
    // renderer contract is the apartment/city asset set, so compare those
    // requests separately from route-specific UI decoration.
    const apartmentAssets = assets => assets.filter(asset => asset.startsWith('/assets/apartment/') || asset.startsWith('/assets/world-v20/'));
    report.apartmentAssetPathsEqual = JSON.stringify(apartmentAssets(report.captures.home.assets)) === JSON.stringify(apartmentAssets(report.captures.showcase.assets));
    report.saveUnchanged = before === hash();
    fs.writeFileSync(path.join(output, 'same-canvas-report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify({
      home: report.captures.home.webgl,
      showcase: report.captures.showcase.webgl,
      assetPathsEqual: report.assetPathsEqual,
      apartmentAssetPathsEqual: report.apartmentAssetPathsEqual,
      saveUnchanged: report.saveUnchanged,
      errors: ['home', 'showcase'].map(name => ({ name, page: report.captures[name].pageErrors.length, console: report.captures[name].consoleErrors.length, http: report.captures[name].badResponses.length })),
    }, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
