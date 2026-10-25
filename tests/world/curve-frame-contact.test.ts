import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CURVED_GLASS_CATALOG } from "../../src/construction/catalog";
import { createCurve, curveBounds, CURVE_PROFILE_LIMITS, isValidCurveProfile } from "../../src/construction/curves";
import type { CurvedGlassSegment } from "../../src/construction/types";
import { curveFrameGeometry, curveGeometry } from "../../src/components/construction/render-geometry";

type Point2 = { x: number; y: number };
type Triangle = { points: THREE.Vector3[]; normal: THREE.Vector3; area: number; bounds: THREE.Box3 };
const epsilon = 1e-6;
const pointKey = (p: THREE.Vector3) => `${p.x},${p.y},${p.z}`;
const triangleKey = (triangle: Triangle) => triangle.points.map(pointKey).sort().join(";");

function triangles(geometry: THREE.BufferGeometry): Triangle[] {
  const position = geometry.getAttribute("position"), index = geometry.getIndex();
  return Array.from({ length: (index?.count ?? position.count) / 3 }, (_, i) => {
    const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i * 3 + j) : i * 3 + j));
    const cross = new THREE.Vector3().subVectors(points[1], points[0]).cross(new THREE.Vector3().subVectors(points[2], points[0]));
    return { points, normal: cross.clone().normalize(), area: cross.length() / 2, bounds: new THREE.Box3().setFromPoints(points) };
  });
}

const cross2 = (a: Point2, b: Point2, c: Point2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersectionArea(subject: Point2[], clip: Point2[]): number {
  let polygon = subject;
  const orientation = Math.sign(cross2(clip[0], clip[1], clip[2]));
  for (let i = 0; i < clip.length && polygon.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], output: Point2[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j + 1) % polygon.length];
      const dp = orientation * cross2(a, b, p), dq = orientation * cross2(a, b, q);
      if (dp >= 0) output.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        output.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      }
    }
    polygon = output;
  }
  return Math.abs(polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return sum + p.x * q.y - p.y * q.x;
  }, 0)) / 2;
}

function overlapVolume(a: Triangle[], b: Triangle[]): number {
  if (!a.length || !b.length) return 0;
  const range = (mesh: Triangle[]) => [Math.min(...mesh.map(t => t.bounds.min.y)), Math.max(...mesh.map(t => t.bounds.max.y))];
  const [aMin, aMax] = range(a), [bMin, bMax] = range(b);
  const height = Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
  if (!height) return 0;
  const bottom = (mesh: Triangle[]) => mesh.filter(t => t.normal.y < -1 + epsilon);
  let area = 0;
  for (const p of bottom(a)) for (const q of bottom(b)) {
    if (p.bounds.max.x < q.bounds.min.x || p.bounds.min.x > q.bounds.max.x || p.bounds.max.z < q.bounds.min.z || p.bounds.min.z > q.bounds.max.z) continue;
    area += intersectionArea(p.points.map(v => ({ x: v.x, y: v.z })), q.points.map(v => ({ x: v.x, y: v.z })));
  }
  return area * height;
}

function exposedCoplanarArea(a: Triangle[], b: Triangle[]): number {
  let area = 0;
  for (const p of a) for (const q of b) {
    if (!p.bounds.intersectsBox(q.bounds) || p.normal.dot(q.normal) < 1 - 1e-8) continue;
    if (q.points.some(v => Math.abs(p.normal.dot(v.clone().sub(p.points[0]))) > 1e-8)) continue;
    const normal = p.normal.clone().set(Math.abs(p.normal.x), Math.abs(p.normal.y), Math.abs(p.normal.z));
    const axis = normal.x >= normal.y && normal.x >= normal.z ? "x" : normal.y >= normal.z ? "y" : "z";
    const project = (v: THREE.Vector3): Point2 => axis === "x" ? { x: v.y, y: v.z } : axis === "y" ? { x: v.x, y: v.z } : { x: v.x, y: v.y };
    area += intersectionArea(p.points.map(project), q.points.map(project)) / normal[axis];
  }
  return area;
}

