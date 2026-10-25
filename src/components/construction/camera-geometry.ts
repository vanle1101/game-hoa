import * as THREE from "three";
import { buildingItem, LEVEL_HEIGHT } from "@/construction/catalog";
import type { BuildingPlan } from "@/construction/types";
import { FURNITURE } from "@/domain/catalog";
import { isWallInsert, solidWallSpans } from "@/construction/wall-inserts";
import { corridorColliderBoxes, type CorridorBounds } from "./corridor-navigation";

export const CAMERA_RADIUS = 0.16;
export const FOLLOW_PITCH_LIMIT = THREE.MathUtils.degToRad(85);
/** Character forward is +Z in the live movement rig, so the camera starts behind it. */
export const FOLLOW_DEFAULT_YAW = Math.PI;

export type CharacterCameraPreset = "rear" | "front" | "left" | "right" | "face";
export type FollowOrbitState = {
  yaw: number;
  pitch: number;
  distance: number;
  actualDistance: number;
  targetHeight: number;
};

/** These are one-shot camera poses, never a constraint on the character's heading. */
export function characterCameraPreset(preset: CharacterCameraPreset, heading = 0): FollowOrbitState {
  const yawOffset = preset === "rear" ? Math.PI : preset === "left" ? -Math.PI / 2 : preset === "right" ? Math.PI / 2 : 0;
  const distance = preset === "face" ? .78 : 3.6;
  return { yaw: heading + yawOffset, pitch: preset === "face" ? 0 : -.12,
    distance, actualDistance: distance, targetHeight: preset === "face" ? 1.64 : 1.1 };
}

/** Keeps an arbitrary number of full turns stable, including near the sky poles. */
export function orbitCharacterCamera(rig: FollowOrbitState, deltaX: number, deltaY: number): FollowOrbitState {
  const yaw = rig.yaw - deltaX * .004;
  return { ...rig, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    pitch: THREE.MathUtils.clamp(rig.pitch + deltaY * .004, -FOLLOW_PITCH_LIMIT, FOLLOW_PITCH_LIMIT) };
}

export function isCharacterCameraPreset(value: unknown): value is CharacterCameraPreset {
  return value === "rear" || value === "front" || value === "left" || value === "right" || value === "face";
}

export type CameraTowerDescriptor = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  topY: number;
};

/** Converts ApartmentCity tower metadata into broad occlusion volumes for free-camera sweeps. */
export function createCityTowerColliders(
  towers: readonly CameraTowerDescriptor[],
  yOffset = 0,
  rotationY = 0,
  originX = 0,
  originZ = 0,
): THREE.Box3[] {
  return towers.map(tower => {
    const local = [
      [-tower.width / 2, -tower.depth / 2], [tower.width / 2, -tower.depth / 2],
      [-tower.width / 2, tower.depth / 2], [tower.width / 2, tower.depth / 2],
    ];
    const bounds = new THREE.Box3();
    for (const [dx, dz] of local) {
      const x = (tower.x + dx) * Math.cos(rotationY) + (tower.z + dz) * Math.sin(rotationY) + originX;
      const z = -(tower.x + dx) * Math.sin(rotationY) + (tower.z + dz) * Math.cos(rotationY) + originZ;
      bounds.expandByPoint(new THREE.Vector3(x, yOffset + tower.topY - tower.height, z));
      bounds.expandByPoint(new THREE.Vector3(x, yOffset + tower.topY, z));
    }
    return bounds.expandByScalar(CAMERA_RADIUS);
  });
}

export function createCorridorCameraColliders(bounds: CorridorBounds, level: number): THREE.Box3[] {
  const boxes = corridorColliderBoxes(bounds, level);
  return boxes.map(([x, cy, z, w, h, d]) => new THREE.Box3(
    new THREE.Vector3(x - w / 2 - CAMERA_RADIUS, cy - h / 2 - CAMERA_RADIUS, z - d / 2 - CAMERA_RADIUS),
    new THREE.Vector3(x + w / 2 + CAMERA_RADIUS, cy + h / 2 + CAMERA_RADIUS, z + d / 2 + CAMERA_RADIUS),
  ));
}

/** The view direction is independent of boom length, so collision never locks pitch. */
export function followViewDirection(yaw: number, pitch: number, out = new THREE.Vector3()) {
  const clamped = THREE.MathUtils.clamp(pitch, -FOLLOW_PITCH_LIMIT, FOLLOW_PITCH_LIMIT);
  return out.set(-Math.sin(yaw) * Math.cos(clamped), Math.sin(clamped), -Math.cos(yaw) * Math.cos(clamped));
}

