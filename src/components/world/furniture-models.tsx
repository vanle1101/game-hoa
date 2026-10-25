"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, LatheGeometry, ExtrudeGeometry, Shape, Vector2, Euler, Matrix4, DataTexture, EquirectangularReflectionMapping, RGBAFormat, SRGBColorSpace, DoubleSide, FrontSide, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { getFurnitureDefinition, type FurnitureDefinition, type FurnitureInteraction, type FurnitureMaterial, type FurniturePart } from "../../furniture/catalog";
import { heroAssetForKind, type ApartmentHeroAssetId } from "./apartment-assets";
import { ApartmentAssetModel } from "../apartment-v21";
import { FurnitureGLBModel } from "./FurnitureGLBModel";
import { LedStripItem } from "./LedStripItem";
import { WallInsertItem } from "./WallInsertItem";
import { createV12SurfaceTexture, getV12FurnitureRecipe, getV12FixtureRecipe, getV12SurfaceProperties, type V12FixtureId, type V12FurniturePart, type V12Surface } from "./v12-furniture";

export type FurnitureModelProps = {
  kind: string;
  ghost?: boolean;
  active?: boolean;
  neonColor?: string;
  lightDimmer?: number;
  onInteract?: (interaction: FurnitureInteraction, furniture: FurnitureDefinition) => void;
};

export function HeroAssetModel({ id, ghost = false, active = true, onInteract }: { id: ApartmentHeroAssetId; ghost?: boolean; active?: boolean; onInteract?: (interaction: FurnitureInteraction, furniture: FurnitureDefinition) => void }) {
  const definition = getFurnitureDefinition(id);
  const interaction = definition?.interactions[0];
  const handleClick = !ghost && onInteract && interaction && definition ? (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onInteract(interaction, definition); } : undefined;
  return <group name={`hero-asset:${id}`} onClick={handleClick} userData={{ assetId: id, furnitureId: id }}>
    <ApartmentAssetModel assetId={id} ghost={ghost} active={active}/>
  </group>;
}

function materialColor(material: FurnitureMaterial, finish: string): string {
  const palette: Record<FurnitureMaterial, string> = {
    finish, wood: "#987451", metal: "#95a5b4", fabric: finish, cushion: "#bdc8cd",
    glass: "#a4d5df", screen: "#245c6c", glow: finish, leaf: "#52a581", gold: "#dfb666", dark: "#23313f", paper: "#e6dfd1",
  };
  return palette[material];
}

export function createFurniturePartGeometry(part: V12FurniturePart): BufferGeometry {
  const [width, height, depth] = part.size;
  const segments = part.radialSegments ?? 24;
  const lathe = (points: number[][]) => new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments).scale(width, height, depth);
  let geometry: BufferGeometry;
  if (part.shape === "box") {
    geometry = part.roundness
      ? new RoundedBoxGeometry(width, height, depth, part.contour ? 4 : 1, Math.min(width, height, depth) * Math.min(.49, Math.max(0, part.roundness)))
      : new BoxGeometry(width, height, depth);
  } else if (part.shape === "arch") {
    const shape = new Shape();
    shape.moveTo(-.5, -.5); shape.lineTo(.5, -.5); shape.lineTo(.5, .25);
    shape.absellipse(0, .25, .5, .25, 0, Math.PI, false, 0); shape.lineTo(-.5, -.5);
    geometry = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 16 }).translate(0, 0, -.5).scale(width, height, depth);
  } else if (part.shape === "cup") {
    geometry = lathe([[0, -.5], [.16, -.5], [.22, -.3], [.34, 0], [.44, .3], [.5, .5], [.44, .5], [.38, .3], [.28, 0], [.16, -.3], [0, -.34]]);
  } else if (part.shape === "ring") {
    geometry = lathe([[.44, -.5], [.5, -.5], [.5, .5], [.44, .5], [.44, -.5]]);
  } else if (part.shape === "frustum") {
    geometry = lathe([[.5, -.5], [.3, .5], [.275, .5], [.475, -.5], [.5, -.5]]);
  } else if (part.shape === "crystal") {
    const indexed = new LatheGeometry([new Vector2(0, -.5), new Vector2(.5, -.2), new Vector2(.5, .17), new Vector2(0, .5)], 6);
    geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals(); geometry.scale(width, height, depth);
  } else {
    geometry = part.shape === "cylinder" ? new CylinderGeometry(.5, .5, 1, part.radialSegments ?? 16)
      : part.shape === "cone" ? new ConeGeometry(.5, 1, part.radialSegments ?? 12)
        : new SphereGeometry(.5, 16, 12);
    geometry.scale(width, height, depth);
  }
  if (part.contour) {
    const vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i) / width, y = vertices.getY(i) / height, z = vertices.getZ(i) / depth;
      if (part.contour === "drape") {
        const envelope = Math.max(0, 1 - 4 * x * x) * Math.max(0, 1 - 4 * z * z);
        vertices.setY(i, vertices.getY(i) - Math.abs(Math.sin(x * 33 + z * 7) * Math.sin(z * 19 + .7)) * height * .13 * envelope * Math.max(0, y));
      } else if (part.contour === "leaf") {
        vertices.setY(i, vertices.getY(i) + Math.sin(x * Math.PI * 2) * height * .3);
        vertices.setZ(i, vertices.getZ(i) * (.65 + .35 * Math.cos(x * Math.PI)));
      }
    }
    geometry.computeVertexNormals();
  }
  if (part.lean) {
    const vertices = geometry.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const slope = vertices.getY(i) / height;
      vertices.setX(i, vertices.getX(i) + slope * part.lean[0]);
      vertices.setZ(i, vertices.getZ(i) + slope * part.lean[1]);
    }
    geometry.computeVertexNormals();
  }
  if (part.rotation) geometry.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...part.rotation)));
  return geometry;
}

