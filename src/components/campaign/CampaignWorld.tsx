"use client";

import { Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { CampaignMapNode } from "./CampaignMap";

type Vec = [number, number, number];
type Props = { nodes: CampaignMapNode[]; selectedId?: string; onSelect: (id: string) => void; quality: string };
function point(index: number, count: number): Vec {
  const columns = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(count * 1.5))));
  const row = Math.floor(index / columns), col = row % 2 ? columns - 1 - index % columns : index % columns;
  return [(col - (columns - 1) / 2) * 4.3, .38, (row - (Math.ceil(count / columns) - 1) / 2) * 4.4];
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="cm-world-loading">Bản đồ 3D không khả dụng. Chọn các dấu mốc trong danh sách bên dưới.</div> : this.props.children; }
}
function Tower({ x, z, index }: { x: number; z: number; index: number }) {
  const h = .8 + ((index * 17) % 11) * .23, w = .48 + (index % 3) * .16;
  const accent = index % 4 === 0 ? "#a461fc" : "#1b91b5";
  return <group position={[x, 0, z]}>
    <mesh position={[0, h / 2, 0]}><boxGeometry args={[w, h, w * .78]}/><meshStandardMaterial color={index % 2 ? "#152537" : "#101d30"} metalness={.6} roughness={.6}/></mesh>
    <mesh position={[0, h + .025, 0]}><boxGeometry args={[w + .06, .05, w * .78 + .06]}/><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5}/></mesh>
    {Array.from({ length: Math.floor(h / .3) }, (_, floor) => <mesh key={floor} position={[0, .25 + floor * .3, w * .391]}><boxGeometry args={[w * .65, .045, .012]}/><meshBasicMaterial color={index % 5 === 0 ? "#a48a5c" : "#267693"}/></mesh>)}
    {index % 3 === 0 && <mesh position={[0, h + .3, 0]}><cylinderGeometry args={[.018, .025, .6, 4]}/><meshBasicMaterial color={accent}/></mesh>}
  </group>;
}
function City({ nodes, selectedId, onSelect, quality }: Props) {
  const count = nodes.length, extent = Math.max(13, Math.ceil(count / 5) * 2.8 + 5);
  const positions = nodes.map((_, i) => point(i, count));
  const buildings = Array.from({ length: quality === "performance" ? 65 : 115 }, (_, i) => ({ x: ((i * 13) % 31 - 15) * .85, z: ((i * 7) % 29 - 14) * .78, i })).filter(({ x, z }) => !positions.some(([px, , pz]) => Math.abs(px - x) < 1.5 && Math.abs(pz - z) < 1.45));
  return <>
    <color attach="background" args={["#070f1e"]}/><fog attach="fog" args={["#070f1e", 25, 58]}/>
    <ambientLight intensity={1.3}/><directionalLight position={[5, 15, 6]} color="#8fcaff" intensity={2.5}/><pointLight position={[-9, 5, -6]} color="#a759ff" intensity={45}/><pointLight position={[6, 5, 5]} color="#1bccf3" intensity={40}/>
    <mesh position={[0, -.25, 0]}><boxGeometry args={[34, .45, Math.max(28, extent * 2)]}/><meshStandardMaterial color="#0b1628" metalness={.5} roughness={.7}/></mesh>
    <gridHelper args={[34, 34, "#17415a", "#12283a"]} position={[0, -.015, 0]}/>
    {[-10, -5, 0, 5, 10].map((x) => <mesh key={x} position={[x, .008, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.5, 27]}/><meshBasicMaterial color="#071020"/></mesh>)}
    {buildings.map(({ x, z, i }) => <Tower key={i} x={x} z={z} index={i}/>)}
    {positions.slice(1).map((to, index) => { const from = positions[index], done = nodes[index].done && nodes[index + 1].done; return <Line key={`path-${index}`} points={[from, [from[0], .38, (from[2] + to[2]) / 2], [to[0], .38, (from[2] + to[2]) / 2], to]} color={done ? "#39edec" : "#7456a8"} lineWidth={done ? 3 : 1.8} transparent opacity={done ? 1 : .65}/>; })}
    {nodes.map((node, index) => { const position = positions[index], selected = node.id === selectedId, color = node.done ? "#3aefdc" : selected ? "#ffd58d" : node.locked ? "#63708c" : "#a575f6"; return <group key={node.id} position={position}>
      <mesh position={[0, -.12, 0]}><cylinderGeometry args={[1.1, 1.35, .24, 6]}/><meshStandardMaterial color="#17273e" metalness={.6} roughness={.3}/></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.73, .82, 40]}/><meshBasicMaterial color={color}/></mesh>
      <mesh position={[0, selected ? .9 : .6, 0]} onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}><octahedronGeometry args={[selected ? .4 : .27, 0]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} metalness={.5} roughness={.25}/></mesh>
      <mesh position={[0, .3, 0]}><cylinderGeometry args={[.015, .015, .6, 6]}/><meshBasicMaterial color={color}/></mesh>
      <Html center position={[0, 1.6, 0]} distanceFactor={25} zIndexRange={[12, 1]}><button className={`cm-world-marker ${node.done ? "complete" : ""} ${selected ? "selected" : ""}`} aria-label={`Dấu mốc ${index + 1}: ${node.title}`} aria-pressed={selected} onClick={() => onSelect(node.id)}><b>{node.done ? "✓" : String(index + 1).padStart(2, "0")}</b><span>{node.title}</span></button></Html>
    </group>; })}
    <OrbitControls makeDefault target={[0, 0, 0]} minDistance={12} maxDistance={42} minPolarAngle={.3} maxPolarAngle={1.17} enablePan={false}/>
  </>;
}
export default function CampaignWorld(props: Props) {
  return <SceneBoundary><Canvas frameloop="demand" dpr={props.quality === "performance" ? 1 : [1, 1.5]} camera={{ position: [17, 22, 23], fov: 43 }} gl={{ antialias: props.quality !== "performance", alpha: false }} fallback={<div className="cm-world-loading">Trình duyệt không hỗ trợ bản đồ 3D. Chọn dấu mốc trong danh sách bên dưới.</div>}><City {...props}/></Canvas></SceneBoundary>;
}
