import { Children, isValidElement, type RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { CharacterAnimation } from "@/components/world/CharacterModel";

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  cursor: 0,
  frame: undefined as ((state: unknown, delta: number) => void) | undefined,
  priority: undefined as number | undefined,
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
  },
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
  useFrame: (frame: (state: unknown, delta: number) => void, priority?: number) => {
    hooks.frame = frame;
    hooks.priority = priority;
  },
  useThree: () => ({}),
}));
vi.mock("@react-three/drei", () => ({ ContactShadows: () => null, Grid: () => null, Html: () => null, OrbitControls: () => null }));
vi.mock("../../src/components/world/CharacterModel", () => ({ CharacterModel: () => null }));
import { Avatar, type AvatarControlState, type AvatarProps } from "@/components/world/Apartment";

type GroupProps = { ref: RefObject<THREE.Group | null>; position: [number, number, number]; children?: import("react").ReactNode };
type ModelProps = { animationRef: RefObject<CharacterAnimation>; paused: boolean };

function harness(initial: AvatarProps, mount = true) {
  let props = initial;
  const group = new THREE.Group();
  let model: ModelProps;
  const render = (next = props) => {
    props = next;
    hooks.cursor = 0;
    const tree = Avatar(props);
    const root = tree.props as GroupProps;
    if (mount) root.ref.current = group;
    const child = Children.toArray(root.children).find(node => isValidElement<ModelProps>(node) && "animationRef" in node.props);
    if (!isValidElement<ModelProps>(child)) throw new Error("Avatar character model missing");
    model = child.props;
    return root;
  };
  const root = render();
  group.position.fromArray(root.position);
  return {
    group,
    render,
    tick(delta = 1 / 60) { hooks.frame?.({}, delta); },
    attach() { root.ref.current = group; },
    animation() { return model.animationRef.current; },
    paused() { return model.paused; },
  };
}

beforeEach(() => {
  hooks.refs = [];
  hooks.cursor = 0;
  hooks.frame = undefined;
  hooks.priority = undefined;
});

