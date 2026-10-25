import type { CosmeticDefinition } from "./types";
import type { WearableAnchor, WearablePart, WearableShape, WearableVector } from "../components/world/wearable-shapes";

type AccessorySlot = Extract<CosmeticDefinition["slot"], "headwear" | "eyewear" | "gloves" | "back" | "jewelry">;
const sides = [-1, 1] as const;
const arms = ["leftArm", "rightArm"] as const;
const p = (anchor: WearableAnchor, kind: WearablePart["kind"], at: WearableVector, size: WearableVector, colorRole: WearablePart["colorRole"] = "primary", extra: Partial<WearablePart> = {}): WearablePart => ({ anchor, kind, at, size, colorRole, ...extra });
const box = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, rotation?: WearableVector, colorRole: WearablePart["colorRole"] = "primary") => p(anchor, "box", at, size, colorRole, rotation ? { rotation } : {});
const ring = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, rotation: WearableVector = [0, 0, 0]) => p(anchor, "ring", at, size, "trim", { rotation, metal: .85 });
const orb = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, colorRole: WearablePart["colorRole"] = "primary", rotation?: WearableVector) => p(anchor, "ellipsoid", at, size, colorRole, rotation ? { rotation } : {});
const taper = (anchor: WearableAnchor, at: WearableVector, size: WearableVector, colorRole: WearablePart["colorRole"] = "primary") => p(anchor, "taper", at, size, colorRole);
const recipe = (model: string, layer: WearableShape["layer"], parts: WearablePart[], detail: string[], hairAdjustment?: "flatten"): WearableShape => ({ model, layer, parts, geometryCount: parts.length, detail, ...(hairAdjustment ? { hairAdjustment } : {}) });

function bar(anchor: WearableAnchor, from: WearableVector, to: WearableVector, thickness: number, colorRole: WearablePart["colorRole"] = "trim"): WearablePart {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  return box(anchor, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], [thickness, length, thickness], [Math.atan2(dz, dy), 0, -Math.atan2(dx, Math.hypot(dy, dz))], colorRole);
}
function contour(points: readonly [number, number][], side: number): WearablePart[] {
  return points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return bar("head", [side * (.047 + point[0]), .018 + point[1], .137], [side * (.047 + next[0]), .018 + next[1], .137], .004);
  });
}
function temples(y = .03): WearablePart[] {
  return sides.flatMap(side => [
    bar("head", [side * .089, y, .137], [side * .137, y, .08], .006, "secondary"),
    box("head", [side * .137, y - .004, .018], [.006, .008, .124], undefined, "secondary"),
    box("head", [side * .137, y - .012, -.044], [.008, .023, .009], [.2, 0, 0], "secondary"),
  ]);
}
const bridge = () => bar("head", [-.012, .031, .14], [.012, .031, .14], .005);
function shoulderStraps(): WearablePart[] {
  return sides.flatMap(side => [
    bar("torso", [side * .132, 1.14, .165], [side * .15, 1.43, .12], .022, "secondary"),
    bar("torso", [side * .15, 1.43, .12], [side * .135, 1.46, -.16], .022, "secondary"),
  ]);
}
function necklace(low: number): WearablePart[] {
  return [
    ring("torso", [0, 1.514, 0], [.086, .086, .035], [Math.PI / 2, 0, 0]),
    ...sides.map(side => bar("torso", [side * .062, 1.485, .105], [0, low, .184], .006)),
  ];
}

