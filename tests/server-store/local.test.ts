import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import { gameCommand, readGame, saveProposal, compareAndSetProposal, readPrivate, updateFinance, type DataEnvelope } from "@/server/store";
import { applyAction, createInitialState } from "@/domain";
import type { GameState } from "@/domain/types";

const owner = "store-test-owner";
let directory: string;
const savePath = () => path.join(directory, `${owner}.json`);
const disk = async () => JSON.parse(await readFile(savePath(), "utf8")) as DataEnvelope;
async function seed(state: GameState) { await writeFile(savePath(), JSON.stringify({ game: state, finance: null, proposals: {}, commands: {} }), "utf8"); }
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "lifelevel-store-test-"));
  vi.stubEnv("LOCAL_DEV_MODE", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL", ""); vi.stubEnv("LOCAL_DATA_DIR", directory);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  const resolved = path.resolve(directory); const allowed = path.resolve(tmpdir()) + path.sep;
  if (!resolved.startsWith(allowed) || !path.basename(resolved).startsWith("lifelevel-store-test-")) throw new Error("Refusing unsafe test cleanup");
  await rm(resolved, { recursive: true, force: true });
});

describe("real isolated local store concurrency", () => {
  it("reading a new or existing save does not write or reconcile gameplay", async () => {
    const initial = await readGame(owner); expect(initial.revision).toBe(0);
    await expect(stat(savePath())).rejects.toMatchObject({ code: "ENOENT" });
    await seed(initial); const before = await readFile(savePath(), "utf8"); const timestamp = (await stat(savePath())).mtimeMs;
    expect(await readGame(owner)).toEqual(initial); expect(await readFile(savePath(), "utf8")).toBe(before); expect((await stat(savePath())).mtimeMs).toBe(timestamp);
  });
  it("two different keys completing one occurrence grant rewards exactly once", async () => {
    const created = await gameCommand(owner, randomUUID(), { type: "task.create", task: { title: "Do meaningful work", difficulty: "medium" } });
    const action = { type: "task.complete" as const, occurrenceId: created.state.occurrences[0].id };
    const results = await Promise.allSettled([gameCommand(owner, randomUUID(), action), gameCommand(owner, randomUUID(), action)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const saved = await readGame(owner); expect(saved.occurrences[0].status).toBe("completed"); expect(saved.gold).toBe(25);
    expect(saved.journal.filter(event => event.type === "task.complete")).toHaveLength(1); expect(saved.ledger.filter(entry => entry.reason === "Quest completion")).toHaveLength(1);
  });
  it("concurrent purchases cannot overdraw the shared Gold balance", async () => {
    const initial = createInitialState(owner); initial.gold = 90; await seed(initial);
    const results = await Promise.allSettled([gameCommand(owner, randomUUID(), { type: "item.buy", definitionId: "neural-visor" }), gameCommand(owner, randomUUID(), { type: "item.buy", definitionId: "neural-visor" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const saved = await readGame(owner); expect(saved.gold).toBe(0); expect(saved.inventory.filter(item => item.definitionId === "neural-visor")).toHaveLength(1);
  });
  it("concurrent crafts consume a limited material set once", async () => {
    const initial = createInitialState(owner); initial.gold = 100; initial.materials = { alloy: 8, "energy-core": 2 }; await seed(initial);
    const results = await Promise.allSettled([gameCommand(owner, randomUUID(), { type: "item.craft", recipeId: "craft-katana" }), gameCommand(owner, randomUUID(), { type: "item.craft", recipeId: "craft-katana" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const saved = await readGame(owner); expect(saved.gold).toBe(50); expect(saved.materials).toMatchObject({ alloy: 0, "energy-core": 0 }); expect(saved.inventory.filter(item => item.definitionId === "cyber-katana")).toHaveLength(1);
  });
  it("same key with different content fails without rewriting state", async () => {
    const key = randomUUID(); await gameCommand(owner, key, { type: "character.rename", name: "First" }); const before = await disk();
    await expect(gameCommand(owner, key, { type: "character.rename", name: "Second" })).rejects.toMatchObject({ status: 409 }); expect(await disk()).toEqual(before);
  });
  it("replaying a reward command returns current state and never rerolls loot", async () => {
    const initial = createInitialState(owner); initial.bosses[0].hp = 1; await seed(initial);
    const task = await gameCommand(owner, randomUUID(), { type: "task.create", task: { title: "Finish work" } });
    const key = randomUUID(); const action = { type: "task.complete" as const, occurrenceId: task.state.occurrences[0].id };
    const rewarded = await gameCommand(owner, key, action); const inventory = rewarded.state.inventory;
    await gameCommand(owner, randomUUID(), { type: "character.rename", name: "Latest Name" });
    const replay = await gameCommand(owner, key, action);
    expect(replay.state.character.name).toBe("Latest Name"); expect(replay.state.inventory).toEqual(inventory);
    expect(replay.state.journal.filter(event => event.type === "boss.defeated")).toHaveLength(1);
    expect((await disk()).commands[key].result).not.toHaveProperty("state");
  });
  it("proposal approval and rejection have one compare-and-set winner", async () => {
    await saveProposal(owner, "proposal", { status: "pending" });
    const results = await Promise.all([compareAndSetProposal(owner, "proposal", "pending", { status: "applying" }), compareAndSetProposal(owner, "proposal", "pending", { status: "rejected" })]);
    expect(results).toEqual([true, false]); expect(await readPrivate(owner, "proposals")).toEqual({ proposal: { status: "applying" } });
  });
  it("a finance exception cannot partially write or alter game Gold", async () => {
    await seed(createInitialState(owner)); const before = await disk();
    await expect(updateFinance(owner, () => { throw new Error("Invalid transaction"); })).rejects.toThrow("Invalid transaction"); expect(await disk()).toEqual(before);
  });
  it("invalid action rolls back its changes without losing a pending overdue penalty", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const initial = applyAction(createInitialState(owner, yesterday), { type: "task.create", task: { title: "Commitment", committed: true, difficulty: "medium" } }, { userId: owner, now: yesterday, eventId: randomUUID(), random: () => 0.5 }).state;
    await seed(initial); const before = await disk();
    await expect(gameCommand(owner, randomUUID(), { type: "item.buy", definitionId: "neural-visor" })).rejects.toThrow();
    expect(await disk()).toEqual(before); // The failed transaction leaves the original open debt intact.
    const settled = await gameCommand(owner, randomUUID(), { type: "reconcile" });
    expect(settled.state.character.hp).toBe(85); expect(settled.state.occurrences[0].status).toBe("missed");
    const repeated = await gameCommand(owner, randomUUID(), { type: "reconcile" }); expect(repeated.state.character.hp).toBe(85);
    expect(Object.keys((await disk()).commands)).toHaveLength(0);
  });
  it("a valid mutation reconciles pending penalties before changing rules", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const initial = applyAction(createInitialState(owner, yesterday), { type: "task.create", task: { title: "Commitment", committed: true, difficulty: "medium" } }, { userId: owner, now: yesterday, eventId: randomUUID(), random: () => 0.5 }).state;
    await seed(initial);
    const result = await gameCommand(owner, randomUUID(), { type: "settings.update", settings: { hardcore: false } });
    expect(result.state.character.hp).toBe(85); expect(result.state.settings.hardcore).toBe(false); expect(result.events.some(event => event.type === "penalty")).toBe(true);
  });
  it("no-op reconciliation does not rewrite the save or create command receipts", async () => {
    await seed(createInitialState(owner));
    await gameCommand(owner, randomUUID(), { type: "reconcile" });
    const timestamp = (await stat(savePath())).mtimeMs;
    await gameCommand(owner, randomUUID(), { type: "reconcile" });
    expect((await stat(savePath())).mtimeMs).toBe(timestamp); expect(Object.keys((await disk()).commands)).toHaveLength(0);
  });
});
