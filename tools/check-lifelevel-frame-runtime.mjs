import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.LIFELEVEL_URL ?? "http://127.0.0.1:3333";
const output = path.resolve("artifacts/frame-audit-20261028/runtime-check.json");
await mkdir(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function lobbyPage(width, height, serviceWorkers = "block") {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference", serviceWorkers });
  await context.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    localStorage.setItem("lifelevel-sidebar-mode", "expanded");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (!(await page.locator(".game-shell.lobby-view").count())) {
    const guest = page.getByRole("button", { name: /khách|chơi thử|tiếp tục/i }).first();
    if (await guest.count()) await guest.click();
  }
  await page.locator(".game-shell.lobby-view").waitFor({ timeout: 20000 });
  if (serviceWorkers === "allow") {
    await page.evaluate(() => navigator.serviceWorker?.ready).catch(() => null);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".game-shell.lobby-view").waitFor({ timeout: 20000 });
  }
  return { page, context, errors };
}

try {
  const desktop = await lobbyPage(1801, 873);
  const configuredMotion = await desktop.page.locator(".reference-hud-led").first().getAttribute("data-motion");
  await desktop.page.evaluate(() => {
    document.querySelector(".game-shell.lobby-view")?.classList.remove("reduce-motion");
    document.querySelectorAll(".reference-hud-led").forEach(group => group.setAttribute("data-motion", "on"));
  });
  await desktop.page.waitForTimeout(1000);
  const exact = await desktop.page.evaluate(() => {
    const overlay = document.querySelector(".reference-hud-overlay");
    const segment = document.querySelector(".reference-hud-led__segment");
    const todayArt = overlay.querySelector('image[href="/lifelevel-frames/today.png"]');
    const badge = document.querySelector(".vref-today .vref-heading-link").getBoundingClientRect();
    const todayFluid = document.querySelector(".vref-today > .fluid-mechanical-frame");
    return {
      visible: getComputedStyle(overlay).display === "block",
      pointerEvents: getComputedStyle(overlay).pointerEvents,
      assetCount: overlay.querySelectorAll("svg image").length,
      todayLayerCount: Number(Boolean(todayArt)) + Number(getComputedStyle(todayFluid).display !== "none"),
      todayTitleGap: badge.left - (todayArt.getBoundingClientRect().x + 79),
      animation: getComputedStyle(segment).animationName,
      playState: getComputedStyle(segment).animationPlayState,
      visibility: document.visibilityState,
      activeAnimationTime: segment.getAnimations()[0]?.currentTime ?? null,
      before: getComputedStyle(segment).strokeDashoffset,
      background: getComputedStyle(document.querySelector(".game-shell.lobby-view")).backgroundImage.includes("cyberpunk-bg.png"),
    };
  });
  await desktop.page.waitForTimeout(250);
  exact.after = await desktop.page.locator(".reference-hud-led__segment").first().evaluate(element => getComputedStyle(element).strokeDashoffset);
  if (exact.after === exact.before) {
    await desktop.page.waitForTimeout(1000);
    exact.after = await desktop.page.locator(".reference-hud-led__segment").first().evaluate(element => getComputedStyle(element).strokeDashoffset);
  }
  exact.afterAnimationTime = await desktop.page.locator(".reference-hud-led__segment").first().evaluate(element => element.getAnimations()[0]?.currentTime ?? null);
  exact.traveling = exact.before !== exact.after;
  exact.configuredMotion = configuredMotion;
  await desktop.page.locator(".vref-today .vref-heading-link").click();
  exact.clickOpenedSkills = await desktop.page.locator(".game-shell.lobby-view").count() === 0;
  exact.errors = desktop.errors;
  await desktop.context.close();

  const wideDesktop = await lobbyPage(1920, 919, "allow");
  const wide = await wideDesktop.page.evaluate(() => {
    const frames = [...document.querySelectorAll(".fluid-mechanical-frame")].filter(frame => {
      const rect = frame.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(frame).display !== "none";
    });
    const invalid = [];
    for (const frame of frames) {
      const rect = frame.getBoundingClientRect();
      const path = frame.querySelector(".fluid-mechanical-frame__pulse--primary");
      const box = path.getBBox();
      const chassis = frame.querySelector(".fluid-mechanical-frame__chassis");
      const reactors = [...frame.querySelectorAll(".fluid-mechanical-frame__reactor")];
      const pieces = [...frame.querySelectorAll(".fluid-mechanical-frame__tiled-piece")];
      const validChassis = frame.dataset.composition === "tiled-parts"
        ? pieces.length === 9 && pieces.every(piece => {
          const style = getComputedStyle(piece);
          return style.backgroundImage.includes(frame.dataset.frame === "today" ? "lifelevel-frames/today-parts/" : `lifelevel-frames/parts/${frame.dataset.frame}/`) && style.backgroundSize === "auto";
        })
        : chassis && getComputedStyle(chassis).borderImageSource.includes("lifelevel-frames/fluid/");
      const valid = path.getTotalLength() > 0 && box.x >= -2 && box.y >= -2 && box.x + box.width <= rect.width + 2 && box.y + box.height <= rect.height + 2 &&
        getComputedStyle(path).animationName === "fluid-mechanical-lap" &&
        validChassis &&
        reactors.length > 0 && reactors.every(reactor => Math.abs(reactor.getBoundingClientRect().width - reactor.getBoundingClientRect().height) < .1);
      if (!valid) invalid.push({ name: frame.dataset.frame, frame: [Math.round(rect.width), Math.round(rect.height)], path: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] });
    }
    const first = frames[0]?.querySelector(".fluid-mechanical-frame__pulse--primary");
    const today = document.querySelector('.fluid-mechanical-frame[data-frame="today"]');
    const todayRect = today.getBoundingClientRect();
    const badge = document.querySelector(".vref-today .vref-heading-link").getBoundingClientRect();
    const topReactor = today.querySelector(".fluid-mechanical-frame__reactor").getBoundingClientRect();
    return {
      overlayHidden: getComputedStyle(document.querySelector(".reference-hud-overlay")).display === "none",
      visibleFrames: frames.length,
      invalid,
      todayFrame: [todayRect.x, todayRect.y, todayRect.width, todayRect.height].map(value => Math.round(value)),
      todayTitleGap: +(badge.left - topReactor.right).toFixed(2),
      todayReactorSize: [topReactor.width, topReactor.height].map(value => Math.round(value)),
      todayLayerCount: Number(getComputedStyle(today).display !== "none") + Number(getComputedStyle(document.querySelector(".reference-hud-overlay")).display !== "none"),
      firstOffset: first ? getComputedStyle(first).strokeDashoffset : null,
      background: getComputedStyle(document.querySelector(".game-shell.lobby-view")).backgroundImage.includes("cyberpunk-bg.png"),
      serviceWorker: Boolean(navigator.serviceWorker?.controller),
    };
  });
  await wideDesktop.page.waitForTimeout(250);
  wide.secondOffset = await wideDesktop.page.locator(".fluid-mechanical-frame__pulse--primary").first().evaluate(element => getComputedStyle(element).strokeDashoffset);
  if (wide.secondOffset === wide.firstOffset) {
    await wideDesktop.page.waitForTimeout(500);
    wide.secondOffset = await wideDesktop.page.locator(".fluid-mechanical-frame__pulse--primary").first().evaluate(element => getComputedStyle(element).strokeDashoffset);
  }
  wide.traveling = wide.firstOffset !== wide.secondOffset;
  await wideDesktop.page.locator(".vref-today .vref-heading-link").click();
  wide.titleClickWorks = await wideDesktop.page.locator(".game-shell.lobby-view").count() === 0;
  wide.errors = wideDesktop.errors;
  await wideDesktop.context.close();

  const responsive = await lobbyPage(1280, 800);
  const fluid = await responsive.page.evaluate(() => {
    const overlayHidden = getComputedStyle(document.querySelector(".reference-hud-overlay")).display === "none";
    const frames = [...document.querySelectorAll(".fluid-mechanical-frame")].filter(frame => {
      const rect = frame.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(frame).display !== "none";
    });
    const invalid = [];
    for (const frame of frames) {
      const path = frame.querySelector(".fluid-mechanical-frame__pulse");
      const rect = frame.getBoundingClientRect();
      const box = path.getBBox();
      const sprites = [...frame.querySelectorAll(".fluid-mechanical-frame__reactor")];
      const round = sprites.every(sprite => Math.abs(sprite.getBoundingClientRect().width - sprite.getBoundingClientRect().height) < 0.1);
      const valid = path.getTotalLength() > 0 && box.x >= -2 && box.y >= -2 && box.x + box.width <= rect.width + 2 && box.y + box.height <= rect.height + 2 && round && getComputedStyle(frame).pointerEvents === "none" && getComputedStyle(path).animationName === "fluid-mechanical-lap";
      if (!valid) invalid.push({ name: frame.dataset.frame, pathLength: Math.round(path.getTotalLength()), box: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)], frame: [Math.round(rect.width), Math.round(rect.height)], round });
    }
    return { overlayHidden, visibleFrames: frames.length, invalid, background: getComputedStyle(document.querySelector(".game-shell.lobby-view")).backgroundImage.includes("cyberpunk-bg.png") };
  });
  await responsive.page.emulateMedia({ reducedMotion: "reduce" });
  fluid.reducedMotionHidden = await responsive.page.locator(".fluid-mechanical-frame__pulse").first().evaluate(element => getComputedStyle(element).display === "none");
  fluid.errors = responsive.errors;
  await responsive.context.close();

  const mobile = await lobbyPage(390, 844);
  const narrow = await mobile.page.evaluate(() => ({
    overlayHidden: getComputedStyle(document.querySelector(".reference-hud-overlay")).display === "none",
    cityVisible: getComputedStyle(document.querySelector(".game-shell.lobby-view")).backgroundImage.includes("cyberpunk-bg.png"),
    validPaths: [...document.querySelectorAll(".fluid-mechanical-frame__pulse")].every(path => {
      const frame = path.closest(".fluid-mechanical-frame");
      const rect = frame.getBoundingClientRect();
      const box = path.getBBox();
      return path.getTotalLength() > 0 && box.x >= -3 && box.y >= -3 && box.x + box.width <= rect.width + 3 && box.y + box.height <= rect.height + 3;
    }),
    frameCount: document.querySelectorAll(".fluid-mechanical-frame").length,
  }));
  narrow.errors = mobile.errors;
  await mobile.context.close();

  const result = { exact, wide, fluid, narrow };
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ exact: { visible: exact.visible, assets: exact.assetCount, todayLayerCount: exact.todayLayerCount, todayTitleGap: exact.todayTitleGap, traveling: exact.traveling, titleClickWorks: exact.clickOpenedSkills, background: exact.background, errors: exact.errors.length }, wide: { overlayHidden: wide.overlayHidden, visibleFrames: wide.visibleFrames, invalid: wide.invalid, todayFrame: wide.todayFrame, todayTitleGap: wide.todayTitleGap, todayReactorSize: wide.todayReactorSize, todayLayerCount: wide.todayLayerCount, traveling: wide.traveling, titleClickWorks: wide.titleClickWorks, serviceWorker: wide.serviceWorker, background: wide.background, errors: wide.errors.length }, fluid: { overlayHidden: fluid.overlayHidden, visibleFrames: fluid.visibleFrames, invalid: fluid.invalid, reducedMotionHidden: fluid.reducedMotionHidden, background: fluid.background, errors: fluid.errors.length }, narrow: { overlayHidden: narrow.overlayHidden, cityVisible: narrow.cityVisible, validPaths: narrow.validPaths, frameCount: narrow.frameCount, errors: narrow.errors.length }, file: output }));
  if (!exact.visible || exact.pointerEvents !== "none" || exact.assetCount !== 9 || exact.todayLayerCount !== 1 || exact.todayTitleGap < 2 || !exact.traveling || !exact.clickOpenedSkills || !exact.background || exact.errors.length || !wide.overlayHidden || wide.visibleFrames !== 9 || wide.invalid.length || wide.todayFrame[0] !== 256 || wide.todayFrame[1] !== 122 || wide.todayTitleGap < 2 || wide.todayReactorSize[0] !== 79 || wide.todayLayerCount !== 1 || !wide.traveling || !wide.titleClickWorks || !wide.serviceWorker || !wide.background || wide.errors.length || !fluid.overlayHidden || fluid.visibleFrames < 9 || fluid.invalid.length || !fluid.reducedMotionHidden || !fluid.background || fluid.errors.length || !narrow.overlayHidden || !narrow.cityVisible || !narrow.validPaths || narrow.errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
