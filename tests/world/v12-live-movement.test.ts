import { describe, expect, it, vi } from "vitest";
import { emptyPlan } from "../../src/construction/grid";
import { createCurve } from "../../src/construction/curves";
import { findBuildingPath, furnitureFootprint } from "../../src/construction/navigation";
import type { BuildingPlan, WallSegment } from "../../src/construction/types";
import {
  bindLiveControlListeners, cameraRelativeMovement, createLiveInputController, createLiveMovementState,
  createLiveMovementWorld, isLivePositionWalkable, isLiveTypingTarget, liveControlsBlocked,
  liveDirectionForCode, resolveLiveMovement, stepLiveMovement,
  type LiveControlGate, type LivePoint,
} from "../../src/components/construction/live-movement";
import { corridorCells, corridorSolids, createCorridorNavigationPlan, getApartmentCorridorBounds } from "../../src/components/construction/corridor-navigation";
import { createFixedApartment } from "../../src/construction/migration";

function room(min = -3, max = 4): BuildingPlan {
  const plan = emptyPlan();
  for (let x = min; x < max; x++) for (let z = min; z < max; z++) plan.floors.push({ x, z, level: 0, materialId: "floor-concrete" });
  return plan;
}
function wall(orientation: "x" | "z", opening?: "door" | "window"): WallSegment {
  return { x: 0, z: 0, level: 0, orientation, materialId: "wall-basic",
    ...(opening ? { opening: { kind: opening, catalogId: opening === "door" ? "door-standard" : "window-small" } } : {}) };
}
const camera = { x: 0, z: -1 };
const zero = { forward: 0, right: 0 };
const keyboard = (code: string, fields = {}) => Object.assign(new Event("keydown", { cancelable: true }), { code, ...fields });
function testDocument() {
  const target = new EventTarget();
  return Object.assign(target, { activeElement: null, hidden: false, querySelector: vi.fn(() => null) }) as unknown as Document;
}

describe("V12 camera-relative live movement", () => {
  it("maps camera forward and screen right onto the ground plane", () => {
    expect(cameraRelativeMovement({ forward: 1, right: 0 }, camera)).toEqual({ x: 0, z: -1 });
    expect(cameraRelativeMovement({ forward: 0, right: 1 }, camera)).toEqual({ x: 1, z: 0 });
    expect(cameraRelativeMovement({ forward: 1, right: 0 }, { x: 1, z: 0 })).toEqual({ x: 1, z: 0 });
    expect(cameraRelativeMovement({ forward: 0, right: 1 }, { x: 1, z: 0 })).toEqual({ x: 0, z: 1 });
  });
  it("normalizes diagonals, preserves analog input and rejects invalid input", () => {
    const diagonal = cameraRelativeMovement({ forward: 1, right: 1 }, camera);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    expect(cameraRelativeMovement({ forward: 0.3, right: 0.4 }, camera)).toEqual({ x: 0.4, z: -0.3 });
    expect(cameraRelativeMovement({ forward: NaN, right: Infinity }, camera)).toEqual({ x: 0, z: 0 });
    expect(cameraRelativeMovement({ forward: 1, right: 0 }, { x: 0, z: 0 })).toEqual({ x: 0, z: -1 });
  });
  it("accelerates smoothly, turns by the shortest angle and damps to idle", () => {
    const world = createLiveMovementWorld(room(-10, 10), 0);
    let state = createLiveMovementState({ x: 0.5, z: 0.5 }, Math.PI - 0.01);
    state = stepLiveMovement(state, { forward: 1, right: 0 }, camera, 1 / 60, world);
    expect(state.velocity.z).toBeLessThan(0);
    expect(Math.abs(state.velocity.z)).toBeLessThan(2.5);
    expect(state.animation).toBe("walk");
    expect(Math.abs(state.rotation - (Math.PI - 0.01))).toBeLessThan(0.1);
    const initialSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    state = stepLiveMovement(state, zero, camera, 1 / 60, world);
    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeLessThan(initialSpeed);
    for (let i = 0; i < 90; i++) state = stepLiveMovement(state, zero, camera, 1 / 60, world);
    expect(state.animation).toBe("idle");
    expect(state.velocity).toEqual({ x: 0, z: 0 });
  });
  it("is frame-rate independent in unobstructed space and has equal diagonal speed", () => {
    const world = createLiveMovementWorld(room(-10, 10), 0);
    const simulate = (frames: number, input = { forward: 1, right: 0 }) => {
      let state = createLiveMovementState({ x: 0.5, z: 0.5 });
      for (let i = 0; i < frames; i++) state = stepLiveMovement(state, input, camera, 1 / frames, world);
      return state;
    };
    const a = simulate(30), b = simulate(120), diagonal = simulate(60, { forward: 1, right: 1 });
    expect(a.position.z).toBeCloseTo(b.position.z, 8);
    expect(Math.hypot(diagonal.position.x - 0.5, diagonal.position.z - 0.5)).toBeCloseTo(0.5 - a.position.z, 8);
  });
  it("freezes immediately when disabled and limits a tab-stall frame", () => {
    const world = createLiveMovementWorld(room(), 0);
    const state = { ...createLiveMovementState({ x: 0.5, z: 0.5 }), velocity: { x: 2.5, z: 0 } };
    const disabled = stepLiveMovement(state, { forward: 0, right: 1 }, camera, 1, world, { enabled: false });
    expect(disabled.position).toEqual(state.position);
    expect(disabled.velocity).toEqual({ x: 0, z: 0 });
    expect(disabled.animation).toBe("idle");
    expect(stepLiveMovement(state, zero, camera, NaN, world)).toBe(state);
    const stalled = stepLiveMovement(state, { forward: 0, right: 1 }, camera, 10, world);
    expect(stalled.position.x - state.position.x).toBeCloseTo(0.25);
  });
});

