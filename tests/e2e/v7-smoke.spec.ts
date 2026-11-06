import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createInitialState, applyAction } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { COSMETICS } from "../../src/character/catalog";
import { STARTER_FURNITURE_IDS } from "../../src/housing/catalog";

const NOW = "2026-10-16T08:00:00.000Z";
type Command = { key: string; action: Action };
type FailureMode = "none" | "reject-first-settle" | "lose-first-settle-response";
type FixtureOptions = { delayedOwnerResponse?: boolean; ownerChangedFirstMutation?: boolean };
type BrowserGame = { state: () => GameState; commands: Command[]; errors: string[]; getCount: () => number; switchToOwnerB: () => void; switchToOwnerA: () => void; releaseDelayedResponse: () => void };

async function isolatedGame(page: Page, failure: FailureMode = "none", options: FixtureOptions = {}): Promise<BrowserGame> {
  let state = createInitialState("v7-browser-fixture", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  let ownerA = state;
  const commands: Command[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  const errors: string[] = [];
  let getCount = 0;
  let failed = false;
  let switched = false;
  let delayed = false;
  let releaseDelayedResponse: () => void = () => undefined;
  const delayedResponse = new Promise<void>(resolve => { releaseDelayedResponse = resolve; });
  const ownerB = createInitialState("v7-browser-owner-b", NOW);
  ownerB.character.name = "Owner B";
  ownerB.settings.graphics = "performance";
  ownerB.settings.reducedMotion = true;
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    // The real app reads auth status during startup. This browser fixture is
    // intentionally a local guest and must not fall through to a fake 503.
    if (pathname === "/api/auth" && request.method() === "GET") {
      await route.fulfill({ json: { authenticated: false, account: null, guestSaveAvailable: false, localMode: true } });
      return;
    }
    if (pathname === "/api/game/intent" && request.method() === "GET") {
      const ownerId = switched ? ownerB.userId : state.userId;
      const expectedOwnerId = new URL(request.url()).searchParams.get("expectedOwnerId");
      if (expectedOwnerId && expectedOwnerId !== ownerId) {
        await route.fulfill({ status: 409, json: { code: "OWNER_CHANGED", error: "Phiên người chơi đã thay đổi." } });
        return;
      }
      await route.fulfill({ json: { ownerId, mode: "local", intent: null } });
      return;
    }
    if (pathname !== "/api/game") {
      await route.fulfill({ status: 503, json: { error: "API ngoài phạm vi kiểm thử giao diện." } });
      return;
    }
    if (request.method() === "GET") {
      getCount += 1;
      if (switched) state = ownerB;
      await route.fulfill({ json: { state, mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "Phương thức không được hỗ trợ." } });
      return;
    }
    const payload = request.postDataJSON() as Command & { expectedOwnerId?: unknown };
    const command: Command = payload;
    commands.push(structuredClone(command));
    if (options.ownerChangedFirstMutation && !failed && command.action.type !== "reconcile") {
      failed = true;
      ownerA = state;
      state = ownerB;
      switched = true;
    }
    if (typeof payload.expectedOwnerId === "string" && payload.expectedOwnerId !== state.userId) {
      await route.fulfill({ status: 409, json: { error: "Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.", code: "OWNER_CHANGED" } });
      return;
    }
    if (!failed && failure === "reject-first-settle" && command.action.type === "housing.settle") {
      failed = true;
      await route.fulfill({ status: 422, json: { error: "Không thể nhận nhà trong lần thử này. Vui lòng thử lại." } });
      return;
    }
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) {
      await route.fulfill({ status: 409, json: { error: "Mã thao tác đã được dùng cho nội dung khác." } });
      return;
    }
    try {
      let result: ActionResult;
      if (previous) result = { ...previous.result, state };
      else {
        const context = { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() };
        if (command.action.type !== "reconcile") state = applyAction(state, { type: "reconcile" }, { ...context, eventId: randomUUID() }).state;
        result = applyAction(state, command.action, context);
        state = result.state;
        if (command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      }
      if (options.delayedOwnerResponse && !delayed && command.action.type !== "reconcile") {
        delayed = true;
        await delayedResponse;
      }
      if (!failed && failure === "lose-first-settle-response" && command.action.type === "housing.settle") {
        failed = true;
        await route.abort("connectionreset");
        return;
      }
      await route.fulfill({ json: result });
    } catch (error) {
      await route.fulfill({ status: 422, json: { error: error instanceof Error ? error.message : "Thao tác không hợp lệ." } });
    }
  });
  return {
    state: () => state,
    commands,
    errors,
    getCount: () => getCount,
    switchToOwnerB: () => { ownerA = state; switched = true; },
    switchToOwnerA: () => { state = ownerA; switched = false; },
    releaseDelayedResponse: () => releaseDelayedResponse(),
  };
}

