import { LIVING_V7_CATALOG, LIVING_V7_RECIPES } from "./collection-living-v7";
import { TECH_V7_CATALOG, TECH_V7_RECIPES } from "./collection-tech-v7";
import { CRAFT_V7_CATALOG, CRAFT_V7_RECIPES } from "./collection-craft-v7";
import { HOME_V7_CATALOG, HOME_V7_RECIPES } from "./collection-home-v7";
import { getApartmentAsset, resolveApartmentAssetId } from "@/components/apartment-v21/asset-registry";
import { PlacementFlags } from "./placement-flags";

export const FURNITURE_CATEGORIES = ["bed", "seating", "desk", "chair", "storage", "electronics", "light", "kitchen", "decor", "workshop", "collectible", "doors", "windows"] as const;
export const CYBERPUNK_DESK_URL = "/assets/cyberpunk_desk.glb";
export const DEFAULT_NEON_COLOR = "#00f0ff";
const NEON_ASSET_URLS: Readonly<Record<string, string>> = Object.freeze({
  workstation: CYBERPUNK_DESK_URL,
  "cloud-bed": "/assets/futuristic_sci-fi_bed_with_led_lights.glb",
  "platform-bed": "/assets/scifi_bed.glb",
  "haven-sofa": "/assets/scifi_sofa.glb",
  "corner-sofa": "/assets/low_poly_bebop_couch.glb",
  "chaise-lounge": "/assets/nebula_cyber_lounge_chair.glb",
  "dining-chair": "/assets/sci-fi_chair_low_poly.glb",
  "office-chair": "/assets/nebula_cyber_lounge_chair.glb",
  "writing-desk": "/assets/work_table_futuristic.glb",
  "standing-desk": "/assets/cyberpunk_table.glb",
  "architect-desk": "/assets/geosynth_table.glb",
  "flat-tv": "/assets/large_wall-mounted_computer_console.glb",
  "arcade-cabinet": "/assets/futuristic_free-standing_terminal.glb",
  "kitchen-island": "/assets/geosynth_table.glb",
  "tool-bench": "/assets/cyberpunk_table.glb",
  "neon-floor-lamp": "/assets/overhead_light.glb",
  "ceiling-neon": "/assets/overhead_light.glb",
  "tripod-lamp": "/assets/overhead_light.glb",
  "table-lamp": "/assets/overhead_light.glb",
  pink_neon_wall: "/assets/overhead_light.glb",
  cyan_floor_light: "/assets/overhead_light.glb",
});
export type FurnitureCategory = typeof FURNITURE_CATEGORIES[number];
export type FurnitureInteraction = Readonly<{
  id: "sleep" | "sit" | "work" | "store" | "power" | "light" | "cook" | "inspect" | "craft" | "display";
  label: string;
  screen: "recovery" | "focus" | "inventory" | "farming" | "crafting" | "achievements" | "equipment";
  activity?: "sleeping" | "sitting" | "working";
  toggle?: boolean;
}>;
export type FurnitureDefinition = Readonly<{
  id: string; name: string; description: string; category: FurnitureCategory;
  width: number; depth: number; height: number; price: number; level: number; color: string;
  modelUrl?: string; neonColor: string;
  placementType?: "floor" | "wall" | "ceiling" | "wall_insert";
  cutoutSize?: readonly [width: number, height: number, depth: number];
  placementFlags?: number;
  slots?: readonly Readonly<{ hash: string; x: number; z: number; y: number }>[];
  interactions: readonly FurnitureInteraction[];
}>;

const ACTIONS = {
  bed: [{ id: "sleep", label: "Nghỉ ngơi", screen: "recovery", activity: "sleeping" }],
  seating: [{ id: "sit", label: "Ngồi thư giãn", screen: "recovery", activity: "sitting" }],
  desk: [{ id: "work", label: "Bắt đầu tập trung", screen: "focus", activity: "working" }],
  chair: [{ id: "sit", label: "Ngồi nghỉ", screen: "recovery", activity: "sitting" }],
  storage: [{ id: "store", label: "Mở kho đồ", screen: "inventory" }],
  electronics: [{ id: "power", label: "Bật / tắt thiết bị", screen: "focus", toggle: true }],
  light: [{ id: "light", label: "Bật / tắt đèn", screen: "focus", toggle: true }],
  kitchen: [{ id: "cook", label: "Chuẩn bị bữa ăn", screen: "recovery", activity: "working" }],
  decor: [{ id: "inspect", label: "Ngắm trang trí", screen: "recovery" }],
  workshop: [{ id: "craft", label: "Mở chế tạo", screen: "crafting", activity: "working" }],
  collectible: [{ id: "display", label: "Xem bộ sưu tập", screen: "achievements" }],
  doors: [{ id: "inspect", label: "Mở cửa", screen: "recovery" }],
  windows: [{ id: "inspect", label: "Nhìn qua cửa sổ", screen: "recovery" }],
} as const satisfies Record<FurnitureCategory, readonly FurnitureInteraction[]>;

function item<const Id extends string>(id: Id, name: string, category: FurnitureCategory, width: number, depth: number, height: number, price: number, level: number, color: string, description: string, interactions: readonly FurnitureInteraction[] = ACTIONS[category]): FurnitureDefinition & { readonly id: Id } {
  const assetId = resolveApartmentAssetId(id);
  const modelUrl = NEON_ASSET_URLS[id] ?? (assetId ? getApartmentAsset(assetId).url : undefined);
  const neonColor = id === "pink_neon_wall" ? "#ff00aa" : id === "cyan_floor_light" ? "#00f0ff" : id === "wall_led_strip" ? "#ff8c3b" : id.includes("lamp") || id.includes("light") ? "#ff00aa" : DEFAULT_NEON_COLOR;
  const placementType = id === "glass_door_modern" || id === "wide_window_cyber" ? "wall_insert" : id === "flat-tv" || id === "pink_neon_wall" || id === "wall_led_strip" ? "wall" : id === "ceiling-neon" ? "ceiling" : "floor";
  // The 2 m outer frame overlaps the masonry by 7 cm on each jamb; the
  // CSG aperture only removes the clear span inside that frame.
  const cutoutSize = id === "glass_door_modern" ? [1.86, 2.4, 0.25] as const : id === "wide_window_cyber" ? [1.86, 1.35, 0.19] as const : undefined;
  const slotItem = ["table-lamp", "trophy-cup", "model-rocket", "crystal-display", "holo-art"].includes(id);
  const grounded = ["cloud-bed", "platform-bed", "haven-sofa", "corner-sofa", "wardrobe", "bookcase"].includes(id);
  const placementFlags = placementType === "wall_insert" ? PlacementFlags.SNAP_TO_WALL
    : placementType === "wall"
    ? PlacementFlags.SNAP_TO_WALL | PlacementFlags.SHOW_OBJ_IF_WALL_DOWN
    : placementType === "ceiling" ? PlacementFlags.CEILING
      : slotItem ? PlacementFlags.REQUIRES_SLOT
        : PlacementFlags.FLOOR_ONLY | (grounded ? PlacementFlags.GROUNDED_AGAINST_WALL : 0);
  const slots = ["workstation", "writing-desk", "standing-desk", "architect-desk", "coffee-table", "kitchen-island", "tool-bench", "dining-table"].includes(id)
    ? Object.freeze([
      Object.freeze({ hash: "surface-left", x: -0.24, z: 0, y: height }),
      Object.freeze({ hash: "surface-right", x: 0.24, z: 0, y: height }),
    ]) : undefined;
  return Object.freeze({ id, name, category, width, depth, height, price, level, color, description, modelUrl, neonColor, placementType, cutoutSize, placementFlags, slots, interactions: Object.freeze(interactions.map(action => Object.freeze({ ...action }))) });
}

