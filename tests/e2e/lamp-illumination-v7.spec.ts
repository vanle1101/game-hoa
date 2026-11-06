import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { Matrix4, Vector3, type Camera, type Light, type PointLight, type Raycaster, type WebGLRenderer, type Mesh, type MeshStandardMaterial, type Object3D, type Scene } from "three";
import { applyAction, createInitialState } from "../../src/domain/engine";
import type { Action, GameState } from "../../src/domain/types";
import { constructionContext, validateConstruction } from "../../src/construction/engine";
import type { BuildingFurniture, BuildingPlan } from "../../src/construction/types";
import { getFurnitureDefinition, getFurnitureRecipe } from "../../src/furniture/catalog";
import { fulfillIsolatedGuestBootstrap } from "./support/isolated-guest-bootstrap";

const NOW = "2026-10-16T08:00:00.000Z";
const BLOCKED = "Đồ vật chưa có lối tiếp cận. Di chuyển nội thất hoặc thêm cửa.";
const CANVAS = ".world-canvas canvas";
const DESTINATIONS = ["Phục hồi sau một ngày dài", "Tập trung sâu", "Bộ trang bị", "Xưởng chế tạo"];

type Entry = {
  id: string;
  part: string;
  width: number;
  depth: number;
  toggle?: true;
  heading?: string;
  scope?: string;
  pose?: "sleeping" | "working";
};
const LAMPS: Entry[] = [
  { id: "neon-floor-lamp", part: "light-ring", width: 1, depth: 1, toggle: true },
  { id: "v7-paper-lantern", part: "diffuser", width: 1, depth: 1, toggle: true },
];
type Quality = "balanced" | "high";
type LightState = { uuid: string; name: string; type: string; intensity: number; color: number[]; position: number[]; distance: number | null; decay: number | null; castShadow: boolean; visible: boolean };
type Receiver = { key: string; zone: "target" | "control"; x: number; y: number; mesh: string; material: string; world: number[]; emissive: number[]; emissiveIntensity: number; materialType: string };

type Placement = BuildingFurniture & { width: number; depth: number };
type PartState = {
  name: string;
  mesh: string;
  geometry: string;
  material: string;
  color: number[];
  emissive: number[];
  intensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  visible: boolean;
  matrix: number[];
};
type Frame = {
  at: number;
  canvas: boolean;
  avatar: { uuid: string; x: number; y: number; z: number; rotationX: number; rotationY: number } | null;
  destinations: string[];
  intensities: Record<string, number[]>;
  lights: LightState[];
};
type Snapshot = {
  scene: string;
  avatar: Frame["avatar"];
  models: Record<string, { uuid: string; parts: PartState[] }>;
  lights: LightState[];
  renderer: { exposure: number; toneMapping: number; width: number; height: number; dpr: number; shadows: boolean };
  view: number[];
  projection: number[];
};
type ObservedScene = Scene & { __r3f?: { root: { getState: () => { gl: WebGLRenderer; camera: Camera; raycaster: Raycaster } } } };
type Observer = {
  scenes: ObservedScene[];
  frames: Frame[];
  stop: boolean;
  snapshot: () => Snapshot | null;
  start: () => void;
  receivers: () => Receiver[];
};
type ProbeWindow = Window & { __THREE_DEVTOOLS__?: EventTarget; __furnitureV7: Observer };

