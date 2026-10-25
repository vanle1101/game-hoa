import * as THREE from "three";
import { LEVEL_HEIGHT } from "@/construction/catalog";
import type { BuildingFoundation, Plot, WallSegment } from "@/construction/types";
import type { RoomBounds } from "./architectural-materials";

export type UsableViewportInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type V9CameraFramingInput = {
  plot?: Plot;
  roomBounds: RoomBounds;
  level: number;
  mode: "live" | "build" | "buy";
  aspect: number;
  fov?: number;
  targetFill?: number;
};

export type V9CameraFramingResult = {
  box: THREE.Box3;
  target: THREE.Vector3;
  position: THREE.Vector3;
  distance: number;
  fov: number;
  aspect: number;
  usableInsets: UsableViewportInsets;
  usableAspect: number;
  fillRatioX: number;
  fillRatioY: number;
  dominantFillRatio: number;
};

export type V9PerimeterCutawayZone = "front-south" | "front-east" | "back-north" | "back-west" | "interior";

export type V9WallCutawayAdjust = {
  isPerimeter: boolean;
  zone: V9PerimeterCutawayZone;
  capHeight: number;
  cutawayActive: boolean;
  openingFrameOpacity: number;
  openingGlassOpacity: number;
  parapetVisible: boolean;
};

const FIXED_APARTMENT_DEFAULT_PLOT: Plot = {
  minX: -6,
  maxX: 6,
  minZ: -5,
  maxZ: 5,
  maxLevel: 0,
  cellSize: 1,
};

const MIN_TARGET_FILL = 0.7;
const MAX_TARGET_FILL = 0.85;
// The world viewport is already reserved beside the HUD.  A slightly tighter
// fill keeps the actual apartment readable in Home instead of shrinking it to
// a postcard surrounded by the city.
const DEFAULT_TARGET_FILL = 0.82;
const DEFAULT_CAMERA_FOV = 42;

export function isFixedApartmentFoundation(foundation?: BuildingFoundation): boolean {
  return foundation?.mode === "fixed-apartment";
}

export function computeUsableViewportInsets(
  aspect: number,
  mode: "live" | "build" | "buy"
): UsableViewportInsets {
  const safeAspect = Number.isFinite(aspect) && aspect > 0.1 ? aspect : 16 / 9;
  const mobile = safeAspect < 1.05;

  if (mode === "live") {
    if (mobile) {
      return { left: 0.04, right: 0.04, top: 0.05, bottom: 0.1 };
    }
    return { left: 0.09, right: 0.09, top: 0.06, bottom: 0.13 };
  }

  if (mobile) {
    return { left: 0.04, right: 0.04, top: 0.06, bottom: 0.16 };
  }
  return { left: 0.16, right: 0.05, top: 0.08, bottom: 0.16 };
}

export function buildFixedApartmentBoundsBox(
  plot: Plot = FIXED_APARTMENT_DEFAULT_PLOT,
  roomBounds?: RoomBounds,
  level = 0
): THREE.Box3 {
  const minX = roomBounds ? Math.min(plot.minX, roomBounds.minX) : plot.minX;
  const maxX = roomBounds ? Math.max(plot.maxX, roomBounds.maxX) : plot.maxX;
  const minZ = roomBounds ? Math.min(plot.minZ, roomBounds.minZ) : plot.minZ;
  const maxZ = roomBounds ? Math.max(plot.maxZ, roomBounds.maxZ) : plot.maxZ;
  const baseY = level * LEVEL_HEIGHT;

  const padX = 0.42;
  const padZ = 0.42;
  const slabDrop = 0.46;
  const shellHeight = LEVEL_HEIGHT + 0.16;

  return new THREE.Box3(
    new THREE.Vector3(minX - padX, baseY - slabDrop, minZ - padZ),
    new THREE.Vector3(maxX + padX, baseY + shellHeight, maxZ + padZ)
  );
}

function getBoxCorners(box: THREE.Box3): THREE.Vector3[] {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
}

