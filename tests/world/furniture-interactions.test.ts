import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { ApartmentScene, Avatar, Furniture, type WorldProps } from "../../src/components/world/Apartment";
import { WorldScene, type ConstructionWorldProps } from "../../src/components/construction/ConstructionWorld";
import { FurnitureModel } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG } from "../../src/furniture/catalog";
import { apartmentFurnitureRoute, buildingFurnitureRoute, completeFurnitureArrival, resolveFurnitureInteraction, toggleFurnitureActive } from "../../src/furniture/interactions";
import { furnitureBounds, walkable } from "../../src/components/world/geometry";
import type { BuildingFurniture, BuildingPlan } from "../../src/construction/types";
import { createInitialState } from "../../src/domain/engine";

const runtime = vi.hoisted(() => ({
  current: undefined as undefined | {
    cursor: number; slots: unknown[]; effects: (() => void)[]; cleanups: (() => void)[];
    frames: ((state: unknown, delta: number) => void)[];
  },
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  const memo = (factory: () => unknown, dependencies: unknown[]) => {
    const state = runtime.current!, index = state.cursor++;
    const prior = state.slots[index] as { value: unknown; dependencies: unknown[] } | undefined;
    if (!prior || dependencies.some((value, i) => !Object.is(value, prior.dependencies[i]))) state.slots[index] = { value: factory(), dependencies };
    return (state.slots[index] as { value: unknown }).value;
  };
  const effect = (callback: () => void | (() => void), dependencies?: unknown[]) => {
    const state = runtime.current!, index = state.cursor++;
    const prior = state.slots[index] as { dependencies?: unknown[]; cleanup?: () => void } | undefined;
    if (!prior || !dependencies || !prior.dependencies || dependencies.some((value, i) => !Object.is(value, prior.dependencies![i]))) {
      const slot = { dependencies, cleanup: undefined as undefined | (() => void) };
      state.slots[index] = slot;
      state.effects.push(() => { prior?.cleanup?.(); slot.cleanup = callback() || undefined; });
      if (!prior) state.cleanups.push(() => (state.slots[index] as typeof slot).cleanup?.());
    }
  };
  return {
    ...actual,
    useState: (initial: unknown) => {
      const state = runtime.current!, index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = typeof initial === "function" ? initial() : initial;
      return [state.slots[index], (next: unknown) => { state.slots[index] = typeof next === "function" ? next(state.slots[index]) : next; }];
    },
    useRef: (initial: unknown) => {
      const state = runtime.current!, index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = { current: initial };
      return state.slots[index];
    },
    useMemo: memo,
    useCallback: (callback: unknown, dependencies: unknown[]) => memo(() => callback, dependencies),
    useEffect: effect,
    useLayoutEffect: effect,
  };
});
vi.mock("@react-three/fiber", () => ({ Canvas: "canvas", useFrame: (callback: (state: unknown, delta: number) => void) => runtime.current!.frames.push(callback), useThree: () => ({ camera: new PerspectiveCamera(), controls: { target: new Vector3() } }) }));
vi.mock("@react-three/drei", () => ({ Grid: "grid", Html: "html", OrbitControls: "controls", ContactShadows: "shadows" }));
vi.mock("../../src/components/world/CharacterModel", () => ({ default: "character", CharacterModel: "character" }));
vi.mock("../../src/components/world/PetModel", () => ({ default: "pet" }));

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
const elements = (node: ReactNode): Element[] => Children.toArray(node).flatMap(child => isValidElement<Element["props"]>(child) ? [child, ...elements(child.props.children)] : []);
const disposers: (() => void)[] = [];
function mount<P>(component: (props: P) => ReactNode, initial: P) {
  const hooks = { cursor: 0, slots: [] as unknown[], effects: [] as (() => void)[], cleanups: [] as (() => void)[], frames: [] as ((state: unknown, delta: number) => void)[] };
  let props = initial, tree: ReactNode;
  const render = (next: Partial<P> = {}) => {
    props = { ...props, ...next };
    hooks.cursor = 0; hooks.frames = []; runtime.current = hooks;
    tree = component(props);
    hooks.effects.splice(0).forEach(effect => effect());
    return tree;
  };
  disposers.push(() => hooks.cleanups.forEach(cleanup => cleanup()));
  render();
  return { render, nodes: () => elements(tree), hooks };
}
function building(furnitureId = "workstation"): BuildingPlan {
  return {
    floors: Array.from({ length: 121 }, (_, i) => ({ x: i % 11 - 5, z: Math.floor(i / 11) - 5, level: 0, materialId: "floor-concrete" })),
    furniture: [{ id: "first", furnitureId, x: 2, z: 1, level: 0, rotation: 0 }],
    walls: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
}
function construction(plan = building(), mode: ConstructionWorldProps["mode"] = "live") {
  const onInteract = vi.fn(), onNotice = vi.fn(), onSelect = vi.fn();
  const scene = mount<ConstructionWorldProps>(WorldScene, { plan, mode, floorLevel: 0, tool: "select", onGesture: vi.fn(), onInteract, onNotice, onSelect, quality: "performance" });
  const item = (id = "first") => scene.nodes().find(node => (node.props.item as BuildingFurniture | undefined)?.id === id)!;
  return { ...scene, onInteract, onNotice, onSelect, item, click: (id?: string) => { (item(id).props.onClick as () => void)(); scene.render(); } };
}
function apartment(kind = "workstation", extra: WorldProps["placements"] = []) {
  const onInteract = vi.fn();
  const placements = [{ id: "first", kind, x: 3, z: 1.5, rotation: 0 }, ...extra];
  const scene = mount<WorldProps>(ApartmentScene, { onInteract, placements, roomId: "trophy", quality: "performance" });
  const item = (id = "first") => scene.nodes().find(node => node.key?.endsWith(`$${id}`) && typeof node.props.onInteract === "function")!;
  return { ...scene, onInteract, item, click: (id?: string) => { (item(id).props.onInteract as () => void)(); scene.render(); } };
}
function avatar(scene: { nodes: () => Element[] }) {
  return scene.nodes().find(node => node.type === Avatar)!.props as unknown as Parameters<typeof Avatar>[0];
}
function finish(scene: { nodes: () => Element[]; render: () => unknown }) {
  const character = avatar(scene), destination = character.path.at(-1);
  expect(destination).toBeDefined();
  character.onPosition?.(destination!);
  character.onArrive?.();
  scene.render();
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { hidden: false, activeElement: null, querySelector: vi.fn(() => null), addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("catalog interaction resolution", () => {
  it.each(FURNITURE_CATALOG)("resolves $id from its actual interaction metadata", definition => {
    for (const interaction of definition.interactions) expect(resolveFurnitureInteraction(definition.id, interaction.id)).toMatchObject({ definition, interaction, screen: interaction.screen, activity: interaction.activity, toggle: interaction.toggle === true });
  });
  it("rejects unknown furniture and absent interaction IDs", () => {
    expect(resolveFurnitureInteraction("unknown-bed-desk")).toBeUndefined();
    expect(resolveFurnitureInteraction("wardrobe", "sleep")).toBeUndefined();
  });
  it("does not execute arrival effects before arrival or in edit mode", () => {
    const arrival = { instanceId: "first", action: resolveFurnitureInteraction("cloud-bed")!, destination: { x: 2, z: 2 }, facing: 0 };
    const callbacks = { onInteract: vi.fn(), onToggle: vi.fn(), onPose: vi.fn() };
    expect(completeFurnitureArrival(arrival, { x: 0, z: 0 }, true, callbacks)).toBe(false);
    expect(completeFurnitureArrival(arrival, arrival.destination, false, callbacks)).toBe(false);
    Object.values(callbacks).forEach(callback => expect(callback).not.toHaveBeenCalled());
  });
});

describe("real scene event callbacks without WebGL", () => {
  const routes = [["workstation", "focus"], ["standing-desk", "focus"], ["wardrobe", "equipment"], ["drawer-chest", "inventory"], ["tool-bench", "crafting"], ["3d-printer", "crafting"], ["trophy-cup", "achievements"], ["cloud-bed", "recovery"], ["haven-sofa", "recovery"], ["range-cooker", "recovery"]];
  it.each(routes)("ConstructionWorld resolves %s after arrival and keeps living activities in the world", (kind, screen) => {
    const scene = construction(building(kind));
    scene.click();
    expect(scene.onInteract).not.toHaveBeenCalled();
    expect(avatar(scene).path.length).toBeGreaterThan(0);
    finish(scene);
    const living = !!resolveFurnitureInteraction(kind)?.activity;
    if (living) expect(scene.onInteract).not.toHaveBeenCalled();
    else expect(scene.onInteract).toHaveBeenCalledExactlyOnceWith(screen);
    avatar(scene).onArrive?.(); vi.runAllTimers();
    expect(scene.onInteract).toHaveBeenCalledTimes(living ? 0 : 1);
  });
  it.each(routes)("Apartment purchased %s dispatches %s only after successful arrival", (kind, screen) => {
    const scene = apartment(kind);
    scene.click();
    expect(scene.onInteract).not.toHaveBeenCalled();
    finish(scene);
    expect(scene.onInteract).toHaveBeenCalledExactlyOnceWith(screen);
  });
  it.each(["cloud-bed", "haven-sofa", "workstation"])("retains a safe exit while aligning %s to its furniture", kind => {
    const scene = construction(building(kind)); scene.click();
    const destination = avatar(scene).path.at(-1)!;
    finish(scene);
    const pose = avatar(scene).pose!;
    expect(pose).toMatchObject({ exit: destination, activity: kind === "workstation" ? "working-standing" : resolveFurnitureInteraction(kind)!.activity });
    expect(Number.isFinite(pose.y)).toBe(true);
    if (kind === "workstation") expect(pose).toMatchObject(destination);
    else expect({ x: pose.x, z: pose.z }).not.toEqual(destination);
  });
  it("preserves explicit legacy fixture routing rather than applying catalog defaults", () => {
    const scene = apartment(); scene.render({ roomId: "living" });
    const desk = scene.nodes().find(node => node.props.kind === "desk" && typeof node.props.onInteract === "function")!;
    (desk.props.onInteract as () => void)(); scene.render(); finish(scene);
    expect(scene.onInteract).toHaveBeenCalledExactlyOnceWith("quests");
  });
  it("keeps construction selection but never queues gameplay in edit mode", () => {
    const scene = construction(building(), "buy"); scene.click();
    expect(scene.onSelect).toHaveBeenCalledExactlyOnceWith({ kind: "furniture", id: "first" });
    expect(scene.nodes().some(node => node.type === Avatar)).toBe(false);
    expect(scene.onInteract).not.toHaveBeenCalled();
  });
  it("guards purchased Apartment clicks in edit mode and cancels pending arrivals", () => {
    const scene = apartment(); scene.click(); const old = avatar(scene);
    scene.render({ buildMode: true }); old.onPosition?.(old.path.at(-1)!); old.onArrive?.();
    scene.click(); vi.runAllTimers();
    expect(avatar(scene).path).toEqual([]);
    expect(scene.onInteract).not.toHaveBeenCalled();
  });
  it("cancels a construction interaction when mode, floor or layout changes", () => {
    for (const change of [{ mode: "build" as const }, { floorLevel: 1 }, { plan: building("wardrobe") }]) {
      const scene = construction(); scene.click(); const old = avatar(scene);
      scene.render(change); old.onPosition?.(old.path.at(-1)!); old.onArrive?.(); vi.runAllTimers();
      expect(scene.onInteract).not.toHaveBeenCalled();
    }
  });
  it("cancels delayed activity navigation on edit mode entry", () => {
    const scene = apartment("cloud-bed"); scene.click();
    const character = avatar(scene); character.onPosition?.(character.path.at(-1)!); character.onArrive?.();
    scene.render({ buildMode: true }); vi.runAllTimers();
    expect(scene.onInteract).not.toHaveBeenCalled();
  });
  it.each(["neon-floor-lamp", "flat-tv", "arcade-cabinet"])("toggles %s twice per construction instance without navigation or Gold changes", kind => {
    const state = createInitialState("furniture-test", "2026-01-01T00:00:00.000Z");
    const plan = building(kind); plan.furniture.push({ ...plan.furniture[0], id: "second", x: -4, z: 1 });
    state.gold = 125;
    state.building = { version: 1, revision: 0, plot: { minX: -5, maxX: 6, minZ: -5, maxZ: 6, maxLevel: 0, cellSize: 1 }, plan, paid: {}, starterGrantApplied: true, migratedAt: state.createdAt, legacyPlacementsPreserved: true };
    const before = JSON.stringify(state), originalPlan = JSON.stringify(plan), scene = construction(state.building.plan);
    scene.render({ character: state.character });
    expect(scene.item().props.active).toBe(true);
    scene.click(); finish(scene); expect(scene.item().props.active).toBe(false); expect(scene.item("second").props.active).toBe(true);
    scene.click(); finish(scene); expect(scene.item().props.active).toBe(true);
    expect(scene.onInteract).not.toHaveBeenCalled();
    expect(JSON.stringify(plan)).toBe(originalPlan); expect(JSON.stringify(state)).toBe(before);
  });
  it("toggles each purchased Apartment lamp independently and forwards active to FurnitureModel", () => {
    const scene = apartment("table-lamp", [{ id: "second", kind: "table-lamp", x: -3, z: 1.5, rotation: 0 }]);
    scene.click(); finish(scene); expect(scene.item().props.active).toBe(false); expect(scene.item("second").props.active).toBe(true);
    scene.click(); finish(scene); expect(scene.item().props.active).toBe(true);
    expect(scene.onInteract).not.toHaveBeenCalled();
    const model = Furniture({ kind: "table-lamp", active: false });
    expect(model.type).toBe(FurnitureModel); expect(model.props.active).toBe(false);
    expect(toggleFurnitureActive({ first: false }, "first")).toEqual({ first: true });
  });
  it("uses actual Avatar frame traversal before firing the scene's arrival callback", () => {
    const scene = construction(building("wardrobe")); scene.click();
    const motion = mount<Parameters<typeof Avatar>[0]>(Avatar, { ...avatar(scene), path: [] });
    motion.render(avatar(scene));
    const group = motion.nodes().find(node => node.props.ref)!;
    (group.props.ref as { current: Group }).current = new Group();
    expect(scene.onInteract).not.toHaveBeenCalled();
    for (let frame = 0; frame < 400; frame++) motion.hooks.frames.forEach(callback => callback({}, .05));
    vi.runAllTimers();
    expect(scene.onInteract).toHaveBeenCalledExactlyOnceWith("equipment");
  });
});

describe("blocked and rotated collision paths", () => {
  it("does not queue furniture through an unbroken wall and permits a real door", () => {
    const plan = building("wardrobe");
    plan.walls = Array.from({ length: 11 }, (_, i) => ({ x: 1, z: i - 5, level: 0, orientation: "z", materialId: "wall-concrete" }));
    const scene = construction(plan); scene.click();
    expect(avatar(scene).path).toEqual([]); expect(scene.onNotice).toHaveBeenCalled();
    avatar(scene).onArrive?.(); vi.runAllTimers(); expect(scene.onInteract).not.toHaveBeenCalled();
    const door = { ...plan, walls: plan.walls.map(wall => wall.z === 0 ? { ...wall, opening: { kind: "door" as const, catalogId: "door-basic" } } : wall) };
    scene.render({ plan: door }); scene.click(); finish(scene);
    expect(scene.onInteract).toHaveBeenCalledExactlyOnceWith("equipment");
  });
  it("rejects closest-reachable fallback paths for Apartment interactions", () => {
    const item = { x: 3, z: 0, width: 1, depth: 1 }, barrier = { x: 1, z: 0, width: .5, depth: 9 };
    expect(apartmentFurnitureRoute({ x: -2, z: 0 }, item, { width: 13, depth: 9 }, [barrier, item])).toEqual([]);
    const barriers = Array.from({ length: 6 }, (_, i) => ({ id: `barrier-${i}`, kind: "wardrobe", x: 1, z: -3.5 + i * 1.5, rotation: 90 }));
    const scene = apartment("workstation", barriers); scene.click();
    expect(avatar(scene).path).toEqual([]); avatar(scene).onArrive?.(); vi.runAllTimers();
    expect(scene.onInteract).not.toHaveBeenCalled();
  });
  it("routes to safe exterior cells for rotated furniture without changing plans", () => {
    const plan = building("cloud-bed"); plan.furniture[0].rotation = 90;
    const before = JSON.stringify(plan), route = buildingFurnitureRoute(plan, { x: 0, z: 0, level: 0 }, plan.furniture[0]);
    expect(route.length).toBeGreaterThan(0); expect(JSON.stringify(plan)).toBe(before);
    const item = { x: 1, z: 0, ...furnitureBounds("cloud-bed", 90) }, room = { width: 13, depth: 9 };
    const path = apartmentFurnitureRoute({ x: -4, z: 1 }, item, room, [item]);
    expect(path.length).toBeGreaterThan(0);
    expect(path.every(point => walkable(point, room, [item]))).toBe(true);
  });
  it("rejects interaction with furniture on another floor", () => {
    const plan = building(); plan.furniture[0].level = 1;
    expect(buildingFurnitureRoute(plan, { x: 0, z: 0, level: 0 }, plan.furniture[0])).toEqual([]);
  });
});



