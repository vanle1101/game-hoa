import { getFurnitureDefinition, getFurnitureRecipe, type FurniturePart } from "./catalog";
import type { BuildingFurniture } from "../construction/types";

type Point = Readonly<{ x: number; z: number }>;
export type FurnitureAnchorPose = Point & Readonly<{
  y: number;
  rotation: number;
  activity: "sitting" | "sleeping" | "working-standing";
}>;
export type FurnitureInteractionAnchors = Readonly<{
  /** A reachable path endpoint supplied by navigation, also retained for standing up. */
  approach: Point;
  exit: Point;
  pose: FurnitureAnchorPose;
  surfaceY?: number;
  supportPartId?: string;
}>;
export type FurnitureAnchorOptions = Readonly<{
  /** Match CharacterModel's vertical scale (body.height * appearance.height). */
  heightScale?: number;
  bodyDepthScale?: number;
  /** Leave zero when Avatar is already nested in a floor-height group. */
  baseY?: number;
}>;

const top = (part: FurniturePart) => part.position[1] + part.size[1] / 2;
const seatPart = (part: FurniturePart) =>
  /(?:^|[-])(?:seat|cushion|pad)(?:$|[-])/.test(part.id) &&
  !/(back|head|arm|frame|deck|support|piping|welt|seam|under|return)/.test(part.id) &&
  (part.material === "cushion" || part.material === "fabric" || part.id === "seat");

/**
 * Poses use the model's local +Z front and THREE's positive Y rotation.
 * The sleep root is at the feet: a -PI/2 pitch points the head toward local -Z.
 * Approach/exit remain distinct from the occupied seat or mattress position.
 */
export function furnitureInteractionAnchors(
  furnitureId: string,
  center: Point,
  rotation: number,
  approach: Point,
  options: FurnitureAnchorOptions = {},
): FurnitureInteractionAnchors | undefined {
  const definition = getFurnitureDefinition(furnitureId), recipe = getFurnitureRecipe(furnitureId);
  if (!definition || !recipe || ![center.x, center.z, rotation, approach.x, approach.z].every(Number.isFinite)) return undefined;
  const activity = definition.interactions.find(action => action.activity)?.activity;
  if (!activity) return undefined;
  const height = Math.max(.5, Math.min(2, options.heightScale ?? 1));
  const depthScale = Math.max(.5, Math.min(2, options.bodyDepthScale ?? 1));
  const baseY = options.baseY ?? 0;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const world = (x: number, z: number): Point => ({ x: center.x + x * cos + z * sin, z: center.z - x * sin + z * cos });
  const localApproachX = (approach.x - center.x) * cos - (approach.z - center.z) * sin;
  const exit = { ...approach };

  if (activity === "sleeping") {
    // The lower bunk is reachable; do not accidentally select the upper mattress.
    const mattress = recipe.parts.filter(part => /mattress/.test(part.id)).sort((a, b) => top(a) - top(b))[0];
    if (!mattress) return undefined;
    const surfaceY = baseY + top(mattress);
    const lane = mattress.size[0] >= 1.7 ? (localApproachX > 1e-6 ? 1 : -1) * mattress.size[0] * .22 : 0;
    const footZ = mattress.position[2] + Math.min(mattress.size[2] / 2 - .12, .87 * height);
    return { approach: { ...approach }, exit, surfaceY, supportPartId: mattress.id, pose: {
      ...world(mattress.position[0] + lane, footZ), y: surfaceY + .14 * depthScale, rotation, activity,
    } };
  }

  if (activity === "sitting") {
    // Prefer the central real cushion, never an armrest, trim or back cushion.
    const seat = recipe.parts.filter(seatPart).sort((a, b) =>
      Math.abs(a.position[0]) - Math.abs(b.position[0]) || a.position[2] - b.position[2])[0];
    if (!seat) return undefined;
    const surfaceY = baseY + top(seat);
    const seatYaw = seat.id.includes("backward") || seat.id === "seat-z--1" ? Math.PI
      : seat.id === "seat-x-1" ? Math.PI / 2 : seat.id === "seat-x--1" ? -Math.PI / 2 : 0;
    const localZ = seatYaw === 0 ? Math.min(seat.position[2], seat.position[2] + seat.size[2] / 2 - .36 * height)
      : seatYaw === Math.PI ? Math.max(seat.position[2], seat.position[2] - seat.size[2] / 2 + .36 * height) : seat.position[2];
    return { approach: { ...approach }, exit, surfaceY, supportPartId: seat.id, pose: {
      ...world(seat.position[0], localZ),
      // Seated thigh underside is .87m above CharacterModel's root.
      y: surfaceY - .87 * height, rotation: rotation + seatYaw, activity,
    } };
  }

  // A work surface is not a seat. A caller may explicitly substitute the anchor
  // of a nearby chair; without one, keep feet on the reachable approach point.
  return { approach: { ...approach }, exit, pose: {
    ...approach, y: baseY, rotation: Math.atan2(center.x - approach.x, center.z - approach.z), activity: "working-standing",
  } };
}

/** Exactly mirrors DynamicFurniture's rotated, rounded grid footprint center. */
export function buildingFurnitureInteractionAnchors(
  item: BuildingFurniture,
  approach: Point,
  options: FurnitureAnchorOptions = {},
): FurnitureInteractionAnchors | undefined {
  const definition = getFurnitureDefinition(item.furnitureId);
  if (!definition) return undefined;
  const rotated = item.rotation % 180 !== 0;
  const width = Math.ceil(rotated ? definition.depth : definition.width);
  const depth = Math.ceil(rotated ? definition.width : definition.depth);
  // A route endpoint inside the occupied footprint cannot be a safe exit.
  if (approach.x > item.x && approach.x < item.x + width && approach.z > item.z && approach.z < item.z + depth) return undefined;
  return furnitureInteractionAnchors(item.furnitureId, { x: item.x + width / 2, z: item.z + depth / 2 }, item.rotation * Math.PI / 180, approach, options);
}

