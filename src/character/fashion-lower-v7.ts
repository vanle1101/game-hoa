import type { CosmeticDefinition } from "./types";
import type { WearableAnchor, WearablePart, WearableShape, WearableVector } from "../components/world/wearable-shapes";

const thighs = ["leftThigh", "rightThigh"] as const;
const shins = ["leftShin", "rightShin"] as const;
const side = (anchor: WearableAnchor) => anchor.startsWith("left") ? -1 : 1;
const part = (anchor: WearableAnchor, kind: WearablePart["kind"], at: WearableVector, size: WearableVector, extra: Partial<WearablePart> = {}): WearablePart => ({ anchor, kind, at, size, colorRole: "primary", ...extra });
const box = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, extra: Partial<WearablePart> = {}) => part(anchor, "box", at, size, extra);
const taper = (anchor: WearableAnchor, y: number, top: number, length: number, bottom: number): WearablePart => part(anchor, "taper", [0, y, 0], [top, length, bottom]);
const shape = (model: string, layer: "bottom" | "shoes", parts: WearablePart[], detail: string[]): WearableShape => ({ model, layer, parts, geometryCount: parts.length, detail });

function waist(): WearablePart[] {
  return [
    part("torso", "ellipsoid", [0, .968, -.004], [.192, .096, .122]),
    part("torso", "shell", [0, 0, 0], [1, 1, 1], { sections: [
      { y: .95, width: .198, depth: .128 },
      { y: .99, width: .187, depth: .125 },
      { y: 1.035, width: .177, depth: .118 },
    ] }),
    box("torso", [0, 1.015, .124], [.044, .03, .015], { colorRole: "trim", metal: .65 }),
  ];
}

function articulatedLegs(): WearablePart[] {
  return [
    ...thighs.flatMap(anchor => [
      taper(anchor, -.192, .108, .414, .081),
      part(anchor, "ellipsoid", [0, -.386, .004], [.08, .062, .078]),
    ]),
    ...shins.map(anchor => taper(anchor, -.216, .081, .448, .061)),
  ];
}

function skirtPanels(length: number, width: number): WearablePart[] {
  return thighs.flatMap(anchor => [
    taper(anchor, -.12, .126, .3, width),
    box(anchor, [side(anchor) * .026, -.13, -.113], [.2, length, .022], { rotation: [.06, 0, side(anchor) * -.06] }),
  ]);
}

