import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry, getFurnitureMaterialProperties } from "../../src/components/world/furniture-models";
import { FURNITURE } from "../../src/domain/catalog";
import {
  FURNITURE_CATALOG, FURNITURE_CATEGORIES, FURNITURE_MODEL_IDS, FURNITURE_MODEL_PROGRESS,
  LEGACY_FURNITURE_IDS, furnitureGeometrySignature, getFurnitureDefinition,
  getFurniturePartBounds, getFurnitureRecipe, isFurnitureModelId, type FurnitureModelId, type FurniturePart,
} from "../../src/furniture/catalog";

const originalIds = [
  "cloud-bed", "platform-bed", "bunk-bed", "canopy-bed", "haven-sofa", "corner-sofa", "chaise-lounge",
  "workstation", "writing-desk", "standing-desk", "architect-desk", "dining-chair", "office-chair", "bar-stool",
  "bookcase", "wardrobe", "drawer-chest", "flat-tv", "arcade-cabinet", "stereo-tower",
  "neon-floor-lamp", "tripod-lamp", "table-lamp", "kitchen-island", "refrigerator", "range-cooker",
  "biolume-plant", "wall-mirror", "aquarium", "tool-bench", "3d-printer", "tool-trolley",
  "holo-art", "trophy-cup", "model-rocket", "crystal-display",
] as const satisfies readonly FurnitureModelId[];
const originalCatalog = originalIds.map(id => getFurnitureDefinition(id)!);
const categoryTargets = { bed: 10, seating: 12, desk: 10, chair: 8, storage: 10, electronics: 12, light: 16, kitchen: 10, decor: 19, workshop: 10, collectible: 10, doors: 1, windows: 1 };
const epsilon = 1e-8;
const contactTolerance = 1e-5;
const repairedIds = ["corner-sofa", "wall-mirror", "trophy-cup", "dining-chair", "office-chair", "arcade-cabinet", "tripod-lamp", "range-cooker", "holo-art"] as const satisfies readonly FurnitureModelId[];

function withModel(id: FurnitureModelId, check: (model: {
  parts: readonly FurniturePart[];
  meshes: Mesh[];
  part: (name: string) => FurniturePart;
  mesh: (name: string) => Mesh;
  cast: (origin: Vector3, direction: Vector3, targets?: Mesh[]) => ReturnType<Raycaster["intersectObjects"]>;
}) => void) {
  const parts = getFurnitureRecipe(id)!.parts;
  const material = new MeshBasicMaterial();
  const meshes: Mesh[] = [];
  try {
    for (const part of parts) {
      const mesh = new Mesh(createFurniturePartGeometry(part), material);
      mesh.name = part.id;
      mesh.position.set(...part.position);
      mesh.updateMatrixWorld(true);
      meshes.push(mesh);
    }
    const part = (name: string) => {
      const found = parts.find(entry => entry.id === name);
      expect(found, `${id}/${name}`).toBeDefined();
      return found!;
    };
    const mesh = (name: string) => {
      const found = meshes.find(entry => entry.name === name);
      expect(found, `${id}/${name}`).toBeDefined();
      return found!;
    };
    const cast = (origin: Vector3, direction: Vector3, targets = meshes) => new Raycaster(origin, direction.clone().normalize()).intersectObjects(targets, false);
    check({ parts, meshes, part, mesh, cast });
  } finally {
    for (const mesh of meshes) mesh.geometry.dispose();
    material.dispose();
  }
}

function expectContact(first: FurniturePart, second: FurniturePart) {
  const a = getFurniturePartBounds(first), b = getFurniturePartBounds(second);
  for (let axis = 0; axis < 3; axis++) {
    expect(Math.max(a.min[axis], b.min[axis]) - Math.min(a.max[axis], b.max[axis]), `${first.id}/${second.id}/axis-${axis}`).toBeLessThanOrEqual(contactTolerance);
  }
}

