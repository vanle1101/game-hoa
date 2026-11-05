/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const fs = require('fs');

const out = 'evidence/v21';
fs.mkdirSync(out, { recursive: true });

async function waitForScene(page, label) {
  await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(12000);
  const fps = await page.locator('text=/FPS|3D/').first().textContent().catch(() => '');
  console.log(`${label}: canvas ready (${fps ?? 'no telemetry'})`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  const showcase = await context.newPage();
  await showcase.goto('http://127.0.0.1:3335/showcase/apartment-v18', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForScene(showcase, 'showcase-developed');
  await showcase.screenshot({ path: `${out}/showcase-developed-after.png`, fullPage: true });
  await showcase.getByRole('button', { name: 'Căn hộ cơ bản' }).click();
  await showcase.waitForTimeout(1500);
  await waitForScene(showcase, 'showcase-starter');
  await showcase.screenshot({ path: `${out}/showcase-starter-after.png`, fullPage: true });

  const home = await context.newPage();
  await home.goto('http://127.0.0.1:3333/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForScene(home, 'home');
  await home.screenshot({ path: `${out}/home-after.png`, fullPage: true });
  await home.getByRole('button', { name: 'Trước mặt' }).click();
  await home.waitForTimeout(1000);
  await home.screenshot({ path: `${out}/home-front-camera.png`, fullPage: true });
  await home.getByRole('button', { name: 'Tự do' }).click();
  await home.waitForTimeout(1000);
  await home.screenshot({ path: `${out}/home-benchmark-after.png`, fullPage: true });

  await browser.close();
})();