describe("V12 finite-body building collisions", () => {
  it("adds a transient enclosed landing beyond the south door without mutating the fixed plan", () => {
    const fixed = createFixedApartment("2026-10-17T00:00:00.000Z");
    const before = JSON.stringify(fixed.plan);
    const bounds = getApartmentCorridorBounds(fixed.plan, fixed.plot)!;
    expect(bounds).toEqual({ minX: -6, maxX: 6, minZ: 5, maxZ: 7.4 });
    expect(corridorCells(bounds, 0)).toHaveLength(36);
    expect(corridorSolids(bounds)).toHaveLength(5);
    const world = createLiveMovementWorld(fixed.plan, 0, fixed.plot);
    expect(world.floors.has("0:0:6")).toBe(true);
    expect(isLivePositionWalkable(world, { x: 0.5, z: 6.5 })).toBe(true);
    expect(isLivePositionWalkable(world, { x: 0.5, z: 7.25 })).toBe(false);
    const entered = resolveLiveMovement(world, { x: .5, z: 4.5 }, { x: 0, z: 1.5 });
    expect(entered.z).toBeCloseTo(6);
    expect(resolveLiveMovement(world, entered, { x: 0, z: -1.5 }).z).toBeCloseTo(4.5);
    expect(resolveLiveMovement(world, { x: 3.5, z: 6 }, { x: 0, z: 3 }).z).toBeCloseTo(6.93, 2);
    expect(resolveLiveMovement(world, { x: 0, z: 6 }, { x: 20, z: 0 }).x).toBeCloseTo(5.68, 2);
    const route = findBuildingPath(createCorridorNavigationPlan(fixed.plan, fixed.plot), { x: 0, z: 6, level: 0 }, { x: 0, z: 3, level: 0 });
    expect(route.length).toBeGreaterThan(0);
    expect(route.at(-1)).toEqual({ x: 0, z: 3, level: 0 });
    expect(JSON.stringify(fixed.plan)).toBe(before);
  });

  it.each(["x", "z"] as const)("blocks both directions across a %s wall including long sweeps", orientation => {
    const plan = room(); plan.walls.push(wall(orientation));
    const world = createLiveMovementWorld(plan, 0);
    const start = orientation === "x" ? { x: 0.5, z: -1.5 } : { x: -1.5, z: 0.5 };
    const delta = orientation === "x" ? { x: 0, z: 4 } : { x: 4, z: 0 };
    const hit = resolveLiveMovement(world, start, delta);
    expect(orientation === "x" ? hit.z : hit.x).toBeCloseTo(-0.26, 3);
    expect(isLivePositionWalkable(world, hit)).toBe(true);
    const reverse = resolveLiveMovement(world, { x: start.x + delta.x, z: start.z + delta.z }, { x: -delta.x, z: -delta.z });
    expect(orientation === "x" ? reverse.z : reverse.x).toBeCloseTo(0.26, 3);
  });
  it.each(["x", "z"] as const)("passes centered %s doors but preserves jambs and blocks windows", orientation => {
    const plan = room(); plan.walls.push(wall(orientation, "door"));
    const world = createLiveMovementWorld(plan, 0);
    const start = orientation === "x" ? { x: 0.5, z: -0.5 } : { x: -0.5, z: 0.5 };
    const delta = orientation === "x" ? { x: 0, z: 1 } : { x: 1, z: 0 };
    expect(resolveLiveMovement(world, start, delta)).toEqual(expect.objectContaining(orientation === "x" ? { x: 0.5 } : { z: 0.5 }));
    const pass = resolveLiveMovement(world, start, delta);
    expect(orientation === "x" ? pass.z : pass.x).toBeCloseTo(0.5);
    const jamb = resolveLiveMovement(world, orientation === "x" ? { x: 0.12, z: -0.5 } : { x: -0.5, z: 0.12 }, delta);
    expect(orientation === "x" ? jamb.z : jamb.x).toBeLessThan(0);
    const oversized = resolveLiveMovement(world, start, delta, 0.43);
    expect(orientation === "x" ? oversized.z : oversized.x).toBeLessThan(0);
    plan.walls[0] = wall(orientation, "window");
    const windowHit = resolveLiveMovement(createLiveMovementWorld(plan, 0), start, delta);
    expect(orientation === "x" ? windowHit.z : windowHit.x).toBeLessThan(0);
  });
  it("slides along walls without tunneling through a diagonal corner", () => {
    const plan = room();
    for (let z = -3; z < 4; z++) plan.walls.push({ ...wall("z"), z });
    const world = createLiveMovementWorld(plan, 0);
    const result = resolveLiveMovement(world, { x: -0.5, z: -0.5 }, { x: 1, z: 1 });
    expect(result.x).toBeCloseTo(-0.26, 3);
    expect(result.z).toBeCloseTo(0.5, 3);
    expect(isLivePositionWalkable(world, result)).toBe(true);
  });
  it.each([0, 90, 180, 270] as const)("reserves rotated furniture footprint at %s degrees", rotation => {
    const plan = room(-5, 8);
    const item = { id: "sofa", furnitureId: "haven-sofa", x: 0, z: 0, level: 0, rotation };
    plan.furniture.push(item);
    const cells = furnitureFootprint(item);
    expect(cells.length).toBeGreaterThan(0);
    const world = createLiveMovementWorld(plan, 0);
    for (const cell of cells) expect(isLivePositionWalkable(world, { x: cell.x + 0.5, z: cell.z + 0.5 })).toBe(false);
    const result = resolveLiveMovement(world, { x: -1, z: 0.5 }, { x: 6, z: 0 });
    expect(result.x).toBeCloseTo(-0.2, 3);
  });
  it("does not fall from edges, cross holes, or jump between diagonal floor islands", () => {
    const plan = room(0, 3);
    plan.floors = plan.floors.filter(p => !(p.x === 1 && p.z === 1));
    const world = createLiveMovementWorld(plan, 0);
    expect(resolveLiveMovement(world, { x: 0.5, z: 0.5 }, { x: -4, z: 0 }).x).toBeCloseTo(0.2, 3);
    expect(resolveLiveMovement(world, { x: 0.5, z: 1.5 }, { x: 2, z: 0 }).x).toBeCloseTo(0.8, 3);
    expect(resolveLiveMovement(world, { x: 0.5, z: 0.5 }, { x: 2, z: 0 }).x).toBeCloseTo(2.5);
    const islands = emptyPlan();
    islands.floors = [{ x: 0, z: 0, level: 0, materialId: "floor-concrete" }, { x: 1, z: 1, level: 0, materialId: "floor-concrete" }];
    const diagonal = resolveLiveMovement(createLiveMovementWorld(islands, 0), { x: 0.5, z: 0.5 }, { x: 1, z: 1 });
    expect(diagonal.x).toBeLessThan(1);
    expect(diagonal.z).toBeLessThan(1);
  });
  it("collides with custom curved glass and ignores geometry on other floors", () => {
    const plan = room(-4, 5);
    plan.curves = [createCurve("curve-corner", { x: 0, z: 0, level: 0 }, "glass")];
    const world = createLiveMovementWorld(plan, 0);
    const result = resolveLiveMovement(world, { x: 0.3, z: 0.5 }, { x: 2, z: 0 });
    expect(result.x).toBeLessThan(1);
    expect(isLivePositionWalkable(world, result)).toBe(true);
    plan.curves[0].level = 1;
    plan.walls.push({ ...wall("z"), level: 1 });
    plan.furniture.push({ id: "upstairs", furnitureId: "haven-sofa", x: 0, z: 0, level: 1, rotation: 0 });
    const otherLevel = resolveLiveMovement(createLiveMovementWorld(plan, 0), { x: 0.3, z: 0.5 }, { x: 2, z: 0 });
    expect(otherLevel.x).toBeCloseTo(2.3);
  });
  it("rejects nonfinite movement, stays immutable and reproduces substep wall collisions", () => {
    const plan = room(); plan.walls.push(wall("z"));
    const before = JSON.stringify(plan), world = createLiveMovementWorld(plan, 0), start = { x: -1.5, z: 0.5 };
    expect(resolveLiveMovement(world, start, { x: Infinity, z: 0 })).toEqual(start);
    const big = resolveLiveMovement(world, start, { x: 3, z: 0 });
    let small: LivePoint = start;
    for (let i = 0; i < 60; i++) small = resolveLiveMovement(world, small, { x: 0.05, z: 0 });
    expect(big.x).toBeCloseTo(small.x, 3);
    expect(JSON.stringify(plan)).toBe(before);
    expect(start).toEqual({ x: -1.5, z: 0.5 });
  });
});

