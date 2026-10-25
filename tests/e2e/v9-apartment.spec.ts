import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { constructionContext, getBuilding, validateConstruction } from "../../src/construction/engine";
import { emptyPlan, rectangleRoom } from "../../src/construction/grid";
import { detectRooms } from "../../src/construction/topology";
import { findBuildingPath } from "../../src/construction/navigation";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import type { BuildingPlan, WallSegment } from "../../src/construction/types";

const NOW = "2026-10-16T08:00:00.000Z";
const CONTRACT_READY = process.env.LIFE_LEVEL_V9_APARTMENT_CONTRACT === "1";
const GPU_GRANTED = process.env.LIFE_LEVEL_V9_GPU_GRANTED === "1";
const COMPARE_LATEST_IMAGES = process.env.LIFE_LEVEL_V9_COMPARE_LATEST_IMAGES === "1";

type Command = { key: string; expectedOwnerId?: string; action: Action };
type Receipt = { fingerprint: string; result: ActionResult };
type Attempt = { command: Command; status: number; error?: string };
type Fixture = {
  ownerId: string;
  state: () => GameState;
  attempts: Attempt[];
  reads: () => number;
  errors: string[];
};

function apply(state: GameState, action: Action, eventId: string): ActionResult {
  return applyAction(state, action, { userId: state.userId, now: NOW, random: () => 0.5, eventId });
}

function freshState(userId = "v9-apartment-browser-fixture"): GameState {
  const state = createInitialState(userId, NOW);
  state.gold = 12_000;
  state.character.xp = 9_000;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  return state;
}

async function fixture(page: Page): Promise<Fixture> {
  let state = freshState();
  let reads = 0;
  const attempts: Attempt[] = [];
  const receipts = new Map<string, Receipt>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") {
      await route.fulfill({ status: 503, json: { error: "V9 fixture blocks unrelated APIs" } });
      return;
    }
    if (request.method() === "GET") {
      reads += 1;
      await route.fulfill({ json: { state: structuredClone(state), mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "Method not supported by V9 fixture" } });
      return;
    }
    const command = request.postDataJSON() as Command;
    const attempt: Attempt = { command: structuredClone(command), status: 0 };
    attempts.push(attempt);
    if (command.expectedOwnerId !== state.userId) {
      attempt.status = 409;
      attempt.error = "Owner mismatch";
      await route.fulfill({ status: 409, json: { error: attempt.error, code: "OWNER_CHANGED" } });
      return;
    }
    if (!command.key || typeof command.key !== "string") {
      attempt.status = 422;
      attempt.error = "Missing idempotency key";
      await route.fulfill({ status: 422, json: { error: attempt.error } });
      return;
    }
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) {
      attempt.status = 409;
      attempt.error = "Idempotency key reused with different content";
      await route.fulfill({ status: 409, json: { error: attempt.error } });
      return;
    }
    if (previous) {
      attempt.status = 200;
      await route.fulfill({ json: previous.result });
      return;
    }
    try {
      const result = apply(state, command.action, command.key);
      state = structuredClone(result.state);
      receipts.set(command.key, { fingerprint, result: { ...result, state: structuredClone(result.state) } });
      attempt.status = 200;
      await route.fulfill({ json: result });
    } catch (error) {
      attempt.status = 422;
      attempt.error = error instanceof Error ? error.message : String(error);
      await route.fulfill({ status: 422, json: { error: attempt.error } });
    }
  });
  return { ownerId: state.userId, state: () => structuredClone(state), attempts, reads: () => reads, errors };
}

async function post(page: Page, ownerId: string, action: Action, key: string = randomUUID()) {
  return page.evaluate(async payload => {
    const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() as { state?: GameState; error?: string; message?: string } };
  }, { key, expectedOwnerId: ownerId, action });
}

async function settle(page: Page, fixtureState: Fixture, floor: 8 | 16 | 24 = 24, layoutId: "studio" | "one-bedroom" | "open-plan" = "one-bedroom", key: string = randomUUID()) {
  return post(page, fixtureState.ownerId, { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor, layoutId }, key);
}

function partitionPlan(withOpening: "door" | "window" | "none" = "none"): BuildingPlan {
  const plan = rectangleRoom(emptyPlan(), { x: 0, z: 0, level: 0 }, { x: 3, z: 2, level: 0 });
  for (const z of [0, 1, 2]) {
    const wall: WallSegment = { x: 2, z, level: 0, orientation: "z", materialId: "wall-basic" };
    if (withOpening !== "none" && z === 1) wall.opening = { kind: withOpening, catalogId: withOpening === "door" ? "door-standard" : "window-small" };
    plan.walls.push(wall);
  }
  return plan;
}

