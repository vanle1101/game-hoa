import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../src/domain/engine";
import { postGameCommand, syncPendingGameCommand, type CommandStorage } from "../../src/components/game/command-client";
import { runLockedGameCommand } from "../../src/components/game/command-lock";
import { postFinanceCommand, readFinanceForOwner, readPendingFinanceCommand } from "../../src/components/game/finance-command-client";

const owner = "account-owner";
const action = { type: "character.rest" } as const;
function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const response = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers });

describe("server-backed game command recovery", () => {
  it("restores an accepted command on another device and caches it best-effort", async () => {
    const storage = memory();
    const transport = vi.fn(async () => response({ ownerId: owner, intent: { domain: "game", key: "same-key", command: action, createdAt: "2026-10-26T00:00:00.000Z" } }));
    const command = await syncPendingGameCommand(owner, storage, transport as typeof fetch);
    expect(command).toMatchObject({ ownerId: owner, key: "same-key", action });
    expect(JSON.parse(storage.getItem(`lifelevel-pending-command:${owner}`)!)).toEqual(command);
    expect(transport).toHaveBeenCalledWith(`/api/game/intent?expectedOwnerId=${owner}`, { cache: "no-store" });
  });

  it("uses the server receipt even when browser storage is unavailable", async () => {
    const storage: CommandStorage = { getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("disabled"); }, removeItem: () => { throw new Error("disabled"); } };
    const pending = { ownerId: owner, key: "server-key", action, createdAt: "2026-10-26T00:00:00.000Z" };
    const locks = { request: async <T>(_name: string, _options: { mode: "exclusive" }, callback: (lock: { name: string }) => Promise<T>) => callback({ name: "lock" }) };
    const send = vi.fn(async () => ({ state: { ...createInitialState(owner), revision: 1 }, message: "Saved" }));
    await runLockedGameCommand({ ownerId: owner, revision: 0, storage, action, retryKey: pending.key,
      getCurrentOwnerId: () => owner, locks, syncPending: async () => pending, send });
    expect(send).toHaveBeenCalledWith(pending);
  });

  it("clears stale browser cache after the server completed an uncertain command", async () => {
    const storage = memory();
    storage.setItem(`lifelevel-pending-command:${owner}`, JSON.stringify({ ownerId: owner, key: "old", action, createdAt: "old" }));
    expect(await syncPendingGameCommand(owner, storage, (async () => response({ ownerId: owner, intent: null })) as typeof fetch)).toBeNull();
    expect(storage.getItem(`lifelevel-pending-command:${owner}`)).toBeNull();
  });

  it("treats an accepted 202 response as uncertain and sends the captured revision", async () => {
    const transport = vi.fn(async (...args: [unknown, RequestInit?]) => { void args; return response({ status: "pending", key: "key" }, 202); });
    await expect(postGameCommand({ ownerId: owner, key: "key", action, createdAt: "now" }, transport as typeof fetch, 7))
      .rejects.toMatchObject({ uncertain: true });
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({ expectedOwnerId: owner, expectedRevision: 7, key: "key" });
  });

  it("rejects an intent returned for a different owner", async () => {
    const storage = memory();
    await expect(syncPendingGameCommand(owner, storage, (async () => response({ ownerId: "other", intent: null })) as typeof fetch))
      .rejects.toMatchObject({ uncertain: true });
    expect(storage.getItem(`lifelevel-pending-command:${owner}`)).toBeNull();
  });
});

describe("finance receipt client", () => {
  const financeCommand = { type: "account.create", name: "Bank", openingBalance: 100 } as const;
  it("reads an owner-scoped pending receipt and reuses its key in POST", async () => {
    const pending = await readPendingFinanceCommand(owner, (async () => response({ ownerId: owner, intent: {
      domain: "finance", key: "original", status: "queued", command: financeCommand,
    } })) as typeof fetch);
    expect(pending).toMatchObject({ key: "original", command: financeCommand });
    const transport = vi.fn(async (...args: [unknown, RequestInit?]) => { void args; return response({ status: "pending", key: "original" }, 202); });
    expect(await postFinanceCommand(owner, financeCommand, pending!.key, transport as typeof fetch)).toEqual({ status: "pending" });
    expect(transport.mock.calls[0][1]?.headers).toMatchObject({ "Idempotency-Key": "original", "X-Expected-Owner-Id": owner });
  });

  it("requires the finance GET response to match the active owner", async () => {
    const state = { version: 1, accounts: [], transactions: [], budgets: [], goals: [], bills: [], applied: {} };
    await expect(readFinanceForOwner(owner, (async () => response(state, 200, { "X-Owner-Id": "other" })) as typeof fetch))
      .rejects.toThrow("Phiên tài khoản đã thay đổi");
  });
});
