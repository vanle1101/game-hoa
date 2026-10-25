export type CharacterPresentation = "masculine" | "feminine" | "neutral";

export interface BodyShape {
  width: number;
  depth: number;
  limb: number;
  height: number;
  shoulder: number;
  hip: number;
  chest: number;
  waist: number;
}

export interface FaceShape {
  width: number;
  jaw: number;
  height: number;
  chin: number;
  cheek: number;
  brow: number;
}

export interface SculptedMeshData {
  positions: number[];
  indices: number[];
}

export function bodyShape(preset: string = "athletic", presentation: CharacterPresentation = "neutral"): BodyShape {
  const base = preset === "slim"
    ? { width: .93, depth: .91, limb: .94, height: 1.02 }
    : preset === "broad" || preset === "strong" || preset === "athletic"
      ? { width: 1.06, depth: 1.05, limb: 1.06, height: 1 }
      : { width: 1, depth: 1, limb: 1, height: 1 };
  const silhouette = presentation === "masculine"
    ? { shoulder: 1.06, hip: .97, chest: 1.04, waist: .96 }
    : presentation === "feminine"
      ? { shoulder: .95, hip: 1.07, chest: 1.02, waist: .88 }
      : { shoulder: 1, hip: 1, chest: 1, waist: .93 };
  return { ...base, ...silhouette };
}

export function faceShape(preset: number = 0): FaceShape {
  return [
    { width: 1, jaw: .84, height: 1, chin: .96, cheek: 1, brow: 1 },
    { width: .94, jaw: .72, height: 1.04, chin: .84, cheek: 1.05, brow: .96 },
    { width: 1.05, jaw: .98, height: .98, chin: 1.04, cheek: 1.06, brow: 1.05 },
    { width: 1.05, jaw: .82, height: .95, chin: .9, cheek: 1.08, brow: .95 },
    { width: .96, jaw: .88, height: 1.05, chin: 1.02, cheek: .96, brow: 1.02 },
    { width: 1.07, jaw: .95, height: 1.01, chin: 1.06, cheek: 1.03, brow: 1.04 },
  ][Math.max(0, Math.min(5, Math.round(preset)))];
}

export const HAIR_STYLES = ["short", "swept", "mohawk", "undercut", "textured", "side-part", "slick", "curly", "bob", "long", "bun", "buzz"];

function buildGridIndices(rows: number, segments: number): number[] {
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col, b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return indices;
}

export function headMeshData(shape: FaceShape = faceShape(0), segments = 36): SculptedMeshData {
  const rings: readonly [number, number, number, number][] = [
    [-.138, .024 * shape.chin, .028, .042],
    [-.131, .046 * shape.chin, .048, .048],
    [-.116, .072 * shape.jaw, .074, .036],
    [-.094, .094 * shape.jaw, .092, .021],
    [-.068, .106 * (.55 + .45 * shape.jaw), .103, .01],
    [-.038, .113 * shape.cheek, .109, .003],
    [-.006, .118 * shape.cheek, .113, -.002],
    [.022, .116 * shape.brow, .114, -.005],
    [.05, .115 * shape.brow, .115, -.007],
    [.08, .109, .111, -.009],
    [.108, .094, .098, -.011],
    [.13, .064, .068, -.012],
    [.142, .022, .024, -.012],
  ];
  const positions: number[] = [];
  rings.forEach(([y, rx, rz, zOffset]) => {
    const jawBand = Math.max(0, 1 - Math.abs(y + .088) / .045);
    const cheekBand = Math.max(0, 1 - Math.abs(y + .004) / .038);
    const eyeSocketBand = Math.max(0, 1 - Math.abs(y - .018) / .024);
    const browBand = Math.max(0, 1 - Math.abs(y - .044) / .022);
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const front = Math.max(0, cos), back = Math.max(0, -cos);
      const cheek = cheekBand * .010 * shape.cheek * Math.max(0, 1 - ((Math.abs(sin) - .68) / .28) ** 2) * (cos > -.1 ? 1 : 0);
      const jawCorner = jawBand * .006 * shape.jaw * Math.max(0, 1 - ((Math.abs(sin) - .76) / .25) ** 2);
      const socketRecess = eyeSocketBand * .011 * front * Math.max(0, 1 - ((Math.abs(sin) - .42) / .22) ** 2);
      const browRidge = browBand * .008 * shape.brow * front * Math.max(0, 1 - (Math.abs(sin) / .65) ** 2);
      const lipPlane = front * Math.exp(-Math.pow((y + .069) / .015, 2)) * .0035 * Math.max(0, 1 - (Math.abs(sin) / .5) ** 2);
      const chinPlane = front * Math.exp(-Math.pow((y + .116) / .022, 2)) * .003;
      const craniumBack = back * (y > -.04 ? .012 : -.008);
      const x = sin * (rx + cheek + jawCorner);
      const z = zOffset + cos * (rz + craniumBack) + browRidge - socketRecess + lipPlane + chinPlane;
      positions.push(x * shape.width, y * shape.height, z);
    }
  });
  return { positions, indices: buildGridIndices(rings.length, segments) };
}

