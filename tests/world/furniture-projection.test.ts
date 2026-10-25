import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxGeometry, BufferGeometry, DoubleSide, Euler, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import * as models from "../../src/components/world/furniture-models";
import { getFurnitureProjection, projectFurniture, projectFurniturePart, type FurnitureProjectionFace, type ProjectionPoint } from "../../src/components/furniture/furniture-projection";
import { FURNITURE_CATALOG, getFurnitureRecipe, type FurniturePart } from "../../src/furniture/catalog";

const fixture: FurniturePart = { id: "fixture", shape: "box", size: [2, 3, 1], position: [0, 0, 0], material: "wood" };
const view = new Vector3(1, Math.sqrt(2 / 3), 1).normalize();
const project = ({ x, y, z }: Vector3): ProjectionPoint => [(x - z) / Math.sqrt(2), (x + z) / Math.sqrt(8) - y * Math.sqrt(3 / 4)];
const signedArea = (loop: readonly ProjectionPoint[]) => loop.reduce((sum, point, i) => {
  const next = loop[(i + 1) % loop.length];
  return sum + point[0] * next[1] - point[1] * next[0];
}, 0) / 2;
const faceArea = (faces: FurnitureProjectionFace[]) => faces.reduce((sum, face) => sum + Math.abs(face.loops.reduce((area, loop) => area + signedArea(loop), 0)), 0);

function visibleMesh(part: FurniturePart) {
  const geometry = models.createFurniturePartGeometry(part);
  try {
    const positions = geometry.getAttribute("position"), index = geometry.getIndex();
    const points: ProjectionPoint[] = [];
    let area = 0, triangles = 0;
    const material = models.getFurnitureMaterialProperties(part, "#abc123", false, false);
    for (let i = 0; i + 2 < (index?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).add(new Vector3(...part.position)));
      const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      if (normal.length() < 1e-12) continue;
      const facing = normal.normalize().dot(view);
      if (Math.abs(facing) < 1e-9 || (material.side !== DoubleSide && facing <= 0)) continue;
      const projected = vertices.map(project);
      points.push(...projected);
      area += Math.abs(signedArea(projected));
      triangles++;
    }
    return { points, area, triangles };
  } finally {
    geometry.dispose();
  }
}

function expectMeshProjection(part: FurniturePart, color = "#abc123") {
  const expected = visibleMesh(part), faces = projectFurniturePart(part, color);
  expect(faces.length).toBeGreaterThan(0);
  expect(faces.reduce((sum, face) => sum + face.triangles, 0)).toBe(expected.triangles);
  expect(faceArea(faces)).toBeCloseTo(expected.area, 5);
  for (const point of faces.flatMap(face => face.loops.flat())) {
    expect(expected.points.some(candidate => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < 1e-6)).toBe(true);
  }
  for (const axis of [0, 1]) {
    const actual = faces.flatMap(face => face.loops.flat().map(point => point[axis]));
    expect(Math.min(...actual)).toBeCloseTo(Math.min(...expected.points.map(point => point[axis])), 5);
    expect(Math.max(...actual)).toBeCloseTo(Math.max(...expected.points.map(point => point[axis])), 5);
  }
  return { expected, faces };
}

afterEach(() => vi.restoreAllMocks());

