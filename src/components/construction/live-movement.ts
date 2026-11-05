import { buildingItem } from "../../construction/catalog";
import { curveIntersectsRect } from "../../construction/curves";
import { cellKey } from "../../construction/grid";
import { furnitureFootprint } from "../../construction/navigation";
import { isWallInsert, solidWallSpans } from "../../construction/wall-inserts";
import type { BuildingPlan, CurvedGlassSegment, Plot } from "../../construction/types";
import { appendCorridorWorld } from "./corridor-navigation";

export type LivePoint = { x: number; z: number };
export type LiveInput = { forward: number; right: number; run?: boolean };
export type LiveDirection = "forward" | "backward" | "left" | "right";
export type LiveMovementState = {
  position: LivePoint;
  velocity: LivePoint;
  rotation: number;
  animation: "idle" | "walk" | "run" | "jump" | "fall" | "land";
};
export type LiveMovementOptions = {
  speed?: number;
  acceleration?: number;
  damping?: number;
  turnSpeed?: number;
  radius?: number;
  enabled?: boolean;
  run?: boolean;
};
type Solid = { minX: number; maxX: number; minZ: number; maxZ: number };
export type LiveMovementWorld = {
  level: number;
  floors: ReadonlySet<string>;
  solids: readonly Solid[];
  curves: readonly CurvedGlassSegment[];
};
export const LIVE_AVATAR_RADIUS = 0.2;
export const LIVE_MOVE_SPEED = 2.5;
const EPSILON = 1e-7;
const finitePoint = (p: LivePoint) => Number.isFinite(p.x) && Number.isFinite(p.z);
const positive = (value: number | undefined, fallback: number) => value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

export function createLiveMovementWorld(plan: BuildingPlan, level: number, plot?: Plot): LiveMovementWorld {
  const solids: Solid[] = [];
  for (const wall of plan.walls) {
    if (wall.level !== level) continue;
    const halfDepth = (buildingItem(wall.materialId)?.thickness ?? 0.12) / 2;
    const spans = solidWallSpans(wall, plan);
    for (const [a, b] of spans) {
      solids.push(wall.orientation === "x"
        ? { minX: wall.x + a, maxX: wall.x + b, minZ: wall.z - halfDepth, maxZ: wall.z + halfDepth }
        : { minX: wall.x - halfDepth, maxX: wall.x + halfDepth, minZ: wall.z + a, maxZ: wall.z + b });
    }
  }
  for (const item of plan.furniture) {
    if (item.level !== level || isWallInsert(item)) continue;
    const cells = furnitureFootprint(item);
    if (!cells.length) cells.push(item);
    solids.push({ minX: Math.min(...cells.map(p => p.x)), maxX: Math.max(...cells.map(p => p.x)) + 1,
      minZ: Math.min(...cells.map(p => p.z)), maxZ: Math.max(...cells.map(p => p.z)) + 1 });
  }
  return appendCorridorWorld({ level, floors: new Set(plan.floors.filter(p => p.level === level).map(cellKey)), solids,
    curves: (plan.curves ?? []).filter(curve => curve.level === level) }, plan, level, plot);
}

function circleTouchesRect(point: LivePoint, radius: number, rect: Solid): boolean {
  const dx = point.x - Math.max(rect.minX, Math.min(rect.maxX, point.x));
  const dz = point.z - Math.max(rect.minZ, Math.min(rect.maxZ, point.z));
  return dx * dx + dz * dz < radius * radius - EPSILON;
}

export function isLivePositionWalkable(world: LiveMovementWorld, point: LivePoint, radius = LIVE_AVATAR_RADIUS): boolean {
  if (!finitePoint(point)) return false;
  radius = positive(radius, LIVE_AVATAR_RADIUS);
  if (!world.floors.has(cellKey({ x: Math.floor(point.x), z: Math.floor(point.z), level: world.level }))) return false;
  for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++) {
    for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) {
      if (!world.floors.has(cellKey({ x, z, level: world.level })) &&
        circleTouchesRect(point, radius, { minX: x, maxX: x + 1, minZ: z, maxZ: z + 1 })) return false;
    }
  }
  if (world.solids.some(rect => circleTouchesRect(point, radius, rect))) return false;
  return !world.curves.some(curve => curveIntersectsRect(curve, {
    minX: point.x - radius, maxX: point.x + radius, minZ: point.z - radius, maxZ: point.z + radius,
  }));
}

