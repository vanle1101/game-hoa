import * as THREE from "three";
import { buildingItem, LEVEL_HEIGHT } from "@/construction/catalog";
import type { CurvedGlassSegment, FloorCell, GridPoint, Plot, WallSegment } from "@/construction/types";
import { residenceElevation } from "./building-architecture";

export type EdgeRef = Pick<WallSegment, "x" | "z" | "level" | "orientation">;
export type WallPart = { x: number; y: number; width: number; height: number; depth: number };

export type ApartmentShellWallRole =
  | "panorama-north"
  | "panorama-east-return"
  | "headboard-feature"
  | "entry-gallery"
  | "cutaway-balustrade"
  | "standard";

export type PanoramaMullionColumn = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  trimPosition: [number, number, number];
  trimSize: [number, number, number];
};

export type PanoramaGlassBay = {
  id: string;
  orientation: "x" | "z";
  position: [number, number, number];
  rotationY: number;
  width: number;
  lowerHeight: number;
  lowerY: number;
  upperHeight: number;
  upperY: number;
  transomY: number;
};

export type PanoramaCurtainWallSpec = {
  northSpan: {
    centerX: number;
    z: number;
    width: number;
    height: number;
    sillHeight: number;
    headerHeight: number;
    transomY: number;
  };
  eastReturnSpan: {
    x: number;
    centerZ: number;
    depth: number;
    height: number;
    sillHeight: number;
    headerHeight: number;
    transomY: number;
  };
  columns: PanoramaMullionColumn[];
  bays: PanoramaGlassBay[];
};

export type ExteriorFacadeBay = {
  id: string;
  face: "south" | "east" | "west" | "north";
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  warmth: number;
};

export type ExteriorTowerColumn = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
};

export type ExteriorSpandrelTier = {
  id: string;
  y: number;
  thickness: number;
  width: number;
  depth: number;
  accentColor: string;
};

export type ExteriorTowerAttachmentSpec = {
  centerX: number;
  centerZ: number;
  podiumWidth: number;
  podiumDepth: number;
  podiumTopY: number;
  podiumThickness: number;
  shaftWidth: number;
  shaftDepth: number;
  shaftHeight: number;
  shaftCenterY: number;
  spandrelTiers: ExteriorSpandrelTier[];
  columns: ExteriorTowerColumn[];
  lowerWindowBays: ExteriorFacadeBay[];
  ledApronStrips: {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    color: string;
  }[];
};

const DEFAULT_SHELL_PLOT: Plot = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 };

export const wallKey = (wall: EdgeRef) => `${wall.level}:${wall.orientation}:${wall.x}:${wall.z}`;
export const floorKey = (cell: GridPoint) => `${cell.level}:${cell.x}:${cell.z}`;

export function isFixedApartmentShell(
  input: readonly (GridPoint | FloorCell)[] | { floors: readonly (GridPoint | FloorCell)[] },
  plot: Plot = DEFAULT_SHELL_PLOT
): boolean {
  const floors: readonly (GridPoint | FloorCell)[] = "floors" in input ? input.floors : input;
  const spanX = plot.maxX - plot.minX;
  const spanZ = plot.maxZ - plot.minZ;
  if (spanX !== 12 || spanZ !== 10) return false;
  const levelZero = floors.filter(cell => cell.level === 0);
  if (levelZero.length < 100) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const cell of levelZero) {
    if (cell.x < minX) minX = cell.x;
    if (cell.x + 1 > maxX) maxX = cell.x + 1;
    if (cell.z < minZ) minZ = cell.z;
    if (cell.z + 1 > maxZ) maxZ = cell.z + 1;
  }
  return minX <= plot.minX && maxX >= plot.maxX && minZ <= plot.minZ && maxZ >= plot.maxZ &&
    levelZero.filter(cell => cell.x >= plot.minX && cell.x < plot.maxX && cell.z >= plot.minZ && cell.z < plot.maxZ).length >= 120;
}

export function isFixedApartmentPanoramaWall(
  wall: WallSegment,
  plot: Plot = DEFAULT_SHELL_PLOT,
  isFixedShell = true
): boolean {
  const role = classifyApartmentShellWall(wall, plot, isFixedShell);
  return role === "panorama-north" || role === "panorama-east-return";
}

