import { quoteConstruction } from "@/construction/engine";
import { createFixedApartment } from "@/construction/migration";
import type { BuildingFurniture, BuildingPlan, BuildingState } from "@/construction/types";
import { getFurnitureDefinition } from "@/furniture/catalog";
import { buildingItem } from "@/construction/catalog";

export type DevelopedShowcaseGap = {
  id: "bathroom" | "panoramic-facade" | "coffee-table" | "surface-layering";
  description: string;
};

export type DevelopedShowcaseFixture = {
  kind: "isolated-showcase";
  building: BuildingState;
  requirements: {
    characterLevel: number;
    furnitureCopies: Record<string, number>;
    furnitureGold: number;
    constructionGold: number;
  };
  gaps: DevelopedShowcaseGap[];
};

const SHOWCASE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function furniture(
  id: string,
  furnitureId: string,
  x: number,
  z: number,
  rotation: BuildingFurniture["rotation"] = 0,
): BuildingFurniture {
  return { id, furnitureId, x, z, level: 0, rotation };
}

export function createDevelopedShowcasePlan(): BuildingPlan {
  const plan = createFixedApartment(SHOWCASE_TIMESTAMP).plan;
  plan.floors = plan.floors.map(cell => ({
    ...cell,
    materialId: cell.x < -1 && cell.z >= 1 ? "floor-ceramic" : "floor-wood",
  }));
  plan.furniture = [
    furniture("starter-home:bed", "cloud-bed", -5, -4),
    furniture("starter-home:wardrobe", "wardrobe", -6, 0),
    furniture("starter-home:desk", "workstation", 1, -4),
    furniture("starter-home:chair", "dining-chair", 2, -3, 180),
    furniture("starter-home:tower", "v7-desktop-tower", 4, -4),
    furniture("starter-home:light", "cyan_floor_light", -5, 2),
    furniture("showcase:kitchen-island", "kitchen-island", -3, 2),
    furniture("showcase:island-stool-left", "bar-stool", -3, 4, 180),
    furniture("showcase:island-stool-right", "bar-stool", -2, 4, 180),
    furniture("showcase:refrigerator", "refrigerator", -5, 1),
    furniture("showcase:range", "range-cooker", -6, 1, 90),
    furniture("showcase:lounge", "corner-sofa", 1, 1),
    furniture("showcase:bedroom-light", "tripod-lamp", -1, -4),
    furniture("showcase:lounge-light", "tripod-lamp", 4, 1),
    furniture("showcase:bedroom-screen", "v7-folding-screen", -1, -2, 90),
    furniture("showcase:window-plant", "biolume-plant", 5, -5),
    furniture("showcase:kitchen-plant", "biolume-plant", -6, 4),
    furniture("showcase:lounge-plant", "biolume-plant", 5, 3),
    furniture("showcase:display-shelf", "bookcase", 5, -2, 90),
  ];
  plan.roomNames = { "room:0:0:0": "Căn hộ hoàn thiện · Bản xem trước" };
  return plan;
}

export function createDevelopedShowcase(now: string = SHOWCASE_TIMESTAMP): DevelopedShowcaseFixture {
  const base = createFixedApartment(now);
  const plan = createDevelopedShowcasePlan();
  const furnitureCopies: Record<string, number> = {};
  let furnitureGold = 0;
  let characterLevel = 1;
  for (const item of plan.furniture) {
    const definition = getFurnitureDefinition(item.furnitureId);
    if (!definition) throw new Error(`Unknown showcase furniture: ${item.furnitureId}`);
    furnitureCopies[item.furnitureId] = (furnitureCopies[item.furnitureId] ?? 0) + 1;
    furnitureGold += definition.price;
    characterLevel = Math.max(characterLevel, definition.level);
  }
  for (const cell of plan.floors) {
    const definition = buildingItem(cell.materialId);
    if (!definition) throw new Error(`Unknown showcase floor: ${cell.materialId}`);
    characterLevel = Math.max(characterLevel, definition.level);
  }
  return {
    kind: "isolated-showcase",
    building: { ...base, plan, paid: {} },
    requirements: {
      characterLevel,
      furnitureCopies,
      furnitureGold,
      constructionGold: quoteConstruction(base, plan, 0).cost,
    },
    gaps: [
      { id: "bathroom", description: "The catalog has no toilet, shower, bath or bathroom vanity. The island sink remains a kitchen fixture; no bathroom is represented." },
      { id: "panoramic-facade", description: "The fixed apartment protects its exterior and two small structural windows. REF-D's floor-to-ceiling facade cannot replace them through a valid fixed-apartment plan." },
      { id: "coffee-table", description: "The catalog has no dedicated low coffee table. The lounge uses the existing corner sofa without relabeling a dining table or other asset." },
      { id: "surface-layering", description: "Furniture occupies whole grid footprints with no vertical offsets or overlap. Separate lamps cannot sit on desks, and a catalog rug cannot share cells with a sofa or bed." },
    ],
  };
}
