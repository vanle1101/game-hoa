import { createElement, isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CharacterModel, type CharacterModelProps } from "@/components/world/CharacterModel";
import { bodyShape, faceShape, headMeshData } from "@/components/world/character-shape";
import { BROW_SHAPES, EYE_SHAPES, MOUTH_SHAPES, facialRibbonMesh, mouthPoints } from "@/components/world/facial-shape";
import { WEARABLE_SHAPES } from "@/components/world/wearable-shapes";
import { COSMETICS } from "@/character/catalog";
import { LOWER_V7_SHAPES } from "@/character/fashion-lower-v7";
import { UPPER_V7_SHAPES } from "@/character/fashion-upper-v7";
import { STARTER_POLO_V7_SHAPES } from "@/character/starter-polo-v7";
import { ACCESSORY_V7_SHAPES } from "@/character/fashion-accessory-v7";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => {} }));

type Props = { children?: ReactNode; name?: string; position?: number[]; rotation?: [number, number, number]; scale?: number[]; geometry?: THREE.BufferGeometry };
function expand(node: ReactNode, parent: THREE.Object3D): void {
  if (Array.isArray(node)) { node.forEach(child => expand(child, parent)); return; }
  if (!isValidElement<Props>(node)) return;
  if (typeof node.type === "function") { expand((node.type as (props: Props) => ReactNode)(node.props), parent); return; }
  if (typeof node.type !== "string") { expand(node.props.children, parent); return; }
  if (!["group", "mesh"].includes(node.type)) return;
  const object = node.props.geometry ? new THREE.Mesh(node.props.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) : new THREE.Group();
  object.name = node.props.name ?? "";
  if (node.props.position) object.position.fromArray(node.props.position);
  if (node.props.rotation) object.rotation.set(...node.props.rotation);
  if (node.props.scale) object.scale.fromArray(node.props.scale);
  parent.add(object);
  expand(node.props.children, object);
}
function render(props: CharacterModelProps = {}) {
  const scene = new THREE.Group();
  expand(createElement(CharacterModel, { paused: true, ...props }), scene);
  scene.updateMatrixWorld(true);
  return scene;
}
function vertices(mesh: THREE.Mesh, relative: THREE.Object3D): THREE.Vector3[] {
  const matrix = relative.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const position = mesh.geometry.getAttribute("position");
  return Array.from({ length: position.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix));
}
function localMesh(mesh: THREE.Mesh, relative: THREE.Object3D) {
  const copy = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  copy.applyMatrix4(relative.matrixWorld.clone().invert().multiply(mesh.matrixWorld));
  copy.updateMatrixWorld(true);
  return copy;
}
function front(mesh: THREE.Mesh, x: number, y: number) {
  const hits = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh, false);
  expect(hits.length).toBeGreaterThan(0);
  return hits[0].point.z;
}
function samples(mesh: THREE.Mesh, relative: THREE.Object3D) {
  const points = vertices(mesh, relative), index = mesh.geometry.getIndex()!;
  const result = [...points];
  for (let i = 0; i < index.count; i += 3) {
    const a = points[index.getX(i)], b = points[index.getX(i + 1)], c = points[index.getX(i + 2)];
    result.push(a.clone().add(b).add(c).multiplyScalar(1 / 3), a.clone().lerp(b, .5), b.clone().lerp(c, .5), c.clone().lerp(a, .5));
  }
  return result;
}

describe("surface regression controls", () => {
  it("detects the original lip ribbon behind the sculpted head", () => {
    const data = headMeshData(faceShape(0));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setIndex(data.indices);
    const head = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    head.updateMatrixWorld(true);
    expect(front(head, 0, -.068)).toBeCloseTo(.113, 6);
    for (const mouth of MOUTH_SHAPES) for (const lip of ["upper", "lower"] as const) {
      const ribbon = facialRibbonMesh(mouthPoints(mouth, lip), lip === "upper" ? mouth.upperThickness : mouth.lowerThickness);
      for (let i = 0; i < ribbon.positions.length; i += 3) {
        expect(.1 + ribbon.positions[i + 2]).toBeLessThan(front(head, ribbon.positions[i] * .84, -.068 + ribbon.positions[i + 1] * .88));
      }
    }
  });
});

