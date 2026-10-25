import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { createInitialState, applyAction } from "../../src/domain/engine";
import type { Action, ActionResult, GameState } from "../../src/domain/types";
import { ITEMS } from "../../src/domain/catalog";
import { EQUIPMENT_CATALOG, getEquipmentRecipe } from "../../src/equipment/catalog";
import type { Camera, Mesh, Scene, WebGLRenderer } from "three";

type ModelProjection = { id: string; meshNames: string[]; visibleTriangles: number; bounds: [number, number, number, number] | null; width: number; height: number };
type ObservedScene = Scene & { __r3f?: { root: { getState: () => { camera: Camera; gl: WebGLRenderer } } } };
type EquipmentWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __equipmentScenes?: ObservedScene[] };

const NOW = "2026-10-16T08:00:00.000Z";
const SHOP_IDS = EQUIPMENT_CATALOG.filter(item => item.price > 0).map(item => item.id);
const STARTER_ID = "starter-blade";
const ALL_IDS = EQUIPMENT_CATALOG.map(item => item.id);
type Command = { key: string; action: Action; expectedOwnerId?: string };
type PixelImage = { width: number; height: number; pixels: Buffer };
type Capture = {
  id: string;
  name: string;
  slot: string;
  screenshot: string;
  canvasScreenshot: string;
  canvasSha256: string;
  canvasBytes: number;
  decoded: { width: number; height: number; changedRatio: number; foregroundPixels: number; foregroundBounds: [number, number, number, number] | null };
  viewport: { width: number; height: number };
  stageBounds: object;
  canvasBounds: object;
  live: { live: boolean; width: number; height: number };
  draws: number;
  stability: { samples: number; consecutiveExactPairs: number; diagnostics: { changedRatio: number; maxChannelDelta: number }[] };
  modelPresence: { gate: "observed-scene-plus-pixels"; projections: ModelProjection[]; alphaSamples: { pixels: number; width: number; height: number; cornerAlpha: number; id: string; draws: number }[] };
};

const CRC_TABLE = Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Buffer) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function decodePng(buffer: Buffer): PixelImage {
  assert.ok(buffer.byteLength >= 33);
  assert.ok(buffer.byteLength <= 8 * 1024 * 1024);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  let idatBytes = 0;
  const idat: Buffer[] = [];
  let sawIend = false;
  while (offset < buffer.length) {
    assert.ok(offset + 12 <= buffer.length);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    assert.ok(length <= 8 * 1024 * 1024);
    assert.ok(offset + 12 + length <= buffer.length);
    assert.equal(crc32(buffer.subarray(offset + 4, offset + 8 + length)), buffer.readUInt32BE(offset + 8 + length));
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (offset === 8) assert.equal(type, "IHDR");
    if (type === "IHDR") {
      assert.equal(offset, 8);
      assert.equal(length, 13);
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.ok(width > 0);
      assert.ok(height > 0);
      assert.ok(width <= 1440);
      assert.ok(height <= 1000);
      assert.equal(data[8], 8);
      assert.ok([2, 6].includes(data[9]));
      channels = data[9] === 6 ? 4 : 3;
      assert.equal(data[10], 0);
      assert.equal(data[11], 0);
      assert.equal(data[12], 0);
    } else if (type === "IDAT") {
      idatBytes += length;
      assert.ok(idatBytes <= 8 * 1024 * 1024);
      idat.push(data);
    } else if (type === "IEND") {
      assert.equal(length, 0);
      sawIend = true;
      assert.equal(offset + 12, buffer.length);
      break;
    }
    offset += length + 12;
  }
  assert.ok(width > 0);
  assert.ok(height > 0);
  assert.ok(idat.length > 0);
  assert.equal(sawIend, true);
  const stride = width * channels;
  const rawLength = (stride + 1) * height;
  assert.ok(rawLength <= 1440 * 1000 * 4 + 1000);
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: rawLength });
  assert.equal(raw.length, rawLength);
  const pixels = Buffer.alloc(width * height * 4);
  const prior = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const decoded = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? decoded[x - channels] : 0;
      const up = prior[x] ?? 0;
      const upperLeft = x >= channels ? (prior[x - channels] ?? 0) : 0;
      const prediction = left + up - upperLeft;
      const pa = Math.abs(prediction - left);
      const pb = Math.abs(prediction - up);
      const pc = Math.abs(prediction - upperLeft);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth;
      decoded[x] = (row[x] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      pixels[target] = decoded[source];
      pixels[target + 1] = decoded[source + 1];
      pixels[target + 2] = decoded[source + 2];
      pixels[target + 3] = channels === 4 ? decoded[source + 3] : 255;
    }
    decoded.copy(prior);
  }
  return { width, height, pixels };
}

