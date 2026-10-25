import type { FurnitureDefinition, FurnitureInteraction, FurnitureMaterial, FurniturePart, FurnitureVector } from "./catalog";

const kitchenAction = Object.freeze([{ id: "cook", label: "Chuẩn bị bữa ăn", screen: "recovery", activity: "working" }] as const);
const decorAction = Object.freeze([{ id: "inspect", label: "Ngắm góc nhà", screen: "recovery" }] as const);
const storageAction = Object.freeze([{ id: "store", label: "Xem đồ dùng", screen: "inventory" }] as const);
const define = (id: string, name: string, category: "kitchen" | "decor", width: number, depth: number, height: number, price: number, level: number, color: string, description: string, interactions: readonly FurnitureInteraction[] = category === "kitchen" ? kitchenAction : decorAction): FurnitureDefinition => Object.freeze({ id, name, category, width, depth, height, price, level, color, description, neonColor: "#00f0ff", ...(id === "v7-dining-table" ? { slots: [{ hash: "table-left", x: -0.27, y: height, z: 0 }, { hash: "table-right", x: 0.27, y: height, z: 0 }] } : {}), interactions: Object.freeze(interactions.map(action => Object.freeze({ ...action }))) });

export const HOME_V7_CATALOG: readonly FurnitureDefinition[] = Object.freeze([
  define("v7-espresso-machine", "Máy pha cà phê quầy nhỏ", "kitchen", .72, .62, .78, 210, 3, "#829d9c", "Máy pha có đầu chiết, tay cầm lọc, vòi sữa và tách trên khay hứng."),
  define("v7-stand-mixer", "Máy trộn bột để bàn", "kitchen", .68, .58, .72, 165, 2, "#c5a087", "Đầu trộn vươn ngang trên tô rỗng, que đánh và chân đế bo tròn."),
  define("v7-tea-tray", "Khay trà ấm quai tre", "kitchen", .88, .6, .48, 70, 1, "#b6a38b", "Ấm trà bụng tròn có vòi nghiêng, quai vòng và hai chén trên khay gỗ."),
  define("v7-dish-rack", "Giá úp bát ráo nước", "kitchen", .9, .55, .52, 65, 1, "#a7b8b4", "Giá nan mở chứa đĩa đứng, khay hứng và ống cắm đũa."),
  define("v7-dining-table", "Bàn ăn đôi chân chéo", "kitchen", 1.9, 1.1, 1.1, 195, 2, "#af8e69", "Bàn ăn chân chữ X với hai bộ đĩa, dao nĩa và lọ hoa nhỏ."),
  define("v7-breakfast-trolley", "Xe trà hai tầng mở", "kitchen", 1.05, .65, 1.05, 135, 2, "#b79878", "Xe đẩy khay mở hai tầng có tay đẩy, bình giữ nhiệt và giỏ bánh."),
  define("v7-extractor-hood", "Chụp hút mùi ống vuông", "kitchen", 1.15, .75, 1.1, 180, 2, "#8d9eaa", "Chụp bếp loe có ống thoát, lưới lọc nan và dãy nút cơ."),
  define("v7-folding-screen", "Bình phong ba cánh", "decor", 1.85, .55, 1.85, 155, 2, "#b7a58b", "Ba cánh bình phong gỗ xoay góc với lõi vải và bản lề đồng."),
  define("v7-pendulum-clock", "Đồng hồ quả lắc đứng", "decor", .7, .45, 1.8, 140, 2, "#967458", "Hộp đồng hồ vòm, mặt số nổi và quả lắc đồng trong khoang mở."),
  define("v7-coat-tree", "Cây treo áo sáu móc", "decor", .75, .75, 1.75, 75, 1, "#aa8561", "Trụ treo áo đế ba nhánh với các móc nghiêng ở hai độ cao.", storageAction),
  define("v7-tassel-rug", "Thảm dệt tua hai đầu", "decor", 2.3, 1.6, .045, 55, 1, "#899c9c", "Thảm thấp viền dệt, họa tiết hình thoi và tua sợi ở hai đầu."),
  define("v7-bonsai-tray", "Tiểu cảnh tùng uốn", "decor", 1, .7, .9, 120, 2, "#799b84", "Tùng thân uốn phân nhánh, tán dẹt và đá cuội trên chậu nông."),
  define("v7-art-easel", "Giá tranh hoàng hôn", "decor", .85, .65, 1.5, 85, 1, "#c99f81", "Giá chữ A ba chân đỡ tranh mặt trời và các dải đồi bằng mảng nổi."),
  define("v7-vase-cluster", "Bộ bình gốm ba dáng", "decor", .85, .55, .8, 90, 2, "#b7a6a1", "Bình cổ dài, bình bầu thấp và bình loe cùng một nhánh cỏ khô."),
  define("v7-globe-stand", "Quả địa cầu vành đồng", "decor", .65, .65, 1.05, 115, 2, "#87aaa7", "Quả cầu có các mảng lục địa nổi, vành kinh tuyến nghiêng và đế tiện."),
  define("v7-umbrella-stand", "Ống ô đan nan", "decor", .55, .55, .95, 55, 1, "#a88d70", "Ống nan rỗng với vành trên và hai chiếc ô gấp có cán cong.", storageAction),
  define("v7-shoe-rack", "Kệ giày nan thấp", "decor", 1.1, .5, .65, 65, 1, "#a88b6b", "Kệ hai tầng nan thoáng, hai đôi giày và tấm chùi chân phía trước.", storageAction),
  define("v7-textile-rail", "Giá treo thảm dệt", "decor", 1.1, .55, 1.55, 95, 2, "#b9a08b", "Thanh treo trên chân chữ T mang tấm dệt lệch tầng và các nút tua."),
  define("v7-zen-garden", "Khay cát vườn tĩnh", "decor", 1, .7, .18, 60, 1, "#b4aa91", "Khay cát viền gỗ có vân cào song song, ba viên đá và cào tay."),
  define("v7-magazine-sling", "Giỏ tạp chí vải võng", "decor", .75, .5, .6, 50, 1, "#9a8e7f", "Khung chéo đỡ túi vải chữ V mở miệng với các cuốn tạp chí.", storageAction),
]);

