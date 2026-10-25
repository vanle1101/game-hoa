import type { CosmeticDefinition } from "./types";
import type { GarmentSection, WearableAnchor, WearablePart, WearableShape, WearableVector } from "../components/world/wearable-shapes";

type Layer = "top" | "outerwear";
const arms = ["leftArm", "rightArm"] as const;
const side = (anchor: WearableAnchor) => anchor.startsWith("left") ? -1 : 1;
const part = (anchor: WearableAnchor, kind: WearablePart["kind"], at: WearableVector, size: WearableVector, extra: Partial<WearablePart> = {}): WearablePart => ({ anchor, kind, at, size, colorRole: "primary", ...extra });
const panel = (at: WearableVector, size: WearableVector, rotation: WearableVector = [0, 0, 0], colorRole: WearablePart["colorRole"] = "secondary") => part("torso", "box", at, size, { rotation, colorRole });

function shell(layer: Layer, hem: number, opening: number, cut: "straight" | "flare" | "waist" | "box"): WearablePart {
  const outer = layer === "outerwear";
  const width = outer ? .25 : .22;
  const depth = outer ? .161 : .127;
  const hemRatio = { straight: .87, flare: 1.02, waist: .8, box: .96 }[cut];
  const sections: GarmentSection[] = [
    { y: hem, width: width * hemRatio, depth: depth * .94 },
    { y: hem + .025, width: width * (hemRatio + .015), depth: depth * .96 },
    ...(hem + .025 < 1.14 ? [{ y: 1.14, width: width * (cut === "box" ? .94 : .84), depth: depth * .9 }] : []),
    { y: 1.235, width: width * (cut === "box" ? .97 : .92), depth },
    { y: 1.33, width: width, depth: depth * 1.025 },
    { y: 1.395, width: width * 1.04, depth: depth * .99 },
    { y: 1.44, width: width * 1.07, depth: depth * .94 },
    { y: 1.478, width: width * .65, depth: depth * .77 },
    { y: 1.512, width: outer ? .09 : .078, depth: outer ? .082 : .07 },
  ];
  return part("torso", "shell", [0, 0, 0], [1, 1, 1], { sections, opening });
}

function sleeve(anchor: typeof arms[number], length: number, outer = false, cut: "taper" | "bell" | "segment" = "taper"): WearablePart[] {
  const radius = outer ? .094 : .079;
  const end = cut === "bell" ? radius * 1.08 : outer ? radius * .98 : length < .2 ? radius * .86 : radius * .72;
  const pieces = [part(anchor, "ellipsoid", [-side(anchor) * .012, -.028, 0], [radius * .94, radius * 1.12, radius * 1.03], { rotation: [0, 0, -side(anchor) * .24] })];
  if (cut === "segment") {
    const joint = radius * (outer ? .99 : .85);
    pieces.push(part(anchor, "taper", [0, -.118, .003], [radius, .235, joint]));
    pieces.push(part(anchor, "ellipsoid", [0, -.24, .005], [joint * 1.01, .052, joint * 1.01], { colorRole: "secondary" }));
    pieces.push(part(anchor, "taper", [0, -(.24 + (length - .24) / 2), .008], [outer ? joint : radius * .84, length - .24, end]));
  } else {
    pieces.push(part(anchor, "taper", [0, -length / 2 - .008, .004], [radius, length, end]));
  }
  pieces.push(part(anchor, "taper", [0, -length, .005], [end * 1.04, .035, end * 1.02], { colorRole: "secondary" }));
  return pieces;
}
const sleeves = (length: number, outer = false, cut: "taper" | "bell" | "segment" = "taper") => arms.flatMap(anchor => sleeve(anchor, length, outer, cut));
function collar(height: number, outer = false): WearablePart[] {
  const r = outer ? .091 : .079;
  return [part("torso", "taper", [0, 1.498 + height / 2, -.004], [r, height, r + .005], { colorRole: "secondary" })];
}
function hood(outer = false): WearablePart[] {
  return [
    part("torso", "ellipsoid", [0, 1.452, outer ? -.161 : -.12], [outer ? .158 : .138, .077, .072], { colorRole: "secondary" }),
    part("torso", "ring", [0, 1.49, outer ? -.116 : -.08], [.102, .102, .08], { rotation: [Math.PI / 2 + .2, 0, 0], colorRole: "secondary" }),
  ];
}
function lapels(z: number, wide = false): WearablePart[] {
  return [-1, 1].map(s => panel([s * .075, 1.365, z], [wide ? .072 : .044, .205, .022], [.08, s * .2, -s * .32]));
}
function tails(length: number, width: number, split = false): WearablePart[] {
  return (["leftThigh", "rightThigh"] as const).flatMap(anchor => [
    part(anchor, "box", [side(anchor) * .035, .095 - length / 2, -.07], [width, length, .19], { rotation: [.03, 0, side(anchor) * .08] }),
    ...(split ? [part(anchor, "box", [side(anchor) * .07, .07 - length, -.122], [width * .65, .12, .035], { rotation: [.1, 0, side(anchor) * -.28], colorRole: "secondary" })] : []),
  ]);
}
const closure = (x: number, y: number, length: number, z: number, angle = 0) => panel([x, y, z], [.022, length, .016], [0, 0, angle], "trim");
const pockets = (y: number, z: number, wide = .078) => [-1, 1].map(s => panel([s * .11, y, z], [wide, .092, .03], [.08, s * -.12, 0]));
const make = (model: string, layer: Layer, parts: WearablePart[], detail: string[]): WearableShape => ({ model, layer, parts, geometryCount: parts.length, detail });