function pixelDelta(a: PixelImage, b: PixelImage) {
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let changed = 0;
  let maxChannelDelta = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    let different = false;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(a.pixels[i + channel] - b.pixels[i + channel]);
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (delta > 2) different = true;
    }
    if (different) changed++;
  }
  return { changedRatio: changed / (a.width * a.height), maxChannelDelta };
}

async function observedModelProjection(canvas: Locator, id: string): Promise<ModelProjection> {
  return canvas.evaluate((element, itemId) => {
    const scene = (window as EquipmentWindow).__equipmentScenes?.findLast(candidate => candidate.__r3f?.root.getState().gl.domElement === element);
    const root = scene?.__r3f?.root.getState();
    const model = scene?.getObjectByName(`equipment:${itemId}`);
    const width = (element as HTMLCanvasElement).width, height = (element as HTMLCanvasElement).height;
    const result: ModelProjection = { id: itemId, meshNames: [], visibleTriangles: 0, bounds: null, width, height };
    if (!root || !model) return result;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    model.traverse(object => {
      if (!(object as Mesh).isMesh) return;
      for (let parent = object; parent; parent = parent.parent!) if (!parent.visible) return;
      const mesh = object as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!materials.some(material => material.visible && material.opacity > 0)) return;
      const positions = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
      if (!positions || positions.count > 100000) return;
      const vertices = Array.from({ length: positions.count }, (_, i) => mesh.position.clone().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(root.camera));
      let triangles = 0;
      const count = index?.count ?? positions.count;
      if (count > 300000) return;
      for (let i = 0; i + 2 < count; i += 3) {
        const points = [0, 1, 2].map(j => vertices[index ? index.getX(i + j) : i + j]);
        if (points.some(point => !Number.isFinite(point.x + point.y + point.z))) continue;
        if (["x", "y", "z"].some(axis => points.every(point => point[axis as "x" | "y" | "z"] < -1) || points.every(point => point[axis as "x" | "y" | "z"] > 1))) continue;
        const [a, b, c] = points;
        if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-10) continue;
        triangles++;
        for (const point of points) { const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
      if (triangles) { result.meshNames.push(mesh.name); result.visibleTriangles += triangles; }
    });
    if (result.visibleTriangles) result.bounds = [Math.max(0, Math.floor(minX)), Math.max(0, Math.floor(minY)), Math.min(width, Math.ceil(maxX)), Math.min(height, Math.ceil(maxY))];
    return result;
  }, id);
}

