import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const readPanel = (name: string) => readFileSync(resolve(root, "src/components/game", name), "utf8");

describe("Vietnamese localization for ReferencePanels, ProgressionExtras, FinancePanel, and ButlerPanel", () => {
  it("translates ReferencePanels user-facing headers, kickers, rarity options, and currency labels while preserving machine IDs", () => {
    const source = readPanel("ReferencePanels.tsx");

    for (const removed of [
      "PERSONAL ARMORY",
      "ARMORY ARCHIVE",
      "The Exchange",
      "EQUIPMENT MARKET",
      "NEURAL FABRICATION",
      "BLUEPRINT READY",
      "ENHANCEMENT +",
      "EARNED REWARDS",
      "ENCOUNTER COMPLETE",
      "SIX PATHS / ONE LIFE",
      "COMPANION NETWORK",
      "YOUR COMPANION",
      "MEET YOUR COMPANION",
      "<small>GOLD</small>",
      "<span>GOLD</span>",
      "LEVEL {item.level}",
      "UPGRADE +",
    ]) {
      expect(source).not.toContain(removed);
    }

    for (const expected of [
      "KHO VŨ KHÍ CÁ NHÂN",
      "LƯU TRỮ KHO VŨ KHÍ",
      "Sàn giao dịch",
      "CHỢ TRANG BỊ",
      "CHẾ TÁC CÔNG NGHỆ",
      "BẢN VẼ SẴN SÀNG",
      "PHẦN THƯỞNG ĐẠT ĐƯỢC",
      "HOÀN THÀNH TRẬN ĐẤU",
      "SÁU NHÁNH / MỘT HÀNH TRÌNH",
      "MẠNG LƯỚI ĐỒNG HÀNH",
      "BẠN ĐỒNG HÀNH CỦA BẠN",
      "GẶP GỠ BẠN ĐỒNG HÀNH",
      "Phổ thông",
      "Khác thường",
      "Hiếm",
      "Sử thi",
      "Huyền thoại",
      "Thần thoại",
      "<option key={r} value={r}>{rarityNames[r as Rarity]}</option>",
    ]) {
      expect(source).toContain(expected);
    }

    for (const actionType of [
      "item.unequip",
      "item.equip",
      "item.buy",
      "item.craft",
      "item.upgrade",
      "skill.unlock",
      "pet.care",
      "pet.select",
      "pet.adopt",
      "pet.accessory.buy",
      "pet.accessory.remove",
      "pet.accessory.equip",
    ]) {
      expect(source).toContain(`'${actionType}'`);
    }
  });

  it("translates ProgressionExtras consumable headers and effect labels while preserving HP, XP, and action types", () => {
    const source = readPanel("ProgressionExtras.tsx");

    expect(source).not.toContain("HỒI PHỤC & BUFF");
    expect(source).toContain("HỒI PHỤC & TĂNG CƯỜNG");
    expect(source).toContain('const effectNames: Record<string, string> = { hp: "HP", energy: "NĂNG LƯỢNG", xp_boost: "TĂNG XP" }');

    for (const preserved of [
      'value="short"',
      'value="swept"',
      'value="mohawk"',
      "consumable.buy",
      "consumable.consume",
      "reward.create",
      "reward.redeem",
      "reward.archive",
      "character.update",
    ]) {
      expect(source).toContain(preserved);
    }
  });

  it("translates FinancePanel header eyebrow and CSV instructions while preserving CSV schema and command types", () => {
    const source = readPanel("FinancePanel.tsx");

    expect(source).not.toContain("PERSONAL FINANCE · VND");
    expect(source).toContain("TÀI CHÍNH CÁ NHÂN · VND");
    expect(source).toContain("income (thu nhập)");
    expect(source).toContain("expense (chi tiêu)");
    expect(source).toContain('useState("date,kind,amount,category,note\\n")');
    expect(source).toContain('<option value="expense">Chi tiêu</option><option value="income">Thu nhập</option>');
  });

  it("translates ButlerPanel eyebrows, provider badges, and step labels while retaining NOVA brand and API payloads", () => {
    const source = readPanel("ButlerPanel.tsx");

    for (const removed of [
      "NOVA · YOUR PERSONAL BUTLER",
      "DEMO · Kế hoạch mẫu",
      "Remote AI đã cấu hình",
      "PROPOSAL PREVIEW",
      "SAVED PLANS",
      "Không tải được AI Butler.",
      'proposal.provider === "demo" ? "Demo" : "Remote AI"',
      '>STEP {',
    ]) {
      expect(source).not.toContain(removed);
    }

    for (const expected of [
      "NOVA · QUẢN GIA CÁ NHÂN CỦA BẠN",
      "BẢN THỬ · Kế hoạch mẫu",
      "AI từ xa đã cấu hình",
      "XEM TRƯỚC ĐỀ XUẤT",
      "KẾ HOẠCH ĐÃ LƯU",
      "Không tải được Quản gia NOVA.",
      'proposal.provider === "demo" ? "Bản thử" : "AI từ xa"',
      ">BƯỚC {",
    ]) {
      expect(source).toContain(expected);
    }
  });
});
