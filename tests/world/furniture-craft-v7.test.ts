import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG, getFurniturePartBounds, getFurnitureRecipe, type FurnitureDefinition, type FurniturePart } from "../../src/furniture/catalog";
import { CRAFT_V7_CATALOG, CRAFT_V7_RECIPES } from "../../src/furniture/collection-craft-v7";

const shapes = ["box", "cylinder", "sphere", "cone", "frustum", "cup", "ring", "arch", "crystal"];
const materials = ["finish", "wood", "metal", "fabric", "cushion", "glass", "screen", "glow", "leaf", "gold", "dark", "paper"];
const tolerance = 2e-6;
const ids = CRAFT_V7_CATALOG.map(item => item.id);

function scaledParts(definition: FurnitureDefinition): readonly FurniturePart[] {
  const scale = [definition.width, definition.height, definition.depth];
  return CRAFT_V7_RECIPES[definition.id]().map(part => ({
    ...part,
    position: part.position.map((value, axis) => value * scale[axis]) as [number, number, number],
    size: part.size.map((value, axis) => value * scale[axis]) as [number, number, number],
    ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}),
  }));
}

function geometrySignature(parts: readonly FurniturePart[]): string {
  const clouds = parts.map(part => {
    const geometry = createFurniturePartGeometry(part);
    try {
      const positions = geometry.getAttribute("position");
      return Array.from({ length: positions.count }, (_, index) => [
        positions.getX(index) + part.position[0], positions.getY(index) + part.position[1], positions.getZ(index) + part.position[2],
      ]);
    } finally { geometry.dispose(); }
  });
  const minimum = [0, 1, 2].map(axis => Math.min(...clouds.flatMap(cloud => cloud.map(vertex => vertex[axis]))));
  const maximum = [0, 1, 2].map(axis => Math.max(...clouds.flatMap(cloud => cloud.map(vertex => vertex[axis]))));
  return JSON.stringify(clouds.map(cloud => [...new Set(cloud.map(vertex => vertex.map((value, axis) => ((value - minimum[axis]) / (maximum[axis] - minimum[axis])).toFixed(5)).join(",")))].sort()).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function overlaps(a: ReturnType<typeof getFurniturePartBounds>, b: ReturnType<typeof getFurniturePartBounds>): boolean {
  return [0, 1, 2].every(axis => Math.max(a.min[axis], b.min[axis]) <= Math.min(a.max[axis], b.max[axis]) + tolerance);
}

function expectSurfaceBelow(id: string, supportId: string, x: number, y: number, z: number, maxDistance: number) {
  const part = CRAFT_V7_RECIPES[id]().find(entry => entry.id === supportId)!;
  expect(part, `${id}/${supportId}`).toBeDefined();
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(createFurniturePartGeometry(part), material);
  try {
    mesh.position.set(...part.position);
    mesh.updateMatrixWorld(true);
    const hits = new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0), 0, maxDistance + tolerance).intersectObject(mesh);
    expect(hits.length, `${id}/${supportId} surface support`).toBeGreaterThan(0);
  } finally { mesh.geometry.dispose(); material.dispose(); }
}

function expectSolidContact(id: string, first: string, second: string, x: number, z: number) {
  const definition = CRAFT_V7_CATALOG.find(item => item.id === id)!;
  for (const scaled of [false, true]) {
    const parts = scaled ? scaledParts(definition) : CRAFT_V7_RECIPES[id]();
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const ray = new Raycaster(new Vector3(x * (scaled ? definition.width : 1), 2 * (scaled ? definition.height : 1), z * (scaled ? definition.depth : 1)), new Vector3(0, -1, 0));
    try {
      const intervals = [first, second].map(name => {
        const part = parts.find(entry => entry.id === name)!;
        const mesh = new Mesh(createFurniturePartGeometry(part), material);
        try {
          mesh.position.set(...part.position); mesh.updateMatrixWorld(true);
          const hits = ray.intersectObject(mesh).map(hit => hit.distance);
          expect(hits.length, `${id}/${name} actual surface intersections`).toBeGreaterThanOrEqual(2);
          return [Math.min(...hits), Math.max(...hits)];
        } finally { mesh.geometry.dispose(); }
      });
      expect(Math.max(intervals[0][0], intervals[1][0]) - Math.min(intervals[0][1], intervals[1][1]), `${id}/${first}/${second} actual solid contact`).toBeLessThanOrEqual(tolerance);
    } finally { material.dispose(); }
  }
}

