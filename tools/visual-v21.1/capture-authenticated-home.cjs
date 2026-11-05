/* eslint-disable @typescript-eslint/no-require-imports */
// Browser QA for the owner-only HTTPS Home. Credentials stay in memory and
// never enter the report, screenshot metadata or command-line arguments.
const { chromium } = require('playwright');
const { loadCredentials } = require('C:/Users/phamc/.dsh/workai/life-level-v12/preview/gateway.js');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'evidence/v21.1');
const url = process.env.V21_QA_PUBLIC_URL;
if (!url || !/^https:\/\/[^/]+\/$/.test(url)) throw new Error('Set V21_QA_PUBLIC_URL to the verified HTTPS Home origin, ending in /.');
const save = path.join(root, '.local-data/local-player.json');
const hash = () => fs.existsSync(save) ? createHash('sha256').update(fs.readFileSync(save)).digest('hex') : null;

async function run() {
  const before = hash();
  const browser = await chromium.launch({ headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', httpCredentials: loadCredentials() });
    await context.addInitScript(() => localStorage.setItem('lifelevel-entered', 'true'));
    const page = await context.newPage();
    const report = { origin: new URL(url).origin, htmlStatus: null, apiStatus: null,
      pageErrors: [], consoleErrors: [], badResponses: [], assetPaths: [], webgl: null, saveUnchanged: false };
    page.on('pageerror', error => report.pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (pathname === '/api/game') report.apiStatus = response.status();
      if (response.status() >= 400) report.badResponses.push({ pathname, status: response.status() });
      if (/\.(?:glb|gltf|png|jpe?g|webp)(?:[?#]|$)/i.test(pathname)) report.assetPaths.push(pathname);
    });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    report.htmlStatus = response?.status() ?? null;
    const canvas = page.locator('.world-canvas canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(14000);
    report.webgl = await canvas.evaluate(element => {
      const gl = element.getContext('webgl2') || element.getContext('webgl');
      return { width: element.clientWidth, height: element.clientHeight,
        contextAvailable: Boolean(gl), contextLost: gl?.isContextLost() ?? null };
    });
    report.assetPaths = [...new Set(report.assetPaths)].sort();
    report.saveUnchanged = before === hash();
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'home-https-authenticated.png'), animations: 'disabled', timeout: 45000 });
    fs.writeFileSync(path.join(evidence, 'browser-https-authenticated.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify({ htmlStatus: report.htmlStatus, apiStatus: report.apiStatus,
      webgl: report.webgl, assetCount: report.assetPaths.length,
      pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length,
      badResponses: report.badResponses.length, saveUnchanged: report.saveUnchanged }, null, 2) + '\n');
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