export function getFurnitureMaterialProperties(part: FurniturePart, color: string, ghost = false, active = true, neonColor = "#00f0ff") {
  const luminous = part.material === "glow" || part.material === "screen";
  const glass = part.material === "glass" && part.surface !== "smoked-glass";
  const metallic = part.material === "metal" || part.material === "gold";
  const mirror = part.surface === "mirror";
  const smoked = part.surface === "smoked-glass";
  const display = part.surface === "display";
  const tint = ghost ? "#66b8c5" : mirror ? "#ecf5ff" : smoked ? "#243b48" : materialColor(part.material, color);
  const textile = part.material === "fabric" || part.material === "cushion";
  return {
    color: tint, metalness: mirror ? 1 : smoked ? .35 : metallic ? .75 : glass ? .2 : textile ? 0 : .08,
    roughness: mirror ? .045 : smoked ? .09 : metallic ? .3 : glass ? .12 : textile ? .9 : .72,
    transparent: ghost || glass, opacity: ghost ? .38 : glass ? .22 : 1, depthWrite: !ghost && !glass,
    emissive: !ghost && active && (luminous || display) ? neonColor : "#000000",
    emissiveIntensity: !ghost && active ? display ? .7 : luminous ? 1.25 : 0 : 0,
    side: part.shape === "frustum" ? DoubleSide : FrontSide,
  };
}