export const UPPER_V7_SHAPES: Readonly<Record<string, WearableShape>> = {
  "v7-top-wrap": make("v7-top-wrap", "top", [
    shell("top", 1.035, .1, "waist"), ...sleeve("leftArm", .41), ...sleeve("rightArm", .25),
    panel([.025, 1.29, .144], [.185, .3, .026], [.02, 0, -.22]), closure(.045, 1.3, .31, .162, -.22), ...collar(.045),
  ], ["Vạt đắp chéo", "Tay dài và tay lửng bất đối xứng", "Khóa lệch"]),
  "v7-top-bolero": make("v7-top-bolero", "top", [
    shell("top", 1.19, .3, "box"), ...sleeves(.18, false, "bell"), ...lapels(.148, true),
    panel([0, 1.205, -.126], [.34, .045, .03]),
  ], ["Thân lửng trên eo", "Tay chuông ngắn", "Ve áo rộng"]),
  "v7-top-anorak": make("v7-top-anorak", "top", [
    shell("top", 1.025, 0, "box"), ...sleeves(.34), ...hood(),
    panel([0, 1.305, .151], [.28, .115, .027]), panel([0, 1.14, .144], [.19, .085, .034]), closure(0, 1.432, .12, .15),
  ], ["Mũ gập sau gáy", "Nắp ngực chống gió", "Túi liền ngang bụng"]),
  "v7-top-field-vest": make("v7-top-field-vest", "top", [
    shell("top", 1.055, .28, "straight"), ...pockets(1.32, .148), ...pockets(1.155, .136, .094),
    ...[-1, 1].map(s => panel([s * .115, 1.448, .105], [.09, .085, .044], [0, 0, s * -.3])),
    panel([0, 1.075, .133], [.28, .042, .025]),
  ], ["Không tay", "Vai cầu nổi", "Bốn túi hộp sâu", "Đai ngang eo"]),
  "v7-top-combat-knit": make("v7-top-combat-knit", "top", [
    shell("top", 1.06, 0, "waist"), ...sleeves(.415, false, "segment"), ...collar(.065),
    ...arms.map(anchor => part(anchor, "box", [side(anchor) * .044, -.238, .055], [.074, .105, .025], { colorRole: "secondary" })),
    panel([0, 1.335, .148], [.25, .14, .025]),
  ], ["Tay ba đoạn", "Đệm khuỷu", "Yếm ngực", "Cổ đứng"]),
  "v7-top-side-tunic": make("v7-top-side-tunic", "top", [
    shell("top", 1.005, .08, "flare"), ...sleeve("leftArm", .15), ...sleeve("rightArm", .38),
    part("leftThigh", "box", [-.055, -.015, -.036], [.16, .24, .19], { rotation: [0, 0, -.12] }),
    panel([-.06, 1.2, .145], [.14, .22, .024], [0, 0, .12]), ...collar(.03),
  ], ["Vạt trái dài theo đùi", "Hai tay lệch chiều dài", "Thân xòe"]),
  "v7-top-racer": make("v7-top-racer", "top", [
    shell("top", 1.075, 0, "straight"), ...sleeves(.12), ...collar(.035),
    ...[-1, 1].map(s => panel([s * .1, 1.365, .138], [.075, .18, .03], [0, s * .15, s * -.38])),
    panel([0, 1.16, .135], [.24, .07, .028]),
  ], ["Tay chụp vai", "Hai mảng ngực chéo", "Đai bụng nổi"]),
  "v7-top-kimono": make("v7-top-kimono", "top", [
    shell("top", 1.04, .16, "flare"), ...sleeves(.28, false, "bell"), ...lapels(.149, true),
    panel([0, 1.135, .148], [.34, .075, .025]), panel([.11, 1.065, .155], [.065, .16, .024], [0, 0, -.18]),
  ], ["Tay chuông đến khuỷu", "Cổ giao nhau", "Đai bản rộng với vạt buộc"]),
  "v7-top-layered": make("v7-top-layered", "top", [
    shell("top", 1.025, 0, "straight"), ...sleeves(.415, false, "segment"),
    ...arms.map(anchor => part(anchor, "taper", [0, -.09, .003], [.086, .19, .08], { colorRole: "secondary" })),
    panel([0, 1.065, .13], [.32, .055, .02]),
    part("torso", "ring", [0, 1.505, .002], [.075, .075, .054], { rotation: [Math.PI / 2, 0, 0], colorRole: "secondary" }),
  ], ["Tay ngắn phủ tay dài", "Cổ tròn", "Gấu hai tầng"]),
  "v7-top-quilt-vest": make("v7-top-quilt-vest", "top", [
    shell("top", 1.095, 0, "box"), ...collar(.06),
    ...[1.16, 1.25, 1.34].flatMap(y => [panel([0, y, .15], [.31, .067, .04]), panel([0, y, -.135], [.3, .067, .035])]),
    closure(0, 1.3, .34, .178),
  ], ["Không tay", "Ba khoang chần trước và sau", "Cổ phồng"]),
  "v7-top-funnel": make("v7-top-funnel", "top", [
    shell("top", 1.07, 0, "waist"), ...sleeves(.39, false, "bell"),
    part("torso", "taper", [0, 1.515, -.005], [.104, .074, .079], { colorRole: "secondary" }),
    panel([-.06, 1.44, .125], [.135, .09, .025], [.12, 0, -.38]),
    ...[-1, 1].map(s => panel([s * .132, 1.18, .102], [.065, .18, .026], [0, s * -.28, s * .14])),
  ], ["Cổ phễu gập lệch", "Tay loe dài", "Hai mảng sườn"]),
  "v7-top-mechanic": make("v7-top-mechanic", "top", [
    shell("top", 1.02, .05, "straight"), ...sleeves(.255),
    ...arms.map(anchor => part(anchor, "taper", [0, -.24, .005], [.084, .075, .081], { colorRole: "secondary" })),
    panel([0, 1.285, .146], [.065, .34, .028]), ...pockets(1.34, .145, .075),
    panel([0, 1.08, .144], [.25, .105, .024]), ...collar(.025),
  ], ["Tay xắn bản rộng", "Nẹp dọc", "Tạp dề eo ngắn", "Túi ngực"]),
  "v7-top-cross-rig": make("v7-top-cross-rig", "top", [
    shell("top", 1.085, 0, "waist"), ...sleeves(.105),
    ...[-1, 1].map(s => panel([s * .035, 1.31, .152], [.058, .32, .028], [0, 0, s * .52])),
    panel([0, 1.125, .141], [.31, .065, .03]), panel([0, 1.32, .174], [.075, .07, .018], [0, 0, 0], "trim"),
  ], ["Đai chéo chữ X", "Tay cực ngắn", "Khóa ngực bản lớn"]),
  "v7-outer-cape": make("v7-outer-cape", "outerwear", [
    shell("outerwear", 1.08, .46, "flare"), ...collar(.055, true),
    ...arms.map(anchor => part(anchor, "box", [side(anchor) * .02, -.105, -.03], [.2, .27, .23], { rotation: [.07, 0, side(anchor) * .2] })),
    panel([0, 1.245, -.184], [.41, .34, .035]), ...lapels(.186),
  ], ["Choàng vai rời theo tay", "Lưng phủ rộng", "Mở thân trước"]),
  "v7-outer-duster": make("v7-outer-duster", "outerwear", [
    shell("outerwear", 1.015, .48, "straight"), ...sleeves(.425, true), ...tails(.45, .19),
    ...lapels(.184), panel([0, 1.4, -.174], [.36, .11, .035]),
  ], ["Vạt dài tách theo hai đùi", "Cầu lưng", "Ve hẹp"]),
  "v7-outer-peacoat": make("v7-outer-peacoat", "outerwear", [
    shell("outerwear", 1.025, .12, "waist"), ...sleeves(.4, true), ...lapels(.19, true),
    panel([.035, 1.25, .18], [.24, .28, .032]), ...tails(.15, .195),
    ...[1.19, 1.3, 1.4].flatMap(y => [-1, 1].map(s => panel([s * .08, y, .205], [.024, .026, .014], [0, 0, 0], "trim"))),
  ], ["Hai hàng cúc", "Vạt đắp rộng", "Ve bẻ bản lớn", "Gấu ngang hông"]),
  "v7-outer-biker": make("v7-outer-biker", "outerwear", [
    shell("outerwear", 1.135, .22, "waist"), ...sleeves(.41, true, "segment"),
    panel([.035, 1.32, .181], [.2, .27, .035], [0, 0, -.29]), closure(.05, 1.33, .29, .207, -.29),
    panel([-.085, 1.43, .179], [.105, .13, .028], [0, 0, .42]),
    ...arms.map(anchor => part(anchor, "box", [side(anchor) * .06, -.04, .018], [.065, .11, .13], { colorRole: "secondary" })),
  ], ["Khóa chéo", "Vai gia cố", "Tay phân đoạn", "Gấu lửng"]),
  "v7-outer-poncho": make("v7-outer-poncho", "outerwear", [
    shell("outerwear", 1.015, .35, "flare"), ...hood(true),
    ...arms.flatMap(anchor => [
      part(anchor, "ellipsoid", [-side(anchor) * .012, -.028, 0], [.10528, .12544, .11536], { rotation: [0, 0, -side(anchor) * .24] }),
      part(anchor, "taper", [0, -.085, -.01], [.112, .2, .145]),
    ]),
    panel([0, 1.29, .188], [.33, .18, .038]), ...tails(.2, .22),
  ], ["Tay choàng loe", "Yếm che mưa", "Mũ gập", "Gấu mở hai bên"]),
  "v7-outer-fishtail": make("v7-outer-fishtail", "outerwear", [
    shell("outerwear", 1.01, .36, "box"), ...sleeves(.43, true), ...hood(true), ...tails(.28, .19, true),
    ...pockets(1.16, .18, .095), closure(.052, 1.29, .36, .18),
  ], ["Đuôi cá xẻ đôi", "Mũ sau cổ", "Túi thấp lớn", "Nẹp chắn gió"]),
  "v7-outer-officer": make("v7-outer-officer", "outerwear", [
    shell("outerwear", 1.045, .24, "waist"), ...sleeves(.42, true), ...collar(.07, true), ...tails(.34, .18),
    panel([0, 1.402, -.18], [.43, .17, .045]),
    ...[-1, 1].map(s => panel([s * .158, 1.435, .09], [.11, .06, .15], [0, 0, s * -.16])),
    panel([0, 1.16, .179], [.37, .055, .026]),
  ], ["Cổ sĩ quan", "Cầu vai lớn", "Áo choàng lưng ngắn", "Đai eo"]),
  "v7-outer-expedition": make("v7-outer-expedition", "outerwear", [
    shell("outerwear", 1.035, .16, "box"), ...sleeves(.425, true, "segment"), ...collar(.045, true),
    ...pockets(1.32, .184, .1), ...pockets(1.145, .172, .11),
    ...arms.map(anchor => part(anchor, "box", [side(anchor) * .08, -.14, .012], [.045, .145, .09], { colorRole: "secondary" })),
    panel([0, 1.29, -.177], [.28, .23, .045]),
  ], ["Tay khớp ba đoạn", "Sáu túi hộp", "Mảng lưng dày", "Dáng hộp"]),
  "v7-outer-long-vest": make("v7-outer-long-vest", "outerwear", [
    shell("outerwear", 1.025, .52, "straight"), ...lapels(.187, true), ...tails(.4, .165),
    ...[-1, 1].map(s => panel([s * .14, 1.205, .149], [.07, .18, .032], [0, s * -.3, s * -.1])),
    panel([0, 1.15, -.171], [.36, .06, .024]),
  ], ["Áo dài không tay", "Ve rộng", "Túi dọc", "Đai sau lưng"]),
  "v7-outer-haori": make("v7-outer-haori", "outerwear", [
    shell("outerwear", 1.055, .4, "flare"), ...sleeves(.3, true, "bell"), ...tails(.22, .215),
    ...[-1, 1].map(s => panel([s * .085, 1.305, .182], [.072, .33, .026], [0, s * .15, s * -.19])),
    panel([0, 1.16, -.174], [.4, .09, .035]), panel([.14, 1.095, .18], [.065, .19, .025], [0, 0, -.14]),
  ], ["Tay chuông rộng", "Nẹp cổ dài", "Đai lưng rộng", "Vạt buộc lệch"]),
};

