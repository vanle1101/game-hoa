import { describe, expect, it } from "vitest";
import * as catalog from "../../src/construction/catalog";
import type { BuildingCatalogItem } from "../../src/construction/types";

const expectedMetadata: Omit<BuildingCatalogItem, "name" | "description">[] = [
  { id: "floor-concrete", category: "floor", price: 10, level: 1, color: "#5b6571" },
  { id: "floor-wood", category: "floor", price: 18, level: 1, color: "#866550" },
  { id: "floor-ceramic", category: "floor", price: 22, level: 2, color: "#222a39" },
  { id: "floor-metal", category: "floor", price: 25, level: 2, color: "#768a96" },
  { id: "floor-marble", category: "floor", price: 40, level: 3, color: "#40516b" },
  { id: "floor-glass", category: "floor", price: 55, level: 4, color: "#4db7c5" },
  { id: "floor-luxury", category: "floor", price: 70, level: 5, color: "#9067ff", campaignUnlock: true },
  { id: "wall-basic", category: "wall", price: 20, level: 1, color: "#354052", height: 2.8, thickness: 0.12 },
  { id: "wall-metal", category: "wall", price: 35, level: 2, color: "#536476", height: 2.8, thickness: 0.14 },
  { id: "wall-neon", category: "wall", price: 55, level: 4, color: "#9067ff", height: 2.8, thickness: 0.14 },
  { id: "door-standard", category: "door", price: 100, level: 1, color: "#667d90", openingWidth: 0.82, openingHeight: 2.2 },
  { id: "door-sliding", category: "door", price: 130, level: 2, color: "#8da3b0", openingWidth: 0.86, openingHeight: 2.25 },
  { id: "door-glass", category: "door", price: 150, level: 2, color: "#52a9ba", openingWidth: 0.86, openingHeight: 2.3 },
  { id: "door-auto", category: "door", price: 190, level: 3, color: "#32e6f4", openingWidth: 0.88, openingHeight: 2.3 },
  { id: "door-security", category: "door", price: 220, level: 4, color: "#728090", openingWidth: 0.8, openingHeight: 2.2 },
  { id: "door-neon", category: "door", price: 280, level: 5, color: "#ee5acb", openingWidth: 0.88, openingHeight: 2.4, campaignUnlock: true },
  { id: "window-small", category: "window", price: 80, level: 1, color: "#63a5b8", openingWidth: 0.7, openingHeight: 1.05, sill: 1.05 },
  { id: "window-wide", category: "window", price: 110, level: 2, color: "#74b4c4", openingWidth: 0.9, openingHeight: 1.2, sill: 0.9 },
  { id: "window-panoramic", category: "window", price: 140, level: 3, color: "#80c0ce", openingWidth: 0.94, openingHeight: 1.8, sill: 0.55 },
  { id: "window-full", category: "window", price: 170, level: 3, color: "#68b7c9", openingWidth: 0.94, openingHeight: 2.5, sill: 0.15 },
  { id: "window-tinted", category: "window", price: 190, level: 4, color: "#7067ae", openingWidth: 0.9, openingHeight: 1.8, sill: 0.55 },
  { id: "window-holo", category: "window", price: 240, level: 5, color: "#32e6f4", openingWidth: 0.9, openingHeight: 2.2, sill: 0.3 },
  { id: "ceiling-basic", category: "ceiling", price: 8, level: 1, color: "#293341" },
  { id: "roof-flat", category: "roof", price: 12, level: 1, color: "#3a4555" },
  { id: "roof-terrace", category: "roof", price: 25, level: 3, color: "#60756f" },
  { id: "stairs-basic", category: "stairs", price: 240, level: 3, color: "#7a8e9c" },
  { id: "curve-bay", category: "curve", price: 260, level: 1, color: "#81cbd8", curve: { radius: 1.5, angle: 90, thickness: 0.12, height: 2.6, material: "clear", frame: "aluminium" } },
  { id: "curve-corner", category: "curve", price: 220, level: 1, color: "#a8d6df", curve: { radius: 1, angle: 90, thickness: 0.12, height: 2.8, material: "clear", frame: "graphite" } },
  { id: "curve-panorama", category: "curve", price: 460, level: 3, color: "#62afc8", curve: { radius: 3, angle: 90, thickness: 0.16, height: 2.8, material: "blue", frame: "aluminium" } },
  { id: "curve-alcove", category: "curve", price: 380, level: 2, color: "#ad96d5", curve: { radius: 1.5, angle: 180, thickness: 0.14, height: 2.6, material: "violet", frame: "graphite" } },
  { id: "curve-divider", category: "curve", price: 180, level: 1, color: "#91cfbd", curve: { radius: 2, angle: 60, thickness: 0.1, height: 1.4, material: "frosted", frame: "aluminium" } },
  { id: "curve-bow", category: "curve", price: 520, level: 4, color: "#7399b9", curve: { radius: 2.5, angle: 120, thickness: 0.18, height: 2.8, material: "smoke", frame: "brass" } },
];

