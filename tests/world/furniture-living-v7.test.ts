import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG, getFurnitureRecipe, type FurniturePart } from "../../src/furniture/catalog";
import { LIVING_V7_CATALOG, LIVING_V7_RECIPES } from "../../src/furniture/collection-living-v7";

const categories = { bed: 6, seating: 9, desk: 6, chair: 5 } as const;
const shapes = new Set(["box", "cylinder", "sphere", "cone", "frustum", "cup", "ring", "arch", "crystal"]);
const materials = new Set(["finish", "wood", "metal", "fabric", "cushion", "glass", "screen", "glow", "leaf", "gold", "dark", "paper"]);

function actualBounds(part: FurniturePart) {
  const geometry = createFurniturePartGeometry(part);
  try {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!.clone().translate(new Vector3(...part.position));
    return box;
  } finally {
    geometry.dispose();
  }
}

function structuralSignature(parts: readonly FurniturePart[]) {
  const bounds = parts.reduce((box, part) => box.union(actualBounds(part)), new Box3());
  const extent = bounds.getSize(new Vector3()).toArray();
  const center = bounds.getCenter(new Vector3()).toArray();
  return JSON.stringify(parts.map(part => ({
    shape: part.shape,
    roundness: part.roundness ? Number(part.roundness.toFixed(3)) : undefined,
    position: part.position.map((value, axis) => Number(((value - center[axis]) / extent[axis]).toFixed(4))),
    size: part.size.map((value, axis) => Number((value / extent[axis]).toFixed(4))),
    rotation: part.rotation?.map(value => Number(value.toFixed(4))),
    lean: part.lean?.map((value, axis) => Number((value / extent[axis * 2]).toFixed(4))),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

describe("living V7 collection", () => {
  it("keeps the collection independent of runtime catalog imports", () => {
    const source = readFileSync(new URL("../../src/furniture/collection-living-v7.ts", import.meta.url), "utf8");
    const imports = source.split("\n").filter(line => /^import\s/.test(line));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatch(/^import type \{.*\} from "\.\/catalog";$/);
    expect(source).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  it.each(LIVING_V7_CATALOG)("$id stays finite, connected and under mesh budgets at caller scale", definition => {
    const parts = LIVING_V7_RECIPES[definition.id]();
    const scale = [definition.width, definition.height, definition.depth];
    let triangles = 0;
    for (const part of parts) {
      const scaled: FurniturePart = {
        ...part,
        position: part.position.map((value, axis) => value * scale[axis]) as [number, number, number],
        size: part.size.map((value, axis) => value * scale[axis]) as [number, number, number],
        lean: part.lean ? [part.lean[0] * scale[0], part.lean[1] * scale[2]] : undefined,
      };
      const geometry = createFurniturePartGeometry(scaled);
      try {
        const vertices = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        expect(Array.from(vertices.array).every(Number.isFinite), `${definition.id}/${part.id} vertices`).toBe(true);
        expect(Array.from(normals.array).every(Number.isFinite), `${definition.id}/${part.id} normals`).toBe(true);
        triangles += (geometry.index?.count ?? vertices.count) / 3;
        geometry.computeBoundingBox();
        const worldBounds = geometry.boundingBox!.clone().translate(new Vector3(...scaled.position));
        const minimum = [-scale[0] / 2, 0, -scale[2] / 2];
        const maximum = [scale[0] / 2, scale[1], scale[2] / 2];
        for (let axis = 0; axis < 3; axis++) {
          expect(worldBounds.min.getComponent(axis), `${definition.id}/${part.id} min ${axis}`).toBeGreaterThanOrEqual(minimum[axis] - 1e-5);
          expect(worldBounds.max.getComponent(axis), `${definition.id}/${part.id} max ${axis}`).toBeLessThanOrEqual(maximum[axis] + 1e-5);
        }
      } finally {
        geometry.dispose();
      }
    }
    expect(triangles).toBeLessThan(6000);
    const bounds = parts.map(actualBounds);
    const root = bounds.findIndex(box => box.min.y <= 1e-5);
    expect(root, `${definition.id} touches ground`).toBeGreaterThanOrEqual(0);
    const grounded = new Set([root]);
    for (let pass = 0; pass < parts.length; pass++) {
      for (let index = 0; index < parts.length; index++) {
        if (grounded.has(index)) continue;
        if ([...grounded].some(other => bounds[index].clone().expandByScalar(1e-5).intersectsBox(bounds[other]))) grounded.add(index);
      }
    }
    expect(parts.filter((_, index) => !grounded.has(index)).map(part => part.id), `${definition.id} disconnected bounds`).toEqual([]);
    if (definition.category !== "desk") {
      expect(parts.some(part => ["cushion", "fabric"].includes(part.material) && (part.roundness || part.shape === "sphere")), `${definition.id} upholstery`).toBe(true);
    }
    const repeat = LIVING_V7_RECIPES[definition.id]();
    expect(repeat).toEqual(parts);
    expect(repeat).not.toBe(parts);
  });
  it("connects inclined load-bearing parts using actual mesh cross sections", () => {
    const contacts: readonly [string, string, string, readonly [number, number, number], readonly [number, number, number]][] = [
      ["v7-easel-desk", "cross-brace", "front-trestle-1", [.3, .28, -1], [0, 0, 1]],
      ["v7-easel-desk", "pencil-ledge", "tilted-board", [0, -1, .32], [0, 1, 0]],
      ["v7-easel-desk", "drawing-paper", "tilted-board", [-.04, -1, -.03], [0, 1, 0]],
      ["v7-kneeling-chair", "knee-post", "front-floor-crossbar", [0, -1, .28], [0, 1, 0]],
      ["v7-kneeling-chair", "sloping-spine", "front-floor-crossbar", [0, -1, .2], [0, 1, 0]],
      ["v7-rocker-lounge", "runner-tip-1-1", "front-post-1", [.37, -1, .24], [0, 1, 0]],
      ["v7-rocker-lounge", "runner-tip-1--1", "rear-post-1", [.37, -1, -.27], [0, 1, 0]],
      ["v7-secretary-desk", "foot-1-1", "lower-case", [.38, -1, .12], [0, 1, 0]],
      ["v7-study-loft-bed", "upper-deck", "mattress", [0, -1, 0], [0, 1, 0]],
      ["v7-trundle-bed", "main-plinth", "mattress", [-.14, -1, 0], [0, 1, 0]],
      ["v7-library-bed", "base", "mattress", [0, -1, 0], [0, 1, 0]],
      ["v7-conversation-seat", "shared-plinth", "seat-forward", [-.24, -1, .19], [0, 1, 0]],
      ["v7-cinema-recliner", "recliner-base", "seat", [0, -1, -.02], [0, 1, 0]],
      ["v7-island-settee", "octagonal-base", "seat-x-1", [.3, -1, 0], [0, 1, 0]],
      ["v7-papasan-seat", "base-cross-x", "base-ring", [.32, -1, 0], [0, 1, 0]],
      ["v7-papasan-seat", "base-cross-x", "pedestal", [0, -1, 0], [0, 1, 0]],
      ["v7-nest-bed", "rim", "head-support-1", [.29, -1, -.29], [0, 1, 0]],
      ["v7-nest-bed", "head-support-1", "head-petal-1", [.29, -1, -.29], [0, 1, 0]],
    ];
    const material = new MeshBasicMaterial({ side: DoubleSide });
    try {
      for (const [id, first, second, origin, direction] of contacts) {
        const parts = LIVING_V7_RECIPES[id]();
        const ray = new Raycaster(new Vector3(...origin), new Vector3(...direction));
        const ranges = [first, second].map(name => {
          const part = parts.find(entry => entry.id === name)!;
          expect(part, `${id}/${name}`).toBeDefined();
          const geometry = createFurniturePartGeometry(part);
          try {
            const mesh = new Mesh(geometry, material);
            mesh.position.set(...part.position);
            mesh.updateMatrixWorld(true);
            const distances = ray.intersectObject(mesh).map(hit => hit.distance);
            expect(distances.length, `${id}/${name} ray hits`).toBeGreaterThanOrEqual(2);
            return [Math.min(...distances), Math.max(...distances)];
          } finally {
            geometry.dispose();
          }
        });
        expect(Math.max(ranges[0][0], ranges[1][0]) - Math.min(ranges[0][1], ranges[1][1]), `${id}/${first}/${second} contact`).toBeLessThanOrEqual(1e-5);
      }
    } finally {
      material.dispose();
    }
  });

  it("retains category-defining structural landmarks for every model", () => {
    const landmarks: Record<string, string[]> = {
      "v7-sleigh-bed": ["rolled-end-1", "curved-end--1", "mattress"],
      "v7-capsule-bed": ["roof", "pod-wall-1", "arched-head"],
      "v7-study-loft-bed": ["study-top", "step-0.4", "upper-deck"],
      "v7-trundle-bed": ["pullout-mattress", "runner-1", "wheel--1"],
      "v7-nest-bed": ["round-mattress", "rim", "head-petal-1"],
      "v7-library-bed": ["head-divider-0.16", "head-shelf-0.76", "side-table-1"],
      "v7-papasan-seat": ["bowl-rim", "bowl-rib-1", "base-ring"],
      "v7-beanbag-seat": ["bean-seat", "bean-back", "side-lobe-1"],
      "v7-rocker-lounge": ["runner-tip-1-1", "runner-center-1", "neck-pillow"],
      "v7-conversation-seat": ["seat-forward", "seat-backward", "middle-spine"],
      "v7-courtyard-sofa": ["wing-pad-1", "wing-pad--1", "rear-back"],
      "v7-woven-daybed": ["woven-slat-0", "long-seat", "bolster-1"],
      "v7-cinema-recliner": ["foot-link", "footrest", "cup-holder-1"],
      "v7-storage-bench": ["drawer-0", "bench-cushion", "handle-bar-1"],
      "v7-island-settee": ["seat-x-1", "seat-z--1", "octagonal-base"],
      "v7-secretary-desk": ["writing-flap", "flap-brace-1", "mail-divider-0"],
      "v7-corner-desk": ["long-top", "return-top", "pier-2"],
      "v7-ladder-desk": ["ladder-front-1", "middle-shelf", "desktop"],
      "v7-easel-desk": ["tilted-board", "pencil-ledge", "palette"],
      "v7-library-desk": ["bookcase-side-1", "book-shelf-0.37", "open-page-1"],
      "v7-music-desk": ["keybed", "ivory-key-9", "speaker-1"],
      "v7-cantilever-chair": ["floor-skid-1", "front-rise-1", "back-rise-1"],
      "v7-folding-chair": ["forward-leg-1", "backward-leg-1", "hinge-1"],
      "v7-kneeling-chair": ["knee-left", "sloping-spine", "front-floor-crossbar"],
      "v7-tripod-shell-chair": ["rear-leg", "shell-wing-1", "shell-back"],
      "v7-wingback-chair": ["shoulder-wing-1", "tall-back", "arm-pad-1"],
    };
    expect(Object.keys(landmarks).sort()).toEqual(Object.keys(LIVING_V7_RECIPES).sort());
    for (const [id, names] of Object.entries(landmarks)) {
      expect(LIVING_V7_RECIPES[id]().map(part => part.id)).toEqual(expect.arrayContaining(names));
    }
  });

  it("exports exactly 26 distinct recipes with the requested category split", () => {
    expect(LIVING_V7_CATALOG).toHaveLength(26);
    expect(Object.keys(LIVING_V7_RECIPES)).toHaveLength(26);
    expect(new Set(LIVING_V7_CATALOG.map(item => item.id)).size).toBe(26);
    expect(LIVING_V7_CATALOG.map(item => item.category).reduce((counts, category) => {
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>)).toEqual(categories);
    expect(LIVING_V7_CATALOG.every(item => /^v7-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id))).toBe(true);
  });

  it("has Vietnamese metadata, valid economy, category interactions and real geometry", () => {
    for (const definition of LIVING_V7_CATALOG) {
      expect(definition.name).toMatch(/[À-ỹ]/);
      expect(definition.description.length).toBeGreaterThan(20);
      expect(definition.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect([definition.width, definition.depth, definition.height, definition.price, definition.level].every(Number.isFinite)).toBe(true);
      expect(definition.width).toBeGreaterThan(0);
      expect(definition.depth).toBeGreaterThan(0);
      expect(definition.height).toBeGreaterThan(0);
      expect(Number.isInteger(definition.price)).toBe(true);
      expect(Number.isInteger(definition.level)).toBe(true);
      expect(definition.price).toBeGreaterThan(0);
      expect(definition.level).toBeGreaterThanOrEqual(1);
      expect(definition.interactions.length).toBeGreaterThan(0);
      expect(definition.interactions[0].screen).toBe(definition.category === "desk" ? "focus" : "recovery");
      expect(definition.interactions[0].activity).toBe(definition.category === "bed" ? "sleeping" : definition.category === "desk" ? "working" : "sitting");
      expect(definition.interactions[0].label).toMatch(/[À-ỹ]/);
      expect(definition.interactions[0].id).toBe(definition.category === "bed" ? "sleep" : definition.category === "desk" ? "work" : "sit");
      const parts = LIVING_V7_RECIPES[definition.id]!();
      expect(parts.length).toBeGreaterThanOrEqual(6);
      expect(parts.length).toBeLessThan(48);
      expect(new Set(parts.map(part => part.id)).size).toBe(parts.length);
      for (const part of parts) {
        expect(shapes.has(part.shape)).toBe(true);
        expect(materials.has(part.material)).toBe(true);
        expect(part.position.every(Number.isFinite)).toBe(true);
        expect(part.position[0]).toBeGreaterThanOrEqual(-.5);
        expect(part.position[0]).toBeLessThanOrEqual(.5);
        expect(part.position[1]).toBeGreaterThanOrEqual(0);
        expect(part.position[1]).toBeLessThanOrEqual(1);
        expect(part.position[2]).toBeGreaterThanOrEqual(-.5);
        expect(part.position[2]).toBeLessThanOrEqual(.5);
        expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
        if (part.rotation) expect(part.rotation.every(Number.isFinite)).toBe(true);
        if (part.lean) expect(part.lean.every(Number.isFinite)).toBe(true);
        const bounds = actualBounds(part);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-.5 - 1e-5);
        expect(bounds.max.x).toBeLessThanOrEqual(.5 + 1e-5);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-5);
        expect(bounds.max.y).toBeLessThanOrEqual(1 + 1e-5);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-.5 - 1e-5);
        expect(bounds.max.z).toBeLessThanOrEqual(.5 + 1e-5);
      }
    }
  });

  it("does not mistake renamed, recolored, reordered or rescaled parts for a new structure", () => {
    const original = LIVING_V7_RECIPES["v7-sleigh-bed"]();
    const scale = [2, 3, 4];
    const replica = original.map<FurniturePart>((part, index) => ({
      ...part,
      id: `replica-${index}`,
      material: "gold",
      position: part.position.map((value, axis) => value * scale[axis]) as [number, number, number],
      size: part.size.map((value, axis) => value * scale[axis]) as [number, number, number],
      lean: part.lean ? [part.lean[0] * scale[0], part.lean[1] * scale[2]] : undefined,
    })).reverse();
    expect(structuralSignature(replica)).toBe(structuralSignature(original));
  });

  it("uses distinct normalized structures against all existing furniture", () => {
    const newSignatures = LIVING_V7_CATALOG.map(item => structuralSignature(LIVING_V7_RECIPES[item.id]!()));
    expect(new Set(newSignatures).size).toBe(26);
    const existingSignatures = FURNITURE_CATALOG.filter(item => !LIVING_V7_RECIPES[item.id]).map(item => {
      const recipe = getFurnitureRecipe(item.id)!;
      return structuralSignature(recipe.parts.map(part => ({
        ...part,
        position: part.position.map((value, axis) => value / [item.width, item.height, item.depth][axis]) as [number, number, number],
        size: part.size.map((value, axis) => value / [item.width, item.height, item.depth][axis]) as [number, number, number],
        lean: part.lean ? [part.lean[0] / item.width, part.lean[1] / item.depth] : undefined,
      })));
    });
    expect(new Set([...existingSignatures, ...newSignatures]).size).toBe(existingSignatures.length + newSignatures.length);
  });
});
