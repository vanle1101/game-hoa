"use client";

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { DISTRICT_GROUND_Y, WATERFRONT, NORTH_HARBOR } from './district-layout';

function WaterSurface({name,x,z,width,depth}:{name:string;x:number;z:number;width:number;depth:number}) {
  const material=useRef<THREE.ShaderMaterial>(null);
  useFrame(({clock})=>{if(material.current)material.current.uniforms.time.value=clock.elapsedTime;});
  return <mesh name={name} position={[x,DISTRICT_GROUND_Y-1.2,z]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}>
    <planeGeometry args={[width,depth,1,1]}/>
    <shaderMaterial ref={material} uniforms={{time:{value:0}}} depthWrite
      vertexShader={`varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`}
      fragmentShader={`varying vec2 vUv; varying vec3 vWorld; uniform float time;
      float reflectedTower(float x,float width){
        float shear=sin(vWorld.z*.71+time*.72)*.31+sin(vWorld.z*2.31-time*.45)*.14;
        float core=exp(-pow((vWorld.x-x+shear)/width,2.0));
        float glints=.42+.27*sin(vWorld.z*1.8+time*.65)+.18*sin(vWorld.z*5.8-time*.8);
        float grain=.72+.28*sin(vWorld.z*13.0+vWorld.x*2.0+time*.36);
        return core*clamp(glints*grain,.06,1.0);
      }
      void main(){
        // Long broken shore-to-shore reflections. World anchoring makes the
        // bright paths line up with actual buildings when the camera orbits.
        float ripple=sin(vWorld.z*2.3+vWorld.x*.13+time*.72)*.5+.5;
        float fine=pow(max(0.0,sin(vWorld.z*8.3-vWorld.x*.67-time*.42)),15.0);
        vec3 col=mix(vec3(.052,.033,.13),vec3(.16,.065,.27),ripple*.52);
        col+=vec3(.065,.09,.17)*fine;
        float harbor=step(vWorld.z,-49.5)*step(-186.0,vWorld.z);
        float farShore=exp(-pow((vWorld.z+185.0)/5.8,2.0))*harbor;
        float nearShore=exp(-pow((vWorld.z+50.0)/8.0,2.0))*harbor;
        col+=vec3(.31,.105,.41)*farShore*.76;
        col+=vec3(.10,.22,.35)*nearShore*.57;
        float violet=reflectedTower(-49.0,6.0)+reflectedTower(-137.0,5.0)+reflectedTower(-21.0,3.8);
        float cyan=reflectedTower(4.0,5.0)+reflectedTower(95.0,6.0)+reflectedTower(-88.0,4.2);
        float pink=reflectedTower(-110.0,5.0)+reflectedTower(44.0,5.0)+reflectedTower(168.0,5.0);
        col+=vec3(.62,.075,.82)*violet*.65;
        col+=vec3(.08,.64,.91)*cyan*.47;
        col+=vec3(.84,.13,.48)*pink*.34;
        // Waterfront strips and bridge lamps produce fine horizontal glints.
        float waveLine=pow(max(0.0,sin(vWorld.z*6.9+sin(vWorld.x*.18)*1.3-time*.5)),24.0);
        col+=vec3(.12,.12,.23)*waveLine*.42;
        float grazing=pow(1.0-abs(normalize(cameraPosition-vWorld).y),3.0);
        col+=vec3(.075,.058,.14)*grazing;
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}/>
  </mesh>;
}

export function CanalWater(){
  return <group name="district07-waterfront">
    <WaterSurface name="district07-canal-water" x={WATERFRONT.x} z={0} width={WATERFRONT.width} depth={WATERFRONT.length}/>
    <WaterSurface name="district07-north-harbor" x={NORTH_HARBOR.x} z={NORTH_HARBOR.z} width={NORTH_HARBOR.width} depth={NORTH_HARBOR.depth}/>
  </group>;
}