async function commit(page: Page, fixtureState: Fixture, plan: BuildingPlan, key: string = randomUUID()) {
  const building = getBuilding(fixtureState.state());
  return post(page, fixtureState.ownerId, { type: "construction.commit", expectedRevision: building.revision, plan }, key);
}

function assertDrawReady(page: Page) {
  return expect.poll(async () => page.locator(".world-canvas canvas").evaluate(canvas => {
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return Boolean(gl && canvas.width > 0 && canvas.height > 0);
  })).toBe(true);
}

function attachContractFixture(info: TestInfo, game: Fixture) {
  return info.attach("v9-fixture-evidence", {
    body: JSON.stringify({ contractReady: CONTRACT_READY, attempts: game.attempts, reads: game.reads(), state: game.state(), pageErrors: game.errors }, null, 2),
    contentType: "application/json",
  });
}

test.describe("V9 apartment · isolated real domain fixture", () => {
  test("rejects owner changes, preserves Gold on onboarding, and applies a key once", async ({ page }, info) => {
    const game = await fixture(page);
    await page.goto("/");
    const key = "v9-onboarding-once";
    const beforeGold = game.state().gold;
    const first = await settle(page, game, 24, "one-bedroom", key);
    const second = await settle(page, game, 24, "one-bedroom", key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(game.state().gold).toBe(beforeGold);
    expect(game.state().residence).toMatchObject({ floor: 24, layoutId: "one-bedroom" });
    expect(game.state().journal.filter(event => event.type === "housing.settle")).toHaveLength(1);
    const wrongOwner = await post(page, "different-owner", { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, "v9-wrong-owner");
    expect(wrongOwner.status).toBe(409);
    await attachContractFixture(info, game);
  });

  test("rejects an exterior floor edit without touching the saved building", async ({ page }, info) => {
    const game = await fixture(page);
    await page.goto("/");
    await settle(page, game);
    const before = game.state();
    const plan = structuredClone(getBuilding(before).plan);
    plan.floors.push({ x: 99, z: 99, level: 0, materialId: "floor-concrete" });
    const response = await commit(page, game, plan, "v9-invalid-exterior");
    expect(response.status).toBe(422);
    expect(game.state().building).toEqual(before.building);
    expect(game.state().gold).toBe(before.gold);
    await attachContractFixture(info, game);
  });

  test("onboarding exposes the V9 fixed 120m² shell, six essentials, large windows and no 4×4 starter", async ({ page }, info) => {
    test.fixme(!CONTRACT_READY, "Pending V9 apartment contract: keep this acceptance test until the evolving shell/inventory contract is exported.");
    const game = await fixture(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Một chương mới/ })).toBeVisible();
    for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: i === 0 ? "Bắt đầu hành trình" : "Tiếp tục", exact: true }).click();
    await page.getByRole("button", { name: "24", exact: true }).click();
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByRole("button", { name: /Không gian mở/ }).click();
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await expect(page.getByText(/Nội thất thiết yếu/)).toBeVisible();
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await expect(page.getByText("Tầng", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
    await expect.poll(() => game.state().residence?.floor).toBe(24);
    const building = getBuilding(game.state());
    expect(building.plan.floors).toHaveLength(120);
    expect(building.plan.furniture).toHaveLength(6);
    expect(building.plan.furniture.some(item => item.furnitureId === "starter-4x4")).toBe(false);
    expect(building.plan.walls.some(wall => wall.opening?.kind === "window" && wall.opening.catalogId.includes("large"))).toBe(true);
    expect(building.plan.walls.some(wall => wall.opening?.kind === "door")).toBe(true);
    await attachContractFixture(info, game);
  });

  test("interior partition produces two room regions, door traversal, window blocking, removal and reconnect", async ({ page }, info) => {
    test.fixme(!CONTRACT_READY, "Pending V9 apartment contract: preserve this topology acceptance while architecture APIs evolve.");
    const game = await fixture(page);
    await page.goto("/");
    await settle(page, game);
    const solid = partitionPlan("none");
    const door = partitionPlan("door");
    const window = partitionPlan("window");
    for (const plan of [solid, door, window]) validateConstruction(getBuilding(game.state()), plan, constructionContext(game.state()));
    expect((await commit(page, game, solid)).status).toBe(200);
    expect(detectRooms(getBuilding(game.state()).plan).filter(room => room.enclosed)).toHaveLength(2);
    expect(findBuildingPath(getBuilding(game.state()).plan, { x: 0, z: 1, level: 0 }, { x: 3, z: 1, level: 0 })).toEqual([]);
    expect((await commit(page, game, door)).status).toBe(200);
    expect(findBuildingPath(getBuilding(game.state()).plan, { x: 0, z: 1, level: 0 }, { x: 3, z: 1, level: 0 }).length).toBe(4);
    expect((await commit(page, game, window)).status).toBe(200);
    expect(findBuildingPath(getBuilding(game.state()).plan, { x: 0, z: 1, level: 0 }, { x: 3, z: 1, level: 0 })).toEqual([]);
    expect((await commit(page, game, rectangleRoom(emptyPlan(), { x: 0, z: 0, level: 0 }, { x: 3, z: 2, level: 0 }))).status).toBe(200);
    expect(detectRooms(getBuilding(game.state()).plan).filter(room => room.enclosed)).toHaveLength(1);
    expect((await commit(page, game, door)).status).toBe(200);
    expect(findBuildingPath(getBuilding(game.state()).plan, { x: 0, z: 1, level: 0 }, { x: 3, z: 1, level: 0 }).length).toBe(4);
    await attachContractFixture(info, game);
  });

  test("furniture buy, place, rotate, move and reload preserve Gold and ownership", async ({ page }, info) => {
    test.fixme(!CONTRACT_READY, "Pending V9 apartment contract: furniture placement semantics are still being integrated.");
    const game = await fixture(page);
    await page.goto("/");
    await settle(page, game);
    const buyKey = "v9-buy-dining-chair";
    expect((await post(page, game.ownerId, { type: "furniture.buy", furnitureId: "dining-chair" }, buyKey)).status).toBe(200);
    const afterBuyGold = game.state().gold;
    expect((await post(page, game.ownerId, { type: "furniture.buy", furnitureId: "dining-chair" }, buyKey)).status).toBe(200);
    expect(game.state().gold).toBe(afterBuyGold);
    const plan = rectangleRoom(emptyPlan(), { x: 0, z: 0, level: 0 }, { x: 3, z: 3, level: 0 });
    plan.furniture = [{ id: "qa-chair", furnitureId: "dining-chair", x: 0, z: 0, level: 0, rotation: 0 }];
    expect((await commit(page, game, plan)).status).toBe(200);
    plan.furniture[0].rotation = 90;
    expect((await commit(page, game, plan)).status).toBe(200);
    plan.furniture[0].x = 2;
    plan.furniture[0].z = 2;
    expect((await commit(page, game, plan)).status).toBe(200);
    const readsBeforeReload = game.reads();
    await page.reload();
    await expect.poll(game.reads).toBeGreaterThan(readsBeforeReload);
    const persisted = await page.evaluate(async () => await (await fetch("/api/game", { cache: "no-store" })).json() as { state: GameState });
    expect(persisted.state.building?.plan.furniture).toEqual(plan.furniture);
    await attachContractFixture(info, game);
  });
});

