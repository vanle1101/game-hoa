/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const fixture = process.argv[2] === 'developed';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => process.stdout.write(`PAGE ERROR: ${error.message}\n`));
  await page.goto(`http://127.0.0.1:3336/?refresh=v21-render${fixture ? '&visualFixture=developed' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('lifelevel-entered', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  if (!fixture) await page.locator('button[aria-label="Cuộc sống"]').dispatchEvent('click');
  await page.waitForTimeout(12000);
  const details = await page.evaluate(() => {
    const canvas = document.querySelector('.world-canvas canvas');
    if (!canvas) return { canvas: false };
    return {
      canvas: true,
      width: canvas.width,
      height: canvas.height,
      webgl: !!(canvas.getContext('webgl2') || canvas.getContext('webgl')),
      cameraMode: canvas.dataset.cameraMode,
    };
  });
  process.stdout.write(`${JSON.stringify(details)}\n`);
  await page.locator('.world-canvas canvas').screenshot({
    path: fixture ? 'evidence/visual-v21.1/developed-reference-penthouse-canvas.png' : 'evidence/visual-v21.1/home-reference-penthouse-canvas.png',
    timeout: 120000,
    animations: 'disabled',
  });
  process.stdout.write('Screenshot saved.\n');
  await browser.close();
})().catch(error => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
