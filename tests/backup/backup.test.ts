import { describe, expect, it } from "vitest";
import { createInitialState } from "../../src/domain";
import { applyFinance, emptyFinance } from "../../src/finance";
import { createBackup, parseBackup, restoreIsolated, validateBackup } from "../../src/backup";

const now = "2026-10-15T12:00:00.000Z";
const sample = () => createBackup("player-test", createInitialState("player-test", now), emptyFinance(), {}, now);
describe("versioned backups and isolated restore", () => {
  it("exports and round-trips real initial game and private finance state", () => {
    const data = sample(); const json = JSON.stringify(data); const restored = restoreIsolated(json, "test-roundtrip");
    expect(restored.namespace).toBe("test-roundtrip"); expect(restored.read()).toEqual(data);
    expect(data.game.userId).toBe("player-test");
  });
  it("isolated copies cannot modify input or later reads", () => {
    const data = sample(); const sandbox = restoreIsolated(JSON.stringify(data), "test-independent");
    const copy = sandbox.read(); copy.game.gold = 999999; copy.finance!.accounts.push({ id: "bad", name: "X", openingBalance: 0, balance: 0, currency: "VND" });
    expect(sandbox.read()).toEqual(data);
    expect(() => restoreIsolated(JSON.stringify(data), "production")).toThrow("test-*");
  });
  it("rejects future versions, malformed JSON and owner substitution", () => {
    expect(() => validateBackup({ ...sample(), version: 2 })).toThrow();
    expect(() => parseBackup("not-json")).toThrow("JSON");
    expect(() => validateBackup({ ...sample(), sourceUserId: "another-user" })).toThrow("không khớp");
  });
  it("rejects prototype keys and excessive nesting", () => {
    expect(() => parseBackup('{"__proto__":{"polluted":true}}')).toThrow("không an toàn");
    let nested: unknown = {}; for (let i = 0; i < 45; i++) nested = { nested };
    expect(() => validateBackup(nested)).toThrow("quá sâu");
  });
  it("validates finance ledger balances and rejects dangling references", () => {
    const data = sample(); let id = 0;
    data.finance = applyFinance(emptyFinance(), { type: "account.create", name: "Ngân hàng", openingBalance: 100000 }, "one", () => `id-${++id}`);
    const accountId = data.finance.accounts[0].id;
    data.finance = applyFinance(data.finance, { type: "transaction.create", accountId, kind: "expense", amount: 10000, category: "Ăn uống", note: "", date: "2026-10-15" }, "two", () => `id-${++id}`);
    expect(validateBackup(data).finance!.accounts[0].balance).toBe(90000);
    const tampered = structuredClone(data); tampered.finance!.accounts[0].balance = 999999;
    expect(() => validateBackup(tampered)).toThrow("sổ giao dịch");
    const foreign = structuredClone(data); foreign.finance!.transactions[0].accountId = "other";
    expect(() => validateBackup(foreign)).toThrow("tài khoản không tồn tại");
  });
  it("rejects impossible game balances and equipped items that are not owned", () => {
    const data = sample(); data.game.gold = -1; expect(() => validateBackup(data)).toThrow();
    const foreign = sample(); foreign.game.equipment.weapon = "unowned"; expect(() => validateBackup(foreign)).toThrow("không sở hữu");
  });
  it("round-trips optional construction state for old and new backups", () => {
    const old = sample(); expect(validateBackup(old).game.building).toBeUndefined();
    const current = sample(); current.game.building = { version: 1, revision: 2, plot: { minX: -8, maxX: 8, minZ: -8, maxZ: 8, maxLevel: 2, cellSize: 1 }, plan: { floors: [{ x: 0, z: 0, level: 0, materialId: "floor-concrete" }], walls: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} }, paid: {}, starterGrantApplied: false, migratedAt: now, legacyPlacementsPreserved: true };
    expect(validateBackup(current).game.building?.revision).toBe(2);
    const malformed = structuredClone(current); malformed.game.building!.plan.floors[0].materialId = "unknown-material";
    expect(() => validateBackup(malformed)).toThrow();
  });
  it("preserves acquired luxury architecture after a later Hardcore level loss",()=>{
    const data=sample();data.game.building={version:1,revision:1,plot:{minX:-8,maxX:8,minZ:-8,maxZ:8,maxLevel:2,cellSize:1},plan:{floors:[{x:0,z:0,level:0,materialId:"floor-luxury"}],walls:[],furniture:[],stairs:[],ceilings:[],roofs:[],roomNames:{}},paid:{"floor:0:0:0":70},starterGrantApplied:true,migratedAt:now,legacyPlacementsPreserved:true};
    expect(validateBackup(data).game.building?.plan.floors[0].materialId).toBe("floor-luxury");
  });
});
