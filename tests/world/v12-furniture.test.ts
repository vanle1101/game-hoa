import { describe, expect, it, vi } from "vitest";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { FURNITURE_MODEL_IDS, getFurnitureDefinition, getFurniturePartBounds, getFurnitureRecipe } from "../../src/furniture/catalog";
import { createFurniturePartGeometry, FurnitureModel, HeroAssetModel, getFurnitureMaterialProperties, V12FixtureModel } from "../../src/components/world/furniture-models";
import { createV12SurfaceTexture, getV12FixtureRecipe, getV12FurnitureRecipe, getV12SurfaceProperties, V12_FIXTURE_IDS, V12_FURNITURE_IDS } from "../../src/components/world/v12-furniture";

vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useMemo: (factory: () => unknown) => factory(), useEffect: () => undefined }));

describe("V12 furniture detail layer", () => {
  it("uses actual catalog IDs and leaves every other recipe unchanged", () => {
    for (const id of V12_FURNITURE_IDS) expect(getFurnitureDefinition(id)).toBeDefined();
    for (const id of FURNITURE_MODEL_IDS) {
      const enhanced = getV12FurnitureRecipe(id)!;
      expect(enhanced.id).toBe(id);
      if (!(V12_FURNITURE_IDS as readonly string[]).includes(id)) expect(enhanced).toEqual(getFurnitureRecipe(id));
    }
    for (const id of ["", "toString", "__proto__"]) expect(getV12FurnitureRecipe(id)).toBeUndefined();
  });

  it.each(V12_FURNITURE_IDS)("%s contains unique finite real meshes within its saved footprint", id => {
    const definition = getFurnitureDefinition(id)!;
    const parts = getV12FurnitureRecipe(id)!.parts;
    expect(new Set(parts.map(part => part.id)).size).toBe(parts.length);
    expect(parts.length).toBeGreaterThan(getFurnitureRecipe(id)!.parts.length);
    for (const part of parts) {
      expect(part.position.every(Number.isFinite)).toBe(true);
      expect(part.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
      const geometry = createFurniturePartGeometry(part);
      try {
        geometry.computeBoundingBox();
        const bound = geometry.boundingBox!;
        const min = [bound.min.x, bound.min.y, bound.min.z], max = [bound.max.x, bound.max.y, bound.max.z];
        const lower = [-definition.width / 2, 0, -definition.depth / 2], upper = [definition.width / 2, definition.height, definition.depth / 2];
        for (let axis = 0; axis < 3; axis++) {
          expect(min[axis] + part.position[axis], `${id}/${part.id} lower ${axis}`).toBeGreaterThanOrEqual(lower[axis] - .00001);
          expect(max[axis] + part.position[axis], `${id}/${part.id} upper ${axis}`).toBeLessThanOrEqual(upper[axis] + .00001);
        }
        expect(geometry.getAttribute("normal").array.every(Number.isFinite)).toBe(true);
      } finally { geometry.dispose(); }
    }
  });

  it("builds layered bedding, individual keys, door hardware, organic foliage and ergonomic chair details", () => {
    const ids = (kind: string) => getV12FurnitureRecipe(kind)!.parts.map(part => part.id);
    expect(ids("cloud-bed")).toEqual(expect.arrayContaining(["v12-fitted-sheet", "v12-duvet", "v12-folded-duvet", "v12-foot-throw", "v12-sleep-pillow--1", "v12-accent-pillow-1"]));
    expect(ids("workstation").filter(id => id.startsWith("v12-key-"))).toHaveLength(44);
    expect(ids("wardrobe")).toContain("v12-center-reveal");
    expect(ids("office-chair")).toEqual(expect.arrayContaining(["v12-lumbar-pad", "v12-seat-control", "v12-back-spine"]));
    expect(getV12FurnitureRecipe("biolume-plant")!.parts.filter(part => part.contour === "leaf")).toHaveLength(9);
  });

  it("keeps a recessed kitchen sink rather than painting a solid countertop", () => {
    const definition = getFurnitureDefinition("kitchen-island")!;
    const parts = getV12FurnitureRecipe("kitchen-island")!.parts;
    expect(parts.some(part => part.id === "counter" || part.id === "cabinet")).toBe(false);
    const material = new MeshBasicMaterial();
    const meshes = parts.map(part => {
      const mesh = new Mesh(createFurniturePartGeometry(part), material);
      mesh.position.set(...part.position); mesh.name = part.id; mesh.updateMatrixWorld(true); return mesh;
    });
    try {
      const hits = new Raycaster(new Vector3(-.22 * definition.width, 2, .04), new Vector3(0, -1, 0)).intersectObjects(meshes);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeLessThan(.84 * definition.height);
    } finally { meshes.forEach(mesh => mesh.geometry.dispose()); material.dispose(); }
  });

  it("preserves interaction identity, propagation, ghost and active props", () => {
    const onInteract = vi.fn(), stopPropagation = vi.fn();
    const tree = FurnitureModel({ kind: "wardrobe", onInteract })!;
    expect(tree.type).toBe(HeroAssetModel);
    expect(tree.props.id).toBe("wardrobe");
    const loaded = HeroAssetModel({ id: "wardrobe", onInteract });
    expect(loaded.props.name).toBe("hero-asset:wardrobe");
    expect(loaded.props.userData).toMatchObject({ furnitureId: "wardrobe" });
    loaded.props.onClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(onInteract).toHaveBeenCalledWith(getFurnitureDefinition("wardrobe")!.interactions[0], getFurnitureDefinition("wardrobe"));
    const ghost = FurnitureModel({ kind: "workstation", ghost: true, active: false, onInteract })!;
    expect(ghost.props).toMatchObject({ id: "desk", ghost: true, active: false });
    expect(HeroAssetModel({ id: "desk", ghost: true, active: false, onInteract }).props.onClick).toBeUndefined();
    const display = getV12FurnitureRecipe("workstation")!.parts.find(part => part.id === "v12-screen-wallpaper")!;
    expect(getFurnitureMaterialProperties(display, "#ffffff", false, false).emissiveIntensity).toBe(0);
    expect(getFurnitureMaterialProperties(display, "#ffffff", true, true)).toMatchObject({ opacity: .38, depthWrite: false, emissiveIntensity: 0 });
    expect(getV12SurfaceProperties(display, true).color).toBeUndefined();
    expect(FurnitureModel({ kind: "unknown" })).toBeNull();
  });

  it.each(V12_FIXTURE_IDS)("%s is an authored physical fixture", kind => {
    if (kind === "coffee-table") expect(getFurnitureDefinition(kind)).toBeDefined();
    else expect(getFurnitureDefinition(kind)).toBeUndefined();
    const recipe = getV12FixtureRecipe(kind)!;
    expect(recipe.parts.length).toBeGreaterThan(6);
    expect(new Set(recipe.parts.map(part => part.id)).size).toBe(recipe.parts.length);
    expect(V12FixtureModel({ kind })!.props.name).toBe(`fixture:${kind}`);
    for (const part of recipe.parts) {
      expect(getFurniturePartBounds(part).min[1]).toBeGreaterThanOrEqual(-.00001);
      const geometry = createFurniturePartGeometry(part);
      expect(geometry.getAttribute("position").count).toBeGreaterThan(20);
      geometry.dispose();
    }
  });

  it("rejects prototype fixture lookups and produces deterministic reusable PBR bump maps", () => {
    for (const id of ["toString", "__proto__", "constructor", "unknown"]) expect(getV12FixtureRecipe(id)).toBeUndefined();
    for (const finish of ["linen", "oak", "stone", "ceramic"] as const) {
      const a = createV12SurfaceTexture(finish), b = createV12SurfaceTexture(finish);
      expect(a.image.width).toBe(64);
      expect(a.image.data).toEqual(b.image.data);
      expect(new Set(a.image.data).size).toBeGreaterThan(2);
      expect(getV12SurfaceProperties({ id: "test", shape: "box", position: [0, 0, 0], size: [1, 1, 1], material: "fabric", finish }, true).bumpScale).toBe(0);
      a.dispose(); b.dispose();
    }
  });
});