export function classifyApartmentShellWall(
  wall: WallSegment,
  plot: Plot = DEFAULT_SHELL_PLOT,
  isFixedShell = true
): ApartmentShellWallRole {
  if (!isFixedShell || wall.level !== 0) return "standard";
  if (wall.opening?.kind === "door") return "standard";
  const customOpaque = wall.materialId === "wall-brick" || wall.materialId === "wall-neon" || wall.materialId === "wall-metal";

  if (wall.orientation === "x" && wall.z === plot.minZ) {
    if (wall.x >= -2 && wall.x <= plot.maxX - 1 && !customOpaque) {
      return "panorama-north";
    }
    if (wall.x >= plot.minX && wall.x < -2 && !wall.opening && !customOpaque) {
      return "headboard-feature";
    }
  }

  if (wall.orientation === "z" && wall.x === plot.maxX) {
    if (wall.z >= plot.minZ && wall.z <= -3 && !customOpaque) {
      return "panorama-east-return";
    }
    if (wall.z > -3 && wall.z <= plot.maxZ - 1) {
      return "cutaway-balustrade";
    }
  }

  if (wall.orientation === "x" && wall.z === plot.maxZ && wall.x >= plot.minX && wall.x <= plot.maxX - 1) {
    return "cutaway-balustrade";
  }

  if (wall.orientation === "z" && wall.x === plot.minX && wall.z >= plot.minZ && wall.z <= plot.maxZ - 1) {
    return "entry-gallery";
  }

  return "standard";
}

/** Mesh boxes occupy only solid wall; the opening has no hidden backing geometry. */
export function wallParts(wall: WallSegment): WallPart[] {
  const definition = buildingItem(wall.materialId),
    height = definition?.height ?? 2.8,
    depth = definition?.thickness ?? 0.12;
  const opening = wall.opening ? buildingItem(wall.opening.catalogId) : undefined;
  if (!opening) return [{ x: 0, y: height / 2, width: 1, height, depth }];
  const width = Math.min(0.98, opening.openingWidth ?? 0.82),
    openingHeight = opening.openingHeight ?? 2.2,
    sill = wall.opening?.kind === "door" ? 0 : opening.sill ?? 1;
  const side = (1 - width) / 2,
    top = height - sill - openingHeight;
  return [
    { x: -(width + side) / 2, y: height / 2, width: side, height, depth },
    { x: (width + side) / 2, y: height / 2, width: side, height, depth },
    ...(sill > 0 ? [{ x: 0, y: sill / 2, width, height: sill, depth }] : []),
    ...(top > 0 ? [{ x: 0, y: sill + openingHeight + top / 2, width, height: top, depth }] : []),
  ];
}

export function shellWallParts(
  wall: WallSegment,
  plot: Plot = DEFAULT_SHELL_PLOT,
  isFixedShell = true
): WallPart[] {
  const role = classifyApartmentShellWall(wall, plot, isFixedShell);
  if (role === "panorama-north" || role === "panorama-east-return") {
    const definition = buildingItem(wall.materialId);
    const height = definition?.height ?? 2.8;
    const depth = definition?.thickness ?? 0.12;
    const width = 0.94;
    const sill = 0.16;
    const openingHeight = 2.48;
    const side = (1 - width) / 2;
    const top = Math.max(0.08, height - sill - openingHeight);
    return [
      { x: -(width + side) / 2, y: height / 2, width: side, height, depth },
      { x: (width + side) / 2, y: height / 2, width: side, height, depth },
      { x: 0, y: sill / 2, width, height: sill, depth },
      { x: 0, y: sill + openingHeight + top / 2, width, height: top, depth },
    ];
  }
  return wallParts(wall);
}