export function noseMeshData(nose: { bridgeWidth: number; bridgeHeight: number; bridgeDepth: number; tipWidth: number; tipHeight: number; tipDepth: number; tipY: number; tipZ: number }): SculptedMeshData {
  const topY = nose.tipY + nose.bridgeHeight * 1.45;
  const midY = (topY + nose.tipY) * .5;
  const baseY = nose.tipY - nose.tipHeight * .65;
  const rootZ = .096;
  const rings: readonly [number, number, number, number][] = [
    [baseY, nose.tipWidth * .38, .004, rootZ + .005],
    [nose.tipY - nose.tipHeight * .4, nose.tipWidth * .76, nose.tipDepth * .42, rootZ + .009],
    [nose.tipY - nose.tipHeight * .12, nose.tipWidth, nose.tipDepth * .64, nose.tipZ - nose.tipDepth * .7],
    [nose.tipY + nose.tipHeight * .28, nose.tipWidth * .8, nose.tipDepth * .84, nose.tipZ - nose.tipDepth * .8],
    [nose.tipY + nose.tipHeight * .64, nose.tipWidth * .57, nose.tipDepth * .7, nose.tipZ - nose.tipDepth * .8],
    [midY, nose.bridgeWidth * .72, nose.bridgeDepth * .62, rootZ + .006],
    [topY - nose.bridgeHeight * .2, nose.bridgeWidth * .68, nose.bridgeDepth * .43, rootZ + .004],
    [topY, nose.bridgeWidth * .82, nose.bridgeDepth * .22, rootZ + .003],
  ];
  const segments = 24, positions: number[] = [];
  rings.forEach(([y, rx, rz, zCenter]) => {
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      positions.push(sin * rx, y, zCenter + cos * rz * (cos > 0 ? 1 : .35));
    }
  });
  return { positions, indices: buildGridIndices(rings.length, segments) };
}

export function taperMeshData(top: number, bottom: number, length: number, depthScale = 1, segments = 24): SculptedMeshData {
  const half = length / 2;
  const stops: readonly [number, number, number][] = [
    [-half, bottom * .76, 0],
    [-half + length * .08, bottom * .96, .01],
    [-half + length * .28, bottom * .72 + top * .28, .032],
    [0, (top + bottom) * .5, .045],
    [half - length * .24, top * .78 + bottom * .22, .035],
    [half - length * .07, top * .97, .012],
    [half, top * .78, 0],
  ];
  const positions: number[] = [];
  stops.forEach(([y, radius, contour]) => {
    const r = radius * (1 + contour);
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      positions.push(Math.sin(angle) * r, y, Math.cos(angle) * r * depthScale);
    }
  });
  return { positions, indices: buildGridIndices(stops.length, segments) };
}

