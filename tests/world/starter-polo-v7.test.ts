import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STARTER_POLO_V7_COSMETICS, STARTER_POLO_V7_SHAPES } from "../../src/character/starter-polo-v7";
import { COSMETICS } from "../../src/character/catalog";
import { bodyShape, taperMeshData } from "../../src/components/world/character-shape";
import { shellMeshData, silhouetteWidth, WEARABLE_SHAPES } from "../../src/components/world/wearable-shapes";
import type { GarmentSection, WearablePart, WearableShape } from "../../src/components/world/wearable-shapes";

const model = "v7-starter-zip-polo";
const polo = STARTER_POLO_V7_SHAPES[model];
const shell = polo.parts.find(part => part.kind === "shell")!;
const bodies = ["balanced", "slim", "athletic"] as const;
const presentations = ["neutral", "feminine", "masculine"] as const;
const skinSections: GarmentSection[] = [
  { y: .945, width: .158, depth: .096 },
  { y: 1.01, width: .154, depth: .094 },
  { y: 1.13, width: .146, depth: .092 },
  { y: 1.235, width: .164, depth: .101 },
  { y: 1.33, width: .186, depth: .108 },
  { y: 1.395, width: .198, depth: .102 },
  { y: 1.438, width: .206, depth: .095 },
  { y: 1.478, width: .124, depth: .074 },
  { y: 1.512, width: .058, depth: .052 },
];

function sectionAt(sections: readonly GarmentSection[], y: number): GarmentSection {
  const high = sections.findIndex(section => section.y >= y);
  if (high <= 0) return sections[high === -1 ? sections.length - 1 : 0];
  const a = sections[high - 1], b = sections[high], t = (y - a.y) / (b.y - a.y);
  return { y, width: a.width + (b.width - a.width) * t, depth: a.depth + (b.depth - a.depth) * t };
}

function structure(shape: WearableShape, coarse = false): string[] {
  const unit = shape.parts.find(part => part.kind === "shell")!.sections!.at(-1)!.y;
  const quantize = (n: number) => coarse ? Math.round(n / unit * 40) : Math.round(n / unit * 1e6);
  return shape.parts
    .filter(part => !coarse || part.kind === "shell" || [...part.size].sort((a, b) => b - a)[1] / unit >= .025)
    .map(part => JSON.stringify({
      anchor: part.anchor, kind: part.kind,
      at: part.kind === "shell" ? undefined : part.at.map(quantize),
      size: part.kind === "shell" ? undefined : part.size.map(quantize),
      rotation: (part.rotation ?? [0, 0, 0]).map(n => coarse ? Math.round(n * 8) : n),
      opening: part.opening ?? 0,
      sections: part.sections?.map(section => [section.y, section.width, section.depth].map(quantize)),
    })).sort();
}

function taperRadiusAt(part: WearablePart, y: number, limb: number): number {
  const localY = y - part.at[1];
  if (Math.abs(localY) > part.size[1] / 2 + 1e-9) return 0;
  const mesh = taperMeshData(part.size[0] * limb, part.size[2] * limb, part.size[1]);
  const rows = Array.from({ length: 7 }, (_, row) => ({ y: mesh.positions[row * 25 * 3 + 1], radius: mesh.positions[row * 25 * 3 + 2] }));
  const high = rows.findIndex(row => row.y >= localY);
  if (high <= 0) return rows[high === -1 ? rows.length - 1 : 0].radius;
  const a = rows[high - 1], b = rows[high], t = (localY - a.y) / (b.y - a.y);
  return a.radius + (b.radius - a.radius) * t;
}

