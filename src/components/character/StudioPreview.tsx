"use client";

import { Component, Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import * as THREE from "three";
import { CharacterModel, type ModelCharacter } from "@/components/world/CharacterModel";
import { fitStudioCharacter } from "./studio-framing";

type Props = ModelCharacter & {
  quality?: string;
  reducedMotion?: boolean;
  cameraFocus: "head" | "body";
  cameraReset: number;
  cameraAzimuth: number;
  cameraZoom: number;
};

function StudioScene(props: Props) {
  const { camera, size } = useThree();
  // R3F exposes a mutable Three.js camera. Keep it behind a ref so the React
  // compiler's immutability rule does not treat imperative scene updates as
  // render-time mutations.
  const cameraRef = useRef(camera);
  const model = useRef<THREE.Group>(null);
  const controls = useRef<Controls>(null);
  useLayoutEffect(() => {
    if (!model.current) return;
    const activeCamera = cameraRef.current;
    model.current.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model.current);
    const framing = fitStudioCharacter(bounds, size.width / Math.max(1, size.height), props.cameraFocus, props.cameraAzimuth, props.cameraZoom);
    activeCamera.position.copy(framing.position);
    if (activeCamera instanceof THREE.PerspectiveCamera) {
      activeCamera.fov = framing.fov; activeCamera.near = .015; activeCamera.far = 100; activeCamera.updateProjectionMatrix();
    }
    activeCamera.lookAt(framing.target);
    controls.current?.target.copy(framing.target);
    controls.current?.update();
  }, [camera, size.width, size.height, props.cameraFocus, props.cameraReset, props.cameraAzimuth, props.cameraZoom,
    props.appearance, props.cosmetics]);
  return <>
    <ambientLight color="#d0ddf2" intensity={1.25} />
    <hemisphereLight args={["#bcd8ff", "#403348", 1.4]} />
    <directionalLight position={[2, 4, 4]} color="#fff2df" intensity={3.1} castShadow shadow-mapSize={[2048, 2048]} />
    <directionalLight position={[-3, 2, 1]} color="#85cddd" intensity={1.7} />
    <directionalLight position={[1, 2.5, -3]} color="#b49aff" intensity={3} />
    <group ref={model}><CharacterModel character={props} cosmetics={props.cosmetics} paused={props.reducedMotion} weaponDrawn={false} /></group>
    <mesh position={[0, -.035, 0]} receiveShadow><cylinderGeometry args={[.72, .78, .07, 96]} /><meshStandardMaterial color="#172838" metalness={.72} roughness={.34} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .002, 0]}><ringGeometry args={[.71, .72, 96]} /><meshBasicMaterial color="#7ee3e5" /></mesh>
    <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={.1}
      minDistance={.28} maxDistance={10} minPolarAngle={.12} maxPolarAngle={Math.PI * .78}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY }} />
  </>;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="studio-loading" role="alert">Không thể dựng bản xem 3D. Ngoại hình đã lưu vẫn được giữ nguyên.</div> : this.props.children; }
}

export default function StudioPreview(props: Props) {
  return <PreviewBoundary><Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
    <Suspense fallback={null}><StudioScene {...props} /></Suspense>
  </Canvas></PreviewBoundary>;
}