function worldVertices(mesh: Mesh): Vector3[] {
  const positions = mesh.geometry.getAttribute("position");
  return Array.from({ length: positions.count }, (_, index) => new Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
}

describe("procedural furniture catalog", () => {
  it("ships the complete catalog without losing any original model", () => {
    expect(FURNITURE_CATALOG).toHaveLength(129);
    expect(originalCatalog).toHaveLength(36);
    expect(originalCatalog.every(Boolean)).toBe(true);
    expect(FURNITURE_MODEL_PROGRESS).toEqual({ implemented: 129, target: 129 });
    expect(FURNITURE_MODEL_PROGRESS.implemented).toBe(FURNITURE_MODEL_PROGRESS.target);
    expect(FURNITURE_MODEL_IDS).toEqual(FURNITURE_CATALOG.map(item => item.id));
    expect(new Set(FURNITURE_MODEL_IDS).size).toBe(FURNITURE_CATALOG.length);
  });

  it("uses Vietnamese display names while retaining stable searchable model IDs", () => {
    expect(originalCatalog.map(item => item.name)).toEqual([
      "Giường đôi bọc nệm cao cấp", "Giường sàn gỗ", "Giường tầng gác cao", "Giường màn bốn cột",
      "Sofa An Yên", "Sofa góc chữ L sang trọng", "Ghế dài đọc sách", "Bàn làm việc Cyberpunk LED",
      "Bàn viết gỗ sồi", "Bàn nâng hạ", "Bàn vẽ kiến trúc", "Ghế ăn lưng nan", "Ghế văn phòng lưới", "Ghế quầy chân trụ",
      "Kệ sách mở", "Tủ quần áo hai cánh", "Tủ năm ngăn kéo", "Kệ tivi phòng chiếu", "Máy trò chơi thùng", "Dàn âm thanh",
      "Đèn đứng vành sáng", "Đèn chụp ba chân", "Đèn bàn hình nấm", "Đảo bếp đá marble", "Tủ lạnh hai ngăn", "Bếp lò bốn vùng nấu",
      "Chậu cây phát sáng", "Gương đứng khung vòm", "Bể cá san hô", "Bàn xưởng chế tác", "Máy in 3D khung mở", "Xe đẩy dụng cụ",
      "Tượng ánh sáng đô thị", "Cúp vô địch", "Mô hình tên lửa", "Tủ trưng bày pha lê",
    ]);
    expect(originalCatalog.map(({ id, width, depth, height, price, level }) => [id, width, depth, height, price, level])).toEqual([
      ["cloud-bed", 2.7, 3.2, 1.65, 220, 1], ["platform-bed", 2.4, 3, .75, 160, 1], ["bunk-bed", 1.8, 3, 2.7, 390, 3], ["canopy-bed", 2.8, 3.3, 2.8, 620, 5],
      ["haven-sofa", 2.9, 1.16, 1.25, 120, 1], ["corner-sofa", 3, 2.4, 1.25, 280, 2], ["chaise-lounge", 1.1, 2.3, 1.1, 175, 2],
      ["workstation", 2.3, 1, 1.7, 180, 1], ["writing-desk", 1.8, .9, 1.05, 110, 1], ["standing-desk", 2, 1, 1.7, 260, 3], ["architect-desk", 2.2, 1.3, 1.4, 310, 3],
      ["dining-chair", .65, .7, 1.2, 45, 1], ["office-chair", .85, .85, 1.4, 130, 2], ["bar-stool", .65, .65, 1.1, 75, 1],
      ["bookcase", 1.6, .55, 2.2, 155, 2], ["wardrobe", 1.65, .6, 2.3, 230, 2], ["drawer-chest", 1.2, .65, 1.3, 145, 2],
      ["flat-tv", 2.1, .65, 1.55, 290, 3], ["arcade-cabinet", 1.2, 1.1, 2.1, 340, 3], ["stereo-tower", 1.6, .6, 1.35, 190, 2],
      ["neon-floor-lamp", .5, .5, 2.25, 65, 1], ["tripod-lamp", .8, .8, 1.9, 95, 2], ["table-lamp", .45, .45, .65, 35, 1],
      ["kitchen-island", 2, 1.1, 1.1, 210, 2], ["refrigerator", .9, .9, 2.1, 250, 2], ["range-cooker", 1.1, .9, 1.15, 240, 2],
      ["biolume-plant", .6, .6, 1.3, 45, 1], ["wall-mirror", .9, .4, 1.9, 85, 1], ["aquarium", 1.4, .65, 1.3, 180, 2],
      ["tool-bench", 2.3, 1, 1.8, 200, 2], ["3d-printer", 1, 1, 1.4, 320, 3], ["tool-trolley", 1.2, .7, 1.05, 140, 2],
      ["holo-art", .6, .6, 1.6, 95, 1], ["trophy-cup", .75, .5, 1.2, 170, 2], ["model-rocket", .7, .7, 1.65, 185, 3], ["crystal-display", 1, .7, 1.5, 230, 3],
    ]);
  });

  it("provides all requested categories with multiple genuinely modeled options", () => {
    expect([...new Set(FURNITURE_CATALOG.map(item => item.category))].sort()).toEqual([...FURNITURE_CATEGORIES].sort());
    for (const category of FURNITURE_CATEGORIES) {
      expect(FURNITURE_CATALOG.filter(item => item.category === category)).toHaveLength(categoryTargets[category]);
    }
  });

  it("preserves all existing save IDs, prices, colors and footprints", () => {
    expect(LEGACY_FURNITURE_IDS).toHaveLength(6);
    for (const id of LEGACY_FURNITURE_IDS) {
      const legacy = FURNITURE.find(item => item.id === id)!;
      expect(legacy).toBeDefined();
      expect(getFurnitureDefinition(id)).toMatchObject({ id, width: legacy.width, depth: legacy.depth, price: legacy.price, color: legacy.color });
    }
  });

  it.each(FURNITURE_MODEL_IDS)("%s has valid economy, dimensions and functional interaction metadata", id => {
    const item = getFurnitureDefinition(id)!;
    expect(isFurnitureModelId(id)).toBe(true);
    expect(id).toMatch(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
    expect(item.name.length).toBeGreaterThan(3);
    expect(item.description.length).toBeGreaterThan(12);
    expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const value of [item.width, item.height, item.depth, item.price, item.level]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(Number.isInteger(item.price)).toBe(true);
    expect(Number.isInteger(item.level)).toBe(true);
    expect(item.interactions.length).toBeGreaterThan(0);
    expect(new Set(item.interactions.map(action => action.id)).size).toBe(item.interactions.length);
    for (const action of item.interactions) {
      expect(["sleep", "sit", "work", "store", "power", "light", "cook", "inspect", "craft", "display"]).toContain(action.id);
      expect(["recovery", "focus", "inventory", "farming", "crafting", "achievements", "equipment"]).toContain(action.screen);
      expect(action.label.length).toBeGreaterThan(0);
      if (action.activity) expect(["sleeping", "sitting", "working"]).toContain(action.activity);
    }
  });

  it("rejects unknown IDs without silently generating a duplicate placeholder", () => {
    for (const id of ["", "not-furniture", "__proto__", "toString", "constructor", "CLOUD-BED"]) {
      expect(isFurnitureModelId(id)).toBe(false);
      expect(getFurnitureDefinition(id)).toBeUndefined();
      expect(getFurnitureRecipe(id)).toBeUndefined();
      expect(furnitureGeometrySignature(id)).toBeUndefined();
    }
  });

  it("exposes host-controllable light/electronic toggles and activity hooks", () => {
    for (const item of FURNITURE_CATALOG.filter(item => ["light", "electronics"].includes(item.category))) {
      expect(item.interactions[0].toggle).toBe(true);
    }
    expect(getFurnitureDefinition("cloud-bed")!.interactions[0].activity).toBe("sleeping");
    expect(getFurnitureDefinition("haven-sofa")!.interactions[0].activity).toBe("sitting");
    expect(getFurnitureDefinition("tool-bench")!.interactions[0]).toMatchObject({ screen: "crafting", activity: "working" });
    expect(getFurnitureDefinition("wardrobe")!.interactions[0].screen).toBe("equipment");
  });
});

describe("pure furniture geometry recipes", () => {
  it.each(FURNITURE_MODEL_IDS)("%s has finite, positive, uniquely identified parts inside the exact footprint", id => {
    const definition = getFurnitureDefinition(id)!;
    const recipe = getFurnitureRecipe(id)!;
    expect(recipe.id).toBe(id);
    expect(recipe.parts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(recipe.parts.map(part => part.id)).size).toBe(recipe.parts.length);
    const minimum = [-definition.width / 2, 0, -definition.depth / 2];
    const maximum = [definition.width / 2, definition.height, definition.depth / 2];
    for (const part of recipe.parts) {
      expect(["box", "cylinder", "sphere", "cone", "frustum", "cup", "ring", "arch", "crystal"]).toContain(part.shape);
      expect(["finish", "wood", "metal", "fabric", "cushion", "glass", "screen", "glow", "leaf", "gold", "dark", "paper"]).toContain(part.material);
      expect(part.position.every(Number.isFinite)).toBe(true);
      expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
      if (part.rotation) expect(part.rotation.every(Number.isFinite)).toBe(true);
      if (part.lean) expect(part.lean.every(Number.isFinite)).toBe(true);
      if (part.radialSegments !== undefined) {
        expect(Number.isInteger(part.radialSegments)).toBe(true);
        expect(part.radialSegments).toBeGreaterThanOrEqual(3);
        expect(part.radialSegments).toBeLessThanOrEqual(32);
      }
      if (part.surface) expect(["mirror", "smoked-glass", "display"]).toContain(part.surface);
      const bounds = getFurniturePartBounds(part);
      for (let axis = 0; axis < 3; axis++) {
        expect(bounds.min[axis], `${id}/${part.id} min axis ${axis}`).toBeGreaterThanOrEqual(minimum[axis] - epsilon);
        expect(bounds.max[axis], `${id}/${part.id} max axis ${axis}`).toBeLessThanOrEqual(maximum[axis] + epsilon);
      }
    }
    expect(Math.min(...recipe.parts.map(part => getFurniturePartBounds(part).min[1]))).toBeLessThanOrEqual(.1);
  });

  it("has different structures even after removing names, materials, colors and overall dimensions", () => {
    const signatures = FURNITURE_MODEL_IDS.map(id => furnitureGeometrySignature(id));
    expect(signatures.every(Boolean)).toBe(true);
    expect(new Set(signatures).size).toBe(FURNITURE_MODEL_IDS.length);
  });

  it("has recognizable category-specific assemblies rather than recolored single boxes", () => {
    const landmarks = {
      "cloud-bed": ["headboard", "pillow-0.4--1", "pillow-0.4-1"],
      "bunk-bed": ["ladder-rail--0.3", "rung-0.45", "mattress-0.2", "mattress-0.72"],
      "canopy-bed": ["canopy", "curtain--1", "curtain-1"],
      "corner-sofa": ["return-seat", "return-back", "chaise-pad"],
      "workstation": ["monitor", "keyboard", "mouse"],
      "office-chair": ["headrest", "lift", "caster-1", "arm-pad-1"],
      "bookcase": ["shelf-0.33", "book-0", "stack-0.77"],
      "arcade-cabinet": ["marquee", "control-deck", "joystick", "coin-slot"],
      "tripod-lamp": ["front-leg--0.32", "front-leg-0.32", "rear-leg", "shade"],
      "kitchen-island": ["sink", "tap-spout", "chopping-board"],
      "aquarium": ["glass-face-1", "sand", "fish", "fish-tail"],
      "3d-printer": ["gantry", "extruder", "nozzle", "print-bed"],
      "model-rocket": ["nose", "fuselage", "engine", "fin-x", "fin-z"],
      "trophy-cup": ["bowl", "rim", "handle-side--1", "handle-side-1"],
    };
    for (const [id, expectedParts] of Object.entries(landmarks)) {
      expect(getFurnitureRecipe(id)!.parts.map(part => part.id)).toEqual(expect.arrayContaining(expectedParts));
    }
  });

  it("models sewn upholstery, structural supports and usable desk details in the eleven hero recipes", () => {
    const details = {
      "cloud-bed": ["pillow-seam-0.4-1-side-1", "head-seam-0", "recessed-plinth", "duvet-fold-0.4"],
      "platform-bed": ["head-support-1", "drawer-recess", "bedside-ledge"],
      "bunk-bed": ["guard-post-1", "end-brace", "pillow-seam-0.72-1-end-1"],
      "canopy-bed": ["canopy-rail-1", "front-canopy-rail", "curtain-tie-1"],
      "haven-sofa": ["back-cushion-0", "seat-welt-0", "under-seat-rail", "throw-pillow"],
      "corner-sofa": ["back-pad-0", "chaise-welt-side-1", "return-foot", "corner-bolster"],
      "chaise-lounge": ["seat-seam-side-1", "bolster-button-1", "side-stretcher", "head-pad"],
      "workstation": ["monitor-foot", "cable-tray", "cable-spine", "grommet", "key-row-0"],
      "writing-desk": ["organizer-shelf", "book-spine", "cup-opening", "pen-1", "lower-stretcher"],
      "standing-desk": ["lift-inner-1", "top-support-1", "height-control", "cable-sleeve", "laptop-hinge"],
      "architect-desk": ["height-pin-1", "lower-brace", "ruler-head", "pencil-ledge", "tube-opening"],
    };
    expect(Object.keys(details)).toHaveLength(11);
    for (const [id, expectedParts] of Object.entries(details)) {
      const recipe = getFurnitureRecipe(id)!;
      expect(recipe.parts.map(part => part.id)).toEqual(expect.arrayContaining(expectedParts));
      expect(recipe.parts.some(part => part.roundness && part.roundness > 0), id).toBe(true);
    }
  });

  it.each(FURNITURE_MODEL_IDS)("%s renders finite nondegenerate geometry inside its declared part bounds", id => {
    for (const part of getFurnitureRecipe(id)!.parts) {
      if (part.roundness !== undefined) {
        expect(part.shape).toBe("box");
        expect(part.roundness).toBeGreaterThan(0);
        expect(part.roundness).toBeLessThan(.5);
      }
      const geometry = createFurniturePartGeometry(part);
      try {
        const vertices = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        expect(vertices.count).toBeGreaterThan(2);
        expect(Array.from(vertices.array).every(Number.isFinite)).toBe(true);
        expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox!;
        const declared = getFurniturePartBounds(part);
        for (let axis = 0; axis < 3; axis++) {
          expect(bounds.min.getComponent(axis) + part.position[axis], `${id}/${part.id}/min-${axis}`).toBeGreaterThanOrEqual(declared.min[axis] - 1e-6);
          expect(bounds.max.getComponent(axis) + part.position[axis], `${id}/${part.id}/max-${axis}`).toBeLessThanOrEqual(declared.max[axis] + 1e-6);
          expect(bounds.max.getComponent(axis) - bounds.min.getComponent(axis)).toBeGreaterThan(0);
        }
        const index = geometry.getIndex();
        const count = index?.count ?? vertices.count;
        let area = 0;
        for (let i = 0; i < count; i += 3) {
          const a = new Vector3().fromBufferAttribute(vertices, index ? index.getX(i) : i);
          const b = new Vector3().fromBufferAttribute(vertices, index ? index.getX(i + 1) : i + 1);
          const c = new Vector3().fromBufferAttribute(vertices, index ? index.getX(i + 2) : i + 2);
          area += b.sub(a).cross(c.sub(a)).length() / 2;
        }
        expect(area, `${id}/${part.id}`).toBeGreaterThan(1e-8);
      } finally {
        geometry.dispose();
      }
    }
  });

  it("uses rounded mesh topology for upholstery rather than a texture or a box alias", () => {
    const pillow = getFurnitureRecipe("cloud-bed")!.parts.find(part => part.id === "pillow-0.4-1")!;
    const rounded = createFurniturePartGeometry(pillow);
    const sharp = createFurniturePartGeometry({ ...pillow, roundness: undefined });
    try {
      expect(rounded.getAttribute("position").count).toBeGreaterThan(sharp.getAttribute("position").count);
      const normals = rounded.getAttribute("normal");
      expect(Array.from({ length: normals.count }, (_, i) => [normals.getX(i), normals.getY(i), normals.getZ(i)])
        .some(normal => normal.filter(value => Math.abs(value) > .01 && Math.abs(value) < .99).length >= 2)).toBe(true);
    } finally {
      rounded.dispose();
      sharp.dispose();
    }
  });

  it("bounds every model and retains the original 36-model triangle budget", () => {
    let totalTriangles = 0;
    for (const id of FURNITURE_MODEL_IDS) {
      const recipe = getFurnitureRecipe(id)!;
      expect(recipe.parts.length, id).toBeLessThanOrEqual(48);
      let triangles = 0;
      for (const part of recipe.parts) {
        const geometry = createFurniturePartGeometry(part);
        triangles += (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
        geometry.dispose();
      }
      expect(triangles, id).toBeLessThanOrEqual(6000);
      if (originalIds.some(originalId => originalId === id)) totalTriangles += triangles;
    }
    expect(totalTriangles).toBeLessThanOrEqual(45000);
  });

  it("is deterministic and returns independent recipe objects", () => {
    for (const id of FURNITURE_MODEL_IDS) {
      const first = getFurnitureRecipe(id)!;
      const second = getFurnitureRecipe(id)!;
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.parts).not.toBe(second.parts);
      expect(first.parts[0].position).not.toBe(second.parts[0].position);
      expect(Object.isFrozen(getFurnitureDefinition(id))).toBe(true);
    }
  });

  describe("visual-review geometry regressions", () => {
    it("supports every corner-sofa foot on the L-shaped seats without filling its cutout", () => {
      withModel("corner-sofa", ({ parts, part, mesh, cast }) => {
        const feet = parts.filter(item => item.id.startsWith("leg-") || item.id === "return-foot");
        expect(feet).toHaveLength(5);
        for (const foot of feet) {
          expect(getFurniturePartBounds(foot).min[1]).toBeCloseTo(0, 6);
          const hits = cast(new Vector3(...foot.position), new Vector3(0, 1, 0), [mesh("long-seat"), mesh("return-seat")]);
          expect(hits.length, foot.id).toBeGreaterThan(0);
          expect(hits[0].distance, foot.id).toBeLessThanOrEqual(foot.size[1] / 2 + contactTolerance);
        }
        const definition = getFurnitureDefinition("corner-sofa")!;
        expect(cast(new Vector3(-.35 * definition.width, definition.height + .1, .35 * definition.depth), new Vector3(0, -1, 0))).toHaveLength(0);
        expectContact(part("return-foot"), part("return-seat"));
      });
    });

    it("joins every dining-chair slat to both lower rail and crest", () => {
      withModel("dining-chair", ({ parts, part, mesh, cast }) => {
        const slats = parts.filter(item => item.id.startsWith("back-slat-"));
        expect(slats).toHaveLength(3);
        for (const slat of slats) {
          for (const [railName, direction] of [["lower-back-rail", 1], ["crest", -1]] as const) {
            const rail = part(railName);
            expectContact(slat, rail);
            const hits = cast(new Vector3(slat.position[0], rail.position[1], slat.position[2]), new Vector3(0, direction, 0), [mesh(slat.id)]);
            expect(hits.length, `${slat.id}/${railName}`).toBeGreaterThan(0);
            expect(hits[0].distance).toBeLessThanOrEqual(rail.size[1] / 2 + contactTolerance);
          }
        }
        for (const post of parts.filter(item => item.id.startsWith("back-post-"))) expectContact(post, part("lower-back-rail"));
      });
    });

    it("gives the office chair real mesh openings, five radial caster supports and attached arms", () => {
      withModel("office-chair", ({ parts, part, mesh, cast }) => {
        const definition = getFurnitureDefinition("office-chair")!;
        const warps = parts.filter(item => item.id.startsWith("mesh-warp-"));
        const wefts = parts.filter(item => item.id.startsWith("mesh-weft-"));
        expect(warps.length).toBeGreaterThanOrEqual(3);
        expect(wefts.length).toBeGreaterThanOrEqual(3);
        const front = definition.depth;
        for (let i = 0; i < warps.length - 1; i++) {
          const x = (warps[i].position[0] + warps[i + 1].position[0]) / 2;
          const y = (wefts[2].position[1] + wefts[3].position[1]) / 2;
          expect(cast(new Vector3(x, y, front), new Vector3(0, 0, -1)), `opening-${i}`).toHaveLength(0);
          const hits = cast(new Vector3(warps[i].position[0], y, front), new Vector3(0, 0, -1));
          expect(hits[0]?.object.name).toBe(warps[i].id);
        }
        expect(parts.filter(item => item.id.startsWith("spoke-"))).toHaveLength(5);
        expect(parts.filter(item => item.id.startsWith("caster-"))).toHaveLength(5);
        for (let i = 0; i < 5; i++) {
          const spoke = part(`spoke-${i}`), caster = part(`caster-${i}`);
          expectContact(spoke, part("hub"));
          expectContact(spoke, caster);
          const hits = cast(new Vector3(caster.position[0], 1, caster.position[2]), new Vector3(0, -1, 0), [mesh(spoke.id)]);
          expect(hits.length, spoke.id).toBeGreaterThan(0);
        }
        for (const arm of parts.filter(item => item.id.startsWith("arm-post-"))) {
          expectContact(arm, part("seat"));
          const hits = cast(new Vector3(arm.position[0], 1, arm.position[2]), new Vector3(0, -1, 0), [mesh("seat")]);
          expect(hits.length, arm.id).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeGreaterThanOrEqual(getFurniturePartBounds(arm).min[1] - contactTolerance);
        }
      });
    });

    it.each(["range-cooker", "arcade-cabinet"] as const)("%s exposes its front details before the backing geometry", id => {
      withModel(id, ({ parts, part, cast }) => {
        const definition = getFurnitureDefinition(id)!;
        const names = id === "range-cooker" ? ["oven-window", "knob--0.3", "knob--0.1", "knob-0.1", "knob-0.3"] : ["screen", "marquee", "coin-slot"];
        for (const name of names) {
          const target = part(name);
          for (const offset of [-.2, .2]) {
            const hits = cast(new Vector3(target.position[0] + offset * target.size[0], target.position[1], definition.depth), new Vector3(0, 0, -1));
            expect(hits[0]?.object.name, `${id}/${name}/${offset}`).toBe(name);
          }
        }
        if (id === "range-cooker") {
          const backing = getFurniturePartBounds(part("oven")).max[2];
          expect(getFurniturePartBounds(part("oven-window")).min[2]).toBeGreaterThan(backing + contactTolerance);
          const knobs = parts.filter(item => /^knob--?0\./.test(item.id));
          expect(knobs).toHaveLength(4);
          for (const knob of knobs) expect(getFurniturePartBounds(knob).max[2]).toBeGreaterThan(getFurniturePartBounds(part("control-panel")).max[2] + contactTolerance);
        } else {
          expectContact(part("screen"), part("bezel"));
          expectContact(part("marquee"), part("marquee-housing"));
          for (const name of ["screen", "marquee"]) {
            const target = part(name);
            const point = new Vector3(target.position[0] + target.size[0] * .18, target.position[1], target.position[2]);
            const origin = point.clone().add(new Vector3(definition.width, definition.height * .3, definition.depth * 2));
            expect(cast(origin, point.clone().sub(origin))[0]?.object.name, `three-quarter/${name}`).toBe(name);
          }
        }
      });
    });

    it("uses one continuous opaque reflective arch for the mirror face", () => {
      withModel("wall-mirror", ({ parts, part, mesh, cast }) => {
        const mirror = part("mirror");
        expect(mirror.shape).toBe("arch");
        expectContact(mirror, part("frame"));
        const backing = cast(new Vector3(mirror.position[0], mirror.position[1], 1), new Vector3(0, 0, -1), [mesh("frame")])[0];
        expect(backing).toBeDefined();
        expect(backing.point.z).toBeGreaterThanOrEqual(getFurniturePartBounds(mirror).min[2] - contactTolerance);
        expect(parts.filter(item => item.surface === "mirror")).toHaveLength(1);
        const properties = getFurnitureMaterialProperties(mirror, "#d0ac77");
        expect(properties).toMatchObject({ transparent: false, opacity: 1, depthWrite: true, metalness: 1 });
        expect(properties.roughness).toBeLessThan(.1);
        for (const y of [-.3, .24, .26, .4]) {
          for (const x of [-.2, .2]) {
            const hits = cast(new Vector3(mirror.position[0] + x * mirror.size[0], mirror.position[1] + y * mirror.size[1], 1), new Vector3(0, 0, -1));
            expect(hits[0]?.object.name).toBe("mirror");
            expect(hits[0].point.z).toBeCloseTo(mirror.position[2] + mirror.size[2] / 2, 6);
          }
        }
        expect(cast(new Vector3(mirror.position[0] + .48 * mirror.size[0], mirror.position[1] + .48 * mirror.size[1], 1), new Vector3(0, 0, -1), [mesh("mirror")])).toHaveLength(0);
      });
    });

    it("splays all tripod feet into a joined hub beneath an open truncated shade", () => {
      withModel("tripod-lamp", ({ parts, part, mesh, cast }) => {
        const legs = parts.filter(item => item.id.startsWith("front-leg-") || item.id === "rear-leg");
        expect(legs).toHaveLength(3);
        for (const leg of legs) {
          const vertices = worldVertices(mesh(leg.id));
          const bottomY = Math.min(...vertices.map(vertex => vertex.y)), topY = Math.max(...vertices.map(vertex => vertex.y));
          const center = (y: number) => {
            const face = vertices.filter(vertex => Math.abs(vertex.y - y) < contactTolerance);
            return face.reduce((sum, vertex) => sum.add(vertex), new Vector3()).divideScalar(face.length);
          };
          const bottom = center(bottomY), top = center(topY);
          expect(bottomY).toBeCloseTo(0, 6);
          expect(Math.hypot(bottom.x, bottom.z)).toBeGreaterThan(Math.hypot(top.x, top.z) + .1);
          expectContact(leg, part("hub"));
          const hit = cast(new Vector3(top.x, topY + .1, top.z), new Vector3(0, -1, 0), [mesh("hub")])[0];
          expect(hit).toBeDefined();
          expect(hit.point.y).toBeGreaterThanOrEqual(topY - contactTolerance);
        }
        const shade = part("shade"), vertices = worldVertices(mesh("shade"));
        for (const spoke of parts.filter(item => item.id.startsWith("shade-spoke-"))) {
          const sign = Math.sign(spoke.position[0]);
          const hit = cast(new Vector3(0, spoke.position[1], spoke.position[2]), new Vector3(sign, 0, 0), [mesh("shade")])[0];
          expect(hit, spoke.id).toBeDefined();
          expect(hit.distance, spoke.id).toBeLessThanOrEqual(Math.abs(spoke.position[0]) + spoke.size[0] / 2 + contactTolerance);
          expectContact(spoke, part("socket"));
        }
        const radiusAt = (y: number) => Math.max(...vertices.filter(vertex => Math.abs(vertex.y - y) < contactTolerance).map(vertex => Math.abs(vertex.x - shade.position[0])));
        const bounds = getFurniturePartBounds(shade);
        expect(radiusAt(bounds.max[1])).toBeGreaterThan(0);
        expect(radiusAt(bounds.max[1])).toBeLessThan(radiusAt(bounds.min[1]));
        expect(cast(new Vector3(shade.position[0], bounds.max[1] + .1, shade.position[2]), new Vector3(0, -1, 0), [mesh("shade")])).toHaveLength(0);
      });
    });

    it("makes the trophy bowl flare upward with a hollow mouth and attached handles", () => {
      withModel("trophy-cup", ({ part, mesh, cast }) => {
        const bowl = part("bowl"), rim = part("rim");
        const top = getFurniturePartBounds(rim).max[1] + .1;
        const center = cast(new Vector3(bowl.position[0] + bowl.size[0] * .02, top, bowl.position[2]), new Vector3(0, -1, 0), [mesh("bowl"), mesh("rim")])[0];
        expect(center?.object.name).toBe("bowl");
        expect(center.point.y).toBeLessThan(bowl.position[1]);
        const edge = cast(new Vector3(rim.position[0] + rim.size[0] * .47, top, rim.position[2]), new Vector3(0, -1, 0), [mesh("bowl"), mesh("rim")])[0];
        expect(edge?.object.name).toBe("rim");
        const radii = [-.25, .25].map(fraction => {
          const hit = cast(new Vector3(bowl.position[0] + bowl.size[0], bowl.position[1] + fraction * bowl.size[1], bowl.position[2]), new Vector3(-1, 0, 0), [mesh("bowl")])[0];
          expect(hit).toBeDefined();
          return hit.point.x - bowl.position[0];
        });
        expect(radii[1]).toBeGreaterThan(radii[0]);
        expectContact(part("stem"), bowl);
        expectContact(part("stem"), part("base"));
        for (const sign of [-1, 1]) {
          for (const name of [`handle-lower-${sign}`, `handle-upper-${sign}`]) {
            const handle = part(name);
            expectContact(handle, part(`handle-side-${sign}`));
            const hit = cast(new Vector3(...handle.position), new Vector3(-sign, 0, 0), [mesh("bowl")])[0];
            expect(hit, name).toBeDefined();
            expect(hit.distance, name).toBeLessThanOrEqual(handle.size[0] / 2 + contactTolerance);
          }
        }
      });
    });

    it("builds two independently faceted holographic crystals over a hexagonal pedestal", () => {
      withModel("holo-art", ({ part, mesh, cast }) => {
        const plinth = part("plinth");
        const vertices = worldVertices(mesh("plinth"));
        const outer = vertices.filter(vertex => Math.hypot(vertex.x, vertex.z) > plinth.size[0] * .1);
        const angles = new Set(outer.map(vertex => ((Math.atan2(vertex.x, vertex.z) + Math.PI * 2) % (Math.PI * 2)).toFixed(5)));
        expect(angles.size).toBe(6);
        expect(part("crystal-0").position[0]).not.toBe(part("crystal-1").position[0]);
        for (let i = 0; i < 2; i++) {
          const crystal = part(`crystal-${i}`), geometry = mesh(crystal.id).geometry;
          expect(crystal.shape).toBe("crystal");
          expect(geometry.getIndex()).toBeNull();
          const normals = geometry.getAttribute("normal");
          for (let index = 0; index < normals.count; index += 3) {
            const a = new Vector3().fromBufferAttribute(normals, index);
            expect(a.distanceTo(new Vector3().fromBufferAttribute(normals, index + 1))).toBeLessThan(1e-6);
            expect(a.distanceTo(new Vector3().fromBufferAttribute(normals, index + 2))).toBeLessThan(1e-6);
          }
          const hits = cast(new Vector3(crystal.position[0], crystal.position[1], 1), new Vector3(0, 0, -1));
          expect(hits[0]?.object.name).toBe(crystal.id);
          expectContact(crystal, part(`mount-${i}`));
        }
      });
    });

    it("retains transparent glass while using an opaque depth-writing oven window", () => {
      const window = getFurnitureRecipe("range-cooker")!.parts.find(part => part.id === "oven-window")!;
      const glass = getFurnitureRecipe("aquarium")!.parts.find(part => part.material === "glass")!;
      expect(getFurnitureMaterialProperties(window, "#87949b")).toMatchObject({ transparent: false, opacity: 1, depthWrite: true });
      expect(getFurnitureMaterialProperties(glass, "#58adb7")).toMatchObject({ transparent: true, opacity: .22, depthWrite: false });
      expect(getFurnitureMaterialProperties(window, "#87949b", true)).toMatchObject({ transparent: true, opacity: .38, depthWrite: false });
    });
    it("switches cabinet display emission off with power and ghost state", () => {
      for (const part of getFurnitureRecipe("arcade-cabinet")!.parts.filter(part => part.surface === "display")) {
        expect(getFurnitureMaterialProperties(part, "#4a99b2", false, true).emissiveIntensity).toBeGreaterThan(0);
        expect(getFurnitureMaterialProperties(part, "#4a99b2", false, false)).toMatchObject({ emissive: "#000000", emissiveIntensity: 0 });
        expect(getFurnitureMaterialProperties(part, "#4a99b2", true, true)).toMatchObject({ emissive: "#000000", emissiveIntensity: 0 });
      }
    });

    it("detects detached support, occluded controls and a sealed cup in negative geometry fixtures", () => {
      withModel("corner-sofa", ({ part, mesh, cast }) => {
        const foot = part("return-foot");
        const origin = new Vector3(...foot.position).add(new Vector3(0, -.1, 0));
        const hit = cast(origin, new Vector3(0, 1, 0), [mesh("return-seat")])[0];
        expect(hit).toBeDefined();
        expect(hit.distance).toBeGreaterThan(foot.size[1] / 2 + contactTolerance);
      });
      withModel("range-cooker", ({ part, mesh, cast }) => {
        const knob = part("knob--0.3"), hidden = mesh(knob.id);
        hidden.position.z = part("oven").position[2];
        hidden.updateMatrixWorld(true);
        const hit = cast(new Vector3(knob.position[0] + knob.size[0] * .2, knob.position[1], 1), new Vector3(0, 0, -1))[0];
        expect(hit).toBeDefined();
        expect(hit.object.name).not.toBe(knob.id);
      });
      withModel("trophy-cup", ({ part, mesh, cast }) => {
        const rim = part("rim");
        const cap = new Mesh(createFurniturePartGeometry({ ...rim, shape: "cylinder" }), mesh("rim").material);
        cap.name = "sealed-mouth";
        cap.position.set(...rim.position);
        cap.updateMatrixWorld(true);
        try {
          const hit = cast(new Vector3(rim.position[0] + rim.size[0] * .02, getFurniturePartBounds(rim).max[1] + .1, rim.position[2]), new Vector3(0, -1, 0), [mesh("bowl"), cap])[0];
          expect(hit.object.name).toBe("sealed-mouth");
          expect(hit.point.y).toBeGreaterThan(part("bowl").position[1]);
        } finally {
          cap.geometry.dispose();
        }
      });
    });

    it.each(repairedIds)("%s keeps transformed renderer vertices within every quarter-turn footprint", id => {
      withModel(id, ({ meshes }) => {
        const definition = getFurnitureDefinition(id)!;
        for (const mesh of meshes) {
          for (const vertex of worldVertices(mesh)) {
            expect(vertex.y, `${id}/${mesh.name}/ground`).toBeGreaterThanOrEqual(-1e-6);
            expect(vertex.y, `${id}/${mesh.name}/height`).toBeLessThanOrEqual(definition.height + 1e-6);
            for (const rotation of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
              const swapped = Math.abs(Math.sin(rotation)) > .5;
              const width = swapped ? definition.depth : definition.width;
              const depth = swapped ? definition.width : definition.depth;
              expect(Math.abs(vertex.x * Math.cos(rotation) + vertex.z * Math.sin(rotation)), `${id}/${mesh.name}/x`).toBeLessThanOrEqual(width / 2 + 1e-6);
              expect(Math.abs(-vertex.x * Math.sin(rotation) + vertex.z * Math.cos(rotation)), `${id}/${mesh.name}/z`).toBeLessThanOrEqual(depth / 2 + 1e-6);
            }
          }
        }
      });
    });
  });

  it("quarter-turn geometry stays inside the swapped placement footprint", () => {
    for (const item of FURNITURE_CATALOG) {
      for (const rotation of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
        const swap = Math.abs(Math.sin(rotation)) > .5;
        const width = swap ? item.depth : item.width;
        const depth = swap ? item.width : item.depth;
        for (const part of getFurnitureRecipe(item.id)!.parts) {
          const { min, max } = getFurniturePartBounds(part);
          for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) {
            const worldX = x * Math.cos(rotation) + z * Math.sin(rotation);
            const worldZ = -x * Math.sin(rotation) + z * Math.cos(rotation);
            expect(Math.abs(worldX)).toBeLessThanOrEqual(width / 2 + epsilon);
            expect(Math.abs(worldZ)).toBeLessThanOrEqual(depth / 2 + epsilon);
          }
        }
      }
    }
  });
});