describe("V7 free zip-polo", () => {
  it("provides one independent Vietnamese starter top with valid metadata", () => {
    expect(STARTER_POLO_V7_COSMETICS).toHaveLength(1);
    expect(Object.keys(STARTER_POLO_V7_SHAPES)).toEqual([model]);
    const cosmetic = STARTER_POLO_V7_COSMETICS[0];
    expect(cosmetic).toMatchObject({ id: model, model, slot: "top", price: 0, starter: true, level: 1, rarity: "common", assetId: `wearable.${model}` });
    expect(cosmetic.name).toMatch(/[À-ỹ]/u);
    expect(cosmetic.description).toMatch(/[À-ỹ]/u);
    expect(cosmetic.description.length).toBeGreaterThan(40);
    expect(cosmetic.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(cosmetic.collection).toBe("starter-signal");
    expect(polo.model).toBe(model);
    expect(polo.layer).toBe(cosmetic.slot);
    expect(polo.geometryCount).toBe(polo.parts.length);
    expect(polo.hairAdjustment).toBeUndefined();
    expect(polo.detail.length).toBeGreaterThanOrEqual(4);
    const legacy = COSMETICS.filter(item => !item.id.startsWith("v7-"));
    expect(legacy.some(item => item.id === model || item.model === model || item.assetId === cosmetic.assetId)).toBe(false);
    expect(legacy.find(item => item.id === "runner-jacket")?.model).toBe("jacket");
    expect(legacy.find(item => item.id === "corporate-top")?.model).toBe("jacket");
    expect(legacy.find(item => item.id === "daily-tee")?.model).toBe("tee");
    const freeTopModels = new Set(legacy.filter(item => item.starter && item.price === 0 && item.slot === "top").map(item => item.model));
    expect(freeTopModels.size).toBe(5);
    freeTopModels.add(cosmetic.model);
    expect(freeTopModels.size).toBe(6);
  });

  it("keeps its production module free of runtime imports and shared legacy shape references", () => {
    const source = readFileSync(new URL("../../src/character/starter-polo-v7.ts", import.meta.url), "utf8");
    const imports = source.match(/^import\b[^;]+;/gm) ?? [];
    expect(imports).toHaveLength(2);
    expect(imports.every(statement => statement.startsWith("import type "))).toBe(true);
    expect(imports[0]).toContain('from "./types"');
    expect(imports[1]).toContain('from "../components/world/wearable-shapes"');
    expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    for (const legacy of [WEARABLE_SHAPES.tee, WEARABLE_SHAPES.jacket]) {
      expect(polo).not.toBe(legacy);
      for (const part of polo.parts) expect(legacy.parts.includes(part)).toBe(false);
    }
  });

  it("uses bounded finite cloth geometry and an untransformed closed-front shell", () => {
    expect(polo.parts.filter(part => part.kind === "shell")).toHaveLength(1);
    expect(shell).toMatchObject({ anchor: "torso", at: [0, 0, 0], size: [1, 1, 1], opening: 0 });
    expect(shell.rotation).toBeUndefined();
    expect(shell.sections!.length).toBeGreaterThanOrEqual(8);
    shell.sections!.forEach((section, index) => {
      expect([section.y, section.width, section.depth].every(Number.isFinite)).toBe(true);
      expect(section.y).toBeGreaterThan(1);
      expect(section.y).toBeLessThanOrEqual(1.512);
      expect(section.width).toBeGreaterThan(.07);
      expect(section.width).toBeLessThan(.25);
      expect(section.depth).toBeGreaterThan(.06);
      expect(section.depth).toBeLessThan(.14);
      if (index) expect(section.y).toBeGreaterThan(shell.sections![index - 1].y);
    });
    for (const part of polo.parts) {
      expect(["torso", "leftArm", "rightArm"]).toContain(part.anchor);
      expect(["shell", "taper", "ellipsoid", "box"]).toContain(part.kind);
      expect([...part.at, ...part.size, ...(part.rotation ?? [])].every(Number.isFinite)).toBe(true);
      expect(part.size.every(n => n > 0 && n <= 1)).toBe(true);
      expect((part.rotation ?? []).every(n => Math.abs(n) <= Math.PI)).toBe(true);
      expect(Math.abs(part.at[0])).toBeLessThan(.25);
      expect(Math.abs(part.at[2])).toBeLessThan(.2);
      expect(part.colorRole).not.toBe("glow");
      if (part.anchor !== "torso") expect(part.at[1] - (part.kind === "ellipsoid" ? part.size[1] : part.size[1] / 2)).toBeGreaterThan(-.23);
      if (part.kind !== "box") expect(part.metal).toBeUndefined();
    }
  });

  for (const preset of bodies) for (const presentation of presentations) {
    it(`builds finite nondegenerate closed-circumference shell triangles for ${preset}/${presentation}`, () => {
      const mesh = shellMeshData(shell.sections!, shell.opening, bodyShape(preset, presentation));
      expect(mesh.positions).toHaveLength(shell.sections!.length * 33 * 3);
      expect(mesh.indices).toHaveLength((shell.sections!.length - 1) * 32 * 6);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3)).toBe(true);
      for (let row = 0; row < shell.sections!.length; row++) {
        const start = row * 33 * 3, end = start + 32 * 3;
        for (let axis = 0; axis < 3; axis++) expect(mesh.positions[start + axis]).toBeCloseTo(mesh.positions[end + axis], 10);
      }
      for (let index = 0; index < mesh.indices.length; index += 3) {
        const [a, b, c] = mesh.indices.slice(index, index + 3).map(vertex => mesh.positions.slice(vertex * 3, vertex * 3 + 3));
        const u = b.map((n, axis) => n - a[axis]), v = c.map((n, axis) => n - a[axis]);
        expect(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])).toBeGreaterThan(1e-9);
      }
    });
  }

  it("keeps generated shell grid edges outside torso skin across body and presentation presets", () => {
    const pointAt = (positions: number[], vertex: number, y: number): [number, number] => {
      for (let row = 1; row < positions.length / 99; row++) {
        const high = (row * 33 + vertex) * 3, low = high - 99;
        if (y <= positions[high + 1] + 1e-9) {
          const t = (y - positions[low + 1]) / (positions[high + 1] - positions[low + 1]);
          return [positions[low] + (positions[high] - positions[low]) * t, positions[low + 2] + (positions[high + 2] - positions[low + 2]) * t];
        }
      }
      throw new Error("Sample lies outside the shell mesh");
    };
    for (const preset of bodies) for (const presentation of presentations) for (const shoulderWidth of [.8, 1, 1.2]) {
      const base = bodyShape(preset, presentation), body = { ...base, shoulder: base.shoulder * shoulderWidth };
      const clothMesh = shellMeshData(shell.sections!, 0, body), skinMesh = shellMeshData(skinSections, 0, body);
      for (let vertex = 0; vertex < 33; vertex++) {
        const topY = clothMesh.positions[((shell.sections!.length - 1) * 33 + vertex) * 3 + 1];
        for (let step = 0; step <= 80; step++) {
          const y = shell.sections![0].y + (topY - shell.sections![0].y) * step / 80;
          const garment = pointAt(clothMesh.positions, vertex, y), skin = pointAt(skinMesh.positions, vertex, y);
          const garmentRadius = Math.hypot(garment[0] * body.width, garment[1] * body.depth);
          const skinRadius = Math.hypot(skin[0] * body.width, skin[1] * body.depth);
          expect(garmentRadius - skinRadius).toBeGreaterThan(.008);
        }
      }
    }
  });

  it("fits articulated short sleeves and overlapping caps to the current shoulder and upper-arm skin", () => {
    expect(sectionAt(shell.sections!, 1.44).width).toBeGreaterThan(sectionAt(shell.sections!, 1.395).width);
    expect(sectionAt(shell.sections!, 1.478).width).toBeLessThan(sectionAt(shell.sections!, 1.44).width);
    expect(sectionAt(shell.sections!, 1.512).width).toBeLessThan(sectionAt(shell.sections!, 1.478).width);
    for (const anchor of ["leftArm", "rightArm"] as const) {
      const side = anchor === "leftArm" ? -1 : 1;
      const sleeve = polo.parts.filter(part => part.anchor === anchor);
      expect(sleeve).toHaveLength(3);
      const cap = sleeve.find(part => part.kind === "ellipsoid")!;
      const tapers = sleeve.filter(part => part.kind === "taper");
      expect(cap.at).toEqual([-side * .012, -.028, 0]);
      expect(cap.rotation).toEqual([0, 0, -side * .24]);
      expect(cap.size[0]).toBeGreaterThan(.064);
      expect(cap.size[1]).toBeGreaterThan(.068);
      expect(cap.size[2]).toBeGreaterThan(.062);
      expect(tapers.some(part => part.size[1] >= .17 && part.size[1] <= .21)).toBe(true);
      expect(tapers.some(part => part.colorRole === "secondary" && part.size[1] <= .04)).toBe(true);
      for (const preset of bodies) for (const presentation of presentations) for (const shoulderWidth of [.8, 1, 1.2]) {
        const base = bodyShape(preset, presentation), body = { ...base, shoulder: base.shoulder * shoulderWidth };
        const innerCap = .216 * body.shoulder - .012 - cap.size[0] * body.limb;
        expect(innerCap).toBeLessThan(sectionAt(shell.sections!, 1.44).width * silhouetteWidth(1.44, body));
        const skinArm: WearablePart = { anchor, kind: "taper", at: [0, -.148, .002], size: [.062, .245, .05], colorRole: "primary" };
        const end = Math.min(...tapers.map(part => part.at[1] - part.size[1] / 2));
        for (let step = 0; step <= 60; step++) {
          const y = -.08 + (end + .08) * step / 60;
          const clothRadius = Math.max(...tapers.map(part => taperRadiusAt(part, y, body.limb) - Math.abs(part.at[2] - skinArm.at[2])));
          expect(clothRadius - taperRadiusAt(skinArm, y, body.limb)).toBeGreaterThan(.0001);
        }
      }
    }
  });

  it("keeps the collar band outside the separate neck taper", () => {
    const band = polo.parts.find(part => part.anchor === "torso" && part.kind === "taper")!;
    const neck: WearablePart = { anchor: "torso", kind: "taper", at: [0, 1.542, -.004], size: [.055, .092, .068], colorRole: "primary" };
    const low = neck.at[1] - neck.size[1] / 2, high = band.at[1] + band.size[1] / 2;
    for (const preset of bodies) for (const presentation of presentations) {
      const body = bodyShape(preset, presentation);
      for (let step = 0; step <= 40; step++) {
        const y = low + (high - low) * step / 40;
        const clearance = taperRadiusAt(band, y, 1) - taperRadiusAt(neck, y, 1) - Math.abs(band.at[2] - neck.at[2]);
        expect(clearance * body.depth).toBeGreaterThan(.002);
      }
    }
  });

  it("models folded collar leaves, a short zipper and substantial two-tone geometric chest panels", () => {
    const torso = polo.parts.filter(part => part.anchor === "torso");
    const leaves = torso.filter(part => part.kind === "box" && part.at[1] > 1.45 && Math.abs(part.at[0]) > .03);
    expect(leaves).toHaveLength(2);
    expect(leaves[0].at[0]).toBe(-leaves[1].at[0]);
    expect(leaves[0].rotation![2]).toBe(-leaves[1].rotation![2]);
    for (const leaf of leaves) {
      expect(leaf.size[0]).toBeGreaterThan(.05);
      expect(leaf.size[1]).toBeGreaterThan(.07);
      expect(Math.abs(leaf.rotation![0])).toBeGreaterThan(.15);
      expect(leaf.colorRole).toBe("secondary");
    }
    const zip = torso.find(part => part.kind === "box" && part.colorRole === "trim" && part.size[1] > .1)!;
    expect(zip.at[0]).toBe(0);
    expect(zip.size[1]).toBeLessThan(.16);
    expect(zip.at[1] - zip.size[1] / 2).toBeGreaterThan(1.3);
    for (let step = 0; step <= 10; step++) {
      const y = zip.at[1] - zip.size[1] / 2 + zip.size[1] * step / 10;
      const front = shellMeshData([sectionAt(shell.sections!, y)]).positions[2];
      expect(zip.at[2] - zip.size[2] / 2).toBeGreaterThan(front);
    }
    const panels = torso.filter(part => part.kind === "box" && part.at[2] > .1 && Math.abs(part.at[0]) > .07 && part.size[1] > .05);
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.colorRole).toBe("secondary");
      expect(panel.size[0]).toBeGreaterThan(.13);
      expect(Math.abs(panel.rotation![2])).toBeGreaterThan(.3);
      expect(torso.some(part => part.kind === "box" && part.at[0] === panel.at[0] && part.size[1] < .01 && part.at[1] < panel.at[1])).toBe(true);
    }
    expect(shell.colorRole).toBe("primary");
  });

  it("differs structurally from existing tops even when colors, trim, ordering and scale are ignored", () => {
    const recolored: WearableShape = { ...polo, model: "recolored", detail: ["other"], parts: [...polo.parts].reverse().map(part => ({ ...part, colorRole: "glow", metal: 1 })) };
    expect(structure(recolored)).toEqual(structure(polo));
    const scaled: WearableShape = { ...polo, parts: polo.parts.map(part => ({ ...part, at: part.at.map(n => n * 1.25) as WearablePart["at"], size: part.size.map(n => n * 1.25) as WearablePart["size"], sections: part.sections?.map(section => ({ y: section.y * 1.25, width: section.width * 1.25, depth: section.depth * 1.25 })) })) };
    expect(structure(scaled)).toEqual(structure(polo));
    const tinyTrim: WearablePart = { anchor: "torso", kind: "box", at: [0, 1.2, .14], size: [.006, .006, .006], colorRole: "glow" };
    expect(structure({ ...polo, parts: [...polo.parts, tinyTrim] }, true)).toEqual(structure(polo, true));
    const legacyTops = Object.values(WEARABLE_SHAPES).filter(shape => shape.layer === "top" && shape.model !== model);
    expect(legacyTops.map(shape => shape.model)).toEqual(expect.arrayContaining(["tee", "jacket"]));
    for (const legacy of legacyTops) {
      expect(structure(polo), legacy.model).not.toEqual(structure(legacy));
      const a = new Set(structure(polo, true)), b = new Set(structure(legacy, true));
      const difference = [...a].filter(part => !b.has(part)).length + [...b].filter(part => !a.has(part)).length;
      expect(difference, legacy.model).toBeGreaterThanOrEqual(3);
      expect(difference / (a.size + b.size), legacy.model).toBeGreaterThan(.2);
    }
  });
});
