import { createElement, isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CharacterModel } from "@/components/world/CharacterModel";
import { bodyShape, taperMeshData, type CharacterPresentation } from "@/components/world/character-shape";
import { COSMETICS } from "@/character/catalog";
import { WEARABLE_SHAPES } from "@/components/world/wearable-shapes";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));

type Props = { children?: ReactNode; name?: string; position?: number[]; rotation?: [number, number, number]; scale?: number[]; geometry?: THREE.BufferGeometry };
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function expand(node: ReactNode, parent: THREE.Object3D): void {
  if (Array.isArray(node)) { node.forEach(child => expand(child, parent)); return; }
  if (!isValidElement<Props>(node)) return;
  if (typeof node.type === "function") { expand((node.type as (props: Props) => ReactNode)(node.props), parent); return; }
  if (typeof node.type !== "string") { expand(node.props.children, parent); return; }
  if (!["group", "mesh"].includes(node.type)) return;
  const object = node.props.geometry ? new THREE.Mesh(node.props.geometry, material) : new THREE.Group();
  object.name = node.props.name ?? "";
  if (node.props.position) object.position.fromArray(node.props.position);
  if (node.props.rotation) object.rotation.set(...node.props.rotation);
  if (node.props.scale) object.scale.fromArray(node.props.scale);
  parent.add(object);
  expand(node.props.children, object);
}
function render(model: string, body = "balanced", presentation: CharacterPresentation = "neutral", shoulderWidth = 1) {
  const item = COSMETICS.find(item => item.model === model)!;
  expect(item).toBeDefined();
  const scene = new THREE.Group();
  expand(createElement(CharacterModel, { paused: true, character: { appearance: { body, presentation, shoulderWidth } }, cosmetics: { [WEARABLE_SHAPES[model].layer]: item.id } }), scene);
  scene.updateMatrixWorld(true);
  return scene;
}
function localMesh(mesh: THREE.Mesh, relative: THREE.Object3D): THREE.Mesh {
  const copy = new THREE.Mesh(mesh.geometry, material);
  copy.applyMatrix4(relative.matrixWorld.clone().invert().multiply(mesh.matrixWorld));
  copy.updateMatrixWorld(true);
  return copy;
}
function taper(top: number, bottom: number, length: number, at: number[]): THREE.Mesh {
  const data = taperMeshData(top, bottom, length);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(data.indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.fromArray(at);
  mesh.updateMatrixWorld(true);
  return mesh;
}
function armMeshes(scene: THREE.Group, model: string, side: string) {
  const arm = scene.getObjectByName(`${side}-arm`)!;
  const wearables = arm.getObjectByName(`wearables-${side}Arm`)!;
  const offset = WEARABLE_SHAPES[model].layer === "outerwear" ? WEARABLE_SHAPES.tee.parts.filter(part => part.anchor === `${side}Arm`).length : 0;
  const handSurface = arm.getObjectByName(`${side}-hand-surface`)!;
  expect(handSurface).toBeDefined();
  const hand: THREE.Mesh[] = [];
  handSurface.traverse(object => {
    if (object instanceof THREE.Mesh) hand.push(localMesh(object, arm));
  });
  expect(hand.length).toBeGreaterThan(0);
  return {
    skin: [1, 2, 3].map(i => localMesh(arm.children[i] as THREE.Mesh, arm)),
    hand,
    cloth: [1, 2].map(i => localMesh(wearables.children[offset + i] as THREE.Mesh, arm)),
  };
}
function clearance(skin: THREE.Mesh[], cloth: THREE.Mesh[], y: number, angle: number): number {
  const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const ray = new THREE.Raycaster(direction.clone().multiplyScalar(.3).add(new THREE.Vector3(0, y, .013)), direction.clone().negate());
  const skinHit = ray.intersectObjects(skin, false)[0];
  const clothHit = ray.intersectObjects(cloth, false)[0];
  expect(skinHit, `skin ray y=${y} angle=${angle}`).toBeDefined();
  expect(clothHit, `cloth ray y=${y} angle=${angle}`).toBeDefined();
  return skinHit.distance - clothHit.distance;
}
function front(mesh: THREE.Mesh, y: number): number {
  const hit = new THREE.Raycaster(new THREE.Vector3(0, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh, false)[0];
  expect(hit).toBeDefined();
  return hit.point.z;
}
const longSleeves = [
  { model: "jacket", length: .38, radius: .076, witness: -.35, skin: .060626, cloth: .053651 },
  { model: "hoodie", length: .415, radius: .079, witness: -.398, skin: .056681, cloth: .051856 },
  { model: "turtleneck", length: .41, radius: .071, witness: -.39, skin: .057387, cloth: .047998 },
  { model: "rain-shell", length: .415, radius: .082, witness: -.398, skin: .056681, cloth: .053673 },
  { model: "overshirt", length: .36, radius: .078 },
  { model: "long-coat", length: .42, radius: .084 },
  { model: "trench", length: .43, radius: .086 },
  { model: "parka", length: .435, radius: .089 },
  { model: "bomber", length: .41, radius: .086 },
];

describe("actual seven-ring sleeve contact", () => {
  it.each(longSleeves.filter(row => row.witness !== undefined))("reproduces old $model protrusion above its authored cuff", ({ model, length, radius, witness, skin: expectedSkin, cloth: expectedCloth }) => {
    const { skin, cloth } = armMeshes(render(model), model, "left");
    const old = taper(radius * .98, radius * .66, length, [0, -length / 2 - .008, .004]);
    expect(skin[2].geometry.getAttribute("position").count).toBe(7 * 25);
    expect(skin[2].geometry.getIndex()!.count).toBe(6 * 24 * 6);
    expect(cloth[0].geometry.getAttribute("position").count).toBe(7 * 25);
    expect(witness!).toBeGreaterThan(-length - .005 + .042 / 2);
    expect(front(skin[2], witness!)).toBeCloseTo(expectedSkin!, 6);
    expect(front(old, witness!)).toBeCloseTo(expectedCloth!, 6);
    expect(clearance(skin, [old], witness!, 0)).toBeLessThan(-.002);
    expect(clearance(skin, cloth, witness!, 0)).toBeGreaterThan(.0001);
  });

  for (const { model, length, radius } of longSleeves) {
    for (const body of ["slim", "balanced", "athletic"]) {
      for (const side of ["left", "right"]) {
        it.each(["neutral", "masculine", "feminine"] as const)(`${model} ${body} %s ${side} arm encloses forearm through cuff`, presentation => {
          const scene = render(model, body, presentation);
          const limb = bodyShape(body, presentation).limb;
          const { skin, cloth, hand } = armMeshes(scene, model, side);
          const hem = -length - .005 - .042 / 2;
          skin[2].geometry.computeBoundingBox();
          const forearmEnd = skin[2].geometry.boundingBox!.min.y + skin[2].position.y;
          const lower = Math.max(hem, forearmEnd);
          const levels = new Set<number>([lower + .0001, -.285, -length + .016, -length - .008].filter(y => y > lower));
          for (let y = lower + .001; y <= -.285; y += .002) levels.add(y);
          for (const mesh of [...skin, ...cloth]) {
            const points = mesh.geometry.getAttribute("position");
            const index = mesh.geometry.getIndex()!;
            for (let i = 0; i < index.count; i += 3) {
              const ys = [0, 1, 2].map(n => points.getY(index.getX(i + n)) + mesh.position.y);
              for (const y of [...ys, (ys[0] + ys[1]) / 2, (ys[1] + ys[2]) / 2, (ys[2] + ys[0]) / 2, (ys[0] + ys[1] + ys[2]) / 3]) {
                if (y > lower + .00001 && y <= -.285) levels.add(Number(y.toFixed(9)));
              }
            }
          }
          let minimum = Infinity;
          for (const y of levels) for (let angle = 0; angle < 48; angle++) minimum = Math.min(minimum, clearance(skin, cloth, y, angle * Math.PI / 24));
          expect(minimum, `${model}/${body}/${presentation}/${side}`).toBeGreaterThan(.0001);
          for (const [index, expected] of [[0, [0, -length / 2 - .008, .004]], [1, [0, -length - .005, .005]]] as const) {
            cloth[index].position.toArray().forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 12));
          }
          expect(cloth[0].geometry.getAttribute("position").getY(0)).toBeCloseTo(-length / 2, 7);
          expect(cloth[1].geometry.getAttribute("position").getY(0)).toBeCloseTo(-.021, 7);
          expect(cloth[0].geometry.getAttribute("position").getZ(150)).toBeCloseTo(radius * .98 * .78 * limb, 7);
          const below = new THREE.Raycaster(new THREE.Vector3(0, hem - .003, 1), new THREE.Vector3(0, 0, -1));
          expect(below.intersectObjects(cloth, false)).toHaveLength(0);
          expect(below.intersectObjects([...skin, ...hand], false).length).toBeGreaterThan(0);
        });
      }
    }
  }

  it("preserves short and elbow sleeve lengths, shoulder caps, anchors and trim", () => {
    for (const { model, length, radius } of [...longSleeves, { model: "tee", length: .165, radius: .072 }, { model: "shell", length: .11, radius: .071 }, { model: "cropped-jacket", length: .28, radius: .078 }]) {
      for (const [anchor, side] of [["leftArm", -1], ["rightArm", 1]] as const) {
        const [cap, sleeve, cuff, trim] = WEARABLE_SHAPES[model].parts.filter(part => part.anchor === anchor);
        const capHeight = model === "jacket" || model === "hoodie" ? Math.max(.072, radius * .95) : radius * 1.12;
        expect(cap).toEqual({ anchor, kind: "ellipsoid", at: [-side * .012, -.028, 0], size: [radius * .92, capHeight, radius * 1.02], colorRole: "primary", rotation: [0, 0, side * -.24] });
        expect(sleeve.at).toEqual([0, -length / 2 - .008, .004]);
        expect(sleeve.size[1]).toBe(length);
        if (length < .28) expect(sleeve.size).toEqual([radius * .98, length, radius * (length <= .12 ? .9 : .78)]);
        expect(sleeve.size[0]).toBe(radius * .98);
        if (cuff) {
          expect(cuff.at).toEqual([0, -length - .005, .005]);
          expect(cuff.colorRole).toBe("secondary");
          expect(trim.at[0] * side).toBeGreaterThan(radius * .54);
          expect(trim).toEqual({ anchor, kind: "box", at: [trim.at[0], -length - .005, .016], size: [.016, .022, .042], colorRole: "trim", metal: .58 });
        }
      }
    }
  });
});

