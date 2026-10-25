"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { FurnitureTargetSize } from "./furniture-glb-fit";
import { fitFurnitureGlb } from "./furniture-glb-fit";

type Props = FurnitureTargetSize & { url: string; ghost?: boolean; active?: boolean; neonColor?: string; lightDimmer?: number };

/** Shared by Shop preview and every saved furniture placement in Home/Build/Lobby. */
export function FurnitureGLBModel({ url, width, depth, height, ghost = false, active = true, neonColor = "#00f0ff", lightDimmer = 3 }: Props) {
  const { scene } = useGLTF(url);
  const { object, ownedMaterials, dimensions } = useMemo(() => {
    const object = scene.clone(true);
    const fit = fitFurnitureGlb(object, { width, depth, height });
    const ownedMaterials: THREE.Material[] = [];
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = !ghost;
      child.receiveShadow = !ghost;
      const source = Array.isArray(child.material) ? child.material : [child.material];
      const materials = source.map(material => {
        // Every instance gets private materials: the GLB cache remains immutable
        // while neon selection and PBR tuning can differ per placement.
        const copy = material.clone();
        ownedMaterials.push(copy);
        const glowSurface = /led|neon|light|screen|emissive/i.test(`${child.name} ${material.name}`)
          || (material instanceof THREE.MeshStandardMaterial && Boolean(material.emissiveMap));
        if (ghost) {
          copy.transparent = true;
          copy.opacity = 0.4;
          copy.depthWrite = false;
          if (copy instanceof THREE.MeshStandardMaterial) copy.emissiveIntensity = 0.3;
        } else if (copy instanceof THREE.MeshStandardMaterial) {
          copy.roughness = Math.max(copy.roughness, 0.4);
          copy.metalness = Math.max(0.2, Math.min(1, copy.metalness));
          if (glowSurface) {
            // Keep authored maps, but tint their emissive channel with the
            // player's selected color so Bloom can pick up the LED surfaces.
            copy.emissive.set(neonColor);
            copy.emissiveIntensity = active ? 4 * lightDimmer / 3 : 0;
          }
        }
        return copy;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });
    object.scale.setScalar(fit.scale);
    object.position.copy(fit.position);
    return { object, ownedMaterials, dimensions: fit.dimensions };
  }, [scene, width, depth, height, ghost, active, neonColor, lightDimmer]);

  useEffect(() => () => ownedMaterials.forEach(material => material.dispose()), [ownedMaterials]);
  return <group name="furniture-glb-neon-rig">
    <primitive object={object} />
    {!ghost && active && <>
      <pointLight color={neonColor} intensity={2 * lightDimmer / 3} distance={Math.max(2.5, dimensions.x + dimensions.z)} decay={2} position={[0, 0.08, 0]} />
      <pointLight color={neonColor} intensity={1.5 * lightDimmer / 3} distance={Math.max(2, dimensions.x)} decay={2} position={[0, Math.min(0.7, dimensions.y * 0.45), -dimensions.z * 0.35]} />
    </>}
  </group>;
}