export function measureProjectedBoxFill(
  box: THREE.Box3,
  cameraPosition: THREE.Vector3,
  target: THREE.Vector3,
  aspect: number,
  fov = DEFAULT_CAMERA_FOV,
  insets: UsableViewportInsets = { left: 0, right: 0, top: 0, bottom: 0 }
): {
  fillRatioX: number;
  fillRatioY: number;
  dominantFillRatio: number;
  ndcSpanX: number;
  ndcSpanY: number;
  minNdcX: number;
  maxNdcX: number;
  minNdcY: number;
  maxNdcY: number;
} {
  const safeAspect = Number.isFinite(aspect) && aspect > 0.1 ? aspect : 16 / 9;
  const camera = new THREE.PerspectiveCamera(fov, safeAspect, 0.1, 400);
  camera.position.copy(cameraPosition);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  let minNdcX = Infinity;
  let maxNdcX = -Infinity;
  let minNdcY = Infinity;
  let maxNdcY = -Infinity;

  for (const corner of getBoxCorners(box)) {
    const projected = corner.clone().project(camera);
    minNdcX = Math.min(minNdcX, projected.x);
    maxNdcX = Math.max(maxNdcX, projected.x);
    minNdcY = Math.min(minNdcY, projected.y);
    maxNdcY = Math.max(maxNdcY, projected.y);
  }

  const ndcSpanX = Math.max(0, maxNdcX - minNdcX);
  const ndcSpanY = Math.max(0, maxNdcY - minNdcY);
  const usableWidthNdc = Math.max(0.2, 2 * (1 - insets.left - insets.right));
  const usableHeightNdc = Math.max(0.2, 2 * (1 - insets.top - insets.bottom));

  const fillRatioX = ndcSpanX / usableWidthNdc;
  const fillRatioY = ndcSpanY / usableHeightNdc;
  const dominantFillRatio = Math.max(fillRatioX, fillRatioY);

  return {
    fillRatioX,
    fillRatioY,
    dominantFillRatio,
    ndcSpanX,
    ndcSpanY,
    minNdcX,
    maxNdcX,
    minNdcY,
    maxNdcY,
  };
}

export function computeV9ApartmentCameraFraming(input: V9CameraFramingInput): V9CameraFramingResult {
  const plot = input.plot ?? FIXED_APARTMENT_DEFAULT_PLOT;
  const safeAspect = Number.isFinite(input.aspect) && input.aspect > 0.1 ? input.aspect : 16 / 9;
  const fov = input.fov ?? DEFAULT_CAMERA_FOV;
  const requestedFill = input.targetFill ?? DEFAULT_TARGET_FILL;
  const targetFill = THREE.MathUtils.clamp(requestedFill, MIN_TARGET_FILL + 0.02, MAX_TARGET_FILL - 0.02);

  const box = buildFixedApartmentBoundsBox(plot, input.roomBounds, input.level);
  const boxCenter = box.getCenter(new THREE.Vector3());
  const usableInsets = computeUsableViewportInsets(safeAspect, input.mode);

  const usableWidthFraction = Math.max(0.25, 1 - usableInsets.left - usableInsets.right);
  const usableHeightFraction = Math.max(0.25, 1 - usableInsets.top - usableInsets.bottom);
  const usableAspect = (safeAspect * usableWidthFraction) / usableHeightFraction;

  const viewDir =
    input.mode === "live"
      ? new THREE.Vector3(0.76, 0.8, 1.04).normalize()
      : new THREE.Vector3(0.74, 1.06, 1.02).normalize();

  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, viewDir).normalize();
  const up = new THREE.Vector3().crossVectors(viewDir, right).normalize();

  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);
  const halfTanY = tanHalfFov * usableHeightFraction * targetFill;
  const halfTanX = tanHalfFov * safeAspect * usableWidthFraction * targetFill;

  const corners = getBoxCorners(box);

  let minRight = Infinity;
  let maxRight = -Infinity;
  let minUp = Infinity;
  let maxUp = -Infinity;
  for (const corner of corners) {
    const rel = corner.clone().sub(boxCenter);
    const r = rel.dot(right);
    const u = rel.dot(up);
    minRight = Math.min(minRight, r);
    maxRight = Math.max(maxRight, r);
    minUp = Math.min(minUp, u);
    maxUp = Math.max(maxUp, u);
  }

  const centerOffsetRight = (minRight + maxRight) * 0.5;
  const centerOffsetUp = (minUp + maxUp) * 0.5;

  const baseTarget = boxCenter
    .clone()
    .addScaledVector(right, centerOffsetRight)
    .addScaledVector(up, centerOffsetUp);
  baseTarget.y = input.level * LEVEL_HEIGHT + 0.65;

  let analyticDistance = 6;
  for (const corner of corners) {
    const rel = corner.clone().sub(baseTarget);
    const depth = rel.dot(viewDir);
    const projX = Math.abs(rel.dot(right));
    const projY = Math.abs(rel.dot(up));
    analyticDistance = Math.max(
      analyticDistance,
      depth + projX / Math.max(0.05, halfTanX),
      depth + projY / Math.max(0.05, halfTanY)
    );
  }

  const shiftNdcX = usableInsets.left - usableInsets.right;
  const shiftNdcY = usableInsets.bottom - usableInsets.top;

  const computeTargetForDistance = (dist: number) => {
    const worldShiftRight = -shiftNdcX * dist * tanHalfFov * safeAspect * 0.38;
    const worldShiftUp = -shiftNdcY * dist * tanHalfFov * 0.38;
    return baseTarget
      .clone()
      .addScaledVector(right, worldShiftRight)
      .addScaledVector(up, worldShiftUp);
  };

  let lowDist = 4;
  let highDist = 52;
  let solvedDistance = THREE.MathUtils.clamp(analyticDistance, lowDist, highDist);
  let solvedTarget = computeTargetForDistance(solvedDistance);

  for (let step = 0; step < 18; step++) {
    const mid = (lowDist + highDist) * 0.5;
    const candidateTarget = computeTargetForDistance(mid);
    const candidatePos = candidateTarget.clone().addScaledVector(viewDir, mid);
    const metrics = measureProjectedBoxFill(box, candidatePos, candidateTarget, safeAspect, fov, usableInsets);
    solvedDistance = mid;
    solvedTarget = candidateTarget;
    if (metrics.dominantFillRatio > targetFill) {
      lowDist = mid;
    } else {
      highDist = mid;
    }
  }

  const position = solvedTarget.clone().addScaledVector(viewDir, solvedDistance);
  const finalMetrics = measureProjectedBoxFill(box, position, solvedTarget, safeAspect, fov, usableInsets);

  return {
    box,
    target: solvedTarget,
    position,
    distance: solvedDistance,
    fov,
    aspect: safeAspect,
    usableInsets,
    usableAspect,
    fillRatioX: finalMetrics.fillRatioX,
    fillRatioY: finalMetrics.fillRatioY,
    dominantFillRatio: finalMetrics.dominantFillRatio,
  };
}

