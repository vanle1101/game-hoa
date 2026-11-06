import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type * as THREE from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { constructionContext, getBuilding, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { BUILDING_CATALOG, buildingItem } from "../../src/construction/catalog";
import { DOOR_MODEL_IDS, getDoorRecipe, doorMotionKind } from "../../src/components/construction/door-models";
import { wallParts } from "../../src/components/construction/render-geometry";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const WALL = { x: 0, z: -2, level: 0, orientation: "x" as const, materialId: "wall-basic" };
const LIMITS = {
  transport: "notliveDB: every /api/* request is intercepted; /api/game uses actual createInitialState/applyAction, unrelated APIs are blocked.",
  seed: "10,000 fixture Gold, 3,600 XP, one completed campaign for neon entitlement, supported 4x4 floor and one solid wall; fixture scaffolding is not a UI construction claim.",
  persistence: "JSON-serialized in-memory server state survives page reload; no database or process-restart durability claim.",
  rendering: "Installed Chrome, existing localhost:3100, actual production Canvas/WebGL. Passive Three devtools observe plus read-only R3F root access; no scene/camera/state mutation, manual rendering, thumbnails or renderer mocks.",
  snapshots: "Finite per-door solid/closed/open/reclosed/reloaded PNG review artifacts and rendered mesh geometry JSON; no approved pixel baseline exists.",
  interaction: "Real Live-mode pointer clicks toggle leaves. Leaf transforms, not image differences, prove opening/closing. Proximity pathfinding is outside this suite.",
};
type Command = { key: string; expectedOwnerId?: string; action: Action };
type Attempt = { command: Command; status: number; error?: string };
type ObservedScene = THREE.Scene & { __r3f?: { root: { getState: () => { camera: THREE.Camera; gl: THREE.WebGLRenderer } } } };
type ObservedObject = THREE.Object3D & { __r3f?: { handlers?: Record<string, unknown> } };
declare global {
  interface Window {
    __THREE_DEVTOOLS__?: EventTarget;
    __doorGalleryScenes?: ObservedScene[];
  }
}

function run(state: GameState, action: Action): ActionResult {
  return applyAction(state, action, { userId: state.userId, now: NOW, random: () => 0.5, eventId: randomUUID() });
}

function seedState(): GameState {
  let state = createInitialState("v7-door-gallery-notliveDB", NOW);
  state.gold = 10_000;
  state.character.xp = 3_600;
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  state.campaigns = [{ id: "gallery-entitlement", title: "Fixture entitlement", description: "", bossId: "static-wraith", requiredTaskIds: [], milestones: [], completedAt: NOW }];
  const building = getBuilding(state);
  building.plan = {
    floors: Array.from({ length: 16 }, (_, i) => ({ x: i % 4 - 2, z: Math.floor(i / 4) - 2, level: 0, materialId: "floor-concrete" })),
    walls: [{ ...WALL }], curves: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
  state.building = { ...building, starterGrantApplied: true };
  validateConstruction(state.building, state.building.plan, constructionContext(state));
  state = run(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }).state;
  return state;
}

async function fixtureFor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    window.__doorGalleryScenes = [];
    const observer = window.__THREE_DEVTOOLS__ ?? new EventTarget();
    window.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const object = (event as CustomEvent<ObservedScene>).detail;
      if (object?.isScene) window.__doorGalleryScenes!.push(object);
    });
  });
  let state = seedState();
  let reads = 0;
  let lastRead: GameState | undefined;
  const attempts: Attempt[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    if (new URL(request.url()).pathname !== "/api/game") {
      await route.fulfill({ status: 503, json: { error: "notliveDB fixture blocks unrelated APIs" } });
      return;
    }
    if (request.method() === "GET") {
      reads++;
      lastRead = structuredClone(state);
      await route.fulfill({ json: { state: lastRead, mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, json: { error: "Unsupported fixture method" } });
      return;
    }
    const command = request.postDataJSON() as Command;
    const attempt: Attempt = { command: structuredClone(command), status: 0 };
    attempts.push(attempt);
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (command.expectedOwnerId !== state.userId || (previous && previous.fingerprint !== fingerprint)) {
      attempt.status = 409;
      attempt.error = "Owner or idempotency conflict";
      await route.fulfill({ status: attempt.status, json: { error: attempt.error } });
      return;
    }
    try {
      let result: ActionResult;
      if (previous) result = { ...previous.result, state };
      else {
        const candidate = command.action.type === "reconcile" ? state : run(state, { type: "reconcile" }).state;
        result = run(candidate, command.action);
        state = JSON.parse(JSON.stringify(result.state)) as GameState;
        if (command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      }
      attempt.status = 200;
      await route.fulfill({ json: result });
    } catch (error) {
      attempt.status = 422;
      attempt.error = error instanceof Error ? error.message : String(error);
      await route.fulfill({ status: attempt.status, json: { error: attempt.error } });
    }
  });
  return { state: () => structuredClone(state), reads: () => reads, lastRead: () => structuredClone(lastRead), attempts, errors,
    mutations: () => attempts.filter(attempt => attempt.command.action.type !== "reconcile") };
}

