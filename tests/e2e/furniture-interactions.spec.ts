import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PerspectiveCamera, Vector3 } from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { getFurnitureDefinition } from "../../src/furniture/catalog";
import type { Action } from "../../src/domain/types";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";

async function fixture(page: Page, furnitureId: string, blocked = false) {
  let state = createInitialState("v7-furniture-interactions-notliveDB", NOW);
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() }).state;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const item = { id: "interaction-target", furnitureId, x: blocked ? 2 : 1, z: 1, level: 0, rotation: 0 as const };
  state.building!.plan = {
    floors: Array.from({ length: 64 }, (_, index) => ({ x: index % 8 - 4, z: Math.floor(index / 8) - 4, level: 0, materialId: "floor-concrete" })),
    walls: blocked ? Array.from({ length: 8 }, (_, index) => ({ x: 1, z: index - 4, level: 0, orientation: "z" as const, materialId: "wall-concrete" })) : [],
    furniture: [item], curves: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
  const errors: string[] = [];
  const commands: Action[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    if (new URL(request.url()).pathname !== "/api/game") return route.fulfill({ status: 503, json: { error: "Isolated fixture: unrelated API blocked" } });
    if (request.method() === "GET") return route.fulfill({ json: { state, mode: "local" } });
    const body = request.postDataJSON() as { action: Action; expectedOwnerId: string };
    if (body.expectedOwnerId !== state.userId) return route.fulfill({ status: 409, json: { code: "OWNER_CHANGED" } });
    commands.push(body.action);
    try {
      const result = applyAction(state, body.action, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() });
      state = result.state;
      await route.fulfill({ json: result });
    } catch (error) { await route.fulfill({ status: 422, json: { error: String(error) } }); }
  });
  await page.goto("/");
  await expect(page.locator(".world-canvas canvas")).toBeVisible();
  await expect(page.locator(".world-controls > span")).toHaveText(/^\d+ FPS$/);
  return { state: () => state, item, errors, commands };
}

async function clickFurniture(page: Page, item: { furnitureId: string; x: number; z: number }, height: number, info: TestInfo) {
  const canvas = page.locator(".world-canvas canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const definition = getFurnitureDefinition(item.furnitureId)!;
  const camera = new PerspectiveCamera(42, bounds!.width / bounds!.height, .1, 1000);
  camera.position.set(11 * .82, 11 * .85, 11 * 1.08);
  camera.lookAt(0, .45, 0);
  camera.updateMatrixWorld();
  const point = new Vector3(item.x + Math.ceil(definition.width) / 2, height, item.z + Math.ceil(definition.depth) / 2).project(camera);
  const x = bounds!.x + (point.x + 1) * bounds!.width / 2;
  const y = bounds!.y + (1 - point.y) * bounds!.height / 2;
  await info.attach("projected-real-canvas-click", { body: JSON.stringify({ item, height, bounds, x, y }), contentType: "application/json" });
  await page.mouse.click(x, y);
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await info.attach(name, { path, contentType: "image/png" });
}

for (const entry of [
  { id: "wardrobe", height: 1.2, heading: "Bộ trang bị" },
  { id: "workstation", height: .85, heading: "Tập trung sâu" },
  { id: "tool-bench", height: .85, heading: "Xưởng chế tạo" },
]) {
  test(`đi tới ${entry.id} mở đúng chức năng không giao dịch`, async ({ page }, info) => {
    const game = await fixture(page, entry.id);
    const gold = game.state().gold;
    await screenshot(page, info, `${entry.id}-before`);
    await clickFurniture(page, game.item, entry.height, info);
    await expect(page.locator(".world-canvas canvas")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: entry.heading, exact: true }).first()).toBeVisible();
    await screenshot(page, info, `${entry.id}-arrival`);
    expect(game.state().gold).toBe(gold);
    expect(game.commands.filter(action => action.type !== "reconcile")).toEqual([]);
    expect(game.errors).toEqual([]);
  });
}

test("tường chắn đường tới tủ không mở trang bị", async ({ page }, info) => {
  const game = await fixture(page, "wardrobe", true);
  const before = structuredClone(game.state());
  await clickFurniture(page, game.item, 1.2, info);
  await expect(page.getByText("Đồ vật chưa có lối tiếp cận. Di chuyển nội thất hoặc thêm cửa.", { exact: true })).toBeVisible();
  await screenshot(page, info, "wardrobe-blocked");
  await expect(page.locator(".world-canvas canvas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bộ trang bị", exact: true })).toHaveCount(0);
  expect(game.state().gold).toBe(before.gold);
  expect(game.commands.filter(action => action.type !== "reconcile")).toEqual([]);
  expect(game.errors).toEqual([]);
});

test("đi tới đèn bật tắt hình ảnh không giao dịch", async ({ page }, info) => {
  const game = await fixture(page, "neon-floor-lamp");
  const gold = game.state().gold;
  await screenshot(page, info, "lamp-on-before");
  await clickFurniture(page, game.item, 2.05, info);
  await page.waitForTimeout(3500);
  await screenshot(page, info, "lamp-off-after-arrival");
  await clickFurniture(page, game.item, 2.05, info);
  await page.waitForTimeout(1500);
  await screenshot(page, info, "lamp-on-after-second-click");
  await expect(page.locator(".world-canvas canvas")).toBeVisible();
  expect(game.state().gold).toBe(gold);
  expect(game.commands.filter(action => action.type !== "reconcile")).toEqual([]);
  expect(game.errors).toEqual([]);
});
