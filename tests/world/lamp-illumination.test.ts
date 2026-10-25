import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { computeApartmentLightingRig, computeRoomBounds } from "@/components/construction/architectural-materials";
import { WorldScene, type ConstructionWorldProps } from "@/components/construction/ConstructionWorld";
import { Avatar } from "@/components/world/Apartment";
import { FURNITURE } from "@/domain/catalog";
import type { BuildingFurniture, BuildingPlan } from "@/construction/types";

const runtime = vi.hoisted(() => ({ current: undefined as undefined | {
  cursor: number; slots: unknown[]; effects: (() => void)[]; cleanups: (() => void)[];
}, three: undefined as undefined | { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3 } } }));

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
vi.mock("@react-three/fiber", () => ({ Canvas: "canvas", useFrame: vi.fn(), useThree: () => runtime.three }));
vi.mock("@react-three/drei", () => ({ Grid: "grid", Html: "html", OrbitControls: "controls", ContactShadows: "shadows" }));
vi.mock("@/components/world/CharacterModel", () => ({ default: "character", CharacterModel: "character" }));
vi.mock("@/components/world/PetModel", () => ({ default: "pet" }));

type Element = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
const elements = (node: ReactNode): Element[] => Children.toArray(node).flatMap(child => isValidElement<Element["props"]>(child) ? [child, ...elements(child.props.children)] : []);
const disposers: (() => void)[] = [];
const furniture = (id: string, furnitureId = "neon-floor-lamp", level = 0): BuildingFurniture => ({ id, furnitureId, level, x: 2, z: 1, rotation: 0 });
const floors: BuildingPlan["floors"] = Array.from({ length: 121 }, (_, i) => ({ x: i % 11 - 5, z: Math.floor(i / 11) - 5, level: 0, materialId: "floor-concrete" }));
const bounds = computeRoomBounds(floors, 0);

function mountScene(quality: ConstructionWorldProps["quality"] = "balanced", mode: ConstructionWorldProps["mode"] = "live") {
  const plan: BuildingPlan = { floors, furniture: [furniture("first", "v7-paper-lantern"), { ...furniture("second"), x: -3 }], walls: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };
  const props: ConstructionWorldProps = { plan, mode, floorLevel: 0, tool: "select", onGesture: vi.fn(), onInteract: vi.fn(), quality };
  const hooks = { cursor: 0, slots: [] as unknown[], effects: [] as (() => void)[], cleanups: [] as (() => void)[] };
  let tree: ReactNode;
  const render = () => {
    hooks.cursor = 0; runtime.current = hooks;
    tree = WorldScene(props);
    hooks.effects.splice(0).forEach(effect => effect());
  };
  const nodes = () => elements(tree);
  const click = (id: string) => {
    const node = nodes().find(node => (node.props.item as BuildingFurniture | undefined)?.id === id && typeof node.props.onClick === "function")!;
    (node.props.onClick as () => void)(); render();
  };
  const lights = (): (Record<string, unknown> & { key: string | null })[] => nodes().filter(node => node.type === "pointLight").map(node => ({ key: node.key, ...node.props }));
  disposers.push(() => hooks.cleanups.forEach(cleanup => cleanup()));
  render();
  return { render, click, lights, nodes, props };
}

beforeEach(() => {
  runtime.three = { camera: new THREE.PerspectiveCamera(), controls: { target: new THREE.Vector3() } };
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { activeElement: null, hidden: false, querySelector: vi.fn(() => null) }));
});
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.unstubAllGlobals(); runtime.current = undefined; runtime.three = undefined; });

