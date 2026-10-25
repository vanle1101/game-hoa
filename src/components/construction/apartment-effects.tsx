"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, SSAO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { RoomEnvironment } from "three-stdlib";

function setEnvironment(scene: THREE.Scene, texture: THREE.Texture | null, intensity: number) {
  scene.environment = texture;
  scene.environmentIntensity = intensity;
}

export function ApartmentEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const map = generator.fromScene(room);
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    setEnvironment(scene, map.texture, 0.42);
    return () => {
      setEnvironment(scene, previous, previousIntensity);
      map.dispose();
      generator.dispose();
      room.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
    };
  }, [gl, scene]);
  return null;
}

/** Moderate bloom runs on balanced hardware; SSAO is reserved for high/ultra.
 * Performance mode uses the native renderer so WebGL startup stays reliable. */
export function ApartmentEffects({ quality }: { quality?: string }) {
  return <EffectComposer enabled multisampling={0} enableNormalPass={quality === "high" || quality === "ultra"} renderPriority={1}>
    {(quality === "high" || quality === "ultra") && <SSAO radius={0.18} intensity={18} worldDistanceThreshold={0.12} worldDistanceFalloff={0.08} />}
    <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} opacity={1} />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  </EffectComposer>;
}