for (let facePreset = 0; facePreset < 6; facePreset++) {
  describe(`face surface ${facePreset}`, () => {
    it("keeps every lip vertex and triangle on the actual head, preserving six mouth contours", () => {
      const signatures = new Set<string>();
      for (let mouthPreset = 0; mouthPreset < MOUTH_SHAPES.length; mouthPreset++) {
        const scene = render({ character: { appearance: { facePreset, mouthPreset } } });
        const face = scene.getObjectByName("face")!;
        const head = localMesh(scene.getObjectByName("head-surface") as THREE.Mesh, face);
        expect(Array.from(head.geometry.getAttribute("position").array)).toEqual(headMeshData(faceShape(facePreset)).positions.map(Math.fround));
        const mouth = scene.getObjectByName("mouth")!;
        const geometry: number[] = [];
        for (const [lipIndex, lip] of ["upper", "lower"].entries()) {
          const mesh = mouth.children[lipIndex] as THREE.Mesh;
          const expected = facialRibbonMesh(mouthPoints(MOUTH_SHAPES[mouthPreset], lip as "upper" | "lower"), lip === "upper" ? MOUTH_SHAPES[mouthPreset].upperThickness : MOUTH_SHAPES[mouthPreset].lowerThickness);
          vertices(mesh, face).forEach((point, i) => {
            expect(point.x).toBeCloseTo(expected.positions[i * 3] * .84, 6);
            expect(point.y).toBeCloseTo(-.068 + expected.positions[i * 3 + 1] * .88, 6);
            geometry.push(point.x, point.y, point.z);
          });
          for (const point of samples(mesh, face)) {
            const clearance = point.z - front(head, point.x, point.y);
            expect(clearance).toBeGreaterThan(.0001);
            expect(clearance).toBeLessThan(.003);
          }
        }
        signatures.add(JSON.stringify(geometry));
      }
      expect(signatures.size).toBe(6);
    });
    it("keeps all six mirrored brow surfaces close to the actual forehead", () => {
      const signatures = new Set<string>();
      for (let browPreset = 0; browPreset < BROW_SHAPES.length; browPreset++) {
        const scene = render({ character: { appearance: { facePreset, browPreset } } });
        const face = scene.getObjectByName("face")!;
        const head = localMesh(scene.getObjectByName("head-surface") as THREE.Mesh, face);
        for (const side of [-1, 1]) {
          const mesh = scene.getObjectByName(`brow-${side}`)!.children[0] as THREE.Mesh;
          for (const point of samples(mesh, face)) {
            const clearance = point.z - front(head, point.x, point.y);
            expect(clearance).toBeGreaterThan(.0001);
            expect(clearance).toBeLessThan(.003);
          }
          if (side === 1) signatures.add(JSON.stringify(vertices(mesh, face)));
        }
      }
      expect(signatures.size).toBe(6);
    });
    it("keeps all six eye centers visible without floating off their sockets", () => {
      for (let eyePreset = 0; eyePreset < EYE_SHAPES.length; eyePreset++) {
        const scene = render({ character: { appearance: { facePreset, eyePreset } } });
        const face = scene.getObjectByName("face")!;
        const head = localMesh(scene.getObjectByName("head-surface") as THREE.Mesh, face);
        for (const side of [-1, 1]) {
          const eye = scene.getObjectByName(`eye-${side}`)!;
          const point = eye.getWorldPosition(new THREE.Vector3()).applyMatrix4(face.matrixWorld.clone().invert());
          const sclera = localMesh(eye.children[0] as THREE.Mesh, face);
          const clearance = front(sclera, point.x, point.y) - front(head, point.x, point.y);
          expect(clearance).toBeGreaterThan(.001);
          expect(clearance).toBeLessThan(.01);
        }
      }
    });
  });
}

const sleeved = Object.values(WEARABLE_SHAPES).filter(shape => ["top", "outerwear"].includes(shape.layer) && shape.parts.some(part => part.anchor === "leftArm" && part.kind === "taper"));
const sphere = new THREE.SphereGeometry(1, 24, 18);
const spherePositions = sphere.getAttribute("position"), sphereIndex = sphere.getIndex()!;
const planes: THREE.Plane[] = [];
for (let i = 0; i < sphereIndex.count; i += 3) {
  const points = [0, 1, 2].map(n => new THREE.Vector3().fromBufferAttribute(spherePositions, sphereIndex.getX(i + n)));
  const plane = new THREE.Plane().setFromCoplanarPoints(points[0], points[1], points[2]);
  if (plane.normal.lengthSq() > .5) planes.push(plane);
}

