"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { PerspectiveCamera } from "three";

export type ResidencePreviewProps = {
  floor: 8 | 16 | 24;
  layoutId: "studio" | "one-bedroom" | "open-plan";
  mode: "city" | "floor" | "room";
  buildingId: string;
  performance?: boolean;
  onFloorChange?: (floor: 8 | 16 | 24) => void;
};

type Vector = [number, number, number];
const FLOORS = [8, 16, 24] as const;
const ACCENTS: Record<string, string> = { "neon-haven": "#51e5e1", "aurora-tower": "#b49aff", "skyline-residences": "#f2b680" };

function Block({ at, size, color = "#253242", glow = false }: { at: Vector; size: Vector; color?: string; glow?: boolean }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.82} metalness={.08} emissive={glow ? color : "#000000"} emissiveIntensity={glow ? .85 : 0} /></mesh>;
}

function Skyline() {
  return <group>
    <Block at={[0, -.35, -15]} size={[90, .5, 90]} color="#111b29" />
    {Array.from({ length: 22 }, (_, i) => {
      const x = ((i * 13) % 47) - 23, z = -12 - (i % 4) * 9, h = 5 + (i * 7) % 24;
      return <group key={i} position={[x, 0, z]}>
        <Block at={[0, h / 2, 0]} size={[2.5 + i % 3, h, 3]} color={i % 2 ? "#18273b" : "#263147"} />
        <Block at={[0, h + .1, 0]} size={[2.7 + i % 3, .16, 3.1]} color={i % 3 ? "#4a84ae" : "#a57bc1"} glow />
        {Array.from({ length: 5 }, (_, j) => <Block key={j} at={[0, 1.5 + j * h / 5, 1.53]} size={[1.8, .15, .03]} color={j % 2 ? "#d6ae7a" : "#bd9470"} glow />)}
      </group>;
    })}
    <Block at={[0, .05, -7]} size={[70, .06, .14]} color="#51c2d4" glow />
    <Block at={[0, 2.2, -18]} size={[65, .25, 1.1]} color="#425568" />
    <Block at={[0, 2.4, -17.4]} size={[65, .04, .05]} color="#b896de" glow />
  </group>;
}

function Tower({ floor, buildingId, onFloorChange }: Pick<ResidencePreviewProps, "floor" | "buildingId" | "onFloorChange">) {
  const accent = ACCENTS[buildingId] ?? ACCENTS["neon-haven"];
  return <group>
    <Block at={[0, 10.5, 0]} size={[6, 21, 4.8]} color="#273340" />
    <Block at={[0, 21.4, 0]} size={[6.7, .6, 5.4]} color="#38495a" />
    {Array.from({ length: 28 }, (_, i) => <group key={i} position={[0, i * .72 + .3, 0]}>
      <Block at={[0, 0, 2.44]} size={[5.7, .05, .12]} color="#586879" />
      {[-2, -.65, .65, 2].map((x, j) => <Block key={x} at={[x, .29, 2.43]} size={[.95, .43, .045]} color={(i + j) % 4 === 0 ? "#c8a783" : "#244957"} glow />)}
    </group>)}
    {FLOORS.map(value => <group key={value} position={[0, value * .72, 0]} onClick={event => { event.stopPropagation(); onFloorChange?.(value); }}>
      <Block at={[0, 0, 0]} size={[6.45, .12, 5.2]} color={floor === value ? accent : "#566980"} glow={floor === value} />
      {floor === value && <Block at={[0, .33, 2.62]} size={[6.1, .56, .05]} color={accent} glow />}
    </group>)}
    <Block at={[-3.08, 10.8, 2.48]} size={[.09, 21, .1]} color={accent} glow />
    <Block at={[3.08, 10.8, 2.48]} size={[.09, 21, .1]} color={accent} glow />
  </group>;
}

