import { describe, expect, it } from "vitest";
import { ITEMS, LOOT_WEIGHTS } from "../../src/domain/catalog";
import { equipmentLoot } from "../../src/domain/engine";

function eligibleTiers(level: number) {
  return Object.entries(LOOT_WEIGHTS).map(([rarity, weight]) => ({ rarity, weight, items: ITEMS.filter((item) => item.price > 0 && item.level <= level + 2 && item.rarity === rarity) })).filter((tier) => tier.items.length > 0);
}

describe("equipment loot tier weighting", () => {
  it.each([1, 3, 7, 100])("uses configured rarity proportions independent of item counts at level %i", (level) => {
    const tiers = eligibleTiers(level);
    const totalWeight = tiers.reduce((sum, tier) => sum + tier.weight, 0);
    const samples = totalWeight * 100;
    const counts = new Map<string, number>();
    for (let index = 0; index < samples; index++) {
      const item = equipmentLoot(level, (index + 0.5) / samples);
      expect(item.price).toBeGreaterThan(0);
      expect(item.level).toBeLessThanOrEqual(level + 2);
      counts.set(item.rarity, (counts.get(item.rarity) ?? 0) + 1);
    }
    for (const tier of tiers) expect(counts.get(tier.rarity)).toBe(tier.weight * 100);
    expect([...counts.keys()].sort()).toEqual(tiers.map((tier) => tier.rarity).sort());
  });

  it("reaches every eligible item uniformly within its rarity interval", () => {
    const level = 100;
    const tiers = eligibleTiers(level);
    const totalWeight = tiers.reduce((sum, tier) => sum + tier.weight, 0);
    let offset = 0;
    for (const tier of tiers) {
      tier.items.forEach((item, index) => {
        const roll = (offset + tier.weight * (index + 0.5) / tier.items.length) / totalWeight;
        expect(equipmentLoot(level, roll).id).toBe(item.id);
      });
      offset += tier.weight;
    }
  });

  it("handles interval extremes without selecting free or level-locked items", () => {
    const tiers = eligibleTiers(1);
    expect(equipmentLoot(1, 0)).toBe(tiers[0].items[0]);
    expect(equipmentLoot(1, 1 - Number.EPSILON)).toBe(tiers.at(-1)!.items.at(-1));
    expect(() => equipmentLoot(-100, 0)).toThrow("No eligible loot.");
  });

  it.each([-1, 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects invalid random input %s", (roll) => {
    expect(() => equipmentLoot(1, roll)).toThrow("Random source failed.");
  });
});