export function classifyFixedApartmentWallZone(
  wall: Pick<WallSegment, "x" | "z" | "orientation">,
  plot: Plot = FIXED_APARTMENT_DEFAULT_PLOT
): V9PerimeterCutawayZone {
  if (wall.orientation === "x" && wall.z === plot.maxZ) {
    return "front-south";
  }
  if (wall.orientation === "z" && wall.x === plot.maxX) {
    return "front-east";
  }
  if (wall.orientation === "x" && wall.z === plot.minZ) {
    return "back-north";
  }
  if (wall.orientation === "z" && wall.x === plot.minX) {
    return "back-west";
  }
  return "interior";
}

export function evaluateV9PerimeterCutaway(params: {
  wall: WallSegment;
  plot?: Plot;
  cutaway: boolean;
  selected: boolean;
  mode: "live" | "build" | "buy";
  cameraPosition: { x: number; y: number; z: number };
  baseState: {
    capHeight: number;
    cutawayActive: boolean;
    openingFrameOpacity: number;
    openingGlassOpacity: number;
  };
}): V9WallCutawayAdjust {
  const plot = params.plot ?? FIXED_APARTMENT_DEFAULT_PLOT;
  const zone = classifyFixedApartmentWallZone(params.wall, plot);
  const isPerimeter = zone !== "interior";

  if (!isPerimeter) {
    return {
      isPerimeter: false,
      zone,
      ...params.baseState,
      parapetVisible: false,
    };
  }

  if (params.selected) {
    return {
      isPerimeter: true,
      zone,
      capHeight: LEVEL_HEIGHT,
      cutawayActive: false,
      openingFrameOpacity: 1,
      openingGlassOpacity: 0.42,
      parapetVisible: true,
    };
  }

  const centerX = (plot.minX + plot.maxX) * 0.5;
  const centerZ = (plot.minZ + plot.maxZ) * 0.5;
  const camDx = params.cameraPosition.x - centerX;
  const camDz = params.cameraPosition.z - centerZ;

  const southFacingCamera = camDz >= -1.5;
  const eastFacingCamera = camDx >= -1.5;

  const isFrontSouth = zone === "front-south" && southFacingCamera;
  const isFrontEast = zone === "front-east" && eastFacingCamera;
  const isBackNorth = zone === "back-north" && !southFacingCamera;
  const isBackWest = zone === "back-west" && !eastFacingCamera;

  if (isFrontSouth || isFrontEast || isBackNorth || isBackWest) {
    const frontSouthPrimary = zone === "front-south" && southFacingCamera;
    const capHeight = params.mode === "live"
      ? frontSouthPrimary
        ? 0.42
        : 0.54
      : frontSouthPrimary
        ? 0.48
        : 0.62;
    return {
      isPerimeter: true,
      zone,
      capHeight,
      cutawayActive: true,
      openingFrameOpacity: params.mode === "live" ? 0.24 : 0.36,
      openingGlassOpacity: params.mode === "live" ? 0.08 : 0.14,
      parapetVisible: true,
    };
  }

  return {
    isPerimeter: true,
    zone,
    capHeight: LEVEL_HEIGHT,
    cutawayActive: false,
    openingFrameOpacity: 1,
    openingGlassOpacity: 0.34,
    parapetVisible: false,
  };
}