export function resolveLiveMovement(world: LiveMovementWorld, position: LivePoint, displacement: LivePoint, radius = LIVE_AVATAR_RADIUS): LivePoint {
  if (!finitePoint(position) || !finitePoint(displacement)) return { ...position };
  radius = positive(radius, LIVE_AVATAR_RADIUS);
  const distance = Math.hypot(displacement.x, displacement.z);
  if (!distance || distance > 128) return { ...position };
  const steps = Math.max(1, Math.ceil(distance / Math.min(0.08, radius / 2)));
  const delta = { x: displacement.x / steps, z: displacement.z / steps };
  let current = { ...position };
  const advanceAxis = (axis: "x" | "z") => {
    if (!delta[axis]) return;
    const next = { ...current, [axis]: current[axis] + delta[axis] };
    if (isLivePositionWalkable(world, next, radius)) { current = next; return; }
    if (!isLivePositionWalkable(world, current, radius)) return;
    let low = 0, high = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2;
      if (isLivePositionWalkable(world, { ...current, [axis]: current[axis] + delta[axis] * mid }, radius)) low = mid;
      else high = mid;
    }
    current = { ...current, [axis]: current[axis] + delta[axis] * low };
  };
  for (let i = 0; i < steps; i++) {
    const next = { x: current.x + delta.x, z: current.z + delta.z };
    if (isLivePositionWalkable(world, next, radius)) current = next;
    else if (Math.abs(delta.x) >= Math.abs(delta.z)) { advanceAxis("x"); advanceAxis("z"); }
    else { advanceAxis("z"); advanceAxis("x"); }
  }
  return current;
}

export function cameraRelativeMovement(input: LiveInput, cameraForward: LivePoint = { x: 0, z: -1 }): LivePoint {
  const forward = Number.isFinite(input.forward) ? Math.max(-1, Math.min(1, input.forward)) : 0;
  const right = Number.isFinite(input.right) ? Math.max(-1, Math.min(1, input.right)) : 0;
  const length = finitePoint(cameraForward) ? Math.hypot(cameraForward.x, cameraForward.z) : 0;
  const f = length > EPSILON ? { x: cameraForward.x / length, z: cameraForward.z / length } : { x: 0, z: -1 };
  const vector = { x: f.x * forward - f.z * right, z: f.z * forward + f.x * right };
  const scale = Math.max(1, Math.hypot(vector.x, vector.z));
  return { x: vector.x / scale, z: vector.z / scale };
}

export function createLiveMovementState(position: LivePoint, rotation = 0): LiveMovementState {
  return { position: { ...position }, velocity: { x: 0, z: 0 }, rotation, animation: "idle" };
}

export function stepLiveMovement(state: LiveMovementState, input: LiveInput, cameraForward: LivePoint, dt: number,
  world: LiveMovementWorld, options: LiveMovementOptions = {}): LiveMovementState {
  if (options.enabled === false) return { ...state, velocity: { x: 0, z: 0 }, animation: "idle" };
  if (!Number.isFinite(dt) || dt <= 0) return state;
  dt = Math.min(dt, 0.1);
  const direction = cameraRelativeMovement(input, cameraForward);
  const speed = positive(options.speed, options.run ? LIVE_MOVE_SPEED * 1.55 : LIVE_MOVE_SPEED);
  const target = { x: direction.x * speed, z: direction.z * speed };
  const rate = Math.hypot(direction.x, direction.z) > EPSILON ? positive(options.acceleration, 14) : positive(options.damping, 18);
  const decay = Math.exp(-rate * dt);
  const velocity = { x: target.x + (state.velocity.x - target.x) * decay, z: target.z + (state.velocity.z - target.z) * decay };
  const displacement = { x: target.x * dt + (state.velocity.x - target.x) * (1 - decay) / rate,
    z: target.z * dt + (state.velocity.z - target.z) * (1 - decay) / rate };
  const position = resolveLiveMovement(world, state.position, displacement, options.radius);
  const actual = { x: position.x - state.position.x, z: position.z - state.position.z };
  if (Math.abs(actual.x - displacement.x) > 0.0001) velocity.x = 0;
  if (Math.abs(actual.z - displacement.z) > 0.0001) velocity.z = 0;
  if (Math.hypot(velocity.x, velocity.z) < 0.005) { velocity.x = 0; velocity.z = 0; }
  const moving = Math.hypot(actual.x, actual.z) / dt > 0.025;
  let rotation = state.rotation;
  if (moving) {
    const angle = Math.atan2(actual.x, actual.z);
    const shortest = Math.atan2(Math.sin(angle - rotation), Math.cos(angle - rotation));
    rotation += shortest * (1 - Math.exp(-positive(options.turnSpeed, 12) * dt));
  }
  return { position, velocity, rotation, animation: moving ? (options.run ? "run" : "walk") : "idle" };
}