describe("Avatar controlled movement", () => {
  it("smoothly enters a rotated mattress pose and exits once at the saved reachable point", () => {
    const onPosition = vi.fn(), onPoseExit = vi.fn();
    const pose = { x: 3, z: 4, y: .8, rotation: Math.PI / 2, activity: "sleeping", exit: { x: 1, z: 2 } };
    const avatar = harness({ path: [], initialPosition: pose.exit, pose, onPosition, onPoseExit });
    avatar.tick(.1);
    expect(avatar.group.position.x).toBeGreaterThan(1);
    expect(avatar.group.position.x).toBeLessThan(3);
    expect(avatar.animation()).toBe("lie-down");
    for (let i = 0; i < 15; i++) avatar.tick(.1);
    expect(avatar.group.position.toArray()).toEqual([3, .8, 4]);
    const headDirection = new THREE.Vector3(0, 1, 0).applyEuler(avatar.group.rotation);
    expect(headDirection.x).toBeCloseTo(-1);
    expect(headDirection.z).toBeCloseTo(0);
    expect(avatar.animation()).toBe("lying");
    const exitPose = { ...pose, ...pose.exit, y: 0, activity: "idle", exiting: true };
    avatar.render({ path: [], pose: exitPose, onPosition, onPoseExit });
    avatar.tick(.1);
    expect(avatar.animation()).toBe("get-up");
    expect(onPoseExit).not.toHaveBeenCalled();
    for (let i = 0; i < 15; i++) avatar.tick(.1);
    expect(avatar.group.position.toArray()).toEqual([1, 0, 2]);
    expect(avatar.group.rotation.x).toBe(0);
    expect(onPosition).toHaveBeenLastCalledWith(pose.exit);
    expect(onPoseExit).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy click-route speed, shortest yaw, and one arrival notification", () => {
    const onPosition = vi.fn();
    const positionsAtArrival: unknown[] = [];
    const onArrive = vi.fn(() => positionsAtArrival.push(onPosition.mock.lastCall?.[0]));
    const avatar = harness({ path: [], initialPosition: { x: 0, z: 0 }, onPosition, onArrive });
    avatar.group.rotation.y = Math.PI * 2 - .1;
    avatar.render({ path: [{ x: 1, z: 0 }], onPosition, onArrive });
    avatar.tick(.1);
    expect(avatar.group.position.x).toBeCloseTo(.25);
    expect(avatar.group.position.z).toBe(0);
    expect(avatar.group.rotation.y).toBeCloseTo(Math.PI * 2 + Math.PI / 2);
    expect(avatar.animation()).toBe("walk");
    for (let i = 0; i < 10; i++) avatar.tick(.1);
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(positionsAtArrival).toEqual([{ x: 1, z: 0 }]);
    expect(avatar.animation()).toBe("idle");
  });

  it("accepts direct controlled props without advancing a route or applying a stale sleeping pose", () => {
    const onPosition = vi.fn(), onArrive = vi.fn();
    const controlled: AvatarControlState = { position: { x: 4, z: 5 }, rotation: Math.PI / 2, animation: "walk" };
    const avatar = harness({ path: [{ x: 20, z: 20 }], controlled, pose: { x: 8, z: 9, rotation: 0, activity: "sleeping" }, onPosition, onArrive });
    avatar.group.rotation.set(-Math.PI / 2, 0, .2);
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([4, 0, 5]);
    expect(avatar.group.rotation.toArray().slice(0, 3)).toEqual([0, Math.PI / 2, 0]);
    expect(avatar.animation()).toBe("walk");
    expect(onPosition).toHaveBeenLastCalledWith({ x: 4, z: 5 });
    expect(onArrive).not.toHaveBeenCalled();
    expect(controlled.position).toEqual({ x: 4, z: 5 });
  });

  it("samples ref replacements and mutations every frame without React rerenders", () => {
    const controlRef: RefObject<AvatarControlState | undefined> = { current: { position: { x: 1, z: 2 }, rotation: 0, animation: "walk" } };
    const onPosition = vi.fn();
    const avatar = harness({ path: [], controlRef, onPosition, controlled: { position: { x: 99, z: 99 }, rotation: 0, animation: "idle" } });
    avatar.tick();
    controlRef.current = { position: { x: 3, z: 4 }, rotation: -.5, animation: "idle" };
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([3, 0, 4]);
    expect(avatar.group.rotation.y).toBe(-.5);
    expect(avatar.animation()).toBe("idle");
    controlRef.current.position.x = 5;
    avatar.tick();
    expect(onPosition).toHaveBeenLastCalledWith({ x: 5, z: 4 });
    expect(avatar.group.position.x).toBe(5);
    expect(hooks.priority).toBe(-1);
    controlRef.current = undefined;
    avatar.tick();
    expect(avatar.group.position.x).toBe(5);
  });

  it("hands a fresh click route the latest controlled position and fires arrival only after travel", () => {
    const controlRef: RefObject<AvatarControlState | undefined> = { current: { position: { x: 7, z: 3 }, rotation: Math.PI / 2, animation: "walk" } };
    const onPosition = vi.fn(), onArrive = vi.fn();
    const avatar = harness({ path: [], initialPosition: { x: 0, z: 0 }, controlRef, onPosition, onArrive });
    avatar.tick();
    avatar.render({ path: [{ x: 8, z: 3 }], controlRef, onPosition, onArrive });
    avatar.tick(.1);
    expect(onArrive).not.toHaveBeenCalled();
    controlRef.current = undefined;
    avatar.tick(.1);
    expect(onPosition).toHaveBeenLastCalledWith({ x: 7.25, z: 3 });
    for (let i = 0; i < 10; i++) avatar.tick(.1);
    expect(onPosition).toHaveBeenLastCalledWith({ x: 8, z: 3 });
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("does not announce arrival when manual control cancels a path and returns to idle", () => {
    const controlRef: RefObject<AvatarControlState | undefined> = { current: undefined };
    const onArrive = vi.fn();
    const avatar = harness({ path: [], initialPosition: { x: 0, z: 0 }, controlRef, onArrive });
    avatar.render({ path: [{ x: 10, z: 0 }], controlRef, onArrive });
    avatar.tick(.1);
    controlRef.current = { position: { x: 2, z: 1 }, rotation: 0, animation: "idle" };
    avatar.render({ path: [], controlRef, onArrive });
    avatar.tick();
    controlRef.current = undefined;
    avatar.tick();
    avatar.tick();
    expect(onArrive).not.toHaveBeenCalled();
    expect(avatar.group.position.toArray()).toEqual([2, 0, 1]);
  });

  it("keeps stationary pose coordinates coherent for onPosition and the next route", () => {
    const onPosition = vi.fn();
    const avatar = harness({ path: [], pose: { x: 4, z: 3, rotation: 1, activity: "sleeping" }, onPosition });
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([4, .86, 3]);
    expect(onPosition).toHaveBeenLastCalledWith({ x: 4, z: 3 });
    avatar.render({ path: [{ x: 5, z: 3 }], onPosition });
    avatar.tick(.1);
    expect(avatar.group.position.toArray()).toEqual([4.25, 0, 3]);
    expect(avatar.group.rotation.x).toBe(0);
  });

  it("does not restore a stale furniture pose after control releases, but accepts a newly assigned pose", () => {
    const pose = { x: 8, z: 9, rotation: 0, activity: "sleeping" };
    const controlRef: RefObject<AvatarControlState | undefined> = { current: { position: { x: 3, z: 4 }, rotation: 1, animation: "walk" } };
    const path: AvatarProps["path"] = [];
    const onPosition = vi.fn();
    const avatar = harness({ path, pose, controlRef, onPosition });
    avatar.tick();
    controlRef.current = undefined;
    avatar.tick();
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([3, 0, 4]);
    expect(avatar.group.rotation.x).toBe(0);
    expect(avatar.animation()).toBe("idle");
    expect(onPosition).toHaveBeenLastCalledWith({ x: 3, z: 4 });
    avatar.render({ path, pose: { ...pose, x: 5, z: 6 }, controlRef, onPosition });
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([5, .86, 6]);
    expect(onPosition).toHaveBeenLastCalledWith({ x: 5, z: 6 });
  });

  it("retains the current route waypoint on release rather than skipping potentially obstructed segments", () => {
    const path = [{ x: 1, z: 0 }, { x: 5, z: 0 }];
    const controlRef: RefObject<AvatarControlState | undefined> = { current: undefined };
    const avatar = harness({ path, initialPosition: { x: 0, z: 0 }, controlRef });
    avatar.tick(.1);
    expect(avatar.group.position.x).toBeCloseTo(.25);
    controlRef.current = { position: { x: 4, z: 0 }, rotation: Math.PI / 2, animation: "walk" };
    avatar.tick();
    controlRef.current = undefined;
    avatar.tick(.1);
    expect(avatar.group.position.x).toBeCloseTo(3.75);
  });

  it("samples an earlier-priority writer before default-priority animation consumers", () => {
    const controlRef: RefObject<AvatarControlState | undefined> = { current: undefined };
    const avatar = harness({ path: [], controlRef });
    const observed: CharacterAnimation[] = [];
    const frames = [
      { priority: 0, run: () => observed.push(avatar.animation()) },
      { priority: hooks.priority!, run: () => avatar.tick() },
      { priority: -2, run: () => { controlRef.current = { position: { x: 2, z: 3 }, rotation: 1, animation: "walk" }; } },
    ];
    frames.sort((a, b) => a.priority - b.priority).forEach(frame => frame.run());
    expect(observed).toEqual(["walk"]);
    expect(avatar.group.position.toArray()).toEqual([2, 0, 3]);
  });

  it("waits for a mounted group then reads the latest control sample", () => {
    const controlRef: RefObject<AvatarControlState | undefined> = { current: { position: { x: 1, z: 2 }, rotation: 0, animation: "walk" } };
    const onPosition = vi.fn();
    const avatar = harness({ path: [], controlRef, onPosition }, false);
    avatar.tick();
    expect(onPosition).not.toHaveBeenCalled();
    controlRef.current = { position: { x: 6, z: 7 }, rotation: 1.2, animation: "idle" };
    avatar.attach();
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([6, 0, 7]);
    expect(avatar.animation()).toBe("idle");
  });

  it("preserves reduced-motion preview centering and ignores world control in only mode", () => {
    const avatar = harness({ path: [{ x: 5, z: 4 }], only: true, reducedMotion: true, controlled: { position: { x: 8, z: 9 }, rotation: 2, animation: "walk" } });
    avatar.tick();
    expect(avatar.group.position.toArray()).toEqual([0, 0, 0]);
    expect(avatar.animation()).toBe("idle");
    expect(avatar.paused()).toBe(true);
  });
});
