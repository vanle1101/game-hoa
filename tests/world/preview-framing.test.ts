import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { FURNITURE_MODEL_IDS, getFurniturePartBounds, getFurnitureRecipe } from "../../src/furniture/catalog";
import { fitPreviewBox } from "../../src/components/world/preview-framing";

describe("furniture preview framing", () => {
  it("covers the complete catalog rather than a truncated preview batch", () => {
    expect(FURNITURE_MODEL_IDS).toHaveLength(123);
  });
  it.each(FURNITURE_MODEL_IDS)("keeps every %s bound in the desktop and mobile frustum", id => {
    const box = new Box3();
    for (const part of getFurnitureRecipe(id)!.parts) {
      const bounds = getFurniturePartBounds(part);
      box.expandByPoint(new Vector3(...bounds.min));
      box.expandByPoint(new Vector3(...bounds.max));
    }
    for (const aspect of [.65, 1, 1.7, 2.5]) {
      const framing = fitPreviewBox(box, aspect);
      expect([...box.min.toArray(), ...box.max.toArray(), ...framing.position.toArray(), ...framing.center.toArray()].every(Number.isFinite)).toBe(true);
      const camera = new PerspectiveCamera(37, aspect, .01, 100);
      camera.position.copy(framing.position);
      camera.lookAt(framing.center);
      camera.updateMatrixWorld();
      let extent = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new Vector3(x, y, z).project(camera);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(.820001);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(.820001);
        expect(point.z).toBeGreaterThan(-1);
        expect(point.z).toBeLessThan(1);
        extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
      }
      expect(extent).toBeCloseTo(.82, 5);
    }
  });
});
