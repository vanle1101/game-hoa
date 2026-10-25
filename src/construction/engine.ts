import { FURNITURE } from "../domain/catalog";
import type { GameState } from "../domain/types";
import { buildingItem, LEVEL_HEIGHT, REFUND_RATE } from "./catalog";
import { curveBounds, curveFootprint, curveIntersectsRect, curvePrice, curveProfileSignature, curvesIntersect } from "./curves";
import { adjacentCells, cellKey, edgeBetween, edgeKey } from "./grid";
import { furnitureFootprint, stairEnds, navigationIndex, indexedNeighbors } from "./navigation";
import { requiresSurfaceSlot, slotPosition } from "./lot-objects";
import { wallInsertCenter, wallInsertPlacementValid } from "./wall-inserts";
import { buildingPlanSchema } from "./schema";
import { createFixedApartment, APARTMENT_TERRACE_PLOT, migrateLegacyBuilding } from "./migration";
import { detectRooms, doorCells } from "./topology";
import type { BuildingPlan, BuildingState, ConstructionContext, ConstructionQuote, GridPoint } from "./types";

export class ConstructionError extends Error { constructor(public code: string, message: string) { super(message); this.name = "DomainError"; } }
function ensure(value: unknown, message: string, code = "INVALID_CONSTRUCTION"): asserts value { if (!value) throw new ConstructionError(code, message); }
export function constructionContext(state: GameState): ConstructionContext { return { gold: state.gold, characterLevel: Math.floor(Math.sqrt(Math.max(0, state.character.xp) / 100)) + 1, ownedFurniture: state.ownedFurniture, defeatedCampaign: state.campaigns.some((c) => Boolean(c.completedAt)) }; }
export function getBuilding(state: GameState): BuildingState { return state.building ?? migrateLegacyBuilding(state); }
function components(plan: BuildingPlan) {
  const result = new Map<string, { signature: string; catalogId: string; price: number }>();
  const add = (key: string, catalogId: string) => {
    const definition = buildingItem(catalogId);
    ensure(definition, "Unknown construction material.");
    result.set(key, { signature: catalogId, catalogId, price: definition.price });
  };
  for (const floor of plan.floors) add(`floor:${cellKey(floor)}`, floor.materialId);
  for (const wall of plan.walls) {
    add(`wall:${edgeKey(wall)}`, wall.materialId);
    if (wall.opening) add(`opening:${edgeKey(wall)}`, wall.opening.catalogId);
  }
  for (const cell of plan.ceilings) add(`ceiling:${cellKey(cell)}`, cell.materialId);
  for (const cell of plan.roofs) add(`roof:${cellKey(cell)}`, cell.materialId);
  for (const stair of plan.stairs) add(`stair:${cellKey(stair)}:${stair.orientation}`, stair.catalogId);
  for (const curve of plan.curves ?? []) result.set(`curve:${curve.id}`, { signature: `${curve.catalogId}:${curveProfileSignature(curve)}`, catalogId: curve.catalogId, price: curvePrice(curve.catalogId, curve) });
  return result;
}
export function quoteConstruction(building: BuildingState, plan: BuildingPlan, gold: number): ConstructionQuote {
  const before = components(building.plan), after = components(plan); let added = 0, removed = 0, cost = 0, refund = 0; const paid: Record<string, number> = {};
  for (const [key, item] of before) if (after.get(key)?.signature !== item.signature) { removed++; refund += Math.floor(Math.max(0, Math.min(building.paid[key] ?? 0, item.price)) * REFUND_RATE); }
  for (const [key, item] of after) { if (before.get(key)?.signature === item.signature) paid[key] = building.paid[key] ?? 0; else { added++; cost += item.price; paid[key] = item.price; } }
  const netCost = cost - refund; return { added, removed, cost, refund, netCost, remainingGold: gold - netCost, insufficientGold: Math.max(0, netCost - gold), paid };
}
export function validateConstruction(building: BuildingState, proposed: BuildingPlan, context: ConstructionContext): BuildingPlan {
  const parsed = buildingPlanSchema.safeParse(proposed); ensure(parsed.success, parsed.success ? "" : parsed.error.issues[0]?.message ?? "Invalid plan."); const plan = parsed.data;
  const fixed = building.foundation?.version === 9 && building.foundation.mode === "fixed-apartment";
  const fixedShell = fixed ? createFixedApartment(building.migratedAt).plan : undefined;
  if (fixedShell) {
    const shell = fixedShell;
    const requiredFloors = new Set(shell.floors.map(cellKey));
    ensure([...requiredFloors].every(key => plan.floors.some(floor => cellKey(floor) === key)), "The original apartment floor must remain supported.", "FIXED_FOOTPRINT");
    ensure(plan.stairs.length === 0, "The apartment occupies a single fixed floor.", "FIXED_FOOTPRINT");
  }
  const floorKeys = new Set<string>(), wallKeys = new Set<string>(); const plot = fixed ? APARTMENT_TERRACE_PLOT : building.plot;
  const maxLevel = fixed ? 0 : context.characterLevel >= 7 ? 2 : context.characterLevel >= 3 ? 1 : 0;
  const unlockedRadius = fixed ? 32 : context.defeatedCampaign || context.characterLevel >= 5 ? 8 : 5;
  const inBounds = (p: GridPoint) => p.x >= Math.max(plot.minX, -unlockedRadius) && p.x < Math.min(plot.maxX, unlockedRadius) && p.z >= Math.max(plot.minZ, -unlockedRadius) && p.z < Math.min(plot.maxZ, unlockedRadius) && p.level <= Math.min(plot.maxLevel, maxLevel);
  const catalog = (id: string, category: string) => { const item = buildingItem(id); ensure(item && item.category === category, `Choose a valid ${category} material.`); ensure(item.level <= context.characterLevel && (!item.campaignUnlock || context.defeatedCampaign), `${item.name} is not unlocked.`); return item; };
  for (const floor of plan.floors) { ensure(inBounds(floor) || building.plan.floors.some((old) => cellKey(old) === cellKey(floor)), "Floor is outside your unlocked plot or level."); ensure(!floorKeys.has(cellKey(floor)), "Duplicate floor cell."); floorKeys.add(cellKey(floor)); catalog(floor.materialId, "floor"); }
  const stripIds = new Set<string>();
  for (const strip of plan.ledStrips ?? []) {
    ensure(!stripIds.has(strip.id), "Duplicate neon strip."); stripIds.add(strip.id);
    ensure(strip.start.level === strip.end.level && (strip.start.x === strip.end.x || strip.start.z === strip.end.z), "Neon strips must be orthogonal on one floor.");
    const length = Math.max(Math.abs(strip.end.x - strip.start.x), Math.abs(strip.end.z - strip.start.z));
    ensure(length >= 1 && length <= 24, "Neon strip length must be 2–25 cells.");
    for (let index = 0; index <= length; index++) {
      const cell = { x: strip.start.x + Math.sign(strip.end.x - strip.start.x) * index, z: strip.start.z + Math.sign(strip.end.z - strip.start.z) * index, level: strip.start.level };
      ensure(floorKeys.has(cellKey(cell)), "Neon strips require supporting floor under the entire length.");
    }
  }
  for (const floor of plan.floors) if (floor.level > 0) ensure(floorKeys.has(cellKey({ ...floor, level: floor.level - 1 })), "Upper floors require a supporting floor directly below.");
  for (const wall of plan.walls) { const key = edgeKey(wall); ensure(!wallKeys.has(key), "Duplicate wall edge."); wallKeys.add(key); ensure(adjacentCells(wall).some((cell) => floorKeys.has(cellKey(cell)) || (fixed && inBounds(cell))), "Walls must attach to an existing floor edge."); const material = catalog(wall.materialId, "wall"); if (wall.opening) { const opening = catalog(wall.opening.catalogId, wall.opening.kind); ensure((opening.openingHeight ?? 0) + (opening.sill ?? 0) <= (material.height ?? 2.8) && (opening.openingWidth ?? 1) < 1, "Opening does not fit this wall."); } }
  for (const [category, cells] of [["ceiling", plan.ceilings], ["roof", plan.roofs]] as const) { const seen = new Set<string>(); for (const cell of cells) { const key = cellKey(cell); ensure(floorKeys.has(key), `${category} requires floor support.`); ensure(!seen.has(key), `Duplicate ${category} cell.`); seen.add(key); catalog(cell.materialId, category); if (category === "roof") ensure(!floorKeys.has(cellKey({ ...cell, level: cell.level + 1 })), "Roof cannot overlap an upper floor."); } }
  const stairKeys = new Set<string>(), stairCells = new Set<string>();
  for (const stair of plan.stairs) { catalog(stair.catalogId, "stairs"); const key = `${cellKey(stair)}:${stair.orientation}`; ensure(!stairKeys.has(key), "Duplicate staircase."); stairKeys.add(key); const [from, to] = stairEnds(stair); const lowerTo = { ...to, level: from.level }, upperFrom = { ...from, level: to.level }; for (const cell of [from, to, lowerTo, upperFrom]) { ensure(floorKeys.has(cellKey(cell)), "Stairs need supported two-cell landings on both floors."); ensure(!stairCells.has(cellKey(cell)), "Staircases overlap."); stairCells.add(cellKey(cell)); } ensure(!wallKeys.has(edgeBetween(from, lowerTo)!) && !wallKeys.has(edgeBetween(upperFrom, to)!), "A wall blocks the staircase."); ensure(!plan.ceilings.some((c) => cellKey(c) === cellKey(from) || cellKey(c) === cellKey(lowerTo)), "Remove the ceiling above the staircase."); }
  const occupied = new Set<string>(), ceilingOccupied = new Set<string>(), furnitureIds = new Set<string>(), used: Record<string, number> = {};
  const structuralWallIds = new Set<string>();
  for (const item of plan.furniture) {
    const definition = FURNITURE.find((f) => f.id === item.furnitureId);
    ensure(definition, "Unknown furniture.");
    ensure(!furnitureIds.has(item.id), "Duplicate furniture instance.");
    furnitureIds.add(item.id);
    used[item.furnitureId] = (used[item.furnitureId] ?? 0) + 1;
    ensure(used[item.furnitureId] <= (context.ownedFurniture[item.furnitureId] ?? 0), "You do not own enough copies of this furniture.");
    ensure(!item.object_def_guid || item.object_def_guid === item.furnitureId, "Lot object catalog ID does not match furniture.");
    if (definition.placementType === "wall_insert") {
      ensure(item.placementType === "wall_insert" && wallInsertPlacementValid(plan, item, structuralWallIds), "Wall insert needs an unobstructed, supported wall span.");
      const center = wallInsertCenter(item, plan.walls);
      ensure(center && item.transform && Math.hypot(item.transform.position.x - center.x, item.transform.position.z - center.z,
        item.transform.position.y - item.level * LEVEL_HEIGHT - (definition.category === "doors" ? 0 : item.wallY ?? 0)) < 0.001,
      "Wall insert transform does not match its wall anchor.");
      continue;
    }
    // Children occupy a surface slot, not another cell of the parent's floor footprint.
    if (item.parent_id) continue;
    const footprint = furnitureFootprint(item);
    const footprintKeys = new Set(footprint.map(cellKey));
    const isCeiling = item.placementType === "ceiling" || definition.placementType === "ceiling";
    for (const cell of footprint) {
      const key = cellKey(cell);
      ensure(floorKeys.has(key), "Furniture footprint must be supported by floors.");
      const plane = isCeiling ? ceilingOccupied : occupied;
      ensure(!plane.has(key) && !stairCells.has(key), "Furniture intersects another object or staircase.");
      plane.add(key);
    }
    for (const wall of plan.walls) {
      const [a, b] = adjacentCells(wall);
      ensure(!(footprintKeys.has(cellKey(a)) && footprintKeys.has(cellKey(b))), "Furniture crosses a wall.");
    }
  }
  const occupiedSlots = new Set<string>();
  for (const item of plan.furniture) {
    if (!item.parent_id && !item.slot_hash) { ensure(!item.object_def_guid || !requiresSurfaceSlot(item.furnitureId), "This object requires a surface slot."); continue; }
    ensure(item.parent_id && item.slot_hash, "Parent and slot must be saved together.");
    const parent = plan.furniture.find(candidate => candidate.id === item.parent_id);
    ensure(parent && parent.id !== item.id && parent.level === item.level, "Surface parent is missing or on another level.");
    ensure(FURNITURE.find(candidate => candidate.id === parent.furnitureId)?.slots?.some(slot => slot.hash === item.slot_hash), "Unknown surface slot.");
    const key = `${parent.id}:${item.slot_hash}`;
    ensure(!occupiedSlots.has(key), "Surface slot is already occupied.");
    occupiedSlots.add(key);
    const expectedPosition = slotPosition(parent, item.slot_hash);
    ensure(expectedPosition, "Surface slot has no position.");
    if (item.object_def_guid) {
      ensure(item.transform && Math.hypot(
        item.transform.position.x - expectedPosition.x,
        item.transform.position.y - expectedPosition.y,
        item.transform.position.z - expectedPosition.z,
      ) < 0.001, "Surface object is not aligned with its slot.");
    }
    const ancestors = new Set([item.id]);
    let cursor = parent;
    while (cursor.parent_id) {
      ensure(!ancestors.has(cursor.id), "Cyclic furniture parent relation.");
      ancestors.add(cursor.id);
      const next = plan.furniture.find(candidate => candidate.id === cursor.parent_id);
      ensure(next, "Furniture parent is missing.");
      cursor = next;
    }
  }
  const curveIds = new Set<string>();
  const curves = plan.curves ?? [];
  for (const curve of curves) {
    ensure(!curveIds.has(curve.id), "Duplicate curved-glass instance."); curveIds.add(curve.id);
    const definition = catalog(curve.catalogId, "curve");
    ensure(definition.curve, "Choose a valid curved-glass archetype.");
    const bounds = curveBounds(curve);
    ensure(bounds.minX >= Math.max(plot.minX, -unlockedRadius) - 1e-8 && bounds.maxX <= Math.min(plot.maxX, unlockedRadius) + 1e-8 && bounds.minZ >= Math.max(plot.minZ, -unlockedRadius) - 1e-8 && bounds.maxZ <= Math.min(plot.maxZ, unlockedRadius) + 1e-8 && curve.level <= Math.min(plot.maxLevel, maxLevel), "Curved glass is outside your unlocked plot or level.");
    const footprint = curveFootprint(curve);
    ensure(footprint.length > 0 && footprint.every(cell => floorKeys.has(cellKey(cell))), "Curved glass requires floor support beneath its entire arc.");
    ensure(footprint.every(cell => !occupied.has(cellKey(cell)) && !stairCells.has(cellKey(cell))), "Curved glass intersects furniture or a staircase.");
    for (const wall of plan.walls) if (wall.level === curve.level) {
      const half = (buildingItem(wall.materialId)?.thickness ?? 0.12) / 2;
      ensure(!curveIntersectsRect(curve, { minX: wall.x - (wall.orientation === "z" ? half : 0), maxX: wall.x + (wall.orientation === "x" ? 1 : half), minZ: wall.z - (wall.orientation === "x" ? half : 0), maxZ: wall.z + (wall.orientation === "z" ? 1 : half) }), "Curved glass intersects a straight wall or opening.");
    }
    for (const other of curves) if (other.id !== curve.id && curveIds.has(other.id)) ensure(!curvesIntersect(curve, other), "Curved-glass segments overlap.");
  }
  for (const cell of doorCells(plan)) if (floorKeys.has(cellKey(cell))) {
    ensure(!occupied.has(cellKey(cell)), "Furniture blocks a door passage.");
    ensure(!curves.some(curve => curve.level === cell.level && curveIntersectsRect(curve, { minX: cell.x + 0.15, maxX: cell.x + 0.85, minZ: cell.z + 0.15, maxZ: cell.z + 0.85 })), "Curved glass blocks a door passage.");
  }
  // Every connected upper-floor area needs a staircase back to ground; closed rooms remain legal.
  const index = navigationIndex(plan, occupied); const clear = new Set<string>(); const queue = plan.floors.filter((f) => f.level === 0 && !index.blocked.has(cellKey(f))); for (const p of queue) clear.add(cellKey(p)); for (let i = 0; i < queue.length; i++) for (const next of indexedNeighbors(index, queue[i])) if (!clear.has(cellKey(next))) { clear.add(cellKey(next)); queue.push({ ...next, materialId: "" }); }
  for (const room of detectRooms(plan).filter((r) => r.level > 0)) ensure(room.cells.some((cell) => clear.has(cellKey(cell))), "Each upper-floor room needs an accessible staircase or connecting door.");
  if (plan.floors.length) ensure(plan.floors.some(floor => !index.blocked.has(cellKey(floor))), "Leave walkable space for your character.");
  return plan;
}
export const validatePlan = validateConstruction;
export function commitConstruction(building: BuildingState, plan: BuildingPlan, expectedRevision: number, context: ConstructionContext): { building: BuildingState; quote: ConstructionQuote } { ensure(building.revision === expectedRevision, "This house changed in another tab. Reload and review your draft.", "REVISION_CONFLICT"); const validated = validateConstruction(building, plan, context); const quote = quoteConstruction(building, validated, context.gold); ensure(quote.remainingGold >= 0, `You need ${quote.insufficientGold} more Gold to build this plan.`, "INSUFFICIENT_GOLD"); return { building: { ...building, revision: building.revision + 1, plan: validated, paid: quote.paid, starterGrantApplied: true }, quote }; }
