import { describe, expect, it } from "vitest";
import { UPPER_V7_COSMETICS, UPPER_V7_SHAPES } from "../../src/character/fashion-upper-v7";
import { COSMETICS } from "../../src/character/catalog";
import { bodyShape } from "../../src/components/world/character-shape";
import { hairCoverage, shellMeshData, silhouetteWidth, WEARABLE_SHAPES } from "../../src/components/world/wearable-shapes";
import type { GarmentSection, WearablePart, WearableShape } from "../../src/components/world/wearable-shapes";

const shapes = Object.values(UPPER_V7_SHAPES);
const shellOf = (shape: WearableShape) => shape.parts.find(p => p.kind === "shell")!;
const round = (n: number) => Math.round(n * 100000) / 100000;
function geometry(shape: WearableShape, normalize = false): string {
  const unit = normalize ? shellOf(shape).sections!.at(-1)!.y : 1;
  return JSON.stringify(shape.parts.map(p => ({
    anchor: p.anchor, kind: p.kind,
    at: p.kind === "shell" ? undefined : p.at.map(n => round(n / unit)),
    size: p.kind === "shell" ? undefined : p.size.map(n => round(n / unit)),
    rotation: p.rotation ?? [0, 0, 0], opening: p.opening ?? 0,
    sections: p.sections?.map(s => [s.y, s.width, s.depth].map(n => round(n / unit))),
  })).map(p => JSON.stringify(p)).sort());
}
function construction(shape: WearableShape): Set<string> {
  const sections = shellOf(shape).sections!;
  const unit = sections.at(-1)!.y;
  const coarse = (n: number) => Math.round(n / unit * 40);
  return new Set(shape.parts.filter(p => p.kind === "shell" || [...p.size].sort((a, b) => b - a)[1] / unit >= .025).map(p => JSON.stringify({
    anchor: p.anchor, kind: p.kind,
    at: p.kind === "shell" ? undefined : p.at.map(coarse),
    size: p.kind === "shell" ? undefined : p.size.map(coarse),
    rotation: (p.rotation ?? [0, 0, 0]).map(n => Math.round(n * 8)),
    opening: Math.round((p.opening ?? 0) * 8),
    sections: p.sections?.map(s => [s.y, s.width, s.depth].map(coarse)),
  })));
}
const parts = (name: string, predicate: (part: WearablePart) => boolean) => UPPER_V7_SHAPES[name].parts.filter(predicate);
const isHood = (p: WearablePart) => p.anchor === "torso" && p.kind === "ellipsoid" && p.at[2] < -.1 && p.size[0] > .13;
const isTail = (p: WearablePart) => p.anchor.endsWith("Thigh");
const isPanel = (p: WearablePart) => p.kind === "box" && p.anchor === "torso";
function sample(sections: readonly GarmentSection[], y: number): GarmentSection {
  const hi = sections.findIndex(s => s.y >= y);
  if (hi <= 0) return sections[Math.max(0, hi)];
  const lo = sections[hi - 1], upper = sections[hi], t = (y - lo.y) / (upper.y - lo.y);
  return { y, width: lo.width + (upper.width - lo.width) * t, depth: lo.depth + (upper.depth - lo.depth) * t };
}

