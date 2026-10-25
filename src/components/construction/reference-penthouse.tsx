"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { BuildingPlan } from "@/construction/types";
import { resolveApartmentAssetId } from "@/components/apartment-v21/asset-registry";
import { getFurnitureDefinition } from "@/furniture/catalog";
import { APARTMENT_ARCHITECTURE_ASSETS } from "@/components/apartment-v21";

/**
 * The reference layer is a presentation layer for the real Home renderer. It
 * never writes to the building plan, inventory or ownership. Furniture is
 * rendered once, from plan.furniture, by ConstructionWorld on every screen.
 */
export type ReferencePenthouseProps = {
  plan: BuildingPlan;
  enabled?: boolean;
};

function WarmStrip({ position, size, color = "#ff9f4d", intensity = 4 }: { position: [number, number, number]; size: [number, number, number]; color?: string; intensity?: number }) {
  return <mesh position={position} castShadow={false} raycast={() => {}}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
  </mesh>;
}

function SlatWall() {
  const slats = useMemo(() => Array.from({ length: 23 }, (_, index) => -5.25 + index * 0.22), []);
  return <group name="reference-walnut-slat-wall" position={[0, 0, -4.72]}>
    <mesh position={[-2.75, 1.45, 0]} raycast={() => {}}>
      <boxGeometry args={[5.15, 2.75, 0.14]} />
      <meshStandardMaterial color="#24120f" roughness={0.62} metalness={0.14} />
    </mesh>
    {slats.map(x => <mesh key={x} position={[x, 1.48, 0.11]} castShadow raycast={() => {}}>
      <boxGeometry args={[0.115, 2.78, 0.2]} />
      <meshStandardMaterial color="#38251f" roughness={0.52} metalness={0.12} />
    </mesh>)}
    <WarmStrip position={[-2.7, 2.67, 0.23]} size={[4.95, 0.035, 0.045]} />
    <WarmStrip position={[-2.7, 0.16, 0.23]} size={[4.95, 0.035, 0.045]} intensity={2.1} />
  </group>;
}

function KitchenWall() {
  const { scene } = useGLTF(APARTMENT_ARCHITECTURE_ASSETS.kitchenWall.url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  return <group name="reference-kitchen-wall" position={[-5.08, 0, 0.35]} rotation={[0, Math.PI / 2, 0]}>
    <primitive object={model} />
  </group>;
}

function PanoramaDetails() {
  const mullions = useMemo(() => Array.from({ length: 7 }, (_, index) => -5.4 + index * 1.8), []);
  return <group name="reference-panorama-details">
    {mullions.map(x => <mesh key={x} position={[x, 1.48, -4.93]} raycast={() => {}}>
      <boxGeometry args={[0.075, 2.82, 0.1]} />
      <meshStandardMaterial color="#1a202a" metalness={0.8} roughness={0.22} />
    </mesh>)}
    <mesh position={[0, 0.09, -4.91]} raycast={() => {}}>
      <boxGeometry args={[11.7, 0.15, 0.12]} />
      <meshStandardMaterial color="#171b23" metalness={0.82} roughness={0.2} />
    </mesh>
    <WarmStrip position={[0, 0.2, -4.88]} size={[11.1, 0.04, 0.045]} intensity={3.2} />
  </group>;
}

function GlassBathroom({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return <group name="reference-bathroom-glass" position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.014, 0.12]} receiveShadow raycast={() => {}}>
      <boxGeometry args={[2.46, 0.025, 2.25]} />
      <meshStandardMaterial color="#39343a" roughness={0.28} metalness={0.3} />
    </mesh>
    <mesh position={[0, 1.45, -0.56]} raycast={() => {}}>
      <boxGeometry args={[2.45, 2.7, 0.035]} />
      <meshPhysicalMaterial color="#a9d4e0" roughness={0.08} transparent opacity={0.1} depthWrite={false} metalness={0.12} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 1.45, 1.22]} raycast={() => {}}>
      <boxGeometry args={[2.45, 2.7, 0.035]} />
      <meshPhysicalMaterial color="#a9d4e0" roughness={0.08} transparent opacity={0.08} depthWrite={false} metalness={0.12} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[-1.17, 1.45, 0.27]} rotation={[0, Math.PI / 2, 0]} raycast={() => {}}>
      <boxGeometry args={[1.8, 2.7, 0.035]} />
      <meshPhysicalMaterial color="#a9d4e0" roughness={0.08} transparent opacity={0.1} depthWrite={false} metalness={0.12} side={THREE.DoubleSide} />
    </mesh>
    {[-1.18, 1.18].flatMap(x => [-0.58, 1.22].map(z => <mesh key={`${x}:${z}`} position={[x, 1.42, z]} raycast={() => {}}>
      <boxGeometry args={[0.055, 2.78, 0.055]} />
      <meshStandardMaterial color="#222735" metalness={0.75} roughness={0.22} />
    </mesh>))}
    <WarmStrip position={[0, 2.73, -0.61]} size={[2.32, 0.035, 0.04]} intensity={2.8} />
    <WarmStrip position={[0, 2.73, 1.2]} size={[2.32, 0.035, 0.04]} intensity={2.4} />
  </group>;
}

