import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cameraBoomDistance, characterCameraPreset, followViewDirection, orbitCharacterCamera } from "../../src/components/construction/camera-geometry";
import { cameraRelativeMovement, createLiveMovementState, stepLiveMovement, type LiveMovementWorld } from "../../src/components/construction/live-movement";

const world: LiveMovementWorld = { level: 0, solids: [], curves: [], floors: new Set(Array.from({length: 20}, (_, x) => Array.from({length: 20}, (_, z) => `0:${x - 10}:${z - 10}`)).flat()) };

describe("V20 character inspection and persistent orbit", () => {
  it("places front/rear/side cameras relative to the current character heading", () => {
    for (const heading of [0, .6, Math.PI, -1.9]) {
      const facing = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      const cameraOffset = (preset: "front" | "rear" | "left" | "right") => {
        const rig = characterCameraPreset(preset, heading);
        return followViewDirection(rig.yaw, 0).negate();
      };
      expect(cameraOffset("front").dot(facing)).toBeCloseTo(1);
      expect(cameraOffset("rear").dot(facing)).toBeCloseTo(-1);
      expect(cameraOffset("left").dot(facing)).toBeCloseTo(0);
      expect(cameraOffset("left").dot(cameraOffset("right"))).toBeCloseTo(-1);
    }
  });

  it("orbits all 360 degrees without modifying an idle character's heading or position", () => {
    const actor = createLiveMovementState({ x: 0, z: 0 }, .72);
    let rig = characterCameraPreset("rear", actor.rotation);
    const startDirection = followViewDirection(rig.yaw, rig.pitch);
    for (let i = 0; i < 360; i++) {
      rig = orbitCharacterCamera(rig, (Math.PI * 2 / 360) / .004, 0);
      const next = stepLiveMovement(actor, {forward: 0, right: 0}, followViewDirection(rig.yaw, rig.pitch), 1 / 60, world);
      expect(next.rotation).toBe(actor.rotation);
      expect(next.position).toEqual(actor.position);
    }
    expect(followViewDirection(rig.yaw, rig.pitch).distanceTo(startDirection)).toBeLessThan(1e-12);
  });

  it("keeps arrow-key avatar movement camera-relative while preserving rig yaw", () => {
    for (const preset of ["front", "rear", "left", "right"] as const) {
      const rig = characterCameraPreset(preset, .5);
      const yaw = rig.yaw;
      const direction = followViewDirection(yaw, rig.pitch);
      const forward = cameraRelativeMovement({ forward: 1, right: 0 }, direction);
      expect(new THREE.Vector3(forward.x, 0, forward.z).dot(direction.clone().setY(0).normalize())).toBeCloseTo(1);
      let actor = createLiveMovementState({ x: 0, z: 0 }, .5);
      for (let i = 0; i < 60; i++) actor = stepLiveMovement(actor, {forward: 1, right: 0}, direction, 1 / 60, world);
      expect(actor.animation).toBe("walk");
      expect(actor.position.x * forward.x + actor.position.z * forward.z).toBeGreaterThan(2);
      expect(rig.yaw).toBe(yaw);
    }
  });

  it("retains requested zoom after a wall retracts the boom and recovers when clear", () => {
    const rig = characterCameraPreset("face", 0);
    const anchor = new THREE.Vector3(0, rig.targetHeight, 0);
    const direction = followViewDirection(rig.yaw, rig.pitch);
    const desired = anchor.clone().addScaledVector(direction, -rig.distance);
    const wall = new THREE.Box3(new THREE.Vector3(-2, 0, .4), new THREE.Vector3(2, 3, .5));
    expect(cameraBoomDistance(anchor, desired, [wall])).toBeLessThan(.4);
    expect(cameraBoomDistance(anchor, desired, [])).toBeCloseTo(.78);
    expect(rig.distance).toBe(.78);
    expect(rig.targetHeight).toBeGreaterThan(characterCameraPreset("front").targetHeight);
  });
});
