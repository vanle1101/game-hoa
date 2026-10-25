import type { BodyShape } from "./character-shape";
import { LOWER_V7_SHAPES } from "../../character/fashion-lower-v7";
import { UPPER_V7_SHAPES } from "../../character/fashion-upper-v7";
import { STARTER_POLO_V7_SHAPES } from "../../character/starter-polo-v7";
import { ACCESSORY_V7_SHAPES } from "../../character/fashion-accessory-v7";

export type WearableAnchor = "torso" | "head" | "leftArm" | "rightArm" | "leftThigh" | "rightThigh" | "leftShin" | "rightShin";
export type WearableVector = [number, number, number];
export type WearableColorRole = "primary" | "secondary" | "trim" | "glow";
export type GarmentSection = { y: number; width: number; depth: number };
export interface WearablePart {
  kind: "box" | "ellipsoid" | "taper" | "ring" | "shell";
  anchor: WearableAnchor;
  at: WearableVector;
  size: WearableVector;
  colorRole: WearableColorRole;
  rotation?: WearableVector;
  metal?: number;
  sections?: readonly GarmentSection[];
  opening?: number;
}
export interface WearableShape {
  model: string;
  layer: "top" | "bottom" | "shoes" | "outerwear" | "headwear" | "accessory" | "anchor";
  geometryCount: number;
  parts: readonly WearablePart[];
  detail: readonly string[];
  hairAdjustment?: "flatten";
}

const part = (anchor: WearableAnchor, kind: WearablePart["kind"], at: WearableVector, size: WearableVector, colorRole: WearableColorRole = "primary", extra: Partial<WearablePart> = {}): WearablePart => ({ anchor, kind, at, size, colorRole, ...extra });
const box = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, colorRole: WearableColorRole = "primary", extra: Partial<WearablePart> = {}) => part(anchor, "box", at, size, colorRole, extra);
const shape = (model: string, layer: WearableShape["layer"], parts: readonly WearablePart[], detail: readonly string[], hairAdjustment?: "flatten"): WearableShape => ({ model, layer, geometryCount: parts.length, parts, detail, hairAdjustment });
const arms = ["leftArm", "rightArm"] as const;
const thighs = ["leftThigh", "rightThigh"] as const;
const shins = ["leftShin", "rightShin"] as const;
const sideOf = (anchor: WearableAnchor) => anchor.startsWith("left") ? -1 : 1;

function shell(hem: number, width: number, depth: number, opening = 0): WearablePart {
  const waistY = Math.max(hem + .055, 1.135);
  return part("torso", "shell", [0, 0, 0], [1, 1, 1], "primary", {
    opening,
    sections: [
      { y: hem, width: width * .86, depth: depth * .89 },
      { y: hem + .026, width: width * .88, depth: depth * .91 },
      { y: waistY, width: width * .81, depth: depth * .87 },
      { y: 1.235, width: width * .9, depth: depth * .94 },
      { y: 1.33, width: width * .98, depth: depth * 1.01 },
      { y: 1.395, width: width * 1.03, depth: depth * .97 },
      { y: 1.44, width: width * 1.06, depth: depth * .92 },
      { y: 1.478, width: width * .64, depth: depth * .74 },
      { y: 1.512, width: .074, depth: .066 },
    ].sort((a, b) => a.y - b.y),
  });
}

function sleeves(length: number, radius: number, cuffs = false, tailored = false): WearablePart[] {
  if (!length) return [];
  const forearmRadius = length >= .36 ? .072 - (length - .36) * .18 : length >= .28 ? .08 : 0;
  const bottomRadius = Math.max(forearmRadius, length <= .12 ? radius * .9 : length <= .165 ? radius * .78 : radius * .66);
  const cuffTop = Math.max(radius * .68, forearmRadius);
  const cuffBottom = Math.max(radius * .63, forearmRadius);
  const cuffContour = (cuffTop + cuffBottom) * .5 * 1.045;
  const trimX = Math.sqrt(cuffContour * cuffContour - .011 * .011) - .0005;
  return arms.flatMap(anchor => {
    const side = sideOf(anchor);
    return [
      part(anchor, "ellipsoid", [-side * .012, -.028, 0], [radius * .92, tailored ? Math.max(.072, radius * .95) : radius * 1.12, radius * 1.02], "primary", { rotation: [0, 0, side * -.24] }),
      part(anchor, "taper", [0, -length / 2 - .008, .004], [radius * .98, length, bottomRadius]),
      ...(cuffs ? [
        part(anchor, "taper", [0, -length - .005, .005], [cuffTop, .042, cuffBottom], "secondary"),
        box(anchor, [side * trimX, -length - .005, .016], [.016, .022, .042], "trim", { metal: .58 }),
      ] : []),
    ];
  });
}

