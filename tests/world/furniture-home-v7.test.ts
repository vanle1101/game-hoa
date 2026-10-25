import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFurniturePartGeometry, getFurnitureMaterialProperties } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG, getFurnitureRecipe, getFurniturePartBounds, type FurniturePart, type FurnitureVector } from "../../src/furniture/catalog";
import { HOME_V7_CATALOG, HOME_V7_RECIPES } from "../../src/furniture/collection-home-v7";

const shapes = ["box", "cylinder", "sphere", "cone", "frustum", "cup", "ring", "arch", "crystal"];
const materials = ["finish", "wood", "metal", "fabric", "cushion", "glass", "screen", "glow", "leaf", "gold", "dark", "paper"];
const epsilon = 1e-6;
const vector = (values: readonly number[]): FurnitureVector => values as unknown as FurnitureVector;
const scaleParts = (parts: readonly FurniturePart[], scale: FurnitureVector): FurniturePart[] => parts.map(part => ({ ...part, position: vector(part.position.map((value, axis) => value * scale[axis])), size: vector(part.size.map((value, axis) => value * scale[axis])), ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}) }));

function structuralSignature(parts: readonly FurniturePart[]): string {
  const bounds = parts.map(getFurniturePartBounds);
  const min = [0, 1, 2].map(axis => Math.min(...bounds.map(bound => bound.min[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...bounds.map(bound => bound.max[axis])));
  const span = max.map((value, axis) => value - min[axis]);
  const round = (n: number) => Number(n.toFixed(6));
  return JSON.stringify(parts.map(part => ({
    shape: part.shape,
    position: part.position.map((value, axis) => round((value - min[axis]) / span[axis])),
    size: part.size.map((value, axis) => round(value / span[axis])),
    rotation: part.rotation?.map(round) ?? [0, 0, 0],
    lean: part.lean?.map((value, axis) => round(value / span[axis === 0 ? 0 : 2])) ?? [0, 0],
    roundness: part.roundness ?? 0,
    radialSegments: part.radialSegments ?? (part.shape === "cylinder" ? 16 : part.shape === "cone" ? 12 : 24),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

const landmarks: Record<string, readonly string[]> = {
  "v7-espresso-machine": ["brew-head", "filter-handle", "steam-wand", "coffee-cup"],
  "v7-stand-mixer": ["motor-head", "mixing-bowl", "mixing-shaft", "tilt-latch"],
  "v7-tea-tray": ["overhead-handle", "tea-spout", "kettle-lid", "tea-cup-1"],
  "v7-dish-rack": ["drain-tray", "slot-prong-0-1", "plate-0", "utensil-basket"],
  "v7-dining-table": ["oval-tabletop", "cross-leg-1-1", "dinner-plate-1", "fork--1"],
  "v7-breakfast-trolley": ["tray-0.22", "tray-0.78", "push-handle", "thermos", "bread-basket"],
  "v7-extractor-hood": ["exhaust-duct", "flared-canopy", "filter-frame", "filter-slat-0"],
  "v7-folding-screen": ["woven-panel--1", "woven-panel-0", "woven-panel-1", "hinge-1-0.75"],
  "v7-pendulum-clock": ["clock-face", "hour-hand", "minute-hand", "pendulum-rod", "pendulum-bob"],
  "v7-coat-tree": ["radial-foot-2", "coat-hook-0", "coat-hook-5", "crown-finial"],
  "v7-tassel-rug": ["woven-ground", "diamond-1", "tassel--1-11", "tassel-1-11"],
  "v7-bonsai-tray": ["bent-trunk", "left-branch", "right-canopy", "shallow-planter"],
  "v7-art-easel": ["a-frame-leg-1", "rear-prop", "canvas", "sun-disc", "near-hill"],
  "v7-vase-cluster": ["tall-vase-neck", "low-vase-mouth", "flared-vessel", "dried-grass-stem"],
  "v7-globe-stand": ["world-sphere", "meridian-ring", "polar-axis", "north-continent"],
  "v7-umbrella-stand": ["basket-upright-9", "folded-umbrella-1", "curved-handle--1"],
  "v7-shoe-rack": ["shoe-slat-0.6-0.27", "shoe-1-1", "entry-mat"],
  "v7-textile-rail": ["textile-crossbar", "hanging-weave", "folded-back", "knotted-fringe-7"],
  "v7-zen-garden": ["sand-bed", "sand-ridge-0.12", "large-stone", "rake-handle", "rake-tooth-0"],
  "v7-magazine-sling": ["cross-frame-1-1", "fabric-pocket--1", "pocket-bottom", "magazine-2"],
};

describe("V7 home furniture collection", () => {
  it("exports exactly seven kitchen and thirteen decor models with matching recipe keys", () => {
    expect(HOME_V7_CATALOG).toHaveLength(20);
    expect(HOME_V7_CATALOG.filter(item => item.category === "kitchen")).toHaveLength(7);
    expect(HOME_V7_CATALOG.filter(item => item.category === "decor")).toHaveLength(13);
    expect(Object.keys(HOME_V7_RECIPES).sort()).toEqual(HOME_V7_CATALOG.map(item => item.id).sort());
    expect(new Set(HOME_V7_CATALOG.map(item => item.id)).size).toBe(20);
    expect(new Set(HOME_V7_CATALOG.map(item => item.name)).size).toBe(20);
    expect(Object.isFrozen(HOME_V7_CATALOG)).toBe(true);
    expect(Object.isFrozen(HOME_V7_RECIPES)).toBe(true);
  });

  it("imports catalog types only, avoiding a runtime catalog cycle", () => {
    const source = readFileSync(new URL("../../src/furniture/collection-home-v7.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[^;]+;/gm) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatch(/^import type .* from "\.\/catalog";/);
    expect(source).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  it.each(HOME_V7_CATALOG)("$id has valid Vietnamese metadata and bounded economy", item => {
    expect(item.id).toMatch(/^v7-[a-z]+(?:-[a-z0-9]+)*$/);
    for (const text of [item.name, item.description, ...item.interactions.map(action => action.label)]) {
      expect(text).toMatch(/[À-ỹ]/);
      expect(text.length).toBeGreaterThan(5);
    }
    expect(item.description.length).toBeGreaterThan(35);
    expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const value of [item.width, item.height, item.depth]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(.025);
      expect(value).toBeLessThanOrEqual(3);
    }
    expect(Number.isInteger(item.price)).toBe(true);
    expect(item.price).toBeGreaterThanOrEqual(25);
    expect(item.price).toBeLessThanOrEqual(800);
    expect(Number.isInteger(item.level)).toBe(true);
    expect(item.level).toBeGreaterThanOrEqual(1);
    expect(item.level).toBeLessThanOrEqual(10);
    expect(item.interactions.length).toBeGreaterThan(0);
    expect(new Set(item.interactions.map(action => action.id)).size).toBe(item.interactions.length);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.interactions)).toBe(true);
    for (const action of item.interactions) {
      expect(["cook", "inspect", "store"]).toContain(action.id);
      expect(["recovery", "inventory"]).toContain(action.screen);
      if (action.activity) expect(action.activity).toBe("working");
      expect(action.toggle).toBeUndefined();
      expect(Object.isFrozen(action)).toBe(true);
    }
  });

  it("rejects recolors, material swaps, reordered parts and scaled clones as unique structures", () => {
    const entries = HOME_V7_CATALOG.map(item => ({ id: item.id, parts: HOME_V7_RECIPES[item.id]() }));
    const existing = FURNITURE_CATALOG.filter(item => !HOME_V7_RECIPES[item.id]).map(item => {
      const parts = getFurnitureRecipe(item.id)!.parts;
      return { id: item.id, parts: scaleParts(parts, [1 / item.width, 1 / item.height, 1 / item.depth]) };
    });
    const signatures = new Map<string, string>();
    for (const { id, parts } of [...existing, ...entries]) {
      const signature = structuralSignature(parts);
      expect(signatures.get(signature), `${id} duplicates ${signatures.get(signature)}`).toBeUndefined();
      signatures.set(signature, id);
    }
    const sample = HOME_V7_RECIPES["v7-stand-mixer"]();
    const clone = scaleParts(sample, [3, 3, 3]).map((part, i) => ({ ...part, id: `renamed-${i}`, material: "gold" as const })).reverse();
    expect(structuralSignature(clone)).toBe(structuralSignature(sample));
  });

  it.each(HOME_V7_CATALOG)("$id has deterministic distinct assemblies with recognizable landmarks", item => {
    const parts = HOME_V7_RECIPES[item.id]();
    expect(parts).toEqual(HOME_V7_RECIPES[item.id]());
    expect(parts).not.toBe(HOME_V7_RECIPES[item.id]());
    expect(parts.length).toBeGreaterThanOrEqual(8);
    expect(parts.length).toBeLessThanOrEqual(48);
    expect(new Set(parts.map(part => part.id)).size).toBe(parts.length);
    for (const id of landmarks[item.id]) expect(parts.map(part => part.id)).toContain(id);
    expect(parts.every(part => part.id.length > 0)).toBe(true);
    expect(parts.some(part => part.material === "wood" || part.material === "paper" || part.material === "fabric")).toBe(true);
  });

  it.each(HOME_V7_CATALOG)("$id keeps normalized and caller-scaled CPU meshes finite and within budget", item => {
    const normalized = HOME_V7_RECIPES[item.id]();
    const scale: FurnitureVector = [item.width, item.height, item.depth];
    for (const [parts, dimensions] of [[normalized, [1, 1, 1]], [scaleParts(normalized, scale), scale]] as const) {
      let triangles = 0;
      const minimum = [-dimensions[0] / 2, 0, -dimensions[2] / 2];
      const maximum = [dimensions[0] / 2, dimensions[1], dimensions[2] / 2];
      for (const part of parts) {
        expect(shapes).toContain(part.shape);
        expect(materials).toContain(part.material);
        expect(part.position.every(Number.isFinite)).toBe(true);
        expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
        if (part.rotation) expect(part.rotation.every(Number.isFinite)).toBe(true);
        if (part.lean) expect(part.lean.every(Number.isFinite)).toBe(true);
        if (part.radialSegments !== undefined) {
          expect(Number.isInteger(part.radialSegments)).toBe(true);
          expect(part.radialSegments).toBeGreaterThanOrEqual(3);
          expect(part.radialSegments).toBeLessThanOrEqual(32);
        }
        const geometry = createFurniturePartGeometry(part);
        try {
          const position = geometry.getAttribute("position");
          const normal = geometry.getAttribute("normal");
          expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
          expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
          const count = (geometry.index?.count ?? position.count) / 3;
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThan(0);
          triangles += count;
          geometry.computeBoundingBox();
          const meshBounds = geometry.boundingBox!;
          const bounds = getFurniturePartBounds(part);
          for (let axis = 0; axis < 3; axis++) {
            const label = `${item.id}/${part.id}/axis-${axis}/scale-${dimensions.join(",")}`;
            const lo = meshBounds.min.getComponent(axis) + part.position[axis];
            const hi = meshBounds.max.getComponent(axis) + part.position[axis];
            expect(lo, label).toBeGreaterThanOrEqual(minimum[axis] - epsilon);
            expect(hi, label).toBeLessThanOrEqual(maximum[axis] + epsilon);
            expect(lo, label).toBeGreaterThanOrEqual(bounds.min[axis] - epsilon);
            expect(hi, label).toBeLessThanOrEqual(bounds.max[axis] + epsilon);
            expect(hi - lo, label).toBeGreaterThan(0);
          }
          const material = getFurnitureMaterialProperties(part, item.color);
          expect(Number.isFinite(material.roughness)).toBe(true);
          expect(Number.isFinite(material.metalness)).toBe(true);
        } finally {
          geometry.dispose();
        }
      }
      expect(triangles, item.id).toBeLessThanOrEqual(6000);
    }
  });
});
