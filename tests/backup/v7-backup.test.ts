import { describe, expect, it } from "vitest";
import { createBackup, parseBackup, restoreIsolated, validateBackup } from "../../src/backup";
import { createInitialState, applyAction } from "../../src/domain/engine";
import { HOUSING_LAYOUTS } from "../../src/housing/catalog";
import { COSMETICS } from "../../src/character/catalog";

const now = "2026-10-16T12:00:00Z";
const context = { userId: "owner", now, eventId: "backup-settle", random: () => 0.5 };
function snapshot() { return createBackup("owner", createInitialState("owner", now), null, {}, now); }
function settled() {
  return applyAction(createInitialState("owner", now), { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }, context).state;
}

describe("V7 validated backups", () => {
  it.each(HOUSING_LAYOUTS)("roundtrips residence, grants and actual $id plan without writing live data", layout => {
    const state = applyAction(createInitialState("owner", now), { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 16, layoutId: layout.id }, context).state;
    state.character.appearance!.presentation = "neutral";
    const backup = createBackup("owner", state, null, {}, now);
    expect(parseBackup(JSON.stringify(backup)).game).toEqual(state);
    expect(restoreIsolated(JSON.stringify(backup), "test-v7-backup").read().game).toEqual(state);
    expect(backup.game.housingStarterEligible).toBe(false); expect(backup.game.starterCosmeticsVersion).toBe(7);
  });
  it("accepts legacy backups lacking every optional V7 field", () => {
    const data = snapshot(); delete data.game.residence; delete data.game.housingStarterEligible; delete data.game.starterCosmeticsVersion; delete data.game.character.appearance;
    const restored = validateBackup(data);
    expect(restored.game.residence).toBeUndefined(); expect(restored.game.housingStarterEligible).toBeUndefined(); expect(restored.game.gold).toBe(0);
  });
  it.each([{ floor: 0 }, { floor: 25 }, { floor: "8" }, { layoutId: "penthouse" }, { districtId: "district99" }, { buildingId: "forged" }, { completedAt: "not-a-date" }, { grant: 500 }])("rejects malformed or forged residence %j", patch => {
    const data = createBackup("owner", settled(), null, {}, now);
    expect(() => validateBackup({ ...data, game: { ...data.game, residence: { ...data.game.residence, ...patch } } })).toThrow();
  });
  it.each([{ housingStarterEligible: "true" }, { starterCosmeticsVersion: -1 }, { starterCosmeticsVersion: 1.5 }, { starterCosmeticsVersion: Number.MAX_SAFE_INTEGER + 1 }])("validates grant markers %j", patch => {
    const data = snapshot(); expect(() => validateBackup({ ...data, game: { ...data.game, ...patch } })).toThrow();
  });
  it("rejects settled saves claiming another starter grant", () => {
    const state = settled(); state.housingStarterEligible = true;
    expect(() => createBackup("owner", state, null, {}, now)).toThrow(/nhận lại/);
  });
  it("retains extended owned slots and rejects unowned or mis-slotted cosmetics", () => {
    const state = createInitialState("owner", now);
    const outerwear = COSMETICS.find(item => item.starter && item.slot === "outerwear")!;
    state.equippedCosmetics!.outerwear = outerwear.id;
    expect(createBackup("owner", state, null, {}, now).game.equippedCosmetics!.outerwear).toBe(outerwear.id);
    state.equippedCosmetics!.gloves = outerwear.id;
    expect(() => createBackup("owner", state, null, {}, now)).toThrow(/sai vị trí/);
    delete state.equippedCosmetics!.gloves; state.ownedCosmetics = [];
    expect(() => createBackup("owner", state, null, {}, now)).toThrow(/chưa sở hữu/);
  });
  it("rejects invalid presentation and unsupported additional game keys", () => {
    const data = snapshot();
    expect(() => validateBackup({ ...data, game: { ...data.game, character: { ...data.game.character, appearance: { ...data.game.character.appearance, presentation: "admin" } } } })).toThrow();
    expect(() => validateBackup({ ...data, game: { ...data.game, freeGold: 100 } })).toThrow();
  });
});
