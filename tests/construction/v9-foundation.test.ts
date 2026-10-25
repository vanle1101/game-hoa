import { describe, expect, it } from "vitest";
import { commitConstruction, constructionContext, getBuilding, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { createFixedApartment, migrateFoundation, migrateLegacyBuilding } from "../../src/construction/migration";
import { buildingStateSchema } from "../../src/construction/schema";
import { cellKey, emptyPlan, rectangleRoom } from "../../src/construction/grid";
import { detectRooms } from "../../src/construction/topology";
import { createInitialState } from "../../src/domain/engine";
import { isFixedApartmentShell } from "../../src/components/construction/render-geometry";

const now = "2026-10-16T12:00:00Z";
const context = { gold: 10000, characterLevel: 1, ownedFurniture: {}, defeatedCampaign: false };

describe("V9 fixed apartment foundation", () => {
  it("creates a real open 12 by 10 metre floor at level one with no paid credit", () => {
    const building = createFixedApartment(now);
    expect(buildingStateSchema.safeParse(building).success).toBe(true);
    expect(building.plot).toEqual({ minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 });
    expect(building.plan.floors).toHaveLength(120);
    expect(building.plan.walls).toHaveLength(44);
    expect(detectRooms(building.plan)).toHaveLength(1);
    expect(detectRooms(building.plan)[0].area).toBe(120);
    expect(building.paid).toEqual({});
    expect(() => validateConstruction(building, building.plan, context)).not.toThrow();
    expect(commitConstruction(building, building.plan, 0, { ...context, gold: 0 }).quote.netCost).toBe(0);
  });

  it.each(["remove", "shift", "upper"])("rejects %s of the original floor", mode => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    if (mode === "remove") plan.floors.pop();
    if (mode === "shift") plan.floors[0].x = 12;
    if (mode === "upper") plan.floors[0].level = 1;
    expect(() => commitConstruction(building, plan, 0, { ...context, characterLevel: 100, defeatedCampaign: true })).toThrow(/original apartment floor/);
  });

  it("allows removing one exterior wall edge and extending the floor onto the terrace", () => {
    const building = createFixedApartment(now);
    const plan = structuredClone(building.plan);
    plan.walls = plan.walls.filter(wall => !(wall.x === -6 && wall.z === -5 && wall.orientation === "x"));
    plan.floors.push({ x: -7, z: -5, level: 0, materialId: "floor-concrete" });
    plan.walls.push({ x: -7, z: -5, level: 0, orientation: "x", materialId: "wall-basic" });
    expect(() => validateConstruction(building, plan, context)).not.toThrow();
    expect(isFixedApartmentShell(plan.floors, building.plot)).toBe(true);
    expect(commitConstruction(building, plan, 0, context).building.plan.walls).toHaveLength(44);
  });

  it.each([
    ["north", "x", 0, -5],
    ["south", "x", 0, 5],
    ["west", "z", -6, 0],
    ["east", "z", 6, 0],
  ] as const)("removes a single 1m %s exterior segment without deleting its neighbours", (_side, orientation, x, z) => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    plan.walls = plan.walls.filter(wall => !(wall.orientation === orientation && wall.x === x && wall.z === z));
    expect(plan.walls).toHaveLength(building.plan.walls.length - 1);
    expect(() => validateConstruction(building, plan, context)).not.toThrow();
    expect(quoteConstruction(building, plan, context.gold).refund).toBe(0);
  });

  it("supports a terrace wall before a new floor finish is laid", () => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    plan.walls.push({ x: -7, z: -6, level: 0, orientation: "x", materialId: "wall-basic" });
    expect(() => validateConstruction(building, plan, context)).not.toThrow();
  });

  it("rejects an extension beyond the terrace boundary", () => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    plan.floors.push({ x: 8, z: 0, level: 0, materialId: "floor-concrete" });
    expect(() => validateConstruction(building, plan, context)).toThrow(/outside your unlocked plot/);
  });

  it("accepts array reordering and interior changes but charges floor finishes", () => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    plan.floors.reverse(); plan.walls.reverse();
    plan.floors[0].materialId = "floor-wood";
    plan.walls.push({ x: 0, z: 0, level: 0, orientation: "x", materialId: "wall-basic" });
    const result = commitConstruction(building, plan, 0, context);
    expect(result.quote.cost).toBe(38); expect(result.quote.refund).toBe(0);
    expect(result.building.foundation).toEqual(building.foundation);
    expect(() => commitConstruction(result.building, plan, 0, context)).toThrow(/another tab/);
    expect(commitConstruction(result.building, plan, 1, context).quote.netCost).toBe(0);
  });

  it("ignores forged plot enlargement and rejects duplicate floor replacement", () => {
    const building = createFixedApartment(now), plan = structuredClone(building.plan);
    building.plot = { minX: -32, maxX: 32, minZ: -32, maxZ: 32, maxLevel: 2, cellSize: 1 };
    plan.floors[0] = { ...plan.floors[1] };
    expect(() => validateConstruction(building, plan, context)).toThrow(/original apartment floor/);
    const duplicate = structuredClone(building.plan);
    duplicate.floors.push({ ...duplicate.floors[0] });
    expect(() => validateConstruction(building, duplicate, context)).toThrow(/Duplicate floor/);
    const outside = structuredClone(building.plan);
    outside.walls.push({ x: 20, z: 20, level: 0, orientation: "x", materialId: "wall-basic" });
    expect(() => validateConstruction(building, outside, context)).toThrow(/existing floor edge/);
  });
});

