import { describe, expect, it } from "vitest";
import { addLedStripDraft, removeLedStripDraft, updateLedStripColor, pushDraft, undoDraft } from "../../src/components/construction/draft";
import { emptyPlan } from "../../src/construction/grid";
import { buildingPlanSchema } from "../../src/construction/schema";
import { validateConstruction } from "../../src/construction/engine";
import type { BuildingState, ConstructionContext } from "../../src/construction/types";

const context: ConstructionContext = { gold: 1000, characterLevel: 10, ownedFurniture: {}, defeatedCampaign: true };
const point = (x: number, z: number) => ({ x, z, level: 0 });
function building(): BuildingState {
  const plan = emptyPlan();
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) plan.floors.push({ x, z, level: 0, materialId: "floor-concrete" });
  return { version: 1, revision: 0, plot: { minX: 0, maxX: 4, minZ: 0, maxZ: 4, maxLevel: 0, cellSize: 1 }, plan, paid: {}, starterGrantApplied: true, migratedAt: "2026-10-22T00:00:00.000Z", legacyPlacementsPreserved: true };
}

describe("neon strip drafts", () => {
  it("snaps orthogonally, persists, recolors, removes and undoes", () => {
    const base = building();
    const added = addLedStripDraft(base.plan, point(0, 0), point(3, 1), "#00f0ff", "strip-1");
    expect(added.ledStrips?.[0].end).toEqual(point(3, 0));
    expect(buildingPlanSchema.parse(added).ledStrips).toEqual(added.ledStrips);
    expect(validateConstruction(base, added, context).ledStrips).toEqual(added.ledStrips);
    const recolored = updateLedStripColor(added, "strip-1", "#ff00aa");
    expect(recolored.ledStrips?.[0].color).toBe("#ff00aa");
    const history = pushDraft({ past: [], present: base.plan, future: [] }, added);
    expect(undoDraft(history).present.ledStrips).toEqual([]);
    expect(removeLedStripDraft(recolored, "strip-1").ledStrips).toEqual([]);
  });

  it("rejects unsupported, diagonal and duplicate strips", () => {
    const base = building();
    const valid = addLedStripDraft(base.plan, point(0, 0), point(2, 0), "#00f0ff", "a");
    expect(() => validateConstruction(base, { ...valid, ledStrips: [{ ...valid.ledStrips![0], end: point(3, 3) }] }, context)).toThrow(/orthogonal/);
    expect(() => validateConstruction(base, { ...valid, ledStrips: [{ ...valid.ledStrips![0], end: point(5, 0) }] }, context)).toThrow(/supporting floor/);
    expect(() => validateConstruction(base, { ...valid, ledStrips: [valid.ledStrips![0], valid.ledStrips![0]] }, context)).toThrow(/Duplicate neon/);
  });
});
