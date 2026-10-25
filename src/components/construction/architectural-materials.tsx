"use client";

import * as THREE from "three";
import { buildingItem, LEVEL_HEIGHT } from "@/construction/catalog";
import { cellKey } from "@/construction/grid";
import { furnitureFootprint } from "@/construction/navigation";
import type { BuildingFurniture, BuildingPlan, FloorCell, Plot, WallSegment } from "@/construction/types";
import { FURNITURE } from "@/domain/catalog";

export type FloorPatternKind =
  | "honed-stone"
  | "warm-plank"
  | "ceramic-grid"
  | "woven-carpet"
  | "neon-circuit"
  | "structural-glass"
  | "acoustic-ceiling"
  | "luminous-coffer"
  | "weather-deck";

export type FloorMaterialSpec = {
  id: string;
  pattern: FloorPatternKind;
  baseColor: string;
  secondaryColor: string;
  seamColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
  bumpScale: number;
  emissive: string;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
  subdivisions: number;
  thickness: number;
};

export type WallPatternKind =
  | "architectural-charcoal"
  | "warm-fluted-wood"
  | "urban-brick"
  | "brushed-titanium"
  | "cyber-neon-panel"
  | "curtain-glass";

export type WallMaterialSpec = {
  id: string;
  pattern: WallPatternKind;
  baseColor: string;
  wainscotColor: string;
  capColor: string;
  trimColor: string;
  coveEmissive: string;
  coveIntensity: number;
  roughness: number;
  metalness: number;
  transparent: boolean;
  opacity: number;
};

export type RoomBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  span: number;
  hasFloors: boolean;
};

export type SlabProfile = {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  thickness: number;
  topY: number;
  rimColor: string;
  baseColor: string;
  trimColor: string;
  showPlotGuide: boolean;
  plotCenterX: number;
  plotCenterZ: number;
  plotWidth: number;
  plotDepth: number;
};

export type WallTopologyRole = {
  role: "interior" | "perimeter" | "freestanding";
  hasNegativeFloor: boolean;
  hasPositiveFloor: boolean;
  outwardNormal: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  center: { x: number; z: number };
};

export type WallCutawayInput = {
  wall: WallSegment;
  cutaway: boolean;
  selected?: boolean;
  floorKeys: ReadonlySet<string>;
  roomBounds: RoomBounds;
  cameraPosition: { x: number; y?: number; z: number };
  avatarPosition?: { x: number; z: number };
};

export type WallCutawayMode = "full" | "front-cutaway" | "interior-cutaway";

export type WallCutawayState = {
  mode: WallCutawayMode;
  role: WallTopologyRole["role"];
  cutawayActive: boolean;
  occludesAvatar: boolean;
  solidHeightScale: number;
  solidOpacity: number;
  retainOpeningPortal: boolean;
  openingFrameOpacity: number;
  openingGlassOpacity: number;
  capHeight: number;
  balustradeVisible: boolean;
  balustradeHeight: number;
};

export type InteriorLightSpec = {
  id: string;
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  decay: number;
  kind: "warm-key" | "warm-zone" | "cyber-accent" | "furniture-glow" | "city-rim";
};

export type ApartmentLightingRig = {
  background: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  keyLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
  };
  cityRimLight: {
    position: [number, number, number];
    color: string;
    intensity: number;
  };
  skylineVioletRim: {
    position: [number, number, number];
    color: string;
    intensity: number;
  };
  pointLights: InteriorLightSpec[];
};

export type InteriorAccentZone = {
  id: string;
  kind: "bed-rug" | "lounge-rug" | "desk-mat" | "lamp-halo";
  x: number;
  z: number;
  level: number;
  width: number;
  depth: number;
  primaryColor: string;
  borderColor: string;
  glowColor: string;
  glowOpacity: number;
};

export type ApartmentFloorZone = "living-wood" | "entry-stone" | "bath-ceramic";

export type FloorTransitionStrip = {
  id: string;
  x: number;
  z: number;
  level: number;
  orientation: "x" | "z";
  length: number;
  width: number;
  height: number;
  primaryColor: string;
  revealColor: string;
  fromMaterialId: string;
  toMaterialId: string;
};