async function installObserver(page: Page, placements: Placement[]) {
  await page.addInitScript(({ placements, destinations, canvasSelector }) => {
    localStorage.setItem("lifelevel-entered", "true");
    const host = window as unknown as ProbeWindow;
    const observer: Observer = { scenes: [], frames: [], stop: true, snapshot: () => null, start: () => {}, receivers: () => [] };
    host.__furnitureV7 = observer;
    const tools = host.__THREE_DEVTOOLS__ ?? new EventTarget();
    host.__THREE_DEVTOOLS__ = tools;
    tools.addEventListener("observe", event => {
      const object = (event as CustomEvent).detail as ObservedScene | undefined;
      if (object?.isScene && !observer.scenes.includes(object)) observer.scenes.push(object);
    });
    const flatten = (root: Object3D): Object3D[] => [root, ...root.children.flatMap(flatten)];
    const locate = () => {
      const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
      if (!canvas) return null;
      const candidates = observer.scenes.filter(scene => scene.__r3f?.root.getState().gl.domElement === canvas);
      if (candidates.length !== 1) return null;
      const scene = candidates[0];
      const nodes = flatten(scene);
      const rigs = nodes.filter(node => node.name === "character-rig");
      if (rigs.length !== 1 || !rigs[0].parent) return null;
      const groups: Record<string, Object3D> = {};
      for (const item of placements) {
        const matches = nodes.filter(node => node.name === `furniture:${item.furnitureId}`
          && Math.abs(node.matrixWorld.elements[12] - item.x - item.width / 2) < .001
          && Math.abs(node.matrixWorld.elements[14] - item.z - item.depth / 2) < .001);
        if (matches.length !== 1) return null;
        groups[item.id] = matches[0];
      }
      return { canvas, scene, nodes, groups, avatar: rigs[0].parent };
    };
    const avatarState = (node: Object3D): NonNullable<Frame["avatar"]> => ({
      uuid: node.uuid, x: node.position.x, y: node.position.y, z: node.position.z,
      rotationX: node.rotation.x, rotationY: node.rotation.y,
    });
    const meshes = (group: Object3D) => flatten(group).filter(node => (node as Mesh).isMesh) as Mesh[];
    const lights = (nodes: Object3D[]): LightState[] => nodes.filter(node => (node as Light).isLight).map(node => {
      const light = node as PointLight;
      return { uuid: light.uuid, name: light.name, type: light.type, intensity: light.intensity, color: light.color.toArray(), position: light.matrixWorld.elements.slice(12, 15), distance: light.isPointLight ? light.distance : null, decay: light.isPointLight ? light.decay : null, castShadow: light.castShadow, visible: light.visible };
    }).sort((a, b) => a.uuid.localeCompare(b.uuid));
    observer.receivers = () => {
      const found = locate();
      if (!found) throw new Error("Receiver world unavailable");
      const { camera, raycaster } = found.scene.__r3f!.root.getState();
      const rect = found.canvas.getBoundingClientRect();
      const output: Receiver[] = [];
      for (const zone of ["target", "control"] as const) {
        const item = placements.find(item => item.id === `${zone}-receiver`)!;
        for (let dx = -1; dx <= 1; dx += .2) for (let dz = -.5; dz <= .5; dz += .2) {
          const point = camera.position.clone().set(item.x + item.width / 2 + dx, .65, item.z + item.depth / 2 + dz).project(camera);
          const x = Math.floor((point.x + 1) * rect.width / 2), y = Math.floor((1 - point.y) * rect.height / 2);
          if (x < 5 || y < 5 || x >= rect.width - 5 || y >= rect.height - 5) continue;
          raycaster.setFromCamera({ x: (x + .5) / rect.width * 2 - 1, y: 1 - (y + .5) / rect.height * 2 } as Parameters<Raycaster["setFromCamera"]>[0], camera);
          const hit = raycaster.intersectObjects(found.scene.children, true).find(hit => {
            let node: Object3D | null = hit.object;
            while (node) { if (!node.visible) return false; node = node.parent; }
            return true;
          });
          if (!hit || !(hit.object as Mesh).isMesh) continue;
          let owner: Object3D | null = hit.object;
          while (owner && owner !== found.groups[item.id]) owner = owner.parent;
          if (!owner) continue;
          const mesh = hit.object as Mesh;
          if (Array.isArray(mesh.material)) continue;
          const material = mesh.material as MeshStandardMaterial;
          if (!material.isMeshStandardMaterial || material.emissive.toArray().some(value => value !== 0) || material.transparent) continue;
          output.push({ key: zone + ':' + dx + ':' + dz, zone: zone as "target" | "control", x, y, mesh: mesh.uuid, material: material.uuid, world: hit.point.toArray(), emissive: material.emissive.toArray(), emissiveIntensity: material.emissiveIntensity, materialType: material.type });
        }
      }
      return output;
    };
    observer.snapshot = () => {
      const found = locate();
      if (!found) return null;
      const camera = found.scene.__r3f!.root.getState().camera;
      const models: Snapshot["models"] = {};
      for (const [id, group] of Object.entries(found.groups)) {
        const parts = meshes(group).map(mesh => {
          if (Array.isArray(mesh.material)) throw new Error(`Unexpected material array: ${mesh.name}`);
          const material = mesh.material as MeshStandardMaterial;
          if (!material.isMeshStandardMaterial) throw new Error(`Unexpected material type: ${mesh.name}`);
          return {
            name: mesh.name, mesh: mesh.uuid, geometry: mesh.geometry.uuid, material: material.uuid,
            color: material.color.toArray(), emissive: material.emissive.toArray(), intensity: material.emissiveIntensity,
            roughness: material.roughness, metalness: material.metalness, opacity: material.opacity,
            transparent: material.transparent, visible: mesh.visible && group.visible,
            matrix: [...mesh.matrixWorld.elements],
          };
        }).sort((a, b) => a.name.localeCompare(b.name));
        models[id] = { uuid: group.uuid, parts };
      }
      return {
        scene: found.scene.uuid, avatar: avatarState(found.avatar), models,
        lights: lights(found.nodes),
        renderer: { exposure: found.scene.__r3f!.root.getState().gl.toneMappingExposure, toneMapping: found.scene.__r3f!.root.getState().gl.toneMapping, width: found.canvas.width, height: found.canvas.height, dpr: devicePixelRatio, shadows: found.scene.__r3f!.root.getState().gl.shadowMap.enabled },
        view: [...camera.matrixWorldInverse.elements], projection: [...camera.projectionMatrix.elements],
      };
    };
    observer.start = () => {
      const found = locate();
      if (!found) throw new Error("Unique live world, furniture instances, and avatar are required");
      observer.stop = false;
      const frames: Frame[] = [];
      observer.frames = frames;
      const started = performance.now();
      const tracked = Object.fromEntries(Object.entries(found.groups).map(([id, group]) => [id, meshes(group)]));
      const record = () => {
        if (observer.stop || observer.frames !== frames) return;
        const headings = [...document.querySelectorAll("h1,h2,h3")].map(node => node.textContent?.trim());
        frames.push({
          at: performance.now() - started, canvas: found.canvas.isConnected,
          avatar: avatarState(found.avatar), destinations: destinations.filter(text => headings.includes(text)),
          lights: lights(found.nodes),
          intensities: Object.fromEntries(Object.entries(tracked).map(([id, items]) => [id, items.map(mesh => (mesh.material as MeshStandardMaterial).emissiveIntensity)])),
        });
        if (frames.length < 900 && performance.now() - started < 12_000 && found.canvas.isConnected) requestAnimationFrame(record);
      };
      record();
    };
  }, { placements, destinations: DESTINATIONS, canvasSelector: CANVAS });
}

