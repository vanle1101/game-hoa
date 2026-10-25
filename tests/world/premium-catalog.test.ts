import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getFurnitureDefinition } from "@/furniture/catalog";
import { resolveApartmentAssetId, getApartmentAsset } from "@/components/apartment-v21/asset-registry";
import { applyAction, createInitialState } from "@/domain/engine";

describe("purchasable premium apartment assets", () => {
  it.each(["cloud-bed", "corner-sofa", "workstation", "kitchen-island", "bathroom-suite", "coffee-table", "wool-rug"])("%s uses the actual shared GLB", id => {
    const item = getFurnitureDefinition(id);
    const assetId = resolveApartmentAssetId(id);
    expect(item).toMatchObject({ id, name: expect.any(String), price: expect.any(Number), description: expect.any(String) });
    expect(item?.modelUrl).toBe(getApartmentAsset(assetId!).url);
    expect(existsSync(`public${item?.modelUrl}`)).toBe(true);
  });
  it("charges gold and grants ownership through the existing backend economy", () => {
    const state = createInitialState("premium-buyer", "2026-10-21T00:00:00.000Z");
    state.gold = 1000;
    const item = getFurnitureDefinition("bathroom-suite")!;
    const result = applyAction(state, { type: "furniture.buy", furnitureId: item.id }, {
      userId: state.userId, now: "2026-10-21T00:00:00.000Z", eventId: "premium-buy", random: () => 0.5,
    });
    expect(result.state.gold).toBe(1000 - item.price);
    expect(result.state.ownedFurniture[item.id]).toBe(1);
    expect(state.ownedFurniture[item.id]).toBeUndefined();
  });
});
