import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type * as THREE from "three";
import { writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { createInitialState, applyAction } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { wearableShape } from "../../src/components/world/wearable-shapes";
import { COSMETICS } from "../../src/character/catalog";
import { equipCosmetic } from "../../src/character/ownership";
import type { CosmeticSlot } from "../../src/character/types";

const NOW = "2026-10-16T08:00:00.000Z";
const fashionSnapshot = structuredClone(COSMETICS);
const SLOT_LABELS: Record<CosmeticSlot, string> = {
  top: "Áo", outerwear: "Áo khoác", bottom: "Quần", shoes: "Giày", headwear: "Mũ", gloves: "Găng tay",
  eyewear: "Kính mắt", face: "Mặt nạ", back: "Đồ đeo lưng", jewelry: "Trang sức", accessory: "Phụ kiện",
};

function decodedSubpixelStable(a: ReturnType<typeof pngPixels>, b: ReturnType<typeof pngPixels>, previousDraws: number, currentDraws: number, previousBounds: { x: number; y: number; width: number; height: number } | null, currentBounds: { x: number; y: number; width: number; height: number } | null, pausedCreator = false) {
  if ((!pausedCreator && currentDraws !== previousDraws) || !previousBounds || !currentBounds || currentBounds.x !== previousBounds.x || currentBounds.y !== previousBounds.y || currentBounds.width !== previousBounds.width || currentBounds.height !== previousBounds.height) return false;
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) return false;
  return oneChannelRounding(a.pixels, b.pixels, a.channels);
}
function oneChannelRounding(a: Buffer, b: Buffer, channels: number) {
  if (a.length !== b.length) return false;
  let changes = 0;
  for (let index = 0; index < a.length; index++) {
    const delta = Math.abs(a[index] - b[index]);
    if (delta && (index % channels >= 3 || delta > 1 || ++changes > 1)) return false;
  }
  return true;
}
const requestedIds = process.env.FASHION_OBSERVATION_IDS?.split(",").filter(Boolean);
const fashionItems = requestedIds ? fashionSnapshot.filter(item => requestedIds.includes(item.id)) : fashionSnapshot;
type Command = { key: string; action: Action; expectedOwnerId?: string };

