import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { faceShape, hairCapMeshData, HAIR_STYLES, headMeshData, type SculptedMeshData } from "../../src/components/world/character-shape";
import { hairCoverage } from "../../src/components/world/wearable-shapes";

const clearance = .0005;
const faces = [0, 1, 2, 3, 4, 5];

function originalCap(crownScale = 1, undercut = false, segments = 32, rearPatch = false): SculptedMeshData {
  const side = undercut ? .9 : 1;
  const rings = [
    [-.052, .086 * side, .072, -.048], [-.012, .112 * side, .104, -.026],
    [.028, .122 * side, .118, -.01], [.064, .124, .121, -.003],
    [.098 * crownScale + .022 * (1 - crownScale), .114, .112, -.004],
    [.126 * crownScale + .032 * (1 - crownScale), .084, .084, -.008],
    [.142 * crownScale + .038 * (1 - crownScale), .028, .028, -.01],
  ];
  const positions: number[] = [], indices: number[] = [];
  rings.forEach(([y, rx, rz, center], row) => {
    for (let i = 0; i <= segments; i++) {
      const angle = i * Math.PI * 2 / segments, cos = Math.cos(angle), rear = Math.max(0, -cos);
      const width = rearPatch && !undercut ? [0, 0, .012, .008, 0, 0, 0][row] * rear : 0;
      const depth = rearPatch ? [0, 0, .006, .016, .019, .028, 0][row] * rear : 0;
      positions.push(Math.sin(angle) * (rx + width), y + (row < 2 && cos > .25 ? (cos - .25) * .045 : 0), center + cos * rz - depth);
    }
  });
  for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < segments; i++) {
    const a = row * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { positions, indices };
}

function triangles(data: SculptedMeshData, yScale = 1, yOffset = 0) {
  const point = (index: number) => new THREE.Vector3(Math.fround(data.positions[index * 3]), Math.fround(data.positions[index * 3 + 1]) * yScale + yOffset, Math.fround(data.positions[index * 3 + 2]));
  return Array.from({ length: data.indices.length / 3 }, (_, index) => new THREE.Triangle(point(data.indices[index * 3]), point(data.indices[index * 3 + 1]), point(data.indices[index * 3 + 2])));
}

function hit(mesh: THREE.Triangle[], y: number, degrees: number) {
  const angle = degrees * Math.PI / 180, outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const origin = outward.clone().multiplyScalar(.5).add(new THREE.Vector3(0, y, 0));
  const ray = new THREE.Ray(origin, outward.clone().negate());
  return mesh.flatMap(triangle => {
    const point = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, true, new THREE.Vector3());
    return point ? [{ point, distance: origin.distanceTo(point), normal: triangle.getNormal(new THREE.Vector3()), outward }] : [];
  }).sort((a, b) => a.distance - b.distance)[0];
}

function assertCoverage(head: THREE.Triangle[], cap: THREE.Triangle[], low: number, high: number, start: number, end: number, maximum = Infinity) {
  let minimum = Infinity, largest = -Infinity, samples = 0;
  for (let y = low; y < high + 1e-8; y += .002) for (let angle = start; angle <= end; angle += 3) {
    const skin = hit(head, y, angle), hair = hit(cap, y, angle);
    expect(skin, `head y=${y} angle=${angle}`).toBeDefined();
    expect(hair, `cap y=${y} angle=${angle}`).toBeDefined();
    const separation = skin.distance - hair.distance;
    expect(separation, `clearance y=${y} angle=${angle}`).toBeGreaterThan(clearance);
    expect(separation, `excess y=${y} angle=${angle}`).toBeLessThan(maximum);
    expect(hair.normal.dot(hair.outward)).toBeGreaterThan(0);
    minimum = Math.min(minimum, separation); largest = Math.max(largest, separation); samples++;
  }
  return { minimum, maximum: largest, samples };
}

function intersections(head: THREE.Triangle[], cap: THREE.Triangle[], low = .052, high = .134, rearOnly = true) {
  const points: THREE.Vector3[] = [];
  const box = (t: THREE.Triangle) => new THREE.Box3().setFromPoints([t.a, t.b, t.c]);
  const skin = head.map(t => ({ t, box: box(t) }));
  for (const a of cap) {
    const bounds = box(a);
    for (const { t: b, box: bb } of skin) {
      if (!bounds.intersectsBox(bb)) continue;
      for (const [source, target] of [[a, b], [b, a]]) {
        const vertices = [source.a, source.b, source.c];
        for (let i = 0; i < 3; i++) {
          const p = vertices[i], delta = vertices[(i + 1) % 3].clone().sub(p), length = delta.length();
          const point = new THREE.Ray(p, delta.normalize()).intersectTriangle(target.a, target.b, target.c, false, new THREE.Vector3());
          if (point && p.distanceTo(point) <= length + 1e-10) points.push(point);
        }
      }
    }
  }
  return points.filter(p => p.y >= low && p.y <= high && (!rearOnly || Math.abs(THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z))) >= 120));
}

