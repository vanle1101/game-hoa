"use client";

import { useMemo } from "react";
import * as THREE from "three";

type TowerSpec = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  tier: number;
  accent: "cyan" | "violet" | "amber";
  side?: boolean;
};

const TOWERS: TowerSpec[] = [
  { x: -19, z: -34, width: 4.8, depth: 4.3, height: 21, tier: 0, accent: "cyan" },
  { x: -11, z: -47, width: 5.4, depth: 5.5, height: 29, tier: 1, accent: "violet" },
  { x: -2, z: -29, width: 3.6, depth: 3.8, height: 18, tier: 2, accent: "amber" },
  { x: 7, z: -43, width: 6.2, depth: 5.7, height: 35, tier: 3, accent: "cyan" },
  { x: 17, z: -30, width: 4.2, depth: 4.2, height: 25, tier: 1, accent: "violet" },
  { x: -29, z: -54, width: 7, depth: 6, height: 42, tier: 2, accent: "cyan" },
  { x: -16, z: -67, width: 8, depth: 7, height: 50, tier: 3, accent: "violet" },
  { x: -4, z: -64, width: 6, depth: 5, height: 38, tier: 0, accent: "amber" },
  { x: 10, z: -62, width: 7, depth: 6, height: 45, tier: 2, accent: "cyan" },
  { x: 22, z: -54, width: 7.2, depth: 6, height: 53, tier: 3, accent: "violet", side: true },
  { x: 31, z: -39, width: 5.4, depth: 5, height: 34, tier: 1, accent: "amber", side: true },
  { x: 37, z: -60, width: 8, depth: 7, height: 47, tier: 2, accent: "cyan", side: true },
];

const PALETTE = ["#10172a", "#121d35", "#182544", "#1b2947", "#202e4d"];
const ACCENTS = { cyan: "#25d9ef", violet: "#9c62ff", amber: "#ffae58" } as const;

function Windows({ width, height, depth, side = false, color }: { width: number; height: number; depth: number; side?: boolean; color: string }) {
  const transforms = useMemo(() => {
    const list: THREE.Matrix4[] = [];
    const span = side ? depth : width;
    const columns = Math.max(1, Math.floor(span / 1.25));
    const rows = Math.max(1, Math.floor(height / 2.35));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((row * 7 + column * 11) % 9 === 0) continue;
        const horizontal = -span / 2 + 0.7 + column * (span / columns);
        const y = 1.7 + row * 2.35;
        const matrix = new THREE.Matrix4();
        matrix.compose(
          side ? new THREE.Vector3(-width / 2 - 0.014, y, horizontal) : new THREE.Vector3(horizontal, y, depth / 2 + 0.014),
          new THREE.Quaternion(),
          side ? new THREE.Vector3(0.018, 0.38, 0.72) : new THREE.Vector3(0.72, 0.38, 0.018),
        );
        list.push(matrix);
      }
    }
    return list;
  }, [depth, height, side, width]);
  const ref = (node: THREE.InstancedMesh | null) => {
    if (!node) return;
    transforms.forEach((matrix, index) => node.setMatrixAt(index, matrix));
    node.instanceMatrix.needsUpdate = true;
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, transforms.length || 1]} frustumCulled>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.86} />
    </instancedMesh>
  );
}

function Tower({ spec }: { spec: TowerSpec }) {
  const accent = ACCENTS[spec.accent];
  const body = PALETTE[spec.tier % PALETTE.length];
  const crownHeight = spec.tier === 3 ? 4 : spec.tier === 2 ? 2.6 : 1.5;
  return (
    <group name="v18-city-tower" position={[spec.x, 0, spec.z]}>
      <mesh position={[0, spec.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.width, spec.height, spec.depth]} />
        <meshStandardMaterial color={body} roughness={0.82} metalness={0.2} />
      </mesh>
      <Windows width={spec.width} height={spec.height} depth={spec.depth} color={accent} side={spec.side} />
      <mesh position={[0, spec.height + crownHeight / 2, 0]} castShadow>
        <boxGeometry args={[spec.width * (spec.tier === 3 ? 0.42 : 0.6), crownHeight, spec.depth * 0.55]} />
        <meshStandardMaterial color="#121a32" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, spec.height + crownHeight + 1.2, 0]}>
        <boxGeometry args={[0.08, 2.4, 0.08]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[spec.width / 2 + 0.03, spec.height * 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.05, spec.height * 0.8, 0.05]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {spec.tier >= 2 && (
        <mesh position={[0, spec.height * 0.22, spec.depth / 2 + 0.025]}>
          <boxGeometry args={[spec.width * 0.74, 0.08, 0.05]} />
          <meshBasicMaterial color={accent} toneMapped={false} transparent opacity={0.72} />
        </mesh>
      )}
    </group>
  );
}

function BridgesAndWater() {
  return (
    <group name="v18-water-and-bridges">
      <mesh position={[4, -0.35, -61]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 18]} />
        <meshStandardMaterial color="#15134a" emissive="#281c78" emissiveIntensity={0.45} roughness={0.35} metalness={0.35} />
      </mesh>
      {[-57, -62, -67].map((z, index) => (
        <group key={z} position={[4, 0.04 + index * 0.06, z]} rotation={[0, 0.035 * index, 0]}>
          <mesh>
            <boxGeometry args={[70, 0.12, 0.34]} />
            <meshBasicMaterial color={index === 1 ? "#e85bff" : "#4ee8f5"} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[70, 0.035, 0.08]} />
            <meshBasicMaterial color="#ffb25f" toneMapped={false} transparent opacity={0.58} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WindowEnvironment() {
  return (
    <group name="v18-window-environment">
      <group name="v18-rear-skyline">
        {TOWERS.filter((tower) => !tower.side).map((tower) => (
          <Tower key={tower.x + ":" + tower.z} spec={tower} />
        ))}
      </group>
      <group name="v18-right-skyline">
        {TOWERS.filter((tower) => tower.side).map((tower) => (
          <Tower key={tower.x + ":" + tower.z} spec={tower} />
        ))}
      </group>
      <BridgesAndWater />
      <mesh name="v18-atmospheric-haze" position={[2, 23, -75]}>
        <planeGeometry args={[90, 48]} />
        <meshBasicMaterial color="#33205e" transparent opacity={0.14} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default WindowEnvironment;

