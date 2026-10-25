"use client";

import * as THREE from "three";

export function WallInsertItem({ kind, width, height, color, ghost = false }: { kind: "doors" | "windows"; width: number; height: number; color: string; ghost?: boolean }) {
  const frame = ghost ? "#32e6f4" : "#263a51";
  const metal = ghost ? "#32e6f4" : "#9cc4d1";
  const beam = 0.07;
  return <group name={`wall-insert:${kind}`}>
    {[-1, 1].map(side => <mesh key={side} position={[side * (width / 2 - beam / 2), height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[beam, height, 0.19]} /><meshStandardMaterial color={frame} metalness={0.65} roughness={0.28} />
    </mesh>)}
    {[beam / 2, height - beam / 2].map(y => <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, beam, 0.19]} /><meshStandardMaterial color={frame} metalness={0.65} roughness={0.28} />
    </mesh>)}
    <mesh position={[0, height / 2, 0]} receiveShadow>
      <boxGeometry args={[width - beam * 2, height - beam * 2, 0.035]} />
      <meshPhysicalMaterial color={color} metalness={0.34} roughness={0.08} transparent opacity={ghost ? 0.38 : kind === "windows" ? 0.3 : 0.46} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {[-1, 1].map(side => <mesh key={`divider-${side}`} position={[side * width * 0.19, height / 2, 0.024]} castShadow>
      <boxGeometry args={[0.026, height - 0.12, 0.05]} /><meshStandardMaterial color={metal} metalness={0.72} roughness={0.22} />
    </mesh>)}
    {kind === "doors" ? <>
      <mesh position={[0, height * 0.47, -0.06]} castShadow><boxGeometry args={[0.02, height * 0.9, 0.08]} /><meshStandardMaterial color={metal} metalness={0.7} roughness={0.23} /></mesh>
      {[-1, 1].map(side => <mesh key={`handle-${side}`} position={[0.12, height * 0.44, side * 0.1]} castShadow><boxGeometry args={[0.2, 0.035, 0.05]} /><meshStandardMaterial color="#e8d5ab" metalness={0.8} roughness={0.24} /></mesh>)}
      <mesh position={[-width * 0.34, height * 0.5, 0.06]}><planeGeometry args={[width * 0.22, height * 0.83]} /><meshStandardMaterial color="#8a749e" transparent opacity={0.58} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    </> : <mesh position={[0, height * 0.5, 0.06]}><boxGeometry args={[width - 0.12, 0.035, 0.05]} /><meshStandardMaterial color="#54e0ef" emissive="#25c9ee" emissiveIntensity={2.5} toneMapped={false} /></mesh>}
  </group>;
}
