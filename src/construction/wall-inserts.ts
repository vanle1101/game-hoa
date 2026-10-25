import { FURNITURE } from "@/domain/catalog";
import { buildingItem, LEVEL_HEIGHT } from "./catalog";
import { edgeKey } from "./grid";
import type { BuildingFurniture, BuildingPlan, WallSegment } from "./types";

export type WallCutout = { id: string; center: number; width: number; bottom: number; height: number; depth: number };
export const WALL_GRID_SIZE = 1;

/** Snap the bottom-centre pivot of a wall insert to the one-metre wall grid. */
export function snapWallInsertPoint(
  wall: WallSegment,
  point: { x: number; y: number; z: number },
  itemHeight: number,
  wallHeight: number,
  kind: "doors" | "windows",
): { u: number; bottom: number } {
  const wallStart = wall.orientation === "x" ? wall.x : wall.z;
  const pointerAxis = wall.orientation === "x" ? point.x : point.z;
  const snappedAxis = Math.round(pointerAxis / WALL_GRID_SIZE) * WALL_GRID_SIZE;
  const axis = Math.max(wallStart, Math.min(wallStart + WALL_GRID_SIZE, snappedAxis));
  const u = (axis - wallStart) / WALL_GRID_SIZE;
  if (kind === "doors") return { u, bottom: 0 };

  // The pointer intersects the pane, but the saved pivot is its lower edge.
  // Clamp the *grid index*, not the final height, to keep every sill exact.
  const localBottom = point.y - wall.level * LEVEL_HEIGHT - itemHeight / 2;
  const highestStep = Math.max(0, Math.floor((wallHeight - itemHeight + 1e-6) / WALL_GRID_SIZE));
  const step = Math.max(0, Math.min(highestStep, Math.round(localBottom / WALL_GRID_SIZE)));
  return { u, bottom: step * WALL_GRID_SIZE };
}

export function isWallInsert(item: BuildingFurniture): boolean {
  return (item.placementType ?? FURNITURE.find(def => def.id === item.furnitureId)?.placementType) === "wall_insert";
}

export function wallInsertCenter(item: BuildingFurniture, walls: readonly WallSegment[]): { x: number; z: number } | undefined {
  const anchor = walls.find(wall => edgeKey(wall) === item.wall_id);
  if (!anchor) return undefined;
  const u = item.wall_u ?? 0.5;
  return anchor.orientation === "x" ? { x: anchor.x + u, z: anchor.z } : { x: anchor.x, z: anchor.z + u };
}

export function wallCutoutsForSegment(wall: WallSegment, plan: BuildingPlan): WallCutout[] {
  const segmentStart = wall.orientation === "x" ? wall.x : wall.z;
  const segmentEnd = segmentStart + 1;
  return plan.furniture.flatMap(item => {
    if (!isWallInsert(item)) return [];
    const def = FURNITURE.find(candidate => candidate.id === item.furnitureId);
    const anchor = plan.walls.find(candidate => edgeKey(candidate) === item.wall_id);
    if (!def?.cutoutSize || !anchor || anchor.level !== wall.level || anchor.orientation !== wall.orientation ||
      (wall.orientation === "x" ? anchor.z !== wall.z : anchor.x !== wall.x)) return [];
    // The rendered insert uses this same LotObject transform. Convert its
    // world-space pivot to the local X axis of the one-meter wall segment.
    const center = wall.orientation === "x"
      ? item.transform?.position.x ?? anchor.x + (item.wall_u ?? 0.5)
      : item.transform?.position.z ?? anchor.z + (item.wall_u ?? 0.5);
    const [width, height, depth] = def.cutoutSize;
    if (center + width / 2 <= segmentStart + 1e-5 || center - width / 2 >= segmentEnd - 1e-5) return [];
    const bottom = def.category === "doors" ? 0 : (item.transform?.position.y ?? wall.level * LEVEL_HEIGHT + (item.wallY ?? 0.9)) - wall.level * LEVEL_HEIGHT;
    // StructuralWall rotates Z edges +90° around Y, so wall-local +X points
    // toward world -Z. Without this sign flip the hole is mirrored to the
    // other side of each segment while the door itself stays at world +Z.
    const localCenter = wall.orientation === "x" ? center - segmentStart - 0.5 : segmentStart + 0.5 - center;
    return [{ id: item.id, center: localCenter, width, bottom, height, depth }];
  });
}