async function capture(page: Page, info: TestInfo, name: string, fullPage = true) {
  const screenshot = info.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshot, fullPage, animations: "disabled" });
  await info.attach(name, { path: screenshot, contentType: "image/png" });
}

async function expectDialogFits(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
}

async function captureHousingStep(page: Page, info: TestInfo, name: string) {
  await capture(page, info, `housing-${name}`, false);
  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom };
    };
    return { viewport: { width: window.innerWidth, height: window.innerHeight }, dialog: rect('[role="dialog"]'), canvas: rect('.housing-preview canvas') };
  });
  const path = info.outputPath(`housing-${name}-bounds.json`);
  writeFileSync(path, JSON.stringify(bounds, null, 2));
  await info.attach(`housing-${name}-bounds`, { path, contentType: "application/json" });
  const canvas = page.locator(".housing-preview canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const context = surface.getContext("webgl2") ?? surface.getContext("webgl");
    return Number(surface.dataset.housingDraws ?? 0) > 0 && context?.isContextLost() === false;
  }), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await capture(page, info, `housing-${name}-rendered`, false);
  const rendered = await canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const context = surface.getContext("webgl2") ?? surface.getContext("webgl");
    const box = surface.getBoundingClientRect();
    return { canvasId: surface.dataset.housingCanvasId, draws: Number(surface.dataset.housingDraws ?? 0), contextLost: context?.isContextLost() ?? null, bufferWidth: surface.width, bufferHeight: surface.height, bounds: { x: box.x, y: box.y, width: box.width, height: box.height } };
  });
  const renderedPath = info.outputPath(`housing-${name}-rendered.json`);
  writeFileSync(renderedPath, JSON.stringify(rendered, null, 2));
  await info.attach(`housing-${name}-rendered`, { path: renderedPath, contentType: "application/json" });
}

async function enterCharacter(page: Page, info?: TestInfo) {
  if (info) await page.addInitScript(() => {
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
        const target = prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
        const original = target[method];
        if (!original || !Object.prototype.hasOwnProperty.call(prototype, method)) continue;
        target[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          const result = original.apply(this, args);
          if (this.canvas instanceof HTMLCanvasElement) {
            this.canvas.dataset.housingCanvasId ??= crypto.randomUUID();
            this.canvas.dataset.housingDraws = String(Number(this.canvas.dataset.housingDraws ?? 0) + 1);
          }
          return result;
        };
      }
    }
  });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  if (info) await captureHousingStep(page, info, "welcome");
  await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).click();
  await expect(page.getByLabel("Tên nhân vật", { exact: true })).toBeVisible();
}

