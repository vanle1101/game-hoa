import { DoubleSide, Vector3 } from "three";
import { getFurnitureRecipe, type FurnitureDefinition, type FurniturePart } from "../../furniture/catalog";
import { createFurniturePartGeometry, getFurnitureMaterialProperties } from "../world/furniture-models";

export type ProjectionPoint = readonly [number, number];
export type FurnitureProjectionFace = {
  key: string;
  loops: ProjectionPoint[][];
  depth: number;
  color: string;
  fill: string;
  opacity: number;
  material: FurniturePart["material"];
  surface: FurniturePart["surface"];
  triangles: number;
};
export type FurnitureProjection = {
  faces: (FurnitureProjectionFace & { path: string })[];
  bounds: { min: ProjectionPoint; max: ProjectionPoint };
  scale: number;
};

type Edge = { start: Vector3; end: Vector3; startKey: string; endKey: string };
type Triangle = { vertices: Vector3[]; depth: number; area: number };
type Plane = { normal: Vector3; triangles: Triangle[] };
const view = new Vector3(1, Math.sqrt(2 / 3), 1).normalize();
const light = new Vector3(4, 7, 5).normalize();
const project = (point: Vector3): ProjectionPoint => [(point.x - point.z) / Math.sqrt(2), (point.x + point.z) / Math.sqrt(8) - point.y * Math.sqrt(3 / 4)];
const vertexKey = (point: Vector3) => [point.x, point.y, point.z].map(value => Math.round(value * 1e6)).join(",");

function boundaryLoops(edges: Map<string, Edge>): Vector3[][] | undefined {
  const remaining = new Set(edges.values());
  const outgoing = new Map<string, Edge[]>();
  for (const edge of remaining) {
    const bucket = outgoing.get(edge.startKey) ?? [];
    bucket.push(edge);
    outgoing.set(edge.startKey, bucket);
  }
  const loops: Vector3[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    let edge: Edge | undefined = first;
    const loop: Vector3[] = [];
    let closed = false;
    while (edge && remaining.has(edge)) {
      remaining.delete(edge);
      loop.push(edge.start);
      if (edge.endKey === first.startKey) { closed = true; break; }
      const candidates: Edge[] = outgoing.get(edge.endKey)?.filter(candidate => remaining.has(candidate)) ?? [];
      if (candidates.length !== 1) return undefined;
      edge = candidates[0];
    }
    if (!closed || loop.length < 3) return undefined;
    loops.push(loop);
  }
  return loops;
}

function planePatches(triangles: Triangle[]) {
  const parents = triangles.map((_, index) => index);
  const root = (index: number): number => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  };
  const owners = new Map<string, number>();
  const triangleEdges = triangles.map((triangle, index) => triangle.vertices.map((start, j): Edge => {
    const end = triangle.vertices[(j + 1) % 3], startKey = vertexKey(start), endKey = vertexKey(end);
    const key = startKey < endKey ? `${startKey}:${endKey}` : `${endKey}:${startKey}`;
    const owner = owners.get(key);
    if (owner !== undefined) parents[root(index)] = root(owner);
    else owners.set(key, index);
    return { start, end, startKey, endKey };
  }));
  const components = new Map<number, number[]>();
  triangles.forEach((_, index) => {
    const id = root(index), component = components.get(id) ?? [];
    component.push(index);
    components.set(id, component);
  });
  return [...components.values()].flatMap(indices => {
    const edges = new Map<string, Edge>(), counts = new Map<string, number>();
    let valid = true;
    for (const index of indices) for (const edge of triangleEdges[index]) {
      const key = edge.startKey < edge.endKey ? `${edge.startKey}:${edge.endKey}` : `${edge.endKey}:${edge.startKey}`;
      const count = (counts.get(key) ?? 0) + 1, previous = edges.get(key);
      counts.set(key, count);
      if (edge.startKey === edge.endKey || count > 2 || (previous && previous.startKey !== edge.endKey)) valid = false;
      if (previous) edges.delete(key);
      else edges.set(key, edge);
    }
    const loops = valid ? boundaryLoops(edges) : undefined;
    if (!loops?.length) return indices.map(index => ({ loops: [triangles[index].vertices], depth: triangles[index].depth, triangles: 1 }));
    const area = indices.reduce((sum, index) => sum + triangles[index].area, 0);
    const depth = indices.reduce((sum, index) => sum + triangles[index].depth * triangles[index].area, 0) / area;
    return [{ loops, depth, triangles: indices.length }];
  });
}

