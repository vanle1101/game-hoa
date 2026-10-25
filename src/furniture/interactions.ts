import { getFurnitureDefinition, type FurnitureDefinition, type FurnitureInteraction } from "./catalog";
import { cellKey, neighbors } from "../construction/grid";
import { findBuildingPath, furnitureFootprint } from "../construction/navigation";
import type { BuildingFurniture, BuildingPlan, GridPoint } from "../construction/types";
import { findPath, walkable, type Bounds, type Point } from "../components/world/geometry";

export type FurnitureScreen = FurnitureInteraction["screen"];
export type FurnitureActivity = NonNullable<FurnitureInteraction["activity"]>;
export type FurniturePose = Point & { activity: FurnitureActivity; rotation: number };
export type ResolvedFurnitureInteraction = Readonly<{
  furnitureId: string;
  definition: FurnitureDefinition;
  interaction: FurnitureInteraction;
  screen: FurnitureScreen;
  activity?: FurnitureActivity;
  toggle: boolean;
}>;

export function resolveFurnitureInteraction(furnitureId: string, interactionId?: FurnitureInteraction["id"]): ResolvedFurnitureInteraction | undefined {
  const definition = getFurnitureDefinition(furnitureId);
  if (!definition) return undefined;
  const interaction = interactionId ? definition.interactions.find(candidate => candidate.id === interactionId) : definition.interactions[0];
  if (!interaction) return undefined;
  return { furnitureId, definition, interaction, screen: interaction.screen, activity: interaction.activity, toggle: interaction.toggle === true };
}

export function reachedInteractionPoint(position: Point, destination: Point): boolean {
  return Math.hypot(position.x - destination.x, position.z - destination.z) <= .06;
}

export function buildingFurnitureRoute(plan: BuildingPlan, start: GridPoint, item: BuildingFurniture): Point[] {
  if (start.level !== item.level) return [];
  const footprint = furnitureFootprint(item);
  const occupied = new Set(footprint.map(cellKey));
  const candidates = new Map(footprint.flatMap(neighbors).filter(cell => !occupied.has(cellKey(cell))).map(cell => [cellKey(cell), cell]));
  const routes = [...candidates.values()].map(goal => findBuildingPath(plan, start, goal))
    .filter(route => route.length > 0 && route.every(cell => cell.level === start.level))
    .sort((a, b) => a.length - b.length);
  return (routes[0] ?? []).map(cell => ({ x: cell.x + .5, z: cell.z + .5 }));
}

export function apartmentFurnitureRoute(start: Point, item: Bounds, room: { width: number; depth: number }, obstacles: Bounds[], approach?: Point): Point[] {
  const candidates = approach ? [approach] : [
    { x: item.x, z: item.z + item.depth / 2 + .65 },
    { x: item.x, z: item.z - item.depth / 2 - .65 },
    { x: item.x + item.width / 2 + .65, z: item.z },
    { x: item.x - item.width / 2 - .65, z: item.z },
  ];
  const routes = candidates.filter(goal => walkable(goal, room, obstacles)).map(goal => ({ goal, points: findPath(start, goal, room, obstacles) }))
    .filter(({ goal, points }) => points.length > 0 && reachedInteractionPoint(points[points.length - 1], goal));
  const distance = (points: Point[]) => points.reduce((total, point, index) => {
    const previous = index ? points[index - 1] : start;
    return total + Math.hypot(point.x - previous.x, point.z - previous.z);
  }, 0);
  routes.sort((a, b) => distance(a.points) - distance(b.points));
  return routes[0]?.points ?? [];
}

export type FurnitureArrival = Readonly<{
  instanceId: string;
  action: ResolvedFurnitureInteraction;
  destination: Point;
  facing: number;
}>;

export function completeFurnitureArrival(arrival: FurnitureArrival, position: Point, live: boolean, callbacks: {
  onInteract: (screen: FurnitureScreen) => void;
  onToggle: (instanceId: string) => void;
  onPose: (pose: FurniturePose) => void;
}): boolean {
  if (!live || !reachedInteractionPoint(position, arrival.destination)) return false;
  const { action } = arrival;
  if (action.activity) callbacks.onPose({ ...arrival.destination, activity: action.activity, rotation: arrival.facing });
  if (action.toggle) callbacks.onToggle(arrival.instanceId);
  else callbacks.onInteract(action.screen);
  return true;
}

export function toggleFurnitureActive(states: Readonly<Record<string, boolean>>, instanceId: string): Record<string, boolean> {
  return { ...states, [instanceId]: !(states[instanceId] ?? true) };
}
