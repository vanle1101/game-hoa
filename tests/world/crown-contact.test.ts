import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getEquipmentDefinition, getEquipmentRecipe, type EquipmentPart } from "../../src/equipment/catalog";
import { createEquipmentPartGeometry } from "../../src/components/world/equipment-models";

const tolerance = 1e-6;
const sides = [-1, 0, 1];
const crown = getEquipmentRecipe("signal-crown")!;
const band = crown.parts.find(part => part.id === "band")!;
const originalSpire = (side: number): EquipmentPart => ({
  id: `spire-${side}`,
  geometry: { kind: "cylinder", radiusTop: 0, radiusBottom: .025, height: side === 0 ? .17 : .11, segments: 12 },
  position: [side * .09, .14, .09],
  rotation: [0, 0, 0],
  material: "light",
  anchor: "head",
});

function triangles(part: EquipmentPart, parent = new THREE.Matrix4()): THREE.Triangle[] {
  const geometry = createEquipmentPartGeometry(part);
  try {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...part.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation)),
      new THREE.Vector3(1, 1, 1),
    ).premultiply(parent);
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const result: THREE.Triangle[] = [];
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const vertex = (offset: number) => new THREE.Vector3()
        .fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset)
        .applyMatrix4(matrix);
      const triangle = new THREE.Triangle(vertex(0), vertex(1), vertex(2));
      for (const point of [triangle.a, triangle.b, triangle.c]) {
        if (!point.toArray().every(Number.isFinite)) throw new Error(`Nonfinite vertex in ${part.id}`);
      }
      if (triangle.getArea() > 1e-15) result.push(triangle);
    }
    return result;
  } finally {
    geometry.dispose();
  }
}

function segmentDistance(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): number {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  let s = 0, t = 0;
  if (a <= 1e-24 && e <= 1e-24) return p1.distanceTo(p2);
  if (a <= 1e-24) {
    t = clamp(f / e);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-24) {
      s = clamp(-c / a);
    } else {
      const b = d1.dot(d2), denominator = a * e - b * b;
      s = denominator > 1e-30 ? clamp((b * f - c * e) / denominator) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a);
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}

function meshContact(left: THREE.Triangle[], right: THREE.Triangle[]) {
  let distance = Infinity, intersections = 0;
  for (const a of left) {
    for (const b of right) {
      const av = [a.a, a.b, a.c], bv = [b.a, b.b, b.c];
      for (const [source, target] of [[a, b], [b, a]]) {
        const vertices = [source.a, source.b, source.c];
        for (let i = 0; i < 3; i++) {
          const p = vertices[i], q = vertices[(i + 1) % 3];
          const delta = q.clone().sub(p), length = delta.length();
          const hit = new THREE.Ray(p, delta.normalize())
            .intersectTriangle(target.a, target.b, target.c, false, new THREE.Vector3());
          if (hit && p.distanceTo(hit) <= length + 1e-12) {
            intersections++;
            distance = 0;
          }
          distance = Math.min(distance, p.distanceTo(target.closestPointToPoint(p, new THREE.Vector3())));
        }
      }
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          distance = Math.min(distance, segmentDistance(av[i], av[(i + 1) % 3], bv[j], bv[(j + 1) % 3]));
        }
      }
    }
  }
  return { distance, intersections };
}

const bandTriangles = triangles(band);
const headTransform = new THREE.Matrix4().compose(
  new THREE.Vector3(.3, 1.2, -.4),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(.23, -.7, .41)),
  new THREE.Vector3(1, 1, 1),
);

describe("signal crown triangle contact", () => {
  it("preserves the band, spire shapes, anchors and item metadata", () => {
    expect(crown).toMatchObject({ id: "signal-crown", slot: "head", category: "armor", grip: null });
    expect(crown.parts.map(part => part.id)).toEqual(["band", "spire--1", "spire-0", "spire-1"]);
    expect(band).toEqual({
      id: "band", geometry: { kind: "torus", radius: .14, tube: .015 },
      position: [0, .035, 0], rotation: [Math.PI / 2, 0, 0], material: "gold", anchor: "head",
    });
    expect(bandTriangles).toHaveLength(512);
    for (const side of sides) {
      const current = crown.parts.find(part => part.id === `spire-${side}`)!;
      expect({ ...current, position: originalSpire(side).position }).toEqual(originalSpire(side));
      expect(triangles(current)).toHaveLength(24);
    }
    expect(getEquipmentDefinition("signal-crown")).toEqual({
      id: "signal-crown", name: "Vương Miện Tín Hiệu", description: "Ba chóp phát tín hiệu trên vòng miện mảnh.",
      rarity: "rare", slot: "head", attack: 4, defense: 11, critRate: .03, level: 3, price: 300,
      category: "armor", modelId: "signal-crown", icon: "Glasses", accent: "#84c9d3", rigAnchors: ["head"],
    });
  });

  it.each(sides)("detects the original detached spire %s", side => {
    const result = meshContact(bandTriangles, triangles(originalSpire(side)));
    expect(result.intersections).toBe(0);
    expect(result.distance).toBeGreaterThan(tolerance);
    expect(result.distance).toBeCloseTo(side === 0 ? .017129374540642943 : .03500000063329933, 9);
  });

  it("rejects lowering the center spire without moving it onto the band", () => {
    const lowered = originalSpire(0);
    lowered.position[1] = .04 + .17 / 2;
    const result = meshContact(bandTriangles, triangles(lowered));
    expect(result.intersections).toBe(0);
    expect(result.distance).toBeCloseTo(.011106326599012074, 9);
    expect(result.distance).toBeGreaterThan(tolerance);
  });

  it.each(sides)("intersects the actual band triangles with current spire %s", side => {
    const current = crown.parts.find(part => part.id === `spire-${side}`)!;
    const result = meshContact(bandTriangles, triangles(current));
    expect(result.intersections).toBeGreaterThan(0);
    expect(result.distance).toBeLessThanOrEqual(tolerance);
  });

  it.each(sides)("preserves old separation and new contact under a common head transform for spire %s", side => {
    const transformedBand = triangles(band, headTransform);
    const oldContact = meshContact(transformedBand, triangles(originalSpire(side), headTransform));
    expect(oldContact.intersections).toBe(0);
    expect(oldContact.distance).toBeCloseTo(side === 0 ? .017129374540642943 : .03500000063329933, 9);
    const current = crown.parts.find(part => part.id === `spire-${side}`)!;
    const newContact = meshContact(transformedBand, triangles(current, headTransform));
    expect(newContact.intersections).toBeGreaterThan(0);
    expect(newContact.distance).toBeLessThanOrEqual(tolerance);
  });
});