async function selectHome(page: Page, info?: TestInfo) {
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục", exact: true }).click();
  if (info) await captureHousingStep(page, info, "district");
  await page.getByRole("button", { name: /Aurora Tower/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục", exact: true }).click();
  if (info) await captureHousingStep(page, info, "floor");
  await page.getByRole("button", { name: /24 Chạm đến bầu trời/ }).click();
  await expect(page.getByRole("button", { name: /24 Chạm đến bầu trời/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục", exact: true }).click();
  if (info) await captureHousingStep(page, info, "layout");
  await page.getByRole("button", { name: /Một phòng ngủ/ }).click();
  await expect(page.getByRole("button", { name: /Một phòng ngủ/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bộ nội thất chào mừng" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true })).toBeVisible();
}

test("phản hồi chậm của chủ cũ không ghi đè bộ nhớ chủ mới", async ({ page }) => {
  const game = await isolatedGame(page, "none", { delayedOwnerResponse: true });
  await enterCharacter(page);
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Owner A");
  await page.getByRole("button", { name: "Lưu ngoại hình", exact: true }).click();
  await expect.poll(() => game.commands.some(command => command.action.type === "character.update")).toBe(true);
  game.switchToOwnerB();
  await page.evaluate(() => {
    localStorage.setItem("lifelevel-state-changed", JSON.stringify({ ownerId: "v7-browser-owner-b", revision: 0, at: Date.now() }));
    window.dispatchEvent(new StorageEvent("storage", { key: "lifelevel-state-changed" }));
  });
  await expect.poll(() => game.state().userId).toBe("v7-browser-owner-b");
  await expect(page.locator(".hud-identity strong")).toHaveText("Owner B");
  await expect(page.getByRole("button", { name: "Bắt đầu hành trình", exact: true })).toBeVisible();
  const first = game.commands.find(command => command.action.type === "character.update")!;
  game.releaseDelayedResponse();
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held?.some(lock => lock.name === "lifelevel-command:v7-browser-fixture") ?? false)).toBe(false);
  const pending = () => page.evaluate(() => JSON.parse(localStorage.getItem("lifelevel-pending-command:v7-browser-fixture") ?? "null") as { key: string } | null);
  await expect.poll(async () => (await pending())?.key).toBe(first.key);
  await expect(page.locator(".hud-identity strong")).toHaveText("Owner B");
  await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).click();
  await expect(page.getByLabel("Tên nhân vật", { exact: true })).toHaveValue("Owner B");
  expect(game.state().character.name).toBe("Owner B");
  game.switchToOwnerA();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "lifelevel-state-changed" })));
  await expect(page.locator(".hud-identity strong")).toHaveText("Owner A");
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect.poll(pending).toBeNull();
  const retries = game.commands.filter(command => command.action.type === "character.update");
  expect(retries).toHaveLength(2);
  expect(retries[1].key).toBe(first.key);
  expect(retries[1].action).toEqual(first.action);
  expect(game.errors).toEqual([]);
});

test("OWNER_CHANGED giữ mã thao tác của A qua phiên B và thử lại khi trở về A", async ({ page }) => {
  const game = await isolatedGame(page, "none", { ownerChangedFirstMutation: true });
  await enterCharacter(page);
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Owner A Retry");
  await page.getByRole("button", { name: "Lưu ngoại hình", exact: true }).click();
  await expect(page.getByText("Phiên người chơi đã thay đổi. Tải lại trang trước khi tiếp tục.", { exact: true })).toBeVisible();
  const first = game.commands.find(command => command.action.type === "character.update")!;
  const pendingKey = "lifelevel-pending-command:v7-browser-fixture";
  const pending = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null") as { key: string } | null, pendingKey);
  await expect.poll(async () => (await pending())?.key).toBe(first.key);
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "lifelevel-state-changed" })));
  await expect(page.locator(".hud-identity strong")).toHaveText("Owner B");
  await expect.poll(async () => (await pending())?.key).toBe(first.key);
  expect(game.state().character.name).toBe("Owner B");
  expect(game.commands.filter(command => command.action.type === "character.update")).toHaveLength(1);
  game.switchToOwnerA();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "lifelevel-state-changed" })));
  await expect(page.locator(".hud-identity strong")).toHaveText("Runner");
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect.poll(() => game.state().character.name).toBe("Owner A Retry");
  await expect.poll(pending).toBeNull();
  const retries = game.commands.filter(command => command.action.type === "character.update");
  expect(retries).toHaveLength(2);
  expect(retries[1].key).toBe(first.key);
  expect(retries[1].action).toEqual(first.action);
  expect(game.state().gold).toBe(0);
  expect(game.errors).toEqual([]);
});

