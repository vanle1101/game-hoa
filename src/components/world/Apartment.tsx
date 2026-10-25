"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Grid, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { CharacterModel, type CharacterAnimation, type ModelAppearance } from "./CharacterModel";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { bodyShape } from "./character-shape";
import { getFurnitureDefinition, isFurnitureModelId } from "@/furniture/catalog";
import { apartmentFurnitureRoute, completeFurnitureArrival, reachedInteractionPoint, resolveFurnitureInteraction, toggleFurnitureActive, type FurnitureArrival } from "@/furniture/interactions";
import { FurnitureModel } from "./furniture-models";
import { HeroAssetModel } from "./furniture-models";
import { heroAssetForKind } from "./apartment-assets";
import { ApartmentCity } from "./ApartmentCity";
import { findPath, furnitureBounds, getRoomFixtures, placementValid, roomDimensions, type Fixture, type Point } from "./geometry";

export type WorldPlacement = { id: string; kind: string; x: number; z: number; rotation: number; neonColor?: string };
export type WorldProps = {
  onInteract: (screen: string) => void;
  placements?: WorldPlacement[];
  buildMode?: boolean;
  onPlace?: (x: number, z: number) => void;
  ghostKind?: string;
  ghostRotation?: number;
  quality?: string;
  skin?: string;
  outfit?: string;
  hair?: string;
  hairstyle?: string;
  appearance?: ModelAppearance;
  cosmetics?: Partial<Record<string,string>>;
  roomId?: string;
  activity?: string;
  activePet?: boolean;
  cameraReset?: number;
  characterOnly?: boolean;
  reducedMotion?: boolean;
  cameraFocus?: "body"|"head";
  cameraAzimuth?: number;
  cameraZoom?: number;
  equipment?: Partial<Record<string,string>>;
  weaponId?: string;
  onFps?: (fps: number) => void;
};

const FURNITURE_BOX=new RoundedBoxGeometry(1,1,1,2,.055);
const inertRaycast: THREE.Object3D["raycast"] = () => {};


