import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactNode } from "react";
import * as THREE from "three";
import { CharacterModel, type CharacterAnimation, type CharacterModelProps } from "../../src/components/world/CharacterModel";
import WeaponModel from "../../src/components/world/WeaponModel";
import { EquipmentModel } from "../../src/components/world/equipment-models";
import { EQUIPMENT_CATALOG, getEquipmentRecipe, type EquipmentAnchor } from "../../src/equipment/catalog";

const hooks = vi.hoisted(() => ({
  frames: [] as ((state: { clock: { elapsedTime: number } }, dt: number) => void)[],
  cleanups: [] as (() => void)[],
}));

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  },
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: (state: { clock: { elapsedTime: number } }, dt: number) => void) => hooks.frames.push(callback),
}));

type HostProps = {
  children?: ReactNode;
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  geometry?: THREE.BufferGeometry;
  ref?: { current: THREE.Object3D | null };
};

function expand(node: ReactNode, parent: THREE.Object3D): void {
  if (Array.isArray(node)) {
    node.forEach(child => expand(child, parent));
    return;
  }
  if (!isValidElement<HostProps>(node)) return;
  if (typeof node.type === "function") {
    expand((node.type as (props: HostProps) => ReactNode)(node.props), parent);
    return;
  }
  if (typeof node.type !== "string") {
    expand(node.props.children, parent);
    return;
  }
  if (node.type !== "group" && node.type !== "mesh") return;
  const object = new THREE.Group();
  object.name = node.props.name ?? "";
  object.userData.geometry = node.props.geometry;
  if (node.props.position) object.position.fromArray(node.props.position);
  if (node.props.rotation) object.rotation.fromArray(node.props.rotation);
  if (node.props.scale) object.scale.fromArray(node.props.scale);
  if (node.props.ref) node.props.ref.current = object;
  parent.add(object);
  expand(node.props.children, object);
}

function renderRig(props: CharacterModelProps = {}) {
  const scene = new THREE.Group();
  expand(createElement(CharacterModel, props), scene);
  scene.updateMatrixWorld(true);
  return scene;
}

function models(scene: THREE.Object3D) {
  const result: THREE.Object3D[] = [];
  scene.traverse(object => { if (object.name.startsWith("equipment:")) result.push(object); });
  return result;
}

function partNodes(scene: THREE.Object3D) {
  const result: THREE.Object3D[] = [];
  scene.traverse(object => { if (/^(rightHand|leftHand|head|torso|leftArm|rightArm|leftShin|rightShin):/.test(object.name)) result.push(object); });
  return result;
}

const parents: Record<EquipmentAnchor, string> = {
  rightHand: "rightHand", leftHand: "leftHand", head: "equipment-anchor:head", torso: "equipment-anchor:torso",
  leftArm: "equipment-anchor:leftArm", rightArm: "equipment-anchor:rightArm", leftShin: "equipment-anchor:leftShin", rightShin: "equipment-anchor:rightShin",
};

beforeEach(() => { hooks.frames.length = 0; });
afterEach(() => { hooks.cleanups.splice(0).forEach(cleanup => cleanup()); });

