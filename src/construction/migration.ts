import { FURNITURE } from "../domain/catalog";
import type { GameState } from "../domain/types";
import { cellKey, emptyPlan, rectangleRoom } from "./grid";
import { furnitureFootprint } from "./navigation";
import type { BuildingFurniture, BuildingState } from "./types";
import { STARTER_GRANT } from "./catalog";

/** Preview-only migration: existing ownership and currency remain untouched. */
export function migrateLegacyBuilding(state: GameState): BuildingState {
  if (state.building) return state.building;
  const legacy = state.placements ?? [];
  const plan = rectangleRoom(emptyPlan(), { x: -2, z: -2, level: 0 }, { x: 1, z: 1, level: 0 });
  const floorKeys = new Set(plan.floors.map(cellKey));
  const occupied = new Set<string>();
  const count: Record<string, number> = {};
  for (const old of legacy) {
    const definition = FURNITURE.find((item) => item.id === old.furnitureId);
    if (!definition || (count[definition.id] ?? 0) >= (state.ownedFurniture[definition.id] ?? 0)) continue;
    const rotation = ([0, 90, 180, 270].includes(old.rotation) ? old.rotation : 0) as BuildingFurniture["rotation"];
    const rotated = rotation % 180 !== 0, width = Math.ceil(rotated ? definition.depth : definition.width), depth = Math.ceil(rotated ? definition.width : definition.depth);
    const preferred = { x: Math.floor(old.x - width / 2), z: Math.floor(old.z - depth / 2) };
    const candidates = [...plan.floors].sort((a, b) => Math.abs(a.x - preferred.x) + Math.abs(a.z - preferred.z) - Math.abs(b.x - preferred.x) - Math.abs(b.z - preferred.z));
    for (const at of candidates) {
      const item: BuildingFurniture = { id: old.id, furnitureId: definition.id, x: at.x, z: at.z, level: 0, rotation };
      const footprint = furnitureFootprint(item);
      if (footprint.every((cell) => floorKeys.has(cellKey(cell)) && !occupied.has(cellKey(cell)))) {
        plan.furniture.push(item);
        footprint.forEach((cell) => occupied.add(cellKey(cell)));
        count[definition.id] = (count[definition.id] ?? 0) + 1;
        break;
      }
    }
  }
  return {
    version: 1,
    revision: 0,
    plot: { minX: -8, maxX: 8, minZ: -8, maxZ: 8, maxLevel: 2, cellSize: 1 },
    plan,
    paid: {},
    starterGrantApplied: false,
    migratedAt: state.createdAt,
    legacyPlacementsPreserved: true,
  };
}

export function isUninvestedLegacyStarterBuilding(state: GameState): boolean {
  const building = state.building;
  if (!building || building.version !== 1 || building.migratedAt !== state.createdAt || !building.legacyPlacementsPreserved) return false;
  if (building.foundation && (building.foundation.version !== 9 || building.foundation.mode !== "legacy-preserved")) return false;
  const expected = migrateLegacyBuilding({ ...state, building: undefined, placements: [] });
  if (Object.entries(expected.plot).some(([key, value]) => building.plot[key as keyof typeof building.plot] !== value)) return false;
  const plan = building.plan;
  if (plan.furniture.length || plan.stairs.length || plan.ceilings.length || plan.roofs.length || plan.curves?.length || plan.ledStrips?.length || Object.keys(plan.roomNames).length) return false;
  const floorKeys = new Set(expected.plan.floors.map(cellKey));
  if (plan.floors.length !== floorKeys.size || new Set(plan.floors.map(cellKey)).size !== floorKeys.size || plan.floors.some(floor => !floorKeys.has(cellKey(floor)) || floor.materialId !== "floor-concrete")) return false;
  if (building.revision === 0) {
    const walls = (items: typeof plan.walls) => items.map(wall => `${wall.level}:${wall.orientation}:${wall.x}:${wall.z}:${wall.materialId}:${JSON.stringify(wall.opening ?? null)}`).sort();
    return !building.starterGrantApplied && Object.keys(building.paid).length === 0 && JSON.stringify(walls(plan.walls)) === JSON.stringify(walls(expected.plan.walls));
  }
  const paidKeys = new Set([...floorKeys].map(key => `floor:${key}`));
  return building.revision === 1 && building.starterGrantApplied && plan.walls.length === 0 && Object.keys(building.paid).length === paidKeys.size && Object.entries(building.paid).every(([key, value]) => paidKeys.has(key) && value === 0);
}

export const APARTMENT_FOUNDATION_VERSION = 9 as const;
export const FIXED_APARTMENT_PLOT = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 } as const;
/** The surrounding roof slab is available for extending the starter apartment. */
export const APARTMENT_TERRACE_PLOT = { minX: -8, maxX: 8, minZ: -7, maxZ: 7, maxLevel: 0, cellSize: 1 } as const;

export function createFixedApartment(now: string): BuildingState {
  const plan = rectangleRoom(emptyPlan(), { x: -6, z: -5, level: 0 }, { x: 5, z: 4, level: 0 });
  for (const wall of plan.walls) {
    if (wall.orientation === "x" && wall.x === 0 && wall.z === 5) {
      wall.opening = { kind: "door", catalogId: "door-standard" };
    }
    if (wall.orientation === "x" && wall.z === -5 && (wall.x === -2 || wall.x === 2)) {
      wall.opening = { kind: "window", catalogId: "window-small" };
    }
  }
  return { version: 1, foundation: { version: APARTMENT_FOUNDATION_VERSION, mode: "fixed-apartment" }, revision: 0, plot: { ...FIXED_APARTMENT_PLOT }, plan, paid: {}, starterGrantApplied: true, migratedAt: now, legacyPlacementsPreserved: true };
}

export function migrateFoundation(state: GameState): GameState {
  if (!state.building || state.building.foundation) return state;
  const next = structuredClone(state);
  next.building!.foundation = { version: APARTMENT_FOUNDATION_VERSION, mode: "legacy-preserved" };
  return next;
}

/** Server configuration only: callers must never pass a client-selected grant. */
export function applyStarterGrant(state: GameState, now: string, configuredGrant = STARTER_GRANT): GameState {
  const building = state.building ?? migrateLegacyBuilding(state);
  if (building.starterGrantApplied) return state;
  if (!Number.isSafeInteger(configuredGrant) || configuredGrant < 0 || configuredGrant > 10000 || !Number.isSafeInteger(state.gold + configuredGrant)) throw new Error("Invalid configured construction starter grant.");
  const next = structuredClone(state);
  next.building = { ...building, starterGrantApplied: true };
  if (configuredGrant > 0) {
    next.gold += configuredGrant;
    const eventId = `construction-starter-grant:${state.userId}`;
    next.ledger.push({ id: eventId, eventId, amount: configuredGrant, balance: next.gold, reason: "Configured construction starter grant", at: now });
    next.journal.push({ id: eventId, type: "construction.migration", title: "Configured construction starter grant applied", at: now, data: { gold: configuredGrant } });
  }
  return next;
}
