"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";

export type PetModelProps={id?:string;accessoryColor?:string;animated?:boolean};
type Vec=[number,number,number];
const SHELL=new THREE.SphereGeometry(1,20,14),PANEL=new RoundedBoxGeometry(1,1,1,2,.16),EAR=new THREE.ConeGeometry(1,1,4,1);
function Shell({at,size,color="#344353",rotation,flat=false,glow=false,metal=.65}:{at:Vec;size:Vec;color?:string;rotation?:Vec;flat?:boolean;glow?:boolean;metal?:number}){return <mesh position={at} scale={size} rotation={rotation} geometry={flat?PANEL:SHELL} dispose={null} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metal} roughness={glow?.25:.36} emissive={glow?color:"black"} emissiveIntensity={glow?1.2:0}/></mesh>;}
function Tip({at,size,color,rotation}:{at:Vec;size:Vec;color:string;rotation?:Vec}){return <mesh position={at} scale={size} rotation={rotation} geometry={EAR} dispose={null} castShadow><meshStandardMaterial color={color} metalness={.5} roughness={.4}/></mesh>;}
function Ring({at,radius,color,rotation=[Math.PI/2,0,0],width=.009}:{at:Vec;radius:number;color:string;rotation?:Vec;width?:number}){return <mesh position={at} rotation={rotation}><torusGeometry args={[radius,width,6,32]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.8} metalness={.5} roughness={.3}/></mesh>;}

