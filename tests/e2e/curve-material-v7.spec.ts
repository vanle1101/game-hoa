import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type * as THREE from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { constructionContext, getBuilding, quoteConstruction, validateConstruction } from "../../src/construction/engine";
import { createCurve } from "../../src/construction/curves";
import { CURVE_MATERIALS } from "../../src/construction/types";
import { curveGlassMaterial } from "../../src/components/construction/curve-material";

const NOW = "2026-10-16T08:00:00.000Z";
const LIMITS = {
  transport: "notliveDB: intercepted APIs, actual applyAction, serialized in-memory state; no database/process restart proof.",
  seed: "10,000 fixture Gold, 3,600 XP and unobstructed supported 8x8 floor. Curve placement and finishes use actual UI.",
  runtime: "Existing development server at localhost:3100; installed Chrome and actual Canvas/WebGL. Passive Three observer/read-only scene access only.",
  visuals: "Per-finish normal, selected, ghost and reload PNGs plus actual material properties; no approved pixel baseline, no multi-pane GPU performance measurement.",
};
type ObservedScene = THREE.Scene & { __r3f?: { root: { getState: () => { camera: THREE.Camera; gl: THREE.WebGLRenderer } } } };
type ProbeWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __curveMaterialScenes?: ObservedScene[] };
type Command = { key: string; expectedOwnerId?: string; action: Action };
type Attempt = { command: Command; status: number; error?: string };
function run(state: GameState, action: Action) {
  return applyAction(state, action, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() });
}
async function fixtureFor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    const target = window as ProbeWindow;
    target.__curveMaterialScenes = [];
    const observer = target.__THREE_DEVTOOLS__ ?? new EventTarget();
    target.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const object = (event as CustomEvent<ObservedScene>).detail;
      if (object?.isScene) target.__curveMaterialScenes!.push(object);
    });
  });
  let state = createInitialState("v7-curve-material-notliveDB", NOW);
  state.gold = 10_000; state.character.xp = 3_600;
  state.settings.graphics = "performance"; state.settings.reducedMotion = true;
  const building = getBuilding(state);
  building.plan = { floors: Array.from({ length: 64 }, (_, i) => ({ x: i % 8 - 4, z: Math.floor(i / 8) - 4, level: 0, materialId: "floor-concrete" })), walls: [], curves: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };
  state.building = { ...building, starterGrantApplied: true };
  validateConstruction(state.building, state.building.plan, constructionContext(state));
  state = run(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }).state;
  const attempts: Attempt[] = [], errors: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  let reads = 0, lastRead: GameState | undefined;
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") return route.fulfill({ status: 503, json: { error: "Unrelated API blocked by notliveDB fixture" } });
    if (request.method() === "GET") {
      reads++; lastRead = structuredClone(state);
      return route.fulfill({ json: { state: lastRead, mode: "local" } });
    }
    if (request.method() !== "POST") return route.fulfill({ status: 405 });
    const command = request.postDataJSON() as Command;
    const attempt: Attempt = { command: structuredClone(command), status: 0 }; attempts.push(attempt);
    if (command.expectedOwnerId !== state.userId) {
      attempt.status = 409;
      return route.fulfill({ status: 409, json: { error: "Owner mismatch", code: "OWNER_CHANGED" } });
    }
    const fingerprint = JSON.stringify(command.action), previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) {
      attempt.status = 409;
      return route.fulfill({ status: 409, json: { error: "Idempotency key payload mismatch" } });
    }
    try {
      let result: ActionResult;
      if (previous) result = { ...previous.result, state };
      else {
        result = run(command.action.type === "reconcile" ? state : run(state, { type: "reconcile" }).state, command.action);
        state = JSON.parse(JSON.stringify(result.state)) as GameState;
        if (command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      }
      attempt.status = 200; await route.fulfill({ json: result });
    } catch (error) {
      attempt.status = 422; attempt.error = error instanceof Error ? error.message : String(error);
      await route.fulfill({ status: 422, json: { error: attempt.error } });
    }
  });
  return { state: () => structuredClone(state), reads: () => reads, lastRead: () => lastRead, attempts, errors, mutations: () => attempts.filter(a => a.command.action.type !== "reconcile") };
}
async function enterEditor(page: Page) {
  await expect(page.locator(".game-shell")).toBeVisible();
  const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
  await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".construction-viewport canvas")).toBeVisible();
  await expect(page.locator(".world-fallback")).toHaveCount(0);
}
async function placeCurve(page: Page) {
  await page.getByRole("navigation", { name: "Công cụ xây dựng" }).getByRole("button", { name: "Kính cong", exact: true }).click();
  await page.getByRole("button", { name: /Nhập tọa độ chính xác/ }).click();
  const form = page.locator(".coordinate-form");
  for (const name of ["x1", "z1", "x2", "z2"]) await form.locator(`input[name="${name}"]`).fill("0");
  await form.getByRole("button", { name: "Thêm vào bản nháp", exact: true }).click();
  await expect(page.locator(".selection-details")).toBeVisible();
}
async function observe(page: Page) {
  return page.evaluate(profile => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas");
    const scene = (window as ProbeWindow).__curveMaterialScenes?.findLast(s => s.__r3f?.root.getState().gl.domElement === canvas);
    const root = scene?.__r3f?.root.getState();
    if (!canvas || !scene || !root) throw new Error("Actual construction scene unavailable");
    const { gl, camera } = root;
    if (gl.getContext().isContextLost() || gl.info.render.calls === 0) throw new Error("No live rendered WebGL frame");
    const rect = canvas.getBoundingClientRect();
    const project = (x: number, y: number, z: number, matrix?: THREE.Matrix4) => {
      const v = camera.position.clone().set(x, y, z); if (matrix) v.applyMatrix4(matrix); v.project(camera);
      return { x: rect.x + (v.x + 1) * rect.width / 2, y: rect.y + (1 - v.y) * rect.height / 2 };
    };
    const panes: { props: { color: string; transmission: number; roughness: number; opacity: number; thickness: number; metalness: number; ior: number; transparent: boolean; depthWrite: boolean }; parent: number[]; frame: string; click: { x: number; y: number }; vertices: number }[] = [];
    scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      if (!material.isMeshPhysicalMaterial || material.transmission <= 0 || !mesh.geometry.isBufferGeometry || !mesh.geometry.getAttribute("position") || !mesh.geometry.getAttribute("normal")) return;
      const parent = mesh.parent;
      if (!parent || parent.children.length !== 5) return;
      const frames = parent.children.filter(child => child !== mesh) as THREE.Mesh[];
      if (frames.length !== 4 || !frames.every(frame => frame.isMesh && !Array.isArray(frame.material) && (frame.material as THREE.MeshStandardMaterial).isMeshStandardMaterial && !(frame.material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)) return;
      const frame = frames[0].material as THREE.MeshStandardMaterial;
      const angle = profile.angle * Math.PI / 360;
      panes.push({ props: { color: `#${material.color.getHexString()}`, transmission: material.transmission, roughness: material.roughness, opacity: material.opacity, thickness: material.thickness, metalness: material.metalness, ior: material.ior, transparent: material.transparent, depthWrite: material.depthWrite }, parent: parent.position.toArray(), frame: `#${frame.color.getHexString()}`, click: project(profile.radius * Math.cos(angle), profile.height / 2, profile.radius * Math.sin(angle), mesh.matrixWorld), vertices: mesh.geometry.getAttribute("position").count });
    });
    const floors = [];
    for (const x of [-2.5, -1.5, .5, 2.5]) for (const z of [-2.5, -1.5, 2.5]) {
      const point = project(x, .01, z);
      if (document.elementFromPoint(point.x, point.y) === canvas) floors.push(point);
    }
    const context = gl.getContext(), debug = context.getExtension("WEBGL_debug_renderer_info");
    return { panes, floors, camera: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height }, renderer: { name: String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER)), calls: gl.info.render.calls, triangles: gl.info.render.triangles } };
  }, createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "probe"));
}
type Snapshot = Awaited<ReturnType<typeof observe>>;
function assertMaterial(snapshot: Snapshot, finish: string, ghost = false) {
  const expected = curveGlassMaterial(finish, { ghost });
  const pane = snapshot.panes.find(p => Math.abs(p.props.opacity - expected.opacity) < .00001);
  expect(pane, `${finish} ${ghost ? "ghost" : "pane"} in actual scene`).toBeDefined();
  expect(pane!.props).toEqual({ ...expected, thickness: createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "probe").thickness });
  expect(pane!.vertices).toBeGreaterThan(30);
  return pane!;
}
async function ready(page: Page, finish: string, ghost = false) {
  await expect.poll(async () => {
    try { const s = await observe(page); assertMaterial(s, finish, ghost); return s.panes.length; } catch { return -1; }
  }).toBe(ghost ? 2 : 1);
  return observe(page);
}
async function capture(page: Page, info: TestInfo, label: string, snapshot: Snapshot) {
  await info.attach(`${label}-actual-material`, { body: JSON.stringify(snapshot, null, 2), contentType: "application/json" });
  await info.attach(`${label}-actual-WebGL`, { body: await page.screenshot({ clip: snapshot.clip, animations: "disabled" }), contentType: "image/png" });
}
async function selectPane(page: Page, snapshot: Snapshot) {
  const point = snapshot.panes[0].click;
  expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName, point)).toBe("CANVAS");
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".selection-details")).toBeVisible();
}
for (const finish of CURVE_MATERIALS) {
  test(`${finish}: normal selected ghost physical material and canonical reload`, async ({ page }, info) => {
    info.annotations.push({ type: "fixture-limits", description: JSON.stringify(LIMITS) });
    const fixture = await fixtureFor(page);
    try {
      await page.goto("/"); await enterEditor(page); await placeCurve(page);
      const before = fixture.state(), selection = page.locator(".selection-details");
      await selection.getByRole("combobox", { name: "Vật liệu kính cong", exact: true }).selectOption(finish);
      const selected = await ready(page, finish);
      expect(assertMaterial(selected, finish).frame).toBe("#53f5e2");
      await capture(page, info, `${finish}-selected`, selected);
      await selection.locator(".eyebrow").click();
      await page.keyboard.press("Escape");
      await expect(selection).toHaveCount(0);
      const normal = await ready(page, finish);
      expect(assertMaterial(normal, finish).frame).not.toBe("#53f5e2");
      expect(normal.camera).toEqual(selected.camera);
      await capture(page, info, `${finish}-normal`, normal);
      await selectPane(page, normal);
      await selection.getByRole("button", { name: "Di chuyển", exact: true }).click();
      const target = normal.floors[0]; expect(target).toBeDefined();
      await page.mouse.move(target.x, target.y);
      const ghost = await ready(page, finish, true);
      assertMaterial(ghost, finish); assertMaterial(ghost, finish, true);
      expect(ghost.camera).toEqual(selected.camera);
      await capture(page, info, `${finish}-ghost`, ghost);
      expect(fixture.mutations()).toHaveLength(0); expect(fixture.state()).toEqual(before);
      await page.keyboard.press("Escape");
      await page.mouse.move(10, 10);
      await ready(page, finish);
      const plan = structuredClone(before.building!.plan);
      plan.curves = [{ ...createCurve("curve-bay", { x: 0, z: 0, level: 0 }, "expected"), material: finish }];
      const quote = quoteConstruction(before.building!, plan, before.gold);
      await expect(page.locator(".construction-cost > div > strong")).toHaveText(`${quote.netCost} G`);
      await page.getByRole("button", { name: "Lưu công trình", exact: true }).click();
      await expect(page.locator(".construction-confirm")).toContainText(`Số dư sau giao dịch: ${quote.remainingGold} G`);
      await page.getByRole("button", { name: "Xác nhận lưu", exact: true }).click();
      await expect(page.locator(".draft-controls")).toContainText("ĐÃ LƯU MỌI THAY ĐỔI");
      expect(fixture.mutations()).toHaveLength(1);
      const committed = fixture.state(), curve = committed.building!.plan.curves![0];
      expect(committed.building!.plan.curves).toHaveLength(1);
      expect(curve).toEqual({ ...plan.curves[0], id: curve.id });
      expect(committed.building!.revision).toBe(before.building!.revision + 1);
      expect(committed.gold).toBe(quote.remainingGold);
      expect(committed.ledger.slice(before.ledger.length)).toMatchObject([{ amount: -quote.netCost, balance: committed.gold, reason: "Construction commit" }]);
      validateConstruction(committed.building!, committed.building!.plan, constructionContext(committed));
      const reads = fixture.reads(); await page.reload(); await enterEditor(page);
      expect(fixture.reads()).toBeGreaterThan(reads);
      expect(fixture.lastRead()!.building).toEqual(committed.building);
      expect(fixture.state().ledger).toEqual(committed.ledger);
      expect(fixture.mutations()).toHaveLength(1);
      const reloaded = await ready(page, finish);
      await capture(page, info, `${finish}-reloaded`, reloaded);
      await selectPane(page, reloaded);
      await expect(page.locator(".selection-details").getByRole("combobox", { name: "Vật liệu kính cong", exact: true })).toHaveValue(finish);
      expect(fixture.errors).toEqual([]);
    } finally {
      await info.attach("notliveDB-domain-evidence", { body: JSON.stringify({ limits: LIMITS, attempts: fixture.attempts, state: fixture.state(), lastRead: fixture.lastRead(), errors: fixture.errors }, null, 2), contentType: "application/json" });
    }
  });
}

 test("clear and frosted optical contracts differ", () => {
  expect(curveGlassMaterial("clear").transmission).toBeGreaterThan(curveGlassMaterial("frosted").transmission);
  expect(curveGlassMaterial("clear").roughness).toBeLessThan(curveGlassMaterial("frosted").roughness);
});