type Entry = [model: string, name: string, description: string, price: number, level: number, rarity: NonNullable<CosmeticDefinition["rarity"]>, color: string];
const entries: Entry[] = [
  ["v7-top-wrap", "Áo Giao Tuyến", "Vạt đắp chéo cùng hai tay bất đối xứng cho nhịp phố tương lai.", 145, 2, "rare", "#426778"],
  ["v7-top-bolero", "Áo lửng Chân Trời", "Thân ngắn trên eo, ve rộng và tay chuông gọn.", 155, 3, "rare", "#746886"],
  ["v7-top-anorak", "Áo Gió Ngầm", "Mũ gập sau gáy đi cùng nắp ngực chắn gió và túi ngang.", 165, 3, "epic", "#497f86"],
  ["v7-top-field-vest", "Ghi-lê Trạm Phố", "Vai cầu nổi, bốn túi hộp và đai eo cho người thám hiểm đô thị.", 140, 2, "uncommon", "#67745a"],
  ["v7-top-combat-knit", "Áo Mạch Giáp", "Tay ba đoạn ôm khớp, đệm khuỷu và yếm ngực tạo nét mạnh mẽ.", 180, 4, "epic", "#4d6078"],
  ["v7-top-side-tunic", "Áo Vạt Lệch", "Thân xòe với vạt trái dài theo đùi và hai tay lệch nhịp.", 170, 3, "rare", "#756393"],
  ["v7-top-racer", "Áo Đường Đua", "Tay chụp vai và mảng ngực chéo mang dáng thể thao công nghệ.", 135, 2, "uncommon", "#517b8e"],
  ["v7-top-kimono", "Áo Giao Ảnh", "Cổ giao nhau, tay chuông lửng và đai bản rộng có vạt buộc.", 190, 4, "epic", "#835d72"],
  ["v7-top-layered", "Áo Song Tầng", "Tay ngắn phủ tay dài cùng cổ tròn và gấu hai tầng.", 150, 2, "rare", "#5d7488"],
  ["v7-top-quilt-vest", "Ghi-lê Khoang Ấm", "Ba khoang chần nổi bao trước sau, giữ vai thoáng và cổ ấm.", 160, 3, "rare", "#89724e"],
  ["v7-top-funnel", "Áo Cổ Xoáy", "Cổ phễu gập lệch và tay loe dài tạo đường nét mềm giữa phố đêm.", 185, 4, "epic", "#657d88"],
  ["v7-top-mechanic", "Áo Xưởng Đêm", "Tay xắn rộng, nẹp dọc và tạp dề eo ngắn cho phong cách kỹ thuật.", 155, 2, "rare", "#96724e"],
  ["v7-top-cross-rig", "Áo Đai Giao Mạch", "Đai chữ X bản rộng khóa trên ngực, phối cùng tay cực ngắn.", 175, 3, "epic", "#4a6d72"],
  ["v7-outer-cape", "Áo choàng Vai Mây", "Mảng vai rời theo cánh tay và lưng phủ rộng trên thân áo mở.", 230, 4, "epic", "#66718d"],
  ["v7-outer-duster", "Áo khoác Đường Dài", "Vạt dài tách theo hai đùi, cầu lưng chắn gió và ve áo hẹp.", 250, 5, "epic", "#455c70"],
  ["v7-outer-peacoat", "Áo khoác Song Hàng", "Vạt đắp hai hàng cúc và ve rộng kết thúc ở ngang hông.", 240, 4, "epic", "#57667b"],
  ["v7-outer-biker", "Áo khoác Tia Chớp", "Khóa chéo trên thân lửng, vai gia cố và tay phân đoạn.", 265, 5, "legendary", "#75546b"],
  ["v7-outer-poncho", "Áo choàng Mưa Phố", "Tay choàng loe, yếm che mưa và mũ gập sau cổ.", 220, 3, "rare", "#497b7d"],
  ["v7-outer-fishtail", "Áo khoác Đuôi Sao", "Đuôi cá xẻ đôi, túi thấp lớn và nẹp chắn gió lệch.", 255, 4, "epic", "#637254"],
  ["v7-outer-officer", "Áo khoác Chỉ Huy", "Cổ đứng, cầu vai lớn và áo choàng lưng ngắn trên vạt dài.", 290, 6, "legendary", "#4d6184"],
  ["v7-outer-expedition", "Áo khoác Viễn Hành", "Tay ba đoạn cùng sáu túi hộp nổi và mảng lưng dày.", 275, 5, "epic", "#7a7056"],
  ["v7-outer-long-vest", "Ghi-lê Dọc Phố", "Áo dài không tay với ve rộng, túi dọc và đai sau lưng.", 235, 4, "rare", "#6f607d"],
  ["v7-outer-haori", "Áo khoác Dư Ảnh", "Tay chuông rộng, nẹp cổ dài và vạt buộc lệch trên dáng xòe.", 280, 5, "legendary", "#587d82"],
];

export const UPPER_V7_COSMETICS: CosmeticDefinition[] = entries.map(([model, name, description, price, level, rarity, color]) => ({
  id: model, model, name, description, slot: UPPER_V7_SHAPES[model].layer as Layer,
  price, level, rarity, color, starter: false, collection: "v7-neon-tailoring", assetId: `wearable.${model}`,
}));
