export type FacialPoint = [number, number, number];
export type FacialMesh = { positions: number[]; indices: number[] };
export type EyeShape = { name: string; width: number; height: number; tilt: number; lidHeight: number; lidThickness: number };
export type BrowShape = { name: string; width: number; thickness: number; tilt: number; arch: number; peak: number };
export type NoseShape = { name: string; bridgeWidth: number; bridgeHeight: number; bridgeDepth: number; tipWidth: number; tipHeight: number; tipDepth: number; tipY: number; tipZ: number };
export type EarShape = { name: string; width: number; height: number; depth: number; tip: number };
export type MouthShape = { name: string; width: number; upperThickness: number; lowerThickness: number; cornerLift: number; bow: number; gap: number };

export const EYE_SHAPES: readonly EyeShape[] = [
  { name: "soft", width: .028, height: .009, tilt: 0, lidHeight: .013, lidThickness: .004 },
  { name: "focused", width: .027, height: .0075, tilt: -.04, lidHeight: .011, lidThickness: .0045 },
  { name: "almond", width: .031, height: .008, tilt: -.13, lidHeight: .012, lidThickness: .004 },
  { name: "upturned", width: .0285, height: .0085, tilt: .12, lidHeight: .0125, lidThickness: .004 },
  { name: "wide", width: .029, height: .011, tilt: 0, lidHeight: .014, lidThickness: .0035 },
  { name: "hooded", width: .025, height: .008, tilt: .02, lidHeight: .01, lidThickness: .007 },
];
export const BROW_SHAPES: readonly BrowShape[] = [
  { name: "natural", width: .032, thickness: .004, tilt: .055, arch: .003, peak: .1 },
  { name: "arched", width: .031, thickness: .0038, tilt: .08, arch: .009, peak: .25 },
  { name: "straight", width: .033, thickness: .0045, tilt: 0, arch: 0, peak: 0 },
  { name: "angled", width: .032, thickness: .0048, tilt: -.18, arch: .006, peak: .5 },
  { name: "thin", width: .03, thickness: .0022, tilt: .04, arch: .0045, peak: .2 },
  { name: "thick", width: .034, thickness: .0065, tilt: .025, arch: .002, peak: .05 },
];
export const NOSE_SHAPES: readonly NoseShape[] = [
  { name: "soft", bridgeWidth: .013, bridgeHeight: .037, bridgeDepth: .019, tipWidth: .017, tipHeight: .013, tipDepth: .017, tipY: -.029, tipZ: .124 },
  { name: "straight", bridgeWidth: .012, bridgeHeight: .039, bridgeDepth: .02, tipWidth: .015, tipHeight: .011, tipDepth: .016, tipY: -.03, tipZ: .126 },
  { name: "wide", bridgeWidth: .019, bridgeHeight: .034, bridgeDepth: .018, tipWidth: .024, tipHeight: .013, tipDepth: .017, tipY: -.028, tipZ: .123 },
  { name: "narrow", bridgeWidth: .009, bridgeHeight: .038, bridgeDepth: .02, tipWidth: .012, tipHeight: .011, tipDepth: .015, tipY: -.029, tipZ: .126 },
  { name: "aquiline", bridgeWidth: .0125, bridgeHeight: .04, bridgeDepth: .026, tipWidth: .016, tipHeight: .014, tipDepth: .018, tipY: -.034, tipZ: .133 },
  { name: "button", bridgeWidth: .011, bridgeHeight: .028, bridgeDepth: .016, tipWidth: .0155, tipHeight: .012, tipDepth: .018, tipY: -.023, tipZ: .125 },
];
export const EAR_SHAPES: readonly EarShape[] = [
  { name: "standard", width: .022, height: .037, depth: .019, tip: 0 },
  { name: "small", width: .017, height: .029, depth: .015, tip: 0 },
  { name: "wide", width: .03, height: .038, depth: .02, tip: 0 },
  { name: "pointed", width: .021, height: .038, depth: .018, tip: .014 },
];
export const MOUTH_SHAPES: readonly MouthShape[] = [
  { name: "neutral", width: .028, upperThickness: .0035, lowerThickness: .0045, cornerLift: 0, bow: .0008, gap: .0035 },
  { name: "smile", width: .03, upperThickness: .0032, lowerThickness: .0042, cornerLift: .009, bow: 0, gap: .003 },
  { name: "full", width: .029, upperThickness: .0055, lowerThickness: .007, cornerLift: 0, bow: .0015, gap: .004 },
  { name: "thin", width: .027, upperThickness: .002, lowerThickness: .0025, cornerLift: 0, bow: .0005, gap: .002 },
  { name: "wide", width: .037, upperThickness: .0035, lowerThickness: .0045, cornerLift: .001, bow: .0008, gap: .0035 },
  { name: "bow", width: .026, upperThickness: .0045, lowerThickness: .005, cornerLift: .0015, bow: .004, gap: .0035 },
];

