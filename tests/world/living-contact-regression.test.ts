import { describe, expect, it } from "vitest";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { LIVING_V7_CATALOG, LIVING_V7_RECIPES } from "../../src/furniture/collection-living-v7";
import type { FurniturePart } from "../../src/furniture/catalog";

type Point = [number, number, number];
const epsilon = 1e-5;
const get = (id: string, name: string) => LIVING_V7_RECIPES[id]().find(part => part.id === name)!;

function scaled(part: FurniturePart, scale: Point): FurniturePart {
  return {
    ...part,
    position: part.position.map((v, i) => v * scale[i]) as Point,
    size: part.size.map((v, i) => v * scale[i]) as Point,
    lean: part.lean ? [part.lean[0] * scale[0], part.lean[1] * scale[2]] : undefined,
  };
}

function hits(part: FurniturePart, origin: Point, direction: Point, scale: Point = [1, 1, 1]) {
  const geometry = createFurniturePartGeometry(scaled(part, scale));
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...part.position.map((v, i) => v * scale[i]) as Point);
    mesh.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(...origin.map((v, i) => v * scale[i]) as Point), new Vector3(...direction.map((v, i) => v * scale[i]) as Point).normalize());
    return ray.intersectObject(mesh).map(hit => hit.distance).filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > epsilon);
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

function gap(a: FurniturePart, b: FurniturePart, origin: Point, direction: Point, scale: Point = [1, 1, 1]) {
  const first = hits(a, origin, direction, scale), second = hits(b, origin, direction, scale);
  if (first.length < 2 || second.length < 2) return Infinity;
  let distance = Infinity;
  for (let i = 0; i + 1 < first.length; i += 2) {
    for (let j = 0; j + 1 < second.length; j += 2) {
      distance = Math.min(distance, Math.max(first[i], second[j]) - Math.min(first[i + 1], second[j + 1]));
    }
  }
  return distance;
}

function bounds(part: FurniturePart) {
  const geometry = createFurniturePartGeometry(part);
  try {
    geometry.computeBoundingBox();
    return geometry.boundingBox!.clone().translate(new Vector3(...part.position));
  } finally {
    geometry.dispose();
  }
}

function scaleFor(id: string, callerScale: boolean): Point {
  const definition = LIVING_V7_CATALOG.find(item => item.id === id)!;
  return callerScale ? [definition.width, definition.height, definition.depth] : [1, 1, 1];
}