export const ACCESSORY_V7_SHAPES: Readonly<Record<string, WearableShape>> = {
  "v7-head-patrol": recipe("v7-head-patrol", "headwear", [
    orb("head", [0, .119, -.012], [.133, .061, .124]),
    box("head", [0, .078, .129], [.214, .014, .15], [.08, 0, 0]),
    taper("head", [0, .086, -.012], [.129, .022, .13], "secondary"),
    ...sides.map(side => bar("head", [side * .025, .174, .012], [side * .084, .124, .088], .006)),
    box("head", [0, .116, .111], [.035, .026, .009], undefined, "trim"),
    box("head", [0, .089, -.137], [.04, .013, .01], undefined, "secondary"),
  ], ["Vòm sáu múi", "Lưỡi trai nhô trước", "Khóa chỉnh sau gáy"], "flatten"),
  "v7-head-bucket": recipe("v7-head-bucket", "headwear", [
    taper("head", [0, .133, -.01], [.103, .093, .128]),
    orb("head", [0, .179, -.01], [.103, .014, .103]),
    ring("head", [0, .082, -.01], [.148, .137, .035], [Math.PI / 2, 0, 0]),
    ring("head", [0, .089, -.01], [.13, .12, .024], [Math.PI / 2, 0, 0]),
    ...sides.map(side => box("head", [side * .116, .125, .01], [.009, .018, .034], undefined, "trim")),
  ], ["Chóp cụt liền", "Vành tròn hai tầng", "Lỗ thoáng hai bên"], "flatten"),
  "v7-head-beret": recipe("v7-head-beret", "headwear", [
    orb("head", [.028, .134, -.01], [.152, .052, .126], "primary", [0, 0, -.16]),
    ring("head", [0, .087, -.009], [.121, .115, .026], [Math.PI / 2, 0, 0]),
    box("head", [.036, .187, -.012], [.01, .022, .012], [0, 0, -.2]),
    box("head", [-.081, .109, .098], [.026, .027, .008], [0, 0, .2], "trim"),
  ], ["Vòm lệch bên", "Đai ôm đầu", "Cuống đỉnh ngắn"], "flatten"),
  "v7-head-knit": recipe("v7-head-knit", "headwear", [
    orb("head", [0, .142, -.012], [.126, .082, .121]),
    taper("head", [0, .091, -.01], [.132, .039, .132], "secondary"),
    orb("head", [0, .225, -.012], [.032, .03, .032], "trim"),
    ...[-.09, -.06, -.03, 0, .03, .06, .09].map(x => box("head", [x, .094, .116 - Math.abs(x) * .25], [.006, .032, .009], undefined, "trim")),
  ], ["Chóp len cao", "Gấu lật có gân", "Quả bông đỉnh"], "flatten"),
  "v7-head-flight": recipe("v7-head-flight", "headwear", [
    orb("head", [0, .111, -.025], [.137, .067, .131]),
    box("head", [0, .168, -.022], [.027, .026, .202], undefined, "secondary"),
    ...sides.flatMap(side => [
      orb("head", [side * .135, .042, -.025], [.024, .05, .057], "secondary"),
      ring("head", [side * .159, .042, -.025], [.023, .023, .01], [0, Math.PI / 2, 0]),
      box("head", [side * .105, .089, .077], [.032, .018, .048], [0, side * -.3, 0], "trim"),
    ]),
  ], ["Vòm bảo hộ có sống", "Hai chụp tai", "Mặt trước để hở"], "flatten"),
  "v7-head-cylinder": recipe("v7-head-cylinder", "headwear", [
    taper("head", [0, .164, -.012], [.112, .148, .12]),
    orb("head", [0, .239, -.012], [.113, .012, .113]),
    ring("head", [0, .085, -.012], [.157, .147, .03], [Math.PI / 2, 0, 0]),
    taper("head", [0, .111, -.012], [.123, .022, .123], "secondary"),
    ...sides.map(side => box("head", [side * .018, .113, .113], [.033, .025, .014], [0, 0, side * .22], "trim")),
    orb("head", [0, .113, .126], [.009, .012, .009], "secondary"),
  ], ["Thân trụ cao", "Vành đĩa rộng", "Nơ đôi phía trước"], "flatten"),

  "v7-eye-round": recipe("v7-eye-round", "accessory", [
    ...sides.map(side => ring("head", [side * .047, .018, .137], [.034, .029, .018])), bridge(), ...temples(),
  ], ["Hai vòng kính tròn rỗng", "Cầu mũi mảnh", "Càng móc sau tai"]),
  "v7-eye-rectangle": recipe("v7-eye-rectangle", "accessory", [
    ...sides.flatMap(side => contour([[-.034, -.022], [.034, -.022], [.034, .022], [-.034, .022]], side)),
    bridge(), ...temples(.038),
  ], ["Gọng chữ nhật", "Cầu ngang cao", "Càng thẳng hai bên"]),
  "v7-eye-hexagon": recipe("v7-eye-hexagon", "accessory", [
    ...sides.flatMap(side => contour([[-.035, 0], [-.018, -.028], [.018, -.028], [.035, 0], [.018, .028], [-.018, .028]], side)),
    bridge(), ...temples(),
  ], ["Khung sáu cạnh", "Khoảng mắt mở", "Càng gập cuối"]),
  "v7-eye-aviator": recipe("v7-eye-aviator", "accessory", [
    ...sides.flatMap(side => contour([[-.033, .022], [.032, .022], [.036, -.006], [.016, -.034], [-.012, -.035], [-.031, -.014]], side)),
    bridge(), bar("head", [-.025, .049, .139], [.025, .049, .139], .004), ...temples(.037),
  ], ["Gọng giọt lệ", "Cầu mũi kép", "Đáy kính hạ thấp"]),
  "v7-eye-cat": recipe("v7-eye-cat", "accessory", [
    ...sides.flatMap(side => contour([[-.032, .016], [.044, .035], [.031, -.012], [.01, -.026], [-.02, -.02]], side)),
    bridge(), ...temples(.043),
    ...sides.map(side => orb("head", [side * .09, .052, .138], [.007, .004, .004], "glow")),
  ], ["Đuôi gọng xếch", "Góc ngoài nhọn", "Điểm sáng trên đuôi"]),
  "v7-eye-brow": recipe("v7-eye-brow", "accessory", [
    ...sides.map(side => ring("head", [side * .047, .016, .137], [.035, .026, .014])),
    ...sides.map(side => box("head", [side * .049, .045, .137], [.079, .011, .012], [0, 0, side * .08], "secondary")),
    bridge(), ...temples(.042),
  ], ["Nửa gọng trên dày", "Viền dưới thanh", "Càng nối đường mày"]),
  "v7-eye-shield": recipe("v7-eye-shield", "accessory", [
    ...sides.flatMap(side => contour([[-.033, -.023], [.027, -.023], [.041, -.004], [.03, .024], [-.031, .024]], side)),
    bridge(), ...temples(.035),
    ...sides.flatMap(side => [
      box("head", [side * .113, .022, .098], [.016, .048, .022], [0, side * -.4, 0], "secondary"),
      ...[-.009, .009].map(y => box("head", [side * .123, .022 + y, .107], [.01, .004, .018], undefined, "glow")),
    ]),
  ], ["Khung bảo hộ ngũ giác", "Tấm chắn thái dương", "Khe thoáng bên hông"]),
  "v7-eye-asymmetric": recipe("v7-eye-asymmetric", "accessory", [
    ring("head", [-.047, .018, .137], [.034, .03, .017]),
    ...contour([[-.032, -.023], [.032, -.023], [.032, .025], [-.032, .025]], 1),
    bridge(), ...temples(.037),
    bar("head", [.084, .04, .139], [.111, .065, .126], .008),
    orb("head", [.113, .068, .126], [.012, .009, .008], "glow"),
  ], ["Một gọng tròn một gọng vuông", "Mắt để mở", "Đầu cảm biến lệch bên"]),

  "v7-glove-fingerless": recipe("v7-glove-fingerless", "anchor", arms.flatMap(anchor => [
    taper(anchor, [0, -.429, .018], [.047, .043, .044], "secondary"),
    box(anchor, [0, -.466, .026], [.056, .061, .045]),
    ...[-.018, 0, .018].map(x => orb(anchor, [x, -.48, .054], [.008, .009, .007], "trim")),
    box(anchor, [0, -.447, .052], [.035, .01, .009], undefined, "glow"),
  ]), ["Cổ tay ôm tròn", "Mu tay ngắn", "Ba đệm khớp hở ngón"]),
  "v7-glove-gauntlet": recipe("v7-glove-gauntlet", "anchor", arms.flatMap(anchor => [
    taper(anchor, [0, -.389, .014], [.06, .127, .048], "secondary"),
    ...[0, 1, 2].map(i => box(anchor, [0, -.352 - i * .036, .068], [.079 - i * .009, .03, .018], [.12, 0, 0])),
    box(anchor, [0, -.469, .026], [.06, .067, .048]),
    ...[-.024, -.008, .008, .024].map(x => box(anchor, [x, -.512, .031], [.014, .042, .022], undefined, "secondary")),
  ]), ["Ống giáp cẳng tay", "Ba bản chồng", "Bốn ngón bọc riêng"]),
  "v7-glove-laced": recipe("v7-glove-laced", "anchor", arms.flatMap(anchor => [
    taper(anchor, [0, -.399, .014], [.057, .1, .047]),
    ...[-.434, -.367].map(y => ring(anchor, [0, y, .014], [.053, .053, .042], [Math.PI / 2, 0, 0])),
    ...[0, 1, 2].flatMap(i => sides.map(side => bar(anchor, [side * .026, -.368 - i * .023, .067], [-side * .026, -.388 - i * .023, .067], .005))),
  ]), ["Nẹp cổ tay mở bàn tay", "Hai đai vòng", "Dây đan chéo ba hàng"]),
  "v7-glove-console": recipe("v7-glove-console", "anchor", arms.flatMap(anchor => [
    ...[-.442, -.392].map(y => taper(anchor, [0, y, .017], [.049, .016, .049], "secondary")),
    box(anchor, [0, -.417, .073], [.064, .065, .024]),
    box(anchor, [0, -.413, .088], [.045, .036, .008], undefined, "glow"),
    ...[-.016, .016].map(x => orb(anchor, [x, -.44, .088], [.005, .005, .004], "trim")),
    box(anchor, [anchor === "leftArm" ? -.04 : .04, -.417, .058], [.012, .022, .024], undefined, "trim"),
  ]), ["Hai dây đeo tách rời", "Màn điều khiển nổi", "Nút bên cổ tay"]),
  "v7-glove-mitten": recipe("v7-glove-mitten", "anchor", arms.flatMap(anchor => [
    taper(anchor, [0, -.422, .017], [.052, .037, .052], "secondary"),
    orb(anchor, [0, -.482, .028], [.044, .064, .035]),
    orb(anchor, [anchor === "leftArm" ? .037 : -.037, -.47, .042], [.015, .03, .017], "primary", [0, 0, anchor === "leftArm" ? -.35 : .35]),
    bar(anchor, [-.027, -.478, .056], [.027, -.478, .056], .008),
  ]), ["Túi găng liền ngón", "Ngón cái tách bên", "Gân ngang mu tay"]),

  "v7-back-sling": recipe("v7-back-sling", "anchor", [
    box("torso", [.032, 1.279, -.209], [.187, .278, .095], [0, 0, -.35]),
    box("torso", [.046, 1.266, -.264], [.13, .11, .024], [0, 0, -.35], "secondary"),
    bar("torso", [-.135, 1.43, .155], [.127, 1.105, .166], .034, "secondary"),
    bar("torso", [-.135, 1.43, .155], [-.115, 1.45, -.16], .034, "secondary"),
    bar("torso", [-.055, 1.37, -.26], [.055, 1.338, -.266], .008),
    box("torso", [.014, 1.24, .17], [.046, .035, .018], [0, 0, -.65], "trim"),
  ], ["Túi lệch chéo lưng", "Dây đeo đơn", "Túi trước có khóa"]),
  "v7-back-hardpack": recipe("v7-back-hardpack", "anchor", [
    box("torso", [0, 1.287, -.216], [.245, .316, .112]),
    ...sides.map(side => box("torso", [side * .068, 1.283, -.282], [.109, .25, .028], [0, side * .1, 0], "secondary")),
    ...[1.2, 1.27, 1.34].map(y => box("torso", [0, y, -.301], [.016, .04, .012], undefined, "glow")),
    box("torso", [0, 1.461, -.214], [.095, .028, .038], undefined, "trim"),
    ...shoulderStraps(),
  ], ["Vỏ cứng chia đôi", "Sống giữa ba khe sáng", "Quai xách và dây vai"]),
  "v7-back-canisters": recipe("v7-back-canisters", "anchor", [
    box("torso", [0, 1.28, -.176], [.239, .252, .032], undefined, "secondary"),
    ...sides.flatMap(side => [
      taper("torso", [side * .075, 1.29, -.233], [.056, .29, .056]),
      ...[1.169, 1.411].map(y => ring("torso", [side * .075, y, -.233], [.06, .06, .035], [Math.PI / 2, 0, 0])),
      orb("torso", [side * .075, 1.444, -.233], [.04, .019, .04], "trim"),
    ]), ...shoulderStraps(),
  ], ["Hai bình dọc", "Bốn đai giữ", "Tấm lưng chịu lực"]),
  "v7-back-folded-fan": recipe("v7-back-folded-fan", "anchor", [
    box("torso", [0, 1.28, -.188], [.105, .265, .062], undefined, "secondary"),
    ...sides.flatMap(side => [
      bar("torso", [side * .035, 1.17, -.23], [side * .245, 1.43, -.224], .029),
      bar("torso", [side * .026, 1.17, -.25], [side * .155, 1.48, -.25], .025),
      box("torso", [side * .137, 1.313, -.233], [.074, .267, .018], [0, 0, -side * .57]),
      ring("torso", [side * .036, 1.17, -.27], [.024, .024, .017]),
    ]), ...shoulderStraps(),
  ], ["Khung quạt gập", "Cánh nan xiên đôi", "Khớp bản lề thấp"]),
  "v7-back-roll": recipe("v7-back-roll", "anchor", [
    box("torso", [0, 1.22, -.21], [.25, .205, .09]),
    p("torso", "taper", [0, 1.38, -.227], [.071, .29, .071], "secondary", { rotation: [0, 0, Math.PI / 2] }),
    ...sides.flatMap(side => [
      ring("torso", [side * .087, 1.38, -.227], [.076, .076, .03], [0, Math.PI / 2, 0]),
      box("torso", [side * .08, 1.22, -.263], [.028, .19, .014], undefined, "trim"),
      box("torso", [side * .08, 1.19, -.275], [.044, .038, .015], undefined, "secondary"),
    ]), ...shoulderStraps(),
  ], ["Túi đáy vuông", "Cuộn ngang trên nắp", "Hai dây khóa dọc"]),

  "v7-jewel-prism": recipe("v7-jewel-prism", "accessory", [
    ...necklace(1.342),
    box("torso", [0, 1.322, .187], [.032, .044, .015], [0, 0, Math.PI / 4], "trim"),
    orb("torso", [0, 1.322, .199], [.01, .016, .007], "glow"),
  ], ["Dây chữ V", "Mặt thoi", "Lõi đá nhỏ"]),
  "v7-jewel-tags": recipe("v7-jewel-tags", "accessory", [
    ...necklace(1.367),
    ring("torso", [0, 1.36, .19], [.012, .014, .014]),
    ...sides.map(side => box("torso", [side * .015, 1.321 - (side > 0 ? .014 : 0), .19], [.023, .055, .007], [0, side * .18, side * .13], "trim")),
  ], ["Dây vòng cổ", "Hai thẻ lệch cao độ", "Khoen nối mặt dây"]),
  "v7-jewel-crescent": recipe("v7-jewel-crescent", "accessory", [
    ring("torso", [0, 1.512, 0], [.093, .093, .028], [Math.PI / 2, 0, 0]),
    ...sides.flatMap(side => [
      bar("torso", [side * .075, 1.479, .115], [side * .045, 1.435, .17], .014),
      bar("torso", [side * .045, 1.435, .17], [0, 1.425, .182], .014),
    ]),
    ...[-.04, 0, .04].map(x => orb("torso", [x, 1.428 + Math.abs(x) * .22, .182], [.008, .009, .007], "glow")),
  ], ["Vòng cứng ôm cổ", "Yếm cung gãy", "Ba hạt gắn ngực"]),
  "v7-jewel-orbit": recipe("v7-jewel-orbit", "accessory", [
    ...necklace(1.383),
    ring("torso", [0, 1.341, .188], [.041, .041, .017]),
    ring("torso", [0, 1.341, .188], [.029, .029, .019], [0, .55, .45]),
    orb("torso", [0, 1.341, .19], [.011, .011, .01], "glow"),
  ], ["Mặt vòng quỹ đạo", "Vòng lồng nghiêng", "Hạt tâm độc lập"]),
  "v7-jewel-ladder": recipe("v7-jewel-ladder", "accessory", [
    ring("torso", [0, 1.514, 0], [.087, .087, .03], [Math.PI / 2, 0, 0]),
    ...sides.map(side => bar("torso", [side * .062, 1.486, .11], [side * .029, 1.313, .184], .006)),
    ...[0, 1, 2, 3].map(i => box("torso", [0, 1.398 - i * .026, .176 + i * .003], [.071 - i * .005, .006, .009], undefined, "trim")),
    orb("torso", [0, 1.296, .188], [.012, .018, .008], "glow"),
  ], ["Hai dây song hành", "Bốn bậc ngang", "Giọt đá cuối dây"]),
  "v7-jewel-brooch": recipe("v7-jewel-brooch", "accessory", [
    ring("torso", [-.119, 1.413, .158], [.031, .031, .018]),
    ...[-.6, 0, .6].map(angle => box("torso", [-.119, 1.413, .174], [.014, .072, .008], [0, 0, angle], "trim")),
    orb("torso", [-.119, 1.413, .184], [.012, .012, .008], "glow"),
    bar("torso", [-.104, 1.383, .16], [-.037, 1.35, .176], .005),
    bar("torso", [-.037, 1.35, .176], [.048, 1.399, .167], .005),
    orb("torso", [.048, 1.399, .167], [.008, .008, .006], "trim"),
  ], ["Trâm vai trái", "Nan huy hiệu xòe", "Dây võng trước ngực"]),
  "v7-jewel-drop": recipe("v7-jewel-drop", "accessory", sides.flatMap(side => [
    ring("head", [side * .132, -.037, -.004], [.014, .018, .009], [0, Math.PI / 2, 0]),
    bar("head", [side * .132, -.055, -.004], [side * .132, -.079, -.004], .004),
    orb("head", [side * .132, -.089, -.004], [.01, .016, .009], "glow"),
  ]), ["Khoen tai dọc", "Dây treo ngắn", "Giọt đá đôi"]),
  "v7-jewel-helix": recipe("v7-jewel-helix", "accessory", [
    ...[0, 1, 2].map(i => ring("head", [-.136, .019 - i * .017, -.008], [.01, .01, .008], [0, Math.PI / 2, .12])),
    bar("head", [-.143, .025, -.008], [-.143, -.024, -.008], .005),
    orb("head", [-.146, .025, -.008], [.007, .008, .007], "glow"),
  ], ["Ba khoen vành tai trái", "Thanh liên kết dọc", "Hạt chốt trên"]),
  "v7-jewel-tassel": recipe("v7-jewel-tassel", "accessory", sides.flatMap(side => [
    orb("head", [side * .134, -.031, -.005], [.009, .009, .008], "trim"),
    ...[-1, 0, 1].map(i => bar("head", [side * .134, -.039, -.005], [side * (.134 + i * .009), -.093 + Math.abs(i) * .012, -.005], .004)),
    ...[-1, 0, 1].map(i => orb("head", [side * (.134 + i * .009), -.094 + Math.abs(i) * .012, -.005], [.004, .007, .004], "glow")),
  ]), ["Chốt tai tròn", "Ba tua xòe", "Hạt cuối lệch độ dài"]),
  "v7-jewel-ear-bridge": recipe("v7-jewel-ear-bridge", "accessory", [
    ...[-.035, .023].map(y => ring("head", [.136, y, -.006], [.011, .011, .009], [0, Math.PI / 2, 0])),
    bar("head", [.143, .023, -.006], [.16, -.006, .006], .006),
    bar("head", [.16, -.006, .006], [.143, -.035, -.006], .006),
    box("head", [.164, -.006, .007], [.012, .02, .012], [0, 0, .25], "glow"),
  ], ["Cầu vành tai phải", "Hai chốt cách nhau", "Đỉnh kim cương lệch"]),
  "v7-jewel-satellite": recipe("v7-jewel-satellite", "accessory", sides.flatMap(side => [
    ring("head", [side * .137, -.025, -.006], [.019, .024, .012], [0, Math.PI / 2, 0]),
    ...[-1, 1].map(i => orb("head", [side * .141, -.025 + i * .025, -.006], [.009, .009, .009], i < 0 ? "glow" : "trim")),
    bar("head", [side * .137, -.025, -.025], [side * .157, -.025, -.032], .004),
    orb("head", [side * .161, -.025, -.032], [.007, .007, .007], "trim"),
  ]), ["Khoen bầu dục", "Hai vệ tinh dọc", "Nhánh hạt phía sau"]),
};

