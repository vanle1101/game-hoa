import { Color, Euler, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import type { CosmeticSlot } from "../../character/types";
import { bodyShape, taperMeshData, type SculptedMeshData } from "../world/character-shape";
import { WEARABLE_SHAPES, shellMeshData, silhouetteWidth, type WearableColorRole, type WearablePart } from "../world/wearable-shapes";

type Point = readonly [number, number, number];
type Face = readonly [number, number, number];
type ArtworkSurface = Readonly<{ outline: string; shades: readonly string[]; role: WearableColorRole }>;
export type GarmentDrawing = Readonly<{ surfaces: readonly ArtworkSurface[]; bounds: readonly [number, number, number, number]; triangles: number; rear: boolean }>;
const BODY = bodyShape("balanced", "neutral");
const SHADE_LEVELS = [.64, .79, .94, 1.08] as const;
const LIGHT = new Vector3(-.45, .7, 1).normalize();
const drawings = new Map<string, GarmentDrawing>();
const EMPTY: GarmentDrawing = Object.freeze({ surfaces: Object.freeze([]), bounds: [0, 0, 1, 1] as const, triangles: 0, rear: false });

function meshData(geometry: BufferGeometry): SculptedMeshData {
  try {
    const position = geometry.getAttribute("position");
    return { positions: Array.from(position.array), indices: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, i) => i) };
  } finally {
    geometry.dispose();
  }
}

let primitives: Record<"box" | "ellipsoid" | "ring", SculptedMeshData> | undefined;
function primitive(kind: "box" | "ellipsoid" | "ring") {
  primitives ??= {
    box: meshData(new RoundedBoxGeometry(1, 1, 1, 1, .16)),
    ellipsoid: meshData(new SphereGeometry(1, 16, 10)),
    ring: meshData(new TorusGeometry(1, .14, 6, 24)),
  };
  return primitives[kind];
}

export function projectGarmentPart(part: WearablePart): SculptedMeshData {
  const width = part.anchor === "torso" ? silhouetteWidth(part.at[1], BODY) : 1;
  const limb = part.anchor.endsWith("Arm") || part.anchor.endsWith("Thigh") ? BODY.limb : 1;
  const size = new Vector3(part.size[0] * width * limb, part.size[1], part.size[2] * limb);
  const shell = part.kind === "shell";
  const data = part.kind === "shell"
    ? shellMeshData(part.sections ?? [], part.opening, BODY, 24)
    : part.kind === "taper" ? taperMeshData(size.x, size.z, size.y, 1, 16) : primitive(part.kind);
  const transform = shell ? new Matrix4() : new Matrix4().compose(
    new Vector3(part.at[0] * width, part.at[1], part.at[2]),
    new Quaternion().setFromEuler(new Euler(...(part.rotation ?? [0, 0, 0]))),
    part.kind === "taper" ? new Vector3(1, 1, 1) : size,
  );
  const side = part.anchor.startsWith("left") ? -1 : 1;
  const anchor = new Matrix4();
  if (part.anchor === "head") anchor.compose(new Vector3(0, 1.662, .006), new Quaternion(), new Vector3(.93, .93, .96));
  else if (part.anchor.endsWith("Arm")) anchor.makeTranslation(side * .216 * BODY.shoulder, 1.425, -.004);
  else if (part.anchor.endsWith("Thigh")) anchor.makeTranslation(side * .102 * BODY.hip, .958, 0);
  else if (part.anchor.endsWith("Shin")) anchor.makeTranslation(side * .102 * BODY.hip, .958 - .393, 0);
  transform.premultiply(anchor).premultiply(new Matrix4().makeScale(BODY.width, BODY.height, BODY.depth));
  const positions: number[] = [], vertex = new Vector3();
  for (let i = 0; i < data.positions.length; i += 3) {
    vertex.fromArray(data.positions, i).applyMatrix4(transform);
    positions.push(vertex.x, vertex.y, vertex.z);
  }
  return { positions, indices: data.indices };
}

function boundaries(faces: readonly Face[], points: readonly Point[], coordinate: (value: number, axis: 0 | 1) => string): string {
  const edges = new Map<string, readonly [number, number]>();
  for (const face of faces) {
    for (let i = 0; i < 3; i++) {
      const a = face[i], b = face[(i + 1) % 3], reverse = `${b}:${a}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${a}:${b}`, [a, b]);
    }
  }
  const outgoing = new Map<number, number[]>();
  for (const [a, b] of edges.values()) {
    const list = outgoing.get(a) ?? [];
    list.push(b); outgoing.set(a, list);
  }
  const point = (i: number) => `${coordinate(points[i][0], 0)} ${coordinate(points[i][1], 1)}`;
  const paths: string[] = [];
  for (const [start, targets] of outgoing) {
    while (targets.length) {
      let next = start;
      const loop: number[] = [];
      do {
        loop.push(next);
        const candidate = outgoing.get(next)?.pop();
        if (candidate === undefined) break;
        next = candidate;
      } while (next !== start && loop.length <= edges.size);
      if (loop.length >= 3) paths.push(`M${point(loop[0])}${loop.slice(1).map(i => `L${point(i)}`).join("")}Z`);
    }
  }
  return paths.join("");
}