export const FURNITURE_CATALOG = Object.freeze([
  item("glass_door_modern", "Cửa kính rèm che", "doors", 2, 0.25, 2.4, 150, 1, "#84b5c8", "Cửa kính khung kim loại với rèm che riêng tư; gắn vào tường và khoét lỗ xuyên phòng."),
  item("wide_window_cyber", "Cửa sổ góc rộng", "windows", 2, 0.19, 1.35, 80, 1, "#59c8e5", "Ô kính cyberpunk rộng hai ô tường, điều chỉnh được độ cao khi lắp."),
  item("cloud-bed", "Giường đôi bọc nệm cao cấp", "bed", 2.7, 3.2, 1.65, 220, 1, "#adc0e4", "Giường đôi bọc nệm nhiều lớp, đầu giường ốp mềm và chất liệu hoàn thiện cao cấp."),
  item("platform-bed", "Giường sàn gỗ", "bed", 2.4, 3, .75, 160, 1, "#b89067", "Giường sàn thấp, khung gỗ rộng và ngăn kéo chân giường."),
  item("bunk-bed", "Giường tầng gác cao", "bed", 1.8, 3, 2.7, 390, 3, "#748a99", "Hai tầng nệm, lan can bảo vệ và thang đứng."),
  item("canopy-bed", "Giường màn bốn cột", "bed", 2.8, 3.3, 2.8, 620, 5, "#d6c2a0", "Bốn cột cao đỡ mái vải và nệm đôi."),
  item("haven-sofa", "Sofa An Yên", "seating", 2.9, 1.16, 1.25, 120, 1, "#56637e", "Sofa ba chỗ với tay vịn và đệm rời."),
  item("corner-sofa", "Sofa góc chữ L sang trọng", "seating", 3, 2.4, 1.25, 280, 2, "#71857b", "Sofa chữ L bọc vải dày, ghế dài và gối rời trong phòng khách panorama."),
  item("chaise-lounge", "Ghế dài đọc sách", "seating", 1.1, 2.3, 1.1, 175, 2, "#b27c68", "Ghế nằm dài một tay vịn với gối tựa tròn."),
  item("workstation", "Bàn làm việc Cyberpunk LED", "desk", 2.3, 1, 1.7, 180, 1, "#32e6f4", "Bàn máy tính có màn hình, bàn phím, tủ ngăn kéo và ánh sáng LED xanh."),
  item("writing-desk", "Bàn viết gỗ sồi", "desk", 1.8, .9, 1.05, 110, 1, "#aa8055", "Bàn viết chân thanh với hộc bút và sổ mở."),
  item("standing-desk", "Bàn nâng hạ", "desk", 2, 1, 1.7, 260, 3, "#d5dce3", "Bàn đứng hai trụ nâng, chân chữ T và máy tính xách tay."),
  item("architect-desk", "Bàn vẽ kiến trúc", "desk", 2.2, 1.3, 1.4, 310, 3, "#b9a484", "Bàn vẽ khung giá đỡ, bảng giấy và ống bản vẽ."),
  item("dining-chair", "Ghế ăn lưng nan", "chair", .65, .7, 1.2, 45, 1, "#a08061", "Ghế ăn bốn chân với ba thanh tựa lưng."),
  item("office-chair", "Ghế văn phòng lưới", "chair", .85, .85, 1.4, 130, 2, "#4b6074", "Ghế xoay chân sao, tay vịn và tựa đầu riêng."),
  item("bar-stool", "Ghế quầy chân trụ", "chair", .65, .65, 1.1, 75, 1, "#c69a70", "Ghế đẩu tròn chân trụ với thanh gác chân."),
  item("bookcase", "Kệ sách mở", "storage", 1.6, .55, 2.2, 155, 2, "#9e7653", "Kệ mở bốn tầng với sách đứng và sách xếp."),
  item("wardrobe", "Tủ quần áo hai cánh", "storage", 1.65, .6, 2.3, 230, 2, "#7c685a", "Tủ hai cánh cao, tay nắm dài và ngăn đáy.", [{ id: "store", label: "Mở tủ trang bị", screen: "equipment" }]),
  item("drawer-chest", "Tủ năm ngăn kéo", "storage", 1.2, .65, 1.3, 145, 2, "#bbc0bb", "Tủ thấp năm ngăn kéo có tay nắm kim loại."),
  item("flat-tv", "Kệ tivi phòng chiếu", "electronics", 2.1, .65, 1.55, 290, 3, "#4a667d", "Màn hình rộng trên kệ thấp với hai loa đứng."),
  item("arcade-cabinet", "Máy trò chơi thùng", "electronics", 1.2, 1.1, 2.1, 340, 3, "#bb649e", "Tủ trò chơi có bảng tên, màn hình, cần điều khiển và nút bấm.", [{ id: "power", label: "Bật / tắt máy", screen: "farming", toggle: true }]),
  item("stereo-tower", "Dàn âm thanh", "electronics", 1.6, .6, 1.35, 190, 2, "#9c835e", "Hai thùng loa có củ loa tròn và bộ khuếch đại ở giữa."),
  item("neon-floor-lamp", "Đèn đứng vành sáng", "light", .5, .5, 2.25, 65, 1, "#9067ff", "Đèn cột mảnh có vành sáng trên đế tròn."),
  item("tripod-lamp", "Đèn chụp ba chân", "light", .8, .8, 1.9, 95, 2, "#dfbd84", "Đèn chụp loe trên bộ chân gỗ ba nhánh."),
  item("table-lamp", "Đèn bàn hình nấm", "light", .45, .45, .65, 35, 1, "#e5bfa3", "Đèn bàn chụp vòm trên thân gốm ngắn."),
  item("ceiling-neon", "Đèn neon treo trần", "light", 1.1, 1.1, .28, 145, 1, "#ff00aa", "Đèn neon treo trần, tự động bám mặt trần và phát sáng xuống không gian.") ,
  item("pink_neon_wall", "Dải neon tường hồng", "light", 1.4, .12, 1.8, 90, 1, "#ff00aa", "Đèn neon hồng gắn tường, có thể cất kho và mua lại."),
  item("cyan_floor_light", "Đèn sàn cyan", "light", .7, .7, .18, 70, 1, "#00f0ff", "Đèn sàn cyan phát sáng viền, dùng làm điểm nhấn cyberpunk."),
  item("wall_led_strip", "Dải đèn LED ngang", "light", 2.5, .08, .12, 50, 1, "#ff8c3b", "Dải LED code-based gắn tường, phát sáng màu cam ấm và có thể di chuyển, cất kho hoặc bán lại."),
  item("kitchen-island", "Đảo bếp đá marble", "kitchen", 2, 1.1, 1.1, 210, 2, "#ddd5c5", "Đảo bếp mặt đá marble, chậu rửa, vòi và các hộc tủ hoàn thiện."),
  item("bathroom-suite", "Phòng tắm kính cao cấp", "decor", 2.5, 2.2, 2.7, 340, 1, "#a9d4e0", "Vách kính phòng tắm, lavabo và thiết bị sứ trong một module hoàn chỉnh."),
  item("coffee-table", "Bàn trà mặt đá", "decor", 1.3, .75, .55, 135, 1, "#d3c7b9", "Bàn trà thấp mặt đá tối với chân kim loại và chi tiết phản chiếu."),
  item("wool-rug", "Thảm len dệt cao cấp", "decor", 2.6, 1.8, .06, 95, 1, "#aa9393", "Thảm len dệt tạo lớp ấm dưới sofa hoặc giường."),
  item("refrigerator", "Tủ lạnh hai ngăn", "kitchen", .9, .9, 2.1, 250, 2, "#b4c4cf", "Tủ lạnh hai ngăn, tay nắm riêng và bảng nhiệt độ.", [{ id: "store", label: "Xem đồ dự trữ", screen: "inventory" }]),
  item("range-cooker", "Bếp lò bốn vùng nấu", "kitchen", 1.1, .9, 1.15, 240, 2, "#87949b", "Bếp bốn vòng nấu, bảng núm vặn và cửa lò kính."),
  item("biolume-plant", "Chậu cây phát sáng", "decor", .6, .6, 1.3, 45, 1, "#5de0b0", "Chậu cây loe với thân, tán lá nhiều tầng và chồi sáng."),
  item("wall-mirror", "Gương đứng khung vòm", "decor", .9, .4, 1.9, 85, 1, "#d0ac77", "Gương đứng khung vòm trên chân đỡ thấp."),
  item("aquarium", "Bể cá san hô", "decor", 1.4, .65, 1.3, 180, 2, "#58adb7", "Bể kính trên tủ với đá, cây thủy sinh và cá."),
  item("tool-bench", "Bàn xưởng chế tác", "workshop", 2.3, 1, 1.8, 200, 2, "#bb8951", "Bàn xưởng có bảng treo dụng cụ, ê tô và kệ dưới."),
  item("3d-printer", "Máy in 3D khung mở", "workshop", 1, 1, 1.4, 320, 3, "#6e9caa", "Máy in khung mở có trục ngang, đầu in và vật mẫu."),
  item("tool-trolley", "Xe đẩy dụng cụ", "workshop", 1.2, .7, 1.05, 140, 2, "#bc6653", "Xe dụng cụ bốn bánh, khay trên và ba hộc kéo."),
  item("holo-art", "Tượng ánh sáng đô thị", "collectible", .6, .6, 1.6, 95, 1, "#ee5acb", "Bệ lục giác đỡ tinh thể đôi phát sáng."),
  item("trophy-cup", "Cúp vô địch", "collectible", .75, .5, 1.2, 170, 2, "#e7be64", "Cúp miệng loe hai quai trên chân đế có bảng tên."),
  item("model-rocket", "Mô hình tên lửa", "collectible", .7, .7, 1.65, 185, 3, "#e0e6e9", "Mô hình tên lửa có chóp nhọn, bốn cánh và vòi đẩy."),
  item("crystal-display", "Tủ trưng bày pha lê", "collectible", 1, .7, 1.5, 230, 3, "#83d5ce", "Tủ kính có khung góc, bệ đá và cụm tinh thể ba nhánh."),
  ...LIVING_V7_CATALOG,
  ...TECH_V7_CATALOG,
  ...CRAFT_V7_CATALOG,
  ...HOME_V7_CATALOG,
] as const);