test.describe("V9 draw-ready WebGL evidence", () => {
  test("captures HOME and BUILD mode for visual comparison", async ({ page }, info) => {
    test.skip(!GPU_GRANTED, "Lead GPU grant required before launching real Chrome for WebGL evidence.");
    const game = await fixture(page);
    await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
    await page.goto("/");
    await settle(page, game, 24, "open-plan");
    await page.reload();
    await assertDrawReady(page);
    const home = await page.screenshot({ animations: "disabled" });
    await info.attach("HOME-real-webgl", { body: home, contentType: "image/png" });
    if (COMPARE_LATEST_IMAGES) await expect(page).toHaveScreenshot("HOME-latest.png", { animations: "disabled", maxDiffPixelRatio: 0.02 });
    await page.getByRole("button", { name: "Chế độ xây dựng", exact: true }).click();
    await expect(page.locator(".construction-editor")).toBeVisible();
    await assertDrawReady(page);
    const build = await page.screenshot({ animations: "disabled" });
    await info.attach("BUILD-real-webgl", { body: build, contentType: "image/png" });
    if (COMPARE_LATEST_IMAGES) await expect(page).toHaveScreenshot("BUILD-latest.png", { animations: "disabled", maxDiffPixelRatio: 0.02 });
    await attachContractFixture(info, game);
  });
});
