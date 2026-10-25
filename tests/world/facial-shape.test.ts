import { describe, expect, it } from "vitest";
import { BROW_SHAPES, EAR_SHAPES, EYE_SHAPES, MOUTH_SHAPES, NOSE_SHAPES, browPoints, earMesh, facialPreset, facialRibbonMesh, mouthPoints, type FacialMesh } from "../../src/components/world/facial-shape";

function expectMesh(mesh: FacialMesh) {
  expect(mesh.positions.every(Number.isFinite)).toBe(true);
  expect(mesh.positions.every(value => Math.abs(value) < .1)).toBe(true);
  expect(mesh.indices.length % 3).toBe(0);
  expect(mesh.indices.every(value => Number.isInteger(value) && value >= 0 && value < mesh.positions.length / 3)).toBe(true);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3));
    const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
    const area = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    expect(area).toBeGreaterThan(0);
  }
}

const tables = [EYE_SHAPES, BROW_SHAPES, NOSE_SHAPES, EAR_SHAPES, MOUTH_SHAPES];
const names = [
  ["soft", "focused", "almond", "upturned", "wide", "hooded"],
  ["natural", "arched", "straight", "angled", "thin", "thick"],
  ["soft", "straight", "wide", "narrow", "aquiline", "button"],
  ["standard", "small", "wide", "pointed"],
  ["neutral", "smile", "full", "thin", "wide", "bow"],
];

