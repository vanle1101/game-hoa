import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, BoxGeometry, Raycaster, Vector3 } from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { settleHousing, createStarterHome } from "../../src/housing/engine";
import { materializeWallOpenings, createFixedApartment, migrateFoundation } from "../../src/construction/migration";
import { beginFurnitureMove, cancelFurnitureMove, finishFurnitureMove, furnitureSelectionIntent } from "../../src/components/construction/furniture-selection";
import { undoDraft } from "../../src/components/construction/draft";
import { edgeKey } from "../../src/construction/grid";
import { withLotObject, withoutFurnitureTree } from "../../src/construction/lot-objects";
import { wallCutoutsForSegment, wallInsertAtPoint, wallInsertCenter, wallInsertPlacementValid } from "../../src/construction/wall-inserts";

const now = "2026-10-26T00:00:00.000Z";

describe("wall insert selection and household lifecycle", () => {
  it("cancels a carried item to its exact original state and commits a move as one undo step", () => {
    const plan = createStarterHome("studio", now).plan;
    const bed = plan.furniture.find(item => item.furnitureId === "cloud-bed")!;
    const history = { past: [], present: plan, future: [] };
    const move = beginFurnitureMove(history, bed.id)!;
    expect(move.preview.furniture.some(item => item.id === bed.id)).toBe(false);
    expect(move.originalHistory.present.furniture.find(item => item.id === bed.id)).toEqual(bed);
    const moved = withLotObject({ ...bed, x: bed.x + 1, rotation: 90 });
    const committed = finishFurnitureMove(move, { ...move.preview, furniture: [...move.preview.furniture, moved] });
    expect(committed.past).toHaveLength(1);
    expect(committed.present.furniture.find(item => item.id === bed.id)).toMatchObject({ x: bed.x + 1, rotation: 90 });
    expect(undoDraft(committed).present.furniture.find(item => item.id === bed.id)).toEqual(bed);
    expect(cancelFurnitureMove(move)).toBe(history);
  });
  it("lifts placed furniture with Select or Move while keeping live interactions separate", () => {
    expect(furnitureSelectionIntent("select", "build")).toBe("pickup");
    expect(furnitureSelectionIntent("select", "buy")).toBe("pickup");
    expect(furnitureSelectionIntent("move", "build")).toBe("pickup");
    expect(furnitureSelectionIntent("erase", "build")).toBe("sell");
    expect(furnitureSelectionIntent("select", "live")).toBe("select");
  });

  it("resolves a click on the transparent wall over a door to the insert", () => {
    const plan = createStarterHome("studio", now).plan;
    const door = plan.furniture.find(item => item.furnitureId === "glass_door_modern")!;
    const wall = plan.walls.find(item => edgeKey(item) === door.wall_id)!;
    const center = wallInsertCenter(door, plan.walls)!;
    expect(wallInsertAtPoint(wall, plan, { ...center, y: wall.level * 3 + 1 })).toBe(door);
    expect(wallInsertAtPoint(wall, plan, { ...center, y: wall.level * 3 + 2.75 })).toBeUndefined();
  });

  it("puts the transparent insert hitbox ahead of the wall hitbox on either side", () => {
    const wall = new Mesh(new BoxGeometry(1, 2.7, 0.22), new MeshBasicMaterial());
    const insert = new Mesh(new BoxGeometry(2, 2.4, 0.7), new MeshBasicMaterial({ transparent: true, opacity: 0 }));
    wall.position.y = 1.35;
    insert.position.y = 1.2;
    wall.updateMatrixWorld(true);
    insert.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
      const hits = new Raycaster(new Vector3(0, 1.2, side * 3), new Vector3(0, 0, -side)).intersectObjects([wall, insert]);
      expect(hits[0]?.object).toBe(insert);
    }
    wall.geometry.dispose(); insert.geometry.dispose();
    (wall.material as MeshBasicMaterial).dispose(); (insert.material as MeshBasicMaterial).dispose();
  });

  it("converts every starter opening into an owned, stable wall insert", () => {
    const legacy = createFixedApartment(now);
    const before = legacy.plan.walls.filter(wall => wall.opening).length;
    const upgraded = materializeWallOpenings(legacy.plan);
    expect(before).toBe(3);
    expect(upgraded.walls.some(wall => wall.opening)).toBe(false);
    expect(upgraded.furniture).toHaveLength(3);
    expect(new Set(upgraded.furniture.map(item => item.id)).size).toBe(3);
    expect(materializeWallOpenings(upgraded)).toBe(upgraded);
    expect(legacy.plan.walls.filter(wall => wall.opening)).toHaveLength(3);
    const state = createInitialState("opening-owner", now);
    state.building = legacy;
    const migrated = migrateFoundation(state);
    expect(migrated.ownedFurniture.glass_door_modern).toBe(1);
    expect(migrated.ownedFurniture.wide_window_cyber).toBe(2);
    expect(migrateFoundation(migrated)).toBe(migrated);
  });

  it("relocates a door by closing its old CSG hole and opening the new wall", () => {
    const starter = createStarterHome("studio", now);
    const door = starter.plan.furniture.find(item => item.furnitureId === "glass_door_modern")!;
    const oldWall = starter.plan.walls.find(wall => edgeKey(wall) === door.wall_id)!;
    const destination = starter.plan.walls.find(wall => wall.orientation === "z" && wall.x === 6 && wall.z === 0)!;
    const pickedUp = withoutFurnitureTree(starter.plan, door.id);
    expect(wallCutoutsForSegment(oldWall, pickedUp)).toEqual([]);
    const moved = withLotObject({ ...door, x: destination.x, z: destination.z, level: destination.level,
      wall_id: edgeKey(destination), wall_u: 0.5, wallNormal: [1, 0, 0], wallY: 0, rotation: 0 });
    expect(wallInsertPlacementValid(pickedUp, moved)).toBe(true);
    const placed = { ...pickedUp, furniture: [...pickedUp.furniture, moved] };
    expect(wallCutoutsForSegment(destination, placed).some(cut => cut.id === door.id)).toBe(true);
    expect(wallCutoutsForSegment(oldWall, placed)).toEqual([]);
  });

  it("stashes a door without losing ownership and sells a placed window with a refund", () => {
    const initial = createInitialState("insert-economy", now);
    const settled = settleHousing(initial, { districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, now).state;
    const door = settled.building!.plan.furniture.find(item => item.furnitureId === "glass_door_modern")!;
    const doorWall = settled.building!.plan.walls.find(wall => edgeKey(wall) === door.wall_id)!;
    const stored = withoutFurnitureTree(settled.building!.plan, door.id);
    expect(wallCutoutsForSegment(doorWall, stored)).toEqual([]);
    expect(settled.ownedFurniture.glass_door_modern).toBe(1);
    const window = settled.building!.plan.furniture.find(item => item.furnitureId === "wide_window_cyber")!;
    const sold = applyAction(settled, { type: "furniture.sell", furnitureId: window.furnitureId, placementId: window.id },
      { userId: settled.userId, now, random: () => 0.5, eventId: "sell-starter-window" }).state;
    expect(sold.ownedFurniture.wide_window_cyber).toBe(1);
    expect(sold.gold).toBe(settled.gold + 64);
    expect(sold.building!.plan.furniture.some(item => item.id === window.id)).toBe(false);
    const windowWall = sold.building!.plan.walls.find(wall => edgeKey(wall) === window.wall_id)!;
    expect(wallCutoutsForSegment(windowWall, sold.building!.plan)).toEqual([]);
  });
});