/** Remaining wall intervals at avatar height, in segment-local 0..1 coordinates. */
export function solidWallSpans(wall: WallSegment, plan: BuildingPlan): [number, number][] {
  const legacyOpening = wall.opening?.kind === "door" ? buildingItem(wall.opening.catalogId) : undefined;
  if (legacyOpening) {
    const width = Math.min(0.98, legacyOpening.openingWidth ?? 0.82);
    return [[0, (1 - width) / 2], [(1 + width) / 2, 1]];
  }
  const holes = wallCutoutsForSegment(wall, plan).filter(cut => plan.furniture.some(item => item.id === cut.id && FURNITURE.find(def => def.id === item.furnitureId)?.category === "doors"))
    .map(cut => [Math.max(0, cut.center + 0.5 - cut.width / 2), Math.min(1, cut.center + 0.5 + cut.width / 2)] as const)
    .sort((a, b) => a[0] - b[0]);
  if (!holes.length) return [[0, 1]];
  const solids: [number, number][] = [];
  let cursor = 0;
  for (const [start, end] of holes) {
    if (start > cursor + 1e-5) solids.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1 - 1e-5) solids.push([cursor, 1]);
  return solids;
}

export function wallHasDoorPassage(wall: WallSegment, plan: BuildingPlan): boolean {
  return solidWallSpans(wall, plan).every(([start, end]) => end <= 0.3 || start >= 0.7);
}

export function wallInsertPlacementValid(plan: BuildingPlan, item: BuildingFurniture, structuralWallIds: ReadonlySet<string> = new Set()): boolean {
  const def = FURNITURE.find(candidate => candidate.id === item.furnitureId);
  if (def?.placementType !== "wall_insert" || !def.cutoutSize || !item.wall_id || !Number.isFinite(item.wall_u)) return false;
  const anchor = plan.walls.find(wall => edgeKey(wall) === item.wall_id);
  if (!anchor || anchor.level !== item.level || (item.wall_u ?? -1) < 0 || (item.wall_u ?? 2) > 1) return false;
  if (item.x !== anchor.x || item.z !== anchor.z || !item.wallNormal ||
    (anchor.orientation === "x" ? Math.abs(item.wallNormal[2]) < 0.9 : Math.abs(item.wallNormal[0]) < 0.9)) return false;
  const wallHeight = def.category === "doors" ? 0 : item.wallY ?? NaN;
  if (!Number.isFinite(wallHeight) || wallHeight < 0) return false;
  const [width, height] = def.cutoutSize;
  // Validate the full outer frame, even though CSG cuts only its clear span.
  const supportWidth = Math.max(width, def.width);
  const start = (anchor.orientation === "x" ? anchor.x : anchor.z) + item.wall_u! - supportWidth / 2;
  const end = start + supportWidth;
  const collinear = plan.walls.filter(wall => wall.level === anchor.level && wall.orientation === anchor.orientation &&
    (anchor.orientation === "x" ? wall.z === anchor.z : wall.x === anchor.x)).sort((a, b) => (anchor.orientation === "x" ? a.x - b.x : a.z - b.z));
  let covered = start;
  for (const wall of collinear) {
    const segmentStart = anchor.orientation === "x" ? wall.x : wall.z;
    const segmentEnd = segmentStart + 1;
    if (segmentEnd <= covered + 1e-5 || segmentStart >= end - 1e-5) continue;
    if (segmentStart > covered + 1e-5 || wall.opening || structuralWallIds.has(edgeKey(wall))) return false;
    const materialHeight = buildingItem(wall.materialId)?.height ?? 2.8;
    if (wallHeight + height > materialHeight + 1e-5) return false;
    covered = Math.min(end, segmentEnd);
    if (covered >= end - 1e-5) break;
  }
  if (covered < end - 1e-5) return false;
  return !plan.furniture.some(other => {
    if (other.id === item.id || !isWallInsert(other)) return false;
    const otherDef = FURNITURE.find(candidate => candidate.id === other.furnitureId);
    const otherAnchor = plan.walls.find(wall => edgeKey(wall) === other.wall_id);
    if (!otherDef?.cutoutSize || !otherAnchor || otherAnchor.level !== anchor.level || otherAnchor.orientation !== anchor.orientation ||
      (anchor.orientation === "x" ? otherAnchor.z !== anchor.z : otherAnchor.x !== anchor.x)) return false;
    const otherCenter = (anchor.orientation === "x" ? otherAnchor.x : otherAnchor.z) + (other.wall_u ?? 0.5);
    const otherBottom = otherDef.category === "doors" ? 0 : other.wallY ?? 0.9;
    const otherWidth = Math.max(otherDef.width, otherDef.cutoutSize[0]);
    return start < otherCenter + otherWidth / 2 - 1e-5 && end > otherCenter - otherWidth / 2 + 1e-5 &&
      wallHeight < otherBottom + otherDef.cutoutSize[1] - 1e-5 && wallHeight + height > otherBottom + 1e-5;
  });
}