function createMirrorEnvironment() {
  const width = 64, height = 32;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const panel = (x > 8 && x < 16 || x > 38 && x < 43) && y > 5 && y < 26;
    const brightness = panel ? 245 : y < 16 ? 125 + y * 3 : 75;
    const offset = (y * width + x) * 4;
    pixels.set([brightness, Math.min(255, brightness + 12), Math.min(255, brightness + 25), 255], offset);
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.mapping = EquirectangularReflectionMapping; texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

function Part({ part, color, ghost, active, neonColor, textures }: { part: V12FurniturePart; color: string; ghost: boolean; active: boolean; neonColor: string; textures: Partial<Record<V12Surface, DataTexture>> }) {
  const geometry = useMemo(() => createFurniturePartGeometry(part), [part]);
  const environment = useMemo(() => part.surface === "mirror" ? createMirrorEnvironment() : undefined, [part.surface]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => environment?.dispose(), [environment]);
  const material = getFurnitureMaterialProperties(part, color, ghost, active, neonColor);
  return <mesh name={part.id} position={[...part.position]} geometry={geometry} castShadow={!ghost && !material.transparent} receiveShadow={!ghost} raycast={ghost ? () => undefined : undefined}>
    <meshStandardMaterial {...material} {...getV12SurfaceProperties(part, ghost)} bumpMap={!ghost && part.finish ? textures[part.finish] : undefined} envMap={environment} envMapIntensity={part.surface === "mirror" ? 1.4 : 1} />
  </mesh>;
}

function useFurnitureSurfaces(parts: readonly V12FurniturePart[] | undefined) {
  const textures = useMemo(() => {
    const result: Partial<Record<V12Surface, DataTexture>> = {};
    for (const part of parts ?? []) if (part.finish && !result[part.finish]) result[part.finish] = createV12SurfaceTexture(part.finish);
    return result;
  }, [parts]);
  useEffect(() => () => Object.values(textures).forEach(texture => texture.dispose()), [textures]);
  return textures;
}

export function FurnitureModel({ kind, ghost = false, active = true, neonColor, lightDimmer = 3, onInteract }: FurnitureModelProps) {
  const hero = heroAssetForKind(kind);
  const definition = getFurnitureDefinition(kind);
  const recipe = useMemo(() => getV12FurnitureRecipe(kind), [kind]);
  const textures = useFurnitureSurfaces(kind === "workstation" ? undefined : recipe?.parts);
  if (definition?.placementType === "wall_insert") return <group name={`furniture:${definition.id}`} userData={{ furnitureId: definition.id, wallInsert: true }}>
    <WallInsertItem kind={definition.category === "doors" ? "doors" : "windows"} width={definition.width} height={definition.height} color={definition.color} ghost={ghost} />
  </group>;
  if (kind === "wall_led_strip" && definition) {
    const interaction = definition.interactions[0];
    const handleClick = !ghost && onInteract && interaction ? (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onInteract(interaction, definition);
    } : undefined;
    return <group name={`furniture:${definition.id}`} onClick={handleClick} userData={{ furnitureId: definition.id, procedural: true }}>
      <LedStripItem width={definition.width} height={definition.height} depth={definition.depth} ghost={ghost} active={active} lightDimmer={lightDimmer} neonColor={neonColor ?? definition.neonColor} />
    </group>;
  }
  if (definition?.modelUrl) {
    const interaction = definition.interactions[0];
    const handleClick = !ghost && onInteract && interaction ? (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onInteract(interaction, definition);
    } : undefined;
    return <group name={`furniture:${definition.id}`} onClick={handleClick} userData={{ furnitureId: definition.id, modelUrl: definition.modelUrl }}>
      <FurnitureGLBModel url={definition.modelUrl} width={definition.width} depth={definition.depth} height={definition.height} ghost={ghost} active={active} lightDimmer={lightDimmer} neonColor={neonColor ?? definition.neonColor}/>
    </group>;
  }
  if (hero) return <HeroAssetModel id={hero} ghost={ghost} active={active} onInteract={onInteract}/>;
  if (!definition || !recipe) return null;
  const interaction = definition.interactions[0];
  const handleClick = !ghost && onInteract && interaction ? (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onInteract(interaction, definition);
  } : undefined;
  return <group name={`furniture:${definition.id}`} onClick={handleClick} userData={{ furnitureId: definition.id, interaction: interaction?.id }}>
    {recipe.parts.map(part => <Part key={part.id} part={part} color={definition.color} ghost={ghost} active={active} neonColor={neonColor ?? definition.neonColor} textures={textures} />)}
  </group>;
}

export function V12FixtureModel({ kind, ghost = false, active = true }: { kind: V12FixtureId; ghost?: boolean; active?: boolean }) {
  const recipe = useMemo(() => getV12FixtureRecipe(kind), [kind]);
  const textures = useFurnitureSurfaces(recipe?.parts);
  if (!recipe) return null;
  return <group name={`fixture:${kind}`} userData={{ fixtureId: kind }}>
    {recipe.parts.map(part => <Part key={part.id} part={part} color="#c8c3b8" ghost={ghost} active={active} neonColor="#00f0ff" textures={textures} />)}
  </group>;
}

export { FurnitureModel as ProceduralFurniture };

export { getFurnitureRecipe, getFurniturePartBounds, furnitureGeometrySignature } from "../../furniture/catalog";
export type { FurniturePart, FurnitureRecipe } from "../../furniture/catalog";
