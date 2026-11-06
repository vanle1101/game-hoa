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
import { FURNITURE_CATALOG } from "../../src/furniture/catalog";
import { COSMETICS } from "../../src/character/catalog";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";
import { equipCosmetic } from "../../src/character/ownership";
import type { CosmeticSlot } from "../../src/character/types";

const NOW = "2026-10-16T08:00:00.000Z";
const LEGACY_FURNITURE = new Set([
  "cloud-bed", "platform-bed", "bunk-bed", "canopy-bed", "haven-sofa", "corner-sofa", "chaise-lounge",
  "workstation", "writing-desk", "standing-desk", "architect-desk", "dining-chair", "office-chair", "bar-stool",
  "bookcase", "wardrobe", "drawer-chest", "flat-tv", "arcade-cabinet", "stereo-tower", "neon-floor-lamp",
  "tripod-lamp", "table-lamp", "kitchen-island", "refrigerator", "range-cooker", "biolume-plant", "wall-mirror",
  "aquarium", "tool-bench", "3d-printer", "tool-trolley", "holo-art", "trophy-cup", "model-rocket", "crystal-display",
]);
const furnitureSnapshot = structuredClone([...FURNITURE_CATALOG]);
const expandedFurniture = furnitureSnapshot.filter(item => !LEGACY_FURNITURE.has(item.id) && (!process.env.EXPANDED_FURNITURE_IDS || process.env.EXPANDED_FURNITURE_IDS.split(",").includes(item.id)));
const fashionSnapshot = structuredClone(COSMETICS);
const SLOT_LABELS: Record<CosmeticSlot, string> = {
  top: "Áo", outerwear: "Áo khoác", bottom: "Quần", shoes: "Giày", headwear: "Mũ", gloves: "Găng tay",
  eyewear: "Kính mắt", face: "Mặt nạ", back: "Đồ đeo lưng", jewelry: "Trang sức", accessory: "Phụ kiện",
};
const fashionMode = process.env.EXPANDED_FASHION_MODE ?? "exhaustive";
function subpixelStable(previous: Buffer, current: Buffer, previousDraws: number, currentDraws: number, previousBounds: { x: number; y: number; width: number; height: number } | null, currentBounds: { x: number; y: number; width: number; height: number } | null, pausedCreator = false) {
  return decodedSubpixelStable(pngPixels(previous), pngPixels(current), previousDraws, currentDraws, previousBounds, currentBounds, pausedCreator);
}
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
const fashionItems = fashionMode === "representative"
  ? fashionSnapshot.filter((item, index, items) => items.findIndex(candidate => candidate.slot === item.slot && candidate.model === item.model) === index)
  : process.env.EXPANDED_FASHION_IDS ? fashionSnapshot.filter(item => process.env.EXPANDED_FASHION_IDS!.split(",").includes(item.id)) : fashionSnapshot;
type Command = { key: string; action: Action; expectedOwnerId?: string };

function assertGpuWindow() {
  const filename = process.env.EXPANDED_GPU_WINDOW ?? "C:\\Users\\phamc\\.dsh\\workai\\life-level-v7\\agents\\expanded-assets-gallery\\gpu-window.json";
  const window = JSON.parse(readFileSync(filename, "utf8")) as { status?: string };
  expect(window.status, `GPU permission in ${filename}`).toBe("free");
}

test.beforeAll(() => {
  assertGpuWindow();
  expect(oneChannelRounding(Buffer.from([10, 20, 30, 40, 50, 60]), Buffer.from([11, 20, 30, 40, 50, 60]), 3)).toBe(true);
  expect(oneChannelRounding(Buffer.from([10, 20, 30, 40, 50, 60]), Buffer.from([12, 20, 30, 40, 50, 60]), 3)).toBe(false);
  expect(oneChannelRounding(Buffer.from([10, 20, 30, 40, 50, 60]), Buffer.from([11, 20, 30, 41, 50, 60]), 3)).toBe(false);
  expect(oneChannelRounding(Buffer.from([10, 20, 30, 40, 50, 60]), Buffer.from([11, 21, 30, 40, 50, 60]), 3)).toBe(false);
  expect(["exhaustive", "representative"]).toContain(fashionMode);
});
test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