export function buildPanoramaCurtainWallAssembly(
  plot: Plot = DEFAULT_SHELL_PLOT,
  level = 0
): PanoramaCurtainWallSpec {
  const baseY = level * LEVEL_HEIGHT;
  const height = 2.82;
  const sillHeight = 0.16;
  const headerHeight = 0.16;
  // Keep the structural split near the head so the inhabited panorama reads as
  // one tall sheet of glass at eye level, as in the apartment reference.
  const transomY = 2.45;
  const lowerHeight = transomY - sillHeight - 0.03;
  const lowerY = sillHeight + lowerHeight * 0.5;
  const upperTop = height - headerHeight;
  const upperHeight = upperTop - transomY - 0.03;
  const upperY = transomY + 0.03 + upperHeight * 0.5;

  const northStartX = -2;
  const northEndX = plot.maxX;
  const northWidth = northEndX - northStartX;
  const northCenterX = (northStartX + northEndX) * 0.5;
  const northZ = plot.minZ;

  const eastX = plot.maxX;
  const eastStartZ = plot.minZ;
  const eastEndZ = -2;
  const eastDepth = eastEndZ - eastStartZ;
  const eastCenterZ = (eastStartZ + eastEndZ) * 0.5;

  const columns: PanoramaMullionColumn[] = [];
  const northColumnXs = [-2, 0, 2, 4, 6];
  for (const x of northColumnXs) {
    const isCorner = x === -2 || x === 6;
    const colW = isCorner ? 0.11 : 0.072;
    const colD = isCorner ? 0.22 : 0.18;
    columns.push({
      id: `panorama-col-north:${x}`,
      position: [x, baseY + height * 0.5, northZ],
      size: [colW, height + 0.04, colD],
      trimPosition: [x, baseY + height * 0.5, northZ + colD * 0.5 + 0.008],
      trimSize: [colW * 0.45, height - 0.12, 0.014],
    });
  }

  const eastColumnZs = [-3.5, -2];
  for (const z of eastColumnZs) {
    const isEnd = z === -2;
    const colW = isEnd ? 0.11 : 0.072;
    const colD = isEnd ? 0.22 : 0.18;
    columns.push({
      id: `panorama-col-east:${z}`,
      position: [eastX, baseY + height * 0.5, z],
      size: [colD, height + 0.04, colW],
      trimPosition: [eastX - colD * 0.5 - 0.008, baseY + height * 0.5, z],
      trimSize: [0.014, height - 0.12, colW * 0.45],
    });
  }

  const bays: PanoramaGlassBay[] = [];
  for (let i = 0; i < northColumnXs.length - 1; i++) {
    const x0 = northColumnXs[i];
    const x1 = northColumnXs[i + 1];
    const bayWidth = x1 - x0 - 0.08;
    bays.push({
      id: `panorama-bay-north:${i}`,
      orientation: "x",
      position: [(x0 + x1) * 0.5, baseY, northZ],
      rotationY: 0,
      width: bayWidth,
      lowerHeight,
      lowerY,
      upperHeight,
      upperY,
      transomY,
    });
  }

  const eastStops = [-5, -3.5, -2];
  for (let i = 0; i < eastStops.length - 1; i++) {
    const z0 = eastStops[i];
    const z1 = eastStops[i + 1];
    const bayWidth = z1 - z0 - 0.08;
    bays.push({
      id: `panorama-bay-east:${i}`,
      orientation: "z",
      position: [eastX, baseY, (z0 + z1) * 0.5],
      rotationY: Math.PI / 2,
      width: bayWidth,
      lowerHeight,
      lowerY,
      upperHeight,
      upperY,
      transomY,
    });
  }

  return {
    northSpan: {
      centerX: northCenterX,
      z: northZ,
      width: northWidth,
      height,
      sillHeight,
      headerHeight,
      transomY,
    },
    eastReturnSpan: {
      x: eastX,
      centerZ: eastCenterZ,
      depth: eastDepth,
      height,
      sillHeight,
      headerHeight,
      transomY,
    },
    columns,
    bays,
  };
}

