import { describe, expect, it } from "vitest";
import { BoxGeometry, Color, DoubleSide, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { subtractWallInsertCutouts, visibleInsertWallHeight, wallInsertClipPlane } from "../../src/components/construction/wall-insert-csg";
import { edgeKey, emptyPlan } from "../../src/construction/grid";
import { withLotObject } from "../../src/construction/lot-objects";
import { indexedNeighbors, navigationIndex } from "../../src/construction/navigation";
import { snapWallInsertPoint, solidWallSpans, WALL_GRID_SIZE, wallCutoutsForSegment, wallInsertOrientationValid, wallInsertPlacementValid, wallInsertYaw } from "../../src/construction/wall-inserts";
import type { BuildingFurniture, BuildingPlan, WallSegment } from "../../src/construction/types";

const walls: WallSegment[] = [0, 1, 2].map(x => ({ x, z: 1, level: 0, orientation: "x", materialId: "wall-basic" }));
function cutMesh(cutouts: ReturnType<typeof wallCutoutsForSegment>, material: Material = new MeshBasicMaterial({ side: DoubleSide })) {
  const originalGeometry = new BoxGeometry(1, 2.8, 0.12);
  originalGeometry.translate(0, 1.4, 0);
  const original = new Mesh(originalGeometry, material);
  const cut = subtractWallInsertCutouts(original, cutouts);
  expect(cut.material).not.toBe(original.material);
  expect(cut.geometry).not.toBe(original.geometry);
  expect(original.geometry.getAttribute("position").count).toBe(24);
  originalGeometry.dispose();
  return cut;
}
function room(): BuildingPlan {
  return { ...emptyPlan(), floors: [0, 1, 2].flatMap(x => [0, 1].map(z => ({ x, z, level: 0, materialId: "floor-concrete" }))), walls: structuredClone(walls) };
}
function insert(furnitureId: string, bottom: number): BuildingFurniture {
  return withLotObject({ id: furnitureId, furnitureId, x: 1, z: 1, level: 0, rotation: 0,
    placementType: "wall_insert", wall_id: edgeKey(walls[1]), wall_u: 0.5, wallNormal: [0, 0, 1], wallY: bottom });
}

describe("wall insert entities", () => {
  it("auto-orients doors and windows flush with either wall axis and rejects quarter turns", () => {
    for (const orientation of ["x", "z"] as const) {
      for (const furnitureId of ["glass_door_modern", "wide_window_cyber"]) {
        const plan = room();
        plan.walls = [0, 1, 2].map(index => ({ x: orientation === "x" ? index : 1,
          z: orientation === "z" ? index : 1, level: 0, orientation, materialId: "wall-basic" }));
        const normal: [number, number, number] = orientation === "x" ? [0, 0, 1] : [1, 0, 0];
        const item = withLotObject({ id: `${orientation}-${furnitureId}`, furnitureId, x: 1, z: 1, level: 0,
          rotation: 0, placementType: "wall_insert", wall_id: edgeKey(plan.walls[1]), wall_u: 0.5,
          wallNormal: normal, wallY: furnitureId === "glass_door_modern" ? 0 : 1 });
        expect(wallInsertYaw(item)).toBeCloseTo(orientation === "x" ? 0 : Math.PI / 2);
        expect(item.transform?.rotation.y).toBeCloseTo(wallInsertYaw(item));
        expect(wallInsertOrientationValid(plan.walls[1], item)).toBe(true);
        expect(wallInsertPlacementValid(plan, item)).toBe(true);
        const quarterTurn = withLotObject({ ...item, rotation: 90 });
        expect(wallInsertYaw(quarterTurn)).toBeCloseTo(wallInsertYaw(item));
        expect(wallInsertPlacementValid(plan, quarterTurn)).toBe(false);
        const faceFlip = withLotObject({ ...item, rotation: 180 });
        expect(wallInsertPlacementValid(plan, faceFlip)).toBe(true);
        expect(Math.abs(Math.sin(wallInsertYaw(faceFlip) - wallInsertYaw(item)))).toBeLessThan(1e-8);
        expect(wallInsertPlacementValid(plan, { ...item, wallNormal: orientation === "x" ? [1, 0, 0] : [0, 0, 1] })).toBe(false);
        expect(wallInsertPlacementValid(plan, { ...item, transform: {
          ...item.transform!, rotation: { x: 0, y: wallInsertYaw(item) + Math.PI / 2, z: 0 },
        } })).toBe(false);
      }
    }
  });
  it("anchors a floor-level door to a continuous wall, then restores the wall when removed", () => {
    const plan = room();
    const door = insert("glass_door_modern", 0);
    expect(wallInsertPlacementValid(plan, door)).toBe(true);
    plan.furniture.push(door);
    expect(wallCutoutsForSegment(walls[1], plan)).toMatchObject([{ width: 1.86, bottom: 0, height: 2.4 }]);
    expect(solidWallSpans(walls[1], plan)).toEqual([]);
    expect(indexedNeighbors(navigationIndex(plan), { x: 1, z: 0, level: 0 })).toContainEqual({ x: 1, z: 1, level: 0 });
    plan.furniture = [];
    expect(wallCutoutsForSegment(walls[1], plan)).toEqual([]);
    expect(solidWallSpans(walls[1], plan)).toEqual([[0, 1]]);
    expect(indexedNeighbors(navigationIndex(plan), { x: 1, z: 0, level: 0 })).not.toContainEqual({ x: 1, z: 1, level: 0 });
  });

  it("rejects gaps, protected walls, legacy openings, and overlapping inserts", () => {
    const door = insert("glass_door_modern", 0);
    const plan = room();
    plan.walls.splice(0, 1);
    expect(wallInsertPlacementValid(plan, door)).toBe(false);
    plan.walls = structuredClone(walls);
    expect(wallInsertPlacementValid(plan, door, new Set([edgeKey(walls[0])]))).toBe(false);
    plan.walls[0].opening = { kind: "window", catalogId: "window-small" };
    expect(wallInsertPlacementValid(plan, door)).toBe(false);
    plan.walls[0].opening = undefined;
    plan.furniture.push(door);
    expect(wallInsertPlacementValid(plan, { ...insert("wide_window_cyber", 0.8), id: "window" })).toBe(false);
  });

  it("snaps door and window pivots in one-metre steps on both wall axes", () => {
    expect(WALL_GRID_SIZE).toBe(1);
    const xWall = walls[1];
    expect(snapWallInsertPoint(xWall, { x: 1.49, y: 2.2, z: 1 }, 2.4, 2.8, "doors")).toEqual({ u: 0, bottom: 0 });
    expect(snapWallInsertPoint(xWall, { x: 1.51, y: 0.2, z: 1 }, 2.4, 2.8, "doors")).toEqual({ u: 1, bottom: 0 });
    expect(snapWallInsertPoint(xWall, { x: 1.49, y: 1.1, z: 1 }, 1.35, 2.8, "windows")).toEqual({ u: 0, bottom: 0 });
    expect(snapWallInsertPoint(xWall, { x: 1.51, y: 1.2, z: 1 }, 1.35, 2.8, "windows")).toEqual({ u: 1, bottom: 1 });
    expect(snapWallInsertPoint(xWall, { x: 1.51, y: 2.7, z: 1 }, 1.35, 2.8, "windows")).toEqual({ u: 1, bottom: 1 });
    const zWall: WallSegment = { ...xWall, orientation: "z" };
    expect(snapWallInsertPoint(zWall, { x: 1, y: 1.2, z: 1.49 }, 1.35, 2.8, "windows")).toEqual({ u: 0, bottom: 1 });
    expect(snapWallInsertPoint(zWall, { x: 1, y: 1.2, z: 1.51 }, 1.35, 2.8, "windows")).toEqual({ u: 1, bottom: 1 });
  });

  it("uses the snapped model pivot as the exact CSG centre", () => {
    const plan = room();
    const snapped = snapWallInsertPoint(walls[1], { x: 1.51, y: 1.2, z: 1 }, 1.35, 2.8, "windows");
    const window = withLotObject({ id: "snapped-window", furnitureId: "wide_window_cyber", x: 1, z: 1,
      level: 0, rotation: 0, placementType: "wall_insert", wall_id: edgeKey(walls[1]),
      wall_u: snapped.u, wallY: snapped.bottom, wallNormal: [0, 0, 1] });
    expect(window.transform?.position).toEqual({ x: 2, y: 1, z: 1 });
    expect(wallInsertPlacementValid(plan, window)).toBe(true);
    plan.furniture.push(window);
    expect(wallCutoutsForSegment(walls[1], plan)).toMatchObject([{ center: 0.5, width: 1.86, bottom: 1 }]);
    expect(wallCutoutsForSegment(walls[2], plan)).toMatchObject([{ center: -0.5, width: 1.86, bottom: 1 }]);
    expect(wallCutoutsForSegment(walls[0], plan)).toEqual([]);
  });

  it("cuts a real, raycast-transparent aperture through the wall mesh", () => {
    const plan = room();
    plan.furniture.push(insert("wide_window_cyber", 0.8));
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const wall = cutMesh(wallCutoutsForSegment(walls[1], plan), material);
    wall.updateMatrixWorld(true);
    const cast = (x: number, y: number) => new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1)).intersectObject(wall).length;
    expect(cast(0, 1.4)).toBe(0);
    expect(cast(0, 0.3)).toBeGreaterThan(0);
    expect(cast(0, 2.5)).toBeGreaterThan(0);
    expect(cast(0, 0.799)).toBeGreaterThan(0);
    expect(cast(0, 0.801)).toBe(0);
    expect(cast(0, 2.149)).toBe(0);
    expect(cast(0, 2.151)).toBeGreaterThan(0);
    wall.geometry.dispose();
    material.dispose();
  });

  it("keeps masonry on both jambs and above a door even under camera cutaway", () => {
    const plan = room();
    plan.furniture = [withLotObject({ ...insert("glass_door_modern", 0), wall_u: 1 })];
    for (const segment of [walls[1], walls[2]]) {
      const cuts = wallCutoutsForSegment(segment, plan);
      const wall = cutMesh(cuts);
      wall.updateMatrixWorld(true);
      const cast = (x: number, y: number) => new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1)).intersectObject(wall).length;
      expect(wall.geometry.getAttribute("position").count).toBeGreaterThan(0);
      expect(cast(segment.x === 1 ? -0.49 : 0.49, 1.2)).toBeGreaterThan(0);
      expect(cast(segment.x === 1 ? -0.2 : 0.2, 1.2)).toBe(0);
      expect(cast(0, 2.6)).toBeGreaterThan(0);
      expect(cast(0, 2.79)).toBeGreaterThan(0);
      expect(visibleInsertWallHeight(0.42, 2.8, cuts)).toBeCloseTo(2.8);
      wall.geometry.dispose();
      wall.material.dispose();
    }
  });

  it("isolates the CSG material and preserves the exact door-height lintel", () => {
    const source = new MeshStandardMaterial({ color: "#ffffff", emissive: "#00ffff", emissiveIntensity: 4, side: DoubleSide });
    const wall = cutMesh([{ id: "door", center: 0, width: 0.8, bottom: 0, height: 2.4, depth: 0.25 }], source);
    const safe = wall.material as MeshStandardMaterial;
    expect(safe).not.toBe(source);
    expect(safe.color.equals(source.color)).toBe(true);
    expect(safe.emissive.equals(new Color(0x000000))).toBe(true);
    expect(safe.emissiveIntensity).toBe(0);
    expect(source.emissive.equals(new Color(0x00ffff))).toBe(true);
    expect(source.emissiveIntensity).toBe(4);
    const cast = (y: number) => new Raycaster(new Vector3(0, y, 2), new Vector3(0, 0, -1)).intersectObject(wall).length;
    expect(cast(2.399)).toBe(0);
    expect(cast(2.401)).toBeGreaterThan(0);
    expect(cast(2.799)).toBeGreaterThan(0);
    wall.geometry.dispose();
    safe.dispose();
    source.dispose();
  });

  it("keeps one wall material and continuous wall-local UVs on CSG reveal faces", () => {
    const wall = cutMesh([{ id: "door", center: 0, width: 0.8, bottom: 0, height: 2.4, depth: 0.25 }]);
    const position = wall.geometry.getAttribute("position");
    const uv = wall.geometry.getAttribute("uv");
    expect(wall.geometry.groups).toEqual([{ start: 0, count: wall.geometry.index?.count ?? position.count, materialIndex: 0 }]);
    expect(uv.count).toBe(position.count);
    for (let index = 0; index < position.count; index++) {
      expect(uv.getX(index)).toBeCloseTo(position.getX(index) + 0.5, 4);
      expect(uv.getY(index)).toBeCloseTo(position.getY(index) / 2.8, 4);
    }
    wall.geometry.dispose();
    wall.material.dispose();
  });

  it("clips only above the cutaway cap, keeping the wall below it", () => {
    const plane = wallInsertClipPlane(2.52);
    expect(plane.distanceToPoint(new Vector3(0, 1.2, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(new Vector3(0, 2.7, 0))).toBeLessThan(0);
    plane.constant = 3 + 0.42;
    expect(plane.distanceToPoint(new Vector3(0, 3.2, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(new Vector3(0, 3.6, 0))).toBeLessThan(0);
  });

  it("keeps the original wall if a malformed cut would consume its whole mesh", () => {
    const wall = cutMesh([{ id: "bad-hole", center: 0, width: 2, bottom: 0, height: 2.8, depth: 0.25 }]);
    wall.updateMatrixWorld(true);
    expect(new Raycaster(new Vector3(0, 1.4, 2), new Vector3(0, 0, -1)).intersectObject(wall).length).toBeGreaterThan(0);
    wall.geometry.dispose();
    wall.material.dispose();
  });

  it("keeps aperture edges aligned across segments on both wall axes", () => {
    for (const orientation of ["x", "z"] as const) {
      const plan = room();
      plan.walls = [0, 1, 2].map(index => ({ x: orientation === "x" ? index : 1, z: orientation === "z" ? index : 1,
        level: 0, orientation, materialId: "wall-basic" }));
      plan.furniture = [withLotObject({ id: orientation, furnitureId: "glass_door_modern", x: 1, z: 1, level: 0,
        rotation: 0, placementType: "wall_insert", wall_id: edgeKey(plan.walls[1]), wall_u: 0.65,
        wallNormal: orientation === "x" ? [0, 0, 1] : [1, 0, 0], wallY: 0 })];
      const material = new MeshBasicMaterial({ side: DoubleSide });
      const meshes = plan.walls.map(wall => {
        const mesh = cutMesh(wallCutoutsForSegment(wall, plan), material);
        mesh.position.set(wall.x + (orientation === "x" ? 0.5 : 0), 0, wall.z + (orientation === "z" ? 0.5 : 0));
        mesh.rotation.y = orientation === "z" ? Math.PI / 2 : 0;
        mesh.updateMatrixWorld(true);
        return mesh;
      });
      const cast = (axis: number) => new Raycaster(
        orientation === "x" ? new Vector3(axis, 1.2, 2) : new Vector3(2, 1.2, axis),
        orientation === "x" ? new Vector3(0, 0, -1) : new Vector3(-1, 0, 0),
      ).intersectObjects(meshes).length;
      const left = 1.65 - 0.93, right = 1.65 + 0.93;
      expect(cast(left - 0.01), `${orientation} before left jamb`).toBeGreaterThan(0);
      expect(cast(left + 0.01), `${orientation} inside left jamb`).toBe(0);
      expect(cast(right - 0.01), `${orientation} inside right jamb`).toBe(0);
      expect(cast(right + 0.01), `${orientation} after right jamb`).toBeGreaterThan(0);
      meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
      material.dispose();
    }
  });
});