export function liveDirectionForCode(code: string): LiveDirection | undefined {
  switch (code) {
    case "ArrowUp": return "forward";
    case "ArrowDown": return "backward";
    case "ArrowLeft": return "left";
    case "ArrowRight": return "right";
    default: return undefined;
  }
}

export function isLiveTypingTarget(target: EventTarget | null): boolean {
  if (!target || !("closest" in target) || typeof target.closest !== "function") return false;
  return !!target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], [data-live-controls='blocked']");
}

export function createLiveInputController(onStart?: () => void) {
  let notifyStart = onStart;
  const keys = new Set<string>();
  const pointers = new Map<number, LiveDirection>();
  let running = false;
  const actions: string[] = [];
  const sample = (): LiveInput => {
    const directions = new Set([...keys].map(liveDirectionForCode).filter(Boolean));
    for (const direction of pointers.values()) directions.add(direction);
    return { forward: Number(directions.has("forward")) - Number(directions.has("backward")),
      right: Number(directions.has("right")) - Number(directions.has("left")) };
  };
  const start = () => { const input = sample(); if (!input.forward && !input.right) notifyStart?.(); };
  return {
    sample,
    setOnStart(callback: (() => void) | undefined) { notifyStart = callback; },
    press(code: string) { if (!liveDirectionForCode(code) || keys.has(code)) return; start(); keys.add(code); },
    release(code: string) { keys.delete(code); },
    setRun(value: boolean) { running = value; },
    isRunning() { return running; },
    triggerAction(action: string) { if (action) actions.push(action); },
    consumeAction() { return actions.shift(); },
    pressPointer(id: number, direction: LiveDirection) { if (pointers.get(id) === direction) return; start(); pointers.set(id, direction); },
    releasePointer(id: number) { pointers.delete(id); },
    clear() { keys.clear(); pointers.clear(); running = false; actions.length = 0; },
  };
}
export type LiveInputController = ReturnType<typeof createLiveInputController>;

export type LiveControlGate = { enabled: boolean; blocked?: boolean };
export function liveControlsBlocked(document: Pick<Document, "activeElement" | "hidden" | "querySelector">, gate: LiveControlGate): boolean {
  return !gate.enabled || !!gate.blocked || document.hidden || isLiveTypingTarget(document.activeElement) ||
    !!document.querySelector("[role='dialog'][aria-modal='true'], dialog[open], [role='menu']:not([hidden]):not([data-state='closed']), [data-live-controls='blocked'][data-state='open']");
}

export function bindLiveControlListeners(target: EventTarget, document: Pick<Document, "activeElement" | "hidden" | "querySelector" | "addEventListener" | "removeEventListener">,
  controller: LiveInputController, gate: () => LiveControlGate): () => void {
  const clear = () => controller.clear();
  const keyDown = (raw: Event) => {
    const event = raw as KeyboardEvent;
    if (!liveDirectionForCode(event.code)) return;
    if (liveControlsBlocked(document, gate()) || isLiveTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) { clear(); return; }
    event.preventDefault();
    controller.press(event.code);
  };
  const keyUp = (raw: Event) => controller.release((raw as KeyboardEvent).code);
  const pointerUp = (raw: Event) => controller.releasePointer((raw as PointerEvent).pointerId);
  const focus = () => { if (liveControlsBlocked(document, gate())) clear(); };
  target.addEventListener("keydown", keyDown);
  target.addEventListener("keyup", keyUp);
  target.addEventListener("blur", clear);
  target.addEventListener("pointerup", pointerUp);
  target.addEventListener("pointercancel", pointerUp);
  document.addEventListener("visibilitychange", clear);
  document.addEventListener("focusin", focus);
  return () => {
    clear();
    target.removeEventListener("keydown", keyDown);
    target.removeEventListener("keyup", keyUp);
    target.removeEventListener("blur", clear);
    target.removeEventListener("pointerup", pointerUp);
    target.removeEventListener("pointercancel", pointerUp);
    document.removeEventListener("visibilitychange", clear);
    document.removeEventListener("focusin", focus);
  };
}