function ReferenceArchitecture({ bathroom, hasKitchen }: { bathroom: { position: [number, number, number]; rotation: number } | null; hasKitchen: boolean }) {
  return <group name="reference-penthouse-architecture">
    <SlatWall />
    {hasKitchen && <Suspense fallback={null}><KitchenWall /></Suspense>}
    <PanoramaDetails />
    {bathroom && <GlassBathroom {...bathroom} />}
    <group name="reference-entry-wall" position={[-5.74, 0, -2.05]}>
      <mesh position={[0, 1.42, 0]} castShadow raycast={() => {}}>
        <boxGeometry args={[0.18, 2.72, 2.1]} />
        <meshStandardMaterial color="#211d24" roughness={0.36} metalness={0.62} />
      </mesh>
      <mesh position={[0.1, 1.42, -0.64]} raycast={() => {}}>
        <boxGeometry args={[0.03, 1.75, 0.74]} />
        <meshStandardMaterial color="#6e4f48" roughness={0.46} metalness={0.3} />
      </mesh>
      <WarmStrip position={[0.12, 2.66, -0.65]} size={[0.045, 0.03, 0.7]} intensity={3.2} />
    </group>
  </group>;
}

export function ReferencePenthouseLayer({ plan, enabled = true }: ReferencePenthouseProps) {
  const bathroomItem = plan.furniture.find(item => resolveApartmentAssetId(item.furnitureId) === "bathroom");
  const bathroomDefinition = bathroomItem ? getFurnitureDefinition(bathroomItem.furnitureId) : undefined;
  const rotated = bathroomItem ? bathroomItem.rotation % 180 !== 0 : false;
  const bathroom = bathroomItem ? {
    position: [
      bathroomItem.x + Math.ceil(rotated ? bathroomDefinition?.depth ?? 2.2 : bathroomDefinition?.width ?? 2.5) / 2,
      0,
      bathroomItem.z + Math.ceil(rotated ? bathroomDefinition?.width ?? 2.5 : bathroomDefinition?.depth ?? 2.2) / 2,
    ] as [number, number, number],
    rotation: bathroomItem.rotation * Math.PI / 180,
  } : null;
  const hasKitchen = plan.furniture.some(item => resolveApartmentAssetId(item.furnitureId) === "kitchen");
  if (!enabled) return null;
  return <group name="reference-penthouse-layer">
    <ReferenceArchitecture bathroom={bathroom} hasKitchen={hasKitchen} />
    <pointLight name="reference-amber-key" position={[-1.1, 2.7, -2.5]} color="#ff9e57" intensity={4.2} distance={8} decay={2} />
    <pointLight name="reference-kitchen-amber" position={[-4.2, 2.3, 0.25]} color="#ffc083" intensity={3.1} distance={4.5} decay={2} />
    <pointLight name="reference-lounge-amber" position={[1.2, 1.6, 2.4]} color="#ffb56b" intensity={3.2} distance={6} decay={2} />
    <pointLight name="reference-city-magenta" position={[1.5, 2.2, -4.3]} color="#d441cf" intensity={0.95} distance={8} decay={2} />
    <pointLight name="reference-city-cyan" position={[4.8, 1.9, -4.1]} color="#28d7ff" intensity={0.2} distance={4.5} decay={2} />
  </group>;
}