describe("sleeve shoulder coverage", () => {
  const variants = sleeved.flatMap(shape => ["slim", "balanced", "athletic"].flatMap(body => (["neutral", "masculine", "feminine"] as const).map(presentation => ({ model: shape.model, shape, body, presentation }))));
  it.each(variants)("encloses shoulder skin for $model body=$body presentation=$presentation", ({ shape, body, presentation }) => {
    const item = COSMETICS.find(item => item.model === shape.model)!;
    for (const shoulderWidth of [.8, 1, 1.2]) {
      const scene = render({ character: { appearance: { body, presentation, shoulderWidth } }, cosmetics: { [shape.layer === "outerwear" ? "outerwear" : "top"]: item.id } });
      for (const side of ["left", "right"]) {
        const arm = scene.getObjectByName(`${side}-arm`)!;
        const skin = arm.children[0] as THREE.Mesh;
        const wearables = arm.getObjectByName(`wearables-${side}Arm`)!;
        const pieceOffset = shape.layer === "outerwear" ? WEARABLE_SHAPES.tee.parts.filter(part => part.anchor === `${side}Arm`).length : 0;
        const cap = wearables.children[pieceOffset] as THREE.Mesh;
        expect(cap.geometry).toBe(skin.geometry);
        const points = vertices(skin, cap);
        let maxDistance = -Infinity;
        for (const point of points) for (const plane of planes) maxDistance = Math.max(maxDistance, plane.distanceToPoint(point));
        expect(maxDistance).toBeLessThan(-.001);
        const taper = wearables.children[pieceOffset + 1] as THREE.Mesh;
        const capBounds = new THREE.Box3().setFromPoints(vertices(cap, arm));
        const taperBounds = new THREE.Box3().setFromPoints(vertices(taper, arm));
        expect(capBounds.min.y).toBeLessThan(taperBounds.max.y - .05);
        if (shape.parts.find(part => part.anchor === "leftArm" && part.kind === "taper")!.size[1] >= .28) {
          const localCap = localMesh(cap, arm), localTaper = localMesh(taper, arm);
          const skinTaper = localMesh(arm.children[1] as THREE.Mesh, arm);
          const limb = bodyShape(body, presentation).limb;
          for (const y of [-.1, -.085, -.07, -.055, -.04, -.03]) for (let angle = 0; angle < 24; angle++) {
            const direction = new THREE.Vector3(Math.sin(angle * Math.PI / 12), 0, Math.cos(angle * Math.PI / 12));
            const origin = direction.clone().multiplyScalar(.2 * limb).add(new THREE.Vector3(0, y, .002));
            const ray = new THREE.Raycaster(origin, direction.clone().negate());
            const skinHit = ray.intersectObject(skinTaper, false)[0];
            if (!skinHit) continue;
            const cloth = [...ray.intersectObject(localCap, false), ...ray.intersectObject(localTaper, false)];
            expect(cloth.length).toBeGreaterThan(0);
            expect(Math.min(...cloth.map(hit => hit.distance))).toBeLessThan(skinHit.distance - .0001);
          }
        }
      }
    }
  });
  it("retains sleeveless geometry and every independent wearable model", () => {
    const expansionModels = [...Object.keys(LOWER_V7_SHAPES), ...Object.keys(UPPER_V7_SHAPES), ...Object.keys(STARTER_POLO_V7_SHAPES), ...Object.keys(ACCESSORY_V7_SHAPES)];
    expect(new Set(expansionModels).size).toBe(expansionModels.length);
    expect(Object.keys(WEARABLE_SHAPES).filter(model => !expansionModels.includes(model))).toHaveLength(33);
    expect(Object.keys(WEARABLE_SHAPES)).toHaveLength(33 + expansionModels.length);
    expect(WEARABLE_SHAPES["utility-vest"].parts.every(part => !part.anchor.endsWith("Arm"))).toBe(true);
  });
});