function foregroundEvidence(image: PixelImage, id: string, projection: ModelProjection) {
  expect(projection.id).toBe(id);
  const expectedNames = getEquipmentRecipe(id)!.parts.map(part => `${part.anchor}:${part.id}`).sort();
  expect([...projection.meshNames].sort(), `${id}: actual visible model meshes, not pedestal`).toEqual(expectedNames);
  expect(projection.visibleTriangles).toBeGreaterThan(0);
  expect(projection.bounds).not.toBeNull();
  const [bx0, by0, bx1, by1] = projection.bounds!;
  const x0 = Math.floor(bx0 * image.width / projection.width), x1 = Math.ceil(bx1 * image.width / projection.width);
  const y0 = Math.floor(by0 * image.height / projection.height), y1 = Math.ceil(by1 * image.height / projection.height);
  expect(x1 - x0).toBeGreaterThan(2); expect(y1 - y0).toBeGreaterThan(2);
  let count = 0;
  let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
  for (let y = y0; y < y1; y++) {
    const left = (y * image.width + Math.floor(image.width * .04)) * 4;
    const right = (y * image.width + Math.ceil(image.width * .96) - 1) * 4;
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      const edge = Math.abs(image.pixels[i] - image.pixels[left]) + Math.abs(image.pixels[i + 1] - image.pixels[left + 1]) + Math.abs(image.pixels[i + 2] - image.pixels[left + 2]);
      const side = Math.abs(image.pixels[i] - image.pixels[right]) + Math.abs(image.pixels[i + 1] - image.pixels[right + 1]) + Math.abs(image.pixels[i + 2] - image.pixels[right + 2]);
      if (Math.min(edge, side) > 48) {
        count++;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  const bounds = count ? [minX, minY, maxX, maxY] as [number, number, number, number] : null;
  expect(count, "observed model-region decoded pixels must contrast with the local canvas background (combined scene + pixel gate)").toBeGreaterThan(8);
  expect(bounds, "model-region decoded pixels must have spatial support").not.toBeNull();
  expect(bounds![2] - bounds![0]).toBeGreaterThan(2);
  expect(bounds![3] - bounds![1]).toBeGreaterThan(2);
  return { foregroundPixels: count, foregroundBounds: bounds };
}

function stateEconomy(state: GameState) {
  return structuredClone({ gold: state.gold, inventory: state.inventory, equipment: state.equipment, materials: state.materials, ledger: state.ledger, ownedFurniture: state.ownedFurniture, ownedCosmetics: state.ownedCosmetics, equippedCosmetics: state.equippedCosmetics, ownedPetAccessories: state.ownedPetAccessories });
}

async function isolatedGame(page: Page) {
  let state = createInitialState("equipment-gallery-v7", NOW);
  state.settings.graphics = "performance";
  state.settings.reducedMotion = true;
  const commands: Command[] = [];
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const warnings: string[] = [];
  const unexpectedApi: string[] = [];
  const receipts = new Map<string, { fingerprint: string; result: ActionResult }>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); if (message.type() === "warning") warnings.push(message.text()); });
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/game") { unexpectedApi.push(`${request.method()} ${request.url()}`); await route.fulfill({ status: 503, json: { error: "API ngoài phạm vi kiểm thử." } }); return; }
    if (request.method() === "GET") { await route.fulfill({ json: { state, mode: "local" } }); return; }
    if (request.method() !== "POST") { unexpectedApi.push(`${request.method()} ${request.url()}`); await route.fulfill({ status: 405, json: { error: "Phương thức không được hỗ trợ." } }); return; }
    const command = request.postDataJSON() as Command;
    commands.push(structuredClone(command));
    if (command.expectedOwnerId && command.expectedOwnerId !== state.userId) { await route.fulfill({ status: 409, json: { error: "Phiên người chơi đã thay đổi.", code: "OWNER_CHANGED" } }); return; }
    const fingerprint = JSON.stringify(command.action);
    const previous = receipts.get(command.key);
    if (previous && previous.fingerprint !== fingerprint) { await route.fulfill({ status: 409, json: { error: "Mã thao tác đã được dùng cho nội dung khác." } }); return; }
    try {
      const context = { userId: state.userId, now: NOW, random: () => 0.5, eventId: randomUUID() };
      if (!previous && command.action.type !== "reconcile") state = applyAction(state, { type: "reconcile" }, { ...context, eventId: randomUUID() }).state;
      const result = previous ? { ...previous.result, state } : applyAction(state, command.action, context);
      state = result.state;
      if (!previous) receipts.set(command.key, { fingerprint, result });
      await route.fulfill({ json: result });
    } catch (error) { await route.fulfill({ status: 422, json: { error: error instanceof Error ? error.message : "Thao tác không hợp lệ." } }); }
  });
  await page.addInitScript(() => {
    const target = window as EquipmentWindow;
    const observer = target.__THREE_DEVTOOLS__ ?? new EventTarget();
    target.__THREE_DEVTOOLS__ = observer;
    target.__equipmentScenes = [];
    observer.addEventListener("observe", event => { const object = (event as CustomEvent).detail; if (object?.isScene && !target.__equipmentScenes!.includes(object)) target.__equipmentScenes!.push(object); });
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const method of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"] as const) {
        const target = prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
        const original = target[method];
        if (!original || !Object.prototype.hasOwnProperty.call(prototype, method)) continue;
        target[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          const result = original.apply(this, args);
          if (this.canvas instanceof HTMLCanvasElement) {
            const canvas = this.canvas;
            canvas.dataset.equipmentDraws = String(Number(canvas.dataset.equipmentDraws ?? 0) + 1);
            if (canvas.dataset.alphaRequest && canvas.dataset.alphaQueued !== "true") {
              canvas.dataset.alphaQueued = "true";
              queueMicrotask(() => {
                canvas.dataset.alphaQueued = "false";
                if (!canvas.dataset.alphaRequest) return;
                const request = JSON.parse(canvas.dataset.alphaRequest) as { height: number; id: string; bounds: [number, number, number, number] };
                delete canvas.dataset.alphaRequest;
                try {
                  if (this.getParameter(this.FRAMEBUFFER_BINDING) !== null || this.isContextLost()) throw new Error("No live default WebGL framebuffer");
                  if (canvas.width > 1440 || canvas.height > 1000 || request.height < 1 || request.height > canvas.height) throw new Error("Alpha readback exceeds bounded canvas region");
                  const data = new Uint8Array(canvas.width * request.height * 4);
                  this.readPixels(0, canvas.height - request.height, canvas.width, request.height, this.RGBA, this.UNSIGNED_BYTE, data);
                  let pixels = 0, minX = canvas.width, maxX = -1, minY = request.height, maxY = -1, cornerAlpha = 0;
                  for (let y = 0; y < request.height; y++) for (let x = 0; x < canvas.width; x++) {
                    const alpha = data[(y * canvas.width + x) * 4 + 3];
                    if (y >= request.height - 4 && (x < 4 || x >= canvas.width - 4)) cornerAlpha = Math.max(cornerAlpha, alpha);
                    const screenY = request.height - 1 - y;
                    if (x >= request.bounds[0] && x < request.bounds[2] && screenY >= request.bounds[1] && screenY < request.bounds[3] && alpha > 128) { pixels++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
                  }
                  canvas.dataset.alphaResult = JSON.stringify({ pixels, width: maxX - minX + 1, height: maxY - minY + 1, cornerAlpha, id: canvas.closest("[data-item-id]")?.getAttribute("data-item-id"), draws: Number(canvas.dataset.equipmentDraws) });
                } catch (error) { canvas.dataset.alphaResult = JSON.stringify({ error: String(error) }); }
              });
            }
          }
          return result;
        };
      }
    }
  });
  return { state: () => state, commands, errors, consoleErrors, warnings, unexpectedApi };
}

