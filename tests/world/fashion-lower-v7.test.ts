import { describe, expect, it } from "vitest";
import { BoxGeometry, Euler, Matrix4, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { COSMETICS } from "../../src/character/catalog";
import { LOWER_V7_COSMETICS, LOWER_V7_SHAPES } from "../../src/character/fashion-lower-v7";
import { bodyShape, taperMeshData, type BodyShape } from "../../src/components/world/character-shape";
import { shellMeshData, silhouetteWidth, WEARABLE_SHAPES, type WearablePart, type WearableShape } from "../../src/components/world/wearable-shapes";

const shapes = Object.values(LOWER_V7_SHAPES);
const lowerAnchors = ["torso", "leftThigh", "rightThigh", "leftShin", "rightShin"];
const poses = [[0, 0], [.46, .6], [-.46, 0], [-1.5, 1.5], [.55, .65], [-.4, .5]];

function localVertices(p: WearablePart, body: BodyShape): Vector3[] {
  if (p.kind === "shell") {
    const mesh = shellMeshData(p.sections!, p.opening, body);
    expect(mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3)).toBe(true);
    return Array.from({ length: mesh.positions.length / 3 }, (_, i) => new Vector3().fromArray(mesh.positions, i * 3));
  }
  const width = p.anchor === "torso" ? silhouetteWidth(p.at[1], body) : 1;
  const limb = p.anchor.endsWith("Thigh") ? body.limb : 1;
  const size = [p.size[0] * width * limb, p.size[1], p.size[2] * limb];
  let points: Vector3[];
  if (p.kind === "taper") {
    const mesh = taperMeshData(size[0], size[2], size[1]);
    expect(mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3)).toBe(true);
    points = Array.from({ length: mesh.positions.length / 3 }, (_, i) => new Vector3().fromArray(mesh.positions, i * 3));
  } else {
    const geometry = p.kind === "box" ? new BoxGeometry(1, 1, 1) : p.kind === "ring" ? new TorusGeometry(1, .14, 10, 32) : new SphereGeometry(1, 24, 18);
    const vertices = geometry.getAttribute("position");
    points = Array.from({ length: vertices.count }, (_, i) => new Vector3().fromBufferAttribute(vertices, i).multiply(new Vector3(...size)));
    geometry.dispose();
  }
  const rotation = new Euler(...(p.rotation ?? [0, 0, 0]));
  return points.map(point => point.applyEuler(rotation).add(new Vector3(p.at[0] * width, p.at[1], p.at[2])));
}

function fittedVertices(p: WearablePart, body: BodyShape, hipAngle = 0, kneeAngle = 0): Vector3[] {
  const hip = new Matrix4().makeRotationX(hipAngle);
  const knee = new Matrix4().makeRotationX(kneeAngle);
  const sign = p.anchor.startsWith("left") ? -1 : 1;
  return localVertices(p, body).map(point => {
    if (p.anchor.endsWith("Shin")) point.applyMatrix4(knee).add(new Vector3(0, -.393, 0));
    if (p.anchor !== "torso") point.applyMatrix4(hip).add(new Vector3(sign * .102 * body.hip, .958, 0));
    return point.multiply(new Vector3(body.width, body.height, body.depth));
  });
}

