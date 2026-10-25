import { describe, expect, it } from "vitest";
import { COSMETICS, STARTER_COSMETICS } from "../../src/character/catalog";
import { mergeAppearance, STARTER_COSMETICS_VERSION } from "../../src/character/ownership";
import { FURNITURE, ITEMS } from "../../src/domain/catalog";
import { applyAction, createInitialState, derivedStats } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { actionSchema } from "../../src/domain/validation";
import { EQUIPMENT_CATALOG } from "../../src/equipment/catalog";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES } from "../../src/furniture/catalog";

const now = "2026-10-16T12:00:00Z";
const paidCosmetics = COSMETICS.filter(item => item.price > 0);
const paidGear = ITEMS.filter(item => item.price > 0);
const freeGear = ITEMS.filter(item => item.price === 0);
const requiredFurnitureCategories = ["bed", "seating", "desk", "chair", "storage", "electronics", "light", "kitchen", "decor", "workshop", "collectible"] as const;
const act = (state: GameState, action: Action, eventId: string) =>
  applyAction(state, action, { userId: "owner", now, eventId, random: () => 0.5 });
const eligibleState = (price: number, level = 1) => {
  const state = createInitialState("owner", now);
  state.gold = price;
  state.character.xp = (level - 1) ** 2 * 100;
  return state;
};
const expectDebit = (before: GameState, after: GameState, price: number, eventId: string) => {
  expect(after.gold).toBe(before.gold - price);
  expect(after.ledger).toHaveLength(before.ledger.length + 1);
  expect(after.ledger.slice(0, -1)).toEqual(before.ledger);
  expect(after.ledger.at(-1)).toMatchObject({ eventId, amount: -price, balance: after.gold, at: now });
  expect(after.journal.filter(event => event.id === eventId)).toHaveLength(1);
};
const expectRejectedUnchanged = (state: GameState, action: Action, eventId: string, message?: RegExp) => {
  const before = structuredClone(state);
  if (message) expect(() => act(state, action, eventId)).toThrow(message);
  else expect(() => act(state, action, eventId)).toThrow();
  expect(state).toEqual(before);
};
const expectRetry = (state: GameState, action: Action, eventId: string) => {
  const before = structuredClone(state);
  const retry = act(state, action, eventId);
  expect(retry.state).toBe(state);
  expect(retry.events).toEqual([]);
  expect(retry.state).toEqual(before);
};

describe(`V7 public catalog economy: ${FURNITURE.length} furniture, ${COSMETICS.length} cosmetics (${paidCosmetics.length} paid / ${STARTER_COSMETICS.length} starter), ${ITEMS.length} gear`, () => {
  it("preserves baseline coverage and meets expanded catalog count targets", () => {
    expect(FURNITURE.length).toBeGreaterThanOrEqual(100);
    expect(COSMETICS.length).toBeGreaterThanOrEqual(86);
    expect(ITEMS.length).toBeGreaterThanOrEqual(74);
    expect(FURNITURE.length).toBeGreaterThanOrEqual(120);
    expect(COSMETICS.length).toBeGreaterThanOrEqual(121);
    expect(paidCosmetics.length).toBeGreaterThanOrEqual(97);
    expect(STARTER_COSMETICS.length).toBeGreaterThanOrEqual(24);
    expect(FURNITURE_CATEGORIES).toEqual(requiredFurnitureCategories);
  });

  it("projects every public furniture and gear ID with authoritative price, level and slot/category", () => {
    expect(FURNITURE).toEqual(FURNITURE_CATALOG.map(({ id, name, description, price, category, width, depth, height, level, color, modelUrl }) => ({ id, name, description, price, category, width, depth, height, level, color, modelUrl })));
    expect(ITEMS).toEqual(EQUIPMENT_CATALOG.map(({ id, name, description, rarity, slot, attack, defense, critRate, level, price }) => ({ id, name, description, rarity, slot, attack, defense, critRate, level, price })));
    for (const catalog of [FURNITURE, COSMETICS, ITEMS]) {
      expect(new Set(catalog.map(item => item.id)).size).toBe(catalog.length);
      for (const item of catalog) {
        expect(Number.isSafeInteger(item.price), item.id).toBe(true);
        expect(item.price, item.id).toBeGreaterThanOrEqual(0);
        expect(Number.isSafeInteger(item.level ?? 1), item.id).toBe(true);
        expect(item.level ?? 1, item.id).toBeGreaterThanOrEqual(1);
      }
    }
    expect(STARTER_COSMETICS.slice().sort()).toEqual(COSMETICS.filter(item => item.starter && item.price === 0).map(item => item.id).sort());
    expect(paidCosmetics.length + STARTER_COSMETICS.length).toBe(COSMETICS.length);
  });

  it.each(requiredFurnitureCategories)("includes purchasable furniture in required %s category", category => {
    expect(FURNITURE.some(item => item.category === category && item.price > 0)).toBe(true);
  });

  it.each(["top", "outerwear", "bottom", "shoes", "headwear", "eyewear", "accessory", "gloves", "back", "face", "jewelry"] as const)("includes paid cosmetics in required %s slot", slot => {
    expect(paidCosmetics.some(item => item.slot === slot)).toBe(true);
  });

  it.each(["weapon", "head", "chest", "gloves", "boots", "accessory1", "accessory2", "relic"] as const)("includes paid gear in required %s slot", slot => {
    expect(paidGear.some(item => item.slot === slot)).toBe(true);
  });

  it.each(["tactical", "katana", "energy", "heavy", "dual", "relic-weapon", "armor", "accessory"] as const)("includes gear in required %s category", category => {
    expect(EQUIPMENT_CATALOG.some(item => item.category === category)).toBe(true);
  });
});