async function snapshot(page: Page): Promise<Snapshot> {
  const result = await page.evaluate(() => (window as unknown as ProbeWindow).__furnitureV7.snapshot());
  expect(result, "Passive Three observer must identify the live world without fallback").not.toBeNull();
  return result!;
}

async function startTrace(page: Page) {
  await page.evaluate(() => (window as unknown as ProbeWindow).__furnitureV7.start());
}

async function trace(page: Page, stop = false): Promise<Frame[]> {
  return page.evaluate(stop => {
    const observer = (window as unknown as ProbeWindow).__furnitureV7;
    if (stop) observer.stop = true;
    return observer.frames;
  }, stop);
}

async function clickPart(page: Page, scene: Snapshot, item: Placement, partName: string, info: TestInfo) {
  const parts = scene.models[item.id].parts.filter(part => part.name === partName);
  expect(parts, `Exact named part ${item.id}/${partName}`).toHaveLength(1);
  const part = parts[0];
  const box = await page.locator(CANVAS).boundingBox();
  expect(box).not.toBeNull();
  const projected = new Vector3(part.matrix[12], part.matrix[13], part.matrix[14])
    .applyMatrix4(new Matrix4().fromArray(scene.view)).applyMatrix4(new Matrix4().fromArray(scene.projection));
  expect(Math.abs(projected.x)).toBeLessThan(1);
  expect(Math.abs(projected.y)).toBeLessThan(1);
  expect(Math.abs(projected.z)).toBeLessThan(1);
  const x = box!.x + (projected.x + 1) * box!.width / 2;
  const y = box!.y + (1 - projected.y) * box!.height / 2;
  expect(await page.evaluate(({ x, y, selector }) => document.elementFromPoint(x, y) === document.querySelector(selector), { x, y, selector: CANVAS }), "Projected furniture click must not hit an HTML overlay").toBe(true);
  await info.attach(`click-${item.id}-${partName}`, { body: JSON.stringify({ item, part, x, y, box, projected }), contentType: "application/json" });
  await page.mouse.click(x, y);
}