const bottomShapes = [
  shape("v7-wrap-skirt", "bottom", [
    ...waist(), ...articulatedLegs(), ...skirtPanels(.31, .15),
    box("leftThigh", [.018, -.14, .139], [.232, .33, .022], { rotation: [0, .12, -.2] }),
    box("rightThigh", [-.012, -.103, .143], [.197, .25, .025], { rotation: [0, -.12, .23] }),
    box("leftThigh", [-.112, -.045, .115], [.042, .055, .035], { colorRole: "trim", metal: .7 }),
  ], ["Vạt quấn chéo hai lớp", "Khóa hông lệch", "Quần lót dài chia khớp"]),
  shape("v7-fan-pleat-skirt", "bottom", [
    ...waist(), ...articulatedLegs(), ...skirtPanels(.29, .146),
    ...thighs.flatMap(anchor => [-2, -1, 0, 1, 2].map(i => box(anchor, [i * .045, -.145, .128 - Math.abs(i) * .013], [.053, .32, .025], { rotation: [.03, i * .2, i * .075], colorRole: i % 2 ? "secondary" : "primary" }))),
  ], ["Mười lá xếp ly nổi", "Gấu xòe hình quạt", "Hai nửa váy theo đùi"]),
  shape("v7-cargo-jogger", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...thighs.flatMap(anchor => [
      taper(anchor, -.125, .12, .27, .137),
      taper(anchor, -.304, .137, .14, .086),
      box(anchor, [side(anchor) * .125, -.19, .012], [.067, .14, .123]),
      box(anchor, [side(anchor) * .13, -.119, .017], [.074, .025, .132], { colorRole: "secondary" }),
      box(anchor, [side(anchor) * .155, -.19, .076], [.025, .072, .013], { colorRole: "trim" }),
    ]),
    ...shins.map(anchor => taper(anchor, -.408, .074, .075, .064)),
  ], ["Ống phồng thu gối", "Túi hộp có nắp và đai", "Bo cổ chân"]),
  shape("v7-asymmetric-drape", "bottom", [
    ...waist(), ...articulatedLegs(),
    box("leftThigh", [-.022, -.108, .122], [.21, .235, .028], { rotation: [0, .12, -.18] }),
    box("rightThigh", [.03, -.185, .124], [.23, .414, .03], { rotation: [0, -.15, .11] }),
    box("rightThigh", [.123, -.18, -.008], [.032, .4, .22], { rotation: [0, 0, .08] }),
    box("rightShin", [.058, -.09, .091], [.135, .19, .025], { rotation: [0, -.12, -.13] }),
    part("leftThigh", "ring", [-.109, -.07, .092], [.032, .036, .019], { colorRole: "trim" }),
  ], ["Vạt trái ngắn, vạt phải dài", "Đuôi vạt tách tại gối", "Vòng treo bên hông"]),
  shape("v7-tech-panel-skirt", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...thighs.flatMap(anchor => [
      taper(anchor, -.1, .125, .24, .143),
      ...[-1, 0, 1].map(i => box(anchor, [i * .086, -.157, i === 0 ? .143 : .072], [.082, .325 - Math.abs(i) * .04, .033], { rotation: [0, i * .66, i * .1] as WearableVector })),
      box(anchor, [0, -.288, .165], [.074, .018, .012], { colorRole: "glow" }),
      box(anchor, [side(anchor) * .117, -.04, -.032], [.035, .06, .118], { colorRole: "secondary" }),
    ]),
  ], ["Sáu tấm váy giáp rời", "Khe hở giữa các tấm", "Viền gấu tín hiệu"]),
  shape("v7-split-flare", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...shins.flatMap(anchor => [
      taper(anchor, -.1, .082, .22, .092),
      taper(anchor, -.318, .092, .232, .131),
      box(anchor, [side(anchor) * .106, -.336, .037], [.021, .22, .158], { rotation: [0, 0, side(anchor) * .18] }),
      box(anchor, [0, -.3, .096], [.022, .21, .016], { rotation: [.13, 0, 0], colorRole: "secondary" }),
    ]),
  ], ["Ống loe từ bắp chân", "Miếng chêm bên gấu", "Nẹp trước tách đôi"]),
  shape("v7-riding-breeches", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...thighs.flatMap(anchor => [
      part(anchor, "ellipsoid", [side(anchor) * .018, -.12, -.008], [.142, .185, .121]),
      box(anchor, [0, -.355, .077], [.122, .102, .034], { rotation: [.12, 0, 0], colorRole: "secondary" }),
    ]),
    ...shins.flatMap(anchor => [-.12, -.22, -.32].map(y => part(anchor, "ring", [0, y, 0], [.074, .074, .035], { rotation: [Math.PI / 2, 0, 0], colorRole: "secondary" }))),
  ], ["Đùi phồng kiểu cưỡi ngựa", "Miếng bảo vệ đầu gối", "Ba đai ôm bắp chân"]),
  shape("v7-box-culottes", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...thighs.flatMap(anchor => [
      taper(anchor, -.174, .128, .378, .146),
      box(anchor, [0, -.175, .129], [.197, .36, .028]),
      box(anchor, [0, -.175, -.124], [.195, .36, .025]),
      box(anchor, [0, -.353, .004], [.265, .028, .258], { colorRole: "secondary" }),
    ]),
  ], ["Quần lửng hai ống hộp", "Nẹp gấu ngang rộng", "Lớp legging bên trong"]),
  shape("v7-orbit-harness-pants", "bottom", [
    ...waist(), ...articulatedLegs(),
    ...thighs.flatMap(anchor => [
      part(anchor, "ring", [0, -.15, 0], [.116, .116, .039], { rotation: [Math.PI / 2, side(anchor) * .18, 0], colorRole: "secondary" }),
      box(anchor, [side(anchor) * .098, -.176, .064], [.028, .35, .025], { rotation: [.12, 0, side(anchor) * -.08] }),
      part(anchor, "ring", [side(anchor) * .105, -.285, .077], [.025, .036, .015], { colorRole: "trim", metal: .7 }),
      box(anchor, [0, -.15, .108], [.056, .035, .022], { colorRole: "trim" }),
    ]),
    box("leftShin", [-.066, -.16, .022], [.026, .19, .081], { colorRole: "secondary" }),
  ], ["Đai vòng quanh đùi", "Dây dọc và vòng treo", "Túi bắp chân đơn"]),
];

