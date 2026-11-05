import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { emptyPlan } from "@/construction/grid";
import { withLotObject } from "@/construction/lot-objects";
import { createLiveInputController } from "@/components/construction/live-movement";
import type { AvatarProps } from "@/components/world/Apartment";

const hooks = vi.hoisted(() => ({
  slots: [] as { value?: unknown; deps?: unknown[]; cleanup?: () => void }[], cursor: 0,
  effects: [] as (() => void)[], writes: 0,
  frame: undefined as ((state: unknown, delta: number) => void) | undefined,
  priority: undefined as number | undefined,
  three: {} as Record<string, unknown>,
}));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  const slot = () => { const index = hooks.cursor++; return hooks.slots[index] ?? (hooks.slots[index] = {}); };
  const changed = (old: unknown[] | undefined, deps: unknown[] | undefined) => !old || !deps || deps.some((v, i) => !Object.is(v, old[i]));
  return { ...react,
    useRef: (initial: unknown) => { const s = slot(); return s.value ?? (s.value = { current: initial }); },
    useState: (initial: unknown) => {
      const s = slot(); if (!("value" in s)) s.value = typeof initial === "function" ? initial() : initial;
      return [s.value, (value: unknown) => { hooks.writes++; s.value = typeof value === "function" ? value(s.value) : value; }];
    },
    useMemo: (factory: () => unknown, deps: unknown[]) => { const s = slot(); if (changed(s.deps, deps)) { s.value = factory(); s.deps = deps; } return s.value; },
    useCallback: (fn: unknown, deps: unknown[]) => { const s = slot(); if (changed(s.deps, deps)) { s.value = fn; s.deps = deps; } return s.value; },
    useEffect: (fn: () => (() => void) | undefined, deps: unknown[]) => { const s = slot(); if (changed(s.deps, deps)) { s.deps = deps; hooks.effects.push(() => { s.cleanup?.(); s.cleanup = fn(); }); } },
    useLayoutEffect: () => {},
  };
});
vi.mock("@react-three/fiber", () => ({ Canvas: () => null, useThree: () => hooks.three,
  useFrame: (frame: (state: unknown, delta: number) => void, priority?: number) => { hooks.frame = frame; hooks.priority = priority; },
}));
vi.mock("@react-three/drei", () => ({ Grid: () => null, Html: () => null, OrbitControls: () => null }));
vi.mock("@/components/world/Apartment", () => ({ Avatar: () => null, Fps: () => null, Furniture: () => null }));
vi.mock("@/components/world/ApartmentCity", () => ({ ApartmentCity: () => null, buildCityScene: () => ({ towers: [] }) }));
vi.mock("@/components/world/PetModel", () => ({ default: () => null }));
import { Avatar } from "@/components/world/Apartment";
import ConstructionWorld, { DynamicFurniture, WorldScene, type ConstructionWorldProps } from "@/components/construction/ConstructionWorld";

function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(tree).flatMap(node => isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : []);
}
function room() {
  const plan = emptyPlan();
  for (let x = -3; x < 6; x++) for (let z = -3; z < 6; z++) plan.floors.push({ x, z, level: 0, materialId: "floor-concrete" });
  return plan;
}
let win: EventTarget;
let doc: Document;
function harness(overrides: Partial<ConstructionWorldProps> = {}) {
  const liveInput = createLiveInputController();
  let props: ConstructionWorldProps = { plan: room(), mode: "live", tool: "select", floorLevel: 0, onGesture: vi.fn(), onInteract: vi.fn(), ...overrides };
  let tree: ReactNode;
  const render = (next: Partial<ConstructionWorldProps> = {}) => {
    props = { ...props, ...next }; hooks.cursor = 0; tree = WorldScene({ ...props, liveInput });
    hooks.effects.splice(0).forEach(effect => effect());
  };
  const avatar = () => nodes(tree).find(node => node.type === Avatar)!.props as unknown as AvatarProps;
  render();
  return { liveInput, render, avatar, props, tree: () => tree,
    tick(delta = .1) { hooks.frame?.({}, delta); const control = avatar().controlRef?.current; if (control) avatar().onPosition?.(control.position); },
    ground() { return nodes(tree).find(node => node.type === "mesh" && "onPointerMove" in node.props)!.props; },
    furniture() { return nodes(tree).find(node => "item" in node.props && "active" in node.props)!.props; },
  };
}
function key(code: string) { win.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code })); }

