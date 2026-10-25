import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { Box3, BoxGeometry, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { DOOR_MODEL_IDS, DoorLeafModel, doorMotionKind, getDoorRecipe, type DoorModelId } from "../../src/components/construction/door-models";
import { wallParts } from "../../src/components/construction/render-geometry";
import { BUILDING_CATALOG, buildingItem } from "../../src/construction/catalog";
import { commitConstruction, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { buildingStateSchema } from "../../src/construction/schema";
import { findBuildingPath } from "../../src/construction/navigation";
import type { BuildingPlan, BuildingState } from "../../src/construction/types";

type ElementProps = {
  name?: string;
  children?: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  args?: number[];
  userData?: Record<string, unknown>;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
};
type ModelElement = ReactElement<ElementProps>;
const childElements = (node: ModelElement) => Children.toArray(node.props.children).filter(isValidElement) as ModelElement[];

function withLeaf(id: DoorModelId, check: (leaf: Group, width: number, height: number) => void) {
  const item = buildingItem(id)!;
  const width = item.openingWidth!, height = item.openingHeight!;
  const tree = DoorLeafModel({ catalogId: id, width, height, color: item.color }) as ModelElement;
  const leaf = new Group();
  for (const node of childElements(tree)) {
    const [geometryNode, materialNode] = childElements(node);
    const args = geometryNode.props.args!;
    const geometry = geometryNode.type === "boxGeometry"
      ? new BoxGeometry(args[0], args[1], args[2])
      : new CylinderGeometry(args[0], args[1], args[2], args[3]);
    const material = new MeshStandardMaterial({ opacity: materialNode.props.opacity, transparent: materialNode.props.transparent, depthWrite: materialNode.props.depthWrite });
    const mesh = new Mesh(geometry, material);
    mesh.name = node.props.name!;
    mesh.position.set(...node.props.position!);
    mesh.rotation.copy(new Euler(...node.props.rotation!));
    mesh.userData = node.props.userData!;
    leaf.add(mesh);
  }
  leaf.updateMatrixWorld(true);
  try { check(leaf, width, height); }
  finally {
    leaf.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        (object.material as MeshStandardMaterial).dispose();
      }
    });
  }
}

const basePlan = (): BuildingPlan => ({
  floors: [{ x: 0, z: 0, level: 0, materialId: "floor-concrete" }, { x: 1, z: 0, level: 0, materialId: "floor-concrete" }],
  walls: [{ x: 1, z: 0, level: 0, orientation: "z", materialId: "wall-basic" }],
  ceilings: [], roofs: [], stairs: [], furniture: [], roomNames: {},
});
const baseBuilding = (): BuildingState => ({
  version: 1, revision: 0, plot: { minX: -5, maxX: 5, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 },
  plan: basePlan(), paid: {}, starterGrantApplied: true, migratedAt: "2026-01-01T00:00:00.000Z", legacyPlacementsPreserved: true,
});
const context = { gold: 10000, characterLevel: 10, ownedFurniture: {}, defeatedCampaign: true };

