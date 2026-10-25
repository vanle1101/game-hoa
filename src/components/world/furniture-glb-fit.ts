import { Box3, Vector3, type Object3D } from "three";

export type FurnitureTargetSize = Readonly<{ width: number; depth: number; height: number }>;

/** Fit the original, transformed GLB into its saved grid footprint without stretching it. */
export function fitFurnitureGlb(object: Object3D, target: FurnitureTargetSize) {
  object.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error("Furniture GLB has no geometry.");
  const size = bounds.getSize(new Vector3());
  if (Math.min(size.x, size.y, size.z) <= 1e-6) throw new Error("Furniture GLB has invalid dimensions.");
  const scale = Math.min(target.width / size.x, target.depth / size.z, target.height / size.y);
  const center = bounds.getCenter(new Vector3());
  return {
    scale,
    position: new Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale),
    dimensions: size.multiplyScalar(scale),
  };
}