test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });

function pngFixture(width: number, height: number, raw?: Buffer) {
  const chunk = (type: string, data: Buffer) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    result.write(type, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(raw ?? Buffer.alloc((width * 4 + 1) * height))), chunk("IEND", Buffer.alloc(0))]);
}

test("bounded PNG decoder and pixel guards reject invalid or blank evidence", async () => {
  const rgba = Buffer.from([0, 10, 20, 30, 255, 40, 50, 60, 128]);
  expect([...decodePng(pngFixture(2, 1, rgba)).pixels]).toEqual([10, 20, 30, 255, 40, 50, 60, 128]);
  expect(() => decodePng(Buffer.from("89504e470d0a1a0a", "hex"))).toThrow();
  expect(() => decodePng(pngFixture(2, 1).subarray(0, 40))).toThrow();
  expect(() => decodePng(pngFixture(1441, 1))).toThrow();
  const corrupt = pngFixture(2, 1); corrupt[32] ^= 1;
  expect(() => decodePng(corrupt)).toThrow();
  expect(() => decodePng(Buffer.concat([pngFixture(2, 1), Buffer.from([0])]))).toThrow();
  expect(() => decodePng(pngFixture(2, 1, Buffer.alloc(100)))).toThrow();
  const invalidFilter = Buffer.alloc(9); invalidFilter[0] = 5;
  expect(() => decodePng(pngFixture(2, 1, invalidFilter))).toThrow();
  const image: PixelImage = { width: 400, height: 280, pixels: Buffer.alloc(400 * 280 * 4) };
  const projection = (id: string): ModelProjection => ({ id, meshNames: getEquipmentRecipe(id)!.parts.map(part => `${part.anchor}:${part.id}`), visibleTriangles: 12, bounds: [190, 20, 210, 40], width: 400, height: 280 });
  expect(() => foregroundEvidence(image, STARTER_ID, projection(STARTER_ID))).toThrow();
  for (const id of ALL_IDS) {
    const pedestalOnly = { ...image, pixels: Buffer.from(image.pixels) };
    for (let y = 10; y < image.height; y++) for (let x = 100; x < 300; x++) pedestalOnly.pixels.fill(255, (y * 400 + x) * 4, (y * 400 + x + 1) * 4);
    expect(() => foregroundEvidence(pedestalOnly, id, { ...projection(id), meshNames: [], visibleTriangles: 0, bounds: null })).toThrow();
    expect(() => foregroundEvidence(pedestalOnly, id, { ...projection(id), meshNames: ["pedestal"] })).toThrow();
    expect(() => foregroundEvidence(pedestalOnly, id, { ...projection(id), visibleTriangles: 0 })).toThrow();
  }
  const model = { ...image, pixels: Buffer.from(image.pixels) };
  for (let y = 20; y < 40; y++) for (let x = 190; x < 210; x++) model.pixels.fill(255, (y * 400 + x) * 4, (y * 400 + x + 1) * 4);
  expect(foregroundEvidence(model, STARTER_ID, projection(STARTER_ID)).foregroundPixels).toBe(400);
  const flat = { ...image, pixels: Buffer.from(image.pixels) };
  for (let y = 145; y < 155; y++) for (let x = 180; x < 220; x++) flat.pixels.fill(255, (y * 400 + x) * 4, (y * 400 + x + 1) * 4);
  expect(foregroundEvidence(flat, "neural-visor", { ...projection("neural-visor"), bounds: [180, 145, 220, 155] }).foregroundPixels).toBe(400);
  expect(pixelDelta(model, model)).toEqual({ changedRatio: 0, maxChannelDelta: 0 });
  expect(pixelDelta(model, image).changedRatio).toBeGreaterThan(0);
});