export function hairCapMeshData(crownScale = 1, undercut = false, segments = 32, shape: FaceShape = faceShape(0), buzz = false): SculptedMeshData {
  const sideScale = undercut ? .9 : 1;
  const yScale = buzz ? .86 : 1, yOffset = crownScale < 1 ? -.008 : .004;
  const loft = .0028 + .0022 * crownScale * (buzz ? .25 : 1);
  const scalp = headMeshData(shape);
  const stride = 37;
  const sample = (row: number, column: number, axis: number) => {
    const position = column * 36 / segments, left = Math.floor(position), blend = position - left;
    const a = scalp.positions[(row * stride + left) * 3 + axis];
    const b = scalp.positions[(row * stride + Math.min(36, left + 1)) * 3 + axis];
    return a + (b - a) * blend;
  };
  const positions: number[] = [];
  const lower = [[-.052, .086 * sideScale, .072, -.048], [-.012, .112 * sideScale, .104, -.026], [.028, .122 * sideScale, .118, -.01]];
  lower.forEach(([y, rx, rz, center], row) => {
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI * 2 * i / segments, sin = Math.sin(angle), cos = Math.cos(angle);
      const frontCut = row < 2 && cos > .25 ? (cos - .25) * .045 : 0;
      const rear = Math.max(0, -cos);
      const worldY = (y + frontCut) * yScale + yOffset;
      const blend = Math.max(0, Math.min(1, (worldY / shape.height - .022) / .028));
      const x = sample(7, i, 0) * (1 - blend) + sample(8, i, 0) * blend + sin * loft;
      const z = sample(7, i, 2) * (1 - blend) + sample(8, i, 2) * blend + cos * loft;
      const fit = row === 2 ? (undercut ? rear : Math.min(1, rear * 3)) : 0;
      positions.push(sin * rx * (1 - fit) + x * fit, y + frontCut, (center + cos * rz) * (1 - fit) + z * fit);
    }
  });
  for (let row = 8; row <= 12; row++) {
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI * 2 * i / segments;
      positions.push(sample(row, i, 0) + Math.sin(angle) * loft,
        (sample(row, i, 1) + .0015 - yOffset) / yScale,
        sample(row, i, 2) + Math.cos(angle) * loft);
    }
  }
  const indices = buildGridIndices(8, segments);
  const tip = positions.length / 3;
  positions.push(0, (.142 * shape.height + loft - yOffset) / yScale, -.012);
  for (let i = 0; i < segments; i++) {
    const a = 7 * (segments + 1) + i;
    indices.push(a, a + 1, tip);
  }
  return { positions, indices };
}

export function hairStrandMeshData(segments = 12): SculptedMeshData {
  const stops: readonly [number, number, number, number][] = [
    [-.5, .025, .025, -.14],
    [-.42, .18, .09, -.1],
    [-.22, .56, .24, -.02],
    [.04, .88, .37, .04],
    [.26, .95, .4, .03],
    [.43, .65, .26, -.02],
    [.5, .32, .13, -.06],
  ];
  const positions: number[] = [];
  stops.forEach(([y, rx, rz, zCurve]) => {
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * 2 * i) / segments;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const ridge = cos > 0 ? 1 + .12 * Math.cos(angle * 3) : .72;
      const bend = .12 * (1 - 4 * y * y);
      positions.push(sin * rx + bend, y, zCurve + cos * rz * ridge);
    }
  });
  const indices = buildGridIndices(stops.length, segments);
  const lower = positions.length / 3, upper = lower + 1;
  positions.push(0, -.515, -.145, 0, .515, -.065);
  for (let i = 0; i < segments; i++) {
    const top = (stops.length - 1) * (segments + 1) + i;
    indices.push(lower, i + 1, i, upper, top, top + 1);
  }
  return { positions, indices };
}
