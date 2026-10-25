import { describe, expect, it } from "vitest";
import { validateConstruction, constructionContext, getBuilding } from "../../src/construction/engine";
import { emptyPlan, rectangleRoom } from "../../src/construction/grid";
import { attachToSlot, furnitureSubtree, moveFurnitureTree, withLotObject, withoutFurnitureTree } from "../../src/construction/lot-objects";
import { PlacementFlags, hasPlacementFlag } from "../../src/furniture/placement-flags";
import { FURNITURE } from "../../src/domain/catalog";
import { applyAction, createInitialState } from "../../src/domain/engine";

function furnishedRoom() {
  const plan = rectangleRoom(emptyPlan(), { x: 0, z: 0, level: 0 }, { x: 4, z: 4, level: 0 });
  const desk = withLotObject({ id: "desk", furnitureId: "workstation", x: 0, z: 1, level: 0, rotation: 0 });
  plan.furniture.push(desk);
  const lamp = attachToSlot({ id: "lamp", furnitureId: "table-lamp", x: 0, z: 0, level: 0, rotation: 0, light_color: "#ff00aa", light_dimmer_value: 2 }, desk.id, "surface-left", plan)!;
  plan.furniture.push(lamp);
  return { plan, desk, lamp };
}

describe("Build/Buy lot objects", () => {
  it("maps catalog placement rules to flags and surface slots", () => {
    const find = (id: string) => FURNITURE.find(item => item.id === id)!;
    expect(hasPlacementFlag(find("pink_neon_wall").placementFlags, PlacementFlags.SNAP_TO_WALL)).toBe(true);
    expect(hasPlacementFlag(find("ceiling-neon").placementFlags, PlacementFlags.CEILING)).toBe(true);
    expect(hasPlacementFlag(find("haven-sofa").placementFlags, PlacementFlags.GROUNDED_AGAINST_WALL)).toBe(true);
    expect(hasPlacementFlag(find("table-lamp").placementFlags, PlacementFlags.REQUIRES_SLOT)).toBe(true);
    expect(find("workstation").slots).toHaveLength(2);
    expect(find("v7-dining-table").slots).toHaveLength(2);
  });

  it("saves a slotted child without treating the tabletop as a floor collision", () => {
    const state = createInitialState("owner", "2026-10-23T00:00:00Z");
    state.ownedFurniture = { workstation: 1, "table-lamp": 1 };
    const { plan, lamp } = furnishedRoom();
    expect(() => validateConstruction(getBuilding(state), plan, constructionContext(state))).not.toThrow();
    expect(lamp).toMatchObject({ object_def_guid: "table-lamp", parent_id: "desk", slot_hash: "surface-left", light_color: "#ff00aa", light_dimmer_value: 2 });
    const wrong = structuredClone(plan);
    wrong.furniture[1].transform!.position.x += 1;
    expect(() => validateConstruction(getBuilding(state), wrong, constructionContext(state))).toThrow(/aligned with its slot/);
  });

  it("moves and rotates a surface with its child, then stashes the whole subtree", () => {
    const { plan, desk, lamp } = furnishedRoom();
    const moved = moveFurnitureTree(plan, { ...desk, x: 2, z: 1, rotation: 90 });
    const movedLamp = moved.furniture.find(item => item.id === lamp.id)!;
    expect(moved.furniture).toHaveLength(2);
    expect(movedLamp.parent_id).toBe(desk.id);
    expect(movedLamp.transform!.position).not.toEqual(lamp.transform!.position);
    expect(furnitureSubtree(moved, desk.id).map(item => item.id)).toEqual(["desk", "lamp"]);
    expect(withoutFurnitureTree(moved, desk.id).furniture).toHaveLength(0);
  });

  it("rejects two objects claiming the same surface slot", () => {
    const state = createInitialState("owner", "2026-10-23T00:00:00Z");
    state.ownedFurniture = { workstation: 1, "table-lamp": 2 };
    const { plan, lamp } = furnishedRoom();
    plan.furniture.push({ ...lamp, id: "second-lamp" });
    expect(() => validateConstruction(getBuilding(state), plan, constructionContext(state))).toThrow(/slot is already occupied/);
  });

  it("sells the surface while returning children to household inventory", () => {
    const state = createInitialState("owner", "2026-10-23T00:00:00Z");
    state.ownedFurniture = { workstation: 1, "table-lamp": 1 };
    const { plan } = furnishedRoom();
    state.building = { ...getBuilding(state), plan };
    const result = applyAction(state, { type: "furniture.sell", furnitureId: "workstation", placementId: "desk" }, {
      userId: state.userId, now: "2026-10-23T00:00:00Z", random: () => 0.5, eventId: "sell-desk",
    });
    expect(getBuilding(result.state).plan.furniture).toHaveLength(0);
    expect(result.state.ownedFurniture.workstation).toBe(0);
    expect(result.state.ownedFurniture["table-lamp"]).toBe(1);
    expect(result.state.gold).toBe(Math.floor(FURNITURE.find(item => item.id === "workstation")!.price * 0.8));
  });
});
