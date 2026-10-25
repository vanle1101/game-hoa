import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type * as THREE from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, ActionResult } from "../../src/domain/types";
import { constructionContext, getBuilding, validateConstruction } from "../../src/construction/engine";
import { createCurve, customizeCurve } from "../../src/construction/curves";

type Scene = THREE.Scene & { __r3f?: { root: { getState: () => { gl: THREE.WebGLRenderer; camera: THREE.Camera } } } };
type ProbeWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __curvePerformanceScenes?: Scene[] };
const NOW = "2026-10-16T08:00:00.000Z";
const LIMITS = {
  transport: "All APIs intercepted; actual domain engine with in-memory serialized state, not live database or process-restart evidence.",
  measurement: "Six application HUD FPS observations per case spaced at least 3250ms; HUD estimate, not synthetic RAF FPS, GPU timer query or profiler benchmark.",
  renderer: "Read-only actual Three renderer counters are last-render snapshots; transmission multipass counters may reset and are not guaranteed total GPU work.",
  coverage: "Fixed 8x8 floor and quarter-arc clear panes radius0.5/height2.6/thickness0.12, fixed desktop viewport, reduced motion; no universal hardware target or 60FPS threshold.",
  memory: "Renderer memory fields count geometries/textures, not GPU byte usage; no GPU-memory claim.",
};
function seed(count: number, quality: "balanced" | "performance") {
  let state = createInitialState(`curve-performance-${quality}-${count}`, NOW);
  state.gold = 100000; state.character.xp = 3600;
  state.settings.graphics = quality; state.settings.reducedMotion = true;
  const building = getBuilding(state);
  building.plan = { floors: Array.from({ length: 64 }, (_, i) => ({ x: i % 8 - 4, z: Math.floor(i / 8) - 4, level: 0, materialId: "floor-concrete" })), walls: [], curves: [], furniture: [], stairs: [], ceilings: [], roofs: [], roomNames: {} };
  state.building = { ...building, starterGrantApplied: true };
  const context = () => ({ userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() });
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "aurora-tower", floor: 24, layoutId: "studio" }, context()).state;
  const plan = structuredClone(state.building!.plan);
  plan.curves = Array.from({ length: count }, (_, i) => customizeCurve(createCurve("curve-bay", { x: [-3, -1, 1, 3][i % 4], z: [-3, -1, 1][Math.floor(i / 4)], level: 0 }, `performance-pane-${i}`), { radius: .5, angle: 90, height: 2.6, thickness: .12, material: "clear" }));
  validateConstruction(state.building!, plan, constructionContext(state));
  state = applyAction(state, { type: "construction.commit", plan, expectedRevision: state.building!.revision }, context()).state;
  validateConstruction(state.building!, state.building!.plan, constructionContext(state));
  return state;
}
async function fixture(page: Page, count: number, quality: "balanced" | "performance") {
  let state = seed(count, quality);
  const commands: { key: string; action: Action; expectedOwnerId?: string }[] = [];
  const errors: string[] = [], consoleErrors: string[] = [], unexpectedApi: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(() => {
    localStorage.setItem("lifelevel-entered", "true");
    const target = window as ProbeWindow;
    const observer = target.__THREE_DEVTOOLS__ ?? new EventTarget();
    target.__THREE_DEVTOOLS__ = observer; target.__curvePerformanceScenes = [];
    observer.addEventListener("observe", event => { const scene = (event as CustomEvent<Scene>).detail; if (scene?.isScene) target.__curvePerformanceScenes!.push(scene); });
  });
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") { unexpectedApi.push(request.url()); return route.fulfill({ status: 503, json: { error: "Unrelated API blocked by fixture" } }); }
    if (request.method() === "GET") return route.fulfill({ json: { state: structuredClone(state), mode: "local" } });
    if (request.method() !== "POST") return route.fulfill({ status: 405 });
    const command = request.postDataJSON() as typeof commands[number]; commands.push(structuredClone(command));
    if (command.expectedOwnerId !== state.userId) return route.fulfill({ status: 409, json: { error: "Owner mismatch", code: "OWNER_CHANGED" } });
    const previous = receipts.get(command.key), fingerprint = JSON.stringify(command.action);
    if (previous && previous.fingerprint !== fingerprint) return route.fulfill({ status: 409, json: { error: "Key payload mismatch" } });
    try {
      const result = previous ? { ...previous.result, state } : applyAction(state, command.action, { userId: state.userId, now: NOW, random: () => .5, eventId: command.key });
      state = JSON.parse(JSON.stringify(result.state));
      receipts.set(command.key, { fingerprint, result });
      return route.fulfill({ json: result });
    } catch (error) { errors.push(String(error)); return route.fulfill({ status: 422, json: { error: String(error) } }); }
  });
  return { state: () => structuredClone(state), commands, errors, consoleErrors, unexpectedApi };
}
async function observe(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".construction-viewport canvas");
    const scene = (window as ProbeWindow).__curvePerformanceScenes?.findLast(s => s.__r3f?.root.getState().gl.domElement === canvas);
    const root = scene?.__r3f?.root.getState();
    if (!canvas || !scene || !root) throw new Error("Live construction renderer unavailable");
    const { gl, camera } = root, context = gl.getContext(), debug = context.getExtension("WEBGL_debug_renderer_info");
    const panes: { uuid: string; transmission: number; opacity: number; vertices: number; ndc: number[]; intersectsViewport: boolean }[] = [];
    scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const material = mesh.material as THREE.MeshPhysicalMaterial;
      if (!material.isMeshPhysicalMaterial || material.transmission <= 0 || mesh.parent?.children.length !== 5) return;
      const frames = mesh.parent.children.filter(child => child !== mesh) as THREE.Mesh[];
      if (!frames.every(frame => frame.isMesh && !Array.isArray(frame.material) && (frame.material as THREE.MeshStandardMaterial).isMeshStandardMaterial && !(frame.material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)) return;
      const positions = mesh.geometry.getAttribute("position");
      if (!positions) return;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < positions.count; i++) {
        const p = mesh.position.clone().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
        [p.x, p.y, p.z].forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
      }
      let visible = true;
      for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) visible = false;
      panes.push({ uuid: mesh.uuid, transmission: material.transmission, opacity: material.opacity, vertices: positions.count, ndc: [...min, ...max], intersectsViewport: visible && material.visible && min.every((value, axis) => value <= 1 && max[axis] >= -1) });
    });
    const rect = canvas.getBoundingClientRect(), hud = document.querySelector(".construction-help")?.textContent ?? "";
    const match = hud.match(/(\d+(?:\.\d+)?)\s*FPS/);
    return { wallTime: new Date().toISOString(), monotonicMs: performance.now(), hud, fps: match ? Number(match[1]) : null, documentHidden: document.hidden, liveGL: !context.isContextLost(), panes, canvas: { width: canvas.width, height: canvas.height, css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, devicePixelRatio: window.devicePixelRatio, rendererPixelRatio: gl.getPixelRatio() }, renderer: { vendor: String(context.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : context.VENDOR)), name: String(context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER)), version: String(context.getParameter(context.VERSION)), calls: gl.info.render.calls, triangles: gl.info.render.triangles, lines: gl.info.render.lines, points: gl.info.render.points, frame: gl.info.render.frame, autoReset: gl.info.autoReset, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }, camera: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), userAgent: navigator.userAgent, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches };
  });
}
test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
for (const quality of ["balanced", "performance"] as const) for (const count of [1, 6, 12]) {
  test(`${quality}: ${count} clear transmission panes HUD observations`, async ({ page }, info) => {
    test.setTimeout(90000);
    const game = await fixture(page, count, quality), samples: Awaited<ReturnType<typeof observe>>[] = [];
    const baseline = game.state();
    try {
      await page.goto("/");
      await expect(page.locator(".game-shell")).toBeVisible();
      await page.locator(".sidebar").getByRole("button", { name: "Xây dựng", exact: true }).click();
      await expect(page.locator(".construction-editor")).toHaveAttribute("aria-busy", "false");
      const canvas = page.locator(".construction-viewport canvas");
      await expect(canvas).toBeVisible();
      await canvas.evaluate(node => node.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      await expect.poll(async () => { try { const s = await observe(page); return s.liveGL && s.renderer.calls > 0 && s.panes.length === count && s.fps !== null && s.fps > 0; } catch { return false; } }).toBe(true);
      for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(3250);
        const sample = await observe(page); samples.push(sample);
        expect(sample.liveGL).toBe(true); expect(sample.documentHidden).toBe(false);
        expect(sample.panes).toHaveLength(count);
        expect(sample.panes.every(pane => pane.intersectsViewport && pane.transmission > 0 && pane.vertices > 0)).toBe(true);
        expect(sample.fps).not.toBeNull(); expect(Number.isFinite(sample.fps)).toBe(true);
        expect(sample.renderer.calls).toBeGreaterThan(0); expect(sample.renderer.triangles).toBeGreaterThan(0);
        expect(sample.reducedMotion).toBe(true);
        const bounds = sample.canvas.css;
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(1440); expect(bounds.y + bounds.height).toBeLessThanOrEqual(1000);
        if (i) { expect(sample.monotonicMs - samples[i - 1].monotonicMs).toBeGreaterThanOrEqual(3250); expect(sample.renderer.frame).toBeGreaterThan(samples[i - 1].renderer.frame); expect(sample.camera).toEqual(samples[0].camera); expect(sample.canvas).toEqual(samples[0].canvas); }
      }
      await info.attach("actual-transmission-layout", { body: await canvas.screenshot({ animations: "disabled", scale: "css" }), contentType: "image/png" });
      expect(game.commands.filter(command => command.action.type !== "reconcile")).toEqual([]);
      expect(game.state().building).toEqual(baseline.building);
      expect(game.state().gold).toBe(baseline.gold);
      expect(game.errors).toEqual([]); expect(game.consoleErrors).toEqual([]); expect(game.unexpectedApi).toEqual([]);
    } finally {
      const values = samples.flatMap(sample => sample.fps === null ? [] : [sample.fps]);
      await info.attach("curve-performance-observations", { body: JSON.stringify({ limits: LIMITS, quality, expectedPaneCount: count, samples, summary: values.length ? { count: values.length, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length } : null, seededPlan: baseline.building?.plan, commands: game.commands, errors: game.errors, consoleErrors: game.consoleErrors, unexpectedApi: game.unexpectedApi }, null, 2), contentType: "application/json" });
    }
  });
}