export function facialPreset<T extends { name: string }>(table: readonly T[], value: number | string | undefined): T {
  const index = typeof value === "number" ? value : table.findIndex(shape => shape.name === value);
  return table[index] ?? table[0];
}

export function browPoints(shape: BrowShape): FacialPoint[] {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 8 - 1;
    const arch = t < shape.peak ? (t + 1) / (shape.peak + 1) : (1 - t) / (1 - shape.peak);
    return [t * shape.width, shape.arch * Math.sin(arch * Math.PI / 2) + Math.tan(shape.tilt) * t * shape.width, 0];
  });
}

export function mouthPoints(shape: MouthShape, lip: "upper" | "lower"): FacialPoint[] {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 8 - 1, taper = 1 - t * t;
    const y = shape.cornerLift * t * t + (lip === "upper" ? shape.gap * taper + shape.bow * Math.sin(Math.PI * Math.abs(t)) : -shape.gap * taper);
    return [t * shape.width, y, .0012 * taper];
  });
}

export function facialRibbonMesh(points: readonly FacialPoint[], thickness: number): FacialMesh {
  const positions: number[] = [], indices: number[] = [];
  const columns = 7;
  points.forEach(([x, y, z], i) => {
    const t = i / (points.length - 1), taper = .08 + .92 * Math.sin(Math.PI * t);
    const radius = thickness * taper;
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
    for (let column = 0; column < columns; column++) {
      const across = column / (columns - 1) * 2 - 1;
      positions.push(x - dy / length * radius * across, y + dx / length * radius * across, z + thickness * .65 * taper * (1 - across * across));
      if (i > 0 && column > 0) {
        const n = i * columns + column;
        indices.push(n - columns - 1, n - 1, n - columns, n - columns, n - 1, n);
      }
    }
  });
  return { positions, indices };
}

export function eyeContourPoints(shape: EyeShape, lid: "upper" | "lower"): FacialPoint[] {
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 12 - 1;
    const arch = Math.pow(Math.max(0, 1 - t * t), .72);
    return [t * shape.width, shape.height * arch * (lid === "upper" ? 1 : -.72), .0008];
  });
}

export function eyeMesh(shape: EyeShape): FacialMesh {
  const upper = eyeContourPoints(shape, "upper"), lower = eyeContourPoints(shape, "lower");
  const positions: number[] = [], indices: number[] = [], rows = 7;
  for (let i = 0; i < upper.length; i++) {
    const t = i / 12 - 1;
    for (let row = 0; row < rows; row++) {
      const v = row / (rows - 1);
      const low = lower[i][1] - .00008, high = upper[i][1] + .00008;
      positions.push(upper[i][0], low + (high - low) * v, .0008 + .004 * (1 - t * t) * Math.sin(Math.PI * v));
      if (i > 0 && row > 0) {
        const n = i * rows + row;
        indices.push(n - rows - 1, n - 1, n - rows, n - rows, n - 1, n);
      }
    }
  }
  return { positions, indices };
}

export function earMesh(shape: EarShape): FacialMesh {
  const positions: number[] = [0, 0, shape.depth, 0, 0, -shape.depth], indices: number[] = [];
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    positions.push(Math.cos(angle) * shape.width, Math.sin(angle) * shape.height + (i === 6 ? shape.tip : 0), 0);
    const current = i + 2, next = (i + 1) % 24 + 2;
    indices.push(0, current, next, 1, next, current);
  }
  return { positions, indices };
}
