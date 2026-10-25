import type { GameState } from "../domain/types";
import { constructionContext, validateConstruction } from "../construction/engine";
import { createFixedApartment, isUninvestedLegacyStarterBuilding } from "../construction/migration";
import type { BuildingState } from "../construction/types";
import { HOUSING_BUILDINGS, HOUSING_FLOORS, HOUSING_LAYOUTS, STARTER_FURNITURE_IDS } from "./catalog";
import type { HousingLayoutId, HousingSelection } from "./types";

export class HousingError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "DomainError"; }
}
export function canReceiveStarterHome(state: GameState): boolean {
  return state.housingStarterEligible === true && !state.residence && !state.building && state.placements.length === 0 && Object.values(state.ownedFurniture).every(count => count === 0) && !state.journal.some(entry => entry.type === "housing.settle" || entry.type.startsWith("construction.") || entry.type.startsWith("furniture."));
}
export const STARTER_HOME_REPAIR_VERSION = 12;

export function reconcileStarterHousing(state: GameState, now: string): GameState {
  return reconcileHousing(state, now, false);
}

export function repairStarterHousing(state: GameState, now: string, authorization: { allowLegacyWallRemoval: true; eventId: string }): GameState {
  if (authorization.allowLegacyWallRemoval !== true || !authorization.eventId.trim() || authorization.eventId.length > 200 || !Number.isFinite(Date.parse(now))) throw new HousingError("INVALID_HOUSING_REPAIR", "Yêu cầu khôi phục căn hộ không hợp lệ.");
  if (state.journal.some(entry => entry.id === authorization.eventId)) return state;
  if (!state.residence) return state;
  const next = reconcileHousing(state, now, true);
  if (next === state) return state;
  next.revision = state.revision + 1;
  delete next.undo;
  delete next.undoUnavailableReason;
  next.journal.push({ id: authorization.eventId, type: "housing.starter-repair", title: "Starter apartment restored", at: now, data: { version: STARTER_HOME_REPAIR_VERSION, authorizedLegacyRepair: true } });
  return next;
}

function reconcileHousing(state: GameState, now: string, allowLegacyWallRemoval: boolean): GameState {
  if (!state.residence) {
    if (state.housingStarterEligible !== undefined || state.building || state.placements.length || Object.values(state.ownedFurniture).some(count => count !== 0) || state.journal.some(entry => entry.type.startsWith("housing.") || entry.type.startsWith("construction.") || entry.type.startsWith("furniture."))) return state;
    return { ...state, housingStarterEligible: true };
  }
  const residence = state.residence;
  if (!HOUSING_BUILDINGS.some(building => building.id === residence.buildingId && building.districtId === residence.districtId) || !HOUSING_FLOORS.some(floor => floor === residence.floor) || !HOUSING_LAYOUTS.some(layout => layout.id === residence.layoutId)) return state;
  if (state.placements.length || Object.entries(state.ownedFurniture).some(([id, count]) => !Number.isSafeInteger(count) || count < 0 || count > 0 && !STARTER_FURNITURE_IDS.some(starter => starter === id))) return state;
  if (state.journal.some(entry => entry.type === "housing.starter-repair" || entry.type.startsWith("furniture.") || entry.type === "undo")) return state;
  const settlements = state.journal.filter(entry => entry.type === "housing.settle");
  if (settlements.length !== 1) return state;
  const settlement = settlements[0];
  if (settlement.data.starterGranted !== false || settlement.at !== residence.completedAt || settlement.data.buildingId !== residence.buildingId || settlement.data.floor !== residence.floor || settlement.data.layoutId !== residence.layoutId) return state;
  const construction = state.journal.filter(entry => entry.type.startsWith("construction."));
  if (!state.building) {
    if (construction.length) return state;
  } else {
    if (!isUninvestedLegacyStarterBuilding(state)) return state;
    if (state.building.revision === 0) {
      if (construction.length) return state;
    } else {
      if (!allowLegacyWallRemoval) return state;
      const commit = construction[0];
      if (construction.length !== 1 || commit.type !== "construction.commit" || state.journal.indexOf(commit) <= state.journal.indexOf(settlement) || Date.parse(commit.at) < Date.parse(settlement.at) || commit.data.buildingRevision !== 1 || commit.data.cost !== 0 || commit.data.refund !== 0 || commit.data.added !== 0 || commit.data.removed !== 16) return state;
      if (state.ledger.some(entry => entry.eventId === commit.id && entry.amount !== 0)) return state;
    }
  }
  const next = structuredClone(state);
  for (const id of STARTER_FURNITURE_IDS) next.ownedFurniture[id] = Math.max(next.ownedFurniture[id] ?? 0, 1);
  next.building = createStarterHome(residence.layoutId, now);
  next.building.revision = (state.building?.revision ?? -1) + 1;
  next.housingStarterEligible = false;
  validateConstruction(next.building, next.building.plan, constructionContext(next));
  return next;
}

