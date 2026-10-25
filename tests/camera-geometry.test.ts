import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cameraBoomDistance, createCameraColliders, createCityTowerColliders, createCorridorCameraColliders, FOLLOW_DEFAULT_YAW, followViewDirection } from "../src/components/construction/camera-geometry";
import type { BuildingPlan } from "../src/construction/types";

const emptyPlan = (): BuildingPlan => ({ floors: [], walls: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} });

describe("desktop follow camera", () => {
  it("can aim almost straight up and down without flipping or changing yaw", () => {
    const up = followViewDirection(0, Math.PI / 2);
    const down = followViewDirection(0, -Math.PI / 2);
    expect(up.y).toBeGreaterThan(0.99);
    expect(down.y).toBeLessThan(-0.99);
    expect(up.z).toBeLessThan(0);
    expect(down.z).toBeLessThan(0);
    expect(up.length()).toBeCloseTo(1);
    expect(followViewDirection(Math.PI, 0).z).toBeCloseTo(1);
  });

  it("starts behind a character whose forward axis is +Z", () => {
    const anchor = new THREE.Vector3(0, 1.35, 0);
    const view = followViewDirection(FOLLOW_DEFAULT_YAW, 0);
    const cameraPosition = anchor.clone().addScaledVector(view, -3.6);
    expect(view.z).toBeGreaterThan(.99);
    expect(cameraPosition.z).toBeLessThan(-3);
  });

  it("retracts in front of the nearest solid rather than penetrating a wall", () => {
    const anchor = new THREE.Vector3(0, 1.35, 0);
    const desired = new THREE.Vector3(0, 1.35, 5);
    const near = new THREE.Box3(new THREE.Vector3(-2, 0, 2), new THREE.Vector3(2, 3, 2.2));
    const far = new THREE.Box3(new THREE.Vector3(-2, 0, 4), new THREE.Vector3(2, 3, 4.2));
    expect(cameraBoomDistance(anchor, desired, [far, near])).toBeCloseTo(1.975);
    expect(cameraBoomDistance(anchor, desired, [])).toBe(5);
  });

  it("stops the camera above the slab while preserving a sky-facing view direction", () => {
    const plan = emptyPlan();
    plan.floors.push({ x: 0, z: 0, level: 0, materialId: "floor-concrete" });
    const anchor = new THREE.Vector3(0.5, 1.35, 0.5);
    const direction = followViewDirection(0, Math.PI / 2);
    const desired = anchor.clone().addScaledVector(direction, -4);
    const distance = cameraBoomDistance(anchor, desired, createCameraColliders(plan, 0, true));
    const camera = anchor.clone().addScaledVector(direction, -distance);
    expect(camera.y).toBeGreaterThan(0.16);
    expect(distance).toBeLessThan(1.35);
    expect(direction.y).toBeGreaterThan(0.99);
  });

  it("retracts below the real ceiling when looking down from overhead", () => {
    const plan = emptyPlan();
    plan.floors.push({ x: 0, z: 0, level: 0, materialId: "floor-concrete" });
    const anchor = new THREE.Vector3(0.5, 1.35, 0.5);
    const distance = cameraBoomDistance(anchor, new THREE.Vector3(0.5, 5, 0.5), createCameraColliders(plan, 0, true));
    expect(anchor.y + distance).toBeLessThan(2.7);
    expect(distance).toBeGreaterThan(1);
  });

  it("uses selected floor elevation and ignores other floors' walls", () => {
    const plan = emptyPlan();
    plan.walls.push({ x: 0, z: 2, level: 1, orientation: "x", materialId: "wall-basic" });
    expect(createCameraColliders(plan, 0)).toHaveLength(0);
    const collider = createCameraColliders(plan, 1)[0];
    expect(collider.min.y).toBeCloseTo(3 - 0.16);
  });

  it("maps skyline tower metadata into world-space occlusion volumes", () => {
    const [tower] = createCityTowerColliders([{ x: 10, z: -4, width: 8, depth: 6, height: 30, topY: 12 }], -9);
    expect(tower.min.x).toBeCloseTo(10 - 4 - 0.16);
    expect(tower.max.z).toBeCloseTo(-4 + 3 + 0.16);
    expect(tower.min.y).toBeCloseTo(-9 + 12 - 30 - 0.16);
  });

  it("keeps the derived corridor landing and lift core out of the camera boom", () => {
    const [side, , back, lift] = createCorridorCameraColliders({ minX: -6, maxX: 6, minZ: 5, maxZ: 7.4 }, 0);
    expect(side.min.x).toBeLessThan(-6);
    expect(back.max.z).toBeGreaterThan(7.4);
    expect(lift.containsPoint(new THREE.Vector3(-3.5, 1.35, 7.2))).toBe(true);
  });
});
