import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { emptyFinance } from "../../src/finance";
import type { Action } from "../../src/domain/types";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const source = readFileSync(resolve(__dirname, "../../src/components/game/GameApp.tsx"), "utf8");
const declaration = source.slice(source.indexOf("const screens:"), source.indexOf("const groupNames:"));
const screens = [...declaration.matchAll(/\["([a-z]+)","([^"]+)",/g)].map((match) => ({ id: match[1], label: match[2] }));
const orderedScreens = [...screens.filter(screen => screen.id !== "build"), ...screens.filter(screen => screen.id === "build")];
type ApiMode = "ready" | "loading" | "error";

async function fixture(page: Page, mode: ApiMode = "ready", allowCareerSelection = false) {
  let state = createInitialState("ui-first-isolated", NOW);
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() }).state;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const initialGold = state.gold;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requests: { path: string; method: string; action?: string }[] = [];
  let release: () => void = () => undefined;
  const held = new Promise<void>(done => { release = done; });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    const record: { path: string; method: string; action?: string } = { path, method: request.method() };
    requests.push(record);
    if (path === "/api/game") {
      if (mode === "loading") await held;
      if (mode === "error") return route.fulfill({ status: 503, json: { error: "Không thể kết nối thế giới. Vui lòng thử lại." } });
      if (request.method() === "GET") return route.fulfill({ json: { state, mode: "local" } });
      if (request.method() === "POST") {
        const command = request.postDataJSON() as { action: Action };
        record.action = command.action?.type;
        if (command.action?.type !== "reconcile" && !(allowCareerSelection && command.action?.type === "career.select")) return route.fulfill({ status: 422, json: { error: "Kiểm tra giao diện không thực hiện giao dịch." } });
        const result = applyAction(state, command.action, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() });
        state = result.state;
        return route.fulfill({ json: result });
      }
    }
    if (path === "/api/finance" && request.method() === "GET") return route.fulfill({ json: emptyFinance() });
    if (path === "/api/ai" && request.method() === "GET") return route.fulfill({ json: { proposals: [], provider: { name: "unconfigured", configured: false, demo: false } } });
    return route.fulfill({ status: 503, json: { error: "Dịch vụ chưa cấu hình trong phiên kiểm tra giao diện." } });
  });
  return { release, pageErrors, consoleErrors, requests, initialGold, state: () => state };
}

