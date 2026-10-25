import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_PALETTES,
  COSMETICS,
  DEFAULT_APPEARANCE,
  STARTER_COSMETICS,
  STARTER_OUTFITS,
} from "../../src/character/catalog";
import { equipCosmetic, grantStarterCosmetics, mergeAppearance, STARTER_COSMETICS_VERSION } from "../../src/character/ownership";
import { applyAction, createInitialState, derivedStats } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { LOWER_V7_COSMETICS } from "../../src/character/fashion-lower-v7";
import { UPPER_V7_COSMETICS } from "../../src/character/fashion-upper-v7";
import { STARTER_POLO_V7_COSMETICS } from "../../src/character/starter-polo-v7";
import { ACCESSORY_V7_COSMETICS } from "../../src/character/fashion-accessory-v7";

const expansionCosmetics = [...LOWER_V7_COSMETICS, ...UPPER_V7_COSMETICS, ...STARTER_POLO_V7_COSMETICS, ...ACCESSORY_V7_COSMETICS];

const cosmeticLabels: Record<string, [string, string]> = {
  "runner-jacket": [
    "Áo khoác Nhịp Phố",
    "Trang phục khởi đầu miễn phí."
  ],
  "runner-pants": [
    "Quần Nhịp Phố",
    "Phong cách đường phố gọn gàng."
  ],
  "runner-shoes": [
    "Giày Nhịp Phố",
    "Bước đầu trên hành trình."
  ],
  "corporate-top": [
    "Áo Công Sở Tương Lai",
    "Bộ khởi đầu công sở tương lai."
  ],
  "corporate-pants": [
    "Quần Công Sở Tương Lai",
    "Đường cắt thanh lịch."
  ],
  "corporate-shoes": [
    "Giày Công Sở Tương Lai",
    "Hoàn thiện bộ công sở."
  ],
  "technician-top": [
    "Áo Kỹ Thuật Đêm",
    "Bộ khởi đầu cho người sáng tạo."
  ],
  "technician-pants": [
    "Quần Kỹ Thuật Đêm",
    "Quần kỹ thuật tiện dụng."
  ],
  "technician-shoes": [
    "Giày Kỹ Thuật Đêm",
    "Bốt cho một đêm sáng tạo."
  ],
  "daily-tee": [
    "Áo thun Tín Hiệu Ngày",
    "Áo thun nhẹ cho mọi lịch trình."
  ],
  "signal-turtleneck": [
    "Áo cổ lọ Tín Hiệu",
    "Cổ cao tối giản, dễ phối lớp."
  ],
  "utility-vest": [
    "Áo ghi-lê Tiện Dụng",
    "Lớp giáp nhẹ với túi tiện dụng."
  ],
  "wide-leg-pants": [
    "Quần Ống Rộng",
    "Dáng rộng thoải mái, giữ đường nét gọn gàng."
  ],
  "city-high-tops": [
    "Giày cổ cao Phố Thị",
    "Giày cổ cao cho những chuyến đi dài."
  ],
  "starter-pleated-pants": [
    "Quần xếp ly Hành Trình",
    "Nếp ly rõ nét, phối tự do cùng áo khởi đầu."
  ],
  "starter-loafers": [
    "Giày lười Đô Thị",
    "Giày lười đế thấp với quai kim loại."
  ],
  "starter-cyber-coat": [
    "Áo choàng Công Nghệ",
    "Áo khoác dài mở ra nhiều cách phối."
  ],
  "starter-bomber": [
    "Áo khoác bo gấu Tín Hiệu",
    "Áo khoác ngắn gọn gàng với bo tay tương phản."
  ],
  "starter-rain-shell": [
    "Áo khoác Chống Mưa",
    "Lớp áo chống mưa cho thành phố ánh sáng."
  ],
  "starter-wrist-device": [
    "Thiết bị cổ tay",
    "Màn hình nhỏ đồng bộ với nhịp sống."
  ],
  "starter-scarf": [
    "Khăn cổ Hành Trình",
    "Một dải màu cho bộ đồ cơ bản."
  ],
  "starter-holo-badge": [
    "Huy hiệu Quang Ảnh",
    "Phù hiệu nhỏ có ánh sáng riêng."
  ],
  "starter-ear-cuff": [
    "Khuyên vành tai khởi đầu",
    "Điểm kim loại nhẹ ở vành tai."
  ],
  "violet-coat": [
    "Áo khoác Dư Âm Tím",
    "Áo dài với đường viền phát sáng."
  ],
  "amber-hoodie": [
    "Áo nỉ mũ Bình Minh",
    "Một chút ấm áp giữa thành phố."
  ],
  "cargo-pants": [
    "Quần túi hộp Công Nghệ",
    "Túi hộp và đường cắt mạnh mẽ."
  ],
  "neon-boots": [
    "Giày bốt Ánh Sáng",
    "Đế giày phát sáng."
  ],
  "street-cap": [
    "Mũ lưỡi trai Phố Thị",
    "Phụ kiện tạo điểm nhấn."
  ],
  "holo-visor": [
    "Kính chắn Quang Ảnh",
    "Tròng kính xanh ngọc trong suốt."
  ],
  "ember-cropped-jacket": [
    "Áo khoác lửng Vệt Lửa",
    "Đường cắt ngắn với ánh cam nóng."
  ],
  "silk-shell": [
    "Áo lụa Cổ Đứng",
    "Bề mặt mịn, cổ đứng sắc nét."
  ],
  "mesh-overshirt": [
    "Áo sơ mi khoác Lưới Thoáng",
    "Lớp sơ mi dáng hộp với túi ngực."
  ],
  "carbon-trench": [
    "Áo khoác dài Mạch Đen",
    "Áo khoác dáng dài với ve áo sắc nét."
  ],
  "aurora-parka": [
    "Áo khoác ấm Cực Quang",
    "Áo khoác dày dặn cho đêm lạnh."
  ],
  "graphite-wide-leg": [
    "Quần ống rộng Than Chì",
    "Dáng rộng với đường gấp cân bằng."
  ],
  "silver-pleat": [
    "Quần xếp ly Ánh Bạc",
    "Nếp gấp ánh kim cho phong cách thành thị."
  ],
  "pulse-high-tops": [
    "Giày cổ cao Xung Nhịp",
    "Cổ giày cao với đế xung năng lượng."
  ],
  "mono-loafers": [
    "Giày lười Đơn Sắc",
    "Giày lười bóng cho bộ tối giản."
  ],
  "halo-beanie": [
    "Mũ len Vầng Sáng",
    "Mũ len có viền phát sáng."
  ],
  "holo-scarf": [
    "Khăn đôi Quang Ảnh",
    "Khăn đôi phản chiếu ánh đèn."
  ],
  "tactical-gloves": [
    "Găng tay Chiến Thuật",
    "Găng hở ngón với cổ tay gia cố."
  ],
  "neon-pack": [
    "Ba lô Quang Sắc",
    "Ba lô sau lưng với quai phát sáng."
  ],
  "half-mask": [
    "Mặt nạ Nửa Khuôn",
    "Mặt nạ gọn, giữ nguyên biểu cảm mắt."
  ],
  "chain-collar": [
    "Vòng cổ Mắt Xích",
    "Trang sức cổ kim loại sáng."
  ]
};

