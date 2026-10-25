import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { APARTMENT_CORE_CLEARANCE, buildCityScene, makeCity, type Instance } from "../../src/components/world/ApartmentCity";
import { DISTRICT_LOTS } from "../../src/components/world/v20/district-layout";
import { residenceCityOffset } from "../../src/components/construction/render-geometry";

// V20 supersedes the old density >=75 towers and primitive-only renderer gates.
// Preserve compatibility/clearance checks while accepting the imported modular kit.
function instanceBounds(instance: Instance): THREE.Box3 {
  const object = new THREE.Object3D();
  object.position.set(...instance.position);
  object.scale.set(...instance.scale);
  if (Array.isArray(instance.rotation)) object.rotation.set(...instance.rotation);
  else object.rotation.set(0, instance.rotation ?? 0, 0);
  object.updateMatrixWorld(true);
  return new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(object.matrixWorld);
}

describe("ApartmentCity compatibility after V20 reference reconstruction", () => {
  it("preserves the public three-layer scene and deterministic collision descriptor contracts", () => {
    for(const quality of ['performance','balanced','high','ultra']) {
      const scene=buildCityScene(quality);
      expect(scene.layers).toHaveLength(3);
      expect(makeCity(quality)).toEqual(scene.layers);
      expect(scene.towers).toEqual(buildCityScene().towers);
      for(const layer of scene.layers) for(const instances of Object.values(layer)) for(const instance of instances){
        expect(instance.position.every(Number.isFinite)).toBe(true);
        expect(instance.scale.every(value=>Number.isFinite(value)&&value>0)).toBe(true);
        expect(instance.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
  it("keeps infrastructure outside the apartment focal volume on every supported residence floor", () => {
    const instances=buildCityScene().layers.flatMap(layer=>Object.values(layer).flat());
    for(const floor of [8,16,24] as const){
      const interior=new THREE.Box3(
        new THREE.Vector3(APARTMENT_CORE_CLEARANCE.minX,-1.5,APARTMENT_CORE_CLEARANCE.minZ),
        new THREE.Vector3(APARTMENT_CORE_CLEARANCE.maxX,16,APARTMENT_CORE_CLEARANCE.maxZ));
      for(const instance of instances){
        const box=instanceBounds(instance).translate(new THREE.Vector3(0,residenceCityOffset(floor),0));
        expect(box.intersectsBox(interior)).toBe(false);
      }
    }
  });
  it("resolves every surveyed architecture asset to actual GLB meshes and its texture dependency", () => {
    const paths=new Set(DISTRICT_LOTS.map(lot=>lot.asset!));
    expect(paths.size).toBeGreaterThanOrEqual(15);
    for(const asset of paths){
      const file=join(process.cwd(),'public',asset);
      const bytes=readFileSync(file);
      expect(bytes.toString('utf8',0,4)).toBe('glTF');
      expect(bytes.readUInt32LE(4)).toBe(2);
      const length=bytes.readUInt32LE(12);
      const gltf=JSON.parse(bytes.toString('utf8',20,20+length));
      expect(gltf.meshes.length).toBeGreaterThan(0);
      const vertexCounts=gltf.meshes.flatMap((mesh:{primitives:{attributes:{POSITION:number}}[]})=>mesh.primitives.map(p=>gltf.accessors[p.attributes.POSITION].count));
      expect(Math.max(...vertexCounts)).toBeGreaterThan(100);
      for(const texture of gltf.images ?? []) if(texture.uri){
        expect(existsSync(join(file,'..',texture.uri))).toBe(true);
      }
    }
  });
});
