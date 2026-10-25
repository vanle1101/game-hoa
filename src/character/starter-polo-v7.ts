import type { CosmeticDefinition } from "./types";
import type { WearablePart, WearableShape, WearableVector } from "../components/world/wearable-shapes";

const model = "v7-starter-zip-polo";
const part = (anchor: WearablePart["anchor"], kind: WearablePart["kind"], at: WearableVector, size: WearableVector, extra: Partial<WearablePart> = {}): WearablePart => ({ anchor, kind, at, size, colorRole: "primary", ...extra });
const panel = (at: WearableVector, size: WearableVector, rotation: WearableVector): WearablePart => part("torso", "box", at, size, { colorRole: "secondary", rotation });

const parts: WearablePart[] = [
  part("torso", "shell", [0, 0, 0], [1, 1, 1], {
    opening: 0,
    sections: [
      { y: 1.045, width: .187, depth: .113 },
      { y: 1.072, width: .19, depth: .115 },
      { y: 1.135, width: .181, depth: .11 },
      { y: 1.235, width: .203, depth: .121 },
      { y: 1.33, width: .218, depth: .126 },
      { y: 1.395, width: .227, depth: .122 },
      { y: 1.44, width: .234, depth: .116 },
      { y: 1.478, width: .145, depth: .087 },
      { y: 1.512, width: .078, depth: .069 },
    ],
  }),
  ...(["leftArm", "rightArm"] as const).flatMap(anchor => {
    const side = anchor === "leftArm" ? -1 : 1;
    return [
      part(anchor, "ellipsoid", [-side * .012, -.028, 0], [.073, .085, .078], { rotation: [0, 0, -side * .24] }),
      part(anchor, "taper", [0, -.103, .004], [.079, .19, .071]),
      part(anchor, "taper", [0, -.185, .004], [.078, .036, .077], { colorRole: "secondary" }),
    ];
  }),
  part("torso", "taper", [0, 1.507, -.004], [.09, .034, .091], { colorRole: "secondary" }),
  ...[-1, 1].map(side => panel([side * .055, 1.463, .098], [.062, .082, .016], [.24, side * .25, side * .42])),
  panel([0, 1.401, .139], [.032, .142, .014], [0, 0, 0]),
  part("torso", "box", [0, 1.401, .15], [.006, .127, .007], { colorRole: "trim", metal: .5 }),
  part("torso", "box", [0, 1.438, .158], [.015, .026, .008], { colorRole: "trim", metal: .65 }),
  ...[-1, 1].flatMap(side => [
    panel([side * .09, 1.316, .119], [.145, .068, .016], [.08, side * .34, -side * .36]),
    part("torso", "box", [side * .09, 1.284, .123], [.145, .006, .01], { colorRole: "secondary", rotation: [.08, side * .34, -side * .36] }),
  ]),
  panel([0, 1.395, -.122], [.28, .052, .014], [-.08, 0, 0]),
];

export const STARTER_POLO_V7_SHAPES: Record<string, WearableShape> = {
  [model]: {
    model,
    layer: "top",
    geometryCount: parts.length,
    parts,
    detail: ["Cổ bẻ hai lá", "Khóa kéo ngắn trước ngực", "Tay ngắn bo phối màu", "Mảng ngực hình học hai màu", "Thân vải kín với cầu vai dốc"],
  },
};

export const STARTER_POLO_V7_COSMETICS: CosmeticDefinition[] = [{
  id: model,
  model,
  name: "Áo polo Giao Nhịp",
  description: "Áo cổ bẻ, khóa kéo ngắn và mảng ngực hai màu, miễn phí cho hành trình đầu.",
  slot: "top",
  price: 0,
  starter: true,
  level: 1,
  rarity: "common",
  color: "#6b8e9a",
  collection: "starter-signal",
  assetId: `wearable.${model}`,
}];
