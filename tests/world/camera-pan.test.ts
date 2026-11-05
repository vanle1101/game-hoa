import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cameraPanAxes, cameraRelativePan, lockOrbitTargetY, translateOrbitRig } from "../../src/components/construction/camera-geometry";
import { CAMERA_PAN_CODES } from "../../src/components/construction/input-codes";
import { createLiveInputController, createLiveMovementState, stepLiveMovement, type LiveMovementWorld } from "../../src/components/construction/live-movement";

describe("orbit camera keyboard pan", () => {
  it("routes WASD only to the camera and arrow codes only to the avatar", () => {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Vector3(0, 1, 0);
    camera.position.set(0, 5, 8);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const avatar = createLiveMovementState({ x: 0.5, z: 0.5 });
    const world: LiveMovementWorld = {
      level: 0, solids: [], curves: [],
      floors: new Set(Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, z) => `0:${x - 4}:${z - 4}`)).flat()),
    };
    const liveInput = createLiveInputController();

    for (const code of CAMERA_PAN_CODES) {
      liveInput.press(code);
      const axes = cameraPanAxes(new Set([code]));
      expect(Math.abs(axes.forward) + Math.abs(axes.right)).toBe(1);
      const cameraBefore = camera.position.clone();
      const targetBefore = target.clone();
      translateOrbitRig(camera, target, cameraRelativePan(camera, axes.forward, axes.right));
      expect(camera.position.distanceTo(cameraBefore)).toBeGreaterThan(.001);
      expect(target.clone().sub(targetBefore)).toEqual(camera.position.clone().sub(cameraBefore));
      expect(stepLiveMovement(avatar, liveInput.sample(), { x: 0, z: -1 }, .1, world).position).toEqual(avatar.position);
    }
    for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      const cameraBefore = camera.position.clone();
      const targetBefore = target.clone();
      const axes = cameraPanAxes(new Set([code]));
      expect(axes).toEqual({ forward: 0, right: 0 });
      translateOrbitRig(camera, target, cameraRelativePan(camera, axes.forward, axes.right));
      expect(camera.position.distanceTo(cameraBefore)).toBeLessThan(.001);
      expect(target.distanceTo(targetBefore)).toBeLessThan(.001);
      liveInput.press(code);
      expect(stepLiveMovement(avatar, liveInput.sample(), { x: 0, z: -1 }, .1, world).position).not.toEqual(avatar.position);
      liveInput.release(code);
    }
  });
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