function PreviewFurniture({ kind }: { kind: "bed" | "desk" | "sofa" | "plant" | "lamp" }) {
  if (kind === "bed") return <group>
    <Block at={[0, .25, 0]} size={[2.6, .45, 3.15]} color="#947254" />
    <Block at={[0, .56, 0]} size={[2.5, .28, 3]} color="#f2e7d5" />
    <Block at={[0, .75, .5]} size={[2.52, .16, 1.9]} color="#80a79a" />
    <Block at={[0, .85, -1.5]} size={[2.7, 1.6, .15]} color="#b9956e" />
    {[-.65, .65].map(x => <Block key={x} at={[x, .8, -.92]} size={[1.05, .22, .62]} color="#fff3df" />)}
  </group>;
  if (kind === "sofa") return <group>
    <Block at={[0, .32, 0]} size={[2.9, .5, 1.12]} color="#c28b64" />
    <Block at={[0, .86, -.47]} size={[2.9, .85, .24]} color="#dfae82" />
    {[-1.35, 1.35].map(x => <Block key={x} at={[x, .65, 0]} size={[.22, .64, 1.16]} color="#dfae82" />)}
    {[-.85, 0, .85].map(x => <Block key={x} at={[x, .65, .03]} size={[.8, .18, .8]} color="#f0c79f" />)}
    <Block at={[-.85, .95, -.2]} size={[.45, .4, .2]} color="#649e91" />
  </group>;
  if (kind === "desk") return <group>
    <Block at={[0, .82, 0]} size={[2.3, .12, 1]} color="#d3ac7b" />
    {[-.95, .95].map(x => <Block key={x} at={[x, .4, 0]} size={[.12, .8, .75]} color="#758d89" />)}
    <Block at={[0, 1.25, -.25]} size={[1.3, .7, .09]} color="#344e59" />
    <Block at={[0, 1.25, -.195]} size={[1.15, .55, .025]} color="#90c1bd" glow />
    <Block at={[0, .94, -.25]} size={[.12, .25, .12]} color="#5c747a" />
    <Block at={[0, .91, .2]} size={[.85, .045, .26]} color="#ece0cc" />
  </group>;
  if (kind === "plant") return <group>
    <mesh position={[0, .3, 0]}><cylinderGeometry args={[.3, .22, .6, 12]} /><meshStandardMaterial color="#e6cbb0" roughness={.85} /></mesh>
    {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2) * .2, .95 + i % 2 * .2, Math.cos(i * 2) * .2]} rotation={[.2, i, .3]} scale={[.32, .65, .2]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color={i % 2 ? "#619c72" : "#8fbd87"} roughness={.9} /></mesh>)}
  </group>;
  return <group>
    <Block at={[0, .05, 0]} size={[.55, .1, .55]} color="#9b805e" />
    <Block at={[0, 1.05, 0]} size={[.055, 2.1, .055]} color="#b69b6e" />
    <mesh position={[0, 2, 0]}><cylinderGeometry args={[.26, .45, .5, 16]} /><meshStandardMaterial color="#ffe4b2" emissive="#ffd18a" emissiveIntensity={.45} roughness={.9} /></mesh>
  </group>;
}

function Room({ layoutId }: Pick<ResidencePreviewProps, "layoutId">) {
  const width = 12;
  const depth = 10;
  return <group>
    <Block at={[0, -.16, 0]} size={[width, .3, depth]} color="#222b38" />
    <Block at={[-width / 2, 1.5, 0]} size={[.18, 3, depth]} color="#374354" />
    <Block at={[0, .35, -depth / 2]} size={[width, .7, .16]} color="#2a3545" />
    {Array.from({ length: width * 2 }, (_, i) => <Block key={i} at={[-width / 2 + .25 + i * .5, .005, 0]} size={[.48, .012, depth]} color={i % 3 === 0 ? "#1c2635" : i % 3 === 1 ? "#232f40" : "#1a2330"} />)}
    <Block at={[-width / 2 + .12, .12, 0]} size={[.07, .24, depth]} color="#32e6f4" glow />
    <Block at={[0, .055, depth / 2 - 2]} size={[3.7, .06, 2.4]} color="#263445" />
    {[-.5, .5].map(side => <Block key={side} at={[side * (width - .2), 1.8, -depth / 2]} size={[.11, 3.5, .15]} color="#506477" />)}
    <Block at={[0, 3.5, -depth / 2]} size={[width, .13, .2]} color="#426377" />
    <Block at={[0, .73, -depth / 2]} size={[width, .035, .03]} color="#78cdd5" glow />
    <mesh position={[0, 2, -depth / 2]}><boxGeometry args={[width - .2, 2.5, .025]} /><meshStandardMaterial color="#6bb0bd" transparent opacity={.18} roughness={.1} metalness={.4} /></mesh>
    {layoutId === "one-bedroom" && <><Block at={[-1, 1.3, -2]} size={[.15, 2.6, 6]} color="#374354" /></>}
    {layoutId === "open-plan" && <Block at={[0, .85, -2]} size={[.15, 1.7, 2.6]} color="#374354" />}
    <group position={[-width / 2 + 1.8, 0, -depth / 2 + 2]}><PreviewFurniture kind="bed" /></group>
    <group position={[width / 2 - 2, 0, -depth / 2 + 1.2]}><PreviewFurniture kind="desk" /></group>
    <group position={[layoutId === "studio" ? .25 : 1.2, 0, depth / 2 - 2]} rotation={[0, Math.PI, 0]}><PreviewFurniture kind="sofa" /></group>
    <group position={[width / 2 - .9, 0, depth / 2 - 1.2]}><PreviewFurniture kind="plant" /></group>
    <group position={[width / 2 - .8, 0, .5]}><PreviewFurniture kind="lamp" /></group>
    <Block at={[-width / 2 + .6, .5, depth / 2 - 1.1]} size={[1, 1, 1.8]} color="#59606a" />
    <Block at={[-width / 2 + .6, 1.04, depth / 2 - 1.1]} size={[1.1, .09, 1.9]} color="#b7a38b" />
    <pointLight position={[-width / 2 + 2, 2.5, 0]} color="#ffbe7a" intensity={12} distance={10} />
    <pointLight position={[width / 2 - 2, 2.15, -depth / 2 + 1]} color="#47e6ff" intensity={4} distance={8} />
  </group>;
}

