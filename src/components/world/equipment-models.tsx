"use client";

import { useEffect, useMemo } from "react";
import type { ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { getEquipmentDefinition, getEquipmentRecipe, type EquipmentAnchor, type EquipmentMaterial, type EquipmentPart, type EquipmentRecipe, type EquipmentVector } from "../../equipment/catalog";

export { EQUIPMENT_MODEL_IDS, getEquipmentRecipe } from "../../equipment/catalog";

export function createEquipmentPartGeometry(part: EquipmentPart): THREE.BufferGeometry {
  const geometry = part.geometry;
  switch (geometry.kind) {
    case "box": return new THREE.BoxGeometry(...geometry.size);
    case "cylinder": return new THREE.CylinderGeometry(geometry.radiusTop, geometry.radiusBottom, geometry.height, geometry.segments ?? 12);
    case "sphere": return new THREE.SphereGeometry(geometry.radius, 16, 12, 0, Math.PI * 2, 0, geometry.thetaLength ?? Math.PI);
    case "torus": return new THREE.TorusGeometry(geometry.radius, geometry.tube, 8, 32, geometry.arc ?? Math.PI * 2);
    case "prism": {
      const shape = new THREE.Shape();
      geometry.outline.forEach(([x,y],index)=>index===0?shape.moveTo(x,y):shape.lineTo(x,y));
      shape.closePath();
      const result = new THREE.ExtrudeGeometry(shape,{depth:geometry.depth,bevelEnabled:false,steps:1});
      result.translate(0,0,-geometry.depth/2);
      return result;
    }
  }
}

export function getEquipmentBounds(recipe: EquipmentRecipe, anchor?: EquipmentAnchor): { min: EquipmentVector; max: EquipmentVector } {
  const result = new THREE.Box3();
  recipe.parts.filter(part=>!anchor||part.anchor===anchor).forEach(part=>{
    const geometry = createEquipmentPartGeometry(part);
    geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...part.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation)),new THREE.Vector3(1,1,1));
    if(geometry.boundingBox) result.union(geometry.boundingBox.clone().applyMatrix4(matrix));
    geometry.dispose();
  });
  return result.isEmpty()?{min:[0,0,0],max:[0,0,0]}:{min:result.min.toArray(),max:result.max.toArray()};
}

const surface: Record<EquipmentMaterial,{color:string;metalness:number;roughness:number;emissiveIntensity?:number}> = {
  steel:{color:"#708697",metalness:.8,roughness:.28},
  dark:{color:"#263442",metalness:.65,roughness:.42},
  grip:{color:"#19232b",metalness:.05,roughness:.85},
  edge:{color:"#d1dce0",metalness:.85,roughness:.2},
  light:{color:"#9de9f2",metalness:.3,roughness:.26,emissiveIntensity:1.3},
  gold:{color:"#c5a162",metalness:.8,roughness:.3},
  cloth:{color:"#3d5263",metalness:.05,roughness:.9},
  glass:{color:"#73c7d9",metalness:.5,roughness:.14,emissiveIntensity:.35},
};

function EquipmentMesh({part,accent,castShadow,receiveShadow}:{part:EquipmentPart;accent:string;castShadow:boolean;receiveShadow:boolean}) {
  const geometry = useMemo(()=>createEquipmentPartGeometry(part),[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material = surface[part.material];
  const color = part.material==="light"||part.material==="glass"?accent:material.color;
  return <mesh name={`${part.anchor}:${part.id}`} position={part.position} rotation={part.rotation} geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
    <meshStandardMaterial color={color} metalness={material.metalness} roughness={material.roughness} emissive={material.emissiveIntensity?color:"#000000"} emissiveIntensity={material.emissiveIntensity??0} />
  </mesh>;
}

const displayAnchors: Record<EquipmentAnchor,EquipmentVector> = {
  rightHand:[.2,0,0],leftHand:[-.2,0,0],head:[0,.2,0],torso:[0,-1.08,0],
  leftArm:[-.14,.56,0],rightArm:[.14,.56,0],leftShin:[-.1,.565,0],rightShin:[.1,.565,0],
};
export type EquipmentModelProps = Omit<ThreeElements["group"],"children"> & {
  itemId: string;
  anchor?: EquipmentAnchor;
  presentation?: "equipped" | "display";
};
export function EquipmentModel({itemId,anchor,presentation="equipped",castShadow=true,receiveShadow=true,...props}:EquipmentModelProps) {
  const recipe = useMemo(()=>getEquipmentRecipe(itemId),[itemId]);
  const definition = getEquipmentDefinition(itemId);
  if(!recipe||!definition) return null;
  if(presentation==="equipped"&&recipe.slot!=="weapon"&&!anchor) return null;
  const selectedAnchor = anchor??(presentation==="equipped"?"rightHand":undefined);
  const parts = recipe.parts.filter(part=>!selectedAnchor||part.anchor===selectedAnchor);
  return <group name={`equipment:${itemId}`} {...props}>
    {parts.map(part=><group key={`${part.anchor}:${part.id}`} position={presentation==="display"&&!anchor?(recipe.slot==="weapon"&&recipe.category!=="dual"?[0,0,0]:displayAnchors[part.anchor]):[0,0,0]}>
      <EquipmentMesh part={part} accent={definition.accent} castShadow={Boolean(castShadow)} receiveShadow={Boolean(receiveShadow)} />
    </group>)}
  </group>;
}
export default EquipmentModel;
