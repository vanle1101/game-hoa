import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { combatFraming, COMBAT_SUBJECT_BOUNDS } from "../../src/components/combat/framing";

describe("combat responsive framing", () => {
  it.each([.55, .75, 1, 1.2, 1.8, 2.4])("keeps the subject envelope visible at aspect %s", aspect => {
    const frame = combatFraming(aspect);
    const camera = new PerspectiveCamera(43, aspect, .1, 1000);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld(true);
    for (const x of [COMBAT_SUBJECT_BOUNDS.min.x, COMBAT_SUBJECT_BOUNDS.max.x]) {
      for (const y of [COMBAT_SUBJECT_BOUNDS.min.y, COMBAT_SUBJECT_BOUNDS.max.y]) {
        for (const z of [COMBAT_SUBJECT_BOUNDS.min.z, COMBAT_SUBJECT_BOUNDS.max.z]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThanOrEqual(.820001);
          expect(Math.abs(point.y)).toBeLessThanOrEqual(.820001);
          expect(point.z).toBeGreaterThan(-1);
          expect(point.z).toBeLessThan(1);
        }
      }
    }
    expect(frame.distance).toBeGreaterThan(7);
  });
  it("moves back for portrait instead of clipping horizontally", () => {
    expect(combatFraming(.6).distance).toBeGreaterThan(combatFraming(1.8).distance);
  });
});
