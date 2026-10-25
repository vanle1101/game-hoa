import { describe, expect, it } from "vitest";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG, FURNITURE_MODEL_IDS, getFurnitureDefinition, getFurnitureRecipe, isFurnitureModelId, type FurnitureDefinition, type FurniturePart } from "../../src/furniture/catalog";
import { LIVING_V7_CATALOG, LIVING_V7_RECIPES } from "../../src/furniture/collection-living-v7";
import { TECH_V7_CATALOG, TECH_V7_RECIPES } from "../../src/furniture/collection-tech-v7";
import { HOME_V7_CATALOG, HOME_V7_RECIPES } from "../../src/furniture/collection-home-v7";
import { CRAFT_V7_CATALOG, CRAFT_V7_RECIPES } from "../../src/furniture/collection-craft-v7";

type Point = [number, number, number];
type Triangle = [Point, Point, Point];
const collections = [
  { name: "living", catalog: LIVING_V7_CATALOG, recipes: LIVING_V7_RECIPES, count: 26, measuredTriangles: 22844 },
  { name: "tech", catalog: TECH_V7_CATALOG, recipes: TECH_V7_RECIPES, count: 25, measuredTriangles: 15248 },
  { name: "home", catalog: HOME_V7_CATALOG, recipes: HOME_V7_RECIPES, count: 20, measuredTriangles: 20664 },
  { name: "craft", catalog: CRAFT_V7_CATALOG, recipes: CRAFT_V7_RECIPES, count: 13, measuredTriangles: 9076 },
];
const additions = collections.flatMap(collection => collection.catalog);

function scaledParts(parts: readonly FurniturePart[], definition: FurnitureDefinition): FurniturePart[] {
  const scale = [definition.width, definition.height, definition.depth];
  return parts.map(part => ({
    ...part,
    position: part.position.map((value, axis) => value * scale[axis]) as Point,
    size: part.size.map((value, axis) => value * scale[axis]) as Point,
    ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}),
  }));
}

function meshTriangles(parts: readonly FurniturePart[]): Triangle[] {
  return parts.flatMap(part => {
    const geometry = createFurniturePartGeometry(part);
    try {
      const positions = geometry.getAttribute("position"), indices = geometry.getIndex();
      const count = indices?.count ?? positions.count;
      expect(count % 3).toBe(0);
      expect([...positions.array, ...part.position].every(Number.isFinite)).toBe(true);
      if (indices) expect(Array.from(indices.array).every(vertex => Number.isInteger(vertex) && vertex >= 0 && vertex < positions.count)).toBe(true);
      const triangles: Triangle[] = [];
      for (let index = 0; index < count; index += 3) {
        triangles.push([0, 1, 2].map(offset => {
          const vertex = indices ? indices.getX(index + offset) : index + offset;
          const point: Point = [positions.getX(vertex) + part.position[0], positions.getY(vertex) + part.position[1], positions.getZ(vertex) + part.position[2]];
          return point;
        }) as Triangle);
      }
      return triangles;
    } finally {
      geometry.dispose();
    }
  });
}

function meshSignature(triangles: readonly Triangle[]): string {
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) for (const point of triangle) for (let axis = 0; axis < 3; axis++) {
    minimum[axis] = Math.min(minimum[axis], point[axis]);
    maximum[axis] = Math.max(maximum[axis], point[axis]);
  }
  const extent = maximum.map((value, axis) => value - minimum[axis]);
  expect(extent.every(value => Number.isFinite(value) && value > 0)).toBe(true);
  return JSON.stringify([...new Set(triangles.map(triangle => triangle.map(point => point.map((value, axis) =>
    Math.round((value - minimum[axis]) / extent[axis] * 100000)).join(",")).sort().join(";")))].sort());
}

function canonicalParts(definition: FurnitureDefinition): FurniturePart[] {
  const scale = [definition.width, definition.height, definition.depth];
  return getFurnitureRecipe(definition.id)!.parts.map(part => ({
    ...part,
    position: part.position.map((value, axis) => value / scale[axis]) as Point,
    size: part.size.map((value, axis) => value / scale[axis]) as Point,
    ...(part.lean ? { lean: [part.lean[0] / scale[0], part.lean[1] / scale[2]] as const } : {}),
  }));
}

