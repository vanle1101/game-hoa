/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const fs = require('node:fs');

const url = process.env.LIFE_LEVEL_QA_URL || 'https://life-level-theta.vercel.app/';
const labels = [
  'Sảnh chờ', 'Nhiệm vụ', 'Lịch trình', 'Chiến dịch', 'Đấu trường',
  'Thử thách trùm', 'Chiến lợi phẩm', 'Nhân vật', 'Trang bị', 'Túi đồ',
  'Cây kỹ năng', 'Sự nghiệp', 'Nội thất', 'Cửa hàng trang bị', 'Chế tạo',
  'Tích lũy', 'Bạn đồng hành', 'Thành tựu', 'Tài chính', 'Phần thưởng',
  'NOVA AI', 'Nhật ký', 'Cài đặt', 'Cuộc sống', 'Căn hộ', 'Xây dựng',
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await page.addInitScript(() => localStorage.setItem('lifelevel-entered', 'true'));
  const pageErrors = [];
  const httpErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) httpErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('button[aria-label="Sảnh chờ"]').waitFor({ timeout: 30000 });
  const results = [];
  const runLabels = process.env.LIFE_LEVEL_QA_ONLY ? labels.filter(label => label === process.env.LIFE_LEVEL_QA_ONLY) : labels;
  for (const label of runLabels) {
    const before = pageErrors.length;
    try {
      await page.locator(`button[aria-label="${label}"]`).first().click({ timeout: 10000 });
      await page.waitForTimeout(label === 'Cuộc sống' || label === 'Căn hộ' || label === 'Xây dựng' ? 2500 : 350);
      const status = await page.evaluate(() => ({
        main: !!document.querySelector('main, .construction-editor'),
        visibleFallback: [...document.querySelectorAll('.world-fallback')].some(el => el.getClientRects().length > 0),
        screenClass: document.querySelector('#main-content')?.className || document.querySelector('.world-main')?.className || document.querySelector('.construction-editor')?.className || '',
      }));
      results.push({ label, opened: status.main && !status.visibleFallback && pageErrors.length === before, ...status, errors: pageErrors.slice(before) });
    } catch (error) {
      results.push({ label, opened: false, error: error.message.slice(0, 600) });
    }
  }
  const report = { url, checkedAt: new Date().toISOString(), initialHttpStatus: response?.status(), results, pageErrors, httpErrors: [...new Set(httpErrors)] };
  fs.mkdirSync('evidence/functional-inventory', { recursive: true });
  fs.writeFileSync(`evidence/functional-inventory/vercel-navigation${process.env.LIFE_LEVEL_QA_ONLY ? '-build-only' : ''}-20261021.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ initialHttpStatus: report.initialHttpStatus, opened: results.filter(item => item.opened).length, total: results.length, failed: results.filter(item => !item.opened).map(item => item.label), pageErrors, httpErrors: report.httpErrors }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