describe("V9 versioned legacy preservation", () => {
  it("marks a saved 4 by 4 layout without changing any original geometry or assets", () => {
    const state = createInitialState("owner", now);
    state.gold = 781; state.ownedFurniture = { "biolume-plant": 3 };
    state.building = migrateLegacyBuilding(state);
    state.building.plan = rectangleRoom(emptyPlan(), { x: -2, z: -2, level: 0 }, { x: 1, z: 1, level: 0 });
    state.building.plan.walls.push({ x: 0, z: 0, level: 0, orientation: "z", materialId: "wall-basic" });
    state.building.plan.furniture.push({ id: "my-plant", furnitureId: "biolume-plant", x: -2, z: -2, level: 0, rotation: 90 });
    state.building.plan.roomNames = { "0:-2:-2": "Original room" };
    state.building.revision = 13; state.building.paid = { "floor:0:-2:-2": 10 };
    const before = structuredClone(state), next = migrateFoundation(state);
    expect(next.building?.foundation).toEqual({ version: 9, mode: "legacy-preserved" });
    const { foundation, ...unchanged } = next.building!;
    expect(foundation).toBeDefined(); expect(unchanged).toEqual(before.building);
    expect({ ...next, building: before.building }).toEqual(before);
    expect(state).toEqual(before);
    expect(migrateFoundation(next)).toBe(next);
    expect(getBuilding(next)).toBe(next.building);
    expect(migrateLegacyBuilding(next)).toBe(next.building);
    expect(buildingStateSchema.safeParse(next.building).success).toBe(true);
    expect(next.building?.plan.floors.map(cellKey)).toEqual(before.building!.plan.floors.map(cellKey));
    expect(() => validateConstruction(next.building!, next.building!.plan, constructionContext(next))).not.toThrow();
  });

  it("does not infer fixed ownership or rewrite legacy placements without a building", () => {
    const state = createInitialState("owner", now); delete state.housingStarterEligible;
    state.gold = 91; state.placements = [{ id: "old", furnitureId: "biolume-plant", roomId: "living", x: 1.5, z: -1.5, rotation: 90 }];
    state.ownedFurniture = { "biolume-plant": 1 };
    expect(migrateFoundation(state)).toBe(state);
    expect(state.building).toBeUndefined();
  });
});