function Box({ position, size, color = "#182737", emissive, metal = 0.5, rotation, inert = false, ...props }: {
  position: [number, number, number]; size: [number, number, number]; color?: string; emissive?: string;
  metal?: number; rotation?: [number, number, number]; inert?: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  return <mesh position={position} rotation={rotation} scale={size} geometry={FURNITURE_BOX} dispose={null} castShadow receiveShadow raycast={inert ? inertRaycast : undefined} {...props}>
    <meshStandardMaterial color={color} metalness={metal} roughness={metal < .1 ? .88 : .46} emissive={emissive || "black"} emissiveIntensity={emissive ? 2.2 : 0} />
  </mesh>;
}

function Neon({ position, size, color = "#32e6f4", inert = false, rotation }: { position: [number, number, number]; size: [number, number, number]; color?: string; inert?: boolean; rotation?: [number, number, number] }) {
  return <Box position={position} size={size} color={color} emissive={color} metal={0} inert={inert} rotation={rotation} />;
}

function Plant({ position, scale = 1, blossom = false }: { position: [number, number, number]; scale?: number; blossom?: boolean }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, .3, 0]} castShadow raycast={inertRaycast}><cylinderGeometry args={[.26, .19, .6, 12]} /><meshStandardMaterial color="#1f2836" metalness={.4} roughness={.5} /></mesh>
    <mesh position={[0, .58, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={inertRaycast}><torusGeometry args={[.24, .016, 6, 20]} /><meshBasicMaterial color={blossom ? "#ee5acb" : "#32e6f4"} /></mesh>
    {[0, 1, 2, 3, 4, 5].map(i => <mesh key={i} position={[Math.sin(i * 2) * .15, .85 + (i % 3) * .13, Math.cos(i * 2) * .15]} rotation={[.25 * Math.sin(i), i, .35 * Math.cos(i)]} scale={[.6,1.8,.3]} castShadow raycast={inertRaycast}>
      <sphereGeometry args={[.17, 12, 8]} /><meshStandardMaterial color={blossom ? (i % 2 ? "#d94ca8" : "#ff85d0") : (i % 2 ? "#3f8270" : "#73a78a")} emissive={blossom ? "#4a153b" : "#000000"} emissiveIntensity={blossom ? .6 : 0} />
    </mesh>)}
  </group>;
}

export function Furniture({ kind, ghost = false, active = true, neonColor, lightDimmer }: { kind: string; ghost?: boolean; active?: boolean; neonColor?: string; lightDimmer?: number }) {
  if (getFurnitureDefinition(kind)?.modelUrl) return <FurnitureModel kind={kind} ghost={ghost} active={active} neonColor={neonColor} lightDimmer={lightDimmer}/>;
  const hero = heroAssetForKind(kind);
  if (hero) return <HeroAssetModel id={hero} ghost={ghost} active={active}/>;
  if (isFurnitureModelId(kind)) return <FurnitureModel kind={kind} ghost={ghost} active={active} neonColor={neonColor} lightDimmer={lightDimmer}/>;
  const c = ghost ? "#426d78" : "#243647";
  if (kind === "training-rack") return <group>{[-.9,.9].map(x=><Box key={x} position={[x,1.15,0]} size={[.13,2.3,.5]} color="#617386"/>)}<Box position={[0,2.2,0]} size={[2,.1,.15]} color="#81909e"/><Box position={[0,1.3,.12]} size={[2.4,.06,.06]} color="#b4c1cc"/>{[-1,1].map(side=><mesh key={side} position={[side*.92,1.3,.12]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.32,.32,.16,20]}/><meshStandardMaterial color="#273747" metalness={.8} roughness={.25}/></mesh>)}<Neon position={[0,.06,.32]} size={[2.1,.035,.035]} color="#ffbc62"/></group>;
  if (kind === "training-bag") return <group><Box position={[0,.07,0]} size={[1,.14,1]} color="#283546"/><Box position={[0,.5,0]} size={[.12,1,.12]} color="#687886"/><mesh position={[0,1.55,0]} castShadow><capsuleGeometry args={[.4,.8,8,16]}/><meshStandardMaterial color="#26394b" roughness={.7}/></mesh>{[1.1,1.9].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.405,.018,6,32]}/><meshBasicMaterial color="#ffbc62"/></mesh>)}</group>;
  if (kind === "fabricator" || kind === "arcade") return <group><Box position={[0,.9,0]} size={[1.25,1.8,1.05]} color="#1b283b"/><Box position={[0,1.25,.54]} size={[1.04,.7,.03]} color="#10273d" emissive="#245177"/><Neon position={[0,1.66,.57]} size={[1.12,.035,.025]} color="#ee5acb"/><Box position={[0,.78,.6]} size={[1.2,.15,.25]} color="#495a72"/>{[-.35,.35].map(x=><Neon key={x} position={[x,.88,.65]} size={[.12,.025,.12]} color="#32e6f4"/>)}</group>;
  if (kind === "tool-wall") return <group><Box position={[0,1.25,0]} size={[2.5,2.5,.45]} color="#223040"/>{[0,1,2,3,4].map(i=><group key={i}><Box position={[-.9+i*.45,1.45,.26]} size={[.09,.8,.08]} color="#9eb3c1"/><Box position={[-.9+i*.45,1.9,.26]} size={[.3,.1,.1]} color="#697b88"/></group>)}<Neon position={[0,2.45,.26]} size={[2.3,.035,.03]} color="#ffbc62"/></group>;
  if (kind === "trophy-plinth" || kind === "holo-art") return <group><mesh position={[0,.35,0]}><cylinderGeometry args={[.5,.6,.7,6]}/><meshStandardMaterial color="#1e3044" metalness={.9} roughness={.2}/></mesh><mesh position={[0,1.2,0]}><icosahedronGeometry args={[.42,0]}/><meshStandardMaterial color="#ebb877" metalness={.85} roughness={.16} emissive="#71542b" emissiveIntensity={.5}/></mesh><mesh position={[0,.75,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.55,.018,6,32]}/><meshBasicMaterial color="#ffbc62"/></mesh></group>;
  if (kind === "bench" || kind === "chair") return <group><Box position={[0,.53,0]} size={[kind==="chair"?.65:1.5,.17,.65]} color="#5f6b80" metal={0}/>{[-.25,.25].map(x=><Box key={x} position={[x,.24,0]} size={[.06,.48,.48]} color="#52687a"/>)}{kind==="chair"&&<Box position={[0,1.02,-.28]} size={[.65,.85,.14]} color="#425266" metal={0}/>}</group>;
  if (/desk|work|terminal|computer/.test(kind)) return <group>
    <Box position={[0, .82, 0]} size={[2.3, .085, 1]} color={ghost?c:"#73594b"} metal={0} />
    <Box position={[.83,.42,-.02]} size={[.48,.75,.77]} color="#2c3540"/>{[.27,.48,.69].map(y=><group key={y}><Box position={[.83,y,.38]} size={[.43,.18,.025]} color="#38414b"/><Box position={[.83,y+.04,.4]} size={[.13,.015,.02]} color="#a3a7a4"/></group>)}
    {[-.95, .95].map(x => <Box key={x} position={[x, .4, 0]} size={[.09, .8, .75]} color="#707984" />)}
    <Neon position={[0, .83, .52]} size={[2.15, .025, .025]} />
    <Box position={[0, 1.3, -.25]} size={[1.45, .73, .07]} color="#101927" />
    <Box position={[0, 1.3, -.202]} size={[1.31, .59, .015]} color="#07383e" emissive="#10535c" />
    {[0,1,2,3].map(i => <Neon key={i} position={[-.37 + i*.18, 1.15 + i*.07, -.19]} size={[.11,.12+i*.09,.012]} color={i===3?"#a17bff":"#41b9c4"} />)}
    <Box position={[0, 1.01, -.25]} size={[.1, .35, .08]} /><Box position={[0, .91, .16]} size={[.8, .035, .28]} color="#566478" />
    {[0,1,2].flatMap(row=>Array.from({length:10},(_,col)=><Box key={`${row}-${col}`} position={[-.34+col*.073,.933,.08+row*.075]} size={[.05,.009,.046]} color="#202d3b" metal={0}/>))}
    <mesh position={[.58,.934,.19]} scale={[.055,.025,.09]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#a2a9ad" roughness={.5}/></mesh>
    <Box position={[1, 1.01, 0]} size={[.24,.3,.26]} color="#151b2b" /><Neon position={[1,1.03,.14]} size={[.13,.04,.01]} color="#9067ff" />
  </group>;
  if (/bed/.test(kind)) return <group>
    <Box position={[0, .24, 0]} size={[2.6,.46,3.15]} color="#57473f" metal={0} />
    <Box position={[0, .55, 0]} size={[2.5,.27,3]} color="#c4c7cf" metal={0} />
    <Box position={[0, .73, .45]} size={[2.52,.13,1.95]} color="#3b5364" metal={0} />
    <Box position={[0, .85, -1.5]} size={[2.7,1.6,.14]} color="#514940" metal={0} />
    {[-.88,0,.88].map(x=><Box key={x} position={[x,1.05,-1.4]} size={[.84,.9,.09]} color="#626361" metal={0}/>)}
    {[-.65,.65].map(x => <Box key={x} position={[x,.75,-.9]} size={[1.05,.2,.62]} color="#e3ded7" metal={0} />)}
    <Box position={[0,.16,1.59]} size={[2.4,.025,.015]} color="#bc8e60" emissive="#bc8e60" />
    {[-1.1,1.1].map(x=><Box key={x} position={[x,.805,.45]} size={[.016,.009,1.9]} color="#647984" metal={0}/>)}
  </group>;
  if (/sofa|couch/.test(kind)) return <group>
    {[-1.1,1.1].flatMap(x=>[-.38,.38].map(z=><Box key={`${x}-${z}`} position={[x,.12,z]} size={[.07,.24,.07]} color="#877564"/>))}
    <Box position={[0,.32,0]} size={[2.9,.5,1.12]} color="#536171" metal={0} />
    <Box position={[0,.83,-.47]} size={[2.9,.8,.24]} color="#607183" metal={0} />
    {[-.9,0,.9].map(x=><Box key={x} position={[x,.9,-.27]} size={[.86,.57,.19]} color="#61717c" metal={0} rotation={[-.1,0,0]}/>)}
    {[-1.35,1.35].map(x => <Box key={x} position={[x,.64,0]} size={[.22,.64,1.16]} color="#607183" metal={0} />)}
    {[-.77,0,.77].map(x => <Box key={x} position={[x,.63,.03]} size={[.72,.18,.8]} color="#748294" metal={0} />)}
    <Box position={[-.8,.93,-.2]} size={[.46,.43,.18]} color="#bf9a75" rotation={[0,0,.2]} metal={0} />
  </group>;
  if (/plant/.test(kind)) return <Plant position={[0,0,0]} />;
  if (/shelf|trophy|wardrobe/.test(kind)) return <group>
    <Box position={[0,1,-.25]} size={[1.65,2,.1]} color="#352f2c" metal={0}/>{[-.79,.79].map(x=><Box key={x} position={[x,1,0]} size={[.09,2,.6]} color="#6c5545" metal={0}/>)}
    {[.06,.65,1.3,1.96].map(y=><Box key={y} position={[0,y,0]} size={[1.65,.07,.6]} color="#745a48" metal={0}/>)}
    {[0,1,2,3,4,5].map(i=><Box key={i} position={[-.58+i*.12,.88,.1]} size={[.08,.38-(i%3)*.04,.24]} color={["#637783","#9b7961","#4b5868"][i%3]} metal={0} rotation={[0,0,i===5?-.13:0]}/>)}
    {[.45,1.05,1.65].map((y,i) => <group key={y}><Box position={[0,y,.33]} size={[1.5,.06,.08]} color="#c4ac86" /><Neon position={[0,y+.43,.32]} size={[1.5,.025,.025]} color="#ffa96b" /><mesh position={[i%2?-.32:.3,y+.2,.35]}><icosahedronGeometry args={[.17,0]} /><meshStandardMaterial color="#bfa677" metalness={.9} roughness={.2} /></mesh></group>)}
  </group>;
  if (/lamp/.test(kind)) return <group><Box position={[0,.03,0]} size={[.5,.06,.5]} /><Box position={[0,1.1,0]} size={[.05,2.2,.05]} color="#a4a2a0" /><Neon position={[0,2.1,0]} size={[.5,.15,.5]} color="#ffbc62" /></group>;
  if (/rug/.test(kind)) return <Box position={[0,.025,0]} size={[3,.025,2]} color="#354960" metal={0} />;
  return <group><Box position={[0,.32,0]} size={[1.3,.6,.8]} color={c} /><Neon position={[0,.65,0]} size={[1.3,.02,.8]} color="#9067ff" /></group>;
}

