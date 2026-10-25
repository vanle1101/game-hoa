"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DISTRICT_LOTS } from './v20/district-layout';
import { addDistrictStreets } from './v20/district-streets';
import { DistrictSky } from './v20/DistrictSky';
import { CanalWater } from './v20/CanalWater';
import { DistrictBuildings } from './v20/DistrictBuildings';
import { DistrictSkyline } from './v20/DistrictSkyline';

export type InstanceRotation = number | [number, number, number];

export type Instance = {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: InstanceRotation;
};

export type CityLayer = {
  structure: Instance[];
  glass: Instance[];
  cylinders: Instance[];
  crowns: Instance[];
  rings: Instance[];
  lights: Instance[];
};

export type TowerDescriptor = {
  id: number;
  layer: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  topY: number;
  archetype: number;
};

export const CITY_BASE_Y = -48;
export const APARTMENT_CORE_CLEARANCE = {
  minX: -16.5,
  maxX: 16.5,
  minZ: -16.5,
  maxZ: 16.5,
  maxCanyonTopY: -26.5,
} as const;

const inertRaycast: THREE.Object3D['raycast'] = () => {};

export function maxAllowedTopY(x: number, z: number, halfWidth = 0, halfDepth = 0): number {
  const minX = x - halfWidth;
  const maxX = x + halfWidth;
  const minZ = z - halfDepth;
  const maxZ = z + halfDepth;

  const overlapsCoreX = maxX > -17.5 && minX < 17.5;
  const overlapsCoreZ = maxZ > -16.5 && minZ < 36;
  if (overlapsCoreX && overlapsCoreZ) {
    return APARTMENT_CORE_CLEARANCE.maxCanyonTopY;
  }

  const overlapsRightOverlookX = maxX > 16.5 && minX < 25.5;
  const overlapsRightOverlookZ = maxZ > -13.5 && minZ < 25.5;
  if (overlapsRightOverlookX && overlapsRightOverlookZ) {
    return -6.8;
  }

  const overlapsFrontFlankZ = maxZ > 15.5 && minZ < 36;
  const overlapsInnerFlankX = maxX > -25.5 && minX < 25.5;
  if (overlapsFrontFlankZ && overlapsInnerFlankX) {
    return -18;
  }

  return Infinity;
}

/** V20: fixed lots with explicit streets and an open panorama. Quality controls
 * facade detail, never moves a building or fills a protected view corridor. */
export function buildCityScene(quality = "balanced"): { layers: CityLayer[]; towers: TowerDescriptor[] } {
  const layers: CityLayer[] = Array.from({ length: 3 }, () => ({ structure: [], glass: [], cylinders: [], crowns: [], rings: [], lights: [] }));
  const towers: TowerDescriptor[] = DISTRICT_LOTS.map(lot => ({ ...lot, topY: CITY_BASE_Y + lot.height }));
  void quality; // Identical surveyed architecture at every quality level.
  addDistrictStreets(layers[0]);
  return { layers, towers };
}

export function makeCity(quality = "balanced"): CityLayer[] {
  return buildCityScene(quality).layers;
}

type Variant = "structure" | "glass" | "cylinders" | "crowns" | "rings" | "lights";

function CityInstances({
  instances,
  layer,
  variant,
}: {
  instances: Instance[];
  layer: number;
  variant: Variant;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const luminous = variant === "lights" || variant === "rings";

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target || instances.length === 0) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    const atmosphere = new THREE.Color(layer === 2 ? "#211d42" : "#1c2244");

    for (let index = 0; index < instances.length; index++) {
      const instance = instances[index];
      transform.position.set(...instance.position);
      transform.scale.set(...instance.scale);
      if (Array.isArray(instance.rotation)) {
        transform.rotation.set(instance.rotation[0], instance.rotation[1], instance.rotation[2]);
      } else {
        transform.rotation.set(0, instance.rotation ?? 0, 0);
      }
      transform.updateMatrix();
      target.setMatrixAt(index, transform.matrix);

      color.set(instance.color);
      if (luminous) {
        color.multiplyScalar(1.14 - layer * 0.14);
      } else if (layer > 0) {
        color.lerp(atmosphere, layer * 0.14);
      }
      target.setColorAt(index, color);
    }

    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingBox();
    target.computeBoundingSphere();
  }, [instances, layer, luminous]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh ref={mesh} name={`city-${variant}-${layer}`} args={[undefined, undefined, instances.length]} raycast={inertRaycast}>
      {variant === "crowns" ? (
        <cylinderGeometry args={[0, 1, 1, 4, 1]} />
      ) : variant === "cylinders" ? (
        <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
      ) : variant === "rings" ? (
        <torusGeometry args={[0.5, 0.045, 8, 24]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      {luminous ? (
        <meshBasicMaterial toneMapped={false} fog={false} />
      ) : variant === "glass" ? (
        <meshStandardMaterial
          roughness={0.16}
          metalness={0.78}
          emissive="#163854"
          emissiveIntensity={0.28 + layer * 0.06}
          fog={false}
        />
      ) : variant === "cylinders" ? (
        <meshStandardMaterial
          roughness={0.46}
          metalness={0.48}
          emissive="#1d2f4a"
          emissiveIntensity={0.22 + layer * 0.07}
          fog={false}
        />
      ) : variant === "crowns" ? (
        <meshStandardMaterial
          roughness={0.5}
          metalness={0.42}
          emissive="#223654"
          emissiveIntensity={0.24 + layer * 0.08}
          fog={false}
        />
      ) : (
        <meshStandardMaterial
          roughness={0.72}
          metalness={0.28}
          emissive="#1c2c46"
          emissiveIntensity={0.2 + layer * 0.07}
          fog={false}
        />
      )}
    </instancedMesh>
  );
}

export function ApartmentCity({ quality = "balanced" }: { quality?: string }) {
  const layers = useMemo(() => makeCity(quality), [quality]);
  return (
    <group name="apartment-city">
      <DistrictSky />
      <CanalWater />
      <DistrictBuildings />
      <DistrictSkyline />
      {layers.map((layer, index) => (
        <group key={index} name={`city-${["near", "mid", "far"][index]}`}>
          <CityInstances instances={layer.structure} layer={index} variant="structure" />
          <CityInstances instances={layer.glass} layer={index} variant="glass" />
          <CityInstances instances={layer.cylinders} layer={index} variant="cylinders" />
          <CityInstances instances={layer.crowns} layer={index} variant="crowns" />
          <CityInstances instances={layer.rings} layer={index} variant="rings" />
          <CityInstances instances={layer.lights} layer={index} variant="lights" />
        </group>
      ))}
    </group>
  );
}