export type FurnitureModelId = typeof FURNITURE_CATALOG[number]["id"];
export const FURNITURE_MODEL_IDS: readonly FurnitureModelId[] = Object.freeze(FURNITURE_CATALOG.map(entry => entry.id));
export function getFurnitureDefinition(id: string): FurnitureDefinition | undefined { return FURNITURE_CATALOG.find(entry => entry.id === id); }
export function isFurnitureModelId(id: string): id is FurnitureModelId { return getFurnitureDefinition(id) !== undefined; }

export type FurnitureMaterial = "finish" | "wood" | "metal" | "fabric" | "cushion" | "glass" | "screen" | "glow" | "leaf" | "gold" | "dark" | "paper";
export type FurnitureVector = readonly [number, number, number];
export type FurniturePart = Readonly<{
  id: string; shape: "box" | "cylinder" | "sphere" | "cone" | "frustum" | "cup" | "ring" | "arch" | "crystal";
  position: FurnitureVector; size: FurnitureVector; material: FurnitureMaterial; roundness?: number; rotation?: FurnitureVector;
  lean?: readonly [number, number]; radialSegments?: number; surface?: "mirror" | "smoked-glass" | "display";
}>;
export type FurnitureRecipe = Readonly<{ id: FurnitureModelId; parts: readonly FurniturePart[] }>;
type Parts = FurniturePart[];
const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "finish"): FurniturePart => ({ id, shape: "box", position: [x, y, z], size: [w, h, d], material });
const round = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "metal", shape: FurniturePart["shape"] = "cylinder"): FurniturePart => ({ ...box(id, x, y, z, w, h, d, material), shape });
const legs = (y: number, h: number, x = .4, z = .36, material: FurnitureMaterial = "wood"): Parts => [-1, 1].flatMap(sx => [-1, 1].map(sz => box(`leg-${sx}-${sz}`, sx * x, y, sz * z, .07, h, .07, material)));
const drawers = (count: number, x: number, z: number, width: number, bottom: number, height: number): Parts => Array.from({ length: count }, (_, i) => [box(`drawer-${i}`, x, bottom + height * (i + .5), z, width, height * .83, .06), box(`handle-${i}`, x, bottom + height * (i + .5), z + .025, width * .3, .018, .03, "metal")]).flat();
const soft = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: FurnitureMaterial = "cushion"): FurniturePart => ({ ...box(id, x, y, z, w, h, d, material), roundness: .32 });
const piping = (id: string, x: number, y: number, z: number, w: number, d: number, material: FurnitureMaterial = "paper"): Parts => [
  ...[-1, 1].map(s => soft(`${id}-side-${s}`, x + s * (w / 2 - .008), y, z, .016, .012, d - .024, material)),
  ...[-1, 1].map(s => soft(`${id}-end-${s}`, x, y, z + s * (d / 2 - .008), w - .024, .012, .016, material)),
];
const mattress = (y: number, width = .9): Parts => [
  soft(`mattress-${y}`, 0, y, 0, width, .12, .88),
  soft(`blanket-${y}`, 0, y + .075, .15, width - .02, .065, .56, "fabric"),
  soft(`duvet-fold-${y}`, 0, y + .11, -.1, width - .035, .055, .12, "fabric"),
  ...[-1, 1].flatMap(s => [
    soft(`pillow-${y}-${s}`, s * .21, y + .105, -.3, .37, .11, .2, "paper"),
    ...piping(`pillow-seam-${y}-${s}`, s * .21, y + .1, -.3, .37, .2, "cushion"),
  ]),
];
const caseFrame = (): Parts => [box("back", 0, .5, -.45, 1, 1, .08, "wood"), ...[-1, 1].map(s => box(`side-${s}`, s * .47, .5, 0, .06, 1, 1, "wood"))];