describe("V12 keyboard and mobile input lifecycle", () => {
  it("maps only physical arrow codes and releases held directions", () => {
    const start = vi.fn(), controls = createLiveInputController(start);
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) expect(liveDirectionForCode(code)).toBeUndefined();
    expect(liveDirectionForCode("ArrowUp")).toBe("forward");
    expect(liveDirectionForCode("ArrowDown")).toBe("backward");
    expect(liveDirectionForCode("ArrowLeft")).toBe("left");
    expect(liveDirectionForCode("ArrowRight")).toBe("right");
    expect(liveDirectionForCode("KeyE")).toBeUndefined();
    controls.press("KeyW"); expect(controls.sample()).toEqual(zero);
    controls.press("ArrowUp"); controls.press("ArrowUp");
    expect(start).toHaveBeenCalledTimes(1);
    controls.press("ArrowDown"); expect(controls.sample().forward).toBe(0);
    controls.release("ArrowUp"); expect(controls.sample().forward).toBe(-1);
    controls.clear(); expect(controls.sample()).toEqual(zero);
  });
  it("combines multitouch D-pad holds and releases each pointer independently", () => {
    const controls = createLiveInputController();
    controls.pressPointer(1, "forward"); controls.pressPointer(2, "right");
    expect(controls.sample()).toEqual({ forward: 1, right: 1 });
    controls.releasePointer(1); expect(controls.sample()).toEqual({ forward: 0, right: 1 });
    controls.press("KeyW"); controls.releasePointer(2);
    expect(controls.sample()).toEqual(zero);
    controls.clear(); expect(controls.sample()).toEqual(zero);
  });
  it("blocks editable targets, hidden tabs, build mode and modal/menu gates", () => {
    const editable = { closest: vi.fn(() => ({})) } as unknown as EventTarget;
    expect(isLiveTypingTarget(editable)).toBe(true);
    expect(isLiveTypingTarget(new EventTarget())).toBe(false);
    const doc = testDocument();
    expect(liveControlsBlocked(doc, { enabled: true })).toBe(false);
    expect(liveControlsBlocked(doc, { enabled: false })).toBe(true);
    expect(liveControlsBlocked(doc, { enabled: true, blocked: true })).toBe(true);
    Object.assign(doc, { hidden: true }); expect(liveControlsBlocked(doc, { enabled: true })).toBe(true);
    Object.assign(doc, { hidden: false, activeElement: editable }); expect(liveControlsBlocked(doc, { enabled: true })).toBe(true);
    Object.assign(doc, { activeElement: null, querySelector: () => ({}) }); expect(liveControlsBlocked(doc, { enabled: true })).toBe(true);
  });
  it("prevents scrolling only for admitted movement and detaches every listener", () => {
    const target = new EventTarget(), doc = testDocument(), controls = createLiveInputController();
    const attach = vi.spyOn(target, "addEventListener"), detach = vi.spyOn(target, "removeEventListener");
    const docAttach = vi.spyOn(doc, "addEventListener"), docDetach = vi.spyOn(doc, "removeEventListener");
    let gate: LiveControlGate = { enabled: true };
    const cleanup = bindLiveControlListeners(target, doc, controls, () => gate);
    const move = keyboard("ArrowUp"); target.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true); expect(controls.sample().forward).toBe(1);
    target.dispatchEvent(Object.assign(new Event("keyup"), { code: "ArrowUp" }));
    expect(controls.sample()).toEqual(zero);
    const modifier = keyboard("ArrowUp", { ctrlKey: true }); target.dispatchEvent(modifier);
    expect(modifier.defaultPrevented).toBe(false); expect(controls.sample()).toEqual(zero);
    const composing = keyboard("KeyW", { isComposing: true }); target.dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false); expect(controls.sample()).toEqual(zero);
    target.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyW" }));
    gate = { enabled: false }; const build = keyboard("ArrowUp"); target.dispatchEvent(build);
    expect(build.defaultPrevented).toBe(false); expect(controls.sample()).toEqual(zero);
    gate = { enabled: true }; target.dispatchEvent(keyboard("ArrowUp"));
    target.dispatchEvent(new Event("blur")); expect(controls.sample()).toEqual(zero);
    target.dispatchEvent(keyboard("ArrowUp")); doc.dispatchEvent(new Event("visibilitychange")); expect(controls.sample()).toEqual(zero);
    controls.pressPointer(8, "left"); target.dispatchEvent(Object.assign(new Event("pointercancel"), { pointerId: 8 }));
    expect(controls.sample()).toEqual(zero);
    controls.press("ArrowRight"); cleanup(); expect(controls.sample()).toEqual(zero);
    expect(detach.mock.calls).toEqual(attach.mock.calls);
    expect(docDetach.mock.calls).toEqual(docAttach.mock.calls);
    const detached = keyboard("ArrowUp"); target.dispatchEvent(detached);
    expect(detached.defaultPrevented).toBe(false); expect(controls.sample()).toEqual(zero);
  });
});