async function enterEditor(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
  await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".construction-viewport canvas")).toBeVisible();
  await expect(page.locator(".world-fallback")).toHaveCount(0);
  const cutaway = page.getByRole("button", { name: "Cắt tường", exact: true });
  if ((await cutaway.getAttribute("class"))?.includes("on")) await cutaway.click();
}

async function inspectWorld(page: Page, catalogId: string | null) {
  return page.evaluate(({ catalogId, wall, openingHeight }) => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas");
    const scene = window.__doorGalleryScenes?.findLast(candidate => candidate.__r3f?.root.getState().gl.domElement === canvas);
    const root = scene?.__r3f?.root.getState();
    if (!scene || !root || !canvas) throw new Error("Actual construction WebGL scene unavailable; no fallback capture allowed");
    const { gl, camera } = root;
    if (gl.getContext().isContextLost() || gl.info.render.calls === 0) throw new Error("Construction WebGL context lost or no rendered draw calls");
    const objects: THREE.Object3D[] = [];
    scene.traverse(object => objects.push(object));
    const structural = objects.find(object => object.type === "Group" && object.position.x === wall.x + 0.5 && object.position.z === wall.z && object.position.y === 0 && (object as ObservedObject).__r3f?.handlers?.onClick);
    if (!structural) throw new Error("Supported wall mesh not found in actual construction scene");
    const solid = structural.children.find(child => child.type === "Group");
    if (!solid) throw new Error("Solid wall group unavailable");
    const model = catalogId ? objects.find(object => object.userData.doorModelId === catalogId) : undefined;
    if (catalogId && !model) throw new Error(`Rendered door model missing: ${catalogId}`);
    const leaf = model?.parent;
    const portal = leaf?.parent;
    const meshes = (group: THREE.Object3D | null | undefined) => (group?.children ?? []).filter((object): object is THREE.Mesh => (object as THREE.Mesh).isMesh).map(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const geometry = mesh.geometry as THREE.BoxGeometry | THREE.CylinderGeometry;
      return { name: mesh.name, type: geometry.type, parameters: geometry.parameters, position: mesh.position.toArray(), rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z], scale: mesh.scale.toArray(), matrixWorld: mesh.matrixWorld.toArray(), visible: mesh.visible, opacity: material.opacity, depthWrite: material.depthWrite, isGlass: mesh.userData.isOpeningGlass === true };
    });
    const bounds = canvas.getBoundingClientRect();
    const project = (x: number, y: number, z: number) => {
      const vector = structural.position.clone().set(x, y, z);
      vector.applyMatrix4(structural.matrixWorld);
      vector.project(camera);
      return { x: bounds.x + (vector.x + 1) * bounds.width / 2, y: bounds.y + (1 - vector.y) * bounds.height / 2 };
    };
    const corners = [];
    for (const x of [-0.7, 1.3]) for (const y of [-0.1, 2.95]) for (const z of [-0.25, 1.1]) corners.push(project(x, y, z));
    const left = Math.max(bounds.left, Math.min(...corners.map(p => p.x)) - 10);
    const top = Math.max(bounds.top, Math.min(...corners.map(p => p.y)) - 10);
    const right = Math.min(bounds.right, Math.max(...corners.map(p => p.x)) + 10);
    const bottom = Math.min(bounds.bottom, Math.max(...corners.map(p => p.y)) + 10);
    const context = gl.getContext();
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    return {
      catalogId, modelCount: objects.filter(object => object.userData.doorModelId).length,
      solid: meshes(solid), frames: meshes(portal), parts: meshes(model),
      leaf: leaf ? { x: leaf.position.x, rotationY: leaf.rotation.y } : null,
      frameClick: project(0, openingHeight, 0.096),
      clip: { x: left, y: top, width: right - left, height: bottom - top },
      renderer: { renderer: debug ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : String(context.getParameter(context.RENDERER)), version: String(context.getParameter(context.VERSION)), calls: gl.info.render.calls, triangles: gl.info.render.triangles },
      camera: { position: camera.position.toArray(), matrixWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray() },
    };
  }, { catalogId, wall: WALL, openingHeight: catalogId ? buildingItem(catalogId)!.openingHeight! : 1.4 });
}
type WorldSnapshot = Awaited<ReturnType<typeof inspectWorld>>;

