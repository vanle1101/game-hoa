"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import PetModel from "./PetModel";

export type PetShowcaseProps={id?:string;petId?:string;accessoryColor?:string;quality?:string;reducedMotion?:boolean;className?:string;onClick?:()=>void};
class PetBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<div role="status" style={{padding:24,color:"#94a6bb"}}>Bản xem 3D chưa khả dụng trên thiết bị này.</div>:this.props.children;}}
export default function PetShowcase({id,petId,accessoryColor,quality="balanced",reducedMotion=false,className,onClick}:PetShowcaseProps){
  const selected=id??petId??"neko",low=quality==="performance";
  return <div className={className} style={{height:300,minHeight:180,width:"100%",overflow:"hidden",borderRadius:12,background:"radial-gradient(ellipse at center,#213047,#0b1421 72%)"}} aria-label={`Mô hình 3D ${selected==="drone"?"Orbit Companion":selected==="fox"?"Neon Fox":"Cyber Neko"}`} onClick={onClick}><PetBoundary><Canvas shadows={!low} dpr={low?1:[1,1.5]} camera={{position:[1.35,.94,1.7],fov:32}} gl={{antialias:!low,powerPreference:"high-performance"}}><Suspense fallback={null}>
    <ambientLight intensity={.9}/><hemisphereLight args={["#b9d8f3","#202338",1.3]}/><directionalLight position={[2,4,3]} color="#e2ecff" intensity={2.5} castShadow={!low}/><pointLight position={[-2,1,-1]} color="#a58bcb" intensity={4}/>
    <group rotation={[0,-.15,0]}><PetModel id={selected} accessoryColor={accessoryColor} animated={!reducedMotion}/></group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.012,0]} receiveShadow><circleGeometry args={[.59,48]}/><meshStandardMaterial color="#1a2739" metalness={.5} roughness={.4}/></mesh>
    {!low&&<ContactShadows position={[0,-.005,0]} opacity={.5} scale={2.5} blur={2.6} far={1.3} resolution={128} frames={1}/>}
    <OrbitControls target={[0,.33,0]} enablePan={false} minDistance={1.3} maxDistance={4} maxPolarAngle={Math.PI*.49}/>
  </Suspense></Canvas></PetBoundary></div>;
}
