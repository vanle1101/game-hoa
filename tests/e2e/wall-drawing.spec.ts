import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type * as THREE from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import { getBuilding } from "../../src/construction/engine";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

type Scene = THREE.Scene & { __r3f?: { root: { getState: () => { camera: THREE.Camera; gl: THREE.WebGLRenderer; controls?: { target: THREE.Vector3; enabled: boolean; update: () => void } } } } };
declare global {
  interface Window {
    __wallDrawingScenes?: Scene[];
  }
}

test("consecutive pointer drags retain each wall and clear the ghost", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  test.skip(isMobile, "Desktop mouse drag regression");
  let state = createInitialState("wall-drawing-browser", "2026-10-16T08:00:00.000Z");
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" },
    { userId: state.userId, now: "2026-10-16T08:00:00.000Z", random: () => 0.5, eventId: randomUUID() }).state;
  state.gold = 10_000;
  state.character.xp = 3_600;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const building = getBuilding(state);
  building.plan = {
    floors: Array.from({ length: 64 }, (_, index) => ({ x: index % 8 - 4, z: Math.floor(index / 8) - 4, level: 0, materialId: "floor-concrete" })),
    walls: [{ x: -2, z: 0, level: 0, orientation: "x", materialId: "wall-basic" }],
    curves: [], ledStrips: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
  building.paid["wall:0:x:-2:0"] = 20;
  state.building = { ...building, foundation: { version: 9, mode: "legacy-preserved" }, starterGrantApplied: true };
  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    window.__wallDrawingScenes = [];
    const observer = window.__THREE_DEVTOOLS__ ?? new EventTarget();
    window.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const scene = (event as CustomEvent<Scene>).detail;
      if (scene?.isScene) window.__wallDrawingScenes!.push(scene);
    });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    return route.fulfill(
      new URL(route.request().url()).pathname === "/api/game" && route.request().method() === "GET"
        ? { json: { state, mode: "local" } }
        : { status: 503, json: { error: "Isolated fixture" } },
    );
  });
  await page.goto("/");
  await expect(page.locator(".game-shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
  await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".construction-viewport canvas")).toBeVisible();
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Tường", exact: true }).click();
  await expect(page.locator(".construction-help")).toContainText("1 TƯỜNG");

  const project = (x: number, z: number) => page.evaluate(({ x, z }) => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas")!;
    const scene = window.__wallDrawingScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    if (!scene) return null;
    const camera = scene.__r3f!.root.getState().camera;
    const point = camera.position.clone().set(x, 0.015, z).project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  }, { x, z });
  await expect.poll(() => project(-1.04, 0.02)).not.toBeNull();
  const drag = async (startX: number, endX: number) => {
    const start = (await project(startX, 0.02))!;
    const end = (await project(endX, 0.02))!;
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, start)).toBe("CANVAS");
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, end)).toBe("CANVAS");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 3 });
    await page.mouse.up();
  };
  const cameraRig = () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas")!;
    const scene = window.__wallDrawingScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    const rig = scene?.__r3f?.root.getState();
    if (!rig?.controls) return null;
    return { position: rig.camera.position.toArray(), target: rig.controls.target.toArray(), enabled: rig.controls.enabled };
  });
  const expectCameraStill = async (before: NonNullable<Awaited<ReturnType<typeof cameraRig>>>) => {
    const after = await cameraRig();
    expect(after).not.toBeNull();
    for (const axis of [0, 1, 2]) {
      expect(Math.abs(after!.position[axis] - before.position[axis])).toBeLessThan(0.001);
      expect(Math.abs(after!.target[axis] - before.target[axis])).toBeLessThan(0.001);
    }
  };
  await drag(-1.04, 0.3);
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await drag(0.1, 1.4);
  await expect(page.locator(".construction-help")).toContainText("3 TƯỜNG");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "ư", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "ư", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "ư", isComposing: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "ư", isComposing: true, bubbles: true }));
  });
  await expect(page.locator(".construction-help")).toContainText("3 TƯỜNG");
  const customCamera = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas")!;
    const scene = window.__wallDrawingScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    const rig = scene?.__r3f?.root.getState();
    if (!rig?.controls) return false;
    rig.camera.position.x += 1.1;
    rig.camera.position.z -= 0.7;
    rig.controls.target.x += 0.35;
    rig.controls.target.z += 0.2;
    rig.controls.update();
    return true;
  });
  expect(customCamera).toBe(true);
  const beforeDemolish = await cameraRig();
  expect(beforeDemolish).not.toBeNull();
  await expect(page.locator(".world-tooltip")).toHaveCount(0);
  await expect(page.locator(".draft-controls")).toContainText("BẢN NHÁP CHƯA LƯU");
  await expect(page.getByRole("button", { name: "Lưu công trình", exact: true })).toBeEnabled();
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Tháo dỡ", exact: true }).click();
  const floorPoint = (await project(0.2, 2.2))!;
  await page.mouse.move(floorPoint.x, floorPoint.y);
  const wallPoint = (await project(-1.6, 0.02))!;
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas")!;
    const scene = window.__wallDrawingScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    let cursor = false;
    scene?.traverse(object => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (mesh.isMesh && mesh.geometry?.type === "RingGeometry" && material?.isMeshBasicMaterial && material.color.getHexString() === "ffca49") cursor = true;
    });
    return cursor;
  })).toBe(true);
  await page.mouse.move(wallPoint.x, wallPoint.y);
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas")!;
    const scene = window.__wallDrawingScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    let highlighted = false;
    scene?.traverse(object => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (mesh.isMesh && material?.isMeshBasicMaterial && material.color.getHexString() === "ffd34f" &&
        (mesh.geometry as THREE.BoxGeometry).parameters?.width === 1.005) highlighted = true;
    });
    return highlighted;
  })).toBe(true);
  await page.mouse.click(wallPoint.x, wallPoint.y);
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await expectCameraStill(beforeDemolish!);
  await expect(page.locator(".construction-editor")).toContainText("+10 G hoàn lại khi lưu");
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Tường", exact: true }).click();
  await page.keyboard.down("Control");
  const demolishStart = (await project(-0.8, 0.02))!;
  const demolishEnd = (await project(0.3, 0.02))!;
  await page.mouse.move(demolishStart.x, demolishStart.y);
  await page.mouse.down();
  await page.mouse.move(demolishEnd.x, demolishEnd.y, { steps: 3 });
  await expect.poll(async () => (await cameraRig())?.enabled).toBe(false);
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await expect(page.locator(".world-tooltip")).toContainText("Tháo dỡ 2 đốt tường");
  await page.mouse.move(demolishStart.x, demolishStart.y, { steps: 3 });
  await expect(page.locator(".world-tooltip")).toContainText("Tháo dỡ 1 đốt tường");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(async () => (await cameraRig())?.enabled).toBe(true);
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Tường", exact: true }).click();
  await page.mouse.move(demolishStart.x, demolishStart.y);
  await page.mouse.down();
  await page.mouse.move(demolishEnd.x, demolishEnd.y, { steps: 3 });
  await expect(page.locator(".world-tooltip")).toContainText("Tháo dỡ 2 đốt tường");
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.mouse.up();
  await expect.poll(async () => (await cameraRig())?.enabled).toBe(true);
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await page.mouse.move(demolishStart.x, demolishStart.y);
  await page.mouse.down();
  await page.mouse.move(demolishEnd.x, demolishEnd.y, { steps: 3 });
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await expect(page.locator(".world-tooltip")).toContainText("Tháo dỡ 2 đốt tường");
  await page.mouse.up();
  await expect.poll(async () => (await cameraRig())?.enabled).toBe(true);
  await page.keyboard.up("Control");
  await expect(page.locator(".construction-help")).toContainText("0 TƯỜNG");
  await expectCameraStill(beforeDemolish!);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".construction-help")).toContainText("2 TƯỜNG");
  await expectCameraStill(beforeDemolish!);
  expect(errors).toEqual([]);
});
