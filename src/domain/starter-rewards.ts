import type { RealLifeReward } from "./types";

/** Personal reward suggestions. Redemption spends only in-game Gold. */
export const STARTER_REWARDS: readonly RealLifeReward[] = [
  { id: "starter-reward:headphones", name: "Tai nghe không dây", description: "Mốc tự thưởng: chọn một bộ tai nghe khi bạn sẵn sàng.", cost: 180, redemptions: 0, archived: false },
  { id: "starter-reward:skin", name: "Skin nhân vật", description: "Mốc tự thưởng cho việc tùy chỉnh ngoại hình nhân vật.", cost: 120, redemptions: 0, archived: false },
  { id: "starter-reward:skill-setup", name: "Gói setup kỹ năng", description: "Mốc tự thưởng cho góc học tập và kỹ năng mới.", cost: 150, redemptions: 0, archived: false },
  { id: "starter-reward:resort", name: "Ngày nghỉ tại resort", description: "Lên kế hoạch một ngày nghỉ thật khi điều kiện phù hợp.", cost: 750, redemptions: 0, archived: false },
  { id: "starter-reward:bedroom", name: "Nâng cấp phòng ngủ", description: "Mốc tự thưởng để cải thiện không gian nghỉ ngơi.", cost: 480, redemptions: 0, archived: false },
  { id: "starter-reward:cafe", name: "Thẻ cafe cao cấp", description: "Mốc tự thưởng cho một buổi nghỉ ngắn.", cost: 90, redemptions: 0, archived: false },
];

/** Preserve user-created rewards and redemption history; never resurrect archived entries. */
export function withStarterRewards(existing: RealLifeReward[] | undefined): RealLifeReward[] | undefined {
  const rewards = existing ?? [];
  const seen = new Set(rewards.map(reward => reward.id));
  const missing = STARTER_REWARDS.filter(reward => !seen.has(reward.id));
  return missing.length ? [...rewards, ...missing.map(reward => ({ ...reward }))] : existing;
}
