"use client";

import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Plot } from "@/construction/types";
import { RESIDENTIAL_CORRIDOR_DEPTH, NEIGHBOR_ROOM_DEPTH } from "./building-architecture";

/** Local canvas lettering avoids external font requests in the private/public preview. */
function ArchitecturalSign({ text, position, width, rotation = 0, small = false }: {
  text: string; position: [number, number, number]; width: number; rotation?: number; small?: boolean;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#202c36"; context.fillRect(0, 0, 1024, 128);
    context.strokeStyle = "#b6a184"; context.lineWidth = 3; context.strokeRect(8, 8, 1008, 112);
    context.fillStyle = "#f4d9ad"; context.font = `${small ? 52 : 60}px sans-serif`;
    context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 512, 67, 950);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; result.anisotropy = 4;
    return result;
  }, [text, small]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return <mesh name={`residential-sign-${text}`} position={position} rotation={[0, rotation, 0]} raycast={() => {}}>
    <planeGeometry args={[width, width / 8]}/>
    <meshBasicMaterial map={texture} toneMapped={false}/>
  </mesh>;
}

export const CorridorDetails = memo(function CorridorDetails({ plot, residenceFloor }: { plot: Plot; residenceFloor: number }) {
  const cx = (plot.minX + plot.maxX) / 2;
  const z = plot.maxZ + RESIDENTIAL_CORRIDOR_DEPTH;
  return <group name="residential-neighbor-addresses">
    {[-3.5, 3.5].map((offset, index) => <ArchitecturalSign key={offset} text={`${residenceFloor}0${index + 2}`} position={[cx + offset, 2.13, z - .235]} width={.75} rotation={Math.PI}/>) }
    <ArchitecturalSign text={`TẦNG ${residenceFloor}  ·  LIFT`} position={[cx, 2.58, z - .19]} width={1.22} rotation={Math.PI}/>
    <ArchitecturalSign text="AURELIA / RESIDENCES" position={[plot.minX + .15, 1.88, plot.maxZ + 1.2]} width={1.8} rotation={Math.PI / 2} small/>
    {[-4.3, 0, 4.3].map(offset => <pointLight key={offset} position={[cx + offset, 2.53, plot.maxZ + 1.25]} color="#ffcb8e" intensity={7} distance={5} decay={2}/>)}
  </group>;
});

export const TowerIdentity = memo(function TowerIdentity({ plot, groundY }: { plot: Plot; groundY: number }) {
  const cx = (plot.minX + plot.maxX) / 2;
  const z = plot.maxZ + RESIDENTIAL_CORRIDOR_DEPTH + NEIGHBOR_ROOM_DEPTH;
  return <group name="aurelia-residential-lobby">
    <ArchitecturalSign text="AURELIA RESIDENCES" position={[cx, groundY + 2.85, z + 2.28]} width={5.6}/>
    <ArchitecturalSign text="NEON HAVEN  /  DISTRICT 07" position={[cx, groundY + .43, z + .52]} width={2.7} small/>
    <pointLight position={[cx, groundY + 2.3, z + 1.3]} color="#ffd29f" intensity={35} distance={12} decay={2}/>
    <pointLight position={[plot.maxX + 2, groundY + 8, z + 4]} color="#b4c7e0" intensity={70} distance={24} decay={2}/>
  </group>;
});
