import type { CosmeticDefinition, ModularAppearance } from "./types";
import { LOWER_V7_COSMETICS } from "./fashion-lower-v7";
import { UPPER_V7_COSMETICS } from "./fashion-upper-v7";
import { STARTER_POLO_V7_COSMETICS } from "./starter-polo-v7";
import { ACCESSORY_V7_COSMETICS } from "./fashion-accessory-v7";

export const DEFAULT_APPEARANCE: ModularAppearance = { presentation: "neutral", body: "balanced", face: "oval", eyes: "focused", eyeColor: "#82dce5", eyebrows: "natural", nose: "straight", mouth: "neutral", height: 1, shoulderWidth: 1, facePreset: 0, eyePreset: 0, browPreset: 0, nosePreset: 0, earPreset: 0, mouthPreset: 0, hairPreset: 0, beard: false, tattoos: false, piercings: false, cyberware: false };

export const COSMETICS: CosmeticDefinition[] = [
  ...LOWER_V7_COSMETICS,
  ...UPPER_V7_COSMETICS,
  ...STARTER_POLO_V7_COSMETICS,
  ...ACCESSORY_V7_COSMETICS,
  { id: "runner-jacket", name: "Áo khoác Nhịp Phố", description: "Trang phục khởi đầu miễn phí.", slot: "top", price: 0, color: "#32e6f4", model: "jacket", starter: true, collection: "starter-signal", assetId: "wearable.runner.jacket" },
  { id: "runner-pants", name: "Quần Nhịp Phố", description: "Phong cách đường phố gọn gàng.", slot: "bottom", price: 0, color: "#222b40", model: "tapered", starter: true, collection: "starter-signal", assetId: "wearable.runner.pants" },
  { id: "runner-shoes", name: "Giày Nhịp Phố", description: "Bước đầu trên hành trình.", slot: "shoes", price: 0, color: "#d7e7ef", model: "sneakers", starter: true, collection: "starter-signal", assetId: "wearable.runner.shoes" },
  { id: "corporate-top", name: "Áo Công Sở Tương Lai", description: "Bộ khởi đầu công sở tương lai.", slot: "top", price: 0, color: "#495d79", model: "jacket", starter: true, collection: "starter-corporate", assetId: "wearable.corporate.top" },
  { id: "corporate-pants", name: "Quần Công Sở Tương Lai", description: "Đường cắt thanh lịch.", slot: "bottom", price: 0, color: "#303b51", model: "tapered", starter: true, collection: "starter-corporate", assetId: "wearable.corporate.pants" },
  { id: "corporate-shoes", name: "Giày Công Sở Tương Lai", description: "Hoàn thiện bộ công sở.", slot: "shoes", price: 0, color: "#172032", model: "boots", starter: true, collection: "starter-corporate", assetId: "wearable.corporate.shoes" },
  { id: "technician-top", name: "Áo Kỹ Thuật Đêm", description: "Bộ khởi đầu cho người sáng tạo.", slot: "top", price: 0, color: "#b47d40", model: "hoodie", starter: true, collection: "starter-technician", assetId: "wearable.technician.top" },
  { id: "technician-pants", name: "Quần Kỹ Thuật Đêm", description: "Quần kỹ thuật tiện dụng.", slot: "bottom", price: 0, color: "#475349", model: "cargo", starter: true, collection: "starter-technician", assetId: "wearable.technician.pants" },
  { id: "technician-shoes", name: "Giày Kỹ Thuật Đêm", description: "Bốt cho một đêm sáng tạo.", slot: "shoes", price: 0, color: "#5a493b", model: "boots", starter: true, collection: "starter-technician", assetId: "wearable.technician.shoes" },
  { id: "daily-tee", name: "Áo thun Tín Hiệu Ngày", description: "Áo thun nhẹ cho mọi lịch trình.", slot: "top", price: 0, color: "#e7edf2", model: "tee", starter: true, collection: "starter-signal", assetId: "wearable.daily.tee" },
  { id: "signal-turtleneck", name: "Áo cổ lọ Tín Hiệu", description: "Cổ cao tối giản, dễ phối lớp.", slot: "top", price: 0, color: "#7656a8", model: "turtleneck", starter: true, collection: "starter-signal", assetId: "wearable.signal.turtleneck" },
  { id: "utility-vest", name: "Áo ghi-lê Tiện Dụng", description: "Lớp giáp nhẹ với túi tiện dụng.", slot: "top", price: 0, color: "#426776", model: "utility-vest", starter: true, collection: "starter-signal", assetId: "wearable.utility.vest" },
  { id: "wide-leg-pants", name: "Quần Ống Rộng", description: "Dáng rộng thoải mái, giữ đường nét gọn gàng.", slot: "bottom", price: 0, color: "#384455", model: "wide-leg", starter: true, collection: "starter-signal", assetId: "wearable.wide-leg.pants" },
  { id: "city-high-tops", name: "Giày cổ cao Phố Thị", description: "Giày cổ cao cho những chuyến đi dài.", slot: "shoes", price: 0, color: "#d94e98", model: "high-tops", starter: true, collection: "starter-signal", assetId: "wearable.city.high-tops" },
  { id: "starter-pleated-pants", name: "Quần xếp ly Hành Trình", description: "Nếp ly rõ nét, phối tự do cùng áo khởi đầu.", slot: "bottom", price: 0, color: "#67717f", model: "pleated", starter: true, collection: "starter-corporate", assetId: "wearable.starter.pleated-pants" },
  { id: "starter-loafers", name: "Giày lười Đô Thị", description: "Giày lười đế thấp với quai kim loại.", slot: "shoes", price: 0, color: "#4b4051", model: "loafers", starter: true, collection: "starter-corporate", assetId: "wearable.starter.loafers" },
  { id: "starter-cyber-coat", name: "Áo choàng Công Nghệ", description: "Áo khoác dài mở ra nhiều cách phối.", slot: "outerwear", price: 0, color: "#1d3148", model: "long-coat", starter: true, collection: "starter-signal", assetId: "wearable.starter.cyber-coat" },
  { id: "starter-bomber", name: "Áo khoác bo gấu Tín Hiệu", description: "Áo khoác ngắn gọn gàng với bo tay tương phản.", slot: "outerwear", price: 0, color: "#273e52", model: "bomber", starter: true, collection: "starter-signal", assetId: "wearable.starter.bomber" },
  { id: "starter-rain-shell", name: "Áo khoác Chống Mưa", description: "Lớp áo chống mưa cho thành phố ánh sáng.", slot: "outerwear", price: 0, color: "#31585e", model: "rain-shell", starter: true, collection: "starter-signal", assetId: "wearable.starter.rain-shell" },
  { id: "starter-wrist-device", name: "Thiết bị cổ tay", description: "Màn hình nhỏ đồng bộ với nhịp sống.", slot: "accessory", price: 0, color: "#32e6f4", model: "wrist-device", starter: true, collection: "starter-signal", assetId: "wearable.starter.wrist-device" },
  { id: "starter-scarf", name: "Khăn cổ Hành Trình", description: "Một dải màu cho bộ đồ cơ bản.", slot: "accessory", price: 0, color: "#f07862", model: "scarf", starter: true, collection: "starter-signal", assetId: "wearable.starter.scarf" },
  { id: "starter-holo-badge", name: "Huy hiệu Quang Ảnh", description: "Phù hiệu nhỏ có ánh sáng riêng.", slot: "accessory", price: 0, color: "#9067ff", model: "holo-badge", starter: true, collection: "starter-signal", assetId: "wearable.starter.holo-badge" },
  { id: "starter-ear-cuff", name: "Khuyên vành tai khởi đầu", description: "Điểm kim loại nhẹ ở vành tai.", slot: "accessory", price: 0, color: "#d6e9f2", model: "ear-cuff", starter: true, collection: "starter-signal", assetId: "wearable.starter.ear-cuff" },
  { id: "violet-coat", name: "Áo khoác Dư Âm Tím", description: "Áo dài với đường viền phát sáng.", slot: "top", price: 100, color: "#9067ff", model: "long-coat", rarity: "rare", level: 2, collection: "violet-afterglow", assetId: "wearable.violet.coat" },
  { id: "amber-hoodie", name: "Áo nỉ mũ Bình Minh", description: "Một chút ấm áp giữa thành phố.", slot: "top", price: 80, color: "#ffbc62", model: "hoodie", rarity: "common", level: 1, collection: "dawn-shift", assetId: "wearable.amber.hoodie" },
  { id: "cargo-pants", name: "Quần túi hộp Công Nghệ", description: "Túi hộp và đường cắt mạnh mẽ.", slot: "bottom", price: 65, color: "#526174", model: "cargo", rarity: "common", level: 1, collection: "dawn-shift", assetId: "wearable.cyber.cargo" },
  { id: "neon-boots", name: "Giày bốt Ánh Sáng", description: "Đế giày phát sáng.", slot: "shoes", price: 75, color: "#ee5acb", model: "boots", rarity: "rare", level: 2, collection: "violet-afterglow", assetId: "wearable.neon.boots" },
  { id: "street-cap", name: "Mũ lưỡi trai Phố Thị", description: "Phụ kiện tạo điểm nhấn.", slot: "headwear", price: 45, color: "#121e38", model: "cap", rarity: "common", level: 1, collection: "dawn-shift", assetId: "wearable.street.cap" },
  { id: "holo-visor", name: "Kính chắn Quang Ảnh", description: "Tròng kính xanh ngọc trong suốt.", slot: "accessory", price: 90, color: "#32e6f4", model: "visor", rarity: "rare", level: 2, collection: "violet-afterglow", assetId: "wearable.holo.visor" },
  { id: "ember-cropped-jacket", name: "Áo khoác lửng Vệt Lửa", description: "Đường cắt ngắn với ánh cam nóng.", slot: "top", price: 115, color: "#cf674f", model: "cropped-jacket", rarity: "rare", level: 2, collection: "ember-line", assetId: "wearable.ember.cropped-jacket" },
  { id: "silk-shell", name: "Áo lụa Cổ Đứng", description: "Bề mặt mịn, cổ đứng sắc nét.", slot: "top", price: 130, color: "#9ea7bc", model: "shell", rarity: "epic", level: 3, collection: "silver-index", assetId: "wearable.silk.shell" },
  { id: "mesh-overshirt", name: "Áo sơ mi khoác Lưới Thoáng", description: "Lớp sơ mi dáng hộp với túi ngực.", slot: "top", price: 105, color: "#387f89", model: "overshirt", rarity: "rare", level: 2, collection: "signal-grid", assetId: "wearable.mesh.overshirt" },
  { id: "carbon-trench", name: "Áo khoác dài Mạch Đen", description: "Áo khoác dáng dài với ve áo sắc nét.", slot: "outerwear", price: 175, color: "#202a3c", model: "trench", rarity: "epic", level: 3, collection: "black-circuit", assetId: "wearable.carbon.trench" },
  { id: "aurora-parka", name: "Áo khoác ấm Cực Quang", description: "Áo khoác dày dặn cho đêm lạnh.", slot: "outerwear", price: 160, color: "#425b77", model: "parka", rarity: "rare", level: 2, collection: "aurora-weather", assetId: "wearable.aurora.parka" },
  { id: "graphite-wide-leg", name: "Quần ống rộng Than Chì", description: "Dáng rộng với đường gấp cân bằng.", slot: "bottom", price: 95, color: "#303848", model: "wide-leg", rarity: "rare", level: 2, collection: "black-circuit", assetId: "wearable.graphite.wide-leg" },
  { id: "silver-pleat", name: "Quần xếp ly Ánh Bạc", description: "Nếp gấp ánh kim cho phong cách thành thị.", slot: "bottom", price: 125, color: "#737d91", model: "pleated", rarity: "epic", level: 3, collection: "silver-index", assetId: "wearable.silver.pleat" },
  { id: "pulse-high-tops", name: "Giày cổ cao Xung Nhịp", description: "Cổ giày cao với đế xung năng lượng.", slot: "shoes", price: 120, color: "#55c9d5", model: "high-tops", rarity: "rare", level: 2, collection: "signal-grid", assetId: "wearable.pulse.high-tops" },
  { id: "mono-loafers", name: "Giày lười Đơn Sắc", description: "Giày lười bóng cho bộ tối giản.", slot: "shoes", price: 110, color: "#202431", model: "loafers", rarity: "rare", level: 2, collection: "silver-index", assetId: "wearable.mono.loafers" },
  { id: "halo-beanie", name: "Mũ len Vầng Sáng", description: "Mũ len có viền phát sáng.", slot: "headwear", price: 85, color: "#5a4b83", model: "beanie", rarity: "rare", level: 2, collection: "violet-afterglow", assetId: "wearable.halo.beanie" },
  { id: "holo-scarf", name: "Khăn đôi Quang Ảnh", description: "Khăn đôi phản chiếu ánh đèn.", slot: "accessory", price: 100, color: "#32e6f4", model: "holo-scarf", rarity: "rare", level: 2, collection: "signal-grid", assetId: "wearable.holo.scarf" },
  { id: "tactical-gloves", name: "Găng tay Chiến Thuật", description: "Găng hở ngón với cổ tay gia cố.", slot: "gloves", price: 70, color: "#26313e", model: "gloves", rarity: "common", level: 1, collection: "black-circuit", assetId: "wearable.tactical.gloves" },
  { id: "neon-pack", name: "Ba lô Quang Sắc", description: "Ba lô sau lưng với quai phát sáng.", slot: "back", price: 140, color: "#273e52", model: "backpack", rarity: "rare", level: 2, collection: "signal-grid", assetId: "wearable.neon.pack" },
  { id: "half-mask", name: "Mặt nạ Nửa Khuôn", description: "Mặt nạ gọn, giữ nguyên biểu cảm mắt.", slot: "face", price: 135, color: "#1c2734", model: "mask", rarity: "epic", level: 3, collection: "black-circuit", assetId: "wearable.half-mask" },
  { id: "chain-collar", name: "Vòng cổ Mắt Xích", description: "Trang sức cổ kim loại sáng.", slot: "jewelry", price: 60, color: "#d9e1ec", model: "chain-collar", rarity: "common", level: 1, collection: "silver-index", assetId: "wearable.chain-collar" },
];