function shoe(model: string, make: (anchor: typeof shins[number]) => WearablePart[], detail: string[]): WearableShape {
  return shape(model, "shoes", shins.flatMap(make).map(piece => ({ ...piece, at: [piece.at[0], piece.at[1] - .091, piece.at[2]] })), detail);
}
const sole = (anchor: WearableAnchor, height = .032) => box(anchor, [0, -.474 + height / 2, .035], [.13, height, .263], { colorRole: "secondary" });
const heel = (anchor: WearableAnchor) => part(anchor, "ellipsoid", [0, -.401, -.026], [.059, .053, .066]);
const vamp = (anchor: WearableAnchor) => part(anchor, "ellipsoid", [0, -.412, .062], [.064, .042, .118]);
const lace = (anchor: WearableAnchor, y: number, z: number, angle = 0) => box(anchor, [0, y, z], [.074, .007, .012], { rotation: [0, angle, 0], colorRole: "trim" });

const shoeShapes = [
  shoe("v7-split-runner", anchor => [
    heel(anchor), vamp(anchor),
    box(anchor, [0, -.456, -.054], [.128, .036, .102], { colorRole: "secondary" }),
    box(anchor, [0, -.456, .102], [.134, .036, .132], { colorRole: "secondary" }),
    box(anchor, [0, -.436, .021], [.092, .017, .092], { rotation: [.12, 0, 0], colorRole: "trim" }),
    part(anchor, "taper", [0, -.367, -.01], [.062, .067, .067]),
    ...[0, 1, 2, 3].map(i => lace(anchor, -.365 - i * .014, .04 + i * .023, i % 2 ? -.2 : .2)),
    box(anchor, [side(anchor) * .059, -.411, .079], [.015, .022, .129], { colorRole: "glow" }),
  ], ["Đế gót và mũi tách rời", "Cầu đỡ vòm chân", "Bốn hàng dây chéo"]),
  shoe("v7-buckle-combat-boots", anchor => [
    sole(anchor, .044), heel(anchor), vamp(anchor),
    part(anchor, "taper", [0, -.297, -.008], [.069, .23, .065]),
    ...[-.22, -.29, -.36].flatMap(y => [
      box(anchor, [0, y, .06], [.128, .025, .026], { colorRole: "secondary" }),
      box(anchor, [side(anchor) * .043, y, .077], [.034, .035, .015], { colorRole: "trim", metal: .8 }),
    ]),
    box(anchor, [0, -.411, .15], [.11, .044, .046], { colorRole: "secondary" }),
  ], ["Cổ bốt cao", "Ba khóa ngang", "Mũi hộp gia cố"]),
  shoe("v7-chelsea-pull-boots", anchor => [
    sole(anchor), heel(anchor), vamp(anchor),
    part(anchor, "taper", [0, -.33, -.01], [.067, .164, .063]),
    ...[-1, 1].map(s => box(anchor, [s * .063, -.32, -.004], [.014, .128, .073], { colorRole: "secondary" })),
    part(anchor, "ring", [0, -.242, -.054], [.024, .035, .014], { colorRole: "trim" }),
    box(anchor, [0, -.44, -.049], [.114, .036, .085], { colorRole: "secondary" }),
  ], ["Hai mảng thun bên cổ", "Vòng kéo gót", "Đế liền và gót tầng"]),
  shoe("v7-wingtip-derby", anchor => [
    sole(anchor, .022), heel(anchor),
    box(anchor, [0, -.419, .104], [.117, .052, .119]),
    part(anchor, "ellipsoid", [0, -.402, .022], [.06, .046, .077]),
    ...[-1, 1].map(s => box(anchor, [s * .035, -.386, .114], [.017, .013, .106], { rotation: [0, s * .48, 0], colorRole: "secondary" })),
    ...[0, 1, 2].map(i => lace(anchor, -.359 - i * .012, .016 + i * .02)),
    box(anchor, [0, -.369, -.078], [.075, .035, .019], { colorRole: "secondary" }),
  ], ["Mũi vuông cánh én", "Dây buộc thấp", "Viền gót dựng"]),
  shoe("v7-ridge-platform", anchor => [
    sole(anchor, .068),
    part(anchor, "ellipsoid", [0, -.374, .06], [.068, .04, .121]),
    part(anchor, "ellipsoid", [0, -.365, -.031], [.06, .052, .065]),
    ...[-.07, -.015, .04, .095, .15].map(z => box(anchor, [0, -.455, z], [.146, .038, .025], { colorRole: "trim" })),
    box(anchor, [0, -.328, .048], [.13, .032, .046], { rotation: [.15, 0, 0] }),
    box(anchor, [side(anchor) * .059, -.328, .048], [.025, .042, .052], { colorRole: "trim", metal: .65 }),
  ], ["Đế bánh răng dày", "Quai bản rộng", "Khóa cạnh ngoài"]),
  shoe("v7-tabi-zip", anchor => [
    box(anchor, [0, -.458, -.014], [.122, .032, .175], { colorRole: "secondary" }),
    ...[-1, 1].flatMap(s => [
      box(anchor, [s * .034, -.458, .117], [.059, .032, .102], { colorRole: "secondary" }),
      part(anchor, "ellipsoid", [s * .034, -.418, .112], [.028, .038, .061]),
    ]),
    heel(anchor),
    part(anchor, "ellipsoid", [0, -.407, .012], [.059, .046, .061]),
    part(anchor, "taper", [0, -.349, -.012], [.06, .109, .064]),
    box(anchor, [0, -.342, .055], [.012, .115, .014], { colorRole: "trim", metal: .7 }),
  ], ["Mũi hai nhánh có khe thật", "Đế mũi chia đôi", "Khóa kéo dọc"]),
  shoe("v7-double-monk", anchor => [
    sole(anchor, .028), heel(anchor), vamp(anchor),
    ...[0, 1].flatMap(i => [
      box(anchor, [0, -.368 - i * .025, .038 + i * .042], [.112, .022, .033], { rotation: [0, side(anchor) * .26, 0] }),
      part(anchor, "ring", [side(anchor) * .044, -.366 - i * .025, .041 + i * .042], [.022, .017, .012], { rotation: [Math.PI / 2, 0, 0], colorRole: "trim", metal: .75 }),
    ]),
    box(anchor, [0, -.441, -.047], [.109, .036, .083], { colorRole: "secondary" }),
  ], ["Hai quai chéo", "Hai khóa vòng", "Gót vuông thấp"]),
  shoe("v7-arch-wedge", anchor => [
    sole(anchor, .023),
    box(anchor, [0, -.422, -.047], [.118, .075, .087], { colorRole: "secondary" }),
    box(anchor, [0, -.42, .048], [.12, .043, .205], { rotation: [.21, 0, 0], colorRole: "secondary" }),
    part(anchor, "ellipsoid", [0, -.378, .064], [.064, .036, .115]),
    part(anchor, "ellipsoid", [0, -.353, -.034], [.058, .051, .064]),
    box(anchor, [0, -.325, -.007], [.116, .026, .055], { rotation: [.16, 0, 0] }),
    ...[-1, 1].map(s => box(anchor, [s * .056, -.352, .042], [.018, .025, .118], { rotation: [.2, s * .3, 0], colorRole: "trim" })),
  ], ["Gót nêm có mặt dốc", "Quai ôm cổ chân", "Hai thanh đỡ chéo"]),
  shoe("v7-armored-greaves", anchor => [
    sole(anchor, .04), heel(anchor),
    box(anchor, [0, -.413, .105], [.127, .058, .122]),
    part(anchor, "taper", [0, -.265, -.012], [.074, .29, .068]),
    ...[0, 1, 2, 3].map(i => box(anchor, [0, -.142 - i * .062, .063], [.123 - i * .005, .057, .032], { rotation: [.12, 0, 0], colorRole: i === 0 ? "trim" : "secondary" })),
    part(anchor, "ellipsoid", [side(anchor) * .074, -.27, .022], [.017, .034, .034], { colorRole: "trim", metal: .7 }),
    box(anchor, [0, -.378, .1], [.11, .025, .088], { rotation: [.28, 0, 0], colorRole: "secondary" }),
  ], ["Cổ giáp cao chia bốn tấm", "Núm siết bên ngoài", "Tấm chắn mu chân"]),
];