test("hai thẻ dùng Web Locks không gửi hai lần ý định nhận nhà", async ({ page, context }, info) => {
  const storageEvents: string[] = [];
  await context.addInitScript(() => {
    for (const method of ["setItem", "removeItem"] as const) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function(key: string, value?: string) {
        if (key.startsWith("lifelevel-")) console.debug("storage-observation", JSON.stringify({ method, key, value, at: Date.now() }));
        return method === "setItem" ? original.call(this, key, value!) : original.call(this, key, "");
      };
    }
  });
  page.on("console", message => { if (message.text().startsWith("storage-observation")) storageEvents.push(`A ${message.text()}`); });
  const game = await isolatedGame(page, "none", { delayedOwnerResponse: true });
  const second = await context.newPage();
  second.on("console", message => { if (message.text().startsWith("storage-observation")) storageEvents.push(`B ${message.text()}`); });
  second.on("pageerror", error => game.errors.push(error.message));
  await enterCharacter(page);
  await selectHome(page);
  await enterCharacter(second);
  await selectHome(second);
  const lockName = "lifelevel-command:v7-browser-fixture";
  await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect.poll(() => game.commands.filter(command => command.action.type === "housing.settle").length).toBe(1);
  const first = game.commands.find(command => command.action.type === "housing.settle")!;
  await second.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect.poll(() => second.evaluate(async name => (await navigator.locks.query()).pending?.some(lock => lock.name === name) ?? false, lockName)).toBe(true);
  expect(game.commands.filter(command => command.action.type === "housing.settle")).toHaveLength(1);
  await expect.poll(() => second.evaluate(() => JSON.parse(localStorage.getItem("lifelevel-pending-command:v7-browser-fixture") ?? "null")?.key)).toBe(first.key);
  game.releaseDelayedResponse();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(second.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => second.evaluate(async name => {
    const locks = await navigator.locks.query();
    return [...locks.held ?? [], ...locks.pending ?? []].filter(lock => lock.name === name).length;
  }, lockName)).toBe(0);
  await info.attach("two-tab-storage", { body: JSON.stringify({ storageEvents, commands: game.commands, revision: game.state().revision, tabA: await page.locator("body").innerText(), tabB: await second.locator("body").innerText() }, null, 2), contentType: "application/json" });
  expect(game.commands.filter(command => command.action.type === "housing.settle")).toHaveLength(1);
  expect(game.state().residence?.buildingId).toBe("aurora-tower");
  for (const id of STARTER_FURNITURE_IDS) expect(game.state().ownedFurniture[id]).toBe(1);
  expect(game.state().gold).toBe(0);
  expect(game.errors).toEqual([]);
  await second.close();
});

test("fixture từ chối expectedOwnerId không khớp", async ({ page }) => {
  const game = await isolatedGame(page);
  await page.goto("/");
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "owner-mismatch", expectedOwnerId: "wrong-owner", action: { type: "reconcile" } }) });
    return { status: result.status, body: await result.json() as { error?: string } };
  });
  expect(response.status).toBe(409);
  expect(response.body.error).toContain("Phiên người chơi đã thay đổi");
  expect(game.errors).toEqual([]);
});