function perimeter(item: Placement) {
  const cells: { x: number; z: number }[] = [];
  for (let x = item.x; x < item.x + item.width; x++) {
    cells.push({ x: x + .5, z: item.z - .5 }, { x: x + .5, z: item.z + item.depth + .5 });
  }
  for (let z = item.z; z < item.z + item.depth; z++) {
    cells.push({ x: item.x - .5, z: z + .5 }, { x: item.x + item.width + .5, z: z + .5 });
  }
  return cells.filter(point => point.x >= -4.5 && point.x <= 4.5 && point.z >= -4.5 && point.z <= 4.5);
}

function distanceToArrival(frame: Frame, item: Placement) {
  if (!frame.avatar) return Infinity;
  return Math.min(...perimeter(item).map(point => Math.hypot(frame.avatar!.x - point.x, frame.avatar!.z - point.z)));
}

function assertTravel(frames: Frame[], item: Placement) {
  expect(frames.length).toBeGreaterThan(4);
  const start = frames[0].avatar!;
  expect(frames.every(frame => frame.avatar?.uuid === start.uuid)).toBe(true);
  expect(frames.some(frame => frame.avatar && Math.hypot(frame.avatar.x - start.x, frame.avatar.z - start.z) > .15 && distanceToArrival(frame, item) > .12), "Must observe real movement before reaching furniture").toBe(true);
  expect(frames.some(frame => distanceToArrival(frame, item) <= .06), "Must reach a legal orthogonal perimeter cell").toBe(true);
  for (const frame of frames) {
    assert.ok(frame.avatar!.x >= -4.501);
    assert.ok(frame.avatar!.x <= 4.501);
    assert.ok(frame.avatar!.z >= -4.501);
    assert.ok(frame.avatar!.z <= 4.501);
    if (frame.destinations.length) assert.ok(distanceToArrival(frame, item) <= .06, "Destination UI must not activate before arrival");
  }
}

function assertPower(after: Snapshot, baseline: Snapshot, item: Placement, active: boolean) {
  const recipe = getFurnitureRecipe(item.furnitureId)!;
  const expectedParts = [...recipe.parts].sort((a, b) => a.id.localeCompare(b.id));
  const before = baseline.models[item.id];
  const actual = after.models[item.id];
  expect(actual.uuid).toBe(before.uuid);
  expect(actual.parts.map(part => part.name)).toEqual(expectedParts.map(part => part.id));
  let luminous = 0;
  let dark = 0;
  actual.parts.forEach((part, index) => {
    const original = before.parts[index];
    const definition = expectedParts[index];
    const isLuminous = definition.material === "glow" || definition.material === "screen" || definition.surface === "display";
    expect({ ...part, emissive: original.emissive, intensity: original.intensity }).toEqual(original);
    if (isLuminous) {
      luminous++;
      expect(original.intensity).toBe(definition.surface === "display" ? .7 : 1.25);
      expect(Math.max(...original.emissive)).toBeGreaterThan(0);
      expect(part.intensity).toBe(active ? original.intensity : 0);
      expect(part.emissive).toEqual(active ? original.emissive : [0, 0, 0]);
    } else {
      dark++;
      expect(part.intensity).toBe(0);
      expect(part.emissive).toEqual([0, 0, 0]);
    }
    expect(part.visible).toBe(true);
  });
  expect(luminous, "Fixture must contain an actual emissive control").toBeGreaterThan(0);
  expect(dark, "Fixture must contain a non-luminous negative control").toBeGreaterThan(0);
  expect(after.renderer).toEqual(baseline.renderer);
  expect(after.view).toEqual(baseline.view);
  expect(after.projection).toEqual(baseline.projection);
  expect(after.scene).toBe(baseline.scene);
}