beforeEach(() => {
  hooks.slots = []; hooks.cursor = 0; hooks.effects = []; hooks.writes = 0;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 10, 10);
  hooks.three = { camera, gl: { domElement: {} }, controls: { target: new THREE.Vector3(0, 0, 0) } };
  win = new EventTarget();
  doc = Object.assign(new EventTarget(), { activeElement: null, hidden: false, querySelector: vi.fn(() => null) }) as unknown as Document;
  vi.stubGlobal("window", win); vi.stubGlobal("document", doc);
});
afterEach(() => { hooks.slots.forEach(slot => slot.cleanup?.()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("V12 WorldScene manual movement integration", () => {
  it("writes camera-relative controls at -2 without frame React updates", () => {
    const scene = harness(); scene.avatar().onPosition?.({ x: .5, z: .5 });
    key("ArrowUp"); scene.render(); const writes = hooks.writes;
    scene.tick(); expect(hooks.priority).toBe(-2);
    expect(scene.avatar().controlRef?.current?.position.z).toBeLessThan(.5);
    expect(scene.avatar().controlRef?.current?.animation).toBe("walk");
    const camera = hooks.three.camera as THREE.PerspectiveCamera;
    camera.position.set(-10, 10, 0); camera.lookAt(0, 10, 10);
    const before = scene.avatar().controlRef!.current!.position.x;
    for (let i = 0; i < 10; i++) scene.tick();
    expect(scene.avatar().controlRef!.current!.position.x).toBeGreaterThan(before);
    expect(hooks.writes).toBe(writes);
  });

  it.each(["wall", "furniture"])("uses existing collision world for %s", kind => {
    const plan = room();
    if (kind === "wall") for (let z = -3; z < 6; z++) plan.walls.push({ x: 1, z, level: 0, orientation: "z", materialId: "wall-basic" });
    else plan.furniture.push({ id: "solid", furnitureId: "haven-sofa", x: 1, z: 0, level: 0, rotation: 0 });
    const scene = harness({ plan }); scene.avatar().onPosition?.({ x: .5, z: .5 });
    key("ArrowRight"); scene.render(); for (let i = 0; i < 50; i++) scene.tick();
    expect(scene.avatar().controlRef!.current!.position.x).toBeLessThanOrEqual(kind === "wall" ? .741 : .801);
    expect(scene.avatar().controlRef!.current!.animation).toBe("idle");
  });

  it.each(["dialog", "typing", "blur", "visibility"])("hard stops and clears input on %s", reason => {
    const scene = harness(); scene.avatar().onPosition?.({ x: .5, z: .5 }); key("ArrowRight"); scene.render(); scene.tick();
    const before = { ...scene.avatar().controlRef!.current!.position };
    if (reason === "dialog") Object.assign(doc, { querySelector: () => ({}) });
    if (reason === "typing") Object.assign(doc, { activeElement: { closest: () => ({}) } });
    if (reason === "blur") win.dispatchEvent(new Event("blur"));
    if (reason === "visibility") { Object.assign(doc, { hidden: true }); doc.dispatchEvent(new Event("visibilitychange")); }
    scene.tick(); expect(scene.avatar().controlRef!.current!.position).toEqual(before);
    expect(scene.avatar().controlRef!.current!.animation).toBe("idle");
    expect(scene.liveInput.sample()).toEqual({ forward: 0, right: 0 });
    Object.assign(doc, { activeElement: null, hidden: false, querySelector: () => null }); win.dispatchEvent(new Event("focus"));
    scene.tick(); expect(scene.avatar().controlRef!.current!.position).toEqual(before);
  });

  it("releases control and routes from the last avatar position on floor click", () => {
    const scene = harness(); scene.avatar().onPosition?.({ x: 2.5, z: 1.5 }); key("ArrowRight"); scene.render(); scene.tick();
    const latest = scene.avatar().controlRef!.current!.position;
    (scene.ground().onClick as (event: unknown) => void)({ point: { x: 4, z: 1 }, stopPropagation: vi.fn() });
    scene.render(); expect(scene.avatar().controlRef!.current).toBeUndefined();
    expect(scene.liveInput.sample()).toEqual({ forward: 0, right: 0 });
    expect(scene.avatar().path[0]).toEqual({ x: Math.floor(latest.x) + .5, z: Math.floor(latest.z) + .5 });
    scene.tick(); expect(scene.avatar().controlRef!.current).toBeUndefined();
    key("ArrowRight"); scene.tick(); expect(scene.avatar().controlRef!.current).toBeUndefined();
    win.dispatchEvent(Object.assign(new Event("keyup"), { code: "ArrowRight" }));
    key("ArrowRight"); scene.render(); scene.tick(); expect(scene.avatar().controlRef!.current).toBeDefined();
  });

  it("manual takeover leaves furniture through its saved safe exit without navigation timers", () => {
    vi.useFakeTimers();
    const plan = room(); plan.furniture.push({ id: "desk", furnitureId: "workstation", x: 2, z: 2, level: 0, rotation: 0 });
    const scene = harness({ plan });
    (scene.furniture().onClick as () => void)(); scene.render();
    expect(scene.avatar().path.length).toBeGreaterThan(0);
    scene.avatar().onPosition?.(scene.avatar().path.at(-1)!); scene.avatar().onArrive?.(); scene.render();
    expect(vi.getTimerCount()).toBe(0);
    const exit = scene.avatar().pose!.exit;
    key("ArrowUp"); scene.render(); scene.tick(); scene.render();
    expect(scene.avatar().pose).toMatchObject({ ...exit, exiting: true });
    scene.avatar().onPosition?.(exit!); scene.avatar().onPoseExit?.(); scene.render();
    expect(scene.avatar().path).toEqual([]); expect(scene.avatar().pose).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    scene.avatar().onArrive?.(); vi.runAllTimers(); expect(scene.props.onInteract).not.toHaveBeenCalled();
  });

  it("cancels a pending furniture arrival before manual input takes over", () => {
    vi.useFakeTimers();
    const plan = room(); plan.furniture.push({ id: "desk", furnitureId: "workstation", x: 2, z: 2, level: 0, rotation: 0 });
    const scene = harness({ plan });
    (scene.furniture().onClick as () => void)(); scene.render();
    const arrival = scene.avatar().path.at(-1)!;
    key("ArrowUp"); scene.render(); scene.avatar().onPosition?.(arrival); scene.avatar().onArrive?.(); scene.render();
    expect(scene.avatar().path).toEqual([]); expect(scene.avatar().pose).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0); expect(scene.props.onInteract).not.toHaveBeenCalled();
  });

  it("disables movement in editor and clears control on geometry replacement", () => {
    const scene = harness(); key("ArrowUp"); scene.render(); scene.tick();
    expect(scene.avatar().controlRef!.current).toBeDefined();
    scene.render({ plan: room() }); expect(scene.avatar().controlRef!.current).toBeUndefined();
    scene.render({ mode: "build" }); key("ArrowUp"); hooks.frame?.({}, .1);
    expect(scene.liveInput.sample()).toEqual({ forward: 0, right: 0 });
    scene.render({ mode: "buy" }); key("ArrowUp"); hooks.frame?.({}, .1);
    expect(scene.liveInput.sample()).toEqual({ forward: 0, right: 0 });
  });

  it("ignores WASD for the avatar while arrow movement leaves the camera untouched", () => {
    const scene = harness();
    scene.avatar().onPosition?.({ x: .5, z: .5 });
    const camera = hooks.three.camera as THREE.PerspectiveCamera;
    const cameraBefore = camera.position.clone();
    key("KeyW"); scene.tick();
    expect(scene.liveInput.sample()).toEqual({ forward: 0, right: 0 });
    expect(scene.avatar().controlRef?.current).toBeUndefined();
    key("ArrowUp"); scene.render(); scene.tick();
    expect(scene.avatar().controlRef!.current!.position.z).toBeLessThan(.5);
    expect(camera.position.distanceTo(cameraBefore)).toBeLessThan(.001);
  });
});

describe("V16 desktop live controls", () => {
  it("renders the world shell without a virtual direction pad", () => {
    const tree = ConstructionWorld({ plan: room(), mode: "live", tool: "select", floorLevel: 0, onGesture: vi.fn(), onInteract: vi.fn() });
    const all = nodes(tree);
    expect(all.find(node => node.props.className === "construction-live-world")).toBeDefined();
    expect(all.some(node => String(node.props.className ?? "").includes("direction"))).toBe(false);
  });
});

describe("wall insert pointer priority", () => {
  it("shows a point cursor in Select without a one-cell highlight", () => {
    const scene = harness({ mode: "build", tool: "select" });
    const ground = scene.ground();
    (ground.onPointerMove as (event: unknown) => void)({ point: new THREE.Vector3(1.3, 0, 2.7), pointerId: 1, buttons: 0 });
    scene.render();
    const sceneNodes = nodes(scene.tree());
    expect(sceneNodes.some(node => node.type === "planeGeometry" && JSON.stringify(node.props.args) === "[0.97,0.97]")).toBe(false);
    expect(sceneNodes.some(node => node.type === "cylinderGeometry" && JSON.stringify(node.props.args) === "[0.035,0.035,0.54,8]")).toBe(true);
  });
  it("handles a click on the transparent pane as a furniture selection", () => {
    const onClick = vi.fn();
    const item = withLotObject({ id: "entry-door", furnitureId: "glass_door_modern", x: 0, z: 0, level: 0,
      rotation: 0, placementType: "wall_insert", wall_id: "0:x:0:0", wall_u: 0.5, wallNormal: [0, 0, 1], wallY: 0 });
    const tree = DynamicFurniture({ item, onClick, selected: false });
    const group = nodes(tree)[0];
    const stopPropagation = vi.fn();
    (group.props.onPointerDown as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
    (group.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledOnce();
    expect(nodes(tree).some(node => node.type === "boxGeometry" && JSON.stringify(node.props.args) === JSON.stringify([2, 2.4, 1.1]))).toBe(true);
  });
  it("keeps carried floor furniture under the pointer and rotates it with right click", () => {
    const rotate = vi.fn();
    const bed = withLotObject({ id: "bed-to-move", furnitureId: "bed", x: 0, z: 0, level: 0, rotation: 0 });
    const scene = harness({ mode: "build", tool: "move", activeFurniture: bed, onFurnitureRotate: rotate });
    (scene.ground().onPointerMove as (event: unknown) => void)({ point: new THREE.Vector3(2.3, 0, 3.7), pointerId: 1, buttons: 0 });
    scene.render();
    const ghost = nodes(scene.tree()).find(node => typeof node.type === "function" && node.type.name === "BuyGhost");
    expect(ghost?.props.item).toMatchObject({ x: 2, z: 3 });
    const wrapper = nodes(ConstructionWorld(scene.props)).find(node => node.props.className === "construction-live-world")!;
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    (wrapper.props.onContextMenuCapture as (event: unknown) => void)({ preventDefault, stopPropagation, shiftKey: false });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(rotate).toHaveBeenCalledExactlyOnceWith(90);
  });
  it("places carried furniture on left pointer down or Enter, never on pointer up", () => {
    const place = vi.fn();
    const bed = withLotObject({ id: "bed-to-place", furnitureId: "cloud-bed", x: 0, z: 0, level: 0, rotation: 90 });
    const scene = harness({ mode: "build", tool: "move", activeFurniture: bed, onFurniturePlace: place });
    const event = { point: new THREE.Vector3(1.3, 0, 1.7), pointerId: 1, button: 0,
      buttons: 1, stopPropagation: vi.fn(), target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
    (scene.ground().onPointerDown as (event: unknown) => void)(event);
    expect(place).toHaveBeenCalledExactlyOnceWith({ x: 1, z: 1, level: 0 }, undefined);
    (scene.ground().onPointerUp as (event: unknown) => void)(event);
    expect(place).toHaveBeenCalledTimes(1);
    place.mockClear();
    (scene.ground().onPointerMove as (event: unknown) => void)(event);
    scene.render();
    const enter = Object.assign(new Event("keydown", { cancelable: true }),
      { code: "Enter", isComposing: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false });
    win.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(place).toHaveBeenCalledExactlyOnceWith({ x: 1, z: 1, level: 0 }, undefined);
  });
});
