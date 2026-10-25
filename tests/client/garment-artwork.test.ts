import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { COSMETICS } from "@/character/catalog";
import { GarmentArtwork, garmentDrawing, projectGarmentPart } from "@/components/character/GarmentArtwork";
import { WEARABLE_SHAPES, shellMeshData, silhouetteWidth, type WearablePart } from "@/components/world/wearable-shapes";
import { bodyShape, taperMeshData } from "@/components/world/character-shape";
import type { CosmeticSlot } from "@/character/types";

const publicModels = "backpack beanie bomber boots cap cargo chain-collar cropped-jacket ear-cuff gloves high-tops holo-badge holo-scarf hoodie jacket loafers long-coat mask overshirt parka pleated rain-shell scarf shell sneakers tapered tee trench turtleneck utility-vest v7-arch-wedge v7-armored-greaves v7-asymmetric-drape v7-back-canisters v7-back-folded-fan v7-back-hardpack v7-back-roll v7-back-sling v7-box-culottes v7-buckle-combat-boots v7-cargo-jogger v7-chelsea-pull-boots v7-double-monk v7-eye-asymmetric v7-eye-aviator v7-eye-brow v7-eye-cat v7-eye-hexagon v7-eye-rectangle v7-eye-round v7-eye-shield v7-fan-pleat-skirt v7-glove-console v7-glove-fingerless v7-glove-gauntlet v7-glove-laced v7-glove-mitten v7-head-beret v7-head-bucket v7-head-cylinder v7-head-flight v7-head-knit v7-head-patrol v7-jewel-brooch v7-jewel-crescent v7-jewel-drop v7-jewel-ear-bridge v7-jewel-helix v7-jewel-ladder v7-jewel-orbit v7-jewel-prism v7-jewel-satellite v7-jewel-tags v7-jewel-tassel v7-orbit-harness-pants v7-outer-biker v7-outer-cape v7-outer-duster v7-outer-expedition v7-outer-fishtail v7-outer-haori v7-outer-long-vest v7-outer-officer v7-outer-peacoat v7-outer-poncho v7-ridge-platform v7-riding-breeches v7-split-flare v7-split-runner v7-starter-zip-polo v7-tabi-zip v7-tech-panel-skirt v7-top-anorak v7-top-bolero v7-top-combat-knit v7-top-cross-rig v7-top-field-vest v7-top-funnel v7-top-kimono v7-top-layered v7-top-mechanic v7-top-quilt-vest v7-top-racer v7-top-side-tunic v7-top-wrap v7-wingtip-derby v7-wrap-skirt visor wide-leg wrist-device".split(" ");
const aliases = [
  ["runner-jacket", "corporate-top"], ["runner-pants", "corporate-pants"],
  ["corporate-shoes", "technician-shoes", "neon-boots"], ["technician-top", "amber-hoodie"],
  ["technician-pants", "cargo-pants"], ["wide-leg-pants", "graphite-wide-leg"],
  ["city-high-tops", "pulse-high-tops"], ["starter-pleated-pants", "silver-pleat"],
  ["starter-loafers", "mono-loafers"], ["starter-cyber-coat", "violet-coat"],
].map(ids => ids.sort()).sort();
const render = (model: string, slot: CosmeticSlot = "top", color = "#72d3dc") => renderToStaticMarkup(createElement(GarmentArtwork, { model, slot, color }));
const paths = (model: string, slot: CosmeticSlot = "top") => garmentDrawing(model, slot).surfaces.map(surface => [surface.outline, ...surface.shades]).flat();
const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const sample: WearablePart = { anchor: "torso", kind: "ellipsoid", at: [0, 0, 0], size: [1, 1, 1], colorRole: "primary" };
const extent = (positions: number[], axis: number) => {
  const values = positions.filter((_, i) => i % 3 === axis);
  return Math.max(...values) - Math.min(...values);
};

function contains(path: string, x: number, y: number): boolean {
  let winding = 0;
  for (const section of path.split("M").filter(Boolean)) {
    const coords = numbers(section);
    const polygon = Array.from({ length: coords.length / 2 }, (_, i) => [coords[i * 2], coords[i * 2 + 1]]);
    for (let i = 0; i < polygon.length; i++) {
      const [ax, ay] = polygon[i], [bx, by] = polygon[(i + 1) % polygon.length];
      const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
      if (ay <= y && by > y && cross > 0) winding++;
      if (ay > y && by <= y && cross < 0) winding--;
    }
  }
  return winding !== 0;
}

