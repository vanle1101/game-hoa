import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { constructionContext, getBuilding, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { createCurve } from "../../src/construction/curves";
import type { BuildingPlan } from "../../src/construction/types";
import { STARTER_FURNITURE_IDS } from "../../src/housing/catalog";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const PROFILE = { radius: 2, angle: 120, height: 2.4 };
const FIXTURE_LIMITS = {
  transport: "notliveDB: browser route interception with real domain applyAction",
  persistence: "Serialized in-memory server state survives page reload, not a database/process restart.",
  seed: "Construction cases use 10,000 fixture Gold, level 7 and an unobstructed supporting ground floor.",
  rendering: "DOM controls and saved canonical parameters are asserted; screenshots are review artifacts, not curved-mesh geometry proof.",
};
type Command = { key: string; expectedOwnerId?: string; action: Action };
type Receipt = { fingerprint: string; result: ActionResult };
type Attempt = { command: Command; status: number; error?: string };

function run(state: GameState, action: Action): ActionResult {
  return applyAction(state, action, { userId: state.userId, now: NOW, random: () => 0.5, eventId: randomUUID() });
}

function initialState(construction: boolean): GameState {
  let state = createInitialState("v7-construction-notliveDB", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  if (construction) {
    state.gold = 10_000;
    state.character.xp = 3_600;
    const building = getBuilding(state);
    building.plan = {
      floors: Array.from({ length: 64 }, (_, index) => ({ x: index % 8 - 4, z: Math.floor(index / 8) - 4, level: 0, materialId: "floor-concrete" })),
      walls: [], curves: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
    };
    state.building = { ...building, starterGrantApplied: true };
    validateConstruction(state.building, state.building.plan, constructionContext(state));
    state = run(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }).state;
  }
  return state;
}

async function notliveDB(page: Page, construction = true) {
  if (construction) await page.addInitScript(() => localStorage.setItem("lifelevel-entered", "true"));
  let state = initialState(construction);
  let reads = 0;
  let lastRead: GameState | undefined;
  let draft: { plan: BuildingPlan; baseRevision: number; draftRevision: number } | null = null;
  const attempts: Attempt[] = [];
  const receipts = new Map<string, Receipt>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    const url = new URL(request.url());
    if (url.pathname === "/api/construction/draft") {
      if (request.method() === "GET") {
        const expectedOwnerId = url.searchParams.get("expectedOwnerId");
        if (expectedOwnerId && expectedOwnerId !== state.userId) {
          await route.fulfill({ status: 409, json: { error: "Owner mismatch" } });
          return;
        }
        await route.fulfill({ json: { ownerId: state.userId, ...(draft ?? { plan: null }) } });
        return;
      }
      const payload = request.postDataJSON() as { expectedOwnerId?: string; expectedDraftRevision?: number | null; baseRevision?: number; plan?: BuildingPlan };
      if (payload.expectedOwnerId !== state.userId) {
        await route.fulfill({ status: 409, json: { error: "Owner mismatch" } });
        return;
      }
      if (request.method() === "POST") {
        if (payload.baseRevision === undefined || payload.baseRevision !== state.building?.revision || (draft?.draftRevision ?? null) !== payload.expectedDraftRevision || !payload.plan) {
          await route.fulfill({ status: 409, json: { error: "Draft revision mismatch" } });
          return;
        }
        draft = { plan: payload.plan, baseRevision: payload.baseRevision, draftRevision: (draft?.draftRevision ?? 0) + 1 };
        await route.fulfill({ json: { ownerId: state.userId, ...draft } });
        return;
      }
      if (request.method() === "DELETE") {
        if ((draft?.draftRevision ?? null) !== payload.expectedDraftRevision) {
          await route.fulfill({ status: 409, json: { error: "Draft revision mismatch" } });
          return;
        }
        draft = null;
        await route.fulfill({ json: { ownerId: state.userId, plan: null } });
        return;
      }
      await route.fulfill({ status: 405, json: { error: "Method not supported by notliveDB fixture" } });
      return;
    }
    if (url.pathname !== "/api/game") {
      await route.fulfill({ status: 503, json: { error: "notliveDB fixture blocks unrelated APIs" } });
      return;
    }
    if (request.method() === "GET") {
      reads += 1;
      lastRead = structuredClone(state);
      await route.fulfill({ json: { state: lastRead, mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "Method not supported by notliveDB fixture" } });
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
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) {
      attempt.status = 409;
      attempt.error = "Idempotency key reused with different content";
      await route.fulfill({ status: 409, json: { error: attempt.error } });
      return;
    }
    try {
      let result: ActionResult;
      if (previous) result = { ...previous.result, state };
      else {
        const candidate = command.action.type === "reconcile" ? state : run(state, { type: "reconcile" }).state;
        result = run(candidate, command.action);
        state = JSON.parse(JSON.stringify(result.state)) as GameState;
        if (command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      }
      attempt.status = 200;
      await route.fulfill({ json: result });
    } catch (error) {
      attempt.status = 422;
      attempt.error = error instanceof Error ? error.message : "Invalid action";
      await route.fulfill({ status: 422, json: { error: attempt.error } });
    }
  });
  return {
    state: () => structuredClone(state),
    reads: () => reads,
    lastRead: () => structuredClone(lastRead),
    attempts,
    mutations: () => attempts.filter(attempt => attempt.command.action.type !== "reconcile"),
    errors,
  };
}
type Fixture = Awaited<ReturnType<typeof notliveDB>>;