describe("distal cuff follow-up", () => {
  it("reproduces the cropped hem protrusion with the original actual cuff", () => {
    const { skin } = armMeshes(render("cropped-jacket"), "cropped-jacket", "left");
    const old = taper(.078 * .68, .078 * .63, .042, [0, -.285, .005]);
    expect(clearance(skin, [old], -.3059, 0)).toBeLessThan(-.02);
  });

  for (const body of ["slim", "balanced", "athletic"]) {
    for (const side of ["left", "right"]) {
      it.each(["neutral", "masculine", "feminine"] as const)(`cropped-jacket ${body} %s ${side} arm encloses distal skin without moving its hem`, presentation => {
        const scene = render("cropped-jacket", body, presentation);
        const { skin, cloth, hand } = armMeshes(scene, "cropped-jacket", side);
        let minimum = Infinity;
        const levels = new Set<number>([-.30599, -.3059, -.23]);
        for (let y = -.3059; y <= -.23; y += .001) levels.add(y);
        for (const mesh of [...skin, ...cloth]) {
          const points = mesh.geometry.getAttribute("position"), index = mesh.geometry.getIndex()!;
          for (let i = 0; i < index.count; i += 3) {
            const ys = [0, 1, 2].map(n => points.getY(index.getX(i + n)) + mesh.position.y);
            for (const y of [...ys, (ys[0] + ys[1]) / 2, (ys[1] + ys[2]) / 2, (ys[2] + ys[0]) / 2, (ys[0] + ys[1] + ys[2]) / 3]) {
              if (y > -.306 + .00001 && y <= -.23) levels.add(Number(y.toFixed(9)));
            }
          }
        }
        for (const y of levels) for (let angle = 0; angle < 48; angle++) minimum = Math.min(minimum, clearance(skin, cloth, y, angle * Math.PI / 24));
        expect(minimum).toBeGreaterThan(.0001);
        const below = new THREE.Raycaster(new THREE.Vector3(0, -.309, 1), new THREE.Vector3(0, 0, -1));
        expect(below.intersectObjects(cloth, false)).toHaveLength(0);
        expect(below.intersectObjects([...skin, ...hand], false).length).toBeGreaterThan(0);
      });
    }
  }

  for (const { model } of [...longSleeves, { model: "cropped-jacket" }]) {
    it.each(["slim", "balanced", "athletic"])(`${model} %s trim is attached across the actual cuff contour and visible outside it`, body => {
      for (const presentation of ["neutral", "masculine", "feminine"] as const) {
        const scene = render(model, body, presentation);
        for (const side of ["left", "right"]) {
          const arm = scene.getObjectByName(`${side}-arm`)!;
          const wearables = arm.getObjectByName(`wearables-${side}Arm`)!;
          const offset = WEARABLE_SHAPES[model].layer === "outerwear" ? WEARABLE_SHAPES.tee.parts.filter(part => part.anchor === `${side}Arm`).length : 0;
          const cuff = localMesh(wearables.children[offset + 2] as THREE.Mesh, arm);
          const trim = localMesh(wearables.children[offset + 3] as THREE.Mesh, arm);
          const sign = side === "left" ? -1 : 1;
          for (const dy of [-.004, 0, .004]) for (const dz of [-.008, 0, .008]) {
            const ray = new THREE.Raycaster(new THREE.Vector3(sign * .3, trim.position.y + dy, trim.position.z + dz), new THREE.Vector3(-sign, 0, 0));
            const surface = ray.intersectObject(cuff, false)[0];
            const tab = ray.intersectObject(trim, false);
            expect(surface).toBeDefined(); expect(tab.length).toBeGreaterThanOrEqual(2);
            expect(surface.distance - tab[0].distance, `${model}/${body}/${presentation}/${side}: exposed`).toBeGreaterThan(.0001);
            expect(tab.at(-1)!.distance - surface.distance, `${model}/${body}/${presentation}/${side}: attached`).toBeGreaterThan(.0001);
          }
        }
      }
    });
  }
});

