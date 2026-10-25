'use client';

import {Suspense, useEffect, useMemo, useRef} from 'react';
import {Canvas, useThree} from '@react-three/fiber';
import {OrbitControls, Environment, Lightformer} from '@react-three/drei';
import type {OrbitControls as OrbitType} from 'three-stdlib';
import * as THREE from 'three';
import {assets, type AssetId} from './asset-registry';
import {ApartmentCity} from '@/components/world/ApartmentCity';
import {HeroAssetModel} from '@/components/world/furniture-models';

type Props={view:AssetId|'benchmark'|'window';starter:boolean;orbit:boolean;ceiling:boolean;onReady:()=>void;onEngineReady:()=>void;onContextLost:()=>void};
function ContextMonitor({onContextLost}:{onContextLost:()=>void}){
 const {gl}=useThree();
 useEffect(()=>{const canvas=gl.domElement;canvas.addEventListener('webglcontextlost',onContextLost);return()=>canvas.removeEventListener('webglcontextlost',onContextLost);},[gl,onContextLost]);
 return null;
}
function Part({p,s,color='#201b1a',metal=.25,rough=.5,glow}:{p:[number,number,number];s:[number,number,number];color?:string;metal?:number;rough?:number;glow?:string}){
 return <mesh position={p} castShadow receiveShadow><boxGeometry args={s}/><meshStandardMaterial color={color} metalness={metal} roughness={rough} emissive={glow||'#000'} emissiveIntensity={glow?2.3:0}/></mesh>;
}
function woodTexture(){
 const n=1024; const c=document.createElement('canvas');c.width=n;c.height=n;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#574133';ctx.fillRect(0,0,n,n);
 let seed=18;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<3200;i++){const y=random()*n;ctx.strokeStyle=`rgba(${random()>.5?'22,12,6':'153,113,74'},${.025+random()*.15})`;ctx.lineWidth=.4+random()*1.4;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=n;x+=24)ctx.lineTo(x,y+Math.sin(x*.008+i)*(.4+random()*3));ctx.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,.3);t.anisotropy=8;return t;
}
function Shell({ceiling}:{ceiling:boolean}){
 const wood=useMemo(()=>woodTexture(),[]);
 useEffect(()=>()=>wood.dispose(),[wood]);
 return <group>
   <Part p={[0,-.2,0]} s={[12.3,.4,10.3]} color="#191a20"/>
   {Array.from({length:40},(_,row)=>Array.from({length:5},(_,col)=>{
    const offset=(row%2)*1.5;const x=-9+col*3+offset;
    const start=Math.max(-6,x),end=Math.min(6,x+3);
    return end>start?<mesh key={`${row}-${col}`} position={[(start+end)/2,.014,-4.875+row*.25]} receiveShadow><boxGeometry args={[end-start-.012,.028,.242]}/><meshStandardMaterial color={['#b3a093','#a89383','#bca494','#a68f7b'][row%4]} map={wood} roughness={.32} metalness={.04}/></mesh>:null;
   }))}
   {/* Full rear wall for bedroom, glazed panorama on the right and side. */}
   <Part p={[-3.7,1.6,-5]} s={[4.6,3.2,.18]} color="#35261f" rough={.64}/>
   <Part p={[-6,1.6,0]} s={[.2,3.2,10]} color="#2d211c" rough={.6}/>
   {Array.from({length:45},(_,i)=><Part key={i} p={[-5.92+i*.10,1.65,-4.88]} s={[.045,2.96,.045]} color={i%3?'#4a3122':'#32241d'} rough={.6}/>)}
   {Array.from({length:10},(_,i)=><group key={i}><Part p={[-5.87,1.6,-4.5+i]} s={[.035,3.05,.018]} color="#947557" metal={.8}/><Part p={[-5.87,.12,-4.5+i]} s={[.025,.035,.96]} color="#ffd08e" glow="#ffa545"/></group>)}
   <Part p={[-5.86,1.25,-3.15]} s={[.07,2.5,1.05]} color="#161717"/>
   <Part p={[-5.81,1.15,-2.78]} s={[.03,.25,.028]} color="#c1a373" metal={.9}/>
   {[-1.4,.45,2.3,4.15,6].map(x=><Part key={x} p={[x,1.6,-5]} s={[.065,3.2,.12]} color="#24262b" metal={.85}/>)}
   {[-5,-3,-1,1,3,5].map(z=><Part key={z} p={[6,1.6,z]} s={[.1,3.2,.065]} color="#202229" metal={.8}/>)}
   <mesh position={[2.3,1.6,-5.015]}><boxGeometry args={[7.4,3.15,.025]}/><meshPhysicalMaterial color="#a6b5d4" transparent opacity={.1} metalness={.15} roughness={.07} depthWrite={false}/></mesh>
   <mesh position={[6.015,1.6,0]}><boxGeometry args={[.025,3.15,10]}/><meshPhysicalMaterial color="#a6b5d4" transparent opacity={.08} roughness={.07} depthWrite={false}/></mesh>
   {[-5,5].map(z=><group key={z}><Part p={[0,3.16,z]} s={[12.2,.22,.24]} color="#191b22"/><Part p={[0,.1,z]} s={[12.1,.1,.16]} color="#28201c" metal={.75}/></group>)}
   <Part p={[-3.7,3,-4.8]} s={[4.5,.025,.04]} glow="#ffc17c" color="#ffc17c"/>
   <Part p={[-5.78,3,0]} s={[.04,.025,9.7]} glow="#ffc17c" color="#ffc17c"/>
   <Part p={[6,3.16,0]} s={[.24,.22,10.1]} color="#191b22"/>
   <Part p={[6,.1,0]} s={[.16,.1,10.1]} color="#302820"/>
   {/* Bathroom enclosure: glazed front with real mullions and stone floor. */}
   <Part p={[4.5,.04,3.75]} s={[2.8,.08,2.35]} color="#3b332b" rough={.26}/>
   <Part p={[4.5,1.35,4.92]} s={[2.8,2.7,.12]} color="#29241f" rough={.6}/>
   <Part p={[3.1,1.35,3.75]} s={[.1,2.7,2.35]} color="#202329"/>
   <mesh position={[4.5,1.35,2.55]}><boxGeometry args={[2.7,2.65,.025]}/><meshPhysicalMaterial color="#a5b4b7" transparent opacity={.13} roughness={.09} depthWrite={false}/></mesh>
   {[3.1,4.5,5.9].map(x=><Part key={x} p={[x,1.35,2.55]} s={[.035,2.7,.04]} color="#b29668" metal={.8}/>)}
   <Part p={[4.5,2.72,2.55]} s={[2.9,.12,.14]} color="#242329"/>
   {ceiling&&<Part p={[0,3.3,0]} s={[12.2,.24,10.2]} color="#302a26" rough={.8}/>}
   {/* Floor-8 facade retains adjoining slabs and structure below the cutaway. */}
   {[-3.4,-6.8,-10.2].map(y=><group key={y}><Part p={[0,y,0]} s={[12.3,.25,10.3]} color="#202028"/>{[-6,6].flatMap(x=>[-5,0,5].map(z=><Part key={`${x}-${z}`} p={[x,y+1.6,z]} s={[.22,3.2,.22]} color="#27252a"/>))}<Part p={[0,y+.4,5.03]} s={[11.8,.03,.03]} color="#ffcc87" glow="#ffcc87"/></group>)}
 </group>;
}
function Model({id,position,rotation}:{id:AssetId;position?:[number,number,number];rotation?:number}){
 const spec = assets[id];
 return <group position={position ?? spec.position} rotation={[0, rotation ?? ("rotation" in spec ? spec.rotation : 0), 0]}><HeroAssetModel id={id} /></group>;
}
function Rug({p,w,d}:{p:[number,number,number];w:number;d:number}){
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!;const im=ctx.createImageData(512,512);let seed=81;for(let i=0;i<im.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=seed/4294967296;im.data[i]=76+n*73;im.data[i+1]=67+n*66;im.data[i+2]=58+n*60;im.data[i+3]=255;}ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);return t;},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={p} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[w,d]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>;
}
function Camera({view,orbit}:{view:Props['view'];orbit:boolean}){
 const {camera,size}=useThree();const controls=useRef<OrbitType>(null);
 // R3F exposes the active camera as an imperative Three.js object; moving it is the camera rig's purpose.
 // eslint-disable-next-line react-hooks/immutability
 useEffect(()=>{
  const p=new THREE.Vector3(12,11,15),target=new THREE.Vector3(0,.5,0);
  if(view==='window'){p.set(-1.2,1.65,-.8);target.set(4,1.8,-14);}
  else if(view!=='benchmark'){const a=assets[view].position;target.set(a[0],.65,a[2]);p.copy(target).add(new THREE.Vector3(3.6,2.3,4.3));}
  camera.position.copy(p);camera.lookAt(target);
  // eslint-disable-next-line react-hooks/immutability
  if(camera instanceof THREE.PerspectiveCamera){camera.fov=view==='benchmark'?42:47;camera.updateProjectionMatrix();}
  controls.current?.target.copy(target);controls.current?.update();
 },[camera,view,size.width,size.height]);
 return <OrbitControls ref={controls} enabled={orbit} enableDamping minDistance={1} maxDistance={45} maxPolarAngle={Math.PI*.48}/>;
}
function Interior({starter,onReady}:{starter:boolean;onReady:()=>void}){
 useEffect(()=>onReady(),[onReady]);
 return <group>
  <Rug p={[-2.8,.034,-3.2]} w={3.8} d={3.3}/><Model id="bed"/><Model id="wardrobe"/><Model id="desk"/><Model id="chair"/><Model id="plant"/>
  {!starter&&<><Rug p={[.5,.034,2]} w={4.6} d={3.8}/><Model id="sofa"/><Model id="coffee"/><Model id="kitchen"/><Model id="stool"/><Model id="stool" position={[-2.9,0,1.8]} rotation={Math.PI}/><Model id="bathroom"/><Model id="plant" position={[-1.7,0,3.8]}/><Model id="plant" position={[5.3,0,-.4]}/><Model id="lamp"/><Model id="lamp" position={[-.8,0,-3.4]}/></>}
 </group>;
}
export default function Scene(props:Props){return <Canvas onCreated={props.onEngineReady} fallback={<div className="v18-loading" role="alert">Trình duyệt chưa hỗ trợ WebGL. Hãy bật tăng tốc đồ họa trong cài đặt trình duyệt.</div>} shadows dpr={[1,1.75]} camera={{position:[14,13,18],fov:42,near:.05,far:650}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.05,preserveDrawingBuffer:true}}>
 <ContextMonitor onContextLost={props.onContextLost}/>
 <color attach="background" args={['#101025']}/><fog attach="fog" args={['#14122b',65,240]}/>
 <ambientLight intensity={.22} color="#c9b5db"/><hemisphereLight args={['#7278ad','#392b20',.45]}/>
 <directionalLight position={[0,8,5]} color="#ffcf97" intensity={1.6} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.035}/>
 <Environment resolution={128} frames={1}><Lightformer form="rect" intensity={2} color="#a5a4df" scale={[12,5,1]} position={[4,4,-12]}/><Lightformer form="rect" intensity={1.7} color="#ffc78c" scale={[8,4,1]} position={[-3,5,3]} rotation={[Math.PI/2,0,0]}/></Environment>
 <Shell ceiling={props.ceiling}/><group position={[0,24.2,0]}><ApartmentCity/></group>
 <Suspense fallback={null}><Interior starter={props.starter} onReady={props.onReady}/></Suspense>
 {[[-4.25,1.15,-3.9],[-1.35,1.15,-3.9],[3.8,1.7,-3.7],[-4,2.7,.8],[0,2.7,2.5],[4.4,2.4,3.8]].map((p,i)=><pointLight key={i} position={p as [number,number,number]} color="#ffbd78" intensity={i<2?10:17} distance={6} decay={2}/>)}
 <pointLight position={[5,3,-7]} color="#b76cff" intensity={55} distance={17}/>
 <Camera view={props.view} orbit={props.orbit}/>
 </Canvas>;}