function Interactable({ at, label, screen, kind, onInteract, rotation = 0, active = true, neonColor }: { at: [number, number, number]; label: string; screen: string; kind: string; onInteract: WorldProps["onInteract"]; rotation?: number; active?: boolean; neonColor?: string }) {
  const [hovered, setHovered] = useState(false);
  return <group position={at} rotation={[0,rotation,0]} onPointerOver={e=>{e.stopPropagation();setHovered(true);}} onPointerOut={()=>setHovered(false)} onClick={e=>{e.stopPropagation();onInteract(screen);}}>
    <Furniture kind={kind} active={active} neonColor={neonColor} />
    {hovered && <Html position={[0,2.5,0]} center distanceFactor={10} zIndexRange={[20,0]}><button className="world-tooltip" onClick={()=>onInteract(screen)}>{label} <span>↗</span></button></Html>}
  </group>;
}

export type AvatarPose = { activity: string; x: number; z: number; rotation: number; y?: number; exit?: Point; exiting?: boolean };
export interface AvatarControlState {
  position: Point;
  rotation: number;
  animation: CharacterAnimation;
  vertical?: number;
}
export interface AvatarProps {
  path: Point[];
  onPosition?: (point: Point) => void;
  initialPosition?: Point;
  initialRotation?: number;
  pose?: AvatarPose;
  onArrive?: () => void;
  onPoseExit?: () => void;
  controlled?: AvatarControlState;
  controlRef?: RefObject<AvatarControlState | undefined>;
  skin?: string;
  outfit?: string;
  hair?: string;
  hairstyle?: string;
  appearance?: ModelAppearance;
  cosmetics?: Partial<Record<string, string>>;
  equipment?: Partial<Record<string, string>>;
  weaponId?: string;
  weaponDrawn?: boolean;
  activity?: string;
  only?: boolean;
  reducedMotion?: boolean;
  referenceLook?: boolean;
}
export function Avatar({ path, onPosition, initialPosition={x:0,z:1.5}, initialRotation = 0, pose, onArrive, onPoseExit, controlled, controlRef, skin, outfit, hair, hairstyle, appearance, cosmetics, equipment, weaponId, weaponDrawn = false, activity = "idle", only = false, reducedMotion = false, referenceLook = false }: Readonly<AvatarProps>) {
  const current=useRef<Point>({...initialPosition});
  const group = useRef<THREE.Group>(null);
  const animation=useRef<CharacterAnimation>("idle");
  const movement = useRef({ path, index: 0, arrived: true });
  const wasControlled = useRef(false);
  const suppressedPose = useRef<AvatarPose | undefined>(undefined);
  const poseMotion = useRef<{ pose?: AvatarPose; elapsed: number; from: THREE.Vector3; yaw: number; pitch: number; completed: boolean }>({ elapsed: 0, from: new THREE.Vector3(), yaw: 0, pitch: 0, completed: false });
  useFrame((_, delta) => {
    if (!group.current) return;
    if(movement.current.path!==path)movement.current={path,index:0,arrived:false};
    const p=group.current.position;
    // Authored furniture poses own the transform until a safe exit completes.
    if (!only && pose?.exit) {
      const motion = poseMotion.current;
      if (motion.pose !== pose) {
        motion.pose = pose; motion.elapsed = 0; motion.from.copy(p);
        motion.yaw = group.current.rotation.y; motion.pitch = group.current.rotation.x; motion.completed = false;
      }
      motion.elapsed += Math.min(delta, .1);
      const duration = pose.exiting ? .65 : pose.activity === "sleeping" ? 1.05 : .75;
      const t = Math.min(1, motion.elapsed / duration), blend = t * t * (3 - 2 * t);
      const yawDelta = Math.atan2(Math.sin(pose.rotation - motion.yaw), Math.cos(pose.rotation - motion.yaw));
      p.set(THREE.MathUtils.lerp(motion.from.x, pose.x, blend), THREE.MathUtils.lerp(motion.from.y, pose.y ?? 0, blend), THREE.MathUtils.lerp(motion.from.z, pose.z, blend));
      group.current.rotation.set(THREE.MathUtils.lerp(motion.pitch, pose.activity === "sleeping" ? -Math.PI / 2 : 0, blend), motion.yaw + yawDelta * blend, 0, "YXZ");
      animation.current = pose.exiting ? (Math.abs(motion.pitch) > .2 ? "get-up" : "stand-up") : pose.activity === "working-standing" ? "working-standing" : pose.activity === "sleeping" ? (t < 1 ? "lie-down" : "lying") : t < 1 ? "sit-down" : pose.activity as CharacterAnimation;
      current.current = { x: p.x, z: p.z };
      onPosition?.({ ...current.current });
      if (pose.exiting && t === 1 && !motion.completed) { motion.completed = true; onPoseExit?.(); }
      return;
    }
    const control = only ? undefined : controlRef ? controlRef.current : controlled;
    if (control) {
      wasControlled.current = true;
      suppressedPose.current = pose;
      current.current.x = control.position.x;
      current.current.z = control.position.z;
      animation.current = control.animation;
      const seated = ["sitting", "working", "studying"].includes(control.animation);
      p.set(current.current.x, (seated ? -.27 : 0) + (control.vertical ?? 0), current.current.z);
      group.current.rotation.set(0, control.rotation, 0);
      onPosition?.({ x: current.current.x, z: current.current.z });
      return;
    }
    if (wasControlled.current) {
      wasControlled.current = false;
      if (!path.length) movement.current.arrived = true;
    }
    const target=path[movement.current.index];
    const dx=target?target.x-current.current.x:0,dz=target?target.z-current.current.z:0;
    const moving = !only && !!target;
    if(moving){const distance=Math.hypot(dx,dz);if(distance<.035)movement.current.index++;else{const step=Math.min(delta*2.5,distance)/distance;current.current.x+=dx*step;current.current.z+=dz*step;const angle=Math.atan2(dx,dz);const shortest=Math.atan2(Math.sin(angle-group.current.rotation.y),Math.cos(angle-group.current.rotation.y));group.current.rotation.y+=shortest*Math.min(1,delta*10);}}
    const activePose = pose !== suppressedPose.current ? pose : undefined;
    const mode=!moving?(activePose?.activity??activity):"walk";
    animation.current=(mode==="celebrating"?"victory":mode==="sleeping"?"idle":mode) as CharacterAnimation;
    const seated=["sitting","working","studying"].includes(mode);
    p.set(only?0:current.current.x,seated?-.27:0,only?0:current.current.z);
    if(!moving&&activePose){p.x=activePose.x;p.z=activePose.z;group.current.rotation.y=activePose.rotation;if(!only){current.current.x=activePose.x;current.current.z=activePose.z;}}
    group.current.rotation.x=mode==="sleeping"?-Math.PI/2:0;
    if(mode==="sleeping")p.y=.86;
    onPosition?.({x:current.current.x,z:current.current.z});
    if(!moving&&!movement.current.arrived){movement.current.arrived=true;onArrive?.();}
  }, -1);
  return <group ref={group} name={only ? 'character-studio-avatar' : 'life-level-avatar'} position={only?[0,0,0]:[initialPosition.x,0,initialPosition.z]} rotation={[0, initialRotation, 0]}>
    <CharacterModel character={{skin,outfit,hair,hairstyle,appearance,cosmetics}} animationRef={animation} equipment={equipment} weaponId={weaponId} weaponDrawn={weaponDrawn} paused={only && reducedMotion} referenceLook={referenceLook}/>
    {!only&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><ringGeometry args={[.32,.335,48]}/><meshBasicMaterial color="#65c8d5" transparent opacity={.35}/></mesh>}
  </group>;
}
export function City({ quality = "balanced" }: { quality?: string }) {
  return <ApartmentCity quality={quality} />;
}
function Pet() {
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(ref.current)ref.current.position.y=.25+Math.sin(clock.elapsedTime*2)*.1;});
  return <group ref={ref} position={[-1,.3,2]}><mesh><sphereGeometry args={[.26,16,12]}/><meshStandardMaterial color="#c1ced7" metalness={.7} roughness={.25}/></mesh><Box position={[0,0,.23]} size={[.34,.13,.07]} color="#142637"/><Neon position={[-.09,.01,.28]} size={[.06,.04,.01]}/><Neon position={[.09,.01,.28]} size={[.06,.04,.01]}/>{[-1,1].map(i=><Box key={i} position={[i*.17,.23,0]} size={[.09,.19,.1]} color="#64768a" rotation={[0,0,-i*.3]}/>)}</group>;
}

