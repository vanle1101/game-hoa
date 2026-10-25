import { describe, expect, it } from "vitest";
import { BUILDING_CATALOG } from "@/construction/catalog";
import { wallParts } from "@/components/construction/render-geometry";
import { findBuildingPath } from "@/construction/navigation";
import type { BuildingFurniture, FloorCell, WallSegment } from "@/construction/types";
import {
  clipWallPart,
  computeApartmentLightingRig,
  computeFloorCellTint,
  computeRoomBounds,
  createFloorPatternPixels,
  createWallPatternPixels,
  evaluateWallCutaway,
  getFloorMaterialSpec,
  getWallMaterialSpec,
} from "@/components/construction/architectural-materials";

const floors: FloorCell[] = [
  { x: 0, z: 0, level: 0, materialId: "floor-wood" },
  { x: 1, z: 0, level: 0, materialId: "floor-wood" },
  { x: 0, z: 1, level: 0, materialId: "floor-wood" },
  { x: 1, z: 1, level: 0, materialId: "floor-wood" },
];
const floorKeys = new Set(floors.map(cell => `${cell.level}:${cell.x}:${cell.z}`));
const bounds = computeRoomBounds(floors, 0);
const camera = { x: 4, y: 5, z: 4 };
const avatar = { x: 0.5, z: 0.5 };

function wall(overrides: Partial<WallSegment> = {}): WallSegment {
  return { x: 0, z: 0, level: 0, orientation: "x", materialId: "wall-basic", ...overrides };
}

