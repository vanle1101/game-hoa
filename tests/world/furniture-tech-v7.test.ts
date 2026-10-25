import { describe, expect, it } from "vitest";
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createFurniturePartGeometry, getFurnitureMaterialProperties } from "../../src/components/world/furniture-models";
import { FURNITURE_CATALOG, getFurniturePartBounds, getFurnitureRecipe, type FurnitureDefinition, type FurniturePart } from "../../src/furniture/catalog";
import { TECH_V7_CATALOG, TECH_V7_RECIPES } from "../../src/furniture/collection-tech-v7";

const epsilon = 1e-6;
function scaleParts(parts: readonly FurniturePart[], definition: FurnitureDefinition): FurniturePart[] {
  const scale = [definition.width, definition.height, definition.depth];
  return parts.map(part => ({ ...part,
    position: part.position.map((value, i) => value * scale[i]) as [number, number, number],
    size: part.size.map((value, i) => value * scale[i]) as [number, number, number],
    ...(part.lean ? { lean: [part.lean[0] * scale[0], part.lean[1] * scale[2]] as const } : {}),
  }));
}
function signature(parts: readonly FurniturePart[]): string {
  const bounds = parts.map(getFurniturePartBounds);
  const minimum = [0, 1, 2].map(axis => Math.min(...bounds.map(bound => bound.min[axis])));
  const extent = [0, 1, 2].map(axis => Math.max(...bounds.map(bound => bound.max[axis])) - minimum[axis]);
  const rounded = (value: number) => Number(value.toFixed(6));
  return JSON.stringify(parts.map(part => JSON.stringify({
    shape: part.shape,
    position: part.position.map((value, axis) => rounded((value - minimum[axis]) / extent[axis])),
    size: part.size.map((value, axis) => rounded(value / extent[axis])),
    rotation: part.rotation ?? [0, 0, 0], roundness: part.roundness ?? 0,
    lean: part.lean ? [rounded(part.lean[0] / extent[0]), rounded(part.lean[1] / extent[2])] : [0, 0],
  })).sort());
}
function touches(a: Box3, b: Box3): boolean {
  return a.min.x <= b.max.x + epsilon && a.max.x + epsilon >= b.min.x
    && a.min.y <= b.max.y + epsilon && a.max.y + epsilon >= b.min.y
    && a.min.z <= b.max.z + epsilon && a.max.z + epsilon >= b.min.z;
}

const landmarks: Record<string, string[]> = {
  "v7-ladder-shelf": ["sloping-post-1", "tapered-shelf-3", "rear-brace"],
  "v7-shoe-cubby": ["seat-pad", "upright-0.15", "end-grip-1"],
  "v7-parcel-locker": ["keypad", "letter-slot", "latch-2"],
  "v7-apothecary": ["label-frame-2-2", "pull-0-0", "plinth"],
  "v7-record-rack": ["record-divider-0", "equipment-shelf", "retaining-rail"],
  "v7-stepped-shelf": ["cap-0", "cap-1", "cap-2"],
  "v7-coat-valet": ["hanger-rail", "hook-tip-1", "tray"],
  "v7-desktop-tower": ["fan-hub-0", "usb-port--0.19", "service-window"],
  "v7-projector-pedestal": ["lens-glass", "input-port", "cable-column"],
  "v7-turntable-console": ["platter", "tonearm", "cartridge"],
  "v7-scanner-printer": ["scanner-lid", "output-tray", "control-display"],
  "v7-robot-dock": ["robot-body", "lidar", "contact-1"],
  "v7-air-purifier": ["outlet-fin-0", "status-strip", "vent-9"],
  "v7-reel-recorder": ["reel-hub-1", "tape-bridge", "head-block"],
  "v7-info-terminal": ["card-reader", "keyboard", "service-port"],
  "v7-synthesizer": ["white-key-11", "black-key-10", "audio-port"],
  "v7-paper-lantern": ["diffuser", "shade-rib-0.5-1", "top-handle"],
  "v7-cantilever-lamp": ["arm", "shade", "switch"],
  "v7-shoji-light": ["diffuser", "horizontal-lattice-0.54", "foot-1"],
  "v7-uplight-bowl": ["uplight-bowl", "opal-disc", "dimmer"],
  "v7-twin-globe": ["opal-globe-0", "opal-globe-1", "arm-1"],
  "v7-task-arm": ["lower-arm", "upper-arm", "elbow"],
  "v7-reading-column": ["cubby-roof", "light-hood", "book"],
  "v7-candle-cluster": ["tray-rim", "candle-1", "flame-2"],
  "v7-louver-bollard": ["light-core", "louver-0.82", "cap"],
};

