import * as THREE from "three";
import { CSG } from "three-csg-ts";
import type { WallCutout } from "@/construction/wall-inserts";

/** Keep the source mesh and its material intact. All cutters are expressed in
 * its local wall axes: X along the segment, Y up, Z through its thickness. */
export function subtractWallInsertCutouts(
  wallMesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
  cutouts: readonly WallCutout[],
): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  let solid = wallMesh.clone();
  solid.geometry = wallMesh.geometry.clone();
  // CSG reuses operand materials. Give the entire cut wall and every cutter
  // one private, non-emissive material so a door/selection glow cannot leak
  // onto newly generated jamb and lintel faces.
  const safeWallMaterial = wallMesh.material.clone();
  if (safeWallMaterial instanceof THREE.MeshStandardMaterial) {
    safeWallMaterial.emissive.set(0x000000);
    safeWallMaterial.emissiveIntensity = 0;
  }
  solid.material = safeWallMaterial;
  solid.updateMatrixWorld(true);
  solid.geometry.computeBoundingBox();
  const bounds = solid.geometry.boundingBox!;
  const thickness = bounds.max.z - bounds.min.z;
  for (const cutout of cutouts) {
    // Do not let an invalid insert consume the lintel or extend past the wall.
    if (!Number.isFinite(cutout.width) || !Number.isFinite(cutout.height) ||
      cutout.width <= 0 || cutout.height <= 0 ||
      cutout.bottom < bounds.min.y - 1e-5 ||
      cutout.bottom + cutout.height >= bounds.max.y - 1e-5) continue;
    const holeGeometry = new THREE.BoxGeometry(cutout.width, cutout.height, thickness * 1.5);
    const hole = new THREE.Mesh(holeGeometry, safeWallMaterial);
    // The insert pivot is at its lower centre; BoxGeometry is centre-pivoted.
    hole.position.set(cutout.center, cutout.bottom + cutout.height / 2, 0);
    solid.updateMatrixWorld(true);
    hole.updateMatrixWorld(true);
    let result: THREE.Mesh<THREE.BufferGeometry>;
    try {
      result = CSG.subtract(solid, hole);
    } catch {
      // A numerically degenerate cutter must never remove the source wall.
      holeGeometry.dispose();
      continue;
    }
    result.material = safeWallMaterial;
    const positions = result.geometry.getAttribute("position");
    const renderable = !!positions && positions.count >= 3 && Array.from(positions.array).every(Number.isFinite);
    holeGeometry.dispose();
    if (!renderable) {
      result.geometry.dispose();
      continue;
    }
    // CSG groups include the cutter's BoxGeometry face indices. A single wall
    // material needs one explicit group, including all new inner reveal faces.
    result.geometry.clearGroups();
    result.geometry.addGroup(0, result.geometry.index?.count ?? positions.count, 0);
    // The cutter's own UVs otherwise paint its cap faces with an unrelated
    // patch of the wall texture. Project every face from the wall's local X/Y
    // coordinates so the wood grain continues across jambs and lintel.
    const uv = result.geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (uv) {
      const width = bounds.max.x - bounds.min.x;
      const height = bounds.max.y - bounds.min.y;
      for (let index = 0; index < positions.count; index++) {
        uv.setXY(index, (positions.getX(index) - bounds.min.x) / width, (positions.getY(index) - bounds.min.y) / height);
      }
      uv.needsUpdate = true;
    }
    solid.geometry.dispose();
    solid = result as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  }
  solid.material = safeWallMaterial;
  return solid;
}

/** A wall with an insert keeps its full-height top edge against the ceiling. */
export function visibleInsertWallHeight(requested: number, wallHeight: number, cutouts: readonly WallCutout[]): number {
  return cutouts.length ? wallHeight : requested;
}

/** Three.js clips the negative half-space of a local clipping plane. Keep
 * masonry below the camera cutaway cap, including the door's jambs. */
export function wallInsertClipPlane(capWorldY: number): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(0, -1, 0), capWorldY);
}