export function garmentDrawing(model: string, slot: CosmeticSlot): GarmentDrawing {
  if (!Object.hasOwn(WEARABLE_SHAPES, model)) return EMPTY;
  const rear = slot === "back";
  const key = `${model}:${rear ? "rear" : "front"}`;
  const cached = drawings.get(key);
  if (cached) return cached;
  const shape = WEARABLE_SHAPES[model];
  const sideRings = shape.parts.every(part => part.kind === "ring" && Math.abs(part.rotation?.[1] ?? 0) > 1);
  const yaw = (rear ? Math.PI : 0) + (sideRings ? 1.15 : .26);
  const pitch = shape.layer === "shoes" ? .32 : .18;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, triangles = 0;
  const meshes = shape.parts.flatMap(part => {
    const data = projectGarmentPart(part), points: Point[] = [], remap: number[] = [], welded = new Map<string, number>();
    for (let i = 0; i < data.positions.length; i += 3) {
      const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
      const depth = sy * x + cy * z;
      const point: Point = [cy * x - sy * z, -(cp * y - sp * depth), sp * y + cp * depth];
      const identity = point.map(v => v.toFixed(7)).join(":");
      let index = welded.get(identity);
      if (index === undefined) { index = points.length; points.push(point); welded.set(identity, index); }
      remap.push(index);
      minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
    }
    const front: Face[] = [], back: Face[] = [];
    for (let i = 0; i < data.indices.length; i += 3) {
      const face: Face = [remap[data.indices[i]], remap[data.indices[i + 1]], remap[data.indices[i + 2]]];
      const [a, b, c] = face.map(index => points[index]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-12) continue;
      if (area < 0) front.push(face);
      else if (part.kind === "shell") back.push([face[2], face[1], face[0]]);
    }
    const depth = points.reduce((sum, p) => sum + p[2], 0) / points.length;
    return [back, front].filter(faces => faces.length).map((faces, index) => {
      triangles += faces.length;
      const shades: Face[][] = SHADE_LEVELS.map(() => []);
      for (const face of faces) {
        const [a, b, c] = face.map(i => points[i]);
        const u = new Vector3(b[0] - a[0], a[1] - b[1], b[2] - a[2]);
        const v = new Vector3(c[0] - a[0], a[1] - c[1], c[2] - a[2]);
        const light = Math.max(0, u.cross(v).normalize().dot(LIGHT));
        shades[Math.min(3, Math.floor(light * 4))].push(face);
      }
      return { points, faces, shades, role: part.colorRole, depth: depth + index * 1e-8 };
    });
  });
  if (!meshes.length) return EMPTY;
  const scale = 80 / Math.max(maxX - minX, maxY - minY, .00001);
  const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  const coordinate = (v: number, axis: 0 | 1) => (48 + (v - center[axis]) * scale).toFixed(2);
  const surfaces = meshes.sort((a, b) => a.depth - b.depth).map(mesh => Object.freeze({
    outline: boundaries(mesh.faces, mesh.points, coordinate),
    shades: Object.freeze(mesh.shades.map(faces => boundaries(faces, mesh.points, coordinate))),
    role: mesh.role,
  }));
  const drawing: GarmentDrawing = Object.freeze({ surfaces: Object.freeze(surfaces), bounds: Object.freeze([minX, minY, maxX, maxY] as const), triangles, rear });
  drawings.set(key, drawing);
  return drawing;
}

function palette(color: string | undefined, layer: string | undefined) {
  const safe = color && /^#[\da-f]{6}$/i.test(color) ? color : "#72d3dc";
  const base = new Color(safe), primary = base.clone();
  const hsl = base.getHSL({ h: 0, s: 0, l: 0 });
  if ((layer === "top" || layer === "outerwear") && hsl.s > .55 && hsl.l > .46) {
    primary.setHSL(hsl.h, Math.min(.52, hsl.s * .68), Math.min(.44, hsl.l * .74));
  }
  const colors: Record<WearableColorRole, Color> = {
    primary,
    secondary: primary.clone().lerp(new Color("#182232"), .62),
    trim: primary.clone().lerp(new Color("#b6c6d4"), .72),
    glow: base,
  };
  return Object.fromEntries(Object.entries(colors).map(([role, base]) => [role, SHADE_LEVELS.map(level => `#${base.clone().multiplyScalar(level).getHexString()}`)])) as Record<WearableColorRole, string[]>;
}

export function GarmentArtwork({ model, slot, color }: { model: string; slot: CosmeticSlot; color?: string }) {
  const drawing = garmentDrawing(model, slot);
  const colors = palette(color, Object.hasOwn(WEARABLE_SHAPES, model) ? WEARABLE_SHAPES[model].layer : undefined);
  return <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" className="studio-thumbnail" data-garment-view={drawing.rear ? "rear" : "front"}>
    {drawing.surfaces.map((surface, index) => <g key={index}>
      <path d={surface.outline} fill={colors[surface.role][1]} />
      {surface.shades.map((d, shade) => d ? <path key={shade} d={d} fill={colors[surface.role][shade]} /> : null)}
      <path d={surface.outline} fill="none" stroke="#15232e" strokeOpacity=".45" strokeWidth=".28" strokeLinejoin="round" />
    </g>)}
  </svg>;
}

export default GarmentArtwork;
