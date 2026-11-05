import { FURNITURE } from "@/domain/catalog";
import { PlacementFlags, hasPlacementFlag } from "@/furniture/placement-flags";
import { LEVEL_HEIGHT } from "./catalog";
import { wallInsertYaw } from "./wall-inserts";
import type { BuildingFurniture, BuildingPlan, GridPoint } from "./types";

const definition = (id: string) => FURNITURE.find(item => item.id === id);
const footprintSize = (item: BuildingFurniture) => {
  const def = definition(item.furnitureId);
  const turned = item.rotation % 180 !== 0;
  return { width: Math.ceil(turned ? def?.depth ?? 1 : def?.width ?? 1), depth: Math.ceil(turned ? def?.width ?? 1 : def?.depth ?? 1) };
};

export function requiresSurfaceSlot(furnitureId: string): boolean {
  return hasPlacementFlag(definition(furnitureId)?.placementFlags ?? 0, PlacementFlags.REQUIRES_SLOT);
}

/** Position/rotation written with every new or edited placement. Legacy grid
 * fields remain the source for old saves and for cell-based navigation. */
export function withLotObject(item: BuildingFurniture): BuildingFurniture {
  const size = footprintSize(item);
  const color = item.light_color ?? item.neonColor ?? definition(item.furnitureId)?.neonColor ?? "#00f0ff";
  const y = item.parent_id ? item.transform?.position.y ?? item.level * LEVEL_HEIGHT
    : item.level * LEVEL_HEIGHT + (item.ceilingY ?? item.wallY ?? 0);
  const insert = item.placementType === "wall_insert";
  const position = item.parent_id && item.transform ? item.transform.position : insert ? {
    x: item.x + (Math.abs(item.wallNormal?.[2] ?? 0) > 0.5 ? item.wall_u ?? 0.5 : 0),
    y,
    z: item.z + (Math.abs(item.wallNormal?.[0] ?? 0) > 0.5 ? item.wall_u ?? 0.5 : 0),
  } : {
    x: item.x + size.width / 2,
    y,
    z: item.z + size.depth / 2,
  };
  const wallYaw = item.wallNormal ? Math.atan2(item.wallNormal[0], item.wallNormal[2]) : 0;
  return {
    ...item,
    object_def_guid: item.furnitureId,
    transform: { position, rotation: { x: item.placementType === "ceiling" ? Math.PI : 0, y: insert ? wallInsertYaw(item) : wallYaw + item.rotation * Math.PI / 180, z: 0 } },
    scale: item.scale ?? 1,
    light_color: color,
    neonColor: color,
    light_dimmer_value: item.light_dimmer_value ?? 3,
  };
}

export function slotPosition(parent: BuildingFurniture, slotHash: string): { x: number; y: number; z: number } | undefined {
  const def = definition(parent.furnitureId);
  const slot = def?.slots?.find(candidate => candidate.hash === slotHash);
  if (!slot || !def) return undefined;
  const center = parent.transform?.position ?? {
    x: parent.x + footprintSize(parent).width / 2,
    y: parent.level * LEVEL_HEIGHT,
    z: parent.z + footprintSize(parent).depth / 2,
  };
  const yaw = parent.rotation * Math.PI / 180;
  const localX = slot.x * def.width, localZ = slot.z * def.depth;
  return {
    x: center.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    y: parent.level * LEVEL_HEIGHT + slot.y,
    z: center.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
  };
}

