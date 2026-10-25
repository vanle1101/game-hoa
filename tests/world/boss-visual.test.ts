import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BossModel, BossPartGeometry, bossPalette, bossParts, type BossPart } from "../../src/components/combat/BossModel";
import { COMBAT_SUBJECT_BOUNDS, combatFraming } from "../../src/components/combat/framing";
import { sampleCombat } from "../../src/components/combat/simulation";

type GeometryProps = { args: unknown[] };
const constructors = {
  boxGeometry: THREE.BoxGeometry,
  extrudeGeometry: THREE.ExtrudeGeometry,
  cylinderGeometry: THREE.CylinderGeometry,
  torusGeometry: THREE.TorusGeometry,
};
function geometry(part: BossPart) {
  const element = BossPartGeometry({ part }) as ReactElement<GeometryProps>;
  const Constructor = constructors[element.type as keyof typeof constructors] as new (...args: unknown[]) => THREE.BufferGeometry;
  expect(Constructor).toBeDefined();
  return new Constructor(...element.props.args);
}
function withBoss(theme: string, check: (root: THREE.Group, meshes: THREE.Mesh[]) => void) {
  const root = new THREE.Group();
  root.position.set(1.8, .2, -1);
  root.rotation.set(0, -.25, 0);
  const meshes = bossParts(theme).map(part => {
    const mesh = new THREE.Mesh(geometry(part), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.name = part.id;
    mesh.position.set(...part.position);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    if (part.scale) mesh.scale.set(...part.scale);
    root.add(mesh);
    return mesh;
  });
  root.updateMatrixWorld(true);
  try { check(root, meshes); }
  finally { meshes.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }); }
}
function vertices(mesh: THREE.Mesh) {
  const positions = mesh.geometry.getAttribute("position");
  return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
}
const themes = ["default", "sugar", "midnight", "phantom"];

