import { adjacentCells, cellKey, edgeBetween, edgeKey, neighbors } from "./grid";
import type { BuildingPlan, GridPoint, RoomRegion } from "./types";
export function detectRooms(plan: BuildingPlan): RoomRegion[] {
  const floors = new Map(plan.floors.map((cell) => [cellKey(cell), cell])); const walls = new Set(plan.walls.map(edgeKey)); const visited = new Set<string>(); const rooms: RoomRegion[] = [];
  for (const floor of [...plan.floors].sort((a, b) => cellKey(a).localeCompare(cellKey(b)))) {
    if (visited.has(cellKey(floor))) continue;
    const queue: GridPoint[] = [floor], cells: GridPoint[] = []; let enclosed = true; visited.add(cellKey(floor));
    for (let i = 0; i < queue.length; i++) { const current = queue[i]; cells.push({ x: current.x, z: current.z, level: current.level }); for (const other of neighbors(current)) { if (walls.has(edgeBetween(current, other)!)) continue; const key = cellKey(other); if (!floors.has(key)) enclosed = false; else if (!visited.has(key)) { visited.add(key); queue.push(other); } } }
    const ids = cells.map(cell => `room:${cellKey(cell)}`).sort();
    const id = ids.find(candidate => Object.hasOwn(plan.roomNames, candidate)) ?? ids[0];
    rooms.push({ id, level: floor.level, cells, area: cells.length, enclosed, name: plan.roomNames[id] ?? (enclosed ? "New Room" : "Open Area") });
  }
  return rooms;
}
export function doorCells(plan: BuildingPlan): GridPoint[] { return plan.walls.filter((w) => w.opening?.kind === "door").flatMap(adjacentCells); }