async function worldReady(page: Page, id: string | null) {
  await expect.poll(async () => {
    try {
      const snapshot = await inspectWorld(page, id);
      const fullHeight = snapshot.solid.some(part => Math.abs(part.position[1] + part.scale[1] / 2 - 2.8) < 0.0001);
      return fullHeight && snapshot.frames.every(frame => frame.opacity === 1) ? snapshot.modelCount : -1;
    } catch { return -1; }
  }, { timeout: 30_000 }).toBe(id ? 1 : 0);
  return inspectWorld(page, id);
}

async function capture(page: Page, info: TestInfo, name: string, snapshot: WorldSnapshot) {
  expect(snapshot.clip.width).toBeGreaterThan(40);
  expect(snapshot.clip.height).toBeGreaterThan(100);
  await info.attach(`${name}-rendered-geometry`, { body: JSON.stringify(snapshot, null, 2), contentType: "application/json" });
  await info.attach(`${name}-actual-WebGL`, { body: await page.screenshot({ clip: snapshot.clip, animations: "disabled" }), contentType: "image/png" });
}

function assertDoor(snapshot: WorldSnapshot, id: string) {
  const item = buildingItem(id)!;
  const recipe = getDoorRecipe(id, item.openingWidth, item.openingHeight)!;
  expect(snapshot.parts.map(part => part.name)).toEqual(recipe.parts.map(part => part.id));
  for (const [index, part] of recipe.parts.entries()) {
    const actual = snapshot.parts[index];
    expect(actual.position).toEqual(part.position);
    expect(actual.rotation).toEqual(part.rotation);
    expect(actual.visible).toBe(true);
    expect(actual.isGlass).toBe(part.material === "glass");
    expect(actual.opacity).toBeGreaterThan(0);
    if (part.material !== "glass") expect(actual.opacity).toBe(1);
    if (part.shape === "box") expect(actual.parameters).toMatchObject({ width: part.size[0], height: part.size[1], depth: part.size[2] });
    else expect(actual.parameters).toMatchObject({ radiusTop: part.size[0] / 2, radiusBottom: part.size[0] / 2, height: part.size[1] });
  }
  expect(snapshot.frames).toHaveLength(3);
  expect(snapshot.frames.map(frame => frame.opacity)).toEqual([1, 1, 1]);
  expect(snapshot.frames[0].scale).toEqual([0.042, item.openingHeight! + 0.05, 0.185]);
  expect(snapshot.frames[1].scale).toEqual([0.042, item.openingHeight! + 0.05, 0.185]);
  expect(snapshot.frames[2].scale).toEqual([item.openingWidth! + 0.06, 0.052, 0.19]);
  const expectedSolid = wallParts({ ...WALL, opening: { kind: "door", catalogId: id } });
  expect(snapshot.solid).toHaveLength(expectedSolid.length);
  expectedSolid.forEach((part, index) => {
    [part.x, part.y, 0].forEach((value, axis) => expect(snapshot.solid[index].position[axis]).toBeCloseTo(value, 3));
    [part.width, part.height, part.depth].forEach((value, axis) => expect(snapshot.solid[index].scale[axis]).toBeCloseTo(value, 3));
  });
}

async function clickFrame(page: Page, snapshot: WorldSnapshot) {
  const point = snapshot.frameClick;
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe("CANVAS");
  await page.mouse.click(point.x, point.y);
}

async function expectLeaf(page: Page, id: string, open: boolean) {
  const width = buildingItem(id)!.openingWidth!;
  await expect.poll(async () => {
    const leaf = (await inspectWorld(page, id)).leaf!;
    return doorMotionKind(id) === "sliding" ? Math.abs(leaf.x - (open ? width / 2 : -width / 2)) : Math.abs(leaf.rotationY - (open ? -Math.PI * 0.52 : 0));
  }, { timeout: 10_000 }).toBeLessThan(0.002);
}

