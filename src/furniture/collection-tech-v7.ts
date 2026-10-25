import type { FurnitureDefinition, FurnitureInteraction, FurnitureMaterial, FurniturePart } from "./catalog";

type Category = "storage" | "electronics" | "light";
const actions: Record<Category, readonly FurnitureInteraction[]> = {
  storage: [{ id: "store", label: "Mở kho đồ", screen: "inventory" }],
  electronics: [{ id: "power", label: "Bật / tắt thiết bị", screen: "focus", toggle: true }],
  light: [{ id: "light", label: "Bật / tắt đèn", screen: "focus", toggle: true }],
};
function item(id: string, name: string, category: Category, width: number, depth: number, height: number, price: number, level: number, color: string, description: string): FurnitureDefinition {
  return Object.freeze({ id: `v7-${id}`, name, category, width, depth, height, price, level, color, description, neonColor: "#00f0ff", interactions: Object.freeze(actions[category].map(action => Object.freeze({ ...action }))) });
}

export const TECH_V7_CATALOG: readonly FurnitureDefinition[] = Object.freeze([
  item("ladder-shelf", "Kệ thang tựa gỗ", "storage", 1.1, .7, 2, 180, 2, "#b29777", "Kệ bốn mâm thu dần, trụ nghiêng và thanh chống sau."),
  item("shoe-cubby", "Tủ giày ghế đệm", "storage", 1.8, .55, .8, 165, 2, "#a69c86", "Ghế đệm dài trên sáu ô giày với tay kéo hai đầu."),
  item("parcel-locker", "Tủ nhận bưu kiện", "storage", 1.15, .65, 2.1, 340, 4, "#6f8590", "Tủ ba khoang lệch cỡ có khóa số và khe nhận thư."),
  item("apothecary", "Tủ hộc nhãn đồng", "storage", 1.4, .6, 1.25, 290, 3, "#9c7959", "Chín hộc nhỏ có khung nhãn đồng trên chân đế lùi."),
  item("record-rack", "Kệ đĩa than mở", "storage", 1.5, .65, 1.35, 220, 3, "#866b59", "Khoang đĩa chia đứng, ngăn máy phía trên và thanh giữ mép."),
  item("stepped-shelf", "Kệ bậc góc phòng", "storage", 1.6, .6, 1.8, 240, 3, "#b1a18b", "Ba ô cao thấp tạo bậc mở với vách hậu riêng từng ô."),
  item("coat-valet", "Giá áo kiêm khay", "storage", .9, .7, 1.8, 135, 2, "#aa8866", "Giá áo trụ đôi, thanh móc ngang và khay cất túi dưới chân."),
  item("desktop-tower", "Tháp máy tính thông gió", "electronics", .65, .65, 1.1, 380, 4, "#687d8d", "Thân máy trên chân cao, quạt hút mặt trước và cụm cổng kết nối."),
  item("projector-pedestal", "Máy chiếu trên bục", "electronics", .8, .8, 1.2, 360, 4, "#b8bec3", "Máy chiếu có ống kính vòng, khe tản nhiệt và bục đi dây."),
  item("turntable-console", "Bàn đĩa than", "electronics", 1.3, .75, 1.05, 310, 3, "#a58b70", "Mâm đĩa nổi, cần kim, núm chỉnh và khoang ampli trên chân thanh."),
  item("scanner-printer", "Máy in quét tài liệu", "electronics", .9, .75, .8, 270, 3, "#bbc4c5", "Máy in có nắp quét, khay giấy nhô trước và bảng điều khiển bên."),
  item("robot-dock", "Trạm robot vệ sinh", "electronics", .85, .9, 1.05, 330, 4, "#c0c7c1", "Robot tròn nằm trên dốc sạc nối trụ chứa bụi và tiếp điểm."),
  item("air-purifier", "Máy lọc khí cánh đứng", "electronics", .6, .6, 1.2, 230, 3, "#c5c9c3", "Tháp lọc khí trụ tròn với cửa hút nan, miệng thoát và vòng trạng thái."),
  item("reel-recorder", "Máy băng cối", "electronics", .95, .55, 1.15, 320, 4, "#a69b89", "Hai cuộn băng, đường dẫn qua đầu từ và đồng hồ trên bệ máy."),
  item("info-terminal", "Trạm tra cứu cá nhân", "electronics", .8, .65, 1.8, 410, 5, "#82939c", "Màn hình cao trên trụ lệch, bàn phím gọn và đầu đọc thẻ."),
  item("synthesizer", "Đàn tổng hợp âm", "electronics", 1.65, .7, 1.2, 390, 4, "#8c8796", "Bàn phím hai màu, hàng núm chỉnh và chân đỡ nối bằng giằng."),
  item("paper-lantern", "Đèn lồng khung gỗ", "light", .55, .55, 1.15, 85, 1, "#efd2a1", "Ánh sáng mật ong qua giấy mờ trong khung bốn trụ."),
  item("cantilever-lamp", "Đèn đọc vươn ngang", "light", 1.15, .55, 1.85, 155, 2, "#f1d6aa", "Cột lệch giữ cần ngang và chụp nhỏ chiếu xuống góc đọc."),
  item("shoji-light", "Vách đèn giấy ô vuông", "light", 1.05, .4, 1.8, 195, 3, "#eed5b3", "Tấm tán sáng ấm chia ô gỗ trên hai chân bản rộng."),
  item("uplight-bowl", "Đèn hắt chén đồng", "light", .65, .65, 1.9, 145, 2, "#f5d4a0", "Chén hắt trần mở miệng trên trụ kim loại và đế nặng."),
  item("twin-globe", "Đèn cầu đôi lệch tầng", "light", .9, .55, 1.65, 175, 3, "#efdbbc", "Hai cầu kính sữa cao thấp nối vào thân giữa bằng tay ngang."),
  item("task-arm", "Đèn bàn khớp gập", "light", .7, .55, .95, 95, 2, "#f0d9b2", "Hai tay khớp nghiêng, núm siết và đầu chiếu có tấm khuếch tán."),
  item("reading-column", "Đèn cột kèm hộc sách", "light", .55, .5, 1.55, 140, 2, "#ebcc99", "Hộc sách chân cột đỡ lưng gỗ với hộp sáng hướng xuống."),
  item("candle-cluster", "Cụm nến điện ba tầng", "light", .65, .6, .65, 75, 1, "#f4cd8e", "Ba nến điện khác độ cao trên khay gốm với tim sáng nhỏ."),
  item("louver-bollard", "Đèn nan sân vườn", "light", .5, .5, 1, 110, 2, "#e9ce9f", "Cột đèn chân kín, lõi sáng ấm và các nan che chói quanh đầu."),
]);

