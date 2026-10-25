"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { EquipmentArtwork } from "@/components/equipment/EquipmentArtwork";
import {
  createEquipmentPartGeometry,
  EquipmentModel,
  getEquipmentRecipe,
} from "./equipment-models";
import { getEquipmentDefinition, type EquipmentAnchor, type EquipmentRecipe } from "@/equipment/catalog";
import type { ItemDefinition } from "@/domain/types";

const DISPLAY_ANCHORS: Record<EquipmentAnchor, [number, number, number]> = {
  rightHand: [0.2, 0, 0],
  leftHand: [-0.2, 0, 0],
  head: [0, 0.2, 0],
  torso: [0, -1.08, 0],
  leftArm: [-0.14, 0.56, 0],
  rightArm: [0.14, 0.56, 0],
  leftShin: [-0.1, 0.565, 0],
  rightShin: [0.1, 0.565, 0],
};

export type EquipmentDisplayLayout = {
  itemId: string;
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
  radius: number;
  modelRotation: [number, number, number];
  modelPosition: [number, number, number];
  pedestalRadius: number;
  pedestalY: number;
  cameraDistance: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
};

function getDisplayPartOffset(recipe: EquipmentRecipe, anchor: EquipmentAnchor): [number, number, number] {
  if (recipe.slot === "weapon" && recipe.category !== "dual") {
    return [0, 0, 0];
  }
  return DISPLAY_ANCHORS[anchor];
}

function getDisplayRotation(recipe: EquipmentRecipe): [number, number, number] {
  if (recipe.slot === "weapon") {
    return [0, 0, recipe.category === "dual" ? -0.22 : -0.42];
  }
  return [0, 0, 0];
}

const DISPLAY_BOUNDS_CACHE = new Map<
  string,
  {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
    radius: number;
    modelRotation: [number, number, number];
    modelPosition: [number, number, number];
    pedestalRadius: number;
    pedestalY: number;
    sceneRadius: number;
  }
>();

export function getEquipmentDisplayLayout(itemId: string, fov = 32, aspect = 1.25): EquipmentDisplayLayout {
  let base = DISPLAY_BOUNDS_CACHE.get(itemId);
  if (!base) {
    const recipe = getEquipmentRecipe(itemId);
    if (!recipe) {
      return {
        itemId,
        min: [-0.25, -0.25, -0.25],
        max: [0.25, 0.25, 0.25],
        size: [0.5, 0.5, 0.5],
        center: [0, 0, 0],
        radius: 0.44,
        modelRotation: [0, 0, 0],
        modelPosition: [0, 0, 0],
        pedestalRadius: 0.55,
        pedestalY: -0.32,
        cameraDistance: 2.1,
        cameraPosition: [1.1, 0.65, 1.65],
        cameraTarget: [0, 0, 0],
      };
    }

    const rotation = getDisplayRotation(recipe);
    const groupEuler = new THREE.Euler(...rotation);
    const box = new THREE.Box3();

    for (const part of recipe.parts) {
      const geometry = createEquipmentPartGeometry(part);
      const offset = getDisplayPartOffset(recipe, part.anchor);
      const partMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(
          part.position[0] + offset[0],
          part.position[1] + offset[1],
          part.position[2] + offset[2],
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation)),
        new THREE.Vector3(1, 1, 1),
      );
      const groupMatrix = new THREE.Matrix4().makeRotationFromEuler(groupEuler);
      geometry.applyMatrix4(partMatrix);
      geometry.applyMatrix4(groupMatrix);
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        box.union(geometry.boundingBox);
      }
      geometry.dispose();
    }

    const sizeVec = new THREE.Vector3();
    const centerVec = new THREE.Vector3();
    box.getSize(sizeVec);
    box.getCenter(centerVec);

    const modelPosition: [number, number, number] = [-centerVec.x, -centerVec.y, -centerVec.z];
    const radius = Math.max(sizeVec.length() * 0.5, 0.16);
    const pedestalRadius = Math.max(0.32, Math.min(0.88, Math.max(sizeVec.x, sizeVec.z) * 0.72 + 0.16));
    const pedestalY = -(sizeVec.y * 0.5) - 0.08;
    const sceneHeight = sizeVec.y + 0.18;
    const sceneRadius = Math.max(radius * 1.08, pedestalRadius * 0.95, sceneHeight * 0.54);

    base = {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [sizeVec.x, sizeVec.y, sizeVec.z],
      center: [centerVec.x, centerVec.y, centerVec.z],
      radius,
      modelRotation: rotation,
      modelPosition,
      pedestalRadius,
      pedestalY,
      sceneRadius,
    };
    DISPLAY_BOUNDS_CACHE.set(itemId, base);
  }

  const halfFovRad = (fov * Math.PI) / 360;
  const limitingHalfFov = Math.atan(Math.tan(halfFovRad) * Math.min(1, Math.max(0.65, aspect)));
  const cameraDistance = Math.max(1.05, (base.sceneRadius / Math.sin(limitingHalfFov)) * 1.16);

  const dir = new THREE.Vector3(0.54, 0.34, 0.88).normalize();
  const targetY = -0.02;
  const cameraPos = dir.multiplyScalar(cameraDistance);

  return {
    itemId,
    min: base.min,
    max: base.max,
    size: base.size,
    center: base.center,
    radius: base.radius,
    modelRotation: base.modelRotation,
    modelPosition: base.modelPosition,
    pedestalRadius: base.pedestalRadius,
    pedestalY: base.pedestalY,
    cameraDistance,
    cameraPosition: [cameraPos.x, targetY + cameraPos.y, cameraPos.z],
    cameraTarget: [0, targetY, 0],
  };
}

class ShowcaseBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ShowcaseCameraRig({ itemId, motion }: { itemId: string; motion: boolean }) {
  const { camera, size } = useThree();
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1.25;
  const layout = useMemo(() => getEquipmentDisplayLayout(itemId, 32, aspect), [itemId, aspect]);

  useEffect(() => {
    camera.position.set(...layout.cameraPosition);
    camera.lookAt(...layout.cameraTarget);
    camera.updateProjectionMatrix();
  }, [camera, layout]);

  return (
    <OrbitControls
      enablePan={false}
      enableZoom={false}
      target={layout.cameraTarget}
      autoRotate={motion}
      autoRotateSpeed={0.65}
    />
  );
}

function ShowcaseScene({ item, motion }: { item: ItemDefinition; motion: boolean }) {
  const layout = useMemo(() => getEquipmentDisplayLayout(item.id), [item.id]);
  const definition = getEquipmentDefinition(item.id);
  const accent = definition?.accent ?? (item.rarity === "legendary" ? "#ffbc62" : item.rarity === "epic" ? "#9067ff" : "#32e6f4");

  return (
    <>
      <ambientLight intensity={1.65} />
      <directionalLight position={[2.2, 3.8, 3.6]} intensity={2.9} />
      <pointLight position={[-2, 1.2, 1.4]} color={accent} intensity={5.2} />
      <group position={layout.modelPosition}>
        <group rotation={layout.modelRotation}>
          <EquipmentModel itemId={item.id} presentation="display" />
        </group>
      </group>
      <mesh position={[0, layout.pedestalY, 0]}>
        <cylinderGeometry args={[layout.pedestalRadius, layout.pedestalRadius * 1.08, 0.08, 48]} />
        <meshStandardMaterial color="#14263c" metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0, layout.pedestalY + 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[layout.pedestalRadius * 0.82, layout.pedestalRadius * 0.92, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <ShowcaseCameraRig itemId={item.id} motion={motion} />
    </>
  );
}

export default function ItemShowcase({ item }: { item: ItemDefinition }) {
  const [motion, setMotion] = useState(false);
  const layout = useMemo(() => getEquipmentDisplayLayout(item.id), [item.id]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setMotion(!media.matches && !document.hidden && !document.querySelector(".reduce-motion"));
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const fallback = (
    <div style={{ display: "grid", placeItems: "center", height: "100%", width: "100%" }}>
      <EquipmentArtwork item={item} large />
    </div>
  );

  return (
    <div
      className="item-3d-showcase"
      style={{ height: 280, width: "100%" }}
      aria-label={`Mô hình 3D ${item.name}`}
      data-item-id={item.id}
      data-slot={item.slot}
    >
      <ShowcaseBoundary fallback={fallback}>
        <Canvas dpr={[1, 1.25]} camera={{ position: layout.cameraPosition, fov: 32 }}>
          <ShowcaseScene item={item} motion={motion} />
        </Canvas>
      </ShowcaseBoundary>
    </div>
  );
}
