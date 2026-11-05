/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

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
  await page.goto(process.env.V21_QA_BASE_URL || 'http://127.0.0.1:3333/', { waitUntil: 'domcontentloaded' });
  await page.locator('button[aria-label="Cuộc sống"]').click();
  const canvas = page.locator('.world-canvas canvas');
  await canvas.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(5000);
  const out = path.resolve('evidence/v21.1');
  fs.mkdirSync(out, { recursive: true });
  for (const [preset, label] of [['front', 'front'], ['rear', 'rear'], ['left', 'side'], ['face', 'face']]) {
    await page.evaluate(value => window.dispatchEvent(new CustomEvent('life-level:camera-preset', { detail: { preset: value } })), preset);
    await page.waitForTimeout(2200);
    await canvas.screenshot({ path: path.join(out, `character-${label}-local-20261020.png`), animations: 'disabled', timeout: 60000 });
  }
  console.log(JSON.stringify({ errors, contextLost: await canvas.evaluate(c => c.getContext('webgl2')?.isContextLost()) }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