function structuralSignature(shape: WearableShape): string {
  const counts: Record<string, number> = {};
  for (const p of shape.parts) {
    const key = `${p.anchor}:${p.kind}:${p.sections?.length ?? 0}:${Boolean(p.rotation)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return JSON.stringify(Object.entries(counts).sort());
}

function geometrySignature(shape: WearableShape): string {
  return JSON.stringify(shape.parts.map(p => ({ anchor: p.anchor, kind: p.kind, at: p.at, size: p.size, rotation: p.rotation, sections: p.sections, opening: p.opening })));
}

function forModel(model: string): WearableShape {
  const result = LOWER_V7_SHAPES[`v7-${model}`];
  expect(result, model).toBeDefined();
  return result;
}

function leftParts(model: string): readonly WearablePart[] {
  return forModel(model).parts.filter(p => p.anchor === "leftShin");
}

describe("V7 lower garment expansion", () => {
  it("adds exactly nine paid bottoms and nine paid shoes with localized, complete catalog metadata", () => {
    expect(LOWER_V7_COSMETICS).toHaveLength(18);
    expect(shapes).toHaveLength(18);
    for (const slot of ["bottom", "shoes"] as const) {
      const added = LOWER_V7_COSMETICS.filter(item => item.slot === slot);
      const existing = COSMETICS.filter(item => item.slot === slot && item.price > 0 && !item.id.startsWith("v7-"));
      expect(added).toHaveLength(9);
      expect(existing).toHaveLength(3);
      expect([...existing, ...added]).toHaveLength(12);
    }
    for (const item of LOWER_V7_COSMETICS) {
      expect(item.id).toMatch(/^v7-/);
      expect(item.model).toMatch(/^v7-/);
      expect(item.name).toMatch(/[À-ỹ]/u);
      expect(item.description).toMatch(/[À-ỹ]/u);
      expect(item.description.length).toBeGreaterThan(35);
      expect(Number.isFinite(item.price) && item.price > 0).toBe(true);
      expect(Number.isInteger(item.level) && item.level! > 0).toBe(true);
      expect(["common", "uncommon", "rare", "epic", "legendary", "mythic"]).toContain(item.rarity);
      expect(item.starter).toBe(false);
      expect(item.assetId).toBe(`wearable.${item.model}`);
      expect(LOWER_V7_SHAPES[item.model].layer).toBe(item.slot);
      expect(COSMETICS.filter(old => !old.id.startsWith("v7-")).some(old => old.id === item.id || old.assetId === item.assetId || old.model === item.model)).toBe(false);
    }
    for (const field of ["id", "model", "assetId", "name"] as const) expect(new Set(LOWER_V7_COSMETICS.map(item => item[field])).size).toBe(18);
  });

  it("has distinct geometry and primitive topology without considering labels, colors, materials, or size aliases", () => {
    expect(new Set(shapes.map(geometrySignature)).size).toBe(18);
    expect(new Set(shapes.map(structuralSignature)).size).toBe(18);
    const existing = Object.values(WEARABLE_SHAPES).filter(shape => !shape.model.startsWith("v7-") && (shape.layer === "bottom" || shape.layer === "shoes"));
    for (const shape of shapes) {
      expect(shape.geometryCount).toBe(shape.parts.length);
      expect(shape.parts.length).toBeGreaterThan(6);
      expect(shape.detail.length).toBeGreaterThanOrEqual(3);
      for (const old of existing) expect(structuralSignature(shape)).not.toBe(structuralSignature(old));
    }
  });

  it("uses finite anchor-local parts and bounded fitted geometry for every body and presentation", () => {
    for (const bodyName of ["balanced", "slim", "athletic"]) for (const presentation of ["neutral", "masculine", "feminine"] as const) {
      const body = bodyShape(bodyName, presentation);
      for (const shape of shapes) for (const p of shape.parts) {
        expect(lowerAnchors).toContain(p.anchor);
        expect(p.at.every(Number.isFinite)).toBe(true);
        expect(p.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
        expect((p.rotation ?? []).every(Number.isFinite)).toBe(true);
        if (p.kind === "shell") {
          expect(p.anchor).toBe("torso");
          expect(p.at).toEqual([0, 0, 0]);
          expect(p.rotation).toBeUndefined();
          expect(p.sections!.every((section, index, list) => section.width > 0 && section.depth > 0 && Number.isFinite(section.y) && (index === 0 || section.y > list[index - 1].y))).toBe(true);
        }
        const vertices = fittedVertices(p, body);
        expect(vertices.every(vertex => vertex.toArray().every(Number.isFinite)), shape.model).toBe(true);
        expect(vertices.every(vertex => Math.abs(vertex.x) < .5 && Math.abs(vertex.z) < .4 && vertex.y >= -.000001 && vertex.y < 1.2), `${shape.model}:${p.anchor}:${p.kind}`).toBe(true);
      }
    }
  });

  it("grounds both soles at the shin origin plus the footwear offset, using actual primitive bounds", () => {
    for (const bodyName of ["balanced", "slim", "athletic"]) for (const presentation of ["neutral", "masculine", "feminine"] as const) {
      const body = bodyShape(bodyName, presentation);
      for (const shape of shapes.filter(shape => shape.layer === "shoes")) {
        expect(new Set(shape.parts.map(p => p.anchor))).toEqual(new Set(["leftShin", "rightShin"]));
        for (const anchor of ["leftShin", "rightShin"]) {
          const vertices = shape.parts.filter(p => p.anchor === anchor).flatMap(p => fittedVertices(p, body));
          const minY = Math.min(...vertices.map(p => p.y));
          expect(minY, `${shape.model} ${anchor}`).toBeCloseTo(0, 6);
          for (const height of [.86, 1, 1.15]) expect(minY * height).toBeCloseTo(0, 6);
          expect(Math.max(...vertices.map(p => p.y))).toBeLessThan(.49);
        }
      }
    }
  });

  it("keeps hip, knee and ankle coverage and moves leg garments with independent articulated anchors", () => {
    for (const shape of shapes.filter(shape => shape.layer === "bottom")) {
      expect(new Set(shape.parts.map(p => p.anchor))).toEqual(new Set(lowerAnchors));
      for (const bodyName of ["balanced", "slim", "athletic"]) for (const presentation of ["neutral", "masculine", "feminine"] as const) {
        const body = bodyShape(bodyName, presentation);
        for (const sign of ["left", "right"]) {
          const thigh = shape.parts.find(p => p.anchor === `${sign}Thigh` && p.kind === "taper")!;
          const knee = shape.parts.find(p => p.anchor === `${sign}Thigh` && p.kind === "ellipsoid" && p.at[1] < -.35)!;
          const shin = shape.parts.find(p => p.anchor === `${sign}Shin` && p.kind === "taper")!;
          expect(thigh.at[1] + thigh.size[1] / 2).toBeGreaterThan(.008);
          expect(thigh.at[1] - thigh.size[1] / 2).toBeLessThan(-.392);
          expect(knee.at[1] + knee.size[1]).toBeGreaterThan(-.326);
          expect(knee.at[1] - knee.size[1]).toBeLessThan(-.434);
          expect(shin.at[1] + shin.size[1] / 2).toBeGreaterThan(0);
          expect(shin.at[1] - shin.size[1] / 2).toBeLessThan(-.438);
          const cloth = taperMeshData(thigh.size[0] * body.limb, thigh.size[2] * body.limb, thigh.size[1]);
          const skin = taperMeshData(.092 * body.limb, .068 * body.limb, .4);
          const radii = Array.from({ length: skin.positions.length / 3 }, (_, i) => i * 3);
          expect(radii.every(index => Math.hypot(cloth.positions[index], cloth.positions[index + 2]) > Math.hypot(skin.positions[index], skin.positions[index + 2]))).toBe(true);
          for (const [hipAngle, kneeAngle] of poses) {
            const moved = fittedVertices(shin, body, hipAngle, kneeAngle);
            expect(moved.every(point => point.toArray().every(Number.isFinite))).toBe(true);
            if (hipAngle !== 0) expect(moved[0].distanceTo(fittedVertices(shin, body)[0])).toBeGreaterThan(.01);
          }
        }
      }
    }
  });

  it("models wrap, pleat, cargo, asymmetric, segmented, flared, riding, culotte and harness cuts", () => {
    const wrap = forModel("wrap-skirt").parts.filter(p => p.kind === "box" && p.at[2] > .13);
    expect(wrap.some(p => p.rotation![2] < 0)).toBe(true);
    expect(wrap.some(p => p.rotation![2] > 0)).toBe(true);
    const pleats = forModel("fan-pleat-skirt").parts.filter(p => p.kind === "box" && p.size[1] === .32);
    expect(pleats).toHaveLength(10);
    expect(new Set(pleats.map(p => p.rotation![1])).size).toBe(5);
    expect(forModel("cargo-jogger").parts.filter(p => p.kind === "box" && p.size[1] === .14)).toHaveLength(2);
    expect(forModel("asymmetric-drape").parts.some(p => p.anchor === "rightShin" && p.kind === "box")).toBe(true);
    expect(forModel("asymmetric-drape").parts.some(p => p.anchor === "leftShin" && p.kind === "box")).toBe(false);
    expect(forModel("tech-panel-skirt").parts.filter(p => p.kind === "box" && p.size[0] === .082)).toHaveLength(6);
    expect(forModel("split-flare").parts.filter(p => p.anchor.endsWith("Shin") && p.kind === "taper" && p.size[2] > p.size[0])).toHaveLength(4);
    expect(forModel("riding-breeches").parts.filter(p => p.anchor.endsWith("Shin") && p.kind === "ring")).toHaveLength(6);
    expect(forModel("box-culottes").parts.filter(p => p.kind === "box" && p.size[0] === .265)).toHaveLength(2);
    expect(forModel("orbit-harness-pants").parts.filter(p => p.kind === "ring")).toHaveLength(4);
  });

  it("models physically different soles, shafts, toes and closures rather than recolored shoes", () => {
    const runnerSoles = leftParts("split-runner").filter(p => p.kind === "box" && p.size[1] === .036);
    expect(runnerSoles).toHaveLength(2);
    expect(runnerSoles[0].at[2] + runnerSoles[0].size[2] / 2).toBeLessThan(runnerSoles[1].at[2] - runnerSoles[1].size[2] / 2);
    expect(leftParts("buckle-combat-boots").filter(p => p.kind === "box" && p.size[1] === .035)).toHaveLength(3);
    expect(leftParts("chelsea-pull-boots").filter(p => p.kind === "box" && p.size[1] === .128)).toHaveLength(2);
    expect(leftParts("wingtip-derby").some(p => p.kind === "box" && p.size[2] === .119)).toBe(true);
    expect(leftParts("ridge-platform").filter(p => p.kind === "box" && p.size[2] === .025)).toHaveLength(5);
    const toes = leftParts("tabi-zip").filter(p => p.kind === "ellipsoid" && p.at[2] === .112);
    expect(toes).toHaveLength(2);
    expect(toes[0].at[0] + toes[0].size[0]).toBeLessThan(toes[1].at[0] - toes[1].size[0]);
    expect(leftParts("double-monk").filter(p => p.kind === "ring")).toHaveLength(2);
    expect(leftParts("arch-wedge").some(p => p.kind === "box" && p.rotation?.[0] === .21)).toBe(true);
    expect(leftParts("armored-greaves").filter(p => p.kind === "box" && p.size[1] === .057)).toHaveLength(4);
  });
});