describe("owned apartment illumination", () => {
  it.each(FURNITURE.filter(def => def.category === "light"))("admits catalog light $id with default power on", def => {
    const rig = computeApartmentLightingRig(bounds, 0, [furniture("lamp", def.id)], "balanced");
    expect(rig.pointLights).toHaveLength(5);
    expect(rig.pointLights[4]).toMatchObject({ id: "furniture-light:lamp", intensity: 14, distance: 9, decay: 1.75 });
  });

  it("applies saved neon color and dimmer, including a persisted off state", () => {
    const lamp = { ...furniture("lamp", "table-lamp"), light_color: "#00ffcc", light_dimmer_value: 1.5 };
    const lit = computeApartmentLightingRig(bounds, 0, [lamp], "balanced").pointLights.at(-1)!;
    expect(lit).toMatchObject({ color: "#00ffcc", intensity: 7 });
    expect(computeApartmentLightingRig(bounds, 0, [{ ...lamp, light_dimmer_value: 0 }], "balanced").pointLights.at(-1)?.intensity).toBe(0);
  });

  it.each(["balanced", "high", "ultra"])("zeros only the selected instance and restores exact nominal values in %s", quality => {
    const items = [furniture("first", "v7-paper-lantern"), furniture("second")];
    const initial = computeApartmentLightingRig(bounds, 0, items, quality);
    const off = computeApartmentLightingRig(bounds, 0, items, quality, { first: false });
    expect(off).toEqual({ ...initial, pointLights: initial.pointLights.map(light => light.id === "furniture-light:first" ? { ...light, intensity: 0 } : light) });
    expect(computeApartmentLightingRig(bounds, 0, items, quality, { first: true })).toEqual(initial);
  });

  it("retains the first four eligible slots even when all admitted owners are off", () => {
    const items = [furniture("bed", "cloud-bed"), furniture("desk", "workstation"), furniture("lantern", "v7-paper-lantern"), furniture("lamp"), furniture("overflow", "table-lamp")];
    const initial = computeApartmentLightingRig(bounds, 0, items, "high");
    const states = Object.fromEntries(items.map(item => [item.id, false]));
    const off = computeApartmentLightingRig(bounds, 0, items, "high", states);
    expect(initial.pointLights.map(light => light.id).slice(4)).toEqual(["furniture-bed:bed", "furniture-desk:desk", "furniture-light:lantern", "furniture-light:lamp"]);
    expect(off.pointLights).toHaveLength(8);
    expect(off.pointLights.map(light => light.id)).toEqual(initial.pointLights.map(light => light.id));
    expect(off.pointLights.slice(4).map(light => light.intensity)).toEqual([0, 0, 0, 0]);
    expect(off.pointLights.slice(0, 4)).toEqual(initial.pointLights.slice(0, 4));
  });

  it("keeps performance at exactly four unchanged base lights", () => {
    const empty = computeApartmentLightingRig(bounds, 0, [], "performance");
    const items = [furniture("lamp"), furniture("bed", "cloud-bed"), furniture("desk", "workstation")];
    expect(empty.pointLights.map(light => light.intensity)).toEqual([23, 18, 16, 0.6]);
    expect(computeApartmentLightingRig(bounds, 0, items, "performance")).toEqual(empty);
    expect(computeApartmentLightingRig(bounds, 0, items, "performance", { lamp: false, bed: false, desk: false })).toEqual(empty);
  });

  it("excludes other floors and ignores stale state IDs without mutating inputs", () => {
    const items = [furniture("here"), furniture("upstairs", "v7-paper-lantern", 1)];
    const state = Object.freeze({ upstairs: false, deleted: false, "interior-warm-hearth": false });
    const before = JSON.stringify({ items, state });
    items.forEach(Object.freeze); Object.freeze(items);
    const expected = computeApartmentLightingRig(bounds, 0, [items[0]], "balanced");
    expect(computeApartmentLightingRig(bounds, 0, items, "balanced", state)).toEqual(expected);
    expect(JSON.stringify({ items, state })).toBe(before);
  });

  it("does not classify unknown light-like IDs or non-light displays as catalog lamps", () => {
    const items = [furniture("tv", "flat-tv"), furniture("unknown", "unknown-lamp"), furniture("plain", "missing")];
    expect(computeApartmentLightingRig(bounds, 0, items, "balanced")).toEqual(computeApartmentLightingRig(bounds, 0, [], "balanced"));
  });

  it.each(["workstation", "writing-desk", "v7-info-terminal", "unknown-desk"])("preserves the existing desk/terminal branch for %s", id => {
    const initial = computeApartmentLightingRig(bounds, 0, [furniture("accent", id)], "balanced");
    expect(initial.pointLights[4]).toMatchObject({ id: "furniture-desk:accent", intensity: 0.9 });
    expect(computeApartmentLightingRig(bounds, 0, [furniture("accent", id)], "balanced", { accent: false }).pointLights[4]).toEqual({ ...initial.pointLights[4], intensity: 0 });
    expect(computeApartmentLightingRig(bounds, 0, [furniture("accent", id)], "balanced", { accent: true })).toEqual(initial);
  });
});

describe("construction scene illumination wiring", () => {
  it("toggles owned lights immediately while retaining names and React keys", () => {
    const scene = mountScene();
    const initial = scene.lights();
    expect(initial).toHaveLength(6);
    expect(initial.map(light => light.name)).toEqual(["interior-warm-hearth", "interior-bedroom-warmth", "interior-lounge-warmth", "interior-cyber-workstation", "furniture-light:first", "furniture-light:second"]);
    const assertState = (first: boolean, second: boolean) => expect(scene.lights()).toEqual(initial.map(light => light.name === "furniture-light:first" ? { ...light, intensity: first ? 14 : 0 } : light.name === "furniture-light:second" ? { ...light, intensity: second ? 14 : 0 } : light));
    scene.click("first"); assertState(false, true);
    scene.render(); assertState(false, true);
    scene.click("second"); assertState(false, false);
    scene.click("first"); assertState(true, false);
    scene.click("second"); assertState(true, true);
    expect(scene.props.onInteract).not.toHaveBeenCalled();
  });

  it("retains the four base point-light props after performance-mode toggles", () => {
    const scene = mountScene("performance");
    const initial = scene.lights();
    expect(initial).toHaveLength(4);
    scene.click("first");
    expect(scene.lights()).toEqual(initial);
  });

  it("does not toggle owned illumination from edit-mode selection", () => {
    const scene = mountScene("balanced", "build");
    const initial = scene.lights();
    scene.click("first");
    expect(scene.lights()).toEqual(initial);
    const avatar = scene.nodes().find(node => node.type === Avatar)?.props as Parameters<typeof Avatar>[0] | undefined;
    expect(avatar?.path ?? []).toHaveLength(0);
  });
});