describe.each([false, true])("living contact regression at caller scale %s", callerScale => {
  it("joins rocker front posts to arms without piercing the seat", () => {
    const id = "v7-rocker-lounge", scale = scaleFor(id, callerScale);
    for (const side of [-1, 1]) {
      const post = get(id, `front-post-${side}`), arm = get(id, `arm-${side}`);
      const original: FurniturePart = { ...post, position: [side * .37, .29, .24], size: [.06, .46, .07] };
      expect(gap(original, arm, [side * .37, -1, .24], [0, 1, 0], scale)).toBeCloseTo(.095 * scale[1], 5);
      expect(gap(post, arm, [side * .37, -1, .24], [0, 1, 0], scale)).toBeLessThan(-.004 * scale[1]);
      expect(gap(post, get(id, "seat"), [side, .52, .24], [-side, 0, 0], scale)).toBeGreaterThan(.009 * scale[0]);
      expect(gap(post, get(id, "seat-deck"), [side * .37, -1, .24], [0, 1, 0], scale)).toBeLessThan(0);
    }
  });

  it("keeps the folding brace joined to its genuinely sheared legs", () => {
    const id = "v7-folding-chair", scale = scaleFor(id, callerScale), brace = get(id, "rear-brace");
    for (const side of [-1, 1]) {
      const leg = get(id, `backward-leg-${side}`), origin: Point = [side * .36, .15, -1];
      expect(gap(brace, leg, origin, [0, 0, 1], scale)).toBeCloseTo(-.01653846 * scale[2], 5);
      expect(gap({ ...brace, position: [0, .15, -.29] }, leg, origin, [0, 0, 1], scale)).toBeGreaterThan(.08 * scale[2]);
    }
  });

  it("keeps the beanbag seam on the curved fabric instead of projecting a straight bar", () => {
    const id = "v7-beanbag-seat", scale = scaleFor(id, callerScale), base = get(id, "fabric-base"), seam = get(id, "front-seam");
    const original: FurniturePart = { ...seam, shape: "box", roundness: .32, position: [0, .16, .435], size: [.5, .018, .02] };
    expect(gap(base, original, [.24, .16, 1], [0, 0, -1], scale)).toBeGreaterThan(.06 * scale[2]);
    for (const x of [-.24, -.12, 0, .12, .24]) {
      const origin: Point = [x, .16, 1], direction: Point = [0, 0, -1];
      expect(gap(base, seam, origin, direction, scale)).toBeLessThan(0);
      const surface = hits(base, origin, direction, scale)[0], piping = hits(seam, origin, direction, scale)[0];
      expect(surface - piping).toBeGreaterThan(0);
      expect(surface - piping).toBeLessThan(.012 * scale[2]);
    }
  });

  it("clears library bedside tables from the mattress while retaining base contact", () => {
    const id = "v7-library-bed", scale = scaleFor(id, callerScale), mattress = get(id, "mattress");
    for (const side of [-1, 1]) {
      const table = get(id, `side-table-${side}`), origin: Point = [side, .34, -.08];
      const original: FurniturePart = { ...table, position: [side * .43, .3, -.08], size: [.13, .6, .27] };
      expect(gap(original, mattress, origin, [-side, 0, 0], scale)).toBeCloseTo(-.015 * scale[0], 5);
      expect(gap(table, mattress, origin, [-side, 0, 0], scale)).toBeGreaterThan(.019 * scale[0]);
      expect(gap(table, get(id, "base"), [side, .14, -.08], [-side, 0, 0], scale)).toBeLessThan(0);
    }
  });

  it("separates wingback cushion and post faces while preserving frame and arm joints", () => {
    const id = "v7-wingback-chair", scale = scaleFor(id, callerScale), seat = get(id, "seat"), frame = get(id, "under-seat");
    for (const side of [-1, 1]) {
      const post = get(id, `arm-post-${side}`), origin: Point = [side, .45, .24];
      const originalPost: FurniturePart = { ...post, position: [side * .37, .47, .24] };
      const originalSeat: FurniturePart = { ...seat, size: [.8, .15, .75] };
      expect(gap(originalSeat, originalPost, origin, [-side, 0, 0], scale)).toBeCloseTo(-.06 * scale[0], 5);
      expect(gap(seat, post, origin, [-side, 0, 0], scale)).toBeGreaterThan(.009 * scale[0]);
      expect(gap(frame, post, [side, .37, .24], [-side, 0, 0], scale)).toBeLessThan(0);
      expect(gap(post, get(id, `arm-pad-${side}`), [side * .405, -1, .24], [0, 1, 0], scale)).toBeLessThan(0);
      const face = side > 0 ? "max" : "min";
      expect(Math.abs(bounds(originalPost)[face].x - bounds(frame)[face].x)).toBeLessThan(epsilon);
      expect(Math.abs(bounds(post)[face].x - bounds(frame)[face].x)).toBeGreaterThan(.03);
    }
  });

  it("exposes nest rim glow below its rim and retains the already connected head petals", () => {
    const id = "v7-nest-bed", scale = scaleFor(id, callerScale), rim = get(id, "rim"), light = get(id, "rim-light"), plinth = get(id, "round-plinth");
    const original: FurniturePart = { ...light, position: [0, .19, 0] };
    const buriedOrigin: Point = [1, .19, .01], direction: Point = [-1, 0, 0];
    expect(hits(rim, buriedOrigin, direction, scale)[0]).toBeLessThan(hits(original, buriedOrigin, direction, scale)[0]);
    const exposedOrigin: Point = [1, .153, .01];
    expect(hits(rim, exposedOrigin, direction, scale)).toHaveLength(0);
    expect(hits(light, exposedOrigin, direction, scale)[0]).toBeLessThan(hits(plinth, exposedOrigin, direction, scale)[0]);
    expect(gap(light, rim, [.47, -1, .01], [0, 1, 0], scale)).toBeLessThan(0);
    for (const side of [-1, 1]) expect(gap(get(id, "center-head"), get(id, `head-petal-${side}`), [side, .64, -.34], [-side, 0, 0], scale)).toBeLessThan(-.018 * scale[0]);
  });

  it("separates courtyard corner cushions without removing their plinth support", () => {
    const id = "v7-courtyard-sofa", scale = scaleFor(id, callerScale);
    for (const side of [-1, 1]) {
      const wing = get(id, `wing-pad-${side}`), rear = get(id, `rear-pad-${side * .3}`);
      const original: FurniturePart = { ...wing, position: [side * .33, .43, .14], size: [.29, .22, .67] };
      expect(gap(original, rear, [side * .3, 1, -.16], [0, -1, 0], scale)).toBeLessThan(-.18 * scale[1]);
      expect(bounds(wing).min.z - bounds(rear).max.z).toBeGreaterThan(.004);
      expect(gap(wing, get(id, `wing-plinth-${side}`), [side * .33, -1, .175], [0, 1, 0], scale)).toBeLessThanOrEqual(epsilon);
    }
  });

  it("clears bench upholstery from both pairs of handle posts", () => {
    const id = "v7-storage-bench", scale = scaleFor(id, callerScale), cushion = get(id, "bench-cushion");
    for (const side of [-1, 1]) for (const [prefix, z] of [["handle-post", -.29], ["handle-front", .29]] as const) {
      const post = get(id, `${prefix}-${side}`), origin: Point = [side, .79, z], direction: Point = [-side, 0, 0];
      expect(gap({ ...cushion, size: [.94, .18, .84] }, post, origin, direction, scale)).toBeCloseTo(-.04 * scale[0], 5);
      expect(gap(cushion, post, origin, direction, scale)).toBeGreaterThan(.009 * scale[0]);
    }
    expect(gap(cushion, get(id, "cabinet"), [0, -1, 0], [0, 1, 0], scale)).toBeLessThanOrEqual(epsilon);
  });

  it("separates four island cushions instead of sharing crossing surfaces", () => {
    const id = "v7-island-settee", scale = scaleFor(id, callerScale);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const a = get(id, `seat-x-${x}`), b = get(id, `seat-z-${z}`), origin: Point = [x * .21, 1, z * .21];
      expect(gap({ ...a, size: [.27, .18, .52] }, { ...b, size: [.52, .18, .27] }, origin, [0, -1, 0], scale)).toBeLessThan(-.16 * scale[1]);
      expect(bounds(a).intersectsBox(bounds(b))).toBe(false);
      expect(gap(a, get(id, "octagonal-base"), [x * .3, -1, 0], [0, 1, 0], scale)).toBeLessThan(0);
    }
  });

  it("accepts actual cantilever joints and inset wheel support", () => {
    const cases: [string, string, string, Point, Point][] = [
      ["v7-woven-daybed", "end-arm-1", "end-post-1", [.46, -1, -.39], [0, 1, 0]],
      ["v7-study-loft-bed", "study-top", "study-back", [0, -1, -.42], [0, 1, 0]],
      ["v7-corner-desk", "return-apron", "return-top", [.46, -1, .2], [0, 1, 0]],
      ["v7-trundle-bed", "pullout-deck", "runner-1", [.31, -1, .33], [0, 1, 0]],
      ["v7-trundle-bed", "runner-1", "wheel-1", [.31, -1, .33], [0, 1, 0]],
      ["v7-beanbag-seat", "top-grip", "bean-back", [0, -1, -.23], [0, 1, 0]],
      ["v7-courtyard-sofa", "outer-back-1", "wing-pad-1", [.44, -1, .2], [0, 1, 0]],
    ];
    for (const [id, first, second, origin, direction] of cases) {
      const a = get(id, first), b = get(id, second), scale = scaleFor(id, callerScale);
      expect(gap(a, b, origin, direction, scale), `${id}/${first}/${second}`).toBeLessThanOrEqual(epsilon);
      expect(gap({ ...a, position: [a.position[0], a.position[1] + 2, a.position[2]] }, b, origin, direction, scale)).toBeGreaterThan(epsilon);
    }
  });
});