describe("eight single-leaf door models", () => {
  it("covers exactly eight doors, preserving six legacy prices, dimensions, and motion modes", () => {
    expect(BUILDING_CATALOG.filter(item => item.category === "door").map(item => item.id)).toEqual([...DOOR_MODEL_IDS]);
    expect(BUILDING_CATALOG).toHaveLength(34);
    expect(DOOR_MODEL_IDS.slice(0, 6).map(id => {
      const item = buildingItem(id)!;
      return [id, item.price, item.openingWidth, item.openingHeight, doorMotionKind(id)];
    })).toEqual([
      ["door-standard", 100, 0.82, 2.2, "hinged"], ["door-sliding", 130, 0.86, 2.25, "sliding"],
      ["door-glass", 150, 0.86, 2.3, "hinged"], ["door-auto", 190, 0.88, 2.3, "sliding"],
      ["door-security", 220, 0.8, 2.2, "hinged"], ["door-neon", 280, 0.88, 2.4, "sliding"],
    ]);
    for (const id of DOOR_MODEL_IDS.slice(6)) {
      const item = buildingItem(id)!;
      expect(item.name).toMatch(/[ửỗớ]/);
      expect(item.description.length).toBeGreaterThan(20);
      expect(item.openingWidth).toBeGreaterThan(0);
      expect(item.openingWidth).toBeLessThan(1);
      expect(item.openingHeight).toBeLessThan(2.8);
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it("derives distinct signatures from actual geometry, never IDs or recoloring", () => {
    const recipes = DOOR_MODEL_IDS.map(id => getDoorRecipe(id)!);
    expect(new Set(recipes.map(recipe => recipe.geometrySignature)).size).toBe(8);
    for (const recipe of recipes) {
      expect(recipe.partCount).toBe(recipe.parts.length);
      expect(recipe.partCount).toBeGreaterThanOrEqual(12);
      expect(recipe.geometrySignature).toBe(JSON.stringify(recipe.parts.map(({ shape, position, size, rotation }) => [shape, position, size, rotation])));
      expect(recipe.geometrySignature).not.toContain(recipe.id);
      expect(new Set(recipe.parts.map(part => part.id)).size).toBe(recipe.partCount);
      expect(recipe.parts.filter(part => part.id.startsWith("hinge-") && part.shape === "cylinder").length).toBe(recipe.motion === "hinged" ? 3 : 0);
    }
    expect(getDoorRecipe("door-louver")!.parts.filter(part => part.id.startsWith("vent-slat-"))).toHaveLength(10);
    expect(getDoorRecipe("door-craftsman")!.parts.filter(part => part.material === "glass")).toHaveLength(3);
    expect(getDoorRecipe("door-auto")!.parts.filter(part => part.id.startsWith("sensor-lens-"))).toHaveLength(2);
    expect(getDoorRecipe("door-security")!.parts.filter(part => part.id.startsWith("viewport-bar-"))).toHaveLength(3);
  });

  it("returns independent deterministic recipes and rejects unknown IDs or invalid sizes", () => {
    const original = getDoorRecipe("door-standard")!;
    const signature = original.geometrySignature;
    original.parts[0].size[0] = 999;
    expect(getDoorRecipe("door-standard")!.geometrySignature).toBe(signature);
    expect(getDoorRecipe("door-standard")!.parts[0].size[0]).not.toBe(999);
    for (const id of ["", "door-unknown", "constructor", "__proto__"]) {
      expect(getDoorRecipe(id)).toBeUndefined();
      expect(DoorLeafModel({ catalogId: id, width: 0.8, height: 2.2, color: "#ffffff" })).toBeNull();
    }
    for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
      expect(getDoorRecipe("door-standard", value, 2.2)).toBeUndefined();
      expect(getDoorRecipe("door-standard", 0.8, value)).toBeUndefined();
    }
  });

  it.each(DOOR_MODEL_IDS)("%s renders every recipe part with finite dimensions and independent glass opacity", id => {
    const recipe = getDoorRecipe(id, 0.86, 2.3)!;
    const tree = DoorLeafModel({ catalogId: id, width: 0.86, height: 2.3, color: "#abcdef", frameOpacity: 0.61, glassOpacity: 0.17 }) as ModelElement;
    const nodes = childElements(tree);
    expect(nodes).toHaveLength(recipe.partCount);
    for (const [index, node] of nodes.entries()) {
      const part = recipe.parts[index];
      expect(node.props.name).toBe(part.id);
      expect(node.props.position).toEqual(part.position);
      expect(node.props.rotation).toEqual(part.rotation);
      expect(part.position.every(Number.isFinite)).toBe(true);
      expect(part.rotation.every(Number.isFinite)).toBe(true);
      expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
      const [geometry, material] = childElements(node);
      expect(geometry.type).toBe(part.shape === "box" ? "boxGeometry" : "cylinderGeometry");
      expect(geometry.props.args).toEqual(part.shape === "box" ? part.size : [part.size[0] / 2, part.size[0] / 2, part.size[1], 12]);
      expect(material.type).toBe("meshStandardMaterial");
      expect(material.props.opacity).toBe(part.material === "glass" ? 0.17 : 0.61);
      expect(material.props.depthWrite).toBe(false);
      expect(node.props.userData?.isOpeningGlass).toBe(part.material === "glass");
    }
  });

  it.each(DOOR_MODEL_IDS)("%s fits its closed opening and clears the passage under existing single-leaf transforms", id => {
    withLeaf(id, (leaf, width, height) => {
      const local = new Box3().setFromObject(leaf, true);
      expect(local.min.x).toBeGreaterThanOrEqual(0);
      expect(local.max.x).toBeLessThanOrEqual(width);
      expect(local.min.y).toBeGreaterThanOrEqual(0);
      expect(local.max.y).toBeLessThanOrEqual(height);
      expect(local.min.z).toBeGreaterThanOrEqual(-0.08);
      expect(local.max.z).toBeLessThanOrEqual(0.08);
      expect(local.min.z + local.max.z).toBeCloseTo(0, 6);
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        leaf.position.x = -width / 2 + (doorMotionKind(id) === "sliding" ? width * progress : 0);
        leaf.rotation.y = doorMotionKind(id) === "hinged" ? -Math.PI * 0.52 * progress : 0;
        leaf.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(leaf, true);
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.max.y).toBeLessThanOrEqual(height);
        if (progress === 0) {
          expect(bounds.min.x).toBeGreaterThanOrEqual(-width / 2);
          expect(bounds.max.x).toBeLessThanOrEqual(width / 2);
        }
        if (progress === 1) {
          if (doorMotionKind(id) === "sliding") expect(bounds.min.x).toBeGreaterThanOrEqual(width / 2);
          else expect(bounds.max.x).toBeLessThan(-width / 2 + 0.08);
          for (const x of [-width / 2 + 0.09, 0, width / 2 - 0.04]) {
            for (const y of [0.2, 1, height - 0.12]) {
              const hits = new Raycaster(new Vector3(x, y, -1.2), new Vector3(0, 0, 1), 0, 2.4).intersectObject(leaf, true);
              expect(hits, `${id} passage ${x},${y}`).toHaveLength(0);
            }
          }
        }
      }
    });
  });

  it.each(["door-glass", "door-auto", "door-security", "door-neon", "door-craftsman"] as const)("%s uses real glazed apertures without opaque backing", id => {
    withLeaf(id, leaf => {
      const glass = leaf.children.filter(mesh => mesh.userData.isOpeningGlass) as Mesh[];
      const opaque = leaf.children.filter(mesh => !mesh.userData.isOpeningGlass);
      expect(glass.length).toBeGreaterThan(0);
      for (const pane of glass) {
        const bounds = new Box3().setFromObject(pane, true);
        let unobstructed = 0;
        for (const fx of [0.17, 0.37, 0.67, 0.83]) {
          for (const fy of [0.17, 0.37, 0.67, 0.83]) {
            const ray = new Raycaster(new Vector3(bounds.min.x + (bounds.max.x - bounds.min.x) * fx, bounds.min.y + (bounds.max.y - bounds.min.y) * fy, -0.2), new Vector3(0, 0, 1));
            expect(ray.intersectObject(pane)).not.toHaveLength(0);
            if (ray.intersectObjects(opaque, false).length === 0) unobstructed++;
          }
        }
        expect(unobstructed, `${id}/${pane.name}`).toBeGreaterThanOrEqual(8);
      }
    });
  });

  it("louver blades leave actual ventilation gaps instead of an opaque backing panel", () => {
    withLeaf("door-louver", (leaf, width, height) => {
      let gaps = 0, blades = 0;
      for (let index = 0; index < 120; index++) {
        const y = height * (0.39 + index / 120 * 0.51);
        const hits = new Raycaster(new Vector3(width / 2, y, -0.2), new Vector3(0, 0, 1)).intersectObject(leaf, true);
        if (hits.length) blades++; else gaps++;
      }
      expect(blades).toBeGreaterThan(20);
      expect(gaps).toBeGreaterThan(20);
    });
  });
});

