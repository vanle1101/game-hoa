import type { BuildingPlan, GridPoint, WallSegment } from "./types";
export const cellKey = (p: GridPoint) => `${p.level}:${p.x}:${p.z}`;
export const edgeKey = (p: WallSegment) => `${p.level}:${p.orientation}:${p.x}:${p.z}`;
export const emptyPlan = (): BuildingPlan => ({ floors: [], walls: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {}, ledStrips: [] });
export function adjacentCells(wall: WallSegment): [GridPoint, GridPoint] { return wall.orientation === "x" ? [{ x: wall.x, z: wall.z - 1, level: wall.level }, { x: wall.x, z: wall.z, level: wall.level }] : [{ x: wall.x - 1, z: wall.z, level: wall.level }, { x: wall.x, z: wall.z, level: wall.level }]; }
export function edgeBetween(a: GridPoint, b: GridPoint): string | undefined { if (a.level !== b.level || Math.abs(a.x - b.x) + Math.abs(a.z - b.z) !== 1) return undefined; return edgeKey({ x: a.x === b.x ? a.x : Math.max(a.x, b.x), z: a.z === b.z ? a.z : Math.max(a.z, b.z), level: a.level, orientation: a.x === b.x ? "x" : "z", materialId: "" }); }
export function neighbors(p: GridPoint): GridPoint[] { return [{ ...p, x: p.x - 1 }, { ...p, x: p.x + 1 }, { ...p, z: p.z - 1 }, { ...p, z: p.z + 1 }]; }
export function rectangleRoom(plan: BuildingPlan, start: GridPoint, end: GridPoint, floorMaterialId = "floor-concrete", wallMaterialId = "wall-basic"): BuildingPlan {
  const next = structuredClone(plan), floors = new Set(next.floors.map(cellKey)), walls = new Set(next.walls.map(edgeKey));
  const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x), minZ = Math.min(start.z, end.z), maxZ = Math.max(start.z, end.z), level = start.level;
  if (![minX, maxX, minZ, maxZ, level].every(Number.isSafeInteger) || maxX - minX > 32 || maxZ - minZ > 32) return next;
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) { const cell = { x, z, level, materialId: floorMaterialId }; if (!floors.has(cellKey(cell))) next.floors.push(cell); }
  const add = (wall: WallSegment) => { if (!walls.has(edgeKey(wall))) { next.walls.push(wall); walls.add(edgeKey(wall)); } };
  for (let x = minX; x <= maxX; x++) { add({ x, z: minZ, level, orientation: "x", materialId: wallMaterialId }); add({ x, z: maxZ + 1, level, orientation: "x", materialId: wallMaterialId }); }
  for (let z = minZ; z <= maxZ; z++) { add({ x: minX, z, level, orientation: "z", materialId: wallMaterialId }); add({ x: maxX + 1, z, level, orientation: "z", materialId: wallMaterialId }); }
  return next;
}
