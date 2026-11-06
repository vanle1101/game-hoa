import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { createInitialState, applyAction } from "../../src/domain/engine";
import type { Action, ActionResult } from "../../src/domain/types";
import { FURNITURE_CATALOG } from "../../src/furniture/catalog";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const FIRST_36 = [
  "cloud-bed", "platform-bed", "bunk-bed", "canopy-bed", "haven-sofa", "corner-sofa", "chaise-lounge",
  "workstation", "writing-desk", "standing-desk", "architect-desk", "dining-chair", "office-chair", "bar-stool",
  "bookcase", "wardrobe", "drawer-chest", "flat-tv", "arcade-cabinet", "stereo-tower", "neon-floor-lamp",
  "tripod-lamp", "table-lamp", "kitchen-island", "refrigerator", "range-cooker", "biolume-plant", "wall-mirror",
  "aquarium", "tool-bench", "3d-printer", "tool-trolley", "holo-art", "trophy-cup", "model-rocket", "crystal-display",
] as const;
type Command = { key: string; action: Action; expectedOwnerId?: string };

async function isolatedGame(page: Page) {
  let state = createInitialState("v7-furniture-gallery", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const commands: Command[] = [];
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const warnings: string[] = [];
  const unexpectedApi: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    if (new URL(request.url()).pathname !== "/api/game") {
      unexpectedApi.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 503, json: { error: "API ngoài phạm vi kiểm thử." } });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ json: { state, mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      unexpectedApi.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 405, json: { error: "Phương thức không được hỗ trợ." } });
      return;
    }
    const command = request.postDataJSON() as Command;
    commands.push(structuredClone(command));
    if (command.expectedOwnerId && command.expectedOwnerId !== state.userId) {
      await route.fulfill({ status: 409, json: { error: "Phiên người chơi đã thay đổi.", code: "OWNER_CHANGED" } });
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
      await route.fulfill({ json: result });
    } catch (error) {
      await route.fulfill({ status: 422, json: { error: error instanceof Error ? error.message : "Thao tác không hợp lệ." } });
    }
  });
  await page.addInitScript(() => {
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
        const target = prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
        const original = target[method];
        if (!original || !Object.prototype.hasOwnProperty.call(prototype, method)) continue;
        target[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          const result = original.apply(this, args);
          const canvas = this.canvas;
          if (canvas instanceof HTMLCanvasElement) canvas.dataset.galleryDraws = String(Number(canvas.dataset.galleryDraws ?? 0) + 1);
          return result;
        };
      }
    }
  });
  return { state: () => state, commands, errors, consoleErrors, warnings, unexpectedApi };
}

test("first36 actual furniture WebGL gallery is preview-only", async ({ page }, info) => {
  test.setTimeout(240_000);
  const game = await isolatedGame(page);
  const selected: string[] = [];
  const manifest: object[] = [];
  const hashes = new Set<string>();
  const nonReconcile = () => game.commands.filter(command => command.action.type !== "reconcile");
  await page.goto("/");
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".sidebar").getByRole("button", { name: "Nội thất", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chọn món làm nên căn nhà.", exact: true })).toBeVisible();
  const baseline = structuredClone({ gold: game.state().gold, inventory: game.state().inventory, ownedFurniture: game.state().ownedFurniture, commands: nonReconcile() });
  const showcase = page.locator(".furniture-showcase");
  const canvas = showcase.locator("canvas");
  try {
    for (const [index, id] of FIRST_36.entries()) {
      const item = FURNITURE_CATALOG.find(entry => entry.id === id);
      expect(item, id).toBeDefined();
      await page.getByLabel("Tìm nội thất", { exact: true }).fill(id);
      const select = page.getByRole("button", { name: `Xem trước ${item!.name}`, exact: true });
      await expect(page.getByRole("button", { name: /^Xem trước / })).toHaveCount(1);
      const previousDraws = Number(await canvas.getAttribute("data-gallery-draws") ?? 0);
      await select.click();
      await expect(select).toHaveAttribute("aria-pressed", "true");
      await expect(showcase.locator(".furniture-showcase-caption strong")).toHaveText(item!.name);
      await expect(page.getByRole("complementary", { name: `Thông tin ${item!.name}`, exact: true })).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(canvas).toBeVisible();
      await page.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
      await expect.poll(async () => Number(await canvas.getAttribute("data-gallery-draws") ?? 0)).toBeGreaterThan(previousDraws);
      const live = await canvas.evaluate(element => {
        const gl = (element as HTMLCanvasElement).getContext("webgl2");
        return { live: Boolean(gl && !gl.isContextLost()), width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height };
      });
      expect(live.live, `${id}: live WebGL2 context`).toBe(true);
      expect(live.width).toBeGreaterThan(200);
      expect(live.height).toBeGreaterThan(200);
      await showcase.scrollIntoViewIfNeeded();
      const bounds = await showcase.boundingBox();
      const viewport = page.viewportSize()!;
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
      let previous = await canvas.screenshot({ animations: "disabled" });
      await expect.poll(async () => {
        const current = await canvas.screenshot({ animations: "disabled" });
        const stable = current.equals(previous);
        previous = current;
        return stable;
      }).toBe(true);
      expect(previous.byteLength, `${id}: nonempty rendered canvas`).toBeGreaterThan(1500);
      const hash = createHash("sha256").update(previous).digest("hex");
      expect(hashes.has(hash), `${id}: unique rendered model`).toBe(false);
      hashes.add(hash);
      const screenshot = info.outputPath(`${String(index + 1).padStart(2, "0")}-${id}.png`);
      await showcase.screenshot({ path: screenshot, animations: "disabled" });
      await info.attach(id, { path: screenshot, contentType: "image/png" });
      selected.push(id);
      manifest.push({ id, name: item!.name, screenshot, canvasSha256: hash, canvasBytes: previous.byteLength, draws: await canvas.getAttribute("data-gallery-draws"), bounds, live });
      expect({ gold: game.state().gold, inventory: game.state().inventory, ownedFurniture: game.state().ownedFurniture, commands: nonReconcile() }).toEqual(baseline);
      expect(game.errors).toEqual([]);
      expect(game.consoleErrors).toEqual([]);
    }
    expect(selected).toEqual([...FIRST_36]);
    expect(nonReconcile()).toEqual([]);
    expect(game.unexpectedApi).toEqual([]);
  } finally {
    await info.attach("gallery-manifest", { body: JSON.stringify({ selected, manifest, errors: game.errors, consoleErrors: game.consoleErrors, warnings: game.warnings, unexpectedApi: game.unexpectedApi, commands: game.commands }, null, 2), contentType: "application/json" });
  }
});