describe("V7 public furniture integration", () => {
  it("registers every collection definition and recipe with no omission or duplicate", () => {
    expect(FURNITURE_CATALOG).toHaveLength(123);
    expect(additions).toHaveLength(84);
    expect(new Set(additions.map(item => item.id)).size).toBe(84);
    expect(FURNITURE_CATALOG.filter(item => item.id.startsWith("v7-")).map(item => item.id).sort()).toEqual(additions.map(item => item.id).sort());
    for (const collection of collections) {
      expect(collection.catalog, collection.name).toHaveLength(collection.count);
      expect(Object.keys(collection.recipes).sort(), collection.name).toEqual(collection.catalog.map(item => item.id).sort());
      for (const definition of collection.catalog) {
        expect(isFurnitureModelId(definition.id), definition.id).toBe(true);
        expect(FURNITURE_MODEL_IDS.filter(id => id === definition.id), definition.id).toHaveLength(1);
        expect(getFurnitureDefinition(definition.id), definition.id).toEqual(definition);
        const expected = scaledParts(collection.recipes[definition.id](), definition);
        expect(getFurnitureRecipe(definition.id), definition.id).toEqual({ id: definition.id, parts: expected });
      }
    }
  });

  it("bounds the complete catalog by the sum of measured collection triangle totals", () => {
    const triangleCounts = new Map<string, number>();
    for (const definition of FURNITURE_CATALOG) {
      const parts = getFurnitureRecipe(definition.id)!.parts;
      expect(parts.length, definition.id).toBeLessThanOrEqual(48);
      const triangles = parts.reduce((sum, part) => {
        const geometry = createFurniturePartGeometry(part);
        try {
          const count = geometry.getIndex()?.count ?? geometry.getAttribute("position").count;
          expect(count % 3, `${definition.id}/${part.id}`).toBe(0);
          return sum + count / 3;
        } finally {
          geometry.dispose();
        }
      }, 0);
      expect(triangles, definition.id).toBeGreaterThan(0);
      expect(triangles, definition.id).toBeLessThanOrEqual(6000);
      triangleCounts.set(definition.id, triangles);
    }
    const measuredOriginalTriangles = 36072;
    const additionIds = new Set(additions.map(definition => definition.id));
    const premiumIds = new Set(["bathroom-suite", "coffee-table", "wool-rug"]);
    const originals = FURNITURE_CATALOG.filter(definition => !additionIds.has(definition.id) && !premiumIds.has(definition.id));
    expect(originals).toHaveLength(36);
    expect(originals.reduce((sum, definition) => sum + triangleCounts.get(definition.id)!, 0)).toBeLessThanOrEqual(45000);
    for (const collection of collections) {
      expect(collection.catalog.reduce((sum, definition) => sum + triangleCounts.get(definition.id)!, 0), collection.name).toBeLessThanOrEqual(collection.measuredTriangles);
    }
    const premiumTriangles = [...premiumIds].reduce((sum, id) => sum + triangleCounts.get(id)!, 0);
    expect(premiumTriangles).toBeLessThanOrEqual(3000);
    const catalogTriangleBudget = measuredOriginalTriangles + collections.reduce((sum, collection) => sum + collection.measuredTriangles, 0) + premiumTriangles;
    expect([...triangleCounts.values()].reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(catalogTriangleBudget);
  });

  it("contains distinct actual triangle structures in both canonical and public dimensions", () => {
    for (const canonical of [false, true]) {
      const seen = new Map<string, string>();
      for (const definition of FURNITURE_CATALOG) {
        const parts = canonical ? canonicalParts(definition) : getFurnitureRecipe(definition.id)!.parts;
        const signature = meshSignature(meshTriangles(parts));
        expect(seen.get(signature), `${definition.id}/canonical-${canonical}`).toBeUndefined();
        seen.set(signature, definition.id);
      }
      expect(seen.size).toBe(123);
    }
  });

  it("does not count renaming, recoloring, part ordering or global mesh scale as structural novelty", () => {
    const parts = getFurnitureRecipe("cloud-bed")!.parts;
    const original = meshTriangles(parts);
    const signature = meshSignature(original);
    const renamed = parts.map((part, index) => ({ ...part, id: `part-${index}`, material: "gold" as const, surface: undefined })).reverse();
    expect(meshSignature(meshTriangles(renamed))).toBe(signature);
    const transformed = original.map(triangle => triangle.map(point => point.map((value, axis) => value * [2, 3, 4][axis] + [7, -5, 11][axis]) as Point).reverse() as Triangle).reverse();
    expect(meshSignature(transformed)).toBe(signature);
    expect(meshSignature([...original, ...original])).toBe(signature);
    expect(meshSignature(original.slice(1))).not.toBe(signature);
  });

  it("distinguishes changed triangle connectivity even when all vertex positions are shared", () => {
    const a: Point = [0, 0, 0], b: Point = [1, 0, 0], c: Point = [0, 1, 0], d: Point = [0, 0, 1];
    expect(meshSignature([[a, b, c], [a, b, d]])).not.toBe(meshSignature([[a, b, c], [a, c, d]]));
  });
});
