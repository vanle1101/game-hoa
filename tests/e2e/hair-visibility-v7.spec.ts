import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type * as THREE from "three";
import { createInitialState, applyAction } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { COSMETICS } from "../../src/character/catalog";
const NOW = "2026-10-16T08:00:00.000Z";
const fashionSnapshot = structuredClone(COSMETICS);
type Command = { key: string; action: Action; expectedOwnerId?: string };
async function isolatedGame(page: Page) {
  let state = createInitialState("fashion-observation-owned-fixture", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  {
    const level = Math.max(100, ...fashionSnapshot.map(item => item.level ?? 1));
    state.character.xp = (level - 1) ** 2 * 100;
    state.ownedCosmetics = fashionSnapshot.map(item => item.id);
    state.equippedCosmetics = {};
  }
  const commands: Command[] = [];
  const errors: string[] = [], consoleErrors: string[] = [], warnings: string[] = [], unexpectedApi: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") {
      unexpectedApi.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 503, json: { error: "API ngoài phạm vi kiểm thử." } });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ json: { state, mode: "local" } });
      return;
    }
    if (request.method() !== "POST") {
      unexpectedApi.push(`${request.method()} ${request.url()}`);
      await route.fulfill({ status: 405, json: { error: "Phương thức không được hỗ trợ." } });
      return;
    }
    const command = request.postDataJSON() as Command;
    commands.push(structuredClone(command));
    if (command.expectedOwnerId && command.expectedOwnerId !== state.userId) {
      await route.fulfill({ status: 409, json: { error: "Phiên người chơi đã thay đổi.", code: "OWNER_CHANGED" } });
      return;
    }
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) {
      await route.fulfill({ status: 409, json: { error: "Mã thao tác đã được dùng cho nội dung khác." } });
      return;
    }
    try {
      let result: ActionResult;
      if (previous) result = { ...previous.result, state };
      else {
        const context = { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() };
        if (command.action.type !== "reconcile") state = applyAction(state, { type: "reconcile" }, { ...context, eventId: randomUUID() }).state;
        result = applyAction(state, command.action, context);
        state = result.state;
        if (command.action.type !== "reconcile") receipts.set(command.key, { fingerprint, result });
      }
      await route.fulfill({ json: result });
    } catch (error) {
      await route.fulfill({ status: 422, json: { error: error instanceof Error ? error.message : "Thao tác không hợp lệ." } });
    }
  });
  await page.addInitScript(() => {
    const observed = window as typeof window & { __fashionScenes?: THREE.Scene[] };
    observed.__fashionScenes = [];
    const observer = window.__THREE_DEVTOOLS__ ?? new EventTarget();
    window.__THREE_DEVTOOLS__ = observer;
    observer.addEventListener("observe", event => {
      const object = (event as CustomEvent<THREE.Scene>).detail;
      if (object?.isScene) observed.__fashionScenes!.push(object);
    });
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
        const target = prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
        const original = target[method];
        if (!original || !Object.prototype.hasOwnProperty.call(prototype, method)) continue;
        target[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          const result = original.apply(this, args);
          if (this.canvas instanceof HTMLCanvasElement) {
            this.canvas.dataset.expandedCanvasId ??= crypto.randomUUID();
            this.canvas.dataset.expandedDraws = String(Number(this.canvas.dataset.expandedDraws ?? 0) + 1);
          }
          return result;
        };
      }
    }
  });
  return { state: () => state, commands, errors, consoleErrors, warnings, unexpectedApi };
}