// GLB-only catalog entries do not need a procedural recipe. A total Record
// made this lookup look safe to TypeScript even when it was missing at runtime.
const recipes: Partial<Record<FurnitureModelId, () => readonly FurniturePart[]>> = {
  "glass_door_modern": () => [
    ...[-1, 1].map(side => box(`frame-${side}`, side * .47, .5, 0, .055, 1, .34, "metal")),
    box("lintel", 0, .98, 0, .99, .04, .34, "metal"),
    box("threshold", 0, .015, 0, .99, .03, .34, "metal"),
    box("glass-pane", 0, .5, 0, .88, .91, .07, "glass"),
    box("curtain", -.32, .5, -.1, .18, .83, .025, "fabric"),
    box("handle", .12, .46, .1, .11, .018, .025, "gold"),
  ],
  "wide_window_cyber": () => [
    ...[-1, 1].map(side => box(`jamb-${side}`, side * .47, .5, 0, .055, 1, .34, "metal")),
    box("head", 0, .98, 0, .99, .04, .34, "metal"),
    box("sill", 0, .02, 0, .99, .04, .34, "metal"),
    box("pane", 0, .5, 0, .88, .9, .06, "glass"),
    box("center-mullion", 0, .5, .065, .025, .88, .04, "metal"),
    box("neon-top", 0, .94, .15, .86, .018, .025, "glow"),
  ],
  ...LIVING_V7_RECIPES,
  ...TECH_V7_RECIPES,
  ...CRAFT_V7_RECIPES,
  ...HOME_V7_RECIPES,
  "cloud-bed": () => [
    ...legs(.055, .11, .38, .38, "dark"), soft("frame", 0, .21, 0, .97, .22, .98, "fabric"),
    box("recessed-plinth", 0, .105, 0, .84, .1, .84, "wood"), ...mattress(.4),
    soft("headboard", 0, .65, -.45, 1, .7, .1, "fabric"),
    ...[-.32, 0, .32].flatMap((x, i) => [soft(`head-pad-${i}`, x, .71, -.38, .3, .5, .08), box(`head-seam-${i}`, x, .71, -.335, .008, .34, .012, "fabric")]),
    soft("foot-welt", 0, .28, .486, .87, .018, .02, "cushion"),
  ],
  "platform-bed": () => [
    box("platform", 0, .23, 0, 1, .21, 1, "wood"), ...legs(.065, .13), ...mattress(.5, .84),
    ...drawers(1, 0, .46, .7, .14, .16), box("low-head", 0, .75, -.46, .9, .5, .06, "wood"),
    ...[-1, 1].map(s => box(`head-support-${s}`, s * .35, .42, -.46, .055, .65, .06, "wood")),
    box("drawer-recess", 0, .235, .497, .24, .025, .006, "dark"), box("bedside-ledge", .365, .67, -.29, .15, .045, .21, "wood"),
  ],
  "bunk-bed": () => [
    ...legs(.5, 1, .44, .44, "metal"), ...mattress(.2, .8), ...mattress(.72, .8),
    ...[.13, .65].map(y => box(`deck-${y}`, 0, y, 0, .9, .05, .94, "wood")),
    ...[-1, 1].flatMap(s => [box(`guard-${s}`, s * .43, .92, 0, .04, .05, .9), box(`guard-post-${s}`, s * .43, .84, 0, .025, .18, .03, "metal")]),
    ...[-.3, -.12].map(x => box(`ladder-rail-${x}`, x, .48, .46, .035, .93, .035, "metal")),
    ...[.15, .3, .45, .6, .75].map(y => box(`rung-${y}`, -.21, y, .46, .18, .025, .065, "wood")),
    box("end-brace", 0, .92, -.44, .88, .05, .04, "metal"),
  ],
  "canopy-bed": () => [
    ...legs(.5, 1, .45, .45), box("bed-frame", 0, .15, 0, .95, .2, .95, "wood"), ...mattress(.3),
    soft("canopy", 0, .97, 0, 1, .06, 1, "fabric"), soft("headboard", 0, .37, -.46, .85, .55, .06, "wood"),
    ...[-1, 1].flatMap(s => [
      soft(`curtain-${s}`, s * .43, .76, -.4, .1, .39, .14, "paper"),
      box(`canopy-rail-${s}`, s * .45, .93, 0, .055, .055, .94, "wood"),
      box(`curtain-tie-${s}`, s * .43, .64, -.4, .105, .025, .145, "gold"),
      box(`head-slat-${s}`, s * .24, .4, -.42, .02, .38, .025, "gold"),
    ]),
    box("front-canopy-rail", 0, .93, .45, .94, .055, .055, "wood"),
  ],
  "haven-sofa": () => [
    ...legs(.09, .18), soft("base", 0, .3, 0, .98, .28, .95, "fabric"), soft("back", 0, .7, -.38, 1, .6, .2, "fabric"),
    ...[-1, 1].flatMap(s => [soft(`arm-${s}`, s * .45, .53, 0, .1, .45, 1, "fabric"), box(`arm-welt-${s}`, s * .45, .57, .492, .065, .018, .012, "cushion")]),
    ...[-.29, 0, .29].flatMap((x, i) => [
      soft(`seat-${i}`, x, .51, .07, .27, .16, .67), soft(`back-cushion-${i}`, x, .76, -.225, .27, .39, .16),
      box(`seat-welt-${i}`, x, .5, .406, .23, .012, .012, "paper"),
    ]),
    soft("throw-pillow", -.27, .7, .02, .22, .25, .19, "fabric"), box("under-seat-rail", 0, .17, .36, .83, .045, .05, "wood"),
  ],
  "corner-sofa": () => [
    ...[-.4, .38].flatMap(x => [-.36, .035].map(z => box(`leg-${x}-${z}`, x, .12, z, .08, .24, .08, "wood"))), soft("long-seat", 0, .37, -.18, 1, .3, .59, "fabric"), soft("return-seat", .31, .37, .23, .38, .3, .54, "fabric"),
    soft("back", 0, .73, -.43, 1, .54, .14, "fabric"), soft("return-back", .44, .73, .04, .12, .54, .8, "fabric"),
    ...[-.3, 0, .3].flatMap(x => [soft(`pad-${x}`, x, .57, -.12, .28, .14, .4), soft(`back-pad-${x}`, x, .77, -.31, .28, .36, .12)]),
    soft("chaise-pad", .3, .57, .3, .3, .14, .33), ...piping("chaise-welt", .3, .56, .3, .3, .33),
    soft("corner-bolster", .32, .76, .15, .16, .26, .43, "cushion"),
    box("return-foot", .3, .12, .4, .18, .24, .08, "wood"), soft("left-arm", -.45, .62, -.14, .1, .28, .57, "fabric"),
  ],
  "chaise-lounge": () => [
    ...legs(.12, .24), soft("chaise-base", 0, .35, 0, .85, .24, 1, "wood"), soft("long-cushion", 0, .53, .05, .85, .18, .85),
    soft("head-rest", 0, .77, -.39, .9, .46, .22, "fabric"), soft("single-arm", -.44, .58, -.15, .12, .36, .65, "fabric"),
    round("bolster", 0, .7, -.22, .75, .2, .16, "cushion", "sphere"), ...piping("seat-seam", 0, .52, .05, .85, .85),
    ...[-1, 1].map(s => round(`bolster-button-${s}`, s * .345, .7, -.22, .035, .085, .07, "fabric", "sphere")),
    box("side-stretcher", .39, .2, 0, .035, .06, .78, "wood"), soft("head-pad", .04, .83, -.26, .65, .27, .08),
  ],
  "workstation": () => [
    soft("desktop", 0, .5, 0, 1, .055, 1, "wood"), ...legs(.24, .48, .44, .38, "metal"), box("cabinet", .33, .25, 0, .24, .45, .8), ...drawers(3, .33, .4, .21, .05, .13),
    box("monitor-foot", 0, .545, -.25, .28, .025, .23, "metal"), box("monitor-post", 0, .66, -.25, .05, .3, .06, "metal"),
    soft("monitor", 0, .84, -.28, .65, .32, .06, "dark"), box("display", 0, .84, -.245, .6, .27, .01, "screen"),
    soft("keyboard", -.1, .55, .2, .4, .025, .24, "dark"), ...[-.07, 0, .07].map(z => box(`key-row-${z}`, -.1, .565, .2 + z, .35, .008, .035, "metal")),
    round("mouse", .2, .55, .2, .07, .03, .12, "metal", "sphere"), box("mouse-mat", .2, .533, .2, .18, .008, .28, "fabric"),
    box("cable-tray", -.08, .43, -.32, .62, .05, .18, "dark"), box("cable-spine", -.32, .24, -.38, .035, .43, .04, "dark"),
    round("grommet", -.33, .533, -.33, .07, .012, .07, "dark"), box("monitor-cable", 0, .67, -.322, .018, .27, .015, "dark"),
    box("rear-stretcher", 0, .16, -.38, .86, .045, .04, "metal"),
  ],
  "writing-desk": () => [
    ...legs(.37, .74), soft("top", 0, .77, 0, 1, .07, 1, "wood"), box("pigeonhole", 0, .9, -.46, .9, .2, .06, "wood"),
    box("organizer-shelf", 0, .89, -.32, .9, .025, .27, "wood"),
    ...[-.43, -.14, .14, .43].map(x => box(`divider-${x}`, x, .9, -.32, .025, .2, .27, "wood")),
    box("apron", 0, .67, -.35, .8, .15, .05, "wood"), ...drawers(1, 0, .4, .64, .61, .11),
    box("notebook", -.16, .82, .1, .35, .025, .4, "paper"), box("book-spine", -.16, .837, .1, .012, .008, .38, "fabric"),
    round("pen-cup", .3, .85, .05, .12, .09, .12, "metal"), round("cup-opening", .3, .898, .05, .09, .006, .09, "dark"),
    ...[-1, 1].map(s => round(`pen-${s}`, .3 + s * .023, .92, .05, .012, .14, .012, "wood")),
    box("lower-stretcher", 0, .22, -.35, .8, .04, .045, "wood"),
  ],
  "standing-desk": () => [
    soft("top", 0, .78, 0, 1, .05, 1, "wood"),
    ...[-1, 1].flatMap(s => [
      soft(`foot-${s}`, s * .35, .035, 0, .2, .07, .85, "metal"), box(`lift-${s}`, s * .35, .3, 0, .11, .55, .2, "metal"),
      box(`lift-inner-${s}`, s * .35, .6, 0, .075, .31, .14, "metal"), box(`collar-${s}`, s * .35, .53, 0, .12, .055, .21, "dark"),
      box(`top-support-${s}`, s * .35, .737, 0, .12, .035, .67, "metal"),
    ]),
    box("crossbar", 0, .68, 0, .7, .07, .1, "metal"), soft("laptop-base", 0, .82, 0, .4, .025, .4, "metal"),
    box("laptop-screen", 0, .91, -.17, .4, .18, .03, "screen"), box("laptop-hinge", 0, .83, -.17, .36, .025, .035, "dark"),
    box("trackpad", 0, .836, .11, .12, .006, .08, "dark"), box("keybed", 0, .836, -.02, .33, .006, .12, "dark"),
    box("height-control", .35, .743, .46, .16, .035, .06, "dark"), box("height-readout", .34, .743, .493, .075, .018, .006, "screen"),
    box("cable-tray", 0, .7, -.32, .58, .05, .2, "dark"), box("cable-sleeve", -.3, .45, -.32, .03, .47, .035, "dark"),
  ],
  "architect-desk": () => [
    soft("drawing-board", 0, .72, 0, 1, .08, .88, "wood"),
    ...[-1, 1].flatMap(s => [box(`trestle-foot-${s}`, s * .33, .04, 0, .13, .08, .85, "wood"), box(`trestle-post-${s}`, s * .33, .37, 0, .08, .66, .12, "wood"), box(`trestle-top-${s}`, s * .33, .65, 0, .08, .08, .7, "wood"), round(`height-pin-${s}`, s * .33, .53, .075, .06, .045, .045, "metal", "sphere")]),
    box("lower-brace", 0, .25, 0, .68, .07, .08, "wood"), box("drawing", -.08, .768, 0, .65, .015, .65, "paper"),
    box("ruler", .33, .79, 0, .03, .02, .8, "metal"), box("ruler-head", .33, .795, -.35, .23, .025, .04, "metal"),
    box("pencil-ledge", 0, .79, .415, .85, .045, .045, "wood"), round("plan-tube", -.4, .87, -.32, .1, .26, .1, "paper"),
    round("tube-rim", -.4, .985, -.32, .105, .025, .105, "wood"), round("tube-opening", -.4, .999, -.32, .075, .002, .075, "dark"),
    ...[-1, 1].map(s => box(`paper-clip-${s}`, s * .23, .782, -.3, .08, .012, .035, "metal")),
  ],
  "dining-chair": () => [
    ...legs(.23, .46, .36, .35), soft("seat", 0, .49, .02, .96, .08, .9, "cushion"),
    ...[-.4, .4].map(x => box(`back-post-${x}`, x, .73, -.4, .08, .54, .08, "wood")),
    ...[-.22, 0, .22].map(x => box(`back-slat-${x}`, x, .76, -.4, .08, .39, .06, "wood")),
    box("lower-back-rail", 0, .56, -.4, .88, .08, .08, "wood"), box("crest", 0, .97, -.4, .88, .06, .08, "wood"),
  ],
  "office-chair": () => [
    round("lift", 0, .27, 0, .12, .4, .12), round("hub", 0, .1, 0, .2, .09, .2),
    ...Array.from({ length: 5 }, (_, i) => i).flatMap(i => {
      const angle = i * Math.PI * 2 / 5;
      return [{ ...box(`spoke-${i}`, Math.sin(angle) * .21, .09, Math.cos(angle) * .21, .065, .065, .42, "metal"), rotation: [0, angle, 0] as FurnitureVector },
        round(`caster-${i}`, Math.sin(angle) * .4, .045, Math.cos(angle) * .4, .12, .09, .12, "dark", "sphere")];
    }),
    soft("seat", 0, .46, 0, .7, .12, .7, "cushion"),
    ...[-1, 1].map(s => soft(`frame-side-${s}`, s * .3, .72, -.32, .055, .43, .075, "dark")),
    ...[.53, .91].map((y, i) => soft(`frame-${i ? "top" : "bottom"}`, 0, y, -.32, .65, .055, .075, "dark")),
    ...Array.from({ length: 7 }, (_, i) => box(`mesh-warp-${i}`, -.24 + i * .08, .72, -.32, .012, .36, .016, "fabric")),
    ...Array.from({ length: 7 }, (_, i) => box(`mesh-weft-${i}`, 0, .565 + i * .05, -.31, .57, .012, .016, "fabric")),
    box("headrest-post", 0, .925, -.32, .08, .09, .05, "metal"), soft("headrest", 0, .96, -.3, .4, .08, .13, "cushion"),
    ...[-1, 1].flatMap(s => [box(`arm-post-${s}`, s * .33, .54, .04, .05, .2, .07, "metal"), soft(`arm-pad-${s}`, s * .35, .64, 0, .13, .05, .45, "fabric")]),
  ],
  "bar-stool": () => [round("disc-base", 0, .045, 0, 1, .09, 1), round("pedestal", 0, .4, 0, .14, .75, .14), round("seat", 0, .89, 0, .9, .16, .9, "cushion"), box("foot-rest", 0, .3, .3, .6, .04, .07, "metal"), box("foot-brace", 0, .3, .15, .05, .04, .3, "metal")],
  "bookcase": () => [...caseFrame(), ...[.035, .33, .65, .97].map(y => box(`shelf-${y}`, 0, y, 0, 1, .06, 1, "wood")), ...Array.from({ length: 6 }, (_, i) => box(`book-${i}`, -.35 + i * .1, .47, .05, .07, .2 + (i % 3) * .02, .5, i % 2 ? "paper" : "finish")), ...[.71, .77, .83].map(y => box(`stack-${y}`, .22, y, .08, .33, .05, .5, "paper"))],
  "wardrobe": () => [...caseFrame(), box("top", 0, .97, 0, 1, .06, 1, "wood"), ...[-1, 1].flatMap(s => [box(`door-${s}`, s * .24, .6, .44, .46, .75, .06), box(`pull-${s}`, s * .05, .58, .49, .015, .16, .02, "metal")]), ...drawers(1, 0, .44, .9, .03, .17)],
  "drawer-chest": () => [...caseFrame(), box("top", 0, .97, 0, 1, .06, 1, "wood"), ...drawers(5, 0, .43, .9, .03, .18)],
  "flat-tv": () => [box("console", 0, .2, 0, 1, .32, 1, "wood"), ...legs(.04, .08), box("screen-stand", 0, .48, -.12, .06, .25, .1, "metal"), box("screen-frame", 0, .73, -.16, .84, .54, .08, "dark"), box("picture", 0, .73, -.115, .78, .47, .01, "screen"), ...[-1, 1].map(s => box(`speaker-${s}`, s * .41, .48, .25, .12, .22, .25, "dark")), box("media-slot", 0, .22, .49, .45, .1, .015, "dark")],
  "arcade-cabinet": () => [
    box("base", 0, .24, 0, .9, .48, .85, "dark"),
    ...[-1, 1].flatMap(s => [box(`side-${s}`, s * .46, .25, -.03, .08, .5, .88), box(`upper-side-${s}`, s * .46, .74, -.11, .08, .48, .64)]),
    box("backboard", 0, .72, -.38, .86, .5, .08, "dark"), box("bezel", 0, .7, .22, .86, .39, .08, "dark"),
    { ...box("screen", 0, .7, .266, .74, .29, .012, "screen"), surface: "display" },
    box("marquee-housing", 0, .94, .13, .9, .12, .32, "dark"),
    { ...box("marquee", 0, .94, .297, .8, .08, .014, "screen"), surface: "display" },
    ...[-.25, -.125, 0, .125, .25].map((x, i) => box(`marquee-glyph-${i}`, x, .94, .31, .045, .044, .01, "paper")),
    box("screen-horizon", 0, .645, .276, .62, .012, .006, "glow"), box("screen-player", -.1, .71, .277, .06, .035, .008, "paper"),
    ...[-.2, 0, .2].map(x => box(`screen-target-${x}`, x, .79, .277, .065, .025, .008, "glow")),
    box("control-deck", 0, .5, .28, .9, .07, .44, "metal"), round("joystick", -.2, .59, .29, .04, .14, .04),
    round("joystick-knob", -.2, .66, .29, .12, .07, .12, "finish", "sphere"),
    ...[.12, .28].map(x => round(`button-${x}`, x, .55, .3, .09, .03, .09, "glow")), box("coin-slot", 0, .28, .43, .12, .06, .02, "metal"),
  ],
  "stereo-tower": () => [...[-1, 1].flatMap(s => [box(`speaker-case-${s}`, s * .34, .5, 0, .32, 1, .9, "wood"), ...[.28, .7].map(y => round(`driver-${s}-${y}`, s * .34, y, .44, .23, .23, .08, "dark", "sphere"))]), box("amplifier", 0, .18, 0, .3, .36, .75, "metal"), box("meter", 0, .25, .39, .23, .09, .02, "screen"), ...[-.08, .08].map(x => round(`dial-${x}`, x, .12, .4, .06, .06, .05, "metal", "sphere"))],
  "neon-floor-lamp": () => [round("base", 0, .025, 0, 1, .05, 1, "dark"), round("pole", 0, .48, 0, .1, .92, .1), round("light-ring", 0, .94, 0, 1, .08, 1, "glow"), round("cap", 0, .99, 0, .8, .02, .8)],
  "tripod-lamp": () => [
    ...[-.32, .32].map(x => ({ ...box(`front-leg-${x}`, x / 2, .36, .11, .065, .72, .065, "wood"), lean: [-x, -.22] as const })),
    { ...box("rear-leg", 0, .36, -.175, .065, .72, .065, "wood"), lean: [0, .35] as const },
    round("hub", 0, .7, 0, .19, .06, .19, "metal"), round("socket", 0, .755, 0, .08, .09, .08, "metal"),
    round("shade", 0, .82, 0, .95, .36, .95, "fabric", "frustum"),
    round("shade-bottom-hem", 0, .642, 0, .95, .012, .95, "paper", "ring"),
    round("shade-top-hem", 0, .994, 0, .57, .012, .57, "paper", "ring"),
    ...[-1, 1].map(s => box(`shade-spoke-${s}`, s * .195, .79, 0, .39, .012, .018, "metal")),
    round("bulb", 0, .795, 0, .16, .07, .16, "glow", "sphere"),
  ],
  "table-lamp": () => [round("base", 0, .06, 0, .7, .12, .7), round("ceramic-stem", 0, .38, 0, .24, .52, .24, "finish"), round("dome", 0, .78, 0, 1, .44, 1, "fabric", "sphere"), round("diffuser", 0, .62, 0, .75, .04, .75, "glow")],
  "kitchen-island": () => [box("cabinet", 0, .42, 0, .93, .84, .92, "wood"), box("counter", 0, .87, 0, 1, .06, 1, "paper"), box("sink", -.22, .91, 0, .32, .03, .55, "metal"), box("sink-well", -.22, .93, 0, .26, .015, .44, "dark"), box("tap-post", -.22, .95, -.3, .025, .1, .025, "metal"), box("tap-spout", -.22, .99, -.2, .025, .02, .22, "metal"), box("chopping-board", .26, .92, .03, .3, .03, .5, "wood"), ...drawers(2, .22, .46, .36, .12, .32)],
  "refrigerator": () => [box("body", 0, .5, -.02, 1, 1, .96, "metal"), box("freezer-door", 0, .8, .46, .94, .36, .06), box("fridge-door", 0, .3, .46, .94, .57, .06), ...[.43, .71].map(y => box(`handle-${y}`, -.33, y, .495, .035, .18, .01, "dark")), box("temperature", .13, .8, .495, .25, .1, .01, "screen")],
  "range-cooker": () => [
    box("oven", 0, .44, -.05, 1, .88, .9, "metal"),
    ...[-1, 1].map(s => box(`door-side-${s}`, s * .435, .38, .44, .13, .64, .08, "metal")),
    ...[.095, .665].map(y => box(`door-rail-${y}`, 0, y, .44, .75, .07, .08, "metal")),
    box("oven-cavity", 0, .38, .408, .75, .51, .02, "dark"),
    { ...box("oven-window", 0, .38, .452, .75, .51, .028, "glass"), surface: "smoked-glass" },
    ...[-1, 1].map(s => box(`handle-mount-${s}`, s * .29, .665, .475, .05, .04, .04, "dark")),
    box("oven-handle", 0, .665, .485, .7, .035, .03, "metal"),
    box("control-panel", 0, .79, .425, .97, .16, .05, "dark"), box("hob", 0, .9, 0, 1, .04, 1, "dark"),
    ...[-1, 1].flatMap(x => [-1, 1].map(z => round(`burner-${x}-${z}`, x * .25, .94, z * .24, .28, .04, .3, "metal"))),
    ...[-.3, -.1, .1, .3].flatMap(x => [round(`knob-${x}`, x, .79, .465, .12, .1, .07, "metal", "sphere"), box(`knob-marker-${x}`, x, .81, .497, .012, .03, .006, "dark")]),
  ],
  "biolume-plant": () => [round("pot", 0, .18, 0, .78, .36, .78, "wood"), round("soil", 0, .365, 0, .68, .02, .68, "dark"), round("stem", 0, .62, 0, .06, .5, .06, "leaf"), ...Array.from({ length: 6 }, (_, i) => round(`leaf-${i}`, Math.sin(i * 2) * .2, .5 + i * .075, Math.cos(i * 2) * .2, .38, .2, .3, "leaf", "sphere")), round("bud", 0, .96, 0, .12, .08, .12, "glow", "sphere")],
  "wall-mirror": () => [
    box("foot", 0, .04, 0, 1, .08, 1, "wood"), box("stand", 0, .16, -.03, .16, .2, .2, "gold"),
    round("frame", 0, .535, 0, .94, .93, .25, "gold", "arch"),
    { ...round("mirror", 0, .535, .13, .81, .855, .018, "metal", "arch"), surface: "mirror" },
  ],
  "aquarium": () => [box("stand", 0, .24, 0, 1, .48, 1, "wood"), box("sand", 0, .52, 0, .92, .06, .9, "paper"), ...[-1, 1].map(s => box(`glass-side-${s}`, s * .47, .75, 0, .03, .45, .94, "glass")), ...[-1, 1].map(s => box(`glass-face-${s}`, 0, .75, s * .47, .94, .45, .03, "glass")), box("lid", 0, .98, 0, 1, .04, 1, "dark"), round("rock", -.27, .61, 0, .24, .14, .35, "metal", "sphere"), ...[-.1, .1].map(x => box(`water-plant-${x}`, x, .66, -.22, .04, .25, .12, "leaf")), round("fish", .2, .76, .1, .2, .09, .1, "gold", "sphere"), box("fish-tail", .33, .76, .1, .06, .14, .03, "gold")],
  "tool-bench": () => [...legs(.25, .5, .43, .38, "metal"), box("worktop", 0, .53, 0, 1, .06, 1, "wood"), box("lower-shelf", 0, .15, 0, .9, .05, .85, "wood"), box("pegboard", 0, .8, -.45, 1, .4, .06, "dark"), ...[-.3, -.1, .1].flatMap(x => [box(`tool-shaft-${x}`, x, .79, -.4, .025, .23, .03, "metal"), box(`tool-head-${x}`, x, .9, -.4, .09, .04, .04, "metal")]), box("vice", .3, .63, .25, .18, .15, .3, "metal"), box("vice-jaw", .3, .72, .32, .23, .03, .06, "dark")],
  "3d-printer": () => [box("base", 0, .07, 0, 1, .14, 1, "dark"), ...[-1, 1].map(s => box(`upright-${s}`, s * .43, .57, 0, .08, .86, .12, "metal")), box("top-rail", 0, .96, 0, .94, .08, .14, "metal"), box("gantry", 0, .65, 0, .86, .06, .12, "metal"), box("extruder", .12, .59, 0, .15, .16, .23), round("nozzle", .12, .49, 0, .04, .05, .04, "gold", "cone"), box("print-bed", 0, .2, .02, .7, .05, .75, "metal"), round("print-object", 0, .32, .02, .25, .2, .25, "finish", "cone"), box("control-screen", .26, .15, .4, .24, .07, .15, "screen")],
  "tool-trolley": () => [...[-1, 1].flatMap(x => [-1, 1].map(z => round(`caster-${x}-${z}`, x * .35, .07, z * .35, .14, .14, .14, "dark", "sphere"))), box("chest", 0, .51, 0, .9, .74, .85), ...drawers(3, 0, .43, .8, .2, .2), box("tray-bottom", 0, .9, 0, 1, .04, 1, "metal"), ...[-1, 1].map(s => box(`tray-rim-${s}`, s * .47, .96, 0, .06, .08, 1, "metal")), box("tray-back", 0, .96, -.47, .94, .08, .06, "metal")],
  "holo-art": () => [
    { ...round("plinth", 0, .1, 0, .92, .2, .92, "dark"), radialSegments: 6 },
    { ...round("plinth-cap", 0, .21, 0, .84, .04, .84, "metal"), radialSegments: 6 },
    ...[-1, 1].flatMap((s, i) => [round(`mount-${i}`, s * .2, .3, 0, .11, .18, .11, "metal"),
      round(`crystal-${i}`, s * .2, i ? .58 : .66, 0, .29, i ? .56 : .68, .38, "glow", "crystal")]),
  ],
  "trophy-cup": () => [
    box("base", 0, .07, 0, .8, .14, .9, "dark"), box("plaque", 0, .08, .46, .38, .07, .02, "gold"),
    round("stem", 0, .32, 0, .15, .36, .15, "gold"), round("bowl", 0, .65, 0, .62, .4, .7, "gold", "cup"),
    round("rim", 0, .85, 0, .65, .035, .73, "gold", "ring"),
    ...[-1, 1].flatMap(s => [soft(`handle-side-${s}`, s * .44, .68, 0, .06, .3, .1, "gold"),
      box(`handle-lower-${s}`, s * .285, .55, 0, .35, .045, .1, "gold"), box(`handle-upper-${s}`, s * .36, .81, 0, .24, .045, .1, "gold")]),
  ],
  "model-rocket": () => [round("launch-pad", 0, .04, 0, 1, .08, 1, "dark"), round("engine", 0, .16, 0, .28, .16, .28, "metal"), round("fuselage", 0, .53, 0, .4, .64, .4, "paper"), round("nose", 0, .92, 0, .4, .16, .4, "finish", "cone"), box("fin-x", 0, .28, 0, .85, .25, .06), box("fin-z", 0, .28, 0, .06, .25, .85), round("porthole", 0, .65, .2, .18, .1, .04, "screen", "sphere")],
  "crystal-display": () => [box("plinth", 0, .15, 0, 1, .3, 1, "dark"), ...legs(.63, .74, .46, .46, "metal"), box("top", 0, .98, 0, 1, .04, 1, "metal"), ...[-1, 1].map(s => box(`glass-side-${s}`, s * .47, .64, 0, .02, .64, .9, "glass")), ...[-1, 1].map(s => box(`glass-front-${s}`, 0, .64, s * .47, .9, .64, .02, "glass")), ...[-.22, 0, .22].map((x, i) => round(`crystal-${i}`, x, .5 + (i % 2) * .1, 0, .2, .35 + (i % 2) * .2, .3, "glow", "cone"))],
  "ceiling-neon": () => [
    box("ceiling-mount", 0, .06, 0, .62, .12, .62, "dark"),
    box("ceiling-diffuser", 0, .18, 0, .9, .1, .9, "glow"),
    box("ceiling-led-x", 0, .235, 0, .78, .025, .06, "glow"),
    box("ceiling-led-z", 0, .235, 0, .06, .025, .78, "glow"),
  ],
  "pink_neon_wall": () => [
    box("wall-backplate", 0, .5, -.42, .92, .9, .08, "dark"),
    box("wall-neon-core", 0, .5, .03, .68, .82, .04, "glow"),
    box("wall-neon-top", 0, .91, .05, .76, .025, .05, "glow"),
    box("wall-neon-bottom", 0, .09, .05, .76, .025, .05, "glow"),
  ],
  "cyan_floor_light": () => [
    box("floor-base", 0, .08, 0, .92, .16, .92, "dark"),
    round("floor-diffuser", 0, .17, 0, .82, .08, .82, "glow", "cylinder"),
    box("floor-led-x", 0, .22, 0, .78, .025, .05, "glow"),
    box("floor-led-z", 0, .22, 0, .05, .025, .78, "glow"),
  ],
  "wall_led_strip": () => [
    box("backplate", 0, .5, -.42, 1, .75, .08, "dark"),
    box("led-bar", 0, .5, .02, 1, .12, .08, "glow"),
    box("led-diffuser", 0, .5, .07, .96, .055, .018, "glow"),
    ...[-1, 1].map(side => box(`end-cap-${side}`, side * .48, .5, .055, .02, .14, .1, "metal")),
  ],
  "bathroom-suite": () => [box("floor", 0, .025, 0, 1, .05, 1, "dark"), ...[-1,1].map(x => box(`glass-${x}`, x*.48, .5, 0, .025, .9, 1, "glass")), box("vanity", -.25, .31, -.35, .3, .42, .22, "wood"), box("basin", -.25, .55, -.35, .29, .06, .22, "paper")],
  "coffee-table": () => [box("marble-top", 0, .8, 0, .95, .12, .9, "paper"), ...legs(.37, .72, .4, .37, "metal"), box("led-edge", 0, .72, .46, .9, .025, .02, "glow")],
  "wool-rug": () => [
    soft("woven-rug", 0, .5, 0, 1, .8, 1, "fabric"),
    box("weave-left", -.45, .5, 0, .04, .3, .92, "wood"),
    box("weave-right", .45, .5, 0, .04, .3, .92, "wood"),
    box("weave-front", 0, .5, .45, .9, .3, .04, "wood"),
    box("weave-back", 0, .5, -.45, .9, .3, .04, "wood"),
  ],
};

