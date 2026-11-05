"use client";

import {
  Component,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html } from "@react-three/drei";
import * as THREE from "three";

import { BUILDING_CATALOG, LEVEL_HEIGHT, REFUND_RATE, buildingItem } from "@/construction/catalog";
import { APARTMENT_TERRACE_PLOT } from "@/construction/migration";
import { DoorLeafModel, doorMotionKind } from "./door-models";
import { curveGlassMaterial } from "./curve-material";
import { cellKey, edgeKey } from "@/construction/grid";
import { orthogonalWallEnd, snapWallVertex, wallEdgesBetweenSegments, wallEdgesBetweenVertices } from "@/construction/wall-edges";
import {
  buildingFurnitureRoute,
  completeFurnitureArrival,
  resolveFurnitureInteraction,
  toggleFurnitureActive,
  type FurnitureArrival,
} from "@/furniture/interactions";
import { findBuildingPath, furnitureFootprint, occupiedCells, safeSpawn } from "@/construction/navigation";
import { quoteConstruction } from "@/construction/engine";
import type {
  BuildingPlan,
  BuildingFurniture,
  CurvedGlassSegment,
  FloorCell,
  GridPoint,
  LedStrip,
  Plot,
  WallSegment,
} from "@/construction/types";
import { FURNITURE } from "@/domain/catalog";
import type { ModelCharacter } from "@/components/world/CharacterModel";
import { usesReferenceCharacterLook } from "@/components/character/character-render-profile";
import PetModel from "@/components/world/PetModel";
import { findPetSpawn } from "@/components/world/pet-placement";
import { Avatar, Fps, Furniture, type AvatarControlState, type AvatarPose } from "@/components/world/Apartment";
import { buildingFurnitureInteractionAnchors } from "@/furniture/interaction-anchors";
import { bodyShape } from "@/components/world/character-shape";
import {
  bindLiveControlListeners,
  createLiveInputController,
  createLiveMovementState,
  createLiveMovementWorld,
  liveControlsBlocked,
  isLiveTypingTarget,
  liveDirectionForCode,
  stepLiveMovement,

  type LiveInputController,
  type LiveMovementState,
} from "./live-movement";
import "./live-controls.css";
import { ApartmentCity, buildCityScene } from "@/components/world/ApartmentCity";
import { BuildingEnvelope } from "./BuildingEnvelope";
import { architectureCutaway } from "./building-architecture";
import {
  buildPanoramaCurtainWallAssembly,
  curveFrameGeometry,
  curveGeometry,
  classifyApartmentShellWall,
  isFixedApartmentShell,
  nearestEdge,
  residenceCityOffset,
  wallParts,
  type EdgeRef,
  type PanoramaCurtainWallSpec,
} from "./render-geometry";
import {
  clipWallPart,
  computeApartmentLightingRig,
  computeArchitecturalFloorTransitions,
  computeFloorCellTint,
  computeInteriorAccentZones,
  computeRoomBounds,
  computeSlabProfile,
  createFloorDataTexture,
  createFabricDataTexture,
  createWallDataTexture,
  evaluateWallCutaway,
  getFloorMaterialSpec,
  getWallMaterialSpec,
  resolveApartmentFloorMaterial,
  resolveApartmentWallMaterial,
  type RoomBounds,
  type InteriorAccentZone,
} from "./architectural-materials";
import { DesktopCamera, type DesktopCameraMode } from "./desktop-camera";
import { createCityTowerColliders, createCorridorCameraColliders } from "./camera-geometry";
import { createCorridorNavigationPlan, getApartmentCorridorBounds } from "./corridor-navigation";
import { createCurve } from "@/construction/curves";
import { addCurveDraft, toolDraft, type EditorTool } from "./draft";
import { getApartmentFootprint } from "@/components/apartment-v21/asset-registry";
import { attachToSlot, nearestAvailableSlot, requiresSurfaceSlot, snapGroundedToWall, withLotObject } from "@/construction/lot-objects";
import { PlacementFlags, hasPlacementFlag, placementTypeForFlags } from "@/furniture/placement-flags";
import { snapWallInsertPoint, wallCutoutsForSegment, wallInsertAtPoint, wallInsertPlacementValid, wallInsertYaw } from "@/construction/wall-inserts";
import { subtractWallInsertCutouts, visibleInsertWallHeight, wallInsertClipPlane } from "./wall-insert-csg";
import { ReferencePenthouseLayer } from "./reference-penthouse";
import { ApartmentEffects, ApartmentEnvironment } from "./apartment-effects";

export type { EdgeRef } from "./render-geometry";
export type ConstructionHit = { kind: "wall" | "floor" | "furniture" | "curve" | "led"; id: string };
export type ConstructionWorldProps = {
  plan: BuildingPlan;
  plot?: Plot;
  paid?: Record<string, number>;
  mode: "live" | "build" | "buy";
  tool: string;
  floorLevel: number;
  onGesture: (start: GridPoint, end: GridPoint, edge?: EdgeRef) => void;
  onDemolishEdges?: (edges: EdgeRef[]) => number;
  onSelect?: (hit: ConstructionHit) => void;
  /** Place the furniture currently attached to the cursor. */
  onFurniturePlace?: (point: GridPoint, placement?: { normal?: [number, number, number]; y?: number; ceilingY?: number; wallId?: string; wallU?: number }) => void;
  onFurnitureRotate?: (amount?: number) => void;
  onLedStripPlace?: (start: GridPoint, end: GridPoint, color: string) => void;
  ledColor?: string;
  activeFurniture?: BuildingFurniture;
  preview?: BuildingPlan;
  character?: ModelCharacter;
  cosmetics?: Partial<Record<string, string>>;
  equipment?: Partial<Record<string, string>>;
  weaponId?: string;
  quality?: string;
  onInteract: (screen: string) => void;
  onLightToggle?: (id: string, dimmer: number) => void;
  onLightSelect?: (id: string) => void;
  onNotice?: (message: string) => void;
  onFps?: (fps: number) => void;
  /** Fires as soon as R3F has created the real WebGL renderer. */
  onReady?: () => void;
  onContextLost?: () => void;
  cameraReset?: number;
  cameraMode?: DesktopCameraMode;
  onCameraModeChange?: (mode: DesktopCameraMode) => void;
  cutaway?: boolean;
  showCeiling?: boolean;
  selectedId?: string;
  ghostFurniture?: { furnitureId: string; rotation: 0 | 90 | 180 | 270 };
  activePet?: { id: string; accessoryColor?: string };
  materialId?: string;
  wallMaterialId?: string;
  residenceFloor?: 8 | 16 | 24;
  /** Shared architectural finish; placed furniture always comes from plan. */
  showReferencePenthouse?: boolean;
  /** Let the lobby skyline show behind the real apartment canvas. */
  transparentBackground?: boolean;
  curveRotation?: number;
  movingCurve?: CurvedGlassSegment;
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const DEFAULT_PLOT: Plot = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, maxLevel: 0, cellSize: 1 };
const NOOP_RAYCAST: THREE.Object3D["raycast"] = () => {};

function WallPointerPassthrough({ active, revision, children }: { active: boolean; revision: unknown; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (!active || !group.current) return;
    const original = new Map<THREE.Mesh, THREE.Object3D["raycast"]>();
    group.current.traverse(object => {
      if (object instanceof THREE.Mesh) {
        original.set(object, object.raycast);
        object.raycast = NOOP_RAYCAST;
      }
    });
    return () => { original.forEach((raycast, mesh) => { mesh.raycast = raycast; }); };
  }, [active, revision]);
  return <group ref={group}>{children}</group>;
}

function WebGLContextMonitor({ onLost }: { onLost?: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    if (!onLost) return;
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener("webglcontextlost", handleLost, { passive: false });
    return () => canvas.removeEventListener("webglcontextlost", handleLost);
  }, [gl, onLost]);
  return null;
}

function Block({
  position,
  size,
  color,
  emissive,
  emissiveIntensity = 1.35,
  opacity = 1,
  roughness = 0.44,
  metalness = 0.32,
  map,
  raycast,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture | null;
  raycast?: THREE.Object3D["raycast"];
}) {
  return (
    <mesh
      geometry={UNIT_BOX}
      dispose={null}
      position={position}
      scale={size}
      castShadow={opacity === 1}
      receiveShadow
      raycast={raycast}
    >
      <meshStandardMaterial
        color={map ? "#ffffff" : color}
        map={map}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
      />
    </mesh>
  );
}

const FloorTiles = memo(function FloorTiles({
  cells,
  roomBounds,
  yOffset = 0,
  isFixedShell = false,
  editing = false,
}: {
  cells: FloorCell[];
  roomBounds: RoomBounds;
  yOffset?: number;
  isFixedShell?: boolean;
  editing?: boolean;
}) {
  const groups = useMemo(() => {
    const bucket = new Map<string, FloorCell[]>();
    for (const cell of cells) {
      const resolvedId = yOffset === 0 ? resolveApartmentFloorMaterial(cell, isFixedShell) : cell.materialId;
      const list = bucket.get(resolvedId);
      const mappedCell = resolvedId === cell.materialId ? cell : { ...cell, materialId: resolvedId };
      if (list) list.push(mappedCell);
      else bucket.set(resolvedId, [mappedCell]);
    }
    return Array.from(bucket.entries()).map(([materialId, groupCells]) => ({
      materialId,
      cells: groupCells,
    }));
  }, [cells, isFixedShell, yOffset]);

  return (
    <>
      {groups.map(group => (
        <FloorInstances
          key={group.materialId}
          materialId={group.materialId}
          cells={group.cells}
          roomBounds={roomBounds}
          yOffset={yOffset}
          editing={editing}
        />
      ))}
    </>
  );
});

