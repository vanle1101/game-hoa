// Controlled CSS-only screenshot trial. Never used as a final app capture.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const cssFile = process.argv[2];
const output = process.argv[3];
if (!cssFile || !output) throw new Error("Usage: node tools/trial-dashboard-style.mjs override.css output.png");
const css = await readFile(cssFile, "utf8");
const target = path.resolve(output);
await mkdir(path.dirname(target), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width: 1801, height: 873 }, deviceScaleFactor: 1,
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh", colorScheme: "dark",
    reducedMotion: "no-preference", serviceWorkers: "allow",
  });
  await context.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    localStorage.setItem("lifelevel-sidebar-mode", "expanded");
  });
  const page = await context.newPage();
  const response = await page.goto("http://127.0.0.1:3333/", { waitUntil: "domcontentloaded" });
  if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()}`);
  await page.locator(".game-shell.lobby-view").waitFor();
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".vref-today .vref-heading-link").waitFor();
  await page.waitForTimeout(900);
  const before = target.replace(/\.png$/i, "-before.png");
  await page.screenshot({ path: before, animations: "disabled" });
  await page.addStyleTag({ content: css });
  await page.screenshot({ path: target, animations: "disabled" });
  const data = await page.evaluate(() => ({
    href: location.href, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
    session: document.querySelector(".game-shell")?.className,
    today: (() => { const e = document.querySelector(".vref-today .vref-heading-link"); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
    skills: (() => { const e = document.querySelector(".vref-skill-preview"); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
  }));
  await writeFile(target.replace(/\.png$/i, ".json"), JSON.stringify({ trialCss: path.resolve(cssFile), before, after: target, ...data }, null, 2));
  console.log(JSON.stringify({ before, after: target, viewport: data.viewport, today: data.today, skills: data.skills }));
} finally {
  await browser.close();
}