function fitted(face: number, buzz = false, undercut = false, covered = false, segments = 32) {
  return triangles(hairCapMeshData(covered ? .45 : 1, undercut, segments, faceShape(face), buzz), buzz ? .86 : 1, covered ? -.008 : .004);
}

describe("face-aware scalp contact", () => {
  it("detects the original short oval no-hat ring inside the actual scalp", () => {
    const head = triangles(headMeshData(faceShape(0))), old = triangles(originalCap(), 1, .004);
    const hair = hit(old, .102, 180), skin = hit(head, .102, 180);
    expect(hair.point.z).toBeCloseTo(-.116, 7);
    expect(skin.point.z).toBeCloseTo(-.1233571429, 7);
    expect(skin.distance - hair.distance).toBeCloseTo(-.0073571429, 7);
    expect(hair.normal.dot(hair.outward)).toBeGreaterThan(0);
    expect(intersections(head, old).length).toBeGreaterThan(0);
  });

  it.each(faces)("preserves posterior contact on face %s", face => {
    const head = triangles(headMeshData(faceShape(face))), cap = fitted(face);
    assertCoverage(head, cap, .052, .134, 120, 240, .018);
    assertCoverage(head, fitted(face, false, true), .068, .134, 135, 225, .018);
    assertCoverage(head, fitted(face, true), .052, .094, 150, 210, .018);
    assertCoverage(head, fitted(face, false, false, true), 0, .028, 150, 210);
    expect(intersections(head, cap)).toHaveLength(0);
    expect(intersections(head, triangles(originalCap(), 1, .004)).length).toBeGreaterThan(0);
    expect(intersections(head, triangles(originalCap(1, true), 1, .004)).length).toBeGreaterThan(0);
    expect(intersections(head, triangles(originalCap(), .86, .004), .068, .16, false).length).toBeGreaterThan(0);
  });

  it.each(faces.flatMap(face => [
    { profile: "ordinary", buzz: false, undercut: false, covered: false },
    { profile: "buzz", buzz: true, undercut: false, covered: false },
    { profile: "undercut", buzz: false, undercut: true, covered: false },
    { profile: "covered", buzz: false, undercut: false, covered: true },
    { profile: "buzz-covered", buzz: true, undercut: false, covered: true },
    { profile: "undercut-covered", buzz: false, undercut: true, covered: true },
  ].map(profile => ({ face, ...profile }))))("encloses upper scalp on face $face with $profile profile", ({ face, buzz, undercut, covered }) => {
    const shape = faceShape(face), head = triangles(headMeshData(shape));
    const cap = fitted(face, buzz, undercut, covered);
    assertCoverage(head, cap, .068, .142 * shape.height - .0001, 0, 357, .018);
    expect(intersections(head, cap, .068, .16, false)).toHaveLength(0);
  });

  it.each(faces)("retains contact after the production head-group scale on face %s", face => {
    const shape = faceShape(face), scale = new THREE.Vector3(shape.width * .93, shape.height * .93, .96);
    const transform = (mesh: THREE.Triangle[]) => mesh.map(t => new THREE.Triangle(t.a.clone().multiply(scale), t.b.clone().multiply(scale), t.c.clone().multiply(scale)));
    const head = transform(triangles(headMeshData(shape)));
    for (const [buzz, undercut] of [[false, false], [true, false], [false, true]]) {
      const cap = transform(fitted(face, buzz, undercut));
      for (const y of [.08, .108, .13, .142 * shape.height - .0001]) assertCoverage(head, cap, y * scale.y, y * scale.y, 0, 357, .018);
    }
  });

  it("replaces tall and buzz crown failures and excess round-face rear gap with fitted contact", () => {
    const head = triangles(headMeshData(faceShape(4)));
    for (const buzz of [false, true]) {
      const old = triangles(originalCap(1, false, 32, true), buzz ? .86 : 1, .004);
      expect(hit(old, .148, 180)).toBeUndefined();
      expect(hit(head, .148, 180)).toBeDefined();
      expect(hit(head, .148, 180).distance - hit(fitted(4, buzz), .148, 180).distance).toBeGreaterThan(clearance);
    }
    const old = triangles(originalCap(1, false, 32, true), 1, .004);
    const round = triangles(headMeshData(faceShape(3)));
    let oldMaximum = 0;
    for (let y = .052; y <= .134001; y += .002) for (let angle = 120; angle <= 240; angle += 3) {
      oldMaximum = Math.max(oldMaximum, hit(round, y, angle).distance - hit(old, y, angle).distance);
    }
    expect(oldMaximum).toBeCloseTo(.05319906083811432, 7);
    expect(hit(round, .134, 180).distance - hit(fitted(3), .134, 180).distance).toBeLessThan(.018);
  });

  it("preserves twelve styles, lower hairline, nape opening and undercut inset", () => {
    expect(HAIR_STYLES).toEqual(["short", "swept", "mohawk", "undercut", "textured", "side-part", "slick", "curly", "bob", "long", "bun", "buzz"]);
    for (const style of HAIR_STYLES) {
      expect(hairCoverage(style).crownScale).toBe(1);
      expect(hairCoverage(style, "cap")).toMatchObject({ covered: true, crownScale: .45, showLocks: false, showBun: false, keepSideLengths: true });
    }
    for (const face of faces) for (const crown of [1, .45]) for (const undercut of [false, true]) {
      const current = hairCapMeshData(crown, undercut, 32, faceShape(face));
      expect(current.positions.slice(0, 2 * 33 * 3)).toEqual(originalCap(crown, undercut).positions.slice(0, 2 * 33 * 3));
      const head = triangles(headMeshData(faceShape(face)));
      expect(hit(fitted(face), -.08, 180)).toBeUndefined();
      expect(hit(fitted(face), 0, 0).distance).toBeGreaterThan(hit(head, 0, 0).distance);
      expect(hit(fitted(face, false, true), .02, 90).distance).toBeCloseTo(hit(triangles(originalCap(1, true), 1, .004), .02, 90).distance, 7);
      if (face === 0) expect(hit(fitted(face, false, true), .02, 90).distance).toBeGreaterThan(hit(head, .02, 90).distance);
    }
  });

  it.each([24, 32, 48])("closes the crown with bounded outward nondegenerate triangles and monotone rings at %s segments", segments => {
    for (const face of faces) for (const buzz of [false, true]) for (const crown of [1, .45]) {
      const data = hairCapMeshData(crown, false, segments, faceShape(face), buzz);
      const mesh = triangles(data, buzz ? .86 : 1, crown < 1 ? -.008 : .004);
      expect(data.positions).toHaveLength((8 * (segments + 1) + 1) * 3);
      expect(data.indices).toHaveLength(segments * 45);
      expect(data.positions.every(Number.isFinite)).toBe(true);
      for (const triangle of mesh) {
        expect(triangle.getArea()).toBeGreaterThan(1e-10);
        const center = triangle.getMidpoint(new THREE.Vector3()), normal = triangle.getNormal(new THREE.Vector3());
        expect(normal.dot(new THREE.Vector3(center.x, Math.max(0, center.y - .05), center.z + .012))).toBeGreaterThan(0);
        expect(Math.abs(center.x)).toBeLessThan(.14);
        expect(Math.abs(center.z)).toBeLessThan(.15);
        expect(center.y).toBeLessThan(.16);
      }
      for (let row = 1; row < 8; row++) for (let col = 0; col <= segments; col++) {
        expect(data.positions[(row * (segments + 1) + col) * 3 + 1]).toBeGreaterThan(data.positions[((row - 1) * (segments + 1) + col) * 3 + 1]);
      }
      const edges = new Map<string, { count: number; y: number }>();
      const key = (p: THREE.Vector3) => p.toArray().map(n => (Math.abs(n) < .0000005 ? 0 : n).toFixed(6)).join(",");
      for (const t of mesh) for (const [a, b] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
        const id = [key(a), key(b)].sort().join("/");
        const entry = edges.get(id) ?? { count: 0, y: Math.max(a.y, b.y) }; entry.count++; edges.set(id, entry);
      }
      const boundary = [...edges.values()].filter(e => e.count === 1);
      expect(boundary).toHaveLength(segments);
      expect(boundary.every(e => e.y < 0)).toBe(true);
      expect([...edges.values()].every(e => e.count <= 2)).toBe(true);
      const ray = new THREE.Ray(new THREE.Vector3(0, .3, -.012), new THREE.Vector3(0, -1, 0));
      const hits = mesh.flatMap(t => { const p = ray.intersectTriangle(t.a, t.b, t.c, true, new THREE.Vector3()); return p ? [p] : []; });
      expect(hits.length).toBeGreaterThan(0);
      expect(Math.max(...hits.map(p => p.y))).toBeGreaterThan(.142 * faceShape(face).height);
    }
  });
});
