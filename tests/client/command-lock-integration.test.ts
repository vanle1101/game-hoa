import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { FURNITURE } from "../../src/domain/catalog";
import type { Action } from "../../src/domain/types";
import { getBuilding } from "../../src/construction";
import { readPendingCommand, retainCommand, type CommandStorage } from "../../src/components/game/command-client";
import { type CommandLockManager } from "../../src/components/game/command-lock";
import { refreshGameState, runGameCommand, type GameSnapshot } from "../../src/components/game/game-command-state";
import { migrateConstructionCommand, runConstructionCommand } from "../../src/components/construction/command-state";

const ownerId = "owner-a", now = "2026-01-01T00:00:00.000Z";
const buy = { type: "furniture.buy", furnitureId: FURNITURE[0].id } as const;
function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
class Locks implements CommandLockManager {
  private tails = new Map<string, Promise<unknown>>();
  request<T>(name: string, _options: { mode: "exclusive" }, callback: (lock: { name: string }) => Promise<T>): Promise<T> {
    const result = (this.tails.get(name) ?? Promise.resolve()).then(() => callback({ name }));
    this.tails.set(name, result.catch(() => {})); return result;
  }
}
function setup() {
  const storage = memory(), session = memory(), locks = new Locks();
  let state = createInitialState(ownerId, now); state.gold = 10000;
  let currentOwner: string | undefined = ownerId;
  const requests: { key: string; action: Action; expectedOwnerId: string }[] = [];
  const transport = (async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      const command = JSON.parse(String(init.body)); requests.push(command);
      state = applyAction(state, command.action, { userId: ownerId, eventId: command.key, now, random: () => 0.5 }).state;
    }
    return new Response(JSON.stringify({ state, mode: "local" }));
  }) as typeof fetch;
  const options = { storage, session, locks, ownerId, revision: 0, action: buy, getCurrentOwnerId: () => currentOwner, makeKey: () => "first-key", now: () => now };
  return { options, requests, transport, state: () => state, changeOwner: (value?: string) => { currentOwner = value; } };
}