const expectedLabels: Record<string, readonly [string, string]> = {
  "floor-concrete": [
    "Sàn bê tông",
    "Nền móng cho không gian bình yên."
  ],
  "floor-wood": [
    "Sàn gỗ ấm áp",
    "Chút ấm áp giữa lòng thành phố."
  ],
  "floor-ceramic": [
    "Sàn gạch men tối màu",
    "Nét sang trọng tinh tế giữa phố thị."
  ],
  "floor-metal": [
    "Sàn kim loại xước",
    "Dành cho xưởng làm việc của bạn."
  ],
  "floor-marble": [
    "Sàn cẩm thạch xanh đêm",
    "Sắc đá gợi đường chân trời thành phố."
  ],
  "floor-glass": [
    "Sàn kính thông minh",
    "Ánh sáng dưới từng bước chân."
  ],
  "floor-luxury": [
    "Sàn vân neon",
    "Mẫu sàn mở khóa qua chiến dịch."
  ],
  "wall-basic": [
    "Tường xám than",
    "Tường vật liệu tổng hợp lắp ghép."
  ],
  "wall-metal": [
    "Tường titan",
    "Các tấm titan bề mặt xước."
  ],
  "wall-neon": [
    "Tường khảm đèn neon",
    "Ánh sáng tiết chế, kiến trúc đầy cá tính."
  ],
  "door-standard": [
    "Cửa tiêu chuẩn",
    "Mở lối sang một chương mới."
  ],
  "door-sliding": [
    "Cửa trượt",
    "Cửa trượt gọn gàng, tiết kiệm diện tích."
  ],
  "door-glass": [
    "Cửa kính",
    "Không gian sống trong trẻo giữa phố thị."
  ],
  "door-auto": [
    "Cửa tự động",
    "Tự mở khi bạn đến gần."
  ],
  "door-security": [
    "Cửa an ninh",
    "Lối vào được gia cố để bảo vệ ngôi nhà."
  ],
  "door-neon": [
    "Cửa neon cao cấp",
    "Lối vào đậm dấu ấn riêng, mở khóa qua chiến dịch."
  ],
  "window-small": [
    "Cửa sổ nhỏ",
    "Khung cửa nhìn ra thành phố."
  ],
  "window-wide": [
    "Cửa sổ rộng",
    "Ô kính lắp ghép trải rộng hết bề ngang."
  ],
  "window-panoramic": [
    "Cửa sổ toàn cảnh",
    "Ghép các ô cửa cạnh nhau để mở rộng tầm nhìn."
  ],
  "window-full": [
    "Kính từ sàn đến trần",
    "Ô kính cao mở rộng tầm nhìn."
  ],
  "window-tinted": [
    "Kính tím công nghệ",
    "Sắc tím cho không gian riêng tư."
  ],
  "window-holo": [
    "Kính thông minh ba chiều",
    "Khung cảnh thành phố biến đổi đầy sống động."
  ],
  "ceiling-basic": [
    "Trần vật liệu tổng hợp",
    "Mỗi ô sàn tương ứng với một tấm trần."
  ],
  "roof-flat": [
    "Mái bằng",
    "Đường nét mái nhà hiện đại, gọn gàng."
  ],
  "roof-terrace": [
    "Mái sân thượng",
    "Góc thư giãn tương lai trên mái nhà."
  ],
  "stairs-basic": [
    "Cầu thang lắp ghép",
    "Cầu thang chiếm hai ô, dẫn lên tầng trên."
  ],
  "curve-bay": [
    "Ô kính lồi",
    "Ô kính trong uốn cong nhỏ gọn."
  ],
  "curve-corner": [
    "Góc kính bo tròn",
    "Góc kính cong một phần tư đường tròn."
  ],
  "curve-panorama": [
    "Vách kính cong toàn cảnh",
    "Vách kính cong rộng, hướng ra toàn cảnh thành phố."
  ],
  "curve-alcove": [
    "Góc riêng bằng kính",
    "Vách kính hình bán nguyệt tạo không gian riêng tư."
  ],
  "curve-divider": [
    "Vách ngăn kính cong",
    "Vách kính cong thấp để phân chia không gian."
  ],
  "curve-bow": [
    "Mặt dựng kính vòng cung",
    "Mặt dựng kính màu uốn cong rộng."
  ],
  "door-louver": ["Cửa chớp thông gió", "Nan chớp thoáng khí trên cánh cửa mở quay gọn gàng."],
  "door-craftsman": ["Cửa gỗ ô kính", "Cánh gỗ ghép nổi với ba ô kính lấy sáng phía trên."]
};

