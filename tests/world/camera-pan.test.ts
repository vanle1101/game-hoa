import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cameraRelativePan, lockOrbitTargetY, translateOrbitRig } from "../../src/components/construction/camera-geometry";

describe("orbit camera keyboard pan", () => {
  it("uses camera forward/right after orbiting and stays horizontal", () => {
    const camera = new THREE.PerspectiveCamera();
    for (const position of [[0, 4, 8], [8, 4, 0], [0, 4, -8], [-8, 4, 0]] as const) {
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(0, 1, 0);
      camera.updateMatrixWorld();
      const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      const pan = cameraRelativePan(camera, 1, 0);
      expect(pan.distanceTo(forward)).toBeLessThan(1e-8);
      expect(pan.y).toBe(0);
      const right = cameraRelativePan(camera, 0, 1);
      expect(right.dot(forward)).toBeCloseTo(0);
      expect(right.length()).toBeCloseTo(1);
      expect(cameraRelativePan(camera, 1, 1).length()).toBeCloseTo(1);
    }
  });
  it("moves target and camera in parallel without changing orbit distance", () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Vector3(1, 0.7, -2);
    camera.position.set(5, 6, 8);
    const before = camera.position.clone().sub(target);
    const priorTarget = target.clone();
    const delta = new THREE.Vector3(-2, 0, 3);
    translateOrbitRig(camera, target, delta);
    expect(target).toEqual(priorTarget.add(delta));
    expect(camera.position.clone().sub(target)).toEqual(before);
  });
  it("locks pivot height while preserving the camera orbit offset", () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Vector3(0, 2, 0);
    camera.position.set(4, 7, 5);
    const offset = camera.position.clone().sub(target);
    lockOrbitTargetY(camera, target, 1.5);
    expect(target.y).toBe(1.5);
    expect(camera.position.clone().sub(target)).toEqual(offset);
  });
});
