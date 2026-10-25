import { describe, expect, it } from "vitest";
import { createDevelopedShowcase, createDevelopedShowcasePlan } from "@/components/world/developed-showcase";
import { createFixedApartment } from "@/construction/migration";
import { quoteConstruction, validateConstruction } from "@/construction/engine";
import { cellKey, edgeKey } from "@/construction/grid";
import { findBuildingPath, furnitureFootprint, occupiedCells, safeSpawn } from "@/construction/navigation";
import { buildingStateSchema } from "@/construction/schema";
import { buildingFurnitureRoute } from "@/furniture/interactions";
import { getFurnitureDefinition } from "@/furniture/catalog";

const NOW = "2026-02-04T10:00:00.000Z";

function fixtureContext() {
  const fixture = createDevelopedShowcase(NOW);
  return {
    fixture,
    context: {
      gold: 0,
      characterLevel: fixture.requirements.characterLevel,
      ownedFurniture: fixture.requirements.furnitureCopies,
      defeatedCampaign: false,
    },
  };
}

describe("isolated developed apartment showcase", () => {
  it("creates a schema-valid fixed 12 by 10 apartment with exactly the protected shell", () => {
    const fixture = createDevelopedShowcase(NOW);
    const base = createFixedApartment(NOW);
    expect(buildingStateSchema.safeParse(fixture.building).success).toBe(true);
    expect(fixture.kind).toBe("isolated-showcase");
    expect(fixture.building.plot).toEqual({ minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 });
    expect(fixture.building.foundation).toEqual(base.foundation);
    expect(fixture.building.plan.floors).toHaveLength(120);
    expect(new Set(fixture.building.plan.floors.map(cellKey))).toEqual(new Set(base.plan.floors.map(cellKey)));
    expect(fixture.building.plan.walls).toEqual(base.plan.walls);
    expect(new Set(fixture.building.plan.walls.map(edgeKey)).size).toBe(44);
    expect(fixture.building.plan.stairs).toEqual([]);
    expect(fixture.building.plan.ceilings).toEqual([]);
    expect(fixture.building.plan.roofs).toEqual([]);
  });

  it("retains the starter bed, desk, wardrobe, chair, tower and light placements", () => {
    const plan = createDevelopedShowcasePlan();
    expect(plan.furniture.slice(0, 6)).toEqual([
      { id: "starter-home:bed", furnitureId: "cloud-bed", x: -5, z: -4, level: 0, rotation: 0 },
      { id: "starter-home:wardrobe", furnitureId: "wardrobe", x: -6, z: 0, level: 0, rotation: 0 },
      { id: "starter-home:desk", furnitureId: "workstation", x: 1, z: -4, level: 0, rotation: 0 },
      { id: "starter-home:chair", furnitureId: "dining-chair", x: 2, z: -3, level: 0, rotation: 180 },
      { id: "starter-home:tower", furnitureId: "v7-desktop-tower", x: 4, z: -4, level: 0, rotation: 0 },
      { id: "starter-home:light", furnitureId: "neon-floor-lamp", x: -5, z: 2, level: 0, rotation: 0 },
    ]);
  });

  it("uses real catalog items for the developed kitchen, lounge, greenery, light and privacy screen", () => {
    const plan = createDevelopedShowcasePlan();
    for (const item of plan.furniture) expect(getFurnitureDefinition(item.furnitureId)).toBeDefined();
    const ids = plan.furniture.map(item => item.furnitureId);
    expect(ids).toEqual(expect.arrayContaining(["kitchen-island", "range-cooker", "refrigerator", "corner-sofa", "biolume-plant", "tripod-lamp", "v7-folding-screen"]));
    expect(ids.filter(id => id === "biolume-plant")).toHaveLength(3);
    expect(ids.filter(id => id === "bar-stool")).toHaveLength(2);
    expect(new Set(plan.furniture.map(item => item.id)).size).toBe(plan.furniture.length);
  });

  it("passes actual construction validation with explicit isolated fixture requirements", () => {
    const { fixture, context } = fixtureContext();
    expect(validateConstruction(fixture.building, fixture.building.plan, context)).toEqual(fixture.building.plan);
    expect(() => validateConstruction(fixture.building, fixture.building.plan, { ...context, ownedFurniture: {} })).toThrow("You do not own enough copies");
  });

  it("has supported and disjoint furniture footprints", () => {
    const plan = createDevelopedShowcasePlan();
    const floors = new Set(plan.floors.map(cellKey));
    const seen = new Set<string>();
    for (const item of plan.furniture) {
      const footprint = furnitureFootprint(item);
      expect(footprint.length).toBeGreaterThan(0);
      for (const cell of footprint) {
        expect(floors.has(cellKey(cell))).toBe(true);
        expect(seen.has(cellKey(cell))).toBe(false);
        seen.add(cellKey(cell));
      }
    }
  });

  it("keeps the entrance and every walkable cell connected to the spawn", () => {
    const plan = createDevelopedShowcasePlan();
    const spawn = safeSpawn(plan);
    expect(spawn).toEqual({ x: 0, z: 0, level: 0 });
    const blocked = occupiedCells(plan);
    expect(blocked.has("0:0:4")).toBe(false);
    for (const cell of plan.floors.filter(cell => !blocked.has(cellKey(cell)))) {
      expect(findBuildingPath(plan, spawn!, cell).length, cellKey(cell)).toBeGreaterThan(0);
    }
  });

  it("provides a reachable interaction approach to every furniture instance", () => {
    const plan = createDevelopedShowcasePlan();
    const spawn = safeSpawn(plan)!;
    for (const item of plan.furniture) {
      expect(buildingFurnitureRoute(plan, spawn, item).length, item.id).toBeGreaterThan(0);
    }
  });

  it("reports real ownership and construction costs without creating an account or refundable paid record", () => {
    const fixture = createDevelopedShowcase(NOW);
    const expectedCopies: Record<string, number> = {};
    let expectedGold = 0;
    for (const item of fixture.building.plan.furniture) {
      expectedCopies[item.furnitureId] = (expectedCopies[item.furnitureId] ?? 0) + 1;
      expectedGold += getFurnitureDefinition(item.furnitureId)!.price;
    }
    expect(fixture.requirements.furnitureCopies).toEqual(expectedCopies);
    expect(fixture.requirements.furnitureGold).toBe(expectedGold);
    expect(fixture.requirements.furnitureGold).toBeGreaterThan(0);
    expect(fixture.requirements.constructionGold).toBe(quoteConstruction(createFixedApartment(NOW), fixture.building.plan, 0).cost);
    expect(fixture.requirements.constructionGold).toBeGreaterThan(0);
    expect(fixture.building.paid).toEqual({});
    expect(fixture.building.revision).toBe(0);
    expect(fixture).not.toHaveProperty("gold");
    expect(fixture).not.toHaveProperty("ownedFurniture");
    expect(fixture).not.toHaveProperty("ledger");
  });

  it("returns deterministic fresh state with no shared mutable fixture data", () => {
    const before = createDevelopedShowcase();
    const after = createDevelopedShowcase();
    expect(after).toEqual(before);
    before.building.plan.furniture[0].x = 30;
    before.building.plan.floors[0].materialId = "floor-luxury";
    before.building.plan.walls[0].materialId = "wall-neon";
    before.building.plot.minX = -30;
    before.requirements.furnitureCopies["cloud-bed"] = 100;
    before.gaps[0].description = "changed";
    expect(createDevelopedShowcase()).toEqual(after);
    expect(createDevelopedShowcasePlan()).toEqual(after.building.plan);
  });

  it("explicitly reports missing reference details rather than fabricating supported assets", () => {
    const fixture = createDevelopedShowcase();
    expect(fixture.gaps.map(gap => gap.id)).toEqual(["bathroom", "panoramic-facade", "coffee-table", "surface-layering"]);
    expect(fixture.gaps.find(gap => gap.id === "bathroom")?.description).toContain("no toilet, shower");
    expect(fixture.building.plan.furniture.every(item => getFurnitureDefinition(item.furnitureId))).toBe(true);
  });
});