describe("V7 upper fashion standalone collection", () => {
  it("adds exactly thirteen paid tops and ten paid outerwear without starter replacements", () => {
    expect(UPPER_V7_COSMETICS).toHaveLength(23);
    expect(UPPER_V7_COSMETICS.filter(c => c.slot === "top")).toHaveLength(13);
    expect(UPPER_V7_COSMETICS.filter(c => c.slot === "outerwear")).toHaveLength(10);
    const existing = COSMETICS.filter(c => !c.id.startsWith("v7-") && c.price > 0);
    expect(existing.filter(c => c.slot === "top").length + 13).toBe(18);
    expect(existing.filter(c => c.slot === "outerwear").length + 10).toBe(12);
    expect(shapes).toHaveLength(23);
    for (const field of ["id", "model", "assetId", "name"] as const) {
      expect(new Set(UPPER_V7_COSMETICS.map(c => c[field])).size).toBe(23);
    }
    for (const c of UPPER_V7_COSMETICS) {
      expect(c.id).toMatch(/^v7-(top|outer)-/);
      expect(c.model).toBe(c.id);
      expect(c.assetId).toBe(`wearable.${c.model}`);
      expect(c.starter).toBe(false);
      expect(c.price).toBeGreaterThan(0);
      expect(Number.isInteger(c.price)).toBe(true);
      expect(c.level).toBeGreaterThan(0);
      expect(Number.isInteger(c.level)).toBe(true);
      expect(["uncommon", "rare", "epic", "legendary"]).toContain(c.rarity);
      expect(c.name).toMatch(/[À-ỹ]/u);
      expect(c.description).toMatch(/[À-ỹ]/u);
      expect(c.description.length).toBeGreaterThan(35);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(UPPER_V7_SHAPES[c.model].layer).toBe(c.slot);
      expect(existing.some(old => old.id === c.id || old.model === c.model)).toBe(false);
    }
  });

  it("uses finite bounded geometry, valid anchors and untransformed torso shells", () => {
    for (const shape of shapes) {
      expect(shape.geometryCount).toBe(shape.parts.length);
      expect(shape.parts.length).toBeGreaterThanOrEqual(6);
      expect(UPPER_V7_SHAPES[shape.model]).toBe(shape);
      expect(shape.hairAdjustment).toBeUndefined();
      expect(shape.parts.filter(p => p.kind === "shell")).toHaveLength(1);
      for (const p of shape.parts) {
        expect(["torso", "leftArm", "rightArm", "leftThigh", "rightThigh"]).toContain(p.anchor);
        expect(["box", "ellipsoid", "taper", "ring", "shell"]).toContain(p.kind);
        expect([...p.at, ...p.size, ...(p.rotation ?? [])].every(Number.isFinite)).toBe(true);
        expect(p.size.every(n => n > 0 && n <= 1)).toBe(true);
        expect(Math.abs(p.at[0])).toBeLessThanOrEqual(.25);
        expect(Math.abs(p.at[2])).toBeLessThanOrEqual(.25);
        expect((p.rotation ?? []).every(n => Math.abs(n) <= Math.PI)).toBe(true);
        if (p.kind === "shell") {
          expect(p.anchor).toBe("torso");
          expect(p.at).toEqual([0, 0, 0]);
          expect(p.size).toEqual([1, 1, 1]);
          expect(p.rotation).toBeUndefined();
          expect(p.opening).toBeGreaterThanOrEqual(0);
          expect(p.opening).toBeLessThan(Math.PI);
          expect(p.sections!.length).toBeGreaterThanOrEqual(8);
          p.sections!.forEach((s, i) => {
            expect([s.y, s.width, s.depth].every(Number.isFinite)).toBe(true);
            expect(s.y).toBeGreaterThanOrEqual(1);
            expect(s.y).toBeLessThanOrEqual(1.512);
            expect(s.width).toBeGreaterThan(.07);
            expect(s.width).toBeLessThan(.28);
            expect(s.depth).toBeGreaterThan(.06);
            expect(s.depth).toBeLessThan(.18);
            if (i) expect(s.y).toBeGreaterThan(p.sections![i - 1].y);
          });
        } else if (p.anchor === "torso") {
          expect(p.at[1]).toBeGreaterThan(1);
          expect(p.at[1] + (p.kind === "box" || p.kind === "taper" ? p.size[1] / 2 : p.size[1] * (p.kind === "ring" ? 1.14 : 1))).toBeLessThan(1.61);
        } else {
          expect(p.at[1]).toBeGreaterThan(-.46);
          expect(p.at[1]).toBeLessThan(.12);
          if (p.anchor.endsWith("Arm")) {
            const half = p.kind === "ellipsoid" ? p.size[1] : p.size[1] / 2;
            expect(p.at[1] - half).toBeGreaterThan(-.46);
          }
        }
      }
    }
  });

  it.each(shapes)("builds nondegenerate $model shell meshes across body presets without GPU rendering", shape => {
    for (const preset of ["balanced", "slim", "athletic"]) for (const presentation of ["neutral", "feminine", "masculine"] as const) {
      const shell = shellOf(shape), sections = shell.sections!;
      const mesh = shellMeshData(sections, shell.opening, bodyShape(preset, presentation));
      expect(mesh.positions.length).toBe(sections.length * 33 * 3);
      expect(mesh.indices.length).toBe((sections.length - 1) * 32 * 6);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.indices.every(n => Number.isInteger(n) && n >= 0 && n < mesh.positions.length / 3)).toBe(true);
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices.slice(i, i + 3).map(j => mesh.positions.slice(j * 3, j * 3 + 3));
        const u = b.map((n, j) => n - a[j]), v = c.map((n, j) => n - a[j]);
        const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
        expect(area).toBeGreaterThan(1e-9);
      }
      const gap = Math.hypot(...mesh.positions.slice(0, 3).map((n, i) => n - mesh.positions[96 + i]));
      if (shell.opening === 0) expect(gap).toBeLessThan(1e-8);
      else expect(gap).toBeGreaterThan(.01);
    }
  });

  it("preserves skin clearance, shoulder caps, outer shell offsets and cap hair coverage", () => {
    const skin = [[1.235, .164, .101], [1.33, .186, .108], [1.395, .198, .102], [1.44, .206, .095], [1.478, .124, .074], [1.512, .058, .052]];
    for (const shape of shapes) {
      const sections = shellOf(shape).sections!;
      for (const [y, width, depth] of skin) {
        const section = sample(sections, y);
        expect(section.width).toBeGreaterThan(width);
        expect(section.depth).toBeGreaterThan(depth);
      }
      expect(sample(sections, 1.44).width).toBeGreaterThan(sample(sections, 1.395).width);
      expect(sample(sections, 1.478).width).toBeLessThan(sample(sections, 1.44).width);
      expect(sample(sections, 1.512).width).toBeLessThan(sample(sections, 1.478).width);
      for (const anchor of ["leftArm", "rightArm"] as const) {
        const pieces = shape.parts.filter(p => p.anchor === anchor);
        const cap = pieces.find(p => p.kind === "ellipsoid" && p.at[1] > -.05);
        if (pieces.some(p => p.kind === "taper" && p.size[1] > .22)) expect(cap).toBeDefined();
        if (cap) {
          expect(cap.at[0]).toBe(anchor === "leftArm" ? .012 : -.012);
          expect(cap.size[0]).toBeGreaterThan(.064);
          expect(cap.size[1]).toBeGreaterThan(.068);
          expect(cap.size[2]).toBeGreaterThan(.062);
          for (const presentation of ["neutral", "feminine", "masculine"] as const) {
            const body = bodyShape("balanced", presentation);
            const innerCap = .216 * body.shoulder - .012 - cap.size[0] * body.limb;
            expect(innerCap).toBeLessThan(sample(sections, 1.44).width * silhouetteWidth(1.44, body));
          }
        }
      }
    }
    const tops = shapes.filter(s => s.layer === "top");
    for (const outer of shapes.filter(s => s.layer === "outerwear")) for (const top of tops) {
      for (const y of [1.235, 1.33, 1.395, 1.44, 1.478, 1.512]) {
        const a = sample(shellOf(outer).sections!, y), b = sample(shellOf(top).sections!, y);
        expect(a.width - b.width).toBeGreaterThan(.01);
        expect(a.depth - b.depth).toBeGreaterThan(.01);
      }
    }
    expect(hairCoverage("long", "cap")).toMatchObject({ covered: true, crownScale: .45, keepSideLengths: true, showLocks: false });
  });

  it("keeps full outer sleeves outside flared and layered top sleeves", () => {
    const radiusAt = (shape: WearableShape, anchor: string, y: number) => Math.max(0, ...shape.parts.filter(p => p.anchor === anchor && p.kind === "taper").map(p => {
      const bottom = p.at[1] - p.size[1] / 2, top = p.at[1] + p.size[1] / 2;
      if (y < bottom || y > top) return 0;
      const t = (y - bottom) / p.size[1];
      return p.size[2] + (p.size[0] - p.size[2]) * t;
    }));
    for (const outer of shapes.filter(s => s.layer === "outerwear")) {
      if (!outer.parts.some(p => p.anchor === "leftArm" && p.kind === "taper" && p.at[1] < -.19)) continue;
      for (const top of shapes.filter(s => s.layer === "top")) for (const anchor of ["leftArm", "rightArm"]) for (const y of [-.1, -.18, -.25, -.28, -.33, -.38]) {
        const inner = radiusAt(top, anchor, y), outerRadius = radiusAt(outer, anchor, y);
        if (inner && outerRadius) expect(outerRadius - inner, `${outer.model}/${top.model}/${anchor}/${y}`).toBeGreaterThan(.003);
      }
    }
  });

  it("rejects color, metadata, ordering, uniform scale and tiny-trim uniqueness", () => {
    const base = UPPER_V7_SHAPES["v7-top-wrap"];
    const recolor = { ...base, model: "different", detail: ["different"], parts: [...base.parts].reverse().map(p => ({ ...p, colorRole: "glow" as const, metal: .99 })) };
    expect(geometry(recolor, true)).toBe(geometry(base, true));
    const scaled: WearableShape = { ...base, parts: base.parts.map(p => ({ ...p, at: p.at.map(n => n * 1.25) as WearablePart["at"], size: p.size.map(n => n * 1.25) as WearablePart["size"], sections: p.sections?.map(s => ({ y: s.y * 1.25, width: s.width * 1.25, depth: s.depth * 1.25 })) })) };
    expect(geometry(scaled, true)).toBe(geometry(base, true));
    expect(construction({ ...base, parts: [...base.parts, { kind: "box", anchor: "torso", at: [0, 1.3, .14], size: [.006, .006, .006], colorRole: "glow" }] })).toEqual(construction(base));
    expect(new Set(shapes.map(s => geometry(s, true))).size).toBe(23);
    const legacy = Object.values(WEARABLE_SHAPES).filter(s => !s.model.startsWith("v7-") && ["top", "outerwear"].includes(s.layer));
    for (let i = 0; i < shapes.length; i++) for (const other of [...shapes.slice(i + 1), ...legacy]) {
      expect(geometry(shapes[i], true), `${shapes[i].model} versus ${other.model}`).not.toBe(geometry(other, true));
      const a = construction(shapes[i]), b = construction(other);
      const changed = [...a].filter(x => !b.has(x)).length + [...b].filter(x => !a.has(x)).length;
      expect(changed, `${shapes[i].model} versus ${other.model}`).toBeGreaterThanOrEqual(3);
      expect(changed / (a.size + b.size)).toBeGreaterThan(.2);
    }
  });

  it("encodes named cuts as substantial sleeves, closures, lapels, hoods and articulated tails", () => {
    expect(parts("v7-top-wrap", p => p.anchor === "leftArm" && p.kind === "taper").some(p => p.size[1] === .41)).toBe(true);
    expect(parts("v7-top-wrap", p => p.anchor === "rightArm" && p.kind === "taper").some(p => p.size[1] === .25)).toBe(true);
    expect(shellOf(UPPER_V7_SHAPES["v7-top-bolero"]).sections![0].y).toBe(1.19);
    for (const name of ["v7-top-anorak", "v7-outer-poncho", "v7-outer-fishtail"]) expect(parts(name, isHood)).toHaveLength(1);
    for (const name of ["v7-top-field-vest", "v7-top-quilt-vest", "v7-outer-long-vest"]) expect(parts(name, p => p.anchor.endsWith("Arm"))).toHaveLength(0);
    expect(parts("v7-top-field-vest", p => isPanel(p) && p.size[1] === .092)).toHaveLength(4);
    expect(parts("v7-top-combat-knit", p => p.anchor.endsWith("Arm") && p.kind === "ellipsoid" && p.at[1] === -.24)).toHaveLength(2);
    expect(parts("v7-top-side-tunic", isTail).map(p => p.anchor)).toEqual(["leftThigh"]);
    expect(parts("v7-top-racer", p => isPanel(p) && Math.abs(p.rotation![2]) === .38)).toHaveLength(2);
    expect(parts("v7-top-kimono", p => isPanel(p) && p.size[0] === .34 && p.size[1] === .075)).toHaveLength(1);
    expect(parts("v7-top-layered", p => p.anchor.endsWith("Arm") && p.kind === "taper" && p.size[1] === .19)).toHaveLength(2);
    expect(parts("v7-top-quilt-vest", p => isPanel(p) && p.size[1] === .067)).toHaveLength(6);
    expect(parts("v7-top-funnel", p => p.kind === "taper" && p.anchor === "torso" && p.size[0] === .104)).toHaveLength(1);
    expect(parts("v7-top-mechanic", p => p.anchor.endsWith("Arm") && p.kind === "taper" && p.size[1] === .075)).toHaveLength(2);
    expect(parts("v7-top-cross-rig", p => isPanel(p) && p.size[1] === .32 && Math.abs(p.rotation![2]) === .52)).toHaveLength(2);
    expect(parts("v7-outer-cape", p => p.anchor.endsWith("Arm") && p.kind === "box" && p.size[1] === .27)).toHaveLength(2);
    expect(parts("v7-outer-duster", p => isTail(p) && p.size[1] === .45)).toHaveLength(2);
    expect(parts("v7-outer-peacoat", p => isPanel(p) && p.size[1] === .28 && p.size[0] === .24)).toHaveLength(1);
    expect(parts("v7-outer-biker", p => isPanel(p) && p.size[1] > .25 && p.rotation![2] === -.29)).toHaveLength(2);
    expect(parts("v7-outer-poncho", p => p.anchor.endsWith("Arm") && p.kind === "taper" && p.size[2] > p.size[0])).toHaveLength(2);
    expect(parts("v7-outer-fishtail", isTail)).toHaveLength(4);
    expect(parts("v7-outer-officer", p => isPanel(p) && p.size[0] === .43 && p.at[2] < 0)).toHaveLength(1);
    expect(parts("v7-outer-expedition", p => (isPanel(p) && p.size[1] === .092) || (p.anchor.endsWith("Arm") && p.kind === "box"))).toHaveLength(6);
    expect(parts("v7-outer-long-vest", isTail)).toHaveLength(2);
    expect(parts("v7-outer-haori", p => p.anchor.endsWith("Arm") && p.kind === "taper" && p.size[1] === .3 && p.size[2] > p.size[0])).toHaveLength(2);
  });
});