export function Fps({ onFps }: Pick<WorldProps,"onFps">) {
  const frame=useRef({count:0,time:0});
  useFrame((_,dt)=>{frame.current.count++;frame.current.time+=dt;if(frame.current.time>=3){onFps?.(Math.round(frame.current.count/frame.current.time));frame.current={count:0,time:0};}});
  return null;
}

function CameraRig({characterOnly,cameraReset,roomId,cameraFocus,cameraAzimuth=0,cameraZoom=1,appearance}:Pick<WorldProps,"characterOnly"|"cameraReset"|"roomId"|"cameraFocus"|"cameraAzimuth"|"cameraZoom"|"appearance">){
  const {camera,size}=useThree();const controls=useRef<OrbitControlsType>(null);
  const height=(appearance?.height??1)*bodyShape(appearance?.body,appearance?.presentation).height;
  const isPenthouse=roomId==="premium";
  useEffect(()=>{
    const targetY=characterOnly?(cameraFocus==="head"?1.68*height:.96*height):(isPenthouse?1.15:.65);
    const targetX=characterOnly?0:(isPenthouse?.35:0);
    const targetZ=characterOnly?0:(isPenthouse?-.85:-.35);
    if(characterOnly){const aspect=Math.max(.45,size.width/Math.max(1,size.height));const distance=(cameraFocus==="head"?1.3:Math.max(4.1*height,2.25/aspect))/THREE.MathUtils.clamp(cameraZoom,.65,1.8);camera.position.set(Math.sin(cameraAzimuth)*distance,targetY+(cameraFocus==="head"?.04:.16),Math.cos(cameraAzimuth)*distance);}
    else if(isPenthouse)camera.position.set(14.8,14.2,18.2);
    else camera.position.set(11.6,11.4,14.8);
    if(camera instanceof THREE.PerspectiveCamera){camera.setFocalLength(camera.getFilmHeight()/(2*Math.tan(THREE.MathUtils.degToRad(characterOnly?30:(isPenthouse?38:36))/2)));camera.updateProjectionMatrix();}
    camera.lookAt(targetX,targetY,targetZ);
    if(controls.current){controls.current.target.set(targetX,targetY,targetZ);controls.current.update();controls.current.saveState();}
  },[camera,cameraReset,characterOnly,roomId,isPenthouse,cameraFocus,cameraAzimuth,cameraZoom,height,size.width,size.height]);
  return <OrbitControls ref={controls} enablePan={!characterOnly} minDistance={characterOnly?.55:8.5} maxDistance={characterOnly?8:32} maxPolarAngle={Math.PI*.46} minPolarAngle={.25} minAzimuthAngle={characterOnly?-Infinity:-.85} maxAzimuthAngle={characterOnly?Infinity:1.45} enableDamping dampingFactor={.08}/>;
}