function conserved(state: GameState) {
  return {
    gold: state.gold, ledger: state.ledger, character: state.character, journal: state.journal,
    inventory: state.inventory, materials: state.materials, equipment: state.equipment,
    building: state.building, ownedFurniture: state.ownedFurniture, tasks: state.tasks,
    occurrences: state.occurrences, rewardBudgets: state.rewardBudgets,
  };
}

type Game = {
  state: () => GameState;
  placements: Placement[];
  commands: Action[];
  baseline: ReturnType<typeof conserved>;
  traces: { label: string; frames: Frame[] }[];
  screenshots: (label: string) => Promise<void>;
  assertUntouched: () => void;
};

async function scenario(page: Page, info: TestInfo, entry: Entry, blocked: boolean, quality: Quality, run: (game: Game) => Promise<void>) {
  let state = createInitialState(`furniture-behavior-v7-${entry.id}-${blocked ? "blocked" : "open"}-not-live-db`, NOW);
  state = applyAction(state, { type: "housing.settle", districtId: "district07", buildingId: "neon-haven", floor: 8, layoutId: "studio" }, { userId: state.userId, now: NOW, random: () => .5, eventId: randomUUID() }).state;
  state.settings.graphics = quality;
  state.settings.reducedMotion = true;
  Object.assign(state.character, { hp: 60, energy: 50, mood: 55 });
  const definition = getFurnitureDefinition(entry.id)!;
  expect(Math.ceil(definition.width)).toBe(entry.width);
  expect(Math.ceil(definition.depth)).toBe(entry.depth);
  expect(getFurnitureRecipe(entry.id)!.parts.filter(part => part.id === entry.part)).toHaveLength(1);
  const placements: Placement[] = [{ id: "target", furnitureId: entry.id, x: 2, z: 1, level: 0, rotation: 0, width: entry.width, depth: entry.depth }];
  if (entry.toggle) placements.push({ ...placements[0], id: "control", x: -3 });
  state.ownedFurniture[entry.id] = placements.length;
  placements.push({ id: "target-receiver", furnitureId: "haven-sofa", x: 2, z: -2, level: 0, rotation: 0, width: 3, depth: 2 }, { id: "control-receiver", furnitureId: "haven-sofa", x: -5, z: -2, level: 0, rotation: 0, width: 3, depth: 2 });
  state.ownedFurniture["haven-sofa"] = 2;
  const plan: BuildingPlan = {
    floors: Array.from({ length: 100 }, (_, index) => ({ x: index % 10 - 5, z: Math.floor(index / 10) - 5, level: 0, materialId: "floor-concrete" })),
    walls: blocked ? Array.from({ length: 10 }, (_, index) => ({ x: 1, z: index - 5, level: 0, orientation: "z" as const, materialId: "wall-basic" })) : [],
    furniture: placements.map(({ id, furnitureId, x, z, level, rotation }) => ({ id, furnitureId, x, z, level, rotation })),
    curves: [], stairs: [], ceilings: [], roofs: [], roomNames: {},
  };
  state.building!.plan = validateConstruction(state.building!, plan, constructionContext(state));
  const commands: Action[] = [];
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const rejected: string[] = [];
  const requests: { method: string; path: string; action?: string }[] = [];
  const traces: Game["traces"] = [];
  const responses = new Map<string, ReturnType<typeof applyAction>>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await installObserver(page, placements);
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (await fulfillIsolatedGuestBootstrap(route, state.userId)) return;
    const url = new URL(request.url());
    const record: (typeof requests)[number] = { method: request.method(), path: url.pathname };
    requests.push(record);
    if (url.pathname !== "/api/game" || !["GET", "POST"].includes(request.method())) {
      rejected.push(`${record.method} ${record.path}`);
      await route.fulfill({ status: 503, json: { error: "Unrelated API disabled in isolated fixture" } });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ json: { state, mode: "local" } });
      return;
    }
    const body = request.postDataJSON() as { action: Action; expectedOwnerId: string; key: string };
    record.action = body.action.type;
    commands.push(body.action);
    if (body.expectedOwnerId !== state.userId) {
      rejected.push("OWNER_CHANGED");
      await route.fulfill({ status: 409, json: { code: "OWNER_CHANGED" } });
      return;
    }
    try {
      if (!body.key) throw new Error("Missing game command idempotency key");
      const key = body.key;
      const result = responses.get(key) ?? applyAction(state, body.action, { userId: state.userId, now: NOW, random: () => .5, eventId: key });
      responses.set(key, result);
      state = result.state;
      await route.fulfill({ json: result });
    } catch (error) {
      rejected.push(String(error));
      await route.fulfill({ status: 422, json: { error: String(error) } });
    }
  });
  let baseline = structuredClone(conserved(state));
  const game: Game = {
    state: () => state, placements, commands, baseline, traces,
    screenshots: async label => {
      const path = info.outputPath(`${label}.png`);
      await page.screenshot({ path });
      await info.attach(label, { path, contentType: "image/png" });
    },
    assertUntouched: () => {
      expect(conserved(state)).toEqual(baseline);
      expect(commands.filter(action => action.type !== "reconcile")).toEqual([]);
      expect(errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(rejected).toEqual([]);
    },
  };
  try {
    await page.goto("/");
    await expect(page.locator(CANVAS)).toHaveCount(1);
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page.locator(".world-controls > span")).toHaveText(/^\d+ FPS$/);
    await expect.poll(async () => page.evaluate(() => Boolean((window as unknown as ProbeWindow).__furnitureV7.snapshot())), { timeout: 15_000 }).toBe(true);
    const first = await snapshot(page);
    expect(first.avatar!.x).toBeCloseTo(.5, 5);
    expect(first.avatar!.z).toBeCloseTo(.5, 5);
    expect(first.lights.length).toBeGreaterThan(0);
    expect(commands.filter(action => action.type !== "reconcile")).toEqual([]);
    baseline = structuredClone(conserved(state));
    game.baseline = baseline;
    await info.attach("isolated-fixture", { body: JSON.stringify({ source: "createInitialState + applyAction housing.settle; all /api intercepted; not database-backed", now: NOW, plan, baseline }), contentType: "application/json" });
    await run(game);
    expect(errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    expect(rejected).toEqual([]);
  } finally {
    let finalObservation: unknown;
    try {
      finalObservation = await page.evaluate(() => {
        const observer = (window as unknown as ProbeWindow).__furnitureV7;
        observer.stop = true;
        return { frames: observer.frames, snapshot: observer.snapshot() };
      });
    } catch (error) { finalObservation = { unavailable: String(error) }; }
    await info.attach("acceptance-observations", { body: JSON.stringify({ entry, blocked, quality, requests, commands, errors, consoleErrors, rejected, traces, finalObservation, state }), contentType: "application/json" });
  }
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

function ownedLight(scene: Snapshot, id: string) {
  const matches = scene.lights.filter(light => light.name === `furniture-light:${id}`);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].type, "PointLight");
  return matches[0];
}
function assertLights(scene: Snapshot, baseline: Snapshot, active: Record<string, boolean>) {
  expect(scene.lights.map(light => light.uuid)).toEqual(baseline.lights.map(light => light.uuid));
  expect(scene.lights.filter(light => light.type === "PointLight")).toHaveLength(6);
  for (const light of scene.lights) {
    const before = baseline.lights.find(value => value.uuid === light.uuid)!;
    const id = ["target", "control"].find(id => light.name === `furniture-light:${id}`);
    expect(light).toEqual(id ? { ...before, intensity: active[id] ? before.intensity : 0 } : before);
    if (id) { expect(before.intensity).toBe(26); expect(light.castShadow).toBe(false); }
  }
  expect(scene.renderer).toEqual(baseline.renderer);
  expect(scene.view).toEqual(baseline.view);
  expect(scene.projection).toEqual(baseline.projection);
  expect(scene.models["target-receiver"]).toEqual(baseline.models["target-receiver"]);
  expect(scene.models["control-receiver"]).toEqual(baseline.models["control-receiver"]);
}
async function returnNeutral(page: Page) {
  const scene = await snapshot(page), box = await page.locator(CANVAS).boundingBox();
  expect(box).not.toBeNull();
  const point = new Vector3(.5, 0, -3.5).applyMatrix4(new Matrix4().fromArray(scene.view)).applyMatrix4(new Matrix4().fromArray(scene.projection));
  await page.mouse.click(box!.x + (point.x + 1) * box!.width / 2, box!.y + (1 - point.y) * box!.height / 2);
  await expect.poll(async () => { const avatar = (await snapshot(page)).avatar!; return Math.hypot(avatar.x - .5, avatar.z + 3.5); }, { timeout: 10_000 }).toBeLessThan(.06);
  await startTrace(page);
  await expect.poll(async () => (await trace(page)).at(-1)?.at ?? 0).toBeGreaterThan(500);
  await trace(page, true);
}
async function receiverCapture(page: Page, info: TestInfo, label: string) {
  const canvas = page.locator(CANVAS), bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const receivers = await page.evaluate(() => (window as unknown as ProbeWindow).__furnitureV7.receivers());
  for (const zone of ["target", "control"]) expect(receivers.filter(value => value.zone === zone).length, `Visible non-emissive ${zone} receiver pixels`).toBeGreaterThan(8);
  const path = info.outputPath(`${label}-receiver-original.png`);
  const image = pngPixels(await canvas.screenshot({ path }));
  await info.attach(label, { path, contentType: "image/png" });
  const samples = receivers.map(receiver => {
    const x = Math.floor(receiver.x * image.width / bounds!.width), y = Math.floor(receiver.y * image.height / bounds!.height);
    const index = (y * image.width + x) * image.channels;
    return { ...receiver, rgb: [...image.pixels.subarray(index, index + 3)] };
  });
  const state = await snapshot(page);
  await info.attach(`${label}-receiver-records`, { body: JSON.stringify({ bounds, width: image.width, height: image.height, samples, state }), contentType: "application/json" });
  return { samples, state, bounds, dimensions: [image.width, image.height] };
}
type ReceiverCapture = Awaited<ReturnType<typeof receiverCapture>>;
function compareReceivers(a: ReceiverCapture, b: ReceiverCapture, zone: string) {
  expect(b.dimensions).toEqual(a.dimensions);
  expect(b.bounds).toEqual(a.bounds);
  expect(b.state.renderer).toEqual(a.state.renderer);
  expect(b.state.view).toEqual(a.state.view);
  expect(b.state.projection).toEqual(a.state.projection);
  const pairs = a.samples.filter(sample => sample.zone === zone).flatMap(sample => {
    const match = b.samples.find(other => other.key === sample.key && other.mesh === sample.mesh && other.material === sample.material && other.x === sample.x && other.y === sample.y);
    return match ? [{ sample, match }] : [];
  });
  expect(pairs.length).toBeGreaterThan(8);
  return { points: pairs.length, meanAbsolute: pairs.reduce((sum, { sample, match }) => sum + sample.rgb.reduce((value, channel, index) => value + Math.abs(channel - match.rgb[index]), 0) / 3, 0) / pairs.length, meanSigned: pairs.reduce((sum, { sample, match }) => sum + sample.rgb.reduce((value, channel, index) => value + channel - match.rgb[index], 0) / 3, 0) / pairs.length };
}
async function toggle(page: Page, info: TestInfo, game: Game, entry: Entry, item: Placement, initial: Snapshot, active: Record<string, boolean>) {
  const before = await snapshot(page);
  await startTrace(page);
  await clickPart(page, before, item, entry.part, info);
  active[item.id] = !active[item.id];
  await expect.poll(async () => ownedLight(await snapshot(page), item.id).intensity, { timeout: 10_000 }).toBe(active[item.id] ? 26 : 0);
  await expect.poll(async () => (await trace(page)).some(frame => frame.lights.find(light => light.name === `furniture-light:${item.id}`)?.intensity !== ownedLight(before, item.id).intensity)).toBe(true);
  const frames = await trace(page, true);
  game.traces.push({ label: `${item.id}-${active[item.id] ? "on" : "off"}`, frames });
  assertTravel(frames, item);
  for (const frame of frames) {
    assert.deepEqual(frame.destinations, []);
    assert.equal(frame.canvas, true);
    const light = frame.lights.find(light => light.name === `furniture-light:${item.id}`)!;
    if (distanceToArrival(frame, item) > .06) {
      assert.equal(light.intensity, ownedLight(before, item.id).intensity);
      assert.deepEqual(frame.intensities[item.id], frames[0].intensities[item.id]);
    }
    for (const other of frame.lights.filter(light => light.name !== `furniture-light:${item.id}`)) assert.deepEqual(other, before.lights.find(light => light.uuid === other.uuid));
  }
  const changed = frames.find(frame => frame.lights.find(light => light.name === `furniture-light:${item.id}`)!.intensity !== ownedLight(before, item.id).intensity)!;
  expect(distanceToArrival(changed, item)).toBeLessThanOrEqual(.06);
  const after = await snapshot(page);
  assertLights(after, initial, active);
  for (const lamp of game.placements.slice(0, 2)) assertPower(after, initial, lamp, active[lamp.id]);
  game.assertUntouched();
}