function collar(high = false): WearablePart[] {
  return high
    ? [
        part("torso", "taper", [0, 1.508, -.003], [.074, .074, .078], "secondary"),
        part("torso", "ring", [0, 1.536, -.003], [.071, .071, .054], "trim", { rotation: [Math.PI / 2, 0, 0] }),
      ]
    : [
        part("torso", "taper", [0, 1.498, -.005], [.078, .048, .082], "secondary"),
        ...[-1, 1].map(side => box("torso", [side * .052, 1.454, .092], [.032, .068, .014], "secondary", { rotation: [.18, side * .28, side * .34] })),
      ];
}

function lapels(): WearablePart[] {
  return [-1, 1].map(side => box("torso", [side * .068, 1.365, .126], [.044, .185, .015], "secondary", { rotation: [.08, side * .22, side * -.28] }));
}

function hood(): WearablePart[] {
  return [
    part("torso", "ellipsoid", [0, 1.455, -.108], [.142, .082, .072], "secondary"),
    part("torso", "ring", [0, 1.492, -.072], [.096, .096, .092], "secondary", { rotation: [Math.PI / 2 + .18, 0, 0] }),
  ];
}

function pockets(y: number, z: number, width = .064): WearablePart[] {
  return [-1, 1].flatMap(side => [
    box("torso", [side * .102, y, z - .004], [width, .042, .011], "secondary", { rotation: [.06, side * -.18, side * -.04] }),
    box("torso", [side * .102, y + .018, z + .001], [width * .94, .008, .012], "trim", { rotation: [.06, side * -.18, side * -.04], metal: .55 }),
  ]);
}

function seam(y: number, length: number, z = .131): WearablePart {
  return box("torso", [0, y, z], [.007, length, .009], "trim", { metal: .65 });
}

function hemBand(y: number, width: number, depth: number): WearablePart {
  return part("torso", "taper", [0, y + .018, 0], [width * .86, .038, depth * .89], "secondary");
}

function tails(length: number, width: number): WearablePart[] {
  return thighs.map(anchor => box(anchor, [sideOf(anchor) * .044, -length / 2 + .095, -.048], [width, length, .188], "primary", { rotation: [.04, 0, sideOf(anchor) * .04] }));
}

function trousers(model: string, upper: number, knee: number, ankle: number, cargo = false, pleat = false): WearableShape {
  return shape(model, "bottom", [
    part("torso", "ellipsoid", [0, .968, -.004], [.192, .096, .122]),
    part("torso", "taper", [0, 1.002, -.003], [.176, .054, .184]),
    box("torso", [0, 1.016, 0], [.344, .03, .224], "secondary"),
    box("torso", [0, 1.016, .116], [.04, .032, .014], "trim", { metal: .78 }),
    ...thighs.flatMap(anchor => [
      part(anchor, "taper", [0, -.192, 0], [upper, .41, knee]),
      part(anchor, "ellipsoid", [0, -.386, .005], [knee * .96, .052, knee * .94]),
      ...(cargo ? [
        box(anchor, [sideOf(anchor) * upper * .82, -.19, .022], [.052, .132, .106], "secondary", { rotation: [0, 0, sideOf(anchor) * -.03] }),
        box(anchor, [sideOf(anchor) * upper * .84, -.126, .026], [.056, .022, .112], "trim"),
      ] : []),
      ...(pleat ? [box(anchor, [0, -.19, upper * .92], [.007, .33, .008], "secondary")] : []),
    ]),
    ...shins.flatMap(anchor => [
      part(anchor, "taper", [0, -.216, 0], [knee * .98, .445, ankle]),
      ...(pleat ? [box(anchor, [0, -.205, knee * .86], [.007, .36, .008], "secondary")] : []),
      part(anchor, "taper", [0, -.414, .002], [ankle * 1.06, .044, ankle * 1.02], "secondary"),
    ]),
  ], [cargo ? "side cargo pockets" : pleat ? "pressed front crease" : "clean pockets", `leg taper ${upper}/${knee}/${ankle}`]);
}