describe("V7 craft and collectible collection", () => {
  it("exports exactly thirteen stable models with seven workshop and six collectible entries", () => {
    expect(CRAFT_V7_CATALOG).toHaveLength(13);
    expect(CRAFT_V7_CATALOG.filter(item => item.category === "workshop")).toHaveLength(7);
    expect(CRAFT_V7_CATALOG.filter(item => item.category === "collectible")).toHaveLength(6);
    expect(new Set(ids).size).toBe(13);
    expect(new Set(CRAFT_V7_CATALOG.map(item => item.name)).size).toBe(13);
    expect(Object.keys(CRAFT_V7_RECIPES).sort()).toEqual([...ids].sort());
    expect(Object.isFrozen(CRAFT_V7_CATALOG)).toBe(true);
  });

  it("imports catalog types without creating a runtime dependency cycle", () => {
    const source = readFileSync(new URL("../../src/furniture/collection-craft-v7.ts", import.meta.url), "utf8");
    expect(source).toMatch(/import type \{[^}]+\} from "\.\/catalog"/);
    expect(source).not.toMatch(/import\s+(?!type\b)[^;]*["']\.\/catalog["']/);
    expect(source).not.toMatch(/\b(?:require|import)\s*\(\s*["']\.\/catalog["']/);
  });

  it.each(CRAFT_V7_CATALOG)("$id has Vietnamese metadata and valid economy and interaction values", item => {
    expect(item.id).toMatch(/^v7-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(item.name).toMatch(/[à-ỹđ]/i);
    expect(item.description.length).toBeGreaterThan(40);
    expect(item.description).toMatch(/[à-ỹđ]/i);
    expect(item.color).toMatch(/^#[a-f0-9]{6}$/i);
    for (const value of [item.width, item.height, item.depth]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(.4);
      expect(value).toBeLessThanOrEqual(3);
    }
    expect(Number.isInteger(item.price)).toBe(true);
    expect(item.price).toBeGreaterThanOrEqual(100);
    expect(item.price).toBeLessThanOrEqual(1500);
    expect(Number.isInteger(item.level)).toBe(true);
    expect(item.level).toBeGreaterThanOrEqual(1);
    expect(item.level).toBeLessThanOrEqual(10);
    expect(item.interactions).toHaveLength(1);
    expect(item.interactions[0]).toMatchObject(item.category === "workshop" ? { id: "craft", screen: "crafting", activity: "working" } : { id: "display", screen: "achievements" });
    expect(item.interactions[0].label).toMatch(/[à-ỹđ]/i);
  });

  it("contains unique actual geometry independent of names, materials, color, translation and overall axis scale", () => {
    const signatures = CRAFT_V7_CATALOG.map(item => geometrySignature(scaledParts(item)));
    expect(new Set(signatures).size).toBe(13);
    const existing = new Set(FURNITURE_CATALOG.filter(item => !ids.includes(item.id)).map(item => geometrySignature(getFurnitureRecipe(item.id)!.parts)));
    for (const signature of signatures) expect(existing.has(signature)).toBe(false);
    const original = CRAFT_V7_RECIPES[ids[0]]();
    const altered = original.map(part => ({ ...part, id: `renamed-${part.id}`, material: "gold" as const, position: part.position.map((value, axis) => value * [2, 3, 4][axis] + [7, 5, -3][axis]) as [number, number, number], size: part.size.map((value, axis) => value * [2, 3, 4][axis]) as [number, number, number], ...(part.lean ? { lean: [part.lean[0] * 2, part.lean[1] * 4] as const } : {}) }));
    expect(geometrySignature(altered)).toBe(geometrySignature(original));
  });

  it.each(CRAFT_V7_CATALOG)("$id produces deterministic independent recipes with supported geometry within budgets", definition => {
    const normalized = CRAFT_V7_RECIPES[definition.id]();
    expect(CRAFT_V7_RECIPES[definition.id]()).toEqual(normalized);
    expect(CRAFT_V7_RECIPES[definition.id]()).not.toBe(normalized);
    expect(normalized.length).toBeGreaterThanOrEqual(8);
    expect(normalized.length).toBeLessThanOrEqual(48);
    expect(new Set(normalized.map(part => part.id)).size).toBe(normalized.length);
    for (const [parts, minimum, maximum] of [
      [normalized, [-.5, 0, -.5], [.5, 1, .5]],
      [scaledParts(definition), [-definition.width / 2, 0, -definition.depth / 2], [definition.width / 2, definition.height, definition.depth / 2]],
    ] as const) {
      let triangles = 0;
      for (const part of parts) {
        expect(shapes).toContain(part.shape);
        expect(materials).toContain(part.material);
        expect(part.position.every(Number.isFinite)).toBe(true);
        expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
        expect((part.rotation ?? []).every(Number.isFinite)).toBe(true);
        expect((part.lean ?? []).every(Number.isFinite)).toBe(true);
        if (part.roundness !== undefined) { expect(part.roundness).toBeGreaterThan(0); expect(part.roundness).toBeLessThan(.5); }
        if (part.radialSegments !== undefined) { expect(Number.isInteger(part.radialSegments)).toBe(true); expect(part.radialSegments).toBeGreaterThanOrEqual(3); expect(part.radialSegments).toBeLessThanOrEqual(32); }
        const bounds = getFurniturePartBounds(part);
        const geometry = createFurniturePartGeometry(part);
        try {
          const positions = geometry.getAttribute("position");
          const normals = geometry.getAttribute("normal");
          const index = geometry.index;
          const count = (index?.count ?? positions.count) / 3;
          triangles += count;
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThan(0);
          expect([...positions.array, ...normals.array].every(Number.isFinite)).toBe(true);
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const point = [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)];
            for (let axis = 0; axis < 3; axis++) {
              const world = point[axis] + part.position[axis];
              expect(world, `${definition.id}/${part.id} min-${axis}`).toBeGreaterThanOrEqual(minimum[axis] - tolerance);
              expect(world, `${definition.id}/${part.id} max-${axis}`).toBeLessThanOrEqual(maximum[axis] + tolerance);
              expect(world).toBeGreaterThanOrEqual(bounds.min[axis] - tolerance);
              expect(world).toBeLessThanOrEqual(bounds.max[axis] + tolerance);
            }
          }
          let area = 0;
          const a = new Vector3(), b = new Vector3(), c = new Vector3();
          for (let face = 0; face < count; face++) {
            a.fromBufferAttribute(positions, index ? index.getX(face * 3) : face * 3);
            b.fromBufferAttribute(positions, index ? index.getX(face * 3 + 1) : face * 3 + 1);
            c.fromBufferAttribute(positions, index ? index.getX(face * 3 + 2) : face * 3 + 2);
            area += b.sub(a).cross(c.sub(a)).length() / 2;
          }
          expect(area).toBeGreaterThan(0);
        } finally { geometry.dispose(); }
      }
      expect(triangles).toBeLessThanOrEqual(6000);
    }
  });

  it.each(CRAFT_V7_CATALOG)("$id has no disconnected conservative support bounds", definition => {
    for (const parts of [CRAFT_V7_RECIPES[definition.id](), scaledParts(definition)]) {
      const bounds = parts.map(getFurniturePartBounds);
      const reached = new Set(bounds.flatMap((bound, i) => bound.min[1] <= tolerance ? [i] : []));
      expect(reached.size).toBeGreaterThan(0);
      let previous = -1;
      while (previous !== reached.size) {
        previous = reached.size;
        bounds.forEach((bound, i) => { if ([...reached].some(j => overlaps(bound, bounds[j]))) reached.add(i); });
      }
      expect(parts.filter((_, i) => !reached.has(i)).map(part => part.id), definition.id).toEqual([]);
    }
  });

  it("places load-bearing details on actual solid surfaces rather than in hollow display volumes", () => {
    expectSurfaceBelow("v7-pottery-wheel", "wheel-head", 0, .715, -.08, .01);
    expectSurfaceBelow("v7-pottery-wheel", "clay-foot", 0, .765, -.08, .01);
    expectSurfaceBelow("v7-sewing-station", "tabletop", .28, .565, -.05, .01);
    expectSurfaceBelow("v7-blacksmith-anvil", "stump", -.07, .49, 0, .02);
    expectSurfaceBelow("v7-blacksmith-anvil", "hammer-rest", .32, .545, .32, .01);
    expectSurfaceBelow("v7-sailing-ship", "hull-cradle-1", .26, .24, 0, .015);
    expectSurfaceBelow("v7-gramophone", "lid-rim", .18, .41, -.18, .015);
    expectSurfaceBelow("v7-meteorite-mount", "support-cushion", 0, .48, 0, .015);
    expectSurfaceBelow("v7-skyline-maquette", "map-plinth", -.26, .12, -.13, .015);
    expectSurfaceBelow("v7-armored-bust", "bust-stem", 0, .305, 0, .01);
    expectSurfaceBelow("v7-armillary-globe", "base", 0, .12, 0, .015);
  });

  it("attaches lever grips, roller bearings and meteorite claws through actual solid intersections", () => {
    expectSolidContact("v7-drill-press", "feed-lever", "feed-grip", .255, .04);
    for (const s of [-1, 1]) {
      expectSolidContact("v7-weaving-loom", `cloth-bearing-${s}`, "cloth-roller", s * .34, .095);
      expectSolidContact("v7-weaving-loom", `cloth-bearing-${s}`, `upright-${s}`, s * .36, -.06);
      expectSolidContact("v7-meteorite-mount", `claw-arm-${s}`, "base-cap", s * .135, 0);
    }
    expectSolidContact("v7-meteorite-mount", "rear-claw", "base-cap", 0, -.135);
    expectSolidContact("v7-jeweler-mill", "feed-tray", "metal-strip", 0, .3);
  });

  it("feeds the metal strip into the mill nip rather than through a roller", () => {
    const definition = CRAFT_V7_CATALOG.find(item => item.id === "v7-jeweler-mill")!;
    for (const parts of [CRAFT_V7_RECIPES[definition.id](), scaledParts(definition)]) {
      const bounds = (id: string) => getFurniturePartBounds(parts.find(part => part.id === id)!);
      const strip = bounds("metal-strip");
      expect(strip.min[1]).toBeGreaterThanOrEqual(bounds("roller-0.39").max[1] - tolerance);
      expect(strip.max[1]).toBeLessThanOrEqual(bounds("roller-0.56").min[1] + tolerance);
    }
  });

  it("models recognizable tools and collectibles with dedicated functional assemblies", () => {
    const landmarks: Record<string, string[]> = {
      "v7-drill-press": ["column", "drill-table", "quill", "chuck", "drill-bit", "feed-lever"],
      "v7-wood-lathe": ["headstock", "tailstock", "wood-blank", "tool-rest-bar", "handwheel-bar"],
      "v7-pottery-wheel": ["splash-pan", "wheel-shaft", "wheel-head", "clay-vessel", "pedal"],
      "v7-weaving-loom": ["warp-roller", "cloth-roller", "warp-thread-5", "woven-cloth", "shuttle"],
      "v7-sewing-station": ["machine-column", "overarm", "needle", "presser-foot", "thread-spool", "treadle"],
      "v7-blacksmith-anvil": ["stump", "anvil-waist", "anvil-face", "tapered-horn-2", "hammer-head"],
      "v7-jeweler-mill": ["roller-0.39", "roller-0.56", "pressure-screw", "feed-tray", "crank"],
      "v7-sailing-ship": ["hull", "hull-cradle-1", "main-mast", "fore-mast", "main-sail", "bow-rigging"],
      "v7-gramophone": ["record", "tonearm", "horn-pipe", "horn-bell", "crank-arm"],
      "v7-meteorite-mount": ["meteorite", "support-cushion", "claw-arm-1", "rear-claw"],
      "v7-skyline-maquette": ["tower-a", "tower-b", "skybridge", "transit-station"],
      "v7-armored-bust": ["breastplate", "gorget", "neck", "helmet", "visor", "pauldron-1"],
      "v7-armillary-globe": ["globe", "meridian-ring", "globe-axle", "cradle-post-1", "equator-band"],
    };
    expect(Object.keys(landmarks).sort()).toEqual([...ids].sort());
    for (const [id, names] of Object.entries(landmarks)) expect(CRAFT_V7_RECIPES[id]().map(part => part.id)).toEqual(expect.arrayContaining(names));
  });
});