function Drone({accessoryColor,animated=true}:Omit<PetModelProps,"id">){
  const body=useRef<THREE.Group>(null),orbit=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(body.current){body.current.position.y=.57+(animated?Math.sin(clock.elapsedTime*1.7)*.04:0);body.current.rotation.z=animated?Math.sin(clock.elapsedTime*.9)*.035:0;}if(orbit.current&&animated)orbit.current.rotation.y=clock.elapsedTime*.35;});
  return <group ref={body} position={[0,.57,0]}>
    <Shell at={[0,0,0]} size={[.225,.145,.17]} color="#a6b4bf"/>
    <Shell at={[0,-.005,.135]} size={[.32,.115,.065]} color="#101f2c" flat/>
    {[-1,1].map(side=><group key={side}><Shell at={[side*.066,.005,.173]} size={[.026,.032,.012]} color="#70e5e8" glow metal={0}/><Shell at={[side*.258,-.025,0]} size={[.074,.045,.1]} color="#2a3b4b"/><Tip at={[side*.3,-.055,-.012]} size={[.07,.12,.05]} color="#768c9c" rotation={[0,0,side*.85]}/><Ring at={[side*.258,-.066,0]} radius={.047} color="#6bcbd9"/></group>)}
    <Shell at={[0,.125,0]} size={[.14,.033,.1]} color="#263a4b"/><Ring at={[0,.137,0]} radius={.087} color="#64cbd8"/>
    <Shell at={[0,.174,0]} size={[.009,.035,.009]} color="#8ddae4" glow/><Shell at={[0,-.131,0]} size={[.075,.028,.065]} color="#172c3d"/>
    <Ring at={[0,-.157,0]} radius={.05} color="#70cbd8"/>
    <group ref={orbit}>{accessoryColor&&<Ring at={[0,.015,0]} radius={.34} width={.012} color={accessoryColor} rotation={[.45,0,.2]}/>}</group>
    {[-.065,0,.065].map(x=><Shell key={x} at={[x,-.062,.176]} size={[.028,.004,.005]} color="#67818c" flat/>)}
  </group>;
}
function Animal({fox,accessoryColor,animated=true}:{fox:boolean}&Omit<PetModelProps,"id">){
  const head=useRef<THREE.Group>(null),tail=useRef<THREE.Group>(null);
  const shell=fox?"#a5a6ba":"#263747",secondary=fox?"#4b4262":"#526574",accent=fox?"#ab92e7":"#69d4de";
  useFrame(({clock})=>{if(head.current)head.current.rotation.y=animated?Math.sin(clock.elapsedTime*.8)*.065:0;if(tail.current)tail.current.rotation.z=animated?Math.sin(clock.elapsedTime*1.8)*.09:0;});
  return <group>
    <Shell at={[0,.255,-.04]} size={[fox?.115:.13,fox?.12:.15,fox?.21:.18]} color={shell}/>
    <Shell at={[0,.328,.075]} size={[.105,.13,.1]} color={shell}/>
    <Shell at={[0,.275,.163]} size={[.074,.09,.025]} color={secondary}/>
    {[-1,1].flatMap(side=>[-1,1].map(front=><group key={`${side}-${front}`} position={[side*(fox?.085:.092),0,front*.13-.025]}>
      <Shell at={[0,.164,0]} size={[.045,.094,.052]} color={secondary}/><Shell at={[0,.095,.012]} size={[.026,.072,.029]} color={shell}/>
      <Shell at={[0,.032,.035]} size={[.047,.03,.066]} color={shell}/><Shell at={[0,.068,.036]} size={[.026,.016,.009]} color={accent} glow/>
      {[-1,1].map(toe=><Shell key={toe} at={[toe*.014,.026,.088]} size={[.006,.008,.007]} color="#c0ced5"/>)}
    </group>))}
    <group ref={head} position={[0,.43,.13]}>
      <Shell at={[0,0,0]} size={[fox?.117:.136,fox?.104:.115,.113]} color={shell}/>
      {[-1,1].map(side=><group key={side}>
        <Tip at={[side*.092,fox?.127:.102,-.015]} size={[fox?.06:.057,fox?.19:.125,.044]} color={secondary} rotation={[0,Math.PI/4,side*-.16]}/>
        <Tip at={[side*.092,fox?.128:.104,.011]} size={[.035,fox?.13:.08,.011]} color={accent} rotation={[0,Math.PI/4,side*-.16]}/>
        <Shell at={[side*.056,.008,.094]} size={[.044,fox?.027:.035,.016]} color="#122230" rotation={[0,side*.1,-side*(fox?.14:0)]}/>
        <Shell at={[side*.056,.01,.108]} size={[fox?.019:.021,fox?.018:.023,.007]} color={accent} glow metal={0}/><Shell at={[side*.056,.01,.115]} size={[.005,.015,.003]} color="#091521"/>
        <Shell at={[side*.097,-.041,.074]} size={[.024,.016,.017]} color={secondary}/>
        {fox&&<Tip at={[side*.108,-.034,.014]} size={[.04,.08,.035]} color={shell} rotation={[0,0,side*1.7]}/>}
      </group>)}
      <Shell at={[0,-.039,.112]} size={[fox?.054:.057,.035,fox?.088:.038]} color={fox?"#d0cbd4":"#aab7bb"}/>
      <Shell at={[0,-.025,fox?.192:.148]} size={[.018,.012,.013]} color="#152632"/>
      <Shell at={[0,-.064,fox?.151:.134]} size={[.02,.003,.009]} color="#344455"/>
      <Shell at={[0,.071,.088]} size={[.012,.025,.006]} color={accent} glow/>
    </group>
    <group ref={tail} position={[0,.29,-.196]}>
      {fox?<><Shell at={[.075,.062,-.085]} size={[.085,.078,.16]} color={secondary} rotation={[-.35,-.4,0]}/><Shell at={[.126,.155,-.18]} size={[.073,.125,.078]} color={shell} rotation={[-.6,0,-.25]}/><Tip at={[.105,.276,-.232]} size={[.071,.15,.06]} color="#c6b0ec" rotation={[-.6,0,-.25]}/></>:<><Shell at={[.06,.08,-.08]} size={[.034,.1,.036]} color={secondary} rotation={[-.55,0,-.6]}/><Shell at={[.12,.185,-.1]} size={[.03,.065,.03]} color={shell} rotation={[0,0,-.15]}/><Shell at={[.11,.239,-.08]} size={[.03,.025,.04]} color={accent}/></>}
    </group>
    {accessoryColor&&<><Ring at={[0,.349,.105]} radius={.108} color={accessoryColor}/><Shell at={[0,.31,.202]} size={[.025,.03,.009]} color={accessoryColor} glow/></>}
    <Shell at={[0,.31,.19]} size={[.022,.027,.008]} color={accent} glow/>
  </group>;
}

/** Companion meshes stay inside a single 1m floor cell. Facing +Z, feet at y=0. */
export default function PetModel({id="neko",accessoryColor,animated=true}:PetModelProps){return id==="drone"?<Drone accessoryColor={accessoryColor} animated={animated}/>:<Animal fox={id==="fox"} accessoryColor={accessoryColor} animated={animated}/>;}