describe("factory-backed furniture SVG projection", () => {
  it.each(FURNITURE_CATALOG)("projects $id into finite card bounds deterministically", item => {
    const projection = projectFurniture(item);
    expect(projection.faces.length).toBeGreaterThan(0);
    expect(projection.scale).toBeGreaterThan(0);
    expect([...projection.bounds.min, ...projection.bounds.max, projection.scale].every(Number.isFinite)).toBe(true);
    expect(projection).toEqual(projectFurniture(item));
    for (const face of projection.faces) {
      expect(face.path).not.toMatch(/NaN|Infinity/);
      expect(Number.isFinite(face.depth)).toBe(true);
      expect(face.loops.every(loop => loop.length >= 3)).toBe(true);
      const coordinates = face.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let i = 0; i < coordinates.length; i += 2) {
        expect(coordinates[i]).toBeGreaterThanOrEqual(6 - .001);
        expect(coordinates[i]).toBeLessThanOrEqual(94 + .001);
        expect(coordinates[i + 1]).toBeGreaterThanOrEqual(9 - .001);
        expect(coordinates[i + 1]).toBeLessThanOrEqual(79 + .001);
      }
    }
    expect(projection.faces.map(face => face.depth)).toEqual(projection.faces.map(face => face.depth).sort((a, b) => a - b));
  });

  const catalogTotals = new Map<string, { triangles: number; paths: number }>();
  it.each(FURNITURE_CATALOG)("preserves every $id part's visible triangle area", item => {
    let triangles = 0, paths = 0;
    for (const part of getFurnitureRecipe(item.id)!.parts) {
      const { expected, faces } = expectMeshProjection(part, item.color);
      expect(faceArea(faces), `${item.id}/${part.id}`).toBeCloseTo(expected.area, 5);
      expect(faces.reduce((sum, face) => sum + face.triangles, 0)).toBe(expected.triangles);
      triangles += expected.triangles;
      paths += faces.length;
    }
    catalogTotals.set(item.id, { triangles, paths });
  });

  it("reduces total catalog SVG elements below 75 percent of visible triangles", () => {
    expect(FURNITURE_CATALOG).toHaveLength(123);
    let triangles = 0, paths = 0;
    for (const item of FURNITURE_CATALOG) {
      let totals = catalogTotals.get(item.id);
      if (!totals) {
        totals = { triangles: 0, paths: 0 };
        for (const part of getFurnitureRecipe(item.id)!.parts) {
          totals.triangles += visibleMesh(part).triangles;
          totals.paths += projectFurniturePart(part, item.color).length;
        }
        catalogTotals.set(item.id, totals);
      }
      triangles += totals.triangles;
      paths += totals.paths;
    }
    expect(paths).toBeLessThan(triangles * .75);
  });

  it.each(["box", "cylinder", "sphere", "cone", "arch", "cup", "frustum", "ring", "crystal"] as const)("preserves actual %s triangle coverage without a primitive fallback", shape => {
    expectMeshProjection({ ...fixture, shape });
  });

  it("preserves rounded edges rather than replacing them with a box", () => {
    const rounded = { ...fixture, roundness: .32 };
    expectMeshProjection(rounded);
    expect(projectFurniturePart(rounded, "#abc123")).not.toEqual(projectFurniturePart(fixture, "#abc123"));
  });

  it("culls backfaces and merges box face triangles into three quads", () => {
    const faces = projectFurniturePart(fixture, "#abc123");
    expect(faces).toHaveLength(3);
    expect(faces.every(face => face.triangles === 2 && face.loops.length === 1 && face.loops[0].length === 4)).toBe(true);
  });

  it("projects indexed and nonindexed meshes identically", () => {
    const indexed = new BoxGeometry(...fixture.size), expanded = indexed.toNonIndexed();
    const factory = vi.spyOn(models, "createFurniturePartGeometry").mockReturnValueOnce(indexed).mockReturnValueOnce(expanded);
    expect(projectFurniturePart(fixture, "#abc123")).toEqual(projectFurniturePart(fixture, "#abc123"));
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("uses factory lean and XYZ rotation exactly once before mesh translation", () => {
    const transformed: FurniturePart = { ...fixture, position: [2.2, -1.5, 4.1], lean: [.8, -.4], rotation: [.2, .6, -.3] };
    expectMeshProjection(transformed);
    const original = new BoxGeometry(...fixture.size);
    try {
      const rotation = new Matrix4().makeRotationFromEuler(new Euler(...transformed.rotation!));
      const positions = original.getAttribute("position");
      const expected = Array.from({ length: positions.count }, (_, i) => {
        const point = new Vector3().fromBufferAttribute(positions, i);
        point.x += point.y / transformed.size[1] * transformed.lean![0];
        point.z += point.y / transformed.size[1] * transformed.lean![1];
        return project(point.applyMatrix4(rotation).add(new Vector3(...transformed.position)));
      });
      for (const point of projectFurniturePart(transformed, "#abc123").flatMap(face => face.loops.flat())) {
        expect(expected.some(candidate => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < 1e-6)).toBe(true);
      }
    } finally {
      original.dispose();
    }
  });

  it.each([["office-chair", "spoke-1"], ["tripod-lamp", "rear-leg"], ["trophy-cup", "bowl"], ["wall-mirror", "mirror"]])("matches repaired %s/%s geometry", (id, partId) => {
    expectMeshProjection(getFurnitureRecipe(id)!.parts.find(part => part.id === partId)!);
  });

  it("preserves ring holes and cup interiors while merging coplanar boundaries", () => {
    const ring = projectFurniturePart({ ...fixture, shape: "ring" }, "#abc123");
    expect(ring.some(face => face.loops.length === 2)).toBe(true);
    expectMeshProjection({ ...fixture, shape: "ring" });
    expectMeshProjection({ ...fixture, shape: "cup" });
  });

  it("keeps disconnected coplanar patches separate and skips degenerate triangles", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 3, 0, 0, 4, 0, 0, 3, 1, 0, 9, 9, 9, 9, 9, 9, 9, 9, 9], 3));
    vi.spyOn(models, "createFurniturePartGeometry").mockReturnValue(geometry);
    const faces = projectFurniturePart(fixture, "#abc123");
    expect(faces).toHaveLength(2);
    expect(faces.every(face => face.loops.length === 1 && face.loops[0].length === 3 && face.triangles === 1)).toBe(true);
    const middle = { ...faces[0], depth: (faces[0].depth + faces[1].depth) / 2, key: "occluder" };
    expect([...faces, middle].sort((a, b) => a.depth - b.depth).map(face => face.key)).toEqual([faces[0].key, "occluder", faces[1].key]);
  });

  it("retains actual triangles for ambiguous or quantization-collapsed boundaries", () => {
    const factory = vi.spyOn(models, "createFurniturePartGeometry");
    for (const vertices of [
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 0, 0, .0000004, 0, 0, 0, 1, 0],
    ]) {
      const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(vertices, 3));
      factory.mockReturnValue(geometry);
      const faces = projectFurniturePart(fixture, "#abc123");
      expect(faces).toHaveLength(vertices.length / 9);
      expect(faces.every(face => face.triangles === 1 && face.loops.length === 1 && face.loops[0].length === 3)).toBe(true);
      expect(faceArea(faces)).toBeGreaterThan(0);
    }
  });

  it("orders coincident projected opaque and transparent planes from back to front", () => {
    const factory = vi.spyOn(models, "createFurniturePartGeometry");
    const base = [new Vector3(-1, -1, 0), new Vector3(1, -1, 0), new Vector3(0, 1, 0)];
    const faces = [2, -2, 0].flatMap((depth, index) => {
      const vertices = base.flatMap(vertex => vertex.clone().addScaledVector(view, depth).toArray());
      factory.mockReturnValueOnce(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(vertices, 3)));
      return projectFurniturePart({ ...fixture, id: `layer-${depth}`, material: index === 0 ? "glass" : "wood" }, "#abc123");
    });
    const ordered = faces.sort((a, b) => a.depth - b.depth);
    expect(ordered.map(face => face.key.split("-").slice(0, -2).join("-"))).toEqual(["layer--2", "layer-0", "layer-2"]);
    expect(ordered.map(face => face.opacity)).toEqual([1, 1, .22]);
    ordered.forEach(face => face.loops[0].forEach((point, index) => {
      expect(point[0]).toBeCloseTo(project(base[index])[0], 6);
      expect(point[1]).toBeCloseTo(project(base[index])[1], 6);
    }));
  });

  it("honors DoubleSide rather than dropping inward-facing shade surfaces", () => {
    const part: FurniturePart = { ...fixture, shape: "frustum" };
    const double = projectFurniturePart(part, "#abc123");
    const properties = models.getFurnitureMaterialProperties(part, "#abc123", false, false);
    vi.spyOn(models, "getFurnitureMaterialProperties").mockReturnValue({ ...properties, side: 0 });
    const single = projectFurniturePart(part, "#abc123");
    expect(double.reduce((sum, face) => sum + face.triangles, 0)).toBeGreaterThan(single.reduce((sum, face) => sum + face.triangles, 0));
  });

  it.each([
    ["glass", undefined, "#a4d5df", .22],
    ["glass", "smoked-glass", "#243b48", 1],
    ["metal", "mirror", "#ecf5ff", 1],
    ["screen", "display", "#245c6c", 1],
    ["fabric", undefined, "#abc123", 1],
  ] as const)("preserves %s / %s surface tint and opacity", (material, surface, color, opacity) => {
    const faces = projectFurniturePart({ ...fixture, material, surface }, "#abc123");
    expect(faces.every(face => face.color === color && face.opacity === opacity && face.material === material && face.surface === surface)).toBe(true);
  });

  it("uses the shared inactive-preview material policy for display surfaces", () => {
    const properties = vi.spyOn(models, "getFurnitureMaterialProperties");
    const screen: FurniturePart = { ...fixture, material: "screen", surface: "display" };
    projectFurniturePart(screen, "#abc123");
    expect(properties).toHaveBeenCalledWith(screen, "#abc123", false, false);
  });

  it("disposes every temporary geometry exactly once", () => {
    const geometries: BufferGeometry[] = [];
    const original = models.createFurniturePartGeometry;
    vi.spyOn(models, "createFurniturePartGeometry").mockImplementation(part => {
      const geometry = original(part);
      vi.spyOn(geometry, "dispose");
      geometries.push(geometry);
      return geometry;
    });
    for (const item of FURNITURE_CATALOG) projectFurniture(item);
    expect(geometries.length).toBe(FURNITURE_CATALOG.reduce((sum, item) => sum + getFurnitureRecipe(item.id)!.parts.length, 0));
    for (const geometry of geometries) expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes geometry even when projection fails", () => {
    const geometry = new BoxGeometry();
    const dispose = vi.spyOn(geometry, "dispose");
    vi.spyOn(geometry, "getAttribute").mockImplementation(() => { throw new Error("invalid attribute"); });
    vi.spyOn(models, "createFurniturePartGeometry").mockReturnValue(geometry);
    expect(() => projectFurniturePart(fixture, "#abc123")).toThrow("invalid attribute");
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("caches immutable catalog definitions across card remounts without retaining geometry", () => {
    const factory = vi.spyOn(models, "createFurniturePartGeometry");
    const item = { ...FURNITURE_CATALOG[0] };
    const first = getFurnitureProjection(item);
    factory.mockClear();
    expect(getFurnitureProjection(item)).toBe(first);
    expect(factory).not.toHaveBeenCalled();
    expect(getFurnitureProjection({ ...item, color: "#ff0000" })).not.toEqual(first);
  });

  it("returns finite empty bounds for an unknown ID without substituting a shape", () => {
    expect(projectFurniture({ ...FURNITURE_CATALOG[0], id: "missing" })).toEqual({ faces: [], bounds: { min: [0, 0], max: [0, 0] }, scale: 1 });
  });
});
