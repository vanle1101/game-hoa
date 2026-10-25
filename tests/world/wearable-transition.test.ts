import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { applyProps } from "@react-three/fiber";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { CharacterModel } from "@/components/world/CharacterModel";
import { COSMETICS } from "@/character/catalog";
import { type WearableAnchor, type WearablePart } from "@/components/world/wearable-shapes";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", async importOriginal => ({
  ...await importOriginal<typeof import("@react-three/fiber")>(),
  useFrame: () => {},
}));

type Props = Record<string, unknown> & { children?: ReactNode };
type Element = ReactElement<Props>;
type Component = (props: Props) => ReactNode;
const anchors: WearableAnchor[] = ["torso", "head", "leftArm", "rightArm", "leftThigh", "rightThigh", "leftShin", "rightShin"];

function elements(node: ReactNode): Element[] {
  return Children.toArray(node).filter((child): child is Element => isValidElement<Props>(child));
}

function invoke(element: Element, props = element.props): ReactNode {
  expect(typeof element.type).toBe("function");
  return (element.type as Component)(props);
}

function wearableGroups(model = "v7-split-runner") {
  const cosmetic = COSMETICS.find(item => item.model === model);
  expect(cosmetic).toBeDefined();
  const result = new Map<WearableAnchor, { element: Element; parent: THREE.Group }>();
  function visit(node: ReactNode, parent: THREE.Group) {
    for (const element of elements(node)) {
      if (typeof element.type === "function" && "pieces" in element.props && "anchor" in element.props) {
        result.set(element.props.anchor as WearableAnchor, { element, parent });
      } else if (element.type === "group") {
        const group = new THREE.Group();
        applyProps(group, element.props);
        parent.add(group);
        visit(element.props.children, group);
      }
    }
  }
  visit(CharacterModel({ cosmetics: { shoes: cosmetic!.id }, paused: true }), new THREE.Group());
  expect([...result.keys()].sort()).toEqual([...anchors].sort());
  return result;
}

function parts(element: Element): Element[] {
  return elements(elements(invoke(element))[0].props.children);
}

function meshElement(element: Element): Element {
  while (typeof element.type === "function") element = elements(invoke(element))[0];
  expect(element.type).toBe("mesh");
  return element;
}

function materialProps(element: Element): Props {
  const material = elements(element.props.children).find(child => child.type === "meshStandardMaterial");
  expect(material).toBeDefined();
  return material!.props;
}

function mount(element: Element, parent: THREE.Group): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  const torus = elements(element.props.children).find(child => child.type === "torusGeometry");
  if (torus) mesh.geometry = new THREE.TorusGeometry(...torus.props.args as [number, number, number, number]);
  applyProps(mesh, element.props);
  applyProps(mesh.material, materialProps(element));
  parent.add(mesh);
  mesh.updateWorldMatrix(true, false);
  return mesh;
}

function assertTransition(previous: Element, next: Element, parent: THREE.Group) {
  const before = meshElement(previous), after = meshElement(next);
  const retained = mount(before, parent);
  const identity = { uuid: retained.uuid, material: retained.material, parent: retained.parent, rotation: retained.rotation, quaternion: retained.quaternion, position: retained.position, scale: retained.scale };
  const previousSpec = previous.props.spec as WearablePart;
  const nextSpec = next.props.spec as WearablePart;
  expect(retained.rotation.toArray().slice(0, 3)).toEqual(previousSpec.rotation ?? [0, 0, 0]);
  expect(applyProps(retained, after.props)).toBe(retained);
  applyProps(retained.material, materialProps(after));
  retained.updateWorldMatrix(true, false);
  const fresh = mount(after, parent);
  expect(retained.uuid).toBe(identity.uuid);
  expect(retained.parent).toBe(identity.parent);
  expect(retained.material).toBe(identity.material);
  expect(retained.rotation).toBe(identity.rotation);
  expect(retained.quaternion).toBe(identity.quaternion);
  expect(retained.position).toBe(identity.position);
  expect(retained.scale).toBe(identity.scale);
  expect(retained.rotation.toArray().slice(0, 3)).toEqual(nextSpec.rotation ?? [0, 0, 0]);
  expect(retained.rotation.toArray()).toEqual(fresh.rotation.toArray());
  expect(retained.quaternion.toArray()).toEqual(fresh.quaternion.toArray());
  expect(retained.position.toArray()).toEqual(fresh.position.toArray());
  expect(retained.scale.toArray()).toEqual(fresh.scale.toArray());
  expect(retained.matrix.elements).toEqual(fresh.matrix.elements);
  expect(retained.matrixWorld.elements).toEqual(fresh.matrixWorld.elements);
  expect(retained.geometry.attributes.position.array).toEqual(fresh.geometry.attributes.position.array);
  expect(retained.geometry.index?.array).toEqual(fresh.geometry.index?.array);
  expect(retained.material.color.toArray()).toEqual(fresh.material.color.toArray());
  expect(retained.material.roughness).toBe(fresh.material.roughness);
  expect(retained.material.metalness).toBe(fresh.material.metalness);
  expect(retained.material.emissive.toArray()).toEqual(fresh.material.emissive.toArray());
  expect(retained.material.emissiveIntensity).toBe(fresh.material.emissiveIntensity);
  parent.remove(retained, fresh);
  retained.material.dispose();
  fresh.material.dispose();
}

