"";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("artifacts/frame-audit-20261028");
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = {};
try {
  for (const [width, height] of [[1801, 873], [1920, 919]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference", serviceWorkers: "allow" });
    await context.addInitScript(() => {
      localStorage.setItem("lifelevel-entered", "true");
      localStorage.setItem("lifelevel-sidebar-mode", "expanded");
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:3333/", { waitUntil: "domcontentloaded" });
    await page.locator(".game-shell.lobby-view").waitFor();
    await page.evaluate(() => navigator.serviceWorker?.ready);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".vref-today .vref-heading-link").waitFor();
    const result = await page.evaluate(() => {
      const names = ["header", "sidebar", "today", "boss", "ai", "skills", "character", "achievements", "rewards"];
      const panelSelector = { header: ".vref-header", sidebar: ".cyber-chrome-sidebar", today: ".vref-today", boss: ".vref-boss", ai: ".vref-butler", skills: ".vref-skill-preview", character: ".vref-character", achievements: ".vref-achievements", rewards: ".vref-rewards" };
      const source = { header: [286,6,1494,99], sidebar: [0,81,264,783], today: [256,122,632,321], boss: [894,122,471,321], ai: [1358,122,424,324], skills: [260,437,638,428], character: [892,436,475,276], achievements: [892,681,475,182], rewards: [1361,435,421,428] };
      const position = element => { const r = element.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(value => +value.toFixed(2)); };
      const area = (a, b) => Math.max(0, Math.min(a[0]+a[2], b[0]+b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));
      const fixed = getComputedStyle(document.querySelector(".reference-hud-overlay")).display !== "none";
      const records = Object.fromEntries(names.map(name => {
        const panel = document.querySelector(panelSelector[name]);
        const fluid = panel.querySelector(`.fluid-mechanical-frame[data-frame="${name}"]`) ?? document.querySelector(`${name === "header" ? ".vref-header-led" : ".cyber-sidebar-led"}.fluid-mechanical-frame[data-frame="${name}"]`);
        const title = name === "header" ? panel.querySelector(".vref-date") : name === "sidebar" ? panel.querySelector(".brand") : panel.querySelector(".vref-heading-link");
        const fluidVisible = getComputedStyle(fluid).display !== "none";
        const visibleLayers = Number(fixed) + Number(fluidVisible);
        const art = source[name];
        const frame = fixed ? [...document.querySelectorAll(".reference-hud-overlay svg image")].find(element => element.getAttribute("href") === `/lifelevel-frames/${name}.png`) : null;
        const frameBox = fixed ? [Number(frame.getAttribute("x")),Number(frame.getAttribute("y")),Number(frame.getAttribute("width")),Number(frame.getAttribute("height"))] : position(fluid);
        const reactors = fixed ? [] : [...fluid.querySelectorAll(".fluid-mechanical-frame__reactor")].map(position);
        const fixedReactors = {
          header: [[286,6,97,97]], sidebar: [[1,85,79,79]],
          today: [[256,121,79,79],[789,346,97,97]], boss: [[894,122,79,79]],
          ai: [[1366,122,77,77]], skills: [[266,435,83,83]],
          character: [[892,436,79,79]], achievements: [[900,681,61,61]],
          rewards: [[1364,437,81,81]],
        };
        const intersections = name === "header" || name === "sidebar" ? [] : (fixed ? fixedReactors[name] : reactors).map(reactor => +area(reactor,position(title)).toFixed(2));
        const chassis = fluid.querySelector(".fluid-mechanical-frame__chassis");
        const tile = fluid.querySelector(".fluid-mechanical-frame__tiled-chassis");
        const led = fluid.querySelector(".fluid-mechanical-frame__pulse--primary");
        const ledBox = led?.getBBox();
        const style = getComputedStyle(panel);
        return [name, {
          panel: position(panel), frame: frameBox, title: position(title), visibleLayers,
          composition: fluid.dataset.composition,
          reactors, intersections,
          reactorAspectRatios: reactors.map(([, , w, h]) => +(w/h).toFixed(4)),
          borderImage: chassis ? getComputedStyle(chassis).borderImageSource : null,
          tiledPieces: tile ? tile.children.length : 0,
          ledBounds: ledBox ? [ledBox.x,ledBox.y,ledBox.width,ledBox.height].map(value=>+value.toFixed(2)) : null,
          overflow: style.overflow,
          titleVisible: getComputedStyle(title).visibility === "visible",
          frameSourceSize: art.slice(2),
        }];
      }));
      return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, fixedOverlay: fixed, records, pageErrors: [] };
    });
    result.pageErrors = errors;
    results[`${width}x${height}`] = result;
    await context.close();
  }
} finally {
  await browser.close();
}
for (const [viewport, result] of Object.entries(results)) {
  for (const [name, record] of Object.entries(result.records)) {
    if (record.visibleLayers !== 1) throw new Error(`${viewport} ${name}: ${record.visibleLayers} visible frame layers`);
    if (record.intersections.some(value => value > 0)) {
      const file = path.join(root, "refinement-composition-audit.json");
      await writeFile(file, JSON.stringify(results, null, 2));
      throw new Error(`${viewport} ${name}: reactor intersects title (${record.intersections}); frame ${record.frame}; reactor ${JSON.stringify(record.reactors)}; title ${record.title}`);
    }
    if (record.reactorAspectRatios.some(value => Math.abs(value - 1) > .01)) throw new Error(`${viewport} ${name}: reactor distorted`);
    if (viewport === "1920x919" && (record.composition !== "tiled-parts" || record.tiledPieces !== 9)) throw new Error(`${viewport} ${name}: missing source-derived tiled chassis`);
    if (!record.titleVisible) throw new Error(`${viewport} ${name}: title hidden`);
  }
  if (result.pageErrors.length) throw new Error(`${viewport}: page error ${result.pageErrors[0]}`);
}
const file = path.join(root, "refinement-composition-audit.json");
await writeFile(file, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ file, viewports: Object.fromEntries(Object.entries(results).map(([viewport, value]) => [viewport, { fixedOverlay: value.fixedOverlay, panels: Object.keys(value.records).length, titleOverlaps: Object.values(value.records).flatMap(item => item.intersections).filter(Boolean).length, pageErrors: value.pageErrors.length }])) }));
