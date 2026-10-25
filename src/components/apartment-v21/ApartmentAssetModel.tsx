"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { APARTMENT_ASSETS, getApartmentAsset, type ApartmentAssetId } from "./asset-registry";

export type ApartmentAssetModelProps = {
  assetId: ApartmentAssetId;
  position?: [number, number, number];
  rotation?: number;
  scale?: number | [number, number, number];
  ghost?: boolean;
  active?: boolean;
};

/** Shared GLB loader for Home and Showcase. */
export function ApartmentAssetModel({ assetId, position, rotation, scale, ghost = false, active = true }: ApartmentAssetModelProps) {
  const spec = getApartmentAsset(assetId);
  const { scene } = useGLTF(spec.url);
  const { copy, ownedMaterials } = useMemo(() => {
    const root = scene.clone(true);
    const owned: THREE.Material[] = [];
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // The GLTF cache owns its original materials. Normal furniture can share
      // them; only a ghost or disabled instance needs a private variation.
      if (!ghost && active) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = sourceMaterials.map(material => {
        const clone = material.clone();
        owned.push(clone);
        if (clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshPhysicalMaterial) {
          if (ghost) {
            clone.color.set(active ? "#426d78" : "#5d3447");
            clone.emissive.set(active ? "#12616c" : "#6b1837");
            clone.emissiveIntensity = 0.5;
            clone.transparent = true;
            clone.opacity = 0.42;
            clone.depthWrite = false;
          } else if (!active) {
            clone.emissive.set("#12070e");
            clone.emissiveIntensity = 0.08;
          }
        }
        return clone;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    return { copy: root, ownedMaterials: owned };
  }, [active, ghost, scene]);

  useEffect(() => () => ownedMaterials.forEach(material => material.dispose()), [ownedMaterials]);

  // Placement belongs to the caller's saved plan or fixture, never the asset.
  return <primitive object={copy} position={position ?? [0, 0, 0]} rotation={[0, rotation ?? 0, 0]} scale={scale} />;
}

export function preloadApartmentAssets() {
  Object.values(APARTMENT_ASSETS).forEach(asset => useGLTF.preload(asset.url));
}