function GhostPreview({kind,x,z,rotation,valid}:{kind:string;x:number;z:number;rotation:number;valid:boolean}){
  const ref=useRef<THREE.Group>(null);const dimensions=furnitureBounds(kind);
  useEffect(()=>{ref.current?.traverse(object=>{if(object instanceof THREE.Mesh){object.raycast=()=>{};const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if(material instanceof THREE.MeshStandardMaterial){material.color.set(valid?"#32e6f4":"#ff6386");material.emissive.set(valid?"#12616c":"#6b1837");material.emissiveIntensity=.5;material.transparent=true;material.opacity=.42;material.depthWrite=false;}}}});},[kind,valid]);
  return <group position={[x,.03,z]} rotation={[0,rotation*Math.PI/180,0]}><group ref={ref}><Furniture kind={kind} ghost/></group><mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]} raycast={()=>{}}><planeGeometry args={[dimensions.width,dimensions.depth]}/><meshBasicMaterial color={valid?"#32e6f4":"#ff6386"} transparent opacity={.24} depthWrite={false}/></mesh><Html position={[0,2.5,0]} center style={{pointerEvents:"none"}}><span className="world-tooltip">{valid?"Vị trí hợp lệ · Chạm để chọn":"Vướng đồ vật hoặc ngoài phòng"}</span></Html></group>;
}

