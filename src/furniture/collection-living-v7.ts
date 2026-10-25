import type { FurnitureDefinition, FurnitureInteraction, FurnitureMaterial, FurniturePart } from "./catalog";

type LivingCategory = "bed" | "seating" | "desk" | "chair";
const actions: Record<LivingCategory, readonly FurnitureInteraction[]> = {
  bed: [{ id: "sleep", label: "Ngủ phục hồi", screen: "recovery", activity: "sleeping" }],
  seating: [{ id: "sit", label: "Ngồi thư giãn", screen: "recovery", activity: "sitting" }],
  desk: [{ id: "work", label: "Bắt đầu tập trung", screen: "focus", activity: "working" }],
  chair: [{ id: "sit", label: "Ngồi nghỉ", screen: "recovery", activity: "sitting" }],
};
function item(id: string, name: string, category: LivingCategory, width: number, depth: number, height: number, price: number, level: number, color: string, description: string): FurnitureDefinition {
  return Object.freeze({ id, name, category, width, depth, height, price, level, color, description, neonColor: "#00f0ff", interactions: Object.freeze(actions[category].map(action => Object.freeze({ ...action }))) });
}
export const LIVING_V7_CATALOG: readonly FurnitureDefinition[] = Object.freeze([
  item("v7-sleigh-bed", "Giường thuyền gỗ ấm", "bed", 2.5, 3.2, 1.5, 360, 3, "#b88b76", "Đầu và chân giường cuộn tròn, hai ván cong ôm nệm cùng dải sáng chân đế."),
  item("v7-capsule-bed", "Giường kén đêm", "bed", 2.3, 3.1, 2.1, 580, 5, "#8ba5aa", "Khoang ngủ có mái vòm, vách che nửa thân và bảng điều khiển cạnh gối."),
  item("v7-study-loft-bed", "Giường gác học tập", "bed", 2.2, 3, 2.7, 490, 4, "#baaa8c", "Giường đơn trên cao, bàn học phía dưới, thang bậc rộng và lan can nan."),
  item("v7-trundle-bed", "Giường đôi kéo lệch", "bed", 2.8, 3, 1.25, 330, 3, "#9eaaa4", "Nệm chính và giường phụ kéo lệch trên bánh xe, đầu giường có tay nắm âm."),
  item("v7-nest-bed", "Giường tổ tròn", "bed", 3, 3, 1.3, 610, 5, "#b795a3", "Bệ ngủ tròn với nệm mềm hình đĩa, các múi tựa đầu và gối ôm bầu dục."),
  item("v7-library-bed", "Giường thư viện", "bed", 2.9, 3.2, 1.9, 430, 4, "#b39b7f", "Đầu giường tích hợp hốc sách, hai bàn nhỏ và đèn đọc sách ấm."),
  item("v7-papasan-seat", "Ghế tổ mây", "seating", 1.4, 1.4, 1.2, 145, 2, "#c3a286", "Đệm lòng chảo trên vành mây đan, chân đế vòng và tựa lưng tròn."),
  item("v7-beanbag-seat", "Ghế túi hạt", "seating", 1.3, 1.4, .9, 85, 1, "#ba8f83", "Túi vải mềm nhiều múi, hõm ngồi thấp và quai xách phía sau."),
  item("v7-rocker-lounge", "Ghế bập bênh đọc sách", "seating", 1.3, 1.8, 1.4, 195, 2, "#ad927c", "Ghế đệm dài đặt trên hai thanh trượt cong, có tay vịn và gối cổ."),
  item("v7-conversation-seat", "Ghế đối thoại", "seating", 2.5, 1.5, 1.2, 285, 3, "#8b9f9b", "Hai chỗ ngồi quay lưng ngược chiều, ngăn giữa bằng tựa kép và khay trà nhỏ."),
  item("v7-courtyard-sofa", "Sofa sân trong", "seating", 3.4, 2.6, 1.2, 540, 5, "#ad998a", "Sofa chữ U với hai nhánh đệm dài, khoảng trống trung tâm và bệ gỗ liền."),
  item("v7-woven-daybed", "Trường kỷ nan gỗ", "seating", 2.6, 1.2, 1.3, 240, 2, "#b3a185", "Trường kỷ có lưng nan thoáng, hai gối trụ và nệm dài viền sáng."),
  item("v7-cinema-recliner", "Ghế ngả phòng chiếu", "seating", 1.3, 1.9, 1.4, 290, 3, "#8a929d", "Ghế ngả lưng cao với đệm chân nối dài, tay vịn hộp và hốc cốc."),
  item("v7-storage-bench", "Băng ghế hộc kéo", "seating", 2.1, .85, .95, 155, 2, "#b7a18e", "Băng ghế đệm thấp, ba mặt hộc kéo phía trước và hai tay xách gỗ."),
  item("v7-island-settee", "Ghế đảo bốn hướng", "seating", 2.6, 2.6, 1.4, 470, 4, "#9f9baf", "Bốn đệm ngồi quanh trụ tựa vuông, bệ bát giác và khay sách ở đỉnh."),
  item("v7-secretary-desk", "Bàn thư ký mở cánh", "desk", 1.5, 1.1, 1.8, 270, 3, "#b08e68", "Tủ bàn đứng với mặt viết mở ra, ngăn thư chia ô và hai thanh đỡ mặt bàn."),
  item("v7-corner-desk", "Bàn góc hai cánh", "desk", 2.5, 2.2, 1.15, 260, 3, "#9caca4", "Mặt bàn chữ L trên ba trụ, khay tài liệu bên hông và đế sạc nhỏ."),
  item("v7-ladder-desk", "Bàn thang kệ sách", "desk", 1.5, 1, 2.1, 230, 2, "#bd9d78", "Hai khung thang nghiêng đỡ mặt bàn sâu và hai tầng kệ nông."),
  item("v7-easel-desk", "Bàn họa sĩ nghiêng", "desk", 1.8, 1.2, 1.55, 275, 3, "#b69a7c", "Bảng vẽ dốc có gờ giữ giấy, giá chữ A và khay màu tròn bên cạnh."),
  item("v7-library-desk", "Bàn thư viện hai tủ", "desk", 2.4, 1.1, 1.35, 340, 3, "#997e65", "Mặt bàn rộng trên hai tủ khác nhau, đèn đọc sách ngang và sách mở."),
  item("v7-music-desk", "Bàn phối âm", "desk", 2.5, 1.25, 1.5, 480, 4, "#8d9ea5", "Bàn studio chân chữ C, kệ loa nâng cao và bàn phím nhạc dưới màn hiển thị."),
  item("v7-cantilever-chair", "Ghế chân quỳ liền", "chair", .8, .9, 1.2, 95, 2, "#ad9988", "Khung thép uốn chữ C đỡ đệm ngồi và tựa mềm, không có chân sau."),
  item("v7-folding-chair", "Ghế xếp dã ngoại", "chair", .75, .85, 1.1, 65, 1, "#b7a57d", "Hai bộ chân chéo có chốt bản lề, mặt vải căng và tựa lưng hẹp."),
  item("v7-kneeling-chair", "Ghế quỳ tập trung", "chair", .8, 1.1, .9, 120, 2, "#a7a093", "Đệm ngồi nâng cao và đệm đỡ đầu gối thấp nối trên thanh xương dốc."),
  item("v7-tripod-shell-chair", "Ghế vỏ sò ba chân", "chair", .9, .85, 1.25, 130, 2, "#b99b92", "Vỏ tựa mở như cánh sò, ba chân xòe bằng gỗ và đệm ngồi tròn."),
  item("v7-wingback-chair", "Ghế tựa cánh êm", "chair", 1, 1, 1.55, 185, 3, "#9a9bad", "Tựa cao có hai cánh ôm vai, đệm rời và chân gỗ nối giằng đồng."),
]);

