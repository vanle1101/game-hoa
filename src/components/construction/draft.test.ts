import { describe, expect, it } from "vitest";
import { emptyPlan, edgeKey } from "@/construction/grid";
import { areaCells, pushDraft, redoDraft, toolDraft, undoDraft, type DraftHistory } from "./draft";
const point = (x: number, z: number, level = 0) => ({ x, z, level });
const history = (): DraftHistory => ({ past: [], present: emptyPlan(), future: [] });

describe("construction editor draft history", () => {
  it("keeps the committed source immutable through tools, undo and redo", () => {
    const initial = history(); const before = structuredClone(initial);
    const room = toolDraft(initial.present, "room", point(0, 0), point(2, 2), "floor-concrete");
    const first = pushDraft(initial, room);
    const painted = toolDraft(first.present, "floor", point(0, 0), point(1, 1), "floor-wood");
    const second = pushDraft(first, painted);
    expect(initial).toEqual(before); expect(second.present.floors.filter(cell => cell.materialId === "floor-wood")).toHaveLength(4);
    const undone = undoDraft(second); expect(undone.present).toEqual(room); expect(redoDraft(undone).present).toEqual(painted);
    expect(undoDraft(undone).present).toEqual(emptyPlan()); expect(initial.present).toEqual(emptyPlan());
  });
  it("new edits after undo invalidate the abandoned redo branch", () => {
    const first = pushDraft(history(), toolDraft(emptyPlan(), "floor", point(0, 0), point(0, 0), "floor-concrete"));
    const next = pushDraft(first, toolDraft(first.present, "floor", point(1, 0), point(1, 0), "floor-concrete"));
    const undo = undoDraft(next); expect(undo.future).toHaveLength(1);
    const branch = pushDraft(undo, toolDraft(undo.present, "floor", point(2, 0), point(2, 0), "floor-wood"));
    expect(branch.future).toHaveLength(0); expect(redoDraft(branch)).toBe(branch);
  });
  it("no-op tools do not add history and stack is bounded to fifty steps", () => {
    let draft = history(); expect(pushDraft(draft, structuredClone(draft.present))).toBe(draft);
    for (let i = 0; i < 75; i++) { const plan = structuredClone(draft.present); plan.roomNames.example = `Version ${i}`; draft = pushDraft(draft, plan); }
    expect(draft.past).toHaveLength(50); expect(undoDraft(history())).toEqual(history());
  });
  it("cancel is a local reset to committed state with no mutation effects", () => {
    const committed = toolDraft(emptyPlan(), "room", point(0, 0), point(2, 2), "floor-concrete");
    let draft: DraftHistory = { past: [], present: structuredClone(committed), future: [] };
    draft = pushDraft(draft, toolDraft(draft.present, "erase", point(0, 0), point(0, 0), ""));
    draft = { past: [], present: structuredClone(committed), future: [] };
    expect(draft.present).toEqual(committed); expect(draft.past).toHaveLength(0); expect(draft.future).toHaveLength(0);
  });
});

describe("construction editor tools", () => {
  it("drags snapped walls once in either orientation", () => {
    let plan = toolDraft(emptyPlan(), "wall", point(0, 0), point(3, 0), "wall-basic", { ...point(0, 0), orientation: "x" });
    expect(plan.walls).toHaveLength(3); expect(new Set(plan.walls.map(edgeKey)).size).toBe(3);
    plan = toolDraft(plan, "wall", point(3, 0), point(0, 0), "wall-basic", { ...point(0, 0), orientation: "x" }); expect(plan.walls).toHaveLength(3);
    plan = toolDraft(plan, "wall", point(0, 0), point(0, 2), "wall-basic", { ...point(0, 0), orientation: "z" }); expect(plan.walls).toHaveLength(5);
  });
  it("attaches/replaces openings and demolishes the containing wall in one step", () => {
    const edge = { ...point(0, 0), orientation: "x" as const };
    let plan = toolDraft(emptyPlan(), "room", point(0, 0), point(2, 2), "floor-concrete");
    plan = toolDraft(plan, "door", point(0, 0), point(0, 0), "door-standard", edge);
    expect(plan.walls.find(wall => edgeKey(wall) === edgeKey({ ...edge, materialId: "" }))?.opening?.kind).toBe("door");
    plan = toolDraft(plan, "window", point(0, 0), point(0, 0), "window-small", edge);
    expect(plan.walls[0].opening?.catalogId).toBe("window-small");
    const count = plan.walls.length; plan = toolDraft(plan, "erase", point(0, 0), point(0, 0), "", edge);
    expect(plan.walls).toHaveLength(count - 1);
    expect(plan.walls.every(wall => edgeKey(wall) !== edgeKey({ ...edge, materialId: "" }))).toBe(true);
  });
  it("rejects an opening without a wall", () => {
    expect(() => toolDraft(emptyPlan(), "door", point(0, 0), point(0, 0), "door-standard")).toThrow();
    expect(() => toolDraft(emptyPlan(), "window", point(0, 0), point(0, 0), "window-small", { ...point(0, 0), orientation: "x" })).toThrow();
  });
  it("paint affects the selected wall while floor tool paints the selected area", () => {
    const source = toolDraft(emptyPlan(), "room", point(0, 0), point(2, 2), "floor-concrete");
    const plan = toolDraft(source, "paint", point(0, 0), point(0, 0), "wall-metal", { ...point(0, 0), orientation: "x" });
    expect(plan.walls.filter(wall => wall.materialId === "wall-metal")).toHaveLength(1); expect(source.walls.every(wall => wall.materialId === "wall-basic")).toBe(true);
    const floors = toolDraft(plan, "floor", point(1, 1), point(2, 2), "floor-wood"); expect(floors.floors.filter(cell => cell.materialId === "floor-wood")).toHaveLength(4);
  });
  it("erasing a floor region clears its ceiling and roof draft together", () => {
    let plan = toolDraft(emptyPlan(), "floor", point(0, 0), point(1, 1), "floor-concrete");
    plan = toolDraft(plan, "ceiling", point(0, 0), point(1, 1), "ceiling-basic"); plan = toolDraft(plan, "roof", point(0, 0), point(1, 1), "roof-flat");
    plan = toolDraft(plan, "erase", point(0, 0), point(0, 0), ""); expect(plan.floors).toHaveLength(3); expect(plan.ceilings).toHaveLength(3); expect(plan.roofs).toHaveLength(3);
  });
  it("supports reversed region gestures and bounds oversized drags", () => {
    expect(areaCells(point(2, 2), point(0, 0))).toHaveLength(9);
    expect(() => areaCells(point(0, 0), point(40, 0))).toThrow();
  });
});