describe("architectural-materials", () => {
  it("keeps material-specific procedural surfaces distinct", () => {
    const floorsToCompare = ["floor-concrete", "floor-wood", "floor-ceramic", "floor-neon"];
    const floorSpecs = floorsToCompare.map(id => getFloorMaterialSpec(id));
    expect(new Set(floorSpecs.map(spec => spec.pattern)).size).toBeGreaterThan(2);
    expect(new Set(floorsToCompare.map(id => Array.from(createFloorPatternPixels(id, 16)).join(","))).size).toBe(floorsToCompare.length);
    expect(getFloorMaterialSpec("missing-floor").id).toBe("floor-concrete");

    const wallIds = ["wall-basic", "wall-wood", "wall-brick", "wall-neon"];
    expect(new Set(wallIds.map(id => getWallMaterialSpec(id).pattern)).size).toBe(wallIds.length);
    expect(new Set(wallIds.map(id => Array.from(createWallPatternPixels(id, 16)).join(","))).size).toBe(wallIds.length);
    for (const item of BUILDING_CATALOG) {
      if (["floor", "ceiling", "roof"].includes(item.category)) expect(getFloorMaterialSpec(item.id).id).toBe(item.id);
      if (item.category === "wall") expect(getWallMaterialSpec(item.id).id).toBe(item.id);
    }
  });

  it("classifies perimeter and interior walls using actual camera/avatar visibility", () => {
    const north = evaluateWallCutaway({ wall: wall({ z: 0 }), cutaway: true, floorKeys, roomBounds: bounds, cameraPosition: camera, avatarPosition: avatar });
    const south = evaluateWallCutaway({ wall: wall({ z: 2 }), cutaway: true, floorKeys, roomBounds: bounds, cameraPosition: camera, avatarPosition: avatar });
    const partition = evaluateWallCutaway({ wall: wall({ x: 1, z: 0, orientation: "z" }), cutaway: true, floorKeys, roomBounds: bounds, cameraPosition: camera, avatarPosition: avatar });

    expect(north.role).toBe("perimeter");
    expect(north.cutawayActive).toBe(false);
    expect(south.role).toBe("perimeter");
    expect(south.cutawayActive).toBe(true);
    expect(partition.role).toBe("interior");
    expect(partition.occludesAvatar).toBe(true);
    expect(partition.mode).toBe("interior-cutaway");
    expect(partition.solidHeightScale).toBeLessThan(0.25);
  });

  it("keeps selected walls full height and preserves an opening portal decision", () => {
    const selected = evaluateWallCutaway({
      wall: wall({ x: 1, z: 0, orientation: "z", opening: { kind: "door", catalogId: "door-standard" } }),
      cutaway: true,
      selected: true,
      floorKeys,
      roomBounds: bounds,
      cameraPosition: camera,
      avatarPosition: avatar,
    });
    expect(selected.cutawayActive).toBe(false);
    expect(selected.solidHeightScale).toBe(1);
    expect(selected.retainOpeningPortal).toBe(true);
    expect(selected.capHeight).toBe(2.8);
  });

  it("changes perimeter side with orbit and excludes walls behind the avatar or above the sightline", () => {
    const input = { wall: wall({ z: 0 }), cutaway: true, floorKeys, roomBounds: bounds, cameraPosition: { x: -4, y: 5, z: -4 } };
    expect(evaluateWallCutaway(input).mode).toBe("front-cutaway");
    expect(evaluateWallCutaway({ ...input, cutaway: false }).mode).toBe("full");
    const partition = { ...input, wall: wall({ x: 1, orientation: "z" }), avatarPosition: avatar };
    expect(evaluateWallCutaway(partition).occludesAvatar).toBe(false);
    expect(evaluateWallCutaway({ ...partition, cameraPosition: { x: 4, y: 40, z: 4 } }).mode).toBe("full");
  });

  it.each(["door-standard", "door-sliding", "door-glass", "door-auto", "door-security", "door-neon"])("clips %s lintels without moving them into the doorway", catalogId => {
    const parts = wallParts(wall({ opening: { kind: "door", catalogId } }));
    for (const limit of [0.38, 0.53, 1.4, 2.4, 2.8]) {
      parts.forEach(part => {
        const clipped = clipWallPart(part, limit);
        if (!clipped.visible) return;
        expect(clipped.y - clipped.height / 2).toBeCloseTo(part.y - part.height / 2);
        expect(clipped.y + clipped.height / 2).toBeLessThanOrEqual(limit + 1e-9);
        if (part.x === 0) expect(clipped.y - clipped.height / 2).toBeGreaterThanOrEqual(2.2);
      });
    }
  });

  it("leaves original navigation walls and door passability unchanged", () => {
    const partition = wall({ x: 1, orientation: "z" });
    const plan = { floors: floors.slice(0, 2), walls: [partition], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };
    const before = JSON.stringify(plan);
    evaluateWallCutaway({ wall: partition, cutaway: true, floorKeys, roomBounds: bounds, cameraPosition: camera, avatarPosition: avatar });
    expect(JSON.stringify(plan)).toBe(before);
    expect(findBuildingPath(plan, floors[0], floors[1])).toHaveLength(0);
    expect(findBuildingPath({ ...plan, walls: [{ ...partition, opening: { kind: "door", catalogId: "door-standard" } }] }, floors[0], floors[1]).length).toBeGreaterThan(0);
  });

  it.each(["performance", "balanced", "high", "ultra"])("keeps local warm pools and restrained broad fill in %s", quality => {
    const rig = computeApartmentLightingRig(bounds, 0, [], quality);
    expect(rig.ambientIntensity + rig.hemisphereIntensity).toBeLessThanOrEqual(1.1);
    expect(rig.keyLight.intensity).toBeGreaterThan(0.5);
    expect(rig.keyLight.intensity).toBeLessThan(1.2);
    expect(rig.cityRimLight.intensity).toBeLessThan(rig.keyLight.intensity);
    expect(rig.skylineVioletRim.intensity).toBeLessThan(rig.keyLight.intensity);
    expect(rig.pointLights).toHaveLength(4);
    for (const light of rig.pointLights) {
      expect(light.intensity).toBeGreaterThan(0);
      expect(light.intensity).toBeLessThanOrEqual(40);
      expect(light.distance).toBeLessThanOrEqual(11);
      expect(light.decay).toBe(2);
    }
    // A near-ceiling point light previously produced a large clipped highlight.
    expect(rig.pointLights[0].position[1]).toBeLessThanOrEqual(2.1);
    expect(rig.pointLights[3].intensity).toBeLessThan(rig.pointLights[0].intensity);
  });

  it("produces warm, bounded lighting and floor tint values", () => {
    const furniture: BuildingFurniture[] = [];
    const rig = computeApartmentLightingRig(bounds, 0, furniture, "ultra");
    expect(rig.pointLights.length).toBeGreaterThanOrEqual(3);
    expect(rig.ambientIntensity).toBeGreaterThanOrEqual(0.15);
    expect(rig.ambientIntensity).toBeLessThan(0.5);
    expect(rig.pointLights.some(light => light.kind === "warm-key")).toBe(true);
    const tint = computeFloorCellTint(floors[0], bounds);
    expect(tint.r).toBeGreaterThan(tint.b);
    expect(tint.r).toBeLessThanOrEqual(1);
  });
});
