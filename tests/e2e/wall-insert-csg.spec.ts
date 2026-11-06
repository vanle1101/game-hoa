import { expect, test } from "@playwright/test";
import type * as THREE from "three";
import { createInitialState } from "../../src/domain/engine";
import { constructionContext, getBuilding, validateConstruction } from "../../src/construction/engine";
import { edgeKey } from "../../src/construction/grid";
import { withLotObject } from "../../src/construction/lot-objects";
import type { WallSegment } from "../../src/construction/types";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

type ObservedScene = THREE.Scene & { __r3f?: { root: { getState: () => { gl: THREE.WebGLRenderer } } } };
declare global {
  interface Window {
    __THREE_DEVTOOLS__?: EventTarget;
    __wallInsertScenes?: ObservedScene[];
  }
}

test("a placed door leaves visible jambs and lintel in the actual Build Mode renderer", async ({ page }, info) => {
  const state = createInitialState("wall-insert-csg-browser", "2026-10-16T08:00:00.000Z");
  state.gold = 10_000;
  state.character.xp = 3_600;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const walls: WallSegment[] = [-1, 0, 1].map(x => ({ x, z: -1, level: 0, orientation: "x", materialId: "wall-basic" }));
  const building = getBuilding(state);
  building.plan = {
    floors: Array.from({ length: 24 }, (_, index) => ({ x: index % 6 - 3, z: Math.floor(index / 6) - 2, level: 0, materialId: "floor-concrete" })),
    walls, curves: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
    furniture: [withLotObject({ id: "browser-door", furnitureId: "glass_door_modern", x: 0, z: -1, level: 0, rotation: 0,
      placementType: "wall_insert", wall_id: edgeKey(walls[1]), wall_u: 0.5, wallY: 0, wallNormal: [0, 0, 1] })],
  };
  state.building = { ...building, starterGrantApplied: true };
  state.ownedFurniture.glass_door_modern = 1;
  validateConstruction(state.building, state.building.plan, constructionContext(state));

  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    window.__wallInsertScenes = [];
    const observer = window.__THREE_DEVTOOLS__ ?? new EventTarget();
    window.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const object = (event as CustomEvent<ObservedScene>).detail;
      if (object?.isScene) window.__wallInsertScenes!.push(object);
    });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    if (new URL(route.request().url()).pathname === "/api/game" && route.request().method() === "GET") {
      await route.fulfill({ json: { state, mode: "local" } });
    } else {
      await route.fulfill({ status: 503, json: { error: "Isolated browser fixture" } });
    }
  });

  await page.goto("/");
  await expect(page.locator(".game-shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
  await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".construction-viewport canvas")).toBeVisible();

  const inspect = () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas");
    const scene = window.__wallInsertScenes?.findLast(candidate => candidate.__r3f?.root.getState().gl.domElement === canvas);
    if (!scene || !canvas) return null;
    const { gl } = scene.__r3f!.root.getState();
    const walls: THREE.Mesh[] = [];
    scene.traverse(object => {
      if (object.type !== "Mesh") return;
      const mesh = object as THREE.Mesh;
      if (!Array.isArray(mesh.material) && mesh.material.clippingPlanes?.length) walls.push(mesh);
    });
    const wall = walls.find(mesh => mesh.parent?.position.x === 0.5 && mesh.parent?.position.z === -1);
    if (!wall) return null;
    const material = wall.material as THREE.MeshStandardMaterial;
    const plane = material.clippingPlanes![0];
    const position = wall.geometry.getAttribute("position");
    const uv = wall.geometry.getAttribute("uv");
    const uvAligned = Array.from({ length: position.count }, (_, index) =>
      Math.abs(uv.getX(index) - (position.getX(index) + 0.5)) < 1e-4 &&
      Math.abs(uv.getY(index) - position.getY(index) / 2.8) < 1e-4).every(Boolean);
    return {
      drawCalls: gl.info.render.calls,
      wallCount: walls.filter(mesh => mesh.parent?.position.z === -1 && [-0.5, 0.5, 1.5].includes(mesh.parent.position.x)).length,
      vertices: position.count,
      materialType: material.type,
      materialColor: material.color.getHexString(),
      emissiveColor: material.emissive.getHexString(),
      emissiveIntensity: material.emissiveIntensity,
      hasTexture: Boolean(material.map),
      materialGroups: wall.geometry.groups.map(group => group.materialIndex),
      uvAligned,
      clipNormalY: plane.normal.y,
      cap: plane.constant,
      jambVisible: plane.distanceToPoint({ x: 0, y: 1.2, z: 0 } as THREE.Vector3) > 0,
      lintelVisible: plane.distanceToPoint({ x: 0, y: 2.48, z: 0 } as THREE.Vector3) > 0,
    };
  });
  await expect.poll(inspect, { timeout: 20_000 }).not.toBeNull();
  const result = (await inspect())!;
  expect(result).toMatchObject({ wallCount: 3, materialType: "MeshStandardMaterial", materialColor: "ffffff",
    emissiveColor: "000000", emissiveIntensity: 0, hasTexture: true, materialGroups: [0], uvAligned: true,
    clipNormalY: -1, jambVisible: true, lintelVisible: true });
  expect(result.cap).toBeCloseTo(2.8, 2);
  expect(result.drawCalls).toBeGreaterThan(0);
  expect(result.vertices).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await info.attach("placed-door-build-mode.png", { body: await page.locator(".construction-viewport").screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Cắt tường" }).click();
  await info.attach("placed-door-full-wall.png", { body: await page.locator(".construction-viewport").screenshot(), contentType: "image/png" });
});