export function getFurnitureRecipe(id: string): FurnitureRecipe | undefined {
  if (!isFurnitureModelId(id)) return undefined;
  const makeParts = recipes[id];
  if (typeof makeParts !== "function") return undefined;
  const definition = getFurnitureDefinition(id)!;
  const scale = [definition.width, definition.height, definition.depth] as const;
  const parts = makeParts().map(part => ({ ...part, ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}), position: part.position.map((value, i) => value * scale[i]) as [number, number, number], size: part.size.map((value, i) => value * scale[i]) as [number, number, number] }));
  return { id, parts };
}

export function getFurniturePartBounds(part: FurniturePart): { min: FurnitureVector; max: FurnitureVector } {
  const half = [part.size[0] / 2 + Math.abs(part.lean?.[0] ?? 0) / 2, part.size[1] / 2, part.size[2] / 2 + Math.abs(part.lean?.[1] ?? 0) / 2];
  const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  const rows = [[c * e, -c * f, d], [a * f + b * e * d, a * e - b * f * d, -b * c], [b * f - a * e * d, b * e + a * f * d, a * c]];
  const extent = rows.map(row => row.reduce((sum, value, i) => sum + Math.abs(value) * half[i], 0));
  return { min: part.position.map((value, i) => value - extent[i]) as [number, number, number], max: part.position.map((value, i) => value + extent[i]) as [number, number, number] };
}

