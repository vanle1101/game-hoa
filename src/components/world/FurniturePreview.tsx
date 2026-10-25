"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Box3, Vector3 } from "three";
import { fitPreviewBox } from "./preview-framing";
import { getFurnitureDefinition, getFurniturePartBounds, getFurnitureRecipe } from "@/furniture/catalog";
import { FurnitureModel } from "./furniture-models";

export type FurniturePreviewProps = { kind: string; resetKey?: number; neonColor?: string };
type CameraCommand = { type: "left" | "right" | "in" | "out" | "reset"; sequence: number };

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="furniture-preview-loading" role="status">Không thể hiển thị 3D trên thiết bị này. Bạn vẫn có thể xem hình minh họa và thông tin món đồ.</div> : this.props.children;
  }
}

function PreviewScene({ kind, resetKey, command, neonColor }: { kind: string; resetKey: number; command: CameraCommand; neonColor?: string }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, invalidate, size } = useThree();
  const bounds = useMemo(() => {
    const definition = getFurnitureDefinition(kind);
    if (definition?.modelUrl && kind === "workstation") return new Box3(
      new Vector3(-definition.width / 2, 0, -definition.depth / 2),
      new Vector3(definition.width / 2, definition.height, definition.depth / 2),
    );
    const box = new Box3();
    for (const part of getFurnitureRecipe(kind)?.parts ?? []) {
      const partBounds = getFurniturePartBounds(part);
      box.expandByPoint(new Vector3(...partBounds.min));
      box.expandByPoint(new Vector3(...partBounds.max));
    }
    return box.isEmpty() ? new Box3(new Vector3(-.5, 0, -.5), new Vector3(.5, 1, .5)) : box;
  }, [kind]);
  const aspect = size.width / Math.max(1, size.height);
  const framing = useMemo(() => fitPreviewBox(bounds, aspect), [bounds, aspect]);
  const radius = bounds.getSize(new Vector3()).length() * .5;
  const { center, distance, position } = framing;

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.target.copy(center);
    camera.position.copy(position);
    camera.lookAt(center);
    orbit.update();
    orbit.saveState();
    invalidate();
  }, [center, position, camera, invalidate, resetKey]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit || command.sequence === 0) return;
    const offset = camera.position.clone().sub(orbit.target);
    if (command.type === "reset") orbit.reset();
    else if (command.type === "left" || command.type === "right") {
      offset.applyAxisAngle(new Vector3(0, 1, 0), command.type === "left" ? -Math.PI / 8 : Math.PI / 8);
      camera.position.copy(orbit.target).add(offset);
    } else {
      const nextDistance = Math.min(orbit.maxDistance, Math.max(orbit.minDistance, offset.length() * (command.type === "in" ? .8 : 1.25)));
      camera.position.copy(orbit.target).add(offset.setLength(nextDistance));
    }
    orbit.update();
    invalidate();
  }, [camera, command, invalidate]);

  return <>
    <ambientLight intensity={1.7} />
    <directionalLight position={[4, 7, 5]} intensity={2.8} />
    <directionalLight position={[-4, 3, -2]} color="#a2d8ed" intensity={1.4} />
    <FurnitureModel kind={kind} active neonColor={neonColor} />
    <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={false} minDistance={radius * 1.2} maxDistance={distance * 2.3} minPolarAngle={Math.PI / 10} maxPolarAngle={Math.PI / 2.05} />
  </>;
}

export default function FurniturePreview({ kind, resetKey = 0, neonColor }: FurniturePreviewProps) {
  const [command, setCommand] = useState<CameraCommand>({ type: "reset", sequence: 0 });
  const move = (type: CameraCommand["type"]) => setCommand(current => ({ type, sequence: current.sequence + 1 }));
  return <>
    <div className="furniture-preview-canvas" role="img" aria-label="Mô hình nội thất 3D. Dùng các nút bên dưới để xoay và thay đổi độ phóng đại.">
      <PreviewBoundary><Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [5, 3, 5], fov: 37, near: .01, far: 100 }} gl={{ alpha: true, antialias: true }} fallback={<div className="furniture-preview-loading">Thiết bị không hỗ trợ 3D. Hình minh họa và thông tin vẫn có sẵn.</div>}>
        <Suspense fallback={null}><PreviewScene kind={kind} resetKey={resetKey} command={command} neonColor={neonColor} /></Suspense>
      </Canvas></PreviewBoundary>
    </div>
    <div className="furniture-camera-controls" role="group" aria-label="Điều khiển góc nhìn">
      <button type="button" onClick={() => move("left")} aria-label="Xoay trái" title="Xoay trái"><ChevronLeft size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => move("right")} aria-label="Xoay phải" title="Xoay phải"><ChevronRight size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => move("out")} aria-label="Thu nhỏ" title="Thu nhỏ"><Minus size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => move("in")} aria-label="Phóng to" title="Phóng to"><Plus size={18} aria-hidden="true" /></button>
      <button type="button" onClick={() => move("reset")} aria-label="Khôi phục góc nhìn" title="Khôi phục góc nhìn"><RotateCcw size={17} aria-hidden="true" /></button>
    </div>
  </>;
}
