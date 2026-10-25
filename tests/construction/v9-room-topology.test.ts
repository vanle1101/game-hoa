import { describe, expect, it } from "vitest";
import { cellKey, edgeKey, emptyPlan, rectangleRoom } from "@/construction/grid";
import { findBuildingPath } from "@/construction/navigation";
import { detectRooms } from "@/construction/topology";
import type { BuildingPlan, GridPoint, WallSegment } from "@/construction/types";

const point = (x: number, z: number, level = 0): GridPoint => ({ x, z, level });

function partition(plan: BuildingPlan, x: number, minZ: number, depth: number, level = 0): WallSegment[] {
  const walls: WallSegment[] = Array.from({ length: depth }, (_, offset) => ({
    x, z: minZ + offset, level, orientation: "z", materialId: "wall-basic",
  }));
  plan.walls.push(...walls);
  return walls;
}

function erase(plan: BuildingPlan, walls: WallSegment[]) {
  const keys = new Set(walls.map(edgeKey));
  plan.walls = plan.walls.filter(wall => !keys.has(edgeKey(wall)));
}

function roomAt(plan: BuildingPlan, cell: GridPoint) {
  return detectRooms(plan).find(room => room.cells.some(candidate => cellKey(candidate) === cellKey(cell)))!;
}

describe("V9 freely partitioned apartment topology", () => {
  it.each([
    { width: 12, depth: 10, x: -6, z: -5, area: 120 },
    { width: 4, depth: 4, x: -2, z: -2, area: 16 },
    { width: 12, depth: 10, x: 20, z: 30, area: 120 },
  ])("partitions, opens doors, and rejoins a $width x $depth floor at ($x, $z)", ({ width, depth, x, z, area }) => {
    const plan = rectangleRoom(emptyPlan(), point(x, z), point(x + width - 1, z + depth - 1));
    const original = detectRooms(plan)[0];
    plan.roomNames[original.id] = "Living space";
    const divider = partition(plan, x + width / 2, z, depth);
    const start = point(x, z + 1), goal = point(x + width - 1, z + 1);
    const divided = detectRooms(plan);
    expect(divided).toHaveLength(2);
    expect(divided.map(room => room.area)).toEqual([area / 2, area / 2]);
    expect(divided.every(room => room.enclosed)).toBe(true);
    expect(new Set(divided.flatMap(room => room.cells.map(cellKey))).size).toBe(area);
    expect(divided.find(room => room.id === original.id)?.name).toBe("Living space");
    expect(findBuildingPath(plan, start, goal)).toEqual([]);

    divider[1].opening = { kind: "door", catalogId: "door-standard" };
    expect(detectRooms(plan)).toEqual(divided);
    const path = findBuildingPath(plan, start, goal);
    expect(path[0]).toEqual(start);
    expect(path.at(-1)).toEqual(goal);
    expect(path.some((cell, index) => index > 0 && cell.x !== path[index - 1].x && Math.max(cell.x, path[index - 1].x) === divider[1].x && cell.z === divider[1].z)).toBe(true);

    divider[1].opening = { kind: "window", catalogId: "window-small" };
    expect(findBuildingPath(plan, start, goal)).toEqual([]);
    delete divider[1].opening;
    expect(detectRooms(plan)).toEqual(divided);
    expect(findBuildingPath(plan, start, goal)).toEqual([]);
    erase(plan, [divider[1]]);
    expect(detectRooms(plan)).toMatchObject([{ id: original.id, name: "Living space", area, enclosed: true }]);
    expect(findBuildingPath(plan, start, goal).length).toBeGreaterThan(0);
    erase(plan, divider);
    expect(detectRooms(plan)).toMatchObject([{ id: original.id, name: "Living space", area, enclosed: true }]);
    expect(plan.floors).toHaveLength(area);
  });

  it("retains a named region's identity when it rejoins an earlier unnamed region", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 3));
    const divider = partition(plan, 2, 0, 4);
    const named = roomAt(plan, point(3, 1));
    plan.roomNames[named.id] = "Study";
    const names = structuredClone(plan.roomNames);
    erase(plan, divider);
    expect(detectRooms(plan)).toMatchObject([{ id: named.id, name: "Study", area: 16 }]);
    expect(plan.roomNames).toEqual(names);
    plan.walls.push(...divider);
    expect(roomAt(plan, point(3, 1))).toMatchObject({ id: named.id, name: "Study", area: 8 });
    expect(roomAt(plan, point(0, 1)).name).toBe("New Room");
  });

  it("preserves both named anchors through reordering, merging, and repartitioning", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 3));
    const divider = partition(plan, 2, 0, 4);
    const left = roomAt(plan, point(0, 1)), right = roomAt(plan, point(3, 1));
    plan.roomNames[left.id] = "Lounge";
    plan.roomNames[right.id] = "Bedroom";
    const snapshot = structuredClone(plan);
    const before = detectRooms(plan);
    expect(plan).toEqual(snapshot);
    plan.floors.reverse();
    plan.walls.reverse();
    expect(detectRooms(plan)).toEqual(before);
    erase(plan, divider);
    expect(detectRooms(plan)).toMatchObject([{ id: left.id, name: "Lounge", area: 16 }]);
    expect(plan.roomNames[right.id]).toBe("Bedroom");
    plan.walls.push(...divider);
    expect(detectRooms(plan)).toEqual(before);
  });

  it("preserves a named anchor when floor expansion changes the canonical cell", () => {
    const plan = rectangleRoom(emptyPlan(), point(2, 0), point(3, 3));
    const old = detectRooms(plan)[0];
    plan.roomNames[old.id] = "Workshop";
    const expanded = rectangleRoom(plan, point(0, 0), point(3, 3));
    erase(expanded, expanded.walls.filter(wall => wall.x === 2 && wall.orientation === "z"));
    expect(detectRooms(expanded)).toMatchObject([{ id: old.id, name: "Workshop", area: 16 }]);
  });

  it("does not reuse room names from another level or a missing anchor", () => {
    const plan = rectangleRoom(emptyPlan(), point(0, 0, 1), point(3, 3, 1));
    plan.roomNames["room:0:0:0"] = "Ground floor";
    plan.roomNames["room:1:8:8"] = "Removed room";
    expect(detectRooms(plan)).toMatchObject([{ id: "room:1:0:0", name: "New Room", level: 1, area: 16 }]);
  });

  it("keeps levels visually separate while stairs and doors connect their paths", () => {
    let plan = rectangleRoom(emptyPlan(), point(0, 0), point(3, 3));
    plan = rectangleRoom(plan, point(0, 0, 1), point(3, 3, 1));
    const divider = partition(plan, 2, 0, 4, 1);
    const start = point(0, 1), goal = point(3, 1, 1);
    expect(findBuildingPath(plan, start, goal)).toEqual([]);
    plan.stairs.push({ ...point(0, 1), orientation: "x", catalogId: "stairs-basic" });
    expect(findBuildingPath(plan, start, goal)).toEqual([]);
    divider[1].opening = { kind: "door", catalogId: "door-standard" };
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(3);
    expect(new Set(rooms.map(room => room.id)).size).toBe(3);
    expect(rooms.every(room => room.cells.every(cell => cell.level === room.level))).toBe(true);
    const path = findBuildingPath(plan, start, goal);
    expect(path[0]).toEqual(start);
    expect(path.at(-1)).toEqual(goal);
    expect(path.some(cell => cell.level === 0)).toBe(true);
    expect(path.some(cell => cell.level === 1)).toBe(true);
    expect(findBuildingPath(plan, goal, start)).toEqual([...path].reverse());
    erase(plan, divider);
    expect(detectRooms(plan).map(room => room.area)).toEqual([16, 16]);
  });
});