function footwear(model: string, shaft: number, sole: number, toe: number, laces: boolean, luminous: boolean): WearableShape {
  return shape(model, "shoes", shins.flatMap(anchor => [
    part(anchor, "ellipsoid", [0, -.416, .044], [.06, .04, toe * .84]),
    part(anchor, "ellipsoid", [0, -.404, -.016], [.056, .048, .062]),
    part(anchor, "taper", [0, -.392 + shaft / 2, -.004], [.059, shaft, .065]),
    box(anchor, [0, -.458 + (sole - .032) / 2, .038], [.124, sole, toe * 1.82], "secondary"),
    box(anchor, [0, -.445, .038 + toe * .84], [.094, .013, .014], luminous ? "glow" : "trim"),
    ...(laces
      ? [0, 1, 2].map(i => box(anchor, [0, -.376 - i * .015, .054 + i * .02], [.066, .006, .009], "trim"))
      : [box(anchor, [0, -.378, .06], [.09, .02, .03], "trim", { metal: .65 })]),
  ]).map(piece => ({ ...piece, at: [piece.at[0], piece.at[1] - .091, piece.at[2]] as WearableVector })), [shaft > .12 ? "high ankle shaft" : "low ankle shaft", laces ? "three lace rows" : "metal vamp strap", luminous ? "luminous toe strip" : "solid sole"]);
}

