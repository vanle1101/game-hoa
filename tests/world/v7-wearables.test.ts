import { describe, expect, it, vi } from "vitest";
import { createElement, isValidElement, type ReactNode } from "react";
import * as THREE from "three";
import { COSMETICS } from "@/character/catalog";
import { LOWER_V7_COSMETICS, LOWER_V7_SHAPES } from "@/character/fashion-lower-v7";
import { UPPER_V7_COSMETICS, UPPER_V7_SHAPES } from "@/character/fashion-upper-v7";
import { STARTER_POLO_V7_COSMETICS, STARTER_POLO_V7_SHAPES } from "@/character/starter-polo-v7";
import { ACCESSORY_V7_COSMETICS, ACCESSORY_V7_SHAPES } from "@/character/fashion-accessory-v7";

const legacyModels = ["jacket", "hoodie", "tee", "turtleneck", "utility-vest", "cropped-jacket", "shell", "overshirt", "long-coat", "trench", "parka", "bomber", "rain-shell", "tapered", "cargo", "wide-leg", "pleated", "sneakers", "boots", "high-tops", "loafers", "cap", "beanie", "visor", "wrist-device", "scarf", "holo-badge", "holo-scarf", "ear-cuff", "gloves", "backpack", "mask", "chain-collar"];
const expansionShapes = { ...LOWER_V7_SHAPES, ...UPPER_V7_SHAPES, ...STARTER_POLO_V7_SHAPES, ...ACCESSORY_V7_SHAPES };
const expansionCosmetics = [...LOWER_V7_COSMETICS, ...UPPER_V7_COSMETICS, ...STARTER_POLO_V7_COSMETICS, ...ACCESSORY_V7_COSMETICS];
import { CharacterModel, type CharacterModelProps } from "@/components/world/CharacterModel";
import { bodyShape, faceShape, HAIR_STYLES, hairCapMeshData, hairStrandMeshData, headMeshData, noseMeshData, taperMeshData } from "@/components/world/character-shape";
import { BROW_SHAPES, EAR_SHAPES, EYE_SHAPES, MOUTH_SHAPES, NOSE_SHAPES, browPoints, earMesh, facialPreset, facialRibbonMesh, mouthPoints } from "@/components/world/facial-shape";
import { hairCoverage, shellMeshData, silhouetteWidth, WEARABLE_GEOMETRY_COUNTS, WEARABLE_SHAPES, wardrobeGeometrySummary, wearableDetail, wearableGeometryCount, wearableGeometrySignature, wearableShape } from "@/components/world/wearable-shapes";

vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: () => {},
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

