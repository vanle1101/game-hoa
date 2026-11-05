"use client";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CharacterModel, type CharacterAnimation, type ModelCharacter } from "../world/CharacterModel";
import { sampleCombat } from "./simulation";
import { combatFraming } from "./framing";
import { BossModel } from "./BossModel";

type Props={character:ModelCharacter;equipment?:Partial<Record<string,string>>;weaponId?:string;theme:string;progress:number;eventId?:string;quality:string;reducedMotion:boolean;paused:boolean};
type Vec=[number,number,number];
const plateShape=new THREE.Shape([new THREE.Vector2(-.4,-.5),new THREE.Vector2(.32,-.5),new THREE.Vector2(.5,-.24),new THREE.Vector2(.36,.4),new THREE.Vector2(0,.5),new THREE.Vector2(-.5,.26)]);
const plateGeometry=new THREE.ExtrudeGeometry(plateShape,{depth:.7,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.09,bevelThickness:.12});plateGeometry.center();
function Armor({position,scale,rotation,color="#384359"}:{position:Vec;scale:Vec;rotation?:Vec;color?:string}){return <mesh position={position} scale={scale} geometry={plateGeometry} dispose={null} rotation={rotation} castShadow><meshStandardMaterial color={color} metalness={.55} roughness={.43}/></mesh>;}
function Boss({theme,progress}:{theme:string;progress:number}){
 return <BossModel theme={theme} progress={progress}/>;
}
function Stage(){return <group>
 <mesh position={[0,-.3,0]} receiveShadow><cylinderGeometry args={[6.7,6.9,.6,8]}/><meshStandardMaterial color="#111b2d" emissive="#101746" emissiveIntensity={.42} metalness={.65} roughness={.36}/></mesh>
 {[4.9,5.9,6.5].map((r,i)=><mesh key={r} rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><torusGeometry args={[r,i===1?.04:.018,6,96]}/><meshStandardMaterial color={i===1?"#9067ff":"#32e6f4"} emissive={i===1?"#9067ff":"#32e6f4"} emissiveIntensity={2.5}/></mesh>)}
 {Array.from({length:12},(_,i)=><group key={i} rotation={[0,i*Math.PI/6,0]}><mesh position={[0,.014,3.6]}><boxGeometry args={[.015,.01,3.8]}/><meshStandardMaterial color="#314157"/></mesh><Armor position={[0,.17,6.4]} scale={[.45,.34,.6]}/></group>)}
 {Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2,r=13+(i%3)*2,h=3+(i*7%11);return <group key={i} position={[Math.sin(a)*r,-3,Math.cos(a)*r]}><mesh position={[0,h/2,0]}><boxGeometry args={[1.2,h,1.5]}/><meshStandardMaterial color={i%2?"#122034":"#1b2139"} emissive={i%2?"#071b32":"#180b2d"} emissiveIntensity={.48} metalness={.6} roughness={.4}/></mesh>{[0,1,2].map(j=><mesh key={j} position={[.2*j-.3,h/2,.76]}><boxGeometry args={[.045,h*.72,.02]}/><meshStandardMaterial color={i%3?"#227e99":"#9b367c"} emissive={i%3?"#227e99":"#9b367c"} emissiveIntensity={1.25}/></mesh>)}</group>;})}
 </group>;}
function Scene(props:Props){
 const { camera, size } = useThree();
 const framing = useMemo(() => combatFraming(size.width / Math.max(1, size.height)), [size.width, size.height]);
 useEffect(() => { camera.position.copy(framing.position); camera.lookAt(framing.target); camera.updateProjectionMatrix(); }, [camera, framing]);
 const player=useRef<THREE.Group>(null),boss=useRef<THREE.Group>(null),slash=useRef<THREE.Mesh>(null),animation=useRef<CharacterAnimation>("idle");
 const elapsed=useRef(0),lastEvent=useRef(props.eventId),eventAt=useRef(-100);
 useFrame(({camera},delta)=>{
  if(!props.paused)elapsed.current+=Math.min(delta,.05);
  if(lastEvent.current!==props.eventId){lastEvent.current=props.eventId;eventAt.current=elapsed.current;}
  const pose=sampleCombat(elapsed.current,{paused:props.paused,reducedMotion:props.reducedMotion,defeated:props.progress>=100,progressAge:elapsed.current-eventAt.current});
  animation.current=pose.motion;
  if(player.current){player.current.position.set(pose.playerX-.32,0,pose.playerZ+2);player.current.rotation.y=2.1;}
  if(boss.current){boss.current.rotation.z=pose.bossLean;boss.current.position.y=props.reducedMotion||props.paused?-.3:-.3+Math.sin(elapsed.current*1.5)*.035;}
  if(slash.current){slash.current.visible=!props.paused&&pose.impact>0;slash.current.scale.setScalar(.6+pose.impact*.5);slash.current.rotation.z=pose.weaponArc;}
  if(!props.paused&&!props.reducedMotion){camera.position.x=THREE.MathUtils.damp(camera.position.x,framing.position.x+Math.sin(elapsed.current*.12)*.3,1,delta);}
 });
 return <><fog attach="fog" args={["#080d18",18,45]}/><ambientLight intensity={1.1}/><hemisphereLight args={["#b5ccff","#161022",1.4]}/><directionalLight position={[-3,8,6]} intensity={3.2} color="#accbff" castShadow shadow-mapSize={[1024,1024]}/><pointLight position={[-4,3,2]} intensity={22} color="#32e6f4" distance={11}/><pointLight position={[3,3,-2]} intensity={28} color="#b251ff" distance={12}/><Stage/><group ref={boss} position={[-2.85,-.3,2.5]} scale={[1.33,1.9,1.22]}><Boss theme={props.theme} progress={props.progress}/></group><group ref={player} scale={[1.1,1.02,1.02]}><CharacterModel character={props.character} equipment={props.equipment} weaponId={props.weaponId} animationRef={animation} paused={props.paused||props.reducedMotion}/></group><mesh ref={slash} position={[-.65,1.3,.9]} rotation={[0,.4,0]}><torusGeometry args={[.6,.025,6,32,Math.PI*1.3]}/><meshBasicMaterial color="#a8f5ff" transparent opacity={.8}/></mesh><OrbitControls target={framing.target} enablePan={false} minDistance={7} maxDistance={Math.max(15,framing.distance*1.25)} minPolarAngle={.7} maxPolarAngle={1.4} enableDamping enableRotate={props.paused}/></>;
}
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="combat-fallback">Không thể khởi tạo 3D trên thiết bị này. Nhiệm vụ và tiến độ vẫn hoạt động bên dưới.</div>:this.props.children;}}
export default function CombatWorld(props:Props){const [hidden,setHidden]=useState(false);useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener("visibilitychange",update);return()=>document.removeEventListener("visibilitychange",update);},[]);const low=props.quality==="performance";return <Boundary><Canvas shadows={!low} dpr={low?1:[1,1.5]} camera={{position:[7,4.2,8],fov:43}} frameloop={hidden?"never":"always"} gl={{alpha:true,antialias:!low,powerPreference:"high-performance"}}><Scene {...props} paused={props.paused||hidden}/></Canvas></Boundary>;}

