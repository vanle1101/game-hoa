import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { CYBERPUNK_DESK_URL, getFurnitureDefinition } from "@/furniture/catalog";
import { fitFurnitureGlb } from "./furniture-glb-fit";

describe("Cyberpunk desk GLB", () => {
  it("is the model used by the existing workstation item and contains authored emissive textures", () => {
    expect(getFurnitureDefinition("workstation")?.modelUrl).toBe(CYBERPUNK_DESK_URL);
    const bytes = readFileSync(`public${CYBERPUNK_DESK_URL}`);
    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    expect(bytes.readUInt32LE(4)).toBe(2);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
    expect(gltf.meshes.length).toBeGreaterThan(0);
    expect(gltf.images.length).toBeGreaterThan(0);
    expect(gltf.materials.some((material: { emissiveTexture?: object }) => material.emissiveTexture)).toBe(true);
  });

  it("fits a transformed model inside the grid and rests on the floor", () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(6, 4, 3), new MeshStandardMaterial());
    mesh.position.set(8, 5, -4);
    root.add(mesh);
    const fit = fitFurnitureGlb(root, { width: 2.3, depth: 1, height: 1.7 });
    root.scale.setScalar(fit.scale);
    root.position.copy(fit.position);
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0, 6);
    expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0, 6);
    expect(size.x).toBeLessThanOrEqual(2.3);
    expect(size.z).toBeCloseTo(1, 6);
    expect(size.y).toBeLessThanOrEqual(1.7);
  });
});