/** Horizontal pan in the camera's current view axes; diagonal input is normalized. */
export function cameraRelativePan(camera: THREE.Camera, forwardInput: number, rightInput: number, out = new THREE.Vector3()) {
  camera.getWorldDirection(out);
  out.y = 0;
  if (out.lengthSq() < 1e-8) return out.set(0, 0, 0);
  out.normalize();
  const forwardX = out.x, forwardZ = out.z;
  out.set(forwardX * forwardInput - forwardZ * rightInput, 0,
    forwardZ * forwardInput + forwardX * rightInput);
  return out.lengthSq() > 1 ? out.normalize() : out;
}

/** Preserve the orbit offset while panning its camera and target together. */
export function translateOrbitRig(camera: THREE.Camera, target: THREE.Vector3, delta: THREE.Vector3) {
  camera.position.add(delta);
  target.add(delta);
}

/** Lock the orbit pivot height without changing the camera-to-target offset. */
export function lockOrbitTargetY(camera: THREE.Camera, target: THREE.Vector3, y: number) {
  const delta = y - target.y;
  if (Math.abs(delta) < 1e-8) return;
  camera.position.y += delta;
  target.y = y;
}

/** Static solids, expanded by the camera's near-plane radius for a swept sphere. */
export function createCameraColliders(plan: BuildingPlan, level: number, enclosed = false): THREE.Box3[] {
  const boxes: THREE.Box3[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    boxes.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)).expandByScalar(CAMERA_RADIUS));
  };
  for (const wall of plan.walls) {
    if (wall.level !== level) continue;
    const depth = buildingItem(wall.materialId)?.thickness ?? 0.12;
    const height = buildingItem(wall.materialId)?.height ?? 2.8;
    // Keep the architectural wall collision, leaving owned door apertures traversable.
    const spans = solidWallSpans(wall, plan);
    for (const [from, to] of spans) {
      const span = to - from;
      if (wall.orientation === "x") {
        box(wall.x + from + span / 2, level * LEVEL_HEIGHT + height / 2, wall.z,
          span, height, depth);
      } else {
        box(wall.x, level * LEVEL_HEIGHT + height / 2, wall.z + from + span / 2,
          depth, height, span);
      }
    }
  }
  for (const cell of plan.floors) {
    if (cell.level !== level) continue;
    box(cell.x + 0.5, level * LEVEL_HEIGHT - 0.1, cell.z + 0.5, 1, 0.2, 1);
    if (enclosed) box(cell.x + 0.5, level * LEVEL_HEIGHT + 2.94, cell.z + 0.5, 1, 0.16, 1);
  }
  if (!enclosed) for (const cell of plan.ceilings) {
    if (cell.level === level) box(cell.x + 0.5, level * LEVEL_HEIGHT + 2.86, cell.z + 0.5, 1, 0.12, 1);
  }
  for (const item of plan.furniture) {
    if (item.level !== level || isWallInsert(item)) continue;
    const def = FURNITURE.find(value => value.id === item.furnitureId);
    if (!def) continue;
    const width = item.rotation % 180 ? def.depth : def.width;
    const depth = item.rotation % 180 ? def.width : def.depth;
    const height = def.height ?? 1;
    box(item.x + Math.ceil(width) / 2, level * LEVEL_HEIGHT + height / 2,
      item.z + Math.ceil(depth) / 2, width, height, depth);
  }
  for (const curve of plan.curves ?? []) {
    if (curve.level !== level) continue;
    const segments = Math.max(8, Math.ceil(curve.angle / 4));
    for (let i = 0; i < segments; i++) {
      const angle = THREE.MathUtils.degToRad(curve.rotation + curve.angle * (i + 0.5) / segments);
      const chord = curve.radius * THREE.MathUtils.degToRad(curve.angle / segments);
      box(curve.x + curve.radius * Math.cos(angle), level * LEVEL_HEIGHT + curve.height / 2,
        curve.z + curve.radius * Math.sin(angle), Math.abs(Math.sin(angle)) * chord + curve.thickness,
        curve.height, Math.abs(Math.cos(angle)) * chord + curve.thickness);
    }
  }
  return boxes;
}

/** Returns the closest safe boom distance; an obstructed target can still recover. */
export function cameraBoomDistance(anchor: THREE.Vector3, desired: THREE.Vector3, colliders: readonly THREE.Box3[]) {
  const direction = desired.clone().sub(anchor);
  const length = direction.length();
  if (length < 0.0001) return 0;
  const ray = new THREE.Ray(anchor, direction.divideScalar(length));
  const hit = new THREE.Vector3();
  let distance = length;
  for (const collider of colliders) {
    // Seated poses may place the shoulder inside a chair's coarse bounds.
    if (collider.containsPoint(anchor)) continue;
    if (ray.intersectBox(collider, hit)) distance = Math.min(distance, Math.max(0.04, anchor.distanceTo(hit) - 0.025));
  }
  return distance;
}
