import { buildingItem } from "./catalog";
import { CURVE_FRAMES, CURVE_MATERIALS, type CurveProfile, type CurvedGlassSegment, type GridPoint } from "./types";

export const CURVE_PROFILE_LIMITS = Object.freeze({
  radius: { min: 0.5, max: 4 },
  angle: { min: 15, max: 180, step: 15 },
  height: { min: 0.5, max: 2.8 },
  thickness: { min: 0.06, max: 0.3 },
});
export { CURVE_FRAMES, CURVE_MATERIALS } from "./types";
export function isValidCurveProfile(profile: CurveProfile): boolean {
  return (["radius", "angle", "height", "thickness"] as const).every(key => Number.isFinite(profile[key]) && profile[key] >= CURVE_PROFILE_LIMITS[key].min && profile[key] <= CURVE_PROFILE_LIMITS[key].max)
    && profile.angle % CURVE_PROFILE_LIMITS.angle.step === 0
    && CURVE_MATERIALS.some(material => material === profile.material) && CURVE_FRAMES.some(frame => frame === profile.frame);
}
export function snapCurveAngle(angle: number): number {
  if (!Number.isFinite(angle)) throw new Error("Invalid curved-glass angle.");
  return Math.max(CURVE_PROFILE_LIMITS.angle.min, Math.min(CURVE_PROFILE_LIMITS.angle.max, Math.round(angle / CURVE_PROFILE_LIMITS.angle.step) * CURVE_PROFILE_LIMITS.angle.step));
}
export function customizeCurve(curve: CurvedGlassSegment, patch: Partial<CurveProfile>): CurvedGlassSegment {
  const profile = { ...curve, ...patch, angle: snapCurveAngle(patch.angle ?? curve.angle) };
  if (!isValidCurveProfile(profile)) throw new Error("Invalid curved-glass profile.");
  return profile;
}
export function curveProfileSignature(profile: CurveProfile): string {
  return JSON.stringify([profile.radius, profile.angle, profile.height, profile.thickness, profile.material, profile.frame]);
}
export function curvePrice(catalogId: string, profile: CurveProfile): number {
  const definition = buildingItem(catalogId);
  if (!definition?.curve || !isValidCurveProfile(profile)) throw new Error("Invalid curved-glass profile or archetype.");
  const base = definition.curve;
  if (profile.radius === base.radius && profile.angle === base.angle && profile.height === base.height && profile.thickness === base.thickness) return definition.price;
  const ratio = (profile.radius / base.radius) * (profile.angle / base.angle) * (profile.height / base.height) * (profile.thickness / base.thickness);
  const amount = definition.price * ratio;
  const nearest = Math.round(amount);
  return Math.max(1, Math.abs(amount - nearest) <= Number.EPSILON * Math.max(1, amount) * 8 ? nearest : Math.ceil(amount));
}