export const WEARABLE_SHAPES: Readonly<Record<string, WearableShape>> = {
  ...LOWER_V7_SHAPES,
  ...UPPER_V7_SHAPES,
  ...STARTER_POLO_V7_SHAPES,
  ...ACCESSORY_V7_SHAPES,
  jacket: shape("jacket", "top", [
    shell(1.02, .218, .122),
    hemBand(1.02, .218, .122),
    part("torso", "taper", [0, 1.486, .01], [.068, .048, .072], "secondary"),
    ...sleeves(.38, .076, true, true),
    ...collar(),
    ...pockets(1.335, .124),
    seam(1.255, .41, .128),
    ...[-1, 1].map(side => box("torso", [side * .128, 1.155, .114], [.008, .105, .008], "glow", { rotation: [0, side * .18, side * -.22] })),
    ...arms.map(anchor => box(anchor, [0, -.145, .07866], [.004, .15, .004], "secondary")),
  ], ["panelled jacket", "rolled cuffs", "zipper", "angled light strips"]),
  hoodie: shape("hoodie", "top", [
    shell(1.015, .222, .126),
    hemBand(1.015, .222, .126),
    ...sleeves(.415, .079, true, true),
    ...hood(),
    box("torso", [0, 1.125, .118], [.152, .068, .016], "secondary"),
    ...[-1, 1].map(side => box("torso", [side * .044, 1.385, .121], [.005, .125, .007], "trim")),
    ...arms.map(anchor => box(anchor, [0, -.145, .0769], [.004, .15, .004], "secondary")),
  ], ["down hood", "kangaroo pocket", "drawcords", "full sleeves"]),
  tee: shape("tee", "top", [
    shell(1.055, .21, .118),
    part("torso", "ring", [0, 1.505, .004], [.072, .072, .052], "secondary", { rotation: [Math.PI / 2 + .12, 0, 0] }),
    ...sleeves(.165, .072),
    box("torso", [0, 1.33, .121], [.068, .028, .007], "trim"),
  ], ["crew neck", "short sleeves", "chest graphic"]),
  turtleneck: shape("turtleneck", "top", [
    shell(1.04, .208, .117),
    ...sleeves(.41, .071, true),
    ...collar(true),
    ...[-1, 1].map(side => box("torso", [side * .148, 1.21, .058], [.008, .24, .008], "secondary")),
  ], ["high neck", "fitted sleeve", "ribbed side seams"]),
  "utility-vest": shape("utility-vest", "top", [
    shell(1.05, .216, .125, .12),
    hemBand(1.05, .216, .125),
    ...pockets(1.31, .128),
    ...pockets(1.15, .118, .076),
    seam(1.255, .34, .128),
  ], ["sleeveless", "four utility pockets", "front zipper"]),
  "cropped-jacket": shape("cropped-jacket", "top", [
    shell(1.155, .22, .124),
    hemBand(1.155, .22, .124),
    ...sleeves(.28, .078, true),
    ...lapels(),
    seam(1.29, .24, .127),
  ], ["cropped hem", "elbow sleeves", "lapels"]),
  shell: shape("shell", "top", [
    shell(1.045, .208, .118),
    ...sleeves(.11, .071),
    ...collar(true),
    box("torso", [.092, 1.295, .118], [.016, .11, .008], "trim"),
  ], ["cap sleeves", "stand collar", "vertical chest tab"]),
  overshirt: shape("overshirt", "top", [
    shell(1.005, .225, .129),
    hemBand(1.005, .225, .129),
    ...sleeves(.36, .078, true),
    ...collar(),
    ...pockets(1.335, .13),
    ...[1.39, 1.3, 1.21, 1.12].map(y => part("torso", "ellipsoid", [0, y, .131], [.006, .006, .004], "trim")),
  ], ["long overshirt", "button placket", "chest patch pockets"]),
  "long-coat": shape("long-coat", "outerwear", [
    shell(1.02, .232, .142, .34),
    ...sleeves(.42, .084, true),
    ...lapels(),
    ...tails(.36, .184),
    ...[-1, 1].map(side => box("torso", [side * .088, 1.225, .138], [.007, .29, .009], "glow")),
  ], ["open coat", "split thigh tails", "narrow lapels", "neon edges"]),
  trench: shape("trench", "outerwear", [
    shell(1.015, .238, .148, .38),
    ...sleeves(.43, .086, true),
    ...lapels(),
    ...tails(.46, .196),
    ...pockets(1.14, .138, .072),
    ...[-1, 1].map(side => box("torso", [side * .126, 1.245, .136], [.024, .024, .012], "trim", { metal: .7 })),
    box("torso", [0, 1.11, -.136], [.31, .03, .015], "secondary"),
  ], ["long split hem", "double button front", "back belt", "wide lapels"]),
  parka: shape("parka", "outerwear", [
    shell(1.015, .242, .152, .39),
    ...sleeves(.435, .089, true),
    ...hood(),
    ...tails(.23, .202),
    ...pockets(1.16, .145, .08),
    box("torso", [0, 1.46, -.156], [.24, .042, .026], "trim"),
  ], ["insulated shell", "down hood", "flapped pockets", "short split hem"]),
  bomber: shape("bomber", "outerwear", [
    shell(1.085, .238, .146, .34),
    hemBand(1.085, .238, .146),
    ...sleeves(.41, .086, true),
    ...collar(true),
    box("torso", [0, 1.095, -.126], [.32, .036, .026], "secondary"),
    box("leftArm", [-.068, -.135, .012], [.024, .105, .06], "secondary"),
  ], ["cropped waist", "ribbed collar", "sleeve pocket"]),
  "rain-shell": shape("rain-shell", "outerwear", [
    shell(1.03, .232, .14, .35),
    ...sleeves(.415, .082, true),
    ...hood(),
    ...[-1, 1].map(side => box("torso", [side * .102, 1.315, .138], [.076, .01, .008], "glow")),
  ], ["light rain shell", "down hood", "reflective taped seams"]),
  tapered: trousers("tapered", .106, .082, .064),
  cargo: trousers("cargo", .114, .09, .072, true),
  "wide-leg": trousers("wide-leg", .118, .104, .094),
  pleated: trousers("pleated", .11, .088, .076, false, true),
  sneakers: footwear("sneakers", .088, .032, .142, true, false),
  boots: footwear("boots", .172, .038, .14, true, true),
  "high-tops": footwear("high-tops", .146, .044, .148, true, true),
  loafers: footwear("loafers", .056, .026, .145, false, false),
  cap: shape("cap", "headwear", [
    part("head", "ellipsoid", [0, .098, -.004], [.13, .058, .118]),
    box("head", [0, .072, .102], [.198, .015, .142], "primary", { rotation: [.12, 0, 0] }),
    box("head", [0, .122, .104], [.044, .02, .007], "trim"),
  ], ["six-panel crown", "curved brim", "front label"], "flatten"),
  beanie: shape("beanie", "headwear", [
    part("head", "ellipsoid", [0, .108, -.008], [.13, .078, .118]),
    part("head", "taper", [0, .072, -.006], [.128, .028, .128], "secondary"),
    box("head", [.068, .074, .102], [.024, .022, .008], "glow"),
  ], ["soft crown", "rib cuff", "light label"], "flatten"),
  visor: shape("visor", "accessory", [
    box("head", [0, .018, .114], [.192, .028, .016], "glow"),
    ...[-1, 1].map(side => box("head", [side * .102, .019, .052], [.011, .016, .122], "secondary")),
  ], ["wrap lens", "temple arms"]),
  "wrist-device": shape("wrist-device", "accessory", [
    box("leftArm", [0, -.412, .012], [.088, .038, .082], "secondary"),
    box("leftArm", [0, -.412, .056], [.056, .028, .012], "glow"),
  ], ["wrist display", "articulated strap"]),
  scarf: shape("scarf", "accessory", [
    part("torso", "taper", [0, 1.512, 0], [.084, .048, .092]),
    box("torso", [.064, 1.382, .142], [.048, .225, .016]),
    box("torso", [.064, 1.493, .103], [.048, .025, .092], "primary", { rotation: [.22, 0, 0] }),
  ], ["neck wrap", "single draped tail"]),
  "holo-badge": shape("holo-badge", "accessory", [
    box("torso", [.108, 1.33, .148], [.044, .054, .012], "secondary"),
    box("torso", [.108, 1.33, .156], [.028, .038, .006], "glow"),
  ], ["chest badge", "holographic insert"]),
  "holo-scarf": shape("holo-scarf", "accessory", [
    part("torso", "taper", [0, 1.515, 0], [.086, .045, .094]),
    ...[-1, 1].map(side => box("torso", [side * .072, 1.378, .146], [.034, .245, .014], "glow")),
  ], ["neck wrap", "two luminous tails"]),
  "ear-cuff": shape("ear-cuff", "accessory", [-1, 1].map(side => part("head", "ring", [side * .122, -.024, -.004], [.013, .013, .013], "primary", { rotation: [0, Math.PI / 2, 0], metal: .85 })), ["paired ear rings"]),
  gloves: shape("gloves", "anchor", arms.flatMap(anchor => [
    box(anchor, [0, -.462, .024], [.088, .08, .068]),
    box(anchor, [0, -.416, .016], [.092, .03, .078], "secondary"),
    box(anchor, [0, -.466, .06], [.064, .028, .01], "trim"),
  ]), ["fingerless hand shell", "wrist cuff", "knuckle plate"]),
  backpack: shape("backpack", "anchor", [
    box("torso", [0, 1.28, -.188], [.268, .325, .118]),
    box("torso", [0, 1.19, -.255], [.204, .112, .044], "secondary"),
    ...[-1, 1].map(side => box("torso", [side * .124, 1.31, .136], [.024, .295, .014], "secondary")),
    box("torso", [0, 1.31, -.25], [.012, .185, .012], "glow"),
  ], ["back shell", "external pocket", "front straps", "light strip"]),
  mask: shape("mask", "anchor", [
    part("head", "ellipsoid", [0, -.062, .104], [.076, .038, .036]),
    box("head", [0, -.062, .138], [.072, .01, .008], "glow"),
    ...[-1, 1].map(side => box("head", [side * .082, -.048, .056], [.013, .014, .092], "secondary", { rotation: [0, side * -.35, 0] })),
  ], ["lower-face shell", "breath strip", "ear straps"]),
  "chain-collar": shape("chain-collar", "anchor", [
    part("torso", "ring", [0, 1.502, .004], [.078, .078, .078], "primary", { rotation: [Math.PI / 2, 0, 0], metal: .9 }),
    box("torso", [0, 1.47, .086], [.022, .034, .009], "primary", { metal: .9 }),
  ], ["neck chain", "pendant"]),
};

