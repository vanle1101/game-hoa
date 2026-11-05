import { describe, expect, it } from "vitest";
import { createInitialState, applyAction } from "../../src/domain/engine";
import { taskInputSchema } from "../../src/domain/validation";
import type { ActionContext, Task, TaskInput } from "../../src/domain/types";
import { taskEditPatch } from "../../src/components/game/quest-model";

const now = "2026-11-03T05:00:00.000Z";
const context = (userId: string, eventId: string): ActionContext => ({ userId, now, random: () => 0.25, eventId });

describe("quest skill training link", () => {
  it("validates, creates, edits, and clears a linked skill reward", () => {
    const input: TaskInput = { title: "Practice harmonization", targetSkillId: "skill-harmonization", xpReward: 100 };
    expect(taskInputSchema.safeParse(input).success).toBe(true);
    expect(taskInputSchema.safeParse({ ...input, xpReward: 0 }).success).toBe(false);

    const initial = createInitialState("skill-task-owner", now);
    const created = applyAction(initial, { type: "task.create", task: input }, context(initial.userId, "skill-task-create-test")).state;
    const task = created.tasks.find((item) => item.title === input.title)!;
    expect(task).toMatchObject({ targetSkillId: "skill-harmonization", xpReward: 100 });

    const edited = applyAction(created, { type: "task.edit", taskId: task.id, task: { targetSkillId: null, xpReward: 125 } }, context(created.userId, "skill-task-edit-test")).state;
    expect(edited.tasks.find((item) => item.id === task.id)).toMatchObject({ targetSkillId: null, xpReward: 125 });
  });

  it("does not produce patches for legacy task defaults, but preserves explicit link removal", () => {
    const base: Task = {
      id: "legacy-task", title: "Legacy task", description: "", kind: "once", difficulty: "medium", skill: "knowledge",
      duration: 25, priority: "normal", dueDate: "2026-11-03", timezone: "Asia/Ho_Chi_Minh", committed: false,
      checklist: [], archived: false, createdAt: now, exceptions: [],
    };
    const defaults: TaskInput = { title: base.title, description: "", skill: "knowledge", targetSkillId: null, xpReward: 100, checklist: [] };
    expect(taskEditPatch(base, defaults)).toEqual({});

    const linked = { ...base, targetSkillId: "child-skill", xpReward: 100 };
    const clear: TaskInput = { ...defaults, targetSkillId: null };
    expect(taskEditPatch(linked, clear)).toMatchObject({ targetSkillId: null });
  });
});