describe("V7 every paid cosmetic", () => {
  it.each(paidCosmetics)("buys $id at server price without auto-equip, then equips its owned slot", item => {
    const initial = eligibleState(item.price, item.level ?? 1);
    const before = structuredClone(initial);
    const action: Action = { type: "cosmetic.buy", cosmeticId: item.id };
    expect(actionSchema.safeParse(action).success).toBe(true);
    const eventId = `cosmetic-buy:${item.id}`;
    const bought = act(initial, action, eventId).state;
    expect(initial).toEqual(before);
    expect(bought).not.toBe(initial);
    expectDebit(before, bought, item.price, eventId);
    expect(bought.gold).toBe(0);
    expect(bought.ownedCosmetics).toEqual([...before.ownedCosmetics!, item.id]);
    expect(bought.equippedCosmetics).toEqual(before.equippedCosmetics);
    expect(bought.character).toEqual(before.character);
    expect(bought.equipment).toEqual(before.equipment);
    expectRetry(bought, action, eventId);
    expectRejectedUnchanged(bought, action, `duplicate:${item.id}`, /đã sở hữu/);
    const boughtBefore = structuredClone(bought);
    const equip: Action = { type: "cosmetic.equip", cosmeticId: item.id };
    expect(actionSchema.safeParse(equip).success).toBe(true);
    const worn = act(bought, equip, `cosmetic-equip:${item.id}`).state;
    expect(bought).toEqual(boughtBefore);
    expect(worn.equippedCosmetics?.[item.slot]).toBe(item.id);
    expect(worn.ownedCosmetics).toEqual(bought.ownedCosmetics);
    expect(worn.gold).toBe(bought.gold);
    expect(worn.ledger).toEqual(bought.ledger);
    expect(worn.equipment).toEqual(before.equipment);
    expect(derivedStats(worn)).toEqual(derivedStats(initial));
  });

  it.each(paidCosmetics)("rejects insufficient Gold and unowned equip for $id without mutating input", item => {
    const state = eligibleState(item.price - 1, item.level ?? 1);
    expectRejectedUnchanged(state, { type: "cosmetic.buy", cosmeticId: item.id }, `poor:${item.id}`, /Gold/);
    expectRejectedUnchanged(state, { type: "cosmetic.equip", cosmeticId: item.id }, `unowned:${item.id}`, /chưa sở hữu/);
  });

  it.each(paidCosmetics.filter(item => (item.level ?? 1) > 1))("rejects level-locked purchase and owned equip for $id atomically", item => {
    const state = eligibleState(item.price, (item.level ?? 1) - 1);
    expectRejectedUnchanged(state, { type: "cosmetic.buy", cosmeticId: item.id }, `locked-buy:${item.id}`, /cấp/);
    state.ownedCosmetics!.push(item.id);
    expectRejectedUnchanged(state, { type: "cosmetic.equip", cosmeticId: item.id }, `locked-equip:${item.id}`, /cấp/);
  });
});