test("cửa hàng nội thất lọc món sở hữu và xem trước không giao dịch", async ({ page }, info) => {
  const messages: string[] = [];
  page.on("console", message => { if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`); });
  const game = await isolatedGame(page);
  game.state().ownedFurniture["cloud-bed"] = 1;
  await page.goto("/");
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const mobileMenu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Nội thất", exact: true }).click();
  const closeMenu = page.getByRole("button", { name: "Đóng điều hướng", exact: true });
  if (await closeMenu.isVisible()) await closeMenu.click();
  await expect(page.getByRole("heading", { name: "Chọn món làm nên căn nhà.", exact: true })).toBeVisible();
  const gold = game.state().gold;
  const commandCount = game.commands.filter(command => command.action.type !== "reconcile").length;
  const bedsCategory = page.getByRole("complementary", { name: "Danh mục nội thất" }).getByRole("button", { name: /Giường/ });
  await bedsCategory.click();
  await expect(bedsCategory).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Tìm nội thất", { exact: true }).fill("zz-no-furniture-match");
  await expect(page.getByText("Chưa có món phù hợp", { exact: true })).toBeVisible();
  await page.getByLabel("Tìm nội thất", { exact: true }).fill("cloud");
  await page.getByRole("checkbox", { name: "Chỉ đã sở hữu" }).check();
  await expect(page.getByRole("button", { name: /Xem trước/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Xem trước/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Xem trước/ }).first().click();
  await expect(page.getByRole("complementary", { name: /Thông tin/ })).toBeVisible();
  const previewCanvas = page.locator(".furniture-showcase canvas");
  await expect(previewCanvas).toBeVisible();
  await previewCanvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await previewCanvas.screenshot()).byteLength).toBeGreaterThan(10_000);
  await capture(page, info, "furniture-owned-preview");
  await info.attach("furniture-console", { body: JSON.stringify(messages, null, 2), contentType: "application/json" });
  expect(game.commands.filter(command => command.action.type !== "reconcile")).toHaveLength(commandCount);
  expect(game.state().gold).toBe(gold);
  expect(game.errors).toEqual([]);
});

test("cửa hàng trang bị xem mô hình miễn phí không giao dịch", async ({ page }, info) => {
  const messages: string[] = [];
  page.on("console", message => { if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`); });
  const game = await isolatedGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await page.locator(".wallet-chip").click();
  await expect(page.getByRole("heading", { name: "Sàn giao dịch", exact: true })).toBeVisible();
  const gold = game.state().gold;
  const inventory = structuredClone(game.state().inventory);
  const commands = game.commands.filter(command => command.action.type !== "reconcile").length;
  const cards = page.locator(".ref-collection .ref-slot");
  await expect(cards).toHaveCount(12);
  await expect(page.locator(".equipment-shop canvas")).toHaveCount(1);
  const selectedTitle = page.locator(".equipment-shop-preview h3");
  const firstTitle = await selectedTitle.textContent();
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Phân trang trang bị" })).toContainText("Trang 2 /");
  await expect(cards).toHaveCount(12);
  await expect(selectedTitle).toHaveText(firstTitle!);
  await expect(page.locator(".equipment-shop canvas")).toHaveCount(1);
  await capture(page, info, "equipment-page-two");
  if (info.project.name === "mobile-chromium") {
    await page.getByRole("navigation", { name: "Phân trang trang bị" }).evaluate(element => element.scrollIntoView({ block: "start" }));
    await capture(page, info, "equipment-page-two-viewport", false);
  }
  await page.getByLabel("Tìm trang bị", { exact: true }).fill("zz-no-equipment-match");
  await expect(page.getByRole("status").filter({ hasText: "0 trang bị phù hợp" })).toBeVisible();
  await expect(cards).toHaveCount(0);
  await expect(selectedTitle).toHaveText(firstTitle!);
  await page.getByLabel("Tìm trang bị", { exact: true }).fill("cyber-katana");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("data-shop-item-id", "cyber-katana");
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
  await expect(cards).toHaveCount(12);
  await expect(page.getByRole("navigation", { name: "Phân trang trang bị" })).toContainText("Trang 1 /");
  const preview = page.getByRole("complementary", { name: "Chi tiết trang bị đang chọn" });
  await expect(preview).toHaveCSS("position", info.project.name === "desktop-chromium" ? "sticky" : "static");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(cards.first()).toBeVisible();
  for (const index of [0, 1]) {
    await cards.nth(index).click();
    await expect(cards.nth(index)).toHaveAttribute("aria-pressed", "true");
    const canvas = page.locator(".ref-inspector canvas");
    await expect(canvas).toBeVisible();
    if (info.project.name === "mobile-chromium") {
      const selectedBar = page.getByRole("region", { name: "Trang bị đang chọn" });
      await expect(selectedBar).toBeVisible();
      await expect(selectedBar).toHaveAttribute("data-selected-item-id", (await cards.nth(index).getAttribute("data-shop-item-id"))!);
      const barBounds = await selectedBar.boundingBox();
      const navigationBounds = await page.locator(".bottom-nav").boundingBox();
      expect(barBounds).not.toBeNull();
      expect(navigationBounds).not.toBeNull();
      expect(barBounds!.y + barBounds!.height).toBeLessThanOrEqual(navigationBounds!.y + 1);
      await capture(page, info, `equipment-selection-${index + 1}-viewport`, false);
      await selectedBar.getByRole("button", { name: "Xem mô hình đã chọn", exact: true }).click();
      await expect(preview).toBeFocused();
      await expect(canvas).toBeInViewport({ ratio: .5 });
    } else await canvas.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await canvas.screenshot()).byteLength).toBeGreaterThan(10_000);
    await capture(page, info, `equipment-preview-${index + 1}`);
    if (info.project.name === "mobile-chromium") {
      await canvas.evaluate(element => element.scrollIntoView({ block: "center" }));
      await capture(page, info, `equipment-preview-${index + 1}-viewport`, false);
    }
  }
  await info.attach("equipment-console", { body: JSON.stringify(messages, null, 2), contentType: "application/json" });
  expect(game.commands.filter(command => command.action.type !== "reconcile")).toHaveLength(commands);
  expect(game.state().gold).toBe(gold);
  expect(game.state().inventory).toEqual(inventory);
  expect(game.errors).toEqual([]);
});

