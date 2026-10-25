import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { gameCommand, readGame } from "../../src/server/store";
import { createInitialState } from "../../src/domain/engine";
import { CURVED_GLASS_CATALOG, REFUND_RATE } from "../../src/construction/catalog";
import { createCurve, customizeCurve, curvePrice, curveFootprint, curveContainsPoint, curveIntersectsRect, curvePoint, isValidCurveProfile, snapCurveAngle } from "../../src/construction/curves";
import { commitConstruction, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { emptyPlan, cellKey } from "../../src/construction/grid";
import { occupiedCells } from "../../src/construction/navigation";
import { buildingStateSchema, curvedGlassSchema } from "../../src/construction/schema";
import type { BuildingPlan, BuildingState, ConstructionContext } from "../../src/construction/types";

const context: ConstructionContext = { gold: 100000, characterLevel: 10, defeatedCampaign: true, ownedFurniture: { "table-lamp": 1 } };
function platform(): BuildingPlan {
  const plan = emptyPlan();
  for (let x = -5; x < 5; x++) for (let z = -5; z < 5; z++) plan.floors.push({ x, z, level: 0, materialId: "floor-concrete" });
  return plan;
}
function home(plan = platform()): BuildingState {
  return { version: 1, revision: 0, plot: { minX: -8, maxX: 8, minZ: -8, maxZ: 8, maxLevel: 2, cellSize: 1 }, plan, paid: {}, starterGrantApplied: true, migratedAt: "2026-10-15T12:00:00.000Z", legacyPlacementsPreserved: true };
}
const preset = () => createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "custom-glass");
const custom = () => customizeCurve(preset(), { radius: 2, angle: 120, height: 2.4, thickness: .08 });
const planWith = (curve = custom()): BuildingPlan => ({ ...platform(), curves: [curve] });

