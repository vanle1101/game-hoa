import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LobbyRewardsWidget, { filterLobbyRewards, rewardPresentation } from "../../src/components/game/LobbyRewardsWidget";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { STARTER_REWARDS, withStarterRewards } from "../../src/domain/starter-rewards";

const now = "2026-10-27T00:00:00.000Z";
const context = (eventId: string) => ({ userId: "owner", eventId, now, random: () => 0.5 });

describe("lobby rewards are real redeemable state", () => {
  it("seeds six stable rewards without replacing custom or archived entries", () => {
    const custom = { id: "personal:tea", name: "Tea break", description: "", cost: 30, redemptions: 3, archived: true };
    const first = withStarterRewards([custom])!;
    expect(first).toHaveLength(7);
    expect(first[0]).toEqual(custom);
    expect(new Set(first.map(reward => reward.id)).size).toBe(7);
    expect(withStarterRewards(first)).toBe(first);
    first[1].archived = true;
    expect(withStarterRewards(first)).toBe(first);
    expect(first[1].archived).toBe(true);
  });

  it("seeds during reconciliation and redeems through authoritative Gold logic", () => {
    const initial = createInitialState("owner", now);
    initial.gold = 1000;
    const reconciled = applyAction(initial, { type: "reconcile" }, context("reconcile-rewards"));
    expect(reconciled.state.realLifeRewards?.map(reward => reward.id)).toEqual(STARTER_REWARDS.map(reward => reward.id));
    const repeat = applyAction(reconciled.state, { type: "reconcile" }, context("reconcile-again"));
    expect(repeat.state.realLifeRewards).toHaveLength(6);
    const redeemed = applyAction(repeat.state, { type: "reward.redeem", rewardId: "starter-reward:cafe" }, context("redeem-cafe"));
    expect(redeemed.state.gold).toBe(910);
    expect(redeemed.state.realLifeRewards?.find(reward => reward.id === "starter-reward:cafe")?.redemptions).toBe(1);
    expect(redeemed.state.ledger.at(-1)?.amount).toBe(-90);
  });

  it("renders prices and all four real filter controls from state", () => {
    const state = createInitialState("owner", now);
    state.realLifeRewards = withStarterRewards(state.realLifeRewards);
    state.gold = 100;
    const html = renderToStaticMarkup(createElement(LobbyRewardsWidget, {
      state, onNavigate: vi.fn(), onRedeem: vi.fn(), actionsDisabled: false,
    }));
    for (const label of ["Tất cả", "Vật phẩm", "Bất cứ đâu", "Đời sống"]) expect(html).toContain(label);
    for (const reward of STARTER_REWARDS) expect(html).toContain(reward.name);
    expect(html).toContain("Chưa đủ Gold");
    expect(rewardPresentation(STARTER_REWARDS[0]).category).toBe("item");
    expect(rewardPresentation(STARTER_REWARDS[3]).category).toBe("life");
    expect(filterLobbyRewards(state.realLifeRewards!, "item").map(reward => reward.id)).toEqual(["starter-reward:headphones", "starter-reward:skin"]);
    expect(filterLobbyRewards(state.realLifeRewards!, "anywhere").map(reward => reward.id)).toEqual(["starter-reward:skill-setup", "starter-reward:cafe"]);
    expect(filterLobbyRewards(state.realLifeRewards!, "life").map(reward => reward.id)).toEqual(["starter-reward:resort", "starter-reward:bedroom"]);
  });
});
