import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("artifacts/frame-audit-20261028/today-composition");
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const [width, height] of [[1801, 873], [1920, 919]]) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1,
      reducedMotion: "no-preference", serviceWorkers: "allow",
    });
    await context.addInitScript(() => {
      localStorage.setItem("lifelevel-entered", "true");
      localStorage.setItem("lifelevel-sidebar-mode", "expanded");
    });
    const page = await context.newPage();
    const response = await page.goto("http://127.0.0.1:3333/", { waitUntil: "domcontentloaded" });
    if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
    await page.locator(".game-shell.lobby-view").waitFor();
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".vref-today .vref-heading-link").waitFor();
    await page.waitForTimeout(1000);
    const result = await page.evaluate(() => {
      const selectors = {
        panel: ".vref-today", fluid: ".vref-today > .fluid-mechanical-frame",
        chassis: ".vref-today .fluid-mechanical-frame__chassis",
        topReactor: ".vref-today .fluid-mechanical-frame__reactor",
        lowerReactor: ".vref-today .fluid-mechanical-frame__reactor:nth-of-type(3)",
        led: ".vref-today .fluid-mechanical-frame__led",
        top: ".vref-today-top", heading: ".vref-today-top .vref-heading",
        badge: ".vref-today-top .vref-heading-link",
        icon: ".vref-today-top .vref-heading-link svg",
        label: ".vref-today-top > span:not(.vref-meter)",
        content: ".vref-today-content",
        taskHeading: ".vref-today .vref-tasks h3",
        taskRow: ".vref-today .vref-task",
        overlay: ".reference-hud-overlay",
        fixedArt: '.reference-hud-overlay svg image[href="/lifelevel-frames/today.png"]',
        fixedRail: ".reference-hud-led:nth-of-type(4)",
      };
      const rect = element => {
        const r = element.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map(value => +value.toFixed(2));
      };
      const details = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const style = getComputedStyle(element);
        return [name, { rect: rect(element), display: style.display, position: style.position, zIndex: style.zIndex, overflow: style.overflow, opacity: style.opacity, background: style.backgroundImage || style.backgroundColor, padding: style.padding, borderImage: style.borderImageSource }];
      }));
      const badge = document.querySelector(selectors.badge);
      const textNode = [...badge.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      let textRect = null;
      if (textNode) { const range = document.createRange(); range.selectNodeContents(textNode); textRect = rect(range); }
      const panel = document.querySelector(selectors.panel);
      const overlay = document.querySelector(selectors.overlay);
      const artworkOrigin = innerWidth < 1841 ? [256, 122] : rect(panel.querySelector(".fluid-mechanical-frame")).slice(0, 2);
      const reactorRects = [...panel.querySelectorAll(".fluid-mechanical-frame__reactor")].map(rect);
      const taskRows = [...panel.querySelectorAll(".vref-task")].map(rect);
      const icon = document.querySelector(selectors.icon).getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();
      const rail = innerWidth < 1841 ? overlay.querySelectorAll(".reference-hud-led")[2]?.querySelector(".reference-hud-led__track") : panel.querySelector(".fluid-mechanical-frame__pulse--primary");
      const railPoints = [];
      if (rail) {
        const transform = rail.getScreenCTM();
        const length = rail.getTotalLength();
        for (let index = 0; index < 2048; index++) {
          const point = rail.getPointAtLength(length * index / 2048).matrixTransform(transform);
          railPoints.push([point.x, point.y]);
        }
      }
      const gap = target => Math.min(...railPoints.map(([x, y]) => Math.hypot(Math.max(target.left - x, 0, x - target.right), Math.max(target.top - y, 0, y - target.bottom))));
      return { href: location.href, viewport: [innerWidth, innerHeight], details, textRect,
        panelChildren: [...panel.children].map(child => [child.tagName, child.className, rect(child)]),
        fixedTodayImages: [...overlay.querySelectorAll('image[href="/lifelevel-frames/today.png"]')].length,
        fluidTodayFrames: [...panel.querySelectorAll('.fluid-mechanical-frame[data-frame="today"]')].length,
        composition: panel.querySelector('.fluid-mechanical-frame')?.dataset.composition,
        reactorRects,
        taskRows,
        overlayVisible: getComputedStyle(overlay).display !== "none",
        railGapToIcon: railPoints.length ? +gap(icon).toFixed(2) : null,
        railGapToBadge: railPoints.length ? +gap(badgeRect).toFixed(2) : null,
        railPointsInsideIcon: railPoints.filter(([x, y]) => x >= icon.left && x <= icon.right && y >= icon.top && y <= icon.bottom).length,
        railPointsInsideBadge: railPoints.filter(([x, y]) => x >= badgeRect.left && x <= badgeRect.right && y >= badgeRect.top && y <= badgeRect.bottom).length,
        railSamples: railPoints.filter((_, index) => index % 8 === 0).map(([x, y]) => [+(x - artworkOrigin[0]).toFixed(2), +(y - artworkOrigin[1]).toFixed(2)]),
        badgeFont: getComputedStyle(badge).font,
        badgeTextShadow: getComputedStyle(badge).textShadow,
      };
    });
    const output = path.join(root, `${width}x${height}.json`);
    await writeFile(output, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ viewport: result.viewport, panel: result.details.panel.rect, badge: result.details.badge.rect, icon: result.details.icon.rect, text: result.textRect, reactors: result.reactorRects, taskRows: result.taskRows, composition: result.composition, railGapToIcon: result.railGapToIcon, railGapToBadge: result.railGapToBadge, railPointsInsideIcon: result.railPointsInsideIcon, railPointsInsideBadge: result.railPointsInsideBadge, fixedTodayImages: result.fixedTodayImages, fluidTodayFrames: result.fluidTodayFrames, overlayVisible: result.overlayVisible, file: output }));
    await context.close();
  }
} finally {
  await browser.close();
}