const b = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "wood"): FurniturePart => ({ id, shape: "box", position: [x, y, z], size: [w, h, d], material });
const s = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "cushion"): FurniturePart => ({ ...b(id, x, y, z, w, h, d, material), roundness: .32 });
const r = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "wood", shape: FurniturePart["shape"] = "cylinder"): FurniturePart => ({ ...b(id, x, y, z, w, h, d, material), shape, radialSegments: 16 });
const feet = (y: number, h: number, x: number, z: number): FurniturePart[] => [-1, 1].flatMap(a => [-1, 1].map(c => b(`foot-${a}-${c}`, a * x, y, c * z, .07, h, .07)));
const bedding = (y: number, x = 0, w = .84, d = .78): FurniturePart[] => [
  s("mattress", x, y, 0, w, .12, d), s("duvet", x, y + .075, .1, w - .04, .05, d * .57, "fabric"),
  s("pillow-left", x - w * .24, y + .1, -d * .32, w * .4, .08, d * .23, "paper"),
  s("pillow-right", x + w * .24, y + .1, -d * .32, w * .4, .08, d * .23, "paper"),
];

export const LIVING_V7_RECIPES: Record<string, () => readonly FurniturePart[]> = {
  "v7-sleigh-bed": () => [
    ...feet(.07, .14, .36, .34), b("deck", 0, .23, 0, .9, .2, .84), ...bedding(.39),
    ...[-1, 1].flatMap(a => [
      { ...s(`curved-end-${a}`, 0, .55, a * .41, .94, .58, .09, "wood"), lean: [0, a * .07] as const },
      r(`rolled-end-${a}`, 0, .86, a * .44, .96, .16, .12, "wood", "sphere"),
      b(`side-rail-${a}`, a * .44, .29, 0, .05, .17, .82),
      b(`night-strip-${a}`, a * .45, .17, 0, .012, .02, .7, "glow"),
    ]),
  ],
  "v7-capsule-bed": () => [
    b("plinth", 0, .1, 0, .86, .2, .9, "dark"), s("deck", 0, .24, 0, .94, .12, .96, "wood"), ...bedding(.36, 0, .8, .8),
    ...[-1, 1].flatMap(a => [b(`pod-wall-${a}`, a * .45, .57, -.23, .07, .66, .5, "finish"), s(`roof-edge-${a}`, a * .4, .9, -.23, .17, .16, .5, "finish"), b(`reading-strip-${a}`, a * .412, .75, -.2, .012, .025, .35, "glow")]),
    s("roof", 0, .96, -.23, .72, .08, .5, "finish"), r("arched-head", 0, .58, -.46, .84, .72, .06, "fabric", "arch"),
    b("control", .409, .53, -.16, .025, .1, .14, "screen"),
  ],
  "v7-study-loft-bed": () => [
    ...feet(.5, 1, .43, .43), b("upper-deck", 0, .7, 0, .92, .06, .92), ...bedding(.79, 0, .78, .78),
    b("study-top", 0, .33, -.24, .85, .04, .38), b("study-back", 0, .2, -.43, .82, .28, .04),
    b("book-stack", -.25, .38, -.27, .2, .06, .22, "paper"),
    ...[-1, 1].flatMap(a => [b(`guard-rail-${a}`, a * .43, .97, 0, .035, .04, .87), ...[-.25, 0, .25].map(z => b(`guard-upright-${a}-${z}`, a * .43, .84, z, .025, .24, .025))]),
    ...[-.28, -.02].map(x => b(`ladder-${x}`, x, .36, .46, .035, .72, .04, "metal")),
    ...[.12, .26, .4, .54, .68].map(y => b(`step-${y}`, -.15, y, .46, .29, .025, .06)),
  ],
  "v7-trundle-bed": () => [
    b("main-plinth", -.14, .215, 0, .66, .43, .92), ...bedding(.49, -.14, .64, .8),
    b("headboard", -.14, .64, -.46, .7, .7, .06), b("head-inlay", -.14, .87, -.423, .46, .04, .014, "glow"),
    ...[-1, 1].flatMap(a => [r(`wheel-${a}`, .31, .045, a * .33, .08, .09, .09, "dark"), b(`runner-${a}`, .15, .12, a * .33, .65, .06, .045, "metal")]),
    b("pullout-deck", .25, .19, .02, .48, .09, .88), s("pullout-mattress", .27, .29, .02, .43, .12, .83),
    s("pullout-pillow", .27, .39, -.27, .34, .08, .19, "paper"), b("pullout-handle", .486, .2, .03, .02, .045, .28, "metal"),
  ],
  "v7-nest-bed": () => [
    r("round-plinth", 0, .1, 0, .78, .2, .78, "dark"), r("rim", 0, .24, 0, 1, .16, 1, "wood"),
    r("round-mattress", 0, .37, 0, .93, .2, .93, "cushion", "sphere"), r("quilt", 0, .45, .08, .78, .12, .67, "fabric", "sphere"),
    s("center-head", 0, .71, -.38, .4, .48, .15, "fabric"),
    ...[-1, 1].flatMap(a => [s(`head-petal-${a}`, a * .29, .64, -.29, .24, .42, .2, "fabric"), b(`head-support-${a}`, a * .29, .42, -.29, .06, .3, .06), r(`pillow-${a}`, a * .17, .54, -.16, .28, .14, .22, "paper", "sphere")]),
    r("rim-light", 0, .155, 0, .99, .02, .99, "glow", "ring"),
  ],
  "v7-library-bed": () => [
    b("base", 0, .14, .02, .82, .28, .87), ...bedding(.34, 0, .76, .76),
    b("bookcase-back", 0, .62, -.46, .98, .76, .06),
    ...[.49, .76, .98].map(y => b(`head-shelf-${y}`, 0, y, -.37, .98, .035, .25)),
    ...[-.47, -.16, .16, .47].map(x => b(`head-divider-${x}`, x, .74, -.37, .025, .49, .25)),
    ...[-1, 1].flatMap(a => [b(`side-table-${a}`, a * .4475, .3, -.08, .095, .6, .27), b(`book-${a}`, a * .3, .62, -.35, .07, .23, .16, "paper"), b(`reading-light-${a}`, a * .29, .78, -.25, .12, .015, .02, "glow")]),
  ],
  "v7-papasan-seat": () => [
    r("base-ring", 0, .07, 0, .68, .14, .68, "wood", "ring"), r("pedestal", 0, .23, 0, .3, .26, .3), b("base-cross-x", 0, .08, 0, .65, .08, .06), b("base-cross-z", 0, .08, 0, .06, .08, .65),
    r("bowl-rim", 0, .39, 0, .94, .12, .94, "wood", "ring"), r("bowl-seat", 0, .42, 0, .85, .24, .85, "cushion", "sphere"),
    r("round-back", 0, .7, -.28, .8, .58, .3, "fabric", "sphere"),
    ...[-1, 1].map(a => ({ ...b(`bowl-rib-${a}`, a * .2, .3, 0, .045, .24, .55), lean: [a * .28, 0] as const })),
    s("lumbar", 0, .6, -.11, .43, .16, .2),
  ],
  "v7-beanbag-seat": () => [
    r("fabric-base", 0, .12, .04, .9, .24, .85, "fabric", "sphere"),
    r("bean-seat", 0, .27, .13, .86, .32, .72, "cushion", "sphere"), r("bean-back", 0, .54, -.22, .8, .8, .5, "fabric", "sphere"),
    ...[-1, 1].map(a => r(`side-lobe-${a}`, a * .31, .35, .02, .35, .47, .71, "fabric", "sphere")),
    s("top-grip", 0, .95, -.23, .21, .07, .065, "wood"), { ...r("front-seam", 0, .16, .04, .86, .018, .812, "paper", "ring"), radialSegments: 12 },
  ],
  "v7-rocker-lounge": () => [
    ...[-1, 1].flatMap(a => [s(`runner-center-${a}`, a * .37, .035, 0, .09, .07, .44, "wood"),
      ...[-1, 1].map(end => ({ ...s(`runner-tip-${a}-${end}`, a * .37, .075, end * .34, .09, .07, .3, "wood"), rotation: [-end * .18, 0, 0] as const })),
      b(`front-post-${a}`, a * .37, .34, .24, .06, .56, .07), b(`rear-post-${a}`, a * .37, .35, -.27, .06, .56, .07),
      s(`arm-${a}`, a * .39, .65, -.02, .13, .07, .68, "wood")]),
    b("seat-deck", 0, .43, .03, .78, .07, .7), s("seat", 0, .52, .06, .66, .13, .68),
    { ...s("back", 0, .76, -.3, .76, .46, .11, "fabric"), lean: [0, -.11] as const },
    s("neck-pillow", 0, .92, -.27, .53, .11, .16), b("front-brace", 0, .23, .24, .75, .04, .04, "gold"),
  ],
  "v7-conversation-seat": () => [
    b("shared-plinth", 0, .16, 0, .94, .32, .88),
    s("seat-forward", -.24, .4, .19, .43, .18, .53), s("seat-backward", .24, .4, -.19, .43, .18, .53),
    s("back-forward", -.24, .7, -.13, .44, .6, .14, "fabric"), s("back-backward", .24, .7, .13, .44, .6, .14, "fabric"),
    b("middle-spine", 0, .49, 0, .04, .72, .34), b("tea-tray", 0, .86, 0, .17, .035, .3),
    ...[-1, 1].map(a => s(`outer-arm-${a}`, a * .45, .51, 0, .09, .33, .87, "fabric")),
  ],
  "v7-courtyard-sofa": () => [
    b("rear-plinth", 0, .16, -.29, 1, .32, .4),
    ...[-1, 1].flatMap(a => [b(`wing-plinth-${a}`, a * .34, .16, .13, .32, .32, .7), s(`wing-pad-${a}`, a * .33, .43, .175, .29, .22, .6), s(`outer-back-${a}`, a * .46, .68, .07, .08, .63, .82, "fabric")]),
    s("rear-back", 0, .7, -.45, 1, .6, .1, "fabric"),
    ...[-.3, 0, .3].map(x => s(`rear-pad-${x}`, x, .43, -.27, .28, .22, .28)),
    b("rear-light", 0, .12, -.49, .86, .025, .012, "glow"),
  ],
  "v7-woven-daybed": () => [
    ...feet(.14, .28, .42, .35), b("seat-frame", 0, .33, 0, .98, .1, .88), s("long-seat", 0, .45, .04, .86, .14, .75),
    ...[-1, 1].flatMap(a => [b(`end-post-${a}`, a * .46, .62, -.39, .06, .75, .07), b(`end-arm-${a}`, a * .46, .65, -.01, .06, .05, .8), r(`bolster-${a}`, a * .35, .59, .02, .14, .2, .65, "fabric", "sphere")]),
    b("crest", 0, .94, -.39, .94, .07, .06), b("lower-back", 0, .53, -.39, .9, .05, .06),
    ...[-.32, -.16, 0, .16, .32].map(x => b(`woven-slat-${x}`, x, .72, -.39, .045, .42, .04)),
    b("seat-piping", 0, .46, .414, .8, .012, .012, "paper"),
  ],
  "v7-cinema-recliner": () => [
    b("recliner-base", 0, .18, -.09, .65, .36, .62, "dark"), s("seat", 0, .43, -.02, .64, .22, .61),
    { ...s("reclined-back", 0, .71, -.32, .68, .56, .18, "fabric"), lean: [0, -.12] as const },
    s("headrest", 0, .91, -.31, .48, .12, .18), b("foot-link", 0, .27, .26, .48, .06, .4, "metal"), s("footrest", 0, .35, .36, .65, .18, .28),
    ...[-1, 1].flatMap(a => [s(`arm-box-${a}`, a * .4, .41, -.03, .18, .54, .75, "fabric"), r(`cup-holder-${a}`, a * .4, .686, .17, .11, .015, .11, "dark", "ring")]),
  ],
  "v7-storage-bench": () => [
    b("toe-kick", 0, .07, 0, .83, .14, .75, "dark"), b("cabinet", 0, .4, 0, .96, .6, .86), s("bench-cushion", 0, .79, 0, .84, .18, .84),
    ...[-.3, 0, .3].flatMap(x => [b(`drawer-${x}`, x, .4, .44, .28, .43, .04), b(`pull-${x}`, x, .5, .472, .14, .025, .025, "metal")]),
    ...[-1, 1].flatMap(a => [b(`handle-post-${a}`, a * .46, .82, -.29, .06, .3, .06), b(`handle-front-${a}`, a * .46, .82, .29, .06, .3, .06), s(`handle-bar-${a}`, a * .46, .97, 0, .06, .06, .64, "wood")]),
  ],
  "v7-island-settee": () => [
    { ...r("octagonal-base", 0, .14, 0, .99, .28, .99), radialSegments: 8 }, b("central-back", 0, .56, 0, .35, .83, .35, "fabric"),
    ...[-1, 1].flatMap(a => [s(`seat-x-${a}`, a * .3, .35, 0, .27, .18, .32), s(`seat-z-${a}`, 0, .35, a * .3, .32, .18, .27), s(`back-x-${a}`, a * .2, .66, 0, .09, .43, .36), s(`back-z-${a}`, 0, .66, a * .2, .36, .43, .09)]),
    b("top-tray", 0, .98, 0, .42, .04, .42),
  ],
  "v7-secretary-desk": () => [
    ...feet(.09, .18, .38, .12), b("lower-case", 0, .28, -.13, .85, .4, .58), b("upper-back", 0, .74, -.43, .9, .52, .06),
    ...[-1, 1].map(a => b(`upper-side-${a}`, a * .43, .74, -.26, .04, .52, .39)),
    b("crown", 0, .98, -.26, .9, .04, .4), b("writing-flap", 0, .51, .08, .9, .06, .8),
    ...[-1, 1].map(a => ({ ...b(`flap-brace-${a}`, a * .34, .36, .15, .04, .26, .04, "metal"), lean: [0, .42] as const })),
    b("mail-shelf", 0, .76, -.26, .84, .03, .34), ...[-.25, 0, .25].map(x => b(`mail-divider-${x}`, x, .86, -.26, .02, .2, .34)),
    b("lower-door", 0, .29, .168, .78, .3, .025), b("door-pull", .25, .3, .192, .05, .035, .025, "gold"),
  ],
  "v7-corner-desk": () => [
    b("long-top", 0, .8, -.25, 1, .07, .5), b("return-top", .3, .8, .24, .4, .07, .48),
    ...[[-.4, -.25], [.39, -.25], [.3, .4]].map(([x, z], i) => b(`pier-${i}`, x, .39, z, .13, .78, .16, "metal")),
    b("rear-apron", 0, .69, -.45, .87, .18, .04), b("return-apron", .46, .69, .16, .04, .18, .56),
    b("paper-tray", .29, .855, .29, .29, .04, .29, "dark"), b("paper", .29, .885, .29, .25, .02, .25, "paper"),
    r("charging-pad", -.2, .845, -.2, .24, .02, .24, "glow"), b("cable-grommet", .35, .845, -.35, .07, .02, .07, "dark"),
  ],
  "v7-ladder-desk": () => [
    ...[-1, 1].flatMap(a => [{ ...b(`ladder-front-${a}`, a * .42, .5, .08, .065, 1, .065), lean: [0, -.4] as const }, b(`ladder-back-${a}`, a * .42, .5, -.35, .065, 1, .065)]),
    b("desktop", 0, .44, .03, .96, .055, .85), b("middle-shelf", 0, .71, -.14, .92, .04, .48), b("top-shelf", 0, .94, -.26, .92, .04, .27),
    b("lower-brace", 0, .14, -.35, .85, .06, .05), b("book", -.22, .81, -.19, .1, .16, .21, "paper"),
    b("bookend", -.3, .81, -.19, .04, .16, .23, "metal"), s("desk-mat", .02, .476, .12, .54, .018, .36, "fabric"),
  ],
  "v7-easel-desk": () => [
    ...[-1, 1].flatMap(a => [
      { ...b(`front-trestle-${a}`, a * .3, .33, .16, .07, .66, .07), lean: [0, -.32] as const },
      { ...b(`back-trestle-${a}`, a * .3, .33, -.16, .07, .66, .07), lean: [0, .32] as const },
      b(`top-bracket-${a}`, a * .3, .65, 0, .1, .05, .6),
    ]),
    b("cross-brace", 0, .28, 0, .67, .06, .44),
    { ...b("tilted-board", -.04, .77, -.03, .78, .06, .75), rotation: [.27, 0, 0] as const },
    { ...b("drawing-paper", -.04, .806, -.03, .61, .012, .58, "paper"), rotation: [.27, 0, 0] as const },
    b("pencil-ledge", -.04, .7, .32, .75, .065, .04), b("palette-arm", .34, .67, .03, .25, .04, .08, "metal"),
    r("palette", .37, .7, .06, .24, .025, .3),
  ],
  "v7-library-desk": () => [
    b("drawer-pedestal", -.34, .35, 0, .26, .7, .83),
    ...[-1, 1].map(a => b(`bookcase-side-${a}`, .34 + a * .12, .35, 0, .025, .7, .83)),
    b("bookcase-back", .34, .35, -.4, .26, .7, .03),
    ...[.025, .37].map(y => b(`book-shelf-${y}`, .34, y, 0, .26, .05, .83)),
    b("desk-top", 0, .74, 0, 1, .08, .96),
    ...[.16, .36, .56].flatMap(y => [b(`drawer-${y}`, -.34, y, .425, .22, .16, .025), b(`knob-${y}`, -.34, y, .45, .055, .025, .025, "gold")]),
    ...[-1, 1].map(a => b(`book-${a}`, .34 + a * .05, .15, .12, .055, .2, .4, "paper")),
    b("lamp-base", 0, .7975, -.29, .22, .035, .17, "metal"), b("lamp-stem", 0, .89, -.29, .035, .18, .04, "metal"), s("lamp-shade", 0, .97, -.25, .4, .06, .2, "finish"),
    b("lamp-light", 0, .938, -.21, .3, .014, .12, "glow"), b("open-book-cover", -.03, .79, .16, .37, .02, .36, "fabric"),
    ...[-1, 1].map(a => ({ ...b(`open-page-${a}`, -.03 + a * .086, .806, .16, .17, .018, .33, "paper"), rotation: [0, 0, -a * .07] as const })),
    b("book-fold", -.03, .807, .16, .012, .026, .33, "wood"),
  ],
  "v7-music-desk": () => [
    ...[-1, 1].flatMap(a => [b(`floor-rail-${a}`, a * .36, .03, 0, .14, .06, .84, "metal"), b(`upright-${a}`, a * .36, .31, -.3, .07, .56, .08, "metal"), b(`top-arm-${a}`, a * .36, .57, 0, .09, .05, .84, "metal")]),
    s("console-top", 0, .61, 0, .98, .06, .92, "wood"), b("rack-back", 0, .75, -.38, .93, .24, .06), b("speaker-shelf", 0, .87, -.28, .96, .04, .29),
    ...[-1, 1].flatMap(a => [b(`speaker-${a}`, a * .35, .945, -.28, .15, .11, .21, "dark"), r(`driver-${a}`, a * .35, .945, -.17, .085, .075, .025, "metal", "sphere")]),
    b("music-display", 0, .76, -.34, .4, .15, .025, "screen"), b("keybed", 0, .665, .17, .76, .05, .31, "dark"),
    ...Array.from({ length: 10 }, (_, i) => b(`ivory-key-${i}`, -.333 + i * .074, .696, .18, .068, .012, .26, "paper")),
    ...[0, 1, 3, 4, 5, 7, 8].map(i => b(`black-key-${i}`, -.297 + i * .074, .71, .115, .025, .022, .13, "dark")),
  ],
  "v7-cantilever-chair": () => [
    ...[-1, 1].flatMap(a => [s(`floor-skid-${a}`, a * .36, .035, 0, .065, .07, .85, "metal"), b(`front-rise-${a}`, a * .36, .26, .34, .065, .46, .065, "metal"), b(`seat-rail-${a}`, a * .36, .47, -.01, .065, .065, .76, "metal"), b(`back-rise-${a}`, a * .36, .71, -.36, .06, .5, .06, "metal")]),
    s("seat", 0, .53, 0, .85, .12, .82), s("back", 0, .79, -.35, .83, .38, .13), b("floor-brace", 0, .035, -.39, .75, .05, .045, "metal"),
  ],
  "v7-folding-chair": () => [
    ...[-1, 1].flatMap(a => [
      { ...b(`forward-leg-${a}`, a * .36, .26, 0, .06, .52, .06), lean: [0, -.74] as const },
      { ...b(`backward-leg-${a}`, a * .36, .26, 0, .06, .52, .06), lean: [0, .74] as const },
      r(`hinge-${a}`, a * .395, .26, 0, .04, .09, .09, "metal", "sphere"),
      b(`back-upright-${a}`, a * .36, .73, -.36, .06, .5, .06),
    ]),
    s("canvas-seat", 0, .55, 0, .83, .065, .82, "fabric"), s("canvas-back", 0, .88, -.36, .78, .22, .065, "fabric"), b("rear-brace", 0, .15, -.19, .76, .04, .04),
  ],
  "v7-kneeling-chair": () => [
    ...[-1, 1].map(a => b(`skid-${a}`, a * .3, .04, 0, .09, .08, .92)),
    { ...b("sloping-spine", 0, .4, -.03, .14, .72, .12), lean: [0, -.48] as const },
    b("knee-post", 0, .24, .28, .16, .4, .1), b("knee-crossbar", 0, .41, .28, .8, .06, .09), b("front-floor-crossbar", 0, .06, .25, .67, .06, .2),
    s("knee-left", -.23, .48, .28, .38, .15, .32), s("knee-right", .23, .48, .28, .38, .15, .32),
    b("seat-support", 0, .77, -.27, .65, .05, .23), s("seat", 0, .88, -.24, .85, .18, .47), b("floor-crossbar", 0, .06, -.28, .67, .04, .07),
  ],
  "v7-tripod-shell-chair": () => [
    ...[-1, 1].map(a => ({ ...b(`front-leg-${a}`, a * .26, .23, .24, .07, .46, .07), lean: [-a * .18, -.16] as const })),
    { ...b("rear-leg", 0, .23, -.25, .08, .46, .08), lean: [0, .18] as const },
    r("seat-shell", 0, .47, 0, .88, .13, .85), r("seat-pad", 0, .55, .025, .8, .15, .73, "cushion", "sphere"),
    r("shell-back", 0, .76, -.31, .86, .46, .2, "wood", "sphere"),
    ...[-1, 1].map(a => r(`shell-wing-${a}`, a * .34, .66, -.14, .22, .35, .32, "wood", "sphere")),
    s("lumbar", 0, .73, -.19, .55, .24, .1),
  ],
  "v7-wingback-chair": () => [
    ...feet(.16, .32, .34, .31), b("under-seat", 0, .35, 0, .8, .09, .76), s("seat", 0, .45, .04, .73, .15, .75), s("tall-back", 0, .73, -.34, .77, .53, .15, "fabric"),
    ...[-1, 1].flatMap(a => [s(`shoulder-wing-${a}`, a * .37, .8, -.19, .16, .39, .37, "fabric"), b(`arm-post-${a}`, a * .405, .47, .24, .06, .25, .06), s(`arm-pad-${a}`, a * .37, .61, .08, .16, .08, .6, "fabric"), b(`side-brace-${a}`, a * .34, .16, 0, .035, .035, .65, "gold")]),
    s("lumbar", 0, .62, -.19, .52, .16, .17), b("front-stretcher", 0, .16, .31, .7, .035, .035, "gold"),
  ],
};
Object.freeze(LIVING_V7_RECIPES);