type BrowserGame = Awaited<ReturnType<typeof isolatedGame>>;
const mutations = (game: BrowserGame) => game.commands.filter(command => command.action.type !== "reconcile");
const economy = (state: GameState) => structuredClone({
  gold: state.gold, ledger: state.ledger, inventory: state.inventory, materials: state.materials,
  ownedFurniture: state.ownedFurniture, ownedCosmetics: state.ownedCosmetics,
});
function healthy(game: BrowserGame) {
  expect(game.errors).toEqual([]);
  expect(game.consoleErrors).toEqual([]);
  expect(game.unexpectedApi).toEqual([]);
}
async function openSection(page: Page, name: string) {
  await page.goto("http://127.0.0.1:3100/");
  const dismiss = page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true });
  await expect(page.locator(".sidebar")).toBeAttached();
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
}
const drawCount = async (canvas: Locator) => Number(await canvas.getAttribute("data-expanded-draws") ?? 0);
const drawSnapshot = async (canvas: Locator) => ({ id: await canvas.getAttribute("data-expanded-canvas-id"), draws: await drawCount(canvas) });
async function freshDraw(canvas: Locator, before: Awaited<ReturnType<typeof drawSnapshot>>) {
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    const current = await drawSnapshot(canvas);
    return Boolean(current.id) && (current.id === before.id ? current.draws > before.draws : current.draws > 0);
  }).toBe(true);
}
function canonicalFingerprint(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
    if (typeof input === "number") assert.ok(Number.isFinite(input));
    return input;
  };
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function productSourceBinding() {
  const root = process.cwd();
  const scan = (directory: string): { path: string; sha256: string }[] => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? scan(path) : [{ path: relative(root, path).replaceAll("\\", "/"), sha256: createHash("sha256").update(readFileSync(path)).digest("hex") }];
  });
  const files = scan(join(root, "src"));
  return { hash: canonicalFingerprint(files), files };
}
type FullRenderRecord = { meshes: { geometry: { attributes: Record<string, { values: number[] } | null> }; materials: Record<string, unknown>[] }[]; camera: { matrixWorld: number[] }; [key: string]: unknown };
type SnapshotHost = Window & { __hairSnapshots?: Map<string, string> };
async function renderFingerprint(canvas: Locator) {
  const hostStart = performance.now();
  const compact = await canvas.evaluate(async element => {
    const collectionStart = performance.now();
    type SceneRoot = THREE.Scene & { __r3f?: { root: { getState: () => { camera: THREE.Camera; gl: THREE.WebGLRenderer; scene: THREE.Scene } } } };
    const scenes = (window as typeof window & { __fashionScenes?: SceneRoot[] }).__fashionScenes ?? [];
    const root = scenes.map(scene => scene.__r3f?.root.getState()).filter(state => state?.gl.domElement === element).at(-1);
    if (!root) throw Error("Render fingerprint unavailable: active R3F root not observed");
    const unknowns: string[] = [];
    const materialRecord = (material: THREE.Material) => {
      const raw = material.toJSON() as unknown as Record<string, unknown>;
      const { uuid: _uuid, metadata: _metadata, ...data } = raw;
      void _uuid; void _metadata;
      for (const [key, value] of Object.entries(material)) if (value && typeof value === "object" && "isTexture" in value && value.isTexture) unknowns.push(`texture:${key}`);
      if (material.type.includes("Shader")) unknowns.push(`shader:${material.type}`);
      if (Object.hasOwn(material, "onBeforeCompile")) unknowns.push("custom-shader-hook");
      if (material.clippingPlanes?.length) unknowns.push("material-clipping-planes");
      return data;
    };
    const geometryRecord = (geometry: THREE.BufferGeometry) => {
      const attribute = (value: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
        if ("isInterleavedBufferAttribute" in value) { unknowns.push("interleaved-geometry"); return null; }
        return { itemSize: value.itemSize, normalized: value.normalized, type: value.array.constructor.name, values: Array.from(value.array) };
      };
      return { type: geometry.type, index: geometry.index ? attribute(geometry.index) : null, attributes: Object.fromEntries(Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, attribute(value)])), morphAttributes: Object.fromEntries(Object.entries(geometry.morphAttributes).map(([key, values]) => [key, values?.map(attribute)])), morphTargetsRelative: geometry.morphTargetsRelative, groups: geometry.groups, drawRange: { start: geometry.drawRange.start, count: geometry.drawRange.count === Infinity ? "Infinity" : geometry.drawRange.count } };
    };
    const meshes: { path: string; geometry: ReturnType<typeof geometryRecord>; materials: ReturnType<typeof materialRecord>[]; matrixWorld: number[]; castShadow: boolean; receiveShadow: boolean; renderOrder: number; frustumCulled: boolean; layers: number; morphTargetInfluences: number[] | null }[] = [];
    const lights: object[] = [];
    const rig = root.scene.getObjectByName("character-rig");
    if (!rig || !rig.visible) throw Error("Character rig absent or hidden");
    const joints: Record<string, number[][]> = {};
    const wearableCounts: Record<string, number> = {};
    rig.traverse(object => {
      if (["torso", "left-arm", "right-arm", "left-thigh", "right-thigh", "left-shin", "right-shin"].includes(object.name)) (joints[object.name] ??= []).push([object.rotation.x, object.rotation.y, object.rotation.z]);
      if (object.name.startsWith("wearables-")) {
        let count = 0; object.traverse(child => { if ((child as THREE.Mesh).isMesh && child.visible) count++; });
        wearableCounts[object.name.slice("wearables-".length)] = count;
      }
    });
    const visit = (object: THREE.Object3D, path: string, visible: boolean) => {
      visible = visible && object.visible;
      if (!visible) return;
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) unknowns.push(`unsupported-mesh:${path}`);
        meshes.push({ path, geometry: geometryRecord(mesh.geometry), materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(materialRecord), matrixWorld: mesh.matrixWorld.toArray(), castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, renderOrder: mesh.renderOrder, frustumCulled: mesh.frustumCulled, layers: mesh.layers.mask, morphTargetInfluences: mesh.morphTargetInfluences ?? null });
      }
      const light = object as THREE.Light & Partial<THREE.PointLight & THREE.SpotLight & THREE.HemisphereLight>;
      if (light.isLight) lights.push({ path, type: light.type, color: light.color.toArray(), intensity: light.intensity, matrixWorld: light.matrixWorld.toArray(), castShadow: light.castShadow, distance: light.distance ?? null, decay: light.decay ?? null, angle: light.angle ?? null, penumbra: light.penumbra ?? null, groundColor: light.groundColor?.toArray() ?? null, target: light.target?.matrixWorld.toArray() ?? null });
      if ((object as THREE.Line).isLine || (object as THREE.Points).isPoints || (object as THREE.Sprite).isSprite) unknowns.push(`unsupported-drawable:${path}`);
      object.children.forEach((child, index) => visit(child, `${path}/${index}`, visible));
    };
    visit(root.scene, "scene", true);
    if (root.scene.environment || root.scene.overrideMaterial || (root.scene.background && !(root.scene.background as THREE.Color).isColor)) unknowns.push("scene-texture-or-override");
    if (root.gl.clippingPlanes.length) unknowns.push("renderer-clipping-planes");
    const record = { unknowns, meshes, lights, joints, wearableCounts, camera: { type: root.camera.type, matrixWorld: root.camera.matrixWorld.toArray(), matrixWorldInverse: root.camera.matrixWorldInverse.toArray(), projectionMatrix: root.camera.projectionMatrix.toArray(), layers: root.camera.layers.mask }, scene: { background: (root.scene.background as THREE.Color | null)?.toArray() ?? null, fog: root.scene.fog?.toJSON() ?? null }, renderer: { outputColorSpace: root.gl.outputColorSpace, toneMapping: root.gl.toneMapping, toneMappingExposure: root.gl.toneMappingExposure, shadowMap: { enabled: root.gl.shadowMap.enabled, type: root.gl.shadowMap.type }, localClippingEnabled: root.gl.localClippingEnabled } };
    const collectionMs = performance.now() - collectionStart;
    const canonical = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(canonical);
      if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)]));
      if (typeof input === "number" && !Number.isFinite(input)) throw Error("Non-finite render record value");
      return input;
    };
    const canonicalStart = performance.now(), normalized = canonical(record), canonicalMs = performance.now() - canonicalStart;
    const stringifyStart = performance.now(), json = JSON.stringify(normalized), stringifyMs = performance.now() - stringifyStart;
    const token = crypto.randomUUID(), host = window as SnapshotHost;
    host.__hairSnapshots ??= new Map();
    host.__hairSnapshots.clear();
    host.__hairSnapshots.set(token, json);
    const bytes = new TextEncoder().encode(json), digestStart = performance.now();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
    return { token, hash, byteLength: bytes.length, unknowns, joints, camera: record.camera, meshCount: meshes.length, wearableCounts, timings: { collectionMs, canonicalMs, stringifyMs, digestMs: performance.now() - digestStart } };
  });
  expect(compact.meshCount).toBeGreaterThan(0);
  expect(compact.unknowns).toEqual([]);
  for (const name of ["torso", "left-arm", "right-arm", "left-thigh", "right-thigh", "left-shin", "right-shin"]) expect(compact.joints[name]).toEqual([[0, 0, 0]]);
  return { ...compact, timings: { ...compact.timings, hostRoundTripMs: performance.now() - hostStart } };
}
async function retainedSnapshot(canvas: Locator, snapshot: Awaited<ReturnType<typeof renderFingerprint>>, controls: boolean) {
  const transferStart = performance.now();
  const json = await canvas.evaluate((_element, token) => {
    const json = (window as SnapshotHost).__hairSnapshots?.get(token);
    if (json === undefined) throw Error("Exact retained snapshot token missing");
    return json;
  }, snapshot.token);
  const fullTransferMs = performance.now() - transferStart;
  assert.equal(Buffer.byteLength(json, "utf8"), snapshot.byteLength);
  assert.equal(createHash("sha256").update(json, "utf8").digest("hex"), snapshot.hash);
  const record = JSON.parse(json) as FullRenderRecord;
  assert.equal(canonicalFingerprint(record), snapshot.hash);
  let controlHashes: object | null = null;
  if (controls) {
    const hostControls = [record, structuredClone(record), structuredClone(record), structuredClone(record)];
    const position = hostControls[1].meshes.find(mesh => mesh.geometry.attributes.position)?.geometry.attributes.position;
    assert.ok(position); position.values[0] += 1;
    hostControls[2].meshes[0].materials[0].opacity = Number(hostControls[2].meshes[0].materials[0].opacity ?? 1) / 2;
    hostControls[3].camera.matrixWorld[12] += 1;
    const nodeHashes = hostControls.map(canonicalFingerprint);
    const browserHashes = await canvas.evaluate(async (_element, token) => {
      const json = (window as SnapshotHost).__hairSnapshots?.get(token);
      if (json === undefined) throw Error("Control snapshot token missing");
      const record = JSON.parse(json) as FullRenderRecord;
      const variants = [record, structuredClone(record), structuredClone(record), structuredClone(record)];
      const position = variants[1].meshes.find(mesh => mesh.geometry.attributes.position)?.geometry.attributes.position;
      if (!position) throw Error("Negative geometry control unavailable");
      position.values[0] += 1;
      variants[2].meshes[0].materials[0].opacity = Number(variants[2].meshes[0].materials[0].opacity ?? 1) / 2;
      variants[3].camera.matrixWorld[12] += 1;
      const canonical = (input: unknown): unknown => {
        if (Array.isArray(input)) return input.map(canonical);
        if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)]));
        if (typeof input === "number" && !Number.isFinite(input)) throw Error("Non-finite control value");
        return input;
      };
      return await Promise.all(variants.map(async value => {
        const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      }));
    }, snapshot.token);
    assert.deepEqual(browserHashes, nodeHashes);
    assert.equal(nodeHashes[0], snapshot.hash);
    for (const hash of nodeHashes.slice(1)) assert.notEqual(hash, snapshot.hash);
    controlHashes = { nodeHashes, browserHashes };
  }
  await canvas.evaluate((_element, token) => { (window as SnapshotHost).__hairSnapshots?.delete(token); }, snapshot.token);
  return { json, record, fullTransferMs, controlHashes };
}

