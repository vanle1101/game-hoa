import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EQUIPMENT_CATALOG, EQUIPMENT_MODEL_IDS, getEquipmentRecipe, type EquipmentAnchor, type EquipmentPart } from "../../src/equipment/catalog";
import { createEquipmentPartGeometry, getEquipmentBounds } from "../../src/components/world/equipment-models";

const legacy = [
  ["starter-blade","weapon",6,0,0,1,0],
  ["cyber-katana","weapon",18,0,.03,2,180],
  ["plasma-sword","weapon",30,0,.05,4,450],
  ["quantum-edge","weapon",50,0,.08,7,1200],
  ["neural-visor","head",2,5,.02,1,90],
  ["aegis-jacket","chest",0,12,0,2,160],
  ["pulse-gloves","gloves",4,3,.01,1,80],
  ["drift-boots","boots",2,4,.01,1,85],
  ["focus-chip","accessory1",7,2,.03,2,140],
  ["memory-ring","accessory2",10,4,.04,3,280],
  ["dawn-relic","relic",20,10,.05,8,1800],
];
const anchors:EquipmentAnchor[]=["rightHand","leftHand","head","torso","leftArm","rightArm","leftShin","rightShin"];
const structuralSignature = (parts:EquipmentPart[]) => JSON.stringify(parts.map(({geometry,position,rotation,anchor})=>({geometry,position,rotation,anchor})));