export function buildExteriorTowerAttachment(
  bounds: { centerX: number; centerZ: number; width: number; depth: number; minX: number; maxX: number; minZ: number; maxZ: number },
  plot: Plot = DEFAULT_SHELL_PLOT,
  residenceFloor: 8 | 16 | 24 = 16
): ExteriorTowerAttachmentSpec {
  const width = Math.max(bounds.width, plot.maxX - plot.minX);
  const depth = Math.max(bounds.depth, plot.maxZ - plot.minZ);
  const centerX = bounds.centerX;
  const centerZ = bounds.centerZ;
  const minX = centerX - width * 0.5;
  const maxX = centerX + width * 0.5;
  const minZ = centerZ - depth * 0.5;
  const maxZ = centerZ + depth * 0.5;

  const podiumTopY = -0.12;
  const podiumThickness = 0.56;
  const podiumWidth = width + 0.92;
  const podiumDepth = depth + 0.92;

  const storyCount = residenceFloor >= 24 ? 5 : 4;
  const storyHeight = 3.4;
  const shaftHeight = storyCount * storyHeight;
  const shaftTopY = podiumTopY - podiumThickness;
  const shaftCenterY = shaftTopY - shaftHeight * 0.5;
  const shaftWidth = width + 0.36;
  const shaftDepth = depth + 0.36;

  const spandrelTiers: ExteriorSpandrelTier[] = [];
  for (let i = 0; i <= storyCount; i++) {
    const y = shaftTopY - i * storyHeight;
    spandrelTiers.push({
      id: `tower-spandrel:${i}`,
      y,
      thickness: i === 0 ? 0.28 : 0.24,
      width: shaftWidth + (i === 0 ? 0.32 : 0.18),
      depth: shaftDepth + (i === 0 ? 0.32 : 0.18),
      accentColor: i % 2 === 0 ? "#ffae58" : "#38d9f5",
    });
  }

  const columns: ExteriorTowerColumn[] = [];
  const xStops = [minX - 0.18, minX + 4, maxX - 4, maxX + 0.18];
  const zStops = [minZ - 0.18, minZ + 3.3, maxZ - 3.3, maxZ + 0.18];

  for (const x of xStops) {
    for (const z of [minZ - 0.18, maxZ + 0.18]) {
      const isCorner = (x === xStops[0] || x === xStops[xStops.length - 1]);
      columns.push({
        id: `tower-pilaster-x:${x.toFixed(2)}:${z.toFixed(2)}`,
        position: [x, shaftCenterY + 0.2, z],
        size: [isCorner ? 0.44 : 0.28, shaftHeight + 0.5, isCorner ? 0.44 : 0.28],
      });
    }
  }
  for (const z of zStops.slice(1, -1)) {
    for (const x of [minX - 0.18, maxX + 0.18]) {
      columns.push({
        id: `tower-pilaster-z:${x.toFixed(2)}:${z.toFixed(2)}`,
        position: [x, shaftCenterY + 0.2, z],
        size: [0.28, shaftHeight + 0.5, 0.28],
      });
    }
  }

  const lowerWindowBays: ExteriorFacadeBay[] = [];
  for (let tier = 0; tier < Math.min(3, storyCount); tier++) {
    const bayY = shaftTopY - (tier + 0.5) * storyHeight;
    for (let i = 0; i < xStops.length - 1; i++) {
      const bx = (xStops[i] + xStops[i + 1]) * 0.5;
      const bw = Math.max(1.2, xStops[i + 1] - xStops[i] - 0.48);
      lowerWindowBays.push({
        id: `facade-south:${tier}:${i}`,
        face: "south",
        position: [bx, bayY, maxZ + 0.19],
        rotationY: 0,
        width: bw,
        height: storyHeight - 0.62,
        warmth: ((tier + i) % 2 === 0) ? 0.92 : 0.55,
      });
      lowerWindowBays.push({
        id: `facade-north:${tier}:${i}`,
        face: "north",
        position: [bx, bayY, minZ - 0.19],
        rotationY: Math.PI,
        width: bw,
        height: storyHeight - 0.62,
        warmth: ((tier + i) % 2 === 1) ? 0.85 : 0.45,
      });
    }
    for (let i = 0; i < zStops.length - 1; i++) {
      const bz = (zStops[i] + zStops[i + 1]) * 0.5;
      const bw = Math.max(1.2, zStops[i + 1] - zStops[i] - 0.48);
      lowerWindowBays.push({
        id: `facade-east:${tier}:${i}`,
        face: "east",
        position: [maxX + 0.19, bayY, bz],
        rotationY: Math.PI / 2,
        width: bw,
        height: storyHeight - 0.62,
        warmth: ((tier + i) % 2 === 0) ? 0.88 : 0.5,
      });
      lowerWindowBays.push({
        id: `facade-west:${tier}:${i}`,
        face: "west",
        position: [minX - 0.19, bayY, bz],
        rotationY: -Math.PI / 2,
        width: bw,
        height: storyHeight - 0.62,
        warmth: ((tier + i) % 2 === 0) ? 0.95 : 0.65,
      });
    }
  }

  const stripY = podiumTopY - 0.16;
  const ledApronStrips = [
    {
      id: "apron-led-south",
      position: [centerX, stripY, maxZ + 0.465] as [number, number, number],
      size: [podiumWidth - 0.16, 0.032, 0.024] as [number, number, number],
      color: "#ffae54",
    },
    {
      id: "apron-led-east",
      position: [maxX + 0.465, stripY, centerZ] as [number, number, number],
      size: [0.024, 0.032, podiumDepth - 0.16] as [number, number, number],
      color: "#ffae54",
    },
    {
      id: "apron-led-north",
      position: [centerX, stripY, minZ - 0.465] as [number, number, number],
      size: [podiumWidth - 0.16, 0.032, 0.024] as [number, number, number],
      color: "#38d9f5",
    },
    {
      id: "apron-led-west",
      position: [minX - 0.465, stripY, centerZ] as [number, number, number],
      size: [0.024, 0.032, podiumDepth - 0.16] as [number, number, number],
      color: "#ffae54",
    },
  ];

  return {
    centerX,
    centerZ,
    podiumWidth,
    podiumDepth,
    podiumTopY,
    podiumThickness,
    shaftWidth,
    shaftDepth,
    shaftHeight,
    shaftCenterY,
    spandrelTiers,
    columns,
    lowerWindowBays,
    ledApronStrips,
  };
}