export function furnitureGeometrySignature(id: string): string | undefined {
  const recipe = getFurnitureRecipe(id);
  const definition = getFurnitureDefinition(id);
  if (!recipe || !definition) return undefined;
  const scale = [definition.width, definition.height, definition.depth];
  return JSON.stringify(recipe.parts.map(part => ({ shape: part.shape, ...(part.roundness ? { roundness: part.roundness } : {}), ...(part.rotation ? { rotation: part.rotation } : {}), ...(part.lean ? { lean: [part.lean[0] / scale[0], part.lean[1] / scale[2]] } : {}), ...(part.radialSegments ? { radialSegments: part.radialSegments } : {}), position: part.position.map((value, i) => Number((value / scale[i]).toFixed(6))), size: part.size.map((value, i) => Number((value / scale[i]).toFixed(6))) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export const LEGACY_FURNITURE_IDS = ["haven-sofa", "workstation", "neon-floor-lamp", "biolume-plant", "cloud-bed", "holo-art"] as const satisfies readonly FurnitureModelId[];
export const INITIAL_FURNITURE_MODEL_COUNT = FURNITURE_CATALOG.length;
export const FURNITURE_MODEL_TARGET = 129;
export const FURNITURE_MODEL_PROGRESS = Object.freeze({ implemented: INITIAL_FURNITURE_MODEL_COUNT, target: FURNITURE_MODEL_TARGET });