const EMPTY_PATH: Point[] = [];

export function ApartmentScene(props: WorldProps) {
  const room=roomDimensions(props.roomId), fixtures=useMemo(()=>getRoomFixtures(props.roomId),[props.roomId]);
  const obstacles=useMemo(()=>[...fixtures,...(props.placements??[]).map(p=>({...p,...furnitureBounds(p.kind,p.rotation)}))],[fixtures,props.placements]);
  const [movement,setMovement]=useState<{ obstacles: typeof obstacles; points: Point[] }>({obstacles,points:EMPTY_PATH});
  const path=!props.buildMode&&movement.obstacles===obstacles?movement.points:EMPTY_PATH;
  const [ghost,setGhost]=useState<Point>({x:0,z:0});
  const [selectedGhost,setSelectedGhost]=useState<Point|null>(null);
  const [pose,setPose]=useState<AvatarPose>();
  const [activeInstances,setActiveInstances]=useState<Record<string,boolean>>({});
  const pending=useRef<{ obstacles: typeof obstacles; destination: Point; fixture?: Fixture; furniture?: FurnitureArrival } | undefined>(undefined);
  const current=useRef<Point>({x:0,z:1.5});
  const navigationTimer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(()=>{
    pending.current=undefined;
    return()=>{if(navigationTimer.current)clearTimeout(navigationTimer.current);};
  },[props.buildMode,obstacles]);
  const beginRoute=(points:Point[],fixture?:Fixture,furniture?:FurnitureArrival)=>{
    if(navigationTimer.current)clearTimeout(navigationTimer.current);
    pending.current=undefined;
    setPose(undefined);
    setMovement({obstacles,points});
    if(points.length&&(fixture||furniture))pending.current={obstacles,destination:points[points.length-1],fixture,furniture};
  };
  const navigateTo=(point:Point)=>{
    if(props.buildMode)return;
    beginRoute(findPath(current.current,point,room,obstacles));
  };
  const interact=(fixture:Fixture)=>{
    if(props.buildMode)return;
    const approach=fixture.approach??{x:fixture.x,z:fixture.z+fixture.depth/2+.65};
    beginRoute(apartmentFurnitureRoute(current.current,fixture,room,obstacles,approach),fixture);
  };
  const interactPlacement=(placement:WorldPlacement)=>{
    if(props.buildMode)return;
    const action=resolveFurnitureInteraction(placement.kind);
    if(!action)return;
    const points=apartmentFurnitureRoute(current.current,{...placement,...furnitureBounds(placement.kind,placement.rotation)},room,obstacles);
    const destination=points[points.length-1];
    beginRoute(points,undefined,destination?{instanceId:placement.id,action,destination,facing:Math.atan2(placement.x-destination.x,placement.z-destination.z)}:undefined);
  };
  const arrive=()=>{
    const arrival=pending.current;
    pending.current=undefined;
    if(!arrival||props.buildMode||arrival.obstacles!==obstacles||!reachedInteractionPoint(current.current,arrival.destination))return;
    if(arrival.furniture){
      completeFurnitureArrival(arrival.furniture,current.current,true,{onInteract:screen=>{navigationTimer.current=setTimeout(()=>props.onInteract(screen),arrival.furniture?.action.activity?1000:100);},onToggle:id=>setActiveInstances(states=>toggleFurnitureActive(states,id)),onPose:setPose});
      return;
    }
    const fixture=arrival.fixture;
    if(fixture?.activity)setPose({...arrival.destination,activity:fixture.activity,rotation:Math.atan2(fixture.x-current.current.x,fixture.z-current.current.z)});
    if(fixture?.screen)navigationTimer.current=setTimeout(()=>props.onInteract(fixture.screen!),fixture.activity?1000:100);
  };
  const preview=selectedGhost??ghost;
  const valid=props.ghostKind?placementValid({...preview,...furnitureBounds(props.ghostKind,props.ghostRotation)},room,obstacles):false;
  const low=props.quality==="performance";
  const accent=props.roomId==="training"?"#ffbc62":props.roomId==="workshop"?"#53d8bd":props.roomId==="gaming"?"#ee5acb":props.roomId==="trophy"?"#e9ba76":props.roomId==="premium"?"#b59bff":"#32e6f4";
  const w=room.width,d=room.depth;
  return <>
    <color attach="background" args={["#080d18"]}/><fog attach="fog" args={["#10152a",22,58]}/>
    <CameraRig characterOnly={props.characterOnly} cameraReset={props.cameraReset} roomId={props.roomId} cameraFocus={props.cameraFocus} cameraAzimuth={props.cameraAzimuth} cameraZoom={props.cameraZoom} appearance={props.appearance}/>
    <ambientLight intensity={.65}/><hemisphereLight args={["#7897d9","#181622",1.25]}/>
    <directionalLight position={[4,10,6]} intensity={2.5} color="#b1d8ff" castShadow={!low} shadow-mapSize={[1024,1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}/>
    <pointLight position={[-4,3,-2]} intensity={22} color="#9067ff" distance={12}/><pointLight position={[4,3,1]} intensity={20} color="#ffbd7c" distance={10}/>
    {!props.characterOnly&&<>
      <City quality={props.quality}/>
      <Box position={[0,-.2,0]} size={[w+.2,.35,d+.2]} color="#18232f"/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,.001,0]} receiveShadow onPointerMove={e=>{if(props.buildMode)setGhost({x:Math.round(e.point.x*2)/2,z:Math.round(e.point.z*2)/2});}} onClick={e=>{e.stopPropagation();const point={x:e.point.x,z:e.point.z};if(props.buildMode){const snapped={x:Math.round(point.x*2)/2,z:Math.round(point.z*2)/2};setSelectedGhost(snapped);if(props.ghostKind&&placementValid({...snapped,...furnitureBounds(props.ghostKind,props.ghostRotation)},room,obstacles))props.onPlace?.(snapped.x,snapped.z);}else navigateTo(point);}}>
        <planeGeometry args={[w,d]}/><meshStandardMaterial color={props.roomId==="premium"?"#414251":"#374351"} roughness={.58} metalness={.35}/>
      </mesh>
      {Array.from({length:Math.ceil(w)},(_,i)=><Box key={i} position={[-w/2+i+.5,.005,0]} size={[.012,.005,d]} color="#263240"/>)}
      <Box position={[0,.3,-d/2]} size={[w,.6,.15]} color="#151c2b"/><Box position={[0,3.55,-d/2]} size={[w,.28,.18]} color="#344257"/>
      {[-1,1].map(side=><Box key={side} position={[side*(w/2-.65),1.9,-d/2]} size={[1.3,3.6,.18]} color="#253245"/>)}
      <Box position={[-w/2,1.4,0]} size={[.15,2.8,d]} color="#253245"/>
      <Neon position={[0,.08,d/2]} size={[w,.035,.035]} color={accent}/><Neon position={[w/2,.08,0]} size={[.035,.035,d]} color={accent}/>
      <Neon position={[-w/2+.1,2.76,0]} size={[.03,.025,d]} color="#aa7fff"/>
      <mesh position={[0,1.95,-d/2+.03]}><planeGeometry args={[w-2.6,2.6]}/><meshStandardMaterial color="#376281" transparent opacity={.16} metalness={.45} roughness={.1} depthWrite={false}/></mesh>
      {[-4.8,-1.6,1.6,4.8].map(x=><Box key={x} position={[x,1.9,-d/2+.06]} size={[.07,2.9,.09]} color="#566575"/>)}
      <Neon position={[0,3.37,-d/2+.08]} size={[w-2.2,.04,.05]} color={accent}/>
      <Box position={[props.roomId==="training"?0:-3.8,.018,.6]} size={[props.roomId==="training"?5:3.5,.025,3.3]} color={props.roomId==="training"?"#1d3037":"#303d53"}/>
      {props.roomId==="training"&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,.6]}><ringGeometry args={[1.7,1.73,64]}/><meshBasicMaterial color={accent}/></mesh>}
      {fixtures.map((fixture,index)=>fixture.screen?<group key={index}><Interactable at={[fixture.x,0,fixture.z]} kind={fixture.kind} label={props.buildMode?"Đồ vật cố định":fixture.label??fixture.kind} screen={fixture.screen} rotation={(fixture.rotation??0)*Math.PI/180} onInteract={()=>interact(fixture)}/>{fixture.activity==="working"&&fixture.approach&&<FurnitureAt kind="chair" x={fixture.approach.x} z={fixture.approach.z} rotation={180}/>}</group>:<FurnitureAt key={index} kind={fixture.kind} x={fixture.x} z={fixture.z} rotation={fixture.rotation}/>)}
      {[-2.5,2.5].map(x=><group key={x}><Box position={[x,3.4,-3.5]} size={[.04,.35,.04]} color="#657081"/><Neon position={[x,3.2,-3.5]} size={[1.3,.045,.14]} color="#ffd09e"/></group>)}
      <Html position={[-5.7,2.15,-4.3]} transform rotation={[0,0,0]} distanceFactor={5} style={{pointerEvents:"none"}}><div style={{color:accent,fontFamily:"monospace",fontSize:20,letterSpacing:3,whiteSpace:"nowrap"}}>{room.name.toUpperCase()}<div style={{fontSize:8,color:"#b9c9d9",marginTop:7,letterSpacing:4}}>NEON HAVEN / PRIVATE RESIDENCE</div></div></Html>
      {props.placements?.map(p=>{
        const action=resolveFurnitureInteraction(p.kind);
        return action?<Interactable key={p.id} at={[p.x,0,p.z]} kind={p.kind} label={action.interaction.label} screen={action.screen} rotation={p.rotation*Math.PI/180} neonColor={p.neonColor} active={activeInstances[p.id]??true} onInteract={()=>interactPlacement(p)}/>:<FurnitureAt key={p.id} kind={p.kind} x={p.x} z={p.z} rotation={p.rotation} neonColor={p.neonColor}/>;
      })}
      {props.activePet&&<Pet/>}
      {props.buildMode&&<><Grid position={[0,.03,0]} args={[w,d]} cellSize={.5} sectionSize={2} cellColor="#46717b" sectionColor="#32e6f4" fadeDistance={30} infiniteGrid={false}/>{props.ghostKind&&<GhostPreview kind={props.ghostKind} x={preview.x} z={preview.z} rotation={props.ghostRotation??0} valid={valid}/>}</>}
    </>}
    {props.characterOnly&&<group><mesh position={[0,-.09,0]} receiveShadow><cylinderGeometry args={[.82,.9,.16,64]}/><meshStandardMaterial color="#182335" metalness={.65} roughness={.38}/></mesh><mesh position={[0,-.005,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.79,.81,64]}/><meshBasicMaterial color="#32e6f4"/></mesh><spotLight position={[0,5,3]} target-position={[0,1,0]} intensity={32} angle={.55} penumbra={.8} color="#edf4ff"/></group>}
    <Avatar path={path} onPosition={point=>{current.current=point;}} pose={!props.buildMode&&movement.obstacles===obstacles?pose:undefined} onArrive={arrive} skin={props.skin} outfit={props.outfit} hair={props.hair} hairstyle={props.hairstyle} appearance={props.appearance} cosmetics={props.cosmetics} equipment={props.equipment} weaponId={props.weaponId} activity={props.activity} only={props.characterOnly} reducedMotion={props.reducedMotion}/>
    {!low&&<ContactShadows position={[0,.01,0]} opacity={.3} scale={24} blur={2} far={4} resolution={256} frames={1}/>}
    <Fps onFps={props.onFps}/>
  </>;
}