export function projectFurniturePart(part: FurniturePart, finish: string): FurnitureProjectionFace[] {
  const geometry = createFurniturePartGeometry(part);
  try {
    const material = getFurnitureMaterialProperties(part, finish, false, false);
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();
    const planes = new Map<string, Plane>();
    const translation = new Vector3(...part.position);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
    for (let i = 0, count = index?.count ?? positions.count; i + 2 < count; i += 3) {
      a.fromBufferAttribute(positions, index ? index.getX(i) : i).add(translation);
      b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).add(translation);
      c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).add(translation);
      const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a));
      const area = normal.length();
      if (!Number.isFinite(area) || area < 1e-12) continue;
      normal.divideScalar(area);
      const facing = normal.dot(view);
      if (Math.abs(facing) < 1e-9 || (material.side !== DoubleSide && facing <= 0)) continue;
      const planeKey = [...normal.toArray(), normal.dot(a)].map(value => Math.round(value * 1e5)).join(",");
      const plane = planes.get(planeKey) ?? { normal: normal.clone().multiplyScalar(facing < 0 ? -1 : 1), triangles: [] };
      plane.triangles.push({ vertices: [a.clone(), b.clone(), c.clone()], depth: (a.dot(view) + b.dot(view) + c.dot(view)) / 3, area });
      planes.set(planeKey, plane);
    }
    return [...planes.values()].flatMap((plane, index) => {
      const shade = Math.min(1.12, .7 + Math.max(0, plane.normal.dot(light)) * .3 + material.emissiveIntensity * .12);
      const color = parseInt(material.color.slice(1), 16);
      const fill = `rgb(${[16, 8, 0].map(shift => Math.min(255, Math.round(((color >> shift) & 255) * shade))).join(",")})`;
      return planePatches(plane.triangles).map((patch, patchIndex) => ({
        key: `${part.id}-${index}-${patchIndex}`, loops: patch.loops.map(loop => loop.map(project)), depth: patch.depth,
        color: material.color, fill, opacity: material.opacity, material: part.material, surface: part.surface, triangles: patch.triangles,
      }));
    });
  } finally {
    geometry.dispose();
  }
}

export function projectFurniture(item: Pick<FurnitureDefinition, "id" | "color">): FurnitureProjection {
  // The catalog LED strip is rendered procedurally in 3D and has no GLB
  // texture to project. Keep a deterministic, high-contrast SVG thumbnail so
  // it remains discoverable in both the shop and construction inventory.
  if (item.id === "wall_led_strip") {
    const faces = [
      {
        key: "wall-led-strip-body",
        loops: [[[20, 38], [80, 38], [80, 54], [20, 54]] as ProjectionPoint[]],
        depth: 0,
        color: item.color,
        fill: "#172331",
        opacity: 1,
        material: "dark" as FurniturePart["material"],
        surface: undefined,
        triangles: 2,
        path: "M20,38L80,38L80,54L20,54Z",
      },
      {
        key: "wall-led-strip-glow",
        loops: [[[22, 42], [78, 42], [78, 47], [22, 47]] as ProjectionPoint[]],
        depth: 1,
        color: item.color,
        fill: item.color,
        opacity: 1,
        material: "glow" as FurniturePart["material"],
        surface: undefined,
        triangles: 2,
        path: "M22,42L78,42L78,47L22,47Z",
      },
    ];
    return { faces, bounds: { min: [20, 38], max: [80, 54] }, scale: 1 };
  }
  const faces = (getFurnitureRecipe(item.id)?.parts ?? []).flatMap(part => projectFurniturePart(part, item.color));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const face of faces) for (const loop of face.loops) for (const [x, y] of loop) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!faces.length) return { faces: [], bounds: { min: [0, 0], max: [0, 0] }, scale: 1 };
  const scale = Math.min(88 / Math.max(.1, maxX - minX), 70 / Math.max(.1, maxY - minY));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  return {
    bounds: { min: [minX, minY], max: [maxX, maxY] }, scale,
    faces: faces.sort((a, b) => a.depth - b.depth).map(face => ({
      ...face,
      path: face.loops.map(loop => `M${loop.map(([x, y]) => `${(50 + (x - centerX) * scale).toFixed(3)},${(44 + (y - centerY) * scale).toFixed(3)}`).join("L")}Z`).join(""),
    })),
  };
}

const projectionCache = new WeakMap<Pick<FurnitureDefinition, "id" | "color">, FurnitureProjection>();

export function getFurnitureProjection(item: Pick<FurnitureDefinition, "id" | "color">): FurnitureProjection {
  const cached = projectionCache.get(item);
  if (cached) return cached;
  const projection = projectFurniture(item);
  projectionCache.set(item, projection);
  return projection;
}
