import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../src/domain/engine";
import { GameCommandError, readPendingCommand, retainCommand, type CommandStorage } from "../../src/components/game/command-client";
import { runLockedGameCommand, validateCommandIntent, type CommandLockManager, type LockedGameCommandOptions } from "../../src/components/game/command-lock";

function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

class Locks implements CommandLockManager {
  private tails = new Map<string, Promise<unknown>>();
  names: string[] = [];
  request<T>(name: string, options: { mode: "exclusive" }, callback: (lock: { name: string } | null) => Promise<T>): Promise<T> {
    expect(options.mode).toBe("exclusive");
    this.names.push(name);
    const result = (this.tails.get(name) ?? Promise.resolve()).then(() => callback({ name }));
    this.tails.set(name, result.catch(() => {}));
    return result;
  }
}

const action = { type: "cosmetic.buy", cosmeticId: "runner-jacket" } as const;
const now = "2026-01-01T00:00:00.000Z";
const response = (ownerId = "owner", revision = 1) => ({ state: { ...createInitialState(ownerId, now), revision }, message: "ok" });
function setup(overrides: Partial<LockedGameCommandOptions> = {}): LockedGameCommandOptions {
  return { ownerId: "owner", revision: 0, storage: memory(), getCurrentOwnerId: () => "owner", action, locks: new Locks(), makeKey: () => "key-1", now: () => now, send: async () => response(), readAuthoritativeState: async ownerId => ({ userId: ownerId, revision: 0 }), ...overrides };
}

 describe("browser owner command lock", () => {
  it("uses read-only no-store GET by default before any fresh POST", async () => {
    const events: string[] = [];
    const fetcher = vi.fn(async () => { events.push("GET"); return new Response(JSON.stringify({ state: { userId: "owner", revision: 0 } })); });
    vi.stubGlobal("fetch", fetcher);
    try {
      await runLockedGameCommand(setup({ readAuthoritativeState: undefined, send: async () => { events.push("POST"); return response(); } }));
      expect(fetcher).toHaveBeenCalledWith("/api/game", { cache: "no-store" });
      expect(events).toEqual(["GET", "POST"]);
    } finally { vi.unstubAllGlobals(); }
  });

  it("rejects a server snapshot older than the captured click revision", async () => {
    await expect(runLockedGameCommand(setup({ revision: 1 }))).rejects.toMatchObject({ code: "STALE_REVISION" });
  });

  it.each([1, -1, NaN, "0", undefined])("fails closed for authoritative revision %s without altering a receipt", async revision => {
    const options = setup({ readAuthoritativeState: async () => ({ userId: "owner", revision }) });
    const receipt = retainCommand(options.storage, "owner", action, () => "uncertain", now);
    let sent = false;
    await expect(runLockedGameCommand({ ...options, send: async () => { sent = true; return response(); } })).rejects.toMatchObject({ uncertain: true });
    expect(sent).toBe(false); expect(readPendingCommand(options.storage, "owner")).toEqual(receipt);
  });

  it("rechecks current owner after authoritative GET and preserves pending receipt", async () => {
    let owner = "owner";
    const options = setup({ getCurrentOwnerId: () => owner, readAuthoritativeState: async () => { owner = "other"; return { userId: "owner", revision: 0 }; } });
    const receipt = retainCommand(options.storage, "owner", action, () => "uncertain", now);
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(readPendingCommand(options.storage, "owner")).toEqual(receipt);
  });

  it("rejects authoritative owner mismatch before allocating a command", async () => {
    const options = setup({ readAuthoritativeState: async () => ({ userId: "other", revision: 0 }) });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(readPendingCommand(options.storage, "owner")).toBeNull();
  });

  it("does not consult authoritative GET for explicit uncertain retry", async () => {
    const options = setup({ readAuthoritativeState: async () => { throw new Error("must not call"); } });
    retainCommand(options.storage, "owner", action, () => "uncertain", now);
    await expect(runLockedGameCommand({ ...options, retryKey: "uncertain" })).resolves.toHaveProperty("state.revision", 1);
  });

  it("executes only one concurrent initial-revision intent and publishes before releasing", async () => {
    const entered = deferred(), release = deferred();
    let calls = 0, allocations = 0;
    const options = setup({ makeKey: () => `key-${++allocations}`, send: async () => { calls++; entered.resolve(); await release.promise; return response(); } });
    const first = runLockedGameCommand(options);
    await entered.promise;
    const second = runLockedGameCommand({ ...options });
    const secondResult = expect(second).rejects.toMatchObject({ code: "STALE_REVISION" });
    release.resolve();
    await first; await secondResult;
    expect(calls).toBe(1); expect(allocations).toBe(1);
    expect(readPendingCommand(options.storage, "owner")).toBeNull();
    expect(JSON.parse(options.storage.getItem("lifelevel-state-changed")!)).toMatchObject({ ownerId: "owner", revision: 1 });
  });

  it("retains uncertain retries with exactly the same key and action even after a newer signal", async () => {
    const options = setup({ send: async () => { throw new GameCommandError("lost response", true); } });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ uncertain: true });
    const pending = readPendingCommand(options.storage, "owner");
    options.storage.setItem("lifelevel-state-changed", JSON.stringify({ ownerId: "owner", revision: 5 }));
    let allocations = 0;
    const retry = { ...options, retryKey: pending!.key, makeKey: () => { allocations++; return "wrong"; }, send: async (command: typeof pending) => { expect(command).toEqual(pending); return response("owner", 1); } };
    await runLockedGameCommand(retry);
    expect(allocations).toBe(0);
    expect(readPendingCommand(options.storage, "owner")).toBeNull();
    expect(JSON.parse(options.storage.getItem("lifelevel-state-changed")!).revision).toBe(5);
    options.storage.setItem("lifelevel-state-changed", JSON.stringify({ ownerId: "other", revision: 2 }));
    expect(() => validateCommandIntent({ ...options, revision: 1 })).toThrow(expect.objectContaining({ code: "STALE_REVISION" }));
  });

  it("does not replace a pending action with a different intent", async () => {
    const options = setup();
    const retained = retainCommand(options.storage, "owner", action, () => "original", now);
    await expect(runLockedGameCommand({ ...options, action: { type: "cosmetic.buy", cosmeticId: "other" } })).rejects.toThrow("chưa có kết quả chắc chắn");
    expect(readPendingCommand(options.storage, "owner")).toEqual(retained);
  });

  it("allows different owners to progress independently", async () => {
    const entered = deferred(), release = deferred();
    const options = setup({ send: async () => { entered.resolve(); await release.promise; return response(); } });
    const first = runLockedGameCommand(options);
    await entered.promise;
    await expect(runLockedGameCommand({ ...options, ownerId: "other", getCurrentOwnerId: () => "other", send: async () => response("other") })).resolves.toHaveProperty("state.userId", "other");
    expect(readPendingCommand(options.storage, "owner")?.key).toBe("key-1");
    release.resolve(); await first;
    expect((options.locks as Locks).names).toEqual(["lifelevel-command:owner", "lifelevel-command:other"]);
  });

  it("fails closed without a lock manager and never allocates or sends", async () => {
    let touched = false;
    const options = setup({ locks: null, makeKey: () => { touched = true; return "bad"; }, send: async () => { touched = true; return response(); } });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "LOCK_UNAVAILABLE" });
    expect(touched).toBe(false);
  });

  it("fails closed if a lock manager grants no lock", async () => {
    const options = setup({ locks: { request: async (_name, _options, callback) => callback(null) } });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "LOCK_UNAVAILABLE" });
    expect(readPendingCommand(options.storage, "owner")).toBeNull();
  });

  it("aborts an owner change during lock wait without allocation", async () => {
    const locks = new Locks(), entered = deferred(), release = deferred();
    const blocker = locks.request("lifelevel-command:owner", { mode: "exclusive" }, async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    let ownerId = "owner", allocations = 0;
    const options = setup({ locks, getCurrentOwnerId: () => ownerId, makeKey: () => { allocations++; return "bad"; } });
    const pending = runLockedGameCommand(options);
    const rejection = expect(pending).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    ownerId = "other"; release.resolve(); await blocker; await rejection;
    expect(allocations).toBe(0); expect(readPendingCommand(options.storage, "owner")).toBeNull();
  });

  it("releases after a server error and keeps the retry receipt", async () => {
    const entered = deferred(), release = deferred();
    const options = setup({ send: async () => { entered.resolve(); await release.promise; throw new GameCommandError("server unavailable", true); } });
    const first = runLockedGameCommand(options);
    const failed = expect(first).rejects.toThrow("server unavailable");
    await entered.promise;
    const retry = runLockedGameCommand({ ...options, retryKey: "key-1", send: async command => { expect(command.key).toBe("key-1"); return response(); } });
    release.resolve(); await failed; await expect(retry).resolves.toHaveProperty("state.revision", 1);
  });

  it("clears a terminal rejection under the lock and permits the next attempt", async () => {
    const options = setup({ send: async () => { throw new GameCommandError("rejected", false); } });
    await expect(runLockedGameCommand(options)).rejects.toThrow("rejected");
    expect(readPendingCommand(options.storage, "owner")).toBeNull();
    await expect(runLockedGameCommand({ ...options, makeKey: () => "key-2", send: async command => { expect(command.key).toBe("key-2"); return response(); } })).resolves.toHaveProperty("state.revision", 1);
  });

  it("does not reallocate a retry whose receipt another caller already cleared", async () => {
    const options = setup();
    retainCommand(options.storage, "owner", action, () => "key-1", now);
    await runLockedGameCommand({ ...options, retryKey: "key-1" });
    let allocations = 0;
    await expect(runLockedGameCommand({ ...options, revision: 1, retryKey: "key-1", makeKey: () => { allocations++; return "bad"; } })).rejects.toMatchObject({ code: "PENDING_CHANGED" });
    expect(allocations).toBe(0);
  });

  it("retains receipts when ownership changes in flight", async () => {
    let ownerId = "owner";
    const options = setup({ getCurrentOwnerId: () => ownerId, send: async () => { ownerId = "other"; return response(); } });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(readPendingCommand(options.storage, "owner")?.key).toBe("key-1");
  });

  it("uses the per-owner watermark when another owner overwrites the shared signal", async () => {
    const options = setup();
    await runLockedGameCommand(options);
    options.storage.setItem("lifelevel-state-changed", JSON.stringify({ ownerId: "other", revision: 8 }));
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "STALE_REVISION" });
  });

  it("validates shared revisions without React and fails closed on malformed signals", () => {
    const options = setup();
    options.storage.setItem("lifelevel-state-changed", JSON.stringify({ ownerId: "owner", revision: 2 }));
    expect(() => validateCommandIntent(options)).toThrow(expect.objectContaining({ code: "STALE_REVISION" }));
    options.storage.setItem("lifelevel-state-changed", "{");
    expect(() => validateCommandIntent(options)).toThrow(expect.objectContaining({ code: "INVALID_REVISION" }));
  });

  it.each(["drop", "replace"])("does not send when storage %s prevents exact readback", async kind => {
    let sends = 0;
    const storage = memory(), save = storage.setItem;
    storage.setItem = (key, value) => { if (kind === "replace") save(key, value.replace("key-1", "other-key")); };
    await expect(runLockedGameCommand(setup({ storage, send: async () => { sends++; return response(); } }))).rejects.toMatchObject({ code: "PENDING_CHANGED" });
    expect(sends).toBe(0);
  });

  it.each(["drop", "lower", "owner", "malformed"])("retains receipt when durable revision is %s and blocks a queued different fresh intent", async kind => {
    const storage = memory(), save = storage.setItem, entered = deferred(), release = deferred();
    storage.setItem = (key, value) => {
      if (key !== "lifelevel-command-revision:owner") { save(key, value); return; }
      if (kind === "lower") save(key, JSON.stringify({ ownerId: "owner", revision: 0 }));
      if (kind === "owner") save(key, JSON.stringify({ ownerId: "other", revision: 1 }));
      if (kind === "malformed") save(key, "{");
    };
    let sends = 0, allocations = 0;
    const options = setup({ storage, makeKey: () => `key-${++allocations}`, send: async () => { sends++; entered.resolve(); await release.promise; return response(); } });
    const first = runLockedGameCommand(options);
    const firstFailure = expect(first).rejects.toMatchObject({ code: "INVALID_REVISION", uncertain: true });
    await entered.promise;
    const queued = runLockedGameCommand({ ...options, action: { type: "character.rest" } });
    const queuedFailure = expect(queued).rejects.toThrow();
    release.resolve(); await firstFailure; await queuedFailure;
    expect(sends).toBe(1); expect(allocations).toBe(1);
    expect(readPendingCommand(storage, "owner")?.key).toBe("key-1");
  });

  it("accepts a persisted same-owner revision higher than the response", async () => {
    const storage = memory(), save = storage.setItem;
    storage.setItem = (key, value) => save(key, key === "lifelevel-command-revision:owner" ? JSON.stringify({ ownerId: "owner", revision: 8 }) : value);
    await runLockedGameCommand(setup({ storage }));
    expect(readPendingCommand(storage, "owner")).toBeNull();
    expect(() => validateCommandIntent(setup({ storage, revision: 1 }))).toThrow(expect.objectContaining({ code: "STALE_REVISION" }));
  });

  it("rechecks owner after asynchronous preflight before allocating", async () => {
    let ownerId = "owner", allocations = 0;
    const options = setup({ getCurrentOwnerId: () => ownerId, preflight: async () => { ownerId = "other"; }, makeKey: () => { allocations++; return "bad"; } });
    await expect(runLockedGameCommand(options)).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(allocations).toBe(0);
  });

  it("never overwrites a malformed retained receipt", async () => {
    const options = setup();
    options.storage.setItem("lifelevel-pending-command:owner", "{");
    await expect(runLockedGameCommand(options)).rejects.toThrow("lỗi dữ liệu");
    expect(options.storage.getItem("lifelevel-pending-command:owner")).toBe("{");
  });
});