describe("bounded armored boss", () => {
  it.each(themes)("%s has finite geometry inside the static framing envelope and a fixed budget", theme => withBoss(theme, (root, meshes) => {
    let triangles = 0;
    expect(meshes.length).toBeLessThanOrEqual(90);
    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute("position");
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      triangles += (mesh.geometry.index?.count ?? position.count) / 3;
      for (const point of vertices(mesh)) expect(COMBAT_SUBJECT_BOUNDS.containsPoint(point), `${theme}/${mesh.name}/${point.toArray()}`).toBe(true);
    }
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(new Set(meshes.map(mesh => mesh.name)).size).toBe(meshes.length);
    console.info(`${theme}: ${meshes.length} meshes, ${triangles} triangles, bounds ${new THREE.Box3().setFromObject(root).min.toArray()} / ${new THREE.Box3().setFromObject(root).max.toArray()}`);
  }));

  it.each(themes)("%s keeps every armor part in one contact graph", theme => withBoss(theme, (_root, meshes) => {
    const bounds = meshes.map(mesh => new THREE.Box3().setFromObject(mesh));
    const connected = new Set([meshes.findIndex(mesh => mesh.name === "torso")]);
    for (let pass = 0; pass < meshes.length; pass++) {
      for (let i = 0; i < meshes.length; i++) {
        if ([...connected].some(j => bounds[i].intersectsBox(bounds[j]))) connected.add(i);
      }
    }
    expect(meshes.filter((_, i) => !connected.has(i)).map(mesh => mesh.name)).toEqual([]);
  }));

  it("layers actual chest and shin surfaces over the frame and recesses the core", () => withBoss("default", (root, meshes) => {
    const mesh = (name: string) => meshes.find(item => item.name === name)!;
    const frontAt = (name: string, x: number, y: number) => {
      const origin = root.localToWorld(new THREE.Vector3(x, y, 2));
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld);
      const hit = new THREE.Raycaster(origin, direction).intersectObject(mesh(name))[0];
      expect(hit, name).toBeDefined();
      return root.worldToLocal(hit.point.clone()).z;
    };
    expect(frontAt("right-chest", .4, 2.39)).toBeGreaterThan(frontAt("torso", .4, 2.39));
    expect(frontAt("right-shin-plate", .56, .49)).toBeGreaterThan(frontAt("right-shin-frame", .56, .49));
    expect(frontAt("reactor-inset", .07, 2.18)).toBeLessThan(frontAt("reactor-rim", .18, 2.18));
    expect(frontAt("visor-inset", .1, 3.025)).toBeLessThan(frontAt("visor-brow", .1, 3.11));
    expect(frontAt("waist-spine", 0, 1.7)).toBeLessThan(frontAt("torso", 0, 1.7));
  }));

  it.each(themes)("%s stays framed under unchanged lean and bob poses", theme => withBoss(theme, (root, meshes) => {
    const outer = new THREE.Group();
    outer.add(root);
    const localVertices = meshes.flatMap(mesh => {
      mesh.updateMatrix();
      const positions = mesh.geometry.getAttribute("position");
      return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrix));
    });
    const cameras = [.55, .75, 1, 1.2, 1.8, 2.4].map(aspect => {
      const frame = combatFraming(aspect);
      const camera = new THREE.PerspectiveCamera(43, aspect, .1, 1000);
      camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
      return camera;
    });
    const leans = [-.12, .08, 0, ...Array.from({ length: 81 }, (_, i) => sampleCombat(i * .15).bossLean)];
    for (const lean of leans) for (const bob of [-.035, .035]) {
      outer.rotation.z = lean; outer.position.y = bob; outer.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromPoints(localVertices.map(point => point.clone().applyMatrix4(root.matrixWorld)));
      expect(bounds.min.x).toBeGreaterThanOrEqual(COMBAT_SUBJECT_BOUNDS.min.x);
      expect(bounds.max.x).toBeLessThanOrEqual(COMBAT_SUBJECT_BOUNDS.max.x);
      expect(bounds.max.y).toBeLessThanOrEqual(COMBAT_SUBJECT_BOUNDS.max.y);
      expect(bounds.min.z).toBeGreaterThanOrEqual(COMBAT_SUBJECT_BOUNDS.min.z);
      expect(bounds.max.z).toBeLessThanOrEqual(COMBAT_SUBJECT_BOUNDS.max.z);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-.2);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        for (const camera of cameras) {
          const projected = new THREE.Vector3(x, y, z).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(.83);
          expect(Math.abs(projected.y)).toBeLessThan(.83);
        }
      }
    }
  }));

  it("retains theme silhouettes, inset accents and progress tint without detached effects", () => {
    expect(new Set(themes.map(theme => bossPalette(theme, 0).glow)).size).toBe(3);
    expect(bossParts("sugar").some(part => part.id.includes("crystal-crest"))).toBe(true);
    expect(bossParts("phantom").some(part => part.id.includes("dorsal-fin"))).toBe(true);
    expect(bossParts("midnight").find(part => part.id === "left-head-fin")!.scale![1]).toBe(.45);
    expect(bossPalette("default", 66).edge).not.toBe(bossPalette("default", 65).edge);
    expect(bossParts("default").filter(part => part.kind === "plate").map(part => part.profile)).toEqual(expect.arrayContaining(["torso", "chest", "shoulder", "shin", "helmet"]));
    const rendered = BossModel({ theme: "default", progress: 0 });
    for (const child of rendered.props.children) {
      expect(isValidElement(child)).toBe(true);
      expect(child.props.dispose).toBeUndefined();
      expect(child.props.children[1].props.emissiveIntensity).toBeLessThanOrEqual(1.7);
    }
  });

  it("uses declarative owned geometry and keeps integration refs, poses and public props", () => {
    const model = readFileSync(new URL("../../src/components/combat/BossModel.tsx", import.meta.url), "utf8");
    const world = readFileSync(new URL("../../src/components/combat/CombatWorld.tsx", import.meta.url), "utf8");
    expect(model).not.toMatch(/dispose=\{null\}|new THREE\.\w*Geometry|useFrame|useThree|fetch\(|TextureLoader|\/\/|\/\*/);
    expect(world).toContain("return <BossModel theme={theme} progress={progress}/>;");
    expect(world).toContain("<group ref={boss}><Boss theme={props.theme} progress={props.progress}/></group>");
    expect(world).toContain("boss.current.rotation.z=pose.bossLean");
    expect(world).toContain("sampleCombat(elapsed.current");
  });
});