test("ảnh kiểm tra nhân vật toàn thân cận mặt và tủ đồ", async ({ page }, info) => {
  const game = await isolatedGame(page);
  await enterCharacter(page);
  const canvas = page.locator(".studio-canvas canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const context = surface.getContext("webgl2") ?? surface.getContext("webgl");
    return context?.isContextLost() ?? true;
  })).toBe(false);
  await page.getByRole("button", { name: "Toàn thân", exact: true }).click();
  await page.locator(".studio-canvas").evaluate(element => element.scrollIntoView({ block: "start" }));
  await expect.poll(async () => (await canvas.screenshot()).byteLength).toBeGreaterThan(10_000);
  await capture(page, info, "creator-full-body");
  const fullControls = page.locator(".studio-camera");
  await fullControls.evaluate(element => element.scrollIntoView({ block: "center" }));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(fullControls).toBeVisible();
  const fullGeometry = await fullControls.locator("button").evaluateAll((buttons) => buttons.map(button => {
    const box = button.getBoundingClientRect(), body = document.querySelector(".housing-body")?.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { label: button.getAttribute("aria-label") || button.textContent?.trim(), x: box.x, y: box.y, width: box.width, height: box.height, inViewport: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth, inHousingBody: !!body && box.top >= body.top && box.bottom <= body.bottom, centerHit: !!hit && (hit === button || button.contains(hit)) };
  }));
  expect(fullGeometry).toHaveLength(7);
  for (const button of fullGeometry) { expect(button.inViewport).toBe(true); expect(button.inHousingBody).toBe(true); expect(button.centerHit).toBe(true); }
  await capture(page, info, "creator-full-body-controls");
  await page.getByRole("button", { name: "Cận mặt", exact: true }).click();
  await page.locator(".studio-canvas").evaluate(element => element.scrollIntoView({ block: "start" }));
  await expect.poll(async () => (await canvas.screenshot()).byteLength).toBeGreaterThan(10_000);
  await capture(page, info, "creator-head");
  const headControls = page.locator(".studio-camera");
  await headControls.evaluate(element => element.scrollIntoView({ block: "center" }));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(headControls).toBeVisible();
  const headGeometry = await headControls.locator("button").evaluateAll((buttons) => buttons.map(button => {
    const box = button.getBoundingClientRect(), body = document.querySelector(".housing-body")?.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { label: button.getAttribute("aria-label") || button.textContent?.trim(), x: box.x, y: box.y, width: box.width, height: box.height, inViewport: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth, inHousingBody: !!body && box.top >= body.top && box.bottom <= body.bottom, centerHit: !!hit && (hit === button || button.contains(hit)) };
  }));
  expect(headGeometry).toHaveLength(7);
  for (const button of headGeometry) { expect(button.inViewport).toBe(true); expect(button.inHousingBody).toBe(true); expect(button.centerHit).toBe(true); }
  await capture(page, info, "creator-head-controls");
  await page.getByRole("button", { name: "Tủ đồ", exact: true }).click();
  await capture(page, info, "creator-wardrobe");
  expect(game.errors).toEqual([]);
});