describe("equipment rig integration", () => {
  it("adapts legacy weapon ids and defaults to the shared catalog renderer", () => {
    expect(WeaponModel({}).type).toBe(EquipmentModel);
    expect(WeaponModel({}).props.itemId).toBe("starter-blade");
    expect(WeaponModel({ id: "cyber-katana" }).props.itemId).toBe("cyber-katana");
    expect(WeaponModel({ id: "starter-blade", itemId: "atlas-hammer", anchor: "rightHand" }).props).toMatchObject({ itemId: "atlas-hammer", anchor: "rightHand" });
    expect(WeaponModel({ id: "twin-stingers", presentation: "display" }).props.presentation).toBe("display");
  });

  it.each(EQUIPMENT_CATALOG)("renders every $id recipe part exactly once on its declared rig anchor", item => {
    const scene = renderRig({ equipment: { [item.slot]: item.id } });
    const recipe = getEquipmentRecipe(item.id)!;
    const rendered = partNodes(scene);
    expect(models(scene)).toHaveLength(item.rigAnchors.length);
    expect(rendered.map(part => part.name).sort()).toEqual(recipe.parts.map(part => `${part.anchor}:${part.id}`).sort());
    for (const part of recipe.parts) {
      const object = scene.getObjectByName(`${part.anchor}:${part.id}`)!;
      expect(object.parent?.parent?.name).toBe(`equipment:${item.id}`);
      expect(object.parent?.parent?.parent?.name).toBe(parents[part.anchor]);
      expect(object.position.toArray()).toEqual(part.position);
      expect(object.rotation.toArray().slice(0, 3)).toEqual(part.rotation);
      const geometry = object.userData.geometry as THREE.BufferGeometry;
      expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
    }
  });

  it("preserves legacy callers, prefers explicit equipment weapons, and leaves unarmed models unarmed", () => {
    expect(models(renderRig())).toHaveLength(0);
    expect(models(renderRig({ weaponId: "cyber-katana" })).map(item => item.name)).toEqual(["equipment:cyber-katana"]);
    expect(models(renderRig({ weaponId: "cyber-katana", equipment: { head: "neural-visor" } })).map(item => item.name).sort()).toEqual(["equipment:cyber-katana", "equipment:neural-visor"]);
    expect(models(renderRig({ weaponId: "cyber-katana", equipment: { weapon: "atlas-hammer" } })).map(item => item.name)).toEqual(["equipment:atlas-hammer"]);
  });

  it("ignores unknown definitions, inventory instance ids, and mismatched slots", () => {
    expect(models(renderRig({ equipment: { weapon: "instance-1", head: "aegis-jacket", chest: "missing", gloves: "starter-blade", unknown: "focus-chip" } }))).toHaveLength(0);
    expect(models(renderRig({ weaponId: "missing" }))).toHaveLength(0);
    expect(models(renderRig({ equipment: { weapon: "neural-visor" } }))).toHaveLength(0);
    expect(models(renderRig({ weaponId: "starter-blade", equipment: { weapon: "" } }))).toHaveLength(0);
  });

  it("renders accessories in either compatible loadout slot", () => {
    const scene = renderRig({ equipment: { accessory2: "focus-chip", accessory1: "memory-ring" } });
    expect(models(scene).map(item => item.name).sort()).toEqual(["equipment:focus-chip", "equipment:memory-ring"]);
  });

  it("mounts dual weapons at independent hand grips without doubling either blade", () => {
    const scene = renderRig({ equipment: { weapon: "twin-stingers" } });
    for (const [anchor, arm] of [["leftHand", "left-arm"], ["rightHand", "right-arm"]]) {
      const socket = scene.getObjectByName(anchor)!;
      expect(socket.parent?.name).toBe(arm);
      expect(socket.position.toArray()).toEqual([0, -.48, .075]);
      expect(socket.rotation.x).toBe(Math.PI / 2);
      expect(scene.getObjectByName(`${anchor}:handle`)!.position.toArray()).toEqual([0, 0, 0]);
    }
    expect(partNodes(scene).filter(part => part.name.endsWith(":blade"))).toHaveLength(2);
  });

  it("keeps complete armor sets separate from cosmetics, facial meshes and existing rig pivots", () => {
    const props: CharacterModelProps = { character: { appearance: { facePreset: 2, body: "athletic", shoulderWidth: 1.1, height: 1.05 }, cosmetics: { top: "runner-jacket", shoes: "runner-shoes" } } };
    const baseline = renderRig(props);
    const scene = renderRig({ ...props, equipment: { weapon: "twin-stingers", head: "neural-visor", chest: "aegis-jacket", gloves: "pulse-gloves", boots: "drift-boots", accessory1: "focus-chip", accessory2: "memory-ring", relic: "dawn-relic" } });
    for (const name of ["character-rig", "torso", "head", "left-arm", "right-arm", "left-thigh", "right-thigh", "left-shin", "right-shin", "wearables-head", "wearables-torso", "wearables-leftArm", "wearables-rightArm", "wearables-leftShin", "wearables-rightShin"]) {
      const original = baseline.getObjectByName(name)!;
      const current = scene.getObjectByName(name)!;
      expect(current.position.toArray()).toEqual(original.position.toArray());
      expect(current.scale.toArray()).toEqual(original.scale.toArray());
      if (name.startsWith("wearables-")) expect(current.children.length).toBe(original.children.length);
    }
    const face = scene.getObjectByName("head")!.children[0];
    const originalFace = baseline.getObjectByName("head")!.children[0];
    expect(face.children.length).toBe(originalFace.children.length);
    expect(face.children[0].userData.geometry.getAttribute("position").array).toEqual(originalFace.children[0].userData.geometry.getAttribute("position").array);
    expect(scene.getObjectByName("equipment:memory-ring")!.parent?.parent?.name).toBe("left-arm");
    expect(scene.getObjectByName("equipment:aegis-jacket")!.parent?.parent?.name).toBe("torso");
    expect(scene.getObjectByName("equipment:neural-visor")!.parent?.parent?.name).toBe("head");
    for (const side of ["left", "right"]) expect(scene.getObjectByName(`equipment-anchor:${side}Shin`)!.parent?.name).toBe(`${side}-shin`);
  });

  it.each<CharacterAnimation>(["walk", "attack", "heavy", "dodge", "block", "victory", "sitting", "working", "studying", "exhausted"])("inherits %s animation without changing equipment-local transforms", animation => {
    const scene = renderRig({ animation, equipment: { weapon: "twin-stingers", chest: "aegis-jacket", gloves: "pulse-gloves", boots: "drift-boots" } });
    const parts = partNodes(scene);
    const local = parts.map(part => part.position.clone());
    const world = parts.map(part => part.getWorldPosition(new THREE.Vector3()));
    hooks.frames[0]({ clock: { elapsedTime: .2 } }, .1);
    scene.updateMatrixWorld(true);
    expect(parts.some((part, index) => part.getWorldPosition(new THREE.Vector3()).distanceTo(world[index]) > .0001)).toBe(true);
    parts.forEach((part, index) => expect(part.position.equals(local[index])).toBe(true));
  });

  it("honors paused state and animationRef on the existing rig", () => {
    const animationRef = { current: "walk" as CharacterAnimation };
    const scene = renderRig({ paused: true, animationRef, equipment: { weapon: "twin-stingers" } });
    hooks.frames[0]({ clock: { elapsedTime: .2 } }, .1);
    expect(scene.getObjectByName("right-arm")!.rotation.x).toBe(0);
    hooks.frames.length = 0;
    const active = renderRig({ animation: "idle", animationRef });
    hooks.frames[0]({ clock: { elapsedTime: .2 } }, .1);
    expect(active.getObjectByName("right-arm")!.rotation.x).not.toBe(0);
  });
});
