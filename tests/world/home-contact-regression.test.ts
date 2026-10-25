import { describe, expect, it } from "vitest";
import { Box3, Ray, Triangle, Vector3 } from "three";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { getFurnitureRecipe, getFurnitureDefinition, type FurniturePart } from "../../src/furniture/catalog";

const tolerance = 1e-6;

function mesh(part: FurniturePart) {
  const geometry = createFurniturePartGeometry(part);
  geometry.translate(...part.position);
  const positions = geometry.getAttribute("position");
  const index = geometry.index;
  const triangles: Triangle[] = [];
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset));
    triangles.push(new Triangle(vertices[0], vertices[1], vertices[2]));
  }
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!.clone();
  geometry.dispose();
  return { triangles, bounds };
}

function contains(triangles: Triangle[], point: Vector3) {
  const ray = new Ray(point, new Vector3(1, .371, .529).normalize());
  const distances: number[] = [];
  for (const triangle of triangles) {
    if (triangle.closestPointToPoint(point, new Vector3()).distanceTo(point) <= tolerance) return true;
    const hit = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new Vector3());
    if (hit) {
      const distance = hit.distanceTo(point);
      if (!distances.some(previous => Math.abs(previous - distance) <= tolerance)) distances.push(distance);
    }
  }
  return distances.length % 2 === 1;
}

function contacts(a: FurniturePart, b: FurniturePart) {
  const left = mesh(a), right = mesh(b);
  if (!left.bounds.clone().expandByScalar(tolerance).intersectsBox(right.bounds)) return false;
  for (const triangle of left.triangles) {
    if ([triangle.a, triangle.b, triangle.c].some(vertex => contains(right.triangles, vertex))) return true;
    const bounds = new Box3().setFromPoints([triangle.a, triangle.b, triangle.c]).expandByScalar(tolerance);
    for (const other of right.triangles) {
      if (!bounds.intersectsBox(new Box3().setFromPoints([other.a, other.b, other.c]))) continue;
      for (const [source, target] of [[triangle, other], [other, triangle]]) {
        const vertices = [source.a, source.b, source.c];
        for (let i = 0; i < 3; i++) {
          const start = vertices[i], end = vertices[(i + 1) % 3];
          const direction = end.clone().sub(start);
          const length = direction.length();
          const hit = new Ray(start, direction.normalize()).intersectTriangle(target.a, target.b, target.c, false, new Vector3());
          if (hit && hit.distanceTo(start) <= length + tolerance) return true;
        }
      }
    }
  }
  return right.triangles.some(triangle => contains(left.triangles, triangle.a));
}

function part(model: string, id: string) {
  const result = getFurnitureRecipe(model)!.parts.find(candidate => candidate.id === id);
  expect(result, `${model}/${id}`).toBeDefined();
  return result!;
}

function normalized(model: string, value: FurniturePart): FurniturePart {
  const definition = getFurnitureDefinition(model)!;
  const scale = [definition.width, definition.height, definition.depth];
  return { ...value, position: value.position.map((n, i) => n * scale[i]) as [number, number, number], size: value.size.map((n, i) => n * scale[i]) as [number, number, number], ...(value.lean ? { lean: [value.lean[0] * scale[0], value.lean[1] * scale[2]] as const } : {}) };
}

const joined = [
  ["v7-espresso-machine", "steam-wand", "rear-reservoir"],
  ["v7-espresso-machine", "cup-handle", "coffee-cup"],
  ["v7-dish-rack", "rack-rail--1", "rack-foot--1--1"],
  ["v7-dish-rack", "rack-foot--1--1", "drain-tray"],
  ["v7-dish-rack", "utensil-basket", "drain-tray"],
  ["v7-breakfast-trolley", "push-handle", "foot--1--1"],
  ["v7-breakfast-trolley", "stored-plate-0", "tray-0.22"],
  ["v7-textile-rail", "hanging-weave", "textile-crossbar"],
  ["v7-textile-rail", "folded-back", "textile-crossbar"],
  ["v7-zen-garden", "rake-tooth-0", "sand-bed"],
  ["v7-magazine-sling", "fabric-pocket-1", "sling-rail-1"],
  ["v7-magazine-sling", "fabric-pocket--1", "sling-rail--1"],
  ["v7-magazine-sling", "cover-title-0", "magazine-0"],
  ["v7-magazine-sling", "cover-title-1", "magazine-1"],
  ["v7-magazine-sling", "cover-title-2", "magazine-2"],
  ["v7-dish-rack", "chopstick-1", "utensil-basket-floor"],
  ["v7-dish-rack", "utensil-basket-floor", "drain-tray"],
  ["v7-globe-stand", "polar-axis", "globe-pedestal"],
  ["v7-umbrella-stand", "folded-umbrella-1", "umbrella-drip-base"],
  ["v7-extractor-hood", "exhaust-duct", "canopy-shoulder"],
  ["v7-extractor-hood", "canopy-shoulder", "flared-canopy"],
  ["v7-pendulum-clock", "minute-hand", "clock-face"],
  ["v7-pendulum-clock", "hour-hand", "clock-face"],
  ["v7-pendulum-clock", "hour-mark-0", "clock-face"],
  ["v7-pendulum-clock", "hour-mark-2", "clock-face"],
  ["v7-art-easel", "a-frame-leg-1", "canvas-frame"],
  ["v7-art-easel", "rear-prop", "canvas-frame"],
  ["v7-folding-screen", "panel-post-1--1", "panel-post-0-1"],
  ["v7-folding-screen", "panel-post--1-1", "panel-post-0--1"],
  ["v7-folding-screen", "hinge-1-0.75", "panel-post-1--1"],
  ["v7-folding-screen", "hinge--1-0.75", "panel-post--1-1"],
  ["v7-folding-screen", "panel-rail-1-0.96", "panel-post-1-1"],
  ["v7-folding-screen", "panel-rail--1-0.96", "panel-post--1--1"],
  ["v7-vase-cluster", "dried-grass-stem", "grass-frond--1"],
  ["v7-vase-cluster", "grass-frond--1", "grass-frond-1"],
] as const;