export function createStarterHome(layoutId: HousingLayoutId, now: string): BuildingState {
  if (!HOUSING_LAYOUTS.some(layout => layout.id === layoutId)) throw new HousingError("INVALID_HOUSING", "Chọn mẫu căn hộ hợp lệ.");
  const base = createFixedApartment(now);
  const plan = structuredClone(base.plan);

  if (layoutId === "one-bedroom") {
    for (let z = -5; z <= -1; z++) {
      plan.walls.push({
        x: -1,
        z,
        level: 0,
        orientation: "z",
        materialId: "wall-basic",
        ...(z === -2 ? { opening: { kind: "door" as const, catalogId: "door-standard" } } : {}),
      });
    }
  } else if (layoutId === "open-plan") {
    // Low divider wall for open-concept zoned look
    plan.walls.push({ x: 0, z: -2, level: 0, orientation: "x", materialId: "wall-basic" });
  }

  plan.furniture = [
    { id: "starter-home:bed", furnitureId: "cloud-bed", x: -5, z: -4, level: 0, rotation: 0 },
    { id: "starter-home:wardrobe", furnitureId: "wardrobe", x: -6, z: 0, level: 0, rotation: 0 },
    { id: "starter-home:desk", furnitureId: "workstation", x: 1, z: -4, level: 0, rotation: 0 },
    { id: "starter-home:chair", furnitureId: "dining-chair", x: 2, z: -3, level: 0, rotation: 180 },
    { id: "starter-home:tower", furnitureId: "v7-desktop-tower", x: 4, z: -4, level: 0, rotation: 0 },
    { id: "starter-home:light", furnitureId: "cyan_floor_light", x: -5, z: 2, level: 0, rotation: 0, neonColor: "#00f0ff" },
  ];

  return {
    ...base,
    plan,
  };
}
export function settleHousing(state: GameState, selection: HousingSelection, now: string): { state: GameState; starterGranted: boolean } {
  if (state.residence) throw new HousingError("ALREADY_SETTLED", "Bạn đã chọn nơi ở. Căn hộ hiện tại được giữ nguyên.");
  if (!HOUSING_BUILDINGS.some(building => building.id === selection.buildingId && building.districtId === selection.districtId) || !HOUSING_FLOORS.some(floor => floor === selection.floor) || !HOUSING_LAYOUTS.some(layout => layout.id === selection.layoutId)) throw new HousingError("INVALID_HOUSING", "Lựa chọn khu phố, tòa nhà, tầng hoặc căn hộ không hợp lệ.");
  const next = structuredClone(state);
  const starterGranted = canReceiveStarterHome(state);
  if (starterGranted) {
    for (const id of STARTER_FURNITURE_IDS) next.ownedFurniture[id] = (next.ownedFurniture[id] ?? 0) + 1;
    next.building = createStarterHome(selection.layoutId, now);
    validateConstruction(next.building, next.building.plan, constructionContext(next));
  }
  next.residence = { districtId: selection.districtId, buildingId: selection.buildingId, floor: selection.floor, layoutId: selection.layoutId, completedAt: now };
  next.housingStarterEligible = false;
  return { state: next, starterGranted };
}