describe("V7 storage, electronics and lighting collection", () => {
  it("exports exactly 25 matched recipes with seven storage, nine electronics and nine lights", () => {
    expect(TECH_V7_CATALOG).toHaveLength(25);
    expect(new Set(TECH_V7_CATALOG.map(item => item.id)).size).toBe(25);
    expect(Object.keys(TECH_V7_RECIPES).sort()).toEqual(TECH_V7_CATALOG.map(item => item.id).sort());
    expect(TECH_V7_CATALOG.reduce<Record<string, number>>((counts, item) => { counts[item.category] = (counts[item.category] ?? 0) + 1; return counts; }, {})).toEqual({ storage: 7, electronics: 9, light: 9 });
    expect(Object.keys(landmarks).sort()).toEqual(Object.keys(TECH_V7_RECIPES).sort());
  });

  it("does not duplicate existing or new structure after discarding color, material, IDs and overall scale", () => {
    const signatures = new Map<string, string>();
    for (const definition of FURNITURE_CATALOG.filter(item => !TECH_V7_RECIPES[item.id])) {
      signatures.set(signature(getFurnitureRecipe(definition.id)!.parts), definition.id);
    }
    for (const definition of TECH_V7_CATALOG) {
      const parts = TECH_V7_RECIPES[definition.id]();
      const key = signature(parts);
      expect(signatures.get(key), definition.id).toBeUndefined();
      signatures.set(key, definition.id);
      expect(signature(scaleParts(parts, definition)), definition.id).toBe(key);
      expect(signature(parts.map(part => ({ ...part, id: `renamed-${part.id}`, material: "gold" }))), definition.id).toBe(key);
    }
  });

  it.each(TECH_V7_CATALOG)("$id has Vietnamese metadata, positive Gold economy and working interactions", definition => {
    expect(definition.id).toMatch(/^v7-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(definition.name).toMatch(/[^\u0000-\u007f]/);
    expect(definition.description).toMatch(/[^\u0000-\u007f]/);
    expect(definition.description.length).toBeGreaterThan(30);
    expect(definition.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const value of [definition.width, definition.height, definition.depth, definition.price, definition.level]) {
      expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThan(0);
    }
    expect(Number.isInteger(definition.price)).toBe(true);
    expect(definition.price).toBeLessThanOrEqual(1000);
    expect(Number.isInteger(definition.level)).toBe(true);
    expect(definition.level).toBeLessThanOrEqual(10);
    expect(definition.interactions).toHaveLength(1);
    expect(definition.interactions[0]).toMatchObject(definition.category === "storage"
      ? { id: "store", screen: "inventory" }
      : { id: definition.category === "light" ? "light" : "power", screen: "focus", toggle: true });
  });

  it.each(TECH_V7_CATALOG)("$id has fresh deterministic supported parts and functional landmarks", definition => {
    const first = TECH_V7_RECIPES[definition.id](), second = TECH_V7_RECIPES[definition.id]();
    expect(first).toEqual(second); expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(7); expect(first.length).toBeLessThanOrEqual(48);
    expect(new Set(first.map(part => part.id)).size).toBe(first.length);
    expect(first.map(part => part.id)).toEqual(expect.arrayContaining(landmarks[definition.id]));
    first.forEach((part, index) => {
      expect(part).not.toBe(second[index]); expect(part.position).not.toBe(second[index].position);
      expect(part.size).not.toBe(second[index].size);
      expect(["box", "cylinder", "sphere", "cone", "frustum", "cup", "ring", "arch", "crystal"]).toContain(part.shape);
      expect(["finish", "wood", "metal", "fabric", "cushion", "glass", "screen", "glow", "leaf", "gold", "dark", "paper"]).toContain(part.material);
      expect(part.position.every(Number.isFinite)).toBe(true);
      expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
      expect((part.lean ?? []).every(Number.isFinite)).toBe(true);
      expect((part.rotation ?? []).every(Number.isFinite)).toBe(true);
      if (part.radialSegments !== undefined) { expect(Number.isInteger(part.radialSegments)).toBe(true); expect(part.radialSegments).toBeGreaterThanOrEqual(3); expect(part.radialSegments).toBeLessThanOrEqual(32); }
    });
  });

  it.each(TECH_V7_CATALOG)("$id builds finite bounded geometry within budgets, normalized and dimension-scaled", definition => {
    const normalized = TECH_V7_RECIPES[definition.id]();
    for (const [parts, scale] of [[normalized, [1, 1, 1]], [scaleParts(normalized, definition), [definition.width, definition.height, definition.depth]]] as const) {
      const minimum = [-scale[0] / 2, 0, -scale[2] / 2], maximum = [scale[0] / 2, scale[1], scale[2] / 2];
      let triangles = 0;
      const actualBounds: Box3[] = [];
      for (const part of parts) {
        const declared = getFurniturePartBounds(part), geometry = createFurniturePartGeometry(part);
        try {
          const vertices = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
          expect(Array.from(vertices.array).every(Number.isFinite), `${definition.id}/${part.id}/vertices`).toBe(true);
          expect(Array.from(normals.array).every(Number.isFinite), `${definition.id}/${part.id}/normals`).toBe(true);
          const count = geometry.getIndex()?.count ?? vertices.count;
          expect(count % 3).toBe(0); triangles += count / 3;
          geometry.computeBoundingBox(); geometry.computeBoundingSphere();
          expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
          const actual = geometry.boundingBox!.clone().translate(new Vector3(...part.position));
          actualBounds.push(actual);
          for (let axis = 0; axis < 3; axis++) {
            const label = `${definition.id}/${part.id}/axis-${axis}`;
            expect(declared.min[axis], label).toBeGreaterThanOrEqual(minimum[axis] - epsilon);
            expect(declared.max[axis], label).toBeLessThanOrEqual(maximum[axis] + epsilon);
            expect(actual.min.getComponent(axis), label).toBeGreaterThanOrEqual(declared.min[axis] - epsilon);
            expect(actual.max.getComponent(axis), label).toBeLessThanOrEqual(declared.max[axis] + epsilon);
            expect(actual.max.getComponent(axis) - actual.min.getComponent(axis), label).toBeGreaterThan(0);
          }
          let area = 0;
          const index = geometry.getIndex(), a = new Vector3(), b = new Vector3(), c = new Vector3();
          for (let i = 0; i < count; i += 3) {
            a.fromBufferAttribute(vertices, index ? index.getX(i) : i);
            b.fromBufferAttribute(vertices, index ? index.getX(i + 1) : i + 1);
            c.fromBufferAttribute(vertices, index ? index.getX(i + 2) : i + 2);
            area += b.sub(a).cross(c.sub(a)).length() / 2;
          }
          expect(area, `${definition.id}/${part.id}/area`).toBeGreaterThan(1e-8);
        } finally { geometry.dispose(); }
      }
      expect(triangles, definition.id).toBeLessThanOrEqual(6000);
      const grounded = actualBounds.flatMap((bounds, index) => bounds.min.y <= epsilon ? [index] : []);
      expect(grounded.length, `${definition.id}/ground`).toBeGreaterThan(0);
      const reached = new Set(grounded);
      for (let pass = 0; pass < parts.length; pass++) {
        actualBounds.forEach((bounds, index) => { if ([...reached].some(other => touches(bounds, actualBounds[other]))) reached.add(index); });
      }
      expect(parts.filter((_, index) => !reached.has(index)).map(part => part.id), `${definition.id}/disconnected-bounds`).toEqual([]);
    }
  });

  it("joins hollow shades, louvers and equipment mounts at actual mesh surfaces", () => {
    const probes: readonly [string, string, string, readonly [number, number, number], readonly [number, number, number]][] = [
      ["v7-cantilever-lamp", "shade", "shade-spoke", [-1, .86, 0], [1, 0, 0]],
      ["v7-cantilever-lamp", "shade", "diffuser", [-1, .688, 0], [1, 0, 0]],
      ["v7-uplight-bowl", "uplight-bowl", "opal-disc", [-1, .925, 0], [1, 0, 0]],
      ["v7-louver-bollard", "louver-0.7", "post-1--1", [.28, .7, -1], [0, 0, 1]],
      ["v7-reel-recorder", "body", "reel-1", [.25, .77, -1], [0, 0, 1]],
      ["v7-robot-dock", "robot-lid", "lidar", [0, -1, .16], [0, 1, 0]],
      ["v7-turntable-console", "record", "stylus", [.06, -1, .14], [0, 1, 0]],
    ];
    for (const [id, first, second, origin, direction] of probes) {
      const recipe = TECH_V7_RECIPES[id](), material = new MeshBasicMaterial({ side: DoubleSide });
      const meshes = [first, second].map(name => {
        const part = recipe.find(entry => entry.id === name)!;
        const mesh = new Mesh(createFurniturePartGeometry(part), material);
        mesh.position.set(...part.position); mesh.updateMatrixWorld(true); return mesh;
      });
      try {
        const ray = new Raycaster(new Vector3(...origin), new Vector3(...direction));
        const intervals = meshes.map(mesh => {
          const distances = ray.intersectObject(mesh, false).map(hit => hit.distance).filter((value, index, values) => index === 0 || value - values[index - 1] > epsilon);
          expect(distances.length, `${id}/${mesh.name}/surface crossings`).toBeGreaterThanOrEqual(2);
          expect(distances.length % 2).toBe(0);
          return distances.flatMap((value, index) => index % 2 === 0 ? [[value, distances[index + 1]]] : []);
        });
        expect(intervals[0].some(a => intervals[1].some(b => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]) + epsilon)), `${id}/${first}/${second}/surface contact`).toBe(true);
      } finally { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); }
    }
  });

  it("uses warm localized diffusers rather than emissive whole light frames", () => {
    for (const definition of TECH_V7_CATALOG.filter(item => item.category === "light")) {
      const [red, green, blue] = [1, 3, 5].map(offset => parseInt(definition.color.slice(offset, offset + 2), 16));
      expect(red).toBeGreaterThan(green); expect(green).toBeGreaterThan(blue);
      const parts = TECH_V7_RECIPES[definition.id](), diffusers = parts.filter(part => part.material === "glow");
      expect(diffusers.length).toBeGreaterThan(0); expect(diffusers.length).toBeLessThan(parts.length / 2);
      for (const part of diffusers) {
        expect(getFurnitureMaterialProperties(part, definition.color, false, true).emissiveIntensity).toBeGreaterThan(0);
        expect(getFurnitureMaterialProperties(part, definition.color, false, false).emissiveIntensity).toBe(0);
      }
    }
  });
});