describe("V7 procedural wearable geometry", () => {
  it("gives every catalog cosmetic a multi-part wearable shape and distinct silhouette per model", () => {
    const summary = wardrobeGeometrySummary(COSMETICS);

    expect(summary.catalogItems).toBe(COSMETICS.length);
    expect(summary.modeledItems).toBe(COSMETICS.length);
    expect(summary.unknownModels).toEqual([]);
    expect(summary.distinctGeometrySets).toBe(new Set(COSMETICS.map(item => item.model)).size);
    expect(legacyModels).toHaveLength(33);
    expect(new Set(legacyModels.map(wearableGeometrySignature)).size).toBe(33);
    expect(Object.keys(WEARABLE_SHAPES).sort()).toEqual([...legacyModels, ...Object.keys(expansionShapes)].sort());
    expect(summary.distinctGeometrySets).toBe(33 + Object.keys(expansionShapes).length);
    expect(COSMETICS).toHaveLength(44 + expansionCosmetics.length);
    for (const item of expansionCosmetics) expect(COSMETICS.find(candidate => candidate.id === item.id)).toEqual(item);
    for (const [model, shape] of Object.entries(expansionShapes)) expect(WEARABLE_SHAPES[model]).toEqual(shape);
    expect(summary.distinctPaidGeometrySets).toBeGreaterThanOrEqual(21);

    for (const item of COSMETICS) {
      expect(wearableGeometryCount(item.model)).toBeGreaterThanOrEqual(2);
      expect(WEARABLE_GEOMETRY_COUNTS[item.model]).toBe(wearableShape(item.model)?.parts.length);
      expect(wearableDetail(item.model).length).toBeGreaterThan(0);
    }
  });

  it("covers all 10 catalog cosmetic slots plus eyewear/bottoms/legacy-coat support", () => {
    const slots = ["top", "bottom", "shoes", "headwear", "accessory", "outerwear", "gloves", "face", "back", "jewelry"] as const;
    for (const slot of slots) {
      const slotItems = COSMETICS.filter(item => item.slot === slot);
      expect(slotItems.length).toBeGreaterThan(0);
      for (const item of slotItems) {
        expect(wearableShape(item.model)).toBeDefined();
      }
    }

    const legacyJacket = COSMETICS.find(item => item.id === "runner-jacket");
    const legacyCoat = COSMETICS.find(item => item.id === "violet-coat");
    expect(legacyJacket?.slot).toBe("top");
    expect(legacyCoat?.slot).toBe("top");
    expect(legacyCoat?.model).toBe("long-coat");
    expect(wearableGeometrySignature("jacket")).not.toBe(wearableGeometrySignature("long-coat"));
    expect(wearableGeometrySignature("tapered")).not.toBe(wearableGeometrySignature("cargo"));
    expect(wearableGeometrySignature("wide-leg")).not.toBe(wearableGeometrySignature("pleated"));
  });

  it("constructs closed garment shells and flattens hair crowns under headwear without bald side walls", () => {
    const jacketShell = wearableShape("jacket")?.parts.find(part => part.kind === "shell");
    const coatShell = wearableShape("long-coat")?.parts.find(part => part.kind === "shell");
    expect(jacketShell?.sections?.length).toBeGreaterThanOrEqual(5);
    expect(coatShell?.opening).toBeGreaterThan(0);

    const mesh = shellMeshData(jacketShell!.sections!, jacketShell!.opening, bodyShape("athletic", "feminine"));
    expect(mesh.positions.length).toBeGreaterThan(200);
    expect(mesh.indices.length).toBeGreaterThan(300);
    expect(silhouetteWidth(1.12, bodyShape("athletic", "feminine"))).toBeLessThan(silhouetteWidth(1.44, bodyShape("athletic", "masculine")));

    for (const style of HAIR_STYLES) {
      const uncovered = hairCoverage(style);
      const underCap = hairCoverage(style, "cap");
      const underVisor = hairCoverage(style, "visor");
      expect(uncovered.covered).toBe(false);
      expect(underCap.covered).toBe(true);
      expect(underCap.crownScale).toBeLessThan(1);
      expect(underCap.showLocks).toBe(false);
      expect(underCap.keepSideLengths).toBe(true);
      expect(underVisor.covered).toBe(false);
    }
  });

  it("builds sculpted head, hair, nose, and tapered limb meshes with valid indexed geometry", () => {
    for (let preset = 0; preset < 6; preset++) {
      const shape = faceShape(preset);
      const head = headMeshData(shape);
      expect(head.positions.length % 3).toBe(0);
      expect(head.positions.length / 3).toBeGreaterThan(400);
      expect(head.indices.length).toBeGreaterThan(2000);
      expect(Math.max(...head.indices)).toBeLessThan(head.positions.length / 3);
    }

    const nose = noseMeshData(facialPreset(NOSE_SHAPES, 0));
    expect(nose.positions.length / 3).toBeGreaterThan(60);
    expect(nose.indices.length).toBeGreaterThan(200);

    const limb = taperMeshData(.092, .068, .4);
    expect(limb.positions.length / 3).toBeGreaterThan(150);
    expect(limb.indices.length).toBeGreaterThan(700);

    const capUncovered = hairCapMeshData(1, false);
    const capUndercut = hairCapMeshData(.45, true);
    const strand = hairStrandMeshData();
    expect(capUncovered.positions.length).toBe(capUndercut.positions.length);
    expect(capUncovered.indices.length).toBeGreaterThan(1000);
    expect(strand.indices.length).toBeGreaterThan(300);
  });

  it("integrates sloped shoulder transition, organic neck base, and overlapping sleeve caps into the rig", () => {
    const jacketParts = wearableShape("jacket")!.parts;
    const jacketShell = jacketParts.find(p => p.kind === "shell")!;
    const sections = jacketShell.sections!;
    const chestSection = sections.find(s => Math.abs(s.y - 1.395) < .02)!;
    const shoulderSection = sections.find(s => Math.abs(s.y - 1.44) < .02)!;
    const slopeSection = sections.find(s => Math.abs(s.y - 1.478) < .02)!;
    const neckSection = sections.find(s => s.y > 1.5)!;

    expect(shoulderSection.width).toBeGreaterThan(chestSection.width);
    expect(slopeSection.width).toBeLessThan(shoulderSection.width);
    expect(neckSection.width).toBeLessThan(slopeSection.width);

    const leftArmParts = jacketParts.filter(p => p.anchor === "leftArm");
    const rightArmParts = jacketParts.filter(p => p.anchor === "rightArm");
    expect(leftArmParts[0]?.kind).toBe("ellipsoid");
    expect(leftArmParts[0]?.at[0]).toBeGreaterThan(0);
    expect(rightArmParts[0]?.at[0]).toBeLessThan(0);
    expect(leftArmParts[0]?.size[0]).toBeLessThan(.07);

    const scene = renderRig({ paused: true });
    const headGroup = scene.getObjectByName("head")!;
    const leftArmGroup = scene.getObjectByName("left-arm")!;
    const leftThighGroup = scene.getObjectByName("left-thigh")!;
    const leftShinGroup = scene.getObjectByName("left-shin")!;

    expect(headGroup.position.toArray()).toEqual([0, 1.662, .006]);
    expect(leftArmGroup.position.y).toBeCloseTo(1.425, 3);
    expect(leftThighGroup.position.y).toBeCloseTo(.958, 3);
    expect(leftShinGroup.position.y).toBeCloseTo(-.393, 3);
  });

  it("aligns trousers waist/inseam and grounds footwear soles near y=0 across shoe models", () => {
    for (const trouserModel of ["tapered", "cargo", "wide-leg", "pleated"] as const) {
      const spec = wearableShape(trouserModel)!;
      const hipPart = spec.parts.find(p => p.anchor === "torso" && p.kind === "ellipsoid");
      const thighTaper = spec.parts.find(p => p.anchor === "leftThigh" && p.kind === "taper");
      const shinTaper = spec.parts.find(p => p.anchor === "leftShin" && p.kind === "taper");
      expect(hipPart).toBeDefined();
      expect(thighTaper?.size[0]).toBeGreaterThanOrEqual(.106);
      expect(shinTaper?.size[2]).toBeGreaterThanOrEqual(.064);
    }

    const hipY = .958;
    const kneeOffsetY = -.393;
    for (const shoeModel of ["sneakers", "boots", "high-tops", "loafers"] as const) {
      const spec = wearableShape(shoeModel)!;
      const shinParts = spec.parts.filter(p => p.anchor === "leftShin");
      const lowestBottom = Math.min(...shinParts.map(p => hipY + kneeOffsetY + p.at[1] - p.size[1] / 2));
      expect(lowestBottom).toBeGreaterThanOrEqual(-.012);
      expect(lowestBottom).toBeLessThanOrEqual(.012);
    }
  });

  it("preserves equipment accessory1/accessory2 slot swap compatibility and weapon anchor attachment", () => {
    const scene = renderRig({
      paused: true,
      equipment: {
        head: "neural-visor",
        chest: "aegis-jacket",
        gloves: "pulse-gloves",
        boots: "drift-boots",
        accessory2: "focus-chip",
        accessory1: "memory-ring",
        weapon: "twin-stingers",
      },
    });

    expect(scene.getObjectByName("equipment:neural-visor")).toBeDefined();
    expect(scene.getObjectByName("equipment:aegis-jacket")).toBeDefined();
    expect(scene.getObjectByName("equipment:focus-chip")).toBeDefined();
    expect(scene.getObjectByName("equipment:memory-ring")).toBeDefined();
    expect(scene.getObjectByName("rightHand")).toBeDefined();
    expect(scene.getObjectByName("leftHand")).toBeDefined();
  });

  it("builds distinct 3D facial feature geometry for eyes, brows, noses, ears, and mouths", () => {
    expect(EYE_SHAPES).toHaveLength(6);
    expect(BROW_SHAPES).toHaveLength(6);
    expect(NOSE_SHAPES).toHaveLength(6);
    expect(EAR_SHAPES).toHaveLength(4);
    expect(MOUTH_SHAPES).toHaveLength(6);

    const browSignatures = new Set(BROW_SHAPES.map(shape => JSON.stringify(facialRibbonMesh(browPoints(shape), shape.thickness).positions.map(n => Number(n.toFixed(4))))));
    const earSignatures = new Set(EAR_SHAPES.map(shape => JSON.stringify(earMesh(shape).positions.map(n => Number(n.toFixed(4))))));
    const mouthSignatures = new Set(MOUTH_SHAPES.map(shape => JSON.stringify(facialRibbonMesh(mouthPoints(shape, "upper"), shape.upperThickness).positions.map(n => Number(n.toFixed(4))))));

    expect(browSignatures.size).toBe(6);
    expect(earSignatures.size).toBe(4);
    expect(mouthSignatures.size).toBe(6);
    expect(facialPreset(NOSE_SHAPES, "aquiline").bridgeDepth).toBeGreaterThan(facialPreset(NOSE_SHAPES, "button").bridgeDepth);
  });
});
