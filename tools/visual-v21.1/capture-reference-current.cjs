/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const baseUrl = process.env.V21_QA_BASE_URL || 'http://127.0.0.1:3333/';
const label = (process.env.V21_QA_LABEL || 'current').replace(/[^a-z0-9-]/gi, '');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('lifelevel-entered', 'true'));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('button[aria-label="Cuộc sống"]').click();
  const canvas = page.locator('.world-canvas canvas');
  await canvas.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(12000);
  const out = path.resolve('evidence/v21.1');
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, `reference-home-${label}.png`), timeout: 60000, animations: 'disabled' });
  await canvas.screenshot({ path: path.join(out, `reference-home-canvas-${label}.png`), timeout: 60000, animations: 'disabled' });
  console.log(JSON.stringify({ errors, canvas: await canvas.evaluate(c => ({ width: c.width, height: c.height, mode: c.dataset.cameraMode, contextLost: c.getContext('webgl2')?.isContextLost() })) }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