const legacyCosmetics = COSMETICS.filter(item => Object.hasOwn(cosmeticLabels, item.id));
const legacyStarterCosmetics = STARTER_COSMETICS.filter(id => Object.hasOwn(cosmeticLabels, id));

const starterOutfitLabels: Record<string, string> = {
  "street-runner": "Nhịp phố",
  "neo-corporate": "Công sở tương lai",
  "night-technician": "Kỹ thuật đêm"
};

const bannedEnglishTokens =
  /\b(Runner|Neo-Corporate|Night Technician|Daily Signal|Signal|Turtleneck|Vest|Utility|Wide-Leg|City|High-Tops|Transit|Pleat|Metro|Loafers|Outerwear|Cyber|Coat|Bomber|Rain|Shell|Holo|Ear|Cuff|Starter|Violet|Hoodie|Cargo|Neon|Street|Ember|Crop|Silk|Overshirt|Mesh|Trench|Carbon|Parka|Aurora|Graphite|Silver|Pulse|Mono|Halo|Beanie|Split|Tactical|Pack|Half-Frame|Chain|phom|cyan)\b/i;

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const now = "2026-10-16T12:00:00Z";
const act = (state: GameState, action: Action, eventId = "cosmetic-test") =>
  applyAction(state, action, { userId: "owner", now, eventId, random: () => 0.5 }).state;