test.describe("door gallery V7 · notliveDB real WebGL", () => {
  test.beforeEach(async ({}, info) => {
    info.annotations.push({ type: "fixture-limits", description: JSON.stringify(LIMITS) });
  });

  for (const id of DOOR_MODEL_IDS) {
    test(`${id}: UI placement, canonical debit/reload and real leaf motion`, async ({ page }, info) => {
      const fixture = await fixtureFor(page);
      try {
        expect(BUILDING_CATALOG.filter(item => item.category === "door").map(item => item.id).sort()).toEqual([...DOOR_MODEL_IDS].sort());
        await page.goto("/");
        await enterEditor(page);
        const before = fixture.state();
        const solid = await worldReady(page, null);
        expect(solid.parts).toHaveLength(0);
        expect(solid.frames).toHaveLength(0);
        expect(solid.solid).toHaveLength(1);
        await capture(page, info, `${id}-solid-before`, solid);
        await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Cửa đi", exact: true }).click();
        const catalogButton = page.locator(".material-list button").filter({ has: page.getByText(buildingItem(id)!.name, { exact: true }) });
        await catalogButton.click();
        await expect(catalogButton).toHaveClass(/selected/);
        await page.getByRole("button", { name: /Nhập tọa độ chính xác/ }).click();
        const form = page.locator(".coordinate-form");
        for (const [key, value] of Object.entries({ x1: WALL.x, z1: WALL.z, x2: WALL.x, z2: WALL.z })) await form.locator(`input[name="${key}"]`).fill(String(value));
        await form.locator('select[name="edge"]').selectOption(WALL.orientation);
        await form.getByRole("button", { name: "Thêm vào bản nháp", exact: true }).click();
        await expect(page.locator(".draft-controls")).toContainText("BẢN NHÁP CHƯA LƯU");
        const closed = await worldReady(page, id);
        assertDoor(closed, id);
        await expectLeaf(page, id, false);
        await capture(page, info, `${id}-closed-draft`, closed);
        expect(fixture.mutations()).toHaveLength(0);
        expect(fixture.state()).toEqual(before);
        const plan = structuredClone(before.building!.plan);
        plan.walls[0].opening = { kind: "door", catalogId: id };
        const quote = quoteConstruction(before.building!, plan, before.gold);
        expect(quote.netCost).toBe(buildingItem(id)!.price);
        await expect(page.locator(".construction-cost > div > strong")).toHaveText(`${quote.netCost} G`);
        await page.getByRole("button", { name: "Lưu công trình", exact: true }).click();
        await expect(page.locator(".construction-confirm")).toContainText(`Số dư sau giao dịch: ${quote.remainingGold} G`);
        await page.getByRole("button", { name: "Xác nhận lưu", exact: true }).click();
        await expect(page.locator(".draft-controls")).toContainText("ĐÃ LƯU MỌI THAY ĐỔI");
        expect(fixture.mutations()).toHaveLength(1);
        expect(fixture.mutations()[0]).toMatchObject({ status: 200, command: { action: { type: "construction.commit", expectedRevision: before.building!.revision, plan } } });
        const committed = fixture.state();
        expect(committed.building!.plan).toEqual(plan);
        expect(committed.building!.revision).toBe(before.building!.revision + 1);
        expect(committed.gold).toBe(before.gold - quote.netCost);
        expect(committed.ledger.slice(before.ledger.length)).toMatchObject([{ amount: -quote.netCost, balance: committed.gold, reason: "Construction commit" }]);
        validateConstruction(committed.building!, committed.building!.plan, constructionContext(committed));
        await page.locator(".mode-switch").getByRole("button", { name: "Sinh hoạt", exact: true }).click();
        await expect(page.locator(".construction-editor")).toHaveClass(/live/);
        await worldReady(page, id);
        await expectLeaf(page, id, false);
        const liveClosed = await inspectWorld(page, id);
        await capture(page, info, `${id}-live-closed`, liveClosed);
        await clickFrame(page, liveClosed);
        await expectLeaf(page, id, true);
        const opened = await inspectWorld(page, id);
        assertDoor(opened, id);
        await capture(page, info, `${id}-live-open`, opened);
        await clickFrame(page, opened);
        await expectLeaf(page, id, false);
        await capture(page, info, `${id}-live-reclosed`, await inspectWorld(page, id));
        expect(fixture.state().gold).toBe(committed.gold);
        expect(fixture.mutations()).toHaveLength(1);
        const reads = fixture.reads();
        await page.reload();
        await expect.poll(fixture.reads).toBeGreaterThan(reads);
        await enterEditor(page);
        const reloaded = await worldReady(page, id);
        assertDoor(reloaded, id);
        await expectLeaf(page, id, false);
        expect(fixture.lastRead()!.building).toEqual(committed.building);
        expect(fixture.lastRead()!.gold).toBe(committed.gold);
        expect(fixture.state().gold).toBe(committed.gold);
        expect(fixture.state().ledger).toEqual(committed.ledger);
        expect(fixture.mutations()).toHaveLength(1);
        await expect(page.locator(".construction-gold strong")).toHaveText(String(committed.gold));
        await expect(page.getByRole("button", { name: "Lưu công trình", exact: true })).toBeDisabled();
        await capture(page, info, `${id}-reloaded`, reloaded);
        expect(fixture.errors).toEqual([]);
      } finally {
        await info.attach("notliveDB-domain-evidence", { body: JSON.stringify({ limits: LIMITS, attempts: fixture.attempts, state: fixture.state(), lastRead: fixture.lastRead(), errors: fixture.errors }, null, 2), contentType: "application/json" });
      }
    });
  }
});