function curveFrameProfile(curve: CurvedGlassSegment) {
  const start = THREE.MathUtils.degToRad(curve.rotation);
  const sweep = THREE.MathUtils.degToRad(curve.angle);
  const railHeight = Math.min(0.08, curve.height / 3);
  const endPostSweep = Math.min(sweep / 2, 0.08 / (curve.radius + curve.thickness / 2));
  const angularPrecision = 32 * 2 ** -23;
  const capSweep = sweep - 2 * endPostSweep <= angularPrecision ? sweep / 2 : endPostSweep;
  const arc = (from: number, to: number) => {
    if (to <= from) return [from];
    const segments = 2 * Math.max(8, Math.ceil(((to - from) * 90) / Math.PI));
    return Array.from({ length: segments + 1 }, (_, i) => (i === segments ? to : from + ((to - from) * i) / segments));
  };
  const paneStart = start + capSweep;
  const paneEnd = start + (sweep - capSweep);
  const startPost = arc(start, paneStart);
  const pane = arc(paneStart, paneEnd);
  const endPost = arc(paneEnd, start + sweep);
  return {
    railHeight,
    paneTop: curve.height - railHeight,
    pane,
    startPost,
    endPost,
    rail: [...startPost, ...pane.slice(1), ...endPost.slice(1)],
  };
}

function annularSectorGeometry(
  curve: CurvedGlassSegment,
  angles: readonly number[],
  base: number,
  top: number
): THREE.BufferGeometry {
  const inner = curve.radius - curve.thickness / 2;
  const outer = curve.radius + curve.thickness / 2;
  const positions: number[] = [];
  const point = (radius: number, angle: number, y: number): [number, number, number] => [
    radius * Math.cos(angle),
    y,
    radius * Math.sin(angle),
  ];
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 1; i < angles.length; i++) {
    const a = angles[i - 1],
      b = angles[i];
    const ib = point(inner, a, base),
      ob = point(outer, a, base);
    const ibNext = point(inner, b, base),
      obNext = point(outer, b, base);
    const it = point(inner, a, top),
      ot = point(outer, a, top);
    const itNext = point(inner, b, top),
      otNext = point(outer, b, top);
    quad(ob, ot, otNext, obNext);
    quad(ib, ibNext, itNext, it);
    quad(ib, ob, obNext, ibNext);
    quad(it, itNext, otNext, ot);
    if (i === 1) quad(ib, it, ot, ob);
    if (i === angles.length - 1) quad(ibNext, obNext, otNext, itNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function curveGeometry(curve: CurvedGlassSegment): THREE.BufferGeometry {
  const profile = curveFrameProfile(curve);
  return annularSectorGeometry(curve, profile.pane, profile.railHeight, profile.paneTop);
}

export function curveFrameGeometry(curve: CurvedGlassSegment): THREE.BufferGeometry[] {
  const profile = curveFrameProfile(curve);
  return [
    annularSectorGeometry(curve, profile.rail, 0, profile.railHeight),
    annularSectorGeometry(curve, profile.rail, profile.paneTop, curve.height),
    annularSectorGeometry(curve, profile.startPost, profile.railHeight, profile.paneTop),
    annularSectorGeometry(curve, profile.endPost, profile.railHeight, profile.paneTop),
  ];
}

export function residenceCityOffset(floor: 8 | 16 | 24 = 16): number {
  // City geometry is authored with a -48 m ground; align it with the building foundation.
  return 48 - residenceElevation(floor);
}

export function nearestEdge(point: { x: number; z: number }, level: number): EdgeRef {
  const verticalDistance = Math.abs(point.x - Math.round(point.x)),
    horizontalDistance = Math.abs(point.z - Math.round(point.z));
  return verticalDistance < horizontalDistance
    ? { x: Math.round(point.x), z: Math.floor(point.z), level, orientation: "z" }
    : { x: Math.floor(point.x), z: Math.round(point.z), level, orientation: "x" };
}
