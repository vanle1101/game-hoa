import { LEVEL_HEIGHT } from "@/construction/catalog";
import { cellKey } from "@/construction/grid";
import type { BuildingPlan, GridPoint, Plot } from "@/construction/types";
import type { LiveMovementWorld } from "./live-movement";

export type CorridorBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type CorridorSolid = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Detects the authored 12 x 10 apartment shell without changing any persisted cells. */
export function getApartmentCorridorBounds(plan: BuildingPlan, plot?: Plot): CorridorBounds | undefined {
  const source = plot ?? (() => {
    const cells = plan.floors.filter(cell => cell.level === 0);
    if (!cells.length) return undefined;
    return { minX: Math.min(...cells.map(cell => cell.x)), maxX: Math.max(...cells.map(cell => cell.x)) + 1,
      minZ: Math.min(...cells.map(cell => cell.z)), maxZ: Math.max(...cells.map(cell => cell.z)) + 1 };
  })();
  if (!source || source.maxX - source.minX !== 12 || source.maxZ - source.minZ !== 10) return undefined;
  const floorCells = plan.floors.filter(cell => cell.level === 0);
  const keys = new Set(floorCells.map(cellKey));
  for (let x = source.minX; x < source.maxX; x++) for (let z = source.minZ; z < source.maxZ; z++) {
    if (!keys.has(cellKey({ x, z, level: 0 }))) return undefined;
  }
  return { minX: source.minX, maxX: source.maxX, minZ: source.maxZ, maxZ: source.maxZ + 2.4 };
}

export function corridorCells(bounds: CorridorBounds, level: number): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let x = Math.floor(bounds.minX); x < Math.ceil(bounds.maxX); x++) {
    for (let z = Math.floor(bounds.minZ); z < Math.ceil(bounds.maxZ); z++) cells.push({ x, z, level });
  }
  return cells;
}

/** Route finding uses full supported cells; the narrow rear service margin is reserved for collision only. */
export function createCorridorNavigationPlan(plan: BuildingPlan, plot: Plot): BuildingPlan {
  const bounds = getApartmentCorridorBounds(plan, plot);
  if (!bounds) return plan;
  const cells = corridorCells(bounds, 0).filter(cell => cell.z + 1 <= bounds.maxZ - .11);
  return { ...plan, floors: [...plan.floors, ...cells.map(cell => ({ ...cell, materialId: "floor-concrete" }))] };
}

export function corridorSolids(bounds: CorridorBounds): CorridorSolid[] {
  // Two side walls, a closed rear lift core, and a solid back wall. The saved south door remains open.
  return [
    { minX: bounds.minX - .12, maxX: bounds.minX + .12, minZ: bounds.minZ, maxZ: bounds.maxZ },
    { minX: bounds.maxX - .12, maxX: bounds.maxX + .12, minZ: bounds.minZ, maxZ: bounds.maxZ },
    { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.maxZ - .11, maxZ: bounds.maxZ + .11 },
    ...[-3.5, 3.5].map(x => ({ minX: x - .85, maxX: x + .85, minZ: bounds.maxZ - .27, maxZ: bounds.maxZ })),
  ];
}

export function corridorFloorKeys(plan: BuildingPlan, level: number, plot?: Plot): Set<string> {
  const keys = new Set(plan.floors.filter(cell => cell.level === level).map(cellKey));
  const bounds = getApartmentCorridorBounds(plan, plot);
  if (bounds && level === 0) for (const cell of corridorCells(bounds, level)) keys.add(cellKey(cell));
  return keys;
}

export function appendCorridorWorld(world: LiveMovementWorld, plan: BuildingPlan, level: number, plot?: Plot): LiveMovementWorld {
  const bounds = getApartmentCorridorBounds(plan, plot);
  if (!bounds || level !== 0) return world;
  return {
    ...world,
    floors: corridorFloorKeys(plan, level, plot),
    solids: [...world.solids, ...corridorSolids(bounds)],
  };
}

export function corridorColliderBoxes(bounds: CorridorBounds, level: number) {
  const y = level * LEVEL_HEIGHT + 1.4;
  const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
  return [
    ...corridorSolids(bounds).map(solid => [(solid.minX + solid.maxX) / 2, y, (solid.minZ + solid.maxZ) / 2,
      solid.maxX - solid.minX, 2.8, solid.maxZ - solid.minZ]),
    [centerX, level * LEVEL_HEIGHT - .12, centerZ, width, .24, depth],
    [centerX, level * LEVEL_HEIGHT + 2.91, centerZ, width, .22, depth],
  ];
}