describe("source-based garment artwork", () => {
  it("covers the exact public membership and only the known shared-model aliases", () => {
    expect(COSMETICS).toHaveLength(121);
    expect(Object.keys(WEARABLE_SHAPES).sort()).toEqual(publicModels);
    expect([...new Set(COSMETICS.map(item => item.model))].sort()).toEqual(Object.keys(WEARABLE_SHAPES).sort());
    const groups = new Map<string, string[]>();
    for (const item of COSMETICS) groups.set(item.model, [...(groups.get(item.model) ?? []), item.id]);
    expect([...groups.values()].filter(ids => ids.length > 1).map(ids => ids.sort()).sort()).toEqual(aliases);
    const drawings = new Set<string>();
    for (const [model] of groups) {
      const slot = COSMETICS.find(item => item.model === model)!.slot;
      const geometry = JSON.stringify(paths(model, slot));
      expect(drawings.has(geometry), `duplicate geometry: ${model}`).toBe(false);
      drawings.add(geometry);
    }
    expect(drawings.size).toBe(110);
  });

  it("renders finite, tightly framed decorative SVG for every catalog item within bounded path budgets", () => {
    for (const item of COSMETICS) {
      const drawing = garmentDrawing(item.model, item.slot);
      const markup = render(item.model, item.slot, item.color);
      expect(markup).toContain('viewBox="0 0 96 96"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
      expect(markup).not.toMatch(/NaN|Infinity|<canvas|<text|<title|<image|<foreignObject/i);
      expect(drawing.bounds.every(Number.isFinite)).toBe(true);
      expect(drawing.surfaces.length, item.model).toBeGreaterThan(0);
      expect(drawing.surfaces.length, item.model).toBeLessThanOrEqual(100);
      expect(drawing.triangles, item.model).toBeLessThan(15000);
      expect(markup.length, item.model).toBeLessThan(180000);
      for (const color of markup.matchAll(/(?:fill|stroke)="(#[^"]+)"/g)) expect(color[1]).toMatch(/^#[\da-f]{6}$/i);
      const coordinates = paths(item.model, item.slot).flatMap(numbers);
      expect(Math.min(...coordinates), item.model).toBeGreaterThanOrEqual(7.99);
      expect(Math.max(...coordinates), item.model).toBeLessThanOrEqual(88.01);
      expect(Math.max(...coordinates) - Math.min(...coordinates), item.model).toBeGreaterThan(65);
    }
  });

  it("uses bounds framing for eyewear and cuffs and a rear camera for back equipment", () => {
    for (const model of ["v7-eye-round", "ear-cuff", "wrist-device"]) {
      const drawing = garmentDrawing(model, "accessory");
      expect(Math.max(drawing.bounds[2] - drawing.bounds[0], drawing.bounds[3] - drawing.bounds[1])).toBeLessThan(.4);
      const coordinates = paths(model, "accessory").flatMap(numbers);
      expect(Math.max(...coordinates) - Math.min(...coordinates)).toBeGreaterThan(75);
    }
    expect(garmentDrawing("backpack", "back").rear).toBe(true);
    expect(paths("backpack", "back")).not.toEqual(paths("backpack", "accessory"));
    expect(render("backpack", "back")).toContain('data-garment-view="rear"');
  });

  it("keeps palette changes out of the cached geometry and rejects unsafe colors or unknown models", () => {
    const first = garmentDrawing("jacket", "top");
    render("jacket", "top", "#ff0000"); render("jacket", "top", "#0000ff");
    expect(garmentDrawing("jacket", "top")).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.surfaces)).toBe(true);
    expect(render("jacket", "top", "url(https://example.invalid/a)")).toBe(render("jacket"));
    expect(render("jacket", "top", "#ff0000")).not.toBe(render("jacket", "top", "#0000ff"));
    for (const model of ["missing", "__proto__", "constructor", ""]) {
      expect(garmentDrawing(model, "top").surfaces).toEqual([]);
      expect(render(model)).not.toContain("<path");
    }
  });

  it("applies the paused balanced rig anchors without detaching sleeves, hands or legs", () => {
    const torso = projectGarmentPart(sample);
    for (const [anchor, position, scale] of [
      ["head", [0, 1.662, .006], [.93, .93, .96]],
      ["leftArm", [-.216, 1.425, -.004], [1, 1, 1]], ["rightArm", [.216, 1.425, -.004], [1, 1, 1]],
      ["leftThigh", [-.102, .958, 0], [1, 1, 1]], ["rightThigh", [.102, .958, 0], [1, 1, 1]],
      ["leftShin", [-.102, .565, 0], [1, 1, 1]], ["rightShin", [.102, .565, 0], [1, 1, 1]],
    ] as const) {
      const world = projectGarmentPart({ ...sample, anchor });
      for (let i = 0; i < world.positions.length; i++) expect(world.positions[i]).toBeCloseTo(torso.positions[i] * scale[i % 3] + position[i % 3], 8);
    }
  });

  it("respects ellipsoid radii, full box dimensions and rotation after nonuniform scale", () => {
    const size: [number, number, number] = [.07, .23, .035];
    const rotation: [number, number, number] = [.37, -.61, .84];
    const rotated = projectGarmentPart({ ...sample, size, rotation, anchor: "head", at: [.03, -.02, .04] });
    const unit = projectGarmentPart(sample);
    const local = new Matrix4().compose(new Vector3(.03, -.02, .04), new Quaternion().setFromEuler(new Euler(...rotation, "XYZ")), new Vector3(...size));
    for (let i = 0; i < unit.positions.length; i += 3) {
      const expected = new Vector3().fromArray(unit.positions, i).applyMatrix4(local).multiply(new Vector3(.93, .93, .96)).add(new Vector3(0, 1.662, .006));
      expect(rotated.positions.slice(i, i + 3)).toEqual([expected.x, expected.y, expected.z].map(v => expect.closeTo(v, 8)));
    }
    const orb = projectGarmentPart({ ...sample, size });
    const box = projectGarmentPart({ ...sample, kind: "box", size });
    expect(extent(orb.positions, 0)).toBeCloseTo(size[0] * 2, 6);
    expect(extent(box.positions, 0)).toBeCloseTo(size[0], 6);
    const vertical = projectGarmentPart({ ...sample, kind: "taper", size: [.03, .3, .04] });
    const horizontal = projectGarmentPart({ ...sample, kind: "taper", size: [.03, .3, .04], rotation: [0, 0, Math.PI / 2] });
    expect(extent(horizontal.positions, 0)).toBeCloseTo(extent(vertical.positions, 1), 8);
    expect(extent(horizontal.positions, 1)).toBeCloseTo(extent(vertical.positions, 0), 8);
  });

  it("uses all authored shell sections and the original sculpted taper instead of primitive substitutes", () => {
    const shell = WEARABLE_SHAPES.jacket.parts.find(part => part.kind === "shell")!;
    expect(shell.sections).toHaveLength(9);
    const result = projectGarmentPart({ ...shell, at: [2, 3, 4], size: [2, 2, 2], rotation: [.2, .3, .4] });
    expect(result).toEqual(shellMeshData(shell.sections!, shell.opening, bodyShape("balanced", "neutral"), 24));
    const spec: WearablePart = { ...sample, kind: "taper", at: [0, 1.12, 0], size: [.1, .4, .07] };
    const expected = taperMeshData(.1 * silhouetteWidth(1.12, bodyShape("balanced", "neutral")), .07, .4, 1, 16);
    expect(projectGarmentPart(spec).positions).toEqual(expected.positions.map((v, i) => i % 3 === 1 ? v + 1.12 : v));
    expect(paths("jacket")).not.toEqual(paths("utility-vest"));
  });

  it("keeps the torus aperture genuinely empty rather than filling a disc", () => {
    const drawing = garmentDrawing("ear-cuff", "accessory");
    expect(drawing.surfaces).toHaveLength(2);
    for (const surface of drawing.surfaces) {
      const coords = numbers(surface.outline);
      const xs = coords.filter((_, i) => i % 2 === 0), ys = coords.filter((_, i) => i % 2 === 1);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
      expect(surface.outline.split("M").length).toBeGreaterThanOrEqual(3);
      expect(contains(surface.outline, x, y)).toBe(false);
      for (const shade of surface.shades) expect(contains(shade, x, y)).toBe(false);
      expect(contains(surface.outline, Math.max(...xs) - .25, y)).toBe(true);
    }
  });

  it("requires no browser, canvas, actions, network, economy or mutable catalog state", async () => {
    const before = JSON.stringify(COSMETICS), shapes = JSON.stringify(WEARABLE_SHAPES);
    const fetch = vi.fn(() => { throw new Error("Network is forbidden"); });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("document", { createElement: () => { throw new Error("Canvas is forbidden"); } });
    vi.stubGlobal("OffscreenCanvas", class { constructor() { throw new Error("Canvas is forbidden"); } });
    try {
      vi.resetModules();
      const cold = await import("@/components/character/GarmentArtwork");
      for (const item of COSMETICS) renderToStaticMarkup(createElement(cold.GarmentArtwork, item));
      expect(fetch).not.toHaveBeenCalled();
      expect(JSON.stringify(COSMETICS)).toBe(before);
      expect(JSON.stringify(WEARABLE_SHAPES)).toBe(shapes);
      const source = readFileSync("src/components/character/GarmentArtwork.tsx", "utf8");
      expect(source).not.toMatch(/WebGLRenderer|Canvas|requestAnimationFrame|useFrame|Math\.random|cosmetic\.(buy|equip)|applyAction|localStorage|fetch\(/);
      expect(source).not.toMatch(/\/\*|(^|\n)\s*\/\//);
    } finally { vi.unstubAllGlobals(); }
  });
});
