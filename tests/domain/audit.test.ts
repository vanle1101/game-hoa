import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, damagePreview, derivedStats, equipmentLoot } from "../../src/domain/engine";
import { actionSchema } from "../../src/domain/validation";
import type { Action, GameState } from "../../src/domain/types";
import { ITEMS } from "../../src/domain/catalog";

const now = "2026-10-15T12:00:00Z";
function session(initial = createInitialState("player", now)) {
  let state = initial, serial = 0;
  return { get state() { return state; }, act(action: Action, at = now, random = () => 0.5) { const result = applyAction(state, action, { userId: "player", eventId: `audit-${serial++}`, now: at, random }); state = result.state; return result; } };
}
describe("quest editing and recurrence audit", () => {
  it("starts an opted-in hardcore player at zero balances without equipment-loss consent", () => { const s = createInitialState("player", now); expect(s.gold).toBe(0); expect(s.character.xp).toBe(0); expect(s.settings.hardcore).toBe(true); expect(s.settings.equipmentLossAccepted).toBe(false); });
  it("edits quest fields and persists checklist, date, timezone and recurrence", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Old title" } }); const id = r.state.tasks[0].id;
    r.act({ type: "task.edit", taskId: id, task: { title: "Read before sleep", description: "A real routine", difficulty: "easy", duration: 15, skill: "knowledge", kind: "weekly", priority: "high", dueDate: "2026-10-16", timezone: "America/New_York", checklist: ["Put phone away", "Read"] } });
    expect(r.state.tasks[0]).toMatchObject({ title: "Read before sleep", kind: "weekly", timezone: "America/New_York", dueDate: "2026-10-16", duration: 15, skill: "knowledge" }); expect(r.state.tasks[0].checklist).toHaveLength(2);
    expect(r.state.occurrences[0].status).toBe("canceled"); expect(r.state.occurrences[1].date).toBe("2026-10-16");
    r.act({ type: "reconcile" }, "2026-10-23T12:00:00Z"); expect(r.state.occurrences.at(-1)?.date).toBe("2026-10-23");
  });
  it("does not reopen completed occurrences or alter completed reward history", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Do work" } }); r.act({ type: "task.complete", occurrenceId: r.state.occurrences[0].id }); const gold = r.state.gold;
    expect(() => r.act({ type: "task.edit", taskId: r.state.tasks[0].id, task: { difficulty: "epic" } })).toThrow(/Closed/); expect(r.state.gold).toBe(gold);
  });
  it("rejects empty patches, extra reward fields, invalid priorities, dates and timezones at both boundaries", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Study" } }); const id = r.state.tasks[0].id;
    for (const task of [{}, { gold: 999 }, { difficulty: "cheat" }, { priority: "super" }, { dueDate: "2026-02-30" }, { timezone: "Planet/Mars" }, { checklist: [" "] }]) {
      const action = { type: "task.edit", taskId: id, task }; expect(actionSchema.safeParse(action).success).toBe(false); expect(() => r.act(action as Action)).toThrow();
    }
  });
  it("cannot evade a commitment through edit, completion or overdue cancellation", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Commitment", committed: true } }); const id = r.state.tasks[0].id;
    for (const task of [{ dueDate: "2026-10-16" }, { difficulty: "easy" as const }, { committed: false }, { kind: "daily" as const }, { duration: 1 }]) expect(() => r.act({ type: "task.edit", taskId: id, task })).toThrow(/commitment/);
    r.act({ type: "task.edit", taskId: id, task: { title: "Clarify the same commitment" } });
    expect(() => r.act({ type: "task.complete", occurrenceId: r.state.occurrences[0].id }, "2026-10-16T12:00:00Z")).toThrow(/overdue/);
    expect(() => r.act({ type: "task.edit", taskId: id, task: { title: "Erase penalty" } }, "2026-10-16T12:00:00Z")).toThrow(/Reconcile/);
  });
  it("daily negative-habit avoidance is rewardable once per occurrence and recurs", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Avoid doomscrolling", kind: "negative-habit", skill: "health" } }); const first = r.state.occurrences[0].id;
    expect(() => r.act({ type: "task.complete", occurrenceId: first })).toThrow(/ngày đã kết thúc/); r.act({ type: "task.complete", occurrenceId: first }, "2026-10-16T12:00:00Z"); expect(r.state.journal.some((e) => e.title === "Avoided: Avoid doomscrolling")).toBe(true); expect(() => r.act({ type: "task.complete", occurrenceId: first })).toThrow();
    r.act({ type: "reconcile" }, "2026-10-16T12:00:00Z"); const second = r.state.occurrences.at(-1)!; expect(second.id).not.toBe(first); expect(second.status).toBe("open");
    r.act({ type: "task.complete", occurrenceId: second.id }, "2026-10-17T12:00:00Z"); expect(r.state.character.skillXp.health).toBeGreaterThan(0);
  });
  it("each recurrence follows its stored timezone independently of profile date", () => {
    const r = session(); r.act({ type: "task.create", task: { title: "Pacific routine", kind: "daily", committed: true, timezone: "America/Los_Angeles" } });
    r.act({ type: "reconcile" }, "2026-10-15T18:00:00Z"); expect(r.state.occurrences).toHaveLength(1); expect(r.state.character.hp).toBe(100);
    r.act({ type: "reconcile" }, "2026-10-16T08:00:00Z"); expect(r.state.occurrences).toHaveLength(2); expect(r.state.character.hp).toBe(85);
  });
  it("undefined optional patches do not corrupt persisted fields", () => { const r = session(); r.act({ type: "task.create", task: { title: "Keep name" } }); r.act({ type: "task.edit", taskId: r.state.tasks[0].id, task: { title: undefined, description: "Changed" } }); expect(r.state.tasks[0].title).toBe("Keep name"); r.act({ type: "settings.update", settings: { hardcore: undefined, reducedMotion: true } }); expect(r.state.settings.hardcore).toBe(true); });
});
describe("new-player vertical slice and undo audit", () => {
  it("weighted loot favors uncommon equipment over rare equipment and excludes level-locked tiers", () => { const counts: Record<string, number> = {}; for (let i = 0; i < 1000; i++) { const item = equipmentLoot(1, (i + 0.5) / 1000); counts[item.rarity] = (counts[item.rarity] ?? 0) + 1; expect(item.level).toBeLessThanOrEqual(3); } expect(counts.uncommon).toBeGreaterThan(counts.rare); expect(counts.legendary).toBeUndefined(); expect(() => equipmentLoot(1, 1)).toThrow(); });
  it("real tasks earn boss loot, equip it, and change the next damage calculation", () => {
    const r = session(); const beforePower = derivedStats(r.state).attack;
    for (let i = 0; i < 3; i++) { r.act({ type: "task.create", task: { title: `Real milestone ${i}`, difficulty: "hard", duration: 30 } }); r.act({ type: "task.complete", occurrenceId: r.state.occurrences.at(-1)!.id }, now, () => 0); }
    const defeated = r.state.bosses[0]; expect(defeated.hp).toBe(0); expect(defeated.loot).toHaveLength(1); expect(r.state.gold).toBeGreaterThan(0);
    const loot = r.state.inventory.find((item) => item.id === defeated.loot![0])!; const definition = ITEMS.find((d) => d.id === loot.definitionId); expect(definition).toBeDefined(); expect(definition!.price).toBeGreaterThan(0); expect(definition!.level).toBeLessThanOrEqual(3);
    r.act({ type: "boss.start", definitionId: "deadline-sentinel" }); const before = damagePreview(r.state);
    r.act({ type: "item.equip", itemId: loot.id }); expect(derivedStats(r.state).attack).toBeGreaterThan(beforePower); const after = damagePreview(r.state); expect(after.normal).toBeGreaterThan(before.normal);
    r.act({ type: "task.create", task: { title: "Apply new focus", duration: 30 } }); const hp = r.state.bosses.at(-1)!.hp; r.act({ type: "task.complete", occurrenceId: r.state.occurrences.at(-1)!.id }); expect(hp - r.state.bosses.at(-1)!.hp).toBe(after.normal);
  });
  it("boss-victory undo restores currencies, materials, boss and loot but keeps append-only compensation", () => {
    const r = session(); let before: GameState | undefined;
    for (let i = 0; i < 3; i++) { r.act({ type: "task.create", task: { title: `Work ${i}`, difficulty: "hard", duration: 30 } }); if (i === 2) before = structuredClone(r.state); r.act({ type: "task.complete", occurrenceId: r.state.occurrences.at(-1)!.id }, now, () => 0); }
    const id = r.state.occurrences.at(-1)!.id; const journalLength = r.state.journal.length;
    r.act({ type: "undo" }, "2026-10-15T12:01:00Z", () => { throw Error("Undo must not roll"); });
    expect(r.state.gold).toBe(before!.gold); expect(r.state.character.xp).toBe(before!.character.xp); expect(r.state.inventory).toEqual(before!.inventory); expect(r.state.materials).toEqual(before!.materials); expect(r.state.bosses).toEqual(before!.bosses);
    expect(r.state.ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(r.state.gold); expect(r.state.journal.length).toBe(journalLength + 1); expect(r.state.journal.at(-1)?.type).toBe("undo");
    expect(r.state.occurrences.at(-1)?.status).toBe("canceled"); expect(() => r.act({ type: "task.complete", occurrenceId: id }, now, () => { throw Error("Retry must not roll"); })).toThrow(/occurrence/);
    expect(() => r.act({ type: "task.edit", taskId: r.state.tasks.at(-1)!.id, task: { dueDate: "2026-10-16" } })).toThrow(/Closed/);
  });
  it("game reducer cannot mutate finance through action fields", () => { const r = session(); expect(actionSchema.safeParse({ type: "finance.credit", amount: 500 }).success).toBe(false); expect(() => r.act({ type: "settings.update", settings: { finance: { balance: 500 } } } as unknown as Action)).toThrow(); expect("finance" in r.state).toBe(false); });
});