async function openSection(page: Page, name: string) {
  await page.goto("/");
  const welcomeClose = page.getByRole("button", { name: "Đóng hướng dẫn, giữ nguyên tiến trình", exact: true });
  await welcomeClose.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
}

async function capturePreview(page: Page, info: TestInfo, id: string, name: string, stage: Locator, canvas: Locator, beforeDraws: number): Promise<Capture> {
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect.poll(async () => Number(await canvas.getAttribute("data-equipment-draws") ?? 0)).toBeGreaterThan(beforeDraws);
  const live = await canvas.evaluate(element => { const node = element as HTMLCanvasElement; const gl = node.getContext("webgl2"); return { live: Boolean(gl && !gl.isContextLost()), width: node.width, height: node.height }; });
  expect(live.live, `${id}: live WebGL2 context`).toBe(true);
  expect(live.width, `${id}: canvas width`).toBeGreaterThan(200);
  expect(live.height, `${id}: canvas height`).toBeGreaterThan(200);
  await stage.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
  const viewport = page.viewportSize()!;
  const stageBounds = await stage.boundingBox();
  const canvasBounds = await canvas.boundingBox();
  try {
    for (const bounds of [stageBounds, canvasBounds]) { expect(bounds).not.toBeNull(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height); }
  } catch (error) {
    const scrollMetrics = await stage.evaluate(element => {
      const ancestors = [];
      for (let node: Element | null = element; node && ancestors.length < 16; node = node.parentElement) {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        ancestors.push({ tag: node.tagName, id: node.id, className: node.getAttribute("class"), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, scrollTop: node.scrollTop, scrollLeft: node.scrollLeft, scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, clientWidth: node.clientWidth, overflowX: style.overflowX, overflowY: style.overflowY, position: style.position, top: style.top });
      }
      return { scrollX: window.scrollX, scrollY: window.scrollY, innerWidth: window.innerWidth, innerHeight: window.innerHeight, ancestors };
    });
    await info.attach(`${id}-viewport-bounds`, { body: JSON.stringify({ viewport, stageBounds, canvasBounds, scrollMetrics }), contentType: "application/json" });
    throw error;
  }
  let previous: PixelImage | undefined;
  let finalImage: PixelImage | undefined;
  let finalShot: Buffer | undefined;
  let consecutiveExactPairs = 0;
  const diagnostics: { changedRatio: number; maxChannelDelta: number }[] = [];
  const alphaSamples: Capture["modelPresence"]["alphaSamples"] = [];
  const projections: ModelProjection[] = [];
  const identity = randomUUID();
  await canvas.evaluate((node, token) => { (node as HTMLCanvasElement).dataset.captureIdentity = token; }, identity);
  const deadline = Date.now() + 20_000;
  try {
    for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt++) {
      await expect(canvas).toHaveAttribute("data-capture-identity", identity);
      expect(await canvas.evaluate(node => node.closest("[data-item-id]")?.getAttribute("data-item-id"))).toBe(id);
      const shot = await canvas.screenshot({ animations: "disabled", scale: "css", timeout: 2_000 });
      const decoded = decodePng(shot);
      const projection = await observedModelProjection(canvas, id);
      foregroundEvidence(decoded, id, projection);
      projections.push(projection);
      await canvas.evaluate((node, request) => { const element = node as HTMLCanvasElement; delete element.dataset.alphaResult; element.dataset.alphaRequest = JSON.stringify(request); }, { id, height: live.height, bounds: projection.bounds! });
      await expect.poll(() => canvas.getAttribute("data-alpha-result"), { timeout: 2_000, intervals: [50, 100] }).not.toBeNull();
      const alpha = JSON.parse((await canvas.getAttribute("data-alpha-result"))!) as Capture["modelPresence"]["alphaSamples"][number] & { error?: string };
      expect(alpha.error).toBeUndefined();
      expect(alpha.id).toBe(id);
      expect(alpha.cornerAlpha, `${id}: actual WebGL background alpha is transparent`).toBe(0);
      expect(alpha.pixels, `${id}: opaque geometry exists within observed model projection (scene + pixel gate)`).toBeGreaterThan(8);
      expect(alpha.width).toBeGreaterThan(2);
      expect(alpha.height).toBeGreaterThan(2);
      alphaSamples.push(alpha);
      if (previous) {
        const delta = pixelDelta(previous, decoded);
        diagnostics.push(delta);
        consecutiveExactPairs = delta.maxChannelDelta === 0 ? consecutiveExactPairs + 1 : 0;
      }
      previous = decoded;
      finalImage = decoded;
      finalShot = shot;
      if (consecutiveExactPairs >= 3) break;
    }
    expect(consecutiveExactPairs, `${id}: three consecutive exact decoded RGBA frame pairs within 12 captures / 20 seconds`).toBeGreaterThanOrEqual(3);
    expect(await canvas.boundingBox()).toEqual(canvasBounds);
    expect(await canvas.evaluate(element => [(element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height])).toEqual([live.width, live.height]);
    expect(alphaSamples.at(-1)!.draws).toBeGreaterThan(alphaSamples[0].draws);
  } finally {
    await info.attach(`${id}-pixel-diagnostics`, { body: JSON.stringify({ consecutiveExactPairs, diagnostics, gate: "observed-scene-plus-pixels", projections, alphaSamples }), contentType: "application/json" });
    if (finalShot) await info.attach(`${id}-last-sampled-frame`, { body: finalShot, contentType: "image/png" });
  }
  const finalEvidence = foregroundEvidence(finalImage!, id, projections.at(-1)!);
  const screenshot = info.outputPath(`${id}.png`);
  const canvasScreenshot = info.outputPath(`${id}-canvas.png`);
  await stage.screenshot({ path: screenshot, animations: "disabled", scale: "css" });
  await writeFile(canvasScreenshot, finalShot!);
  await info.attach(id, { path: screenshot, contentType: "image/png" });
  await info.attach(`${id}-canvas`, { path: canvasScreenshot, contentType: "image/png" });
  return { id, name, slot: String(await stage.locator(".item-3d-showcase").getAttribute("data-slot")), screenshot, canvasScreenshot, canvasSha256: createHash("sha256").update(finalShot!).digest("hex"), canvasBytes: finalShot!.byteLength, decoded: { width: finalImage!.width, height: finalImage!.height, changedRatio: diagnostics.at(-1)!.changedRatio, ...finalEvidence }, viewport, stageBounds: stageBounds!, canvasBounds: canvasBounds!, live, draws: Number(await canvas.getAttribute("data-equipment-draws") ?? 0), stability: { samples: alphaSamples.length, consecutiveExactPairs, diagnostics }, modelPresence: { gate: "observed-scene-plus-pixels", projections, alphaSamples } };
}