describe("retained wearable transforms with real R3F applyProps", () => {
  it("demonstrates that undefined rotation leaves an existing Three mesh rotated", () => {
    const retained = new THREE.Mesh();
    applyProps(retained, { rotation: [.12, -.2, 0] });
    applyProps(retained, { rotation: undefined });
    const fresh = new THREE.Mesh();
    applyProps(fresh, { rotation: undefined });
    retained.updateMatrixWorld(true);
    fresh.updateMatrixWorld(true);
    expect(retained.rotation.toArray()).toEqual([.12, -.2, 0, "XYZ"]);
    expect(retained.matrixWorld.elements).not.toEqual(fresh.matrixWorld.elements);
  });

  for (const anchor of anchors) {
    for (const kind of ["box", "ellipsoid", "taper", "ring"] as const) {
      it(`${anchor} ${kind}: rotated → missing → rotated exactly matches fresh meshes`, () => {
        const { element, parent } = wearableGroups().get(anchor)!;
        const sample = parts(wearableGroups().get("leftShin")!.element)[0];
        const spec: WearablePart = { kind, anchor, at: [.013, .11, -.021], size: [.12, .16, .08], colorRole: "trim" };
        const props = { ...sample.props, body: element.props.body };
        const plain: Element = { ...sample, props: { ...props, spec } };
        const rotated: Element = { ...sample, props: { ...props, spec: { ...spec, rotation: [.12, -.2, .3] } } };
        const opposite: Element = { ...sample, props: { ...props, spec: { ...spec, rotation: [-.12, .2, -.3] } } };
        assertTransition(rotated, plain, parent);
        assertTransition(plain, rotated, parent);
        assertTransition(rotated, opposite, parent);
      });
    }
  }

  it.each([
    ["v7-split-runner", "v7-buckle-combat-boots"],
    ["v7-buckle-combat-boots", "v7-split-runner"],
  ])("%s → %s preserves keys and matches fresh retained Part meshes", (from, to) => {
    const previous = wearableGroups(from), next = wearableGroups(to);
    let retainedCount = 0, clearedCount = 0;
    for (const anchor of ["leftShin", "rightShin"] as const) {
      const oldParts = parts(previous.get(anchor)!.element);
      const newParts = parts(next.get(anchor)!.element);
      for (const after of newParts) {
        const before = oldParts.find(part => part.key === after.key);
        if (!before) continue;
        const oldSpec = before.props.spec as WearablePart, newSpec = after.props.spec as WearablePart;
        if (!["box", "ellipsoid"].includes(oldSpec.kind) || !["box", "ellipsoid"].includes(newSpec.kind)) continue;
        expect(before.type).toBe(after.type);
        if (oldSpec.rotation && !newSpec.rotation) clearedCount++;
        assertTransition(before, after, next.get(anchor)!.parent);
        retainedCount++;
      }
    }
    expect(retainedCount).toBeGreaterThan(0);
    if (from === "v7-split-runner") expect(clearedCount).toBe(10);
  });
});
