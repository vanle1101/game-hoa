import { cellKey } from "../../construction/grid";
import { findBuildingPath, occupiedCells } from "../../construction/navigation";
import type { BuildingPlan, GridPoint } from "../../construction/types";

/** Returns a floor cell; render the pet at its center (x + .5, z + .5). */
export function findPetSpawn(plan: BuildingPlan, avatarSpawn: GridPoint): GridPoint | undefined {
  const blocked = occupiedCells(plan);
  const avatarKey = cellKey(avatarSpawn);
  const floors = plan.floors.filter((cell) => cell.level === avatarSpawn.level);
  if (blocked.has(avatarKey) || !floors.some((cell) => cellKey(cell) === avatarKey)) return undefined;

  // Do not route through another storey to place a companion on this floor.
  const sameFloorPlan = { ...plan, floors, stairs: [] };
  const distance = (cell: GridPoint) => Math.abs(cell.x - avatarSpawn.x) + Math.abs(cell.z - avatarSpawn.z);
  const eastDistance = (cell: GridPoint) => Math.abs(cell.x - avatarSpawn.x - 1) + Math.abs(cell.z - avatarSpawn.z);
  const candidates = floors
    .filter((cell) => cellKey(cell) !== avatarKey && !blocked.has(cellKey(cell)))
    .sort((a, b) => distance(a) - distance(b) || eastDistance(a) - eastDistance(b) || a.z - b.z || a.x - b.x);

  let nearest: GridPoint | undefined;
  let shortestPath = Infinity;
  for (const cell of candidates) {
    const path = findBuildingPath(sameFloorPlan, avatarSpawn, cell);
    if (path.length > 1 && path.length < shortestPath) {
      nearest = { x: cell.x, z: cell.z, level: cell.level };
      shortestPath = path.length;
      if (shortestPath === 2) break;
    }
  }
  return nearest;
}
