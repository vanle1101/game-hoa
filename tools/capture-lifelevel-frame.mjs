import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const matching = process.env.LIFELEVEL_MATCH_DIAGNOSTIC
  ? JSON.parse((await readFile(process.env.LIFELEVEL_MATCH_DIAGNOSTIC, "utf8")).replace(/^\uFEFF/, "")).browser
  : null;
const url = matching?.href ?? process.env.LIFELEVEL_URL ?? "http://127.0.0.1:3333";
const [width, height] = (process.env.LIFELEVEL_VIEWPORT ?? "1801x873").split("x").map(Number);
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 320) throw new Error("Invalid LIFELEVEL_VIEWPORT");
const output = path.resolve(process.argv[2] ?? "artifacts/frame-audit-20261028/current-1801x873.png");
const reducedMotion = matching ? (matching.media.reduced ? "reduce" : "no-preference") : process.env.LIFELEVEL_REDUCED_MOTION ?? "no-preference";
const serviceWorkers = matching ? (matching.serviceWorker ? "allow" : "block") : process.env.LIFELEVEL_SERVICE_WORKERS ?? "allow";
const animations = matching ? "allow" : process.env.LIFELEVEL_ANIMATIONS ?? "allow";
await mkdir(path.dirname(output), { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: Number(matching?.dpr ?? process.env.LIFELEVEL_DPR ?? 1),
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "dark",
    reducedMotion,
    serviceWorkers,
  });
  if (matching) await context.addInitScript(({ entered, sidebarMode }) => {
    if (entered !== null) localStorage.setItem("lifelevel-entered", entered);
    if (sidebarMode !== null) localStorage.setItem("lifelevel-sidebar-mode", sidebarMode);
  }, { entered: matching.entered, sidebarMode: matching.sidebarMode });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (response?.status() !== 200) throw new Error(`LIFE//LEVEL returned HTTP ${response?.status() ?? "no response"}`);
  await page.waitForTimeout(2500);
  if (!(await page.locator(".game-shell.lobby-view").count())) {
    const guestButton = page.getByRole("button", { name: /khách|chơi thử|tiếp tục/i }).first();
    if (await guestButton.count()) await guestButton.click();
  }
  await page.locator(".game-shell.lobby-view").waitFor({ timeout: 20000 });
  if (serviceWorkers !== "block") {
    await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => null);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".game-shell.lobby-view").waitFor({ timeout: 20000 });
  }
  await page.locator(".reference-hud-overlay svg image").first().waitFor({ state: "attached", timeout: 10000 });
  await page.locator(".vref-rewards img").evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => null))));
  await page.waitForTimeout(1500);
  const geometry = await page.evaluate(async () => {
    const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", value))).map(byte => byte.toString(16).padStart(2, "0")).join("");
    const cssText = [...document.styleSheets].map(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText).join(""); } catch { return sheet.href ?? ""; } }).join("");
    const assetUrls = ["/assets/cyberpunk-bg.png", "/lifelevel-frames/header.png", "/lifelevel-frames/fluid/header-chassis.png", "/lifelevel-frames/today.png", "/lifelevel-frames/reactors/today_1.png", "/lifelevel-frames/today-parts/top-middle.png", "/lifelevel-frames/today-parts/middle-left.png", "/assets/lobby-reference/reward-ref-headphones.png"];
    const assetHashes = Object.fromEntries(await Promise.all(assetUrls.map(async url => [url, await digest(await (await fetch(url)).arrayBuffer())])));
    const box = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { x: +rect.x.toFixed(2), y: +rect.y.toFixed(2), width: +rect.width.toFixed(2), height: +rect.height.toFixed(2), display: style.display };
    };
    const boxes = selector => [...document.querySelectorAll(selector)].map(element => {
      const rect = element.getBoundingClientRect();
      return { x: +rect.x.toFixed(2), y: +rect.y.toFixed(2), width: +rect.width.toFixed(2), height: +rect.height.toFixed(2), text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 75) ?? "" };
    }).filter(rect => rect.width > 0 && rect.height > 0);
    const frameSelectors = {
      header: ".vref-header", sidebar: ".cyber-chrome-sidebar", today: ".vref-today",
      boss: ".vref-boss", ai: ".vref-butler", skills: ".vref-skill-preview",
      character: ".vref-character", achievements: ".vref-achievements", rewards: ".vref-rewards",
    };
    const titleSelectors = {
      header: ".vref-header .vref-date, .vref-header .vref-quote", sidebar: ".cyber-chrome-sidebar .brand",
      today: ".vref-today .vref-heading-link", boss: ".vref-boss .vref-heading-link",
      ai: ".vref-butler .vref-heading-link", skills: ".vref-skill-preview .vref-heading-link",
      character: ".vref-character .vref-heading-link", achievements: ".vref-achievements .vref-heading-link",
      rewards: ".vref-rewards .vref-heading-link",
    };
    const dynamicSelectors = {
      header: ".vref-header .vref-date, .vref-header-profile", sidebar: "",
      today: ".vref-today-top > span:not(.vref-meter), .vref-tasks, .vref-vitals, .vref-level, .vref-today-character",
      boss: ".vref-boss-info, .vref-boss-art", ai: ".vref-butler-message, .vref-butler-list",
      skills: ".vref-skill-level, .vref-skill-totals, .vref-skill-map, .vref-skill-branches",
      character: ".vref-character-body", achievements: ".vref-achievement-showcase, .vref-achievement-summary",
      rewards: ".vref-reward-gold, .vref-reward-grid",
    };
    const visualRegions = Object.fromEntries(Object.entries(frameSelectors).map(([name, selector]) => {
      const panel = document.querySelector(selector);
      const pseudo = panel ? getComputedStyle(panel, "::before") : null;
      return [name, {
        titles: boxes(titleSelectors[name]),
        controls: boxes(`${selector} button, ${selector} input, ${selector} .vref-skill-intro, ${selector} .vref-tasks h3, ${selector} .vref-butler-message`),
        dynamic: dynamicSelectors[name] ? boxes(dynamicSelectors[name]) : [],
        panelBackground: panel ? getComputedStyle(panel).background : null,
        pseudoBackground: pseudo?.background ?? null,
        pseudoOpacity: pseudo?.opacity ?? null,
        pseudoInset: pseudo?.inset ?? null,
      }];
    }));
    const [auth, game] = await Promise.all([
      fetch("/api/auth", { cache: "no-store" }).then(response => response.json()).catch(() => null),
      fetch("/api/game", { cache: "no-store" }).then(response => response.json()).catch(() => null),
    ]);
    const vv = visualViewport;
    return {
      href: location.href,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio, visual: vv ? { width: vv.width, height: vv.height, scale: vv.scale } : null },
      media: {
        reference: matchMedia("(min-width:1760px) and (max-width:1840px) and (min-height:850px) and (max-height:920px)").matches,
        width1300: matchMedia("(max-width:1300px)").matches,
        height800: matchMedia("(max-height:800px)").matches,
        reduced: matchMedia("(prefers-reduced-motion:reduce)").matches,
      },
      session: { auth: { authenticated: auth?.authenticated, accountId: auth?.account?.userId ?? null, localMode: auth?.localMode }, game: { mode: game?.mode, userId: game?.state?.userId ?? null, revision: game?.state?.revision ?? null, gold: game?.state?.gold ?? null, tasks: game?.state?.tasks?.length ?? null, achievements: game?.state?.achievements?.length ?? null, completed: game?.state?.achievements?.filter(item => item.completedAt).length ?? null } },
      serviceWorker: Boolean(navigator.serviceWorker?.controller),
      sidebarMode: localStorage.getItem("lifelevel-sidebar-mode"),
      entered: localStorage.getItem("lifelevel-entered"),
      sourceFingerprint: { css: await digest(new TextEncoder().encode(cssText)), assets: assetHashes },
      shell: box(".game-shell.lobby-view"),
      main: box(".main-shell"),
      background: getComputedStyle(document.querySelector(".game-shell.lobby-view")).backgroundImage.slice(0, 220),
      overlay: box(".reference-hud-overlay"),
      panels: Object.fromEntries(Object.entries({
        header: ".vref-header", sidebar: ".cyber-chrome-sidebar", today: ".vref-today",
        boss: ".vref-boss", ai: ".vref-butler", skills: ".vref-skill-preview",
        character: ".vref-character", achievements: ".vref-achievements", rewards: ".vref-rewards",
      }).map(([name, selector]) => [name, box(selector)])),
      visualRegions,
      skill: [...document.querySelectorAll(".vref-skill-node")].slice(0, 6).map(element => { const rect = element.getBoundingClientRect(); const css = getComputedStyle(element); return [Math.round(rect.width * 100) / 100, Math.round(rect.height * 100) / 100, css.backgroundColor]; }),
      achievementRows: [...document.querySelectorAll(".vref-achievements .vref-achievement-row")].slice(0, 3).map(element => element.textContent.trim().replace(/\s+/g, " ").slice(0, 85)),
      achievementSummary: document.querySelector(".vref-achievement-summary")?.textContent.trim().replace(/\s+/g, " ") ?? null,
      rewardImages: [...document.querySelectorAll(".vref-rewards img")].map(image => [image.currentSrc.split("/").at(-1)?.slice(0, 100), image.complete, image.naturalWidth, image.naturalHeight]),
      frameImages: [...document.querySelectorAll(".reference-hud-overlay svg image")].map(image => ({
        href: image.getAttribute("href"), x: image.getAttribute("x"), y: image.getAttribute("y"),
        width: image.getAttribute("width"), height: image.getAttribute("height"),
      })),
      ledPaths: Object.fromEntries([...document.querySelectorAll(".reference-hud-led")].map((group, index) => {
        const name = ["sidebar", "header", "today", "boss", "ai", "skills", "character", "achievements", "rewards"][index];
        const track = group.querySelector(".reference-hud-led__track");
        if (!track) return [name, []];
        const length = track.getTotalLength();
        const transform = track.getCTM();
        return [name, Array.from({ length: 256 }, (_, sample) => {
          const point = track.getPointAtLength(length * sample / 256).matrixTransform(transform);
          return [Math.round(point.x * 100) / 100, Math.round(point.y * 100) / 100];
        })];
      })),
      responsivePaths: [...document.querySelectorAll(".fluid-mechanical-frame")].map(frame => ({
        name: frame.getAttribute("data-frame"),
        length: Math.round(frame.querySelector(".fluid-mechanical-frame__pulse")?.getTotalLength() ?? 0),
        frame: (() => { const rect = frame.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height].map(value => +value.toFixed(2)); })(),
        samples: (() => {
          const rail = frame.querySelector(".fluid-mechanical-frame__pulse--primary");
          if (!rail) return [];
          const length = rail.getTotalLength();
          return Array.from({ length: 256 }, (_, index) => {
            const point = rail.getPointAtLength(length * index / 256);
            return [point.x, point.y].map(value => +value.toFixed(2));
          });
        })(),
      })),
      ledSegments: document.querySelectorAll(".reference-hud-led__segment").length,
      visibleButtons: [...document.querySelectorAll(".vref-board button")].filter(button => button.getBoundingClientRect().width > 0).length,
    };
  });
  if (matching) {
    const expectedSession = matching.session;
    const sameSession = JSON.stringify(geometry.session) === JSON.stringify(expectedSession);
    const sameRoute = geometry.href === matching.href;
    const sameDpr = geometry.viewport.pixelRatio === matching.dpr;
    const sameWorker = geometry.serviceWorker === matching.serviceWorker;
    const sameMotion = geometry.media.reduced === matching.media.reduced;
    const sameStorage = geometry.sidebarMode === matching.sidebarMode && geometry.entered === matching.entered;
    const sameSource = JSON.stringify(geometry.sourceFingerprint) === JSON.stringify(matching.sourceFingerprint);
    if (!sameSession || !sameRoute || !sameDpr || !sameWorker || !sameMotion || !sameStorage || !sameSource) {
      throw new Error(`Live Chrome state mismatch: ${JSON.stringify({ sameSession, sameRoute, sameDpr, sameWorker, sameMotion, sameStorage, sameSource })}`);
    }
  }
  await page.screenshot({ path: output, fullPage: false, animations, timeout: 30000 });
  await writeFile(output.replace(/\.png$/i, ".json"), JSON.stringify({ url, status: response?.status(), capture: { viewport: [width, height], reducedMotion, serviceWorkers, animations, matchedStorage: Boolean(matching) }, geometry, errors }, null, 2));
  console.log(JSON.stringify({ screenshot: output, status: response?.status(), viewport: geometry.viewport, media: geometry.media, overlay: geometry.overlay?.display, session: geometry.session, serviceWorker: geometry.serviceWorker, errors: errors.slice(0, 3) }));
  await context.close();
} finally {
  await browser.close();
}