describe("Vietnamese cosmetic & starter outfit localization", () => {
  it("preserves 44 legacy labels and requires Vietnamese names and descriptions for every expansion", () => {
    expect(legacyCosmetics).toHaveLength(44);
    expect(COSMETICS).toHaveLength(44 + expansionCosmetics.length);
    expect(COSMETICS.filter(item => !Object.hasOwn(cosmeticLabels, item.id)).map(item => item.id).sort()).toEqual(expansionCosmetics.map(item => item.id).sort());
    expect(STARTER_OUTFITS).toHaveLength(3);
    expect(legacyCosmetics.map((item) => item.id).sort()).toEqual(Object.keys(cosmeticLabels).sort());
    expect(new Set(COSMETICS.map(item => item.id)).size).toBe(COSMETICS.length);
    expect(STARTER_OUTFITS.map((item) => item.id).sort()).toEqual(Object.keys(starterOutfitLabels).sort());

    for (const item of COSMETICS) {
      if (Object.hasOwn(cosmeticLabels, item.id)) expect([item.name, item.description], item.id).toEqual(cosmeticLabels[item.id]);
      expect(item.name.normalize("NFC"), item.id).toBe(item.name);
      expect(item.description.normalize("NFC"), item.id).toBe(item.description);
      expect(item.name.length, item.id).toBeLessThanOrEqual(32);
      expect(item.description.length, item.id).toBeLessThanOrEqual(80);
      expect(item.name, item.id).toMatch(/[^\x00-\x7F]/);
      expect(item.description, item.id).toMatch(/[^\x00-\x7F]/);
      expect(item.name, item.id).not.toMatch(bannedEnglishTokens);
      expect(item.description, item.id).not.toMatch(bannedEnglishTokens);
    }

    for (const outfit of STARTER_OUTFITS) {
      expect(outfit.name, outfit.id).toBe(starterOutfitLabels[outfit.id]);
      expect(outfit.name.normalize("NFC"), outfit.id).toBe(outfit.name);
      expect(outfit.name, outfit.id).toMatch(/[^\x00-\x7F]/);
      expect(outfit.name, outfit.id).not.toMatch(bannedEnglishTokens);
    }
  });

  it("preserves all non-label cosmetic metadata, starter sets, palettes, and default appearance", () => {
    const cosmeticsNonLabel = legacyCosmetics.map((item) =>
      Object.fromEntries(Object.entries(item).filter(([key]) => key !== "name" && key !== "description")),
    );
    const outfitsNonLabel = STARTER_OUTFITS.map((outfit) =>
      Object.fromEntries(Object.entries(outfit).filter(([key]) => key !== "name" && key !== "description")),
    );
    const fullProjection = {
      DEFAULT_APPEARANCE,
      COSMETICS_NONLABEL: cosmeticsNonLabel,
      STARTER_COSMETICS: legacyStarterCosmetics,
      STARTER_OUTFITS_NONLABEL: outfitsNonLabel,
      APPEARANCE_PALETTES,
    };

    expect(digest(cosmeticsNonLabel)).toBe("9bc971e047a21ce5d7c2fdb6bd5e140f7091686fc5d6cc2fd25aed0270c9dd15");
    expect(digest(outfitsNonLabel)).toBe("9984577d39057ece0838a7b4285c49ef15a64dd8b82ff284ccde3b2470b9eb9e");
    expect(digest(DEFAULT_APPEARANCE)).toBe("814a3b91004629eaea8ccdd55a6a1c2f1a20be195f4cc2d19d9df10339069c8f");
    expect(digest(APPEARANCE_PALETTES)).toBe("4ecee8faeebef32aef8c0643672a2fa19587b9019b96e848d921101cf9108a91");
    expect(digest(fullProjection)).toBe("4a568a05da6c2e036e1b8345e937c66299cfcda7f49f47f39fbc45b9f641ac59");
    expect(legacyStarterCosmetics).toHaveLength(23);
    expect(legacyCosmetics.filter((item) => !item.starter)).toHaveLength(21);
    expect(STARTER_COSMETICS).toEqual(COSMETICS.filter(item => item.starter && item.price === 0).map(item => item.id));
  });

  it("keeps existing avatar appearances, owned cosmetic IDs, purchases, and save migrations completely unchanged", () => {
    const initial = createInitialState("owner", now);
    expect(initial.ownedCosmetics).toEqual(STARTER_COSMETICS);
    expect(initial.equippedCosmetics).toEqual({
      top: "runner-jacket",
      bottom: "runner-pants",
      shoes: "runner-shoes",
    });

    const legacySave = structuredClone(initial);
    delete legacySave.starterCosmeticsVersion;
    legacySave.ownedCosmetics = ["runner-jacket", "amber-hoodie", "holo-visor"];
    legacySave.equippedCosmetics = { top: "amber-hoodie", accessory: "holo-visor" };
    legacySave.character.appearance = mergeAppearance(undefined, { presentation: "feminine", body: "athletic" });
    legacySave.character.xp = 900;
    legacySave.gold = 400;

    const reconciled = act(legacySave, { type: "reconcile" }, "reconcile-legacy");
    expect(reconciled.starterCosmeticsVersion).toBe(STARTER_COSMETICS_VERSION);
    expect(reconciled.ownedCosmetics).toEqual(expect.arrayContaining([...STARTER_COSMETICS, "amber-hoodie", "holo-visor"]));
    expect(reconciled.equippedCosmetics).toEqual({ top: "amber-hoodie", accessory: "holo-visor" });
    expect(reconciled.character.appearance).toEqual(legacySave.character.appearance);
    expect(grantStarterCosmetics(reconciled)).toBe(false);

    const bought = act(reconciled, { type: "cosmetic.buy", cosmeticId: "silk-shell" }, "buy-silk-shell");
    expect(bought.ownedCosmetics).toContain("silk-shell");
    expect(bought.gold).toBe(270);
    expect(bought.journal.at(-1)?.title).toBe("Đã mua Áo lụa Cổ Đứng");

    const worn = act(bought, { type: "cosmetic.equip", cosmeticId: "silk-shell" }, "equip-silk-shell");
    expect(worn.equippedCosmetics?.top).toBe("silk-shell");
    expect(worn.journal.at(-1)?.title).toBe("Đã mặc Áo lụa Cổ Đứng");
    expect(derivedStats(worn)).toEqual(derivedStats(bought));

    const outfitApplied = act(worn, { type: "cosmetic.outfit", outfitId: "night-technician" }, "outfit-tech");
    expect(outfitApplied.equippedCosmetics).toMatchObject({
      top: "technician-top",
      bottom: "technician-pants",
      shoes: "technician-shoes",
      outerwear: "starter-rain-shell",
      accessory: "starter-holo-badge",
    });
    expect(outfitApplied.journal.at(-1)?.title).toBe("Đã mặc bộ Kỹ thuật đêm");

    const coatConflicts = equipCosmetic(outfitApplied.equippedCosmetics, COSMETICS.find((c) => c.id === "violet-coat")!);
    expect(coatConflicts.top).toBe("violet-coat");
    expect(coatConflicts.outerwear).toBeUndefined();
  });
});