const FLOOR_SPECS: Record<string, FloorMaterialSpec> = {
  "floor-concrete": {
    id: "floor-concrete",
    pattern: "honed-stone",
    baseColor: "#383336",
    secondaryColor: "#4a4347",
    seamColor: "#242022",
    accentColor: "#b88958",
    roughness: 0.28,
    metalness: 0.24,
    bumpScale: 0.012,
    emissive: "#1f1510",
    emissiveIntensity: 0.2,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-wood": {
    id: "floor-wood",
    pattern: "warm-plank",
    // Reference-locked penthouse palette: the wood is almost graphite in
    // shadow and only turns amber where the practical lights hit it.
    baseColor: "#4b3329",
    secondaryColor: "#694735",
    seamColor: "#241815",
    accentColor: "#b8754a",
    roughness: 0.31,
    metalness: 0.16,
    bumpScale: 0.016,
    emissive: "#241108",
    emissiveIntensity: 0.16,
    transparent: false,
    opacity: 1,
    subdivisions: 4,
    thickness: 0.12,
  },
  "floor-tile": {
    id: "floor-tile",
    pattern: "ceramic-grid",
    baseColor: "#58626c",
    secondaryColor: "#6d7882",
    seamColor: "#343b42",
    accentColor: "#98a6b3",
    roughness: 0.26,
    metalness: 0.26,
    bumpScale: 0.012,
    emissive: "#161d24",
    emissiveIntensity: 0.16,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-ceramic": {
    id: "floor-ceramic",
    pattern: "ceramic-grid",
    baseColor: "#302b2b",
    secondaryColor: "#453b39",
    seamColor: "#1d191a",
    accentColor: "#9f8170",
    roughness: 0.29,
    metalness: 0.18,
    bumpScale: 0.012,
    emissive: "#17100e",
    emissiveIntensity: 0.08,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-metal": {
    id: "floor-metal",
    pattern: "honed-stone",
    baseColor: "#6d7f8b",
    secondaryColor: "#8599a6",
    seamColor: "#303a42",
    accentColor: "#b4c8d6",
    roughness: 0.26,
    metalness: 0.68,
    bumpScale: 0.014,
    emissive: "#18242e",
    emissiveIntensity: 0.18,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-marble": {
    id: "floor-marble",
    pattern: "ceramic-grid",
    baseColor: "#43536d",
    secondaryColor: "#5b6f8f",
    seamColor: "#222b3a",
    accentColor: "#a5c0e5",
    roughness: 0.18,
    metalness: 0.36,
    bumpScale: 0.012,
    emissive: "#192336",
    emissiveIntensity: 0.22,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-luxury": {
    id: "floor-luxury",
    pattern: "neon-circuit",
    baseColor: "#352854",
    secondaryColor: "#4a3873",
    seamColor: "#1a132b",
    accentColor: "#a87dff",
    roughness: 0.24,
    metalness: 0.52,
    bumpScale: 0.016,
    emissive: "#482680",
    emissiveIntensity: 0.58,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "roof-terrace": {
    id: "roof-terrace",
    pattern: "warm-plank",
    baseColor: "#586e68",
    secondaryColor: "#6f8a82",
    seamColor: "#2b3835",
    accentColor: "#9ab5ad",
    roughness: 0.48,
    metalness: 0.2,
    bumpScale: 0.018,
    emissive: "#162420",
    emissiveIntensity: 0.16,
    transparent: false,
    opacity: 1,
    subdivisions: 4,
    thickness: 0.12,
  },
  "floor-carpet": {
    id: "floor-carpet",
    pattern: "woven-carpet",
    baseColor: "#614e75",
    secondaryColor: "#786290",
    seamColor: "#3b2e4a",
    accentColor: "#9a82b3",
    roughness: 0.86,
    metalness: 0.04,
    bumpScale: 0.025,
    emissive: "#1f162b",
    emissiveIntensity: 0.18,
    transparent: false,
    opacity: 1,
    subdivisions: 1,
    thickness: 0.13,
  },
  "floor-neon": {
    id: "floor-neon",
    pattern: "neon-circuit",
    baseColor: "#253548",
    secondaryColor: "#31475e",
    seamColor: "#121b26",
    accentColor: "#38e8ff",
    roughness: 0.26,
    metalness: 0.48,
    bumpScale: 0.016,
    emissive: "#164e5e",
    emissiveIntensity: 0.55,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "floor-glass": {
    id: "floor-glass",
    pattern: "structural-glass",
    baseColor: "#7fd4e2",
    secondaryColor: "#a8e8f2",
    seamColor: "#345c68",
    accentColor: "#53f5e2",
    roughness: 0.12,
    metalness: 0.65,
    bumpScale: 0.008,
    emissive: "#184754",
    emissiveIntensity: 0.36,
    transparent: true,
    opacity: 0.68,
    subdivisions: 2,
    thickness: 0.1,
  },
  "ceiling-basic": {
    id: "ceiling-basic",
    pattern: "acoustic-ceiling",
    baseColor: "#323b48",
    secondaryColor: "#3f4a59",
    seamColor: "#1d242e",
    accentColor: "#5b697c",
    roughness: 0.64,
    metalness: 0.18,
    bumpScale: 0.012,
    emissive: "#121720",
    emissiveIntensity: 0.12,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.1,
  },
  "ceiling-lights": {
    id: "ceiling-lights",
    pattern: "luminous-coffer",
    baseColor: "#4c6278",
    secondaryColor: "#6985a0",
    seamColor: "#23303d",
    accentColor: "#ffcf96",
    roughness: 0.3,
    metalness: 0.32,
    bumpScale: 0.012,
    emissive: "#ffbe78",
    emissiveIntensity: 0.52,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.1,
  },
  "roof-flat": {
    id: "roof-flat",
    pattern: "weather-deck",
    baseColor: "#293342",
    secondaryColor: "#364356",
    seamColor: "#171e28",
    accentColor: "#4f6078",
    roughness: 0.58,
    metalness: 0.24,
    bumpScale: 0.016,
    emissive: "#0d131c",
    emissiveIntensity: 0.1,
    transparent: false,
    opacity: 1,
    subdivisions: 2,
    thickness: 0.12,
  },
  "roof-glass": {
    id: "roof-glass",
    pattern: "structural-glass",
    baseColor: "#72c4d4",
    secondaryColor: "#99dce8",
    seamColor: "#2e525d",
    accentColor: "#4be8ff",
    roughness: 0.14,
    metalness: 0.62,
    bumpScale: 0.008,
    emissive: "#153d4a",
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.62,
    subdivisions: 2,
    thickness: 0.1,
  },
};

const WALL_SPECS: Record<string, WallMaterialSpec> = {
  "wall-basic": {
    id: "wall-basic",
    pattern: "architectural-charcoal",
    baseColor: "#242833",
    wainscotColor: "#35241b",
    capColor: "#4f4a4b",
    trimColor: "#79543a",
    coveEmissive: "#ffb45f",
    coveIntensity: 0.9,
    roughness: 0.5,
    metalness: 0.24,
    transparent: false,
    opacity: 1,
  },
  "wall-wood": {
    id: "wall-wood",
    pattern: "warm-fluted-wood",
    baseColor: "#5c3928",
    wainscotColor: "#42271b",
    capColor: "#805337",
    trimColor: "#a66b43",
    coveEmissive: "#ffc27d",
    coveIntensity: 0.86,
    roughness: 0.42,
    metalness: 0.14,
    transparent: false,
    opacity: 1,
  },
  "wall-brick": {
    id: "wall-brick",
    pattern: "urban-brick",
    baseColor: "#7d4640",
    wainscotColor: "#453835",
    capColor: "#6e625f",
    trimColor: "#9e7b66",
    coveEmissive: "#ffb36b",
    coveIntensity: 0.9,
    roughness: 0.68,
    metalness: 0.1,
    transparent: false,
    opacity: 1,
  },
  "wall-metal": {
    id: "wall-metal",
    pattern: "brushed-titanium",
    baseColor: "#536273",
    wainscotColor: "#384452",
    capColor: "#7c8ea1",
    trimColor: "#9ab0c4",
    coveEmissive: "#5ce1ff",
    coveIntensity: 0.9,
    roughness: 0.32,
    metalness: 0.62,
    transparent: false,
    opacity: 1,
  },
  "wall-neon": {
    id: "wall-neon",
    pattern: "cyber-neon-panel",
    baseColor: "#2d3252",
    wainscotColor: "#222640",
    capColor: "#5c6799",
    trimColor: "#a47aff",
    coveEmissive: "#9d73ff",
    coveIntensity: 1.45,
    roughness: 0.36,
    metalness: 0.48,
    transparent: false,
    opacity: 1,
  },
  "wall-glass": {
    id: "wall-glass",
    pattern: "curtain-glass",
    baseColor: "#7dd0e0",
    wainscotColor: "#365663",
    capColor: "#8eb2c2",
    trimColor: "#9ab8c7",
    coveEmissive: "#48e5ff",
    coveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.68,
    transparent: true,
    opacity: 0.42,
  },
};

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map(ch => ch + ch)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const num = Number.parseInt(normalized, 16);
  if (Number.isNaN(num)) return [128, 128, 128];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const ratio = Math.max(0, Math.min(1, t));
  return [
    clampByte(a[0] + (b[0] - a[0]) * ratio),
    clampByte(a[1] + (b[1] - a[1]) * ratio),
    clampByte(a[2] + (b[2] - a[2]) * ratio),
  ];
}

function hash2d(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function getFloorMaterialSpec(materialId?: string): FloorMaterialSpec {
  if (materialId && FLOOR_SPECS[materialId]) return FLOOR_SPECS[materialId];
  return FLOOR_SPECS["floor-concrete"];
}

export function getWallMaterialSpec(materialId?: string): WallMaterialSpec {
  if (materialId && WALL_SPECS[materialId]) return WALL_SPECS[materialId];
  return WALL_SPECS["wall-basic"];
}

export function classifyApartmentFloorZone(x: number, z: number): ApartmentFloorZone {
  if (x <= -3 && z >= 0) {
    return "entry-stone";
  }
  if (x >= 3 && z >= 1) {
    return "bath-ceramic";
  }
  return "living-wood";
}

export const resolveApartmentFloorZone = classifyApartmentFloorZone;

export function resolveApartmentFloorMaterial(cell: FloorCell, isFixedShell = true): string {
  if (!isFixedShell || cell.level !== 0 || cell.materialId !== "floor-concrete") {
    return cell.materialId;
  }
  const zone = classifyApartmentFloorZone(cell.x, cell.z);
  if (zone === "living-wood") return "floor-wood";
  if (zone === "bath-ceramic") return "floor-ceramic";
  return "floor-concrete";
}

export function resolveApartmentWallMaterial(
  wall: WallSegment,
  isFixedShell = true,
  plot: Plot = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 }
): string {
  if (!isFixedShell || wall.level !== 0 || wall.materialId !== "wall-basic") {
    return wall.materialId;
  }
  if (wall.orientation === "x" && wall.z === plot.minZ && wall.x < -2 && !wall.opening) {
    return "wall-wood";
  }
  return wall.materialId;
}

export function computeArchitecturalFloorTransitions(
  floors: FloorCell[],
  level: number,
  isFixedShell = true
): FloorTransitionStrip[] {
  const levelFloors = floors.filter(cell => cell.level === level);
  if (levelFloors.length === 0) return [];

  const cellMap = new Map<string, string>();
  for (const cell of levelFloors) {
    cellMap.set(`${cell.x}:${cell.z}`, resolveApartmentFloorMaterial(cell, isFixedShell));
  }

  type RawEdge = {
    orientation: "x" | "z";
    line: number;
    spanStart: number;
    fromMat: string;
    toMat: string;
  };
  const rawEdges: RawEdge[] = [];

  for (const cell of levelFloors) {
    const mat = cellMap.get(`${cell.x}:${cell.z}`)!;
    const eastMat = cellMap.get(`${cell.x + 1}:${cell.z}`);
    if (eastMat && eastMat !== mat) {
      rawEdges.push({
        orientation: "z",
        line: cell.x + 1,
        spanStart: cell.z,
        fromMat: mat,
        toMat: eastMat,
      });
    }
    const southMat = cellMap.get(`${cell.x}:${cell.z + 1}`);
    if (southMat && southMat !== mat) {
      rawEdges.push({
        orientation: "x",
        line: cell.z + 1,
        spanStart: cell.x,
        fromMat: mat,
        toMat: southMat,
      });
    }
  }

  rawEdges.sort((a, b) => {
    if (a.orientation !== b.orientation) return a.orientation.localeCompare(b.orientation);
    if (a.line !== b.line) return a.line - b.line;
    return a.spanStart - b.spanStart;
  });

  const strips: FloorTransitionStrip[] = [];
  for (const edge of rawEdges) {
    const prev = strips[strips.length - 1];
    const expectedCenter = edge.spanStart + 0.5;
    if (
      prev &&
      prev.orientation === edge.orientation &&
      prev.fromMaterialId === edge.fromMat &&
      prev.toMaterialId === edge.toMat &&
      ((edge.orientation === "x" && prev.z === edge.line && Math.abs(prev.x + prev.length * 0.5 - edge.spanStart) < 1e-3) ||
        (edge.orientation === "z" && prev.x === edge.line && Math.abs(prev.z + prev.length * 0.5 - edge.spanStart) < 1e-3))
    ) {
      const nextLength = prev.length + 1;
      if (edge.orientation === "x") {
        prev.x = prev.x + 0.5;
      } else {
        prev.z = prev.z + 0.5;
      }
      prev.length = nextLength;
    } else {
      const usesWarmBrass = edge.fromMat === "floor-wood" || edge.toMat === "floor-wood";
      strips.push({
        id: `transition:${level}:${edge.orientation}:${edge.line}:${edge.spanStart}`,
        x: edge.orientation === "x" ? expectedCenter : edge.line,
        z: edge.orientation === "z" ? expectedCenter : edge.line,
        level,
        orientation: edge.orientation,
        length: 1,
        width: 0.044,
        height: 0.012,
        primaryColor: usesWarmBrass ? "#c29258" : "#708499",
        revealColor: "#202630",
        fromMaterialId: edge.fromMat,
        toMaterialId: edge.toMat,
      });
    }
  }

  return strips;
}

export function createFloorPatternPixels(materialId: string, size = 64): Uint8Array {
  const safeSize = Math.max(8, Math.min(256, Math.floor(size)));
  const spec = getFloorMaterialSpec(materialId);
  const pixels = new Uint8Array(safeSize * safeSize * 4);
  const base = parseHexRgb(spec.baseColor);
  const secondary = parseHexRgb(spec.secondaryColor);
  const seam = parseHexRgb(spec.seamColor);
  const accent = parseHexRgb(spec.accentColor);

  for (let y = 0; y < safeSize; y++) {
    const v = y / safeSize;
    for (let x = 0; x < safeSize; x++) {
      const u = x / safeSize;
      const noise = hash2d(x, y);
      let rgb: [number, number, number] = [...base];

      if (spec.pattern === "honed-stone") {
        const veinPrimary = Math.abs(Math.sin((u * 2.4 + v * 1.8 + Math.sin(v * 4.2) * 0.18) * Math.PI));
        const veinSecondary = Math.abs(Math.sin((u * 5.1 - v * 3.7) * Math.PI));
        const wave = Math.sin((u * 3.2 + v * 2.6) * Math.PI) * 0.5 + 0.5;
        const hairline = Math.min(u, 1 - u, v, 1 - v);
        if (hairline < 0.016) {
          rgb = mixRgb(base, seam, 0.55);
        } else if (veinPrimary > 0.955) {
          rgb = mixRgb(secondary, accent, 0.62);
        } else if (veinSecondary > 0.965) {
          rgb = mixRgb(base, accent, 0.35);
        } else {
          const tone = mixRgb(base, secondary, wave * 0.45 + noise * 0.14);
          rgb = noise > 0.9 ? mixRgb(tone, accent, 0.2) : tone;
        }
      } else if (spec.pattern === "warm-plank") {
        const plankRow = Math.floor(v * 4);
        const localV = (v * 4) % 1;
        const stagger = (plankRow % 2) * 0.5;
        const shiftedU = (u + stagger) % 1;
        const seamDist = Math.min(localV, 1 - localV, shiftedU, 1 - shiftedU);
        if (localV < 0.032 || localV > 0.968 || shiftedU < 0.016) {
          rgb = mixRgb(base, seam, 0.68);
        } else {
          const grain =
            Math.sin((v * 72 + Math.sin(u * 6.5 + plankRow) * 0.65 + Math.sin(u * 17) * 0.12) * Math.PI) * 0.5 + 0.5;
          const plankTint = hash2d(plankRow, 9) * 0.22;
          const tone = mixRgb(base, secondary, Math.min(1, grain * 0.38 + plankTint));
          const pore = grain < 0.1 ? mixRgb(tone, seam, 0.14) : tone;
          rgb = seamDist < 0.06 ? mixRgb(pore, accent, 0.16) : mixRgb(pore, accent, noise * 0.08);
        }
      } else if (spec.pattern === "ceramic-grid") {
        const subU = (u * 2) % 1;
        const subV = (v * 2) % 1;
        const edge = Math.min(subU, 1 - subU, subV, 1 - subV);
        if (edge < 0.024) {
          rgb = mixRgb(base, seam, 0.65);
        } else {
          const vein = Math.abs(Math.sin((u * 3.2 - v * 3.2) * Math.PI));
          const tone = mixRgb(base, secondary, vein > 0.88 ? 0.65 : 0.22 + noise * 0.14);
          rgb = vein > 0.945 ? mixRgb(tone, accent, 0.42) : tone;
        }
      } else if (spec.pattern === "woven-carpet") {
        const tuft = ((x + y) % 2 === 0 ? 0.62 : 0.22) + (noise - 0.5) * 0.18;
        const border = Math.min(u, 1 - u, v, 1 - v);
        rgb = border < 0.05 ? mixRgb(seam, accent, 0.4) : mixRgb(base, secondary, tuft);
      } else if (spec.pattern === "neon-circuit") {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        const cross = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5));
        if (edge < 0.03) {
          rgb = seam;
        } else if (edge >= 0.055 && edge <= 0.095) {
          rgb = accent;
        } else if (cross < 0.02) {
          rgb = mixRgb(secondary, accent, 0.55);
        } else {
          rgb = mixRgb(base, secondary, noise * 0.25);
        }
      } else if (spec.pattern === "structural-glass") {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        const diag = Math.sin((u + v) * Math.PI * 2) * 0.5 + 0.5;
        if (edge < 0.045) {
          rgb = seam;
        } else if (edge < 0.075) {
          rgb = accent;
        } else {
          rgb = mixRgb(base, secondary, diag * 0.55);
        }
      } else if (spec.pattern === "luminous-coffer") {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        rgb = edge < 0.08 ? seam : edge < 0.16 ? accent : mixRgb(base, secondary, 0.4);
      } else {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        rgb = edge < 0.03 ? seam : mixRgb(base, secondary, noise * 0.35);
      }

      const idx = (y * safeSize + x) * 4;
      pixels[idx] = rgb[0];
      pixels[idx + 1] = rgb[1];
      pixels[idx + 2] = rgb[2];
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

export function createFloorDataTexture(materialId: string, size = 64): THREE.DataTexture {
  const safeSize = Math.max(8, Math.min(256, Math.floor(size)));
  const data = createFloorPatternPixels(materialId, safeSize);
  const texture = new THREE.DataTexture(data, safeSize, safeSize, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createFabricDataTexture(primaryColor: string, borderColor: string): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const base = parseHexRgb(primaryColor);
  const border = parseHexRgb(borderColor);
  const thread: [number, number, number] = [192, 173, 147];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const weave = (x % 3 === 0 ? 0.1 : -0.04) + (y % 3 === 0 ? 0.08 : 0) + hash2d(x, y) * 0.07;
      const diamond =
        Math.abs(((u + v) * 9) % 1 - 0.5) < 0.045 || Math.abs(((u - v + 1) * 9) % 1 - 0.5) < 0.045;
      const stitched = (edge > 0.035 && edge < 0.055) || (edge > 0.1 && edge < 0.115);
      const tone = edge < 0.12 ? mixRgb(base, border, 0.7) : base;
      const rgb = mixRgb(tone, thread, Math.max(0, weave + (stitched ? 0.38 : diamond ? 0.12 : 0)));
      const index = (y * size + x) * 4;
      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createWallPatternPixels(materialId: string, size = 64): Uint8Array {
  const safeSize = Math.max(8, Math.min(256, Math.floor(size)));
  const spec = getWallMaterialSpec(materialId);
  const pixels = new Uint8Array(safeSize * safeSize * 4);
  const base = parseHexRgb(spec.baseColor);
  const wainscot = parseHexRgb(spec.wainscotColor);
  const trim = parseHexRgb(spec.trimColor);

  for (let y = 0; y < safeSize; y++) {
    const v = y / safeSize;
    for (let x = 0; x < safeSize; x++) {
      const u = x / safeSize;
      const noise = hash2d(x, y);
      let rgb: [number, number, number] = [...base];

      if (spec.pattern === "warm-fluted-wood") {
        const slat = (u * 8) % 1;
        rgb = slat < 0.14 ? wainscot : mixRgb(base, trim, Math.sin(slat * Math.PI) * 0.45 + noise * 0.1);
      } else if (spec.pattern === "urban-brick") {
        const row = Math.floor(v * 6);
        const localV = (v * 6) % 1;
        const localU = ((u + (row % 2) * 0.5) * 3) % 1;
        rgb = localV < 0.12 || localU < 0.08 ? wainscot : mixRgb(base, trim, noise * 0.3);
      } else if (spec.pattern === "brushed-titanium") {
        const seam = Math.min(u, 1 - u, v, 1 - v);
        const brush = Math.sin(v * Math.PI * 16) * 0.5 + 0.5;
        rgb = seam < 0.04 ? wainscot : mixRgb(base, trim, brush * 0.28);
      } else if (spec.pattern === "cyber-neon-panel") {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        rgb = edge < 0.04 ? trim : mixRgb(base, wainscot, v * 0.4 + noise * 0.15);
      } else {
        const panelEdge = Math.min((u * 2) % 1, 1 - ((u * 2) % 1));
        const lowerBand = v < 0.28;
        const bandTone = lowerBand ? mixRgb(base, wainscot, 0.58) : base;
        rgb = panelEdge < 0.03 ? wainscot : mixRgb(bandTone, trim, (1 - v) * 0.16 + noise * 0.08);
      }

      const idx = (y * safeSize + x) * 4;
      pixels[idx] = rgb[0];
      pixels[idx + 1] = rgb[1];
      pixels[idx + 2] = rgb[2];
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

export function createWallDataTexture(materialId: string, size = 64): THREE.DataTexture {
  const safeSize = Math.max(8, Math.min(256, Math.floor(size)));
  const data = createWallPatternPixels(materialId, safeSize);
  const texture = new THREE.DataTexture(data, safeSize, safeSize, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function computeRoomBounds(floors: FloorCell[], level: number, plot?: Plot): RoomBounds {
  const levelFloors = floors.filter(cell => cell.level === level);
  const active = levelFloors.length > 0 ? levelFloors : floors;
  if (active.length === 0) {
    const minX = plot?.minX ?? -6;
    const maxX = plot?.maxX ?? 6;
    const minZ = plot?.minZ ?? -5;
    const maxZ = plot?.maxZ ?? 5;
    const width = Math.max(1, maxX - minX);
    const depth = Math.max(1, maxZ - minZ);
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      width,
      depth,
      span: Math.max(width, depth),
      hasFloors: false,
    };
  }
  const minX = Math.min(...active.map(cell => cell.x));
  const maxX = Math.max(...active.map(cell => cell.x)) + 1;
  const minZ = Math.min(...active.map(cell => cell.z));
  const maxZ = Math.max(...active.map(cell => cell.z)) + 1;
  const width = Math.max(1, maxX - minX);
  const depth = Math.max(1, maxZ - minZ);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width,
    depth,
    span: Math.max(width, depth),
    hasFloors: true,
  };
}

export function computeSlabProfile(bounds: RoomBounds, plot: Plot, editing: boolean, fullPlot = false): SlabProfile {
  const overhang = bounds.hasFloors ? 0.38 : 0;
  const width = fullPlot ? Math.max(bounds.width + overhang * 2, plot.maxX - plot.minX) : bounds.hasFloors ? bounds.width + overhang * 2 : Math.max(1, plot.maxX - plot.minX);
  const depth = fullPlot ? Math.max(bounds.depth + overhang * 2, plot.maxZ - plot.minZ) : bounds.hasFloors ? bounds.depth + overhang * 2 : Math.max(1, plot.maxZ - plot.minZ);
  const centerX = fullPlot && width > bounds.width + overhang * 2 ? (plot.minX + plot.maxX) / 2 : bounds.centerX;
  const centerZ = fullPlot && depth > bounds.depth + overhang * 2 ? (plot.minZ + plot.maxZ) / 2 : bounds.centerZ;
  return {
    centerX,
    centerZ,
    width,
    depth,
    thickness: 0.32,
    topY: -0.12,
    baseColor: "#1d232f",
    trimColor: "#5e4e42",
    rimColor: "#ffae54",
    showPlotGuide: editing,
    plotCenterX: (plot.minX + plot.maxX) / 2,
    plotCenterZ: (plot.minZ + plot.maxZ) / 2,
    plotWidth: Math.max(1, plot.maxX - plot.minX),
    plotDepth: Math.max(1, plot.maxZ - plot.minZ),
  };
}

export function computeFloorCellTint(
  cell: FloorCell,
  roomBounds?: RoomBounds
): { r: number; g: number; b: number; hex: string } {
  const spec = getFloorMaterialSpec(cell.materialId);
  const wave = (Math.sin(cell.x * 0.65 + cell.z * 0.85) * 0.5 + 0.5) * 0.032;
  let radialWarmth = 0.58;
  if (roomBounds && roomBounds.hasFloors) {
    const dx = (cell.x + 0.5 - roomBounds.centerX) / Math.max(2, roomBounds.width * 0.58);
    const dz = (cell.z + 0.5 - roomBounds.centerZ) / Math.max(2, roomBounds.depth * 0.58);
    const dist = Math.min(1.2, Math.hypot(dx, dz));
    radialWarmth = Math.max(0, 1 - dist * 0.68);
  }
  const warmBoost = spec.pattern === "neon-circuit" || spec.pattern === "structural-glass" ? 0.025 : 0.075;
  const r = Math.min(1, Math.max(0.82, 0.93 + wave + radialWarmth * warmBoost));
  const g = Math.min(1, Math.max(0.79, 0.9 + wave * 0.85 + radialWarmth * (warmBoost * 0.65)));
  const b = Math.min(1, Math.max(0.75, 0.86 + wave * 0.6 + radialWarmth * 0.015));
  const color = new THREE.Color(r, g, b);
  return { r, g, b, hex: `#${color.getHexString()}` };
}

export function classifyWallRole(
  wall: WallSegment,
  floorKeys: ReadonlySet<string>,
  roomBounds?: RoomBounds
): WallTopologyRole {
  const center = {
    x: wall.x + (wall.orientation === "x" ? 0.5 : 0),
    z: wall.z + (wall.orientation === "z" ? 0.5 : 0),
  };
  const negativeCell =
    wall.orientation === "x"
      ? { x: wall.x, z: wall.z - 1, level: wall.level }
      : { x: wall.x - 1, z: wall.z, level: wall.level };
  const positiveCell = { x: wall.x, z: wall.z, level: wall.level };
  const hasNegativeFloor = floorKeys.has(cellKey(negativeCell));
  const hasPositiveFloor = floorKeys.has(cellKey(positiveCell));

  if (hasNegativeFloor && hasPositiveFloor) {
    const cx = roomBounds?.centerX ?? 0;
    const cz = roomBounds?.centerZ ?? 0;
    const sign = wall.orientation === "x" ? (center.z >= cz ? 1 : -1) : center.x >= cx ? 1 : -1;
    const outwardNormal = wall.orientation === "x" ? { x: 0, z: sign } : { x: sign, z: 0 };
    return {
      role: "interior",
      hasNegativeFloor,
      hasPositiveFloor,
      outwardNormal,
      inwardNormal: { x: -outwardNormal.x, z: -outwardNormal.z },
      center,
    };
  }

  if (hasNegativeFloor || hasPositiveFloor) {
    const sign = hasNegativeFloor ? 1 : -1;
    const outwardNormal = wall.orientation === "x" ? { x: 0, z: sign } : { x: sign, z: 0 };
    return {
      role: "perimeter",
      hasNegativeFloor,
      hasPositiveFloor,
      outwardNormal,
      inwardNormal: { x: -outwardNormal.x, z: -outwardNormal.z },
      center,
    };
  }

  const cx = roomBounds?.centerX ?? 0;
  const cz = roomBounds?.centerZ ?? 0;
  const sign = wall.orientation === "x" ? (center.z >= cz ? 1 : -1) : center.x >= cx ? 1 : -1;
  const outwardNormal = wall.orientation === "x" ? { x: 0, z: sign } : { x: sign, z: 0 };
  return {
    role: "freestanding",
    hasNegativeFloor: false,
    hasPositiveFloor: false,
    outwardNormal,
    inwardNormal: { x: -outwardNormal.x, z: -outwardNormal.z },
    center,
  };
}

function segmentOccludesAvatar(
  wallCenter: { x: number; z: number },
  wall: WallSegment,
  cameraPosition: { x: number; y?: number; z: number },
  avatarPosition?: { x: number; z: number }
): boolean {
  if (!avatarPosition) return false;
  const axis = wall.orientation === "z" ? "x" : "z";
  const tangent = axis === "x" ? "z" : "x";
  const denominator = avatarPosition[axis] - cameraPosition[axis];
  if (Math.abs(denominator) < 1e-4) return false;
  const t = (wallCenter[axis] - cameraPosition[axis]) / denominator;
  if (t <= 0 || t >= 1) return false;
  const hit = cameraPosition[tangent] + (avatarPosition[tangent] - cameraPosition[tangent]) * t;
  if (Math.abs(hit - wallCenter[tangent]) > 0.8) return false;
  const baseY = wall.level * LEVEL_HEIGHT;
  const cameraY = cameraPosition.y ?? baseY + 1.2;
  const hitY = cameraY + (baseY + 1.2 - cameraY) * t;
  return hitY >= baseY && hitY <= baseY + (buildingItem(wall.materialId)?.height ?? 2.8);
}

export function clipWallPart(
  part: { y: number; height: number },
  heightLimit: number
): { y: number; height: number; visible: boolean } {
  const bottom = part.y - part.height / 2;
  const top = Math.min(part.y + part.height / 2, heightLimit);
  const height = Math.max(0, top - bottom);
  return { y: bottom + height / 2, height, visible: height > 0 };
}

export function evaluateWallCutaway(input: WallCutawayInput): WallCutawayState {
  const topology = classifyWallRole(input.wall, input.floorKeys, input.roomBounds);
  const occludesAvatar = segmentOccludesAvatar(
    topology.center,
    input.wall,
    input.cameraPosition,
    input.avatarPosition
  );

  const wallHeight = buildingItem(input.wall.materialId)?.height ?? 2.8;
  if (!input.cutaway || input.selected) {
    return {
      mode: "full",
      role: topology.role,
      cutawayActive: false,
      occludesAvatar,
      solidHeightScale: 1,
      solidOpacity: 1,
      retainOpeningPortal: true,
      openingFrameOpacity: 1,
      openingGlassOpacity: 0.32,
      capHeight: wallHeight,
      balustradeVisible: false,
      balustradeHeight: 0,
    };
  }

  if (topology.role === "interior" && occludesAvatar) {
    const solidHeightScale = 0.19;
    return {
      mode: "interior-cutaway",
      role: "interior",
      cutawayActive: true,
      occludesAvatar,
      solidHeightScale,
      solidOpacity: 1,
      retainOpeningPortal: true,
      openingFrameOpacity: 0.44,
      openingGlassOpacity: 0.22,
      capHeight: wallHeight * solidHeightScale,
      balustradeVisible: false,
      balustradeHeight: 0,
    };
  }

  const camVecX = input.cameraPosition.x - topology.center.x;
  const camVecZ = input.cameraPosition.z - topology.center.z;
  const dot = topology.outwardNormal.x * camVecX + topology.outwardNormal.z * camVecZ;
  const cameraFacing = dot > 0.05;

  const isNorthEastPanoramaReturn =
    topology.role === "perimeter" &&
    input.wall.orientation === "z" &&
    input.wall.x === input.roomBounds.maxX &&
    input.wall.z >= input.roomBounds.minZ &&
    input.wall.z <= -3 &&
    input.roomBounds.width === 12 &&
    input.roomBounds.depth === 10 &&
    input.cameraPosition.z > 0;

  if (
    !isNorthEastPanoramaReturn &&
    ((topology.role === "perimeter" && cameraFacing) || (topology.role === "freestanding" && occludesAvatar))
  ) {
    const solidHeightScale = 0.15;
    return {
      mode: "front-cutaway",
      role: topology.role,
      cutawayActive: true,
      occludesAvatar,
      solidHeightScale,
      solidOpacity: 1,
      retainOpeningPortal: true,
      openingFrameOpacity: 0.36,
      openingGlassOpacity: 0.18,
      capHeight: wallHeight * solidHeightScale,
      balustradeVisible: topology.role === "perimeter" && !input.wall.opening,
      balustradeHeight: 0.46,
    };
  }

  return {
    mode: "full",
    role: topology.role,
    cutawayActive: false,
    occludesAvatar,
    solidHeightScale: 1,
    solidOpacity: 1,
    retainOpeningPortal: true,
    openingFrameOpacity: 1,
    openingGlassOpacity: 0.32,
    capHeight: wallHeight,
    balustradeVisible: false,
    balustradeHeight: 0,
  };
}


export function computeApartmentLightingRig(
  bounds: RoomBounds,
  level: number,
  furniture: BuildingFurniture[],
  quality?: string,
  activeInstances: Readonly<Record<string, boolean>> = {}
): ApartmentLightingRig {
  const baseY = level * LEVEL_HEIGHT;
  const cx = bounds.centerX;
  const cz = bounds.centerZ;
  const rx = Math.max(2.2, bounds.width * 0.28);
  const rz = Math.max(2.2, bounds.depth * 0.28);
  const low = quality === "performance";

  const pointLights: InteriorLightSpec[] = [
    {
      id: "interior-warm-hearth",
      position: [cx - 0.5, baseY + 2.0, cz + 0.4],
      color: "#ffc07f",
      intensity: low ? 23 : 29,
      distance: Math.max(8, Math.min(11, bounds.span * 0.8)),
      decay: 2,
      kind: "warm-key",
    },
    {
      id: "interior-bedroom-warmth",
      position: [cx - rx * 1.05, baseY + 2.15, cz - rz * 0.72],
      color: "#ffb26b",
      intensity: low ? 18 : 23,
      distance: Math.max(6, Math.min(8, bounds.span * 0.65)),
      decay: 2,
      kind: "warm-zone",
    },
    {
      id: "interior-lounge-warmth",
      position: [cx + rx * 0.45, baseY + 2.2, cz + rz * 0.78],
      color: "#ffd09a",
      intensity: low ? 16 : 20,
      distance: Math.max(6, Math.min(8, bounds.span * 0.65)),
      decay: 2,
      kind: "warm-zone",
    },
    {
      id: "interior-cyber-workstation",
      position: [cx + rx * 0.92, baseY + 1.95, cz - rz * 0.85],
      color: "#20d9ff",
      intensity: low ? 0.6 : 1,
      distance: 2.8,
      decay: 2,
      kind: "cyber-accent",
    },
  ];

  if (!low) {
    const levelFurniture = furniture.filter(item => item.level === level);
    for (const item of levelFurniture) {
      const def = FURNITURE.find(entry => entry.id === item.furnitureId);
      const w = def?.width ?? 1;
      const d = def?.depth ?? 1;
      const fx = item.parent_id && item.transform ? item.transform.position.x : item.x + w * 0.5;
      const fz = item.parent_id && item.transform ? item.transform.position.z : item.z + d * 0.5;
      const active = activeInstances[item.id] ?? (item.light_dimmer_value ?? 3) > 0;
      if (def?.category === "light") {
        const dimmer = Math.max(0, Math.min(5, item.light_dimmer_value ?? 3));
        const fy = item.parent_id && item.transform ? item.transform.position.y + Math.min(def.height ?? 1, 1) * 0.5
          : item.placementType === "ceiling" ? baseY + (item.ceilingY ?? LEVEL_HEIGHT - 0.12) - 0.25
            : item.placementType === "wall" ? baseY + (item.wallY ?? 1.5) : baseY + 1.65;
        pointLights.push({
          id: `furniture-light:${item.id}`,
          position: [fx, fy, fz],
          color: item.light_color ?? item.neonColor ?? def.neonColor ?? "#ff9be8",
          intensity: active ? 14 * (activeInstances[item.id] && dimmer === 0 ? 1 : dimmer / 3) : 0,
          distance: 9,
          decay: 1.75,
          kind: "furniture-glow",
        });
      } else if (/bed/.test(item.furnitureId)) {
        pointLights.push({
          id: `furniture-bed:${item.id}`,
          position: [fx, baseY + 1.15, fz],
          color: "#ffb468",
          intensity: active ? 12 : 0,
          distance: 8.5,
          decay: 1.75,
          kind: "furniture-glow",
        });
      } else if (/work|desk|terminal/.test(item.furnitureId)) {
        pointLights.push({
          id: `furniture-desk:${item.id}`,
          position: [fx, baseY + 1.35, fz],
          color: "#3ce8ff",
          intensity: active ? 0.9 : 0,
          distance: 2.8,
          decay: 1.8,
          kind: "furniture-glow",
        });
      }
      if (pointLights.length >= 8) break;
    }
  }

  return {
    background: "#050711",
    fogColor: "#0b0d1c",
    fogNear: 38,
    fogFar: 112,
    ambientColor: "#ffd4ab",
    ambientIntensity: 0.18,
    hemisphereSky: "#62549b",
    hemisphereGround: "#1a100d",
    hemisphereIntensity: 0.32,
    keyLight: {
      position: [cx + 7.5, baseY + 15, cz + 9.5],
      color: "#ffd09b",
      intensity: 1.02,
    },
    cityRimLight: {
      position: [cx - 11, baseY + 6.5, cz - 14],
      color: "#27cfff",
      intensity: 0.12,
    },
    skylineVioletRim: {
      position: [cx + 12, baseY + 5.5, cz - 14],
      color: "#d94ac9",
      intensity: 0.18,
    },
    pointLights,
  };
}

export function computeInteriorAccentZones(plan: BuildingPlan, level: number): InteriorAccentZone[] {
  const floorKeys = new Set(plan.floors.filter(cell => cell.level === level).map(cellKey));
  if (floorKeys.size === 0) return [];

  const zones: InteriorAccentZone[] = [];
  const items = plan.furniture.filter(item => item.level === level);

  for (const item of items) {
    const cells = furnitureFootprint(item);
    if (!cells.length || !cells.every(cell => floorKeys.has(cellKey(cell)))) continue;
    const minX = Math.min(...cells.map(c => c.x));
    const maxX = Math.max(...cells.map(c => c.x)) + 1;
    const minZ = Math.min(...cells.map(c => c.z));
    const maxZ = Math.max(...cells.map(c => c.z)) + 1;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const width = maxX - minX;
    const depth = maxZ - minZ;

    if (/bed/.test(item.furnitureId)) {
      zones.push({
        id: `zone:${item.id}`,
        kind: "bed-rug",
        x: centerX,
        z: centerZ,
        level,
        width: width + 0.55,
        depth: depth + 0.55,
        primaryColor: "#3b3038",
        borderColor: "#8f684b",
        glowColor: "#ffaa5c",
        glowOpacity: 0.34,
      });
    } else if (/sofa|chair/.test(item.furnitureId)) {
      zones.push({
        id: `zone:${item.id}`,
        kind: "lounge-rug",
        x: centerX,
        z: centerZ,
        level,
        width: width + 0.65,
        depth: depth + 0.75,
        primaryColor: "#6b625d",
        borderColor: "#746459",
        glowColor: "#ffb76c",
        glowOpacity: 0.14,
      });
    } else if (/work|desk|table|terminal/.test(item.furnitureId)) {
      zones.push({
        id: `zone:${item.id}`,
        kind: "desk-mat",
        x: centerX,
        z: centerZ,
        level,
        width: width + 0.42,
        depth: depth + 0.48,
        primaryColor: "#34302f",
        borderColor: "#806854",
        glowColor: "#ffc084",
        glowOpacity: 0.1,
      });
    } else if (/lamp|plant/.test(item.furnitureId)) {
      zones.push({
        id: `zone:${item.id}`,
        kind: "lamp-halo",
        x: centerX,
        z: centerZ,
        level,
        width: Math.max(0.95, width + 0.15),
        depth: Math.max(0.95, depth + 0.15),
        primaryColor: "#3a313d",
        borderColor: "#b88458",
        glowColor: /lamp/.test(item.furnitureId) ? "#ff94e2" : "#4ef2c2",
        glowOpacity: 0.26,
      });
    }
  }
  return zones;
}