export const LOWER_V7_SHAPES: Readonly<Record<string, WearableShape>> = Object.fromEntries([...bottomShapes, ...shoeShapes].map(value => [value.model, value]));

const cosmetic = (model: string, name: string, description: string, slot: "bottom" | "shoes", price: number, color: string, rarity: NonNullable<CosmeticDefinition["rarity"]>, level: number): CosmeticDefinition => ({ id: model, name, description, slot, price, color, model, rarity, level, starter: false, collection: "v7-urban-forms", assetId: `wearable.${model}` });

export const LOWER_V7_COSMETICS: CosmeticDefinition[] = [
  cosmetic("v7-wrap-skirt", "Váy quấn Giao Lộ", "Hai vạt chéo lệch và khóa hông, phối cùng lớp quần ôm linh hoạt.", "bottom", 145, "#465365", "rare", 2),
  cosmetic("v7-fan-pleat-skirt", "Váy xếp ly Nhịp Sóng", "Những lá ly nổi xòe thành quạt khi bước đi, gọn ở eo.", "bottom", 165, "#655676", "epic", 3),
  cosmetic("v7-cargo-jogger", "Quần túi hộp Trạm Đêm", "Đùi phồng, túi nắp khóa và cổ chân bo dành cho hành trình đô thị.", "bottom", 140, "#465e60", "rare", 2),
  cosmetic("v7-asymmetric-drape", "Quần vạt lệch Quỹ Đạo", "Một bên vạt ngắn, một bên vạt dài tách khớp tạo nét bất đối xứng.", "bottom", 190, "#47475f", "epic", 3),
  cosmetic("v7-tech-panel-skirt", "Váy giáp Mạch Sáng", "Sáu tấm váy kỹ thuật rời, gấu có viền tín hiệu và khe chuyển động.", "bottom", 220, "#315267", "legendary", 4),
  cosmetic("v7-split-flare", "Quần ống loe Chân Trời", "Ống loe từ bắp chân với miếng chêm bên và nẹp gấu tách đôi.", "bottom", 155, "#626b7b", "rare", 2),
  cosmetic("v7-riding-breeches", "Quần kỵ sĩ Thành Phố", "Đùi phồng, đầu gối gia cố và ba đai ôm bắp chân.", "bottom", 175, "#61554b", "epic", 3),
  cosmetic("v7-box-culottes", "Quần lửng Khối Phố", "Hai ống hộp rộng có nẹp ngang, kết hợp lớp legging bên trong.", "bottom", 135, "#4d596f", "uncommon", 1),
  cosmetic("v7-orbit-harness-pants", "Quần đai Vệ Tinh", "Đai vòng đùi, dây dọc và túi bắp chân đơn cho dáng kỹ thuật.", "bottom", 185, "#374957", "epic", 3),
  cosmetic("v7-split-runner", "Giày chạy Cầu Xung", "Đế gót và mũi tách nhau bằng cầu vòm, bốn hàng dây chéo giữ chân.", "shoes", 140, "#426c79", "rare", 2),
  cosmetic("v7-buckle-combat-boots", "Bốt ba khóa Tiền Tuyến", "Cổ cao với ba khóa ngang và mũi hộp gia cố.", "shoes", 185, "#3e4a58", "epic", 3),
  cosmetic("v7-chelsea-pull-boots", "Bốt thun Bến Đêm", "Mảng thun hai bên và vòng kéo gót trên dáng bốt thanh gọn.", "shoes", 125, "#51474f", "uncommon", 1),
  cosmetic("v7-wingtip-derby", "Giày cánh én Quảng Trường", "Mũi vuông, đường cánh én nổi và dây buộc thấp cho bộ công sở.", "shoes", 155, "#535e6d", "rare", 2),
  cosmetic("v7-ridge-platform", "Giày đế răng Tầng Mây", "Đế dày có năm gờ ngang, quai bản rộng và khóa bên ngoài.", "shoes", 175, "#645477", "epic", 3),
  cosmetic("v7-tabi-zip", "Bốt tách mũi Song Tuyến", "Mũi và đế chia hai nhánh riêng, cổ chân đóng bằng khóa kéo dọc.", "shoes", 165, "#3a5561", "rare", 2),
  cosmetic("v7-double-monk", "Giày hai quai Quỹ Tích", "Hai quai chéo có khóa vòng trên gót vuông thấp và mũi tròn dài.", "shoes", 150, "#685645", "rare", 2),
  cosmetic("v7-arch-wedge", "Giày gót nêm Đường Dốc", "Mặt đế nghiêng nâng gót, quai cổ chân và hai thanh đỡ chéo.", "shoes", 180, "#596176", "epic", 3),
  cosmetic("v7-armored-greaves", "Bốt giáp Pháo Đài", "Bốn tấm chắn cổ cao, núm siết bên ngoài và tấm chắn mu chân.", "shoes", 230, "#3f6270", "legendary", 4),
];