describe("home transformed mesh contacts", () => {
  it.each(joined)("%s joins %s to %s", (model, a, b) => {
    expect(contacts(part(model, a), part(model, b))).toBe(true);
  });

  it("rejects the detached steam wand despite its leaned bounding envelope", () => {
    const model = "v7-espresso-machine";
    const wand = normalized(model, { id: "detached", shape: "box", position: [.32, .43, .02], size: [.025, .38, .025], lean: [0, .2], material: "metal" });
    for (const target of ["rear-reservoir", "brew-head", "drip-tray"]) expect(contacts(wand, part(model, target))).toBe(false);
  });

  it("does not treat the hollow center of a ring as solid contact", () => {
    const ring: FurniturePart = { id: "ring", shape: "ring", position: [0, 0, 0], size: [1, .1, 1], material: "metal" };
    const inset: FurniturePart = { id: "inset", shape: "box", position: [0, 0, 0], size: [.1, .04, .1], material: "wood" };
    expect(mesh(ring).bounds.intersectsBox(mesh(inset).bounds)).toBe(true);
    expect(contacts(ring, inset)).toBe(false);
    expect(contacts(ring, { ...inset, position: [.47, 0, 0] })).toBe(true);
  });

  it("seats every plate on its wire base without penetrating the drain tray", () => {
    const model = "v7-dish-rack";
    for (let i = 0; i < 4; i++) {
      expect(contacts(part(model, `plate-${i}`), part(model, `slot-base-${i}`))).toBe(true);
      expect(contacts(part(model, `plate-${i}`), part(model, "drain-tray"))).toBe(false);
    }
    const original = normalized(model, { id: "original-plate", shape: "cylinder", position: [-.3, .5, -.04], size: [.55, .028, .55], rotation: [0, 0, Math.PI / 2], material: "paper" });
    expect(contacts(original, part(model, "drain-tray"))).toBe(true);
  });

  it("keeps easel support meshes behind the artwork", () => {
    const model = "v7-art-easel";
    for (const id of ["a-frame-leg--1", "a-frame-leg-1", "rear-prop"]) {
      expect(contacts(part(model, id), part(model, "canvas"))).toBe(false);
      expect(contacts(part(model, id), part(model, "near-hill"))).toBe(false);
    }
    const original = normalized(model, { id: "original-prop", shape: "box", position: [0, .44, -.18], size: [.05, .88, .055], lean: [0, .45], material: "wood" });
    expect(contacts(original, part(model, "canvas"))).toBe(true);
  });

  it("raises dial reliefs above the face instead of burying them", () => {
    const face = mesh(part("v7-pendulum-clock", "clock-face")).bounds;
    for (const id of ["hour-hand", "minute-hand", "hour-mark-0", "hour-mark-1", "hour-mark-2", "hour-mark-3"]) {
      const relief = mesh(part("v7-pendulum-clock", id)).bounds;
      expect(relief.max.z).toBeGreaterThan(face.max.z + tolerance);
      expect(relief.min.z).toBeLessThan(face.max.z);
      expect(relief.min.y).toBeGreaterThan(face.min.y);
      expect(relief.max.y).toBeLessThan(face.max.y);
    }
  });

  it("rejects the original unsupported rack frame", () => {
    for (const id of ["rack-rail--1", "rack-rail-1", "slot-base-0"]) expect(contacts(part("v7-dish-rack", id), part("v7-dish-rack", "drain-tray"))).toBe(false);
  });
});
