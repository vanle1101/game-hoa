"use client";

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DISTRICT_GROUND_Y } from './district-layout';

/** A deliberately surveyed far-bank kit. The floorplates are authored as
 * polygons, rather than scaled copies of the same office box. These towers
 * fill the gap between the quayside and the landmark GLBs without blocking
 * the apartment's near panorama. All dimensions are in world metres. */
const FAR_BANK: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-224,-205,12,13,54,0],[-205,-218,9,11,73,2],[-188,-205,11,10,46,4],
  [-146,-213,13,12,66,1],[-127,-203,8,11,44,3],[-110,-218,11,11,79,0],
  [-91,-205,9,13,53,4],[-72,-216,12,10,68,2],[-53,-203,8,10,41,3],
  [-34,-222,12,13,84,1],[-15,-202,9,11,51,0],[4,-218,12,12,70,4],
  [25,-204,10,11,45,2],[44,-225,11,13,77,1],[95,-215,12,13,57,3],
  [168,-230,9,10,89,2],
  [-235,-261,13,12,82,4],[-215,-277,10,11,108,1],[-191,-264,12,14,93,3],
  [-137,-273,10,13,111,0],[-117,-259,9,12,78,2],[-88,-274,11,12,104,4],
  [-68,-258,9,10,80,1],[-21,-268,12,12,101,3],[27,-272,11,13,109,0],
  [62,-261,10,11,86,4],[102,-276,12,13,99,2],[153,-266,11,11,95,1],
];

type TowerSpec = { x:number; z:number; w:number; d:number; h:number; type:number };

function footprint(w:number,d:number,type:number): [number,number][] {
  const a=w/2,b=d/2;
  switch(type){
    case 0: return [[-a*.7,-b], [a*.7,-b], [a,-b*.7], [a,b*.7], [a*.7,b], [-a*.7,b], [-a,b*.7], [-a,-b*.7]];
    case 1: return [[-a,-b],[-a*.2,-b],[-a*.2,-b*.53],[a,-b*.53],[a,b*.53],[-a*.2,b*.53],[-a*.2,b],[-a,b]];
    case 2: return [[0,-b],[a,-b*.52],[a*.72,b*.72],[0,b],[-a*.72,b*.72],[-a,-b*.52]];
    case 3: return [[-a,-b*.6],[-a*.55,-b],[a*.55,-b],[a,-b*.6],[a,b*.6],[a*.55,b],[-a*.55,b],[-a,b*.6]];
    default: return [[-a,-b], [0,-b*.7], [a,-b], [a,b], [0,b*.7], [-a,b]];
  }
}

function floorplate(points:[number,number][],height:number){
  const shape=new THREE.Shape();
  points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1});
  geometry.rotateX(-Math.PI/2);
  geometry.computeVertexNormals();
  return geometry;
}

function seededLight(tower:number,floor:number,side:number,bay:number){
  const seed=Math.sin(tower*101.71+floor*37.13+side*19.17+bay*71.41)*43758.5453;
  return seed-Math.floor(seed);
}

const paneMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false,side:THREE.DoubleSide,fog:false});
const paneGeometry=new THREE.PlaneGeometry(1,1);

function WindowBays({towers}:{towers:TowerSpec[]}){
  const windows=useMemo(()=>{
    const result:{x:number;y:number;z:number;angle:number;color:string;w:number;h:number}[]=[];
    const palette=['#f6ba87','#79dbe9','#d67bf2','#f2c6d7','#cf9bff'];
    towers.forEach((tower,index)=>{
      const outline=footprint(tower.w,tower.d,tower.type);
      const floors=Math.floor(tower.h/3.25);
      for(let side=0;side<outline.length;side++){
        const [ax,az]=outline[side], [bx,bz]=outline[(side+1)%outline.length];
        const length=Math.hypot(bx-ax,bz-az);
        const bays=Math.max(1,Math.floor(length/2.25));
        const nx=(bz-az)/length,nz=-(bx-ax)/length;
        const angle=Math.atan2(nx,nz);
        for(let floor=1;floor<floors-1;floor++)for(let bay=0;bay<bays;bay++){
          const lit=seededLight(index,floor,side,bay);
          if(lit<.42)continue;
          const t=(bay+.5)/bays;
          result.push({
            x:tower.x+ax+(bx-ax)*t+nx*.06,
            y:DISTRICT_GROUND_Y+floor*3.25+1.7,
            z:tower.z+az+(bz-az)*t+nz*.06,
            angle,color:palette[Math.floor(lit*palette.length)%palette.length],
            w:Math.min(1.12,length/bays*.52),h:lit>.94?1.5:1.13,
          });
        }
      }
    });
    return result;
  },[towers]);
  const mesh=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    const target=mesh.current;if(!target)return;
    const object=new THREE.Object3D();const color=new THREE.Color();
    windows.forEach((window,index)=>{
      object.position.set(window.x,window.y,window.z);
      object.rotation.set(0,window.angle,0);
      object.scale.set(window.w,window.h,1);
      object.updateMatrix();target.setMatrixAt(index,object.matrix);
      color.set(window.color);target.setColorAt(index,color);
    });
    target.instanceMatrix.needsUpdate=true;
    if(target.instanceColor)target.instanceColor.needsUpdate=true;
    target.computeBoundingSphere();
  },[windows]);
  return <instancedMesh name="district07-far-bank-lit-apartments" ref={mesh} args={[paneGeometry,paneMaterial,windows.length]} raycast={()=>{}} dispose={null} />;
}

export function DistrictSkyline(){
  const towers=useMemo(()=>FAR_BANK.map(([x,z,w,d,h,type])=>({x,z,w,d,h,type})),[]);
  return <group name="district07-sculpted-far-bank">
    {towers.map((tower,index)=>{
      const outline=footprint(tower.w,tower.d,tower.type);
      const crown=footprint(tower.w*.71,tower.d*.71,tower.type);
      const setback=tower.h*(tower.type%2===0?.82:.76);
      return <group key={index} position={[tower.x,DISTRICT_GROUND_Y,tower.z]}>
        <mesh geometry={floorplate(outline,setback)} receiveShadow raycast={()=>{}}>
          <meshStandardMaterial color={index%3===0?'#15243d':index%3===1?'#1b2540':'#22283c'} roughness={.53} metalness={.51} emissive="#172248" emissiveIntensity={.28} fog={false}/>
        </mesh>
        <mesh position={[0,setback,0]} geometry={floorplate(crown,tower.h-setback)} raycast={()=>{}}>
          <meshStandardMaterial color={index%2===0?'#23344f':'#273049'} roughness={.38} metalness={.68} emissive="#29224f" emissiveIntensity={.31} fog={false}/>
        </mesh>
        <mesh position={[0,setback+.07,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}>
          <ringGeometry args={[Math.max(tower.w,tower.d)*.35,Math.max(tower.w,tower.d)*.38,8]}/>
          <meshBasicMaterial color={index%4===0?'#9d61ed':'#62b5d6'} toneMapped={false} side={THREE.DoubleSide}/>
        </mesh>
        {tower.h>85&&<mesh position={[0,tower.h+2.5,0]} raycast={()=>{}}>
          <cylinderGeometry args={[.06,.11,5,5]}/>
          <meshBasicMaterial color={index%2===0?'#bb67f3':'#73c9e5'} toneMapped={false}/>
        </mesh>}
      </group>;
    })}
    <WindowBays towers={towers}/>
  </group>;
}