test("nhận nhà và ngoại hình được giữ sau tải lại, không trừ vàng", async ({ page }, info) => {
  const game = await isolatedGame(page);
  const gold = game.state().gold;
  await enterCharacter(page, info);
  await expectDialogFits(page);
  await page.getByLabel("Tên nhân vật", { exact: true }).fill("Minh Neon");
  await page.getByRole("button", { name: "Vóc dáng", exact: true }).click();
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await page.getByRole("button", { name: "Lưu ngoại hình", exact: true }).click();
  await expect.poll(() => game.state().character.name).toBe("Minh Neon");
  expect(game.state().character.appearance?.body).toBe("athletic");
  expect(game.state().gold).toBe(gold);
  await capture(page, info, "character-saved");
  await selectHome(page, info);
  await expectDialogFits(page);
  await expect(page.locator(".housing-preview canvas")).toBeVisible();
  await capture(page, info, "housing-confirmation");
  await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(game.state().residence).toMatchObject({ districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "one-bedroom" });
  expect(game.state().gold).toBe(gold);
  for (const id of STARTER_FURNITURE_IDS) expect(game.state().ownedFurniture[id]).toBe(1);
  const saved = structuredClone(game.state());
  const reads = game.getCount();
  await page.reload();
  await expect.poll(game.getCount).toBeGreaterThan(reads);
  await expect(page.locator(".game-shell")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(game.state().residence).toEqual(saved.residence);
  expect(game.state().character.appearance).toEqual(saved.character.appearance);
  expect(game.state().gold).toBe(gold);
  const worldCanvas = page.locator(".world-canvas canvas");
  await expect(worldCanvas).toBeVisible();
  await expect.poll(() => worldCanvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return { width: canvas.width, height: canvas.height, lost: context?.isContextLost() ?? true };
  })).toMatchObject({ lost: false });
  await expect.poll(async () => (await worldCanvas.screenshot()).byteLength, { timeout: 30_000 }).toBeGreaterThan(20_000);
  const canvasPath = info.outputPath("world-canvas-after-reload.png");
  await worldCanvas.screenshot({ path: canvasPath });
  await info.attach("world-canvas-after-reload", { path: canvasPath, contentType: "image/png" });
  await capture(page, info, "world-after-reload");
  expect(game.errors).toEqual([]);
});