describe("main and construction owner-lock integration", () => {
  it("rejects a queued editor intent even when its storage retains a stale receipt and revision", async () => {
    const test = setup(), entered = deferred(), release = deferred(), staleStorage = memory();
    const slow = (async (url, init) => {
      const response = await test.transport(url, init);
      if (init?.method === "POST") { entered.resolve(); await release.promise; }
      return response;
    }) as typeof fetch;
    const first = runGameCommand({ ...test.options, transport: slow }); await entered.promise;
    const receipt = readPendingCommand(test.options.storage, ownerId)!;
    staleStorage.setItem(`lifelevel-pending-command:${ownerId}`, JSON.stringify(receipt));
    staleStorage.setItem(`lifelevel-command-revision:${ownerId}`, JSON.stringify({ ownerId, revision: 0 }));
    const second = runConstructionCommand({ ...test.options, storage: staleStorage }, test.transport);
    const rejected = expect(second).rejects.toMatchObject({ code: "STALE_REVISION" });
    release.resolve(); await first; await rejected;
    expect(test.requests).toHaveLength(1);
    expect(test.state().ownedFurniture[buy.furnitureId]).toBe(1);
    expect(readPendingCommand(test.options.storage, ownerId)).toBeNull();
    expect(readPendingCommand(staleStorage, ownerId)).toEqual(receipt);
  });

  it.each(["main", "editor"])("fails closed on authoritative GET failure in %s without deleting uncertain receipt", async caller => {
    const test = setup(), receipt = retainCommand(test.options.storage, ownerId, buy, () => "uncertain", now);
    let posts = 0;
    const unavailable = (async (_url, init) => { if (init?.method === "POST") posts++; return new Response("{}", { status: 503 }); }) as typeof fetch;
    const result = caller === "main" ? runGameCommand({ ...test.options, transport: unavailable }) : runConstructionCommand(test.options, unavailable);
    await expect(result).rejects.toMatchObject({ uncertain: true });
    expect(posts).toBe(0); expect(readPendingCommand(test.options.storage, ownerId)).toEqual(receipt);
  });

  it.each(["main", "editor"])("rejects malformed authoritative GET payload in %s before allocation", async caller => {
    const test = setup(); let posts = 0;
    const malformed = (async (_url, init) => { if (init?.method === "POST") posts++; return new Response("not json"); }) as typeof fetch;
    const result = caller === "main" ? runGameCommand({ ...test.options, transport: malformed }) : runConstructionCommand(test.options, malformed);
    await expect(result).rejects.toMatchObject({ uncertain: true });
    expect(posts).toBe(0); expect(readPendingCommand(test.options.storage, ownerId)).toBeNull();
  });

  it("serializes simultaneous main and editor buys with one debit and rejects stale second intent", async () => {
    const test = setup(), entered = deferred(), release = deferred();
    const slow = (async (url, init) => { if (init?.method === "POST") { entered.resolve(); await release.promise; } return test.transport(url, init); }) as typeof fetch;
    const first = runGameCommand({ ...test.options, transport: slow }); await entered.promise;
    const second = runConstructionCommand({ ...test.options, makeKey: () => "editor-key" }, test.transport);
    const rejected = expect(second).rejects.toMatchObject({ code: "STALE_REVISION" });
    release.resolve(); await first; await rejected;
    expect(test.requests).toHaveLength(1); expect(test.state().gold).toBe(10000 - FURNITURE[0].price);
    expect(test.state().ownedFurniture[buy.furnitureId]).toBe(1);
  });

  it("retries an uncertain main purchase from editor with identical key and no second debit", async () => {
    const test = setup();
    const lost = (async (url, init) => { const response = await test.transport(url, init); if (init?.method === "POST") throw new Error("lost"); return response; }) as typeof fetch;
    await expect(runGameCommand({ ...test.options, transport: lost })).rejects.toMatchObject({ uncertain: true });
    const pending = readPendingCommand(test.options.storage, ownerId)!;
    await runConstructionCommand({ ...test.options, retryKey: pending.key, action: pending.action }, test.transport);
    expect(test.requests.map(command => command.key)).toEqual(["first-key", "first-key"]);
    expect(test.state().ownedFurniture[buy.furnitureId]).toBe(1);
    expect(readPendingCommand(test.options.storage, ownerId)).toBeNull();
  });

  it("migrates legacy editor receipt before any main allocation and preserves original key", async () => {
    const test = setup(); let allocated = false;
    const legacy = retainCommand(test.options.session, ownerId, buy, () => "legacy-key", now);
    await runGameCommand({ ...test.options, makeKey: () => { allocated = true; return "wrong"; }, transport: test.transport });
    expect(allocated).toBe(false); expect(test.requests[0].key).toBe(legacy.key);
    expect(readPendingCommand(test.options.session, ownerId)).toBeNull();
  });

  it("retains both conflicting legacy and durable receipts and sends nothing", async () => {
    const test = setup();
    const legacy = retainCommand(test.options.session, ownerId, buy, () => "legacy-key", now);
    const durable = retainCommand(test.options.storage, ownerId, { type: "character.rest" }, () => "durable-key", now);
    await expect(runGameCommand({ ...test.options, transport: test.transport })).rejects.toThrow("hai giao dịch");
    expect(test.requests).toHaveLength(0);
    expect(readPendingCommand(test.options.session, ownerId)).toEqual(legacy);
    expect(readPendingCommand(test.options.storage, ownerId)).toEqual(durable);
  });

  it("performs editor migration preflight under the same shared lock", async () => {
    const test = setup(); const legacy = retainCommand(test.options.session, ownerId, buy, () => "legacy-key", now);
    await runConstructionCommand({ ...test.options, retryKey: legacy.key, preflight: () => migrateConstructionCommand(test.options.session, test.options.storage, ownerId) }, test.transport);
    expect(test.requests[0].key).toBe(legacy.key); expect(readPendingCommand(test.options.session, ownerId)).toBeNull();
  });

  it("does not regenerate a cleared explicit retry from another screen", async () => {
    const test = setup(); await runGameCommand({ ...test.options, transport: test.transport });
    await expect(runConstructionCommand({ ...test.options, revision: test.state().revision, retryKey: "first-key" }, test.transport)).rejects.toMatchObject({ code: "PENDING_CHANGED" });
    expect(test.requests).toHaveLength(1);
  });

  it.each(["main", "editor"])("keeps unconfirmed construction revision receipt in %s", async caller => {
    const test = setup(), state = test.state(), building = getBuilding(state);
    const action = { type: "construction.commit", expectedRevision: building.revision, plan: building.plan } as const;
    const transport = (async () => new Response(JSON.stringify({ state }))) as typeof fetch;
    const result = caller === "main" ? runGameCommand({ ...test.options, action, transport }) : runConstructionCommand({ ...test.options, action }, transport);
    await expect(result).rejects.toMatchObject({ uncertain: true });
    expect(readPendingCommand(test.options.storage, ownerId)?.key).toBe("first-key");
  });

  it("preserves late old-owner receipt and does not publish old-owner success", async () => {
    const test = setup(), entered = deferred(), release = deferred();
    const slow = (async (url, init) => { if (init?.method === "POST") { entered.resolve(); await release.promise; } return test.transport(url, init); }) as typeof fetch;
    const pending = runGameCommand({ ...test.options, transport: slow }); await entered.promise;
    test.changeOwner("owner-b"); release.resolve();
    await expect(pending).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(readPendingCommand(test.options.storage, ownerId)?.key).toBe("first-key");
    expect(test.options.storage.getItem("lifelevel-state-changed")).toBeNull();
  });

  it("fails closed without Web Locks before migrating or sending", async () => {
    const test = setup(); const legacy = retainCommand(test.options.session, ownerId, buy, () => "legacy", now);
    await expect(runGameCommand({ ...test.options, locks: null, transport: test.transport })).rejects.toMatchObject({ code: "LOCK_UNAVAILABLE" });
    expect(test.requests).toHaveLength(0); expect(readPendingCommand(test.options.session, ownerId)).toEqual(legacy);
  });
});