test.beforeAll(() => expect(process.env.LAMP_ILLUMINATION_GPU_GRANTED).toBe("true"));
test.describe("owned lamp illumination", () => {
  test.describe.configure({ timeout: 150_000 });
  for (const quality of ["balanced", "high"] as const) for (const entry of LAMPS) for (const blocked of [false, true]) {
    test(`${entry.id} ${quality} ${blocked ? "blocked" : "open"}`, async ({ page }, info) => {
      await scenario(page, info, entry, blocked, quality, async game => {
        const initial = await snapshot(page), [target, control] = game.placements;
        const active = { target: true, control: true };
        assertLights(initial, initial, active);
        for (const item of [target, control]) assertPower(initial, initial, item, true);
        if (blocked) {
          await startTrace(page);
          await clickPart(page, initial, target, entry.part, info);
          await expect(page.getByText(BLOCKED, { exact: true })).toBeVisible();
          await expect.poll(async () => (await trace(page)).at(-1)?.at ?? 0).toBeGreaterThanOrEqual(2_000);
          const frames = await trace(page, true);
          game.traces.push({ label: "blocked", frames });
          expect(frames.length).toBeGreaterThan(10);
          for (const frame of frames) { assert.deepEqual(frame.avatar, frames[0].avatar); assert.deepEqual(frame.intensities, frames[0].intensities); assert.deepEqual(frame.lights, initial.lights); assert.deepEqual(frame.destinations, []); }
          expect((await snapshot(page)).models).toEqual(initial.models);
          assertLights(await snapshot(page), initial, active);
          await game.screenshots("blocked-both-lights-on");
        } else {
          await returnNeutral(page);
          const on = await receiverCapture(page, info, "target-on-baseline");
          const repeat = await receiverCapture(page, info, "target-on-repeat-control");
          await toggle(page, info, game, entry, target, initial, active);
          await returnNeutral(page);
          const off = await receiverCapture(page, info, "target-off");
          await toggle(page, info, game, entry, target, initial, active);
          await returnNeutral(page);
          const restored = await receiverCapture(page, info, "target-on-restored");
          const pixelEvidence = Object.fromEntries(["target", "control"].map(zone => [zone, { noise: compareReceivers(on, repeat, zone), off: compareReceivers(on, off, zone), restored: compareReceivers(on, restored, zone) }]));
          await info.attach("receiver-lighting-deltas", { body: JSON.stringify(pixelEvidence), contentType: "application/json" });
          expect(pixelEvidence.target.off.meanAbsolute).toBeGreaterThan(pixelEvidence.target.noise.meanAbsolute + .1);
          expect(pixelEvidence.target.off.meanSigned).toBeGreaterThan(pixelEvidence.target.noise.meanAbsolute);
          expect(pixelEvidence.target.restored.meanAbsolute).toBeLessThanOrEqual(pixelEvidence.target.noise.meanAbsolute + 1);
          await toggle(page, info, game, entry, control, initial, active);
          await returnNeutral(page);
          await toggle(page, info, game, entry, control, initial, active);
          expect((await snapshot(page)).models).toEqual(initial.models);
          assertLights(await snapshot(page), initial, active);
        }
        game.assertUntouched();
      });
    });
  }
});