describe("bounded editable curved-glass profile", () => {
  it("accepts the requested profile and retains exact numbers through schema reload", () => {
    const plan = validateConstruction(home(), planWith(), context);
    expect(plan.curves![0]).toMatchObject({ radius: 2, angle: 120, height: 2.4, thickness: .08 });
    const saved = commitConstruction(home(), plan, 0, context).building;
    expect(buildingStateSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });
  it.each(CURVED_GLASS_CATALOG)("preserves unchanged preset $id cost and old state", item => {
    const curve = createCurve(item.id, { x: 0, z: 0, level: 0 }, item.id);
    expect(curvePrice(item.id, curve)).toBe(item.price);
    expect(commitConstruction(home(), planWith(curve), 0, context).quote.cost).toBe(item.price);
    expect(buildingStateSchema.parse(home())).toEqual(home());
    expect(buildingStateSchema.parse(home()).plan).not.toHaveProperty("curves");
  });
  it("snaps editable arcs but rejects unsnapped direct payloads", () => {
    expect([snapCurveAngle(14), snapCurveAngle(121), snapCurveAngle(179), snapCurveAngle(200)]).toEqual([15, 120, 180, 180]);
    expect(customizeCurve(preset(), { angle: 121 }).angle).toBe(120);
    expect(curvedGlassSchema.safeParse({ ...custom(), angle: 121 }).success).toBe(false);
    expect(() => snapCurveAngle(NaN)).toThrow();
  });
  it("rejects nonfinite, hostile and out-of-range numeric inputs before geometry", () => {
    for (const [key, values] of Object.entries({ radius: [NaN, Infinity, -Infinity, .49, 4.01], angle: [NaN, Infinity, 0, 14, 181, 31], height: [NaN, Infinity, .49, 2.81], thickness: [NaN, Infinity, .059, .301] })) {
      for (const value of values) {
        const curve = { ...custom(), [key]: value };
        expect(curvedGlassSchema.safeParse(curve).success).toBe(false);
        expect(() => validateConstruction(home(), planWith(curve), context)).toThrow();
        expect(isValidCurveProfile(curve)).toBe(false);
      }
    }
    expect(curvedGlassSchema.safeParse({ ...custom(), price: 0 }).success).toBe(false);
    expect(() => customizeCurve(preset(), { radius: Infinity })).toThrow();
  });
  it("allows only existing cosmetic material/frame enums without price premiums", () => {
    const changed = customizeCurve(custom(), { material: "smoke", frame: "brass" });
    expect(validateConstruction(home(), planWith(changed), context).curves![0]).toEqual(changed);
    expect(curvePrice(changed.catalogId, changed)).toBe(curvePrice(custom().catalogId, custom()));
    for (const patch of [{ material: "free-glass" }, { frame: "none" }, { material: "__proto__" }]) expect(curvedGlassSchema.safeParse({ ...custom(), ...patch }).success).toBe(false);
  });
  it("keeps catalog category and unlock checks authoritative", () => {
    expect(() => validateConstruction(home(), planWith({ ...custom(), catalogId: "wall-basic" }), context)).toThrow();
    expect(() => validateConstruction(home(), planWith({ ...custom(), catalogId: "curve-bow" }), { ...context, characterLevel: 1 })).toThrow(/unlocked/);
  });
  it("uses actual custom radius and arc for footprint, navigation and support", () => {
    const curve = custom(), plan = planWith(curve);
    expect(curveContainsPoint(curve, curvePoint(curve, 110))).toBe(true);
    expect(curveContainsPoint(preset(), curvePoint(curve, 110))).toBe(false);
    const footprint = curveFootprint(curve);
    expect(footprint.map(cellKey)).not.toEqual(curveFootprint(preset()).map(cellKey));
    const occupied = occupiedCells(plan);
    const expectedBlocked = plan.floors.filter(cell => curveIntersectsRect(curve, { minX: cell.x + .32, maxX: cell.x + .68, minZ: cell.z + .32, maxZ: cell.z + .68 })).map(cellKey);
    expect([...occupied]).toEqual(expectedBlocked);
    expect(occupied.size).toBeGreaterThan(0);
    expect(occupied).not.toEqual(occupiedCells(planWith(preset())));
    const missing = cellKey(footprint[0]);
    expect(() => validateConstruction(home(), { ...plan, floors: plan.floors.filter(cell => cellKey(cell) !== missing) }, context)).toThrow(/floor support/);
  });
  it("rejects custom collisions with wall, furniture, another curve and plot boundary", () => {
    const curve = custom();
    const wall = planWith(curve); wall.walls.push({ x: 2, z: 0, level: 0, orientation: "z", materialId: "wall-basic" });
    expect(() => validateConstruction(home(), wall, context)).toThrow(/straight wall/);
    const furnished = planWith(curve), cell = curveFootprint(curve)[0];
    furnished.furniture.push({ ...cell, id: "lamp", furnitureId: "table-lamp", rotation: 0 });
    expect(() => validateConstruction(home(), furnished, context)).toThrow(/furniture/);
    const overlapping = planWith(curve); overlapping.curves!.push({ ...curve, id: "second", rotation: 15 });
    expect(() => validateConstruction(home(), overlapping, context)).toThrow(/overlap/);
    expect(() => validateConstruction(home(), planWith({ ...curve, x: 7 }), context)).toThrow(/outside/);
  });
});

describe("profile-based authoritative charge and historical refunds", () => {
  it("prices actual arc surface and thickness using integer Gold", () => {
    const curve = custom(), base = preset();
    expect(curvePrice(curve.catalogId, curve)).toBe(Math.ceil(260 * (2 / 1.5) * (120 / 90) * (2.4 / 2.6) * (.08 / .12)));
    expect(curvePrice(base.catalogId, { ...base, radius: 3 })).toBe(520);
    expect(curvePrice(base.catalogId, { ...base, thickness: .24 })).toBe(520);
    const large = customizeCurve(createCurve("curve-divider", { x: 0, z: 0, level: 0 }, "cheap"), { radius: 4, angle: 180, height: 2.8, thickness: .3 });
    expect(curvePrice(large.catalogId, large)).toBe(6480);
    expect(() => commitConstruction(home(), planWith(large), 0, { ...context, gold: 180 })).toThrow(/Gold/);
  });
  it("reprices same-ID edits, retains paid cost on move and caps refund by historical spend", () => {
    const first = commitConstruction(home(), planWith(), 0, context);
    const price = first.quote.cost;
    const moved = { ...custom(), x: -1, rotation: 15 };
    expect(commitConstruction(first.building, planWith(moved), 1, context).quote).toMatchObject({ cost: 0, refund: 0, paid: first.building.paid });
    const larger = customizeCurve(custom(), { radius: 3, thickness: .2 });
    const edit = commitConstruction(first.building, planWith(larger), 1, context);
    expect(edit.quote).toMatchObject({ cost: curvePrice(larger.catalogId, larger), refund: Math.floor(price * REFUND_RATE), added: 1, removed: 1 });
    expect(quoteConstruction(edit.building, platform(), context.gold).refund).toBe(Math.floor(edit.quote.cost * REFUND_RATE));
    const oldReceipt = { ...edit.building, paid: { "curve:custom-glass": 17 } };
    expect(quoteConstruction(oldReceipt, platform(), context.gold).refund).toBe(8);
    expect(quoteConstruction({ ...edit.building, paid: {} }, platform(), context.gold).refund).toBe(0);
    expect(quoteConstruction({ ...edit.building, paid: { "curve:custom-glass": 999999 } }, platform(), context.gold).refund).toBe(Math.floor(edit.quote.cost * REFUND_RATE));
  });
  it("cannot profit by edit/revert/remove and rejects stale commit without mutation", () => {
    const original = home(), snapshot = structuredClone(original);
    const first = commitConstruction(original, planWith(), 0, context);
    const larger = customizeCurve(custom(), { radius: 3 });
    const second = commitConstruction(first.building, planWith(larger), 1, { ...context, gold: first.quote.remainingGold });
    const revert = commitConstruction(second.building, planWith(), 2, { ...context, gold: second.quote.remainingGold });
    const removal = commitConstruction(revert.building, platform(), 3, { ...context, gold: revert.quote.remainingGold });
    expect(removal.quote.remainingGold).toBeLessThan(context.gold);
    expect(original).toEqual(snapshot);
    expect(() => commitConstruction(second.building, planWith(), 1, context)).toThrow(/another tab/);
  });
});

describe("custom profile persistence and idempotent commit", () => {
  it("reloads actual dimensions and retries exact receipt once without touching finance", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lifelevel-custom-curve-"));
    try {
      vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
      const owner = "custom-curve-owner", state = createInitialState(owner, "2026-10-15T12:00:00.000Z");
      state.gold = context.gold; state.character.xp = 10000; state.building = home();
      const file = path.join(directory, `${owner}.json`);
      await writeFile(file, JSON.stringify({ game: state, finance: { sentinel: "private" }, proposals: {}, commands: {} }));
      const plan = planWith(), action = { type: "construction.commit" as const, expectedRevision: 0, plan };
      const [first, replay] = await Promise.all([gameCommand(owner, "custom-add", action), gameCommand(owner, "custom-add", action)]);
      expect(replay.state.gold).toBe(first.state.gold);
      expect(first.state.gold).toBe(context.gold - curvePrice(custom().catalogId, custom()));
      const reload = await readGame(owner);
      expect(reload.building!.plan.curves).toEqual(plan.curves);
      expect(reload.building!.revision).toBe(1);
      const invalid = structuredClone(plan); invalid.curves![0].angle = 121;
      await expect(gameCommand(owner, "invalid", { type: "construction.commit", expectedRevision: 1, plan: invalid })).rejects.toThrow();
      const afterInvalid = await readGame(owner);
      expect(afterInvalid.gold).toBe(first.state.gold);
      expect(afterInvalid.building!.revision).toBe(1);
      const remove = { type: "construction.commit" as const, expectedRevision: 1, plan: platform() };
      const removed = await gameCommand(owner, "custom-remove", remove);
      const retry = await gameCommand(owner, "custom-remove", remove);
      expect(retry.state.gold).toBe(removed.state.gold);
      expect(removed.state.gold).toBe(first.state.gold + Math.floor(curvePrice(custom().catalogId, custom()) * REFUND_RATE));
      const disk = JSON.parse(await readFile(file, "utf8"));
      expect(disk.finance).toEqual({ sentinel: "private" });
      expect(Object.keys(disk.commands)).toHaveLength(2);
    } finally {
      vi.unstubAllEnvs();
      const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("lifelevel-custom-curve-")) throw new Error("Unsafe cleanup");
      await rm(resolved, { recursive: true, force: true });
    }
  });
});