function cosmetic(id: string, slot: AccessorySlot, name: string, description: string, price: number, level: number, rarity: NonNullable<CosmeticDefinition["rarity"]>, color: string): CosmeticDefinition {
  return { id, model: id, slot, name, description, price, level, rarity, color, starter: false, collection: "Phố tương lai", assetId: `wearable.${id}` };
}
export const ACCESSORY_V7_COSMETICS: CosmeticDefinition[] = [
  cosmetic("v7-head-patrol", "headwear", "Mũ tuần hành", "Vòm sáu múi với lưỡi trai dài, khóa gáy và đường nổi trên đỉnh.", 140, 2, "uncommon", "#304358"),
  cosmetic("v7-head-bucket", "headwear", "Mũ vành tầng", "Mũ chóp cụt có vành hai tầng và lỗ thoáng hợp kim hai bên.", 170, 3, "uncommon", "#42565b"),
  cosmetic("v7-head-beret", "headwear", "Mũ nồi nghiêng", "Vòm nồi lệch bên với đai ôm đầu, cuống đỉnh và huy hiệu bạc.", 190, 4, "rare", "#493c60"),
  cosmetic("v7-head-knit", "headwear", "Mũ len gân nổi", "Mũ len chóp cao gắn quả bông nhỏ và gấu lật bảy đường gân.", 155, 3, "uncommon", "#394759"),
  cosmetic("v7-head-flight", "headwear", "Mũ phi hành", "Vòm bảo hộ sống dọc cùng hai chụp tai, để hở toàn bộ mặt.", 340, 7, "epic", "#344953"),
  cosmetic("v7-head-cylinder", "headwear", "Mũ trụ dạ hội", "Mũ trụ cao vành rộng, dải đai tối và nơ đôi ánh kim phía trước.", 280, 6, "rare", "#28354c"),
  cosmetic("v7-eye-round", "eyewear", "Kính vòng mảnh", "Hai gọng tròn rỗng nối bằng cầu mũi, càng kính móc sau tai.", 120, 2, "uncommon", "#7696a4"),
  cosmetic("v7-eye-rectangle", "eyewear", "Kính chữ nhật", "Gọng bốn cạnh sắc nét với khoảng mắt mở và càng thẳng gập cuối.", 135, 2, "uncommon", "#3c4e63"),
  cosmetic("v7-eye-hexagon", "eyewear", "Kính lục giác", "Gọng sáu cạnh ôm quanh mắt, cầu mũi thanh và đuôi càng ngắn.", 180, 4, "rare", "#819eae"),
  cosmetic("v7-eye-aviator", "eyewear", "Kính giọt lệ", "Khung giọt lệ đáy sâu cùng hai cầu ngang và càng gọng gấp gọn.", 205, 4, "rare", "#8b8279"),
  cosmetic("v7-eye-cat", "eyewear", "Kính đuôi xếch", "Đuôi gọng vút lên hai bên, điểm sáng nhỏ không chắn ánh mắt.", 225, 5, "rare", "#866e9b"),
  cosmetic("v7-eye-brow", "eyewear", "Kính gọng mày", "Nửa gọng trên dày nối càng, viền dưới mảnh giữ khoảng mắt mở.", 165, 3, "uncommon", "#576477"),
  cosmetic("v7-eye-shield", "eyewear", "Kính chắn bên", "Gọng ngũ giác có tấm chắn thái dương và khe sáng thông khí.", 295, 6, "epic", "#468b97"),
  cosmetic("v7-eye-asymmetric", "eyewear", "Kính bất đối xứng", "Gọng tròn bên trái, gọng vuông bên phải cùng cảm biến lệch cao.", 310, 7, "epic", "#777fa5"),
  cosmetic("v7-glove-fingerless", "gloves", "Găng hở ngón", "Găng ngắn ôm cổ tay với ba đệm khớp và dải sáng trên mu tay.", 155, 3, "uncommon", "#35495b"),
  cosmetic("v7-glove-gauntlet", "gloves", "Găng giáp phân đoạn", "Ống giáp cẳng tay ba lớp chồng với bốn ngón bọc độc lập.", 360, 8, "epic", "#4f6371"),
  cosmetic("v7-glove-laced", "gloves", "Nẹp tay dây chéo", "Nẹp cổ tay hai đai khóa, ba hàng dây đan chéo để hở bàn tay.", 210, 4, "rare", "#63536b"),
  cosmetic("v7-glove-console", "gloves", "Vòng tay điều khiển", "Màn nổi trên hai dây đeo, nút cạnh và phím tròn dưới cổ tay.", 325, 7, "epic", "#3c8290"),
  cosmetic("v7-glove-mitten", "gloves", "Găng ủ liền ngón", "Găng ủ bo tròn có ngón cái tách bên và đường gân ngang mu tay.", 175, 3, "uncommon", "#56627b"),
  cosmetic("v7-back-sling", "back", "Túi chéo đường phố", "Túi lệch chéo lưng với dây đeo đơn qua ngực và ngăn khóa nhỏ.", 230, 4, "rare", "#374b5a"),
  cosmetic("v7-back-hardpack", "back", "Ba lô vỏ đôi", "Ba lô cứng hai nửa, sống sáng ba khe cùng quai xách đỉnh.", 390, 8, "epic", "#39556a"),
  cosmetic("v7-back-canisters", "back", "Bộ bình đôi", "Hai bình dọc gắn trên tấm lưng, đai tròn giữ chắc từng đầu.", 440, 9, "epic", "#536577"),
  cosmetic("v7-back-folded-fan", "back", "Khung cánh gập", "Khung quạt nan xiên với hai bản cánh và khớp bản lề thấp.", 580, 12, "legendary", "#6976a2"),
  cosmetic("v7-back-roll", "back", "Túi cuộn hành trình", "Túi đáy vuông kèm cuộn ngang trên nắp và hai dây khóa dọc.", 305, 6, "rare", "#566460"),
  cosmetic("v7-jewel-prism", "jewelry", "Dây chuyền lăng kính", "Dây chữ V nâng mặt thoi ánh kim và viên đá nhỏ trước ngực.", 180, 3, "rare", "#79a6b5"),
  cosmetic("v7-jewel-tags", "jewelry", "Dây thẻ đôi", "Hai thẻ kim loại lệch độ cao treo trên khoen nối vòng cổ.", 165, 3, "uncommon", "#97a6b3"),
  cosmetic("v7-jewel-crescent", "jewelry", "Kiềng cung trăng", "Kiềng cứng nối yếm cung gãy cùng ba hạt sáng sát xương quai xanh.", 275, 6, "rare", "#a5a2b4"),
  cosmetic("v7-jewel-orbit", "jewelry", "Dây vòng quỹ đạo", "Hai vòng lồng nghiêng bao quanh hạt tâm nhỏ trên mặt dây ngực.", 350, 8, "epic", "#899bc4"),
  cosmetic("v7-jewel-ladder", "jewelry", "Dây bậc thang", "Hai dây song hành đỡ bốn bậc ngang và giọt đá ở cuối dây.", 285, 6, "rare", "#8fadb2"),
  cosmetic("v7-jewel-brooch", "jewelry", "Trâm vai sao", "Trâm nan xòe đặt trên vai trái, dây võng nối chốt trước ngực.", 320, 7, "epic", "#9e96b4"),
  cosmetic("v7-jewel-drop", "jewelry", "Khuyên giọt đôi", "Cặp khoen tai dọc treo dây ngắn và giọt đá thon bên dưới.", 145, 2, "uncommon", "#8db3bd"),
  cosmetic("v7-jewel-helix", "jewelry", "Khuyên xoắn ba tầng", "Ba khoen nhỏ dọc vành tai trái liên kết bằng thanh chốt sáng.", 195, 4, "rare", "#a6afba"),
  cosmetic("v7-jewel-tassel", "jewelry", "Khuyên tua sao", "Chốt tai tròn tỏa ba tua dài ngắn với hạt sáng ở mỗi đầu.", 245, 5, "rare", "#a391ba"),
  cosmetic("v7-jewel-ear-bridge", "jewelry", "Khuyên cầu vành tai", "Hai chốt tai phải nối cầu nhọn, gắn viên đá nhỏ ở đỉnh ngoài.", 260, 6, "rare", "#84acb3"),
  cosmetic("v7-jewel-satellite", "jewelry", "Khuyên vệ tinh", "Khoen bầu dục kẹp hai hạt dọc và một nhánh hạt phía sau tai.", 335, 7, "epic", "#969fc2"),
];