async function enterEditor(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
  await expect(page.locator(".construction-editor")).toBeVisible();
  await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
}

async function placeCurve(page: Page, x = 0, z = 0) {
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Kính cong", exact: true }).click();
  await page.getByRole("button", { name: /Nhập tọa độ chính xác/ }).click();
  const form = page.locator(".coordinate-form");
  for (const [name, value] of Object.entries({ x1: x, z1: z, x2: x, z2: z })) {
    await form.locator(`input[name="${name}"]`).fill(String(value));
  }
  await form.getByRole("button", { name: "Thêm vào bản nháp", exact: true }).click();
  await expect(page.locator(".selection-details")).toBeVisible();
}

function expectedPlan(state: GameState, profile = PROFILE): BuildingPlan {
  const plan = structuredClone(getBuilding(state).plan);
  plan.curves = [{ ...createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "expected-profile"), ...profile }];
  return plan;
}

async function expectQuote(page: Page, state: GameState, plan: BuildingPlan) {
  const quote = quoteConstruction(getBuilding(state), plan, state.gold);
  const cost = page.locator(".construction-cost");
  await expect(cost.locator(":scope > div > strong")).toHaveText(`${quote.netCost} G`);
  await expect(cost.locator(".cost-breakdown")).toContainText(`Xây mới ${quote.cost} G`);
  await expect(cost.locator(".cost-breakdown")).toContainText(`Hoàn lại ${quote.refund} G`);
  await expect(cost.locator(".cost-breakdown")).toContainText(`Còn lại ${quote.remainingGold} G`);
  return quote;
}

async function editProfile(page: Page) {
  const selection = page.locator(".selection-details");
  await selection.locator("#curve-radius").fill(String(PROFILE.radius));
  await selection.locator("#curve-angle").fill(String(PROFILE.angle));
  await selection.locator("#curve-height").fill(String(PROFILE.height));
}

async function evidence(page: Page, info: TestInfo, fixture: Fixture) {
  await info.attach("notliveDB-domain-evidence", {
    body: JSON.stringify({ limits: FIXTURE_LIMITS, attempts: fixture.attempts, state: fixture.state(), lastReloadRead: fixture.lastRead(), pageErrors: fixture.errors }, null, 2),
    contentType: "application/json",
  });
  await info.attach("review-only-not-geometry-proof", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
}

async function postPlan(page: Page, fixture: Fixture, plan: BuildingPlan) {
  const state = fixture.state();
  return page.evaluate(async payload => {
    const response = await fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() as { error?: string } };
  }, { key: randomUUID(), expectedOwnerId: state.userId, action: { type: "construction.commit", expectedRevision: getBuilding(state).revision, plan } });
}