export function wearableShape(model: string | undefined): WearableShape | undefined {
  return model ? WEARABLE_SHAPES[model] : undefined;
}
export function wearableGeometryCount(model: string | undefined): number {
  return wearableShape(model)?.geometryCount ?? 0;
}
export function wearableGeometrySignature(model: string): string {
  const spec = wearableShape(model);
  return JSON.stringify(spec?.parts.map(part => Object.fromEntries(Object.entries(part).filter(([key]) => key !== "colorRole" && key !== "metal"))) ?? []);
}
export function wearableDetail(model: string | undefined): readonly string[] {
  return wearableShape(model)?.detail ?? [];
}
export const WEARABLE_GEOMETRY_COUNTS = Object.freeze(Object.fromEntries(Object.entries(WEARABLE_SHAPES).map(([model, value]) => [model, value.geometryCount])));

export function silhouetteWidth(y: number, body: Pick<BodyShape, "hip" | "waist" | "chest" | "shoulder">): number {
  const stops = [[.96, body.hip], [1.12, body.waist], [1.32, body.chest], [1.44, body.shoulder], [1.5, 1]];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const t = Math.max(0, Math.min(1, (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])));
      return stops[i - 1][1] * (1 - t) + stops[i][1] * t;
    }
  }
  return 1;
}

