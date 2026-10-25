import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { constructionContext, getBuilding, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { cellKey, emptyPlan, rectangleRoom } from "../../src/construction/grid";
import { migrateLegacyBuilding } from "../../src/construction/migration";
import { buildingStateSchema } from "../../src/construction/schema";
import { HOUSING_LAYOUTS, STARTER_FURNITURE_IDS } from "../../src/housing/catalog";
import { canReceiveStarterHome, reconcileStarterHousing, repairStarterHousing } from "../../src/housing/engine";
import { gameCommand, readGame } from "../../src/server/store";

const createdAt = "2026-10-15T16:05:12.168Z";
const settledAt = "2026-10-17T05:23:06.584Z";
const committedAt = "2026-10-17T08:17:30.319Z";
const now = "2026-10-17T10:00:00.000Z";
const selection = { districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" } as const;
const act = (state: GameState, action: Action, eventId = "repair", at = now) => applyAction(state, action, { userId: state.userId, now: at, eventId, random: () => 0.5 });
const repair = (state: GameState, eventId = "authorized-repair") => repairStarterHousing(state, now, { allowLegacyWallRemoval: true, eventId });

function failedSettlement(): GameState {
  const state = createInitialState("v12-owner", createdAt);
  delete state.housingStarterEligible;
  return act(state, { type: "housing.settle", ...selection }, "failed-settlement", settledAt).state;
}

function legacyFourByFour(): GameState {
  const state = failedSettlement();
  const plan = structuredClone(getBuilding(state).plan);
  plan.walls = [];
  const saved = act(state, { type: "construction.commit", plan, expectedRevision: 0 }, "wall-removal", committedAt).state;
  saved.building!.foundation = { version: 9, mode: "legacy-preserved" };
  saved.revision = 7;
  return JSON.parse(JSON.stringify(saved)) as GameState;
}

function expectHome(state: GameState) {
  expect(state.building?.foundation).toEqual({ version: 9, mode: "fixed-apartment" });
  expect(state.building?.plan.floors).toHaveLength(120);
  expect(state.building?.paid).toEqual({});
  expect(state.building?.plan.furniture.map(item => item.furnitureId).sort()).toEqual([...STARTER_FURNITURE_IDS].sort());
  expect(new Set(state.building?.plan.furniture.map(item => item.id)).size).toBe(STARTER_FURNITURE_IDS.length);
  for (const id of STARTER_FURNITURE_IDS) expect(state.ownedFurniture[id]).toBeGreaterThanOrEqual(1);
  expect(buildingStateSchema.safeParse(state.building).success).toBe(true);
  expect(() => validateConstruction(state.building!, state.building!.plan, constructionContext(state))).not.toThrow();
  expect(quoteConstruction(state.building!, emptyPlan(), state.gold).refund).toBe(0);
}

describe("V12 starter housing repair", () => {
  it("repairs the failed-settlement legacy 4x4 shape without resetting progress", () => {
    const state = legacyFourByFour();
    state.gold = 321;
    state.character.xp = 432;
    state.character.name = "Preserved player";
    state.materials = { alloy: 9 };
    state.inventory.push({ id: "earned-item", definitionId: "starter-blade", enhancement: 2, acquiredAt: now });
    state.pets = [{ id: "pixel-cat", name: "Mochi", bond: 25 }];
    state.settings.graphics = "performance";
    state.settings.equipmentLossAccepted = true;
    state.ownedFurniture = { "cloud-bed": 3, wardrobe: 1 };
    const before = structuredClone(state);
    expect(reconcileStarterHousing(state, now)).toBe(state);
    const repaired = repair(state);
    expectHome(repaired);
    expect(repaired.building?.revision).toBe(2);
    expect(repaired.ownedFurniture["cloud-bed"]).toBe(3);
    expect(repaired.ownedFurniture.wardrobe).toBe(1);
    expect({ ...repaired, building: before.building, ownedFurniture: before.ownedFurniture, revision: before.revision, journal: before.journal }).toEqual(before);
    expect(repaired.revision).toBe(before.revision + 1);
    expect(repaired.journal.at(-1)?.data).toEqual({ version: 12, authorizedLegacyRepair: true });
    expect(state).toEqual(before);
    expect(() => act(repaired, { type: "construction.commit", plan: repaired.building!.plan, expectedRevision: 1 }, "stale-draft")).toThrow(/another tab/);
  });

  it.each(HOUSING_LAYOUTS)("repairs a missing building using the saved $id selection", layout => {
    const state = failedSettlement();
    state.residence!.layoutId = layout.id;
    state.journal[0].data.layoutId = layout.id;
    const result = act(state, { type: "reconcile" });
    expectHome(result.state);
    expect(result.state.residence).toEqual(state.residence);
    expect(result.state.gold).toBe(state.gold);
    expect(result.state.inventory).toEqual(state.inventory);
    expect(result.state.ledger).toEqual(state.ledger);
    expect(result.events.filter(event => event.type === "housing.starter-repair")).toHaveLength(1);
    expect(result.state.revision).toBe(state.revision + 1);
  });

  it("repairs a canonical uncommitted preview and accepts array order differences", () => {
    const state = failedSettlement();
    state.building = migrateLegacyBuilding(state);
    state.building.plan.floors.reverse();
    state.building.plan.walls.reverse();
    expectHome(act(state, { type: "reconcile" }).state);
  });

  it("never duplicates grants across retries, reloads or later furnishing edits", () => {
    const first = { state: repair(legacyFourByFour()) };
    expectHome(first.state);
    expect(repair(first.state)).toBe(first.state);
    expect(repair(first.state, "authorized-retry")).toBe(first.state);
    expect(reconcileStarterHousing(first.state, now)).toBe(first.state);
    expect(act(first.state, { type: "reconcile" }).state).toBe(first.state);
    expect(act(first.state, { type: "reconcile" }, "second-reconcile").state).toBe(first.state);
    const reload = JSON.parse(JSON.stringify(first.state)) as GameState;
    reload.building!.plan.furniture = reload.building!.plan.furniture.filter(item => item.furnitureId !== "cloud-bed");
    const result = act(reload, { type: "reconcile" }, "after-storing-bed");
    expect(result.state).toBe(reload);
    expect(result.state.ownedFurniture).toEqual(first.state.ownedFurniture);
    expect(result.state.building?.plan.furniture).toHaveLength(5);
    expect(result.state.journal.filter(event => event.type === "housing.starter-repair")).toHaveLength(1);
    expect(result.state.ledger).toEqual(first.state.ledger);
  });

  it("preserves completed tasks and does not make a repair undoable with overdue reconciliation", () => {
    const completed = act(failedSettlement(), { type: "task.create", task: { title: "Finished task" } }, "create-task").state;
    const progress = act(completed, { type: "task.complete", occurrenceId: completed.occurrences[0].id }, "complete-task").state;
    const before = structuredClone(progress);
    const repaired = act(progress, { type: "reconcile" }).state;
    expectHome(repaired);
    for (const key of ["tasks", "occurrences", "gold", "inventory", "equipment", "character", "materials", "ledger", "rewardBudgets"] as const) expect(repaired[key]).toEqual(before[key]);
    const overdue = act(failedSettlement(), { type: "task.create", task: { title: "Overdue task", committed: false } }, "overdue-create", settledAt).state;
    const reconciled = act(overdue, { type: "reconcile" }, "overdue-reconcile", "2026-10-18T10:00:00.000Z").state;
    expectHome(reconciled);
    expect(reconciled.occurrences[0].status).toBe("missed");
    expect(reconciled.undo).toBeUndefined();
  });
});

const negativeCases: [string, (state: GameState) => void][] = [
  ["no failed settlement receipt", state => { state.journal = state.journal.filter(entry => entry.type !== "housing.settle"); }],
  ["successful original grant", state => { state.journal[0].data.starterGranted = true; }],
  ["unknown grant outcome", state => { delete state.journal[0].data.starterGranted; }],
  ["mismatched selection", state => { state.journal[0].data.layoutId = "open-plan"; }],
  ["mismatched settlement time", state => { state.residence!.completedAt = now; }],
  ["duplicate settlement", state => { state.journal.push({ ...state.journal[0], id: "duplicate" }); }],
  ["unsupported selection", state => { state.residence!.buildingId = "unknown"; }],
  ["construction before settlement", state => { state.journal.reverse(); }],
  ["more authored construction", state => { state.journal.push({ ...state.journal[1], id: "another-commit" }); }],
  ["later building revision", state => { state.building!.revision = 2; }],
  ["different removal count", state => { state.journal[1].data.removed = 15; }],
  ["paid construction", state => { state.journal[1].data.cost = 10; }],
  ["refunded construction", state => { state.journal[1].data.refund = 1; }],
  ["added construction", state => { state.journal[1].data.added = 1; }],
  ["paid ledger history", state => { state.ledger[0].amount = -1; }],
  ["paid retained floor", state => { state.building!.paid["floor:0:-2:-2"] = 10; }],
  ["unexpected paid key", state => { state.building!.paid["wall:0:x:-2:-2"] = 0; }],
  ["shifted small building", state => { state.building!.plan.floors.forEach(floor => floor.x++); }],
  ["duplicate floor hiding a missing cell", state => { state.building!.plan.floors[0] = { ...state.building!.plan.floors[1] }; }],
  ["different material", state => { state.building!.plan.floors[0].materialId = "floor-wood"; }],
  ["different plot", state => { state.building!.plot.maxX = 7; }],
  ["different migration origin", state => { state.building!.migratedAt = settledAt; }],
  ["authored wall", state => { state.building!.plan.walls.push({ x: 0, z: 0, level: 0, orientation: "x", materialId: "wall-basic" }); }],
  ["authored room name", state => { state.building!.plan.roomNames.room = "My room"; }],
  ["authored ceiling", state => { state.building!.plan.ceilings.push({ ...state.building!.plan.floors[0], materialId: "ceiling-basic" }); }],
  ["authored furniture", state => { state.building!.plan.furniture.push({ id: "my-bed", furnitureId: "cloud-bed", x: -2, z: -2, level: 0, rotation: 0 }); }],
  ["legacy placement", state => { state.placements.push({ id: "my-bed", furnitureId: "cloud-bed", roomId: "living", x: 0, z: 0, rotation: 0 }); }],
  ["furniture purchase history", state => { state.journal.push({ id: "furniture-buy", type: "furniture.buy", title: "Purchase", at: now, data: {} }); }],
  ["unrelated furniture ownership", state => { state.ownedFurniture["biolume-plant"] = 1; }],
  ["repair already recorded", state => { state.journal.push({ id: "prior-repair", type: "housing.starter-repair", title: "Repaired", at: now, data: { version: 12 } }); }],
];

describe("V12 authored building preservation", () => {
  it("does not automatically overwrite the ambiguous free wall-removal save", () => {
    const state = legacyFourByFour();
    const result = act(state, { type: "reconcile" });
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expectHome(repair(state));
  });

  it.each(negativeCases)("does not replace %s", (_name, modify) => {
    const state = legacyFourByFour();
    modify(state);
    const before = structuredClone(state);
    expect(reconcileStarterHousing(state, now)).toBe(state);
    expect(repair(state)).toBe(state);
    expect(act(state, { type: "reconcile" }).state.building).toEqual(before.building);
    expect(state).toEqual(before);
  });

  it.each([[2, 2], [4, 4], [2, 8]])("preserves a valid authored %sx%s room", (width, depth) => {
    const state = failedSettlement();
    state.building = migrateLegacyBuilding(state);
    state.building.plan = rectangleRoom(emptyPlan(), { x: -2, z: -4, level: 0 }, { x: width - 3, z: depth - 5, level: 0 });
    state.building.revision = 4;
    state.building.foundation = { version: 9, mode: "legacy-preserved" };
    expect(() => validateConstruction(state.building!, state.building!.plan, constructionContext(state))).not.toThrow();
    expect(act(state, { type: "reconcile" }).state.building).toEqual(state.building);
  });
});

describe("V12 starter entitlement and persisted reconciliation", () => {
  it("enables clean legacy accounts during reconciliation without resetting earned progress", () => {
    const state = createInitialState("v12-owner", createdAt);
    delete state.housingStarterEligible;
    state.gold = 180;
    state.character.xp = 200;
    const eligible = act(state, { type: "reconcile" }).state;
    expect(eligible.housingStarterEligible).toBe(true);
    expect(canReceiveStarterHome(eligible)).toBe(true);
    expect(eligible.gold).toBe(180);
    expect(eligible.character).toEqual(state.character);
    expect(eligible.building).toBeUndefined();
    const home = act(eligible, { type: "housing.settle", ...selection }, "new-settlement").state;
    expectHome(home);
    expect(home.gold).toBe(180);
  });

  it("does not infer entitlement for explicitly ineligible or previously furnished accounts", () => {
    const state = createInitialState("v12-owner", createdAt);
    state.housingStarterEligible = false;
    expect(reconcileStarterHousing(state, now)).toBe(state);
    delete state.housingStarterEligible;
    state.ownedFurniture = { "cloud-bed": 1 };
    expect(reconcileStarterHousing(state, now)).toBe(state);
    state.ownedFurniture = {};
    state.journal.push({ id: "prior-build", type: "construction.commit", title: "Saved", at: createdAt, data: {} });
    expect(reconcileStarterHousing(state, now)).toBe(state);
  });

  it("persists repair once under concurrent reconciliation and preserves private envelope data", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lifelevel-v12-repair-"));
    vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
    try {
      const initial = failedSettlement();
      const file = path.join(directory, `${initial.userId}.json`);
      const envelope = { game: initial, finance: { private: "unchanged" }, proposals: { pending: { status: "pending" } }, commands: { existing: { fingerprint: "retained", result: { message: "Original receipt" } } } };
      await writeFile(file, JSON.stringify(envelope));
      const results = await Promise.all([gameCommand(initial.userId, "repair-first", { type: "reconcile" }), gameCommand(initial.userId, "repair-second", { type: "reconcile" })]);
      expect(results[0].state).toEqual(results[1].state);
      const loaded = await readGame(initial.userId);
      expectHome(loaded);
      expect(loaded.revision).toBe(initial.revision + 1);
      expect(loaded.journal.filter(event => event.type === "housing.starter-repair")).toHaveLength(1);
      const saved = JSON.parse(await readFile(file, "utf8"));
      expect({ ...saved, game: initial }).toEqual(envelope);
      const beforeRetry = await readFile(file, "utf8");
      await gameCommand(initial.userId, "repair-third", { type: "reconcile" });
      expect(await readFile(file, "utf8")).toBe(beforeRetry);
      expect(loaded.gold).toBe(initial.gold);
      expect(loaded.ledger).toEqual(initial.ledger);
      expect(new Set(loaded.building!.plan.floors.map(cellKey)).size).toBe(120);
      const legacyNewcomer = createInitialState("legacy-newcomer", createdAt);
      delete legacyNewcomer.housingStarterEligible;
      legacyNewcomer.gold = 180;
      await writeFile(path.join(directory, `${legacyNewcomer.userId}.json`), JSON.stringify({ game: legacyNewcomer, finance: null, proposals: {}, commands: {} }));
      const settled = await gameCommand(legacyNewcomer.userId, "ordinary-settlement", { type: "housing.settle", ...selection });
      expectHome(settled.state);
      expect(settled.state.gold).toBe(180);
      expect(settled.state.journal.filter(event => event.type === "housing.starter-eligibility")).toHaveLength(1);
      expect(settled.state.journal.find(event => event.type === "housing.settle")?.data.starterGranted).toBe(true);
      expectHome(await readGame(legacyNewcomer.userId));
    } finally {
      vi.unstubAllEnvs();
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("lifelevel-v12-repair-")) throw new Error("Unsafe cleanup");
      await rm(resolved, { recursive: true, force: true });
    }
  });
});
