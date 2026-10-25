import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { createBackup } from "../../src/backup";

const now = "2026-10-15T22:00:00Z"; // 05:00 the next day in Vietnam.
function runner(initial = createInitialState("owner", now)) {
  let state = initial, counter = 0;
  return {
    get state() { return state; },
    act(action: Action, at = now, eventId = `daily-${counter++}`) {
      const result = applyAction(state, action, { userId: "owner", now: at, eventId, random: () => 0.5 });
      state = result.state;
      return result;
    },
  };
}
function habit(initial?: GameState, targetLocalTime?: string) {
  const r = runner(initial);
  r.act({ type: "boss.habit.create", boss: { name: "Dậy sớm", polarity: "positive", targetDays: 7, targetLocalTime } });
  const bossId = r.state.meaningfulBosses![0].id;
  return { r, bossId, checkpoint: { type: "boss.habit.checkpoint", bossId, date: "2026-10-16", outcome: "success", confirmed: true } as const };
}

describe("daily habit rewards", () => {
  it("rewards a standalone day once, with no reward for missed or predeclared rest days", () => {
    const initial = createInitialState("owner", now);
    initial.settings.restDays = ["2026-10-18"];
    const { r, checkpoint } = habit(initial);
    r.act(checkpoint, now, "unique-confirmation");
    expect(r.state.gold).toBe(12);
    expect(r.state.character.xp).toBe(25);
    expect(r.state.rewardBudgets["2026-10-16"]).toEqual({ xp: 25, gold: 12, completed: 1 });
    expect(r.act(checkpoint, now, "unique-confirmation").events).toHaveLength(0);
    expect(() => r.act(checkpoint)).toThrow(/đã được xác nhận/);
    r.act({ ...checkpoint, date: "2026-10-17", outcome: "missed" }, "2026-10-17T10:00:00Z");
    r.act({ ...checkpoint, date: "2026-10-18", outcome: "rest" }, "2026-10-18T10:00:00Z");
    expect(r.state.gold).toBe(12);
    expect(r.state.character.xp).toBe(25);
    expect(r.state.journal.filter((event) => event.type === "boss.habit.reward")).toHaveLength(1);
  });

  it.each([
    [{ xp: 595, gold: 297, completed: 19 }, 5, 3],
    [{ xp: 600, gold: 300, completed: 20 }, 0, 0],
    [{ xp: 10, gold: 10, completed: 20 }, 0, 0],
  ] as const)("shares the task reward caps (%j)", (budget, xp, gold) => {
    const initial = createInitialState("owner", now);
    initial.rewardBudgets["2026-10-16"] = { ...budget };
    const { r, checkpoint } = habit(initial);
    r.act(checkpoint);
    expect(r.state.character.xp).toBe(xp);
    expect(r.state.gold).toBe(gold);
    expect(r.state.meaningfulBosses![0].habit!.successDays).toBe(1);
  });

  it("manual linked confirmation completes the task using its single reward", () => {
    const r = runner();
    r.act({ type: "task.create", task: { title: "Đi bộ", kind: "daily" } });
    r.act({ type: "boss.habit.create", boss: { name: "Vận động", polarity: "positive", targetDays: 7, taskId: r.state.tasks[0].id } });
    const occurrenceId = r.state.occurrences[0].id;
    const checkpoint = { type: "boss.habit.checkpoint", bossId: r.state.meaningfulBosses![0].id, date: "2026-10-16", outcome: "success", confirmed: true } as const;
    const result = r.act(checkpoint);
    const taskReward = result.events.find((event) => event.type === "task.complete")!.data!;
    expect(r.state.gold).toBe(taskReward.gold);
    expect(r.state.character.xp).toBe(taskReward.xp);
    expect(r.state.occurrences[0].status).toBe("completed");
    expect(r.state.meaningfulBosses![0].habit!.checkpoints[0].occurrenceId).toBe(occurrenceId);
    expect(r.state.rewardBudgets["2026-10-16"].completed).toBe(1);
    expect(result.events.some((event) => event.type === "boss.habit.reward")).toBe(false);
    expect(() => r.act({ type: "task.complete", occurrenceId })).toThrow();
    expect(() => r.act(checkpoint)).toThrow();
    expect(() => r.act({ type: "undo" })).toThrow();
  });
});

describe("honest local target time", () => {
  it("accepts the target minute in the habit timezone and persists it", () => {
    const { r, checkpoint } = habit(undefined, "06:30");
    r.act(checkpoint, "2026-10-15T23:30:00Z");
    expect(r.state.meaningfulBosses![0].habit!.successDays).toBe(1);
    expect(createBackup("owner", r.state, null, {}, now).game.meaningfulBosses![0].habit!.targetLocalTime).toBe("06:30");
  });

  it("rejects late and next-day retroactive confirmations atomically", () => {
    const { r, checkpoint } = habit(undefined, "06:30");
    const before = structuredClone(r.state);
    expect(() => r.act(checkpoint, "2026-10-15T23:31:00Z")).toThrow(/06:30/);
    expect(() => r.act(checkpoint, "2026-10-16T22:00:00Z")).toThrow(/06:30/);
    expect(r.state).toEqual(before);
  });

  it("rejects negative habits with target times and malformed time input", () => {
    const r = runner();
    expect(() => r.act({ type: "boss.habit.create", boss: { name: "X", polarity: "negative", targetDays: 7, targetLocalTime: "06:30" } })).toThrow(/tích cực/);
    expect(() => habit(undefined, "24:00")).toThrow();
  });

  it("direct completion of a linked task cannot bypass the target", () => {
    const r = runner();
    r.act({ type: "task.create", task: { title: "Dậy sớm", kind: "daily" } });
    r.act({ type: "boss.habit.create", boss: { name: "Dậy sớm", polarity: "positive", targetDays: 7, targetLocalTime: "06:30", taskId: r.state.tasks[0].id } });
    const before = structuredClone(r.state);
    expect(() => r.act({ type: "task.complete", occurrenceId: r.state.occurrences[0].id }, "2026-10-15T23:31:00Z")).toThrow(/06:30/);
    expect(r.state).toEqual(before);
  });
});

describe("atomic character save", () => {
  it("saves all legacy and modular fields in one action and rejects invalid patches without partial mutation", () => {
    const r = runner();
    r.act({ type: "character.update", name: "Nova", hair: "#123456", skin: "#654321", hairstyle: "swept", appearance: { facePreset: 5, hairPreset: 11, eyeColor: "#abcdef", body: "athletic" } });
    expect(r.state.character).toMatchObject({ name: "Nova", hair: "#123456", skin: "#654321", hairstyle: "swept", appearance: { facePreset: 5, hairPreset: 11, eyeColor: "#abcdef", body: "athletic" } });
    const before = structuredClone(r.state);
    expect(() => r.act({ type: "character.update", name: "Changed", appearance: { height: 5 } })).toThrow();
    expect(r.state).toEqual(before);
    r.act({ type: "character.update", appearance: { facePreset: 1 } });
    expect(r.state.character.appearance).toMatchObject({ facePreset: 1, hairPreset: 11, body: "athletic" });
  });
});
