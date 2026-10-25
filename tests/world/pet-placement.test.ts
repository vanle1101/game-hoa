import { describe, expect, it } from "vitest";
import { findPetSpawn } from "../../src/components/world/pet-placement";
import { emptyPlan } from "../../src/construction/grid";
import type { BuildingPlan, GridPoint } from "../../src/construction/types";

const origin: GridPoint = { x: 0, z: 0, level: 0 };
function planWithCells(cells: [number, number, number?][]): BuildingPlan {
  return { ...emptyPlan(), floors: cells.map(([x, z, level = 0]) => ({ x, z, level, materialId: "floor-concrete" })) };
}

describe("pet spawn placement", () => {
  it("prefers the east adjacent cell regardless of floor order and leaves the plan untouched", () => {
    const plan = planWithCells([[-1, 0], [0, 1], [0, 0], [1, 0]]);
    const before = structuredClone(plan);
    expect(findPetSpawn(plan, origin)).toEqual({ x: 1, z: 0, level: 0 });
    expect(plan).toEqual(before);
  });

  it("uses the open side of a corridor instead of crossing a solid wall", () => {
    const plan = planWithCells([[0, 0], [1, 0], [-1, 0]]);
    plan.walls.push({ x: 1, z: 0, level: 0, orientation: "z", materialId: "wall-basic" });
    expect(findPetSpawn(plan, origin)).toEqual({ x: -1, z: 0, level: 0 });
    plan.walls[0].opening = { kind: "door", catalogId: "door-standard" };
    expect(findPetSpawn(plan, origin)).toEqual({ x: 1, z: 0, level: 0 });
    plan.walls[0].opening = { kind: "window", catalogId: "window-small" };
    expect(findPetSpawn(plan, origin)).toEqual({ x: -1, z: 0, level: 0 });
  });

  it("avoids occupied furniture cells even when east is preferred", () => {
    const plan = planWithCells([[0, 0], [1, 0], [0, 1]]);
    plan.furniture.push({ id: "plant", furnitureId: "biolume-plant", x: 1, z: 0, level: 0, rotation: 0 });
    expect(findPetSpawn(plan, origin)).toEqual({ x: 0, z: 1, level: 0 });
  });

  it("chooses a short open route instead of a neighboring cell reached by a detour", () => {
    const plan = planWithCells([[0, 0], [1, 0], [0, 1], [1, 1]]);
    plan.walls.push({ x: 1, z: 0, level: 0, orientation: "z", materialId: "wall-basic" });
    expect(findPetSpawn(plan, origin)).toEqual({ x: 0, z: 1, level: 0 });
  });

  it("returns undefined when only the avatar cell or disconnected floors are available", () => {
    expect(findPetSpawn(planWithCells([[0, 0]]), origin)).toBeUndefined();
    expect(findPetSpawn(planWithCells([[0, 0], [2, 0]]), origin)).toBeUndefined();
    const enclosed = planWithCells([[0, 0], [1, 0]]);
    enclosed.walls.push({ x: 1, z: 0, level: 0, orientation: "z", materialId: "wall-basic" });
    expect(findPetSpawn(enclosed, origin)).toBeUndefined();
  });

  it("does not place on another level or route via stairs to a disconnected same-floor cell", () => {
    const plan = planWithCells([[0, 0], [2, 0], [1, 0, 1], [2, 0, 1], [3, 0, 1]]);
    plan.stairs.push(
      { x: 0, z: 0, level: 0, orientation: "x", catalogId: "stairs-basic" },
      { x: 2, z: 0, level: 0, orientation: "x", catalogId: "stairs-basic" },
    );
    expect(findPetSpawn(plan, origin)).toBeUndefined();
  });

  it("rejects an avatar origin without a free floor", () => {
    expect(findPetSpawn(planWithCells([[1, 0], [2, 0]]), origin)).toBeUndefined();
    const plan = planWithCells([[0, 0], [1, 0]]);
    plan.furniture.push({ id: "plant", furnitureId: "biolume-plant", ...origin, rotation: 0 });
    expect(findPetSpawn(plan, origin)).toBeUndefined();
  });
});
