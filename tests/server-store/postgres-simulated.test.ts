import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ drizzle: vi.fn(), postgres: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("postgres", () => ({ default: mocks.postgres }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));
import { createInitialState } from "@/domain";
import type { GameState } from "@/domain/types";
import * as schema from "@/server/schema";
import { gameCommand } from "@/server/store";
type Receipt = { key: string; fingerprint: string; result: unknown };
type Data = { state: GameState; receipts: Receipt[] };
let data: Data;
let failReceipt: boolean;
let locked: boolean;
let updates: number;
let rollbacks: number;
let selectedReceipt = "";
type Table = typeof schema.playerStates | typeof schema.commandRecords;

// A transactional double verifies store control flow only; it is not a Postgres lock emulator.
function database(snapshot: () => Data, inside = false) {
  return {
    select: () => ({ from: (table: Table) => ({ where: () => {
      const rows = () => table === schema.playerStates ? [{ userId: "owner", state: structuredClone(snapshot().state) }] : snapshot().receipts.filter(row => row.key === selectedReceipt);
      return { then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows()).then(resolve), for: async () => { locked = true; return rows(); } };
    } }) }),
    insert: (table: Table) => ({ values: (value: unknown) => {
      if (table === schema.playerStates) return { onConflictDoNothing: async () => undefined };
      return Promise.resolve().then(() => {
        if (!inside || !locked) throw new Error("Receipt write outside locked transaction");
        if (failReceipt) throw new Error("Simulated database receipt failure");
        snapshot().receipts.push(value as Receipt);
      });
    } }),
    update: () => ({ set: (value: { state: GameState }) => ({ where: async () => { if (!inside || !locked) throw new Error("State write outside locked transaction"); updates++; snapshot().state = structuredClone(value.state); } }) }),
  };
}
const fake = { ...database(() => data), transaction: async <T,>(callback: (transaction: ReturnType<typeof database>) => Promise<T>): Promise<T> => {
  const tentative = structuredClone(data); locked = false;
  try { const result = await callback(database(() => tentative, true)); data = tentative; return result; }
  catch (error) { rollbacks++; throw error; }
} };
beforeEach(() => {
  vi.stubEnv("LOCAL_DEV_MODE", "false"); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DATABASE_URL", "postgres://test.invalid/db");
  data = { state: createInitialState("owner"), receipts: [] }; failReceipt = false; locked = false; updates = 0; rollbacks = 0;
  mocks.drizzle.mockReturnValue(fake); mocks.postgres.mockReturnValue({});
});
afterEach(() => vi.unstubAllEnvs());
describe("simulated Postgres transactional control flow (not live database verification)", () => {
  it("rolls back state when recording its idempotency receipt fails", async () => {
    failReceipt = true; const before = structuredClone(data); selectedReceipt = "failed-command";
    await expect(gameCommand("owner", selectedReceipt, { type: "character.rename", name: "Must roll back" })).rejects.toThrow("receipt failure");
    expect(updates).toBe(1); expect(rollbacks).toBe(1); expect(data).toEqual(before);
  });
  it("commits state and compact receipt together after taking a player row lock", async () => {
    selectedReceipt = "successful-command";
    const result = await gameCommand("owner", selectedReceipt, { type: "character.rename", name: "Committed" });
    expect(locked).toBe(true); expect(result.state.character.name).toBe("Committed"); expect(data.state.character.name).toBe("Committed"); expect(data.receipts).toHaveLength(1); expect(data.receipts[0].result).not.toHaveProperty("state");
  });
  it("domain failures make no update or receipt write", async () => {
    const before = structuredClone(data); selectedReceipt = "insufficient-funds";
    await expect(gameCommand("owner", selectedReceipt, { type: "item.buy", definitionId: "neural-visor" })).rejects.toThrow();
    expect(updates).toBe(0); expect(rollbacks).toBe(1); expect(data).toEqual(before);
  });
  it("replays receipt with current locked row state and no write", async () => {
    const action = { type: "character.rename" as const, name: "Original" }; selectedReceipt = "replay";
    await gameCommand("owner", selectedReceipt, action);
    data.state.character.name = "Later state"; updates = 0;
    const result = await gameCommand("owner", selectedReceipt, action);
    expect(result.state.character.name).toBe("Later state"); expect(updates).toBe(0); expect(data.receipts).toHaveLength(1);
  });
});