export function nearestAvailableSlot(plan: BuildingPlan, furnitureId: string, point: GridPoint): { parentId: string; slotHash: string; position: { x: number; y: number; z: number } } | undefined {
  if (!requiresSurfaceSlot(furnitureId)) return undefined;
  const desiredX = point.x + 0.5, desiredZ = point.z + 0.5;
  const candidates = plan.furniture.flatMap(parent => {
    const def = definition(parent.furnitureId);
    if (parent.level !== point.level || !def?.slots?.length) return [];
    return def.slots.flatMap(slot => {
      if (plan.furniture.some(item => item.parent_id === parent.id && item.slot_hash === slot.hash)) return [];
      const position = slotPosition(parent, slot.hash);
      if (!position) return [];
      const distance = Math.hypot(position.x - desiredX, position.z - desiredZ);
      return distance <= 2 ? [{ parentId: parent.id, slotHash: slot.hash, position, distance }] : [];
    });
  }).sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

export function snapGroundedToWall(plan: BuildingPlan, item: BuildingFurniture, point: GridPoint): BuildingFurniture {
  const def = definition(item.furnitureId);
  if (!def || !hasPlacementFlag(def.placementFlags, PlacementFlags.GROUNDED_AGAINST_WALL) || item.rotation !== 0) return { ...item, ...point };
  const cursorX = point.x + 0.5, cursorZ = point.z + 0.5;
  const nearest = plan.walls.filter(wall => wall.level === point.level && !wall.opening).map(wall => {
    const centerX = wall.x + (wall.orientation === "x" ? 0.5 : 0);
    const centerZ = wall.z + (wall.orientation === "z" ? 0.5 : 0);
    return { wall, distance: Math.hypot(cursorX - centerX, cursorZ - centerZ) };
  }).sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > 0.85) return { ...item, ...point };
  const { wall } = nearest;
  const positive = wall.orientation === "x" ? cursorZ >= wall.z : cursorX >= wall.x;
  const rotation = (wall.orientation === "x" ? positive ? 0 : 180 : positive ? 90 : 270) as BuildingFurniture["rotation"];
  const width = Math.ceil(rotation % 180 ? def.depth : def.width);
  const depth = Math.ceil(rotation % 180 ? def.width : def.depth);
  return {
    ...item,
    ...point,
    rotation,
    x: wall.orientation === "z" ? positive ? wall.x : wall.x - width : point.x,
    z: wall.orientation === "x" ? positive ? wall.z : wall.z - depth : point.z,
  };
}

export function attachToSlot(item: BuildingFurniture, parentId: string, slotHash: string, plan: BuildingPlan): BuildingFurniture | undefined {
  const parent = plan.furniture.find(candidate => candidate.id === parentId);
  const position = parent && slotPosition(parent, slotHash);
  if (!parent || !position) return undefined;
  const size = footprintSize(item);
  return withLotObject({
    ...item,
    x: Math.floor(position.x - size.width / 2),
    z: Math.floor(position.z - size.depth / 2),
    level: parent.level,
    parent_id: parentId,
    slot_hash: slotHash,
    transform: { position, rotation: { x: 0, y: item.rotation * Math.PI / 180, z: 0 } },
  });
}

/** A visited set makes malformed legacy cycles harmless while validation
 * rejects them before commit. */
export function furnitureSubtree(plan: BuildingPlan, rootId: string): BuildingFurniture[] {
  const result: BuildingFurniture[] = [], visited = new Set<string>();
  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const item = plan.furniture.find(candidate => candidate.id === id);
    if (!item) return;
    result.push(item);
    for (const child of plan.furniture.filter(candidate => candidate.parent_id === id)) walk(child.id);
  };
  walk(rootId);
  return result;
}

export function withoutFurnitureTree(plan: BuildingPlan, rootId: string): BuildingPlan {
  const ids = new Set(furnitureSubtree(plan, rootId).map(item => item.id));
  return { ...plan, furniture: plan.furniture.filter(item => !ids.has(item.id)) };
}

export function moveFurnitureTree(plan: BuildingPlan, root: BuildingFurniture): BuildingPlan {
  const descendants = furnitureSubtree(plan, root.id).slice(1);
  const moved = new Map<string, BuildingFurniture>([[root.id, withLotObject(root)]]);
  // Parents are visited before children, so every slot is resolved against
  // the latest parent transform rather than an old world-space offset.
  for (const child of descendants) {
    const parent = moved.get(child.parent_id ?? "");
    const current = parent && child.slot_hash && attachToSlot(child, parent.id, child.slot_hash, { ...plan, furniture: [...moved.values()] });
    if (current) moved.set(child.id, current);
  }
  return { ...plan, furniture: plan.furniture.map(item => moved.get(item.id) ?? item) };
}