async function isolatedGame(page: Page, advanced = false) {
  let state = createInitialState(advanced ? "expanded-fashion-gallery" : "expanded-furniture-gallery", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  if (advanced) {
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
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
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
  await page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true }).click();
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
function changedPixelRatio(left: Buffer, right: Buffer) {
  return decodedChangedPixelRatio(pngPixels(left), pngPixels(right));
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
async function renderFingerprint(canvas: Locator) {
  const record = await canvas.evaluate(element => {
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
    return { unknowns, meshes, lights, camera: { type: root.camera.type, matrixWorld: root.camera.matrixWorld.toArray(), matrixWorldInverse: root.camera.matrixWorldInverse.toArray(), projectionMatrix: root.camera.projectionMatrix.toArray(), layers: root.camera.layers.mask }, scene: { background: (root.scene.background as THREE.Color | null)?.toArray() ?? null, fog: root.scene.fog?.toJSON() ?? null }, renderer: { outputColorSpace: root.gl.outputColorSpace, toneMapping: root.gl.toneMapping, toneMappingExposure: root.gl.toneMappingExposure, shadowMap: { enabled: root.gl.shadowMap.enabled, type: root.gl.shadowMap.type }, localClippingEnabled: root.gl.localClippingEnabled } };
  });
  expect(record.meshes.length).toBeGreaterThan(0);
  const hash = canonicalFingerprint(record);
  const geometryChanged = structuredClone(record), materialChanged = structuredClone(record), cameraChanged = structuredClone(record);
  const position = geometryChanged.meshes.find(mesh => mesh.geometry.attributes.position)?.geometry.attributes.position;
  assert.ok(position);
  position.values[0] += 1;
  materialChanged.meshes[0].materials[0].opacity = Number(materialChanged.meshes[0].materials[0].opacity ?? 1) / 2;
  cameraChanged.camera.matrixWorld[12] += 1;
  expect(canonicalFingerprint(geometryChanged)).not.toBe(hash);
  expect(canonicalFingerprint(materialChanged)).not.toBe(hash);
  expect(canonicalFingerprint(cameraChanged)).not.toBe(hash);
  return { hash, record };
}
async function captureCanvas(page: Page, info: TestInfo, stage: Locator, canvas: Locator, name: string, animated = false) {
  await expect(canvas).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
  await stage.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  expect(viewport.width).toBeLessThanOrEqual(1440);
  expect(viewport.height).toBeLessThan(8192);
  const stageBounds = await stage.boundingBox(), canvasBounds = await canvas.boundingBox();
  for (const bounds of [stageBounds, canvasBounds]) {
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  }
  const live = await canvas.evaluate(element => {
    const node = element as HTMLCanvasElement, gl = node.getContext("webgl2");
    return { live: Boolean(gl && !gl.isContextLost()), width: node.width, height: node.height };
  });
  expect(live.live).toBe(true);
  expect(live.width).toBeGreaterThan(200);
  expect(live.height).toBeGreaterThan(200);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
  let previous = await canvas.screenshot({ animations: "disabled" });
  let previousPixels = pngPixels(previous);
  let stableFrames = 0;
  const stableRatios: number[] = [];
  const diagnostic: object[] = [];
  const captureStartedAt = Date.now(), captureStartedPerf = performance.now();
  let priorFrame = previous;
  let lastDifferent: [Buffer, Buffer] | undefined;
  let previousDraws = await drawCount(canvas);
  let previousBounds = await canvas.boundingBox();
  let previousCanvasId = await canvas.getAttribute("data-expanded-canvas-id");
  try {
  await expect.poll(async () => {
    const sampleStartedPerf = performance.now();
    const current = await canvas.screenshot({ animations: "disabled" });
    const screenshotMs = performance.now() - sampleStartedPerf;
    priorFrame = previous;
    const decodeStartedPerf = performance.now();
    const a = previousPixels, b = pngPixels(current);
    const decodeMs = performance.now() - decodeStartedPerf;
    const comparisonStartedPerf = performance.now();
    if (!a.pixels.equals(b.pixels)) lastDifferent = [previous, current];
    let maxDelta = 0, changedChannels = 0;
    for (let index = 0; index < a.pixels.length; index++) { const delta = Math.abs(a.pixels[index] - b.pixels[index]); if (delta) changedChannels++; maxDelta = Math.max(maxDelta, delta); }
    const changedAbove16 = decodedChangedPixelRatio(a, b);
    const currentDraws = await drawCount(canvas), currentBounds = await canvas.boundingBox();
    const currentCanvasId = await canvas.getAttribute("data-expanded-canvas-id");
    const ratio = Boolean(currentCanvasId) && currentCanvasId === previousCanvasId && decodedSubpixelStable(a, b, previousDraws, currentDraws, previousBounds, currentBounds, animated) ? 0 : 1;
    diagnostic.push({ canvasId: currentCanvasId, elapsedMs: performance.now() - captureStartedPerf, capturedAt: new Date(captureStartedAt + performance.now() - captureStartedPerf).toISOString(), screenshotMs, decodeMs, comparisonMs: performance.now() - comparisonStartedPerf, sampleElapsedMs: performance.now() - sampleStartedPerf, maxDelta, changedChannels, pngEqual: current.equals(previous), pixelsEqual: a.pixels.equals(b.pixels), changedAbove16, draws: currentDraws, bounds: currentBounds, sha256: createHash("sha256").update(current).digest("hex") });
    previousCanvasId = currentCanvasId;
    previousDraws = currentDraws;
    previousBounds = currentBounds;
    stableFrames = ratio === 0 ? stableFrames + 1 : 0;
    stableRatios.push(ratio);
    previous = current;
    previousPixels = b;
    return stableFrames;
  }, { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  } finally {
    await info.attach(`${name}-stability-diagnostic`, { body: JSON.stringify(diagnostic, null, 2), contentType: "application/json" });
    if (lastDifferent) {
      await info.attach(`${name}-last-different-prior`, { body: lastDifferent[0], contentType: "image/png" });
      await info.attach(`${name}-last-different-current`, { body: lastDifferent[1], contentType: "image/png" });
    }
    if (stableFrames < 3) {
      await info.attach(`${name}-unstable-prior`, { body: priorFrame, contentType: "image/png" });
      await info.attach(`${name}-unstable-current`, { body: previous, contentType: "image/png" });
    }
  }
  const semantic = animated ? await renderFingerprint(canvas) : null;
  if (semantic) {
    await info.attach(`${name}-render-records`, { body: JSON.stringify(semantic, null, 2), contentType: "application/json" });
    expect(semantic.record.unknowns, "Semantic render authority must be complete").toEqual([]);
  }
  expect(previous.byteLength).toBeGreaterThan(1500);
  const screenshot = info.outputPath(`${name}.png`);
  const canvasPath = info.outputPath(`${name}-canvas.png`);
  await info.attach(`${name}-canvas`, { body: previous, contentType: "image/png" });
  await writeFile(canvasPath, previous);
  await stage.screenshot({ path: screenshot, animations: "disabled" });
  await info.attach(name, { path: screenshot, contentType: "image/png" });
  return { name, screenshot, canvasPath, semanticHash: semantic?.hash ?? null, canvasSha256: createHash("sha256").update(previous).digest("hex"), canvasBytes: previous.byteLength, draws: await drawCount(canvas), stageBounds, canvasBounds, viewport, live, stability: { mode: animated ? "paused-creator-single-rgb-channel-rounding" : "unchanged-draws-and-dimensions-single-rgb-channel-rounding", channelThreshold: 1, maxChangedChannels: 1, maxChangedPixels: 1, consecutiveSamples: 3, observedRatios: stableRatios } };
}
async function manifest(info: TestInfo, name: string, data: object, game: BrowserGame) {
  await info.attach(name, { body: JSON.stringify({ ...data, errors: game.errors, consoleErrors: game.consoleErrors, warnings: game.warnings, unexpectedApi: game.unexpectedApi, commands: game.commands, finalGold: game.state().gold }, null, 2), contentType: "application/json" });
}

test("expanded furniture actual catalog gallery is preview-only", async ({ page }, info) => {
  test.setTimeout(Math.max(240_000, expandedFurniture.length * 25_000));
  const game = await isolatedGame(page), captures: object[] = [], selected: string[] = [], hashes = new Set<string>();
  const snapshotHash = createHash("sha256").update(JSON.stringify(furnitureSnapshot)).digest("hex");
  try {
    expect(expandedFurniture.length).toBeGreaterThan(0);
    expect(new Set(furnitureSnapshot.map(item => item.id)).size).toBe(furnitureSnapshot.length);
    await openSection(page, "Nội thất");
    await expect(page.getByRole("heading", { name: "Chọn món làm nên căn nhà.", exact: true })).toBeVisible();
    const baseline = economy(game.state()), baselineEquipped = structuredClone(game.state().equippedCosmetics);
    const stage = page.locator(".furniture-showcase"), canvas = stage.locator("canvas");
    await expect(canvas).toBeVisible();
    for (const [index, item] of expandedFurniture.entries()) {
      await page.getByLabel("Tìm nội thất", { exact: true }).fill(item.id);
      const button = page.getByRole("button", { name: `Xem trước ${item.name}`, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(stage.locator(".furniture-showcase-caption strong")).toHaveText(item.name);
      await expect(page.getByRole("complementary", { name: `Thông tin ${item.name}`, exact: true })).toBeVisible();
      const before = await drawSnapshot(canvas);
      await page.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
      await freshDraw(canvas, before);
      const capture = await captureCanvas(page, info, stage, canvas, `furniture-${String(index + 1).padStart(3, "0")}-${item.id}`);
      expect(hashes.has(capture.canvasSha256), `${item.id}: distinct rendered furniture`).toBe(false);
      hashes.add(capture.canvasSha256);
      captures.push({ id: item.id, label: item.name, category: item.category, ...capture });
      selected.push(item.id);
      expect(economy(game.state())).toEqual(baseline);
      expect(game.state().equippedCosmetics).toEqual(baselineEquipped);
      expect(mutations(game)).toEqual([]);
      healthy(game);
    }
    expect(selected).toEqual(expandedFurniture.map(item => item.id));
    expect(captures).toHaveLength(expandedFurniture.length);
  } finally {
    await manifest(info, "expanded-furniture-manifest", { snapshotHash, catalogCount: furnitureSnapshot.length, expectedCaptureCount: expandedFurniture.length, capturedCount: captures.length, catalog: furnitureSnapshot, selected, captures }, game);
  }
});

test("fashion catalog previews and owned equipment preserve gold across every slot", async ({ page }, info) => {
  test.setTimeout(Math.max(240_000, fashionItems.length * 75_000));
  const game = await isolatedGame(page, true), captures: object[] = [], selected: string[] = [];
  const snapshotHash = createHash("sha256").update(JSON.stringify(fashionSnapshot)).digest("hex");
  const sourceBinding = productSourceBinding();
  await info.attach("fashion-source-binding", { body: JSON.stringify(sourceBinding, null, 2), contentType: "application/json" });
  try {
    expect(new Set(fashionSnapshot.map(item => item.id)).size).toBe(fashionSnapshot.length);
    await openSection(page, "Nhân vật");
    const studio = page.getByRole("region", { name: "Xưởng tạo nhân vật", exact: true });
    await expect(studio).toBeVisible();
    await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
    const stage = studio.locator(".studio-stage"), canvas = stage.locator("canvas");
    const baseline = economy(game.state());
    expect(game.state().settings.reducedMotion).toBe(true);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await expect(canvas).toBeVisible();
    for (const [index, item] of fashionItems.entries()) {
      await studio.getByLabel("Tìm trang phục", { exact: true }).fill("");
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: SLOT_LABELS[item.slot], exact: true }).click();
      const preview = studio.getByRole("button", { name: `Thử ${item.name}`, exact: true });
      const article = studio.locator(".studio-wardrobe-grid article").filter({ has: page.getByRole("button", { name: `Thử ${item.name}`, exact: true }) });
      const saved = structuredClone(game.state().equippedCosmetics), beforeCommands = structuredClone(mutations(game));
      const beforePreview = await drawSnapshot(canvas);
      await preview.click();
      await expect(preview).toHaveAttribute("aria-pressed", "true");
      await expect(stage.locator(".studio-stage-top")).toContainText("ĐANG THỬ TRANG PHỤC");
      await freshDraw(canvas, beforePreview);
      const itemCaptures: Awaited<ReturnType<typeof captureCanvas>>[] = [];
      for (const [view, label] of [["body", "Toàn thân"], ["head", "Cận mặt"]] as const) {
        const before = await drawSnapshot(canvas);
        await studio.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
        await studio.getByRole("button", { name: label, exact: true }).click();
        await expect(studio.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
        await freshDraw(canvas, before);
        itemCaptures.push(await captureCanvas(page, info, stage, canvas, `fashion-${String(index + 1).padStart(3, "0")}-${item.id}-${view}`, true));
      }
      if (item.slot === "back") {
        await studio.getByRole("button", { name: "Toàn thân", exact: true }).click();
        const before = await drawSnapshot(canvas);
        for (let turn = 0; turn < 8; turn++) await studio.getByRole("button", { name: "Xoay phải", exact: true }).click();
        await freshDraw(canvas, before);
        itemCaptures.push(await captureCanvas(page, info, stage, canvas, `fashion-${String(index + 1).padStart(3, "0")}-${item.id}-rear`, true));
      }
      expect(economy(game.state()), `${item.id}: preview has no charge`).toEqual(baseline);
      expect(game.state().equippedCosmetics, `${item.id}: preview is not equip`).toEqual(saved);
      expect(mutations(game), `${item.id}: preview sends no mutation`).toEqual(beforeCommands);
      await article.getByRole("button", { name: "Mặc ngay", exact: true }).click();
      const expected = equipCosmetic(saved, item);
      await expect.poll(() => game.state().equippedCosmetics).toEqual(expected);
      await expect(article.getByRole("button", { name: "Đang mặc", exact: true })).toBeDisabled();
      expect(mutations(game).slice(beforeCommands.length).map(command => command.action)).toEqual([{ type: "cosmetic.equip", cosmeticId: item.id }]);
      expect(economy(game.state()), `${item.id}: equip has no charge`).toEqual(baseline);
      await expect(studio.locator(".studio-save-bar")).toHaveAttribute("aria-busy", "false");
      const beforeEquipped = await drawSnapshot(canvas);
      await studio.getByRole("button", { name: "Đặt lại góc nhìn", exact: true }).click();
      await studio.getByRole("button", { name: "Toàn thân", exact: true }).click();
      await expect(studio.getByRole("button", { name: "Toàn thân", exact: true })).toHaveAttribute("aria-pressed", "true");
      await freshDraw(canvas, beforeEquipped);
      const equippedCapture = await captureCanvas(page, info, stage, canvas, `fashion-${String(index + 1).padStart(3, "0")}-${item.id}-equipped-body`, true);
      const equippedPreviewDelta = changedPixelRatio(readFileSync(equippedCapture.canvasPath), readFileSync(itemCaptures[0].canvasPath));
      const rasterParity = subpixelStable(readFileSync(itemCaptures[0].canvasPath), readFileSync(equippedCapture.canvasPath), itemCaptures[0].draws, equippedCapture.draws, itemCaptures[0].canvasBounds, equippedCapture.canvasBounds, true);
      const pixelPerfect = pngPixels(readFileSync(itemCaptures[0].canvasPath)).pixels.equals(pngPixels(readFileSync(equippedCapture.canvasPath)).pixels);
      await info.attach(`${item.id}-render-parity`, { body: JSON.stringify({ rasterParity, pixelPerfect, equippedPreviewDelta, previewSemanticHash: itemCaptures[0].semanticHash, equippedSemanticHash: equippedCapture.semanticHash }, null, 2), contentType: "application/json" });
      expect(itemCaptures[0].semanticHash).not.toBeNull();
      expect(equippedCapture.semanticHash, `${item.id}: exact semantic render parity`).toBe(itemCaptures[0].semanticHash);
      itemCaptures.push(equippedCapture);
      await studio.getByRole("button", { name: "Tháo món đang mặc", exact: true }).click();
      await expect.poll(() => game.state().equippedCosmetics?.[item.slot]).toBeUndefined();
      expect(mutations(game).slice(beforeCommands.length).map(command => command.action)).toEqual([{ type: "cosmetic.equip", cosmeticId: item.id }, { type: "cosmetic.unequip", slot: item.slot }]);
      expect(economy(game.state())).toEqual(baseline);
      healthy(game);
      captures.push({ id: item.id, label: item.name, slot: item.slot, model: item.model, expectedEquipment: expected, equippedPreviewDelta, rasterParity, pixelPerfect, semanticRenderParity: true, views: itemCaptures });
      selected.push(item.id);
    }
    expect(selected).toEqual(fashionItems.map(item => item.id));
    expect(captures).toHaveLength(fashionItems.length);
    if (!process.env.EXPANDED_FASHION_IDS) expect(new Set(fashionItems.map(item => item.slot))).toEqual(new Set(fashionSnapshot.map(item => item.slot)));
    expect(mutations(game).every(command => ["cosmetic.equip", "cosmetic.unequip"].includes(command.action.type))).toBe(true);
  } finally {
    await manifest(info, "expanded-fashion-manifest", { mode: fashionMode, snapshotHash, sourceHash: sourceBinding.hash, sourceUnchanged: productSourceBinding().hash === sourceBinding.hash, catalogCount: fashionSnapshot.length, expectedItemCount: fashionItems.length, capturedItemCount: captures.length, catalog: fashionSnapshot, selected, captures }, game);
  }
});

 test("unowned locked fashion previews never buy or equip", async ({ page }, info) => {
  test.setTimeout(180_000);
  const game = await isolatedGame(page), captures: object[] = [];
  const unowned = fashionSnapshot.filter(item => item.price > 0 && (item.level ?? 1) > 1 && !game.state().ownedCosmetics?.includes(item.id));
  const samples = unowned.filter((item, index) => unowned.findIndex(candidate => candidate.slot === item.slot) === index);
  try {
    expect(samples.length).toBeGreaterThan(0);
    await openSection(page, "Nhân vật");
    const studio = page.getByRole("region", { name: "Xưởng tạo nhân vật", exact: true });
    await studio.getByRole("button", { name: "Tủ đồ", exact: true }).click();
    const baseline = economy(game.state()), saved = structuredClone(game.state().equippedCosmetics);
    const stage = studio.locator(".studio-stage"), canvas = stage.locator("canvas");
    await expect(canvas).toBeVisible();
    for (const item of samples) {
      await studio.getByRole("group", { name: "Loại trang phục", exact: true }).getByRole("button", { name: SLOT_LABELS[item.slot], exact: true }).click();
      const button = studio.getByRole("button", { name: `Thử ${item.name}`, exact: true });
      const article = studio.locator(".studio-wardrobe-grid article").filter({ has: page.getByRole("button", { name: `Thử ${item.name}`, exact: true }) });
      const before = await drawSnapshot(canvas);
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(article.getByRole("button", { name: `Mở ở cấp ${item.level}`, exact: true })).toBeDisabled();
      await freshDraw(canvas, before);
      captures.push({ id: item.id, slot: item.slot, ...await captureCanvas(page, info, stage, canvas, `unowned-preview-${item.id}`, true) });
      expect(economy(game.state())).toEqual(baseline);
      expect(game.state().equippedCosmetics).toEqual(saved);
      expect(mutations(game)).toEqual([]);
      healthy(game);
      await studio.getByRole("button", { name: "Trở về trang phục đang mặc", exact: true }).click();
    }
  } finally {
    await manifest(info, "unowned-preview-manifest", { expectedCount: samples.length, capturedCount: captures.length, captures }, game);
  }
});