const b = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "finish"): FurniturePart => ({ id, shape: "box", position: [x, y, z], size: [w, h, d], material });
const r = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "metal", shape: FurniturePart["shape"] = "cylinder"): FurniturePart => ({ ...b(id, x, y, z, w, h, d, material), shape, radialSegments: 16 });
const feet = (height: number, x = .38, z = .34): FurniturePart[] => [-1, 1].flatMap(sx => [-1, 1].map(sz => b(`foot-${sx}-${sz}`, sx * x, height / 2, sz * z, .08, height, .09, "metal")));
const vents = (x: number, y: number, z: number, count: number, width: number, spacing = .04): FurniturePart[] => Array.from({ length: count }, (_, i) => b(`vent-${i}`, x, y + i * spacing, z, width, .014, .02, "dark"));
const disc = (id: string, x: number, y: number, z: number, diameter: number, material: FurnitureMaterial): FurniturePart => r(id, x, y, z, diameter, diameter, .045, material, "sphere");

export const TECH_V7_RECIPES: Record<string, () => readonly FurniturePart[]> = {
  "v7-ladder-shelf": () => [
    ...[-1, 1].map(s => ({ ...b(`sloping-post-${s}`, s * .44, .5, -.1, .07, 1, .07, "wood"), lean: [0, -.48] as const })),
    ...[.12, .38, .64, .9].map((y, i) => b(`tapered-shelf-${i}`, 0, y, -.02 - i * .07, .88, .035, .82 - i * .16, "wood")),
    b("rear-brace", 0, .72, -.2056, .88, .055, .055, "metal"),
    ...[-1, 1].map(s => b(`ground-foot-${s}`, s * .44, .025, .14, .12, .05, .2, "dark")),
  ],
  "v7-shoe-cubby": () => [
    b("plinth", 0, .07, 0, .92, .14, .86, "wood"), b("back", 0, .46, -.43, .96, .64, .05, "wood"),
    ...[-.46, -.15, .15, .46].map(x => b(`upright-${x}`, x, .46, 0, .04, .64, .88, "wood")),
    ...[.15, .46, .77].map(y => b(`shelf-${y}`, 0, y, 0, .96, .04, .9, "wood")),
    { ...b("seat-pad", 0, .85, 0, .96, .12, .88, "cushion"), roundness: .25 },
    ...[-1, 1].map(s => b(`end-grip-${s}`, s * .46, .95, 0, .04, .1, .62, "metal")),
  ],
  "v7-parcel-locker": () => [
    b("plinth", 0, .04, 0, .9, .08, .84, "dark"), b("cabinet", 0, .54, -.035, .96, .92, .87, "metal"),
    ...[[.25, .32], [.57, .28], [.85, .24]].flatMap(([y, h], i) => [b(`door-${i}`, -.08, y, .42, .73, h, .05), b(`latch-${i}`, .21, y, .457, .025, .08, .024, "metal")]),
    b("keypad", .36, .64, .412, .13, .16, .026, "dark"), b("status-display", .36, .78, .412, .13, .07, .026, "screen"),
    ...[.6, .65, .7].map(y => b(`key-row-${y}`, .36, y, .432, .09, .015, .014, "metal")),
    b("letter-slot", -.08, .91, .45, .38, .018, .016, "dark"),
  ],
  "v7-apothecary": () => [
    b("plinth", 0, .055, 0, .86, .11, .82, "dark"), b("carcass", 0, .54, -.035, .96, .86, .85, "wood"), b("cap", 0, .98, 0, 1, .04, .94, "wood"),
    ...[-.31, 0, .31].flatMap((x, col) => [.25, .53, .81].flatMap((y, row) => [
      b(`drawer-${col}-${row}`, x, y, .405, .285, .25, .04, "wood"), b(`label-frame-${col}-${row}`, x, y + .04, .433, .13, .06, .016, "gold"),
      b(`label-${col}-${row}`, x, y + .04, .443, .1, .035, .006, "paper"), b(`pull-${col}-${row}`, x, y - .05, .445, .11, .02, .04, "metal"),
    ])),
  ],
  "v7-record-rack": () => [
    ...feet(.16), b("bottom", 0, .18, 0, .96, .05, .9, "wood"), b("rear", 0, .57, -.43, .96, .78, .05, "wood"),
    ...[-1, 1].map(s => b(`side-${s}`, s * .46, .57, 0, .04, .78, .9, "wood")),
    b("top", 0, .98, 0, .96, .04, .9, "wood"), b("equipment-shelf", 0, .72, 0, .92, .04, .85, "wood"),
    ...[-.23, 0, .23].map(x => b(`record-divider-${x}`, x, .45, -.02, .025, .49, .8, "metal")),
    b("retaining-rail", 0, .25, .41, .92, .07, .04, "metal"),
    ...[-.34, -.07, .16].map((x, i) => b(`record-sleeve-${i}`, x, .419, -.03, .055, .43, .65, "paper")),
  ],
  "v7-stepped-shelf": () => [
    b("base", 0, .035, 0, .98, .07, .92, "wood"),
    ...[.34, .66, 1].flatMap((top, i) => { const x = -.32 + i * .32; return [
      b(`back-${i}`, x, top / 2, -.43, .32, top, .05, "wood"), b(`left-${i}`, x - .145, top / 2, 0, .03, top, .88, "wood"),
      b(`right-${i}`, x + .145, top / 2, 0, .03, top, .88, "wood"), b(`cap-${i}`, x, top - .02, 0, .32, .04, .9, "wood"),
      b(`middle-${i}`, x, top / 2, 0, .29, .03, .85, "wood"),
    ]; }),
  ],
  "v7-coat-valet": () => [
    ...[-1, 1].flatMap(s => [b(`foot-${s}`, s * .32, .04, 0, .16, .08, .9, "wood"), r(`post-${s}`, s * .32, .51, -.16, .055, .94, .055), b(`hook-${s}`, s * .32, .84, .01, .045, .045, .38, "metal"), r(`hook-tip-${s}`, s * .32, .88, .18, .06, .1, .06)]),
    b("hanger-rail", 0, .965, -.16, .82, .045, .055, "wood"), b("tray", 0, .18, 0, .8, .04, .75, "wood"),
    ...[-1, 1].map(s => b(`tray-lip-${s}`, 0, .22, s * .36, .8, .06, .03, "wood")),
    b("shoe-shelf", 0, .085, .03, .72, .035, .7, "wood"),
  ],
  "v7-desktop-tower": () => [
    ...feet(.1, .32, .32), b("chassis", 0, .55, -.03, .86, .9, .84, "metal"),
    { ...b("service-window", -.435, .58, -.05, .01, .66, .62, "glass"), surface: "smoked-glass" },
    ...[.35, .65].flatMap((y, i) => [disc(`fan-bezel-${i}`, 0, y, .403, .27, "dark"), disc(`fan-hub-${i}`, 0, y, .433, .09, "metal"), b(`fan-cross-${i}`, 0, y, .442, .23, .018, .012, "metal")]),
    ...[-.19, -.07].map(x => b(`usb-port-${x}`, x, .91, .398, .075, .024, .016, "dark")), disc("power-button", .23, .91, .41, .05, "screen"),
    ...vents(0, .13, .398, 3, .55, .04),
  ],
  "v7-projector-pedestal": () => [
    b("base", 0, .04, 0, .86, .08, .86, "dark"), b("cable-column", 0, .36, -.1, .22, .56, .28, "metal"), b("tray", 0, .65, 0, .9, .04, .82, "metal"),
    ...[-1, 1].map(s => b(`projector-foot-${s}`, s * .29, .69, .12, .1, .04, .4, "dark")),
    { ...b("projector-body", 0, .84, -.03, .85, .26, .68, "paper"), roundness: .18 },
    disc("lens-housing", -.22, .83, .33, .24, "dark"), disc("lens-glass", -.22, .83, .365, .17, "glass"),
    ...vents(.2, .76, .318, 4, .28, .045), b("focus-control", -.2, .985, .02, .14, .03, .08, "dark"), b("input-port", .115, .85, -.378, .13, .045, .016, "dark"),
  ],
  "v7-turntable-console": () => [
    ...feet(.38), b("amplifier-case", 0, .51, 0, .92, .26, .86, "wood"), b("turntable-plinth", 0, .68, 0, 1, .08, .94, "wood"),
    r("platter", -.14, .75, 0, .55, .06, .64, "metal"), r("record", -.14, .787, 0, .51, .014, .6, "dark"), r("record-label", -.14, .798, 0, .15, .012, .18, "paper"), r("spindle", -.14, .82, 0, .025, .04, .025),
    r("tonearm-pivot", .32, .8, -.25, .09, .16, .09), b("tonearm", .32, .875, -.05, .025, .025, .42, "metal"), b("headshell-arm", .19, .875, .14, .285, .025, .035, "metal"), b("cartridge", .06, .837, .14, .08, .06, .09, "dark"), b("stylus", .06, .801, .14, .012, .018, .012, "metal"),
    b("rear-dust-guard", 0, .86, -.45, 1, .28, .035, "glass"), b("amp-display", -.1, .51, .438, .35, .08, .016, "screen"), disc("volume", .3, .51, .45, .1, "metal"),
  ],
  "v7-scanner-printer": () => [
    b("base", 0, .055, -.05, .83, .11, .8, "dark"), b("printer-body", 0, .45, -.08, .94, .68, .78, "paper"),
    b("scanner-seam", 0, .8, -.08, .96, .04, .8, "dark"), b("scanner-lid", 0, .87, -.08, .96, .1, .8), b("lid-grip", 0, .93, .22, .38, .04, .09, "metal"),
    b("output-slot", 0, .37, .319, .64, .08, .018, "dark"), b("output-tray", 0, .305, .32, .72, .04, .36, "metal"), b("paper-stack", 0, .338, .34, .56, .026, .3, "paper"),
    b("control-housing", .29, .68, .35, .28, .2, .1, "dark"), b("control-display", .29, .72, .408, .19, .08, .016, "screen"), b("control-key", .29, .625, .408, .07, .04, .016, "metal"),
    ...vents(-.28, .53, .318, 4, .16, .055),
  ],
  "v7-robot-dock": () => [
    b("dock-ramp", 0, .035, 0, .92, .07, .96, "dark"), b("dust-tower", 0, .53, -.29, .62, .94, .38, "paper"), b("lid-seam", 0, .91, -.29, .63, .025, .39, "metal"),
    b("charge-panel", 0, .2, -.088, .36, .2, .024, "dark"), ...[-1, 1].map(s => b(`contact-${s}`, s * .12, .18, -.07, .045, .07, .016, "gold")),
    r("robot-body", 0, .16, .19, .82, .18, .56, "metal"), r("robot-lid", 0, .257, .19, .72, .025, .48, "paper"), r("lidar", 0, .299, .16, .18, .06, .14, "dark"),
    b("dock-status", 0, .8, -.092, .2, .035, .016, "screen"), b("bumper", 0, .15, .465, .38, .09, .03, "dark"),
  ],
  "v7-air-purifier": () => [
    r("foot", 0, .04, 0, .82, .08, .82, "dark"), r("filter-body", 0, .49, 0, .86, .82, .86, "paper"),
    r("outlet-rim", 0, .91, 0, .85, .06, .85, "metal", "ring"), r("outlet-well", 0, .9, 0, .68, .025, .68, "dark"),
    ...[-.24, -.12, 0, .12, .24].map(x => b(`outlet-fin-${x}`, x, .93, 0, .035, .04, .45, "metal")),
    ...vents(0, .21, .424, 10, .31, .055), b("status-strip", 0, .82, .425, .2, .025, .015, "screen"), r("top-control", 0, .975, -.2, .13, .05, .1, "dark"),
  ],
  "v7-reel-recorder": () => [
    b("base", 0, .06, 0, .96, .12, .94, "wood"), b("body", 0, .5, -.12, .9, .78, .58, "metal"),
    ...[-1, 1].flatMap(s => [disc(`reel-${s}`, s * .25, .77, .185, .43, "dark"), disc(`reel-flange-${s}`, s * .25, .77, .215, .38, "metal"), disc(`reel-hub-${s}`, s * .25, .77, .245, .1, "dark"), b(`reel-spoke-${s}`, s * .25, .77, .267, .3, .035, .012, "paper")]),
    b("tape-bridge", 0, .57, .23, .51, .025, .045, "dark"), b("head-block", 0, .5, .22, .25, .13, .1, "dark"),
    ...[-1, 1].map(s => b(`meter-${s}`, s * .22, .32, .18, .24, .12, .025, "screen")),
    ...[-.28, -.14, 0, .14, .28].map(x => b(`transport-key-${x}`, x, .17, .2, .09, .055, .08, "paper")),
  ],
  "v7-info-terminal": () => [
    b("foot", 0, .035, 0, .9, .07, .94, "metal"), b("service-column", .18, .43, -.19, .24, .79, .28, "metal"),
    b("monitor-frame", 0, .8, -.12, .94, .4, .16, "dark"), b("display", 0, .8, -.03, .85, .31, .02, "screen"),
    b("keyboard-shelf", 0, .55, .02, .8, .04, .54, "metal"), b("keyboard", -.1, .58, .08, .5, .02, .25, "dark"),
    ...[-.005, .075, .155].map(z => b(`key-row-${z}`, -.1, .596, z, .44, .012, .04, "metal")),
    b("card-reader", .29, .6, .08, .15, .08, .21, "dark"), b("card-slot", .29, .645, .08, .09, .01, .12, "metal"),
    b("service-port", .18, .3, -.04, .13, .08, .02, "dark"),
  ],
  "v7-synthesizer": () => [
    ...[-1, 1].flatMap(s => [b(`foot-${s}`, s * .34, .035, 0, .14, .07, .85, "dark"), b(`stand-${s}`, s * .34, .39, 0, .055, .71, .08, "metal")]),
    b("cross-brace", 0, .26, 0, .72, .045, .06, "metal"), b("keyboard-body", 0, .79, 0, 1, .12, .9, "dark"),
    ...Array.from({ length: 12 }, (_, i) => b(`white-key-${i}`, -.44 + i * .08, .87, .19, .073, .04, .4, "paper")),
    ...[0, 1, 3, 4, 5, 7, 8, 10].map(i => b(`black-key-${i}`, -.4 + i * .08, .91, .095, .042, .06, .21, "dark")),
    ...[-.32, -.16, 0, .16].map(x => r(`knob-${x}`, x, .89, -.27, .05, .08, .06, "metal")),
    b("patch-screen", .33, .858, -.24, .18, .016, .2, "screen"), b("audio-port", -.35, .79, -.46, .1, .04, .02, "metal"),
  ],
  "v7-paper-lantern": () => [
    b("base", 0, .06, 0, .9, .12, .9, "wood"), b("diffuser", 0, .53, 0, .69, .76, .69, "glow"),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => b(`corner-${x}-${z}`, x * .39, .51, z * .39, .06, .78, .06, "wood"))),
    b("cap", 0, .93, 0, .94, .06, .94, "wood"),
    ...[.25, .5, .75].flatMap(y => [-1, 1].map(s => b(`shade-rib-${y}-${s}`, 0, y, s * .35, .75, .025, .025, "wood"))),
    b("top-handle", 0, .98, 0, .28, .04, .12, "metal"),
  ],
  "v7-cantilever-lamp": () => [
    b("weighted-foot", -.23, .035, 0, .5, .07, .9, "dark"), r("mast", -.32, .48, 0, .065, .89, .09, "metal"),
    b("arm", -.03, .9, 0, .65, .045, .08, "metal"), r("socket", .27, .84, 0, .06, .13, .08),
    r("shade", .27, .78, 0, .4, .19, .66, "paper", "frustum"), b("shade-spoke", .27, .86, 0, .27, .02, .025, "metal"), r("diffuser", .27, .688, 0, .39, .012, .64, "glow"),
    b("switch", -.32, .54, .055, .08, .08, .025, "dark"),
  ],
  "v7-shoji-light": () => [
    ...[-1, 1].map(s => b(`foot-${s}`, s * .34, .04, 0, .16, .08, .94, "wood")), b("diffuser", 0, .54, 0, .82, .84, .08, "glow"),
    ...[-1, 1].map(s => b(`side-frame-${s}`, s * .44, .54, 0, .06, .92, .13, "wood")),
    ...[.1, .98].map(y => b(`horizontal-frame-${y}`, 0, y, 0, .94, .04, .13, "wood")),
    ...[-.2, .2].map(x => b(`vertical-lattice-${x}`, x, .54, .058, .025, .86, .036, "wood")),
    ...[.32, .54, .76].map(y => b(`horizontal-lattice-${y}`, 0, y, .058, .84, .025, .036, "wood")),
  ],
  "v7-uplight-bowl": () => [
    r("base", 0, .035, 0, .86, .07, .86, "dark"), r("stem", 0, .46, 0, .07, .85, .07, "gold"),
    r("neck", 0, .84, 0, .18, .12, .18, "gold"), r("uplight-bowl", 0, .89, 0, .94, .22, .94, "gold", "cup"),
    r("opal-disc", 0, .925, 0, .82, .025, .82, "glow"), r("upper-rim", 0, .99, 0, .95, .02, .95, "gold", "ring"),
    b("dimmer", 0, .5, .045, .12, .07, .035, "dark"),
  ],
  "v7-twin-globe": () => [
    r("base", 0, .035, 0, .8, .07, .85, "dark"), r("stem", 0, .47, 0, .055, .87, .08, "gold"),
    ...[[-.28, .64], [.28, .85]].flatMap(([x, y], i) => [b(`arm-${i}`, x / 2, y - .1, 0, Math.abs(x), .025, .045, "gold"), r(`socket-${i}`, x, y - .07, 0, .07, .1, .09, "gold"), r(`opal-globe-${i}`, x, y, 0, .38, .26, .58, "glow", "sphere")]),
    r("stem-cap", 0, .92, 0, .08, .03, .1, "gold"),
  ],
  "v7-task-arm": () => [
    r("base", 0, .04, 0, .8, .08, .86, "metal"), r("pivot", -.2, .13, 0, .14, .1, .18, "dark"),
    { ...b("lower-arm", -.1, .36, 0, .055, .46, .07, "metal"), lean: [.2, 0] as const },
    disc("elbow", 0, .59, .025, .12, "dark"), { ...b("upper-arm", .13, .72, 0, .055, .28, .07, "metal"), lean: [.26, 0] as const },
    b("head-joint", .26, .86, 0, .07, .06, .09, "metal"), b("head", .26, .9, .04, .38, .1, .55, "paper"), b("diffuser", .26, .844, .08, .3, .012, .41, "glow"),
    r("switch", .15, .09, .15, .09, .02, .09, "dark"),
  ],
  "v7-reading-column": () => [
    b("base", 0, .035, 0, .94, .07, .9, "wood"), b("spine", 0, .52, -.32, .72, .96, .1, "wood"),
    ...[-1, 1].map(s => b(`cubby-side-${s}`, s * .4, .22, 0, .06, .37, .8, "wood")), b("cubby-roof", 0, .42, 0, .86, .04, .8, "wood"),
    b("book", -.2, .23, -.02, .1, .31, .55, "paper"), b("light-hood", 0, .95, -.03, .86, .1, .66, "metal"),
    b("diffuser", 0, .894, .02, .7, .012, .45, "glow"), b("dimmer", .25, .7, -.26, .12, .06, .02, "dark"),
  ],
  "v7-candle-cluster": () => [
    r("tray", 0, .045, 0, .98, .09, .96, "paper"), r("tray-rim", 0, .09, 0, .98, .04, .96, "metal", "ring"),
    ...[[-.24, -.14, .57], [.22, -.14, .8], [0, .22, .4]].flatMap(([x, z, height], i) => [
      r(`candle-${i}`, x, .09 + height / 2, z, .28, height, .3, "paper"), r(`wax-rim-${i}`, x, .09 + height, z, .28, .03, .3, "paper", "ring"),
      r(`wick-${i}`, x, .11 + height, z, .025, .06, .025, "dark"), r(`flame-${i}`, x, .16 + height, z, .08, .08, .09, "glow", "sphere"),
    ]),
  ],
  "v7-louver-bollard": () => [
    b("foot", 0, .035, 0, .92, .07, .92, "metal"), b("column", 0, .31, 0, .56, .55, .56, "dark"), b("light-core", 0, .76, 0, .5, .36, .5, "glow"),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => b(`post-${x}-${z}`, x * .28, .76, z * .28, .04, .4, .04, "metal"))),
    ...[.58, .7, .82, .94].map(y => r(`louver-${y}`, 0, y, 0, .88, .025, .88, "metal", "ring")), b("cap", 0, .98, 0, .84, .04, .84, "metal"),
  ],
};
