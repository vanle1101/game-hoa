"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Plot } from "@/construction/types";
import { architectureCutaway, buildResidentialArchitecture, type ArchitectureBox, type BuildingSection } from "./building-architecture";
import { CorridorDetails, TowerIdentity } from "./ResidentialDetails";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const noRaycast: THREE.Object3D["raycast"] = () => {};

const EnvelopeInstances = memo(function EnvelopeInstances({ boxes, kind }: { boxes: ArchitectureBox[]; kind: "structure" | "glass" | "lights" }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), color = new THREE.Color();
    boxes.forEach((box, index) => {
      matrix.compose(new THREE.Vector3(...box.position), quaternion, new THREE.Vector3(...box.size));
      mesh.current?.setMatrixAt(index, matrix);
      mesh.current?.setColorAt(index, color.set(box.color));
    });
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true;
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
      mesh.current.computeBoundingSphere();
    }
  }, [boxes]);
  if (!boxes.length) return null;
  return <instancedMesh ref={mesh} args={[BOX, undefined, boxes.length]} dispose={null} raycast={noRaycast} receiveShadow castShadow={kind === "structure"}>
    {kind === "lights" ? <meshBasicMaterial toneMapped={false}/> : kind === "glass" ?
      <meshPhysicalMaterial roughness={.18} metalness={.12} transparent opacity={.24} depthWrite={false} clearcoat={1} side={THREE.DoubleSide}/> :
      <meshStandardMaterial roughness={.54} metalness={.3} emissive="#536271" emissiveIntensity={.12}/>}
  </instancedMesh>;
});

function Section({ section }: { section: BuildingSection }) {
  return <>{(["structure", "glass", "lights"] as const).map(kind => <EnvelopeInstances key={kind} boxes={section[kind]} kind={kind}/>)}</>;
}

export const BuildingEnvelope = memo(function BuildingEnvelope({ plot, residenceFloor = 16, editing }: { plot: Plot; residenceFloor?: 8 | 16 | 24; editing: boolean }) {
  const architecture = useMemo(() => buildResidentialArchitecture(plot, residenceFloor), [plot, residenceFloor]);
  const upper = useRef<THREE.Group>(null);
  const ceiling = useRef<THREE.Group>(null);
  const corridor = useRef<THREE.Group>(null);
  const shell = useMemo<BuildingSection>(() => {
    const cx = (plot.minX + plot.maxX) / 2, cz = (plot.minZ + plot.maxZ) / 2;
    const w = plot.maxX - plot.minX, d = plot.maxZ - plot.minZ;
    const structure: ArchitectureBox[] = [
      { position: [cx, 2.97, cz], size: [w + .3, .3, d + .3], color: "#414046" },
      ...[plot.minX + .18, plot.maxX - .18].map(x => ({ position: [x, 2.68, cz] as [number, number, number], size: [.28, .28, d] as [number, number, number], color: "#292f38" })),
      ...[plot.minZ + .18, plot.maxZ - .18].map(z => ({ position: [cx, 2.68, z] as [number, number, number], size: [w, .28, .28] as [number, number, number], color: "#292f38" })),
    ];
    const lights: ArchitectureBox[] = [
      ...[plot.minX + .34, plot.maxX - .34].map(x => ({ position: [x, 2.81, cz] as [number, number, number], size: [.035, .018, d - .7] as [number, number, number], color: "#f3bc7a" })),
      ...[plot.minZ + .34, plot.maxZ - .34].map(z => ({ position: [cx, 2.81, z] as [number, number, number], size: [w - .7, .018, .035] as [number, number, number], color: "#f3bc7a" })),
    ];
    for (const x of [-3, 0, 3]) for (const z of [-2, 2]) {
      structure.push({ position: [x, 2.79, z], size: [.26, .06, .26], color: "#1c242b" });
      lights.push({ position: [x, 2.752, z], size: [.15, .012, .15], color: "#f2d2a4" });
    }
    return { structure, lights, glass: [] };
  }, [plot]);
  useFrame(({ camera }) => {
    const cut = architectureCutaway(camera.position, plot, camera.userData.desktopCameraMode ?? (editing ? "build" : "follow"), editing);
    if (upper.current) upper.current.visible = !cut;
    if (ceiling.current) ceiling.current.visible = !cut;
    // The narrow circulation strip is hidden with the plan cutaway, never removed from the scene.
    if (corridor.current) corridor.current.visible = !cut;
  });
  return <group name="residential-building" userData={{ residenceFloor, apartmentElevation: architecture.elevation, totalFloors: 28 }}>
    <group name="building-below-residence"><Section section={architecture.lower}/><TowerIdentity plot={plot} groundY={architecture.groundY}/></group>
    <group name="building-above-residence" ref={upper} visible={!editing}><Section section={architecture.upper}/></group>
    <group name="apartment-structural-ceiling" ref={ceiling} visible={!editing}><Section section={shell}/></group>
    <group name="residence-lift-corridor" ref={corridor} visible={!editing}><Section section={architecture.corridor}/><CorridorDetails plot={plot} residenceFloor={residenceFloor}/></group>
  </group>;
});
