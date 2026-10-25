import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../src/domain/engine";
import { FURNITURE } from "../../src/domain/catalog";
import { getBuilding } from "../../src/construction";
import type { CommandStorage, PendingGameCommand } from "../../src/components/game/command-client";
import { retainCommand } from "../../src/components/game/command-client";
import { canApplyConstructionResponse, initialOwnedFurniture, migrateConstructionCommand, readConstructionCommand, reconcileConstructionDraft, retainConstructionCommand, runConstructionCommand as runLockedConstruction, validateConstructionState, type ConstructionAction } from "../../src/components/construction/command-state";

const now = "2026-01-01T00:00:00.000Z";
const owner = "owner-a";
const buy: ConstructionAction = { type: "furniture.buy", furnitureId: FURNITURE[0].id };
function memory(): CommandStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
function commit(): ConstructionAction {
  const building = getBuilding(createInitialState(owner, now));
  return { type: "construction.commit", expectedRevision: building.revision, plan: structuredClone(building.plan) };
}
function success(action: ConstructionAction, userId = owner) {
  const state = createInitialState(userId, now);
  state.revision = 1;
  state.building = structuredClone(getBuilding(state));
  if (action.type === "construction.commit") { state.building.revision = action.expectedRevision + 1; state.building.plan = structuredClone(action.plan); }
  else state.ownedFurniture[action.furnitureId] = 1;
  return state;
}
const transport = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
function runConstructionCommand(storage: CommandStorage, command: PendingGameCommand, fetcher: typeof fetch, getCurrentOwnerId = () => command.ownerId) {
  return runLockedConstruction({ storage, ownerId: command.ownerId, action: command.action, retryKey: command.key, revision: 0, getCurrentOwnerId, locks: { request: async (name, _options, callback) => callback({ name }) } }, fetcher);
}

 describe("construction durable transaction recovery", () => {
  it("migrates a legacy session receipt without changing its key or action", () => {
    const session=memory(), durable=memory();
    const original=retainConstructionCommand(session,owner,buy,()=>"legacy-key",now);
    migrateConstructionCommand(session,durable,owner);
    expect(readConstructionCommand(durable,owner)).toEqual(original);
    expect(readConstructionCommand(session,owner)).toBeNull();
    migrateConstructionCommand(session,durable,owner);
    expect(readConstructionCommand(durable,owner)).toEqual(original);
  });
  it("preserves both receipts when session and durable intents conflict", () => {
    const session=memory(), durable=memory();
    const legacy=retainConstructionCommand(session,owner,buy,()=>"legacy-key",now);
    const current=retainConstructionCommand(durable,owner,commit(),()=>"current-key",now);
    expect(()=>migrateConstructionCommand(session,durable,owner)).toThrow("hai giao dịch");
    expect(readConstructionCommand(session,owner)).toEqual(legacy);
    expect(readConstructionCommand(durable,owner)).toEqual(current);
  });
  it("does not delete a session receipt if durable storage cannot retain it", () => {
    const session=memory(), durable=memory();
    const legacy=retainConstructionCommand(session,owner,buy,()=>"legacy-key",now);
    durable.setItem=()=>{};
    expect(()=>migrateConstructionCommand(session,durable,owner)).toThrow("Chưa thể chuyển");
    expect(readConstructionCommand(session,owner)).toEqual(legacy);
  });
  it.each(["furniture.buy", "construction.commit"])("replays the exact %s key and action after lost response and reload", async type => {
    const storage = memory(); const action = type === "furniture.buy" ? buy : commit();
    const key = vi.fn(() => "first-key");
    const first = retainConstructionCommand(storage, owner, action, key, now);
    const requests: unknown[] = [];
    const offline = (async (_url: unknown, init?: RequestInit) => { requests.push(JSON.parse(String(init?.body))); throw new Error("lost response"); }) as typeof fetch;
    await expect(runConstructionCommand(storage, first, offline)).rejects.toMatchObject({ uncertain: true });
    const reloaded = readConstructionCommand(storage, owner)!;
    expect(reloaded).toEqual(first);
    const retry = (async (_url: unknown, init?: RequestInit) => { requests.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ state: success(action) })); }) as typeof fetch;
    await runConstructionCommand(storage, reloaded, retry);
    expect(requests).toEqual([{ key: first.key, action, expectedOwnerId: owner }, { key: first.key, action, expectedOwnerId: owner }]);
    expect(key).toHaveBeenCalledTimes(1);
    expect(readConstructionCommand(storage, owner)).toBeNull();
  });
  it("adopts a recovered commit after remount without turning the old clean plan into a revert draft", async () => {
    const storage = memory(); const action = commit();
    if (action.type !== "construction.commit") throw new Error("expected commit");
    const oldPlan = structuredClone(action.plan); action.plan.roomNames.room = "Phòng đã lưu";
    const retained = retainConstructionCommand(storage, owner, action, () => "commit-key", now);
    const history = { past: [], present: structuredClone(oldPlan), future: [] };
    const state = await runConstructionCommand(storage, retained, transport({ state: success(action) }));
    const recovered = reconcileConstructionDraft(history, oldPlan, action.plan, getBuilding(state).plan);
    expect(recovered.present).toEqual(action.plan); expect(recovered.past).toEqual([]);
  });
  it("preserves a genuinely edited new draft when the original commit retry succeeds", () => {
    const action = commit(); if (action.type !== "construction.commit") throw new Error("expected commit");
    const oldPlan = structuredClone(action.plan); action.plan.roomNames.room = "Đã gửi";
    const newPlan = structuredClone(action.plan); newPlan.roomNames.room = "Nháp mới";
    const history = { past: [oldPlan], present: newPlan, future: [] };
    expect(reconcileConstructionDraft(history, oldPlan, action.plan, action.plan)).toBe(history);
    expect(reconcileConstructionDraft({ ...history, present: action.plan }, oldPlan, action.plan, action.plan).past).toEqual([]);
  });
  it("cannot mutate the saved commit plan or replace it with a new draft or purchase", () => {
    const storage = memory(); const action = commit();
    const retained = retainConstructionCommand(storage, owner, action, () => "commit-key", now);
    if (action.type !== "construction.commit") throw new Error("expected commit");
    action.plan.roomNames.newRoom = "Phòng mới";
    expect(retained.action).not.toEqual(action);
    expect(() => retainConstructionCommand(storage, owner, action, () => "new-key", now)).toThrow("chưa được xác nhận");
    expect(() => retainConstructionCommand(storage, owner, buy, () => "buy-key", now)).toThrow("chưa được xác nhận");
    expect(readConstructionCommand(storage, owner)).toEqual(retained);
  });
  it("blocks commits and other purchases while a buy is pending", () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "buy-key", now);
    expect(() => retainConstructionCommand(storage, owner, commit(), () => "commit-key", now)).toThrow();
    expect(() => retainConstructionCommand(storage, owner, { type: "furniture.buy", furnitureId: FURNITURE[1].id }, () => "other-key", now)).toThrow();
    expect(retainConstructionCommand(storage, owner, buy, () => "replacement", now)).toEqual(first);
  });
  it("preserves pending transaction through a valid GET reload", () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, commit(), () => "key", now);
    validateConstructionState(success(commit()), owner);
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("preserves a nonconstruction command without sending it from the editor", async () => {
    const storage = memory(); const pending = retainCommand(storage, owner, { type: "reconcile" }, () => "other-key", now);
    const fetcher = vi.fn();
    expect(() => retainConstructionCommand(storage, owner, buy, () => "buy-key", now)).toThrow();
    await expect(runConstructionCommand(storage, pending, fetcher)).rejects.toThrow("màn hình chính");
    expect(fetcher).not.toHaveBeenCalled(); expect(readConstructionCommand(storage, owner)).toEqual(pending);
  });
  it.each([408, 429, 500, 503])("retains original action for uncertain HTTP %s", async status => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "key", now);
    await expect(runConstructionCommand(storage, first, transport({ error: "retry" }, status))).rejects.toMatchObject({ uncertain: true });
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("retains the original command when the server reports an owner change", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "key", now);
    await expect(runConstructionCommand(storage, first, transport({ error: "owner changed", code: "OWNER_CHANGED" }, 409))).rejects.toMatchObject({ uncertain: true });
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("does not send when storage silently drops writes", () => {
    const storage = memory(); storage.setItem = () => {};
    expect(() => retainConstructionCommand(storage, owner, buy, () => "key", now)).toThrow("Không thể lưu giao dịch an toàn");
  });
  it("preserves the retry key when receipt removal fails", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "key", now);
    storage.removeItem = () => { throw new Error("storage denied"); };
    await expect(runConstructionCommand(storage, first, transport({ state: success(buy) }))).rejects.toThrow("storage denied");
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("clears only a confirmed terminal rejection", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "key", now);
    await expect(runConstructionCommand(storage, first, transport({ error: "denied" }, 409))).rejects.toMatchObject({ uncertain: false });
    expect(readConstructionCommand(storage, owner)).toBeNull();
  });
  it.each(["read", "write", "corrupt", "substituted"])("fails closed on %s storage problems", kind => {
    const storage = memory();
    if (kind === "read") storage.getItem = () => { throw new Error("blocked"); };
    if (kind === "write") storage.setItem = () => { throw new Error("quota"); };
    if (kind === "corrupt") storage.setItem(`lifelevel-pending-command:${owner}`, "null");
    if (kind === "substituted") storage.setItem(`lifelevel-pending-command:${owner}`, JSON.stringify({ ownerId: "other", key: "key", action: buy, createdAt: now }));
    expect(() => retainConstructionCommand(storage, owner, buy, () => "new-key", now)).toThrow();
  });
 });

 describe("construction response owner and revision safety", () => {
  it("rejects another owner's successful POST and retains the original key", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "a-key", now);
    await expect(runConstructionCommand(storage, first, transport({ state: success(buy, "owner-b") }))).rejects.toMatchObject({ uncertain: true });
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("rejects mismatched owner GET reload", () => {
    expect(() => validateConstructionState(success(buy, "owner-b"), owner)).toThrow("người chơi");
  });
  it("does not adopt late success after owner switch or switch back", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "a-key", now);
    const second = retainConstructionCommand(storage, "owner-b", buy, () => "b-key", now);
    let resolve!: (response: Response) => void;
    const deferred = (async () => new Promise<Response>(done => { resolve = done; })) as typeof fetch;
    const current = { state: createInitialState(owner, now), epoch: 0 };
    const pending = runConstructionCommand(storage, first, deferred, () => current.epoch === 0 ? current.state.userId : "");
    await Promise.resolve();
    current.state = createInitialState("owner-b", now); current.epoch++;
    resolve(new Response(JSON.stringify({ state: success(buy) })));
    await expect(pending).rejects.toMatchObject({ code: "OWNER_CHANGED" });
    expect(canApplyConstructionResponse(owner, 0, current, success(buy))).toBe(false);
    current.state = createInitialState(owner, now); current.epoch++;
    expect(canApplyConstructionResponse(owner, 0, current, success(buy))).toBe(false);
    expect(readConstructionCommand(storage, owner)).toEqual(first);
    expect(readConstructionCommand(storage, "owner-b")).toEqual(second);
  });
  it("acknowledges a stale receipt but never rolls local state back", async () => {
    const storage = memory(); const action = commit(); const first = retainConstructionCommand(storage, owner, action, () => "key", now);
    const current = success(action); current.revision = 8; current.building!.revision = 4;
    const incoming = await runConstructionCommand(storage, first, transport({ state: success(action) }));
    expect(readConstructionCommand(storage, owner)).toBeNull();
    expect(canApplyConstructionResponse(owner, 0, { state: current, epoch: 0 }, incoming)).toBe(false);
    incoming.revision = 9;
    expect(canApplyConstructionResponse(owner, 0, { state: current, epoch: 0 }, incoming)).toBe(false);
    incoming.building!.revision = 4;
    expect(canApplyConstructionResponse(owner, 0, { state: current, epoch: 0 }, incoming)).toBe(true);
  });
  it.each(["global", "building", "unchanged-commit"])("retains key for invalid %s revision", async kind => {
    const storage = memory(); const action = commit(); const first = retainConstructionCommand(storage, owner, action, () => "key", now);
    const state = success(action);
    if (kind === "global") state.revision = -1;
    if (kind === "building") state.building!.revision = -1;
    if (kind === "unchanged-commit") state.building!.revision = 0;
    await expect(runConstructionCommand(storage, first, transport({ state }))).rejects.toMatchObject({ uncertain: true });
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
  it("keeps uncertainty for non-JSON responses", async () => {
    const storage = memory(); const first = retainConstructionCommand(storage, owner, buy, () => "key", now);
    await expect(runConstructionCommand(storage, first, (async () => new Response("not json")) as typeof fetch)).rejects.toMatchObject({ uncertain: true });
    expect(readConstructionCommand(storage, owner)).toEqual(first);
  });
 });

 describe("initial furniture selection", () => {
  it("selects only a known catalog ID with positive integral ownership", () => {
    const state = createInitialState(owner, now); const id = FURNITURE[0].id;
    expect(initialOwnedFurniture(state, id)).toBe("");
    for (const count of [0, -1, 0.5, Infinity]) { state.ownedFurniture[id] = count; expect(initialOwnedFurniture(state, id)).toBe(""); }
    state.ownedFurniture[id] = 1; expect(initialOwnedFurniture(state, id)).toBe(id);
    state.ownedFurniture.unknown = 1; expect(initialOwnedFurniture(state, "unknown")).toBe("");
    expect(initialOwnedFurniture(createInitialState("owner-b", now), id)).toBe("");
    expect(initialOwnedFurniture(state)).toBe("");
  });
 });