async function navigate(page: Page, screen: { id: string; label: string }) {
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  const button = page.locator(".sidebar nav button").filter({ has: page.locator("span", { hasText: new RegExp(`^${screen.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) });
  await expect(button).toHaveCount(1);
  await button.click();
  if (screen.id !== "build") {
    await expect(page.locator(".breadcrumbs strong")).toHaveText(screen.label);
    await expect(page.locator("main")).toBeVisible();
  } else {
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Xây dựng", exact: true })).toBeVisible();
  }
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("main,.main-shell,.page-content").forEach(element => { element.scrollTop = 0; }); });
  await page.waitForTimeout(350);
}

async function snapshot(page: Page, info: TestInfo, name: string) {
  const diagnostics = await page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth && style.visibility !== "hidden" && style.display !== "none";
    };
    const describe = (element: Element) => ({ tag: element.tagName, className: element.getAttribute("class"), text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 100) });
    const targets = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(visible).filter(element => !element.closest("nextjs-portal")).map(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { ...describe(element), width: box.width, height: box.height, disabled: element.matches(":disabled"), below24: box.width < 24 || box.height < 24, below44: box.width < 44 || box.height < 44, centerObscured: !!hit && hit !== element && !element.contains(hit) };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      overflowingElements: [...document.querySelectorAll("main *,.topbar *,.bottom-nav *")].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }).slice(0, 40).map(describe),
      targets,
      headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map(element => element.textContent),
      visibleCanvasCount: [...document.querySelectorAll("canvas")].filter(visible).length,
    };
  });
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled", timeout: 10000 });
  await info.attach(name, { path, contentType: "image/png" });
  return { screen: name, screenshot: path, ...diagnostics };
}

function persist(info: TestInfo, name: string, value: unknown) {
  const path = info.outputPath(`${name}.json`);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return info.attach(name, { path, contentType: "application/json" });
}

test("24 màn hình điều hướng và ảnh giao diện", async ({ page }, info) => {
  test.setTimeout(180000);
  expect(screens).toHaveLength(24);
  expect(new Set(screens.map(screen => screen.id)).size).toBe(24);
  const game = await fixture(page);
  const observations: Awaited<ReturnType<typeof snapshot>>[] = [];
  const failures: { screen: string; error: string }[] = [];
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".game-shell")).toBeVisible();
    for (const screen of orderedScreens) {
      await test.step(screen.id, async () => {
        try {
          await navigate(page, screen);
          observations.push(await snapshot(page, info, `${String(observations.length + 1).padStart(2, "0")}-${screen.id}`));
        } catch (error) {
          failures.push({ screen: screen.id, error: String(error) });
          await snapshot(page, info, `failure-${screen.id}`).catch(() => undefined);
        }
      });
      if (game.pageErrors.length || failures.length) break;
    }
  } finally {
    await persist(info, "screen-diagnostics", { scope: "Isolated UI fixture; screenshots and geometry diagnostics, not visual parity or live service acceptance", screens, observations, failures, pageErrors: game.pageErrors, consoleErrors: game.consoleErrors, requests: game.requests, initialGold: game.initialGold, finalGold: game.state().gold });
  }
  expect(failures).toEqual([]);
  expect(observations).toHaveLength(24);
  expect(game.pageErrors).toEqual([]);
  expect(game.requests.filter(request => request.method !== "GET" && request.action !== "reconcile")).toEqual([]);
  expect(game.state().gold).toBe(game.initialGold);
  expect(observations.filter(observation => observation.horizontalOverflow > 1).map(observation => ({ screen: observation.screen, overflow: observation.horizontalOverflow }))).toEqual([]);
});

for (const mode of ["loading", "error"] as const) {
  test(`trạng thái ${mode === "loading" ? "đang tải" : "lỗi kết nối"}`, async ({ page }, info) => {
    const game = await fixture(page, mode);
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      if (mode === "loading") await expect(page.getByText("Đang kết nối thế giới của bạn…", { exact: true })).toBeVisible();
      else await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
      await persist(info, `${mode}-diagnostics`, { observation: await snapshot(page, info, mode), pageErrors: game.pageErrors, requests: game.requests });
      expect(game.pageErrors).toEqual([]);
    } finally { game.release(); }
  });
}

test("chẩn đoán stylesheet trang chủ", async ({ page }, info) => {
  const game = await fixture(page);
  const cssResponses: { url: string; status: number; contentType?: string; body?: string; error?: string }[] = [];
  const jobs: Promise<void>[] = [];
  const failedRequests: { url: string; error: string | null }[] = [];
  page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? null }));
  page.on("response", response => {
    if (!response.url().includes(".css")) return;
    jobs.push((async () => {
      const record: typeof cssResponses[number] = { url: response.url(), status: response.status(), contentType: response.headers()["content-type"] };
      try { record.body = await response.text(); } catch (error) { record.error = String(error); }
      cssResponses.push(record);
    })());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".game-shell")).toBeVisible();
  await page.waitForTimeout(500);
  const styles = await page.evaluate(() => {
    const pick = (element: Element) => {
      const style = getComputedStyle(element);
      return { tag: element.tagName, fontFamily: style.fontFamily, color: style.color, background: style.backgroundColor, margin: style.margin, padding: style.padding, boxSizing: style.boxSizing, display: style.display, width: style.width, height: style.height, position: style.position, variables: { foreground: style.getPropertyValue("--foreground"), background: style.getPropertyValue("--background"), shellSidebar: style.getPropertyValue("--shell-sidebar") } };
    };
    return {
      html: pick(document.documentElement), body: pick(document.body), shell: pick(document.querySelector(".game-shell")!),
      stylesheets: [...document.styleSheets].map(sheet => {
        try { return { href: sheet.href, disabled: sheet.disabled, ruleCount: sheet.cssRules.length, rules: [...sheet.cssRules].map(rule => rule.cssText) }; }
        catch (error) { return { href: sheet.href, error: String(error) }; }
      }),
      links: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => ({ href: link.getAttribute("href"), media: link.getAttribute("media") })),
    };
  });
  await Promise.all(jobs);
  await persist(info, "stylesheet-diagnostic", { styles, cssResponses, failedRequests, pageErrors: game.pageErrors, consoleErrors: game.consoleErrors, requests: game.requests });
  await snapshot(page, info, "stylesheet-home");
});

for (const id of ["character", "shop", "finance", "home", "arena", "skills", "career"] as const) {
  test(`tinh chỉnh giao diện ${id}`, async ({ page }, info) => {
    test.setTimeout(60000);
    const game = await fixture(page, "ready", id === "career");
    const keyboard: unknown[] = [];
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".game-shell")).toBeVisible();
    await navigate(page, screens.find(screen => screen.id === id)!);
    if (id !== "finance" && id !== "skills" && id !== "career") await expect(page.locator(id === "shop" ? ".equipment-shop-preview canvas" : id === "home" ? ".world-canvas canvas" : id === "arena" ? ".combat-viewport canvas" : ".studio-canvas canvas")).toBeVisible();
    await page.waitForTimeout(700);
    const initial = await snapshot(page, info, `${id}-initial`);
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, position: getComputedStyle(element).position };
      };
      const canvas = document.querySelector<HTMLCanvasElement>(".equipment-shop-preview canvas,.studio-canvas canvas,.world-canvas canvas");
      const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
      return { saveBar: box(".studio-save-bar"), characterCanvas: box(".studio-canvas"), preview: box(".equipment-shop-preview"), filters: box(".equipment-shop-filters"), canvas: canvas ? { ...box(".equipment-shop-preview canvas,.studio-canvas canvas,.world-canvas canvas"), bufferWidth: canvas.width, bufferHeight: canvas.height, contextLost: gl?.isContextLost() ?? null } : null, financeText: document.querySelector("main")?.textContent, monthInputs: [...document.querySelectorAll<HTMLInputElement>('input[type="month"]')].map(input => ({ value: input.value, parentText: input.parentElement?.textContent, label: input.getAttribute("aria-label") })) };
    });
    if (id === "career") {
      await expect(page.getByRole("button", { name: "Đang theo đuổi", exact: true })).toBeDisabled();
      const choices = page.getByRole("button", { name: "Chọn nghề nghiệp", exact: true });
      await expect(choices).toHaveCount(4);
      await expect(page.getByRole("button", { name: "Xét thăng hạng", exact: true })).toBeVisible();
      await choices.last().scrollIntoViewIfNeeded();
      await choices.last().focus();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const focused = await choices.last().evaluate(element => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { width: rect.width, height: rect.height, centerUnobscured: !!hit && (element === hit || element.contains(hit)) };
      });
      expect(focused.width).toBeGreaterThanOrEqual(44);
      expect(focused.height).toBeGreaterThanOrEqual(44);
      expect(focused.centerUnobscured).toBe(true);
      const focusedView = await snapshot(page, info, "career-focused-last");
      expect(focusedView.horizontalOverflow).toBeLessThanOrEqual(1);
      await persist(info, "career-focus", focused);
      await choices.first().click();
      await expect.poll(() => game.state().character.career).toBe("accounting");
      await expect(page.getByRole("button", { name: "Đang theo đuổi", exact: true })).toBeDisabled();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".game-shell")).toBeVisible();
      await navigate(page, screens.find(screen => screen.id === "career")!);
      await expect(page.getByRole("button", { name: "Đang theo đuổi", exact: true })).toBeDisabled();
      expect(game.state().character.career).toBe("accounting");
      expect(game.state().character.careerRank).toBe(0);
      await expect(page.locator("#career-current-title")).toHaveText("Kế toán");
      await expect(page.locator('article[aria-labelledby="career-accounting-title"]')).toHaveAttribute("data-selected", "true");
      const reloadedView = await snapshot(page, info, "career-selected-reloaded");
      expect(reloadedView.horizontalOverflow).toBeLessThanOrEqual(1);
    }
    if (id === "skills") {
      const nodes = page.locator(".ref-skill-branch button");
      const styles = await nodes.evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundImage, borderWidth: style.borderTopWidth, borderStyle: style.borderTopStyle };
      }));
      expect(styles.length).toBeGreaterThan(0);
      for (const style of styles) {
        expect(style.background).not.toBe("none");
        expect(parseFloat(style.borderWidth)).toBeGreaterThan(0);
        expect(style.borderStyle).toBe("solid");
      }
      const last = nodes.last();
      await last.scrollIntoViewIfNeeded();
      await last.click();
      await expect(last).toHaveAttribute("aria-pressed", "true");
      await snapshot(page, info, "skills-selected");
      await persist(info, "skills-node-surfaces", styles);
    }
    if (id === "arena") {
      const pause = page.getByRole("button", { name: "Tạm dừng hoạt ảnh", exact: true });
      await pause.scrollIntoViewIfNeeded();
      await pause.click();
      await expect(page.getByRole("button", { name: "Tiếp tục hoạt ảnh", exact: true })).toBeVisible();
      const arena = await page.evaluate(() => {
        const rect = (selector: string) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        const canvas = document.querySelector<HTMLCanvasElement>(".combat-viewport canvas")!;
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        return { viewport: rect(".combat-viewport"), boss: rect(".combat-boss-hud"), player: rect(".combat-player-hud"), contextLost: gl?.isContextLost() };
      });
      expect(arena.contextLost).toBe(false);
      if (info.project.name === "mobile") {
        expect(arena.boss.bottom).toBeLessThanOrEqual(arena.viewport.top + 1);
        expect(arena.player.top).toBeGreaterThanOrEqual(arena.viewport.bottom - 1);
      }
      await snapshot(page, info, "arena-paused");
      await persist(info, "arena-layout", arena);
    }
    if (id === "shop") {
      await page.locator(".ref-destinations button").last().focus();
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(async () => {
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          const element = document.activeElement;
          const rect = element?.getBoundingClientRect();
          const hit = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
          const nav = document.querySelector(".bottom-nav")?.getBoundingClientRect();
          return { tag: element?.tagName, label: element?.getAttribute("aria-label"), text: element?.textContent, placeholder: element?.getAttribute("placeholder"), region: element?.closest(".equipment-shop-filters,.equipment-shop-preview,.ref-collection")?.className, x: rect?.x, y: rect?.y, width: rect?.width, height: rect?.height, bottom: rect?.bottom, centerHit: hit?.tagName, centerHitClass: hit?.getAttribute("class"), centerUnobscured: !!element && !!hit && (element === hit || element.contains(hit)), bottomNavTop: nav?.top };
        });
        keyboard.push(focus);
        if (focus.tag === "SELECT" && focus.text === "Mọi cấpĐủ cấp sử dụngChưa đủ cấp") {
          await snapshot(page, info, "shop-focused-level-select");
        }
      }
      await snapshot(page, info, "shop-keyboard-final");
    }
    await persist(info, "polish-diagnostics", { id, initial, geometry, keyboard, pageErrors: game.pageErrors, consoleErrors: game.consoleErrors, requests: game.requests, initialGold: game.initialGold, finalGold: game.state().gold });
    expect(game.pageErrors).toEqual([]);
    expect(game.consoleErrors).toEqual([]);
    const mutations = game.requests.filter(request => request.method !== "GET" && request.action !== "reconcile");
    expect(mutations.map(request => request.action)).toEqual(id === "career" ? ["career.select"] : []);
    expect(game.state().gold).toBe(game.initialGold);
    expect(initial.horizontalOverflow).toBeLessThanOrEqual(1);
    if (geometry.canvas) expect(geometry.canvas.contextLost).toBe(false);
    if (id === "character" && info.project.name === "mobile") {
      expect(geometry.saveBar?.position).toBe("static");
      expect(geometry.saveBar!.y).toBeGreaterThanOrEqual(geometry.characterCanvas!.bottom);
    }
    if (id === "shop" && info.project.name === "mobile") {
      expect(geometry.preview!.y).toBeLessThan(geometry.filters!.y);
      expect(geometry.canvas!.y).toBeLessThan(844 - 64);
    }
    if (id === "finance") {
      expect(geometry.financeText).not.toContain("MONTHLY CASHFLOW");
      expect(geometry.financeText).not.toContain("EXPENSE COMPOSITION");
      expect(geometry.monthInputs).toHaveLength(1);
    }
  });
}

test("tài chính trống và NOVA chưa cấu hình", async ({ page }, info) => {
  const game = await fixture(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".game-shell")).toBeVisible();
  for (const id of ["finance", "butler"]) {
    const screen = screens.find(screen => screen.id === id);
    expect(screen).toBeDefined();
    await navigate(page, screen!);
    if (id === "finance") await expect(page.getByRole("status")).toHaveCount(0);
    else {
      await expect(page.getByText("NOVA đang chờ kết nối", { exact: true })).toBeVisible();
      await expect(page.locator(".nova-hologram canvas")).toBeVisible();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(page.locator("#nova-prompt")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Tạo đề xuất", exact: true })).toBeDisabled();
    }
    await persist(info, `${id}-empty-diagnostics`, await snapshot(page, info, `${id}-empty`));
  }
  expect(game.pageErrors).toEqual([]);
  expect(game.requests.every(request => request.method === "GET" || request.action === "reconcile")).toBe(true);
});
