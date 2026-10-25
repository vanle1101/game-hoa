import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactNode } from "react";
import * as THREE from "three";
import ts from "typescript";
import { ACCESSORY_V7_COSMETICS, ACCESSORY_V7_SHAPES } from "../../src/character/fashion-accessory-v7";
import { COSMETICS } from "../../src/character/catalog";
import { CharacterModel, type CharacterAnimation, type CharacterModelProps } from "../../src/components/world/CharacterModel";
import { bodyShape } from "../../src/components/world/character-shape";
import { hairCoverage, silhouetteWidth, WEARABLE_SHAPES, type WearablePart, type WearableShape } from "../../src/components/world/wearable-shapes";

const hooks = vi.hoisted(() => ({
  frames: [] as ((state: { clock: { elapsedTime: number } }, dt: number) => void)[],
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) hooks.cleanups.push(cleanup); },
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: (state: { clock: { elapsedTime: number } }, dt: number) => void) => hooks.frames.push(callback),
}));
vi.mock("../../src/character/catalog", async importOriginal => {
  const original = await importOriginal<typeof import("../../src/character/catalog")>();
  const { ACCESSORY_V7_COSMETICS: added } = await import("../../src/character/fashion-accessory-v7");
  return { ...original, COSMETICS: [...original.COSMETICS.filter(item => !added.some(next => next.id === item.id)), ...added] };
});
vi.mock("../../src/components/world/wearable-shapes", async importOriginal => {
  const original = await importOriginal<typeof import("../../src/components/world/wearable-shapes")>();
  const { ACCESSORY_V7_SHAPES: added } = await import("../../src/character/fashion-accessory-v7");
  return {
    ...original,
    wearableShape: (model: string | undefined) => model ? added[model] ?? original.wearableShape(model) : undefined,
    hairCoverage: (style: string, model?: string) => added[model ?? ""]?.hairAdjustment === "flatten"
      ? { style, covered: true, crownScale: .45, showLocks: false, showBun: false, keepSideLengths: true }
      : original.hairCoverage(style, model),
  };
});

