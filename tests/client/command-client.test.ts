import { describe, expect, it } from "vitest";
import { createInitialState } from "../../src/domain/engine";
import { clearPendingCommand, GameCommandError, newestGameState, postGameCommand, readPendingCommand, retainCommand, type CommandStorage } from "../../src/components/game/command-client";

function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const now = "2026-01-01T00:00:00.000Z";
const action = { type: "cosmetic.buy", cosmeticId: "runner-jacket" } as const;
const command = () => retainCommand(memory(), "owner", action, () => "command-1", now);
const transport = (value: unknown, status = 200) => (async () => new Response(JSON.stringify(value), { status })) as typeof fetch;

describe("retained owner-bound commands", () => {
  it("persists a key before the request and reuses it after reload", () => {
    const storage = memory();
    const first = retainCommand(storage, "owner", action, () => "first", now);
    expect(readPendingCommand(storage, "owner")).toEqual(first);
    expect(retainCommand(storage, "owner", action, () => "second", now)).toEqual(first);
  });
  it("does not replace an uncertain command with a different purchase", () => {
    const storage = memory(); retainCommand(storage, "owner", action, () => "first", now);
    expect(() => retainCommand(storage, "owner", { type: "cosmetic.buy", cosmeticId: "another" }, () => "second", now)).toThrow("chưa có kết quả chắc chắn");
    expect(readPendingCommand(storage, "owner")?.key).toBe("first");
  });
  it("keeps owners isolated and only clears a matching receipt", () => {
    const storage = memory(); retainCommand(storage, "owner", action, () => "first", now);
    expect(readPendingCommand(storage, "other")).toBeNull();
    clearPendingCommand(storage, "owner", "stale"); expect(readPendingCommand(storage, "owner")).not.toBeNull();
    clearPendingCommand(storage, "other", "first"); expect(readPendingCommand(storage, "owner")).not.toBeNull();
    clearPendingCommand(storage, "owner", "first"); expect(readPendingCommand(storage, "owner")).toBeNull();
  });
  it("never starts a request when durable storage fails", () => {
    const storage = memory(); storage.setItem = () => { throw new Error("quota"); };
    expect(() => retainCommand(storage, "owner", action, () => "first", now)).toThrow("quota");
  });
  it.each(["", "null", "{", JSON.stringify({ ownerId: "other", key: "first", action, createdAt: now }), JSON.stringify({ ownerId: "owner", key: "first", action: { type: "cosmetic.buy" }, createdAt: now }), JSON.stringify({ ownerId: "owner", key: "", action, createdAt: now })])("does not overwrite malformed retained payload %#", raw => {
    const storage = memory(); storage.setItem("lifelevel-pending-command:owner", raw);
    let generated = false;
    expect(() => retainCommand(storage, "owner", action, () => { generated = true; return "new"; }, now)).toThrow("lỗi dữ liệu");
    expect(generated).toBe(false);
    expect(storage.getItem("lifelevel-pending-command:owner")).toBe(raw);
    expect(readPendingCommand(storage, "owner")).toBeNull();
  });
  it("never allocates or writes when the prior receipt cannot be read", () => {
    let generated = false, written = false;
    const storage: CommandStorage = { getItem: () => { throw new Error("read denied"); }, setItem: () => { written = true; }, removeItem: () => {} };
    expect(() => retainCommand(storage, "owner", action, () => { generated = true; return "new"; }, now)).toThrow("read denied");
    expect(generated).toBe(false); expect(written).toBe(false); expect(readPendingCommand(storage, "owner")).toBeNull();
  });
  it("rejects malformed and owner-substituted retained payloads", () => {
    const storage = memory(); storage.setItem("lifelevel-pending-command:owner", "null");
    expect(readPendingCommand(storage, "owner")).toBeNull();
    storage.setItem("lifelevel-pending-command:owner", JSON.stringify({ ...command(), ownerId: "other" }));
    expect(readPendingCommand(storage, "owner")).toBeNull();
  });
});