test("all 74 equipment previews: 73 shop ID searches plus starter inventory, no purchases", async ({ page }, info) => {
  test.setTimeout(Math.max(300_000, ALL_IDS.length * 20_000));
  const game = await isolatedGame(page);
  const captures: Capture[] = [];
  const selected: string[] = [];
  const baseline = stateEconomy(game.state());
  const snapshotHash = createHash("sha256").update(JSON.stringify(EQUIPMENT_CATALOG)).digest("hex");
  const recipeSnapshotHash = createHash("sha256").update(JSON.stringify(ALL_IDS.map(id => [id, getEquipmentRecipe(id)]))).digest("hex");
  try {
    expect(EQUIPMENT_CATALOG).toHaveLength(74);
    expect(new Set(ALL_IDS).size).toBe(74);
    expect(new Set(EQUIPMENT_CATALOG.map(item => item.modelId)).size).toBe(74);
    expect([...ITEMS.map(item => item.id)].sort()).toEqual([...ALL_IDS].sort());
    expect(SHOP_IDS).toHaveLength(73);
    expect(ALL_IDS.filter(id => !SHOP_IDS.includes(id))).toEqual([STARTER_ID]);
    expect(ALL_IDS.every(id => (getEquipmentRecipe(id)?.parts.length ?? 0) > 0)).toBe(true);
    await openSection(page, "Cửa hàng trang bị");
    const shopStage = page.locator(".equipment-shop-preview");
    const shopCanvas = shopStage.locator(".item-3d-showcase canvas");
    const search = page.getByLabel("Tìm trang bị", { exact: true });
    for (const item of EQUIPMENT_CATALOG.filter(entry => entry.price > 0)) {
      await search.fill(item.id);
      const card = page.locator(`[data-shop-item-id="${item.id}"]`);
      await expect(card).toHaveCount(1);
      await expect(page.locator("[data-shop-item-id]")).toHaveCount(1);
      await expect(card.locator("strong")).toHaveText(item.name);
      const owned = baseline.inventory.filter(instance => instance.definitionId === item.id).length;
      await expect(card.locator(".ref-owned")).toHaveText(`Sở hữu ${owned}`);
      await expect(card.locator("small").first()).toHaveText(`${item.price} G · CẤP ${item.level}`);
      const beforeDraws = Number(await shopCanvas.getAttribute("data-equipment-draws") ?? 0);
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(shopStage.locator(`.item-3d-showcase[data-item-id="${item.id}"]`)).toHaveCount(1);
      await expect(shopStage.locator("h3")).toHaveText(item.name);
      const capture = await capturePreview(page, info, item.id, item.name, shopStage, shopCanvas, beforeDraws);
      expect(capture.slot).toBe(item.slot);
      await expect(shopStage.locator(".ref-price > span")).toHaveText(`${item.price} G`);
      await expect(shopStage.getByText(`Sở hữu ${owned} · ID: ${item.id}`, { exact: true })).toBeVisible();
      await expect(card.locator(".ref-owned")).toHaveText(`Sở hữu ${owned}`);
      await expect(card.locator("small").first()).toHaveText(`${item.price} G · CẤP ${item.level}`);
      await expect(page.locator(".equipment-shop .ref-wallet")).toHaveText(`${baseline.gold.toLocaleString("vi-VN")} VÀNG`);
      await expect(page.getByRole("group", { name: "Xác nhận mua", exact: true })).toHaveCount(0);
      captures.push(capture);
      selected.push(item.id);
      expect(stateEconomy(game.state()), `${item.id}: preview must not change economy or equipment`).toEqual(baseline);
      expect(game.commands.filter(command => command.action.type !== "reconcile"), `${item.id}: preview must not send mutations`).toEqual([]);
      expect(game.errors).toEqual([]);
      expect(game.consoleErrors).toEqual([]);
      expect(game.unexpectedApi).toEqual([]);
    }
    await search.fill(STARTER_ID);
    await expect(page.locator(`[data-shop-item-id="${STARTER_ID}"]`)).toHaveCount(0);
    await page.locator(".sidebar").getByRole("button", { name: "Túi đồ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Kho trang bị", exact: true })).toBeVisible();
    const inventorySearch = page.getByLabel("Tìm vật phẩm", { exact: true });
    const starter = EQUIPMENT_CATALOG.find(item => item.id === STARTER_ID)!;
    await inventorySearch.fill(starter.name);
    await expect(page.locator(".ref-slot")).toHaveCount(1);
    await page.locator(".ref-slot").click();
    await expect(page.locator(".ref-slot")).toHaveAttribute("aria-pressed", "true");
    const starterStage = page.locator(".ref-inspector");
    const starterCanvas = starterStage.locator(".item-3d-showcase canvas");
    await expect(starterStage.locator(".item-3d-showcase[data-item-id=\"starter-blade\"]")).toHaveCount(1);
    const starterBeforeDraws = Number(await starterCanvas.getAttribute("data-equipment-draws") ?? 0);
    await expect(starterStage.locator("h3")).toHaveText(starter.name);
    captures.push(await capturePreview(page, info, STARTER_ID, starter.name, starterStage, starterCanvas, starterBeforeDraws));
    selected.push(STARTER_ID);
    expect(stateEconomy(game.state())).toEqual(baseline);
    expect(game.commands.filter(command => command.action.type !== "reconcile")).toEqual([]);
    expect([...selected].sort()).toEqual([...ALL_IDS].sort());
    expect(captures).toHaveLength(74);
    expect(game.errors).toEqual([]);
    expect(game.consoleErrors).toEqual([]);
    expect(game.unexpectedApi).toEqual([]);
    expect(createHash("sha256").update(JSON.stringify(EQUIPMENT_CATALOG)).digest("hex")).toBe(snapshotHash);
  } finally {
    await info.attach("equipment-gallery-manifest", { body: JSON.stringify({ surface: { shopSearchableCount: SHOP_IDS.length, inventoryStarterCount: 1, excludedFromShop: [STARTER_ID], sourceCatalogCount: EQUIPMENT_CATALOG.length }, snapshotHash, recipeSnapshotHash, catalog: EQUIPMENT_CATALOG, recipes: ALL_IDS.map(id => getEquipmentRecipe(id)), expectedIds: ALL_IDS, selected, captures, errors: game.errors, consoleErrors: game.consoleErrors, warnings: game.warnings, unexpectedApi: game.unexpectedApi, commands: game.commands, finalState: stateEconomy(game.state()), note: "API is mocked in the test with createInitialState/applyAction; no database is used and preview never purchases." }, null, 2), contentType: "application/json" });
  }
});
