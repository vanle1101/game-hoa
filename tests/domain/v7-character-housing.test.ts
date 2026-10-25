import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { gameCommand, readGame, readPrivate } from "../../src/server/store";
import { applyAction, createInitialState, derivedStats } from "../../src/domain/engine";
import { actionSchema } from "../../src/domain/validation";
import { FURNITURE, ITEMS } from "../../src/domain/catalog";
import type { Action, GameState } from "../../src/domain/types";
import { COSMETICS, STARTER_COSMETICS } from "../../src/character/catalog";
import { mergeAppearance, STARTER_COSMETICS_VERSION } from "../../src/character/ownership";
import { HOUSING_FLOORS, HOUSING_LAYOUTS, STARTER_FURNITURE_IDS } from "../../src/housing/catalog";
import { canReceiveStarterHome } from "../../src/housing/engine";
import { getBuilding, constructionContext, validateConstruction, quoteConstruction } from "../../src/construction/engine";
import { emptyPlan } from "../../src/construction/grid";

const now = "2026-10-16T12:00:00Z";
const context = (eventId: string) => ({ userId: "owner", now, eventId, random: () => 0.5 });
const settle: Action = { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" };
const act = (state: GameState, action: Action, key = "v7-action") => applyAction(state, action, context(key)).state;

describe("V7 housing settlement", () => {
  it.each(HOUSING_LAYOUTS.flatMap(layout => HOUSING_FLOORS.map(floor => ({ layoutId: layout.id, floor }))))("creates valid furnished $layoutId at tower floor $floor without Gold", ({ layoutId, floor }) => {
    const initial = createInitialState("owner", now);
    const state = act(initial, { ...settle, layoutId, floor });
    expect(state.residence).toEqual({ districtId: "district07", buildingId: "neon-haven", floor, layoutId, completedAt: now });
    expect(state.gold).toBe(0); expect(state.ledger).toEqual([]);
    expect(state.building?.starterGrantApplied).toBe(true);
    expect(state.building?.plan.furniture.map(item => item.furnitureId).sort()).toEqual([...STARTER_FURNITURE_IDS].sort());
    for (const id of STARTER_FURNITURE_IDS) expect(state.ownedFurniture[id]).toBe(1);
    expect(() => validateConstruction(state.building!, state.building!.plan, constructionContext(state))).not.toThrow();
    expect(quoteConstruction(state.building!, emptyPlan(), 0).refund).toBe(0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(initial.building).toBeUndefined();
  });
  it("uses distinct real plans and has no refundable starter credit", () => {
    const plans = HOUSING_LAYOUTS.map(layout => act(createInitialState("owner", now), { ...settle, layoutId: layout.id }).building!.plan);
    expect(new Set(plans.map(plan => JSON.stringify(plan))).size).toBe(3);
    expect(plans.map(plan => plan.floors.length)).toEqual([120, 120, 120]);
  });
  it("deduplicates a committed retry but rejects a new settlement command", () => {
    const state = act(createInitialState("owner", now), settle);
    expect(act(state, settle)).toBe(state);
    expect(() => act(state, { ...settle, floor: 24 }, "second")).toThrow(/đã chọn/);
    expect(canReceiveStarterHome(state)).toBe(false);
  });
  it.each([{ floor: 9 }, { layoutId: "penthouse" }, { districtId: "district99" }, { gold: 500 }, { ownedFurniture: { "cloud-bed": 5 } }, { completedAt: now }])("rejects tampered fields %j", patch => {
    const state = createInitialState("owner", now), before = structuredClone(state);
    const action = { ...settle, ...patch };
    expect(actionSchema.safeParse(action).success).toBe(false);
    expect(() => act(state, action as Action)).toThrow(); expect(state).toEqual(before);
  });
  it("rejects an unknown building using the server catalog", () => {
    expect(() => act(createInitialState("owner", now), { ...settle, buildingId: "client-building" })).toThrow(/không hợp lệ/);
  });
  it("grandfathers existing buildings and all unrelated player data", () => {
    const state = createInitialState("owner", now); state.building = getBuilding(state); state.building.paid = { "floor:0:0:0": 10 }; state.gold = 123; state.ownedFurniture = { "cloud-bed": 2 }; state.character.name = "Legacy";
    const before = structuredClone(state), next = act(state, settle);
    expect(next.building).toEqual(before.building); expect(next.ownedFurniture).toEqual(before.ownedFurniture);
    expect(next.character).toEqual(before.character); expect(next.gold).toBe(123); expect(next.inventory).toEqual(before.inventory); expect(next.ledger).toEqual(before.ledger);
  });
  it("does not replace legacy placements or give old accounts a retroactive starter home", () => {
    const legacy = createInitialState("owner", now); delete legacy.housingStarterEligible;
    expect(act(legacy, settle).building).toBeUndefined();
    legacy.housingStarterEligible = true; legacy.placements = [{ id: "old", furnitureId: "biolume-plant", roomId: "living", x: 1, z: 1, rotation: 0 }]; legacy.ownedFurniture = { "biolume-plant": 1 };
    const next = act(legacy, settle); expect(next.placements).toEqual(legacy.placements); expect(next.ownedFurniture).toEqual(legacy.ownedFurniture); expect(next.building).toBeUndefined();
  });
  it("rejects a save belonging to another user", () => {
    expect(() => act(createInitialState("other", now), settle)).toThrow(/another player/);
  });
});

describe("V7 cosmetic ownership", () => {
  it("migrates free starter IDs once without changing appearance, equipment or currency", () => {
    const state = createInitialState("owner", now); delete state.starterCosmeticsVersion;
    state.ownedCosmetics = ["runner-jacket", "amber-hoodie"]; state.equippedCosmetics = { top: "amber-hoodie" }; state.character.appearance = mergeAppearance(undefined, { presentation: "feminine", body: "athletic" });
    const before = structuredClone(state), migrated = act(state, { type: "reconcile" });
    expect(migrated.starterCosmeticsVersion).toBe(STARTER_COSMETICS_VERSION);
    expect(migrated.ownedCosmetics).toEqual(expect.arrayContaining(STARTER_COSMETICS));
    expect(migrated.ownedCosmetics).toContain("amber-hoodie"); expect(migrated.ownedCosmetics).not.toContain("violet-coat");
    expect(migrated.character).toEqual(before.character); expect(migrated.equippedCosmetics).toEqual(before.equippedCosmetics); expect(migrated.gold).toBe(before.gold);
    const again = act(migrated, { type: "reconcile" }, "again"); expect(again).toBe(migrated);
  });
  it("adds missing free catalog additions even to an intermediate version 7 save", () => {
    const state = createInitialState("owner", now); const missing = STARTER_COSMETICS.at(-1)!;
    state.ownedCosmetics = state.ownedCosmetics!.filter(id => id !== missing);
    const next = act(state, { type: "reconcile" });
    expect(next.ownedCosmetics).toContain(missing); expect(new Set(next.ownedCosmetics).size).toBe(next.ownedCosmetics!.length);
    expect(next.equippedCosmetics).toEqual(state.equippedCosmetics); expect(next.gold).toBe(0); expect(next.ledger).toEqual([]);
    expect(act(next, { type: "reconcile" }, "retry-migration")).toBe(next);
  });
  it("requires actual ownership for individual items and complete outfits", () => {
    const state = createInitialState("owner", now); state.ownedCosmetics = [];
    expect(() => act(state, { type: "cosmetic.equip", cosmeticId: "runner-jacket" })).toThrow(/chưa sở hữu/);
    expect(() => act(state, { type: "cosmetic.outfit", outfitId: "street-runner" })).toThrow(/chưa sở hữu/);
    expect(state.ownedCosmetics).toEqual([]);
  });
  it("rejects level locked buys and equips without changing the input", () => {
    const item = COSMETICS.find(item => (item.level ?? 1) > 1)!;
    expect(item).toBeDefined(); const state = createInitialState("owner", now); state.gold = 1000;
    const before = structuredClone(state);
    expect(() => act(state, { type: "cosmetic.buy", cosmeticId: item.id })).toThrow(/cấp/); expect(state).toEqual(before);
    state.ownedCosmetics!.push(item.id);
    expect(() => act(state, { type: "cosmetic.equip", cosmeticId: item.id })).toThrow(/cấp/);
  });
  it("charges authoritative prices once, retains owned items after equip, and rolls back failure", () => {
    const item = COSMETICS.find(item => item.price > 0 && (item.level ?? 1) === 1)!;
    const initial = createInitialState("owner", now), before = structuredClone(initial);
    expect(() => act(initial, { type: "cosmetic.buy", cosmeticId: item.id })).toThrow(/Gold/); expect(initial).toEqual(before);
    initial.gold = item.price; const purchase = { type: "cosmetic.buy" as const, cosmeticId: item.id };
    const bought = act(initial, purchase); expect(bought.gold).toBe(0); expect(act(bought, purchase)).toBe(bought);
    expect(() => act(bought, purchase, "new-key")).toThrow(/đã sở hữu/);
    const worn = act(bought, { type: "cosmetic.equip", cosmeticId: item.id }, "equip"); expect(worn.ownedCosmetics).toContain(item.id); expect(worn.equippedCosmetics?.[item.slot]).toBe(item.id); expect(derivedStats(worn)).toEqual(derivedStats(initial));
    expect(actionSchema.safeParse({ ...purchase, price: 0 }).success).toBe(false);
  });
  it("resolves legacy coats and new outerwear in both directions without losing ownership", () => {
    const outerwear = COSMETICS.find(item => item.slot === "outerwear" && item.starter)!;
    const initial = createInitialState("owner", now); initial.character.xp = 100; initial.ownedCosmetics!.push("violet-coat");
    const coat = act(initial, { type: "cosmetic.equip", cosmeticId: "violet-coat" }, "coat");
    const layered = act(coat, { type: "cosmetic.equip", cosmeticId: outerwear.id }, "outerwear");
    expect(layered.equippedCosmetics?.top).toBeUndefined(); expect(layered.equippedCosmetics?.outerwear).toBe(outerwear.id);
    const restored = act(layered, { type: "cosmetic.equip", cosmeticId: "violet-coat" }, "coat-again");
    expect(restored.equippedCosmetics?.top).toBe("violet-coat"); expect(restored.equippedCosmetics?.outerwear).toBeUndefined();
    expect(restored.ownedCosmetics).toEqual(initial.ownedCosmetics); expect(restored.gold).toBe(initial.gold); expect(restored.equipment).toEqual(initial.equipment);
    expect(restored.equippedCosmetics?.bottom).toBe(initial.equippedCosmetics?.bottom);
  });
  it("preserves ordinary tops with outerwear and rolls back unauthorized conflicts", () => {
    const outerwear = COSMETICS.find(item => item.slot === "outerwear" && item.starter)!;
    const initial = createInitialState("owner", now); initial.character.xp = 100;
    const layered = act(initial, { type: "cosmetic.equip", cosmeticId: outerwear.id });
    expect(layered.equippedCosmetics?.top).toBe("runner-jacket");
    const before = structuredClone(layered);
    expect(() => act(layered, { type: "cosmetic.equip", cosmeticId: "violet-coat" }, "forged-coat")).toThrow(/chưa sở hữu/);
    expect(layered).toEqual(before);
    const outfit = act(layered, { type: "cosmetic.outfit", outfitId: "street-runner" }, "outfit");
    expect(outfit.equippedCosmetics?.outerwear).toBe("starter-bomber"); expect(outfit.equippedCosmetics?.top).toBe("runner-jacket");
  });
  it("supports all added slots while rejecting forged slots", () => {
    for (const slot of ["outerwear", "gloves", "eyewear", "face", "back", "jewelry"]) expect(actionSchema.safeParse({ type: "cosmetic.unequip", slot }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "cosmetic.unequip", slot: "admin" }).success).toBe(false);
  });
});

describe("V7 authoritative purchase gates", () => {
  it.each(["item", "furniture"] as const)("rejects locked %s purchases atomically and permits eligible idempotent counts", kind => {
    const definition = kind === "item" ? ITEMS.find(item => item.level > 1 && item.price > 0)! : FURNITURE.find(item => (item.level ?? 1) > 1 && item.price > 0)!;
    expect(definition).toBeDefined();
    const action: Action = kind === "item" ? { type: "item.buy", definitionId: definition.id } : { type: "furniture.buy", furnitureId: definition.id };
    const initial = createInitialState("owner", now); initial.gold = definition.price * 3;
    const before = structuredClone(initial);
    expect(() => act(initial, action)).toThrow(/level/); expect(initial).toEqual(before);
    expect(initial.ledger).toEqual([]); expect(initial.gold).toBe(definition.price * 3);
    initial.character.xp = ((definition.level ?? 1) - 1) ** 2 * 100;
    const first = act(initial, action, "first-buy"); expect(first.gold).toBe(definition.price * 2); expect(first.ledger).toHaveLength(1);
    expect(act(first, action, "first-buy")).toBe(first);
    const second = act(first, action, "second-buy"); expect(second.gold).toBe(definition.price); expect(second.ledger).toHaveLength(2);
    if (kind === "item") expect(second.inventory.filter(item => item.definitionId === definition.id)).toHaveLength(2);
    else expect(second.ownedFurniture[definition.id]).toBe(2);
  });
  it("keeps all production catalog prices safe and nonnegative", () => {
    for (const definition of [...ITEMS, ...FURNITURE]) { expect(Number.isSafeInteger(definition.price)).toBe(true); expect(definition.price).toBeGreaterThanOrEqual(0); }
  });
});

describe("V7 isolated persistence", () => {
  it("atomically persists settlement, ownership and receipts across reload and retries", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "lifelevel-v7-test-"));
    vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
    try {
      const initial = createInitialState("owner", now); initial.gold = 300;
      const file = path.join(directory, "owner.json");
      await writeFile(file, JSON.stringify({ game: initial, finance: { privateSentinel: "unchanged" }, proposals: {}, commands: {} }), "utf8");
      const results = await Promise.all([gameCommand("owner", "settle-key", settle), gameCommand("owner", "settle-key", settle)]);
      expect(results[0].state).toEqual(results[1].state);
      await gameCommand("owner", "buy-key", { type: "cosmetic.buy", cosmeticId: "amber-hoodie" });
      await gameCommand("owner", "equip-key", { type: "cosmetic.equip", cosmeticId: "amber-hoodie" });
      const loaded = await readGame("owner");
      const retry = await gameCommand("owner", "settle-key", settle);
      expect(retry.state).toEqual(loaded); expect(loaded.residence?.floor).toBe(8);
      expect(loaded.gold).toBe(300 - COSMETICS.find(item => item.id === "amber-hoodie")!.price);
      expect(loaded.equippedCosmetics?.top).toBe("amber-hoodie");
      expect(loaded.journal.filter(entry => entry.type === "housing.settle")).toHaveLength(1);
      const before = await readFile(file, "utf8");
      await expect(gameCommand("owner", "settle-key", { ...settle, floor: 24 })).rejects.toMatchObject({ status: 409 });
      await expect(gameCommand("owner", "second-settle", settle)).rejects.toMatchObject({ code: "ALREADY_SETTLED" });
      await expect(gameCommand("owner", "unowned-equip", { type: "cosmetic.equip", cosmeticId: "violet-coat" })).rejects.toThrow(/chưa sở hữu/);
      expect(await readFile(file, "utf8")).toBe(before);
      expect(await readPrivate("owner", "finance")).toEqual({ privateSentinel: "unchanged" });
    } finally {
      vi.unstubAllEnvs(); const resolved = path.resolve(directory);
      if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith("lifelevel-v7-test-")) throw new Error("Unsafe cleanup");
      await rm(resolved, { recursive: true, force: true });
    }
  });
});

describe("V7 presentation and legacy preset normalization", () => {
  it("keeps body independent from presentation and preserves explicit numeric presets", () => {
    const state = act(createInitialState("owner", now), { type: "character.appearance", appearance: { presentation: "feminine", body: "athletic", face: "angular", facePreset: 5 } });
    expect(state.character.appearance).toMatchObject({ presentation: "feminine", body: "athletic", facePreset: 5 });
    expect(actionSchema.safeParse({ type: "character.appearance", appearance: { presentation: "invalid" } }).success).toBe(false);
  });
  it.each(["character.appearance", "character.update"] as const)("normalizes legacy enum changes through %s", type => {
    const state = act(createInitialState("owner", now), { type, appearance: { face: "angular", eyes: "wide", eyebrows: "arched", nose: "wide", mouth: "smile" } });
    expect(state.character.appearance).toMatchObject({ facePreset: 2, eyePreset: 4, browPreset: 1, nosePreset: 2, mouthPreset: 1 });
    expect(mergeAppearance({ face: "round", eyes: "focused" })).toMatchObject({ facePreset: 3, eyePreset: 1 });
  });
});