export type CurvePoint = { x: number; z: number };
export type CurveBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
const EPS = 1e-8;
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (angle: number) => angle * 180 / Math.PI;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;
export const snapCurveRotation = (rotation: number): number => normalize(Math.round(rotation / 15) * 15);
export function createCurve(catalogId: string, point: GridPoint, id: string, rotation = 0): CurvedGlassSegment {
  const definition = buildingItem(catalogId);
  if (!definition?.curve) throw new Error("Choose a valid curved-glass archetype.");
  return { ...point, id, catalogId, rotation: snapCurveRotation(rotation), ...definition.curve };
}
export function curvePoint(curve: CurvedGlassSegment, angle: number, radius = curve.radius): CurvePoint {
  const t = radians(angle);
  return { x: curve.x + radius * Math.cos(t), z: curve.z + radius * Math.sin(t) };
}
function withinAngle(curve: CurvedGlassSegment, point: CurvePoint): boolean {
  const relative = normalize(degrees(Math.atan2(point.z - curve.z, point.x - curve.x)) - curve.rotation);
  return relative <= curve.angle + EPS || relative >= 360 - EPS;
}
export function curveContainsPoint(curve: CurvedGlassSegment, point: CurvePoint): boolean {
  const distance = Math.hypot(point.x - curve.x, point.z - curve.z);
  return distance >= curve.radius - curve.thickness / 2 - EPS && distance <= curve.radius + curve.thickness / 2 + EPS && withinAngle(curve, point);
}
export function curveBounds(curve: CurvedGlassSegment): CurveBounds {
  const angles = [curve.rotation, curve.rotation + curve.angle];
  for (const angle of [0, 90, 180, 270]) if (withinAngle(curve, curvePoint(curve, angle))) angles.push(angle);
  const points = angles.flatMap(angle => [curvePoint(curve, angle, curve.radius - curve.thickness / 2), curvePoint(curve, angle, curve.radius + curve.thickness / 2)]);
  return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) };
}
function cross(a: CurvePoint, b: CurvePoint, c: CurvePoint): number { return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x); }
function onSegment(a: CurvePoint, b: CurvePoint, p: CurvePoint): boolean { return Math.abs(cross(a, b, p)) <= EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS && p.z >= Math.min(a.z, b.z) - EPS && p.z <= Math.max(a.z, b.z) + EPS; }
function segmentsIntersect(a: CurvePoint, b: CurvePoint, c: CurvePoint, d: CurvePoint): boolean {
  return (cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function radialEdges(curve: CurvedGlassSegment): [CurvePoint, CurvePoint][] { return [curve.rotation, curve.rotation + curve.angle].map(angle => [curvePoint(curve, angle, curve.radius - curve.thickness / 2), curvePoint(curve, angle, curve.radius + curve.thickness / 2)]); }
export function curveIntersectsSegment(curve: CurvedGlassSegment, a: CurvePoint, b: CurvePoint): boolean {
  if (curveContainsPoint(curve, a) || curveContainsPoint(curve, b)) return true;
  if (radialEdges(curve).some(([c, d]) => segmentsIntersect(a, b, c, d))) return true;
  const dx = b.x - a.x, dz = b.z - a.z, ox = a.x - curve.x, oz = a.z - curve.z;
  const A = dx * dx + dz * dz;
  if (A < EPS) return false;
  const B = 2 * (ox * dx + oz * dz);
  for (const radius of [curve.radius - curve.thickness / 2, curve.radius + curve.thickness / 2]) {
    const C = ox * ox + oz * oz - radius * radius, discriminant = B * B - 4 * A * C;
    if (discriminant < -EPS) continue;
    const root = Math.sqrt(Math.max(0, discriminant));
    for (const t of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) if (t >= -EPS && t <= 1 + EPS && withinAngle(curve, { x: a.x + t * dx, z: a.z + t * dz })) return true;
  }
  return false;
}
export function curveIntersectsRect(curve: CurvedGlassSegment, rect: CurveBounds): boolean {
  const bounds = curveBounds(curve);
  if (bounds.maxX < rect.minX - EPS || bounds.minX > rect.maxX + EPS || bounds.maxZ < rect.minZ - EPS || bounds.minZ > rect.maxZ + EPS) return false;
  const corners = [{ x: rect.minX, z: rect.minZ }, { x: rect.maxX, z: rect.minZ }, { x: rect.maxX, z: rect.maxZ }, { x: rect.minX, z: rect.maxZ }];
  if (corners.some(p => curveContainsPoint(curve, p))) return true;
  if (corners.some((p, i) => curveIntersectsSegment(curve, p, corners[(i + 1) % 4]))) return true;
  const p = curvePoint(curve, curve.rotation);
  return p.x >= rect.minX - EPS && p.x <= rect.maxX + EPS && p.z >= rect.minZ - EPS && p.z <= rect.maxZ + EPS;
}
export function curveFootprint(curve: CurvedGlassSegment): GridPoint[] {
  const bounds = curveBounds(curve), cells: GridPoint[] = [];
  for (let x = Math.floor(bounds.minX); x < Math.ceil(bounds.maxX); x++) for (let z = Math.floor(bounds.minZ); z < Math.ceil(bounds.maxZ); z++) {
    if (curveIntersectsRect(curve, { minX: x + EPS * 10, maxX: x + 1 - EPS * 10, minZ: z + EPS * 10, maxZ: z + 1 - EPS * 10 })) cells.push({ x, z, level: curve.level });
  }
  return cells;
}
function circlesIntersect(a: CurvePoint, ra: number, b: CurvePoint, rb: number): CurvePoint[] {
  const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz);
  if (distance < EPS || distance > ra + rb + EPS || distance < Math.abs(ra - rb) - EPS) return [];
  const along = (ra * ra - rb * rb + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, ra * ra - along * along));
  const x = a.x + along * dx / distance, z = a.z + along * dz / distance;
  return [{ x: x + height * dz / distance, z: z - height * dx / distance }, { x: x - height * dz / distance, z: z + height * dx / distance }];
}
export function curvesIntersect(a: CurvedGlassSegment, b: CurvedGlassSegment): boolean {
  if (a.level !== b.level) return false;
  if (radialEdges(a).some(([start, end]) => curveIntersectsSegment(b, start, end)) || radialEdges(b).some(([start, end]) => curveIntersectsSegment(a, start, end))) return true;
  if (curveContainsPoint(a, curvePoint(b, b.rotation + b.angle / 2)) || curveContainsPoint(b, curvePoint(a, a.rotation + a.angle / 2))) return true;
  for (const ra of [a.radius - a.thickness / 2, a.radius + a.thickness / 2]) for (const rb of [b.radius - b.thickness / 2, b.radius + b.thickness / 2]) {
    if (circlesIntersect(a, ra, b, rb).some(p => withinAngle(a, p) && withinAngle(b, p))) return true;
  }
  return false;
}