function triangles(mesh: THREE.Mesh): THREE.Triangle[] {
  const position = mesh.geometry.getAttribute("position"), index = mesh.geometry.getIndex();
  const result: THREE.Triangle[] = [];
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const points = [0, 1, 2].map(n => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + n) : i + n).applyMatrix4(mesh.matrixWorld));
    const triangle = new THREE.Triangle(points[0], points[1], points[2]);
    if (triangle.getArea() > 1e-12) result.push(triangle);
  }
  return result;
}
function touches(a: THREE.Mesh, b: THREE.Mesh): boolean {
  const left = triangles(a), right = triangles(b);
  for (const [source, target] of [[left, right], [right, left]]) for (const triangle of source) {
    for (const [start, end] of [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]) {
      const direction = end.clone().sub(start), length = direction.length();
      const ray = new THREE.Ray(start, direction.normalize());
      for (const other of target) {
        const hit = ray.intersectTriangle(other.a, other.b, other.c, false, new THREE.Vector3());
        if (hit && hit.distanceTo(start) <= length + 1e-8) return true;
      }
    }
  }
  return false;
}

describe("scarf triangle connection", () => {
  it("rejects the original z gap despite y overlap, and rejects AABB-only contact", () => {
    const scene = render("scarf"), torso = scene.getObjectByName("torso")!;
    const wearables = torso.getObjectByName("wearables-torso")!;
    const offset = WEARABLE_SHAPES.tee.parts.filter(part => part.anchor === "torso").length + WEARABLE_SHAPES.tapered.parts.filter(part => part.anchor === "torso").length;
    const wrap = localMesh(wearables.children[offset] as THREE.Mesh, torso);
    const tail = localMesh(wearables.children[offset + 1] as THREE.Mesh, torso);
    const wrapBounds = new THREE.Box3().setFromObject(wrap), tailBounds = new THREE.Box3().setFromObject(tail);
    expect(wrapBounds.max.z).toBeCloseTo(.09263232, 7);
    expect(tailBounds.min.z).toBeCloseTo(.134, 7);
    expect(tailBounds.max.y).toBeGreaterThan(wrapBounds.min.y);
    expect(tailBounds.min.z - wrapBounds.max.z).toBeGreaterThan(.04136);
    expect(touches(wrap, tail)).toBe(false);
    const misleading = tail.clone();
    misleading.position.z = .095;
    misleading.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(misleading).intersectsBox(wrapBounds)).toBe(true);
    expect(touches(wrap, misleading)).toBe(false);
  });

  for (const body of ["slim", "balanced", "athletic"]) for (const shoulderWidth of [.8, 1, 1.2]) it.each(["neutral", "masculine", "feminine"] as const)(`${body} shoulder ${shoulderWidth} %s has a real triangle-connected wrap and tail`, presentation => {
    const scene = render("scarf", body, presentation, shoulderWidth), torso = scene.getObjectByName("torso")!;
    const wearables = torso.getObjectByName("wearables-torso")!;
    const offset = WEARABLE_SHAPES.tee.parts.filter(part => part.anchor === "torso").length + WEARABLE_SHAPES.tapered.parts.filter(part => part.anchor === "torso").length;
    const [wrap, tail, connector] = [0, 1, 2].map(i => localMesh(wearables.children[offset + i] as THREE.Mesh, torso));
    expect(touches(wrap, connector)).toBe(true);
    expect(touches(connector, tail)).toBe(true);
    expect(WEARABLE_SHAPES.scarf.parts[0]).toEqual({ anchor: "torso", kind: "taper", at: [0, 1.512, 0], size: [.084, .048, .092], colorRole: "primary" });
    expect(WEARABLE_SHAPES.scarf.parts[1]).toEqual({ anchor: "torso", kind: "box", at: [.064, 1.382, .142], size: [.048, .225, .016], colorRole: "primary" });
  });
});