test("lọc vị trí tủ đồ và xem thử không gửi giao dịch hay trừ vàng", async ({ page }, info) => {
  const game = await isolatedGame(page);
  await enterCharacter(page);
  await page.getByRole("button", { name: "Tủ đồ", exact: true }).click();
  const gold = game.state().gold;
  const before = game.commands.filter(command => command.action.type !== "reconcile").length;
  const slots = page.getByLabel("Loại trang phục", { exact: true });
  await expect(slots).toBeVisible();
  for (const label of ["Áo", "Quần", "Giày", "Áo khoác"]) {
    const slot = slots.getByRole("button", { name: label, exact: true });
    await slot.click();
    await expect(slot).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByLabel("Lọc tủ đồ", { exact: true }).selectOption("owned");
  await expect(page.getByLabel("Lọc tủ đồ", { exact: true })).toHaveValue("owned");
  await page.getByLabel("Lọc tủ đồ", { exact: true }).selectOption("all");
  const outerwear = COSMETICS.find(item => item.slot === "outerwear");
  expect(outerwear).toBeDefined();
  await page.getByRole("button", { name: `Thử ${outerwear!.name}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Trở về trang phục đang mặc" })).toBeVisible();
  await expectDialogFits(page);
  await capture(page, info, "wardrobe-preview-no-charge");
  expect(game.commands.filter(command => command.action.type !== "reconcile")).toHaveLength(before);
  expect(game.state().gold).toBe(gold);
  expect(game.errors).toEqual([]);
});

test("từ chối nhận nhà giữ lựa chọn và cho phép thử lại", async ({ page }, info) => {
  const game = await isolatedGame(page, "reject-first-settle");
  await enterCharacter(page);
  await selectHome(page);
  const gold = game.state().gold;
  await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect(page.getByText(/Chưa nhận được xác nhận nơi ở/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(game.state().residence).toBeUndefined();
  expect(game.state().gold).toBe(gold);
  await capture(page, info, "housing-rejection-retained");
  await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(game.state().residence).toMatchObject({ buildingId: "aurora-tower", floor: 24, layoutId: "one-bedroom" });
  expect(game.errors).toEqual([]);
});

test("mất phản hồi nhận nhà thử lại cùng mã không cấp trùng", async ({ page }, info) => {
  const game = await isolatedGame(page, "lose-first-settle-response");
  await enterCharacter(page);
  await selectHome(page);
  const gold = game.state().gold;
  await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
  await expect(page.getByText(/Chưa nhận được xác nhận nơi ở/)).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(game.state().residence?.floor).toBe(24);
  await capture(page, info, "housing-lost-response");
  const originalKey = game.commands.find(command => command.action.type === "housing.settle")!.key;
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lifelevel-pending-command:v7-browser-fixture") ?? "null")?.key)).toBe(originalKey);
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await page.getByRole("button", { name: "Đồng bộ lại", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lifelevel-pending-command:v7-browser-fixture"))).toBeNull();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const settles = game.commands.filter(command => command.action.type === "housing.settle");
  expect(settles).toHaveLength(2);
  expect(settles[0].key).toBe(settles[1].key);
  for (const id of STARTER_FURNITURE_IDS) expect(game.state().ownedFurniture[id]).toBe(1);
  expect(game.state().gold).toBe(gold);
  expect(game.errors).toEqual([]);
});

for (const quality of ["balanced", "performance"] as const) {
  test(`đo FPS R3F căn hộ khởi đầu ${quality}`, async ({ page }, info) => {
    const game = await isolatedGame(page);
    Object.assign(game.state(), applyAction(game.state(), { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, { userId: game.state().userId, now: NOW, random: () => .5, eventId: randomUUID() }).state);
    game.state().settings.graphics = quality;
    await page.goto("/");
    const dismiss = page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
    const canvas = page.locator(".world-canvas canvas");
    await expect(canvas).toBeVisible();
    const hud = page.locator(".world-controls > span");
    await expect(hud).toHaveText(/^\d+ FPS$/);
    const environment = await canvas.evaluate(element => {
      const surface = element as HTMLCanvasElement;
      const context = surface.getContext("webgl2") ?? surface.getContext("webgl");
      const debug = context?.getExtension("WEBGL_debug_renderer_info");
      return { userAgent: navigator.userAgent, devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, canvas: { width: surface.width, height: surface.height }, renderer: context ? context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER) as string : null, vendor: context ? context.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : context.VENDOR) as string : null, contextLost: context?.isContextLost() ?? true };
    });
    expect(environment.contextLost).toBe(false);
    const startedAt = new Date().toISOString();
    const samples = await hud.evaluate(async element => {
      const readings: { elapsedMs: number; fps: number; raw: string }[] = [];
      const started = performance.now();
      for (let index = 0; index < 10; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 3250));
        const raw = element.textContent ?? "";
        readings.push({ elapsedMs: performance.now() - started, fps: Number(raw.match(/^(\d+) FPS$/)?.[1] ?? NaN), raw });
      }
      return readings;
    });
    const values = samples.map(sample => sample.fps);
    const sorted = [...values].sort((left, right) => left - right);
    const report = { startedAt, quality, project: info.project.name, environment, samples, min: sorted[0], max: sorted.at(-1), mean: values.reduce((sum, value) => sum + value, 0) / values.length, median: (sorted[4] + sorted[5]) / 2, limitations: "Observed application R3F HUD estimates, sampled every 3250ms after warm-up; consecutive equal estimates may occur. Headless installed Chrome and software/hardware renderer above are not representative physical-device benchmarks. All APIs mocked; reducedMotion enabled. No performance target inferred." };
    await info.attach(`fps-${quality}`, { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    await capture(page, info, `fps-${quality}-viewport`, false);
    expect(samples).toHaveLength(10);
    expect(samples[9].elapsedMs).toBeGreaterThanOrEqual(32_500);
    expect(values.every(value => Number.isFinite(value) && value > 0)).toBe(true);
    expect(game.commands.filter(command => command.action.type !== "reconcile")).toHaveLength(0);
    expect(game.errors).toEqual([]);
  });
}