export const STARTER_COSMETICS = COSMETICS.filter((item) => item.starter).map((item) => item.id);

export const STARTER_OUTFITS = [
  { id: "street-runner", name: "Nhịp phố", items: ["runner-jacket", "runner-pants", "runner-shoes", "starter-bomber", "starter-wrist-device"], mixable: true },
  { id: "neo-corporate", name: "Công sở tương lai", items: ["corporate-top", "corporate-pants", "corporate-shoes", "starter-cyber-coat", "starter-ear-cuff"], mixable: true },
  { id: "night-technician", name: "Kỹ thuật đêm", items: ["technician-top", "technician-pants", "technician-shoes", "starter-rain-shell", "starter-holo-badge"], mixable: true },
];

export const APPEARANCE_PALETTES = {
  hair: ["#10131b", "#33251f", "#624032", "#a17645", "#d8b476", "#ede1c9", "#a5aab6", "#f3f6fc", "#9067ff", "#ee5acb", "#32e6f4", "#bc5744"],
  skin: ["#f6d8c3", "#ebc2a5", "#ddb091", "#d2a07c", "#c99573", "#b78360", "#a87350", "#976142", "#875237", "#70432f", "#583426", "#40271e"],
  iris: ["#82dce5", "#497db0", "#6d8d5c", "#876344", "#44372f", "#adafb7", "#9067ff", "#ffbc62"],
} as const;