export function shellMeshData(sections: readonly GarmentSection[], opening = 0, body: Pick<BodyShape, "hip" | "waist" | "chest" | "shoulder"> = { hip: 1, waist: 1, chest: 1, shoulder: 1 }, segments = 32) {
  const positions: number[] = [], indices: number[] = [];
  sections.forEach(section => {
    const w = section.width * silhouetteWidth(section.y, body);
    const chestBand = Math.max(0, 1 - Math.abs(section.y - 1.35) / .16);
    const shoulderBand = Math.max(0, 1 - Math.abs(section.y - 1.44) / .08);
    for (let i = 0; i <= segments; i++) {
      const angle = opening + (Math.PI * 2 - opening * 2) * i / segments;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      const radialX = 1 + shoulderBand * .045 * sin * sin - .022 * cos * cos;
      const radialZ = 1 + chestBand * (cos > 0 ? .058 * cos * cos : .034 * cos * cos);
      const dropY = shoulderBand * .011 * sin * sin;
      positions.push(sin * w * radialX, section.y - dropY, cos * section.depth * radialZ);
    }
  });
  for (let row = 0; row < sections.length - 1; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col, b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { positions, indices };
}

export function hairCoverage(style: string, headwearModel?: string) {
  const covered = wearableShape(headwearModel)?.hairAdjustment === "flatten";
  return { style, covered, crownScale: covered ? .45 : 1, showLocks: !covered, showBun: !covered, keepSideLengths: true };
}

export function wardrobeGeometrySummary(items: readonly { model: string; price: number }[]) {
  const known = items.filter(item => wearableShape(item.model));
  const paid = known.filter(item => item.price > 0);
  return { catalogItems: items.length, modeledItems: known.length, unknownModels: [...new Set(items.filter(item => !wearableShape(item.model)).map(item => item.model))], distinctGeometrySets: new Set(known.map(item => wearableGeometrySignature(item.model))).size, paidItems: paid.length, distinctPaidGeometrySets: new Set(paid.map(item => wearableGeometrySignature(item.model))).size };
}
