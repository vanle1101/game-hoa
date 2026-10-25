import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EQUIPMENT_CATALOG, EQUIPMENT_MODEL_IDS, getEquipmentDefinition, getEquipmentRecipe } from "../../src/equipment/catalog";

const labels: Record<string, [string, string]> = {
  "starter-blade": [
    "Kiếm Xung Nhịp",
    "Lưỡi kiếm đầu tiên giúp bạn vượt qua xao nhãng."
  ],
  "cyber-katana": [
    "Kiếm Công Nghệ",
    "Lưỡi kiếm hợp kim phát sáng, rèn chuẩn từng nét."
  ],
  "plasma-sword": [
    "Kiếm Điện Tương",
    "Cơn bão năng lượng nằm gọn trong tay."
  ],
  "quantum-edge": [
    "Kiếm Lượng Tử",
    "Chém tan mọi nghịch cảnh."
  ],
  "neural-visor": [
    "Kính Thần Kinh",
    "Nhìn rõ mục tiêu giữa muôn vàn xao nhãng."
  ],
  "aegis-jacket": [
    "Áo Hộ Vệ",
    "Lớp bảo vệ nhẹ cho hành trình phố thị."
  ],
  "pulse-gloves": [
    "Găng Xung Nhịp",
    "Tiếp thêm sức mạnh cho từng hành động."
  ],
  "drift-boots": [
    "Giày Lướt Gió",
    "Luôn đi trước một bước."
  ],
  "focus-chip": [
    "Vi Mạch Tập Trung",
    "Giữ đầu óc sáng rõ giữa thế giới ồn ào."
  ],
  "memory-ring": [
    "Nhẫn Ký Ức",
    "Giữ những điều quý giá luôn bên mình."
  ],
  "dawn-relic": [
    "Thánh Vật Bình Minh",
    "Nhắc bạn rằng luôn có thể bắt đầu lại."
  ],
  "breach-tanto": [
    "Đoản Đao Phá Trận",
    "Mũi vát gọn, sống dao gia cố chắc chắn."
  ],
  "rescue-hook": [
    "Dao Móc Cứu Hộ",
    "Lưỡi móc có khe cắt dây cứu hộ."
  ],
  "sawback-machete": [
    "Dao Rựa Răng Cưa",
    "Lưỡi chặt bản rộng, sống dao có bốn răng cưa."
  ],
  "trench-punch": [
    "Dao Đấm Chiến Hào",
    "Lưỡi dao hẹp với vòng chắn bảo vệ khớp tay."
  ],
  "field-kukri": [
    "Dao Quắm Dã Chiến",
    "Lưỡi cong dồn trọng lượng về mũi, chuyên dùng dã chiến."
  ],
  "moon-nodachi": [
    "Trường Đao Nguyệt Ảnh",
    "Lưỡi cong dài cùng chuôi quấn dây nối dài."
  ],
  "storm-wakizashi": [
    "Đoản Kiếm Bão Tố",
    "Lưỡi cong ngắn với hai nhánh chắn hất lên."
  ],
  "split-tsuba": [
    "Kiếm Song Hộ Thủ",
    "Hai tấm chắn góc cạnh ôm lấy lưỡi kiếm cong."
  ],
  "reed-shikomizue": [
    "Kiếm Gậy Thanh Trúc",
    "Kiếm gậy thanh mảnh, không chắn tay, đuôi có đối trọng."
  ],
  "serpent-odachi": [
    "Trường Đao Xà Ảnh",
    "Lưỡi uốn như rắn, chắn tay mang đôi nanh sắc."
  ],
  "arc-fork": [
    "Chĩa Hồ Quang",
    "Hai mũi tích điện nằm hai bên rãnh hở."
  ],
  "ion-saber": [
    "Kiếm Điện Ly",
    "Lõi năng lượng hình trụ trong bộ phát thoát nhiệt."
  ],
  "photon-halo": [
    "Vòng Quang Tử",
    "Lưỡi sáng hình vòng có khung đỡ và thấu kính giữa."
  ],
  "flux-cleaver": [
    "Đao Từ Thông",
    "Lưỡi năng lượng lệch bên cùng ba pin nguồn."
  ],
  "tesla-lance": [
    "Thương Cảm Ứng",
    "Bốn cuộn cảm nằm dưới mũi thương ba chĩa."
  ],
  "atlas-hammer": [
    "Búa Kình Thiên",
    "Đầu búa chữ nhật bản rộng, hai mặt đập gia cố."
  ],
  "siege-axe": [
    "Rìu Công Thành",
    "Lưỡi rìu lưỡi liềm cân bằng với mũi nhọn phía sau."
  ],
  "rail-maul": [
    "Búa Song Trụ",
    "Hai đầu búa dựng đứng nối bằng thanh ngang tích điện."
  ],
  "grav-greatsword": [
    "Đại Kiếm Trọng Lực",
    "Lưỡi bản rộng, mũi nhọn, gân giữa nổi chắc chắn."
  ],
  "impact-mace": [
    "Chùy Chấn Kích",
    "Sáu cánh nhọn tỏa quanh lõi chùy đặc."
  ],
  "breaker-pick": [
    "Cuốc Phá Giáp",
    "Mũi cuốc cong cân bằng với mặt đập vuông."
  ],
  "twin-stingers": [
    "Song Dao Độc Châm",
    "Đôi dao găm hình lá, mỗi tay cầm một chiếc."
  ],
  "mirror-sai": [
    "Song Chĩa Đối Ảnh",
    "Đôi chĩa có mũi giữa và ngạnh bên để khóa đòn."
  ],
  "volt-tonfas": [
    "Song Côn Điện",
    "Đôi côn tay cầm ngang với thanh dẫn tích điện."
  ],
  "harvest-kamas": [
    "Song Liềm Mùa Gặt",
    "Đôi liềm ngắn với lưỡi móc sắc."
  ],
  "sun-scepter": [
    "Quyền Trượng Mặt Trời",
    "Tám tia sáng bao quanh lõi mặt trời rực rỡ."
  ],
  "crescent-scythe": [
    "Lưỡi Hái Trăng Khuyết",
    "Lưỡi cong trăng khuyết trên cán nghi lễ thanh mảnh."
  ],
  "oracle-trident": [
    "Đinh Ba Tiên Tri",
    "Ba mũi nhọn vươn lên từ khung chĩa rộng."
  ],
  "void-key": [
    "Chìa Khóa Hư Không",
    "Chìa khóa khổng lồ với vòng chuôi phát sáng."
  ],
  "runic-fan": [
    "Quạt Cổ Tự",
    "Năm nan cứng xòe quanh chốt xoay đính ngọc."
  ],
  "meteor-flail": [
    "Chùy Xích Thiên Thạch",
    "Xích đan nối treo đầu chùy thiên thạch đầy gai."
  ],
  "aether-glaive": [
    "Trường Đao Thiên Không",
    "Lưỡi đao lệch hình cánh buồm, ôm bởi vòng quỹ đạo."
  ],
  "bastion-helm": [
    "Mũ Giáp Thành Trì",
    "Vòm mũ tròn với chắn trán và hai tấm bảo vệ má."
  ],
  "signal-crown": [
    "Vương Miện Tín Hiệu",
    "Ba chóp phát tín hiệu trên vòng miện mảnh."
  ],
  "recon-monocle": [
    "Kính Đơn Trinh Sát",
    "Một mắt kính tròn cùng cảm biến bên thái dương."
  ],
  "warden-mask": [
    "Mặt Nạ Giám Hộ",
    "Tấm che nửa mặt góc cạnh có ba khe thở."
  ],
  "aerial-headset": [
    "Tai Nghe Không Vận",
    "Hai chụp thu âm cùng đôi ăng-ten dựng đứng."
  ],
  "bastion-cuirass": [
    "Giáp Ngực Thành Trì",
    "Giáp ngực thuôn dần với hai mảnh giáp vai tròn."
  ],
  "scout-harness": [
    "Đai Trinh Sát",
    "Bộ dây đai thoáng, kèm thắt lưng tiện ích có khóa."
  ],
  "reactor-vest": [
    "Áo Giáp Lò Phản Ứng",
    "Lõi tròn trước ngực nằm giữa hai cụm tản nhiệt."
  ],
  "lamellar-shell": [
    "Giáp Vảy Xếp",
    "Mười hai phiến giáp chồng lên nhau, linh hoạt ôm thân."
  ],
  "sentinel-mantle": [
    "Áo Choàng Lính Gác",
    "Giáp vai hình cánh phủ trên áo choàng giáp ngắn."
  ],
  "bastion-gauntlets": [
    "Găng Giáp Thành Trì",
    "Giáp cẳng tay bản rộng với tấm chắn khớp tay nổi."
  ],
  "arc-bracers": [
    "Vòng Tay Hồ Quang",
    "Các vòng cảm ứng ôm quanh giáp cổ tay thuôn gọn."
  ],
  "climber-grips": [
    "Găng Bám Vách",
    "Ba mấu bám trên mỗi bàn tay được bọc giáp."
  ],
  "duelist-vambraces": [
    "Giáp Tay Kiếm Sĩ",
    "Đôi cánh giáp cong đối xứng bảo vệ cẳng tay."
  ],
  "bastion-greaves": [
    "Giáp Chân Thành Trì",
    "Giáp ống chân dài, thuôn gọn, mũi giày gia cố."
  ],
  "vector-skates": [
    "Giày Trượt Định Hướng",
    "Lưỡi trượt hẹp được đỡ bằng hai thanh chống."
  ],
  "mag-lock-boots": [
    "Ủng Khóa Từ",
    "Đĩa nam châm gắn hai bên cùng gót vuông vững chắc."
  ],
  "trail-sabatons": [
    "Giày Giáp Đường Mòn",
    "Ba mảnh giáp mũi nối khớp và tấm chắn bắp chân sau."
  ],
  "relay-brooch": [
    "Trâm Tiếp Sóng",
    "Trâm hình cánh diều đính viên ngọc truyền tín hiệu."
  ],
  "cipher-locket": [
    "Mề Đay Mật Mã",
    "Mề đay chữ nhật hai nửa, treo trên khoen nhỏ."
  ],
  "chronometer": [
    "Đồng Hồ Chính Xác",
    "Mặt tròn có kim rõ nét, đi cùng dây đeo bản rộng."
  ],
  "orbit-talisman": [
    "Bùa Quỹ Đạo",
    "Những vòng giao nhau ôm lấy ngôi sao lơ lửng."
  ],
  "guardian-sigil": [
    "Ấn Hộ Vệ",
    "Huy hiệu khiên nhỏ mang hình chữ thập nổi."
  ],
  "sentry-cap": [
    "Mũ Lính Gác",
    "Mũ dã chiến thuôn gọn, vành dài, phù hiệu phía trước."
  ],
  "prism-circlet": [
    "Vòng Miện Lăng Kính",
    "Đỉnh hình thoi và đôi cánh thái dương trên vòng miện mảnh."
  ],
  "ranger-bandolier": [
    "Đai Chéo Tuần Lâm",
    "Đai tiện ích đeo chéo với ba túi nổi."
  ],
  "carapace-vest": [
    "Áo Giáp Mai Cứng",
    "Ba tấm giáp ngực thuôn lồng nhau, gờ giữa nhô cao."
  ],
  "medic-cuffs": [
    "Giáp Tay Quân Y",
    "Hai ống thuốc thủy tinh trong hộp cẳng tay có chốt."
  ],
  "talon-guards": [
    "Găng Vuốt Sắc",
    "Ba móng cong trên mỗi lòng bàn tay bọc giáp."
  ],
  "spring-striders": [
    "Giày Trợ Lực",
    "Đôi trụ bên hông nâng đỡ đế lò xo bản rộng."
  ],
  "ridge-gaiters": [
    "Ủng Giáp Gân Nổi",
    "Ba gờ nổi ôm bắp chân phía trên ủng đường mòn."
  ]
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("Vietnamese equipment catalog", () => {
  it("provides the Vietnamese name and description for every stable item ID", () => {
    expect(EQUIPMENT_CATALOG).toHaveLength(74);
    expect(EQUIPMENT_CATALOG.map(item => item.id).sort()).toEqual(Object.keys(labels).sort());
    for (const item of EQUIPMENT_CATALOG) {
      expect([item.name, item.description], item.id).toEqual(labels[item.id]);
      expect(item.name.normalize("NFC"), item.id).toBe(item.name);
      expect(item.description.normalize("NFC"), item.id).toBe(item.description);
      expect(item.name.length, item.id).toBeLessThanOrEqual(32);
      expect(item.description.length, item.id).toBeLessThanOrEqual(90);
      expect(item.name, item.id).toMatch(/[^\x00-\x7F]/);
      expect(item.description, item.id).toMatch(/[^\x00-\x7F]/);
    }
  });

  it("preserves all nonlabel catalog data and category counts", () => {
    const nonlabels = EQUIPMENT_CATALOG.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== "name" && key !== "description")));
    expect(digest(nonlabels)).toBe("d393dc92e76824e3213bbf26fa31f8fdf0d1b85c7a283b0701790111c19792d0");
    expect(EQUIPMENT_CATALOG.filter(item => item.slot === "weapon")).toHaveLength(36);
    expect(EQUIPMENT_CATALOG.filter(item => item.category === "armor")).toHaveLength(30);
    expect(EQUIPMENT_CATALOG.filter(item => item.category === "accessory")).toHaveLength(8);
    expect(EQUIPMENT_MODEL_IDS).toEqual(EQUIPMENT_CATALOG.map(item => item.id));
  });

  it("preserves historical recipes except the three crown spire contact positions", () => {
    const recipes = structuredClone(EQUIPMENT_CATALOG.map(item => getEquipmentRecipe(item.id)));
    const crown = recipes[EQUIPMENT_CATALOG.findIndex(item => item.id === "signal-crown")]!;
    expect(crown.parts.filter(part => part.id.startsWith("spire-"))).toHaveLength(3);
    for (const side of [-1, 0, 1]) {
      const spire = crown.parts.find(part => part.id === `spire-${side}`)!;
      expect(spire.position).toEqual([side * .09, .04 + (side === 0 ? .17 : .11) / 2, Math.sqrt(.14 ** 2 - (side * .09) ** 2)]);
      spire.position = [side * .09, .14, .09];
    }
    expect(digest(recipes)).toBe("db04653da3f110ce5b35721e0aaf52d567973ef667449bd1184ede38c1040f2c");
    expect(digest(EQUIPMENT_CATALOG.map(item => getEquipmentRecipe(item.id)))).toBe("37d88d0c88bf2c36ed1e81c24c6c68700e4f493272b707aa2401a6b43edfa3ca");
  });

  it("resolves localized definitions by stable ID and rejects unknown IDs", () => {
    for (const item of EQUIPMENT_CATALOG) expect(getEquipmentDefinition(item.id)).toBe(item);
    expect(getEquipmentDefinition("unknown-equipment")).toBeUndefined();
    expect(getEquipmentRecipe("unknown-equipment")).toBeUndefined();
  });

  it("returns isolated recipe copies", () => {
    const recipe = getEquipmentRecipe("starter-blade")!;
    recipe.parts[0].position[0] = 999;
    expect(getEquipmentRecipe("starter-blade")!.parts[0].position[0]).not.toBe(999);
  });
});
