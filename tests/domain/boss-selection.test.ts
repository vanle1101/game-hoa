import { describe, expect, it } from "vitest";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";

const now = "2026-10-16T10:00:00Z";
const context = { userId: "owner", now, random: () => 0.5, eventId: "selection" };

function withMeaningfulSelection(): GameState {
  return applyAction(createInitialState("owner", now), {
    type: "boss.habit.create",
    boss: { name: "Daily walk", polarity: "positive", targetDays: 7 },
  }, { ...context, eventId: "habit" }).state;
}

describe("switching from meaningful to legacy bosses", () => {
  it("selects an existing legacy encounter and clears the meaningful selection", () => {
    const state = withMeaningfulSelection();
    const result = applyAction(state, { type: "boss.select", encounterId: "first-encounter" }, context).state;
    expect(result.activeBossId).toBe("first-encounter");
    expect(result.activeMeaningfulBossId).toBeUndefined();
    expect(result.meaningfulBosses).toEqual(state.meaningfulBosses);
    expect(state.activeMeaningfulBossId).toBeDefined();
  });

  it("starts a legacy encounter and clears the meaningful selection", () => {
    const state = withMeaningfulSelection();
    state.character.xp = 100;
    const result = applyAction(state, { type: "boss.start", definitionId: "deadline-sentinel" }, context).state;
    expect(result.activeBossId).toBe("selection:boss");
    expect(result.bosses.find((boss) => boss.id === result.activeBossId)?.definitionId).toBe("deadline-sentinel");
    expect(result.activeMeaningfulBossId).toBeUndefined();
    expect(result.meaningfulBosses).toEqual(state.meaningfulBosses);
  });

  it("creates a campaign and clears the meaningful selection", () => {
    const state = withMeaningfulSelection();
    const result = applyAction(state, {
      type: "campaign.create", title: "Launch", tasks: [{ title: "Ship release" }],
    }, context).state;
    expect(result.activeBossId).toBe(result.campaigns[0].bossId);
    expect(result.activeMeaningfulBossId).toBeUndefined();
    expect(result.meaningfulBosses).toEqual(state.meaningfulBosses);
  });

  it.each<{ name: string; action: Action }>([
    { name: "missing encounter", action: { type: "boss.select", encounterId: "missing" } },
    { name: "locked encounter", action: { type: "boss.start", definitionId: "deadline-sentinel" } },
    { name: "duplicate encounter", action: { type: "boss.start", definitionId: "static-wraith" } },
    { name: "invalid campaign task", action: { type: "campaign.create", title: "Launch", tasks: [{ title: "Valid" }, { title: "Past", dueDate: "2026-10-15" }] } },
  ])("retains all state after rejecting $name", ({ action }) => {
    const state = withMeaningfulSelection();
    const before = structuredClone(state);
    expect(() => applyAction(state, action, context)).toThrow();
    expect(state).toEqual(before);
    expect(state.activeMeaningfulBossId).toBeDefined();
  });

  it("retains the meaningful selection when the legacy encounter is defeated", () => {
    const state = withMeaningfulSelection();
    state.bosses[0].defeatedAt = now;
    const before = structuredClone(state);
    expect(() => applyAction(state, { type: "boss.select", encounterId: "first-encounter" }, context)).toThrow();
    expect(state).toEqual(before);
  });
});