const nonLabelMetadata = (items: BuildingCatalogItem[]) => items.map((item) =>
  Object.fromEntries(Object.entries(item).filter(([key]) => key !== "name" && key !== "description")),
);

const vietnameseDiacritic = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe("Vietnamese construction catalog", () => {
  it("preserves every non-label field and the original item order", () => {
    expect(nonLabelMetadata(catalog.BUILDING_CATALOG.slice(0, 32))).toStrictEqual(expectedMetadata);
    expect(nonLabelMetadata(catalog.BUILDING_CATALOG.slice(32))).toStrictEqual([
      { id: "door-louver", category: "door", price: 145, level: 2, color: "#899b83", openingWidth: 0.84, openingHeight: 2.2 },
      { id: "door-craftsman", category: "door", price: 175, level: 3, color: "#9b7250", openingWidth: 0.86, openingHeight: 2.3 },
    ]);
    expect(nonLabelMetadata(catalog.CURVED_GLASS_CATALOG)).toStrictEqual(expectedMetadata.filter((item) => item.category === "curve"));
  });

  it("preserves all category counts, including eight distinct doors", () => {
    expect(catalog.BUILDING_CATALOG).toHaveLength(34);
    expect(catalog.CURVED_GLASS_CATALOG).toHaveLength(6);
    const counts = catalog.BUILDING_CATALOG.reduce<Record<string, number>>((result, item) => {
      result[item.category] = (result[item.category] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toStrictEqual({ floor: 7, wall: 3, door: 8, window: 6, ceiling: 1, roof: 2, stairs: 1, curve: 6 });
    expect(new Set(catalog.BUILDING_CATALOG.map((item) => item.id)).size).toBe(34);
  });

  it("preserves exports, constants, lookup behavior and shared curved entries", () => {
    expect(Object.keys(catalog).sort()).toEqual([
      "BUILDING_CATALOG", "CELL_SIZE", "CURVED_GLASS_CATALOG", "LEVEL_HEIGHT", "REFUND_RATE", "STARTER_GRANT", "buildingItem",
    ]);
    expect([catalog.CELL_SIZE, catalog.LEVEL_HEIGHT, catalog.REFUND_RATE, catalog.STARTER_GRANT]).toEqual([1, 3, 0.5, 0]);
    for (const item of catalog.BUILDING_CATALOG) expect(catalog.buildingItem(item.id)).toBe(item);
    for (const item of catalog.CURVED_GLASS_CATALOG) expect(catalog.BUILDING_CATALOG).toContain(item);
    expect(catalog.buildingItem("unknown-building-id")).toBeUndefined();
  });

  it.each(catalog.BUILDING_CATALOG)("uses the Vietnamese name and description for $id", (item) => {
    expect([item.name, item.description]).toEqual(expectedLabels[item.id]);
    for (const label of [item.name, item.description]) {
      expect(label.trim()).not.toBe("");
      expect(label).toBe(label.trim());
      expect(label).toMatch(vietnameseDiacritic);
      expect(label).not.toMatch(/\uFFFD/);
    }
  });
});
