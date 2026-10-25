import { FURNITURE } from "../domain/catalog";
import { getApartmentFootprint } from "../components/apartment-v21/asset-registry";
import { cellKey, edgeBetween, edgeKey, neighbors } from "./grid";
import type { BuildingFurniture, BuildingPlan, CurvedGlassSegment, GridPoint, WallSegment } from "./types";
import { wallHasDoorPassage } from "./wall-inserts";
import { curveIntersectsRect } from "./curves";
import { requiresSurfaceSlot } from "./lot-objects";
function curveBlocksCell(curve: CurvedGlassSegment, cell: GridPoint): boolean { return curve.level === cell.level && curveIntersectsRect(curve, { minX: cell.x + 0.32, maxX: cell.x + 0.68, minZ: cell.z + 0.32, maxZ: cell.z + 0.68 }); }
function curveBlocksStep(curve: CurvedGlassSegment, a: GridPoint, b: GridPoint): boolean { return curve.level === a.level && curveIntersectsRect(curve, { minX: Math.min(a.x, b.x) + 0.32, maxX: Math.max(a.x, b.x) + 0.68, minZ: Math.min(a.z, b.z) + 0.32, maxZ: Math.max(a.z, b.z) + 0.68 }); }
export function furnitureFootprint(item: BuildingFurniture): GridPoint[] { const def = FURNITURE.find((d) => d.id === item.furnitureId); if (def?.placementType === "wall" || def?.placementType === "wall_insert" || item.placementType === "wall" || item.placementType === "wall_insert" || item.parent_id || requiresSurfaceSlot(item.furnitureId)) return []; const hero = getApartmentFootprint(item.furnitureId, item.rotation); if (!def && !hero) return []; const width = def ? Math.ceil(item.rotation % 180 !== 0 ? def.depth : def.width) : hero!.width, depth = def ? Math.ceil(item.rotation % 180 !== 0 ? def.width : def.depth) : hero!.depth; const cells: GridPoint[] = []; for (let x = item.x; x < item.x + width; x++) for (let z = item.z; z < item.z + depth; z++) cells.push({ x, z, level: item.level }); return cells; }
export function occupiedCells(plan: BuildingPlan): Set<string> {
  // Ceiling fixtures share the same X/Z footprint as the floor, but occupy a
  // different physical plane. They must not block walking or floor furniture.
  return new Set([
    ...plan.furniture.filter(item => !item.parent_id && (item.placementType ?? FURNITURE.find(def => def.id === item.furnitureId)?.placementType ?? "floor") === "floor").flatMap(furnitureFootprint).map(cellKey),
    ...plan.floors.filter(cell => (plan.curves ?? []).some(curve => curveBlocksCell(curve, cell))).map(cellKey),
  ]);
}
export function stairEnds(stair: BuildingPlan["stairs"][number]): [GridPoint, GridPoint] { return [{ x: stair.x, z: stair.z, level: stair.level }, { x: stair.x + (stair.orientation === "x" ? 1 : 0), z: stair.z + (stair.orientation === "z" ? 1 : 0), level: stair.level + 1 }]; }
export interface NavigationIndex { floors: Set<string>; walls: Map<string, WallSegment>; doorPassages: Set<string>; blocked: Set<string>; stairs: Map<string, GridPoint[]>; curves: CurvedGlassSegment[]; }
export function navigationIndex(plan: BuildingPlan, blocked = occupiedCells(plan)): NavigationIndex {
  const stairs = new Map<string, GridPoint[]>();
  for (const stair of plan.stairs) { const [a, b] = stairEnds(stair); stairs.set(cellKey(a), [...stairs.get(cellKey(a)) ?? [], b]); stairs.set(cellKey(b), [...stairs.get(cellKey(b)) ?? [], a]); }
  return { floors: new Set(plan.floors.map(cellKey)), walls: new Map(plan.walls.map((wall) => [edgeKey(wall), wall])), doorPassages: new Set(plan.walls.filter(wall => wallHasDoorPassage(wall, plan)).map(edgeKey)), blocked: new Set([...blocked, ...plan.floors.filter(cell => (plan.curves ?? []).some(curve => curveBlocksCell(curve, cell))).map(cellKey)]), stairs, curves: plan.curves ?? [] };
}
export function indexedNeighbors(index: NavigationIndex, current: GridPoint): GridPoint[] {
  const result = neighbors(current).filter((next) => { const edge = edgeBetween(current, next)!; const wall = index.walls.get(edge); return index.floors.has(cellKey(next)) && !index.blocked.has(cellKey(next)) && (!wall || index.doorPassages.has(edge)) && !index.curves.some(curve => curveBlocksStep(curve, current, next)); });
  for (const next of index.stairs.get(cellKey(current)) ?? []) if (index.floors.has(cellKey(next)) && !index.blocked.has(cellKey(next))) result.push(next);
  return result;
}
export function walkableNeighbors(plan: BuildingPlan, current: GridPoint, blocked = occupiedCells(plan)): GridPoint[] { return indexedNeighbors(navigationIndex(plan, blocked), current); }
export function findBuildingPath(plan: BuildingPlan, start: GridPoint, goal: GridPoint): GridPoint[] {
  const index = navigationIndex(plan), { floors, blocked } = index, startKey = cellKey(start), goalKey = cellKey(goal);
  if (!floors.has(startKey) || !floors.has(goalKey) || blocked.has(startKey) || blocked.has(goalKey)) return [];
  const queue = [start], parents = new Map<string, GridPoint | null>([[startKey, null]]);
  for (let i = 0; i < queue.length; i++) { const current = queue[i]; if (cellKey(current) === goalKey) { const path: GridPoint[] = []; let cursor: GridPoint | null = current; while (cursor) { path.push(cursor); cursor = parents.get(cellKey(cursor)) ?? null; } return path.reverse(); } for (const next of indexedNeighbors(index, current)) if (!parents.has(cellKey(next))) { parents.set(cellKey(next), current); queue.push(next); } }
  return [];
}
/** Alias used by world renderers and Live Mode interaction code. */
export const findPath = findBuildingPath;
export function safeSpawn(plan: BuildingPlan, preferred?: GridPoint): GridPoint | undefined { const blocked = occupiedCells(plan); if (preferred && plan.floors.some((f) => cellKey(f) === cellKey(preferred)) && !blocked.has(cellKey(preferred))) return preferred; const cell = [...plan.floors].sort((a, b) => a.level - b.level || Math.abs(a.x) + Math.abs(a.z) - Math.abs(b.x) - Math.abs(b.z)).find((f) => !blocked.has(cellKey(f))); return cell ? { x: cell.x, z: cell.z, level: cell.level } : undefined; }
