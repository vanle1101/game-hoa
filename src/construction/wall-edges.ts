import type { GridPoint, WallSegment } from "./types";

export type WallEdge = Pick<WallSegment, "x" | "z" | "level" | "orientation">;

/** Wall tools work on lattice intersections, never cell centres. */
export function snapWallVertex(point: { x: number; z: number }, level: number, gridSize = 1): GridPoint {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    z: Math.round(point.z / gridSize) * gridSize,
    level,
  };
}

export function orthogonalWallEnd(start: GridPoint, end: GridPoint): GridPoint {
  return Math.abs(end.x - start.x) >= Math.abs(end.z - start.z)
    ? { ...end, z: start.z }
    : { ...end, x: start.x };
}

/** A drag of N metres yields exactly N persistent one-metre edges. */
export function wallEdgesBetweenVertices(start: GridPoint, pointerEnd: GridPoint): WallEdge[] {
  if (start.level !== pointerEnd.level) return [];
  const end = orthogonalWallEnd(start, pointerEnd);
  if (start.x === end.x && start.z === end.z) return [];
  const edges: WallEdge[] = [];
  if (start.z === end.z) {
    for (let x = Math.min(start.x, end.x); x < Math.max(start.x, end.x); x++)
      edges.push({ x, z: start.z, level: start.level, orientation: "x" });
  } else {
    for (let z = Math.min(start.z, end.z); z < Math.max(start.z, end.z); z++)
      edges.push({ x: start.x, z, level: start.level, orientation: "z" });
  }
  return edges;
}

/** Inclusive, reversible marquee along the row of the first wall segment. */
export function wallEdgesBetweenSegments(start: WallEdge, end: WallEdge): WallEdge[] {
  if (start.level !== end.level || start.orientation !== end.orientation) return [start];
  const horizontal = start.orientation === "x";
  if ((horizontal ? start.z !== end.z : start.x !== end.x)) return [start];
  const first = horizontal ? start.x : start.z;
  const last = horizontal ? end.x : end.z;
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => ({
    ...start,
    [horizontal ? "x" : "z"]: Math.min(first, last) + index,
  }));
}