function assertSolid(geometry: THREE.BufferGeometry, mesh: Triangle[], curve: CurvedGlassSegment) {
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  expect(normal.count).toBe(position.count);
  expect([...position.array, ...normal.array].every(Number.isFinite)).toBe(true);
  const bounds = curveBounds({ ...curve, x: 0, z: 0 });
  const edges = new Map<string, { count: number; balance: number }>();
  let volume = 0, minimumArea = Infinity, normalError = 0, windingDot = 1, withinBounds = true, withinRadii = true;
  for (let i = 0; i < mesh.length; i++) {
    const triangle = mesh[i];
    minimumArea = Math.min(minimumArea, triangle.area);
    volume += triangle.points[0].dot(triangle.points[1].clone().cross(triangle.points[2])) / 6;
    for (let j = 0; j < 3; j++) {
      const p = triangle.points[j], n = new THREE.Vector3().fromBufferAttribute(normal, i * 3 + j);
      normalError = Math.max(normalError, Math.abs(n.length() - 1));
      windingDot = Math.min(windingDot, n.dot(triangle.normal));
      withinBounds &&= p.x >= bounds.minX - epsilon && p.x <= bounds.maxX + epsilon && p.z >= bounds.minZ - epsilon && p.z <= bounds.maxZ + epsilon && p.y >= -epsilon && p.y <= curve.height + epsilon;
      withinRadii &&= Math.abs(Math.hypot(p.x, p.z) - curve.radius) <= curve.thickness / 2 + epsilon;
      const a = pointKey(p), b = pointKey(triangle.points[(j + 1) % 3]), key = [a, b].sort().join(";");
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  expect({ withinBounds, withinRadii }).toEqual({ withinBounds: true, withinRadii: true });
  expect(minimumArea).toBeGreaterThan(0);
  expect(normalError).toBeLessThan(1e-6);
  expect(windingDot).toBeGreaterThan(1 - 1e-6);
  expect([...edges.values()].every(edge => edge.count === 2 && edge.balance === 0)).toBe(true);
  expect(volume).toBeGreaterThan(0);
}

function assertContact(pane: Triangle[], frame: Triangle[], onPlane: (p: THREE.Vector3) => boolean, planeNormal?: THREE.Vector3) {
  const contactFace = (t: Triangle) => t.points.every(onPlane) && (!planeNormal || Math.abs(t.normal.dot(planeNormal)) > 1 - epsilon);
  const paneContact = pane.filter(contactFace);
  const frameContact = new Map(frame.filter(contactFace).map(t => [triangleKey(t), t]));
  expect(paneContact.length).toBeGreaterThan(0);
  expect(paneContact.every(t => {
    const match = frameContact.get(triangleKey(t));
    return match && t.normal.dot(match.normal) < -1 + epsilon;
  })).toBe(true);
  expect(paneContact.reduce((sum, t) => sum + t.area, 0)).toBeGreaterThan(0);
}

const presets = CURVED_GLASS_CATALOG.map(item => createCurve(item.id, { x: 3, z: -2, level: 1 }, item.id));
const extremes = [CURVE_PROFILE_LIMITS.radius.min, CURVE_PROFILE_LIMITS.radius.max].flatMap(radius =>
  [CURVE_PROFILE_LIMITS.angle.min, CURVE_PROFILE_LIMITS.angle.max].flatMap(angle =>
    [CURVE_PROFILE_LIMITS.thickness.min, CURVE_PROFILE_LIMITS.thickness.max].flatMap(thickness =>
      [CURVE_PROFILE_LIMITS.height.min, CURVE_PROFILE_LIMITS.height.max].map(height => ({ ...presets[0], id: `custom-${radius}-${angle}-${thickness}-${height}`, radius, angle, thickness, height })))));
const nearClosure = [.22231, .22233, .2224].map(thickness => ({ ...presets[0], id: `near-closure-${thickness}`, radius: .5, angle: 15, thickness, height: .5 }));
const precisionBoundary = [1 - 1e-6, 1, 1 + 1e-6].map(factor => ({
  ...presets[0], id: `precision-boundary-${factor}`, radius: .5, angle: 15, height: .5,
  thickness: 2 * (.16 / (Math.PI / 12 - factor * 32 * 2 ** -23) - .5),
}));
const profiles = [...presets, ...extremes, ...nearClosure, ...precisionBoundary];

describe("curved pane and frame triangle contact", () => {
  it.each(profiles)("partitions the aperture without overlaps or seams for $id", profile => {
    expect(isValidCurveProfile(profile)).toBe(true);
    for (const rotation of [0, 15, 30, 45, 90, 165, 345]) {
      const curve = { ...profile, rotation }, snapshot = structuredClone(curve);
      const paneGeometry = curveGeometry(curve), frameGeometries = curveFrameGeometry(curve);
      const geometries = [paneGeometry, ...frameGeometries];
      try {
        const pane = triangles(paneGeometry), frames = frameGeometries.map(triangles);
        const sweep = THREE.MathUtils.degToRad(curve.angle), start = THREE.MathUtils.degToRad(rotation);
        const rail = Math.min(.08, curve.height / 3), cap = Math.min(sweep / 2, .08 / (curve.radius + curve.thickness / 2));
        expect(frameGeometries).toHaveLength(4);
        frames.forEach((frame, i) => assertSolid(frameGeometries[i], frame, curve));
        const expectedY = [[0, rail], [curve.height - rail, curve.height], [rail, curve.height - rail], [rail, curve.height - rail]];
        frameGeometries.forEach((geometry, i) => {
          geometry.computeBoundingBox();
          expect(geometry.boundingBox!.min.y).toBeCloseTo(expectedY[i][0], 6);
          expect(geometry.boundingBox!.max.y).toBeCloseTo(expectedY[i][1], 6);
        });
        const actualCap = sweep - 2 * cap <= 32 * 2 ** -23 ? sweep / 2 : cap;
        const expectedAngles = [[start, start + sweep], [start, start + sweep], [start, start + actualCap], [start + (sweep - actualCap), start + sweep]];
        frames.forEach((frame, i) => {
          const vertices = new Set(frame.flatMap(t => t.points.map(pointKey)));
          for (const angle of expectedAngles[i]) for (const radius of [curve.radius - curve.thickness / 2, curve.radius + curve.thickness / 2]) for (const y of expectedY[i]) {
            expect(vertices.has(pointKey(new THREE.Vector3(Math.fround(radius * Math.cos(angle)), Math.fround(y), Math.fround(radius * Math.sin(angle)))))).toBe(true);
          }
        });
        const angleDistance = (p: THREE.Vector3, angle: number) => p.z * Math.cos(angle) - p.x * Math.sin(angle);
        for (const frame of frames) {
          expect(overlapVolume(pane, frame)).toBeLessThan(1e-10);
          expect(exposedCoplanarArea(pane, frame)).toBeLessThan(1e-10);
        }
        if (sweep - 2 * cap <= 32 * 2 ** -23) {
          expect(pane).toHaveLength(0);
          expect(paneGeometry.getAttribute("normal").count).toBe(0);
          paneGeometry.computeBoundingSphere();
          expect(paneGeometry.boundingSphere!.radius).toBe(0);
          expect(curve).toEqual(snapshot);
          continue;
        }
        assertSolid(paneGeometry, pane, curve);
        paneGeometry.computeBoundingBox();
        expect(paneGeometry.boundingBox!.min.y).toBe(Math.fround(rail));
        expect(paneGeometry.boundingBox!.max.y).toBe(Math.fround(curve.height - rail));
        expect(pane.every(t => t.points.every(p => angleDistance(p, start + cap) >= -epsilon && angleDistance(p, start + sweep - cap) <= epsilon))).toBe(true);
        assertContact(pane, frames[0], p => p.y === Math.fround(rail));
        assertContact(pane, frames[1], p => p.y === Math.fround(curve.height - rail));
        const tangent = (angle: number) => new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
        assertContact(pane, frames[2], p => Math.abs(angleDistance(p, start + cap)) < epsilon, tangent(start + cap));
        assertContact(pane, frames[3], p => Math.abs(angleDistance(p, start + sweep - cap)) < epsilon, tangent(start + sweep - cap));
        expect(curve).toEqual(snapshot);
      } finally {
        geometries.forEach(geometry => geometry.dispose());
      }
    }
  });

  it("detects deliberately overlapping solids, exposed duplicates, detached contacts and flipped winding", () => {
    const curve = presets[0];
    const pane = curveGeometry(curve), frames = curveFrameGeometry(curve);
    const overlapping = pane.clone().translate(0, -.001, 0), detached = pane.clone().translate(0, .001, 0), flipped = pane.clone();
    const geometries = [pane, ...frames, overlapping, detached, flipped];
    try {
      const paneTriangles = triangles(pane), bottom = triangles(frames[0]);
      expect(overlapVolume(triangles(overlapping), bottom)).toBeGreaterThan(1e-5);
      expect(exposedCoplanarArea(paneTriangles, paneTriangles)).toBeGreaterThan(.01);
      expect(() => assertContact(triangles(detached), bottom, p => p.y === Math.fround(.08))).toThrow();
      const position = flipped.getAttribute("position"), a = new THREE.Vector3().fromBufferAttribute(position, 0), b = new THREE.Vector3().fromBufferAttribute(position, 1);
      position.setXYZ(0, b.x, b.y, b.z); position.setXYZ(1, a.x, a.y, a.z);
      expect(() => assertSolid(flipped, triangles(flipped), curve)).toThrow();
    } finally {
      geometries.forEach(geometry => geometry.dispose());
    }
  });
});