test.describe("construction V7 · notliveDB domain-backed browser acceptance", () => {
  test.beforeEach(async ({}, info) => {
    info.annotations.push({ type: "fixture", description: JSON.stringify(FIXTURE_LIMITS) });
  });

  test("real radius/angle/height controls reprice, commit once and survive reload", async ({ page }, info) => {
    const fixture = await notliveDB(page);
    await page.goto("/");
    await enterEditor(page);
    const before = fixture.state();
    await placeCurve(page);
    const defaults = createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "expected-profile");
    const profile = { radius: defaults.radius, angle: defaults.angle, height: defaults.height };
    let quote = await expectQuote(page, before, expectedPlan(before, profile));
    for (const [label, key] of [["Bán kính", "radius"], ["Góc cung", "angle"], ["Chiều cao", "height"]] as const) {
      const input = page.locator(`.selection-details #curve-${key}`);
      await expect(input).toBeEditable();
      await expect(input).toHaveAttribute("aria-label", `${label} kính cong`);
      await input.fill(String(PROFILE[key]));
      await input.press("Tab");
      profile[key] = PROFILE[key];
      const nextQuote = await expectQuote(page, before, expectedPlan(before, profile));
      expect(nextQuote.netCost, `${key} must affect the canonical quote`).not.toBe(quote.netCost);
      quote = nextQuote;
    }
    expect(fixture.mutations()).toHaveLength(0);
    expect(fixture.state()).toEqual(before);
    await page.getByRole("button", { name: "Lưu công trình", exact: true }).click();
    await expect(page.locator(".construction-confirm")).toContainText(`Số dư sau giao dịch: ${quote.remainingGold} G`);
    await page.getByRole("button", { name: "Xác nhận lưu", exact: true }).click();
    await expect.poll(() => fixture.mutations().filter(attempt => attempt.status === 200).length).toBe(1);
    await expect(page.locator(".draft-controls")).toContainText("ĐÃ LƯU MỌI THAY ĐỔI");
    const committed = fixture.state();
    const curve = committed.building!.plan.curves![0];
    expect(curve).toMatchObject({ ...PROFILE, catalogId: "curve-bay", x: 0, z: 0, level: 0, rotation: 0, thickness: defaults.thickness, material: defaults.material, frame: defaults.frame });
    expect(committed.building!.plan.curves).toHaveLength(1);
    const action = fixture.mutations()[0].command.action;
    expect(action.type).toBe("construction.commit");
    if (action.type !== "construction.commit") throw new Error("Expected construction commit");
    expect(action.plan.curves).toEqual([curve]);
    expect(committed.gold).toBe(before.gold - quote.netCost);
    expect(committed.ledger.slice(before.ledger.length)).toMatchObject([{ amount: -quote.netCost, balance: committed.gold, reason: "Construction commit" }]);
    expect(committed.building!.revision).toBe(before.building!.revision + 1);
    validateConstruction(committed.building!, committed.building!.plan, constructionContext(committed));
    const reads = fixture.reads();
    await page.reload();
    await expect.poll(fixture.reads).toBeGreaterThan(reads);
    await enterEditor(page);
    expect(fixture.lastRead()!.building!.plan.curves).toEqual([curve]);
    expect(fixture.lastRead()!.gold).toBe(committed.gold);
    await expect(page.locator(".construction-gold strong")).toHaveText(String(committed.gold));
    await expect(page.locator(".draft-controls")).toContainText("ĐÃ LƯU MỌI THAY ĐỔI");
    await expect(page.getByRole("button", { name: "Lưu công trình", exact: true })).toBeDisabled();
    expect(fixture.mutations()).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
    await evidence(page, info, fixture);
  });

  test("preview, confirmation cancellation and draft cancellation never debit", async ({ page }, info) => {
    const fixture = await notliveDB(page);
    await page.goto("/");
    await enterEditor(page);
    const before = fixture.state();
    await placeCurve(page);
    await editProfile(page);
    await expectQuote(page, before, expectedPlan(before));
    expect(fixture.mutations()).toHaveLength(0);
    expect(fixture.state()).toEqual(before);
    await page.getByRole("button", { name: "Lưu công trình", exact: true }).click();
    await page.locator(".construction-confirm").getByRole("button", { name: "Quay lại", exact: true }).click();
    await expect(page.locator(".construction-confirm")).toHaveCount(0);
    await expect(page.locator(".draft-controls")).toContainText("BẢN NHÁP CHƯA LƯU");
    expect(fixture.state()).toEqual(before);
    const reads = fixture.reads();
    await page.getByRole("button", { name: "Hủy bản nháp", exact: true }).click();
    await expect.poll(fixture.reads).toBeGreaterThan(reads);
    await expect(page.locator(".draft-controls")).toContainText("ĐÃ LƯU MỌI THAY ĐỔI");
    expect(fixture.mutations()).toHaveLength(0);
    expect(fixture.state()).toEqual(before);
    await page.reload();
    await enterEditor(page);
    expect(fixture.lastRead()!.building!.plan.curves).toEqual([]);
    expect(fixture.state().gold).toBe(before.gold);
    expect(fixture.errors).toEqual([]);
    await evidence(page, info, fixture);
  });

  for (const placement of [
    { name: "outside unlocked plot", x: 7, z: 7, error: /outside your unlocked plot or level/i },
    { name: "unsupported arc", x: 3, z: 0, error: /floor support beneath its entire arc/i },
  ]) {
    test(`reject ${placement.name} in UI and canonical action without mutation/debit`, async ({ page }, info) => {
      const fixture = await notliveDB(page);
      await page.goto("/");
      await enterEditor(page);
      const before = fixture.state();
      await placeCurve(page, placement.x, placement.z);
      await expect(page.locator(".construction-notice").filter({ hasText: placement.error })).toBeVisible();
      await expect(page.getByRole("button", { name: "Lưu công trình", exact: true })).toBeDisabled();
      expect(fixture.mutations()).toHaveLength(0);
      expect(fixture.state()).toEqual(before);
      const plan = structuredClone(before.building!.plan);
      plan.curves = [createCurve("curve-bay", { x: placement.x, z: placement.z, level: 0 }, "invalid-placement")];
      const result = await postPlan(page, fixture, plan);
      expect(result.status).toBe(422);
      expect(result.body.error).toMatch(placement.error);
      expect(fixture.state()).toEqual(before);
      expect(fixture.mutations()).toHaveLength(1);
      await page.reload();
      await enterEditor(page);
      expect(fixture.lastRead()!.building).toEqual(before.building);
      expect(fixture.lastRead()!.gold).toBe(before.gold);
      expect(fixture.errors).toEqual([]);
      await evidence(page, info, fixture);
    });
  }

  test("canonical profile bounds and material/frame allowlist cannot be bypassed", async ({ page }, info) => {
    const fixture = await notliveDB(page);
    await page.goto("/");
    await enterEditor(page);
    const before = fixture.state();
    validateConstruction(before.building!, expectedPlan(before), constructionContext(before));
    const tampering: Record<string, string | number>[] = [{ radius: 0.1 }, { angle: 181 }, { angle: 17 }, { height: 3 }, { material: "unpriced-material" }, { frame: "unpriced-frame" }, { thickness: 0.31 }];
    for (const patch of tampering) {
      const plan = expectedPlan(before);
      Object.assign(plan.curves![0], patch);
      const result = await postPlan(page, fixture, plan);
      expect(result.status, JSON.stringify(patch)).toBe(422);
      expect(result.body.error).toBeTruthy();
      expect(fixture.state()).toEqual(before);
    }
    expect(fixture.errors).toEqual([]);
    await evidence(page, info, fixture);
  });

  test("actual residence floor selection is sent, saved and reloaded without charge", async ({ page }, info) => {
    const fixture = await notliveDB(page, false);
    await page.goto("/");
    const before = fixture.state();
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "Bắt đầu hành trình", exact: true }).click();
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByRole("button", { name: /Aurora Tower/ }).click();
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    const floor = page.getByRole("button", { name: /24 Chạm đến bầu trời/ });
    await floor.click();
    await expect(floor).toHaveAttribute("aria-pressed", "true");
    expect(fixture.mutations()).toHaveLength(0);
    expect(fixture.state().residence).toBeUndefined();
    expect(fixture.state().gold).toBe(before.gold);
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByRole("button", { name: /Một phòng ngủ/ }).click();
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await expect(page.locator(".housing-confirm dl > div").filter({ has: page.locator("dt", { hasText: /^Tầng$/ }) }).getByRole("definition")).toHaveText("24");
    await page.getByRole("button", { name: "Nhận nhà & vào thế giới", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(fixture.mutations()).toHaveLength(1);
    expect(fixture.mutations()[0]).toMatchObject({ status: 200, command: { action: { type: "housing.settle", buildingId: "aurora-tower", floor: 24, layoutId: "one-bedroom" } } });
    const saved = fixture.state();
    expect(saved.residence).toMatchObject({ buildingId: "aurora-tower", floor: 24, layoutId: "one-bedroom" });
    expect(saved.gold).toBe(before.gold);
    expect(saved.ledger).toEqual(before.ledger);
    for (const id of STARTER_FURNITURE_IDS) expect(saved.ownedFurniture[id]).toBe(1);
    const reads = fixture.reads();
    await page.reload();
    await expect.poll(fixture.reads).toBeGreaterThan(reads);
    await expect(page.locator(".game-shell")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(fixture.lastRead()!.residence).toEqual(saved.residence);
    expect(fixture.state().ownedFurniture).toEqual(saved.ownedFurniture);
    expect(fixture.state().gold).toBe(before.gold);
    expect(fixture.mutations()).toHaveLength(1);
    expect(fixture.errors).toEqual([]);
    await evidence(page, info, fixture);
  });
});