describe("V7 every furniture definition", () => {
  it.each(FURNITURE)("buys $id at server price, increments quantity and deduplicates a committed retry", item => {
    const initial = eligibleState(item.price, item.level ?? 1);
    initial.ownedFurniture[item.id] = 2;
    const before = structuredClone(initial);
    const action: Action = { type: "furniture.buy", furnitureId: item.id };
    expect(actionSchema.safeParse(action).success).toBe(true);
    const eventId = `furniture-buy:${item.id}`;
    const bought = act(initial, action, eventId).state;
    expect(initial).toEqual(before);
    expectDebit(before, bought, item.price, eventId);
    expect(bought.gold).toBe(0);
    expect(bought.ownedFurniture).toEqual({ ...before.ownedFurniture, [item.id]: 3 });
    expect(bought.placements).toEqual(before.placements);
    expect(bought.building).toEqual(before.building);
    expectRetry(bought, action, eventId);
    const funded = structuredClone(bought);
    funded.gold = item.price;
    const fundedBefore = structuredClone(funded);
    const secondId = `furniture-second:${item.id}`;
    const second = act(funded, action, secondId).state;
    expect(funded).toEqual(fundedBefore);
    expectDebit(fundedBefore, second, item.price, secondId);
    expect(second.ownedFurniture[item.id]).toBe(4);
  });

  it.each(FURNITURE.filter(item => item.price > 0))("rejects insufficient Gold for $id without mutating input", item => {
    expectRejectedUnchanged(eligibleState(item.price - 1, item.level ?? 1), { type: "furniture.buy", furnitureId: item.id }, `poor:${item.id}`, /Gold/);
  });

  it.each(FURNITURE.filter(item => (item.level ?? 1) > 1))("rejects level-locked $id without mutating input", item => {
    expectRejectedUnchanged(eligibleState(item.price, (item.level ?? 1) - 1), { type: "furniture.buy", furnitureId: item.id }, `locked:${item.id}`, /level/);
  });
});

describe("V7 every gear definition", () => {
  it.each(paidGear)("purchases $id and equips the returned inventory instance into $slot", item => {
    const initial = eligibleState(item.price, item.level);
    const before = structuredClone(initial);
    const action: Action = { type: "item.buy", definitionId: item.id };
    expect(actionSchema.safeParse(action).success).toBe(true);
    const eventId = `gear-buy:${item.id}`;
    const bought = act(initial, action, eventId).state;
    expect(initial).toEqual(before);
    expectDebit(before, bought, item.price, eventId);
    expect(bought.gold).toBe(0);
    expect(bought.inventory).toHaveLength(before.inventory.length + 1);
    expect(bought.equipment).toEqual(before.equipment);
    const added = bought.inventory.filter(instance => !before.inventory.some(old => old.id === instance.id));
    expect(added).toHaveLength(1);
    const instance = added[0];
    expect(instance).toMatchObject({ definitionId: item.id, enhancement: 0, acquiredAt: now });
    expectRetry(bought, action, eventId);
    expectRejectedUnchanged(bought, { type: "item.equip", itemId: item.id }, `definition-not-instance:${item.id}`, /do not own/);
    const boughtBefore = structuredClone(bought);
    const equip: Action = { type: "item.equip", itemId: instance.id, slot: item.slot };
    expect(actionSchema.safeParse(equip).success).toBe(true);
    const worn = act(bought, equip, `gear-equip:${item.id}`).state;
    expect(bought).toEqual(boughtBefore);
    expect(worn.equipment[item.slot]).toBe(instance.id);
    expect(worn.inventory).toEqual(bought.inventory);
    expect(worn.gold).toBe(bought.gold);
    expect(worn.ledger).toEqual(bought.ledger);
  });

  it.each(freeGear)("equips the existing free $id instance and rejects its purchase", item => {
    const initial = eligibleState(0, item.level);
    const instance = initial.inventory.find(entry => entry.definitionId === item.id);
    expect(instance).toBeDefined();
    expectRejectedUnchanged(initial, { type: "item.buy", definitionId: item.id }, `free-buy:${item.id}`, /not for sale/);
    const before = structuredClone(initial);
    const worn = act(initial, { type: "item.equip", itemId: instance!.id, slot: item.slot }, `free-equip:${item.id}`).state;
    expect(initial).toEqual(before);
    expect(worn.equipment[item.slot]).toBe(instance!.id);
    expect(worn.inventory).toEqual(before.inventory);
    expect(worn.gold).toBe(before.gold);
    expect(worn.ledger).toEqual(before.ledger);
  });

  it.each(paidGear)("rejects insufficient Gold for $id atomically", item => {
    expectRejectedUnchanged(eligibleState(item.price - 1, item.level), { type: "item.buy", definitionId: item.id }, `poor:${item.id}`, /Gold/);
  });

  it.each(paidGear.filter(item => item.level > 1))("rejects level-locked $id purchase and equip atomically", item => {
    const locked = eligibleState(item.price, item.level - 1);
    expectRejectedUnchanged(locked, { type: "item.buy", definitionId: item.id }, `locked-buy:${item.id}`, /level/);
    const bought = act(eligibleState(item.price, item.level), { type: "item.buy", definitionId: item.id }, `eligible-buy:${item.id}`).state;
    const instance = bought.inventory.find(entry => entry.definitionId === item.id)!;
    bought.character.xp = locked.character.xp;
    expectRejectedUnchanged(bought, { type: "item.equip", itemId: instance.id, slot: item.slot }, `locked-equip:${item.id}`, /level/);
  });
});