describe("independent facial preset tables", () => {
  it.each(tables.map((table, index) => ({ table, index }))) ("preserves names and numeric IDs for table $index", ({ table, index }) => {
    expect(table.map(shape => shape.name)).toEqual(names[index]);
    table.forEach((shape, id) => {
      expect(facialPreset<{ name: string }>(table, id)).toBe(shape);
      expect(facialPreset<{ name: string }>(table, shape.name)).toBe(shape);
    });
    for (const value of [undefined, "unknown", -1, 99, NaN, .5]) expect(facialPreset<{ name: string }>(table, value)).toBe(table[0]);
  });

  it("has unique geometry parameters without relying on names", () => {
    for (const table of tables) {
      const geometry = table.map(shape => Object.entries(shape).filter(([key]) => key !== "name").map(([, value]) => value));
      expect(new Set(geometry.map(value => JSON.stringify(value))).size).toBe(table.length);
      for (const parameters of geometry) expect(parameters.every(value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= .5)).toBe(true);
    }
  });

  it("keeps all eye sizes restrained and semantically distinct", () => {
    for (const eye of EYE_SHAPES) {
      expect(eye.width).toBeGreaterThanOrEqual(.024);
      expect(eye.width).toBeLessThanOrEqual(.032);
      expect(eye.height).toBeGreaterThanOrEqual(.007);
      expect(eye.height).toBeLessThanOrEqual(.012);
      expect(eye.height / eye.width).toBeLessThan(.4);
    }
    expect(EYE_SHAPES[1].height).toBeLessThan(EYE_SHAPES[0].height);
    expect(EYE_SHAPES[2].width).toBeGreaterThan(EYE_SHAPES[0].width);
    expect(EYE_SHAPES[3].tilt).toBeGreaterThan(0);
    expect(EYE_SHAPES[4].height).toBeGreaterThan(EYE_SHAPES[0].height);
    expect(EYE_SHAPES[5].lidThickness).toBeGreaterThan(EYE_SHAPES[0].lidThickness);
  });

  it("makes narrow noses narrower and button noses shorter", () => {
    expect(NOSE_SHAPES[3].bridgeWidth).toBeLessThan(NOSE_SHAPES[2].bridgeWidth);
    expect(NOSE_SHAPES[3].tipWidth).toBeLessThan(NOSE_SHAPES[2].tipWidth);
    expect(NOSE_SHAPES[5].bridgeHeight).toBeLessThan(NOSE_SHAPES[0].bridgeHeight);
    expect(NOSE_SHAPES[4].bridgeDepth).toBeGreaterThan(NOSE_SHAPES[1].bridgeDepth);
    expect(NOSE_SHAPES[4].tipY).toBeLessThan(NOSE_SHAPES[1].tipY);
    for (const shape of NOSE_SHAPES) {
      for (const value of [shape.bridgeWidth, shape.bridgeHeight, shape.bridgeDepth, shape.tipWidth, shape.tipHeight, shape.tipDepth]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(.04);
      }
    }
  });

  it("makes small ears smaller on every axis and pointed ears an actual tip", () => {
    for (const axis of ["width", "height", "depth"] as const) expect(EAR_SHAPES[1][axis]).toBeLessThan(EAR_SHAPES[0][axis]);
    expect(EAR_SHAPES[2].width).toBeGreaterThan(EAR_SHAPES[0].width);
    const pointed = EAR_SHAPES[3], mesh = earMesh(pointed);
    const y = mesh.positions.filter((_, index) => index % 3 === 1);
    expect(Math.max(...y)).toBeCloseTo(pointed.height + pointed.tip);
    expect(y.filter(value => value === Math.max(...y))).toHaveLength(1);
    expect(mesh.positions[(6 + 2) * 3]).toBeCloseTo(0);
    expect(earMesh(pointed).positions).not.toEqual(earMesh({ ...pointed, tip: 0 }).positions);
    for (const shape of EAR_SHAPES) expectMesh(earMesh(shape));
    expect(new Set(EAR_SHAPES.map(shape => JSON.stringify(earMesh(shape).positions))).size).toBe(4);
  });

  it("renders distinct brow width, thickness, tilt and arch", () => {
    expect(BROW_SHAPES[2].arch).toBe(0);
    expect(BROW_SHAPES[2].tilt).toBe(0);
    expect(browPoints(BROW_SHAPES[2]).every(point => point[1] === 0)).toBe(true);
    expect(BROW_SHAPES[4].thickness).toBeLessThan(BROW_SHAPES[0].thickness);
    expect(BROW_SHAPES[5].thickness).toBeGreaterThan(BROW_SHAPES[2].thickness);
    expect(BROW_SHAPES[1].arch).toBeGreaterThan(BROW_SHAPES[0].arch);
    expect(BROW_SHAPES[3].tilt).toBeLessThan(0);
    const meshes = BROW_SHAPES.map(shape => facialRibbonMesh(browPoints(shape), shape.thickness));
    meshes.forEach(expectMesh);
    expect(new Set(meshes.map(mesh => JSON.stringify(mesh.positions))).size).toBe(6);
  });

  it("curves smile corners upward and gives bow lips cupid peaks", () => {
    const smile = mouthPoints(MOUTH_SHAPES[1], "upper"), neutral = mouthPoints(MOUTH_SHAPES[0], "upper"), bow = mouthPoints(MOUTH_SHAPES[5], "upper");
    expect(smile[0][1]).toBeGreaterThan(smile[8][1]);
    expect(smile[16][1]).toBeGreaterThan(smile[8][1]);
    expect(neutral[0][1]).toBeLessThan(neutral[8][1]);
    expect(bow[4][1]).toBeGreaterThan(bow[8][1]);
    expect(bow[12][1]).toBeGreaterThan(bow[8][1]);
    expect(MOUTH_SHAPES[2].upperThickness).toBeGreaterThan(MOUTH_SHAPES[0].upperThickness);
    expect(MOUTH_SHAPES[2].lowerThickness).toBeGreaterThan(MOUTH_SHAPES[0].lowerThickness);
    expect(MOUTH_SHAPES[3].upperThickness).toBeLessThan(MOUTH_SHAPES[0].upperThickness);
    expect(MOUTH_SHAPES[4].width).toBeGreaterThan(MOUTH_SHAPES[1].width);
    const geometry = MOUTH_SHAPES.map(shape => [facialRibbonMesh(mouthPoints(shape, "upper"), shape.upperThickness), facialRibbonMesh(mouthPoints(shape, "lower"), shape.lowerThickness)]);
    geometry.flat().forEach(expectMesh);
    expect(new Set(geometry.map(meshes => JSON.stringify(meshes))).size).toBe(6);
  });
});
