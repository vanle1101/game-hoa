import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type * as THREE from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { constructionContext, getBuilding, validateConstruction } from "../../src/construction/engine";

type Scene = THREE.Scene & { __r3f?: { root: { getState: () => { camera: THREE.Camera; gl: THREE.WebGLRenderer } } } };
type ProbeWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __wallScenes?: Scene[] };
const NOW = "2026-10-16T08:00:00.000Z";
const LIMITS = { transport: "Intercepted APIs with real applyAction and in-memory serialized state, not live DB/process restart.", coverage: "One retained textured wall: select and Escape deselect twice, passive material readback and screenshots. Transparent-material painting and commit/reload are not covered by this bounded first case.", rendering: "Actual Chrome/WebGL on existing localhost:3100. Observer never mutates scene, mesh, material or camera. No pixel baseline or premium acceptance." };
function run(state: GameState, action: Action) {
  return applyAction(state, action, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() });
}
async function fixtureFor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    const target = window as ProbeWindow;
    target.__wallScenes = [];
    const observer = target.__THREE_DEVTOOLS__ ?? new EventTarget();
    target.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const object = (event as CustomEvent<Scene>).detail;
      if (object?.isScene) target.__wallScenes!.push(object);
    });
  });
  let state = createInitialState("v7-wall-transition-notliveDB", NOW);
  state.gold = 10000; state.character.xp = 3600;
  state.settings.graphics = "performance"; state.settings.reducedMotion = true;
  const building = getBuilding(state);
  building.plan = { floors: Array.from({ length: 64 }, (_, i) => ({ x: i % 8 - 4, z: Math.floor(i / 8) - 4, level: 0, materialId: "floor-concrete" })), walls: [{ x: 0, z: 0, level: 0, orientation: "x", materialId: "wall-basic" }], curves: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };
  state.building = { ...building, starterGrantApplied: true };
  validateConstruction(state.building, state.building.plan, constructionContext(state));
  state = run(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }).state;
  const attempts: { key: string; expectedOwnerId?: string; action: Action; status?: number }[] = [];
  const errors: string[] = [], consoleErrors: string[] = [], unexpectedApi: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") { unexpectedApi.push(request.url()); return route.fulfill({ status: 503, json: { error: "Unrelated API blocked" } }); }
    if (request.method() === "GET") return route.fulfill({ json: { state: structuredClone(state), mode: "local" } });
    if (request.method() !== "POST") return route.fulfill({ status: 405 });
    const command = request.postDataJSON() as typeof attempts[number];
    attempts.push(command);
    if (command.expectedOwnerId !== state.userId) { command.status = 409; return route.fulfill({ status: 409, json: { error: "Owner mismatch", code: "OWNER_CHANGED" } }); }
    const fingerprint = JSON.stringify(command.action), previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) { command.status = 409; return route.fulfill({ status: 409, json: { error: "Idempotency payload mismatch" } }); }
    try {
      const result = previous ? { ...previous.result, state } : run(command.action.type === "reconcile" ? state : run(state, { type: "reconcile" }).state, command.action);
      state = JSON.parse(JSON.stringify(result.state)) as GameState;
      if (!previous && command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      command.status = 200; await route.fulfill({ json: result });
    } catch (error) { command.status = 422; await route.fulfill({ status: 422, json: { error: String(error) } }); }
  });
  return { state: () => structuredClone(state), attempts, errors, consoleErrors, unexpectedApi };
}
async function observe(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas");
    const scene = (window as ProbeWindow).__wallScenes?.findLast(item => item.__r3f?.root.getState().gl.domElement === canvas);
    const root = scene?.__r3f?.root.getState();
    if (!canvas || !scene || !root) throw new Error("Construction scene unavailable");
    const { gl, camera } = root;
    if (gl.getContext().isContextLost() || gl.info.render.calls === 0) throw new Error("Live WebGL frame missing");
    const candidates: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    scene.traverse(object => {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.isMeshStandardMaterial) return;
      const p = mesh.getWorldPosition(camera.position.clone());
      if (Math.abs(p.x - .5) < .001 && Math.abs(p.z) < .001 && mesh.scale.x > .9 && mesh.scale.x < 1.1 && mesh.scale.y > 2.5 && mesh.scale.z < .3) candidates.push(mesh);
    });
    if (candidates.length !== 1) throw new Error(`Expected one actual solid wall mesh, got ${candidates.length}`);
    const mesh = candidates[0], material = mesh.material, rect = canvas.getBoundingClientRect();
    const point = mesh.getWorldPosition(camera.position.clone()).project(camera);
    const click = { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
    return { uuid: mesh.uuid, materialUuid: material.uuid, geometryUuid: mesh.geometry.uuid, map: material.map?.uuid ?? null, color: material.color.getHexString(), roughness: material.roughness, metalness: material.metalness, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, matrix: mesh.matrixWorld.toArray(), camera: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), click, clickHitsCanvas: document.elementFromPoint(click.x, click.y) === canvas, calls: gl.info.render.calls, frame: gl.info.render.frame, clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  });
}