describe("V7 starter polo reconciliation", () => {
  it("repairs an explicitly missing polo at the current version once without replacing old ownership, appearance, Gold or ledger", () => {
    const poloId = "v7-starter-zip-polo";
    expect(COSMETICS.find(item => item.id === poloId)).toMatchObject({ starter: true, price: 0, slot: "top" });
    expect(STARTER_COSMETICS).toContain(poloId);
    const initial = createInitialState("owner", now);
    initial.starterCosmeticsVersion = STARTER_COSMETICS_VERSION;
    initial.ownedCosmetics = [...initial.ownedCosmetics!.filter(id => id !== poloId), "amber-hoodie", "legacy-unlisted-cosmetic"];
    initial.equippedCosmetics = { ...initial.equippedCosmetics, top: "amber-hoodie" };
    initial.character.appearance = mergeAppearance(initial.character.appearance, { presentation: "feminine", body: "athletic", facePreset: 5 });
    initial.gold = 317;
    initial.ledger = [{ id: "prior-gold", eventId: "prior-event", amount: 317, balance: 317, reason: "Task reward", at: now }];
    const before = structuredClone(initial);
    const next = act(initial, { type: "reconcile" }, "polo-reconcile").state;
    expect(initial).toEqual(before);
    expect(next.starterCosmeticsVersion).toBe(STARTER_COSMETICS_VERSION);
    expect(next.ownedCosmetics).toEqual([...before.ownedCosmetics!, poloId]);
    expect(next.ownedCosmetics!.filter(id => id === poloId)).toHaveLength(1);
    expect(new Set(next.ownedCosmetics).size).toBe(next.ownedCosmetics!.length);
    expect(next.equippedCosmetics).toEqual(before.equippedCosmetics);
    expect(next.character).toEqual(before.character);
    expect(next.equipment).toEqual(before.equipment);
    expect(next.inventory).toEqual(before.inventory);
    expect(next.gold).toBe(before.gold);
    expect(next.ledger).toEqual(before.ledger);
    expectRetry(next, { type: "reconcile" }, "polo-reconcile");
    expect(act(next, { type: "reconcile" }, "polo-reconcile-again").state).toBe(next);
  });
});

const purchaseActions: Action[] = [
  ...paidCosmetics.map(item => ({ type: "cosmetic.buy" as const, cosmeticId: item.id })),
  ...FURNITURE.map(item => ({ type: "furniture.buy" as const, furnitureId: item.id })),
  ...paidGear.map(item => ({ type: "item.buy" as const, definitionId: item.id })),
];
const injectedFields = [
  { price: 0 }, { clientPrice: 0 }, { gold: 999999 }, { Gold: 999999 },
  { grant: true }, { quantity: 100 }, { ownedCosmetics: ["violet-coat"] },
  { ownedFurniture: { "cloud-bed": 100 } }, { inventory: [] }, { starter: true },
];

describe("V7 authoritative action validation", () => {
  it.each(purchaseActions)("rejects client price, Gold and grants on %j", action => {
    const state = eligibleState(100000, 100);
    expect(actionSchema.safeParse(action).success).toBe(true);
    for (const patch of injectedFields) {
      const forged = { ...action, ...patch };
      expect(actionSchema.safeParse(forged).success, JSON.stringify(patch)).toBe(false);
      expectRejectedUnchanged(state, forged as Action, "forged-purchase");
    }
  });
});
