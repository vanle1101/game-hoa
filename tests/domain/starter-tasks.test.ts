import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionContext, GameState } from "../../src/domain/types";
import { STARTER_TASKS_VERSION } from "../../src/domain/starter-tasks";

const now = "2026-10-27T10:00:00.000Z";
const context = (eventId: string, overrides: Partial<ActionContext> = {}): ActionContext => ({
  userId: "starter-owner", now, eventId, random: () => 0.99, ...overrides,
});
const act = (state: GameState, action: Action, eventId: string, overrides?: Partial<ActionContext>) =>
  applyAction(state, action, context(eventId, overrides)).state;

describe("dashboard starter tasks", () => {
  it("persists three dated, high-priority tasks linked to the active boss exactly once", () => {
    const initial = createInitialState("starter-owner", now);
    const seeded = act(initial, { type: "reconcile" }, "first-load");
    expect(initial.tasks).toHaveLength(0);
    expect(seeded.starterTasksVersion).toBe(STARTER_TASKS_VERSION);
    expect(seeded.tasks.map(task => task.title)).toEqual(["Học tiếng Anh 30 phút", "Làm bài các dự án", "Tập gym"]);
    expect(seeded.tasks.every(task => task.kind === "once" && task.priority === "high" && task.bossId === initial.activeBossId)).toBe(true);
    expect(seeded.occurrences.map(occurrence => occurrence.date)).toEqual(["2026-10-27", "2026-10-27", "2026-10-27"]);
    expect(act(seeded, { type: "reconcile" }, "second-load")).toBe(seeded);
  });

  it("completion awards real XP and Gold, damages the boss, and never recreates archived work", () => {
    let state = act(createInitialState("starter-owner", now), { type: "reconcile" }, "seed");
    state.character.hp = 82;
    const occurrence = state.occurrences[0];
    const initialHp = state.bosses[0].hp;
    state = act(state, { type: "task.complete", occurrenceId: occurrence.id }, "complete");
    expect(state.occurrences[0].status).toBe("completed");
    expect(state.character.xp).toBeGreaterThan(0);
    expect(state.gold).toBeGreaterThan(0);
    expect(state.character.hp).toBe(87);
    expect(state.bosses[0].hp).toBeLessThan(initialHp);
    state = act(state, { type: "task.archive", taskId: state.tasks[1].id }, "archive");
    const taskIds = state.tasks.map(task => task.id);
    const again = act(state, { type: "reconcile" }, "later", { now: "2026-10-28T10:00:00.000Z" });
    expect(again.tasks.map(task => task.id)).toEqual(taskIds);
    expect(again.tasks[1].archived).toBe(true);
    expect(again.occurrences[0].status).toBe("completed");
  });

  it("never inserts starter work into a save with existing or historical tasks", () => {
    const existing = createInitialState("starter-owner", now);
    const withUserTask = act(existing, { type: "task.create", task: { title: "Việc của tôi" } }, "user-task");
    const preserved = act(withUserTask, { type: "reconcile" }, "load");
    expect(preserved.tasks.map(task => task.title)).toEqual(["Việc của tôi"]);

    const historical = createInitialState("starter-owner", now);
    historical.journal.push({ id: "old-task", type: "task.archive", title: "Archived task", at: now, data: {} });
    expect(act(historical, { type: "reconcile" }, "historical-load").tasks).toHaveLength(0);
  });

  it("skips task seeding during automatic command reconciliation", () => {
    const state = createInitialState("starter-owner", now);
    const reconciled = act(state, { type: "reconcile" }, "internal", { seedStarterTasks: false });
    expect(reconciled.tasks).toHaveLength(0);
    expect(act(reconciled, { type: "task.create", task: { title: "Bắt đầu theo ý tôi" } }, "my-task").tasks.map(task => task.title)).toEqual(["Bắt đầu theo ý tôi"]);
  });

  it("caps starter healing at 100 HP and leaves ordinary task healing unchanged", () => {
    let state = act(createInitialState("starter-owner", now), { type: "reconcile" }, "seed-heal");
    state.character.hp = 98;
    state = act(state, { type: "task.complete", occurrenceId: state.occurrences[0].id }, "starter-heal");
    expect(state.character.hp).toBe(100);
    state.character.hp = 80;
    state = act(state, { type: "task.create", task: { title: "Công việc riêng" } }, "own-task");
    state = act(state, { type: "task.complete", occurrenceId: state.occurrences.at(-1)!.id }, "ordinary-complete");
    expect(state.character.hp).toBe(80);
  });
});