describe("command response authority", () => {
  it("posts the retained key and action unchanged", async () => {
    const value = command(); const state = createInitialState("owner", now);
    const fetcher = (async (url: unknown, init?: RequestInit) => {
      expect(url).toBe("/api/game"); expect(JSON.parse(String(init?.body))).toEqual({ key: value.key, action, expectedOwnerId: value.ownerId });
      return new Response(JSON.stringify({ state, message: "ok" }));
    }) as typeof fetch;
    expect((await postGameCommand(value, fetcher)).state.userId).toBe("owner");
  });
  it("retains uncertainty after a network loss", async () => {
    const fetcher = (async () => { throw new Error("offline"); }) as typeof fetch;
    await expect(postGameCommand(command(), fetcher)).rejects.toMatchObject({ uncertain: true });
  });
  it.each([408, 429, 500, 503])("marks HTTP %s uncertain", async status => {
    await expect(postGameCommand(command(), transport({ error: "retry" }, status))).rejects.toMatchObject({ uncertain: true });
  });
  it.each([400, 403, 409, 422])("marks a valid HTTP %s rejection terminal", async status => {
    await expect(postGameCommand(command(), transport({ error: "rejected" }, status))).rejects.toMatchObject({ uncertain: false });
  });
  it.each([null, {}, { state: {} }, { state: { userId: "owner", revision: -1 } }])("does not acknowledge malformed success %#", async body => {
    await expect(postGameCommand(command(), transport(body))).rejects.toBeInstanceOf(GameCommandError);
    await expect(postGameCommand(command(), transport(body))).rejects.toMatchObject({ uncertain: true });
  });
  it("keeps the original receipt through an owner-change rejection after a lost response", async () => {
    const storage = memory();
    const first = retainCommand(storage, "owner", action, () => "original-key", now);
    await expect(postGameCommand(first, (async () => { throw new Error("lost response"); }) as typeof fetch)).rejects.toMatchObject({ uncertain: true });
    try { await postGameCommand(first, transport({ code: "OWNER_CHANGED", error: "Changed owner" }, 409)); }
    catch (error) { if (error instanceof GameCommandError && !error.uncertain) clearPendingCommand(storage, first.ownerId, first.key); }
    expect(readPendingCommand(storage, "owner")).toEqual(first);
    expect(readPendingCommand(storage, "other")).toBeNull();
    expect(retainCommand(storage, "owner", action, () => "replacement-key", now)).toEqual(first);
    await expect(postGameCommand(first, transport({ state: createInitialState("owner", now) }))).resolves.toHaveProperty("state.userId", "owner");
    clearPendingCommand(storage, first.ownerId, first.key);
    expect(readPendingCommand(storage, "owner")).toBeNull();
  });
  it.each([undefined, "DOMAIN_CONFLICT", "IDEMPOTENCY_CONFLICT"])("keeps ordinary 409 rejection terminal for code %s", async code => {
    await expect(postGameCommand(command(), transport({ code, error: "Conflict" }, 409))).rejects.toMatchObject({ uncertain: false });
  });
  it("does not apply another player's response", async () => {
    await expect(postGameCommand(command(), transport({ state: createInitialState("other", now) }))).rejects.toMatchObject({ uncertain: true });
  });
  it("does not acknowledge a non-JSON response", async () => {
    const fetcher = (async () => new Response("<html>down</html>")) as typeof fetch;
    await expect(postGameCommand(command(), fetcher)).rejects.toMatchObject({ uncertain: true });
  });
  it("never downgrades a same-owner revision but permits switching owners", () => {
    const current = createInitialState("owner", now); current.revision = 10;
    const old = { ...current, revision: 9 }; const fresh = { ...current, revision: 11 };
    expect(newestGameState(current, old)).toBe(current);
    expect(newestGameState(current, fresh)).toBe(fresh);
    const other = createInitialState("other", now); expect(newestGameState(current, other)).toBe(other);
  });
});