function updatePreviewProjection(camera: PerspectiveCamera, fov: number) {
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function CameraPosition({ mode, floor, layoutId, buildingId }: Pick<ResidencePreviewProps, "mode" | "floor" | "layoutId" | "buildingId">) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControlsType>(null);
  useEffect(() => {
    const height = floor * .72;
    if (mode === "room") camera.position.set(10.5, 10.5, 12.5);
    else camera.position.set(mode === "city" ? 25 : 18, height + 7, mode === "city" ? 33 : 25);
    camera.lookAt(0, mode === "room" ? .6 : height, 0);
    controls.current?.target.set(0, mode === "room" ? .6 : height, 0);
    controls.current?.update();
    camera.updateProjectionMatrix();
    invalidate(3);
  }, [camera, floor, invalidate, mode]);
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const fov = mode === "city" && gl.domElement.closest(".housing-welcome") ? 60 : 43;
    if (camera.fov === fov) return;
    updatePreviewProjection(camera, fov);
    invalidate(3);
  });
  useEffect(() => {
    const redraw = () => invalidate(3);
    const frame = requestAnimationFrame(redraw);
    gl.domElement.addEventListener("webglcontextrestored", redraw);
    document.addEventListener("visibilitychange", redraw);
    return () => {
      cancelAnimationFrame(frame);
      gl.domElement.removeEventListener("webglcontextrestored", redraw);
      document.removeEventListener("visibilitychange", redraw);
    };
  }, [buildingId, gl, invalidate, layoutId, mode, size.height, size.width]);
  return <OrbitControls ref={controls} enablePan={false} enableDamping={false} minDistance={mode === "room" ? 10 : 16} maxDistance={mode === "room" ? 32 : 58} minPolarAngle={.35} maxPolarAngle={Math.PI / 2.05} />;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="housing-preview-fallback" role="status">Không thể mở bản xem trước 3D trên thiết bị này. Bạn vẫn có thể chọn tầng và bố cục bằng các nút bên cạnh.</div> : this.props.children; }
}

export default function ResidencePreview({ floor, layoutId, mode, buildingId, performance = false, onFloorChange }: ResidencePreviewProps) {
  return <div className="housing-preview" data-preview-mode={mode} role="img" aria-label={mode === "room" ? `Bản xem trước 3D bố cục ${layoutId}` : `Tòa nhà 3D, tầng ${floor} đang được làm sáng. Góc nhìn thay đổi theo tầng.`}>
    <div className="housing-preview-canvas"><PreviewBoundary><Canvas frameloop="always" dpr={performance ? 1 : [1, 1.5]} camera={{ fov: 43, near: .1, far: 220, position: [22, 16, 30] }} gl={{ antialias: !performance, alpha: false }} fallback={<div className="housing-preview-fallback">Thiết bị không hỗ trợ WebGL. Các lựa chọn vẫn sử dụng được.</div>}>
      <color attach="background" args={[mode === "room" ? "#454b50" : "#30383d"]} />
      <fog attach="fog" args={[mode === "room" ? "#454b50" : "#30383d", 45, 110]} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#ead9c7", "#5a4b3e", 1.6]} />
      <directionalLight position={[8, 16, 10]} intensity={2.3} color="#ffe0b0" />
      <CameraPosition mode={mode} floor={floor} layoutId={layoutId} buildingId={buildingId} />
      {mode === "room" ? <><Room layoutId={layoutId} /><group position={[0, -floor * .72 * .65 - 10, -18]} scale={.65}><Skyline /></group></> : <><Skyline /><Tower floor={floor} buildingId={buildingId} onFloorChange={onFloorChange} /></>}
      
    </Canvas></PreviewBoundary></div>
    <div className="housing-preview-caption" aria-hidden="true"><span>{mode === "room" ? "BỐ CỤC 3D MINH HỌA" : "NEON HAVEN · DISTRICT 07"}</span><strong>{mode === "room" ? "Kéo để xoay · Cuộn để thu phóng" : `TẦNG ${floor} / 28`}</strong></div>
  </div>;
}