function FurnitureAt({ kind,x,z,rotation=0,neonColor }: {kind:string;x:number;z:number;rotation?:number;neonColor?:string}) {return <group position={[x,0,z]} rotation={[0,rotation*Math.PI/180,0]}><Furniture kind={kind} neonColor={neonColor}/></group>;}

class WorldBoundary extends Component<{children:ReactNode;onInteract:WorldProps["onInteract"]},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="world-fallback"><span>NEON HAVEN</span><h2>Chế độ hiển thị 2D</h2><p>Thiết bị chưa mở được WebGL. Công việc, tài chính và quản gia vẫn sử dụng được.</p><button onClick={()=>this.props.onInteract("quests")}>Mở nhiệm vụ →</button></div>:this.props.children;}
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function readReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const serverReducedMotion = () => false;

export default function Apartment(props:WorldProps) {
  const systemReducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const reducedMotion = Boolean(props.reducedMotion || systemReducedMotion);
  // Do not create a probe WebGL context before R3F mounts its renderer. A
  // probe consumes one of the browser's limited context slots and can make the
  // real Canvas appear to hang at "Đang khởi tạo WebGL…" on constrained GPUs.
  // The Canvas fallback and WorldBoundary now own the unavailable path.
  return <WorldBoundary onInteract={props.onInteract}><Canvas shadows={props.quality!=="performance"} dpr={props.quality==="ultra"?[1,2]:props.quality==="performance"?1:[1,1.5]} gl={{antialias:true,powerPreference:"high-performance"}}><Suspense fallback={null}><ApartmentScene key={`${props.roomId??"living"}-${props.characterOnly?"character":"world"}`} {...props} reducedMotion={reducedMotion}/></Suspense></Canvas></WorldBoundary>;
}