test.beforeAll(() => {
  crossViewControls();
  expect(process.env.FASHION_OBSERVATION_GPU_GRANTED).toBe("true");
  if (requestedIds) expect(fashionItems.map(item => item.id).sort()).toEqual([...requestedIds].sort());
  expect(fashionItems.length).toBeGreaterThan(0);
  expect(oneChannelRounding(Buffer.from([10, 20, 30]), Buffer.from([11, 20, 30]), 3)).toBe(true);
  expect(oneChannelRounding(Buffer.from([10, 20, 30]), Buffer.from([11, 21, 30]), 3)).toBe(false);
  expect(oneChannelRounding(Buffer.from([10, 20, 30]), Buffer.from([12, 20, 30]), 3)).toBe(false);
});
test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

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
function pngPixels(buffer: Buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  assert.equal(buffer[24], 8);
  assert.ok([2, 6].includes(buffer[25]));
  assert.equal(buffer[28], 0);
  const channels = buffer[25] === 6 ? 4 : 3, stride = width * channels, chunks: Buffer[] = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(width * height * channels);
  assert.equal(raw.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= channels ? pixels[index - channels] : 0;
      const up = y ? pixels[index - stride] : 0, corner = y && x >= channels ? pixels[index - stride - channels] : 0;
      const prediction = left + up - corner;
      const dl = Math.abs(prediction - left), du = Math.abs(prediction - up), dc = Math.abs(prediction - corner);
      const paeth = dl <= du && dl <= dc ? left : du <= dc ? up : corner;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth;
      pixels[index] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}
function decodedChangedPixelRatio(a: ReturnType<typeof pngPixels>, b: ReturnType<typeof pngPixels>) {
  assert.deepEqual([a.width, a.height, a.channels], [b.width, b.height, b.channels]);
  let changed = 0;
  for (let index = 0; index < a.pixels.length; index += a.channels) {
    for (let channel = 0; channel < a.channels; channel++) {
      if (Math.abs(a.pixels[index + channel] - b.pixels[index + channel]) > 16) { changed++; break; }
    }
  }
  return changed / (a.width * a.height);
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
type SnapshotHost = Window & { __fashionSnapshots?: Map<string, string> };
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
    host.__fashionSnapshots ??= new Map();
    host.__fashionSnapshots.clear();
    host.__fashionSnapshots.set(token, json);
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
    const json = (window as SnapshotHost).__fashionSnapshots?.get(token);
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
      const json = (window as SnapshotHost).__fashionSnapshots?.get(token);
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
  await canvas.evaluate((_element, token) => { (window as SnapshotHost).__fashionSnapshots?.delete(token); }, snapshot.token);
  return { json, record, fullTransferMs, controlHashes };
}
type ObservedItem = typeof fashionSnapshot[number];
function expectedWearables(item: ObservedItem) {
  const bySlot: Record<string, string> = { top: "tee", bottom: "tapered", shoes: "sneakers" };
  if (item.slot === "top" && item.model === "long-coat") bySlot.outerwear = item.model;
  else bySlot[item.slot] = item.model;
  const counts: Record<string, number> = {};
  for (const model of new Set(Object.values(bySlot))) {
    const shape = wearableShape(model);
    assert.ok(shape, `Known selected wearable shape: ${model}`);
    for (const part of shape.parts) counts[part.anchor] = (counts[part.anchor] ?? 0) + 1;
  }
  return counts;
}
function assertRenderAuthority(semantic: Awaited<ReturnType<typeof renderFingerprint>>, item: ObservedItem) {
  expect(semantic.unknowns).toEqual([]);
  for (const name of ["torso", "left-arm", "right-arm", "left-thigh", "right-thigh", "left-shin", "right-shin"]) expect(semantic.joints[name], `Paused joint ${name}`).toEqual([[0, 0, 0]]);
  const expected = expectedWearables(item);
  for (const [anchor, count] of Object.entries(semantic.wearableCounts)) expect(count, `${item.id}: geometry count at ${anchor}`).toBe(expected[anchor] ?? 0);
  for (const [anchor, count] of Object.entries(expected)) expect(semantic.wearableCounts[anchor], `${item.id}: anchor exists`).toBe(count);
}
function rasterDelta(a: ReturnType<typeof pngPixels>, b: ReturnType<typeof pngPixels>) {
  assert.deepEqual([a.width, a.height, a.channels], [b.width, b.height, b.channels]);
  let maxDelta = 0, changedChannels = 0, changedPixels = 0;
  for (let index = 0; index < a.pixels.length; index += a.channels) {
    let changed = false;
    for (let channel = 0; channel < a.channels; channel++) {
      const delta = Math.abs(a.pixels[index + channel] - b.pixels[index + channel]);
      if (delta) { changedChannels++; changed = true; }
      maxDelta = Math.max(maxDelta, delta);
    }
    if (changed) changedPixels++;
  }
  return { maxDelta, changedChannels, changedPixels, changedPixelRatio: changedPixels / (a.width * a.height), pixelPerfect: changedChannels === 0 };
}
type CaptureFrame = { semanticHash: string; bounds: { x: number; y: number; width: number; height: number } | null; live: { width: number; height: number }; viewport: { width: number; height: number }; dpr: number };
function crossViewRaster(a: ReturnType<typeof pngPixels>, b: ReturnType<typeof pngPixels>, left: CaptureFrame, right: CaptureFrame) {
  assert.equal(left.semanticHash, right.semanticHash, "Exact scene/camera semantic parity");
  assert.ok(left.bounds && right.bounds);
  assert.deepEqual([left.bounds.width, left.bounds.height], [right.bounds.width, right.bounds.height], "CSS canvas dimensions");
  assert.deepEqual([left.live.width, left.live.height], [right.live.width, right.live.height], "Canvas buffer dimensions");
  assert.deepEqual(left.viewport, right.viewport, "Viewport dimensions");
  assert.equal(left.dpr, right.dpr, "Device pixel ratio");
  const dimensions = { preview: [a.width, a.height, a.channels], persisted: [b.width, b.height, b.channels] };
  const origins = { preview: { x: left.bounds.x, y: left.bounds.y }, persisted: { x: right.bounds.x, y: right.bounds.y } };
  if (JSON.stringify(dimensions.preview) !== JSON.stringify(dimensions.persisted)) return { status: "NON_COMPARABLE", dimensions, origins, maxDelta: null, changedChannels: null, changedPixels: null, changedPixelRatio: null, pixelPerfect: null, strictSingleChannelCriterion: null, changedAbove16: null, semanticExact: true };
  return { status: "COMPARABLE", dimensions, origins, ...rasterDelta(a, b), strictSingleChannelCriterion: oneChannelRounding(a.pixels, b.pixels, a.channels) && left.bounds.x === right.bounds.x && left.bounds.y === right.bounds.y, changedAbove16: decodedChangedPixelRatio(a, b), semanticExact: true };
}
function crossViewControls() {
  const pixels = { width: 2, height: 2, channels: 3, pixels: Buffer.alloc(12) };
  const frame: CaptureFrame = { semanticHash: "exact-scene-including-camera", bounds: { x: 0, y: .25, width: 2, height: 2 }, live: { width: 2, height: 2 }, viewport: { width: 20, height: 20 }, dpr: 1 };
  assert.equal(crossViewRaster(pixels, pixels, frame, frame).status, "COMPARABLE");
  const taller = { ...pixels, height: 3, pixels: Buffer.alloc(18) };
  const nonComparable = crossViewRaster(pixels, taller, frame, frame);
  assert.equal(nonComparable.status, "NON_COMPARABLE");
  assert.equal(nonComparable.pixelPerfect, null);
  assert.deepEqual(nonComparable.dimensions.persisted, [2, 3, 3]);
  for (const hash of ["changed-geometry", "changed-camera", "changed-material"]) assert.throws(() => crossViewRaster(pixels, taller, frame, { ...frame, semanticHash: hash }));
  assert.throws(() => crossViewRaster(pixels, taller, frame, { ...frame, bounds: { ...frame.bounds!, width: 3 } }));
  assert.throws(() => crossViewRaster(pixels, taller, frame, { ...frame, live: { width: 3, height: 2 } }));
  assert.throws(() => crossViewRaster(pixels, taller, frame, { ...frame, viewport: { width: 21, height: 20 } }));
  assert.throws(() => crossViewRaster(pixels, taller, frame, { ...frame, dpr: 2 }));
}
async function persistJson(info: TestInfo, name: string, value: unknown) {
  const path = info.outputPath(`${name}.json`);
  const bytes = Buffer.from(JSON.stringify(value));
  await writeFile(path, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await info.attach(name, { path, contentType: "application/json" });
  return { path, sha256, bytes: bytes.byteLength };
}
async function captureObservation(page: Page, info: TestInfo, stage: Locator, canvas: Locator, name: string, item: ObservedItem) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await stage.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  const dpr = await page.evaluate(() => devicePixelRatio);
  const bounds = await canvas.boundingBox();
  assert.ok(bounds);
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  const live = await canvas.evaluate(element => { const node = element as HTMLCanvasElement, gl = node.getContext("webgl2"); return { live: Boolean(gl && !gl.isContextLost()), width: node.width, height: node.height }; });
  expect(live.live).toBe(true); expect(live.width).toBeGreaterThan(200); expect(live.height).toBeGreaterThan(200);
  let previous = await canvas.screenshot({ animations: "disabled" });
  let previousPixels = pngPixels(previous), previousBounds = await canvas.boundingBox(), previousDraw = await drawSnapshot(canvas);
  let priorSemantic = await renderFingerprint(canvas);
  assertRenderAuthority(priorSemantic, item);
  let semanticStreak = 0, rasterStreak = 0, maxRasterStreak = 0;
  const observations: object[] = [{ ...priorSemantic, semanticStreak, rasterStreak }];
  const start = Date.now();
  let observationsArtifact: Awaited<ReturnType<typeof persistJson>> | undefined;
  try {
  while (Date.now() - start < 20_000) {
    await page.waitForTimeout(200);
    const semantic = await renderFingerprint(canvas);
    assertRenderAuthority(semantic, item);
    const current = await canvas.screenshot({ animations: "disabled" }), pixels = pngPixels(current);
    const currentBounds = await canvas.boundingBox(), draw = await drawSnapshot(canvas);
    const sameLifetime = Boolean(draw.id) && draw.id === previousDraw.id;
    const sameBounds = JSON.stringify(previousBounds) === JSON.stringify(currentBounds);
    const rasterStable = sameLifetime && decodedSubpixelStable(previousPixels, pixels, previousDraw.draws, draw.draws, previousBounds, currentBounds, true);
    rasterStreak = rasterStable ? rasterStreak + 1 : 0;
    maxRasterStreak = Math.max(maxRasterStreak, rasterStreak);
    semanticStreak = sameLifetime && sameBounds && semantic.hash === priorSemantic.hash ? semanticStreak + 1 : 0;
    observations.push({ ...semantic, elapsedMs: Date.now() - start, ...rasterDelta(previousPixels, pixels), strictSingleChannelSample: rasterStable, rasterStreak, semanticStreak, semanticHash: semantic.hash, canvasId: draw.id, draws: draw.draws, bounds: currentBounds });
    if (!previousPixels.pixels.equals(pixels.pixels)) {
      await writeFile(info.outputPath(`${name}-raster-prior.png`), previous);
      await writeFile(info.outputPath(`${name}-raster-current.png`), current);
    }
    previous = current; previousPixels = pixels; previousBounds = currentBounds; previousDraw = draw; priorSemantic = semantic;
    if (semanticStreak >= 3 && rasterStreak >= 3) break;
  }
  } finally {
    observationsArtifact = await persistJson(info, `${name}-observations`, observations);
  }
  assert.ok(observationsArtifact);
  const retained = await retainedSnapshot(canvas, priorSemantic, true);
  const recordPath = info.outputPath(`${name}-render-records.json`);
  await writeFile(recordPath, retained.json);
  const semanticArtifact = { path: recordPath, sha256: priorSemantic.hash, bytes: priorSemantic.byteLength };
  await info.attach(`${name}-render-records-reference`, { body: JSON.stringify(semanticArtifact), contentType: "application/json" });
  await persistJson(info, `${name}-snapshot-verification`, { hash: priorSemantic.hash, token: priorSemantic.token, fullTransferMs: retained.fullTransferMs, controlHashes: retained.controlHashes });
  expect(semanticStreak, `${item.id}: deterministic within-view semantics`).toBeGreaterThanOrEqual(3);
  expect(previous.byteLength).toBeGreaterThan(1500);
  const canvasPath = info.outputPath(`${name}-canvas.png`), screenshot = info.outputPath(`${name}.png`);
  await writeFile(canvasPath, previous);
  await stage.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach(`${name}-canvas`, { path: canvasPath, contentType: "image/png" });
  await info.attach(name, { path: screenshot, contentType: "image/png" });
  return { name, canvasPath, screenshot, viewport, dpr, semanticArtifact, observationsArtifact, semanticHash: priorSemantic.hash, canvasSha256: createHash("sha256").update(previous).digest("hex"), bounds: previousBounds, draw: previousDraw, live, observations, semanticStreak, rasterObservation: { historicalStrictRun: "pwsh-1085 FAIL unchanged", maxConsecutiveSingleChannelSamples: maxRasterStreak, criterionObserved: maxRasterStreak >= 3, acceptance: "NOT_ASSESSED", visualQuality: "UNKNOWN" } };
}
async function chooseView(studio: Locator, canvas: Locator, label: string) {
  const before = await drawSnapshot(canvas);
  await studio.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
  await studio.getByRole("button", { name: label, exact: true }).click();
  await expect(studio.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await freshDraw(canvas, before);
}
test("fashion observation collects owned preview persistence without raster acceptance", async ({ page }, info) => {
  test.setTimeout(Math.max(180_000, fashionItems.length * 120_000));
  const game = await isolatedGame(page), captures: object[] = [], selected: string[] = [];
  const source = productSourceBinding(), baseline = economy(game.state());
  const appearance = structuredClone(game.state().character);
  await persistJson(info, "source-binding", source);
  try {
    expect(new Set(fashionSnapshot.map(item => item.id)).size).toBe(fashionSnapshot.length);
    await openSection(page, "Nhân vật");
    const studio = page.getByRole("region", { name: "Xưởng tạo nhân vật", exact: true });
    const stage = studio.locator(".studio-stage"), canvas = stage.locator("canvas");
    await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
    expect(game.state().settings.reducedMotion).toBe(true);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    for (const [index, item] of fashionItems.entries()) {
      const prefix = `fashion-${String(index + 1).padStart(3, "0")}-${item.id}`;
      await studio.getByLabel("Tìm trang phục", { exact: true }).fill("");
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: SLOT_LABELS[item.slot], exact: true }).click();
      const preview = studio.getByRole("button", { name: `Thử ${item.name}`, exact: true });
      const article = studio.locator(".studio-wardrobe-grid article").filter({ has: page.getByRole("button", { name: `Thử ${item.name}`, exact: true }) });
      const saved = structuredClone(game.state().equippedCosmetics), beforeCommands = mutations(game).length;
      const before = await drawSnapshot(canvas);
      await preview.click();
      await expect(preview).toHaveAttribute("aria-pressed", "true");
      await expect(stage.locator(".studio-stage-top")).toContainText("ĐANG THỬ TRANG PHỤC");
      await freshDraw(canvas, before);
      const views: Awaited<ReturnType<typeof captureObservation>>[] = [];
      for (const [view, label] of [["body", "Toàn thân"], ["head", "Cận mặt"]] as const) {
        await chooseView(studio, canvas, label);
        views.push(await captureObservation(page, info, stage, canvas, `${prefix}-${view}`, item));
      }
      if (item.slot === "back") {
        await chooseView(studio, canvas, "Toàn thân");
        const beforeRear = await drawSnapshot(canvas);
        for (let turn = 0; turn < 8; turn++) await studio.getByRole("button", { name: "Xoay phải", exact: true }).click();
        await freshDraw(canvas, beforeRear);
        views.push(await captureObservation(page, info, stage, canvas, `${prefix}-rear`, item));
      }
      expect(economy(game.state())).toEqual(baseline);
      expect(game.state().equippedCosmetics).toEqual(saved);
      expect(mutations(game)).toHaveLength(beforeCommands);
      await article.getByRole("button", { name: "Mặc ngay", exact: true }).click();
      const expected = equipCosmetic(saved, item);
      await expect.poll(() => game.state().equippedCosmetics).toEqual(expected);
      await expect(article.getByRole("button", { name: "Đang mặc", exact: true })).toBeDisabled();
      await expect(studio.locator(".studio-save-bar")).toHaveAttribute("aria-busy", "false");
      await expect(studio.getByRole("button", { name: "Lưu ngoại hình", exact: true })).toBeDisabled();
      expect(mutations(game).slice(beforeCommands).map(command => command.action)).toEqual([{ type: "cosmetic.equip", cosmeticId: item.id }]);
      await openSection(page, "Nhân vật");
      await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: SLOT_LABELS[item.slot], exact: true }).click();
      await expect(article.getByRole("button", { name: "Đang mặc", exact: true })).toBeDisabled();
      await expect(stage.locator(".studio-stage-top")).not.toContainText("ĐANG THỬ TRANG PHỤC");
      expect(game.state().equippedCosmetics).toEqual(expected);
      expect(game.state().character).toEqual(appearance);
      await chooseView(studio, canvas, "Toàn thân");
      const reloaded = await captureObservation(page, info, stage, canvas, `${prefix}-reloaded-equipped-body`, item);
      const a = readFileSync(views[0].canvasPath), b = readFileSync(reloaded.canvasPath);
      const parity = crossViewRaster(pngPixels(a), pngPixels(b), views[0], reloaded);
      await persistJson(info, `${prefix}-parity`, parity);
      expect(parity.semanticExact, `${item.id}: preview versus persisted render`).toBe(true);
      views.push(reloaded);
      await studio.getByRole("button", { name: "Tháo món đang mặc", exact: true }).click();
      await expect.poll(() => game.state().equippedCosmetics?.[item.slot]).toBeUndefined();
      expect(mutations(game).slice(beforeCommands).map(command => command.action)).toEqual([{ type: "cosmetic.equip", cosmeticId: item.id }, { type: "cosmetic.unequip", slot: item.slot }]);
      expect(economy(game.state())).toEqual(baseline);
      healthy(game);
      const itemRecord = { id: item.id, slot: item.slot, model: item.model, expectedEquipment: expected, businessAssertions: "PASS", visualQuality: "UNKNOWN", parity, views };
      const itemArtifact = await persistJson(info, `${prefix}-item`, itemRecord);
      captures.push({ ...itemRecord, itemArtifact });
      selected.push(item.id);
    }
    expect(selected).toEqual(fashionItems.map(item => item.id));
    expect(productSourceBinding().hash).toBe(source.hash);
  } finally {
    const result = { kind: "OBSERVATION_NOT_VISUAL_ACCEPTANCE", historicalStrictFailure: "pwsh-1085 FAIL unchanged", sourceHash: source.hash, sourceUnchanged: productSourceBinding().hash === source.hash, catalogCount: fashionSnapshot.length, expectedItemCount: fashionItems.length, completedItemCount: captures.length, expectedIds: fashionItems.map(item => item.id), selected, captures, errors: game.errors, consoleErrors: game.consoleErrors, unexpectedApi: game.unexpectedApi, warnings: game.warnings, commands: game.commands, finalGold: game.state().gold, fixture: "all cosmetics owned; real applyAction; intercepted API; no live writes" };
    await persistJson(info, "fashion-observation-manifest", result);
  }
});