type HostProps = {
  children?: ReactNode;
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  geometry?: THREE.BufferGeometry;
  args?: ConstructorParameters<typeof THREE.TorusGeometry>;
  ref?: { current: THREE.Object3D | null };
};
const allocated: { dispose(): void }[] = [];
function expand(node: ReactNode, parent: THREE.Object3D): void {
  if (Array.isArray(node)) { node.forEach(child => expand(child, parent)); return; }
  if (!isValidElement<HostProps>(node)) return;
  if (typeof node.type === "function") {
    expand((node.type as (props: HostProps) => ReactNode)(node.props), parent);
    return;
  }
  if (typeof node.type !== "string") { expand(node.props.children, parent); return; }
  if (node.type === "torusGeometry") {
    expect(parent).toBeInstanceOf(THREE.Mesh);
    const geometry = new THREE.TorusGeometry(...(node.props.args ?? []));
    (parent as THREE.Mesh).geometry.dispose();
    (parent as THREE.Mesh).geometry = geometry;
    allocated.push(geometry);
    return;
  }
  if (node.type !== "mesh" && node.type !== "group") return;
  let object: THREE.Object3D;
  if (node.type === "mesh") {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const geometry = node.props.geometry ?? new THREE.BufferGeometry();
    if (!node.props.geometry) allocated.push(geometry);
    allocated.push(material);
    object = new THREE.Mesh(geometry, material);
  } else object = new THREE.Group();
  object.name = node.props.name ?? "";
  if (node.props.position) object.position.fromArray(node.props.position);
  if (node.props.rotation) object.rotation.fromArray(node.props.rotation);
  if (node.props.scale) object.scale.fromArray(node.props.scale);
  if (node.props.ref) node.props.ref.current = object;
  parent.add(object);
  expand(node.props.children, object);
}
function render(props: CharacterModelProps = {}): THREE.Group {
  const scene = new THREE.Group();
  expand(createElement(CharacterModel, props), scene);
  scene.updateMatrixWorld(true);
  return scene;
}
function dispose(): void {
  hooks.cleanups.splice(0).forEach(cleanup => cleanup());
  allocated.splice(0).forEach(resource => resource.dispose());
  hooks.frames.length = 0;
}
afterEach(dispose);
function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
  return result;
}
function selectedMeshes(scene: THREE.Object3D, shape: WearableShape): THREE.Mesh[] {
  return [...new Set(shape.parts.map(part => part.anchor))].flatMap(anchor => {
    const candidates = meshes(scene.getObjectByName(`wearables-${anchor}`)!);
    return candidates.slice(-shape.parts.filter(part => part.anchor === anchor).length);
  });
}
function vertices(mesh: THREE.Mesh, relative?: THREE.Object3D): THREE.Vector3[] {
  const matrix = relative ? relative.matrixWorld.clone().invert().multiply(mesh.matrixWorld) : mesh.matrixWorld;
  const positions = mesh.geometry.getAttribute("position");
  expect(positions?.count).toBeGreaterThan(0);
  return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
}
const shapes = Object.values(ACCESSORY_V7_SHAPES);
const round = (n: number) => Math.round(n * 1e7 + 1e-7) / 1e7;
function signature(shape: WearableShape, normalize = false): string {
  const unit = normalize ? Math.max(...shape.parts.flatMap(part => [...part.size, ...part.at.map(Math.abs), ...(part.sections?.flatMap(section => [Math.abs(section.y), section.width, section.depth]) ?? [])])) : 1;
  return JSON.stringify(shape.parts.map(part => JSON.stringify({
    anchor: part.anchor, kind: part.kind,
    at: part.at.map(n => round(n / unit)), size: part.size.map(n => round(n / unit)),
    rotation: (part.rotation ?? [0, 0, 0]).map(round), opening: part.opening ?? 0,
    sections: part.sections?.map(section => [section.y, section.width, section.depth].map(n => round(n / unit))),
  })).sort());
}
function topology(shape: WearableShape): string {
  return JSON.stringify(shape.parts.map(part => `${part.anchor}:${part.kind}:${part.sections?.length ?? 0}`).sort());
}
function partShape(id: string): WearableShape { return ACCESSORY_V7_SHAPES[`v7-${id}`]; }

 describe("V7 accessory renderer recipes", () => {
  it("exports exactly 35 paid localized cosmetics with complete existing metadata types", () => {
    expect(ACCESSORY_V7_COSMETICS).toHaveLength(35);
    expect(shapes).toHaveLength(35);
    const counts = Object.fromEntries(["headwear", "eyewear", "gloves", "back", "jewelry"].map(slot => [slot, ACCESSORY_V7_COSMETICS.filter(item => item.slot === slot).length]));
    expect(counts).toEqual({ headwear: 6, eyewear: 8, gloves: 5, back: 5, jewelry: 11 });
    for (const field of ["id", "model", "assetId", "name"] as const) expect(new Set(ACCESSORY_V7_COSMETICS.map(item => item[field])).size).toBe(35);
    for (const item of ACCESSORY_V7_COSMETICS) {
      expect(item.id).toMatch(/^v7-/);
      expect(item.model).toBe(item.id);
      expect(item.assetId).toBe(`wearable.${item.model}`);
      expect(item.starter).toBe(false);
      expect(Number.isInteger(item.price) && item.price > 0).toBe(true);
      expect(Number.isInteger(item.level) && item.level! > 0).toBe(true);
      expect(["common", "uncommon", "rare", "epic", "legendary", "mythic"]).toContain(item.rarity);
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(item.name).toMatch(/[À-ỹ]/u);
      expect(item.description).toMatch(/[À-ỹ]/u);
      expect(item.description.length).toBeGreaterThan(35);
      expect(item.description.normalize("NFC")).toBe(item.description);
      expect(item.name.normalize("NFC")).toBe(item.name);
      expect(ACCESSORY_V7_SHAPES[item.model].model).toBe(item.model);
      expect(COSMETICS.filter(old => !old.id.startsWith("v7-")).some(old => old.id === item.id || old.model === item.model)).toBe(false);
    }
  });

  it("has only type imports, finite real parts, valid anchors and no invented runtime profile API", () => {
    const source = readFileSync(new URL("../../src/character/fashion-accessory-v7.ts", import.meta.url), "utf8");
    const ast = ts.createSourceFile("accessories.ts", source, ts.ScriptTarget.Latest, true);
    const imports = ast.statements.filter(ts.isImportDeclaration);
    expect(imports.map(node => (node.moduleSpecifier as ts.StringLiteral).text).sort()).toEqual(["../components/world/wearable-shapes", "./types"]);
    expect(imports.every(node => node.importClause?.isTypeOnly)).toBe(true);
    expect(source).not.toMatch(/CosmeticItem|AvatarBodyType|cosmeticItemSchema|WearableProfile|partsCount|nonClippingClearance/);
    for (const item of ACCESSORY_V7_COSMETICS) {
      const shape = ACCESSORY_V7_SHAPES[item.model];
      expect(shape.geometryCount).toBe(shape.parts.length);
      expect(shape.detail.length).toBeGreaterThanOrEqual(3);
      expect(shape.layer).toBe(item.slot === "headwear" ? "headwear" : ["gloves", "back"].includes(item.slot) ? "anchor" : "accessory");
      const anchors = new Set(shape.parts.map(part => part.anchor));
      if (item.slot === "gloves") expect(anchors).toEqual(new Set(["leftArm", "rightArm"]));
      if (item.slot === "headwear" || item.slot === "eyewear") expect(anchors).toEqual(new Set(["head"]));
      if (item.slot === "back") expect(anchors).toEqual(new Set(["torso"]));
      if (item.slot === "jewelry") expect(["head", "torso"]).toContain([...anchors][0]);
      for (const part of shape.parts) {
        expect(["box", "ellipsoid", "taper", "ring", "shell"]).toContain(part.kind);
        expect([...part.at, ...part.size, ...(part.rotation ?? [])].every(Number.isFinite)).toBe(true);
        expect(part.size.every(value => value > 0 && value <= 1)).toBe(true);
        expect(["primary", "secondary", "trim", "glow"]).toContain(part.colorRole);
        if (part.anchor.endsWith("Arm")) expect(part.at[1]).toBeLessThan(-.3);
      }
    }
  });

  it("is unique against every old recipe after sorting parts and removing all metadata and scale", () => {
    for (const normalized of [false, true]) {
      const signatures = shapes.map(shape => signature(shape, normalized));
      expect(new Set(signatures).size).toBe(35);
      const old = Object.values(WEARABLE_SHAPES).filter(shape => !ACCESSORY_V7_SHAPES[shape.model]);
      for (const shape of shapes) for (const other of old) expect(signature(shape, normalized), `${shape.model}/${other.model}`).not.toBe(signature(other, normalized));
    }
    expect(new Set(shapes.map(topology)).size).toBe(35);
    for (const shape of shapes) {
      const reversed: WearableShape = { ...shape, model: "different", detail: [], parts: [...shape.parts].reverse().map(part => ({ ...part, colorRole: "glow", metal: 0 })) };
      expect(signature(reversed)).toBe(signature(shape));
      const scaled: WearableShape = { ...shape, parts: shape.parts.map(part => ({ ...part, at: part.at.map(n => n * 1.5) as WearablePart["at"], size: part.size.map(n => n * 1.5) as WearablePart["size"] })) };
      expect(signature(scaled, true)).toBe(signature(shape, true));
    }
  });

  it.each(ACCESSORY_V7_COSMETICS)("renders $id through actual CharacterModel with real primitive geometry on declared anchors", item => {
    const shape = ACCESSORY_V7_SHAPES[item.model];
    const scene = render({ cosmetics: { [item.slot]: item.id }, paused: true });
    const actual = selectedMeshes(scene, shape);
    expect(actual).toHaveLength(shape.geometryCount);
    const body = bodyShape("balanced", "neutral");
    for (const anchor of new Set(shape.parts.map(part => part.anchor))) {
      const specs = shape.parts.filter(part => part.anchor === anchor);
      const mounted = meshes(scene.getObjectByName(`wearables-${anchor}`)!).slice(-specs.length);
      specs.forEach((spec, i) => {
        const mesh = mounted[i];
        expect(mesh.parent?.name).toBe(`wearables-${anchor}`);
        const width = anchor === "torso" ? silhouetteWidth(spec.at[1], body) : 1;
        expect(mesh.position.toArray()).toEqual([spec.at[0] * width, spec.at[1], spec.at[2]]);
        expect(mesh.rotation.toArray().slice(0, 3)).toEqual(spec.rotation ?? [0, 0, 0]);
        expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
        if (spec.kind === "ring") expect(mesh.geometry).toBeInstanceOf(THREE.TorusGeometry);
        if (spec.kind === "box") expect(mesh.geometry.type).toBe("BoxGeometry");
        if (spec.kind === "ellipsoid") expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
        const points = vertices(mesh);
        expect(points.every(point => point.toArray().every(Number.isFinite)), item.id).toBe(true);
        const bounds = new THREE.Box3().setFromPoints(points);
        expect(bounds.min.y).toBeGreaterThan(.85);
        expect(bounds.max.y).toBeLessThan(1.94);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(.38);
        expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(.34);
      });
    }
  });

  it("keeps bounded fitted geometry over body, presentation, shoulder and height extremes", () => {
    for (const preset of ["balanced", "slim", "athletic"]) for (const presentation of ["neutral", "feminine", "masculine"] as const) {
      for (let group = 0; group < 11; group++) {
        const chosen = ["headwear", "eyewear", "gloves", "back", "jewelry"].flatMap(slot => {
          const items = ACCESSORY_V7_COSMETICS.filter(item => item.slot === slot);
          return group < items.length ? [items[group]] : [];
        });
        const scene = render({ character: { appearance: { body: preset, presentation, shoulderWidth: group % 2 ? .85 : 1.15, height: group % 2 ? .86 : 1.15 } }, cosmetics: Object.fromEntries(chosen.map(item => [item.slot, item.id])), paused: true });
        for (const item of chosen) {
          const shape = ACCESSORY_V7_SHAPES[item.model];
          const allowed = [...new Set(shape.parts.map(part => part.anchor))];
          for (const anchor of allowed) for (const mesh of meshes(scene.getObjectByName(`wearables-${anchor}`)!)) {
            const points = vertices(mesh);
            expect(points.every(point => point.toArray().every(Number.isFinite))).toBe(true);
            const bounds = new THREE.Box3().setFromPoints(points);
            expect(bounds.min.y).toBeGreaterThan(.7);
            expect(bounds.max.y).toBeLessThan(2.3);
            expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(.5);
            expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(.4);
          }
        }
        dispose();
      }
    }
  }, 30000);

  it("leaves actual iris centers and surrounding eye rays unobstructed for every frame and face preset", () => {
    const ray = new THREE.Raycaster();
    for (const item of ACCESSORY_V7_COSMETICS.filter(item => item.slot === "eyewear")) for (let facePreset = 0; facePreset < 6; facePreset++) {
      const shape = ACCESSORY_V7_SHAPES[item.model];
      const scene = render({ character: { appearance: { facePreset } }, cosmetics: { eyewear: item.id }, paused: true });
      const head = scene.getObjectByName("head")!;
      const frame = selectedMeshes(scene, shape);
      expect(frame.some(mesh => mesh.geometry instanceof THREE.TorusGeometry) || frame.length >= 12).toBe(true);
      for (const side of [-1, 1]) {
        const eye = scene.getObjectByName(`eye-${side}`)!;
        for (const x of [-.01, 0, .01]) for (const y of [-.004, 0, .004]) {
          const target = eye.localToWorld(new THREE.Vector3(x, y, .007));
          const direction = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld);
          const origin = target.clone().addScaledVector(direction, -.2);
          ray.set(origin, direction);
          ray.far = .2;
          expect(ray.intersectObjects(frame, false), `${item.id}:face${facePreset}:${side}:${x}:${y}`).toHaveLength(0);
        }
      }
      dispose();
    }
  }, 30000);

  it("flattens hair under six distinct crowns and keeps crown geometry above the eyes", () => {
    for (const item of ACCESSORY_V7_COSMETICS.filter(item => item.slot === "headwear")) {
      const shape = ACCESSORY_V7_SHAPES[item.model];
      expect(shape.hairAdjustment).toBe("flatten");
      expect(hairCoverage("bun", item.model)).toMatchObject({ covered: true, crownScale: .45, showLocks: false, showBun: false });
      const scene = render({ cosmetics: { headwear: item.id }, paused: true });
      const head = scene.getObjectByName("head")!;
      const points = selectedMeshes(scene, shape).flatMap(mesh => vertices(mesh, head));
      expect(Math.max(...points.map(point => point.y))).toBeGreaterThan(.17);
      expect(points.filter(point => Math.abs(point.x) < .08 && point.z > .09).every(point => point.y > .055)).toBe(true);
      dispose();
    }
  });

  it("models distinct construction rather than color or scale aliases", () => {
    expect(partShape("head-patrol").parts.some(part => part.at[2] > .12 && part.size[2] > .1)).toBe(true);
    expect(partShape("head-bucket").parts.filter(part => part.kind === "ring")).toHaveLength(2);
    expect(partShape("head-beret").parts.some(part => part.kind === "ellipsoid" && part.at[0] > 0)).toBe(true);
    expect(partShape("head-knit").parts.some(part => part.kind === "ellipsoid" && part.at[1] > .22)).toBe(true);
    expect(partShape("head-flight").parts.filter(part => part.kind === "ring")).toHaveLength(2);
    expect(partShape("head-cylinder").parts.some(part => part.kind === "taper" && part.size[1] > .14)).toBe(true);
    expect(partShape("glove-gauntlet").parts.filter(part => part.at[1] < -.5)).toHaveLength(8);
    expect(partShape("glove-console").parts.filter(part => part.colorRole === "glow")).toHaveLength(2);
    expect(partShape("glove-mitten").parts.filter(part => part.kind === "ellipsoid")).toHaveLength(4);
    expect(partShape("back-sling").parts.some(part => part.at[0] !== 0 && part.at[2] < -.2)).toBe(true);
    expect(partShape("back-canisters").parts.filter(part => part.kind === "taper")).toHaveLength(2);
    expect(partShape("back-folded-fan").parts.filter(part => part.kind === "ring")).toHaveLength(2);
    expect(partShape("back-roll").parts.some(part => part.kind === "taper" && part.rotation?.[2] === Math.PI / 2)).toBe(true);
    expect(partShape("jewel-prism").parts.every(part => part.anchor === "torso")).toBe(true);
    expect(partShape("jewel-brooch").parts.some(part => part.at[0] < -.1)).toBe(true);
    expect(partShape("jewel-helix").parts.every(part => part.anchor === "head" && part.at[0] < 0)).toBe(true);
    expect(partShape("jewel-ear-bridge").parts.every(part => part.anchor === "head" && part.at[0] > 0)).toBe(true);
    expect(partShape("jewel-tassel").parts.filter(part => part.kind === "ellipsoid")).toHaveLength(8);
  });

  it("joins angled temple and necklace segments at their actual geometric endpoints", () => {
    const endpoints = (part: WearablePart) => [-1, 1].map(side => new THREE.Vector3(0, side * part.size[1] / 2, 0).applyEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))).add(new THREE.Vector3(...part.at)));
    const frame = partShape("eye-round");
    for (const side of [-1, 1]) {
      const temple = frame.parts.find(part => part.kind === "box" && Math.abs(part.at[0] - side * .113) < .00001 && part.at[2] > .1)!;
      const actual = endpoints(temple);
      for (const target of [[side * .089, .03, .137], [side * .137, .03, .08]]) expect(Math.min(...actual.map(point => point.distanceTo(new THREE.Vector3(...target))))).toBeLessThan(1e-8);
      const chain = partShape("jewel-prism").parts.find(part => part.kind === "box" && Math.abs(part.at[0] - side * .031) < .00001)!;
      const ends = endpoints(chain);
      for (const target of [[side * .062, 1.485, .105], [0, 1.342, .184]]) expect(Math.min(...ends.map(point => point.distanceTo(new THREE.Vector3(...target))))).toBeLessThan(1e-8);
    }
  });

  it("places wrist surfaces outside the real forearm and back structures behind the torso", () => {
    const wristY: Record<string, number> = { "v7-glove-fingerless": -.429, "v7-glove-gauntlet": -.389, "v7-glove-laced": -.399, "v7-glove-console": -.392, "v7-glove-mitten": -.422 };
    for (const preset of ["balanced", "slim", "athletic"]) {
      for (const item of ACCESSORY_V7_COSMETICS.filter(item => item.slot === "gloves" || item.slot === "back")) {
        const shape = ACCESSORY_V7_SHAPES[item.model];
        const scene = render({ character: { appearance: { body: preset } }, cosmetics: { [item.slot]: item.id }, paused: true });
        if (item.slot === "gloves") for (const side of ["left", "right"]) {
          const arm = scene.getObjectByName(`${side}-arm`)!;
          const skin = arm.children.find(child => child instanceof THREE.Mesh && child.position.y === -.366) as THREE.Mesh;
          expect(skin).toBeDefined();
          const origin = arm.localToWorld(new THREE.Vector3(0, wristY[item.id], .3));
          const direction = new THREE.Vector3(0, 0, -1).transformDirection(arm.matrixWorld);
          const ray = new THREE.Raycaster(origin, direction);
          const skinHit = ray.intersectObject(skin, false)[0];
          const gloveHit = ray.intersectObjects(meshes(scene.getObjectByName(`wearables-${side}Arm`)!), false)[0];
          expect(skinHit).toBeDefined();
          expect(gloveHit, item.id).toBeDefined();
          expect(skinHit.distance - gloveHit.distance, `${item.id}:${preset}:${side}`).toBeGreaterThan(.002);
        }
        if (item.slot === "back") {
          const torso = scene.getObjectByName("torso")!;
          const actual = selectedMeshes(scene, shape);
          shape.parts.forEach((part, i) => {
            if (part.at[2] < -.15) expect(Math.max(...vertices(actual[i], torso).map(point => point.z)), item.id).toBeLessThan(-.125);
          });
        }
        dispose();
      }
    }
  }, 20000);

  it("encloses every actual finger vertex inside the mitten across limb variants", () => {
    for (const preset of ["balanced", "slim", "athletic"]) {
      const scene = render({ character: { appearance: { body: preset } }, cosmetics: { gloves: "v7-glove-mitten" }, paused: true });
      for (const side of ["left", "right"]) {
        const arm = scene.getObjectByName(`${side}-arm`)!;
        const hand = arm.getObjectByName(`${side}-hand-surface`)!;
        const fingerGroups = hand.children.filter(child => child instanceof THREE.Group && child.position.y < -.48);
        expect(fingerGroups).toHaveLength(4);
        const fingers = fingerGroups.flatMap(group => meshes(group));
        const mitten = meshes(scene.getObjectByName(`wearables-${side}Arm`)!).find(mesh => mesh.geometry instanceof THREE.SphereGeometry && mesh.position.y === -.482)!;
        expect(mitten).toBeDefined();
        const center = mitten.getWorldPosition(new THREE.Vector3());
        for (const finger of fingers) for (const point of vertices(finger)) {
          const ray = new THREE.Raycaster(center, point.clone().sub(center).normalize());
          const surface = ray.intersectObject(mitten, false)[0];
          expect(surface).toBeDefined();
          expect(surface.distance - point.distanceTo(center), `${preset}:${side}`).toBeGreaterThan(.001);
        }
      }
      dispose();
    }
  });

  it.each<CharacterAnimation>(["walk", "attack", "heavy", "block", "victory", "sitting", "dodge"])("inherits %s arm animation without changing wrist-local geometry", animation => {
    const item = ACCESSORY_V7_COSMETICS.find(item => item.id === "v7-glove-gauntlet")!;
    const scene = render({ animation, cosmetics: { gloves: item.id } });
    const actual = selectedMeshes(scene, ACCESSORY_V7_SHAPES[item.model]);
    const positions = actual.map(mesh => mesh.getWorldPosition(new THREE.Vector3()));
    const local = actual.map(mesh => mesh.position.clone());
    hooks.frames[0]({ clock: { elapsedTime: .2 } }, .1);
    scene.updateMatrixWorld(true);
    expect(actual.some((mesh, i) => mesh.getWorldPosition(new THREE.Vector3()).distanceTo(positions[i]) > .001)).toBe(true);
    actual.forEach((mesh, i) => {
      expect(mesh.position.equals(local[i])).toBe(true);
      expect(vertices(mesh).every(point => point.toArray().every(Number.isFinite))).toBe(true);
    });
  });
});
