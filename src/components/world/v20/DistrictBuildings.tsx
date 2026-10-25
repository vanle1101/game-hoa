"use client";
import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DISTRICT_GROUND_Y, DISTRICT_LOTS, type DistrictLot } from './district-layout';

/** Official Kenney Commercial City Kit 2.1, CC0. Original meshes and UVs retained.
 * Palette-based glazing gets lit apartment/office variation at night; masonry
 * remains physically lit. No duplicated box shell hiding the imported model. */
function Building({lot}:{lot:DistrictLot}){
  const {scene}=useGLTF(lot.asset!);
  const model=useMemo(()=>{
    const clone=scene.clone(true);
    const bounds=new THREE.Box3().setFromObject(clone);
    const size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    clone.position.set(-center.x,-bounds.min.y,-center.z);
    const materials:THREE.Material[]=[];
    clone.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      object.castShadow=false;
      object.receiveShadow=true;
      const convert=(source:THREE.Material)=>{
        const mat=(source as THREE.MeshStandardMaterial).clone();
        materials.push(mat);
        mat.roughness=.68;
        mat.metalness=.15;
        mat.fog=false; // Distance haze is applied below, independent of interior fog.
        mat.onBeforeCompile=shader=>{
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vDistrictWorld;');
          shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvDistrictWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vDistrictWorld;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
            // Kenney's CC0 city kit uses a bright palette atlas (white, lavender,
            // orange and cyan) for a toy daytime look. Treating blue as glass
            // alone left the white/lavender atlas islands untouched in Home.
            // Grade the complete atlas into dark titanium while retaining local
            // value changes that describe panels, mullions and roof trims.
            float districtSourceLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            float districtSourceMax=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);
            float districtSourceMin=min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);
            float districtSaturation=(districtSourceMax-districtSourceMin)/(districtSourceMax+.001);
            float districtWindowMask=smoothstep(.20,.39,districtSourceLuma)*(1.0-smoothstep(.48,.68,districtSourceLuma));
            districtWindowMask=max(districtWindowMask*smoothstep(.16,.52,districtSaturation),
              smoothstep(.28,.52,diffuseColor.b-diffuseColor.r)*.72);
            float districtPanelValue=smoothstep(.04,.92,districtSourceLuma);
            vec3 districtTitanium=mix(vec3(.012,.023,.045),vec3(.105,.15,.215),districtPanelValue);
            districtTitanium+=vec3(.014,.009,.028)*districtSaturation;
            vec3 districtGlass=mix(vec3(.018,.065,.105),vec3(.10,.20,.29),smoothstep(.10,.58,districtSourceLuma));
            diffuseColor.rgb=mix(districtTitanium,districtGlass,districtWindowMask*.62);
            float districtDepth=smoothstep(170.0,570.0,length(vDistrictWorld.xz));
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.065,.07,.14),districtDepth*.43);`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
            vec3 districtGrid=vDistrictWorld/vec3(2.7,3.1,2.7);
            vec3 cell=floor(districtGrid);
            vec3 bay=fract(districtGrid);
            vec3 faceNormal=normalize(cross(dFdx(vDistrictWorld),dFdy(vDistrictWorld)));
            float across=abs(faceNormal.z)>abs(faceNormal.x)?bay.x:bay.z;
            // Recessed individual windows separated by spandrels and mullions.
            // Only vertical glazing receives interior light, never roof panels.
            float pane=step(.14,across)*(1.0-step(.86,across))*step(.18,bay.y)*(1.0-step(.84,bay.y))*(1.0-step(.35,abs(faceNormal.y)));
            float occupied=fract(sin(dot(cell,vec3(12.9898,78.233,39.425)))*43758.5453);
            vec3 windowLight = occupied < .30 ? vec3(.09,.66,.92) :
              occupied < .67 ? vec3(1.0,.18,.68) : vec3(1.0,.46,.16);
            // The GLB palette atlas contains material swatches, not a window
            // texture. It cannot gate every lit bay or most towers vanish at
            // night. Keep the imported facade silhouette and panel UVs, then
            // light a sparse subset of its vertical bays in world space.
            float districtScale=${lot.zone === 'skyline' ? '1.35' : lot.zone === 'commercial' ? '.82' : '.60'};
            totalEmissiveRadiance+=(districtWindowMask*.68+.24)*windowLight*step(.48,occupied)*pane*1.56*districtScale;
            float crownHeight=fract(vDistrictWorld.y/19.0);
            float crownLine=(1.0-smoothstep(.015,.075,crownHeight))*(1.0-step(.35,abs(faceNormal.y)));
            totalEmissiveRadiance+=vec3(.21,.10,.37)*crownLine*${lot.zone === 'skyline' ? '.54' : '.10'};
            float distanceHaze=clamp(length(vDistrictWorld.xz)/420.0,0.0,.52);
            totalEmissiveRadiance+=vec3(.055,.04,.12)*distanceHaze;
          `);
        };
        mat.customProgramCacheKey=()=> `district-v21-kenney-night-${lot.zone}`;
        return mat;
      };
      object.material=Array.isArray(object.material)?object.material.map(convert):convert(object.material);
    });
    // Uniform horizontal scaling preserves each model's distinctive floorplan;
    // height is normalized independently to the surveyed number of floors.
    const footprintScale=Math.min(lot.width/size.x,lot.depth/size.z);
    return {clone,materials,scale:[footprintScale,lot.height/size.y,footprintScale] as [number,number,number]};
  },[scene,lot]);
  useEffect(()=>()=>model.materials.forEach(material=>material.dispose()),[model]);
  return <group name={`district07-${lot.name}`} position={[lot.x,DISTRICT_GROUND_Y,lot.z]} scale={model.scale} dispose={null}>
    <primitive object={model.clone}/>
  </group>;
}

export function DistrictBuildings(){
  return <group name="district07-imported-architecture">
    {DISTRICT_LOTS.filter(lot=>lot.asset).map(lot=><Suspense key={lot.id} fallback={null}><Building lot={lot}/></Suspense>)}
  </group>;
}
