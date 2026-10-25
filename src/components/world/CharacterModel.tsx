"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { bodyShape, faceShape, hairCapMeshData, hairStrandMeshData, HAIR_STYLES, headMeshData, noseMeshData, taperMeshData, type BodyShape, type CharacterPresentation, type SculptedMeshData } from "./character-shape";
import { hairCoverage, shellMeshData, silhouetteWidth, wearableShape, type GarmentSection, type WearableAnchor, type WearablePart } from "./wearable-shapes";
import { BROW_SHAPES, EAR_SHAPES, EYE_SHAPES, MOUTH_SHAPES, NOSE_SHAPES, browPoints, earMesh, eyeContourPoints, eyeMesh, facialPreset, facialRibbonMesh, mouthPoints, type FacialMesh } from "./facial-shape";
import WeaponModel from "./WeaponModel";
import { COSMETICS } from "@/character/catalog";
import { getEquipmentDefinition, type EquipmentAnchor, type EquipmentDefinition } from "@/equipment/catalog";
import { EquipmentModel } from "./equipment-models";

export type CharacterAnimation = "idle" | "walk" | "run" | "jump" | "fall" | "land" | "attack" | "heavy" | "dodge" | "block" | "victory" | "sitting" | "working" | "working-standing" | "studying" | "exhausted" | "draw" | "sheath" | "sit-down" | "stand-up" | "lie-down" | "lying" | "get-up";
export type ModelAppearance = { body?: string; presentation?: CharacterPresentation; face?: number | string; eyes?: number | string; eyeColor?: string; iris?: string; eyebrows?: string; brows?: number; nose?: number | string; ears?: number | string; mouth?: number | string; hairstyle?: string; height?: number; shoulderWidth?: number; facePreset?: number; eyePreset?: number; browPreset?: number; nosePreset?: number; earPreset?: number; mouthPreset?: number; hairPreset?: number; beard?: boolean; tattoo?: boolean; tattoos?: boolean; piercing?: boolean; piercings?: boolean; cyberware?: boolean };
export type ModelCharacter = { skin?: string; outfit?: string; hair?: string; hairstyle?: string; appearance?: ModelAppearance; cosmetics?: Partial<Record<string, string>> };
type Vec = [number, number, number];
type WearableColors = { primary: string; secondary: string; trim: string; glow: string; dark: string };

function toBufferGeometry(data: SculptedMeshData): THREE.BufferGeometry {
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  mesh.setIndex(data.indices);
  mesh.computeVertexNormals();
  return mesh;
}

function toSculptedGeometry(data: SculptedMeshData): THREE.BufferGeometry {
  const geometry = toBufferGeometry(data);
  const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
  const seams = new Map<string, number[]>();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(value => Math.round(value * 1e6)).join(",");
    const vertices = seams.get(key) ?? [];
    vertices.push(i);
    seams.set(key, vertices);
  }
  for (const vertices of seams.values()) {
    if (vertices.length < 2) continue;
    const normal = new THREE.Vector3();
    vertices.forEach(i => normal.add(new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i))));
    normal.normalize();
    vertices.forEach(i => normals.setXYZ(i, normal.x, normal.y, normal.z));
  }
  return geometry;
}

const SPHERE = new THREE.SphereGeometry(1, 24, 18);
const ROUND = new RoundedBoxGeometry(1, 1, 1, 2, .16);
const HAIR_LOCK = toSculptedGeometry(hairStrandMeshData());



