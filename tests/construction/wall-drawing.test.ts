import { describe, expect, it } from "vitest";
import { emptyPlan, edgeKey } from "../../src/construction/grid";
import { demolishWallEdges, pushDraft, redoDraft, toolDraft, undoDraft } from "../../src/components/construction/draft";
import { snapWallVertex, wallEdgesBetweenSegments, wallEdgesBetweenVertices } from "../../src/construction/wall-edges";
import { withLotObject } from "../../src/construction/lot-objects";
import type { BuildingPlan, GridPoint } from "../../src/construction/types";

const point = (x: number, z: number): GridPoint => ({ x, z, level: 0 });
const plan = (): BuildingPlan => ({ ...emptyPlan(), floors: Array.from({ length: 16 }, (_, index) =>
  ({ x: index % 4, z: Math.floor(index / 4), level: 0, materialId: "floor-concrete" })) });

describe("consecutive wall strokes", () => {
  it("merges adjacent strokes by canonical edge key without losing earlier walls", () => {
    const first = toolDraft(plan(), "wall", point(0, 1), point(1, 1), "wall-basic", { ...point(0, 1), orientation: "x" });
    const second = toolDraft(first, "wall", point(1, 1), point(2, 1), "wall-basic", { ...point(1, 1), orientation: "x" });
    expect(first.walls.map(edgeKey)).toEqual(["0:x:0:1"]);
    expect(second.walls.map(edgeKey)).toEqual(["0:x:0:1", "0:x:1:1"]);
    expect(new Set(second.walls.map(edgeKey)).size).toBe(second.walls.length);
    expect(toolDraft(second, "wall", point(1, 1), point(2, 1), "wall-basic", { ...point(1, 1), orientation: "x" }).walls).toEqual(second.walls);
  });

  it("allows a perpendicular continuation from an existing endpoint", () => {
    const first = toolDraft(plan(), "wall", point(0, 1), point(1, 1), "wall-basic", { ...point(0, 1), orientation: "x" });
    const joined = toolDraft(first, "wall", point(1, 1), point(1, 2), "wall-basic", { ...point(1, 1), orientation: "x" });
    expect(joined.walls.filter(wall => wall.orientation === "z").map(edgeKey)).toEqual(["0:z:1:1"]);
    expect(joined.walls.filter(wall => wall.orientation === "x")).toEqual(first.walls);
    const vertical = toolDraft(plan(), "wall", point(1, 1), point(1, 2), "wall-basic", { ...point(1, 1), orientation: "z" });
    const reversed = toolDraft(vertical, "wall", point(0, 1), point(2, 1), "wall-basic", { ...point(1, 1), orientation: "z" });
    expect(reversed.walls.filter(wall => wall.orientation === "x").map(edgeKey)).toEqual(["0:x:0:1", "0:x:1:1"]);
  });

  it("leaves the wall, door, and undo history untouched after a zero-metre click", () => {
    const source = toolDraft(plan(), "wall", point(0, 1), point(3, 1), "wall-basic");
    const door = withLotObject({ id: "door-1", furnitureId: "glass_door_modern", x: 1, z: 1, level: 0,
      rotation: 0, placementType: "wall_insert", wall_id: edgeKey(source.walls[1]), wall_u: 0.5,
      wallY: 0, wallNormal: [0, 0, 1] });
    source.furniture.push(door);
    const vertex = point(1, 1);
    const edge = { ...vertex, orientation: "x" as const };
    expect(wallEdgesBetweenVertices(vertex, vertex)).toEqual([]);
    const next = toolDraft(source, "wall", vertex, vertex, "wall-basic", edge);
    expect(next).toBe(source);
    expect(next).toEqual(source);
    expect(next.furniture).toEqual([door]);
    expect(pushDraft({ past: [], present: source, future: [] }, next).past).toEqual([]);
  });

  it("keeps each stroke as one undo step and restores it with redo", () => {
    const source = plan();
    const start = { past: [], present: source, future: [] };
    const first = pushDraft(start, toolDraft(start.present, "wall", point(0, 1), point(1, 1), "wall-basic"));
    const second = pushDraft(first, toolDraft(first.present, "wall", point(1, 1), point(2, 1), "wall-basic"));
    expect(second.present.walls).toHaveLength(2);
    expect(undoDraft(second).present.walls).toHaveLength(1);
    expect(redoDraft(undoDraft(second)).present.walls).toEqual(second.present.walls);
  });

  it("snaps the cursor to intersections and stores exactly one edge per metre", () => {
    expect(snapWallVertex({ x: 0.49, z: 2.51 }, 0)).toEqual(point(0, 3));
    expect(snapWallVertex({ x: 0.51, z: 2.49 }, 0)).toEqual(point(1, 2));
    const edges = wallEdgesBetweenVertices(point(0, 1), point(5, 2));
    expect(edges.map(edge => edgeKey({ ...edge, materialId: "wall-basic" }))).toEqual(
      Array.from({ length: 5 }, (_, x) => `0:x:${x}:1`),
    );
    expect(toolDraft(plan(), "wall", point(0, 1), point(5, 2), "wall-basic").walls).toHaveLength(5);
  });

  it("demolishes only selected unit edges and stashes an unsupported door", () => {
    const source = toolDraft(plan(), "wall", point(0, 1), point(3, 1), "wall-basic");
    const anchor = source.walls[1];
    source.furniture.push(withLotObject({ id: "door-1", furnitureId: "glass_door_modern", x: 1, z: 1, level: 0,
      rotation: 0, placementType: "wall_insert", wall_id: edgeKey(anchor), wall_u: 0.5, wallY: 0, wallNormal: [0, 0, 1] }));
    const next = demolishWallEdges(source, [{ x: 1, z: 1, level: 0, orientation: "x" }]);
    expect(next.walls.map(edgeKey)).toEqual(["0:x:0:1", "0:x:2:1"]);
    expect(next.furniture).toEqual([]);
    expect(source.walls).toHaveLength(3);
    expect(source.furniture).toHaveLength(1);
  });

  it("keeps a reversible marquee as a single undo transaction", () => {
    const source = toolDraft(plan(), "wall", point(0, 1), point(5, 1), "wall-basic");
    const start = { x: 1, z: 1, level: 0, orientation: "x" as const };
    const forward = wallEdgesBetweenSegments(start, { ...start, x: 4 });
    expect(forward.map(edge => edge.x)).toEqual([1, 2, 3, 4]);
    expect(source.walls).toHaveLength(5); // Pointer moves only compute a selection.
    expect(wallEdgesBetweenSegments(start, { ...start, x: 2 }).map(edge => edge.x)).toEqual([1, 2]);
    expect(wallEdgesBetweenSegments({ ...start, x: 4 }, start).map(edge => edge.x)).toEqual([1, 2, 3, 4]);
    const history = pushDraft({ past: [], present: source, future: [] }, demolishWallEdges(source, forward));
    expect(history.present.walls.map(edgeKey)).toEqual(["0:x:0:1"]);
    expect(history.past).toHaveLength(1);
    expect(undoDraft(history).present.walls).toEqual(source.walls);
    expect(redoDraft(undoDraft(history)).present.walls).toEqual(history.present.walls);
  });
});
