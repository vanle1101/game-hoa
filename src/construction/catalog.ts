import type { BuildingCatalogItem } from "./types";
export const CELL_SIZE = 1;
export const LEVEL_HEIGHT = 3;
export const REFUND_RATE = 0.5;
export const STARTER_GRANT = 0;
export const BUILDING_CATALOG: BuildingCatalogItem[] = [
  { id: "floor-concrete", name: "Sàn bê tông", category: "floor", price: 10, level: 1, color: "#5b6571", description: "Nền móng cho không gian bình yên." },
  { id: "floor-wood", name: "Sàn gỗ ấm áp", category: "floor", price: 18, level: 1, color: "#866550", description: "Chút ấm áp giữa lòng thành phố." },
  { id: "floor-ceramic", name: "Sàn gạch men tối màu", category: "floor", price: 22, level: 2, color: "#222a39", description: "Nét sang trọng tinh tế giữa phố thị." },
  { id: "floor-metal", name: "Sàn kim loại xước", category: "floor", price: 25, level: 2, color: "#768a96", description: "Dành cho xưởng làm việc của bạn." },
  { id: "floor-marble", name: "Sàn cẩm thạch xanh đêm", category: "floor", price: 40, level: 3, color: "#40516b", description: "Sắc đá gợi đường chân trời thành phố." },
  { id: "floor-glass", name: "Sàn kính thông minh", category: "floor", price: 55, level: 4, color: "#4db7c5", description: "Ánh sáng dưới từng bước chân." },
  { id: "floor-luxury", name: "Sàn vân neon", category: "floor", price: 70, level: 5, color: "#9067ff", description: "Mẫu sàn mở khóa qua chiến dịch.", campaignUnlock: true },
  { id: "wall-basic", name: "Tường xám than", category: "wall", price: 20, level: 1, color: "#354052", description: "Tường vật liệu tổng hợp lắp ghép.", height: 2.8, thickness: 0.12 },
  { id: "wall-metal", name: "Tường titan", category: "wall", price: 35, level: 2, color: "#536476", description: "Các tấm titan bề mặt xước.", height: 2.8, thickness: 0.14 },
  { id: "wall-neon", name: "Tường khảm đèn neon", category: "wall", price: 55, level: 4, color: "#9067ff", description: "Ánh sáng tiết chế, kiến trúc đầy cá tính.", height: 2.8, thickness: 0.14 },
  { id: "door-standard", name: "Cửa tiêu chuẩn", category: "door", price: 100, level: 1, color: "#667d90", description: "Mở lối sang một chương mới.", openingWidth: 0.82, openingHeight: 2.2 },
  { id: "door-sliding", name: "Cửa trượt", category: "door", price: 130, level: 2, color: "#8da3b0", description: "Cửa trượt gọn gàng, tiết kiệm diện tích.", openingWidth: 0.86, openingHeight: 2.25 },
  { id: "door-glass", name: "Cửa kính", category: "door", price: 150, level: 2, color: "#52a9ba", description: "Không gian sống trong trẻo giữa phố thị.", openingWidth: 0.86, openingHeight: 2.3 },
  { id: "door-auto", name: "Cửa tự động", category: "door", price: 190, level: 3, color: "#32e6f4", description: "Tự mở khi bạn đến gần.", openingWidth: 0.88, openingHeight: 2.3 },
  { id: "door-security", name: "Cửa an ninh", category: "door", price: 220, level: 4, color: "#728090", description: "Lối vào được gia cố để bảo vệ ngôi nhà.", openingWidth: 0.8, openingHeight: 2.2 },
  { id: "door-neon", name: "Cửa neon cao cấp", category: "door", price: 280, level: 5, color: "#ee5acb", description: "Lối vào đậm dấu ấn riêng, mở khóa qua chiến dịch.", openingWidth: 0.88, openingHeight: 2.4, campaignUnlock: true },
  { id: "window-small", name: "Cửa sổ nhỏ", category: "window", price: 80, level: 1, color: "#63a5b8", description: "Khung cửa nhìn ra thành phố.", openingWidth: 0.7, openingHeight: 1.05, sill: 1.05 },
  { id: "window-wide", name: "Cửa sổ rộng", category: "window", price: 110, level: 2, color: "#74b4c4", description: "Ô kính lắp ghép trải rộng hết bề ngang.", openingWidth: 0.9, openingHeight: 1.2, sill: 0.9 },
  { id: "window-panoramic", name: "Cửa sổ toàn cảnh", category: "window", price: 140, level: 3, color: "#80c0ce", description: "Ghép các ô cửa cạnh nhau để mở rộng tầm nhìn.", openingWidth: 0.94, openingHeight: 1.8, sill: 0.55 },
  { id: "window-full", name: "Kính từ sàn đến trần", category: "window", price: 170, level: 3, color: "#68b7c9", description: "Ô kính cao mở rộng tầm nhìn.", openingWidth: 0.94, openingHeight: 2.5, sill: 0.15 },
  { id: "window-tinted", name: "Kính tím công nghệ", category: "window", price: 190, level: 4, color: "#7067ae", description: "Sắc tím cho không gian riêng tư.", openingWidth: 0.9, openingHeight: 1.8, sill: 0.55 },
  { id: "window-holo", name: "Kính thông minh ba chiều", category: "window", price: 240, level: 5, color: "#32e6f4", description: "Khung cảnh thành phố biến đổi đầy sống động.", openingWidth: 0.9, openingHeight: 2.2, sill: 0.3 },
  { id: "ceiling-basic", name: "Trần vật liệu tổng hợp", category: "ceiling", price: 8, level: 1, color: "#293341", description: "Mỗi ô sàn tương ứng với một tấm trần." },
  { id: "roof-flat", name: "Mái bằng", category: "roof", price: 12, level: 1, color: "#3a4555", description: "Đường nét mái nhà hiện đại, gọn gàng." },
  { id: "roof-terrace", name: "Mái sân thượng", category: "roof", price: 25, level: 3, color: "#60756f", description: "Góc thư giãn tương lai trên mái nhà." },
  { id: "stairs-basic", name: "Cầu thang lắp ghép", category: "stairs", price: 240, level: 3, color: "#7a8e9c", description: "Cầu thang chiếm hai ô, dẫn lên tầng trên." },
];
export const CURVED_GLASS_CATALOG: BuildingCatalogItem[] = [
  { id: "curve-bay", name: "Ô kính lồi", category: "curve", price: 260, level: 1, color: "#81cbd8", description: "Ô kính trong uốn cong nhỏ gọn.", curve: { radius: 1.5, angle: 90, thickness: 0.12, height: 2.6, material: "clear", frame: "aluminium" } },
  { id: "curve-corner", name: "Góc kính bo tròn", category: "curve", price: 220, level: 1, color: "#a8d6df", description: "Góc kính cong một phần tư đường tròn.", curve: { radius: 1, angle: 90, thickness: 0.12, height: 2.8, material: "clear", frame: "graphite" } },
  { id: "curve-panorama", name: "Vách kính cong toàn cảnh", category: "curve", price: 460, level: 3, color: "#62afc8", description: "Vách kính cong rộng, hướng ra toàn cảnh thành phố.", curve: { radius: 3, angle: 90, thickness: 0.16, height: 2.8, material: "blue", frame: "aluminium" } },
  { id: "curve-alcove", name: "Góc riêng bằng kính", category: "curve", price: 380, level: 2, color: "#ad96d5", description: "Vách kính hình bán nguyệt tạo không gian riêng tư.", curve: { radius: 1.5, angle: 180, thickness: 0.14, height: 2.6, material: "violet", frame: "graphite" } },
  { id: "curve-divider", name: "Vách ngăn kính cong", category: "curve", price: 180, level: 1, color: "#91cfbd", description: "Vách kính cong thấp để phân chia không gian.", curve: { radius: 2, angle: 60, thickness: 0.1, height: 1.4, material: "frosted", frame: "aluminium" } },
  { id: "curve-bow", name: "Mặt dựng kính vòng cung", category: "curve", price: 520, level: 4, color: "#7399b9", description: "Mặt dựng kính màu uốn cong rộng.", curve: { radius: 2.5, angle: 120, thickness: 0.18, height: 2.8, material: "smoke", frame: "brass" } },
];
BUILDING_CATALOG.push(...CURVED_GLASS_CATALOG);
export const buildingItem = (id: string) => BUILDING_CATALOG.find((item) => item.id === id);
BUILDING_CATALOG.push(
  { id: "door-louver", name: "Cửa chớp thông gió", category: "door", price: 145, level: 2, color: "#899b83", description: "Nan chớp thoáng khí trên cánh cửa mở quay gọn gàng.", openingWidth: 0.84, openingHeight: 2.2 },
  { id: "door-craftsman", name: "Cửa gỗ ô kính", category: "door", price: 175, level: 3, color: "#9b7250", description: "Cánh gỗ ghép nổi với ba ô kính lấy sáng phía trên.", openingWidth: 0.86, openingHeight: 2.3 },
);
