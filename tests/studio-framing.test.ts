import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fitStudioCharacter } from "../src/components/character/studio-framing";

describe("character studio autoframing", () => {
  it.each([.7, 1, 1.8])("fits a full-height character at desktop panel aspect %s", aspect => {
    const bounds = new Box3(new Vector3(-.4, 0, -.25), new Vector3(.4, 2.1, .25));
    const frame = fitStudioCharacter(bounds, aspect, "body");
    const camera = new PerspectiveCamera(frame.fov, aspect, .01, 100);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(.88);
      expect(Math.abs(projected.y)).toBeLessThan(.88);
    }
    expect(frame.target.y).toBeCloseTo(1.05);
  });
  it("focuses the head higher and closer, and handles front/side/back views", () => {
    const bounds = new Box3(new Vector3(-.4, 0, -.25), new Vector3(.4, 1.85, .25));
    const body = fitStudioCharacter(bounds, 1, "body");
    const head = fitStudioCharacter(bounds, 1, "head");
    expect(head.distance).toBeLessThan(body.distance);
    expect(head.target.y).toBeGreaterThan(1.5);
    expect(fitStudioCharacter(bounds, 1, "body", Math.PI).position.z).toBeLessThan(0);
    expect(fitStudioCharacter(bounds, 1, "body", Math.PI / 2).position.x).toBeGreaterThan(0);
  });
});