const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "finish"): FurniturePart => ({ id, shape: "box", position: [x, y, z], size: [w, h, d], material });
const form = (id: string, shape: FurniturePart["shape"], x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "metal"): FurniturePart => ({ id, shape, position: [x, y, z], size: [w, h, d], material, ...(["cup", "ring", "frustum"].includes(shape) ? { radialSegments: 16 } : {}) });
const rotate = (part: FurniturePart, rotation: FurnitureVector): FurniturePart => ({ ...part, rotation });
const beam = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, lean: readonly [number, number], material: FurnitureMaterial = "wood"): FurniturePart => ({ ...box(id, x, y, z, w, h, d, material), lean });
const feet = (y: number, h: number, x: number, z: number): FurniturePart[] => [-1, 1].flatMap(s => [-1, 1].map(t => box(`foot-${s}-${t}`, s * x, y, t * z, .06, h, .06, "wood")));

export const HOME_V7_RECIPES: Record<string, () => readonly FurniturePart[]> = {
  "v7-espresso-machine": () => [
    box("drip-tray", 0, .06, 0, .88, .12, .88, "metal"), box("rear-reservoir", 0, .47, -.32, .78, .82, .25),
    box("brew-head", -.1, .77, .02, .55, .2, .58, "metal"), rotate(form("pressure-gauge", "cylinder", .17, .79, .325, .19, .03, .19, "paper"), [Math.PI / 2, 0, 0]),
    box("gauge-needle", .17, .81, .345, .016, .065, .012, "dark"), form("filter-holder", "cylinder", -.17, .64, .1, .22, .08, .22, "metal"),
    box("filter-handle", -.17, .64, .29, .065, .055, .24, "wood"), form("outlet", "cylinder", -.17, .55, .1, .045, .12, .045),
    form("coffee-cup", "cup", -.17, .27, .1, .25, .29, .25, "paper"), rotate(form("cup-handle", "ring", -.05, .28, .1, .12, .035, .18), [Math.PI / 2, 0, 0]),
    beam("steam-wand", .32, .43, -.1, .025, .38, .025, [0, -.22], "metal"),
    ...[-.28, -.14, 0, .14, .28].map(x => box(`drain-slot-${x}`, x, .125, .29, .045, .008, .21, "dark")),
    box("top-cup-shelf", 0, .91, -.11, .83, .06, .58, "metal"),
  ],
  "v7-stand-mixer": () => [
    { ...box("mixer-foot", 0, .06, 0, .85, .12, .87), roundness: .25 },
    box("motor-column", -.28, .43, -.22, .25, .72, .35),
    form("motor-head", "sphere", -.06, .82, -.08, .8, .3, .43),
    form("mixing-shaft", "cylinder", .17, .57, .02, .04, .27, .04),
    form("mixing-bowl", "cup", .16, .31, .02, .54, .42, .6, "metal"),
    ...[-1, 1].map(s => beam(`whisk-wire-${s}`, .16 + s * .055, .41, .02, .015, .22, .02, [s * -.08, 0], "metal")),
    form("bowl-seat", "cylinder", .16, .14, .02, .3, .06, .34, "dark"),
    rotate(form("speed-dial", "cylinder", -.28, .55, -.025, .15, .04, .15, "dark"), [Math.PI / 2, 0, 0]),
    box("tilt-latch", -.37, .7, -.025, .045, .1, .06, "wood"),
  ],
  "v7-tea-tray": () => [
    box("tea-tray", 0, .045, 0, .96, .09, .92, "wood"),
    ...[-1, 1].map(s => box(`tray-rim-${s}`, s * .46, .13, 0, .04, .11, .92, "wood")),
    form("kettle-belly", "sphere", -.17, .4, -.05, .39, .47, .49),
    form("kettle-foot", "cylinder", -.17, .15, -.05, .26, .08, .32, "dark"),
    form("kettle-lid", "cylinder", -.17, .65, -.05, .25, .04, .28, "wood"),
    form("lid-knob", "sphere", -.17, .7, -.05, .07, .08, .08, "wood"),
    rotate(form("overhead-handle", "ring", -.17, .75, -.05, .42, .035, .4, "wood"), [Math.PI / 2, 0, 0]),
    { ...form("tea-spout", "cone", .035, .49, -.05, .12, .29, .12), lean: [.19, 0] },
    ...[-1, 1].flatMap(s => [form(`saucer-${s}`, "cylinder", .28, .12, s * .24, .25, .035, .27, "paper"), form(`tea-cup-${s}`, "cup", .28, .24, s * .24, .2, .21, .21, "paper")]),
  ],
  "v7-dish-rack": () => [
    box("drain-tray", 0, .045, 0, .96, .09, .94, "dark"),
    ...[-1, 1].map(s => box(`rack-rail-${s}`, 0, .22, s * .32, .85, .035, .035, "metal")),
    ...[-1, 1].flatMap(s => [-1, 1].map(t => box(`rack-foot-${s}-${t}`, s * .39, .145, t * .32, .035, .15, .035, "metal"))),
    ...[-.35, -.17, .01, .19].flatMap((x, i) => [
      box(`slot-base-${i}`, x, .2, 0, .018, .025, .64, "metal"),
      ...[-1, 1].map(s => beam(`slot-prong-${i}-${s}`, x, .4, s * .26, .018, .4, .018, [0, s * -.15], "metal")),
      rotate(form(`plate-${i}`, "cylinder", x + .01, .5, -.04, .335, .028, .55, "paper"), [0, 0, Math.PI / 2]),
    ]),
    form("utensil-basket", "ring", .36, .335, .18, .19, .5, .32),
    form("utensil-basket-floor", "cylinder", .36, .11, .18, .18, .05, .3),
    ...[-1, 1].map(s => box(`chopstick-${s}`, .36 + s * .035, .5, .18, .018, .76, .018, "wood")),
  ],
  "v7-dining-table": () => [
    { ...box("oval-tabletop", 0, .77, 0, .96, .075, .94, "wood"), roundness: .3 },
    ...[-1, 1].flatMap(s => [-1, 1].map(t => beam(`cross-leg-${s}-${t}`, s * .3, .38, 0, .065, .72, .07, [0, t * .64]))),
    box("table-stretcher", 0, .25, 0, .66, .065, .065, "wood"),
    ...[-1, 1].flatMap(s => [
      box(`placemat-${s}`, s * .27, .815, 0, .31, .009, .73, "fabric"),
      form(`dinner-plate-${s}`, "cylinder", s * .27, .83, 0, .21, .025, .42, "paper"),
      box(`fork-${s}`, s * .27 - .135, .835, .02, .016, .018, .29, "metal"),
      box(`knife-${s}`, s * .27 + .135, .835, .02, .018, .018, .3, "metal"),
      form(`tumbler-${s}`, "ring", s * .27, .89, -.32, .085, .15, .14, "glass"),
    ]),
    form("bud-vase", "cup", 0, .88, 0, .09, .12, .15), form("flower-stem", "cylinder", 0, .95, 0, .012, .09, .02, "leaf"),
  ],
  "v7-breakfast-trolley": () => [
    ...feet(.51, .8, .39, .35),
    ...[.22, .78].flatMap(y => [box(`tray-${y}`, 0, y, 0, .9, .045, .88, "wood"), ...[-1, 1].map(s => box(`tray-lip-${y}-${s}`, 0, y + .05, s * .42, .9, .06, .04, "wood"))]),
    ...[-1, 1].flatMap(s => [-1, 1].map(t => rotate(form(`wheel-${s}-${t}`, "cylinder", s * .39, .075, t * .35, .14, .07, .14, "dark"), [Math.PI / 2, 0, 0]))),
    box("push-handle", -.39, .93, 0, .05, .05, .77, "metal"),
    form("thermos", "cylinder", -.2, .89, -.12, .16, .16, .21, "metal"), form("thermos-cap", "cylinder", -.2, .985, -.12, .13, .03, .17, "wood"),
    form("bread-basket", "cup", .2, .87, .05, .29, .13, .42, "wood"),
    form("bread-loaf", "sphere", .2, .94, .05, .22, .1, .32, "paper"),
    ...[0, 1, 2].map(i => form(`stored-plate-${i}`, "cylinder", .1, .25 + i * .019, 0, .4, .02, .5, "paper")),
  ],
  "v7-extractor-hood": () => [
    box("wall-spine", 0, .48, -.43, .38, .96, .08, "metal"),
    box("exhaust-duct", 0, .71, -.02, .3, .58, .32, "metal"),
    form("flared-canopy", "frustum", 0, .33, 0, .98, .32, .96, "metal"),
    form("canopy-shoulder", "cylinder", 0, .485, 0, .59, .03, .58, "metal"),
    box("filter-frame", 0, .145, 0, .81, .05, .76, "dark"),
    ...[-.3, -.2, -.1, 0, .1, .2, .3].map(x => box(`filter-slat-${x}`, x, .12, 0, .04, .025, .61, "metal")),
    box("control-strip", 0, .22, .455, .53, .06, .03, "dark"),
    ...[-.13, 0, .13].map(x => box(`push-button-${x}`, x, .22, .476, .06, .035, .012, "paper")),
  ],
  "v7-folding-screen": () => [-1, 0, 1].flatMap(s => {
    const angle = s * -.24;
    const panel = (part: FurniturePart): FurniturePart => {
      const [x, y, z] = part.position;
      return { ...part, position: [s * (.14 + .14 * Math.cos(angle)) + x * Math.cos(angle) + z * (.55 / 1.85) * Math.sin(angle), y, Math.abs(s) * .14 * (1.85 / .55) * Math.sin(.24) - x * (1.85 / .55) * Math.sin(angle) + z * Math.cos(angle)], rotation: [0, angle, 0] };
    };
    return [
      ...[-1, 1].map(t => panel(box(`panel-post-${s}-${t}`, t * .14, .5, 0, .025, 1, .075, "wood"))),
      ...[.16, .96].map(y => panel(box(`panel-rail-${s}-${y}`, 0, y, 0, .28, .035, .075, "wood"))),
      panel(box(`woven-panel-${s}`, 0, .56, 0, .245, .75, .032, "fabric")),
      ...(s === 0 ? [] : [.3, .75].map(y => panel(form(`hinge-${s}-${y}`, "cylinder", -s * .14, y, .03, .025, .07, .025, "gold")))),
    ];
  }),
  "v7-pendulum-clock": () => [
    box("clock-plinth", 0, .045, 0, .88, .09, .9, "wood"),
    ...[-1, 1].map(s => box(`case-pillar-${s}`, s * .33, .48, -.1, .12, .85, .48, "wood")),
    box("case-back", 0, .48, -.36, .72, .85, .06, "wood"),
    form("arched-crown", "arch", 0, .8, -.1, .83, .4, .52, "wood"),
    rotate(form("clock-face", "cylinder", 0, .81, .18, .57, .01, .36, "paper"), [Math.PI / 2, 0, 0]),
    box("hour-hand", -.055, .81, .2, .13, .015, .015, "dark"), box("minute-hand", 0, .823, .205, .018, .04, .015, "dark"),
    ...[0, 1, 2, 3].map(i => box(`hour-mark-${i}`, Math.sin(i * Math.PI / 2) * .235, .81 + Math.cos(i * Math.PI / 2) * .035, .203, .025, .012, .012, "gold")),
    box("pendulum-rod", 0, .43, -.04, .025, .42, .035, "gold"),
    form("pendulum-bob", "sphere", 0, .23, -.04, .27, .13, .13, "gold"),
  ],
  "v7-coat-tree": () => [
    form("central-post", "cylinder", 0, .49, 0, .09, .96, .09, "wood"),
    ...[0, 1, 2].map(i => rotate(box(`radial-foot-${i}`, 0, .04, 0, .08, .08, .86, "wood"), [0, i * Math.PI / 3, 0])),
    ...[0, 1, 2, 3, 4, 5].flatMap(i => {
      const angle = i * Math.PI / 3, x = Math.sin(angle), z = Math.cos(angle), y = i % 2 ? .76 : .59;
      return [beam(`coat-hook-${i}`, x * .15, y, z * .15, .045, .18, .045, [x * .28, z * .28]), form(`hook-cap-${i}`, "sphere", x * .29, y + .1, z * .29, .075, .04, .075, "wood")];
    }),
    form("crown-finial", "sphere", 0, .975, 0, .14, .05, .14, "wood"),
  ],
  "v7-tassel-rug": () => [
    box("woven-ground", 0, .23, 0, .96, .46, .82, "fabric"),
    ...[-1, 1].flatMap(s => [box(`long-border-${s}`, s * .43, .5, 0, .035, .08, .8, "paper"), box(`short-border-${s}`, 0, .5, s * .35, .87, .08, .035, "paper")]),
    ...[-.22, 0, .22].map((x, i) => rotate(box(`diamond-${i}`, x, .52, 0, .14, .1, .2, "cushion"), [0, Math.PI / 4, 0])),
    ...[-1, 1].flatMap(s => Array.from({ length: 12 }, (_, i) => box(`tassel-${s}-${i}`, -.4125 + i * .075, .24, s * .45, .022, .27, .1, "paper"))),
  ],
  "v7-bonsai-tray": () => [
    form("shallow-planter", "cup", 0, .12, 0, .95, .24, .9, "finish"),
    form("soil-island", "cylinder", 0, .19, 0, .66, .04, .62, "dark"),
    beam("bent-trunk", -.07, .39, 0, .085, .42, .1, [.17, 0]),
    beam("upper-trunk", -.04, .67, 0, .055, .24, .07, [-.14, 0]),
    beam("left-branch", -.19, .56, .01, .04, .19, .045, [-.28, .1]),
    beam("right-branch", .14, .64, -.04, .04, .19, .045, [.29, -.08]),
    form("left-canopy", "sphere", -.29, .68, .06, .35, .19, .55, "leaf"),
    form("right-canopy", "sphere", .26, .75, -.1, .39, .22, .48, "leaf"),
    form("crown-canopy", "sphere", -.1, .9, .02, .42, .2, .48, "leaf"),
    form("river-rock", "sphere", .23, .24, .18, .22, .1, .2, "metal"),
  ],
  "v7-art-easel": () => [
    ...[-1, 1].map(s => beam(`a-frame-leg-${s}`, s * .19, .49, -.025, .05, .98, .06, [-s * .3, 0])),
    beam("rear-prop", 0, .44, -.18, .05, .88, .055, [0, .3]),
    box("canvas-ledge", 0, .34, .08, .84, .05, .17, "wood"),
    box("canvas-frame", 0, .64, -.02, .74, .55, .07, "wood"),
    box("canvas", 0, .64, .023, .66, .48, .018, "paper"),
    rotate(form("sun-disc", "cylinder", .16, .76, .038, .17, .012, .13, "gold"), [Math.PI / 2, 0, 0]),
    form("distant-hill", "arch", -.12, .51, .045, .39, .2, .014, "finish"),
    form("near-hill", "arch", .17, .46, .06, .31, .12, .012, "leaf"),
    box("top-clamp", 0, .93, .035, .18, .045, .1, "wood"),
  ],
  "v7-vase-cluster": () => [
    form("tall-vase-foot", "cylinder", -.24, .045, -.06, .28, .09, .39),
    form("tall-vase-body", "sphere", -.24, .29, -.06, .37, .48, .48),
    form("tall-vase-neck", "ring", -.24, .6, -.06, .14, .28, .19),
    form("low-vase-body", "sphere", .2, .2, .17, .43, .4, .49, "paper"),
    form("low-vase-mouth", "ring", .2, .4, .17, .16, .08, .2, "paper"),
    form("flared-vessel", "cup", .18, .26, -.25, .32, .52, .37, "wood"),
    beam("dried-grass-stem", -.23, .82, -.06, .012, .34, .015, [.1, 0], "wood"),
    ...[-1, 1].map(s => beam(`grass-frond-${s}`, -.18 + s * .04, .9, -.06, .025, .13, .028, [s * .09, 0], "paper")),
  ],
  "v7-globe-stand": () => [
    form("turned-foot", "cylinder", 0, .045, 0, .65, .09, .65, "wood"),
    form("globe-pedestal", "frustum", 0, .18, 0, .26, .21, .26, "wood"),
    form("world-sphere", "sphere", 0, .62, 0, .67, .51, .67, "finish"),
    rotate(form("meridian-ring", "ring", 0, .62, 0, .86, .035, .65, "gold"), [Math.PI / 2, 0, .2]),
    beam("polar-axis", 0, .62, 0, .025, .672, .025, [-.14, 0], "metal"),
    form("north-continent", "sphere", -.12, .72, .26, .22, .17, .095, "leaf"),
    form("south-continent", "sphere", .13, .51, .28, .13, .21, .085, "leaf"),
    form("island-chain", "sphere", .26, .66, .17, .1, .09, .12, "paper"),
  ],
  "v7-umbrella-stand": () => [
    form("umbrella-drip-base", "cylinder", 0, .045, 0, .8, .09, .8, "dark"),
    ...[.14, .56].map(y => form(`basket-hoop-${y}`, "ring", 0, y, 0, .82, .05, .82, "wood")),
    ...Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5;
      return box(`basket-upright-${i}`, Math.sin(angle) * .37, .33, Math.cos(angle) * .37, .035, .5, .035, "wood");
    }),
    ...[-1, 1].flatMap(s => [form(`folded-umbrella-${s}`, "cone", s * .17, .413, 0, .21, .65, .23, "fabric"), form(`umbrella-shaft-${s}`, "cylinder", s * .17, .78, 0, .025, .3, .025), rotate(form(`curved-handle-${s}`, "ring", s * .17, .94, 0, .16, .035, .12, "wood"), [Math.PI / 2, 0, 0])]),
  ],
  "v7-shoe-rack": () => [
    ...feet(.47, .94, .42, .28),
    ...[.16, .6].flatMap(y => [-.27, -.09, .09, .27].map(z => box(`shoe-slat-${y}-${z}`, 0, y, z, .89, .045, .12, "wood"))),
    ...[-1, 1].flatMap(s => [box(`end-brace-${s}`, s * .42, .9, 0, .065, .045, .65, "wood"),
      ...[.26, .7].map((y, i) => form(`shoe-${s}-${i}`, "sphere", s * .22, y, .02, .19, .17, .48, "dark"))]),
    box("entry-mat", 0, .025, .415, .94, .05, .16, "fabric"),
  ],
  "v7-textile-rail": () => [
    ...[-1, 1].flatMap(s => [box(`rail-foot-${s}`, s * .4, .025, 0, .13, .05, .85, "wood"), box(`rail-post-${s}`, s * .4, .5, 0, .04, .95, .05, "wood")]),
    box("textile-crossbar", 0, .96, 0, .9, .04, .06, "metal"),
    box("hanging-weave", -.06, .59, .035, .59, .74, .025, "fabric"), box("folded-back", -.06, .73, -.04, .59, .46, .025, "fabric"),
    ...[.38, .47, .74].map(y => box(`woven-band-${y}`, -.06, y, .052, .58, .023, .008, "paper")),
    ...Array.from({ length: 8 }, (_, i) => box(`knotted-fringe-${i}`, -.32 + i * .075, .17, .035, .02, .1, .025, "paper")),
  ],
  "v7-zen-garden": () => [
    box("sand-tray-base", 0, .075, 0, .96, .15, .94, "wood"),
    ...[-1, 1].flatMap(s => [box(`tray-edge-x-${s}`, s * .46, .24, 0, .04, .22, .94, "wood"), box(`tray-edge-z-${s}`, 0, .24, s * .45, .9, .22, .04, "wood")]),
    box("sand-bed", 0, .18, 0, .87, .06, .83, "paper"),
    ...[-.28, -.18, -.08, .02, .12].map(z => box(`sand-ridge-${z}`, -.12, .23, z, .55, .035, .012, "finish")),
    form("large-stone", "sphere", .18, .48, -.12, .27, .55, .3, "metal"),
    form("small-stone", "sphere", .31, .33, .1, .16, .27, .21, "dark"),
    form("flat-stone", "sphere", .07, .29, .15, .18, .16, .15, "metal"),
    box("rake-handle", -.13, .405, .32, .5, .06, .025, "wood"), box("rake-head", .13, .405, .32, .025, .065, .19, "wood"),
    ...[-.06, 0, .06].map(z => box(`rake-tooth-${z}`, .13, .295, .32 + z, .018, .18, .015, "wood")),
  ],
  "v7-magazine-sling": () => [
    ...[-1, 1].flatMap(s => [-1, 1].map(t => beam(`cross-frame-${s}-${t}`, s * .38, .47, 0, .045, .94, .045, [0, t * .72], "wood"))),
    ...[-1, 1].map(s => box(`sling-rail-${s}`, 0, .88, s * .31, .86, .045, .045, "wood")),
    ...[-1, 1].map(s => beam(`fabric-pocket-${s}`, 0, .54, s * .16, .68, .68, .025, [0, s * .31], "fabric")),
    box("pocket-bottom", 0, .2, 0, .68, .045, .06, "fabric"),
    ...[-1, 0, 1].flatMap((s, i) => [beam(`magazine-${i}`, s * .2, .57 + i * .035, s * .04, .17, .45, .03, [0, s * .1], "paper"), beam(`cover-title-${i}`, s * .2, .72 + i * .035, s * .04 + s * .1 / 3 + .019, .1, .035, .012, [0, s * .1 * .035 / .45], "finish")]),
  ],
};

Object.freeze(HOME_V7_RECIPES);