test("selected wall clears its texture and deselection restores it on the same mesh", async ({ page }, info) => {
  info.annotations.push({ type: "coverage-limits", description: JSON.stringify(LIMITS) });
  const fixture = await fixtureFor(page);
  const snapshots: Awaited<ReturnType<typeof observe>>[] = [];
  try {
    await page.goto("/");
    await expect(page.locator(".game-shell")).toBeVisible();
    const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
    await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".construction-viewport canvas")).toBeVisible();
    const cutaway = page.getByRole("button", { name: "Cắt tường", exact: true });
    if ((await cutaway.getAttribute("class"))?.split(" ").includes("on")) await cutaway.click();
    await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Chọn", exact: true }).click();
    await expect.poll(async () => { try { return (await observe(page)).map !== null; } catch { return false; } }).toBe(true);
    const before = fixture.state(), initial = await observe(page);
    const capture = async (label: string) => { const snapshot = await observe(page); snapshots.push(snapshot); await info.attach(label, { body: await page.screenshot({ clip: snapshot.clip, animations: "disabled" }), contentType: "image/png" }); return snapshot; };
    await capture("textured-normal");
    for (let cycle = 0; cycle < 2; cycle++) {
      const target = await observe(page);
      expect(target.clickHitsCanvas).toBe(true);
      await page.mouse.click(target.click.x, target.click.y);
      await expect(page.locator(".selection-details")).toContainText("Tường");
      await expect.poll(async () => (await observe(page)).map).toBeNull();
      const selected = await capture(`selected-${cycle}`);
      expect(selected.color).toBe("38889c");
      await page.locator(".selection-details .eyebrow").click();
      await page.keyboard.press("Escape");
      await expect(page.locator(".selection-details")).toHaveCount(0);
      await expect.poll(async () => (await observe(page)).map).toBe(initial.map);
      const normal = await capture(`restored-${cycle}`);
      expect(normal.color).toBe("ffffff");
      for (const result of [selected, normal]) {
        expect(result.uuid).toBe(initial.uuid); expect(result.materialUuid).toBe(initial.materialUuid); expect(result.geometryUuid).toBe(initial.geometryUuid);
        expect(result.matrix).toEqual(initial.matrix); expect(result.camera).toEqual(initial.camera); expect(result.projection).toEqual(initial.projection);
      }
      expect(fixture.state()).toEqual(before);
      expect(fixture.attempts.filter(command => command.action.type !== "reconcile")).toHaveLength(0);
    }
    expect(fixture.errors).toEqual([]); expect(fixture.consoleErrors).toEqual([]); expect(fixture.unexpectedApi).toEqual([]);
  } finally {
    await info.attach("wall-material-transition-evidence", { body: JSON.stringify({ limits: LIMITS, snapshots, attempts: fixture.attempts, errors: fixture.errors, consoleErrors: fixture.consoleErrors, unexpectedApi: fixture.unexpectedApi, finalState: fixture.state() }, null, 2), contentType: "application/json" });
  }
});