describe("procedural equipment catalog",()=>{
  it("provides 36 weapon structures, 30 armor pieces and 8 accessories",()=>{
    expect(EQUIPMENT_CATALOG).toHaveLength(74);
    expect(EQUIPMENT_CATALOG.filter(item=>item.slot==="weapon")).toHaveLength(36);
    expect(EQUIPMENT_CATALOG.filter(item=>item.category==="armor")).toHaveLength(30);
    expect(EQUIPMENT_CATALOG.filter(item=>["head","chest","gloves","boots"].includes(item.slot))).toHaveLength(30);
    expect(EQUIPMENT_CATALOG.filter(item=>item.category==="accessory")).toHaveLength(8);
    const counts=Object.fromEntries(["tactical","katana","energy","heavy","dual","relic-weapon"].map(category=>[category,EQUIPMENT_CATALOG.filter(item=>item.category===category).length]));
    expect(counts).toEqual({tactical:6,katana:6,energy:6,heavy:6,dual:4,"relic-weapon":8});
    expect(new Set(EQUIPMENT_MODEL_IDS).size).toBe(74);
    expect(EQUIPMENT_MODEL_IDS).toEqual(EQUIPMENT_CATALOG.map(item=>item.id));
  });
  it.each(legacy)("preserves %s stats, price, level and original slot",(id,slot,attack,defense,critRate,level,price)=>{
    expect(EQUIPMENT_CATALOG.find(item=>item.id===id)).toMatchObject({id,slot,attack,defense,critRate,level,price});
  });
  it("has valid economy values, icon names, slots and model references",()=>{
    for(const item of EQUIPMENT_CATALOG){
      expect(["weapon","head","chest","gloves","boots","accessory1","accessory2","relic"]).toContain(item.slot);
      expect(["common","uncommon","rare","epic","legendary","mythic"]).toContain(item.rarity);
      expect(["Sword","Swords","Zap","Hammer","Sparkles","Shield","Glasses","Shirt","Hand","Footprints","Cpu","Gem"]).toContain(item.icon);
      for(const value of [item.attack,item.defense,item.critRate,item.level,item.price]){expect(Number.isFinite(value)).toBe(true);expect(value).toBeGreaterThanOrEqual(0);}
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.level).toBeGreaterThanOrEqual(1);
      expect(item.critRate).toBeLessThanOrEqual(1);
      expect(getEquipmentRecipe(item.modelId)?.id).toBe(item.id);
    }
  });
  it("never uses recoloring alone to distinguish recipes",()=>{
    const signatures = EQUIPMENT_MODEL_IDS.map(id=>structuralSignature(getEquipmentRecipe(id)!.parts));
    expect(new Set(signatures).size).toBe(74);
    for(const id of EQUIPMENT_MODEL_IDS) expect(getEquipmentRecipe(id)!.parts.length).toBeGreaterThanOrEqual(2);
  });
  it("returns isolated deterministic recipes and no fallback for unknown IDs",()=>{
    expect(getEquipmentRecipe("missing-equipment")).toBeUndefined();
    const first=getEquipmentRecipe("starter-blade")!;
    const second=getEquipmentRecipe("starter-blade")!;
    expect(first).toEqual(second);
    first.parts[0].position[0]=99;
    expect(getEquipmentRecipe("starter-blade")).toEqual(second);
  });
  it("declares anchors matching actual modeled parts",()=>{
    for(const item of EQUIPMENT_CATALOG){
      const recipe=getEquipmentRecipe(item.id)!;
      expect(recipe.slot).toBe(item.slot);
      expect(recipe.category).toBe(item.category);
      expect([...new Set(recipe.parts.map(part=>part.anchor))]).toEqual(item.rigAnchors);
      const partIds=recipe.parts.map(part=>`${part.anchor}:${part.id}`);
      expect(new Set(partIds).size, item.id).toBe(partIds.length);
      for(const part of recipe.parts) expect(anchors).toContain(part.anchor);
      if(item.slot!=="weapon") expect(recipe.grip).toBeNull();
    }
  });
  it("uses simple non-self-intersecting blade and plate outlines",()=>{
    type Point=[number,number];
    const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(const id of EQUIPMENT_MODEL_IDS){
      for(const part of getEquipmentRecipe(id)!.parts){
        if(part.geometry.kind!=="prism") continue;
        const points=part.geometry.outline, count=points.length;
        let twiceArea=0;
        for(let i=0;i<count;i++){
          const a=points[i],b=points[(i+1)%count];
          twiceArea+=a[0]*b[1]-b[0]*a[1];
          expect(Math.hypot(a[0]-b[0],a[1]-b[1]),`${id}/${part.id}/edge${i}`).toBeGreaterThan(1e-6);
          for(let j=i+2;j<count;j++){
            if(i===0&&j===count-1) continue;
            const c=points[j],d=points[(j+1)%count];
            const intersects=cross(a,b,c)*cross(a,b,d)<-1e-14&&cross(c,d,a)*cross(c,d,b)<-1e-14;
            expect(intersects,`${id}/${part.anchor}/${part.id}: edges ${i},${j}`).toBe(false);
          }
        }
        expect(Math.abs(twiceArea),`${id}/${part.id}`).toBeGreaterThan(1e-5);
      }
    }
  });
  it.each(EQUIPMENT_MODEL_IDS)("builds finite nondegenerate %s meshes using the rendering geometry factory",id=>{
      for(const part of getEquipmentRecipe(id)!.parts){
        for(const value of [...part.position,...part.rotation]) expect(Number.isFinite(value)).toBe(true);
        const geometry=createEquipmentPartGeometry(part);
        geometry.computeBoundingBox();
        const size=geometry.boundingBox!.getSize(new THREE.Vector3());
        for(const value of size.toArray()){expect(Number.isFinite(value),`${id}/${part.id}`).toBe(true);expect(value,`${id}/${part.id}`).toBeGreaterThan(0);}
        const vertices=geometry.getAttribute("position");
        expect(vertices.count).toBeGreaterThan(2);
        for(const value of vertices.array) expect(Number.isFinite(value)).toBe(true);
        if(part.geometry.kind==="prism"){
          const index=geometry.getIndex();
          const count=index?.count??vertices.count;
          let area=0;
          for(let i=0;i<count;i+=3){
            const a=new THREE.Vector3().fromBufferAttribute(vertices,index?index.getX(i):i);
            const b=new THREE.Vector3().fromBufferAttribute(vertices,index?index.getX(i+1):i+1);
            const c=new THREE.Vector3().fromBufferAttribute(vertices,index?index.getX(i+2):i+2);
            area+=b.sub(a).cross(c.sub(a)).length()/2;
          }
          expect(area,`${id}/${part.id}`).toBeGreaterThan(.00001);
        }
        geometry.dispose();
      }
  });
  it("keeps weapon grips at the origin and geometry within a hand-scale envelope",()=>{
    for(const item of EQUIPMENT_CATALOG.filter(item=>item.slot==="weapon")){
      const recipe=getEquipmentRecipe(item.id)!;
      expect(recipe.grip).toEqual([0,0,0]);
      for(const anchor of item.rigAnchors){
        const handle=recipe.parts.find(part=>part.anchor===anchor&&part.id==="handle")!;
        expect(handle.position).toEqual([0,0,0]);
        expect(handle.rotation).toEqual([0,0,0]);
        expect(handle.geometry.kind).toBe("cylinder");
        if(handle.geometry.kind==="cylinder"){
          expect(handle.geometry.radiusBottom).toBeLessThanOrEqual(.03);
          expect(handle.geometry.height).toBeGreaterThanOrEqual(.2);
        }
        const {min,max}=getEquipmentBounds(recipe,anchor);
        expect(min[0],item.id).toBeGreaterThanOrEqual(-.6);
        expect(max[0],item.id).toBeLessThanOrEqual(.6);
        expect(min[1],item.id).toBeGreaterThanOrEqual(-.18);
        expect(max[1],item.id).toBeLessThanOrEqual(1.3);
        expect(max[1],item.id).toBeGreaterThan(.4);
        expect(min[2],item.id).toBeGreaterThanOrEqual(-.18);
        expect(max[2],item.id).toBeLessThanOrEqual(.18);
      }
    }
  });
  it("provides separate locally gripped left and right parts for every dual weapon",()=>{
    for(const item of EQUIPMENT_CATALOG.filter(item=>item.category==="dual")){
      expect(item.rigAnchors).toEqual(["rightHand","leftHand"]);
      const recipe=getEquipmentRecipe(item.id)!;
      const right=recipe.parts.filter(part=>part.anchor==="rightHand").map(part=>({...part,anchor:"rightHand"}));
      const left=recipe.parts.filter(part=>part.anchor==="leftHand").map(part=>({...part,anchor:"rightHand"}));
      expect(left).toEqual(right);
    }
  });
  it("places armor near the declared rig nodes and keeps boot soles above the floor",()=>{
    for(const item of EQUIPMENT_CATALOG.filter(item=>item.slot!=="weapon")){
      const recipe=getEquipmentRecipe(item.id)!;
      for(const anchor of item.rigAnchors){
        const {min,max}=getEquipmentBounds(recipe,anchor);
        expect(min[0]).toBeGreaterThan(-.5);expect(max[0]).toBeLessThan(.5);
        expect(min[2]).toBeGreaterThan(-.3);expect(max[2]).toBeLessThan(.4);
        if(anchor==="head"){expect(min[1]).toBeGreaterThan(-.25);expect(max[1]).toBeLessThan(.3);}
        if(anchor==="torso"){expect(min[1]).toBeGreaterThanOrEqual(1-1e-6);expect(max[1]).toBeLessThan(1.6);}
        if(anchor==="leftArm"||anchor==="rightArm"){expect(min[1]).toBeGreaterThan(-.6);expect(max[1]).toBeLessThan(-.1);}
        if(anchor==="leftShin"||anchor==="rightShin"){
          expect(.958-.393+min[1],item.id).toBeGreaterThanOrEqual(-1e-6);
          expect(max[1]).toBeLessThan(0);
        }
      }
    }
  });
});