describe("door catalog placement, pricing, navigation, and persistence", () => {
  it.each(DOOR_MODEL_IDS)("%s validates, quotes, commits, and survives serialized save round trips", id => {
    const building = baseBuilding();
    const plan = basePlan();
    plan.walls[0].opening = { kind: "door", catalogId: id };
    expect(validateConstruction(building, plan, context)).toEqual(plan);
    const item = buildingItem(id)!;
    const quote = quoteConstruction(building, plan, context.gold);
    expect(quote.cost).toBe(item.price);
    expect(quote.added).toBe(1);
    expect(quote.refund).toBe(0);
    const committed = commitConstruction(building, plan, 0, context);
    expect(committed.building.revision).toBe(1);
    expect(committed.quote.remainingGold).toBe(context.gold - item.price);
    const restored = buildingStateSchema.parse(JSON.parse(JSON.stringify(committed.building)));
    expect(restored).toEqual(committed.building);
    expect(restored.plan.walls[0].opening).toEqual({ kind: "door", catalogId: id });
    expect(quoteConstruction(restored, restored.plan, context.gold).cost).toBe(0);
    expect(quoteConstruction(restored, basePlan(), context.gold).refund).toBe(Math.floor(item.price / 2));
    expect(findBuildingPath(plan, { x: 0, z: 0, level: 0 }, { x: 1, z: 0, level: 0 })).toHaveLength(2);
    const parts = wallParts(plan.walls[0]);
    for (const x of [-item.openingWidth! * 0.4, 0, item.openingWidth! * 0.4]) {
      for (const y of [0.1, item.openingHeight! / 2, item.openingHeight! - 0.01]) {
        expect(parts.some(part => Math.abs(part.x - x) < part.width / 2 && Math.abs(part.y - y) < part.height / 2)).toBe(false);
      }
    }
  });

  it("keeps level, campaign, affordability, and unsupported-placement validation", () => {
    for (const id of ["door-louver", "door-craftsman", "door-neon"] as const) {
      const plan = basePlan();
      plan.walls[0].opening = { kind: "door", catalogId: id };
      expect(() => validateConstruction(baseBuilding(), plan, { ...context, characterLevel: 1, defeatedCampaign: false })).toThrow("not unlocked");
      expect(() => commitConstruction(baseBuilding(), plan, 0, { ...context, gold: 0 })).toThrow("more Gold");
      plan.floors = [];
      expect(() => validateConstruction(baseBuilding(), plan, context)).toThrow("existing floor edge");
    }
  });
});
