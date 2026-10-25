"use client";

import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

// RectAreaLight needs its shader chunk registered once before the first Canvas
// renders. Keeping this beside the procedural item also makes the fallback
// self-contained when it is used from the shop preview or construction world.
RectAreaLightUniformsLib.init();

export type LedStripItemProps = {
  width?: number;
  height?: number;
  depth?: number;
  neonColor?: string;
  ghost?: boolean;
  active?: boolean;
  lightDimmer?: number;
};

/** Procedural fallback for the catalog-only wall LED strip.
 *
 * The local +Z face is the illuminated side. ConstructionWorld already turns
 * this local frame toward the wall normal, so the same component works in the
 * shop preview, apartment scene and wall placement ghost.
 */
export function LedStripItem({
  width = 2.5,
  height = 0.12,
  depth = 0.08,
  neonColor = "#ff8c3b",
  ghost = false,
  active = true,
  lightDimmer = 3,
}: LedStripItemProps) {
  const color = ghost ? "#66b8c5" : neonColor;
  const opacity = ghost ? 0.52 : 1;
  const glowIntensity = active ? 4 * lightDimmer / 3 : 0;

  return (
    <group name="wall-led-strip" userData={{ proceduralFurniture: "wall_led_strip" }}>
      <mesh position={[0, 0, depth * 0.08]} castShadow={!ghost} receiveShadow={!ghost}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          metalness={0.2}
          roughness={0.28}
          emissive={neonColor}
          emissiveIntensity={glowIntensity}
          toneMapped={false}
          transparent={ghost}
          opacity={opacity}
          depthWrite={!ghost}
        />
      </mesh>
      <mesh position={[0, 0, depth * 0.58]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[Math.max(0.1, width * 0.94), Math.max(0.018, height * 0.42), Math.max(0.012, depth * 0.18)]} />
        <meshStandardMaterial
          color={neonColor}
          emissive={neonColor}
          emissiveIntensity={glowIntensity}
          toneMapped={false}
          transparent={ghost}
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      <rectAreaLight
        color={neonColor}
        intensity={ghost ? 0.5 : active ? 2 * lightDimmer / 3 : 0}
        width={Math.max(0.1, width * 0.9)}
        height={Math.max(0.03, height * 0.75)}
        position={[0, 0, depth * 0.72]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  );
}

export default LedStripItem;