const faces = ["Trái xoan", "Trái tim", "Góc cạnh", "Tròn", "Thuôn dài", "Vuông"];
const hairstyles = ["Ngắn tự nhiên", "Cắt sát"];
const canvasSelector = ".studio-canvas canvas";
async function artifact(info: TestInfo, name: string, data: unknown) {
  const path = info.outputPath(`${name}.json`), content = JSON.stringify(data);
  await writeFile(path, content);
  await info.attach(name, { path, contentType: "application/json" });
  return { path, sha256: createHash("sha256").update(content).digest("hex") };
}
async function captureAngle(page: Page, info: TestInfo, label: string, controls: boolean) {
  const canvas = page.locator(canvasSelector);
  await canvas.evaluate(node => node.scrollIntoView({ block: "start" }));
  const bounds = await canvas.boundingBox(), viewport = page.viewportSize();
  expect(bounds).not.toBeNull(); expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
  const live = await canvas.evaluate(node => { const canvas = node as HTMLCanvasElement, gl = canvas.getContext("webgl2"); return { live: Boolean(gl && !gl.isContextLost()), width: canvas.width, height: canvas.height }; });
  expect(live.live).toBe(true);
  let semantic = await renderFingerprint(canvas), previous = semantic.hash, streak = 0;
  const samples: object[] = [{ ...semantic, streak }];
  try {
    await expect.poll(async () => {
      semantic = await renderFingerprint(canvas);
      streak = semantic.hash === previous ? streak + 1 : 0; previous = semantic.hash;
      samples.push({ ...semantic, streak });
      return streak;
    }, { timeout: 20_000, intervals: [200, 200, 200] }).toBeGreaterThanOrEqual(3);
  } finally {
    await artifact(info, `${label}-sample-series`, samples);
  }
  const retained = await retainedSnapshot(canvas, semantic, controls);
  const recordPath = info.outputPath(`${label}-render-records.json`);
  await writeFile(recordPath, retained.json);
  const records = { path: recordPath, sha256: semantic.hash, byteLength: semantic.byteLength };
  await info.attach(`${label}-render-records-reference`, { body: JSON.stringify(records), contentType: "application/json" });
  await artifact(info, `${label}-snapshot-verification`, { hash: semantic.hash, token: semantic.token, fullTransferMs: retained.fullTransferMs, controlHashes: retained.controlHashes });
  expect(await canvas.boundingBox()).toEqual(bounds);
  const path = info.outputPath(`${label}-original.png`), png = await canvas.screenshot({ path, animations: "disabled" });
  expect(png.byteLength).toBeGreaterThan(1500);
  await info.attach(`${label}-original`, { path, contentType: "image/png" });
  return { label, path, pngSha256: createHash("sha256").update(png).digest("hex"), semanticHash: semantic.hash, camera: semantic.camera, records, bounds, live, viewport, dpr: await page.evaluate(() => devicePixelRatio), acceptance: "OBSERVATION_ONLY_REQUIRES_VISUAL_REVIEW" };
}
async function chooseAppearance(page: Page, face: string, hairstyle: string) {
  const studio = page.getByRole("region", { name: "Xưởng tạo nhân vật", exact: true });
  await studio.getByRole("button", { name: "Ngoại hình", exact: true }).click();
  await studio.getByRole("group", { name: "Nhóm ngoại hình", exact: true }).getByRole("button", { name: "Khuôn mặt" }).click();
  await studio.getByRole("region", { name: "Khuôn mặt", exact: true }).getByRole("button", { name: face, exact: true }).click();
  await expect(studio.getByRole("region", { name: "Khuôn mặt", exact: true }).getByRole("button", { name: face, exact: true })).toHaveAttribute("aria-pressed", "true");
  await studio.getByRole("group", { name: "Nhóm ngoại hình", exact: true }).getByRole("button", { name: /Tóc/ }).click();
  await studio.getByRole("region", { name: "Tóc", exact: true }).getByRole("button", { name: hairstyle, exact: true }).click();
  await expect(studio.getByRole("region", { name: "Tóc", exact: true }).getByRole("button", { name: hairstyle, exact: true })).toHaveAttribute("aria-pressed", "true");
  return studio;
}
async function angles(page: Page, info: TestInfo, label: string, focus: "Toàn thân" | "Cận mặt", captures: object[], firstAngle: number) {
  const studio = page.getByRole("region", { name: "Xưởng tạo nhân vật", exact: true }), canvas = page.locator(canvasSelector);
  await studio.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
  await studio.getByRole("button", { name: focus, exact: true }).click();
  for (let step = 0; step < firstAngle; step++) {
    const before = await drawSnapshot(canvas);
    await studio.getByRole("button", { name: "Xoay phải", exact: true }).click({ clickCount: 2 });
    await freshDraw(canvas, before);
  }
  let previousCamera: string | undefined;
  for (let angle = firstAngle; angle < firstAngle + 2; angle++) {
    if (angle > firstAngle) {
      const before = await drawSnapshot(canvas);
      await studio.getByRole("button", { name: "Xoay phải", exact: true }).click({ clickCount: 2 });
      await freshDraw(canvas, before);
    }
    const result = await captureAngle(page, info, `${label}-${angle * 45}deg`, angle === firstAngle);
    const camera = JSON.stringify(result.camera);
    if (previousCamera) expect(camera).not.toBe(previousCamera);
    previousCamera = camera;
    captures.push(result);
  }
}
async function observe(page: Page, info: TestInfo, run: (captures: object[]) => Promise<void>) {
  const source = productSourceBinding(), game = await isolatedGame(page), baseline = economy(game.state()), captures: object[] = [];
  await artifact(info, "source-before", source);
  try {
    await openSection(page, "Nhân vật");
    await run(captures);
    expect(mutations(game)).toEqual([]);
    expect(economy(game.state())).toEqual(baseline);
    healthy(game);
    expect(productSourceBinding().hash).toBe(source.hash);
  } finally {
    await artifact(info, "observation-summary", { kind: "BOUNDED_HAIR_VISUAL_OBSERVATION_NOT_PREMIUM_ACCEPTANCE", sourceBefore: source.hash, sourceAfter: productSourceBinding().hash, captures, commands: game.commands, errors: game.errors, consoleErrors: game.consoleErrors, unexpectedApi: game.unexpectedApi, warnings: game.warnings, baseline, finalEconomy: economy(game.state()) });
  }
}
test.beforeAll(() => expect(process.env.HAIR_VISIBILITY_GPU_GRANTED).toBe("true"));
test.describe("hair face preset visibility", () => {
  test.describe.configure({ timeout: 180_000 });
  for (const firstAngle of [0, 2, 4, 6]) {
  for (const [faceIndex, face] of faces.entries()) for (const [hairIndex, hairstyle] of hairstyles.entries()) {
    test(`face ${faceIndex} ${hairIndex ? "buzz" : "short"} angles ${firstAngle * 45}-${(firstAngle + 1) * 45}`, async ({ page }, info) => {
      await observe(page, info, async captures => {
        await chooseAppearance(page, face, hairstyle);
        await angles(page, info, `face-${faceIndex}-${hairIndex ? "buzz" : "short"}`, "Cận mặt", captures, firstAngle);
      });
    });
  }
  test(`street cap short head angles ${firstAngle * 45}-${(firstAngle + 1) * 45}`, async ({ page }, info) => {
    await observe(page, info, async captures => {
      const studio = await chooseAppearance(page, faces[0], hairstyles[0]);
      const item = COSMETICS.find(item => item.id === "street-cap")!;
      expect(item).toBeDefined();
      await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: "Mũ", exact: true }).click();
      await studio.getByRole("button", { name: `Thử ${item.name}`, exact: true }).click();
      await expect(studio.getByRole("button", { name: `Thử ${item.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await angles(page, info, "street-cap-short", "Cận mặt", captures, firstAngle);
    });
  });
  test(`neon pack short body angles ${firstAngle * 45}-${(firstAngle + 1) * 45}`, async ({ page }, info) => {
    await observe(page, info, async captures => {
      const studio = await chooseAppearance(page, faces[0], hairstyles[0]);
      const item = COSMETICS.find(item => item.id === "neon-pack")!;
      expect(item).toBeDefined();
      await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: "Đồ đeo lưng", exact: true }).click();
      await studio.getByRole("button", { name: `Thử ${item.name}`, exact: true }).click();
      await expect(studio.getByRole("button", { name: `Thử ${item.name}`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await angles(page, info, "neon-pack-short", "Toàn thân", captures, firstAngle);
    });
  });
  }
});