describe("nonpersistent daily reconciliation", () => {
  it("boots and reconciles despite an uncertain receipt without overwriting it", async () => {
    const test = setup(), receipt = retainCommand(test.options.storage, ownerId, buy, () => "uncertain", now);
    let cache: GameSnapshot | undefined;
    const result = await refreshGameState({ storage: test.options.storage, locks: test.options.locks, transport: test.transport, getCurrent: () => cache, accept: next => { cache = next; }, isActive: () => true, makeKey: () => "reconcile" });
    expect(result.state.userId).toBe(ownerId); expect(test.requests[0].action.type).toBe("reconcile");
    expect(readPendingCommand(test.options.storage, ownerId)).toEqual(receipt);
  });

  it("waits for a purchase lock before reconcile POST and keeps cache monotonic", async () => {
    const test = setup(), entered = deferred(), release = deferred();
    const slow = (async (url, init) => { if (init?.method === "POST") { entered.resolve(); await release.promise; } return test.transport(url, init); }) as typeof fetch;
    const purchase = runGameCommand({ ...test.options, transport: slow }); await entered.promise;
    let cache: GameSnapshot | undefined = { state: { ...test.state(), revision: 8 } };
    const refresh = refreshGameState({ storage: test.options.storage, locks: test.options.locks, transport: test.transport, getCurrent: () => cache, accept: next => { cache = next; }, isActive: () => true, makeKey: () => "reconcile" });
    expect(test.requests).toHaveLength(0); release.resolve(); await purchase; await refresh;
    expect(test.requests.map(command => command.action.type)).toEqual(["furniture.buy", "reconcile"]);
    expect(cache?.state.revision).toBe(8);
  });

  it("does not apply a late reconciliation after cache owner changes", async () => {
    const test = setup(), entered = deferred(), release = deferred();
    let cache: GameSnapshot | undefined = { state: test.state() };
    const transport = (async (url, init) => { if (init?.method === "POST") { entered.resolve(); await release.promise; } return test.transport(url, init); }) as typeof fetch;
    const pending = refreshGameState({ storage: test.options.storage, locks: test.options.locks, transport, getCurrent: () => cache, accept: next => { cache = next; }, isActive: () => true });
    await entered.promise; cache = { state: createInitialState("owner-b", now) }; release.resolve();
    await expect(pending).rejects.toMatchObject({ code: "OWNER_CHANGED" }); expect(cache.state.userId).toBe("owner-b");
  });
});
