import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry } from "../../src/components/world/furniture-models";
import { getFurnitureDefinition, getFurnitureRecipe, type FurniturePart } from "../../src/furniture/catalog";
import { TECH_V7_CATALOG, TECH_V7_RECIPES } from "../../src/furniture/collection-tech-v7";

type Point = [number, number, number];
const id = "v7-info-terminal";
const epsilon = 1e-6;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function crossings(part: FurniturePart, origin: Point, direction: Point): number[] {
  const geometry = createFurniturePartGeometry(part);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  try {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...part.position);
    mesh.updateMatrixWorld(true);
    return new Raycaster(new Vector3(...origin), new Vector3(...direction))
      .intersectObject(mesh, false).map(hit => hit.distance)
      .filter((distance, index, all) => index === 0 || distance - all[index - 1] > epsilon);
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

function interval(part: FurniturePart, origin: Point, direction: Point): [number, number] {
  const hits = crossings(part, origin, direction);
  expect(hits, `${part.id}/actual triangle crossings`).toHaveLength(2);
  return [hits[0], hits[1]];
}

function gap(a: FurniturePart, b: FurniturePart, origin: Point, direction: Point): number {
  const first = interval(a, origin, direction), second = interval(b, origin, direction);
  return Math.max(first[0], second[0]) - Math.min(first[1], second[1]);
}

function meshBounds(parts: readonly FurniturePart[]): Box3 {
  const bounds = new Box3();
  for (const part of parts) {
    const geometry = createFurniturePartGeometry(part);
    try {
      const positions = geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        bounds.expandByPoint(new Vector3().fromBufferAttribute(positions, index).add(new Vector3(...part.position)));
      }
    } finally { geometry.dispose(); }
  }
  return bounds;
}

describe.each([false, true])("terminal screen contact, world-scaled %s", worldScaled => {
  const definition = getFurnitureDefinition(id)!;
  const scale: Point = worldScaled ? [definition.width, definition.height, definition.depth] : [1, 1, 1];
  const point = (x: number, y: number, z: number): Point => [x * scale[0], y * scale[1], z * scale[2]];
  const parts = worldScaled ? getFurnitureRecipe(id)!.parts : TECH_V7_RECIPES[id]();
  const get = (name: string) => parts.find(part => part.id === name)!;
  const oldColumn: FurniturePart = { ...get("service-column"), position: point(.18, .43, -.16), size: point(.24, .79, .28) };

  it("detects the old overlapping coplanar display and rejects it as clearance", () => {
    for (const x of [.08, .18, .28]) for (const y of [.66, .73, .81]) {
      const origin = point(x, y, 1), direction: Point = [0, 0, -1];
      const column = interval(oldColumn, origin, direction), display = interval(get("display"), origin, direction);
      expect(column[0]).toBeCloseTo(display[0], 6);
      expect(1 * scale[2] - column[0]).toBeCloseTo(-.02 * scale[2], 6);
      expect(gap(oldColumn, get("display"), origin, direction)).toBeCloseTo(-.02 * scale[2], 6);
      expect(gap(oldColumn, get("display"), origin, direction)).not.toBeGreaterThan(epsilon);
    }
  });

  it("clears the full display slab behind its frontmost actual triangles", () => {
    const column = get("service-column"), display = get("display");
    expect(column.position).toEqual(point(.18, .43, -.19));
    expect(column.size).toEqual(point(.24, .79, .28));
    for (const x of [.08, .18, .28]) for (const y of [.66, .73, .81]) {
      const origin = point(x, y, 1), direction: Point = [0, 0, -1];
      const metal = interval(column, origin, direction), screen = interval(display, origin, direction);
      expect(metal[0] - screen[0]).toBeCloseTo(.03 * scale[2], 6);
      expect(metal[0] - screen[1]).toBeCloseTo(.01 * scale[2], 6);
      expect(gap(column, display, origin, direction)).toBeGreaterThan(.009 * scale[2]);
    }
  });

  it("retains solid monitor, keyboard and foot support and an attached service port", () => {
    const column = get("service-column"), direction: Point = [0, 0, -1];
    for (const x of [.08, .18, .28]) for (const y of [.66, .73, .81]) {
      expect(gap(column, get("monitor-frame"), point(x, y, 1), direction)).toBeCloseTo(-.15 * scale[2], 6);
    }
    expect(gap(column, get("keyboard-shelf"), point(.18, .55, 1), direction)).toBeCloseTo(-.2 * scale[2], 6);
    expect(gap(column, get("foot"), point(.18, -1, -.19), [0, 1, 0])).toBeCloseTo(-.035 * scale[1], 6);
    const port = get("service-port");
    expect(port.position).toEqual(point(.18, .3, -.04));
    expect(gap(column, port, point(.18, .3, 1), direction)).toBeCloseTo(0, 6);
    expect(gap(column, { ...port, position: point(.18, .3, -.01) }, point(.18, .3, 1), direction)).toBeCloseTo(.03 * scale[2], 6);
    const detached: FurniturePart = { ...column, position: point(.18, .43, -.6) };
    expect(gap(detached, get("monitor-frame"), point(.18, .73, 1), direction)).toBeGreaterThan(.25 * scale[2]);
  });

  it("preserves the complete terminal bounds and all part sizes and materials", () => {
    expect(parts).toHaveLength(12);
    const original = parts.map(part => part.id === "service-column" ? oldColumn
      : part.id === "service-port" ? { ...part, position: point(.18, .3, -.01) } : part);
    const before = meshBounds(original), after = meshBounds(parts);
    expect(after.min.toArray()).toEqual(before.min.toArray());
    expect(after.max.toArray()).toEqual(before.max.toArray());
    expect(parts.map(({ id, size, material }) => ({ id, size, material })))
      .toEqual(original.map(({ id, size, material }) => ({ id, size, material })));
  });
});

it("preserves all 25 definitions and the other 24 recipes exactly", () => {
  expect(TECH_V7_CATALOG).toHaveLength(25);
  expect(digest(TECH_V7_CATALOG)).toBe("279556aeb8102529128e1e8136db5801ff7bba097ac2e2df02d1041c20fefead");
  const others = Object.entries(TECH_V7_RECIPES).filter(([key]) => key !== id).map(([key, make]) => [key, make()]);
  expect(others).toHaveLength(24);
  expect(digest(others)).toBe("ae07fb161ac03d709d243f96def79cb60679370d758658a7129a57853c4a49ef");
});