function referencePonytailMeshData(): SculptedMeshData {
  // A single continuous swept volume reads as tied hair from the apartment
  // camera. Separate scaled locks used to look like five rigid spikes.
  const positions: number[] = [], indices: number[] = [];
  const rings: readonly [number, number, number, number, number][] = [
    [0, .103, -.154, .040, .032],
    [.006, .072, -.188, .044, .035],
    [.012, .018, -.223, .048, .040],
    [.019, -.048, -.239, .044, .040],
    [.018, -.112, -.242, .035, .034],
    [.011, -.175, -.231, .026, .026],
    [0, -.221, -.212, .010, .012],
    [-.006, -.24, -.201, .001, .002],
  ];
  const segments = 18;
  rings.forEach(([cx, cy, cz, rx, rz], row) => {
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const twist = row * .19 + Math.sin(angle * 5 + row * .45) * .014;
      positions.push(cx + Math.sin(angle + twist) * rx, cy, cz + Math.cos(angle + twist) * rz);
      if (row < rings.length - 1 && segment < segments) {
        const a = row * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  return { positions, indices };
}

const REFERENCE_PONYTAIL = toSculptedGeometry(referencePonytailMeshData());

function Part({ at = [0, 0, 0], size, color, round = false, rotation = [0, 0, 0], metal = 0, glow = false }: { at?: Vec; size: Vec; color: string; round?: boolean; rotation?: Vec; metal?: number; glow?: boolean }) {
  return <mesh position={at} scale={size} rotation={rotation} geometry={round ? ROUND : SPHERE} dispose={null} castShadow receiveShadow><meshStandardMaterial color={color} roughness={metal ? .36 : .68} metalness={metal} emissive={glow ? color : "#000000"} emissiveIntensity={glow ? .72 : 0} /></mesh>;
}

function Taper({ at = [0, 0, 0], top, bottom, length, color, depth = 1, rotation = [0, 0, 0] }: { at?: Vec; top: number; bottom: number; length: number; color: string; depth?: number; rotation?: Vec }) {
  const geometry = useMemo(() => toBufferGeometry(taperMeshData(top, bottom, length, depth)), [top, bottom, length, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={at} rotation={rotation} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.74} /></mesh>;
}

function Shell({ sections, opening = 0, body, color }: { sections: readonly GarmentSection[]; opening?: number; body: BodyShape; color: string }) {
  const geometry = useMemo(() => toBufferGeometry(shellMeshData(sections, opening, body)), [sections, opening, body]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={.72} /></mesh>;
}

function referenceTopMeshData(body: BodyShape): SculptedMeshData {
  // The reference has a shallow front neckline and a deep exposed back, so a
  // uniform shell would hide the defining silhouette. Each angular section has
  // its own upper hem while the lower hem remains continuous above the waist.
  const positions: number[] = [], indices: number[] = [], segments = 48, rows = 5;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const front = Math.max(0, Math.cos(angle));
      const back = Math.max(0, -Math.cos(angle));
      const side = Math.abs(Math.sin(angle));
      const top = 1.29 + front * .125 + side * .125 - back * .018;
      const y = 1.225 + (top - 1.225) * t;
      const width = (.175 + t * .037) * silhouetteWidth(y, body);
      const depth = .112 + t * .016;
      positions.push(Math.sin(angle) * width, y, Math.cos(angle) * depth);
      if (row < rows && segment < segments) {
        const a = row * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  return { positions, indices };
}

function ReferenceCropTop({ body }: { body: BodyShape }) {
  const geometry = useMemo(() => toSculptedGeometry(referenceTopMeshData(body)), [body]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="reference-open-back-crop-top">
    <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#111219" roughness={.79} side={THREE.DoubleSide} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <Part at={[side * .15, 1.453, .012]} size={[.022, .093, .018]} color="#111219" round rotation={[.46, 0, side * -.13]} />
      <Part at={[side * .116, 1.354, -.085]} size={[.012, .126, .01]} color="#111219" round rotation={[-.48, 0, side * .23]} />
      <Part at={[side * .123, 1.24, -.074]} size={[.006, .024, .006]} color="#3a3b41" round />
    </group>)}
    <Part at={[0, 1.228, -.102]} size={[.242, .012, .011]} color="#23242b" round />
  </group>;
}

function ReferenceCargoWaist({ body }: { body: BodyShape }) {
  const sections: readonly GarmentSection[] = [
    { y: .92, width: .182, depth: .118 },
    { y: .97, width: .181, depth: .116 },
    { y: 1.02, width: .169, depth: .105 },
  ];
  return <group name="reference-cargo-waist">
    <Shell sections={sections} body={body} color="#20222a" />
    <Part at={[0, 1.018, .006]} size={[.334, .038, .214]} color="#171921" round />
    <Part at={[0, 1.027, .112]} size={[.027, .026, .009]} color="#53555e" round metal={.55} />
    {[-1, 1].map(side => <Part key={side} at={[side * .13, .974, -.07]} size={[.008, .054, .008]} color="#464650" round />)}
  </group>;
}

function ReferenceCargoThigh({ side }: { side: number }) {
  return <group name="reference-baggy-cargo-thigh">
    <Taper at={[0, -.196, 0]} top={.133} bottom={.117} length={.402} color="#20222b" />
    <Part at={[side * .109, -.192, .011]} size={[.057, .145, .122]} color="#171922" round />
    <Part at={[side * .116, -.119, .017]} size={[.061, .024, .126]} color="#2e3038" round />
    <Part at={[side * .069, -.256, .088]} size={[.009, .158, .008]} color="#30313a" round rotation={[.03, 0, side * -.1]} />
    <Part at={[0, -.37, .083]} size={[.092, .014, .009]} color="#2d2f38" round rotation={[.1, 0, side * .06]} />
  </group>;
}

function ReferenceCargoShin() {
  return <group name="reference-baggy-cargo-shin">
    <Taper at={[0, -.205, 0]} top={.116} bottom={.083} length={.414} color="#20222b" />
    <Part at={[0, -.39, .05]} size={[.102, .022, .11]} color="#1a1c25" round />
    <Part at={[0, -.413, 0]} size={[.164, .044, .159]} color="#171920" round />
    <Part at={[.035, -.213, .09]} size={[.006, .17, .006]} color="#30313a" round rotation={[0, 0, -.07]} />
  </group>;
}

function ReferenceSneaker() {
  return <group name="reference-white-sneaker" position={[0, -.489, .043]}>
    <Part at={[0, -.023, .023]} size={[.166, .04, .318]} color="#e9e5de" round />
    <Part at={[0, .014, .027]} size={[.153, .077, .277]} color="#cac8c6" round />
    <Part at={[0, .041, -.038]} size={[.139, .07, .116]} color="#ddd9d3" round />
    <Part at={[0, -.036, .102]} size={[.112, .012, .13]} color="#f7f2e9" round />
    {[-1, 1].map(side => <group key={side}>
      <Part at={[side * .073, .023, .065]} size={[.009, .035, .093]} color="#777b81" round rotation={[0, side * .13, 0]} />
      <Part at={[side * .065, -.01, -.058]} size={[.008, .024, .076]} color="#a8abb0" round />
    </group>)}
    {[0, 1, 2, 3].map(index => <Part key={index} at={[0, .056, -.013 + index * .027]} size={[.078, .006, .009]} color="#faf5ed" round />)}
  </group>;
}

function WearableMesh({ spec, colors, body }: { spec: WearablePart; colors: WearableColors; body: BodyShape }) {
  const color = colors[spec.colorRole], glow = spec.colorRole === "glow";
  if (spec.kind === "shell") return <Shell sections={spec.sections!} opening={spec.opening} body={body} color={color} />;
  const bodyWidth = spec.anchor === "torso" ? silhouetteWidth(spec.at[1], body) : 1;
  const limb = spec.anchor.endsWith("Arm") || spec.anchor.endsWith("Thigh") ? body.limb : 1;
  const at: Vec = [spec.at[0] * bodyWidth, spec.at[1], spec.at[2]];
  const size: Vec = [spec.size[0] * bodyWidth * limb, spec.size[1], spec.size[2] * limb];
  if (spec.kind === "taper") return <Taper at={at} top={size[0]} bottom={size[2]} length={size[1]} color={color} rotation={spec.rotation} />;
  if (spec.kind === "ring") return <mesh position={at} scale={size} rotation={spec.rotation ?? [0, 0, 0]} castShadow><torusGeometry args={[1, .14, 10, 32]} /><meshStandardMaterial color={color} metalness={spec.metal ?? 0} roughness={.35} /></mesh>;
  return <Part at={at} size={size} color={color} round={spec.kind === "box"} rotation={spec.rotation} metal={spec.metal} glow={glow} />;
}

function techwearPalette(baseHex: string, layer?: string): WearableColors {
  const base = new THREE.Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const toned = base.clone();
  if ((layer === "top" || layer === "outerwear") && hsl.s > .55 && hsl.l > .46) {
    toned.setHSL(hsl.h, Math.min(.52, hsl.s * .68), Math.min(.44, hsl.l * .74));
  }
  const secondary = toned.clone().lerp(new THREE.Color("#182232"), .62);
  const trim = toned.clone().lerp(new THREE.Color("#b6c6d4"), .72);
  return {
    primary: `#${toned.getHexString()}`,
    secondary: `#${secondary.getHexString()}`,
    trim: `#${trim.getHexString()}`,
    glow: baseHex,
    dark: "#111821",
  };
}

type WornPiece = { model: string; color: string };
function Wearables({ pieces, anchor, body }: { pieces: readonly WornPiece[]; anchor: WearableAnchor; body: BodyShape }) {
  return <group name={`wearables-${anchor}`}>{pieces.map((piece, pieceIndex) => {
    const shape = wearableShape(piece.model);
    const colors = techwearPalette(piece.color, shape?.layer);
    return shape?.parts.map((spec, index) => spec.anchor === anchor ? <WearableMesh key={`${pieceIndex}-${index}`} spec={spec} colors={colors} body={body} /> : null);
  })}</group>;
}

function Hair({ style, color, headwearModel, shape, referencePonytail = false }: { style: string; color: string; headwearModel?: string; shape: ReturnType<typeof faceShape>; referencePonytail?: boolean }) {
  const coverage = hairCoverage(style, headwearModel);
  const index = Math.max(0, HAIR_STYLES.indexOf(style)), long = index === 8 || index === 9, buzz = index === 11, mohawk = index === 2, undercut = index === 3;
  const capGeometry = useMemo(() => toSculptedGeometry(hairCapMeshData(coverage.crownScale, undercut, 32, shape, buzz)), [coverage.crownScale, undercut, shape, buzz]);
  useEffect(() => () => capGeometry.dispose(), [capGeometry]);
  const fringeCount = mohawk ? 5 : 9;
  const crownCount = mohawk ? 8 : 18;
  const partDirection = index === 1 || index === 5 ? 1 : index === 6 ? 0 : -1;
  return <group>
    <mesh geometry={capGeometry} position={[0, coverage.covered ? -.008 : .004, 0]} scale={[1, buzz ? .86 : 1, 1]} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.58} /></mesh>
    <Part at={[0, .016, -.084]} size={[.106, long ? .185 : .082, .054]} color={color} />
    {coverage.keepSideLengths && !buzz && !mohawk && [-1, 1].map(side => (
      <mesh key={`temple-${side}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[side * .108, .022, .036]} scale={[.016, undercut ? .042 : .068, .026]} rotation={[.22, side * .35, side * -.12]}><meshStandardMaterial color={color} roughness={.58} /></mesh>
    ))}
    {referencePonytail && Array.from({ length: 9 }, (_, index) => {
      const u = index / 8 * 2 - 1;
      return <mesh key={`reference-fringe-${index}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[u * .084, .063 + (1 - u * u) * .01, .09]} scale={[.01, .062 + (index % 3) * .008, .013]} rotation={[-.21, u * .09, -.21 + u * .11]}><meshStandardMaterial color={color} roughness={.57} /></mesh>;
    })}
    {!buzz && coverage.showLocks && !referencePonytail && Array.from({ length: fringeCount }, (_, i) => {
      const t = (i / (fringeCount - 1)) * 2 - 1;
      const sweep = index === 6 ? -.38 : index === 1 ? .58 : index === 5 ? (t < -.15 ? -.5 : .52) : .28 * partDirection + t * .16;
      const x = mohawk ? t * .018 : t * .086;
      const y = index === 6 ? .104 - Math.abs(t) * .012 : .079 + (1 - t * t) * .014 + (mohawk ? .035 : 0);
      const z = index === 6 ? .082 : .094 + (1 - t * t) * .01;
      const length = index === 6 ? .074 : index === 7 ? .07 : .102 - Math.abs(t) * .021 + (i % 3 === 1 ? .008 : 0);
      return <mesh key={`fringe-${i}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[x, y, z]} scale={[index === 7 ? .027 : .026, length, .029]} rotation={[index === 6 ? -.72 : -.12, t * .28, sweep]}><meshStandardMaterial color={color} roughness={.48} /></mesh>;
    })}
    {!buzz && coverage.showLocks && !referencePonytail && Array.from({ length: crownCount }, (_, i) => {
      const column = i % 6, row = Math.floor(i / 6), t = column / 5 * 2 - 1;
      const x = mohawk ? 0 : t * (undercut ? .074 : .091);
      const z = mohawk ? (i - 3.5) * .024 - .01 : -.072 + row * .052;
      const lift = index === 7 ? .88 : index === 4 ? 1.06 : 1;
      const sweep = index === 5 ? (t < -.15 ? -.48 : .48) : partDirection * .36;
      return <mesh key={`crown-${i}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[x, .114 + (1 - t * t) * .023 + (mohawk ? .038 : 0), z]} scale={[index === 7 ? .033 : .03, .094 * lift, .034]} rotation={[index === 6 ? .95 : -.85, t * .35, mohawk ? 0 : sweep]}><meshStandardMaterial color={color} roughness={.48} /></mesh>;
    })}
    {long && [-1, 1].map(side => <Part key={side} at={[side * .11, -.048, -.012]} size={[.034, index === 9 ? .195 : .128, .082]} color={color} rotation={[.06, 0, side * .07]} />)}
    {index === 10 && coverage.showBun && <>
      <Part at={[0, referencePonytail ? .108 : .118, referencePonytail ? -.15 : -.132]} size={[.066, .064, .062]} color={color} />
      <mesh position={[0, referencePonytail ? .085 : .095, -.186]} castShadow><torusGeometry args={[.028, .006, 10, 24]} /><meshStandardMaterial color="#36323a" metalness={.28} roughness={.65} /></mesh>
      {referencePonytail ? <mesh name="reference-swept-ponytail" geometry={REFERENCE_PONYTAIL} dispose={null} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.67} side={THREE.DoubleSide} /></mesh> : [-2, -1, 0, 1, 2].map(strand => <mesh key={`tail-${strand}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[strand * .017, referencePonytail ? -.092 - Math.abs(strand) * .012 : -.025 - Math.abs(strand) * .008, referencePonytail ? -.2 : -.176]} scale={[.025, referencePonytail ? .235 - Math.abs(strand) * .03 : .138 - Math.abs(strand) * .017, .026]} rotation={[-.22, strand * .07, strand * -.08]}><meshStandardMaterial color={color} roughness={.5} /></mesh>)}
      {referencePonytail && [-1, 1].map(side => <mesh key={`loose-lock-${side}`} geometry={HAIR_LOCK} dispose={null} castShadow position={[side * .099, -.069, .038]} scale={[.011, .097, .014]} rotation={[-.07, side * .11, side * .07]}><meshStandardMaterial color={color} roughness={.52} /></mesh>)}
    </>}
  </group>;
}

function FacialSurface({ data, color, roughness = .68, name, smooth = false }: { data: FacialMesh; color: string; roughness?: number; name?: string; smooth?: boolean }) {
  const geometry = useMemo(() => smooth ? toSculptedGeometry(data) : toBufferGeometry(data), [data, smooth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={name} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={roughness} side={THREE.DoubleSide} /></mesh>;
}

function sculptedSkinGeometry(data: SculptedMeshData, skin: string): THREE.BufferGeometry {
  const geometry = toSculptedGeometry(data);
  const position = geometry.getAttribute("position");
  const base = new THREE.Color(skin);
  const shadow = base.clone().multiplyScalar(.84);
  const rose = base.clone().lerp(new THREE.Color("#b77269"), .3);
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const front = THREE.MathUtils.smoothstep(z, .045, .095);
    const sockets = Math.exp(-Math.pow((Math.abs(x) - .051) / .026, 2) - Math.pow((y - .018) / .022, 2)) * front * .24;
    const underJaw = THREE.MathUtils.smoothstep(-y, .075, .14) * .19;
    const cheeks = Math.exp(-Math.pow((Math.abs(x) - .071) / .025, 2) - Math.pow((y + .037) / .024, 2)) * front * .38;
    const tone = base.clone().lerp(shadow, Math.min(.33, sockets + underJaw)).lerp(rose, cheeks);
    colors.push(tone.r, tone.g, tone.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function surfaceZ(data: SculptedMeshData, x: number, y: number): number {
  let front = -Infinity;
  for (let i = 0; i < data.indices.length; i += 3) {
    const points = data.indices.slice(i, i + 3).map(index => [data.positions[index * 3], data.positions[index * 3 + 1], data.positions[index * 3 + 2]] as Vec);
    const [a, b, c] = points;
    const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) < 1e-8) continue;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
    const w = 1 - u - v;
    if (u >= -.0001 && v >= -.0001 && w >= -.0001) front = Math.max(front, u * a[2] + v * b[2] + w * c[2]);
  }
  return front;
}

function projectFeature(data: FacialMesh, head: SculptedMeshData, xScale: number, yScale: number, xOffset: number, yOffset: number, clearance = .0015): FacialMesh {
  const positions = [...data.positions];
  for (let i = 0; i < positions.length; i += 3) {
    const x = xOffset + positions[i] * xScale, y = yOffset + positions[i + 1] * yScale;
    const depth = surfaceZ(head, x, y);
    positions[i + 2] = (Number.isFinite(depth) ? depth : .09) + clearance + .0013 * Math.tanh(Math.max(0, positions[i + 2]) / .002);
  }
  return { positions, indices: data.indices };
}

function Face({ appearance, skin, hair, hairstyle, headwearModel, referencePonytail = false }: { appearance: ModelAppearance; skin: string; hair: string; hairstyle: string; headwearModel?: string; referencePonytail?: boolean }) {
  const preset = (value: string | number | undefined, names: string[]) => typeof value === "number" ? value : Math.max(0, names.indexOf(value ?? ""));
  const shape = faceShape(appearance.facePreset ?? preset(appearance.face, ["oval", "heart", "angular", "round", "long", "square"]));
  const eye = facialPreset(EYE_SHAPES, appearance.eyePreset ?? appearance.eyes);
  const brow = facialPreset(BROW_SHAPES, appearance.browPreset ?? appearance.brows ?? appearance.eyebrows);
  const nose = facialPreset(NOSE_SHAPES, appearance.nosePreset ?? appearance.nose);
  const ear = facialPreset(EAR_SHAPES, appearance.earPreset ?? appearance.ears);
  const mouth = facialPreset(MOUTH_SHAPES, appearance.mouthPreset ?? appearance.mouth);
  const head = useMemo(() => headMeshData(shape), [shape]);
  const earGeometry = useMemo(() => earMesh(ear), [ear]);
  const browGeometry = useMemo(() => [-1, 1].map(side => projectFeature(facialRibbonMesh(browPoints(brow), brow.thickness), head, side * .78, .86, side * .044 * shape.width, .042)), [brow, head, shape.width]);
  const noseGeometry = useMemo(() => noseMeshData(nose), [nose]);
  const eyeGeometry = useMemo(() => [-1, 1].map(side => {
    const fit = (data: FacialMesh) => {
      const positions = [...data.positions];
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] *= .78;
        positions[i + 1] += Math.tan(side * eye.tilt) * positions[i];
      }
      return projectFeature({ positions, indices: data.indices }, head, 1, 1, side * .044 * shape.width, .018);
    };
    const upper = eyeContourPoints(eye, "upper"), lower = eyeContourPoints(eye, "lower");
    return {
      white: fit(eyeMesh(eye)),
      upper: fit(facialRibbonMesh(upper, .0013)),
      lower: fit(facialRibbonMesh(lower, .0012)),
      fold: fit(facialRibbonMesh(upper.map(([x, y, z]) => [x, y + eye.lidThickness * .85 + eye.lidHeight * .12, z]), eye.lidThickness * .46)),
    };
  }), [eye, head, shape.width]);
  const upperLip = useMemo(() => projectFeature(facialRibbonMesh(mouthPoints(mouth, "upper"), mouth.upperThickness * 1.2), head, .84, .88, 0, -.068, .003), [mouth, head]);
  const lowerLip = useMemo(() => projectFeature(facialRibbonMesh(mouthPoints(mouth, "lower"), mouth.lowerThickness * 1.3), head, .84, .88, 0, -.068, .0035), [mouth, head]);
  const eyeSurface = useMemo(() => surfaceZ(head, .044 * shape.width, .018), [head, shape.width]);
  const profile = useMemo(() => referencePonytail ? sculptedSkinGeometry(head, skin) : toSculptedGeometry(head), [head, referencePonytail, skin]);
  useEffect(() => () => profile.dispose(), [profile]);
  const eyeWidth = eye.width * .78;
  const irisRadius = Math.min(eyeWidth * .44, eye.height * .88);
  const lipColor = new THREE.Color(skin).lerp(new THREE.Color("#a45c60"), .46).getStyle();
  const lipShadow = new THREE.Color(skin).lerp(new THREE.Color("#562e35"), .56).getStyle();
  const lidColor = new THREE.Color(skin).lerp(new THREE.Color("#674b46"), .28).getStyle();
  const lashColor = new THREE.Color(hair).lerp(new THREE.Color("#30272c"), .65).getStyle();
  const browColor = new THREE.Color(hair).lerp(new THREE.Color("#352b2b"), .28).getStyle();
  return <group name="face">
    <mesh name="head-surface" geometry={profile} castShadow receiveShadow><meshPhysicalMaterial color={referencePonytail ? "#ffffff" : skin} vertexColors={referencePonytail} roughness={referencePonytail ? .76 : .57} metalness={0} clearcoat={.035} clearcoatRoughness={.75} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <group position={[side * .113 * shape.width, -.008, -.008]} rotation={[.06, side * -.42, side * -.06]} scale={[.56, .86, .52]}>
        <FacialSurface data={earGeometry} color={skin} />
      </group>
      <Part at={[side * (.111 * shape.width + ear.width * .18), -.009, -.004]} size={[ear.width * .16, ear.height * .26, ear.depth * .16]} color="#9c6c59" />
      <group name={`eye-${side}`} position={[side * .044 * shape.width, .018, 0]} scale={referencePonytail ? [.86, .79, 1] : [1, 1, 1]}>
        <FacialSurface name="eye-white" data={eyeGeometry[side < 0 ? 0 : 1].white} color="#e7e3da" roughness={.38} />
        <FacialSurface name="upper-lid" data={eyeGeometry[side < 0 ? 0 : 1].upper} color={lashColor} roughness={.72} />
        <FacialSurface name="lower-lid" data={eyeGeometry[side < 0 ? 0 : 1].lower} color={lidColor} roughness={.68} />
        <FacialSurface name="lid-fold" data={eyeGeometry[side < 0 ? 0 : 1].fold} color={lidColor} roughness={.72} />
        <group position={[0, eye.height * .09, eyeSurface + .006]} rotation={[0, side * .14, side * eye.tilt]}>
          <mesh scale={[irisRadius, irisRadius * .8, .0018]} geometry={SPHERE} dispose={null}><meshPhysicalMaterial color={appearance.eyeColor ?? appearance.iris ?? "#5e716d"} roughness={.27} clearcoat={.6} clearcoatRoughness={.16} /></mesh>
          <Part at={[0, 0, .0015]} size={[irisRadius * .43, irisRadius * .42, .001]} color="#0a0e16" />
          <Part at={[-side * .002, .0021, .0025]} size={[.0011, .0013, .0006]} color="#f4f8fb" />
        </group>
      </group>
      <group name={`brow-${side}`} position={[side * .044 * shape.width, .042, 0]} scale={[side * .78, .86, 1]}>
        <FacialSurface name="brow-surface" data={browGeometry[side < 0 ? 0 : 1]} color={browColor} roughness={.82} />
      </group>
      {(appearance.piercing || appearance.piercings) && <mesh position={[side * .122 * shape.width, -.034, -.002]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.011, .0024, 8, 18]} /><meshStandardMaterial color="#bdcbd3" metalness={.9} roughness={.2} /></mesh>}
    </group>)}
    <FacialSurface data={noseGeometry} color={skin} smooth />
    <group name="mouth" position={[0, -.068, 0]} scale={[.84, .88, 1]}>
      <FacialSurface name="upper-lip" data={upperLip} color={lipShadow} roughness={.64} />
      <FacialSurface name="lower-lip" data={lowerLip} color={lipColor} roughness={.48} />
    </group>
    {appearance.beard && <Part at={[0, -.104, .058]} size={[.066 * shape.jaw, .028, .044]} color={hair} />}
    {appearance.cyberware && <><Part at={[.082 * shape.width, -.022, .086]} size={[.028, .014, .005]} color="#657682" round metal={.8} /><Part at={[.084 * shape.width, -.022, .092]} size={[.018, .003, .004]} color="#52c7d4" round glow /></>}
    <Hair style={appearance.hairPreset !== undefined ? HAIR_STYLES[appearance.hairPreset] ?? hairstyle : appearance.hairstyle ?? hairstyle} color={hair} headwearModel={headwearModel} shape={shape} referencePonytail={referencePonytail} />
  </group>;
}

const SKIN_SECTIONS: readonly GarmentSection[] = [
  { y: .945, width: .158, depth: .096 },
  { y: 1.01, width: .154, depth: .094 },
  { y: 1.13, width: .146, depth: .092 },
  { y: 1.235, width: .164, depth: .101 },
  { y: 1.33, width: .186, depth: .108 },
  { y: 1.395, width: .198, depth: .102 },
  { y: 1.438, width: .206, depth: .095 },
  { y: 1.478, width: .124, depth: .074 },
  { y: 1.512, width: .058, depth: .052 },
];

function ArmorAttachments({ items, anchor }: { items: readonly EquipmentDefinition[]; anchor: EquipmentAnchor }) {
  return <group name={`equipment-anchor:${anchor}`}>{items.filter(item => item.rigAnchors.includes(anchor)).map(item => <EquipmentModel key={item.id} itemId={item.id} anchor={anchor} />)}</group>;
}

export type CharacterModelProps = { character?: ModelCharacter; animation?: CharacterAnimation; animationRef?: RefObject<CharacterAnimation>; weaponId?: string; equipment?: Partial<Record<string, string>>; cosmetics?: Partial<Record<string, string>>; paused?: boolean; weaponDrawn?: boolean; referenceLook?: boolean };

// Standalone creator/gallery previews keep the historical drawn pose; the live Avatar
// explicitly passes false so apartment life starts sheathed.
export function CharacterModel({ character = {}, animation = "idle", animationRef, weaponId, equipment, cosmetics, paused = false, weaponDrawn = true, referenceLook = false }: CharacterModelProps) {
  // The cinematic apartment is a presentation of the same live, animated
  // character. Its reference wardrobe does not modify saved cosmetics or stats.
  const skin = referenceLook ? "#b99884" : character.skin ?? "#bb8b74";
  const hair = referenceLook ? "#111016" : character.hair ?? "#17191e";
  const hairstyle = referenceLook ? "bun" : character.hairstyle ?? "short";
  const appearance: ModelAppearance = referenceLook
    ? { presentation: "feminine", body: "slim", shoulderWidth: .87, face: "oval", eyes: "hooded", eyeColor: "#382d2b", eyebrows: "arched", nose: "button", mouth: "neutral" }
    : character.appearance ?? {};
  const body = useMemo(() => {
    const result = bodyShape(appearance.body ?? "balanced", appearance.presentation ?? "neutral");
    return { ...result, shoulder: result.shoulder * (appearance.shoulderWidth ?? 1), limb: referenceLook ? result.limb * .87 : result.limb };
  }, [appearance.body, appearance.presentation, appearance.shoulderWidth, referenceLook]);
  const armor = Object.entries(equipment ?? {}).flatMap(([slot, id]) => {
    const item = id ? getEquipmentDefinition(id) : undefined;
    const compatibleSlot = item && (item.slot === slot || ["accessory1", "accessory2"].includes(slot) && ["accessory1", "accessory2"].includes(item.slot));
    return item && compatibleSlot && item.slot !== "weapon" ? [item] : [];
  });
  const selectedWeaponId = equipment?.weapon ?? weaponId;
  const weapon = selectedWeaponId ? getEquipmentDefinition(selectedWeaponId) : undefined;
  const equipped = cosmetics ?? character.cosmetics;
  const cosmetic = (slot: string) => COSMETICS.find(item => item.id === equipped?.[slot]);
  const top = cosmetic("top"), bottom = cosmetic("bottom") ?? cosmetic("bottoms"), shoes = cosmetic("shoes"), headwear = cosmetic("headwear");
  const legacyCoat = top?.model === "long-coat";
  const outerwear = cosmetic("outerwear") ?? (legacyCoat ? top : undefined);
  const baseTop = legacyCoat ? undefined : top;
  const pieces: WornPiece[] = referenceLook ? [
    ...[cosmetic("accessory"), cosmetic("eyewear"), cosmetic("gloves"), cosmetic("back"), cosmetic("face"), cosmetic("jewelry")]
      .filter((piece): piece is NonNullable<typeof piece> => Boolean(piece)),
  ] : [
    { model: baseTop?.model ?? "tee", color: baseTop?.color ?? character.outfit ?? "#c5ccd4" },
    { model: bottom?.model ?? "tapered", color: bottom?.color ?? "#252c37" },
    { model: shoes?.model ?? "sneakers", color: shoes?.color ?? "#8095a9" },
    ...[outerwear, headwear, cosmetic("accessory"), cosmetic("eyewear"), cosmetic("gloves"), cosmetic("back"), cosmetic("face"), cosmetic("jewelry")].filter((piece): piece is NonNullable<typeof piece> => Boolean(piece)),
  ].filter((piece, index, array) => array.findIndex(other => other.model === piece.model) === index);
  const faceIndex = appearance.facePreset ?? (typeof appearance.face === "number" ? appearance.face : Math.max(0, ["oval", "heart", "angular", "round", "long", "square"].indexOf(appearance.face ?? "oval")));
  const face = faceShape(faceIndex);
  const torso = useRef<THREE.Group>(null), leftArm = useRef<THREE.Group>(null), rightArm = useRef<THREE.Group>(null), leftLeg = useRef<THREE.Group>(null), rightLeg = useRef<THREE.Group>(null), leftKnee = useRef<THREE.Group>(null), rightKnee = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (paused) return;
    const mode = animationRef?.current ?? animation, t = clock.elapsedTime, walk = mode === "walk" || mode === "run", seated = ["sitting", "working", "studying", "sit-down"].includes(mode), attack = mode === "attack" || mode === "heavy", swing = Math.sin(t * (mode === "heavy" ? 5 : 9));
    const reaching = mode === "draw" || mode === "sheath";
    const working = mode === "working" || mode === "working-standing";
    const ease = (ref: RefObject<THREE.Group | null>, axis: "x" | "y" | "z", target: number) => { if (ref.current) ref.current.rotation[axis] = THREE.MathUtils.damp(ref.current.rotation[axis], target, 16, dt); };
    const airborne = mode === "jump" || mode === "fall" || mode === "land";
    ease(leftLeg, "x", airborne ? .24 : walk ? Math.sin(t * (mode === "run" ? 11 : 8)) * (mode === "run" ? .62 : .46) : seated ? -1.5 : mode === "dodge" ? .55 : 0); ease(rightLeg, "x", airborne ? -.24 : walk ? -Math.sin(t * (mode === "run" ? 11 : 8)) * (mode === "run" ? .62 : .46) : seated ? -1.5 : mode === "dodge" ? -.4 : 0);
    ease(leftKnee, "x", seated ? 1.5 : walk ? Math.max(0, -Math.sin(t * 8)) * .6 : mode === "dodge" ? .65 : 0); ease(rightKnee, "x", seated ? 1.5 : walk ? Math.max(0, Math.sin(t * 8)) * .6 : mode === "dodge" ? .5 : 0);
    ease(leftArm, "x", airborne ? -.82 : walk ? -Math.sin(t * 8) * .32 : mode === "block" ? -1.3 : working ? -.9 + Math.sin(t * 3) * .07 : seated ? -.8 : attack ? -.5 : referenceLook ? -.32 : Math.sin(t * 1.7) * .035); ease(rightArm, "x", reaching ? -2.55 : airborne ? -.82 : walk ? Math.sin(t * 8) * .32 : attack ? -1.2 + swing * .95 : mode === "block" ? -1.5 : working ? -.9 - Math.sin(t * 3) * .07 : seated ? -.8 : weaponDrawn ? -.28 : referenceLook ? -1.13 : 0);
    ease(leftArm, "z", mode === "block" ? -.5 : .055); ease(rightArm, "z", mode === "victory" ? -2.7 : attack ? -.35 : mode === "block" ? .5 : -.055);
    ease(torso, "y", attack ? swing * .2 : walk ? Math.sin(t * 8) * .025 : 0); ease(torso, "z", mode === "exhausted" ? .09 : mode === "dodge" ? -.28 : 0);
  });
  return <group name="character-rig" scale={[body.width, body.height * (appearance.height ?? 1), body.depth]}>
    <group ref={torso} name="torso">
      <Shell sections={SKIN_SECTIONS} body={body} color={skin} />
      {referenceLook && <><ReferenceCropTop body={body} /><ReferenceCargoWaist body={body} /></>}
      <Taper at={[0, 1.542, -.004]} top={.055} bottom={.068} length={.092} color={skin} />
      <Wearables pieces={pieces} anchor="torso" body={body} />
      <ArmorAttachments items={armor} anchor="torso" />
      <group name="head" position={[0, 1.662, .006]} scale={[face.width * (referenceLook ? .89 : .93), face.height * (referenceLook ? .9 : .93), .96]}>
        <Face appearance={appearance} skin={skin} hair={hair} hairstyle={hairstyle} headwearModel={headwear?.model} referencePonytail={referenceLook} />
        <Wearables pieces={pieces} anchor="head" body={body} />
        <ArmorAttachments items={armor} anchor="head" />
      </group>
      {[-1, 1].map(side => <group key={side} name={side < 0 ? "left-arm" : "right-arm"} ref={side < 0 ? leftArm : rightArm} position={[side * .216 * body.shoulder, 1.425, -.004]}>
        <Part at={[-side * .012, -.028, 0]} size={[.064 * body.limb, .068, .062 * body.limb]} color={skin} rotation={[0, 0, side * -.24]} />
        <Taper at={[0, -.148, .002]} top={.062 * body.limb} bottom={.05 * body.limb} length={.245} color={skin} />
        <Part at={[0, -.276, .005]} size={[.044 * body.limb, .039, .043 * body.limb]} color={skin} />
        <Taper at={[0, -.366, .013]} top={.051 * body.limb} bottom={.038 * body.limb} length={.182} color={skin} />
        <group name={side < 0 ? "left-hand-surface" : "right-hand-surface"}>
          <Part at={[0, -.466, .024]} size={[.032 * body.limb, .039, .019]} color={skin} />
          {[.042, .047, .044, .035].map((length, i) => <group key={i} position={[side * (i - 1.5) * .014, -.49 + (i === 3 ? .004 : 0), .028]} rotation={[.12 + i * .025, 0, side * (i - 1.5) * .035]}>
            <Part at={[0, -length * .25, 0]} size={[.0068, length * .36, .0075]} color={skin} />
            <Part at={[0, -length * .66, .003]} size={[.006, length * .29, .0066]} color={skin} rotation={[.16, 0, 0]} />
          </group>)}
          <group position={[-side * .027, -.465, .03]} rotation={[.28, 0, side * -.38]}>
            <Part at={[0, -.007, 0]} size={[.011, .022, .011]} color={skin} />
            <Part at={[0, -.026, .006]} size={[.008, .015, .008]} color={skin} rotation={[.3, 0, 0]} />
          </group>
        </group>
        {(appearance.tattoo || appearance.tattoos) && side > 0 && <Part at={[.024, -.365, .056]} size={[.016, .078, .005]} color="#36434a" round rotation={[0, 0, .2]} />}
        <Wearables pieces={pieces} anchor={side < 0 ? "leftArm" : "rightArm"} body={body} />
        <ArmorAttachments items={armor} anchor={side < 0 ? "leftArm" : "rightArm"} />
        {referenceLook && side > 0 && !weaponDrawn && <group name="reference-takeaway-cup" position={[0, -.505, .063]} rotation={[-.12, -.07, .08]}>
          <mesh castShadow><cylinderGeometry args={[.025, .021, .083, 18]} /><meshStandardMaterial color="#d7c7a7" roughness={.79} /></mesh>
          <mesh position={[0, .042, 0]} castShadow><cylinderGeometry args={[.029, .029, .012, 18]} /><meshStandardMaterial color="#28232b" metalness={.12} roughness={.52} /></mesh>
          <mesh position={[0, .048, -.005]} castShadow><boxGeometry args={[.014, .004, .013]} /><meshStandardMaterial color="#343038" roughness={.6} /></mesh>
          <mesh position={[0, -.008, .021]} scale={[.031, .03, .005]} geometry={ROUND}><meshStandardMaterial color="#e8ddd0" roughness={.9} /></mesh>
        </group>}
        {weaponDrawn && weapon?.slot === "weapon" && weapon.rigAnchors.includes(side < 0 ? "leftHand" : "rightHand") && <group name={side < 0 ? "leftHand" : "rightHand"} position={[0, -.48, .075]} rotation={[Math.PI / 2, 0, 0]}><WeaponModel id={weapon.id} anchor={side < 0 ? "leftHand" : "rightHand"} /></group>}
      </group>)}
      {weapon?.slot === "weapon" && !weaponDrawn && !referenceLook && weapon.rigAnchors.filter(anchor => anchor === "rightHand" || anchor === "leftHand").map((anchor, index) => <group key={anchor} name={`weapon-sheathed:${anchor}`} position={[index ? -.17 : .17, 1.43, -.19]} rotation={[.06, 0, index ? -2.86 : 2.86]}><WeaponModel id={weapon.id} anchor={anchor} /></group>)}
    </group>
    {[-1, 1].map(side => <group key={side} name={side < 0 ? "left-thigh" : "right-thigh"} ref={side < 0 ? leftLeg : rightLeg} position={[side * .102 * body.hip, .958, 0]}>
      <Taper at={[0, -.192, 0]} top={.092 * body.limb} bottom={.068 * body.limb} length={.4} color={skin} />
      {referenceLook && <ReferenceCargoThigh side={side} />}
      <Wearables pieces={pieces} anchor={side < 0 ? "leftThigh" : "rightThigh"} body={body} />
      <Part at={[0, -.38, .003]} size={[.066 * body.limb, .054, .064 * body.limb]} color={skin} />
      <group name={side < 0 ? "left-shin" : "right-shin"} ref={side < 0 ? leftKnee : rightKnee} position={[0, -.393, 0]}>
        <Taper at={[0, -.218, 0]} top={.066} bottom={.046} length={.44} color={skin} />
        {referenceLook && <><ReferenceCargoShin /><ReferenceSneaker /></>}
        <Wearables pieces={pieces} anchor={side < 0 ? "leftShin" : "rightShin"} body={body} />
        <ArmorAttachments items={armor} anchor={side < 0 ? "leftShin" : "rightShin"} />
      </group>
    </group>)}
  </group>;
}
