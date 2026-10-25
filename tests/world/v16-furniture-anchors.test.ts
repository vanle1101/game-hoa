import { describe, expect, it } from "vitest";
import { buildingFurnitureInteractionAnchors, furnitureInteractionAnchors } from "@/furniture/interaction-anchors";
import { getFurnitureRecipe } from "@/furniture/catalog";
import type { BuildingFurniture } from "@/construction/types";

const placed = (furnitureId: string, rotation: BuildingFurniture["rotation"] = 0): BuildingFurniture => ({ id: "test", furnitureId, rotation, x: 2, z: 3, level: 0 });

describe("V16 furniture pose anchors", () => {
  it.each(["haven-sofa", "corner-sofa", "chaise-lounge", "office-chair", "dining-chair", "bar-stool"])("places the pelvis on %s's real seat surface", id => {
    const result = buildingFurnitureInteractionAnchors(placed(id), { x: 1.5, z: 3.5 })!;
    const part = getFurnitureRecipe(id)!.parts.find(part => part.id === result.supportPartId)!;
    expect(part).toBeDefined();
    expect(result.pose.activity).toBe("sitting");
    expect(result.surfaceY).toBeCloseTo(part.position[1] + part.size[1] / 2);
    expect(result.pose.y + .87).toBeCloseTo(result.surfaceY!);
    expect(result.exit).toEqual({ x: 1.5, z: 3.5 });
    expect(result.pose).not.toMatchObject(result.exit);
    expect(result.supportPartId).not.toMatch(/back|arm|welt/);
  });

  it("uses the lower mattress and positions feet toward its foot end", () => {
    const result = buildingFurnitureInteractionAnchors(placed("bunk-bed"), { x: 1.5, z: 3.5 })!;
    expect(result.supportPartId).toBe("mattress-0.2");
    expect(result.surfaceY).toBeCloseTo(.26 * 2.7);
    expect(result.pose.y).toBeCloseTo(.26 * 2.7 + .14);
    expect(result.pose.x).toBe(3);
    expect(result.pose.z).toBeCloseTo(4.5 + .87);
    expect(result.pose.rotation).toBe(0);
  });

  it("rotates the sleep anchor with a 90 degree bed and uses the rotated grid center", () => {
    const result = buildingFurnitureInteractionAnchors(placed("cloud-bed", 90), { x: 6.5, z: 4.5 })!;
    expect(result.pose.x).toBeCloseTo(4 + .87);
    expect(result.pose.z).toBeCloseTo(4.5 + 2.7 * .9 * .22);
    expect(result.pose.rotation).toBeCloseTo(Math.PI / 2);
    expect(result.exit).toEqual({ x: 6.5, z: 4.5 });
  });

  it.each([0, 90, 180, 270] as const)("rotates an off-center cushion correctly by %i degrees", rotation => {
    const angle = rotation * Math.PI / 180;
    const result = furnitureInteractionAnchors("haven-sofa", { x: 10, z: -4 }, angle, { x: 12, z: -1 })!;
    expect(result.pose.x).toBeCloseTo(10 + .07 * 1.16 * Math.sin(angle));
    expect(result.pose.z).toBeCloseTo(-4 + .07 * 1.16 * Math.cos(angle));
    expect(result.pose.rotation).toBeCloseTo(angle);
  });

  it("accounts for avatar height and an explicit world floor elevation", () => {
    const result = buildingFurnitureInteractionAnchors(placed("office-chair"), { x: 1.5, z: 3.5 }, { heightScale: 1.2, baseY: 3.4 })!;
    expect(result.pose.y).toBeCloseTo(3.4 + .52 * 1.4 - .87 * 1.2);
  });

  it.each(["workstation", "standing-desk", "kitchen-island", "tool-bench"])("keeps %s work on the reachable floor without an invented seat", id => {
    const result = buildingFurnitureInteractionAnchors(placed(id), { x: 1.5, z: 3.5 })!;
    expect(result.pose).toMatchObject({ x: 1.5, z: 3.5, y: 0, activity: "working-standing" });
    expect(result.exit).toEqual(result.approach);
    expect(result.surfaceY).toBeUndefined();
  });

  it("rejects an exit trapped inside the occupied footprint", () => {
    expect(buildingFurnitureInteractionAnchors(placed("cloud-bed"), { x: 3, z: 4 })).toBeUndefined();
  });

  it("does not create poses for unknown or non-activity furniture", () => {
    expect(buildingFurnitureInteractionAnchors(placed("missing"), { x: 1.5, z: 3.5 })).toBeUndefined();
    expect(buildingFurnitureInteractionAnchors(placed("neon-floor-lamp"), { x: 1.5, z: 3.5 })).toBeUndefined();
  });
});