function FloorInstances({
  materialId,
  cells,
  roomBounds,
  yOffset,
  editing,
}: {
  materialId: string;
  cells: FloorCell[];
  roomBounds: RoomBounds;
  yOffset: number;
  editing: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spec = useMemo(() => getFloorMaterialSpec(materialId), [materialId]);
  const texture = useMemo(() => createFloorDataTexture(materialId, 64), [materialId]);
  useEffect(() => () => texture.dispose(), [texture]);
  // The saved plan is cell based, but the finish is one continuous floor.
  // Mapping a full wood texture onto every 1 m cell made a visible checkerboard
  // and repeated the same grain dozens of times across the apartment.
  const woodSurface = useMemo(() => {
    if (materialId !== "floor-wood") return null;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (const cell of cells) {
      const x = cell.x;
      const z = cell.z;
      const y = cell.level * LEVEL_HEIGHT + yOffset + 0.004;
      const start = positions.length / 3;
      positions.push(x, y, z, x, y, z + 1, x + 1, y, z + 1, x + 1, y, z);
      // A finer board cadence matches the reference's narrow walnut planks.
      // Shared world coordinates keep board seams continuous across save cells.
      for (const [u, v] of [[x, z], [x, z + 1], [x + 1, z + 1], [x + 1, z]]) {
        uvs.push((u - roomBounds.minX) / 2.5, (v - roomBounds.minZ) / 2.5);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [cells, materialId, roomBounds.minX, roomBounds.minZ, yOffset]);
  useEffect(() => () => woodSurface?.dispose(), [woodSurface]);
  const [woodMaps, setWoodMaps] = useState<{ color: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture } | null>(null);
  useEffect(() => {
    if (materialId !== "floor-wood") return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const base = "/assets/apartment/materials/polyhaven/plank_flooring_04/";
    Promise.all([loader.loadAsync(base + "diffuse.jpg"), loader.loadAsync(base + "normal.jpg"), loader.loadAsync(base + "roughness.jpg")])
      .then(([color, normal, roughness]) => {
        const maps = { color, normal, roughness };
        if (cancelled) {
          Object.values(maps).forEach(map => map.dispose());
          return;
        }
        color.colorSpace = THREE.SRGBColorSpace;
        Object.values(maps).forEach(map => {
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.anisotropy = 8;
          map.repeat.set(1, 1);
          map.needsUpdate = true;
        });
        setWoodMaps(maps);
      })
      .catch(() => { /* Keep the existing procedural material when the network is unavailable. */ });
    return () => { cancelled = true; };
  }, [materialId]);
  useEffect(() => () => {
    if (woodMaps) Object.values(woodMaps).forEach(map => map.dispose());
  }, [woodMaps]);

  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const horizontalScale = editing ? 0.996 : 1.0;
    const scale = new THREE.Vector3(horizontalScale, spec.thickness, horizontalScale);
    const rotation = new THREE.Quaternion();
    cells.forEach((cell, index) => {
      matrix.compose(
        new THREE.Vector3(cell.x + 0.5, cell.level * LEVEL_HEIGHT - spec.thickness * 0.5 + yOffset, cell.z + 0.5),
        rotation,
        scale
      );
      ref.current?.setMatrixAt(index, matrix);
      const tint = computeFloorCellTint(cell, roomBounds);
      ref.current?.setColorAt(index, new THREE.Color(tint.r, tint.g, tint.b));
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
  }, [cells, editing, roomBounds, spec.thickness, yOffset]);

  return (
    <>
    <instancedMesh ref={ref} args={[UNIT_BOX, undefined, cells.length]} receiveShadow dispose={null}>
      <meshStandardMaterial
        // Keep the same warm planks but preserve the near-black contrast of
        // the reference penthouse under amber practical lighting.
        color={woodMaps ? "#40261c" : "#ffffff"}
        map={woodMaps?.color ?? texture}
        normalMap={woodMaps?.normal ?? null}
        normalScale={woodMaps ? new THREE.Vector2(0.35, 0.35) : undefined}
        roughnessMap={woodMaps?.roughness ?? null}
        bumpMap={woodMaps ? null : texture}
        bumpScale={woodMaps ? 0 : spec.bumpScale}
        metalness={spec.metalness}
        roughness={spec.roughness}
        emissive={spec.emissive}
        emissiveIntensity={woodMaps ? 0.018 : spec.emissiveIntensity}
        transparent={spec.transparent}
        opacity={spec.opacity}
      />
    </instancedMesh>
    {woodSurface && <mesh geometry={woodSurface} receiveShadow raycast={() => {}}>
      <meshStandardMaterial
        color={woodMaps ? "#a48a78" : "#ffffff"}
        map={woodMaps?.color ?? texture}
        normalMap={woodMaps?.normal ?? null}
        normalScale={woodMaps ? new THREE.Vector2(0.35, 0.35) : undefined}
        roughnessMap={woodMaps?.roughness ?? null}
        metalness={spec.metalness}
        roughness={woodMaps ? 0.38 : spec.roughness}
      />
    </mesh>}
    </>
  );
}

const FloorTransitionStrips = memo(function FloorTransitionStrips({
  floors,
  level,
  isFixedShell,
}: {
  floors: FloorCell[];
  level: number;
  isFixedShell: boolean;
}) {
  const strips = useMemo(
    () => computeArchitecturalFloorTransitions(floors, level, isFixedShell),
    [floors, level, isFixedShell]
  );
  if (!strips.length) return null;
  const baseY = level * LEVEL_HEIGHT;
  return (
    <group>
      {strips.map(strip => {
        const sizeX = strip.orientation === "x" ? strip.length : strip.width;
        const sizeZ = strip.orientation === "z" ? strip.length : strip.width;
        return (
          <group key={strip.id} position={[strip.x, baseY, strip.z]}>
            <Block
              position={[0, 0.002, 0]}
              size={[sizeX + 0.012, 0.005, sizeZ + 0.012]}
              color={strip.revealColor}
              roughness={0.55}
              metalness={0.25}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, strip.height * 0.5 + 0.003, 0]}
              size={[sizeX, strip.height, sizeZ]}
              color={strip.primaryColor}
              roughness={0.24}
              metalness={0.72}
              raycast={NOOP_RAYCAST}
            />
          </group>
        );
      })}
    </group>
  );
});

const InteriorAccent = memo(function InteriorAccent({ zone, baseY }: { zone: InteriorAccentZone; baseY: number }) {
  const texture = useMemo(
    () => createFabricDataTexture(zone.primaryColor, zone.borderColor),
    [zone.primaryColor, zone.borderColor]
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[zone.x, baseY, zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={NOOP_RAYCAST}>
        <planeGeometry args={[zone.width + 0.22, zone.depth + 0.22]} />
        <meshBasicMaterial color={zone.glowColor} transparent opacity={zone.glowOpacity * 0.45} depthWrite={false} />
      </mesh>
      <Block
        position={[0, 0.008, 0]}
        size={[zone.width, 0.012, zone.depth]}
        color={zone.borderColor}
        roughness={0.92}
        metalness={0}
        raycast={NOOP_RAYCAST}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} receiveShadow raycast={NOOP_RAYCAST}>
        <planeGeometry args={[zone.width - 0.025, zone.depth - 0.025]} />
        <meshStandardMaterial
          color="#ffffff"
          map={texture}
          bumpMap={texture}
          bumpScale={0.012}
          roughness={0.94}
          metalness={0}
        />
      </mesh>
    </group>
  );
});

const InteriorZones = memo(function InteriorZones({ plan, level }: { plan: BuildingPlan; level: number }) {
  const zones = useMemo(() => computeInteriorAccentZones(plan, level), [plan, level]);
  if (!zones.length) return null;
  const baseY = level * LEVEL_HEIGHT;
  return (
    <group>
      {zones.map(zone => (
        <InteriorAccent key={zone.id} zone={zone} baseY={baseY} />
      ))}
    </group>
  );
});

const ArchitecturalSlab = memo(function ArchitecturalSlab({
  roomBounds,
  plot,
  editing,
  residenceFloor,
  isFixedShell,
  buildPlot,
}: {
  roomBounds: RoomBounds;
  plot: Plot;
  editing: boolean;
  residenceFloor?: 8 | 16 | 24;
  isFixedShell: boolean;
  buildPlot?: Plot;
}) {
  const slab = useMemo(() => computeSlabProfile(roomBounds, buildPlot ?? plot, editing, Boolean(buildPlot)), [roomBounds, buildPlot, plot, editing]);

  return (
    <group>
      <Block
        position={[slab.centerX, slab.topY - slab.thickness * 0.5, slab.centerZ]}
        size={[slab.width, slab.thickness, slab.depth]}
        color={slab.baseColor}
        roughness={0.58}
        metalness={0.34}
      />
      <Block
        position={[slab.centerX, slab.topY + 0.02, slab.centerZ]}
        size={[slab.width + 0.08, 0.05, slab.depth + 0.08]}
        color={slab.trimColor}
        roughness={0.42}
        metalness={0.38}
      />
      <Block
        position={[slab.centerX, slab.topY - slab.thickness - 0.02, slab.centerZ]}
        size={[Math.max(1, slab.width - 0.14), 0.032, Math.max(1, slab.depth - 0.14)]}
        color={slab.rimColor}
        emissive={slab.rimColor}
        emissiveIntensity={1.15}
        raycast={NOOP_RAYCAST}
      />
      {roomBounds.hasFloors && isFixedShell && <BuildingEnvelope plot={plot} residenceFloor={residenceFloor} editing={editing}/>}
      {slab.showPlotGuide && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[slab.plotCenterX, -0.14, slab.plotCenterZ]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[slab.plotWidth, slab.plotDepth]} />
          <meshBasicMaterial color="#182538" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

function isPanoramaWall(wall: WallSegment, plot: Plot, isFixedShell = true) {
  const role = classifyApartmentShellWall(wall, plot, isFixedShell);
  return role === "panorama-north" || role === "panorama-east-return";
}

const PanoramaUnitMesh = memo(function PanoramaUnitMesh({
  bay,
  span,
  walls,
  selectedWallKey,
}: {
  bay: PanoramaCurtainWallSpec["bays"][number];
  span: PanoramaCurtainWallSpec["northSpan"] | PanoramaCurtainWallSpec["eastReturnSpan"];
  walls: WallSegment[];
  selectedWallKey?: string;
}) {
  const center = bay.orientation === "x" ? bay.position[0] : bay.position[2];
  const sections = walls.flatMap(wall => {
    if (wall.orientation !== bay.orientation) return [];
    if (wall.orientation === "x" ? wall.z !== bay.position[2] : wall.x !== bay.position[0]) return [];
    const start = wall.orientation === "x" ? wall.x : wall.z;
    const left = Math.max(start, center - bay.width / 2);
    const right = Math.min(start + 1, center + bay.width / 2);
    if (right <= left) return [];
    return [{ wall, width: right - left, x: ((left + right) / 2 - center) * (bay.orientation === "z" ? -1 : 1) }];
  });
  return (
    <group position={bay.position} rotation={[0, bay.rotationY, 0]}>
      {sections.map(({ wall, width, x }) => {
        const selected = edgeKey(wall) === selectedWallKey;
        const frameColor = selected ? "#53f5e2" : "#222936";
        return (
          <group key={edgeKey(wall)} position={[x, 0, 0]}>
            <Block position={[0, span.sillHeight / 2, 0]} size={[width, span.sillHeight, 0.2]}
              color={frameColor} roughness={0.34} metalness={0.68} raycast={NOOP_RAYCAST} />
            <Block position={[0, span.height - span.headerHeight / 2, 0]} size={[width, span.headerHeight, 0.21]}
              color={frameColor} roughness={0.32} metalness={0.72} raycast={NOOP_RAYCAST} />
            <Block position={[0, bay.transomY, 0]} size={[width, 0.042, 0.185]}
              color={frameColor} roughness={0.28} metalness={0.76} raycast={NOOP_RAYCAST} />
            <Block position={[0, span.sillHeight + 0.014, 0.065]} size={[width, 0.018, 0.032]}
              color="#ffbe76" emissive="#ffae52" emissiveIntensity={1.15} raycast={NOOP_RAYCAST} />
            <Block position={[0, span.sillHeight + 0.014, -0.065]} size={[width, 0.018, 0.032]}
              color="#ffbe76" emissive="#ffae52" emissiveIntensity={1.15} raycast={NOOP_RAYCAST} />
            <Block position={[0, span.height - span.headerHeight - 0.016, 0]} size={[width, 0.022, 0.06]}
              color="#ffcb8a" emissive="#ffbe76" emissiveIntensity={1.35} raycast={NOOP_RAYCAST} />
            <mesh position={[0, bay.lowerY, 0]} raycast={NOOP_RAYCAST} userData={{ isPanoramaGlass: true }}>
              <planeGeometry args={[width, bay.lowerHeight]} />
              <meshStandardMaterial color={selected ? "#53f5e2" : "#75c9ed"} transparent opacity={selected ? 0.3 : 0.08}
                metalness={0.32} roughness={0.06} emissive="#244a78" emissiveIntensity={0.18}
                side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            <mesh position={[0, bay.upperY, 0]} raycast={NOOP_RAYCAST} userData={{ isPanoramaGlass: true }}>
              <planeGeometry args={[width, bay.upperHeight]} />
              <meshStandardMaterial color={selected ? "#53f5e2" : "#b278e5"} transparent opacity={selected ? 0.32 : 0.1}
                metalness={0.38} roughness={0.08} emissive="#5e237a" emissiveIntensity={0.2}
                side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

const PanoramaCurtainFacade = memo(function PanoramaCurtainFacade({
  walls,
  plot,
  level,
  isFixedShell,
  selectedId,
  editing,
  wallDrawActive,
  onSelectWall,
  onHoverWall,
}: {
  walls: WallSegment[];
  plot: Plot;
  level: number;
  isFixedShell: boolean;
  selectedId?: string;
  editing: boolean;
  wallDrawActive: boolean;
  onSelectWall: (wall: WallSegment, point: THREE.Vector3, drag?: { pointerId: number; x: number; y: number }) => void;
  onHoverWall?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
}) {
  const panoramaWalls = useMemo(
    () => walls.filter(wall => wall.level <= level && isPanoramaWall(wall, plot, isFixedShell)),
    [walls, plot, level, isFixedShell]
  );
  const assembly = useMemo(() => buildPanoramaCurtainWallAssembly(plot, 0), [plot]);
  if (!panoramaWalls.length) return null;
  return (
    <WallPointerPassthrough active={wallDrawActive} revision={walls}>
      {panoramaWalls.map(wall => (
        <mesh key={edgeKey(wall)}
          position={[wall.x + (wall.orientation === "x" ? 0.5 : 0), assembly.northSpan.height / 2, wall.z + (wall.orientation === "z" ? 0.5 : 0)]}
          rotation={[0, wall.orientation === "z" ? Math.PI / 2 : 0, 0]}
          onPointerDown={event => { event.stopPropagation(); onHoverWall?.(event, wall); if (editing && event.button === 0) onSelectWall(wall, event.point, { pointerId: event.pointerId, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY }); }}
          onPointerMove={onHoverWall ? event => { event.stopPropagation(); onHoverWall(event, wall); } : undefined}
          onClick={event => { event.stopPropagation(); if (!editing) onSelectWall(wall, event.point); }}>
          <boxGeometry args={[1, assembly.northSpan.height, editing ? 0.22 : 0.16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {assembly.bays.map(bay => (
        <PanoramaUnitMesh key={bay.id} bay={bay}
          span={bay.orientation === "x" ? assembly.northSpan : assembly.eastReturnSpan}
          walls={panoramaWalls} selectedWallKey={selectedId} />
      ))}
      {assembly.columns.filter(column => panoramaWalls.some(wall =>
        wall.orientation === "x"
          ? wall.z === column.position[2] && column.position[0] >= wall.x && column.position[0] <= wall.x + 1
          : wall.x === column.position[0] && column.position[2] >= wall.z && column.position[2] <= wall.z + 1
      )).map(column => (
        <group key={column.id}>
          <Block position={column.position} size={column.size} color="#1e2532"
            roughness={0.3} metalness={0.76} raycast={NOOP_RAYCAST} />
          <Block position={column.trimPosition} size={column.trimSize} color="#ffbe76"
            emissive="#ffae52" emissiveIntensity={1.25} raycast={NOOP_RAYCAST} />
        </group>
      ))}
    </WallPointerPassthrough>
  );
});

function WallSurfaceDetail({ materialId, height }: { materialId: string; height: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const spec = getWallMaterialSpec(materialId);
  const wood = spec.pattern === "warm-fluted-wood";
  const count = wood ? 16 : 8;
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    for (let index = 0; index < count; index++) {
      const side = index < count / 2 ? 1 : -1;
      const column = index % (count / 2);
      const x = wood ? -0.4375 + column * 0.125 : [-0.48, 0.48, -0.36, 0.36][column];
      const inset = !wood && column > 1;
      const length = inset ? 0.62 : height - 0.22;
      matrix.compose(
        new THREE.Vector3(x, inset ? 0.44 : height / 2, side * 0.082),
        rotation,
        new THREE.Vector3(wood ? 0.045 : 0.016, length, wood ? 0.026 : 0.014)
      );
      mesh.current.setMatrixAt(index, matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [count, height, wood]);
  if (spec.transparent) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} receiveShadow raycast={NOOP_RAYCAST}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={wood ? spec.trimColor : spec.wainscotColor}
        roughness={wood ? 0.62 : 0.4}
        metalness={wood ? 0.08 : 0.48}
      />
    </instancedMesh>
  );
}

const StructuralWall = memo(function StructuralWall({
  wall,
  effectiveMaterialId,
  cutaway,
  floorKeys,
  roomBounds,
  avatar,
  selected,
  editing,
  wallTexture,
  activeLevel,
  suppressBalustrade,
  onSelectWall,
  onHoverWall,
  wallPlacementActive,
  insertCutouts,
  onWallFurnitureHover,
  onWallFurnitureLeave,
  onWallFurniturePlace,
}: {
  wall: WallSegment;
  effectiveMaterialId: string;
  cutaway: boolean;
  floorKeys: ReadonlySet<string>;
  roomBounds: RoomBounds;
  avatar: React.RefObject<{ x: number; z: number }>;
  selected: boolean;
  editing: boolean;
  wallTexture: THREE.DataTexture;
  activeLevel: number;
  suppressBalustrade?: boolean;
  onSelectWall: (wall: WallSegment, point: THREE.Vector3, drag?: { pointerId: number; x: number; y: number }) => void;
  onHoverWall?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
  wallPlacementActive?: boolean;
  insertCutouts?: ReturnType<typeof wallCutoutsForSegment>;
  onWallFurnitureHover?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
  onWallFurnitureLeave?: () => void;
  onWallFurniturePlace?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
}) {
  const material = buildingItem(wall.materialId);
  const wallSpec = useMemo(() => getWallMaterialSpec(effectiveMaterialId), [effectiveMaterialId]);
  const opening = wall.opening ? buildingItem(wall.opening.catalogId) : undefined;
  const hasInsert = Boolean(insertCutouts?.length);
  const parts = useMemo(() => hasInsert ? [] : wallParts(wall), [wall, hasInsert]);
  const insertClipPlane = useMemo(() => wallInsertClipPlane(wall.level * LEVEL_HEIGHT + (material?.height ?? 2.8)), [wall.level, material?.height]);
  const insertMesh = useMemo(() => {
    if (!hasInsert) return undefined;
    const height = material?.height ?? 2.8;
    const geometry = new THREE.BoxGeometry(1, height, material?.thickness ?? 0.12);
    geometry.translate(0, height / 2, 0);
    const originalMaterial = new THREE.MeshStandardMaterial({
      // Match Block: a texture is already tinted, so multiplying it by the
      // catalog color makes the CSG lintel look grey/green beside solid walls.
      color: wallSpec.transparent ? material?.color ?? wallSpec.baseColor : "#ffffff",
      map: wallSpec.transparent ? null : wallTexture,
      roughness: wallSpec.roughness,
      metalness: wallSpec.metalness,
      transparent: wallSpec.transparent,
      opacity: wallSpec.opacity,
      clippingPlanes: [insertClipPlane],
    });
    const originalWall = new THREE.Mesh(geometry, originalMaterial);
    const result = subtractWallInsertCutouts(originalWall, insertCutouts ?? []);
    geometry.dispose();
    originalMaterial.dispose();
    result.castShadow = true;
    result.receiveShadow = true;
    return result;
  }, [hasInsert, insertCutouts, insertClipPlane, material?.color, material?.height, material?.thickness, wallSpec, wallTexture]);
  useEffect(() => () => { insertMesh?.geometry.dispose(); insertMesh?.material.dispose(); }, [insertMesh]);
  const insertWallRef = useRef<THREE.Mesh>(null);
  const leaf = useRef<THREE.Group>(null);
  const solidRef = useRef<THREE.Group>(null);
  const portalRef = useRef<THREE.Group>(null);
  const cutCapRef = useRef<THREE.Mesh>(null);
  const balustradeRef = useRef<THREE.Group>(null);
  const detailRef = useRef<THREE.Group>(null);
  const center = {
    x: wall.x + (wall.orientation === "x" ? 0.5 : 0),
    z: wall.z + (wall.orientation === "z" ? 0.5 : 0),
  };
  const camera = useThree(state => state.camera);
  const initialCutaway = evaluateWallCutaway({
    wall,
    cutaway,
    selected,
    floorKeys,
    roomBounds,
    cameraPosition: camera.position,
    avatarPosition: { x: roomBounds.centerX, z: roomBounds.centerZ },
  });
  const heightLimit = useRef(initialCutaway.capHeight);
  const [manualOpen, setManualOpen] = useState(false);

  useFrame(({ camera }, delta) => {
    const state = evaluateWallCutaway({
      wall,
      cutaway: cutaway && architectureCutaway(camera.position, {
        minX: roomBounds.minX, maxX: roomBounds.maxX, minZ: roomBounds.minZ, maxZ: roomBounds.maxZ, maxLevel: 0, cellSize: 1,
      }, camera.userData.desktopCameraMode ?? (editing ? "build" : "follow"), editing),
      selected,
      floorKeys,
      roomBounds,
      cameraPosition: camera.position,
      avatarPosition: avatar.current,
    });

    const targetCap = hasInsert ? visibleInsertWallHeight(state.capHeight, material?.height ?? 2.8, insertCutouts ?? []) : state.capHeight;
    heightLimit.current = selected ? targetCap : THREE.MathUtils.damp(heightLimit.current, targetCap, 14, delta);
    const insertMaterial = insertWallRef.current?.material;
    if (insertMaterial instanceof THREE.MeshStandardMaterial && insertMaterial.clippingPlanes?.[0]) {
      insertMaterial.clippingPlanes[0].constant = wall.level * LEVEL_HEIGHT + heightLimit.current;
    }
    solidRef.current?.children.forEach((object, index) => {
      const clipped = clipWallPart(parts[index], heightLimit.current);
      object.position.y = clipped.y;
      object.scale.y = clipped.height;
      object.visible = clipped.visible;
    });
    const fullHeight = heightLimit.current >= (material?.height ?? 2.8) - 0.01;
    if (cutCapRef.current) {
      cutCapRef.current.visible = !fullHeight && !wall.opening && !hasInsert;
      cutCapRef.current.position.y = heightLimit.current + 0.018;
    }
    if (balustradeRef.current) {
      balustradeRef.current.visible = !suppressBalustrade && !fullHeight && !wall.opening && !hasInsert && state.balustradeVisible;
      balustradeRef.current.position.y = heightLimit.current + 0.035;
    }
    if (detailRef.current) {
      detailRef.current.visible = fullHeight;
    }

    if (portalRef.current) {
      portalRef.current.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const mat = object.material;
          if (mat instanceof THREE.MeshStandardMaterial) {
            const isGlass = Boolean(object.userData.isOpeningGlass);
            const targetOpacity = isGlass ? state.openingGlassOpacity : state.openingFrameOpacity;
            mat.transparent = targetOpacity < 1;
            mat.opacity = targetOpacity;
            mat.depthWrite = targetOpacity === 1;
            object.castShadow = targetOpacity === 1;
          }
        }
      });
    }

    if (leaf.current) {
      const near =
        !editing &&
        wall.level === activeLevel &&
        Math.hypot(avatar.current.x - center.x, avatar.current.z - center.z) < 1.45;
      const open = !editing && wall.level === activeLevel && (near || manualOpen);
      const sliding = doorMotionKind(wall.opening?.catalogId ?? "") === "sliding";
      const width = opening?.openingWidth ?? 0.82;
      if (sliding) {
        leaf.current.position.x = THREE.MathUtils.damp(
          leaf.current.position.x,
          -width / 2 + (open ? width : 0),
          10,
          delta
        );
        leaf.current.rotation.y = 0;
      } else {
        leaf.current.position.x = -width / 2;
        const target = open ? -Math.PI * 0.52 : 0;
        leaf.current.rotation.y = THREE.MathUtils.damp(leaf.current.rotation.y, target, 10, delta);
      }
    }
  });

  const width = opening?.openingWidth ?? 0.82;
  const height = opening?.openingHeight ?? 2.2;
  const sill = wall.opening?.kind === "window" ? opening?.sill ?? 1 : 0;
  const showSconce = !wall.opening && !hasInsert && ((wall.x + wall.z) & 1) === 0 && effectiveMaterialId !== "wall-glass";

  return (
    <group
      position={[center.x, wall.level * LEVEL_HEIGHT, center.z]}
      rotation={[0, wall.orientation === "z" ? Math.PI / 2 : 0, 0]}
      onPointerDown={event => { event.stopPropagation(); onHoverWall?.(event, wall); if (editing && event.button === 0) onSelectWall(wall, event.point, { pointerId: event.pointerId, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY }); }}
      onPointerMove={onHoverWall ? event => { event.stopPropagation(); onHoverWall(event, wall); } : undefined}
      onClick={event => {
        event.stopPropagation();
        if (!editing) onSelectWall(wall, event.point);
        if (!editing && wall.opening?.kind === "door") setManualOpen(value => !value);
      }}
    >
      {editing && (
        <mesh
          position={[0, 1.35, 0]}
          onPointerMove={wallPlacementActive ? event => { event.stopPropagation(); onWallFurnitureHover?.(event, wall); } : undefined}
          onPointerOut={wallPlacementActive ? () => onWallFurnitureLeave?.() : undefined}
          onPointerDown={wallPlacementActive ? event => { event.stopPropagation(); if (event.button === 0) onWallFurniturePlace?.(event, wall); } : undefined}
        >
          <boxGeometry args={[1, 2.7, 0.22]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <group ref={solidRef}>
        {parts.map((part, index) => {
          const clipped = clipWallPart(part, initialCutaway.capHeight);
          return (
            <Block
              key={index}
              position={[part.x, clipped.y, 0]}
              size={[part.width, clipped.height, part.depth]}
              color={selected ? "#38889c" : material?.color ?? wallSpec.baseColor}
              map={selected || wallSpec.transparent ? null : wallTexture}
              roughness={wallSpec.roughness}
              metalness={wallSpec.metalness}
              opacity={wallSpec.opacity}
            />
          );
        })}
      </group>
      {insertMesh && <primitive ref={insertWallRef} object={insertMesh} />}
      <group>
        {!wall.opening && !hasInsert && (
          <>
            <Block
              position={[0, 0.06, 0.072]}
              size={[0.99, 0.09, 0.018]}
              color={wallSpec.wainscotColor}
              roughness={0.42}
              metalness={0.28}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, 0.06, -0.072]}
              size={[0.99, 0.09, 0.018]}
              color={wallSpec.wainscotColor}
              roughness={0.42}
              metalness={0.28}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, 0.115, 0.076]}
              size={[0.94, 0.016, 0.012]}
              color={wallSpec.coveEmissive}
              emissive={wallSpec.coveEmissive}
              emissiveIntensity={wallSpec.coveIntensity * 0.75}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, 0.115, -0.076]}
              size={[0.94, 0.016, 0.012]}
              color={wallSpec.coveEmissive}
              emissive={wallSpec.coveEmissive}
              emissiveIntensity={wallSpec.coveIntensity * 0.75}
              raycast={NOOP_RAYCAST}
            />
          </>
        )}
      </group>

      <mesh
        ref={cutCapRef}
        geometry={UNIT_BOX}
        dispose={null}
        position={[0, initialCutaway.capHeight + 0.018, 0]}
        scale={[1.0, 0.035, 0.16]}
        visible={initialCutaway.cutawayActive && !wall.opening && !hasInsert}
        raycast={NOOP_RAYCAST}
      >
        <meshStandardMaterial color={selected ? "#53f5e2" : wallSpec.capColor} roughness={0.35} metalness={0.38} />
      </mesh>

      <group
        ref={balustradeRef}
        position={[0, initialCutaway.capHeight + 0.035, 0]}
        visible={!suppressBalustrade && initialCutaway.cutawayActive && !wall.opening && !hasInsert && initialCutaway.balustradeVisible}
      >
        <Block
          position={[0, 0.012, 0]}
          size={[0.96, 0.018, 0.04]}
          color="#ffbe76"
          emissive="#ffae52"
          emissiveIntensity={1.15}
          raycast={NOOP_RAYCAST}
        />
        <Block
          position={[-0.48, 0.22, 0]}
          size={[0.032, 0.44, 0.042]}
          color="#242c3a"
          roughness={0.3}
          metalness={0.74}
          raycast={NOOP_RAYCAST}
        />
        <Block
          position={[0.48, 0.22, 0]}
          size={[0.032, 0.44, 0.042]}
          color="#242c3a"
          roughness={0.3}
          metalness={0.74}
          raycast={NOOP_RAYCAST}
        />
        <Block
          position={[0, 0.43, 0]}
          size={[1.0, 0.028, 0.052]}
          color="#2d3748"
          roughness={0.26}
          metalness={0.78}
          raycast={NOOP_RAYCAST}
        />
        <mesh position={[0, 0.22, 0]} raycast={NOOP_RAYCAST}>
          <planeGeometry args={[0.92, 0.38]} />
          <meshStandardMaterial
            color="#88d8f0"
            transparent
            opacity={0.22}
            metalness={0.42}
            roughness={0.08}
            emissive="#253b59"
            emissiveIntensity={0.28}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group ref={detailRef} visible={!initialCutaway.cutawayActive}>
        {!wall.opening && hasInsert && (
          <Block
            position={[0, (material?.height ?? 2.8) + 0.018, 0]}
            size={[1, 0.036, (material?.thickness ?? 0.12) + 0.035]}
            color={wallSpec.capColor}
            roughness={0.35}
            metalness={0.4}
            raycast={NOOP_RAYCAST}
          />
        )}
        {!wall.opening && !hasInsert && (
          <>
            <WallSurfaceDetail materialId={effectiveMaterialId} height={material?.height ?? 2.8} />
            <Block
              position={[0, (material?.height ?? 2.8) + 0.018, 0]}
              size={[1, 0.036, (material?.thickness ?? 0.12) + 0.035]}
              color={selected ? "#53f5e2" : wallSpec.capColor}
              roughness={0.35}
              metalness={0.4}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, 2.66, 0.076]}
              size={[0.95, 0.022, 0.02]}
              color={wallSpec.coveEmissive}
              emissive={wallSpec.coveEmissive}
              emissiveIntensity={wallSpec.coveIntensity}
              raycast={NOOP_RAYCAST}
            />
            <Block
              position={[0, 2.66, -0.076]}
              size={[0.95, 0.022, 0.02]}
              color={wallSpec.coveEmissive}
              emissive={wallSpec.coveEmissive}
              emissiveIntensity={wallSpec.coveIntensity}
              raycast={NOOP_RAYCAST}
            />
            {showSconce && (
              <group position={[0, 1.72, 0]}>
                <Block
                  position={[0, 0, 0.078]}
                  size={[0.16, 0.34, 0.022]}
                  color={wallSpec.trimColor}
                  roughness={0.32}
                  metalness={0.55}
                  raycast={NOOP_RAYCAST}
                />
                <Block
                  position={[0, 0, 0.09]}
                  size={[0.07, 0.24, 0.014]}
                  color="#ffcb88"
                  emissive="#ffbe73"
                  emissiveIntensity={1.65}
                  raycast={NOOP_RAYCAST}
                />
                <Block
                  position={[0, 0, -0.078]}
                  size={[0.16, 0.34, 0.022]}
                  color={wallSpec.trimColor}
                  roughness={0.32}
                  metalness={0.55}
                  raycast={NOOP_RAYCAST}
                />
                <Block
                  position={[0, 0, -0.09]}
                  size={[0.07, 0.24, 0.014]}
                  color="#ffcb88"
                  emissive="#ffbe73"
                  emissiveIntensity={1.65}
                  raycast={NOOP_RAYCAST}
                />
              </group>
            )}
          </>
        )}
      </group>

      {opening && (
        <group ref={portalRef}>
          {[-1, 1].map(side => (
            <Block
              key={side}
              position={[side * (width / 2), sill + height / 2, 0]}
              size={[0.042, height + 0.05, 0.185]}
              color={selected ? "#53f5e2" : "#8fa6b5"}
              roughness={0.3}
              metalness={0.58}
              opacity={initialCutaway.openingFrameOpacity}
              raycast={NOOP_RAYCAST}
            />
          ))}
          <Block
            position={[0, sill + height, 0]}
            size={[width + 0.06, 0.052, 0.19]}
            color={selected ? "#53f5e2" : "#9cb3c2"}
            roughness={0.28}
            metalness={0.6}
            opacity={initialCutaway.openingFrameOpacity}
            raycast={NOOP_RAYCAST}
          />
          {wall.opening?.kind === "window" ? (
            <>
              <Block
                position={[0, sill, 0]}
                size={[width + 0.08, 0.055, 0.21]}
                color={wallSpec.trimColor}
                roughness={0.34}
                metalness={0.45}
                opacity={initialCutaway.openingFrameOpacity}
                raycast={NOOP_RAYCAST}
              />
              <Block
                position={[0, sill + height - 0.04, 0]}
                size={[width - 0.04, 0.02, 0.04]}
                color="#ffcb8a"
                emissive="#ffbe76"
                emissiveIntensity={1.2}
                opacity={initialCutaway.openingFrameOpacity}
                raycast={NOOP_RAYCAST}
              />
              <mesh position={[0, sill + height / 2, 0]} userData={{ isOpeningGlass: true }} raycast={NOOP_RAYCAST}>
                <planeGeometry args={[width - 0.035, height - 0.045]} />
                <meshStandardMaterial
                  color={opening.color}
                  transparent
                  opacity={initialCutaway.openingGlassOpacity}
                  metalness={0.68}
                  roughness={0.08}
                  emissive="#1e5668"
                  emissiveIntensity={0.45}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </>
          ) : (
            <group ref={leaf} position={[-width / 2, 0, 0]}>
              <DoorLeafModel
                catalogId={opening.id}
                width={width}
                height={height}
                color={opening.color}
                frameOpacity={initialCutaway.openingFrameOpacity}
                glassOpacity={initialCutaway.openingGlassOpacity}
              />
            </group>
          )}
        </group>
      )}
    </group>
  );
});

const WallCollection = memo(function WallCollection({
  walls,
  plan,
  plot,
  isFixedShell,
  level,
  cutaway,
  floorKeys,
  roomBounds,
  avatar,
  selectedId,
  editing,
  wallDrawActive,
  suppressBalustrade,
  onSelectWall,
  onHoverWall,
  wallPlacementActive,
  onWallFurnitureHover,
  onWallFurnitureLeave,
  onWallFurniturePlace,
}: {
  walls: WallSegment[];
  plan: BuildingPlan;
  plot: Plot;
  isFixedShell: boolean;
  level: number;
  cutaway: boolean;
  floorKeys: ReadonlySet<string>;
  roomBounds: RoomBounds;
  avatar: React.RefObject<{ x: number; z: number }>;
  selectedId?: string;
  editing: boolean;
  wallDrawActive: boolean;
  suppressBalustrade?: boolean;
  onSelectWall: (wall: WallSegment, point: THREE.Vector3, drag?: { pointerId: number; x: number; y: number }) => void;
  onHoverWall?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
  wallPlacementActive?: boolean;
  onWallFurnitureHover?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
  onWallFurnitureLeave?: () => void;
  onWallFurniturePlace?: (event: ThreeEvent<PointerEvent>, wall: WallSegment) => void;
}) {
  const textures = useMemo(() => {
    const map = new Map<string, THREE.DataTexture>();
    const wallMaterialIds = new Set<string>([
      ...BUILDING_CATALOG.filter(entry => entry.category === "wall").map(entry => entry.id),
      "wall-wood",
      "wall-brick",
      "wall-glass",
    ]);
    for (const id of wallMaterialIds) {
      map.set(id, createWallDataTexture(id, 64));
    }
    return map;
  }, []);
  useEffect(() => () => textures.forEach(tex => tex.dispose()), [textures]);
  const fallbackTexture = useMemo(() => createWallDataTexture("wall-basic", 64), []);
  useEffect(() => () => fallbackTexture.dispose(), [fallbackTexture]);

  const standardWalls = useMemo(
    () => (isFixedShell ? walls.filter(wall => !isPanoramaWall(wall, plot)) : walls),
    [walls, isFixedShell, plot]
  );
  const insertCutouts = useMemo(() => new Map(standardWalls.map(wall => [edgeKey(wall), wallCutoutsForSegment(wall, plan)])), [standardWalls, plan]);

  return (
    <WallPointerPassthrough active={wallDrawActive} revision={plan}>
      {standardWalls.map(wall => {
        const effectiveMaterialId = resolveApartmentWallMaterial(wall, isFixedShell, plot);
        return (
          <StructuralWall
            key={`${edgeKey(wall)}:${wall.opening?.catalogId ?? "solid"}`}
            wall={wall}
            insertCutouts={insertCutouts.get(edgeKey(wall))}
            effectiveMaterialId={effectiveMaterialId}
            cutaway={cutaway && wall.level === level}
            floorKeys={floorKeys}
            roomBounds={roomBounds}
            avatar={avatar}
            selected={selectedId === edgeKey(wall)}
            editing={editing}
            wallTexture={textures.get(effectiveMaterialId) ?? fallbackTexture}
            activeLevel={level}
            suppressBalustrade={suppressBalustrade}
            onSelectWall={onSelectWall}
            onHoverWall={onHoverWall}
            wallPlacementActive={wallPlacementActive}
            onWallFurnitureHover={onWallFurnitureHover}
            onWallFurnitureLeave={onWallFurnitureLeave}
            onWallFurniturePlace={onWallFurniturePlace}
          />
        );
      })}
    </WallPointerPassthrough>
  );
});

const CurvedGlass = memo(function CurvedGlass({
  curve,
  selected = false,
  ghost = false,
  onSelect,
}: {
  curve: CurvedGlassSegment;
  selected?: boolean;
  ghost?: boolean;
  onSelect?: () => void;
}) {
  const geometry = useMemo(() => ({ glass: curveGeometry(curve), frames: curveFrameGeometry(curve) }), [curve]);
  useEffect(
    () => () => {
      geometry.glass.dispose();
      geometry.frames.forEach(frame => frame.dispose());
    },
    [geometry]
  );
  const glassMaterial = curveGlassMaterial(curve.material, { selected, ghost });
  const frameColor =
    selected || ghost
      ? "#53f5e2"
      : curve.frame === "brass"
        ? "#c9a168"
        : curve.frame === "graphite"
          ? "#3b4c5e"
          : "#a4becc";
  return (
    <group
      position={[curve.x, curve.level * LEVEL_HEIGHT, curve.z]}
      onPointerDown={ghost ? undefined : event => event.stopPropagation()}
      onClick={
        ghost
          ? undefined
          : event => {
              event.stopPropagation();
              onSelect?.();
            }
      }
    >
      <mesh geometry={geometry.glass} raycast={ghost ? NOOP_RAYCAST : undefined} dispose={null}>
        <meshPhysicalMaterial {...glassMaterial} thickness={curve.thickness} side={THREE.DoubleSide} />
      </mesh>
      {geometry.frames.map((frame, index) => (
        <mesh
          key={index}
          geometry={frame}
          dispose={null}
          raycast={ghost ? NOOP_RAYCAST : undefined}
          castShadow={!ghost}
        >
          <meshStandardMaterial
            color={frameColor}
            metalness={0.74}
            roughness={0.24}
            transparent={ghost}
            opacity={ghost ? 0.45 : 1}
          />
        </mesh>
      ))}
    </group>
  );
});

const LedStripMesh = memo(function LedStripMesh({ strip, selected, editing, onSelect }: { strip: LedStrip; selected?: boolean; editing: boolean; onSelect?: () => void }) {
  const horizontal = strip.start.z === strip.end.z;
  const length = Math.max(0.35, horizontal ? Math.abs(strip.end.x - strip.start.x) + 1 : Math.abs(strip.end.z - strip.start.z) + 1);
  const cx = (strip.start.x + strip.end.x) / 2 + 0.5;
  const cz = (strip.start.z + strip.end.z) / 2 + 0.5;
  const color = selected ? "#ffffff" : strip.color;
  return <group position={[cx, strip.start.level * LEVEL_HEIGHT + 0.065, cz]} rotation={[0, horizontal ? 0 : Math.PI / 2, 0]}>
    <mesh
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); if (editing) onSelect?.(); }}
      castShadow={false}
    >
      <boxGeometry args={[length, 0.045, 0.075]} />
      <meshStandardMaterial color={color} emissive={strip.color} emissiveIntensity={selected ? 5 : 4} toneMapped={false} metalness={0.2} roughness={0.25} />
    </mesh>
    <pointLight color={strip.color} intensity={selected ? 1.2 : 0.65} distance={2.5} decay={2} />
    {selected && <mesh raycast={NOOP_RAYCAST} position={[0, -0.035, 0]}><boxGeometry args={[length + 0.08, 0.015, 0.14]} /><meshBasicMaterial color="#32e6f4" transparent opacity={0.45} /></mesh>}
  </group>;
});

export function DynamicFurniture({
  item,
  onClick,
  onPointerDown,
  onHover,
  onLeave,
  selected,
  active = true,
  onLoadError,
  previewColor = "#32e6f4",
}: {
  item: BuildingFurniture;
  onClick: () => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onHover?: () => void;
  onLeave?: () => void;
  selected: boolean;
  active?: boolean;
  onLoadError?: (furnitureId: string) => void;
  previewColor?: string;
}) {
  const definition = FURNITURE.find(def => def.id === item.furnitureId);
  const rotated = item.rotation % 180 !== 0;
  const footprint = definition ? undefined : getApartmentFootprint(item.furnitureId, item.rotation);
  const width = definition ? Math.ceil(rotated ? definition.depth : definition.width) : footprint?.width ?? 1;
  const depth = definition ? Math.ceil(rotated ? definition.width : definition.depth) : footprint?.depth ?? 1;
  // The parent group applies the item's rotation, so selection geometry uses
  // the unrotated catalog footprint and rotates with the rendered model.
  const baseWidth = definition ? Math.ceil(definition.width) : footprint ? (rotated ? footprint.depth : footprint.width) : 1;
  const baseDepth = definition ? Math.ceil(definition.depth) : footprint ? (rotated ? footprint.width : footprint.depth) : 1;
  const placementType = item.placementType ?? definition?.placementType ?? "floor";
  const isInsert = placementType === "wall_insert";
  const wallYaw = item.wallNormal ? Math.atan2(item.wallNormal[0], item.wallNormal[2]) : 0;
  const ceilingY = item.ceilingY ?? LEVEL_HEIGHT - 0.12;
  const renderY = (item.parent_id || isInsert) && item.transform ? item.transform.position.y
    : placementType === "ceiling"
    // GLB/procedural furniture is fitted with its local bottom at y=0.  A
    // ceiling object is rotated around that pivot, so its top must sit on the
    // ceiling plane and the body hangs down from it.
    ? item.level * LEVEL_HEIGHT + ceilingY
    : item.level * LEVEL_HEIGHT + (item.wallY ?? 0);
  return (
    <group
      position={[(item.parent_id || isInsert) && item.transform ? item.transform.position.x : item.x + width / 2, renderY, (item.parent_id || isInsert) && item.transform ? item.transform.position.z : item.z + depth / 2]}
      rotation={[placementType === "ceiling" ? Math.PI : 0, isInsert ? wallInsertYaw(item) : wallYaw + (item.rotation * Math.PI) / 180, 0]}
      onPointerDown={event => { event.stopPropagation(); if (event.button === 0) onPointerDown?.(event); }}
      onPointerOver={onHover ? event => { event.stopPropagation(); onHover(); } : undefined}
      onPointerOut={onLeave ? event => { event.stopPropagation(); onLeave(); } : undefined}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
    >
      {isInsert && <mesh position={[0, (definition?.height ?? 2) / 2, 0]}>
        <boxGeometry args={[definition?.width ?? 1, definition?.height ?? 2, 1.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>}
      <FurnitureLoadBoundary furnitureId={item.furnitureId} onLoadError={onLoadError}>
        <Suspense fallback={null}>
          <Furniture kind={item.furnitureId} active={active && (item.light_dimmer_value ?? 3) > 0} lightDimmer={item.light_dimmer_value ?? 3} neonColor={item.light_color ?? item.neonColor} />
        </Suspense>
      </FurnitureLoadBoundary>
      {selected && (
        <>
          {!isInsert && <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.025, 0]}
            raycast={NOOP_RAYCAST}
          >
            <planeGeometry args={[baseWidth, baseDepth]} />
            <meshBasicMaterial color={previewColor} transparent opacity={0.28} depthWrite={false} />
          </mesh>}
          <mesh
            position={[0, Math.max((definition?.height ?? 1) / 2, 0.45), 0]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[isInsert ? definition?.cutoutSize?.[0] ?? baseWidth : baseWidth, Math.max(definition?.height ?? 1, 0.9), isInsert ? 0.2 : baseDepth]} />
            <meshBasicMaterial color={previewColor} wireframe transparent opacity={0.78} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** One failed or slow GLB must not suspend the architecture, camera and all
 * other furniture. This boundary is shared by Home, Build/Buy and Showcase. */
class FurnitureLoadBoundary extends Component<
  { children: ReactNode; furnitureId: string; onLoadError?: (furnitureId: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onLoadError?.(this.props.furnitureId); }
  render() {
    return this.state.failed
      ? <Html center position={[0, 1, 0]} style={{ pointerEvents: "none" }}><span className="world-tooltip">Lỗi tải nội thất 3D</span></Html>
      : this.props.children;
  }
}

function WallFurnitureVisibility({ item, wall, cutaway, floorKeys, roomBounds, avatar, editing, children }: {
  item: BuildingFurniture;
  wall?: WallSegment;
  cutaway: boolean;
  floorKeys: Set<string>;
  roomBounds: ReturnType<typeof computeRoomBounds>;
  avatar: React.RefObject<{ x: number; z: number }>;
  editing: boolean;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const def = FURNITURE.find(candidate => candidate.id === item.furnitureId);
  const applies = Boolean(wall && hasPlacementFlag(def?.placementFlags ?? 0, PlacementFlags.SHOW_OBJ_IF_WALL_DOWN));
  useFrame(({ camera }) => {
    if (!group.current || !applies || !wall) return;
    const state = evaluateWallCutaway({ wall, cutaway: cutaway && architectureCutaway(camera.position, {
      minX: roomBounds.minX, maxX: roomBounds.maxX, minZ: roomBounds.minZ, maxZ: roomBounds.maxZ, maxLevel: 0, cellSize: 1,
    }, camera.userData.desktopCameraMode ?? (editing ? "build" : "follow"), editing), selected: false, floorKeys, roomBounds, cameraPosition: camera.position, avatarPosition: avatar.current });
    group.current.visible = !state.cutawayActive || state.capHeight >= (item.wallY ?? 0) + Math.min(def?.height ?? 0.2, 0.2);
  });
  return <group ref={group}>{children}</group>;
}

function BuyGhost({ item, valid }: { item: BuildingFurniture; valid: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    ref.current?.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.raycast = NOOP_RAYCAST;
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.color.set(valid ? "#32e6f4" : "#ff6386");
            mat.transparent = true;
            mat.opacity = 0.4;
            mat.depthWrite = false;
          }
        }
      }
    });
  }, [item, valid]);
  return (
    <group ref={ref}>
      <DynamicFurniture item={item} selected previewColor={valid ? "#32e6f4" : "#ff315d"} onClick={() => {}} />
    </group>
  );
}

const EMPTY_PATH: { x: number; z: number }[] = [];
const EMPTY_ACTIVE_INSTANCES: Readonly<Record<string, boolean>> = {};
function nearbyFurniture(plan: BuildingPlan, level: number, point: { x: number; z: number }) {
  return plan.furniture.filter(item => item.level === level).map(item => {
    const cells = furnitureFootprint(item);
    const distance = Math.min(...cells.map(cell => Math.hypot(Math.max(cell.x - point.x, 0, point.x - cell.x - 1), Math.max(cell.z - point.z, 0, point.z - cell.z - 1))));
    return { item, distance, action: resolveFurnitureInteraction(item.furnitureId) };
  }).filter(candidate => candidate.action && candidate.distance <= 1.5).sort((a, b) => a.distance - b.distance)[0];
}
type LiveAction = "jump" | "interact" | "weapon" | "stand";
type LiveActionContext = { weaponDrawn: boolean; nearest?: { id: string; label: string; item: BuildingFurniture }; standing: boolean };

export function WorldScene(props: ConstructionWorldProps & { liveInput?: LiveInputController; onActionContext?: (context: LiveActionContext) => void }) {
  const plan = props.preview ?? props.plan;
  const plot = props.plot ?? DEFAULT_PLOT;
  const level = props.floorLevel;
  const editing = props.mode !== "live";
  const visibleFloors = useMemo(() => plan.floors.filter(cell => cell.level <= level), [plan.floors, level]);
  const roomBounds = useMemo(() => computeRoomBounds(props.plan.floors, level, plot), [props.plan.floors, level, plot]);
  const isFixedShell = useMemo(() => isFixedApartmentShell(plan.floors, plot), [plan.floors, plot]);
  const interactionPlot = isFixedShell ? APARTMENT_TERRACE_PLOT : plot;
  const showReferencePenthouse = !!props.showReferencePenthouse && isFixedShell;
  const walls = useMemo(() => plan.walls.filter(wall => wall.level <= level), [plan.walls, level]);
  const spawn = useMemo(
    () => safeSpawn({ ...plan, floors: plan.floors.filter(cell => cell.level === level) }, showReferencePenthouse ? { x: 2, z: -2, level } : undefined) ?? safeSpawn(plan),
    [plan, level, showReferencePenthouse]
  );
  const petSpawn = useMemo(
    () => (spawn && props.activePet ? findPetSpawn(plan, spawn) : undefined),
    [plan, spawn, props.activePet]
  );
  const avatar = useRef({ x: spawn ? spawn.x + 0.5 : 0, z: spawn ? spawn.z + 0.5 : 0 });
  const avatarLevel = useRef(level);
  const [path, setPath] = useState<{ plan: BuildingPlan; level: number; points: { x: number; z: number }[] }>({
    plan,
    level,
    points: EMPTY_PATH,
  });
  const [hover, setHover] = useState<GridPoint>();
  const [hoverVertex, setHoverVertex] = useState<GridPoint>();
  const [demolishPoint, setDemolishPoint] = useState<[number, number, number]>();
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [hoveredFurnitureId, setHoveredFurnitureId] = useState<string>();
  const [refundFeedback, setRefundFeedback] = useState<{ point: GridPoint; amount: number }>();
  const [wallHover, setWallHover] = useState<{ point: THREE.Vector3; normal: [number, number, number]; wall: WallSegment }>();
  const [wallPointerValid, setWallPointerValid] = useState(false);
  const furnitureDrop = useRef<{ point: GridPoint; placement?: { normal?: [number, number, number]; y?: number; ceilingY?: number; wallId?: string; wallU?: number } } | undefined>(undefined);
  const carriedFurnitureId = useRef<string | undefined>(undefined);
  const [hoverEdge, setHoverEdge] = useState<EdgeRef>();
  const [drag, setDrag] = useState<{ start: GridPoint; end: GridPoint; edge: EdgeRef; demolish: boolean }>();
  const [pendingDemolishEdges, setPendingDemolishEdges] = useState<EdgeRef[]>([]);
  const [demolishDragPoint, setDemolishDragPoint] = useState<GridPoint>();
  const pendingDemolishRef = useRef<EdgeRef[]>([]);
  const demolishAnchor = useRef<{ edge: EdgeRef; pointerId: number; start: GridPoint } | null>(null);
  const demolishReleasePoint = useRef<GridPoint | undefined>(undefined);
  const orbitControlsRef = useRef<(THREE.EventDispatcher & { enabled?: boolean }) | null>(null);
  const lockedOrbitControl = useRef<{ control: THREE.EventDispatcher & { enabled?: boolean }; enabled: boolean } | null>(null);
  const suppressDemolishContextMenu = useRef(false);
  const [ledDrag, setLedDrag] = useState<{ start: GridPoint; end: GridPoint }>();
  const pending = useRef<{ plan: BuildingPlan; level: number; arrival: FurnitureArrival } | undefined>(undefined);
  const interactFurnitureRef = useRef<(item: BuildingFurniture) => void>(() => {});
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pose, setPose] = useState<AvatarPose>();
  const [weaponDrawn, setWeaponDrawn] = useState(false);
  const weaponTransition = useRef<"draw" | "sheath" | undefined>(undefined);
  const weaponTransitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seatedPose = useRef<AvatarPose | undefined>(undefined);
  const [lightOverride, setLightOverride] = useState<{ furniture: BuildingPlan["furniture"]; values: Record<string, boolean> }>(() => ({ furniture: plan.furniture, values: {} }));
  const activeInstances = lightOverride.furniture === plan.furniture ? lightOverride.values : EMPTY_ACTIVE_INSTANCES;
  const [localInput] = useState(() => createLiveInputController());
  const liveInput = props.liveInput ?? localInput;
  const controlRef = useRef<AvatarControlState | undefined>(undefined);
  const movement = useRef<LiveMovementState | undefined>(undefined);
  const windowFocused = useRef(true);
  const heldKeys = useRef(new Set<string>());
  const releasedKeys = useRef(new Set<string>());
  const jumpY = useRef(0);
  const jumpVelocity = useRef(0);
  const jumpPhase = useRef<"ground" | "jump" | "fall" | "land">("ground");
  const contextSignature = useRef("");
  const { camera } = useThree();
  const activeFurniture = props.activeFurniture;
  const onFurniturePlace = props.onFurniturePlace;
  const onFurnitureNotice = props.onNotice;
  const orbitControls = useThree(state => state.controls) as (THREE.EventDispatcher & { enabled?: boolean }) | null;
  useEffect(() => { orbitControlsRef.current = orbitControls; }, [orbitControls]);
  useEffect(() => {
    if (carriedFurnitureId.current !== activeFurniture?.id) {
      furnitureDrop.current = undefined;
      carriedFurnitureId.current = activeFurniture?.id;
    }
  }, [activeFurniture?.id]);
  const cameraForward = useMemo(() => new THREE.Vector3(), []);
  const liveWorld = useMemo(() => createLiveMovementWorld(plan, level, plot), [plan, level, plot]);
  const navigationPlan = useMemo(() => createCorridorNavigationPlan(plan, plot), [plan, plot]);
  const corridorBounds = useMemo(() => getApartmentCorridorBounds(plan, plot), [plan, plot]);
  const worldColliders = useMemo(() => {
    if (!isFixedShell) return corridorBounds && level === 0 ? createCorridorCameraColliders(corridorBounds, level) : [];
    const city = buildCityScene(props.quality).towers;
    const cityBoxes = createCityTowerColliders(city, residenceCityOffset(props.residenceFloor), 0, roomBounds.centerX, roomBounds.centerZ);
    const corridorBoxes = corridorBounds && level === 0 ? createCorridorCameraColliders(corridorBounds, level) : [];
    return [...corridorBoxes, ...cityBoxes];
  }, [isFixedShell, corridorBounds, level, props.quality, props.residenceFloor, roomBounds.centerX, roomBounds.centerZ]);
  const onActionContext = props.onActionContext;
  useEffect(() => {
    const nearest = nearbyFurniture(plan, level, avatar.current);
    onActionContext?.({ weaponDrawn, standing: !pose, ...(nearest?.action ? { nearest: { id: nearest.item.id, label: nearest.action.interaction.label, item: nearest.item } } : {}) });
  }, [level, plan, pose, onActionContext, weaponDrawn]);
  const releaseLiveControl = useCallback(() => {
    for (const code of heldKeys.current) releasedKeys.current.add(code);
    liveInput.clear();
    controlRef.current = undefined;
    movement.current = undefined;
    jumpY.current = 0;
    jumpVelocity.current = 0;
    jumpPhase.current = "ground";
  }, [liveInput]);

  useEffect(() => {
    pending.current = undefined;
    seatedPose.current = undefined;
    releaseLiveControl();
    const currentCell = { x: Math.floor(avatar.current.x), z: Math.floor(avatar.current.z), level };
    const supported = plan.floors.some(cell => cellKey(cell) === cellKey(currentCell));
    if (spawn && (avatarLevel.current !== level || !supported || occupiedCells(plan).has(cellKey(currentCell)))) {
      avatar.current = { x: spawn.x + 0.5, z: spawn.z + 0.5 };
    }
    avatarLevel.current = level;
    return () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
      navigationTimer.current = undefined;
      if (weaponTransitionTimer.current) clearTimeout(weaponTransitionTimer.current);
      weaponTransitionTimer.current = undefined;
      weaponTransition.current = undefined;
      releaseLiveControl();
    };
  }, [plan, level, editing, spawn, releaseLiveControl]);

  useEffect(() => {
    const gate = () => ({ enabled: !editing && !!spawn && spawn.level === level, blocked: !windowFocused.current });
    liveInput.setOnStart(() => {
      if (liveControlsBlocked(document, gate())) return;
      if (seatedPose.current) { liveInput.triggerAction("stand"); return; }
      pending.current = undefined;
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
      navigationTimer.current = undefined;
      setPose(undefined);
      setPath({ plan, level, points: EMPTY_PATH });
      movement.current = createLiveMovementState(avatar.current, showReferencePenthouse ? .12 : 0);
      controlRef.current = movement.current;
    });
    const freeze = () => {
      liveInput.clear();
      jumpY.current = 0;
      jumpVelocity.current = 0;
      jumpPhase.current = "ground";
      if (movement.current) {
        movement.current = { ...movement.current, velocity: { x: 0, z: 0 }, animation: "idle" };
        controlRef.current = movement.current;
      }
    };
    const blur = () => {
      windowFocused.current = false;
      heldKeys.current.clear();
      releasedKeys.current.clear();
      freeze();
    };
    const focus = () => {
      windowFocused.current = true;
    };
    const visibility = () => {
      if (document.hidden) freeze();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!editing && liveDirectionForCode(event.code)) heldKeys.current.add(event.code);
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        if (!liveControlsBlocked(document, gate()) && !isLiveTypingTarget(event.target)) liveInput.setRun(true);
      }
      const action: LiveAction | undefined = event.code === "Space" ? "jump" : event.code === "KeyE" ? "interact" : event.code === "KeyX" ? "weapon" : undefined;
      if (action && !event.repeat && !liveControlsBlocked(document, gate()) && !isLiveTypingTarget(event.target) && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        liveInput.triggerAction(action);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      heldKeys.current.delete(event.code);
      releasedKeys.current.delete(event.code);
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") liveInput.setRun(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    const unbind = bindLiveControlListeners(
      window,
      document,
      {
        ...liveInput,
        press: code => {
          if (!releasedKeys.current.has(code)) liveInput.press(code);
        },
      },
      gate
    );
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      unbind();
      liveInput.setOnStart(undefined);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [editing, spawn, level, plan, liveInput, showReferencePenthouse]);

  useFrame((_, delta) => {
    const blocked = liveControlsBlocked(document, {
      enabled: !editing && !!spawn && spawn.level === level,
      blocked: !windowFocused.current,
    });
    if (blocked) {
      for (const code of heldKeys.current) releasedKeys.current.add(code);
      liveInput.clear();
    }
    const nearestContextFurniture = nearbyFurniture(plan, level, avatar.current);
    const context: LiveActionContext = { weaponDrawn, standing: !pose, ...(nearestContextFurniture?.action ? { nearest: { id: nearestContextFurniture.item.id, label: nearestContextFurniture.action.interaction.label, item: nearestContextFurniture.item } } : {}) };
    const signature = `${context.weaponDrawn}:${context.standing}:${context.nearest?.id ?? ""}:${context.nearest?.label ?? ""}`;
    if (signature !== contextSignature.current) {
      contextSignature.current = signature;
      props.onActionContext?.(context);
    }
    const action = liveInput.consumeAction();
    if (pose) {
      liveInput.clear();
      if ((action === "stand" || action === "interact") && !pose.exiting && pose.exit) {
        const exitPose: AvatarPose = { ...pose, ...pose.exit, y: 0, activity: "idle", exiting: true };
        seatedPose.current = exitPose;
        setPose(exitPose);
      }
      return;
    }
    if (action && !movement.current && !blocked) {
      movement.current = createLiveMovementState(avatar.current, showReferencePenthouse ? .12 : 0);
      controlRef.current = movement.current;
    }
    if (!movement.current) return;
    if (action === "weapon" && !pose && !weaponTransition.current) {
      const nextDrawn = !weaponDrawn;
      weaponTransition.current = nextDrawn ? "draw" : "sheath";
      weaponTransitionTimer.current = setTimeout(() => {
        setWeaponDrawn(nextDrawn);
        weaponTransition.current = undefined;
        weaponTransitionTimer.current = undefined;
      }, 420);
    }
    if (action === "interact" && jumpPhase.current === "ground") {
      {
        const nearest = nearbyFurniture(plan, level, avatar.current);
        if (nearest) interactFurnitureRef.current(nearest.item);
      }
    }
    if (action === "jump" && !pose && jumpPhase.current === "ground") {
      jumpVelocity.current = 5.2;
      jumpPhase.current = "jump";
    }
    if (jumpPhase.current !== "ground") {
      if (jumpPhase.current === "land") jumpPhase.current = "ground";
      else {
        jumpVelocity.current -= 14 * delta;
        jumpY.current = Math.max(0, jumpY.current + jumpVelocity.current * delta);
      const height = 1.83 * (props.character?.appearance?.height ?? 1) * bodyShape(props.character?.appearance?.body, props.character?.appearance?.presentation).height;
      const ceiling = Math.max(0, LEVEL_HEIGHT - .3 - height);
      if (jumpY.current >= ceiling) {
        jumpY.current = ceiling;
        jumpVelocity.current = Math.min(0, jumpVelocity.current);
      }
      if (jumpY.current <= 0) {
          jumpY.current = 0;
          jumpVelocity.current = 0;
          jumpPhase.current = "land";
        } else if (jumpVelocity.current < 0) jumpPhase.current = "fall";
      }
    }
    // Furniture routing may release direct control while handling E; wait for
    // the Avatar's path driver before sampling movement again.
    if (!movement.current) return;
    camera.getWorldDirection(cameraForward);
    movement.current = stepLiveMovement(
      movement.current,
      liveInput.sample(),
      cameraForward,
      delta,
      liveWorld,
      { enabled: !blocked, run: liveInput.isRunning() }
    );
    const actionAnimation = weaponTransition.current ?? (jumpPhase.current === "jump" ? "jump" : jumpPhase.current === "fall" ? "fall" : jumpPhase.current === "land" ? "land" : movement.current.animation);
    controlRef.current = { ...movement.current, animation: actionAnimation, vertical: jumpY.current };

  }, -2);

  const pointer = useRef<{ start: GridPoint; startCell: GridPoint; edge: EdgeRef; pointerId: number; demolish: boolean } | null>(null);
  const { onDemolishEdges } = props;
  const touchCount = useRef(new Set<number>());
  const root = useRef<THREE.Group>(null);

  const clearPendingDemolish = useCallback(() => {
    if (lockedOrbitControl.current) lockedOrbitControl.current.control.enabled = lockedOrbitControl.current.enabled;
    lockedOrbitControl.current = null;
    demolishAnchor.current = null;
    pendingDemolishRef.current = [];
    pointer.current = null;
    setPendingDemolishEdges([]);
    setDemolishDragPoint(undefined);
    setDrag(undefined);
  }, []);
  const updatePendingDemolish = useCallback((target: EdgeRef) => {
    const anchor = demolishAnchor.current;
    if (!anchor) return;
    const wallKeys = new Set(plan.walls.map(edgeKey));
    const edges = wallEdgesBetweenSegments(anchor.edge, target)
      .filter(edge => wallKeys.has(edgeKey({ ...edge, materialId: "" })));
    pendingDemolishRef.current = edges;
    setPendingDemolishEdges(edges);
  }, [plan.walls]);
  const beginPendingDemolish = useCallback((edge: EdgeRef, pointerId: number, point: GridPoint) => {
    suppressDemolishContextMenu.current = false;
    const control = orbitControlsRef.current;
    if (control && typeof control.enabled === "boolean" && !lockedOrbitControl.current) {
      lockedOrbitControl.current = { control, enabled: control.enabled };
      control.enabled = false;
    }
    demolishAnchor.current = { edge, pointerId, start: snapWallVertex(point, edge.level) };
    demolishReleasePoint.current = point;
    setDemolishDragPoint(point);
    const edges = plan.walls.some(wall => edgeKey(wall) === edgeKey({ ...edge, materialId: "" })) ? [edge] : [];
    pendingDemolishRef.current = edges;
    setPendingDemolishEdges(edges);
  }, [plan.walls]);
  const commitPendingDemolish = useCallback((pointerId: number) => {
    if (demolishAnchor.current?.pointerId !== pointerId) return false;
    const anchor = demolishAnchor.current;
    const edges = pendingDemolishRef.current;
    const release = demolishReleasePoint.current;
    const end = release && snapWallVertex(release, anchor.start.level);
    const zeroLengthWallClick = props.tool === "wall" && end?.x === anchor.start.x && end?.z === anchor.start.z;
    clearPendingDemolish();
    if (!zeroLengthWallClick && edges.length) {
      const amount = onDemolishEdges?.(edges) ?? 0;
      if (release) setRefundFeedback({ point: release, amount });
    }
    return true;
  }, [clearPendingDemolish, onDemolishEdges, props.tool]);

  useEffect(() => {
    const cancel = () => {
      clearPendingDemolish();
      touchCount.current.clear();
    };
    const touchStart = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touchCount.current.add(event.pointerId);
        if (touchCount.current.size > 1) {
          clearPendingDemolish();
        }
      }
    };
    const touchEnd = (event: PointerEvent) => touchCount.current.delete(event.pointerId);
    const pointerUp = (event: PointerEvent) => { commitPendingDemolish(event.pointerId); };
    const rightClick = (event: PointerEvent) => { if (event.button === 2 && demolishAnchor.current) { suppressDemolishContextMenu.current = true; clearPendingDemolish(); } };
    const contextMenu = (event: MouseEvent) => { if (demolishAnchor.current || suppressDemolishContextMenu.current) { event.preventDefault(); clearPendingDemolish(); suppressDemolishContextMenu.current = false; } };
    const escape = (event: KeyboardEvent) => { if (event.code === "Escape" && demolishAnchor.current) clearPendingDemolish(); };
    window.addEventListener("pointerdown", touchStart);
    window.addEventListener("pointerdown", rightClick);
    window.addEventListener("pointerup", touchEnd);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("contextmenu", contextMenu);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", touchStart);
      window.removeEventListener("pointerdown", rightClick);
      window.removeEventListener("pointerup", touchEnd);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("contextmenu", contextMenu);
      window.removeEventListener("keydown", escape);
    };
  }, [clearPendingDemolish, commitPendingDemolish]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "ControlLeft" || event.code === "ControlRight") setCtrlHeld(true); };
    const up = (event: KeyboardEvent) => { if (event.code === "ControlLeft" || event.code === "ControlRight") setCtrlHeld(false); };
    const blur = () => setCtrlHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);
  useEffect(() => {
    if (!refundFeedback) return;
    const timer = window.setTimeout(() => setRefundFeedback(undefined), 1800);
    return () => window.clearTimeout(timer);
  }, [refundFeedback]);

  const groundPoint = (event: ThreeEvent<PointerEvent>) => ({
    x: Math.floor(event.point.x),
    z: Math.floor(event.point.z),
    level,
  });

  const walkTo = (goal: GridPoint) => {
    if (editing || !spawn || liveControlsBlocked(document, { enabled: true, blocked: !windowFocused.current })) return;
    if (seatedPose.current) { liveInput.triggerAction("stand"); return; }
    releaseLiveControl();
    pending.current = undefined;
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    setPose(undefined);
    setPath({ plan, level, points: EMPTY_PATH });
    const start = { x: Math.floor(avatar.current.x), z: Math.floor(avatar.current.z), level };
    const route = findBuildingPath(navigationPlan, start, goal);
    if (!route.length) {
      props.onNotice?.("Không có lối đi. Hãy kiểm tra cửa và khoảng trống quanh đồ vật.");
      return;
    }
    if (route.some(cell => cell.level !== level)) {
      props.onNotice?.("Chọn tầng đích để xem hoạt động trên tầng đó.");
      return;
    }
    setPath({ plan, level, points: route.map(cell => ({ x: cell.x + 0.5, z: cell.z + 0.5 })) });
  };

  function interactFurniture(item: BuildingFurniture) {
    if (editing) {
      props.onSelect?.({ kind: "furniture", id: item.id });
      return;
    }
    if (liveControlsBlocked(document, { enabled: true, blocked: !windowFocused.current })) return;
    const directAction = resolveFurnitureInteraction(item.furnitureId);
    if (directAction?.toggle && FURNITURE.find(candidate => candidate.id === item.furnitureId)?.category === "light") {
      const current = activeInstances[item.id] ?? (item.light_dimmer_value ?? 3) > 0;
      const next = current ? 0 : Math.max(1, item.light_dimmer_value ?? 3);
      setLightOverride({ furniture: plan.furniture, values: { ...activeInstances, [item.id]: next > 0 } });
      props.onLightSelect?.(item.id);
      props.onLightToggle?.(item.id, next);
      return;
    }
    if (jumpPhase.current !== "ground") return;
    if (seatedPose.current) { liveInput.triggerAction("stand"); return; }
    releaseLiveControl();
    pending.current = undefined;
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    setPose(undefined);
    setPath({ plan, level, points: EMPTY_PATH });
    const action = resolveFurnitureInteraction(item.furnitureId);
    if (!action || !spawn) return;
    const start = { x: Math.floor(avatar.current.x), z: Math.floor(avatar.current.z), level };
    const points = buildingFurnitureRoute(navigationPlan, start, item);
    const destination = points[points.length - 1];
    if (!destination) {
      props.onNotice?.("Đồ vật chưa có lối tiếp cận. Di chuyển nội thất hoặc thêm cửa.");
      return;
    }
    const footprint = furnitureFootprint(item);
    const center = footprint.reduce(
      (sum, cell) => ({ x: sum.x + cell.x + 0.5, z: sum.z + cell.z + 0.5 }),
      { x: 0, z: 0 }
    );
    pending.current = {
      plan,
      level,
      arrival: {
        instanceId: item.id,
        action,
        destination,
        facing: Math.atan2(center.x / footprint.length - destination.x, center.z / footprint.length - destination.z),
      },
    };
    setPath({ plan, level, points });
  };
  useEffect(() => {
    interactFurnitureRef.current = interactFurniture;
  });

  const { tool, onSelect, onGesture } = props;
  const demolishMode = editing && (tool === "erase" || (tool === "wall" && ctrlHeld));
  const hoveredWall = demolishMode && hoverEdge ? plan.walls.find(wall => edgeKey(wall) === edgeKey({ ...hoverEdge, materialId: "" })) : undefined;
  const onDemolishWallHover = useCallback((event: ThreeEvent<PointerEvent>, wall: WallSegment) => {
    const edge = { x: wall.x, z: wall.z, level: wall.level, orientation: wall.orientation };
    setHoverEdge(edge);
    setDemolishPoint([event.point.x, wall.level * LEVEL_HEIGHT + 0.07, event.point.z]);
    if (event.type === "pointerdown" && event.button === 0) {
      beginPendingDemolish(edge, event.pointerId, { x: event.point.x, z: event.point.z, level: wall.level });
    } else if ((event.buttons & 1) && demolishAnchor.current?.pointerId === event.pointerId) {
      demolishReleasePoint.current = { x: event.point.x, z: event.point.z, level: wall.level };
      setDemolishDragPoint(demolishReleasePoint.current);
      updatePendingDemolish(edge);
    }
  }, [beginPendingDemolish, updatePendingDemolish]);
  const activeDefinition = FURNITURE.find(item => item.id === props.activeFurniture?.furnitureId);
  const activePlacementType: "floor" | "wall" | "ceiling" | "wall_insert" = props.activeFurniture?.placementType ?? activeDefinition?.placementType ?? placementTypeForFlags(activeDefinition?.placementFlags ?? PlacementFlags.FLOOR_ONLY);
  const ceilingHeight = LEVEL_HEIGHT - 0.12;
  const wallPlacementActive = editing && !!props.activeFurniture && (activePlacementType === "wall" || activePlacementType === "wall_insert");
  const effectiveWallHover = wallPlacementActive ? wallHover : undefined;
  const structuralInsertWalls = useMemo(() => new Set<string>(), []);
  const insertCandidate = useCallback((item: BuildingFurniture, hit: { point: THREE.Vector3; normal: [number, number, number]; wall: WallSegment }) => {
    const { wall } = hit;
    const definition = FURNITURE.find(entry => entry.id === item.furnitureId);
    const wallHeight = buildingItem(wall.materialId)?.height ?? 2.8;
    const height = definition?.cutoutSize?.[1] ?? definition?.height ?? 1;
    const snapped = snapWallInsertPoint(wall, hit.point, height, wallHeight, definition?.category === "doors" ? "doors" : "windows");
    return withLotObject({ ...item, x: wall.x, z: wall.z, level: wall.level, rotation: 0, placementType: "wall_insert", wall_id: edgeKey(wall), wall_u: snapped.u, wallNormal: hit.normal, wallY: snapped.bottom });
  }, []);
  const wallSurface = useCallback((event: ThreeEvent<PointerEvent>, wall: WallSegment) => {
    // The transparent wall hitbox has narrow end caps. A ray that touches an
    // end cap must still face the actual wall plane, never the cap's normal.
    const side = wall.orientation === "x"
      ? event.ray.origin.z >= wall.z ? 1 : -1
      : event.ray.origin.x >= wall.x ? 1 : -1;
    const normal: [number, number, number] = wall.orientation === "x" ? [0, 0, side] : [side, 0, 0];
    return { point: event.point.clone(), normal, wall };
  }, []);
  const onWallFurnitureHover = useCallback((event: ThreeEvent<PointerEvent>, wall: WallSegment) => {
    if (!wallPlacementActive) return;
    const hit = wallSurface(event, wall);
    setWallHover(hit);
    setWallPointerValid(true);
    if (props.activeFurniture && activePlacementType === "wall_insert") {
      const candidate = insertCandidate(props.activeFurniture, hit);
      furnitureDrop.current = { point: { x: wall.x, z: wall.z, level: wall.level }, placement: { normal: hit.normal, y: candidate.wallY, wallId: candidate.wall_id, wallU: candidate.wall_u } };
    } else if (props.activeFurniture) {
      const definition = FURNITURE.find(entry => entry.id === props.activeFurniture?.furnitureId);
      const width = Math.ceil(definition?.width ?? 1);
      const depth = Math.ceil(definition?.depth ?? 1);
      const wallHeight = buildingItem(wall.materialId)?.height ?? 2.7;
      furnitureDrop.current = { point: { x: Math.floor(hit.point.x - width / 2), z: Math.floor(hit.point.z - depth / 2), level: wall.level }, placement: { normal: hit.normal, y: THREE.MathUtils.clamp(hit.point.y - wall.level * LEVEL_HEIGHT, 0, wallHeight - 0.05) } };
    }
  }, [wallPlacementActive, wallSurface, props.activeFurniture, activePlacementType, insertCandidate]);
  const onWallFurniturePlace = useCallback((event: ThreeEvent<PointerEvent>, wall: WallSegment) => {
    if (!wallPlacementActive || event.button !== 0) return;
    const hit = wallSurface(event, wall);
    const item = props.activeFurniture;
    if (!item) return;
    if (activePlacementType === "wall_insert") {
      const candidate = insertCandidate(item, hit);
      if (wallInsertPlacementValid(plan, candidate, structuralInsertWalls)) props.onFurniturePlace?.({ x: wall.x, z: wall.z, level: wall.level }, { normal: hit.normal, y: candidate.wallY, wallId: candidate.wall_id, wallU: candidate.wall_u });
      else props.onNotice?.("Cần dải tường liền không có cửa khác hoặc kết cấu cố định.");
      return;
    }
    const definition = FURNITURE.find(entry => entry.id === item.furnitureId);
    const width = Math.ceil(definition?.width ?? 1);
    const depth = Math.ceil(definition?.depth ?? 1);
    const wallHeight = buildingItem(wall.materialId)?.height ?? 2.7;
    props.onFurniturePlace?.({ x: Math.floor(hit.point.x - width / 2), z: Math.floor(hit.point.z - depth / 2), level: wall.level }, { normal: hit.normal, y: THREE.MathUtils.clamp(hit.point.y - wall.level * LEVEL_HEIGHT, 0, wallHeight - 0.05) });
  }, [wallPlacementActive, activePlacementType, insertCandidate, plan, structuralInsertWalls, wallSurface, props]);
  const clickWall = useCallback(
    (wall: WallSegment, point: THREE.Vector3) => {
      if (!editing) return;
      if (props.activeFurniture && (activePlacementType === "floor" || activePlacementType === "wall_insert")) return;
      const edge: EdgeRef = { x: wall.x, z: wall.z, level: wall.level, orientation: wall.orientation };
      if (demolishMode) return;
      else if (["select", "move", "copy"].includes(tool)) {
        const insert = tool !== "copy" ? wallInsertAtPoint(wall, plan, point) : undefined;
        onSelect?.(insert ? { kind: "furniture", id: insert.id } : { kind: "wall", id: edgeKey(wall) });
      }
      else onGesture(edge, edge, edge);
    },
    [editing, tool, onSelect, onGesture, props, activePlacementType, demolishMode, plan]
  );

  const dragQuote = useMemo(() => {
    if (!drag || drag.demolish) return null;
    try {
      const material =
        props.materialId ??
        (tool === "door"
          ? "door-standard"
          : tool === "window"
            ? "window-small"
            : tool === "ceiling"
              ? "ceiling-basic"
              : tool === "roof"
                ? "roof-flat"
                : "floor-concrete");
      const proposed =
        tool === "curve"
          ? addCurveDraft(plan, material, drag.start, "curve-preview", props.curveRotation ?? 0)
          : toolDraft(
              plan,
              tool as EditorTool,
              drag.start,
              drag.end,
              material,
              drag.edge,
              props.wallMaterialId ?? "wall-basic"
            );
      return quoteConstruction(
        {
          version: 1,
          revision: 0,
          plot,
          plan,
          paid: {},
          starterGrantApplied: false,
          migratedAt: new Date(0).toISOString(),
          legacyPlacementsPreserved: true,
        },
        proposed,
        0
      );
    } catch {
      return null;
    }
  }, [drag, plan, plot, tool, props.materialId, props.wallMaterialId, props.curveRotation]);
  const wallPreviewEdges = drag && (tool === "wall" || tool === "erase")
    ? wallEdgesBetweenVertices(drag.start, drag.end)
    : [];
  const demolishPreviewEdges = pendingDemolishEdges.length
    ? pendingDemolishEdges
    : demolishDragPoint ? [] : hoveredWall ? [hoveredWall] : [];
  const pendingDemolishRefund = pendingDemolishEdges.reduce((total, edge) => {
    const id = edgeKey({ ...edge, materialId: "" });
    return total + Math.floor((props.paid?.[`wall:${id}`] ?? 0) * REFUND_RATE)
      + Math.floor((props.paid?.[`opening:${id}`] ?? 0) * REFUND_RATE);
  }, 0);

  const ghost = (() => {
    if (props.activeFurniture) {
      const item = props.activeFurniture;
      const definition = FURNITURE.find(entry => entry.id === item.furnitureId);
      if (activePlacementType === "wall" || activePlacementType === "wall_insert") {
        if (!effectiveWallHover) return undefined;
        if (activePlacementType === "wall_insert") return insertCandidate(item, effectiveWallHover);
        const width = Math.ceil(definition?.width ?? 1);
        const depth = Math.ceil(definition?.depth ?? 1);
        const wallHeight = buildingItem(effectiveWallHover.wall.materialId)?.height ?? 2.7;
        return { ...item, x: Math.floor(effectiveWallHover.point.x - width / 2), z: Math.floor(effectiveWallHover.point.z - depth / 2), level: effectiveWallHover.wall.level, wallNormal: effectiveWallHover.normal, wallY: THREE.MathUtils.clamp(effectiveWallHover.point.y - effectiveWallHover.wall.level * LEVEL_HEIGHT, 0, wallHeight - 0.05) };
      }
      if (requiresSurfaceSlot(item.furnitureId)) {
        if (!hover) return undefined;
        const slot = nearestAvailableSlot(plan, item.furnitureId, hover);
        return slot ? attachToSlot(item, slot.parentId, slot.slotHash, plan) : undefined;
      }
      return hover ? { ...snapGroundedToWall(plan, item, hover), ...(activePlacementType === "ceiling" ? { ceilingY: ceilingHeight } : {}) } : undefined;
    }
    return props.ghostFurniture && hover ? { id: "preview", furnitureId: props.ghostFurniture.furnitureId, rotation: props.ghostFurniture.rotation, ...hover } : undefined;
  })();
  const curveGhost = useMemo(() => {
    if (!editing || !hover || props.mode !== "build") return undefined;
    if (tool === "move" && props.movingCurve) return { ...props.movingCurve, ...hover };
    if (tool !== "curve" || !buildingItem(props.materialId ?? "")?.curve) return undefined;
    return createCurve(props.materialId!, drag?.start ?? hover, "curve-preview", props.curveRotation ?? 0);
  }, [editing, hover, drag?.start, props.mode, tool, props.movingCurve, props.materialId, props.curveRotation]);

  const ghostCells = ghost && activePlacementType !== "wall" && activePlacementType !== "wall_insert" ? furnitureFootprint(ghost) : [];
  const floorSet = useMemo(() => new Set(plan.floors.map(cellKey)), [plan.floors]);
  const blocked = useMemo(() => occupiedCells(plan), [plan]);
  const ceilingBlocked = useMemo(() => new Set(plan.furniture.filter(item => (item.placementType ?? FURNITURE.find(definition => definition.id === item.furnitureId)?.placementType ?? "floor") === "ceiling").flatMap(furnitureFootprint).map(cellKey)), [plan.furniture]);
  const ghostValid = props.activeFurniture && requiresSurfaceSlot(props.activeFurniture.furnitureId)
    ? Boolean(ghost)
    : activePlacementType === "wall_insert"
    ? Boolean(ghost && wallPointerValid && wallInsertPlacementValid(plan, ghost, structuralInsertWalls))
    : activePlacementType === "wall"
    ? Boolean(ghost && effectiveWallHover && wallPointerValid)
    : activePlacementType === "ceiling"
      ? ghostCells.every(cell => floorSet.has(cellKey(cell)) && !ceilingBlocked.has(cellKey(cell)))
      : ghostCells.every(cell => floorSet.has(cellKey(cell)) && !blocked.has(cellKey(cell)));
  useEffect(() => {
    if (!editing || !activeFurniture) return;
    const confirmWithEnter = (event: KeyboardEvent) => {
      if (event.code !== "Enter" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (typeof HTMLElement !== "undefined" && event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName))) return;
      event.preventDefault();
      const destination = furnitureDrop.current;
      if (ghostValid && destination) onFurniturePlace?.(destination.point, destination.placement);
      else onFurnitureNotice?.("Rê vật phẩm tới vị trí hợp lệ trước khi đặt.");
    };
    window.addEventListener("keydown", confirmWithEnter);
    return () => window.removeEventListener("keydown", confirmWithEnter);
  }, [editing, activeFurniture, onFurniturePlace, onFurnitureNotice, ghostValid]);
  const low = props.quality === "performance";
  const lighting = useMemo(
    () => computeApartmentLightingRig(roomBounds, level, plan.furniture, props.quality, activeInstances),
    [roomBounds, level, plan.furniture, props.quality, activeInstances]
  );

  return (
    <>
      {!props.transparentBackground && <color attach="background" args={[lighting.background]} />}
      {!props.transparentBackground && <fog attach="fog" args={[lighting.fogColor, lighting.fogNear, lighting.fogFar]} />}
      <DesktopCamera
        mode={props.mode}
        placingFurniture={editing && !!props.activeFurniture}
        reset={props.cameraReset}
        cameraMode={props.cameraMode}
        onCameraModeChange={props.onCameraModeChange}
        plan={plan}
        avatar={avatar}
        enclosed={isFixedShell}
        referenceScene={showReferencePenthouse}
        initialShowcaseFocus={props.transparentBackground ? "lobby" : undefined}
        level={level}
        plot={plot}
        roomBounds={roomBounds}
        worldColliders={worldColliders}
      />
      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity} />
      <hemisphereLight args={[lighting.hemisphereSky, lighting.hemisphereGround, lighting.hemisphereIntensity]} />
      <directionalLight
        position={lighting.keyLight.position}
        intensity={lighting.keyLight.intensity}
        color={lighting.keyLight.color}
        castShadow={!low}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <directionalLight
        position={lighting.cityRimLight.position}
        intensity={lighting.cityRimLight.intensity}
        color={lighting.cityRimLight.color}
      />
      <directionalLight
        position={lighting.skylineVioletRim.position}
        intensity={lighting.skylineVioletRim.intensity}
        color={lighting.skylineVioletRim.color}
      />
      {lighting.pointLights.map(light => (
        <pointLight
          key={light.id}
          name={light.id}
          position={light.position}
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          decay={light.decay}
        />
      ))}
      {!props.transparentBackground && <group
        position={[roomBounds.centerX, residenceCityOffset(props.residenceFloor), roomBounds.centerZ]}
      >
        <ApartmentCity quality={props.quality} />
      </group>}
      <ArchitecturalSlab roomBounds={roomBounds} plot={plot} buildPlot={isFixedShell ? APARTMENT_TERRACE_PLOT : undefined} editing={editing} residenceFloor={props.residenceFloor} isFixedShell={isFixedShell} />
      <group ref={root}>
        <FloorTiles cells={visibleFloors} roomBounds={roomBounds} isFixedShell={isFixedShell} editing={editing} />
        <FloorTransitionStrips floors={visibleFloors} level={level} isFixedShell={isFixedShell} />
        {!showReferencePenthouse && <InteriorZones plan={plan} level={level} />}
        <PanoramaCurtainFacade
          walls={walls}
          plot={plot}
          level={level}
          isFixedShell={isFixedShell}
          selectedId={props.selectedId}
          editing={editing}
          wallDrawActive={editing && tool === "wall" && !ctrlHeld && !props.activeFurniture}
          onSelectWall={clickWall}
          onHoverWall={demolishMode ? onDemolishWallHover : undefined}
        />
        {showReferencePenthouse && <ReferencePenthouseLayer plan={plan} />}
        <WallCollection
          walls={walls}
          plan={plan}
          plot={plot}
          isFixedShell={isFixedShell}
          level={level}
          cutaway={!!props.cutaway}
          floorKeys={floorSet}
          roomBounds={roomBounds}
          avatar={avatar}
          selectedId={props.selectedId}
          editing={editing}
          wallDrawActive={editing && tool === "wall" && !ctrlHeld && !props.activeFurniture}
          suppressBalustrade={showReferencePenthouse}
          onSelectWall={clickWall}
          onHoverWall={demolishMode ? onDemolishWallHover : undefined}
          wallPlacementActive={wallPlacementActive}
          onWallFurnitureHover={onWallFurnitureHover}
            onWallFurnitureLeave={() => { setWallPointerValid(false); furnitureDrop.current = undefined; }}
          onWallFurniturePlace={onWallFurniturePlace}
        />
        {(plan.curves ?? [])
          .filter(curve => curve.level <= level)
          .map(curve => (
            <CurvedGlass
              key={curve.id}
              curve={curve}
              selected={props.selectedId === curve.id}
              onSelect={() => {
                if (editing) props.onSelect?.({ kind: "curve", id: curve.id });
              }}
            />
          ))}
        {(plan.ledStrips ?? []).filter(strip => strip.start.level <= level).map(strip => (
          <LedStripMesh key={strip.id} strip={strip} editing={editing} selected={props.selectedId === strip.id} onSelect={() => props.onSelect?.({ kind: "led", id: strip.id })} />
        ))}
        {editing && ledDrag && <LedStripMesh strip={{ id: "led-preview", start: ledDrag.start, end: ledDrag.end, color: props.ledColor ?? "#00f0ff" }} editing selected />}
        {plan.furniture
          .filter(item => item.level <= level)
          .map(item => (
            <WallFurnitureVisibility key={item.id} item={item} wall={item.wallNormal ? walls.find(wall => wall.level === item.level && (wall.orientation === "x" ? Math.abs(wall.z - (item.z + 0.5)) <= 1 : Math.abs(wall.x - (item.x + 0.5)) <= 1)) : undefined} cutaway={!!props.cutaway} floorKeys={floorSet} roomBounds={roomBounds} avatar={avatar} editing={editing}>
            <DynamicFurniture
              key={item.id}
              item={activeInstances[item.id] === undefined ? item : { ...item, light_dimmer_value: activeInstances[item.id] ? Math.max(item.light_dimmer_value ?? 3, 1) : 0 }}
              selected={props.selectedId === item.id || (demolishMode && hoveredFurnitureId === item.id)}
              previewColor={demolishMode && hoveredFurnitureId === item.id ? "#ffd34f" : "#32e6f4"}
              onHover={demolishMode ? () => setHoveredFurnitureId(item.id) : undefined}
              onLeave={demolishMode ? () => setHoveredFurnitureId(undefined) : undefined}
              active={activeInstances[item.id] ?? (item.light_dimmer_value ?? 3) > 0}
              onPointerDown={editing ? () => props.onSelect?.({ kind: "furniture", id: item.id }) : undefined}
              onClick={() => {
                if (!editing) interactFurniture(item);
              }}
              onLoadError={furnitureId => props.onNotice?.(`Không tải được nội thất 3D: ${furnitureId}.`)}
            />
            </WallFurnitureVisibility>
          ))}
        {plan.stairs
          .filter(stair => stair.level <= level)
          .map(stair => (
            <group
              key={`${cellKey(stair)}:${stair.orientation}`}
              position={[stair.x + 0.5, stair.level * LEVEL_HEIGHT, stair.z + 0.5]}
              rotation={[0, stair.orientation === "x" ? Math.PI / 2 : 0, 0]}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <Block
                  key={i}
                  position={[0, ((i + 1) * LEVEL_HEIGHT) / 20, -0.4 + i * 0.2]}
                  size={[0.85, ((i + 1) * LEVEL_HEIGHT) / 10, 0.22]}
                  color="#8c6e58"
                  roughness={0.42}
                  metalness={0.22}
                />
              ))}
            </group>
          ))}
        {props.showCeiling && (
          <>
            <FloorTiles
              cells={plan.ceilings.filter(cell => cell.level <= level)}
              roomBounds={roomBounds}
              yOffset={2.86}
              editing={editing}
            />
            <FloorTiles
              cells={plan.roofs.filter(cell => cell.level <= level)}
              roomBounds={roomBounds}
              yOffset={3}
              editing={editing}
            />
          </>
        )}
      </group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(interactionPlot.minX + interactionPlot.maxX) / 2, level * LEVEL_HEIGHT + 0.015, (interactionPlot.minZ + interactionPlot.maxZ) / 2]}
        onPointerDown={event => {
          if (!editing || wallPlacementActive || event.button !== 0 || touchCount.current.size > 1) return;
          event.stopPropagation();
          const wallGesture = tool === "wall" || tool === "erase";
          const point = wallGesture ? snapWallVertex(event.point, level) : groundPoint(event);
          if (props.activeFurniture) {
            if (activePlacementType === "floor" || activePlacementType === "ceiling")
              props.onFurniturePlace?.(point, activePlacementType === "ceiling" ? { ceilingY: ceilingHeight } : undefined);
            return;
          }
          if (tool === "led") {
            setLedDrag({ start: point, end: point });
            (event.target as unknown as Element).setPointerCapture?.(event.pointerId);
            return;
          }
          const edge = nearestEdge(event.point, level);
          const demolish = tool === "erase" || (tool === "wall" && event.ctrlKey);
          pointer.current = { start: point, startCell: groundPoint(event), edge, pointerId: event.pointerId, demolish };
          if (demolish) beginPendingDemolish(edge, event.pointerId, point);
          setDrag({ start: point, end: point, edge, demolish });
          (event.target as unknown as Element).setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={event => {
          if (!editing) return;
          if (tool === "erase" || (tool === "wall" && (ctrlHeld || event.ctrlKey))) setDemolishPoint([event.point.x, level * LEVEL_HEIGHT + 0.07, event.point.z]);
          const wallGesture = tool === "wall" || tool === "erase";
          const point = wallGesture ? snapWallVertex(event.point, level) : groundPoint(event);
          if (props.activeFurniture) {
            furnitureDrop.current = activePlacementType === "floor" || activePlacementType === "ceiling"
              ? { point, placement: activePlacementType === "ceiling" ? { ceilingY: ceilingHeight } : undefined }
              : undefined;
          }
          if (tool === "led" && ledDrag) {
            const horizontal = Math.abs(point.x - ledDrag.start.x) >= Math.abs(point.z - ledDrag.start.z);
            setLedDrag({ start: ledDrag.start, end: horizontal ? { ...point, z: ledDrag.start.z } : { ...point, x: ledDrag.start.x } });
            return;
          }
          const edge = nearestEdge(event.point, level);
          if (demolishAnchor.current?.pointerId === event.pointerId && (event.buttons & 1)) {
            const anchor = demolishAnchor.current.edge;
            const target = { ...anchor, [anchor.orientation === "x" ? "x" : "z"]:
              Math.floor(anchor.orientation === "x" ? event.point.x : event.point.z) };
            demolishReleasePoint.current = { x: event.point.x, z: event.point.z, level: anchor.level };
            setDemolishDragPoint(demolishReleasePoint.current);
            updatePendingDemolish(target);
          }
          setHoverEdge(previous =>
            previous?.x === edge.x && previous?.z === edge.z && previous?.orientation === edge.orientation
              ? previous
              : edge
          );
          setHover(previous => (previous?.x === point.x && previous?.z === point.z ? previous : point));
          const vertex = snapWallVertex(event.point, level);
          setHoverVertex(previous => previous?.x === vertex.x && previous?.z === vertex.z ? previous : vertex);
          if (pointer.current) setDrag({ start: pointer.current.start, end: wallGesture ? orthogonalWallEnd(pointer.current.start, point) : point, edge: pointer.current.edge, demolish: pointer.current.demolish });
        }}
        onPointerUp={event => {
          if (!editing) return;
          event.stopPropagation();
          if (tool === "led" && ledDrag) {
            const current = ledDrag;
            setLedDrag(undefined);
            (event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
            props.onLedStripPlace?.(current.start, groundPoint(event), props.ledColor ?? "#00f0ff");
            return;
          }
          if (demolishAnchor.current?.pointerId === event.pointerId) {
            (event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
            commitPendingDemolish(event.pointerId);
            return;
          }
          if (!pointer.current) return;
          const gesture = pointer.current;
          pointer.current = null;
          const wallGesture = tool === "wall" || tool === "erase";
          const rawEnd = wallGesture ? snapWallVertex(event.point, level) : groundPoint(event);
          const end = wallGesture ? orthogonalWallEnd(gesture.start, rawEnd) : rawEnd;
          setDrag(undefined);
          (event.target as unknown as Element).releasePointerCapture?.(gesture.pointerId);
          if (gesture.demolish) {
            if (tool === "erase") {
              props.onGesture(gesture.startCell, groundPoint(event));
            }
            return;
          }
          if (tool === "wall" && wallEdgesBetweenVertices(gesture.start, end).length === 0) return;
          if (props.activeFurniture) return;
          if (props.tool === "select") {
            const cell = plan.floors.find(cell => cellKey(cell) === cellKey(end));
            if (cell) props.onSelect?.({ kind: "floor", id: cellKey(cell) });
          } else props.onGesture(props.mode === "buy" ? end : gesture.start, end, gesture.edge);
        }}
        onClick={event => {
          if (editing) return;
          event.stopPropagation();
          walkTo({ x: Math.floor(event.point.x), z: Math.floor(event.point.z), level });
        }}
        onContextMenu={event => {
          if (!editing) return;
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          if (demolishAnchor.current || suppressDemolishContextMenu.current) { clearPendingDemolish(); return; }
          if (props.activeFurniture) props.onFurnitureRotate?.(event.shiftKey ? -90 : 90);
        }}
      >
        <planeGeometry args={[interactionPlot.maxX - interactionPlot.minX, interactionPlot.maxZ - interactionPlot.minZ]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {editing && (
        <Grid
          position={[(interactionPlot.minX + interactionPlot.maxX) / 2, level * LEVEL_HEIGHT + 0.025, (interactionPlot.minZ + interactionPlot.maxZ) / 2]}
          args={[interactionPlot.maxX - interactionPlot.minX, interactionPlot.maxZ - interactionPlot.minZ]}
          cellSize={1}
          sectionSize={4}
          cellColor="#3e667c"
          sectionColor="#32c6d8"
          fadeDistance={55}
          infiniteGrid={false}
        />
      )}
      {demolishMode && demolishPoint && (
        <group position={demolishPoint} raycast={NOOP_RAYCAST}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <ringGeometry args={[0.38, 0.46, 32]} />
            <meshBasicMaterial color="#ffca49" transparent opacity={0.95} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <ringGeometry args={[0.045, 0.075, 16]} />
            <meshBasicMaterial color="#fff2ac" depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {drag && ["room", "floor", "ceiling", "roof", "paint"].includes(tool) && !curveGhost && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(drag.start.x + drag.end.x + 1) / 2, level * LEVEL_HEIGHT + 0.04, (drag.start.z + drag.end.z + 1) / 2]}
          raycast={NOOP_RAYCAST}
        >
          <planeGeometry args={[Math.abs(drag.end.x - drag.start.x) + 1, Math.abs(drag.end.z - drag.start.z) + 1]} />
          <meshBasicMaterial color="#9067ff" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      {editing && hoverVertex && !demolishMode && !ghost && !curveGhost && (
        <group position={[hoverVertex.x, level * LEVEL_HEIGHT, hoverVertex.z]}>
          <mesh position={[0, 0.27, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.035, 0.035, 0.54, 8]} />
            <meshBasicMaterial color={tool === "wall" ? "#42ffb8" : "#32e6f4"} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.035, 0]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.095, 12, 8]} />
            <meshBasicMaterial color={tool === "wall" ? "#42ffb8" : "#32e6f4"} depthWrite={false} />
          </mesh>
        </group>
      )}
      {drag && tool === "wall" && !drag.demolish && wallPreviewEdges.map(edge => (
        <group key={edgeKey({ ...edge, materialId: "" })}
          position={[edge.x + (edge.orientation === "x" ? 0.5 : 0), level * LEVEL_HEIGHT, edge.z + (edge.orientation === "z" ? 0.5 : 0)]}
          rotation={[0, edge.orientation === "z" ? Math.PI / 2 : 0, 0]}>
          <mesh position={[0, 0.04, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1, 0.04, 0.11]} />
            <meshBasicMaterial color="#42ffb8" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh position={[0, 1.4, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1, 2.8, 0.12]} />
            <meshBasicMaterial color="#42ffb8" transparent opacity={0.19} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {demolishPreviewEdges.map(edge => (
        <group key={`demolish:${edgeKey({ ...edge, materialId: "" })}`}
          position={[edge.x + (edge.orientation === "x" ? 0.5 : 0), edge.level * LEVEL_HEIGHT, edge.z + (edge.orientation === "z" ? 0.5 : 0)]}
          rotation={[0, edge.orientation === "z" ? Math.PI / 2 : 0, 0]}>
          <mesh position={[0, 1.4, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.005, 2.8, 0.19]} />
            <meshBasicMaterial color="#ffd34f" transparent opacity={0.42} depthWrite={false} />
          </mesh>
          {pendingDemolishEdges.length > 0 && <mesh position={[0, 0.025, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1.005, 0.035, 0.06]} />
            <meshBasicMaterial color="#fff1a8" depthTest={false} depthWrite={false} />
          </mesh>}
        </group>
      ))}
      {demolishMode && hoveredWall && !demolishDragPoint && !drag && <Html
        position={[hoveredWall.x + (hoveredWall.orientation === "x" ? 0.5 : 0), hoveredWall.level * LEVEL_HEIGHT + 2.9, hoveredWall.z + (hoveredWall.orientation === "z" ? 0.5 : 0)]}
        center style={{ pointerEvents: "none" }}>
        <span className="world-tooltip" style={{ color: "#ffd34f" }}>
          {hoveredWall.opening ? `${buildingItem(hoveredWall.opening.catalogId)?.name ?? "Cửa"} + tường 1m` : "Tường 1m"} · +{Math.floor((props.paid?.[`wall:${edgeKey(hoveredWall)}`] ?? 0) * REFUND_RATE) + Math.floor((props.paid?.[`opening:${edgeKey(hoveredWall)}`] ?? 0) * REFUND_RATE)} G khi lưu
        </span>
      </Html>}
      {pendingDemolishEdges.length > 0 && demolishDragPoint && <Html
        position={[demolishDragPoint.x, demolishDragPoint.level * LEVEL_HEIGHT + 2.95, demolishDragPoint.z]}
        center style={{ pointerEvents: "none" }}>
        <span className="world-tooltip" style={{ color: "#ffd34f" }}>
          Tháo dỡ {pendingDemolishEdges.length} đốt tường · Hoàn +{pendingDemolishRefund} GOLD khi lưu
        </span>
      </Html>}
      {demolishMode && hoveredFurnitureId && (() => {
        const item = plan.furniture.find(candidate => candidate.id === hoveredFurnitureId);
        const definition = item && FURNITURE.find(candidate => candidate.id === item.furnitureId);
        return item && definition ? <Html position={[item.x + 0.5, item.level * LEVEL_HEIGHT + 2, item.z + 0.5]} center style={{ pointerEvents: "none" }}>
          <span className="world-tooltip" style={{ color: "#ffd34f" }}>{definition.name} · +{Math.floor(definition.price * REFUND_RATE)} G khi bán</span>
        </Html> : null;
      })()}
      {editing && hoverEdge && ["door", "window", "paint"].includes(tool) && (
        <group
          position={[
            hoverEdge.x + (hoverEdge.orientation === "x" ? 0.5 : 0),
            level * LEVEL_HEIGHT + 0.08,
            hoverEdge.z + (hoverEdge.orientation === "z" ? 0.5 : 0),
          ]}
          rotation={[0, hoverEdge.orientation === "z" ? Math.PI / 2 : 0, 0]}
        >
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[1, 0.1, 0.1]} />
            <meshBasicMaterial color="#32e6f4" transparent opacity={0.8} />
          </mesh>
        </group>
      )}
      {drag && !drag.demolish && (
        <Html
          position={tool === "wall" || tool === "erase"
            ? [drag.end.x, level * LEVEL_HEIGHT + 2.95, drag.end.z]
            : [(drag.start.x + drag.end.x + 1) / 2, level * LEVEL_HEIGHT + 0.3, (drag.start.z + drag.end.z + 1) / 2]}
          center
          style={{ pointerEvents: "none" }}
        >
          <span className="world-tooltip">
            {tool === "wall" || tool === "erase"
              ? `${wallPreviewEdges.length}m${drag.demolish ? " · Tháo dỡ" : ` · ${dragQuote?.cost ?? 0} G`}`
              : curveGhost
              ? `R ${curveGhost.radius} m · ${curveGhost.angle}° · Cao ${curveGhost.height} m`
              : `${Math.abs(drag.end.x - drag.start.x) + 1} × ${Math.abs(drag.end.z - drag.start.z) + 1} ô`}
            {tool !== "wall" && tool !== "erase" && dragQuote ? ` · +${dragQuote.cost} Gold` : ""}
            {tool !== "wall" && tool !== "erase" && !props.materialId ? " · vật liệu cơ bản" : ""}
          </span>
        </Html>
      )}
      {refundFeedback && <group position={[refundFeedback.point.x, refundFeedback.point.level * LEVEL_HEIGHT + 0.08, refundFeedback.point.z]} raycast={NOOP_RAYCAST}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
          <ringGeometry args={[0.35, 0.53, 32]} />
          <meshBasicMaterial color="#ff9d36" transparent opacity={0.75} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, 2.67, 0]} center style={{ pointerEvents: "none" }}>
          <span className="world-tooltip" style={{ color: "#ff9d36" }}>+{refundFeedback.amount} G · khi lưu</span>
        </Html>
      </group>}
      {ghost && <BuyGhost item={ghost} valid={ghostValid} />}
      {curveGhost && <CurvedGlass curve={curveGhost} ghost />}
      {!editing && spawn && (
        <group position={[0, spawn.level * LEVEL_HEIGHT, 0]}>
          <Avatar
          key={JSON.stringify([plan.floors, plan.walls, plan.curves, plan.ledStrips, plan.furniture, level])}
            initialPosition={
              // Retain the live position across the Build Mode unmount.
              // eslint-disable-next-line react-hooks/refs
              avatar.current
            }
            initialRotation={showReferencePenthouse ? .12 : 0}
            controlRef={controlRef}
            path={path.plan === plan && path.level === level ? path.points : EMPTY_PATH}
            pose={path.plan === plan && path.level === level ? pose : undefined}
            onPosition={point => {
              avatar.current = point;
            }}
            onArrive={() => {
              const next = pending.current;
              pending.current = undefined;
              if (!next || editing || next.plan !== plan || next.level !== level) return;
              completeFurnitureArrival(next.arrival, avatar.current, true, {
                onInteract: screen => {
                  if (!next.arrival.action.activity) props.onInteract(screen);
                },
                onToggle: id => setLightOverride({ furniture: plan.furniture, values: toggleFurnitureActive(activeInstances, id) }),
                onPose: arrivalPose => {
                  const furniture = plan.furniture.find(candidate => candidate.id === next.arrival.instanceId);
                  if (!furniture) { setPose(arrivalPose); return; }
                    const shape = bodyShape(props.character?.appearance?.body, props.character?.appearance?.presentation);
                    const options = { heightScale: (props.character?.appearance?.height ?? 1) * shape.height, bodyDepthScale: shape.depth };
                    const anchors = buildingFurnitureInteractionAnchors(furniture, next.arrival.destination, options);
                    if (!anchors) return;
                    let nextPose: AvatarPose = { ...anchors.pose, exit: anchors.exit };
                    if (arrivalPose.activity === "working") {
                      const cells = furnitureFootprint(furniture);
                      const center = { x: cells.reduce((sum, cell) => sum + cell.x + .5, 0) / cells.length, z: cells.reduce((sum, cell) => sum + cell.z + .5, 0) / cells.length };
                      const chair = plan.furniture
                        .filter(candidate => candidate.level === level && resolveFurnitureInteraction(candidate.furnitureId)?.activity === "sitting")
                        .map(candidate => buildingFurnitureInteractionAnchors(candidate, next.arrival.destination, options))
                        .filter(candidate => candidate && Math.hypot(candidate.pose.x - center.x, candidate.pose.z - center.z) < 2.3)
                        .sort((a, b) => Math.hypot(a!.pose.x - center.x, a!.pose.z - center.z) - Math.hypot(b!.pose.x - center.x, b!.pose.z - center.z))[0];
                      if (chair) nextPose = { ...chair.pose, activity: "working", exit: chair.exit, rotation: Math.atan2(center.x - chair.pose.x, center.z - chair.pose.z) };
                    }
                    seatedPose.current = nextPose;
                    releaseLiveControl();
                    if (weaponTransitionTimer.current) clearTimeout(weaponTransitionTimer.current);
                    weaponTransition.current = undefined;
                    setWeaponDrawn(false);
                    setPose(nextPose);
                },
              });
            }}
            onPoseExit={() => {
              seatedPose.current = undefined;
              setPose(undefined);
              setPath({ plan, level, points: EMPTY_PATH });
              movement.current = createLiveMovementState(avatar.current, pose?.rotation ?? 0);
              controlRef.current = movement.current;
            }}
            {...props.character}
            cosmetics={props.cosmetics ?? props.character?.cosmetics}
            equipment={props.equipment}
            weaponId={props.weaponId}
            weaponDrawn={weaponDrawn}
            referenceLook={showReferencePenthouse && !!props.character && usesReferenceCharacterLook(props.character, props.cosmetics)}
          />
        </group>
      )}
      {!editing && petSpawn && props.activePet && (
        <group
          position={[petSpawn.x + 0.5, petSpawn.level * LEVEL_HEIGHT, petSpawn.z + 0.5]}
          rotation={[0, 0.35, 0]}
          onClick={event => {
            event.stopPropagation();
            props.onInteract("pets");
          }}
        >
          <PetModel id={props.activePet.id} accessoryColor={props.activePet.accessoryColor} />
        </group>
      )}
      {!spawn && props.mode === "live" && (
        <Html center position={[0, 1, 0]}>
          <span className="world-tooltip">Thêm sàn và một lối đi trống để nhân vật bước vào nhà.</span>
        </Html>
      )}
      <Fps onFps={props.onFps} />
    </>
  );
}

class ConstructionBoundary extends Component<
  { children: ReactNode; onNotice?: ConstructionWorldProps["onNotice"] },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onNotice?.("WebGL chưa khả dụng. Nhiệm vụ và dữ liệu vẫn được bảo toàn.");
  }
  render() {
    return this.state.failed ? (
      <div className="world-fallback">
        <h2>Không thể khởi tạo 3D</h2>
        <p>Thử tải lại hoặc bật tăng tốc đồ họa trong trình duyệt. Dữ liệu công trình vẫn được lưu trên máy chủ.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function LiveActionBar({ controller, enabled, context }: { controller: LiveInputController; enabled: boolean; context: LiveActionContext }) {
  if (!enabled) return null;
  const actions: { id: LiveAction; label: string; shortcut: string }[] = context.standing ? [
    { id: "weapon", label: context.weaponDrawn ? "Cất kiếm" : "Rút kiếm", shortcut: "X" },
    { id: "jump", label: "Nhảy", shortcut: "Space" },
    ...(context.nearest ? [{ id: "interact" as const, label: context.nearest.label, shortcut: "E" }] : []),
  ] : [{ id: "stand" as const, label: "Đứng dậy", shortcut: "E" }];
  return <div className="construction-live-actions" role="group" aria-label="Hành động nhân vật">
    {actions.map(action => <button key={action.id} type="button" className="construction-live-action" aria-label={`${action.label} (${action.shortcut})`} aria-keyshortcuts={action.shortcut} onClick={() => controller.triggerAction(action.id)}>
      <span>{action.label}</span><kbd>{action.shortcut}</kbd>
    </button>)}
  </div>;
}

export default function ConstructionWorld(props: ConstructionWorldProps) {
  const [liveInput] = useState(() => createLiveInputController());
  const [actionContext, setActionContext] = useState<LiveActionContext>({ weaponDrawn: false, standing: true });
  return (
    <ConstructionBoundary onNotice={props.onNotice}>
      <div className="construction-live-world" onContextMenuCapture={event => {
        if (props.mode === "live" || !props.activeFurniture) return;
        event.preventDefault();
        event.stopPropagation();
        props.onFurnitureRotate?.(event.shiftKey ? -90 : 90);
      }}>
        <Canvas
          onCreated={({ gl }) => { if (props.transparentBackground) gl.setClearAlpha(0); props.onReady?.(); }}
          shadows={props.quality !== "performance"}
          dpr={props.quality === "performance" ? 1 : props.quality === "ultra" ? [1, 2] : [1, 1.5]}
          gl={{
            alpha: props.transparentBackground ?? false,
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1.14,
            localClippingEnabled: true,
          }}
          // R3F keeps the fallback node mounted (and hidden) after the canvas
          // recovers. Mark it presentation-only so accessibility trees do not
          // report a stale "Không thể khởi tạo 3D" while the live canvas is
          // rendering normally.
          fallback={<div aria-hidden="true" className="world-fallback"><h2>Không thể khởi tạo 3D</h2><p>Trình duyệt chưa cấp WebGL cho khung cảnh này. Hãy bật tăng tốc đồ họa rồi tải lại.</p></div>}
        >
          <Suspense fallback={null}>
            <WebGLContextMonitor onLost={props.onContextLost} />
            <ApartmentEnvironment />
            <WorldScene key={`${props.mode}:${props.floorLevel}`} {...props} liveInput={liveInput} onActionContext={setActionContext} />
            {props.quality !== "performance" && !props.transparentBackground && <ApartmentEffects quality={props.quality} />}
          </Suspense>
        </Canvas>
        <LiveActionBar controller={liveInput} enabled={props.mode === "live"} context={actionContext} />
      </div>
    </ConstructionBoundary>
  );
}



