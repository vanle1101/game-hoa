import { describe, expect, it } from "vitest";
import { cellKey, edgeKey, emptyPlan, rectangleRoom } from "@/construction/grid";
import { detectRooms } from "@/construction/topology";
import { findBuildingPath, occupiedCells, safeSpawn } from "@/construction/navigation";
import type { BuildingPlan } from "@/construction/types";

const point = (x: number, z: number, level = 0) => ({ x, z, level });
function dividedRoom(): BuildingPlan {
  const plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 2));
  for (let z = 0; z < 3; z++) plan.walls.push({ x: 2, z, level: 0, orientation: "z", materialId: "wall-basic" });
  return plan;
}
describe("construction topology and navigation integration", () => {
  it("rectangle operation creates each cell and boundary once when replayed", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 2));
    expect(plan.floors).toHaveLength(12); expect(plan.walls).toHaveLength(14);
    const repeated = rectangleRoom(plan, point(3, 2), point(0, 0));
    expect(new Set(repeated.floors.map(cellKey)).size).toBe(12); expect(new Set(repeated.walls.map(edgeKey)).size).toBe(14);
    expect(repeated).toEqual(plan);
  });
  it("adding and removing a divider changes room topology and reachability", () => {
    const plan = dividedRoom();
    expect(detectRooms(plan)).toHaveLength(2); expect(detectRooms(plan).every(room => room.enclosed)).toBe(true);
    expect(findBuildingPath(plan, point(0, 1), point(3, 1))).toEqual([]);
    plan.walls = plan.walls.filter(wall => !(wall.x === 2 && wall.z === 1 && wall.orientation === "z"));
    expect(detectRooms(plan)).toHaveLength(1); expect(findBuildingPath(plan, point(0, 1), point(3, 1)).length).toBeGreaterThan(0);
  });
  it("a door preserves room boundary while opening navigation; a window does not", () => {
    const plan = dividedRoom(); const wall = plan.walls.find(wall => wall.x === 2 && wall.z === 1 && wall.orientation === "z")!;
    wall.opening = { kind: "door", catalogId: "door-standard" };
    expect(detectRooms(plan)).toHaveLength(2); expect(findBuildingPath(plan, point(0, 1), point(3, 1)).length).toBeGreaterThan(0);
    wall.opening = { kind: "window", catalogId: "window-small" };
    expect(findBuildingPath(plan, point(0, 1), point(3, 1))).toEqual([]);
  });
  it("furniture occupies rotated cells and path avoids them", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0), point(6, 5));
    plan.furniture.push({ id: "sofa-instance", furnitureId: "haven-sofa", x: 2, z: 2, level: 0, rotation: 0 });
    const blocked = occupiedCells(plan); const route = findBuildingPath(plan, point(0, 3), point(6, 3));
    expect(blocked.size).toBe(6); expect(route.length).toBeGreaterThan(0); expect(route.every(cell => !blocked.has(cellKey(cell)))).toBe(true);
    expect(findBuildingPath(plan, point(0, 3), point(3, 3))).toEqual([]);
    plan.furniture[0].rotation = 90; expect(occupiedCells(plan).has(cellKey(point(3, 4)))).toBe(true);
  });
  it("safe spawn relocates only to an existing unoccupied floor", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 3));
    plan.furniture.push({ id: "sofa-instance", furnitureId: "haven-sofa", x: 0, z: 0, level: 0, rotation: 0 });
    const spawn = safeSpawn(plan, point(0, 0)); expect(spawn).toBeDefined(); expect(occupiedCells(plan).has(cellKey(spawn!))).toBe(false);
    expect(safeSpawn(emptyPlan())).toBeUndefined();
  });
  it("disconnected regions return no route rather than fabricating a teleport", () => {
    const plan = emptyPlan(); plan.floors = [{ ...point(0, 0), materialId: "floor-concrete" }, { ...point(5, 5), materialId: "floor-concrete" }];
    expect(findBuildingPath(plan, point(0, 0), point(5, 5))).toEqual([]);
  });
});
