import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const output = "evidence/lobby-reference";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
try {
  for (const [width, height] of [[1920, 1080], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:3336/", { waitUntil: "networkidle" });
    await page.locator(".vref-lobby").waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${output}/lobby-${width}x${height}.png`, fullPage: true });
    const layout = await page.evaluate(() => ({
      title: document.title,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      panels: [...document.querySelectorAll(".vref-panel")].map(panel => ({
        className: panel.className,
        rect: (() => { const r = panel.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); })(),
      })),
    }));
    console.log(JSON.stringify({ viewport: `${width}x${height}`, layout, errors }));
    await page.close();
  }
} finally {
  await browser.close();
}
